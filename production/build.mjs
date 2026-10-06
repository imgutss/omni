// Re-embed the editable panel in the preserved production backend; no legacy-source rebuild.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const file=path.join(root,'worker.js');
const panel=fs.readFileSync(path.join(root,'panel.html'),'utf8');
let worker=fs.readFileSync(file,'utf8');
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
