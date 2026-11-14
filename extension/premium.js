// content scriptのisolated world内で共有する。X側のデータや加入状態は変更しない。
const xTweakPremiumUI = (() => {
  'use strict';
  const hidden = new Map();
  const protectedContent = 'article, [data-testid="tweet"], [data-testid="UserDescription"], [data-testid="UserName"], [role="dialog"], [role="tablist"], section, nav';
  const normalize = element => element.textContent.replace(/\s+/g, ' ').trim();

  function signupLink(anchor) {
    try {
      const url = new URL(anchor.getAttribute('href'), location.origin);
      return url.origin === 'https://x.com' && url.pathname === '/i/premium_sign_up';
    } catch { return false; }
  }

  function safeCard(element) {
    return !element.matches(protectedContent) && !element.closest('article, [data-testid="tweet"], [data-testid="UserDescription"], [role="dialog"]') &&
      !element.querySelector(protectedContent);
  }

  function outerCard(element, boundary) {
    // 同じ案内だけを包む余白用divまで隠す。隣のプロフィール情報や他のカードには広げない。
    const text = normalize(element);
    let node = element;
    while (node.parentElement && node.parentElement !== boundary) {
      const parent = node.parentElement;
      if (parent.tagName !== 'DIV' || normalize(parent) !== text || !safeCard(parent)) break;
      const others = [...parent.children].filter(child => child !== node);
      if (others.some(child => child.tagName !== 'BUTTON' || normalize(child))) break;
      node = parent;
    }
    return node;
  }

  function profileRoute() {
    const match = /^\/([A-Za-z0-9_]{1,15})(?:\/(?:with_replies|reposts|media|highlights|articles))?\/?$/.exec(location.pathname);
    return match && !['home', 'search', 'explore', 'notifications', 'messages', 'settings', 'i', 'compose', 'jobs'].includes(match[1].toLowerCase());
  }

  function targets() {
    const result = new Set();
    for (const anchor of document.querySelectorAll('header nav a[href], a[data-testid="premium-signup-tab"][href]')) {
      if (signupLink(anchor) && !anchor.closest('article, [data-testid="tweet"], [data-testid="UserDescription"], [role="dialog"]')) result.add(anchor);
    }
    const sidebar = document.querySelector('[data-testid="sidebarColumn"]');
    if (sidebar) {
      for (const aside of sidebar.querySelectorAll('aside')) {
        const links = [...aside.querySelectorAll('a[href]')];
        if (links.length === 1 && signupLink(links[0]) && safeCard(aside)) result.add(outerCard(aside, sidebar));
      }
    }
    const primary = document.querySelector('[data-testid="primaryColumn"]');
    if (!profileRoute() || !primary?.querySelector('[data-testid="UserName"]')) return result;
    for (const anchor of primary.querySelectorAll('a[href]')) {
      if (!signupLink(anchor) || anchor.closest('article, [data-testid="tweet"], [data-testid="UserDescription"], [role="dialog"]')) continue;
      let node = anchor.parentElement;
      while (node && node !== primary && safeCard(node)) {
        const links = [...node.querySelectorAll('a[href]')];
        const buttons = [...node.querySelectorAll('button, [role="button"]')];
        const dismissible = node.tagName === 'DIV' && buttons.length === 1 &&
          buttons[0].parentElement === node && xTweakDomSignals.icon(buttons[0], 'close');
        if (links.length === 1 && signupLink(links[0]) &&
          (node.matches('[data-testid="verified_profile_visitor_upsell"]') || dismissible)) {
          result.add(outerCard(node, primary));
          break;
        }
        node = node.parentElement;
      }
    }
    return result;
  }

  function restore(element, previous) {
    if (element.style.getPropertyValue('display') !== 'none' || element.style.getPropertyPriority('display') !== 'important') return;
    if (previous.display) element.style.setProperty('display', previous.display, previous.priority);
    else element.style.removeProperty('display');
  }

  function sync(enabled) {
    const desired = enabled ? targets() : new Set();
    for (const [element, previous] of hidden) {
      if (!element.isConnected || !desired.has(element)) {
        restore(element, previous);
        hidden.delete(element);
      }
    }
    for (const element of desired) {
      if (!hidden.has(element)) hidden.set(element, {
        display: element.style.getPropertyValue('display'), priority: element.style.getPropertyPriority('display'),
      });
      if (element.style.getPropertyValue('display') !== 'none' || element.style.getPropertyPriority('display') !== 'important') {
        element.style.setProperty('display', 'none', 'important');
      }
    }
  }
  return {sync};
})();
