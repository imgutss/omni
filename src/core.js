/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/core.js
   موتور پروکسی VLESS/Trojan روی WebSocket + احراز هویت کاربران از D1
   (کنترل حجم، انقضا، سقف دستگاه، سقف درخواست، لیست بلاک، first-connect)
   ══════════════════════════════════════════════════════════════════════════ */

import { connect } from 'cloudflare:sockets';
import { settingsCached, getSetting, putSetting, logEvent, randomUuid } from './auth.js';

const WS_READY = 101;
const CLOSE_AUTH = 1008;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ───────────── ابزار ───────────── */
function toBytes(msg) {
  if (msg == null) return new Uint8Array(0);
  if (msg instanceof ArrayBuffer) return new Uint8Array(msg);
  if (ArrayBuffer.isView(msg)) return new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength);
  if (typeof msg === 'string') return new TextEncoder().encode(msg);
  try { return new Uint8Array(msg); } catch { return new TextEncoder().encode(String(msg)); }
}
function b64ToBytes(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/=]*$/.test(s)) return new Uint8Array(0);
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const safeClose = (ws, code, reason) => { try { ws.close(code, reason); } catch { /* ignore */ } };
const jsonOut = (o, status = 200, headers = {}) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

async function sha256Hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ───────────── SHA-224 (برای پروتکل Trojan) ───────────── */
const sha224Hex = (() => {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
  return function (input) {
    const msg = typeof input === 'string' ? new TextEncoder().encode(input) : input;
    const H = new Uint32Array([0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4]);
    const bitLen = msg.length * 8;
    const withPad = new Uint8Array((((msg.length + 9) >> 6) + 1) << 6);
    withPad.set(msg); withPad[msg.length] = 0x80;
    const dv = new DataView(withPad.buffer);
    dv.setUint32(withPad.length - 4, bitLen >>> 0, false);
    dv.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000), false);
    const W = new Uint32Array(64);
    for (let off = 0; off < withPad.length; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return [...H.slice(0, 7)].map((x) => x.toString(16).padStart(8, '0')).join('');
  };
})();

/* ───────────── خواننده‌ی جریان ───────────── */
class FastReader {
  constructor(reader) { this.reader = reader; this.buf = new Uint8Array(0); this.done = false; }
  async ensure(n) {
    while (this.buf.byteLength < n && !this.done) {
      const { value, done } = await this.reader.read();
      if (done) { this.done = true; break; }
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      const merged = new Uint8Array(this.buf.byteLength + chunk.byteLength);
      merged.set(this.buf, 0); merged.set(chunk, this.buf.byteLength);
      this.buf = merged;
    }
    return this.buf.byteLength >= n;
  }
  take(n) { const out = this.buf.subarray(0, n); this.buf = this.buf.subarray(n); return out; }
  rest() { const out = this.buf; this.buf = new Uint8Array(0); return out; }
  async peek(n) { await this.ensure(n); return this.buf.subarray(0, Math.min(n, this.buf.byteLength)); }
}

/** صف رویدادمحور پیام‌های WebSocket (پاسخ 101 باید فوری برگردد) */
class WSQueue {
  constructor(ws) {
    this.chunks = []; this.waiters = []; this.closed = false;
    ws.addEventListener('message', (e) => this.push(toBytes(e.data)));
    ws.addEventListener('close', () => this.close());
    ws.addEventListener('error', () => this.close());
  }
  push(b) {
    if (this.closed || !b.byteLength) return;
    const w = this.waiters.shift();
    if (w) w({ value: b, done: false }); else this.chunks.push(b);
  }
  unshift(b) { if (b?.byteLength) this.chunks.unshift(b); }
  close() {
    this.closed = true;
    for (const w of this.waiters) w({ value: new Uint8Array(0), done: true });
    this.waiters = [];
  }
  read() {
    if (this.chunks.length) return Promise.resolve({ value: this.chunks.shift(), done: false });
    if (this.closed) return Promise.resolve({ value: new Uint8Array(0), done: true });
    return new Promise((res) => this.waiters.push(res));
  }
}

