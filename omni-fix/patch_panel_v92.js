// rev152 panel patch — merge uploaded IP lists into the config-builder repository.
//   1) OMNI_SEED_V4_USER (the «IPv4های تو» pack) grows 255 -> 865: the original 255
//      stay as an untouched prefix, 610 new Cloudflare-edge IPs from the three
//      server-addresses files are appended, all deduped.
//   2) New sibling array OMNI_SEED_V4_CLEAN holds the 139 generic (non-Cloudflare)
//      clean IPs, exposed through a separate «userclean» pack chip so the CF pack
//      keeps only worker-frontable addresses.
// Panel-only change; worker DoH engine stays byte-identical to rev150/rev151.
const fs = require('fs');

const user865 = JSON.parse(fs.readFileSync('/home/user/rev152/user865.json', 'utf8'));
const clean139 = JSON.parse(fs.readFileSync('/home/user/rev152/clean139.json', 'utf8'));
if (user865.length !== 865 || new Set(user865).size !== 865) throw new Error('user865 sanity');
if (clean139.length !== 139 || new Set(clean139).size !== 139) throw new Error('clean139 sanity');

const userLit = 'var OMNI_SEED_V4_USER = ' + JSON.stringify(user865) + ';';
const cleanLit = 'var OMNI_SEED_V4_CLEAN = ' + JSON.stringify(clean139) + ';';

let html = fs.readFileSync('/home/user/omni-fix/panel.v91.final.html', 'utf8');
const edits = [];
function rep(oldT, newT, label, expect = 1) {
  const n = html.split(oldT).length - 1;
  if (n !== expect) throw new Error(`anchor count ${n} (expected ${expect}) for: ${label}`);
  html = html.split(oldT).join(newT);
  edits.push(`${label} x${n}`);
}

/* 1 — replace BOTH array-literal sites (outer IIFE scope + redeclared site) and
       declare the new generic-clean array right next to each one. */
const oldUserRe = /var OMNI_SEED_V4_USER = \[(?:[^\]]+)\];/g;
const matches = html.match(oldUserRe);
if (!matches || matches.length !== 2) throw new Error('OMNI_SEED_V4_USER literal sites: ' + (matches ? matches.length : 0));
if (matches[0] !== matches[1]) throw new Error('the two seed literals are not identical — aborting');
const oldUserLit = matches[0];
rep(oldUserLit, userLit + '\n' + cleanLit, 'seed-v4-user literal (both scopes) + seed-v4-clean', 2);

/* 2 — pack branch in zt (Gt/Bt consume zt's list, single branch site) */
rep(
  "else if(g.pack==='userv4'){items=[...OMNI_SEED_V4_USER];}",
  "else if(g.pack==='userv4'){items=[...OMNI_SEED_V4_USER];}\n  else if(g.pack==='userclean'){items=[...OMNI_SEED_V4_CLEAN];}",
  'builder pack branch (zt)'
);

/* 3 — pack chip row: relabel 255 -> 865 and add the generic-clean chip */
rep(
  '["userv4", "📦 IPv4های تو · ۲۵۵"], ["userv6"',
  '["userv4", "📦 IPv4های تو · ۸۶۵"], ["userclean", "📁 IPهای تمیز عمومی · ۱۳۹"], ["userv6"',
  'pack chip row'
);

/* 4 — selection info label map */
rep(
  "userv4: 'IPv4های تمیز تو · ۲۵۵'",
  "userv4: 'IPv4های تمیز تو · ۸۶۵', userclean: 'IPهای تمیز عمومی · ۱۳۹ (غیرکلادفلر)'",
  'cfgSelInfoHtml label map'
);

/* 5 — omniPackIps: lexical handle for the clean array */
rep(
  'var V4 = (typeof OMNI_SEED_V4_USER !== "undefined" && OMNI_SEED_V4_USER) || G.OMNI_SEED_V4_USER || [];',
  'var V4 = (typeof OMNI_SEED_V4_USER !== "undefined" && OMNI_SEED_V4_USER) || G.OMNI_SEED_V4_USER || [];\n' +
  '    var V4C = (typeof OMNI_SEED_V4_CLEAN !== "undefined" && OMNI_SEED_V4_CLEAN) || G.OMNI_SEED_V4_CLEAN || [];',
  'omniPackIps V4C handle'
);

/* 6 — omniPackIps pack metadata: relabel + new key */
rep(
  'if (key === "userv4") return { label: "فهرست IPv4 تمیز تو (۲۵۵)", v4: V4.slice(), v6: [] };',
  'if (key === "userv4") return { label: "فهرست IPv4 تمیز تو (۸۶۵)", v4: V4.slice(), v6: [] };\n' +
  '    if (key === "userclean") return { label: "فهرست IPهای تمیز عمومی غیرکلادفلر (۱۳۹) — آزمودنی از خط تو", v4: V4C.slice(), v6: [] };',
  'omniPackIps pack metadata'
);

/* post-conditions */
if (html.includes('�')) throw new Error('U+FFFD introduced');
if (html.includes('۲۵۵')) throw new Error('stale ۲۵۵ label remains');
const userSites = html.match(/var OMNI_SEED_V4_USER = \[(?:[^\]]+)\];/g) || [];
const cleanSites = html.match(/var OMNI_SEED_V4_CLEAN = \[(?:[^\]]+)\];/g) || [];
if (userSites.length !== 2 || cleanSites.length !== 2) throw new Error('declaration site counts wrong');
if (new Set(userSites).size !== 1 || new Set(cleanSites).size !== 1) throw new Error('paired declarations diverged');
if (!html.includes("g.pack==='userclean'") || !html.includes('key === "userclean"') || !html.includes('"userclean", "📁')) {
  throw new Error('userclean wiring incomplete');
}

fs.writeFileSync('/home/user/omni-fix/panel.v92.final.html', html);
console.log('panel.v92.final.html written');
console.log('edits:', edits.join(' | '));
console.log('bytes=', Buffer.byteLength(html, 'utf8'));
