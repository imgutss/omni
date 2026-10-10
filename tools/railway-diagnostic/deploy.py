#!/usr/bin/env python3
"""Deploy one HTTP/WS diagnostic app using EXISTING trial credits only.
No paid-plan/card mutation, no proxy, no account creation. State makes retries idempotent.
The API token and resource IDs stay outside the repository.
"""
from pathlib import Path
import base64,json,os,sys,time,urllib.request,urllib.error
ROOT=Path(__file__).resolve().parent
PRIVATE=Path(os.environ.get('OMNI_RAILWAY_PRIVATE','/home/user/cfpanel'))
TOKEN=(PRIVATE/'railway.token').read_text().strip()
STATE_PATH=PRIVATE/'railway-diagnostic-state.json'
state=json.loads(STATE_PATH.read_text()) if STATE_PATH.exists() else {}
ALLOWED={'projectCreate','serviceCreate','serviceInstanceUpdate','serviceDomainCreate','serviceInstanceDeploy'}
def save():
    p=STATE_PATH.with_suffix('.tmp');p.write_text(json.dumps(state,indent=2));p.chmod(0o600);p.replace(STATE_PATH)
def gql(query,variables=None):
    if query.lstrip().startswith('mutation') and not any(n+'(' in query for n in ALLOWED):
        raise RuntimeError('Mutation not permitted by diagnostic-only deployer')
    req=urllib.request.Request('https://backboard.railway.com/graphql/v2',data=json.dumps({'query':query,'variables':variables or {}}).encode(),headers={'Authorization':'Bearer '+TOKEN,'content-type':'application/json','User-Agent':'Omni-Railway-Diagnostic/1.0'})
    try:
        with urllib.request.urlopen(req,timeout=30) as r: data=json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError('Railway HTTP '+str(e.code)+': '+e.read().decode(errors='replace')[:1200].replace(TOKEN,'[redacted]'))
    if data.get('errors'):raise RuntimeError(json.dumps(data['errors'],ensure_ascii=False).replace(TOKEN,'[redacted]'))
    return data['data']
def latest():
    d=gql('query DiagDeployment($env:String!,$service:String!){serviceInstance(environmentId:$env,serviceId:$service){latestDeployment{id status} sleepApplication}}',{'env':state['environment_id'],'service':state['service_id']})
    return d['serviceInstance']
