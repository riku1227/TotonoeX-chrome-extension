import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';

const icons=JSON.parse(await readFile(new URL('./fixtures/x-icons.json',import.meta.url),'utf8'));
const icon=kind=>`<svg viewBox="${icons[kind].viewBox}">${icons[kind].paths.map(d=>`<path d="${d}"/>`).join('')}</svg>`;
const fixture=`<!doctype html><meta charset="utf-8"><header><a id="grok-nav" href="/i/grok">Grok</a></header>
<button id="grok-drawer" data-testid="GrokDrawerHeader" aria-label="Grok">Grok</button>
<button id="generate" data-testid="grokImgGen" aria-label="画像を生成">画像を生成</button>
<article data-testid="tweet" id="tweet"><div id="header"><button id="explain" aria-label="Grokのアクション" style="display:inline-flex!important">${icon('grok')}</button><button id="more" data-testid="caret" aria-label="もっと見る">...</button></div>
<div data-testid="tweetText" id="text">このポストを説明する、画像を編集、という語を含む投稿本文<button id="body-grok">${icon('grok')}</button><a id="body-edit" href="/i/grok">${icon('edit')}</a></div>
<button id="like" data-testid="like">いいね</button>
<div role="link" id="photo-link" tabindex="0"><div data-testid="tweetPhoto" id="photo" style="width:120px;height:100px"><img alt="画像" width="100" height="80"><button id="edit" aria-label="画像を編集">${icon('edit')}画像を編集</button><a id="edit-link" role="link" aria-label="画像を編集" href="/i/grok">${icon('edit')}画像を編集</a></div></div>
</article>
<div role="dialog" id="viewer"><div data-testid="swipe-to-dismiss"><div data-testid="tweetPhoto"><img alt="画像"></div><button id="viewer-edit" aria-label="画像を編集">${icon('edit')}画像を編集</button><button id="close-viewer">閉じる</button></div></div>
<div role="dialog" id="composer"><div data-testid="tweetTextarea_0" contenteditable="true">投稿内容</div><div data-testid="tweetPhoto"><img alt="添付画像"></div><button id="compose-edit" aria-label="画像を編集">${icon('edit')}画像を編集</button></div>
<button id="profile-edit" aria-label="プロフィールを編集">プロフィールを編集</button>
<button id="unknown-edit" aria-label="画像を編集">${icon('edit')}画像を編集</button>
<script>window.clicked=0;document.addEventListener('click',()=>window.clicked++);</script>`;

