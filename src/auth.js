/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/auth.js
   احراز هویت پنل (PBKDF2-SHA256)، نشست‌های D1، کد بازیابی
   ══════════════════════════════════════════════════════════════════════════ */

import { CF_GOOD_IPS } from './scan.js';

const enc = new TextEncoder();
const SESSION_COOKIE = 'omni_sid';
const CSRF_HEADER = 'x-kaveh-csrf';

/* ─────────── رمز عبور ─────────── */
/* نکته: Cloudflare Workers سقف ۱۰۰٬۰۰۰ تکرار برای PBKDF2 دارد
   («iteration counts above 100000 are not supported»). */
export const PBKDF2_ITER = 100000;
export const PBKDF2_ITER_LEGACY = [100000, 50000, 12000];

async function pbkdf2Hex(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

export async function hashPassword(password, saltHex = null) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  let hash = '';
  try {
    hash = await pbkdf2Hex(password, salt, PBKDF2_ITER);
  } catch (e) {
    // اگر روزی سقف تکرار تغییر کرد، به عدد مجاز نزدیک‌تر برو
    const m = String(e?.message || '').match(/(\d{4,})/);
    const allowed = m ? Math.min(PBKDF2_ITER, Number(m[1]) - 1 || 50000) : 50000;
    hash = await pbkdf2Hex(password, salt, Math.max(1000, allowed));
  }
  return { hash, salt: bytesToHex(salt) };
}

export async function verifyPassword(password, hashHex, saltHex) {
  if (!hashHex || !saltHex) return false;
  const salt = hexToBytes(saltHex);
  let hash = '';
  try { hash = await pbkdf2Hex(password, salt, PBKDF2_ITER); } catch { hash = ''; }
  if (hash && timingSafeEqualHex(hash, hashHex)) return true;
  // سازگاری با هش‌های قدیمی‌تر (تکرار کمتر)
  for (const it of PBKDF2_ITER_LEGACY) {
    if (it === PBKDF2_ITER) continue;
    try {
      const h2 = await pbkdf2Hex(password, salt, it);
      if (timingSafeEqualHex(h2, hashHex)) return true;
    } catch { /* ignore */ }
  }
  return false;
}

function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const bytesToHex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
export const hexToBytes = (h) => {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
};

/* ─────────── توکن‌های تصادفی ─────────── */
export function randomToken(bytes = 24) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(b);
}
export function base64url(bytes) {
  let s = '';
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function randomUuid() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/* ─────────── نشست‌ها ─────────── */
export function sessionCookie(id, days = 14) {
  return `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${days * 86400}`;
}
export async function createSession(env, request, account) {
  const id = randomToken(32);
  const ua = (request.headers.get('user-agent') || '').slice(0, 200);
  const ip = request.headers.get('cf-connecting-ip') || '';
  const days = 14;
  const expires = new Date(Date.now() + days * 864e5).toISOString().slice(0, 19).replace('T', ' ');
  await env.DB.prepare(
    `INSERT INTO sessions(id,account_id,ua,ip,expires_at,last_seen) VALUES(?,?,?,?,?,datetime('now'))`
  ).bind(id, account.id, ua, ip, expires).run();
  return { id, cookie: sessionCookie(id, days) };
}

export const clearCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function sessionIdFrom(request) {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}

export async function currentAccount(env, request) {
  const sid = sessionIdFrom(request);
  if (!sid) return null;
  const row = await env.DB.prepare(
    `SELECT s.id AS sid, s.expires_at, a.id, a.username, a.role, a.pass_hash, a.pass_salt
     FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.id = ?`
  ).bind(sid).first();
  if (!row) return null;
  if (new Date(String(row.expires_at).replace(' ', 'T') + 'Z') < new Date()) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
    return null;
  }
  // به‌روزرسانی حداکثر یک‌بار در دقیقه
  await env.DB.prepare(`UPDATE sessions SET last_seen = datetime('now') WHERE id = ? AND last_seen < datetime('now','-1 minutes')`)
    .bind(sid).run();
  return { id: row.id, username: row.username, role: row.role, sid: row.sid };
}

export async function revokeSession(env, id) {
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
}
export async function revokeAllSessions(env, accountId, exceptSid = null) {
  if (exceptSid) await env.DB.prepare('DELETE FROM sessions WHERE account_id = ? AND id != ?').bind(accountId, exceptSid).run();
  else await env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(accountId).run();
}

