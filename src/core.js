/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/core.js
   هسته‌ی تونل WebSocket برای VLESS و Trojan روی Cloudflare Workers
   - پشتیبانی کامل از TLS Fragmentation ایرانسل و مخابرات با صف سریال‌شده‌ی بدون ریزش
     (حفظ تا ۲۵۶ قطعه / ۶۴ کیلوبایت ClientHello بدون تداخل و بدون دوباره‌نویسی)
   - پشتیبانی از SOCKS5 و HTTP CONNECT (از مخزن VIP اومنی) برای باز کردن Google Gemini و هوش مصنوعی
   - کش هوشمند مقاصد غیرکلودفلر (NON_CF_HOST_CACHE) برای حذف کامل پرش پینگ فرانسه و سایر کشورها
   - پشتیبانی از حالت اتصال مستقیم (Direct Mode) و تک‌لوکیشن (?cc=DE, ?cc=US, ?mode=direct)
   ══════════════════════════════════════════════════════════════════════════ */
import { connect } from 'cloudflare:sockets';
import { findCountry, GEMINI_VIP_PROXIES, COUNTRY_VIP_PROXIES } from './countries.js';

const dec = new TextDecoder();
const enc = new TextEncoder();

/* ─────────── استخر ProxyIP و پیشوندهای NAT64 (الگوی ZEUS v2.2.5 / BPB / Omni) ─────────── */
export const DEFAULT_PROXY_IPS = [
  '103.228.170.234:443',
  '103.137.248.227:443',
  '103.13.208.242:443',
  '163.172.189.205:443',
  '135.181.84.31:443',
];

export const NAT64_PREFIXES = [
  '2602:fc59:b0:64::',
  '2602:fc59:11:64::',
  '2a02:898:146:64::',
];

/** کش دامنه‌های مدیا/استریم که پشت کلودفلر نیستند و اتصال مستقیم به آن‌ها سریع‌ترین پینگ را می‌دهد.
    مهم: دامنه‌های گوگل (google.com / googleapis.com) نباید در این لیست باشند تا ترافیک اپ اندروید Gemini
    همیشه از پروکسی IPv4 آمریکا عبور کند و هرگز خطای ریجن (This country isn't supported) ندهد! */
const NON_CF_HOST_CACHE = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'i.ytimg.com',
  'yt3.ggpht.com',
  'instagram.com',
  'www.instagram.com',
  'i.instagram.com',
  'graph.instagram.com',
  'telegram.org',
  'core.telegram.org',
  'web.telegram.org',
  't.me',
]);

/** دامنه‌های Google / Gemini (وب + اپلیکیشن اندروید Google / Gemini) و سرویس‌های هوش مصنوعی */
const GEMINI_AI_SUFFIXES = [
  'gemini.google.com',
  'bard.google.com',
  'aistudio.google.com',
  'makersuite.google.com',
  'generativelanguage.googleapis.com',
  'proactivebackend-pa.googleapis.com',
  'robin-pa.googleapis.com',
  'assistant-s3-pa.googleapis.com',
  'alkalimakersuite-pa.googleapis.com',
  'alkalimakersuite-pa.clients6.google.com',
  'aisandbox-pa.googleapis.com',
  'oauthaccountmanager.googleapis.com',
  'optimizationguide-pa.googleapis.com',
  'notebooklm.google.com',
  'notebooklm.google',
  'labs.google',
  'jules.google.com',
  'opal.google',
  'deepmind.google',
  'ai.google',
  'search.app',
  'google.com',
  'googleapis.com',
  'gstatic.com',
  '1e100.net',
  'chatgpt.com',
  'openai.com',
  'oaistatic.com',
  'oaiusercontent.com',
  'claude.ai',
  'anthropic.com',
  'copilot.microsoft.com',
  'perplexity.ai',
];

function isYoutubeMediaHost(host) {
  const h = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  if (!h) return false;
  return (
    h === 'youtube.com' ||
    h.endsWith('.youtube.com') ||
    h === 'youtu.be' ||
    h.endsWith('.googlevideo.com') ||
    h.endsWith('.ytimg.com') ||
    h.endsWith('.ggpht.com')
  );
}

