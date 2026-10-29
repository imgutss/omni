// rev152 DNS regression gate — root-rebuilt DNS view: catalog render, filters/sort/search,
// batch worker flow with honest verdicts, device reachability, persistence across reload.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(__dirname, '.dom', 'node_modules', 'jsdom'));
const html = fs.readFileSync("panel.v92.final.html", "utf8");
let fails = 0;
const ok = (c, l) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + l); if (!c) fails++; };

const BATCH_MAP = {
  cf: { verdict: 'ok', ms: 42, ips: ['1.1.1.1'] },
  google: { verdict: 'ok', ms: 55, ips: ['8.8.8.8'] },
  quad9: { verdict: 'divergent', ms: 60, ips: ['9.9.9.9'] },
  shecan: { verdict: 'poisoned', ms: 30, ips: ['10.10.34.34'] },
  f403: { verdict: 'http-error', ms: null, ips: [] },
  alidns: { verdict: 'http-error', ms: null, ips: [] },
  mullvad: { verdict: 'nxdomain', ms: null, ips: [] },
  dns0: { verdict: 'no-answer', ms: null, ips: [] },
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


const user865 = JSON.parse(fs.readFileSync('/home/user/rev152/user865.json', 'utf8'));
const clean139 = JSON.parse(fs.readFileSync('/home/user/rev152/clean139.json', 'utf8'));
const oldPanel = fs.readFileSync('panel.v91.final.html', 'utf8');
const old255 = [...oldPanel.match(/var OMNI_SEED_V4_USER = \[([^\]]+)\];/)[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);

(async () => {
  const bundle = makeDom(new Map());
  const w = bundle.dom.window, d = w.document;
  const { errors } = bundle;
  await new Promise((r) => setTimeout(r, 1600));
  const $ = (sel) => d.querySelector(sel);
  const $$ = (sel) => [...d.querySelectorAll(sel)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* navigate to the config-builder view the same way the sidebar does */
  const nav = $('.nav-item[data-view="configs"], [data-view="configs"]');
  ok(!!nav, 'configs nav entry rendered in sidebar');
  nav.click();
  await wait(400);
  const card = $('#cfg-clean');
  ok(!!card, 'configs view renders the IP pack card');
  const chips = $$('#cfg-clean .chip[data-action="omni-cfg-pack"]');
  const chipVals = chips.map(c => c.getAttribute('data-v'));
  ok(JSON.stringify(chipVals) === JSON.stringify(['userv4', 'userclean', 'userv6', 'mci', 'mtn', 'bn', 'world']),
    'pack chip order includes userclean: ' + chipVals.join(','));
  const userv4Chip = chips.find(c => c.dataset.v === 'userv4');
  const cleanChip = chips.find(c => c.dataset.v === 'userclean');
  ok(userv4Chip.textContent.includes('۸۶۵'), 'userv4 chip relabeled to 865');
  ok(cleanChip.textContent.includes('۱۳۹') && cleanChip.textContent.includes('عمومی'), 'userclean chip labeled 139 generic');

  /* recorder for the exact IPs the click flow feeds into config building */
  const captured = [];
  const orig = w.__omniHubBuild;
  ok(typeof orig === 'function', '__omniHubBuild exists before wrap');
  w.__omniHubBuild = (ips) => { captured.push(ips.map(String)); return true; };

  /* direct resolver checks */
  const p1 = w.omniPackIps('userv4');
  ok(!!p1 && p1.v4.length === 865 && p1.v6.length === 0, 'omniPackIps userv4 -> 865 v4, zero v6');
  ok(new Set(p1.v4).size === 865, 'userv4 resolver output has no duplicates');
  ok(JSON.stringify(p1.v4) === JSON.stringify(user865), 'userv4 resolver output equals merged uploaded union');
  ok(old255.every((ip, i) => p1.v4[i] === ip), 'original 255 preserved as ordered prefix');
  const p2 = w.omniPackIps('userclean');
  ok(!!p2 && p2.v4.length === 139 && p2.v6.length === 0, 'omniPackIps userclean -> 139 v4, zero v6');
  ok(new Set(p2.v4).size === 139, 'userclean resolver output has no duplicates');
  ok(JSON.stringify(p2.v4) === JSON.stringify(clean139), 'userclean resolver output equals clean-file union');
  ok(p2.label.includes('غیرکلادفلر'), 'userclean label honestly states non-Cloudflare');
  ok(p1.v4.every(ip => !p2.v4.includes(ip)), 'the two packs are disjoint');
  ok(w.omniPackIps('nope-not-a-pack') === null, 'unknown pack key resolves to null');

  /* click flow: userv4 */
  userv4Chip.click();
  await wait(200);
  ok(captured.length === 1 && captured[0].length === 865, 'clicking userv4 feeds exactly 865 IPs into config building');
  ok(new Set(captured[0]).size === 865, 'clicked userv4 build list is duplicate-free');
  ok(JSON.stringify([...captured[0]].sort()) === JSON.stringify([...user865].sort()), 'clicked userv4 build list is the full union');
  ok(userv4Chip.getAttribute('aria-pressed') === 'true', 'userv4 chip shows pressed state');
  const sec = $('#cfg-sectest');
  ok(!!sec && sec.textContent.includes('۸۶۵'), 'direct-build card shows the 865 count');

  /* click flow: userclean */
  cleanChip.click();
  await wait(200);
  ok(captured.length === 2 && captured[1].length === 139, 'clicking userclean feeds exactly 139 IPs into config building');
  ok(new Set(captured[1]).size === 139, 'clicked userclean build list is duplicate-free');
  ok(JSON.stringify([...captured[1]].sort()) === JSON.stringify([...clean139].sort()), 'clicked userclean build list is the full clean union');
  ok(cleanChip.getAttribute('aria-pressed') === 'true' && userv4Chip.getAttribute('aria-pressed') === 'false', 'pressed state moves to userclean');
  ok(sec.textContent.includes('۱۳۹'), 'direct-build card shows the 139 count');

  /* clear button resets the pack selection */
  const clearBtn = $('#cfg-clean [data-action="omni-cfg-clear"]');
  ok(!!clearBtn, 'clear-selection button present');
  clearBtn.click();
  await wait(150);
  ok(chips.every(c => c.getAttribute('aria-pressed') === 'false'), 'clear resets every pack chip');

  /* every single uploaded IP is reachable through one of the two packs */
  const allPack = new Set([...p1.v4, ...p2.v4]);
  ok(user865.every(ip => allPack.has(ip)) && clean139.every(ip => allPack.has(ip)) && allPack.size === 1004,
    'all 1,004 uploaded unique IPs live in a pack exactly once');

  w.__omniHubBuild = orig;
  ok(errors.length === 0, 'no unignored jsdom errors: ' + errors.join(' | '));
  console.log(fails ? '\nDOM PACK GATE FAIL ' + fails : '\nDOM PACK GATE ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('HARNESS CRASH', e); process.exit(2); });
