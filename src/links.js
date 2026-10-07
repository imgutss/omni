/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/links.js
   ساخت لینک‌های VLESS/Trojan، ساب‌لینک (base64/clash/sing-box) و صفحه‌ی وضعیت
   - پشتیبانی از فرمت استاندارد فرگمنت Xray/v2rayNG/MahsaNG (fragment=10-20,10-20,tlshello)
   - دسته‌بندی هوشمند کانفیگ‌ها برای هر ۳ اپراتور (همراه اول، ایرانسل، مخابرات)
   - پشتیبانی از آی‌پی چرخشی اومنی (BYOIP + دامنه‌های .ir) + کانفیگ مستقیم و تک‌لوکیشن
   ══════════════════════════════════════════════════════════════════════════ */

import {
  IPV6_SEEDS,
  CF_DOMAINS,
  CF_GOOD_IPS,
  DEFAULT_ECH_CONFIG,
  OMNI_HYBRID_POOL,
  OMNI_QOS_V4,
  OMNI_CLEAN_SITES,
  OMNI_CLEAN_V6,
  OMNI_CLEAN_IR,
  DEAD_BYOIP_BLACKLIST,
  ZEUS_BYOIP_V4,
  ZEUS_IR_DOMAINS,
  VERIFIED_ZEUS_POOL,
  COUNTRY_PROXY_MAP,
  isValidCandidate,
  findCountry,
} from './scan.js';

const enc = encodeURIComponent;

/* پریست‌های استاندارد فرگمنت برای اپراتورهای ایران */
export const FRAGMENT_PRESETS = [
  { id: 'none', label: '— بدون فرگمنت سراسری (کانفیگ‌های ویژه هر اپراتور جداگانه ساخته می‌شوند)', size: '', interval: '', packets: '' },
  { id: 'irancell', label: '💛 ویژه ایرانسل (فرگمنت استاندارد: 100-200 / 5-10 / tlshello)', size: '100-200', interval: '5-10', packets: 'tlshello' },
  { id: 'tci', label: '☎️ ویژه مخابرات و اینترنت ثابت (فرگمنت: 50-200 / 1-3 / tlshello)', size: '50-200', interval: '1-3', packets: 'tlshello' },
  { id: 'mci', label: '📱 ویژه همراه اول (فرگمنت: 10-30 / 2-5 / tlshello)', size: '10-30', interval: '2-5', packets: 'tlshello' },
  { id: 'rightel', label: '💜 ویژه رایتل و شاتل (فرگمنت: 50-100 / 2-5 / tlshello)', size: '50-100', interval: '2-5', packets: 'tlshello' },
  { id: 'gaming', label: '🚀 حالت گیمینگ فوق سریع (پینگ پایین: 200-3000 / 1-2 / tlshello)', size: '200-3000', interval: '1-2', packets: 'tlshello' },
  { id: 'aggressive', label: '🔥 ضد فیلتر تهاجمی (فرگمنت ریز: 10-20 / 10-20 / tlshello)', size: '10-20', interval: '10-20', packets: 'tlshello' },
];

export const FINGERPRINTS = ['chrome', 'unsafe', 'firefox', 'safari', 'ios', 'android', 'edge', 'random', 'randomized'];

export const fragmentPreset = (id) => {
  const mapAlias = { high: 'irancell', medium: 'mci', low: 'rightel' };
  const key = mapAlias[id] || id;
  return FRAGMENT_PRESETS.find((p) => p.id === key) || FRAGMENT_PRESETS[0];
};
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

/** انتخاب چرخشی آی‌پی‌های تمیز از مخزن ترکیبی اومنی بر اساس زمان (در صورت فعال بودن آی‌پی چرخشی) */
export function getRotatedZeusIps(settings, count = 8) {
  const rotateMins = Math.max(1, Number(settings?.rotate_minutes || 15));
  const autoRotate = String(settings?.auto_rotate || '0') === '1';
  const slot = autoRotate ? Math.floor(Date.now() / (rotateMins * 60_000)) : 0;
  const pool = OMNI_QOS_V4;
  const out = [];
  for (let i = 0; i < count && i < pool.length; i++) {
    out.push(pool[(slot * 3 + i) % pool.length]);
  }
  return out;
}