/* ─────────── CSRF (هدر x-kaveh-csrf از فرانت ارسال می‌شود) ─────────── */
export function csrfOk(request) {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') return true;
  if (request.headers.get(CSRF_HEADER) === '1') return true;
  // درخواست‌های غیرمرورگری (ربات/اسکریپت با توکن) از این مسیر رد نمی‌شوند
  const auth = request.headers.get('authorization') || '';
  return auth.startsWith('Bearer ');
}

/* ─────────── کد بازیابی ─────────── */
export async function ensureRecoveryCode(env) {
  let code = await getSetting(env, 'recovery_code');
  if (!code) {
    code = randomToken(12);
    await putSetting(env, 'recovery_code', code);
  }
  return code;
}

/* ─────────── تنظیمات (k/v) ─────────── */
export async function getSetting(env, key, def = null) {
  const r = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return r ? r.value : def;
}
export async function putSetting(env, key, value) {
  await env.DB.prepare(
    `INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).bind(key, String(value)).run();
  invalidateSettings();
  return value;
}
export async function allSettings(env) {
  await ensureSchema(env);
  const rows = await env.DB.prepare('SELECT key,value FROM settings').all();
  const out = {};
  for (const r of (rows.results || [])) out[r.key] = r.value;
  return out;
}
export async function putSettingsBulk(env, obj) {
  const entries = Object.entries(obj || {}).filter(([, v]) => v !== undefined);
  for (const [k, v] of entries) await putSetting(env, k, typeof v === 'object' ? JSON.stringify(v) : v);
  return entries.length;
}

/* ─────────── کش تنظیمات در حافظه‌ی ورکر ─────────── */
let SETTINGS_CACHE = { at: 0, data: null };
export function invalidateSettings() { SETTINGS_CACHE = { at: 0, data: null }; }
export async function settingsCached(env, maxAgeMs = 15000) {
  if (SETTINGS_CACHE.data && Date.now() - SETTINGS_CACHE.at < maxAgeMs) return SETTINGS_CACHE.data;
  const data = await allSettings(env);
  SETTINGS_CACHE = { at: Date.now(), data };
  return data;
}

export const DEFAULTS = {
  panel_name: 'Omni',
  public_host: '',
  port: '443',
  ports_mode: 'auto',
  ports_custom: '',
  config_count: '30',
  ipv6_enabled: '1',
  ipv6_pool: '',
  fragment_preset: 'none',
  fingerprint: 'chrome',
  remark_prefix: '',
  default_quota_gb: '50',
  default_expiry_days: '30',
  rotate_minutes: '0',
  signup_max_per_ip: '3',
  signup_max_per_day: '50',
  public_signup: '0',
  maintenance: '0',
  auto_rotate: '0',
  mux_enabled: '0',
  block_ads: '0',
  block_nsfw: '0',
  block_list: '[]',
  clean_ips: '[]',
  ip_pool: '',
  device_limit: '3',
  dns_upstream: 'https://1.1.1.1/dns-query',
  proto: 'both',
  path: '',
  early_data: '2048',
  decoy_url: '',
  bot_pair_code: '',
  admin_chat_id: '',
  announce: '',
};

/* ─────────── لاگ رویدادها ─────────── */
export async function logEvent(env, level, msg, meta = null) {
  try {
    await env.DB.prepare('INSERT INTO logs(level,msg,meta) VALUES(?,?,?)')
      .bind(level, String(msg).slice(0, 500), meta ? JSON.stringify(meta).slice(0, 1000) : null).run();
  } catch { /* ignore */ }
}

/* ─────────── اسکیمای دیتابیس ─────────── */
let SCHEMA_READY = false;
export async function ensureSchema(env) {
  if (SCHEMA_READY) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS accounts(
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
      pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL, role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now')), last_login TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions(
      id TEXT PRIMARY KEY, account_id INTEGER NOT NULL, ua TEXT, ip TEXT,
      created_at TEXT DEFAULT (datetime('now')), last_seen TEXT, expires_at TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
      uuid TEXT NOT NULL, sub_token TEXT UNIQUE NOT NULL,
      quota_bytes INTEGER DEFAULT 0, up_bytes INTEGER DEFAULT 0, down_bytes INTEGER DEFAULT 0,
      request_count INTEGER DEFAULT 0, request_limit INTEGER DEFAULT 0,
      device_limit INTEGER DEFAULT 3, expires_at TEXT,
      first_connect INTEGER DEFAULT 0, activated_at TEXT,
      is_active INTEGER DEFAULT 1, note TEXT, fragment TEXT, fingerprint TEXT,
      ips TEXT DEFAULT '[]', proxies TEXT DEFAULT '[]', block_list TEXT DEFAULT '[]',
      pending_days INTEGER DEFAULT 30, early_data INTEGER DEFAULT 2048, notify INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')), last_seen TEXT, last_ip TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS usage_daily(
      username TEXT NOT NULL, day TEXT NOT NULL, up_bytes INTEGER DEFAULT 0,
      down_bytes INTEGER DEFAULT 0, conns INTEGER DEFAULT 0, PRIMARY KEY(username, day))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS devices(
      username TEXT NOT NULL, device TEXT NOT NULL, first_seen TEXT DEFAULT (datetime('now')),
      last_seen TEXT DEFAULT (datetime('now')), hits INTEGER DEFAULT 0, PRIMARY KEY(username, device))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS logs(
      id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT DEFAULT 'info', msg TEXT, meta TEXT,
      at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS clean_ips(
      ip TEXT PRIMARY KEY, ms INTEGER, colo TEXT, ok INTEGER DEFAULT 1, hits INTEGER DEFAULT 0,
      src TEXT DEFAULT 'edge', checked_at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS signups(
      id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, username TEXT, at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_token ON users(sub_token)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_usage_day ON usage_daily(day)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_logs_at ON logs(at)`),
  ]);
  // مایگریشن سبک (ستون‌های احتمالی نسخه‌های قبلی)
  for (const sql of [
    'ALTER TABLE users ADD COLUMN pending_days INTEGER DEFAULT 30',
    'ALTER TABLE users ADD COLUMN early_data INTEGER DEFAULT 2048',
    'ALTER TABLE users ADD COLUMN notify INTEGER DEFAULT 1',
    'ALTER TABLE clean_ips ADD COLUMN mbps REAL',
    'ALTER TABLE clean_ips ADD COLUMN hits INTEGER DEFAULT 0',
    'ALTER TABLE clean_ips ADD COLUMN src TEXT DEFAULT \'edge\'',
  ]) { try { await env.DB.prepare(sql).run(); } catch { /* ستون هست */ } }
  SCHEMA_READY = true;
}

