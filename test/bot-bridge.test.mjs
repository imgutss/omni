/* Node harness that drives the real bot handler from production/worker.js.
   api.telegram.org is stubbed in-memory, api.vercel.com is the real thing
   (called with a deliberately dead token so nothing is ever created).
   Run: node test/bot-bridge.test.mjs                                           */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// A syntactically valid but non-existent token: real enough for api.vercel.com to
// answer "Not authorized", and no credential lives in this repository.
const DEAD_VERCEL_TOKEN = process.env.OMNI_TEST_VERCEL_TOKEN || 'cfut_dead000000000000000000000000000000000000';
const CHAT = 111222333;

/* ── load the canonical worker as an ES module ───────────────────────────── */
let bundle = fs.readFileSync(path.join(root, 'production/worker.js'), 'utf8');
// `cloudflare:sockets` only exists inside workerd; the bot flow never touches it.
bundle = bundle.replace(/import \{ connect( as connect\d)? \} from "cloudflare:sockets";/g,
  (m, alias) => `const ${(alias || 'connect').replace(/^\s*as\s+/, '').trim()} = () => { throw new Error("sockets stub"); };`);
bundle = bundle.replace(/await import\("cloudflare:sockets"\)/g,
  '{ connect: () => { throw new Error("sockets stub"); } }');
assert.ok(!/import[^;]*cloudflare:sockets/.test(bundle) && !/import\("cloudflare:sockets"\)/.test(bundle),
  'a sockets import survived the rewrite');
// the bundle only default-exports {fetch, scheduled}; re-export the bot internals
bundle += '\nexport { handleUpdate, drainUpdates, syncCreatorCommands, scheduledTasks };\n';
const tmp = path.join('/tmp', `omni-bot-harness-${process.pid}.mjs`);
fs.writeFileSync(tmp, bundle);
const W = await import(pathToFileURL(tmp).href);
const worker = W.default || W;
assert.equal(typeof W.handleUpdate, 'function', 'handleUpdate is not exported by the bundle');
const handleUpdate = W.handleUpdate;

