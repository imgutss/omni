// rev151 panel patch — honest geo presentation for Iranian resolvers.
// IR DoH origins only answer clients inside Iran; a Cloudflare worker on the
// global edge can never reach them, so a red "HTTP error" badge is misleading.
// Transport failures on IR cards become a neutral "only inside Iran" badge
// (raw HTTP code stays in the tooltip/inspector); stats split geo vs real errors.
const fs = require('fs');
let html = fs.readFileSync('/home/user/omni-fix/panel.v90.final.html', 'utf8');
const edits = [];
function rep(oldT, newT, label, expect = 1) {
  const n = html.split(oldT).length - 1;
  if (n !== expect) throw new Error(`anchor count ${n} (expected ${expect}) for: ${label}`);
  html = html.split(oldT).join(newT);
  edits.push(label);
}

/* 1 — geo helper + worker badge rewrite */
rep(
  `  function dnsWorkerBadge(id) {
    const c = DNS_UI.cells[id];
    if (!c) return '<span class="badge" dir="ltr">☁ ورکر: سنجیده نشده</span>';
    const meta = OMNI_DNS_VERDICTS[c.verdict] || { cls: "warn", fa: c.verdict || "—" };
    const msTxt = c.ms ? " · " + v(c.ms) + "ms" : "";
    const httpTxt = c.verdict === "http-error" && c.error ? " · " + c.error : "";
    const tip = [
      "ورکر/کلادفلر",
      c.compared === false ? "بدون مرجع مقایسه" : "مقایسه با مرجع",
      c.ips && c.ips.length ? "پاسخ: " + c.ips.slice(0, 3).join(", ") : "",
      c.error || ""
    ].filter(Boolean).join(" · ");
    return \`<span class="badge \${meta.cls}" dir="ltr" title="\${a(tip)}">☁ \${a(meta.fa)}\${a(httpTxt)}\${msTxt}</span>\`;
  }`,
  `  function dnsGeoBlocked(id) {
    const srv = dnsById(id);
    const c = DNS_UI.cells[id];
    /* Iranian domestic resolvers are unreachable from the global CF edge by design
       (internal 10.202 ranges / geo-locked origins). Only transport failures count;
       a real DNS answer — even a bad one — is an ordinary verdict, not a geo miss. */
    return !!srv && srv.region === "ir" && !!c && !c.pending &&
      (c.verdict === "http-error" || c.verdict === "no-answer");
  }
  function dnsWorkerBadge(id) {
    const c = DNS_UI.cells[id];
    if (!c) return '<span class="badge" dir="ltr">☁ ورکر: سنجیده نشده</span>';
    if (dnsGeoBlocked(id)) {
      const raw = c.error ? "کد خام لبهٔ جهانی: " + c.error : "پاسخی از لبهٔ جهانی نگرفت";
      return \`<span class="badge warn" dir="ltr" title="\${a("رزولوور داخلی ایران فقط به کاربران داخل ایران سرویس می‌دهد و از دیتاسنتر کلادفلر خارج ایران قابل دسترسی نیست. " + raw + " — برای سنجش واقعی از دکمهٔ تست خط من با VPN خاموش استفاده کن.")}">☁ فقط داخل ایران</span>\`;
    }
    const meta = OMNI_DNS_VERDICTS[c.verdict] || { cls: "warn", fa: c.verdict || "—" };
    const msTxt = c.ms ? " · " + v(c.ms) + "ms" : "";
    const httpTxt = c.verdict === "http-error" && c.error ? " · " + c.error : "";
    const tip = [
      "ورکر/کلادفلر",
      c.compared === false ? "بدون مرجع مقایسه" : "مقایسه با مرجع",
      c.ips && c.ips.length ? "پاسخ: " + c.ips.slice(0, 3).join(", ") : "",
      c.error || ""
    ].filter(Boolean).join(" · ");
    return \`<span class="badge \${meta.cls}" dir="ltr" title="\${a(tip)}">☁ \${a(meta.fa)}\${a(httpTxt)}\${msTxt}</span>\`;
  }`,
  'geo helper + worker badge'
);

