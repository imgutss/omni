/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/bot.js
   ربات تلگرام: مدیریت کامل کاربران، گزارش‌ها، اسکن آی‌پی، اعلان‌ها
   (هم وب‌هوک و هم حالت پولینگ با کرون — بدون سرور اضافه)
   ══════════════════════════════════════════════════════════════════════════ */
import { allSettings, putSetting, putSettingsBulk, getSetting, logEvent, randomToken, randomUuid, ensureSchema, settingsCached } from './auth.js';
import { buildConfigs, FRAGMENT_PRESETS } from './links.js';
import { rankIpsHttp, SEED_IPS, httpProbe, tcpProbe, CF_GOOD_IPS, PORTS_PLAIN, PORTS_TLS, OMNI_QOS_V4, OMNI_CLEAN_SITES, OMNI_CLEAN_V6, OMNI_CLEAN_IR } from './scan.js';
import { safeJsonArray } from './core.js';
import {
  beginDeploySession, peekDeploySession, takeDeploySession, cancelDeploySession,
  acquireDeployLock, releaseDeployLock, deployOmniToAccount, auditDeploy,
} from './installer.js';

const GB = 1024 ** 3;
export const CF_TOKEN_URL = 'https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22workers_subdomain%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&accountId=%2A&zoneId=all&name=omni-panel-token';
const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const randomWorkerNames = () => {
  const words = ['nova', 'orbit', 'pulse', 'cloud', 'swift', 'nexus', 'flare', 'vertex', 'zenith', 'pixel', 'turbo', 'prime'];
  const names = new Set();
  while (names.size < 3) {
    const word = words[Math.floor(Math.random() * words.length)];
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 4);
    names.add(`omni-${word}-${suffix}`);
  }
  return [...names];
};
export const fmtBytes = (b) => {
  b = Number(b) || 0;
  if (b < 1024) return b + ' B';
  const u = ['KB', 'MB', 'GB', 'TB']; let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return `${b.toFixed(b >= 100 ? 0 : 2)} ${u[i]}`;
};

const mainKeyboard = (origin, isAdmin = false) => ({
  inline_keyboard: isAdmin ? [
    [{ text: '👥 کاربران', callback_data: 'cmd:list' }, { text: '➕ کاربر جدید', callback_data: 'cmd:new' }],
    [{ text: '📊 آمار', callback_data: 'cmd:stats' }, { text: '⚡ آی‌پی‌ها', callback_data: 'cmd:ips' }],
    [{ text: '🔎 اسکن', callback_data: 'cmd:scan' }, { text: '🩺 سلامت', callback_data: 'cmd:ping' }],
    [{ text: '📣 ارسال اعلان', callback_data: 'cmd:notify' }, { text: '🚀 نصب مستقل', callback_data: 'cmd:deploy' }],
    [{ text: '🌐 باز کردن پنل', url: `${origin}/` }],
  ] : [
    [{ text: '🚀 ساخت پنل رایگان روی Cloudflare', callback_data: 'cmd:deploy' }],
    [{ text: '🔗 اتصال پنل موجود', callback_data: 'cmd:pair' }],
  ],
});

const userKeyboard = (id, origin, subToken) => ({
  inline_keyboard: [
    [{ text: '📥 لینک اشتراک', callback_data: `usr:link:${id}` }, { text: '♻️ ریست حجم', callback_data: `usr:reset:${id}` }],
    [{ text: '📅 تمدید', callback_data: `usr:extend:${id}` }, { text: '⏯ فعال/غیرفعال', callback_data: `usr:toggle:${id}` }],
    [{ text: '📝 یادداشت', callback_data: `usr:note:${id}` }, { text: '🗑 حذف', callback_data: `usr:delask:${id}` }],
    ...(subToken ? [[{ text: '📄 صفحه وضعیت', url: `${origin}/status/${subToken}` }]] : []),
    [{ text: '⬅️ کاربران', callback_data: 'cmd:list' }, { text: '🏠 منوی اصلی', callback_data: 'cmd:menu' }],
  ],
});

