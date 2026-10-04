/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/scan.js
   اسکنر واقعی آی‌پی تمیز (QoS IPv4 + IPv6 + سایت‌های تمیز جهانی + دامنه‌های .ir) + تست واقعی سرورهای خروجی کشورها
   ══════════════════════════════════════════════════════════════════════════ */
import { connect } from 'cloudflare:sockets';
import {
  WORLD_COUNTRIES,
  DEFAULT_ECH_CONFIG,
  COUNTRY_BY_CC,
  findCountry,
  VERIFIED_COUNTRIES,
  PRIMARY_LOCATIONS,
  OMNI_HYBRID_POOL,
  OMNI_QOS_V4,
  OMNI_CLEAN_SITES,
  OMNI_CLEAN_V6,
  OMNI_CLEAN_IR,
  DEAD_BYOIP_BLACKLIST,
  VERIFIED_ZEUS_POOL,
  ZEUS_IR_DOMAINS,
  ZEUS_BYOIP_V4,
  GEMINI_VIP_PROXIES,
  COUNTRY_VIP_PROXIES,
} from './countries.js';

export {
  WORLD_COUNTRIES,
  DEFAULT_ECH_CONFIG,
  COUNTRY_BY_CC,
  findCountry,
  VERIFIED_COUNTRIES,
  PRIMARY_LOCATIONS,
  OMNI_HYBRID_POOL,
  OMNI_QOS_V4,
  OMNI_CLEAN_SITES,
  OMNI_CLEAN_V6,
  OMNI_CLEAN_IR,
  DEAD_BYOIP_BLACKLIST,
  VERIFIED_ZEUS_POOL,
  ZEUS_IR_DOMAINS,
  ZEUS_BYOIP_V4,
  GEMINI_VIP_PROXIES,
  COUNTRY_VIP_PROXIES,
};

/** نگاشت آی‌پی‌های سرور خروجی کشورها (فقط کشورهای دارای سرور خروجی اختصاصی) */
export const COUNTRY_PROXY_MAP = new Map();
for (const c of WORLD_COUNTRIES) {
  if (!c.verifiedExit) continue;
  for (const p of (c.proxies || [])) {
    const cleanP = String(p || '').trim().split(':')[0].toLowerCase();
    if (cleanP && !COUNTRY_PROXY_MAP.has(cleanP)) {
      COUNTRY_PROXY_MAP.set(cleanP, c);
    }
  }
}

/** مجموعه آی‌پی‌ها و دامنه‌های تاییدشده با تست WebSocket 101 */
export const VERIFIED_BYOIP_SET = new Set([
  ...OMNI_HYBRID_POOL,
  ...OMNI_QOS_V4,
  ...OMNI_CLEAN_SITES,
  ...OMNI_CLEAN_IR,
  '213.241.198.123',
].map((x) => String(x || '').trim().toLowerCase()));

/** رنج‌های رسمی IPv4 کلودفلر (ASN 13335 / 209242) */
export const CF_OFFICIAL_V4_CIDRS = [
  ['173.245.48.0', 20],
  ['103.21.244.0', 22],
  ['103.22.200.0', 22],
  ['103.31.4.0', 22],
  ['141.101.64.0', 18],
  ['108.162.192.0', 18],
  ['190.93.240.0', 20],
  ['188.114.96.0', 20],
  ['197.234.240.0', 22],
  ['198.41.128.0', 17],
  ['162.158.0.0', 15],
  ['104.16.0.0', 13],
  ['104.24.0.0', 14],
  ['172.64.0.0', 13],
  ['131.0.72.0', 22],
];

const ip4ToInt = (ip) => {
  const parts = String(ip).split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
};

const CF_PARSED_V4 = CF_OFFICIAL_V4_CIDRS.map(([base, bits]) => {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { net: (ip4ToInt(base) & mask) >>> 0, mask };
});

/** بررسی تعلق آی‌پی به شبکه کلودفلر، مخزن BYOIP تاییدشده اومنی، یا سرورهای خروجی کشورها */
export function isCloudflareIp(ip) {
  const s = String(ip || '').trim().replace(/^\[|\]$/g, '');
  if (!s) return false;
  const low = s.toLowerCase();
  if (COUNTRY_PROXY_MAP.has(low) || VERIFIED_BYOIP_SET.has(low)) return true;
  if (s.includes(':')) {
    return /^(2606:4700|2803:f800|2405:b500|2405:8100|2a06:98c0|2c0f:f248):/i.test(low);
  }
  const n = ip4ToInt(s);
  if (n === null) return false;
  return CF_PARSED_V4.some(({ net, mask }) => ((n & mask) >>> 0) === net);
}

