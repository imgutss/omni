// rev148 DOM gate — ECH section in the config builder: card, modes, outputs, persistence.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(__dirname, '.dom', 'node_modules', 'jsdom'));
const html = fs.readFileSync('panel.v88.final.html', 'utf8');
let fails = 0;
const ok = (c, l) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + l); if (!c) fails++; };

const FRESH_KEY = 'AEX+FreshTestKeyAbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCD=';
const sharedMem = new Map();

function makeDom(mem) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const m = (e.detail && e.detail.message) || e.message || '';
    if (/getContext|not implemented|canvas|WebSocket|Not implemented/i.test(m)) return;
    errors.push(m);
  });
  const calls = [];
  const settingsStore = { panel_name: 'Kestrel', path: '/ws', public_host: 'node.example.test' };
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://node.example.test/#/configs', virtualConsole: vc,
    beforeParse(window) {
      window.matchMedia = () => ({ matches: false, media: '', onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } });
      window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
      window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.RTCPeerConnection = class { constructor() { throw new Error('no webrtc in harness'); } };
      const shim = {
        getItem: (k) => (mem.has(k) ? mem.get(k) : null),
        setItem: (k, v) => mem.set(k, String(v)),
        removeItem: (k) => mem.delete(k), clear: () => mem.clear(),
        key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; }
      };
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => shim });
      window.fetch = async (u, opt) => {
        const url = String(u);
        calls.push({ url, method: (opt && opt.method) || 'GET', body: (opt && opt.body) || '' });
        const j = (o, s = 200) => ({ ok: s < 400, status: s, headers: { get: (k) => String(k).toLowerCase() === 'content-type' ? 'application/json' : null }, json: async () => o, text: async () => JSON.stringify(o) });
        if (url.includes('/api/whoami')) return j({ ok: true, username: 'admin', role: 'owner', installed: true, panelName: 'Kestrel', storageMode: 'normal' });
        if (url.includes('/api/users')) return j({ users: [{ id: 1, username: 'ali', uuid: '331f2f6f-1111-2222-3333-444455556666', is_active: 1, proxies: [] }] });
        if (url.includes('/api/settings')) {
          if ((opt.method || 'GET') === 'PUT') Object.assign(settingsStore, JSON.parse(opt.body || '{}'));
          return j({ settings: { ...settingsStore }, fragments: { presets: [], fingerprints: [] } });
        }
        if (url.includes('/api/ech-config')) {
          if (url.includes('domain=bad')) return j({ ok: false, error: 'ECH در رکورد دامنه پیدا نشد' }, 404);
          return j({ ok: true, domain: 'cloudflare-ech.com', ech: FRESH_KEY, alpn: ['h2', 'http/1.1'], hints: [], source: 'doh-https-record' });
        }
        if (url.includes('/api/diag/')) return j({ ok: true });
        if (url.includes('/api/fragments')) return j({ presets: [], fingerprints: [] });
        if (url.includes('/api/sessions')) return j({ ok: true, rows: [] });
        return j({ ok: true, rows: [], users: [], settings: { ...settingsStore } });
      };
      window.addEventListener('error', (e) => errors.push('win: ' + ((e.error && e.error.message) || e.message)));
    }
  });
  return { dom, errors, calls };
}

