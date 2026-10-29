// rev148 production deploy: ECH section in the config builder (shell DNS / embedded key).
const fs = require('fs');
const crypto = require('crypto');
const state = JSON.parse(fs.readFileSync('/home/user/omni-fix/.revive_state.json', 'utf8'));
const source = fs.readFileSync('/home/user/omni-fix/omni.v88.js', 'utf8');
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
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  form.append('worker.js', new Blob([source], { type: 'application/javascript+module' }), 'worker.js');
  const up = await api(`/accounts/${state.acc}/workers/scripts/${SCRIPT}`, { method: 'PUT', body: form });
  console.log('script upload:', up.status, 'success=' + up.j.success, up.j.success ? '' : JSON.stringify(up.j.errors));
  if (!up.j.success) process.exit(1);

  const b = await api(`/accounts/${state.acc}/workers/scripts/${SCRIPT}/bindings`);
  console.log('bindings after:', JSON.stringify((b.j.result || []).map((x) => ({ name: x.name, type: x.type }))));

  const body = fs.readFileSync('/home/user/omni-fix/omni.v88.js');
  const base = `/accounts/${state.acc}/storage/kv/namespaces/${state.kvId}/values`;
  for (const key of ['releases/current', 'releases/v60.1-rev148-ech-builder']) {
    const r = await api(base + '/' + encodeURIComponent(key), {
      method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body,
    });
    console.log('kv put', key, r.status, r.j.success);
    if (!r.j.success) process.exit(1);
  }
  const readBuf = Buffer.from(await (await fetch('https://api.cloudflare.com/client/v4' + base + '/' + encodeURIComponent('releases/current'), { headers: H })).arrayBuffer());
  console.log('kv readback md5:', md5(readBuf), 'match:', md5(readBuf) === md5(body));
  if (md5(readBuf) !== md5(body)) process.exit(1);

  await new Promise((r) => setTimeout(r, 5000));
  const ver = await fetch('https://' + HOST + '/api/version').then((r) => r.json()).catch((e) => ({ err: String(e) }));
  console.log('live /api/version:', JSON.stringify(ver));
  if (ver.rev !== 148) { console.log('REV MISMATCH — rollback needed'); process.exit(1); }

  // live smoke: anonymous ECH endpoint must refuse; authed path is covered by E2E on fresh nodes
  const anon = await fetch('https://' + HOST + '/api/ech-config?domain=cloudflare-ech.com');
  console.log('anon /api/ech-config status:', anon.status);
  if (anon.status !== 401 && anon.status !== 403) { console.log('ANON ECH SMOKE FAIL'); process.exit(1); }
  console.log('DEPLOY rev148 OK — worker md5', md5(body));
})();
