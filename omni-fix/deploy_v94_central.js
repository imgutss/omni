// rev154 central deploy with explicit rev153 preconditions and automatic rollback.
// Requires CF_TOKEN in the process environment. No credential is written by this script.
// A short-lived D1 session is used only for live WARP verification and is always deleted.
const fs = require('fs');
const crypto = require('crypto');

const ACCOUNT = 'e2ff50194f83d8484987ee00dcd4c188';
const WORKER_ID = 'bfd797a973a44ba88cdfed53bbecd10a';
const SCRIPT = 'omni';
const HOST = 'https://omni.nguts.workers.dev';
const DB_ID = 'bb61760a-d8d4-4065-8c97-d5a5d54d164a';
const KV_ID = '12b1a28ce610443fb1efcf83885ae2f2';
const RELEASE_KEY = 'releases/v60.1-rev154-warp-registration';
const ROLLBACK_KEY = 'releases/v60.1-rev153-scoped-android';
const CURRENT_KEY = 'releases/current';
const EXPECTED_REV153_MD5 = '632463e76ce289ee41be750f50e133b0';
const EXPECTED_REV154_MD5 = '2ab4d6cb826f2bf2b1f86160078efc2f';
const EXPECTED_REV154_SHA256 = '27e90c2ae89d393f8b6611fcb16b8dac6896ea41bedf9ed4b3a5e0b3ea6cb852';
const EXPECTED_REV153_PANEL_MD5 = '032799ad4dee372868515a790f642cde';
const EXPECTED_PANEL_MD5 = 'd25d2c0b9f04ac5ed9e6c99b98f2148b';
const token = process.env.CF_TOKEN;
if (!token) throw new Error('CF_TOKEN is required');
const H = { authorization: 'Bearer ' + token };
const source = fs.readFileSync('/home/user/omni-fix/omni.v94.js', 'utf8');
const rollbackSource = fs.readFileSync('/home/user/omni-fix/omni.v93.js', 'utf8');
const md5 = (value) => crypto.createHash('md5').update(value).digest('hex');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const rawFetch = globalThis.fetch;
globalThis.fetch = async (input, init, attempt = 0) => {
  try {
    return await rawFetch(input, init);
  } catch (error) {
    const code = error?.code || error?.cause?.code || '';
    if (attempt < 3 && /UND_ERR_SOCKET|ECONNRESET|EPIPE|other side closed|fetch failed/i.test(String(error) + code)) {
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
      return globalThis.fetch(input, init, attempt + 1);
    }
    throw error;
  }
};

