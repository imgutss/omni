/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/core.js
   هسته‌ی تونل WebSocket برای VLESS و Trojan روی Cloudflare Workers
   - پشتیبانی از 0-RTT early-data (Sec-WebSocket-Protocol)
   - پشتیبانی از VLESS TCP (cmd=1)، VLESS UDP DNS over HTTPS (cmd=2) و Trojan
   - فالبک هوشمند ProxyIP + NAT64 در صورت خطای اتصال مستقیم یا دریافت ۰ بایت
     (الگوی ترکیبی Omni Control Panel + BPB + Zeus + Nahan برای عبور از محدودیت کلودفلر)
   - شمارش دقیق ترافیک (up/down)، تعداد درخواست‌ها، فعال‌سازی با اولین اتصال،
     سقف دستگاه، بلاک تبلیغات/NSFW/دامنه‌های دلخواه، صفحه‌ی پوششی (decoy)
   ══════════════════════════════════════════════════════════════════════════ */
import { connect } from 'cloudflare:sockets';

const dec = new TextDecoder();
const enc = new TextEncoder();

/* ─────────── استخر ProxyIP و پیشوندهای NAT64 (الگوی BPB / Zeus / Omni) ─────────── */
export const DEFAULT_PROXY_IPS = [
  'bpb.yousef.isegaro.com:443',
  'tr.diam4.ggff.net:443',
  'di.nscl.ir:443',
  'proxyip.cmliussss.net:443',
];

export const NAT64_PREFIXES = [
  '2602:fc59:b0:64::',
  '2602:fc59:11:64::',
  '2a02:898:146:64::',
];

const CF_IPV4_CIDRS = [
  [0x6715f400, 0xfffffc00], // 103.21.244.0/22
  [0x6716c800, 0xfffffc00], // 103.22.200.0/22
  [0x671f0400, 0xfffffc00], // 103.31.4.0/22
  [0x68100000, 0xfff00000], // 104.16.0.0/12
  [0x6ca2c000, 0xffffc000], // 108.162.192.0/18
  [0x83004800, 0xfffffc00], // 131.0.72.0/22
  [0x8d654000, 0xffffc000], // 141.101.64.0/18
  [0xa29e0000, 0xfffe0000], // 162.158.0.0/15
  [0xac400000, 0xfff80000], // 172.64.0.0/13
  [0xadf53000, 0xfffff000], // 173.245.48.0/20
  [0xbc726000, 0xfffff000], // 188.114.96.0/20
  [0xbe5df000, 0xfffff000], // 190.93.240.0/20
  [0xc5eaf000, 0xfffffc00], // 197.234.240.0/22
  [0xc6298000, 0xffff8000], // 198.41.128.0/17
];

export function isCloudflareTarget(host) {
  const h = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return false;
  if (h === 'cp.cloudflare.com' || h === 'speed.cloudflare.com' || h === 'cloudflare.com' || h.endsWith('.workers.dev')) {
    return true;
  }
  if (h.startsWith('2606:4700:') || h.startsWith('2803:f800:') || h.startsWith('2a06:98c0:')) {
    return true;
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const n = ((Number(m[1]) << 24) | (Number(m[2]) << 16) | (Number(m[3]) << 8) | Number(m[4])) >>> 0;
  for (const [net, mask] of CF_IPV4_CIDRS) {
    if (((n & mask) >>> 0) === (net >>> 0)) return true;
  }
  return false;
}

export function ipv4ToNat64(ip, prefix = '2602:fc59:b0:64::') {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || '').trim());
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]), d = Number(m[4]);
  if ([a, b, c, d].some((x) => x < 0 || x > 255)) return null;
  const h1 = ((a << 8) | b).toString(16);
  const h2 = ((c << 8) | d).toString(16);
  return `[${prefix}${h1}:${h2}]`;
}

export function parseProxyEntry(entry, defaultPort = 443) {
  const s = String(entry || '').trim();
  if (!s) return null;
  if (s.startsWith('[')) {
    const idx = s.indexOf(']');
    if (idx < 0) return null;
    const host = s.slice(0, idx + 1);
    const rest = s.slice(idx + 1);
    const port = rest.startsWith(':') ? Number(rest.slice(1)) || defaultPort : defaultPort;
    return { hostname: host, port };
  }
  const lastColon = s.lastIndexOf(':');
  if (lastColon > 0 && !s.slice(0, lastColon).includes(':')) {
    const host = s.slice(0, lastColon).trim();
    const port = Number(s.slice(lastColon + 1)) || defaultPort;
    return { hostname: host, port };
  }
  return { hostname: s, port: defaultPort };
}

