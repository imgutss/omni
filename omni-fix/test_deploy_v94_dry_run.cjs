// Offline deployment-script dry run. No network, credentials, or real result files.
const realFs = require('fs');
const vm = require('vm');
const assert = require('assert');
const ROOT = '/home/user/omni-fix/';
const deploySource = realFs.readFileSync(ROOT + '.deploy_v94_central.js', 'utf8');
const worker154 = realFs.readFileSync(ROOT + 'omni.v94.js', 'utf8');
const worker153 = realFs.readFileSync(ROOT + 'omni.v93.js', 'utf8');
const panelInput = realFs.readFileSync(ROOT + 'panel.v94.final.html', 'utf8');
const panel154 = panelInput.replace('data-build="8ae833599a220f69225fe0ea24111234"', 'data-build="d25d2c0b9f04ac5ed9e6c99b98f2148b"');
const HOST = 'https://omni.nguts.workers.dev';
const DB_ID = 'bb61760a-d8d4-4065-8c97-d5a5d54d164a';
const KV_ID = '12b1a28ce610443fb1efcf83885ae2f2';
const RELEASE_KEY = 'releases/v60.1-rev154-warp-registration';
const ROLLBACK_KEY = 'releases/v60.1-rev153-scoped-android';
const CURRENT_KEY = 'releases/current';