/* ── in-memory D1 ────────────────────────────────────────────────────────── */
const db = (() => {
  const T = {
    settings: {}, logs: [], bot_ui_sessions: {}, bot_panels: [], bot_bridge: [],
    bot_tok_cache: {}, bot_deploy_sessions: {}, bot_deploy_locks: {}, bot_deploy_audit: [],
    bot_bridges: [], bot_bridge_tokens: {}, accounts: [], users: [], signups: [],
    clean_ips: [], sessions: {},
  };
  let bridgeId = 0;
  const stmt = (sql) => {
    const q = sql.replace(/\s+/g, ' ').trim();
    const st = {
      _p: [],
      bind(...p) { st._p = p; return st; },
      async run() {
        if (/^CREATE (TABLE|INDEX)/i.test(q)) return { meta: {} };
        if (/^INSERT INTO settings/i.test(q)) { T.settings[st._p[0]] = st._p[1]; return { meta: { changes: 1 } }; }
        if (/^INSERT INTO logs/i.test(q)) { T.logs.push(st._p[1]); return { meta: {} }; }
        if (/^INSERT INTO bot_panels/i.test(q)) { T.bot_panels.push({ id: T.bot_panels.length + 1, owner_chat_id: st._p[0], worker_name: st._p[1], panel_url: st._p[2], status: 'healthy' }); return { meta: { last_row_id: T.bot_panels.length } }; }
        if (/^UPDATE bot_panels/i.test(q)) return { meta: {} };
        if (/^INSERT INTO bot_ui_sessions/i.test(q)) { T.bot_ui_sessions[String(st._p[0])] = { state: st._p[1], data: st._p[2] }; return { meta: {} }; }
        if (/^DELETE FROM bot_ui_sessions/i.test(q)) { delete T.bot_ui_sessions[String(st._p[0])]; return { meta: {} }; }
        if (/^INSERT INTO bot_tok_cache/i.test(q)) { T.bot_tok_cache[String(st._p[0])] = st._p[1]; return { meta: {} }; }
        if (/^DELETE FROM bot_tok_cache/i.test(q)) { delete T.bot_tok_cache[String(st._p[0])]; return { meta: {} }; }
        if (/^INSERT INTO bot_bridge_tokens/i.test(q)) { T.bot_bridge_tokens[st._p[0]] = { platform: st._p[1], token: st._p[2] }; return { meta: {} }; }
        if (/^DELETE FROM bot_bridge_tokens/i.test(q)) { delete T.bot_bridge_tokens[st._p[0]]; return { meta: {} }; }
        if (/^INSERT INTO bot_bridges/i.test(q)) {
          const row = { id: ++bridgeId, owner: st._p[0], platform: st._p[1], name: st._p[2], project_id: null, deployment_id: null, domain: null, url: null, target_host: st._p[3], tunnel_path: st._p[4], status: st._p[5], error: null, token_ref: st._p[6], dashboard_url: null, created_at: 'now', updated_at: 'now' };
          T.bot_bridges.push(row);
          return { meta: { last_row_id: row.id } };
        }
        if (/^UPDATE bot_bridges SET/i.test(q)) {
          const id = Number(st._p[st._p.length - 1]);
          const cols = q.slice(q.indexOf('SET ') + 4, q.lastIndexOf(' WHERE')).split(',').map((x) => x.replace('=?', '').trim());
          const row = T.bot_bridges.find((r) => r.id === id);
          if (row) cols.forEach((c, i) => { if (!c.includes('updated_at')) row[c] = st._p[i]; });
          return { meta: {} };
        }
        if (/^DELETE FROM bot_bridges/i.test(q)) { T.bot_bridges = T.bot_bridges.filter((r) => r.id !== Number(st._p[0])); return { meta: {} }; }
        if (/^DELETE FROM bot_deploy_locks/i.test(q)) return { meta: {} };
        if (/^INSERT OR IGNORE INTO bot_deploy_locks/i.test(q)) return { meta: { changes: 1 } };
        if (/^INSERT INTO bot_deploy_sessions/i.test(q)) return { meta: {} };
        if (/^DELETE FROM bot_deploy_sessions/i.test(q)) return { meta: {} };
        if (/^INSERT INTO bot_deploy_audit/i.test(q)) return { meta: {} };
        return { meta: {} };
      },
      async first() {
        if (/FROM settings WHERE key/i.test(q)) return T.settings[st._p[0]] !== undefined ? { value: T.settings[st._p[0]] } : null;
        if (/FROM bot_ui_sessions/i.test(q)) { const r = T.bot_ui_sessions[String(st._p[0])]; return r ? { state: r.state, data: r.data } : null; }
        if (/FROM bot_tok_cache/i.test(q)) return T.bot_tok_cache[String(st._p[0])] ? { token: T.bot_tok_cache[String(st._p[0])] } : null;
        if (/FROM bot_bridge_tokens/i.test(q)) return T.bot_bridge_tokens[st._p[0]] || null;
        if (/FROM bot_bridges WHERE id=/i.test(q)) return T.bot_bridges.find((r) => r.id === Number(st._p[0])) || null;
        if (/FROM bot_panels WHERE panel_url IS NOT NULL/i.test(q)) return [...T.bot_panels].reverse().find((p) => p.panel_url) || null;
        if (/FROM bot_deploy_locks/i.test(q)) return null;
        if (/FROM accounts/i.test(q)) return null;
        if (/SELECT COUNT/i.test(q)) return { c: 0, total: 0 };
        return null;
      },
      async all() {
        if (/FROM bot_bridges WHERE owner=/i.test(q)) return { results: T.bot_bridges.filter((r) => r.owner === String(st._p[0])) };
        if (/FROM bot_bridges/i.test(q)) return { results: T.bot_bridges };
        if (/FROM settings/i.test(q)) return { results: Object.entries(T.settings).map(([key, value]) => ({ key, value })) };
        return { results: [] };
      },
    };
    return st;
  };
  return { prepare: stmt, batch: async (list) => { for (const s of list) await s.run(); return []; }, _T: T };
})();

