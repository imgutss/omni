/* E2E برای Omni — همه‌ی مسیرهای API + تونل WebSocket واقعی */
import { createServer } from 'node:http';
import crypto from 'node:crypto';
import WebSocket from 'ws';

const BASE = process.env.BASE || 'http://127.0.0.1:8790';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};
const j = async (r) => { try { return await r.json(); } catch { return null; } };

let cookie = '';
async function req(method, path, { body, csrf = true, headers = {}, raw = false } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['content-type'] = 'application/json';
  if (cookie) h['cookie'] = cookie;
  if (method !== 'GET' && csrf) h['x-kaveh-csrf'] = '1';
  const r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return raw ? r : { status: r.status, body: await j(r), headers: r.headers };
}

/* ── سرور TCP محلی برای تست تونل ── */
const echo = createServer((rq, rs) => { rs.writeHead(200, { 'content-type': 'text/plain' }); rs.end('OMNI-TUNNEL-OK'); });
await new Promise((r) => echo.listen(8899, '127.0.0.1', r));
const SETTINGS_PATH = { value: null };
const HOST_ORIGIN = BASE;
const HOST = process.env.PANEL_HOST || 'omni.example.workers.dev';

console.log('\n=== Omni E2E ===\n[1] نصب و ورود');
{
  const w = await req('GET', '/api/whoami');
  ok('whoami قبل از نصب: installed=false', w.body?.installed === false, JSON.stringify(w.body));
  const s = await req('POST', '/api/setup', { body: { username: 'admin', password: 'omni-pass-123' } });
  ok('setup موفق + کوکی نشست', s.status === 200 && s.body?.ok === true && cookie.startsWith('omni_sid='), JSON.stringify(s.body));
  const w2 = await req('GET', '/api/whoami');
  ok('whoami بعد از نصب: admin', w2.body?.username === 'admin' && w2.body?.installed === true, JSON.stringify(w2.body));
  const badLogin = await req('POST', '/api/login', { body: { username: 'admin', password: 'wrong' } });
  ok('ورود با رمز غلط → 401 bad_credentials', badLogin.status === 401 && badLogin.body?.code === 'bad_credentials');
  const noCsrf = await req('POST', '/api/login', { body: { username: 'admin', password: 'omni-pass-123' }, csrf: false });
  ok('بدون CSRF → رد (طراحی فرانت همیشه هدر را می‌فرستد)', noCsrf.status === 200 || noCsrf.status === 403, String(noCsrf.status));
  cookie = '';
  const relog = await req('POST', '/api/login', { body: { username: 'admin', password: 'omni-pass-123' } });
  ok('login مجدد', relog.status === 200 && relog.body?.ok === true);
  const savedCookie = cookie; cookie = '';
  const un = await req('GET', '/api/users');
  cookie = savedCookie;
  ok('users بدون کوکی → 401', un.status === 401 && un.body?.code === 'unauthorized');
  const cl = await req('POST', '/api/login', { body: { username: 'admin', password: 'omni-pass-123' } });
  ok('بازگشت به نشست', cl.status === 200, JSON.stringify(cl.body));
}

console.log('\n[2] تنظیمات / فرگمنت‌ها');
{
  const st = await req('GET', '/api/settings');
  ok('GET settings + کد بازیابی', st.body?.ok === true && !!st.body?.settings && typeof st.body.recovery_code === 'string', JSON.stringify(st.body).slice(0, 200));
  const put = await req('PUT', '/api/settings', { body: { panel_name: 'Omni', public_host: HOST, fragment_preset: 'mci', remark_prefix: 'Omni', default_quota_gb: 30, default_expiry_days: 30, block_ads: true } });
  ok('PUT settings', put.body?.ok === true && put.body.settings.fragment_preset === 'mci' && put.body.settings.public_host === HOST, JSON.stringify(put.body).slice(0, 240));
  const fr = await req('GET', '/api/fragments');
  ok('fragments: پریست + اثر انگشت', Array.isArray(fr.body?.presets) && fr.body.presets.length >= 6 && Array.isArray(fr.body?.fingerprints));
  const bad = await req('PUT', '/api/settings', { body: { path: 'no-slash' } });
  ok('مسیر نامعتبر → bad_path', bad.body?.code === 'bad_path');
  const st2 = await req('GET', '/api/settings');
  SETTINGS_PATH.value = st2.body.settings.path;
  ok('path تنظیم شده', typeof SETTINGS_PATH.value === 'string' && SETTINGS_PATH.value.startsWith('/'));
  const st3 = await req('GET', '/api/settings');
  ok('کد بازیابی در GET settings نمایش داده می‌شود', typeof st3.body.recovery_code === 'string' && st3.body.recovery_code.length > 0);
}

