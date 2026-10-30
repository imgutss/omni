// rev154 builder — current WARP registration + race/state fixes; rev153 is rollback.
const fs = require('fs');
const crypto = require('crypto');
const ROOT = '/home/user/omni-fix/';
let js = fs.readFileSync(ROOT + 'omni.v93.js', 'utf8');
const warp = fs.readFileSync(ROOT + '.warp_v94.js', 'utf8');
let html = fs.readFileSync(ROOT + 'panel.v94.final.html', 'utf8');
const must = (count, label, expected = 1) => { if (count !== expected) throw new Error(`anchor count ${count} (expected ${expected}) for ${label}`); };
function rep(oldText, newText, label, expected = 1) {
  must(js.split(oldText).length - 1, label, expected);
  js = js.split(oldText).join(newText);
}

// Replace only the obsolete registrar; surrounding account/status functions stay intact.
const registerStart = 'async function omniWarpRegister(){';
const legacyMarker = 'var OMNI_LEGACY_WARP_KEY =';
const start = js.indexOf(registerStart);
must(start < 0 ? 0 : 1, 'legacy registrar start');
const end = js.indexOf(legacyMarker, start);
if (end < 0) throw new Error('legacy key marker not found');
js = js.slice(0, start) + warp + '\n' + js.slice(end);

rep(`async function omniRotateLegacyWarp(env2,settings){
 const cur=await omniWarpAccountCurrent(env2);
 if(!cur||String(cur.privateKey||"")!==OMNI_LEGACY_WARP_KEY)return {rotated:false,account:cur};
 try{
  const acc=await omniWarpRegister();
  await putSetting(env2,"warp_gaming_account",JSON.stringify(acc));
  return {rotated:true,account:acc};
 }catch(e){return {rotated:false,error:String(e&&e.message||e)};}
}`, `async function omniRotateLegacyWarp(env2,settings){
 const cur=await omniWarpAccountCurrent(env2);
 if(!cur||String(cur.privateKey||"")!==OMNI_LEGACY_WARP_KEY)return {rotated:false,account:cur};
 try{
  const result=await omniWarpGenerateAccount(env2,{force:true});
  return {rotated:true,account:result.account};
 }catch(e){return {rotated:false,error:String(e&&e.message||e)};}
}`, 'legacy rotation uses single-flight registrar');

rep(' const reply=(data,status=200)=>Response.json(data,{status,headers:{\'cache-control\':\'no-store\'}});',
    ' const reply=(data,status=200,extraHeaders={})=>Response.json(data,{status,headers:{...extraHeaders,\'cache-control\':\'no-store\'}});',
    'gaming/billing replies support optional headers', 2);
rep('return reply({ok:true,account:acc,needsKey:!(acc&&acc.privateKey),legacy:!!(acc&&String(acc.privateKey||\'\')===OMNI_LEGACY_WARP_KEY),falix:fx,railwayTcp:tcp});',
    'return reply({ok:true,account:omniWarpPublicAccount(acc),needsKey:!(acc&&acc.privateKey),legacy:!!(acc&&String(acc.privateKey||\'\')===OMNI_LEGACY_WARP_KEY),falix:fx,railwayTcp:tcp});',
    'status never exposes registration bearer token');

const oldGenerate = ` if(p==='/api/gaming/w\\u0061rp/generate'){
  if(request.method!=='POST')return reply({ok:false,error:'\\u0631\\u0648\\u0634 \\u0646\\u0627\\u0645\\u0639\\u062a\\u0628\\u0631 \\u0627\\u0633\\u062a.'},405);
  try{
   const acc=await omniWarpRegister();
   await putSetting(env2,'w\\u0061rp_gaming_account',JSON.stringify(acc));
   return reply({ok:true,account:acc});
  }catch(e){return reply({ok:false,error:String(e&&e.message||e).slice(0,200)},502);}
 }`;
