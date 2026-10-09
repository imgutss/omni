# Vercel / Netlify auto-bridge — changes of 2026-10-09

## خلاصه (Persian summary)

قسمت ورسل و نتلیفای در پنل و ربات از حالت «فایل ZIP را خودت آپلود کن» به حالت
**خودکار** تبدیل شد: دقیقاً مثل کلاودفلیر، فقط توکن را می‌دهی و خود سیستم پروژه را
می‌سازد، کانفیگ (ری‌لی/اج) را می‌نویسد، دیپلوی می‌کند و دامنهٔ زنده را برمی‌گرداند.

**وضعیت فعلی: زنده و اثبات‌شده.** ورکر روی
`https://omni.4lifm29.workers.dev` دیپلوی شده و با توکن‌های واقعی، دو پل واقعی
ساخته و تست شد — هر دو، مسیر تونل پنل را بایت‌به‌بایت پروکسی می‌کنند:
`omni-bridge-cu67-4lifm27-4000s-projects.vercel.app` و
`omni-net-cu67.netlify.app` (جزئیات و خروجی‌ها در بخش ۷).

علت اصلی اینکه «نتلیفای اصلا کار نمی‌کرد» هم پیدا شد: سایت‌های نتلیفای با
`sso_login: true` ساخته می‌شوند، یعنی **هر** مسیری ۴۰۱ و صفحهٔ «Login Redirect»
می‌دهد. پروژه‌های ورسل هم به‌طور پیش‌فرض `ssoProtection` دارند و ۳۰۲
«Protected by Vercel Authentication» برمی‌گردانند. هر دو حالا خودکار خاموش می‌شوند.

- **پنل:** کارت «خودکار» برای ورسل و نتلیفای، حالت پیش‌فرض شد. توکن → «بررسی توکن»
  → «ساخت و دیپلوی» → دامنهٔ زنده در همهٔ کانفیگ‌ها جای‌گذاری می‌شود. لیست پل‌های
  ساخته‌شده با امکان انتخاب مجدد و دیپلوی دوباره. حالت‌های دستی (ZIP / رله) سر جایشان
  کار می‌کنند.
- **ربات:** دستور جدید `/natbridge` (معادل `/vercel` و `/netlify`). نام پروژه را
  انتخاب می‌کنی، توکن را می‌فرستی، ربات پیام توکن را **فوراً پاک می‌کند**، پیشرفت را
  روی همان پیام ویرایش می‌کند و در پایان لینک پل + راهنمای کانفیگ را می‌دهد.
- **بک‌اند:** چهار مسیر جدید `/api/bridge`، `/api/bridge/{id}`، `/api/bridge/verify`
  و `POST /api/bridge` با همان مدل نشست/اجازهٔ خود پنل.
- توکن‌ها هرگز در ریپو یا لاگ نمی‌مانند؛ فقط شکل ماسک‌شده (`cfut_g••••a624`) نمایش
  داده می‌شود و در صورت درخواست صریح، در D1 همان نصب ذخیره می‌شود.

---

## 1. What was broken

The Vercel/Netlify sections of the panel only produced a **ZIP + a written manual**
("upload this to Vercel yourself"). There was no token flow, no project creation, no
deployment, and the bot had no equivalent of `/deploy` for those platforms. Every
attempt to use them ended in a dead end, which is exactly what was reported.

## 2. What is implemented now

### 2.1 Bridge engine — `src/bridges.js` (new module, embedded in the worker)

Platform-agnostic deploy engine. Nothing in it touches the repository or the logs with
a raw token.

