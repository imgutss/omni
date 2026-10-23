// Local smoke test: exercise the mb module against a mock Workers runtime.
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const builtPath = path.join(here, "../build/worker.js");
const workerPath = fs.existsSync(builtPath) ? builtPath : path.join(here, "../live/worker.js");
const worker = fs.readFileSync(workerPath, "utf8");
const panelPath = path.join(here, "../build/panel.html");
const panelHtml = fs.existsSync(panelPath) ? fs.readFileSync(panelPath, "utf8") : "";
const start = worker.lastIndexOf("/* =========================================================================\n * OMNI · Managed Bot-Hosting");
const end = worker.indexOf("export {", start);
if (start < 0 || end < 0) throw new Error("module markers not found");
const modSrc = worker.slice(start, end);

// ---- in-memory D1 ----
class MemD1 {
  constructor() {
    this.tables = {
      bot_bridges: { rows: [], cols: ["id"] },
      // Simulate an existing pre-Vercel D1 schema so guarded migrations are exercised.
      managed_bothost_jobs: { rows: [], cols: ["id", "label", "zone", "domain", "bhk_token", "bhk_expires", "arvan_token", "arvan_expires", "deployment_id", "node_host", "node_port", "apps_host", "edge_ip", "verify_token", "dns_created", "worker_host", "ws_path", "status", "last_error", "lock_until", "bridge_id", "created_at", "updated_at"] },
      vercel_relays: { rows: [], cols: ["id"] }
    };
    this._id = 0;
  }
  prepare(sql) {
    const trimmed = sql.trim().replace(/\s+/g, " ");
    const bound = (...args) => ({
        run: async () => {
          if (/^CREATE TABLE IF NOT EXISTS managed_bothost_jobs/i.test(trimmed)) {
            this.tables.managed_bothost_jobs ??= { rows: [], cols: ["id"] };
            return { meta: { changes: 1, last_row_id: 0 } };
          }
          if (/^CREATE TABLE IF NOT EXISTS bot_bridges/i.test(trimmed)) {
            this.tables.bot_bridges ??= { rows: [], cols: ["id"] };
            return { meta: { changes: 1 } };
          }
          if (/^CREATE TABLE IF NOT EXISTS vercel_relays/i.test(trimmed)) {
            this.tables.vercel_relays ??= { rows: [], cols: ["id"] };
            return { meta: { changes: 1 } };
          }
          if (/^PRAGMA table_info/i.test(trimmed)) {
            const t = trimmed.includes("bot_bridges") ? "bot_bridges" : "x";
            const cols = (this.tables[t]?.cols || []).map((name) => ({ name }));
            return { results: cols };
          }
          if (/^ALTER TABLE managed_bothost_jobs ADD COLUMN (\w+)/i.test(trimmed)) {
            const col = trimmed.match(/ADD COLUMN (\w+)/i)[1];
            const t = this.tables.managed_bothost_jobs;
            if (t && !t.cols.includes(col)) { t.cols.push(col); t.rows.forEach((r) => (r[col] = null)); }
            return { meta: { changes: 1 } };
          }
          if (/^ALTER TABLE bot_bridges ADD COLUMN (\w+)/i.test(trimmed)) {
            const col = trimmed.match(/ADD COLUMN (\w+)/i)[1];
            const t = this.tables.bot_bridges;
            if (t && !t.cols.includes(col)) { t.cols.push(col); t.rows.forEach((r) => (r[col] = null)); }
            return { meta: { changes: 1 } };
          }
          if (/^INSERT INTO managed_bothost_jobs/i.test(trimmed)) {
            const cols = trimmed.match(/\(([^)]+)\)\s*VALUES/)[1].split(",").map((s) => s.trim());
            const row = Object.fromEntries(cols.map((c, i) => [c, args[i]]));
            this.tables.managed_bothost_jobs.rows.push(row);
            return { meta: { changes: 1, last_row_id: ++this._id } };
          }
          if (/^INSERT INTO vercel_relays/i.test(trimmed)) {
            const cols = trimmed.match(/INSERT INTO vercel_relays\(([^)]+)\)/)[1].split(",").map((x) => x.trim());
            const row = Object.fromEntries(cols.map((c, i) => [c, args[i]]));
            this.tables.vercel_relays.cols = Array.from(new Set([...this.tables.vercel_relays.cols, ...cols]));
            this.tables.vercel_relays.rows.push(row);
            return { meta: { changes: 1 } };
          }
          if (/^INSERT INTO bot_bridges/i.test(trimmed)) {
            const cols = trimmed.match(/INSERT INTO bot_bridges\(([^)]+)\)/)[1].split(",").map((s) => s.trim());
            const row = Object.fromEntries(cols.map((c, i) => [c, args[i]]));
            row.id = ++this._id;
            this.tables.bot_bridges.cols = Array.from(new Set([...this.tables.bot_bridges.cols, ...cols]));
            this.tables.bot_bridges.rows.push(row);
            return { meta: { changes: 1, last_row_id: row.id } };
          }
          if (/^UPDATE managed_bothost_jobs SET lock_until=\? WHERE id=\? AND lock_until</.test(trimmed)) {
            const row = this.tables.managed_bothost_jobs.rows.find((r) => r.id === args[1]);
            return { meta: { changes: row ? 1 : 0 } };
          }
          if (/^UPDATE managed_bothost_jobs SET lock_until=0 WHERE id=\?/i.test(trimmed)) {
            const row = this.tables.managed_bothost_jobs.rows.find((r) => r.id === args[0]);
            if (row) row.lock_until = 0;
            return { meta: { changes: row ? 1 : 0 } };
          }
          if (/^UPDATE managed_bothost_jobs SET (.+) WHERE id=\?/i.test(trimmed)) {
            const setPart = trimmed.match(/^UPDATE managed_bothost_jobs SET (.+),updated_at=\? WHERE id=\?$/i)[1];
            const keys = setPart.split(",").map((s) => s.trim().replace(/=.*$/, ""));
            const id = args[args.length - 1];
            const row = this.tables.managed_bothost_jobs.rows.find((r) => r.id === id);
            if (row) keys.forEach((k, i) => (row[k] = args[i]));
            return { meta: { changes: row ? 1 : 0 } };
          }
          if (/^UPDATE bot_bridges SET/i.test(trimmed)) {
            const id = args[args.length - 1];
            const row = this.tables.bot_bridges.rows.find((r) => r.id === id);
            return { meta: { changes: row ? 1 : 0 } };
          }
          if (/^DELETE FROM vercel_relays WHERE id=\?/i.test(trimmed)) {
            this.tables.vercel_relays.rows = this.tables.vercel_relays.rows.filter((r) => r.id !== args[0]);
            return { meta: { changes: 1 } };
          }
          if (/^DELETE FROM managed_bothost_jobs WHERE id=\?/i.test(trimmed)) {
            this.tables.managed_bothost_jobs.rows = this.tables.managed_bothost_jobs.rows.filter((r) => r.id !== args[0]);
            return { meta: { changes: 1 } };
          }
          if (/^DELETE FROM bot_bridges WHERE id=\?/i.test(trimmed)) {
            this.tables.bot_bridges.rows = this.tables.bot_bridges.rows.filter((r) => r.id !== args[0]);
            return { meta: { changes: 1 } };
          }
          throw new Error("unhandled run SQL: " + trimmed.slice(0, 120));
        },
        all: async () => {
          if (/^SELECT \* FROM managed_bothost_jobs ORDER BY/i.test(trimmed)) return { results: [...this.tables.managed_bothost_jobs.rows] };
          if (/^SELECT \* FROM vercel_relays ORDER BY/i.test(trimmed)) return { results: [...this.tables.vercel_relays.rows] };
          if (/^SELECT username,uuid FROM users/i.test(trimmed)) return { results: [{ username: "demo", uuid: "5fadafe5-1111-2222-3333-444444444444" }] };
          if (/^PRAGMA table_info\(managed_bothost_jobs\)/i.test(trimmed)) {
            return { results: (this.tables.managed_bothost_jobs?.cols || []).map((name) => ({ name })) };
          }
          if (/^PRAGMA/i.test(trimmed)) {
            const cols = (this.tables.bot_bridges?.cols || []).map((name) => ({ name }));
            return { results: cols };
          }
          throw new Error("unhandled all SQL: " + trimmed.slice(0, 120));
        },
        first: async () => {
          if (/^SELECT ws_path FROM managed_bothost_jobs WHERE deployment_id=\? AND status='ready'/i.test(trimmed)) {
            const row = this.tables.managed_bothost_jobs.rows.find((r) => r.deployment_id === args[0] && r.status === "ready");
            return row ? { ws_path: row.ws_path } : null;
          }
          if (/^SELECT \* FROM managed_bothost_jobs WHERE id=\?/i.test(trimmed))
            return this.tables.managed_bothost_jobs.rows.find((r) => r.id === args[0]) || null;
          if (/^SELECT \* FROM vercel_relays WHERE id=\?/i.test(trimmed))
            return this.tables.vercel_relays.rows.find((r) => r.id === args[0]) || null;
          if (/^SELECT \* FROM managed_bothost_jobs WHERE domain=\?/i.test(trimmed))
            return this.tables.managed_bothost_jobs.rows.find((r) => r.domain === args[0]) || null;
          if (/^SELECT id FROM bot_bridges WHERE/i.test(trimmed))
            return this.tables.bot_bridges.rows.find((r) => r.domain === args[0] || r.deployment_id === args[1]) || null;
          throw new Error("unhandled first SQL: " + trimmed.slice(0, 120));
        }
      });
    const stmt = bound();
    stmt.bind = bound;
    return stmt;
  }
}

