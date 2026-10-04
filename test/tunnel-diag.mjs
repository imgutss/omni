/* عیب‌یابی تونل روی ورکر زنده (با خروجی کامل) */
import crypto from 'node:crypto';
import WebSocket from 'ws';

const BASE = process.env.LIVE_BASE || 'https://omni.rasa-744a56.workers.dev';
const TARGET = process.env.TARGET || 'www.gnu.org';
const TPORT = Number(process.env.TPORT || 80);
const HOST = BASE.replace(/^https:\/\//, '');
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

const login = await req('POST', '/api/login', { username: 'admin', password: process.env.PW });
console.log('login:', login.status, JSON.stringify(login.body));
const st = await req('GET', '/api/settings');
const S = st.body?.settings || {};
const path = S.path;
console.log('path =', path, '| proto =', S.proto, '| trojan_password =', JSON.stringify(S.trojan_password)?.slice(0, 24), '| public_host =', S.public_host);

const u = await req('GET', '/api/users/omni-live');
console.log('user used_bytes =', u.body?.user?.used_bytes, '| status =', u.body?.user?.status);
const uuid = u.body?.user?.uuid;

function tunnel(name, makeHeader, label) {
  return new Promise((res) => {
    const ws = new WebSocket(`wss://${HOST}${path}`, { headers: { 'user-agent': 'omni-diag' } });
    ws.binaryType = 'arraybuffer';
    let got = Buffer.alloc(0);
    const t = setTimeout(() => { dump(name, 'TIMEOUT', got); try { ws.close(); } catch {} res(); }, 15000);
    ws.on('open', () => ws.send(makeHeader()));
    ws.on('message', (d) => {
      const chunk = Buffer.from(d);
      console.log(`   [${name}] frame ${chunk.length}B: ${JSON.stringify(chunk.toString('latin1').slice(0, 80))}`);
      got = Buffer.concat([got, chunk]);
      if (got.includes(Buffer.from('Example Domain')) || got.includes(Buffer.from('HTTP/1.1'))) { dump(name, 'RESPONSE ✅', got); clearTimeout(t); try { ws.close(); } catch {} res(); }
    });
    ws.on('close', (c, r) => { dump(name, `CLOSE ${c} ${r.toString()} total=${got.length}B`, got); clearTimeout(t); res(); });
    ws.on('error', (e) => { dump(name, 'ERROR ' + e.message, got); clearTimeout(t); res(); });
  });
}
function dump(name, status, buf) {
  console.log(`\n── ${name}: ${status}`);
  if (buf.length) console.log('   دریافت:', JSON.stringify(buf.toString('latin1').slice(0, 300)));
}

const vlessHeader = () => {
  const ub = Buffer.from(uuid.replace(/-/g, ''), 'hex');
  return Buffer.concat([
    Buffer.from([0]), ub, Buffer.from([0]), Buffer.from([1]),
    Buffer.from([TPORT >> 8, TPORT & 255]), Buffer.from([2, TARGET.length]), Buffer.from(TARGET),
    Buffer.from('GET / HTTP/1.1\r\nHost: " + TARGET + "\r\nUser-Agent: curl/8\r\nConnection: close\r\n\r\n'),
  ]);
};
const trojanHeader = () => {
  const pw = Buffer.from(crypto.createHash('sha224').update(String(S.trojan_password)).digest('hex'), 'utf8');
  return Buffer.concat([
    pw, Buffer.from('\r\n'), Buffer.from([1]), Buffer.from([1]), Buffer.from(TARGET), Buffer.from([TPORT >> 8, TPORT & 255]), Buffer.from('\r\n'),
    Buffer.from('GET / HTTP/1.1\r\nHost: " + TARGET + "\r\nUser-Agent: curl/8\r\nConnection: close\r\n\r\n'),
  ]);
};

await tunnel(`VLESS → ${TARGET}:${TPORT}`, vlessHeader, 'vless');
await new Promise((r) => setTimeout(r, 1500));
await tunnel(`Trojan → ${TARGET}:${TPORT}`, trojanHeader, 'trojan');