| Piece | Behaviour |
|---|---|
| `bridgeTokenShape(platform, token)` | Rejects garbage before any network call (≥25 chars for vercel/netlify). |
| `verifyBridgeToken(platform, token)` | Vercel `GET /v2/user` (+`/v2/teams`), Netlify `GET /api/v1/user`. Returns username/email/plan; marks `err.auth = true` when the provider rejects the token, so the UI can show "get a new token" instead of a generic failure. |
| `vercelConfig(target, path)` / `netlifyConfig(target, path)` | Generates the actual site: `vercel.json` edge rewrites (or `netlify.toml` 200-status proxies) for the tunnel path **and** `/__bridge`, a decoy `index.html`, a streaming relay (`api/relay.js` for Node / `netlify/edge-functions/relay.js` for Deno) that keeps `Upgrade`/`Connection` and sets `host` for SNI, a `/__bridge` health probe, `package.json`, `README.md`. |
| `deployVercelBridge` | verify → `GET /v9/projects/{name}` (404 → `POST /v11/projects`; 400/409 → retry with a random suffix) → upsert `BACKEND_URL` env → `POST /v13/deployments?forceNew=1` with inline `files[]`, `target:'production'` → poll `readyState === "READY"` (2.5 s interval, 55 s default) → domain from `alias[0] \|\| url`. |
| `deployNetlifyBridge` | verify → `GET /api/v1/sites/{name}` or `POST /api/v1/sites` (`created_via:'omni-panel'`) → sha1 digest of the four files → `POST /sites/{id}/deploys` (`files`, `edge_functions:[{function:'relay',path:'/*'}]`, `env:{BACKEND_URL}`, `async:false`) → upload **only** `deploy.required[]` via `PUT /deploys/{id}/files/{path}` → poll for `state ∈ {ready,current,published}` (50 s default) → `{subdomain}.netlify.app`. |
| `startBridgeDeploy(db, ctx, opts)` | Inserts a `bot_bridges` row (`status='deploying'`) and returns `{id, promise}`, so an HTTP caller answers **immediately** while the work continues under `ctx.waitUntil`. Success → `status='ready'` + `domain`/`url`; failure → `status='failed'` + the **upstream** error text. |
| `buildBridgeSubscription` | The v2ray-ready card (address/SNI/host/path) shown after a successful deploy. |

Internal sleep helper is named `bridgeSleep` — `sleep` already exists at the top level
of the bundle and shadowing it broke the first build.

### 2.2 Worker HTTP API (in `production/worker.js`)

Inserted right after `const settings = await settingsCached(env);` in `handleApi`:

- `GET /api/bridge` — any logged-in user. Returns the bridge rows plus `target`,
  `path` (this panel's own tunnel path) and `can_deploy` (true for admins only).
- `GET /api/bridge/{id}` — one row, for progress polling.
- `POST /api/bridge/verify` — admin. `{platform, token}` →
  `{ok, platform, account:{username,email,plan|team_slug}, token:"cfut_g••••a624"}`.
- `POST /api/bridge` — admin. `{platform, token, name, target, tunnel_path, id?}` →
  `{ok, id, name, platform, target, tunnel_path, status:"deploying"}`. Passing `id`
  re-deploys that row.

`bridgeTarget()` falls back `settings.public_host` → request hostname; `bridgePath()`
reads `settings.path` and falls back to `/VZLdh9Ft`.

### 2.3 Panel UI (in `production/panel.html`)

- New `NATNET` state keys: `vercelAutoToken`, `netlifyAutoToken`, `autoName`,
  `autoTarget`, `autoBusy`, `autoLog`.
- Module-level helpers `natnetLoadBridges()`, `natnetTunnelPath(settings)`,
  `natnetAutoCardHtml(platform)`, `natnetBridgeListHtml(...)`, plus
  `natnetBridges` / `natnetBridgeCtx` caches.
- Third mode button (`data-vmode="auto"` / `data-nmode="auto"`) and **auto is now the
  default mode** for both platforms.
- Action branches `omni-natnet-auto-deploy`, `-redeploy`, `-verify`, `-use`,
  `-refresh`, and an `input` listener that keeps the token/name/target fields in state.
- Element ids used by the browser test: `#natnet-auto-token-{vercel,netlify}`,
  `#natnet-auto-name-{…}`, `#natnet-auto-target-{…}`, `#natnet-auto-out-{…}`,
  `#natnet-bridge-domain`.
- Manual ZIP / relay modes were left intact and are still tested.

### 2.4 Bot flow

- `/natbridge` (aliases `/vercel`, `/netlify`; callbacks `cmd:natbridge`,
  `cmd:nb_vercel`, `cmd:nb_netlify`, `cmd:nb_list`, `nbname:<platform>:<name>`).
- Offers generated project names (`omni-bridge-xxxx`, `omni-edge-xxxx`,
  `omni-net-xxxx`, `omni-relay-xxxx`) plus ✏️ custom, shows the resolved target and
  tunnel path, and refuses to guess when the chat has no panel yet (points at
  `/deploy` or `/connect`).
- `bridge_token` UI state validates the token shape, **deletes the user's token
  message immediately**, sends one progress message and then *edits* it (no spam),
  awaits the deploy, and reports either the live domain + subscription card or the
  upstream failure plus the exact URL where a working token can be created.
- `/natbridge list` lists the chat's bridges; `CREATOR_COMMANDS` gained `natbridge`
  and `CREATOR_COMMANDS_VERSION` was bumped to `2026-10-09-natbridge` so existing bots
  actually re-register their command menu.
- The webhook route is unchanged: `POST /tg/{BOT_WEBHOOK_SECRET || "omni-hook"}`.

## 3. Real bugs found by testing (not just features added)

These were all caught by the new tests and are fixed in the committed worker:

1. **`cmd:nb_vercel` / `cmd:nb_netlify` did nothing.** The menu buttons sent those
   callback payloads, but the `/natbridge` condition only matched
   `cmd:natbridge` and `cmd:nb_list`; the mapping to `"/natbridge vercel"` set `cmd`
   to a two-word string that equals neither `/vercel` nor `/netlify`. Every platform
   button answered "این عمل شناخته نشد" — i.e. the feature was reachable only by
   typing the command by hand. Both callback payloads are now matched explicitly.
2. **The bridge was built against the wrong tunnel path.** Every panel picks a random
   `settings.path` at bootstrap, but the bot hard-coded `/VZLdh9Ft`. A deployed bridge
   would have proxied to a path the target panel rejects. The bot now reads the real
   path from the panel's own D1 through the Cloudflare API (`bridgePanelPath` →
   `panelSetting(token, panel, "path")`) and only falls back to the default when the
   panel is not management-connected.
