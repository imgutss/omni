/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/scan.js
   تشخیص شبکه: پینگ، probe نود، رتبه‌بندی آی‌پی‌های تمیز کلودفلر (روی خود ورکر)
   ══════════════════════════════════════════════════════════════════════════ */
import { connect } from 'cloudflare:sockets';

export const CF_CIDR_FALLBACK = [
  '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '162.159.192.0/18',
  '172.66.0.0/16', '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22',
  '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20',
  '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '131.0.72.0/22',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ipToInt = (ip) => ip.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
const intToIp = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

export function sampleIPs(cidrs, count) {
  const nets = cidrs.map((c) => {
    const [ip, bits] = String(c).split('/');
    return { base: ipToInt(ip), size: 2 ** (32 - Number(bits ?? 32)) };
  });
  const out = new Set();
  let guard = count * 10;
  while (out.size < count && guard-- > 0) {
    const n = nets[Math.floor(Math.random() * nets.length)];
    out.add(intToIp((n.base + Math.floor(Math.random() * Math.min(n.size, 4096))) >>> 0));
  }
  return [...out];
}

export function neighbors(ip, radius = 6) {
  const n = ipToInt(ip), base = n & 0xffffff00, out = [];
  for (let i = 1; i <= radius && i < 254; i++) {
    out.push(intToIp((base + i) >>> 0));
    out.push(intToIp((base + 256 - i) >>> 0));
  }
  return out;
}

/** پروب TCP با connect() — سرعت واقعی دست‌دادن به اِج کلودفلر */
export async function tcpProbe(host, { port = 443, timeoutMs = 1500 } = {}) {
  const t0 = Date.now();
  let sock = null, timer = null;
  try {
    sock = connect({ hostname: host, port });
    const ok = await Promise.race([
      sock.opened.then(() => true).catch(() => false),
      new Promise((res) => { timer = setTimeout(() => res(false), timeoutMs); }),
    ]);
    const ms = Date.now() - t0;
    return ok ? { host, ok: 1, ms } : { host, ok: 0, ms: null, err: 'timeout' };
  } catch (e) {
    return { host, ok: 0, ms: null, err: String(e?.message || e).slice(0, 60) };
  } finally {
    clearTimeout(timer);
    try { sock?.close(); } catch { /* ignore */ }
  }
}

/** رتبه‌بندی موازی مجموعه‌ای از آی‌پی‌ها (+ بررسی عمیق همسایه‌ها) */
export async function rankIps(ips, { port = 443, timeoutMs = 1500, concurrency = 12, rounds = 1, deep = false } = {}) {
  let list = [...ips];
  if (deep && ips.length) {
    const set = new Set(list);
    for (const ip of ips.slice(0, 8)) for (const n of neighbors(ip, 5)) set.add(n);
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

/** probe یک نود پروکسی: host:port یا URL */
export async function probeNode(proxyStr, { timeoutMs = 4000 } = {}) {
  let host = String(proxyStr || '').trim();
  let port = 443;
  if (!host) return { ok: false, error: 'empty' };
  try {
    if (host.includes('://')) {
      const u = new URL(host);
      port = Number(u.port || (u.protocol === 'http:' ? 80 : 443));
      host = u.hostname;
    } else if (host.includes(':')) {
      const [h, p] = host.split(':');
      host = h; port = Number(p) || 443;
    }
  } catch { /* hostname خام */ }
  const r = await tcpProbe(host, { port, timeoutMs });
  return { ok: Boolean(r.ok), ms: r.ms, host, port, error: r.err || null };
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
   استخر آی‌پی تمیز — الگوگرفته از پنل‌هایی که در ایران پینگ می‌دهند:
   آی‌پی‌ها باید «هاست واقعی» باشند (نه آدرس شبکه .0/.255) و از محدوده‌هایی
   که برای اپراتورهای ایران باز است انتخاب شوند (Cloudflare + WARP).
   ═══════════════════════════════════════════════════════════════════ */
export const CF_GOOD_IPS = [
  // کلودفلر — پرتکرار در گزارش‌های کاربران ایرانی
  '172.67.73.161', '104.17.209.9', '104.21.32.115', '104.26.12.188', '172.67.182.201',
  '104.16.18.15', '104.17.24.15', '104.21.64.1', '172.67.73.88', '104.26.10.12',
  '104.18.32.115', '162.159.36.1', '162.159.140.38', '172.67.12.188', '104.16.132.229',
  // WARP anycast — روی بیشتر پورت‌ها پاسخ می‌دهد
  '188.114.97.7', '188.114.96.1', '188.114.97.1', '188.114.96.10',
  '162.159.192.1', '162.159.193.1', '162.159.193.10',
];
/** محدوده‌های کلودفلر/WARP برای نمونه‌گیری (بدون آدرس شبکه) */
export const CF_NETS = [
  '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '162.159.0.0/16', '188.114.96.0/22', '162.159.192.0/24',
];
/** دامنه‌های شاخص و پرترافیک روی کلودفلر — به‌عنوان «آدرس» در کانفیگ می‌آیند:
 *  کلاینت به آی‌پی همین دامنه وصل می‌شود (آی‌پی‌هایی که اپراتور بسته‌شان نیست)
 *  ولی SNI و هدر Host همیشه دامنه‌ی خودِ پنل است. */
export const CF_DOMAINS = [
  'cdn.jsdelivr.net', 'registry.npmjs.org', 'www.speedtest.net',
  'medium.com', 'etherscan.io', 'www.coingecko.com', 'www.wto.org', 'www.chess.com',
];

export const IPV6_SEEDS = [
  '2606:4700:3033::6815:1e29', '2606:4700:3037::6815:32a1', '2606:4700:3030::ac43:49a1',
  '2606:4700:3034::6815:4a1', '2606:4700:3035::6815:1a2b', '2803:f800:50::6ca2:c101',
];
/** پورت‌های پشتیبانی‌شده‌ی کلودفلر برای ترافیک Worker */
export const PORTS_PLAIN = [80, 8080, 8880, 2052, 2082, 2086, 2095];
export const PORTS_TLS = [443, 2053, 2083, 2087, 2096, 8443];
export const portIsTls = (p) => PORTS_TLS.includes(Number(p));

/* ───────────── پروب از لبه با fetch (برای آی‌پی‌های کلودفلر) ─────────────
   Workers اجازه‌ی connect() به آی‌پی‌های کلودفلر را نمی‌دهد؛ fetch به
   /cdn-cgi/trace اما انجام می‌شود و همان RTT واقعی تا لبه را می‌دهد. ───────────── */
export async function httpProbe(ip, { timeoutMs = 2500, path = '/cdn-cgi/trace' } = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(`https://${ip}${path}`, {
      headers: { 'user-agent': 'omni-probe' },
      signal: AbortSignal.timeout(timeoutMs),
      cf: { cacheTtl: 0 },
    });
    const ms = Date.now() - t0;
    const body = await r.text().catch(() => '');
    return { ip, ok: true, alive: true, ms, status: r.status,
      colo: (body.match(/colo=(\w+)/) || [])[1] || null,
      egress: (body.match(/ip=([0-9.]+)/) || [])[1] || null };
  } catch (e) {
    return { ip, ok: false, alive: false, ms: null, error: String(e?.message || e).slice(0, 80) };
  }
}

export async function rankIpsHttp(ips, { concurrency = 10, timeoutMs = 2500 } = {}) {
  const out = [];
  const queue = [...ips];
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const ip = queue.shift();
      const r = await httpProbe(ip, { timeoutMs });
      if (r.alive) out.push(r);
    }
  }));
  return out.sort((a, b) => a.ms - b.ms);
}

/** سازگاری با نسخه‌های قبلی */
export const SEED_IPS = CF_GOOD_IPS;


/* ───────────── اعتبارسنجی آی‌پی‌ها از داخل خود ورکر ─────────────
   نکته‌ی کلیدی: نمی‌توان با connect() به آی‌پی‌های کلودفلر وصل شد، اما با
   fetch + resolveOverride می‌شود «همان آی‌پی» را با Host و SNI خود پنل صدا زد.
   اگر پاسخ درست برگردد یعنی آن آی‌پی واقعاً ترافیک ورکر ما را سرو می‌کند
   (همان چیزی که کلاینت هنگام اتصال تجربه می‌کند). ───────────── */
export async function validateIps(ips, { host, path = '/api/whoami', timeoutMs = 4000, concurrency = 8 } = {}) {
  const out = [];
  const queue = [...ips];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
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
