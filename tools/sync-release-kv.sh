#!/usr/bin/env bash
# v9.8 — run AFTER every wrangler deploy of omni/nova.
# The bot's repair / auto-heal / self-update buttons deploy the bundle archived
# in each account's RELEASES KV (key releases/current). If that archive goes
# stale, a repair re-deploys ancient code → Error 1101 loop (2026-10-10 incident).
# This script re-points the archive at the bundle that is actually live.
set -euo pipefail
BUNDLE="${1:-/home/user/omni/deploy/omni-worker.bundle.js}"
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:?source cfpanel/.env first}}"
OMNI_ACC="${CLOUDFLARE_ACCOUNT_ID:?source cfpanel/.env first}"
OMNI_KV="f7ac482df0f04daf96378b6b55224dc9"
NOVA_ACC="1cec82a30519cab690a42d5fd872b30d"
NOVA_KV="ec47b341007747f1a9d4d94c5855c35a"
NOVA_TOK="${NOVA_TOKEN:-$(cat /tmp/nova_tok)}"
sha=$(sha256sum "$BUNDLE" | cut -d' ' -f1)
put() { # token account ns
  curl -sf -X PUT -H "Authorization: Bearer $1" -H "Content-Type: application/octet-stream" \
    --data-binary @"$BUNDLE" \
    "https://api.cloudflare.com/client/v4/accounts/$2/storage/kv/namespaces/$3/values/releases%2Fcurrent" >/dev/null
  echo "synced $3 <- $sha"
}
put "$CLOUDFLARE_API_TOKEN" "$OMNI_ACC" "$OMNI_KV"
put "$NOVA_TOK" "$NOVA_ACC" "$NOVA_KV"
