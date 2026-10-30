// rev154 panel patch — one WARP registration flow, no surprise registrations,
// persistent honest errors, and no stale output-card rendering.
const fs = require('fs');
let html = fs.readFileSync('/home/user/omni-fix/panel.v92.final.html', 'utf8');
const edits = [];
function rep(oldText, newText, label, expect = 1) {
  const count = html.split(oldText).length - 1;
  if (count !== expect) throw new Error(`anchor count ${count} (expected ${expect}) for ${label}`);
  html = html.split(oldText).join(newText);
  edits.push(`${label} x${count}`);
}
function replaceBetween(start, end, replacement, label) {
  const a = html.indexOf(start);
  if (a < 0) throw new Error('start not found: ' + label);
  const b = html.indexOf(end, a + start.length);
  if (b < 0) throw new Error('end not found: ' + label);
  if (html.indexOf(start, a + 1) >= 0) throw new Error('start is not unique: ' + label);
  html = html.slice(0, a) + replacement + html.slice(b);
  edits.push(label);
}

const clientRegistration = `  var omniWarpKeyPromise = null;
  function omniWarpApplyAccount(account) {
    if (!account || !account.privateKey) throw Error("پاسخ سرور کلید معتبر ندارد.");
    GAMING_VIEW_STATE.warpAccount = account;
    GAMING_VIEW_STATE.keyError = "";
    if (typeof l !== "undefined" && l) l.settings = { ...(l.settings || {}), warp_gaming_account: JSON.stringify(account) };
    return account;
  }
  async function omniRequestWarpKey(force) {
    if (omniWarpKeyPromise) return omniWarpKeyPromise;
    omniWarpKeyPromise = (async () => {
      const r = await fetch("/api/gaming/warp/generate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-omni-csrf": "1" },
        body: JSON.stringify({ force: force === true })
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok || !j.account?.privateKey) {
        const err = Error(j?.error || ("ساخت کلید ناموفق بود (HTTP " + r.status + ")"));
        err.status = r.status;
        err.code = j?.code || "warp_registration_failed";
        err.retryAfter = Number(j?.retryAfter || 0);
        throw err;
      }
      omniWarpApplyAccount(j.account);
      return j;
    })();
    try { return await omniWarpKeyPromise; }
    finally { omniWarpKeyPromise = null; }
  }
  async function omniEnsureWarpKey(e) {
    const st = (typeof e?.settings === "function" ? e.settings() : e?.settings) || (typeof l !== "undefined" && l && l.settings) || {};
    const current = parseWarpGamingAccount(st);
    if (current?.privateKey) return current;
    const result = await omniRequestWarpKey(false);
    return result.account;
  }
  async function omniGenerateWarpKey(button, force) {
    if (GAMING_VIEW_STATE.keyBusy) return null;
    GAMING_VIEW_STATE.keyBusy = true;
    GAMING_VIEW_STATE.keyError = "";
    document.querySelectorAll('[data-action="omni-warp-generate"]').forEach((el) => { el.disabled = true; });
    y(force ? "⏳ در حال چرخش کلید و حفظ اندپوینت/تنظیمات…" : "⏳ در حال دریافت کلید معتبر یا ثبت یک دستگاه تازه در Cloudflare WARP…", "info", 3000);
    try {
      const result = await omniRequestWarpKey(force);
      GAMING_VIEW_STATE.lastGen = { key: String(result.account.publicKey || "").slice(0, 6), at: new Date().toISOString() };
      omniG48Save();
      y(result.reused ? "✅ کلید معتبر همین پنل موجود بود؛ ثبت تکراری انجام نشد." : result.coalesced ? "✅ کلید ساخته‌شده در درخواست هم‌زمان دریافت شد؛ ثبت دومی ارسال نشد." : force ? "✅ کلید تازه ساخته و ذخیره شد؛ اندپوینت و تنظیمات امنزیا حفظ شدند." : "✅ کلید WARP اختصاصی این پنل ساخته و در D1 ذخیره شد.", "ok", 5000);
      return result.account;
    } catch (err) {
      const message = String(err?.message || err);
      GAMING_VIEW_STATE.keyError = message;
      y("❌ ساخت کلید اختصاصی: " + message, "err", 6500);
      return null;
    } finally {
      GAMING_VIEW_STATE.keyBusy = false;
      try { wsPaint(); } catch {}
    }
  }

`;
replaceBetween('  var omniWarpKeyPromise = null;', '  async function omniHydrateSnapshot() {', clientRegistration, 'single client registration module');

// Selecting an endpoint is independent from registering a device.
rep('      await omniEnsureWarpKey(l);\n      await omniSaveEndpoint(ep);', '      await omniSaveEndpoint(ep);', 'endpoint selection no longer registers WARP');
rep('          await omniEnsureWarpKey(l);\n          wsPaint();', '          wsPaint();', 'opening WARP Studio no longer registers WARP');

