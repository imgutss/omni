/* Omni self-service installer — Cloudflare API token is used in-memory only. */
const CF_API = 'https://api.cloudflare.com/client/v4';
const BUNDLE_URL = 'https://raw.githubusercontent.com/imgutss/omni/main/deploy/omni-worker.bundle.js';
const BUNDLE_URLS = [
  'https://raw.githubusercontent.com/imgutss/omni/main/deploy/omni-worker.bundle.js',
  'https://cdn.jsdelivr.net/gh/imgutss/omni@main/deploy/omni-worker.bundle.js',
];

const cleanError = (data, fallback = 'cloudflare_api_error') => {
  const msgs = [...(data?.errors || []), ...(data?.messages || [])]
    .map((x) => String(x?.message || '')).filter(Boolean);
  return (msgs.join(' | ') || fallback).slice(0, 500);
};

async function cfRequest(token, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${CF_API}${path}`, { ...init, headers });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) {
    const error = new Error(cleanError(data, `Cloudflare HTTP ${response.status}`));
    error.status = response.status;
    throw error;
  }
  return data?.result;
}

export async function ensureDeploySchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS bot_deploy_sessions(
    chat_id TEXT PRIMARY KEY,
    worker_name TEXT NOT NULL,
    account_id TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS bot_deploy_audit(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    worker_name TEXT,
    ok INTEGER NOT NULL DEFAULT 0,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS bot_deploy_locks(
    chat_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
}

export async function beginDeploySession(env, chatId, workerName, accountId = '') {
  await ensureDeploySchema(env);
  const id = String(chatId);
  await env.DB.prepare(`DELETE FROM bot_deploy_locks WHERE created_at < datetime('now','-15 minutes')`).run();
  const locked = await env.DB.prepare('SELECT 1 AS active FROM bot_deploy_locks WHERE chat_id=?').bind(id).first();
  if (locked) throw new Error('یک نصب برای این گفتگو در حال اجراست؛ چند دقیقه صبر کنید.');
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS total, MAX(created_at) AS latest FROM bot_deploy_audit
     WHERE chat_id=? AND created_at > datetime('now','-24 hours')`
  ).bind(id).first();
  if (Number(recent?.total || 0) >= 5) throw new Error('سقف ۵ تلاش نصب در ۲۴ ساعت پر شده است.');
  await env.DB.prepare(
    `INSERT INTO bot_deploy_sessions(chat_id,worker_name,account_id,expires_at,created_at)
     VALUES(?,?,?,datetime('now','+10 minutes'),datetime('now'))
     ON CONFLICT(chat_id) DO UPDATE SET worker_name=excluded.worker_name,account_id=excluded.account_id,
       expires_at=excluded.expires_at,created_at=datetime('now')`
  ).bind(id, workerName, accountId || null).run();
}

export async function takeDeploySession(env, chatId) {
  await ensureDeploySchema(env);
  return env.DB.prepare(
    `DELETE FROM bot_deploy_sessions WHERE chat_id=? AND expires_at > datetime('now')
     RETURNING chat_id,worker_name,account_id`
  ).bind(String(chatId)).first();
}

