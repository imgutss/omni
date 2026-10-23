/* =========================================================================
 * OMNI · Managed Bot-Hosting (mb) — rebuilt from scratch, same architecture
 * as the managed Arvan relay: job table + idempotent state machine + locks,
 * tracked DNS records, token TTL, self-healing steps, clean JSON API.
 * Provider: bot-hosting.net (relay node) + ArvanCloud (DNS/CDN front domain).
 * ========================================================================= */
var MB_BOTH_API = "https://bot-hosting.net/api/v1";
var MB_ARVAN_API = "https://napi.arvancloud.ir/cdn/4.0/domains";
var MB_FALLBACK_EDGE_IP = "178.105.112.237";

function mbJson(x, status) {
  return Response.json(x, { status: status || 200, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
function mbFail(msg, status) {
  throw Object.assign(new Error(msg), { mbStatus: status || 400 });
}
function mbSleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function mbNow() { return Date.now(); }
function mbTokenShape(t) { return /^bhk_[A-Za-z0-9]{20,}$/.test(String(t || "").trim()); }

async function mbSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS managed_bothost_jobs(
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    zone TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    bhk_token TEXT NOT NULL DEFAULT '',
    bhk_expires INTEGER NOT NULL DEFAULT 0,
    arvan_token TEXT NOT NULL DEFAULT '',
    arvan_expires INTEGER NOT NULL DEFAULT 0,
    deployment_id TEXT NOT NULL DEFAULT '',
    node_host TEXT NOT NULL DEFAULT '',
    node_port INTEGER NOT NULL DEFAULT 0,
    apps_host TEXT NOT NULL DEFAULT '',
    edge_ip TEXT NOT NULL DEFAULT '',
    verify_token TEXT NOT NULL DEFAULT '',
    dns_created TEXT NOT NULL DEFAULT '[]',
    worker_host TEXT NOT NULL,
    ws_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'verify',
    last_error TEXT,
    check_count INTEGER NOT NULL DEFAULT 0,
    lock_until INTEGER NOT NULL DEFAULT 0,
    bridge_id INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();
  // Guarded migrations for tables created by earlier releases.
  const jobCols = await env.DB.prepare("PRAGMA table_info(managed_bothost_jobs)").all().catch(() => ({ results: [] }));
  const jobHave = new Set((jobCols.results || []).map((c) => c.name));
  for (const ddl of [
    "ALTER TABLE managed_bothost_jobs ADD COLUMN check_count INTEGER NOT NULL DEFAULT 0",
  ]) {
    const col = ddl.match(/ADD COLUMN (\w+)/)[1];
    if (!jobHave.has(col)) await env.DB.prepare(ddl).run().catch(() => {});
  }
  // Keep bot_bridges mirror compatible (repair the half-applied old migration).
  const cols = await env.DB.prepare("PRAGMA table_info(bot_bridges)").all().catch(() => ({ results: [] }));
  const have = new Set((cols.results || []).map((c) => c.name));
  for (const ddl of [
    "ALTER TABLE bot_bridges ADD COLUMN raw_host TEXT DEFAULT ''",
    "ALTER TABLE bot_bridges ADD COLUMN raw_port INTEGER DEFAULT 0",
    "ALTER TABLE bot_bridges ADD COLUMN custom_host TEXT DEFAULT ''",
    "ALTER TABLE bot_bridges ADD COLUMN custom_ok INTEGER DEFAULT 0",
    "ALTER TABLE bot_bridges ADD COLUMN arvan_edge INTEGER DEFAULT 0"
  ]) {
    const col = ddl.match(/ADD COLUMN (\w+)/)[1];
    if (!have.has(col)) await env.DB.prepare(ddl).run().catch(() => {});
  }
}

async function mbSave(env, id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  await env.DB.prepare("UPDATE managed_bothost_jobs SET " + keys.map((k) => k + "=?").join(",") + ",updated_at=? WHERE id=?")
    .bind(...keys.map((k) => fields[k]), mbNow(), id).run();
}
async function mbGet(env, id) {
  return env.DB.prepare("SELECT * FROM managed_bothost_jobs WHERE id=?").bind(id).first();
}
function mbPublic(j) {
  if (!j) return null;
  const needsToken = !j.bhk_token && j.status !== "ready";
  return {
    id: j.id, domain: j.domain, zone: j.zone, label: j.label,
    target: j.worker_host, path: j.ws_path, status: j.status, error: j.last_error,
    deployment_id: j.deployment_id, node_host: j.node_host, node_port: j.node_port,
    apps_host: j.apps_host, edge_ip: j.edge_ip, needs_token: needsToken,
    bridge_id: j.bridge_id, created_at: j.updated_at
  };
}

/* ----------------------------- HTTP clients ----------------------------- */
async function mbBothFetch(bhk, path, method, body, timeoutMs) {
  const opt = {
    method: method || "GET",
    headers: { authorization: "Bearer " + String(bhk || ""), accept: "application/json" },
    signal: AbortSignal.timeout(Math.max(3000, Number(timeoutMs) || 15000))
  };
  if (body !== undefined) { opt.headers["content-type"] = "application/json"; opt.body = JSON.stringify(body); }
  let r;
  try { r = await fetch(MB_BOTH_API + path, opt); }
  catch (e) { mbFail("پاسخ bot-hosting در زمان مجاز نرسید؛ دوباره تلاش کن.", 502); }
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch { j = null; }
  if (!r.ok) {
    const raw = j && j.error ? (j.error.message || j.error.code || JSON.stringify(j.error)) : txt.slice(0, 200);
    const e = new Error("bot-hosting: " + raw);
    e.mbStatus = r.status === 401 || r.status === 403 ? 400 : 502;
    throw e;
  }
  return j;
}
async function mbArvan(key, method, path, data) {
  const auth = /^apikey\s/i.test(key) ? key : "Apikey " + key;
  const r = await fetch(MB_ARVAN_API + path, {
    method, redirect: "manual",
    headers: { authorization: auth, accept: "application/json", "content-type": "application/json" },
    body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(data || {}),
    signal: AbortSignal.timeout(14000)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = String(j.message || j.error || (Array.isArray(j.errors) ? j.errors.join(" / ") : "") || ("HTTP " + r.status)).slice(0, 200);
    mbFail("آروان درخواست را نپذیرفت: " + msg, r.status === 401 || r.status === 403 ? 400 : 502);
  }
  return j.data;
}
async function mbResolve4(host) {
  if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return host || "";
  try {
    const r = await fetch("https://cloudflare-dns.com/dns-query?name=" + encodeURIComponent(host) + "&type=A", {
      headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(6000)
    });
    const d = await r.json().catch(() => null);
    const ip = String(((d && d.Answer) || []).map((a) => a.data).find((x) => /^\d+\.\d+\.\d+\.\d+$/.test(String(x))) || "");
    return ip;
  } catch { return ""; }
}
async function mbResolveAll4(host) {
  // Every public A record (Arvan returns several anycast edge IPs per domain).
  if (!host) return [];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return [host];
  try {
    const r = await fetch("https://cloudflare-dns.com/dns-query?name=" + encodeURIComponent(host) + "&type=A", {
      headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(6000)
    });
    const d = await r.json().catch(() => null);
    const out = [];
    for (const a of ((d && d.Answer) || [])) {
      const ip = String(a.data || "");
      if (/^\d+\.\d+\.\d+\.\d+$/.test(ip) && !out.includes(ip)) out.push(ip);
    }
    return out.slice(0, 4);
  } catch { return []; }
}

/* --------------------------- account discovery -------------------------- */
async function mbAccounts(body) {
  const bhk = String(body.bhk_token || "").trim();
  const arvanKey = String(body.arvan_token || "").trim();
  if (!mbTokenShape(bhk)) mbFail("کلید bot-hosting باید با bhk_ شروع شود.");
  if (arvanKey.length < 20) mbFail("کلید API آروان معتبر وارد کن.");
  const acc = await mbBothFetch(bhk, "/account");
  const deps = await mbBothFetch(bhk, "/deployments").catch(() => ({ deployments: [] }));
  const zonesRaw = await mbArvan(arvanKey, "GET", "?per_page=100");
  const zones = (Array.isArray(zonesRaw) ? zonesRaw : []).filter((z) => z.status === "active")
    .map((z) => ({ name: z.domain || z.name, status: z.status }))
    .filter((z) => /^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/.test(z.name));
  return {
    ok: true,
    bhk: {
      username: acc.username || "bot-hosting",
      email: acc.email || "",
      plan: acc.plan ? (acc.plan.name || acc.plan.tier || "free") : "",
      quota: acc.quota || null
    },
    deployments: (deps.deployments || []).map((d) => ({
      id: d.id, name: d.name, state: d.state || d.status || "",
      node: d.node && d.node.fqdn || "", port: d.port || 0,
      apps: d.domains && (d.domains.subdomain ? d.domains.subdomain + ".apps.bot-hosting.cloud" : d.domains.url || "") || "",
      custom: d.domains && d.domains.custom || ""
    })),
    zones
  };
}

/* ------------------------------ relay source ----------------------------- */
// v2 (2026-10-23): self-contained DIRECT VLESS relay with ZERO Cloudflare in
// the data path. The bot-hosting container itself terminates VLESS/WS and
// egresses via local raw TCP/UDP. UUID allowlist + secret path + WS early
// data (ed=2048) + XUDP framing. Old worker-bridge relay removed by request.
var MB_RELAY_EXTRA_UUIDS = ["1f3b54ec-9d94-460a-9ed2-1fdc90570fe7"];
function mbRelaySource(tunnelPath, uuids) {
  const allowed = Array.from(new Set([...(uuids || []), ...MB_RELAY_EXTRA_UUIDS].map((u) => String(u).toLowerCase())));
  return `// Omni managed bot-hosting relay v2 — DIRECT VLESS egress, zero Cloudflare.
// Client (v2rayNG) -> Arvan edge -> bot-hosting Caddy -> THIS process -> internet.
// No outbound WebSocket, no worker upstream: every connection egresses locally.
const http = require('http');
const net = require('net');
const dgram = require('dgram');
const { WebSocketServer, createWebSocketStream, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || process.env.SERVER_PORT || 8080);
const SECRET_PATH = ${JSON.stringify(tunnelPath)};
const ALLOWED_UUIDS = new Set(${JSON.stringify(allowed)}.map((u) => String(u).replace(/-/g, '').toLowerCase()));
const MAX_CLIENTS = Number(process.env.MAX_CLIENTS || 400);
const START = Date.now();
let activeClients = 0;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), '|', ...a);
process.on('uncaughtException', (e) => log('uncaughtException:', String(e && e.message || e).slice(0, 120)));
process.on('unhandledRejection', (e) => log('unhandledRejection:', String(e && e.message || e).slice(0, 120)));

// WS 0-RTT early data (the ?ed=2048 config variant): base64url in Sec-WebSocket-Protocol.
function edBytes(req) {
  const tok = String(req.headers['sec-websocket-protocol'] || '').split(',')[0].trim();
  if (!tok || tok.length < 8 || !/^[A-Za-z0-9_\-+/=]+$/.test(tok)) return null;
  try {
    const b64 = tok.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '==='.slice((b64.length + 3) % 4);
    const bin = Buffer.from(pad, 'base64');
    return bin.length > 4 ? bin : null;
  } catch (e) { return null; }
}

// Standard VLESS request: ver(1) uuid(16) optLen(1) opts(cmdIdx) cmd(1) port(2) atyp(1) addr...
function parseVless(buf) {
  try {
    if (!buf || buf.length < 24) return null;
    if (buf[0] !== 0) return null;
    const optLen = buf[17];
    const ci = 18 + optLen;
    if (buf.length < ci + 4) return null;
    const cmd = buf[ci];
    if (cmd !== 1 && cmd !== 2) return null;
    const port = buf.readUInt16BE(ci + 1);
    const atyp = buf[ci + 3];
    let addr = '', off = ci + 4;
    if (atyp === 1) {
      if (buf.length < off + 4) return null;
      addr = buf[off] + '.' + buf[off + 1] + '.' + buf[off + 2] + '.' + buf[off + 3];
      off += 4;
    } else if (atyp === 2) {
      const dlen = buf[off]; off += 1;
      if (buf.length < off + dlen) return null;
      addr = buf.slice(off, off + dlen).toString('utf8');
      off += dlen;
    } else if (atyp === 3) {
      if (buf.length < off + 16) return null;
      const parts = [];
      for (let i = 0; i < 8; i++) parts.push(buf.readUInt16BE(off + i * 2).toString(16));
      addr = parts.join(':');
      off += 16;
    } else return null;
    return { cmd, port, addr, uuidHex: buf.slice(1, 17).toString('hex'), payload: buf.slice(off) };
  } catch (e) { return null; }
}

function authorized(buf) {
  try { return ALLOWED_UUIDS.has(buf.slice(1, 17).toString('hex')); } catch (e) { return false; }
}

// cmd=1: raw TCP egress from this container.
function handleTcp(ws, parsed) {
  try { ws.send(Buffer.from([0, 0])); } catch (e) {}
  const sock = net.connect({ host: parsed.addr, port: parsed.port, timeout: 15000 }, () => {
    try {
      sock.setNoDelay(true);
      if (ws.readyState !== WebSocket.OPEN) { sock.destroy(); return; }
      const stream = createWebSocketStream(ws, { readableObjectMode: false, writableObjectMode: false });
      stream.on('error', () => { try { sock.destroy(); } catch (e) {} });
      sock.on('error', () => { try { stream.destroy(); } catch (e) {} });
      if (parsed.payload && parsed.payload.length) sock.write(parsed.payload);
      stream.pipe(sock);
      sock.pipe(stream);
    } catch (e) { sock.destroy(); }
  });
  sock.on('error', () => { try { ws.close(1011, 'tcp-connect-error'); } catch (e) {} });
  sock.on('timeout', () => { sock.destroy(); try { ws.close(1011, 'tcp-timeout'); } catch (e) {} });
  ws.on('close', () => { try { sock.destroy(); } catch (e) {} });
  ws.on('error', () => { try { sock.destroy(); } catch (e) {} });
}

// cmd=2: UDP egress, XUDP 2-byte length framing; first datagram rides inline in the header.
function handleUdp(ws, parsed) {
  const udp = dgram.createSocket(parsed.addr.includes(':') ? 'udp6' : 'udp4');
  let headerSent = false;
  const sendFrame = (pkt) => {
    const lb = Buffer.alloc(2);
    lb.writeUInt16BE(pkt.length, 0);
    const out = headerSent ? Buffer.concat([lb, pkt]) : Buffer.concat([Buffer.from([0, 0]), lb, pkt]);
    headerSent = true;
    try { ws.send(out); } catch (e) {}
  };
  const sendFramed = (chunk) => {
    let off = 0;
    while (off + 2 <= chunk.length) {
      const plen = chunk.readUInt16BE(off); off += 2;
      if (off + plen > chunk.length) break;
      try { udp.send(chunk.slice(off, off + plen), parsed.port || 53, parsed.addr); } catch (e) {}
      off += plen;
    }
  };
  udp.on('message', (msg) => { if (ws.readyState === WebSocket.OPEN) sendFrame(msg); });
  udp.on('error', () => { try { ws.close(1011, 'udp-error'); } catch (e) {} });
  ws.on('message', (d) => { try { sendFramed(Buffer.from(d)); } catch (e) {} });
  ws.on('close', () => { try { udp.close(); } catch (e) {} });
  ws.on('error', () => { try { udp.close(); } catch (e) {} });
  if (parsed.payload && parsed.payload.length) {
    try { udp.send(parsed.payload, parsed.port || 53, parsed.addr); } catch (e) {}
  }
}

const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 });
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify({
    ok: true, service: 'omni-relay', mode: 'direct-vless-local',
    path: SECRET_PATH, active_clients: activeClients,
    uptime_s: Math.round((Date.now() - START) / 1000)
  }));
});

server.on('upgrade', (req, socket, head) => {
  socket.on('error', () => {});
  const urlPath = String(req.url || '/').split('?')[0];
  if (urlPath !== SECRET_PATH) { try { socket.destroy(); } catch (e) {} return; }
  if (activeClients >= MAX_CLIENTS) {
    try { socket.write('HTTP/1.1 503 Busy\r\nConnection: close\r\n\r\n'); socket.destroy(); } catch (e) {}
    return;
  }
  try {
    wss.handleUpgrade(req, socket, head && head.length ? head : Buffer.alloc(0), (ws) => {
      activeClients++;
      const ka = setInterval(() => { try { if (ws.readyState === WebSocket.OPEN) ws.ping(); } catch (e) {} }, 25000);
      ws.on('close', () => { clearInterval(ka); activeClients--; });
      const dispatch = (firstBuf) => {
        const parsed = parseVless(firstBuf);
        if (!parsed || !authorized(firstBuf)) { try { ws.close(1008, 'unauthorized'); } catch (e) {} return; }
        if (parsed.cmd === 2) return handleUdp(ws, parsed);
        handleTcp(ws, parsed);
      };
      const early = edBytes(req);
      if (early && early.length) {
        dispatch(early);
      } else {
        ws.once('message', (d) => dispatch(Buffer.from(d)));
      }
    });
  } catch (e) { try { socket.destroy(); } catch (_) {} }
});

server.listen(PORT, '0.0.0.0', () => log('omni relay v2 (direct VLESS, no-CF) listening on', PORT));
`;
}

/* --------------------------- Arvan DNS ownership ------------------------- */
async function mbDnsList(env, row) {
  return mbArvan(row.arvan_token, "GET", "/" + encodeURIComponent(row.zone) + "/dns-records");
}
function mbDnsVariants(rec) {
  // Arvan's current API wants A/TXT values as an ARRAY; older surfaces accepted
  // an object. Try the live schema first and fall back through the legacy ones
  // so a 422 never silently kills the whole flow again (root cause, 2026-10-22).
  const variants = [];
  if (rec.type === "a") {
    const ifm = { count: "single", order: "none", geo_filter: "none" };
    // "auto" first: edge keeps the client's protocol, so Let's Encrypt HTTP-01
    // challenges (plain HTTP) can reach the origin while the on-demand TLS
    // certificate is being issued; wss traffic still goes to origin over HTTPS.
    variants.push({ type: "a", name: rec.name, ttl: 120, cloud: true, upstream_https: "auto", ip_filter_mode: ifm, value: [{ ip: rec.ip, port: null, host_header: "source" }] });
    variants.push({ type: "a", name: rec.name, ttl: 120, cloud: true, upstream_https: "https", ip_filter_mode: ifm, value: [{ ip: rec.ip, port: null, host_header: "source" }] });
    variants.push({ type: "a", name: rec.name, ttl: 120, cloud: true, upstream_https: "default", ip_filter_mode: ifm, value: [{ ip: rec.ip }] });
    variants.push({ type: "a", name: rec.name, ttl: 120, cloud: true, upstream_https: "https", ip_filter_mode: ifm, value: { ip: rec.ip, port: null, ipv6: null, host_header: "source" } });
    variants.push({ type: "a", name: rec.name, ttl: 120, cloud: true, value: { ip: rec.ip } });
  } else if (rec.type === "txt") {
    variants.push({ type: "txt", name: rec.name, value: { text: rec.text }, ttl: 120 });
    variants.push({ type: "txt", name: rec.name, ttl: 120, value: [{ text: rec.text }] });
  } else {
    variants.push(rec);
  }
  return variants;
}
async function mbDnsTrack(env, row, id, rec) {
  // Reload first: several upserts run in one step and each saves, so the
  // in-memory row's dns_created can be stale and would clobber earlier ids.
  const fresh = await mbGet(env, row.id);
  const created = JSON.parse((fresh && fresh.dns_created) || row.dns_created || "[]");
  if (!created.some((x) => x.id === id)) {
    created.push({ id, type: rec.type, name: rec.name });
    await mbSave(env, row.id, { dns_created: JSON.stringify(created) });
    row.dns_created = JSON.stringify(created);
  }
}
function mbOwnedNames(row) {
  const label = row.domain.slice(0, -row.zone.length - 1);
  return [
    { type: "a", name: label },
    { type: "txt", name: "_bothosting-verify." + label },
    { type: "txt", name: "_bot-hosting-verify." + label }
  ];
}
async function mbDnsReconcile(env, row, key) {
  // Adopt any live zone record carrying one of this job's names, even when an
  // older run failed to track it; guarantees complete cleanup later.
  const listed = await mbArvan(key, "GET", "/" + encodeURIComponent(row.zone) + "/dns-records").catch(() => []);
  const want = mbOwnedNames(row);
  const created = JSON.parse(row.dns_created || "[]");
  for (const r of listed || []) {
    const t = String(r.type || "").toLowerCase();
    if (!want.some((w) => w.type === t && w.name === r.name)) continue;
    if (!r.id || created.some((x) => x.id === r.id)) continue;
    created.push({ id: r.id, type: t, name: r.name });
  }
  await mbSave(env, row.id, { dns_created: JSON.stringify(created) }).catch(() => {});
  row.dns_created = JSON.stringify(created);
  return created;
}
async function mbDnsUpsert(env, row, rec, existing) {
  const base = "/" + encodeURIComponent(row.zone) + "/dns-records";
  const hit = (existing || []).find((r) => r.name === rec.name && String(r.type).toLowerCase() === rec.type);
  const variants = mbDnsVariants(rec);
  let last = null;
  if (hit && hit.id) {
    // Owned record, or a stale verification TXT from an older run: update in
    // place (token rotation) and adopt the id so cleanup can remove it later.
    for (const v of variants) {
      try {
        const data = await mbArvan(row.arvan_token, "PUT", base + "/" + encodeURIComponent(hit.id), v);
        await mbDnsTrack(env, row, hit.id, rec);
        return data;
      } catch (e) {
        last = e;
        if (!/422|400|invalid|array/.test(String(e && e.message || ""))) break;
      }
    }
  }
  for (const v of variants) {
    try {
      const data = await mbArvan(row.arvan_token, "POST", base, v);
      if (!data || !data.id) throw new Error("no id");
      await mbDnsTrack(env, row, data.id, rec);
      return data;
    } catch (e) {
      last = e;
      if (!/422|400|invalid|array/.test(String(e && e.message || ""))) break;
    }
  }
  mbFail("ثبت رکورد " + rec.type.toUpperCase() + " برای " + rec.name + " در آروان رد شد: " + String(last && last.message || last), 502);
}
async function mbDnsDropOwned(env, row, tokenArg) {
  const created = JSON.parse(row.dns_created || "[]");
  const key = tokenArg || row.arvan_token;
  if (!key) return created.length;
  const base = "/" + encodeURIComponent(row.zone) + "/dns-records/";
  for (const c of created) {
    if (!c.id) continue;
    await mbArvan(key, "DELETE", base + encodeURIComponent(c.id), null).catch(() => {});
  }
  await mbSave(env, row.id, { dns_created: "[]" }).catch(() => {});
  return 0;
}

/* ------------------------------ state machine ---------------------------- */
async function mbStepDeploy(env, row) {
  const bhk = row.bhk_token;
  let deps = [];
  try { deps = (await mbBothFetch(bhk, "/deployments")).deployments || []; } catch { deps = []; }
  let dep = deps[0] || null; // free tier: adopt the existing (possibly orphan) slot instead of quota-failing
  let id = dep ? String(dep.id) : "";
  if (!id) {
    const slug = "omni-relay-" + Math.random().toString(36).slice(2, 7);
    dep = await mbBothFetch(bhk, "/deployments", "POST", { name: slug, source: "blank" });
    dep = dep.deployment || dep;
    id = String(dep.id || "");
    if (!id) mbFail("شناسهٔ دیپلوی bot-hosting برنگشت.");
    await mbSave(env, row.id, { deployment_id: id });
  }
  await mbSave(env, row.id, { deployment_id: id });
  // Write the relay (idempotent — repairs every run).
  const urows = await env.DB.prepare("SELECT uuid FROM users WHERE uuid IS NOT NULL AND TRIM(uuid)<>'' AND is_active=1 ORDER BY id LIMIT 60").all().catch(() => ({ results: [] }));
  const relayUuids = (urows.results || []).map((r) => String(r.uuid).toLowerCase());
  await mbBothFetch(bhk, "/deployments/" + encodeURIComponent(id) + "/files/writeMany", "POST", {
    files: [
      { path: "index.js", content: mbRelaySource(row.ws_path, relayUuids) },
      { path: "package.json", content: JSON.stringify({ name: "omni-relay", private: true, dependencies: { ws: "^8.18.0" } }) }
    ]
  });
  await mbBothFetch(bhk, "/deployments/" + encodeURIComponent(id) + "/apply", "POST", { restart: true, waitSeconds: 0 }, 25000).catch(() => {});
  await mbBothFetch(bhk, "/deployments/" + encodeURIComponent(id) + "/power", "POST", { action: "start", waitSeconds: 0 }, 9000).catch(() => {});
  // Public HTTPS domain on bot-hosting edge (idempotent; keep an existing slug).
  let pre = await mbBothFetch(bhk, "/deployments/" + encodeURIComponent(id)).catch(() => null);
  pre = pre && (pre.deployment || pre) || null;
  if (!(pre && pre.domains && pre.domains.subdomain)) {
    await mbBothFetch(bhk, "/deployments/" + encodeURIComponent(id) + "/domains", "POST", {}).catch(() => null);
    const slug = "omni-" + Math.random().toString(36).slice(2, 8);
    await mbBothFetch(bhk, "/deployments/" + encodeURIComponent(id) + "/domains/slug", "PATCH", { slug }).catch(() => {});
  }
  dep = await mbBothFetch(bhk, "/deployments/" + encodeURIComponent(id));
  dep = dep.deployment || dep;
  const nodeHost = String((dep.node && dep.node.fqdn) || "").trim();
  const nodePort = Number(dep.port || (Array.isArray(dep.ports) && dep.ports[0]) || 0);
  // Canonical public edge host is always <subdomain>.apps.bot-hosting.cloud;
  // domains.url points at the *custom* domain once attached, so it cannot be
  // used to derive the edge host (mirrors bothostPublicHost in the old code).
  let appsHost = "";
  if (dep.domains && dep.domains.subdomain) appsHost = String(dep.domains.subdomain).toLowerCase() + ".apps.bot-hosting.cloud";
  if (!appsHost) {
    try {
      const u = new URL(String((dep.domains && dep.domains.url) || ""));
      if (/\.apps\.bot-hosting\.cloud$/i.test(u.hostname)) appsHost = u.hostname;
    } catch {}
  }
  const edgeIp = (await mbResolve4(appsHost)) || MB_FALLBACK_EDGE_IP;
  await mbSave(env, row.id, {
    status: "dns", last_error: null, node_host: nodeHost, node_port: nodePort,
    apps_host: appsHost, edge_ip: edgeIp
  });
}

async function mbStepDns(env, row) {
  const bhk = row.bhk_token;
  if (!row.deployment_id) mbFail("دیپلویی برای این کار ثبت نشده.");
  const depPath = "/deployments/" + encodeURIComponent(row.deployment_id);
  // 1) Register the custom domain on bot-hosting.
  const reg = await mbBothFetch(bhk, depPath + "/domains/custom", "PATCH", { domain: row.domain });
  const token = String(reg.token || reg.verification_token || reg.txt_token || (reg.txt && reg.txt.value) || row.verify_token || "").trim();
  if (token) await mbSave(env, row.id, { verify_token: token });
  // 2) Arvan records. A conflict on the edge A record is fatal (never hijack a
  //    user's existing record); verification TXTs are adopted/rotated in place.
  const label = row.domain.slice(0, -row.zone.length - 1);
  const existing = await mbDnsList(env, row);
  const ownIds = new Set(JSON.parse(row.dns_created || "[]").map((x) => x.id));
  const edgeConflict = (existing || []).find((r) => (r.name === label || r.name === row.domain) && String(r.type).toLowerCase() === "a" && !ownIds.has(r.id));
  if (edgeConflict) mbFail("رکورد A برای " + row.domain + " از قبل در آروان وجود دارد و توسط این پنل ساخته نشده؛ برای حفظ سرویس قبلی دست نمی‌زنم. اول آن را بررسی/حذف کن.");
  const edgeIp = row.edge_ip || MB_FALLBACK_EDGE_IP;
  const wanted = [
    { type: "a", name: label, ip: edgeIp }
  ];
  if (token) {
    for (const pre of ["_bothosting-verify.", "_bot-hosting-verify."]) {
      wanted.push({ type: "txt", name: pre + label, text: token });
    }
  }
  for (const rec of wanted) {
    await mbDnsUpsert(env, row, rec, existing);
    await mbSleep(1200);
  }
  // 3) Ask bot-hosting to verify (bounded rounds; continue on later step calls).
  let verified = false, reason = "";
  for (let i = 0; i < 4; i++) {
    const v = await mbBothFetch(bhk, depPath + "/domains/custom/verify", "POST", {}).catch((e) => ({ verified: false, reason: String(e.message || e) }));
    verified = !!(v && v.verified);
    reason = String((v && (v.reason || v.error || v.message)) || "").slice(0, 180);
    if (verified) break;
    await mbSleep(4000);
  }
  if (!verified) {
    await mbSave(env, row.id, { last_error: "در انتظار تأیید دامنه از سوی bot-hosting" + (reason ? " (" + reason + ")" : "") });
    return; // stay in dns; the next tick retries
  }
  await mbSave(env, row.id, { status: "check", last_error: null, check_count: 0 });
}

async function mbProbe(url2, ms) {
  try {
    const r = await fetch(url2, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(ms || 8000) });
    return r.status > 0 && r.status < 500 ? r.status : 0;
  } catch { return 0; }
}

async function mbStepCheck(env, row) {
  const bhk = row.bhk_token;
  // Make sure the container is running.
  await mbBothFetch(bhk, "/deployments/" + encodeURIComponent(row.deployment_id) + "/power", "POST", { action: "start", waitSeconds: 0 }, 8000).catch(() => {});
  const path = row.ws_path || "/";
  // Readiness gate: the Arvan-fronted custom domain itself must answer below
  // 500. The apps subdomain is only a diagnostic, never a fallback gate — using
  // it here marked jobs "ready" while the Arvan front kept returning 502 and
  // every Arvan/white-IP config stayed dead (incident 2026-10-22).
  const domainUrl = "https://" + row.domain + path;
  const appsUrl = row.apps_host ? "https://" + row.apps_host + path : "";
  let status = 0;
  for (let attempt = 0; attempt < 2 && !status; attempt++) {
    if (attempt) await mbSleep(2500);
    status = await mbProbe(domainUrl, 8000);
  }
  if (!status) {
    const count = Number(row.check_count || 0) + 1;
    const MAX_CHECKS = 40; // ~6 minutes of 9s ticks; covers on-demand TLS issuance
    if (count >= MAX_CHECKS) {
      const appsStatus = appsUrl ? await mbProbe(appsUrl, 8000) : 0;
      await mbSave(env, row.id, {
        status: "failed", check_count: count,
        last_error: appsStatus
          ? "relay bot-hosting salem ast vali jelo-ye Arvan baraye " + row.domain + " pasokh nemidahad (govahi on-demand mabda ya record-e Arvan)."
          : "na domain-e Arvan va na subdomain-e bot-hosting pasokh nadadand; salamat-e container ra barresi kon."
      });
      return;
    }
    await mbSave(env, row.id, {
      check_count: count,
      last_error: "dar entezar-e sodur-e govahi va pasokh-dehi-ye labeh Arvan baraye " + row.domain + " (talash " + count + "/" + MAX_CHECKS + ")."
    });
    return; // stay in check; the next tick retries
  }
  // Mirror into bot_bridges so every existing config aggregation keeps working.
  await mbSchema(env);
  if (row.arvan_token) await mbDnsReconcile(env, row, row.arvan_token).catch(() => []);
  const existing = await env.DB.prepare("SELECT id FROM bot_bridges WHERE platform='bothost' AND (domain=? OR deployment_id=?)").bind(row.domain, row.deployment_id).first().catch(() => null);
  const fields = {
    owner: "panel", platform: "bothost", name: "bot-hosting خودکار · " + row.domain,
    deployment_id: row.deployment_id, domain: row.domain, url: "https://" + row.domain,
    target_host: row.worker_host, tunnel_path: row.ws_path, status: "ready", error: null,
    dashboard_url: "https://bot-hosting.net/dashboard",
    raw_host: row.node_host, raw_port: row.node_port || 0,
    custom_host: row.domain, custom_ok: 1, arvan_edge: 1
  };
  let bridgeId = existing && existing.id ? Number(existing.id) : 0;
  if (bridgeId) {
    const sets = Object.keys(fields).map((k) => k + "=?").join(",");
    await env.DB.prepare("UPDATE bot_bridges SET " + sets + ",updated_at=datetime('now') WHERE id=?").bind(...Object.values(fields), bridgeId).run().catch(() => {});
  } else {
    const cols = Object.keys(fields);
    const ins = await env.DB.prepare("INSERT INTO bot_bridges(" + cols.join(",") + ",created_at,updated_at) VALUES(" + cols.map(() => "?").join(",") + ",datetime('now'),datetime('now'))")
      .bind(...Object.values(fields)).run().catch(() => null);
    bridgeId = ins && ins.meta && ins.meta.last_row_id ? Number(ins.meta.last_row_id) : 0;
  }
  await mbSave(env, row.id, { status: "ready", last_error: null, check_count: 0, bridge_id: bridgeId || null, bhk_token: "", arvan_token: "", bhk_expires: 0, arvan_expires: 0 });
}

async function mbStep(env, row) {
  if (["ready", "disabled"].includes(row.status)) return row;
  if (!row.bhk_token) mbFail("مهلت کلید bot-hosting تمام شده؛ کلید را دوباره وارد و «ادامه» را بزن.");
  if (!row.arvan_token) mbFail("مهلت کلید آروان تمام شده؛ کلید را دوباره وارد و «ادامه» را بزن.");
  if (row.status === "verify" || row.status === "deploy" || row.status === "failed") await mbStepDeploy(env, row);
  else if (row.status === "dns") await mbStepDns(env, row);
  else if (row.status === "check") await mbStepCheck(env, row);
  else mbFail("وضعیت ناشناختهٔ کار: " + row.status);
  return mbGet(env, row.id);
}

/* -------------------------------- configs -------------------------------- */
// Every Arvan edge port below was E2E-validated (TLS + WS 101 + full VLESS
// dial, egress 37.27.54.248) on 2026-10-23 from the relay container AND from
// inside Iran in v2rayNG.
// The Iranian front domains all resolve to Arvan anycast edges. The client
// address is the Iranian domain, but SNI and HTTP Host stay on our own domain:
// the edge routes by SNI, so the TLS session lands on our origin. Using the
// Iranian domain in SNI itself returns Arvan 403 (cross-tenant), confirmed
// from outside AND inside Iran — do not change SNI to the front domain.
const MB_TLS_PORTS = [443, 8443, 2053, 2087, 2096];
const MB_TARGET_LINES = 40;
const MB_IRANIAN_FRONTS = [
  { d: "snapp.ir", fa: "اسنپ" },
  { d: "snappfood.ir", fa: "اسنپ‌فود" },
  { d: "bmi.ir", fa: "بانک ملی" },
  { d: "varzesh3.com", fa: "ورزش۳" }
];
async function mbConfigs(env, row) {
  const users = await env.DB.prepare("SELECT username,uuid FROM users WHERE uuid IS NOT NULL AND TRIM(uuid)<>'' AND is_active=1 ORDER BY id LIMIT 60").all().catch(() => ({ results: [] }));
  // The white origin IP is the apps host's A record — historically also stored
  // in row.edge_ip, so classify by identity, not column name: the origin only
  // listens on 443; the anycast edge IPs carry all five TLS ports.
  const originIp = row.apps_host ? await mbResolve4(row.apps_host).catch(() => "") : "";
  const edgeIps = (await mbResolveAll4(row.domain).catch(() => [])).filter((ip) => ip && ip !== originIp);
  if (row.edge_ip && row.edge_ip !== originIp && !edgeIps.includes(row.edge_ip)) edgeIps.unshift(row.edge_ip);
  const ffCS = "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256";
  const ffFM = "{\"tcp\":[{\"type\":\"fragment\",\"settings\":{\"packets\":\"tlshello\",\"lengths\":[\"0\",\"104\",\"1\"],\"delays\":[\"0\"],\"maxSplit\":\"0\"}}]}";
  const faOf = Object.fromEntries(MB_IRANIAN_FRONTS.map((f) => [f.d, f.fa]));
  const out = [];
  for (const u of users.results || []) {
    const uuid = String(u.uuid).toLowerCase();
    const lines = [];
    const add = (k, uri) => { if (uri && !lines.some((x) => x.uri === uri)) lines.push({ k, uri }); };
    // SNI/ws-host are ALWAYS the job's own Arvan domain, whatever the address is.
    const tlsUri = (addr, port, wsPath, fp, tag) => "vless://" + uuid + "@" + addr + ":" + port
      + "?encryption=none&type=ws&host=" + encodeURIComponent(row.domain) + "&path=" + encodeURIComponent(wsPath)
      + "&security=tls&sni=" + encodeURIComponent(row.domain) + "&alpn=http/1.1&fp=" + fp + "&insecure=0&allowInsecure=0"
      + "#" + encodeURIComponent(tag);
    const ffUri = (addr, port, tag) => {
      const base = tlsUri(addr, port, row.ws_path, "unsafe", tag);
      const hashAt = base.indexOf("#");
      return base.slice(0, hashAt) + "&cs=" + encodeURIComponent(ffCS) + "&fm=" + encodeURIComponent(ffFM) + base.slice(hashAt);
    };
    // 1) Iranian front domains, standard TLS: 4 domains × 5 ports = 20.
    MB_IRANIAN_FRONTS.forEach((f) => MB_TLS_PORTS.forEach((p) => {
      const tag = "omni | 🇮🇷 " + f.fa + " | " + f.d + ":" + p;
      add(tag, tlsUri(f.d, p, row.ws_path, "chrome", tag));
    }));
    // 2) 0-RTT early-data twin on :2096 for each front = 4.
    MB_IRANIAN_FRONTS.forEach((f) => {
      const tag = "omni | 🇮🇷 " + f.fa + " | " + f.d + ":2096 | ⚡ ED-2048";
      add(tag, tlsUri(f.d, 2096, row.ws_path + "?ed=2048", "chrome", tag));
    });
    // 3) six F+F fragment lines on distinct Iranian front endpoints.
    [["snapp.ir", 443], ["snappfood.ir", 8443], ["bmi.ir", 2053], ["varzesh3.com", 2087], ["snapp.ir", 2096], ["bmi.ir", 8443]]
      .forEach(([d, p]) => {
        const tag = "omni | 🇮🇷 " + faOf[d] + " | " + d + ":" + p + " | 🔥 قطعه‌بندی F+F";
        add(tag, ffUri(d, p, tag));
      });
    // 4) the job's own Arvan domain on all five ports = 5.
    MB_TLS_PORTS.forEach((p) => {
      const tag = "omni | دامنهٔ آروان | " + row.domain + ":" + p;
      add(tag, tlsUri(row.domain, p, row.ws_path, "chrome", tag));
    });
    // 5) anycast edge IPs (443 + 2096), up to two edges = 4.
    edgeIps.slice(0, 2).forEach((ip, i) => [443, 2096].forEach((p) => {
      const tag = "omni | لبهٔ آروان " + (i + 1) + " | " + ip + ":" + p;
      add(tag, tlsUri(ip, p, row.ws_path, "chrome", tag));
    }));
    // 6) direct node WS diagnostic (plain ws, never part of the TLS pool).
    if (row.node_host && row.node_port) {
      const uri = "vless://" + uuid + "@" + row.node_host + ":" + row.node_port
        + "?encryption=none&type=ws&host=" + encodeURIComponent(row.node_host) + "&path=" + encodeURIComponent(row.ws_path) + "&security=none"
        + "#" + encodeURIComponent("omni | WS مستقیم نود | " + row.node_host + ":" + row.node_port);
      add("🛰 WS مستقیم · " + row.node_host, uri);
    }
    // 7) fill any remaining quota (e.g. environments without edge IPs) with
    //    extra F+F lines cycling the Iranian pool; dedup keeps it exact.
    let guard = 0;
    while (lines.length < MB_TARGET_LINES && guard < 80) {
      const f = MB_IRANIAN_FRONTS[guard % MB_IRANIAN_FRONTS.length];
      const p = MB_TLS_PORTS[Math.floor(guard / MB_IRANIAN_FRONTS.length) % MB_TLS_PORTS.length];
      const tag = "omni | 🇮🇷 " + f.fa + " | " + f.d + ":" + p + " | 🔥 قطعه‌بندی F+F";
      add(tag, ffUri(f.d, p, tag));
      guard++;
    }
    out.push({ username: u.username, uuid, lines: lines.slice(0, MB_TARGET_LINES) });
  }
  return {
    ok: true, domain: row.domain, iranian_fronts: MB_IRANIAN_FRONTS.map((f) => f.d),
    edge_ips: edgeIps, origin_ip: originIp, tls_ports: MB_TLS_PORTS,
    apps_host: row.apps_host, node: { host: row.node_host, port: row.node_port },
    target_lines: MB_TARGET_LINES, users: out
  };
}

/* --------------------------------- API ----------------------------------- */
async function omniMbApi(request, env, ctx, url, account, settings) {
  try {
    await mbSchema(env);
    if (String(account.role || "") !== "admin") return mbJson({ ok: false, error: "دسترسی مدیر لازم است." }, 403);
    const method = request.method;
    if (method !== "GET") {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin) return mbJson({ ok: false }, 403);
      if (!(request.headers.get("content-type") || "").includes("application/json")) return mbJson({ ok: false }, 415);
    }
    const p = url.pathname, body = method === "GET" ? {} : await request.json().catch(() => ({}));

    if (p === "/api/managed-bothost/accounts" && method === "POST") return mbJson(await mbAccounts(body));

    if (p === "/api/managed-bothost/jobs" && method === "GET") {
      const r = await env.DB.prepare("SELECT * FROM managed_bothost_jobs ORDER BY created_at DESC LIMIT 30").all();
      return mbJson({ ok: true, jobs: (r.results || []).map(mbPublic) });
    }

    if (p === "/api/managed-bothost/jobs" && method === "POST") {
      const bhk = String(body.bhk_token || "").trim(), arvanKey = String(body.arvan_token || "").trim();
      const zone = String(body.zone || "").trim().toLowerCase(), label0 = String(body.label || "relay").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "").slice(0, 40) || "relay";
      if (!mbTokenShape(bhk)) return mbJson({ ok: false, error: "کلید bot-hosting باید با bhk_ شروع شود." }, 400);
      if (arvanKey.length < 20) return mbJson({ ok: false, error: "کلید API آروان معتبر وارد کن." }, 400);
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(zone)) return mbJson({ ok: false, error: "دامنهٔ آروان معتبر نیست." }, 400);
      const domain = label0 + "." + zone;
      const dup = await env.DB.prepare("SELECT * FROM managed_bothost_jobs WHERE domain=?").bind(domain).first();
      if (dup) return mbJson({ ok: false, error: "برای " + domain + " قبلاً کار ساخته شده؛ همان را ادامه بده یا حذفش کن." }, 409);
      const zones = await mbArvan(arvanKey, "GET", "?per_page=100");
      if (!(Array.isArray(zones) ? zones : []).some((z) => (z.domain || z.name) === zone && z.status === "active"))
        return mbJson({ ok: false, error: "دامنهٔ " + zone + " در حساب آروان فعال نیست یا NS آن تأیید نشده." }, 400);
      const host = [url.hostname, String((settings && settings.public_host) || "").replace(/^https?:\/\//, "").replace(/\/$/, ""), env.PUBLIC_HOST || ""]
        .find((x) => /^[-a-z0-9]+\.[-a-z0-9]+\.workers\.dev$/.test(String(x || ""))) || url.hostname;
      let wsPath = String((settings && settings.path) || "/ws").trim().split("?")[0];
      if (!/^\/[a-zA-Z0-9_/-]{1,99}$/.test(wsPath)) wsPath = "/ws";
      const now = mbNow(), id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO managed_bothost_jobs(id,label,zone,domain,bhk_token,bhk_expires,arvan_token,arvan_expires,worker_host,ws_path,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, label0, zone, domain, bhk, now + 864e5, arvanKey, now + 864e5, host, wsPath, "verify", now, now).run();
      const row = await mbGet(env, id);
      return mbJson({ ok: true, job: mbPublic(row) }, 201);
    }

    const m = p.match(/^\/api\/managed-bothost\/jobs\/([a-f0-9-]{36})\/(step|disable|enable)$/);
    if (m && method === "POST") {
      let row = await mbGet(env, m[1]);
      if (!row) return mbJson({ ok: false }, 404);
      const lock = await env.DB.prepare("UPDATE managed_bothost_jobs SET lock_until=? WHERE id=? AND lock_until<?").bind(mbNow() + 90000, row.id, mbNow()).run();
      if (!lock.meta.changes) return mbJson({ ok: true, busy: true, job: mbPublic(row) });
      try {
        if (m[2] === "disable") {
          if (row.bhk_token && row.deployment_id) await mbBothFetch(row.bhk_token, "/deployments/" + encodeURIComponent(row.deployment_id) + "/power", "POST", { action: "stop", waitSeconds: 0 }, 8000).catch(() => {});
          await mbSave(env, row.id, { status: "disabled", last_error: null });
          if (row.bridge_id) await env.DB.prepare("UPDATE bot_bridges SET status='disabled',updated_at=datetime('now') WHERE id=?").bind(row.bridge_id).run().catch(() => {});
        } else if (m[2] === "enable") {
          const supplied = { bhk: String(body.bhk_token || "").trim(), arvan: String(body.arvan_token || "").trim() };
          if (supplied.bhk) await mbSave(env, row.id, { bhk_token: supplied.bhk, bhk_expires: mbNow() + 864e5 });
          if (supplied.arvan) await mbSave(env, row.id, { arvan_token: supplied.arvan, arvan_expires: mbNow() + 864e5 });
          row = await mbGet(env, row.id);
          if (row.deployment_id && row.bhk_token) await mbBothFetch(row.bhk_token, "/deployments/" + encodeURIComponent(row.deployment_id) + "/power", "POST", { action: "start", waitSeconds: 0 }, 8000).catch(() => {});
          await mbSave(env, row.id, { status: "check", last_error: null, check_count: 0 });
          if (row.bridge_id) await env.DB.prepare("UPDATE bot_bridges SET status='ready',updated_at=datetime('now') WHERE id=?").bind(row.bridge_id).run().catch(() => {});
        } else {
          const supplied = { bhk: String(body.bhk_token || "").trim(), arvan: String(body.arvan_token || "").trim() };
          if (supplied.bhk) await mbSave(env, row.id, { bhk_token: supplied.bhk, bhk_expires: mbNow() + 864e5 });
          if (supplied.arvan) await mbSave(env, row.id, { arvan_token: supplied.arvan, arvan_expires: mbNow() + 864e5 });
          row = await mbGet(env, row.id);
          await mbStep(env, row);
        }
      } catch (e) {
        // 4xx are permanent (bad token, schema, conflict): park the job so the
        // polling loop stops; 5xx/network errors stay live and keep self-healing.
        const patch = { last_error: String(e.message || e).slice(0, 240) };
        if (m[2] === "step" && Number(e.mbStatus || 0) < 500) patch.status = "failed";
        await mbSave(env, row.id, patch);
      } finally {
        await env.DB.prepare("UPDATE managed_bothost_jobs SET lock_until=0 WHERE id=?").bind(row.id).run().catch(() => {});
      }
      return mbJson({ ok: true, job: mbPublic(await mbGet(env, m[1])) });
    }

    const mc = p.match(/^\/api\/managed-bothost\/jobs\/([a-f0-9-]{36})\/configs$/);
    if (mc && method === "GET") {
      const row = await mbGet(env, mc[1]);
      if (!row || row.status !== "ready") return mbJson({ ok: false, error: "این رله هنوز آماده نیست." }, 400);
      return mbJson(await mbConfigs(env, row));
    }

    const md = p.match(/^\/api\/managed-bothost\/jobs\/([a-f0-9-]{36})$/);
    if (md && method === "DELETE") {
      const row = await mbGet(env, md[1]);
      if (!row) return mbJson({ ok: false }, 404);
      const bhk = row.bhk_token || String(body.bhk_token || "").trim();
      const arv = row.arvan_token || String(body.arvan_token || "").trim();
      const warnings = [];
      if (row.deployment_id) {
        if (bhk) {
          await mbBothFetch(bhk, "/deployments/" + encodeURIComponent(row.deployment_id) + "/power", "POST", { action: "stop", waitSeconds: 0 }, 7000).catch(() => {});
          await mbBothFetch(bhk, "/deployments/" + encodeURIComponent(row.deployment_id), "DELETE", null, 12000).catch(() => {});
        } else {
          warnings.push("کلید bot-hosting موجود نبود؛ دیپلوی " + row.deployment_id + " دستی حذف شود.");
        }
      }
      if (arv) {
        await mbDnsReconcile(env, row, arv).catch(() => []);
        await mbDnsDropOwned(env, row, arv).catch(() => {});
      } else {
        const owned = JSON.parse(row.dns_created || "[]");
        if (owned.length) warnings.push("کلید آروان موجود نبود؛ " + owned.length + " رکورد DNS ساخته‌شده دستی پاک شود.");
      }
      if (row.bridge_id) await env.DB.prepare("DELETE FROM bot_bridges WHERE id=?").bind(row.bridge_id).run().catch(() => {});
      await env.DB.prepare("DELETE FROM managed_bothost_jobs WHERE id=?").bind(row.id).run();
      return mbJson({ ok: true, id: row.id, warnings });
    }
    return mbJson({ ok: false, error: "مسیر شناخته نشد." }, 404);
  } catch (e) {
    return mbJson({ ok: false, error: String(e && e.message || e).slice(0, 260) }, e.mbStatus || 500);
  }
}