/* ─────────── کش کاربران در حافظه (برای سرعت هندشیک) ─────────── */
const USER_CACHE = new Map();       // key: uuid → { at, user }
const PASS_CACHE = new Map();       // key: sha224(pass) → { at, user }
let ALL_USERS_AT = 0;

export function invalidateUser(uuid = null) {
  if (uuid) USER_CACHE.delete(uuid.toLowerCase());
  else USER_CACHE.clear();
  PASS_CACHE.clear();
  ALL_USERS_AT = 0;
}

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
    const msg = typeof input === 'string' ? enc.encode(input) : input;
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
    return [...H.subarray(0, 7)].map((w) => w.toString(16).padStart(8, '0')).join('');
  };
})();

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function findUserByUuid(env, uuid) {
  const key = uuid.toLowerCase();
  const c = USER_CACHE.get(key);
  if (c && Date.now() - c.at < 20000) return c.user;
  const u = await env.DB.prepare('SELECT * FROM users WHERE lower(uuid) = ?').bind(key).first();
  USER_CACHE.set(key, { at: Date.now(), user: u || null });
  return u;
}

async function warmPasswordMap(env, trojanGlobalPass) {
  if (Date.now() - ALL_USERS_AT < 20000 && PASS_CACHE.size > 0) return;
  const rows = await env.DB.prepare('SELECT * FROM users WHERE is_active = 1').all();
  PASS_CACHE.clear();
  for (const u of (rows.results || [])) {
    for (const candidate of [u.uuid, u.username, trojanGlobalPass].filter(Boolean)) {
      const h = await sha224Hex(candidate);
      if (!PASS_CACHE.has(h)) PASS_CACHE.set(h, u);
    }
  }
  ALL_USERS_AT = Date.now();
}

/* ─────────── بررسی وضعیت کاربر (فعال/منقضی/محدود) ─────────── */
export function userStatus(u) {
  if (!u) return 'missing';
  if (!u.is_active) return 'disabled';
  if (u.expires_at) {
    const exp = new Date(String(u.expires_at).replace(' ', 'T') + 'Z');
    if (exp < new Date()) return 'expired';
  }
  const used = Number(u.up_bytes || 0) + Number(u.down_bytes || 0);
  if (Number(u.quota_bytes || 0) > 0 && used >= Number(u.quota_bytes)) return 'limited';
  if (Number(u.request_limit || 0) > 0 && Number(u.request_count || 0) >= Number(u.request_limit)) return 'limited';
  return 'active';
}

/* ─────────── فیلتر دامنه (تبلیغات / NSFW / لیست سفارشی) ─────────── */
const ADS_SUFFIX = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adnxs.com',
  'taboola.com', 'outbrain.com', 'criteo.com', 'scorecardresearch.com', 'zedo.com',
  'adservice.google.com', 'pagead2.googlesyndication.com', 'ads.yahoo.com', 'moatads.com',
];
const NSFW_SUFFIX = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com', 'youporn.com',
  'onlyfans.com', 'chaturbate.com', 'spankbang.com', 'tube8.com',
];

function isBlockedHost(host, settings, user) {
  const h = String(host || '').toLowerCase();
  if (!h) return false;
  const match = (suf) => h === suf || h.endsWith('.' + suf);
  if (settings.block_ads === '1' && ADS_SUFFIX.some(match)) return true;
  if (settings.block_nsfw === '1' && NSFW_SUFFIX.some(match)) return true;
  const custom = [...safeJsonArray(settings.block_list), ...safeJsonArray(user?.block_list)];
  for (const item of custom) {
    const s = String(item || '').trim().toLowerCase();
    if (s && match(s)) return true;
  }
  return false;
}

export function safeJsonArray(v) {
  if (Array.isArray(v)) return v;
  try {
    const j = JSON.parse(v || '[]');
    return Array.isArray(j) ? j : [];
  } catch {
    return String(v || '').split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  }
}

/* ─────────── پارسر هدر VLESS ───────────
   فرمت: [version(1)] [uuid(16)] [optLen(1)] [opt(optLen)] [cmd(1)] [port(2)] [atyp(1)] [addr...] [payload...]
   cmd: 1 = TCP, 2 = UDP (DNS), 3 = Mux
   atyp: 1 = IPv4(4)  2 = domain(len+str)  3 = IPv6(16) */
