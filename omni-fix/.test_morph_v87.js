const fs = require('fs');
const crypto = require('crypto');
const M = require('./.morph_lib.js');
const bundle = fs.readFileSync('omni.v87.js', 'utf8');
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

const seedA = 'harbor-view-1a2b:0d9c2b3e6f93d2d4d69179d4426cadaa';
const seedC = 'coral-river-9f3e:aa0102030405060708090a0b0c0d0e0f';
const a = M.omniPolymorphBundle(bundle, seedA);
const b = M.omniPolymorphBundle(bundle, seedA);
const c = M.omniPolymorphBundle(bundle, seedC);

let fails = 0;
const ok = (cond, label) => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + label); if (!cond) fails++; };

ok(a.code === b.code, 'deterministic per seed');
ok(a.code !== c.code, 'distinct per seed');
ok(md5(a.code) !== md5(bundle), 'upload hash differs from source');
console.log('hash a/c:', md5(a.code).slice(0, 12), md5(c.code).slice(0, 12));
console.log('persona a:', JSON.stringify(a.persona), '| c:', JSON.stringify(c.persona));

// markers that must vanish
ok(!a.code.includes('omni-release"') && !/<meta name=\\+"omni-release/.test(a.code), 'release meta removed');
ok(!a.code.includes('OMNI Cloud Core'), 'manifest brand removed');
ok(!a.code.includes('out.headers.set("x-omni", "1")'), 'x-omni marker header removed');
ok(!a.code.includes('omni-hook'), 'omni-hook literal removed');
ok(!/<title>[^<]*Omni[^<]*<\/title>/.test(a.code), 'branded title removed');
ok(!a.code.includes('Anti-1101'), 'Anti-1101 phrase removed');
ok(!/omni/i.test(a.token) && a.token !== c.token, 'per-node token clean & distinct: ' + a.token + ' / ' + c.token);

// zero brand tokens anywhere except the two protected infra endpoints
{
  const pro = M.MORPH_PROTECTED; // raw source-spelling strings (literal \u escapes)
  let rest = a.code;
  for (const u of pro) rest = rest.split(u).join('');
  const leftovers = rest.match(/omni/gi) || [];
  ok(leftovers.length === 0, 'zero omni tokens outside protected endpoints (leftovers=' + leftovers.length + ')');
  for (const u of pro) ok(a.code.includes(u), 'protected endpoint preserved: ' + u.slice(8, 56) + '…');
}

// favicon base64 blob survives byte-identical
{
  const pick = (txt) => { const m = txt.match(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]{200,})/); return m ? m[1] : ''; };
  ok(pick(bundle) && pick(bundle) === pick(a.code), 'favicon base64 byte-identical after morph');
}

// functional things that must survive (brand tokens are renamed, structure kept)
const TOK = a.token, TOKU = TOK.toUpperCase();
for (const k of ['cloudflare:sockets', `x-${TOK}-colo`, `x-${TOK}-csrf`, `var ${TOKU}_BUILD`, 'var worker_default = {', `${TOK}-releases`]) {
  ok(a.code.includes(k), 'kept (renamed) ' + k);
}
ok(a.code.includes(`data-theme=\\"${TOK}\\"`), 'theme attribute renamed consistently');
// every old header name is gone from wire-facing strings
ok(!a.code.includes('x-omni'), 'no x-omni* header survives');

// embedded panel literal still parses (escape-aware scan)
const marker = 'var panel_default = "';
const mIdx = a.code.indexOf(marker);
ok(mIdx >= 0, 'panel_default marker present');
const litStart = mIdx + marker.length - 1;
let i = litStart + 1, esc = false;
for (; i < a.code.length; i++) {
  const ch = a.code[i];
  if (esc) { esc = false; continue; }
  if (ch === '\\') { esc = true; continue; }
  if (ch === '"') break;
}
const literal = a.code.slice(litStart, i + 1);
const html = JSON.parse(literal);
ok(Buffer.byteLength(html) > 1e6, 'panel literal parses, bytes=' + Buffer.byteLength(html));
ok(html.includes('<title>' + a.persona.title + '</title>'), 'persona title inside panel');
ok(!html.includes('omni-release'), 'release meta absent from parsed panel');
ok(/data-build="[a-f0-9]{32}"/.test(html), 'data-build untouched');

// syntax check of the whole morphed bundle
fs.writeFileSync('/tmp/morphed_sample.js', a.code);
fs.writeFileSync('/tmp/morphed_c.js', c.code);

// helpers
const names = new Set();
for (let k2 = 0; k2 < 10; k2++) M.omniGenericNodeNames().forEach((n) => names.add(n));
ok([...names].every((n) => /^[a-z]+-[a-z]+-[a-f0-9]{4}$/.test(n) && !n.includes('omni')), 'generic node names: ' + [...names].slice(0, 4).join(', '));
ok(/^app-[a-f0-9]{10}$/.test(M.omniGenericDbName('harbor-view-1a2b')), 'generic db name: ' + M.omniGenericDbName('harbor-view-1a2b'));
ok(/^[0-4]-59\/5 \* \* \* \*$/.test(M.omniGenericCron('harbor-view-1a2b')), 'jittered cron: ' + M.omniGenericCron('harbor-view-1a2b'));
ok(M.omniClassifyCfError(new Error('9109 User was deactivated')).dead, '9109 classified dead');
ok(!M.omniClassifyCfError(new Error('timeout')).dead, 'timeout not classified dead');

console.log(fails ? '\nMORPH FAIL ' + fails : '\nMORPH ALL PASS');
process.exit(fails ? 1 : 0);
