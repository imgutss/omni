/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/bot.js
   ربات تلگرام: مدیریت کامل کاربران، گزارش‌ها، اسکن آی‌پی، اعلان‌ها
   (هم وب‌هوک و هم حالت پولینگ با کرون — بدون سرور اضافه)
   ══════════════════════════════════════════════════════════════════════════ */
import { allSettings, putSetting, getSetting, logEvent, randomToken, randomUuid, ensureSchema, settingsCached } from './auth.js';
import { buildConfigs, FRAGMENT_PRESETS } from './links.js';
import { rankIpsHttp, SEED_IPS, httpProbe, tcpProbe, CF_GOOD_IPS, PORTS_PLAIN, PORTS_TLS } from './scan.js';
import { safeJsonArray } from './core.js';

const GB = 1024 ** 3;
const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
export const fmtBytes = (b) => {
  b = Number(b) || 0;
  if (b < 1024) return b + ' B';
  const u = ['KB', 'MB', 'GB', 'TB']; let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return `${b.toFixed(b >= 100 ? 0 : 2)} ${u[i]}`;
};

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
  const text = (update.message?.text || '').trim();
  const [rawCmd, ...args] = text.split(/\s+/);
  const cmd = (rawCmd || '').split('@')[0].toLowerCase();

  const send = (t, opts = {}) => tgApi(env, 'sendMessage', { chat_id: chatId, text: t, parse_mode: 'HTML', disable_web_page_preview: true, ...opts });

  /* pairing */
  if (cmd === '/pair') {
    const code = String(args[0] || '').trim();
    const expected = settings.bot_pair_code;
    if (!expected) return send('ℹ️ کدی برای اتصال ساخته نشده. از پنل → بخش ربات → «ساخت کد اتصال» بگیر.');
    if (code !== String(expected)) return send('❌ کد نادرست است.');
    await putSetting(env, 'admin_chat_id', chatId);
    await putSetting(env, 'bot_pair_code', '');
    await logEvent(env, 'info', `ربات به مدیر متصل شد (chat ${chatId})`);
    return send('✅ ربات به پنل <b>Omni</b> متصل شد!\nحالا می‌توانی از همین‌جا کاربران را مدیریت کنی.\n\n/help');
  }

  if (!adminChat) {
    return send('👋 سلام!\nاین ربات مدیریت پنل <b>Omni</b> است.\nبرای اتصال، در پنل وب بخش «ربات» را باز کن و کد اتصال را بگیر، سپس بفرست:\n<code>/pair کد</code>');
  }
  if (String(chatId) !== String(adminChat)) {
    return send('⛔️ این ربات فقط برای مدیر پنل است.');
  }

  const kb = { inline_keyboard: [[{ text: '🌐 باز کردن پنل در مرورگر', url: `${origin}/` }]] };
  if (cmd.startsWith('/')) ctx?.waitUntil?.(logEvent(env, 'info', `دستور ربات: ${cmd} از ${chatId}`).catch(() => {}));

  switch (cmd) {
    case '/start':
    case '/help':
      return send(
        `⚡️ <b>Omni — مدیریت پنل</b>\n\n` +
        `<b>کاربران</b>\n` +
        `/list — لیست کاربران\n` +
        `/new نام 50 30 — ساخت کاربر (نام، گیگ، روز)\n` +
        `/link نام — ساب‌لینک + QR\n` +
        `/reset نام — ریست حجم\n` +
        `/extend نام 30 — تمدید\n` +
        `/toggle نام — فعال/غیرفعال\n` +
        `/del نام — حذف\n` +
        `/note نام متن — یادداشت\n\n` +
        `<b>سیستم</b>\n` +
        `/stats — آمار کلی\n` +
        `/ips — آی‌پی‌های تمیز ذخیره‌شده\n` +
        `/scan — اسکن آی‌پی تمیز\n` +
        `/ping — سلامتی سرویس\n` +
        `/notify متن — ارسال پیام به کانال اعلان‌ها\n` +
        `/panel — لینک پنل`,
        { reply_markup: kb });
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
      if (!rows.results?.length) return send('هنوز کاربری نساخته‌ای.\nمثال: <code>/new ali 50 30</code>');
      const lines = rows.results.map((u) => {
        const used = (u.up_bytes || 0) + (u.down_bytes || 0);
        const quota = Number(u.quota_bytes || 0);
        const left = u.expires_at ? Math.max(0, Math.floor((new Date(String(u.expires_at).replace(' ', 'T') + 'Z') - Date.now()) / 864e5)) : '∞';
        const icon = !u.is_active ? '🔴' : (quota > 0 && used >= quota) ? '⛔️' : '🟢';
        return `${icon} <b>${esc(u.username)}</b> — ${fmtBytes(used)}${quota ? '/' + fmtBytes(quota) : ''} — ${left} روز`;
      });
      return send(`👥 <b>کاربران</b> (${rows.results.length})\n\n${lines.join('\n')}`);
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
      if (!rows.results?.length) return send('هنوز آی‌پی تمیزی ذخیره نشده. /scan را بزن یا از کاربرانت بخواه در صفحه‌ی وضعیت، دکمه‌ی «تست روی دستگاه من» را بزنند.');
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
        `<b>نتیجه‌ی اسکن</b> (${edge.length} پاسخ از ${pool.length}${validated.length ? ` — ${validated.length} تأییدشده` : ''})\n\n` +
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
      if (text.startsWith('/')) return send('دستور ناشناخته. /help');
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
          `⚠️ <b>${esc(u.username)}</b> به ۸۰٪ حجم رسید.\n${fmtBytes(used)} از ${fmtBytes(quota)}\n\n/extend ${u.username} 30`);
      }
    }
    if (quota > 0 && used >= quota) {
      const flag = `over_${u.username}_${new Date().toISOString().slice(0, 10)}`;
      if (!(await getSetting(env, flag))) {
        await putSetting(env, flag, '1');
        await notifyAdmin(env, ctx, `⛔️ <b>${esc(u.username)}</b> به سقف حجم رسید و اتصالش قطع شد.\n/link ${u.username}`);
      }
    }
    if (u.expires_at) {
      const ms = new Date(String(u.expires_at).replace(' ', 'T') + 'Z').getTime() - Date.now();
      if (ms > 0 && ms < 2 * 864e5) {
        const flag = `exp2_${u.username}_${String(u.expires_at).slice(0, 10)}`;
        if (!(await getSetting(env, flag))) {
          await putSetting(env, flag, '1');
          await notifyAdmin(env, ctx, `📅 <b>${esc(u.username)}</b> کمتر از ۲ روز اعتبار دارد.\n/extend ${u.username} 30`);
        }
      }
    }
  }

  // ۳) چرخش خودکار توکن (اگر فعال باشد)
  if (settings.auto_rotate === '1') {
    const minutes = Math.max(0, Number(settings.rotate_minutes || 0));
    if (minutes > 0) {
      const last = Number(await getSetting(env, 'last_rotate', '0')) || 0;
      if (Date.now() - last > minutes * 60000) {
        const rows = await env.DB.prepare('SELECT username FROM users LIMIT 200').all();
        for (const r of (rows.results || [])) {
          await env.DB.prepare('UPDATE users SET sub_token = ? WHERE username = ?').bind(randomToken(18), r.username).run();
        }
        await putSetting(env, 'last_rotate', Date.now());
        await logEvent(env, 'warn', `چرخش خودکار توکن ساب برای ${rows.results?.length || 0} کاربر`);
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
