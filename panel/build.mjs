// Deterministic assembly: the verified backend is not passed through legacy patchers.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parse} from 'acorn';
const dir=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(dir,'build');
const release=JSON.parse(fs.readFileSync(path.join(dir,'release.json'),'utf8'));
const html=fs.readFileSync(path.join(dir,'src/panel.html'),'utf8').replaceAll('__OMNI_PRODUCT_VERSION__',release.version).replaceAll('__OMNI_PRODUCT_REVISION__',String(release.revision));
let source=fs.readFileSync(path.join(dir,'src/worker.mjs'),'utf8');
function replaceExactlyOnce(needle,value){
 if(source.split(needle).length!==2)throw Error('Missing or duplicated release placeholder: '+needle);
 source=source.replace(needle,()=>value);
}
replaceExactlyOnce('"__OMNI_PANEL_HTML__"',JSON.stringify(html));
const build={v:release.version,bytes:0,md5:createHash('md5').update(html).digest('hex'),rev:release.revision,at:release.date};
const template=source;
for(let i=0;i<8;i++){
 source=template.replace('"__OMNI_BUILD_METADATA__"',JSON.stringify(build));
 const bytes=Buffer.byteLength(source);if(build.bytes===bytes)break;build.bytes=bytes;
}
if(Buffer.byteLength(source)!==build.bytes)throw Error('Build byte count did not converge');
if(source.includes('__OMNI_BUILD_METADATA__'))throw Error('Unresolved build metadata');
parse(source,{ecmaVersion:'latest',sourceType:'module'});
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'worker.js'),source);
fs.writeFileSync(path.join(out,'panel.html'),html);
const manifest={...release,artifacts:Object.fromEntries(['worker.js','panel.html'].map(name=>{
 const data=fs.readFileSync(path.join(out,name));return [name,{bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}];
}))};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Omni Panel ${release.version} · revision ${release.revision} · ${build.bytes} bytes`);
console.log(`SHA-256 ${manifest.artifacts['worker.js'].sha256}`);
