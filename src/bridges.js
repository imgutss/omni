/* ═══════════════════════════════════════════════════════════════════════════
   Omni · National-Net cloud bridges — Vercel & Netlify auto-installer
   ───────────────────────────────────────────────────────────────────────────
   The Cloudflare flow already works like this: the user pastes an API token
   in Telegram (or in the panel) and the Worker builds everything for them.
   Vercel and Netlify had no such path — the panel only handed out a .zip and
   the user had to upload it by hand on vercel.com/new or app.netlify.com/drop.

   This module closes that gap. A token is enough:

     Vercel   verify token → ensure project → push files (vercel.json + decoy
              + streaming relay) → set BACKEND_URL env → production deploy →
              poll readyState → live *.vercel.app domain
     Netlify  verify token → create site → files-digest deploy (sha1) → upload
              required files → declare edge function → poll state → live
              *.netlify.app domain

   Neither api.vercel.com nor api.netlify.com sends CORS headers, so every call
   here runs from the Worker (server side), never from the browser — exactly
   like cfRequest() does for Cloudflare. Tokens are held in memory during the
   request and only persisted if the owner explicitly stores them.
   ═══════════════════════════════════════════════════════════════════════════ */

const VERCEL_API = 'https://api.vercel.com';
const NETLIFY_API = 'https://api.netlify.com/api/v1';
const BRIDGE_UA = 'Omni-NationalNet/2.0 (+https://github.com/Alisarani7021/omni)';

/* ── helpers ─────────────────────────────────────────────────────────────── */

const bridgeSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function isBridgePlatform(p) {
  return p === 'vercel' || p === 'netlify';
}

