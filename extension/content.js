(() => {
  'use strict';

  const uiLocale = chrome.i18n.getMessage('uiLocale');
  const copyText = {idle: chrome.i18n.getMessage('copyIdle'), success: chrome.i18n.getMessage('copySuccess'), error: chrome.i18n.getMessage('copyError')};
  const ARTICLE = 'article[data-testid="tweet"]';
  const states = new Set();
  const byHost = new WeakMap();
  let scheduled = false;
  const defaults = {directCopy: true, imagesFirst: true, hidePremium: true, hideGrokExplain: true, hideImageEdit: true};
  let settings = {directCopy: false, imagesFirst: false, hidePremium: false, hideGrokExplain: false, hideImageEdit: false};
  let settingsReady = false;
  // 初期URLの明示指定は、設定読込み中に動画へ戻した場合も尊重する。
  let lastMediaPath = new URL(location.href).searchParams.has('filter') ? location.pathname : null;
  const earlyChanges = {};
  let mediaAttempt = null;

  function mediaPath() {
    const match = /^\/([A-Za-z0-9_]{1,15})\/media\/?$/.exec(location.pathname);
    const reserved = ['i', 'settings', 'home', 'search', 'explore', 'notifications', 'messages', 'compose'];
    return match && !reserved.includes(match[1].toLowerCase()) ? location.pathname : null;
  }

  function activateMediaControl(element) {
    // メニューの処理だけを呼ぶ。未準備のリンクでもブラウザの通常遷移は発生させない。
    const event = new MouseEvent('click', {bubbles: true, cancelable: true, composed: true, view: window});
    event.preventDefault();
    element.dispatchEvent(event);
  }

  function finishMediaAttempt(close = false, restoreFocus = true) {
    const attempt = mediaAttempt;
    if (!attempt) return;
    mediaAttempt = null;
    clearTimeout(attempt.timer);
    if (attempt.menu?.isConnected) {
      if (attempt.visibility) attempt.menu.style.setProperty('visibility', attempt.visibility, attempt.priority);
      else attempt.menu.style.removeProperty('visibility');
    }
    if (close && location.pathname === attempt.path && attempt.tab.isConnected &&
      attempt.tab.getAttribute('aria-expanded') === 'true') activateMediaControl(attempt.tab);
    const focused = document.activeElement;
    if (restoreFocus && attempt.focus?.isConnected && attempt.focus !== document.body &&
      (focused === document.body || focused === attempt.tab || attempt.menu?.contains(focused))) {
      attempt.focus.focus({preventScroll: true});
    }
  }

  function applyMediaDefault() {
    const path = mediaPath();
    if (mediaAttempt && (!settings.imagesFirst || path !== mediaAttempt.path)) finishMediaAttempt(true);
    if (!path || !settings.imagesFirst) { lastMediaPath = path; return; }
    if (new URL(location.href).searchParams.has('filter')) {
      lastMediaPath = path;
      finishMediaAttempt();
      return;
    }
    if (mediaAttempt) {
      if (mediaAttempt.selecting) return;
      const menus = [...document.querySelectorAll('[role="menu"]')].filter(menu => !mediaAttempt.previousMenus.has(menu));
      const candidates = menus.map(menu => ({menu, items: [...menu.querySelectorAll('[role="menuitem"]')]}))
        .filter(({items}) => items.length === 2 && items.filter(item => xTweakDomSignals.icon(item, 'check')).length === 1 &&
          items.filter(item => !item.querySelector('svg')).length === 1);
      if (candidates.length !== 1) return;
      const {menu, items} = candidates[0];
      mediaAttempt.menu = menu;
      mediaAttempt.visibility = menu.style.getPropertyValue('visibility');
      mediaAttempt.priority = menu.style.getPropertyPriority('visibility');
      // 自動で開いたメニューだけ、次の描画前に隠して選ぶ。
      menu.style.setProperty('visibility', 'hidden', 'important');
      mediaAttempt.selecting = true;
      // filterなしの動画表示から開いた2択。チェックのない項目が画像。
      activateMediaControl(items.find(item => !item.querySelector('svg')));
      schedule();
      return;
    }
    if (path === lastMediaPath) return;
    const tabs = [...document.querySelectorAll('a[role="tab"][aria-selected="true"][aria-haspopup="menu"]')]
      .filter(tab => new URL(tab.getAttribute('href'), location.origin).pathname === path);
    // タブはXの描画後に現れる。未準備ならMutationObserverから再確認する。
    if (tabs.length !== 1) return;
    const tab = tabs[0];
    lastMediaPath = path;
    if (tab.getAttribute('aria-expanded') === 'true' ||
      document.querySelector('[role="menu"], [role="dialog"]')) return;
    mediaAttempt = {path, tab, previousMenus: new Set(document.querySelectorAll('[role="menu"]')),
      focus: document.activeElement, selecting: false, timer: setTimeout(() => finishMediaAttempt(true), 2000)};
    activateMediaControl(tab);
    schedule();
  }

  function respectMediaInteraction(event) {
    if (!event.isTrusted || !mediaPath()) return;
    if (mediaAttempt) finishMediaAttempt(false, false);
    if (event.composedPath().some(node => node instanceof Element && node.matches('[role="tab"], [role="menuitem"]'))) {
      lastMediaPath = mediaPath();
    }
  }
  window.addEventListener('pointerdown', respectMediaInteraction, true);
  window.addEventListener('keydown', respectMediaInteraction, true);

  function postUrl(article) {
    const header = article.querySelector('[data-testid="User-Name"]');
    if (!header) return null;
    const links = [...header.querySelectorAll('a[href]')].filter(a => a.querySelector('time'));
    if (links.length !== 1) return null;
    try {
      const url = new URL(links[0].getAttribute('href'), location.origin);
      if (url.origin !== 'https://x.com' || url.username || url.password) return null;
      if (!/^\/[A-Za-z0-9_]{1,15}\/status\/[0-9]+$/.test(url.pathname)) return null;
      return `https://x.com${url.pathname}`;
    } catch {
      return null;
    }
  }

  function shareButton(article) {
    const groups = [...article.querySelectorAll('[role="group"]')].filter(group =>
      group.closest(ARTICLE) === article && group.querySelector('[data-testid="reply"]') &&
      group.querySelector('[data-testid="retweet"], [data-testid="unretweet"]'));
    if (groups.length !== 1) return null;
    // リポストなど既知のID付き操作を除き、同じ操作欄に1つだけあるメニュー入口。
    const buttons = [...groups[0].querySelectorAll('button[aria-haspopup="menu"]')].filter(button =>
      button.closest(ARTICLE) === article && button.closest('[role="group"]') === groups[0] &&
      !button.hasAttribute('data-testid'));
    return buttons.length === 1 ? buttons[0] : null;
  }

  function supported() {
    return settingsReady && settings.directCopy && location.origin === 'https://x.com' && location.pathname === '/home';
  }

  function showState(state, label, kind) {
    state.button.setAttribute('aria-label', label);
    state.button.title = label;
    state.button.dataset.state = kind;
    state.live.textContent = kind === 'idle' ? '' : label;
  }

  async function copy(state) {
    if (state.busy) return;
    clearTimeout(state.resetTimer);
    // URLは保存せず、DOMが再利用された後も押した時点の投稿を読む。
    const url = supported() && state.host.isConnected && state.original.isConnected &&
      shareButton(state.article) === state.original ? postUrl(state.article) : null;
    if (!url) {
      showState(state, copyText.error, 'error');
      schedule();
      return;
    }
    state.busy = true;
    state.button.disabled = true;
    try {
      await navigator.clipboard.writeText(url);
      showState(state, copyText.success, 'success');
    } catch {
      // 標準共有やexecCommandへのフォールバックは行わない。
      showState(state, copyText.error, 'error');
    } finally {
      state.busy = false;
      state.button.disabled = false;
      state.resetTimer = setTimeout(() => showState(state, copyText.idle, 'idle'), 2000);
    }
  }

  // Reactのroot captureより手前で、独自ボタンの操作だけを処理する。
  // このリスナーより先に登録されたwindow captureの計測までは保証しない。
  function handleEvent(event) {
    const state = event.composedPath().map(node => byHost.get(node)).find(Boolean);
    if (!state) return;
    event.stopImmediatePropagation();
    // ページJSが生成した操作には拡張機能の書込み権限を使わせない。
    if (!event.isTrusted) {
      event.preventDefault();
      return;
    }
    if (event.type === 'click') {
      event.preventDefault();
      if (event.button === 0) void copy(state);
    } else if (event.type === 'keydown' || event.type === 'keyup') {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (event.type === 'keydown' && !event.repeat) void copy(state);
      }
    } else if (event.type === 'auxclick' || event.type === 'dblclick' || event.type === 'contextmenu') {
      event.preventDefault();
    }
  }

  for (const type of ['click', 'auxclick', 'dblclick', 'contextmenu', 'pointerdown', 'pointerup',
    'mousedown', 'mouseup', 'touchstart', 'touchend', 'keydown', 'keyup',
    'pointerover', 'pointerout', 'mouseover', 'mouseout']) {
    window.addEventListener(type, handleEvent, {capture: true, passive: false});
  }

  function mount(article, original) {
    const host = document.createElement('span');
    host.setAttribute('data-x-direct-copy', '');
    host.lang = uiLocale;
    host.style.cssText = 'display:inline-flex!important;align-items:center!important;vertical-align:middle!important;';
    host.style.color = getComputedStyle(original).color;
    const shadow = host.attachShadow({mode: 'open'});
    // 固定のUIのみ。投稿本文やURLをHTMLへ展開しない。
    shadow.innerHTML = `<style>
      :host{font:inherit;color:inherit}
      button{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;
        box-sizing:border-box;padding:7px;border:0;border-radius:50%;background:transparent;
        color:inherit;cursor:pointer;touch-action:manipulation}
      button:hover{color:#1d9bf0;background:rgba(29,155,240,.12)}
      button:focus-visible{outline:2px solid #1d9bf0;outline-offset:2px}
      button:disabled{cursor:wait;opacity:.6}
      svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;pointer-events:none}
      .success,.error{display:none}
      button[data-state="success"]{color:#00a36c}
      button[data-state="error"]{color:#f45d6e}
      button[data-state="success"] .copy,button[data-state="error"] .copy{display:none}
      button[data-state="success"] .success,button[data-state="error"] .error{display:block}
      .live{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
    </style><button type="button" data-state="idle">
      <svg class="copy" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
      <svg class="success" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>
      <svg class="error" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v8m0 3v1"/></svg>
    </button><span class="live" role="status" aria-live="polite"></span>`;
    const state = {article, original, host, button: shadow.querySelector('button'),
      live: shadow.querySelector('.live'), busy: false, resetTimer: null,
      oldDisplay: original.style.getPropertyValue('display'),
      oldPriority: original.style.getPropertyPriority('display')};
    showState(state, copyText.idle, 'idle');
    byHost.set(host, state);
    states.add(state);
    original.after(host);
    original.style.setProperty('display', 'none', 'important');
  }

  function unmount(state) {
    clearTimeout(state.resetTimer);
    state.host.remove();
    byHost.delete(state.host);
    // X自身が後から変更したstyleは上書きしない。
    if (state.original.style.getPropertyValue('display') === 'none' &&
      state.original.style.getPropertyPriority('display') === 'important') {
      if (state.oldDisplay) state.original.style.setProperty('display', state.oldDisplay, state.oldPriority);
      else state.original.style.removeProperty('display');
    }
    states.delete(state);
  }

  function sync() {
    scheduled = false;
    if (settingsReady) {
      applyMediaDefault();
      xTweakPremiumUI.sync(settings.hidePremium);
      xTweakPostUI.sync(settings);
    }
    const active = supported();
    for (const state of states) {
      if (!active || !state.article.isConnected || !state.original.isConnected || !state.host.isConnected ||
        !postUrl(state.article) || shareButton(state.article) !== state.original) {
        unmount(state);
      }
    }
    if (!active) return;
    const existing = new Set([...states].map(state => state.original));
    for (const article of document.querySelectorAll(ARTICLE)) {
      if (!postUrl(article)) continue;
      const original = shareButton(article);
      if (original && !existing.has(original)) mount(article, original);
    }
    for (const state of states) {
      if (state.original.style.getPropertyValue('display') !== 'none' ||
        state.original.style.getPropertyPriority('display') !== 'important') {
        state.original.style.setProperty('display', 'none', 'important');
      }
    }
  }

  function schedule() {
    if (!scheduled) {
      scheduled = true;
      setTimeout(sync, 32);
    }
  }

  new MutationObserver(() => {
    // メニュー追加は32msの描画調整を待たず処理し、開閉が画面に見えるのを避ける。
    if (settingsReady) {
      applyMediaDefault();
      xTweakPremiumUI.sync(settings.hidePremium);
      xTweakPostUI.sync(settings);
    }
    schedule();
  }).observe(document, {subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['href', 'role', 'title', 'aria-label', 'aria-haspopup', 'aria-selected', 'aria-expanded', 'data-testid', 'style', 'd', 'viewBox']});
  window.addEventListener('popstate', schedule);
  window.addEventListener('pageshow', schedule);
  // pushStateだけで遷移する画面も、DOMの更新を待たず検知する。
  window.navigation?.addEventListener('currententrychange', () => {
    if (lastMediaPath && location.pathname !== lastMediaPath) lastMediaPath = null;
    schedule();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const key of Object.keys(defaults)) {
      if (!(key in changes)) continue;
      const value = typeof changes[key].newValue === 'boolean' ? changes[key].newValue : defaults[key];
      if (!settingsReady) earlyChanges[key] = value;
      if (key === 'imagesFirst' && settings[key] !== value) lastMediaPath = null;
      settings[key] = value;
    }
    schedule();
  });
  chrome.storage.local.get(defaults).then(values => {
    for (const key of Object.keys(defaults)) {
      settings[key] = key in earlyChanges ? earlyChanges[key] :
        typeof values[key] === 'boolean' ? values[key] : defaults[key];
    }
    settingsReady = true;
    schedule();
  }).catch(() => {
    // 設定が読めないときは機能を勝手にオンにしない。
  });
})();
