  // VPS-PROFILES-BEGIN
  // VPS-PROFILES-END
  function VpsProView() {
    return `
    <section class="card mesh-hero" style="border-inline-start:4px solid var(--accent)">
      <div class="mesh-kicker">OMNI / OWNED ORIGIN + DOMESTIC CDN</div>
      <h2 class="mesh-title">💎 VPS + CDN ایرانی — مسیر مشابه اسپایدر (پولی)</h2>
      <div class="codebox" style="text-align:center;font-size:15px;margin:12px 0">گوشی ← CDN ایرانی ← سرورِ دارای اینترنت جهانی</div>
      <p class="muted">برای این روش معمولاً مبدا را روی VPS خارجی می‌گذاری و <b>دامنهٔ خودت</b> را به CDN ایرانی وصل می‌کنی.
      سرور روی اسنپ نصب نمی‌شود؛ نام یا IP سایت هم‌CDN فقط می‌تواند آدرس ورودی آزمایشی باشد. هر سایت ایرانی مناسب نیست.</p>
      <p class="muted">SNI و Host واقعی = دامنهٔ خودت. Spoof = قابلیت جداگانهٔ کلاینت سازگار؛ تغییر سادهٔ SNI به snapp.ir جای آن نیست.
      ارتباط CDN تا مبدا باید باز بماند. هیچ مسیر تست‌نشده‌ای «نت ملی تضمینی» نیست.</p>
    </section>
    <section class="card" style="margin-top:12px">
      <h3>۱) آماده‌سازی VPS خودت</h3>
      <p class="muted">Debian/Ubuntu + systemd؛ نصب اولیه به مخزن بسته‌ها، GitHub و همین پنل نیاز دارد. بعد از نصب، قطع پنل به‌تنهایی سرویس Xray را متوقف نمی‌کند.</p>
      <input id="vps-label" class="input" placeholder="نام دلخواه سرور" maxlength="80" aria-label="نام نود">
      <button class="btn btn-primary" type="button" data-action="omni-vps-create" style="margin-top:8px">➕ ساخت نود و دستور نصب</button>
      <div id="vps-install" class="codebox" style="display:none;margin-top:10px"></div>
    </section>
    <section class="card" style="margin-top:12px">
      <h3>۲) اتصال دامنه به CDN ایرانی</h3>
      <p class="muted">دامنه باید در حساب CDN خودت فعال و مبدا آن IP همین VPS باشد؛ WebSocket روشن، کش و چالش مرورگر روی مسیر WS خاموش.
      HTTP روی پورت ۸۰ باید برای صدور/تمدید گواهی به مبدا برسد؛ HTTPS به پورت ۴۴۳ مبدا با اعتبارسنجی گواهی وصل شود.</p>
      <p class="muted"><b>این نسخه حساب CDN، تغییر NS یا رکورد DNS را خودکار نمی‌سازد.</b> تا دسترسی آن سرویس وصل نشده، صرف واردکردن نام دامنه این مرحله را انجام نمی‌دهد.</p>
    </section>
    <section class="card" style="margin-top:12px">
      <h3>۳) نصب مبدا، خروجی آزمایشی و تأیید روی خط</h3>
      <div id="vps-nodes"><p class="muted">در حال بارگذاری…</p></div>
      <button class="btn btn-sm" type="button" data-action="omni-vps-refresh" style="margin-top:8px">🔄 تازه‌سازی وضعیت</button>
      <p class="muted">آنلاین‌بودن ایجنت فقط ارتباط مدیریتی است. کانفیگ فقط بعد از تأیید صریح تست خط تو به اشتراک اضافه می‌شود.
      خروجی Spoof برای کلاینت سازگار مثل نسخهٔ پشتیبان این قابلیت در V2Box است؛ v2rayNG معمولی را سازگار فرض نمی‌کنیم.</p>
    </section>`;
  }
  function vpsCdnModal(id) {
    const users = (l.users || window.__lastUsers || []).filter(u => u.uuid);
    Le({ title: "مبدا CDN — WS + TLS", body: `
      <form id="vps-cdn-form" onsubmit="return false" style="display:grid;gap:10px">
        <label>دامنهٔ خودت روی CDN<input id="vps-cdn-domain" class="input" dir="ltr" placeholder="relay.your-domain.tld" required></label>
        <label>Address / لبهٔ همان CDN (اختیاری)<input id="vps-cdn-address" class="input" dir="ltr" placeholder="خالی = دامنهٔ خودت؛ نام/IP سایت هم‌CDN فقط پس از بررسی"></label>
        <label>مسیر WS<input id="vps-cdn-path" class="input" dir="ltr" value="/vzn" required pattern="/[A-Za-z0-9/_-]{1,120}"></label>
        <label>کاربر کانفیگ<select id="vps-cdn-user" class="input">${users.length ? users.map(u=>`<option value="${a(u.uuid)}">${a(u.username || u.uuid)}</option>`).join("") : '<option value="">اولین کاربر فعال پنل</option>'}</select></label>
        <p class="muted" style="margin:0">Host و SNI واقعی خودکار روی دامنهٔ خودت می‌مانند؛ SSL خاموش نمی‌شود.</p>
        <details><summary>🧪 Spoof مخصوص کلاینت سازگار — اختیاری</summary>
          <p class="muted">این دو فیلد مستقل از SNI واقعی هستند. نتیجهٔ آزمایش خط را نمی‌توان از اسم اسنپ حدس زد.</p>
          <label>Fake SNI<input id="vps-cdn-fake" class="input" dir="ltr" placeholder="مثلاً snapp.ir، فقط برای آزمایش"></label>
          <label>Spoof IP<input id="vps-cdn-spoofip" class="input" dir="ltr" placeholder="IP عمومی مطابق روش/کلاینت مورد استفاده"></label>
        </details>
        <label><input id="vps-cdn-ready" type="checkbox" required> دامنه/CDN را طبق مرحلهٔ ۲ آماده کرده‌ام؛ می‌دانم این نصب پروفایل قبلی همین نود را جایگزین می‌کند.</label>
      </form>`,
      footer: `<button class="btn" data-action="close-modal">بستن</button><button class="btn btn-primary" data-action="omni-vps-save-cdn" data-node="${Number(id)}">نصب مبدا و ساخت خروجی آزمایشی</button>` });
  }
  async function vpsRefreshList() {
    const box = document.getElementById("vps-nodes");
    if (!box) return;
    try {
      const d = await x("GET", "/api/vps", void 0, {retry:0});
      const nodes = d.nodes || [];
      if (!nodes.length) { box.innerHTML = '<p class="muted">هنوز VPS واقعی وصل نشده. با «ساخت نود» فقط دستور نصب می‌گیری، نه اتصال آماده.</p>'; return; }
      box.innerHTML = nodes.map(n => {
        let profiles = [], info = {};
        try { profiles = JSON.parse(n.profiles || "[]"); info = JSON.parse(n.info || "{}"); } catch {}
        const checks = new Set((n.checks || []).map(c=>c.profile_key));
        const seen = n.last_seen ? Date.parse(String(n.last_seen).replace(" ","T").replace(/Z$/,"" )+"Z") : 0;
        const fresh = seen && Date.now()-seen < 180000;
        const status = n.status === "pending_join" ? "منتظر نصب ایجنت" : !fresh ? "سیگنال مدیریتی قدیمی / نامشخص" : n.status === "online" ? "سرویس محلی فعال؛ نه تست خط" : "ایجنت متصل؛ رله هنوز فعال نیست";
        const phtml = profiles.map(p => [false,true].map(spoof => {
          const uri = vpsUriOf(n,p,spoof); if (!uri) return "";
          const key = vpsProofKey(n,p,spoof), verified = checks.has(key);
          return `<div class="card" style="margin-top:10px">
            <b>${spoof ? "🧪 خروجی Spoof — کلاینت سازگار" : p.kind === "reality" ? "REALITY مستقیم (بدون CDN)" : p.via_cdn ? "WS+TLS از CDN" : "WS+TLS مستقیم"}</b>
            <span class="badge ${verified ? "ok" : "warn"}">${verified ? "تأیید دستی توسط تو" : "منتظر تست روی خط تو"}</span>
            ${p.domain ? `<p class="muted" dir="ltr" style="font-size:11px">Address: ${a(p.address || p.domain)}<br>Host / real SNI: ${a(p.domain)}${spoof ? '<br>Fake SNI: '+a(p.fake_sni) : ''}</p>` : ""}
            <div class="codebox" style="margin-top:6px;max-height:82px;overflow:auto"><code dir="ltr" style="font-size:10px;word-break:break-all">${a(uri)}</code></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
              <button class="btn btn-xs" data-action="omni-copy" data-text="${a(uri)}">📋 کپی ${spoof ? 'برای V2Box سازگار' : 'کانفیگ آزمایشی'}</button>
              ${!spoof ? `<button class="btn btn-xs" data-action="omni-natnet-v2rayng" data-uri="${a(uri)}">📲 تست در v2rayNG</button>` : ''}
              <button class="btn btn-xs" data-action="omni-natnet-qr" data-uri="${a(uri)}">QR</button>
              <button class="btn btn-xs ${verified ? '' : 'btn-primary'}" data-action="omni-vps-line-check" data-node="${Number(n.id)}" data-key="${a(key)}" data-confirmed="${verified ? '0' : '1'}">${verified ? "لغو تأیید و حذف از اشتراک" : "روی خطم وصل شد؛ تأیید برای اشتراک"}</button>
            </div>${spoof ? '<p class="muted">بعد از تأیید، فقط خروجی اشتراک <code dir="ltr">?type=v2box</code> این پارامتر را نگه می‌دارد.</p>' : ''}
          </div>`;
        }).join("")).join("");
        const jobs = (n.tasks || []).map(t=>`<p class="muted" style="font-size:11px">دستور #${Number(t.id)}: ${t.state===0 ? "در صف" : t.state===1 ? "در حال اجرا" : "نتیجه دریافت شد"}${t.result ? '<br><code dir="ltr">'+a(String(t.result).slice(0,420))+'</code>' : ''}</p>`).join("");
        const waiting = n.status === 'pending_join';
        return `<div class="card" style="margin-top:10px">
          <b>🖥 ${a(n.label || 'VPS')}</b> <span class="badge warn">${a(status)}</span>
          <p class="muted" style="font-size:11px">IP: <b dir="ltr">${a(n.ip || '—')}</b> · آخرین سیگنال: <span dir="ltr">${a(n.last_seen || '—')}</span>${info.agent_version ? ' · ایجنت '+a(info.agent_version) : ''}</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-xs btn-primary" data-action="omni-vps-cdn" data-node="${Number(n.id)}" ${waiting?'disabled':''}>🌐 نصب مبدا CDN (روش مشابه اسپایدر)</button>
            <button class="btn btn-xs" data-action="omni-vps-task" data-kind="restart" data-node="${Number(n.id)}" ${waiting?'disabled':''}>ریستارت</button>
            <button class="btn btn-xs" data-action="omni-vps-task" data-kind="uninstall" data-node="${Number(n.id)}" ${waiting?'disabled':''}>توقف رله</button>
            <button class="btn btn-xs btn-danger" data-action="omni-vps-task" data-kind="remove" data-node="${Number(n.id)}">حذف ثبت نود</button>
          </div>
          <details style="margin-top:8px"><summary>روش مستقیم — این‌ها مسیر CDN/اسنپ نیستند</summary>
            <button class="btn btn-xs" data-action="omni-vps-task" data-kind="reality" data-node="${Number(n.id)}" ${waiting?'disabled':''}>REALITY مستقیم</button>
            <button class="btn btn-xs" data-action="omni-vps-task" data-kind="ws" data-node="${Number(n.id)}" ${waiting?'disabled':''}>WS مستقیم + گواهی</button>
          </details>${jobs}${phtml}</div>`;
      }).join("");
    } catch (err) { box.innerHTML = '<p class="muted">دریافت وضعیت ناموفق بود: '+a(String(err.message || err))+'</p>'; }
  }
