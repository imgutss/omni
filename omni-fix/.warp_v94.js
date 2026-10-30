// rev154 — current Cloudflare WARP registration, validation and single-flight storage.
// Protocol constants follow wgcf v2.3.1 (MIT), API v0a5641 / Android 6.38.9.
const OMNI_WARP_API_VERSION = "v0a5641";
const OMNI_WARP_CLIENT_VERSION = "a-6.38.9-5641";
const OMNI_WARP_USER_AGENT = "1.1.1.1/6.38.9-5641 (Android 16.0.0)";
const OMNI_WARP_REGISTRATION_URL = "https://api.cloudflareclient.com/" + OMNI_WARP_API_VERSION;
var OMNI_WARP_LOCK_SCHEMA_PROMISE = null;

function omniWarpError(message, httpStatus = 502, code = "warp_registration_failed", retryAfter = 0, upstreamStatus = 0) {
  const error = Error(String(message || "ثبت کلید WARP انجام نشد.").slice(0, 300));
  error.httpStatus = httpStatus;
  error.code = code;
  error.retryAfter = Math.max(0, Number(retryAfter) || 0);
  error.upstreamStatus = Math.max(0, Number(upstreamStatus) || 0);
  return error;
}
function omniWarpRetryAfter(value) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Math.min(86400, Math.max(1, Number(raw) || 0));
  const at = Date.parse(raw);
  return Number.isFinite(at) ? Math.min(86400, Math.max(1, Math.ceil((at - Date.now()) / 1000))) : 0;
}
function omniWarpIsKey(value) {
  try { return omniB64ToBytes(String(value || "")).length === 32; } catch { return false; }
}
function omniWarpIsV4(value) {
  const parts = String(value || "").split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}
