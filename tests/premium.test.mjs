import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';

const icons=JSON.parse(await readFile(new URL('./fixtures/x-icons.json',import.meta.url),'utf8'));
const closeSvg=`<svg viewBox="${icons.close.viewBox}"><path d="${icons.close.paths[0]}"/></svg>`;
const signup='<a href="/i/premium_sign_up">認証を受ける</a>';
const ownCard=`<div id="own-wrapper"><div id="own-card" style="display:flex"><button aria-label="閉じる">${closeSvg}</button><div><div><span>まだ認証されていません</span></div><div>プロフィールをアップグレードしましょう</div>${signup}</div></div></div>`;
const visitorCard=`<div id="visitor-card" data-testid="verified_profile_visitor_upsell"><button aria-label="閉じる">${closeSvg}</button><div><div>@viewerさんは、まだ認証されていません</div><div>認証を受けて注目を集めましょう</div>${signup}</div></div>`;
const fixture=`<!doctype html><meta charset="utf-8"><header><nav>
<a id="premium-nav" data-testid="premium-signup-tab" href="/i/premium_sign_up" style="display:inline-flex!important">プレミアム</a>
<a id="settings" href="/settings">設定</a></nav></header>
<div data-testid="sidebarColumn"><div id="subscribe-wrapper"><aside id="subscribe" aria-label="プレミアムにサブスクライブ"><span>プレミアムにサブスクライブ</span>${signup}</aside></div>
<aside id="trends" aria-label="トレンド">トレンド</aside></div>
<main data-testid="primaryColumn"><div data-testid="UserName"><span>プロフィール名</span><svg data-testid="icon-verified"></svg></div>
<a id="followers" href="/alice/verified_followers">フォロワー</a>
<div data-testid="UserDescription" id="bio">まだ認証されていません。プレミアムについての自己紹介です。${signup}</div>
${ownCard}${visitorCard}
<section id="posts"><article data-testid="tweet" id="tweet"><span>まだ認証されていません。プレミアムの話題です。</span>${signup}
<a data-testid="premium-signup-tab" href="/i/premium_sign_up">投稿内のリンク</a></article></section>
<div id="unrelated">まだ認証されていません、という文章だけの通常コンテンツ</div>
<aside id="unknown-promo" aria-label="不明な案内">知らない案内${signup}</aside>
</main><script>window.clicked=0;document.addEventListener('click',()=>window.clicked++);window.documentToken=crypto.randomUUID();</script>`;

