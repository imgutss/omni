/* ══════════════════════════════════════════════════════════════════════════
   Omni — deploy/deploy.mjs
   ساخت D1 + دیپلوی روی Cloudflare Workers + تنظیم رمزها + وب‌هوک ربات تلگرام
   اجرا:  node deploy/deploy.mjs          (یا: npm run deploy:auto)
   ══════════════════════════════════════════════════════════════════════════ */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const ENV_PATH = process.env.OMNI_ENV || resolve(ROOT, '..', 'cfpanel', '.env');
const WRANGLER = resolve(ROOT, 'wrangler.toml');
const CF_API = 'https://api.cloudflare.com/client/v4';

/* ───────────── خواندن .env ───────────── */
function loadEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim().replace(/^["']|["']$/g, '');
    if (v === '') continue;
    out[m[1]] = v;
  }
  return out;
}
const env = { ...loadEnv(ENV_PATH), ...process.env };
const CF_TOKEN = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN;
const BOT_TOKEN = env.BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;
const rawChatId = env.ADMIN_CHAT_ID || env.ADMIN_TG_IDS || '';
const ADMIN_CHAT_ID = (rawChatId === '123456789' || rawChatId === '8883603563') ? '' : rawChatId;
if (!CF_TOKEN) { console.error('✖ CF_API_TOKEN پیدا نشد (در ' + ENV_PATH + ')'); process.exit(1); }

const log = (...a) => console.log('▸', ...a);
const ok = (...a) => console.log('  ✅', ...a);
const warn = (...a) => console.log('  ⚠️ ', ...a);

async function cf(path, init = {}) {
  const r = await fetch(CF_API + path, {
    ...init,
    headers: { authorization: `Bearer ${CF_TOKEN}`, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const j = await r.json().catch(() => null);
  return { status: r.status, ok: r.ok, json: j };
}

function run(cmd, args, { stdin, cwd = ROOT, env: extra = {} } = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, ...extra }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
    p.stderr.on('data', (d) => { err += d; process.stderr.write(d); });
    p.on('error', rej);
    p.on('close', (code) => (code === 0 ? res(out) : rej(new Error(`«${cmd} ${args.join(' ')}» با کد ${code} تمام شد\n${err.slice(-1200)}`))));
    if (stdin !== undefined) { p.stdin.write(stdin); p.stdin.end(); } else p.stdin.end();
  });
}

/* ───────────── ۱) حساب کلودفلر ───────────── */
log('بررسی توکن کلودفلر…');
{
  const v = await cf('/user/tokens/verify');
  if (!v.json?.result?.status === 'active' && !v.ok) { console.error('✖ توکن کلودفلر معتبر نیست:', JSON.stringify(v.json)); process.exit(1); }
  ok('توکن معتبر است');
}
let accountId = env.CLOUDFLARE_ACCOUNT_ID || '';
if (!accountId) {
  const acc = await cf('/accounts');
  accountId = acc.json?.result?.[0]?.id;
  if (!accountId) { console.error('✖ حساب کلودفلر پیدا نشد:', JSON.stringify(acc.json)); process.exit(1); }
}
ok('حساب کلودفلر: ' + accountId);

/* ───────────── ۲) ساخت (یا یافتن) دیتابیس D1 ───────────── */
const DB_NAME = 'omni-db';
log(`دیتابیس D1 «${DB_NAME}»…`);
let databaseId = '';
{
  const list = await cf(`/accounts/${accountId}/d1/database`);
  const found = (list.json?.result || []).find((d) => d.name === DB_NAME);
  if (found) { databaseId = found.uuid; ok('دیتابیس موجود است: ' + databaseId); }
  else {
    const c = await cf(`/accounts/${accountId}/d1/database`, { method: 'POST', body: JSON.stringify({ name: DB_NAME, primary_location_hint: 'weur' }) });
    databaseId = c.json?.result?.uuid || '';
    if (!databaseId) { console.error('✖ ساخت دیتابیس ناموفق:', JSON.stringify(c.json)); process.exit(1); }
    ok('دیتابیس ساخته شد: ' + databaseId);
  }
}

/* ───────────── ۳) تنظیم wrangler.toml ───────────── */
{
  let t = readFileSync(WRANGLER, 'utf8');
  t = t.replace(/database_id\s*=\s*"[^"]*"/, `database_id = "${databaseId}"`);
  writeFileSync(WRANGLER, t);
  ok('wrangler.toml → database_id به‌روزرسانی شد');
}

/* ───────────── ۴) دیپلوی ───────────── */
log('دیپلوی روی Cloudflare Workers…');
let workerUrl = '';
{
  const out = await run('npx', ['wrangler', 'deploy', '--config', WRANGLER], {
    env: { CLOUDFLARE_API_TOKEN: CF_TOKEN, CLOUDFLARE_ACCOUNT_ID: accountId },
  });
  const m = out.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/);
  workerUrl = m ? m[0] : '';
  if (!workerUrl) { console.error('✖ آدرس ورکر از خروجی wrangler پیدا نشد'); process.exit(1); }
  ok('ورکر منتشر شد: ' + workerUrl);
}

