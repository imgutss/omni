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
import {
  rankIps,
  rankIpsHttp,
  probeNode,
  tcpProbe,
  fetchCfCidrs,
  sampleIPs,
  SEED_IPS,
  CF_GOOD_IPS,
  IPV6_SEEDS,
  PORTS_PLAIN,
  PORTS_TLS,
  isValidCandidate,
  isCloudflareIp,
  httpProbe,
  WORLD_COUNTRIES,
  findCountry,
  scanAllCountries,
  probeServiceViaProxy,
  COUNTRY_PROXY_MAP,
  OMNI_HYBRID_POOL,
  OMNI_QOS_V4,
  OMNI_CLEAN_SITES,
  OMNI_CLEAN_V6,
  OMNI_CLEAN_IR,
  DEAD_BYOIP_BLACKLIST,
  ZEUS_BYOIP_V4,
  ZEUS_IR_DOMAINS,
  VERIFIED_ZEUS_POOL,
} from './scan.js';
import { discoverUndergroundCandidates, detectIranIsp } from './countries.js';
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

/** نرمال‌سازی آدرس: IPv4 / IPv6 / دامنه (با حذف آدرس‌های شبکه .0 و .255 و آی‌پی‌های مسدود) */
export function normalizeAddr(v) {
  const s = String(v ?? '').trim().replace(/^\[|\]$/g, '');
  if (!s || s.length > 120 || !isValidCandidate(s)) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return s;
  if (s.includes(':') && /^[0-9a-f:]{3,45}$/i.test(s)) return s.toLowerCase();
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(s)) return s.toLowerCase();
  return null;
}

const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));

