/* =========================================================================
 * OMNI · independent Vercel WebSocket relay manager
 * Separate API/table/UI lifecycle from the managed Bot-Hosting + Arvan section.
 * Each panel user verifies their own Bot-Hosting key, discovers their own running
 * relay, and snapshots its host/path; no tokens are stored or upstream mutated.
 * ========================================================================= */
var OV_VERCEL_RELAY_SOURCE = "__OMNI_VERCEL_RELAY_SOURCE__";
var OV_VERCEL_API = "https://api.vercel.com";
var OV_PUBLIC_PATH = "/ws/vl";

function ovJson(value, status) {
  return Response.json(value, { status: status || 200, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
function ovFail(message, status) {
  throw Object.assign(new Error(message), { ovStatus: status || 400 });
}
function ovSafeTarget(source) {
  const host = String(source && source.apps_host || "").trim().toLowerCase().replace(/\.$/, "");
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+apps\.bot-hosting\.cloud$/.test(host))
    ovFail("هاست عمومی Bot-Hosting برای upstream معتبر نیست.");
  const path = String(source && source.ws_path || "").trim();
  if (!/^\/[A-Za-z0-9_/-]{1,99}$/.test(path) || path.includes("//") || path.includes(".."))
    ovFail("مسیر خصوصی WebSocket upstream معتبر نیست.");
  return { host, path };
}
async function ovSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS vercel_relays(
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL DEFAULT '',
    source_job_id TEXT NOT NULL DEFAULT '',
    source_domain TEXT NOT NULL DEFAULT '',
    target_host TEXT NOT NULL DEFAULT '',
    target_path TEXT NOT NULL DEFAULT '',
    project_name TEXT NOT NULL DEFAULT '',
    project_id TEXT NOT NULL DEFAULT '',
    deploy_id TEXT NOT NULL DEFAULT '',
    domain TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();
}
function ovPublic(row) {
  if (!row) return null;
  return {
    id: String(row.id || ""), label: String(row.label || ""),
    source_job_id: String(row.source_job_id || ""), source_deployment_id: String(row.source_job_id || ""), source_domain: String(row.source_domain || ""),
    target_host: String(row.target_host || ""), target_path: String(row.target_path || ""),
    project_name: String(row.project_name || ""), project_id: String(row.project_id || ""),
    deploy_id: String(row.deploy_id || ""), domain: String(row.domain || ""),
    url: String(row.url || ""), created_at: String(row.created_at || ""), updated_at: row.updated_at || 0
  };
}
async function ovFetch(token, path, method, body, timeoutMs, allow404) {
  const opt = {
    method: method || "GET", redirect: "manual",
    headers: { authorization: "Bearer " + String(token || ""), accept: "application/json" },
    signal: AbortSignal.timeout(Math.max(3000, Number(timeoutMs) || 15000))
  };
  if (body !== undefined) { opt.headers["content-type"] = "application/json"; opt.body = JSON.stringify(body); }
  let response;
  try { response = await fetch(OV_VERCEL_API + path, opt); }
  catch (_) { ovFail("اتصال به Vercel برقرار نشد؛ دوباره تلاش کن.", 502); }
  const text = await response.text();
  let data = {}; try { data = JSON.parse(text); } catch (_) {}
  if (!response.ok && !(allow404 && response.status === 404)) {
    const info = data && data.error || {};
    const message = String(info.message || data.message || text || "unknown error").slice(0, 220);
    const err = new Error("Vercel: " + message);
    err.ovStatus = response.status === 401 || response.status === 403 ? 400 : 502;
    throw err;
  }
  return { status: response.status, data, text };
}
var OV_BOTH_API = "https://bot-hosting.net/api/v1";
function ovBothTokenShape(token) { return /^bhk_[A-Za-z0-9]{20,}$/.test(String(token || "").trim()); }
async function ovBothFetch(token, path, timeoutMs) {
  const key = String(token || "").trim();
  const opt = { method: "GET", redirect: "manual", headers: { authorization: "Bearer " + key, accept: "application/json" }, signal: AbortSignal.timeout(Math.max(3000, Number(timeoutMs) || 12000)) };
  let response;
  try { response = await fetch(OV_BOTH_API + path, opt); }
  catch (_) { ovFail("اتصال به Bot-Hosting برقرار نشد؛ دوباره تلاش کن.", 502); }
  const text = await response.text();
  let data = {}; try { data = JSON.parse(text); } catch (_) {}
  if (!response.ok) {
    const status = response.status;
    const message = status === 401 || status === 403
      ? "کلید Bot-Hosting معتبر نیست یا مجوز لازم را ندارد (deployments:read و برای تشخیص خودکار مسیر، files:read)."
      : String(data.error && (data.error.message || data.error.code) || data.message || "پاسخ نامعتبر از Bot-Hosting").slice(0, 180);
    const error = new Error("Bot-Hosting: " + message);
    error.ovStatus = status === 401 || status === 403 ? 400 : (status === 404 ? 404 : 502);
    throw error;
  }
  return data;
}
function ovAppsHost(deployment) {
  const domains = deployment && deployment.domains || {};
  let raw = String(domains.subdomain || deployment.apps_host || "").trim().toLowerCase();
  if (!raw && domains.url) {
    try { const parsed = new URL(String(domains.url)); if (parsed.hostname.endsWith(".apps.bot-hosting.cloud")) raw = parsed.hostname; } catch (_) {}
  }
  raw = raw.replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/\.$/, "");
  if (raw.endsWith(".apps.bot-hosting.cloud")) return raw;
  if (raw.endsWith(".apps")) return raw + ".bot-hosting.cloud";
  if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(raw)) return raw + ".apps.bot-hosting.cloud";
  return "";
}
function ovPathFromDeployment(deployment) {
  const values = [deployment && deployment.ws_path, deployment && deployment.wsPath,
    deployment && deployment.connection && deployment.connection.path,
    deployment && deployment.connection && deployment.connection.uriTemplate];
  for (const value of values) {
    const text = String(value || "");
    if (/^\/[A-Za-z0-9_/-]{1,99}$/.test(text) && !text.includes("//") && !text.includes("..")) return text;
    const match = text.match(/[?&](?:path|ws_path)=([^&#]+)/i);
    if (match) { try { const path = decodeURIComponent(match[1]); if (/^\/[A-Za-z0-9_/-]{1,99}$/.test(path) && !path.includes("//") && !path.includes("..")) return path; } catch (_) {} }
  }
  return "";
}
async function ovReadRelayPath(token, deployment) {
  const entry = String(deployment.entryFile || deployment.startup && deployment.startup.entryFile || "index.js").replace(/^\/+/, "");
  if (!/^[A-Za-z0-9._/-]{1,120}$/.test(entry) || entry.split("/").includes("..")) return "";
  try {
    const query = "?path=" + encodeURIComponent("/" + entry) + "&offset=0&limit=240";
    const result = await ovBothFetch(token, "/deployments/" + encodeURIComponent(String(deployment.id)) + "/files/content" + query, 7000);
    const content = String(result.content || result.data && result.data.content || result.file && result.file.content || "");
    const match = content.match(/\b(?:const|let|var)\s+SECRET_PATH\s*=\s*(["'])([^"'\r\n]{2,100})\1/);
    if (!match) return "";
    const candidate = match[2];
    return /^\/[A-Za-z0-9_/-]{1,99}$/.test(candidate) && !candidate.includes("//") && !candidate.includes("..") ? candidate : "";
  } catch (_) { return ""; }
}
async function ovBotProjects(token, env, selectedId) {
  const key = String(token || "").trim();
  if (!ovBothTokenShape(key)) ovFail("کلید Bot-Hosting باید با bhk_ شروع شود و حداقل ۲۰ نویسه داشته باشد.");
  const account = await ovBothFetch(key, "/account", 10000).catch(() => ({}));
  const listing = await ovBothFetch(key, "/deployments", 14000);
  const all = Array.isArray(listing.deployments) ? listing.deployments : Array.isArray(listing.data && listing.data.deployments) ? listing.data.deployments : [];
  const limit = selectedId ? 80 : 40;
  const candidates = all.slice(0, limit);
  if (selectedId && !candidates.some((item) => String(typeof item === "string" ? item : item && item.id || "") === selectedId))
    ovFail("این پروژه در حساب Bot-Hosting مربوط به همین کلید پیدا نشد.", 400);
  const results = [], skipped = [];
  for (const item of candidates) {
    let deployment = item;
    const id = String(typeof item === "string" ? item : item && item.id || "").trim();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) continue;
    if (selectedId && id !== selectedId) continue;
    if (typeof item === "string" || !item.domains) {
      const detail = await ovBothFetch(key, "/deployments/" + encodeURIComponent(id), 10000);
      deployment = detail.deployment || detail;
    }
    if (!deployment || String(deployment.id || id) !== id) continue;
    const state = String(deployment.state || deployment.status || "").toLowerCase();
    if (!new Set(["running", "active", "ready", "online"]).has(state)) continue;
    const host = ovAppsHost(deployment);
    if (!host) { skipped.push({ id, reason: "no_public_apps_host" }); continue; }
    let path = ovPathFromDeployment(deployment);
    if (!path) {
      const cached = await env.DB.prepare("SELECT ws_path FROM managed_bothost_jobs WHERE deployment_id=? AND status='ready'").bind(id).first().catch(() => null);
      const cachedPath = String(cached && cached.ws_path || "");
      if (/^\/[A-Za-z0-9_/-]{1,99}$/.test(cachedPath) && !cachedPath.includes("//") && !cachedPath.includes("..")) path = cachedPath;
    }
    if (!path) path = await ovReadRelayPath(key, deployment);
    if (!path) { skipped.push({ id, reason: "private_ws_path_not_found" }); continue; }
    results.push({
      id, name: String(deployment.name || id).slice(0, 100), state,
      owned: deployment.owned !== false, apps_host: host, path,
      runtime: String(deployment.runtime || deployment.startup && deployment.startup.runtime || ""),
      entry_file: String(deployment.entryFile || deployment.startup && deployment.startup.entryFile || "")
    });
  }
  if (selectedId && !results.length) ovFail("این پروژه پیدا شد، اما رلهٔ WebSocket آماده با مسیر خصوصی معتبر تشخیص داده نشد. کلید باید مجوز files:read داشته باشد یا پروژه با رلهٔ Omni ساخته شده باشد.", 400);
  const profile = account.account || account;
  return {
    account: { username: String(profile.username || profile.name || "").slice(0, 100), plan: String(profile.plan && (profile.plan.name || profile.plan.tier) || "").slice(0, 40) },
    deployments: results, scanned: candidates.length, skipped: skipped.length, truncated: all.length > limit
  };
}

function ovB64(text) {
  const bytes = new TextEncoder().encode(String(text || ""));
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function ovFiles() {
  const pkg = JSON.stringify({ name: "omni-vless-ws-bridge", private: true, dependencies: { ws: "^8.18.0" } }, null, 2);
  const config = JSON.stringify({
    version: 2,
    functions: { "api/index.js": { memory: 1024, maxDuration: 300 } },
    rewrites: [
      { source: "/_omni-health", destination: "/api/index?health=1" },
      { source: "/ws/vl/:uuid", destination: "/api/index?ws=1&uuid=:uuid" },
      { source: "/:path*", destination: "/api/index" }
    ],
    trailingSlash: false,
    outputDirectory: "public"
  }, null, 2);
  const landing = "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Omni WebSocket Relay</title><body style=\"font:16px system-ui;background:#090b12;color:#eef2fa;padding:3rem\"><h1>Omni VLESS WebSocket Relay</h1><p>Relay is ready. Client connections use WSS on /ws/vl/{uuid}.</p></body></html>";
  return [
    { file: "api/index.js", data: ovB64(OV_VERCEL_RELAY_SOURCE), encoding: "base64" },
    { file: "package.json", data: ovB64(pkg), encoding: "base64" },
    { file: "vercel.json", data: ovB64(config), encoding: "base64" },
    { file: "public/index.html", data: ovB64(landing), encoding: "base64" }
  ];
}
async function ovVerifyTokenInfo(token) {
  const value = String(token || "").trim();
  if (value.length < 20 || value.length > 4096) ovFail("توکن Vercel معتبر وارد کن.");
  const result = await ovFetch(value, "/v2/user", "GET", undefined, 15000);
  const user = result.data.user || result.data;
  if (!user || !user.id) ovFail("Vercel نتوانست حساب این توکن را تأیید کند.", 400);
  return { token: value, user: { username: String(user.username || user.name || "").slice(0, 100) } };
}
async function ovVerifyToken(token) {
  return (await ovVerifyTokenInfo(token)).token;
}
async function ovDeleteProject(token, name) {
  if (!token || !name) return;
  await ovFetch(token, "/v9/projects/" + encodeURIComponent(name), "DELETE", undefined, 12000, true);
}
async function ovDeploy(token, target) {
  await ovVerifyToken(token);
  const projectName = "omni-ws-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  let created = false;
  try {
    const response = await ovFetch(token, "/v13/deployments", "POST", {
      name: projectName, files: ovFiles(), target: "production",
      projectSettings: { framework: null, outputDirectory: "public" },
      env: { TARGET_DOMAIN: "https://" + target.host, TARGET_PATH: target.path, PUBLIC_RELAY_PATH: OV_PUBLIC_PATH }
    }, 20000);
    created = true;
    let data = response.data || {};
    const deployId = String(data.id || "").trim();
    if (!deployId) ovFail("Vercel دیپلوی را ساخت اما شناسه‌ای برنگرداند.", 502);
    let state = String(data.readyState || data.status || "QUEUED").toUpperCase();
    let detail = String(data.errorMessage || data.errorCode || "");
    const terminal = new Set(["ERROR", "CANCELED", "CANCELLED", "DELETED"]);
    for (let i = 0; state !== "READY" && i < 14; i++) {
      if (terminal.has(state)) ovFail("ساخت Vercel ناموفق شد: " + (detail || state), 502);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const status = await ovFetch(token, "/v13/deployments/" + encodeURIComponent(deployId), "GET", undefined, 15000);
      data = status.data || {};
      state = String(data.readyState || data.status || state).toUpperCase();
      detail = String(data.errorMessage || data.errorCode || detail);
    }
    if (state !== "READY") ovFail("Vercel دیپلوی را در زمان مجاز READY نکرد (" + state + ").", 502);
    await ovFetch(token, "/v9/projects/" + encodeURIComponent(projectName), "PATCH", { ssoProtection: null }, 15000);
    const domainResponse = await ovFetch(token, "/v9/projects/" + encodeURIComponent(projectName) + "/domains?production=true&limit=100", "GET", undefined, 15000);
    const entries = Array.isArray(domainResponse.data.domains) ? domainResponse.data.domains : [];
    const candidates = entries.filter((item) => item && item.verified !== false && !item.redirect)
      .map((item) => String(item.name || "").trim().toLowerCase().replace(/\.$/, ""))
      .filter((name) => /^(?:[a-z0-9-]+\.)+vercel\.app$/.test(name));
    let domain = candidates.includes(projectName + ".vercel.app") ? projectName + ".vercel.app" : (candidates[0] || "");
    if (!domain) {
      const aliases = Array.isArray(data.alias) ? data.alias : (data.alias ? [data.alias] : []);
      domain = aliases.map((item) => String(item).trim().toLowerCase()).find((name) => /^(?:[a-z0-9-]+\.)+vercel\.app$/.test(name)) || "";
    }
    if (!domain) ovFail("Vercel آماده شد اما دامنهٔ production ‏.vercel.app برنگشت.", 502);
    let healthy = false, last = "پاسخی نرسید";
    for (let i = 0; i < 5; i++) {
      try {
        const probe = await fetch("https://" + domain + "/_omni-health", {
          redirect: "manual", headers: { "cache-control": "no-cache, no-store" }, signal: AbortSignal.timeout(9000)
        });
        const text = await probe.text();
        healthy = probe.status === 200 && probe.headers.get("x-omni-relay") === "healthy" && text.includes("Omni Vercel WebSocket relay is online");
        last = "HTTP " + probe.status + (text ? ": " + text.slice(0, 100) : "");
        if (healthy) break;
      } catch (error) { last = String(error && error.message || error).slice(0, 120); }
      if (i < 4) await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    if (!healthy) ovFail("دامنه ساخته شد اما تست upstream WebSocket موفق نشد: " + last, 502);
    return {
      project_name: projectName,
      project_id: String(data.projectId || (data.project && data.project.id) || response.data.projectId || ""),
      deploy_id: deployId, domain, url: "https://" + domain, target_host: target.host,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    if (created) await ovDeleteProject(token, projectName).catch(() => {});
    throw error;
  }
}
async function ovPing(domain) {
  const value = String(domain || "").trim().toLowerCase();
  if (!/^(?:[a-z0-9-]+\.)+vercel\.app$/.test(value)) ovFail("دامنهٔ Vercel معتبر نیست.");
  const started = Date.now();
  try {
    const response = await fetch("https://" + value + "/_omni-health", {
      redirect: "manual", headers: { "cache-control": "no-cache, no-store" }, signal: AbortSignal.timeout(12000)
    });
    const text = await response.text();
    const latency = Date.now() - started;
    const ok = response.status === 200 && response.headers.get("x-omni-relay") === "healthy" && text.includes("Omni Vercel WebSocket relay is online");
    return { ok, domain: value, status: response.status, latency_ms: latency, message: text.slice(0, 180) };
  } catch (error) {
    return { ok: false, domain: value, status: 0, latency_ms: Date.now() - started, message: String(error && error.message || error).slice(0, 180) };
  }
}
async function ovConfigs(env, row) {
  const users = await env.DB.prepare("SELECT username,uuid FROM users WHERE uuid IS NOT NULL AND TRIM(uuid)<>'' AND is_active=1 ORDER BY id LIMIT 60").all().catch(() => ({ results: [] }));
  const domain = String(row.domain || "").trim().toLowerCase();
  if (!/^(?:[a-z0-9-]+\.)+vercel\.app$/.test(domain)) ovFail("دامنهٔ Vercel ثبت‌شده معتبر نیست.", 500);
  const output = (users.results || []).map((user) => {
    const uuid = String(user.uuid || "").toLowerCase();
    const path = OV_PUBLIC_PATH + "/" + uuid;
    const tag = "omni | Vercel WS | " + String(user.username || "user");
    const uri = "vless://" + uuid + "@" + domain + ":443?encryption=none&security=tls&type=ws"
      + "&host=" + encodeURIComponent(domain) + "&path=" + encodeURIComponent(path)
      + "&sni=" + encodeURIComponent(domain) + "&fp=chrome&alpn=http%2F1.1#" + encodeURIComponent(tag);
    return { username: String(user.username || ""), uuid, lines: [{ k: tag, uri }] };
  });
  return { ok: true, relay_id: row.id, domain, target_lines: 1, users: output };
}
async function omniVercelApi(request, env, ctx, url, account, settings) {
  try {
    await ovSchema(env);
    if (String(account && account.role || "") !== "admin") return ovJson({ ok: false, error: "دسترسی مدیر لازم است." }, 403);
    const method = request.method;
    if (method !== "GET") {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin) return ovJson({ ok: false }, 403);
      if (!(request.headers.get("content-type") || "").includes("application/json")) return ovJson({ ok: false }, 415);
    }
    const path = url.pathname;
    const body = method === "GET" ? {} : await request.json().catch(() => ({}));
    if (path === "/api/vercel-relays/discover" && method === "POST") {
      const vercel = await ovVerifyTokenInfo(body.vercel_token);
      const discovery = await ovBotProjects(body.bhk_token, env);
      return ovJson({ ok: true, vercel_account: vercel.user, ...discovery });
    }
    if (path === "/api/vercel-relays" && method === "GET") {
      const result = await env.DB.prepare("SELECT * FROM vercel_relays ORDER BY created_at DESC LIMIT 30").all();
      return ovJson({ ok: true, relays: (result.results || []).map(ovPublic) });
    }
    if (path === "/api/vercel-relays" && method === "POST") {
      const token = String(body.vercel_token || "").trim();
      const bhkToken = String(body.bhk_token || "").trim();
      const sourceDeploymentId = String(body.source_deployment_id || "").trim();
      let source, sourceId, sourceName, target;
      if (sourceDeploymentId || bhkToken) {
        if (!sourceDeploymentId || !ovBothTokenShape(bhkToken)) return ovJson({ ok: false, error: "کلید Bot-Hosting را بررسی کن و یکی از پروژه‌های پیدا‌شده را انتخاب کن." }, 400);
        const discovery = await ovBotProjects(bhkToken, env, sourceDeploymentId);
        source = discovery.deployments.find((item) => item.id === sourceDeploymentId);
        if (!source) return ovJson({ ok: false, error: "پروژه با این کلید Bot-Hosting پیدا نشد یا رلهٔ آمادهٔ معتبر نیست." }, 400);
        sourceId = source.id;
        sourceName = source.name || source.apps_host;
        target = ovSafeTarget({ apps_host: source.apps_host, ws_path: source.path });
      } else {
        // Backward compatibility for an already-open older panel tab only.
        const sourceJobId = String(body.source_job_id || "").trim();
        if (!/^[a-f0-9-]{36}$/i.test(sourceJobId)) return ovJson({ ok: false, error: "کلید Bot-Hosting را وارد و پروژهٔ خودتان را پیدا کن." }, 400);
        source = await env.DB.prepare("SELECT * FROM managed_bothost_jobs WHERE id=?").bind(sourceJobId).first().catch(() => null);
        if (!source || source.status !== "ready") return ovJson({ ok: false, error: "پروژهٔ مبدأ آماده پیدا نشد؛ پنل را تازه‌سازی و کلید Bot-Hosting خودت را بررسی کن." }, 400);
        sourceId = source.id;
        sourceName = source.domain || source.apps_host;
        target = ovSafeTarget(source);
      }
      const label = String(body.label || sourceName || "Vercel relay").trim().slice(0, 80) || String(sourceName || "Vercel relay");
      const deployed = await ovDeploy(token, target);
      const id = crypto.randomUUID();
      const createdAt = deployed.created_at;
      try {
        await env.DB.prepare(`INSERT INTO vercel_relays(id,label,source_job_id,source_domain,target_host,target_path,project_name,project_id,deploy_id,domain,url,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
          id, label, sourceId, String(sourceName || ""), target.host, target.path,
          deployed.project_name, deployed.project_id, deployed.deploy_id, deployed.domain,
          deployed.url, createdAt, Date.now()
        ).run();
      } catch (error) {
        await ovDeleteProject(token, deployed.project_name).catch(() => {});
        throw error;
      }
      const saved = await env.DB.prepare("SELECT * FROM vercel_relays WHERE id=?").bind(id).first();
      return ovJson({ ok: true, relay: ovPublic(saved), result: deployed }, 201);
    }
    const match = path.match(/^\/api\/vercel-relays\/([a-f0-9-]{36})\/(ping|configs|delete)$/i);
    if (match) {
      const relay = await env.DB.prepare("SELECT * FROM vercel_relays WHERE id=?").bind(match[1]).first();
      if (!relay) return ovJson({ ok: false, error: "رلهٔ Vercel پیدا نشد." }, 404);
      if (match[2] === "ping" && method === "GET") {
        const result = await ovPing(relay.domain);
        return ovJson(result, result.ok ? 200 : 502);
      }
      if (match[2] === "configs" && method === "GET") return ovJson(await ovConfigs(env, relay));
      if (match[2] === "delete" && method === "POST") {
        const token = await ovVerifyToken(body.vercel_token);
        await ovDeleteProject(token, relay.project_name);
        await env.DB.prepare("DELETE FROM vercel_relays WHERE id=?").bind(relay.id).run();
        return ovJson({ ok: true, deleted: true, id: relay.id });
      }
    }
    return ovJson({ ok: false, error: "مسیر شناخته نشد." }, 404);
  } catch (error) {
    return ovJson({ ok: false, error: String(error && error.message || error).slice(0, 260) }, Number(error && error.ovStatus) || 500);
  }
}
