  /* ═══════════════════════════════════════════════════════════════════════
     rev147 — Outbound v2 «سنجیده‌شده»: بازسازی ریشه‌ای بخش اوت‌باند
       · هر نود خروجی جداگانه و با همان قرارداد صادقانهٔ Mesh سنجیده می‌شود
         (CF → ساب‌ریکوئست واقعی، غیر-CF → سوکت خام؛ پینگ فقط عدد مثبت واقعی)
       · حالت UI در localStorage می‌ماند؛ رندر دوباره چیزی را گم نمی‌کند
       · کاتالوگ کشورها و ژنراتورهای کانفیگ دست‌نخورده می‌مانند؛ فقط دادهٔ
         زندهٔ سنجش به آن‌ها اضافه می‌شود — هیچ برچسب سلامت جعلی ساخته نمی‌شود
     ═══════════════════════════════════════════════════════════════════════ */
  var OB_STORE_KEY = "omni.outbound.v1";
  function obDefaultState() {
    return {
      relaySource: "auto",
      regionFilter: "all",
      searchQuery: "",
      entryMode: "natnet_snapp",
      selectedUserUuid: "",
      hideDead: false,
      cells: {},
      measuredAt: null,
      lastTest: null
    };
  }
  var OUTBOUND_UI = (() => {
    const base = obDefaultState();
    try {
      const saved = JSON.parse(localStorage.getItem(OB_STORE_KEY) || "{}");
      return { ...base, ...saved, cells: (saved.cells && typeof saved.cells === "object") ? saved.cells : {} };
    } catch { return base; }
  })();
  function obSave() {
    try { localStorage.setItem(OB_STORE_KEY, JSON.stringify(OUTBOUND_UI)); } catch {}
  }
  /* پینگ فقط و فقط عدد مثبت واقعی؛ نال/تایم‌اوت هرگز عدد نمی‌شود */
  function obNum(x) { return typeof x === "number" && Number.isFinite(x) && x > 0 ? x : null; }
  function obFmtMs(x) { const n = obNum(x); return n === null ? "بدون پاسخ" : v(n) + "ms"; }

  /* پارسر انواع ورودی اوت‌باند: لینک کامل vless/trojan/socks/http یا IP:Port خام */
  function obParseSpec(spec) {
    const s = String(spec || "").trim();
    if (!s) return null;
    const kind = detectOutboundProto(s);
    let host = "", port = 443;
    const uriM = /^(vless|trojan|socks5?|https?):\/\/([^/?#]+)/i.exec(s);
    if (uriM) {
      let rest = uriM[2];
      const at = rest.lastIndexOf("@");
      if (at >= 0) rest = rest.slice(at + 1);
      if (rest.startsWith("[")) {
        const m = /^\[([0-9a-fA-F:]+)\](?::(\d+))?$/.exec(rest);
        if (!m) return null;
        host = m[1]; port = Number(m[2]) || 443;
      } else {
        const m = /^([^:]+):(\d+)$/.exec(rest);
        if (!m) return null;
        host = m[1]; port = Number(m[2]) || 443;
      }
    } else {
      const m = /^(\[[0-9a-fA-F:]+\]|[^\s:]+):(\d+)$/.exec(s);
      if (!m) return null;
      host = m[1].replace(/^\[|\]$/g, ""); port = Number(m[2]) || 443;
    }
    if (!host || !(port > 0 && port < 65536)) return null;
    const fam = host.includes(":") ? 6 : 4;
    const ep = (fam === 6 ? "[" + host + "]" : host) + ":" + port;
    return { host, port, fam, ep, kind };
  }

  /* فهرست نودهای خروجی کاتالوگ؛ هر آیپی یک ردیف مستقل با پورت خودش */
  function obCountryEps(c) {
    const out = [];
    const push = (raw, vip) => {
      const str = String(raw || "").trim();
      if (!str) return;
      const host = str.split(":")[0];
      const port = Number(str.split(":")[1]) || 443;
      if (!host) return;
      const ep = (host.includes(":") ? "[" + host + "]" : host) + ":" + port;
      if (!out.some((x) => x.ep === ep)) out.push({ cc: c.cc, ep, vip });
    };
    (c.proxies || []).forEach((p) => push(p, false));
    (c.vipProxies || []).forEach((p) => push(p, true));
    return out;
  }
  function obAllCatalogEps() {
    const all = [];
    const seen = new Set();
    OUTBOUND_COUNTRIES.forEach((c) => obCountryEps(c).forEach((x) => {
      if (!seen.has(x.ep)) { seen.add(x.ep); all.push(x); }
    }));
    return all;
  }
  function obCustomEps(list) {
    const out = [];
    (list || []).forEach((item) => {
      const parsed = obParseSpec(item.spec);
      if (parsed) out.push({ id: item.id, ep: parsed.ep, kind: parsed.kind });
    });
    return out;
  }

  /* سنجش از دید ورکر با همان endpoint صادقانهٔ Mesh؛ دسته‌های ≤۱۰۰ (سقف ورکر ۱۲۰) */
  async function obProbeEps(eps) {
    const uniq = [...new Set((eps || []).filter(Boolean))].slice(0, 300);
    const now = new Date().toISOString();
    for (let i = 0; i < uniq.length; i += 100) {
      const batch = uniq.slice(i, i + 100);
      const resp = await x("POST", "/api/mesh/probe", {
        mode: "tcp",
        rows: batch.map((ep) => ({ ep, ports: [Number(ep.split(":").pop()) || 443] }))
      }, { retry: 0, signal: AbortSignal.timeout(60000) });
      const results = (resp && resp.results) || {};
      batch.forEach((ep) => {
        const port = Number(ep.split(":").pop()) || 443;
        const r = results[ep];
        const cell = r && r.ports && r.ports[port] ? r.ports[port] : null;
        OUTBOUND_UI.cells[ep] = cell
          ? { state: cell.state, ms: obNum(cell.ms), via: cell.via || null, route: Boolean(cell.route), colo: cell.colo || null, at: now }
          : { state: "closed", ms: null, via: null, route: false, colo: null, at: now, error: (r && r.error) || "no_answer" };
      });
    }
    OUTBOUND_UI.measuredAt = now;
    obSave();
  }
  function obCellOf(ep) { return OUTBOUND_UI.cells[ep] || null; }
  function obCellBadge(cell) {
    if (!cell) return '<span class="badge">سنجیده نشده</span>';
    if (cell.state === "open")
      return `<span class="badge ok">باز · ${v(obNum(cell.ms))}ms · ${cell.via === "subrequest" ? "ساب‌ریکوئست" : "سوکت"}</span>`;
    if (cell.state === "handshake")
      return `<span class="badge info">SNI · ${v(obNum(cell.ms))}ms</span>`;
    if (cell.state === "filtered") return '<span class="badge warn">بدون پاسخ (تایم‌اوت)</span>';
    return '<span class="badge danger">بسته</span>';
  }
  function obDot(cell) {
    const color = !cell ? "var(--text-faint)"
      : (cell.state === "open" || cell.state === "handshake") ? "var(--ok)"
      : cell.state === "filtered" ? "var(--warn)" : "var(--danger)";
    return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex:none"></span>`;
  }
  function obCountryStat(c) {
    const eps = obCountryEps(c);
    const measured = eps.map((x) => obCellOf(x.ep)).filter(Boolean);
    const aliveCells = measured.filter((c2) => c2.state === "open" || c2.state === "handshake");
    const mss = aliveCells.map((c2) => obNum(c2.ms)).filter((n) => n !== null).sort((a, b) => a - b);
    const median = mss.length ? mss[Math.floor(mss.length / 2)] : null;
    return { total: eps.length, measured: measured.length, alive: aliveCells.length, median };
  }
  function obGlobalStat() {
    const all = obAllCatalogEps();
    const measured = all.map((x) => obCellOf(x.ep)).filter(Boolean);
    const alive = measured.filter((c2) => ["open", "handshake"].includes(c2.state));
    return { total: all.length, measured: measured.length, alive: alive.length };
  }
  function obFmtTime(iso) {
    try { return new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
    catch { return "—"; }
  }
  /* قفل سنجش (ماندگار نمی‌شود)؛ رویدادهای change از لیسنر سراسری موجود پنل مدیریت می‌شوند */
  var obBusy = false;
