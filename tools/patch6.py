#!/usr/bin/env python3
"""Omni patch6 — کانفیگ‌سازی به سبک پنل کارکرده:
   گروه «دامنه» (دامنه‌های معروف کلودفلر) + گروه IPv6 + جفت‌های اثبات‌شده + IPv4،
   همه روی ۴۴۳ اول، بدون فرگمنت، با برچسب دسته در نام کانفیگ."""
import io

# ── ۱) scan.js: فهرست دامنه‌های معروف کلودفلر ────────────────────────────────
s = io.open('src/scan.js', encoding='utf-8').read()
anchor = 'export const IPV6_SEEDS = ['
add = '''/** دامنه‌های شاخص و پرترافیک روی کلودفلر — به‌عنوان «آدرس» در کانفیگ می‌آیند:
 *  کلاینت به آی‌پی همین دامنه وصل می‌شود (آی‌پی‌هایی که اپراتور بسته‌شان نیست)
 *  ولی SNI و هدر Host همیشه دامنه‌ی خودِ پنل است. */
export const CF_DOMAINS = [
  'www.speedtest.net', 'speed.cloudflare.com', 'www.wto.org',
  'cdnjs.cloudflare.com', 'www.cloudflare.com', 'cp.cloudflare.com',
];

'''
if 'CF_DOMAINS' not in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open('src/scan.js', 'w', encoding='utf-8').write(s)
    print('  ✔  src/scan.js  (CF_DOMAINS)')

# ── ۲) links.js ─────────────────────────────────────────────────────────────
s = io.open('src/links.js', encoding='utf-8').read()

s = s.replace("import { IPV6_SEEDS } from './scan.js';", "import { IPV6_SEEDS, CF_DOMAINS } from './scan.js';", 1)

# الف) addressesFor → configPool + addressesFor
i = s.index('export function addressesFor(')
j = s.index('const encHost = (h) =>')
new_pool = '''/** استخر آدرس‌ها در سه سبد، مثل پنل کارکرده: دامنه / IPv6 / آی‌پی.
 *  دامنه = دامنه‌ی معروف کلودفلر (آی‌پی‌اش معمولاً باز است)
 *  IPv6 = آدرس‌های IPv6 کلودفلر (در ایران اغلب تمیزترین راه)
 *  آی‌پی = آی‌پی‌های سفارشی کاربر، تأییدشده‌ها، دامنه‌ی پنل و در آخر حدس‌ها */
export function configPool(user, settings, cleanIps = []) {
  const norm = (cleanIps || [])
    .map((r) => (typeof r === 'string' ? { ip: r, hits: 0, ms: null } : r))
    .filter((r) => r && r.ip);
  const byMs = (a, b) => (a.ms ?? 9999) - (b.ms ?? 9999);
  const verified = norm.filter((r) => Number(r.hits || 0) > 0).sort(byMs).map((r) => r.ip);
  const guessed = norm.filter((r) => !(Number(r.hits || 0) > 0)).sort(byMs).map((r) => r.ip);
  const host = sniFor(settings);
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];

  const domain = (safeArray(settings.address_domains).length
    ? safeArray(settings.address_domains)
    : CF_DOMAINS).slice(0, 4);
  const ipv6 = String(settings.ipv6_enabled || '1') === '1'
    ? (safeArray(settings.ipv6_pool).length ? safeArray(settings.ipv6_pool) : IPV6_SEEDS).slice(0, 3)
    : [];
  const ip = uniq([...safeArray(user?.ips), ...verified, host, ...guessed]);

  return { domain, ipv6, ip, host, verified, guessed };
}

/** آدرس‌ها به ترتیب اولویت (برای sing-box/clash و فهرست‌های ساده) */
export function addressesFor(user, settings, cleanIps = [], { limit = 8 } = {}) {
  const p = configPool(user, settings, cleanIps);
  return [...new Set([...p.domain.slice(0, 2), ...p.ipv6.slice(0, 2), ...p.ip.slice(0, 5)])].slice(0, limit);
}

'''
s = s[:i] + new_pool + s[j:]

# ب) vlessUri/trojanUri: برچسب دسته در نام کانفیگ
s = s.replace("export function vlessUri(user, settings, host, { index = 1, port = 443 } = {}) {",
              "export function vlessUri(user, settings, host, { index = 1, port = 443, cat = 'Global' } = {}) {", 1)
s = s.replace("export function trojanUri(user, settings, host, { index = 1, port = 443 } = {}) {",
              "export function trojanUri(user, settings, host, { index = 1, port = 443, cat = 'Global' } = {}) {", 1)
s = s.replace("const remark = `${settings.remark_prefix || ''}${user.username} · 🌐 Global · VLESS · ${port} · #${String(index).padStart(2, '0')}`;",
              "const remark = `${settings.remark_prefix || ''}${user.username} · 🌐 ${cat} · VLESS · ${port} · #${String(index).padStart(2, '0')}`;", 1)
s = s.replace("const remark = `${settings.remark_prefix || ''}${user.username} · 🌐 Global · TROJAN · ${port} · #${String(index).padStart(2, '0')}`;",
              "const remark = `${settings.remark_prefix || ''}${user.username} · 🌐 ${cat} · TROJAN · ${port} · #${String(index).padStart(2, '0')}`;", 1)