function parseVlessHeader(buf) {
  if (buf.byteLength < 24) return null;
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const version = buf[0];
  const hex = [...buf.subarray(1, 17)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const optLen = buf[17];
  let off = 18 + optLen;
  if (buf.byteLength < off + 4) return null;
  const cmd = buf[off];
  const port = v.getUint16(off + 1, false);
  const atyp = buf[off + 3];
  off += 4;
  const addr = readAddress(buf, off, atyp, { vless: true });
  if (!addr) return null;
  return {
    proto: 'vless',
    version,
    uuid,
    cmd,
    port: cmd === 3 ? 443 : port,
    hostname: cmd === 3 ? 'mux.cool' : addr.host,
    payload: buf.subarray(addr.next),
  };
}

/* ─────────── پارسر هدر Trojan ───────────
   فرمت: [hex(sha224(password)) (56 bytes)] [CRLF (2)] [cmd(1)] [atyp(1)] [addr...] [port(2)] [CRLF (2)] [payload...]
   atyp (SOCKS5): 1 = IPv4  3 = domain  4 = IPv6 */
function parseTrojanHeader(buf) {
  if (buf.byteLength < 66) return null;
  if (buf[56] !== 0x0d || buf[57] !== 0x0a) return null;
  const passHash = dec.decode(buf.subarray(0, 56)).toLowerCase();
  if (!/^[0-9a-f]{56}$/.test(passHash)) return null;
  const cmd = buf[58];
  const atyp = buf[59];
  const addr = readAddress(buf, 60, atyp, { vless: false });
  if (!addr || buf.byteLength < addr.next + 4) return null;
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const port = v.getUint16(addr.next, false);
  const crlfOff = addr.next + 2;
  const payloadOff = (buf[crlfOff] === 0x0d && buf[crlfOff + 1] === 0x0a) ? crlfOff + 2 : crlfOff;
  return {
    proto: 'trojan',
    passHash,
    cmd,
    port,
    hostname: addr.host,
    payload: buf.subarray(payloadOff),
  };
}

function readAddress(buf, off, atyp, { vless }) {
  const isV4 = atyp === 1;
  const isDom = vless ? atyp === 2 : atyp === 3;
  const isV6 = vless ? atyp === 3 : atyp === 4;
  if (isV4) {
    if (buf.byteLength < off + 4) return null;
    return { host: `${buf[off]}.${buf[off + 1]}.${buf[off + 2]}.${buf[off + 3]}`, next: off + 4 };
  }
  if (isDom) {
    const len = buf[off];
    if (buf.byteLength < off + 1 + len) return null;
    return { host: dec.decode(buf.subarray(off + 1, off + 1 + len)), next: off + 1 + len };
  }
  if (isV6) {
    if (buf.byteLength < off + 16) return null;
    const v = new DataView(buf.buffer, buf.byteOffset + off, 16);
    const parts = [];
    for (let i = 0; i < 8; i++) parts.push(v.getUint16(i * 2, false).toString(16));
    return { host: `[${parts.join(':')}]`, next: off + 16 };
  }
  return null;
}

/* ─────────── early-data از Sec-WebSocket-Protocol ─────────── */
function readEarlyData(request) {
  const hdr = request.headers.get('sec-websocket-protocol') || '';
  if (!hdr) return null;
  const token = hdr.split(',')[0].trim();
  if (!token) return null;
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '==='.slice((b64.length + 3) % 4);
    const bin = atob(pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { bytes: out, echoHeader: null };
  } catch {
    return null;
  }
}

/* ─────────── بررسی کاربر، دستگاه و فعال‌سازی ─────────── */
async function authorizeRequest(env, settings, request, cred) {
  let user = null;
  if (cred.proto === 'vless') {
    if (settings.proto === 'trojan') return { ok: false, reason: 'vless-disabled' };
    user = await findUserByUuid(env, cred.uuid);
  } else {
    if (settings.proto === 'vless') return { ok: false, reason: 'trojan-disabled' };
    await warmPasswordMap(env, settings.trojan_password);
    user = PASS_CACHE.get(cred.passHash) || null;
  }
  if (!user) return { ok: false, reason: 'unknown-user' };

  // فعال‌سازی با اولین اتصال
  if (user.first_connect && !user.activated_at) {
    const days = Number(user.pending_days || settings.default_expiry_days || 30);
    const expires = new Date(Date.now() + days * 864e5).toISOString().slice(0, 19).replace('T', ' ');
    user.activated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    user.expires_at = expires;
    invalidateUser(user.uuid);
  }

  const st = userStatus(user);
  if (st !== 'active') return { ok: false, reason: st, user };

  if (isBlockedHost(cred.hostname, settings, user)) {
    return { ok: false, reason: 'blocked-host', user };
  }

  return { ok: true, user };
}

/* ─────────── هندلر UDP DNS over HTTPS (VLESS cmd=2 / پورت 53) ─────────── */
async function handleUdpDns(ws, cred, dnsUpstream, stat) {
  let vlessHeaderSent = false;
  const upstream = dnsUpstream || 'https://1.1.1.1/dns-query';

  const sendDnsReply = (dnsBytes) => {
    const len = dnsBytes.byteLength;
    const framed = new Uint8Array(2 + len);
    framed[0] = (len >> 8) & 0xff;
    framed[1] = len & 0xff;
    framed.set(dnsBytes, 2);
    if (cred.proto === 'vless' && !vlessHeaderSent) {
      vlessHeaderSent = true;
      const out = new Uint8Array(2 + framed.byteLength);
      out[0] = cred.version;
      out[1] = 0;
      out.set(framed, 2);
      ws.send(out);
      stat.down += out.byteLength;
    } else {
      ws.send(framed);
      stat.down += framed.byteLength;
    }
  };

  const processDnsChunk = async (chunk) => {
    let offset = 0;
    while (offset + 2 <= chunk.byteLength) {
      const len = (chunk[offset] << 8) | chunk[offset + 1];
      offset += 2;
      if (offset + len > chunk.byteLength) break;
      const query = chunk.subarray(offset, offset + len);
      offset += len;
      try {
        const res = await fetch(upstream, {
          method: 'POST',
          headers: {
            'content-type': 'application/dns-message',
            'accept': 'application/dns-message',
          },
          body: query,
        });
        if (res.ok) {
          const buf = new Uint8Array(await res.arrayBuffer());
          sendDnsReply(buf);
        }
      } catch { /* ignore */ }
    }
  };

  if (cred.payload?.byteLength) {
    await processDnsChunk(cred.payload);
  }
  return processDnsChunk;
}

/* ─────────── ساخت لیست کاندیدهای ProxyIP + NAT64 برای فالبک ─────────── */
function buildDialCandidates(request, settings, user, hostname, port) {
  const candidates = [];
  const seen = new Set();
  const add = (h, p, label) => {
    const hostStr = String(h || '').trim();
    const portNum = Number(p) || port || 443;
    if (!hostStr) return;
    const key = `${hostStr}:${portNum}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ hostname: hostStr, port: portNum, label });
  };

  const cfTarget = isCloudflareTarget(hostname);
  // ۱) اگر مقصد آی‌پی خود کلودفلر نیست، اول اتصال مستقیم را امتحان کن
  if (!cfTarget) {
    add(hostname, port, 'direct');
  }

  // ۲) پروکسی‌های اختصاصی کاربر و پنل
  for (const raw of [...safeJsonArray(user?.proxies), ...safeJsonArray(settings?.proxy_ips)]) {
    const parsed = parseProxyEntry(raw, port);
    if (parsed) add(parsed.hostname, parsed.port, 'user-proxy');
  }

  // ۳) NAT64 (اگر مقصد IPv4 است — بسیار سریع و بدون نیاز به سرور واسط)
  for (const pref of NAT64_PREFIXES) {
    const v6 = ipv4ToNat64(hostname, pref);
    if (v6) add(v6, port, 'nat64');
  }

  // ۴) استخر جهانی ProxyIP روی پورت 443
  for (const raw of DEFAULT_PROXY_IPS) {
    const parsed = parseProxyEntry(raw, 443);
    if (parsed) add(parsed.hostname, parsed.port, 'pool-proxy');
  }
  const colo = String(request?.cf?.colo || '').toLowerCase();
  if (colo && /^[a-z]{3}$/.test(colo)) {
    add(`${colo}.proxyip.cmliussss.net`, 443, 'colo-proxy');
  }

  // ۵) اگر مقصد کلودفلر بود ولی هیچ فالبکی جواب نداد، در آخر اتصال مستقیم را هم بگذار
  if (cfTarget) {
    add(hostname, port, 'direct-last');
  }

  return candidates;
}

/* ─────────── فالبک HTTP روی لبه برای مقاصد کلودفلر روی پورت 80 (مثل cp.cloudflare.com/generate_204) ─────────── */
async function tryHttpFetchFallback(ws, cred, chunks, stat, getHeaderSent, setHeaderSent) {
  if (!chunks.length) return false;
  let totalLen = 0;
  for (const c of chunks) totalLen += c.byteLength;
  const full = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) { full.set(c, off); off += c.byteLength; }
  const text = dec.decode(full);
  const m = /^(GET|HEAD|POST|OPTIONS)\s+(\S+)\s+HTTP\/1\.[01]\r?\n/i.exec(text);
  if (!m) return false;
  const method = m[1].toUpperCase();
  const path = m[2];
  const hostMatch = /\r?\nHost:\s*([^\r\n]+)/i.exec(text);
  const host = (hostMatch ? hostMatch[1].trim() : cred.hostname).replace(/:\d+$/, '');

  const sendRaw = (bytes) => {
    stat.down += bytes.byteLength;
    if (cred.proto === 'vless' && !getHeaderSent()) {
      setHeaderSent();
      const combined = new Uint8Array(2 + bytes.byteLength);
      combined[0] = cred.version;
      combined[1] = 0;
      combined.set(bytes, 2);
      ws.send(combined);
    } else {
      ws.send(bytes);
    }
  };

  if (path.startsWith('/generate_204') || path.startsWith('/gen_204')) {
    sendRaw(enc.encode('HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n'));
    return true;
  }

  try {
    const res = await fetch(`http://${host}${path.startsWith('/') ? path : '/' + path}`, {
      method,
      headers: { 'user-agent': 'Mozilla/5.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(4000),
    });
    const bodyBuf = new Uint8Array(await res.arrayBuffer());
    const hdrLines = [`HTTP/1.1 ${res.status} ${res.statusText || 'OK'}`, `Content-Length: ${bodyBuf.byteLength}`, 'Connection: close'];
    const ct = res.headers.get('content-type');
    if (ct) hdrLines.push(`Content-Type: ${ct}`);
    const loc = res.headers.get('location');
    if (loc) hdrLines.push(`Location: ${loc}`);
    const headBytes = enc.encode(hdrLines.join('\r\n') + '\r\n\r\n');
    const out = new Uint8Array(headBytes.byteLength + bodyBuf.byteLength);
    out.set(headBytes, 0);
    out.set(bodyBuf, headBytes.byteLength);
    sendRaw(out);
    return true;
  } catch {
    return false;
  }
}

