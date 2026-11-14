import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';

const icons=JSON.parse(await readFile(new URL('./fixtures/x-icons.json',import.meta.url),'utf8'));
const checkSvg=`<svg viewBox="${icons.check.viewBox}"><path d="${icons.check.paths[0]}"/></svg>`;
const home=`<!doctype html><meta charset="utf-8"><article data-testid="tweet">
<div data-testid="User-Name"><a href="/alice/status/123"><time>1h</time></a></div>
<div role="group"><button data-testid="reply">reply</button><button data-testid="retweet">repost</button>
<button aria-label="ポストを共有" aria-haspopup="menu">share</button></div></article>`;

// 実Xで観測したタブとメニューの契約。画像選択はSPAの履歴変更であり、文書を再取得しない。
const mediaFixture=home+`<div id="media-ui"></div><button id="ordinary">ordinary</button><script>
window.documentToken=crypto.randomUUID();window.imageSelections=0;window.visibleMenuFrames=0;
function countMenuFrames(){const menu=document.querySelector('[role="menu"]');if(menu&&getComputedStyle(menu).visibility!=='hidden')window.visibleMenuFrames++;requestAnimationFrame(countMenuFrames);}
requestAnimationFrame(countMenuFrames);
function renderMedia(){
 const root=document.getElementById('media-ui');root.replaceChildren();
 if(!/^\\/[a-z_]+\\/media$/.test(location.pathname))return;
 const tab=document.createElement('a');tab.href=location.pathname;
 tab.setAttribute('role','tab');tab.setAttribute('aria-selected','true');tab.setAttribute('aria-haspopup','menu');tab.setAttribute('aria-expanded','false');
 tab.textContent=new URL(location.href).searchParams.get('filter')==='photo'?'画像':'動画';
 if(new URL(location.href).searchParams.has('foreign'))tab.textContent='不明な言語';
 tab.onclick=e=>{
  e.preventDefault();
  if(tab.getAttribute('aria-expanded')==='true'){root.querySelector('[role="menu"]')?.remove();tab.setAttribute('aria-expanded','false');return;}
  const menu=document.createElement('div');menu.setAttribute('role','menu');
  for(const label of (new URL(location.href).searchParams.has('reverse')?['画像','動画']:['動画','画像'])){
   const item=document.createElement('div');item.setAttribute('role','menuitem');item.tabIndex=0;item.textContent=new URL(location.href).searchParams.has('foreign')?'表示名に依存しない':label;if((new URL(location.href).searchParams.get('filter')==='photo'?'画像':'動画')===label)item.insertAdjacentHTML('beforeend',${JSON.stringify(checkSvg)});
   if(new URL(location.href).searchParams.has('nocheck'))item.querySelector('svg')?.remove();
   item.onclick=()=>{const url=new URL(location.href);if(label==='画像'){url.searchParams.set('filter','photo');window.imageSelections++;}else url.searchParams.delete('filter');history.replaceState({},'',url.href);renderMedia();};
   menu.append(item);
  }
  if(new URL(location.href).searchParams.has('extra')){const item=document.createElement('div');item.setAttribute('role','menuitem');item.textContent='Unknown option';menu.append(item);}
  tab.setAttribute('aria-expanded','true');
  if(new URL(location.href).searchParams.has('slowmenu'))window.releaseMediaMenu=()=>{if(tab.isConnected&&tab.getAttribute('aria-expanded')==='true')root.append(menu);};else root.append(menu);
 };
 if(new URL(location.href).searchParams.has('unready'))tab.onclick=null;
 root.append(tab);
}
window.navigation.addEventListener('currententrychange',renderMedia);
if(new URL(location.href).searchParams.has('delay'))setTimeout(renderMedia,100);else renderMedia();
</script>`;

