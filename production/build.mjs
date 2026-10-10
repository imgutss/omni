// Re-embed the editable panel in the preserved production backend; no legacy-source rebuild.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const file=path.join(root,'worker.js');
let panel=fs.readFileSync(path.join(root,'panel.html'),'utf8');
let worker=fs.readFileSync(file,'utf8');
// v10.1: shared profile rules and the served installer cannot silently drift.
const tool=(name)=>fs.readFileSync(path.join(root,'../tools',name),'utf8');
function embed(source,name,body) {
 const re=new RegExp('^[ \\t]*// '+name+'-BEGIN\\n[\\s\\S]*?^[ \\t]*// '+name+'-END','gm');
 if([...source.matchAll(re)].length!==1)throw new Error('Expected one '+name+' block');
 return source.replace(re,()=> '// '+name+'-BEGIN\n'+body.trimEnd()+'\n// '+name+'-END');
}
const helpers=tool('vps-profile.js');
panel=embed(panel,'VPS-PROFILES',helpers);
worker=embed(worker,'VPS-PROFILES',helpers);
worker=embed(worker,'VPS-VALIDATION',tool('vps-validate.js'));
const agent=tool('vps-agent.template.sh').replace('__AGENT_PY__',()=>tool('vps-agent.py'));
worker=embed(worker,'VPS-AGENT','var VPS_AGENT_SH = '+JSON.stringify(agent)+';');
fs.writeFileSync(path.join(root,'panel.html'),panel);
const marker='var panel_default = ';
const start=worker.indexOf(marker),end=worker.indexOf('\n',start);
if(start<0||end<0||worker.indexOf(marker,start+marker.length)>=0)throw new Error('Expected one production panel literal');
const ending=worker.slice(start,end).match(/;+\s*$/)?.[0];
if(!ending)throw new Error('Unexpected panel declaration');
worker=worker.slice(0,start)+marker+JSON.stringify(panel)+ending+worker.slice(end);
const temporary=path.join(root,'worker.check.mjs');
fs.writeFileSync(temporary,worker);
try {
 const check=spawnSync(process.execPath,['--check',temporary],{encoding:'utf8'});
 if(check.status!==0)throw new Error(check.stderr);
} finally {fs.unlinkSync(temporary);}
fs.writeFileSync(file,worker);
fs.mkdirSync(path.join(root,'../deploy'),{recursive:true});
fs.writeFileSync(path.join(root,'../deploy/omni-worker.bundle.js'),worker);
console.log('Production artifact SHA-256:',createHash('sha256').update(worker).digest('hex'));