export function isGeminiOrAiHost(host) {
  const h = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  if (!h || isYoutubeMediaHost(h)) return false;
  return GEMINI_AI_SUFFIXES.some((suf) => h === suf || h.endsWith('.' + suf));
}

/** تشخیص آی‌پی‌های مستقیم گوگل (IPv4 و IPv6) وقتی اپلیکیشن اندروید Gemini آی‌پی از پیش Resolve شده می‌فرستد */
export function isGoogleIpLiteral(host) {
  const h = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return false;
  if (h.includes(':')) {
    return (
      h.startsWith('2a00:1450:') ||
      h.startsWith('2607:f8b0:') ||
      h.startsWith('2001:4860:')
    );
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    (a === 142 && (b === 250 || b === 251)) ||
    (a === 172 && (b === 217 || b === 253)) ||
    (a === 216 && (b === 58 || b === 239)) ||
    (a === 74 && b === 125) ||
    (a === 64 && b === 233) ||
    (a === 108 && b === 177) ||
    (a === 173 && b === 194) ||
    (a === 209 && b === 85)
  );
}

/** استخراج نام دامنه (SNI) از هدر TLS ClientHello (حتی در حالت تکه‌تکه شدن با TLS Fragment) */
export function extractTlsSni(chunks) {
  if (!chunks || !chunks.length) return null;
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  if (total < 43) return null;
  const buf = new Uint8Array(Math.min(total, 2048));
  let off = 0;
  for (const c of chunks) {
    const n = Math.min(c.byteLength, buf.byteLength - off);
    if (n <= 0) break;
    buf.set(c.subarray(0, n), off);
    off += n;
  }
  if (buf[0] !== 0x16 || buf[1] !== 0x03 || buf[5] !== 0x01) return null;
  let p = 43;
  if (p >= buf.byteLength) return null;
  const sessIdLen = buf[p];
  p += 1 + sessIdLen;
  if (p + 2 > buf.byteLength) return null;
  const cipherLen = (buf[p] << 8) | buf[p + 1];
  p += 2 + cipherLen;
  if (p + 1 > buf.byteLength) return null;
  const compLen = buf[p];
  p += 1 + compLen;
  if (p + 2 > buf.byteLength) return null;
  const extTotalLen = (buf[p] << 8) | buf[p + 1];
  p += 2;
  const end = Math.min(buf.byteLength, p + extTotalLen);
  while (p + 4 <= end) {
    const extType = (buf[p] << 8) | buf[p + 1];
    const extLen = (buf[p + 2] << 8) | buf[p + 3];
    p += 4;
    if (p + extLen > end) break;
    if (extType === 0x0000 && extLen >= 5) {
      let q = p + 2;
      const nameType = buf[q];
      const nameLen = (buf[q + 1] << 8) | buf[q + 2];
      q += 3;
      if (nameType === 0 && q + nameLen <= p + extLen) {
        return dec.decode(buf.subarray(q, q + nameLen)).trim().toLowerCase();
      }
    }
    p += extLen;
  }
  return null;
}

function isKnownNonCfHost(host) {
  const h = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  if (!h) return false;
  if (NON_CF_HOST_CACHE.has(h) || isYoutubeMediaHost(h)) return true;
  if (
    h.endsWith('.cdninstagram.com') ||
    h.endsWith('.fbcdn.net') ||
    h.endsWith('.whatsapp.net') ||
    h.endsWith('.whatsapp.com')
  ) {
    return true;
  }
  return false;
}

/* ─────────── کش DNS-over-HTTPS برای تبدیل دامنه‌های حساس گوگل به IPv4 خالص ───────────
   کلودفلر ورکرز در اتصال مستقیم به google.com از IPv6 رنج 2a05:f480:... استفاده می‌کند که
   توسط گوگل ایران تشخیص داده می‌شود. با تبدیل به IPv4، اتصال مستقیم از IPv4 کلودفلر انجام می‌شود. */
