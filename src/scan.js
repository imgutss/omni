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