const oldWsGenerate = `    if (i === "omni-warp-generate") {
      s.disabled = true;
      y("⏳ در حال ثبت کلید X25519 جدید در سرور کلودفلر WARP…", "info", 2500);
      try {
        const r = await fetch("/api/gaming/warp/generate", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json", "x-omni-csrf": "1" },
          body: JSON.stringify({})
        });
        const j = await r.json();
        if (!r.ok || !j.ok) throw Error(j.error || "خطا در تولید اکانت WARP");
        GAMING_VIEW_STATE.warpAccount = j.account;
        GAMING_VIEW_STATE.lastGen = { key: String(j.account.privateKey || "").slice(0, 6), at: new Date().toISOString() };
        omniG48Save();
        if (l?.settings) l.settings.warp_gaming_account = JSON.stringify(j.account);
        y("✅ کلید X25519 تازه ساخته و ذخیره شد: " + String(j.account.privateKey || "").slice(0, 6) + "…", "ok", 4500);
        wsPaint();
      } catch (err) {
        y("❌ " + (err?.message || err), "err", 4000);
      } finally {
        s.disabled = false;
      }
      return true;
    }`;
rep(oldWsGenerate, '    if (i === "omni-warp-generate") {\n      await omniGenerateWarpKey(s, s.dataset.force === "1");\n      return true;\n    }', 'ws action delegates to single-flight flow');

const oldFallbackGenerate = `        if (i === "omni-warp-generate") {
          s.disabled = true;
          y("⏳ در حال ثبت کلید X25519 جدید در سرور کلودفلر WARP…", "info", 2500);
          try {
            const r = await fetch("/api/gaming/warp/generate", {
              method: "POST",
              credentials: "same-origin",
              headers: { "content-type": "application/json", "x-omni-csrf": "1" },
              body: JSON.stringify({})
            });
            const j = await r.json();
            if (!r.ok || !j.ok) throw Error(j.error || "خطا در تولید اکانت WARP");
            GAMING_VIEW_STATE.warpAccount = j.account;
            GAMING_VIEW_STATE.lastGen = { key: String(j.account.privateKey || "").slice(0, 6), at: new Date().toISOString() };
            omniG48Save();
            if (l?.settings) l.settings.warp_gaming_account = JSON.stringify(j.account);
            y("✅ کلید X25519 تازه ساخته و ذخیره شد: " + String(j.account.privateKey || "").slice(0, 6) + "…", "ok", 4500);
            e.rerenderView("wireguard_game");
          } catch (err) {
            y("❌ " + (err?.message || err), "err", 4000);
          } finally {
            s.disabled = false;
          }
          return;
        } else if (i === "omni-awg-preset") {`;
rep(oldFallbackGenerate, '        if (i === "omni-awg-preset") {', 'remove duplicate fallback registration handler');

// Only the explicit fresh-key control rotates. Other buttons reuse a valid key.
rep('data-action="omni-warp-generate">⚡ کلید تازه</button>', 'data-action="omni-warp-generate" data-force="1" ${GAMING_VIEW_STATE.keyBusy ? "disabled" : ""}>⚡ کلید تازه</button>', 'fresh key is explicit rotation');
rep('data-action="omni-warp-generate">⚡ ساخت کلید و فعال‌سازی خروجی‌ها</button>', 'data-action="omni-warp-generate" ${GAMING_VIEW_STATE.keyBusy ? "disabled" : ""}>⚡ ساخت کلید و فعال‌سازی خروجی‌ها</button>', 'output generate busy state');
rep('data-action="omni-warp-generate">⚡ ساخت کلید</button>', 'data-action="omni-warp-generate" ${GAMING_VIEW_STATE.keyBusy ? "disabled" : ""}>⚡ ساخت کلید</button>', 'builder generate busy state');

// Do not offer key generation when only the active endpoint is missing.
rep('    const B = WS.builder;\n    const meta = pv.result.meta;\n    let head = "";', '    const B = WS.builder;\n    const meta = pv.result.meta;\n    const hasWarpKey = !!parseWarpGamingAccount(st)?.privateKey;\n    let head = "";', 'builder knows whether key is missing');
rep('          <button type="button" class="btn btn-xs btn-primary" data-action="omni-warp-generate" ${GAMING_VIEW_STATE.keyBusy ? "disabled" : ""}>⚡ ساخت کلید</button>\n          <button type="button" class="btn btn-xs" data-action="ws-open-builder">رفتن به انتخاب اندپوینت</button>', '          ${!hasWarpKey ? `<button type="button" class="btn btn-xs btn-primary" data-action="omni-warp-generate" ${GAMING_VIEW_STATE.keyBusy ? "disabled" : ""}>⚡ ساخت کلید</button>` : ""}\n          <button type="button" class="btn btn-xs" data-action="ws-open-builder">رفتن به انتخاب اندپوینت</button>', 'builder only shows key button when needed');

