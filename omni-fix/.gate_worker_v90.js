// rev150 static worker gate — RFC 8484 binary DoH codec, batch route retained,
// panel integrity, rev146–149 retention.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const acorn = require(path.join(__dirname, '.dom', 'node_modules', 'acorn'));
const js = fs.readFileSync('omni.v90.js', 'utf8');
const panel = fs.readFileSync('panel.v90.final.html', 'utf8');
let fails = 0;
const ok = (c, l) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + l); if (!c) fails++; };
const count = (s, sub) => s.split(sub).length - 1;

ok(!js.includes('�'), 'no U+FFFD replacement chars in worker');
acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'module' });
ok(true, 'worker parses as ES module (acorn latest)');

/* rev150 — RFC 8484 wire codec */
for (const fn of ['omniDnsB64Url', 'omniDnsEncodeName', 'omniDnsBuildQuery', 'omniDnsReadName', 'omniDnsParseMessage']) {
  ok(count(js, 'function ' + fn + '(') === 1, fn + ' defined exactly once');
}
ok(js.includes('hv.setUint16(2, 0x0100)') && js.includes('tv.setUint16(0, qtype === "AAAA" ? 28 : 1)'), 'wire header flags + QTYPE A/AAAA encoding');
ok(js.includes('(len & 0xc0) === 0xc0'), 'QNAME compression pointers handled');
ok(js.includes('?dns=" + omniDnsB64Url(wire)'), 'DoH request carries base64url dns= parameter');

const diagIdx = js.indexOf('async function omniDnsResolveUrl(');
const diag = js.slice(diagIdx, diagIdx + 1800);
ok(diag.includes('application/dns-message') && !diag.includes('application/dns-json'), 'diag resolver speaks wire media type, not legacy JSON');
ok(diag.includes('new Uint8Array(await r2.arrayBuffer())') && diag.includes('msg.rcode === 3'), 'binary response parsed with honest NXDOMAIN rcode');
ok(diag.includes('ms: ms > 0 ? ms : 1'), 'worker ms still forced strictly positive');
ok(diag.includes('signal: AbortSignal.timeout(7000)'), '7s DoH timeout retained');

/* rev149 batch contract retained */
ok(js.includes('if (p2 === "/api/diag/dns-batch" && method === "POST")'), 'POST /api/diag/dns-batch route retained');
ok(js.includes('const CONC = 6;') && js.includes('.slice(0, 32)'), 'batch caps retained (32 servers, concurrency 6)');
ok(js.includes('/^[a-z0-9.-]{2,253}$/.test(qname)'), 'qname regex validation retained');
ok(js.includes('.filter((s) => /^https:\\/\\/[a-z0-9.-]+(?::\\d+)?\\//i.test(s.url) && s.id)'), 'batch URL filter regex intact (no escape regression)');
for (const v of ['"poisoned"', '"divergent"', '"nxdomain"', '"empty"', '"http-error"', '"no-answer"']) {
  ok(js.includes(v), 'verdict literal retained: ' + v);
}
ok(count(js, 'async function omniDnsResolveUrl(') === 1 && count(js, 'function omniDnsClassify(') === 1 && count(js, 'async function omniDnsReference(') === 1, 'single shared resolver core (no duplicated DNS stacks)');
ok(js.includes('if (p2 === "/api/diag/dns" && method === "GET")'), 'legacy GET /api/diag/dns retained');

/* older revs retained */
ok(count(js, 'async function omniFetchEchRecord(') === 1 && js.includes('if (p2 === "/api/ech-config" && request.method === "GET")'), 'rev148 ECH surface retained');
ok(js.includes('async function meshReachability(') && js.includes('omni.outbound.v1') && js.includes('obProbeEps'), 'rev146/147 mesh+outbound retained');

/* build + embedded panel integrity */
const buildM = js.match(/var OMNI_BUILD = \{ v: "60\.1", bytes: (\d+), md5: "([a-f0-9]{32})", rev: (\d+), at: "([^"]+)" \};/);
ok(!!buildM && buildM[3] === '150', 'OMNI_BUILD rev 150 present');
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

/* rev150 panel markers + rev149 view retained */
ok(embedded.includes('st.httpError') && embedded.includes('st.nxdomain') && embedded.includes('st.noAnswer') && embedded.includes('خطای HTTP:'), 'granular DNS stats embedded');
ok(embedded.includes('omni.dns.v1') && embedded.includes('/api/diag/dns-batch') && embedded.includes('data-dns-haystack'), 'rev149 DNS view core retained');
ok(!embedded.includes('v(st.dead)'), 'old single dead bucket gone');
ok(embedded.includes('omni.ech.v1') && embedded.includes('omni.mesh.v6'), 'ECH card and mesh store untouched');

console.log(fails ? '\nGATE FAIL ' + fails : '\nGATE ALL PASS');
process.exit(fails ? 1 : 0);
