#!/usr/bin/env bash
# اجرای E2E با دیتابیس محلی تازه
set -u
cd "$(dirname "$0")/.."
ps -eo pid,args | grep -i "wrangler dev" | grep -v grep | awk '{print $1}' | xargs -r kill 2>/dev/null
sleep 1; rm -rf .wrangler test/.wrangler
nohup npx wrangler dev --config test/wrangler.local.toml --local --port 8790 --ip 0.0.0.0 > /tmp/omni.log 2>&1 &
for i in $(seq 1 40); do
  curl -s -o /dev/null "http://127.0.0.1:8790/api/whoami" && break
  sleep 1
done
node test/e2e.mjs
