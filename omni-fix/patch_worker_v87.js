// rev147 worker patch — /api/mesh/probe accepts DNS hostname endpoints (outbound full-URI hosts).
const fs = require('fs');
let js = fs.readFileSync('/home/user/omni-fix/omni.v86.js', 'utf8');
const edits = [];
function rep(oldT, newT, label, expect = 1) {
  const n = js.split(oldT).length - 1;
  if (n !== expect) throw new Error(`anchor count ${n} (expected ${expect}) for: ${label}`);
  js = js.split(oldT).join(newT);
  edits.push(label);
}

/* W1 — mesh probe endpoint regex now accepts hostname:port (VLESS/Trojan/SOCKS URI hosts),
   while keeping v4 literal and bracketed v6. Hostnames are non-CF, so probeOne's
   tcpProbe path handles them with the runtime's DNS resolution. */
rep(
  `    const epRe = /^(\\[[0-9a-fA-F:]+\\]|[0-9]{1,3}(?:\\.[0-9]{1,3}){3}):(\\d{1,5})$/;`,
  `    const epRe = /^(\\[[0-9a-fA-F:]+\\]|[0-9]{1,3}(?:\\.[0-9]{1,3}){3}|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+):(\\d{1,5})$/i;`,
  'W1 epRe accepts hostnames alongside v4/v6 literals'
);

fs.writeFileSync('/home/user/omni-fix/omni.v87.base.js', js);
console.log('WORKER PATCH rev147 OK —', edits.length, 'edits:\n ' + edits.map((x, i) => `${i + 1}. ${x}`).join('\n '));
