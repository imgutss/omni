/* ══════════════════════════════════════════════════════════════════════════
   Omni — tools/pool-scan.mjs
   اسکنر قدرتمند استخر آی‌پی تمیز: هر جفت (آی‌پی × پورت) با «اتصال واقعی
   WebSocket + هندشیک VLESS» تست می‌شود — همان کاری که کلاینت انجام می‌دهد.
   نتیجه‌ی سالم‌ها در پنل ذخیره می‌شود (clean_ips + verified_pairs) و از آن
   به بعد در ساب‌لینک همه‌ی کاربران به‌عنوان بهترین گزینه‌ها می‌آید.

   اجرا (از هر جایی بیرون از ایران — مثلاً همین دستگاه):
     node tools/pool-scan.mjs --base https://<worker> --password <admin> [--ipv6] [--full]

   گزینه‌ها:
     --ipv6    IPv6 هم تست شود
     --full    همه‌ی ۱۳ پورت (پیش‌فرض ۶ پورت کلیدی)
     --c 16    همزمانی (پیش‌فرض ۱۰)
   ══════════════════════════════════════════════════════════════════════════ */
import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const arg = (name, def = null) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : def;
};
const BASE = String(arg('base', process.env.OMNI_BASE || 'https://omni.rasa-744a56.workers.dev')).replace(/\/$/, '');
const USERNAME = String(arg('user', process.env.OMNI_USER || 'admin'));
const PASSWORD = String(arg('password', process.env.OMNI_PASS || ''));
const CONC = Number(arg('c', 10));
const TARGET = String(arg('target', 'www.gnu.org'));
const TPORT = Number(arg('tport', 80));
if (!PASSWORD) { console.error('✖ رمز مدیر لازم است:  --password <رمز>'); process.exit(1); }

const PORTS = arg('full')
  ? [80, 8080, 8880, 2052, 2082, 2086, 2095, 443, 2053, 2083, 2087, 2096, 8443]
  : [80, 443, 8080, 2053, 2087, 8443];
const IPS = String(arg('ips', '')).split(',').map((x) => x.trim()).filter(Boolean);
const TLS_PORTS = [443, 2053, 2083, 2087, 2096, 8443];

