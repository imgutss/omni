// Real public Railway diagnostic app. Positive path is live; negative path is mocked.
// Neither result is a user's Iranian-carrier or VLESS connectivity proof.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const url=process.env.OMNI_RAILWAY_DIAG_URL;
assert(url?.startsWith('https://'),'Set OMNI_RAILWAY_DIAG_URL to the created diagnostic domain');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,reducedMotion:'reduce',locale:'fa-IR'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(response.status(),200);
 assert(await page.locator('#start').isDisabled());
 assert((await page.locator('.note').innerText()).includes('فیلترشکن نیست'));
 await page.locator('#vpn-off').check(); // UI exercise in the sandbox, NOT a claim about user's phone.
 await page.locator('#start').click();
 await page.locator('#report-box:not([hidden])').waitFor({timeout:35000});
 const positive=JSON.parse(await page.locator('#report').innerText());
 assert.equal(positive.https.ok,true);
 assert.equal(positive.websocket_echo.ok,true);
 assert.equal(positive.proves_vless_or_national_connectivity,false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'/home/user/railway-trial/account-diagnostic-sandbox.png',fullPage:true,animations:'disabled'});
 await page.route('**/healthz?*',route=>route.abort('failed'));
 await page.routeWebSocket('**/ws',ws=>ws.close({code:1008,reason:'Synthetic failure regression'}));
 await page.locator('#start').click();
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('آزمایش تمام شد'),{},{timeout:35000});
 const negative=JSON.parse(await page.locator('#report').innerText());
 assert.equal(negative.https.ok,false,'HTTP failures must never go green');
 assert.equal(negative.websocket_echo.ok,false,'socket failure must never go green');
 assert(!(await page.locator('#http-state').getAttribute('class')).includes('ok'));
 assert(!(await page.locator('#ws-state').getAttribute('class')).includes('ok'));
 assert.deepEqual(errors,[]);
 const summary={scope:'Browser automation from agent sandbox; NOT user-line proof',real_positive:positive,synthetic_negative:{https:negative.https,websocket_echo:negative.websocket_echo},jsErrors:errors};
 fs.writeFileSync('/home/user/railway-trial/account-diagnostic-browser-results.json',JSON.stringify(summary,null,2));
 console.log(JSON.stringify(summary,null,2));
} finally {await browser.close();}