const newGenerate = ` if(p==='/api/gaming/w\\u0061rp/generate'){
  if(request.method!=='POST')return reply({ok:false,error:'\\u0631\\u0648\\u0634 \\u0646\\u0627\\u0645\\u0639\\u062a\\u0628\\u0631 \\u0627\\u0633\\u062a.'},405);
  const b=await readJson();
  try{
   const result=await omniWarpGenerateAccount(env2,{force:b.force===true});
   return reply({ok:true,account:omniWarpPublicAccount(result.account),reused:!!result.reused,coalesced:!!result.coalesced,registrationApi:OMNI_WARP_API_VERSION});
  }catch(e){
   const status=Number(e&&e.httpStatus)||502,retryAfter=Number(e&&e.retryAfter)||0;
   return reply({ok:false,error:String(e&&e.message||e).slice(0,300),code:String(e&&e.code||'warp_registration_failed'),retryAfter,upstreamStatus:Number(e&&e.upstreamStatus)||0,preserved:true},status,retryAfter?{'retry-after':String(retryAfter)}:{});
  }
 }`;
rep(oldGenerate, newGenerate, 'generate route uses validated single-flight flow');

// Keep the device bearer token server-side while retaining the private key needed
// by the administrator's WireGuard output.
rep(`  for (const r of ro\\u0077s.results || [])
    out[r.key] = r.value;
  return out;`, `  for (const r of ro\\u0077s.results || [])
    out[r.key] = r.value;
  if(out.warp_gaming_account){
   try{out.warp_gaming_account=JSON.stringify(omniWarpPublicAccount(JSON.parse(out.warp_gaming_account)));}catch{}
  }
  return out;`, 'cached/admin settings omit WARP registration token');

rep('    if (patch.path && !String(patch.path).startsWith("/"))',
    '    await omniWarpPreserveSettingsPatch(env2, patch);\n    if (patch.path && !String(patch.path).startsWith("/"))',
    'settings writes cannot overwrite a newer WARP key');

// Splice the patched self-contained panel.
const oldAttr = 'data-build="8ae833599a220f69225fe0ea24111234"';
must(html.split(oldAttr).length - 1, 'source panel data-build');
const preliminaryMd5 = crypto.createHash('md5').update(html, 'utf8').digest('hex');
html = html.replace(oldAttr, `data-build="${preliminaryMd5}"`);
// OMNI_BUILD/data-build use the same pre-splice build ID convention as rev152/153.
const panelMd5 = preliminaryMd5;
const panelBytes = Buffer.byteLength(html, 'utf8');
const marker = 'var panel_default = "';
const markerIndex = js.indexOf(marker);
if (markerIndex < 0) throw new Error('panel_default marker not found');
const literalStart = markerIndex + marker.length - 1;
let i = literalStart + 1, escaped = false;
for (; i < js.length; i++) {
  const ch = js[i];
  if (escaped) { escaped = false; continue; }
  if (ch === '\\') { escaped = true; continue; }
  if (ch === '"') break;
}
const literal = JSON.stringify(html);
if (JSON.parse(literal) !== html) throw new Error('panel literal roundtrip failed');
js = js.slice(0, literalStart) + literal + js.slice(i + 1);

const buildRe = /var OMNI_BUILD = \{ v: "60\.1", bytes: \d+, md5: "[a-f0-9]+", rev: 153, at: "2026-10-29" \};/;
must((js.match(buildRe) || []).length, 'rev153 OMNI_BUILD');
js = js.replace(buildRe, `var OMNI_BUILD = { v: "60.1", bytes: ${panelBytes}, md5: "${panelMd5}", rev: 154, at: "2026-10-30" };`);

if (js.includes('�') || html.includes('�')) throw new Error('U+FFFD introduced');
if (js.includes('v0a2158/reg') || js.includes('a-6.11-2223')) throw new Error('obsolete WARP fingerprint remains');
for (const token of ['v0a5641', 'a-6.38.9-5641', 'omniWarpGenerateAccount', 'omniWarpPreserveSettingsPatch', 'rev: 154']) {
  if (!js.includes(token)) throw new Error('missing postcondition: ' + token);
}
const out = ROOT + 'omni.v94.js';
fs.writeFileSync(out, js);
console.log(JSON.stringify({
  output: 'omni.v94.js', rev: 154,
  bytes: Buffer.byteLength(js, 'utf8'),
  workerMd5: crypto.createHash('md5').update(js, 'utf8').digest('hex'),
  workerSha256: crypto.createHash('sha256').update(js, 'utf8').digest('hex'),
  panelBytes, panelMd5,
  rollback: 'omni.v93.js'
}, null, 2));
