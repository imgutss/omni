import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
try {
for(const name of ['panel']) {
 const ctx=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const calls=[],saves=[];
 const settings={panel_name:'Omni',public_host:'omni-test.invalid',clean_ips:['104.17.148.17'],ip_pool:[],ipv6_pool:[],selected_country:'DIRECT',maintenance:'0',proto:'both',port:'443',ipv6_enabled:'0'};
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());const p=u.pathname;
  if(u.hostname!=='omni-test.invalid')return route.abort();
  if(p==='/')return route.fulfill({status:200,contentType:'text/html',body:fs.readFileSync(new URL(`${name}.html`,root),'utf8')});
  if(p==='/healthz')return route.fulfill({status:200,headers:{'x-omni-colo':'TEST'},body:'ok'});
  let body={ok:true};calls.push(p);
  if(p==='/api/whoami')body={ok:true,installed:true,username:'review',role:'admin',panelName:'Omni',signup:false};
  else if(p==='/api/settings'){
   if(route.request().method()==='PUT'){const update=route.request().postDataJSON();saves.push(update);Object.assign(settings,update)}
   body={ok:true,settings};
  } else if(p==='/api/fragments')body={ok:true,presets:[],fingerprints:[]};
  else if(p==='/api/users')body={ok:true,users:[],total:0};
  else if(p==='/api/overview')body={ok:true,total:0,users:{total:0,active:0},series:[]};
  else if(p==='/api/diag/rank-ips'){
   const ips=route.request().postDataJSON().ips;
   body={ok:true,total:ips.length,results:ips.map(ip=>({ip,edge_ms:1,is_cf:true,alive:false,worker_reachable:true,error:'HTTPS پاسخ داد، اما Cloudflare Trace تأیید نشد'})),rejected:[]};
  } else if(p==='/api/diag/underground-hunt')body={ok:true,candidates:[{addr:'2606:4700:3030::ac43:b520',source:'configured IPv6 seed candidate; untested'},{addr:'172.67.181.32',source:'neighbor candidate'}]};
  else if(p==='/api/diag/scan-countries')body={ok:true,results:[]};
  return route.fulfill({status:200,contentType:'application/json',headers:{'x-omni':'1'},body:JSON.stringify(body)});
 });
 await page.goto('https://omni-test.invalid/#/scanner');
 await page.locator('#scan-ranges').waitFor({timeout:15000});
 await page.locator('[data-action="omni-preset"][data-v="qos"]').click();
 await page.waitForFunction(()=>document.querySelector('#scan-status')?.textContent.includes('تمام شد'));
 assert.equal(await page.locator('#scan-out .scan-row').count(),16);
 assert.equal(await page.locator('#scan-out .badge.danger').count(),0);
 assert.equal(await page.locator('#scan-apply').isDisabled(),true);
 assert.equal(await page.locator('#scan-save-trial').isDisabled(),false);
 assert((await page.locator('#scan-status').textContent()).includes('16 آی‌پی نیاز به تست در کلاینت'));
 assert.equal(await page.locator('#scan-bar').evaluate(e=>e.style.width),'100%');
 assert.equal(await page.locator('[data-action="omni-preset"][data-v="sites"]').textContent(),'🛡️ فهرست جایگزین');
 const width=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
 assert(width.document<=width.viewport+2,JSON.stringify(width));
 await page.screenshot({path:new URL(`${name}-scanner-mobile.png`,root).pathname,fullPage:true,animations:'disabled'});
 // Switching quickly cannot leave stale results with a different selected preset.
 await page.locator('[data-action="omni-preset"][data-v="ipv6"]').click();
 await page.waitForFunction(()=>document.querySelector('#scan-status')?.textContent.includes('تمام شد'));
 assert.equal(await page.locator('#scan-out .scan-row').count(),10);
 // SIIT list correctly respects the IPv6 filter.
 await page.locator('[data-action="omni-ipver"][data-v="v6"]').click();
 await page.waitForFunction(()=>!document.querySelector('[data-action="omni-ipver"][data-v="v6"]').disabled);
 await page.locator('[data-action="omni-preset"][data-v="underground"]').click();
 await page.waitForFunction(()=>document.querySelector('#scan-status')?.textContent.includes('تمام شد'));
 assert.equal(await page.locator('#scan-out .scan-row').count(),1);
 assert((await page.locator('#scan-out').textContent()).includes('2606:4700'));
 // Empty filtered input must remain empty, never silently use default IPv4 seeds.
 await page.locator('[data-action="omni-clear-custom"]').click();
 await page.locator('#scan-ranges').fill('172.67.181.32');
 await page.locator('[data-action="omni-scan"]').click();
 await page.waitForFunction(()=>!document.querySelector('[data-action="omni-scan"]').disabled);
 assert.equal(await page.locator('#scan-out .scan-row').count(),0);
 assert((await page.locator('#scan-status').textContent()).includes('مطابق فیلتر'));
 assert.equal(saves.length,0,'mere scans must not change configuration');
 // Exercise the real new action handlers and confirmation modal, with a mocked backend only.
 await page.locator('[data-action="omni-ipver"][data-v="both"]').click();
 await page.waitForFunction(()=>!document.querySelector('[data-action="omni-ipver"][data-v="both"]').disabled);
 await page.locator('#scan-save-trial').click();
 await page.locator('[data-confirm="no"]').click();
 assert.equal(saves.length,0);
 await page.locator('#scan-save-trial').click();
 await page.locator('[data-confirm="yes"]').click();
 await page.waitForFunction(()=>document.body.innerText.includes('به فهرست اضافه شد'));
 assert.equal(saves.length,1);
 assert.deepEqual(saves[0].clean_ips,['104.17.148.17','172.67.181.32']);
 assert.equal(saves[0].ipv6_enabled,undefined);
 await page.locator('#scan-copy-list').click();
 await page.waitForFunction(()=>document.body.innerText.includes('فهرست آدرس‌ها کپی شد'));
 assert.deepEqual(errors,[]);
 results.push({panel:name,mobile:true,jsErrors:errors,tests:'raw IPv4/IPv6, SIIT filter, empty input, progress, no overflow, no implicit writes',ok:true});
 await ctx.close();
}
} finally {await browser.close();}
fs.writeFileSync(new URL('browser-test-results.json',root),JSON.stringify(results,null,2));
console.log(results);