const DOH_IPV4_CACHE = new Map(); // host -> { ip, exp }

async function resolveIPv4DoH(hostname) {
  const h = String(hostname || '').trim().toLowerCase();
  if (!h || /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':')) return null;
  const cached = DOH_IPV4_CACHE.get(h);
  if (cached && cached.exp > Date.now()) return cached.ip;
  try {
    const res = await fetch(`https://1.1.1.1/dns-query?name=${encodeURIComponent(h)}&type=A`, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(1800),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const ans = (data?.Answer || []).find((a) => a.type === 1 && /^\d{1,3}(\.\d{1,3}){3}$/.test(a.data));
    if (ans?.data) {
      DOH_IPV4_CACHE.set(h, { ip: ans.data, exp: Date.now() + 300_000 });
      return ans.data;
    }
  } catch { /* ignore */ }
  return null;
}

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
  // پشتیبانی از socks5://user:pass@host:port و http://user:pass@host:port
  const schemeMatch = /^(socks5|http):\/\/(?:([^:@]+):([^@]+)@)?([^:/]+)(?::(\d+))?$/i.exec(s);
  if (schemeMatch) {
    return {
      type: schemeMatch[1].toLowerCase(),
      username: schemeMatch[2] ? decodeURIComponent(schemeMatch[2]) : '',
      password: schemeMatch[3] ? decodeURIComponent(schemeMatch[3]) : '',
      hostname: schemeMatch[4].trim(),
      port: Number(schemeMatch[5]) || (schemeMatch[1].toLowerCase() === 'socks5' ? 1080 : 8080),
      raw: s,
    };
  }
  if (s.startsWith('[')) {
    const idx = s.indexOf(']');
    if (idx < 0) return null;
    const host = s.slice(0, idx + 1);
    const rest = s.slice(idx + 1);
    const port = rest.startsWith(':') ? Number(rest.slice(1)) || defaultPort : defaultPort;
    return { type: 'proxyip', hostname: host, port };
  }
  const lastColon = s.lastIndexOf(':');
  if (lastColon > 0 && !s.slice(0, lastColon).includes(':')) {
    const host = s.slice(0, lastColon).trim();
    const port = Number(s.slice(lastColon + 1)) || defaultPort;
    return { type: 'proxyip', hostname: host, port };
  }
  return { type: 'proxyip', hostname: s, port: defaultPort };
}

/* ─────────── شماره‌گیر SOCKS5 و HTTP CONNECT (مبتنی بر ZEUS v2.2.5) ─────────── */
async function connectSocks5(spec, destHost, destPort, timeoutMs = 2800) {
  const sock = connect({ hostname: spec.hostname, port: spec.port });
  let timer = null;
  const withTimeout = (p) => Promise.race([
    p,
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('socks5-timeout')), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));

  try {
    if (sock.opened) await withTimeout(sock.opened);
    const writer = sock.writable.getWriter();
    const reader = sock.readable.getReader();
    try {
      const hasAuth = Boolean(spec.username);
      await writer.write(hasAuth ? new Uint8Array([0x05, 0x02, 0x00, 0x02]) : new Uint8Array([0x05, 0x01, 0x00]));
      const { value: g } = await withTimeout(reader.read());
      if (!g || g.byteLength < 2 || g[0] !== 0x05) throw new Error('socks5-bad-greeting');
      if (g[1] === 0x02) {
        const uBytes = enc.encode(spec.username || '');
        const pBytes = enc.encode(spec.password || '');
        const authReq = new Uint8Array(3 + uBytes.length + pBytes.length);
        authReq[0] = 0x01;
        authReq[1] = uBytes.length;
        authReq.set(uBytes, 2);
        authReq[2 + uBytes.length] = pBytes.length;
        authReq.set(pBytes, 3 + uBytes.length);
        await writer.write(authReq);
        const { value: ar } = await withTimeout(reader.read());
        if (!ar || ar.byteLength < 2 || ar[1] !== 0x00) throw new Error('socks5-auth-failed');
      } else if (g[1] !== 0x00) {
        throw new Error('socks5-unsupported-auth');
      }

      const cleanDest = String(destHost || '').replace(/^\[|\]$/g, '');
      const ip4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(cleanDest);
      let req;
      if (ip4) {
        req = new Uint8Array([0x05, 0x01, 0x00, 0x01, Number(ip4[1]), Number(ip4[2]), Number(ip4[3]), Number(ip4[4]), (destPort >> 8) & 0xff, destPort & 0xff]);
      } else {
        const dBytes = enc.encode(cleanDest);
        req = new Uint8Array(5 + dBytes.length + 2);
        req[0] = 0x05; req[1] = 0x01; req[2] = 0x00; req[3] = 0x03; req[4] = dBytes.length;
        req.set(dBytes, 5);
        req[5 + dBytes.length] = (destPort >> 8) & 0xff;
        req[6 + dBytes.length] = destPort & 0xff;
      }
      await writer.write(req);
      const { value: rep } = await withTimeout(reader.read());
      if (!rep || rep.byteLength < 4 || rep[1] !== 0x00) throw new Error('socks5-connect-rejected');
    } finally {
      try { writer.releaseLock(); } catch { /* ignore */ }
      try { reader.releaseLock(); } catch { /* ignore */ }
    }
    return sock;
  } catch (e) {
    try { sock.close(); } catch { /* ignore */ }
    throw e;
  }
}