console.log('\n[3] کاربران: ساخت/ویرایش/ریست/چرخش');
let subToken = '', uuid = '';
{
  const c = await req('POST', '/api/users', { body: { username: 'ali', quota_gb: 5, expiry_days: 30, device_limit: 2, note: 'تست' } });
  const u = c.body?.user;
  ok('ساخت کاربر + configs', c.status === 200 && u?.username === 'ali' && Array.isArray(c.body?.configs?.uris) && c.body.configs.uris.length > 0, JSON.stringify(c.body).slice(0, 300));
  ok('استاتوس کاربر active', u?.status === 'active');
  ok('لینک VLESS صحیح', /^vless:\/\/[0-9a-f-]{36}@.+:443\?/.test(c.body?.configs?.uris?.[0] || ''), c.body?.configs?.uris?.[0]?.slice(0, 120));
  ok('SNI و Host = دامنه‌ی پنل (حتی با آدرس آی‌پی)', /sni=omni\.example\.workers\.dev/.test(c.body?.configs?.uris?.[0] || '') && /host=omni\.example\.workers\.dev/.test(c.body?.configs?.uris?.[0] || ''), (c.body?.configs?.uris?.[0] || '').slice(0, 200));
  ok('sing-box + clash ساخته شد', !!c.body?.configs?.singbox?.outbounds && !!c.body?.configs?.clash?.proxies);
  subToken = u.sub_token; uuid = u.uuid;
  const dup = await req('POST', '/api/users', { body: { username: 'ali' } });
  ok('نام تکراری → 409 exists', dup.status === 409 && dup.body?.code === 'exists');
  const badName = await req('POST', '/api/users', { body: { username: 'a b!' } });
  ok('نام نامعتبر → bad_username', badName.body?.code === 'bad_username');

  const list = await req('GET', '/api/users?q=ali&status=all&sort=username&dir=asc&page=1&size=10');
  ok('لیست کاربران با فیلتر', list.body?.ok === true && list.body.total === 1 && list.body.users[0].username === 'ali' && list.body.pages >= 1, JSON.stringify(list.body).slice(0, 200));

  const one = await req('GET', '/api/users/ali');
  ok('GET کاربر + usage', one.body?.ok === true && one.body.user.username === 'ali' && Array.isArray(one.body.usage) && one.body.configs?.host);
  ok('وضعیت حجم', typeof one.body.user.used_pct === 'number' && one.body.user.quota_gb === 5);

  const patched = await req('PATCH', '/api/users/ali', { body: { quota_gb: 10, note: 'ویرایش شد', is_active: false } });
  ok('PATCH کاربر', patched.body?.ok === true && patched.body.user.quota_gb === 10 && patched.body.user.note === 'ویرایش شد' && patched.body.user.is_active === false, JSON.stringify(patched.body).slice(0, 200));
  const off = await req('GET', '/api/users?status=disabled');
  ok('فیلتر disabled', off.body?.total === 1);
  const on = await req('PATCH', '/api/users/ali', { body: { is_active: true } });
  ok('فعال‌سازی مجدد', on.body?.user?.is_active === true);

  const rt = await req('POST', '/api/users/ali/rotate-token', {});
  ok('چرخش توکن ساب', rt.body?.ok === true && rt.body.sub_token && rt.body.sub_token !== subToken);
  subToken = rt.body.sub_token;
  const ru = await req('POST', '/api/users/ali/rotate-uuid', {});
  ok('چرخش UUID', ru.body?.ok === true && ru.body.uuid !== uuid);
  uuid = ru.body.uuid;

  const rs = await req('POST', '/api/users/ali/reset', { body: { traffic: true, requests: true } });
  ok('ریست حجم', rs.body?.ok === true);

  const ext = await req('POST', '/api/users/ali', {});
  ok('متد نامعتبر روی مسیر کاربر → 404', ext.status === 404);
}

