// rev148 worker patch — generic ECH HTTPS-record endpoint + shared DoH helper.
// rev147 behavior is fully retained; the railway-auto ech-config route now delegates
// to the same helper so both surfaces stay byte-consistent.
const fs = require('fs');
let js = fs.readFileSync('/home/user/omni-fix/omni.v87.js', 'utf8');
const edits = [];
function rep(oldT, newT, label, expect = 1) {
  const n = js.split(oldT).length - 1;
  if (n !== expect) throw new Error(`anchor count ${n} (expected ${expect}) for: ${label}`);
  js = js.split(oldT).join(newT);
  edits.push(label);
}

/* W1 — shared DoH ECH record resolver, placed right before the railway wizard API */
const wizardAnchor = 'async function omniRwWizardApi(request,env,ctx,url,account,settings){';
if (js.split(wizardAnchor).length - 1 !== 1) throw new Error('wizard API anchor count != 1');
const helper = `async function omniFetchEchRecord(rawDomain){
 const echDomain=String(rawDomain==null?'':rawDomain).trim().toLowerCase();
 if(!/^[a-z0-9][a-z0-9.-]{1,78}[a-z0-9]$/.test(echDomain)||echDomain.indexOf('.')<0||echDomain.indexOf('..')>=0)throw new Error('BAD_DOMAIN');
 const doh=async u=>{try{const r=await fetch(u,{headers:{accept:'application/dns-json'}});if(!r.ok)return null;return await r.json();}catch(e){return null;}};
 let dns=await doh('https://cloudflare-dns.com/dns-query?type=HTTPS&name='+encodeURIComponent(echDomain));
 if(!dns||!Array.isArray(dns.Answer))dns=await doh('https://dns.google/resolve?type=HTTPS&name='+encodeURIComponent(echDomain));
 let ech='',alpn=[],hints=[];
 for(const rec of((dns&&dns.Answer)||[])){
  if(rec.type!==65)continue;
  const data=String(rec.data||'');
  const mEch=data.match(/ech=(\\S+)/);if(mEch)ech=mEch[1];
  const mAlpn=data.match(/alpn=([^\\s]+)/);if(mAlpn)alpn=mAlpn[1].split(',');
  const mHint=data.match(/ipv4hint=([^\\s]+)/);if(mHint)hints=mHint[1].split(',');
 }
 if(!ech)throw new Error('NO_ECH');
 return {domain:echDomain,ech,alpn,hints,source:'doh-https-record'};
}
async function omniRwWizardApi(request,env,ctx,url,account,settings){`;
rep(wizardAnchor, helper, 'shared omniFetchEchRecord helper added');

/* W2 — railway route delegates to the shared helper (same response contract) */
const oldRwBranch = `  if(path==='ech-config'&&request.method==='GET'){
   const echDomain=String(url.searchParams.get('domain')||'').trim().toLowerCase();
   if(!/^[a-z0-9.-]{3,80}$/.test(echDomain))return omniRwWizardJson({ok:false,error:'دامنهٔ معتبر نیست.'},400);
   const doh=async u=>{try{const r=await fetch(u,{headers:{accept:'application/dns-json'}});if(!r.ok)return null;return await r.json();}catch(e){return null;}};
   let dns=await doh('https://cloudflare-dns.com/dns-query?type=HTTPS&name='+encodeURIComponent(echDomain));
   if(!dns||!Array.isArray(dns.Answer))dns=await doh('https://dns.google/resolve?type=HTTPS&name='+encodeURIComponent(echDomain));
   let ech='',alpn=[],hints=[];
   for(const rec of((dns&&dns.Answer)||[])){if(rec.type!==65)continue;const data=String(rec.data||'');const mEch=data.match(/ech=(\\S+)/);if(mEch)ech=mEch[1];const mAlpn=data.match(/alpn=([^\\s]+)/);if(mAlpn)alpn=mAlpn[1].split(',');const mHint=data.match(/ipv4hint=([^\\s]+)/);if(mHint)hints=mHint[1].split(',');}
   if(!ech)return omniRwWizardJson({ok:false,error:'ECH در رکورد HTTPS دامنه پیدا نشد؛ ECH باید روی دامنهٔ Cloudflare فعال باشد.'},404);
   return omniRwWizardJson({ok:true,domain:echDomain,ech,alpn,hints,source:'doh-https-record'});
  }`;
const newRwBranch = `  if(path==='ech-config'&&request.method==='GET'){
   try{const rec=await omniFetchEchRecord(url.searchParams.get('domain')||'');return omniRwWizardJson({ok:true,...rec});}
   catch(ew){const code=String(ew.message)==='BAD_DOMAIN'?400:404;return omniRwWizardJson({ok:false,error:code===400?'دامنهٔ معتبر نیست.':'ECH در رکورد HTTPS دامنه پیدا نشد؛ ECH باید روی دامنهٔ Cloudflare فعال باشد.'},code);}
  }`;
rep(oldRwBranch, newRwBranch, 'railway ech-config delegates to helper');

/* W3 — generic authenticated panel route /api/ech-config */
const mountAnchor = '  if (p2.startsWith("/api/r\\u0061ilway-auto/")) return omniRwWizardApi(request, env2, ctx, url, account, settings);';
if (js.split(mountAnchor).length - 1 !== 1) throw new Error('railway mount anchor count != 1');
const newRoute = `  if (p2 === "/api/ech-config" && request.method === "GET") {
    try { const echRec = await omniFetchEchRecord(url.searchParams.get("domain") || ""); return json({ ok: true, ...echRec }); }
    catch (e3) { const echCode = String(e3.message) === "BAD_DOMAIN" ? 400 : 404; return json({ ok: false, error: echCode === 400 ? "دامنهٔ معتبر نیست." : "ECH در رکورد HTTPS دامنه پیدا نشد؛ ECH باید روی دامنهٔ Cloudflare فعال باشد." }, echCode); }
  }
${mountAnchor}`;
rep(mountAnchor, newRoute, 'generic /api/ech-config session route mounted');

if (js.includes('�')) throw new Error('U+FFFD after patch');
fs.writeFileSync('/home/user/omni-fix/omni.v88.base.js', js);
console.log('worker patches applied:', edits.join(' | '));
console.log('omni.v88.base.js bytes=', Buffer.byteLength(js, 'utf8'));