export async function acquireDeployLock(env, chatId) {
  await ensureDeploySchema(env);
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO bot_deploy_locks(chat_id,created_at) VALUES(?,datetime('now'))`
  ).bind(String(chatId)).run();
  return Number(result?.meta?.changes || 0) === 1;
}

export async function releaseDeployLock(env, chatId) {
  await ensureDeploySchema(env);
  await env.DB.prepare('DELETE FROM bot_deploy_locks WHERE chat_id=?').bind(String(chatId)).run();
}

export async function cancelDeploySession(env, chatId) {
  await ensureDeploySchema(env);
  await env.DB.prepare('DELETE FROM bot_deploy_sessions WHERE chat_id=?').bind(String(chatId)).run();
}

export async function peekDeploySession(env, chatId) {
  await ensureDeploySchema(env);
  return env.DB.prepare(
    `SELECT chat_id,worker_name,account_id FROM bot_deploy_sessions
     WHERE chat_id=? AND expires_at > datetime('now')`
  ).bind(String(chatId)).first();
}

export async function auditDeploy(env, chatId, workerName, ok, detail = '') {
  await ensureDeploySchema(env);
  await env.DB.prepare(
    `INSERT INTO bot_deploy_audit(chat_id,worker_name,ok,detail) VALUES(?,?,?,?)`
  ).bind(String(chatId), workerName || null, ok ? 1 : 0, String(detail || '').slice(0, 300)).run();
}

async function resolveAccount(token, requestedId = '') {
  if (requestedId) return requestedId;
  const accounts = await cfRequest(token, '/accounts?per_page=20');
  if (!Array.isArray(accounts) || !accounts.length) throw new Error('هیچ اکانت Cloudflare در دسترس این توکن نیست.');
  // در جریان ساده نصب، اولین اکانت قابل‌دسترسی انتخاب می‌شود؛ کاربر فقط توکن را می‌فرستد.
  return accounts[0].id;
}

async function scriptExists(token, accountId, workerName) {
  try {
    await cfRequest(token, `/accounts/${accountId}/workers/scripts/${workerName}/settings`);
    return true;
  } catch (e) {
    if (e?.status === 404) return false;
    throw e;
  }
}

export async function deployOmniToAccount({ token, requestedAccountId = '', workerName, origin = '' }) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(workerName)) throw new Error('نام Worker باید انگلیسی کوچک، عدد یا خط تیره و حداکثر ۶۳ کاراکتر باشد.');
  if (!/^[A-Za-z0-9_\-]{20,300}$/.test(token)) throw new Error('ساختار API Token معتبر نیست.');

  await cfRequest(token, '/user/tokens/verify');
  const accountId = await resolveAccount(token, requestedAccountId);
  if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new Error('Account ID معتبر نیست.');
  if (await scriptExists(token, accountId, workerName)) throw new Error('Worker با این نام از قبل وجود دارد؛ یک نام تازه انتخاب کنید تا چیزی بازنویسی نشود.');

  let databaseId = '';
  let workerUploaded = false;
  try {
    const db = await cfRequest(token, `/accounts/${accountId}/d1/database`, {
      method: 'POST', body: JSON.stringify({ name: `${workerName}-db-${crypto.randomUUID().slice(0, 6)}` }),
    });
    databaseId = db?.uuid || db?.id;
    if (!databaseId) throw new Error('Cloudflare شناسه D1 برنگرداند.');

    // Fixed 1101 root: fetch from origin bundle proxy with fallbacks
    let bundle = '';
    const candidates = origin ? [`${origin.replace(/\/+$/, '')}/bundle`, `${origin.replace(/\/+$/, '')}/deploy/omni-worker.bundle.js`] : [];
    candidates.push(...BUNDLE_URLS);
    let lastErr = null;
    for (const u of candidates) {
      try { const r = await fetch(u, { cf: { cacheTtl: 0, cacheEverything: false } }); if (!r.ok) { lastErr = new Error(`HTTP ${r.status} from ${u}`); continue; } const t = await r.text(); if (t.length < 100000 || !t.includes('cloudflare:sockets')) { lastErr = new Error(`bundle incomplete from ${u}`); continue; } bundle = t; break; } catch(e) { lastErr = e; continue; }
    }
    if (!bundle) throw new Error('دریافت بسته نصب Omni ناموفق بود: ' + (lastErr?.message || ''));

    const webhookSecret = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    const metadata = {
      main_module: 'worker.js',
      compatibility_date: '2024-09-23',
      compatibility_flags: ['nodejs_compat'],
      bindings: [
        { type: 'd1', name: 'DB', id: databaseId },
        { type: 'plain_text', name: 'PANEL_NAME', text: 'Omni' },
        { type: 'plain_text', name: 'BOT_WEBHOOK_SECRET', text: webhookSecret },
        { type: 'plain_text', name: 'BOT_USERNAME', text: '' },
      ],
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
    form.append('worker.js', new Blob([bundle], { type: 'application/javascript+module' }), 'worker.js');
    await cfRequest(token, `/accounts/${accountId}/workers/scripts/${workerName}`, { method: 'PUT', body: form });
    workerUploaded = true;

    await cfRequest(token, `/accounts/${accountId}/workers/scripts/${workerName}/subdomain`, {
      method: 'POST', body: JSON.stringify({ enabled: true, previews_enabled: false }),
    });
    // Cron is useful but non-critical; some restricted tokens intentionally omit this permission.
    try {
      await cfRequest(token, `/accounts/${accountId}/workers/scripts/${workerName}/schedules`, {
        method: 'PUT', body: JSON.stringify([{ cron: '*/5 * * * *' }]),
      });
    } catch { /* panel remains fully usable without Cron */ }

    let workersSubdomain = '';
    try {
      const sub = await cfRequest(token, `/accounts/${accountId}/workers/subdomain`);
      workersSubdomain = sub?.subdomain || '';
    } catch { /* return dashboard URL below */ }
    const panelUrl = workersSubdomain ? `https://${workerName}.${workersSubdomain}.workers.dev` : '';
    const dashboardUrl = `https://dash.cloudflare.com/${accountId}/workers/services/view/${workerName}/production`;
    return { accountId, databaseId, workerName, panelUrl, dashboardUrl };
  } catch (error) {
    if (workerUploaded) {
      try { await cfRequest(token, `/accounts/${accountId}/workers/scripts/${workerName}`, { method: 'DELETE' }); } catch { /* best effort */ }
    }
    if (databaseId) {
      try { await cfRequest(token, `/accounts/${accountId}/d1/database/${databaseId}`, { method: 'DELETE' }); } catch { /* best effort */ }
    }
    throw error;
  }
}
