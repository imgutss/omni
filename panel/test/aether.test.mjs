import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../src/panel.html',import.meta.url),'utf8');
const targetBlock=html.match(/var AETHER_TARGETS = \[[\s\S]*?\n  \];/);
const uriBlock=html.match(/function aetherUri\(t\) \{[\s\S]*?\n  \}/);
assert(targetBlock && uriBlock);
const ctx=vm.createContext({encodeURIComponent});
vm.runInContext(`${targetBlock[0]}\n${uriBlock[0]}`,ctx);
const targets=ctx.AETHER_TARGETS;
const expected={
 'wireguard':['wg'], 'warp-in-warp':['gool'],
 'masque-h2':['masque','h2'], 'masque-h3':['masque','h3'],
 'mim-h2':['mim','h2'], 'mim-h3':['mim','h3'],
 'wg-masque-h2':['wg-over-masque','h2'], 'wg-masque-h3':['wg-over-masque','h3'],
 'warp-psiphon':['masque','h2','psiphon','chain'],
 'psiphon-warp':['masque','h2','psiphon','reverse'],
 'psiphon-only':['masque','h2','psiphon','only'],
 'warp-tor':['masque','h2','tor','chain'],
 'tor-warp':['masque','h2','tor','reverse'],
 'tor-only':['masque','h2','tor','only'],
};
test('Aether profiles use app protocol names and no fixed endpoint',()=>{
 assert.equal(targets.length,Object.keys(expected).length);
 assert.equal(new Set(targets.map(x=>x.id)).size,targets.length);
 for(const t of targets){
  const values=expected[t.id];assert(values,t.id);
  const url=new URL(ctx.aetherUri(t));assert.equal(url.protocol,'aether:');assert.equal(url.hostname,'');
  assert.equal(url.searchParams.get('protocol'),values[0],t.id);
  if(values[1]) assert.equal(url.searchParams.get('transport'),values[1],t.id);
  if(values[2]) assert.equal(url.searchParams.get(values[2]),values[3],t.id);
  assert.equal(url.searchParams.get('scan'),'balanced');assert.equal(url.searchParams.get('ip'),'both');
  assert(!url.searchParams.has('outer'));assert(!url.searchParams.has('inner'));
  assert.equal(decodeURIComponent(url.hash.slice(1)),t.title);
  if(['reverse'].includes(url.searchParams.get('psiphon'))||['reverse'].includes(url.searchParams.get('tor')))assert(['masque','mim','wg-over-masque'].includes(url.searchParams.get('protocol')));
 }
});
test('requested links and panel-only Aether UI are present; game publishing card is removed',()=>{
 assert(html.includes('https://bot-hosting.net/dash/developer'));
 assert(html.includes('https://panel.arvancloud.ir/profile/iam/machine-users'));
 assert(html.includes('در O&#109;ni App وارد کنید'));
 assert(!html.includes('gaming-publish-sub'));
 assert(!html.includes('کانفیگ گیم'));
 assert(!targetBlock[0].includes('همراه اول'));
 assert(!targetBlock[0].includes('2606:'));
});
test('all inline panel scripts parse',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi)];
 assert(scripts.length>0);
 for(const [i,m] of scripts.entries())new vm.Script(m[1],{filename:`panel-script-${i}.js`});
});
