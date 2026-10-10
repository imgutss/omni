# Railway diagnostic — not a proxy

An HTTP page and a small, bounded WebSocket echo server, deployed to the user's own Railway trial workspace. It contains **no VLESS, SOCKS, arbitrary forwarding, or anonymization service**.

- `index.html`: Persian mobile test UI. Requires the visitor to manually confirm VPN is off; cannot detect that automatically.
- `server.cjs`: HTTP health/HTML plus bounded echo. Two fixed HTTPS destinations are checked once at startup. No recurring outgoing probe, allowing idle sleep.
- `deploy.py`: initial deploy using an existing workspace token and existing trial credits. No billing/card/plan mutation is implemented. Uses the official `node:22-alpine` image with one replica and idle sleep enabled.

## Credentials and state

The default private directory is `/home/user/cfpanel`, overridden by `OMNI_RAILWAY_PRIVATE`. Token filename: `railway.token`; state: `railway-diagnostic-state.json`. Both are outside the repository. Never commit or upload the private directory.

The token can be workspace-scoped. `me` may return `Not Authorized` even for a valid workspace token; `apiToken { workspaces { id name } }` is the appropriate discovery query.

## Deploy / test

```sh
# The private token file must already exist, mode 0600.
python3 tools/railway-diagnostic/deploy.py

# Browser regression: live happy path, synthetic negative path.
npm --prefix production ci
cd production
OMNI_RAILWAY_DIAG_URL=https://YOUR-CREATED-DOMAIN node test/railway-diag.test.mjs
```

The deployer preserves created resource IDs and refuses paid/expired subscriptions. Do not blindly retry after an ambiguous mutation response: inspect the user's project list first. It is an **initial deployer**, not a source updater. Later source changes require updating the service variables and deploying the existing service, not creating a second project.

The service is left available for the user's phone test. Idle sleep is on. Stop the latest diagnostic deployment (or the specific diagnostic service in Railway) after the test is no longer needed. Do not change or delete unrelated resources.

## Proof boundary

A successful HTTPS request and WebSocket echo demonstrate only those transports between the testing browser and Railway. Server egress checks are from Railway, not from the user's device. Neither result proves a working VPN, domestic-CDN route, or connectivity during an Iranian Internet shutdown.

Current Railway hosting policy and the prior accountless probe are recorded in `docs/RAILWAY-FREE-TEST-2026-10-10.md`. API access does not resolve that separate policy question. Actual account deployment details and the next user step are in `docs/RAILWAY-ACCOUNT-TEST-2026-10-10.md`.
