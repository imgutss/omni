// rev146 gate — route-aware labels, multi-provider DNS, 8-host edge, live bootstrap.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(__dirname, '.dom', 'node_modules', 'jsdom'));
const html = fs.readFileSync('panel.v86.final.html', 'utf8');
let fails = 0;
const ok = (c, l) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + l); if (!c) fails++; };

function makeDom(users) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const m = (e.detail && e.detail.message) || e.message || '';
    if (/getContext|not implemented|canvas|WebSocket/i.test(m)) return;
    errors.push(m);
  });
  const calls = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://node.example.test/#/mesh', virtualConsole: vc,
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
        if (/dns-query|\/resolve/.test(url)) return j({ Status: 0, Answer: [{ type: 1, data: '104.16.1.1' }] });
        if (url.includes('/api/mesh/exit')) return j({ ok: true, alive: true, state: 'open', ms: 3, colo: 'THR', via: 'subrequest', route: true, service: { state: 'open', ms: 5, http: 200, route: true, colo: 'THR' }, scope: 'worker-own-port' });
        if (url.includes('/api/mesh/apply')) return j({ ok: true, settings: { path: '/ws', public_host: 'node.example.test' } });
        if (url.includes('/api/users')) return j({ users });
        if (url.includes('/api/settings')) return j({ settings: { panel_name: 'Kestrel', path: '/ws', public_host: 'node.example.test' }, fragments: { presets: [], fingerprints: [] } });
        if (url.includes('/api/diag/net-sense')) return j({ ok: true, isp: { name: 'MCI', code: 'mci' }, ipVersion: 'IPv4', colo: 'THR' });
        if (url.includes('/api/mesh/probe')) {
          const body = JSON.parse(opt.body || '{}');
          const results = {};
          (body.rows || []).forEach((r) => {
            const host = String(r.ep).replace(/^\[|\].*$|:\d+$/g, '');
            const cf = /^(162\.159|188\.114|104\.|172\.6[4-9]|172\.7[0-1])/.test(host);
            const ports = r.ports || [443];
            const cells = {};
            ports.forEach((p) => { cells[p] = cf ? { state: 'open', ms: 41, via: 'subrequest', route: p === 443, colo: p === 443 ? 'THR' : null } : { state: 'filtered', ms: null, via: 'socket', route: false }; });
            results[r.ep] = { ep: r.ep, cf, blocked: false, ports: cells };
          });
          return j({ ok: true, mode: body.mode, supported: true, results });
        }
        if (url.includes('/api/mesh/edges')) return j({ ok: true, rows: [{ colo: 'THR', fam: 4, hits: 3, last_at: new Date().toISOString() }] });
        if (url.includes('/api/mesh/board')) return j({ ok: true, rows: [], samples: [] });
        if (url.includes('/api/mesh/score')) return j({ ok: true });
        if (url.includes('/api/mesh/live')) return j({ ok: true, watching: false, slots: [] });
        if (url.includes('/api/fragments')) return j({ presets: [], fingerprints: [] });
        if (url.includes('/api/sessions')) return j({ ok: true, rows: [] });
        // one v4 endpoint answers on every port; one host fully times out; everything else resets fast
        if (url.includes('188.114.96.159')) return j({});
        if (url.includes('162.159.192.1')) { const err = new Error('The operation timed out'); err.name = 'TimeoutError'; return Promise.reject(err); } // filtered, no ms
        if (/^https:\/\/(\[[0-9a-fA-F:]+\]|\d+\.\d+\.\d+\.\d+)/.test(url)) {
          const err = new Error('reset'); err.name = 'Error'; return Promise.reject(err);
        }
        return j({ ok: true, rows: [], users, settings: { panel_name: 'Kestrel', path: '/ws', public_host: 'node.example.test' } });
      };
      window.addEventListener('error', (e) => errors.push('win: ' + ((e.error && e.error.message) || e.message)));
    }
  });
  return { dom, errors, calls };
}