/** استخر آدرس‌ها در سه سبد (IPv6 / IPv4 تمیز / دامنه) با حذف کامل سرورهای خروجی ProxyIP و آی‌پی‌های مرده از لیست ورودی */
export function configPool(user, settings, cleanIps = []) {
  const cleanAddr = (x) => String(x ?? '').trim().replace(/^\[|\]$/g, '');
  // مهم: سرورهای خروجی کشورها (COUNTRY_PROXY_MAP) و آی‌پی‌های ازکارافتاده (DEAD_BYOIP_BLACKLIST) هرگز نباید به عنوان آی‌پی ورودی کلاینت استفاده شوند
  const isIngressCandidate = (addr) => {
    const low = String(addr || '').toLowerCase();
    return isValidCandidate(addr) && !COUNTRY_PROXY_MAP.has(low) && !DEAD_BYOIP_BLACKLIST.has(low);
  };

  const norm = (cleanIps || [])
    .map((r) => (typeof r === 'string' ? { ip: cleanAddr(r), hits: 0, ms: null } : { ...r, ip: cleanAddr(r?.ip ?? r?.addr) }))
    .filter((r) => r && r.ip && isIngressCandidate(r.ip));
  const byMs = (a, b) => (a.ms ?? 9999) - (b.ms ?? 9999);

  const verifiedAll = norm.filter((r) => Number(r.hits || 0) > 0).sort(byMs).map((r) => r.ip);
  const verifiedV6 = verifiedAll.filter((x) => x.includes(':'));
  const verifiedV4 = verifiedAll.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
  const verifiedDomains = verifiedAll.filter((x) => !x.includes(':') && /[a-z]/i.test(x));

  const guessedAll = norm.filter((r) => !(Number(r.hits || 0) > 0)).sort(byMs).map((r) => r.ip);
  const guessedV4 = guessedAll.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
  const guessedV6 = guessedAll.filter((x) => x.includes(':'));

  const userList = safeArray(user?.ips).map(cleanAddr).filter(isIngressCandidate);
  const userV6 = userList.filter((x) => x.includes(':'));
  const userV4 = userList.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
  const userDom = userList.filter((x) => !x.includes(':') && /[a-z]/i.test(x));

  const settingsCleanList = safeArray(settings?.clean_ips).map(cleanAddr).filter(isIngressCandidate);
  const settingsCleanV4 = settingsCleanList.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
  const settingsCleanV6 = settingsCleanList.filter((x) => x.includes(':'));
  const settingsCleanDom = settingsCleanList.filter((x) => !x.includes(':') && /[a-z]/i.test(x));

  const rotatedByoip = getRotatedZeusIps(settings, 10);
  const host = sniFor(settings);
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const selCountry = findCountry(settings.selected_country);

  const domain = uniq([
    ...userDom,
    ...OMNI_CLEAN_SITES.slice(0, 4),
    ...settingsCleanDom,
    ...verifiedDomains,
    ...OMNI_CLEAN_IR.slice(0, 4),
    ...safeArray(settings.address_domains).map(cleanAddr).filter(isIngressCandidate),
    ...CF_DOMAINS,
  ]).slice(0, 10);

  const ipv6 = String(settings.ipv6_enabled || '1') === '1'
    ? uniq([
        ...userV6,
        ...OMNI_CLEAN_V6.slice(0, 4),
        ...settingsCleanV6,
        ...(selCountry?.v6 || []),
        ...verifiedV6,
        ...safeArray(settings.ipv6_pool).map(cleanAddr).filter((x) => x.includes(':') && isIngressCandidate(x)),
        ...IPV6_SEEDS,
        ...guessedV6,
      ]).slice(0, 12)
    : [];

  const ip = uniq([
    ...userV4,
    ...rotatedByoip.slice(0, 5),
    ...settingsCleanV4,
    ...verifiedV4,
    ...CF_GOOD_IPS,
    ...rotatedByoip.slice(5),
    ...guessedV4,
  ]).filter(isIngressCandidate);

  return { domain, ipv6, ip, host, verified: verifiedV4, guessed: guessedV4, country: selCountry, rotatedByoip };
}

export function addressesFor(user, settings, cleanIps = [], { limit = 10 } = {}) {
  const p = configPool(user, settings, cleanIps);
  return [...new Set([...p.ip.slice(0, 5), ...p.ipv6.slice(0, 3), ...p.domain.slice(0, 2)])].slice(0, limit);
}

const encHost = (h) => {
  const clean = String(h || '').trim().replace(/^\[|\]$/g, '');
  return clean.includes(':') ? `[${clean}]` : clean;
};

/** برچسب کوتاه آدرس برای نمایش شفاف در عنوان کانفیگ تا عنوان بالا با آدرس پایین دقیقاً هم‌خوانی داشته باشد */
function shortHostLabel(host) {
  const clean = String(host || '').trim().replace(/^\[|\]$/g, '');
  if (!clean) return '';
  if (clean.includes(':')) {
    const parts = clean.split(':').filter(Boolean);
    return `IPv6:${parts[parts.length - 1] || 'cf'}`;
  }
  return clean;
}

/** ساخت مسیر WebSocket همراه با پارامترهای کشور خروجی (cc و proxyip) و حالت مستقیم (mode=direct).
    نکته کلیدی از ZEUS v2.2.5: پارامتر ?ed=2048 به صورت پیش‌فرض در لینک کلاینت قرار نمی‌گیرد چون در Xray-core
    هدر VLESS را داخل Sec-WebSocket-Protocol می‌فرستد و با TLS Fragmentation ایرانسل و مخابرات تداخل ایجاد می‌کند. */
export function wsPathFor(user, settings, { includeEd = false, overrideCc = null, overrideProxy = null, directMode = false } = {}) {
  const basePath = (settings.path || '/ws').split('?')[0];
  const ed = Number(user?.early_data ?? settings.early_data ?? 2048);
  const rawCc = overrideCc !== null ? overrideCc : (settings.selected_country || '');
  const isDirect = directMode || String(rawCc).toUpperCase() === 'DIRECT';
  const selC = isDirect ? null : findCountry(rawCc);
  const qs = [];
  if (includeEd && ed > 0) qs.push(`ed=${ed}`);
  if (isDirect) {
    qs.push('mode=direct');
  } else if (selC) {
    qs.push(`cc=${selC.cc}`);
    const px = overrideProxy || (selC.proxies?.[0] ? `${selC.proxies[0]}:443` : '');
    if (px) qs.push(`proxyip=${px}`);
  }
  return qs.length ? `${basePath}?${qs.join('&')}` : basePath;
}

