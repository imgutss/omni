// rev146 static worker gate — parse + root-fix presence + embedded panel integrity.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const acorn = require(path.join(__dirname, '.dom', 'node_modules', 'acorn'));
const js = fs.readFileSync('omni.v86.js', 'utf8');
const panel = fs.readFileSync('panel.v86.final.html', 'utf8');
let fails = 0;
const ok = (c, l) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + l); if (!c) fails++; };

ok(!js.includes('\uFFFD'), 'no U+FFFD replacement chars in worker');
acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'module' });
ok(true, 'worker parses as ES module (acorn latest)');

/* W1 — route-aware subrequest + unified reachability */
ok(/async function subrequestProbe\(host, \{[^}]*routeHost[^}]*routePath/.test(js), 'subrequestProbe accepts routeHost/routePath');
ok(/headers\.Host\s*=/.test(js), 'real Host header sent on routed subrequest');
ok(/async function meshReachability\(host, port, opts/.test(js), 'meshReachability unified helper exists');
ok(/function meshRouteSettings\(st\)/.test(js), 'meshRouteSettings derives Host/path from settings');

/* W2 — probe endpoint threads route settings */
const probeBlock = js.slice(js.indexOf('"/api/mesh/probe"'), js.indexOf('"/api/mesh/probe"') + 2200);
ok(probeBlock.includes('meshRouteSettings(pst)') && probeBlock.includes('routeHost, routePath'), 'probe endpoint uses settings-derived route');

/* W3 — exit endpoint rebuilt on own port, no more httpProbe/443 */
const exitIdx = js.indexOf('"/api/mesh/exit"');
const exitBlock = js.slice(exitIdx, exitIdx + 2800);
ok(exitBlock.includes('meshReachability(host, port') && exitBlock.includes('scope: "worker-own-port"'), 'exit probes own port via unified helper');
ok(!/httpProbe\(/.test(exitBlock), 'exit no longer uses strict httpProbe');
ok(exitBlock.includes('route') && exitBlock.includes('colo') && exitBlock.includes('via'), 'exit returns full evidence (route/colo/via)');
ok(exitBlock.includes('service: service'), 'exit reconciles edge answer with real service hostname probe');

/* W4 — live slots bootstrap from configured IP pool (no hardcoded seeds restored) */
const candIdx = js.indexOf('function mesh2CandidateList');
const candBlock = js.slice(candIdx, candIdx + 1800);
ok(candBlock.includes('safeArray(st.ip_pool)') && candBlock.includes('مخزن IP'), 'candidate list falls back to configured ip_pool');
ok(!/188\.114|104\.16|2606:4700/.test(candBlock), 'no hardcoded IP seeds reintroduced in candidate list');

/* W5 — cron uses real own-port probe shape */
const cronIdx = js.indexOf('async function mesh2Cron');
const cronBlock = js.slice(cronIdx, cronIdx + 2600);
ok(cronBlock.includes('meshReachability(mesh2Host(s.ep)'), 'cron probes each slot via meshReachability');
ok(!/httpProbe\(/.test(cronBlock), 'cron no longer uses strict httpProbe');
ok(/p\.state === "open" \|\| p\.state === "handshake"/.test(cronBlock), 'cron liveness based on real probe state');

/* build metadata + embedded panel integrity */
const buildM = js.match(/var OMNI_BUILD = \{ v: "60\.1", bytes: (\d+), md5: "([a-f0-9]{32})", rev: (\d+), at: "([^"]+)" \};/);
ok(!!buildM && buildM[3] === '146', 'OMNI_BUILD rev 146 present');
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
const embMd5 = crypto.createHash('md5').update(embedded, 'utf8').digest('hex');
ok(embedded === normalized && embMd5 === crypto.createHash('md5').update(normalized, 'utf8').digest('hex'),
  'embedded panel byte-identical to standalone after data-build normalization');
ok(embedded.includes('omni.mesh.v6') && embedded.includes('meshApplyBest') && embedded.includes('meshDnsCheck'), 'embedded panel carries rev146 mesh engine');
ok(!embedded.includes('omni.mesh.v5'), 'old mesh store key fully gone from embedded panel');

console.log(fails ? '\nGATE FAIL ' + fails : '\nGATE ALL PASS');
process.exit(fails ? 1 : 0);
