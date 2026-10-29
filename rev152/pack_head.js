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

