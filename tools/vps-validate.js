function vpsDomain(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(v))
    throw new Error("دامنه معتبر را بدون https:// و بدون مسیر وارد کن");
  if (/\.(?:localhost|local|internal|invalid|test)$/.test(v)) throw new Error("دامنه عمومی خودت را وارد کن");
  return v;
}
function vpsPublicIp(value) {
  const v = String(value || "").trim();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) {
    const parts = v.split(".").map(Number), [a,b] = parts;
    if (parts.some(x => x < 0 || x > 255) || a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19))) return "";
    return parts.join(".");
  }
  if (v.includes(":")) {
    try {
      const h = new URL("https://[" + v + "]/").hostname;
      return /^[23][0-9a-f]{3}:/i.test(v) ? h.replace(/^\[|\]$/g, "") : "";
    } catch { return ""; }
  }
  return "";
}
function vpsTaskPayload(input) {
  const kind = String(input.kind || "");
  if (!["ws", "reality", "restart", "uninstall"].includes(kind)) throw new Error("نوع دستور مجاز نیست");
  const out = {kind};
  if (["restart", "uninstall"].includes(kind)) return out;
  if (input.uuid) {
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.uuid)) throw new Error("UUID معتبر نیست");
    out.uuid = input.uuid;
  }
  out.port = Number(input.port || 443);
  if (!Number.isInteger(out.port) || out.port < 1 || out.port > 65535) throw new Error("پورت معتبر نیست");
  if (kind === "reality") {
    // No automatic snapp.ir camouflage claim: direct Reality is a separate mode.
    out.sni = vpsDomain(input.sni);
  } else {
    out.port = 443;
    out.domain = vpsDomain(input.domain);
    out.via_cdn = input.via_cdn === true;
    out.address = String(input.address || out.domain).trim();
    out.address = vpsPublicIp(out.address) || vpsDomain(out.address);
    if (!out.via_cdn && out.address !== out.domain) throw new Error("آدرس جایگزین فقط برای مسیر CDN است");
    out.path = String(input.path || "/vzn");
    if (!/^\/[A-Za-z0-9/_-]{1,120}$/.test(out.path)) throw new Error("مسیر WS معتبر نیست");
    if (input.fake_sni || input.spoof_ip) {
      if (!out.via_cdn) throw new Error("Spoof آزمایشی فقط برای پروفایل CDN است");
      out.fake_sni = vpsDomain(input.fake_sni);
      out.spoof_ip = vpsPublicIp(input.spoof_ip);
      if (!out.spoof_ip) throw new Error("Spoof IP باید یک IP عمومی معتبر باشد، نه اسم سایت");
    }
  }
  return out;
}

// Installed panels skip the legacy full-schema bootstrap. Paid features must
// migrate independently, including panels upgraded from versions before v10.
var VPS_SCHEMA_PROMISE = null;
async function ensureVpsSchema(env) {
  if (!VPS_SCHEMA_PROMISE) VPS_SCHEMA_PROMISE = env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS vps_nodes(
      id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, label TEXT,
      join_token TEXT UNIQUE, node_token TEXT UNIQUE, ip TEXT, port INTEGER DEFAULT 443,
      status TEXT DEFAULT 'pending_join', last_seen TEXT, info TEXT DEFAULT '{}',
      profiles TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS vps_tasks(
      id INTEGER PRIMARY KEY AUTOINCREMENT, node_id INTEGER NOT NULL, payload TEXT NOT NULL,
      state INTEGER DEFAULT 0, result TEXT, created_at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS vps_line_checks(
      node_id INTEGER NOT NULL, profile_key TEXT NOT NULL,
      verified_at TEXT NOT NULL, PRIMARY KEY(node_id,profile_key))`)
  ]).catch(err => { VPS_SCHEMA_PROMISE = null; throw err; });
  await VPS_SCHEMA_PROMISE;
}