/* ── ورود و گرفتن اطلاعات ── */
let cookie = '';
const call = async (m, p, body, raw = false) => {
  const h = {};
  if (body) h['content-type'] = 'application/json';
  if (cookie) h.cookie = cookie;
  if (m !== 'GET') h['x-kaveh-csrf'] = '1';
  const r = await fetch(BASE + p, { method: m, headers: h, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return raw ? r : r.json().catch(() => null);
};

const lg = await call('POST', '/api/login', { username: USERNAME, password: PASSWORD });
if (!lg?.ok) { console.error('✖ ورود ناموفق:', JSON.stringify(lg)); process.exit(1); }
const st = (await call('GET', '/api/settings'))?.settings || {};
const path = st.path || '/ws';
const HOST = st.public_host || new URL(BASE).host;

let u = await call('POST', '/api/users', { username: 'pool-scan', quota_gb: 1, expiry_days: 2 });
if (u?.code === 'exists') u = await call('GET', '/api/users/pool-scan');
const uuid = u?.user?.uuid;
if (!uuid) { console.error('✖ ساخت کاربر تست ناموفق:', JSON.stringify(u)); process.exit(1); }
console.log(`▸ پایه: ${BASE}\n▸ path: ${path}  |  دامنه: ${HOST}  |  هدف تست: ${TARGET}:${TPORT}`);

/* ── کاندیدها ── */
let candidates = IPS;
if (!candidates.length) {
  candidates = [...new Set([
    ...String(st.ip_pool || '').split(/[\n,\s]+/).filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x)),
    ...String(st.clean_ips || '').replace(/[[\]"']/g, '').split(/[\n,\s,]+/).filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x)),
    ...(await call('GET', '/api/fragments'))?.ports ? [] : [],
  ])];
}
const frag = await call('GET', '/api/fragments');
if (String(arg('ipv6', ''))) {
  const ipv6 = ['2606:4700:3033::6815:1e29', '2606:4700:3037::6815:32a1', '2606:4700:3030::ac43:49a1', '2606:4700:3034::6815:4a1'];
  candidates.push(...ipv6);
}
console.log(`▸ ${candidates.length} آی‌پی × ${PORTS.length} پورت = ${candidates.length * PORTS.length} تست\n`);

/* ── پروب واقعی ── */
const frame = () => {
  const ub = Buffer.from(uuid.replace(/-/g, ''), 'hex');
  return Buffer.concat([
    Buffer.from([0]), ub, Buffer.from([0]), Buffer.from([1]),
    Buffer.from([TPORT >> 8, TPORT & 255]), Buffer.from([2, TARGET.length]), Buffer.from(TARGET),
    Buffer.from(`GET / HTTP/1.1\r\nHost: ${TARGET}\r\nUser-Agent: omni-pool\r\nConnection: close\r\n\r\n`),
  ]);
};

function probe(ip, port) {
  return new Promise((res) => {
    const tls = TLS_PORTS.includes(port);
    const url = `${tls ? 'wss' : 'ws'}://${ip.includes(':') ? `[${ip}]` : ip}:${port}${path}`;
    let done = false, got = '', ws;
    const t0 = Date.now();
    const finish = (ok, note) => {
      if (done) return; done = true;
      clearTimeout(t);
      try { ws?.close(); } catch {}
      res({ ip, port, ok, ms: ok ? Date.now() - t0 : null, note });
    };
    const t = setTimeout(() => finish(false, 'timeout'), 12000);
    try {
      ws = new WebSocket(url, { servername: tls ? HOST : undefined, headers: { Host: HOST, 'user-agent': 'omni-pool' }, rejectUnauthorized: false, handshakeTimeout: 9000 });
    } catch (e) { return finish(false, e.message); }
    ws.on('open', () => ws.send(frame()));
    ws.on('message', (d) => { got += Buffer.from(d).toString('latin1'); if (got.includes('HTTP/1.')) finish(true, got.split('\r\n')[0]); });
    ws.on('close', (c) => finish(got.includes('HTTP/1.'), `close ${c}`));
    ws.on('error', (e) => finish(false, e.message.split('\n')[0].slice(0, 60)));
  });
}

const jobs = [];
for (const ip of candidates) for (const port of PORTS) jobs.push([ip, port]);
const found = [];
let i = 0, doneN = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (i < jobs.length) {
    const [ip, port] = jobs[i++];
    const r = await probe(ip, port);
    doneN++;
    if (r.ok) { found.push(r); console.log(`  ✅ ${ip}:${port}  ${r.ms}ms`); }
    else if (process.env.VERBOSE) console.log(`  ·  ${ip}:${port} → ${r.note}`);
    if (doneN % 25 === 0) console.log(`  … ${doneN}/${jobs.length}`);
  }
}));

/* ── رتبه‌بندی و ذخیره در پنل ── */
found.sort((a, b) => a.ms - b.ms);
const bestPerIp = new Map();
for (const r of found) if (!bestPerIp.has(r.ip)) bestPerIp.set(r.ip, r);   // نخستین = سریع‌ترین پورت هر آی‌پی

/* تنوع: از هر آی‌پی حداکثر ۳ جفت، جمعاً ۲۴ جفت */
const pairs = [];
const perIp = new Map();
for (const r of found) {
  const c = perIp.get(r.ip) || 0;
  if (c >= 3 || pairs.length >= 24) continue;
  perIp.set(r.ip, c + 1);
  pairs.push(`${r.ip}:${r.port}`);
}
const ips = [...new Set(pairs.map((x) => x.split(':')[0]))];

console.log(`\n▸ ${found.length} جفت سالم از ${jobs.length} تست`);
console.log(`▸ آی‌پی‌های برتر: ${[...bestPerIp.values()].slice(0, 10).map((r) => `${r.ip}:${r.port}(${r.ms}ms)`).join(', ')}`);

const save = await call('PUT', '/api/settings', {
  verified_pairs: JSON.stringify(pairs),
  clean_ips: ips,
  ip_pool: ips.join('\n'),
});
console.log(save?.ok ? `\n✅ در پنل ذخیره شد — ${pairs.length} جفت تأییدشده و ${ips.length} آی‌پی\n` : `\n⚠️ ذخیره‌سازی ناموفق: ${JSON.stringify(save)}\n`);

const out = { at: new Date().toISOString(), base: BASE, target: `${TARGET}:${TPORT}`, tested: jobs.length, found, pairs };
writeFileSync('pool-scan-report.json', JSON.stringify(out, null, 1));
console.log('▸ گزارش: pool-scan-report.json');
await call('DELETE', '/api/users/pool-scan');
