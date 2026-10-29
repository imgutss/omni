// rev148 static worker gate — ECH endpoint/helper, parse, embedded panel integrity.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const acorn = require(path.join(__dirname, '.dom', 'node_modules', 'acorn'));
const js = fs.readFileSync('omni.v88.js', 'utf8');
const panel = fs.readFileSync('panel.v88.final.html', 'utf8');
let fails = 0;
const ok = (c, l) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + l); if (!c) fails++; };
const count = (s, sub) => s.split(sub).length - 1;

ok(!js.includes('�'), 'no U+FFFD replacement chars in worker');
acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'module' });
ok(true, 'worker parses as ES module (acorn latest)');

/* rev148 — ECH surface */
ok(count(js, 'async function omniFetchEchRecord(') === 1, 'shared omniFetchEchRecord helper defined exactly once');
ok(js.includes('if (p2 === "/api/ech-config" && request.method === "GET")'), 'generic /api/ech-config session route mounted');
ok(js.includes("path==='ech-config'") && js.includes('await omniFetchEchRecord('), 'railway ech-config route retained and delegates to helper');
ok(js.includes("throw new Error('BAD_DOMAIN')") && js.includes("throw new Error('NO_ECH')"), 'honest domain/not-found error codes');
ok(count(js, 'cloudflare-dns.com/dns-query?type=HTTPS') === 1 && count(js, 'dns.google/resolve?type=HTTPS') === 1, 'single DoH implementation shared by both routes');

/* rev147/146 behavior retained (no regression) */
ok(js.includes('async function meshReachability('), 'rev146 meshReachability retained');
ok(js.includes('omni.outbound.v1') && js.includes('obProbeEps'), 'rev147 outbound engine retained');
ok(/\[a-z0-9\]\(\?:\[a-z0-9-\]\*\[a-z0-9\]\)\?\(\?:\\\.\[a-z0-9\]/.test(js), 'rev147 hostname-aware epRe retained');

/* build metadata + embedded panel integrity */
const buildM = js.match(/var OMNI_BUILD = \{ v: "60\.1", bytes: (\d+), md5: "([a-f0-9]{32})", rev: (\d+), at: "([^"]+)" \};/);
ok(!!buildM && buildM[3] === '148', 'OMNI_BUILD rev 148 present');
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

/* rev148 ECH library embedded; old gate/constant gone */
ok(embedded.includes('omni.ech.v1') && embedded.includes('function omniEchCardHtml(') && embedded.includes('omni-cfg-ech-refresh'), 'embedded panel carries rev148 ECH card');
ok(!embedded.includes('OMNI_ECH_OK') && !embedded.includes('OMNI_ECH_B64'), 'old workers.dev gate and hardcoded constant gone');
ok(embedded.includes('query_server_name') && embedded.includes('ech-opts:') && embedded.includes('-----BEGIN ECH CONFIGS-----'), 'all three documented client output shapes present');
ok(embedded.includes('omni.mesh.v6'), 'rev146 mesh store untouched');

console.log(fails ? '\nGATE FAIL ' + fails : '\nGATE ALL PASS');
process.exit(fails ? 1 : 0);