async function run(mode) {
  let liveRev = 153;
  let generationCalls = 0;
  let uploadCalls = 0;
  let warpAccount = null;
  let resultText = null;
  const sessions = new Set();
  const logs = [];
  const kv = new Map([[CURRENT_KEY, worker153], [ROLLBACK_KEY, worker153]]);
  const privateKey = Buffer.alloc(32, 7).toString('base64');
  const publicAccount = {
    privateKey, publicKey: Buffer.alloc(32, 6).toString('base64'),
    peerPublicKey: Buffer.alloc(32, 8).toString('base64'),
    v4: '172.16.0.2', v6: '2606:4700:110:8c96:8d94:c73d:98e7:c6a8',
    clientId: Buffer.from([1, 2, 3]).toString('base64'), reserved: [1, 2, 3],
    deviceId: 'dry-run-device', registrationApi: 'v0a5641', customEndpoint: 'engage.cloudflareclient.com:2408', jc: 7,
  };
  const settings = {
    compatibility_date: '2024-09-23', compatibility_flags: ['nodejs_compat'],
    bindings: [
      { name: 'BOT_TOKEN', type: 'secret_text' }, { name: 'BOT_USERNAME', type: 'secret_text' },
      { name: 'BOT_WEBHOOK_SECRET', type: 'secret_text' }, { name: 'DB', type: 'd1', id: DB_ID },
      { name: 'KV', type: 'kv_namespace', namespace_id: KV_ID }, { name: 'RELEASES', type: 'kv_namespace', namespace_id: KV_ID },
      { name: 'EGRESS', type: 'durable_object_namespace', class_name: 'OmniEgress2', script_name: 'omni' },
      { name: 'PANEL_NAME', type: 'plain_text', text: 'Omni' }, { name: 'PUBLIC_HOST', type: 'plain_text', text: HOST },
    ],
  };
  const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
  const cf = (body, status = 200) => json({ success: status < 400, errors: status < 400 ? [] : [{ message: 'dry-run error' }], result: body }, status);
  const mockFs = {
    readFileSync(path, encoding) { return realFs.readFileSync(path, encoding); },
    writeFileSync(path, body) { if (path.endsWith('deploy-rev154-central-result.json')) resultText = String(body); else throw new Error('Unexpected write ' + path); },
  };
  const mockConsole = { log: (...args) => logs.push(args.join(' ')), error: (...args) => logs.push(args.join(' ')) };

  async function mockFetch(input, init = {}) {
    const url = String(input);
    const method = String(init.method || 'GET').toUpperCase();
    if (url.startsWith('https://api.cloudflare.com/client/v4')) {
      const path = url.slice('https://api.cloudflare.com/client/v4'.length);
      if (path === '/accounts/e2ff50194f83d8484987ee00dcd4c188/workers/scripts/omni/settings' && method === 'GET') return cf(settings);
      if (path === '/accounts/e2ff50194f83d8484987ee00dcd4c188/workers/workers/bfd797a973a44ba88cdfed53bbecd10a/versions?per_page=1') {
        return cf([{ id: liveRev === 154 ? 'dry-run-v5' : 'dry-run-v4', number: liveRev === 154 ? 5 : 4, created_on: '2026-10-30T00:00:00Z' }]);
      }
      if (path === '/accounts/e2ff50194f83d8484987ee00dcd4c188/workers/scripts/omni' && method === 'PUT') {
        uploadCalls++;
        const form = init.body;
        const metadata = JSON.parse(await form.get('metadata').text());
        const body = await form.get('worker.js').text();
        assert(metadata.exports.OmniEgress2.storage === 'sqlite');
        assert(metadata.keep_bindings.includes('secret_text'));
        assert(metadata.bindings.some((b) => b.name === 'DB' && b.id === DB_ID));
        liveRev = body === worker154 ? 154 : body === worker153 ? 153 : 0;
        assert(liveRev, 'Unknown upload body');
        return cf({ id: 'dry-run-upload' });
      }
      const kvPrefix = `/accounts/e2ff50194f83d8484987ee00dcd4c188/storage/kv/namespaces/${KV_ID}/values/`;
      if (path.startsWith(kvPrefix)) {
        const key = decodeURIComponent(path.slice(kvPrefix.length));
        if (method === 'PUT') { kv.set(key, String(init.body)); return cf(true); }
        if (method === 'GET') { if (!kv.has(key)) return new Response('missing', { status: 404 }); return new Response(kv.get(key), { status: 200 }); }
      }
      if (path === `/accounts/e2ff50194f83d8484987ee00dcd4c188/d1/database/${DB_ID}/query` && method === 'POST') {
        const body = JSON.parse(init.body);
        const sql = body.sql;
        const params = body.params || [];
        let results = [];
        if (sql.includes("FROM accounts WHERE role='admin'")) results = [{ id: 1 }];
        else if (sql.startsWith('INSERT INTO sessions')) sessions.add(params[0]);
        else if (sql.startsWith('DELETE FROM sessions')) sessions.delete(params[0]);
        else if (sql.includes("FROM settings WHERE key='warp_gaming_account'")) results = warpAccount ? [{ value: JSON.stringify(warpAccount) }] : [];
        else throw new Error('Unexpected dry-run SQL: ' + sql);
        return cf([{ success: true, results, meta: {} }]);
      }
      throw new Error('Unexpected dry-run Cloudflare request: ' + method + ' ' + path);
    }

    assert(url.startsWith(HOST), 'Unexpected non-central URL ' + url);
    const path = url.slice(HOST.length).split('?')[0];
    if (path === '/api/version') return json({ ok: true, v: '60.1', rev: liveRev, md5: liveRev === 154 ? 'd25d2c0b9f04ac5ed9e6c99b98f2148b' : '032799ad4dee372868515a790f642cde' });
    if (path === '/') return new Response(liveRev === 154 ? panel154 : panelInput, { status: 200, headers: { 'content-type': 'text/html' } });
    const cookie = String(init.headers?.cookie || '');
    const sid = (cookie.match(/omni_sid=([^;]+)/) || [])[1];
    const authed = !!sid && sessions.has(sid);
    if (path === '/api/gaming/warp/status') {
      if (!authed) return json({ ok: false, error: 'auth' }, 401);
      return json(warpAccount ? { ok: true, account: publicAccount } : { ok: true, needsKey: true });
    }
    if (path === '/api/gaming/warp/generate') {
      if (!authed) return json({ ok: false, error: 'auth' }, 401);
      generationCalls++;
      if (mode === '429') return json({ ok: false, error: 'rate limited', code: 'warp_rate_limited', retryAfter: 60 }, 429, { 'retry-after': '60' });
      if (!warpAccount) warpAccount = { ...publicAccount, registrationToken: 'dry-run-registration-token-secret' };
      const flags = generationCalls === 1 ? { reused: false, coalesced: false } : generationCalls === 2 ? { reused: false, coalesced: true } : { reused: true, coalesced: false };
      return json({ ok: true, account: publicAccount, ...flags, registrationApi: 'v0a5641' });
    }
    if (path === '/api/app/pair') return json({ ok: false, error: 'invalid' }, 401);
    if (['/api/app/templates', '/api/app/pairing-code', '/api/users', '/api/diag/dns-batch', '/api/ech-config'].includes(path)) return json({ ok: false, error: 'auth' }, 401);
    throw new Error('Unexpected dry-run panel request: ' + method + ' ' + path);
  }

  const context = {
    require(name) { if (name === 'fs') return mockFs; if (name === 'crypto') return require('crypto'); throw new Error('Unexpected module ' + name); },
    process: { env: { CF_TOKEN: 'dry-run-not-a-credential' }, exit(code) { throw new Error('DRY_RUN_EXIT_' + code); } },
    console: mockConsole, fetch: mockFetch, FormData, Blob, Response, Buffer, URL, TextEncoder, TextDecoder,
    setTimeout(fn) { fn(); return 0; }, clearTimeout() {},
  };
  context.globalThis = context;
  let exitError = null;
  try { await vm.runInNewContext(deploySource, context, { filename: '.deploy_v94_central.js' }); }
  catch (error) { exitError = error; }

  const allOutput = logs.join('\n') + '\n' + (resultText || '');
  assert(!allOutput.includes(publicAccount.privateKey), 'Private key leaked to dry-run output');
  assert(!allOutput.includes('dry-run-registration-token-secret'), 'Registration token leaked to dry-run output');
  assert.strictEqual(sessions.size, 0, 'Temporary verification session was not deleted');
  if (mode === 'success') {
    assert.ifError(exitError);
    assert.strictEqual(liveRev, 154);
    assert.strictEqual(generationCalls, 3, 'Unexpected registration POST count/retry');
    assert.strictEqual(kv.get(RELEASE_KEY), worker154);
    assert.strictEqual(kv.get(CURRENT_KEY), worker154);
    const result = JSON.parse(resultText);
    assert.strictEqual(result.live_version.rev, 154);
    assert.strictEqual(result.warp_verification.createdNewAccount, true);
    assert(Object.values(result.smoke).every(Boolean));
    assert(result.bindings_preserved);
    return { mode, generationCalls, uploadCalls, sessionCleanup: true, rollback: false, smokeChecks: Object.keys(result.smoke).length };
  }
  assert(mode === '429');
  assert(exitError && exitError.message === 'DRY_RUN_EXIT_1', '429 dry run should terminate unsuccessfully after rollback');
  assert.strictEqual(liveRev, 153, 'Worker did not roll back to rev153');
  assert.strictEqual(kv.get(CURRENT_KEY), worker153, 'KV current did not roll back to rev153');
  assert.strictEqual(generationCalls, 2, '429 path retried or continued registration');
  assert.strictEqual(resultText, null);
  assert(logs.some((line) => line.includes('ROLLBACK rev153 OK')));
  return { mode, generationCalls, uploadCalls, sessionCleanup: true, rollback: true };
}

(async () => {
  const success = await run('success');
  const rateLimited = await run('429');
  console.log(JSON.stringify({ ok: true, network: false, results: [success, rateLimited] }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