def main():
    contexts=gql('query DiagScope {apiToken{workspaces{id name}}}')['apiToken']['workspaces']
    if len(contexts)!=1 and not state.get('workspace_id'):raise RuntimeError('Choose a workspace explicitly; no guessing')
    workspace_id=state.get('workspace_id') or contexts[0]['id']
    if workspace_id not in [w['id'] for w in contexts]:raise RuntimeError('Workspace not authorized by this token')
    w=gql('query DiagCreditGuard($id:String!){workspace(workspaceId:$id){id name projectCount customer{isTrialing isUsageSubscriber remainingUsageCreditBalance currentUsage trialDaysRemaining}}}',{'id':workspace_id})['workspace']
    c=w['customer']
    if not c['isTrialing'] or c['isUsageSubscriber'] or c['remainingUsageCreditBalance']<0.25:
        raise RuntimeError('Credit-only guard stopped deployment: no paid plan or automatic upgrade is allowed')
    state.update({'workspace_id':workspace_id,'credit_guard':c,'kind':'http-ws-diagnostic-only','proxy_deployed':False,'paid_plan_changed':False})
    save();print('Trial-credit guard passed; no billing/card operations',flush=True)
    if not state.get('project_id'):
        if w['projectCount']>=2:raise RuntimeError('Project limit reached; existing projects will not be touched')
        d=gql('mutation DiagProject($input:ProjectCreateInput!){projectCreate(input:$input){id name environments{edges{node{id name}}}}}',{'input':{'workspaceId':workspace_id,'name':'omni-railway-check','description':'Private project for HTTP/WebSocket echo diagnostics only. No proxy or tunnel. Trial credits only.','isPublic':False,'defaultEnvironmentName':'production'}})['projectCreate']
        state['project_id']=d['id'];save()
        envs=d['environments']['edges']
        if len(envs)!=1:raise RuntimeError('Unexpected environment count; inspect without guessing')
        state['environment_id']=envs[0]['node']['id'];save();print('Diagnostic project created',flush=True)
    if not state.get('environment_id'):
        d=gql('query DiagEnvironment($id:String!){project(id:$id){environments{edges{node{id name}}}}}',{'id':state['project_id']})
        envs=d['project']['environments']['edges']
        if len(envs)!=1:raise RuntimeError('Cannot uniquely resolve environment')
        state['environment_id']=envs[0]['node']['id'];save()
    if not state.get('service_id'):
        variables={'PORT':'8080','OMNI_DIAG_JS_B64':base64.b64encode((ROOT/'server.cjs').read_bytes()).decode(),'OMNI_DIAG_HTML_B64':base64.b64encode((ROOT/'index.html').read_bytes()).decode()}
        d=gql('mutation DiagService($input:ServiceCreateInput!){serviceCreate(input:$input){id name}}',{'input':{'projectId':state['project_id'],'environmentId':state['environment_id'],'name':'omni-railway-check','variables':variables}})['serviceCreate']
        state['service_id']=d['id'];save();print('One diagnostic service created',flush=True)
    if not state.get('configured'):
        inp={'source':{'image':'node:22-alpine'},'startCommand':"node -e \"eval(Buffer.from(process.env.OMNI_DIAG_JS_B64,'base64').toString())\"",'healthcheckPath':'/healthz','healthcheckTimeout':90,'numReplicas':1,'restartPolicyType':'ON_FAILURE','restartPolicyMaxRetries':2,'sleepApplication':True}
        gql('mutation DiagConfigure($env:String!,$service:String!,$input:ServiceInstanceUpdateInput!){serviceInstanceUpdate(environmentId:$env,serviceId:$service,input:$input)}',{'env':state['environment_id'],'service':state['service_id'],'input':inp})
        state['configured']=True;save();print('Configured official Node image, one replica, idle sleep enabled',flush=True)
    if not state.get('domain'):
        d=gql('mutation DiagDomain($input:ServiceDomainCreateInput!){serviceDomainCreate(input:$input){id domain}}',{'input':{'environmentId':state['environment_id'],'serviceId':state['service_id'],'targetPort':8080}})['serviceDomainCreate']
        state.update({'domain':d['domain'],'domain_id':d['id']});save();print('Diagnostic domain: https://'+state['domain'],flush=True)
    current=latest()
    if not current['latestDeployment']:
        if state.get('deploy_requested'):raise RuntimeError('Deployment request is pending; refusing to duplicate it')
        gql('mutation DiagDeploy($env:String!,$service:String!){serviceInstanceDeploy(environmentId:$env,serviceId:$service)}',{'env':state['environment_id'],'service':state['service_id']})
        state['deploy_requested']=True;save()
    last=None
    for attempt in range(42):
        data=latest();deploy=data['latestDeployment'];status=(deploy or {}).get('status','PENDING')
        if deploy:state['deployment_id']=deploy['id']
        state.update({'deployment_status':status,'sleep_application':data.get('sleepApplication')});save()
        if status!=last:print('Deployment: '+status,flush=True);last=status
        if status in ['SUCCESS','SLEEPING']:
            print('READY https://'+state['domain']+' (diagnostic only; user-line test still required)',flush=True);return
        if status in ['FAILED','CRASHED','REMOVED','SKIPPED']:
            raise RuntimeError('Deployment did not become ready: '+status)
        time.sleep(5)
    raise RuntimeError('Deployment still pending; resource IDs saved. Do not create duplicate resources.')
if __name__=='__main__':
    try:main()
    except Exception as e:
        state['last_error']=str(e).replace(TOKEN,'[redacted]');save();print('DIAGNOSTIC_DEPLOY_ERROR: '+state['last_error'],file=sys.stderr,flush=True);sys.exit(1)
