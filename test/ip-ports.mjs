/* ماتریس تست: (آدرس × پورت) — آیا مسیر WS/WSS تا ورکر Omni باز است؟
   الگوی دقیق کاری کلاینت‌ها: اتصال به آی‌پی/دامنه، با Host و SNI = دامنه‌ی پنل. */
import WebSocket from 'ws';

const BASE = process.env.LIVE_BASE || 'https://omni.rasa-744a56.workers.dev';
const HOST = BASE.replace(/^https:\/\//, '');
const PW = process.env.PW;
const TARGET = process.env.TARGET || 'www.gnu.org';
const TPORT = Number(process.env.TPORT || 80);

const ADDRS = (process.env.ADDRS || `${HOST},172.67.73.161,104.17.209.9,104.21.32.115,104.26.12.188,162.159.140.38,172.67.12.188,172.67.182.201,104.16.18.15,104.17.24.15,104.21.64.1,172.67.73.88,104.26.10.12,104.18.32.115,188.114.97.7,188.114.96.1,162.159.192.1,162.159.36.1,162.159.193.1`).split(',');
const PORTS = (process.env.PORTS || '80,8080,8880,2052,2082,2086,2095,443,2053,2083,2087,2096,8443').split(',').map(Number);

let cookie = '';
const req = async (m, p, body) => {
  const h = {};
  if (body) h['content-type'] = 'application/json';
  if (cookie) h.cookie = cookie;
  if (m !== 'GET') h['x-omni-csrf'] = '1';
  const r = await fetch(BASE + p, { method: m, headers: h, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  let b = null; try { b = await r.json(); } catch {}
  return { status: r.status, body: b };
};

const lg = await req('POST', '/api/login', { username: 'admin', password: PW });
if (!lg.body?.ok) { console.log('login failed', JSON.stringify(lg.body)); process.exit(1); }
const st = await req('GET', '/api/settings');
const path = st.body.settings.path;
let u = await req('POST', '/api/users', { username: 'ip-test', quota_gb: 1, expiry_days: 3 });
if (u.body?.code === 'exists') u = await req('GET', '/api/users/ip-test');
if (!u.body?.user) { console.log('user failed', JSON.stringify(u.body)); process.exit(1); }
const uuid = u.body.user.uuid;
console.log(`دامنه: ${HOST} | path: ${path} | uuid: ${uuid.slice(0, 8)}…\n`);

const frame = () => {
  const ub = Buffer.from(uuid.replace(/-/g, ''), 'hex');
  return Buffer.concat([
    Buffer.from([0]), ub, Buffer.from([0]), Buffer.from([1]),
    Buffer.from([TPORT >> 8, TPORT & 255]), Buffer.from([2, TARGET.length]), Buffer.from(TARGET),
    Buffer.from(`GET / HTTP/1.1\r\nHost: ${TARGET}\r\nUser-Agent: probe\r\nConnection: close\r\n\r\n`),
  ]);
};

function probe(addr, port) {
  return new Promise((r) => {
    const tls = [443, 2053, 2083, 2087, 2096, 8443].includes(port);
    const url = `${tls ? 'wss' : 'ws'}://${addr.includes(':') ? `[${addr}]` : addr}:${port}${path}`;
    let done = false, got = '', ws;
    const finish = (ok, note) => {
      if (done) return; done = true;
      clearTimeout(t);
      try { ws?.close(); } catch {}
      r({ addr, port, ok, note });
    };
    const t = setTimeout(() => finish(false, 'timeout'), 12000);
    try {
      ws = new WebSocket(url, { servername: tls ? HOST : undefined, headers: { Host: HOST, 'user-agent': 'omni-probe' }, rejectUnauthorized: false, handshakeTimeout: 9000 });
    } catch (e) { return finish(false, e.message); }
    ws.on('open', () => ws.send(frame()));
    ws.on('message', (d) => { got += Buffer.from(d).toString('latin1'); if (got.includes('HTTP/1.')) finish(true, got.split('\r\n')[0]); });
    ws.on('close', (c) => finish(got.includes('HTTP/1.'), `close ${c}`));
    ws.on('error', (e) => finish(false, e.message.split('\n')[0].slice(0, 60)));
  });
}

const okList = [], badList = [];
const CONC = Number(process.env.CONC || 10);
const jobs = [];
for (const addr of ADDRS) for (const port of PORTS) jobs.push([addr, port]);
let idx = 0;
const rows = new Map(ADDRS.map((a) => [a, {}]));
await Promise.all(Array.from({ length: CONC }, async () => {
  while (idx < jobs.length) {
    const [addr, port] = jobs[idx++];
    const res = await probe(addr, port);
    rows.get(addr)[port] = res.ok;
    (res.ok ? okList : badList).push(res);
  }
}));
console.log('آدرس'.padEnd(18) + PORTS.map((p) => String(p).padStart(6)).join(''));
for (const addr of ADDRS) {
  const label = addr === HOST ? 'دامنه' : addr;
  console.log(label.padEnd(18) + PORTS.map((p) => (rows.get(addr)[p] ? '   ✅' : '    ·').padStart(6)).join(''));
}
console.log(`\n── کار می‌کند: ${okList.length} از ${okList.length + badList.length}`);
const ports = [...new Set(okList.map((x) => x.port))].sort((a, b) => a - b);
const addrs = [...new Set(okList.map((x) => x.addr))];
console.log('پورت‌های سالم:', ports.join(', '));
console.log('آدرس‌های سالم:', addrs.join(', '));
if (process.env.REPORT) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(process.env.REPORT, JSON.stringify({ at: new Date().toISOString(), ports, addrs,
    matrix: Object.fromEntries([...rows].map(([a, m]) => [a, m])) }, null, 1));
}
await req('DELETE', '/api/users/ip-test');
