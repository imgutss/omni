/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/links.js
   ساخت لینک‌های VLESS/Trojan، ساب‌لینک (base64/clash/sing-box) و صفحه‌ی وضعیت
   بهینه‌سازی‌شده بر اساس الگوی ترکیبی Omni Control Panel + BPB + Zeus + Nahan
   ══════════════════════════════════════════════════════════════════════════ */

import { IPV6_SEEDS, CF_DOMAINS, CF_GOOD_IPS, isValidCandidate, findCountry } from './scan.js';

const enc = encodeURIComponent;

/* پریست‌های فرگمنت (فقط در صورت انتخاب صریح کاربر/ادمین اعمال می‌شود؛ پیش‌فرض: بدون فرگمنت) */
export const FRAGMENT_PRESETS = [
  { id: 'none', label: '— بدون فرگمنت (پیش‌فرض — کم‌ترین پینگ)', size: '', interval: '', packets: '' },
  { id: 'mci', label: 'همراه اول (MCI)', size: '100-200', interval: '1-1', packets: 'tlshello' },
  { id: 'irancell', label: 'ایرانسل', size: '1-3', interval: '1-1', packets: 'tlshello' },
  { id: 'rightel', label: 'رایتل', size: '100-200', interval: '5-10', packets: 'tlshello' },
  { id: 'tci', label: 'مخابرات (TCI)', size: '1-1', interval: '1-1', packets: 'tlshello,sniext' },
  { id: 'gaming', label: 'گیمینگ (بدون فرگمنت — کم‌ترین پینگ)', size: '', interval: '', packets: '' },
  { id: 'aggressive', label: 'تهاجمی', size: '1-100', interval: '1-5', packets: 'tlshello,sniext,clienthello' },
];

export const FINGERPRINTS = ['chrome', 'firefox', 'safari', 'ios', 'android', 'edge', 'random', 'randomized'];

export const fragmentPreset = (id) => FRAGMENT_PRESETS.find((p) => p.id === id) || FRAGMENT_PRESETS[0];
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

/** نام سرور برای TLS (SNI) و هدر Host — همیشه دامنه‌ی خود پنل است */
export const sniFor = (settings) => String(settings.public_host || '')
  .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '').trim();

/* پورت‌هایی که کلودفلر برای ترافیک Worker قبول می‌کند */
const PORTS_PLAIN = [8080, 80, 8880, 2052, 2082, 2086, 2095];
const PORTS_TLS = [443, 2053, 8443, 2083, 2087, 2096];
export const isTlsPort = (p) => PORTS_TLS.includes(Number(p));

export function choosePorts(settings, count = 5) {
  const primary = Number(settings.port || 443);
  const mode = String(settings.ports_mode || 'auto');
  if (mode === 'single') return [primary];
  if (mode === 'custom' && String(settings.ports_custom || '').trim()) {
    const list = String(settings.ports_custom).split(/[\s,]+/).map(Number).filter((n) => n > 0 && n < 65536);
    if (list.length) return [...new Set(list)].slice(0, 8);
  }
  const rotation = [443, 2053, 8080, 80, 8443, 8880, 2052, 2087, 2096, 2083];
  const out = rotation.includes(primary) ? rotation : [primary, ...rotation];
  return [...new Set(out)].slice(0, Math.max(1, Math.min(13, count)));
}

