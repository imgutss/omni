import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const dir=new URL('../panel/build/',import.meta.url),files=['worker.js','panel.html','manifest.json'];
const sums=files.map(name=>createHash('sha256').update(fs.readFileSync(new URL(name,dir))).digest('hex')+'  '+name+'\n').join('');
fs.writeFileSync(new URL('SHA256SUMS',dir),sums);
const m=JSON.parse(fs.readFileSync(new URL('manifest.json',dir),'utf8'));
console.log('Packaged Omni Panel '+m.version+' / '+m.revision);
