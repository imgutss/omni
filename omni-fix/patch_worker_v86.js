// rev146 worker patch — root fixes for VLESS route evidence, three-layer diag, live variants.
const fs = require('fs');
let js = fs.readFileSync('/home/user/omni-fix/omni.v85.js', 'utf8');
const edits = [];
function rep(oldT, newT, label, expect = 1) {
  const n = js.split(oldT).length - 1;
  if (n !== expect) throw new Error(`anchor count ${n} (expected ${expect}) for: ${label}`);
  js = js.split(oldT).join(newT);
  edits.push(label);
}

/* W1 — route-aware subrequest: real Host+path proves the actual service chain, not just edge reachability */
const oldSub = `async function subrequestProbe(host, { port = 443, timeoutMs = 2400 } = {}) {
  const t0 = Date.now();
  const bracket = String(host).includes(":") ? "[" + host + "]" : host;
  const url = "https://" + bracket + ":" + Number(port) + "/cdn-cgi/trace?z=" + Math.random().toString(36).slice(2);
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { method: "GET", redirect: "manual", signal: ctrl.signal });
    clearTimeout(tm);
    return { state: "open", ms: Math.max(1, Date.now() - t0), via: "subrequest", http: r.status };
  } catch (e) {
    const dt = Math.max(1, Date.now() - t0);
    const msg = String((e && e.message) || e || "").toLowerCase();
    if (/abort|timeout|timed out/.test(msg)) return { state: "filtered", ms: null, via: "subrequest", tmoMs: dt };
    if (/tls|ssl|cert|handshake/.test(msg)) return { state: "handshake", ms: dt, via: "subrequest" };
    if (dt < timeoutMs - 250) return { state: "handshake", ms: dt, via: "subrequest" };
    return { state: "closed", ms: null, via: "subrequest", tmoMs: dt };
  }
}
__name(subrequestProbe, "subrequestProbe");`;
const newSub = `async function subrequestProbe(host, { port = 443, timeoutMs = 2400, routeHost = "", routePath = "" } = {}) {
  const t0 = Date.now();
  const bracket = String(host).includes(":") ? "[" + host + "]" : host;
  const path = routePath ? "/" + String(routePath).replace(/^\\//, "") : "/cdn-cgi/trace";
  const url = "https://" + bracket + ":" + Number(port) + path + (path.includes("?") ? "&" : "?") + "z=" + Math.random().toString(36).slice(2);
  const headers = {};
  if (routeHost) {
    try { headers.Host = String(routeHost).replace(/^https?:\\/\\//i, "").split("/")[0]; } catch (e) {}
  }
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { method: "GET", redirect: "manual", signal: ctrl.signal, headers });
    clearTimeout(tm);
    const dt = Math.max(1, Date.now() - t0);
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const ray = r.headers.get("cf-ray") || "";
    const colo = ray.includes("-") ? ray.split("-").pop().toUpperCase() : null;
    /* JSON/api answer means the request reached the actual worker route; CF zone-error pages are HTML */
    const route = ct.includes("application/json") || ct.includes("text/event-stream");
    return { state: "open", ms: dt, via: "subrequest", http: r.status, route, colo, ct: ct.slice(0, 40) };
  } catch (e) {
    const dt = Math.max(1, Date.now() - t0);
    const msg = String((e && e.message) || e || "").toLowerCase();
    if (/abort|timeout|timed out/.test(msg)) return { state: "filtered", ms: null, via: "subrequest", route: false, tmoMs: dt };
    if (/tls|ssl|cert|handshake/.test(msg)) return { state: "handshake", ms: dt, via: "subrequest", route: false };
    if (dt < timeoutMs - 250) return { state: "handshake", ms: dt, via: "subrequest", route: false };
    return { state: "closed", ms: null, via: "subrequest", route: false, tmoMs: dt };
  }
}
__name(subrequestProbe, "subrequestProbe");
/* rev146 — unified real reachability: raw socket for non-CF, route-aware subrequest for CF ranges */
async function meshReachability(host, port, opts = {}) {
  const cleanHost = String(host || "").trim().replace(/^\\[|\\]$/g, "");
  const p = Number(port) || 443;
  if (isCloudflareIp(cleanHost)) return subrequestProbe(cleanHost, { port: p, timeoutMs: opts.timeoutMs || 2600, routeHost: opts.routeHost || "", routePath: opts.routePath || "" });
  const tp = await tcpProbe(cleanHost, { port: p, timeoutMs: opts.timeoutMs || 2600 });
  return { state: tp.ok ? "open" : tp.code === "timeout" ? "filtered" : "closed", ms: tp.ms ?? null, via: "socket", route: false, colo: null };
}
__name(meshReachability, "meshReachability");
function meshRouteSettings(st) {
  const routeHost = String((st && st.public_host) || "").replace(/^https?:\\/\\//i, "").split("/")[0];
  const routePath = String((st && st.path) || "").trim();
  return { routeHost, routePath };
}
__name(meshRouteSettings, "meshRouteSettings");`;
rep(oldSub, newSub, 'W1 route-aware subrequestProbe + meshReachability');

