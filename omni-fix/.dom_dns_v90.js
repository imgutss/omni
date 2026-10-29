// rev149 DOM gate — root-rebuilt DNS view: catalog render, filters/sort/search,
// batch worker flow with honest verdicts, device reachability, persistence across reload.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(__dirname, '.dom', 'node_modules', 'jsdom'));
const html = fs.readFileSync('panel.v90.final.html', 'utf8');
let fails = 0;
const ok = (c, l) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + l); if (!c) fails++; };

const BATCH_MAP = {
  cf: { verdict: 'ok', ms: 42, ips: ['1.1.1.1'] },
  google: { verdict: 'ok', ms: 55, ips: ['8.8.8.8'] },
  quad9: { verdict: 'divergent', ms: 60, ips: ['9.9.9.9'] },
  shecan: { verdict: 'poisoned', ms: 30, ips: ['10.10.34.34'] },
  f403: { verdict: 'nxdomain', ms: null, ips: [] },
  alidns: { verdict: 'http-error', ms: null, ips: [] },
  begzar: { verdict: 'no-answer', ms: null, ips: [] }
};

function makeDom(mem) {
  const errors = [];
  const calls = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const m = (e.detail && e.detail.message) || e.message || '';
    if (/getContext|not implemented|canvas|WebSocket|Not implemented/i.test(m)) return;
    errors.push(m);
  });
  const settingsStore = { dns_upstream: 'https://cloudflare-dns.com/dns-query' };
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://node.example.test/#/dashboard', virtualConsole: vc,
    beforeParse(window) {
      window.matchMedia = () => ({ matches: false, media: '', onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } });
      window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
      window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.RTCPeerConnection = class { constructor() { throw new Error('no webrtc in harness'); } };
      if (!window.AbortSignal.timeout) {
        window.AbortSignal.timeout = (ms) => { const ac = new window.AbortController(); setTimeout(() => ac.abort(), ms); return ac.signal; };
      }
      const shim = {
        getItem: (k) => (mem.has(k) ? mem.get(k) : null),
        setItem: (k, v) => mem.set(k, String(v)),
        removeItem: (k) => mem.delete(k), clear: () => mem.clear(),
        key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; }
      };
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => shim });
      window.fetch = async (u, opt) => {
        const url = String(u);
        const method = (opt && opt.method) || 'GET';
        calls.push({ url, method, body: (opt && opt.body) || '', mode: (opt && opt.mode) || '' });
        const j = (o, s = 200) => ({ ok: s < 400, status: s, headers: { get: (k) => String(k).toLowerCase() === 'content-type' ? 'application/json' : null }, json: async () => o, text: async () => JSON.stringify(o) });
        if (url.includes('/api/whoami')) return j({ ok: true, username: 'admin', role: 'owner', installed: true, panelName: 'Kestrel', storageMode: 'normal' });
        if (url.includes('/api/settings')) {
          if (method === 'PUT') Object.assign(settingsStore, JSON.parse(opt.body || '{}'));
          return j({ settings: { ...settingsStore }, fragments: { presets: [], fingerprints: [] } });
        }
        if (url.includes('/api/diag/dns-batch')) {
          const body = JSON.parse(opt.body || '{}');
          const results = (body.servers || []).map((s, i) => {
            const m = BATCH_MAP[s.id] || { verdict: 'ok', ms: 70 + i, ips: ['203.0.113.' + (1 + i)] };
            const dead = ['nxdomain', 'http-error', 'no-answer'].includes(m.verdict);
            return {
              id: s.id, url: s.url, ok: m.verdict === 'ok' || m.verdict === 'divergent' || m.verdict === 'poisoned',
              verdict: m.verdict, compared: dead ? false : true, ips: m.ips,
              ms: m.ms, http: m.verdict === 'http-error' ? 502 : 200,
              error: m.verdict === 'http-error' ? 'HTTP 502' : (dead ? 'harness failure' : null), at: Date.now()
            };
          });
          return j({ ok: true, qname: body.qname, qtype: body.qtype, colo: 'FRA', ref_ips: ['1.2.3.4'], at: Date.now(), results });
        }
        if (url.includes('/api/diag/dns')) {
          return j({ ok: true, verdict: 'ok', compared: true, ips: ['1.1.1.1'], ref_ips: ['1.2.3.4'], ms: 33, http: 200, error: null, colo: 'FRA', at: Date.now() });
        }
        /* this-device no-cors probes: radar host is forced blocked */
        if (url.includes('radar')) { const e = new TypeError('Failed to fetch'); e.name = 'TypeError'; throw e; }
        if (url.startsWith('http')) return j({ ok: true });
        if (url.includes('/api/fragments')) return j({ presets: [], fingerprints: [] });
        return j({ ok: true, rows: [], users: [], settings: { ...settingsStore } });
      };
      window.addEventListener('error', (e) => errors.push('win: ' + ((e.error && e.error.message) || e.message)));
    }
  });
  return { dom, errors, calls, settingsStore };
}

