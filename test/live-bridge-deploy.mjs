/* Real end-to-end bridge deployment against the live Vercel / Netlify accounts.
 *
 *   node test/live-bridge-deploy.mjs
 *
 * Tokens are read from the environment only — nothing is written to disk, to the
 * repository or to any log:
 *
 *   OMNI_VERCEL_TOKEN=...  OMNI_NETLIFY_TOKEN=...  node test/live-bridge-deploy.mjs
 *
 * The target is the live Omni panel and the tunnel path is that panel's own
 * `settings.path`, which is what the bot now reads from the panel's D1.
 */
import { webcrypto } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = await import(path.join(root, 'src/bridges.js'));

const TARGET = process.env.OMNI_BRIDGE_TARGET || 'omni.4lifm29.workers.dev';
const TUNNEL = process.env.OMNI_BRIDGE_PATH || '/JOGpAVgq';
const VERCEL_TOKEN = process.env.OMNI_VERCEL_TOKEN || '';
const NETLIFY_TOKEN = process.env.OMNI_NETLIFY_TOKEN || '';

const log = (...a) => console.log(...a);
const suffix = Math.random().toString(36).slice(2, 6);

async function vercel() {
  if (!VERCEL_TOKEN) return log('⏭  vercel skipped (no OMNI_VERCEL_TOKEN)');
  const who = await B.verifyVercelToken(VERCEL_TOKEN);
  log(`▲ vercel account: ${who.username} <${who.email}> plan=${who.plan || '?'} team=${who.teamSlug || '-'}`);
  const t0 = Date.now();
  const r = await B.deployVercelBridge({
    token: VERCEL_TOKEN,
    name: `omni-bridge-${suffix}`,
    target: TARGET,
    tunnelPath: TUNNEL,
    onProgress: (s) => log(`   … ${s}`),
  });
  log(`▲ vercel deployed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  log(JSON.stringify(r, null, 1));
  return r;
}

async function netlify() {
  if (!NETLIFY_TOKEN) return log('⏭  netlify skipped (no OMNI_NETLIFY_TOKEN)');
  const who = await B.verifyNetlifyToken(NETLIFY_TOKEN);
  log(`◆ netlify account: ${who.username} <${who.email}>`);
  const t0 = Date.now();
  const r = await B.deployNetlifyBridge({
    token: NETLIFY_TOKEN,
    name: `omni-net-${suffix}`,
    target: TARGET,
    tunnelPath: TUNNEL,
    onProgress: (s) => log(`   … ${s}`),
  });
  log(`◆ netlify deployed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  log(JSON.stringify(r, null, 1));
  return r;
}

const [v, n] = await Promise.all([
  vercel().catch((e) => { log('▲ VERCEL FAILED:', e?.message || e); return null; }),
  netlify().catch((e) => { log('◆ NETLIFY FAILED:', e?.message || e); return null; }),
]);

log('\n=== summary ===');
log('vercel :', v?.domain || v?.url || 'none');
log('netlify:', n?.domain || n?.url || 'none');