// ---- mock fetch ----
const calls = [];
const vercelCalls = [];
let lastVercelDeploy = null;
const arvanCreated = [];
function mockFetch(u, opt = {}) {
  calls.push({ url: String(u), method: opt.method || "GET" });
  const U = String(u);
  if (U.startsWith("https://api.vercel.com")) {
    const vu = new URL(U);
    const method = opt.method || "GET";
    vercelCalls.push({ url: U, method });
    if (vu.pathname === "/v2/user" && method === "GET") {
      if (opt.headers?.authorization === "Bearer mock-invalid-token-abcdefghijklmnopqrstuvwxyz") return j(401, { error: { message: "invalid token" } });
      return j(200, { user: { id: "usr-smoke", username: "smoke" } });
    }
    if (vu.pathname === "/v13/deployments" && method === "POST") {
      lastVercelDeploy = JSON.parse(opt.body);
      if (opt.headers?.authorization === "Bearer mock-build-failure-token-abcdefghijklmnopqrstuvwxyz")
        return j(201, { id: "dpl-fail", readyState: "ERROR", projectId: "prj-fail", errorMessage: "synthetic build failure" });
      return j(201, { id: "dpl-smoke", readyState: "READY", projectId: "prj-smoke", alias: [lastVercelDeploy.name + ".vercel.app"] });
    }
    if (vu.pathname === "/v13/deployments/dpl-smoke" && method === "GET") return j(200, { id: "dpl-smoke", readyState: "READY", projectId: "prj-smoke" });
    if (/^\/v9\/projects\/[^/]+$/.test(vu.pathname) && method === "PATCH") return j(200, { ok: true });
    if (/^\/v9\/projects\/[^/]+\/domains$/.test(vu.pathname) && method === "GET") {
      const projectName = vu.pathname.split("/")[3];
      return j(200, { domains: [{ name: projectName + ".vercel.app", verified: true }] });
    }
    if (/^\/v9\/projects\/[^/]+$/.test(vu.pathname) && method === "DELETE") return j(200, { deleted: true });
    return j(200, {});
  }
  if (/^https:\/\/omni-ws-[a-z0-9-]+\.vercel\.app\/_omni-health/.test(U))
    return new Response("Omni Vercel WebSocket relay is online", { status: 200, headers: { "x-omni-relay": "healthy" } });
  if (U.startsWith("https://bot-hosting.net")) {
    if (U.endsWith("/account")) {
      if (opt.headers?.authorization === "Bearer bhk_" + "z".repeat(24)) return j(401, { error: { message: "invalid key" } });
      return j(200, { username: "guts", plan: { name: "free" }, quota: { used: 1, max: 1 } });
    }
    if (U.endsWith("/deployments") && (opt.method || "GET") === "GET") {
      if (opt.headers?.authorization === "Bearer bhk_" + "z".repeat(24)) return j(401, { error: { message: "invalid key" } });
      return j(200, { deployments: [
        { id: "145e65f5-2b1b-4b83-926a-cbb805056577", name: "omni-bridge-sp8hb", state: "running", node: { fqdn: "fi15.bot-hosting.net" }, port: 26388, domains: { subdomain: "qtbidau3ht", custom: "relay.drsarli.ir", url: "https://relay.drsarli.ir" } },
        { id: "dep-self-owned-01", name: "my-own-relay", state: "running", runtime: "nodejs", entryFile: "index.js", domains: { subdomain: "my-own-relay.apps" } }
      ] });
    }
    if (U.includes("/files/content?")) return j(200, { path: "/index.js", content: 'const SECRET_PATH = "/AutoPath2026";\\n// Omni managed bot-hosting relay' });
    if (/\/deployments\/[A-Za-z0-9_-]+$/.test(U) && (opt.method || "GET") === "GET")
      return j(200, { id: "145e65f5-2b1b-4b83-926a-cbb805056577", state: "running", node: { fqdn: "fi15.bot-hosting.net" }, port: 26388, domains: { subdomain: "qtbidau3ht", custom: "relay.drsarli.ir", url: "https://relay.drsarli.ir" } });
    if (U.includes("/files/writeMany")) return j(200, { ok: true });
    if (U.includes("/apply")) return j(200, { ok: true });
    if (U.includes("/power")) return j(200, { ok: true });
    if (U.includes("/domains/custom/verify")) return j(200, { verified: true });
    if (U.includes("/domains/custom")) return j(200, { token: "txttoken123" });
    if (U.includes("/domains/slug") || U.includes("/domains")) return j(200, { ok: true });
    return j(200, {});
  }
  if (U.startsWith("https://napi.arvancloud.ir")) {
    if (U.endsWith("/dns-records") && (opt.method || "GET") === "GET")
      return j(200, { data: arvanCreated.map((r) => ({ ...r })) });
    if (U.includes("/dns-records") && (opt.method || "POST") === "POST") {
      const body = JSON.parse(opt.body);
      if (!Array.isArray(body.value)) return j(422, { message: "The provided data is invalid.", errors: { value: ["The value must be an array."] } });
      const rec = { id: "arv-" + (arvanCreated.length + 1), type: body.type, name: body.name, value: body.value };
      arvanCreated.push(rec);
      return j(201, { data: rec, message: "DNS record created successfully." });
    }
    if (U.includes("/dns-records/") && opt.method === "PUT") {
      const id = U.split("/dns-records/")[1];
      const rec = arvanCreated.find((r) => r.id === id);
      Object.assign(rec, JSON.parse(opt.body));
      return j(200, { data: rec });
    }
    if (U.includes("/dns-records/") && opt.method === "DELETE") return j(200, { data: [], message: "DNS record deleted." });
    if (U.includes("/domains?per_page")) return j(200, { data: [{ domain: "drsarli.ir", name: "drsarli.ir", status: "active" }] });
    return j(200, { data: [] });
  }
  if (U.startsWith("https://cloudflare-dns.com")) return j(200, { Answer: [{ data: "178.105.112.237" }] });
  if (U.startsWith("https://relay.drsarli.ir") || U.startsWith("https://qtbidau3ht.apps")) return new Response("", { status: 200 });
  throw new Error("unmocked url " + U);
}
function j(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

const sandbox = {
  fetch: async (u, o) => mockFetch(u, o),
  Response: { json: (x, init) => ({ status: init?.status || 200, body: x, headers: init?.headers }) },
  AbortSignal: { timeout: () => ({}) },
  TextEncoder,
  btoa: globalThis.btoa,
  setTimeout, clearTimeout,
  crypto: { randomUUID: () => "11111111-2222-3333-4444-" + String(arvanCreated.length).padStart(12, "0") },
  console,
};
vm.createContext(sandbox);
vm.runInContext(modSrc, sandbox);

const DB = new MemD1();
const env = { DB, PUBLIC_HOST: "omni.4lifm29.workers.dev" };
const settings = { path: "/JOGpAVgq", public_host: "omni-rescue.4lifm29.workers.dev" };
const account = { role: "admin", username: "admin" };
const url = new URL("https://omni.4lifm29.workers.dev/api/managed-bothost/jobs");
const req = (method, p, body) => new Request("https://omni.4lifm29.workers.dev" + p, {
  method,
  headers: { "content-type": "application/json", origin: "https://omni.4lifm29.workers.dev" },
  body: body ? JSON.stringify(body) : undefined
});
const call = (method, p, body) =>
  sandbox.omniMbApi(req(method, p, body), env, {}, new URL("https://omni.4lifm29.workers.dev" + p), account, settings);
const callVercel = (method, p, body) =>
  sandbox.omniVercelApi(req(method, p, body), env, {}, new URL("https://omni.4lifm29.workers.dev" + p), account, settings);

let pass = 0;
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); pass++; console.log("  ✓ " + m); };
ok(worker.includes('p2 === "/api/vercel-relays"') && worker.includes('return omniVercelApi('), "main router dispatches to a separate Vercel API");
ok(panelHtml.includes("ov-bhk-token") && panelHtml.includes("ov-source") && panelHtml.includes("پروژه‌های همان حساب پیدا می‌شوند") && !panelHtml.includes("رلهٔ آمادهٔ بخش ۵ فقط upstream"), "Vercel UI discovers the user's own Bot-Hosting projects without depending on section 5");
const upgradeStart = worker.indexOf('async function upgradeOwnedPanel(');
const upgradeEndMarker = '__name(upgradeOwnedPanel, "upgradeOwnedPanel");';
const upgradeEnd = worker.indexOf(upgradeEndMarker, upgradeStart);
if (upgradeStart < 0 || upgradeEnd < 0) throw new Error("panel upgrade function markers not found");
const upgradeCode = worker.slice(upgradeStart, upgradeEnd + upgradeEndMarker.length);
ok(upgradeCode.includes('method: "PUT"') && !/method:\s*["']DELETE["']/.test(upgradeCode), "panel upgrade uses the existing Worker PUT path and never deletes it");
ok(upgradeCode.includes('keep_bindings: ["secret_text", "secret_key"]'), "in-place panel upgrade preserves existing secret bindings");
ok(upgradeCode.includes('panel.last_check_detail') && upgradeCode.includes('updateReceipt'), "confirmed uploads are not repeated when workers.dev health probes are unavailable");
ok(worker.includes('updateResult = await upgradeOwnedPanel(env2, p2, undefined, tok)') && worker.includes('پنل جدیدی ساخته نشد'), "Telegram update button upgrades the selected panel in place");
const bindingsStart = worker.indexOf('function panelCfBindings(list) {');
const bindingsEndMarker = '__name(panelCfBindings, "panelCfBindings");';
const bindingsEnd = worker.indexOf(bindingsEndMarker, bindingsStart);
if (bindingsStart < 0 || bindingsEnd < 0) throw new Error("panel bindings function markers not found");
const bindingsSandbox = { __name: (fn) => fn };
vm.createContext(bindingsSandbox);
vm.runInContext(worker.slice(bindingsStart, bindingsEnd + bindingsEndMarker.length) + '\nglobalThis.__panelCfBindings = panelCfBindings;', bindingsSandbox);
const mappedBindings = bindingsSandbox.__panelCfBindings([
  { type: "d1", name: "DB", database_id: "db-preserved" },
  { type: "secret_text", name: "BOT_TOKEN" },
  { type: "kv_namespace", name: "CACHE", namespace_id: "kv-preserved" },
  { type: "service", name: "UPSTREAM", service: "upstream-worker" }
]);
ok(mappedBindings.some((b) => b.name === "DB" && b.id === "db-preserved") && mappedBindings.some((b) => b.name === "UPSTREAM" && b.service === "upstream-worker") && !mappedBindings.some((b) => b.name === "BOT_TOKEN"), "binding mapper preserves D1 and other resources without serializing secrets");
const markedFunction = (startMarker, endMarker) => {
  const s = worker.indexOf(startMarker);
  const e = worker.indexOf(endMarker, s);
  if (s < 0 || e < 0) throw new Error("missing function " + startMarker);
  return worker.slice(s, e + endMarker.length);
};
const panelUpdateCalls = [];
let panelUpdateMetadata = null;
const updateSandbox = {
  __name: (fn) => fn,
  URL, FormData, Blob,
  OMNI_BUILD: { v: "53.6", rev: 79, md5: "smoke-md5" },
  panel_default: "panel-html-smoke",
  workerBundleHasPanel: (bundle, expected) => bundle === "bundle-smoke" && expected === "panel-html-smoke",
  getReleaseBundle: async () => "bundle-smoke",
  updatePanelState: async (envArg, id, patch) => { envArg.__updatePatch = patch; },
  fetch: async (u, opt = {}) => {
    const uri = String(u);
    const method = opt.method || "GET";
    panelUpdateCalls.push({ uri, method });
    if (uri.startsWith("https://child.example/")) throw new Error("synthetic workers.dev probe failure");
    if (method === "GET" && uri.endsWith("/settings")) return {
      ok: true, status: 200,
      json: async () => ({ success: true, result: {
        compatibility_date: "2024-09-23", compatibility_flags: ["nodejs_compat"], usage_model: "standard",
        bindings: [
          { type: "d1", name: "DB", database_id: "db-existing" },
          { type: "secret_text", name: "BOT_TOKEN" },
          { type: "service", name: "UPSTREAM", service: "existing-upstream" }
        ]
      } })
    };
    if (method === "PUT") {
      panelUpdateMetadata = JSON.parse(await opt.body.get("metadata").text());
      const uploadedBundle = await opt.body.get("worker.js").text();
      if (uploadedBundle !== "bundle-smoke") throw new Error("wrong release bundle uploaded");
      return { ok: true, status: 200, json: async () => ({ success: true, result: { deployment_id: "dep-smoke" } }) };
    }
    throw new Error("unexpected panel-update request: " + method + " " + uri);
  }
};
vm.createContext(updateSandbox);
const updateSupport = [
  markedFunction('async function panelBuildInfo(panelUrl) {', '__name(panelBuildInfo, "panelBuildInfo");'),
  markedFunction('function panelCfBindings(list) {', '__name(panelCfBindings, "panelCfBindings");'),
  markedFunction('function panelNeedsUpgrade(info) {', '__name(panelNeedsUpgrade, "panelNeedsUpgrade");'),
  markedFunction('async function upgradeOwnedPanel(', '__name(upgradeOwnedPanel, "upgradeOwnedPanel");')
].join("\n");
vm.runInContext(updateSupport + '\nglobalThis.__upgradeOwnedPanel = upgradeOwnedPanel;', updateSandbox);
const updateEnv = { __updatePatch: null };
const updatePanel = { id: 7, owner_chat_id: "123", account_id: "acct-existing", worker_name: "selected-child", panel_url: "https://child.example", last_check_detail: "" };
const updateResult = await updateSandbox.__upgradeOwnedPanel(updateEnv, updatePanel, undefined, "test-cf-token");
ok(updateResult.ok && updateResult.reason === "upgraded" && panelUpdateCalls.some((c) => c.method === "PUT" && c.uri.endsWith("/workers/scripts/selected-child")) && !panelUpdateCalls.some((c) => c.method === "DELETE"), "mocked Telegram update PUTs to the selected Worker with no delete/recreate");
ok(panelUpdateMetadata.bindings.some((b) => b.name === "DB" && b.id === "db-existing") && panelUpdateMetadata.bindings.some((b) => b.name === "UPSTREAM") && panelUpdateMetadata.keep_bindings.includes("secret_text") && updateEnv.__updatePatch.detail.includes("53.6/79"), "mocked upgrade preserves D1/resources/secrets and records the exact release receipt");
updatePanel.last_check_detail = updateEnv.__updatePatch.detail;
const putCountBeforeReceiptCheck = panelUpdateCalls.filter((c) => c.method === "PUT").length;
const receiptResult = await updateSandbox.__upgradeOwnedPanel(updateEnv, updatePanel, undefined, "test-cf-token");
ok(receiptResult.ok && receiptResult.reason === "current" && panelUpdateCalls.filter((c) => c.method === "PUT").length === putCountBeforeReceiptCheck, "confirmed in-place upload is not repeated when the child health probe is blocked");

// 1. accounts
{
  const r = await call("POST", "/api/managed-bothost/accounts", { bhk_token: "bhk_xxxxxxxxxxxxxxxxxxxxxxxx", arvan_token: "00000000-0000-4000-8000-000000000001" });
  ok(r.status === 200 && r.body.ok, "accounts verification returns ok");
  ok(r.body.zones[0].name === "drsarli.ir", "arvan zones listed");
  ok(r.body.deployments[0].id.startsWith("145e65f5"), "existing deployment discovered for adoption");
}
// 2. bad token rejected
{
  const r = await call("POST", "/api/managed-bothost/jobs", { bhk_token: "bad", arvan_token: "x", zone: "drsarli.ir" });
  ok(r.status === 400, "bad bhk rejected with 400");
}
// 3. create job
{
  const r = await call("POST", "/api/managed-bothost/jobs", { bhk_token: "bhk_xxxxxxxxxxxxxxxxxxxxxxxx", arvan_token: "00000000-0000-4000-8000-000000000001", zone: "drsarli.ir", label: "relay" });
  ok(r.status === 201 && r.body.job.domain === "relay.drsarli.ir", "job created for relay.drsarli.ir");
  ok(r.body.job.target === "omni.4lifm29.workers.dev", "worker host prefers request hostname over stale public_host");
  ok(r.body.job.path === "/JOGpAVgq", "tunnel path taken from settings");
  globalThis.__jobId = r.body.job.id;
}
// 4. step: verify -> deploy -> dns -> check -> ready (mock drives full chain)
{
  let job;
  for (let t = 0; t < 6; t++) {
    const r = await call("POST", "/api/managed-bothost/jobs/" + globalThis.__jobId + "/step", {});
    if (!r.body.job) console.log("STEP DEBUG", JSON.stringify(r));
    job = r.body.job;
    if (job.status === "ready" || job.status === "failed") break;
  }
  ok(job.status === "ready", "state machine reaches ready (got " + job.status + (job.error ? ": " + job.error : "") + ")");
  ok(job.deployment_id === "145e65f5-2b1b-4b83-926a-cbb805056577", "existing deployment adopted, no quota-consuming new one");
  ok(job.node_host === "fi15.bot-hosting.net" && job.node_port === 26388, "node host/port captured");
  ok(job.apps_host === "qtbidau3ht.apps.bot-hosting.cloud", "apps host derived from subdomain, not custom domain");
  ok(job.edge_ip === "178.105.112.237", "edge IP resolved via DoH");
  const row = DB.tables.managed_bothost_jobs.rows[0];
  ok(row.bhk_token === "" && row.arvan_token === "", "tokens purged after ready");
  ok(DB.tables.managed_bothost_jobs.cols.includes("check_count"), "legacy Bot-Hosting D1 migration adds check_count");
  ok(!DB.tables.managed_bothost_jobs.cols.some((c) => c.startsWith("vercel_")), "Bot-Hosting D1 schema remains separate from Vercel");
  const dns = JSON.parse(row.dns_created);
  ok(dns.length === 3 && dns.some((d) => d.type === "a") && dns.filter((d) => d.type === "txt").length === 2, "1 A + 2 TXT records tracked");
  ok(arvanCreated.every((r) => Array.isArray(r.value) || r.type === "txt"), "A record posted with array value (root-cause schema)");
  const bridge = DB.tables.bot_bridges.rows[0];
  ok(bridge && bridge.platform === "bothost" && bridge.custom_ok === 1 && bridge.arvan_edge === 1 && bridge.raw_port === 26388, "bot_bridges mirror row complete");
}
// 5. configs
{
  const r = await call("GET", "/api/managed-bothost/jobs/" + globalThis.__jobId + "/configs");
  const cfgLines = r.body.users[0].lines;
  ok(r.status === 200 && cfgLines.length === 40, "configs generated for users (" + cfgLines.length + " lines)");
  ok(cfgLines[0].uri.startsWith("vless://5fadafe5-1111-2222-3333-444444444444@snapp.ir:443"), "first line uses Iranian front address snapp.ir");
  ok(cfgLines.every((l) => {
    const u = new URL(l.uri);
    return u.hostname.includes("fi15.bot-hosting.net") || (u.searchParams.get("sni") === "relay.drsarli.ir" && u.searchParams.get("host") === "relay.drsarli.ir");
  }), "every TLS line keeps SNI/Host on the own Arvan domain");
  ok(cfgLines.filter((l) => new URL(l.uri).hostname === "snapp.ir").length >= 5, "Iranian front pool covers multiple ports per domain");
  ok(cfgLines.some((l) => l.uri.includes("fi15.bot-hosting.net:26388")), "raw WS line targets node directly");
}
// 6. Independent Vercel section: per-user Bot-Hosting discovery and Vercel lifecycle.
{
  const token = "mock-valid-token-abcdefghijklmnopqrstuvwxyz";
  const bhk = "bhk_" + "x".repeat(24);
  const invalidBhk = "bhk_" + "z".repeat(24);
  const deploymentId = "145e65f5-2b1b-4b83-926a-cbb805056577";
  let r = await callVercel("GET", "/api/vercel-relays");
  ok(r.status === 200 && r.body.ok && r.body.relays.length === 0, "separate Vercel relay list starts empty");
  r = await callVercel("POST", "/api/vercel-relays/discover", { bhk_token: "bad", vercel_token: token });
  ok(r.status === 400 && !r.body.ok, "Bot-Hosting discovery rejects a malformed key");
  r = await callVercel("POST", "/api/vercel-relays/discover", { bhk_token: invalidBhk, vercel_token: token });
  ok(r.status === 400 && !r.body.ok, "Bot-Hosting discovery verifies the user's own API key");
  r = await callVercel("POST", "/api/vercel-relays/discover", { bhk_token: bhk, vercel_token: "mock-invalid-token-abcdefghijklmnopqrstuvwxyz" });
  ok(r.status === 400 && !r.body.ok, "key check rejects an invalid Vercel token before listing projects");
  r = await callVercel("POST", "/api/vercel-relays/discover", { bhk_token: bhk, vercel_token: token });
  ok(r.status === 200 && r.body.ok && r.body.account.username === "guts" && r.body.vercel_account.username === "smoke" && r.body.deployments.length === 2, "both user keys are verified and Bot-Hosting projects are discovered");
  ok(r.body.deployments[0].id === deploymentId && r.body.deployments[0].apps_host === "qtbidau3ht.apps.bot-hosting.cloud" && r.body.deployments[0].path === "/JOGpAVgq", "own managed deployment is matched to its current WebSocket path");
  ok(r.body.deployments[1].id === "dep-self-owned-01" && r.body.deployments[1].path === "/AutoPath2026", "independent project path is detected from its Bot-Hosting file");
  r = await callVercel("POST", "/api/vercel-relays", { source_deployment_id: deploymentId, bhk_token: bhk, vercel_token: "mock-invalid-token-abcdefghijklmnopqrstuvwxyz" });
  ok(r.status === 400 && !r.body.ok, "invalid Vercel token is rejected after selecting a Bot-Hosting project");
  r = await callVercel("POST", "/api/vercel-relays", { source_deployment_id: deploymentId, bhk_token: bhk, vercel_token: "mock-build-failure-token-abcdefghijklmnopqrstuvwxyz" });
  ok(r.status === 502 && !r.body.ok, "failed Vercel build is surfaced without changing Bot-Hosting");
  ok(vercelCalls.some((c) => c.method === "DELETE" && c.url.includes("/v9/projects/omni-ws-11111111")), "failed Vercel project is cleaned up automatically");
  r = await callVercel("POST", "/api/vercel-relays", { source_deployment_id: deploymentId, bhk_token: bhk, vercel_token: token, label: "my own relay" });
  ok(r.status === 201 && r.body.ok && r.body.relay.domain === "omni-ws-11111111.vercel.app", "Vercel relay is created for the selected per-user Bot-Hosting project");
  const vrow = DB.tables.vercel_relays.rows[0];
  ok(vrow.source_job_id === deploymentId && vrow.source_domain === "omni-bridge-sp8hb" && vrow.target_host === "qtbidau3ht.apps.bot-hosting.cloud" && vrow.target_path === "/JOGpAVgq", "Vercel record snapshots the user's own deployment host and path");
  ok(!JSON.stringify(vrow).includes(token) && !JSON.stringify(vrow).includes(bhk) && !DB.tables.managed_bothost_jobs.rows[0].vercel_domain, "Bot-Hosting and Vercel keys are not stored or attached to Bot-Hosting jobs");
  ok(lastVercelDeploy.env.TARGET_DOMAIN === "https://qtbidau3ht.apps.bot-hosting.cloud" && lastVercelDeploy.env.TARGET_PATH === "/JOGpAVgq", "bridge targets the user's selected upstream without modifying it");
  const uploaded = Object.fromEntries(lastVercelDeploy.files.map((f) => [f.file, Buffer.from(f.data, "base64").toString("utf8")]));
  ok(uploaded["api/index.js"].includes("TARGET_PATH") && uploaded["api/index.js"].includes("export default server"), "Vercel project contains the WS bridge function");
  ok(JSON.parse(uploaded["vercel.json"]).functions["api/index.js"].maxDuration === 300, "Vercel relay uses the bounded 300-second function duration");
  r = await call("GET", "/api/managed-bothost/jobs/" + globalThis.__jobId + "/configs");
  ok(r.body.users[0].lines.length === 40 && r.body.target_lines === 40, "Bot-Hosting/Arvan configs remain exactly 40 after Vercel creation");
  r = await callVercel("GET", "/api/vercel-relays/" + vrow.id + "/configs");
  const vline = r.body.users[0].lines[0];
  const vuri = new URL(vline.uri);
  ok(r.status === 200 && r.body.target_lines === 1, "independent Vercel section generates its own config list");
  ok(vuri.hostname === "omni-ws-11111111.vercel.app" && vuri.searchParams.get("path") === "/ws/vl/5fadafe5-1111-2222-3333-444444444444", "separate Vercel URI uses TLS/WS and per-user UUID path");
  ok(vuri.searchParams.get("sni") === vuri.hostname && vuri.searchParams.get("host") === vuri.hostname, "Vercel config keeps SNI and Host on its own domain");
  r = await callVercel("GET", "/api/vercel-relays/" + vrow.id + "/ping");
  ok(r.status === 200 && r.body.ok && r.body.status === 200, "independent Vercel health route confirms upstream WS");
  r = await callVercel("POST", "/api/vercel-relays/" + vrow.id + "/delete", { vercel_token: token });
  ok(r.status === 200 && r.body.deleted && DB.tables.vercel_relays.rows.length === 0, "only the Vercel project is deleted from its own section");
  ok(vercelCalls.some((c) => c.method === "DELETE" && c.url.includes("/v9/projects/omni-ws-11111111")), "independent delete calls Vercel project API");
}
// 7. disable -> enable -> delete
{
  let r = await call("POST", "/api/managed-bothost/jobs/" + globalThis.__jobId + "/disable", {});
  ok(r.body.job.status === "disabled", "disable flips status");
  r = await call("POST", "/api/managed-bothost/jobs/" + globalThis.__jobId + "/enable", { bhk_token: "bhk_x", arvan_token: "av_x" });
  ok(r.body.job.status === "check", "enable restarts and re-checks with fresh tokens");
  r = await call("DELETE", "/api/managed-bothost/jobs/" + globalThis.__jobId, { bhk_token: "bhk_x", arvan_token: "av_x" });
  ok(r.body.ok && DB.tables.managed_bothost_jobs.rows.length === 0, "delete removes job and external resources");
  ok(DB.tables.bot_bridges.rows.length === 0, "delete removes mirror bridge row");
  ok(calls.some((c) => c.method === "DELETE" && c.url.includes("/dns-records/")), "owned Arvan records deleted");
}
// 8. non-admin blocked
{
  const r = await sandbox.omniMbApi(req("GET", "/api/managed-bothost/jobs"), env, {}, new URL("https://omni.4lifm29.workers.dev/api/managed-bothost/jobs"), { role: "user", username: "demo" }, settings);
  ok(r.status === 403, "non-admin forbidden");
  const vr = await sandbox.omniVercelApi(req("GET", "/api/vercel-relays"), env, {}, new URL("https://omni.4lifm29.workers.dev/api/vercel-relays"), { role: "user", username: "demo" }, settings);
  ok(vr.status === 403, "non-admin forbidden from independent Vercel API");
}
console.log("\nALL " + pass + " SMOKE ASSERTIONS PASSED");
