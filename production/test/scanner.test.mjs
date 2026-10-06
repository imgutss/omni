import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as acorn from 'acorn';
const root=new URL('../',import.meta.url);
const html=fs.readFileSync(new URL('panel.html',root),'utf8');
const names=new Set(['Rt','Re','scanIsIp','scanFreshRows','scanControls','scanFinish','scanMerge','xe','Zt','dt','scanRun','Wt','WtUnderground','Kt']);
const functions=[];
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
 const code=m[1],ast=acorn.parse(code,{ecmaVersion:'latest'});
 const walk=(node)=>{if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&names.has(node.id.name))functions.push(code.slice(node.start,node.end));for(const [k,v] of Object.entries(node)){if(k==='start'||k==='end')continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}};walk(ast);
}
assert.equal(functions.length,names.size);
const elements=new Map();
for(const id of ['#scan-out','#scan-bar','#scan-apply','#scan-save-trial','#scan-copy-list','#scan-ranges']) elements.set(id,{value:'',style:{},disabled:false,innerHTML:''});
let fetchCalls=0, rankCalls=0, saved=[],notices=[],accepted=false,clock=0;
const ctx=vm.createContext({
 console,AbortController,setTimeout,clearTimeout,Date,Map,Set,Number,String,Math,Promise,
 performance:{now:()=>clock},
 fetch:async()=>{fetchCalls++;clock+=100;throw new TypeError('Failed to fetch')},
 document:{querySelector:(s)=>elements.get(s)||null,querySelectorAll:()=>[]},
 O:{results:[],running:false,tab:'ingress',ipVer:'both',scanMode:'preset',preset:'all'},
 COUNTRY_PROXY_MAP:new Map([['203.0.113.2',{cc:'DE',flag:'DE',fa:'آلمان'}]]),COUNTRY_MAP:new Map(),DEAD_BYOIP_SET:new Set(),SCAN_PRESETS:{all:['172.67.181.32']},
 a:(s)=>String(s),se:(s)=>notices.push(s),y:(s)=>notices.push(s),Q:async()=>accepted,
 b:{rankIps:async(ips)=>{rankCalls++;return {results:ips.map(ip=>({ip,worker_reachable:true,edge_ms:1,alive:false,is_cf:true,error:'HTTP only'}))}},saveSettings:async(patch)=>{saved.push(patch);return {settings:patch}}},
 x:async()=>({candidates:[]})
});
vm.runInContext(functions.join('\n'),ctx);
const tests=[];
async function test(name,fn){await fn();tests.push({name,ok:true});}
const run=(s)=>vm.runInContext(s,ctx);
await test('raw IPv4 is not falsely probed by HTTPS browser',async()=>{const r=await run('Zt("172.67.181.32",2400)');assert.equal(r.state,'native-required');assert.equal(r.ms,null);assert.equal(fetchCalls,0)});
await test('raw IPv6 is not falsely probed by HTTPS browser',async()=>{assert.equal((await run('Zt("[2606:4700::1]",2400)')).state,'native-required');assert.equal(fetchCalls,0)});
await test('failed domain request never becomes ping',async()=>{const r=await run('Zt("example.org",2400)');assert.equal(r.ms,null);assert.equal(r.state,'failed');assert.equal(fetchCalls,3)});
await test('measured domain uses unscaled median',async()=>{ctx.fetch=async()=>{clock+=100;return {type:'opaque'}};const r=await run('Zt("example.org",2400)');assert.equal(r.ms,100);assert.equal(r.samples,3)});
await test('Worker-only response is not client healthy',()=>{run('var r={ip:"172.67.181.32",ms:null,browser_state:"native-required"};scanMerge(r,{edge_ms:1,worker_reachable:true,alive:false,is_cf:true});');assert.equal(ctx.r.healthy,false);assert.equal(ctx.r.cloudflare_verified,false);assert.equal(ctx.r.worker_reachable,true)});
await test('Worker identity alone is not client healthy',()=>{run('scanMerge(r,{edge_ms:5,worker_reachable:true,alive:true,is_cf:true})');assert.equal(ctx.r.cloudflare_verified,true);assert.equal(ctx.r.healthy,false)});
await test('opaque browser response alone is not Cloudflare verified',()=>{run('r={ip:"example.org",ms:100,browser_state:"measured"};scanMerge(r,{edge_ms:1,worker_reachable:true,alive:false,is_cf:false})');assert.equal(ctx.r.healthy,false)});
await test('browser and Cloudflare identity required for web result',()=>{run('scanMerge(r,{edge_ms:20,worker_reachable:true,alive:true,is_cf:true})');assert.equal(ctx.r.healthy,true)});
await test('CIDR /32 returns its only address',()=>assert.deepEqual([...run('Rt("172.67.181.32/32",8)')],['172.67.181.32']));
await test('CIDR addresses align to network not host offset',()=>{const a=[...run('Rt("172.67.181.32/24",8)')];assert.equal(a[0],'172.67.181.1');assert(a.every(x=>x.startsWith('172.67.181.')))});
await test('invalid CIDR rejected',()=>assert.equal(run('Rt("999.67.181.32/24",8)').length,0));
await test('v6 empty selection does not silently scan IPv4',async()=>{elements.get('#scan-ranges').value='172.67.181.32';ctx.O.ipVer='v6';await run('Wt({settings:{}})');assert.equal(rankCalls,0);assert.equal(ctx.O.results.length,0);assert.equal(ctx.O.running,false)});
await test('raw-IP scan finishes at 100 percent without browser fetch',async()=>{ctx.O.ipVer='both';await run('Wt({settings:{}})');assert.equal(ctx.O.results.length,1);assert.equal(ctx.O.results[0].healthy,false);assert.equal(ctx.O.results[0].worker_reachable,true);assert.equal(elements.get('#scan-bar').style.width,'100%');assert.equal(elements.get('#scan-apply').disabled,true);assert.equal(elements.get('#scan-save-trial').disabled,false)});
await test('trial save requires explicit confirmation',async()=>{accepted=false;await run('Kt({settings:{clean_ips:["104.17.148.17"]},setSettings(){}},true)');assert.equal(saved.length,0)});
await test('confirmed trial save merges not overwrites known addresses',async()=>{accepted=true;await run('Kt({settings:{clean_ips:["104.17.148.17"]},setSettings(){}},true)');assert.deepEqual([...saved[0].clean_ips],['104.17.148.17','172.67.181.32']);assert.equal(saved[0].ipv6_enabled,undefined)});
await test('stale results are not applied',async()=>{ctx.O.results[0].checked_at=Date.now()-400000;await run('Kt({settings:{},setSettings(){}},true)');assert.equal(saved.length,1)});
await test('settings rejection releases busy lock',async()=>{await run('Wt({settings:async()=>{throw new Error("settings offline")}})');assert.equal(ctx.O.running,false);assert(ctx.O.scanError.includes('settings offline'))});
await test('Worker API failure is visible rather than silent zero',async()=>{ctx.b.rankIps=async()=>{throw new Error('API unavailable')};await run('Wt({settings:{}})');assert.equal(ctx.O.running,false);assert(notices.at(-1).includes('API unavailable'));assert.equal(elements.get('#scan-bar').style.width,'100%')});
fs.writeFileSync(new URL('unit-test-results.json',root),JSON.stringify(tests,null,2));
console.log(`${tests.length} scanner regression tests passed`);
