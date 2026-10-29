  /* rev148 — ECH (Encrypted Client Hello) برای کانفیگ‌ساز.
     دو حالت صادقانه:
     - shell: کلاینت خودش رکورد HTTPS/SVCB را از DoH می‌گیرد (domain+udp://resolver)
     - embed: کلید بیس۶۴ ECHConfigList در خروجی جاسازی می‌شود (دکمه تازه‌سازی زنده از /api/ech-config)
     قرارداد خروجی‌ها:
     URI (فورک‌های ECH کلاینت‌ها) -> ech=<shell|b64>
     sing-box -> tls.ech {enabled,query_server_name} | {enabled,config:[خطوط PEM]}
     mihomo/Clash Meta -> ech-opts {enable,query-server-name} | {enable,config:b64} */
  var OMNI_ECH_DEFAULT_B64 = "AEX+DQBBXgAgACBsvLac2HVdvp+J2QTKPNjn24b5D6yHyxAcG0m+cmDcXAAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA=";
  var OMNI_ECH_STORE = "omni.ech.v1";
  var OMNI_ECH_RESOLVERS = ["1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4", "9.9.9.9", "208.67.222.222", "208.67.220.220", "94.140.14.14", "94.140.15.15", "76.76.2.0", "76.76.19.19", "185.228.168.9", "185.228.169.9", "64.6.64.6", "64.6.65.6", "45.90.28.0", "45.90.30.0", "149.112.112.112"];
  var OMNI_ECH_DOMAINS = ["cloudflare-ech.com", "crypto.cloudflare.com", "cloudflarestaging.com", "iranva.ir", "moj.ir", "dolts.ir", "geedo.com", "ip.gs", "gitlab.io", "discordapp.com", "ifconfig.io"];
  function omniEchValidDomain(v) {
    v = String(v == null ? "" : v).trim().toLowerCase();
    return /^[a-z0-9][a-z0-9.-]{1,78}[a-z0-9]$/.test(v) && v.indexOf(".") >= 0 && v.indexOf("..") < 0;
  }
  function omniEchValidResolver(v) { return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(String(v == null ? "" : v).trim()); }
  function omniEchValidB64(v) { return /^AEX[A-Za-z0-9+/]+={0,2}$/.test(String(v == null ? "" : v).trim()); }
  function omniEchLoad() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(OMNI_ECH_STORE) || "{}") || {}; } catch (_) {}
    g.ech = !!s.ech;
    g.echMode = s.echMode === "embed" ? "embed" : "shell";
    g.echDomain = omniEchValidDomain(s.echDomain) ? String(s.echDomain).trim().toLowerCase() : "cloudflare-ech.com";
    g.echResolver = omniEchValidResolver(s.echResolver) ? String(s.echResolver).trim() : "1.1.1.1";
    g.echB64 = omniEchValidB64(s.echB64) ? String(s.echB64).trim() : OMNI_ECH_DEFAULT_B64;
    g.echV6 = !!s.echV6;
  }
  function omniEchSave() {
    try {
      localStorage.setItem(OMNI_ECH_STORE, JSON.stringify({
        ech: !!g.ech, echMode: g.echMode, echDomain: g.echDomain, echResolver: g.echResolver,
        echB64: g.echB64, echV6: g.echV6
      }));
    } catch (_) {}
  }
  function omniEchOn(addr) {
    if (!g.ech) return false;
    if (String(addr == null ? "" : addr).indexOf(":") >= 0 && !g.echV6) return false;
    return true;
  }
  function omniEchB64() { return String(g.echB64 || OMNI_ECH_DEFAULT_B64).trim(); }
  function omniEchDomain() { return String(g.echDomain || "cloudflare-ech.com").trim().toLowerCase(); }
  function omniEchUriPayload() {
    return g.echMode === "embed"
      ? omniEchB64()
      : omniEchDomain() + "+udp://" + String(g.echResolver || "1.1.1.1").trim();
  }
  function omniEchPemLines() { return ["-----BEGIN ECH CONFIGS-----", omniEchB64(), "-----END ECH CONFIGS-----"]; }
  async function omniEchRefresh(e) {
    const dom = omniEchDomain();
    if (!omniEchValidDomain(dom)) { y("دامنهٔ ECH معتبر نیست", "err"); return; }
    const st = document.getElementById("cfg-ech-status");
    if (st) st.textContent = "در حال خواندن کلید تازه از رکورد HTTPS (DoH)…";
    try {
      const r = await fetch("/api/ech-config?domain=" + encodeURIComponent(dom), { credentials: "same-origin", cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok || !j.ech) throw new Error(j.error || "ECH در رکورد دامنه پیدا نشد");
      const fresh = String(j.ech).trim();
      if (!omniEchValidB64(fresh)) throw new Error("قالب کلید دریافتی معتبر نیست");
      g.echB64 = fresh;
      omniEchSave();
      if (st) st.textContent = "کلید تازه ذخیره شد · منبع: " + a(j.source || "doh-https-record");
      y("کلید ECH تازه از رکورد HTTPS خوانده شد", "ok");
      if (e && e.rerenderView) e.rerenderView("configs");
    } catch (err) {
      if (st) st.textContent = "دریافت کلید تازه شکست خورد — کلید فعلی دست‌نخورده ماند.";
      y(String((err && err.message) || err), "err", 5000);
    }
  }
  function omniEchCardHtml() {
    if (!g.ech) {
      return `<div class="card" id="cfg-ech-card" style="margin-top:14px">
    <div class="card-head">${d("shield")}<h3>ECH — Encrypted Client Hello</h3></div>
    <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;user-select:none">
      <span class="switch"><input type="checkbox" id="cfg-ech" ${g.ech ? "checked" : ""}><span></span></span>
      <span>افزودن ECH به همهٔ کانفیگ‌های TLS (پیش‌فرض خاموش)</span>
    </label>
    <p class="hint muted" style="font-size:11px;margin:8px 0 0">ECH نام دامنه را در ClientHello رمز می‌کند؛ فقط برای لبه‌های کلودفلر اعتبار دارد و کلاینت باید ECH را پشتیبانی کند. تنظیم‌ها روی همین دستگاه ذخیره می‌شوند.</p>
  </div>`;
    }
    const modeChips = [["shell", "شل DNS — کلاینت رکورد HTTPS را خودش می‌گیرد"], ["embed", "کلید Embedded — بیس۶۴ جاسازی‌شده در خروجی"]].map(([val, lbl]) =>
      `<button type="button" class="chip" data-action="omni-cfg-ech-mode" data-v="${val}" aria-pressed="${g.echMode === val}">${lbl}</button>`).join("");
    const resolverChips = OMNI_ECH_RESOLVERS.map((ip) =>
      `<button type="button" class="chip" data-action="omni-cfg-ech-resolver" data-v="${ip}" aria-pressed="${g.echResolver === ip}" dir="ltr">${ip}</button>`).join("");
    const domainChips = OMNI_ECH_DOMAINS.slice(0, 6).map((dm) =>
      `<button type="button" class="chip" data-action="omni-cfg-ech-domain-suggest" data-v="${dm}" aria-pressed="${g.echDomain === dm}" dir="ltr">${a(dm)}</button>`).join("");
    const shellBlock = `<div style="margin-top:10px;padding:10px;border:1px solid var(--border);border-radius:12px">
      <div class="muted" style="font-size:11.5px;margin-bottom:6px">دامنه‌ای که رکورد ECH روی آن خوانده می‌شود (public name)</div>
      <input id="cfg-ech-domain" class="input mono" dir="ltr" value="${a(omniEchDomain())}" maxlength="80" autocomplete="off" placeholder="cloudflare-ech.com">
      <div class="chips" style="margin-top:8px">${domainChips}</div>
      <div class="muted" style="font-size:11.5px;margin:10px 0 6px">رزولوور DoH داخل کلاینت (udp://)</div>
      <div class="chips" style="gap:6px">${resolverChips}</div>
    </div>`;
    const embedBlock = `<div style="margin-top:10px;padding:10px;border:1px solid var(--border);border-radius:12px">
      <div class="muted" style="font-size:11.5px;margin-bottom:6px">کلید ECHConfigList (بیس۶۴) — می‌توانی دستی بچسبانی یا از رکورد زنده DNS تازه‌اش کنی</div>
      <textarea id="cfg-ech-b64" class="input mono" dir="ltr" rows="3" autocomplete="off" style="font-size:11px;resize:vertical">${a(omniEchB64())}</textarea>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">
        <button type="button" class="btn btn-sm btn-primary" data-action="omni-cfg-ech-refresh">${d("refresh")} خواندن کلید تازه از DNS</button>
        <span id="cfg-ech-status" class="muted" style="font-size:11px"></span>
      </div>
    </div>`;
    return `<div class="card" id="cfg-ech-card" style="margin-top:14px">
    <div class="card-head">${d("shield")}<h3>ECH — Encrypted Client Hello</h3><span class="badge ok">فعال</span></div>
    <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;user-select:none">
      <span class="switch"><input type="checkbox" id="cfg-ech" checked><span></span></span>
      <span>ECH روی همهٔ ردیف‌های TLS اعمال می‌شود</span>
    </label>
    <div class="chips" style="margin-top:10px">${modeChips}</div>
    ${g.echMode === "embed" ? embedBlock : shellBlock}
    <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;user-select:none;margin-top:12px">
      <span class="switch"><input type="checkbox" id="cfg-ech-v6" ${g.echV6 ? "checked" : ""}><span></span></span>
      <span>اعمال ECH روی ردیف‌های IPv6 هم (پیش‌فرض خاموش — متد IPv6 جداگانه است و ممکن است پینگ را خراب کند)</span>
    </label>
    <div class="codebox mono" dir="ltr" style="margin-top:10px;font-size:11.5px;overflow-wrap:anywhere">ech=${a(omniEchUriPayload())}</div>
    <p class="hint muted" style="font-size:11px;margin:8px 0 0">
      در حالت ECH اثر انگشت اجباراً chrome می‌شود و cipherSuites خروجی حذف می‌گردد (طبق قرارداد کلاینت‌های ECH).<br>
      لینک‌های URI برای فورک‌های ECH کلاینت‌هاست؛ sing-box و Clash Meta فیلدهای رسمی ech می‌گیرند. در حالت شل اگر کلاینت نتواند رکورد HTTPS را از DNS بگیرد، اتصال ECH شکست می‌خورد و fallback بی‌صدا ندارد — در این حالت کلید Embedded را بزن.
    </p>
  </div>`;
  }
  omniEchLoad();