(async () => {
  const { dom, errors, calls } = makeDom(sharedMem);
  const w = dom.window, d = w.document;
  await new Promise((r) => setTimeout(r, 1600));
  const $ = (sel) => d.querySelector(sel);
  const $$ = (sel) => [...d.querySelectorAll(sel)];
  const click = (sel) => { const el = [...$$(sel)]; if (!el.length) throw new Error('missing ' + sel); el[el.length - 1].click(); return el[el.length - 1]; };
  const visibleText = () => $$('body *').filter((el) => !['SCRIPT', 'STYLE'].includes(el.tagName) && el.children.length === 0).map((el) => el.textContent).join(' ');
  const outUris = () => $$('#cfg-out [data-action="omni-copy"]').map((b) => b.dataset.text || '').filter((t) => /^(vless|trojan):\/\//.test(t));
  const outCode = () => ($('#cfg-out code')?.textContent) || '';
  const fireChange = (el) => el.dispatchEvent(new w.Event('change', { bubbles: true }));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* 1 — collapsed card, switch off by default */
  ok(!!$('#cfg-ech-card'), 'dedicated ECH card rendered in config builder');
  ok($('#cfg-ech') && !$('#cfg-ech').checked, 'ECH switch present and off by default');
  ok(visibleText().includes('ECH — Encrypted Client Hello'), 'card heading present');
  ok($$('[data-action="omni-cfg-ech-mode"]').length === 0, 'mode controls hidden while switch is off');

  /* 2 — baseline build carries no ECH */
  click('[data-action="omni-cfg-pack"][data-v="userv4"]');
  await wait(500);
  let uris = outUris();
  ok(uris.length > 20, 'builder produced rows from the v4 pack (' + uris.length + ')');
  ok(uris.every((u) => !u.includes('ech=')), 'no ech parameter while the switch is off');

  /* 3 — switch on: shell mode payload on every v4 URI */
  $('#cfg-ech').click();
  await wait(600);
  ok($('#cfg-ech').checked && $$('[data-action="omni-cfg-ech-mode"]').length === 2, 'card expands with mode controls');
  ok($('#cfg-ech-card').textContent.includes('ech=cloudflare-ech.com+udp://1.1.1.1'), 'live payload preview shows shell form');
  uris = outUris();
  ok(uris.length > 20 && uris.every((u) => u.includes('ech=cloudflare-ech.com+udp://1.1.1.1')), 'every v4 URI carries the shell ECH payload (' + uris.length + ' rows)');
  ok(uris.every((u) => /[#&]fp=chrome(&|#)/.test(u)), 'fingerprint forced to chrome on ECH rows');
  ok(uris.every((u) => !/[#&]cs=/.test(u)), 'cipherSuites suppressed while ECH is on');
  ok([...d.querySelectorAll('#cfg-out b')].some((b) => /ECH/.test(b.textContent)), 'rendered remarks carry an ECH marker after compaction');

  /* 4 — profile that normally sets cipherSuites still gets no cs= under ECH */
  const senpai = $('[data-action="omni-cfg-profile"][data-v="senpai"]');
  if (senpai) { senpai.click(); await wait(500); uris = outUris(); ok(uris.length && uris.every((u) => !/[#&]cs=/.test(u)), 'senpai cipherSuites are still suppressed under ECH'); }
  else ok(true, 'senpai profile chip absent in this view (skipped)');
  click('[data-action="omni-cfg-pack"][data-v="userv4"]');
  await wait(500);

  /* 5 — v6 rows excluded by default; opt-in applies ECH there too */
  click('[data-action="omni-cfg-pack"][data-v="userv6"]');
  await wait(500);
  uris = outUris();
  ok(uris.length > 20, 'v6 pack produced rows (' + uris.length + ')');
  ok(uris.every((u) => !u.includes('ech=')), 'v6 rows do not get ECH while the v6 opt-in is off');
  $('#cfg-ech-v6').click();
  await wait(500);
  uris = outUris();
  ok(uris.every((u) => u.includes('ech=cloudflare-ech.com+udp://1.1.1.1')), 'v6 rows get ECH after explicit opt-in');
  $('#cfg-ech-v6').click();
  await wait(300);

  /* back to the v4 pack where ECH always applies */
  click('[data-action="omni-cfg-pack"][data-v="userv4"]');
  await wait(500);

  /* 6 — resolver chip changes the shell payload */
  click('[data-action="omni-cfg-ech-resolver"][data-v="8.8.8.8"]');
  await wait(400);
  uris = outUris();
  ok(uris.every((u) => u.includes('cloudflare-ech.com+udp://8.8.8.8')), 'resolver chip rewrites the shell payload');

  /* 7 — embedded mode puts the base64 key into URIs */
  click('[data-action="omni-cfg-ech-mode"][data-v="embed"]');
  await wait(400);
  ok(!!$('#cfg-ech-b64'), 'base64 textarea rendered in embed mode');
  uris = outUris();
  ok(uris.every((u) => /ech=AEX%2B|ech=AEX\+/.test(u)), 'embedded mode emits the base64 key in URIs');

  /* 8 — live DoH refresh updates the key */
  const before = calls.length;
  click('[data-action="omni-cfg-ech-refresh"]');
  for (let i = 0; i < 20; i++) { await wait(200); if (calls.slice(before).some((c) => c.url.includes('/api/ech-config')) && $('#cfg-ech-b64').value === FRESH_KEY) break; }
  ok(calls.some((c) => c.url.includes('/api/ech-config?domain=cloudflare-ech.com')), 'refresh calls the worker DoH endpoint');
  ok($('#cfg-ech-b64').value === FRESH_KEY, 'fresh key from DoH landed in the textarea');
  uris = outUris();
  ok(uris.every((u) => u.includes('ech=' + FRESH_KEY)), 'rebuilt URIs use the refreshed key');

  /* 9 — invalid base64 rejected honestly, state untouched */
  const ta = $('#cfg-ech-b64'); ta.value = 'garbage-not-a-key'; fireChange(ta);
  await wait(300);
  ok(visibleText().includes('بیس۶۴'), 'invalid key shows an honest error toast');
  uris = outUris();
  ok(uris.every((u) => u.includes('ech=' + FRESH_KEY)), 'invalid key did not corrupt the output');

  /* 10 — sing-box and mihomo documented shapes */
  click('[data-action="omni-cfg-ech-mode"][data-v="shell"]');
  await wait(300);
  click('[data-action="omni-fmt"][data-fmt="singbox"]');
  await wait(300);
  let code = outCode();
  ok(/\"ech\"\s*:\s*\{[^}]*\"enabled\": true/.test(code) && code.includes('"query_server_name": "cloudflare-ech.com"'), 'sing-box shell mode uses documented query_server_name discovery');
  click('[data-action="omni-cfg-ech-mode"][data-v="embed"]');
  await wait(400);
  code = outCode();
  ok(code.includes('"config": [') && code.includes('-----BEGIN ECH CONFIGS-----') && code.includes(FRESH_KEY), 'sing-box embed mode uses documented PEM-line config array');
  click('[data-action="omni-fmt"][data-fmt="clash"]');
  await wait(300);
  code = outCode();
  ok(code.includes('ech-opts:') && code.includes('enable: true') && code.includes('config: "' + FRESH_KEY + '"'), 'mihomo embed mode uses documented ech-opts.config');
  click('[data-action="omni-cfg-ech-mode"][data-v="shell"]');
  await wait(400);
  code = outCode();
  ok(code.includes('query-server-name: "cloudflare-ech.com"'), 'mihomo shell mode uses documented query-server-name');

  /* 11 — invalid domain rejected, previous value retained */
  const domInput = $('#cfg-ech-domain');
  domInput.value = 'bad domain'; fireChange(domInput);
  await wait(300);
  ok(visibleText().includes('دامنهٔ ECH معتبر نیست'), 'invalid ECH domain shows an honest toast');

  /* 12 — persistence in omni.ech.v1 and reload survival */
  const saved = JSON.parse(w.localStorage.getItem('omni.ech.v1') || 'null');
  ok(!!saved && saved.ech === true && saved.echMode === 'shell' && saved.echResolver === '8.8.8.8' && saved.echB64 === FRESH_KEY, 'ECH preferences persisted under omni.ech.v1');
  const second = makeDom(sharedMem);
  await new Promise((r) => setTimeout(r, 1600));
  const d2 = second.dom.window.document;
  const sw2 = d2.querySelector('#cfg-ech');
  ok(!!sw2 && sw2.checked && d2.querySelectorAll('[data-action="omni-cfg-ech-mode"]').length === 2, 'fresh page load restores the enabled ECH card from storage');
  ok((d2.querySelector('#cfg-ech-card')?.textContent || '').includes('udp://8.8.8.8'), 'reloaded card keeps the chosen resolver');

  ok(errors.length === 0, 'no fatal errors during the whole flow (' + errors.length + ')');
  if (errors.length) console.log(errors.slice(0, 5));
  console.log(fails ? '\nGATE FAIL ' + fails : '\nGATE ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
