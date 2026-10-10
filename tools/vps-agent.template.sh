#!/usr/bin/env bash
# Omni 10.1 — prepares a user-owned origin. Does NOT provision a CDN account.
set -euo pipefail
umask 077
API="__API__"
JOIN="__JOIN__"
[ "$(id -u)" = 0 ] || { echo 'Run as root on your own Debian/Ubuntu VPS.' >&2; exit 1; }
command -v systemctl >/dev/null || { echo 'systemd is required.' >&2; exit 1; }
command -v apt-get >/dev/null || { echo 'This installer supports Debian/Ubuntu only.' >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl python3 certbot
mkdir -p /etc/omni-vps
chmod 700 /etc/omni-vps
cat > /etc/omni-vps/agent.py <<'OMNI_AGENT_PY_EOF'
__AGENT_PY__
OMNI_AGENT_PY_EOF
if [ ! -x /usr/local/bin/omni-xray ]; then
  case "$(uname -m)" in
    x86_64) ASSET=Xray-linux-64.zip ;;
    aarch64|arm64) ASSET=Xray-linux-arm64-v8a.zip ;;
    *) echo 'Unsupported CPU architecture.' >&2; exit 1 ;;
  esac
  TMP=$(mktemp -d)
  trap 'rm -rf "$TMP"' EXIT
  VER=$(curl --fail --silent --show-error --max-time 30 https://api.github.com/repos/XTLS/Xray-core/releases/latest | python3 -c 'import sys,json;print(json.load(sys.stdin)["tag_name"])')
  BASE="https://github.com/XTLS/Xray-core/releases/download/$VER/$ASSET"
  curl --fail --location --retry 2 --max-time 180 "$BASE" -o "$TMP/xray.zip"
  curl --fail --location --retry 2 --max-time 30 "$BASE.dgst" -o "$TMP/xray.dgst"
  python3 - "$TMP" <<'OMNI_XRAY_UNZIP_EOF'
import hashlib,pathlib,re,sys,zipfile
root=pathlib.Path(sys.argv[1])
data=(root/'xray.zip').read_bytes()
digests=re.findall(r'(?i)\b[0-9a-f]{64}\b',(root/'xray.dgst').read_text())
if hashlib.sha256(data).hexdigest().lower() not in [x.lower() for x in digests]:
    raise SystemExit('Xray checksum mismatch; not installing')
with zipfile.ZipFile(root/'xray.zip') as z:
    pathlib.Path('/usr/local/bin/omni-xray').write_bytes(z.read('xray'))
OMNI_XRAY_UNZIP_EOF
  chmod 755 /usr/local/bin/omni-xray
fi
# Join after dependencies are installed, so download errors cannot pretend readiness.
python3 - "$API" "$JOIN" <<'OMNI_JOIN_EOF'
import json,os,pathlib,sys,urllib.request
api,join=sys.argv[1:]
root=pathlib.Path('/etc/omni-vps')
conf=root/'agent.json'
if conf.exists():
    old=json.loads(conf.read_text())
    if old.get('api')!=api:
        raise SystemExit('Already joined another panel; remove agent.json intentionally before rejoining')
    token=old['token']
else:
    # A v10 node can be upgraded without consuming its single-use join token again.
    old=root/'token'
    token=old.read_text().strip() if old.exists() else ''
    if not token:
        req=urllib.request.Request(api+'/api/vps/join',data=json.dumps({'join':join}).encode(),headers={'content-type':'application/json','User-Agent':'Omni-VPS-Agent/10.1'})
        with urllib.request.urlopen(req,timeout=30) as r: result=json.load(r)
        token=result['token']
    conf.write_text(json.dumps({'api':api,'token':token}))
    conf.chmod(0o600)
OMNI_JOIN_EOF
cat > /etc/systemd/system/omni-xray.service <<'OMNI_XRAY_UNIT_EOF'
[Unit]
Description=Omni owned VPS origin
After=network-online.target
Wants=network-online.target
[Service]
ExecStart=/usr/local/bin/omni-xray run -c /etc/omni-vps/config.json
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
OMNI_XRAY_UNIT_EOF
cat > /etc/systemd/system/omni-vps-agent.service <<'OMNI_AGENT_UNIT_EOF'
[Unit]
Description=Omni VPS management agent
After=network-online.target
Wants=network-online.target
[Service]
ExecStart=/usr/bin/python3 /etc/omni-vps/agent.py
Restart=always
RestartSec=10
UMask=0077
[Install]
WantedBy=multi-user.target
OMNI_AGENT_UNIT_EOF
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/usr/bin/env bash\nsystemctl try-restart omni-xray.service\n' > /etc/letsencrypt/renewal-hooks/deploy/omni-xray
chmod 700 /etc/letsencrypt/renewal-hooks/deploy/omni-xray
# Replace v10's non-persistent background loop, if present.
pkill -f '[P]OLL_MARK=omni-vps-poll_loop' 2>/dev/null || true
systemctl daemon-reload
systemctl enable --now certbot.timer
systemctl enable omni-vps-agent
systemctl restart omni-vps-agent
systemctl is-active --quiet omni-vps-agent
echo 'Omni agent joined. Configure the owned domain/CDN in the panel next.'
echo 'Agent online is NOT proof of connectivity during an Iranian Internet shutdown.'