/* ── Telegram stub + real Vercel/Netlify passthrough ─────────────────────── */
const tg = [];
const cf = [];
const CF = cf;                       // Cloudflare API calls made by the bot
const PANEL_SETTINGS = { path: '/TUNNEL42' };
const HISTORY = tg;   // never truncated, so command registration can be checked at the end
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith('https://api.telegram.org/')) {
    const method = u.split('/').pop().split('?')[0];
    const payload = init?.body ? JSON.parse(init.body) : {};
    tg.push({ method, payload });
    let result = true;
    if (method === 'getWebhookInfo') result = { url: '', pending_update_count: 0 };
    else if (method === 'sendMessage') result = { message_id: tg.length + 100, chat: { id: payload.chat_id }, text: payload.text };
    else if (method === 'editMessageText') result = { message_id: payload.message_id, chat: { id: payload.chat_id }, text: payload.text };
    return { ok: true, status: 200, json: async () => ({ ok: true, result }), text: async () => JSON.stringify({ ok: true, result }) };
  }
  if (u.startsWith('https://api.cloudflare.com/')) {
    const body = init?.body ? JSON.parse(init.body) : {};
    CF.push({ url: u, body });
    // the D1 REST query endpoint wraps its rows in a success envelope; the
    // worker's panelD1Query only reads `.results` for that shape
    const rows = /FROM settings WHERE key/i.test(String(body.sql || ''))
      ? [{ value: PANEL_SETTINGS[String(body.params?.[0] ?? '')] ?? null }]
      : [];
    const payload = { success: true, meta: {}, results: rows };
    return {
      ok: true, status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    };
  }
  return realFetch(url, init);
};

const env = {
  DB: db,
  RELEASES: { get: async () => null, put: async () => {}, list: async () => ({ keys: [] }), delete: async () => {} },
  BOT_TOKEN: 'stub-token',
  BOT_WEBHOOK_SECRET: 'omni-hook',
  BOT_USERNAME: 'OmniAiGateBot',
  PANEL_NAME: 'Omni',
};
const ctx = { waitUntil: (p) => { Promise.resolve(p).catch(() => {}); } };

/* ── driver ──────────────────────────────────────────────────────────────── */
const results = [];
const t = async (name, fn) => {
  try { await fn(); results.push(`✅ ${name}`); }
  catch (e) { results.push(`❌ ${name}: ${e.message}`); process.exitCode = 1; }
};
const send = (text) => handleUpdate(env, ctx, 'https://omni.local', { update_id: Date.now(), message: { message_id: Math.floor(Math.random() * 1e6), text, chat: { id: CHAT, type: 'private' } } });
const tap = (data) => handleUpdate(env, ctx, 'https://omni.local', { update_id: Date.now(), callback_query: { id: 'c' + Math.random(), data, message: { message_id: 5, chat: { id: CHAT, type: 'private' } } } });
const lastText = () => {
  for (let i = tg.length - 1; i >= 0; i--) if (tg[i].payload?.text) return tg[i].payload.text;
  return '';
};
const strip = (s) => String(s).replace(/<[^>]+>/g, '');

await t('the bundle exports the bot handler and boots its schema', async () => {
  await send('/start');
  assert.ok(tg.some((c) => c.method === 'sendMessage'), 'the bot never answered /start');
});

await t('/natbridge explains the token flow and offers both platforms', async () => {
  tg.length = 0;
  await send('/natbridge');
  const text = strip(lastText());
  assert.ok(text.includes('پل ابری نت ملی'), 'menu text missing: ' + text.slice(0, 120));
  const kb = tg.at(-1).payload.reply_markup.inline_keyboard.flat();
  // live relays only (vercel/netlify are edge-blocked since 2026-10-09): deno + render
  assert.ok(kb.some((b) => b.callback_data === 'cmd:nb_deno'));
  assert.ok(kb.some((b) => b.callback_data === 'cmd:nb_render'));
});

await t('without a panel the bot refuses to guess a target', async () => {
  tg.length = 0;
  await tap('cmd:nb_vercel');
  assert.ok(strip(lastText()).includes('هیچ پنلی'));
});

