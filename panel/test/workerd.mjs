// Actual local Workers runtime + ephemeral D1/KV. No production credentials.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import fs from 'node:fs';
const release=JSON.parse(fs.readFileSync(new URL('../release.json',import.meta.url),'utf8'));
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const outbound=[];
const mf=new Miniflare(convertV4MiniflareOptions({name:"panel",
 modules:true,scriptPath:fileURLToPath(new URL('../build/worker.js',import.meta.url)),
 compatibilityDate:'2024-09-23',compatibilityFlags:['nodejs_compat'],
 d1Databases:['DB'],kvNamespaces:['KV','RELEASES'],
 durableObjects:{EGRESS:'OmniEgress2'},
 bindings:{PUBLIC_HOST:'panel.test',PANEL_NAME:'Omni'},
 outboundService:request=>{outbound.push(new URL(request.url).hostname);return new Response('External network blocked in local test',{status:503})},
}));
let checks=0;
try{
 const req=(path,options={})=>mf.dispatchFetch('https://panel.test'+path,options);
 const post=(path,body,cookie='')=>req(path,{method:'POST',headers:{'content-type':'application/json','x-omni-csrf':'1',origin:'https://panel.test',cookie},body:JSON.stringify(body)});
 let r=await req('/healthz');assert.equal(r.status,200);checks++;
 r=await req('/api/version');const version=await r.json();assert.equal(version.v,release.version);assert.equal(version.rev,release.revision);checks+=2;
 r=await req('/api/bot/health');assert.equal(r.status,403);checks++;
 r=await req('/api/whoami');assert.equal((await r.json()).installed,false);checks++;
 r=await post('/api/setup',{username:'local-admin',password:'local-test-only-strong-password-1234'});assert.equal(r.status,200,await r.clone().text());checks++;
 r=await post('/api/setup',{username:'attacker',password:'local-test-only-other-password-1234'});assert.equal(r.status,409);checks++;
 r=await post('/api/login',{username:'local-admin',password:'wrong-password'});assert.equal(r.status,401);checks++;
 r=await post('/api/login',{username:'local-admin',password:'local-test-only-strong-password-1234'});assert.equal(r.status,200,await r.clone().text());checks++;
 const cookie=(r.headers.get('set-cookie')||'').split(';')[0];assert(cookie);checks++;
 r=await req('/api/whoami',{headers:{cookie}});assert.equal((await r.json()).username,'local-admin');checks++;
 r=await req('/api/bot/health',{headers:{cookie}});assert.equal(r.status,200);checks++;
 r=await req('/api/masque/options',{headers:{cookie}});const mq=await r.json();assert.equal(r.status,200);assert(mq.clients.length>=5);checks+=2;
 r=await req('/api/masque/status',{headers:{cookie}});assert.equal((await r.json()).needsKey,true);checks++;
 r=await post('/api/masque/generate',{client:'phone',mode:'h2'},cookie);assert.equal(r.status,409);checks++;
 r=await req('/api/masque/status');assert.equal(r.status,401);checks++;
 r=await req('/api/settings');assert.equal(r.status,401);checks++;
 r=await req('/api/settings',{headers:{cookie}});assert.equal(r.status,200);checks++;
 r=await post('/api/users',{username:'local-user',quota_gb:1,expiry_days:1},cookie);assert.equal(r.status,200,await r.clone().text());checks++;
 r=await req('/api/users',{headers:{cookie}});const users=await r.json();assert(JSON.stringify(users).includes('local-user'));checks++;
 const db=await mf.getD1Database('DB');const row=await db.prepare("SELECT username FROM users WHERE username=?").bind('local-user').first();assert.equal(row.username,'local-user');checks++;
 assert.equal(outbound.length,0,'unexpected external requests: '+outbound.join(', '));checks++;
 console.log(`${checks} actual workerd/D1 checks passed. Ephemeral local data; no external network requests.`);
}finally{await mf.dispose()}
