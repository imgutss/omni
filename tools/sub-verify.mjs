/* ══════════════════════════════════════════════════════════════════════════
   Omni — tools/sub-verify.mjs
   «آیا کانفیگ‌ها پینگ می‌دهند و سرعت می‌دهند؟»

   این اسکریپت خودِ ساب‌لینک زنده را می‌گیرد، همه‌ی کانفیگ‌ها را پارس می‌کند و
   هرکدام را با اتصال واقعی WebSocket + هندشیک VLESS/Trojan تست می‌کند
   (همان کاری که v2rayNG انجام می‌دهد) و با --speed سرعت واقعی عبور داده
   از تونل را هم اندازه می‌گیرد.

   اجرا:
     node tools/sub-verify.mjs --password <admin> --who demo [--c 4]
       --speed [MB]    تست سرعت روی کانفیگ‌های سالم (پیش‌فرض ۳ مگابایت)
       --top N         فقط N کانفیگ سالم برای تست سرعت (پیش‌فرض 8)
       --domain-only   فقط کانفیگ‌های دامنه‌ی پنل
       --tcp-only      فقط تست TCP (سریع، بدون هندشیک پروکسی)
   ══════════════════════════════════════════════════════════════════════════ */
import WebSocket from 'ws';
import crypto from 'node:crypto';
import net from 'node:net';

const args = process.argv.slice(2);
const arg = (n, d = null) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const BASE = String(arg('base', process.env.OMNI_BASE || 'https://omni.rasa-744a56.workers.dev')).replace(/\/$/, '');
const USERNAME = String(arg('user', process.env.OMNI_USER || 'admin'));
const PASSWORD = String(arg('password', process.env.OMNI_PASS || ''));
const WHO = String(arg('who', 'demo'));
const TCP_ONLY = Boolean(arg('tcp-only', ''));
const DOMAIN_ONLY = Boolean(arg('domain-only', ''));
const CONC = Number(arg('c', 6));
const TARGET = String(arg('target', ''));                            // خالی = چند هدف چرخشی
const TARGETS = [['www.gnu.org', 80, '/'], ['deb.debian.org', 80, '/debian/'], ['info.cern.ch', 80, '/'], ['www.debian.org', 80, '/'], ['ftp.debian.org', 80, '/debian/']];
const TPORT = Number(arg('tport', 80));
const SPEED = arg('speed', '');                 // بدون مقدار = ۳ مگابایت
const SPEED_MB = SPEED === true || SPEED === '' ? 3 : Number(SPEED) || 3;
const TOP = Number(arg('top', 8));
const SPEED_HOST = String(arg('speed-host', 'deb.debian.org'));
const SPEED_PATH = '/debian/dists/stable/main/binary-amd64/Packages.gz';

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
if (PASSWORD) {
  const lg = await call('POST', '/api/login', { username: USERNAME, password: PASSWORD });
  if (!lg?.ok) { console.error('✖ ورود ناموفق'); process.exit(1); }
}
let u = await call('GET', `/api/users/${encodeURIComponent(WHO)}`);
if (!u?.user) u = await call('POST', '/api/users', { username: WHO, quota_gb: 5, expiry_days: 5 });
if (!u?.user) { console.error('✖ کاربر پیدا/ساخته نشد:', JSON.stringify(u)); process.exit(1); }
const subUrl = `${BASE}/s/${u.user.sub_token}?type=raw`;
const raw = await (await fetch(subUrl)).text();
const uris = raw.split('\n').map((x) => x.trim()).filter((x) => x.startsWith('vless://') || x.startsWith('trojan://'));