test('プレミアム加入案内だけを非表示・復元', {timeout:120000},async t=>{
  const profile=await mkdtemp(path.join(tmpdir(),'x-premium-test-'));
  const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,
    args:['--lang=ja',`--disable-extensions-except=${path.resolve('extension')}`,`--load-extension=${path.resolve('extension')}`]});
  await context.route('https://x.com/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:fixture}));
  const page=await context.newPage();await page.goto('https://x.com/alice');
  const cdp=await context.newCDPSession(page),contexts=[];
  cdp.on('Runtime.executionContextCreated',({context:c})=>contexts.push(c));await cdp.send('Runtime.enable');
  const origin=contexts.find(c=>c.origin.startsWith('chrome-extension://')).origin;
  const popup=await context.newPage();await popup.goto(origin+'/popup.html');
  const prefs=v=>popup.evaluate(v=>chrome.storage.local.set(v),v);
  const hidden=async id=>page.locator('#'+id).waitFor({state:'hidden',timeout:3000});
  try{
    await t.test('指定の4種類を初期設定で隠し、親の余白も残さない',async()=>{
      for(const id of ['premium-nav','subscribe','own-card','visitor-card'])await hidden(id);
      assert.equal(await page.locator('#own-wrapper').isVisible(),false);
      assert.equal(await page.locator('#subscribe-wrapper').isVisible(),false);
      assert.equal(await page.evaluate(()=>window.clicked),0);
    });
    await t.test('プロフィール情報・バッジ・本文・未知のカードは残す',async()=>{
      for(const id of ['settings','trends','followers','bio','posts','tweet','unrelated','unknown-promo']) {
        assert.equal(await page.locator('#'+id).isVisible(),true,id);
      }
      assert.equal(await page.locator('[data-testid="icon-verified"]').count(),1);
      assert.equal(await page.locator('#tweet a[data-testid="premium-signup-tab"]').isVisible(),true);
    });
    await t.test('案内文・ラベルを翻訳しても加入先と構造で識別する',async()=>{
      await page.locator('[aria-label]').evaluateAll(es=>es.forEach(e=>e.setAttribute('aria-label','Unknown')));
      await page.locator('main, [data-testid="sidebarColumn"]').evaluateAll(es=>es.forEach(e=>{const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);while(walker.nextNode())if(walker.currentNode.textContent.trim())walker.currentNode.textContent='Texte traduit';}));
      for(const id of ['premium-nav','subscribe','own-card','visitor-card'])await hidden(id);
      for(const id of ['settings','trends','followers','bio','posts','tweet','unrelated','unknown-promo'])assert.equal(await page.locator('#'+id).isVisible(),true,id);
    });
    await t.test('オフで即座に元の表示を復元し、既存inline styleを保持',async()=>{
      await prefs({hidePremium:false});
      await page.locator('#premium-nav').waitFor({state:'visible'});
      for(const id of ['subscribe','own-card','visitor-card'])assert.equal(await page.locator('#'+id).isVisible(),true);
      assert.equal(await page.locator('#premium-nav').evaluate(e=>e.style.getPropertyValue('display')),'inline-flex');
      assert.equal(await page.locator('#premium-nav').evaluate(e=>e.style.getPropertyPriority('display')),'important');
      assert.equal(await page.locator('#own-card').evaluate(e=>e.style.getPropertyValue('display')),'flex');
      await prefs({hidePremium:true});await hidden('own-card');
    });
    await t.test('再描画された案内・遅れて追加された案内も隠す',async()=>{
      await page.locator('#visitor-card').evaluate((e,html)=>e.outerHTML=html,visitorCard);
      await hidden('visitor-card');
      await page.locator('#own-wrapper').evaluate(e=>e.remove());
      await page.locator('main').evaluate((e,html)=>e.insertAdjacentHTML('beforeend',html),ownCard);
      await hidden('own-wrapper');
    });
    await t.test('隠したコンテナが通常内容に再利用された場合は表示を戻す',async()=>{
      await page.locator('#own-card').evaluate(e=>e.innerHTML='<span>通常のプロフィール情報</span>');
      await page.locator('#own-card').waitFor({state:'visible'});
      assert.equal(await page.locator('#own-wrapper').isVisible(),true);
    });
    await t.test('設定を再読込後も保持し、他の2機能と独立して変更',async()=>{
      await prefs({hidePremium:false,directCopy:false,imagesFirst:true});await popup.reload();
      const toggle=popup.getByRole('checkbox',{name:/プレミアムの案内を隠す/});
      await toggle.waitFor({timeout:3000});assert.equal(await toggle.getAttribute('aria-checked'),'false');
      await toggle.click();await hidden('premium-nav');
      const values=await popup.evaluate(()=>chrome.storage.local.get(['hidePremium','directCopy','imagesFirst']));
      assert.deepEqual(values,{hidePremium:true,directCopy:false,imagesFirst:true});
      await page.reload();await hidden('visitor-card');
    });
    await t.test('プロフィール以外の本文カードを非表示にしない',async()=>{
      await page.goto('https://x.com/search?q=premium');
      await hidden('premium-nav');
      assert.equal(await page.locator('#own-card').isVisible(),true);
      assert.equal(await page.locator('#visitor-card').isVisible(),true);
    });
  }finally{await cdp.detach();await context.close();await rm(profile,{recursive:true,force:true});}
});
