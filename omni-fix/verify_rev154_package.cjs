// Offline rev154 package verification. No network and no credentials.
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');
const assert = require('assert');
const root = '/home/user/omni-fix/';
const read = (name) => fs.readFileSync(root + name, 'utf8');
const hash = (algorithm, value) => crypto.createHash(algorithm).update(value).digest('hex');
const worker = read('omni.v94.js');
const panel = read('panel.v94.final.html');
const rollback153 = read('omni.v93.js');
const rollback152 = read('omni.v92.js');
const deploy = read('.deploy_v94_central.js');

assert.strictEqual(hash('md5', worker), '2ab4d6cb826f2bf2b1f86160078efc2f');
assert.strictEqual(hash('sha256', worker), '27e90c2ae89d393f8b6611fcb16b8dac6896ea41bedf9ed4b3a5e0b3ea6cb852');
assert.strictEqual(hash('md5', rollback153), '632463e76ce289ee41be750f50e133b0');
assert.strictEqual(hash('md5', rollback152), 'eed1a9dbc12d5c556ef97631f0701180');
// panel.v94.final.html is the builder input; the Worker embeds the same HTML
// with its pre-splice MD5 as data-build. The input file itself is not rewritten.
assert.strictEqual(hash('md5', panel), 'd25d2c0b9f04ac5ed9e6c99b98f2148b');
const oldBuildAttr = 'data-build="8ae833599a220f69225fe0ea24111234"';
assert.strictEqual(panel.split(oldBuildAttr).length - 1, 1);
const embeddedPanel = panel.replace(oldBuildAttr, 'data-build="d25d2c0b9f04ac5ed9e6c99b98f2148b"');
assert(worker.includes(JSON.stringify(embeddedPanel)));
assert(worker.includes('md5: "d25d2c0b9f04ac5ed9e6c99b98f2148b", rev: 154'));
assert(worker.includes('OMNI_WARP_API_VERSION = "v0a5641"'));
assert(worker.includes('OMNI_WARP_REGISTRATION_URL + "/reg"'));
assert(worker.includes('a-6.38.9-5641'));
assert(worker.includes('1.1.1.1/6.38.9-5641'));
assert(worker.includes('warp_rate_limited'));
assert(worker.includes('warp_registration_in_progress'));
assert(worker.includes('registrationApi'));
assert.strictEqual((panel.match(/fetch\("\/api\/gaming\/warp\/generate"/g) || []).length, 1);
assert(!panel.includes('await omniEnsureWarpKey(l)'));
assert(panel.includes('var omniWarpKeyPromise = null'));
assert(panel.includes('finally { omniWarpKeyPromise = null; }'));
assert(panel.includes('GAMING_VIEW_STATE.keyBusy'));
assert(panel.includes('id="omni-warp-outputs-body"'));
assert(panel.includes('const keyFeedback = GAMING_VIEW_STATE.keyError'));
assert(panel.includes('omniWarpApplyAccount(j.account)'));
assert(panel.includes('GAMING_VIEW_STATE.warpAccount = account'));
assert(!panel.includes('\uFFFD'));

const scripts = [...panel.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1]).filter((code) => code.trim());
scripts.forEach((code, index) => new vm.Script(code, { filename: `panel-inline-${index + 1}.js` }));
assert(scripts.length >= 8);

assert(deploy.includes("releases/v60.1-rev154-warp-registration"));
assert(deploy.includes("releases/v60.1-rev153-scoped-android"));
assert(deploy.includes('waitForRevision(153, EXPECTED_REV153_PANEL_MD5)'));
assert(!deploy.includes('rev152'));
assert(deploy.includes('const response = await rawFetch(HOST + path'));
assert(!/CF_TOKEN\s*=\s*['"][^'"]+/.test(deploy));

console.log(JSON.stringify({
  ok: true,
  workerBytes: Buffer.byteLength(worker),
  workerMd5: hash('md5', worker),
  workerSha256: hash('sha256', worker),
  panelBytes: Buffer.byteLength(panel),
  panelBuild: 'd25d2c0b9f04ac5ed9e6c99b98f2148b',
  inlineScriptsPassed: scripts.length,
  rollback153Md5: hash('md5', rollback153),
  rollback152Md5: hash('md5', rollback152),
  network: false,
}, null, 2));