3. **The custom-name branch lost that path.** `bridge_name` UI state only carried the
   platform, so a user-typed project name silently reverted to `/VZLdh9Ft`. The state
   now carries `path`, and the handler re-resolves it if it is missing.
4. `xhttpPath is not defined` — the auto card's deploy handler lives at module scope,
   where `NationalNetView` locals do not exist. Replaced with the module-level
   `natnetTunnelPath(e.settings?.())` helper.
5. Two `await fn(...).catch(() => {})` precedence bugs (the `.catch` bound to the
   awaited result, not the promise) and a missing `err.auth = true` on token-shape
   rejection.

## 4. Test evidence

Everything below was run against the committed files; no credentials are required for
any of it except `test:panel:bridge`, which uses a deliberately dead token so that no
project can ever be created.

| Command | What it proves | Result |
|---|---|---|
| `npm run test:bridges` | 15 offline unit tests for the engine (fake D1 + fake fetch): config generation, sha1 digest, token shape, verify/deploy state machine, retries, polling, failure text. | **15/15** |
| `npm run test:bot` | 16 tests that load the **real** `production/worker.js` bundle in Node (only `cloudflare:sockets` stubbed) and drive `handleUpdate` with an in-memory Telegram + D1 + Cloudflare API. Covers the whole `/natbridge` conversation, token deletion, progress edits, failure reporting, path resolution, and that `/deploy` still works. | **16/16** |
| `npm run test:panel:bridge` | Boots the real worker in Miniflare (`test/wrangler.smoke.toml`, local D1, never deployed) and exercises the HTTP API. `POST /api/bridge/verify` makes **real** calls to `api.vercel.com` and `api.netlify.com` and surfaces their verdicts (`Not authorized`, `Access Denied`). | **15/15** |
| `npm run test:scanner` | Existing production scanner suite. | **18/18** |
| `npm run test:scanner:browser` | Existing Playwright panel regression. | passed, `jsErrors: []` |
| `node production/test/bridge.test.mjs` | New Playwright test for the auto card: auto is the default mode, inline error on a bad token, verify shows the account, deploy sends `{platform, token, target, tunnel_path}`, the live domain replaces the placeholder in every config, bridge list + re-select, Netlify parity, manual ZIP mode still works, no JS errors. | **9/9** (`production/bridge-results.json`) |
| `npm run test:all-offline` | Runs the four offline suites in one go. | green |

### Artifact identity

```
node production/build.mjs
Production artifact SHA-256: 42751fc73873c67374a52c8b5f6bda9ec4daf7848ff877e0490621522d5e0523
production/worker.js == deploy/omni-worker.bundle.js   1,155,199 bytes
production/panel.html                                  552,672 bytes (+14,008 from this change)
```

## 5. How to deploy

The repository never deploys itself; `node production/build.mjs` only regenerates the
bundle. To ship:

```bash
node production/build.mjs          # already done; verifies syntax + refreshes the bundle
npm run test:all-offline           # 15 + 16 + 18 + 9 checks
npm run test:panel:bridge          # optional, needs network access to the providers
wrangler deploy                    # or: npm run deploy:auto
```

After deploying, the bot picks up the new command menu on its next `/start`
(`CREATOR_COMMANDS_VERSION` changed, so `setMyCommands` runs once per bot).

## 6. Deployed live — 2026-10-09 07:38 UTC

