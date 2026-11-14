import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

// 壊してはいけない境界：引用の誤選択、React相当のcapture処理、
// DOM再利用、遅延描画、コピー失敗、SPA離脱時の復元を実ブラウザで検査する。
const article = (href = '/alice/status/123?s=20#fragment', extra = '') => `
<article data-testid="tweet">
  <div data-testid="User-Name"><a href="${href}"><time>1h</time></a></div>
  <a href="/alice/status/123/photo/1">photo</a>
  ${extra}
  <div role="group">
    <button data-testid="reply">reply</button>
    <button data-testid="retweet" aria-haspopup="menu">repost</button>
    <a href="/alice/status/123/analytics">analytics</a>
    <div><div><button aria-label="ポストを共有" aria-haspopup="menu">share</button></div></div>
  </div>
</article>`;

const fixture = (body) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"></head>
<body><div id="react-root">${body}<button id="ordinary">ordinary</button></div>
<script>
window.pageEvents = {click:0,pointerdown:0,keydown:0,share:0};
for (const type of ['click','pointerdown','keydown']) {
  document.querySelector('#react-root').addEventListener(type,()=>window.pageEvents[type]++,true);
}
document.querySelectorAll('button[aria-label="ポストを共有"]').forEach(b=>{
  b.addEventListener('click',()=>{window.pageEvents.share++;fetch('/standard-share');});
});
</script></body></html>`;

test('実MV3拡張：直接コピーとX側操作の分離', { timeout: 120000 }, async (t) => {
  const profile = await mkdtemp(path.join(tmpdir(), 'x-copy-test-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, hasTouch: true,
    args: ['--lang=ja',`--disable-extensions-except=${path.resolve('extension')}`, `--load-extension=${path.resolve('extension')}`],
  });
  await context.grantPermissions(['clipboard-read'], { origin: 'https://x.com' });
  const activePages = [];
  let unexpectedRequests = 0;
  const open = async (body = article()) => {
    const page = await context.newPage(); activePages.push(page);
    await page.route('https://x.com/**', route => {
      if (new URL(route.request().url()).pathname !== '/home') unexpectedRequests++;
      return route.fulfill({contentType:'text/html; charset=utf-8', body:fixture(body)});
    });
    await page.goto('https://x.com/home');
    return page;
  };
  const ready = async (page, count = 1) => {
    await page.waitForFunction(n => document.querySelectorAll('[data-x-direct-copy]').length === n, count, {timeout:3000});
  };
  const copyButton = page => page.getByRole('button', {name:'投稿URLをコピー', exact:true});
  const clipboard = page => page.evaluate(() => navigator.clipboard.readText());
  const noPageEvents = async page => assert.deepEqual(await page.evaluate(()=>window.pageEvents), {click:0,pointerdown:0,keydown:0,share:0});
  try {
    await t.test('引用・写真・analyticsを避け、クエリなしの外側投稿URLをコピー', async () => {
      const page = await open(article(undefined, '<div role="link"><div data-testid="User-Name"><a href="/quoted/status/999"><time>2h</time></a></div></div>'));
      await ready(page);
      await copyButton(page).click();
      await page.getByRole('button',{name:'コピーしました',exact:true}).waitFor();
      assert.equal(await clipboard(page), 'https://x.com/alice/status/123');
      await noPageEvents(page);
      assert.equal(new URL(page.url()).pathname,'/home');
      await page.locator('#ordinary').click();
      assert.equal(await page.evaluate(()=>window.pageEvents.click),1);
      await page.close();
    });
    await t.test('共有の表示文言・aria-labelを変えても操作欄から識別する',async()=>{
      for(const label of ['Partager le post','مشاركة المنشور','']){
        const page=await open(article().replace('aria-label="ポストを共有"',label?`aria-label="${label}"`:'').replace('>share<','>任意の表示<'));
        await ready(page);await copyButton(page).click();
        await page.getByRole('button',{name:'コピーしました',exact:true}).waitFor();
        assert.equal(await clipboard(page),'https://x.com/alice/status/123');await noPageEvents(page);await page.close();
      }
    });
    await t.test('キーボードのEnterとSpaceでコピーし、X側へ伝播しない', async () => {
      const page=await open(); await ready(page);
      for (const key of ['Enter','Space']) {
        const button=page.locator('[data-x-direct-copy]').getByRole('button');
        await button.focus(); await button.press(key);
        assert.equal(await clipboard(page),'https://x.com/alice/status/123');
      }
      await noPageEvents(page); await page.close();
    });
    await t.test('タッチ操作でも直接コピーする', async () => {
      const page=await open(); await ready(page);
      await copyButton(page).tap();
      await page.getByRole('button',{name:'コピーしました',exact:true}).waitFor();
      assert.equal(await clipboard(page),'https://x.com/alice/status/123');
      await noPageEvents(page); await page.close();
    });
    await t.test('DOM再利用後の新しいURLを押した時点で読む', async () => {
      const page=await open(); await ready(page);
      await page.locator('[data-testid="User-Name"] a').evaluate(a=>a.href='/bob/status/456?tracking=1');
      await copyButton(page).click();
      await page.getByRole('button',{name:'コピーしました',exact:true}).waitFor();
      assert.equal(await clipboard(page),'https://x.com/bob/status/456');
      await page.close();
    });
    await t.test('遅延追加と再描画で二重ボタンを作らない', async () => {
      const page=await open(); await ready(page);
      await page.locator('#react-root').evaluate((root,html)=>root.insertAdjacentHTML('afterbegin',html),article('/new/status/456'));
      await ready(page,2);
      await page.locator('article').first().evaluate((a,html)=>a.outerHTML=html,article('/newer/status/789'));
      await page.waitForFunction(()=>!!document.querySelector('a[href="/newer/status/789"]')?.closest('article').querySelector('[data-x-direct-copy]'));
      assert.equal(await page.locator('[data-x-direct-copy]').count(),2);
      await page.close();
    });
    await t.test('外部URL・曖昧なヘッダー・複数の候補では元ボタンを残す', async () => {
      const body=article('https://evil.example/alice/status/123')+
        article().replace('</time></a></div>','</time></a><a href="/other/status/222"><time>2h</time></a></div>')+
        article().replace('ポストを共有','Unknown share').replace('>share</button>', '>share</button><button aria-haspopup="menu">Other menu</button>');
      const page=await open(body);
      await page.waitForTimeout(100);
      assert.equal(await page.locator('[data-x-direct-copy]').count(),0);
      assert.equal(await page.locator('button[aria-haspopup="menu"]:visible').count(),7);
      await page.close();
    });
    await t.test('URLが不正になった時は元共有ボタンを復元する', async () => {
      const page=await open(); await ready(page);
      await page.locator('[data-testid="User-Name"] a').evaluate(a=>a.href='https://evil.example/a/status/5');
      await ready(page,0);
      assert.equal(await page.locator('button[aria-label="ポストを共有"]').isVisible(),true);
      await page.close();
    });
    await t.test('SPAでホームを離れると復元し、戻ると再度置換する', async () => {
      const page=await open(); await ready(page);
      await page.evaluate(()=>{history.pushState({},'', '/notifications');document.body.append(document.createElement('div'));});
      await ready(page,0);
      assert.equal(await page.locator('button[aria-label="ポストを共有"]').isVisible(),true);
      await page.evaluate(()=>{history.pushState({},'', '/home');document.body.append(document.createElement('div'));});
      await ready(page); await page.close();
    });
    await t.test('ページJSの合成クリックやキー入力でクリップボードを変更しない', async () => {
      const page=await open(); await ready(page);
      await copyButton(page).click();
      await page.getByRole('button',{name:'コピーしました',exact:true}).waitFor();
      await page.evaluate(()=>{
        document.querySelector('[data-testid="User-Name"] a').href='/bob/status/456';
        const button=document.querySelector('[data-x-direct-copy]').shadowRoot.querySelector('button');
        button.click();
        button.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true}));
      });
      await page.waitForTimeout(100);
      assert.equal(await clipboard(page),'https://x.com/alice/status/123');
      await noPageEvents(page); await page.close();
    });
    await t.test('クリップボードが使えない場合は失敗を表示する', async () => {
      const page=await open(); await ready(page);
      const cdp=await context.newCDPSession(page);
      // clipboardWrite権限はページ側の拒否より強いため、OS失敗のみ境界で注入する。
      // 成功経路は他のテストで実際のOSクリップボードを読み戻している。
      const contexts=[];
      cdp.on('Runtime.executionContextCreated',({context})=>contexts.push(context));
      await cdp.send('Runtime.enable');
      const isolated=contexts.find(c=>c.origin.startsWith('chrome-extension://'));
      assert.ok(isolated,JSON.stringify(contexts));
      await cdp.send('Runtime.evaluate',{contextId:isolated.id,expression:
        'navigator.clipboard.writeText = () => Promise.reject(new DOMException("OS clipboard unavailable", "NotAllowedError"))'});
      await copyButton(page).click();
      await page.getByRole('button',{name:'コピーできませんでした。もう一度お試しください',exact:true}).waitFor({timeout:3000});
      await noPageEvents(page);
      await cdp.detach(); await page.close();
    });
    assert.equal(unexpectedRequests,0,'コピーのために追加通信していない');
  } finally {
    await context.close();
    await rm(profile,{recursive:true,force:true});
  }
});