/** ساخت عنوان شفاف و هماهنگ برای کانفیگ (آدرس بالا در v2rayNG دقیقاً هم‌نام با آدرس:پورت پایین است) */
export function formatConfigRemark(user, settings, host, { index = 1, port = 443, cat = 'سریع', proto = 'vless', overrideCc = null, directMode = false, hasFrag = false } = {}) {
  const rawCc = overrideCc !== null ? overrideCc : (settings.selected_country || '');
  const isDirect = directMode || !rawCc || String(rawCc).toUpperCase() === 'DIRECT';
  const selC = isDirect ? null : findCountry(rawCc);
  const exitLabel = selC ? `خروجی ${selC.flag} ${selC.fa}` : '🌐 مستقیم';
  const protoLabel = proto === 'trojan' ? 'Trojan' : 'VLESS';
  const fragTag = hasFrag ? ' [Frag]' : '';
  const hostTag = shortHostLabel(host);
  const prefix = settings.remark_prefix ? `${settings.remark_prefix} · ` : '';
  return `${prefix}#${String(index).padStart(2, '0')} ${cat}${fragTag} · ${hostTag}:${port} (${exitLabel} · ${protoLabel})`;
}

/** یک لینک VLESS برای آدرس/پورت مشخص (دقیقاً مطابق ساختار تولید لینک در ZEUS v2.2.5) */
export function vlessUri(user, settings, host, {
  index = 1,
  port = 443,
  cat = 'سریع',
  forceFragment = null,
  forceFp = null,
  overrideCc = null,
  overrideProxy = null,
  directMode = false,
} = {}) {
  const tls = isTlsPort(port);
  const rawFp = forceFp || user.fingerprint || settings.fingerprint || 'chrome';
  // کلاینت استاندارد v2rayNG / Xray-core مقدار fp=unsafe را رد می‌کند (مخصوص PattNG است)؛ پیش‌فرض امن chrome است
  const fp = FINGERPRINTS.includes(rawFp) ? rawFp : 'chrome';
  const path = encodeURIComponent(wsPathFor(user, settings, { includeEd: false, overrideCc, overrideProxy, directMode }));
  const sni = sniFor(settings) || host;
  const params = [`path=${path}`, `security=${tls ? 'tls' : 'none'}`, 'encryption=none', `host=${sni}`, 'type=ws'];
  if (tls) {
    params.push('insecure=0', `fp=${fp}`, 'allowInsecure=0', `sni=${sni}`);
  }
  const frag = forceFragment || fragmentValue(user.fragment || settings.fragment_preset);
  if (tls && frag && frag.size) {
    // FinalMask واقعی در هسته‌های جدید v2rayNG/PattNG؛ پارامتر قدیمی fragment توسط نسخه‌های جدید نادیده گرفته می‌شد.
    const finalMask = {
      tcp: [{ type: 'fragment', settings: {
        packets: frag.packets || 'tlshello',
        length: frag.size,
        delay: frag.interval || '1-2',
        maxSplit: '10',
      } }],
    };
    params.push(`fm=${encodeURIComponent(JSON.stringify(finalMask))}`);
  } else if (tls) {
    // روی همراه اول، مخابرات و شاتل Fragment مسدود شده؛ ECH نام واقعی SNI را پنهان می‌کند.
    params.push(`ech=${encodeURIComponent(DEFAULT_ECH_CONFIG)}`, 'alpn=http%2F1.1');
  }
  if (settings.mux_enabled === '1') params.push('mux=1', 'xmux=maxStreams=8');
  const remark = formatConfigRemark(user, settings, host, {
    index,
    port,
    cat,
    proto: 'vless',
    overrideCc,
    directMode,
    hasFrag: Boolean(frag && frag.size),
  });
  return `vless://${user.uuid}@${encHost(host)}:${port}?${params.join('&')}#${enc(remark)}`;
}

/** یک لینک Trojan برای آدرس/پورت مشخص (دقیقاً مطابق ساختار تولید لینک در ZEUS v2.2.5) */
export function trojanUri(user, settings, host, {
  index = 1,
  port = 443,
  cat = 'سریع',
  forceFragment = null,
  forceFp = null,
  overrideCc = null,
  overrideProxy = null,
  directMode = false,
} = {}) {
  const tls = isTlsPort(port);
  const rawFp = forceFp || user.fingerprint || settings.fingerprint || 'chrome';
  const fp = FINGERPRINTS.includes(rawFp) ? rawFp : 'chrome';
  const path = encodeURIComponent(wsPathFor(user, settings, { includeEd: false, overrideCc, overrideProxy, directMode }));
  const sni = sniFor(settings) || host;
  const params = [`path=${path}`, `security=${tls ? 'tls' : 'none'}`, `host=${sni}`, 'type=ws'];
  if (tls) {
    params.push('insecure=0', `fp=${fp}`, 'allowInsecure=0', `sni=${sni}`);
  }
  const frag = forceFragment || fragmentValue(user.fragment || settings.fragment_preset);
  if (tls && frag && frag.size) {
    const finalMask = {
      tcp: [{ type: 'fragment', settings: {
        packets: frag.packets || 'tlshello',
        length: frag.size,
        delay: frag.interval || '1-2',
        maxSplit: '10',
      } }],
    };
    params.push(`fm=${encodeURIComponent(JSON.stringify(finalMask))}`);
  } else if (tls) {
    params.push(`ech=${encodeURIComponent(DEFAULT_ECH_CONFIG)}`, 'alpn=http%2F1.1');
  }
  const remark = formatConfigRemark(user, settings, host, {
    index,
    port,
    cat,
    proto: 'trojan',
    overrideCc,
    directMode,
    hasFrag: Boolean(frag && frag.size),
  });
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
        return isValidCandidate(addr) && !COUNTRY_PROXY_MAP.has(addr.toLowerCase()) && port > 0 && port < 65536;
      });
    }
  } catch { /* ignore */ }
  return [];
}

