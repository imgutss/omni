// rev149 static worker gate — DNS batch core, honest verdict model, regex
// regression guards (template-literal escape bug), panel integrity, rev retention.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const acorn = require(path.join(__dirname, '.dom', 'node_modules', 'acorn'));
const js = fs.readFileSync('omni.v89.js', 'utf8');
const panel = fs.readFileSync('panel.v89.final.html', 'utf8');
let fails = 0;
const ok = (c, l) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + l); if (!c) fails++; };
const count = (s, sub) => s.split(sub).length - 1;

ok(!js.includes('�'), 'no U+FFFD replacement chars in worker');
acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'module' });
ok(true, 'worker parses as ES module (acorn latest)');

/* rev149 — DNS measurement core */
ok(count(js, 'async function omniDnsResolveUrl(') === 1, 'omniDnsResolveUrl defined exactly once');
ok(count(js, 'function omniDnsClassify(') === 1, 'omniDnsClassify defined exactly once');
ok(count(js, 'function omniDnsIsBogon(') === 1, 'omniDnsIsBogon defined exactly once');
ok(count(js, 'async function omniDnsReference(') === 1, 'omniDnsReference defined exactly once');
ok(js.includes('if (p2 === "/api/diag/dns-batch" && method === "POST")'), 'POST /api/diag/dns-batch route mounted');
ok(js.includes('const CONC = 6;'), 'batch concurrency capped at 6');
ok(js.includes('.slice(0, 32)'), 'batch server list capped at 32');
ok(js.includes('/^[a-z0-9.-]{2,253}$/.test(qname)') && js.includes('422'), 'qname regex validation with 422');
for (const v of ['"poisoned"', '"divergent"', '"nxdomain"', '"empty"', '"http-error"', '"no-answer"', '"ok"']) {
  ok(js.includes('verdict: ' + v) || js.includes(v), 'verdict literal present: ' + v);
}
ok(js.includes('ms: ms > 0 ? ms : 1'), 'worker ms forced strictly positive');
ok(js.includes('signal: AbortSignal.timeout(7000)'), '7s DoH timeout (honest no-answer on stall)');

/* regression guards — the template-literal escape collapse bug */
ok(js.includes('.filter((s) => /^https:\\/\\/[a-z0-9.-]+(?::\\d+)?\\//i.test(s.url) && s.id)'), 'batch URL filter regex intact (escaped slashes + \\d port)');
ok(!js.includes('(?::d+)?'), 'no collapsed :d+ port pattern');
ok(js.includes('.map((a) => String(a.data || "").replace(/\\.$/, "").trim())'), 'trailing-dot strip regex intact (\\.$ not .$)');
ok(js.includes('if (!/^\\d{1,3}(?:\\.\\d{1,3}){3}$/.test(String(ip))) return false;'), 'bogon IPv4 regex intact');

/* legacy GET retrofit keeps old contract and gains verdict fields */
ok(js.includes('if (p2 === "/api/diag/dns" && method === "GET")'), 'legacy GET /api/diag/dns retained');
ok(js.includes('ref_ips: refIps') && js.includes('compared: cls.compared'), 'legacy response gains reference+compared fields');

/* rev148 ECH surface retained */
ok(count(js, 'async function omniFetchEchRecord(') === 1, 'rev148 omniFetchEchRecord retained');
ok(js.includes('if (p2 === "/api/ech-config" && request.method === "GET")'), 'rev148 /api/ech-config route retained');
ok(js.includes("throw new Error('BAD_DOMAIN')") && js.includes("throw new Error('NO_ECH')"), 'rev148 honest ECH error codes retained');

/* rev147/146 behavior retained */
ok(js.includes('async function meshReachability('), 'rev146 meshReachability retained');
ok(js.includes('omni.outbound.v1') && js.includes('obProbeEps'), 'rev147 outbound engine retained');

/* build metadata + embedded panel integrity */
const buildM = js.match(/var OMNI_BUILD = \{ v: "60\.1", bytes: (\d+), md5: "([a-f0-9]{32})", rev: (\d+), at: "([^"]+)" \};/);
ok(!!buildM && buildM[3] === '149', 'OMNI_BUILD rev 149 present');
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
ok(embedded === normalized, 'embedded panel byte-identical to standalone after data-build normalization');

/* rev149 DNS view embedded; old DNS internals gone */
ok(embedded.includes('omni.dns.v1') && embedded.includes('/api/diag/dns-batch'), 'embedded panel carries rev149 DNS engine');
for (const id of ['"cf"', '"shecan"', '"electro"', '"radar"', '"begzar"', '"f403"', '"quad9"', '"nextdns"']) {
  ok(embedded.includes('id: ' + id), 'catalog entry present: ' + id);
}
ok(count(embedded, 'id: "') >= 20, 'at least 20 resolver catalog entries embedded');
for (const gone of ['async function Qt(', 'function dnsVerdictBadge(', 'omni-dns-test', 'omni-dns-probe"', 'OMNI_ECH_OK']) {
  ok(!embedded.includes(gone), 'old remnant gone: ' + gone);
}
ok(embedded.includes('omni.ech.v1') && embedded.includes('omni.mesh.v6'), 'rev148 ECH card and rev146 mesh store untouched');

console.log(fails ? '\nGATE FAIL ' + fails : '\nGATE ALL PASS');
process.exit(fails ? 1 : 0);
