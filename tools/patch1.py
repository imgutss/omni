import io, re

p = 'src/links.js'
s = io.open(p, encoding='utf-8').read()

# ── ۱) پریست‌های فرگمنت مطابق پنل‌های کارکرده در ایران ──
start = s.index('/* پریست‌های فرگمنت')
end = s.index('export const FINGERPRINTS')
new_presets = """/* پریست‌های فرگمنت (همان مقادیری که پنل‌های کارکرده در ایران استفاده می‌کنند) */
export const FRAGMENT_PRESETS = [
  { id: 'none', label: '— بدون فرگمنت', size: '', interval: '', packets: '' },
  { id: 'mci', label: 'همراه اول (MCI)', size: '100-200', interval: '1-1', packets: 'tlshello' },
  { id: 'irancell', label: 'ایرانسل', size: '1-3', interval: '1-1', packets: 'tlshello' },
  { id: 'rightel', label: 'رایتل', size: '100-200', interval: '5-10', packets: 'tlshello' },
  { id: 'tci', label: 'مخابرات (TCI)', size: '1-1', interval: '1-1', packets: 'tlshello,sniext' },
  { id: 'gaming', label: 'گیمینگ (بدون فرگمنت — کم‌ترین پینگ)', size: '', interval: '', packets: '' },
  { id: 'aggressive', label: 'تهاجمی', size: '1-100', interval: '1-5', packets: 'tlshello,sniext,clienthello' },
];

"""
s = s[:start] + new_presets + s[end:]

old_frag = "export const fragmentValue = (id) => (FRAGMENT_PRESETS.find((p) => p.id === id) || { value: '' }).value;"
new_frag = """export const fragmentPreset = (id) => FRAGMENT_PRESETS.find((p) => p.id === id) || FRAGMENT_PRESETS[0];
/** مقادیر فرگمنت برای پارامترهای URI؛ null یعنی بدون فرگمنت */
export const fragmentValue = (id) => {
  const p = fragmentPreset(id);
  return p.size ? p : null;
};"""
s = s.replace(old_frag, new_frag)

# ── ۲) بازنویسی کامل بخش ساخت کانفیگ ──
start = s.index('/** نام سرور برای TLS (SNI)')
end = s.index('/* ─────────────── sing-box / clash ─────────────── */')

new_block = r'''/** نام سرور برای TLS (SNI) و هدر Host — همیشه دامنه‌ی خود پنل است،
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
  const rotation = [80, 443, 8080, 2053, 8880, 2087, 2082, 2083, 2095, 2096, 2086, 8443, 2052];
  const out = [primary, ...rotation.filter((x) => x !== primary)];
  return [...new Set(out)].slice(0, Math.max(1, Math.min(6, count)));
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
  guessed.forEach(push);
  if (host) push(host);
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

/** کانفیگ‌های یک کاربر: ماتریس آدرس × پورت (همان روشی که کانفیگ‌ها در ایران پینگ می‌دهند) */
export function buildConfigs(user, settings, cleanIps = []) {
  const addrs = addressesFor(user, settings, cleanIps);
  const maxConfigs = Math.max(4, Math.min(40, Number(settings.config_count || 20)));
  const portsPerAddr = Math.max(1, Math.ceil(maxConfigs / Math.max(1, addrs.length)));
  const ports = choosePorts(settings, portsPerAddr);
  const uris = [];
  const items = [];
  let n = 0;
  const both = String(settings.proto || 'both') === 'both' && Boolean(settings.trojan_password);
  outer:
  for (const host of addrs) {
    for (const port of ports) {
      if (uris.length >= maxConfigs) break outer;
      n++;
      const label = String(n).padStart(2, '0');
      uris.push(vlessUri(user, settings, host, { index: n, port }));
      items.push({ address: host, port, proto: 'vless', remark: `${user.username} · 🌐 Global · VLESS · ${port} · #${label}` });
      if (both) {
        uris.push(trojanUri(user, settings, host, { index: n, port }));
        items.push({ address: host, port, proto: 'trojan', remark: `${user.username} · 🌐 Global · TROJAN · ${port} · #${label}` });
      }
    }
  }
  return {
    uris,
    items,
    host: addrs[0] || sniFor(settings) || '',
    addresses: addrs,
    ports,
    singbox: buildSingbox(user, settings, addrs, ports),
    clash: buildClash(user, settings, addrs, ports),
  };
}

'''
s = s[:start] + new_block + s[end:]

# ── ۳) sing-box و clash چند‌پورتی ──
s = s.replace("import { IPV6_SEEDS } from './scan.js';", '')  # حذف ایمپورت احتمالی تکراری
lines = s.split('\n')
if not any("from './scan.js'" in l for l in lines[:20]):
    idx = next(i for i, l in enumerate(lines) if l.startswith('const enc ='))
    lines.insert(idx, "import { IPV6_SEEDS } from './scan.js';\n")
    s = '\n'.join(lines)

old_sb = s[s.index('function sbOutbound(user, settings, host) {'):s.index('export function buildSingbox')]
new_sb = r'''function sbOutbound(user, settings, host, port = 443) {
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

'''
s = s.replace(old_sb, new_sb)

old_bs = s[s.index('export function buildSingbox(user, settings, addrs) {'):s.index('export function buildClash')]
new_bs = r'''export function buildSingbox(user, settings, addrs, ports = [443]) {
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
'''
s = s.replace(old_bs, new_bs + '\n')

open(p, 'w', encoding='utf-8').write(s)
print('links.js به‌روزرسانی شد:', len(s), 'بایت')
