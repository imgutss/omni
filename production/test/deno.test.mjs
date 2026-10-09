// Deno Deploy bridge engine — mocked API flow test
import assert from 'node:assert';

const calls = [];
let revPolls = 0;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  calls.push({ method: opts.method || 'GET', url: u, body: opts.body || null, auth: (opts.headers || {}).authorization });
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  if (u.endsWith('/v2/apps') && (opts.method || 'GET') === 'GET') return json({ items: [] });
  if (u.endsWith('/v2/apps') && opts.method === 'POST') return json({ id: 'app-1', slug: JSON.parse(opts.body).slug });
  if (/\/v2\/apps\/[^/]+\/deploy$/.test(u)) return json({ id: 'rev-1', status: 'building' });
  if (/\/v2\/revisions\/rev-1$/.test(u)) { revPolls += 1; return json(revPolls >= 2 ? { id: 'rev-1', status: 'succeeded' } : { id: 'rev-1', status: 'building' }); }
  if (/\/v2\/revisions\/rev-1\/timelines$/.test(u)) return json([{ name: 'Production', context: 'prod', hostnames: ['ali.guts.deno.net'] }]);
  return new Response('{"error":"nf"}', { status: 404 });
};

const m = await import('../../src/bridges.js');

// 1) platform registration
assert.equal(m.isBridgePlatform('deno'), true);
assert.equal(m.bridgeTokenShape('deno', 'dno_abcdef1234567890abcdef'), true);
assert.equal(m.bridgeTokenShape('deno', 'short'), false);

// 2) relay source embeds the WS target
const src = m.denoRelaySource('omni-x.workers.dev', '/VZLdh9Ft');
assert.ok(src.includes('wss://omni-x.workers.dev/VZLdh9Ft'));
assert.ok(src.includes('Deno.upgradeWebSocket'));
assert.ok(src.includes('connectUp')); assert.ok(src.includes('res.webSocket'));

// 3) full deploy flow
const r = await m.deployDenoBridge({
  token: 'dno_test_token_1234567890ab',
  name: 'Omni Relay',
  target: 'https://omni-nova-f61e.catclient-59gk2mui.workers.dev/',
  tunnelPath: '/VZLdh9Ft',
});
assert.equal(r.domain, 'ali.guts.deno.net'); // real hostname from timelines, not guessed
assert.equal(r.url, 'https://ali.guts.deno.net');
assert.equal(r.status, 'ready');

const deployCall = calls.find((c) => /\/deploy$/.test(c.url));
assert.ok(deployCall, 'deploy POST happened');
const body = JSON.parse(deployCall.body);
assert.ok(body.assets['main.ts'].content.includes('wss://omni-nova-f61e.catclient-59gk2mui.workers.dev/VZLdh9Ft'));
assert.ok(body.assets['main.ts'].encoding === 'utf-8');
assert.ok(calls.every((c) => String(c.auth || '').startsWith('Bearer dno_test_token')));

// 4) verify path
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ method: opts.method || 'GET', url: String(url), auth: (opts.headers || {}).authorization });
  return new Response(JSON.stringify({ items: [{ id: 'a' }, { id: 'b' }] }), { status: 200 });
};
const who = await m.verifyDenoToken('dno_test_token_1234567890ab');
assert.ok(who.username.includes('2 apps'), who.username);

// 5) dispatch goes through deployBridge
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  const json = (o) => new Response(JSON.stringify(o), { status: 200 });
  if (u.endsWith('/v2/apps') && (opts.method || 'GET') === 'GET') return json({ items: [{ id: 'x', slug: 'gutsm-relay' }] });
  if (/\/deploy$/.test(u)) return json({ id: 'rev-9', status: 'succeeded' });
  return json({});
};
const r2 = await m.deployBridge('deno', { token: 'dno_test_token_1234567890ab', name: 'gutsm-relay', target: 'omni-x.workers.dev', tunnelPath: '/t' });
assert.equal(r2.domain, 'gutsm-relay.deno.dev');

console.log('deno bridge engine: 5/5 passed');