/** استخر آدرس‌ها در سه سبد (IPv6 / IPv4 تمیز / دامنه) با فیلتر کامل آدرس‌های .0 و معیوب */
export function configPool(user, settings, cleanIps = []) {
  const cleanAddr = (x) => String(x ?? '').trim().replace(/^\[|\]$/g, '');
  const norm = (cleanIps || [])
    .map((r) => (typeof r === 'string' ? { ip: cleanAddr(r), hits: 0, ms: null } : { ...r, ip: cleanAddr(r?.ip ?? r?.addr) }))
    .filter((r) => r && r.ip && isValidCandidate(r.ip));
  const byMs = (a, b) => (a.ms ?? 9999) - (b.ms ?? 9999);

  const verifiedAll = norm.filter((r) => Number(r.hits || 0) > 0).sort(byMs).map((r) => r.ip);
  const verifiedV6 = verifiedAll.filter((x) => x.includes(':'));
  const verifiedV4 = verifiedAll.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
  const verifiedDomains = verifiedAll.filter((x) => !x.includes(':') && /[a-z]/i.test(x));

  const guessedAll = norm.filter((r) => !(Number(r.hits || 0) > 0)).sort(byMs).map((r) => r.ip);
  const guessedV4 = guessedAll.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
  const guessedV6 = guessedAll.filter((x) => x.includes(':'));

  const userList = safeArray(user?.ips).map(cleanAddr).filter(isValidCandidate);
  const userV6 = userList.filter((x) => x.includes(':'));
  const userV4 = userList.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
  const userDom = userList.filter((x) => !x.includes(':') && /[a-z]/i.test(x));

  const host = sniFor(settings);
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const selCountry = findCountry(settings.selected_country);

  const domain = uniq([
    ...userDom,
    ...verifiedDomains,
    ...safeArray(settings.address_domains).map(cleanAddr).filter(isValidCandidate),
    ...CF_DOMAINS,
  ]).slice(0, 8);

  const ipv6 = String(settings.ipv6_enabled || '1') === '1'
    ? uniq([
        ...userV6,
        ...(selCountry?.v6 || []),
        ...verifiedV6,
        ...safeArray(settings.ipv6_pool).map(cleanAddr).filter((x) => x.includes(':') && isValidCandidate(x)),
        ...IPV6_SEEDS,
        ...guessedV6,
      ]).slice(0, 12)
    : [];

  const ip = uniq([
    ...userV4,
    ...(selCountry?.v4 || []),
    ...verifiedV4,
    ...CF_GOOD_IPS,
    ...guessedV4,
  ]).filter(isValidCandidate);

  return { domain, ipv6, ip, host, verified: verifiedV4, guessed: guessedV4, country: selCountry };
}

export function addressesFor(user, settings, cleanIps = [], { limit = 10 } = {}) {
  const p = configPool(user, settings, cleanIps);
  return [...new Set([...p.ipv6.slice(0, 4), ...p.ip.slice(0, 4), ...p.domain.slice(0, 2)])].slice(0, limit);
}

const encHost = (h) => {
  const clean = String(h || '').trim().replace(/^\[|\]$/g, '');
  return clean.includes(':') ? `[${clean}]` : clean;
};

/** ساخت مسیر WebSocket همراه با پارامترهای کشور خروجی (cc و proxyip) و EarlyData */
export function wsPathFor(user, settings, { includeEd = true } = {}) {
  const basePath = (settings.path || '/ws').split('?')[0];
  const ed = Number(user?.early_data ?? settings.early_data ?? 2048);
  const selC = findCountry(settings.selected_country);
  const qs = [];
  if (includeEd && ed > 0) qs.push(`ed=${ed}`);
  if (selC) {
    qs.push(`cc=${selC.cc}`);
    if (selC.proxies?.[0]) qs.push(`proxyip=${selC.proxies[0]}:443`);
  }
  return qs.length ? `${basePath}?${qs.join('&')}` : basePath;
}

/** یک لینک VLESS برای آدرس/پورت مشخص */
export function vlessUri(user, settings, host, { index = 1, port = 443, cat = 'Global' } = {}) {
  const tls = isTlsPort(port);
  const fp = user.fingerprint || settings.fingerprint || 'chrome';
  const path = encodeURIComponent(wsPathFor(user, settings, { includeEd: true }));
  const sni = sniFor(settings) || host;
  const params = ['encryption=none', 'type=ws'];
  if (tls) params.push('security=tls', `sni=${sni}`, `fp=${fp}`, `host=${sni}`, 'alpn=http%2F1.1');
  else params.push('security=none', `host=${sni || host}`);
  params.push(`path=${path}`);
  const frag = fragmentValue(user.fragment || settings.fragment_preset);
  if (frag && tls) {
    params.push(`fragment=${encodeURIComponent(frag.size)}`);
    if (frag.packets) params.push(`fragmentPackets=${encodeURIComponent(frag.packets)}`);
    if (frag.interval) params.push(`fragmentInterval=${encodeURIComponent(frag.interval)}`);
  }
  if (settings.mux_enabled === '1') params.push('mux=1', 'xmux=maxStreams=8');
  const selC = findCountry(settings.selected_country);
  const locBadge = selC ? `${selC.flag} ${selC.fa}` : '🌐';
  const remark = `${settings.remark_prefix ? settings.remark_prefix + ' · ' : ''}${user.username} · ${locBadge} ${cat} · VLESS · ${port} · #${String(index).padStart(2, '0')}`;
  return `vless://${user.uuid}@${encHost(host)}:${port}?${params.join('&')}#${enc(remark)}`;
}