const parse = (uri) => {
  const m = uri.match(/^(vless|trojan):\/\/([^@]+)@(\[[^\]]+\]|[^:?#]+):(\d+)\?([^#]*)/);
  if (!m) return null;
  const q = new URLSearchParams(m[5]);
  const host = m[3].replace(/^\[|\]$/g, '');
  return {
    proto: m[1], cred: m[2], host, port: Number(m[4]), q,
    tls: q.get('security') === 'tls',
    sni: q.get('sni'), path: decodeURIComponent(q.get('path') || '/'),
    remark: decodeURIComponent((uri.split('#')[1] || '')),
  };
};

let list = uris.map(parse).filter(Boolean);
const hostOnly = (h) => /^[a-z]/i.test(h);
if (DOMAIN_ONLY) list = list.filter((c) => hostOnly(c.host));
console.log(`▸ ${list.length} کانفیگ از ${uris.length} تست می‌شود (هدف چرخشی: ${TARGETS.map((t) => t[0]).join(' / ')})${SPEED ? ` + سرعت ${SPEED_MB}MB` : ''}\n`);

const tcpPing = (host, port, timeout = 8000) => new Promise((res) => {
  const t0 = Date.now();
  const s = net.connect({ host, port });
  const done = (ok, note) => { try { s.destroy(); } catch {} res({ ok, ms: ok ? Date.now() - t0 : null, note }); };
  s.setTimeout(timeout);
  s.once('connect', () => done(true));
  s.once('timeout', () => done(false, 'timeout'));
  s.once('error', (e) => done(false, e.code || e.message));
});

/** هندشیک پروکسی: ساخت هدر VLESS/Trojan برای مقصد دلخواه */
function head(c, host, port) {
  if (c.proto === 'vless') {
    const ub = Buffer.from(c.cred.replace(/-/g, ''), 'hex');
    const hb = Buffer.from(host, 'utf8');
    return Buffer.concat([Buffer.from([0]), ub, Buffer.from([0]), Buffer.from([1]),
      Buffer.from([port >> 8, port & 255]), Buffer.from([2, hb.length]), hb]);
  }
  const pw = Buffer.from(crypto.createHash('sha224').update(c.cred).digest('hex'), 'utf8');
  const hb = Buffer.from(host, 'utf8');
  return Buffer.concat([pw, Buffer.from('\r\n'), Buffer.from([1]), Buffer.from([3, hb.length]), hb,
    Buffer.from([port >> 8, port & 255]), Buffer.from('\r\n')]);
}

/** یک تونل باز می‌کند و درخواست HTTP داخلش می‌فرستد */
function throughTunnel(c, { host, port, path: reqPath, bytes = 0, timeout = 15000, label = '' }) {
  return new Promise((res) => {
    const url = `${c.tls ? 'wss' : 'ws'}://${c.host.includes(':') ? `[${c.host}]` : c.host}:${c.port}${c.path}`;
    let done = false, got = '', dataBytes = 0, ws, code = '';
    const t0 = Date.now();
    const finish = (ok, note) => {
      if (done) return; done = true;
      clearTimeout(t);
      try { ws?.close(); } catch {}
      const ms = Date.now() - t0;
      res({ ...c, ok, ms, note, code, mbps: dataBytes ? (dataBytes * 8) / (ms / 1000) / 1e6 : null, bytes: dataBytes });
    };
    const t = setTimeout(() => finish(false, 'timeout'), timeout);
    try {
      ws = new WebSocket(url, {
        servername: c.tls ? c.sni : undefined,
        headers: { Host: c.q.get('host') || c.sni || c.host, 'user-agent': 'omni-verify' },
        rejectUnauthorized: false, handshakeTimeout: 10000,
      });
    } catch (e) { return finish(false, e.message); }
    ws.on('open', () => {
      const req = `GET ${reqPath} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0 (Linux; Android 13) omni-verify\r\nAccept: */*\r\nConnection: close\r\n\r\n`;
      ws.send(Buffer.concat([head(c, host, port), Buffer.from(req)]));
    });
    ws.on('message', (d) => {
      const buf = Buffer.from(d);
      dataBytes += buf.length;
      if (!code) {
        got += buf.toString('latin1');
        const i = got.indexOf('HTTP/1.');
        if (i < 0) return;
        const eol = got.indexOf('\r\n', i);
        code = got.slice(i, eol > i ? eol : i + 30);
        if (!bytes) return finish(true, code);
      }
      if (bytes && dataBytes >= bytes) finish(true, `${code} · ${(dataBytes / 1048576).toFixed(1)}MB`);
    });
    ws.on('close', (cl) => finish(got.includes('HTTP/1.'), got.split('\r\n')[0] || `close ${cl}`));
    ws.on('unexpected-response', (_req, resp) => { let b = ''; resp.on('data', (d) => (b += d)); resp.on('end', () => finish(false, `HTTP ${resp.statusCode} ${b.slice(0, 40)}`)); });
    ws.on('error', (e) => finish(false, e.message.split('\n')[0].slice(0, 70)));
  });
}

let ti = 0;
const proxyTest = (c) => {
  const [h, p, path] = TARGET ? [TARGET, TPORT, '/'] : TARGETS[ti++ % TARGETS.length];
  return throughTunnel(c, { host: h, port: p, path, label: h });
};

const results = [];
let i = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (i < list.length) {
    const c = list[i++];
    if (TCP_ONLY) {
      const p = await tcpPing(c.host, c.port);
      results.push({ ...c, ok: p.ok, ms: p.ms, note: p.note });
    } else {
      results.push(await proxyTest(c));
    }
  }
}));