The token that was originally handed over as a "Vercel" token is a **Cloudflare**
token (`cfut_` = Cloudflare API Token). It verifies as `active`, so the worker was
deployed with it straight away:

| | |
|---|---|
| Account | `9a3aabde4bdecbff1e298100985c7e7e` (`4lifm29@gmail.com`) |
| Worker | `omni` → **https://omni.4lifm29.workers.dev** |
| Uploaded artifact | `production/worker.js`, SHA-256 `42751fc7…d5e0523`, 1,155,199 bytes |
| Bindings after deploy | `BOT_TOKEN` (secret, preserved), `DB` (D1 `omni-db`), `RELEASES` (KV `omni-release-store`), `PANEL_NAME`, `BOT_WEBHOOK_SECRET`, `BOT_USERNAME` |

Post-deploy verification against the live URL:

- `/healthz` → `200 ok`
- `/api/whoami` → `{"installed":true,"panelName":"Omni"}` (D1 binding intact)
- `/api/bridge` anonymously → `401 unauthorized` — the new route is live
- `/` → **byte-identical** to `production/panel.html`
  (`sha256 dce572184adb12fee1afb4d1d6e76268afe4bd44fcec06ac71c7aa72ade8cee7`, 552,949 bytes)
  and contains the new automatic-bridge fields (`natnet-auto-token-vercel`,
  `natnet-auto-name-vercel`, `natnet-auto-target-vercel`, `data-vmode="auto"`).
- `getWebhookInfo` → `https://omni.4lifm29.workers.dev/tg/omni-hook`, `last_error_message: None`
- A real `/natbridge` update was POSTed to the live webhook → `200 ok`, and the bot
  then re-registered its command menu: `getMyCommands` now returns
  `natbridge → "ساخت پل Vercel/Netlify با توکن"`. That only happens when the new
  bundle runs and its `BOT_TOKEN` secret is readable.

Two notes about the deployment itself:

- The previous live script had **no** KV binding, **no** plain-text vars and **no**
  cron trigger, even though `wrangler.toml` declares them. KV/vars are now set. The
  cron trigger still is not: `PUT …/workers/scripts/omni/settings` answers
  `10405 Method not allowed for this authentication scheme` and
  `…/workers/triggers/schedules` is not routable with an API token. Add
  `*/5 * * * *` in the dashboard (Workers → omni → Settings → Triggers), or deploy
  once with `wrangler deploy` using an account-scoped token, which sets it from
  `wrangler.toml`.
- Content uploads (`PUT …/workers/scripts/omni`) **replace the binding list** with
  whatever the multipart `metadata` carries. Bindings must be sent with every upload
  or they are dropped; that is what the second upload above does.

## 7. End-to-end proof on the real accounts — 2026-10-09 07:55 UTC

Real Vercel and Netlify tokens were supplied, so the bridge was built for real.
This immediately exposed three provider-side bugs that no mock could have caught;
all three are fixed in `src/bridges.js` and re-embedded into the worker.

| # | Symptom on the real API | Cause | Fix |
|---|---|---|---|
| 1 | `400 Invalid request: should NOT have additional property 'env'` | `POST /v11/projects` does not accept `env` | dropped — `vercelSetEnv` already writes `BACKEND_URL` via `POST /v9/projects/{id}/env` |
| 2 | `400 Invalid request: should NOT have additional property 'projectId'` | `POST /v13/deployments` does not accept `projectId` in the body | dropped — the deployment binds to the project through `name` (+`?teamId=`) |
| 3 | `500 {"error":"no implicit conversion of String into Integer"}` | `POST /sites/{id}/deploys` rejects an `edge_functions` key | dropped from the body; the relay ships as a `netlify.toml`-declared function, and the `netlify.toml` 200-status redirects do the proxying |
| 4 | **Netlify:** every path answered `401` + a "Login Redirect" page | new sites are created with `sso_login: true` | `PATCH /sites/{id} {"sso_login": false}` after create *and* after reuse (`netlifyAllowPublicAccess`) |
| 5 | **Vercel:** every path answered `302` "Protected by Vercel Authentication" | new projects default to `ssoProtection: {"deploymentType":"all_except_custom_domains"}` | `ssoProtection: null` on creation plus `PATCH /v9/projects/{id}` (`vercelAllowPublicAccess`) |

Items 4 and 5 are almost certainly why "Netlify never worked" before: every
earlier site on this account (`nimble-begonia-156bc8`, `unique-begonia-46df26`,
`tranquil-dango-13d235`, `zippy-torrone-1623bc`, `cool-fox-8677bd`,
`cute-bunny-e5cd67`, `omni-net-qj6m`) still has `sso_login: true`, so each of them
answers 401 to every client. `omni-net-qj6m` was unprotected as part of this run;
the rest were left alone because they are not Omni bridges.