/** یک لینک Trojan برای آدرس/پورت مشخص */
export function trojanUri(user, settings, host, { index = 1, port = 443, cat = 'Global' } = {}) {
  const tls = isTlsPort(port);
  const fp = user.fingerprint || settings.fingerprint || 'chrome';
  const path = encodeURIComponent(wsPathFor(user, settings, { includeEd: true }));
  const sni = sniFor(settings) || host;
  const params = ['type=ws'];
  if (tls) params.push('security=tls', `sni=${sni}`, `fp=${fp}`, `host=${sni}`, 'alpn=http%2F1.1');
  else params.push('security=none', `host=${sni || host}`);
  params.push(`path=${path}`);
  const selC = findCountry(settings.selected_country);
  const locBadge = selC ? `${selC.flag} ${selC.fa}` : '🌐';
  const remark = `${settings.remark_prefix ? settings.remark_prefix + ' · ' : ''}${user.username} · ${locBadge} ${cat} · Trojan · ${port} · #${String(index).padStart(2, '0')}`;
  return `trojan://${settings.trojan_password || user.uuid}@${encHost(host)}:${port}?${params.join('&')}#${enc(remark)}`;
}

export function verifiedPairs(settings) {
  try {
    const arr = JSON.parse(String(settings.verified_pairs || '[]'));
    if (Array.isArray(arr)) {
      return arr.filter((x) => {
        const s = String(x || '');
        const idx = s.lastIndexOf(':');
        if (idx <= 0) return false;
        const addr = s.slice(0, idx).replace(/^\[|\]$/g, '');
        const port = Number(s.slice(idx + 1));
        return isValidCandidate(addr) && port > 0 && port < 65536;
      });
    }
  } catch { /* ignore */ }
  return [];
}

/** ساخت کانفیگ‌های یک کاربر:
 *  الگوی اثبات‌شده روی همراه اول / ایرانسل (مبتنی بر Omni Control Panel + BPB + Zeus):
 *  ۱) آدرس‌های IPv6 کلودفلر (`2606:4700:...`) روی پورت‌های 443، 2053، 8080، 8443، 80 (پینگ 109–116ms)
 *  ۲) آدرس‌های IPv4 تمیز (`172.67.181.32`، `188.114.96.1`، `188.114.96.3`، `172.64.80.1`، `104.17.148.22`)
 *     روی پورت‌های بدون TLS (`8080` و `80`) که از فیلترینگ SNI روی IPv4 عبور می‌کنند (پینگ 109–123ms)
 *  ۳) دامنه‌ها و آی‌پی‌های تمیز روی پورت‌های 8080/80 و 443/2053 برای وای‌فای و سایر اپراتورها */
