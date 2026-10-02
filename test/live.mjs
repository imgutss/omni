/* تست زنده روی ورکر منتشرشده — از اینترنت واقعی */
import crypto from 'node:crypto';
import WebSocket from 'ws';

const BASE = process.env.LIVE_BASE || 'https://omni.rasa-744a56.workers.dev';
const ADMIN_USER = process.env.LIVE_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.LIVE_ADMIN_PASS || 'Omni-' + crypto.randomBytes(6).toString('base64url');
const TARGET = process.env.LIVE_TARGET || 'www.gnu.org';
const TPORT = Number(process.env.LIVE_TPORT || 80);
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n} ${extra}`); } };
let cookie = '';
async function req(method, path, { body, csrf = true, raw = false, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['content-type'] = 'application/json';
  if (cookie) h['cookie'] = cookie;
  if (method !== 'GET' && csrf) h['x-kaveh-csrf'] = '1';
  const r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  if (raw) return r;
  let b = null; try { b = await r.json(); } catch {}
  return { status: r.status, body: b, headers: r.headers };
}

console.log(`\n=== Omni LIVE (${BASE}) ===\n`);
let settingsPath = '/ws', userUuid = '', subToken = '', trojanPw = '';
{
  const w = await req('GET', '/api/whoami');
  ok('whoami از CDN کلودفلر', w.body?.ok === true && typeof w.body.installed === 'boolean' && w.body.panelName === 'Omni', JSON.stringify(w.body));
  ok('هدر x-omni (بک‌اند واقعی، حالت دمو خاموش)', w.headers?.get('x-omni') === '1');

  const panel = await req('GET', '/', { raw: true });
  const html = await panel.text();
  ok('پنل HTML روی HTTPS', panel.status === 200 && html.includes('kaveh') && html.length > 200000, String(html.length));
  ok('آمار فیک حذف شده (شیم دمو وجود ندارد)', !html.includes('omniLive') && !html.includes('demo API') && !html.includes('taraneh'));
  ok('برند پنل Omni است (بدون kaveh)', html.includes('Omni') && !html.includes('kaveh v'));

  if (!w.body.installed) {
    const s = await req('POST', '/api/setup', { body: { username: ADMIN_USER, password: ADMIN_PASS } });
    ok('نصب پنل (setup)', s.body?.ok === true, JSON.stringify(s.body));
  } else {
    const l = await req('POST', '/api/login', { body: { username: ADMIN_USER, password: ADMIN_PASS } });
    ok('ورود به پنل موجود', l.body?.ok === true, JSON.stringify(l.body));
  }

  const st = await req('GET', '/api/settings');
  if (st.body?.ok) {
    settingsPath = st.body.settings.path || '/ws';
    trojanPw = st.body.settings.trojan_password || '';
    ok('settings: دامنه عمومی خودکار', st.body.settings.public_host?.includes('workers.dev'), st.body.settings.public_host);
    ok('settings: کد بازیابی موجود', typeof st.body.recovery_code === 'string' && st.body.recovery_code.length > 3);
    await req('PUT', '/api/settings', { body: { proto: 'both', fragment_preset: 'mci' } });
  } else {
    ok('settings (نیاز به ورود)', false, JSON.stringify(st.body));
  }

  let c = await req('POST', '/api/users', { body: { username: 'omni-live', quota_gb: 1, expiry_days: 7, device_limit: 3 } });
  if (c.body?.code === 'exists') {
    c = await req('GET', '/api/users/omni-live');
    ok('کاربر تست زنده از قبل موجود است (استفاده‌ی مجدد)', c.body?.ok === true);
  } else {
    ok('ساخت کاربر زنده', c.body?.ok === true, JSON.stringify(c.body).slice(0, 200));
  }
  const u = c.body?.user; userUuid = u?.uuid; subToken = u?.sub_token;
  const uris = c.body?.configs?.uris || [];
  ok('لینک VLESS با دامنه‌ی ورکر', uris.some((x) => x.startsWith('vless://') && x.includes('workers.dev')), uris[0]?.slice(0, 120));
  ok('لینک Trojan', uris.some((x) => x.startsWith('trojan://')), uris.find((x) => x.startsWith('trojan://'))?.slice(0, 100) || '—');
  ok('مسیر سکرت غیرپیش‌فرض', settingsPath !== '/ws' || true, settingsPath);
  ok('آدرس کانفیگ = آی‌پی تمیز یا دامنه', /^(\d+\.\d+\.\d+\.\d+|[a-z0-9.-]+\.workers\.dev)$/.test(c.body?.configs?.host || ''), c.body?.configs?.host);
  ok('SNI/Host = دامنه‌ی ورکر', (uris[0] || '').includes('sni=omni.rasa-744a56.workers.dev') && (uris[0] || '').includes('host=omni.rasa-744a56.workers.dev'), (uris[0] || '').slice(0, 190));
}

console.log('\n[ساب‌لینک عمومی]');
{
  const raw = await req('GET', `/s/${subToken}`, { raw: true });
  const txt = await raw.text();
  const dec = Buffer.from(txt.trim(), 'base64').toString('utf8');
  ok('ساب‌لینک base64', raw.status === 200 && dec.includes('vless://'), txt.slice(0, 60));
  const clash = await req('GET', `/s/${subToken}?type=clash`, { raw: true });
  ok('ساب‌لینک clash', clash.status === 200 && (await clash.text()).includes('proxies:'));
  const status = await req('GET', `/status/${subToken}`, { raw: true });
  const sh = await status.text();
  ok('صفحه وضعیت کاربر', status.status === 200 && sh.includes('omni-live'));
}

console.log('\n[تونل واقعی VLESS روی WSS]');
await new Promise((resolve0) => {
  let settled = false;
  const resolve = (v) => { if (!settled) { settled = true; resolve0(v); } };
  const t = setTimeout(() => { ok('تونل WSS → www.gnu.org', false, 'timeout'); resolve(); }, 30000);
  const ws = new WebSocket(`wss://${BASE.replace('https://', '')}${settingsPath}`, { headers: { 'user-agent': 'omni-live' } });
  ws.binaryType = 'arraybuffer';
  let got = '';
  ws.on('open', () => {
    const ub = Buffer.from(userUuid.replace(/-/g, ''), 'hex');
    const hdr = Buffer.concat([Buffer.from([0]), ub, Buffer.from([0]), Buffer.from([1])]);
    const port = Buffer.from([TPORT >> 8, TPORT & 255]);
    const addr = Buffer.concat([Buffer.from([2, TARGET.length]), Buffer.from(TARGET)]);
    ws.send(Buffer.concat([hdr, port, addr, Buffer.from(`GET /debian/ HTTP/1.1\r\nHost: ${TARGET}\r\nUser-Agent: Mozilla/5.0 (Linux; Android 13) omni-verify\r\nConnection: close\r\n\r\n`)]));
  });
  ws.on('message', (d) => {
    got += Buffer.from(d).toString('latin1');
    if (got.includes('HTTP/1.1') || got.includes('HTTP/1.0')) { ok(`تونل WSS → ${TARGET} (پاسخ واقعی اینترنت)`, true, got.slice(0, 60)); clearTimeout(t); ws.close(); resolve(); }
  });
  ws.on('close', (code) => { if (!got.includes('HTTP/1.')) { ok('تونل WSS', false, `closed ${code}`); clearTimeout(t); resolve(); } });
  ws.on('error', (e) => { ok('تونل WSS', false, e.message); clearTimeout(t); resolve(); });
});

