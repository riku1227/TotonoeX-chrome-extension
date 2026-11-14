import {chromium} from 'playwright';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {homedir,tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const phase=process.argv[2]||'final';
const colorScheme=process.argv[3]||'light';
const browserLanguage=process.argv[4]||'ja';
if(!['light','dark'].includes(colorScheme))throw new Error('Color scheme must be light or dark');
const output=path.resolve('artifacts/ui',phase);await mkdir(output,{recursive:true});
const profile=await mkdtemp(path.join(tmpdir(),'x-popup-ui-'));
const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,colorScheme,locale:browserLanguage,
  args:[`--lang=${browserLanguage}`,`--disable-extensions-except=${path.resolve('extension')}`,`--load-extension=${path.resolve('extension')}`]});
try{
  const page=await context.newPage();
  await page.route('https://x.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>fixture</title>'}));
  await page.goto('https://x.com/home');
  const cdp=await context.newCDPSession(page),contexts=[];
  cdp.on('Runtime.executionContextCreated',({context:c})=>contexts.push(c));await cdp.send('Runtime.enable');
  const origin=contexts.find(c=>c.origin.startsWith('chrome-extension://')).origin;
  const requests=[];page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  const skillRoot=process.env.SPACE_UI_DESIGN_DIR||path.join(homedir(),'.agents','skills','space-ui-design');
  const audit=await readFile(path.join(skillRoot,'scripts','dom-audit.js'),'utf8');
  const reports=[];
  for(const width of [380,390,1280]){
    await page.setViewportSize({width,height:640});
    await page.goto(origin+'/popup.html');await page.getByRole('checkbox').first().waitFor();
    if(width===380){
      const palette=()=>page.evaluate(()=>({
        dark:matchMedia('(prefers-color-scheme: dark)').matches,
        background:getComputedStyle(document.body).backgroundColor,
        surface:getComputedStyle(document.querySelector('.k-card')).backgroundColor,
        text:getComputedStyle(document.querySelector('.k-row-title')).color,
      }));
      const before=await palette();const url=page.url();
      await page.emulateMedia({colorScheme:colorScheme==='dark'?'light':'dark'});
      const other=await palette();
      assert.notEqual(before.dark,other.dark);
      for(const key of ['background','surface','text'])assert.notEqual(before[key],other[key],`${key} follows color scheme`);
      await page.emulateMedia({colorScheme});
      assert.deepEqual(await palette(),before,'palette returns without reload');assert.equal(page.url(),url);
      console.log(`Verified ${colorScheme} → ${other.dark?'dark':'light'} → ${colorScheme}: automatic CSS palette`);
    }
    await page.screenshot({path:path.join(output,`settings-${width}.png`),fullPage:true,animations:'disabled'});
    reports.push({screen:'settings',width,report:await page.evaluate(audit)});
    await page.getByRole('checkbox').last().scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,`scrolled-${width}.png`),fullPage:true,animations:'disabled'});
    reports.push({screen:'scrolled',width,report:await page.evaluate(audit)});
    await page.getByRole('checkbox').first().scrollIntoViewIfNeeded();
    if(width!==1280){
      await page.getByRole('checkbox').first().click();
      await page.waitForFunction(async()=> (await chrome.storage.local.get('directCopy')).directCopy===false);
      await page.waitForTimeout(250);
      await page.screenshot({path:path.join(output,`disabled-${width}.png`),fullPage:true,animations:'disabled'});
      reports.push({screen:'disabled',width,report:await page.evaluate(audit)});
      await page.evaluate(()=>chrome.storage.local.set({directCopy:true}));
    }
  }
  await writeFile(path.join(output,'audit.json'),JSON.stringify({browserLanguage,colorScheme,reports,requests},null,2));
  for(const r of reports)console.log(`${r.screen} ${r.width}: ${r.report.text}`);
  if(requests.length)throw new Error('Popup requested external resources');
  if(reports.some(r=>r.report.errors?.length))process.exitCode=1;
  await cdp.detach();
}finally{await context.close();await rm(profile,{recursive:true,force:true});}
