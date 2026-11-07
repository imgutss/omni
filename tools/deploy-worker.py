#!/usr/bin/env python3
"""Preserving in-place deployment of the canonical Worker + RELEASES bundle.
Credentials come only from the environment. No D1 writes, deletions, or child rollout.
"""
import os,json,hashlib,urllib.request,urllib.error,urllib.parse,email,email.policy,time,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
TOKEN=os.environ.get('CF_API_TOKEN','').strip()
ACCOUNT=os.environ.get('CF_ACCOUNT_ID','').strip()
NAME=os.environ.get('CF_WORKER_NAME','omni').strip()
if not TOKEN or not ACCOUNT:raise SystemExit('CF_API_TOKEN and CF_ACCOUNT_ID are required')
BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT
BUNDLE=(ROOT/'panel/build/worker.js').read_bytes()
MANIFEST=json.loads((ROOT/'panel/build/manifest.json').read_text())
assert hashlib.sha256(BUNDLE).hexdigest()==MANIFEST['artifacts']['worker.js']['sha256']
def call(path,method='GET',data=None,content_type=None,raw=False):
 headers={'Authorization':'Bearer '+TOKEN}
 if isinstance(data,dict):data=json.dumps(data).encode();content_type='application/json'
 if content_type:headers['Content-Type']=content_type
 request=urllib.request.Request(BASE+path,data=data,headers=headers,method=method)
 try:
  with urllib.request.urlopen(request,timeout=90) as response:
   body=response.read();kind=response.headers.get('Content-Type','')
 except urllib.error.HTTPError as error:
  raise RuntimeError('Cloudflare '+method+' failed: HTTP '+str(error.code)) from None
 if raw:return body,kind
 value=json.loads(body)
 if not value.get('success'):raise RuntimeError('Cloudflare API declined operation')
 return value.get('result')
def js_module(raw,kind):
 if 'multipart/' not in kind:return raw
 msg=email.message_from_bytes(('Content-Type: '+kind+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+raw,policy=email.policy.default)
 for part in msg.iter_parts():
  name=part.get_filename() or part.get_param('name',header='Content-Disposition') or ''
  if 'javascript' in part.get_content_type() or name.endswith(('.js','.mjs')):return part.get_payload(decode=True)
 raise RuntimeError('Cannot locate previous Worker module')
def mapped(bindings):
 out=[]
 for b in bindings:
  if b['type'] in ['secret_text','secret_key']:continue
  if b['type']=='d1':out.append({'type':'d1','name':b['name'],'id':b.get('database_id') or b['id']})
  else:out.append(b)
 return out
def upload(bundle,settings):
 metadata={'main_module':'worker.js','compatibility_date':settings['compatibility_date'],'compatibility_flags':settings.get('compatibility_flags',[]),'bindings':mapped(settings['bindings']),'keep_bindings':['secret_text','secret_key']}
 for key in ['usage_model','placement','tail_consumers','logpush','tags']:
  if settings.get(key) is not None:metadata[key]=settings[key]
 boundary='omni-release-'+os.urandom(12).hex()
 def part(name,filename,ctype,data):return ('--'+boundary+'\r\nContent-Disposition: form-data; name="'+name+'"; filename="'+filename+'"\r\nContent-Type: '+ctype+'\r\n\r\n').encode()+data+b'\r\n'
 payload=part('metadata','metadata.json','application/json',json.dumps(metadata).encode())+part('worker.js','worker.js','application/javascript+module',bundle)+('--'+boundary+'--\r\n').encode()
 return call('/workers/scripts/'+NAME,'PUT',payload,'multipart/form-data; boundary='+boundary)
def binding_identity(bindings):
 result={}
 for b in bindings:
  value=dict(b)
  if value['type']=='d1':value['id']=value.get('database_id') or value['id'];value.pop('database_id',None)
  result[value['name']]=value
 return result
path='/workers/scripts/'+NAME
settings=call(path+'/settings')
namespace=next(b['namespace_id']for b in settings['bindings']if b['name']=='RELEASES')
kv='/storage/kv/namespaces/'+namespace+'/values/'
previous_raw,kind=call(path,raw=True);previous=js_module(previous_raw,kind)
previous_release,_=call(kv+'releases%2Fcurrent',raw=True)
if previous==BUNDLE and previous_release==BUNDLE:
 print('Canonical Worker and RELEASES are already current.');raise SystemExit(0)
# Rollback copies remain in the existing private namespace, never in public artifacts.
stamp=str(int(time.time()))+'-'+hashlib.sha256(previous).hexdigest()[:12]
call(kv+'rollback%2F'+stamp+'%2Fworker.js','PUT',previous,'application/javascript+module',raw=True)
call(kv+'rollback%2F'+stamp+'%2Frelease.js','PUT',previous_release,'application/javascript+module',raw=True)
call(kv+'rollback%2F'+stamp+'%2Fsettings.json','PUT',json.dumps(settings).encode(),'application/json',raw=True)
started=False
try:
 # The old central's embedded-panel guard rejects the new bundle during this window.
 call(kv+'releases%2Fcurrent','PUT',BUNDLE,'application/javascript+module',raw=True)
 started=True
 upload(BUNDLE,settings)
 current=call(path+'/settings')
 if binding_identity(current['bindings'])!=binding_identity(settings['bindings']):raise RuntimeError('Resource bindings changed unexpectedly')
 raw,kind=call(path,raw=True)
 if js_module(raw,kind)!=BUNDLE:raise RuntimeError('Deployed module hash mismatch')
 stored,_=call(kv+'releases%2Fcurrent',raw=True)
 if stored!=BUNDLE:raise RuntimeError('RELEASES/current mismatch')
 host=next(b['text'] for b in settings['bindings'] if b['name']=='PUBLIC_HOST')
 host=urllib.parse.urlsplit(host if '://' in host else 'https://'+host).netloc
 verified=False
 for attempt in range(12):
  try:
   url='https://'+host+'/api/version?_release='+str(MANIFEST['revision'])
   with urllib.request.urlopen(url,timeout=15) as response:version=json.load(response)
   if version.get('v')==MANIFEST['version'] and version.get('rev')==MANIFEST['revision']:
    with urllib.request.urlopen('https://'+host+'/healthz',timeout=15) as response:
     if response.status==200:verified=True;break
  except Exception:pass
  time.sleep(3)
 if not verified:raise RuntimeError('Public version/health verification failed')
 print('Deployed Omni Panel '+MANIFEST['version']+' / revision '+str(MANIFEST['revision']))
 print('Existing bindings and secrets retained; central module and RELEASES byte-identical.')
 print('Automatic child rollout was not enabled.')
except Exception:
 if started:
  try:
   call(kv+'releases%2Fcurrent','PUT',previous_release,'application/javascript+module',raw=True)
   upload(previous,settings)
   print('Previous Worker and release bundle restored.',file=sys.stderr)
  except Exception:print('Automatic rollback failed; use the private rollback copies.',file=sys.stderr)
 raise
