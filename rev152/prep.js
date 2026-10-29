const fs = require('fs');
const read = f => fs.readFileSync(f,'utf8').split(/\r?\n/).map(s=>s.trim()).filter(s=>/^\d{1,3}(\.\d{1,3}){3}$/.test(s));
const glob = pat => fs.readdirSync('/home/user/uploads').filter(x=>x.includes(pat)).flatMap(x=>read('/home/user/uploads/'+x));
const clean = [...new Set(glob('clean ip'))].sort();
const server = [...new Set(glob('server-addresses'))].sort();
// existing pool straight from live panel
const panel = fs.readFileSync('/home/user/omni-fix/panel.v91.final.html','utf8');
const m = panel.match(/var OMNI_SEED_V4_USER = \[([^\]]+)\];/);
const existing = [...m[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);
const exSet = new Set(existing);
if (existing.length !== 255 || exSet.size !== 255) throw new Error('existing pool sanity failed');
const added = server.filter(ip => !exSet.has(ip));
const merged = [...existing, ...added];
// hard guarantees
if (merged.length !== new Set(merged).size) throw new Error('dup in merged');
if (added.length !== 610 || merged.length !== 865) throw new Error('counts off');
if (clean.length !== 139 || new Set(clean).size !== 139) throw new Error('clean counts off');
if (clean.some(ip=>exSet.has(ip)) || clean.some(ip=>new Set(server).has(ip))) throw new Error('clean overlap');
if (!existing.every((ip,i)=>merged[i]===ip)) throw new Error('existing order not preserved');
if (!server.every(ip=>new Set(merged).has(ip))) throw new Error('not all server IPs merged');
const v4 = ip => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(ip);
if (![...merged,...clean].every(v4)) throw new Error('invalid v4 present');
fs.writeFileSync('/home/user/rev152/user865.json', JSON.stringify(merged));
fs.writeFileSync('/home/user/rev152/clean139.json', JSON.stringify(clean));
console.log('OK existing=255 retained as prefix; new CF added=', added.length, '; merged=', merged.length, '; clean=', clean.length);
console.log('sample added:', added.slice(0,5).join(', '));
console.log('sample clean:', clean.slice(0,5).join(', '));
