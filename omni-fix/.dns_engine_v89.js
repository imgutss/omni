  /* rev149 — DNS engine: two honest measurement columns (worker DoH verdict vs
     this-device HTTPS reachability), persisted UI/measurement state, zero fabricated numbers. */
  var OMNI_DNS_STORE = "omni.dns.v1";
  var OMNI_DNS_VERDICTS = {
    ok: { cls: "ok", fa: "سالم" },
    divergent: { cls: "info", fa: "متفاوت" },
    poisoned: { cls: "danger", fa: "آلوده" },
    nxdomain: { cls: "warn", fa: "NXDOMAIN" },
    empty: { cls: "danger", fa: "بدون رکورد" },
    "http-error": { cls: "danger", fa: "خطای HTTP" },
    "no-answer": { cls: "danger", fa: "بی‌پاسخ" }
  };
  function dnsDefaultUi() {
    return {
      search: "", region: "all", sort: "default", hideDead: false,
      qname: "youtube.com", qtype: "A",
      cells: {}, dev: {}, measuredAt: null, deviceAt: null, colo: "", expanded: ""
    };
  }
  var DNS_UI = dnsDefaultUi();
  (function dnsLoad() {
    try {
      const s = JSON.parse(localStorage.getItem(OMNI_DNS_STORE) || "null");
      if (s && typeof s === "object") {
        DNS_UI = Object.assign(dnsDefaultUi(), s);
        DNS_UI.cells = s.cells && typeof s.cells === "object" ? s.cells : {};
        DNS_UI.dev = s.dev && typeof s.dev === "object" ? s.dev : {};
      }
    } catch (_) {}
  })();
  function dnsSave() {
    try { localStorage.setItem(OMNI_DNS_STORE, JSON.stringify(DNS_UI)); } catch (_) {}
  }
  function dnsById(id) { return Ut.find((s) => s.id === id) || null; }
  function dnsWorkerBadge(id) {
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
    return `<span class="badge ${meta.cls}" dir="ltr" title="${a(tip)}">☁ ${a(meta.fa)}${a(httpTxt)}${msTxt}</span>`;
  }
  function dnsDeviceBadge(id) {
    const c = DNS_UI.dev[id];
    if (!c) return '<span class="badge" dir="ltr">📱 خط من: سنجیده نشده</span>';
    if (c.state === "open")
      return `<span class="badge ok" dir="ltr" title="فقط دسترسی HTTPS دامنه از این گوشی سنجیده می‌شود؛ UDP/853 قابل سنجش مرورگر نیست">📱 باز · ${v(c.ms)}ms</span>`;
    return '<span class="badge danger" dir="ltr" title="دامنه DoH از این گوشی روی HTTPS پاسخ نداد">📱 بدون پاسخ</span>';
  }
  function dnsStats() {
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
  }
  async function dnsRunWorkerAll(ctx) {
    const servers = Ut.map((s) => ({ id: s.id, url: s.url }));
    for (const s of Ut) DNS_UI.cells[s.id] = Object.assign(DNS_UI.cells[s.id] || {}, { pending: true });
    dnsSave();
    try { ctx && ctx.rerenderView && ctx.rerenderView("dns"); } catch (_) {}
    try {
      const j = await x("POST", "/api/diag/dns-batch", {
        qname: DNS_UI.qname, qtype: DNS_UI.qtype, servers
      }, { retry: 0 });
      DNS_UI.colo = j.colo || "";
      DNS_UI.measuredAt = j.at || Date.now();
      for (const r of j.results || []) {
        DNS_UI.cells[r.id] = {
          verdict: r.verdict, ms: r.ms, ips: r.ips || [], ref: j.ref_ips || [],
          compared: r.compared !== false, error: r.error || null, at: r.at, pending: false
        };
      }
      dnsSave();
      y("سنجش ورکر برای " + v(j.results?.length || 0) + " رزولوور کامل شد", "ok");
    } catch (err) {
      for (const s of Ut) if (DNS_UI.cells[s.id]) DNS_UI.cells[s.id].pending = false;
      y(String(err?.message || err), "err", 5000);
    }
    try { ctx && ctx.rerenderView && ctx.rerenderView("dns"); } catch (_) {}
  }
  async function dnsRunWorkerOne(ctx, id) {
    const srv = dnsById(id);
    if (!srv) return;
    DNS_UI.cells[id] = Object.assign(DNS_UI.cells[id] || {}, { pending: true });
    dnsSave();
    try { ctx && ctx.rerenderView && ctx.rerenderView("dns"); } catch (_) {}
    try {
      const j = await x("GET", `/api/diag/dns?url=${encodeURIComponent(srv.url)}&name=${encodeURIComponent(DNS_UI.qname)}&type=${encodeURIComponent(DNS_UI.qtype)}`,
        void 0, { retry: 0, signal: AbortSignal.timeout(9000) });
      DNS_UI.colo = j.colo || DNS_UI.colo || "";
      DNS_UI.measuredAt = Date.now();
      DNS_UI.cells[id] = {
        verdict: j.verdict || (j.ok ? "ok" : "no-answer"), ms: j.ms, ips: j.ips || [],
        ref: j.ref_ips || [], compared: j.compared !== false, error: j.error || null, at: Date.now(), pending: false
      };
      dnsSave();
    } catch (err) {
      DNS_UI.cells[id] = { verdict: "no-answer", ms: null, ips: [], ref: [], compared: false, error: String(err?.message || err), at: Date.now(), pending: false };
      dnsSave();
    }
    try { ctx && ctx.rerenderView && ctx.rerenderView("dns"); } catch (_) {}
  }
  async function dnsDeviceProbeOne(url, timeoutMs = 4000) {
    const t0 = performance.now();
    try {
      const u = new URL(url);
      u.searchParams.set("name", DNS_UI.qname || "example.com");
      u.searchParams.set("type", DNS_UI.qtype || "A");
      await fetch(u.toString(), { mode: "no-cors", cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
      return { state: "open", ms: Math.max(1, Math.round(performance.now() - t0)), at: Date.now() };
    } catch (err) {
      return { state: "blocked", ms: null, error: err?.name || "error", at: Date.now() };
    }
  }
  async function dnsRunDeviceAll(ctx) {
    const list = Ut.slice();
    for (let off = 0; off < list.length; off += 4) {
      const part = list.slice(off, off + 4);
      const res = await Promise.all(part.map((s) => dnsDeviceProbeOne(s.url)));
      part.forEach((s, i) => { DNS_UI.dev[s.id] = res[i]; });
      dnsSave();
      try { ctx && ctx.rerenderView && ctx.rerenderView("dns"); } catch (_) {}
    }
    DNS_UI.deviceAt = Date.now();
    dnsSave();
    y("سنجش دسترسی از خط شما کامل شد", "ok");
    try { ctx && ctx.rerenderView && ctx.rerenderView("dns"); } catch (_) {}
  }
  async function dnsRunDeviceOne(ctx, id) {
    const srv = dnsById(id);
    if (!srv) return;
    DNS_UI.dev[id] = { state: "open", ms: null, pending: true, at: Date.now() };
    try { ctx && ctx.rerenderView && ctx.rerenderView("dns"); } catch (_) {}
    DNS_UI.dev[id] = await dnsDeviceProbeOne(srv.url);
    DNS_UI.deviceAt = Date.now();
    dnsSave();
    try { ctx && ctx.rerenderView && ctx.rerenderView("dns"); } catch (_) {}
  }
  if (!window.__omniDnsBound) {
    window.__omniDnsBound = true;
    const dnsRerender = () => {
      try {
        const ctx = window.__omniE || window.__omniLastE;
        if (ctx && typeof ctx.rerenderView === "function") ctx.rerenderView("dns");
      } catch (_) {}
    };
    document.addEventListener("input", (ev) => {
      const t = ev.target;
      if (!t || !t.id) return;
      if (t.id === "dns-search") {
        /* live filtering without a full rerender so the input keeps focus;
           haystack is scoped to identity fields so the shared inspector labels never match */
        DNS_UI.search = t.value; dnsSave();
        const q = t.value.trim().toLowerCase();
        document.querySelectorAll(".dns-grid .dns-card").forEach((card) => {
          const hay = String(card.dataset.dnsHaystack || card.textContent).toLowerCase();
          card.classList.toggle("hide", !(!q || hay.includes(q)));
        });
      } else if (t.id === "dns-qname") {
        DNS_UI.qname = t.value.trim() || "example.com"; dnsSave();
      }
    });
    document.addEventListener("change", (ev) => {
      const t = ev.target;
      if (!t || !t.id) return;
      if (t.id === "dns-hide-dead") { DNS_UI.hideDead = t.checked; dnsSave(); dnsRerender(); }
      else if (t.id === "dns-qtype") { DNS_UI.qtype = t.value; dnsSave(); dnsRerender(); }
    });
    document.addEventListener("toggle", (ev) => {
      try {
        const det = ev.target && ev.target.closest ? ev.target.closest('details[data-dns-details]') : null;
        if (det) { DNS_UI.expanded = det.open ? String(det.dataset.dnsDetails || "") : ""; dnsSave(); }
      } catch (_) {}
    }, true);
  }
