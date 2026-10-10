// Pure serialization/validation tests. These do NOT test an Iranian route.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const source=fs.readFileSync(new URL('../../tools/vps-profile.js',import.meta.url),'utf8');
const validation=fs.readFileSync(new URL('../../tools/vps-validate.js',import.meta.url),'utf8');
const {vpsUriOf,vpsProofKey,vpsTaskPayload}=new Function(source+'\n'+validation+'\nreturn {vpsUriOf,vpsProofKey,vpsTaskPayload};')();
const n={id:1,ip:'1.1.1.1'};
const p={kind:'ws',uuid:'11111111-1111-4111-8111-111111111111',domain:'relay.example.com',address:'snapp.ir',path:'/vzn',via_cdn:true,fake_sni:'snapp.ir',spoof_ip:'1.1.1.1'};
const normal=new URL(vpsUriOf(n,p)),spoof=new URL(vpsUriOf(n,p,true));
assert.equal(normal.hostname,'snapp.ir');
for(const u of [normal,spoof]) {
 assert.equal(u.searchParams.get('sni'),'relay.example.com');
 assert.equal(u.searchParams.get('host'),'relay.example.com');
 assert.equal(u.searchParams.get('allowInsecure'),'0');
 assert.equal(u.searchParams.get('alpn'),'http/1.1');
 assert.equal(u.searchParams.get('path'),'/vzn');
}
assert.equal(normal.searchParams.has('snispoofing'),false);
assert.deepEqual(JSON.parse(spoof.searchParams.get('snispoofing')),{active:true,fakeSni:'snapp.ir',spoofIp:'1.1.1.1',targetPort:0});
assert.notEqual(vpsProofKey(n,p),vpsProofKey(n,p,true));
assert.notEqual(vpsProofKey(n,p),vpsProofKey(n,{...p,address:'edge.example.com'}));
assert.equal(vpsUriOf(n,{...p,uuid:''}), '');
assert.equal(vpsUriOf(n,{...p,fake_sni:''},true),'');
assert.equal(new URL(vpsUriOf(n,{...p,address:'2606:4700::1111'})).hostname,'[2606:4700::1111]');
assert.equal(vpsTaskPayload(p).address,'snapp.ir');
for(const bad of [
 {kind:'shell',cmd:'id'}, {kind:'ws',domain:'example.com;id'},
 {...p,spoof_ip:'127.0.0.1'}, {...p,spoof_ip:'snapp.ir'},
 {...p,address:'localhost'}, {...p,path:'/a?ed=2048'}, {...p,via_cdn:false},
 {kind:'reality'}, {kind:'reality',sni:'example.com',port:70000}
])assert.throws(()=>vpsTaskPayload(bad),JSON.stringify(bad));
for(const name of ['worker.js','panel.html']) {
 const text=fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
 assert.equal(text.split('// VPS-PROFILES-BEGIN\n')[1].split('// VPS-PROFILES-END')[0].trim(),source.trim());
}
const worker=fs.readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const literal=worker.match(/^var VPS_AGENT_SH = (".*");$/m)?.[1];
assert(literal,'installer is a JSON literal, not an interpolation-prone template');
const sh=JSON.parse(literal);
assert.equal(spawnSync('bash',['-n'],{input:sh}).status,0,'served shell is syntactically valid');
const py=sh.split("<<'OMNI_AGENT_PY_EOF'\n")[1].split('\nOMNI_AGENT_PY_EOF')[0];
assert.equal(spawnSync('python3',['-c','import sys; compile(sys.stdin.read(),"served-agent","exec")'],{input:py}).status,0);
assert(sh.includes('omni-vps-agent.service'));
assert.equal(sh.split('Omni-VPS-Agent/10.1').length-1,2,'both join and poll/report must avoid Cloudflare blocking Python default UA');
assert(!sh.includes('__AGENT_PY__'));
console.log('VPS profile/validation/served-installer tests PASS (no live carrier test)');
