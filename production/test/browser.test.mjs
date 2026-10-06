import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
try {for(const name of ['production']) {
 const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[],calls=[],saves=[];
 page.on('pageerror',e=>errors.push(e.message));
 const settings={panel_name:'Omni',public_host:'omni-test.invalid',clean_ips:['104.17.148.17','172.67.181.32'],ip_pool:'104.17.148.17\n172.67.181.32',ipv6_pool:[],address_domains:[],selected_country:'DE',proxy_ips:['103.27.156.147:443'],path:'/ws',proto:'both',port:'443',ipv6_enabled:'1',fragment_preset:'none'};
 const user={username:'regression-test',uuid:'11111111-1111-4111-8111-111111111111',sub_token:'test-only-not-live',status:'active',quota_gb:10,used_bytes:0};
 let failSense=false, failHunt=false;
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url()),p=u.pathname;
  if(u.hostname!=='omni-test.invalid') {
   // Explicit mock scenario: one IP responds to HTTPS; all others fail. These are NOT live ping measurements.
   if(u.hostname==='104.17.148.167')return route.fulfill({status:200,body:'trace mocked'});
   return route.abort('failed');
  }
  if(p==='/')return route.fulfill({status:200,contentType:'text/html',body:fs.readFileSync(new URL('panel.html',root),'utf8')});
  if(p==='/healthz')return route.fulfill({status:200,headers:{'x-omni-colo':'TEST'},body:'ok'});
  calls.push(p);let body={ok:true};
  if(p==='/api/whoami')body={ok:true,installed:true,username:'review',role:'admin',panelName:'Omni'};
  else if(p==='/api/settings'){
   if(route.request().method()==='PUT'){const patch=route.request().postDataJSON();saves.push(patch);Object.assign(settings,patch)}body={ok:true,settings};
  }else if(p==='/api/users')body={ok:true,users:[user],total:1};
  else if(p==='/api/fragments')body={ok:true,presets:[],fingerprints:[]};
  else if(p==='/api/overview')body={ok:true,total:1,users:{total:1,active:1},series:[]};
  else if(p==='/api/diag/rank-ips')body={ok:true,results:route.request().postDataJSON().ips.map(ip=>({ip,edge_ms:1,alive:false,is_cf:true,worker_reachable:true,tcp_reachable:ip==='103.27.156.147',is_proxy:ip==='103.27.156.147'}))};
  else if(p==='/api/diag/underground-hunt'){
   if(failHunt)return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({ok:false,error:'hunt unavailable'})});
   body={ok:true,candidates:[{addr:'104.17.148.167',source:'SIIT sample'},{addr:'2606:4700::1',source:'IPv6 sample'}]};
  }else if(p==='/api/diag/scan-countries')body={ok:true,results:[{cc:'DE',fa:'آلمان',flag:'🇩🇪',tcp_reachable:true,worker_tcp_ms:27,proxy:'103.27.156.147:443'},{cc:'NL',fa:'هلند',flag:'🇳🇱',tcp_reachable:false,worker_tcp_ms:null}]};
  else if(p==='/api/diag/net-sense'){
   if(failSense)return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({ok:false,error:'sense unavailable'})});
   body={ok:true,isp:{name:'MCI',fragment:'mci',fragmentRule:'tlshello'},ipVersion:'IPv6',applied_ips:[]};
  }else if(p==='/api/diag/probe')body={ok:true,ms:33};
  return route.fulfill({status:200,contentType:'application/json',headers:{'x-omni':'1'},body:JSON.stringify(body)});
 });
 const waitScan=()=>page.waitForFunction(()=>document.querySelector('#scan-status')?.textContent.includes('تست کامل شد'));
 await page.goto('https://omni-test.invalid/#/scanner');await page.locator('#scan-ranges').waitFor();
 assert((await page.locator('[data-action="omni-preset"][data-v="sites"]').textContent()).includes('همزاد ECH'));
 assert((await page.locator('[data-action="omni-preset"][data-v="underground"]').textContent()).includes('SIIT-Hex64'));
 assert.equal(await page.locator('#scan-save-trial').count(),0,'native/trial UI removed');
 await page.locator('[data-action="omni-preset"][data-v="qos"]').click();await waitScan();
 assert.equal(await page.locator('#scan-out .scan-row').count(),16);
 assert.equal(await page.locator('#scan-out .badge.ok').count(),1,'failed fetch must not turn green');
 assert((await page.locator('#scan-status').textContent()).includes('1/16'));
 assert.equal(await page.locator('#scan-bar').evaluate(el=>el.style.width),'100%');
 assert(!(await page.locator('#scan-out').textContent()).includes('تست با SNI در کلاینت'));
 assert.equal(saves.length,0,'scan only must not write settings');
 await page.locator('#scan-apply').click();await page.waitForFunction(()=>document.body.innerText.includes('آدرس‌های دارای پاسخ HTTPS ذخیره شدند'));
 assert(saves.at(-1).clean_ips.includes('104.17.148.167'));assert(saves.at(-1).clean_ips.includes('172.67.181.32'));
 await page.screenshot({path:new URL(`${name}-classic-scanner.png`,root).pathname,fullPage:true,animations:'disabled'});
 await page.locator('[data-action="omni-preset"][data-v="underground"]').click();await waitScan();assert.equal(await page.locator('#scan-out .scan-row').count(),2);
 failHunt=true;await page.locator('[data-action="omni-preset"][data-v="underground"]').click();await waitScan();assert((await page.locator('#scan-status').textContent()).includes('hunt unavailable'));assert.equal(await page.locator('[data-action="omni-scan"]').isDisabled(),false);failHunt=false;
 await page.locator('[data-action="omni-net-sense"]').click();await page.waitForFunction(()=>document.querySelector('#direct-ping-badges')?.textContent.includes('MCI'));
 failSense=true;await page.locator('[data-action="omni-net-sense"]').click();await page.waitForFunction(()=>document.querySelector('#direct-ping-badges')?.textContent.includes('sense unavailable'));assert.equal(await page.locator('[data-action="omni-net-sense"]').isDisabled(),false);failSense=false;
 const beforeRotation=[...settings.clean_ips];await page.locator('[data-action="omni-rotate-ips"]').click();await page.waitForFunction(()=>document.body.innerText.includes('ترتیب مخزن آی‌پی چرخید'));assert.equal(settings.clean_ips.at(-1),beforeRotation[0]);
 await page.locator('[data-action="omni-test-direct"]').click();await page.waitForFunction(()=>document.querySelector('#direct-ping-badges')?.textContent.includes('مرورگر → Worker'));
 await page.locator('[data-action="omni-scan-tab"][data-tab="countries"]').click();await page.locator('#country-grid [data-cc="DE"]').waitFor();
 await page.locator('[data-action="omni-scan-all-countries"]').first().click();await page.waitForFunction(()=>document.querySelector('#scan-status')?.textContent.includes('تست کشورها تمام شد'));
 assert((await page.locator('#scan-out').textContent()).includes('27 ms'));
 await page.locator('#scan-out [data-action="omni-pick-country-exit"]').click();await page.locator('[data-confirm="yes"]').click();await page.waitForFunction(()=>document.body.innerText.includes('ذخیره شد'));
 assert.equal(settings.proxy_ips[0],'103.27.156.147:443');
 await page.evaluate(()=>location.hash='#/configs');await page.locator('[data-action="omni-cfg-addr"]').first().waitFor();
 assert(!(await page.locator('[data-action="omni-cfg-addr"]').allTextContents()).join(' ').includes('candidate'));
 await page.locator('[data-action="omni-cfg-addr"][data-v="host"]').click({timeout:6000}).catch(async err=>{console.log('CONFIG ERROR',name,errors,await page.locator('body').innerText());throw err;});
 await page.locator('[data-action="omni-cfg-port"][data-v="2053"]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('#cfg-out [data-text]')].some(el=>el.dataset.text.includes(':2053?')),{},{timeout:6000}).catch(async err=>{console.log('PORT ERROR',name,errors,await page.locator('#cfg-out').innerText(),await page.locator('[data-action="omni-cfg-port"]').evaluateAll(es=>es.map(e=>[e.dataset.v,e.getAttribute('aria-pressed')])));throw err;});
 const links=await page.locator('#cfg-out [data-action="omni-copy"]').evaluateAll(els=>els.map(el=>el.dataset.text).filter(v=>v.startsWith('vless://')||v.startsWith('trojan://')).flatMap(v=>v.split('\n')));
 const uniq=[...new Set(links)].map(v=>new URL(v));assert.deepEqual([...new Set(uniq.map(u=>u.port))].sort(),['2053','443']);
 assert(uniq.every(u=>u.hostname==='omni-test.invalid'));
 assert(uniq.every(u=>u.searchParams.get('path').includes('103.27.156.147')),'preserve chosen country server');
 // QoS selection must not silently turn into MCI IPv6 input.
 await page.locator('[data-action="omni-cfg-addr"][data-v="qos"]').click();
 await page.waitForFunction(()=>document.querySelector('#cfg-out')?.innerText.includes('104.'));
 const qos=await page.locator('#cfg-out [data-text]').evaluateAll(els=>els.map(el=>el.dataset.text).filter(v=>v.startsWith('vless://')).flatMap(v=>v.split('\n')));
 assert(qos.every(v=>!new URL(v).hostname.includes(':')),'IPv4 preset must remain IPv4');
 await page.locator('[data-action="omni-cfg-addr"][data-v="hybrid"]').click();
 const checkbox=page.locator('#cfg-ipv6');if(await checkbox.isChecked())await checkbox.locator('xpath=ancestor::label').click();
 await page.waitForFunction(()=>!document.querySelector('#cfg-ipv6').checked);
 const filtered=await page.locator('#cfg-out [data-text]').evaluateAll(els=>els.map(el=>el.dataset.text).filter(v=>v.startsWith('vless://')).flatMap(v=>v.split('\n')));
 assert(filtered.every(v=>!new URL(v).hostname.includes(':')),'IPv6 toggle respected even in MCI profile');
 await page.screenshot({path:new URL(`${name}-classic-configs.png`,root).pathname,fullPage:true,animations:'disabled'});
 assert.deepEqual(errors,[]);results.push({panel:name,ok:true,mocked:true,tests:['classic scanner controls','actual browser fetch path invoked','TLS errors never succeed','progress','save merge','SIIT success/error','network sense success/error','pool rotation','direct ping','country list/scan/select','config names','async output rerender stable','ports 443+2053 honored','selected proxy retained','QoS IPv4 honored','IPv6 off honored'],jsErrors:errors});
 await context.close();
}}finally{await browser.close();}
fs.writeFileSync(new URL('browser-results.json',root),JSON.stringify(results,null,2));console.log(results);
