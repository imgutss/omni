/* Offline harness for src/bridges.js — mocked Vercel/Netlify APIs + in-memory D1.
   Run: node test/bridges.test.mjs                                            */
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const calls = [];
let failAuth = false;
let vercelBuildState = 'READY';
let netlifyState = 'ready';

/* ── fake D1 ─────────────────────────────────────────────────────────────── */
function makeDb() {
  const tables = { bot_bridges: [], bot_bridge_tokens: [] };
  let autoId = 0;
  const mk = (sql) => {
    const st = {
      _sql: sql, _params: [],
      bind(...p) { st._params = p; return st; },
      async run() {
        const s = sql.replace(/\s+/g, ' ').trim();
        if (/^CREATE TABLE/i.test(s)) return { meta: {} };
        if (/^INSERT INTO bot_bridges/i.test(s)) {
          const [owner, platform, name, target, path, status, tokenRef] = st._params;
          const row = { id: ++autoId, owner, platform, name, project_id: null, deployment_id: null, domain: null, url: null, target_host: target, tunnel_path: path, status, error: null, token_ref: tokenRef, dashboard_url: null, created_at: 'now', updated_at: 'now' };
          tables.bot_bridges.push(row);
          return { meta: { last_row_id: row.id } };
        }
        if (/^INSERT INTO bot_bridge_tokens/i.test(s)) {
          const [ref, platform, token] = st._params;
          tables.bot_bridge_tokens.push({ ref, platform, token });
          return { meta: {} };
        }
        if (/^UPDATE bot_bridges SET/i.test(s)) {
          const id = st._params[st._params.length - 1];
          const cols = s.slice(s.indexOf('SET ') + 4, s.indexOf(' WHERE')).split(',').map((x) => x.replace('=?', '').trim());
          const row = tables.bot_bridges.find((r) => r.id === Number(id));
          if (row) cols.forEach((c, i) => { if (c !== 'updated_at=datetime(\'now\')') row[c] = st._params[i]; });
          return { meta: {} };
        }
        if (/^DELETE FROM bot_bridges/i.test(s)) {
          const id = Number(st._params[0]);
          tables.bot_bridges = tables.bot_bridges.filter((r) => r.id !== id);
          return { meta: {} };
        }
        if (/^DELETE FROM bot_bridge_tokens/i.test(s)) {
          tables.bot_bridge_tokens = tables.bot_bridge_tokens.filter((r) => r.ref !== st._params[0]);
          return { meta: {} };
        }
        return { meta: {} };
      },
      async first() {
        const s = sql.replace(/\s+/g, ' ').trim();
        if (/FROM bot_bridges WHERE id=\?/i.test(s)) return tables.bot_bridges.find((r) => r.id === Number(st._params[0])) || null;
        if (/FROM bot_bridge_tokens WHERE ref=\?/i.test(s)) return tables.bot_bridge_tokens.find((r) => r.ref === st._params[0]) || null;
        return null;
      },
      async all() {
        const s = sql.replace(/\s+/g, ' ').trim();
        if (/WHERE owner=\?/i.test(s)) return { results: tables.bot_bridges.filter((r) => r.owner === st._params[0]) };
        if (/FROM bot_bridges/i.test(s)) return { results: tables.bot_bridges };
        return { results: [] };
      },
    };
    return st;
  };
  return { prepare: mk, _tables: tables };
}

/* ── fake fetch ──────────────────────────────────────────────────────────── */
const OK = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });

globalThis.fetch = async (url, init = {}) => {
  const method = (init.method || 'GET').toUpperCase();
  const u = String(url);
  calls.push(`${method} ${u.replace(/^https:\/\/[^/]+/, '')}`);
  const auth = String(init.headers?.get?.('Authorization') || '');
  if (failAuth || !auth.startsWith('Bearer good')) {
    if (u.startsWith('https://api.vercel.com')) return OK({ error: { code: 'forbidden', message: 'Not authorized', invalidToken: true } }, 403);
    return OK({ code: 401, message: 'Access Denied' }, 401);
  }

  if (u.startsWith('https://api.vercel.com')) {
    if (u.includes('/v2/user')) return OK({ user: { username: 'guts', email: 'g@example.com', uid: 'u_1', defaultTeamId: 'team_1' } });
    if (u.includes('/v2/teams')) return OK({ teams: [{ id: 'team_1', slug: 'guts' }] });
    if (/\/v9\/projects\/[^/]+$/.test(u.split('?')[0]) && method === 'GET') return OK({ error: { message: 'not found' } }, 404);
    if (u.includes('/v11/projects') && method === 'POST') return OK({ id: 'prj_1', name: JSON.parse(init.body).name });
    if (u.includes('/env') && method === 'GET') return OK({ envs: [] });
    if (u.includes('/env') && (method === 'POST' || method === 'PATCH')) return OK({ ok: true });
    if (u.includes('/v13/deployments') && method === 'POST') {
      const body = JSON.parse(init.body);
      assert.equal(body.target, 'production');
      assert.ok(Array.isArray(body.files) && body.files.length >= 5, 'vercel files missing');
      assert.ok(body.files.every((f) => typeof f.data === 'string' && f.file), 'vercel file shape');
      return OK({ id: 'dpl_1', url: 'omni-bridge-x.vercel.app', alias: ['omni-bridge-x.vercel.app'], readyState: 'QUEUED', inspectUrl: 'https://vercel.com/deployments/dpl_1' });
    }
    if (u.includes('/v13/deployments/dpl_1')) return OK({ id: 'dpl_1', readyState: vercelBuildState, url: 'omni-bridge-x.vercel.app' });
    return OK({});
  }

  if (u.startsWith('https://api.netlify.com')) {
    if (u.endsWith('/user')) return OK({ id: 'n_1', full_name: 'Guts', email: 'g@example.com', account_slug: 'guts' });
    if (u.endsWith('/sites') && method === 'POST') {
      const body = JSON.parse(init.body);
      return OK({ id: 'site_1', name: body.name, subdomain: body.name, ssl_url: `https://${body.name}.netlify.app` });
    }
    if (u.endsWith('/deploys') && method === 'POST') {
      const body = JSON.parse(init.body);
      assert.ok(body.files && Object.keys(body.files).length >= 4, 'netlify digest missing');
      for (const [p, sha] of Object.entries(body.files)) assert.match(sha, /^[0-9a-f]{40}$/, `bad sha1 for ${p}`);
      assert.ok(Array.isArray(body.edge_functions) && body.edge_functions[0].function === 'relay');
      return OK({ id: 'dep_1', state: 'uploading', required: Object.values(body.files).slice(0, 2), subdomain: 'site_1' });
    }
    if (u.includes('/deploys/dep_1/files/')) {
      assert.equal(method, 'PUT');
      assert.ok(String(init.body).length > 50, 'empty file upload');
      return OK({ ok: true });
    }
    if (u.includes('/deploys/dep_1')) return OK({ id: 'dep_1', state: netlifyState, subdomain: 'site_1', error_message: '' });
    if (u.includes('/sites/')) return OK({ id: 'site_1', name: 'site_1', subdomain: 'site_1' });
    return OK({});
  }
  throw new Error('unexpected url ' + u);
};

const B = await import('../src/bridges.js');

const results = [];
const t = async (name, fn) => {
  try { await fn(); results.push(`✅ ${name}`); }
  catch (e) { results.push(`❌ ${name}: ${e.message}`); process.exitCode = 1; }
};

/* ── pure helpers ────────────────────────────────────────────────────────── */
await t('normalizeTargetHost strips scheme/slash and rejects junk', () => {
  assert.equal(B.normalizeTargetHost('https://omni.x.workers.dev/'), 'omni.x.workers.dev');
  assert.equal(B.normalizeTargetHost('  omni.x.workers.dev  '), 'omni.x.workers.dev');
  assert.equal(B.normalizeTargetHost('omni.x.workers.dev/VZLdh9Ft?a=1'), 'omni.x.workers.dev');
  assert.equal(B.normalizeTargetHost('no-dot-here'), '');
  assert.equal(B.normalizeTargetHost('bad host!'), '');
});

