import io

# ═══════════════ auth.js: پیش‌فرض‌ها و بذر استخر آی‌پی ═══════════════
p = 'src/auth.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("  fragment_preset: 'none',", "  fragment_preset: 'mci',")
s = s.replace("  port: '443',", """  port: '443',
  ports_mode: 'auto',
  ports_custom: '',
  config_count: '20',
  ipv6_enabled: '1',
  ipv6_pool: '',""")
s = s.replace("""  if (!st.ip_pool) missing.ip_pool = ['104.16.0.0', '104.17.0.0', '104.18.0.0', '104.19.0.0', '104.20.0.0', '104.21.0.0', '172.64.0.0', '172.66.0.0', '172.67.0.0', '162.159.36.0'].join('\\n');""",
"""  if (!st.ip_pool) missing.ip_pool = CF_GOOD_IPS.join('\\n');""")
s = s.replace("""const enc = new TextEncoder();""", """import { CF_GOOD_IPS } from './scan.js';

const enc = new TextEncoder();""", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('✔ auth.js')

# ═══════════════ api.js ═══════════════
p = 'src/api.js'
s = io.open(p, encoding='utf-8').read()

s = s.replace("import { rankIps, rankIpsHttp, probeNode, tcpProbe, fetchCfCidrs, sampleIPs, SEED_IPS } from './scan.js';",
              "import { rankIps, rankIpsHttp, probeNode, tcpProbe, fetchCfCidrs, sampleIPs, SEED_IPS, CF_GOOD_IPS, validateIps, IPV6_SEEDS, PORTS_PLAIN, PORTS_TLS } from './scan.js';")

# کلیدهای مجاز تنظیمات
s = s.replace("""'clean_ips', 'ip_pool', 'device_limit', 'dns_upstream', 'proto', 'path', 'early_data', 'decoy_url', 'announce',
      'trojan_password'];""",
"""'clean_ips', 'ip_pool', 'device_limit', 'dns_upstream', 'proto', 'path', 'early_data', 'decoy_url', 'announce',
      'trojan_password', 'ports_mode', 'ports_custom', 'config_count', 'ipv6_enabled', 'ipv6_pool'];""")

# auto-detect نوع ساب از User-Agent
s = s.replace("""    const { body, contentType } = subscriptionBody(view, settings, ips, url.searchParams.get('type') || '');""",
"""    const ua = (request.headers.get('user-agent') || '').toLowerCase();
    const byUa = ua.includes('clash') || ua.includes('mihomo') || ua.includes('stash') ? 'clash'
      : (ua.includes('sing-box') || ua.includes('singbox') || ua.includes('happ') || ua.includes('streisand') || ua.includes('karing') || ua.includes('v2box')) ? 'singbox' : '';
    const { body, contentType } = subscriptionBody(view, settings, ips, url.searchParams.get('type') || byUa);""")

# /api/diag/validate-ips + بازنویسی rank-ips
old_rank_start = s.index("  if (p === '/api/diag/rank-ips' && method === 'POST') {")
old_rank_end = s.index("  if (p === '/api/diag/logs' && method === 'GET') {")
new_rank = r"""  if (p === '/api/diag/validate-ips' && method === 'POST') {
    // اعتبارسنجی واقعی: هر آی‌پی با Host/SNI خود پنل صدا زده می‌شود؛
    // اگر پاسخ ورکر ما برگردد یعنی آن آی‌پی ترافیک پنل را سرو می‌کند.
    const body = await request.json().catch(() => ({}));
    const given = Array.isArray(body.ips) ? body.ips.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(String(x).trim())) : [];
    const pool = [...new Set([...given, ...CF_GOOD_IPS, ...(settings.ip_pool || '').split(/[\n,\s]+/).filter(Boolean)])].slice(0, 60);
    const results = await validateIps(pool, { host: url.host || settings.public_host, path: '/api/whoami', concurrency: 10 });
    const good = results.filter((r) => r.ok).slice(0, 20);
    if (good.length) {
      for (const r of good) {
        await env.DB.prepare(
          `INSERT INTO clean_ips(ip, ms, ok, hits, checked_at) VALUES(?,?,1,COALESCE((SELECT hits FROM clean_ips WHERE ip = ?),0),datetime('now'))
           ON CONFLICT(ip) DO UPDATE SET ms = excluded.ms, checked_at = datetime('now')`
        ).bind(r.ip, r.ms, r.ip).run();
      }
      await putSetting(env, 'clean_ips', JSON.stringify(good.map((r) => r.ip)));
      await putSetting(env, 'ip_pool', [...new Set([...good.map((r) => r.ip), ...CF_GOOD_IPS])].join('\n'));
    }
    await logEvent(env, 'info', `اعتبارسنجی آی‌پی: ${good.length} از ${pool.length} سالم (پاسخ ورکر از خود آن آی‌پی)`);
    return json({
      ok: true, tested: pool.length, alive: good.length, results,
      note: good.length
        ? 'این آی‌پی‌ها از داخل خود ورکر با Host/SNI پنل تست شدند و پاسخ دادند — پس کانفیگ‌ها رویشان قطعاً به ورکر می‌رسد.'
        : 'هیچ آی‌پی‌ای پاسخ نداد؛ استخر پیش‌فرض استفاده می‌شود. (کلودفلر اجازه‌ی تست بعضی آی‌پی‌ها را از داخل ورکر نمی‌دهد.)',
    });
  }

  if (p === '/api/diag/rank-ips' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const given = Array.isArray(body.ips) ? body.ips.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(String(x).trim())).slice(0, 300) : [];
    const pool = [...new Set([
      ...given.map((x) => String(x).trim()),
      ...(settings.ip_pool || '').split(/[\n,\s]+/).filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x)),
      ...CF_GOOD_IPS,
    ])].slice(0, 120);

    // ۱) اندازه‌گیری‌های واقعی دستگاه کاربران (باارزش‌ترین داده)
    const clientRows = await env.DB.prepare(
      `SELECT ip, ms, colo, COALESCE(hits,0) hits FROM clean_ips WHERE ok = 1 ORDER BY (COALESCE(hits,0) * 1000) DESC, ms ASC LIMIT 40`).all();
    // ۲) پروب لبه (فقط برای آی‌پی‌های غیرکلودفلر معنا دارد؛ برای کلودفلر خطای ۱۰۰۳ هم یعنی «رسید»)
    const edge = await rankIpsHttp(pool.slice(0, 40), { concurrency: Number(body.concurrency || 10), timeoutMs: Number(body.timeout || 2500) });

    const merged = new Map();
    for (const r of edge) merged.set(r.ip, { ip: r.ip, ms: r.ms, colo: r.colo, src: 'edge', hits: 0 });
    for (const r of (clientRows.results || [])) {
      const cur = merged.get(r.ip) || { ip: r.ip, ms: null, colo: null, src: 'client', hits: 0 };
      cur.client_ms = r.ms; cur.colo = cur.colo || r.colo; cur.hits = r.hits || 0;
      cur.src = cur.src === 'edge' ? 'both' : 'client';
      merged.set(r.ip, cur);
    }
    const results = [...merged.values()]
      .map((x) => ({ ...x, score: (x.client_ms ?? x.ms ?? 9999) - Math.min(80, x.hits || 0) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 40);

    const top = results.filter((r) => (r.client_ms ?? r.ms) !== null).slice(0, 20);
    if (top.length) {
      for (const r of top) {
        await env.DB.prepare(
          `INSERT INTO clean_ips(ip, ms, colo, ok, checked_at) VALUES(?,?,?,1,datetime('now'))
           ON CONFLICT(ip) DO UPDATE SET ms = COALESCE(excluded.ms, clean_ips.ms), colo = COALESCE(excluded.colo, clean_ips.colo), checked_at = datetime('now')`
        ).bind(r.ip, r.client_ms ?? r.ms, r.colo).run();
      }
      await putSetting(env, 'clean_ips', JSON.stringify(top.map((r) => r.ip)));
    }
    await logEvent(env, 'info', `رتبه‌بندی آی‌پی: ${edge.length} از لبه + ${clientRows.results?.length || 0} اندازه‌گیری کاربران`);
    return json({
      ok: true, tested: pool.length, alive: edge.length, client: clientRows.results?.length || 0, results,
      note: 'رتبه‌بندی ترکیبی: اندازه‌گیری دستگاه کاربران (وزن بالا؛ با ستاره تقویت می‌شود) + پروب لبه. برای تأیید قطعی مسیر، «اعتبارسنجی از ورکر» را بزن.',
    });
  }

"""
s = s[:old_rank_start] + new_rank + s[old_rank_end:]

# متادیتای پورت‌ها برای فرانت (اختیاری، بی‌ضرر)
s = s.replace("""  if (p === '/api/fragments') {
    return json({ ok: true, presets: FRAGMENT_PRESETS.map(({ id, label }) => ({ id, label })), fingerprints: FINGERPRINTS });
  }""",
"""  if (p === '/api/fragments') {
    return json({
      ok: true,
      presets: FRAGMENT_PRESETS.map(({ id, label }) => ({ id, label })),
      fingerprints: FINGERPRINTS,
      ports: { plain: PORTS_PLAIN, tls: PORTS_TLS, recommended: [80, 443, 2053, 8080, 2087, 8443] },
    });
  }""")

io.open(p, 'w', encoding='utf-8').write(s)
print('✔ api.js')

# ═══════════════ bot.js ═══════════════
p = 'src/bot.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { rankIpsHttp, SEED_IPS, httpProbe, tcpProbe } from './scan.js';",
              "import { rankIpsHttp, SEED_IPS, httpProbe, tcpProbe, CF_GOOD_IPS, validateIps, PORTS_PLAIN, PORTS_TLS } from './scan.js';")
