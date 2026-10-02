/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/links.js
   ساخت لینک‌های VLESS/Trojan، ساب‌لینک (base64/clash/sing-box) و صفحه‌ی وضعیت
   ══════════════════════════════════════════════════════════════════════════ */

import { IPV6_SEEDS } from './scan.js';

const enc = encodeURIComponent;

/* پریست‌های فرگمنت (همان مقادیری که پنل‌های کارکرده در ایران استفاده می‌کنند) */
export const FRAGMENT_PRESETS = [
  { id: 'none', label: '— بدون فرگمنت', size: '', interval: '', packets: '' },
  { id: 'mci', label: 'همراه اول (MCI)', size: '100-200', interval: '1-1', packets: 'tlshello' },
  { id: 'irancell', label: 'ایرانسل', size: '1-3', interval: '1-1', packets: 'tlshello' },
  { id: 'rightel', label: 'رایتل', size: '100-200', interval: '5-10', packets: 'tlshello' },
  { id: 'tci', label: 'مخابرات (TCI)', size: '1-1', interval: '1-1', packets: 'tlshello,sniext' },
  { id: 'gaming', label: 'گیمینگ (بدون فرگمنت — کم‌ترین پینگ)', size: '', interval: '', packets: '' },
  { id: 'aggressive', label: 'تهاجمی', size: '1-100', interval: '1-5', packets: 'tlshello,sniext,clienthello' },
];

export const FINGERPRINTS = ['chrome', 'firefox', 'safari', 'ios', 'android', 'edge', 'random', 'randomized'];

export const fragmentPreset = (id) => FRAGMENT_PRESETS.find((p) => p.id === id) || FRAGMENT_PRESETS[0];
/** مقادیر فرگمنت برای پارامترهای URI؛ null یعنی بدون فرگمنت */
export const fragmentValue = (id) => {
  const p = fragmentPreset(id);
  return p.size ? p : null;
};

export function safeArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string' && v.trim()) {
    try {
      const j = JSON.parse(v);
      if (Array.isArray(j)) return j.filter(Boolean);
    } catch { /* خط‌به‌خط یا کامایی */ }
    return v.split(/[\n,]/).map((x) => String(x).trim()).filter(Boolean);
  }
  return [];
}

/** نام سرور برای TLS (SNI) و هدر Host — همیشه دامنه‌ی خود پنل است،
 *  حتی وقتی آدرس یک آی‌پی تمیز باشد (کلید اصلی سالم‌بودن کانفیگ). */
export const sniFor = (settings) => String(settings.public_host || '')
  .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '').trim();

/* پورت‌هایی که کلودفلر برای ترافیک Worker قبول می‌کند */
const PORTS_PLAIN = [80, 8080, 8880, 2052, 2082, 2086, 2095];
const PORTS_TLS = [443, 2053, 2083, 2087, 2096, 8443];
export const isTlsPort = (p) => PORTS_TLS.includes(Number(p));

/** پورت‌های تولید کانفیگ. «auto» پنجره‌ای روی همه‌ی پورت‌های سالم کلودفلر
 *  می‌سازد — در ایران بعضی پورت‌ها باز و بعضی بسته‌اند، پس این مهم است. */
export function choosePorts(settings, count = 4) {
  const primary = Number(settings.port || 443);
  const mode = String(settings.ports_mode || 'auto');
  if (mode === 'single') return [primary];
  if (mode === 'custom' && String(settings.ports_custom || '').trim()) {
    const list = String(settings.ports_custom).split(/[\s,]+/).map(Number).filter((n) => n > 0 && n < 65536);
    if (list.length) return [...new Set(list)].slice(0, 8);
  }
  // ترتیب: اول پورت ۸۰ (بدون TLS، بدون SNI — مقاوم‌ترین حالت در ایران)، بعد ۴۴۳ و بقیه
  const rotation = [80, 443, 2053, 8080, 2087, 8443, 8880, 2082, 2083, 2095, 2096, 2086, 2052];
  const out = rotation.includes(primary) ? rotation : [primary, ...rotation];
  return [...new Set(out)].slice(0, Math.max(1, Math.min(13, count)));
}

/** آدرس‌های کانفیگ به ترتیب اولویت:
 *  ۱) آی‌پی‌های اختصاصی کاربر  ۲) آی‌پی‌های تأییدشده توسط کاربران واقعی
 *  ۳) استخر آماده‌ی کلودفلر/WARP  ۴) دامنه‌ی پنل  ۵) IPv6 */