/* ───────────── پارس هدر VLESS/Trojan ───────────── */
function bytesToUuid(b) {
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function readAddress(reader, { withPort = true, socks = false } = {}) {
  if (!(await reader.ensure(1))) return null;
  // VLESS: 1=IPv4، 2=دامنه، 3=IPv6 | Trojan (سبک SOCKS5): 1=IPv4، 3=دامنه، 4=IPv6
  const type = reader.take(1)[0];
  const isDomain = socks ? type === 3 : type === 2;
  const isIpv6 = socks ? type === 4 : type === 3;
  let hostname = null;
  if (type === 1) {
    if (!(await reader.ensure(4))) return null;
    hostname = [...reader.take(4)].join('.');
  } else if (isDomain) {
    if (!(await reader.ensure(1))) return null;
    const len = reader.take(1)[0];
    if (!(await reader.ensure(len))) return null;
    hostname = new TextDecoder().decode(reader.take(len));
  } else if (isIpv6) {
    if (!(await reader.ensure(16))) return null;
    const b = [...reader.take(16)];
    const g = Array.from({ length: 8 }, (_, i) => ((b[i * 2] << 8) | b[i * 2 + 1]).toString(16));
    let best = -1, bestLen = 0, cur = -1, curLen = 0;
    g.forEach((x, i) => {
      if (x === '0') { if (cur < 0) cur = i; curLen++; if (curLen > bestLen) { best = cur; bestLen = curLen; } }
      else { cur = -1; curLen = 0; }
    });
    hostname = bestLen > 1 ? `${g.slice(0, best).join(':')}::${g.slice(best + bestLen).join(':')}` : g.join(':');
  } else return null;
  if (!hostname) return null;
  let port = null;
  if (withPort) {
    if (!(await reader.ensure(2))) return null;
    port = (reader.take(1)[0] << 8) | reader.take(1)[0];
  }
  return { hostname, port };
}

async function parseVless(reader) {
  if (!(await reader.ensure(18))) return null;
  const version = reader.take(1)[0];
  const uuid = bytesToUuid(reader.take(16));
  const optLen = reader.take(1)[0];
  if (optLen > 0 && !(await reader.ensure(optLen + 3))) return null;
  if (optLen > 0) reader.take(optLen);
  const cmd = reader.take(1)[0];
  const port = (reader.take(1)[0] << 8) | reader.take(1)[0];
  const addr = await readAddress(reader, { withPort: false });
  if (!addr) return null;
  return { version, uuid, cmd, hostname: addr.hostname, port, vless: true };
}

async function parseTrojan(reader) {
  if (!(await reader.ensure(56 + 2 + 1))) return null;
  const password = new TextDecoder().decode(reader.take(56));
  const c1 = reader.take(2);
  if (c1[0] !== 13 || c1[1] !== 10) return null;
  const cmd = reader.take(1)[0];
  const addr = await readAddress(reader, { withPort: true, socks: true });
  if (!addr) return null;
  if (!(await reader.ensure(2))) return null;
  const c2 = reader.take(2);
  if (c2[0] !== 13 || c2[1] !== 10) return null;
  return { password, cmd, hostname: addr.hostname, port: addr.port, trojan: true };
}

/* ───────────── احراز هویت کاربر (D1 + کش) ───────────── */
let USER_CACHE = new Map();   // uuid → {user, at}
const USER_CACHE_MS = 12000;

async function findUser(env, uuid) {
  const hit = USER_CACHE.get(uuid);
  if (hit && Date.now() - hit.at < USER_CACHE_MS) return hit.user;
  const user = await env.DB.prepare('SELECT * FROM users WHERE uuid = ?').bind(uuid).first();
  USER_CACHE.set(uuid, { user, at: Date.now() });
  if (USER_CACHE.size > 500) USER_CACHE = new Map([...USER_CACHE].slice(-250));
  return user;
}
export function invalidateUser(uuid) { if (uuid) USER_CACHE.delete(uuid); else USER_CACHE.clear(); }

export function userStatus(user) {
  if (!user) return 'unknown';
  if (!user.is_active) return 'disabled';
  const used = (user.up_bytes || 0) + (user.down_bytes || 0);
  if (Number(user.quota_bytes) > 0 && used >= Number(user.quota_bytes)) return 'limited';
  if (user.expires_at && new Date(String(user.expires_at).replace(' ', 'T') + 'Z') < new Date()) return 'expired';
  if (user.request_limit > 0 && user.request_count >= user.request_limit) return 'limit';
  return 'active';
}

/** بلاک‌لیست داخلی (تبلیغات/محتوای غیرمجاز) — سبک و سریع */
const AD_HOSTS = ['doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com',
  'ads.yahoo.com', 'adnxs.com', 'criteo.com', 'taboola.com', 'outbrain.com', 'pubmatic.com', 'rubiconproject.com',
  'scorecardresearch.com', 'quantserve.com', 'moatads.com', 'adcolony.com', 'applovin.com', 'unityads.unity3d.com',
  'facebook.com/tr', 'analytics.tiktok.com', 'ads-twitter.com', 'yektanet.com', 'tapsell.ir', 'adad.ir'];
const NSFW_HOSTS = ['pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com', 'youporn.com',
  'brazzers.com', 'onlyfans.com', 'chaturbate.com', 'stripchat.com', 'livejasmin.com', 'bongacams.com'];

function hostBlocked(host, patterns) {
  if (!host) return false;
  const h = String(host).toLowerCase();
  return patterns.some((p) => {
    const pat = String(p).trim().toLowerCase();
    if (!pat) return false;
    if (pat === '*') return true;
    if (pat.startsWith('*.')) return h === pat.slice(2) || h.endsWith(pat.slice(1));
    return h === pat || h.endsWith('.' + pat);
  });
}

async function authorizeRequest(env, request, cred, settings) {
  if (settings.maintenance === '1') return { ok: false, reason: 'maintenance' };

  if (cred.trojan) {
    const pass = settings.trojan_password || '';
    if (pass && (cred.password === pass || cred.password.toLowerCase() === sha224Hex(pass))) {
      return { ok: true, user: { id: 0, username: 'owner', uuid: 'trojan-owner', device_limit: 0, block_list: '[]' }, owner: true };
    }
    return { ok: false, reason: 'bad-password' };
  }

  const user = await findUser(env, cred.uuid);
  if (!user) return { ok: false, reason: 'unknown-uuid' };
  const status = userStatus(user);
  if (status !== 'active') return { ok: false, reason: status, user };

  // بلاک‌لیست کاربر + سراسری
  const custom = safeJsonArray(user.block_list);
  if (hostBlocked(cred.hostname, custom)) return { ok: false, reason: 'blocked-domain', user };
  if (settings.block_ads === '1' && hostBlocked(cred.hostname, AD_HOSTS)) return { ok: false, reason: 'blocked-ads', user };
  if (settings.block_nsfw === '1' && hostBlocked(cred.hostname, NSFW_HOSTS)) return { ok: false, reason: 'blocked-nsfw', user };

  // سقف دستگاه
  const limit = Number(user.device_limit || 0);
  if (limit > 0) {
    const dev = await sha256Hex(`${request.headers.get('cf-connecting-ip') || ''}|${(request.headers.get('user-agent') || '').slice(0, 80)}`);
    const row = await env.DB.prepare('SELECT device FROM devices WHERE username = ? AND last_seen > datetime(\'now\',\'-1 day\')')
      .bind(user.username).all();
    const known = (row.results || []).map((r) => r.device);
    if (!known.includes(dev) && known.length >= limit) return { ok: false, reason: 'device-limit', user };
  }
  return { ok: true, user };
}

export function safeJsonArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    try { const j = JSON.parse(v); if (Array.isArray(j)) return j; } catch { /* ignore */ }
    return v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/* ───────────── شمارنده‌ی مصرف ───────────── */
function makeReporter(env, ctx, user) {
  let up = 0, down = 0, stopped = false;
  const flush = async () => {
    if (!up && !down) return;
    const u = up, d = down; up = 0; down = 0;
    try {
      const total = u + d;
      await env.DB.batch([
        env.DB.prepare(`UPDATE users SET up_bytes = up_bytes + ?, down_bytes = down_bytes + ?, last_seen = datetime('now') WHERE username = ?`)
          .bind(u, d, user.username),
        env.DB.prepare(`INSERT INTO usage_daily(username,day,up_bytes,down_bytes,conns) VALUES(?, date('now'), ?, ?, 1)
          ON CONFLICT(username,day) DO UPDATE SET up_bytes = up_bytes + excluded.up_bytes,
          down_bytes = down_bytes + excluded.down_bytes, conns = conns + 1`).bind(user.username, u, d),
      ]);
      invalidateUser(user.uuid);
      // هشدار ۸۰٪ مصرف (یک‌بار در روز)
      const fresh = await env.DB.prepare('SELECT used_bytes_hint FROM (SELECT (up_bytes+down_bytes) AS used_bytes_hint, quota_bytes FROM users WHERE username=?)')
        .bind(user.username).first().catch(() => null);
      void total; void fresh;
    } catch (e) {
      up += u; down += d;
      console.error('usage-flush', e?.message || String(e));
    }
  };
  const timer = setInterval(() => { if (!stopped) ctx.waitUntil(flush()); }, 30000);
  return {
    add: (isUp, n) => { if (isUp) up += n; else down += n; },
    flush,
    async finish() { clearInterval(timer); stopped = true; await flush(); },
  };
}

/* ───────────── ثبت اتصال (کنترها و آمار) ───────────── */
async function registerConnection(env, request, user, settings) {
  const updates = [];
  updates.push(env.DB.prepare(
    `UPDATE users SET request_count = request_count + 1, last_seen = datetime('now'), last_ip = ?
     WHERE username = ?`).bind(request.headers.get('cf-connecting-ip') || '', user.username));

  // فعال‌سازی در نخستین اتصال
  if (user.first_connect && !user.activated_at) {
    const days = Number(user.pending_days || settings.default_expiry_days || 30);
    const exp = new Date(Date.now() + days * 864e5).toISOString().slice(0, 19).replace('T', ' ');
    updates.push(env.DB.prepare(`UPDATE users SET activated_at = datetime('now'), expires_at = ? WHERE username = ?`)
      .bind(exp, user.username));
  }

  // ثبت دستگاه (برای سقف دستگاه)
  if (Number(user.device_limit || 0) > 0) {
    const dev = await sha256Hex(`${request.headers.get('cf-connecting-ip') || ''}|${(request.headers.get('user-agent') || '').slice(0, 80)}`);
    updates.push(env.DB.prepare(
      `INSERT INTO devices(username,device,hits) VALUES(?,?,1)
       ON CONFLICT(username,device) DO UPDATE SET last_seen = datetime('now'), hits = hits + 1`).bind(user.username, dev));
  }
  await env.DB.batch(updates).catch(() => {});
  invalidateUser(user.uuid);
}

/* ───────────── صفحه‌ی پوششی ───────────── */
const DECOY_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Cloudflare</title>
<style>body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#0b0d10;
color:#e8eaed;display:grid;place-items:center;height:100vh}.k{max-width:520px;padding:32px;text-align:center}
.c{width:64px;height:64px;margin:0 auto 20px;background:linear-gradient(135deg,#22d3ee,#818cf8);border-radius:16px}
h1{font-size:20px;font-weight:600;margin:0 0 10px}p{opacity:.7;line-height:1.7;font-size:14px}
code{background:#1a1d21;padding:2px 6px;border-radius:6px}</style></head>
<body><div class="k"><div class="c"></div><h1>Connection established</h1>
<p>This endpoint runs on Cloudflare's global edge network.</p><p><code>HTTP/2 101 Switching Protocols</code></p></div></body></html>`;

export async function serveDecoy(env, settings) {
  const target = settings.decoy_url;
  if (target) {
    try {
      const r = await fetch(target, { cf: { cacheTtl: 3600, cacheEverything: true } });
      return new Response(r.body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'text/html' } });
    } catch { /* ignore */ }
  }
  return new Response(DECOY_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/* ───────────── هندلر اصلی پروکسی ───────────── */
export async function handleProxy(request, env, ctx, url, settings) {
  const secretPath = settings.path || '/ws';
  if (!url.pathname.startsWith(secretPath)) return new Response('Not Found', { status: 404 });

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();

  const queue = new WSQueue(server);
  const early = request.headers.get('sec-websocket-protocol');
  if (early && early !== 'null') queue.unshift(b64ToBytes(early));

  ctx.waitUntil(runProxy(env, ctx, request, server, queue, settings));
  return new Response(null, { status: WS_READY, webSocket: client });
}

async function runProxy(env, ctx, request, server, queue, settings) {
  let remoteSocket = null, reporter = null, done = false;

  const shutdown = async () => {
    if (done) return;
    done = true;
    if (reporter) await reporter.finish();
    try { remoteSocket?.close?.(); } catch { /* ignore */ }
  };

  try {
    const reader = new FastReader(queue);
    const gotFirst = await Promise.race([reader.ensure(1), sleep(8000).then(() => false)]);
    if (!gotFirst) { safeClose(server, CLOSE_AUTH, 'no-data'); return await shutdown(); }

    const b0 = (await reader.peek(1))[0];
    let cred = null;
    // VLESS همیشه با bYTE 0 (نسخه ۰) شروع می‌شود؛ Trojan با ۵۶ کاراکتر hex پسورد.
    if (b0 === 0) cred = await parseVless(reader);
    else {
      // منتظر کامل‌شدن هدر Trojan (۵۶ + CRLF + cmd + addr) می‌مانیم تا فریم‌های تکه‌تکه هم درست پارس شوند
      await Promise.race([reader.ensure(59), sleep(8000)]);
      const head = await reader.peek(58);
      const looksTrojan = head.byteLength >= 58 && /^[\x20-\x7e]{56}\r\n/.test(new TextDecoder().decode(head));
      cred = looksTrojan ? await parseTrojan(reader) : await parseVless(reader);
    }

    if (!cred || (cred.cmd !== 1 && cred.cmd !== 3)) {
      safeClose(server, CLOSE_AUTH, 'bad-header');
      return await shutdown();
    }

    const auth = await authorizeRequest(env, request, cred, settings);
    if (!auth.ok) {
      safeClose(server, CLOSE_AUTH, auth.reason || 'unauthorized');
      return await shutdown();
    }
    const user = auth.user;

    if (cred.vless && cred.version !== undefined) server.send(new Uint8Array([cred.version, 0]));

    if (!auth.owner) ctx.waitUntil(registerConnection(env, request, user, settings));

    remoteSocket = connect({ hostname: cred.hostname, port: cred.port });
    const w = remoteSocket.writable.getWriter();
    const r = remoteSocket.readable.getReader();
    reporter = makeReporter(env, ctx, user);

    const leftover = reader.rest();
    if (leftover.byteLength) { reporter.add(true, leftover.byteLength); await w.write(leftover); }

    const pumpUp = async () => {
      try {
        while (!done) {
          const { value, done: fin } = await queue.read();
          if (fin) break;
          reporter.add(true, value.byteLength);
          await w.write(value);
        }
      } catch { /* ignore */ }
      try { await w.close(); } catch { /* ignore */ }
    };
    const pumpDown = async () => {
      try {
        while (!done) {
          const { value, done: fin } = await r.read();
          if (fin) break;
          reporter.add(false, value.byteLength);
          try { server.send(value); } catch { break; }
        }
      } catch { /* ignore */ }
      try { await w.close(); } catch { /* ignore */ }
      safeClose(server, 1000, 'done');
      await shutdown();
    };

    ctx.waitUntil(pumpUp());
    ctx.waitUntil(pumpDown());
  } catch (e) {
    safeClose(server, 1011, 'error');
    await shutdown();
  }
}

export { jsonOut, sha256Hex, jsonOut as json };