s = s.replace("""      const pool = [...new Set([
        ...String(st.ip_pool || '').split(/[\\n,\\s]+/).filter((x) => /^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(x)),
        ...SEED_IPS,
      ])].slice(0, 60);
      const edge = await rankIpsHttp(pool, { concurrency: 8, timeoutMs: 2500 });""",
"""      const pool = [...new Set([
        ...String(st.ip_pool || '').split(/[\\n,\\s]+/).filter((x) => /^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(x)),
        ...CF_GOOD_IPS,
      ])].slice(0, 60);
      const edge = await rankIpsHttp(pool, { concurrency: 8, timeoutMs: 2500 });""")
s = s.replace("""      if (top.length) {
        await putSetting(env, 'clean_ips', JSON.stringify(top.map((r) => r.ip)));
        await logEvent(env, 'info', `اسکن ربات: ${top.length} آی‌پی از لبه`);
      }""",
"""      if (top.length) {
        await putSetting(env, 'clean_ips', JSON.stringify(top.map((r) => r.ip)));
        await logEvent(env, 'info', `اسکن ربات: ${top.length} آی‌پی از لبه`);
      }
      // اعتبارسنجی موازی: کدام آی‌پی واقعاً ترافیک ورکر را سرو می‌کند
      let validated = [];
      try {
        validated = (await validateIps([...new Set([...top.map((r) => r.ip), ...CF_GOOD_IPS])].slice(0, 24), { host: settings.public_host, concurrency: 8 })).filter((r) => r.ok);
        if (validated.length) {
          await putSetting(env, 'clean_ips', JSON.stringify(validated.slice(0, 20).map((r) => r.ip)));
          await putSetting(env, 'ip_pool', [...new Set([...validated.map((r) => r.ip), ...CF_GOOD_IPS])].join('\\n'));
        }
      } catch { /* ignore */ }""")
s = s.replace("""      return send(
        `<b>نتیجه‌ی اسکن</b> (${edge.length} پاسخ از ${pool.length})\\n\\n` +""",
"""      if (validated.length) lines.push('<b>تأییدشده از داخل ورکر (بهترین‌ها):</b>\\n' + validated.slice(0, 8).map((r, i) => `${i + 1}. <code>${r.ip}</code> — ${r.ms}ms`).join('\\n'));
      return send(
        `<b>نتیجه‌ی اسکن</b> (${edge.length} پاسخ از ${pool.length}${validated.length ? ` — ${validated.length} تأییدشده` : ''})\\n\\n` +""")
io.open(p, 'w', encoding='utf-8').write(s)
print('✔ bot.js')