results.sort((a, b) => (a.ok === b.ok ? (a.ms ?? 9e9) - (b.ms ?? 9e9) : a.ok ? -1 : 1));
console.log('┌────────────────────────────┬──────┬──────┬────────┬───────────────────────────');
for (const r of results) {
  const addr = `${r.host}:${r.port}`.padEnd(26).slice(0, 26);
  const skip = r.note === 'SKIP-IPv6';
  const mark = r.ok ? '✅' : skip ? '⏭️ ' : '❌';
  console.log(`│ ${addr} │ ${String(r.port).padStart(4)} │ ${(r.tls ? 'TLS ' : 'PLAIN')} │ ${mark} ${String(r.ms ?? '-').padStart(5)}ms │ ${(skip ? 'این شبکه IPv6 ندارد' : (r.note || '')).slice(0, 26)}`);
}
const okN = results.filter((r) => r.ok).length;
const skipN = results.filter((r) => r.note === 'SKIP-IPv6').length;
console.log('└────────────────────────────┴──────┴──────┴─────────────────────────────');
console.log(`\n▸ ${okN}/${results.length - skipN} کانفیگ سالم${skipN ? ` (+${skipN} کانفیگ IPv6 که این شبکه IPv6 ندارد)` : ''} — ${okN ? 'آماده‌ی استفاده' : 'هیچ‌کدام!'}`);

/* ── تست سرعت: عبور واقعی داده از تونل ─────────────────────────────────── */
if (SPEED && okN) {
  const uniq = [];
  const seen = new Set();
  for (const r of results.filter((r) => r.ok)) {
    const k = `${r.host}:${r.port}`;
    if (seen.has(k)) continue;
    seen.add(k); uniq.push(r);
    if (uniq.length >= TOP) break;
  }
  console.log(`\n▸ تست سرعت روی ${uniq.length} کانفیگ (هرکدام ${SPEED_MB} مگابایت از ${SPEED_HOST})…`);
  const SPEED_BYTES = SPEED_MB * 1048576;
  const sp = [];
  let j = 0;
  await Promise.all(Array.from({ length: Math.min(3, uniq.length) }, async () => {
    while (j < uniq.length) {
      const c = uniq[j++];
      const r = await throughTunnel(c, { host: SPEED_HOST, port: 80, path: SPEED_PATH, bytes: SPEED_BYTES, timeout: 60000 });
      sp.push(r);
    }
  }));
  sp.sort((a, b) => (b.mbps ?? -1) - (a.mbps ?? -1));
  console.log('┌────────────────────────────┬──────────┬──────────');
  for (const r of sp) {
    console.log(`│ ${`${r.host}:${r.port}`.padEnd(26).slice(0, 26)} │ ${(r.mbps ? `${r.mbps.toFixed(1)} Mbps` : '❌').padStart(8)} │ ${String(r.ms ? `${r.ms}ms` : r.note || '').padStart(8)}`);
  }
  console.log('└────────────────────────────┴──────────┴──────────');
  const best = sp.find((r) => r.mbps);
  if (best) console.log(`▸ بهترین: ${best.host}:${best.port} — ${best.mbps.toFixed(1)} Mbps`);
}
const byProto = ['vless', 'trojan'].map((p) => `${p}: ${results.filter((r) => r.ok && r.proto === p).length}/${results.filter((r) => r.proto === p).length}`).join('  |  ');
console.log(`▸ ${byProto}`);
console.log(`▸ ساب‌لینک: ${BASE}/s/${u.user.sub_token}`);