/* ───────────── ۵) رمزها (Secret) ───────────── */
log('تنظیم رمزهای ورکر…');
const putSecret = async (name, value) => {
  if (!value) return warn(`${name} خالی است — رد شد`);
  await run('npx', ['wrangler', 'secret', 'put', name, '--config', WRANGLER], {
    stdin: String(value) + '\n',
    env: { CLOUDFLARE_API_TOKEN: CF_TOKEN, CLOUDFLARE_ACCOUNT_ID: accountId },
  });
  ok(`secret ${name} تنظیم شد`);
};
await putSecret('BOT_TOKEN', BOT_TOKEN);
if (ADMIN_CHAT_ID) await putSecret('ADMIN_CHAT_ID', ADMIN_CHAT_ID);

/* ───────────── ۶) بیدارکردن ورکر (bootstrap: public_host) ───────────── */
log('راه‌اندازی اولیه‌ی پنل…');
{
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(workerUrl + '/api/whoami', { headers: { 'user-agent': 'omni-deploy' } });
      const j = await r.json();
      if (j?.ok) { ok('پنل زنده است (installed=' + j.installed + '، نام=' + j.panelName + ')'); break; }
    } catch (e) { warn('تلاش ' + (i + 1) + ': ' + e.message); }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

/* ───────────── ۷) وب‌هوک و منوی ربات تلگرام ───────────── */
if (BOT_TOKEN) {
  log('تنظیم ربات تلگرام…');
  const hookSecret = (readFileSync(WRANGLER, 'utf8').match(/BOT_WEBHOOK_SECRET\s*=\s*"([^"]*)"/) || [])[1] || 'omni-hook';
  const hookUrl = `${workerUrl}/tg/${hookSecret}`;
  const tg = async (method, payload) => {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload || {}),
    });
    return r.json();
  };
  const me = await tg('getMe');
  if (me?.ok) ok('ربات: @' + me.result.username);
  await tg('deleteWebhook', { drop_pending_updates: true });
  const sw = await tg('setWebhook', {
    url: hookUrl,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
    max_connections: 40,
  });
  if (sw?.ok) ok('وب‌هوک: ' + hookUrl);
  else warn('وب‌هوک ست نشد: ' + JSON.stringify(sw));
  const cmds = await tg('setMyCommands', {
    commands: [
      { command: 'help', description: 'راهنمای دستورات' },
      { command: 'list', description: 'لیست کاربران' },
      { command: 'new', description: 'ساخت کاربر' },
      { command: 'link', description: 'ساب‌لینک کاربر' },
      { command: 'stats', description: 'آمار کلی' },
      { command: 'scan', description: 'اسکن آی‌پی تمیز' },
      { command: 'ips', description: 'آی‌پی‌های تمیز' },
      { command: 'ping', description: 'سلامت سرویس' },
      { command: 'panel', description: 'لینک پنل' },
    ],
  });
  if (cmds?.ok) ok('منوی دستورات ثبت شد');
  const info = await tg('getWebhookInfo');
  if (info?.ok) ok('وضعیت وب‌هوک: ' + (info.result.url || '—') + (info.result.last_error_message ? ' | خطا: ' + info.result.last_error_message : ''));
  const chatLooksReal = /^-?\d{5,}$/.test(String(ADMIN_CHAT_ID)) && String(ADMIN_CHAT_ID) !== '123456789';
  if (!chatLooksReal) warn('ADMIN_CHAT_ID معتبر نیست — ربات با دستور /pair به پنل وصل می‌شود');
  if (chatLooksReal) await tg('sendMessage', {
    chat_id: ADMIN_CHAT_ID,
    text:
      `🚀 <b>Omni روی Cloudflare اجرا شد!</b>\n\n` +
      `🌐 پنل: ${workerUrl}\n` +
      `📡 وب‌هوک ربات: فعال\n\n` +
      `برای اتصال ربات: در پنل → بخش ربات → «ساخت کد اتصال»، سپس اینجا:\n` +
      `<code>/pair کد</code>`,
    parse_mode: 'HTML',
  }).catch(() => {});
}

/* ───────────── خلاصه ───────────── */
console.log(`
╔══════════════════════════════════════════════════════════════╗
   ✅ Omni منتشر شد
   🌐 پنل      : ${workerUrl}
   🔧 API      : ${workerUrl}/api/whoami
   📱 ربات     : ${workerUrl}/tg/{secret}
   🗄  D1       : ${DB_NAME} (${databaseId})
   🔑 نصب پنل  : پنل را باز کن → نام کاربری/رمز مدیر را بساز
   🤖 اتصال ربات: در پنل → «ربات» → ساخت کد اتصال، سپس در تلگرام: /pair کد
╚══════════════════════════════════════════════════════════════╝
`);
