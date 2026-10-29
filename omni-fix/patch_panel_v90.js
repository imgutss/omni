// rev150 panel patch — granular DNS failure stats (HTTP/NXDOMAIN/empty/no-answer
// split instead of one bucket) and explicit HTTP status on worker badges.
const fs = require('fs');
let html = fs.readFileSync('/home/user/omni-fix/panel.v89.final.html', 'utf8');
const edits = [];
function rep(oldT, newT, label, expect = 1) {
  const n = html.split(oldT).length - 1;
  if (n !== expect) throw new Error(`anchor count ${n} (expected ${expect}) for: ${label}`);
  html = html.split(oldT).join(newT);
  edits.push(label);
}

rep(
  `    const out = { total: rows.length, ok: 0, divergent: 0, poisoned: 0, dead: 0, fastest: null };
    for (const c of rows) {
      if (c.verdict === "ok") {
        out.ok++;
        if (c.ms && (!out.fastest || c.ms < out.fastest.ms)) out.fastest = c;
      } else if (c.verdict === "divergent") out.divergent++;
      else if (c.verdict === "poisoned") out.poisoned++;
      else out.dead++;
    }`,
  `    const out = { total: rows.length, ok: 0, divergent: 0, poisoned: 0, httpError: 0, nxdomain: 0, empty: 0, noAnswer: 0, fastest: null };
    for (const c of rows) {
      if (c.verdict === "ok") {
        out.ok++;
        if (c.ms && (!out.fastest || c.ms < out.fastest.ms)) out.fastest = c;
      } else if (c.verdict === "divergent") out.divergent++;
      else if (c.verdict === "poisoned") out.poisoned++;
      else if (c.verdict === "http-error") out.httpError++;
      else if (c.verdict === "nxdomain") out.nxdomain++;
      else if (c.verdict === "empty") out.empty++;
      else out.noAnswer++;
    }`,
  'dnsStats granular buckets'
);

rep(
  `    const meta = OMNI_DNS_VERDICTS[c.verdict] || { cls: "warn", fa: c.verdict || "—" };
    const msTxt = c.ms ? " · " + v(c.ms) + "ms" : "";`,
  `    const meta = OMNI_DNS_VERDICTS[c.verdict] || { cls: "warn", fa: c.verdict || "—" };
    const msTxt = c.ms ? " · " + v(c.ms) + "ms" : "";
    const httpTxt = c.verdict === "http-error" && c.error ? " · " + c.error : "";`,
  'http status text var'
);

rep(
  `    return \`<span class="badge \${meta.cls}" dir="ltr" title="\${a(tip)}">☁ \${a(meta.fa)}\${msTxt}</span>\`;`,
  `    return \`<span class="badge \${meta.cls}" dir="ltr" title="\${a(tip)}">☁ \${a(meta.fa)}\${a(httpTxt)}\${msTxt}</span>\`;`,
  'http status rendered in worker badge'
);

rep(
  `      <span class="badge ok">سالم: \${v(st.ok)}</span>
      <span class="badge info">متفاوت: \${v(st.divergent)}</span>
      \${st.poisoned ? \`<span class="badge danger">آلوده: \${v(st.poisoned)}</span>\` : ""}
      <span class="badge danger">بی‌پاسخ: \${v(st.dead)}</span>`,
  `      <span class="badge ok">سالم: \${v(st.ok)}</span>
      <span class="badge info">متفاوت: \${v(st.divergent)}</span>
      \${st.poisoned ? \`<span class="badge danger">آلوده: \${v(st.poisoned)}</span>\` : ""}
      \${st.httpError ? \`<span class="badge danger">خطای HTTP: \${v(st.httpError)}</span>\` : ""}
      \${st.nxdomain ? \`<span class="badge warn">NXDOMAIN: \${v(st.nxdomain)}</span>\` : ""}
      \${st.empty ? \`<span class="badge danger">بدون رکورد: \${v(st.empty)}</span>\` : ""}
      \${st.noAnswer ? \`<span class="badge danger">بی‌پاسخ: \${v(st.noAnswer)}</span>\` : ""}`,
  'granular stats badges'
);

if (html.includes('�')) throw new Error('U+FFFD in panel');
for (const must of ['st.httpError', 'st.nxdomain', 'st.empty', 'st.noAnswer', 'httpTxt']) {
  if (!html.includes(must)) throw new Error('missing rev150 panel marker: ' + must);
}
if (html.includes('v(st.dead)')) throw new Error('old dead bucket still referenced');

fs.writeFileSync('/home/user/omni-fix/panel.v90.final.html', html);
console.log('panel patches applied:', edits.join(' | '));
console.log('panel.v90.final.html bytes=', Buffer.byteLength(html, 'utf8'),
  'md5=', require('crypto').createHash('md5').update(html, 'utf8').digest('hex'));