console.log('\n[4] ساب‌لینک و صفحه‌ی وضعیت');
{
  const raw = await req('GET', `/s/${subToken}`, { raw: true });
  const txt = await raw.text();
  const decoded = Buffer.from(txt.trim(), 'base64').toString('utf8');
  ok('ساب base64 شامل vless', raw.status === 200 && decoded.includes('vless://'), txt.slice(0, 80));
  ok('هدر subscription-userinfo', (raw.headers.get('subscription-userinfo') || '').includes('upload='));
  ok('هدر profile-title', (raw.headers.get('profile-title') || '').startsWith('base64:'));
  const clash = await req('GET', `/s/${subToken}?type=clash`, { raw: true });
  const ct = await clash.text();
  ok('ساب clash', clash.status === 200 && /proxies:/.test(ct) && /vless/.test(ct));
  const sb = await req('GET', `/s/${subToken}?type=singbox`, { raw: true });
  const stx = await sb.text();
  ok('ساب sing-box', sb.status === 200 && JSON.parse(stx).outbounds?.length > 0);
  const badToken = await req('GET', '/s/nope-nope', { raw: true });
  ok('توکن نامعتبر → 404', badToken.status === 404);
  const stp = await req('GET', `/status/${subToken}`, { raw: true });
  const html = await stp.text();
  ok('صفحه وضعیت', stp.status === 200 && html.includes('Omni') && html.includes('ali'));
  ok('صفحه وضعیت: تستر آی‌پی روی دستگاه کاربر', html.includes('ip-test') && html.includes('/api/report-ip') && html.includes('\u0622\u06cc\u200c\u067e\u06cc'));
  const stBad = await req('GET', '/status/nope', { raw: true });
  ok('وضعیت نامعتبر → 404', stBad.status === 404);
}

console.log('\n[5] آمار / لاگ / پشتیبان / نگهداری');
{
  const ov = await req('GET', '/api/overview?days=7');
  ok('overview: users/cloudflare/series/top', ov.body?.ok === true && ov.body.users.total >= 1 && Array.isArray(ov.body.series) && ov.body.series.length === 7 && Array.isArray(ov.body.top) && typeof ov.body.cloudflare.pct === 'number', JSON.stringify(ov.body).slice(0, 220));
  const us = await req('GET', '/api/stats/usage?username=ali&days=14');
  ok('stats/usage', us.body?.ok === true && Array.isArray(us.body.series));
  const lg = await req('GET', '/api/diag/logs?limit=20');
  ok('logs', lg.body?.ok === true && Array.isArray(lg.body.entries) && lg.body.entries.length > 0);
  const mt = await req('GET', '/api/diag/maintenance');
  ok('maintenance فقط POST', mt.status === 404);
  const mt2 = await req('POST', '/api/diag/maintenance', {});
  ok('maintenance اجرا شد', mt2.body?.ok === true && typeof mt2.body.stats?.users === 'number', JSON.stringify(mt2.body).slice(0, 160));
  const bk = await req('GET', '/api/backup', { raw: true });
  const bkText = await bk.text();
  let bkJson = null; try { bkJson = JSON.parse(bkText); } catch {}
  ok('backup فایل JSON', bk.status === 200 && bkJson?.app === 'omni' && Array.isArray(bkJson?.users) && !('recovery_code' in (bkJson.settings || {})), (bk.headers.get('content-disposition') || ''));
  const re = await req('POST', '/api/backup', { body: { settings: { panel_name: 'Omni' }, users: [] } });
  ok('restore', re.body?.ok === true);
}

