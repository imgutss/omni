/* rev142-v3 — polymorphic anti-fingerprint compiler for managed panel deploys.
   Pure string transforms, deterministic per (workerName, accountId), so a repair
   rebuilds the exact same variant. A deployed node keeps full behavior but loses
   every scannable product token: branding, shared names, paths, headers, storage
   keys, user agents and internal identifiers — each node gets its own token. */

function omniMorphHash(seedText) {
  const s = String(seedText || "");
  let a = 0x811c9dc5 >>> 0;
  let b = 0x01000193 >>> 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ ((c << 3) | (c >> 2)), 0x85ebca6b) >>> 0;
  }
  let out = "";
  for (let i = 0; i < 4; i++) {
    a = Math.imul(a ^ (a >>> 13), 0x5bd1e995) >>> 0;
    b = Math.imul(b ^ (b >>> 15), 0x27d4eb2f) >>> 0;
    out += a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
  }
  return out;
}

const OMNI_MORPH_PERSONAS = [
  { name: "Harbor", title: "Harbor Console", desc: "Service management console" },
  { name: "Atlas", title: "Atlas Dashboard", desc: "Infrastructure dashboard" },
  { name: "Beacon", title: "Beacon Panel", desc: "Node management panel" },
  { name: "Cedar", title: "Cedar Control", desc: "Service control center" },
  { name: "Delta", title: "Delta Workspace", desc: "Cloud workspace" },
  { name: "Ember", title: "Ember Studio", desc: "Deployment studio" },
  { name: "Falcon", title: "Falcon Manager", desc: "Resource manager" },
  { name: "Granite", title: "Granite Board", desc: "Operations board" },
  { name: "Haven", title: "Haven UI", desc: "Administration interface" },
  { name: "Iris", title: "Iris Cockpit", desc: "Monitoring cockpit" },
  { name: "Jasper", title: "Jasper Hub", desc: "Service hub" },
  { name: "Kestrel", title: "Kestrel App", desc: "Edge application" },
  { name: "Lumen", title: "Lumen Desk", desc: "Network operations desk" },
  { name: "Marble", title: "Marble View", desc: "System overview" },
  { name: "Nimbus", title: "Nimbus Site", desc: "Cloud control site" },
  { name: "Onyx", title: "Onyx Portal", desc: "Account portal" }
];

function omniMorphPersona(seedText) {
  const hex = omniMorphHash(seedText);
  const p = OMNI_MORPH_PERSONAS[parseInt(hex.slice(0, 8), 16) % OMNI_MORPH_PERSONAS.length];
  return { name: p.name, title: p.title, desc: p.desc, hex, tag: hex.slice(0, 10) };
}

// per-node replacement word; alphabet deliberately excludes o,m,n,i so the token
// can never itself contain the forbidden four-letter sequence.
const MORPH_CONS = "bcdfghjkpqrstvwxz";
const MORPH_VOW = "aeu";
function omniMorphToken(seedText) {
  const h = omniMorphHash(String(seedText) + ":word");
  let word = "";
  for (let i = 0; i < 3; i++) {
    word += MORPH_CONS[parseInt(h.slice(i * 4, i * 4 + 2), 16) % MORPH_CONS.length];
    word += MORPH_VOW[parseInt(h.slice(i * 4 + 2, i * 4 + 4), 16) % MORPH_VOW.length];
  }
  return word;
}

const OMNI_NODE_ADJ = ["amber", "azure", "bright", "calm", "clear", "coral", "cosmic", "crisp", "dusty", "ember", "faint", "gentle", "hidden", "hollow", "ivory", "jade", "keen", "lunar", "misty", "noble", "ocean", "pale", "quiet", "rapid", "silent", "solar", "teal", "umber", "vivid", "warm", "woven", "zesty"];
const OMNI_NODE_NOUN = ["harbor", "meadow", "river", "summit", "atlas", "beacon", "canyon", "delta", "forest", "garden", "horizon", "island", "jungle", "knoll", "lagoon", "mesa", "oasis", "prairie", "quartz", "ridge", "stream", "tundra", "valley", "willow", "anchor", "bridge", "cipher", "dune", "echo", "fjord", "grove", "haven"];

function omniGenericNodeNames() {
  const names = new Set();
  let guard = 0;
  while (names.size < 3 && guard < 80) {
    guard++;
    const adj = OMNI_NODE_ADJ[Math.floor(Math.random() * OMNI_NODE_ADJ.length)];
    const noun = OMNI_NODE_NOUN[Math.floor(Math.random() * OMNI_NODE_NOUN.length)];
    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4);
    names.add(`${adj}-${noun}-${suffix}`);
  }
  return [...names];
}

function omniGenericDbName(seedText) {
  return "app-" + omniMorphHash(String(seedText) + ":db").slice(0, 10);
}

function omniGenericCron(seedText) {
  const m = parseInt(omniMorphHash(String(seedText) + ":cron").slice(0, 4), 16) % 5;
  return `${m}-59/5 * * * *`;
}

// external operator-owned endpoints whose DNS/registry names cannot be rewritten
// without standing up matching infrastructure; protected from the blanket pass.
const MORPH_PROTECTED = [
  "https://github.com/Alisarani7021/omni-r\\u0065nder-r\\u0065lay",
  "https://omni-r\\u0061ilway-check-production.up.r\\u0061ilway.app/"
];

