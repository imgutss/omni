/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/links.js
   ساخت لینک‌های VLESS/Trojan، ساب‌لینک (base64/clash/sing-box) و صفحه‌ی وضعیت
   ══════════════════════════════════════════════════════════════════════════ */

const enc = encodeURIComponent;

/* پریست‌های فرگمنت (برای عبور بهتر از فیلترینگ) */
export const FRAGMENT_PRESETS = [
  { id: 'none', label: '— بدون فرگمنت', value: '' },
  { id: 'mci', label: 'همراه اول (MCI)', value: '1,40-60,30-50,tlshello' },
  { id: 'irancell', label: 'ایرانسل (Irancell)', value: '1,10-20,10-20,tlshello' },
  { id: 'tci', label: 'مخابرات (TCI)', value: '1,50-100,20-40,tlshello' },
  { id: 'soft', label: 'ملایم (Soft)', value: '1,30-40,20-30,tlshello' },
  { id: 'aggressive', label: 'تهاجمی (Aggressive)', value: '2,1-3,1-3,tlshello' },
];
export const FINGERPRINTS = ['chrome', 'firefox', 'safari', 'ios', 'android', 'edge', 'random', 'randomized'];

export const fragmentValue = (id) => (FRAGMENT_PRESETS.find((p) => p.id === id) || { value: '' }).value;

/** آدرس‌های مورد استفاده برای ساخت کانفیگ: آی‌پی‌های کاربر → آی‌پی‌های تمیز → دامنه */
export function addressesFor(user, settings, cleanIps = []) {
  const list = [];
  const push = (h) => { if (h && !list.includes(h)) list.push(h); };
  const userIps = safeArray(user?.ips);
  if (userIps.length) userIps.forEach(push);
  else if (cleanIps?.length) cleanIps.slice(0, 12).forEach((r) => push(typeof r === 'string' ? r : r.ip));
  const host = settings.public_host || '';
  if (host) push(host);
  return list;
}

export function safeArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string' && v.trim()) {
    try {
      const j = JSON.parse(v);
      if (Array.isArray(j)) return j.filter(Boolean);
    } catch { /* خط‌به‌خط یا کامایی */ }
    return v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** یک لینک VLESS برای یک آدرس مشخص */
export function vlessUri(user, settings, host, { index = 1, total = 1, tag = '' } = {}) {
  const port = settings.port || '443';
  const fp = user.fingerprint || settings.fingerprint || 'chrome';
  const path = encodeURIComponent(settings.path || '/ws');
  const ed = user.early_data || settings.early_data || 2048;
  const frag = fragmentValue(user.fragment || settings.fragment_preset);
  const params = [
    'encryption=none',
    'security=tls',
    `sni=${host}`,
    `fp=${fp}`,
    'type=ws',
    `host=${host}`,
    `path=${path}`,
    'alpn=http%2F1.1',
    `ed=${ed}`,
  ];
  if (frag) params.push(`fragment=${encodeURIComponent(frag)}`);
  if (settings.mux_enabled === '1') params.push('mux=1');
  const remark = `${settings.remark_prefix || ''}${user.username}${tag || (total > 1 ? `-${index}` : '')}`;
  return `vless://${user.uuid}@${host}:${port}?${params.join('&')}#${enc(remark)}`;
}

export function trojanUri(user, settings, host, { tag = '' } = {}) {
  const port = settings.port || '443';
  const fp = user.fingerprint || settings.fingerprint || 'chrome';
  const path = encodeURIComponent(settings.path || '/ws');
  const params = [`security=tls`, `sni=${host}`, `fp=${fp}`, 'type=ws', `host=${host}`, `path=${path}`, 'alpn=http%2F1.1'];
  const remark = `${settings.remark_prefix || ''}${user.username}${tag}`;
  return `trojan://${settings.trojan_password || ''}@${host}:${port}?${params.join('&')}#${enc(remark)}`;
}

/** همه‌ی لینک‌های یک کاربر + آبجکت configs که پنل انتظار دارد */
export function buildConfigs(user, settings, cleanIps = []) {
  const addrs = addressesFor(user, settings, cleanIps);
  const uris = [];
  addrs.forEach((h, i) => {
    uris.push(vlessUri(user, settings, h, { index: i + 1, total: addrs.length }));
    if (settings.proto === 'both' && settings.trojan_password) {
      uris.push(trojanUri(user, settings, h, { tag: '-tr' }));
    }
  });
  return {
    uris,
    host: addrs[0] || settings.public_host || '',
    addresses: addrs,
    singbox: buildSingbox(user, settings, addrs),
    clash: buildClash(user, settings, addrs),
  };
}

/* ─────────────── sing-box / clash ─────────────── */
function sbOutbound(user, settings, host) {
  const path = settings.path || '/ws';
  return {
    type: 'vless',
    tag: `omni-${user.username}-${host}`.slice(0, 60),
    server: host,
    server_port: Number(settings.port || 443),
    uuid: user.uuid,
    flow: '',
    tls: {
      enabled: true,
      server_name: host,
      insecure: false,
      alpn: ['http/1.1'],
      utls: { enabled: true, fingerprint: user.fingerprint || settings.fingerprint || 'chrome' },
    },
    transport: { type: 'ws', path, headers: { Host: host }, early_data_header_name: 'Sec-WebSocket-Protocol' },
  };
}

export function buildSingbox(user, settings, addrs) {
  const outs = addrs.map((h) => sbOutbound(user, settings, h));
  return {
    log: { level: 'warn' },
    dns: {
      servers: [{ tag: 'cf', address: settings.dns_upstream || 'https://1.1.1.1/dns-query', strategy: 'ipv4_only' }],
      strategy: 'ipv4_only',
    },
    inbounds: [
      { type: 'mixed', tag: 'mixed-in', listen: '127.0.0.1', listen_port: 2334 },
      { type: 'tun', tag: 'tun-in', address: ['172.19.0.1/30'], auto_route: true, strict_route: true },
    ],
    outbounds: [
      ...outs.map((o, i) => ({ ...o, tag: `omni-${i + 1}` })),
      { type: 'selector', tag: 'select', outbounds: outs.map((o, i) => `omni-${i + 1}`), default: 'omni-1' },
      { type: 'direct', tag: 'direct' },
      { type: 'block', tag: 'block' },
    ],
    route: {
      rules: [
        { protocol: 'dns', outbound: 'dns-out' },
        { ip_is_private: true, outbound: 'direct' },
      ],
      final: 'select',
      auto_detect_interface: true,
    },
    experimental: { cache_file: { enabled: true, store_fakeip: false } },
  };
}

export function buildClash(user, settings, addrs) {
  const path = settings.path || '/ws';
  const proxies = addrs.map((h, i) => ({
    name: `omni-${i + 1}`,
    type: 'vless',
    server: h,
    port: Number(settings.port || 443),
    uuid: user.uuid,
    tls: true,
    servername: h,
    network: 'ws',
    'ws-opts': { path, headers: { Host: h } },
    'client-fingerprint': user.fingerprint || settings.fingerprint || 'chrome',
    udp: true,
  }));
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
    rules: ['MATCH,🚀 Omni'],
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