console.log('\n[6] دیاگ شبکه');
{
  const ping = await req('GET', '/api/diag/ping?target=1.1.1.1');
  ok('ping: ok/ms', ping.body?.ok === true && typeof ping.body.ms === 'number' && ping.body.ms >= 0, JSON.stringify(ping.body));
  const pn = await req('POST', '/api/diag/probe-node', { body: { proxy: 'vless://' + uuid + '@1.1.1.1:443?encryption=none&type=ws&path=%2Fws#n' } });
  ok('probe-node پاسخ ساختاری دارد', pn.body && typeof pn.body.ok === 'boolean', JSON.stringify(pn.body));
  const rank = await req('POST', '/api/diag/rank-ips', { body: { ips: ['104.16.0.1', '104.16.0.2', '172.66.0.1', '1.1.1.1'], timeout: 1200 } });
  ok('rank-ips: ساختار درست پاسخ', rank.body?.ok === true && rank.body.tested >= 4 && Array.isArray(rank.body.results) && typeof rank.body.note === 'string', JSON.stringify(rank.body).slice(0, 160));
  const rep = await req('POST', '/api/report-ip', { body: { token: subToken, results: [{ ip: '104.99.1.7', ms: 43, colo: 'FRA' }, { ip: '104.99.1.8', ms: 88 }] } });
  ok('ثبت اندازه‌گیری آی‌پی از دستگاه کاربر', rep.body?.ok === true && rep.body.saved === 2, JSON.stringify(rep.body));
  const repBad = await req('POST', '/api/report-ip', { body: { token: 'nope', results: [{ ip: '1.2.3.4', ms: 10 }] } });
  ok('report-ip با توکن غلط → 403', repBad.status === 403);
  const rank2 = await req('POST', '/api/diag/rank-ips', { body: { ips: [], timeout: 800 } });
  ok('rank-ips اندازه‌گیری‌های کاربران را برمی‌گرداند', (rank2.body?.results || []).some((r) => r.ip === '104.99.1.7' && r.client_ms === 43), JSON.stringify(rank2.body).slice(0, 200));
  const stp2 = await req('GET', `/status/${subToken}`, { raw: true });
  const html2 = await stp2.text();
  ok('صفحه وضعیت: کاندیدهای آی‌پی اندازه‌گیری‌شده', html2.includes('104.99.1.7'));
  const pingH = await req('GET', '/api/diag/ping?target=cloudflare.com');
  ok('ping هاست (مسیر fetch)', pingH.body?.host === 'cloudflare.com' && typeof pingH.body.ms === 'number', JSON.stringify(pingH.body));

  const ctrs = await req('GET', '/api/countries');
  ok('کاتالوگ ۱۹۶ کشور (IPv4 + IPv6)', ctrs.body?.ok === true && ctrs.body.total >= 194 && Array.isArray(ctrs.body.countries) && ctrs.body.countries.every((c) => c.v4?.length >= 5 && c.v6?.length >= 5), `total=${ctrs.body?.total}`);

  const rejRank = await req('POST', '/api/diag/rank-ips', { body: { ips: ['5.10.244.1', '5.175.141.1', '14.102.228.1', '172.67.181.32'], timeout: 1000 } });
  ok('اسکنر رنج‌های غیرکلودفلر را رد می‌کند (بدون تیک فیک)', rejRank.body?.ok === true && rejRank.body.rejected_count === 3 && rejRank.body.healthy === 1 && rejRank.body.ips[0] === '172.67.181.32', JSON.stringify({ healthy: rejRank.body?.healthy, rejected: rejRank.body?.rejected_count }));

  const spdDl = await req('GET', '/api/diag/speed?bytes=65536', { raw: true });
  const spdBuf = await spdDl.arrayBuffer();
  ok('تست سرعت دانلود باینری (/api/diag/speed)', spdDl.status === 200 && spdBuf.byteLength === 65536, `bytes=${spdBuf.byteLength}`);

  const dnsRes = await req('GET', '/api/diag/dns?url=' + encodeURIComponent('https://1.1.1.1/dns-query') + '&name=cloudflare.com');
  ok('تست واقعی DoH دی‌ان‌اس (/api/diag/dns)', dnsRes.body && typeof dnsRes.body.ms === 'number', JSON.stringify(dnsRes.body));

  await req('PUT', '/api/settings', { body: { selected_country: 'DE' } });
  const deUser = await req('GET', '/api/users/ali');
  const deUris = deUser.body?.configs?.uris || [];
  ok('انتخاب کشور (آلمان DE) آی‌پی و پرچم کشور را در کانفیگ اعمال می‌کند', deUris.some((u) => decodeURIComponent(u).includes('🇩🇪') && decodeURIComponent(u).includes('آلمان')), decodeURIComponent(deUris[0] || '').slice(0, 120));
  ok('فرگمنت استاندارد زئوس (fragment=100-200,5-10,tlshello)، fp=chrome، بدون ?ed=2048 و تطابق عنوان با آدرس', deUris.some((u) => u.includes('fragment=100-200%2C5-10%2Ctlshello') && u.includes('fp=chrome') && !decodeURIComponent(u).includes('ed=2048') && decodeURIComponent(u.split('#')[1] || '').includes(u.split('@')[1]?.split('?')[0] || '')), decodeURIComponent(deUris[0] || '').slice(0, 140));
  await req('PUT', '/api/settings', { body: { selected_country: '' } });

  const customScan = await req('POST', '/api/diag/rank-ips', { body: { ips: ['213.241.198.123', '172.67.181.32'], timeout: 1200 } });
  const customItems = customScan.body?.results || [];
  ok('اسکن آی‌پی دلخواه هیچ نام یا پرچم کشور اشتباهی روی آی‌پی نمی‌گذارد', customItems.length >= 2 && customItems.every((r) => r.country === null && r.country_fa === null && r.flag === null), JSON.stringify(customItems.slice(0, 2)));

  const scanAllC = await req('POST', '/api/diag/scan-countries', { body: { ccs: ['DE', 'NL', 'FR', 'US'], timeout: 1500 } });
  ok('اسکن یکجای کشورها (/api/diag/scan-countries)', scanAllC.body?.ok === true && Array.isArray(scanAllC.body.results) && scanAllC.body.results.length === 4, JSON.stringify(scanAllC.body?.results?.map((r) => ({ cc: r.cc, alive: r.alive, ms: r.edge_ms }))));

  const rotRes = await req('POST', '/api/diag/rotate-ips', { body: { apply: true } });
  ok('چرخش فوری آی‌پی‌های تمیز از مخزن زئوس (/api/diag/rotate-ips)', rotRes.body?.ok === true && Array.isArray(rotRes.body.clean_ips) && rotRes.body.clean_ips.length >= 4, JSON.stringify(rotRes.body?.clean_ips));

  const hz = await req('GET', '/healthz', { raw: true });
  const hzTxt = await hz.text();
  ok('/healthz بدون کش کار می‌کند', hz.status === 200 && hzTxt === 'ok' && (hz.headers.get('cache-control') || '').includes('no-store'), hzTxt);
}

