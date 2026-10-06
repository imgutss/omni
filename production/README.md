# Production release: scanner-fix-2026-10-06.1

## Source of truth

The deployed Cloudflare backend had evolved beyond the old modular `src/` directory. This repair preserves that deployed backend verbatim and updates only its embedded panel. `production/worker.js` is the canonical self-contained module and `production/panel.html` is the editable panel. `wrangler.toml` now points to this production artifact and retains the RELEASES binding used by the bot. Do not rebuild the old `src/` tree and overwrite the deployed service.

`node production/build.mjs` embeds panel.html into worker.js, checks JavaScript syntax, and synchronizes `deploy/omni-worker.bundle.js`. It needs only Node.js. Rebuilding does **not** deploy anything or update the bot's KV payload automatically.

The repair was deployed to the main `omni` and the screenshot panel `omni-ali`. Other existing/test Workers were explicitly excluded. The main and child had different backends/features before this work; each backend was preserved. Both use the repaired scanner logic. The bot's `releases/current` and `releases/scanner-fix-2026-10-06.1` KV values were updated to the main production bundle.

## Fixed

- Short Persian preset names, including correct IP-list labels instead of “domains” for lists that contain IP addresses.
- Separate browser HTTPS, Worker response, Cloudflare identity, and tunnel verification. Worker-only reachability no longer becomes “healthy on your phone”.
- Browser HTTPS-to-raw-IP is not a valid SNI test: raw IPs now explicitly request a client-side tunnel test instead of appearing as blanket red failures.
- No fabricated ping on fetch rejection and no scaling of measured elapsed time.
- Fresh-result checks, explicit API errors, completion progress for failures/skipped browser probes, and reliable busy-state cleanup.
- IPv4/IPv6 filtering, SIIT filtering, empty-filter behavior (no silent fallback), CIDR network alignment and /32 support.
- Selection/input changes invalidate old results. In-flight preset switches cannot mix labels with results.
- Separate “save HTTPS results” and “save for client testing”. Trial saves require confirmation, merge existing addresses, never force IPv6 for IPv4-only input, and do not claim a working tunnel.
- Copy address list, wrapped badges and mobile layout.

## Intentional limitations

A browser cannot set a different TLS SNI/Host while connecting to an arbitrary raw IP. `mode: no-cors` does not remove TLS checks. Raw-IP tests require a native client using the intended hostname/SNI; the panel cannot measure the user's mobile-network tunnel from a Cloudflare Worker. A resolved opaque fetch alone is not Cloudflare identity verification. A 1 ms Worker result is not a 1 ms phone ping. No successful tunnel or carrier compatibility is invented.

## Tests

```sh
npm --prefix production install
npm run test:scanner
npx --prefix production playwright install --with-deps chromium
npm run test:scanner:browser
npm run build:production
```

18 deterministic scanner regression checks passed. Browser tests ran against the complete panel in Chromium at a 393px mobile width, using **mocked API responses**; they covered IPv4, IPv6, SIIT, empty filtered input, progress, no horizontal overflow, zero uncaught JS errors, explicit save confirmation, merge-preservation and copy actions. Saved JSON results are under `production/test/`.

Live verification separately checked `/`, `/healthz` and `/api/whoami`, the exact served HTML SHA-256 against the tested artifact, unchanged bindings (including bot secrets/D1/KV), bot getMe/webhook metadata, and exact KV release content. This does not assert testing every Telegram command or a successful tunnel on the user's carrier.

## Deployment safety

The rollout used staged Cloudflare versions, saved rollback version IDs and source snapshots, and did not modify users, passwords, config pools or webhooks. The first overly eager edge check encountered propagation delay and safely rolled back the child. The same staged versions were subsequently activated and verified with bounded propagation checks.

- `omni`: version `ab7d9d84-9aa0-4fdf-850a-e97514b2baf2`
- `omni-ali`: version `6f8dacf0-8b5e-45f7-be1a-7b1b967d4d64`

For a future release, preserve all bindings/secrets and the existing database, stage a version, deploy it, and verify its served hash before updating `RELEASES` KV. Updating the bot install bundle does not automatically update previously installed child panels. No credentials belong in this repository.
