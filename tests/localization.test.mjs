import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const fixture=`<!doctype html><html lang="fr"><meta charset="utf-8"><article data-testid="tweet">
<div data-testid="User-Name"><a href="/alice/status/123"><time>1h</time></a></div>
<div role="group"><button data-testid="reply">Répondre</button><button data-testid="retweet" aria-haspopup="menu">Reposter</button>
<button aria-haspopup="menu">Partager</button></div></article><script>
window.pageClicks=0;document.addEventListener('click',()=>window.pageClicks++);
</script></html>`;

test('翻訳カタログのキーが日英で一致し、英語を既定にする',async()=>{
 const manifest=JSON.parse(await readFile('extension/manifest.json','utf8'));
 assert.equal(manifest.default_locale,'en');
 const en=JSON.parse(await readFile('extension/_locales/en/messages.json','utf8'));
 const ja=JSON.parse(await readFile('extension/_locales/ja/messages.json','utf8'));
 assert.deepEqual(Object.keys(en).sort(),Object.keys(ja).sort());
 for(const catalog of [en,ja])for(const [key,value]of Object.entries(catalog))assert.ok(value.message.trim(),key);
 assert.equal(manifest.name,'__MSG_extensionName__');
 assert.equal(manifest.description,'__MSG_extensionDescription__');
 assert.equal(manifest.action.default_title,'__MSG_extensionName__');
});

for(const [browserLanguage,language,basic,copyTitle,copyIdle,copySuccess,copyError,retry,loadError,saveError]of [
 ['ja','ja','基本','共有をURLコピーに','投稿URLをコピー','コピーしました','コピーできませんでした。もう一度お試しください','再試行','設定を読み込めませんでした','設定を保存できませんでした'],
 ['en-GB','en','General','Copy URL instead of Share','Copy post URL','Copied',"Couldn't copy. Please try again.",'Retry',"Couldn't load settings.","Couldn't save settings."],
 ['fr','en','General','Copy URL instead of Share','Copy post URL','Copied',"Couldn't copy. Please try again.",'Retry',"Couldn't load settings.","Couldn't save settings."],
])test(`Chrome UI ${browserLanguage}の実MV3で翻訳・通知・保存・失敗表示を確認`,{timeout:30000},async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'x-locale-'));
 const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,locale:browserLanguage,
  args:[`--lang=${browserLanguage}`,`--disable-extensions-except=${path.resolve('extension')}`,`--load-extension=${path.resolve('extension')}`]});
 try{
  await context.grantPermissions(['clipboard-read'],{origin:'https://x.com'});
  const page=await context.newPage();await page.route('https://x.com/**',r=>r.fulfill({contentType:'text/html',body:fixture}));
  await page.goto('https://x.com/home');
  const cdp=await context.newCDPSession(page),contexts=[];
  cdp.on('Runtime.executionContextCreated',({context:c})=>contexts.push(c));await cdp.send('Runtime.enable');
  const isolated=contexts.find(c=>c.origin.startsWith('chrome-extension://'));
  const popup=await context.newPage();await popup.goto(isolated.origin+'/popup.html');
  const actual=await popup.evaluate(()=>chrome.i18n.getUILanguage());
  assert.equal(actual.split('-')[0],browserLanguage.split('-')[0],'Chromeの実UIロケールを使う');
  await popup.getByRole('heading',{name:basic,exact:true}).waitFor({timeout:2500});
  assert.equal(await popup.getByRole('checkbox').count(),5);
  const messages=JSON.parse(await readFile(`extension/_locales/${language}/messages.json`,'utf8'));
  for(const key of ['directCopy','imagesFirst','hideGrokExplain','hideImageEdit','hidePremium']){
   assert.equal(await popup.getByText(messages[key+'Title'].message,{exact:true}).count(),1);
   assert.equal(await popup.getByText(messages[key+'Description'].message,{exact:true}).count(),1);
  }
  assert.equal(await popup.locator('html').getAttribute('lang'),language);
  assert.equal(await popup.locator('.k-app').getAttribute('lang'),language);
  const metadata=await popup.evaluate(()=>chrome.runtime.getManifest());
  assert.equal(await popup.title(),metadata.name);
  assert.equal(await popup.getByRole('heading',{level:1}).textContent(),messages.appName.message);
  assert.ok(!metadata.name.includes('__MSG_'));assert.ok(!metadata.description.includes('__MSG_'));
  const copy=page.getByRole('button',{name:copyIdle,exact:true});await copy.waitFor({timeout:2500});await page.bringToFront();await copy.click();
  await page.getByRole('button',{name:copySuccess,exact:true}).waitFor();
  assert.equal(await page.getByRole('status').textContent(),copySuccess);
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'https://x.com/alice/status/123');
  assert.equal(await page.locator('[data-x-direct-copy]').getAttribute('lang'),language);
  assert.equal(await page.locator('html').getAttribute('lang'),'fr','Xの言語を変更しない');
  assert.equal(await page.evaluate(()=>window.pageClicks),0);
  await cdp.send('Runtime.evaluate',{contextId:isolated.id,expression:'navigator.clipboard.writeText=()=>Promise.reject(new Error("fixture"))'});
  await page.getByRole('button',{name:copySuccess,exact:true}).click();
  await page.getByRole('button',{name:copyError,exact:true}).waitFor();
  assert.equal(await page.getByRole('status').textContent(),copyError);
  const toggle=popup.getByRole('checkbox',{name:new RegExp(copyTitle)});
  await toggle.click();await popup.waitForFunction(async()=> (await chrome.storage.local.get('directCopy')).directCopy===false);
  await popup.reload();assert.equal(await toggle.getAttribute('aria-checked'),'false');
  await popup.evaluate(()=>{chrome.storage.local.set=()=>Promise.reject(new Error('fixture'));});
  await toggle.click();await popup.getByText(saveError,{exact:true}).waitFor();
  assert.equal(await toggle.getAttribute('aria-checked'),'false','保存失敗で表示を戻す');
  await popup.addInitScript(()=>{const get=chrome.storage.local.get.bind(chrome.storage.local);let first=true;
   chrome.storage.local.get=(...args)=>{if(first){first=false;return new Promise((resolve,reject)=>{window.rejectLocaleLoad=()=>reject(new Error('fixture'));});}return get(...args);};});
  await popup.reload();await popup.getByText(messages.loadingSettings.message,{exact:true}).waitFor();
  await popup.evaluate(()=>window.rejectLocaleLoad());await popup.getByText(loadError,{exact:true}).waitFor();
  await popup.getByRole('button',{name:retry,exact:true}).click();await toggle.waitFor();
  assert.equal(await toggle.getAttribute('aria-checked'),'false');
  await cdp.detach();
 }finally{await context.close();await rm(profile,{recursive:true,force:true});}
});