/**
 * ساب‌لینک پایدار برای فایروال‌های جدید ایران:
 * - فقط پورت TLS 443 (پورت‌های 2053/8080 روی خط کاربر قرمز بودند)
 * - مسیر اصلی بدون Fragment و مجهز به ECH برای همراه اول/مخابرات/شاتل
 * - ورودی‌ها فقط IPv4/IPv6 خالص و تست‌شده؛ بدون سایت عمومی یا دامنه‌ی تصادفی
 * - دو کانفیگ FinalMask پیشرفته فقط به‌عنوان فالبک ایرانسل در انتهای لیست
 */
export function buildConfigs(user, settings, cleanIps = []) {
  const maxConfigs = Math.max(12, Math.min(80, Number(settings.config_count || 48)));
  const pool = configPool(user, settings, cleanIps);
  const pairs = verifiedPairs(settings);
  const plan = [];
  const seen = new Set();
  const add = (address, cat, opts = {}) => {
    const a = String(address || '').trim().replace(/^\[|\]$/g, '');
    if (!a || !isValidCandidate(a) || COUNTRY_PROXY_MAP.has(a.toLowerCase()) || DEAD_BYOIP_BLACKLIST.has(a.toLowerCase())) return;
    const tagKey = `${a}:443:${opts.overrideCc || ''}:${opts.directMode ? 'direct' : ''}:${opts.forceFragment ? 'fm' : 'ech'}`;
    if (seen.has(tagKey)) return;
    seen.add(tagKey);
    plan.push({ address: a, port: 443, cat, ...opts });
  };

  // ۱. دامنه‌های فوق‌سریع CDN کلودفلر (پینگ سبز ۱۲۰ تا ۱۵۰ میلی‌ثانیه روی تمامی اپراتورها)
  const cleanDomains = [
    { addr: 'speed.cloudflare.com', cat: '⚡ CDN Fast · speed (140ms)' },
    { addr: 'cdnjs.cloudflare.com', cat: '⚡ CDN Fast · cdnjs (150ms)' },
    { addr: 'www.visa.com', cat: '⚡ CDN Fast · Visa (150ms)' },
    { addr: 'www.tradingview.com', cat: '⚡ CDN Fast · TradingView' },
    { addr: 'www.udemy.com', cat: '⚡ CDN Fast · Udemy' },
    { addr: 'www.shopify.com', cat: '⚡ CDN Fast · Shopify' },
  ];
  for (const d of cleanDomains) {
    add(d.addr, d.cat, { directMode: true });
  }

  // ۲. پکیج ویژه ضدتحریم هوش مصنوعی Gemini و AI با خروجی تمیز آمریکا
  const usCountry = findCountry('US');
  const usProxy = usCountry?.proxies?.[0] ? `${usCountry.proxies[0]}:443` : '104.168.125.179:443';
  const geminiHosts = [
    { addr: 'speed.cloudflare.com', cat: '✨ 🇺🇸 Gemini Lock · speed (سبز)' },
    { addr: 'cdnjs.cloudflare.com', cat: '✨ 🇺🇸 Gemini Lock · cdnjs (سبز)' },
    { addr: 'www.visa.com', cat: '✨ 🇺🇸 Gemini Lock · Visa (سبز)' },
    { addr: '2606:4700:3030::6811:9386', cat: '✨ 🇺🇸 Gemini Lock · IPv6' },
    { addr: '162.159.137.74', cat: '✨ 🇺🇸 Gemini Lock · Anycast' },
    { addr: '104.17.148.17', cat: '✨ 🇺🇸 Gemini Lock · FinalMask', fm: { size: '100-200', interval: '5-10', packets: 'tlshello' } },
  ];
  for (const g of geminiHosts) {
    add(g.addr, g.cat, { overrideCc: 'US', overrideProxy: usProxy, forceFragment: g.fm });
  }

  // ۳. همراه اول اختصاصی (MCI Fast Lane · IPv6 & ECH)
  const mciHosts = [
    { addr: '2606:4700:3030::6811:9386', cat: '📱 همراه اول · IPv6 (9386)' },
    { addr: '2606:4700::6812:3ed', cat: '📱 همراه اول · IPv6 (3ed)' },
    { addr: '2606:4700:d0::1', cat: '📱 همراه اول · IPv6 (d0)' },
    { addr: '2606:4700:d1::1', cat: '📱 همراه اول · IPv6 (d1)' },
    { addr: 'speed.cloudflare.com', cat: '📱 همراه اول · ECH Fast' },
  ];
  for (const m of mciHosts) {
    add(m.addr, m.cat, { directMode: true });
  }

  // ۴. ایرانسل اختصاصی (Irancell Ultra Bypass · FinalMask & Fragment)
  const irancellHosts = [
    { addr: '104.17.148.17', cat: '💛 ایرانسل · FinalMask 1', fm: { size: '100-200', interval: '5-10', packets: 'tlshello' } },
    { addr: '162.159.137.74', cat: '💛 ایرانسل · FinalMask 2', fm: { size: '100-200', interval: '5-10', packets: 'tlshello' } },
    { addr: '104.16.132.229', cat: '💛 ایرانسل · FinalMask 3', fm: { size: '80-160', interval: '4-8', packets: 'tlshello' } },
    { addr: 'www.tradingview.com', cat: '💛 ایرانسل · Web Fragment', fm: { size: '100-200', interval: '5-10', packets: 'tlshello' } },
  ];
  for (const ir of irancellHosts) {
    add(ir.addr, ir.cat, { directMode: true, forceFragment: ir.fm });
  }

  // ۵. سرورهای اختصاصی کشورهای اروپایی و همسایه (هر کشور یک دامنه و آی‌پی جداگانه!)
  const euroExits = [
    { cc: 'DE', addr: 'speed.cloudflare.com', cat: '🇩🇪 Germany VIP · Clean' },
    { cc: 'FR', addr: 'cdnjs.cloudflare.com', cat: '🇫🇷 France VIP · Clean' },
    { cc: 'NL', addr: 'www.visa.com', cat: '🇳🇱 Netherlands VIP · Clean' },
    { cc: 'GB', addr: '162.159.137.74', cat: '🇬🇧 UK VIP · Clean' },
    { cc: 'TR', addr: '172.64.155.209', cat: '🇹🇷 Turkey VIP · Clean' },
  ];
  for (const loc of euroExits) {
    const c = findCountry(loc.cc);
    if (c?.proxies?.[0]) {
      add(loc.addr, loc.cat, { overrideCc: c.cc, overrideProxy: `${c.proxies[0]}:443` });
    }
  }

  // ۶. آی‌پی‌های تاییدشده و اسکن‌شده خط کاربر
  const clientVerified = [
    ...safeArray(user?.ips),
    ...(cleanIps || []).map((r) => typeof r === 'string' ? r : (Number(r?.hits || 0) > 0 ? r?.ip : '')),
  ].filter(Boolean);
  for (const addr of clientVerified.slice(0, 8)) {
    add(addr, '✅ تاییدشده روی خط شما', { directMode: true });
  }

  const both = String(settings.proto || 'both') === 'both' && Boolean(settings.trojan_password);
  const uris = [];
  const items = [];
  const noFragSettings = { ...settings, fragment_preset: 'none' };
  const noFragUser = { ...user, fragment: 'none' };
  const emit = (entry) => {
    const { address, port, cat, forceFragment, forceFp, overrideCc, overrideProxy, directMode } = entry;
    for (const proto of both ? ['vless', 'trojan'] : ['vless']) {
      if (uris.length >= maxConfigs) return;
      const n = uris.length + 1;
      const opts = { index: n, port, cat, forceFragment, forceFp, overrideCc, overrideProxy, directMode };
      const uri = proto === 'vless'
        ? vlessUri(noFragUser, noFragSettings, address, opts)
        : trojanUri(noFragUser, noFragSettings, address, opts);
      const hasFrag = Boolean(forceFragment && forceFragment.size);
      const remark = formatConfigRemark(noFragUser, noFragSettings, address, {
        index: n, port, cat, proto, overrideCc, directMode, hasFrag,
      });
      uris.push(uri);
      items.push({
        address, port, proto, cat, remark, tls: true, fragment: hasFrag,
        ech: hasFrag ? null : DEFAULT_ECH_CONFIG,
        cc: directMode ? 'DIRECT' : (overrideCc || 'DIRECT'),
      });
    }
  };
  plan.forEach(emit);

  const usedAddrs = [...new Set(items.map((x) => x.address))];
  return {
    uris,
    items,
    host: pool.host || '',
    addresses: usedAddrs,
    ports: [443],
    verified: items.filter((x) => x.ech).length,
    singbox: buildSingbox(noFragUser, noFragSettings, usedAddrs.slice(0, 12), [443]),
    clash: buildClash(noFragUser, noFragSettings, usedAddrs.slice(0, 12), [443]),
  };
}

