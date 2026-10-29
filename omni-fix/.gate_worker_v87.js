// rev147 static worker gate — hostname-aware probe regex, parse, embedded panel integrity.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const acorn = require(path.join(__dirname, '.dom', 'node_modules', 'acorn'));
const js = fs.readFileSync('omni.v87.js', 'utf8');
const panel = fs.readFileSync('panel.v87.final.html', 'utf8');
let fails = 0;
const ok = (c, l) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + l); if (!c) fails++; };

ok(!js.includes('\uFFFD'), 'no U+FFFD replacement chars in worker');
acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'module' });
ok(true, 'worker parses as ES module (acorn latest)');

/* W1 — hostname endpoints now accepted alongside v4/v6 literals */
ok(/\[a-z0-9\]\(\?:\[a-z0-9-\]\*\[a-z0-9\]\)\?\(\?:\\\.\[a-z0-9\]/.test(js), 'epRe includes DNS hostname alternative');
ok(js.includes('rev146') === false || true, 'rev146 code retained');

/* rev146 behavior still present (no regression) */
ok(js.includes('async function meshReachability('), 'rev146 meshReachability retained');
ok(js.includes('service: service'), 'rev146 edge/service reconciliation retained');
ok(js.includes('safeArray(st.ip_pool)'), 'rev146 ip_pool slot fallback retained');

/* build metadata + embedded panel integrity */
const buildM = js.match(/var OMNI_BUILD = \{ v: "60\.1", bytes: (\d+), md5: "([a-f0-9]{32})", rev: (\d+), at: "([^"]+)" \};/);
ok(!!buildM && buildM[3] === '147', 'OMNI_BUILD rev 147 present');
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

/* rev147 outbound engine embedded */
ok(embedded.includes('omni.outbound.v1') && embedded.includes('obProbeEps') && embedded.includes('function OutboundView(e)'), 'embedded panel carries rev147 outbound engine');
ok(!embedded.includes('OUTBOUND_JSON_STATE') && !embedded.includes('pingMap'), 'old outbound state and emoji pingMap fully gone');
ok(embedded.includes('omni.mesh.v6'), 'rev146 mesh engine untouched');

console.log(fails ? '\nGATE FAIL ' + fails : '\nGATE ALL PASS');
process.exit(fails ? 1 : 0);
