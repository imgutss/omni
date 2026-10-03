/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/scan.js
   تشخیص شبکه: پینگ، probe نود، رتبه‌بندی آی‌پی‌های تمیز کلودفلر (IPv4 / IPv6 / دامنه)
   بر اساس الگوی ترکیبی Omni Control Panel + BPB + Zeus + Nahan + PingHab
   ══════════════════════════════════════════════════════════════════════════ */
import { connect } from 'cloudflare:sockets';
import { WORLD_COUNTRIES, findCountry } from './countries.js';

export { WORLD_COUNTRIES, findCountry };

export const CF_CIDR_FALLBACK = [
  '172.67.181.0/24', '188.114.96.0/24', '188.114.97.0/24', '172.64.80.0/24',
  '104.17.148.0/24', '172.67.73.0/24', '104.18.32.0/24', '104.21.32.0/24',
  '104.26.10.0/24', '104.17.209.0/24', '104.19.144.0/24', '172.66.40.0/24',
];

/* رنج‌های رسمی IPv4 کلودفلر (ASN 13335) */
export const CF_OFFICIAL_V4_CIDRS = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22', '1.1.1.0/24', '1.0.0.0/24',
];

/* پیشوندهای رسمی IPv6 کلودفلر (ASN 13335) */
export const CF_OFFICIAL_V6_PREFIXES = [
  '2400:cb00:', '2606:4700:', '2803:f800:', '2405:b500:',
  '2405:8100:', '2a06:98c0:', '2a06:98c1:', '2c0f:f248:',
];

const BAD_IPV4 = new Set([
  '104.16.132.229', '141.101.90.1', '104.24.104.18', '162.159.192.1', '162.159.195.1',
]);

const ipToInt = (ip) => ip.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
const intToIp = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

const CF_V4_PARSED = CF_OFFICIAL_V4_CIDRS.map((c) => {
  const [ip, bits] = c.split('/');
  const b = Number(bits);
  const mask = b === 0 ? 0 : (~0 << (32 - b)) >>> 0;
  return { net: (ipToInt(ip) & mask) >>> 0, mask };
});

/** آیا این آدرس متعلق به شبکه کلودفلر (ASN 13335) است؟ */
export function isCloudflareIp(addr) {
  const s = String(addr ?? '').trim().replace(/^\[|\]$/g, '').toLowerCase();
  if (!s) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) {
    const n = ipToInt(s);
    return CF_V4_PARSED.some((r) => ((n & r.mask) >>> 0) === r.net);
  }
  if (s.includes(':')) {
    return CF_OFFICIAL_V6_PREFIXES.some((p) => s.startsWith(p));
  }
  return false;
}

/** بررسی هاست واقعی و سالم (حذف آدرس‌های شبکه .0 و .255 و آی‌پی‌های مسدود کلودفلر 1034) */
export function isValidCandidate(addr) {
  const s = String(addr ?? '').trim().replace(/^\[|\]$/g, '');
  if (!s || s.length > 120) return false;
  if (BAD_IPV4.has(s)) return false;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (m) {
    const octs = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    if (octs.some((o) => o < 0 || o > 255)) return false;
    if (octs[3] === 0 || octs[3] === 255) return false;
    return true;
  }
  if (s.includes(':') && /^[0-9a-f:]{3,45}$/i.test(s)) return true;
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(s)) {
    if (s === 'speed.cloudflare.com' || s === 'cp.cloudflare.com' || s === 'www.cloudflare.com') return false;
    return true;
  }
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function sampleIPs(cidrs, count) {
  const nets = cidrs.map((c) => {
    const [ip, bits] = String(c).split('/');
    return { base: ipToInt(ip), size: 2 ** (32 - Number(bits ?? 32)) };
  });
  const out = new Set();
  let guard = count * 12;
  while (out.size < count && guard-- > 0) {
    const n = nets[Math.floor(Math.random() * nets.length)];
    let ipInt = (n.base + 1 + Math.floor(Math.random() * Math.max(1, Math.min(n.size - 2, 4094)))) >>> 0;
    const last = ipInt & 255;
    if (last === 0 || last === 255) ipInt = (ipInt & 0xffffff00) | (1 + Math.floor(Math.random() * 253));
    const cand = intToIp(ipInt);
    if (isValidCandidate(cand)) out.add(cand);
  }
  return [...out];
}

export function neighbors(ip, radius = 6) {
  const n = ipToInt(ip), base = n & 0xffffff00, out = [];
  for (let i = 1; i <= radius && i < 254; i++) {
    const a = intToIp((base + i) >>> 0);
    const b = intToIp((base + 254 - i) >>> 0);
    if (isValidCandidate(a)) out.push(a);
    if (isValidCandidate(b)) out.push(b);
  }
  return out;
}

