import fs from 'node:fs';
const file=new URL('../panel/release.json',import.meta.url);
const r=JSON.parse(fs.readFileSync(file,'utf8'));
const v=process.argv[2];
if(!/^\d+\.\d+\.\d+$/.test(v||''))throw Error('Usage: npm run release:prepare -- 1.0.1');
const parts=x=>x.split('.').map(Number);
const a=parts(v),b=parts(r.version);let greater=false;
for(let i=0;i<3;i++){if(a[i]!==b[i]){greater=a[i]>b[i];break}}
if(!greater)throw Error('The next version must be greater than '+r.version);
r.version=v;r.revision++;r.date=new Date().toISOString().slice(0,10);
fs.writeFileSync(file,JSON.stringify(r,null,2)+'\n');
for(const name of ['package.json','package-lock.json']){const p=new URL('../'+name,import.meta.url);const data=JSON.parse(fs.readFileSync(p,'utf8'));data.version=v;if(data.packages?.[''])data.packages[''].version=v;fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n');}
console.log(`Prepared ${r.version}, revision ${r.revision}. Commit, tag v${v} and push the tag.`);
