import io

# ── حذف اعتبارسنجی درون‌ورکری (کلودفلر با خطای ۱۰۴۲ مسدود می‌کند) ──
p = 'src/api.js'
s = io.open(p, encoding='utf-8').read()
start = s.index("  if (p === '/api/diag/validate-ips' && method === 'POST') {")
end = s.index("  if (p === '/api/diag/rank-ips' && method === 'POST') {")
s = s[:start] + s[end:]
s = s.replace("import { rankIps, rankIpsHttp, probeNode, tcpProbe, fetchCfCidrs, sampleIPs, SEED_IPS, CF_GOOD_IPS, validateIps, IPV6_SEEDS, PORTS_PLAIN, PORTS_TLS } from './scan.js';",
              "import { rankIps, rankIpsHttp, probeNode, tcpProbe, fetchCfCidrs, sampleIPs, SEED_IPS, CF_GOOD_IPS, IPV6_SEEDS, PORTS_PLAIN, PORTS_TLS } from './scan.js';")
# verified_pairs در کلیدهای مجاز تنظیمات
s = s.replace("'ports_mode', 'ports_custom', 'config_count', 'ipv6_enabled', 'ipv6_pool'];",
              "'ports_mode', 'ports_custom', 'config_count', 'ipv6_enabled', 'ipv6_pool', 'verified_pairs'];")
# پیام صادقانه در rank-ips
s = s.replace("      note: 'رتبه‌بندی ترکیبی: اندازه‌گیری دستگاه کاربران (وزن بالا؛ با ستاره تقویت می‌شود) + پروب لبه. برای تأیید قطعی مسیر، «اعتبارسنجی از ورکر» را بزن.',",
              "      note: 'رتبه‌بندی ترکیبی: اندازه‌گیری واقعی دستگاه کاربران (وزن بالا؛ ستاره آن را تقویت می‌کند) + پروب لبه. کلودفلر اجازه‌ی تست مستقیم آی‌پی‌هایش از داخل ورکر را نمی‌دهد، پس دقیق‌ترین داده همان تست کاربران و ابزار npm run pool است.',")
io.open(p, 'w', encoding='utf-8').write(s)
print('✔ api.js: validate-ips حذف شد')

# ── bot.js: حذف ارجاع به اعتبارسنجی ──
p = 'src/bot.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { rankIpsHttp, SEED_IPS, httpProbe, tcpProbe, CF_GOOD_IPS, validateIps, PORTS_PLAIN, PORTS_TLS } from './scan.js';",
              "import { rankIpsHttp, SEED_IPS, httpProbe, tcpProbe, CF_GOOD_IPS, PORTS_PLAIN, PORTS_TLS } from './scan.js';")
old = s[s.index("      // اعتبارسنجی موازی: کدام آی‌پی واقعاً ترافیک ورکر را سرو می‌کند"):s.index("      return send(\n        `<b>نتیجه‌ی اسکن</b>")]
s = s.replace(old, """""")
s = s.replace("""      if (validated.length) lines.push('<b>تأییدشده از داخل ورکر (بهترین‌ها):</b>\\n' + validated.slice(0, 8).map((r, i) => `${i + 1}. <code>${r.ip}</code> — ${r.ms}ms`).join('\\n'));
      return send(
        `<b>نتیجه‌ی اسکن</b> (${edge.length} پاسخ از ${pool.length}${validated.length ? ` — ${validated.length} تأییدشده` : ''})\\n\\n` +""",
"""      return send(
        `<b>نتیجه‌ی اسکن</b> (${edge.length} پاسخ از ${pool.length})\\n\\n` +""")
s = s.replace("""        '\\n\\nℹ️ کلودفلر اجازه‌ی تست مستقیم آی‌پی‌های خودش از داخل ورکر را نمی‌دهد؛ دقیق‌ترین نتیجه از «تست روی دستگاه من» در صفحه‌ی وضعیت کاربران می‌آید (کشور/شبکه‌ی کاربر مهم است).'""",
"""        '\\n\\nℹ️ کلودفلر اجازه‌ی تست مستقیم آی‌پی‌های خودش از داخل ورکر را نمی‌دهد؛ دقیق‌ترین نتیجه از «تست روی دستگاه من» در صفحه‌ی وضعیت کاربران می‌آید (شبکه‌ی کاربر مهم است).'""")
io.open(p, 'w', encoding='utf-8').write(s)
print('✔ bot.js')

# ── auth.js: حذف check_host ──
p = 'src/auth.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("  ipv6_pool: '',\n  check_host: '',", "  ipv6_pool: '',")
s = s.replace("""  if (!st.check_host) {
    const m = String(st.public_host || url.host || '').match(/^[a-z0-9-]+\\.([a-z0-9-]+\\.workers\\.dev)$/i);
    if (m) missing.check_host = 'omni-check.' + m[1];
  }
""", "")
io.open(p, 'w', encoding='utf-8').write(s)
print('✔ auth.js')

# ── links.js: ترتیب پورت‌ها + پشتیبانی از جفت‌های تأییدشده ──
p = 'src/links.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""  const rotation = [80, 443, 8080, 2053, 8880, 2087, 2082, 2083, 2095, 2096, 2086, 8443, 2052];
  const out = [primary, ...rotation.filter((x) => x !== primary)];
  return [...new Set(out)].slice(0, Math.max(1, Math.min(6, count)));""",
"""  // ترتیب: اول پورت ۸۰ (بدون TLS، بدون SNI — مقاوم‌ترین حالت در ایران)، بعد ۴۴۳ و بقیه
  const rotation = [80, 443, 2053, 8080, 2087, 8443, 8880, 2082, 2083, 2095, 2096, 2086, 2052];
  const out = rotation.includes(primary) ? rotation : [primary, ...rotation];
  return [...new Set(out)].slice(0, Math.max(1, Math.min(13, count)));""")

old_build = s[s.index('/** کانفیگ‌های یک کاربر: ماتریس آدرس × پورت'):s.index('/* ─────────────── sing-box / clash ─────────────── */')]
new_build = r'''/** جفت‌های تأییدشده‌ی (آی‌پی:پورت) که با اتصال واقعی تست شده‌اند
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
  const maxConfigs = Math.max(4, Math.min(60, Number(settings.config_count || 24)));
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
  for (const pr of orderedPairs) {
    const idx = pr.lastIndexOf(':');
    push(pr.slice(0, idx), Number(pr.slice(idx + 1)));
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

'''
s = s.replace(old_build, new_build)
io.open(p, 'w', encoding='utf-8').write(s)
print('✔ links.js: verified_pairs + ترتیب پورت‌ها')
