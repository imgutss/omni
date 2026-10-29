// rev150 E2E — RFC 8484 binary DoH: all 20 providers + rev146–149 retention.
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
  const release = fs.readFileSync('./omni.v90.js', 'utf8');
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
    ck(ver.rev === 150, 'rev150 live: ' + ver.rev);
    ck(ver.md5 === 'e60ca054ac71ce90392342abef8b3eb5', 'panel contract md5');
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

    // rev147 — DNS hostname endpoints accepted (outbound full-URI hosts), not just IP literals
    const hostProbe = await (await fetch(base + '/api/mesh/probe', {
      method: 'POST', headers: SH,
      body: JSON.stringify({ mode: 'tcp', rows: [
        { ep: 'example.com:443', ports: [443] },
        { ep: 'nonexistent-omni-9f3k2.example:443', ports: [443] },
        { ep: '8.8.8.8:443', ports: [443] }
      ] }),
    })).json();
    console.log('hostname probe:', JSON.stringify(hostProbe.results && Object.fromEntries(Object.entries(hostProbe.results).map(([k, v]) => [k, v.ports && v.ports[Object.keys(v.ports)[0]] || v]))));
    const hc = hostProbe.results?.['example.com:443']?.ports?.['443'];
    ck(hc && hc.via === 'socket' && ['open', 'handshake', 'filtered', 'closed'].includes(hc.state), 'real DNS hostname measured through raw socket: ' + JSON.stringify(hc));
    const badHost = hostProbe.results?.['nonexistent-omni-9f3k2.example:443']?.ports?.['443'];
    ck(badHost && ['closed', 'filtered'].includes(badHost.state) && badHost.ms === null, 'unresolvable hostname honestly dead with null ms: ' + JSON.stringify(badHost));
    const ipCell = hostProbe.results?.['8.8.8.8:443']?.ports?.['443'];
    ck(!!ipCell && ['open', 'handshake', 'closed', 'filtered'].includes(ipCell.state), 'IP literal path still works alongside hostnames: ' + JSON.stringify(ipCell) + ' keys=' + Object.keys(hostProbe.results || {}).join(','));

    // rev147 — outbound settings roundtrip (custom_outbounds + outbound_countries survive save/read)
    const customOb = [{ id: 'ob_e2e1', name: 'e2e-de', flag: '🇩🇪', spec: 'vless://331f2f6f-1111-2222-3333-444455556666@16.63.207.85:8443?security=tls#e2e' }];
    const putOb = await fetch(base + '/api/settings', {
      method: 'PUT', headers: SH, body: JSON.stringify({
        custom_outbounds: JSON.stringify(customOb),
        outbound_countries: JSON.stringify(['DE', 'NL'])
      }),
    });
    const putObJ = await putOb.json();
    ck(putOb.ok && putObJ.ok, 'outbound settings PUT accepted');
    const getOb = await (await fetch(base + '/api/settings', { headers: { cookie } })).json();
    ck(getOb.settings?.custom_outbounds && getOb.settings.custom_outbounds.includes('16.63.207.85:8443'), 'custom_outbounds persisted and readable');
    const ccs = JSON.parse(getOb.settings.outbound_countries || '[]');
    ck(Array.isArray(ccs) && ccs.length === 2 && ccs[0] === 'DE', 'outbound_countries persisted and readable');
    // restore neutral outbound state so the fresh node is left clean
    await fetch(base + '/api/settings', { method: 'PUT', headers: SH, body: JSON.stringify({ custom_outbounds: '[]', outbound_countries: '[]' }) });

    // rev148 — ECH DoH endpoint: anonymous refused, live HTTPS record resolved, honest failures
    const anonEch = await fetch(base + '/api/ech-config?domain=cloudflare-ech.com');
    ck(anonEch.status === 401 || anonEch.status === 403, 'ECH endpoint refuses anonymous callers (' + anonEch.status + ')');
    const badDom = await (await fetch(base + '/api/ech-config?domain=' + encodeURIComponent('not a domain'), { headers: { cookie } })).json().catch(() => null);
    ck(badDom && badDom.ok === false, 'invalid ECH domain rejected honestly: ' + JSON.stringify(badDom));
    const deadDom = await fetch(base + '/api/ech-config?domain=' + encodeURIComponent('nonexistent-omni-9f3k2.example'), { headers: { cookie } });
    const deadDomJ = await deadDom.json().catch(() => null);
    ck(deadDom.status === 404 && deadDomJ && deadDomJ.ok === false, 'domain without ECH record is an honest 404, not a fake key: ' + JSON.stringify(deadDomJ));
    const echLive = await (await fetch(base + '/api/ech-config?domain=cloudflare-ech.com', { headers: { cookie } })).json();
    ck(echLive.ok === true && /^AEX[A-Za-z0-9+/]+={0,2}$/.test(echLive.ech) && echLive.source === 'doh-https-record', 'live cloudflare-ech.com HTTPS record resolved to a real ECH key: ' + String(echLive.ech || '').slice(0, 24) + '…');
    const rwEch = await (await fetch(base + '/api/railway-auto/ech-config?domain=cloudflare-ech.com', { headers: { cookie } })).json();
    ck(rwEch.ok === true && rwEch.ech === echLive.ech, 'railway ECH route retained and returns the same shared DoH result');
    console.log('ECH live key:', echLive.ech.slice(0, 32) + '…', 'alpn:', JSON.stringify(echLive.alpn));

    // rev150 — RFC 8484 binary DoH: auth guards, validation, then the FULL 20-provider catalog live
    const anonBatch = await fetch(base + '/api/diag/dns-batch', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ qname: 'example.com', qtype: 'A', servers: [{ id: 'cf', url: 'https://cloudflare-dns.com/dns-query' }] }),
    });
    ck(anonBatch.status === 401 || anonBatch.status === 403, 'dns-batch refuses anonymous callers (' + anonBatch.status + ')');

    const badName = await fetch(base + '/api/diag/dns-batch', {
      method: 'POST', headers: SH,
      body: JSON.stringify({ qname: 'not a domain!!!', qtype: 'A', servers: [{ id: 'cf', url: 'https://cloudflare-dns.com/dns-query' }] }),
    });
    const badNameJ = await badName.json().catch(() => null);
    ck(badName.status === 422 && badNameJ && badNameJ.ok === false, 'dns-batch rejects invalid qname with 422');

    const badServers = await fetch(base + '/api/diag/dns-batch', {
      method: 'POST', headers: SH,
      body: JSON.stringify({ qname: 'example.com', servers: [{ id: 'x', url: 'ftp://not-https.example' }] }),
    });
    ck(badServers.status === 422, 'dns-batch rejects non-https server URLs with 422');

    const capRes = await (await fetch(base + '/api/diag/dns-batch', { method: 'POST', headers: SH, body: JSON.stringify({
      qname: 'example.com', qtype: 'A',
      servers: Array.from({ length: 33 }, (_, i) => ({ id: 's' + i, url: 'https://cloudflare-dns.com/dns-query' })),
    }) })).json();
    ck(capRes.ok === true && capRes.results.length === 32, 'dns-batch hard-caps server list at 32');

    // load the same 20-entry catalog the panel ships, then measure every provider through the worker
    let catSrc = fs.readFileSync('./.dns_catalog_v89.js', 'utf8').trim().replace(/^Ut\s*=/, '').trim().replace(/,\s*$/, '');
    const CATALOG = eval('(' + catSrc + ')');
    ck(CATALOG.length === 20, 'catalog loaded with 20 resolvers (' + CATALOG.length + ')');
    const fullBatch = await (await fetch(base + '/api/diag/dns-batch', {
      method: 'POST', headers: SH,
      body: JSON.stringify({ qname: 'youtube.com', qtype: 'A', servers: CATALOG.map((x) => ({ id: x.id, url: x.url })) }),
    })).json();
    ck(fullBatch.ok === true && fullBatch.results.length === 20, 'full 20-provider batch returned');
    ck(Array.isArray(fullBatch.ref_ips) && fullBatch.ref_ips.length >= 1, 'reference IPs resolved: ' + JSON.stringify(fullBatch.ref_ips));
    const byId = Object.fromEntries(fullBatch.results.map((r) => [r.id, r]));
    const verdicts = new Set(['ok', 'divergent', 'poisoned', 'nxdomain', 'empty', 'http-error', 'no-answer']);
    let healthy = 0, honestNull = 0, positiveMs = 0;
    for (const r of fullBatch.results) {
      ck(verdicts.has(r.verdict), r.id + ' verdict in vocabulary: ' + r.verdict);
      ck(typeof r.compared === 'boolean' && typeof r.at === 'number', r.id + ' has compared flag + timestamp');
      if (['ok', 'divergent', 'poisoned'].includes(r.verdict)) {
        healthy++;
        if (Number.isInteger(r.ms) && r.ms >= 1) positiveMs++;
        ck(Array.isArray(r.ips) && r.ips.length >= 1, r.id + ' healthy verdict carries real answer IPs');
      } else {
        honestNull++;
        ck(r.ms === null, r.id + ' failed verdict honestly has null ms (' + r.verdict + ')');
      }
    }
    ck(positiveMs === healthy, 'every healthy verdict has a strictly positive ms');
    console.log('full batch table:', JSON.stringify(fullBatch.results.map((r) => [r.id, r.verdict, r.ms, (r.ips || [])[0] || r.error || ''])));

    // THE rev149 regression: these four returned http-error under the JSON-only client
    for (const id of ['google', 'quad9', 'adguard', 'opendns']) {
      const r = byId[id];
      ck(r && r.verdict !== 'http-error', id + ' no longer http-error under RFC 8484 wire client (got ' + (r && r.verdict) + ')');
      ck(r && ['ok', 'divergent', 'poisoned'].includes(r.verdict) && r.ms >= 1 && r.ips.length >= 1,
        id + ' now measured healthy with real ms+IPs: ' + JSON.stringify({ v: r && r.verdict, ms: r && r.ms }));
    }
    ck(healthy >= 10, 'at least 10/20 providers measured healthy from the CF edge (' + healthy + ')');

    // AAAA works over the same wire path
    const v6batch = await (await fetch(base + '/api/diag/dns-batch', {
      method: 'POST', headers: SH,
      body: JSON.stringify({ qname: 'youtube.com', qtype: 'AAAA', servers: [{ id: 'cf', url: 'https://cloudflare-dns.com/dns-query' }, { id: 'google', url: 'https://dns.google/dns-query' }] }),
    })).json();
    const v6ok = v6batch.results.every((r) => ['ok', 'divergent', 'poisoned'].includes(r.verdict) && r.ips.every((ip) => ip.includes(':')));
    ck(v6ok, 'AAAA wire queries return IPv6 answers: ' + JSON.stringify(v6batch.results.map((r) => [r.id, r.verdict, r.ips])));

    // honest NXDOMAIN over the wire path
    const nxBatch = await (await fetch(base + '/api/diag/dns-batch', {
      method: 'POST', headers: SH,
      body: JSON.stringify({ qname: 'nonexistent-omni-9f3k2.example', qtype: 'A', servers: [{ id: 'cf', url: 'https://cloudflare-dns.com/dns-query' }] }),
    })).json();
    ck(nxBatch.results[0].verdict === 'nxdomain' && nxBatch.results[0].ms !== null && nxBatch.results[0].ms >= 1, 'wire NXDOMAIN verdict honest with positive ms');

    // legacy GET keeps the verdict contract
    const legacy = await (await fetch(base + '/api/diag/dns?url=' + encodeURIComponent('https://dns.quad9.net/dns-query') + '&name=youtube.com&type=A', { headers: SH })).json();
    ck(verdicts.has(legacy.verdict) && typeof legacy.compared === 'boolean' && Array.isArray(legacy.ref_ips), 'legacy GET gained verdict/compared/ref_ips (quad9: ' + legacy.verdict + ')');
    ck(legacy.ms === null || legacy.ms >= 1, 'legacy GET ms never zero');

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