/** رنج‌های رسمی کلودفلر که روی اپراتورهای ایران کم‌ترین فیلترینگ را دارند */
export const SEED_CIDRS = [
  '172.67.180.0/22',
  '188.114.96.0/22',
  '172.64.80.0/22',
  '104.17.148.0/22',
  '104.18.32.0/22',
  '104.21.32.0/22',
  '104.26.10.0/23',
  '172.67.72.0/22',
  '162.159.128.0/22',
  '104.19.144.0/22',
];

/** آی‌پی‌های IPv6 Anycast کلودفلر (پینگ ~105ms روی همراه اول و ایرانسل) */
export const IPV6_SEEDS = [
  '2606:4700:3030::ac43:b58a',
  '2606:4700::6812:3ed',
  '2606:4700::6812:1a2e',
  '2606:4700:3030::ac43:b520',
  '2606:4700::6812:b58a',
  '2606:4700:3030::6815:3ed',
  '2606:4700::6811:9411',
  '2606:4700::6811:9377',
];

/** پورت‌های بدون TLS کلودفلر */
export const PORTS_PLAIN = [8080, 80, 8880, 2052, 2082, 2086, 2095];

/** پورت‌های TLS کلودفلر */
export const PORTS_TLS = [443, 2053, 8443, 2083, 2087, 2096];

/** دامنه‌های پشت کلودفلر (سایت‌های جهانی Speedtest/Plato/Udemy + دامنه‌های .ir تاییدشده) */
export const CF_DOMAINS = [
];

/** آی‌پی‌های تمیز پیش‌فرض (نسل جدید QoS IPv4 برای همراه اول، ایرانسل و مخابرات) */
export const CF_GOOD_IPS = [
  '172.67.181.32',
  '172.67.181.122',
  '172.67.181.210',
  '104.17.148.167',
  '104.17.148.17',
  '104.17.147.119',
  '104.18.3.91',
  '172.67.163.24',
  '104.18.181.138',
  '104.21.3.237',
  '104.18.26.46',
  '172.67.181.138',
];

export const SEED_IPS = [...OMNI_HYBRID_POOL];

const BLOCKED_EXACT = new Set([
  '104.16.132.229',
  'speed.cloudflare.com',
  'www.cloudflare.com',
  'cloudflare.com',
  'cp.cloudflare.com',
  'cdnjs.cloudflare.com',
  'workers.cloudflare.com',
  'pages.cloudflare.com',
]);

/** بررسی صحت آدرس کاندید (رد آدرس‌های .0 و .255 و دامنه‌های خطای 1034) */
export function isValidCandidate(s) {
  const v = String(s ?? '').trim().replace(/^\[|\]$/g, '');
  if (!v || v.length > 120) return false;
  if (BLOCKED_EXACT.has(v.toLowerCase())) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
    const oct = v.split('.').map(Number);
    if (oct.some((n) => n < 0 || n > 255)) return false;
    if (oct[3] === 0 || oct[3] === 255) return false;
    if (oct[0] === 0 || oct[0] === 127 || oct[0] === 10) return false;
    return true;
  }
  if (v.includes(':')) {
    return /^[0-9a-f:]{3,45}$/i.test(v) && !v.endsWith('::0');
  }
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(v);
}

/** تولید نمونه آی‌پی‌های تصادفی از رنج‌های CIDR */
export function sampleCidrs(cidrs = SEED_CIDRS, count = 24) {
  const out = [];
  const list = cidrs.filter(Boolean);
  if (!list.length) return CF_GOOD_IPS.slice(0, count);
  for (let i = 0; i < count; i++) {
    const c = list[i % list.length].trim();
    const m = /^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/.exec(c);
    if (!m) {
      if (isValidCandidate(c)) out.push(c);
      continue;
    }
    const parts = m[1].split('.').map(Number);
    const mask = Math.min(30, Math.max(16, Number(m[2])));
    const base = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    const hostBits = 32 - mask;
    const maxHost = (1 << hostBits) - 2;
    const rnd = 1 + Math.floor(Math.random() * Math.max(1, maxHost));
    let ip = ((base & (~((1 << hostBits) - 1) >>> 0)) | rnd) >>> 0;
    const lastOctet = ip & 255;
    if (lastOctet === 0) ip = (ip | 1) >>> 0;
    if (lastOctet === 255) ip = (ip & ~1) >>> 0;
    out.push(`${(ip >>> 24) & 255}.${(ip >>> 16) & 255}.${(ip >>> 8) & 255}.${ip & 255}`);
  }
  return [...new Set(out)].filter(isValidCandidate);
}