/* W2 — probe endpoint: real service route for CF rows (both modes), settings-derived Host/path */
const oldProbeHead = `    const epRe = /^(\\[[0-9a-fA-F:]+\\]|[0-9]{1,3}(?:\\.[0-9]{1,3}){3}):(\\d{1,5})$/;
    const probeOne = async (r) => {`;
const newProbeHead = `    const epRe = /^(\\[[0-9a-fA-F:]+\\]|[0-9]{1,3}(?:\\.[0-9]{1,3}){3}):(\\d{1,5})$/;
    const pst = await settingsCached(env2);
    const { routeHost, routePath } = meshRouteSettings(pst);
    const probeOne = async (r) => {`;
rep(oldProbeHead, newProbeHead, 'W2 probe loads route settings');
rep(
  `        if (cfRange) {
          cells[port] = await subrequestProbe(host, { port, timeoutMs: 2400 });
        } else {`,
  `        if (cfRange) {
          cells[port] = await subrequestProbe(host, { port, timeoutMs: 2400, routeHost, routePath });
        } else {`,
  'W2 CF rows use real Host/path route');

/* W3 — /api/mesh/exit: own-port unified probe with route evidence, never hardcoded 443 */
const oldExit = `  if (p2 === "/api/mesh/exit" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const ep = mesh2NormEp(body.ep || "");
    const host = mesh2Host(ep);
    if (!host) return bad("bad_endpoint", "اندپوینت معتبر نیست", 422);
    let probe = null;
    try { probe = await httpProbe(host, { timeoutMs: 3000 }); } catch (e) { probe = null; }
    return json({
      ok: true,
      ep: ep,
      alive: Boolean(probe && probe.alive),
      ms: probe && probe.ms ? Math.round(probe.ms) : null,
      colo: (probe && probe.colo) || null,
      scope: "worker-http-443"
    });
  }`;
const newExit = `  if (p2 === "/api/mesh/exit" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const ep = mesh2NormEp(body.ep || "");
    const host = mesh2Host(ep);
    if (!host) return bad("bad_endpoint", "اندپوینت معتبر نیست", 422);
    const port = Number((/:(\\d{1,5})$/.exec(ep) || [])[1]) || 2408;
    const pst2 = await settingsCached(env2);
    const { routeHost, routePath } = meshRouteSettings(pst2);
    let probe = null;
    try { probe = await meshReachability(host, port, { routeHost, routePath, timeoutMs: 3000 }); } catch (e) { probe = null; }
    const alive = Boolean(probe && (probe.state === "open" || probe.state === "handshake"));
    /* rev146 — اگر لبه جواب داد ولی این IP مستقیماً مسیر سرویس را اثبات نکرد،
       خودِ سرویس از طریق hostname عمومی یک‌بار سنجیده می‌شود (تشخیص تناقض لبه/خروج) */
    let service = null;
    if (alive && probe.via === "subrequest" && !probe.route && routeHost && routePath) {
      try {
        const t0s = Date.now();
        const ctrlS = new AbortController();
        const tmS = setTimeout(() => ctrlS.abort(), 3000);
        const sr = await fetch("https://" + routeHost + routePath + (routePath.includes("?") ? "&" : "?") + "z=" + Math.random().toString(36).slice(2),
          { method: "GET", redirect: "manual", signal: ctrlS.signal });
        clearTimeout(tmS);
        const sct = (sr.headers.get("content-type") || "").toLowerCase();
        const sray = sr.headers.get("cf-ray") || "";
        /* هر پاسخ اپلیکیشنی (<500) از hostname خودِ ورکر یعنی لبه درست تا خود سرویس مسیریابی کرده؛
           خطاهای 5xx صفحهٔ خطای خودِ کلادفلرند، نه پاسخ سرویس */
        service = {
          state: "open",
          ms: Math.max(1, Date.now() - t0s),
          http: sr.status,
          route: sr.status < 500,
          colo: sray.includes("-") ? sray.split("-").pop().toUpperCase() : (probe.colo || null)
        };
      } catch (e) {
        service = { state: "closed", ms: null, route: false };
      }
    }
    return json({
      ok: true,
      ep: ep,
      alive: alive,
      state: probe ? probe.state : "error",
      ms: probe && probe.ms ? Math.round(probe.ms) : null,
      colo: (probe && probe.colo) || null,
      via: (probe && probe.via) || null,
      route: Boolean(probe && probe.route),
      service: service,
      scope: "worker-own-port"
    });
  }`;
