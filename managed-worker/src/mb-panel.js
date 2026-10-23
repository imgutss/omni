/* =========================================================================
 * OMNI · Managed Bot-Hosting panel controller (omniMb*)
 * Rebuilt from scratch — same self-contained architecture as omniRw/omniAo:
 * own scoped styles, own state, own polling, data-mb action delegation.
 * ========================================================================= */
let omniMbJobs = [], omniMbAccounts = null, omniMbPollTimer = 0, omniMbBusy = false;
const omniMbStageList = [["verify", "بررسی کلیدها"], ["deploy", "ساخت رله"], ["dns", "دامنه و آروان"], ["check", "تست نهایی"], ["ready", "آماده"]];
function omniMbStageIndex(st) {
  if (st === "ready") return omniMbStageList.length - 1;
  if (st === "disabled") return -1;
  const i = omniMbStageList.findIndex((x) => x[0] === st);
  return i < 0 ? 0 : i;
}
function omniMbStatusFa(st) {
  if (st === "ready") return "آماده";
  if (st === "disabled") return "متوقف";
  if (st === "failed") return "نیاز به بررسی";
  const hit = omniMbStageList.find((x) => x[0] === st);
  return hit ? hit[1] : st;
}
function omniMbCardHtml() {
  setTimeout(() => omniMbRefresh().catch(() => {}), 0);
  return `<section class="mb-auto" aria-labelledby="mb-auto-title"><style>
.mb-auto{--mb-accent:#22c55e;border:1px solid #22c55e55;border-radius:20px;background:linear-gradient(145deg,#0c1a1288,#090c1588);padding:22px;margin:16px 0;color:var(--text,#eef2fa)}
.mb-auto *{box-sizing:border-box}
.mb-auto h3{margin:0 0 8px;font-size:20px}
.mb-auto p{line-height:1.9}
.mb-auto .mb-muted{color:var(--text-dim,#aeb3c3);font-size:13px}
.mb-auto .mb-tag{display:inline-block;border:1px solid #22c55e55;color:var(--mb-accent);border-radius:999px;padding:4px 12px;font-size:12px;background:#22c55e14}
.mb-auto label{display:block;font-size:12.5px;font-weight:700;margin:12px 0 6px;color:var(--text,#eef2fa)}
.mb-auto input,.mb-auto select{width:100%;min-height:44px;border-radius:12px;border:1px solid var(--border,#263044);background:#0d141c;color:inherit;padding:10px 12px}
.mb-auto .mb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.mb-auto .mb-btn{min-height:44px;border-radius:12px;border:1px solid #22c55e66;background:transparent;color:var(--mb-accent);padding:9px 16px;font-weight:700;cursor:pointer;margin:8px 6px 0 0}
.mb-auto .mb-btn:hover{background:#22c55e1c}
.mb-auto .mb-btn.mb-primary{background:var(--mb-accent);color:#06110b}
.mb-auto .mb-btn.mb-danger{border-color:#fb718566;color:#fb7185}
.mb-auto .mb-btn.mb-danger:hover{background:#fb71851c}
.mb-auto .mb-btn:disabled{opacity:.55;cursor:wait}
.mb-auto .mb-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}
.mb-auto .mb-job{border:1px solid var(--border,#263044);border-radius:16px;padding:16px;margin-top:14px;background:#0b121a99}
.mb-auto .mb-job h4{margin:0;font-size:15px}
.mb-auto .mb-track{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:12px 0}
.mb-auto .mb-track span{height:7px;border-radius:99px;background:#1e293b}
.mb-auto .mb-track span.mb-done{background:#22c55e}
.mb-auto .mb-track span.mb-current{background:#86efac;box-shadow:0 0 12px #22c55e88}
.mb-auto .mb-err{color:#fb7185;font-size:12.5px;margin:8px 0 0}
.mb-auto .mb-ok{color:#34d399}
.mb-auto textarea{width:100%;min-height:150px;border-radius:12px;border:1px solid var(--border,#263044);background:#0d141c;color:inherit;padding:10px 12px;font-family:var(--mono,monospace);font-size:12px;direction:ltr;text-align:left}
.mb-auto .mb-note{font-size:12px;color:var(--text-faint,#69748c);margin-top:14px;line-height:2}
.mb-auto code{direction:ltr;unicode-bidi:isolate}
</style>
<span class="mb-tag">bot-hosting روی حساب خود شما + آروان</span>
<h3 id="mb-auto-title" style="margin-top:12px">🟢 رلهٔ bot-hosting خودکار — نسخهٔ بازسازی‌شده</h3>
<p class="mb-muted">کلید bot-hosting (<code>bhk_</code>) و کلید API آروان را وارد کن؛ ساخت رله، اتصال دامنهٔ آروان، رکوردهای DNS و تست نهایی کاملاً خودکار و مرحله‌ای انجام می‌شود — همان معماری بخش «آروان خودکار». رکوردهایی که این پنل می‌سازد جایی ثبت می‌شود و فقط همان‌ها در حذف، پاک می‌شوند.</p>
<div class="mb-grid">
  <div><label for="mb-bhk">کلید bot-hosting</label><input id="mb-bhk" type="password" dir="ltr" autocomplete="off" placeholder="bhk_..."><p class="mb-muted"><a href="https://bot-hosting.net/account" target="_blank" rel="noopener noreferrer">دریافت کلید از حساب bot-hosting</a></p></div>
  <div><label for="mb-arvan">کلید API آروان</label><input id="mb-arvan" type="password" dir="ltr" autocomplete="off" placeholder="Apikey"><p class="mb-muted"><a href="https://panel.arvancloud.ir/profile/api-keys" target="_blank" rel="noopener noreferrer">ساخت Machine User API Key</a></p></div>
</div>
<div class="mb-row"><button class="mb-btn" type="button" data-mb="accounts">بررسی کلیدها و دریافت دامنه‌ها</button></div>
<div id="mb-domain-fields" hidden style="margin-top:16px">
  <div class="mb-grid">
    <div><label for="mb-zone">دامنهٔ فعال در آروان</label><select id="mb-zone"></select></div>
    <div><label for="mb-label">نام زیردامنه</label><input id="mb-label" dir="ltr" value="relay" maxlength="40" placeholder="relay"></div>
    <div><label>نشانی رلهٔ شما</label><p id="mb-domain-preview" aria-live="polite" class="mb-tag" style="margin-top:8px">—</p><p class="mb-muted">ورکر مقصد و مسیر تونل خودکار از همین پنل گرفته می‌شود.</p></div>
  </div>
  <div class="mb-row"><button class="mb-btn mb-primary" type="button" data-mb="create">ساخت خودکار رله و اتصال دامنه</button></div>
</div>
<p id="mb-message" role="status" aria-live="polite" class="mb-muted"></p>
<div id="mb-jobs"></div>
<div class="mb-row"><button type="button" class="mb-btn" data-mb="refresh">به‌روزرسانی وضعیت</button></div>
<p class="mb-note">توکن‌ها فقط برای ادامهٔ همین نصب، حداکثر ۲۴ ساعت در جدول موقت همین پنل نگه‌داری و پس از آماده‌شدن کامل پاک می‌شوند. پلن رایگان bot-hosting فقط یک اسلات دارد؛ اگر دیپلوی ناقص قبلی باشد همان پذیرفته و بازسازی می‌شود و دیپلوی جدیدی ساخته نمی‌شود. اگر کلیدها منقضی شدند، کافی است دوباره در همان کارت وارد و «ادامه» را بزنی.</p>
</section>`;
}
async function omniMbFetch(path, body) {
  const r = await fetch("/api/managed-bothost/" + path, {
    method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    headers: { "content-type": "application/json", "x-omni-csrf": "1" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw Error(j.error || "عملیات کامل نشد.");
  return j;
}
function omniMbMessage(msg, err) {
  const el = document.getElementById("mb-message");
  if (el) { el.textContent = msg || ""; el.className = err ? "mb-err" : "mb-muted"; }
}
function omniMbPreview() {
  const zone = document.getElementById("mb-zone") ? document.getElementById("mb-zone").value : "";
  const label = document.getElementById("mb-label") ? document.getElementById("mb-label").value.trim().toLowerCase() : "";
  const el = document.getElementById("mb-domain-preview");
  if (el) el.textContent = zone && label ? label + "." + zone : "—";
}
function omniMbRender() {
  const el = document.getElementById("mb-jobs");
  if (!el) return;
  if (!omniMbJobs.length) { el.innerHTML = '<p class="mb-muted">هنوز رله‌ای ساخته نشده؛ اول کلیدها را بررسی کن.</p>'; return; }
  el.innerHTML = omniMbJobs.map((job) => {
    const ready = job.status === "ready", disabled = job.status === "disabled";
    const idx = omniMbStageIndex(job.status);
    const tag = disabled ? '<span class="mb-tag" style="border-color:#fbbf2466;color:#fbbf24;background:#fbbf2414">' + a(omniMbStatusFa(job.status)) + "</span>"
      : '<span class="mb-tag' + (ready ? " mb-ok" : "") + '">' + a(omniMbStatusFa(job.status)) + "</span>";
    const track = disabled ? "" : '<div class="mb-track" aria-label="' + a(omniMbStatusFa(job.status)) + '">' +
      omniMbStageList.map((_, i) => '<span class="' + (ready || i < idx ? "mb-done" : i === idx ? "mb-current" : "") + '"></span>').join("") + "</div>";
    const tokens = job.needs_token ? '<div class="mb-grid" style="margin-top:10px"><div><label>کلید bot-hosting (دوباره وارد کن)</label><input id="mb-bhk-' + a(job.id) + '" type="password" dir="ltr" placeholder="bhk_..."></div><div><label>کلید آروان (دوباره وارد کن)</label><input id="mb-arv-' + a(job.id) + '" type="password" dir="ltr" placeholder="Apikey"></div></div>' : "";
    const actions = [];
    if (ready) actions.push('<button class="mb-btn" type="button" data-mb="configs" data-job="' + a(job.id) + '">دریافت کانفیگ کاربران</button>');
    if (ready || disabled) actions.push('<button class="mb-btn" type="button" data-mb="' + (disabled ? "enable" : "disable") + '" data-job="' + a(job.id) + '">' + (disabled ? "روشن کردن رله" : "خاموش کردن رله") + "</button>");
    if (!ready && !disabled) actions.push('<button class="mb-btn mb-primary" type="button" data-mb="step" data-job="' + a(job.id) + '">ادامهٔ همین نصب</button>');
    actions.push('<button class="mb-btn mb-danger" type="button" data-mb="delete" data-job="' + a(job.id) + '" data-domain="' + a(job.domain) + '">حذف کامل</button>');
    const meta = '<p class="mb-muted" style="margin:8px 0 0">دامنه: <code>' + a(job.domain) + "</code>" +
      (job.node_host ? ' · نود: <code>' + a(job.node_host) + (job.node_port ? ":" + a(job.node_port) : "") + "</code>" : "") +
      (job.edge_ip ? ' · آی‌پی لبه: <code>' + a(job.edge_ip) + "</code>" : "") +
      '<br>ورکر مقصد: <code>' + a(job.target) + "</code> · مسیر: <code>" + a(job.path) + "</code></p>";
    return '<article class="mb-job"><div class="mb-row" style="justify-content:space-between;margin:0"><h4 dir="ltr">' + a(job.domain) + "</h4>" + tag + "</div>" +
      track +
      (job.error ? '<p class="mb-err">' + a(job.error) + "</p>" : '<p class="mb-muted">مراحل به‌صورت خودکار پیگیری می‌شوند؛ با بازبودن صفحه نیازی به کاری نیست.</p>') +
      tokens + meta +
      '<div class="mb-row">' + actions.join("") + '</div><div id="mb-configs-' + a(job.id) + '"></div></article>';
  }).join("");
}
async function omniMbRefresh() {
  const j = await omniMbFetch("jobs");
  omniMbJobs = j.jobs || [];
  omniMbRender();
  if (omniMbJobs.some((x) => !["ready", "disabled", "failed"].includes(x.status))) omniMbSchedule();
}
function omniMbSchedule() {
  clearTimeout(omniMbPollTimer);
  omniMbPollTimer = setTimeout(omniMbTick, 9000);
}
async function omniMbTick() {
  if (omniMbBusy) { omniMbSchedule(); return; }
  omniMbBusy = true;
  try {
    const job = omniMbJobs.find((x) => !["ready", "disabled", "failed"].includes(x.status));
    if (job) {
      const r = await omniMbFetch("jobs/" + job.id + "/step", {});
      omniMbJobs = omniMbJobs.map((x) => x.id === job.id ? r.job : x);
      omniMbRender();
      if (r.job.status === "ready") { omniMbMessage("نصب کامل شد؛ کانفیگ کاربران آماده است."); try { if (typeof natnetLoadBridges === "function") { natnetBridges = null; natnetLoadBridges(); } } catch (e) {} }
    }
  } catch (e) { omniMbMessage(e.message, true); }
  finally { omniMbBusy = false; if (document.getElementById("mb-jobs") && omniMbJobs.some((x) => !["ready", "disabled", "failed"].includes(x.status))) omniMbSchedule(); }
}
if (!globalThis.__omniMbBound) {
  globalThis.__omniMbBound = true;
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-mb]");
    if (!button) return;
    const op = button.dataset.mb;
    button.disabled = true;
    try {
      if (op === "accounts") {
        omniMbMessage("در حال بررسی حساب bot-hosting و دامنه‌های آروان…");
        const bhk = document.getElementById("mb-bhk").value.trim();
        const arvan = document.getElementById("mb-arvan").value.trim();
        omniMbAccounts = await omniMbFetch("accounts", { bhk_token: bhk, arvan_token: arvan });
        const z = document.getElementById("mb-zone");
        z.innerHTML = omniMbAccounts.zones.map((x) => '<option value="' + a(x.name) + '">' + a(x.name) + "</option>").join("");
        document.getElementById("mb-domain-fields").hidden = !omniMbAccounts.zones.length;
        omniMbPreview();
        const quota = omniMbAccounts.bhk && omniMbAccounts.bhk.quota;
        omniMbMessage(omniMbAccounts.zones.length ? ("حساب‌ها تأیید شدند" + (quota ? " · ظرفیت: " + a(JSON.stringify(quota)) : "") + " · دیپلوی‌های موجود: " + (omniMbAccounts.deployments || []).length) : "دامنهٔ فعالی در آروان پیدا نشد.");
      } else if (op === "create") {
        if (!omniMbAccounts) throw Error("ابتدا کلیدها را بررسی کن.");
        const bhk = document.getElementById("mb-bhk").value.trim();
        const arvan = document.getElementById("mb-arvan").value.trim();
        const zone = document.getElementById("mb-zone").value;
        const label = document.getElementById("mb-label").value.trim().toLowerCase();
        if (!label) throw Error("نام زیردامنه را وارد کن.");
        omniMbMessage("در حال ثبت کار و شروع ساخت خودکار…");
        const r = await omniMbFetch("jobs", { bhk_token: bhk, arvan_token: arvan, zone, label });
        document.getElementById("mb-bhk").value = "";
        document.getElementById("mb-arvan").value = "";
        document.getElementById("mb-domain-fields").hidden = true;
        omniMbAccounts = null;
        await omniMbRefresh();
        omniMbSchedule();
        omniMbMessage("ثبت شد؛ مراحل ساخت به‌صورت خودکار پیگیری می‌شوند.");
        void r;
      } else if (op === "refresh") {
        await omniMbRefresh();
      } else if (op === "step") {
        const bhkEl = document.getElementById("mb-bhk-" + button.dataset.job);
        const arvEl = document.getElementById("mb-arv-" + button.dataset.job);
        const r = await omniMbFetch("jobs/" + button.dataset.job + "/step", {
          bhk_token: bhkEl ? bhkEl.value.trim() : "",
          arvan_token: arvEl ? arvEl.value.trim() : ""
        });
        omniMbJobs = omniMbJobs.map((x) => x.id === button.dataset.job ? r.job : x);
        omniMbRender();
        omniMbSchedule();
      } else if (op === "disable" || op === "enable") {
        const bhkEl = document.getElementById("mb-bhk-" + button.dataset.job);
        const arvEl = document.getElementById("mb-arv-" + button.dataset.job);
        const r = await omniMbFetch("jobs/" + button.dataset.job + "/" + op, {
          bhk_token: bhkEl ? bhkEl.value.trim() : "",
          arvan_token: arvEl ? arvEl.value.trim() : ""
        });
        omniMbJobs = omniMbJobs.map((x) => x.id === button.dataset.job ? r.job : x);
        omniMbRender();
      } else if (op === "delete") {
        if (!confirm("رلهٔ " + (button.dataset.domain || "") + " کامل حذف شود؟ دیپلوی Bot-Hosting و فقط رکوردهای DNS ساخته‌شده توسط همین پنل پاک می‌شوند.")) return;
        const delBody = {};
        const job = omniMbJobs.find((x) => x.id === button.dataset.job);
        if (job && ["ready", "disabled"].includes(job.status)) {
          // Tokens are purged after readiness; re-collect them for external cleanup.
          const bhk = prompt("برای حذف دیپلوی، کلید bot-hosting (bhk_) را وارد کن، یا خالی بگذار تا فقط رکورد پنل حذف شود:");
          if (bhk === null) return;
          const arv = prompt("برای پاک کردن رکوردهای DNS آروان، کلید API آروان را وارد کن، یا خالی بگذار:");
          if (arv === null) return;
          delBody.bhk_token = bhk.trim();
          delBody.arvan_token = arv.trim();
        }
        const r = await fetch("/api/managed-bothost/jobs/" + button.dataset.job, {
          method: "DELETE", credentials: "same-origin", cache: "no-store",
          headers: { "content-type": "application/json", "x-omni-csrf": "1" },
          body: JSON.stringify(delBody)
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw Error(j.error || "حذف کامل نشد.");
        omniMbJobs = omniMbJobs.filter((x) => x.id !== button.dataset.job);
        omniMbRender();
        omniMbMessage((j.warnings && j.warnings.length) ? ("حذف شد؛ با این حال: " + j.warnings.join(" ")) : "حذف شد.");
      } else if (op === "configs") {
        const job = omniMbJobs.find((x) => x.id === button.dataset.job);
        if (!job || job.status !== "ready") return;
        const box = document.getElementById("mb-configs-" + job.id);
        box.innerHTML = '<p class="mb-muted">در حال تولید کانفیگ همهٔ کاربران…</p>';
        const r = await fetch("/api/managed-bothost/jobs/" + job.id + "/configs", { credentials: "same-origin", cache: "no-store" });
        const j = await r.json();
        if (!r.ok || !j.ok) throw Error(j.error || "کانفیگ‌ها آماده نشد.");
        const all = [];
        box.innerHTML = j.users.map((u) => {
          const text = u.lines.map((ln) => ln.uri).join("\n");
          all.push("# " + u.username + "\n" + text);
          return '<div style="margin-top:12px"><b dir="rtl">👤 ' + a(u.username) + '</b> <code class="mb-muted">' + a(u.uuid.slice(0, 8)) + "…</code>" +
            '<textarea readonly dir="ltr" id="mb-cfg-' + a(job.id) + "-" + a(u.username) + '">' + a(text) + "</textarea>" +
            '<div class="mb-row"><button class="mb-btn" type="button" data-mb="copy-one" data-target="mb-cfg-' + a(job.id) + "-" + a(u.username) + '">کپی کانفیگ این کاربر</button></div></div>';
        }).join("") +
          '<div class="mb-row"><button class="mb-btn mb-primary" type="button" data-mb="copy-all" data-job="' + a(job.id) + '">کپی یکجای همهٔ کاربران</button></div>' +
          '<textarea hidden id="mb-cfg-all-' + a(job.id) + '">' + a(all.join("\n\n")) + "</textarea>";
      } else if (op === "copy-one" || op === "copy-all") {
        const el = document.getElementById(button.dataset.target || ("mb-cfg-all-" + button.dataset.job));
        if (!el) return;
        try { await navigator.clipboard.writeText(el.value); omniMbMessage("کانفیگ‌ها کپی شدند؛ در برنامه Import from clipboard را بزن."); }
        catch (e) { el.hidden = false; el.focus(); el.select(); omniMbMessage("متن انتخاب شد؛ کپی‌اش کن."); }
      }
    } catch (e) {
      omniMbMessage(e.message, true);
    } finally {
      button.disabled = false;
    }
  });
  document.addEventListener("input", (ev) => {
    if (ev.target && (ev.target.id === "mb-zone" || ev.target.id === "mb-label")) omniMbPreview();
  });
}
