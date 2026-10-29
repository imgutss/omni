// rev149 panel patch — root rebuild of the DNS view: rich catalog, two honest
// measurement columns, verdicts against reference, persisted state, search/filter/sort.
const fs = require('fs');
let html = fs.readFileSync('/home/user/omni-fix/panel.v88.final.html', 'utf8');
const edits = [];
function rep(oldT, newT, label, expect = 1) {
  const n = html.split(oldT).length - 1;
  if (n !== expect) throw new Error(`anchor count ${n} (expected ${expect}) for: ${label}`);
  html = html.split(oldT).join(newT);
  edits.push(label);
}

/* 1) catalog: replace the old 14-entry Ut array with the rev149 rich catalog */
const catStart = '    Ut = [\n      {\n        name: "Cloudflare (1.1.1.1)",';
const catEnd = '    ],\n    Nt = (e) => btoa(unescape(encodeURIComponent(e)));';
const i0 = html.indexOf(catStart);
const i1 = html.indexOf(catEnd);
if (i0 < 0 || i1 < 0 || i1 < i0) throw new Error('Ut catalog anchors not found');
const catalog = fs.readFileSync('/home/user/omni-fix/.dns_catalog_v89.js', 'utf8').replace(/\n$/, '');
html = html.slice(0, i0) + catalog + '\n    Nt = (e) => btoa(unescape(encodeURIComponent(e)));' + html.slice(i1 + catEnd.length);
edits.push('DNS catalog replaced with 20 rich entries');

/* 2) replace ze/Qt/dnsVerdictBadge/device probes block with engine + new view */
const blockStart = 'function ze(e) {';
const blockEndMarker = '/* =========================================================================\n     \u{1F1EE}\u{1F1F7} OMNI / NATIONAL INTERNET BYPASS';
const b0 = html.indexOf(blockStart);
const b1 = html.indexOf(blockEndMarker);
if (b0 < 0 || b1 < 0 || b1 < b0) throw new Error('DNS function block anchors not found');
const engine = fs.readFileSync('/home/user/omni-fix/.dns_engine_v89.js', 'utf8').replace(/\n$/, '');
const view = fs.readFileSync('/home/user/omni-fix/.dns_view_v89.js', 'utf8').replace(/\n$/, '');
html = html.slice(0, b0) + engine + '\n' + view + '\n' + html.slice(b1);
edits.push('DNS engine + DnsView replaced the old function block');

/* 3) replace the four old click branches */
const oldHandlers = `        else if (i === "omni-dns") {
          await b.saveSettings({ dns_upstream: s.dataset.url });
          e.setSettings({ ...e.settings(), dns_upstream: s.dataset.url });
          y(n("dns.saved"), "ok");
          e.rerender();
        } else if (i === "omni-dns-test") {
          let o = document.querySelector(\`#dnst-\${s.dataset.key}\`);
          o && (o.innerHTML = '<span class="badge">…</span>');
          let r = await Qt(s.dataset.url);
          o && (o.innerHTML = dnsVerdictBadge(r, ""));
        } else if (i === "omni-dns-probe") {
          await dnsRunDeviceAll();
        } else if (i === "omni-dns-all") {
          await dnsRunWorkerAll();
        } else if (i === "omni-cfg-build") Gt(e.S());`;
let handlers = fs.readFileSync('/home/user/omni-fix/.dns_handlers_v89.js', 'utf8').replace(/\n$/, '');
handlers = handlers.replace(/^        \} else if/, '        else if');
rep(oldHandlers, handlers + '\n        } else if (i === "omni-cfg-build") Gt(e.S());', 'DNS click chain replaced');

/* integrity gates */
for (const gone of ['async function Qt(', 'function dnsVerdictBadge(', 'async function dnsDeviceProbe(', 'const dnsKey =', 'omni-dns-test', 'omni-dns-probe",', 'id="dnst-', 'id="dnsd-']) {
  if (html.includes(gone)) throw new Error('old DNS remnant still present: ' + gone);
}
for (const must of ['omni.dns.v1', 'omni-dns-wall', 'omni-dns-dall', 'omni-dns-wtest', 'omni-dns-dtest', 'omni-dns-region', 'omni-dns-sort', '/api/diag/dns-batch', 'OMNI_DNS_VERDICTS', 'data-dns-details']) {
  if (!html.includes(must)) throw new Error('rev149 DNS missing: ' + must);
}
if (html.indexOf('�') >= 0) throw new Error('U+FFFD in panel');

fs.writeFileSync('/home/user/omni-fix/panel.v89.final.html', html);
console.log('panel patches applied:', edits.join(' | '));
console.log('panel.v89.final.html bytes=', Buffer.byteLength(html, 'utf8'),
  'md5=', require('crypto').createHash('md5').update(html, 'utf8').digest('hex'));