await t('bridgeProjectName is DNS-safe and bounded', () => {
  assert.equal(B.bridgeProjectName('Omni Bridge!!'), 'omni-bridge');
  assert.match(B.bridgeProjectName(''), /^omni-bridge-[a-z0-9]+$/);
  assert.ok(B.bridgeProjectName('x'.repeat(80)).length <= 32);
  assert.match(B.bridgeProjectName('-lead'), /^[a-z0-9]/);
});

await t('bridgeTokenShape accepts real token shapes, rejects short ones', () => {
  assert.equal(B.bridgeTokenShape('vercel', 'cfut_' + 'a'.repeat(40)), true);
  assert.equal(B.bridgeTokenShape('vercel', 'vercel_' + 'a'.repeat(30)), true);
  assert.equal(B.bridgeTokenShape('netlify', 'ghp_' + 'A'.repeat(36)), true);
  assert.equal(B.bridgeTokenShape('vercel', 'abc'), false);
  assert.equal(B.maskToken('cfut_dead000000000000000000000000000000000000'), 'cfut_d••••0000');
});

await t('sha1Hex matches a known digest', async () => {
  assert.equal(await B.sha1Hex('hello'), 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
});

await t('generated vercel.json is valid and proxies only the tunnel path', () => {
  const cfg = JSON.parse(B.vercelConfig('omni.x.workers.dev', '/VZLdh9Ft'));
  assert.equal(cfg.rewrites[1].destination, 'https://omni.x.workers.dev/VZLdh9Ft');
  assert.ok(cfg.rewrites.some((r) => r.source === '/__bridge'));
  assert.ok(cfg.headers[0].headers.some((h) => h.key === 'x-vercel-enable-rewrite-caching'));
});

await t('generated netlify.toml keeps the decoy homepage local', () => {
  const toml = B.netlifyConfig('omni.x.workers.dev', '/VZLdh9Ft');
  assert.ok(toml.includes('from = "/VZLdh9Ft"'));
  assert.ok(toml.includes('to = "https://omni.x.workers.dev/VZLdh9Ft"'));
  assert.ok(toml.includes('X-From = "Netlify-Omni-Bridge"'));
  assert.ok(!toml.includes('from = "/*"'), 'must not proxy the whole site');
});

/* ── token verification ──────────────────────────────────────────────────── */
await t('verifyBridgeToken(vercel) reports the account', async () => {
  const who = await B.verifyBridgeToken('vercel', 'good-vercel-token-0123456789abcdef');
  assert.equal(who.username, 'guts');
  assert.equal(who.teamId, 'team_1');
});

await t('verifyBridgeToken(netlify) reports the account', async () => {
  const who = await B.verifyBridgeToken('netlify', 'good-netlify-token-0123456789abcdef');
  assert.equal(who.username, 'Guts');
  assert.equal(who.teamSlug, 'guts');
});

await t('a revoked token surfaces as an auth error', async () => {
  failAuth = true;
  await assert.rejects(() => B.verifyVercelToken('cfut_dead'), (e) => e.auth === true && /Not authorized/.test(e.message));
  await assert.rejects(() => B.verifyNetlifyToken('dead'), (e) => e.auth === true);
  failAuth = false;
});

/* ── full deploys ────────────────────────────────────────────────────────── */
await t('deployVercelBridge creates project + env + production deploy', async () => {
  calls.length = 0;
  const stages = [];
  const out = await B.deployVercelBridge({
    token: 'good-vercel-token-0123456789abcdef', name: 'Omni Bridge', target: 'https://omni.x.workers.dev/',
    tunnelPath: '/VZLdh9Ft', onProgress: (s) => { stages.push(s); },
  });
  assert.equal(out.platform, 'vercel');
  assert.equal(out.state, 'ready');
  assert.equal(out.domain, 'omni-bridge-x.vercel.app');
  assert.equal(out.target, 'omni.x.workers.dev');
  assert.ok(calls.some((c) => c.includes('/v11/projects')), 'project was not created');
  assert.ok(calls.some((c) => c.includes('/env')), 'BACKEND_URL env was not set');
  assert.ok(calls.some((c) => c.includes('teamId=team_1')), 'teamId was not forwarded');
  assert.ok(stages.length >= 3, 'no progress callbacks');
});

await t('deployNetlifyBridge digests, uploads required files, publishes', async () => {
  calls.length = 0;
  const out = await B.deployNetlifyBridge({
    token: 'good-netlify-token-0123456789abcdef', name: '', target: 'omni.x.workers.dev', tunnelPath: '/VZLdh9Ft',
  });
  assert.equal(out.platform, 'netlify');
  assert.equal(out.state, 'ready');
  assert.equal(out.domain, 'site_1.netlify.app');
  assert.equal(calls.filter((c) => c.includes('/deploys/dep_1/files/')).length, 2, 'required files not uploaded');
  assert.ok(calls.some((c) => c.startsWith('POST /api/v1/sites')), 'site was not created');
});

await t('startBridgeDeploy persists a row and updates it on success', async () => {
  const db = makeDb();
  const started = await B.startBridgeDeploy(db, null, {
    owner: 'bot:123', platform: 'vercel', token: 'good-vercel-token-0123456789abcdef',
    name: 'omni-edge', target: 'omni.x.workers.dev', tunnelPath: '/VZLdh9Ft', saveToken: true,
  });
  assert.ok(started.id > 0);
  const row0 = await B.getBridge(db, started.id);
  assert.equal(row0.status, 'deploying');
  assert.ok(row0.token_ref, 'token was not stored');
  assert.equal(await B.readBridgeToken(db, row0.token_ref), 'good-vercel-token-0123456789abcdef');
  const res = await started.promise;
  const row = await B.getBridge(db, started.id);
  assert.equal(row.status, 'ready');
  assert.equal(row.domain, res.domain);
  assert.equal(row.url, `https://${res.domain}`);
  const list = await B.listBridges(db, 'bot:123');
  assert.equal(list.length, 1);
  await B.forgetBridgeToken(db, row.token_ref);
  assert.equal(await B.readBridgeToken(db, row.token_ref), '');
});

await t('a failed deploy marks the row failed and keeps the error', async () => {
  const db = makeDb();
  failAuth = true;
  const started = await B.startBridgeDeploy(db, null, { owner: 'panel:admin', platform: 'netlify', token: 'dead-token-0123456789abcdef', target: 'omni.x.workers.dev' });
  await assert.rejects(() => started.promise);
  failAuth = false;
  const row = await B.getBridge(db, started.id);
  assert.equal(row.status, 'failed');
  assert.ok(row.error && row.error.length > 3, 'error was not recorded');
});

await t('bad input is rejected before any network call', async () => {
  calls.length = 0;
  const db = makeDb();
  await assert.rejects(() => B.startBridgeDeploy(db, null, { platform: 'fly', token: 'good-x-0123456789abcdef', target: 'a.b' }));
  await assert.rejects(() => B.startBridgeDeploy(db, null, { platform: 'vercel', token: 'good-x-0123456789abcdef', target: 'no dot here' }));
  await assert.rejects(() => B.startBridgeDeploy(db, null, { platform: 'vercel', token: 'x', target: 'omni.x.workers.dev' }));
  assert.equal(calls.length, 0);
});

await t('a still-building vercel deploy reports building, not failure', async () => {
  vercelBuildState = 'BUILDING';
  const db = makeDb();
  const started = await B.startBridgeDeploy(db, null, { platform: "vercel", token: "good-vercel-token-0123456789abcdef", target: "omni.x.workers.dev", waitMs: 7000 });
  started.promise.catch(() => {});
  const out = await started.promise;
  assert.equal(out.state, 'building');
  vercelBuildState = 'READY';
});

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('✅')).length}/${results.length} passed`);