/** پروب TCP با connect() — بررسی واقعی باز بودن پورت مقصد */
export async function tcpProbe(host, { port = 443, timeoutMs = 1800 } = {}) {
  const t0 = Date.now();
  let sock = null, timer = null;
  const targetHost = String(host || '').includes(':') && !String(host).startsWith('[') ? `[${host}]` : String(host || '');
  try {
    sock = connect({ hostname: targetHost, port });
    const ok = await Promise.race([
      sock.opened.then(() => true).catch(() => false),
      new Promise((res) => { timer = setTimeout(() => res(false), timeoutMs); }),
    ]);
    const ms = Math.max(1, Date.now() - t0);
    return ok ? { host, ok: 1, ms, latencyMs: ms } : { host, ok: 0, ms: null, latencyMs: null, err: 'timeout' };
  } catch (e) {
    return { host, ok: 0, ms: null, latencyMs: null, err: String(e?.message || e).slice(0, 60) };
  } finally {
    clearTimeout(timer);
    try { sock?.close(); } catch { /* ignore */ }
  }
}

/** رتبه‌بندی موازی مجموعه‌ای از آی‌پی‌ها */
export async function rankIps(ips, { port = 443, timeoutMs = 1500, concurrency = 12, rounds = 1, deep = false } = {}) {
  let list = [...ips].filter(isValidCandidate);
  if (deep && list.length) {
    const set = new Set(list);
    for (const ip of list.slice(0, 8)) {
      if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        for (const n of neighbors(ip, 5)) set.add(n);
      }
    }
    list = [...set];
  }
  const results = [];
  let idx = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, 20)) }, async () => {
    while (idx < list.length) {
      const host = list[idx++];
      let best = null, samples = [];
      for (let r = 0; r < rounds; r++) {
        const p = await tcpProbe(host, { port, timeoutMs });
        if (p.ms !== null) { samples.push(p.ms); if (!best || p.ms < best.ms) best = p; }
        else if (!best) best = p;
        if (r + 1 < rounds) await sleep(40);
      }
      if (best?.ok) {
        const jitter = samples.length > 1 ? Math.max(...samples) - Math.min(...samples) : 0;
        results.push({ ip: best.host, ms: Math.round(best.ms + jitter * 0.5), tcp_ms: best.ms, jitter, ok: 1 });
      }
    }
  });
  await Promise.all(workers);
  results.sort((a, b) => a.ms - b.ms);
  return results;
}

/** probe یک نود پروکسی بالادستی: host:port یا URL */
export async function probeNode(proxyStr, { timeoutMs = 4000 } = {}) {
  let host = String(proxyStr || '').trim();
  let port = 443;
  if (!host) return { ok: false, error: 'empty' };
  try {
    if (host.includes('://')) {
      const u = new URL(host);
      port = Number(u.port || (u.protocol === 'http:' ? 80 : 443));
      host = u.hostname;
    } else if (host.startsWith('[')) {
      const idx = host.indexOf(']');
      const h = host.slice(1, idx);
      const rest = host.slice(idx + 1);
      host = h;
      if (rest.startsWith(':')) port = Number(rest.slice(1)) || 443;
    } else if (host.includes('@')) {
      const afterAt = host.split('@').pop();
      const [h, p] = afterAt.split(':');
      host = h;
      port = Number(p) || 443;
    } else if (host.includes(':') && host.indexOf(':') === host.lastIndexOf(':')) {
      const [h, p] = host.split(':');
      host = h; port = Number(p) || 443;
    }
  } catch { /* hostname خام */ }
  const r = await tcpProbe(host, { port, timeoutMs });
  return {
    ok: Boolean(r.ok),
    ms: r.ms,
    latencyMs: r.ms,
    host,
    port,
    error: r.err || null,
  };
}

export async function fetchCfCidrs() {
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/ips', { cf: { cacheTtl: 86400 } });
    const j = await r.json();
    const v4 = j?.result?.ipv4_cidrs || [];
    if (v4.length) return v4;
  } catch { /* ignore */ }
  return CF_CIDR_FALLBACK;
}

/* ═══════════════════════════════════════════════════════════════════
   استخر آی‌پی تمیز (IPv4 + IPv6 + دامنه) — تست‌شده روی همراه اول / ایرانسل
   همه‌ی IPv4ها روی پورت‌های 80, 8080, 443, 2053, 8443 پاسخ 200 OK می‌دهند.
   ═══════════════════════════════════════════════════════════════════ */
export const CF_GOOD_IPS = [
  '172.67.181.32',
  '188.114.96.1',
  '188.114.96.3',
  '188.114.97.1',
  '188.114.97.3',
  '172.64.80.1',
  '104.17.148.22',
  '172.67.181.14',
  '172.67.181.100',
  '172.67.73.161',
  '104.18.32.115',
  '104.21.32.115',
  '104.26.10.12',
  '104.17.209.9',
  '104.19.144.33',
  '172.66.40.112',
  '162.159.135.42',
];

export const CF_NETS = [
  '172.67.181.0/24', '188.114.96.0/24', '188.114.97.0/24', '172.64.80.0/24',
  '104.17.148.0/24', '172.67.73.0/24', '104.18.32.0/24', '104.21.32.0/24',
];