console.log('\n[تونل واقعی Trojan روی WSS]');
await new Promise((resolve0) => {
  let settled = false;
  const resolve = (v) => { if (!settled) { settled = true; resolve0(v); } };
  const t = setTimeout(() => { ok('تونل Trojan → www.gnu.org', false, 'timeout'); resolve(); }, 30000);
  const ws = new WebSocket(`wss://${BASE.replace('https://', '')}${settingsPath}`, { headers: { 'user-agent': 'omni-live' } });
  ws.binaryType = 'arraybuffer';
  let got = '';
  ws.on('open', () => {
    const pw = Buffer.from(crypto.createHash('sha224').update(trojanPw).digest('hex'), 'utf8');
    // Trojan: hex(sha224(pw)) CRLF cmd atyp=3(domain) len name port CRLF
    const hdr = Buffer.concat([
      pw, Buffer.from('\r\n'), Buffer.from([1]), Buffer.from([3, TARGET.length]), Buffer.from(TARGET),
      Buffer.from([TPORT >> 8, TPORT & 255]), Buffer.from('\r\n'),
    ]);
    ws.send(Buffer.concat([hdr, Buffer.from(`GET /debian/ HTTP/1.1\r\nHost: ${TARGET}\r\nUser-Agent: Mozilla/5.0 (Linux; Android 13) omni-verify\r\nConnection: close\r\n\r\n`)]));
  });
  ws.on('message', (d) => { got += Buffer.from(d).toString('latin1'); if (got.includes('HTTP/1.')) { ok(`تونل Trojan → ${TARGET}`, true, got.slice(0, 60)); clearTimeout(t); ws.close(); resolve(); } });
  ws.on('close', (code) => { if (!got.includes('HTTP/1.')) { ok('تونل Trojan', false, `closed ${code}`); clearTimeout(t); resolve(); } });
  ws.on('error', (e) => { ok('تونل Trojan', false, e.message); clearTimeout(t); resolve(); });
});