export const sampleIPs = sampleCidrs;

export async function fetchCfCidrs() {
  try {
    const r = await fetch('https://www.cloudflare.com/ips-v4', { cf: { cacheTtl: 3600 } });
    if (r.ok) {
      const list = (await r.text()).split(/\s+/).filter((x) => x.includes('/'));
      if (list.length) return list;
    }
  } catch { /* fallback */ }
  return SEED_CIDRS;
}

/**
 * تست اتصال TCP واقعی به host:port با اندازه‌گیری زمان برقراری سوکت
 */
export async function tcpProbe(host, { port = 443, timeoutMs = 2500 } = {}) {
  const cleanHost = String(host || '').trim().replace(/^\[|\]$/g, '');
  const t0 = Date.now();
  let sock;
  let timer;
  try {
    sock = connect({ hostname: cleanHost, port: Number(port) });
    await Promise.race([
      sock.opened,
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), timeoutMs); }),
    ]);
    const ms = Math.max(1, Date.now() - t0);
    return { ip: cleanHost, port: Number(port), ok: true, alive: true, ms, latencyMs: ms };
  } catch (e) {
    const msg = String(e?.message || e);
    // خطای 1042 محدودیت خود Cloudflare Workers برای اتصال به شبکه خودش است؛ هرگز آن را موفقیت یا پینگ جعلی حساب نکن.
    return { ip: cleanHost, port: Number(port), ok: false, alive: false, ms: null, latencyMs: null, error: msg };
  } finally {
    clearTimeout(timer);
    try { sock?.close(); } catch { /* ignore */ }
  }
}

/**
 * پروب HTTP/TLS روی کاندیدها (شامل سرورهای ProxyIP کشورها، آی‌پی‌های BYOIP اومنی و دامنه‌ها)
 */
