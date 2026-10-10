// Real Worker/D1 runtime in isolated LOCAL Miniflare. Agent reports are synthetic.
// This test cannot prove a real VPS install, Iranian CDN access, or carrier access.
import {Miniflare} from 'miniflare';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const persist=fs.mkdtempSync(path.join(os.tmpdir(),'omni-vps-upgrade-'));
const options={d1Persist:persist,modules:true,scriptPath:new URL('../production/worker.js',import.meta.url).pathname,
 compatibilityDate:'2024-09-23',compatibilityFlags:['nodejs_compat'],
 d1Databases:['DB'],kvNamespaces:['RELEASES'],bindings:{PUBLIC_HOST:'panel.example.com',PANEL_NAME:'LOCAL TEST'},
 host:'127.0.0.1',port:0};
let mf=new Miniflare(options);
let cookie='';
const base='https://panel.example.com';
async function req(path,method='GET',body,auth=false) {
 return mf.dispatchFetch(base+path,{method,headers:{'content-type':'application/json','x-omni':'1',...(auth?{cookie}:{} )},...(body?{body:JSON.stringify(body)}:{})});
}
async function api(path,method='GET',body,auth=true){const r=await req(path,method,body,auth);const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;}
try {
 const setup=await req('/api/setup','POST',{username:'localadmin',password:'LocalTestOnly12345'});
 assert.equal(setup.status,200,await setup.clone().text());
 cookie=setup.headers.get('set-cookie')?.split(';')[0] || '';
 if(!cookie){const r=await req('/api/login','POST',{username:'localadmin',password:'LocalTestOnly12345'});cookie=r.headers.get('set-cookie')?.split(';')[0] || '';}
 assert(cookie,'local session cookie');
 const db=await mf.getD1Database('DB');
 const uid='11111111-1111-4111-8111-111111111111',uid2='22222222-2222-4222-8222-222222222222';
 await db.prepare('INSERT INTO users(username,uuid,sub_token) VALUES(?,?,?)').bind('cdn-user',uid,'local-cdn-sub').run();
 await db.prepare('INSERT INTO users(username,uuid,sub_token) VALUES(?,?,?)').bind('other-user',uid2,'local-other-sub').run();
 assert.equal((await req('/api/vps')).status,401);
 // Simulate an already-installed pre-v10 database, after bootstrap is cached.
 await db.batch(['vps_line_checks','vps_tasks','vps_nodes'].map(t=>db.prepare('DROP TABLE IF EXISTS '+t)));
 const created=await api('/api/vps/create','POST',{label:'LOCAL-SYNTHETIC-NODE'});
 assert(created.install.includes('&& bash '));
 const script=await req('/vps-agent.sh?join='+created.join_token);
 assert.equal(script.status,200);
 const text=await script.text();assert(text.includes('omni-vps-agent.service'));assert(!text.includes('__API__'));assert(!text.includes('__AGENT_PY__'));
 assert.equal((await req('/vps-agent.sh?join='+encodeURIComponent('join_$(touch /tmp/evil)'))).status,400);
 assert.equal((await req('/api/vps/task','POST',{node_id:created.id,payload:{kind:'restart'}},true)).status,409);
 const joined=await api('/api/vps/join','POST',{join:created.join_token,ip:'1.1.1.1'},false);
 assert.equal(joined.connectivity_verified,false);
 assert.equal((await req('/api/vps/join','POST',{join:created.join_token})).status,404,'single-use join');
 assert.equal((await req('/api/vps/poll','POST',{token:'bad'})).status,403);
 const payload={kind:'ws',via_cdn:true,uuid:uid,domain:'relay.example.com',address:'snapp.ir',path:'/vzn',fake_sni:'snapp.ir',spoof_ip:'1.1.1.1'};
 assert.equal((await req('/api/vps/task','POST',{node_id:created.id,payload:{...payload,spoof_ip:'127.0.0.1'}},true)).status,400);
 assert.equal((await req('/api/vps/task','POST',{node_id:created.id,payload:{kind:'shell',cmd:'id'}},true)).status,400);
 const queued=await api('/api/vps/task','POST',{node_id:created.id,payload});
 assert.equal(queued.connectivity_verified,false);
 assert.equal((await req('/api/vps/task','POST',{node_id:created.id,payload},true)).status,409,'no concurrent installs');
 const poll=await api('/api/vps/poll','POST',{token:joined.token},false);
 assert.equal(poll.tasks.length,1);assert.equal(poll.tasks[0].payload.via_cdn,true);
 assert.equal((await api('/api/vps/poll','POST',{token:joined.token},false)).tasks.length,0,'leased task is not double-delivered');
 // Artificial agent report ONLY. We deliberately never put it in a production DB.
 await api('/api/vps/report','POST',{token:joined.token,status:'online',info:{xray_active:true,agent_version:'10.1'},profiles:[payload],done:[queued.task_id],results:{[queued.task_id]:'ok: local mocked result; no real VPS'}},false);
 let list=await api('/api/vps');
 assert.equal(list.nodes[0].tasks[0].state,2);
 assert(!JSON.stringify(list).includes(joined.token),'node token never appears in panel list');
 const helper=fs.readFileSync(new URL('../tools/vps-profile.js',import.meta.url),'utf8');
 const {vpsUriOf,vpsProofKey}=new Function(helper+'\nreturn {vpsUriOf,vpsProofKey};')();
 const node=list.nodes[0],key=vpsProofKey(node,payload),spoofKey=vpsProofKey(node,payload,true);
 const sub=async(type='raw',other=false)=>{const r=await req('/s/'+(other?'local-other-sub':'local-cdn-sub')+'?type='+type); const text=await r.text(); assert.equal(r.status,200,text); assert(text.startsWith('vless://'),'subscription must contain VLESS, not a JSON error'); return text;};
 const baseline=await sub();
 const domains=JSON.parse(fs.readFileSync(new URL('../tools/exp50.json',import.meta.url),'utf8'));
 for(const domain of domains)assert(baseline.includes('@'+domain+':443'),'existing domain route must survive: '+domain);
 assert(!(await sub()).includes('relay.example.com'),'no unapproved candidates in subscription');
 await api('/api/vps/line-check','POST',{node_id:created.id,profile_key:key,confirmed:true});
 assert((await sub()).includes(vpsUriOf(node,payload)),'explicit approval publishes exact UUID and route');
 assert(!(await sub('raw',true)).includes('relay.example.com'),'unprovisioned user never gets a fake-working VPS config');
 await api('/api/vps/line-check','POST',{node_id:created.id,profile_key:spoofKey,confirmed:true});
 assert(!(await sub()).includes('snispoofing='),'stock subscription does not imply spoof support');
 assert((await sub('v2box')).includes('snispoofing='),'V2Box format preserves custom URI extension');
 await api('/api/vps/line-check','POST',{node_id:created.id,profile_key:key,confirmed:false});
 assert(!(await sub()).includes('relay.example.com'),'revoking approval removes route');
 assert.equal((await req('/api/vps/line-check','POST',{node_id:created.id,profile_key:'unknown',confirmed:true},true)).status,409);
 await api('/api/vps/remove','POST',{node_id:created.id});
 assert.equal((await api('/api/vps')).nodes.length,0);
 assert.equal((await req('/api/vps/poll','POST',{token:joined.token})).status,403);
 // Simulate an already installed pre-v10 DB and a fresh Worker isolate.
 await db.exec('DROP TABLE vps_line_checks; DROP TABLE vps_tasks; DROP TABLE vps_nodes;');
 await mf.dispose(); mf=new Miniflare(options);
 assert.equal((await req('/')).status,200,'legacy fast bootstrap');
 assert.equal((await api('/api/vps')).nodes.length,0,'paid tables migrate despite SCHEMA_READY fast path');
 const upgraded=await mf.getD1Database('DB');
 const tables=await upgraded.prepare("SELECT name FROM sqlite_master WHERE name IN ('vps_nodes','vps_tasks','vps_line_checks')").all();
 assert.equal(tables.results.length,3);
 console.log('VPS API/D1 LOCAL runtime + legacy upgrade tests PASS; synthetic reports, not real VPS/CDN/line proof');
} finally {await mf.dispose();fs.rmSync(persist,{recursive:true,force:true});}
