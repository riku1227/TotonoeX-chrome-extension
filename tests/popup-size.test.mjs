import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

// 普通のタブでpopup.htmlを開くだけでは、Chromeの自動サイズ決定を検査できない。
for(const browserLanguage of ['ja','en'])test(`${browserLanguage}の実action popupでスクロールし、末尾の設定を操作できる`, {timeout:30000},async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'x-popup-size-'));
 const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:null,
  args:[`--lang=${browserLanguage}`,`--disable-extensions-except=${path.resolve('extension')}`,`--load-extension=${path.resolve('extension')}`]});
 try{
  const control=await context.newPage();
  await control.route('https://x.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Fixture</title>'}));
  await control.goto('https://x.com/home');
  const cdp=await context.newCDPSession(control),contexts=[];
  cdp.on('Runtime.executionContextCreated',({context:c})=>contexts.push(c));await cdp.send('Runtime.enable');
  const origin=contexts.find(c=>c.origin.startsWith('chrome-extension://')).origin;
  await control.goto(origin+'/popup.html');
  await control.evaluate(()=>chrome.action.openPopup());
  const own=(await cdp.send('Target.getTargetInfo')).targetInfo.targetId;
  const {targetInfos}=await cdp.send('Target.getTargets');
  const target=targetInfos.find(t=>t.url===origin+'/popup.html'&&t.targetId!==own);
  assert.ok(target,'実際のaction popupが開いた');
  const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
  let nextId=1;
  const request=(method,params={})=>new Promise((resolve,reject)=>{
   const id=nextId++;
   const listener=e=>{if(e.sessionId!==sessionId)return;const m=JSON.parse(e.message);if(m.id!==id)return;
    cdp.off('Target.receivedMessageFromTarget',listener);if(m.error)reject(new Error(m.error.message));else resolve(m.result);};
   cdp.on('Target.receivedMessageFromTarget',listener);
   cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})}).catch(reject);
  });
  const response=await request('Runtime.evaluate',{expression:`(async()=>{
   for(let i=0;i<100&&document.querySelectorAll('[role="checkbox"]').length!==5;i++)await new Promise(r=>setTimeout(r,20));
   await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
   return {width:innerWidth,height:innerHeight,bodyWidth:document.body.getBoundingClientRect().width,
    bodyHeight:document.body.getBoundingClientRect().height,scrollHeight:document.querySelector('.k-app').scrollHeight,rows:[...document.querySelectorAll('[role="checkbox"]')].map(e=>{
      const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,bottom:r.bottom};})};
  })()`,returnByValue:true,awaitPromise:true});
  const metrics=response.result.value;
  const output=`artifacts/ui/action-popup/${browserLanguage}`;
  await mkdir(output,{recursive:true});
  await writeFile(output+'/metrics.json',JSON.stringify(metrics,null,2));
  const shot=await request('Page.captureScreenshot');
  await writeFile(output+'/settings.png',Buffer.from(shot.data,'base64'));
  assert.ok(metrics.width>=360&&metrics.width<=400,`実ポップアップの横幅: ${metrics.width}px`);
  assert.equal(metrics.rows.length,5);
  assert.ok(metrics.height<=600,`ポップアップのウィンドウの高さ: ${metrics.height}px`);
  for(const row of metrics.rows){
   assert.ok(row.width>=280,'設定の説明が極端に折り返されない');
  }
  assert.ok(metrics.scrollHeight>metrics.height,'設定一覧が縦にスクロールできる');
  const last=await request('Runtime.evaluate',{expression:`(async()=>{const e=[...document.querySelectorAll('[role="checkbox"]')].at(-1);e.scrollIntoView({block:'nearest'});await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,bottom:r.bottom};})()`,returnByValue:true,awaitPromise:true});
  assert.ok(last.result.value.bottom<=600,'プレミアム設定が枠内に収まる');
  const bottom=await request('Page.captureScreenshot');
  await writeFile(output+'/scrolled.png',Buffer.from(bottom.data,'base64'));
  await request('Input.dispatchMouseEvent',{type:'mousePressed',x:last.result.value.x,y:last.result.value.y,button:'left',clickCount:1});
  await request('Input.dispatchMouseEvent',{type:'mouseReleased',x:last.result.value.x,y:last.result.value.y,button:'left',clickCount:1});
  const changed=await request('Runtime.evaluate',{expression:`(async()=>{for(let i=0;i<50;i++){const v=await chrome.storage.local.get('hidePremium');if(v.hidePremium===false)return true;await new Promise(r=>setTimeout(r,20));}return false;})()`,returnByValue:true,awaitPromise:true});
  assert.equal(changed.result.value,true,'末尾のプレミアム設定を実ポップアップから変更できる');
  await cdp.send('Target.detachFromTarget',{sessionId});await cdp.detach();
 }finally{await context.close();await rm(profile,{recursive:true,force:true});}
});
