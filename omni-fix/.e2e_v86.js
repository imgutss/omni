// rev146 E2E — fresh id20 node: route-aware probes, own-port exit, live slots from IP pool.
const fs = require('fs');
const crypto = require('crypto');
const M = require('./.morph_lib.js');

const row = JSON.parse(fs.readFileSync('./cf_accounts_full.json', 'utf8')).results.find((a) => a.id === 20);
const tok = row.token;
const accountId = row.account_id;
const H = { authorization: 'Bearer ' + tok };
const api = async (p, opt = {}) => {
  const r = await fetch('https://api.cloudflare.com/client/v4' + p, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
let fails = 0;
const ck = (c, l) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + l); if (!c) fails++; };

(async () => {
  const sub = await api(`/accounts/${accountId}/workers/subdomain`);
  const workersSubdomain = String(sub.j.result?.subdomain || row.subdomain || '');
  if (!workersSubdomain) throw new Error('no subdomain');

  const workerName = M.omniGenericNodeNames()[0];
  const seed = workerName + ':' + accountId;
  const persona = M.omniMorphPersona(seed);
  const tokWord = M.omniMorphToken(seed);
  const dbName = M.omniGenericDbName(seed);
  const cron = M.omniGenericCron(seed);
  const webhookSecret = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  console.log('provisioning node:', { workerName, persona: persona.name, tokWord, cron });

  const db = await api(`/accounts/${accountId}/d1/database`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: dbName }),
  });
  if (!db.j.success) { console.log(db); process.exit(1); }
  const databaseId = db.j.result.uuid;
  const release = fs.readFileSync('./omni.v86.js', 'utf8');
  const { code: bundle } = M.omniPolymorphBundle(release, seed);
  const publicHost = `${workerName}.${workersSubdomain}.workers.dev`;
  let createdWorker = null;

  try {
    const cw = await api(`/accounts/${accountId}/workers/workers`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: workerName, subdomain: { enabled: false, previews_enabled: false } }),
    });
    if (!cw.j.success) throw new Error('worker create failed: ' + JSON.stringify(cw.j.errors));
    createdWorker = cw.j.result;

    const vb = await api(`/accounts/${accountId}/workers/workers/${createdWorker.id}/versions?deploy=true`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        main_module: 'worker.js', compatibility_date: '2025-01-01',
        compatibility_flags: ['nodejs_compat', 'global_fetch_strictly_public'],
        bindings: [
          { type: 'd1', name: 'DB', id: databaseId },
          { type: 'plain_text', name: 'PANEL_NAME', text: persona.name },
          { type: 'plain_text', name: 'PUBLIC_HOST', text: publicHost },
          { type: 'plain_text', name: 'BOT_WEBHOOK_SECRET', text: webhookSecret },
          { type: 'plain_text', name: 'BOT_USERNAME', text: '' },
        ],
        modules: [{ name: 'worker.js', content_type: 'application/javascript+module', content_base64: Buffer.from(bundle, 'utf8').toString('base64') }],
      }),
    });
    ck(vb.j.success, 'version deploy');
    if (!vb.j.success) throw new Error(JSON.stringify(vb.j.errors));
    await api(`/accounts/${accountId}/workers/scripts/${workerName}/subdomain`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true, previews_enabled: false }),
    });
    await api(`/accounts/${accountId}/workers/scripts/${workerName}/schedules`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ cron }]),
    });

    const base = 'https://' + publicHost;
    let ver = null, panel = '';
    for (let i = 0; i < 14; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const vr = await fetch(base + '/api/version');
        if (vr.ok) { ver = await vr.json(); panel = await (await fetch(base + '/')).text(); break; }
      } catch {}
    }
    if (!ver) throw new Error('node never came alive');
    console.log('\n== LIVE', base);
    ck(ver.rev === 146, 'rev146 live: ' + ver.rev);
    ck(ver.md5 === '1aaddade9a5f231330a210a227c3e646', 'panel contract md5');
    ck(panel.includes('<title>' + persona.title + '</title>'), 'persona title');
    ck(!/omni/i.test(panel), 'panel zero omni');
    ck(panel.includes('TCP / پورت‌ها') && panel.includes('VLESS / پروتکل') && panel.includes('UDP / STUN'), 'three real mesh modes in panel');
    ck(!panel.includes('این انتخاب فقط برچسب ثبت نتیجه در سرور است'), 'label-only disclaimer absent');
    const who = await (await fetch(base + '/api/whoami')).json();
    ck(who.panelName === persona.name, 'whoami panelName is persona-driven: ' + who.panelName);
    let clean = bundle; for (const u of M.MORPH_PROTECTED) clean = clean.split(u).join('');
    ck(!/omni/i.test(clean) && !clean.includes('Anti-1101'), 'bundle brand-free');

    // first-run setup — W2 must seed the default proxy user in the same request
    const pw = 'e2e-' + crypto.randomUUID().slice(0, 8);
    const sp = await fetch(base + '/api/setup', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: pw }),
    });
    const sjson = await sp.json();
    const cookie = (sp.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
    ck(!!cookie && sjson.ok === true, 'setup returns session');
    const SH = { cookie, ['x-' + tokWord + '-csrf']: '1', 'content-type': 'application/json' };

    const users = await (await fetch(base + '/api/users', { headers: { cookie } })).json();
    const urows = users.users || [];
    ck(urows.length >= 1 && urows[0].username === 'default', 'default proxy user auto-seeded at setup: ' + urows.length);
    ck(!!urows[0]?.uuid && urows[0].uuid.length > 30, 'seeded user has real uuid');

    // idempotency: second GET must not create another
    const users2 = await (await fetch(base + '/api/users', { headers: { cookie } })).json();
    ck((users2.users || []).length === urows.length, 'lazy ensure is idempotent');

    // TCP engine — real states: open socket (google DNS:53), filtered (TEST-NET), CF via real subrequest
    const tcp = await (await fetch(base + '/api/mesh/probe', {
      method: 'POST', headers: SH,
      body: JSON.stringify({ mode: 'tcp', rows: [
        { ep: '8.8.8.8:53', ports: [53] },
        { ep: '192.0.2.1:443', ports: [443] },
        { ep: '188.114.96.159:443', ports: [443] },
      ] }),
    })).json();
    console.log('tcp probe:', JSON.stringify(tcp.results));
    ck(tcp.ok && tcp.supported === true, 'tcp probe accepted');
    ck(tcp.results['8.8.8.8:53']?.ports?.['53']?.state === 'open' && tcp.results['8.8.8.8:53']?.ports?.['53']?.via === 'socket', 'non-CF measured with real raw socket');
    ck(['filtered', 'closed'].includes(tcp.results['192.0.2.1:443']?.ports?.['443']?.state || ''), 'unroutable host honestly filtered');
    const cfCell = tcp.results['188.114.96.159:443']?.ports?.['443'];
    ck(tcp.results['188.114.96.159:443']?.cf === true && cfCell?.via === 'subrequest' && ['open', 'handshake', 'filtered', 'closed'].includes(cfCell.state), 'CF range really measured via subrequest (not blanket-blocked): ' + JSON.stringify(cfCell));
    ck(typeof cfCell.route === 'boolean', 'rev146 CF cell carries explicit route boolean: ' + cfCell.route);

    // rev146 — /api/mesh/exit rebuilt: own port, real reachability, full evidence
    const exitCf = await (await fetch(base + '/api/mesh/exit', {
      method: 'POST', headers: SH, body: JSON.stringify({ ep: '188.114.96.159:443' }),
    })).json();
    console.log('exit CF:', JSON.stringify(exitCf));
    ck(exitCf.ok && exitCf.scope === 'worker-own-port' && exitCf.via === 'subrequest' && typeof exitCf.route === 'boolean', 'exit returns own-port evidence shape: ' + JSON.stringify(exitCf));
    ck(exitCf.alive === true && exitCf.state === 'open' && exitCf.ms > 0, 'exit sees CF edge alive with real positive ms (no null-ms): ' + exitCf.ms);
    console.log('exit service probe:', JSON.stringify(exitCf.service));
    ck(exitCf.service && ['open', 'closed'].includes(exitCf.service.state) && typeof exitCf.route === 'boolean', 'exit reconciles edge vs real service via hostname probe');
    ck(exitCf.service.state === 'open' && exitCf.service.route === true && exitCf.service.ms > 0, 'self-hostname service answer proves full chain with real ms: ' + JSON.stringify(exitCf.service));
    const exitSock = await (await fetch(base + '/api/mesh/exit', {
      method: 'POST', headers: SH, body: JSON.stringify({ ep: '8.8.8.8:53' }),
    })).json();
    console.log('exit socket:', JSON.stringify(exitSock));
    ck(exitSock.via === 'socket' && exitSock.alive === true && exitSock.ms > 0, 'exit raw-socket path works on non-CF own port: ' + JSON.stringify(exitSock));
    const exitBad = await fetch(base + '/api/mesh/exit', {
      method: 'POST', headers: SH, body: JSON.stringify({ ep: '' }),
    });
    ck(exitBad.status === 422, 'exit rejects empty endpoint with 422');
    const exitGarbage = await (await fetch(base + '/api/mesh/exit', {
      method: 'POST', headers: SH, body: JSON.stringify({ ep: 'not-an-ip' }),
    })).json();
    ck(exitGarbage.alive === false && exitGarbage.ms === null, 'garbage host honestly dead with no fake ms');

    // rev146 — live variants exist before manual apply, built from the configured IP pool
    const live0 = await (await fetch(base + '/api/mesh/live', { headers: { cookie } })).json();
    console.log('live slots:', JSON.stringify(live0.slots?.map((s) => ({ ep: s.ep, label: s.label, state: s.state, ms: s.ms }))));
    ck(Array.isArray(live0.slots) && live0.slots.length >= 1, 'fresh node gets live slots from IP pool without manual apply (' + live0.slots?.length + ')');
    ck(live0.slots.every((s) => /:\d+$/.test(s.ep) && s.label && (s.state === null || ['ok', 'fail'].includes(s.state))), 'each slot is a real host:port with label and honest state');
    if (live0.slots.length) {
      const tick = await (await fetch(base + '/api/mesh/live', { method: 'POST', headers: SH, body: JSON.stringify({ op: 'tick' }) })).json();
      ck(tick.ok === true, 'live tick accepted');
      const liveAfter = await (await fetch(base + '/api/mesh/live', { headers: { cookie } })).json();
      ck(liveAfter.slots.every((s) => ['ok', 'fail'].includes(s.state)), 'tick measured every slot into ok/fail: ' + JSON.stringify(liveAfter.slots.map((s) => ({ ep: s.ep, state: s.state, ms: s.ms }))));
    }

    // IPv6 CF destination must also get a real subrequest attempt, never a blanket label
    const v6 = await (await fetch(base + '/api/mesh/probe', {
      method: 'POST', headers: SH,
      body: JSON.stringify({ mode: 'tcp', rows: [{ ep: '[2606:4700:d0::a29f:c001]:443', ports: [443] }] }),
    })).json();
    const v6cell = v6.results?.['[2606:4700:d0::a29f:c001]:443']?.ports?.['443'];
    ck(v6cell?.via === 'subrequest' && ['open', 'handshake', 'filtered', 'closed'].includes(v6cell.state), 'IPv6 CF range really measured via subrequest: ' + JSON.stringify(v6cell));

    // VLESS engine — transport-level probe, ports accepted, CF subrequest works here too
    const vl = await (await fetch(base + '/api/mesh/probe', {
      method: 'POST', headers: SH,
      body: JSON.stringify({ mode: 'vless', rows: [{ ep: '8.8.8.8:53', ports: [53, 443] }, { ep: '188.114.96.159:443', ports: [443] }] }),
    })).json();
    ck(vl.mode === 'vless' && vl.results['8.8.8.8:53']?.ports?.['53']?.state === 'open', 'vless transport probe real');
    ck(vl.results['188.114.96.159:443']?.ports?.['443']?.via === 'subrequest', 'vless CF row really measured via subrequest');
    ck(Object.keys(vl.results['8.8.8.8:53'].ports).length === 2, 'vless accepts multi-port per endpoint (own + 443)');

    // UDP engine — honest unsupported, no fabricated rows
    const udp = await (await fetch(base + '/api/mesh/probe', {
      method: 'POST', headers: SH, body: JSON.stringify({ mode: 'udp', rows: [{ ep: '8.8.8.8:53' }] }),
    })).json();
    ck(udp.ok && udp.supported === false && Object.keys(udp.results).length === 0, 'udp honestly unsupported from worker');

    // edge evidence table exists and answers
    const edges = await (await fetch(base + '/api/mesh/edges', { headers: { cookie } })).json();
    ck(edges.ok === true && Array.isArray(edges.rows), 'edges evidence endpoint live');

    // board accepts the new modes (whitelist W6)
    const board = await (await fetch(base + '/api/mesh/board', {
      method: 'POST', headers: SH,
      body: JSON.stringify({ mode: 'tcp', rows: [{ ep: '8.8.8.8:53', state: 'open', ms: 2, fam: 4 }] }),
    })).json();
    ck(board.ok === true, 'board accepts tcp mode');

    // rev144: caps raised — 30 distinct items must all be processed (old cap was 24)
    const bigRows = Array.from({ length: 30 }, (_, i) => ({ ep: `8.8.${Math.floor(i / 8)}.${1 + (i % 8)}:443`, ports: [443] }));
    const bigProbe = await (await fetch(base + '/api/mesh/probe', {
      method: 'POST', headers: SH, body: JSON.stringify({ mode: 'tcp', rows: bigRows }),
    })).json();
    ck(Object.keys(bigProbe.results || {}).length === 30, 'probe processes all 30 items past the old 24 cap (' + Object.keys(bigProbe.results || {}).length + ')');
    const bigBoard = await (await fetch(base + '/api/mesh/board', {
      method: 'POST', headers: SH,
      body: JSON.stringify({ mode: 'vless', rows: bigRows.map((r) => ({ ...r, state: 'open', ms: 3 })) }),
    })).json();
    ck(bigBoard.ok === true, 'board accepts 30-row vless batch past the old cap');

    // auth guard: probe without session must be rejected
    const anon = await fetch(base + '/api/mesh/probe', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'tcp', rows: [] }),
    });
    ck(anon.status === 401 || anon.status === 403, 'probe requires session (' + anon.status + ')');

    // reset purges edge table too
    const rst = await (await fetch(base + '/api/mesh/reset', { method: 'POST', headers: SH })).json();
    ck(rst.ok === true && typeof rst.purged.edgeHits === 'number', 'reset includes edgeHits purge');

    console.log('\nunique bundle md5:', md5(bundle));
  } finally {
    console.log('\n== teardown');
    if (createdWorker) {
      const d = await api(`/accounts/${accountId}/workers/scripts/${workerName}`, { method: 'DELETE' });
      console.log('worker delete:', d.status, d.j.success);
    }
    const dd = await api(`/accounts/${accountId}/d1/database/${databaseId}`, { method: 'DELETE' });
    console.log('d1 delete:', dd.status, dd.j.success);
  }
  console.log(fails ? '\nE2E FAIL ' + fails : '\nE2E ALL PASS');
  process.exit(fails ? 1 : 0);
})();
