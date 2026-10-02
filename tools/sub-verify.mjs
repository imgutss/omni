/* ══════════════════════════════════════════════════════════════════════════
   Omni — tools/sub-verify.mjs
   «آیا کانفیگ‌ها پینگ می‌دهند؟» — این اسکریپت خودِ ساب‌لینک را می‌گیرد،
   تمام کانفیگ‌ها را پارس می‌کند و هرکدام را با اتصال واقعی WebSocket +
   هندشیک VLESS/Trojan تست می‌کند (همان کاری که v2rayNG انجام می‌دهد).

   اجرا:
     node tools/sub-verify.mjs --base https://<worker> --password <admin> [--user demo]
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
const TARGET = String(arg('target', 'www.gnu.org'));
const TPORT = Number(arg('tport', 80));

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
if (!u?.user) {
  u = await call('POST', '/api/users', { username: WHO, quota_gb: 5, expiry_days: 5 });
}
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
console.log(`▸ ${list.length} کانفیگ از ${uris.length} تست می‌شود (هدف: ${TARGET}:${TPORT})\n`);

const tcpPing = (host, port, timeout = 8000) => new Promise((res) => {
  const t0 = Date.now();
  const s = net.connect({ host, port });
  const done = (ok, note) => { try { s.destroy(); } catch {} res({ ok, ms: ok ? Date.now() - t0 : null, note }); };
  s.setTimeout(timeout);
  s.once('connect', () => done(true));
  s.once('timeout', () => done(false, 'timeout'));
  s.once('error', (e) => done(false, e.code || e.message));
});

function proxyTest(c) {
  return new Promise((res) => {
    const url = `${c.tls ? 'wss' : 'ws'}://${c.host.includes(':') ? `[${c.host}]` : c.host}:${c.port}${c.path}`;
    let done = false, got = '', ws;
    const t0 = Date.now();
    const finish = (ok, note) => {
      if (done) return; done = true;
      clearTimeout(t);
      try { ws?.close(); } catch {}
      res({ ...c, ok, ms: ok ? Date.now() - t0 : null, note });
    };
    const t = setTimeout(() => finish(false, 'timeout'), 15000);
    try {
      ws = new WebSocket(url, {
        servername: c.tls ? c.sni : undefined,
        headers: { Host: c.q.get('host') || c.sni || c.host, 'user-agent': 'omni-verify' },
        rejectUnauthorized: false, handshakeTimeout: 10000,
      });
    } catch (e) { return finish(false, e.message); }
    ws.on('open', () => {
      let head;
      if (c.proto === 'vless') {
        const ub = Buffer.from(c.cred.replace(/-/g, ''), 'hex');
        head = Buffer.concat([Buffer.from([0]), ub, Buffer.from([0]), Buffer.from([1]),
          Buffer.from([TPORT >> 8, TPORT & 255]), Buffer.from([2, TARGET.length]), Buffer.from(TARGET)]);
      } else {
        const pw = Buffer.from(crypto.createHash('sha224').update(c.cred).digest('hex'), 'utf8');
        head = Buffer.concat([pw, Buffer.from('\r\n'), Buffer.from([1]), Buffer.from([3, TARGET.length]), Buffer.from(TARGET), Buffer.from([TPORT >> 8, TPORT & 255]), Buffer.from('\r\n')]);
      }
      ws.send(Buffer.concat([head, Buffer.from(`GET / HTTP/1.1\r\nHost: ${TARGET}\r\nUser-Agent: omni\r\nConnection: close\r\n\r\n`)]));
    });
    ws.on('message', (d) => { got += Buffer.from(d).toString('latin1'); if (got.includes('HTTP/1.')) finish(true, got.split('\r\n')[0]); });
    ws.on('close', (code) => finish(got.includes('HTTP/1.'), `close ${code}`));
    ws.on('unexpected-response', (_req, resp) => { let b = ''; resp.on('data', (d) => (b += d)); resp.on('end', () => finish(false, `HTTP ${resp.statusCode} ${b.slice(0, 40)}`)); });
    ws.on('error', (e) => finish(false, e.message.split('\n')[0].slice(0, 70)));
  });
}

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
  const addr = `${r.host}${r.host.includes(':') ? '' : ''}:${r.port}`.padEnd(26).slice(0, 26);
  console.log(`│ ${addr} │ ${String(r.port).padStart(4)} │ ${(r.tls ? 'TLS ' : 'PLAIN')} │ ${r.ok ? '✅' : '❌'} ${String(r.ms ?? '-').padStart(5)}ms │ ${(r.note || '').slice(0, 26)}`);
}
const okN = results.filter((r) => r.ok).length;
console.log(`└────────────────────────────┴──────┴──────┴─────────────────────────────`);
console.log(`\n▸ ${okN}/${results.length} کانفیگ سالم — ${okN ? 'آماده‌ی استفاده' : 'هیچ‌کدام!'}`);
const byProto = ['vless', 'trojan'].map((p) => `${p}: ${results.filter((r) => r.ok && r.proto === p).length}/${results.filter((r) => r.proto === p).length}`).join('  |  ');
console.log(`▸ ${byProto}`);
console.log(`▸ ساب‌لینک: ${BASE}/s/${u.user.sub_token}`);
