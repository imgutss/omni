#!/usr/bin/env node
/* Canonical rebuild from the last-live Omni bundle. Injects the separately
   maintained managed-Bot-Hosting controller and independent Vercel section. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => {
  const dest = path.join(ROOT, p);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, s);
};
function must(condition, message) { if (!condition) throw new Error(message); }
function replaceUnique(text, needle, replacement, label) {
  const count = text.split(needle).length - 1;
  must(count === 1, 'anchor [' + label + '] count=' + count + ', expected 1');
  return text.replace(needle, replacement);
}
function patchUnique(text, oldValue, newValue, label) {
  const newCount = text.split(newValue).length - 1;
  if (newCount === 1) return text;
  if (newCount > 1) throw new Error('patch [' + label + '] newCount=' + newCount);
  const oldCount = text.split(oldValue).length - 1;
  if (oldCount === 1) return text.replace(oldValue, newValue);
  throw new Error('patch [' + label + '] oldCount=' + oldCount + ', newCount=' + newCount);
}
function replaceNamedFunction(text, startMarker, endMarker, replacement, label) {
  const starts = text.split(startMarker).length - 1;
  must(starts === 1, 'function [' + label + '] start count=' + starts);
  const start = text.indexOf(startMarker);
  const markerEnd = text.indexOf(endMarker, start);
  must(markerEnd > start, 'function [' + label + '] end marker missing');
  const end = markerEnd + endMarker.length;
  if (text.slice(start, end).trim() === replacement.trim()) return text;
  return text.slice(0, start) + replacement + text.slice(end);
}

let worker = read('live/worker.js');
let panel = '';
const mbPanel = read('src/mb-panel.js').trim();
const vercelPanel = read('src/mb-vercel-panel.js').trim();
const panelMod = mbPanel + '\n\n' + vercelPanel;
let backend = read('src/mb-backend.js').trim();
let vercelBackend = read('src/mb-vercel-backend.js').trim();
const relayTemplate = read('src/mb-vercel-relay.js').trim();

const relayPlaceholder = 'var OV_VERCEL_RELAY_SOURCE = "__OMNI_VERCEL_RELAY_SOURCE__";';
must(vercelBackend.split(relayPlaceholder).length - 1 === 1, 'Vercel relay source placeholder count is not 1');
must(relayTemplate.includes('export default server') && relayTemplate.includes('TARGET_PATH'), 'Vercel relay source is incomplete');
vercelBackend = vercelBackend.replace(relayPlaceholder, 'var OV_VERCEL_RELAY_SOURCE = ' + JSON.stringify(relayTemplate) + ';');

// Add a distinct authenticated API prefix; Bot-Hosting routes stay untouched.
const routeAnchor = '  if (p2.startsWith("/api/managed-bothost/")) return omniMbApi(request, env2, ctx, url, account, settings);';
const vercelRoute = '  if (p2 === "/api/vercel-relays" || p2.startsWith("/api/vercel-relays/")) return omniVercelApi(request, env2, ctx, url, account, settings);';
const vercelRouteCount = worker.split(vercelRoute).length - 1;
must(vercelRouteCount <= 1, 'duplicate independent Vercel API route');
if (!vercelRouteCount) worker = replaceUnique(worker, routeAnchor, routeAnchor + '\n' + vercelRoute, 'independent Vercel API route');

// Telegram's per-panel "upgrade" must PUT the latest bundle to that exact
// Worker. It must not invoke the destructive 1101 repair path or delete/recreate
// a panel when a workers.dev health probe is unavailable from another Worker.
const bindingsFn = String.raw`function panelCfBindings(list) {
  const out = [];
  for (const b of (Array.isArray(list) ? list : [])) {
    if (!b || !b.type || !b.name) continue;
    const t = String(b.type);
    if (t === "secret_text" || t === "secret_key") continue;
    if (t === "plain_text") {
      out.push({ type: "plain_text", name: b.name, text: typeof b.text === "string" ? b.text : "" });
    } else if (t === "d1") {
      const id = b.database_id || b.id || b.databaseId;
      if (id) out.push({ type: "d1", name: b.name, id });
    } else if (t === "kv_namespace") {
      const namespaceId = b.namespace_id || b.id;
      if (namespaceId) out.push({ type: "kv_namespace", name: b.name, namespace_id: namespaceId });
    } else if (t === "r2_bucket") {
      const bucketName = b.bucket_name || b.bucketName;
      if (bucketName) out.push({ type: "r2_bucket", name: b.name, bucket_name: bucketName });
    } else {
      const copy = { ...b };
      delete copy.text;
      out.push(copy);
    }
  }
  return out;
}
__name(panelCfBindings, "panelCfBindings");`;
worker = replaceNamedFunction(worker, 'function panelCfBindings(list) {', '__name(panelCfBindings, "panelCfBindings");', bindingsFn, 'panelCfBindings');

const panelBuildInfoFn = String.raw`async function panelBuildInfo(panelUrl) {
  const base = String(panelUrl || "").trim();
  if (!base) return null;
  try {
    const versionUrl = new URL("/api/version", base);
    versionUrl.searchParams.set("_omni_check", String(Date.now()));
    const r = await fetch(versionUrl.toString(), { cache: "no-store", headers: { "cache-control": "no-cache, no-store" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
__name(panelBuildInfo, "panelBuildInfo");`;
worker = replaceNamedFunction(worker, 'async function panelBuildInfo(panelUrl) {', '__name(panelBuildInfo, "panelBuildInfo");', panelBuildInfoFn, 'panelBuildInfo');

const upgradeFn = String.raw`async function upgradeOwnedPanel(env2, panel, bundleIn, tokenIn) {
  try {
    if (!panel || !panel.worker_name || !panel.account_id)
      return { ok: false, reason: "bad_panel" };
    if (!panel.panel_url)
      return { ok: false, reason: "no_url" };
    let token = String(tokenIn || "");
    if (!token) {
      const acc = await env2.DB.prepare("SELECT token FROM bot_cf_accounts WHERE chat_id=? AND account_id=?").bind(String(panel.owner_chat_id), String(panel.account_id)).first().catch(() => null);
      token = String(acc && acc.token || "");
    }
    if (!token)
      return { ok: false, reason: "no_token" };
    const targetMd5 = String(OMNI_BUILD.md5 || "");
    const targetStamp = String(OMNI_BUILD.v || "") + "/" + String(OMNI_BUILD.rev || 0) + "/" + targetMd5;
    const updateReceipt = "in-place upgrade " + targetStamp;
    const info = await panelBuildInfo(panel.panel_url);
    if (info && !panelNeedsUpgrade(info))
      return { ok: true, reason: "current" };
    if (!info && String(panel.last_check_detail || "") === updateReceipt)
      return { ok: true, reason: "current", verifiedBy: "Cloudflare upload API" };
    const bundle = bundleIn || await getReleaseBundle(env2, "current");
    if (!bundle || !workerBundleHasPanel(bundle, panel_default))
      return { ok: false, reason: "release_mismatch", detail: "verified current release bundle is unavailable" };
    const base = "https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(String(panel.account_id)) + "/workers/scripts/" + encodeURIComponent(String(panel.worker_name));
    const sr = await fetch(base + "/settings", { headers: { authorization: "Bearer " + token } });
    const sj = await sr.json().catch(() => null);
    if (!sj || !sj.success)
      return { ok: false, reason: "settings", detail: String(sj && sj.errors && sj.errors[0] && sj.errors[0].message || sr.status) };
    const settings = sj.result || {};
    const bs = settings.bindings || [];
    const meta = {
      main_module: "worker.js",
      compatibility_date: settings.compatibility_date || "2024-09-23",
      compatibility_flags: settings.compatibility_flags || ["nodejs_compat"],
      usage_model: settings.usage_model || "standard",
      bindings: panelCfBindings(bs),
      keep_bindings: ["secret_text", "secret_key"]
    };
    const fd = new FormData();
    fd.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }), "metadata.json");
    fd.append("worker.js", new Blob([bundle], { type: "application/javascript+module" }), "worker.js");
    const pr = await fetch(base, { method: "PUT", headers: { authorization: "Bearer " + token }, body: fd });
    const pj = await pr.json().catch(() => null);
    if (!pj || !pj.success)
      return { ok: false, reason: "put", detail: String(pj && pj.errors && pj.errors[0] && pj.errors[0].message || "Cloudflare rejected the in-place update") };
    const deploymentId = String(pj.result && pj.result.deployment_id || "");
    await updatePanelState(env2, panel.id, { detail: updateReceipt }).catch(() => {});
    return { ok: true, reason: "upgraded", deploymentId, verifiedBy: "Cloudflare upload API" };
  } catch (e) {
    return { ok: false, reason: "error", detail: String(e && e.message || e) };
  }
}
__name(upgradeOwnedPanel, "upgradeOwnedPanel");`;
worker = replaceNamedFunction(worker, 'async function upgradeOwnedPanel(', '__name(upgradeOwnedPanel, "upgradeOwnedPanel");', upgradeFn, 'upgradeOwnedPanel in-place');

worker = patchUnique(worker,
  '        try {\n          await omniForceRepair1101Panel(env2, tok, p2);\n          const fresh = await getOwnedPanel(env2, chatId, p2.id);',
  '        try {\n          let updateResult = null;\n          if (action === "update") {\n            updateResult = await upgradeOwnedPanel(env2, p2, undefined, tok);\n            if (!updateResult.ok || !["upgraded", "current"].includes(updateResult.reason))\n              throw new Error(String(updateResult.detail || updateResult.reason || "in-place update failed"));\n          } else {\n            await omniForceRepair1101Panel(env2, tok, p2);\n          }\n          const fresh = await getOwnedPanel(env2, chatId, p2.id);',
  'Telegram pm:update uses the in-place upgrade helper');
worker = patchUnique(worker,
  '• <b>وضعیت هسته:</b> 🟢 <b>${action === "update" ? "ارتقا یافته به نسخه v3.6" : "بازسازی و رفع ۱۱٠۱ انجام شد (v3.6)"}</b>',
  '• <b>وضعیت هسته:</b> 🟢 <b>${action === "update" ? (updateResult.reason === "current" ? "از قبل روی v" + OMNI_BUILD.v + " بود" : "در همان Worker به v" + OMNI_BUILD.v + " ارتقا یافت؛ پنل جدیدی ساخته نشد") : "بازسازی و رفع ۱۱۰۱ انجام شد (v" + OMNI_BUILD.v + ")"}</b>',
  'Telegram in-place upgrade confirmation');
const safeUpgradeStart = worker.indexOf('async function upgradeOwnedPanel(');
const safeUpgradeEndMarker = '__name(upgradeOwnedPanel, "upgradeOwnedPanel");';
const safeUpgradeEnd = worker.indexOf(safeUpgradeEndMarker, safeUpgradeStart);
must(safeUpgradeStart >= 0 && safeUpgradeEnd > safeUpgradeStart, 'in-place panel upgrader missing');
const safeUpgradeCode = worker.slice(safeUpgradeStart, safeUpgradeEnd + safeUpgradeEndMarker.length);
must(!/method:\s*["']DELETE["']/.test(safeUpgradeCode), 'in-place panel upgrader must never delete the existing Worker');
must(safeUpgradeCode.includes('keep_bindings: ["secret_text", "secret_key"]'), 'in-place upgrade must preserve existing secrets');
must(safeUpgradeCode.includes('panel.last_check_detail') && safeUpgradeCode.includes('updateReceipt'), 'in-place upgrade must avoid repeating a confirmed upload when workers.dev cannot be probed');
must(worker.includes('updateResult = await upgradeOwnedPanel(env2, p2, undefined, tok)'), 'Telegram pm:update must use the in-place upgrader');

// Replace only the existing Bot-Hosting panel controller, then append a
// dedicated Vercel controller at the same script scope (not inside its card).
const panelModMarker = '/* =========================================================================\n * OMNI · Managed Bot-Hosting panel controller';
must(panelMod.startsWith(panelModMarker), 'managed-Bot-Hosting controller marker missing');
const panelMarker = 'var panel_default = "';
let assignment = worker.indexOf(panelMarker);
must(assignment >= 0, 'panel_default assignment missing');
let literalStart = assignment + panelMarker.length;
let literalEnd = literalStart;
while (literalEnd < worker.length) {
  if (worker[literalEnd] === '\\') { literalEnd += 2; continue; }
  if (worker[literalEnd] === '"') break;
  literalEnd++;
}
must(literalEnd < worker.length, 'panel_default string is unterminated');
panel = JSON.parse('"' + worker.slice(literalStart, literalEnd) + '"');
const controllerStart = panel.indexOf(panelModMarker);
const controllerEnd = panel.indexOf('function natnetBothostCardHtml(){return omniMbCardHtml();}', controllerStart);
must(controllerStart >= 0 && controllerEnd > controllerStart, 'existing managed-Bot-Hosting controller not found');
panel = panel.slice(0, controllerStart) + panelMod + '\n' + panel.slice(controllerEnd);

// Add Vercel as section 6 in the relay-suite selector, rather than a child of
// the Bot-Hosting/Arvan job card. All operations are independently routed.
panel = patchUnique(panel,
  '["deno", "falix", "railway", "railway_arvan", "bothost"].includes(NATNET.bridgePlatform)',
  '["deno", "falix", "railway", "railway_arvan", "bothost", "vercel"].includes(NATNET.bridgePlatform)',
  'allowed relay sub-tabs');
panel = patchUnique(panel,
  '    const isRailwayArvanTab = curPlat === "railway_arvan";\n',
  '    const isRailwayArvanTab = curPlat === "railway_arvan";\n    const isVercelTab = curPlat === "vercel";\n',
  'Vercel selected-tab state');
panel = patchUnique(panel,
  '    const autoCard = curPlat === "bothost" ? natnetBothostCardHtml() : natnetAutoCardHtml(curPlat);\n',
  '    const autoCard = curPlat === "bothost" ? natnetBothostCardHtml() : isVercelTab ? omniVercelCardHtml() : natnetAutoCardHtml(curPlat);\n',
  'Vercel section renderer');
panel = patchUnique(panel,
  '    const providerPackCard = natnetProviderPackHtml(curPlat, uuid, xhttpPath, publicHost, e.settings);\n',
  '    const providerPackCard = isVercelTab ? "" : natnetProviderPackHtml(curPlat, uuid, xhttpPath, publicHost, e.settings);\n',
  'hide generic pack in Vercel section');
panel = patchUnique(panel,
  '👇 یکی از پنج بخش مستقل رله ابری را انتخاب کن (بخش ریلوی + کلودفلر و بخش ریلوی + ابر آروان کاملاً جدا هستند):',
  '👇 یکی از شش بخش مستقل رله ابری را انتخاب کن (هر بخش مدیریت جداگانه دارد):',
  'independent section count');
panel = patchUnique(panel,
  '    <!-- ================= FOUR SWITCHABLE SECTIONS: DENO vs FALIX vs RAILWAY+CF vs RAILWAY+ARVAN ================= -->',
  '    <!-- ================= SIX INDEPENDENT RELAY SECTIONS ================= -->',
  'relay section comment');
const sectionEnd = '        </button>\n      </div>\n    </div>\n\n    <!-- ================= ACTIVE PROVIDER SECTION ================= -->';
const vercelTab = `        </button>

        <button type="button" data-action="omni-natnet-subtab" data-sub="vercel"
                class="card" style="cursor:pointer;text-align:right;padding:14px 16px;border:2px solid \${isVercelTab ? "#818cf8" : "var(--border)"};background:\${isVercelTab ? "rgba(129,140,248,0.14)" : "var(--surface)"};transition:all .18s">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <b style="font-size:14px;color:#818cf8">🟣 بخش ۶: رلهٔ مستقل Vercel</b>
            <span class="badge \${isVercelTab ? "ok" : "info"}">\${isVercelTab ? "● فعال" : "انتخاب ←"}</span>
          </div>
          <div class="muted" style="font-size:11.5px;margin-top:6px;line-height:1.7">
            پل WebSocket و کانفیگ‌های Vercel؛ مدیریت جدا از بخش Bot-Hosting و آروان
          </div>
        </button>
      </div>
    </div>

    <!-- ================= ACTIVE PROVIDER SECTION ================= -->`;
panel = patchUnique(panel, sectionEnd, vercelTab, 'independent Vercel sub-tab');
const oldBorder = 'border-inline-start:4px solid \${isRailwayArvanTab ? "#f59e0b" : isRailwayTab ? "#a855f7" : isFalixTab ? "#3b82f6" : "#10b981"}';
panel = patchUnique(panel, oldBorder,
  'border-inline-start:4px solid \${isVercelTab ? "#818cf8" : isRailwayArvanTab ? "#f59e0b" : isRailwayTab ? "#a855f7" : isFalixTab ? "#3b82f6" : "#10b981"}',
  'Vercel provider card accent');
const oldHeaderColor = 'color:\${isRailwayArvanTab ? "#f59e0b" : isRailwayTab ? "#a855f7" : isFalixTab ? "#3b82f6" : "#10b981"};font-size:14.5px';
panel = patchUnique(panel, oldHeaderColor,
  'color:\${isVercelTab ? "#818cf8" : isRailwayArvanTab ? "#f59e0b" : isRailwayTab ? "#a855f7" : isFalixTab ? "#3b82f6" : "#10b981"};font-size:14.5px',
  'Vercel provider header color');
panel = patchUnique(panel,
  '          \${isRailwayArvanTab\n            ? "☁️ آروان خودکار — CDN آروان + مبدأ مدیریت‌شده"',
  '          \${isVercelTab\n            ? "🟣 بخش ۶: رلهٔ مستقل Vercel WebSocket"\n            : isRailwayArvanTab\n            ? "☁️ آروان خودکار — CDN آروان + مبدأ مدیریت‌شده"',
  'Vercel provider heading');
panel = patchUnique(panel,
  '        <span class="badge ok">\${isRailwayArvanTab ? `ساخت با توکن آروان` : isRailwayTab ? `ساخت روی حساب شخصی شما` : isFalixTab ? `\${falixMultiPack.length} کانفیگ مولتی‌پورت آماده` : `\${denoMultiPack.length} کانفیگ مولتی‌پورت آماده`}</span>',
  '        <span class="badge ok">\${isVercelTab ? `مدیریت مستقل پروژه و کانفیگ Vercel` : isRailwayArvanTab ? `ساخت با توکن آروان` : isRailwayTab ? `ساخت روی حساب شخصی شما` : isFalixTab ? `\${falixMultiPack.length} کانفیگ مولتی‌پورت آماده` : `\${denoMultiPack.length} کانفیگ مولتی‌پورت آماده`}</span>',
  'Vercel provider badge');
panel = patchUnique(panel,
  '        \${isRailwayArvanTab\n          ? `در روش خودکار، دامنهٔ خودتان به CDN آروان و مبدأ مدیریت‌شده متصل می‌شود. گواهی و کانفیگ‌ها خودکار ساخته می‌شوند؛ پینگ باید روی خط خودتان آزمایش شود.`',
  '        \${isVercelTab\n          ? `این بخش به‌صورت مستقل پروژه و کانفیگ Vercel را می‌سازد و حذف می‌کند؛ رلهٔ آمادهٔ بخش ۵ فقط upstream خوانده می‌شود و تغییر یا حذف نمی‌شود.`\n          : isRailwayArvanTab\n          ? `در روش خودکار، دامنهٔ خودتان به CDN آروان و مبدأ مدیریت‌شده متصل می‌شود. گواهی و کانفیگ‌ها خودکار ساخته می‌شوند؛ پینگ باید روی خط خودتان آزمایش شود.`',
  'Vercel provider description');

// Stamp the UI hash into the HTML; the API returns the same metadata.
const placeholderHash = '0'.repeat(32);
const dataBuildMatches = panel.match(/data-build="[^"]+"/g) || [];
must(dataBuildMatches.length === 1, 'expected one data-build attribute, found ' + dataBuildMatches.length);
panel = panel.replace(dataBuildMatches[0], 'data-build="' + placeholderHash + '"');
const panelMd5 = crypto.createHash('md5').update(panel, 'utf8').digest('hex');
panel = panel.replace('data-build="' + placeholderHash + '"', 'data-build="' + panelMd5 + '"');
const panelBytes = Buffer.byteLength(panel, 'utf8');
worker = worker.slice(0, literalStart) + JSON.stringify(panel).slice(1, -1) + worker.slice(literalEnd);

// Replace the appended Bot-Hosting module using its unique identity marker;
// the independent Vercel module may itself contain later comment dividers.
const moduleMarkerText = '/* =========================================================================\n * OMNI · Managed Bot-Hosting (mb) — rebuilt from scratch, same architecture';
const moduleMarkerCount = worker.split(moduleMarkerText).length - 1;
must(moduleMarkerCount === 1, 'managed-Bot-Hosting module marker count=' + moduleMarkerCount);
const moduleMarker = worker.indexOf(moduleMarkerText);
const exportMarker = worker.indexOf('export {\n  worker_default as default\n};', moduleMarker);
must(exportMarker > moduleMarker, 'appended worker module export marker missing');
worker = worker.slice(0, moduleMarker) + backend + '\n\n' + vercelBackend + '\n\n' + worker.slice(exportMarker);
const vercelModuleMarker = ' * OMNI · independent Vercel WebSocket relay manager';
must(worker.split(vercelModuleMarker).length - 1 === 1, 'independent Vercel module was not inserted exactly once');

const buildMatches = worker.match(/var OMNI_BUILD = \{ v: "[^"]+", bytes: \d+, md5: "[^"]+", rev: \d+, at: "[^"]+" \};/g) || [];
must(buildMatches.length === 1, 'expected one OMNI_BUILD declaration, found ' + buildMatches.length);
const nextBuild = 'var OMNI_BUILD = { v: "53.5", bytes: ' + panelBytes + ', md5: "' + panelMd5 + '", rev: 78, at: "2026-10-23" };';
worker = worker.replace(buildMatches[0], nextBuild);

// Fail on a malformed panel string, a misplaced section, or an uninjected relay.
const finalAssignment = worker.indexOf(panelMarker);
must(finalAssignment >= 0, 'final panel_default assignment missing');
const finalStart = finalAssignment + panelMarker.length;
let finalEnd = finalStart;
while (finalEnd < worker.length) {
  if (worker[finalEnd] === '\\') { finalEnd += 2; continue; }
  if (worker[finalEnd] === '"') break;
  finalEnd++;
}
must(finalEnd < worker.length, 'final panel_default string is unterminated');
const finalPanel = JSON.parse('"' + worker.slice(finalStart, finalEnd) + '"');
must(finalPanel === panel, 'embedded panel round-trip mismatch');
must(finalPanel.includes('data-build="' + panelMd5 + '"'), 'embedded panel hash stamp mismatch');
must(!worker.includes('__OMNI_VERCEL_RELAY_SOURCE__'), 'Vercel relay source placeholder remains');
must(panel.includes('data-sub="vercel"') && panel.includes('omniVercelCardHtml()'), 'separate Vercel section missing from panel');
must(!panel.includes('Vercel WebSocket Domain'), 'old nested Vercel card remains in managed-Bot-Hosting panel');

write('build/panel.html', panel);
write('build/worker.js', worker);
console.log(JSON.stringify({
  panelBytes,
  panelMd5,
  workerBytes: Buffer.byteLength(worker, 'utf8'),
  version: '53.5',
  revision: 78,
  hasIndependentVercelApi: worker.includes('omniVercelApi') && worker.includes('vercel_relays'),
  hasIndependentVercelPanel: panel.includes('data-sub="vercel"')
}, null, 2));
