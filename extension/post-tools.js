// 投稿のGrok説明と画像編集の入口だけを隠す。Grok本体や投稿作成画面は対象外。
const xTweakPostUI = (() => {
  'use strict';
  const hidden = new Map();
  const composer = '[data-testid^="tweetTextarea_"], [contenteditable="true"], input[type="file"]';

  function isComposer(element) {
    if (element.closest('form, [data-testid="GrokDrawer"]')) return true;
    const dialog = element.closest('[role="dialog"], dialog');
    return !!dialog?.querySelector(composer);
  }

  function imageContext(element) {
    if (isComposer(element)) return false;
    const article = element.closest('article[data-testid="tweet"]');
    if (article) {
      for (let node = element; node && node !== article; node = node.parentElement) {
        if (node.matches('[data-testid="tweetText"], [role="group"], [data-testid="User-Name"]') ||
          node.querySelector('[data-testid="tweetText"], [role="group"], [data-testid="User-Name"]')) return false;
        if (node.matches('[data-testid="tweetPhoto"]') || node.querySelector('[data-testid="tweetPhoto"]')) return true;
      }
      return false;
    }
    if (!/\/status\/\d+\/photo\/\d+\/?$/.test(location.pathname)) return false;
    const viewer = element.closest('[data-testid="swipe-to-dismiss"], [role="dialog"], dialog');
    return !!viewer?.querySelector('[data-testid="tweetPhoto"]') && !viewer.querySelector(composer);
  }

  function postHeader(element) {
    const article = element.closest('article[data-testid="tweet"]');
    if (!article || isComposer(element)) return false;
    for (let node = element.parentElement; node && node !== article; node = node.parentElement) {
      if (node.matches('[data-testid="tweetText"], [data-testid="tweetPhoto"], [role="group"]') ||
        node.querySelector('[data-testid="tweetText"], [data-testid="tweetPhoto"], [role="group"]')) return false;
      const carets = node.querySelectorAll('[data-testid="caret"]');
      if (carets.length) return carets.length === 1 && node.querySelectorAll('button, [role="button"]').length === 2;
    }
    return false;
  }

  function targets(settings) {
    const desired = new Set();
    if (!settings.hideGrokExplain && !settings.hideImageEdit) return desired;
    for (const element of document.querySelectorAll('button, [role="button"], a[href], [role="link"]')) {
      if (settings.hideGrokExplain && xTweakDomSignals.icon(element, 'grok') && postHeader(element)) desired.add(element);
      if (!settings.hideImageEdit) continue;
      if (xTweakDomSignals.icon(element, 'edit') && imageContext(element)) desired.add(element);
    }
    return desired;
  }

  function restore(element, previous) {
    if (element.style.getPropertyValue('display') !== 'none' || element.style.getPropertyPriority('display') !== 'important') return;
    if (previous.display) element.style.setProperty('display', previous.display, previous.priority);
    else element.style.removeProperty('display');
  }

  function sync(settings) {
    const desired = targets(settings);
    for (const [element, previous] of hidden) {
      if (!element.isConnected || !desired.has(element)) {
        restore(element, previous);
        hidden.delete(element);
      }
    }
    for (const element of desired) {
      if (!hidden.has(element)) hidden.set(element, {display:element.style.getPropertyValue('display'),priority:element.style.getPropertyPriority('display')});
      if (element.style.getPropertyValue('display') !== 'none' || element.style.getPropertyPriority('display') !== 'important') element.style.setProperty('display','none','important');
    }
  }
  return {sync};
})();
