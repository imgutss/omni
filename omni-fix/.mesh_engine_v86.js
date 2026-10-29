  /* ═══════════════════════════════════════════════════════════════════════
     rev146 — Causal Mesh: ریشه‌گیری سه بخش معیوب
       · VLESS  = سنجش ورکر آگاه به مسیر واقعی سرویس (Host/Path): «مسیر کامل» در برابر «فقط لبه»
       · تشخیص سه‌لایه = DNS چندارائه‌دهنده، لبه روی ۸ میزبان با شمارش واقعی، خروج روی پورت خودِ اندپوینت
       · نسخه‌های زنده = ساخت سه نسخه از مخزن IP حتی پیش از اعمال دستی + کرون با پروب واقعی
     ═══════════════════════════════════════════════════════════════════════ */
  var MESH = {
    mode: "tcp",
    running: false,
    runs: { tcp: null, vless: null, udp: null },
    bench: null,
    benchBusy: false,
    live: null,
    liveBusy: "",
    diag: null,
    diagBusy: false,
    history: null,
    historyAt: 0,
    resetBusy: false,
    watchTimer: 0,
    storeKey: "omni.mesh.v6",
    MAX_ROWS: 120
  };
  var MESH_TLS_PORTS = [443, 2053, 2083, 2087, 2096, 8443];
  var MESH_STUN_TARGETS = [
    { host: "stun.cloudflare.com:3478", label: "Cloudflare" },
    { host: "stun.l.google.com:19302", label: "Google" },
    { host: "stun1.l.google.com:19302", label: "Google 2" },
    { host: "global.stun.twilio.com:3478", label: "Twilio" },
    { host: "stun.nextcloud.com:443", label: "Nextcloud" }
  ];
  var MESH_MODE_LABEL = { tcp: "TCP / پورت‌ها", vless: "VLESS / پروتکل", udp: "UDP / STUN" };

  function meshPaint(e) {
    try { if (e && typeof e.rerenderView === "function") { e.rerenderView("mesh"); return; } } catch (err) {}
    try { const c1 = window.__omniE; if (c1 && typeof c1.rerenderView === "function") { c1.rerenderView("mesh"); return; } } catch (err) {}
    try { const c2 = window.__omniLastE; if (c2 && typeof c2.rerenderView === "function") { c2.rerenderView("mesh"); return; } } catch (err) {}
    try { if (typeof fe === "function") { fe("mesh"); return; } } catch (err) {}
    try { const n = document.querySelector('[data-view="mesh"]'); if (n) n.click(); } catch (err) {}
  }

  /* عدد مثبت واقعی یا نال — جلوی ریشهٔ باگ Number(null)===0 («پینگ ۰ms» روی ردیف مرده) را می‌گیرد */
  function meshNum(x) { return typeof x === "number" && Number.isFinite(x) && x > 0 ? x : null; }
  function meshMs(x) { const n = meshNum(x); return n === null ? "—" : v(n); }

  function meshStoreLoad() {
    try {
      const z = JSON.parse(localStorage.getItem(MESH.storeKey) || "null");
      if (z && typeof z === "object") ["tcp", "vless", "udp"].forEach((k) => { if (z[k] && z[k].mode) MESH.runs[k] = z[k]; });
    } catch {}
  }
  function meshStoreSave() {
    try { localStorage.setItem(MESH.storeKey, JSON.stringify(MESH.runs)); } catch {}
  }

  function meshLibRows() {
    const seen = new Set();
    const out = [];
    omniVerifiedLib().forEach((x) => {
      if (!x || !omniEpOk(x.ep) || seen.has(x.ep)) return;
      seen.add(x.ep);
      const hp = omniEpHostPort(x.ep);
      out.push({
        ep: wsParseEndpoint(x.ep).normalized || x.ep,
        host: hp.host,
        port: hp.port,
        fam: omniEpFam(x.ep),
        label: String(x.note || "").trim(),
        src: x.src || "lib"
      });
    });
    return out.slice(0, MESH.MAX_ROWS);
  }

  function meshStats(samples, sent) {
    if (!samples || !samples.length) return { p50: null, p95: null, jitter: null, loss: 100 };
    const s2 = [...samples].sort((a2, b2) => a2 - b2);
    const p50 = s2[Math.floor(s2.length / 2)];
    const p95 = s2[Math.min(s2.length - 1, Math.floor(s2.length * 0.95))];
    let jitter = 0;
    for (let i = 1; i < samples.length; i++) jitter += Math.abs(samples[i] - s2[i - 1]);
    jitter = Math.round(jitter / Math.max(1, samples.length - 1));
    return { p50, p95, jitter, loss: Math.round(((sent - samples.length) / Math.max(1, sent)) * 100) };
  }
  function meshSparkline(samples) {
    if (!samples || !samples.length) return "";
    const max = Math.max(...samples, 1);
    const w = 180, h = 34;
    const pts = samples
      .map((val, i) => `${Math.round((i / Math.max(1, samples.length - 1)) * w)},${Math.round(h - (val / max) * (h - 4) - 2)}`)
      .join(" ");
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block;max-width:100%"><polyline fill="none" stroke="var(--ok)" stroke-width="1.6" points="${pts}"/></svg>`;
  }
  function meshFmtTime(iso) {
    try { return new Date(String(iso).replace(" ", "T") + (String(iso).includes("Z") ? "" : "Z")).toLocaleString("fa-IR"); }
    catch { return String(iso || "—"); }
  }

  async function meshPool(items, conc, fn) {
    const out = new Array(items.length);
    let idx = 0;
    const workers = Array.from({ length: Math.max(1, Math.min(conc, items.length)) }, async () => {
      while (idx < items.length) { const i = idx++; out[i] = await fn(items[i], i); }
    });
    await Promise.all(workers);
    return out;
  }

  /* پروب واقعی دستگاه: no-cors TLS روی یک (هاست، پورت) مشخص */
  function meshPortProbe(host, port) {
    const t0 = performance.now();
    const timeout = 2600;
    const url = "https://" + (host.indexOf(":") >= 0 ? "[" + host + "]" : host) + ":" + port + "/cdn-cgi/trace?z=" + Math.random().toString(36).slice(2);
    return fetch(url, { mode: "no-cors", cache: "no-store", redirect: "follow", signal: labTimeoutSignal(timeout) })
      .then(function () { return { state: "open", ms: Math.max(1, Math.round(performance.now() - t0)) }; })
      .catch(function (err) {
        const dt = Math.max(1, Math.round(performance.now() - t0));
        if (err && err.name === "TimeoutError") return { state: "filtered", ms: null, tmoMs: dt };
        if (dt < 2500) return { state: "handshake", ms: dt };
        return { state: "filtered", ms: null, tmoMs: dt };
      });
  }
  async function meshMapProbes(items, conc) {
    const out = {};
    await meshPool(items, conc, async (it) => { out[it.key] = await meshPortProbe(it.host, it.port); });
    return out;
  }

  function meshFamStats(rows, reachable, pingOf) {
    return [4, 6].map((fam) => {
      const rs = rows.filter((r) => r.fam === fam);
      const reach = rs.filter(reachable);
      const pings = rs.map(pingOf).filter((m) => meshNum(m) !== null);
      return {
        fam, total: rs.length, open: reach.length,
        bestMs: pings.length ? Math.min.apply(null, pings) : null,
        loss: rs.length ? Math.round(((rs.length - reach.length) / rs.length) * 100) : null
      };
    });
  }

  async function meshRun(e) {
    if (MESH.running) return;
    MESH.running = true;
    meshPaint(e);
    try {
      const facts = { at: new Date().toISOString(), net: null, ipVersion: "", colo: "", udp: { ok: false, ms: null, ip: "", fam: null } };
      const ns = await x("POST", "/api/diag/net-sense", { apply: false }, { retry: 0, signal: AbortSignal.timeout(10000) }).catch(() => null);
      if (ns) { facts.net = ns.isp || null; facts.ipVersion = ns.ipVersion || ""; facts.colo = ns.colo || ""; }
      const rows0 = meshLibRows();
      if (!rows0.length) throw new Error("هیچ اندپوینتی در مخزن تأییدشده وجود ندارد");

      if (MESH.mode === "udp") MESH.runs.udp = await meshRunUdp(facts, rows0);
      else if (MESH.mode === "vless") MESH.runs.vless = await meshRunVless(facts, rows0);
      else MESH.runs.tcp = await meshRunTcp(facts, rows0);

      meshStoreSave();
      MESH.historyAt = 0;
      y("سنجش کامل " + MESH_MODE_LABEL[MESH.mode] + " تمام شد — " + rows0.length + " اندپوینت، تک‌تک سنجیده شد", "ok");
    } catch (err) {
      y("سنجش نیمه‌کاره ماند: " + String(err?.message || err), "err");
    } finally {
      MESH.running = false;
      meshPaint(e);
    }
  }

  /* TCP: پورت خودِ اندپوینت + ۶ پورت TLS برای تک‌تک آی‌پی‌ها + سنجش واقعی ورکر (سوکت/ساب‌ریکوئست) */
  async function meshRunTcp(facts, rows0) {
    const lineV6 = facts.ipVersion !== "IPv4";
    const rowPorts = (r) => [...new Set([Number(r.port), ...MESH_TLS_PORTS])].filter((p) => Number.isInteger(p) && p > 0 && p < 65536).slice(0, 12);
    const items = [];
    rows0.forEach((r) => rowPorts(r).forEach((port) => items.push({ key: r.ep + "|" + port, host: r.host, port })));
    const devMap = await meshMapProbes(items, 8);

    let wkMap = {};
    try {
      const resp = await x("POST", "/api/mesh/probe", {
        mode: "tcp",
        rows: rows0.map((r) => ({ ep: r.ep, ports: rowPorts(r) }))
      }, { retry: 0, signal: AbortSignal.timeout(60000) });
      wkMap = resp?.results || {};
    } catch {}

    const rows = rows0.map((r) => {
      const dev = {};
      rowPorts(r).forEach((p) => {
        const got = devMap[r.ep + "|" + p] || { state: "filtered", ms: null, tmoMs: null };
        if (r.fam === 6 && !lineV6 && got.state !== "open") dev[p] = { ...got, state: "no-v6" };
        else dev[p] = got;
      });
      return { ...r, ports: rowPorts(r), dev, wk: wkMap[r.ep] || null };
    });
    rows.sort((a, b) => (a.fam - b.fam) || (meshBestMs(a) - meshBestMs(b)));

    const reachable = (r) => r.ports.some((p) => r.dev[p]?.state === "open" || r.dev[p]?.state === "handshake");
    const famStats = meshFamStats(rows, reachable, (r) => meshNum(meshBestMs(r)));
    const result = {
      mode: "tcp", at: facts.at, facts, rows, famStats,
      summary: {
        total: rows.length,
        hostsOpen: rows.filter(reachable).length,
        openPorts: rows.reduce((n, r) => n + r.ports.filter((p) => r.dev[p]?.state === "open").length, 0),
        noV6: rows.filter((r) => r.fam === 6 && !lineV6).length,
        workerMeasured: rows.filter((r) => r.wk && r.wk.ports && Object.keys(r.wk.ports).length).length,
        workerBlocked: rows.filter((r) => r.wk?.blocked).length,
        workerRoute: rows.filter((r) => r.wk && Object.values(r.wk.ports || {}).some((c) => c && c.route)).length,
        lineV6
      }
    };
    const boardRows = rows.map((r) => {
      const c443 = r.dev[443] || {};
      return { ep: r.ep, label: r.label, fam: r.fam, state: reachable(r) ? "open" : "filtered", ms: meshNum(c443.ms) };
    });
    x("POST", "/api/mesh/board", { mode: "tcp", rows: boardRows }, { retry: 0 }).catch(() => {});
    return result;
  }
  function meshBestMs(r) {
    let best = null;
    for (const p of (r.ports || MESH_TLS_PORTS)) {
      const n = meshNum(r.dev?.[p]?.ms);
      if (n !== null && (best === null || n < best)) best = n;
    }
    return best === null ? 9e9 : best;
  }

  /* VLESS: پورت خودِ اندپوینت و ۴۴۳ جداگانه برای هر ردیف، از دستگاه و ورکر */
  async function meshRunVless(facts, rows0) {
    const lineV6 = facts.ipVersion !== "IPv4";
    const items = [];
    rows0.forEach((r) => {
      items.push({ key: r.ep + "|own", host: r.host, port: Number(r.port) });
      if (Number(r.port) !== 443) items.push({ key: r.ep + "|443", host: r.host, port: 443 });
    });
    const devMap = await meshMapProbes(items, 8);

    let wkMap = {}, edges = [];
    try {
      const resp = await x("POST", "/api/mesh/probe", {
        mode: "vless",
        rows: rows0.map((r) => ({ ep: r.ep, ports: Number(r.port) !== 443 ? [Number(r.port), 443] : [443] }))
      }, { retry: 0, signal: AbortSignal.timeout(60000) });
      wkMap = resp?.results || {};
    } catch {}
    try {
      const er = await x("GET", "/api/mesh/edges", void 0, { retry: 0, signal: AbortSignal.timeout(8000) });
      edges = Array.isArray(er?.rows) ? er.rows : [];
    } catch {}

    const rows = rows0.map((r) => {
      const own = devMap[r.ep + "|own"] || { state: "filtered", ms: null, tmoMs: null };
      const c443 = Number(r.port) === 443 ? own : (devMap[r.ep + "|443"] || { state: "filtered", ms: null, tmoMs: null });
      const fix = (got, fam) => (fam === 6 && !lineV6 && got.state !== "open") ? { ...got, state: "no-v6" } : got;
      const dev = fix(own, r.fam);
      const dev443 = fix(c443, r.fam);
      return { ...r, dev, dev443, wk: wkMap[r.ep] || null };
    });
    rows.sort((a, b) => (a.fam - b.fam) || ((meshNum(a.dev.ms) ?? 9e9) - (meshNum(b.dev.ms) ?? 9e9)));

    const reachable = (r) => r.dev.state === "open" || r.dev.state === "handshake" || r.dev443.state === "open" || r.dev443.state === "handshake";
    const famStats = meshFamStats(rows, reachable, (r) => meshNum(r.dev.ms) ?? meshNum(r.dev443.ms));
    const result = {
      mode: "vless", at: facts.at, facts, rows, edges, famStats,
      summary: {
        total: rows.length,
        transportOpen: rows.filter(reachable).length,
        workerMeasured: rows.filter((r) => r.wk && r.wk.ports && Object.keys(r.wk.ports).length).length,
        workerBlocked: rows.filter((r) => r.wk?.blocked).length,
        workerRoute: rows.filter((r) => r.wk && Object.values(r.wk.ports || {}).some((c) => c && c.route)).length,
        realTrafficColos: edges.length,
        noV6: rows.filter((r) => r.fam === 6 && !lineV6).length,
        lineV6
      }
    };
    const boardRows = rows.map((r) => ({ ep: r.ep, label: r.label, fam: r.fam, state: reachable(r) ? "open" : "filtered", ms: meshNum(r.dev.ms) }));
    x("POST", "/api/mesh/board", { mode: "vless", rows: boardRows }, { retry: 0 }).catch(() => {});
    return result;
  }

  /* UDP: هر سرور STUN یک آیتم مستقل با پینگ/باخت واقعی خودش */
  async function meshRunUdp(facts, rows0) {
    const SAMPLES = 2;
    const targets = await meshPool(MESH_STUN_TARGETS, 3, async (t) => {
      const attempts = [];
      for (let i = 0; i < SAMPLES; i++) {
        const r = await omniStun(t.host, 3500);
        attempts.push({ i: i + 1, ok: !!r.ok, ms: meshNum(r.ms), ip: r.ip || "", fam: r.fam || null });
      }
      const ok = attempts.filter((a) => a.ok);
      const samples = ok.map((a) => a.ms).filter((m) => meshNum(m) !== null);
      const st = meshStats(samples, attempts.length);
      const ip = ok.map((a) => a.ip).find(Boolean) || "";
      const fam = ok.map((a) => a.fam).find(Boolean) || null;
      return { target: t.host, label: t.label, attempts, sent: attempts.length, okCount: ok.length, samples, st, ip, fam };
    });

    const allAttempts = targets.flatMap((t) => t.attempts);
    const allSamples = allAttempts.filter((a) => a.ok).map((a) => a.ms).filter((m) => meshNum(m) !== null);
    const st = meshStats(allSamples, allAttempts.length);
    const firstOk = targets.find((t) => t.okCount > 0);
    if (firstOk) {
      facts.udp.ok = true;
      facts.udp.ms = st.p50;
      facts.udp.ip = firstOk.ip;
      facts.udp.fam = firstOk.fam;
    }
    const fam6 = targets.some((t) => t.fam === 6);
    return {
      mode: "udp", at: facts.at, facts, targets, attempts: allAttempts, st,
      rows: [],
      summary: {
        total: 0,
        targetsTotal: targets.length,
        targetsOk: targets.filter((t) => t.okCount > 0).length,
        stunOk: allAttempts.filter((a) => a.ok).length,
        stunSent: allAttempts.length,
        loss: st.loss,
        v6: fam6,
        workerSupported: false
      }
    };
  }

  async function meshLoadLive(e, force) {
    if (!force && MESH.live && Date.now() - MESH.live.fetchedAt < 45000) return;
    try {
      const r = await x("GET", "/api/mesh/live", void 0, { retry: 0, signal: AbortSignal.timeout(10000) });
      if (r && r.ok) { r.fetchedAt = Date.now(); MESH.live = r; meshWatchArm(e); }
    } catch {}
  }
  function meshWatchArm(e) {
    try { clearInterval(MESH.watchTimer); } catch {}
    MESH.watchTimer = 0;
    if (!MESH.live || !MESH.live.watching) return;
    MESH.watchTimer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!document.querySelector(".mesh-hero")) return;
      meshLoadLive(e, true).catch(() => {});
    }, 60000);
  }
  async function meshLiveOp(e, body) {
    MESH.liveBusy = body.op || "op";
    meshPaint(e);
    try {
      const r = await x("POST", "/api/mesh/live", body, { retry: 0, signal: AbortSignal.timeout(15000) });
      if (r?.settings) { try { e.setSettings(r.settings); } catch (err) {} }
      MESH.live = null;
      await meshLoadLive(e, true);
    } catch (err) {
      y(String(err?.message || err), "err");
    } finally {
      MESH.liveBusy = "";
      meshPaint(e);
    }
  }

  /* rev146 — DNS چندارائه‌دهنده: یک DoH بسته باشد نباید کل لایه را «بسته» اعلام کند */
  async function meshDnsCheck(publicHost) {
    const providers = [
      "https://cloudflare-dns.com/dns-query",
      "https://1.1.1.1/dns-query",
      "https://dns.google/resolve",
      "https://dns.quad9.net:5053/dns-query"
    ];
    const names = ["cloudflare.com", "www.gstatic.com"];
    try {
      const h = String(publicHost || "").replace(/^https?:\/\//i, "").split("/")[0];
      if (h && /\.[a-z]{2,}$/i.test(h) && !/^\d+\.\d+\.\d+\.\d+$/.test(h)) names.unshift(h);
    } catch {}
    const tried = [];
    for (const base of providers) {
      for (const name of names) {
        try {
          const ctrl = new AbortController();
          const tm = setTimeout(() => ctrl.abort(), 3500);
          const r = await fetch(base + "?name=" + encodeURIComponent(name) + "&type=A", {
            headers: { accept: "application/dns-json" }, cache: "no-store", signal: ctrl.signal
          });
          clearTimeout(tm);
          const j = await r.json().catch(() => null);
          tried.push({ base: base.split("/")[2], name, ok: !!(r.ok && j && (j.Status === 0 || Array.isArray(j.Answer))) });
          if (r.ok && j && (j.Status === 0 || Array.isArray(j.Answer))) return { ok: true, via: base.split("/")[2], name, tried };
        } catch (err) {
          tried.push({ base: base.split("/")[2], name, ok: false });
        }
      }
    }
    return { ok: false, via: "", name: "", tried };
  }

  async function meshDiag(e) {
    if (MESH.diagBusy) return;
    MESH.diagBusy = true;
    meshPaint(e);
    const out = { dns: null, dnsVia: "", edge: null, edgeCount: null, exit: null, exitEp: "", exitMs: null, exitColo: "", exitState: "", exitVia: "", exitRoute: false, exitService: null, title: "", detail: "", at: new Date().toISOString() };
    try {
      const settings0 = (typeof e?.settings === "function" ? e.settings() : e?.settings) || {};

      /* لایه ۱ — DNS از خط تو، با چهار ارائه‌دهندهٔ مستقل */
      const dns = await meshDnsCheck(settings0.public_host || "");
      out.dns = dns.ok;
      out.dnsVia = dns.via || "";

      /* لایه ۲ — لبه روی ۸ میزبان واقعی مخزن، با شمارش نه بولین مبهم */
      const lib = meshLibRows();
      const hosts = [...new Set(lib.map((r) => r.host))].slice(0, 8);
      const pr = await wsRepoProbeIps(hosts);
      const vals = Object.values(pr);
      const edgeOk = vals.filter((p) => p && p.ok).length;
      out.edge = edgeOk > 0;
      out.edgeCount = { ok: edgeOk, total: vals.length };

      /* لایه ۳ — خروج از دید ورکر روی پورت خودِ بهترین اندپوینت سنجش‌شده */
      let ep = (MESH.live && MESH.live.active) || "";
      if (!ep) {
        const run = MESH.runs[MESH.mode];
        if (run && Array.isArray(run.rows)) {
          const reach = run.rows.find((r2) => run.mode === "tcp"
            ? r2.ports.some((p) => ["open", "handshake"].includes(r2.dev[p]?.state))
            : ["open", "handshake"].includes(r2.dev?.state) || ["open", "handshake"].includes(r2.dev443?.state));
          ep = reach ? reach.ep : (run.rows[0] && run.rows[0].ep) || "";
        }
        if (!ep && lib[0]) ep = lib[0].ep;
      }
      try {
        const ex = await x("POST", "/api/mesh/exit", { ep }, { retry: 0, signal: AbortSignal.timeout(9000) });
        out.exit = !!ex?.alive;
        out.exitEp = ep;
        out.exitMs = ex?.ms ?? null;
        out.exitColo = ex?.colo || "";
        out.exitState = ex?.state || "";
        out.exitVia = ex?.via || "";
        out.exitRoute = !!ex?.route;
        out.exitService = ex?.service || null;
      } catch { out.exit = false; out.exitEp = ep; }

      if (!out.dns && out.edge) {
        out.title = "DNS خط تو مشکل دارد، لبه باز است";
        out.detail = "هر چهار ارائه‌دهندهٔ DoH از خط تو بی‌پاسخ بودند ولی لبه روی " + edgeOk + " میزبان از " + vals.length + " جواب داد: DNS آلوده یا بسته است. اندپوینت را عوض نکن؛ اول DNS گوشی را عوض کن.";
      } else if (out.dns && !out.edge) {
        out.title = "تحریم لبه";
        out.detail = "DNS سالم است (از " + (out.dnsVia || "DoH") + ") ولی هیچ‌کدام از " + vals.length + " لبهٔ مخزن روی ۴۴۳ جواب نداد. نسخهٔ دیگری از اندپوینت‌ها یا اپراتور دیگر را امتحان کن.";
      } else if (out.dns && out.edge && !out.exit) {
        if (out.exitService && out.exitService.route) {
          out.title = "خودِ سرویس سالم است؛ این اندپوینت به آن نمی‌رسد";
          out.detail = "خط تو، DNS و لبه سالم‌اند و ورکر روی hostname عمومی خودش پاسخ کامل سرویس را می‌گیرد، ولی پورت خودِ " + (ep || "این اندپوینت") + " مسیر سرویس را اثبات نکرد. اندپوینت یا نسخهٔ دیگری انتخاب کن؛ سرویس خراب نیست.";
        } else {
          out.title = "مسیر خروج مشکل دارد";
          out.detail = "خط تو، DNS و لبه سالم‌اند، ولی ورکر روی پورت خودِ اندپوینت به " + (ep || "مقصد") + " نرسید. اندپوینت دیگری انتخاب کن.";
        }
      } else if (!out.dns && !out.edge) {
        out.title = "خط از دو طرف بسته است";
        out.detail = "نه DNS و نه هیچ لبه‌ای از این خط جواب نداد. شبکه/اپراتور را عوض کن و دوباره بسنج.";
      } else {
        out.title = "هر سه لایه سالم است";
        out.detail = "DNS، لبه (" + edgeOk + "/" + vals.length + ") و مسیر خروج ورکر" + (out.exitRoute ? " تا مسیر کامل سرویس" : "") + " جواب دادند. اگر باز هم وصل نمی‌شوی مشکل در کانفیگ یا اپ است، نه در شبکه.";
      }
    } catch (err) {
      out.detail = String(err?.message || err);
    }
    MESH.diag = out;
    MESH.diagBusy = false;
    meshPaint(e);
  }

  async function meshHistory(e, force) {
    if (!force && MESH.history && Date.now() - MESH.historyAt < 60000) return;
    MESH.historyAt = Date.now();
    const emptyHours = () => Array.from({ length: 24 }, () => ({ total: 0, ok: 0 }));
    try {
      const [score, board] = await Promise.all([
        x("GET", "/api/mesh/score", void 0, { retry: 0, signal: AbortSignal.timeout(10000) }).catch(() => null),
        x("GET", "/api/mesh/board", void 0, { retry: 0, signal: AbortSignal.timeout(10000) }).catch(() => null)
      ]);
      const samples = Array.isArray(board?.samples) ? board.samples : [];
      const hours = emptyHours();
      samples.forEach((row) => {
        const d = new Date(String(row.at || "").replace(" ", "T") + "Z");
        if (isNaN(d.getTime())) return;
        const h = d.getHours();
        hours[h].total += 1;
        if (row.ok) hours[h].ok += 1;
      });
      MESH.history = { mine: score?.mine || null, weights: score?.weights || "", cohort: score?.cohort || "", samples: samples.length, hours };
    } catch {
      MESH.history = MESH.history || { mine: null, weights: "", cohort: "", samples: 0, hours: emptyHours() };
    }
    meshPaint(e);
  }

  async function meshReset(e) {
    if (MESH.resetBusy) return;
    if (!confirm("همهٔ داده‌های سنجشِ ذخیره‌شده در سرور (تاریخچه، امتیاز، شواهد لبه، رویدادها) و روی این گوشی پاک شود؟ از این بعد فقط سنجش واقعی خودت ثبت می‌شود.")) return;
    MESH.resetBusy = true;
    meshPaint(e);
    try {
      await x("POST", "/api/mesh/reset", {}, { retry: 0 });
      try { localStorage.removeItem(MESH.storeKey); } catch {}
      MESH.runs = { tcp: null, vless: null, udp: null };
      MESH.history = null; MESH.historyAt = 0; MESH.diag = null; MESH.live = null; MESH.bench = null;
      y("همهٔ داده‌های این بخش پاک شد", "ok");
    } catch (err) {
      y(String(err?.message || err), "err");
    } finally {
      MESH.resetBusy = false;
      meshPaint(e);
    }
  }

  async function meshBench(e) {
    if (MESH.benchBusy) return;
    MESH.benchBusy = true;
    meshPaint(e);
    try {
      const b = await ladderWsBench(20);
      const st = meshStats(b.samples, b.sent || 20);
      MESH.bench = { samples: b.samples, sent: b.sent || 20, st, at: Date.now() };
      const cohort = MESH.runs[MESH.mode]?.facts?.net?.code || "";
      x("POST", "/api/mesh/bench", { cohort, p50: st.p50, p95: st.p95, loss: st.loss, samples: b.sent || 20 }, { retry: 0 }).catch(() => {});
    } catch (err) {
      y(String(err?.message || err), "err");
    } finally {
      MESH.benchBusy = false;
      meshPaint(e);
    }
  }

  async function meshApply(e, ep) {
    ep = String(ep || "").trim();
    if (!omniEpOk(ep)) { y("اندپوینت معتبر نیست", "err"); return; }
    try {
      const saved = await x("POST", "/api/mesh/apply", { mode: MESH.mode, ep }, { retry: 0 });
      if (saved?.settings) e.setSettings(saved.settings);
      else { try { await omniSaveEndpoint(ep); } catch {} }
      y("اندپوینت روی کانفیگ‌ها اعمال شد: " + ep, "ok");
      MESH.live = null;
      await meshLoadLive(e, true);
    } catch (err) {
      y(String(err?.message || err), "err");
    }
    meshPaint(e);
  }

  /* rev146 — اعمال بهترین اندپوینتِ پاسخ‌گوی آخرین سنجش به نسخه‌های زنده، بدون حدس */
  async function meshApplyBest(e) {
    const run = MESH.runs[MESH.mode];
    if (!run || !Array.isArray(run.rows)) { y("اول یک سنجش کامل انجام بده", "err"); return; }
    const reachable = (r2) => run.mode === "tcp"
      ? r2.ports.some((p) => ["open", "handshake"].includes(r2.dev[p]?.state))
      : ["open", "handshake"].includes(r2.dev?.state) || ["open", "handshake"].includes(r2.dev443?.state);
    const best = run.rows.find(reachable);
    if (!best) { y("در آخرین سنجش هیچ اندپوینت پاسخ‌گویی پیدا نشد", "err"); return; }
    await meshApply(e, best.ep);
  }

  /* برچسب‌های صادقانه: پینگ فقط با عدد مثبت واقعی سبز می‌شود */
  function meshStateBadge(state, ms) {
    if (state === "open") return `<span class="badge ok">باز · ${meshMs(ms)}ms</span>`;
    if (state === "handshake") return `<span class="badge ok">دست‌دادن/SNI · ${meshMs(ms)}ms</span>`;
    if (state === "filtered") return '<span class="badge danger">فیلتر/بی‌پاسخ</span>';
    if (state === "no-v6") return `<span class="badge warn" title="تلاش واقعی انجام شد؛ این خط مسیر IPv6 ندارد">بی‌مسیر v6 · تلاش ${meshMs(ms)}ms</span>`;
    if (state === "cf-blocked") return '<span class="badge" title="سنجش ساب‌ریکوئست هم برای این مقصد ممکن نشد">ورکر: بدون پاسخ</span>';
    if (state === "closed") return '<span class="badge danger">بسته</span>';
    if (state === "unsupported") return '<span class="badge">پشتیبانی نمی‌شود</span>';
    return '<span class="badge">سنجیده نشده</span>';
  }
  function meshPingBadge(ms) {
    const n = meshNum(ms);
    return n === null
      ? '<span class="badge">پینگ: بدون پاسخ</span>'
      : `<span class="badge ok">پینگ: ${meshMs(n)}ms</span>`;
  }
  function meshDevBadge(label, dev) {
    if (!dev) return `<span class="badge">${label}: —</span>`;
    if (dev.state === "no-v6") return `<span class="badge warn" title="تلاش واقعی روی همین اندپوینت انجام شد؛ خط مسیر IPv6 ندارد">${label}: بی‌مسیر v6 · ${meshMs(dev.ms)}ms</span>`;
    if (dev.state === "open") return `<span class="badge ok">${label}: TLS کامل · ${meshMs(dev.ms)}ms</span>`;
    if (dev.state === "handshake") return `<span class="badge ok">${label}: دست‌دادن/SNI · ${meshMs(dev.ms)}ms</span>`;
    if (dev.state === "filtered") return `<span class="badge danger">${label}: بی‌پاسخ · تایم‌اوت ${meshMs(dev.tmoMs)}ms</span>`;
    return `<span class="badge danger">${label}: بی‌پاسخ</span>`;
  }
  function meshWkBadge(wk, port) {
    if (!wk || !wk.ports || !Object.keys(wk.ports).length) return '<span class="badge">ورکر: —</span>';
    if (wk.blocked) return '<span class="badge">ورکر: بدون پاسخ</span>';
    const cell = port && wk.ports[port] ? wk.ports[port] : Object.values(wk.ports)[0];
    if (!cell) return '<span class="badge">ورکر: —</span>';
    const via = cell.via === "subrequest" ? "ساب‌ریکوئست" : "سوکت";
    const colo = cell.colo ? " · colo " + cell.colo : "";
    /* route=true یعنی درخواست با Host/Path واقعی به خودِ سرویس ورکر رسید (پاسخ JSON/api)؛
       در غیر این صورت فقط لبهٔ کلادفلر جواب داده — این تفاوت دیگر پنهان نمی‌شود */
    if (cell.state === "open") return cell.route
      ? `<span class="badge ok" title="سنجش واقعی ورکر (${via}) — مسیر کامل سرویس با Host/Path واقعی${colo}">ورکر: مسیر کامل · ${meshMs(cell.ms)}ms</span>`
      : `<span class="badge info" title="سنجش واقعی ورکر (${via}) — فقط لبه پاسخ داد، مسیر سرویس اثبات نشد${colo}">ورکر: فقط لبه · ${meshMs(cell.ms)}ms</span>`;
    if (cell.state === "handshake") return `<span class="badge info" title="سنجش واقعی ورکر (${via}) — دست‌دادن TLS برقرار، پاسخ HTTP نگرفتیم${colo}">ورکر: SNI · ${meshMs(cell.ms)}ms</span>`;
    if (cell.state === "filtered") return `<span class="badge warn">ورکر: فیلتر (${via})</span>`;
    return `<span class="badge danger">ورکر: بسته (${via})</span>`;
  }