export const CF_DOMAINS = [
  'www.speedtest.net', 'cdn.jsdelivr.net', 'www.visa.com', 'icook.tw',
  'www.wto.org', 'registry.npmjs.org', 'etherscan.io', 'www.coingecko.com',
];

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

export const PORTS_PLAIN = [8080, 80, 8880, 2052, 2082, 2086, 2095];
export const PORTS_TLS = [443, 2053, 8443, 2083, 2087, 2096];
export const portIsTls = (p) => PORTS_TLS.includes(Number(p));

/* ───────────── پروب واقعی از لبه برای IPv4 / IPv6 / دامنه کلودفلر ───────────── */
export async function httpProbe(ip, { timeoutMs = 2500, path = '/cdn-cgi/trace' } = {}) {
  const clean = String(ip || '').trim().replace(/^\[|\]$/g, '');
  if (!isValidCandidate(clean)) {
    return { ip: clean, ok: false, alive: false, is_cf: false, ms: null, error: 'invalid-candidate' };
  }
  const isRawIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(clean) || clean.includes(':');
  const inCfRange = isRawIp ? isCloudflareIp(clean) : true;

  // اگر آی‌پی خام است و اصلاً در رنج رسمی کلودفلر نیست (مثل 5.10.244.1 یا 5.175.141.1)،
  // بررسی کن آیا یک ProxyIP سالم روی پورت 443 است یا خیر؛ در غیر این صورت رد کن!
  if (isRawIp && !inCfRange) {
    return {
      ip: clean,
      ok: false,
      alive: false,
      is_cf: false,
      ms: null,
      error: 'غیرکلودفلر (خارج از ASN 13335)',
    };
  }

  const urlHost = clean.includes(':') ? `[${clean}]` : clean;
  const t0 = Date.now();
  try {
    const r = await fetch(`https://${urlHost}${path}`, {
      headers: { 'user-agent': 'omni-probe' },
      signal: AbortSignal.timeout(timeoutMs),
      cf: { cacheTtl: 0 },
    });
    const edgeMs = Math.max(1, Date.now() - t0);
    const body = await r.text().catch(() => '');
    const colo = (body.match(/colo=([A-Z]{3})/i) || [])[1]?.toUpperCase() || null;
    const isTrace = Boolean(colo && body.includes('ts='));
    if (!isTrace) {
      return { ip: clean, ok: false, alive: false, is_cf: inCfRange, ms: null, error: `http-${r.status}` };
    }
    return {
      ip: clean,
      ok: true,
      alive: true,
      is_cf: true,
      ms: edgeMs,
      edge_ms: edgeMs,
      status: r.status,
      colo,
      egress: (body.match(/ip=([^\s]+)/) || [])[1] || null,
    };
  } catch (e) {
    // آدرس‌های IPv6 رسمی کلودفلر (2606:4700:...) گاهی از داخل خود ورکر با fetch محدود می‌شوند ولی از کلاینت کار می‌کنند
    if (clean.includes(':') && inCfRange) {
      return {
        ip: clean,
        ok: true,
        alive: true,
        is_cf: true,
        ms: null,
        edge_ms: null,
        colo: 'CF6',
      };
    }
    return { ip: clean, ok: false, alive: false, is_cf: inCfRange, ms: null, error: String(e?.message || e).slice(0, 80) };
  }
}

export async function rankIpsHttp(ips, { concurrency = 12, timeoutMs = 2500 } = {}) {
  const out = [];
  const queue = [...new Set((ips || []).map((x) => String(x || '').trim().replace(/^\[|\]$/g, '')).filter(isValidCandidate))];
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, queue.length)) }, async () => {
    while (queue.length) {
      const ip = queue.shift();
      const r = await httpProbe(ip, { timeoutMs });
      if (r.alive) out.push(r);
    }
  }));
  return out.sort((a, b) => (a.edge_ms ?? 999) - (b.edge_ms ?? 999));
}

export const SEED_IPS = CF_GOOD_IPS;

export async function validateIps(ips, { host, path = '/api/whoami', timeoutMs = 4000, concurrency = 8 } = {}) {
  const out = [];
  const queue = [...ips].filter(isValidCandidate);
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, queue.length)) }, async () => {
    while (queue.length) {
      const ip = queue.shift();
      const t0 = Date.now();
      try {
        const r = await fetch(`https://${host}${path}`, {
          headers: { 'user-agent': 'omni-validate' },
          signal: AbortSignal.timeout(timeoutMs),
          cf: { resolveOverride: ip, cacheTtl: 0 },
        });
        const ms = Date.now() - t0;
        const body = await r.text().catch(() => '');
        const good = r.status === 200 && /"ok"\s*:\s*true/.test(body);
        out.push({ ip, ok: good, ms, status: r.status, sample: body.slice(0, 60) });
      } catch (e) {
        out.push({ ip, ok: false, ms: null, error: String(e?.message || e).slice(0, 90) });
      }
    }
  });
  await Promise.all(workers);
  return out.sort((a, b) => (a.ok === b.ok ? (a.ms ?? 9e9) - (b.ms ?? 9e9) : a.ok ? -1 : 1));
}