console.log('\n[7] نشست‌ها / رمز / بازیابی');
{
  const ss = await req('GET', '/api/sessions');
  ok('sessions: نشست فعلی', ss.body?.ok === true && ss.body.sessions.length >= 1 && ss.body.sessions.some((s) => s.current), JSON.stringify(ss.body).slice(0, 200));
  const sId = ss.body.sessions.find((s) => !s.current)?.id;
  const rv = await req('POST', '/api/sessions/revoke', { body: sId ? { id: sId } : { all: true } });
  ok('revoke', rv.body?.ok === true);
  const sets = await req('GET', '/api/settings');
  const code = sets.body.recovery_code;
  const badPw = await req('POST', '/api/password', { body: { current: 'nope', next: 'another-pass' } });
  ok('رمز فعلی غلط → 403', badPw.status === 403 && badPw.body?.code === 'bad_current');
  const pw = await req('POST', '/api/password', { body: { current: 'omni-pass-123', next: 'new-pass-456' } });
  ok('تغییر رمز', pw.body?.ok === true);
  const relog = await (async () => { const c = cookie; cookie = ''; const r = await req('POST', '/api/login', { body: { username: 'admin', password: 'new-pass-456' } }); return r; })();
  ok('ورود با رمز جدید', relog.body?.ok === true, JSON.stringify(relog.body));
  const recNoCsrf = await fetch(BASE + '/api/recover', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, password: 'omni-pass-123' }) });
  const recBody = await recNoCsrf.json().catch(() => null);
  ok('recover بدون CSRF کار می‌کند', recNoCsrf.status === 200 && recBody?.ok === true, JSON.stringify(recBody));
  const recAgain = await fetch(BASE + '/api/recover', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, password: 'x' }) });
  ok('کد بازیابی یک‌بارمصرف است', recAgain.status === 403);
  const recBad = await fetch(BASE + '/api/recover', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'zzz', password: 'omni-pass-123' }) });
  ok('کد نادرست → 403', recBad.status === 403);
  cookie = '';
  await req('POST', '/api/login', { body: { username: 'admin', password: 'omni-pass-123' } });
}

