#!/usr/bin/env bash
# Local smoke test for the Vercel/Netlify bridge endpoints.
#
#   bash test/local-smoke.sh
#
# Boots production/worker.js in Miniflare (test/wrangler.smoke.toml, local D1,
# never deployed) and exercises the panel-side bridge API. Outbound calls to
# api.vercel.com / api.netlify.com are REAL, so this proves the endpoints
# actually speak to the providers; the token used is a dead one, so nothing is
# ever created and no credential is needed.
#
# The bot side (/natbridge, token prompt, progress edits, deploy report) cannot
# be driven through Miniflare: workerd validates TLS and refuses a local
# api.telegram.org stub. That path is covered by test/bot-bridge.test.mjs,
# which runs the very same bundle in Node with an in-memory Telegram + D1.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PORT="${PORT:-8799}"
BASE="http://127.0.0.1:${PORT}"
DEAD_TOKEN="${OMNI_TEST_VERCEL_TOKEN:-cfut_dead000000000000000000000000000000000000}"
OUT=/tmp/smoke-panel.log
WR_LOG=/tmp/wrangler.log
PASS=0
FAIL=0
WR_PID=""

free_port() { # a leftover workerd from an earlier run makes every check time out
  local pid
  pid=$(ss -lptnH "sport = :${PORT}" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
  [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null
}
cleanup() {
  [ -n "$WR_PID" ] && kill -9 -- "-$WR_PID" 2>/dev/null
  free_port
}
trap cleanup EXIT

rm -rf /tmp/miniflare-* "$ROOT/test/.wrangler" "$ROOT/.wrangler" 2>/dev/null
: > "$OUT"
free_port
sleep 1

say() { printf '%s\n' "$*" | tee -a "$OUT"; }
chk() { if [ "$1" = "0" ]; then say "✅ $2"; PASS=$((PASS+1)); else say "❌ $2"; FAIL=$((FAIL+1)); fi; }

BOT_TOKEN=x BOT_WEBHOOK_SECRET=omni-hook setsid npx wrangler dev --config test/wrangler.smoke.toml \
  --local --port "$PORT" --ip 127.0.0.1 >"$WR_LOG" 2>&1 &
WR_PID=$!

for i in $(seq 1 60); do
  curl -s -o /dev/null -m 2 "$BASE/healthz" && break
  sleep 1
done
curl -s -m 5 -o /dev/null "$BASE/healthz"; chk $? "production/worker.js boots in Miniflare"

JAR=/tmp/smoke-jar.$$
SETUP=$(curl -sS -m 20 -c "$JAR" -H 'content-type: application/json' \
  -d '{"username":"admin","password":"SmokeTest12345"}' "$BASE/api/setup")
echo "$SETUP" | grep -q '"ok":true'; chk $? "panel installs and the admin session works ($SETUP)"

curl -sS -m 20 -b "$JAR" -c "$JAR" -H 'content-type: application/json' \
  -d '{"username":"admin","password":"SmokeTest12345"}' "$BASE/api/login" >/dev/null

BRIDGE=$(curl -sS -m 20 -b "$JAR" "$BASE/api/bridge")
echo "$BRIDGE" | grep -q '"can_deploy":true'; chk $? "GET /api/bridge answers for an admin"
echo "$BRIDGE" | grep -Eq '"path":"/[A-Za-z0-9_-]+"'; chk $? "GET /api/bridge reports this panel's own proxy path ($BRIDGE)"

ANON=$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "$BASE/api/bridge")
[ "$ANON" = "401" ]; chk $? "GET /api/bridge rejects an anonymous caller ($ANON)"

V=$(curl -sS -m 40 -b "$JAR" -H 'content-type: application/json' \
  -d '{"platform":"vercel","token":"'$DEAD_TOKEN'"}' \
  "$BASE/api/bridge/verify")
echo "$V" | grep -qi 'not authorized\|invalid'; chk $? "POST /api/bridge/verify really reaches api.vercel.com ($V)"

N=$(curl -sS -m 40 -b "$JAR" -H 'content-type: application/json' \
  -d '{"platform":"netlify","token":"nctp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}' \
  "$BASE/api/bridge/verify")
echo "$N" | grep -qi 'denied\|invalid\|unauthorized'; chk $? "POST /api/bridge/verify really reaches api.netlify.com ($N)"

BAD=$(curl -sS -m 20 -b "$JAR" -o /dev/null -w '%{http_code}' -H 'content-type: application/json' \
  -d '{"platform":"heroku","token":"whatever"}' "$BASE/api/bridge/verify")
[ "$BAD" = "400" ]; chk $? "an unknown platform is rejected before any network call ($BAD)"

SHORT=$(curl -sS -m 20 -b "$JAR" -H 'content-type: application/json' \
  -d '{"platform":"vercel","token":"abc"}' "$BASE/api/bridge/verify")
echo "$SHORT" | grep -q '"code":"bad_token"'; chk $? "a malformed token is rejected before any provider call ($SHORT)"

DEP=$(curl -sS -m 40 -b "$JAR" -H 'content-type: application/json' \
  -d '{"platform":"vercel","token":"'$DEAD_TOKEN'","name":"omni-smoke-panel","target":"omni-panel.workers.dev"}' \
  "$BASE/api/bridge")
ID=$(printf '%s' "$DEP" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
[ -n "$ID" ]; chk $? "POST /api/bridge returns immediately with a row id ($ID)"

S=""
for i in $(seq 1 20); do
  S=$(curl -sS -m 20 -b "$JAR" "$BASE/api/bridge/$ID")
  echo "$S" | grep -q '"status":"failed"\|"status":"ready"' && break
  sleep 3
done
echo "$S" | grep -q '"status":"failed"'; chk $? "the background deploy finished and wrote the failure back to D1"
echo "$S" | grep -qi 'not authorized'; chk $? "the stored error is the upstream message, not a generic one"
echo "$S" | grep -q '"platform":"vercel"'; chk $? "GET /api/bridge/{id} returns the bridge row"

LIST=$(curl -sS -m 20 -b "$JAR" "$BASE/api/bridge")
echo "$LIST" | grep -q 'omni-smoke-panel'; chk $? "the new bridge shows up in GET /api/bridge"

grep -qaE 'Unhandled|ReferenceError|is not defined' "$WR_LOG"
[ $? -ne 0 ]; chk $? "no unhandled exceptions in the worker log"

rm -f "$JAR"
say
say "passed=$PASS failed=$FAIL"
if [ "$FAIL" -gt 0 ]; then say "SOME CHECKS FAILED"; exit 1; fi
say "ALL PANEL BRIDGE CHECKS PASSED"