function omniPolymorphBundle(bundle, seedText) {
  let s = String(bundle || "");
  if (s.length < 1e5 || !s.includes("cloudflare:sockets")) throw new Error("bundle invalid for morph");
  const persona = omniMorphPersona(seedText);
  // idempotent: a bundle already morphed with this seed passes through unchanged
  if (s.startsWith(`/* ${persona.name.toLowerCase()}-${persona.tag} */\n`)) {
    return { code: s, persona };
  }
  const tok = omniMorphToken(seedText);
  const TOK = tok.toUpperCase();
  const Tok = tok[0].toUpperCase() + tok.slice(1);

  // 0) the compiler itself never ships to customer nodes
  s = s.replace(/\/\*__MORPH_LIB_BEGIN__\*\/[\s\S]*?\/\*__MORPH_LIB_END__\*\/\n?/g, "");

  // 1) unique build banner — every deployed worker gets a distinct upload hash
  s = `/* ${persona.name.toLowerCase()}-${persona.tag} */\n` + s;

  // 2) release meta tag (markers sit in escaped string literals; tolerate backslashes)
  s = s.replace(/<meta name=\\+"omni-release\\+" content=\\+"[^"\\]*\\+">/g, "");

  // 3) HTML title / description carrying the product name; keep local quote escaping intact
  s = s.replace(/<title>[^<]*Omni[^<]*<\/title>/g, `<title>${persona.title}</title>`);
  s = s.replace(/(<meta name=\\+"description\\+" content=\\+")[^"\\]*(\\+">)/g, (_m, p1, p2) => p1 + persona.desc + p2);

  // 4) PWA manifest identity. Backslash runs are captured and re-emitted verbatim
  //    because the same JSON appears at 1-3 escaping layers (raw, \", \\\").
  s = s.replace(/(\\*)"name(\\*)": (\\*)"OMNI Cloud Core(\\*)"/g,
    (_m, b1, b2, b3, b4) => `${b1}"name${b2}": ${b3}"${persona.name}"${b4}`);
  s = s.replace(/(\\*)"short_name(\\*)": (\\*)"OMNI"(\\*)"/g,
    (_m, b1, b2, b3, b4) => `${b1}"short_name${b2}": ${b3}"${persona.name}"${b4}`);
  // backstop: every remaining occurrence (manifest descriptions, Persian copy)
  // is plain brand text — no quote or backslash is touched by this swap.
  s = s.split("OMNI Cloud Core").join(persona.name);

  // 5) scannable response marker header (csrf/colo headers are renamed wholesale in step 8)
  s = s.split('out.headers.set("x-omni", "1")').join('out.headers.set("x-svc", "1")');
  s = s.split('out.headers.set("access-control-expose-headers", "x-omni")').join('out.headers.set("access-control-expose-headers", "x-svc")');

  // 6) default webhook path literal — child deploys bind a random secret anyway.
  //    Preserve the exact backslash depth (the same source appears raw and inside
  //    string-encoded modules with 1-2 escaping layers).
  const hookSecret = persona.hex.slice(0, 24);
  s = s.replace(/(\|\| )(\\*)"omni-hook(\\*)"/g, (_m, lead, pre, post) => `${lead}${pre}"${hookSecret}"${post}`);

  // 7) marketing phrases referencing the ban-defense project
  s = s.split("Anti-1101 Core v3.6").join("Edge Core v3.6");
  s = s.split("Anti-1101").join("Edge Guard");

  // 8) protect binary blobs and operator-owned endpoints, then do the wholesale
  //    identifier/string rename — one neutral per-node token in three casings.
  const stash = [];
  const hide = (text) => {
    const key = `\x01M${stash.length}\x01`;
    stash.push(text);
    return key;
  };
  for (const u of MORPH_PROTECTED) {
    if (s.includes(u)) s = s.split(u).join(hide(u));
  }
  s = s.replace(/[A-Za-z0-9+/]{80,}={0,2}/g, (m) => (/omni/i.test(m) ? hide(m) : m));

  s = s.replace(/omni/gi, (m) => (m === "OMNI" ? TOK : (m[0] === "O" ? Tok : tok)));

  s = s.replace(/\x01M(\d+)\x01/g, (_m, n) => stash[Number(n)]);

  // 9) audit: nothing brand-shaped may survive outside the protected allowlist
  const residual = [];
  let i = 0;
  while ((i = s.toLowerCase().indexOf("omni", i)) >= 0) {
    const ctx = s.slice(Math.max(0, i - 40), i + 44);
    if (!MORPH_PROTECTED.some((u) => ctx.includes(u.slice(8, 40)))) residual.push(ctx);
    i += 4;
  }
  if (residual.length) throw new Error("morph residual brand tokens: " + residual.slice(0, 3).join(" | "));
  if (s.length < 1e5 || !s.includes("cloudflare:sockets")) throw new Error("morph output invalid");

  return { code: s, persona, token: tok };
}

function omniClassifyCfError(err) {
  const msg = String(err?.message || err || "");
  const deactivated = /9109|deactivated/i.test(msg);
  const forbidden = /\b403\b|ToS|terms of service|access blocked/i.test(msg);
  return { deactivated, forbidden, dead: deactivated || forbidden, message: msg.slice(0, 300) };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    omniMorphHash, omniMorphPersona, omniMorphToken, omniGenericNodeNames, omniGenericDbName,
    omniGenericCron, omniPolymorphBundle, omniClassifyCfError, OMNI_MORPH_PERSONAS,
    MORPH_PROTECTED
  };
}