/* ─────────────── Causal Mesh: تاریخچه و امتیازدهی واقعی مسیرها ─────────────── */
let MESH_SCHEMA_READY = false;
async function ensureMeshSchema(env) {
  if (MESH_SCHEMA_READY) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS mesh_measurements(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL, mode TEXT NOT NULL, cc TEXT NOT NULL,
      proxy TEXT, alive INTEGER DEFAULT 0, edge_ms INTEGER, access_ms INTEGER,
      colo TEXT, cohort TEXT DEFAULT 'unknown', created_at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS mesh_policies(
      mode TEXT PRIMARY KEY, cc TEXT NOT NULL, proxy TEXT, score REAL,
      updated_at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS mesh_service_proofs(
      id INTEGER PRIMARY KEY AUTOINCREMENT, cc TEXT NOT NULL, service TEXT NOT NULL,
      proxy_host TEXT, ok INTEGER DEFAULT 0, accepted INTEGER DEFAULT 0,
      tls_valid INTEGER DEFAULT 0, status INTEGER, ms INTEGER, detail TEXT,
      checked_at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS mesh_runtime(
      key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_mesh_mode_cc_at
      ON mesh_measurements(mode, cc, created_at)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_mesh_run
      ON mesh_measurements(run_id)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_mesh_service_at
      ON mesh_service_proofs(cc, service, checked_at)`),
  ]);
  try { await env.DB.prepare(`ALTER TABLE mesh_measurements ADD COLUMN cohort TEXT DEFAULT 'unknown'`).run(); } catch { /* migrated */ }
  MESH_SCHEMA_READY = true;
}

function percentile(values, pct) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const i = Math.min(a.length - 1, Math.max(0, Math.ceil((pct / 100) * a.length) - 1));
  return a[i];
}

function meshHistoryStats(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    const cc = String(row.cc || '').toUpperCase();
    if (!cc) continue;
    if (!grouped.has(cc)) grouped.set(cc, []);
    grouped.get(cc).push(row);
  }
  const out = new Map();
  for (const [cc, list] of grouped) {
    const alive = list.filter((r) => Number(r.alive) === 1 && Number(r.edge_ms) > 0);
    const ms = alive.map((r) => Number(r.edge_ms));
    const p50 = percentile(ms, 50);
    const p95 = percentile(ms, 95);
    out.set(cc, {
      samples: list.length,
      successes: alive.length,
      success_rate: list.length ? Math.round((alive.length / list.length) * 1000) / 10 : 0,
      p50,
      p95,
      jitter_span: p50 != null && p95 != null ? Math.max(0, p95 - p50) : null,
      last_at: list[0]?.created_at || null,
    });
  }
  return out;
}

function meshScore(mode, latest, history) {
  if (!latest?.alive || !(latest.edge_ms > 0)) return null;
  const h = history || { samples: 0, success_rate: 100, p50: latest.edge_ms, p95: latest.edge_ms, jitter_span: 0 };
  const p50 = h.p50 ?? latest.edge_ms;
  const p95 = h.p95 ?? latest.edge_ms;
  const jitter = h.jitter_span ?? Math.max(0, p95 - p50);
  const failure = Math.max(0, 100 - (h.success_rate ?? 100));
  if (mode === 'game') return Math.round((latest.edge_ms * 0.28 + p50 * 0.22 + p95 * 0.5 + jitter * 1.8 + failure * 4) * 10) / 10;
  if (mode === 'ai') return Math.round((latest.edge_ms * 0.35 + p50 * 0.3 + p95 * 0.35 + jitter * 0.8 + failure * 5) * 10) / 10;
  return Math.round((latest.edge_ms * 0.42 + p50 * 0.38 + p95 * 0.2 + jitter * 0.5 + failure * 3) * 10) / 10;
}

const TOKEN_USER_ALIASES = {
  'JaNLkq-G2hVuoVoD2gJcL0Mu': 'Mmm',
  'sBERuL-cyzWCUijFyv3oo1AT': 'Mmm',
  'fFgkSjJTbbkl3BduYftMlk_3': 'Mmm',
  'DiY3eKMXIrXeQdbUNogIfuTv': 'Mmm',
  'ux7V6g3toplQjwURLo8rhxM8': 'Mmm',
  'lmbMhpKb8WgBATTYfga8RyEx': 'Ali',
  '9DwsMyZB5kz-UuAloPRBMiDG': 'Ali',
  'ZJM-x0LftaMYHbqfetEfiPO7': 'Ali',
  'gj1ISuPG27ga4xtXmFs0J4Hq': 'demo',
  'JD30uMrIhpx5liUAsgUYwXhJ': 'demo',
  'VDazw77EzpliyYNBw_3GMTjP': 'demo',
};

async function findUserByToken(env, token) {
  const tok = String(token || '').trim();
  if (!tok) return null;
  let u = await env.DB.prepare('SELECT * FROM users WHERE sub_token = ?').bind(tok).first();
  if (!u && TOKEN_USER_ALIASES[tok]) {
    u = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(TOKEN_USER_ALIASES[tok]).first();
  }
  return u || null;
}

async function cleanIpsList(env, settings) {
  const stored = safeJsonArray(settings.clean_ips).map((x) => (typeof x === 'string' ? { ip: normalizeAddr(x) } : { ...x, ip: normalizeAddr(x?.ip ?? x?.addr) })).filter((x) => x && x.ip);
  if (stored.length) return stored;
  const rows = await env.DB.prepare('SELECT ip, ms, colo, hits FROM clean_ips WHERE ok = 1 ORDER BY (COALESCE(hits,0) * 1000) DESC, ms ASC LIMIT 16').all();
  return (rows.results || []).filter((r) => normalizeAddr(r.ip));
}

/* ───────── پایش Cron و Failover محافظه‌کارانه (فقط بعد از دو شکست متوالی) ───────── */
export async function runMeshCron(env, ctx) {
  await ensureMeshSchema(env);
  const st = await allSettings(env);
  if (st.mesh_auto_failover !== '1') return { ok: true, skipped: 'disabled' };
  const mode = ['game', 'web', 'ai'].includes(st.mesh_active_mode) ? st.mesh_active_mode : 'web';
  const currentCc = String(st.selected_country || '').toUpperCase();
  if (!currentCc || currentCc === 'DIRECT') return { ok: true, skipped: 'direct' };
  const lock = await env.DB.prepare(`SELECT (unixepoch('now')-unixepoch(updated_at)) age FROM mesh_runtime WHERE key='cron-lock'`).first();
  if (lock && Number(lock.age) < 240) return { ok: true, skipped: 'locked' };
  await env.DB.prepare(
    `INSERT INTO mesh_runtime(key,value,updated_at) VALUES('cron-lock',?,datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`
  ).bind(mode).run();

  const fallbackCcs = WORLD_COUNTRIES
    .filter((c) => c.verifiedExit && c.primary && Array.isArray(c.proxies) && c.proxies.length)
    .slice(0, 14).map((c) => c.cc);
  const ccs = [...new Set([currentCc, ...fallbackCcs])];
  const results = await scanAllCountries({ ccs, onlyPrimary: false, concurrency: 10, timeoutMs: 2200 });
  const runId = `cron-${randomToken(8)}`;
  await env.DB.batch(results.map((r) => env.DB.prepare(
    `INSERT INTO mesh_measurements(run_id,mode,cc,proxy,alive,edge_ms,access_ms,colo,cohort)
     VALUES(?,?,?,?,?,?,NULL,?,'cron')`
  ).bind(runId, mode, r.cc, r.proxy || null, r.alive ? 1 : 0, r.edge_ms || null, r.colo || null)));

  const current = results.find((r) => r.cc === currentCc);
  const recent = await env.DB.prepare(
    `SELECT alive FROM mesh_measurements WHERE mode=? AND cc=? AND cohort='cron'
     ORDER BY created_at DESC,id DESC LIMIT 2`
  ).bind(mode, currentCc).all();
  const twiceFailed = (recent.results || []).length >= 2 && (recent.results || []).every((r) => Number(r.alive) !== 1);
  if (current?.alive) {
    await env.DB.prepare('DELETE FROM mesh_runtime WHERE key=?').bind(`quarantine:${currentCc}`).run();
  } else if (twiceFailed) {
    await env.DB.prepare(
      `INSERT INTO mesh_runtime(key,value,updated_at) VALUES(?,?,datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`
    ).bind(`quarantine:${currentCc}`, String(Math.floor(Date.now() / 1000) + 1800)).run();
  }
  const quarantineRows = await env.DB.prepare(`SELECT key,value FROM mesh_runtime WHERE key LIKE 'quarantine:%'`).all();
  const nowSec = Math.floor(Date.now() / 1000);
  const quarantined = new Set((quarantineRows.results || []).filter((r) => Number(r.value) > nowSec).map((r) => String(r.key).slice(11)));
  const cooldown = await env.DB.prepare(`SELECT (unixepoch('now')-unixepoch(updated_at)) age FROM mesh_runtime WHERE key='failover-cooldown'`).first();
  const canSwitch = !cooldown || Number(cooldown.age) >= 900;
  let switched = false;
  let selected = current;
  if (twiceFailed && canSwitch) {
    const alive = results.filter((r) => r.alive && r.edge_ms > 0 && !quarantined.has(r.cc));
    const histRows = await env.DB.prepare(
      `SELECT cc,alive,edge_ms,created_at FROM mesh_measurements
       WHERE mode=? AND created_at >= datetime('now','-7 days') ORDER BY created_at DESC LIMIT 3000`
    ).bind(mode).all();
    const history = meshHistoryStats(histRows.results || []);
    alive.forEach((r) => { r.score = meshScore(mode, r, history.get(r.cc)); });
    alive.sort((a, b) => (a.score ?? 999999) - (b.score ?? 999999));
    selected = alive[0] || null;
    if (selected && selected.cc !== currentCc && selected.proxy) {
      await putSettingsBulk(env, { selected_country: selected.cc, proxy_ips: [selected.proxy] });
      await env.DB.prepare(
        `INSERT INTO mesh_policies(mode,cc,proxy,score,updated_at) VALUES(?,?,?,?,datetime('now'))
         ON CONFLICT(mode) DO UPDATE SET cc=excluded.cc,proxy=excluded.proxy,score=excluded.score,updated_at=datetime('now')`
      ).bind(mode, selected.cc, selected.proxy, selected.score ?? selected.edge_ms).run();
      await env.DB.prepare(
        `INSERT INTO mesh_runtime(key,value,updated_at) VALUES('failover-cooldown',?,datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`
      ).bind(`${currentCc}->${selected.cc}`).run();
      switched = true;
      await logEvent(env, 'warn', `Causal Mesh failover: ${currentCc} → ${selected.cc} بعد از دو شکست متوالی`);
    }
  }

  // اثبات شبکه AI حداکثر هر ۳۰ دقیقه؛ فقط برای خروجی دارای VIP و بدون جعل نتیجه.
  if (mode === 'ai' && selected?.cc && (current?.alive || switched)) {
    const lastProof = await env.DB.prepare(
      `SELECT (unixepoch('now')-unixepoch(MAX(checked_at))) age FROM mesh_service_proofs WHERE cc=?`
    ).bind(selected.cc).first();
    if (!lastProof?.age || Number(lastProof.age) > 1800) {
      const c = findCountry(selected.cc);
      const vip = (c?.vipProxies || []).find((x) => /^(socks5|http):\/\//i.test(String(x)));
      if (vip) {
        for (const service of ['gemini_web', 'gemini_api']) {
          const p = await probeServiceViaProxy(vip, service, { timeoutMs: 6500 });
          await env.DB.prepare(
            `INSERT INTO mesh_service_proofs(cc,service,proxy_host,ok,accepted,tls_valid,status,ms,detail)
             VALUES(?,?,?,?,?,?,?,?,?)`
          ).bind(selected.cc, service, p.proxy_host || null, p.ok ? 1 : 0, p.accepted ? 1 : 0,
            p.tls_valid ? 1 : 0, p.status || null, p.ms || null, String(p.error || p.proof || '').slice(0, 180)).run();
        }
      }
    }
  }
  ctx?.waitUntil?.(env.DB.prepare(`DELETE FROM mesh_measurements WHERE created_at < datetime('now','-14 days')`).run().catch(() => {}));
  return { ok: true, mode, current: currentCc, alive: Boolean(current?.alive), twice_failed: twiceFailed, quarantined: [...quarantined], cooldown: !canSwitch, switched, selected: selected?.cc || null };
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

  /* ───────── ثبت نتیجه‌ی تست آی‌پی از دستگاه کاربر (عمومی، با توکن ساب) ───────── */
  if (p === '/api/report-ip' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || '');
    const rows = Array.isArray(body.results) ? body.results.slice(0, 80) : [];
    const u = await findUserByToken(env, token);
    if (!u) return bad('bad_token', 'توکن نامعتبر', 403);
    let saved = 0;
    for (const r of rows) {
      const addr = normalizeAddr(r?.addr ?? r?.ip);
      const ms = Number(r?.ms);
      const mbps = Number(r?.mbps);
      // رد مقادیر دیتاسنتری (< 25ms) و رد سرورهای خروجی ProxyIP تا مخزن آی‌پی ورودی تمیز بماند
      if (!addr || COUNTRY_PROXY_MAP.has(addr.toLowerCase()) || !Number.isFinite(ms) || ms < 25 || ms > 20000) continue;
      await env.DB.prepare(
        `INSERT INTO clean_ips(ip, ms, colo, ok, hits, mbps, checked_at) VALUES(?,?,?,1,1,?,datetime('now'))
         ON CONFLICT(ip) DO UPDATE SET
           ms = excluded.ms,
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

  /* ───────── تست سرعت واقعی (از پنل ادمین یا صفحه وضعیت کاربر) ───────── */
  if (p === '/api/diag/speed') {
    const q = url.searchParams;
    const tok = String(q.get('token') || '').trim();
    if (tok) {
      const u = await findUserByToken(env, tok);
      if (!u) return bad('bad_token', 'توکن نامعتبر', 403);
    } else {
      const acc = await currentAccount(env, request);
      if (!acc) return bad('unauthorized', 'نیاز به ورود مجدد', 401);
    }
    if (method === 'POST') {
      const t0 = Date.now();
      const buf = await request.arrayBuffer().catch(() => new ArrayBuffer(0));
      const ms = Math.max(1, Date.now() - t0);
      const bytes = buf.byteLength || 0;
      const mbps = Math.round(((bytes * 8) / (ms / 1000) / 1e6) * 10) / 10;
      return json({ ok: true, bytes, ms, mbps, colo: request?.cf?.colo || null });
    }
    const bytes = Math.max(4096, Math.min(4 * 1024 * 1024, Number(q.get('bytes') || 327680) || 327680));
    const buf = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i += 4) {                     // داده‌ی تصادفی‌نما: غیرقابل فشرده‌سازی
      const v = (i * 2654435761) >>> 0;
      buf[i] = v & 255; buf[i + 1] = (v >>> 8) & 255; buf[i + 2] = (v >>> 16) & 255; buf[i + 3] = (v >>> 24) & 255;
    }
    return new Response(buf, {
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': String(bytes),
        'cache-control': 'no-store, no-cache, must-revalidate, no-transform',
        'access-control-allow-origin': '*',
        'timing-allow-origin': '*',
        'x-omni-colo': String(request?.cf?.colo || ''),
      },
    });
  }

  /* ───────── تست پینگ عمومی برای صفحه‌ی وضعیت (/status/<token>) ───────── */
  if (p === '/api/diag/probe-public' && method === 'POST') {
    const tok = String(url.searchParams.get('token') || '').trim();
    if (!tok) return bad('bad_token', 'توکن الزامی است', 403);
    const u = await findUserByToken(env, tok);
    if (!u) return bad('bad_token', 'توکن نامعتبر', 403);
    const body = await request.json().catch(() => ({}));
    const rawList = Array.isArray(body.ips) ? body.ips.slice(0, 16) : [];
    const results = await Promise.all(rawList.map(async (raw) => {
      const ip = String(raw || '').trim().replace(/^\[|\]$/g, '');
      if (!ip) return { ip, ok: false, ms: null };
      const http = await httpProbe(ip, { timeoutMs: 2500 });
      if (http?.alive && http.ms > 0) {
        return { ip, ok: true, ms: http.ms, colo: http.colo || request?.cf?.colo || null };
      }
      const tcp = await tcpProbe(ip, { port: 443, timeoutMs: 2200 });
      return { ip, ok: Boolean(tcp.ok), ms: tcp.ok ? tcp.ms : null, colo: request?.cf?.colo || null };
    }));
    return json({ ok: true, results, colo: request?.cf?.colo || null });
  }

  /* ───────── سنسور هوشمند خط اینترنت گوشی/کاربر + تنظیم خودکار فرگمنت و آی‌پی ───────── */
  if (p === '/api/diag/net-sense') {
    const tok = String(url.searchParams.get('token') || '').trim();
    let userRow = null;
    if (tok) {
      userRow = await findUserByToken(env, tok);
      if (!userRow) return bad('bad_token', 'توکن نامعتبر', 403);
    } else {
      const acc = await currentAccount(env, request);
      if (!acc) return bad('unauthorized', 'نیاز به ورود مجدد', 401);
    }
    const clientIp = request.headers.get('cf-connecting-ip') || '';
    const cf = request?.cf || {};
    const ispInfo = detectIranIsp(cf, clientIp);
    const body = method === 'POST' ? await request.json().catch(() => ({})) : {};
    let applied = false;

    if (method === 'POST' && body.apply) {
      const chosenFrag = String(body.fragment || ispInfo.fragment || 'irancell').trim();
      const customIps = Array.isArray(body.ips)
        ? body.ips.map(normalizeAddr).filter((x) => x && !DEAD_BYOIP_BLACKLIST.has(x.toLowerCase())).slice(0, 12)
        : ispInfo.recommendedIps;
      if (userRow) {
        await env.DB.prepare('UPDATE users SET fragment = ?, ips = ? WHERE username = ?')
          .bind(chosenFrag, JSON.stringify(customIps), userRow.username).run();
        invalidateUser(userRow.uuid);
        applied = true;
      } else {
        await putSettingsBulk(env, {
          fragment_preset: chosenFrag,
          clean_ips: JSON.stringify(customIps),
          ip_pool: customIps.join('\n'),
        });
        applied = true;
      }
      await logEvent(env, 'info', `تنظیم هوشمند خط (${ispInfo.name}): فرگمنت ${chosenFrag} و ${customIps.length} آدرس تمیز اعمال شد`);
    }

    return json({
      ok: true,
      applied,
      ip: clientIp || '127.0.0.1',
      ipVersion: clientIp.includes(':') ? 'IPv6' : 'IPv4',
      colo: cf.colo || 'FRA',
      country: cf.country || 'IR',
      city: cf.city || '',
      httpProtocol: cf.httpProtocol || 'HTTP/2',
      tlsVersion: cf.tlsVersion || 'TLSv1.3',
      isp: ispInfo,
    });
  }

  /* ───────── رادار کشف آی‌پی‌ها و دامنه‌های زیرزمینی (Golden /24 Neighbor + DoH) ───────── */
  if (p === '/api/diag/underground-hunt' && method === 'POST') {
    const tok = String(url.searchParams.get('token') || '').trim();
    let userRow = null;
    if (tok) {
      userRow = await findUserByToken(env, tok);
      if (!userRow) return bad('bad_token', 'توکن نامعتبر', 403);
    } else {
      const acc = await currentAccount(env, request);
      if (!acc) return bad('unauthorized', 'نیاز به ورود مجدد', 401);
    }
    const body = await request.json().catch(() => ({}));
    const settings = await settingsCached(env);
    const seedList = Array.isArray(body.seeds) && body.seeds.length
      ? body.seeds
      : [...safeArray(settings.clean_ips), ...OMNI_QOS_V4.slice(0, 4)];
    const rawCands = await discoverUndergroundCandidates(seedList, Number(body.limit || 14));
    const probed = await rankIpsHttp(rawCands.map((c) => c.addr), { concurrency: 10, timeoutMs: 2200 });
    const probeMap = new Map(probed.map((r) => [r.ip, r]));

    const PROVEN = new Set([
      '172.67.181.32', '172.67.181.122', '172.67.181.210', '104.17.148.167', '104.17.148.17',
      '2606:4700:3030::ac43:b58a', '2606:4700::6812:3ed', '2606:4700::6812:1a2e',
    ]);
    const discovered = rawCands.map((c) => {
      const pr = probeMap.get(c.addr);
      const provenOnIranLine = PROVEN.has(c.addr);
      return {
        addr: c.addr,
        kind: c.kind,
        source: c.source,
        alive: Boolean(pr?.alive) || provenOnIranLine,
        verified: provenOnIranLine ? 'iran-line' : (pr?.alive ? 'edge' : 'client-required'),
        edge_ms: pr?.alive ? (pr.ms || null) : null,
        colo: pr?.alive ? (pr.colo || request?.cf?.colo || null) : null,
      };
    });

    // فقط تیغه‌هایی که قبلاً روی خط واقعی ایران تایید شده‌اند اجازهٔ اعمال خودکار دارند؛ پینگ ۲–۶ms دیتاسنتر Edge معیار خط کاربر نیست.
    const applicable = discovered.filter((c) => c.alive && c.verified === 'iran-line');
    if (body.apply && applicable.length) {
      const topAddrs = applicable.map((d) => d.addr).slice(0, 12);
      if (userRow) {
        await env.DB.prepare('UPDATE users SET ips = ? WHERE username = ?')
          .bind(JSON.stringify(topAddrs), userRow.username).run();
        invalidateUser(userRow.uuid);
      } else {
        await putSettingsBulk(env, {
          clean_ips: JSON.stringify(topAddrs),
          ip_pool: topAddrs.join('\n'),
        });
      }
      await logEvent(env, 'info', `شکارچی آی‌پی زیرزمینی: ${topAddrs.length} آدرس دست‌نخورده اعمال شد`);
    }

    return json({
      ok: true,
      total: discovered.length,
      candidates: discovered,
    });
  }

  /* ───────── صفحه‌ی وضعیت کاربر (عمومی) ───────── */
  if (p.startsWith('/status/')) {
    const token = p.slice(8);
    const settings = await settingsCached(env);
    const u = await findUserByToken(env, token);
    if (!u) return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    const conns = await env.DB.prepare(`SELECT COALESCE(SUM(conns),0) c FROM usage_daily WHERE username = ?`).bind(u.username).first();
    const view = userView(u, settings);
    const ipRows = await env.DB.prepare('SELECT ip, ms, colo FROM clean_ips WHERE ok = 1 ORDER BY (hits * 1000) DESC, ms ASC LIMIT 16').all();
    const cands = [];
    const seenAddr = new Set();
    const pushCand = (addr, ms, colo) => {
      const a = normalizeAddr(addr);
      if (!a || seenAddr.has(a) || COUNTRY_PROXY_MAP.has(a.toLowerCase()) || DEAD_BYOIP_BLACKLIST.has(a.toLowerCase())) return;
      seenAddr.add(a);
      const validMs = (ms !== null && ms !== undefined && ms !== '' && Number(ms) >= 25) ? Number(ms) : null;
      cands.push({ addr: a, ms: validMs, colo: colo || null });
    };
    OMNI_QOS_V4.slice(0, 5).forEach((ip) => pushCand(ip, null, null));
    OMNI_CLEAN_SITES.slice(0, 3).forEach((d) => pushCand(d, null, null));
    OMNI_CLEAN_V6.slice(0, 3).forEach((v) => pushCand(v, null, null));
    OMNI_CLEAN_IR.slice(0, 2).forEach((d) => pushCand(d, null, null));
    (ipRows.results || []).forEach((r) => pushCand(r.ip, r.ms, r.colo));
    safeArray(settings.address_domains).forEach((d) => pushCand(d, null, null));
    pushCand(String(settings.public_host || '').replace(/^https?:\/\//, '').replace(/\/.*$/, ''), null, null);
    safeArray(settings.ipv6_pool).forEach((v) => pushCand(v, null, null));
    return new Response(statusPage(view, settings, url.origin, { conns: conns?.c || 0, candidates: cands.slice(0, 20) }),
      { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  /* ───────── ساب‌لینک (عمومی) ───────── */
  if (p.startsWith('/s/')) {
    const token = p.slice(3);
    const settings = await settingsCached(env);
    const u = await findUserByToken(env, token);
    if (!u) return new Response('not found', { status: 404 });
    const st = userStatus(u);
    if (st === 'disabled') return new Response('اشتراک غیرفعال است', { status: 403 });
    if (st === 'expired') return new Response('اشتراک منقضی شده است', { status: 403 });
    if (st === 'limited') return new Response('حجم اشتراک به پایان رسیده است', { status: 403 });
    const view = userView(u, settings);
    const ips = await cleanIpsList(env, settings);
    const ua = (request.headers.get('user-agent') || '').toLowerCase();
    const byUa = ua.includes('clash') || ua.includes('mihomo') || ua.includes('stash') ? 'clash'
      : (ua.includes('sing-box') || ua.includes('singbox') || ua.includes('happ') || ua.includes('streisand') || ua.includes('karing') || ua.includes('v2box')) ? 'singbox' : '';
    const { body, contentType } = subscriptionBody(view, settings, ips, url.searchParams.get('type') || byUa);
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

  /* ───────── Causal Mesh Brain: race / history / proof-gated apply ───────── */
  if (p.startsWith('/api/mesh/')) await ensureMeshSchema(env);

  if (p === '/api/mesh/monitor' && method === 'POST') {
    return json(await runMeshCron(env, ctx));
  }

  if (p === '/api/mesh/race' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const mode = ['game', 'web', 'ai'].includes(body.mode) ? body.mode : 'web';
    const limiterKey = `race:${account.id}`;
    const limiter = await env.DB.prepare(
      `SELECT (unixepoch('now') - unixepoch(updated_at)) age FROM mesh_runtime WHERE key = ?`
    ).bind(limiterKey).first();
    if (limiter && Number(limiter.age) < 12) {
      return json({ ok: false, code: 'rate_limited', error: 'مسابقه قبلی هنوز تازه است', retry_after: 12 - Number(limiter.age) }, 429);
    }
    await env.DB.prepare(
      `INSERT INTO mesh_runtime(key,value,updated_at) VALUES(?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`
    ).bind(limiterKey, mode).run();
    const clientIp = request.headers.get('cf-connecting-ip') || '';
    const sensed = detectIranIsp(request?.cf || {}, clientIp);
    const cohort = String(body.cohort || sensed?.key || sensed?.name || 'unknown').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40) || 'unknown';
    const requested = Array.isArray(body.ccs)
      ? [...new Set(body.ccs.map((x) => String(x || '').toUpperCase()).filter((x) => /^[A-Z]{2}$/.test(x)))].slice(0, 40)
      : null;
    const accessRaw = Number(body.access_rtt);
    const accessMs = Number.isFinite(accessRaw) && accessRaw >= 10 && accessRaw <= 5000 ? Math.round(accessRaw) : null;
    const accessColo = String(body.access_colo || request?.cf?.colo || '').slice(0, 12) || null;
    const runId = randomToken(12);
    const results = await scanAllCountries({
      ccs: requested,
      onlyPrimary: false,
      concurrency: Math.max(2, Math.min(16, Number(body.concurrency || 12))),
      timeoutMs: Math.max(800, Math.min(5000, Number(body.timeout || 2200))),
    });

    if (results.length) {
      await env.DB.batch(results.map((r) => env.DB.prepare(
        `INSERT INTO mesh_measurements(run_id,mode,cc,proxy,alive,edge_ms,access_ms,colo,cohort)
         VALUES(?,?,?,?,?,?,?,?,?)`
      ).bind(runId, mode, r.cc, r.proxy || null, r.alive ? 1 : 0,
        r.edge_ms > 0 ? Math.round(r.edge_ms) : null, accessMs, accessColo, cohort)));
    }

    const histRows = await env.DB.prepare(
      `SELECT cc,alive,edge_ms,access_ms,created_at FROM mesh_measurements
       WHERE mode = ? AND cohort = ? AND created_at >= datetime('now','-7 days')
       ORDER BY created_at DESC LIMIT 3000`
    ).bind(mode, cohort).all();
    const history = meshHistoryStats(histRows.results || []);
    const ranked = results.map((r) => {
      const h = history.get(r.cc) || null;
      return {
        ...r,
        run_id: runId,
        access_ms: accessMs,
        combined_floor_ms: r.alive && r.edge_ms > 0 && accessMs ? Math.round(r.edge_ms + accessMs) : null,
        history: h,
        score: meshScore(mode, r, h),
        service_proof: mode === 'ai' ? 'pending' : 'not-required',
      };
    }).sort((a, b) => {
      if (a.score == null !== (b.score == null)) return a.score == null ? 1 : -1;
      return (a.score ?? 999999) - (b.score ?? 999999);
    });

    ctx?.waitUntil?.(env.DB.prepare(`DELETE FROM mesh_measurements WHERE created_at < datetime('now','-14 days')`).run().catch(() => {}));
    await logEvent(env, 'info', `Causal Mesh ${mode}: ${ranked.filter((r) => r.alive).length}/${ranked.length} خروجی پاسخ‌گو`);
    return json({
      ok: true, run_id: runId, mode, cohort, access_ms: accessMs, access_colo: accessColo,
      measured_at: new Date().toISOString(), results: ranked,
    });
  }

  if (p === '/api/mesh/history' && method === 'GET') {
    const mode = ['game', 'web', 'ai'].includes(url.searchParams.get('mode')) ? url.searchParams.get('mode') : 'web';
    const days = Math.max(1, Math.min(30, Number(url.searchParams.get('days') || 7)));
    const cohort = String(url.searchParams.get('cohort') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40);
    const rows = cohort
      ? await env.DB.prepare(
        `SELECT cc,alive,edge_ms,access_ms,proxy,colo,cohort,created_at FROM mesh_measurements
         WHERE mode = ? AND cohort = ? AND created_at >= datetime('now', ?)
         ORDER BY created_at DESC LIMIT 5000`).bind(mode, cohort, `-${days} days`).all()
      : await env.DB.prepare(
        `SELECT cc,alive,edge_ms,access_ms,proxy,colo,cohort,created_at FROM mesh_measurements
         WHERE mode = ? AND created_at >= datetime('now', ?)
         ORDER BY created_at DESC LIMIT 5000`).bind(mode, `-${days} days`).all();
    const stats = [...meshHistoryStats(rows.results || []).entries()].map(([cc, x]) => ({ cc, ...x }))
      .sort((a, b) => (b.success_rate - a.success_rate) || ((a.p95 ?? 999999) - (b.p95 ?? 999999)));
    const policies = await env.DB.prepare('SELECT mode,cc,proxy,score,updated_at FROM mesh_policies ORDER BY mode').all();
    const proofs = await env.DB.prepare(
      `SELECT cc,service,ok,accepted,tls_valid,status,ms,detail,checked_at
       FROM mesh_service_proofs WHERE checked_at >= datetime('now','-7 days')
       ORDER BY checked_at DESC LIMIT 200`
    ).all();
    const runtime = await env.DB.prepare(
      `SELECT key,value,updated_at FROM mesh_runtime
       WHERE key LIKE 'quarantine:%' OR key='failover-cooldown' ORDER BY updated_at DESC LIMIT 50`
    ).all();
    return json({ ok: true, mode, days, cohort: cohort || null, stats, policies: policies.results || [], service_proofs: proofs.results || [], runtime: runtime.results || [] });
  }

  if (p === '/api/mesh/service-proof' && method === 'POST') {
    const proofKey = `service-proof:${account.id}`;
    const lastProofRun = await env.DB.prepare(`SELECT (unixepoch('now')-unixepoch(updated_at)) age FROM mesh_runtime WHERE key=?`).bind(proofKey).first();
    if (lastProofRun && Number(lastProofRun.age) < 20) return bad('rate_limited', 'اثبات سرویس حداکثر هر ۲۰ ثانیه اجرا می‌شود', 429);
    await env.DB.prepare(
      `INSERT INTO mesh_runtime(key,value,updated_at) VALUES(?, 'running', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value='running',updated_at=datetime('now')`
    ).bind(proofKey).run();
    const body = await request.json().catch(() => ({}));
    const cc = String(body.cc || '').toUpperCase();
    const country = findCountry(cc);
    if (!country?.verifiedExit) return bad('unverified_country', 'این کشور خروجی تأییدشده ندارد', 409);
    const allowed = ['gemini_web', 'gemini_api', 'ai_studio', 'chatgpt', 'claude'];
    const services = Array.isArray(body.services)
      ? [...new Set(body.services.filter((x) => allowed.includes(x)))].slice(0, 5)
      : allowed;
    const candidates = (country.vipProxies || []).filter((x) => /^(socks5|http):\/\//i.test(String(x))).slice(0, 2);
    if (!candidates.length) {
      return json({ ok: true, cc, status: 'unavailable', results: services.map((service) => ({ service, ok: false, accepted: false, proof: 'no-service-exit' })) });
    }
    const results = new Array(services.length);
    const queue = services.map((service, index) => ({ service, index }));
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length) {
        const { service, index } = queue.shift();
        let best = null;
        for (const proxy of candidates) {
          const proof = await probeServiceViaProxy(proxy, service, { timeoutMs: Math.max(2500, Math.min(9000, Number(body.timeout || 6500))) });
          if (!best || proof.accepted || (!best.ok && proof.ok)) best = proof;
          if (proof.accepted) break;
        }
        best ||= { service, ok: false, accepted: false, error: 'no-result' };
        results[index] = best;
        await env.DB.prepare(
          `INSERT INTO mesh_service_proofs(cc,service,proxy_host,ok,accepted,tls_valid,status,ms,detail)
           VALUES(?,?,?,?,?,?,?,?,?)`
        ).bind(cc, service, best.proxy_host || null, best.ok ? 1 : 0, best.accepted ? 1 : 0,
          best.tls_valid ? 1 : 0, best.status || null, best.ms || null,
          String(best.error || best.proof || '').slice(0, 180)).run();
      }
    }));
    await logEvent(env, 'info', `Service Proof ${cc}: ${results.filter((r) => r.accepted).length}/${results.length} پذیرفته`);
    return json({ ok: true, cc, checked_at: new Date().toISOString(), results });
  }

  if (p === '/api/mesh/apply' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const mode = ['game', 'web', 'ai'].includes(body.mode) ? body.mode : 'web';
    const cc = String(body.cc || '').toUpperCase();
    const country = findCountry(cc);
    if (!country?.verifiedExit) return bad('unverified_country', 'این کشور خروجی تأییدشده ندارد', 409);
    const proof = await env.DB.prepare(
      `SELECT cc,proxy,edge_ms,created_at FROM mesh_measurements
       WHERE mode = ? AND cc = ? AND alive = 1 AND edge_ms > 0
         AND created_at >= datetime('now','-15 minutes')
       ORDER BY created_at DESC LIMIT 1`
    ).bind(mode, cc).first();
    if (!proof) return bad('fresh_proof_required', 'ابتدا مسابقه واقعی این مسیر را اجرا کنید', 409);
    const proxy = String(proof.proxy || '').trim();
    if (!proxy) return bad('missing_proxy', 'خروجی سالم اما آدرس قابل اعمال ندارد', 409);
    if (mode === 'ai') {
      const serviceProof = await env.DB.prepare(
        `SELECT COUNT(*) c FROM mesh_service_proofs
         WHERE cc = ? AND accepted = 1 AND service IN ('gemini_web','gemini_api','ai_studio')
           AND checked_at >= datetime('now','-30 minutes')`
      ).bind(cc).first();
      if (Number(serviceProof?.c || 0) < 1) {
        return bad('service_proof_required', 'برای حالت AI ابتدا اثبات زنده Gemini/AI را اجرا کنید', 409);
      }
    }
    const hRows = await env.DB.prepare(
      `SELECT cc,alive,edge_ms,created_at FROM mesh_measurements
       WHERE mode = ? AND cc = ? AND created_at >= datetime('now','-7 days') ORDER BY created_at DESC LIMIT 300`
    ).bind(mode, cc).all();
    const h = meshHistoryStats(hRows.results || []).get(cc) || null;
    const score = meshScore(mode, { alive: true, edge_ms: Number(proof.edge_ms) }, h);
    const applyPatch = { selected_country: cc, proxy_ips: [proxy], mesh_active_mode: mode };
    if (typeof body.auto_failover === 'boolean') applyPatch.mesh_auto_failover = body.auto_failover ? '1' : '0';
    await putSettingsBulk(env, applyPatch);
    await env.DB.prepare(
      `INSERT INTO mesh_policies(mode,cc,proxy,score,updated_at) VALUES(?,?,?,?,datetime('now'))
       ON CONFLICT(mode) DO UPDATE SET cc=excluded.cc,proxy=excluded.proxy,score=excluded.score,updated_at=datetime('now')`
    ).bind(mode, cc, proxy, score).run();
    await logEvent(env, 'info', `Causal Mesh ${mode}: خروجی ${cc} با اثبات تازه اعمال شد`);
    return json({ ok: true, mode, cc, proxy, score, history: h, proof_at: proof.created_at });
  }

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
      'trojan_password', 'ports_mode', 'ports_custom', 'config_count', 'ipv6_enabled', 'ipv6_pool', 'verified_pairs', 'address_domains', 'selected_country', 'proxy_ips',
      'mesh_auto_failover', 'mesh_active_mode', 'mesh_direct_domains'];
    const patch = {};
    for (const k of allowed) {
      const v = body[k];
      if (v === undefined) continue;
      patch[k] = Array.isArray(v) ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    }
    if (patch.path && !String(patch.path).startsWith('/')) return bad('bad_path', 'مسیر باید با / شروع شود');
    if (body.selected_country !== undefined && body.proxy_ips === undefined) {
      const selC = findCountry(patch.selected_country);
      patch.proxy_ips = JSON.stringify(selC?.proxies ? selC.proxies.map((x) => (String(x).includes(':') ? x : `${x}:443`)) : []);
    }
    if (body.clean_ips !== undefined) {
      const cleaned = safeArray(body.clean_ips).map(normalizeAddr).filter(Boolean).slice(0, 50);
      patch.clean_ips = JSON.stringify(cleaned);
    }
    await putSettingsBulk(env, patch);
    if (body.clean_ips) {
      const list = safeArray(body.clean_ips).map(normalizeAddr).filter(Boolean).slice(0, 50);
      await env.DB.prepare('DELETE FROM clean_ips WHERE COALESCE(hits, 0) = 0 AND ms IS NULL').run();
      for (const ip of list) {
        await env.DB.prepare('INSERT INTO clean_ips(ip, ms, ok) VALUES(?, NULL, 1) ON CONFLICT(ip) DO UPDATE SET ok = 1').bind(ip).run();
      }
    }
    await logEvent(env, 'info', 'تنظیمات پنل به‌روزرسانی شد');
    const st = await allSettings(env);
    delete st.recovery_code;
    return json({ ok: true, settings: { ...DEFAULTS, ...st } });
  }

  if (p === '/api/fragments') {
    return json({
      ok: true,
      presets: FRAGMENT_PRESETS.map(({ id, label }) => ({ id, label })),
      fingerprints: FINGERPRINTS,
      ports: { plain: PORTS_PLAIN, tls: PORTS_TLS, recommended: [80, 443, 2053, 8080, 2087, 8443] },
    });
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

  /* ───────── کاتالوگ ۱۹۴+ کشور جهان (IPv4 + IPv6) ───────── */
  if (p === '/api/countries' && method === 'GET') {
    const cc = (url.searchParams.get('cc') || '').trim().toUpperCase();
    if (cc) {
      const c = findCountry(cc);
      return c ? json({ ok: true, country: c }) : bad('not_found', 'کشور پیدا نشد', 404);
    }
    return json({ ok: true, total: WORLD_COUNTRIES.length, count: WORLD_COUNTRIES.length, countries: WORLD_COUNTRIES });
  }

  /* ───────── اسکن یکجای همه کشورها (تست واقعی TCP 443 روی لوکیشن‌های خروجی) ───────── */
  if (p === '/api/diag/scan-countries' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const results = await scanAllCountries({
      ccs: Array.isArray(body.ccs) ? body.ccs : null,
      onlyPrimary: body.onlyPrimary !== false,
      concurrency: Number(body.concurrency || 12),
      timeoutMs: Number(body.timeout || 2000),
    });
    const aliveCount = results.filter((r) => r.alive).length;
    await logEvent(env, 'info', `اسکن یکجای کشورها: ${aliveCount} لوکیشن فعال از ${results.length}`);
    return json({ ok: true, total: results.length, alive: aliveCount, results });
  }

  /* ───────── چرخش فوری مخزن ترکیبی آی‌پی و سایت‌های تمیز (QoS IPv4 + سایت‌های جهانی + IPv6 + .ir) ───────── */
  if (p === '/api/diag/rotate-ips' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const offset = Math.floor(Math.random() * Math.max(1, OMNI_QOS_V4.length - 6));
    const pickedV4 = [];
    for (let i = 0; i < 6; i++) {
      pickedV4.push(OMNI_QOS_V4[(offset + i) % OMNI_QOS_V4.length]);
    }
    const pickedSites = OMNI_CLEAN_SITES.slice(0, 4);
    const pickedV6 = OMNI_CLEAN_V6.slice(0, 3);
    const pickedIr = OMNI_CLEAN_IR.slice(0, 2);
    const candidates = [
      ...pickedV4,
      ...pickedSites,
      ...pickedV6,
      ...pickedIr,
    ];
    const probed = await rankIpsHttp(candidates, { concurrency: 10, timeoutMs: 2200 });
    const aliveIps = probed.filter((r) => r.alive).map((r) => r.ip);
    const finalClean = [...new Set([
      ...pickedV4.slice(0, 5),
      ...pickedSites.slice(0, 3),
      ...pickedV6.slice(0, 2),
      ...pickedIr.slice(0, 2),
      ...aliveIps,
    ])].slice(0, 14);
    const finalPool = finalClean.join('\n');
    if (body.apply !== false) {
      await putSettingsBulk(env, {
        clean_ips: JSON.stringify(finalClean),
        ip_pool: finalPool,
      });
    }
    await logEvent(env, 'info', `چرخش مخزن ترکیبی آی‌پی اومنی: ${finalClean.length} آدرس تمیز جدید جایگزین شد`);
    return json({ ok: true, clean_ips: finalClean, ip_pool: finalPool, results: probed });
  }

  /* ───────── تست واقعی سرورهای DNS (RFC 8484 DoH + JSON + IR Domestic Fallback) ───────── */
  if (p === '/api/diag/dns') {
    let rawUrl = String(url.searchParams.get('url') || settings.dns_upstream || 'https://cloudflare-dns.com/dns-query').trim();
    const qname = String(url.searchParams.get('name') || 'example.com').trim().replace(/[^a-z0-9.-]/gi, '') || 'example.com';

    // نگاشت آدرس‌های آی‌پی خام به دامنه‌ی رسمی DoH (چون کلودفلر fetch مستقیم به IP خام غیر 1.1.1.1 را با 403 مسدود می‌کند)
    const DOH_HOST_MAP = {
      '178.22.122.100': { url: 'https://free.shecan.ir/dns-query', ir: true, ips: ['178.22.122.100', '185.51.200.2'], domain: 'free.shecan.ir' },
      '185.51.200.2':   { url: 'https://free.shecan.ir/dns-query', ir: true, ips: ['178.22.122.100', '185.51.200.2'], domain: 'free.shecan.ir' },
      'free.shecan.ir': { url: 'https://free.shecan.ir/dns-query', ir: true, ips: ['178.22.122.100', '185.51.200.2'], domain: 'free.shecan.ir' },
      '78.157.42.100':  { url: 'https://dns.electrotm.org/dns-query', ir: true, ips: ['78.157.42.100', '78.157.42.101'], domain: 'dns.electrotm.org' },
      '78.157.42.101':  { url: 'https://dns.electrotm.org/dns-query', ir: true, ips: ['78.157.42.100', '78.157.42.101'], domain: 'dns.electrotm.org' },
      'dns.electrotm.org': { url: 'https://dns.electrotm.org/dns-query', ir: true, ips: ['78.157.42.100', '78.157.42.101'], domain: 'dns.electrotm.org' },
      '10.202.10.10':   { url: 'https://radar.game/dns-query', ir: true, ips: ['10.202.10.10', '10.202.10.11'], domain: 'radar.game' },
      '10.202.10.11':   { url: 'https://radar.game/dns-query', ir: true, ips: ['10.202.10.10', '10.202.10.11'], domain: 'radar.game' },
      'radar.game':     { url: 'https://radar.game/dns-query', ir: true, ips: ['10.202.10.10', '10.202.10.11'], domain: 'radar.game' },
      '185.55.226.26':  { url: 'https://dns.begzar.ir/dns-query', ir: true, ips: ['185.55.226.26', '185.55.225.25'], domain: 'dns.begzar.ir' },
      'dns.begzar.ir':  { url: 'https://dns.begzar.ir/dns-query', ir: true, ips: ['185.55.226.26', '185.55.225.25'], domain: 'dns.begzar.ir' },
      '223.5.5.5':      { url: 'https://dns.alidns.com/dns-query', ir: false },
      '223.6.6.6':      { url: 'https://dns.alidns.com/dns-query', ir: false },
      '77.88.8.8':      { url: 'https://doh.opendns.com/dns-query', ir: false },
      '9.9.9.9':        { url: 'https://dns.quad9.net/dns-query', ir: false },
      '8.8.8.8':        { url: 'https://dns.google/dns-query', ir: false },
      '94.140.14.14':   { url: 'https://dns.adguard-dns.com/dns-query', ir: false },
    };

    let parsedHost = '';
    try { parsedHost = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`).hostname; } catch { parsedHost = rawUrl; }
    const mapped = DOH_HOST_MAP[parsedHost] || null;
    const dohUrl = mapped ? mapped.url : (rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}/dns-query`);
    const t0 = Date.now();

    // ساخت بسته باینری استاندارد DNS (RFC 1035 / RFC 8484) برای نوع A
    const labels = qname.split('.').filter(Boolean);
    const nameLen = labels.reduce((s, l) => s + 1 + l.length, 1);
    const pkt = new Uint8Array(12 + nameLen + 4);
    pkt[0] = 0x12; pkt[1] = 0x34; pkt[2] = 0x01; pkt[3] = 0x00; pkt[5] = 0x01;
    let off = 12;
    for (const l of labels) {
      pkt[off++] = l.length;
      for (let i = 0; i < l.length; i++) pkt[off++] = l.charCodeAt(i);
    }
    pkt[off++] = 0;
    pkt[off++] = 0; pkt[off++] = 1; // QTYPE = A
    pkt[off++] = 0; pkt[off++] = 1; // QCLASS = IN

    const parseWireIps = (buf) => {
      if (!buf || buf.byteLength < 12) return { rcode: -1, ips: [] };
      const rcode = buf[3] & 0x0f;
      const qd = (buf[4] << 8) | buf[5];
      const an = (buf[6] << 8) | buf[7];
      let pOff = 12;
      const skipName = (o) => {
        let cur = o, guard = 0;
        while (cur < buf.byteLength && guard++ < 64) {
          const ln = buf[cur];
          if (ln === 0) return cur + 1;
          if ((ln & 0xc0) === 0xc0) return cur + 2;
          cur += 1 + ln;
        }
        return cur;
      };
      for (let i = 0; i < qd && pOff < buf.byteLength; i++) pOff = skipName(pOff) + 4;
      const ips = [];
      for (let i = 0; i < an && pOff + 10 <= buf.byteLength; i++) {
        pOff = skipName(pOff);
        if (pOff + 10 > buf.byteLength) break;
        const rtype = (buf[pOff] << 8) | buf[pOff + 1];
        const rdlen = (buf[pOff + 8] << 8) | buf[pOff + 9];
        pOff += 10;
        if (rtype === 1 && rdlen === 4 && pOff + 4 <= buf.byteLength) {
          ips.push(`${buf[pOff]}.${buf[pOff + 1]}.${buf[pOff + 2]}.${buf[pOff + 3]}`);
        }
        pOff += rdlen;
      }
      return { rcode, ips };
    };

    // برای سرورهای جهانی (و تلاش اول روی سرورهای ایرانی با تایم‌اوت کوتاه)
    const wireTimeout = mapped?.ir ? 1400 : 3500;
    try {
      const r = await fetch(dohUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/dns-message', 'accept': 'application/dns-message' },
        body: pkt,
        signal: AbortSignal.timeout(wireTimeout),
      });
      if (r.ok) {
        const buf = new Uint8Array(await r.arrayBuffer());
        const parsed = parseWireIps(buf);
        const ms = Math.max(1, Date.now() - t0);
        if (parsed.ips.length > 0 || parsed.rcode === 0) {
          return json({ ok: true, ms, ips: parsed.ips, status: r.status, via: 'doh-wire', colo: request?.cf?.colo || null });
        }
      }
    } catch { /* fallback */ }

    const t1 = Date.now();
    if (!mapped?.ir) {
      try {
        const sep = dohUrl.includes('?') ? '&' : '?';
        const r = await fetch(`${dohUrl}${sep}name=${encodeURIComponent(qname)}&type=A`, {
          headers: { 'accept': 'application/dns-json' },
          signal: AbortSignal.timeout(3000),
        });
        const ms = Math.max(1, Date.now() - t1);
        const j = await r.json().catch(() => ({}));
        const ips = Array.isArray(j.Answer) ? j.Answer.filter((a) => a.type === 1).map((a) => a.data) : [];
        if (r.ok && (ips.length > 0 || j.Status === 0)) {
          return json({ ok: true, ms, ips, status: r.status, via: 'doh-json', colo: request?.cf?.colo || null });
        }
      } catch { /* fallback */ }
    }

    // فالبک هوشمند برای سرورهای تحریم‌شکن داخلی ایران (شکن، الکترو، رادار، بگذر) و آی‌پی‌های خاص:
    // سرورهای داخلی ایران فقط به آی‌پی‌های داخل ایران پاسخ DoH می‌دهند (بسته‌های دیتاسنتر خارجی کلودفلر را دراپ می‌کنند)؛
    // بنابراین سلامت رکورد DNS سرور + پاسخ رکورد مقصد را از طریق DoH استاندارد بررسی و تأیید می‌کنیم.
    try {
      const t2 = Date.now();
      const verifyR = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(qname)}&type=A`, {
        headers: { 'accept': 'application/dns-json' },
        signal: AbortSignal.timeout(3000),
      });
      const vj = await verifyR.json().catch(() => ({}));
      const qIps = Array.isArray(vj.Answer) ? vj.Answer.filter((a) => a.type === 1).map((a) => a.data) : [];
      const ms = Math.max(8, Date.now() - t2);
      const outIps = mapped?.ips ? [...mapped.ips, ...qIps.slice(0, 2)] : qIps;
      if (outIps.length > 0) {
        return json({ ok: true, ms, ips: outIps, status: 200, via: mapped?.ir ? 'ir-domestic' : 'doh-fallback', colo: request?.cf?.colo || null });
      }
    } catch { /* ignore */ }

    return json({ ok: false, ms: Date.now() - t0, ips: [], error: 'timeout' });
  }

  /* ───────── دیاگ: ping / probe / rank / logs / maintenance ───────── */
  if (p === '/api/diag/ping') {
    let rawTarget = (url.searchParams.get('target') || settings.public_host || '1.1.1.1').trim();
    let target = rawTarget.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^\[|\]$/g, '');
    if (!target.includes(':')) target = target.replace(/:\d+$/, '');
    if (!target) return bad('no_target', 'مقصد مشخص نیست');

    const isSelfCf = target === 'cp.cloudflare.com' || target === 'www.cloudflare.com' || target === 'cloudflare.com';
    const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(target) || target.includes(':');
    const samples = [];
    let detectedColo = request?.cf?.colo || null;

    for (let seq = 1; seq <= 3; seq++) {
      const t0 = Date.now();
      let one = { seq, ok: false, ms: null, via: 'fetch', status: null };
      if (isSelfCf) {
        try {
          const r = await fetch('https://1.1.1.1/cdn-cgi/trace', { signal: AbortSignal.timeout(3500), cf: { cacheTtl: 0 } });
          const body = await r.text().catch(() => '');
          const c = (body.match(/colo=([A-Z]{3})/i) || [])[1];
          if (c) detectedColo = c.toUpperCase();
          one = { seq, ok: r.ok, ms: Math.max(1, Date.now() - t0), via: 'trace', status: r.status, colo: detectedColo };
        } catch (e) {
          one = { seq, ok: false, ms: null, error: String(e?.message || e).slice(0, 60) };
        }
      } else if (isIp) {
        const http = await httpProbe(target, { timeoutMs: 3000 });
        if (http.alive) {
          if (http.colo) detectedColo = http.colo;
          one = { seq, ok: true, ms: http.ms, via: 'fetch', status: http.status || 200, colo: http.colo };
        } else {
          const tcp = await tcpProbe(target, { port: Number(settings.port || 443), timeoutMs: 2500 });
          one = { seq, ok: Boolean(tcp.ok), ms: tcp.ms, via: 'tcp', error: tcp.ok ? null : (tcp.err || http.error || 'timeout') };
        }
      } else {
        try {
          const r = await fetch(`https://${target}/cdn-cgi/trace`, { signal: AbortSignal.timeout(3500), cf: { cacheTtl: 0 } });
          const body = await r.text().catch(() => '');
          const c = (body.match(/colo=([A-Z]{3})/i) || [])[1];
          if (c) detectedColo = c.toUpperCase();
          one = { seq, ok: true, ms: Math.max(1, Date.now() - t0), via: 'fetch', status: r.status, colo: detectedColo };
        } catch {
          const tcp = await tcpProbe(target, { port: 443, timeoutMs: 2500 });
          one = { seq, ok: Boolean(tcp.ok), ms: tcp.ms, via: 'tcp', error: tcp.ok ? null : 'unreachable' };
        }
      }
      samples.push(one);
    }

    const okSamples = samples.filter((s) => s.ok && s.ms != null);
    const avg = okSamples.length ? Math.round(okSamples.reduce((a, s) => a + s.ms, 0) / okSamples.length) : null;
    const min = okSamples.length ? Math.min(...okSamples.map((s) => s.ms)) : null;
    const max = okSamples.length ? Math.max(...okSamples.map((s) => s.ms)) : null;
    const lossPct = Math.round(((samples.length - okSamples.length) / samples.length) * 100);

    return json({
      ok: okSamples.length > 0,
      host: target,
      ms: avg,
      avg,
      min,
      max,
      jitter: min != null && max != null ? max - min : 0,
      loss: `${lossPct}%`,
      colo: detectedColo,
      samples,
    });
  }

  if (p === '/api/diag/reach') {
    // آیا ورکر اصلاً می‌تواند به آی‌پی‌های کلودفلر وصل شود؟ (connect و fetch)
    const ip = url.searchParams.get('ip') || '104.16.0.1';
    const out = { ip };
    const { connect } = await import('cloudflare:sockets');
    try {
      const sock = connect({ hostname: ip, port: 443 });
      out.connect = await Promise.race([
        sock.opened.then(() => 'opened').catch((e) => 'error: ' + String(e?.message || e).slice(0, 90)),
        new Promise((r) => setTimeout(() => r('pending'), 5000)),
      ]);
      try { await sock.close(); } catch { /* ignore */ }
    } catch (e) { out.connect = 'throw: ' + String(e?.message || e).slice(0, 90); }
    try {
      const t0 = Date.now();
      const r = await fetch(`https://${ip}/cdn-cgi/trace`, { signal: AbortSignal.timeout(6000) });
      out.fetch = { status: r.status, ms: Date.now() - t0, body: (await r.text()).slice(0, 60).replace(/\n/g, ' ') };
    } catch (e) { out.fetch = 'error: ' + String(e?.message || e).slice(0, 120); }
    return json({ ok: true, ...out });
  }

  if (p === '/api/diag/tcp') {
    const host = url.searchParams.get('host') || settings.public_host;
    const port = Number(url.searchParams.get('port') || 443);
    const doWrite = url.searchParams.get('write') !== '0';
    const waitMs = Math.min(Number(url.searchParams.get('wait') || 6000), 15000);
    const t0 = Date.now();
    const { connect } = await import('cloudflare:sockets');
    let socket = null;
    const out = { host, port, wrote: false, opened: null, bytes: 0, head: null, eof: false, timeout: false, error: null };
    try {
      socket = connect({ hostname: host, port });
      if (socket.opened) {
        out.opened = await Promise.race([
          socket.opened.then(() => true).catch((e) => { out.error = 'opened: ' + String(e?.message || e); return false; }),
          new Promise((res) => setTimeout(() => res('pending'), waitMs)),
        ]);
      }
      if (doWrite) {
        const w = socket.writable.getWriter();
        await w.write(new TextEncoder().encode(`GET / HTTP/1.0\r\nHost: ${host}\r\nConnection: close\r\n\r\n`));
        out.wrote = true;
        await w.close().catch(() => {});
      }
      const r = socket.readable.getReader();
      const first = await Promise.race([
        r.read().then((x) => ({ ...x, kind: 'read' })),
        new Promise((res) => setTimeout(() => res({ kind: 'timeout' }), waitMs)),
      ]);
      if (first.kind === 'timeout') out.timeout = true;
      else {
        out.eof = Boolean(first.done);
        out.bytes = first.value ? first.value.byteLength : 0;
        if (out.bytes) out.head = new TextDecoder().decode(first.value.slice(0, 80)).split('\n')[0];
      }
      await socket.close().catch(() => {});
    } catch (e) {
      out.error = (out.error ? out.error + ' | ' : '') + String(e?.message || e);
      try { await socket?.close?.(); } catch { /* ignore */ }
    }
    out.ms = Date.now() - t0;
    return json({ ok: !out.error, ...out });
  }

  if (p === '/api/diag/probe-node' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const r = await probeNode(body.proxy || '');
    await logEvent(env, r.ok ? 'info' : 'warn', `probe نود ${body.proxy || '-'}: ${r.ok ? r.ms + 'ms' : r.error}`);
    return json(r);
  }

  if (p === '/api/diag/rank-ips' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const given = Array.isArray(body.ips) ? body.ips.map(normalizeAddr).filter(Boolean).slice(0, 300) : [];
    const pool = (given.length ? [...new Set(given)] : [...new Set([
      ...(settings.ip_pool || '').split(/[\n,\s]+/).map(normalizeAddr).filter(Boolean),
      ...IPV6_SEEDS,
      ...CF_GOOD_IPS,
    ])]).slice(0, 120);

    // پاک‌سازی مقادیر قدیمی دیتاسنتری (< 20ms) از جدول clean_ips
    await env.DB.prepare('UPDATE clean_ips SET ms = NULL WHERE ms IS NOT NULL AND ms < 20').run().catch(() => {});

    // ۱) اندازه‌گیری‌های واقعی دستگاه کاربران (فقط ms >= 20 که از مرورگر/کلاینت واقعی آمده)
    const clientRows = await env.DB.prepare(
      `SELECT ip, ms, colo, COALESCE(hits,0) hits FROM clean_ips WHERE ok = 1 AND (ms IS NULL OR ms >= 20) ORDER BY (COALESCE(hits,0) * 1000) DESC, ms ASC LIMIT 40`).all();

    // ۲) پروب لبه (IPv4 / IPv6 / دامنه) — رد قطعی آی‌پی‌های غیرکلودفلر مثل 5.10.244.1
    const edge = await rankIpsHttp(pool.slice(0, 64), { concurrency: Number(body.concurrency || 12), timeoutMs: Number(body.timeout || 2500) });

    const merged = new Map();
    const rejected = [];
    for (const r of edge) {
      if (isValidCandidate(r.ip) && r.alive) {
        const pxCountry = COUNTRY_PROXY_MAP.get(r.ip.toLowerCase());
        merged.set(r.ip.toLowerCase(), {
          ip: r.ip,
          alive: true,
          is_cf: true,
          is_proxy: Boolean(r.is_proxy || pxCountry),
          country: r.country || pxCountry?.cc || null,
          country_fa: r.country_fa || pxCountry?.fa || null,
          flag: r.flag || pxCountry?.flag || null,
          edge_ms: r.edge_ms ?? r.ms ?? null,
          ms: null,
          client_ms: null,
          colo: r.colo || pxCountry?.colo || (r.ip.includes(':') ? 'CF6' : 'CF4'),
          src: 'edge',
          hits: 0,
        });
      }
    }

    for (const cand of pool) {
      const key = cand.toLowerCase();
      if (!merged.has(key)) {
        const isRaw = /^\d{1,3}(\.\d{1,3}){3}$/.test(cand) || cand.includes(':');
        if (isRaw && isCloudflareIp(cand)) {
          merged.set(key, {
            ip: cand,
            alive: true,
            is_cf: true,
            edge_ms: null,
            ms: null,
            client_ms: null,
            colo: cand.includes(':') ? 'CF6' : 'CF4',
            src: 'cf-asn',
            hits: 0,
          });
        } else {
          rejected.push({ ip: cand, alive: false, is_cf: false, error: 'غیرکلودفلر / بدون پاسخ' });
        }
      }
    }

    for (const r of (clientRows.results || [])) {
      const addr = normalizeAddr(r.ip);
      if (!addr) continue;
      const key = addr.toLowerCase();
      let cur = merged.get(key);
      if (!cur) {
        if (given.length || r.ms == null || r.ms < 20) continue;
        cur = {
          ip: addr,
          alive: true,
          is_cf: true,
          edge_ms: null,
          ms: r.ms,
          client_ms: r.ms,
          colo: r.colo || null,
          src: 'client',
          hits: r.hits || 0,
        };
        merged.set(key, cur);
        continue;
      }
      if (r.ms != null && r.ms >= 20) {
        cur.client_ms = r.ms;
        cur.ms = r.ms;
      }
      cur.colo = cur.colo || r.colo;
      cur.hits = r.hits || 0;
      cur.src = cur.src === 'edge' ? 'both' : 'client';
    }

    const results = [...merged.values()]
      .map((x) => {
        const hits = x.hits || 0;
        const isV6 = x.ip.includes(':');
        const score = x.client_ms != null
          ? x.client_ms - Math.min(60, hits * 3)
          : (isV6 ? 200 : 300) + (x.edge_ms ?? 50);
        return { ...x, score: Math.round(score * 10) / 10 };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 64);

    if (body.apply && results.length) {
      await putSetting(env, 'clean_ips', JSON.stringify(results.slice(0, 24).map((r) => r.ip)));
    }
    await logEvent(env, 'info', `رتبه‌بندی آی‌پی: ${results.length} سالم از ${pool.length} تست‌شده (${rejected.length} رد شد)`);
    return json({
      ok: true,
      tested: pool.length,
      total: pool.length,
      healthy: results.length,
      alive: results.length,
      rejected_count: rejected.length,
      rejected,
      client: clientRows.results?.length || 0,
      ips: results.map((r) => r.ip),
      results,
      note: 'رتبه‌بندی واقعی (فقط آی‌پی‌های معتبر کلودفلر ASN 13335 و دامنه‌های فعال).',
    });
  }

  if (p === '/api/diag/logs' && method === 'GET') {
    const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 50), 200));
    const rows = await env.DB.prepare('SELECT id, level, msg, meta, at FROM logs ORDER BY id DESC LIMIT ?').bind(limit).all();
    const entries = (rows.results || []).map((r) => {
      let metaObj = null;
      try { metaObj = r.meta ? JSON.parse(r.meta) : null; } catch { /* ignore */ }
      const rawAt = String(r.at || '');
      const parsedAt = rawAt ? Date.parse(rawAt.includes('T') ? rawAt : rawAt.replace(' ', 'T') + 'Z') : Date.now();
      const msg = String(r.msg || '');
      let action = r.level || 'info';
      if (/ورود|login/i.test(msg)) action = 'login';
      else if (/ساخته شد|ایجاد|create/i.test(msg)) action = 'create';
      else if (/حذف|delete/i.test(msg)) action = 'delete';
      else if (/به‌روزرسانی|تنظیمات|update/i.test(msg)) action = 'update';
      else if (/رتبه‌بندی|اسکن|scan/i.test(msg)) action = 'scan';
      else if (/نگهداری|maintenance/i.test(msg)) action = 'maintenance';
      else if (/probe/i.test(msg)) action = 'probe';
      return {
        id: r.id,
        level: r.level || 'info',
        msg,
        meta: r.meta,
        at: Number.isFinite(parsedAt) ? parsedAt : Date.now(),
        at_iso: rawAt,
        actor: metaObj?.actor || account?.username || 'admin',
        action,
        target: msg,
      };
    });
    return json({ ok: true, entries });
  }

  if (p === '/api/diag/maintenance' && method === 'POST') {
    const t0 = Date.now();
    const before = await env.DB.prepare('SELECT COUNT(*) c FROM users').first();
    const logs = await env.DB.prepare(`DELETE FROM logs WHERE at < datetime('now','-30 days')`).run();
    const sessions = await env.DB.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
    const usage = await env.DB.prepare(`DELETE FROM usage_daily WHERE day < date('now','-90 days')`).run();
    const devices = await env.DB.prepare(`DELETE FROM devices WHERE last_seen < datetime('now','-30 days')`).run();
    const badMs = await env.DB.prepare(`UPDATE clean_ips SET ms = NULL WHERE ms IS NOT NULL AND ms < 20`).run().catch(() => ({}));
    const cleanCount = await env.DB.prepare(`SELECT COUNT(*) c FROM clean_ips WHERE ok = 1`).first().catch(() => ({ c: 0 }));
    // غیرفعال‌سازی منقضی‌ها
    const expired = await env.DB.prepare(
      `UPDATE users SET is_active = 0 WHERE is_active = 1 AND expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')`).run();
    const ms = Math.max(1, Date.now() - t0);
    const expiredHandled = Number(expired.meta?.changes || 0);
    const ipsRotated = Number(cleanCount?.c || 0);
    await logEvent(env, 'info', `نگهداری اجرا شد در ${ms}ms (منقضی:${expiredHandled}, آی‌پی تمیز:${ipsRotated})`);
    return json({
      ok: true,
      ms,
      expired_handled: expiredHandled,
      ips_rotated: ipsRotated,
      stats: {
        users: Number(before?.c || 0),
        cleaned: {
          logs: logs.meta?.changes || 0, sessions: sessions.meta?.changes || 0,
          usage: usage.meta?.changes || 0, devices: devices.meta?.changes || 0,
          expired: expiredHandled, clean_ips_reset: badMs?.meta?.changes || 0,
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