export function addressesFor(user, settings, cleanIps = [], { limit = 6 } = {}) {
  const norm = (cleanIps || [])
    .map((r) => (typeof r === 'string' ? { ip: r, hits: 0, ms: null } : r))
    .filter((r) => r && r.ip);
  const verified = norm.filter((r) => Number(r.hits || 0) > 0)
    .sort((a, b) => (a.ms ?? 9999) - (b.ms ?? 9999)).map((r) => r.ip);
  const guessed = norm.filter((r) => !(Number(r.hits || 0) > 0))
    .sort((a, b) => (a.ms ?? 9999) - (b.ms ?? 9999)).map((r) => r.ip);
  const host = sniFor(settings);
  const list = [];
  const push = (h) => { if (h && !list.includes(h)) list.push(h); };
  safeArray(user?.ips).forEach(push);
  verified.forEach(push);
  if (host) push(host);        // دامنه‌ی پنل: همیشه به‌عنوان گزینه‌ی مطمئن
  guessed.forEach(push);
  if (String(settings.ipv6_enabled || '1') === '1') {
    const pool = safeArray(settings.ipv6_pool).length ? safeArray(settings.ipv6_pool) : IPV6_SEEDS;
    pool.forEach(push);
  }
  return list.slice(0, limit);
}

const encHost = (h) => (String(h).includes(':') ? `[${h}]` : h);

/** یک لینک VLESS برای آدرس/پورت مشخص */
export function vlessUri(user, settings, host, { index = 1, port = 443 } = {}) {
  const tls = isTlsPort(port);
  const fp = user.fingerprint || settings.fingerprint || 'chrome';
  const ed = Number(user.early_data || settings.early_data || 2048);
  const basePath = settings.path || '/ws';
  const path = encodeURIComponent(ed > 0 ? `${basePath}?ed=${ed}` : basePath);
  const sni = sniFor(settings) || host;
  const params = ['encryption=none', 'type=ws'];
  if (tls) params.push('security=tls', `sni=${sni}`, `fp=${fp}`, `host=${sni}`, 'alpn=http%2F1.1');
  else params.push('security=none', `host=${sni || host}`);
  params.push(`path=${path}`);
  const frag = fragmentValue(user.fragment || settings.fragment_preset);
  if (frag) {
    params.push(`fragment=${encodeURIComponent(frag.size)}`);
    if (frag.packets) params.push(`fragmentPackets=${encodeURIComponent(frag.packets)}`);
    if (frag.interval) params.push(`fragmentInterval=${encodeURIComponent(frag.interval)}`);
  }
  if (settings.mux_enabled === '1') params.push('mux=1', 'xmux=maxStreams=8');
  const remark = `${settings.remark_prefix || ''}${user.username} · 🌐 Global · VLESS · ${port} · #${String(index).padStart(2, '0')}`;
  return `vless://${user.uuid}@${encHost(host)}:${port}?${params.join('&')}#${enc(remark)}`;
}

/** یک لینک Trojan برای آدرس/پورت مشخص */
export function trojanUri(user, settings, host, { index = 1, port = 443 } = {}) {
  const tls = isTlsPort(port);
  const fp = user.fingerprint || settings.fingerprint || 'chrome';
  const basePath = settings.path || '/ws';
  const ed = Number(user.early_data || settings.early_data || 2048);
  const path = encodeURIComponent(ed > 0 ? `${basePath}?ed=${ed}` : basePath);
  const sni = sniFor(settings) || host;
  const params = ['type=ws'];
  if (tls) params.push('security=tls', `sni=${sni}`, `fp=${fp}`, `host=${sni}`, 'alpn=http%2F1.1');
  else params.push('security=none', `host=${sni || host}`);
  params.push(`path=${path}`);
  const remark = `${settings.remark_prefix || ''}${user.username} · 🌐 Global · TROJAN · ${port} · #${String(index).padStart(2, '0')}`;
  return `trojan://${settings.trojan_password || ''}@${encHost(host)}:${port}?${params.join('&')}#${enc(remark)}`;
}

/** جفت‌های تأییدشده‌ی (آی‌پی:پورت) که با اتصال واقعی تست شده‌اند
 *  (از ابزار `npm run pool` یا گزارش کاربران) — بهترین گزینه‌ها. */