async function ensureUiSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS bot_ui_sessions(
    chat_id TEXT PRIMARY KEY,state TEXT NOT NULL,data TEXT,
    expires_at TEXT NOT NULL DEFAULT (datetime('now','+10 minutes'))
  )`).run();
}
async function setUiState(env, chatId, state, data = {}) {
  await ensureUiSchema(env);
  await env.DB.prepare(`INSERT INTO bot_ui_sessions(chat_id,state,data,expires_at) VALUES(?,?,?,datetime('now','+10 minutes'))
    ON CONFLICT(chat_id) DO UPDATE SET state=excluded.state,data=excluded.data,expires_at=excluded.expires_at`)
    .bind(String(chatId), state, JSON.stringify(data)).run();
}
async function getUiState(env, chatId) {
  await ensureUiSchema(env);
  const row = await env.DB.prepare(`SELECT state,data FROM bot_ui_sessions WHERE chat_id=? AND expires_at>datetime('now')`).bind(String(chatId)).first();
  if (!row) return null;
  try { return { state: row.state, data: JSON.parse(row.data || '{}') }; } catch { return { state: row.state, data: {} }; }
}
async function clearUiState(env, chatId) {
  await ensureUiSchema(env);
  await env.DB.prepare('DELETE FROM bot_ui_sessions WHERE chat_id=?').bind(String(chatId)).run();
}

export async function tgApi(env, method, payload) {
  if (!env.BOT_TOKEN) return { ok: false, description: 'no_token' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload || {}),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, description: String(e?.message || e) };
  }
}

/* ─────────────── اعلان به مدیر ─────────────── */
export async function notifyAdmin(env, ctx, text, opts = {}) {
  const settings = await allSettings(env);
  const chat = settings.admin_chat_id || env.ADMIN_CHAT_ID;
  if (!chat || !env.BOT_TOKEN) return false;
  const p = tgApi(env, 'sendMessage', { chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true, ...opts });
  if (ctx?.waitUntil) ctx.waitUntil(p); else await p;
  return true;
}

/* ─────────────── هندلر وب‌هوک / آپدیت ─────────────── */
export async function handleUpdate(env, ctx, origin, update) {
  await ensureSchema(env);
  const msg = update.message || update.callback_query?.message;
  const chatId = msg?.chat?.id;
  const from = update.message?.from || update.callback_query?.from || {};
  if (!chatId) return;
  const settings = await allSettings(env);
  const adminChat = settings.admin_chat_id || env.ADMIN_CHAT_ID;
  const isAdmin = Boolean(adminChat) && String(chatId) === String(adminChat);
  const callbackId = update.callback_query?.id;
  const callbackData = String(update.callback_query?.data || '');
  let text = (update.message?.text || '').trim();
  let [rawCmd, ...args] = text.split(/\s+/);
  let cmd = (rawCmd || '').split('@')[0].toLowerCase();

  if (callbackId) await tgApi(env, 'answerCallbackQuery', { callback_query_id: callbackId }).catch(() => {});
  if (callbackData.startsWith('cmd:')) {
    const action = callbackData.slice(4);
    const map = { menu: '/start', list: '/list', new: '/new', stats: '/stats', ips: '/ips', scan: '/scan', ping: '/ping', notify: '/notify', deploy: '/deploy', pair: '/pair', panel: '/panel' };
    cmd = map[action] || '/start'; args = []; text = cmd;
  } else if (callbackData.startsWith('usr:')) {
    const [, action, rawId] = callbackData.split(':');
    const user = await env.DB.prepare('SELECT id,username,sub_token FROM users WHERE id=?').bind(Number(rawId)).first();
    if (!user) cmd = '/list';
    else {
      const map = { view: '/user', link: '/link', reset: '/reset', extend: '/extendmenu', toggle: '/toggle', note: '/noteinput', delask: '/delask', del: '/del' };
      cmd = map[action] || '/user';
      args = [user.username];
      text = `${cmd} ${user.username}`;
    }
  }

  const send = (t, opts = {}) => tgApi(env, 'sendMessage', {
    chat_id: chatId, text: t, parse_mode: 'HTML', disable_web_page_preview: true,
    reply_markup: mainKeyboard(origin, isAdmin), ...opts,
  });
  /* جریان‌های کاملاً دکمه‌ای */
  if (callbackData.startsWith('cmd:') || callbackData.startsWith('usr:')) await clearUiState(env, chatId);
  if (callbackData === 'cmd:deploy') {
    const names = randomWorkerNames();
    return send(
      `✨ <b>یک نام برای پنل خودت انتخاب کن</b>\n\nسه نام تصادفی و آماده ساخته شد. با انتخاب هرکدام مستقیماً به مرحله دریافت توکن می‌روی:`,
      { reply_markup: { inline_keyboard: [
        ...names.map((name) => [{ text: `☁️ ${name}`, callback_data: `pick:${name}` }]),
        [{ text: '🔄 ساخت سه نام جدید', callback_data: 'cmd:deploy' }],
        [{ text: '❌ انصراف', callback_data: 'cmd:menu' }],
      ] } });
  }
  if (callbackData.startsWith('pick:')) {
    const worker = callbackData.slice(5);
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(worker)) return send('نام انتخابی معتبر نیست؛ دوباره شروع کن.');
    try { await beginDeploySession(env, chatId, worker, ''); }
    catch (error) { return send(`⏳ ${esc(String(error?.message || error))}`); }
    return send(
      `☁️ <b>${esc(worker)}</b> انتخاب شد\n\n` +
      `روی دکمه زیر بزن؛ صفحه ساخت توکن با همه دسترسی‌ها و <b>All accounts</b> از قبل آماده باز می‌شود. سپس فقط <b>Continue to summary</b> و <b>Create Token</b> را بزن و توکن را همین‌جا بفرست.\n\n` +
      `🔐 پیام توکن فوراً حذف می‌شود و توکن ذخیره نخواهد شد.`,
      { reply_markup: { inline_keyboard: [
        [{ text: '🔑 دریافت توکن آماده Cloudflare', url: `${origin}/cf-token` }],
        [{ text: '⬅️ انتخاب نام دیگر', callback_data: 'cmd:deploy' }],
        [{ text: '❌ لغو نصب', callback_data: 'dep:cancel' }],
      ] } });
  }
  if (callbackData === 'cmd:pair') {
    await setUiState(env, chatId, 'pair_code');
    return send('🔗 کد شش‌رقمی اتصال را از پنل بگیر و همین‌جا بفرست.', { reply_markup: { inline_keyboard: [[{ text: '❌ انصراف', callback_data: 'cmd:menu' }]] } });
  }
  if (callbackData === 'cmd:new' && isAdmin) {
    await setUiState(env, chatId, 'new_username');
    return send('👤 نام کاربر جدید را بفرست (۳ تا ۴۰ کاراکتر انگلیسی).', { reply_markup: { inline_keyboard: [[{ text: '❌ انصراف', callback_data: 'cmd:menu' }]] } });
  }
  if (callbackData === 'cmd:notify' && isAdmin) {
    await setUiState(env, chatId, 'notify_text');
    return send('📣 متن اعلان را بفرست.', { reply_markup: { inline_keyboard: [[{ text: '❌ انصراف', callback_data: 'cmd:menu' }]] } });
  }
  if (callbackData === 'dep:cancel') {
    await clearUiState(env, chatId); await cancelDeploySession(env, chatId);
    return send('نصب لغو شد.');
  }
  if (callbackData === 'dep:auto' || callbackData === 'dep:input') {
    await clearUiState(env, chatId);
    return send('این روش قدیمی حذف شده است؛ دکمه «ساخت پنل رایگان روی Cloudflare» را بزن.');
  }
  if (callbackData.startsWith('newq:') && isAdmin) {
    const ui = await getUiState(env, chatId); if (ui?.state !== 'new_quota') return send('نشست ساخت کاربر منقضی شده.');
    const quota = Number(callbackData.slice(5));
    await setUiState(env, chatId, 'new_days', { ...ui.data, quota });
    return send('📅 مدت اعتبار را انتخاب کن:', { reply_markup: { inline_keyboard: [
      [7, 30, 60].map((d) => ({ text: `${d} روز`, callback_data: `newd:${d}` })),
      [[90, 365].map((d) => ({ text: `${d} روز`, callback_data: `newd:${d}` }))][0],
      [{ text: '❌ انصراف', callback_data: 'cmd:menu' }],
    ] } });
  }
  if (callbackData.startsWith('newd:') && isAdmin) {
    const ui = await getUiState(env, chatId); if (ui?.state !== 'new_days') return send('نشست ساخت کاربر منقضی شده.');
    const days = Math.max(1, Number(callbackData.slice(5)) || 30);
    const { username, quota } = ui.data;
    const uuid = randomUuid(), subToken = randomToken(18), quotaBytes = Math.max(0, Number(quota) * GB);
    const exp = new Date(Date.now() + days * 864e5).toISOString().slice(0, 19).replace('T', ' ');
    await env.DB.prepare(`INSERT INTO users(username,uuid,sub_token,quota_bytes,device_limit,expires_at,is_active,pending_days) VALUES(?,?,?,?,?,?,1,?)`)
      .bind(username, uuid, subToken, quotaBytes, Number(settings.device_limit || 3), exp, days).run();
    await clearUiState(env, chatId);
    const u = await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(username).first();
    return send(`✅ کاربر <b>${esc(username)}</b> با ${quota ? quota + ' گیگ' : 'حجم نامحدود'} و ${days} روز اعتبار ساخته شد.`,
      { reply_markup: userKeyboard(u.id, origin, subToken) });
  }
  if (callbackData.startsWith('ext:') && isAdmin) {
    const [, id, days] = callbackData.split(':');
    const u = await env.DB.prepare('SELECT username FROM users WHERE id=?').bind(Number(id)).first();
    if (!u) return send('کاربر پیدا نشد.');
    cmd = '/extend'; args = [u.username, days];
  }

  const ui = !callbackData && text && !cmd.startsWith('/') ? await getUiState(env, chatId) : null;
  if (ui?.state?.startsWith('deploy_')) {
    await clearUiState(env, chatId);
    return send('روش قدیمی نصب حذف شده است؛ از دکمه ساخت پنل استفاده کن.');
  }
  if (ui?.state === 'pair_code') { await clearUiState(env, chatId); cmd = '/pair'; args = [text]; }
  if (ui?.state === 'new_username' && isAdmin) {
    const username = text.trim();
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return send('❌ نام نامعتبر است؛ ۳ تا ۴۰ کاراکتر انگلیسی، عدد، نقطه، خط تیره یا زیرخط.');
    if (await env.DB.prepare('SELECT 1 FROM users WHERE username=?').bind(username).first()) return send('❌ این نام قبلاً وجود دارد؛ نام دیگری بفرست.');
    await setUiState(env, chatId, 'new_quota', { username });
    return send('📦 حجم کاربر را انتخاب کن:', { reply_markup: { inline_keyboard: [
      [[10, 30, 50].map((q) => ({ text: `${q} GB`, callback_data: `newq:${q}` }))][0],
      [[100, 200].map((q) => ({ text: `${q} GB`, callback_data: `newq:${q}` })), { text: '♾ نامحدود', callback_data: 'newq:0' }].flat(),
      [{ text: '❌ انصراف', callback_data: 'cmd:menu' }],
    ] } });
  }
  if (ui?.state === 'notify_text' && isAdmin) {
    await clearUiState(env, chatId);
    await tgApi(env, 'sendMessage', { chat_id: chatId, text: `📣 ${esc(text)}`, parse_mode: 'HTML', reply_markup: mainKeyboard(origin, true) });
    return;
  }
  if (ui?.state === 'note_text' && isAdmin) {
    const u = await env.DB.prepare('SELECT id,username,sub_token FROM users WHERE id=?').bind(Number(ui.data.id)).first();
    await clearUiState(env, chatId); if (!u) return send('کاربر پیدا نشد.');
    await env.DB.prepare('UPDATE users SET note=? WHERE id=?').bind(text, u.id).run();
    return send(`📝 یادداشت <b>${esc(u.username)}</b> ذخیره شد.`, { reply_markup: userKeyboard(u.id, origin, u.sub_token) });
  }

  /* ── نصب سلف‌سرویس روی اکانت Cloudflare کاربر ──
     توکن هرگز در D1 ذخیره نمی‌شود و پیام حاوی آن فوراً حذف می‌شود. */
  if (cmd === '/deploy') {
    if (msg?.chat?.type !== 'private') return send('🔐 برای امنیت، نصب فقط در گفت‌وگوی خصوصی ربات انجام می‌شود.');
    const names = randomWorkerNames();
    return send('✨ یکی از سه نام تصادفی زیر را برای پنلت انتخاب کن:', { reply_markup: { inline_keyboard: [
      ...names.map((name) => [{ text: `☁️ ${name}`, callback_data: `pick:${name}` }]),
      [{ text: '🔄 سه نام جدید', callback_data: 'cmd:deploy' }],
      [{ text: '❌ انصراف', callback_data: 'cmd:menu' }],
    ] } });
  }
  if (cmd === '/canceldeploy') {
    await cancelDeploySession(env, chatId);
    return send('نصب لغو شد.');
  }

  const pendingDeploy = text && !cmd.startsWith('/') ? await peekDeploySession(env, chatId) : null;
  if (pendingDeploy) {
    if (!/^[A-Za-z0-9_\-]{20,300}$/.test(text)) return send('❌ ساختار توکن درست نیست. دوباره توکن کامل را بفرست یا /canceldeploy بزن.');
    await tgApi(env, 'deleteMessage', { chat_id: chatId, message_id: update.message?.message_id }).catch(() => {});
    const session = await takeDeploySession(env, chatId);
    if (!session) return send('⏳ نشست نصب منقضی شده؛ دوباره /deploy را اجرا کن.');
    if (!(await acquireDeployLock(env, chatId))) return send('⏳ یک نصب دیگر برای این گفتگو در حال اجراست.');
    await send(`⏳ ساخت D1 و انتشار <code>${esc(session.worker_name)}</code> شروع شد…`);
    try {
      const result = await deployOmniToAccount({
        token: text,
        requestedAccountId: session.account_id || '',
        workerName: session.worker_name,
        origin,
      });
      await auditDeploy(env, chatId, session.worker_name, true, result.panelUrl || 'deployed');
      const open = { inline_keyboard: [[{
        text: result.panelUrl ? '🌐 باز کردن پنل جدید' : '☁️ باز کردن در Cloudflare',
        url: result.panelUrl || result.dashboardUrl,
      }]] };
      return send(
        `✅ <b>پنل روی اکانت Cloudflare خودت ساخته شد</b>\n\n` +
        `Worker: <code>${esc(result.workerName)}</code>\n` +
        `D1: <code>${esc(result.databaseId)}</code>\n` +
        (result.panelUrl ? `آدرس: ${result.panelUrl}\n\n` : `آدرس workers.dev در اکانت فعال نیست؛ از داشبورد Cloudflare وارد Worker شو.\n\n`) +
        `در اولین ورود، نام مدیر و رمز را خودت تعیین کن. سپس از بخش کاربران، کاربر بساز و لینک اشتراک بگیر.`,
        { reply_markup: open });
    } catch (error) {
      await auditDeploy(env, chatId, session.worker_name, false, String(error?.message || error)).catch(() => {});
      return send(
        `❌ نصب کامل نشد:\n<code>${esc(String(error?.message || error))}</code>\n\n` +
        `توکن ذخیره نشده است. مجوزها را بررسی کن و دوباره دستور /deploy را بزن.`);
    } finally {
      await releaseDeployLock(env, chatId).catch(() => {});
    }
  }

  /* pairing */
  if (cmd === '/pair') {
    const code = String(args[0] || '').trim();
    const expected = settings.bot_pair_code;
    if (!code) return send('🔗 کد اتصال را از پنل بگیر و این‌طور بفرست:\n<code>/pair 123456</code>');
    if (!expected) return send('ℹ️ کدی برای اتصال ساخته نشده. از پنل → بخش ربات → «ساخت کد اتصال» بگیر.');
    if (code !== String(expected)) return send('❌ کد نادرست است.');
    await putSetting(env, 'admin_chat_id', chatId);
    await putSetting(env, 'bot_pair_code', '');
    await logEvent(env, 'info', `ربات به مدیر متصل شد (chat ${chatId})`);
    return send('✅ ربات به پنل <b>Omni</b> متصل شد!\nاز منوی زیر مدیریت را شروع کن.', { reply_markup: mainKeyboard(origin, true) });
  }

  const welcome =
    `✨ <b>به Omni خوش آمدی</b>\n\n` +
    `با چند لمس، پنل اختصاصی VLESS و Trojan خودت را مستقیماً روی حساب Cloudflare می‌سازی؛ بدون سرور و بدون تنظیمات پیچیده.\n\n` +
    `🚀 <b>ساخت پنل رایگان</b> — فقط یک توکن Cloudflare می‌فرستی و Worker، دیتابیس D1 و لینک پنل خودکار آماده می‌شوند.\n` +
    `🔗 <b>اتصال پنل موجود</b> — مدیریت پنلی که قبلاً ساخته‌ای.\n\n` +
    `یکی از گزینه‌های زیر را انتخاب کن 👇`;
  if (!adminChat) return send(welcome);
  if (String(chatId) !== String(adminChat)) {
    if (cmd === '/start' || cmd === '/help') return send(welcome);
    return send('این بخش مخصوص مدیر پنل است. برای شروع یکی از گزینه‌های زیر را انتخاب کن 👇');
  }

  const kb = { inline_keyboard: [[{ text: '🌐 باز کردن پنل در مرورگر', url: `${origin}/` }]] };
  if (cmd.startsWith('/')) ctx?.waitUntil?.(logEvent(env, 'info', `دستور ربات: ${cmd} از ${chatId}`).catch(() => {}));

  switch (cmd) {
    case '/start':
    case '/help':
      return send(
        `⚡️ <b>Omni — مدیریت پنل</b>\n\n` +
        `همه بخش‌ها از دکمه‌های زیر در دسترس‌اند. برای مدیریت هر کاربر، ابتدا «کاربران» و سپس نام او را بزن.`,
        { reply_markup: mainKeyboard(origin, true) });
    case '/panel':
      return send(`🌐 پنل مدیریت:\n${origin}`, { reply_markup: kb });

    case '/stats': {
      const agg = await env.DB.prepare(
        `SELECT COUNT(*) total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) active,
                COALESCE(SUM(up_bytes + down_bytes),0) used FROM users`).first();
      const today = await env.DB.prepare(
        `SELECT COALESCE(SUM(up_bytes+down_bytes),0) t, COALESCE(SUM(conns),0) c FROM usage_daily WHERE day = date('now')`).first();
      const expired = await env.DB.prepare(
        `SELECT COUNT(*) c FROM users WHERE expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')`).first();
      return send(
        `📊 <b>آمار پنل Omni</b>\n\n` +
        `👥 کاربران: <b>${agg?.total || 0}</b> (فعال ${agg?.active || 0})\n` +
        `⛔️ منقضی: <b>${expired?.c || 0}</b>\n` +
        `📶 مصرف کل: <b>${fmtBytes(agg?.used || 0)}</b>\n` +
        `📅 امروز: <b>${fmtBytes(today?.t || 0)}</b> — ${today?.c || 0} اتصال\n` +
        `🌐 دامنه: <code>${esc(settings.public_host || '-')}</code>`);
    }

    case '/list': {
      const rows = await env.DB.prepare('SELECT * FROM users ORDER BY id DESC LIMIT 30').all();
      if (!rows.results?.length) return send('هنوز کاربری نساخته‌ای؛ دکمه «کاربر جدید» را بزن.');
      const lines = rows.results.map((u) => {
        const used = (u.up_bytes || 0) + (u.down_bytes || 0);
        const quota = Number(u.quota_bytes || 0);
        const left = u.expires_at ? Math.max(0, Math.floor((new Date(String(u.expires_at).replace(' ', 'T') + 'Z') - Date.now()) / 864e5)) : '∞';
        const icon = !u.is_active ? '🔴' : (quota > 0 && used >= quota) ? '⛔️' : '🟢';
        return `${icon} <b>${esc(u.username)}</b> — ${fmtBytes(used)}${quota ? '/' + fmtBytes(quota) : ''} — ${left} روز`;
      });
      const userRows = rows.results.map((u) => [{
        text: `${u.is_active ? '🟢' : '🔴'} ${u.username}`,
        callback_data: `usr:view:${u.id}`,
      }]);
      return send(`👥 <b>کاربران</b> (${rows.results.length})\n\n${lines.join('\n')}\n\nبرای مدیریت روی نام کاربر بزن:`, {
        reply_markup: { inline_keyboard: [...userRows, [{ text: '➕ کاربر جدید', callback_data: 'cmd:new' }], [{ text: '🏠 منوی اصلی', callback_data: 'cmd:menu' }]] },
      });
    }

    case '/user': {
      const u = await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(String(args[0] || '')).first();
      if (!u) return send('کاربر پیدا نشد.');
      const used = Number(u.up_bytes || 0) + Number(u.down_bytes || 0);
      return send(
        `👤 <b>${esc(u.username)}</b>\n\n` +
        `وضعیت: ${u.is_active ? '🟢 فعال' : '🔴 غیرفعال'}\n` +
        `مصرف: <b>${fmtBytes(used)}</b>${u.quota_bytes ? ` از ${fmtBytes(u.quota_bytes)}` : ''}\n` +
        `انقضا: <code>${esc(u.expires_at || 'نامحدود')}</code>`,
        { reply_markup: userKeyboard(u.id, origin, u.sub_token) });
    }

    case '/new': {
      const [username, gb, days] = args;
      if (!username || !/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return send('مثال: <code>/new ali 50 30</code>');
      const exists = await env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first();
      if (exists) return send('❌ این نام کاربری وجود دارد.');
      const uuid = randomUuid(), subToken = randomToken(18);
      const quota = Math.max(0, Number(gb || settings.default_quota_gb || 50) * GB);
      const d = Math.max(1, Number(days || settings.default_expiry_days || 30));
      const exp = new Date(Date.now() + d * 864e5).toISOString().slice(0, 19).replace('T', ' ');
      await env.DB.prepare(
        `INSERT INTO users(username,uuid,sub_token,quota_bytes,device_limit,expires_at,is_active,pending_days)
         VALUES(?,?,?,?,?,?,1,?)`
      ).bind(username, uuid, subToken, quota, Number(settings.device_limit || 3), exp, d).run();
      await logEvent(env, 'info', `کاربر «${username}» از ربات ساخته شد`);
      const link = `${origin}/s/${subToken}`;
      return send(
        `✅ کاربر <b>${esc(username)}</b> ساخته شد\n\n` +
        `📦 حجم: <b>${fmtBytes(quota)}</b>\n📅 اعتبار: <b>${d} روز</b>\n\n` +
        `📥 ساب‌لینک:\n<code>${link}</code>\n\n` +
        `📄 صفحه‌ی وضعیت:\n${origin}/status/${subToken}`,
        { reply_markup: { inline_keyboard: [[{ text: '📥 لینک ساب', url: link }], [{ text: '📄 صفحه وضعیت', url: `${origin}/status/${subToken}` }]] } });
    }

    case '/link': {
      const u = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(String(args[0] || '')).first();
      if (!u) return send('کاربر پیدا نشد.');
      const settings2 = await settingsCached(env);
      const ips = (await env.DB.prepare('SELECT ip FROM clean_ips ORDER BY ms ASC LIMIT 8').all()).results || [];
      const view = { ...u, username: u.username, uuid: u.uuid, quota_gb: Number(u.quota_bytes || 0) / GB, ips: safeJsonArray(u.ips), fingerprint: u.fingerprint, fragment: u.fragment };
      const cfg = buildConfigs(view, settings2, ips.map((r) => r.ip));
      const used = (u.up_bytes || 0) + (u.down_bytes || 0);
      return send(
        `👤 <b>${esc(u.username)}</b>\nمصرف: ${fmtBytes(used)}${u.quota_bytes ? ' / ' + fmtBytes(u.quota_bytes) : ''}\n\n` +
        `📥 ساب‌لینک:\n<code>${origin}/s/${u.sub_token}</code>\n\n` +
        `🔗 اولین کانفیگ:\n<code>${esc((cfg.uris[0] || '').slice(0, 900))}</code>`,
        { reply_markup: { inline_keyboard: [[{ text: '📥 دانلود ساب', url: `${origin}/s/${u.sub_token}` }], [{ text: '📄 وضعیت', url: `${origin}/status/${u.sub_token}` }]] } });
    }

    case '/extendmenu': {
      const u = await env.DB.prepare('SELECT id,username,sub_token FROM users WHERE username=?').bind(String(args[0] || '')).first();
      if (!u) return send('کاربر پیدا نشد.');
      return send(`📅 چند روز به اعتبار <b>${esc(u.username)}</b> اضافه شود؟`, { reply_markup: { inline_keyboard: [
        [[7, 30, 60].map((d) => ({ text: `${d} روز`, callback_data: `ext:${u.id}:${d}` }))][0],
        [[90, 365].map((d) => ({ text: `${d} روز`, callback_data: `ext:${u.id}:${d}` }))][0],
        [{ text: '⬅️ بازگشت', callback_data: `usr:view:${u.id}` }],
      ] } });
    }

    case '/noteinput': {
      const u = await env.DB.prepare('SELECT id,username FROM users WHERE username=?').bind(String(args[0] || '')).first();
      if (!u) return send('کاربر پیدا نشد.');
      await setUiState(env, chatId, 'note_text', { id: u.id });
      return send(`📝 یادداشت جدید برای <b>${esc(u.username)}</b> را بفرست.`, { reply_markup: { inline_keyboard: [[{ text: '❌ انصراف', callback_data: `usr:view:${u.id}` }]] } });
    }

    case '/reset': {
      const name = String(args[0] || '');
      const r = await env.DB.prepare('UPDATE users SET up_bytes = 0, down_bytes = 0, request_count = 0 WHERE username = ?').bind(name).run();
      return send(r.meta?.changes ? `♻️ حجم کاربر <b>${esc(name)}</b> ریست شد.` : 'کاربر پیدا نشد.');
    }

    case '/extend': {
      const [name, days] = args;
      const u = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(String(name || '')).first();
      if (!u) return send('کاربر پیدا نشد.');
      const d = Number(days || 30);
      const base = u.expires_at && new Date(String(u.expires_at).replace(' ', 'T') + 'Z') > new Date()
        ? new Date(String(u.expires_at).replace(' ', 'T') + 'Z') : new Date();
      const exp = new Date(base.getTime() + d * 864e5).toISOString().slice(0, 19).replace('T', ' ');
      await env.DB.prepare('UPDATE users SET expires_at = ?, is_active = 1 WHERE username = ?').bind(exp, name).run();
      return send(`📅 کاربر <b>${esc(name)}</b> تا <b>${exp.slice(0, 10)}</b> تمدید شد.`);
    }

    case '/toggle': {
      const u = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(String(args[0] || '')).first();
      if (!u) return send('کاربر پیدا نشد.');
      await env.DB.prepare('UPDATE users SET is_active = ? WHERE username = ?').bind(u.is_active ? 0 : 1, u.username).run();
      return send(`${u.is_active ? '⏸ غیرفعال شد' : '▶️ فعال شد'} — <b>${esc(u.username)}</b>`);
    }

    case '/delask': {
      const u = await env.DB.prepare('SELECT id,username FROM users WHERE username=?').bind(String(args[0] || '')).first();
      if (!u) return send('کاربر پیدا نشد.');
      return send(`⚠️ کاربر <b>${esc(u.username)}</b> واقعاً حذف شود؟ این کار برگشت‌پذیر نیست.`, {
        reply_markup: { inline_keyboard: [
          [{ text: '✅ بله، حذف کن', callback_data: `usr:del:${u.id}` }, { text: '❌ انصراف', callback_data: `usr:view:${u.id}` }],
          [{ text: '🏠 منوی اصلی', callback_data: 'cmd:menu' }],
        ] },
      });
    }

    case '/del': {
      const name = String(args[0] || '');
      const r = await env.DB.prepare('DELETE FROM users WHERE username = ?').bind(name).run();
      if (!r.meta?.changes) return send('کاربر پیدا نشد.');
      await env.DB.prepare('DELETE FROM usage_daily WHERE username = ?').bind(name).run();
      return send(`🗑 کاربر <b>${esc(name)}</b> حذف شد.`);
    }

    case '/note': {
      const name = args[0];
      const note = args.slice(1).join(' ');
      const r = await env.DB.prepare('UPDATE users SET note = ? WHERE username = ?').bind(note || null, String(name || '')).run();
      return send(r.meta?.changes ? '📝 یادداشت ذخیره شد.' : 'کاربر پیدا نشد.');
    }

    case '/ips': {
      const rows = await env.DB.prepare('SELECT ip, ms, colo, COALESCE(hits,0) hits FROM clean_ips WHERE ok = 1 ORDER BY (hits * 1000) DESC, ms ASC LIMIT 20').all();
      if (!rows.results?.length) return send('هنوز آی‌پی تمیزی ذخیره نشده؛ دکمه «اسکن» را بزن یا در صفحه وضعیت کاربران «تست روی دستگاه من» را اجرا کن.');
      return send(`⚡️ <b>آی‌پی‌های تمیز</b> (اندازه‌گیری‌شده)\n\n${rows.results.map((r, i) => `${i + 1}. <code>${r.ip}</code> — ${r.ms ?? '?'}ms${r.colo ? ' · ' + r.colo : ''}${r.hits ? ' · ' + r.hits + '★' : ''}`).join('\n')}`);
    }

    case '/scan': {
      await send('⚡️ اسکن شروع شد…');
      const st = await allSettings(env);
      const pool = [...new Set([
        ...String(st.ip_pool || '').split(/[\n,\s]+/).filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x)),
        ...CF_GOOD_IPS,
      ])].slice(0, 60);
      const edge = await rankIpsHttp(pool, { concurrency: 8, timeoutMs: 2500 });
      const client = await env.DB.prepare('SELECT ip, ms, colo, COALESCE(hits,0) hits FROM clean_ips WHERE ok = 1 ORDER BY (hits * 1000) DESC, ms ASC LIMIT 10').all();
      const top = edge.slice(0, 10);
      const lines = [];
      if (top.length) lines.push('<b>از لبه‌ی کلودفلر:</b>\n' + top.map((r, i) => `${i + 1}. <code>${r.ip}</code> — ${r.ms}ms${r.colo ? ' · ' + r.colo : ''}`).join('\n'));
      if (client.results?.length) lines.push('<b>اندازه‌گیری کاربران:</b>\n' + client.results.slice(0, 8).map((r, i) => `${i + 1}. <code>${r.ip}</code> — ${r.ms ?? '?'}ms${r.hits ? ' · ' + r.hits + '★' : ''}`).join('\n'));
      if (top.length) {
        await putSetting(env, 'clean_ips', JSON.stringify(top.map((r) => r.ip)));
        await logEvent(env, 'info', `اسکن ربات: ${top.length} آی‌پی از لبه`);
      }
      return send(
        `<b>نتیجه‌ی اسکن</b> (${edge.length} پاسخ از ${pool.length})\n\n` +
        (lines.join('\n\n') || 'چیزی پیدا نشد.') +
        '\n\nℹ️ کلودفلر اجازه‌ی تست مستقیم آی‌پی‌های خودش از داخل ورکر را نمی‌دهد؛ دقیق‌ترین نتیجه از «تست روی دستگاه من» در صفحه‌ی وضعیت کاربران می‌آید (شبکه‌ی کاربر مهم است).'
      );
    }

    case '/ping': {
      const host = (args[0] || settings.public_host || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      const t0 = Date.now();
      try {
        const r = await fetch(`https://${host}/cdn-cgi/trace`, { signal: AbortSignal.timeout(6000), cf: { cacheTtl: 0 } });
        const body = await r.text().catch(() => '');
        const colo = (body.match(/colo=(\w+)/) || [])[1] || '—';
        return send(`✅ <code>${esc(host)}</code> سالم است — ${Date.now() - t0}ms · کولو ${colo}`);
      } catch (e) {
        const r = await tcpProbe(host, { port: Number(settings.port || 443), timeoutMs: 4000 });
        return send(r.ok ? `✅ <code>${esc(host)}</code> — ${r.ms}ms` : `⚠️ پاسخ نداد: ${esc(r.err || String(e?.message || e))}`);
      }
    }

    case '/notify': {
      const text2 = args.join(' ');
      if (!text2) return send('متن پیام را بده: <code>/notify سلام</code>');
      await tgApi(env, 'sendMessage', { chat_id: chatId, text: `📣 ${esc(text2)}`, parse_mode: 'HTML' });
      return;
    }

    default:
      if (text.startsWith('/')) return send('دستور ناشناخته است؛ از دکمه‌های منوی اصلی استفاده کن.');
  }
}

