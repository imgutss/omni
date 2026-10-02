/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/api.js
   کل API پنل مطابق قرارداد فرانت‌اند (auth/users/overview/settings/diag/…)
   ══════════════════════════════════════════════════════════════════════════ */
import {
  ensureSchema, allSettings, putSetting, putSettingsBulk, getSetting, DEFAULTS,
  hashPassword, verifyPassword, createSession, clearCookie, currentAccount,
  revokeSession, revokeAllSessions, randomToken, randomUuid, logEvent,
  settingsCached, ensureRecoveryCode, sessionIdFrom,
} from './auth.js';
import { buildConfigs, subscriptionBody, statusPage, FRAGMENT_PRESETS, FINGERPRINTS, safeArray, esc } from './links.js';
import { rankIps, probeNode, tcpProbe, fetchCfCidrs, sampleIPs } from './scan.js';
import { userStatus, safeJsonArray, invalidateUser } from './core.js';

const GB = 1024 ** 3;
const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});
const bad = (code, error, status = 400) => json({ ok: false, code, error }, status);

/* ─────────────── تبدیل کاربر دیتابیس → شکل پنل ─────────────── */
function userView(u, settings, cleanIps = [], { withConfigs = false } = {}) {
  if (!u) return null;
  const used = Number(u.up_bytes || 0) + Number(u.down_bytes || 0);
  const quota = Number(u.quota_bytes || 0);
  const msLeft = u.expires_at ? new Date(String(u.expires_at).replace(' ', 'T') + 'Z').getTime() - Date.now() : null;
  const view = {
    username: u.username,
    uuid: u.uuid,
    sub_token: u.sub_token,
    note: u.note || '',
    status: userStatus(u),
    is_active: !!u.is_active,
    used_bytes: used,
    up_bytes: Number(u.up_bytes || 0),
    down_bytes: Number(u.down_bytes || 0),
    used_pct: quota > 0 ? Math.min(100, (used / quota) * 100) : 0,
    quota_gb: quota > 0 ? quota / GB : 0,
    ms_left: msLeft,
    expires_at: u.expires_at,
    device_limit: Number(u.device_limit || 0),
    request_limit: Number(u.request_limit || 0),
    request_count: Number(u.request_count || 0),
    first_connect: !!u.first_connect,
    activated_at: u.activated_at,
    fragment: u.fragment || '',
    fingerprint: u.fingerprint || '',
    ips: safeJsonArray(u.ips),
    proxies: safeJsonArray(u.proxies),
    block_list: safeJsonArray(u.block_list),
    created_at: u.created_at,
    last_seen: u.last_seen,
    last_ip: u.last_ip,
  };
  if (withConfigs) view.configs = buildConfigs(view, settings, cleanIps);
  return view;
}

const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));

async function cleanIpsList(env, settings) {
  const stored = safeJsonArray(settings.clean_ips);
  if (stored.length) return stored.map((x) => (typeof x === 'string' ? { ip: x } : x));
  const rows = await env.DB.prepare('SELECT ip, ms, colo FROM clean_ips WHERE ok = 1 ORDER BY ms ASC LIMIT 12').all();
  return rows.results || [];
}