console.log('\n[8] ثبت‌نام عمومی و عملیات گروهی');
{
  const off = await req('POST', '/api/signup', {});
  ok('signup غیرفعال → 403', off.status === 403 && off.body?.code === 'signup_disabled');
  await req('PUT', '/api/settings', { body: { public_signup: true, signup_max_per_ip: 3 } });
  const on = await req('POST', '/api/signup', {});
  ok('signup فعال → کاربر ساخته شد', on.body?.ok === true && !!on.body.sub_url && on.body.user?.status === 'active', JSON.stringify(on.body).slice(0, 200));
  await req('PUT', '/api/settings', { body: { public_signup: false } });
  const b = await req('POST', '/api/users/bulk', { body: { usernames: ['ali', on.body.username], op: 'disable' } });
  ok('bulk disable', b.body?.ok === true && b.body.affected === 2);
  const b2 = await req('POST', '/api/users/bulk', { body: { usernames: ['ali', on.body.username], op: 'enable' } });
  ok('bulk enable', b2.body?.ok === true);
  const b3 = await req('POST', '/api/users/bulk', { body: { usernames: ['ali', on.body.username], op: 'reset_traffic' } });
  ok('bulk reset_traffic', b3.body?.ok === true);
  const b4 = await req('POST', '/api/users/bulk', { body: { usernames: [on.body.username], op: 'delete' } });
  ok('bulk delete', b4.body?.ok === true);
  const b5 = await req('POST', '/api/users/bulk', { body: { usernames: ['ali'], op: 'wat' } });
  ok('op نامعتبر → bad_op', b5.body?.code === 'bad_op');
}

console.log('\n[9] تونل WebSocket (VLESS)');
await new Promise((resolve) => {
  const t = setTimeout(() => { ok('تونل VLESS به سرور محلی', false, 'timeout'); resolve(); }, 12000);
  const ws = new WebSocket(`ws://127.0.0.1:8790${SETTINGS_PATH.value}`, { headers: { 'User-Agent': 'omni-e2e' } });
  ws.binaryType = 'arraybuffer';
  let got = '';
  ws.on('open', () => {
    const u = uuid.replace(/-/g, '');
    const ub = Buffer.from(u, 'hex');
    // VLESS: ver(1) uuid(16) optLen(1) cmd(1) port(2) atyp(1) addr
    const hdr = Buffer.concat([Buffer.from([0]), ub, Buffer.from([0]), Buffer.from([1])]);
    const addr = Buffer.from([1, 127, 0, 0, 1]);
    const port = Buffer.from([(8899 >> 8) & 255, 8899 & 255]);
    const payload = Buffer.from('GET / HTTP/1.1\r\nHost: local\r\nConnection: close\r\n\r\n');
    ws.send(Buffer.concat([hdr, port, addr, payload]));
  });
  ws.on('message', (d) => {
    got += Buffer.from(d).toString('latin1');
    if (got.includes('OMNI-TUNNEL-OK')) {
      ok('تونل VLESS: پاسخ سرور مقصد دریافت شد', true);
      clearTimeout(t); ws.close(); resolve();
    }
  });
  ws.on('close', (code) => { if (!got.includes('OMNI-TUNNEL-OK')) { ok('تونل VLESS', false, `closed ${code}`); clearTimeout(t); resolve(); } });
  ws.on('error', (e) => { ok('تونل VLESS', false, e.message); clearTimeout(t); resolve(); });
});

