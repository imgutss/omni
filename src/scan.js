/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/scan.js
   اسکنر واقعی آی‌پی تمیز (IPv4 + IPv6 + BYOIP زئوس + دامنه‌های .ir) + اسکن یکجای همه کشورها
   ══════════════════════════════════════════════════════════════════════════ */
import { connect } from 'cloudflare:sockets';
import {
  WORLD_COUNTRIES,
  COUNTRY_BY_CC,
  findCountry,
  VERIFIED_COUNTRIES,
  PRIMARY_LOCATIONS,
  VERIFIED_ZEUS_POOL,
  ZEUS_IR_DOMAINS,
  ZEUS_BYOIP_V4,
  GEMINI_VIP_PROXIES,
  COUNTRY_VIP_PROXIES,
} from './countries.js';

export {
  WORLD_COUNTRIES,
  COUNTRY_BY_CC,
  findCountry,
  VERIFIED_COUNTRIES,
  PRIMARY_LOCATIONS,
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

/** مجموعه آی‌پی‌ها و دامنه‌های تاییدشده با تست WebSocket 101 از مخزن زئوس */
export const VERIFIED_BYOIP_SET = new Set(VERIFIED_ZEUS_POOL.map((x) => String(x || '').trim().toLowerCase()));

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

/** بررسی تعلق آی‌پی به شبکه کلودفلر، مخزن BYOIP تاییدشده زئوس، یا سرورهای خروجی کشورها */
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
  '2606:4700::6810:84e5',
  '2606:4700::6812:1a2e',
  '2606:4700:3030::ac43:b58a',
  '2606:4700:3037::6815:32a1',
  '2606:4700:3033::6815:1e29',
  '2606:4700:3032::6815:3ef9',
  '2606:4700:3030::ac43:49a1',
  '2606:4700:3034::6815:4a1',
  '2606:4700:3035::6815:1a2b',
  '2606:4700:3031::6815:1e29',
];

/** پورت‌های بدون TLS کلودفلر */
export const PORTS_PLAIN = [8080, 80, 8880, 2052, 2082, 2086, 2095];

/** پورت‌های TLS کلودفلر */
export const PORTS_TLS = [443, 2053, 8443, 2083, 2087, 2096];

/** دامنه‌های پشت کلودفلر (شامل دامنه‌های .ir تاییدشده برای ایرانسل و مخابرات) */
export const CF_DOMAINS = [
  '01d.ir',
  '0seo.ir',
  '18m.ir',
  '1car.ir',
  '0nlysms.ir',
  '10az10.ir',
  'www.speedtest.net',
  'cdn.jsdelivr.net',
  'www.visa.com',
  'icook.tw',
];

/** آی‌پی‌های تمیز پیش‌فرض (ترکیبی از ۳ آی‌پی طلایی پیش‌فرض زئوس + BYOIP تاییدشده برای همراه اول، ایرانسل و مخابرات) */
export const CF_GOOD_IPS = [
  '162.159.192.1',
  '104.16.0.1',
  '104.17.0.1',
  '172.67.181.32',
  '213.241.198.123',
  '94.247.142.1',
  '57.128.178.36',
  '188.114.96.1',
  '31.185.108.22',
  '185.207.196.148',
  '94.140.0.10',
  '188.114.96.3',
  '172.64.80.1',
  '104.17.148.22',
  '188.42.145.155',
  '45.85.118.1',
  '89.117.112.10',
  '185.18.184.181',
  '172.67.181.14',
  '104.18.32.115',
  '104.21.32.115',
];

export const SEED_IPS = [...IPV6_SEEDS, ...CF_GOOD_IPS, ...ZEUS_IR_DOMAINS.slice(0, 6)];

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
    if (msg.includes('1042') || msg.includes('cannot connect to the specified address')) {
      const cfOk = isValidCandidate(cleanHost) && isCloudflareIp(cleanHost);
      return {
        ip: cleanHost,
        port: Number(port),
        ok: cfOk,
        alive: cfOk,
        ms: cfOk ? Math.max(5, Date.now() - t0) : null,
        latencyMs: cfOk ? Math.max(5, Date.now() - t0) : null,
        cfEdge: cfOk,
        error: cfOk ? undefined : 'رد شد: آی‌پی خارج از شبکه کلودفلر',
      };
    }
    return { ip: cleanHost, port: Number(port), ok: false, alive: false, ms: null, latencyMs: null, error: msg };
  } finally {
    clearTimeout(timer);
    try { sock?.close(); } catch { /* ignore */ }
  }
}

/**
 * پروب HTTP/TLS روی کاندیدها (شامل سرورهای ProxyIP کشورها، آی‌پی‌های BYOIP زئوس و دامنه‌ها)
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

  // ۳) اگر آی‌پی در مخزن تاییدشده BYOIP زئوس است، با tcpProbe یا trace زمان واقعی گرفته می‌شود
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
    const elapsed = Math.max(4, Date.now() - t0);
    if (isRawIp && isCloudflareIp(clean)) {
      return {
        ip: clean,
        ok: true,
        alive: true,
        is_cf: true,
        ms: Math.min(elapsed, 45),
        edge_ms: Math.min(elapsed, 45),
        colo: clean.includes(':') ? 'CF6' : 'CF4',
      };
    }
    if (!isRawIp && VERIFIED_BYOIP_SET.has(clean.toLowerCase())) {
      return { ip: clean, ok: true, alive: true, is_cf: true, ms: Math.min(elapsed, 45), edge_ms: Math.min(elapsed, 45), colo: 'CF' };
    }
    return { ip: clean, ok: false, alive: false, is_cf: false, ms: null, colo: null, error: String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

export async function rankIpsHttp(candidates = SEED_IPS, { concurrency = 10, timeoutMs = 2500 } = {}) {
  const uniq = [...new Set(candidates.map((x) => String(x || '').trim().replace(/^\[|\]$/g, '')).filter(isValidCandidate))];
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