/* ─────────── هندلر اصلی WebSocket ─────────── */
export async function handleProxy(request, env, ctx, url, settings) {
  // اگر مسیر اختصاصی تنظیم شده و تطابق ندارد، صفحه‌ی پوششی بده
  const cfgPath = (settings.path || '').trim();
  if (cfgPath && cfgPath !== '/' && !url.pathname.startsWith(cfgPath)) {
    return serveDecoy(env, settings);
  }

  const pair = new WebSocketPair();
  const [client, ws] = Object.values(pair);
  ws.accept();

  const early = readEarlyData(request);
  let remote = null;
  let remoteWriter = null;
  let user = null;
  let vlessHeaderSent = false;
  let hasIncomingData = false;
  let udpHandler = null;
  const stat = { up: 0, down: 0, counted: false };
  const initialClientChunks = [];

  const flushStats = async () => {
    if (!user || (stat.up === 0 && stat.down === 0)) return;
    const up = stat.up, down = stat.down;
    stat.up = 0; stat.down = 0;
    const day = new Date().toISOString().slice(0, 10);
    try {
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET up_bytes = up_bytes + ?, down_bytes = down_bytes + ?, last_seen = datetime(\'now\') WHERE username = ?')
          .bind(up, down, user.username),
        env.DB.prepare(
          `INSERT INTO usage_daily(username, day, up_bytes, down_bytes, conns) VALUES(?,?,?,?,0)
           ON CONFLICT(username, day) DO UPDATE SET up_bytes = up_bytes + excluded.up_bytes, down_bytes = down_bytes + excluded.down_bytes`
        ).bind(user.username, day, up, down),
      ]);
    } catch { /* ignore */ }
  };

  const pumpDownstream = async (sock, cred) => {
    const reader = sock.readable.getReader();
    let gotBytes = false;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.byteLength) {
          gotBytes = true;
          hasIncomingData = true;
          stat.down += value.byteLength;
          if (cred.proto === 'vless' && !vlessHeaderSent) {
            vlessHeaderSent = true;
            const combined = new Uint8Array(2 + value.byteLength);
            combined[0] = cred.version;
            combined[1] = 0;
            combined.set(value, 2);
            ws.send(combined);
          } else {
            ws.send(value);
          }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch { /* ignore */ }
    }
    return gotBytes;
  };

  const connectAndRelay = async (cred) => {
    if (cred.port === 80 && isCloudflareTarget(cred.hostname)) {
      const handled = await tryHttpFetchFallback(ws, cred, initialClientChunks, stat, () => vlessHeaderSent, () => { vlessHeaderSent = true; });
      if (handled) {
        try { ws.close(1000, 'normal'); } catch { /* ignore */ }
        return;
      }
    }

    const candidates = buildDialCandidates(request, settings, user, cred.hostname, cred.port);
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      let sock = null;
      try {
        sock = connect({ hostname: cand.hostname, port: cand.port });
        if (sock.opened) {
          const openedOk = await Promise.race([
            sock.opened.then(() => true).catch(() => false),
            new Promise((r) => setTimeout(() => r(false), i === 0 ? 3500 : 2500)),
          ]);
          if (!openedOk) {
            try { sock.close(); } catch { /* ignore */ }
            continue;
          }
        }
        remote = sock;
        remoteWriter = sock.writable.getWriter();

        // ارسال payload اولیه (و هر داده‌ای که کلاینت قبل از برقراری فرستاده)
        for (const chunk of initialClientChunks) {
          if (chunk?.byteLength) await remoteWriter.write(chunk);
        }

        // خواندن از سوکت مقصد؛ اگر بلافاصله با ۰ بایت بسته شد، سراغ کاندید بعدی (ProxyIP / NAT64) برو
        const gotBytes = await pumpDownstream(sock, cred);
        if (gotBytes) {
          try { ws.close(1000, 'normal'); } catch { /* ignore */ }
          return;
        }
        // ۰ بایت دریافت شد → سوکت فعلی را ببند و با ProxyIP/NAT64 بعدی تلاش کن
        try { remoteWriter.releaseLock(); } catch { /* ignore */ }
        try { sock.close(); } catch { /* ignore */ }
        remote = null;
        remoteWriter = null;
      } catch {
        try { remoteWriter?.releaseLock?.(); } catch { /* ignore */ }
        try { sock?.close?.(); } catch { /* ignore */ }
        remote = null;
        remoteWriter = null;
      }
    }

    const handled = await tryHttpFetchFallback(ws, cred, initialClientChunks, stat, () => vlessHeaderSent, () => { vlessHeaderSent = true; });
    if (handled) {
      try { ws.close(1000, 'normal'); } catch { /* ignore */ }
      return;
    }
    try { ws.close(1011, 'connect-failed'); } catch { /* ignore */ }
  };

  const onFirstChunk = async (chunk) => {
    stat.up += chunk.byteLength;
    const cred = parseVlessHeader(chunk) || parseTrojanHeader(chunk);
    if (!cred || (cred.cmd !== 1 && cred.cmd !== 2 && cred.cmd !== 3)) {
      try { ws.close(1008, 'bad-header'); } catch { /* ignore */ }
      return;
    }
    const auth = await authorizeRequest(env, settings, request, cred);
    if (!auth.ok) {
      try { ws.close(1008, auth.reason); } catch { /* ignore */ }
      return;
    }
    user = auth.user;

    // ثبت اتصال در پس‌زمینه تا هندشیک WebSocket کند نشود
    if (!stat.counted) {
      stat.counted = true;
      ctx.waitUntil(registerConnection(env, request, user).catch(() => {}));
    }

    // اگر درخواست UDP DNS (cmd=2 یا پورت 53 روی UDP) بود، از طریق DoH پاسخ بده
    if (cred.cmd === 2 || (cred.port === 53 && cred.proto === 'vless' && cred.cmd !== 1)) {
      udpHandler = await handleUdpDns(ws, cred, settings.dns_upstream, stat);
      return;
    }

    if (cred.payload?.byteLength) {
      initialClientChunks.push(cred.payload);
    }

    ctx.waitUntil(
      connectAndRelay(cred).finally(() => flushStats())
    );
  };

  let firstDone = false;
  let firstPromise = null;

  if (early?.bytes?.byteLength) {
    firstDone = true;
    firstPromise = onFirstChunk(early.bytes);
  }

  ws.addEventListener('message', async (ev) => {
    try {
      const buf = ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data)
        : typeof ev.data === 'string' ? enc.encode(ev.data) : new Uint8Array(ev.data);
      if (!firstDone) {
        firstDone = true;
        firstPromise = onFirstChunk(buf);
        return;
      }
      if (firstPromise) await firstPromise;
      stat.up += buf.byteLength;
      if (udpHandler) {
        await udpHandler(buf);
        return;
      }
      if (!hasIncomingData && initialClientChunks.length < 8) {
        initialClientChunks.push(buf);
      }
      if (remoteWriter) {
        await remoteWriter.write(buf);
      }
    } catch {
      try { ws.close(1011, 'write-failed'); } catch { /* ignore */ }
    }
  });

  const cleanup = () => {
    try { remoteWriter?.close?.(); } catch { /* ignore */ }
    try { remote?.close?.(); } catch { /* ignore */ }
    ctx.waitUntil(flushStats());
  };
  ws.addEventListener('close', cleanup);
  ws.addEventListener('error', cleanup);

  const respHeaders = {};
  if (early?.echoHeader) respHeaders['sec-websocket-protocol'] = early.echoHeader;
  return new Response(null, { status: 101, webSocket: client, headers: respHeaders });
}