function omniWarpIsV6(value) {
  const text = String(value || "");
  if (text.length < 2 || text.length > 39 || !/^[0-9a-f:]+$/i.test(text) || !text.includes(":")) return false;
  if ((text.match(/::/g) || []).length > 1 || text.includes(":::")) return false;
  const compressed = text.includes("::");
  if (!compressed && (text.startsWith(":") || text.endsWith(":"))) return false;
  const parts = text.split(":");
  if (!parts.every((part) => part === "" || /^[0-9a-f]{1,4}$/i.test(part))) return false;
  const explicitGroups = parts.filter(Boolean).length;
  return compressed ? explicitGroups < 8 : parts.length === 8 && explicitGroups === 8;
}
function omniWarpAccountUsable(account) {
  if (!account || typeof account !== "object") return false;
  if (!omniWarpIsKey(account.privateKey) || !omniWarpIsKey(account.peerPublicKey)) return false;
  const v4 = String(account.v4 || "").replace(/\/\d+$/, "");
  const v6 = String(account.v6 || "").replace(/\/\d+$/, "");
  if (!omniWarpIsV4(v4) || !omniWarpIsV6(v6)) return false;
  try { return omniB64ToBytes(String(account.clientId || "")).length >= 3; } catch { return false; }
}
function omniWarpPublicAccount(account) {
  if (!account || typeof account !== "object") return account || null;
  const out = Object.assign({}, account);
  delete out.registrationToken;
  delete out._registration;
  return out;
}
function omniWarpUpstreamMessage(payload) {
  const list = Array.isArray(payload?.errors) ? payload.errors : [];
  const first = list[0] || {};
  const code = first.code ? " کد " + String(first.code).replace(/[^0-9a-z_-]/gi, "").slice(0, 24) : "";
  const message = String(first.message || "").replace(/[<>\r\n]/g, " ").trim().slice(0, 140);
  return (code || message) ? " —" + code + (message ? ": " + message : "") : "";
}
async function omniWarpDeleteRegistration(credential) {
  const id = String(credential?.id || "");
  const token = String(credential?.token || "");
  if (!id || !token) return false;
  try {
    const response = await fetch(OMNI_WARP_REGISTRATION_URL + "/reg/" + encodeURIComponent(id), {
      method: "DELETE",
      headers: {
        "authorization": "Bearer " + token,
        "CF-Client-Version": OMNI_WARP_CLIENT_VERSION,
        "user-agent": OMNI_WARP_USER_AGENT
      },
      signal: AbortSignal.timeout(12000)
    });
    return response.status === 204 || response.status === 404 || response.ok;
  } catch { return false; }
}
async function omniWarpRegister() {
  if (!crypto?.subtle?.generateKey) throw omniWarpError("وب‌کریپتو در این runtime کلید X25519 نمی‌سازد.", 500, "warp_crypto_unavailable");
  const kp = await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]);
  const privPkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const privRaw = privPkcs8.slice(privPkcs8.length - 32);
  const privateKey = omniBytesToB64(privRaw), publicKey = omniBytesToB64(pubRaw);
  const body = {
    key: publicKey,
    install_id: "",
    fcm_token: "",
    tos: new Date().toISOString(),
    model: "PC",
    serial_number: "",
    locale: "en_US",
    os_version: "16.0.0",
    key_type: "curve25519",
    tunnel_type: "wireguard"
  };
  let response;
  try {
    // Registration is deliberately not retried: POST /reg is not idempotent and a
    // lost response could otherwise create orphan devices or worsen a 429 limit.
    response = await fetch(OMNI_WARP_REGISTRATION_URL + "/reg", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "CF-Client-Version": OMNI_WARP_CLIENT_VERSION,
        "user-agent": OMNI_WARP_USER_AGENT
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    });
  } catch (cause) {
    const timeout = String(cause?.name || "") === "TimeoutError" || /timeout|timed out/i.test(String(cause?.message || cause));
    throw omniWarpError(timeout ? "پاسخ ثبت WARP در ۲۰ ثانیه نرسید؛ ثبت تکراری خودکار انجام نشد." : "ارتباط با سرویس ثبت Cloudflare WARP برقرار نشد.", timeout ? 504 : 502, timeout ? "warp_upstream_timeout" : "warp_upstream_network");
  }
  const text = await response.text().catch(() => "");
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    const suffix = omniWarpUpstreamMessage(payload);
    const retryAfter = omniWarpRetryAfter(response.headers.get("retry-after"));
    if (response.status === 429) {
      throw omniWarpError("Cloudflare ثبت دستگاه را موقتاً محدود کرد (429)" + suffix + "؛ retry پشت‌سرهم انجام نشد. " + (retryAfter ? "بعد از " + retryAfter + " ثانیه" : "چند دقیقه بعد") + " دوباره تلاش کن.", 429, "warp_rate_limited", retryAfter, 429);
    }
    throw omniWarpError("ثبت دستگاه در Cloudflare WARP پذیرفته نشد (" + response.status + ")" + suffix + ".", 502, "warp_upstream_rejected", retryAfter, response.status);
  }
  const root = payload?.result && typeof payload.result === "object" ? payload.result : payload;
  const config = root?.config || {};
  const iface = config.interface || {}, peer = (config.peers || [])[0] || {};
  const v4 = String(iface.addresses?.v4 || "").replace(/\/\d+$/, "");
  const v6 = String(iface.addresses?.v6 || "").replace(/\/\d+$/, "");
  const clientId = String(config.client_id || "");
  const deviceId = String(root?.id || ""), registrationToken = String(root?.token || "");
  const candidate = {
    privateKey,
    publicKey,
    peerPublicKey: String(peer.public_key || ""),
    v4,
    v6,
    clientId,
    reserved: [0, 0, 0],
    mtu: 1280,
    jc: 4,
    jmin: 40,
    jmax: 70,
    s1: 0,
    s2: 0,
    h1: 1,
    h2: 2,
    h3: 3,
    h4: 4,
    deviceId,
    registrationApi: OMNI_WARP_API_VERSION,
    createdAt: new Date().toISOString()
  };
  if (!omniWarpAccountUsable(candidate) || !deviceId || !registrationToken) {
    throw omniWarpError("پاسخ Cloudflare فیلدهای لازم کلید/آدرس/شناسهٔ دستگاه را کامل ندارد؛ هیچ کلیدی ذخیره نشد.", 502, "warp_invalid_upstream_response", 0, response.status);
  }
  try {
    const decoded = omniB64ToBytes(clientId);
    candidate.reserved = [decoded[0], decoded[1], decoded[2]];
  } catch {}
  return { account: candidate, credential: { id: deviceId, token: registrationToken } };
}