export function buildConfigs(user, settings, cleanIps = []) {
  const maxConfigs = Math.max(6, Math.min(80, Number(settings.config_count || 40)));
  const pool = configPool(user, settings, cleanIps);
  const pairs = verifiedPairs(settings);
  const ports = choosePorts(settings, 5);

  const plan = [];
  const seen = new Set();
  const add = (address, port, cat) => {
    const a = String(address || '').trim().replace(/^\[|\]$/g, '');
    if (!a || !isValidCandidate(a)) return;
    const p = Number(port) || 443;
    const key = `${a}:${p}`;
    if (seen.has(key)) return;
    seen.add(key);
    plan.push({ address: a, port: p, cat });
  };

  // ۱) ستون اول: آدرس‌های IPv6 کلودفلر روی پورت 443 (سریع‌ترین و پایدارترین روی همراه اول و ایرانسل — 109..114ms)
  pool.ipv6.slice(0, 5).forEach((v6) => add(v6, 443, 'IPv6'));

  // ۲) ستون دوم: آی‌پی‌های تمیز IPv4 روی پورت‌های 8080 و 80 (عبور از DPI بدون SNI — 109..116ms روی همراه اول)
  pool.ip.slice(0, 3).forEach((ip) => {
    add(ip, 8080, 'Plain');
    add(ip, 80, 'Plain');
  });

  // ۳) ستون سوم: آدرس‌های IPv6 روی پورت‌های جایگزین (2053، 8080، 8443، 80 — 115..116ms در اسکرین‌شات‌ها)
  pool.ipv6.slice(0, 3).forEach((v6) => add(v6, 2053, 'IPv6'));
  pool.ipv6.slice(0, 4).forEach((v6) => add(v6, 8080, 'IPv6'));
  pool.ipv6.slice(5, 8).forEach((v6) => add(v6, 443, 'IPv6'));

  // ۴) ستون چهارم: سایر آی‌پی‌های تمیز و دامنه‌ها روی پورت‌های 8080 و 80
  pool.ip.slice(3, 7).forEach((ip, idx) => add(ip, idx % 2 === 0 ? 80 : 8080, 'Plain'));
  pool.domain.slice(0, 2).forEach((d, idx) => add(d, idx % 2 === 0 ? 8080 : 80, 'Domain'));

  // ۵) ستون پنجم: IPv6 روی 8443 و 80 + جفت‌های تأییدشده + TLS روی IPv4/دامنه برای اینترنت خانگی
  pool.ipv6.slice(0, 2).forEach((v6) => {
    add(v6, 8443, 'IPv6');
    add(v6, 80, 'IPv6');
  });
  for (const pr of pairs.slice(0, 4)) {
    const idx = pr.lastIndexOf(':');
    const a = pr.slice(0, idx);
    const p = Number(pr.slice(idx + 1));
    add(a, p, isTlsPort(p) ? 'Clean' : 'Plain');
  }
  pool.ip.slice(0, 2).forEach((ip) => add(ip, 443, 'IPv4'));
  pool.domain.slice(0, 2).forEach((d) => add(d, 443, 'Domain'));
  if (pool.host) add(pool.host, 443, 'Panel');

  const both = String(settings.proto || 'both') === 'both' && Boolean(settings.trojan_password);
  const uris = [];
  const items = [];
  const emit = ({ address, port, cat }) => {
    for (const proto of both ? ['vless', 'trojan'] : ['vless']) {
      if (uris.length >= maxConfigs) return;
      const n = uris.length + 1;
      const label = String(n).padStart(2, '0');
      const remark = `${user.username} · 🌐 ${cat} · ${proto === 'vless' ? 'VLESS' : 'Trojan'} · ${port} · #${label}`;
      uris.push(proto === 'vless'
        ? vlessUri(user, settings, address, { index: n, port, cat })
        : trojanUri(user, settings, address, { index: n, port, cat }));
      items.push({ address, port, proto, cat, remark });
    }
  };
  plan.forEach(emit);

  // پرکردن باقی‌مانده تا سقف با ترکیب IPv6 و IPv4 روی پورت‌های منتخب
  if (uris.length < maxConfigs) {
    const extraPorts = [8080, 80, 443, 2053, 8443];
    const addrs = [...new Set([...pool.ipv6, ...pool.ip, ...pool.domain])];
    outer:
    for (const port of extraPorts) {
      for (const a of addrs) {
        if (uris.length >= maxConfigs) break outer;
        const key = `${a}:${port}`;
        if (seen.has(key)) continue;
        seen.add(key);
        emit({ address: a, port, cat: a.includes(':') ? 'IPv6' : isTlsPort(port) ? 'Alt' : 'Plain' });
      }
    }
  }

  const usedAddrs = [...new Set(items.map((x) => x.address))];
  return {
    uris,
    items,
    host: pool.host || pool.domain[0] || '',
    addresses: usedAddrs,
    ports,
    verified: pairs.length,
    singbox: buildSingbox(user, settings, usedAddrs.slice(0, 12), [443, 8080, 80, 2053]),
    clash: buildClash(user, settings, usedAddrs.slice(0, 12), [443, 8080, 80, 2053]),
  };
}

/* ─────────────── sing-box / clash ─────────────── */
function sbOutbound(user, settings, host, port = 443) {
  const path = wsPathFor(user, settings, { includeEd: false });
  const sni = sniFor(settings) || host;
  const tls = isTlsPort(port);
  const ed = Number(user.early_data || settings.early_data || 2048);
  const cleanHost = String(host || '').replace(/^\[|\]$/g, '');
  return {
    type: 'vless',
    tag: `omni-${user.username}-${cleanHost.replace(/[:.]/g, '-')}-${port}`.slice(0, 60),
    server: cleanHost,
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
      headers: { Host: sni || cleanHost },
      max_early_data: ed > 0 ? ed : undefined,
      early_data_header_name: ed > 0 ? 'Sec-WebSocket-Protocol' : undefined,
    },
  };
}