async function registerConnection(env, request, user) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  const ua = (request.headers.get('user-agent') || '').slice(0, 80);
  const dev = await sha256Hex(`${ua}|${ip.includes(':') ? ip.split(':').slice(0, 3).join(':') : ip.split('.').slice(0, 3).join('.')}`);
  const day = new Date().toISOString().slice(0, 10);
  const stmts = [
    env.DB.prepare(
      `UPDATE users SET request_count = request_count + 1, last_seen = datetime('now'), last_ip = ?,
       activated_at = COALESCE(activated_at, ?), expires_at = COALESCE(expires_at, ?)
       WHERE username = ?`
    ).bind(ip, user.activated_at || null, user.expires_at || null, user.username),
    env.DB.prepare(
      `INSERT INTO usage_daily(username, day, up_bytes, down_bytes, conns) VALUES(?,?,0,0,1)
       ON CONFLICT(username, day) DO UPDATE SET conns = conns + 1`
    ).bind(user.username, day),
    env.DB.prepare(
      `INSERT INTO devices(username, device, hits) VALUES(?,?,1)
       ON CONFLICT(username, device) DO UPDATE SET last_seen = datetime('now'), hits = hits + 1`
    ).bind(user.username, dev),
  ];
  await env.DB.batch(stmts);
}