/* ─────────────── پردازش صف آپدیت‌ها (حالت بدون وب‌هوک) ─────────────── */
export async function drainUpdates(env, ctx, origin, msBudget = 15000) {
  if (!env.BOT_TOKEN) return 0;
  const settings = await allSettings(env);
  if (settings.admin_chat_id || env.ADMIN_CHAT_ID) {
    // وقتی وب‌هوک فعال است، صف نباید مصرف شود
    const wh = await tgApi(env, 'getWebhookInfo', {});
    if (wh?.result?.url) return 0;
  }
  let offset = Number(await getSetting(env, 'tg_offset', '0')) || 0;
  let handled = 0;
  const deadline = Date.now() + msBudget;
  while (Date.now() < deadline && handled < 25) {
    const r = await tgApi(env, 'getUpdates', { offset: offset + 1, timeout: 0, limit: 10, allowed_updates: ['message', 'callback_query'] });
    const updates = r?.result || [];
    if (!updates.length) break;
    for (const u of updates) {
      offset = Math.max(offset, u.update_id);
      await handleUpdate(env, ctx, origin, u).catch(() => {});
      handled++;
    }
    await putSetting(env, 'tg_offset', offset);
  }
  return handled;
}

/* ─────────────── کارهای زمان‌بندی‌شده ─────────────── */
export async function scheduledTasks(env, ctx, origin) {
  await ensureSchema(env);
  const settings = await allSettings(env);

  // ۱) پولینگ ربات (اگر وب‌هوک ست نشده باشد)
  ctx.waitUntil(drainUpdates(env, ctx, origin, 12000));

  // ۲) هشدارها: ۸۰٪ حجم و نزدیک انقضا
  const users = await env.DB.prepare('SELECT * FROM users WHERE is_active = 1').all();
  for (const u of (users.results || [])) {
    const used = (u.up_bytes || 0) + (u.down_bytes || 0);
    const quota = Number(u.quota_bytes || 0);
    if (quota > 0 && used / quota >= 0.8 && used < quota) {
      const flag = `warn80_${u.username}_${new Date().toISOString().slice(0, 10)}`;
      if (!(await getSetting(env, flag))) {
        await putSetting(env, flag, '1');
        await notifyAdmin(env, ctx,
          `⚠️ <b>${esc(u.username)}</b> به ۸۰٪ حجم رسید.\n${fmtBytes(used)} از ${fmtBytes(quota)}`,
          { reply_markup: { inline_keyboard: [[{ text: '📅 تمدید', callback_data: `usr:extend:${u.id}` }, { text: '👤 مدیریت کاربر', callback_data: `usr:view:${u.id}` }]] } });
      }
    }
    if (quota > 0 && used >= quota) {
      const flag = `over_${u.username}_${new Date().toISOString().slice(0, 10)}`;
      if (!(await getSetting(env, flag))) {
        await putSetting(env, flag, '1');
        await notifyAdmin(env, ctx, `⛔️ <b>${esc(u.username)}</b> به سقف حجم رسید و اتصالش قطع شد.`,
          { reply_markup: { inline_keyboard: [[{ text: '📥 لینک اشتراک', callback_data: `usr:link:${u.id}` }, { text: '👤 مدیریت کاربر', callback_data: `usr:view:${u.id}` }]] } });
      }
    }
    if (u.expires_at) {
      const ms = new Date(String(u.expires_at).replace(' ', 'T') + 'Z').getTime() - Date.now();
      if (ms > 0 && ms < 2 * 864e5) {
        const flag = `exp2_${u.username}_${String(u.expires_at).slice(0, 10)}`;
        if (!(await getSetting(env, flag))) {
          await putSetting(env, flag, '1');
          await notifyAdmin(env, ctx, `📅 <b>${esc(u.username)}</b> کمتر از ۲ روز اعتبار دارد.`,
            { reply_markup: { inline_keyboard: [[{ text: '📅 تمدید', callback_data: `usr:extend:${u.id}` }, { text: '👤 مدیریت کاربر', callback_data: `usr:view:${u.id}` }]] } });
        }
      }
    }
  }

  // ۳) چرخش خودکار آی‌پی‌های تمیز مخزن (اگر فعال باشد — بدون تغییر توکن ساب کاربران!)
  if (settings.auto_rotate === '1') {
    const minutes = Math.max(0, Number(settings.rotate_minutes || 15));
    if (minutes > 0) {
      const last = Number(await getSetting(env, 'last_rotate', '0')) || 0;
      if (Date.now() - last > minutes * 60000) {
        const offset = Math.floor(Math.random() * Math.max(1, OMNI_QOS_V4.length - 5));
        const nextClean = [
          OMNI_QOS_V4[offset % OMNI_QOS_V4.length],
          OMNI_QOS_V4[(offset + 1) % OMNI_QOS_V4.length],
          OMNI_QOS_V4[(offset + 2) % OMNI_QOS_V4.length],
          OMNI_QOS_V4[(offset + 3) % OMNI_QOS_V4.length],
          OMNI_QOS_V4[(offset + 4) % OMNI_QOS_V4.length],
          ...OMNI_CLEAN_SITES.slice(0, 3),
          ...OMNI_CLEAN_V6.slice(0, 3),
          ...OMNI_CLEAN_IR.slice(0, 2),
        ];
        await putSettingsBulk(env, {
          clean_ips: JSON.stringify(nextClean),
          ip_pool: nextClean.join('\n'),
          last_rotate: String(Date.now()),
        });
        await logEvent(env, 'info', `چرخش خودکار مخزن آی‌پی تمیز (${nextClean.length} آدرس)`);
      }
    }
  }

  // ۴) نظافت سبک
  ctx.waitUntil((async () => {
    await env.DB.prepare(`DELETE FROM logs WHERE at < datetime('now','-30 days')`).run();
    await env.DB.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
    await env.DB.prepare(`DELETE FROM signups WHERE at < datetime('now','-7 days')`).run();
  })());
}
