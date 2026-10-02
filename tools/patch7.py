#!/usr/bin/env python3
"""
Omni patch7 — «مهندسی پینگ»:
۱) رفع باگ صفحه‌ی وضعیت ([object Object] + تستری که هیچ آی‌پی را نمی‌سنجید)
۲) تستر دستگاه: دامنه‌ها + هاست پنل با گواهی معتبر + تست سرعت واقعی (Mbps)
۳) /api/report-ip پذیرای دامنه و IPv6 و mbps شد (یادگیری از شبکه‌ی خود کاربر)
۴) اسکنر پنل: یک مسیر واحد و صادقانه (دامنه از مرورگر، آی‌پی از لبه) + اعمال تفکیک‌شده
۵) ترتیب کانفیگ‌ها: هر جفت اثبات‌شده با «همزاد پورت» (۴۴۳+۸۰) — کلید پینگ روی همراه اول
۶) برند: باقی‌مانده‌های Kaveh/کاوه → Omni
"""
import io

def rd(p): return io.open(p, encoding='utf-8').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8').write(s)

# ═══════════════════════════ ۱) auth.js — ستون mbps ═══════════════════════════
s = rd('src/auth.js')
if 'mbps REAL' not in s:
    old = "'ALTER TABLE users ADD COLUMN notify INTEGER DEFAULT 1',"
    assert old in s
    s = s.replace(old, old + "\n    'ALTER TABLE clean_ips ADD COLUMN mbps REAL',", 1)
    wr('src/auth.js', s); print('  ✔ auth.js — ستون mbps')

# ═══════════════════════════ ۲) api.js ═══════════════════════════
s = rd('src/api.js')

# ۲الف) report-ip: دامنه/IPv6/mbps
i = s.index("  if (p === '/api/report-ip' && method === 'POST') {")
j = s.index("  /* ───────── صفحه‌ی وضعیت کاربر (عمومی) ───────── */")
new_report = '''  if (p === '/api/report-ip' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || '');
    const rows = Array.isArray(body.results) ? body.results.slice(0, 80) : [];
    const u = await env.DB.prepare('SELECT username, is_active FROM users WHERE sub_token = ?').bind(token).first();
    if (!u) return bad('bad_token', 'توکن نامعتبر', 403);
    let saved = 0;
    for (const r of rows) {
      const addr = normalizeAddr(r?.addr ?? r?.ip);
      const ms = Number(r?.ms);
      const mbps = Number(r?.mbps);
      if (!addr || !Number.isFinite(ms) || ms <= 0 || ms > 20000) continue;
      await env.DB.prepare(
        `INSERT INTO clean_ips(ip, ms, colo, ok, hits, mbps, checked_at) VALUES(?,?,?,1,1,?,datetime('now'))
         ON CONFLICT(ip) DO UPDATE SET
           ms = CASE WHEN clean_ips.ms IS NULL OR excluded.ms < clean_ips.ms THEN excluded.ms ELSE clean_ips.ms END,
           colo = COALESCE(excluded.colo, clean_ips.colo),
           mbps = CASE WHEN excluded.mbps IS NULL THEN clean_ips.mbps
                       WHEN clean_ips.mbps IS NULL OR excluded.mbps > clean_ips.mbps THEN excluded.mbps ELSE clean_ips.mbps END,
           hits = COALESCE(clean_ips.hits, 0) + 1,
           checked_at = datetime('now')`
      ).bind(addr, Math.round(ms), r?.colo ? String(r.colo).slice(0, 12) : null,
        Number.isFinite(mbps) && mbps > 0 ? Math.round(mbps * 10) / 10 : null).run();
      saved++;
    }
    if (saved) await logEvent(env, 'info', `اندازه‌گیری ${saved} کاندید از دستگاه «${u.username}»`);
    return json({ ok: true, saved });
  }

  /* ───────── تست سرعت واقعی از دستگاه کاربر (پشت تونل خودش) ───────── */
  if (p === '/api/diag/speed') {
    const q = url.searchParams;
    const u = await env.DB.prepare('SELECT username FROM users WHERE sub_token = ?')
      .bind(String(q.get('token') || '')).first();
    if (!u) return bad('bad_token', 'توکن نامعتبر', 403);
    const bytes = Math.max(65536, Math.min(8 * 1024 * 1024, Number(q.get('bytes') || 2 * 1024 * 1024) || 0));
    const buf = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i += 4) {                     // داده‌ی تصادفی‌نما: غیرقابل فشرده‌سازی
      const v = (i * 2654435761) >>> 0;
      buf[i] = v & 255; buf[i + 1] = (v >>> 8) & 255; buf[i + 2] = (v >>> 16) & 255; buf[i + 3] = (v >>> 24) & 255;
    }
    return new Response(buf, {
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': String(bytes),
        'cache-control': 'no-store, no-cache, must-revalidate',
        'access-control-allow-origin': '*',
      },
    });
  }

'''
s = s[:i] + new_report + s[j:]

