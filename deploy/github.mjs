/* ساخت/به‌روزرسانی مخزن گیت‌هاب و پوش پروژه */
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const ENV_PATH = process.env.OMNI_ENV || resolve(ROOT, '..', 'cfpanel', '.env');
const REPO = process.env.OMNI_REPO || 'omni';
const PRIVATE = process.env.OMNI_REPO_PUBLIC ? false : true;

function loadEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, '');
    if (v) out[m[1]] = v;
  }
  return out;
}
const env = { ...loadEnv(ENV_PATH), ...process.env };
const TOKEN = env.GITHUB_TOKEN;
if (!TOKEN) { console.error('✖ GITHUB_TOKEN پیدا نشد'); process.exit(1); }

const api = async (path, init = {}) => {
  const r = await fetch('https://api.github.com' + path, {
    ...init,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'omni-deploy',
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  return { status: r.status, ok: r.ok, json: await r.json().catch(() => null) };
};

const run = (cmd, args, opts = {}) => new Promise((res, rej) => {
  const p = spawn(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  let out = '', err = '';
  p.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
  p.stderr.on('data', (d) => { err += d; process.stderr.write(d); });
  p.on('close', (c) => (c === 0 ? res(out) : rej(new Error(`${cmd} ${args.join(' ')} → ${c}\n${err.slice(-800)}`))));
});

const me = await api('/user');
if (!me.ok) { console.error('✖ توکن گیت‌هاب نامعتبر:', JSON.stringify(me.json)); process.exit(1); }
const login = me.json.login;
console.log('▸ کاربر گیت‌هاب:', login);

let repo = await api(`/repos/${login}/${REPO}`);
if (repo.status === 404) {
  const c = await api('/user/repos', {
    method: 'POST',
    body: JSON.stringify({
      name: REPO,
      description: '⚡ Omni — پنل VLESS/Trojan روی Cloudflare Workers با مدیریت تلگرام (رایگان، بدون سرور)',
      private: PRIVATE,
      has_issues: true,
      has_wiki: false,
      auto_init: false,
    }),
  });
  if (!c.ok) { console.error('✖ ساخت مخزن ناموفق:', JSON.stringify(c.json)); process.exit(1); }
  repo = c;
  console.log('  ✅ مخزن ساخته شد:', c.json.html_url, PRIVATE ? '(خصوصی)' : '(عمومی)');
} else {
  console.log('  ℹ️ مخزن موجود است:', repo.json.html_url);
}

const remote = `https://x-access-token:${TOKEN}@github.com/${login}/${REPO}.git`;
const git = (args, extra) => run('git', args, extra ? { env: { ...process.env, ...extra } } : {});
if (!existsSync(resolve(ROOT, '.git'))) {
  await git(['init', '-q', '-b', 'main']);
  await git(['remote', 'add', 'origin', remote]);
  console.log('  ✅ مخزن محلی ساخته شد');
} else {
  const hasOrigin = await run('git', ['remote'], { quiet: true }).then((o) => /(^|\n)origin(\n|$)/.test(o)).catch(() => false);
  await git(hasOrigin ? ['remote', 'set-url', 'origin', remote] : ['remote', 'add', 'origin', remote]);
}
await git(['add', '-A']);
const msg = process.env.OMNI_COMMIT_MSG || 'Omni panel: Cloudflare Worker + D1 + Telegram bot';
try {
  await git(['-c', 'user.name=Omni', '-c', 'user.email=omni@users.noreply.github.com', 'commit', '-q', '-m', msg]);
  console.log('  ✅ کامیت:', msg);
} catch (e) { console.log('  ℹ️ چیزی برای کامیت نبود'); }
await git(['push', '-u', 'origin', 'main', '--force']);
console.log(`\n  🚀 پوش شد: https://github.com/${login}/${REPO}\n`);