await t('with a panel registered it offers project names and the real target', async () => {
  await db.prepare('INSERT INTO bot_panels(owner_chat_id,worker_name,panel_url) VALUES(?,?,?)').bind(String(CHAT), 'omni', 'https://omni-panel.workers.dev').run();
  tg.length = 0;
  await tap('cmd:nb_vercel');
  const text = strip(lastText());
  assert.ok(text.includes('omni-panel.workers.dev'), 'target missing: ' + text.slice(0, 160));
  const kb = tg.at(-1).payload.reply_markup.inline_keyboard.flat();
  assert.ok(kb.some((b) => String(b.callback_data).startsWith('nbname:vercel:')), 'no name buttons');
  assert.ok(kb.some((b) => String(b.text).includes('نام دلخواه')));
});

await t('choosing a name asks for the token with the exact Vercel link', async () => {
  tg.length = 0;
  await tap('nbname:vercel:omni-smoke-tg');
  const text = strip(lastText());
  assert.ok(text.includes('vercel.com/account/tokens'), text.slice(0, 200));
  assert.equal(db._T.bot_ui_sessions[String(CHAT)].state, 'bridge_token');
  const data = JSON.parse(db._T.bot_ui_sessions[String(CHAT)].data);
  assert.equal(data.platform, 'vercel');
  assert.equal(data.target, 'omni-panel.workers.dev');
  assert.equal(data.name, 'omni-smoke-tg');
});

await t('a malformed token is rejected and the session survives', async () => {
  tg.length = 0;
  await send('short');
  assert.ok(strip(lastText()).includes('ساختار توکن'));
  assert.equal(db._T.bot_ui_sessions[String(CHAT)]?.state, 'bridge_token');
  assert.ok(!tg.some((c) => c.method === 'deleteMessage'), 'a rejected token must not be treated as consumed');
});

await t('/cancel leaves the flow', async () => {
  await send('/cancel');
  assert.equal(db._T.bot_ui_sessions[String(CHAT)], undefined);
});

await t('a real dead token is deleted from the chat, deployed and reported', async () => {
  tg.length = 0;
  await tap('nbname:vercel:omni-smoke-live');
  await send(DEAD_VERCEL_TOKEN);
  assert.ok(tg.some((c) => c.method === 'deleteMessage'), 'the token message was left in the chat');
  const texts = tg.filter((c) => c.method === 'editMessageText').map((c) => strip(c.payload.text));
  assert.ok(texts.some((x) => x.includes('بررسی توکن')), 'no progress edit: ' + JSON.stringify(texts).slice(0, 300));
  const final = texts.at(-1) || strip(lastText());
  assert.ok(final.includes('ناموفق'), 'the failure was not reported: ' + final.slice(0, 200));
  assert.ok(final.includes('Not authorized'), 'the upstream reason is missing');
  assert.ok(final.includes('vercel.com/account/tokens'), 'no hint where to get a working token');
});

await t('the failed attempt is stored on the chat and listed by /natbridge list', async () => {
  const rows = db._T.bot_bridges.filter((r) => r.owner === `bot:${CHAT}`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'failed');
  assert.equal(rows[0].platform, 'vercel');
  assert.equal(rows[0].target_host, 'omni-panel.workers.dev');
  assert.equal(rows[0].tunnel_path, '/VZLdh9Ft');
  assert.ok(rows[0].error.includes('Not authorized'));
  tg.length = 0;
  await send('/natbridge list');
  assert.ok(strip(lastText()).includes('پل‌های ابری تو'));
});

await t('an unconnected panel falls back to the default tunnel path', async () => {
  tg.length = 0;
  await send('/cancel');
  tg.length = 0;
  await tap('nbname:vercel:omni-smoke-fallback');
  assert.equal(JSON.parse(db._T.bot_ui_sessions[String(CHAT)].data).path, '/VZLdh9Ft');
  assert.ok(strip(lastText()).includes('/VZLdh9Ft'));
  assert.equal(cf.length, 0, 'it must not call Cloudflare for a panel it cannot manage');
});

