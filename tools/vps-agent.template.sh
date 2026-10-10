#!/usr/bin/env bash
set -u
API="__API__"; JOIN="__JOIN__"
mkdir -p /etc/omni-vps
TOKF=/etc/omni-vps/token
cat > /etc/omni-vps/handler.py <<'OMNI_HANDLER_EOF'
import json,os,subprocess as sp,urllib.request,sys
api,tok=sys.argv[1],sys.argv[2]
data=json.load(sys.stdin)
PROF='/etc/omni-vps/profiles.json'; CFG='/etc/omni-vps/config.json'
def load():
    try: return json.load(open(PROF))
    except Exception: return []
def save(p): json.dump(p,open(PROF,'w'))
def post(path,obj):
    req=urllib.request.Request(api+path,data=json.dumps(obj).encode(),headers={'content-type':'application/json'})
    try: urllib.request.urlopen(req,timeout=25).read()
    except Exception as e: print('post err',e)
def restart(): sp.run(['systemctl','restart','omni-xray'])
done={}
for t in data.get('tasks',[]):
    pl=t.get('payload',{}); k=pl.get('kind'); tid=t['id']
    try:
        if k=='reality':
            out=sp.check_output(['/usr/local/bin/xray','x25519']).decode()
            priv=[l for l in out.splitlines() if 'Private' in l][0].split(':',1)[1].strip()
            pub=[l for l in out.splitlines() if 'Public' in l][0].split(':',1)[1].strip()
            sid=os.urandom(8).hex()
            prof=[p for p in load() if p.get('kind')!='reality']
            prof.append({'kind':'reality','pbk':pub,'sid':sid,'sni':pl.get('sni','snapp.ir'),'dest':pl.get('dest','snapp.ir'),'port':pl.get('port',443),'uuid':pl.get('uuid')})
            save(prof)
            cfg={'log':{'loglevel':'warning'},'inbounds':[{'port':pl.get('port',443),'protocol':'vless','settings':{'clients':[{'id':pl.get('uuid'),'flow':'xtls-rprx-vision'}],'decryption':'none'},'streamSettings':{'network':'tcp','security':'reality','realitySettings':{'show':False,'dest':pl.get('dest','snapp.ir')+':443','serverNames':[pl.get('sni','snapp.ir')],'privateKey':priv,'shortIds':[sid]}}}], 'outbounds':[{'protocol':'freedom','tag':'direct'}]}
            json.dump(cfg,open(CFG,'w')); restart(); done[tid]='reality ok'
        elif k=='ws':
            dom=pl.get('domain')
            sp.run('command -v certbot || apt-get install -y certbot',shell=True)
            r=sp.run(['certbot','certonly','--standalone','-d',dom,'--non-interactive','--agree-tos','--register-unsafely-without-email'],capture_output=True)
            prof=[p for p in load() if p.get('kind')!='ws']
            prof.append({'kind':'ws','domain':dom,'path':pl.get('path','/vzn'),'uuid':pl.get('uuid')})
            save(prof)
            cfg={'log':{'loglevel':'warning'},'inbounds':[{'port':443,'protocol':'vless','settings':{'clients':[{'id':pl.get('uuid')}],'decryption':'none'},'streamSettings':{'network':'ws','security':'tls','tlsSettings':{'certificates':[{'certificateFile':'/etc/letsencrypt/live/'+dom+'/fullchain.pem','keyFile':'/etc/letsencrypt/live/'+dom+'/privkey.pem'}]},'wsSettings':{'path':pl.get('path','/vzn')}}}], 'outbounds':[{'protocol':'freedom','tag':'direct'}]}
            json.dump(cfg,open(CFG,'w')); restart(); done[tid]='ws rc='+str(r.returncode)
        elif k=='restart':
            restart(); done[tid]='restarted'
        elif k=='uninstall':
            sp.run(['systemctl','disable','--now','omni-xray']); save([]); done[tid]='uninstalled'
    except Exception as e:
        done[tid]='err '+str(e)
post('/api/vps/report',{'token':tok,'status':'online','info':{'host':os.uname().nodename},'profiles':load(),'done':list(done.keys()),'results':done})
OMNI_HANDLER_EOF
if [ ! -f $TOKF ]; then
  IP=$(curl -fsS --max-time 8 https://api.cloudflare.com/cdn-cgi/trace 2>/dev/null | sed -n 's/^ip=//p' | head -1)
  TOK=$(curl -fsS -X POST "$API/api/vps/join" -H 'content-type: application/json' -d "{\"join\":\"$JOIN\",\"ip\":\"$IP\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
  echo "$TOK" > $TOKF; chmod 600 $TOKF
fi
TOK=$(cat $TOKF)
if [ ! -x /usr/local/bin/xray ]; then
  VER=$(curl -fsS https://api.github.com/repos/XTLS/Xray-core/releases/latest | python3 -c 'import sys,json;print(json.load(sys.stdin)["tag_name"])')
  curl -fL -o /tmp/xray.zip "https://github.com/XTLS/Xray-core/releases/download/$VER/Xray-linux-64.zip"
  python3 -c 'import zipfile;zipfile.ZipFile("/tmp/xray.zip").extractall("/usr/local/bin")'
  chmod +x /usr/local/bin/xray
fi
if [ ! -f /etc/systemd/system/omni-xray.service ]; then
  printf '[Unit]\nDescription=Omni VPS relay\nAfter=network.target\n[Service]\nExecStart=/usr/local/bin/xray run -c /etc/omni-vps/config.json\nRestart=always\nRestartSec=3\n[Install]\nWantedBy=multi-user.target\n' > /etc/systemd/system/omni-xray.service
  systemctl daemon-reload; systemctl enable omni-xray 2>/dev/null || true
fi
if ! pgrep -f omni-vps-poll_loop >/dev/null; then
  nohup bash -c 'POLL_MARK=omni-vps-poll_loop; while :; do TASKS=$(curl -fsS -X POST "'"$API"'/api/vps/poll" -H "content-type: application/json" -d "{\"token\":\"$(cat /etc/omni-vps/token)\"}" 2>/dev/null || echo "{\"tasks\":[]}"); echo "$TASKS" | python3 /etc/omni-vps/handler.py "'"$API"'" "$(cat /etc/omni-vps/token)" 2>>/var/log/omni-vps.err || true; sleep 45; done' >/dev/null 2>&1 &
fi
echo "✅ Omni VPS agent installed — node joined the panel."