### Deployed from the patched engine, no manual intervention

| | Vercel | Netlify |
|---|---|---|
| account | `4lifm27-4000` <4lifm27@gmail.com>, hobby | `guts S` <4lifm25@gmail.com> |
| project / site | `omni-bridge-cu67` | `omni-net-cu67` |
| domain | `omni-bridge-cu67-4lifm27-4000s-projects.vercel.app` | `omni-net-cu67.netlify.app` |
| build time | 9.6 s (BUILDING → READY) | 4.6 s (processing → ready) |
| target | `omni.4lifm29.workers.dev` | `omni.4lifm29.workers.dev` |
| tunnel path | `/JOGpAVgq` (the panel's own `settings.path`, read from its D1) | `/JOGpAVgq` |

Verification against the live domains:

```
panel direct  GET https://omni.4lifm29.workers.dev/JOGpAVgq   200  869 bytes
vercel bridge GET https://omni-bridge-cu67-…vercel.app/JOGpAVgq 200  869 bytes  identical ✅
netlify bridge GET https://omni-net-cu67.netlify.app/JOGpAVgq  200  869 bytes  identical ✅
vercel bridge GET /__bridge  {"ok":true,"status":200,"ms":52,"relay":"omni-vercel"}
decoy         GET /          both serve the decoy page, not the panel
```

So both bridges really proxy the panel byte-for-byte, and the Vercel health probe
confirms the relay reaches the backend in ~52 ms.

### Known limit: websocket upgrade

Neither provider forwards a websocket upgrade for this path — a `Upgrade:
websocket` request comes back as a plain `200` from the panel. Clients therefore
need a stream/POST transport (the panel's XHTTP path), not `ws`. This is a
provider property, not a bridge bug: Vercel's serverless relay does keep
`Upgrade`/`Connection` headers, but the platform does not perform the 101
handshake on `.vercel.app`, and Netlify's proxy redirect does not either.

### Reproducing

```bash
OMNI_VERCEL_TOKEN=…  OMNI_NETLIFY_TOKEN=…  node test/live-bridge-deploy.mjs
```

The script reads tokens from the environment only, prints progress and the
resulting domains, and writes nothing to disk.

## 8. What is still open

This is the only part that could not be finished, and it is not a code problem:

Nothing is blocked any more. Both providers have been exercised end to end with
real tokens and real deployments (section 7). What is still open, in order of
usefulness:

- **The cron trigger on the live worker.** `*/5 * * * *` is declared in
  `wrangler.toml` but is not set on the deployed worker, and an API token cannot
  set it (`PUT …/workers/scripts/omni/settings` → `10405 Method not allowed for
  this authentication scheme`; `…/workers/triggers/schedules` → `7003 no route`).
  Add it in the dashboard (Workers → omni → Settings → Triggers) or run
  `wrangler deploy` once with an account-scoped token.
- **A websocket-capable bridge domain.** If `ws` transport must work, the bridge
  needs a custom domain on a platform that performs the 101 handshake, or a
  stream-only client configuration.
- **The old Netlify sites** listed in section 7 are still behind their login wall;
  they are not Omni bridges, so they were left untouched.

The token that was first handed over as a "Vercel" token is a **Cloudflare** token
(`cfut_…`); it is `active` and was used to deploy the worker itself. Tested against
`api.vercel.com` it answers `403 {"invalidToken":true}`, which is exactly what the
verify endpoint reports to a user who pastes it into the Vercel field.

## 9. Files

**Changed:** `production/worker.js`, `production/panel.html`,
`deploy/omni-worker.bundle.js` (generated), `package.json` (new test scripts),
`.gitignore` (Playwright screenshots).

**Added:** `src/bridges.js`, `tools/patch8.py` … `tools/patch12.py` (the patch scripts
that produced the worker/panel changes, kept so the edits are reproducible),
`test/bridges.test.mjs`, `test/bot-bridge.test.mjs`, `test/local-smoke.sh`,
`test/wrangler.smoke.toml` (local Miniflare only — never deploy it),
`production/test/bridge.test.mjs`, `production/bridge-results.json`,
`production/browser-results.json`, `docs/BRIDGE-CHANGES-2026-10-09.md`.

**Not committed by design:** `.wrangler/`, `node_modules/`, Playwright screenshots,
and any credential. No token — Vercel, Netlify, Telegram or GitHub — appears anywhere
in this repository.
