/* =========================================================================
 * OMNI · independent Vercel relay panel (section 6)
 * Own card, API, project records, config generation and deletion. Each user
 * discovers their own Bot-Hosting relay with a transient API key; no Arvan/job mutation.
 * ========================================================================= */
var omniVercelRelays = [];
var omniVercelSources = [];
var omniVercelBound = false;
var omniVercelRefreshing = false;
var omniVercelSelectedSource = "";

function omniVercelEscape(value) {
  return typeof a === "function" ? a(String(value == null ? "" : value)) : String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
}
function omniVercelMessage(text, error) {
  const el = document.getElementById("ov-message");
  if (!el) return;
  el.textContent = String(text || "");
  el.style.color = error ? "var(--danger)" : "var(--ok)";
}
async function omniVercelApi(path, body) {
  const options = { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store" };
  if (body !== undefined) {
    options.headers = { "content-type": "application/json", "x-omni-csrf": "1" };
    options.body = JSON.stringify(body);
  }
  const response = await fetch("/api/vercel-relays" + path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw Error(data.error || "درخواست رلهٔ مستقل Vercel ناموفق بود.");
  return data;
}
function omniVercelSourceById(id) {
  return omniVercelSources.find((item) => String(item.id) === String(id)) || null;
}
function omniVercelSourceOptions() {
  const projects = omniVercelSources.filter((item) => item && item.id && item.apps_host && item.path);
  if (!projects.length) return '<option value="">اول کلید Bot-Hosting خودت را بررسی کن</option>';
  return '<option value="">انتخاب پروژهٔ خودت از Bot-Hosting…</option>' + projects.map((item) =>
    '<option value="' + omniVercelEscape(item.id) + '"' + (String(item.id) === omniVercelSelectedSource ? " selected" : "") + '>' +
    omniVercelEscape(item.name || item.id) + ' · ' + omniVercelEscape(item.apps_host) + '</option>'
  ).join("");
}
function omniVercelUpdateTargetPreview() {
  const select = document.getElementById("ov-source");
  const preview = document.getElementById("ov-target-preview");
  if (!select || !preview) return;
  omniVercelSelectedSource = select.value || "";
  const source = omniVercelSourceById(omniVercelSelectedSource);
  preview.textContent = source ? "پروژهٔ انتخابی: wss://" + source.apps_host + source.path + " · رلهٔ Bot-Hosting فقط خوانده می‌شود و تغییر یا حذف نمی‌شود." : "بعد از بررسی کلید، پروژه‌های قابل‌استفادهٔ همان حساب در این فهرست می‌آیند.";
}
function omniVercelRender() {
  const list = document.getElementById("ov-relays");
  if (!list) return;
  if (!omniVercelRelays.length) {
    list.innerHTML = '<p class="muted" style="margin:10px 0">هنوز رلهٔ Vercel مستقلی ساخته نشده است.</p>';
    return;
  }
  list.innerHTML = omniVercelRelays.map((relay) => {
    const id = omniVercelEscape(relay.id);
    return '<article class="card" style="margin-top:12px;padding:14px;border-inline-start:3px solid #818cf8">' +
      '<div class="card-head"><b dir="ltr">' + omniVercelEscape(relay.label || relay.domain) + '</b><span class="badge ok">Vercel متصل</span></div>' +
      '<p class="muted" style="font-size:12px;line-height:1.8">دامنه: <a href="https://' + omniVercelEscape(relay.domain) + '" target="_blank" rel="noopener noreferrer"><code dir="ltr">' + omniVercelEscape(relay.domain) + '</code></a>' +
      ' · پروژه: <code dir="ltr">' + omniVercelEscape(relay.project_name) + '</code><br>مبدأ انتخاب‌شده: <code dir="ltr">' + omniVercelEscape(relay.source_domain) + '</code>' +
      ' · Upstream: <code dir="ltr">' + omniVercelEscape(relay.target_host + relay.target_path) + '</code></p>' +
      '<div class="ov-status muted" id="ov-status-' + id + '" aria-live="polite"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
      '<button class="btn btn-sm" type="button" data-ov="configs" data-id="' + id + '">دریافت کانفیگ کاربران</button>' +
      '<button class="btn btn-sm" type="button" data-ov="ping" data-id="' + id + '">پینگ از همین مرورگر</button>' +
      '<button class="btn btn-sm" type="button" data-ov="delete" data-id="' + id + '" style="color:var(--danger)">حذف پروژهٔ Vercel</button>' +
      '</div><div id="ov-configs-' + id + '"></div></article>';
  }).join("");
}
async function omniVercelRefresh() {
  if (omniVercelRefreshing) return;
  omniVercelRefreshing = true;
  try {
    const relayResult = await omniVercelApi("");
    omniVercelRelays = relayResult.relays || [];
    omniVercelRender();
  } catch (error) {
    omniVercelMessage(error && error.message || error, true);
  } finally { omniVercelRefreshing = false; }
}
async function omniVercelBrowserPing(domain) {
  const d = String(domain || "").trim().toLowerCase();
  if (!/^(?:[a-z0-9-]+\.)+vercel\.app$/.test(d)) throw Error("دامنهٔ Vercel معتبر نیست.");
  const samples = await Promise.all([0, 1, 2, 3].map(async (index) => {
    const started = performance.now();
    try {
      const response = await fetch("https://" + d + "/_omni-health?probe=" + Date.now() + "-" + index, {
        mode: "cors", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(10000)
      });
      const text = await response.text();
      const ms = Math.round(performance.now() - started);
      const ok = response.status === 200 && response.headers.get("x-omni-relay") === "healthy" && text.includes("Omni Vercel WebSocket relay is online");
      return { ok, ms, error: ok ? "" : "HTTP " + response.status };
    } catch (error) {
      return { ok: false, ms: Math.round(performance.now() - started), error: String(error && error.message || error).slice(0, 100) };
    }
  }));
  const values = samples.filter((sample) => sample.ok).map((sample) => sample.ms).sort((x, y) => x - y);
  if (!values.length) throw Error("هر چهار سنجش ناموفق بود: " + String(samples[0].error || "بدون پاسخ"));
  const median = values.length % 2 ? values[(values.length - 1) / 2] : Math.round((values[values.length / 2 - 1] + values[values.length / 2]) / 2);
  return { success: values.length, total: samples.length, median, min: values[0], max: values[values.length - 1] };
}
function omniVercelCardHtml() {
  if (!omniVercelBound) {
    omniVercelBound = true;
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-ov]");
      if (!button) return;
      const action = button.dataset.ov;
      const id = button.dataset.id || "";
      button.disabled = true;
      try {
        if (action === "discover") {
          const bhk = document.getElementById("ov-bhk-token")?.value.trim() || "";
          const vercelToken = document.getElementById("ov-token")?.value.trim() || "";
          if (!bhk) throw Error("کلید Bot-Hosting خودت را وارد کن.");
          if (!vercelToken) throw Error("توکن Vercel خودت را هم وارد کن تا هر دو کلید بررسی شوند.");
          omniVercelSources = [];
          omniVercelSelectedSource = "";
          const select = document.getElementById("ov-source");
          const accountBox = document.getElementById("ov-account");
          if (select) { select.disabled = true; select.innerHTML = omniVercelSourceOptions(); }
          if (accountBox) accountBox.textContent = "در حال بررسی هر دو کلید و جست‌وجوی پروژه‌های همین حساب…";
          omniVercelMessage("در حال اعتبارسنجی کلیدهای Bot-Hosting و Vercel و پیدا کردن رله‌های آماده…");
          const result = await omniVercelApi("/discover", { bhk_token: bhk, vercel_token: vercelToken });
          omniVercelSources = result.deployments || [];
          if (accountBox) {
            const botUser = result.account?.username ? "Bot-Hosting: " + result.account.username : "Bot-Hosting تأیید شد";
            const vercelUser = result.vercel_account?.username ? "Vercel: " + result.vercel_account.username : "Vercel تأیید شد";
            accountBox.textContent = botUser + " · " + vercelUser + " · " + (result.deployments || []).length + " رلهٔ قابل‌استفاده پیدا شد" + (result.skipped ? " · " + result.skipped + " پروژه مسیر WebSocket قابل‌تشخیص نداشت" : "") + (result.truncated ? " · فهرست برای سرعت محدود شده است" : "");
          }
          if (select) {
            select.innerHTML = omniVercelSourceOptions();
            select.disabled = !omniVercelSources.length;
          }
          omniVercelUpdateTargetPreview();
          if (!omniVercelSources.length) throw Error(result.skipped ? "کلید تأیید شد، اما مسیر خصوصی رله پیدا نشد؛ کلید باید مجوز files:read داشته باشد یا پروژه با رلهٔ Omni ساخته شده باشد." : "کلید تأیید شد، اما رلهٔ آماده‌ای در حساب Bot-Hosting پیدا نشد.");
          omniVercelMessage("کلید تأیید شد؛ پروژه‌های خودت پیدا شدند. یکی را انتخاب کن و سپس Vercel را بساز.");
        } else if (action === "create") {
          const sourceId = document.getElementById("ov-source")?.value || "";
          const bhk = document.getElementById("ov-bhk-token")?.value.trim() || "";
          const token = document.getElementById("ov-token")?.value.trim() || "";
          const label = document.getElementById("ov-label")?.value.trim() || "";
          if (!sourceId) throw Error("ابتدا کلید Bot-Hosting را بررسی و پروژهٔ خودت را انتخاب کن.");
          if (!bhk) throw Error("کلید Bot-Hosting را دوباره وارد کن.");
          if (!token) throw Error("توکن Vercel را وارد کن.");
          omniVercelMessage("در حال تأیید دوبارهٔ پروژهٔ Bot-Hosting و ساخت رلهٔ Vercel برای همین حساب…");
          await omniVercelApi("", { source_deployment_id: sourceId, bhk_token: bhk, vercel_token: token, label });
          const tokenInput = document.getElementById("ov-token");
          const bhkInput = document.getElementById("ov-bhk-token");
          if (tokenInput) tokenInput.value = "";
          if (bhkInput) bhkInput.value = "";
          omniVercelSources = [];
          omniVercelSelectedSource = "";
          const select = document.getElementById("ov-source");
          if (select) { select.innerHTML = omniVercelSourceOptions(); select.disabled = true; }
          const accountBox = document.getElementById("ov-account");
          if (accountBox) accountBox.textContent = "برای ساخت بعدی، کلید Bot-Hosting همان حساب را دوباره بررسی کن.";
          await omniVercelRefresh();
          omniVercelMessage("رلهٔ Vercel برای پروژهٔ پیدا‌شده در Bot-Hosting ساخته شد؛ توکن‌ها ذخیره نشدند و پروژهٔ مبدأ تغییر نکرد.");
        } else if (action === "refresh") {
          await omniVercelRefresh();
        } else if (action === "ping") {
          const relay = omniVercelRelays.find((item) => String(item.id) === id);
          if (!relay) throw Error("رله پیدا نشد.");
          const status = document.getElementById("ov-status-" + id);
          if (status) status.textContent = "در حال سنجش چهار نمونه از همین مرورگر…";
          const result = await omniVercelBrowserPing(relay.domain);
          const summary = "پاسخ سالم · میانه " + result.median + " ms · کمینه " + result.min + " ms · بیشینه " + result.max + " ms · موفق " + result.success + "/" + result.total;
          if (status) status.textContent = summary;
          omniVercelMessage(summary);
        } else if (action === "configs") {
          const result = await omniVercelApi("/" + encodeURIComponent(id) + "/configs");
          const box = document.getElementById("ov-configs-" + id);
          if (!box) return;
          const all = [];
          box.innerHTML = (result.users || []).map((user, index) => {
            const text = (user.lines || []).map((line) => line.uri).join("\n");
            all.push("# " + user.username + "\n" + text);
            const target = "ov-config-" + id + "-" + index;
            return '<div style="margin-top:10px"><b>👤 ' + omniVercelEscape(user.username) + '</b><textarea id="' + target + '" readonly dir="ltr" style="display:block;width:100%;min-height:78px;margin-top:6px">' + omniVercelEscape(text) + '</textarea>' +
              '<button class="btn btn-sm" type="button" data-ov="copy-one" data-target="' + target + '">کپی کانفیگ</button></div>';
          }).join("") + '<textarea id="ov-config-all-' + id + '" hidden>' + omniVercelEscape(all.join("\n\n")) + '</textarea>' +
            '<button class="btn btn-sm" type="button" data-ov="copy-all" data-id="' + id + '">کپی همهٔ کاربران</button>';
          if (!(result.users || []).length) box.innerHTML = '<p class="muted">کاربر فعال دارای UUID پیدا نشد.</p>';
        } else if (action === "copy-one" || action === "copy-all") {
          const element = document.getElementById(button.dataset.target || ("ov-config-all-" + id));
          if (!element) return;
          try { await navigator.clipboard.writeText(element.value); omniVercelMessage("کانفیگ کپی شد."); }
          catch (_) { element.hidden = false; element.focus(); element.select(); omniVercelMessage("متن انتخاب شد؛ کپی‌اش کن."); }
        } else if (action === "delete") {
          if (!confirm("فقط پروژهٔ Vercel حذف شود؟ پروژهٔ انتخاب‌شده در Bot-Hosting تغییر نمی‌کند.")) return;
          const token = document.getElementById("ov-token")?.value.trim() || "";
          if (!token) throw Error("برای حذف، توکن Vercel را وارد کن.");
          await omniVercelApi("/" + encodeURIComponent(id) + "/delete", { vercel_token: token });
          const tokenInput = document.getElementById("ov-token");
          if (tokenInput) tokenInput.value = "";
          await omniVercelRefresh();
          omniVercelMessage("فقط پروژهٔ Vercel حذف شد؛ upstream مستقل و دست‌نخورده است.");
        }
      } catch (error) {
        omniVercelMessage(error && error.message || error, true);
      } finally { button.disabled = false; }
    });
    document.addEventListener("change", (event) => {
      if (event.target && event.target.id === "ov-source") omniVercelUpdateTargetPreview();
    });
    document.addEventListener("input", (event) => {
      if (!event.target || event.target.id !== "ov-bhk-token") return;
      omniVercelSources = [];
      omniVercelSelectedSource = "";
      const select = document.getElementById("ov-source");
      if (select) { select.disabled = true; select.innerHTML = omniVercelSourceOptions(); }
      const accountBox = document.getElementById("ov-account");
      if (accountBox) accountBox.textContent = "کلید را بررسی کن تا پروژه‌های همان حساب نمایش داده شوند.";
      omniVercelUpdateTargetPreview();
    });
  }
  setTimeout(() => { if (document.getElementById("ov-relays")) omniVercelRefresh(); }, 0);
  return '<div class="card" style="margin-top:12px;padding:16px;border-inline-start:4px solid #818cf8">' +
    '<div class="card-head"><b style="color:#818cf8;font-size:15px">🟣 بخش ۶: رلهٔ مستقل Vercel WebSocket</b><span class="badge info">تنظیمات هر کاربر</span></div>' +
    '<p class="muted" style="font-size:12.5px;line-height:1.9">کلید Bot-Hosting خودت را وارد و بررسی کن؛ پنل پروژه‌های همان حساب را پیدا می‌کند. سپس توکن Vercel خودت را بده تا پل و کانفیگ ساخته شود. هر دو کلید فقط برای همان درخواست استفاده می‌شوند و ذخیره نمی‌شوند. پروژهٔ Bot-Hosting فقط خوانده می‌شود؛ حذف یا تغییر نمی‌کند.</p>' +
    '<div style="margin-top:12px"><label for="ov-bhk-token">کلید API خودت در Bot-Hosting (ذخیره نمی‌شود)</label><input id="ov-bhk-token" class="input" type="password" dir="ltr" autocomplete="off" placeholder="bhk_…" style="width:100%">' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn btn-sm" type="button" data-ov="discover">بررسی هر دو کلید و پیدا کردن پروژه‌ها</button></div>' +
    '<p id="ov-account" class="muted" style="font-size:11.5px;line-height:1.8;margin:6px 0">پروژه‌ها از حساب Bot-Hosting خودت بارگذاری می‌شوند، نه از دادهٔ آمادهٔ پنل.</p></div>' +
    '<div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:12px">' +
    '<div><label for="ov-source">پروژهٔ رلهٔ آماده در Bot-Hosting</label><select id="ov-source" class="input" style="width:100%" disabled>' + omniVercelSourceOptions() + '</select><p id="ov-target-preview" class="muted" style="font-size:11.5px;line-height:1.8"></p></div>' +
    '<div><label for="ov-label">نام نمایشی (اختیاری)</label><input id="ov-label" class="input" dir="auto" maxlength="80" placeholder="مثلاً رلهٔ Vercel من" style="width:100%"></div>' +
    '<div><label for="ov-token">توکن API خودت در Vercel (ذخیره نمی‌شود)</label><input id="ov-token" class="input" type="password" dir="ltr" autocomplete="off" placeholder="Vercel API token" style="width:100%"></div>' +
    '</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn btn-primary" type="button" data-ov="create">ساخت رلهٔ Vercel برای پروژهٔ انتخابی</button><button class="btn btn-sm" type="button" data-ov="refresh">به‌روزرسانی رله‌ها</button></div>' +
    '<p id="ov-message" class="muted" aria-live="polite" style="font-size:12px;margin:8px 0"></p>' +
    '<p class="muted" style="font-size:11.5px;line-height:1.8">برای تشخیص خودکار مسیر خصوصی، کلید Bot-Hosting باید دسترسی deployments:read داشته باشد؛ برای پروژه‌هایی که قبلاً با پنل ساخته نشده‌اند، files:read هم لازم است. Vercel Hobby سقف اجرای ۳۰۰ ثانیه دارد و اتصال طولانی تضمین نمی‌شود.</p>' +
    '<div id="ov-relays"></div></div>';
}