export function verifiedPairs(settings) {
  try {
    const arr = JSON.parse(String(settings.verified_pairs || '[]'));
    if (Array.isArray(arr)) return arr.filter((x) => /^[0-9a-fA-F:.]+:\d+$/.test(String(x)));
  } catch { /* ignore */ }
  return [];
}

/** کانفیگ‌های یک کاربر.
 *  اگر جفت‌های تأییدشده داشته باشیم، همان‌ها اول می‌آیند (چون واقعاً تست شده‌اند)؛
 *  بعد ماتریس آدرس × پورت به‌عنوان گزینه‌های بیشتر. */
export function buildConfigs(user, settings, cleanIps = []) {
  const addrs = addressesFor(user, settings, cleanIps);
  const maxConfigs = Math.max(6, Math.min(60, Number(settings.config_count || 30)));
  const uris = [];
  const items = [];
  let n = 0;
  const both = String(settings.proto || 'both') === 'both' && Boolean(settings.trojan_password);
  const label = (i) => String(i).padStart(2, '0');
  const push = (host, port) => {
    if (uris.length >= maxConfigs) return;
    if (uris.some((u, i) => i >= 0 && items[i] && items[i].address === host && items[i].port === port && items[i].proto === 'vless')) return;
    n++;
    uris.push(vlessUri(user, settings, host, { index: n, port }));
    items.push({ address: host, port, proto: 'vless', remark: `${user.username} · 🌐 Global · VLESS · ${port} · #${label(n)}` });
    if (both && uris.length < maxConfigs) {
      uris.push(trojanUri(user, settings, host, { index: n, port }));
      items.push({ address: host, port, proto: 'trojan', remark: `${user.username} · 🌐 Global · TROJAN · ${port} · #${label(n)}` });
    }
  };

  // ۱) جفت‌های تأییدشده (تست‌شده با اتصال واقعی)
  const pairs = verifiedPairs(settings);
  const userIps = safeArray(user?.ips);
  const orderedPairs = [
    ...pairs.filter((pr) => userIps.some((ip) => pr.startsWith(ip + ':'))),
    ...pairs.filter((pr) => !userIps.some((ip) => pr.startsWith(ip + ':'))),
  ];
  const maxVerified = Math.max(4, Math.round(maxConfigs * 0.45));
  let usedVerified = 0;
  for (const pr of orderedPairs) {
    if (usedVerified >= maxVerified) break;
    const idx = pr.lastIndexOf(':');
    const before = uris.length;
    push(pr.slice(0, idx), Number(pr.slice(idx + 1)));
    if (uris.length > before) usedVerified++;
  }

  // ۲) ماتریس آدرس × پورت (پورت‌ها بیرونی تا تنوع پورت حفظ شود)
  const ports = choosePorts(settings, 4);
  outer:
  for (const port of ports) {
    for (const host of addrs) {
      if (uris.length >= maxConfigs) break outer;
      push(host, port);
    }
  }
  return {
    uris,
    items,
    host: addrs[0] || sniFor(settings) || '',
    addresses: addrs,
    ports,
    verified: pairs.length,
    singbox: buildSingbox(user, settings, addrs, ports),
    clash: buildClash(user, settings, addrs, ports),
  };
}

/* ─────────────── sing-box / clash ─────────────── */
function sbOutbound(user, settings, host, port = 443) {
  const path = settings.path || '/ws';
  const sni = sniFor(settings) || host;
  const tls = isTlsPort(port);
  const ed = Number(user.early_data || settings.early_data || 2048);
  return {
    type: 'vless',
    tag: `omni-${user.username}-${host}-${port}`.slice(0, 60),
    server: host,
    server_port: Number(port),
    uuid: user.uuid,
    flow: '',
    tls: {
      enabled: tls,
      server_name: tls ? sni : undefined,
      insecure: false,
      alpn: tls ? ['http/1.1'] : undefined,
      utls: tls ? { enabled: true, fingerprint: user.fingerprint || settings.fingerprint || 'chrome' } : undefined,
    },
    transport: {
      type: 'ws',
      path,
      headers: { Host: sni || host },
      max_early_data: ed > 0 ? ed : undefined,
      early_data_header_name: ed > 0 ? 'Sec-WebSocket-Protocol' : undefined,
    },
  };
}

