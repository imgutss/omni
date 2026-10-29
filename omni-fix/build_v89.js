// v89 builder — rev149: root rebuild of the DNS/DoH view (rich catalog, two
// honest measurement columns, reference verdicts, persisted state).
const fs = require('fs');
const crypto = require('crypto');

let html = fs.readFileSync('/home/user/omni-fix/panel.v89.final.html', 'utf8');
if (html.includes('�')) throw new Error('panel contains U+FFFD');

const OLD_ATTR = 'data-build="8ae833599a220f69225fe0ea24111234"';
if (html.split(OLD_ATTR).length - 1 !== 1) throw new Error('data-build anchor count != 1');
const NEW_MD5 = crypto.createHash('md5').update(html, 'utf8').digest('hex');
html = html.split(OLD_ATTR).join(`data-build="${NEW_MD5}"`);

let js = fs.readFileSync('/home/user/omni-fix/omni.v89.base.js', 'utf8');
const must = (n, label) => { if (n !== 1) throw new Error(`replace count ${n} for ${label}`); };

const marker = 'var panel_default = "';
const mIdx = js.indexOf(marker);
if (mIdx < 0) throw new Error('panel_default marker not found');
const litStart = mIdx + marker.length - 1;
let i = litStart + 1, esc = false;
for (; i < js.length; i++) {
  const ch = js[i];
  if (esc) { esc = false; continue; }
  if (ch === '\\') { esc = true; continue; }
  if (ch === '"') break;
}
const newLiteral = JSON.stringify(html);
if (JSON.parse(newLiteral) !== html) throw new Error('new literal roundtrip failed');
js = js.slice(0, litStart) + newLiteral + js.slice(i + 1);
console.log('panel_default spliced; literal bytes=', Buffer.byteLength(newLiteral, 'utf8'));

const oldBuildLine = 'var OMNI_BUILD = { v: "60.1", bytes: 1213557, md5: "b16fd58c3f132f0dd05dbcc722410bef", rev: 148, at: "2026-10-28" };';
must(js.split(oldBuildLine).length - 1, 'OMNI_BUILD rev148 line');
js = js.replace(oldBuildLine,
  `var OMNI_BUILD = { v: "60.1", bytes: ${Buffer.byteLength(html, 'utf8')}, md5: "${NEW_MD5}", rev: 149, at: "2026-10-28" };`);

if (js.includes('�')) throw new Error('worker contains U+FFFD after splice');
fs.writeFileSync('/home/user/omni-fix/omni.v89.js', js);
console.log('omni.v89.js written; bytes=', Buffer.byteLength(js, 'utf8'),
  'md5(worker)=', crypto.createHash('md5').update(js, 'utf8').digest('hex'),
  'panel md5=', NEW_MD5);