/* ─────────── بوت‌استرپ: تنظیمات پیش‌فرض (مسیر سریع ۱ کوئری بدون اجرای مجدد ۱۸ کوئری DDL روی هر ایزوله) ─────────── */
let BOOTSTRAP_PROMISE = null;
export async function bootstrap(env, url) {
  if (SCHEMA_READY && SETTINGS_CACHE.data && Date.now() - SETTINGS_CACHE.at < 60000) {
    return SETTINGS_CACHE.data;
  }
  if (BOOTSTRAP_PROMISE) return BOOTSTRAP_PROMISE;
  BOOTSTRAP_PROMISE = (async () => {
    try {
      // مسیر سریع: اگر جدول settings از قبل وجود دارد و پر شده، صفر کوئری CREATE/ALTER اجرا کن!
      const rows = await env.DB.prepare('SELECT key, value FROM settings').all();
      if (rows?.results?.length >= 5) {
        const st = {};
        for (const r of rows.results) st[r.key] = r.value;
        if (st.path && st.trojan_password) {
          SCHEMA_READY = true;
          SETTINGS_CACHE = { at: Date.now(), data: st };
          return st;
        }
      }
    } catch {
      // جدول هنوز ساخته نشده (مثلاً در نصب اولیه یا تست E2E) -> اجرای کامل ensureSchema
    }
    await ensureSchema(env);
    const st = await allSettings(env);
    const missing = {};
    for (const [k, v] of Object.entries(DEFAULTS)) if (st[k] === undefined) missing[k] = v;
    if (!st.path) missing.path = '/' + randomToken(6).slice(0, 12);
    if (!st.trojan_password) missing.trojan_password = randomToken(16);
    if (!st.admin_chat_id && env.ADMIN_CHAT_ID) missing.admin_chat_id = String(env.ADMIN_CHAT_ID);
    if (!st.ip_pool) missing.ip_pool = CF_GOOD_IPS.join('\n');
    if (!st.public_host) missing.public_host = url.host;
    if (!st.recovery_code) missing.recovery_code = randomToken(12);
    if (Object.keys(missing).length) {
      await putSettingsBulk(env, missing);
      Object.assign(st, missing);
    }
    SETTINGS_CACHE = { at: Date.now(), data: st };
    return st;
  })().finally(() => {
    BOOTSTRAP_PROMISE = null;
  });
  return BOOTSTRAP_PROMISE;
}