async function omniWarpLockSchema(env2) {
  if (!OMNI_WARP_LOCK_SCHEMA_PROMISE) {
    OMNI_WARP_LOCK_SCHEMA_PROMISE = env2.DB.prepare(`CREATE TABLE IF NOT EXISTS omni_warp_registration_lock(
      id INTEGER PRIMARY KEY CHECK(id = 1),
      owner TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`).run().catch((error) => { OMNI_WARP_LOCK_SCHEMA_PROMISE = null; throw error; });
  }
  return OMNI_WARP_LOCK_SCHEMA_PROMISE;
}
async function omniWarpLockAcquire(env2, owner, leaseMs = 35000) {
  await omniWarpLockSchema(env2);
  const now = Date.now();
  const result = await env2.DB.prepare(`INSERT INTO omni_warp_registration_lock(id,owner,expires_at) VALUES(1,?,?)
    ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at
    WHERE omni_warp_registration_lock.expires_at < ?`).bind(owner, now + leaseMs, now).run();
  return Number(result?.meta?.changes || 0) > 0;
}
async function omniWarpLockRelease(env2, owner) {
  try { await env2.DB.prepare("DELETE FROM omni_warp_registration_lock WHERE id=1 AND owner=?").bind(owner).run(); } catch {}
}
function omniWarpCanReuse(account) {
  return omniWarpAccountUsable(account) && String(account.privateKey || "") !== OMNI_LEGACY_WARP_KEY;
}
async function omniWarpGenerateAccount(env2, options = {}) {
  const force = options.force === true;
  const before = await omniWarpAccountCurrent(env2);
  const beforeKey = String(before?.privateKey || "");
  if (!force && omniWarpCanReuse(before)) return { account: before, reused: true, coalesced: false };
  const owner = crypto.randomUUID();
  const acquired = await omniWarpLockAcquire(env2, owner);
  if (!acquired) {
    // Another isolate/tab is registering. Wait for its committed account instead
    // of sending a second non-idempotent registration to Cloudflare.
    for (let attempt = 0; attempt < 44; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const current = await omniWarpAccountCurrent(env2);
      if (omniWarpCanReuse(current) && (!force || String(current.privateKey || "") !== beforeKey)) {
        return { account: current, reused: false, coalesced: true };
      }
    }
    throw omniWarpError("یک ثبت WARP دیگر هنوز در حال انجام است؛ ثبت دومی ارسال نشد. چند ثانیه بعد وضعیت را تازه کن.", 409, "warp_registration_in_progress", 2);
  }
  let credential = null;
  try {
    const latest = await omniWarpAccountCurrent(env2);
    if (!force && omniWarpCanReuse(latest)) return { account: latest, reused: true, coalesced: false };
    const registered = await omniWarpRegister();
    credential = registered.credential;
    const account = Object.assign({}, registered.account, { registrationToken: credential.token });
    // Rotation changes only registration material. User-owned endpoint and AWG
    // choices survive; reserved/clientId always come from the new registration.
    const preserve = ["customEndpoint", "mtu", "jc", "jmin", "jmax", "s1", "s2", "h1", "h2", "h3", "h4", "dns", "keepalive", "listenPort", "domainStrategy"];
    for (const key of preserve) if (latest && latest[key] !== undefined) account[key] = latest[key];
    try {
      await putSetting(env2, "warp_gaming_account", JSON.stringify(account));
    } catch (cause) {
      await omniWarpDeleteRegistration(credential);
      credential = null;
      throw omniWarpError("کلید از Cloudflare دریافت شد ولی در D1 ذخیره نشد؛ ثبت آزمایشی لغو و کلید قبلی حفظ شد.", 500, "warp_storage_failed");
    }
    credential = null; // the stored registration must remain active
    if (latest?.deviceId && latest?.registrationToken && String(latest.deviceId) !== String(account.deviceId)) {
      await omniWarpDeleteRegistration({ id: latest.deviceId, token: latest.registrationToken });
    }
    return { account, reused: false, coalesced: false };
  } finally {
    if (credential) await omniWarpDeleteRegistration(credential);
    await omniWarpLockRelease(env2, owner);
  }
}
async function omniWarpPreserveSettingsPatch(env2, patch) {
  if (!patch || patch.warp_gaming_account === undefined) return;
  let incoming = {};
  try { incoming = JSON.parse(String(patch.warp_gaming_account || "{}")) || {}; } catch { incoming = {}; }
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) incoming = {};
  const current = await omniWarpAccountCurrent(env2);
  if (!current) { patch.warp_gaming_account = JSON.stringify(incoming); return; }
  const merged = Object.assign({}, current, incoming);
  // /api/settings is for endpoint/AWG preferences, never key rotation. This
  // prevents a stale browser write from wiping or replacing a newer key.
  const registrationFields = ["privateKey", "publicKey", "peerPublicKey", "v4", "v6", "clientId", "reserved", "deviceId", "registrationToken", "registrationApi", "createdAt"];
  for (const key of registrationFields) {
    if (current[key] !== undefined) merged[key] = current[key];
    else delete merged[key];
  }
  patch.warp_gaming_account = JSON.stringify(merged);
}