/* 2 — stats: split geo-unreachable IR count from genuine HTTP errors */
rep(
  `  function dnsStats() {
    const rows = Object.values(DNS_UI.cells);
    const out = { total: rows.length, ok: 0, divergent: 0, poisoned: 0, httpError: 0, nxdomain: 0, empty: 0, noAnswer: 0, fastest: null };
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
    }
    return out;
  }`,
  `  function dnsStats() {
    const rows = Object.entries(DNS_UI.cells);
    const out = { total: rows.length, ok: 0, divergent: 0, poisoned: 0, httpError: 0, nxdomain: 0, empty: 0, noAnswer: 0, geoIr: 0, fastest: null };
    for (const [id, c] of rows) {
      if (c.verdict === "ok") {
        out.ok++;
        if (c.ms && (!out.fastest || c.ms < out.fastest.ms)) out.fastest = c;
      } else if (c.verdict === "divergent") out.divergent++;
      else if (c.verdict === "poisoned") out.poisoned++;
      else if (dnsGeoBlocked(id)) out.geoIr++;
      else if (c.verdict === "http-error") out.httpError++;
      else if (c.verdict === "nxdomain") out.nxdomain++;
      else if (c.verdict === "empty") out.empty++;
      else out.noAnswer++;
    }
    return out;
  }`,
  'stats geo bucket'
);

/* 3 — hide-dead must not treat geo-unreachable IR cards as dead */
rep(
  `    if (DNS_UI.hideDead) {
      const c = DNS_UI.cells[s.id];
      if (c && !c.pending && !["ok", "divergent"].includes(c.verdict)) return false;
    }`,
  `    if (DNS_UI.hideDead) {
      const c = DNS_UI.cells[s.id];
      if (c && !c.pending && !["ok", "divergent"].includes(c.verdict) && !dnsGeoBlocked(s.id)) return false;
    }`,
  'hide-dead keeps geo IR cards'
);

/* 4 — inspector explains the geo miss while keeping the raw code */
rep(
  `      <div class="muted" style="font-size:11px;margin-top:8px;line-height:1.9">
        \${c ? \`وضعیت: <b>\${a((OMNI_DNS_VERDICTS[c.verdict] || {}).fa || c.verdict)}</b>\${c.compared === false ? " · بدون مقایسه مرجعی" : ""}\${c.ms ? " · زمان ورکر: " + v(c.ms) + "ms" : ""}\` : "هنوز با ورکر سنجیده نشده"}<br>
        دسترسی از خط شما: \${dv ? (dv.state === "open" ? "باز روی HTTPS" + (dv.ms ? " · " + v(dv.ms) + "ms" : "") : "بدون پاسخ") : "سنجیده نشده"}
        \${c?.error ? \`<br><span style="color:var(--danger)">\${a(c.error)}</span>\` : ""}
      </div>`,
  `      <div class="muted" style="font-size:11px;margin-top:8px;line-height:1.9">
        \${c ? \`وضعیت: <b>\${a((OMNI_DNS_VERDICTS[c.verdict] || {}).fa || c.verdict)}</b>\${c.compared === false ? " · بدون مقایسه مرجعی" : ""}\${c.ms ? " · زمان ورکر: " + v(c.ms) + "ms" : ""}\` : "هنوز با ورکر سنجیده نشده"}<br>
        \${dnsGeoBlocked(s.id) ? '<span style="color:var(--warn)">این رزولوور فقط از شبکهٔ داخلی ایران قابل دسترسی است؛ لبهٔ جهانی کلادفلر نمی‌تواند آن را بسنجد. تست واقعی را با «خط من» و VPN خاموش انجام بده.</span><br>' : ""}
        دسترسی از خط شما: \${dv ? (dv.state === "open" ? "باز روی HTTPS" + (dv.ms ? " · " + v(dv.ms) + "ms" : "") : "بدون پاسخ") : "سنجیده نشده"}
        \${c?.error ? \`<br><span style="color:var(--text-faint)">کد خام لبهٔ جهانی: \${a(c.error)}</span>\` : ""}
      </div>`,
  'inspector geo explanation'
);

