/* Browser regression for the automatic bridge card in the panel (Deno-only since
   2026-10-09 — Vercel/Netlify removed: their edges refuse client traffic).
   Mocked APIs only — no real token, no real deploy.
   Run: node test/bridge.test.mjs                                              */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const HOST = 'omni-test.invalid';
const NEW_DENO_DOMAIN = 'ali.guts.deno.net';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const results = [];
const errors = [];
const deployBodies = [];
const verifyBodies = [];

try {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));

  const settings = {
    panel_name: 'Omni', public_host: 'omni-panel.workers.dev', path: '/VZLdh9Ft',
    clean_ips: ['104.17.148.17'], ip_pool: '104.17.148.17', ipv6_pool: [], address_domains: [],
    selected_country: 'DE', proxy_ips: [], proto: 'both', port: '443', ipv6_enabled: '0', fragment_preset: 'none',
  };
  const user = {
    username: 'bridge-test', uuid: '11111111-1111-4111-8111-111111111111',
    sub_token: 'test-only', status: 'active', quota_gb: 10, used_bytes: 0,
  };

  let bridgeRows = [];
  let bridgeSeq = 0;

  await page.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname;
    const method = route.request().method();
    if (u.hostname !== HOST) return route.abort('failed');
    if (p === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(new URL('panel.html', root), 'utf8') });
    if (p === '/healthz') return route.fulfill({ status: 200, body: 'ok' });

    let body = { ok: true };
    if (p === '/api/whoami') body = { ok: true, installed: true, username: 'admin', role: 'admin', panelName: 'Omni' };
    else if (p === '/api/settings') body = { ok: true, settings };
    else if (p === '/api/users') body = { ok: true, users: [user], total: 1 };
    else if (p === '/api/fragments') body = { ok: true, presets: [], fingerprints: [] };
    else if (p === '/api/overview') body = { ok: true, total: 1, users: { total: 1, active: 1 }, series: [] };
    else if (p === '/api/diag/net-sense') body = { ok: true, isp: { name: 'MCI', fragment: 'mci', fragmentRule: 'tlshello' }, ipVersion: 'IPv4', applied_ips: [] };
    else if (p === '/api/bridge/verify') {
      verifyBodies.push(route.request().postDataJSON());
      const req = route.request().postDataJSON();
      if (!String(req.token || '').startsWith('good')) {
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'bad_token', error: 'توکن را قبول نکرد: Not authorized' }) });
      }
      body = { ok: true, platform: req.platform, account: { username: 'guts', email: 'g@example.com', plan: 'free' }, token: 'good••••oken' };
    } else if (p === '/api/bridge' && method === 'POST') {
      const req = route.request().postDataJSON();
      deployBodies.push(req);
      const id = ++bridgeSeq;
      const domain = NEW_DENO_DOMAIN;
      bridgeRows.unshift({
        id, platform: req.platform, name: req.name || `omni-relay-${id}`, domain,
        url: `https://${domain}`, target_host: req.target, tunnel_path: req.tunnel_path || '/VZLdh9Ft',
        status: 'deploying', error: null, dashboard_url: `https://dash.deno.com/${id}`,
        created_at: 'now', updated_at: 'now',
      });
      body = { ok: true, id, name: req.name || `omni-relay-${id}`, platform: req.platform, target: req.target, status: 'deploying' };
    } else if (p === '/api/bridge' && method === 'GET') {
      body = { ok: true, bridges: bridgeRows, target: 'omni-panel.workers.dev', path: '/VZLdh9Ft', can_deploy: true };
    } else if (p.startsWith('/api/bridge/')) {
      const id = Number(p.split('/')[3]);
      const row = bridgeRows.find((r) => r.id === id);
      if (!row) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'not_found', error: 'پلی پیدا نشد' }) });
      row.status = 'ready';
      body = { ok: true, bridge: row };
    }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'x-omni': '1' }, body: JSON.stringify(body) });
  });

  const t = async (name, fn) => {
    try { await fn(); results.push(`✅ ${name}`); }
    catch (e) { results.push(`❌ ${name}: ${e.message}`); process.exitCode = 1; }
  };

  await page.goto(`https://${HOST}/#/national_net_bridge`);

  await t('the automatic Deno card is the default (no vercel/netlify tabs)', async () => {
    await page.locator('#natnet-auto-token-deno').waitFor({ timeout: 15000 });
    assert.equal(await page.locator('[data-action="omni-natnet-auto-deploy"][data-plat="deno"]').count(), 1);
    assert.equal(await page.locator('[data-action="omni-natnet-auto-verify"][data-plat="deno"]').count(), 1);
    assert.equal(await page.locator('[data-action="omni-natnet-subtab"][data-sub="vercel"]').count(), 0);
    assert.equal(await page.locator('[data-action="omni-natnet-subtab"][data-sub="netlify"]').count(), 0);
  });

  await t('the removal verdict notice is visible', async () => {
    const body = await page.evaluate(() => document.body.innerText);
    assert.ok(body.includes('ورسل و نتلیفای حذف شدند'), 'verdict notice missing');
    assert.ok(body.includes('429'), 'notice must cite the live netlify evidence');
  });

  await t('an invalid token is reported inline, not swallowed', async () => {
    await page.fill('#natnet-auto-token-deno', 'bad-token-value');
    await page.locator('[data-action="omni-natnet-auto-verify"][data-plat="deno"]').click();
    await page.waitForFunction(() => document.querySelector('#natnet-auto-out-deno')?.innerText.includes('Not authorized'), {}, { timeout: 8000 });
    assert.equal(verifyBodies.at(-1).platform, 'deno');
  });

  await t('a valid token verifies and shows the account', async () => {
    await page.fill('#natnet-auto-token-deno', 'good-deno-token-0123456789');
    await page.locator('[data-action="omni-natnet-auto-verify"][data-plat="deno"]').click();
    await page.waitForFunction(() => document.querySelector('#natnet-auto-out-deno')?.innerText.includes('معتبر'), {}, { timeout: 8000 });
    assert((await page.locator('#natnet-auto-out-deno').innerText()).includes('guts'));
  });

  await t('deploy sends the token, target and tunnel path to the worker', async () => {
    await page.fill('#natnet-auto-name-deno', 'omni-relay-test');
    await page.fill('#natnet-auto-target-deno', 'omni-panel.workers.dev');
    await page.locator('[data-action="omni-natnet-auto-deploy"][data-plat="deno"]').click();
    await page.waitForFunction(() => document.body.innerText.includes('ali.guts.deno.net'), {}, { timeout: 30000 });
    const sent = deployBodies.at(-1);
    assert.equal(sent.platform, 'deno');
    assert.equal(sent.token, 'good-deno-token-0123456789');
    assert.equal(sent.target, 'omni-panel.workers.dev');
    assert.equal(sent.tunnel_path, '/VZLdh9Ft');
    assert.equal(sent.name, 'omni-relay-test');
  });

  await t('relay configs carry the relay domain, no ed=, alpn http/1.1', async () => {
    await page.waitForFunction(() => [...document.querySelectorAll('[data-uri]')].some((e) => (e.dataset.uri || '').includes('deno.net')), {}, { timeout: 8000 });
    const uris = await page.locator('[data-uri]').evaluateAll((els) => els.map((e) => e.dataset.uri).filter((v) => v.startsWith('vless://')));
    const relayUris = uris.filter((v) => new URL(v).hostname === NEW_DENO_DOMAIN);
    assert.ok(relayUris.length >= 1, 'no relay config rendered');
    assert.ok(relayUris.every((v) => v.includes('type=ws')), 'relay configs must be WS');
    assert.ok(relayUris.every((v) => v.includes('sni=' + NEW_DENO_DOMAIN)), 'relay SNI must be the relay domain');
    assert.ok(relayUris.every((v) => v.includes('alpn=http%2F1.1') || v.includes('alpn=http/1.1')), 'relay alpn must be http/1.1');
    assert.ok(relayUris.every((v) => !v.includes('ed=')), 'relay configs must NOT carry ?ed= early-data');
    assert.ok(relayUris.every((v) => !v.includes('fragment=')), 'relay configs must NOT carry fragment');
  });

  await t('deployed bridges are listed and can be re-selected', async () => {
    await page.locator('[data-action="omni-natnet-auto-refresh"]').click();
    await page.waitForFunction(() => document.body.innerText.includes('✅ آماده'), {}, { timeout: 10000 });
    assert.equal(await page.locator('[data-action="omni-natnet-auto-use"]').count(), 1);
    assert.equal(await page.locator('[data-action="omni-natnet-auto-redeploy"]').count(), 1);
  });

  await t('green CF routes still render below', async () => {
    const body = await page.evaluate(() => document.body.innerText);
    assert.ok(body.includes('CF 104.16.5.5'), 'CF clean-IP route missing');
  });

  await t('no uncaught javascript errors', async () => {
    assert.deepEqual(errors, []);
  });

  await page.screenshot({ path: new URL('bridge-auto-deno.png', root).pathname, fullPage: true, animations: 'disabled' });
  await context.close();
} finally {
  await browser.close();
}

console.log(results.join('\n'))
fs.writeFileSync(new URL('bridge-results.json', root), JSON.stringify({ results, errors, deployBodies, verifyBodies }, null, 2));
console.log(`\n${results.filter((r) => r.startsWith('✅')).length}/${results.length} passed`);