test('設定と画像の初期選択', {timeout:120000}, async t=>{
  const profile=await mkdtemp(path.join(tmpdir(),'x-settings-test-'));
  const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,
    args:['--lang=ja',`--disable-extensions-except=${path.resolve('extension')}`,`--load-extension=${path.resolve('extension')}`]});
  await context.route('https://x.com/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:mediaFixture}));
  const page=await context.newPage();
  let documents=0;
  page.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===page.mainFrame())documents++;});
  await page.goto('https://x.com/home');
  const cdp=await context.newCDPSession(page),contexts=[];
  cdp.on('Runtime.executionContextCreated',({context:c})=>contexts.push(c));await cdp.send('Runtime.enable');
  const origin=contexts.find(c=>c.origin.startsWith('chrome-extension://')).origin;
  const popup=await context.newPage();await popup.goto(origin+'/popup.html');
  const prefs=async values=>popup.evaluate(v=>chrome.storage.local.set(v),values);
  const hosts=async n=>page.waitForFunction(n=>document.querySelectorAll('[data-x-direct-copy]').length===n,n,{timeout:3000});
  try {
    await t.test('コピー設定の変更を開いたXへ即反映し、再読込しても維持',async()=>{
      await prefs({directCopy:false,imagesFirst:false});await hosts(0);
      assert.equal(await page.locator('button[aria-label="ポストを共有"]').isVisible(),true);
      await page.reload();await page.waitForTimeout(100);
      assert.equal(await page.locator('[data-x-direct-copy]').count(),0);
      await prefs({directCopy:true});await hosts(1);
    });
    await t.test('文書を再取得せずに画像へ切り替え、クエリとハッシュを保持',async()=>{
      await prefs({imagesFirst:true});
      const before=documents;
      await page.goto('https://x.com/alice/media?lang=ja#top');
      await page.waitForURL('**/media?lang=ja&filter=photo#top',{timeout:3000});
      assert.equal(documents-before,1,'最初の読み込み以外に文書の再取得がない');
      assert.equal(await page.evaluate(()=>window.imageSelections),1,'X相当の画像選択を経由');
      assert.equal(await page.evaluate(()=>window.visibleMenuFrames),0,'自動メニューを描画する前に選択');
    });
    await t.test('項目名と並び順を変えてもチェック状態から画像を選ぶ',async()=>{
      await prefs({imagesFirst:true});const before=documents;
      await page.goto('https://x.com/alice/media?foreign=1&reverse=1');
      await page.waitForURL('**/media?foreign=1&reverse=1&filter=photo',{timeout:3000});
      assert.equal(documents-before,1);assert.equal(await page.evaluate(()=>window.imageSelections),1);
    });
    await t.test('チェックがないメニューや項目が増えたメニューは自動操作しない',async()=>{
      for(const query of ['nocheck=1','extra=1']){
        await page.goto('https://x.com/alice/media?'+query);await page.waitForTimeout(180);
        assert.equal(await page.evaluate(()=>window.imageSelections),0);
        assert.equal(new URL(page.url()).search,'?'+query);
      }
    });
    await t.test('自分で動画に戻した後は画像へ強制し直さない',async()=>{
      await page.goto('https://x.com/alice/media?filter=photo');
      await page.getByRole('tab').click();
      await page.getByRole('menuitem',{name:'動画',exact:true}).click();
      await page.waitForTimeout(120);
      assert.equal(new URL(page.url()).search,'');
    });
    await t.test('SPAで別プロフィールのメディアへ入ると画像を選ぶ',async()=>{
      const before=documents,token=await page.evaluate(()=>window.documentToken);
      await page.evaluate(()=>history.pushState({},'', '/bob/media'));
      await page.waitForURL('**/bob/media?filter=photo',{timeout:3000});
      assert.equal(documents,before);assert.equal(await page.evaluate(()=>window.documentToken),token);
    });
    await t.test('オフなら動画表示を維持し、オンへ変更した時だけ現在の画面へ適用',async()=>{
      await prefs({imagesFirst:false});
      await page.goto('https://x.com/alice/media');await page.waitForTimeout(120);
      assert.equal(new URL(page.url()).search,'');
      await prefs({imagesFirst:true});await page.waitForURL('**/alice/media?filter=photo',{timeout:3000});
      await prefs({imagesFirst:false});await page.waitForTimeout(100);
      assert.equal(new URL(page.url()).search,'?filter=photo');
    });
    await t.test('明示フィルタ・検索・予約済み画面を画像へ変更しない',async()=>{
      await prefs({imagesFirst:true});
      for(const p of ['/alice/media?filter=video','/search?q=media','/i/media','/settings/media']) {
        await page.goto('https://x.com'+p);await page.waitForTimeout(80);
        assert.equal(page.url(),'https://x.com'+p);
      }
    });
    await t.test('ポップアップの2つの設定を別々に保存し、閉じても保持',async()=>{
      await prefs({directCopy:true,imagesFirst:true});
      await popup.reload();
      const copy=popup.getByRole('checkbox',{name:/共有をURLコピーに/});
      const images=popup.getByRole('checkbox',{name:/メディアの既定を画像に/});
      await copy.waitFor({timeout:3000});await copy.click();
      await popup.waitForFunction(async()=> (await chrome.storage.local.get('directCopy')).directCopy===false);
      assert.equal(await images.getAttribute('aria-checked'),'true');
      await popup.reload();assert.equal(await popup.getByRole('checkbox',{name:/共有をURLコピーに/}).getAttribute('aria-checked'),'false');
      assert.match(await copy.textContent(),/ホームの共有ボタンをURLを直接コピーするボタンに差し替えます。/);
      assert.match(await images.textContent(),/メディアタブを開いた時デフォルトで画像が選択されるようになります。/);
      assert.equal(await popup.getByRole('button',{name:'使い方',exact:true}).count(),0);
    });
    await t.test('3カテゴリを見出しで区切り、5設定を同じ一覧で保存できる',async()=>{
      await prefs({directCopy:false,imagesFirst:true,hideGrokExplain:true,hideImageEdit:true,hidePremium:false});
      await popup.reload();
      await popup.getByRole('checkbox').first().waitFor();
      assert.equal(await popup.getByRole('tab').count(),0);
      assert.deepEqual(await popup.getByRole('heading',{level:2}).allTextContents(),['基本','Grok','プレミアム']);
      assert.equal(await popup.getByRole('checkbox').count(),5);
      const image=popup.getByRole('checkbox',{name:/画像の編集ボタンを隠す/});
      await image.click();await popup.waitForFunction(async()=> (await chrome.storage.local.get('hideImageEdit')).hideImageEdit===false);
      assert.equal(await popup.getByRole('checkbox',{name:/プレミアムの案内を隠す/}).getAttribute('aria-checked'),'false');
      assert.equal(await popup.getByRole('checkbox',{name:/共有をURLコピーに/}).getAttribute('aria-checked'),'false');
      assert.equal(await image.getAttribute('aria-checked'),'false');
      await popup.reload();assert.equal(await image.getAttribute('aria-checked'),'false');
      assert.deepEqual(await popup.evaluate(()=>chrome.storage.local.get(null)),{directCopy:false,imagesFirst:true,hideGrokExplain:true,hideImageEdit:false,hidePremium:false});
    });
    await t.test('タブが遅れて描画されてもリロードせず一度だけ選ぶ',async()=>{
      await prefs({imagesFirst:true});const before=documents;
      await page.goto('https://x.com/alice/media?delay=1');
      await page.waitForURL('**/media?delay=1&filter=photo',{timeout:3000});
      assert.equal(documents-before,1);assert.equal(await page.evaluate(()=>window.imageSelections),1);
    });
    await t.test('Xのクリック処理が未準備でもリンクの通常遷移でリロードしない',async()=>{
      const before=documents;await page.goto('https://x.com/alice/media?unready=1');
      await page.waitForTimeout(2200);
      assert.equal(documents-before,1);
      assert.equal(new URL(page.url()).search,'?unready=1');
    });
    await t.test('切替待ちに手動操作したら、遅れて開いたメニューを自動選択しない',async()=>{
      const before=documents;await page.goto('https://x.com/alice/media?slowmenu=1');
      await page.waitForFunction(()=>document.querySelector('[role="tab"]')?.getAttribute('aria-expanded')==='true');
      await page.locator('#ordinary').click();
      await page.evaluate(()=>window.releaseMediaMenu());await page.waitForTimeout(80);
      assert.equal(new URL(page.url()).search,'?slowmenu=1');
      assert.equal(await page.evaluate(()=>window.imageSelections),0);assert.equal(documents-before,1);
    });
  } finally {await cdp.detach();await context.close();await rm(profile,{recursive:true,force:true});}
});