# ج) buildConfigs → گروه‌بندی‌شده
i = s.index('export function buildConfigs(')
j = s.index('/* ─────────────── sing-box / clash ─────────────── */')
new_bc = '''export function buildConfigs(user, settings, cleanIps = []) {
  const maxConfigs = Math.max(6, Math.min(60, Number(settings.config_count || 30)));
  const pool = configPool(user, settings, cleanIps);
  const pairs = verifiedPairs(settings);                       // «ip:port» اثبات‌شده با هندشیک واقعی
  const pairPort = (pr) => Number(pr.slice(pr.lastIndexOf(':') + 1));
  const tlsPairs = pairs.filter((pr) => isTlsPort(pairPort(pr)));
  const plainPairs = pairs.filter((pr) => !isTlsPort(pairPort(pr)));
  const ports = choosePorts(settings, 4);
  const extraPorts = ports.filter((p) => p !== 443);

  /* برنامه‌ی کانفیگ — مثل پنل کارکرده: هر گروه با آدرس‌های خودش، ۴۴۳ اول.
     ۱) Domain  : دامنه‌ی معروف کلودفلر (آی‌پی‌اش معمولاً در ایران باز است)
     ۲) IPv6    : آدرس‌های IPv6 کلودفلر
     ۳) Clean   : جفت‌های اثبات‌شده با هندشیک واقعی (اول TLS)
     ۴) IPv4    : آی‌پی‌های تأییدشده/سفارشی کاربر و دامنه‌ی پنل
     ۵) Alt     : پورت‌های جایگزین (۲۰۵۳/۸۴۴۳/…) روی بهترین آدرس‌ها */
  const plan = [];
  const seen = new Set();
  const add = (address, port, cat) => {
    if (!address || seen.has(`${address}:${port}`)) return;
    seen.add(`${address}:${port}`);
    plan.push({ address, port: Number(port), cat });
  };
  pool.domain.slice(0, 3).forEach((d) => add(d, 443, 'Domain'));
  pool.ipv6.slice(0, 2).forEach((v) => add(v, 443, 'IPv6'));
  tlsPairs.slice(0, 6).forEach((pr) => add(pr.slice(0, pr.lastIndexOf(':')), pairPort(pr), 'Clean'));
  pool.ip.slice(0, 3).forEach((ip) => add(ip, 443, 'IPv4'));
  plainPairs.slice(0, 2).forEach((pr) => add(pr.slice(0, pr.lastIndexOf(':')), pairPort(pr), 'Clean'));
  const rotate = [pool.domain[0], pool.ipv6[0], pool.ip[0], pool.domain[1]].filter(Boolean);
  extraPorts.forEach((p, i) => add(rotate[i % rotate.length], p, 'Alt'));

  const both = String(settings.proto || 'both') === 'both' && Boolean(settings.trojan_password);
  const uris = [];
  const items = [];
  const emit = ({ address, port, cat }) => {
    for (const proto of both ? ['vless', 'trojan'] : ['vless']) {
      if (uris.length >= maxConfigs) return;
      const n = uris.length + 1;
      const label = String(n).padStart(2, '0');
      const remark = `${user.username} · 🌐 ${cat} · ${proto === 'vless' ? 'VLESS' : 'TROJAN'} · ${port} · #${label}`;
      uris.push(proto === 'vless'
        ? vlessUri(user, settings, address, { index: n, port, cat })
        : trojanUri(user, settings, address, { index: n, port, cat }));
      items.push({ address, port, proto, cat, remark });
    }
  };
  plan.forEach(emit);

  // پرکردن باقیمانده تا سقف: آدرس × پورت‌های دیگر (تنوع برای عبور از فیلتر)
  if (uris.length < maxConfigs) {
    const addrs = [...new Set([...pool.ip, ...pool.domain, ...pool.ipv6])];
    outer:
    for (const port of ports) {
      for (const a of addrs) {
        if (uris.length >= maxConfigs) break outer;
        const key = `${a}:${port}`;
        if (seen.has(key)) continue;
        seen.add(key);
        emit({ address: a, port, cat: isTlsPort(port) ? 'Alt' : 'Plain' });
      }
    }
  }

  return {
    uris,
    items,
    host: pool.host || pool.domain[0] || '',
    addresses: [...new Set(items.map((x) => x.address))],
    ports,
    verified: pairs.length,
    singbox: buildSingbox(user, settings, [...new Set(items.map((x) => x.address))], ports),
    clash: buildClash(user, settings, [...new Set(items.map((x) => x.address))], ports),
  };
}

'''
s = s[:i] + new_bc + s[j:]
io.open('src/links.js', 'w', encoding='utf-8').write(s)
print('  ✔  src/links.js  (configPool + buildConfigs گروه‌بندی‌شده)')

# ── ۳) api.js: address_domains در فهرست مجاز تنظیمات ───────────────────────
s = io.open('src/api.js', encoding='utf-8').read()
if 'address_domains' not in s:
    s = s.replace("'trojan_password', 'ports_mode', 'ports_custom', 'config_count', 'ipv6_enabled', 'ipv6_pool', 'verified_pairs'];",
                  "'trojan_password', 'ports_mode', 'ports_custom', 'config_count', 'ipv6_enabled', 'ipv6_pool', 'verified_pairs', 'address_domains'];", 1)
    io.open('src/api.js', 'w', encoding='utf-8').write(s)
    print('  ✔  src/api.js  (address_domains)')