function sbTrojan(user, settings, host, port = 443) {
  const path = settings.path || '/ws';
  const sni = sniFor(settings) || host;
  const tls = isTlsPort(port);
  const ed = Number(user.early_data || settings.early_data || 2048);
  return {
    type: 'trojan',
    tag: `omni-${user.username}-tr-${host}-${port}`.slice(0, 60),
    server: host,
    server_port: Number(port),
    password: settings.trojan_password || '',
    tls: {
      enabled: tls,
      server_name: tls ? sni : undefined,
      insecure: false,
      alpn: tls ? ['http/1.1'] : undefined,
      utls: tls ? { enabled: true, fingerprint: user.fingerprint || settings.fingerprint || 'chrome' } : undefined,
    },
    transport: {
      type: 'ws',
      path,
      headers: { Host: sni || host },
      max_early_data: ed > 0 ? ed : undefined,
      early_data_header_name: ed > 0 ? 'Sec-WebSocket-Protocol' : undefined,
    },
  };
}

export function buildSingbox(user, settings, addrs, ports = [443]) {
  const outs = [];
  for (const h of addrs) for (const p of ports) {
    outs.push(sbOutbound(user, settings, h, p));
    if (String(settings.proto || 'both') === 'both' && settings.trojan_password) outs.push(sbTrojan(user, settings, h, p));
  }
  return {
    log: { level: 'warn', timestamp: true },
    dns: { servers: [{ tag: 'remote', address: settings.dns_upstream || 'https://1.1.1.1/dns-query' }, { tag: 'direct', address: 'https://cloudflare-dns.com/dns-query', detour: 'direct' }], rules: [{ outbound: 'any', server: 'direct' }], final: 'remote' },
    inbounds: [{ type: 'mixed', tag: 'mixed-in', listen: '127.0.0.1', listen_port: 2080 }],
    outbounds: [
      { type: 'selector', tag: 'select', outbounds: ['auto', ...outs.map((o) => o.tag)] },
      { type: 'urltest', tag: 'auto', outbounds: outs.map((o) => o.tag), url: 'https://cp.cloudflare.com', interval: '3m' },
      { type: 'direct', tag: 'direct' },
      ...outs,
    ],
    route: {
      rules: [
        { protocol: 'dns', outbound: 'dns-out' },
        { ip_is_private: true, outbound: 'direct' },
        { domain_suffix: ['.ir'], outbound: 'direct' },
      ],
      final: 'select',
      auto_detect_interface: true,
    },
  };
}

function clashProxy(user, settings, host, port, proto = 'vless', idx = 1) {
  const path = settings.path || '/ws';
  const sni = sniFor(settings) || host;
  const tls = isTlsPort(port);
  const ed = Number(user.early_data || settings.early_data || 2048);
  const base = {
    name: `omni-${idx}-${proto}-${port}`,
    type: proto,
    server: host,
    port: Number(port),
    tls,
    servername: tls ? sni : undefined,
    network: 'ws',
    'client-fingerprint': user.fingerprint || settings.fingerprint || 'chrome',
    'ws-opts': {
      path,
      headers: { Host: sni || host },
      ...(ed > 0 ? { 'max-early-data': ed, 'early-data-header-name': 'Sec-WebSocket-Protocol' } : {}),
    },
    udp: true,
  };
  if (proto === 'vless') base.uuid = user.uuid;
  else base.password = settings.trojan_password || '';
  return base;
}

export function buildClash(user, settings, addrs, ports = [443]) {
  const proxies = [];
  let i = 0;
  const both = String(settings.proto || 'both') === 'both' && Boolean(settings.trojan_password);
  for (const h of addrs) {
    for (const port of ports) {
      proxies.push(clashProxy(user, settings, h, port, 'vless', ++i));
      if (both) proxies.push(clashProxy(user, settings, h, port, 'trojan', i));
    }
  }
  return {
    'mixed-port': 7890,
    'allow-lan': false,
    mode: 'rule',
    'log-level': 'warning',
    dns: { enable: true, ipv6: false, nameserver: [settings.dns_upstream || 'https://1.1.1.1/dns-query'] },
    proxies,
    'proxy-groups': [
      { name: '🚀 Omni', type: 'select', proxies: proxies.map((p) => p.name) },
      { name: '♻️ Auto', type: 'url-test', proxies: proxies.map((p) => p.name), url: 'http://www.gstatic.com/generate_204', interval: 300 },
    ],
    rules: ['DOMAIN-SUFFIX,ir,DIRECT', 'GEOIP,IR,DIRECT', 'MATCH,🚀 Omni'],
  };
}