await t('a connected panel is asked for its own tunnel path', async () => {
  db._T.bot_panels[0].account_id = 'acct-1';
  db._T.bot_panels[0].database_id = 'db-1';
  db._T.bot_panels[0].source = 'deploy';
  db._T.bot_tok_cache[String(CHAT)] = 'cf-fake-token';
  tg.length = 0;
  cf.length = 0;
  await send('/cancel');
  tg.length = 0;
  await tap('cmd:nb_vercel');
  assert.ok(strip(lastText()).includes('/TUNNEL42'),
    'the menu still shows a stale path: ' + strip(lastText()).slice(0, 200));
  tg.length = 0;
  await tap('nbname:vercel:omni-smoke-real');
  assert.equal(JSON.parse(db._T.bot_ui_sessions[String(CHAT)].data).path, '/TUNNEL42');
  assert.ok(cf.some((c) => /d1\/database\/db-1\/query/.test(c.url)),
    'it never asked the panel for its settings: ' + JSON.stringify(cf.map((c) => c.url)));
});

await t('the resolved tunnel path is what lands on the bridge row', async () => {
  tg.length = 0;
  await send(DEAD_VERCEL_TOKEN);
  for (let i = 0; i < 40; i++) {
    if (db._T.bot_bridges.some((r) => r.name === 'omni-smoke-real')) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  const row = db._T.bot_bridges.find((r) => r.name === 'omni-smoke-real');
  assert.ok(row, 'no bridge row was written');
  assert.equal(row.tunnel_path, '/TUNNEL42');
  assert.equal(row.target_host, 'omni-panel.workers.dev');
});

await t('a custom project name keeps the resolved tunnel path', async () => {
  await send('/cancel');
  tg.length = 0;
  await tap('cmd:nb_vercel');
  const kb = tg.at(-1).payload.reply_markup.inline_keyboard.flat();
  const custom = kb.find((b) => String(b.text).includes('نام دلخواه'));
  assert.ok(custom, 'the custom-name button disappeared');
  await tap(custom.callback_data);
  await send('omni-smoke-custom');
  const data = JSON.parse(db._T.bot_ui_sessions[String(CHAT)].data);
  assert.equal(data.platform, 'vercel');
  assert.equal(data.name, 'omni-smoke-custom');
  assert.equal(data.path, '/TUNNEL42', 'the custom-name branch lost the panel path');
  assert.ok(strip(lastText()).includes('/TUNNEL42'), 'the token prompt hides the path it will deploy');
});

await t('the Netlify branch asks for the Netlify token instead', async () => {
  tg.length = 0;
  await tap('cmd:nb_netlify');
  const kb = tg.at(-1).payload.reply_markup.inline_keyboard.flat();
  const nb = kb.find((b) => String(b.callback_data).startsWith('nbname:netlify:'));
  assert.ok(nb, 'no netlify name button');
  tg.length = 0;
  await tap(nb.callback_data);
  assert.ok(strip(lastText()).includes('app.netlify.com/user/applications'));
});

await t('the Cloudflare /deploy flow still works', async () => {
  await send('/cancel');
  tg.length = 0;
  await send('/deploy');
  const kb = tg.at(-1).payload.reply_markup.inline_keyboard.flat();
  assert.ok(kb.filter((b) => String(b.callback_data).startsWith('pick:')).length === 3, 'expected three random worker names');
});

await t('the new bot command is registered with Telegram', async () => {
  // the bot only re-registers when the stored version changes, so force it
  tg.length = 0;
  delete db._T.settings.tg_commands_version;
  await W.syncCreatorCommands(env);
  const names = tg.filter((c) => c.method === 'setMyCommands')
    .flatMap((c) => c.payload.commands || []).map((c) => c.command);
  assert.ok(names.includes('natbridge'), 'natbridge missing from ' + JSON.stringify(names));
  assert.ok(names.includes('deploy'), 'the Cloudflare deploy command disappeared');
  assert.equal(db._T.settings.tg_commands_version, '2026-10-09-render1',
    'the command version was not bumped, so existing bots would never learn /natbridge');
});

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('✅')).length}/${results.length} passed`);
fs.rmSync(tmp, { force: true });