const api = async (path, options = {}) => {
  const response = await fetch('https://api.cloudflare.com/client/v4' + path, {
    ...options,
    headers: { ...H, ...(options.headers || {}) },
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
};
const apiRaw = async (path, options = {}) => {
  const response = await fetch('https://api.cloudflare.com/client/v4' + path, {
    ...options,
    headers: { ...H, ...(options.headers || {}) },
  });
  return { status: response.status, body: Buffer.from(await response.arrayBuffer()) };
};
const kvPath = (key) => `/accounts/${ACCOUNT}/storage/kv/namespaces/${KV_ID}/values/${encodeURIComponent(key)}`;
const d1Query = async (sql, params = []) => {
  const response = await api(`/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql, params }),
  });
  assert(response.json.success && response.json.result?.[0]?.success !== false,
    'D1 query failed: ' + JSON.stringify(response.json.errors || response.json.result?.[0]?.error || {}));
  return response.json.result?.[0]?.results || [];
};
const jsonRequest = async (path, options = {}) => {
  // No implicit retry for panel API calls, especially WARP registration POSTs.
  const response = await rawFetch(HOST + path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeBindings = (bindings) => bindings.map((binding) => {
  const base = { name: binding.name, type: binding.type };
  if (binding.type === 'secret_text') return base;
  if (binding.type === 'plain_text') return { ...base, text: binding.text };
  if (binding.type === 'd1') return { ...base, id: binding.id || binding.database_id };
  if (binding.type === 'kv_namespace') return { ...base, namespace_id: binding.namespace_id };
  if (binding.type === 'durable_object_namespace') {
    return { ...base, class_name: binding.class_name, script_name: binding.script_name || SCRIPT };
  }
  throw new Error('Unsupported binding type: ' + binding.type);
}).sort((a, b) => a.name.localeCompare(b.name));

const metadataFor = (settings) => ({
  main_module: 'worker.js',
  module: true,
  compatibility_date: settings.compatibility_date,
  compatibility_flags: settings.compatibility_flags,
  exports: { OmniEgress2: { type: 'durable-object', state: 'created', storage: 'sqlite' } },
  keep_bindings: ['secret_text'],
  bindings: settings.bindings.filter((binding) => binding.type !== 'secret_text').map((binding) => {
    if (binding.type === 'plain_text') return { name: binding.name, type: binding.type, text: binding.text };
    if (binding.type === 'd1') return { name: binding.name, type: binding.type, id: binding.id || binding.database_id };
    if (binding.type === 'kv_namespace') return { name: binding.name, type: binding.type, namespace_id: binding.namespace_id };
    if (binding.type === 'durable_object_namespace') {
      return { name: binding.name, type: binding.type, class_name: binding.class_name, script_name: binding.script_name || SCRIPT };
    }
    throw new Error('Unsupported binding type: ' + binding.type);
  }),
});

const getSettings = async () => {
  const response = await api(`/accounts/${ACCOUNT}/workers/scripts/${SCRIPT}/settings`);
  assert(response.json.success, 'Unable to read worker settings: ' + JSON.stringify(response.json.errors));
  return response.json.result;
};
const putKv = async (key, body) => {
  const response = await api(kvPath(key), {
    method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body,
  });
  assert(response.json.success, `KV write failed for ${key}: ` + JSON.stringify(response.json.errors));
  const readback = await apiRaw(kvPath(key));
  assert(readback.status === 200 && readback.body.equals(Buffer.from(body)), `KV readback mismatch for ${key}`);
  console.log('KV verified', key, md5(body));
};
const upload = async (body, metadata) => {
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  form.append('worker.js', new Blob([body], { type: 'application/javascript+module' }), 'worker.js');
  const response = await api(`/accounts/${ACCOUNT}/workers/scripts/${SCRIPT}`, { method: 'PUT', body: form });
  assert(response.json.success, 'Worker upload failed: ' + JSON.stringify(response.json.errors));
  console.log('Worker upload', response.status, md5(body));
};
const liveVersion = async () => {
  const response = await fetch(HOST + '/api/version', { headers: { accept: 'application/json' } });
  return { status: response.status, body: await response.json().catch(() => ({})) };
};
const waitForRevision = async (revision, panelMd5) => {
  let latest = null;
  for (let attempt = 0; attempt < 16; attempt++) {
    await sleep(3500);
    try {
      latest = await liveVersion();
      if (latest.status === 200 && latest.body.rev === revision && latest.body.md5 === panelMd5) return latest.body;
    } catch {}
  }
  throw new Error('Live revision did not converge to ' + revision + '; last status=' + latest?.status + ' rev=' + latest?.body?.rev + ' md5=' + latest?.body?.md5);
};
const latestVersion = async () => {
  const response = await api(`/accounts/${ACCOUNT}/workers/workers/${WORKER_ID}/versions?per_page=1`);
  if (!response.json.success) return null;
  const result = response.json.result;
  const version = Array.isArray(result) ? result[0] : result?.versions?.[0];
  return version ? { id: version.id, number: version.number, created_on: version.created_on } : null;
};

const liveWarpVerify = async (adminId) => {
  const beforeRows = await d1Query("SELECT value FROM settings WHERE key='warp_gaming_account'");
  const hadAccount = beforeRows.length > 0;
  const sid = (crypto.randomUUID() + crypto.randomUUID()).replaceAll('-', '');
  const cookie = 'omni_sid=' + sid;
  try {
    await d1Query("INSERT INTO sessions(id,account_id,ua,ip,expires_at,last_seen) VALUES(?,?,?,'',datetime('now','+10 minutes'),datetime('now'))",
      [sid, adminId, 'omni-rev154-live-verification']);
    const auth = { cookie, 'x-omni-csrf': '1' };
    const beforeStatus = await jsonRequest('/api/gaming/warp/status', { headers: { cookie } });
    assert(beforeStatus.status === 200, 'Authenticated WARP status unavailable');
    const responses = await Promise.all([0, 1].map(() => jsonRequest('/api/gaming/warp/generate', {
      method: 'POST', headers: auth, body: JSON.stringify({ force: false }),
    })));
    assert(responses.every((r) => r.status === 200 && r.body?.ok && r.body?.account?.privateKey && r.body?.account?.clientId && r.body?.account?.peerPublicKey && r.body?.account?.v4 && r.body?.account?.v6),
      'Live WARP generation failed: ' + responses.map((r) => r.status + '/' + (r.body?.error || 'invalid')).join(','));
    assert(responses.every((r) => r.body.account.privateKey === responses[0].body.account.privateKey), 'Concurrent live generation returned different accounts');
    assert(responses.some((r) => r.body.reused || r.body.coalesced), 'Concurrent live generation was neither coalesced nor reused');
    const reuse = await jsonRequest('/api/gaming/warp/generate', { method: 'POST', headers: auth, body: JSON.stringify({ force: false }) });
    assert(reuse.status === 200 && reuse.body?.ok && reuse.body.reused && reuse.body.account?.privateKey === responses[0].body.account.privateKey,
      'Live WARP account was not reused');
    const afterRows = await d1Query("SELECT value FROM settings WHERE key='warp_gaming_account'");
    assert(afterRows.length === 1, 'Live WARP account missing from central D1');
    const account = JSON.parse(afterRows[0].value);
    assert(account.privateKey === responses[0].body.account.privateKey && account.deviceId && account.registrationToken,
      'Persisted live WARP account is incomplete or mismatched');
    const created = responses.find((r) => r.body.reused === false && !r.body.coalesced);
    if (created || !hadAccount) assert(account.registrationApi === 'v0a5641', 'New live account did not use the current registration API');
    const afterStatus = await jsonRequest('/api/gaming/warp/status', { headers: { cookie } });
    const statusText = JSON.stringify(afterStatus.body || {});
    assert(afterStatus.status === 200 && afterStatus.body?.ok && !('registrationToken' in afterStatus.body) && !statusText.includes(account.registrationToken),
      'Live WARP status/token redaction failed');
    return { authenticatedGeneration: true, concurrentSingleAccount: true, reuse: true, d1Persisted: true, tokenRedacted: true, createdNewAccount: !!created || !hadAccount, registrationApi: account.registrationApi };
  } finally {
    await d1Query('DELETE FROM sessions WHERE id=?', [sid]);
  }
};

let settings;
let metadata;
let beforeBindings;
let beforeVersion;
let workerChanged = false;
let currentChanged = false;
const smoke = {};

(async () => {
  assert(md5(rollbackSource) === EXPECTED_REV153_MD5, 'Local rev153 rollback MD5 mismatch');
  assert(md5(source) === EXPECTED_REV154_MD5, 'Local rev154 MD5 mismatch');
  assert(sha256(source) === EXPECTED_REV154_SHA256, 'Local rev154 SHA-256 mismatch');
  assert(source.includes('OMNI_WARP_API_VERSION = "v0a5641"') && source.includes('OMNI_WARP_REGISTRATION_URL + "/reg"') && source.includes('a-6.38.9-5641') && source.includes('1.1.1.1/6.38.9-5641'), 'Current WARP registration contract missing');
  assert(source.includes('warp_rate_limited') && source.includes('warp_registration_in_progress') && source.includes('registrationApi'), 'WARP failure/coalescing implementation missing');

  settings = await getSettings();
  beforeBindings = normalizeBindings(settings.bindings);
  const names = beforeBindings.map((binding) => binding.name);
  for (const required of ['BOT_TOKEN', 'BOT_USERNAME', 'BOT_WEBHOOK_SECRET', 'DB', 'EGRESS', 'KV', 'PANEL_NAME', 'PUBLIC_HOST', 'RELEASES']) {
    assert(names.includes(required), 'Missing pre-deploy binding ' + required);
  }
  const db = beforeBindings.find((binding) => binding.name === 'DB');
  const kv = beforeBindings.find((binding) => binding.name === 'KV');
  const releases = beforeBindings.find((binding) => binding.name === 'RELEASES');
  const publicHost = beforeBindings.find((binding) => binding.name === 'PUBLIC_HOST');
  assert(db?.id === DB_ID && kv?.namespace_id === KV_ID && releases?.namespace_id === KV_ID, 'Central D1/KV binding mismatch');
  assert(publicHost?.text === HOST, 'PUBLIC_HOST mismatch');
  assert(settings.compatibility_date === '2024-09-23', 'Unexpected compatibility date');
  metadata = metadataFor(settings);
  beforeVersion = await latestVersion();

  const current = await apiRaw(kvPath(CURRENT_KEY));
  const rollback = await apiRaw(kvPath(ROLLBACK_KEY));
  assert(current.status === 200 && current.body.equals(Buffer.from(rollbackSource)), 'releases/current is not preserved rev153');
  assert(rollback.status === 200 && rollback.body.equals(Buffer.from(rollbackSource)), 'rev153 rollback KV entry mismatch');
  const beforeLive = await liveVersion();
  assert(beforeLive.status === 200 && beforeLive.body.rev === 153 && beforeLive.body.md5 === EXPECTED_REV153_PANEL_MD5, 'Live worker is not expected rev153');
  const adminRows = await d1Query("SELECT id FROM accounts WHERE role='admin' ORDER BY id LIMIT 1");
  assert(Number.isSafeInteger(Number(adminRows[0]?.id)) && Number(adminRows[0]?.id) > 0, 'No central admin account available for verification');
  const verificationAdminId = Number(adminRows[0].id);
  console.log('Preflight OK: central rev153, bindings, D1/KV, rollback and verification access verified');

  await putKv(RELEASE_KEY, source);
  workerChanged = true; // Also roll back if the upload outcome is uncertain.
  await upload(source, metadata);

  const afterSettings = await getSettings();
  const afterBindings = normalizeBindings(afterSettings.bindings);
  assert(JSON.stringify(afterBindings) === JSON.stringify(beforeBindings), 'Worker bindings changed during deployment');
  console.log('Bindings preserved', afterBindings.map((binding) => binding.name).sort().join(','));

  const deployed = await waitForRevision(154, EXPECTED_PANEL_MD5);
  smoke.version = deployed.rev === 154 && deployed.md5 === EXPECTED_PANEL_MD5;

  const panelResponse = await fetch(HOST + '/');
  const html = await panelResponse.text();
  Object.assign(smoke, {
    panelHttp200: panelResponse.status === 200,
    panelBuild: html.includes('data-build="' + EXPECTED_PANEL_MD5 + '"'),
    pack865: html.includes('۸۶۵') && html.includes('"userv4"'),
    pack139: html.includes('۱۳۹') && html.includes('"userclean"') && html.includes('غیرکلادفلر'),
    noStale255: !html.includes('۲۵۵'),
    geoHelper: html.includes('فقط داخل ایران'),
    vpnHint: html.includes('VPN خاموش'),
    shecanIp: html.includes('178.22.122.100'),
    dnsReference: html.includes('/api/diag/dns-batch'),
    warpSingleGenerationSite: html.split('fetch("/api/gaming/warp/generate"').length - 1 === 1,
    warpNoImplicitRegistration: !html.includes('await omniEnsureWarpKey(l)'),
    warpPersistentOutput: html.includes('id="omni-warp-outputs-body"') && html.includes('const keyFeedback = GAMING_VIEW_STATE.keyError'),
    warpSingleFlightUi: html.includes('var omniWarpKeyPromise = null') && html.includes('finally { omniWarpKeyPromise = null; }') && html.includes('GAMING_VIEW_STATE.keyBusy'),
    warpStateUpdatedFromResponse: html.includes('omniWarpApplyAccount(j.account)') && html.includes('GAMING_VIEW_STATE.warpAccount = account') && html.includes('GAMING_VIEW_STATE.keyError = ""'),
  });

  const noAuth = await jsonRequest('/api/app/templates');
  const badAuth = await jsonRequest('/api/app/templates', { headers: { authorization: 'Bearer invalid-central-smoke-token' } });
  const badPair = await jsonRequest('/api/app/pair', { method: 'POST', body: JSON.stringify({ code: 'INVALID', device: 'central-smoke' }) });
  const noAdmin = await jsonRequest('/api/app/pairing-code', { method: 'POST', body: '{}' });
  const scopedAdmin = await jsonRequest('/api/users', { headers: { authorization: 'Bearer invalid-central-smoke-token' } });
  const noWarpStatus = await jsonRequest('/api/gaming/warp/status');
  const noWarpGenerate = await jsonRequest('/api/gaming/warp/generate', { method: 'POST', headers: { 'x-omni-csrf': '1' }, body: JSON.stringify({ force: false }) });
  Object.assign(smoke, {
    scopedNoAuth: [401, 403].includes(noAuth.status),
    scopedBadAuth: [401, 403].includes(badAuth.status),
    invalidPairRejected: [400, 401].includes(badPair.status) && !badPair.body.access_token,
    pairingCodeAdminOnly: [401, 403].includes(noAdmin.status) && noAdmin.body.ok !== true,
    adminBearerRejected: [401, 403].includes(scopedAdmin.status),
    warpStatusAdminOnly: [401, 403].includes(noWarpStatus.status),
    warpGenerationAdminOnly: [401, 403].includes(noWarpGenerate.status),
  });

  const anonDns = await jsonRequest('/api/diag/dns-batch', {
    method: 'POST', body: JSON.stringify({ qname: 'example.com', servers: [{ id: 'cf', url: 'https://cloudflare-dns.com/dns-query' }] }),
  });
  const anonEch = await fetch(HOST + '/api/ech-config?domain=cloudflare-ech.com');
  smoke.anonDnsProtected = [401, 403].includes(anonDns.status);
  smoke.anonEchProtected = [401, 403].includes(anonEch.status);
  console.log('Live non-mutating smoke', JSON.stringify(smoke));
  assert(Object.values(smoke).every(Boolean), 'One or more non-mutating live smoke checks failed');
  const warpVerification = await liveWarpVerify(verificationAdminId);
  for (const name of ['authenticatedGeneration', 'concurrentSingleAccount', 'reuse', 'd1Persisted', 'tokenRedacted']) smoke[name] = warpVerification[name];
  console.log('Live WARP smoke', JSON.stringify({ createdNewAccount: warpVerification.createdNewAccount, registrationApi: warpVerification.registrationApi }));
  assert(Object.values(smoke).every(Boolean), 'One or more live WARP smoke checks failed');

  await putKv(CURRENT_KEY, source);
  currentChanged = true;
  const afterVersion = await latestVersion();
  const result = {
    deployed_at: new Date().toISOString(),
    account_id: ACCOUNT,
    worker_id: WORKER_ID,
    worker: SCRIPT,
    host: HOST,
    release_key: RELEASE_KEY,
    rollback_key: ROLLBACK_KEY,
    rev153_md5: md5(rollbackSource),
    rev154_md5: md5(source),
    rev154_sha256: sha256(source),
    panel_md5: EXPECTED_PANEL_MD5,
    before_version: beforeVersion,
    after_version: afterVersion,
    bindings_preserved: true,
    binding_names: afterBindings.map((binding) => binding.name),
    live_version: deployed,
    warp_verification: warpVerification,
    smoke,
  };
  fs.writeFileSync('/home/user/omni-fix/deploy-rev154-central-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log('DEPLOY rev154 CENTRAL OK', JSON.stringify({ version: afterVersion, rollback: ROLLBACK_KEY }));
})().catch(async (error) => {
  console.error('DEPLOY FAILED', error.message || String(error));
  if (workerChanged && metadata) {
    try {
      console.log('Attempting automatic rev153 rollback');
      await upload(rollbackSource, metadata);
      await waitForRevision(153, EXPECTED_REV153_PANEL_MD5);
      await putKv(CURRENT_KEY, rollbackSource);
      currentChanged = false;
      console.log('ROLLBACK rev153 OK');
    } catch (rollbackError) {
      console.error('ROLLBACK FAILED', rollbackError.message || String(rollbackError));
    }
  }
  process.exit(1);
});
