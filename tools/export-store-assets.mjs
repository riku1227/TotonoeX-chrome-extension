import {chromium} from 'playwright';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const output=path.resolve('assets/store');
await mkdir(output,{recursive:true});
for(const locale of ['ja','en']){
  const profile=await mkdtemp(path.join(tmpdir(),'totonoex-store-'));
  const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,locale,
    viewport:{width:380,height:560},args:[`--lang=${locale}`,`--disable-extensions-except=${path.resolve('extension')}`,`--load-extension=${path.resolve('extension')}`]});
  try{
    const page=await context.newPage();
    await page.route('https://x.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Local capture fixture</title>'}));
    await page.goto('https://x.com/home');
    const cdp=await context.newCDPSession(page),contexts=[];
    cdp.on('Runtime.executionContextCreated',({context:c})=>contexts.push(c));
    await cdp.send('Runtime.enable');
    const origin=contexts.find(c=>c.origin.startsWith('chrome-extension://')).origin;
    await page.goto(origin+'/popup.html');
    await page.getByRole('checkbox').last().waitFor();
    for(const theme of ['light','dark']){
      await page.emulateMedia({colorScheme:theme});
      await page.evaluate(async()=>{await document.fonts.ready;await new Promise(requestAnimationFrame);});
      await page.screenshot({path:path.join(output,`popup-${locale}-${theme}.png`)});
    }
  }finally{await context.close();}
}
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 for(const locale of ['ja','en']){
  const sources=await Promise.all(['light','dark'].map(async t=>'data:image/png;base64,'+(await readFile(path.join(output,`popup-${locale}-${t}.png`))).toString('base64')));
  const title=locale==='ja'?'いつものXを、自分好みに。':'Make X feel more like you.';
  const subtitle=locale==='ja'?'5つの機能を個別に設定。ライト・ダークに自動対応。':'Five independent settings. Automatic light and dark appearance.';
  await page.setContent(`<!doctype html><html lang="${locale}"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#edf3fa;color:#132b48;font-family:Segoe UI,Meiryo,sans-serif}header{padding:38px 80px 0}h1{font-size:34px;margin:0 0 10px}p{font-size:19px;margin:0;color:#46617d}.panels{display:flex;justify-content:center;gap:100px;margin-top:27px}.panel img{width:380px;height:560px;display:block;border-radius:12px;box-shadow:0 8px 25px #17375920}.label{margin-bottom:10px;font-size:15px;color:#46617d}footer{font-size:13px;color:#46617d;position:absolute;bottom:18px;left:80px}</style><header><h1>${title}</h1><p>${subtitle}</p></header><div class="panels"><div class="panel"><div class="label">LIGHT</div><img src="${sources[0]}"></div><div class="panel"><div class="label">DARK</div><img src="${sources[1]}"></div></div><footer>TotonoeX for X · ${locale==='ja'?'実際の設定画面':'Actual settings interface'}</footer></html>`);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
  await page.screenshot({path:path.join(output,`settings-${locale}-1280x800.png`)});
 }
}finally{await browser.close();}
console.log('Exported actual popup captures and localized 1280x800 store images.');