# ۲ب) normalizeAddr + کاندیدهای غنی برای صفحه‌ی وضعیت
old_cand = """    const candidateIps = (ipRows.results || []).map((r) => ({ ip: r.ip, ms: r.ms, colo: r.colo }));
    return new Response(statusPage(view, settings, url.origin, { conns: conns?.c || 0, ips: candidateIps }),"""
new_cand = """    // کاندیدها = همان چیزهایی که در کانفیگ‌ها به‌کار می‌روند: آی‌پی‌های تأییدشده، دامنه‌ها،
    // IPv6 و دامنه‌ی پنل — تا دستگاه کاربر دقیقاً همان‌ها را بسنجد و نتیجه در D1 بنشیند.
    const cands = [];
    const seenAddr = new Set();
    const pushCand = (addr, ms, colo) => {
      const a = normalizeAddr(addr);
      if (!a || seenAddr.has(a)) return;
      seenAddr.add(a);
      cands.push({ addr: a, ms: Number.isFinite(Number(ms)) ? Number(ms) : null, colo: colo || null });
    };
    (ipRows.results || []).forEach((r) => pushCand(r.ip, r.ms, r.colo));
    safeArray(settings.address_domains).forEach((d) => pushCand(d, null, null));
    pushCand(String(settings.public_host || '').replace(/^https?:\\/\\//, '').replace(/\\/.*$/, ''), null, null);
    safeArray(settings.ipv6_pool).forEach((v) => pushCand(v, null, null));
    return new Response(statusPage(view, settings, url.origin, { conns: conns?.c || 0, candidates: cands.slice(0, 20) }),"""
assert old_cand in s
s = s.replace(old_cand, new_cand, 1)

# ۲ج) تابع normalizeAddr
anchor = "const isUuid = (s) =>"
helper = """/** نرمال‌سازی آدرس: IPv4 / IPv6 / دامنه (برای اندازه‌گیری‌های دستگاه کاربر) */
export function normalizeAddr(v) {
  const s = String(v ?? '').trim().replace(/^\\[|\\]$/g, '');
  if (!s || s.length > 120) return null;
  if (/^\\d{1,3}(\\.\\d{1,3}){3}$/.test(s)) return s.split('.').every((n) => Number(n) <= 255) ? s : null;
  if (s.includes(':') && /^[0-9a-f:]{3,45}$/i.test(s)) return s;                       // IPv6
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(s)) return s.toLowerCase();  // دامنه
  return null;
}

"""
if 'export function normalizeAddr' not in s:
    assert anchor in s
    s = s.replace(anchor, helper + anchor, 1)
wr('src/api.js', s); print('  ✔ api.js — report-ip دامنه/IPv6/mbps + /api/diag/speed + کاندیدها')

# ═══════════════════════════ ۳) links.js ═══════════════════════════
s = rd('src/links.js')

# ۳الف) configPool: دامنه‌های تأییدشده‌ی دستگاه، اول فهرست دامنه‌ها
old = """  const verified = norm.filter((r) => Number(r.hits || 0) > 0).sort(byMs).map((r) => r.ip);
  const guessed = norm.filter((r) => !(Number(r.hits || 0) > 0)).sort(byMs).map((r) => r.ip);"""
new = """  const verifiedAll = norm.filter((r) => Number(r.hits || 0) > 0).sort(byMs).map((r) => r.ip);
  const verified = verifiedAll.filter((x) => !/[a-z]/i.test(x));          // آی‌پی‌های تأییدشده
  const verifiedDomains = verifiedAll.filter((x) => /[a-z]/i.test(x));    // دامنه‌های تأییدشده از دستگاه کاربران
  const guessed = norm.filter((r) => !(Number(r.hits || 0) > 0)).sort(byMs).map((r) => r.ip);"""
