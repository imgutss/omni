// rev152 static worker gate — expanded v4 pack (865) + generic-clean pack (139); the
// rev150 RFC 8484 DoH engine is byte-retained (panel-only release).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const acorn = require(path.join(__dirname, '.dom', 'node_modules', 'acorn'));
const js = fs.readFileSync('omni.v92.js', 'utf8');
const panel = fs.readFileSync('panel.v92.final.html', 'utf8');
let fails = 0;
const ok = (c, l) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + l); if (!c) fails++; };
const count = (s, sub) => s.split(sub).length - 1;

ok(!js.includes('�'), 'no U+FFFD replacement chars in worker');
acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'module' });
ok(true, 'worker parses as ES module (acorn latest)');

/* rev150 RFC 8484 wire engine retained untouched */
for (const fn of ['omniDnsB64Url', 'omniDnsEncodeName', 'omniDnsBuildQuery', 'omniDnsReadName', 'omniDnsParseMessage']) {
  ok(count(js, 'function ' + fn + '(') === 1, fn + ' retained exactly once');
}
ok(js.includes('?dns=" + omniDnsB64Url(wire)') && js.includes('application/dns-message'), 'wire DoH request path retained');
ok(js.includes('if (p2 === "/api/diag/dns-batch" && method === "POST")') && js.includes('const CONC = 6;'), 'batch route + caps retained');
ok(js.includes('.filter((s) => /^https:\\/\\/[a-z0-9.-]+(?::\\d+)?\\//i.test(s.url) && s.id)'), 'URL filter regex intact');
ok(count(js, 'async function omniDnsResolveUrl(') === 1, 'single shared resolver core');

/* older revs retained */
ok(count(js, 'async function omniFetchEchRecord(') === 1 && js.includes('if (p2 === "/api/ech-config" && request.method === "GET")'), 'rev148 ECH surface retained');
ok(js.includes('async function meshReachability(') && js.includes('omni.outbound.v1') && js.includes('obProbeEps'), 'rev146/147 mesh+outbound retained');

/* build + embedded panel integrity */
const buildM = js.match(/var OMNI_BUILD = \{ v: "60\.1", bytes: (\d+), md5: "([a-f0-9]{32})", rev: (\d+), at: "([^"]+)" \};/);
ok(!!buildM && buildM[3] === '152', 'OMNI_BUILD rev 152 present');
const marker = 'var panel_default = "';
const mIdx = js.indexOf(marker);
ok(mIdx >= 0, 'panel_default literal found');
const litStart = mIdx + marker.length - 1;
let li = litStart + 1, lesc = false;
for (; li < js.length; li++) {
  if (lesc) { lesc = false; continue; }
  if (js[li] === '\\') { lesc = true; continue; }
  if (js[li] === '"') break;
}
const embedded = JSON.parse(js.slice(litStart, li + 1));
const standaloneRawMd5 = crypto.createHash('md5').update(panel, 'utf8').digest('hex');
ok(standaloneRawMd5 === buildM[2], 'OMNI_BUILD md5 equals standalone panel md5 (' + standaloneRawMd5.slice(0, 12) + ')');
const normalized = panel.split('data-build="8ae833599a220f69225fe0ea24111234"').join('data-build="' + buildM[2] + '"');
ok(embedded === normalized, 'embedded panel byte-identical after data-build normalization');

/* rev151 geo-honest panel markers */
ok(count(embedded, 'function dnsGeoBlocked(') === 1, 'dnsGeoBlocked helper present once');
ok(embedded.includes('فقط داخل ایران') && embedded.includes('st.geoIr'), 'geo badge + stats bucket embedded');
ok(embedded.includes('VPN خاموش'), 'VPN-off guidance embedded');
ok(embedded.includes('178.22.122.100') && !embedded.includes('178.22.122.122'), 'Shecan official IP corrected');
ok(embedded.includes('توقف سرویس از اسفند ۱۴۰۳'), '403 discontinuation note embedded');
ok(embedded.includes('!dnsGeoBlocked(s.id)'), 'hide-dead exempts geo-unreachable IR cards');
ok(embedded.includes('کد خام لبهٔ جهانی'), 'raw HTTP code preserved in inspector');
/* content verdicts must never be swallowed by the geo label */
ok(embedded.includes('c.verdict === "http-error" || c.verdict === "no-answer"'), 'geo classification limited to transport failures');
/* rev149/150 panel features retained */
ok(embedded.includes('omni.dns.v1') && embedded.includes('/api/diag/dns-batch') && embedded.includes('data-dns-haystack'), 'rev149 DNS view core retained');
ok(embedded.includes('st.httpError') && embedded.includes('st.nxdomain') && embedded.includes('st.noAnswer'), 'rev150 granular stats retained');
ok(embedded.includes('omni.ech.v1') && embedded.includes('omni.mesh.v6'), 'ECH card and mesh store untouched');

/* rev152 pack repository expansion */
const packUser = [...embedded.matchAll(/var OMNI_SEED_V4_USER = \[([^\]]+)\];/g)].map(m => [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]));
const packClean = [...embedded.matchAll(/var OMNI_SEED_V4_CLEAN = \[([^\]]+)\];/g)].map(m => [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]));
ok(packUser.length === 2 && packUser.every(a => a.length === 865 && new Set(a).size === 865), 'embedded user v4 pack: two sites, 865 unique each');
ok(packClean.length === 2 && packClean.every(a => a.length === 139 && new Set(a).size === 139), 'embedded clean pack: two sites, 139 unique each');
ok(JSON.stringify(packUser[0]) === JSON.stringify(packUser[1]) && JSON.stringify(packClean[0]) === JSON.stringify(packClean[1]), 'embedded paired declaration sites identical');
ok(!packClean[0].some(ip => new Set(packUser[0]).has(ip)), 'user and clean packs are disjoint');
ok(embedded.includes("g.pack==='userclean'") && embedded.includes('key === "userclean"') && embedded.includes('OMNI_SEED_V4_CLEAN'), 'userclean pack fully wired (builder + omniPackIps + array)');
ok(embedded.includes('۸۶۵') && embedded.includes('۱۳۹') && !embedded.includes('۲۵۵'), 'pack counts relabeled 865/139, stale 255 gone');

console.log(fails ? '\nGATE FAIL ' + fails : '\nGATE ALL PASS');
process.exit(fails ? 1 : 0);
