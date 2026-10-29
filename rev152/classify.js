const fs = require('fs');
const CIDRS = [["173.245.48.0",20],["103.21.244.0",22],["103.22.200.0",22],["103.31.4.0",22],["141.101.64.0",18],["108.162.192.0",18],["190.93.240.0",20],["188.114.96.0",20],["197.234.240.0",22],["198.41.128.0",17],["162.158.0.0",15],["104.16.0.0",13],["104.24.0.0",14],["172.64.0.0",13],["131.0.72.0",22]];
const ip4 = ip => { const p = ip.split('.').map(Number); return (p[0]<<24|p[1]<<16|p[2]<<8|p[3])>>>0; };
const PARSED = CIDRS.map(([b,bits]) => { const mask = bits===0?0:(4294967295<<(32-bits)>>>0); return { net: (ip4(b) & mask)>>>0, mask }; });
const isCF = ip => { const n = ip4(ip); return PARSED.some(({net,mask}) => ((n&mask)>>>0)===net); };
const read = f => fs.readFileSync(f,'utf8').split(/\r?\n/).map(s=>s.trim()).filter(s=>/^\d{1,3}(\.\d{1,3}){3}$/.test(s));
// extract existing pool from panel
const panel = fs.readFileSync('/home/user/omni-fix/panel.v91.final.html','utf8');
const m = panel.match(/var OMNI_SEED_V4_USER = \[([^\]]+)\];/);
const existing = [...m[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);
const clean = [...new Set(read('/tmp/clean_all.txt'))];
const server = [...new Set(read('/tmp/server_all.txt'))];
function report(name, arr){ const cf = arr.filter(isCF), non = arr.filter(x=>!isCF(x));
  console.log(`${name}: total=${arr.length} CF=${cf.length} nonCF=${non.length}`);
  const pref = {}; non.forEach(ip=>{const k=ip.split('.').slice(0,2).join('.');pref[k]=(pref[k]||0)+1;});
  console.log('  nonCF /16 prefixes:', JSON.stringify(pref));
  return {cf,non};
}
const e = report('EXISTING-255', existing);
const c = report('CLEAN-139', clean);
const s = report('SERVER-865', server);
// overlap checks
const es = new Set(existing);
console.log('\nserver ∩ existing =', server.filter(x=>es.has(x)).length);
console.log('clean  ∩ existing =', clean.filter(x=>es.has(x)).length);
console.log('clean  ∩ server   =', clean.filter(x=>new Set(server).has(x)).length);
console.log('existing unique?', new Set(existing).size === existing.length, '(set size', new Set(existing).size,')');
// union all
const union = [...new Set([...existing,...server,...clean])];
console.log('\nFULL UNION =', union.length, '| CF in union =', union.filter(isCF).length, '| nonCF =', union.filter(x=>!isCF(x)).length);
fs.writeFileSync('/home/user/rev152/existing.json', JSON.stringify(existing));
fs.writeFileSync('/home/user/rev152/clean.json', JSON.stringify(clean));
fs.writeFileSync('/home/user/rev152/server.json', JSON.stringify(server));
