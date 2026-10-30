// One real registration through the exact rev154 registrar; always deletes it.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { webcrypto } = require('crypto');
const context = {
  console, crypto: webcrypto, fetch: globalThis.fetch, Response, Request, Headers,
  AbortSignal, URL, TextDecoder, TextEncoder, setTimeout, clearTimeout,
  OMNI_LEGACY_WARP_KEY: Buffer.alloc(32, 255).toString('base64'),
  omniB64ToBytes(value) { return new Uint8Array(Buffer.from(String(value || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64')); },
  omniBytesToB64(bytes) { return Buffer.from(bytes).toString('base64'); },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('/home/user/omni-fix/.warp_v94.js', 'utf8'), context);
(async () => {
  let credential = null;
  let cleanup = false;
  try {
    const result = await context.omniWarpRegister();
    credential = result.credential;
    assert(context.omniWarpAccountUsable(result.account));
    assert.strictEqual(result.account.registrationApi, 'v0a5641');
    assert.strictEqual(result.account.registrationToken, undefined);
    console.log(JSON.stringify({ registered: true, api: result.account.registrationApi, completeConfig: true, reservedLength: result.account.reserved.length, tokenExposedInAccount: false }));
  } finally {
    if (credential) cleanup = await context.omniWarpDeleteRegistration(credential);
    console.log(JSON.stringify({ testRegistrationDeleted: cleanup }));
    if (credential && !cleanup) process.exitCode = 2;
  }
})().catch((error) => { console.error(JSON.stringify({ error: String(error.message || error), code: error.code, upstreamStatus: error.upstreamStatus })); process.exit(1); });