/* ─────────────── ساب‌لینک ─────────────── */
export function subscriptionBody(user, settings, cleanIps, type = '') {
  const cfg = buildConfigs(user, settings, cleanIps);
  const t = String(type || '').toLowerCase();
  if (t === 'clash' || t === 'clash-meta' || t === 'yaml') {
    return { body: toYaml(cfg.clash), contentType: 'text/yaml; charset=utf-8' };
  }
  if (t === 'singbox' || t === 'sing-box' || t === 'json') {
    return { body: JSON.stringify(cfg.singbox, null, 2), contentType: 'application/json; charset=utf-8' };
  }
  if (t === 'raw' || t === 'plain') {
    return { body: cfg.uris.join('\n'), contentType: 'text/plain; charset=utf-8' };
  }
  return { body: b64(cfg.uris.join('\n')), contentType: 'text/plain; charset=utf-8' };
}

export const b64 = (s) => btoa(unescape(encodeURIComponent(s)));

export function toYaml(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return 'null';
  if (Array.isArray(obj)) {
    if (!obj.length) return '[]';
    return obj.map((v) => {
      if (typeof v === 'object' && v !== null) return `${pad}-\n${toYaml(v, indent + 1)}`;
      return `${pad}- ${yamlScalar(v)}`;
    }).join('\n');
  }
  if (typeof obj === 'object') {
    return Object.entries(obj).map(([k, v]) => {
      if (typeof v === 'object' && v !== null) return `${pad}${k}:\n${toYaml(v, indent + 1)}`;
      return `${pad}${k}: ${yamlScalar(v)}`;
    }).join('\n');
  }
  return `${pad}${yamlScalar(obj)}`;
}
function yamlScalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  const s = String(v);
  return /^[\w\u0600-\u06FF\-./@:]+$/.test(s) ? s : JSON.stringify(s);
}

