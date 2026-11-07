# Deployment

[فارسی](DEPLOY.fa.md) · [Release maintenance](MAINTAINER.md)

## Bot-managed panel

Send `/start` to the [Omni bot](https://t.me/OmniAiGateBot), then create/select a panel with accounts you are authorized to manage. Back up SQL and settings before upgrades.

## Independent installation

1. Use Node.js 22+, then run `npm ci`, `npm run build` and `npm test`.
2. Create D1 and KV namespaces for `KV`/`RELEASES`. Copy `wrangler.toml` to ignored `wrangler.local.toml` and replace every placeholder.
3. Restrict access to the uninitialized panel until its administrator is created. Do not let a public first visitor claim setup.
4. If using a personal bot, set a private `BOT_TOKEN` and random `BOT_WEBHOOK_SECRET`. Register Telegram with both the matching private URL and `secret_token`.
5. Review and explicitly deploy:

```bash
OMNI_ALLOW_DEPLOY=1 OMNI_WRANGLER_CONFIG=wrangler.local.toml npm run deploy
```

Upload the exact generated `panel/build/worker.js` to your release namespace at `releases/current`. KV propagation is not instantaneous. The standalone deploy command does not create a SQL backup for you.

## Existing installation

Preserve D1, bindings, runtime compatibility, Durable Object mappings and schedules. The sample migration is for new installs only. Back up the deployed Worker and RELEASES. Re-register an old webhook with `secret_token` before switching code; keeping only its URL is insufficient. Never put working credentials in a public command or issue.

Validate an owned canary first: version, login, users, subscriptions, Telegram and real traffic. To roll back code, restore the matching Worker and RELEASES without overwriting newer user data with an old database.

## Railway relay

Fork the whole repository and build its root Dockerfile. Only the relay runs there; the panel stays on Cloudflare. The unconfigured relay refuses tunnels. Attach an owned service through the panel's Railway workflow. Forking does not bypass provider quotas or billing.

Treat SQL exports and profiles as secrets. Rotate exposed credentials rather than relying on file removal.