export async function httpProbe(target, { timeoutMs = 2500 } = {}) {
  const clean = String(target || '').trim().replace(/^\[|\]$/g, '');
  if (!isValidCandidate(clean)) {
    return { ip: clean, ok: false, alive: false, ms: null, colo: null, error: 'آدرس نامعتبر (.0/.255 یا مسدود)' };
  }
  const isRawIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(clean) || clean.includes(':');
  const proxyCountry = COUNTRY_PROXY_MAP.get(clean.toLowerCase());

  // ۱) اگر آی‌پی متعلق به سرور خروجی کشورها (ProxyIP) است، با tcpProbe روی پورت 443 تست واقعی می‌گیریم
  if (proxyCountry) {
    const tcp = await tcpProbe(clean, { port: 443, timeoutMs });
    return {
      ip: clean,
      ok: Boolean(tcp.ok),
      alive: Boolean(tcp.alive),
      is_cf: true,
      is_proxy: true,
      country: proxyCountry.cc,
      country_fa: proxyCountry.fa,
      flag: proxyCountry.flag,
      ms: tcp.ms,
      edge_ms: tcp.ms,
      colo: proxyCountry.colo,
      error: tcp.ok ? undefined : (tcp.error || 'پروکسی خروجی بدون پاسخ'),
    };
  }

  // ۲) اگر آی‌پی خام است و نه کلودفلر است و نه BYOIP تاییدشده، فوراً رد می‌شود
  if (isRawIp && !isCloudflareIp(clean)) {
    return {
      ip: clean,
      ok: false,
      alive: false,
      is_cf: false,
      ms: null,
      colo: null,
      error: 'رد شد: آی‌پی متعلق به کلودفلر (ASN 13335) نیست',
    };
  }

  // ۳) اگر آی‌پی در مخزن تاییدشده BYOIP اومنی است، با tcpProbe یا trace زمان واقعی گرفته می‌شود
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const urlHost = clean.includes(':') ? `[${clean}]` : clean;
  try {
    const r = await fetch(`https://${urlHost}/cdn-cgi/trace`, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'Omni-Scanner/2.0' },
    });
    const text = await r.text();
    const ms = Math.max(1, Date.now() - t0);
    const colo = (/colo=([A-Z]{3})/.exec(text) || [])[1] || null;
    const isCfTrace = text.includes('fl=') && text.includes('colo=');
    if (isCfTrace) {
      return { ip: clean, ok: true, alive: true, is_cf: true, ms, edge_ms: ms, colo: colo || 'CF' };
    }
    if (isRawIp && isCloudflareIp(clean)) {
      return {
        ip: clean,
        ok: true,
        alive: true,
        is_cf: true,
        ms,
        edge_ms: ms,
        colo: clean.includes(':') ? 'CF6' : 'CF4',
      };
    }
    if (!isRawIp && VERIFIED_BYOIP_SET.has(clean.toLowerCase())) {
      return { ip: clean, ok: true, alive: true, is_cf: true, ms, edge_ms: ms, colo: 'CF' };
    }
    const cfRay = r.headers.get('cf-ray') || '';
    const serverHdr = (r.headers.get('server') || '').toLowerCase();
    if (!isRawIp && (cfRay || serverHdr.includes('cloudflare'))) {
      const rayColo = cfRay.includes('-') ? cfRay.split('-').pop() : 'CF';
      return { ip: clean, ok: true, alive: true, is_cf: true, ms, edge_ms: ms, colo: rayColo };
    }
    return { ip: clean, ok: false, alive: false, is_cf: false, ms: null, colo: null, error: 'پاسخ کلودفلر دریافت نشد' };
  } catch (e) {
    // شکست fetch/handshake باید قرمز بماند؛ عضویت در ASN کلودفلر دلیل سالم‌بودن مسیر کاربر نیست.
    return { ip: clean, ok: false, alive: false, is_cf: isCloudflareIp(clean), ms: null, colo: null, error: String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

export async function rankIpsHttp(candidates = SEED_IPS, { concurrency = 10, timeoutMs = 2500 } = {}) {
  const uniq = [...new Set(candidates
    .map((x) => String(x || '').trim().replace(/^\[|\]$/g, ''))
    .filter((x) => isValidCandidate(x) && !DEAD_BYOIP_BLACKLIST.has(x.toLowerCase())))];
  const results = [];
  const queue = [...uniq];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const ip = queue.shift();
      if (!ip) break;
      const r = await httpProbe(ip, { timeoutMs });
      if (r.alive) results.push(r);
    }
  });
  await Promise.all(workers);
  results.sort((a, b) => a.ms - b.ms);
  return results;
}

/**
 * اسکن یکجای همه‌ی کشورهای دارای سرور خروجی (تست هم‌زمان پروکسی‌های هر کشور و بازگرداندن بهترین پروکسی و پینگ واقعی)
 */
export async function scanAllCountries({ ccs = null, onlyPrimary = false, concurrency = 12, timeoutMs = 2000 } = {}) {
  const ccSet = Array.isArray(ccs) && ccs.length ? new Set(ccs.map((x) => String(x || '').toUpperCase())) : null;
  const list = WORLD_COUNTRIES.filter((c) => {
    if (ccSet) return ccSet.has(c.cc);
    return c.verifiedExit && (!onlyPrimary || c.primary);
  });
  const results = [];
  const queue = [...list];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const c = queue.shift();
      if (!c) break;
      const candidates = (c.proxies || []).slice(0, 3);
      let best = null;
      for (const px of candidates) {
        const host = String(px || '').trim().split(':')[0];
        if (!host) continue;
        const tcp = await tcpProbe(host, { port: 443, timeoutMs });
        if (tcp.ok && tcp.ms > 0) {
          if (!best || tcp.ms < best.ms) {
            best = { proxy: `${host}:443`, host, ms: tcp.ms };
          }
          break; // اولین پروکسی سالم و سریع کافی است
        }
      }
      results.push({
        cc: c.cc,
        fa: c.fa,
        en: c.en,
        flag: c.flag,
        region: c.region,
        colo: c.colo,
        primary: Boolean(c.primary),
        hasVip: Boolean(c.vipProxies && c.vipProxies.length),
        alive: Boolean(best),
        proxy: best ? best.proxy : ((c.proxies?.[0] ? `${c.proxies[0]}:443` : null)),
        host: best ? best.host : (c.proxies?.[0] || null),
        edge_ms: best ? best.ms : null,
      });
    }
  });
  await Promise.all(workers);
  results.sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return (a.edge_ms ?? 9999) - (b.edge_ms ?? 9999);
  });
  return results;
}