// Persistent status survives the toast timeout and tells the user if the old key survived.
rep('    const hasKey = !!acc?.privateKey;\n    const wgConf', '    const hasKey = !!acc?.privateKey;\n    const keyFeedback = GAMING_VIEW_STATE.keyError ? `<div role="alert" style="margin-top:10px;padding:10px 12px;border-radius:10px;border:1px solid rgba(248,113,113,.5);background:rgba(248,113,113,.08);font-size:12px;line-height:1.85">❌ ${a(GAMING_VIEW_STATE.keyError)}${hasKey ? "<br>کلید قبلی و خروجی‌های فعلی حفظ شده‌اند." : ""}</div>` : (GAMING_VIEW_STATE.keyBusy ? `<div role="status" class="muted" style="margin-top:10px;font-size:12px">⏳ یک درخواست ثبت در حال انجام است؛ درخواست دوم ارسال نمی‌شود…</div>` : "");\n    const wgConf', 'persistent key status');
rep('      return `<div style="margin-top:10px;padding:12px;border-radius:10px;border:1px solid rgba(250,204,21,.45);background:rgba(250,204,21,.08);font-size:12.5px;line-height:1.9">\n        برای ساخت کانفیگ اول یک کلید WARP اختصاصی همین پنل لازم است (رایگان، از api.cloudflareclient.com، فقط در D1 همین پنل ذخیره می‌شود).', '      return `${keyFeedback}<div style="margin-top:10px;padding:12px;border-radius:10px;border:1px solid rgba(250,204,21,.45);background:rgba(250,204,21,.08);font-size:12.5px;line-height:1.9">\n        برای ساخت کانفیگ اول یک کلید WARP اختصاصی همین پنل لازم است (رایگان، از api.cloudflareclient.com، فقط در D1 همین پنل ذخیره می‌شود).', 'missing key card includes feedback');
rep('      return `<div style="margin-top:10px;padding:12px;border-radius:10px;border:1px solid rgba(250,204,21,.45);background:rgba(250,204,21,.08);font-size:12.5px;line-height:1.9">\n        کلید آماده است، ولی', '      return `${keyFeedback}<div style="margin-top:10px;padding:12px;border-radius:10px;border:1px solid rgba(250,204,21,.45);background:rgba(250,204,21,.08);font-size:12.5px;line-height:1.9">\n        کلید آماده است، ولی', 'missing endpoint card includes feedback');
rep('    return `\n      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">', '    return `${keyFeedback}\n      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">', 'ready output includes feedback');

// Keep the quick-output card heading when repainting its body.
rep('    const out = document.getElementById("omni-warp-outputs");\n    if (out) out.innerHTML = wsOutputsInner(st);', '    const out = document.getElementById("omni-warp-outputs-body");\n    if (out) out.innerHTML = wsOutputsInner(st);', 'repaint output body only');
rep('        ${wsOutputsInner(st)}\n      </div>\n\n      <!-- ۵) Aether -->', '        <div id="omni-warp-outputs-body">${wsOutputsInner(st)}</div>\n      </div>\n\n      <!-- ۵) Aether -->', 'dedicated output body');

// A successful status read supersedes stale local errors/state.
rep('      if (j?.account) {\n        GAMING_VIEW_STATE.warpAccount = j.account;', '      if (j?.account) {\n        GAMING_VIEW_STATE.keyError = "";\n        GAMING_VIEW_STATE.warpAccount = j.account;', 'status clears stale key error');
rep('        GAMING_VIEW_STATE.customEndpoint = String(j.account.customEndpoint || "").trim();\n      }\n      if (j?.falix)', '        GAMING_VIEW_STATE.customEndpoint = String(j.account.customEndpoint || "").trim();\n      } else if (j?.needsKey) {\n        GAMING_VIEW_STATE.warpAccount = null;\n        if (typeof l !== "undefined" && l?.settings) delete l.settings.warp_gaming_account;\n      }\n      if (j?.falix)', 'status clears stale missing key');

if (html.includes('�')) throw new Error('panel contains U+FFFD');
const generateFetches = (html.match(/fetch\("\/api\/gaming\/warp\/generate"/g) || []).length;
if (generateFetches !== 1) throw new Error('generate fetch count is ' + generateFetches);
if ((html.match(/await omniEnsureWarpKey\(l\)/g) || []).length) throw new Error('surprise ensure call remains');
if (!html.includes('id="omni-warp-outputs-body"') || !html.includes('data-force="1"')) throw new Error('UI wiring incomplete');
fs.writeFileSync('/home/user/omni-fix/panel.v94.final.html', html);
console.log(JSON.stringify({ output: 'panel.v94.final.html', bytes: Buffer.byteLength(html), edits, generateFetches }, null, 2));