assert old in s; s = s.replace(old, new, 1)

old = """  const domain = (safeArray(settings.address_domains).length
    ? safeArray(settings.address_domains)
    : CF_DOMAINS).slice(0, 4);"""
new = """  const domain = uniq([
    ...verifiedDomains,                                        // آن‌هایی که از شبکه‌ی کاربران جواب داده‌اند
    ...(safeArray(settings.address_domains).length ? safeArray(settings.address_domains) : CF_DOMAINS),
  ]).slice(0, 6);"""
assert old in s; s = s.replace(old, new, 1)

# ۳ب) buildConfigs: همزاد پورت (۴۴۳+۸۰) برای جفت‌های اثبات‌شده
i = s.index('export function buildConfigs(')
j = s.index('/* ─────────────── sing-box / clash ─────────────── */')
new_bc = '''export function buildConfigs(user, settings, cleanIps = []) {
  const maxConfigs = Math.max(6, Math.min(60, Number(settings.config_count || 30)));
  const pool = configPool(user, settings, cleanIps);
  const pairs = verifiedPairs(settings);                       // «ip:port» اثبات‌شده با هندشیک واقعی
  const pairAddr = (pr) => pr.slice(0, pr.lastIndexOf(':'));
  const pairPort = (pr) => Number(pr.slice(pr.lastIndexOf(':') + 1));
  const tlsPairs = pairs.filter((pr) => isTlsPort(pairPort(pr)));
  const plainPairs = pairs.filter((pr) => !isTlsPort(pairPort(pr)));
  const ports = choosePorts(settings, 4);
  /** پورت همزاد: اگر ۴۴۳ باز بود ولی ۸۰ بسته (یا برعکس) کاربر یک کانفیگ سالم از دست می‌دهد.
   *  در ایران بسته به اپراتور یکی از این دو کار می‌کند، پس هر دو را می‌فرستیم. */
  const sibling = (p) => (p === 443 ? 80 : p === 80 ? 443 : p === 8443 ? 2096 : p === 2096 ? 8443 : null);

  const plan = [];
  const seen = new Set();
  const add = (address, port, cat) => {
    const a = String(address || '').trim();
    if (!a || seen.has(`${a}:${port}`)) return;
    seen.add(`${a}:${port}`);
    plan.push({ address: a, port: Number(port), cat });
  };
  const addPair = (pr, cat, withSibling = true) => {
    const a = pairAddr(pr), p = pairPort(pr);
    add(a, p, cat);
    const sib = sibling(p);
    if (withSibling && sib) add(a, sib, `${cat}⁺`);
  };

  // ترتیب = ترتیب احتمال کار کردن روی موبایل ایرانی
  tlsPairs.slice(0, 2).forEach((pr) => addPair(pr, 'Clean'));            // ۴۴۳ تأییدشده + همزاد ۸۰
  plainPairs.slice(0, 2).forEach((pr) => addPair(pr, 'Clean'));          // ۸۰ تأییدشده (همراه اول) + همزاد ۴۴۳
  pool.ipv6.slice(0, 2).forEach((v) => add(v, 443, 'IPv6'));             // IPv6 کلودفلر — اغلب تمیز
  pool.domain.slice(0, 3).forEach((d) => add(d, 443, 'Domain'));         // دامنه‌های معروف کلودفلر
  if (pool.host) add(pool.host, 443, 'Panel');                           // دامنه‌ی خود پنل
  tlsPairs.slice(2, 6).forEach((pr) => addPair(pr, 'Clean'));
  plainPairs.slice(2, 5).forEach((pr) => addPair(pr, 'Clean'));
  pool.domain.slice(3, 5).forEach((d) => add(d, 443, 'Domain'));
  pool.ip.slice(0, 3).forEach((ip) => add(ip, 443, 'IPv4'));
  ports.filter((p) => p !== 443).forEach((p, i) => {
    const a = [pool.ipv6[0], pool.ip[0], pool.domain[0], pool.ipv6[1]][i % 4];
    if (a) add(a, p, isTlsPort(p) ? 'Alt' : 'Plain');
  });

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

  // پرکردن باقی‌مانده تا سقف با ترکیب آدرس × پورت
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

# ۳ج) صفحه‌ی وضعیت: تستر واقعی (دامنه/هاست با گواهی معتبر + تست سرعت) و رندر مقاوم
a = s.index("  <div id=\"iplist\" style=\"margin-top:10px\"></div>")
b = s.index("</script>\n", a) + len("</script>\n")
new_ui = '''  <div id="iplist" style="margin-top:10px"></div>
  <button class="btn ghost" id="ip-test" type="button">🔍 تست از روی دستگاه من (پینگ دامنه‌ها + سرعت)</button>
  <div id="ip-out" class="muted" style="margin-top:8px;font-size:11.5px"></div>
  <div class="muted" style="margin-top:14px;font-size:11px">${esc(name)} — پنل مدیریت پروکسی روی Cloudflare Workers</div>