/* 5 — stats bar geo badge */
rep(
  `      \${st.httpError ? \`<span class="badge danger">خطای HTTP: \${v(st.httpError)}</span>\` : ""}`,
  `      \${st.geoIr ? \`<span class="badge warn">فقط داخل ایران (غیرقابل سنجش از ورکر): \${v(st.geoIr)}</span>\` : ""}
      \${st.httpError ? \`<span class="badge danger">خطای HTTP: \${v(st.httpError)}</span>\` : ""}`,
  'stats bar geo badge'
);

/* 6 — persistent note on every IR card */
rep(
  `        \${s.note ? \`<div class="muted" style="font-size:10.5px">\${a(s.note)}</div>\` : ""}`,
  `        \${s.note ? \`<div class="muted" style="font-size:10.5px">\${a(s.note)}</div>\` : ""}
        \${s.region === "ir" ? '<div style="font-size:10.5px;color:var(--warn);line-height:1.8">شبکهٔ داخلی ایران — ستون ورکر برایش کاربردی ندارد؛ با «تست خط من» و VPN خاموش بسنج.</div>' : ""}`,
  'IR card note'
);

/* 7 — hint paragraph explains the split + VPN caveat */
rep(
  `    UDP/853 (DoT) از مرورگر قابل سنجش نیست و فقط آدرسش برای تنظیم دستی نمایش داده می‌شود.
  </p>`,
  `    UDP/853 (DoT) از مرورگر قابل سنجش نیست و فقط آدرسش برای تنظیم دستی نمایش داده می‌شود.
    رزولوورهای ایرانی فقط به کاربران داخل ایران پاسخ می‌دهند و از لبهٔ جهانی ورکر قابل سنجش نیستند (نشان کهربایی «فقط داخل ایران»)؛
    برای سنجش واقعی آن‌ها از دکمهٔ «تست خط من» با VPN خاموش استفاده کن — با VPN روشن، ترافیک از خارج ایران رد می‌شود و سرویس‌های داخلی پاسخ نمی‌دهند.
  </p>`,
  'hint geo + VPN paragraph'
);

/* 8 — catalog corrections: official Shecan IP + honest 403 status */
rep(`ips: ["178.22.122.122", "185.51.200.2"]`, `ips: ["178.22.122.100", "185.51.200.2"]`, 'shecan official primary IP');
rep(
  `        id: "f403", name: "۴۰۳", vendor: "403.online", region: "ir",
        url: "https://dns.403.online/dns-query", dot: "dns.403.online",
        ips: ["10.202.10.202", "10.202.10.102"],
        note: "سرویس عمومی ایرانی"`,
  `        id: "f403", name: "۴۰۳", vendor: "403.online", region: "ir",
        url: "https://dns.403.online/dns-query", dot: "dns.403.online",
        ips: ["10.202.10.202", "10.202.10.102"],
        note: "گزارش‌هایی از توقف سرویس از اسفند ۱۴۰۳ — ممکن است پاسخ ندهد"`,
  '403 honest status note'
);

if (html.includes('�')) throw new Error('U+FFFD in panel');
for (const must of ['dnsGeoBlocked', 'فقط داخل ایران', 'st.geoIr', 'VPN خاموش', '178.22.122.100']) {
  if (!html.includes(must)) throw new Error('missing rev151 marker: ' + must);
}
fs.writeFileSync('/home/user/omni-fix/panel.v91.final.html', html);
console.log('panel patches applied:', edits.join(' | '));
console.log('panel.v91.final.html bytes=', Buffer.byteLength(html, 'utf8'),
  'md5=', require('crypto').createHash('md5').update(html, 'utf8').digest('hex'));