rep(oldExit, newExit, 'W3 exit endpoint real own-port route probe');

/* W4 — live variants must exist before manual apply: fall back to the configured IP pool */
rep(
  `  safeArray(st.clean_ips).slice(0, 8).forEach((x) => push(x, "آی‌پی تمیز"));
  /* rev141 — هیچ اندپوینت هاردکد/سیدشده‌ای اضافه نمی‌شود؛ خالی بودن یعنی حالت تهی صادقانه */
  return out;`,
  `  safeArray(st.clean_ips).slice(0, 8).forEach((x) => push(x, "آی‌پی تمیز"));
  /* rev146 — اگر کاربر هنوز اندپوینتی اعمال نکرده، سه نسخهٔ زنده از مخزن IP تأییدشدهٔ همین پنل ساخته می‌شود */
  safeArray(st.ip_pool).slice(0, 12).forEach((x) => push(x, "مخزن IP"));
  return out;`,
  'W4 live slots fall back to configured IP pool');

/* W5 — live cron probes each slot on its own port via the unified real helper */
rep(
  `  const probes = await Promise.all(slots.map((s) =>
    httpProbe(mesh2Host(s.ep), { timeoutMs: 2600 }).catch(() => null)
  ));`,
  `  const cst = await settingsCached(env2);
  const { routeHost: rHost, routePath: rPath } = meshRouteSettings(cst);
  const probes = await Promise.all(slots.map((s) =>
    meshReachability(mesh2Host(s.ep), Number((/:(\\d{1,5})$/.exec(s.ep) || [])[1]) || 2408,
      { routeHost: rHost, routePath: rPath, timeoutMs: 2600 }).catch(() => null)
  ));`,
  'W5 cron uses own-port unified reachability');
rep(
  `    const alive = Boolean(p && p.alive);
    const before = prev.find((r) => r.slot === s.slot) || {};
    const fails = alive ? 0 : Number(before.fails || 0) + 1;
    return { ...s, alive: alive, ms: p && p.ms ? Math.round(p.ms) : null, fails: fails, state: alive ? "ok" : (p && p.error ? "fail" : "fail") };`,
  `    const alive = Boolean(p && (p.state === "open" || p.state === "handshake"));
    const before = prev.find((r) => r.slot === s.slot) || {};
    const fails = alive ? 0 : Number(before.fails || 0) + 1;
    return { ...s, alive: alive, ms: p && p.ms ? Math.round(p.ms) : null, fails: fails, state: alive ? "ok" : "fail", via: p ? p.via : null, route: Boolean(p && p.route) };`,
  'W5 cron state from real probe shape');

fs.writeFileSync('/home/user/omni-fix/omni.v86.base.js', js);
console.log('WORKER PATCH rev146 OK —', edits.length, 'edits:\n ' + edits.map((x, i) => `${i + 1}. ${x}`).join('\n '));