async function connectHttpTunnel(spec, destHost, destPort, timeoutMs = 2800) {
  const sock = connect({ hostname: spec.hostname, port: spec.port });
  let timer = null;
  const withTimeout = (p) => Promise.race([
    p,
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('http-proxy-timeout')), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));

  try {
    if (sock.opened) await withTimeout(sock.opened);
    const writer = sock.writable.getWriter();
    const reader = sock.readable.getReader();
    try {
      const target = `${destHost}:${destPort}`;
      const lines = [
        `CONNECT ${target} HTTP/1.1`,
        `Host: ${target}`,
        'Proxy-Connection: keep-alive',
      ];
      if (spec.username) {
        const b64 = btoa(`${spec.username}:${spec.password || ''}`);
        lines.push(`Proxy-Authorization: Basic ${b64}`);
      }
      lines.push('', '');
      await writer.write(enc.encode(lines.join('\r\n')));
      const { value } = await withTimeout(reader.read());
      if (!value || !value.byteLength) throw new Error('http-proxy-empty');
      const text = dec.decode(value);
      if (!/^HTTP\/1\.[01]\s+200\b/i.test(text)) throw new Error('http-proxy-rejected');
    } finally {
      try { writer.releaseLock(); } catch { /* ignore */ }
      try { reader.releaseLock(); } catch { /* ignore */ }
    }
    return sock;
  } catch (e) {
    try { sock.close(); } catch { /* ignore */ }
    throw e;
  }
}

/* ─────────── کش کاربران در حافظه (برای سرعت هندشیک) ─────────── */
const USER_CACHE = new Map();
const PASS_CACHE = new Map();
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

function parseDnsQuestion(q) {
  if (!q || q.byteLength < 17) return null;
  const qdcount = (q[4] << 8) | q[5];
  if (qdcount < 1) return null;
  let off = 12;
  const labels = [];
  while (off < q.byteLength) {
    const len = q[off++];
    if (len === 0) break;
    if ((len & 0xc0) !== 0 || off + len > q.byteLength) return null;
    labels.push(dec.decode(q.subarray(off, off + len)));
    off += len;
  }
  if (off + 4 > q.byteLength) return null;
  const qtype = (q[off] << 8) | q[off + 1];
  const qEnd = off + 4;
  const emptyReply = new Uint8Array(qEnd);
  emptyReply.set(q.subarray(0, qEnd));
  emptyReply[2] = (q[2] & 0x79) | 0x80; // QR=1, Opcode=0, RD=copied
  emptyReply[3] = 0x80; // RA=1, RCODE=0 (NOERROR)
  emptyReply[4] = 0x00; emptyReply[5] = 0x01; // QDCOUNT=1
  emptyReply[6] = 0x00; emptyReply[7] = 0x00; // ANCOUNT=0
  emptyReply[8] = 0x00; emptyReply[9] = 0x00; // NSCOUNT=0
  emptyReply[10] = 0x00; emptyReply[11] = 0x00; // ARCOUNT=0
  return { name: labels.join('.').toLowerCase(), qtype, emptyReply };
}

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
        // حذف فوری پاسخ‌های AAAA (IPv6 - نوع ۲۸) و HTTPS/SVCB (نوع ۶۵) داخل تانل
        // تا اپلیکیشن اندروید Google Gemini و کلاینت‌های v2rayNG/PattNG همیشه از IPv4 خالص استفاده کنند
        const parsedQ = parseDnsQuestion(query);
        if (parsedQ && (parsedQ.qtype === 28 || parsedQ.qtype === 65)) {
          sendDnsReply(parsedQ.emptyReply);
          continue;
        }
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