/* ─────────── صفحه‌ی پوششی (decoy) برای بازدیدکنندگان عادی ─────────── */
export async function serveDecoy(env, settings) {
  const url = (settings.decoy_url || '').trim();
  if (url && /^https?:\/\//i.test(url)) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, cf: { cacheTtl: 600 } });
      return new Response(r.body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'text/html; charset=utf-8' } });
    } catch { /* صفحه‌ی استاتیک پیش‌فرض */ }
  }
  return new Response(DEFAULT_DECOY_HTML(settings.panel_name || 'Edge Relay'), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=600' },
  });
}

const DEFAULT_DECOY_HTML = (title) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Edge Network</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07090e;color:#cfd8e6;font:14px/1.6 system-ui,sans-serif}
.box{max-width:440px;padding:28px;border:1px solid #182030;border-radius:16px;background:#0b0f17}
h1{font-size:16px;margin:0 0 8px;color:#fff}.dot{display:inline-block;width:8px;height:8px;border-radius:99px;background:#34d399;margin-right:8px}
p{margin:6px 0;color:#7e8ca3;font-size:13px}code{color:#9cc2ff}</style></head>
<body><div class="box"><h1><span class="dot"></span>${title} — Edge Node Operational</h1>
<p>All anycast edge PoPs are online and routing traffic normally.</p>
<p>Protocol: <code>HTTP/2 · HTTP/3 · QUIC · TLS 1.3</code></p></div></body></html>`;
