function ze(e) {
  const activeUrl = e.settings?.dns_upstream || "";
  const now = Date.now();
  const fmtTime = (ts) => {
    try { return ts ? new Date(ts).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"; } catch (_) { return "—"; }
  };
  const q = DNS_UI.search.trim().toLowerCase();
  let list = Ut.filter((s) => {
    if (DNS_UI.region !== "all" && s.region !== DNS_UI.region) return false;
    if (q && !(s.name + " " + s.vendor + " " + s.url + " " + s.dot + " " + (s.note || "")).toLowerCase().includes(q)) return false;
    if (DNS_UI.hideDead) {
      const c = DNS_UI.cells[s.id];
      if (c && !c.pending && !["ok", "divergent"].includes(c.verdict)) return false;
    }
    return true;
  });
  if (DNS_UI.sort === "fastest") {
    list = list.slice().sort((a, b) => {
      const ca = DNS_UI.cells[a.id], cb = DNS_UI.cells[b.id];
      const ma = ca && ca.verdict === "ok" && ca.ms ? ca.ms : Infinity;
      const mb = cb && cb.verdict === "ok" && cb.ms ? cb.ms : Infinity;
      return ma - mb;
    });
  } else if (DNS_UI.sort === "name") {
    list = list.slice().sort((a, b) => a.name.localeCompare(b.name, "fa"));
  }
  const st = dnsStats();
  const fastest = st.fastest ? dnsById(st.fastest.id || Object.keys(DNS_UI.cells).find((k) => DNS_UI.cells[k] === st.fastest)) : null;
  const regionChip = (val, lbl) => `<button type="button" class="chip" data-action="omni-dns-region" data-v="${val}" aria-pressed="${DNS_UI.region === val}">${lbl}</button>`;
  const sortChip = (val, lbl) => `<button type="button" class="chip" data-action="omni-dns-sort" data-v="${val}" aria-pressed="${DNS_UI.sort === val}">${lbl}</button>`;
  const inspector = (s) => {
    const c = DNS_UI.cells[s.id], dv = DNS_UI.dev[s.id];
    const ips = (c && c.ips) || [], ref = (c && c.ref) || [];
    return `<details ${DNS_UI.expanded === s.id ? "open" : ""} data-dns-details="${a(s.id)}" style="margin-top:8px;border-top:1px dashed var(--border);padding-top:8px">
      <summary class="muted" style="cursor:pointer;font-size:11.5px">جزئیات پاسخ و مقایسه با مرجع</summary>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;font-size:11.5px">
        <div><div class="muted" style="margin-bottom:4px">پاسخ این رزولوور</div>
          ${c?.pending ? '<span class="badge">در حال سنجش…</span>' : ips.length ? ips.map((ip) => `<code class="mono" dir="ltr" style="display:block;font-size:10.5px;color:var(--text-dim)">${a(ip)}</code>`).join("") : '<span class="muted">بدون پاسخ</span>'}
        </div>
        <div><div class="muted" style="margin-bottom:4px">مرجع (Cloudflare/Google)</div>
          ${ref.length ? ref.slice(0, 4).map((ip) => `<code class="mono" dir="ltr" style="display:block;font-size:10.5px;color:var(--text-dim)">${a(ip)}</code>`).join("") : '<span class="muted">مرجعی در دسترس نبود</span>'}
        </div>
      </div>
      <div class="muted" style="font-size:11px;margin-top:8px;line-height:1.9">
        ${c ? `وضعیت: <b>${a((OMNI_DNS_VERDICTS[c.verdict] || {}).fa || c.verdict)}</b>${c.compared === false ? " · بدون مقایسه مرجعی" : ""}${c.ms ? " · زمان ورکر: " + v(c.ms) + "ms" : ""}` : "هنوز با ورکر سنجیده نشده"}<br>
        دسترسی از خط شما: ${dv ? (dv.state === "open" ? "باز روی HTTPS" + (dv.ms ? " · " + v(dv.ms) + "ms" : "") : "بدون پاسخ") : "سنجیده نشده"}
        ${c?.error ? `<br><span style="color:var(--danger)">${a(c.error)}</span>` : ""}
      </div>
    </details>`;
  };
  return `
  <header class="view-head">
    <div>
      <h2>${d("globe")} دی‌ان‌اس / DoH</h2>
      <p class="muted">رزولوورها را انتخاب کن و سلامت‌شان را هم از ورکر کلادفلر و هم از همین گوشی بسنج — بدون هیچ عدد ساختگی.</p>
    </div>
    <div class="head-actions" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <input id="dns-qname" dir="ltr" value="${a(DNS_UI.qname)}" placeholder="example.com" style="width:150px">
      <select id="dns-qtype" style="width:96px">
        <option value="A" ${DNS_UI.qtype === "A" ? "selected" : ""}>A</option>
        <option value="AAAA" ${DNS_UI.qtype === "AAAA" ? "selected" : ""}>AAAA</option>
      </select>
      <button class="btn btn-primary" data-action="omni-dns-wall">${d("bolt")} تست همه از ورکر</button>
      <button class="btn" data-action="omni-dns-dall">📱 تست همه از خط من</button>
    </div>
  </header>

  <p class="hint muted" style="margin:-4px 0 10px;font-size:12px;line-height:2">
    دو ستون نتیجه: «ورکر» یعنی خودِ DoH از شبکهٔ کلادفلر جواب می‌دهد، پاسخش با رزولوور مرجع مقایسه می‌شود و verdict صادقانه می‌گیرد
    (سالم/متفاوت/آلوده) — هیچ IP ساختگی جای نتیجه نمی‌نشیند. «خط من» یعنی مرورگر همین گوشی می‌تواند به دامنهٔ آن DoH روی HTTPS وصل شود؛
    UDP/853 (DoT) از مرورگر قابل سنجش نیست و فقط آدرسش برای تنظیم دستی نمایش داده می‌شود.
  </p>

  <div class="card" style="margin-bottom:14px">
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <input id="dns-search" dir="rtl" value="${a(DNS_UI.search)}" placeholder="جستجوی رزولوور…" style="flex:1;min-width:160px">
      <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;user-select:none">
        <span class="switch"><input type="checkbox" id="dns-hide-dead" ${DNS_UI.hideDead ? "checked" : ""}><span></span></span>
        <span>فقط زنده‌ها</span>
      </label>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${regionChip("all", "همه (" + v(Ut.length) + ")")}
      ${regionChip("ir", "🇮🇷 ایران (" + v(Ut.filter((s) => s.region === "ir").length) + ")")}
      ${regionChip("global", "🌍 جهانی (" + v(Ut.filter((s) => s.region === "global").length) + ")")}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <span class="muted" style="font-size:11.5px;align-self:center">مرتب‌سازی:</span>
      ${sortChip("default", "پیش‌فرض")}
      ${sortChip("fastest", "سریع‌ترین ورکر")}
      ${sortChip("name", "نام")}
    </div>
    <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:12px" id="dns-stats">
      <span class="badge ok">سالم: ${v(st.ok)}</span>
      <span class="badge info">متفاوت: ${v(st.divergent)}</span>
      ${st.poisoned ? `<span class="badge danger">آلوده: ${v(st.poisoned)}</span>` : ""}
      ${st.httpError ? `<span class="badge danger">خطای HTTP: ${v(st.httpError)}</span>` : ""}
      ${st.nxdomain ? `<span class="badge warn">NXDOMAIN: ${v(st.nxdomain)}</span>` : ""}
      ${st.empty ? `<span class="badge danger">بدون رکورد: ${v(st.empty)}</span>` : ""}
      ${st.noAnswer ? `<span class="badge danger">بی‌پاسخ: ${v(st.noAnswer)}</span>` : ""}
      ${fastest ? `<span class="badge">سریع‌ترین: ${a(fastest.name)}${st.fastest?.ms ? " · " + v(st.fastest.ms) + "ms" : ""}</span>` : ""}
      ${DNS_UI.colo ? `<span class="badge">📍 کولو ورکر: ${a(DNS_UI.colo)}</span>` : ""}
      <span class="badge">آخرین سنجش ورکر: ${a(fmtTime(DNS_UI.measuredAt))}</span>
      <span class="badge">خط من: ${a(fmtTime(DNS_UI.deviceAt))}</span>
    </div>
  </div>

  <div class="dns-grid">
    ${list.map((s) => {
      const c = DNS_UI.cells[s.id];
      const isActive = activeUrl === s.url;
      return `
      <div class="dns-card" data-dns-card="${a(s.id)}" data-dns-haystack="${a((s.name + " " + s.vendor + " " + s.url + " " + s.dot + " " + (s.note || "")).toLowerCase())}" aria-pressed="${isActive}">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          <b style="font-size:13.5px">${a(s.name)}</b>
          <span class="muted" style="font-size:11px">${a(s.vendor)}</span>
          <span style="flex:1"></span>
          ${s.region === "ir" ? '<span class="badge ir">ایران</span>' : '<span class="badge">جهانی</span>'}
          ${isActive ? `<span class="badge ok">${a(n("dns.active"))}</span>` : ""}
        </div>
        <code dir="ltr">${a(s.url)}</code>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <code class="muted" dir="ltr" style="font-size:10.5px">DoT: ${a(s.dot || "—")}</code>
          <button type="button" class="btn btn-sm" style="min-height:28px;padding:2px 9px" data-action="omni-copy" data-text="${a(s.dot)}" title="کپی برای Private DNS اندروید">کپی اندروید</button>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:2px">
          ${(s.ips || []).map((ip) => `<code class="mono" dir="ltr" style="font-size:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:7px;padding:2px 6px;color:var(--text-dim)">${a(ip)}</code>`).join("")}
        </div>
        ${s.note ? `<div class="muted" style="font-size:10.5px">${a(s.note)}</div>` : ""}
        <span class="dns-tags" style="flex-wrap:wrap">
          ${c?.pending ? '<span class="badge">☁ در حال سنجش…</span>' : dnsWorkerBadge(s.id)}
          ${DNS_UI.dev[s.id]?.pending ? '<span class="badge">📱 در حال سنجش…</span>' : dnsDeviceBadge(s.id)}
        </span>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
          <button class="btn btn-sm ${isActive ? "" : "btn-primary"}" data-action="omni-dns-select" data-id="${a(s.id)}" data-url="${a(s.url)}">${a(n("dns.pick"))}</button>
          <button class="btn btn-sm" data-action="omni-dns-wtest" data-id="${a(s.id)}">${d("play")} تست ورکر</button>
          <button class="btn btn-sm" data-action="omni-dns-dtest" data-id="${a(s.id)}">📱 تست خط من</button>
        </div>
        ${inspector(s)}
      </div>`;
    }).join("")}
  </div>
  ${list.length === 0 ? '<p class="muted" style="text-align:center;padding:24px 0">رزولووری با این فیلتر پیدا نشد.</p>' : ""}
  <p class="muted" style="font-size:12.5px;line-height:2">${a(n("dns.note"))} این انتخاب روی کانفیگ Clash و رلهٔ UDP/53 همین ورکر اثر دارد؛ WireGuard/AmneziaWG و aether:// مقدار DNS را از خودِ اپ می‌گیرند. آدرس‌های IP نمایش‌داده‌شده، آدرس‌های رسمی اعلام‌شدهٔ هر سرویس‌اند و عدد سنجش همیشه از تست زنده می‌آید.</p>`;
}
