const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { webcrypto } = require('crypto');
const source = fs.readFileSync('/home/user/omni-fix/.warp_v94.js', 'utf8');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const b64 = (n) => Buffer.alloc(32, n).toString('base64');
const clientId = Buffer.from([17, 34, 51, 68]).toString('base64');
function account(n = 1) {
  return {
    privateKey: b64(n), publicKey: b64(n + 20), peerPublicKey: b64(90),
    v4: '172.16.0.2', v6: '2606:4700:110:8949:fed8:2642:a640:c8e1',
    clientId, reserved: [17, 34, 51], mtu: 1280, jc: 4, jmin: 40, jmax: 70,
    s1: 0, s2: 0, h1: 1, h2: 2, h3: 3, h4: 4,
    deviceId: 'device-' + n, registrationApi: 'v0a5641', createdAt: new Date().toISOString(),
  };
}
function baseContext(fetchImpl) {
  const context = {
    console, crypto: webcrypto, fetch: fetchImpl, Response, Request, Headers,
    AbortSignal, URL, TextDecoder, TextEncoder, setTimeout, clearTimeout,
    OMNI_LEGACY_WARP_KEY: b64(255),
    omniB64ToBytes(value) {
      const norm = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
      return new Uint8Array(Buffer.from(norm, 'base64'));
    },
    omniBytesToB64(bytes) { return Buffer.from(bytes).toString('base64'); },
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: '.warp_v94.js' });
  return context;
}
function registrationPayload(overrides = {}) {
  return {
    id: 'device-live', token: 'secret-registration-token',
    config: {
      client_id: clientId,
      interface: { addresses: { v4: '172.16.0.2', v6: '2606:4700:110:8949:fed8:2642:a640:c8e1' } },
      peers: [{ public_key: b64(90) }],
    },
    ...overrides,
  };
}
function lockDb() {
  let lock = null;
  return {
    prepare(sql) {
      const make = (args) => ({
        bind(...next) { return make(next); },
        async run() {
          if (sql.includes('CREATE TABLE IF NOT EXISTS omni_warp_registration_lock')) return { meta: { changes: 0 } };
          if (sql.includes('INSERT INTO omni_warp_registration_lock')) {
            const now = args[2];
            if (!lock || lock.expires_at < now) {
              lock = { owner: args[0], expires_at: args[1] };
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }
          if (sql.includes('DELETE FROM omni_warp_registration_lock')) {
            const changed = lock && lock.owner === args[0];
            if (changed) lock = null;
            return { meta: { changes: changed ? 1 : 0 } };
          }
          throw new Error('unexpected SQL: ' + sql);
        },
      });
      return make([]);
    },
  };
}
async function testRegisterSuccess() {
  const calls = [];
  const context = baseContext(async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(registrationPayload()), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const result = await context.omniWarpRegister();
  assert.strictEqual(calls.length, 1);
  assert(calls[0].url.endsWith('/v0a5641/reg'));
  assert.strictEqual(calls[0].init.headers['CF-Client-Version'], 'a-6.38.9-5641');
  assert.strictEqual(calls[0].init.headers['user-agent'], '1.1.1.1/6.38.9-5641 (Android 16.0.0)');
  const body = JSON.parse(calls[0].init.body);
  assert.strictEqual(body.key_type, 'curve25519');
  assert.strictEqual(body.tunnel_type, 'wireguard');
  assert.strictEqual(body.os_version, '16.0.0');
  assert.strictEqual(body.serial_number, '');
  assert(context.omniWarpIsKey(body.key));
  assert(!JSON.stringify(body).includes(result.account.privateKey), 'private key leaked into registration request');
  assert.deepStrictEqual(Array.from(result.account.reserved), [17, 34, 51]);
  assert.strictEqual(result.account.deviceId, 'device-live');
  assert.strictEqual(result.account.registrationToken, undefined);
  assert.strictEqual(result.credential.token, 'secret-registration-token');
  assert(context.omniWarpAccountUsable(result.account));
  assert(context.omniWarpIsV6('2606:4700:110::1'));
  assert(context.omniWarpIsV6('::1'));
  assert(!context.omniWarpIsV6('2606:::1'));
}
async function testRegister429() {
  let calls = 0;
  const context = baseContext(async () => {
    calls++;
    return new Response(JSON.stringify({ errors: [{ code: 1015, message: 'rate limited' }] }), { status: 429, headers: { 'retry-after': '37' } });
  });
  await assert.rejects(context.omniWarpRegister(), (error) => {
    assert.strictEqual(error.httpStatus, 429);
    assert.strictEqual(error.code, 'warp_rate_limited');
    assert.strictEqual(error.retryAfter, 37);
    assert.strictEqual(error.upstreamStatus, 429);
    return true;
  });
  assert.strictEqual(calls, 1, '429 must not be retried');
}
async function testInvalidResponse() {
  const context = baseContext(async () => new Response(JSON.stringify(registrationPayload({ config: { interface: { addresses: {} }, peers: [] } })), { status: 200 }));
  await assert.rejects(context.omniWarpRegister(), (error) => error.code === 'warp_invalid_upstream_response');
}
async function testConcurrencyAndRotation() {
  let current = null;
  let registrations = 0;
  let failStorage = false;
  const deleted = [];
  const context = baseContext(async () => { throw new Error('network must be mocked by registrar'); });
  context.omniWarpAccountCurrent = async () => current;
  context.putSetting = async (env, key, value) => {
    assert.strictEqual(key, 'warp_gaming_account');
    await sleep(5);
    if (failStorage) throw new Error('D1 full');
    current = JSON.parse(value);
  };
  context.omniWarpDeleteRegistration = async (credential) => { deleted.push(credential.id); return true; };
  context.omniWarpRegister = async () => {
    registrations++;
    await sleep(100);
    const acc = account(registrations);
    return { account: acc, credential: { id: acc.deviceId, token: 'token-' + registrations } };
  };
  const env = { DB: lockDb() };
  const pair = await Promise.all([
    context.omniWarpGenerateAccount(env, { force: false }),
    context.omniWarpGenerateAccount(env, { force: false }),
  ]);
  assert.strictEqual(registrations, 1, 'concurrent calls created more than one registration');
  assert(pair[0].coalesced || pair[1].coalesced, 'second call did not coalesce');
  assert(current.registrationToken, 'device credential was not stored for later cleanup');
  assert.strictEqual(context.omniWarpPublicAccount(current).registrationToken, undefined);

  current.customEndpoint = '162.159.192.1:2408';
  current.jc = 9;
  const firstKey = current.privateKey;
  const rotated = await context.omniWarpGenerateAccount(env, { force: true });
  assert.strictEqual(registrations, 2);
  assert.notStrictEqual(rotated.account.privateKey, firstKey);
  assert.strictEqual(rotated.account.customEndpoint, '162.159.192.1:2408');
  assert.strictEqual(rotated.account.jc, 9);
  assert.deepStrictEqual(Array.from(rotated.account.reserved), [17, 34, 51]);
  assert(deleted.includes('device-1'), 'old registration was not cleaned up after rotation');

  const reused = await context.omniWarpGenerateAccount(env, { force: false });
  assert.strictEqual(reused.reused, true);
  assert.strictEqual(registrations, 2, 'valid account triggered another registration');

  const stale = { warp_gaming_account: JSON.stringify({ customEndpoint: '162.159.193.1:2408', privateKey: 'stale-overwrite' }) };
  await context.omniWarpPreserveSettingsPatch(env, stale);
  const merged = JSON.parse(stale.warp_gaming_account);
  assert.strictEqual(merged.privateKey, rotated.account.privateKey);
  assert.strictEqual(merged.registrationToken, 'token-2');
  assert.strictEqual(merged.customEndpoint, '162.159.193.1:2408');

  const beforeFailure = current;
  failStorage = true;
  await assert.rejects(context.omniWarpGenerateAccount(env, { force: true }), (error) => error.code === 'warp_storage_failed');
  assert.strictEqual(current, beforeFailure, 'storage failure replaced the old account');
  assert(deleted.includes('device-3'), 'new registration was not rolled back after D1 failure');
  assert.strictEqual(registrations, 3);
}
(async () => {
  const tests = [testRegisterSuccess, testRegister429, testInvalidResponse, testConcurrencyAndRotation];
  for (const test of tests) { await test(); console.log('PASS', test.name); }
  console.log(JSON.stringify({ tests: tests.length, failures: 0, assertions: 'registration, validation, 429, concurrency, rotation, stale-write protection, storage rollback' }));
})().catch((error) => { console.error(error); process.exit(1); });