(async () => {
  const sharedMem = new Map();
  const bundle = makeDom(sharedMem);
  const w = bundle.dom.window, d = w.document;
  const { errors, calls, settingsStore } = bundle;
  await new Promise((r) => setTimeout(r, 1600));
  const $ = (sel) => d.querySelector(sel);
  const $$ = (sel) => [...d.querySelectorAll(sel)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (el) => { if (!el) throw new Error('click target missing'); el.click(); };
  const cards = () => $$('.dns-grid .dns-card:not(.hide)');
  const allCardEls = () => $$('.dns-grid .dns-card');
  const cardById = (id) => $(`.dns-card[data-dns-card="${id}"]`) || cards().find((c) => c.textContent.includes(id));
  const MS_RE = /[۰-۹0-9]+\s*ms/g;
  const hasMs = (txt) => MS_RE.test(txt);
  const faParse = (s) => Number(String(s).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace('ms', '').trim());

  /* navigate to the DNS view */
  const nav = $('[data-view="dns"]');
  ok(!!nav, 'DNS nav entry rendered in sidebar');
  click(nav);
  await wait(400);

  /* 1 — catalog renders fully */
  ok(cards().length === 20, 'all 20 resolver cards rendered (' + cards().length + ')');
  ok($('#dns-qname') && $('#dns-qname').value === 'youtube.com', 'qname input defaults to youtube.com');
  ok($('#dns-qtype') && $('#dns-qtype').value === 'A', 'qtype defaults to A');
  ok($('#dns-stats') && $('#dns-stats').textContent.includes('سالم: ۰'), 'stats bar starts at zero counts');
  ok($$('[data-action="omni-dns-wtest"]').length === 20, 'per-card worker test buttons present');
  ok($$('[data-action="omni-dns-dtest"]').length === 20, 'per-card device test buttons present');
  ok($$('[data-action="omni-copy"]').length >= 20, 'DoT copy (Android Private DNS) button on every card');
  ok($$('.badge.ir').length === 5, 'exactly 5 Iran-region cards badged');
  ok(cards().every((c) => c.querySelectorAll('code.mono').length >= 1), 'every card shows official IP chips');
  ok(cards().every((c) => /سنجیده نشده/.test(c.textContent)), 'all cards start in honest "not measured" state');

  /* 2 — search filter */
  const search = $('#dns-search');
  search.value = 'cloud';
  search.dispatchEvent(new w.Event('input', { bubbles: true }));
  await wait(120);
  ok(w.__omniDnsBound === true, 'DNS engine listeners bound once');
  ok(cards().length === 1 && cards()[0].getAttribute('data-dns-card') === 'cf', 'search narrows to matching cards (' + cards().length + ')');
  search.value = '';
  search.dispatchEvent(new w.Event('input', { bubbles: true }));
  await wait(120);
  ok(cards().length === 20, 'clearing search restores all 20 cards');
  ok(allCardEls().length === 20, 'search only toggles .hide, never removes card nodes');

  /* 3 — region filter */
  click($('[data-action="omni-dns-region"][data-v="ir"]'));
  await wait(200);
  ok(cards().length === 5 && cards().every((c) => c.querySelector('.badge.ir')), 'IR filter shows exactly the 5 Iranian resolvers');
  click($('[data-action="omni-dns-region"][data-v="all"]'));
  await wait(200);
  ok(cards().length === 20, 'all-region filter restores 20 cards');
  ok($$('[data-action="omni-dns-sort"]').length === 3, 'three sort chips present');

  /* 4 — worker batch measurement */
  click($('[data-action="omni-dns-wall"]'));
  await wait(900);
  const batchCalls = calls.filter((c) => c.url.includes('/api/diag/dns-batch') && c.method === 'POST');
  ok(batchCalls.length === 1, 'worker-all fires exactly one batch POST');
  const batchBody = JSON.parse(batchCalls[0].body);
  ok(batchBody.servers.length === 20 && batchBody.qname === 'youtube.com' && batchBody.qtype === 'A', 'batch carries all 20 servers with qname/qtype');
  const cfCard = $('.dns-card[data-dns-card="cf"]');
  ok(/سالم/.test(cfCard.textContent) && hasMs(cfCard.textContent), 'healthy card renders verdict + real positive ms');
  const shecanCard = $('.dns-card[data-dns-card="shecan"]');
  ok(!!shecanCard && /آلوده/.test(shecanCard.textContent), 'bogon answer renders poisoned verdict');
  const f403Card = $('.dns-card[data-dns-card="f403"]');
  ok(!!f403Card && /NXDOMAIN/.test(f403Card.textContent) && !/ms/.test(f403Card.querySelector('.dns-tags').textContent), 'NXDOMAIN card shows no fabricated ms');
  ok($('#dns-stats').textContent.includes('کولو ورکر: FRA'), 'stats bar shows worker colo from batch response');
  const statsTxt = $('#dns-stats').textContent;
  ok(/سالم: [۰-۹0-9]+/.test(statsTxt) && !/سالم: ۰/.test(statsTxt), 'stats bar counts updated after measurement');
  ok(/خطای HTTP: [۰-۹0-9]+/.test(statsTxt), 'granular HTTP-error bucket rendered: ' + (statsTxt.match(/خطای HTTP: [۰-۹0-9]+/) || [''])[0]);
  ok(/NXDOMAIN: [۰-۹0-9]+/.test(statsTxt), 'granular NXDOMAIN bucket rendered');
  ok(/بی‌پاسخ: [۰-۹0-9]+/.test(statsTxt), 'granular no-answer bucket rendered');
  const aliCard = $('.dns-card[data-dns-card="alidns"]');
  ok(/خطای HTTP/.test(aliCard.textContent) && /HTTP 502/.test(aliCard.textContent), 'http-error card shows explicit status code, not a generic label');

  /* 5 — fastest sort puts lowest-ms ok resolver first */
  click($('[data-action="omni-dns-sort"][data-v="fastest"]'));
  await wait(200);
  ok(cards()[0].textContent.includes('شکن') === false, 'fastest sort does not lead with a poisoned resolver');
  ok(cards()[0].getAttribute('data-dns-card') === 'cf', 'fastest healthy resolver (42ms) sorts first');

  /* 6 — hide-dead toggle */
  const hide = $('#dns-hide-dead');
  hide.checked = true;
  hide.dispatchEvent(new w.Event('change', { bubbles: true }));
  await wait(200);
  const visible = cards();
  ok(visible.every((c) => !/آلوده|NXDOMAIN|بی‌پاسخ|خطای HTTP/.test(c.textContent)), 'hide-dead removes every non-healthy card (' + visible.length + ' remain)');
  ok(visible.length < 20, 'hide-dead actually filtered cards');
  const hideOff = $('#dns-hide-dead');
  hideOff.checked = false;
  hideOff.dispatchEvent(new w.Event('change', { bubbles: true }));
  await wait(200);
  ok(cards().length === 20, 'toggling hide-dead off brings all cards back');

  /* 7 — single worker test uses the legacy GET endpoint */
  const before = calls.filter((c) => c.url.includes('/api/diag/dns?')).length;
  click($('[data-action="omni-dns-wtest"][data-id="google"]'));
  await wait(500);
  const single = calls.filter((c) => c.url.includes('/api/diag/dns?') && c.method === 'GET');
  ok(single.length === before + 1 && single[single.length - 1].url.includes('name=youtube.com'), 'single worker test calls legacy GET with qname');
  const gCard = $('.dns-card[data-dns-card="google"]');
  ok(/۳۳\s*ms/.test(gCard.textContent) && /سالم/.test(gCard.textContent), 'single-test ms and verdict rendered');

  /* 8 — device reachability: one open, radar forced blocked */
  click($('[data-action="omni-dns-dall"]'));
  await wait(1400);
  const openBadges = $$('.dns-card .badge.ok').filter((b) => /باز/.test(b.textContent));
  ok(openBadges.length >= 10, 'most DoH hosts show open HTTPS reachability from this device (' + openBadges.length + ')');
  const radarCard = $('.dns-card[data-dns-card="radar"]');
  const radarDeviceBadge = radarCard && [...radarCard.querySelectorAll('.badge')].find((b) => b.textContent.includes('📱'));
  ok(!!radarDeviceBadge && /بدون پاسخ/.test(radarDeviceBadge.textContent) && !hasMs(radarDeviceBadge.textContent), 'blocked host device badge is honest no-response with no ms (worker column may still have its own ms)');
  const deviceCalls = calls.filter((c) => c.mode === 'no-cors');
  ok(deviceCalls.length === 20 && deviceCalls.every((c) => c.url.startsWith('https://')), 'device probes are no-cors HTTPS only (UDP/853 never attempted)');

  /* 9 — details inspector compares answer vs reference */
  const cfCardFresh = $('.dns-card[data-dns-card="cf"]');
  const det = cfCardFresh.querySelector('details[data-dns-details]');
  ok(!!det, 'inspector details element present per card');
  det.open = true;
  det.dispatchEvent(new w.Event('toggle'));
  await wait(120);
  ok(det.textContent.includes('1.1.1.1') && det.textContent.includes('1.2.3.4'), 'inspector lists resolver answer alongside reference IPs');

  /* 10 — select persists dns_upstream */
  const putsBefore = calls.filter((c) => c.method === 'PUT' && c.url.includes('/api/settings')).length;
  click($('[data-action="omni-dns-select"][data-id="quad9"]'));
  await wait(500);
  const puts = calls.filter((c) => c.method === 'PUT' && c.url.includes('/api/settings'));
  ok(puts.length === putsBefore + 1 && JSON.parse(puts[puts.length - 1].body).dns_upstream.includes('quad9'), 'select PUTs the chosen DoH upstream');
  ok(cards().some((c) => /فعال/.test(c.textContent)), 'active badge rendered on the selected resolver');

  /* 11 — state persisted to localStorage */
  const raw = sharedMem.get('omni.dns.v1');
  ok(!!raw, 'omni.dns.v1 persisted to localStorage');
  const saved = JSON.parse(raw);
  ok(saved.cells && Object.keys(saved.cells).length === 20 && saved.dev && Object.keys(saved.dev).length === 20, 'all worker + device measurements persisted');
  ok(saved.expanded === 'cf', 'inspector expansion persisted via toggle listener');
  ok(saved.qname === 'youtube.com', 'qname preference persisted');

  /* 12 — fresh page load restores persisted state without new measurements */
  const bundle2 = makeDom(sharedMem);
  const w2 = bundle2.dom.window, d2 = bundle2.dom.window.document;
  await wait(1600);
  d2.querySelector('[data-view="dns"]').click();
  await wait(500);
  const cards2 = [...d2.querySelectorAll('.dns-grid .dns-card')];
  ok(cards2.length === 20, 'reloaded panel renders all 20 cards');
  const cf2 = d2.querySelector('.dns-card[data-dns-card="cf"]');
  ok(/سالم/.test(cf2.textContent) && /۴۲\s*ms/.test(cf2.textContent), 'prior worker verdict+ms restored after reload (no refetch)');
  const radar2 = d2.querySelector('.dns-card[data-dns-card="radar"]');
  ok(/بدون پاسخ/.test(radar2.textContent), 'prior device blocked state restored after reload');
  const extraBatch = bundle2.calls.filter((c) => c.url.includes('/api/diag/dns-batch')).length;
  ok(extraBatch === 0, 'reload renders cached state without firing new batch requests');
  ok(d2.querySelector('#dns-qname').value === 'youtube.com', 'qname input restored from persistence');

  /* 13 — zero fabricated numbers anywhere in rendered badges */
  const allBadges = $$('.dns-card .badge, #dns-stats .badge').map((b) => b.textContent).join('\n');
  const stripped = allBadges.replace(MS_RE, '');
  ok(!stripped.includes('ms'), 'no zero-ms or ms-less-number readings anywhere');
  const msMatches = allBadges.match(MS_RE) || [];
  ok(msMatches.length > 20 && msMatches.every((m) => faParse(m) >= 1), 'every rendered ms is strictly positive (' + msMatches.length + ' readings)');

  /* 14 — no uncaught errors during the whole flow */
  ok(errors.length === 0, 'zero uncaught DOM/script errors (' + errors.slice(0, 3).join(' | ') + ')');

  console.log(fails ? '\nDOM GATE FAIL ' + fails : '\nDOM GATE ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('HARNESS CRASH', e); process.exit(2); });