/* ─────────── ساخت لیست کاندیدهای اتصال خروجی (Direct / SOCKS5 / HTTP / ProxyIP / NAT64) ─────────── */
async function buildDialCandidates(request, settings, user, hostname, port, reqUrl, sniHost = null) {
  const candidates = [];
  const seen = new Set();

  const addRaw = (candObj) => {
    const key = `${candObj.type}:${candObj.hostname}:${candObj.port}:${candObj.username || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candObj);
  };

  const addEntry = (rawEntry, defaultPort, label) => {
    const parsed = parseProxyEntry(rawEntry, defaultPort);
    if (!parsed || !parsed.hostname) return;
    // نادیده گرفتن دامنه‌های مرده قدیمی که در دیتابیس ذخیره شده باشند
    if (parsed.hostname.includes('cmliussss.net') || parsed.hostname === 'bpb.yousef.isegaro.com' || parsed.hostname === 'di.nscl.ir') {
      return;
    }
    addRaw({ ...parsed, label });
  };

  const effectiveHost = sniHost || hostname;
  const cfTarget = isCloudflareTarget(hostname) || isCloudflareTarget(effectiveHost);
  const ytMedia = isYoutubeMediaHost(effectiveHost) || isYoutubeMediaHost(hostname);
  const geminiAi = !ytMedia && (
    isGeminiOrAiHost(effectiveHost) ||
    isGeminiOrAiHost(hostname) ||
    isGoogleIpLiteral(hostname)
  );
  const nonCfKnown = isKnownNonCfHost(effectiveHost) || isKnownNonCfHost(hostname);

  const reqMode = (reqUrl?.searchParams?.get('mode') || '').trim().toLowerCase();
  const reqProxy = reqUrl?.searchParams?.get('proxyip') || '';
  const rawCc = (reqUrl?.searchParams?.get('cc') || settings?.selected_country || '').trim().toUpperCase();
  const isDirectMode = reqMode === 'direct' || rawCc === 'DIRECT' || rawCc === 'NONE';
  const selCountry = (!isDirectMode && rawCc) ? findCountry(rawCc) : null;

  // ۱) اگر مقصد Google / Gemini (وب یا اپلیکیشن اندروید Google / Gemini) یا سرویس‌های AI است:
  // همیشه از پروکسی‌های SOCKS5/HTTP تاییدشده آمریکا/کانادا/اروپا (IPv4 خالص) عبور بده
  // و هرگز به اتصال مستقیم ورکر (که آی‌پی IPv6 ایران‌دار کلودفلر را لو می‌دهد) فالبک نزن!
  if (geminiAi) {
    const countryVips = selCountry?.vipProxies || COUNTRY_VIP_PROXIES[selCountry?.cc] || [];
    for (const v of [...GEMINI_VIP_PROXIES, ...countryVips]) {
      addEntry(v, 1080, 'gemini-vip');
    }
    return candidates;
  }

  // ۲) اگر حالت «اتصال مستقیم 🌐 بدون پروکسی خروجی» انتخاب شده و مقصد کلودفلر نیست:
  // مستقیماً به مقصد وصل شو (کم‌ترین پینگ و بالاترین سرعت دانلود روی اینستاگرام، یوتیوب و تلگرام)
  if (isDirectMode && !cfTarget) {
    addRaw({ type: 'direct', hostname, port, label: 'direct' });
    for (const raw of DEFAULT_PROXY_IPS) addEntry(raw, 443, 'pool-proxy');
    return candidates;
  }

  // ۳) جمع‌آوری پروکسی‌های کشور انتخابی و پروکسی‌های اختصاصی
  const countryProxies = [
    ...(reqProxy ? reqProxy.split(/[\s,]+/) : []),
    ...(selCountry?.proxies || []),
    ...safeJsonArray(user?.proxies),
    ...(!isDirectMode ? safeJsonArray(settings?.proxy_ips) : []),
  ].filter(Boolean);

  // ۴) سایت‌های بررسی آی‌پی و تست اتصال کلاینت‌ها (PattNG / v2rayNG):
  // اگر کاربر لوکیشن آمریکا (US) یا کشور دارای VIP را انتخاب کرده، ابتدا از پروکسی IPv4 خالص عبور بده
  const hLow = String(effectiveHost || hostname || '').trim().toLowerCase();
  const isIpCheck = (
    hLow === 'api.ipify.org' ||
    hLow === 'ipinfo.io' ||
    hLow === 'ifconfig.me' ||
    hLow === 'icanhazip.com' ||
    hLow === 'ident.me' ||
    hLow === 'ip-api.com' ||
    hLow === 'whoer.net' ||
    hLow === 'ipleak.net' ||
    hLow === 'myip.com' ||
    hLow === 'checkip.amazonaws.com' ||
    (selCountry?.cc === 'US' && cfTarget)
  );
  if (isIpCheck && selCountry) {
    const countryVips = selCountry.vipProxies || COUNTRY_VIP_PROXIES[selCountry.cc] || [];
    for (const v of countryVips.slice(0, 2)) {
      addEntry(v, 1080, 'country-vip');
    }
    for (const raw of countryProxies.slice(0, 2)) {
      addEntry(raw, 443, 'country-proxy');
    }
  }

  // ۵) اگر مقصد در لیست دامنه‌های مدیا/استریم غیرکلودفلر است (مثل instagram.com، youtube.com، telegram.org)،
  // مستقیماً بدون تاخیر وصل شو
  if (nonCfKnown && !cfTarget) {
    addRaw({ type: 'direct', hostname, port, label: 'direct' });
    return candidates;
  }

  // ۶) برای مقاصد غیرکلودفلر، ابتدا اتصال مستقیم (Direct) با پینگ ۲-۴ میلی‌ثانیه برقرار می‌شود
  // و اگر سایت مقصد روی CDN کلودفلر باشد (خطای 1042 در اتصال مستقیم)، بلافاصله به ProxyIP کشور انتخابی فالبک می‌زند!
  if (!cfTarget) {
    addRaw({ type: 'direct', hostname, port, label: 'direct' });
  }

  // ۷) سرورهای خروجی کشور انتخابی (مخصوص سایت‌های پشت کلودفلر و فالبک فوری)
  if (countryProxies.length) {
    for (const raw of countryProxies.slice(0, 2)) {
      addEntry(raw, port === 443 || cfTarget ? 443 : port, 'country-proxy');
    }
  }

  // ۸) NAT64 (اگر مقصد IPv4 است)
  for (const pref of NAT64_PREFIXES) {
    const v6 = ipv4ToNat64(hostname, pref);
    if (v6) addRaw({ type: 'direct', hostname: v6, port, label: 'nat64' });
  }

  // ۹) استخر جهانی ProxyIP روی پورت 443 (مخصوص مقاصد کلودفلر)
  for (const raw of DEFAULT_PROXY_IPS) {
    addEntry(raw, 443, 'pool-proxy');
  }

  if (cfTarget) {
    addRaw({ type: 'direct', hostname, port, label: 'direct-last' });
  }

  return candidates;
}

/* ─────────── فالبک HTTP روی لبه برای مقاصد کلودفلر روی پورت 80 ─────────── */
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

  /* ─────────── صف سریال‌شده‌ی بدون ریزش برای TLS Fragmentation ایرانسل و مخابرات ───────────
     وقتی کلاینت v2rayNG/MahsaNG/Hiddify قابلیت TLS Fragment را روشن می‌کند (مثلاً قطعات ۱۰ تا ۲۰ بایتی)،
     یک پکت ClientHello به حدود ۳۵ فریم WebSocket شکسته می‌شود.
     نگهداری تا ۲۵۶ قطعه (یا ۶۴ کیلوبایت) و نوشتن ترتیبی با اشاره‌گر writtenCount تضمین می‌کند
     که هیچ بایتی گم یا تکرار نشود و در صورت فالبک به کاندید بعدی، کل ClientHello از بایت ۰ ارسال گردد! */
  const initialClientChunks = [];
  let initialClientBytes = 0;
  let writtenCount = 0;
  let writeChain = Promise.resolve();

  const flushUpstream = () => {
    writeChain = writeChain.then(async () => {
      while (remoteWriter && writtenCount < initialClientChunks.length) {
        const w = remoteWriter;
        const idx = writtenCount++;
        const chunk = initialClientChunks[idx];
        if (chunk?.byteLength) {
          await w.write(chunk);
        }
      }
    }).catch(() => {});
    return writeChain;
  };

  const enqueueClientChunk = async (chunk) => {
    if (!chunk?.byteLength) return;
    if (!hasIncomingData && initialClientChunks.length < 256 && initialClientBytes < 65536) {
      initialClientChunks.push(chunk);
      initialClientBytes += chunk.byteLength;
      await flushUpstream();
    } else if (remoteWriter) {
      writeChain = writeChain.then(async () => {
        if (remoteWriter) await remoteWriter.write(chunk);
      }).catch(() => {});
      await writeChain;
    }
  };

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

  const pumpDownstream = async (sock, cred, cand) => {
    const reader = sock.readable.getReader();
    let gotBytes = false;
    let tlsAlert = false;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.byteLength) {
          // اگر کاندید فعلی ProxyIP است و کلاینت TLS ClientHello (0x16) فرستاده
          // ولی سرور ProxyIP با TLS Alert (0x15 = عدم تطابق دامنه غیرکلودفلر) پاسخ داد:
          if (!gotBytes && cand?.type === 'proxyip' && cred.port === 443 && initialClientChunks[0]?.[0] === 0x16 && value[0] === 0x15) {
            tlsAlert = true;
            if (cred.hostname && !isCloudflareTarget(cred.hostname)) {
              NON_CF_HOST_CACHE.add(cred.hostname.toLowerCase());
            }
            return { gotBytes: false, tlsAlert: true };
          }
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
    return { gotBytes, tlsAlert };
  };

  const connectAndRelay = async (cred) => {
    if (cred.port === 80 && isCloudflareTarget(cred.hostname)) {
      const handled = await tryHttpFetchFallback(ws, cred, initialClientChunks, stat, () => vlessHeaderSent, () => { vlessHeaderSent = true; });
      if (handled) {
        try { ws.close(1000, 'normal'); } catch { /* ignore */ }
        return;
      }
    }

    // اگر مقصد روی پورت ۴۴۳ یک آی‌پی مستقیم است (IPv4 یا IPv6)، تا ۳۶ میلی‌ثانیه صبر کن تا قطعات TLS Fragment برسند
    // و نام دامنه واقعی (SNI مانند gemini.google.com یا proactivebackend-pa.googleapis.com) استخراج شود
    let sniHost = extractTlsSni(initialClientChunks);
    const isIpTarget = /^\d{1,3}(\.\d{1,3}){3}$/.test(cred.hostname) || cred.hostname.includes(':');
    if (!sniHost && cred.port === 443 && isIpTarget) {
      for (let w = 0; w < 3 && !sniHost; w++) {
        await new Promise((r) => setTimeout(r, 12));
        sniHost = extractTlsSni(initialClientChunks);
      }
    }

    const candidates = await buildDialCandidates(request, settings, user, cred.hostname, cred.port, url, sniHost);
    let skipProxyIp = false;
    const dialHost = (cred.hostname.includes(':') && sniHost)
      ? sniHost
      : (sniHost && isGoogleIpLiteral(cred.hostname) ? sniHost : cred.hostname);
    const finalDialHost = dialHost.includes(':') && isGoogleIpLiteral(dialHost) ? 'www.google.com' : dialHost;

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      if (skipProxyIp && cand.type === 'proxyip' && cand.label === 'country-proxy') {
        continue;
      }
      let sock = null;
      try {
        if (cand.type === 'socks5') {
          sock = await connectSocks5(cand, finalDialHost, cred.port, 2800);
        } else if (cand.type === 'http') {
          sock = await connectHttpTunnel(cand, finalDialHost, cred.port, 2800);
        } else {
          sock = connect({ hostname: cand.hostname, port: cand.port });
          if (sock.opened) {
            const openedOk = await Promise.race([
              sock.opened.then(() => true).catch(() => false),
              new Promise((r) => setTimeout(() => r(false), i === 0 ? 2500 : 2000)),
            ]);
            if (!openedOk) {
              try { sock.close(); } catch { /* ignore */ }
              continue;
            }
          }
        }

        // بازنشانی اشاره‌گر صف ارسال برای سوکت جدید و نوشتن تمام قطعات انباشته‌شده از بایت صفر
        writtenCount = 0;
        remote = sock;
        remoteWriter = sock.writable.getWriter();
        await flushUpstream();

        const { gotBytes, tlsAlert } = await pumpDownstream(sock, cred, cand);
        if (gotBytes) {
          try { ws.close(1000, 'normal'); } catch { /* ignore */ }
          return;
        }
        // اگر ProxyIP با TLS Alert 0x15 پاسخ داد، بقیه ProxyIPهای کشور را رد کن و مستقیم وصل شو!
        if (tlsAlert) {
          skipProxyIp = true;
        }
        remote = null;
        const oldWriter = remoteWriter;
        remoteWriter = null;
        try { oldWriter?.releaseLock?.(); } catch { /* ignore */ }
        try { sock.close(); } catch { /* ignore */ }
      } catch {
        remote = null;
        const oldWriter = remoteWriter;
        remoteWriter = null;
        try { oldWriter?.releaseLock?.(); } catch { /* ignore */ }
        try { sock?.close?.(); } catch { /* ignore */ }
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

    if (!stat.counted) {
      stat.counted = true;
      ctx.waitUntil(registerConnection(env, request, user).catch(() => {}));
    }

    const isUdp = (cred.proto === 'vless' && cred.cmd === 2) || (cred.proto === 'trojan' && cred.cmd === 3);
    if (isUdp) {
      if (cred.port === 53) {
        udpHandler = await handleUdpDns(ws, cred, settings.dns_upstream, stat);
        return;
      }
      // مطابق ZEUS v2.2.5 (حل مشکل فریز شدن ریلز اینستاگرام و تماس تلگرام):
      // بسته‌های UDP روی پورت 443 (QUIC) را بلافاصله با هدر پاسخ بسته و قطع کن تا کلاینت بدون مکث به TCP/TLS سوییچ کند.
      if (cred.proto === 'vless' && !vlessHeaderSent) {
        vlessHeaderSent = true;
        try { ws.send(new Uint8Array([cred.version, 0])); } catch { /* ignore */ }
      }
      setTimeout(() => {
        try { ws.close(1000, 'quic-fallback'); } catch { /* ignore */ }
      }, 80);
      return;
    }

    if (cred.payload?.byteLength) {
      initialClientChunks.push(cred.payload);
      initialClientBytes += cred.payload.byteLength;
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
      await enqueueClientChunk(buf);
    } catch {
      try { ws.close(1011, 'write-failed'); } catch { /* ignore */ }
    }
  });

  const cleanup = () => {
    const w = remoteWriter;
    remoteWriter = null;
    try { w?.close?.(); } catch { /* ignore */ }
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