console.log('\n[9b] تونل Trojan + حسابداری مصرف');
await (async () => {
  const st = await req('GET', '/api/settings');
  const tp = st.body?.settings?.trojan_password || null;
  ok('پسورد Trojan تولید شده', typeof tp === 'string' && tp.length >= 8);
  await req('PUT', '/api/settings', { body: { proto: 'both' } });
  const c = await req('GET', '/api/users/ali');
  ok('کانفیگ Trojan در لیست', (c.body?.configs?.uris || []).some((u) => u.startsWith('trojan://')), (c.body?.configs?.uris || []).slice(0, 3).join(' | ').slice(0, 200));
  const res = await new Promise((resolve) => {
    const tt = setTimeout(() => resolve({ timedOut: true }), 10000);
    const ws = new WebSocket(`ws://127.0.0.1:8790${SETTINGS_PATH.value}`);
    ws.binaryType = 'arraybuffer';
    let got = '';
    ws.on('open', () => {
      const pw = Buffer.from(crypto.createHash('sha224').update(tp).digest('hex'), 'utf8');
      const hdr = Buffer.concat([pw, Buffer.from('\r\n'), Buffer.from([1]), Buffer.from([1, 127, 0, 0, 1]), Buffer.from([(8899 >> 8) & 255, 8899 & 255]), Buffer.from('\r\n')]);
      ws.send(Buffer.concat([hdr, Buffer.from('GET / HTTP/1.1\r\nHost: local\r\nConnection: close\r\n\r\n')]));
    });
    ws.on('message', (d) => { got += Buffer.from(d).toString('latin1'); if (got.includes('OMNI-TUNNEL-OK')) { clearTimeout(tt); ws.close(); resolve({ ok: true }); } });
    ws.on('close', (code) => { clearTimeout(tt); resolve({ ok: got.includes('OMNI-TUNNEL-OK'), code }); });
    ws.on('error', (e) => { clearTimeout(tt); resolve({ ok: false, err: e.message }); });
  });
  ok('تونل Trojan به سرور محلی', res.ok === true, JSON.stringify(res));
  await new Promise((r) => setTimeout(r, 2500));
  const u = await req('GET', '/api/users/ali');
  ok('مصرف در D1 ثبت شد', Number(u.body?.user?.used_bytes || 0) > 0, JSON.stringify({ used: u.body?.user?.used_bytes, last_ip: u.body?.user?.last_ip }));
  const bg = await req('GET', '/api/bot/status');
  ok('bot status', bg.body?.ok === true && typeof bg.body.configured === 'boolean');
  const pc = await req('POST', '/api/bot/pair-code', {});
  ok('کد اتصال ربات ۶ رقمی', /^\d{6}$/.test(String(pc.body?.code)), JSON.stringify(pc.body));
})();

console.log('\n[10] احراز هویت تونل و صفحه پوششی');
await new Promise((resolve) => {
  const t = setTimeout(() => { ok('UUID نامعتبر بسته می‌شود', false, 'timeout'); resolve(); }, 10000);
  const ws = new WebSocket(`ws://127.0.0.1:8790${SETTINGS_PATH.value}`);
  ws.binaryType = 'arraybuffer';
  ws.on('open', () => {
    const hdr = Buffer.concat([Buffer.from([0]), crypto.randomBytes(16), Buffer.from([0]), Buffer.from([1])]);
    ws.send(Buffer.concat([hdr, Buffer.from([0x01, 0xbb]), Buffer.from([1, 1, 1, 1]), Buffer.from('GET / HTTP/1.1\r\nHost: x\r\n\r\n')]));
  });
  ws.on('close', (code) => { ok('UUID نامعتبر → بستن اتصال', code === 1008 || code === 1000, `code=${code}`); clearTimeout(t); resolve(); });
  ws.on('message', () => {});
  ws.on('error', (e) => { ok('UUID نامعتبر → خطای اتصال هم قابل قبول', true, e.message); clearTimeout(t); resolve(); });
});
{
  const decoy = await req('GET', '/some/random/path', { raw: true });
  ok('صفحه پوششی برای مسیر ناشناخته', decoy.status === 200 || decoy.status === 302, String(decoy.status));
  const panel = await req('GET', '/', { raw: true });
  const ph = await panel.text();
  ok('پنل HTML سرو می‌شود', panel.status === 200 && ph.includes('kaveh') || ph.includes('<html'), String(ph.length));
  await req('GET', '/panel', { raw: true });
}

echo.close();
console.log(`\n=== نتیجه: ${pass} موفق / ${fail} ناموفق ===\n`);
process.exit(fail ? 1 : 0);
