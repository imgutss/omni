/* Render bridge engine v2 — ONE-TOKEN flow (like Deno), mocked API tests.
   Schema verified live against api.render.com on 2026-10-09:
   type=web_service · ownerId required · repo is a URL *string* ·
   build/start commands in serviceDetails.envSpecificDetails ·
   HTTP 402 = workspace card gate (surfaced verbatim).
   Run: node test/render.test.mjs                                              */
import assert from 'node:assert/strict';
import { renderRelaySource, deployRenderBridge, deployBridge, verifyRenderToken, bridgeTokenShape, isBridgePlatform, RENDER_RELAY_REPO } from '../src/bridges.js';

const OWNERS = [{ cursor: 'x', owner: { email: 'user@example.com', id: 'tea-1', name: 'My Workspace', type: 'team' } }];

function mockFetch(handlers) {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ u, m: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
    const json = (o, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => o });
    for (const [match, handler] of handlers) {
      if (match(u, opts)) return handler(calls);
    }
    return json({});
  };
  return calls;
}

// 1) relay source: node+ws pipe with early-data decode and immediate queue
const src = renderRelaySource('omni-panel.workers.dev', '/VZLdh9Ft');
assert.ok(src.includes('require("ws")'), 'ws dep');
assert.ok(src.includes('sec-websocket-protocol'), 'early-data header decode');
assert.ok(src.includes('client.on("message"'), 'client frames queued from the start');
assert.ok(src.includes('wss://omni-panel.workers.dev/VZLdh9Ft'), 'target embedded');
assert.ok(src.includes('Omni mirror - Render relay alive'), 'mirror');

// 2) one-token deploy flow: NO GitHub calls, live-verified service schema, domain from API
let deployPolls = 0;
const calls = mockFetch([
  [(u) => u === 'https://api.render.com/v1/owners', () => ({ ok: true, status: 200, json: async () => OWNERS })],
  [(u, o) => u === 'https://api.render.com/v1/services' && o.method === 'POST',
    () => ({ ok: true, status: 200, json: async () => ({ service: { id: 'srv-1', name: 'omni-relay-x', serviceDetails: { url: 'https://omni-relay-x.onrender.com' } } }) })],
  [(u) => u === 'https://api.render.com/v1/services/srv-1',
    () => ({ ok: true, status: 200, json: async () => ({ service: { id: 'srv-1', serviceDetails: { url: 'https://omni-relay-x.onrender.com' } } }) })],
  [(u) => u.includes('/deploys?limit=1'), () => {
    deployPolls += 1;
    return { ok: true, status: 200, json: async () => [{ deploy: { id: 'dep-1', status: deployPolls >= 2 ? 'live' : 'build_in_progress' } }] };
  }],
]);
const r = await deployRenderBridge({ token: 'rnd_fake', target: 'omni-panel.workers.dev', tunnelPath: '/VZLdh9Ft', name: 'Omni Relay' });
assert.equal(r.state, 'ready');
assert.equal(r.domain, 'omni-relay-x.onrender.com');
assert.equal(r.url, 'https://omni-relay-x.onrender.com');
assert.equal(r.dashboard, 'https://dashboard.render.com/web/srv-1');
assert.ok(!calls.some((c) => c.u.includes('api.github.com')), 'one-token flow must not touch GitHub');
const svc = calls.find((c) => c.u === 'https://api.render.com/v1/services' && c.m === 'POST');
assert.equal(svc.body.type, 'web_service');
assert.equal(svc.body.ownerId, 'tea-1');
assert.equal(typeof svc.body.repo, 'string', 'repo is a URL string');
assert.equal(svc.body.repo, RENDER_RELAY_REPO);
assert.equal(svc.body.branch, 'main');
assert.equal(svc.body.serviceDetails.runtime, 'node');
assert.equal(svc.body.serviceDetails.plan, 'free');
assert.equal(svc.body.serviceDetails.region, 'frankfurt');
assert.equal(svc.body.serviceDetails.envSpecificDetails.buildCommand, 'npm install');
assert.equal(svc.body.serviceDetails.envSpecificDetails.startCommand, 'node server.js');
assert.equal(svc.body.envVars[0].key, 'OMNI_TARGET');
assert.equal(svc.body.envVars[0].value, 'wss://omni-panel.workers.dev/VZLdh9Ft');
assert.match(svc.body.name, /^omni-relay-[a-z0-9]{4}$/, 'unique workspace name');

// 3) HTTP 402 card gate → honest Persian payment error, flagged for the UI
mockFetch([
  [(u) => u === 'https://api.render.com/v1/owners', () => ({ ok: true, status: 200, json: async () => OWNERS })],
  [(u, o) => u === 'https://api.render.com/v1/services' && o.method === 'POST',
    () => ({ ok: false, status: 402, json: async () => ({ message: 'Payment information is required to complete this request.' }) })],
]);
const e402 = await deployRenderBridge({ token: 'rnd_fake', target: 'omni-panel.workers.dev', tunnelPath: '/t' }).then(() => null, (e) => e);
assert.ok(e402 && e402.payment === true, '402 flagged as payment');
assert.ok(e402.message.includes('dashboard.render.com/billing'), 'billing link in the message');

// 4) bad key → auth error from verifyRenderToken; deployBridge routes render; token shape gate
mockFetch([
  [(u) => u === 'https://api.render.com/v1/owners', () => ({ ok: false, status: 401, json: async () => ({ message: 'unauthorized' }) })],
]);
const e401 = await verifyRenderToken('rnd_bad').then(() => null, (e) => e);
assert.ok(e401 && e401.auth === true, '401 flagged as auth');
const eRoute = await deployBridge('render', { token: '' }).then(() => null, (e) => e);
assert.ok(eRoute && /خالی/.test(eRoute.message), 'deployBridge dispatches render');
assert.ok(isBridgePlatform('render'));
assert.ok(bridgeTokenShape('render', 'rnd_wQRB8MKgibrcQ0cd8Cf9jp4ziPZK'));
assert.ok(!bridgeTokenShape('render', 'ghp_nope'));
console.log('render bridge engine v2: 4/4 passed');