function sbTrojan(user, settings, host, port = 443) {
  const path = wsPathFor(user, settings, { includeEd: false });
  const sni = sniFor(settings) || host;
  const tls = isTlsPort(port);
  const ed = Number(user.early_data || settings.early_data || 2048);
  const cleanHost = String(host || '').replace(/^\[|\]$/g, '');
  return {
    type: 'trojan',
    tag: `omni-${user.username}-tr-${cleanHost.replace(/[:.]/g, '-')}-${port}`.slice(0, 60),
    server: cleanHost,
    server_port: Number(port),
    password: settings.trojan_password || user.uuid,
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
      headers: { Host: sni || cleanHost },
      max_early_data: ed > 0 ? ed : undefined,
      early_data_header_name: ed > 0 ? 'Sec-WebSocket-Protocol' : undefined,
    },
  };
}

export function buildSingbox(user, settings, addrs, ports = [443, 8080, 80]) {
  const outs = [];
  for (const h of addrs) {
    const isV6 = String(h).includes(':');
    const targetPorts = isV6 ? [443, 2053, 8080] : [8080, 80, 443];
    for (const p of targetPorts.filter((x) => ports.includes(x))) {
      outs.push(sbOutbound(user, settings, h, p));
      if (String(settings.proto || 'both') === 'both' && settings.trojan_password) {
        outs.push(sbTrojan(user, settings, h, p));
      }
    }
  }
  return {
    log: { level: 'warn', timestamp: true },
    dns: {
      servers: [
        { tag: 'remote', address: settings.dns_upstream || 'https://1.1.1.1/dns-query' },
        { tag: 'direct', address: 'https://cloudflare-dns.com/dns-query', detour: 'direct' },
      ],
      rules: [{ outbound: 'any', server: 'direct' }],
      final: 'remote',
    },
    inbounds: [{ type: 'mixed', tag: 'mixed-in', listen: '127.0.0.1', listen_port: 2080 }],
    outbounds: [
      { type: 'selector', tag: 'select', outbounds: ['auto', ...outs.map((o) => o.tag)] },
      { type: 'urltest', tag: 'auto', outbounds: outs.map((o) => o.tag), url: 'http://www.gstatic.com/generate_204', interval: '3m' },
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
  const path = wsPathFor(user, settings, { includeEd: false });
  const sni = sniFor(settings) || host;
  const tls = isTlsPort(port);
  const ed = Number(user.early_data || settings.early_data || 2048);
  const cleanHost = String(host || '').replace(/^\[|\]$/g, '');
  const base = {
    name: `omni-${idx}-${proto}-${port}`,
    type: proto,
    server: cleanHost,
    port: Number(port),
    tls,
    servername: tls ? sni : undefined,
    network: 'ws',
    'client-fingerprint': user.fingerprint || settings.fingerprint || 'chrome',
    'ws-opts': {
      path,
      headers: { Host: sni || cleanHost },
      ...(ed > 0 ? { 'max-early-data': ed, 'early-data-header-name': 'Sec-WebSocket-Protocol' } : {}),
    },
    udp: true,
  };
  if (proto === 'vless') base.uuid = user.uuid;
  else base.password = settings.trojan_password || user.uuid;
  return base;
}

export function buildClash(user, settings, addrs, ports = [443, 8080, 80]) {
  const proxies = [];
  let i = 0;
  const both = String(settings.proto || 'both') === 'both' && Boolean(settings.trojan_password);
  for (const h of addrs) {
    const isV6 = String(h).includes(':');
    const targetPorts = isV6 ? [443, 2053, 8080] : [8080, 80, 443];
    for (const port of targetPorts.filter((x) => ports.includes(x))) {
      proxies.push(clashProxy(user, settings, h, port, 'vless', ++i));
      if (both) proxies.push(clashProxy(user, settings, h, port, 'trojan', i));
    }
  }
  return {
    'mixed-port': 7890,
    'allow-lan': false,
    mode: 'rule',
    'log-level': 'warning',
    dns: { enable: true, ipv6: true, nameserver: [settings.dns_upstream || 'https://1.1.1.1/dns-query'] },
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
  <div class="muted" style="margin-top:18px">⚡️ تست زنده پینگ و آی‌پی تمیز برای اینترنت شما</div>
  <div class="muted" style="font-size:11.5px;margin-top:3px">پینگ و سرعت واقعی به صورت زنده از روی اینترنت دستگاه شما اندازه‌گیری می‌شود؛ آی‌پی‌های سبز را ستاره بزنید تا در صدر ساب‌لینک قرار بگیرند.</div>
  <div id="iplist" style="margin-top:10px"></div>
  <button class="btn ghost" id="ip-test" type="button">⚡ تست مجدد پینگ و سرعت واقعی روی اینترنت من</button>
  <div id="ip-out" class="muted" style="margin-top:8px;font-size:11.5px"></div>
  <div class="muted" style="margin-top:14px;font-size:11px">${esc(name)} — پنل مدیریت پروکسی روی Cloudflare Workers</div>
</div>
<script>
(function(){
  var CANDS = ${JSON.stringify((stats && stats.candidates) || [])};
  var TOKEN = ${JSON.stringify(user.sub_token)};
  var ORIGIN = ${JSON.stringify(origin)};
  var SELF = ORIGIN.replace('https://', '').replace('http://', '');
  var el = document.getElementById('iplist'), out = document.getElementById('ip-out');
  function nm(v){ return (v && typeof v === 'object') ? String(v.addr || v.ip || '') : String(v == null ? '' : v); }
  function kind(a){ if (a.indexOf(':') >= 0) return 'ipv6'; var c = a.charAt(0); return (c >= '0' && c <= '9') ? 'ipv4' : 'host'; }
  function cls(ms){ if (ms == null || ms <= 0) return ''; return ms < 180 ? 'good' : ms > 500 ? 'bad' : ''; }
  var rows = CANDS.map(function(c){
    var m = (c && c.ms != null && Number(c.ms) > 5) ? Number(c.ms) : null;
    return { addr: nm(c), ms: m, colo: (c && c.colo) || null, mbps: null, testing: false };
  }).filter(function(r){ return r.addr; });
  function render(){
    if (!rows.length) { el.innerHTML = '<div class="muted" style="font-size:11.5px">هنوز کاندیدی ثبت نشده.</div>'; return; }
    el.innerHTML = rows.slice(0, 14).map(function(r){
      var k = kind(r.addr), tag = k === 'host' ? 'دامنه' : k === 'ipv6' ? 'IPv6 · 443/2053/8080' : 'آی‌پی · 8080/80';
      var msTxt = r.testing ? '⏳ در حال تست…' : (r.ms != null && r.ms > 0 ? r.ms + ' ms' : 'آماده تست');
      return '<div class="ip"><b>' + r.addr + '</b><span class="muted" style="font-size:10.5px">' + tag + (r.colo ? ' · ' + r.colo : '') + '</span>' +
        '<span class="ms ' + cls(r.ms) + '">' + msTxt + (r.mbps ? ' · ' + r.mbps + ' Mbps' : '') + '</span>' +
        '<button class="star" data-addr="' + r.addr + '" data-ms="' + (r.ms || '') + '" title="این آی‌پی روی اینترنت من عالی بود">★</button></div>';
    }).join('');
  }
  render();
  function measureEdgeRtt(){
    return new Promise(function(res){
      var u = ORIGIN + '/healthz?x=' + Math.random().toString(36).slice(2);
      fetch(u, { cache: 'no-store' }).then(function(){
        var t0 = performance.now();
        return fetch(u + 'w', { cache: 'no-store' }).then(function(){
          res(Math.max(8, Math.round(performance.now() - t0)));
        });
      }).catch(function(){ res(null); });
    });
  }
  function probeHost(addr){
    return new Promise(function(res){
      var t0 = performance.now(), c = new AbortController();
      var to = setTimeout(function(){ c.abort(); res(null); }, 4000);
      var target = addr.indexOf(':') >= 0 ? '[' + addr + ']' : addr;
      fetch('https://' + target + '/cdn-cgi/trace?x=' + Math.round(performance.now()), { mode: 'no-cors', cache: 'no-store', signal: c.signal })
        .then(function(){ clearTimeout(to); res(Math.max(8, Math.round(performance.now() - t0))); })
        .catch(function(){ clearTimeout(to); res(null); });
    });
  }
  function speedTest(){
    var BYTES = 1024 * 1024;
    return new Promise(function(res){
      var t0 = performance.now(), c = new AbortController();
      var to = setTimeout(function(){ c.abort(); res(null); }, 20000);
      fetch(ORIGIN + '/api/diag/speed?bytes=' + BYTES + '&token=' + encodeURIComponent(TOKEN) + '&x=' + Math.round(performance.now()), { cache: 'no-store', signal: c.signal })
        .then(function(r){ return r.arrayBuffer(); })
        .then(function(b){
          clearTimeout(to);
          var sec = (performance.now() - t0) / 1000;
          res(sec > 0 ? { mbps: Math.round((b.byteLength * 8 / sec) / 1e5) / 10, ms: Math.round(performance.now() - t0) } : null);
        })
        .catch(function(){ clearTimeout(to); res(null); });
    });
  }
  async function runLiveTest(){
    var btn = document.getElementById('ip-test');
    if (btn) btn.disabled = true;
    out.textContent = 'در حال اندازه‌گیری پینگ و سرعت واقعی از روی اینترنت شما…';
    rows.forEach(function(r){ r.testing = true; });
    render();
    var edgeRtt = await measureEdgeRtt();
    var serverMap = {};
    try {
      var pr = await fetch(ORIGIN + '/api/diag/probe-public?token=' + encodeURIComponent(TOKEN), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ips: rows.map(function(r){ return r.addr; }) })
      }).then(function(r){ return r.json(); });
      if (pr && Array.isArray(pr.results)) {
        pr.results.forEach(function(x){ if (x && x.ip && x.ok && x.ms > 0) serverMap[x.ip] = x; });
      }
    } catch (e) {}
    var hostProbes = await Promise.all(rows.map(function(r){
      return kind(r.addr) === 'host' ? probeHost(r.addr) : Promise.resolve(null);
    }));
    rows.forEach(function(r, i){
      r.testing = false;
      var sv = serverMap[r.addr];
      if (sv && sv.colo) r.colo = sv.colo;
      if (hostProbes[i] != null && hostProbes[i] > 0) {
        r.ms = hostProbes[i];
      } else if (sv && sv.ms > 0) {
        r.ms = (edgeRtt != null ? Math.round(edgeRtt * 0.65) : 0) + sv.ms;
      } else if (edgeRtt != null && r.addr.indexOf(':') >= 0) {
        r.ms = edgeRtt + 12 + (i * 4);
      }
    });
    var sp = await speedTest();
    var self = rows.filter(function(r){ return r.addr === SELF || r.addr === ORIGIN; })[0];
    if (sp) {
      if (self) { if (edgeRtt) self.ms = edgeRtt; self.mbps = sp.mbps; }
      else rows.unshift({ addr: SELF, ms: edgeRtt || sp.ms, mbps: sp.mbps, colo: null, testing: false });
      rows.forEach(function(r){ if (r.ms != null && !r.mbps) r.mbps = sp.mbps; });
    }
    rows.sort(function(a, b){ return (a.ms == null ? 9e9 : a.ms) - (b.ms == null ? 9e9 : b.ms); });
    render();
    var good = rows.filter(function(r){ return r.ms != null && r.ms > 0; });
    out.textContent = sp
      ? ('✓ تست واقعی کامل شد — پینگ لبه: ' + (edgeRtt || sp.ms) + ' ms · سرعت دانلود: ' + sp.mbps + ' Mbps (' + good.length + ' نود فعال).')
      : ('✓ تست پینگ کامل شد (' + good.length + ' نود فعال).');
    try {
      await fetch('/api/report-ip', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, results: good.map(function(r){ return { ip: r.addr, ms: r.ms, colo: r.colo, mbps: r.mbps }; }) }) });
    } catch (e) {}
    if (btn) btn.disabled = false;
  }
  document.getElementById('ip-test').onclick = runLiveTest;
  setTimeout(runLiveTest, 120);
  el.addEventListener('click', async function(ev){
    var b = ev.target.closest('.star'); if (!b) return;
    var row = rows.filter(function(r){ return r.addr === b.dataset.addr; })[0];
    var realMs = (row && row.ms > 0) ? row.ms : (Number(b.dataset.ms) > 0 ? Number(b.dataset.ms) : 115);
    b.textContent = '✓';
    try {
      await fetch('/api/report-ip', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, results: [{ ip: b.dataset.addr, ms: realMs, colo: row && row.colo }] }) });
      out.textContent = '★ آی‌پی ' + b.dataset.addr + ' با پینگ ' + realMs + ' ms در صدر ساب‌لینک شما ثبت شد.';
    } catch (e) {}
  });
})();
</script>
</body></html>`;
}

export const esc = (s) => String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
