#!/usr/bin/env python3
"""Deploy the rebuilt worker bundle, preserving every live binding."""
import json, os, uuid, sys, urllib.request, urllib.error

CF_TOKEN = os.environ.get("CF_API_TOKEN", "").strip()
ACCOUNT = "9a3aabde4bdecbff1e298100985c7e7e"
D1_ID = "9660e603-a4e9-4b2c-8071-788e2539e618"
KV_ID = "55e3eb01634b4c11b97c05daff27c5e1"
RELEASES_ID = "f7ac482df0f04daf96378b6b55224dc9"

# Supply a freshly rotated Cloudflare token at runtime; never store it here.
# The existing BOT_TOKEN secret is inherited by the upload and is not read back.
if not CF_TOKEN:
    raise SystemExit("Set CF_API_TOKEN in the environment before deploying.")

js = open("build/worker.js", "rb").read()
metadata = {
    "main_module": "worker.js",
    "compatibility_date": "2025-01-01",
    "compatibility_flags": ["nodejs_compat"],
    "bindings": [
        {"type": "d1", "name": "DB", "id": D1_ID, "database_id": D1_ID},
        {"type": "kv_namespace", "name": "KV", "namespace_id": KV_ID},
        {"type": "plain_text", "name": "PUBLIC_HOST", "text": "omni.4lifm29.workers.dev"},
        {"type": "kv_namespace", "name": "RELEASES", "namespace_id": RELEASES_ID},
    ],
    "keep_bindings": ["secret_text"],
}
boundary = "----omni-deploy-" + uuid.uuid4().hex
crlf = b"\r\n"
def part(name, filename, ctype, data):
    h = f'Content-Disposition: form-data; name="{name}"'
    if filename:
        h += f'; filename="{filename}"'
    return crlf.join([("--" + boundary).encode(), h.encode(), f"Content-Type: {ctype}".encode(), b"", data])
body = crlf.join([
    part("metadata", "metadata.json", "application/json", json.dumps(metadata).encode()),
    part("worker.js", "worker.js", "application/javascript+module", js),
    ("--" + boundary + "--").encode(), b"",
])
req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/omni",
    data=body, method="PUT",
    headers={"Authorization": "Bearer " + CF_TOKEN,
             "Content-Type": "multipart/form-data; boundary=" + boundary},
)
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        out = json.loads(r.read())
except urllib.error.HTTPError as e:
    out = json.loads(e.read())
print(json.dumps({"success": out.get("success"), "errors": out.get("errors"),
                  "deployment_id": (out.get("result") or {}).get("deployment_id"),
                  "modified_on": (out.get("result") or {}).get("modified_on")}, ensure_ascii=False, indent=2))
sys.exit(0 if out.get("success") else 1)
