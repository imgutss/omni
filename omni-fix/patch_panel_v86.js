// rev146 panel patch — route-aware worker labels, rebuilt three-layer diag, live-variants bootstrap.
const fs = require('fs');
let html = fs.readFileSync('/home/user/omni-fix/panel.v85.final.html', 'utf8');
const edits = [];

const engine = fs.readFileSync('/home/user/omni-fix/.mesh_engine_v86.js', 'utf8').replace(/\n$/, '');
const mIdx = html.indexOf('  var MESH = {');
if (mIdx < 0) throw new Error('var MESH boundary not found');
const banner = html.lastIndexOf('  /* ═══', mIdx);
if (banner < 0 || mIdx - banner > 1600) throw new Error('MESH banner boundary not found');
const endMarker = '\n\n  function MeshView(e) {';
const ei = html.indexOf(endMarker, mIdx);
if (ei < 0) throw new Error('MeshView boundary not found');
html = html.slice(0, banner) + engine + html.slice(ei);
edits.push('engine block replaced (rev145 -> rev146)');

const view = fs.readFileSync('/home/user/omni-fix/.mesh_view_v86.js', 'utf8').replace(/\n$/, '');
const vStart = html.indexOf('function MeshView(e) {');
if (vStart < 0) throw new Error('MeshView start not found');
let d = 0, started = false, vEnd = vStart;
for (; vEnd < html.length; vEnd++) {
  const c = html[vEnd];
  if (c === '{') { d++; started = true; }
  else if (c === '}') { d--; if (started && d === 0) { vEnd++; break; } }
}
html = html.slice(0, vStart) + view + html.slice(vEnd);
edits.push('MeshView replaced');

/* external dispatcher: bootstrap live variants from the best measured endpoint */
const dispatchAnchor = `        } else if (i === "omni-mesh-apply") {
          await meshApply(e, s.dataset.ep || "");
        }`;
if (html.split(dispatchAnchor).length - 1 !== 1) throw new Error('dispatcher anchor count != 1');
html = html.split(dispatchAnchor).join(`        } else if (i === "omni-mesh-apply") {
          await meshApply(e, s.dataset.ep || "");
        } else if (i === "omni-mesh-apply-best") {
          await meshApplyBest(e);
        }`);
edits.push('omni-mesh-apply-best dispatcher branch');

if (html.includes('omni.mesh.v5')) throw new Error('old mesh store key survived');
if (!html.includes('omni.mesh.v6')) throw new Error('new mesh store key missing');
if (!html.includes('meshApplyBest')) throw new Error('meshApplyBest missing');
if (!html.includes('meshDnsCheck')) throw new Error('multi-provider DNS missing');
if (!html.includes('exitRoute')) throw new Error('route evidence missing');

fs.writeFileSync('/home/user/omni-fix/panel.v86.final.html', html);
console.log('PANEL PATCH rev146 OK —', edits.join(' | '), '| bytes=', Buffer.byteLength(html, 'utf8'));
