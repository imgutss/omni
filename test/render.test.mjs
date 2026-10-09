/* Render bridge engine — mocked API tests (no real tokens, no real deploys).
   Run: node test/render.test.mjs                                              */
import assert from 'node:assert/strict';
import { renderRelaySource, deployRenderBridge } from '../src/bridges.js';

const calls = [];
let deployPolls = 0;

globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  calls.push({ u, m: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
  const json = (o) => ({ ok: true, status: 200, json: async () => o });
  if (u.startsWith('https://api.github.com/user') && !u.includes('/repos')) return json({ login: 'Alisarani7021' });
  if (u.includes('/user/repos') && opts.method === 'POST') return json({ full_name: 'Alisarani7021/omni-render-relay' });
  if (u.includes('/contents/') && opts.method === 'PUT') return json({ content: { name: 'x' } });
  if (u.includes('/contents/') && opts.method === 'GET') return json({ sha: 'abc' });
  if (u === 'https://api.render.com/v1/services' && opts.method === 'POST') return json({ service: { id: 'srv-1', name: 'omni-render-relay' } });
  if (u === 'https://api.render.com/v1/services/srv-1') return json({ service: { id: 'srv-1', subdomain: 'omni-render-relay-ab12.onrender.com' } });
  if (u.includes('/deploys?limit=1')) {
    deployPolls += 1;
    return json([{ deploy: { id: 'dep-1', status: deployPolls >= 2 ? 'live' : 'build_in_progress' } }]);
  }
  return json({});
};

// 1) relay source: node+ws pipe with early-data decode and immediate queue
const src = renderRelaySource('omni-panel.workers.dev', '/VZLdh9Ft');
assert.ok(src.includes('require("ws")'), 'ws dep');
assert.ok(src.includes('sec-websocket-protocol'), 'early-data header decode');
assert.ok(src.includes('client.on("message"'), 'client frames queued from the start');
assert.ok(src.includes('wss://omni-panel.workers.dev/VZLdh9Ft'), 'target embedded');
assert.ok(src.includes('Omni mirror - Render relay alive'), 'mirror');

// 2) deploy flow: github repo + files + render service + domain from API
const r = await deployRenderBridge({
  token: 'rnd_fake', ghToken: 'ghp_fake', target: 'omni-panel.workers.dev', tunnelPath: '/VZLdh9Ft', name: 'Omni Render Relay',
});
assert.equal(r.domain, 'omni-render-relay-ab12.onrender.com');
assert.equal(r.status, 'ready');
assert.ok(r.url.startsWith('https://omni-render-relay-ab12.onrender.com'));
const repoCreate = calls.find((c) => c.u.includes('/user/repos') && c.m === 'POST');
assert.ok(repoCreate && repoCreate.body.auto_init === true);
const puts = calls.filter((c) => c.u.includes('/contents/') && c.m === 'PUT');
assert.equal(puts.length, 2, 'package.json + server.js');
const pkg = JSON.parse(Buffer.from(puts[0].body.content, 'base64').toString('utf8'));
assert.ok(pkg.dependencies.ws, 'ws dependency in package.json');
const svc = calls.find((c) => c.u === 'https://api.render.com/v1/services' && c.m === 'POST');
assert.equal(svc.body.plan, 'free');
assert.equal(svc.body.region, 'frankfurt');
assert.equal(svc.body.repo.ownerLogin, 'Alisarani7021');
assert.equal(svc.body.envVars[0].key, 'OMNI_TARGET');
assert.equal(svc.body.envVars[0].value, 'wss://omni-panel.workers.dev/VZLdh9Ft');

// 3) repo name sanitised to a valid github/render slug
const nameCall = calls.find((c) => c.u.includes('/user/repos') && c.m === 'POST');
assert.equal(nameCall.body.name, 'omni-render-relay');
console.log('render bridge engine: 3/3 passed');
