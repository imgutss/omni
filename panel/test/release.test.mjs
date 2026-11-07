import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,webcrypto} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {parse} from 'acorn';
const NODE_EXE=process.execPath;
const NODE_ENV={...process.env};
const source=fs.readFileSync(new URL('../build/worker.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../src/panel.html',import.meta.url),'utf8').replaceAll('__OMNI_PRODUCT_VERSION__',JSON.parse(fs.readFileSync(new URL('../release.json',import.meta.url),'utf8')).version).replaceAll('__OMNI_PRODUCT_REVISION__',String(JSON.parse(fs.readFileSync(new URL('../release.json',import.meta.url),'utf8')).revision));
const manifest=JSON.parse(fs.readFileSync(new URL('../build/manifest.json',import.meta.url),'utf8'));
const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
const declarations=ast.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[]);
const release=JSON.parse(fs.readFileSync(new URL('../release.json',import.meta.url),'utf8'));
const buildNode=declarations.find(n=>n.id.name==='OMNI_BUILD');
const build=vm.runInNewContext('('+source.slice(buildNode.init.start,buildNode.init.end)+')');
const fn=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return source.slice(n.start,n.end)};
test('canonical output is valid JavaScript and contains exactly the editable panel',()=>{
 const panel=declarations.find(n=>n.id.name==='panel_default');assert.equal(panel.init.value,html);
 assert.equal(build.v,release.version);assert.equal(build.rev,release.revision);assert.equal(build.bytes,Buffer.byteLength(source));
 assert(!source.includes('__OMNI_PANEL_HTML__'));assert(!source.includes('__OMNI_BUILD_METADATA__'));
});
test('artifact hashes match the release manifest',()=>{
 for(const name of ['worker.js','panel.html']){
  const data=fs.readFileSync(new URL('../build/'+name,import.meta.url));
  assert.equal(data.length,manifest.artifacts[name].bytes);
  assert.equal(createHash('sha256').update(data).digest('hex'),manifest.artifacts[name].sha256);
 }
});
test('rebuilding produces identical bytes',()=>{
 const r=spawnSync(NODE_EXE,['panel/build.mjs'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.equal(fs.readFileSync(new URL('../build/worker.js',import.meta.url),'utf8'),source);
});
test('revision ordering survives the public semantic-version reset',()=>{
 const needs=vm.runInNewContext('('+fn('panelNeedsUpgrade')+')',{OMNI_BUILD:build});
 assert.equal(needs({v:'60.6',rev:162}),true);
 assert.equal(needs({v:release.version,rev:release.revision-1}),true);
 assert.equal(needs({v:release.version,rev:release.revision}),false);
 assert.equal(needs({v:'future',rev:release.revision+1}),false);
 assert.equal(needs(null),true);
});
test('session cookies keep HTTPS, HttpOnly and same-site protections',()=>{
 const cookie=vm.runInNewContext('('+fn('sessionCookie')+')',{SESSION_COOKIE:'sid'})('sample');
 for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert(cookie.includes(flag));
});
test('scheduled child upgrades are explicitly opt-in',()=>{
 assert.match(fn('scheduledTasks'),/if \(String\(env2\.OMNI_AUTO_UPGRADE \|\| ""\) === "1"\) ctx\.waitUntil/);
});
test('bot diagnostics are admin-only before reading diagnostic settings',()=>{
 const f=fn('handleApi');assert(f.indexOf('healthAccount.role !== "admin"')<f.indexOf('const stH = await allSettings'));
});
test('webhook repair registers the Telegram authentication header',()=>{
 const f=fn('checkOrRepairPanelWebhook');assert(f.includes('secret_token: pathSecret'));
 assert(!f.includes('|| "omni-hook"'));
});
// Load the real bundle. Stub ONLY platform imports, not bot or HTTP handlers.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'omni-release-'));
let local=source;
for(const n of ast.body.filter(n=>n.type==='ImportDeclaration').reverse()){
 if(n.source.value.startsWith("node:"))continue;
 assert(['cloudflare:sockets','cloudflare:workers'].includes(n.source.value),'unexpected platform import');
 const body=n.specifiers.map(s=>{
  if(s.imported?.name==='connect')return `const ${s.local.name}=()=>{throw Error('unexpected network socket in offline test')};`;
  if(s.imported?.name==='DurableObject')return `class ${s.local.name}{constructor(ctx,env){this.ctx=ctx;this.env=env}}`;
  throw Error('unsupported platform import');
 }).join('\n');local=local.slice(0,n.start)+body+local.slice(n.end);
}
if(!globalThis.crypto)globalThis.crypto=webcrypto;
fs.writeFileSync(path.join(temp,'worker.mjs'),local);
const nodeProcess=globalThis.process;
const module=await import(pathToFileURL(path.join(temp,'worker.mjs')).href);
globalThis.process=nodeProcess; // the Workers bundle includes its own process shim

const worker=module.default;
test('real fetch handler serves health without touching D1',async()=>{
 const r=await worker.fetch(new Request('https://test.invalid/healthz'),{},{});
 assert.equal(r.status,200);assert.equal(await r.text(),'ok');
});
test('real fetch handler rejects missing, weak, wrong-path and forged webhooks',async()=>{
 const secret='test-only-webhook-secret-12345678';
 for(const [env,p,header] of [
  [{},secret,secret],
  [{BOT_WEBHOOK_SECRET:'omni-hook'},'omni-hook','omni-hook'],
  [{BOT_WEBHOOK_SECRET:secret},'wrong-secret',secret],
  [{BOT_WEBHOOK_SECRET:secret},secret,''],
  [{BOT_WEBHOOK_SECRET:secret},secret,'forged-header'],
 ]){
  const r=await worker.fetch(new Request('https://test.invalid/tg/'+p,{method:'POST',headers:{'x-telegram-bot-api-secret-token':header},body:'{"update_id":1}'}),env,{});
  assert.equal(r.status,403);
 }
});
test('real fetch handler accepts an authenticated empty Telegram update',async()=>{
 const secret='test-only-webhook-secret-12345678';
 const r=await worker.fetch(new Request('https://test.invalid/tg/'+secret,{method:'POST',headers:{'x-telegram-bot-api-secret-token':secret,'content-type':'application/json'},body:'{}'}),{BOT_WEBHOOK_SECRET:secret},{});
 assert.equal(r.status,200);assert.equal(await r.text(),'ok');
});
test('unsafe deployment is blocked by default',()=>{
 const env={...NODE_ENV};delete env.OMNI_ALLOW_DEPLOY;delete env.OMNI_WRANGLER_CONFIG;
 const r=spawnSync(NODE_EXE,['panel/deploy.mjs'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',env});
 assert.equal(r.status,1);assert(r.stderr.includes('Deployment stopped'));
});
test.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