</div>
<script>
/* تستر دستگاه: فقط چیزهایی که از یک صفحه‌ی HTTPS قابل سنجش‌اند را می‌سنجد:
   دامنه‌ها/هاست پنل (گواهی معتبر → fetch با no-cors) + سرعت دانلود از خود ورکر.
   آی‌پی خام را مرورگر نمی‌تواند بسنجد (گواهی/ترافیک مختلط) — برای آن‌ها v2rayNG معیار است
   و نتیجه‌ی «ستاره» در همین صفحه ثبت می‌شود. */
(function(){
  var CANDS = ${JSON.stringify((stats && stats.candidates) || [])};
  var TOKEN = ${JSON.stringify(user.sub_token)};
  var ORIGIN = ${JSON.stringify(origin)};
  var SELF = ORIGIN.replace('https://', '').replace('http://', '');
  var el = document.getElementById('iplist'), out = document.getElementById('ip-out');
  function nm(v){ return (v && typeof v === 'object') ? String(v.addr || v.ip || '') : String(v == null ? '' : v); }
  function kind(a){ if (a.indexOf(':') >= 0) return 'ipv6'; var c = a.charAt(0); return (c >= '0' && c <= '9') ? 'ipv4' : 'host'; }
  function cls(ms){ if (ms == null) return ''; return ms < 120 ? 'good' : ms > 600 ? 'bad' : ''; }
  var rows = CANDS.map(function(c){ return { addr: nm(c), ms: (c && c.ms != null ? c.ms : null), colo: (c && c.colo) || null, mbps: null }; })
    .filter(function(r){ return r.addr; });
  function render(){
    if (!rows.length) { el.innerHTML = '<div class="muted" style="font-size:11.5px">هنوز کاندیدی ثبت نشده.</div>'; return; }
    el.innerHTML = rows.slice(0, 14).map(function(r){
      var k = kind(r.addr), tag = k === 'host' ? 'دامنه' : k === 'ipv6' ? 'IPv6' : 'آی‌پی';
      var ms = r.ms == null ? '—' : r.ms + ' ms';
      return '<div class="ip"><b>' + r.addr + '</b><span class="muted" style="font-size:10.5px">' + tag + (r.colo ? ' · ' + r.colo : '') + '</span>' +
        '<span class="ms ' + cls(r.ms) + '">' + ms + (r.mbps ? ' · ' + r.mbps + ' Mbps' : '') + '</span>' +
        '<button class="star" data-addr="' + r.addr + '" title="این برای من خوب بود">★</button></div>';
    }).join('');
  }
  render();
  function probeHost(addr){
    return new Promise(function(res){
      var t0 = performance.now(), c = new AbortController();
      var to = setTimeout(function(){ c.abort(); res(null); }, 5000);
      fetch('https://' + addr + '/cdn-cgi/trace?x=' + Math.round(performance.now()), { mode: 'no-cors', cache: 'no-store', signal: c.signal })
        .then(function(){ clearTimeout(to); res(Math.round(performance.now() - t0)); })
        .catch(function(){ clearTimeout(to); res(null); });
    });
  }
  function speedTest(){
    var BYTES = 3 * 1024 * 1024;
    return new Promise(function(res){
      var t0 = performance.now(), c = new AbortController();
      var to = setTimeout(function(){ c.abort(); res(null); }, 30000);
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
  document.getElementById('ip-test').onclick = async function(){
    var btn = this; btn.disabled = true;
    out.textContent = 'در حال سنجش از شبکه‌ی خودت…';
    var hosts = rows.filter(function(r){ return kind(r.addr) !== 'ipv4' && kind(r.addr) !== 'ipv6'; });
    var res = await Promise.all(hosts.map(function(r){ return probeHost(r.addr); }));
    hosts.forEach(function(r, i){ r.ms = res[i]; });
    var sp = await speedTest();
    var self = rows.filter(function(r){ return r.addr === SELF || r.addr === ORIGIN; })[0];
    if (sp) {
      if (self) { self.ms = sp.ms; self.mbps = sp.mbps; }
      else rows.unshift({ addr: SELF, ms: sp.ms, mbps: sp.mbps, colo: null });
    }
    rows.sort(function(a, b){ return (a.ms == null ? 9e9 : a.ms) - (b.ms == null ? 9e9 : b.ms); });
    render();
    var good = rows.filter(function(r){ return r.ms != null; });
    out.textContent = sp
      ? (good.length + ' کاندید از شبکه‌ی تو جواب داد — سرعت پنل: ' + sp.mbps + ' Mbps. ستاره بزن تا برای همه اولویت بگیرد.')
      : 'سنجش انجام شد؛ اگر همه خالی بودند یعنی شبکه‌ات کلودفلر را محدود کرده — آی‌پی خام را در v2rayNG تست کن.';
    try {
      await fetch('/api/report-ip', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, results: good.map(function(r){ return { ip: r.addr, ms: r.ms, colo: r.colo, mbps: r.mbps }; }) }) });
    } catch (e) {}
    btn.disabled = false;
  };
  el.addEventListener('click', async function(ev){
    var b = ev.target.closest('.star'); if (!b) return;
    b.textContent = '★';
    try {
      await fetch('/api/report-ip', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, results: [{ ip: b.dataset.addr, ms: 1 }] }) });
      out.textContent = 'ممنون! ثبت شد و از این به بعد بالای ساب می‌آید.';
    } catch (e) {}
  });
})();
</script>
'''
s = s[:a] + new_ui + s[b:]
wr('src/links.js', s); print('  ✔ links.js — buildConfigs (همزاد پورت) + تستر دستگاه')

# ═══════════════════════════ ۴) panel.html ═══════════════════════════
s = rd('src/panel.html')

# ۴الف) برند
s = s.replace('<span>Kaveh v0.1.0</span>', '<span>Omni v1.0</span>', 1)
s = s.replace('\\xB7 \\u06A9\\u0627\\u0648\\u0647', '\\xB7 Omni', 1)
s = s.replace('\\xB7 Kaveh', '\\xB7 Omni', 1)

# ۴ب) دکمه‌ی اضافی «رتبه‌بندی از لبه» حذف — اسکنر یک دکمه‌ی واحد
old_btn = '''      <button class="btn" data-action="omni-rank">${d("db")} ${a(n("scanner.rank"))}</button>
      <button class="btn btn-primary" data-action="omni-scan">${d("play")} ${a(n("scanner.start"))}</button>'''
new_btn = '''      <button class="btn btn-primary" data-action="omni-scan">${d("play")} ${a(n("scanner.start"))}</button>'''
assert old_btn in s; s = s.replace(old_btn, new_btn, 1)

# ۴ج) ولت = اسکن کامل: دامنه/هاست از مرورگر + آی‌پی از لبه
i = s.index('async function Wt(e){')
j = s.index('async function Jt(e){')
new_wt = '''async function Wt(e){if(O.running)return;let o=[],s=[],i=e.settings();for(let x of(Oe(i.settings)||[]))s.push(x);
  for(let x of(safe(i.settings.address_domains)||[]))o.push(x);
  if(i.settings.public_host)o.push(String(i.settings.public_host).replace(/^https?:\\/\\//,"").replace(/\\/.*$/,""));
  O.running=!0,O.results=[...o.map(x=>({ip:x,ms:null,src:"browser"})),...s.map(x=>({ip:x,ms:null,src:"edge"}))],xe(O.results.length),
  se("سنجش از مرورگر (دامنه/هاست، گواهی معتبر) + رتبه‌بندی آی‌پی‌ها از لبه…");
  await Promise.all(o.map(async(x)=>{let r=O.results.find(y=>y.ip===x);r.ms=await Zt(x,4000);xe(O.results.length)}));
  try{let r=await b.rankIps(s,i.settings.public_host||""),m=new Set(r.ips||[]);
    O.results.forEach(y=>{if(y.src==="edge"){y.ms=m.has(y.ip)?0:-1;y.healthy=m.has(y.ip)}})}catch{}
  O.running=!1,xe(O.results.length);
  let k=O.results.filter(y=>y.ms!==null&&y.ms>=0).length;
  se(`${n("scanner.done")} — ${k}/${O.results.length} ${n("scanner.reachable")}`);
  let d=document.querySelector("#scan-apply");d&&(d.disabled=k===0)}'''
s = s[:i] + new_wt + s[j:]

# ۴د) اعمال: تفکیک دامنه → address_domains و آی‌پی → clean_ips
i = s.index('async function Kt(e){')
j = s.index('function Fe(e){return`')
new_kt = '''async function Kt(e){let r=O.results.filter(x=>x.ms!==null&&x.ms>=0).sort((x,y)=>x.ms-y.ms),
  dom=r.filter(x=>/[a-z]/i.test(x.ip)).slice(0,6).map(x=>x.ip),
  ips=r.filter(x=>!/[a-z]/i.test(x.ip)&&x.ip.indexOf(":")<0).slice(0,8).map(x=>x.ip);
  if(!dom.length&&!ips.length)return y(n("scanner.none"));
  let patch={};if(dom.length)patch.address_domains=dom;if(ips.length)patch.clean_ips=ips;
  await b.saveSettings(patch),e.setSettings({...e.settings(),...patch}),y(n("scanner.saved"))}'''
s = s[:i] + new_kt + s[j:]
wr('src/panel.html', s); print('  ✔ panel.html — اسکنر یکپارچه + اعمال تفکیک‌شده + برند Omni')

# ═══════════════════════════ ۵) مستندات ═══════════════════════════
s = rd('docs/QUICKSTART-fa.md')
if 'تستر دستگاه' not in s:
    anchor = '### 🤁 جفت‌های «دست‌دادن‌شده» (verified pairs) — چیزی که پینگ را نجات می‌دهد'
    add = '''### 🔬 تستر دستگاه (صفحه‌ی وضعیت) — موتور یادگیری پینگ

در `/status/<token>` دکمه‌ی **«تست از روی دستگاه من»** چه کار می‌کند:

1. **دامنه‌ها و هاست پنل** را از مرورگر خود کاربر (شبکه‌ی واقعی، مثلاً همراه اول) می‌سنجد —
   با گواهی معتبر، پس نتیجه‌اش واقعی است.
2. **سرعت دانلود واقعی** را از خود ورکر می‌گیرد (`/api/diag/speed`) → عدد Mbps.
3. هر کاندیدی که جواب بدهد در D1 ذخیره می‌شود و از آن لحظه **بالای همه‌ی ساب‌لینک‌ها** می‌آید.

آی‌پی **خام** را مرورگر نمی‌تواند بسنجد (گواهی TLS و ترافیک مختلط جلوی آن را می‌گیرد) — برای
آی‌پی‌ها معیار، «پینگ واقعی» خودِ v2rayNG و دکمه‌ی **★** در همین صفحه است.

### 🎛 اسکنر پنل (یک مسیر، صادقانه)

- دکمه‌ی «شروع اسکن» دامنه/هاست را **از مرورگر تو** و آی‌پی‌ها را **از لبه‌ی کلودفلر** می‌سنجد و
  هر ردیف برچسب منبع دارد.
- دکمه‌ی «افزودن برترین‌ها» دامنه‌های سالم را در `address_domains` و آی‌پی‌ها را در `clean_ips`
  می‌نویسد؛ از اسکن بعدی، کانفیگ‌ها با همان ترتیب ساخته می‌شوند.

'''
    assert anchor in s; s = s.replace(anchor, add + anchor, 1)
    wr('docs/QUICKSTART-fa.md', s); print('  ✔ docs — تستر دستگاه + اسکنر')
print('✅ patch7 تمام شد')