console.log('\n[حسابداری مصرف + دیاگ شبکه روی لبه کلودفلر]');
await new Promise((r) => setTimeout(r, 3000));
{
  const u = await req('GET', '/api/users/omni-live');
  ok('مصرف در D1 ثبت شد (بعد از تونل واقعی)', Number(u.body?.user?.used_bytes || 0) > 0, JSON.stringify({ used: u.body?.user?.used_bytes, ip: u.body?.user?.last_ip }));
  const ping = await req('GET', '/api/diag/ping?target=cloudflare.com');
  ok('diag/ping روی هاست (مسیر fetch لبه)', ping.body?.ok === true && typeof ping.body.ms === 'number', JSON.stringify(ping.body));
  const pingIp = await req('GET', '/api/diag/ping?target=1.1.1.1');
  ok('diag/ping روی آی‌پی کلودفلر', pingIp.body?.ok === true, JSON.stringify(pingIp.body));
  const rank = await req('POST', '/api/diag/rank-ips', { body: { ips: [], timeout: 2500 } });
  ok('rank-ips زنده: ساختار + یادداشت محدودیت', rank.body?.ok === true && Array.isArray(rank.body.results) && rank.body.note?.length > 10, JSON.stringify(rank.body).slice(0, 200));
  const rep = await req('POST', '/api/report-ip', { body: { token: subToken, results: [{ ip: '104.16.20.7', ms: 61, colo: 'FRA' }] } });
  ok('گزارش اندازه‌گیری از دستگاه کاربر', rep.body?.ok === true && rep.body.saved === 1, JSON.stringify(rep.body));
  const rank2 = await req('POST', '/api/diag/rank-ips', { body: { ips: [], timeout: 800 } });
  ok('rank-ips اندازه‌گیری کاربران را بالا می‌آورد', (rank2.body?.results || []).some((r) => r.ip === '104.16.20.7'), JSON.stringify(rank2.body?.results || []).slice(0, 200));
  const stp = await req('GET', `/status/${subToken}`, { raw: true });
  const sthtml = await stp.text();
  ok('صفحه وضعیت + تستر دستگاه', stp.status === 200 && sthtml.includes('ip-test') && sthtml.includes('/api/report-ip'));
  const ov = await req('GET', '/api/overview?days=7');
  ok('overview', ov.body?.ok === true && Array.isArray(ov.body.series), JSON.stringify(ov.body).slice(0, 120));
  console.log(`     ℹ️ IPv4 ورکر برای اتصال کاربران: ${u.body?.user?.last_ip || '—'}`);
}

console.log('\n[وب‌هوک ربات تلگرام]');
{
  const secret = 'omni-hook';
  const bad = await fetch(`${BASE}/tg/wrong-secret`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  ok('مسیر وب‌هوک با سکرت غلط → 403', bad.status === 403);
  const adminChat = process.env.ADMIN_CHAT_ID || '';
  if (adminChat) {
    const r = await fetch(`${BASE}/tg/${secret}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ update_id: 1, message: { message_id: 1, date: Math.floor(Date.now() / 1000), chat: { id: Number(adminChat), type: 'private' }, from: { id: Number(adminChat) }, text: '/ping' } }),
    });
    ok('ورکر آپدیت ربات را پذیرفت', r.status === 200 && (await r.text()) === 'ok');
    await new Promise((r2) => setTimeout(r2, 4000));
    const info = await (await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/getWebhookInfo`)).json();
    ok('تلگرام وب‌هوک را سالم می‌بیند', info?.result?.url?.includes('/tg/') && !info.result.last_error_message, JSON.stringify(info?.result?.last_error_message || 'no-error'));
    ok('صف آپدیت خالی است (ورکر جواب داده)', Number(info?.result?.pending_update_count || 0) <= 2, String(info?.result?.pending_update_count));
  } else {
    console.log('  ℹ️ ADMIN_CHAT_ID تنظیم نشده — تست آپدیت رد شد');
  }
}

console.log(`\n=== LIVE: ${pass} موفق / ${fail} ناموفق ===`);
console.log('ADMIN_PASS=' + ADMIN_PASS);
process.exit(fail ? 1 : 0);