/* ══════════════════════════ روتر اصلی ══════════════════════════ */
export async function handleApi(request, env, ctx, url) {
  const p = url.pathname;
  const method = request.method.toUpperCase();
  await ensureSchema(env);

  /* ───────── عمومی: whoami / setup / login / recover ───────── */
  if (p === '/api/whoami') {
    const settings = await settingsCached(env);
    const account = await currentAccount(env, request);
    const count = await env.DB.prepare('SELECT COUNT(*) c FROM accounts').first();
    const installed = Number(count?.c || 0) > 0;
    return json({
      ok: true,
      username: account?.username || null,
      role: account?.role || null,
      installed,
      panelName: settings.panel_name || 'Omni',
      signup: settings.public_signup === '1',
    });
  }

  if (p === '/api/setup' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || 'admin').trim().slice(0, 40);
    const password = String(body.password || '');
    if (password.length < 6) return bad('weak_password', 'رمز عبور باید حداقل ۶ کاراکتر باشد');
    const count = await env.DB.prepare('SELECT COUNT(*) c FROM accounts').first();
    if (Number(count?.c || 0) > 0) return bad('already_installed', 'پنل قبلاً نصب شده است', 409);
    const { hash, salt } = await hashPassword(password);
    await env.DB.prepare('INSERT INTO accounts(username,pass_hash,pass_salt,role) VALUES(?,?,?,?)')
      .bind(username, hash, salt, 'admin').run();
    await logEvent(env, 'info', `پنل راه‌اندازی شد — مدیر «${username}»`);
    const account = await env.DB.prepare('SELECT * FROM accounts WHERE username = ?').bind(username).first();
    const s = await createSession(env, request, account);
    return json({ ok: true, username }, 200, { 'set-cookie': s.cookie });
  }

  if (p === '/api/login' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || 'admin').trim();
    const password = String(body.password || '');
    const account = await env.DB.prepare('SELECT * FROM accounts WHERE username = ?').bind(username).first();
    if (!account) return bad('bad_credentials', 'نام کاربری یا رمز اشتباه است', 401);
    if (!(await verifyPassword(password, account.pass_hash, account.pass_salt))) {
      await logEvent(env, 'warn', `تلاش ناموفق ورود برای «${username}»`);
      return bad('bad_credentials', 'نام کاربری یا رمز اشتباه است', 401);
    }
    await env.DB.prepare(`UPDATE accounts SET last_login = datetime('now') WHERE id = ?`).bind(account.id).run();
    const s = await createSession(env, request, account);
    return json({ ok: true, username: account.username, role: account.role }, 200, { 'set-cookie': s.cookie });
  }

  if (p === '/api/logout' && method === 'POST') {
    const sid = sessionIdFrom(request);
    if (sid) await revokeSession(env, sid);
    return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
  }

  if (p === '/api/recover' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || '').trim();
    const password = String(body.password || '');
    const real = await getSetting(env, 'recovery_code');
    if (!real || code !== real) return bad('bad_code', 'کد بازیابی نادرست است', 403);
    if (password.length < 6) return bad('weak_password', 'رمز عبور باید حداقل ۶ کاراکتر باشد');
    const account = await env.DB.prepare('SELECT * FROM accounts ORDER BY id LIMIT 1').first();
    if (!account) return bad('not_installed', 'پنل هنوز نصب نشده است', 409);
    const { hash, salt } = await hashPassword(password);
    await env.DB.prepare('UPDATE accounts SET pass_hash = ?, pass_salt = ? WHERE id = ?').bind(hash, salt, account.id).run();
    await revokeAllSessions(env, account.id);
    await putSetting(env, 'recovery_code', randomToken(12));   // کد یک‌بارمصرف
    await logEvent(env, 'warn', 'رمز مدیر با کد بازیابی بازنشانی شد');
    return json({ ok: true });
  }

  if (p === '/api/signup' && method === 'POST') {
    const settings = await settingsCached(env);
    if (settings.public_signup !== '1') return bad('signup_disabled', 'ثبت‌نام عمومی غیرفعال است', 403);
    const ip = request.headers.get('cf-connecting-ip') || '';
    const maxPerIp = Number(settings.signup_max_per_ip || 3);
    const maxPerDay = Number(settings.signup_max_per_day || 50);
    const ipCount = await env.DB.prepare(`SELECT COUNT(*) c FROM signups WHERE ip = ? AND at > datetime('now','-1 day')`).bind(ip).first();
    if (Number(ipCount?.c || 0) >= maxPerIp) return bad('too_many', 'از این آی‌پی تعداد زیادی حساب ساخته شده است', 429);
    const dayCount = await env.DB.prepare(`SELECT COUNT(*) c FROM signups WHERE at > datetime('now','-1 day')`).first();
    if (Number(dayCount?.c || 0) >= maxPerDay) return bad('limit_reached', 'ظرفیت ثبت‌نام امروز پر شده است', 429);

    const username = 'omni-' + randomToken(4).toLowerCase().replace(/[-_]/g, '').slice(0, 6);
    const user = await createUserRecord(env, settings, {
      username,
      quota_gb: Number(settings.default_quota_gb || 50),
      expiry_days: Number(settings.default_expiry_days || 30),
      device_limit: Number(settings.device_limit || 3),
      first_connect: true,
    });
    await env.DB.prepare('INSERT INTO signups(ip,username) VALUES(?,?)').bind(ip, username).run();
    await logEvent(env, 'info', `ثبت‌نام عمومی: «${username}» از ${ip}`);
    const origin = url.origin;
    return json({ ok: true, username, user: userView(user, settings), sub_url: `${origin}/s/${user.sub_token}` });
  }

  /* ───────── صفحه‌ی وضعیت کاربر (عمومی) ───────── */
  if (p.startsWith('/status/')) {
    const token = p.slice(8);
    const settings = await settingsCached(env);
    const u = await env.DB.prepare('SELECT * FROM users WHERE sub_token = ?').bind(token).first();
    if (!u) return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    const conns = await env.DB.prepare(`SELECT COALESCE(SUM(conns),0) c FROM usage_daily WHERE username = ?`).bind(u.username).first();
    const view = userView(u, settings);
    return new Response(statusPage(view, settings, url.origin, { conns: conns?.c || 0 }),
      { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  /* ───────── ساب‌لینک (عمومی) ───────── */
  if (p.startsWith('/s/')) {
    const token = p.slice(3);
    const settings = await settingsCached(env);
    const u = await env.DB.prepare('SELECT * FROM users WHERE sub_token = ?').bind(token).first();
    if (!u) return new Response('not found', { status: 404 });
    const st = userStatus(u);
    if (st === 'disabled') return new Response('اشتراک غیرفعال است', { status: 403 });
    if (st === 'expired') return new Response('اشتراک منقضی شده است', { status: 403 });
    if (st === 'limited') return new Response('حجم اشتراک به پایان رسیده است', { status: 403 });
    const view = userView(u, settings);
    const ips = await cleanIpsList(env, settings);
    const { body, contentType } = subscriptionBody(view, settings, ips, url.searchParams.get('type') || '');
    const expire = u.expires_at ? Math.floor(new Date(String(u.expires_at).replace(' ', 'T') + 'Z').getTime() / 1000) : 0;
    return new Response(body, {
      headers: {
        'content-type': contentType,
        'profile-title': 'base64:' + btoa(unescape(encodeURIComponent(settings.panel_name || 'Omni'))),
        'profile-update-interval': '6',
        'subscription-userinfo': `upload=${u.up_bytes || 0}; download=${u.down_bytes || 0}; total=${u.quota_bytes || 0}; expire=${expire}`,
        'cache-control': 'no-store',
      },
    });
  }

  /* ───────── از اینجا: نیاز به ورود ───────── */
  const account = await currentAccount(env, request);
  if (!account) return bad('unauthorized', 'ابتدا وارد شوید', 401);
  const settings = await settingsCached(env);

  /* ───────── Overview ───────── */
  if (p === '/api/overview') {
    const days = Math.max(1, Math.min(Number(url.searchParams.get('days') || 7), 90));
    const agg = await env.DB.prepare(
      `SELECT COUNT(*) total,
              SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) active,
              SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) disabled,
              COALESCE(SUM(up_bytes + down_bytes), 0) used_bytes,
              COALESCE(SUM(request_count), 0) requests,
              SUM(CASE WHEN expires_at IS NOT NULL AND datetime(expires_at) < datetime('now') THEN 1 ELSE 0 END) expired
       FROM users`).first();
    const series = await env.DB.prepare(
      `SELECT day, COALESCE(SUM(up_bytes),0) up, COALESCE(SUM(down_bytes),0) down
       FROM usage_daily WHERE day >= date('now', ?) GROUP BY day ORDER BY day`).bind(`-${days - 1} days`).all();
    // پر کردن روزهای خالی
    const map = new Map((series.results || []).map((r) => [r.day, r]));
    const filled = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      const row = map.get(d);
      filled.push({ day: d, up: row?.up || 0, down: row?.down || 0 });
    }
    const today = await env.DB.prepare(`SELECT COALESCE(SUM(conns),0) c FROM usage_daily WHERE day = date('now')`).first();
    const top = await env.DB.prepare(
      `SELECT username, (up_bytes + down_bytes) used_bytes, quota_bytes FROM users
       ORDER BY used_bytes DESC LIMIT 6`).all();
    return json({
      ok: true,
      users: {
        total: Number(agg?.total || 0),
        active: Number(agg?.active || 0),
        disabled: Number(agg?.disabled || 0),
        expired: Number(agg?.expired || 0),
        used_bytes: Number(agg?.used_bytes || 0),
        requests: Number(agg?.requests || 0),
      },
      cloudflare: {
        available: true,
        daily: Number(today?.c || 0),
        limit: 100000,
        pct: Math.min(100, Math.round((Number(today?.c || 0) / 100000) * 100)),
      },
      series: filled,
      top: (top.results || []).map((r) => ({
        username: r.username, used_bytes: Number(r.used_bytes || 0), quota_gb: Number(r.quota_bytes || 0) / GB,
      })),
    });
  }

  /* ───────── Users: list ───────── */
  if (p === '/api/users' && method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    const status = url.searchParams.get('status') || 'all';
    const sortKey = ['username', 'used_bytes', 'expires_at', 'created_at'].includes(url.searchParams.get('sort')) ? url.searchParams.get('sort') : 'created_at';
    const dir = url.searchParams.get('dir') === 'asc' ? 'ASC' : 'DESC';
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const size = Math.max(1, Math.min(Number(url.searchParams.get('size') || 20), 200));

    const where = [];
    const binds = [];
    if (q) { where.push('(username LIKE ? OR note LIKE ?)'); binds.push(`%${q}%`, `%${q}%`); }
    if (status === 'active') where.push(`is_active = 1 AND (expires_at IS NULL OR datetime(expires_at) > datetime('now')) AND (quota_bytes = 0 OR (up_bytes+down_bytes) < quota_bytes)`);
    else if (status === 'disabled') where.push('is_active = 0');
    else if (status === 'expired') where.push(`(expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now')) OR (quota_bytes > 0 AND (up_bytes+down_bytes) >= quota_bytes)`);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const orderCol = sortKey === 'used_bytes' ? '(up_bytes + down_bytes)' : sortKey;
    const total = await env.DB.prepare(`SELECT COUNT(*) c FROM users ${whereSql}`).bind(...binds).first();
    const rows = await env.DB.prepare(
      `SELECT * FROM users ${whereSql} ORDER BY ${orderCol} ${dir} LIMIT ? OFFSET ?`
    ).bind(...binds, size, (page - 1) * size).all();
    const users = (rows.results || []).map((u) => userView(u, settings));
    return json({
      ok: true, users,
      total: Number(total?.c || 0),
      pages: Math.max(1, Math.ceil(Number(total?.c || 0) / size)),
      page, size,
    });
  }

  /* ───────── Users: create ───────── */
  if (p === '/api/users' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || '').trim().slice(0, 40);
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return bad('bad_username', 'نام کاربری فقط حروف/عدد/نقطه/خط تیره (۳ تا ۴۰ کاراکتر)');
    const exists = await env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first();
    if (exists) return bad('exists', 'این نام کاربری قبلاً ساخته شده است', 409);
    const user = await createUserRecord(env, settings, { ...body, username });
    await logEvent(env, 'info', `کاربر «${username}» ساخته شد`);
    const view = userView(user, settings, await cleanIpsList(env, settings), { withConfigs: true });
    return json({ ok: true, user: view, configs: view.configs });
  }

  /* ───────── Users: bulk ───────── */
  if (p === '/api/users/bulk' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const names = Array.isArray(body.usernames) ? body.usernames.slice(0, 500) : [];
    const op = String(body.op || '');
    const value = Number(body.value || 0);
    if (!names.length) return bad('no_users', 'کاربری انتخاب نشده');
    const ph = names.map(() => '?').join(',');
    let affected = 0;
    if (op === 'enable' || op === 'disable') {
      await env.DB.prepare(`UPDATE users SET is_active = ? WHERE username IN (${ph})`).bind(op === 'enable' ? 1 : 0, ...names).run();
      affected = names.length;
      await invalidateUsersByNames(env, names);
    } else if (op === 'reset_traffic') {
      await env.DB.prepare(`UPDATE users SET up_bytes = 0, down_bytes = 0, request_count = 0 WHERE username IN (${ph})`).bind(...names).run();
      affected = names.length;
      await invalidateUsersByNames(env, names);
    } else if (op === 'delete') {
      await env.DB.prepare(`DELETE FROM users WHERE username IN (${ph})`).bind(...names).run();
      affected = names.length;
      await invalidateUsersByNames(env, names, true);
    } else if (op === 'extend') {
      const days = value || 30;
      await env.DB.prepare(
        `UPDATE users SET expires_at = datetime(COALESCE(CASE WHEN expires_at > datetime('now') THEN expires_at END, datetime('now')), '+' || ? || ' days'), is_active = 1
         WHERE username IN (${ph})`).bind(days, ...names).run();
      affected = names.length;
      await invalidateUsersByNames(env, names);
    } else if (op === 'quota') {
      await env.DB.prepare(`UPDATE users SET quota_bytes = ? WHERE username IN (${ph})`).bind(Math.max(0, value) * GB, ...names).run();
      affected = names.length;
      await invalidateUsersByNames(env, names);
    } else return bad('bad_op', 'عملیات نامعتبر');
    await logEvent(env, 'info', `عملیات گروهی «${op}» روی ${affected} کاربر`);
    return json({ ok: true, affected });
  }

  /* ───────── Users: single ───────── */
  if (p.startsWith('/api/users/')) {
    const rest = p.slice('/api/users/'.length);
    const [rawName, sub] = rest.split('/');
    const username = decodeURIComponent(rawName || '');

    if (sub === 'reset' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const fields = [];
      if (body.traffic !== false) fields.push('up_bytes = 0', 'down_bytes = 0');
      if (body.requests !== false) fields.push('request_count = 0');
      if (body.devices) fields.push('activated_at = NULL');
      if (fields.length) await env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE username = ?`).bind(username).run();
      if (body.devices) await env.DB.prepare('DELETE FROM devices WHERE username = ?').bind(username).run();
      await invalidateUsersByNames(env, [username]);
      await logEvent(env, 'info', `ریست ${body.traffic !== false ? 'حجم' : ''}${body.requests !== false ? ' و درخواست' : ''} کاربر «${username}»`);
      return json({ ok: true });
    }

    if (sub === 'rotate-token' && method === 'POST') {
      const token = randomToken(18);
      await env.DB.prepare('UPDATE users SET sub_token = ? WHERE username = ?').bind(token, username).run();
      await invalidateUsersByNames(env, [username]);
      await logEvent(env, 'warn', `توکن ساب کاربر «${username}» چرخانده شد`);
      return json({ ok: true, sub_token: token });
    }

    if (sub === 'rotate-uuid' && method === 'POST') {
      const uuid = randomUuid();
      await env.DB.prepare('UPDATE users SET uuid = ? WHERE username = ?').bind(uuid, username).run();
      await invalidateUsersByNames(env, [username]);
      await logEvent(env, 'warn', `UUID کاربر «${username}» چرخانده شد`);
      return json({ ok: true, uuid });
    }

    const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
    if (!user) return bad('not_found', 'کاربر پیدا نشد', 404);

    if (method === 'GET') {
      const days = 14;
      const usage = await env.DB.prepare(
        `SELECT day, up_bytes, down_bytes, conns FROM usage_daily
         WHERE username = ? AND day >= date('now', ?) ORDER BY day`).bind(username, `-${days - 1} days`).all();
      const view = userView(user, settings, await cleanIpsList(env, settings), { withConfigs: true });
      return json({ ok: true, user: view, configs: view.configs, usage: usage.results || [] });
    }

    if (method === 'PATCH') {
      const body = await request.json().catch(() => ({}));
      const patch = userPatchFromBody(body, user);
      if (Object.keys(patch.sql).length || patch.expires) { /* ادامه */ }
      await applyUserPatch(env, username, user, patch);
      await invalidateUsersByNames(env, [username]);
      const fresh = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
      const view = userView(fresh, settings, await cleanIpsList(env, settings), { withConfigs: true });
      await logEvent(env, 'info', `کاربر «${username}» ویرایش شد`);
      return json({ ok: true, user: view, configs: view.configs });
    }

    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM users WHERE username = ?').bind(username).run();
      await env.DB.prepare('DELETE FROM usage_daily WHERE username = ?').bind(username).run();
      await env.DB.prepare('DELETE FROM devices WHERE username = ?').bind(username).run();
      await invalidateUsersByNames(env, [username], true);
      await logEvent(env, 'warn', `کاربر «${username}» حذف شد`);
      return json({ ok: true });
    }
  }

  /* ───────── usage یک کاربر ───────── */
  if (p === '/api/stats/usage') {
    const username = url.searchParams.get('username') || '';
    const days = Math.max(1, Math.min(Number(url.searchParams.get('days') || 14), 90));
    const rows = await env.DB.prepare(
      `SELECT day, up_bytes, down_bytes, conns, up_bytes + down_bytes AS total
       FROM usage_daily WHERE username = ? AND day >= date('now', ?) ORDER BY day`).bind(username, `-${days - 1} days`).all();
    return json({ ok: true, series: rows.results || [] });
  }

  /* ───────── settings ───────── */
  if (p === '/api/settings' && method === 'GET') {
    const st = await allSettings(env);
    const safe = { ...st };
    delete safe.recovery_code;
    return json({ ok: true, settings: { ...DEFAULTS, ...safe }, recovery_code: st.recovery_code || null });
  }

  if (p === '/api/settings' && method === 'PUT') {
    const body = await request.json().catch(() => ({}));
    const allowed = ['panel_name', 'public_host', 'port', 'fragment_preset', 'fingerprint', 'remark_prefix',
      'default_quota_gb', 'default_expiry_days', 'rotate_minutes', 'signup_max_per_ip', 'signup_max_per_day',
      'public_signup', 'maintenance', 'auto_rotate', 'mux_enabled', 'block_ads', 'block_nsfw', 'block_list',
      'clean_ips', 'ip_pool', 'device_limit', 'dns_upstream', 'proto', 'path', 'early_data', 'decoy_url', 'announce',
      'trojan_password'];
    const patch = {};
    for (const k of allowed) {
      const v = body[k];
      if (v === undefined) continue;
      patch[k] = Array.isArray(v) ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    }
    if (patch.path && !String(patch.path).startsWith('/')) return bad('bad_path', 'مسیر باید با / شروع شود');
    await putSettingsBulk(env, patch);
    if (body.clean_ips) {
      const list = safeArray(body.clean_ips).slice(0, 50);
      await env.DB.prepare('DELETE FROM clean_ips').run();
      for (const ip of list) {
        await env.DB.prepare('INSERT OR REPLACE INTO clean_ips(ip, ms, ok) VALUES(?,?,1)').bind(ip, null).run();
      }
    }
    await logEvent(env, 'info', 'تنظیمات پنل به‌روزرسانی شد');
    const st = await allSettings(env);
    delete st.recovery_code;
    return json({ ok: true, settings: { ...DEFAULTS, ...st } });
  }

  if (p === '/api/fragments') {
    return json({ ok: true, presets: FRAGMENT_PRESETS.map(({ id, label }) => ({ id, label })), fingerprints: FINGERPRINTS });
  }

  /* ───────── password ───────── */
  if (p === '/api/password' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const row = await env.DB.prepare('SELECT * FROM accounts WHERE id = ?').bind(account.id).first();
    if (!(await verifyPassword(String(body.current || ''), row.pass_hash, row.pass_salt))) {
      return bad('bad_current', 'رمز فعلی درست نیست', 403);
    }
    const next = String(body.next || '');
    if (next.length < 6) return bad('weak_password', 'رمز جدید باید حداقل ۶ کاراکتر باشد');
    const { hash, salt } = await hashPassword(next);
    await env.DB.prepare('UPDATE accounts SET pass_hash = ?, pass_salt = ? WHERE id = ?').bind(hash, salt, account.id).run();
    await logEvent(env, 'warn', 'رمز مدیر تغییر کرد');
    return json({ ok: true });
  }

  /* ───────── sessions ───────── */
  if (p === '/api/sessions' && method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT id, ua, ip, created_at, last_seen, expires_at FROM sessions WHERE account_id = ? ORDER BY created_at DESC LIMIT 30`)
      .bind(account.id).all();
    const sid = sessionIdFrom(request);
    return json({
      ok: true,
      sessions: (rows.results || []).map((s) => ({
        id: s.id.slice(0, 8) + '…', full_id: s.id, ua: s.ua, ip: s.ip,
        created_at: s.created_at, last_seen: s.last_seen, current: s.id === sid,
      })),
    });
  }
  if (p === '/api/sessions/revoke' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (body.all) {
      await revokeAllSessions(env, account.id, sessionIdFrom(request));
      return json({ ok: true });
    }
    const id = String(body.id || '');
    const match = await env.DB.prepare('SELECT id FROM sessions WHERE account_id = ? AND id LIKE ?').bind(account.id, id.replace('…', '') + '%').first();
    if (match) await revokeSession(env, match.id);
    return json({ ok: true });
  }

  /* ───────── دیاگ: ping / probe / rank / logs / maintenance ───────── */
  if (p === '/api/diag/ping') {
    const target = url.searchParams.get('target') || settings.public_host;
    if (!target) return bad('no_target', 'مقصد مشخص نیست');
    const r = await tcpProbe(target, { port: Number(settings.port || 443), timeoutMs: 4000 });
    return json({ ok: Boolean(r.ok), ms: r.ms, host: target, error: r.err || null });
  }

  if (p === '/api/diag/probe-node' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const r = await probeNode(body.proxy || '');
    await logEvent(env, r.ok ? 'info' : 'warn', `probe نود ${body.proxy || '-'}: ${r.ok ? r.ms + 'ms' : r.error}`);
    return json(r);
  }

  if (p === '/api/diag/rank-ips' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    let ips = Array.isArray(body.ips) ? body.ips.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(String(x))).slice(0, 400) : [];
    if (!ips.length) {
      const cidrs = await fetchCfCidrs();
      ips = sampleIPs(cidrs, 120);
    }
    const results = await rankIps(ips, {
      port: Number(settings.port || 443),
      timeoutMs: Number(body.timeout || 1500),
      concurrency: Number(body.concurrency || 12),
      rounds: Number(body.rounds || 1),
      deep: Boolean(body.deep),
    });
    const best = results.slice(0, 20);
    await env.DB.prepare('DELETE FROM clean_ips').run();
    for (const r of best.slice(0, 12)) {
      await env.DB.prepare('INSERT OR REPLACE INTO clean_ips(ip, ms, colo, ok, checked_at) VALUES(?,?,?,1,datetime(\'now\'))')
        .bind(r.ip, r.ms, null).run();
    }
    await logEvent(env, 'info', `رتبه‌بندی آی‌پی: ${results.length} پاسخ‌دهنده از ${ips.length} تست (بهترین ${best[0]?.ms ?? '—'}ms)`);
    return json({ ok: true, tested: ips.length, alive: results.length, results: best });
  }

  if (p === '/api/diag/logs' && method === 'GET') {
    const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 50), 200));
    const rows = await env.DB.prepare('SELECT id, level, msg, meta, at FROM logs ORDER BY id DESC LIMIT ?').bind(limit).all();
    return json({ ok: true, entries: rows.results || [] });
  }

  if (p === '/api/diag/maintenance' && method === 'POST') {
    const before = await env.DB.prepare('SELECT COUNT(*) c FROM users').first();
    const logs = await env.DB.prepare(`DELETE FROM logs WHERE at < datetime('now','-30 days')`).run();
    const sessions = await env.DB.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
    const usage = await env.DB.prepare(`DELETE FROM usage_daily WHERE day < date('now','-90 days')`).run();
    const devices = await env.DB.prepare(`DELETE FROM devices WHERE last_seen < datetime('now','-30 days')`).run();
    // غیرفعال‌سازی منقضی‌ها
    const expired = await env.DB.prepare(
      `UPDATE users SET is_active = 0 WHERE is_active = 1 AND expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')`).run();
    await logEvent(env, 'info', `نگهداری اجرا شد (logs:${logs.meta?.changes || 0}, sessions:${sessions.meta?.changes || 0}, expired:${expired.meta?.changes || 0})`);
    return json({
      ok: true,
      stats: {
        users: Number(before?.c || 0),
        cleaned: {
          logs: logs.meta?.changes || 0, sessions: sessions.meta?.changes || 0,
          usage: usage.meta?.changes || 0, devices: devices.meta?.changes || 0, expired: expired.meta?.changes || 0,
        },
      },
    });
  }

  /* ───────── backup / restore ───────── */
  if (p === '/api/backup' && method === 'GET') {
    const users = await env.DB.prepare('SELECT * FROM users').all();
    const settingsRows = await env.DB.prepare('SELECT key,value FROM settings').all();
    const st = {};
    for (const r of (settingsRows.results || [])) st[r.key] = r.value;
    delete st.recovery_code;
    const payload = {
      app: 'omni', version: 1, at: new Date().toISOString(),
      settings: st, users: users.results || [],
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="omni-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  }

  if (p === '/api/backup' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const users = Array.isArray(body.users) ? body.users : [];
    const st = body.settings && typeof body.settings === 'object' ? body.settings : {};
    let imported = 0;
    for (const u of users.slice(0, 2000)) {
      if (!u?.username) continue;
      await env.DB.prepare(
        `INSERT INTO users(username,uuid,sub_token,quota_bytes,up_bytes,down_bytes,request_count,request_limit,
          device_limit,expires_at,first_connect,activated_at,is_active,note,fragment,fingerprint,ips,proxies,block_list)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(username) DO UPDATE SET quota_bytes=excluded.quota_bytes, up_bytes=excluded.up_bytes,
          down_bytes=excluded.down_bytes, is_active=excluded.is_active, expires_at=excluded.expires_at,
          device_limit=excluded.device_limit, note=excluded.note`
      ).bind(u.username, u.uuid || randomUuid(), u.sub_token || randomToken(18), u.quota_bytes || 0,
        u.up_bytes || 0, u.down_bytes || 0, u.request_count || 0, u.request_limit || 0, u.device_limit || 3,
        u.expires_at || null, u.first_connect ? 1 : 0, u.activated_at || null, u.is_active === 0 ? 0 : 1,
        u.note || null, u.fragment || null, u.fingerprint || null,
        JSON.stringify(u.ips || []), JSON.stringify(u.proxies || []), JSON.stringify(u.block_list || [])).run();
      imported++;
    }
    const cleanSt = { ...st };
    delete cleanSt.recovery_code;
    await putSettingsBulk(env, cleanSt);
    invalidateUser(null);
    await logEvent(env, 'warn', `بازیابی پشتیبان: ${imported} کاربر`);
    return json({ ok: true, imported });
  }

  /* ───────── ربات: pairing و تست ───────── */
  if (p === '/api/bot/status') {
    const st = await allSettings(env);
    return json({
      ok: true,
      configured: Boolean(env.BOT_TOKEN),
      paired: Boolean(st.admin_chat_id),
      pair_code: st.bot_pair_code || null,
      bot_username: env.BOT_USERNAME || null,
    });
  }
  if (p === '/api/bot/pair-code' && method === 'POST') {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await putSetting(env, 'bot_pair_code', code);
    return json({ ok: true, code, hint: `در تلگرام به ربات بفرست: /pair ${code}` });
  }
  if (p === '/api/bot/notify' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { tgApi } = await import('./bot.js');
    const chat = (await allSettings(env)).admin_chat_id;
    if (!chat || !env.BOT_TOKEN) return bad('bot_not_paired', 'ربات متصل نیست', 400);
    await tgApi(env, 'sendMessage', { chat_id: chat, text: String(body.text || 'تست Omni ✅').slice(0, 500), parse_mode: 'HTML' });
    return json({ ok: true });
  }

  return bad('not_found', 'مسیر ناشناخته', 404);
}

/* ═══════════════════ کمک‌تابع‌ها ═══════════════════ */

export async function createUserRecord(env, settings, body) {
  const username = String(body.username).slice(0, 40);
  const quotaBytes = body.quota_bytes !== undefined ? Number(body.quota_bytes)
    : Math.max(0, Number(body.quota_gb ?? settings.default_quota_gb ?? 50) * GB);
  const days = Number(body.expiry_days ?? settings.default_expiry_days ?? 30);
  const firstConnect = body.first_connect === true || body.first_connect === '1' || body.first_connect === 'on';
  const expiresAt = firstConnect ? null : new Date(Date.now() + Math.max(1, days) * 864e5).toISOString().slice(0, 19).replace('T', ' ');
  const uuid = body.uuid && isUuid(body.uuid) ? body.uuid : randomUuid();
  const subToken = randomToken(18);
  await env.DB.prepare(
    `INSERT INTO users(username,uuid,sub_token,quota_bytes,device_limit,request_limit,expires_at,first_connect,
      is_active,note,fragment,fingerprint,ips,proxies,block_list,pending_days)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(username, uuid, subToken, quotaBytes,
    Number(body.device_limit ?? settings.device_limit ?? 3), Number(body.request_limit || 0),
    expiresAt, firstConnect ? 1 : 0, body.is_active === false || body.is_active === '0' ? 0 : 1,
    body.note ? String(body.note).slice(0, 200) : null,
    body.fragment || null, body.fingerprint || null,
    JSON.stringify(safeArray(body.ips)), JSON.stringify(safeArray(body.proxies)), JSON.stringify(safeArray(body.block_list)),
    Math.max(1, days)).run();
  invalidateUser(uuid);
  return env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
}

function userPatchFromBody(body, current) {
  const patch = { sql: {}, expires: null };
  if (body.quota_gb !== undefined) patch.sql.quota_bytes = Math.max(0, Number(body.quota_gb) * GB);
  if (body.quota_bytes !== undefined) patch.sql.quota_bytes = Math.max(0, Number(body.quota_bytes));
  if (body.device_limit !== undefined) patch.sql.device_limit = Math.max(1, Number(body.device_limit));
  if (body.request_limit !== undefined) patch.sql.request_limit = Math.max(0, Number(body.request_limit));
  if (body.note !== undefined) patch.sql.note = String(body.note).slice(0, 200);
  if (body.fragment !== undefined) patch.sql.fragment = String(body.fragment);
  if (body.fingerprint !== undefined) patch.sql.fingerprint = String(body.fingerprint);
  if (body.ips !== undefined) patch.sql.ips = JSON.stringify(safeArray(body.ips));
  if (body.proxies !== undefined) patch.sql.proxies = JSON.stringify(safeArray(body.proxies));
  if (body.block_list !== undefined) patch.sql.block_list = JSON.stringify(safeArray(body.block_list));
  if (body.is_active !== undefined) patch.sql.is_active = body.is_active ? 1 : 0;
  if (body.first_connect !== undefined) patch.sql.first_connect = body.first_connect ? 1 : 0;
  if (body.expiry_days !== undefined) {
    const days = Number(body.expiry_days);
    patch.expires = new Date(Date.now() + Math.max(1, days) * 864e5).toISOString().slice(0, 19).replace('T', ' ');
    patch.sql.pending_days = Math.max(1, days);
  }
  if (body.extend_days !== undefined) {
    const days = Number(body.extend_days);
    const base = current.expires_at && new Date(String(current.expires_at).replace(' ', 'T') + 'Z') > new Date()
      ? new Date(String(current.expires_at).replace(' ', 'T') + 'Z') : new Date();
    patch.expires = new Date(base.getTime() + Math.max(1, days) * 864e5).toISOString().slice(0, 19).replace('T', ' ');
  }
  return patch;
}

async function applyUserPatch(env, username, current, patch) {
  const sets = [];
  const binds = [];
  for (const [k, v] of Object.entries(patch.sql)) {
    if (k === 'expires_at') continue;
    sets.push(`${k} = ?`); binds.push(v);
  }
  if (patch.expires) { sets.push('expires_at = ?'); binds.push(patch.expires); }
  if (!sets.length) return;
  // اگر کاربر در حالت first-connect است و ادمین انقضا می‌دهد، فعال‌سازی هم انجام شود
  if (patch.expires && current.first_connect && !current.activated_at) {
    sets.push('activated_at = datetime(\'now\')');
  }
  binds.push(username);
  await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE username = ?`).bind(...binds).run();
}

async function invalidateUsersByNames(env, names, removed = false) {
  for (const n of names) {
    const row = await env.DB.prepare('SELECT uuid FROM users WHERE username = ?').bind(n).first().catch(() => null);
    if (row?.uuid) invalidateUser(row.uuid);
  }
  if (removed) invalidateUser(null);
}