/* ───────── اثبات شبکه سرویس‌های AI از داخل خروجی SOCKS/HTTP ───────── */
function parseServiceProxy(raw) {
  const m = /^(socks5|http):\/\/(?:([^:@]+):([^@]+)@)?([^:/]+)(?::(\d+))?$/i.exec(String(raw || '').trim());
  if (!m) return null;
  return {
    type: m[1].toLowerCase(),
    username: m[2] ? decodeURIComponent(m[2]) : '',
    password: m[3] ? decodeURIComponent(m[3]) : '',
    hostname: m[4],
    port: Number(m[5]) || (m[1].toLowerCase() === 'socks5' ? 1080 : 8080),
  };
}

async function readWithTimeout(reader, timeoutMs, label = 'read-timeout') {
  let timer;
  return Promise.race([
    reader.read(),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
}

async function writeWithTimeout(writer, value, timeoutMs, label = 'write-timeout') {
  let timer;
  return Promise.race([
    writer.write(value),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
}

async function openServiceTunnel(spec, targetHost, targetPort, timeoutMs) {
  const socket = connect({ hostname: spec.hostname, port: spec.port }, { secureTransport: 'starttls' });
  let timer;
  const wait = (promise, label) => Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
  await wait(socket.opened, 'proxy-open-timeout');
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  try {
    if (spec.type === 'socks5') {
      const auth = Boolean(spec.username);
      await writeWithTimeout(writer, auth ? new Uint8Array([5, 2, 0, 2]) : new Uint8Array([5, 1, 0]), timeoutMs, 'socks-greeting-write-timeout');
      const g = (await readWithTimeout(reader, timeoutMs, 'socks-greeting-timeout')).value;
      if (!g || g.length < 2 || g[0] !== 5) throw new Error('socks-bad-greeting');
      if (g[1] === 2) {
        const ub = new TextEncoder().encode(spec.username || '');
        const pb = new TextEncoder().encode(spec.password || '');
        const req = new Uint8Array(3 + ub.length + pb.length);
        req[0] = 1; req[1] = ub.length; req.set(ub, 2); req[2 + ub.length] = pb.length; req.set(pb, 3 + ub.length);
        await writeWithTimeout(writer, req, timeoutMs, 'socks-auth-write-timeout');
        const ar = (await readWithTimeout(reader, timeoutMs, 'socks-auth-timeout')).value;
        if (!ar || ar.length < 2 || ar[1] !== 0) throw new Error('socks-auth-failed');
      } else if (g[1] !== 0) throw new Error('socks-auth-unsupported');
      const hb = new TextEncoder().encode(targetHost);
      const req = new Uint8Array(7 + hb.length);
      req[0] = 5; req[1] = 1; req[2] = 0; req[3] = 3; req[4] = hb.length; req.set(hb, 5);
      req[5 + hb.length] = (targetPort >> 8) & 255; req[6 + hb.length] = targetPort & 255;
      await writeWithTimeout(writer, req, timeoutMs, 'socks-connect-write-timeout');
      const rep = (await readWithTimeout(reader, timeoutMs, 'socks-connect-timeout')).value;
      if (!rep || rep.length < 4 || rep[1] !== 0) throw new Error('socks-connect-rejected');
    } else {
      const lines = [`CONNECT ${targetHost}:${targetPort} HTTP/1.1`, `Host: ${targetHost}:${targetPort}`, 'Proxy-Connection: keep-alive'];
      if (spec.username) lines.push(`Proxy-Authorization: Basic ${btoa(`${spec.username}:${spec.password || ''}`)}`);
      lines.push('', '');
      await writeWithTimeout(writer, new TextEncoder().encode(lines.join('\r\n')), timeoutMs, 'http-connect-write-timeout');
      const rep = (await readWithTimeout(reader, timeoutMs, 'http-connect-timeout')).value;
      const text = rep ? new TextDecoder().decode(rep) : '';
      if (!/^HTTP\/1\.[01]\s+200\b/i.test(text)) throw new Error('http-connect-rejected');
    }
  } finally {
    try { writer.releaseLock(); } catch { /* ignore */ }
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
  return socket;
}

/**
 * اثبات شبکه‌ی سرویس از خروجی واقعی. موفقیت TLS فقط وقتی ثبت می‌شود که startTls
 * گواهی targetHost را قبول کند؛ 403/صفحه‌ی عدم پشتیبانی به‌عنوان accepted ثبت نمی‌شود.
 */
export async function probeServiceViaProxy(proxyRaw, service, { timeoutMs = 6500 } = {}) {
  const targets = {
    gemini_web: { host: 'gemini.google.com', path: '/', ok: [200, 301, 302, 303, 307, 308] },
    gemini_api: { host: 'generativelanguage.googleapis.com', path: '/', ok: [200, 400, 404] },
    ai_studio: { host: 'aistudio.google.com', path: '/', ok: [200, 301, 302, 303, 307, 308] },
    chatgpt: { host: 'chatgpt.com', path: '/', ok: [200, 301, 302, 303, 307, 308] },
    claude: { host: 'claude.ai', path: '/', ok: [200, 301, 302, 303, 307, 308] },
  };
  const target = targets[service];
  const spec = parseServiceProxy(proxyRaw);
  if (!target) return { service, ok: false, accepted: false, error: 'unknown-service' };
  if (!spec) return { service, ok: false, accepted: false, error: 'unsupported-proxy' };
  const started = Date.now();
  let socket, tlsValid = false;
  try {
    socket = await openServiceTunnel(spec, target.host, 443, timeoutMs);
    if (typeof socket.startTls !== 'function') throw new Error('starttls-unavailable');
    const tlsSocket = socket.startTls({ expectedServerHostname: target.host });
    socket = tlsSocket;
    if (tlsSocket.opened) {
      let timer;
      await Promise.race([
        tlsSocket.opened,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('tls-timeout')), timeoutMs); }),
      ]).finally(() => clearTimeout(timer));
    }
    tlsValid = true;
    const writer = tlsSocket.writable.getWriter();
    await writeWithTimeout(writer, new TextEncoder().encode(
      `GET ${target.path} HTTP/1.1\r\nHost: ${target.host}\r\nUser-Agent: Mozilla/5.0 Omni-Proof/1\r\nAccept: text/html,application/json\r\nConnection: close\r\n\r\n`
    ), timeoutMs, 'service-write-timeout');
    writer.releaseLock();
    const reader = tlsSocket.readable.getReader();
    let body = '', total = 0;
    try {
      while (total < 49152) {
        const part = await readWithTimeout(reader, timeoutMs, 'service-read-timeout');
        if (part.done) break;
        if (part.value) { total += part.value.byteLength; body += new TextDecoder().decode(part.value, { stream: true }); }
        if (/\r?\n\r?\n/.test(body) && body.length > 4096) break;
      }
    } finally { try { reader.releaseLock(); } catch { /* ignore */ } }
    const status = Number((/^HTTP\/1\.[01]\s+(\d{3})/i.exec(body) || [])[1] || 0);
    const blocked = /country\s+(?:isn['’]?t|not)\s+supported|not available in your (?:country|region)|unsupported country|geo(?:graphic)? restriction/i.test(body);
    const accepted = target.ok.includes(status) && !blocked;
    return {
      service, ok: status > 0, tls_valid: true, accepted, status,
      country_blocked: blocked, ms: Date.now() - started,
      proxy_host: spec.hostname,
      proof: accepted ? 'network-accepted' : (status ? 'reachable-not-accepted' : 'failed'),
    };
  } catch (e) {
    const error = String(e?.message || e);
    return { service, ok: false, tls_valid: tlsValid && !/tls handshake failed/i.test(error), accepted: false, ms: Date.now() - started, error };
  } finally { try { socket?.close(); } catch { /* ignore */ } }
}

/** تست سلامت یک نود ProxyIP (host[:port]) */
export async function probeNode(proxyStr, timeoutMs = 3000) {
  const s = String(proxyStr || '').trim();
  if (!s) return { proxy: s, ok: false, alive: false, latencyMs: null, error: 'آدرس خالی است' };
  const lastColon = s.lastIndexOf(':');
  let host = s;
  let port = 443;
  if (lastColon > 0 && !s.includes(']') && s.indexOf(':') === lastColon) {
    host = s.slice(0, lastColon);
    port = Number(s.slice(lastColon + 1)) || 443;
  }
  return tcpProbe(host, { port, timeoutMs });
}

export async function rankIps(candidates = SEED_IPS, { port = 443, concurrency = 10, timeoutMs = 2200 } = {}) {
  return rankIpsHttp(candidates, { port, concurrency, timeoutMs });
}
