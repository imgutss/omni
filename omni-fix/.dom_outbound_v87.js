// rev147 DOM gate — root-rebuilt Outbound: honest per-IP measurement, persisted state, design system.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(__dirname, '.dom', 'node_modules', 'jsdom'));
const html = fs.readFileSync('panel.v87.final.html', 'utf8');
let fails = 0;
const ok = (c, l) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + l); if (!c) fails++; };

function makeDom() {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const m = (e.detail && e.detail.message) || e.message || '';
    if (/getContext|not implemented|canvas|WebSocket/i.test(m)) return;
    errors.push(m);
  });
  const calls = [];
  const settingsStore = { panel_name: 'Kestrel', path: '/ws', public_host: 'node.example.test' };
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://node.example.test/#/outbound', virtualConsole: vc,
    beforeParse(window) {
      window.matchMedia = () => ({ matches: false, media: '', onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } });
      window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
      window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.RTCPeerConnection = class { constructor() { throw new Error('no webrtc in harness'); } };
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
        if (url.includes('/api/mesh/probe')) {
          const body = JSON.parse(opt.body || '{}');
          const results = {};
          (body.rows || []).forEach((r) => {
            const host = String(r.ep).replace(/^\[|\].*$|:\d+$/g, '');
            const open = /^(10\.|13\.|16\.)/.test(host);
            const dead = /^192\.0\.2/.test(host);
            const cells = {};
            (r.ports || [443]).forEach((p, idx) => {
              cells[p] = open
                ? { state: 'open', ms: 9 + idx + (host.length % 17), via: 'socket', route: false, colo: null }
                : dead
                  ? { state: 'closed', ms: null, via: 'socket', route: false, colo: null }
                  : { state: 'filtered', ms: null, via: 'socket', route: false, colo: null };
            });
            results[r.ep] = { ep: r.ep, cf: false, blocked: false, ports: cells };
          });
          return j({ ok: true, mode: body.mode, supported: true, results });
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
  const { dom, errors, calls } = makeDom();
  const w = dom.window, d = w.document;
  await new Promise((r) => setTimeout(r, 1400));
  const click = (sel) => { const el = [...d.querySelectorAll(sel)]; if (!el.length) throw new Error('missing ' + sel); el[el.length - 1].click(); return el[el.length - 1]; };
  const visibleText = () => [...d.querySelectorAll('body *')]
    .filter((el) => !['SCRIPT', 'STYLE'].includes(el.tagName) && el.children.length === 0)
    .map((el) => el.textContent).join(' ');
  const store = () => JSON.parse(w.localStorage.getItem('omni.outbound.v1') || 'null');
  let txt = visibleText();

  /* 1 — render + design system + honest unmeasured state */
  ok(txt.includes('OUTBOUND / rev147'), 'rev147 kicker rendered');
  ok(txt.includes('اوت‌باند و لوکیشن'), 'outbound heading present');
  ok(/سنجیده نشده/.test(txt), 'unmeasured nodes are explicitly labeled, never assumed alive');
  ok(!/نامعدد/.test(txt), 'no «نامعدد» anywhere');
  ok(!/\?\s*ms/.test(txt), 'no "? ms" placeholder from the old probe');
  ok(!txt.includes('OUTBOUND_JSON_STATE'), 'old state name absent from UI');
  const obKicker = [...d.querySelectorAll('*')].find((el) => el.children.length === 0 && el.textContent.trim() === 'OUTBOUND / rev147');
  const obMount = obKicker && obKicker.parentElement;
  ok(!!obMount, 'outbound view mount located for scoped checks');
  const viewHtml = obMount ? obMount.innerHTML : '';
  for (const banned of ['rgba(15, 23, 42', '#06b6d4', '#22d3ee', '#34d399', '#38bdf8', '#10b981']) {
    ok(!viewHtml.includes(banned), 'old hardcoded color gone: ' + banned);
  }
  const epCodes = [...d.querySelectorAll('code.mono, code')].filter((c) => /:\d{2,5}$/.test(c.textContent.trim()));
  ok(epCodes.length >= 100, 'every catalog IP rendered as its own row (' + epCodes.length + ' ep codes)');

  /* 2 — honest batch measurement through the worker mesh contract */
  click('[data-action="omni-ob-measure-all"]');
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 300));
    if (calls.some((c) => c.url.includes('/api/mesh/probe') && c.method === 'POST') && !/در حال سنجش/.test(visibleText())) break;
  }
  await new Promise((r) => setTimeout(r, 600));
  const probeCalls = calls.filter((c) => c.url.includes('/api/mesh/probe') && c.method === 'POST');
  ok(probeCalls.length >= 2, 'catalog measured in chunked batches (' + probeCalls.length + ' calls)');
  ok(probeCalls.every((c) => (JSON.parse(c.body).rows || []).length <= 100), 'no batch exceeds the 100-row safety chunk');
  txt = visibleText();
  ok(/باز · [۰-۹0-9]+ms/.test(txt), 'open cells show real positive ms');
  ok(txt.includes('بدون پاسخ'), 'filtered/closed cells say «بدون پاسخ» with no fabricated number');
  ok(!/باز · (0|۰)ms/.test(txt) && !/باز · —ms/.test(txt), 'never a zero or null ping on an open badge');
  const st1 = store();
  ok(st1 && st1.cells && Object.keys(st1.cells).length >= 100, 'measurement cells persisted (' + Object.keys(st1.cells || {}).length + ')');
  ok(Object.values(st1.cells).every((c) => !(['open', 'handshake'].includes(c.state)) || (typeof c.ms === 'number' && c.ms > 0)), 'every open persisted cell carries a strict positive ms');
  ok(/پاسخ‌گو/.test(txt), 'country aggregates derived from real measurement');

  /* 3 — region filter persists without losing measurements */
  click('[data-action="omni-outbound-region"][data-region="eu"]');
  await new Promise((r) => setTimeout(r, 300));
  ok(store().regionFilter === 'eu', 'region filter persisted in outbound store');
  click('[data-action="omni-outbound-region"][data-region="all"]');
  await new Promise((r) => setTimeout(r, 300));

  /* 4 — hide-dead switch hides only fully-dead measured countries */
  const cardsBefore = d.querySelectorAll('[data-action="omni-outbound-toggle-cc"]').length;
  const sw = d.querySelector('#ob-hide-dead');
  ok(!!sw, 'hide-dead switch present');
  sw.checked = true;
  sw.dispatchEvent(new w.Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  const cardsAfter = d.querySelectorAll('[data-action="omni-outbound-toggle-cc"]').length;
  ok(cardsAfter < cardsBefore, 'dead countries hidden when switch is on (' + cardsBefore + ' -> ' + cardsAfter + ')');
  ok(store().hideDead === true, 'hide-dead preference persisted');
  sw.checked = false;
  sw.dispatchEvent(new w.Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));

  /* 5 — add a custom outbound (valid full URI) then an invalid one */
  d.querySelector('#outbound-new-name').value = 'آلمان اختصاصی';
  d.querySelector('#outbound-new-spec').value = 'vless://331f2f6f-1111-2222-3333-444455556666@16.63.207.85:8443?security=tls&type=ws#de-private';
  click('[data-action="omni-outbound-add"]');
  await new Promise((r) => setTimeout(r, 400));
  const putCalls = calls.filter((c) => c.url.includes('/api/settings') && c.method === 'PUT');
  ok(putCalls.some((c) => c.body.includes('custom_outbounds') && c.body.includes('16.63.207.85:8443')), 'valid custom outbound saved via /api/settings');
  txt = visibleText();
  ok(txt.includes('آلمان اختصاصی') && txt.includes('VLESS Outbound'), 'custom outbound listed with detected protocol');

  d.querySelector('#outbound-new-spec').value = 'this-is-not-a-spec';
  const beforeBad = calls.length;
  click('[data-action="omni-outbound-add"]');
  await new Promise((r) => setTimeout(r, 300));
  ok(calls.length === beforeBad, 'invalid spec rejected without any network call');
  ok(visibleText().includes('الگوی ورودی شناخته نشد'), 'invalid spec shows an honest error toast');

  /* 6 — per-item honest test of the custom outbound (host:port reachability) */
  d.querySelector('#outbound-new-spec').value = 'vless://331f2f6f-1111-2222-3333-444455556666@16.63.207.85:8443?security=tls&type=ws#de-private';
  click('[data-action="omni-outbound-test-input"]');
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if ((d.querySelector('#outbound-test-status')?.textContent || '').includes('سنجش')) break;
  }
  await new Promise((r) => setTimeout(r, 500));
  const statusTxt = d.querySelector('#outbound-test-status')?.textContent || '';
  ok(/در دسترس است · [۰-۹0-9]+ms/.test(statusTxt), 'custom test shows real positive ms: ' + statusTxt);
  ok(statusTxt.includes('ساب‌ریکوئست') || statusTxt.includes('سوکت'), 'test discloses the measurement path');
  ok(statusTxt.includes('نه اثبات کامل پروتکل'), 'test honestly limits the claim to host:port reachability');

  /* 7 — country toggle persists to settings */
  const firstCc = d.querySelector('[data-action="omni-outbound-toggle-cc"]')?.dataset?.cc;
  ok(!!firstCc, 'a country toggle exists');
  d.querySelector(`[data-action="omni-outbound-toggle-cc"][data-cc="${firstCc}"]`).click();
  await new Promise((r) => setTimeout(r, 400));
  const putCallsNow = calls.filter((c) => c.url.includes('/api/settings') && c.method === 'PUT');
  ok(putCallsNow.some((c) => c.body.includes('outbound_countries') && c.body.includes(firstCc)), 'country selection saved via /api/settings');

  /* 8 — quota JSON builder still produces valid server JSON */
  const single = d.querySelector('#ob-single-json-box')?.textContent || '';
  const marz = d.querySelector('#ob-marzban-json-box')?.textContent || '';
  ok((() => { try { const o = JSON.parse(single); return !!o.tag && o.protocol === 'vless' && o.settings && o.streamSettings; } catch { return false; } })(), 'single JSON box parses as a complete vless outbound object');
  ok((() => { try { const o = JSON.parse(marz); return Array.isArray(o.outbounds) && o.routing; } catch { return false; } })(), 'marzban JSON box parses with outbounds + routing');

  /* 9 — relay source select wired to the persisted new state */
  const relay = d.querySelector('#outbound-relay-source');
  ok(!!relay, 'relay source select present');
  relay.value = 'worker';
  relay.dispatchEvent(new w.Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  ok(store().relaySource === 'worker', 'relay source persisted in outbound store');

  const fatal = errors.filter((m) => /ReferenceError|TypeError|SyntaxError|is not a function|Cannot read/.test(m));
  ok(fatal.length === 0, 'no fatal errors' + (fatal.length ? ': ' + fatal.slice(0, 2).join(' | ') : ''));
  console.log(fails ? '\nGATE FAIL ' + fails : '\nGATE ALL PASS');
  process.exit(fails ? 1 : 0);
})();