/** Accept anything the user may paste and return a bare `https://host` origin. */
export function normalizeTargetHost(input) {
  let v = String(input || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  v = v.split('/')[0].split('?')[0].split('#')[0].trim();
  if (!v) return '';
  if (!/^[A-Za-z0-9._\-\[\]:]+$/.test(v)) return '';
  if (!/\./.test(v) && !v.startsWith('[')) return '';
  return v;
}

/** Vercel/Netlify both want lowercase alnum + hyphen names; keep it guessable but unique. */
export function bridgeProjectName(name, fallbackPrefix = 'omni-bridge') {
  let n = String(name || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!n) n = `${fallbackPrefix}-${Math.random().toString(36).slice(2, 7)}`;
  if (!/^[a-z0-9]/.test(n)) n = `o${n}`;
  if (n.endsWith('-')) n += Math.random().toString(36).slice(2, 5);
  return n.slice(0, 32);
}

export function bridgeTokenShape(platform, token) {
  const t = String(token || '').trim();
  if (platform === 'vercel') return /^vercel_[A-Za-z0-9]{20,}|^cfut_[A-Za-z0-9_\-]{20,}|^[A-Za-z0-9_\-]{25,200}$/.test(t);
  if (platform === 'netlify') return /^[A-Za-z0-9_\-]{20,200}$/.test(t);
  return false;
}

export function maskToken(token) {
  const t = String(token || '');
  if (t.length <= 10) return '••••';
  return `${t.slice(0, 6)}••••${t.slice(-4)}`;
}

function errText(data, fallback) {
  if (!data) return fallback;
  const msg = data.error?.message || data.message || data.msg
    || (Array.isArray(data.errors) && data.errors.map((e) => e.message).filter(Boolean).join(' | '))
    || data.error_description || '';
  return String(msg || fallback).slice(0, 400);
}

async function vfetch(token, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('User-Agent', BRIDGE_UA);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const res = await fetch(`${VERCEL_API}${path}`, { ...init, headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const e = new Error(errText(data, `Vercel HTTP ${res.status}`));
    e.status = res.status;
    e.code = data?.error?.code || data?.code || '';
    if (res.status === 401 || res.status === 403 || data?.error?.invalidToken) e.auth = true;
    throw e;
  }
  return data;
}

async function nfetch(token, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('User-Agent', BRIDGE_UA);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const res = await fetch(`${NETLIFY_API}${path}`, { ...init, headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const e = new Error(errText(data, `Netlify HTTP ${res.status}`));
    e.status = res.status;
    if (res.status === 401 || res.status === 403) e.auth = true;
    throw e;
  }
  return data;
}

export async function sha1Hex(strOrBytes) {
  const bytes = typeof strOrBytes === 'string' ? new TextEncoder().encode(strOrBytes) : strOrBytes;
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ── token checks ────────────────────────────────────────────────────────── */

export async function verifyVercelToken(token) {
  const user = await vfetch(token, '/v2/user');
  const teams = await vfetch(token, '/v2/teams?limit=20').catch(() => ({ teams: [] }));
  return {
    platform: 'vercel',
    ok: true,
    username: user?.user?.username || '',
    email: user?.user?.email || '',
    uid: user?.user?.uid || '',
    plan: user?.user?.billing?.plan || user?.user?.plan || '',
    teamId: user?.user?.defaultTeamId || teams?.teams?.[0]?.id || '',
    teams: (teams?.teams || []).slice(0, 8).map((t) => ({ id: t.id, slug: t.slug })),
    dashboard: 'https://vercel.com/account/tokens',
  };
}

export async function verifyNetlifyToken(token) {
  const user = await nfetch(token, '/user');
  return {
    platform: 'netlify',
    ok: true,
    username: user?.full_name || user?.email || '',
    email: user?.email || '',
    uid: user?.id || '',
    teamSlug: user?.account_slug || user?.ui_metadata?.account_slug || '',
    dashboard: 'https://app.netlify.com/user/applications#personal-access-tokens',
  };
}

export async function verifyBridgeToken(platform, token) {
  if (platform === 'vercel') return verifyVercelToken(token);
  if (platform === 'netlify') return verifyNetlifyToken(token);
  throw new Error('پلتفرم ناشناخته؛ فقط vercel یا netlify.');
}

/* ── generated bridge content ────────────────────────────────────────────── */

function decoyPage(brand) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${brand}</title>
<style>
body{margin:0;height:100vh;display:grid;place-items:center;background:#06070a;color:#eef2fa;
font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;text-align:center;padding:24px}
a{color:#22d3ee}h1{font-size:22px;margin:0 0 10px}p{color:#9aa6bb;max-width:520px;line-height:1.7}
code{background:#101319;padding:2px 7px;border-radius:6px;font-size:12px}
</style></head>
<body><div>
<h1>${brand}</h1>
<p>Edge delivery is online. Static assets are served from this deployment and
dynamic routes are forwarded to the upstream origin.</p>
<p><code>status: ok</code> · <a href="/__bridge">bridge health</a></p>
</div></body></html>
`;
}

/**
 * vercel.json — the tunnel path is reverse-proxied at the edge (zero compute),
 * everything else stays a normal static site so the deployment looks innocent.
 */
export function vercelConfig(target, tunnelPath) {
  const clean = String(target || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const tp = String(tunnelPath || '/').startsWith('/') ? String(tunnelPath || '/') : `/${tunnelPath}`;
  return JSON.stringify({
    $schema: 'https://openapi.vercel.sh/vercel.json',
    rewrites: [
      { source: '/__bridge', destination: '/api/bridge.js' },
      { source: tp, destination: `https://${clean}${tp}` },
      { source: `${tp.replace(/\/$/, '')}/(.*)`, destination: `https://${clean}${tp}/$1` },
    ],
    headers: [
      {
        source: '/(.*)',
        headers: [
          { key: 'x-vercel-enable-rewrite-caching', value: '0' },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
          { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
        ],
      },
    ],
  }, null, 2);
}

/**
 * Node streaming relay for Vercel. Unlike the old panel generator this one
 * keeps `Upgrade`/`Connection` so a websocket handshake survives the hop, and
 * it never buffers the body in memory.
 */
export function vercelRelay(target) {
  const clean = String(target || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `// api/relay.js — Omni unbuffered streaming relay (XHTTPRelayECO shape)
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";

export const config = { api: { bodyParser: false, responseLimit: false, maxDuration: 60 } };

const HOP_BY_HOP = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "x-vercel-id", "x-vercel-cache",
  "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port", "forwarded",
]);

export default function handler(req, res) {
  const raw = process.env.BACKEND_URL || "https://${clean}";
  let backend;
  try { backend = new URL(raw.startsWith("http") ? raw : "https://" + raw); }
  catch { res.statusCode = 500; return res.end("bad BACKEND_URL"); }

  const secure = backend.protocol === "https:";
  const port = Number(backend.port || (secure ? 443 : 80));
  const isUpgrade = String(req.headers.upgrade || "").toLowerCase() === "websocket";

  const headers = {};
  for (const [k, v] of Object.entries(req.headers || {})) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP.has(key) && key !== "upgrade" && key !== "connection") continue;
    headers[k] = v;
  }
  // The Worker matches on Host: keep the tunnel hostname, not the local one.
  headers.host = backend.host;
  if (isUpgrade) { headers.connection = "Upgrade"; headers.upgrade = "websocket"; }

  const doRequest = secure ? httpsRequest : httpRequest;
  const upstream = doRequest({
    hostname: backend.hostname, port, method: req.method,
    path: req.url || "/", headers, servername: secure ? backend.hostname : undefined,
  });

  upstream.on("upgrade", (uRes, socket, head) => {
    const lines = [\`HTTP/1.1 101 Switching Protocols\`];
    for (const [k, v] of Object.entries(uRes.headers || {})) lines.push(\`\${k}: \${v}\`);
    res.socket.write(lines.join("\\r\\n") + "\\r\\n\\r\\n");
    if (head && head.length) res.socket.write(head);
    socket.pipe(res.socket); res.socket.pipe(socket);
    socket.on("error", () => {}); res.socket.on("error", () => {});
  });

  upstream.on("response", (uRes) => {
    res.statusCode = uRes.statusCode || 502;
    for (const [k, v] of Object.entries(uRes.headers || {})) {
      if (k.toLowerCase() === "transfer-encoding") continue;
      try { res.setHeader(k, v); } catch {}
    }
    uRes.pipe(res);
  });

  upstream.on("error", (e) => {
    if (!res.headersSent) { res.statusCode = 502; res.setHeader("content-type", "text/plain; charset=utf-8"); }
    try { res.end("bad gateway: " + (e && e.message ? e.message : "upstream")); } catch {}
  });

  if (req.body && typeof req.body.pipe === "function") req.body.pipe(upstream);
  else req.pipe(upstream);
}
`;
}

/** Same relay, exposed as a health/probe endpoint. */
export function vercelBridgeHealth(target) {
  const clean = String(target || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `export const config = { api: { bodyParser: false } };
export default async function handler(req, res) {
  const raw = process.env.BACKEND_URL || "https://${clean}";
  const started = Date.now();
  try {
    const r = await fetch(new URL("/healthz", raw.startsWith("http") ? raw : "https://" + raw));
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: r.ok, status: r.status, ms: Date.now() - started, relay: "omni-vercel" }));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: String(e && e.message || e), ms: Date.now() - started, relay: "omni-vercel" }));
  }
}
`;
}

export function vercelFiles(target, tunnelPath) {
  const clean = String(target || '');
  return [
    { file: 'vercel.json', data: vercelConfig(clean, tunnelPath) },
    { file: 'index.html', data: decoyPage('Omni Edge Delivery') },
    { file: 'api/relay.js', data: vercelRelay(clean) },
    { file: 'api/bridge.js', data: vercelBridgeHealth(clean) },
    { file: 'package.json', data: JSON.stringify({ name: 'omni-edge-bridge', version: '2.1.0', private: true }, null, 2) },
    { file: 'README.md', data: `# Omni Edge Bridge (Vercel)\n\nAuto-generated by the Omni panel/bot.\nUpstream: \`https://${clean}\`\nTunnel path: \`${tunnelPath}\`\n` },
  ];
}

/** netlify.toml — proxy only the tunnel path, keep the rest a static decoy. */
export function netlifyConfig(target, tunnelPath) {
  const clean = String(target || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const tp = String(tunnelPath || '/').startsWith('/') ? String(tunnelPath || '/') : `/${tunnelPath}`;
  return `# netlify.toml — generated by Omni · zero-compute proxy for the tunnel path only
[functions]
  directory = "netlify/edge-functions"

[[redirects]]
  from = "${tp}"
  to = "https://${clean}${tp}"
  status = 200
  force = true

[[redirects]]
  from = "${tp.replace(/\/$/, '')}/*"
  to = "https://${clean}${tp}/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/__bridge"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-From = "Netlify-Omni-Bridge"
    Cache-Control = "no-store"
`;
}

/** Netlify Edge Function (Deno) — the relay fallback with websocket-safe headers. */
export function netlifyEdgeFunction(target) {
  const clean = String(target || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `// netlify/edge-functions/relay.js — Omni Netlify Edge relay (Deno)
const TARGET_BASE = (Netlify.env.get("BACKEND_URL") || "https://${clean}").replace(/\\/$/, "");

const STRIP = new Set([
  "host", "keep-alive", "proxy-authenticate", "proxy-authorization", "te",
  "trailer", "transfer-encoding", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port",
]);

export default async function handler(request, context) {
  const url = new URL(request.url);
  if (url.pathname === "/" || url.pathname === "/__bridge") return context.next();
  if (!TARGET_BASE) return new Response("misconfigured: BACKEND_URL", { status: 500 });

  const headers = new Headers();
  let clientIp = null;
  for (const [key, value] of request.headers) {
    const k = key.toLowerCase();
    if (STRIP.has(k)) continue;
    if (k.startsWith("x-nf-") || k.startsWith("x-netlify-")) continue;
    if (k === "x-real-ip") { clientIp = value; continue; }
    if (k === "x-forwarded-for") { if (!clientIp) clientIp = value; continue; }
    headers.set(k, value);
  }
  headers.set("host", new URL(TARGET_BASE).host);
  if (clientIp) headers.set("x-forwarded-for", clientIp);
  headers.set("x-relay-layer", "netlify-omni");

  const method = request.method;
  const init = { method, headers, redirect: "manual" };
  if (method !== "GET" && method !== "HEAD") init.body = request.body;

  try {
    const upstream = await fetch(TARGET_BASE + url.pathname + url.search, init);
    const out = new Headers();
    for (const [key, value] of upstream.headers) {
      if (key.toLowerCase() === "transfer-encoding") continue;
      out.set(key, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: out });
  } catch (e) {
    return new Response("bad gateway: " + (e && e.message ? e.message : "relay"), { status: 502 });
  }
}

export const config = { path: "/*", excludedPath: ["/", "/index.html", "/favicon.ico"] };
`;
}

export function netlifyFiles(target, tunnelPath) {
  const clean = String(target || '');
  return [
    { file: 'netlify.toml', data: netlifyConfig(clean, tunnelPath) },
    { file: 'index.html', data: decoyPage('Omni Edge Delivery') },
    { file: 'netlify/edge-functions/relay.js', data: netlifyEdgeFunction(clean) },
    { file: 'README.md', data: `# Omni Edge Bridge (Netlify)\n\nAuto-generated by the Omni panel/bot.\nUpstream: \`https://${clean}\`\nTunnel path: \`${tunnelPath}\`\n` },
  ];
}

/* ── Vercel deploy ───────────────────────────────────────────────────────── */

/** Vercel turns deployment protection on for new projects; every path then
 *  answers 302 "Protected by Vercel Authentication". */
async function vercelAllowPublicAccess(token, projectId, teamId) {
  const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  await vfetch(token, `/v9/projects/${encodeURIComponent(projectId)}${q}`, {
    method: 'PATCH',
    body: JSON.stringify({ ssoProtection: null }),
  }).catch(() => null);
}

async function vercelEnsureProject(token, name, target, teamId) {
  const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  try {
    const existing = await vfetch(token, `/v9/projects/${encodeURIComponent(name)}${q}`);
    if (existing?.id) {
      await vercelAllowPublicAccess(token, existing.id, teamId);
      return { id: existing.id, name: existing.name, created: false };
    }
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const created = await vfetch(token, `/v11/projects${q}`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      framework: null,
      buildCommand: null,
      outputDirectory: null,
      installCommand: null,
      ssoProtection: null,
      // `env` is not an accepted property here (400 "should NOT have additional
      // property `env`"); vercelSetEnv writes BACKEND_URL right after.
    }),
  });
  if (!created?.id) throw new Error('ورسل شناسهٔ پروژه برنگرداند.');
  await vercelAllowPublicAccess(token, created.id, teamId);
  return { id: created.id, name: created.name || name, created: true };
}

async function vercelSetEnv(token, projectId, target, teamId) {
  const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const value = `https://${String(target).replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  const existing = await vfetch(token, `/v9/projects/${encodeURIComponent(projectId)}/env${q}`).catch(() => null);
  const current = (existing?.envs || []).find((e) => e.key === 'BACKEND_URL');
  if (current) {
    await vfetch(token, `/v9/projects/${encodeURIComponent(projectId)}/env/${current.id}${q}`, {
      method: 'PATCH', body: JSON.stringify({ value }),
    }).catch(() => null);
    return;
  }
  await vfetch(token, `/v9/projects/${encodeURIComponent(projectId)}/env${q}`, {
    method: 'POST',
    body: JSON.stringify({ key: 'BACKEND_URL', value, type: 'plain', target: ['production', 'preview', 'development'] }),
  }).catch(() => null);
}

async function vercelWaitReady(token, id, teamId, { timeoutMs = 55000, onProgress = null } = {}) {
  const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await vfetch(token, `/v13/deployments/${encodeURIComponent(id)}${q}`).catch(() => last);
    const state = last?.readyState || last?.status || 'QUEUED';
    if (onProgress) await onProgress(`ورسل: ${state}`);
    if (state === 'READY') return { state, deployment: last, ms: Date.now() - started };
    if (['ERROR', 'CANCELED'].includes(state)) {
      const reason = last?.error?.message || last?.readyStateReason?.message || 'build failed';
      const e = new Error(`دیپلوی ورسل ناموفق: ${reason}`);
      e.status = 502;
      throw e;
    }
    await bridgeSleep(2500);
  }
  return { state: last?.readyState || 'BUILDING', deployment: last, ms: Date.now() - started, pending: true };
}

export async function deployVercelBridge({ token, name = '', target, tunnelPath = '/', teamId = '', onProgress = null, waitMs = 55000 }) {
  const cleanTarget = normalizeTargetHost(target);
  if (!cleanTarget) throw new Error('آدرس ورکر مقصد معتبر نیست.');
  const report = (s) => (onProgress ? onProgress(s) : Promise.resolve());

  await report('ورسل: بررسی توکن…');
  const who = await verifyVercelToken(token);
  const team = teamId || who.teamId || '';

  let projectName = bridgeProjectName(name);
  await report('ورسل: ساخت پروژه…');
  let project;
  try {
    project = await vercelEnsureProject(token, projectName, cleanTarget, team);
  } catch (e) {
    if (e.status === 400 || e.status === 409) {
      projectName = bridgeProjectName(`${projectName}-${Math.random().toString(36).slice(2, 5)}`);
      project = await vercelEnsureProject(token, projectName, cleanTarget, team);
    } else throw e;
  }

  await vercelSetEnv(token, project.id, cleanTarget, team);

  await report('ورسل: ارسال فایل‌ها و دیپلوی پروداکشن…');
  const q = team ? `?teamId=${encodeURIComponent(team)}&forceNew=1` : '?forceNew=1';
  const files = vercelFiles(cleanTarget, tunnelPath).map((f) => ({ file: f.file, data: f.data, encoding: 'utf-8' }));
  const deployment = await vfetch(token, `/v13/deployments${q}`, {
    method: 'POST',
    body: JSON.stringify({
      name: projectName,
      // `projectId` is rejected here (400 "should NOT have additional property
      // `projectId`"); the deployment is bound to the project by `name`.
      target: 'production',
      projectSettings: { framework: null, buildCommand: null, outputDirectory: null, installCommand: null },
      files,
    }),
  });
  if (!deployment?.id) throw new Error('ورسل شناسهٔ دیپلوی برنگرداند.');

  const ready = await vercelWaitReady(token, deployment.id, team, { timeoutMs: waitMs, onProgress });
  const alias = Array.isArray(deployment.alias) && deployment.alias.length ? deployment.alias[0] : '';
  const domain = alias || deployment.url || `${projectName}.vercel.app`;
  return {
    platform: 'vercel',
    ok: true,
    state: ready.pending ? 'building' : 'ready',
    name: projectName,
    projectId: project.id,
    deploymentId: deployment.id,
    domain: String(domain).replace(/^https?:\/\//, ''),
    url: `https://${String(domain).replace(/^https?:\/\//, '')}`,
    deploymentUrl: deployment.inspectUrl || `https://vercel.com/deployments/${deployment.id}`,
    dashboard: `https://vercel.com/${projectName}`,
    target: cleanTarget,
    tunnelPath,
    account: { username: who.username, email: who.email },
    ms: ready.ms,
  };
}

/* ── Netlify deploy ──────────────────────────────────────────────────────── */

async function netlifyEnsureSite(token, name, onProgress) {
  if (name) {
    const existing = await nfetch(token, `/sites/${encodeURIComponent(name)}`).catch(() => null);
    if (existing?.id) {
      await netlifyAllowPublicAccess(token, existing.id);
      return { id: existing.id, name: existing.name, subdomain: existing.subdomain, created: false };
    }
  }
  const body = { created_via: 'omni-panel', processing: { html: { pretty_urls: false }, skip_form_detection: true } };
  if (name) body.name = name;
  const site = await nfetch(token, '/sites', { method: 'POST', body: JSON.stringify(body) });
  if (!site?.id) throw new Error('نتلیفای شناسهٔ سایت برنگرداند.');
  await netlifyAllowPublicAccess(token, site.id);
  if (name && site.name !== name) await onProgress?.(`نتلیفای: نام «${name}» آزاد نبود، سایت با نام «${site.name}» ساخته شد`);
  return { id: site.id, name: site.name, subdomain: site.subdomain, created: true, ssl_url: site.ssl_url, url: site.url };
}

/** Netlify turns SSO login on for new sites; every path then answers 401. */
async function netlifyAllowPublicAccess(token, siteId) {
  await nfetch(token, `/sites/${encodeURIComponent(siteId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sso_login: false }),
  }).catch(() => null);
}

export async function deployNetlifyBridge({ token, name = '', target, tunnelPath = '/', onProgress = null, waitMs = 50000 }) {
  const cleanTarget = normalizeTargetHost(target);
  if (!cleanTarget) throw new Error('آدرس ورکر مقصد معتبر نیست.');
  const report = (s) => (onProgress ? onProgress(s) : Promise.resolve());

  await report('نتلیفای: بررسی توکن…');
  const who = await verifyNetlifyToken(token);

  await report('نتلیفای: ساخت سایت…');
  let siteName = bridgeProjectName(name, 'omni-bridge');
  let site;
  try {
    site = await netlifyEnsureSite(token, siteName, report);
  } catch (e) {
    if (e.status === 400 || e.status === 409 || e.status === 422) {
      siteName = `${bridgeProjectName('', 'omni-bridge')}-${Date.now().toString(36).slice(-4)}`;
      site = await netlifyEnsureSite(token, siteName, report);
    } else throw e;
  }

  await report('نتلیفای: محاسبهٔ اثر انگشت فایل‌ها…');
  const files = netlifyFiles(cleanTarget, tunnelPath);
  const withHash = [];
  for (const f of files) withHash.push({ ...f, sha1: await sha1Hex(f.data) });
  const digest = {};
  for (const f of withHash) digest[`/${f.file}`] = f.sha1;

  await report('نتلیفای: ثبت دیپلوی…');
  const deploy = await nfetch(token, `/sites/${encodeURIComponent(site.id)}/deploys`, {
    method: 'POST',
    body: JSON.stringify({
      files: digest,
      // `edge_functions` here makes Netlify answer 500 ("no implicit conversion of
      // String into Integer"); the relay ships as a netlify.toml-declared function.
      env: { BACKEND_URL: `https://${cleanTarget}` },
      async: false,
    }),
  });
  if (!deploy?.id) throw new Error('نتلیفای شناسهٔ دیپلوی برنگرداند.');

  const required = Array.isArray(deploy.required) ? deploy.required : [];
  if (required.length) {
    await report(`نتلیفای: آپلود ${required.length} فایل…`);
    for (const f of withHash) {
      if (!required.includes(f.sha1)) continue;
      await nfetch(token, `/deploys/${encodeURIComponent(deploy.id)}/files/${f.file.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream' },
        body: f.data,
      });
    }
  }

  const started = Date.now();
  let state = deploy.state || 'pending';
  let current = deploy;
  while (Date.now() - started < waitMs) {
    current = await nfetch(token, `/deploys/${encodeURIComponent(deploy.id)}`).catch(() => current);
    state = current?.state || state;
    await report(`نتلیفای: ${state}`);
    if (['ready', 'current', 'published'].includes(state)) break;
    if (['error', 'failed', 'cancelled'].includes(state)) {
      const e = new Error(`دیپلوی نتلیفای ناموفق: ${current?.error_message || state}`);
      e.status = 502;
      throw e;
    }
    await bridgeSleep(2500);
  }

  const subdomain = current?.subdomain || site.subdomain || site.name;
  const domain = `${subdomain}.netlify.app`;
  return {
    platform: 'netlify',
    ok: true,
    state: ['ready', 'current', 'published'].includes(state) ? 'ready' : 'building',
    name: site.name,
    siteId: site.id,
    deploymentId: deploy.id,
    domain,
    url: `https://${domain}`,
    deploymentUrl: `https://app.netlify.com/sites/${site.name}/deploys/${deploy.id}`,
    dashboard: `https://app.netlify.com/sites/${site.name}`,
    target: cleanTarget,
    tunnelPath,
    account: { username: who.username, email: who.email },
    ms: Date.now() - started,
  };
}

export async function deployBridge(platform, opts) {
  if (platform === 'vercel') return deployVercelBridge(opts);
  if (platform === 'netlify') return deployNetlifyBridge(opts);
  throw new Error('پلتفرم ناشناخته؛ فقط vercel یا netlify.');
}

/* ── D1 storage ──────────────────────────────────────────────────────────── */

export async function ensureBridgeSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS bot_bridges(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT NOT NULL DEFAULT 'panel',
    platform TEXT NOT NULL,
    name TEXT NOT NULL,
    project_id TEXT,
    deployment_id TEXT,
    domain TEXT,
    url TEXT,
    target_host TEXT,
    tunnel_path TEXT,
    status TEXT NOT NULL DEFAULT 'deploying',
    error TEXT,
    token_ref TEXT,
    dashboard_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS bot_bridge_tokens(
    ref TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    token TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
}

export async function listBridges(db, owner = null, limit = 25) {
  await ensureBridgeSchema(db);
  const rows = owner
    ? await db.prepare(`SELECT id,platform,name,domain,url,target_host,tunnel_path,status,error,dashboard_url,created_at,updated_at,token_ref
                        FROM bot_bridges WHERE owner=? ORDER BY id DESC LIMIT ?`).bind(String(owner), Number(limit)).all()
    : await db.prepare(`SELECT id,platform,name,domain,url,target_host,tunnel_path,status,error,dashboard_url,created_at,updated_at,token_ref
                        FROM bot_bridges ORDER BY id DESC LIMIT ?`).bind(Number(limit)).all();
  return rows.results || [];
}

export async function getBridge(db, id) {
  await ensureBridgeSchema(db);
  return db.prepare(`SELECT * FROM bot_bridges WHERE id=?`).bind(Number(id)).first();
}

export async function createBridgeRecord(db, { owner = 'panel', platform, name, target, tunnelPath = '/', tokenRef = null }) {
  await ensureBridgeSchema(db);
  const res = await db.prepare(
    `INSERT INTO bot_bridges(owner,platform,name,target_host,tunnel_path,status,token_ref) VALUES(?,?,?,?,?,?,?)`
  ).bind(String(owner), platform, String(name), String(target), String(tunnelPath), 'deploying', tokenRef).run();
  return Number(res?.meta?.last_row_id || 0);
}

export async function updateBridgeRecord(db, id, fields = {}) {
  await ensureBridgeSchema(db);
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (!['name', 'project_id', 'deployment_id', 'domain', 'url', 'status', 'error', 'dashboard_url', 'token_ref', 'target_host', 'tunnel_path'].includes(k)) continue;
    sets.push(`${k}=?`);
    vals.push(v === undefined || v === null ? null : String(v));
  }
  if (!sets.length) return;
  sets.push(`updated_at=datetime('now')`);
  vals.push(Number(id));
  await db.prepare(`UPDATE bot_bridges SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();
}

export async function deleteBridgeRecord(db, id) {
  await ensureBridgeSchema(db);
  await db.prepare(`DELETE FROM bot_bridges WHERE id=?`).bind(Number(id)).run();
}

export async function saveBridgeToken(db, platform, token) {
  await ensureBridgeSchema(db);
  const ref = `br_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  await db.prepare(`INSERT INTO bot_bridge_tokens(ref,platform,token) VALUES(?,?,?)`).bind(ref, platform, String(token)).run();
  return ref;
}

export async function readBridgeToken(db, ref) {
  if (!ref) return '';
  await ensureBridgeSchema(db);
  const row = await db.prepare(`SELECT token FROM bot_bridge_tokens WHERE ref=?`).bind(String(ref)).first();
  return row?.token || '';
}

export async function forgetBridgeToken(db, ref) {
  if (!ref) return;
  await ensureBridgeSchema(db);
  await db.prepare(`DELETE FROM bot_bridge_tokens WHERE ref=?`).bind(String(ref)).run();
}

/**
 * Full lifecycle: persist a row, deploy in the background, keep the row updated.
 * Returns the row id immediately so HTTP callers can poll instead of timing out.
 */
export async function startBridgeDeploy(db, ctx, { owner = 'panel', platform, token, name = '', target, tunnelPath = '/', saveToken = false, onProgress = null, waitMs }) {
  if (!isBridgePlatform(platform)) throw new Error('پلتفرم باید vercel یا netlify باشد.');
  const cleanTarget = normalizeTargetHost(target);
  if (!cleanTarget) throw new Error('آدرس ورکر مقصد را درست وارد کنید (مثل omni-xxx.workers.dev).');
  if (!bridgeTokenShape(platform, token)) {
    const e = new Error('ساختار توکن درست نیست.');
    e.auth = true;
    throw e;
  }

  const projectName = bridgeProjectName(name);
  const tokenRef = saveToken ? await saveBridgeToken(db, platform, token) : null;
  const id = await createBridgeRecord(db, { owner, platform, name: projectName, target: cleanTarget, tunnelPath, tokenRef });

  const work = (async () => {
    try {
      const opts = { token, name: projectName, target: cleanTarget, tunnelPath, onProgress };
      if (Number(waitMs) > 0) opts.waitMs = Number(waitMs);
      const result = await deployBridge(platform, opts);
      await updateBridgeRecord(db, id, {
        name: result.name || projectName,
        project_id: result.projectId || result.siteId || null,
        deployment_id: result.deploymentId || null,
        domain: result.domain,
        url: result.url,
        status: result.state === 'ready' ? 'ready' : 'building',
        error: null,
        dashboard_url: result.dashboard || null,
      });
      return result;
    } catch (e) {
      await updateBridgeRecord(db, id, { status: 'failed', error: String(e?.message || e).slice(0, 400) });
      throw e;
    }
  })();

  if (ctx?.waitUntil) ctx.waitUntil(work.catch(() => {}));
  return { id, name: projectName, target: cleanTarget, promise: work };
}