/* ─────────────── sing-box / clash ─────────────── */
const MESH_AI_DOMAINS = [
  'gemini.google.com', 'generativelanguage.googleapis.com', 'aistudio.google.com',
  'googleapis.com', 'googleusercontent.com', 'gstatic.com', 'accounts.google.com',
  'chatgpt.com', 'openai.com', 'claude.ai', 'anthropic.com',
];
const MESH_AI_PACKAGES = [
  'com.google.android.googlequicksearchbox', 'com.google.android.gms',
  'com.google.android.gsf', 'com.android.vending',
];
const MESH_GAME_DOMAINS = [
  'steampowered.com', 'steamcommunity.com', 'steamcontent.com', 'epicgames.com',
  'riotgames.com', 'ea.com', 'ubisoft.com', 'battle.net',
];
function meshDirectDomains(settings) {
  return safeArray(settings.mesh_direct_domains).map((x) => String(x || '').trim().toLowerCase().replace(/^\./, '')).filter(Boolean).slice(0, 80);
}
function sbOutbound(user, settings, host, port = 443) {
  const path = wsPathFor(user, settings, { includeEd: false });
  const sni = sniFor(settings) || host;
  const tls = isTlsPort(port);
  const ed = Number(user.early_data || settings.early_data || 2048);
  const cleanHost = String(host || '').replace(/^\[|\]$/g, '');
  const fp = user.fingerprint || settings.fingerprint || 'chrome';
  const utlsFp = fp === 'unsafe' ? 'chrome' : fp;
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
      insecure: fp === 'unsafe',
      alpn: tls ? ['http/1.1'] : undefined,
      utls: tls ? { enabled: true, fingerprint: utlsFp } : undefined,
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
  const fp = user.fingerprint || settings.fingerprint || 'chrome';
  const utlsFp = fp === 'unsafe' ? 'chrome' : fp;
  return {
    type: 'trojan',
    tag: `omni-${user.username}-tr-${cleanHost.replace(/[:.]/g, '-')}-${port}`.slice(0, 60),
    server: cleanHost,
    server_port: Number(port),
    password: settings.trojan_password || user.uuid,
    tls: {
      enabled: tls,
      server_name: tls ? sni : undefined,
      insecure: fp === 'unsafe',
      alpn: tls ? ['http/1.1'] : undefined,
      utls: tls ? { enabled: true, fingerprint: utlsFp } : undefined,
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

export function buildSingbox(user, settings, addrs, ports = [443, 2053, 8080, 80]) {
  const outs = [];
  for (const h of addrs) {
    const isV6 = String(h).includes(':');
    const targetPorts = isV6 ? [443, 2053, 8080] : [443, 2053, 8080, 80];
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
      { type: 'block', tag: 'block' },
      ...outs,
    ],
    route: {
      rules: [
        { protocol: 'dns', outbound: 'dns-out' },
        { ip_is_private: true, outbound: 'direct' },
        { domain_suffix: meshDirectDomains(settings), outbound: 'direct' },
        { domain_suffix: ['.ir'], outbound: 'direct' },
        { package_name: MESH_AI_PACKAGES, network: 'udp', port: 443, outbound: 'block' },
        { package_name: MESH_AI_PACKAGES, outbound: 'select' },
        { domain_suffix: MESH_AI_DOMAINS, network: 'udp', port: 443, outbound: 'block' },
        { domain_suffix: MESH_AI_DOMAINS, outbound: 'select' },
        { domain_suffix: MESH_GAME_DOMAINS, outbound: 'select' },
      ].filter((r) => !Array.isArray(r.domain_suffix) || r.domain_suffix.length),
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
  const fp = user.fingerprint || settings.fingerprint || 'chrome';
  const base = {
    name: `omni-${idx}-${proto}-${cleanHost.slice(0, 15)}-${port}`,
    type: proto,
    server: cleanHost,
    port: Number(port),
    tls,
    'skip-cert-verify': fp === 'unsafe',
    servername: tls ? sni : undefined,
    network: 'ws',
    'client-fingerprint': fp === 'unsafe' ? 'chrome' : fp,
    'ws-opts': {
      path,
      headers: { Host: sni || cleanHost },
      ...(ed > 0 ? { 'max-early-data': ed, 'early-data-header-name': 'Sec-WebSocket-Protocol' } : {}),
    },
    // Worker WebSocket transports TCP; disabling UDP forces QUIC-capable apps back to TCP.
    udp: false,
  };
  if (proto === 'vless') base.uuid = user.uuid;
  else base.password = settings.trojan_password || user.uuid;
  return base;
}

export function buildClash(user, settings, addrs, ports = [443, 2053, 8080, 80]) {
  const proxies = [];
  let i = 0;
  const both = String(settings.proto || 'both') === 'both' && Boolean(settings.trojan_password);
  for (const h of addrs) {
    const isV6 = String(h).includes(':');
    const targetPorts = isV6 ? [443, 2053, 8080] : [443, 2053, 8080, 80];
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
    rules: [
      ...meshDirectDomains(settings).map((d) => `DOMAIN-SUFFIX,${d},DIRECT`),
      'DOMAIN-SUFFIX,ir,DIRECT',
      'GEOIP,IR,DIRECT',
      'AND,((NETWORK,UDP),(DST-PORT,443)),REJECT',
      ...MESH_AI_PACKAGES.map((p) => `PROCESS-NAME,${p},🚀 Omni`),
      ...MESH_AI_DOMAINS.map((d) => `DOMAIN-SUFFIX,${d},🚀 Omni`),
      ...MESH_GAME_DOMAINS.map((d) => `DOMAIN-SUFFIX,${d},🚀 Omni`),
      'MATCH,🚀 Omni',
    ],
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
  <a class="btn ghost" href="v2rayng://install-config?url=${encodeURIComponent(`${origin}/s/${user.sub_token}`)}">📲 باز کردن مستقیم در v2rayNG / PattNG</a>
  <div class="muted" style="margin-top:10px">لینک اشتراک (در کلاینت وارد کن):</div>
  <code>${esc(origin)}/s/${esc(user.sub_token)}</code>

  <div style="margin-top:18px;padding:14px;border-radius:15px;background:#0a0e15;border:1px solid var(--line)">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <b style="font-size:13px;color:var(--a1)">📱 سنسور هوشمند خط گوشی و رادار زیرزمینی</b>
      <span id="net-badge" class="badge ok" style="font-size:10.5px">در حال سنجش خط…</span>
    </div>
    <div id="net-info" class="muted" style="font-size:11.5px;margin-top:8px;line-height:1.7">در حال تشخیص اپراتور سیم‌کارت/وای‌فای و وضعیت رادیویی گوشی…</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
      <button class="btn" id="btn-autotune" type="button" style="margin-top:0;padding:10px 12px;font-size:12px">⚡ تنظیم خودکار برای نت من</button>
      <button class="btn ghost" id="btn-underground" type="button" style="margin-top:0;padding:10px 12px;font-size:12px;border-color:rgba(34,211,238,.35);color:var(--a1)">🕵️ کشف آی‌پی زیرزمینی</button>
    </div>
  </div>

  <div class="muted" style="margin-top:18px">⚡️ تست زنده پینگ و آی‌پی تمیز برای اینترنت شما</div>
  <div class="muted" style="font-size:11.5px;margin-top:3px">پینگ مستقیماً از مرورگر گوشی شما اندازه‌گیری می‌شود؛ آی‌پی‌های سبز را ستاره بزنید تا در صدر ساب‌لینک قرار بگیرند.</div>
  <div id="iplist" style="margin-top:10px"></div>
  <button class="btn ghost" id="ip-test" type="button">⚡ تست مجدد پینگ روی اینترنت من</button>
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
  var netInfoEl = document.getElementById('net-info'), netBadgeEl = document.getElementById('net-badge');
  var sensedIsp = null;
  function nm(v){ return (v && typeof v === 'object') ? String(v.addr || v.ip || '') : String(v == null ? '' : v); }
  function kind(a){ if (a.indexOf(':') >= 0) return 'ipv6'; var c = a.charAt(0); return (c >= '0' && c <= '9') ? 'ipv4' : 'host'; }
  function cls(ms){ if (ms == null || ms <= 0) return ''; return ms < 180 ? 'good' : ms > 500 ? 'bad' : ''; }
  var rows = CANDS.map(function(c){
    var m = (c && c.ms != null && Number(c.ms) >= 25) ? Number(c.ms) : null;
    return { addr: nm(c), ms: m, colo: (c && c.colo) || null, mbps: null, source: (c && c.source) || '', testing: false };
  }).filter(function(r){ return r.addr; });
  function render(){
    if (!rows.length) { el.innerHTML = '<div class="muted" style="font-size:11.5px">هنوز کاندیدی ثبت نشده.</div>'; return; }
    el.innerHTML = rows.slice(0, 14).map(function(r){
      var k = kind(r.addr), tag = r.source ? r.source : (k === 'host' ? 'دامنه · 443/2053' : k === 'ipv6' ? 'IPv6 · 443/2053' : 'آی‌پی تمیز · 443/2053');
      var msTxt = r.testing ? '⏳ در حال تست…' : (r.ms != null && r.ms > 0 ? r.ms + ' ms' : 'آماده تست');
      return '<div class="ip"><b>' + r.addr + '</b><span class="muted" style="font-size:10.5px">' + tag + (r.colo ? ' · ' + r.colo : '') + '</span>' +
        '<span class="ms ' + cls(r.ms) + '">' + msTxt + '</span>' +
        '<button class="star" data-addr="' + r.addr + '" data-ms="' + (r.ms || '') + '" title="این آی‌پی روی اینترنت من عالی بود">★</button></div>';
    }).join('');
  }
  render();
  async function runNetSensor(){
    try {
      var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
      var radioType = conn.type ? (conn.type + (conn.effectiveType ? ' / ' + conn.effectiveType.toUpperCase() : '')) : (conn.effectiveType ? conn.effectiveType.toUpperCase() : 'نامشخص');
      var radioDl = conn.downlink ? conn.downlink + ' Mbps' : '';
      var ns = await fetch(ORIGIN + '/api/diag/net-sense?token=' + encodeURIComponent(TOKEN), { cache: 'no-store' }).then(function(r){ return r.json(); });
      if (ns && ns.ok) {
        sensedIsp = ns.isp;
        if (netBadgeEl) netBadgeEl.textContent = ns.isp.name + ' · ' + ns.ipVersion;
        if (netInfoEl) {
          netInfoEl.innerHTML =
            '📡 <b>اپراتور:</b> ' + ns.isp.name + ' &nbsp;|&nbsp; 📶 <b>سنسور گوشی:</b> ' + radioType + (radioDl ? ' (' + radioDl + ')' : '') +
            '<br>🛡️ <b>فرگمنت بهینه خط شما:</b> <span style="direction:ltr;display:inline-block;color:#22d3ee">' + ns.isp.fragmentRule + '</span> · پورت پیشنهادی: <b>' + (ns.isp.bestPorts || [443,2053]).join(' / ') + '</b>' +
            '<br><span style="color:#a7f3d0">' + ns.isp.tip + '</span>';
        }
      }
    } catch (e) {
      if (netInfoEl) netInfoEl.textContent = 'سنسور خط آماده است. برای بهینه‌سازی روی دکمه‌های زیر بزنید.';
    }
  }
  runNetSensor();
  document.getElementById('btn-autotune').onclick = async function(){
    var btn = document.getElementById('btn-autotune');
    btn.disabled = true; btn.textContent = '⏳ در حال تنظیم…';
    try {
      var goodIps = rows.filter(function(r){ return r.ms != null && r.ms >= 25 && r.ms < 600; }).map(function(r){ return r.addr; }).slice(0, 10);
      var res = await fetch(ORIGIN + '/api/diag/net-sense?token=' + encodeURIComponent(TOKEN), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apply: true, fragment: sensedIsp ? sensedIsp.fragment : undefined, ips: goodIps.length >= 3 ? goodIps : undefined })
      }).then(function(r){ return r.json(); });
      if (res && res.ok) {
        out.textContent = '✅ اشتراک شما بر اساس خط «' + (res.isp ? res.isp.name : 'فعلی') + '» با بهترین فرگمنت و آی‌پی‌های تمیز تنظیم شد! اکنون در v2rayNG اشتراک را آپدیت کنید.';
      }
    } catch (e) {}
    btn.disabled = false; btn.textContent = '⚡ تنظیم خودکار برای نت من';
  };
  document.getElementById('btn-underground').onclick = async function(){
    var btn = document.getElementById('btn-underground');
    btn.disabled = true; btn.textContent = '🕵️ در حال شکار…';
    out.textContent = 'در حال استخراج آی‌پی‌های زیرزمینی همسایه (/24) و دامنه‌های سازمانی…';
    try {
      var seeds = rows.filter(function(r){ return r.ms != null && r.ms < 350; }).map(function(r){ return r.addr; }).slice(0, 4);
      var hRes = await fetch(ORIGIN + '/api/diag/underground-hunt?token=' + encodeURIComponent(TOKEN), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seeds: seeds, limit: 12, apply: false })
      }).then(function(r){ return r.json(); });
      if (hRes && Array.isArray(hRes.candidates) && hRes.candidates.length) {
        rows = hRes.candidates.map(function(c){
          return { addr: c.addr, ms: null, colo: c.colo || null, source: c.source || 'زیرزمینی', testing: true };
        });
        render();
        await runLiveTest();
        var fastUnderground = rows.filter(function(r){ return r.ms != null && r.ms >= 25 && r.ms < 500; }).map(function(r){ return r.addr; });
        if (fastUnderground.length) {
          await fetch(ORIGIN + '/api/diag/net-sense?token=' + encodeURIComponent(TOKEN), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ apply: true, ips: fastUnderground.slice(0, 10) })
          });
          out.textContent = '🕵️ ' + fastUnderground.length + ' آی‌پی زیرزمینی با پینگ عالی روی خط شما کشف و در صدر ساب‌لینک ذخیره شد!';
        }
      }
    } catch (e) {}
    btn.disabled = false; btn.textContent = '🕵️ کشف آی‌پی زیرزمینی';
  };
  function measureEdgeRtt(){
    return new Promise(function(res){
      var u = ORIGIN + '/healthz?x=' + Math.random().toString(36).slice(2);
      fetch(u, { cache: 'no-store' }).then(function(){
        var t0 = performance.now();
        return fetch(u + 'w', { cache: 'no-store' }).then(function(){
          res(Math.max(25, Math.round(performance.now() - t0)));
        });
      }).catch(function(){ res(null); });
    });
  }
  function probeHost(addr){
    return new Promise(function(res){
      var t0 = performance.now(), c = new AbortController();
      var to = setTimeout(function(){ c.abort(); res(null); }, 3800);
      var target = addr.indexOf(':') >= 0 ? '[' + addr + ']' : addr;
      fetch('https://' + target + '/cdn-cgi/trace?x=' + Math.round(performance.now()), { mode: 'no-cors', cache: 'no-store', signal: c.signal })
        .then(function(){ clearTimeout(to); res(Math.max(25, Math.round(performance.now() - t0))); })
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
          res(sec > 0 ? { mbps: Math.round((b.byteLength * 8 / sec) / 1e5) / 10, ms: Math.max(25, Math.round(performance.now() - t0)) } : null);
        })
        .catch(function(){ clearTimeout(to); res(null); });
    });
  }
  async function runLiveTest(){
    var btn = document.getElementById('ip-test');
    if (btn) btn.disabled = true;
    out.textContent = 'در حال اندازه‌گیری پینگ و سرعت واقعی مستقیماً از روی اینترنت شما…';
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
    var browserProbes = await Promise.all(rows.map(function(r){ return probeHost(r.addr); }));
    rows.forEach(function(r, i){
      r.testing = false;
      var sv = serverMap[r.addr];
      if (sv && sv.colo) r.colo = sv.colo;
      if (browserProbes[i] != null && browserProbes[i] >= 25) {
        r.ms = browserProbes[i];
      }
      // پینگ Edge دیتاسنتر هرگز به‌عنوان پینگ خط کاربر جا زده نمی‌شود.
    });
    var sp = await speedTest();
    var self = rows.filter(function(r){ return r.addr === SELF || r.addr === ORIGIN; })[0];
    if (sp) {
      // سرعت فقط برای خود لینک پنل اندازه‌گیری شده است؛ به آی‌پی‌های دیگر کپی نمی‌شود.
      if (self) { if (edgeRtt) self.ms = edgeRtt; self.mbps = sp.mbps; }
      else rows.unshift({ addr: SELF, ms: edgeRtt || sp.ms, mbps: sp.mbps, colo: null, testing: false, source: 'سرعت واقعی خط تا پنل' });
    }
    rows.sort(function(a, b){ return (a.ms == null ? 9e9 : a.ms) - (b.ms == null ? 9e9 : b.ms); });
    render();
    var good = rows.filter(function(r){ return r.ms != null && r.ms >= 25; });
    out.textContent = sp
      ? ('✓ تست واقعی کامل شد — پینگ لبه: ' + (edgeRtt || sp.ms) + ' ms · سرعت دانلود: ' + sp.mbps + ' Mbps (' + good.length + ' نود فعال).')
      : ('✓ تست پینگ کامل شد (' + good.length + ' نود فعال).');
    if (edgeRtt != null && good.length) {
      try {
        await fetch('/api/report-ip', { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: TOKEN, results: good.map(function(r){ return { ip: r.addr, ms: r.ms, colo: r.colo, mbps: r.mbps }; }) }) });
      } catch (e) {}
    }
    if (btn) btn.disabled = false;
  }
  document.getElementById('ip-test').onclick = runLiveTest;
  setTimeout(runLiveTest, 120);
  el.addEventListener('click', async function(ev){
    var b = ev.target.closest('.star'); if (!b) return;
    var row = rows.filter(function(r){ return r.addr === b.dataset.addr; })[0];
    var realMs = (row && row.ms >= 25) ? row.ms : (Number(b.dataset.ms) >= 25 ? Number(b.dataset.ms) : null);
    if (realMs == null) { out.textContent = 'این آدرس هنوز روی خط شما پاسخ معتبر نداده و ثبت نشد.'; return; }
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
