import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const html=fs.readFileSync(process.env.OMNI_PANEL_HTML || new URL('../build/panel.html',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const viewport of [{width:393,height:852},{width:1440,height:1000}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.hostname!=='panel.test')return route.abort();
   if(u.pathname==='/')return route.fulfill({status:200,contentType:'text/html',body:html});
   let body={ok:true};
   if(u.pathname==='/api/whoami')body={ok:true,installed:true,username:'local-review',role:'admin',panelName:'Omni'};
   else if(u.pathname==='/api/settings')body={ok:true,settings:{panel_name:'Omni',public_host:'panel.test',clean_ips:[],proxy_ips:[],path:'/ws',proto:'both',port:'443',ipv6_enabled:'0'}};
   else if(u.pathname==='/api/users')body={ok:true,users:[],total:0,page:1,pages:1};
   else if(u.pathname==='/api/overview')body={ok:true,total:0,users:{total:0,active:0},series:[]};
   else if(u.pathname==='/api/version')body={ok:true,v:'1.0.3',rev:173};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('https://panel.test/#/wireguard_game');
  await page.getByText('۵) Aether',{exact:false}).first().waitFor({timeout:12000});
  const card=page.locator('.card').filter({hasText:'۵) Aether'}).first();
  assert.equal(await card.locator('button[data-text^="aether://"]').count(),15,'14 individual profiles + copy all');
  const texts=await card.locator('button[data-text^="aether://"]').evaluateAll(nodes=>nodes.map(x=>x.dataset.text));
  assert.equal(texts.filter(x=>x.includes('\n')).length,1);
  assert.equal(texts.find(x=>x.includes('\n')).split('\n').length,14);
  const singles=texts.filter(x=>!x.includes('\n'));assert.equal(singles.length,14);
  for(const text of singles){const u=new URL(text);assert.equal(u.protocol,'aether:');assert.equal(u.hostname,'');assert(!u.searchParams.has('outer'));assert(!u.searchParams.has('inner'));}
  assert(!(await card.innerText()).includes('همراه اول'));
  assert(!(await page.locator('body').innerText()).includes('کانفیگ گیم'));
  const one=card.locator('button[data-text^="aether://"]').nth(1);const expected=await one.getAttribute('data-text');
  await one.click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected,'copy button must copy its own link');
  assert.deepEqual(errors,[],`runtime errors: ${errors.join('; ')}`);
  console.log(`${viewport.width}px: 14 profiles, copy-one/copy-all, no fixed endpoint or game card`);
  await context.close();
 }
}finally{await browser.close()}
