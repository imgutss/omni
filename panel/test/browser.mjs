// Browser-only UI tests. Every request is intercepted; no real user or service data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const release=JSON.parse(fs.readFileSync(new URL('../release.json',import.meta.url),'utf8'));
const html=fs.readFileSync(new URL('../build/panel.html',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let checks=0;
try{
 for(const viewport of [{width:393,height:852},{width:1440,height:1000}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];let loggedIn=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname!=='panel.test')return route.abort();
   if(u.pathname==='/')return route.fulfill({status:200,contentType:'text/html',body:html});
   let body={ok:true};
   const settings={panel_name:'Omni',public_host:'panel.test',clean_ips:[],proxy_ips:[],path:'/ws',proto:'both',port:'443',ipv6_enabled:'0'};
   if(u.pathname==='/api/whoami')body={ok:true,installed:true,username:loggedIn?'local-review':null,role:loggedIn?'admin':null,panelName:'Omni'};
   else if(u.pathname==='/api/settings')body={ok:true,settings};
   else if(u.pathname==='/api/users')body={ok:true,users:[],total:0,page:1,pages:1};
   else if(u.pathname==='/api/overview')body={ok:true,total:0,users:{total:0,active:0},series:[]};
   else if(u.pathname==='/api/masque/status')body={ok:true,needsKey:true,account:null};
   else if(u.pathname==='/api/masque/options')body={ok:true,ports:['443'],clients:[{value:'phone',label:'v2rayNG | Happ'}],singles:[],combined:[]};
   else if(u.pathname==='/api/fragments')body={ok:true,presets:[],fingerprints:[]};
   else if(u.pathname==='/api/version')body={ok:true,v:release.version,rev:release.revision};
   else if(u.pathname.endsWith('/manifest.json'))body={name:'Omni',icons:[]};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('https://panel.test/');
  await page.locator('input[type="password"]').first().waitFor({timeout:12000});checks++;
  assert.equal(errors.length,0,'login runtime errors: '+errors.join('; '));checks++;
  loggedIn=true;
  await page.reload();
  for(const view of ['dashboard','users','configs','outbound','wireguard_game','masque','scanner','settings']){
   await page.goto('https://panel.test/#/'+view);
   await page.waitForTimeout(600);
   const text=await page.locator('body').innerText();
   const expected={dashboard:/داشبورد|مدیریت|مصرف|کاربر|اومنی/,users:/کاربران/,configs:/کانفیگ|پیکربندی|اشتراک/,outbound:/اوت.باند|خروجی/,wireguard_game:/WARP|وایرگارد/,masque:/MASQUE/,scanner:/اسکن|آی.پی/,settings:/تنظیمات/};
   assert(expected[view].test(text),'unexpected route content on '+view+': '+text.slice(0,700));checks++;
   assert(!text.includes("ورود به پنل"),'unexpected login screen on '+view);checks++;
   assert.equal(errors.length,0,view+' runtime errors: '+errors.join('; '));checks++;
   assert(await page.locator('.omni-product-version:visible').count()>0,'version badge must be visible');checks++;
   assert((await page.locator('.omni-product-version:visible').first().innerText()).includes(release.version));checks++;
  }
  console.log(`${viewport.width}px: login and eight application routes passed`);
  await context.close();
 }
 console.log(`${checks} browser checks passed. Mock data only; no tunnel/connectivity claim.`);
}finally{await browser.close()}