/* ─────────────── صفحه‌ی وضعیت کاربر (/status/<token>) ─────────────── */
export function statusPage(user, settings, origin, stats) {
  const gb = (b) => ((b || 0) / 1024 ** 3).toFixed(2);
  const quota = Number(user.quota_bytes || 0);
  const used = (user.up_bytes || 0) + (user.down_bytes || 0);
  const pct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
  const msLeft = user.expires_at ? new Date(String(user.expires_at).replace(' ', 'T') + 'Z').getTime() - Date.now() : null;
  const daysLeft = msLeft === null ? null : Math.max(0, Math.floor(msLeft / 864e5));
  const name = settings.panel_name || 'Omni';
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#06070a">
<title>${esc(name)} · وضعیت اشتراک</title>
<style>
 :root{--bg:#06070a;--card:#0d1017;--line:#1b2130;--txt:#e8eef9;--dim:#7c8aa5;--a1:#22d3ee;--a2:#818cf8;--ok:#34d399;--warn:#fbbf24;--bad:#f87171}
 *{box-sizing:border-box}
 body{margin:0;min-height:100vh;background:radial-gradient(900px 500px at 80% -10%,#101a2b,var(--bg)) fixed;color:var(--txt);
  font-family:Vazirmatn,Tahoma,system-ui,sans-serif;display:grid;place-items:center;padding:18px}
 .card{width:100%;max-width:520px;background:linear-gradient(180deg,var(--card),#0a0d13);border:1px solid var(--line);
  border-radius:22px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
 .brand{display:flex;align-items:center;gap:10px;margin-bottom:18px}
 .logo{width:42px;height:42px;border-radius:13px;background:linear-gradient(135deg,var(--a1),var(--a2));display:grid;place-items:center;font-weight:900;color:#05070c;font-size:19px}
 h1{font-size:17px;margin:0}.muted{color:var(--dim);font-size:12.5px}
 .n{font-size:27px;font-weight:900;margin:14px 0 6px;letter-spacing:-.5px}
 .bar{height:9px;background:#151b28;border-radius:99px;overflow:hidden}
 .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--a1),var(--a2))}
 .bar.hot i{background:linear-gradient(90deg,var(--warn),var(--bad))}
 .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
 .kv{background:#0a0e15;border:1px solid var(--line);border-radius:13px;padding:11px}
 .kv .k{color:var(--dim);font-size:11.5px;margin-bottom:4px}
 .kv b{font-size:14px}
 .btn{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;border:0;cursor:pointer;
  background:linear-gradient(135deg,var(--a1),var(--a2));color:#05070c;font-weight:800;padding:13px 18px;border-radius:14px;
  text-decoration:none;font-size:14px}
 .btn.ghost{background:transparent;border:1px solid var(--line);color:var(--txt);font-weight:600}
 code{background:#080b11;border:1px solid var(--line);border-radius:9px;padding:9px 11px;display:block;direction:ltr;
  font-size:11.5px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:#9fc6ff;margin-top:8px}
 .badge{display:inline-flex;padding:3px 10px;border-radius:99px;font-size:11.5px;font-weight:700}
 .badge.ok{background:rgba(52,211,153,.14);color:var(--ok)}
 .badge.bad{background:rgba(248,113,113,.14);color:var(--bad)}
 .badge.warn{background:rgba(251,191,36,.14);color:var(--warn)}
 .ip{display:flex;align-items:center;gap:8px;background:#0a0e15;border:1px solid var(--line);border-radius:12px;padding:9px 11px;margin-top:7px;font-size:12.5px}
 .ip b{font-family:ui-monospace,Menlo,monospace;direction:ltr;font-weight:600}
 .ip .ms{margin-inline-start:auto;color:var(--dim);font-variant-numeric:tabular-nums}
 .ip .ms.good{color:var(--ok)}.ip .ms.bad{color:var(--bad)}
 .ip .star{cursor:pointer;background:transparent;border:0;color:var(--warn);font-size:15px;padding:0 2px}
 .ip .off{opacity:.45;text-decoration:line-through}
</style></head><body><div class="card">
  <div class="brand"><div class="logo">${esc((name[0] || 'O').toUpperCase())}</div>
    <div><h1>${esc(name)}</h1><div class="muted">وضعیت اشتراک — ${esc(user.username)}</div></div>
    <div style="flex:1"></div>
    <span class="badge ${user.status === 'active' ? 'ok' : 'bad'}">${user.status === 'active' ? 'فعال' : user.status === 'expired' ? 'منقضی' : user.status === 'limited' ? 'حجم تمام' : 'غیرفعال'}</span>
  </div>
  <div class="muted">مصرف حجم</div>
  <div class="n">${gb(used)} <span class="muted" style="font-size:14px;font-weight:400">/ ${quota ? gb(quota) + ' GB' : 'نامحدود'}</span></div>
  <div class="bar ${pct > 85 ? 'hot' : ''}"><i style="width:${pct.toFixed(1)}%"></i></div>
  <div class="grid">
    <div class="kv"><div class="k">زمان باقی‌مانده</div><b>${daysLeft === null ? 'نامحدود' : daysLeft + ' روز'}</b></div>
    <div class="kv"><div class="k">تعداد دستگاه</div><b>${user.device_limit || '-'}</b></div>
    <div class="kv"><div class="k">آپلود</div><b>${gb(user.up_bytes)} GB</b></div>
    <div class="kv"><div class="k">دانلود</div><b>${gb(user.down_bytes)} GB</b></div>
    <div class="kv"><div class="k">اتصال‌ها</div><b>${stats?.conns || 0}</b></div>
    <div class="kv"><div class="k">آخرین اتصال</div><b style="font-size:12px">${esc(user.last_seen || '—')}</b></div>
  </div>
  <a class="btn" href="${esc(origin)}/s/${esc(user.sub_token)}">📥 دریافت کانفیگ</a>
  <a class="btn ghost" href="v2rayng://install-config?url=${encodeURIComponent(`${origin}/s/${user.sub_token}`)}">افزودن مستقیم در v2rayNG</a>
  <div class="muted" style="margin-top:10px">لینک اشتراک (در کلاینت وارد کن):</div>
  <code>${esc(origin)}/s/${esc(user.sub_token)}</code>
  <div class="muted" style="margin-top:18px">⚡️ آی‌پی تمیز برای اینترنت شما</div>
  <div class="muted" style="font-size:11.5px;margin-top:3px">تست از روی دستگاه خودت انجام می‌شود؛ هر آی‌پی سریع‌تری پیدا کردی، ستاره بزن تا برای همه بهتر شود.</div>
  <div id="iplist" style="margin-top:10px"></div>
  <button class="btn ghost" id="ip-test" type="button">🔍 تست آی‌پی‌ها روی دستگاه من</button>
  <div id="ip-out" class="muted" style="margin-top:8px;font-size:11.5px"></div>
  <div class="muted" style="margin-top:14px;font-size:11px">${esc(name)} — پنل مدیریت پروکسی روی Cloudflare Workers</div>
</div>
<script>
(function(){
  var IPS = ${JSON.stringify((stats && stats.ips) || [])}.map(function(x){ return typeof x === 'string' ? {ip:x} : x; });
  var TOKEN = ${JSON.stringify(user.sub_token)};
  var el = document.getElementById('iplist'), out = document.getElementById('ip-out');
  function cls(ms){ if(ms == null) return ''; return ms < 120 ? 'good' : ms > 600 ? 'bad' : ''; }
  function render(){
    if(!IPS.length){ el.innerHTML = '<div class="muted" style="font-size:11.5px">هنوز آی‌پی تمیزی ثبت نشده — تست را بزن.</div>'; return; }
    el.innerHTML = IPS.slice(0,12).map(function(r,i){
      var ms = r.test_ms != null ? r.test_ms : r.ms;
      return '<div class="ip"><b>'+r.ip+'</b>'+(r.colo?'<span class="muted">· '+r.colo+'</span>':'')+
        '<span class="ms '+cls(ms)+'">'+(ms!=null?ms+' ms':'—')+'</span>'+
        '<button class="star" data-ip="'+r.ip+'" title="این آی‌پی برای من خوب بود">★</button></div>';
    }).join('');
  }
  render();
  async function probe(ip){
    var t0 = performance.now();
    // مسیر ۱: HTTPS مستقیم (اگر گواهی آی‌پی پذیرفته شود)
    try {
      var c1 = new AbortController(); var to1 = setTimeout(function(){ c1.abort(); }, 3500);
      var r1 = await fetch('https://'+ip+'/cdn-cgi/trace', { cache:'no-store', signal:c1.signal, mode:'cors' });
      clearTimeout(to1);
      var body = await r1.text().catch(function(){ return ''; });
      return { ip: ip, test_ms: Math.round(performance.now()-t0), colo: (body.match(/colo=(\w+)/)||[])[1] || null, how:'https' };
    } catch(e){ /* برو سراغ مسیر ۲ */ }
    // مسیر ۲: HTTP ساده (بدون مسئله‌ی گواهی) — رسیدن پاسخ یعنی آی‌پی باز است
    try {
      var c2 = new AbortController(); var to2 = setTimeout(function(){ c2.abort(); }, 4000);
      await fetch('http://'+ip+'/cdn-cgi/trace', { cache:'no-store', signal:c2.signal, mode:'no-cors' });
      clearTimeout(to2);
      return { ip: ip, test_ms: Math.round(performance.now()-t0), colo: null, how:'http' };
    } catch(e2){ return { ip: ip, test_ms: null, colo: null, how:'down' }; }
  }
  document.getElementById('ip-test').onclick = async function(){
    var btn = this; btn.disabled = true; out.textContent = 'در حال تست… (تا ۲۰ ثانیه)';
    var results = await Promise.all(IPS.slice(0,12).map(probe));
    results.sort(function(a,b){ return (a.test_ms==null?9e9:a.test_ms) - (b.test_ms==null?9e9:b.test_ms); });
    IPS = results;
    render();
    var ok = results.filter(function(r){ return r.test_ms != null; });
    out.textContent = ok.length ? (ok.length + ' آی‌پی پاسخ داد — سبزترین را در کلاینت امتحان کن.') : 'هیچ آی‌پی جواب نداد؛ ممکن است شبکه‌ی شما کلودفلر را محدود کرده باشد.';
    try {
      await fetch('/api/report-ip', { method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ token: TOKEN, results: ok }) });
    } catch(e){}
    btn.disabled = false;
  };
  el.addEventListener('click', async function(ev){
    var b = ev.target.closest('.star'); if(!b) return;
    b.textContent = '★';
    try {
      await fetch('/api/report-ip', { method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ token: TOKEN, results: [{ ip: b.dataset.ip, ms: 1 }] }) });
      out.textContent = 'ممنون! ثبت شد.';
    } catch(e){}
  });
})();
</script>
</body></html>`;
}

export const esc = (s) => String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
