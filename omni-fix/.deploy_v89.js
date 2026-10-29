// rev149 production deploy: root-rebuilt DNS/DoH view (batch verdict engine,
// two honest measurement columns). Rollback keys for rev148/rev147 stay in KV.
const fs = require('fs');
const crypto = require('crypto');
const state = JSON.parse(fs.readFileSync('/home/user/omni-fix/.revive_state.json', 'utf8'));
const source = fs.readFileSync('/home/user/omni-fix/omni.v89.js', 'utf8');
const BOT_TOKEN = 'REDACTED-BOT-TOKEN-SET-BEFORE-DEPLOY';
const SCRIPT = 'omni';
const HOST = `${SCRIPT}.${state.subdomain}.workers.dev`;
const tok = JSON.parse(fs.readFileSync('/home/user/omni-fix/cf_accounts_full.json', 'utf8')).results.find((a) => a.id === 3).token;
const H = { authorization: 'Bearer ' + tok };
const api = async (p, opt = {}) => {
  const r = await fetch('https://api.cloudflare.com/client/v4' + p, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
const EXPECTED_WORKER_MD5 = 'f094a78be126e359e3e72056b258546a';
const EXPECTED_PANEL_MD5 = 'ed9b1371fd6b276672ce32cbe664906f';

const plainBindings = [
  { name: 'BOT_TOKEN', type: 'secret_text', text: BOT_TOKEN },
  { name: 'DB', type: 'd1', id: state.dbId },
  { name: 'KV', type: 'kv_namespace', namespace_id: state.kvId },
  { name: 'RELEASES', type: 'kv_namespace', namespace_id: state.kvId },
  { name: 'PUBLIC_HOST', type: 'plain_text', text: 'https://' + HOST },
];
const metadata = {
  main_module: 'worker.js',
  module: true,
  compatibility_date: '2024-09-23',
  compatibility_flags: ['nodejs_compat', 'global_fetch_strictly_public'],
  keep_bindings: ['secret_text'],
  bindings: [
    ...plainBindings.slice(0, 2),
    { name: 'EGRESS', type: 'durable_object_namespace', class_name: 'OmniEgress2', script_name: SCRIPT },
    ...plainBindings.slice(2),
  ],
};

(async () => {
  if (md5(source) !== EXPECTED_WORKER_MD5) throw new Error('local worker md5 mismatch — refusing to deploy unexpected bundle');
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  form.append('worker.js', new Blob([source], { type: 'application/javascript+module' }), 'worker.js');
  const up = await api(`/accounts/${state.acc}/workers/scripts/${SCRIPT}`, { method: 'PUT', body: form });
  console.log('script upload:', up.status, 'success=' + up.j.success, up.j.success ? '' : JSON.stringify(up.j.errors));
  if (!up.j.success) process.exit(1);

  const b = await api(`/accounts/${state.acc}/workers/scripts/${SCRIPT}/bindings`);
  const bindingNames = (b.j.result || []).map((x) => x.name).sort();
  console.log('bindings after:', JSON.stringify(bindingNames));
  for (const need of ['BOT_TOKEN', 'DB', 'EGRESS', 'KV', 'PUBLIC_HOST', 'RELEASES']) {
    if (!bindingNames.includes(need)) { console.log('MISSING BINDING', need); process.exit(1); }
  }

  const body = fs.readFileSync('/home/user/omni-fix/omni.v89.js');
  const base = `/accounts/${state.acc}/storage/kv/namespaces/${state.kvId}/values`;
  for (const key of ['releases/current', 'releases/v60.1-rev149-dns-root']) {
    const r = await api(base + '/' + encodeURIComponent(key), {
      method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body,
    });
    console.log('kv put', key, r.status, r.j.success);
    if (!r.j.success) process.exit(1);
  }
  const readBuf = Buffer.from(await (await fetch('https://api.cloudflare.com/client/v4' + base + '/' + encodeURIComponent('releases/current'), { headers: H })).arrayBuffer());
  console.log('kv readback md5:', md5(readBuf), 'match:', md5(readBuf) === md5(body));
  if (md5(readBuf) !== md5(body)) process.exit(1);

  await new Promise((r) => setTimeout(r, 6000));
  const ver = await fetch('https://' + HOST + '/api/version').then((r) => r.json()).catch((e) => ({ err: String(e) }));
  console.log('live /api/version:', JSON.stringify(ver));
  if (ver.rev !== 149 || ver.md5 !== EXPECTED_PANEL_MD5) { console.log('REV/MD5 MISMATCH — rollback needed'); process.exit(1); }

  // live smoke 1: anonymous batch DNS must be refused
  const anonDns = await fetch('https://' + HOST + '/api/diag/dns-batch', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ qname: 'example.com', servers: [{ id: 'cf', url: 'https://cloudflare-dns.com/dns-query' }] }),
  });
  console.log('anon dns-batch status:', anonDns.status);
  if (anonDns.status !== 401 && anonDns.status !== 403) { console.log('ANON DNS SMOKE FAIL'); process.exit(1); }

  // live smoke 2: retained rev148 ECH guard
  const anonEch = await fetch('https://' + HOST + '/api/ech-config?domain=cloudflare-ech.com');
  console.log('anon ech-config status:', anonEch.status);
  if (anonEch.status !== 401 && anonEch.status !== 403) { console.log('ANON ECH SMOKE FAIL'); process.exit(1); }

  // live smoke 3: panel serves the new DNS view markers
  const panel = await fetch('https://' + HOST + '/').then((r) => ({ status: r.status, text: r.text() }));
  const html = await panel.text;
  const checks = {
    http200: panel.status === 200,
    buildAttr: html.includes('data-build="' + EXPECTED_PANEL_MD5 + '"'),
    batchRef: html.includes('/api/diag/dns-batch'),
    store: html.includes('omni.dns.v1'),
    noOldQt: !html.includes('async function Qt('),
  };
  console.log('panel smoke:', JSON.stringify(checks));
  if (Object.values(checks).some((v) => !v)) { console.log('PANEL SMOKE FAIL'); process.exit(1); }

  console.log('DEPLOY rev149 OK — worker md5', md5(body), '| rollback: releases/v60.1-rev148-ech-builder');
})();
