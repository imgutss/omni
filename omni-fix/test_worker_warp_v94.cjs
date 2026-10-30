// Full rev154 Worker + local D1 + real Cloudflare registration lifecycle.
// Runtime credentials/keys are never logged or persisted by this test.
const fs = require('fs');
const assert = require('assert');
const { Miniflare, Log, LogLevel } = require('/tmp/omni-miniflare/node_modules/miniflare');
const API = 'https://api.cloudflareclient.com/v0a5641';
const HEADERS = { 'CF-Client-Version': 'a-6.38.9-5641', 'user-agent': '1.1.1.1/6.38.9-5641 (Android 16.0.0)' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function removeRegistration(credential) {
  if (!credential?.id || !credential?.token) return false;
  try {
    const response = await fetch(API + '/reg/' + encodeURIComponent(credential.id), {
      method: 'DELETE', headers: { ...HEADERS, authorization: 'Bearer ' + credential.token }, signal: AbortSignal.timeout(15000),
    });
    return response.ok || response.status === 404;
  } catch { return false; }
}
(async () => {
  const source = fs.readFileSync('/home/user/omni-fix/omni.v94.js', 'utf8');
  const mf = new Miniflare({
    modules: true, scriptPath: '/home/user/omni-fix/omni.v94.js', compatibilityDate: '2024-09-23', compatibilityFlags: ['nodejs_compat'],
    d1Databases: { DB: 'omni-test-d1' }, kvNamespaces: { KV: 'omni-test-kv', RELEASES: 'omni-test-releases' },
    durableObjects: { EGRESS: 'OmniEgress2' },
    bindings: { BOT_TOKEN: '', BOT_USERNAME: '', BOT_WEBHOOK_SECRET: 'local-test-only', PANEL_NAME: 'Omni QA', PUBLIC_HOST: 'http://localhost:8787' },
    log: new Log(LogLevel.ERROR),
  });
  const base = 'http://localhost:8787';
  const oldCredentials = [];
  let db = null;
  async function request(path, options = {}) {
    const response = await mf.dispatchFetch(base + path, options);
    const text = await response.text();
    let body = null; try { body = text ? JSON.parse(text) : null; } catch {}
    return { response, body, text };
  }
  async function readStored() {
    if (!db) return null;
    const row = await db.prepare("SELECT value FROM settings WHERE key='warp_gaming_account'").first();
    if (!row?.value) return null;
    const account = JSON.parse(row.value);
    return { account, credential: { id: account.deviceId, token: account.registrationToken } };
  }
  try {
    const version = await request('/api/version');
    assert.strictEqual(version.response.status, 200);
    assert.strictEqual(version.body.rev, 154);
    assert.strictEqual(version.body.md5, 'd25d2c0b9f04ac5ed9e6c99b98f2148b');
    console.log('PASS worker boot and rev154 version');

    const password = 'local-' + crypto.randomUUID();
    const setup = await request('/api/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password }) });
    const cookie = (setup.response.headers.getSetCookie?.() || []).map((v) => v.split(';')[0]).join('; ');
    assert.strictEqual(setup.response.status, 200, setup.text.slice(0, 300));
    assert(cookie);
    db = await mf.getD1Database('DB');
    const admin = { cookie, 'x-omni-csrf': '1', 'content-type': 'application/json' };
    const generate = (force) => request('/api/gaming/warp/generate', { method: 'POST', headers: admin, body: JSON.stringify({ force }) });

    const concurrent = await Promise.all([generate(false), generate(false)]);
    for (const result of concurrent) assert.strictEqual(result.response.status, 200, result.text.slice(0, 400));
    assert(concurrent.every((result) => result.body?.ok && result.body.account?.privateKey));
    assert.strictEqual(concurrent[0].body.account.privateKey, concurrent[1].body.account.privateKey, 'concurrent requests returned different keys');
    assert(concurrent.some((result) => result.body.reused || result.body.coalesced), 'concurrent requests were not coalesced/reused');
    assert(concurrent.every((result) => !('registrationToken' in result.body.account)), 'registration token leaked to browser');
    const first = await readStored();
    assert(first?.credential?.id && first?.credential?.token);
    oldCredentials.push(first.credential);
    console.log('PASS real worker registration + concurrent single-flight + browser token redaction');

    const reused = await generate(false);
    assert.strictEqual(reused.response.status, 200);
    assert.strictEqual(reused.body.reused, true);
    assert.strictEqual(reused.body.account.privateKey, first.account.privateKey);
    console.log('PASS valid key reuse without another registration');

    const status = await request('/api/gaming/warp/status', { headers: { cookie } });
    assert.strictEqual(status.response.status, 200);
    assert.strictEqual(status.body.account.privateKey, first.account.privateKey);
    assert(!('registrationToken' in status.body.account));
    console.log('PASS status key consistency and token redaction');

    const staleClient = { customEndpoint: '162.159.192.1:2408', jc: 9, privateKey: 'stale-browser-key' };
    const saved = await request('/api/settings', { method: 'PUT', headers: admin, body: JSON.stringify({ warp_gaming_account: JSON.stringify(staleClient) }) });
    assert.strictEqual(saved.response.status, 200, saved.text.slice(0, 300));
    const afterSettings = await readStored();
    assert.strictEqual(afterSettings.account.privateKey, first.account.privateKey);
    assert.strictEqual(afterSettings.account.registrationToken, first.account.registrationToken);
    assert.strictEqual(afterSettings.account.customEndpoint, staleClient.customEndpoint);
    assert.strictEqual(afterSettings.account.jc, 9);
    assert(!saved.text.includes(first.account.registrationToken), 'settings response exposed registration token');
    console.log('PASS stale settings write cannot wipe key + endpoint/AWG update survives');

    const rotated = await generate(true);
    assert.strictEqual(rotated.response.status, 200, rotated.text.slice(0, 400));
    assert.notStrictEqual(rotated.body.account.privateKey, first.account.privateKey);
    assert.strictEqual(rotated.body.account.customEndpoint, staleClient.customEndpoint);
    assert.strictEqual(rotated.body.account.jc, 9);
    assert(!('registrationToken' in rotated.body.account));
    const second = await readStored();
    assert(second?.credential?.id && second?.credential?.token);
    assert.notStrictEqual(second.credential.id, first.credential.id);
    oldCredentials.push(second.credential);
    const oldRead = await fetch(API + '/reg/' + encodeURIComponent(first.credential.id), { headers: { ...HEADERS, authorization: 'Bearer ' + first.credential.token }, signal: AbortSignal.timeout(15000) });
    assert([401, 404].includes(oldRead.status), 'old registration still readable after rotation cleanup: HTTP ' + oldRead.status);
    console.log('PASS real rotation preserves settings + old Cloudflare registration deleted');

    console.log(JSON.stringify({ rev: 154, workerRuntime: 'miniflare/workerd', concurrentRequests: 2, reused: true, rotation: true, oldRegistrationDeleted: true, failures: 0 }));
  } finally {
    try {
      const stored = await readStored();
      if (stored?.credential && !oldCredentials.some((c) => c.id === stored.credential.id)) oldCredentials.push(stored.credential);
    } catch {}
    const cleanup = [];
    for (const credential of oldCredentials) cleanup.push({ id: credential.id, deleted: await removeRegistration(credential) });
    await mf.dispose();
    console.log(JSON.stringify({ cleanup: cleanup.map((x) => ({ deleted: x.deleted })) }));
    if (cleanup.some((x) => !x.deleted)) process.exitCode = 2;
  }
})().catch((error) => { console.error(error); process.exit(1); });
