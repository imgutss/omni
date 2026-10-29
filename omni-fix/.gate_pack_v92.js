// rev152 structural gate — pack repository integrity on panel + embedded worker.
const fs = require('fs');
const path = require('path');

const ROOT = '/home/user/omni-fix';
const user865 = JSON.parse(fs.readFileSync('/home/user/rev152/user865.json', 'utf8'));
const clean139 = JSON.parse(fs.readFileSync('/home/user/rev152/clean139.json', 'utf8'));
const oldPanel = fs.readFileSync(path.join(ROOT, 'panel.v91.final.html'), 'utf8');
const oldUser = [...oldPanel.match(/var OMNI_SEED_V4_USER = \[([^\]]+)\];/)[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ok  ' + msg); }
  else { fail++; console.log('FAIL  ' + msg); }
}

function extractArrays(src, label) {
  const u = [...src.matchAll(/var OMNI_SEED_V4_USER = \[([^\]]+)\];/g)].map(m => [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]));
  const c = [...src.matchAll(/var OMNI_SEED_V4_CLEAN = \[([^\]]+)\];/g)].map(m => [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]));
  console.log(`\n[${label}] user sites=${u.length} clean sites=${c.length}`);
  ok(u.length === 2, label + ': two OMNI_SEED_V4_USER declaration sites');
  ok(c.length === 2, label + ': two OMNI_SEED_V4_CLEAN declaration sites');
  if (u.length === 2) ok(JSON.stringify(u[0]) === JSON.stringify(u[1]), label + ': both user-array sites identical');
  if (c.length === 2) ok(JSON.stringify(c[0]) === JSON.stringify(c[1]), label + ': both clean-array sites identical');
  const U = u[0] || [], C = c[0] || [];

  ok(U.length === 865, label + `: user pack length 865 (got ${U.length})`);
  ok(new Set(U).size === U.length, label + ': user pack has zero duplicates');
  ok(C.length === 139, label + `: clean pack length 139 (got ${C.length})`);
  ok(new Set(C).size === C.length, label + ': clean pack has zero duplicates');

  // every uploaded unique IP is present exactly once
  ok(user865.every(ip => U.filter(x => x === ip).length === 1), label + ': all 865 server-file IPs present exactly once');
  ok(clean139.every(ip => C.filter(x => x === ip).length === 1), label + ': all 139 clean-file IPs present exactly once');
  // no pre-existing IP lost, and original 255 keep their exact order as prefix
  ok(oldUser.every((ip, i) => U[i] === ip), label + ': original 255 retained verbatim as ordered prefix');
  // disjoint groups
  const uset = new Set(U);
  ok(C.every(ip => !uset.has(ip)), label + ': clean pack disjoint from user pack');
  // all bare valid IPv4
  const v4 = ip => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(ip);
  ok([...U, ...C].every(v4), label + ': every entry is a bare valid IPv4');

  // wiring
  ok(src.includes("else if(g.pack==='userclean'){items=[...OMNI_SEED_V4_CLEAN];}"), label + ': zt pack branch for userclean');
  ok(src.includes('["userclean", "📁 IPهای تمیز عمومی · ۱۳۹"]'), label + ': pack chip for userclean');
  ok(src.includes('["userv4", "📦 IPv4های تو · ۸۶۵"]'), label + ': userv4 chip relabeled to 865');
  ok(src.includes("userclean: 'IPهای تمیز عمومی · ۱۳۹ (غیرکلادفلر)'"), label + ': selection-info label map entry');
  ok(src.includes('var V4C = (typeof OMNI_SEED_V4_CLEAN !== "undefined" && OMNI_SEED_V4_CLEAN) || G.OMNI_SEED_V4_CLEAN || [];'), label + ': omniPackIps V4C handle');
  ok(src.includes('if (key === "userclean") return { label: "فهرست IPهای تمیز عمومی غیرکلادفلر (۱۳۹)'), label + ': omniPackIps userclean metadata');
  ok(src.includes('if (key === "userv4") return { label: "فهرست IPv4 تمیز تو (۸۶۵)"'), label + ': omniPackIps userv4 relabeled to 865');
  ok(!src.includes('۲۵۵'), label + ': no stale 255 label anywhere');
  // rev151 retention markers
  ok(src.includes('function dnsGeoBlocked(id)'), label + ': rev151 dnsGeoBlocked retained');
  ok(src.includes('178.22.122.100'), label + ': rev151 Shecan resolver retained');
  ok(src.includes('☁ فقط داخل ایران'), label + ': rev151 geo badge retained');
  return { U, C };
}

const panel = fs.readFileSync(path.join(ROOT, 'panel.v92.final.html'), 'utf8');
const p = extractArrays(panel, 'standalone panel');

// embedded worker: pull panel_default literal and JSON-parse it back to html
const worker = fs.readFileSync(path.join(ROOT, 'omni.v92.js'), 'utf8');
const marker = 'var panel_default = "';
const s = worker.indexOf(marker);
ok(s >= 0, 'worker: panel_default marker present');
let i = s + marker.length - 1 + 1, esc = false, lit = '';
for (; i < worker.length; i++) {
  const ch = worker[i];
  if (esc) { lit += '\\' + ch; esc = false; continue; }
  if (ch === '\\') { esc = true; continue; }
  if (ch === '"') break;
  lit += ch;
}
const embedded = JSON.parse('"' + lit + '"');
ok(embedded.includes('data-build="032799ad4dee372868515a790f642cde"'), 'worker: embedded panel carries fresh data-build md5');
const e = extractArrays(embedded, 'embedded worker panel');
ok(JSON.stringify(p.U) === JSON.stringify(e.U) && JSON.stringify(p.C) === JSON.stringify(e.C), 'standalone and embedded arrays identical');

const buildLine = worker.match(/var OMNI_BUILD = \{[^}]*\};/)[0];
ok(buildLine.includes('rev: 152') && buildLine.includes('md5: "032799ad4dee372868515a790f642cde"'), 'worker: OMNI_BUILD rev152 + panel md5: ' + buildLine);

console.log(`\nPACK GATE: ${fail ? 'FAIL' : 'ALL PASS'} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