test('投稿説明と画像編集の入口を個別に隠す', {timeout:120000}, async t=>{
 const profile=await mkdtemp(path.join(tmpdir(),'x-post-tools-test-'));
 const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,
  args:['--lang=ja',`--disable-extensions-except=${path.resolve('extension')}`,`--load-extension=${path.resolve('extension')}`]});
 await context.route('https://x.com/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:fixture}));
 const page=await context.newPage();await page.goto('https://x.com/home');
 const cdp=await context.newCDPSession(page),contexts=[];
 cdp.on('Runtime.executionContextCreated',({context:c})=>contexts.push(c));await cdp.send('Runtime.enable');
 const origin=contexts.find(c=>c.origin.startsWith('chrome-extension://')).origin;
 const popup=await context.newPage();await popup.goto(origin+'/popup.html');
 const prefs=v=>popup.evaluate(v=>chrome.storage.local.set(v),v);
 const hidden=id=>page.locator('#'+id).waitFor({state:'hidden',timeout:2500});
 try{
  await t.test('投稿の説明ボタンと画像の編集ボタンだけを隠す',async()=>{
   await hidden('explain');await hidden('edit');await hidden('edit-link');
   for(const id of ['grok-nav','grok-drawer','generate','more','text','like','photo','compose-edit','profile-edit','unknown-edit'])assert.equal(await page.locator('#'+id).isVisible(),true,id);
   assert.equal(await page.evaluate(()=>window.clicked),0);
  });
  await t.test('編集ボタンを含む画像リンク全体は隠さない',async()=>{
   assert.equal(await page.locator('#photo-link').isVisible(),true);
   await hidden('edit');await hidden('edit-link');
  });
  await t.test('ラベルを全て取り除いても対象だけを識別する',async()=>{
   await page.locator('[aria-label]').evaluateAll(elements=>elements.forEach(e=>{e.removeAttribute('aria-label');e.setAttribute('title','Unbekannte Aktion');}));
   await hidden('explain');await hidden('edit');await hidden('edit-link');
   for(const id of ['grok-nav','grok-drawer','generate','more','text','like','photo','compose-edit','profile-edit','unknown-edit'])assert.equal(await page.locator('#'+id).isVisible(),true,id);
  });
  await t.test('同じ図柄でも投稿本文中や曖昧なヘッダーの操作は隠さない',async()=>{
   for(const id of ['body-grok','body-edit'])assert.equal(await page.locator('#'+id).isVisible(),true,id);
   await page.locator('#header').evaluate(e=>e.append(document.createElement('button')));
   await page.locator('#explain').waitFor({state:'visible'});
   await page.locator('#header button').last().evaluate(e=>e.remove());await hidden('explain');
  });
  await t.test('2つの非表示機能を独立して解除・再適用',async()=>{
   await prefs({hideGrokExplain:false});await page.locator('#explain').waitFor({state:'visible'});await hidden('edit');
   assert.equal(await page.locator('#explain').evaluate(e=>e.style.getPropertyValue('display')),'inline-flex');
   assert.equal(await page.locator('#explain').evaluate(e=>e.style.getPropertyPriority('display')),'important');
   await prefs({hideImageEdit:false});await page.locator('#edit').waitFor({state:'visible'});
   await prefs({hideGrokExplain:true,hideImageEdit:true});await hidden('explain');await hidden('edit');
  });
  await t.test('ホバーで遅れて追加された編集ボタンを隠す',async()=>{
   await page.locator('#edit').evaluate(e=>e.remove());
   await page.locator('#photo').evaluate((photo,html)=>photo.addEventListener('pointerenter',()=>{
    const b=document.createElement('button');b.id='late-edit';b.innerHTML=html+'画像を編集';photo.append(b);
   },{once:true}),icon('edit'));
   await page.locator('#photo').hover();await hidden('late-edit');
  });
  await t.test('同じボタンが別機能に再利用されたら表示を復元',async()=>{
   await page.locator('#explain').evaluate(e=>{e.setAttribute('aria-label','Grokのアクション');e.querySelector('svg').remove();});
   await page.locator('#explain').waitFor({state:'visible'});
   await page.locator('#late-edit').evaluate(e=>{e.innerHTML='画像を編集';});await page.locator('#late-edit').waitFor({state:'visible'});
  });
  await t.test('画像ビューアーの編集だけを隠し、投稿作成の編集は残す',async()=>{
   await page.goto('https://x.com/alice/status/123/photo/1');await hidden('viewer-edit');
   assert.equal(await page.locator('#compose-edit').isVisible(),true);assert.equal(await page.locator('#close-viewer').isVisible(),true);
  });
  await t.test('ポップアップの個別設定を保存し再読込後も維持',async()=>{
   await popup.reload();
   const explain=popup.getByRole('checkbox',{name:/ポストのGrokボタンを隠す/});
   await explain.waitFor({timeout:2500});await explain.click();
   await popup.waitForFunction(async()=> (await chrome.storage.local.get('hideGrokExplain')).hideGrokExplain===false);
   assert.equal(await popup.getByRole('checkbox',{name:/画像の編集ボタンを隠す/}).getAttribute('aria-checked'),'true');
   await popup.reload();
   assert.equal(await popup.getByRole('checkbox',{name:/ポストのGrokボタンを隠す/}).getAttribute('aria-checked'),'false');
  });
 }finally{await cdp.detach();await context.close();await rm(profile,{recursive:true,force:true});}
});
