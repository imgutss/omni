#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch9 — give the National-Net (Vercel/Netlify) panel section a third, default
mode: "automatic with token". The panel posts the token to the Worker, the
Worker builds the project and deploys it, the panel polls and then feeds the
live domain back into every generated VLESS config.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PANEL = ROOT / "production" / "panel.html"

s = PANEL.read_text(encoding="utf-8")
orig = len(s)
if "natnetAutoCardHtml" in s and "--force" not in sys.argv:
    print("already patched; use --force to re-apply")
    sys.exit(0)


def sub1(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit("anchor '%s' matched %d times" % (label, n))
    s = s.replace(old, new, 1)


# ── 1. state ─────────────────────────────────────────────────────────────────
sub1(
    '    relayIp: "138.201.54.122",\n  };',
    '''    relayIp: "138.201.54.122",
    vercelAutoToken: "",
    netlifyAutoToken: "",
    autoName: "",
    autoTarget: "",
    autoBusy: false,
    autoLog: "",
  };''',
    "NATNET state",
)

# ── 2. helpers: loader + auto card + bridge list ─────────────────────────────
HELPERS = r'''  /* ── Automatic cloud bridges (token → deployed site) ─────────────────────
     api.vercel.com / api.netlify.com send no CORS headers, so the browser can
     never talk to them directly. The panel hands the token to the Worker and
     the Worker does the whole install server-side — the same shape as the
     Cloudflare installer flow. */
  let natnetBridges = null;
  let natnetBridgeCtx = { target: "", path: "/VZLdh9Ft", canDeploy: true };

  async function natnetLoadBridges() {
    try {
      const r = await b.get("/api/bridge");
      natnetBridges = (r && r.bridges) || [];
      natnetBridgeCtx = {
        target: (r && r.target) || "",
        path: (r && r.path) || "/VZLdh9Ft",
        canDeploy: (r && r.can_deploy) !== false,
      };
    } catch (_) {
      natnetBridges = natnetBridges || [];
      natnetBridgeCtx.canDeploy = false;
    }
    return natnetBridges;
  }

  function natnetTunnelPath(settings) {
    let p = String((settings || {}).path || natnetBridgeCtx.path || "/VZLdh9Ft").trim().split("?")[0];
    if (!p || p === "/") p = "/VZLdh9Ft";
    if (!p.startsWith("/")) p = "/" + p;
    return p;
  }

  function natnetAutoCardHtml(platform) {
    const accent = platform === "vercel" ? "var(--accent)" : "#00c7b7";
    const brand = platform === "vercel" ? "▲ ورسل (Vercel)" : "◈ نتلیفای (Netlify)";
    const tokenKey = platform === "vercel" ? "vercelAutoToken" : "netlifyAutoToken";
    const tokenUrl = platform === "vercel"
      ? "https://vercel.com/account/tokens"
      : "https://app.netlify.com/user/applications#personal-access-tokens";
    const tokenHint = platform === "vercel"
      ? "Create Token → Scope = Full Account → Expiration = No Expiration"
      : "User settings → Applications → Personal access tokens → New access token";
    const savedToken = a(NATNET[tokenKey] || "");
    const rows = (natnetBridges || []).filter((r) => r.platform === platform);
    const busy = NATNET.autoBusy;
    return `
      <div style="background:var(--bg-elev);border:1px solid ${accent};border-radius:10px;padding:12px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <span class="badge ok">🤖 خودکار — بدون آپلود دستی</span>
          <span class="muted" style="font-size:12px">مثل بخش کلودفلر: فقط توکن را بده، بقیه‌اش با پنل</span>
        </div>
        <p class="muted" style="font-size:12.5px;margin:0 0 12px 0;line-height:1.9">
          توکن API ${brand} را وارد کن. پنل خودش پروژه/سایت را می‌سازد، فایل‌های
          <code dir="ltr">${platform === "vercel" ? "vercel.json + api/relay.js" : "netlify.toml + edge function"}</code>
          را می‌نویسد، دیپلوی پروداکشن می‌زند و دامنهٔ زنده را برمی‌گرداند.
          بعد از آن همهٔ کانفیگ‌های پایین همین بخش با همان دامنه ساخته می‌شوند.
        </p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px">
          <div class="field">
            <label for="natnet-auto-token-${platform}">توکن API ${platform === "vercel" ? "ورسل" : "نتلیفای"}</label>
            <input type="password" id="natnet-auto-token-${platform}" class="input mono" dir="ltr"
                   autocomplete="off" spellcheck="false" placeholder="${platform === "vercel" ? "cfut_… یا vercel_…" : "nlp_… / توکن شخصی"}"
                   value="${savedToken}">
            <small class="muted"><a href="${tokenUrl}" target="_blank" rel="noopener">${tokenUrl.replace(/^https:\/\//, "")}</a> · ${tokenHint}</small>
          </div>
          <div class="field">
            <label for="natnet-auto-name-${platform}">نام پروژه (اختیاری)</label>
            <input type="text" id="natnet-auto-name-${platform}" class="input mono" dir="ltr"
                   placeholder="omni-bridge" value="${a(NATNET.autoName || "")}">
            <small class="muted">حروف کوچک انگلیسی، عدد و خط تیره — خالی بگذاری خودش نام تصادفی می‌سازد.</small>
          </div>
          <div class="field">
            <label for="natnet-auto-target-${platform}">ورکر مقصد</label>
            <input type="text" id="natnet-auto-target-${platform}" class="input mono" dir="ltr"
                   placeholder="omni-xxxx.workers.dev"
                   value="${a(NATNET.autoTarget || natnetBridgeCtx.target || "")}">
            <small class="muted">مسیر تونل: <code dir="ltr">${a(natnetTunnelPath())}</code> — فقط همین مسیر پروکسی می‌شود، بقیهٔ سایت پوششی است.</small>
          </div>
        </div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:12px">
          <button class="btn btn-primary btn-sm" type="button" data-action="omni-natnet-auto-deploy" data-plat="${platform}" ${busy ? "disabled" : ""}>
            🚀 ساخت و دیپلوی خودکار
          </button>
          <button class="btn btn-sm" type="button" data-action="omni-natnet-auto-verify" data-plat="${platform}" ${busy ? "disabled" : ""}>
            ✅ فقط تست توکن
          </button>
          <button class="btn btn-sm" type="button" data-action="omni-natnet-auto-refresh" ${busy ? "disabled" : ""}>
            🔄 به‌روزرسانی فهرست پل‌ها
          </button>
        </div>
        <div id="natnet-auto-out-${platform}" style="margin-top:10px"></div>
        ${natnetBridgeListHtml(platform, rows, accent)}
      </div>`;
  }

  function natnetBridgeListHtml(platform, rows, accent) {
    if (!rows || !rows.length)
      return `<div class="muted" style="font-size:12px;margin-top:12px">هنوز پل ${platform === "vercel" ? "ورسلی" : "نتلیفایی"} با این پنل نساخته‌ای.</div>`;
    return `<div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">
      ${rows.map((r) => `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px solid var(--border);border-radius:9px;padding:8px 10px;border-inline-start:3px solid ${accent}">
          <span class="badge ${r.status === "ready" ? "ok" : r.status === "building" ? "warn" : "danger"}">${r.status === "ready" ? "✅ آماده" : r.status === "building" ? "🟡 در حال ساخت" : "❌ خطا"}</span>
          <b class="mono" dir="ltr" style="font-size:12.5px">${a(r.domain || r.name || "")}</b>
          <span class="muted mono" dir="ltr" style="font-size:11px">← ${a(r.target_host || "")}${a(r.tunnel_path || "")}</span>
          <div class="spacer" style="flex:1"></div>
          ${r.domain ? `<button class="btn btn-xs btn-primary" type="button" data-action="omni-natnet-auto-use" data-plat="${platform}" data-domain="${a(r.domain)}">📥 استفاده در کانفیگ‌ها</button>` : ""}
          ${r.url ? `<a class="btn btn-xs" href="${a(r.url)}" target="_blank" rel="noopener">🌐 باز کردن</a>` : ""}
          ${r.dashboard_url ? `<a class="btn btn-xs" href="${a(r.dashboard_url)}" target="_blank" rel="noopener">🎛 داشبورد</a>` : ""}
          <button class="btn btn-xs" type="button" data-action="omni-natnet-auto-redeploy" data-id="${Number(r.id)}" data-plat="${platform}">♻️ دیپلوی دوباره</button>
          ${r.error ? `<div style="flex-basis:100%" class="muted" dir="ltr"><code style="font-size:11px">${a(String(r.error).slice(0, 180))}</code></div>` : ""}
        </div>`).join("")}
    </div>`;
  }

'''
sub1("  function NationalNetView(e) {", HELPERS + "  function NationalNetView(e) {", "helpers")

# ── 3. compute the auto card inside the view ─────────────────────────────────
sub1(
    "    let netlifyRewriteCode = natnetNetlifyRewriteToml(publicHost);",
    '''    if (natnetBridges === null) natnetLoadBridges();
    const autoCard = natnetAutoCardHtml(NATNET.bridgePlatform);

    let netlifyRewriteCode = natnetNetlifyRewriteToml(publicHost);''',
    "auto card variable",
)

# ── 4. third mode button + auto content (Vercel) ─────────────────────────────
sub1(
    '''        <button class="btn btn-sm ${NATNET.vercelMode === "rewrite" ? "btn-primary" : ""}" type="button" data-action="omni-natnet-vercel-mode" data-vmode="rewrite">''',
    '''        <button class="btn btn-sm ${NATNET.vercelMode === "auto" ? "btn-primary" : ""}" type="button" data-action="omni-natnet-vercel-mode" data-vmode="auto">
          🤖 متد ۰: خودکار با توکن (پیشنهادی)
        </button>
        <button class="btn btn-sm ${NATNET.vercelMode === "rewrite" ? "btn-primary" : ""}" type="button" data-action="omni-natnet-vercel-mode" data-vmode="rewrite">''',
    "vercel auto button",
)
sub1(
    '        ${NATNET.vercelMode === "rewrite" ? `',
    '        ${NATNET.vercelMode === "auto" ? autoCard : NATNET.vercelMode === "rewrite" ? `',
    "vercel auto content",
)

# ── 5. third mode button + auto content (Netlify) ────────────────────────────
sub1(
    '''        <button class="btn btn-sm ${NATNET.netlifyMode === "edge" ? "btn-primary" : ""}" type="button" data-action="omni-natnet-netlify-mode" data-nmode="edge">''',
    '''        <button class="btn btn-sm ${NATNET.netlifyMode === "auto" ? "btn-primary" : ""}" type="button" data-action="omni-natnet-netlify-mode" data-nmode="auto">
          🤖 متد ۰: خودکار با توکن (پیشنهادی)
        </button>
        <button class="btn btn-sm ${NATNET.netlifyMode === "edge" ? "btn-primary" : ""}" type="button" data-action="omni-natnet-netlify-mode" data-nmode="edge">''',
    "netlify auto button",
)
sub1(
    '        ${NATNET.netlifyMode === "edge" ? `',
    '        ${NATNET.netlifyMode === "auto" ? autoCard : NATNET.netlifyMode === "edge" ? `',
    "netlify auto content",
)

# ── 6. defaults: automatic first ─────────────────────────────────────────────
sub1(
    '    vercelMode: "rewrite", // "rewrite" | "relay" | "installer"',
    '    vercelMode: "auto", // "auto" | "rewrite" | "relay"',
    "vercelMode default",
)
sub1(
    '    netlifyMode: "rewrite", // "rewrite" | "edge"',
    '    netlifyMode: "auto", // "auto" | "edge" | "rewrite"',
    "netlifyMode default",
)

# ── 7. action branches ───────────────────────────────────────────────────────
ACTIONS = r'''        } else if (i === "omni-natnet-auto-deploy" || i === "omni-natnet-auto-redeploy") {
          let plat = s.dataset.plat || NATNET.bridgePlatform || "vercel";
          let bridgeId = Number(s.dataset.id || 0);
          let tokenInput = document.getElementById(`natnet-auto-token-${plat}`);
          let nameInput = document.getElementById(`natnet-auto-name-${plat}`);
          let targetInput = document.getElementById(`natnet-auto-target-${plat}`);
          if (tokenInput) NATNET[plat === "vercel" ? "vercelAutoToken" : "netlifyAutoToken"] = tokenInput.value.trim();
          if (nameInput) NATNET.autoName = nameInput.value.trim();
          if (targetInput && targetInput.value.trim()) NATNET.autoTarget = targetInput.value.trim();
          let token = NATNET[plat === "vercel" ? "vercelAutoToken" : "netlifyAutoToken"] || "";
          let target = NATNET.autoTarget || natnetBridgeCtx.target || (e.settings()?.public_host || window.location.hostname || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
          let out = document.getElementById(`natnet-auto-out-${plat}`);
          const paint = (html) => { if (out) out.innerHTML = html; };
          const spin = (msg) => paint(`<div class="skeleton" style="height:34px"></div><div class="muted" style="font-size:12px;margin-top:6px">${a(msg)}</div>`);
          if (!token && !bridgeId) {
            y("توکن API را وارد کن", "warn");
            if (tokenInput) tokenInput.focus();
            return;
          }
          if (!target) {
            y("آدرس ورکر مقصد پیدا نشد؛ دستی واردش کن", "warn");
            return;
          }
          NATNET.autoBusy = true;
          spin(`در حال ساخت پل ${plat} روی ${target} …`);
          try {
            let r = await b.post("/api/bridge", { platform: plat, token, name: NATNET.autoName || "", target, tunnel_path: natnetTunnelPath(e.settings?.()), id: bridgeId || undefined });
            let id = r.id || bridgeId;
            let row = null;
            let lastStatus = "";
            for (let k = 0; k < 60; k++) {
              await new Promise((res) => setTimeout(res, 2000));
              try {
                row = (await b.get(`/api/bridge/${id}`)).bridge;
              } catch (_) { row = null; }
              if (!row) continue;
              if (row.status !== lastStatus) {
                lastStatus = row.status;
                spin(row.status === "building" ? `پروژه ساخته شد، منتظر انتشار ${plat}…` : `وضعیت: ${row.status}`);
              }
              if (row.status === "ready" || row.status === "failed") break;
            }
            NATNET.autoBusy = false;
            if (!row) {
              paint(`<div class="toast err">وضعیت پل خوانده نشد؛ «🔄 به‌روزرسانی فهرست پل‌ها» را بزن.</div>`);
              return;
            }
            await natnetLoadBridges();
            if (row.status === "failed") {
              paint(`<div class="toast err">❌ ${a(row.error || "دیپلوی ناموفق")}</div>`);
              y("ساخت پل ناموفق بود", "err", 5200);
              e.rerenderView(l.view);
              return;
            }
            let dom = row.domain || "";
            if (plat === "vercel") NATNET.vercelDomain = dom; else NATNET.bridgeDomain = dom;
            NATNET[plat === "vercel" ? "vercelAutoToken" : "netlifyAutoToken"] = "";
            let host = `${plat === "vercel" ? "ورسل" : "نتلیفای"}`;
            paint(`<div class="badge ok">✅ پل ${host} زنده است · <b class="mono" dir="ltr">${a(dom)}</b></div>
              <div class="muted" style="font-size:12px;margin-top:6px">کانفیگ‌های پایین با همین دامنه از نو ساخته شدند. برای نصب، دکمهٔ 📲 کنار هر کانفیگ را بزن.</div>`);
            y(`پل ${host} ساخته شد: ${dom}`, "ok", 5200);
            e.rerenderView(l.view);
          } catch (err) {
            NATNET.autoBusy = false;
            paint(`<div class="toast err">${a(err?.message || String(err))}</div>`);
            A(err);
          }
        } else if (i === "omni-natnet-auto-verify") {
          let plat = s.dataset.plat || NATNET.bridgePlatform || "vercel";
          let tokenInput = document.getElementById(`natnet-auto-token-${plat}`);
          let token = (tokenInput?.value || "").trim();
          let out = document.getElementById(`natnet-auto-out-${plat}`);
          if (!token) return y("اول توکن را وارد کن", "warn");
          if (out) out.innerHTML = `<div class="skeleton" style="height:34px"></div>`;
          try {
            let r = await b.post("/api/bridge/verify", { platform: plat, token });
            NATNET[plat === "vercel" ? "vercelAutoToken" : "netlifyAutoToken"] = token;
            if (out) out.innerHTML = `<div class="badge ok">✅ توکن ${plat} معتبر است</div>
              <div class="muted" style="font-size:12px;margin-top:6px">حساب: <b>${a(r.account?.username || "")}</b>${r.account?.email ? ` · ${a(r.account.email)}` : ""}${r.account?.plan ? ` · پلن ${a(r.account.plan)}` : ""} — حالا «🚀 ساخت و دیپلوی خودکار» را بزن.</div>`;
          } catch (err) {
            if (out) out.innerHTML = `<div class="toast err">${a(err?.message || String(err))}</div>`;
          }
        } else if (i === "omni-natnet-auto-use") {
          let plat = s.dataset.plat || NATNET.bridgePlatform || "vercel";
          let dom = s.dataset.domain || "";
          if (!dom) return;
          if (plat === "vercel") NATNET.vercelDomain = dom; else NATNET.bridgeDomain = dom;
          y(`دامنهٔ ${dom} در همهٔ کانفیگ‌ها اعمال شد`, "ok");
          e.rerenderView(l.view);
        } else if (i === "omni-natnet-auto-refresh") {
          let out = document.getElementById(`natnet-auto-out-${NATNET.bridgePlatform}`);
          if (out) out.innerHTML = `<div class="skeleton" style="height:34px"></div>`;
          await natnetLoadBridges();
          e.rerenderView(l.view);
          y("فهرست پل‌ها به‌روز شد", "ok");
        } else if (i === "omni-natnet-dl-vercel-zip") {'''
sub1(
    '        } else if (i === "omni-natnet-dl-vercel-zip") {',
    ACTIONS,
    "action branches",
)

# ── 8. keep the typed token across rerenders ─────────────────────────────────
sub1(
    '    document.addEventListener("change", (t) => {\n      let s = t.target;\n      if (s.id === "natnet-user") {',
    '''    document.addEventListener("input", (t) => {
      let s = t.target;
      if (!s || !s.id) return;
      if (s.id === "natnet-auto-token-vercel") NATNET.vercelAutoToken = s.value.trim();
      else if (s.id === "natnet-auto-token-netlify") NATNET.netlifyAutoToken = s.value.trim();
      else if (s.id === "natnet-auto-name-vercel" || s.id === "natnet-auto-name-netlify") NATNET.autoName = s.value.trim();
      else if (s.id === "natnet-auto-target-vercel" || s.id === "natnet-auto-target-netlify") NATNET.autoTarget = s.value.trim();
    });
    document.addEventListener("change", (t) => {
      let s = t.target;
      if (s.id === "natnet-user") {''',
    "input listener",
)

PANEL.write_text(s, encoding="utf-8")
print("production/panel.html patched: %d -> %d chars (+%d)" % (orig, len(s), len(s) - orig))