(async () => {
  const { dom, errors, calls } = makeDom([{ id: 1, username: 'ali', uuid: '331f2f6f-1111-2222-3333-444455556666', is_active: 1 }]);
  const w = dom.window, d = w.document;
  await new Promise((r) => setTimeout(r, 1200));
  const click = (sel) => { const el = [...d.querySelectorAll(sel)]; if (!el.length) throw new Error('missing ' + sel); el[el.length - 1].click(); };
  const visibleText = () => [...d.querySelectorAll('body *')]
    .filter((el) => !['SCRIPT', 'STYLE'].includes(el.tagName) && el.children.length === 0)
    .map((el) => el.textContent).join(' ');
  const store = () => JSON.parse(w.localStorage.getItem('omni.mesh.v6') || 'null');
  const noNaN = (label) => ok(!visibleText().includes('نامعدد'), label);
  const noFakeZero = (label) => ok(!/پینگ:\s*۰?\s*ms/.test(visibleText()) && !visibleText().includes('پینگ: ۰ms'), label);

  ok(html.includes('omni.mesh.v6') && html.includes('function meshNum('), 'v6 store + strict meshNum present');
  ok(html.includes('meshApplyBest') && html.includes('meshDnsCheck') && html.includes('exitRoute'), 'rev146 engine pieces present');

  /* TCP run */
  click('[data-mode="tcp"]');
  await new Promise((r) => setTimeout(r, 60));
  click('[data-action="omni-mesh-race"]');
  await new Promise((r) => setTimeout(r, 9000));
  let txt = visibleText();
  noNaN('no «نامعدد» after TCP');
  noFakeZero('no fake green 0ms ping anywhere after TCP');
  ok(txt.includes('پینگ: بدون پاسخ'), 'dead rows show neutral «بدون پاسخ», not a fake ping');
  ok(/خودش\s*\d+:/.test(txt), "endpoint's own service port is probed and labeled «خودش»");
  ok(txt.includes('آی‌پی نسخهٔ ۴') && txt.includes('آی‌پی نسخهٔ ۶'), 'v4/v6 group headers');
  const z1 = store();
  ok(z1 && z1.tcp && z1.tcp.rows.length > 24, 'all library rows stored (' + (z1?.tcp?.rows.length || 0) + ')');
  // every row must carry its own port in the probed port list
  const ownPortOk = z1.tcp.rows.every((r) => r.ports.includes(r.port));
  ok(ownPortOk, 'every row probed on its own library port');
  // no ms value may be 0 or null-derived inside port cells that claim open/handshake
  const cleanCells = z1.tcp.rows.every((r) => r.ports.every((p) => {
    const c = r.dev[p];
    return !(c.state === 'open' || c.state === 'handshake') || (typeof c.ms === 'number' && c.ms > 0);
  }));
  ok(cleanCells, 'every open/handshake cell carries a real positive ms');
  // worker call must include own ports and response cells render with subrequest label
  const probeCall = calls.filter((c) => c.url.includes('/api/mesh/probe') && c.method === 'POST').pop();
  const sent = JSON.parse(probeCall.body);
  ok(sent.rows.every((r) => r.ports.length >= 7), 'worker asked to measure own port + 6 TLS ports per endpoint');
  ok(txt.includes('ساب‌ریکوئست'), 'CF-range worker measurement rendered as real subrequest probe');
  ok(!txt.includes('cf-blocked') && !txt.includes('رنج CF (از دستگاه)'), 'blanket cf-blocked label gone');
  ok(txt.includes('مسیر کامل') || txt.includes('فقط لبه'), 'route-aware worker badge labels rendered');
  ok(/مسیر کامل سرویس/.test(txt), 'TCP summary counts full-route worker evidence');
  const wkCells = z1.tcp.rows.flatMap((r) => Object.values(r.wk?.ports || {}));
  ok(wkCells.length && wkCells.every((c) => typeof c.route === 'boolean'), 'every worker cell carries an explicit route boolean');

  /* three-layer diagnosis — rebuilt from the root */
  click('[data-action="omni-mesh-diag"]');
  await new Promise((r) => setTimeout(r, 7000));
  txt = visibleText();
  ok(/۴ ارائه‌دهنده/.test(txt), 'diag DNS card names the four DoH providers');
  ok(/پاسخ‌گو/.test(txt) && /۸ میزبان/.test(txt), 'edge layer shows real 8-host counts');
  ok(!/·ms—|—ms|ms\s*—/.test(txt), 'no null-ms «—ms—» glitch anywhere in diag');
  ok(/اندپوینت سنجش خروج/.test(txt), 'exit endpoint disclosed per measurement');
  ok(/مسیر کامل/.test(txt), 'exit card distinguishes full service route');
  ok(/سرویس خودِ ورکر/.test(txt) && /پاسخ‌گوی کامل/.test(txt), 'edge-vs-service reconciliation rendered');

  /* live variants bootstrap from the best real measurement */
  const bestBtn = [...d.querySelectorAll('[data-action="omni-mesh-apply-best"]')].pop();
  ok(!!bestBtn, 'apply-best CTA rendered while no live slots exist');
  bestBtn.click();
  await new Promise((r) => setTimeout(r, 900));
  ok(calls.some((c) => c.url.includes('/api/mesh/apply') && c.method === 'POST'), 'apply-best posts a real /api/mesh/apply');

  /* VLESS run — two real cells per row */
  click('[data-mode="vless"]');
  await new Promise((r) => setTimeout(r, 60));
  click('[data-action="omni-mesh-race"]');
  await new Promise((r) => setTimeout(r, 8000));
  txt = visibleText();
  noNaN('no «نامعدد» after VLESS');
  noFakeZero('no fake 0ms ping after VLESS');
  ok(/پورت خودش\s*\d+:/.test(txt), 'VLESS row has own-port device cell');
  ok(txt.includes('۴۴۳:'), 'VLESS row has separate 443 device cell');
  ok(txt.includes('شواهد ترافیک واقعی VLESS'), 'evidence card present');
  const z2 = store();
  ok(!!(z2.vless && z2.tcp), 'separate per-mode run results coexist');
  const vlessCellsOk = z2.vless.rows.every((r) => r.dev && r.dev443 &&
    [r.dev, r.dev443].every((c) => !['open', 'handshake'].includes(c.state) || (typeof c.ms === 'number' && c.ms > 0)));
  ok(vlessCellsOk, 'VLESS cells never carry fake/null ping on success');

  /* UDP run — honest all-fail in harness, no fake rows */
  click('[data-mode="udp"]');
  await new Promise((r) => setTimeout(r, 60));
  click('[data-action="omni-mesh-race"]');
  await new Promise((r) => setTimeout(r, 4000));
  txt = visibleText();
  noNaN('no «نامعدد» after UDP');
  for (const name of ['Cloudflare', 'Google 2', 'Twilio', 'Nextcloud']) ok(txt.includes(name), 'STUN row: ' + name);
  ok(/باخت کل: ۱۰۰/.test(txt), 'honest 100% loss when WebRTC unavailable');
  const z3 = store();
  ok(z3.udp.targets.length === 5 && !!(z3.tcp && z3.vless), 'five STUN targets + all three runs stored');

  /* config builder guard */
  const cfgNav = d.querySelector('[data-view="configs"]');
  if (cfgNav) cfgNav.click();
  await new Promise((r) => setTimeout(r, 500));
  const hubKey = Object.keys(w).find((k) => /^__.+HubBuild$/.test(k));
  ok(!!hubKey && w[hubKey](['188.114.96.159'], { protos: ['vless'], ports: [443] }) === true, 'hub build works with proxy user');
  const empty = makeDom([]);
  await new Promise((r) => setTimeout(r, 1200));
  const ek = Object.keys(empty.dom.window).find((k) => /^__.+HubBuild$/.test(k));
  const ret = empty.dom.window[ek](['188.114.96.159'], { protos: ['vless'], ports: [443] });
  await new Promise((r) => setTimeout(r, 200));
  ok(ret === false && empty.dom.window.document.getElementById('toasts').textContent.includes('هنوز کاربر پروکسی ساخته نشده'), 'empty-user guard intact');

  const fatal = errors.filter((m) => /ReferenceError|TypeError|SyntaxError|is not a function|Cannot read/.test(m));
  ok(fatal.length === 0, 'no fatal errors' + (fatal.length ? ': ' + fatal.slice(0, 2).join(' | ') : ''));
  console.log(fails ? '\nGATE FAIL ' + fails : '\nGATE ALL PASS');
  process.exit(fails ? 1 : 0);
})();
