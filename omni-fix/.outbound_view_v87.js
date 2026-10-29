  function OutboundView(e) {
    const stateObj = typeof e?.S === "function" ? e.S() : e;
    const st = (typeof e?.settings === "function" ? e.settings() : e?.settings) || (typeof l !== "undefined" && l && l.settings) || {};
    OUTBOUND_COUNTRIES = getOutboundCatalog();
    const relayCtx = getOutboundRelayContext(st);
    const panelHost = relayCtx.panelHost;
    const basePath = relayCtx.basePath;
    const arvanDom = relayCtx.arvanDom;
    const rwCfDom = relayCtx.rwCfDom;
    const activeUser = natnetActiveUser(stateObj);
    const uuid = activeUser.uuid || "00000000-0000-4000-8000-000000000000";
    const trojanPass = st.trojan_password || uuid;
    const customList = parseOutboundList(st);
    const activeCcs = parseOutboundCountries(st);
    const allUsers = Array.isArray(stateObj?.users) && stateObj.users.length ? stateObj.users : (window.__lastUsers || [activeUser]);
    const selectedUser = allUsers.find((u) => u && u.uuid === OUTBOUND_UI.selectedUserUuid) || activeUser;
    const selUuid = selectedUser?.uuid || uuid;
    const selProxies = Array.isArray(selectedUser?.proxies) ? selectedUser.proxies : [];
    const selExitSpec = selProxies[0] || "104.168.125.179:443";
    const selEntryMode = OUTBOUND_UI.entryMode || "natnet_snapp";
    const matchedCat = OUTBOUND_COUNTRIES.find((c) => c.proxy === selExitSpec || (c.proxies || []).some((p) => `${p}:443` === selExitSpec || p === selExitSpec));
    const selOutQuery = matchedCat
      ? `cc=${matchedCat.cc}&proxyip=${encodeURIComponent(selExitSpec)}`
      : `proxyip=${encodeURIComponent(selExitSpec)}`;
    const jsonPack = buildXrayOutboundJson(selUuid, basePath, panelHost, arvanDom, selEntryMode, selOutQuery, `omni-${selectedUser?.username || "outbound"}`, st);

    const regFilter = OUTBOUND_UI.regionFilter || "all";
    const qRaw = String(OUTBOUND_UI.searchQuery || "").trim().toLowerCase();
    const filteredCountries = OUTBOUND_COUNTRIES.filter((c) => {
      if (regFilter === "active" && !activeCcs.includes(c.cc)) return false;
      if (regFilter === "vip" && !(Array.isArray(c.vipProxies) && c.vipProxies.length)) return false;
      if (!["all", "active", "vip"].includes(regFilter) && c.region !== regFilter) return false;
      if (!qRaw) return true;
      return (
        c.cc.toLowerCase().includes(qRaw) ||
        String(c.fa || "").toLowerCase().includes(qRaw) ||
        String(c.en || "").toLowerCase().includes(qRaw) ||
        String(c.colo || "").toLowerCase().includes(qRaw) ||
        String(c.proxy || "").toLowerCase().includes(qRaw) ||
        (c.proxies || []).some((p) => String(p).toLowerCase().includes(qRaw))
      );
    }).map((c) => ({ c, stat: obCountryStat(c) }));
    /* ترتیب صادقانه: پاسخ‌گوها اول (با میانهٔ پینگ)، سنجیده‌نشده‌ها بعد، مرده‌ها آخر */
    filteredCountries.sort((x, y) => {
      const sx = x.stat, sy = y.stat;
      const rank = (s) => (s.alive > 0 ? 0 : s.measured === 0 ? 1 : 2);
      if (rank(sx) !== rank(sy)) return rank(sx) - rank(sy);
      if (sx.median !== null && sy.median !== null) return sx.median - sy.median;
      return 0;
    });
    const visibleCards = OUTBOUND_UI.hideDead
      ? filteredCountries.filter((x) => !(x.stat.measured > 0 && x.stat.alive === 0))
      : filteredCountries;

    const g = obGlobalStat();
    const customEps = obCustomEps(customList);
    const customAlive = customEps.filter((x) => ["open", "handshake"].includes(obCellOf(x.ep)?.state)).length;
    const customMeasured = customEps.filter((x) => obCellOf(x.ep)).length;

    const regionSegs = [
      ["all", `همه (${OUTBOUND_COUNTRIES.length})`],
      ["active", `انتخاب‌شده (${activeCcs.length})`],
      ["vip", "VIP"],
      ["eu", `اروپا (${OUTBOUND_COUNTRIES.filter((c) => c.region === "eu").length})`],
      ["na", `آمریکا و کانادا (${OUTBOUND_COUNTRIES.filter((c) => c.region === "na").length})`],
      ["me", `خاورمیانه و قفقاز (${OUTBOUND_COUNTRIES.filter((c) => c.region === "me").length})`],
      ["ap", `آسیا و اقیانوسیه (${OUTBOUND_COUNTRIES.filter((c) => c.region === "ap").length})`]
    ];

    return `
    <section class="mesh-kicker">OUTBOUND / rev147</section>

    <div class="card">
      <div class="card-head">${d("pin")}<h3>اوت‌باند و لوکیشن</h3><div class="spacer"></div>
        <span class="badge ok">دامنهٔ ورکر: <code dir="ltr">${a(panelHost)}</code></span>
        ${arvanDom ? `<span class="badge warn">آروان: <code dir="ltr">${a(arvanDom)}</code></span>` : ""}
        ${rwCfDom ? `<span class="badge info">Railway+CF: <code dir="ltr">${a(rwCfDom)}</code></span>` : ""}
      </div>
      <div class="mesh-metric-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-top:12px">
        <div class="mesh-metric"><span>کشورهای کاتالوگ</span><b>${v(OUTBOUND_COUNTRIES.length)}</b></div>
        <div class="mesh-metric"><span>نود خروجی (هر IP یک ردیف)</span><b>${v(g.total)}</b></div>
        <div class="mesh-metric"><span>پاسخ‌گوی سنجش‌شده</span><b style="color:${g.alive ? "var(--ok)" : "var(--text-faint)"}">${v(g.alive)}<span style="font-size:12px;color:var(--text-faint)"> / ${v(g.measured)}</span></b></div>
        <div class="mesh-metric"><span>اوت‌باند اختصاصی</span><b>${v(customList.length)}<span style="font-size:12px;color:var(--text-faint)"> · ${v(customAlive)}/${v(customMeasured)} سالم</span></b></div>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="card-head">${d("cloud")}<h3>منبع ورودی کانفیگ‌های اوت‌باند</h3></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-top:8px">
        <div class="field">
          <label for="outbound-relay-source">رلهٔ ورودی</label>
          <select id="outbound-relay-source" class="input">
            <option value="auto" ${OUTBOUND_UI.relaySource === "auto" ? "selected" : ""}>هوشمند (رلهٔ آماده + دامنهٔ پنل)</option>
            <option value="worker" ${OUTBOUND_UI.relaySource === "worker" ? "selected" : ""}>مستقیم دامنهٔ ورکر (${a(panelHost)})</option>
            ${relayCtx.arvanList.map((r) => `<option value="arvan:${a(r.domain)}" ${OUTBOUND_UI.relaySource === "arvan:" + r.domain ? "selected" : ""}>${a(r.source)}: ${a(r.domain)}</option>`).join("")}
            ${relayCtx.rwCfList.map((r) => `<option value="rwcf:${a(r.domain)}" ${OUTBOUND_UI.relaySource === "rwcf:" + r.domain ? "selected" : ""}>${a(r.source)}: ${a(r.domain)}</option>`).join("")}
            ${relayCtx.denoList.map((r) => `<option value="deno:${a(r.domain)}" ${OUTBOUND_UI.relaySource === "deno:" + r.domain ? "selected" : ""}>${a(r.source)}: ${a(r.domain)}</option>`).join("")}
            ${relayCtx.falixList.map((r) => `<option value="falix:${a(r.domain)}" ${OUTBOUND_UI.relaySource === "falix:" + r.domain ? "selected" : ""}>${a(r.source)}: ${a(r.domain)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>آی‌پی تمیز اسکنر</label>
          <div style="padding-top:8px">
            <span class="badge ${relayCtx.cleanPool.length ? "ok" : "info"}">${relayCtx.cleanPool.length ? `${v(relayCtx.cleanPool.length)} آی‌پی (بهترین: ${a(relayCtx.bestCleanIp)})` : `کاندید پیش‌فرض (${a(relayCtx.bestCleanIp)})`}</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
        <button type="button" class="btn btn-sm" data-action="nav" data-view="scanner">${d("search")} اسکنر آی‌پی تمیز</button>
        <button type="button" class="btn btn-sm" data-action="nav" data-view="national_net">${d("cloud")} مدیریت رله‌های ابری و آروان</button>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="card-head">${d("activity")}<h3>سنجش زندهٔ نودهای خروجی از دید ورکر</h3><div class="spacer"></div>
        <button type="button" class="btn btn-sm btn-primary" data-action="omni-ob-measure-all">${d("play")} سنجش همهٔ نودها (${v(g.total)})</button>
        <button type="button" class="btn btn-sm" data-action="omni-ob-measure-custom" ${customList.length ? "" : "disabled"}>${d("refresh")} فقط اختصاصی‌ها (${v(customList.length)})</button>
      </div>
      <p class="hint muted" style="font-size:11.5px;margin-top:2px">هر آی‌پی روی پورت خودش جداگانه سنجیده می‌شود: رنج کلادفلر با ساب‌ریکوئست واقعی و بقیه با سوکت خام ورکر. پینگ فقط عدد مثبت واقعی است؛ تایم‌اوت «بدون پاسخ» می‌شود و هیچ عددی ساخته نمی‌شود. برای لینک‌های کامل (vless/trojan/socks) فقط در دسترس‌بودن میزبان:پورت سنجیده می‌شود، نه اثبات کامل پروتکل.</p>
      <div class="mseg">
        ${regionSegs.map(([rk, rlabel]) => `<button type="button" class="mseg-btn ${regFilter === rk ? "on" : ""}" data-action="omni-outbound-region" data-region="${rk}">${a(rlabel)}</button>`).join("")}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">
        <input type="search" id="outbound-cc-search" class="input" style="max-width:320px" placeholder="جستجوی نام کشور، کد، دیتاسنتر یا IP..." value="${a(OUTBOUND_UI.searchQuery || "")}">
        <label class="sw" style="display:flex;align-items:center;gap:6px;font-size:12px"><input type="checkbox" id="ob-hide-dead" ${OUTBOUND_UI.hideDead ? "checked" : ""}><span>مخفی‌کردن کشورهای بی‌پاسخ</span></label>
        <span class="muted" style="font-size:11px">${OUTBOUND_UI.measuredAt ? "آخرین سنجش: " + a(obFmtTime(OUTBOUND_UI.measuredAt)) : "هنوز سنجشی انجام نشده"}</span>
      </div>
      <div class="notice ${g.alive ? "ok" : "warn"}" style="margin-top:10px;padding:10px">
        <b>${v(g.alive)} نود پاسخ‌گو از ${v(g.measured ? g.total : g.total)} نود${g.measured ? ` (${v(g.measured)} سنجیده‌شده)` : " · در انتظار سنجش"}</b>
        ${g.measured ? `<div style="font-size:11.5px;margin-top:3px">کشورهای بی‌پاسخ پایین فهرست با برچسب قرمز می‌آیند؛ تا سنجش واقعی انجام نشود هیچ ادعای سلامتی نمی‌شود.</div>` : ""}
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="card-head">${d("plus")}<h3>اوت‌باند اختصاصی این پنل</h3><div class="spacer"></div>
        <span class="badge ${customList.length ? "ok" : ""}">${v(customList.length)} مورد</span>
      </div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:10px">
        <div class="field">
          <label for="outbound-new-name">نام دلخواه اوت‌باند</label>
          <input type="text" id="outbound-new-name" class="input" placeholder="مثلاً: سرور اختصاصی آلمان">
        </div>
        <div class="field">
          <label for="outbound-new-flag">پرچم / کشور نمایشی</label>
          <select id="outbound-new-flag" class="input">
            ${OUTBOUND_COUNTRIES.map((c) => `<option value="${a(c.flag)}">${c.flag} ${a(c.fa)} (${a(c.en)})</option>`).join("")}
            <option value="🌍">🌍 سایر کشورها</option>
          </select>
        </div>
      </div>
      <div class="field" style="margin-top:10px">
        <label for="outbound-new-spec">لینک کامل (<code dir="ltr">vless://</code>، <code dir="ltr">trojan://</code>، <code dir="ltr">socks5://</code>، <code dir="ltr">http://</code>) یا <code dir="ltr">IP:Port</code></label>
        <input type="text" id="outbound-new-spec" class="input mono" dir="ltr" placeholder="vless://uuid@ip:port?security=tls&type=ws...  یا  103.27.156.147:443">
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button type="button" class="btn btn-primary" data-action="omni-outbound-add">${d("check")} ذخیره و همگام‌سازی با ساب</button>
        <button type="button" class="btn" data-action="omni-outbound-test-input">${d("wifi")} تست اتصال و پینگ</button>
        <span id="outbound-test-status" class="muted" style="align-self:center;font-size:12px">${a(OUTBOUND_UI.lastTest?.text || "")}</span>
      </div>
      ${customList.length === 0 ? `<p class="muted" style="font-size:12.5px;margin-top:12px">هنوز اوت‌باند اختصاصی ثبت نشده. هر مورد اضافه‌شده اینجا با سنجش واقعی همان میزبان:پورت فهرست می‌شود.</p>` : `
      <div style="margin-top:12px;display:grid;gap:10px">
        ${customList.map((item) => {
          const parsed = obParseSpec(item.spec);
          const cell = parsed ? obCellOf(parsed.ep) : null;
          const labelPrefix = `${item.flag || "🌍"} اوت‌باند ${item.name}`;
          const pack = buildOutboundPackForEntry(selUuid, trojanPass, basePath, panelHost, arvanDom, `out=${encodeURIComponent(item.id)}`, labelPrefix, [], st);
          const allUris = pack.map((p) => p.uri).join("\n");
          return `
          <div class="mrow" style="align-items:flex-start">
            <div class="mrow-main">
              <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
                ${obDot(cell)}
                <span class="badge ok">${a(item.flag || "🌍")} ${a(item.name)}</span>
                <span class="badge info">${a(detectOutboundProto(item.spec))}</span>
                ${obCellBadge(cell)}
              </div>
              <code class="mono muted" dir="ltr" style="display:block;font-size:11.5px;margin-top:6px;word-break:break-all">${a(maskOutboundSpec(item.spec))}</code>
              <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px">
                <button type="button" class="btn btn-xs btn-primary" data-action="omni-copy" data-text="${a(allUris)}">کپی ${v(pack.length)} کانفیگ</button>
                ${parsed ? `<button type="button" class="btn btn-xs" data-action="omni-outbound-test" data-spec="${a(item.spec)}">${d("refresh")} سنجش</button>` : ""}
                <button type="button" class="btn btn-xs" data-action="omni-outbound-del" data-id="${a(item.id)}" style="color:var(--danger)">${d("trash")} حذف</button>
              </div>
            </div>
          </div>`;
        }).join("")}
      </div>`}
    </div>

    <div class="card" style="margin-top:12px">
      <div class="card-head">${d("globe")}<h3>کاتالوگ کشورها — سنجش تکی هر نود خروجی</h3><div class="spacer"></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="btn btn-xs btn-primary" data-action="omni-outbound-publish-sub">${d("upload")} انتشار در ساب «${a(selectedUser?.username || "کاربر")}»</button>
          <button type="button" class="btn btn-xs" data-action="omni-outbound-publish-sub-all">${d("users")} همهٔ کاربران (${v(allUsers.length)})</button>
          <button type="button" class="btn btn-xs" data-action="omni-outbound-all-cc">انتخاب همه</button>
          <button type="button" class="btn btn-xs" data-action="omni-outbound-none-cc">لغو همه</button>
        </div>
      </div>
      <p class="muted" style="font-size:12px;margin:6px 0 10px;line-height:1.8">کشورهای تیک‌خورده با «انتشار در ساب» به بستهٔ کشورهای لینک ساب اضافه می‌شوند (بسته‌های رله و دستی حفظ می‌شوند). وضعیت هر کارت از سنجش واقعی آی‌پی‌های همان کشور ساخته می‌شود.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:10px">
        ${visibleCards.map(({ c, stat }) => {
          const isOn = activeCcs.includes(c.cc);
          const eps = obCountryEps(c);
          const pack = buildOutboundPackForEntry(selUuid, trojanPass, basePath, panelHost, arvanDom, `cc=${c.cc}&proxyip=${encodeURIComponent(c.proxy)}`, `${c.flag} لوکیشن ${c.fa}`, c.proxies || [], st);
          const packText = pack.map((p) => p.uri).join("\n");
          return `
          <div class="card" style="padding:12px;border:1px solid ${isOn ? "var(--ok)" : "var(--border)"};background:var(--bg-soft);margin:0">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span style="font-weight:700;font-size:13.5px">${c.flag} ${a(c.fa)}</span>
                <span class="badge" style="font-size:10px">${a(c.colo || c.cc)}</span>
              </div>
              <button type="button" class="btn btn-xs ${isOn ? "btn-primary" : ""}" data-action="omni-outbound-toggle-cc" data-cc="${a(c.cc)}">${isOn ? "در ساب فعال" : "افزودن +"}</button>
            </div>
            <div style="margin-top:7px;font-size:11.5px">
              ${stat.measured ? (stat.alive
                ? `<span style="color:var(--ok)">${v(stat.alive)}/${v(stat.total)} پاسخ‌گو${stat.median !== null ? " · میانه " + v(stat.median) + "ms" : ""}</span>`
                : `<span style="color:var(--danger)">${v(stat.total)}/${v(stat.total)} بی‌پاسخ در آخرین سنجش</span>`)
                : `<span class="muted">${v(stat.total)} نود · سنجیده نشده</span>`}
            </div>
            <div style="margin-top:7px;display:grid;gap:5px;max-height:170px;overflow:auto">
              ${eps.map((x) => {
                const cell = obCellOf(x.ep);
                return `
                <div style="display:flex;align-items:center;gap:7px;font-size:11px">
                  ${obDot(cell)}
                  <code class="mono" dir="ltr" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a(x.ep)}${x.vip ? " · VIP" : ""}</code>
                  ${obCellBadge(cell)}
                </div>`;
              }).join("")}
            </div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:9px">
              <button type="button" class="btn btn-xs btn-primary" data-action="omni-copy" data-text="${a(packText)}">کپی پک (${v(pack.length)})</button>
              <button type="button" class="btn btn-xs" data-action="omni-outbound-select-exit" data-spec="${a(c.proxy)}" data-cc="${a(c.cc)}">انتخاب در JSON</button>
              <button type="button" class="btn btn-xs" data-action="omni-ob-measure-cc" data-cc="${a(c.cc)}">${d("activity")} سنجش کشور</button>
            </div>
          </div>`;
        }).join("")}
      </div>
      ${!visibleCards.length ? `<p class="muted" style="font-size:12.5px;margin-top:12px;text-align:center">کشوری با این فیلتر پیدا نشد.</p>` : ""}
    </div>

    <div class="card" style="margin-top:12px">
      <div class="card-head">${d("db")}<h3>ساخت اوت‌باند حجم‌دار و خروجی JSON سرور</h3><div class="spacer"></div>
        <span class="badge info">Marzban · PasarGuard · 3x-ui · Hiddify</span>
      </div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(195px,1fr));gap:10px;margin-top:10px">
        <div class="field">
          <label for="ob-quota-name">نام اوت‌باند / پنل مقصد (انگلیسی)</label>
          <input type="text" id="ob-quota-name" class="input mono" dir="ltr" placeholder="marzban-de-1">
        </div>
        <div class="field">
          <label for="ob-quota-gb">حجم مجاز (گیگابایت · 0=نامحدود)</label>
          <input type="number" id="ob-quota-gb" class="input mono" dir="ltr" value="50" min="0" step="1">
        </div>
        <div class="field">
          <label for="ob-quota-days">مدت اعتبار (روز)</label>
          <input type="number" id="ob-quota-days" class="input mono" dir="ltr" value="30" min="1" max="3650">
        </div>
        <div class="field">
          <label for="ob-quota-exit">کشور یا سرور خروجی (${v(OUTBOUND_COUNTRIES.length)} کشور)</label>
          <select id="ob-quota-exit" class="input">
            ${customList.map((c) => `<option value="${a(c.spec)}" ${selExitSpec === c.spec ? "selected" : ""}>${a(c.flag || "🌍")} [اختصاصی] ${a(c.name)}</option>`).join("")}
            ${OUTBOUND_COUNTRIES.map((c) => `<option value="${a(c.proxy)}" ${selExitSpec === c.proxy ? "selected" : ""}>${c.flag} ${a(c.fa)} [${a(c.colo || c.cc)}] (${a(c.proxy)} · ${v((c.proxies || []).length || 1)} IP)</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="ob-quota-entry">نوع ورودی</label>
          <select id="ob-quota-entry" class="input">
            <option value="arvan_mci_frag" ${selEntryMode === "arvan_mci_frag" ? "selected" : ""}>همراه اول + آروان · Fragment TLSHello (185.143.233.120:443)</option>
            <option value="arvan_owned_2096" ${selEntryMode === "arvan_owned_2096" ? "selected" : ""}>همراه اول + آروان · پورت 2096 + Fragment</option>
            <option value="arvan_owned_tls" ${selEntryMode === "arvan_owned_tls" ? "selected" : ""}>دامنهٔ آروان + Railway (${a(arvanDom || panelHost)}:443)</option>
            <option value="natnet_snapp" ${selEntryMode === "natnet_snapp" ? "selected" : ""}>نت ملی · ورودی آروان (snapp.ir:443)</option>
            <option value="railway_cf" ${selEntryMode === "railway_cf" ? "selected" : ""}>Railway + Cloudflare شخصی (${a(rwCfDom || panelHost)})</option>
            <option value="clean_ip_scanner" ${selEntryMode === "clean_ip_scanner" ? "selected" : ""}>بهترین آی‌پی تمیز اسکن‌شده (${a(relayCtx.bestCleanIp)}:443)</option>
            <option value="cf_patt_mci" ${selEntryMode === "cf_patt_mci" ? "selected" : ""}>ضد فیلتر PattNG همراه اول/ایرانسل</option>
            <option value="natnet_ip" ${selEntryMode === "natnet_ip" ? "selected" : ""}>نت ملی · آی‌پی مستقیم آروان (185.143.232.200:443)</option>
            <option value="natnet_http80" ${selEntryMode === "natnet_http80" ? "selected" : ""}>نت ملی · پورت 80 آروان (185.143.232.200:80)</option>
            <option value="reality_snapp" ${selEntryMode === "reality_snapp" ? "selected" : ""}>Reality + gRPC (SNI=snapp.ir · 26432)</option>
            <option value="foreign_relay" ${selEntryMode === "foreign_relay" ? "selected" : ""}>سرور خارج (ترکیه/اروپا · 41211)</option>
            <option value="cf_direct" ${selEntryMode === "cf_direct" ? "selected" : ""}>مستقیم دامنهٔ پنل (${a(panelHost)}:443)</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button type="button" class="btn btn-primary" data-action="omni-outbound-create-quota">${d("plus")} ساخت اوت‌باند حجم‌دار و JSON</button>
        <span class="muted" style="align-self:center;font-size:12px">هر گیگابایت مصرف روی همین UUID محاسبه و پس از اتمام حجم/زمان قطع می‌شود.</span>
      </div>
      <div class="card" style="margin-top:12px;padding:12px;background:var(--surface-2);border:1px solid var(--border-strong)">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <b style="font-size:13px">خروجی JSON برای:</b>
          <select id="ob-json-user-select" class="input" style="width:auto;min-width:210px">
            ${allUsers.map((u) => {
              const usedB = Number(u.used_bytes ?? ((Number(u.up_bytes || 0) + Number(u.down_bytes || 0))));
              const quotaB = Number(u.quota_bytes || (u.quota_gb ? u.quota_gb * 1073741824 : 0));
              const uGb = quotaB > 0 ? `${(usedB / 1073741824).toFixed(2)} / ${(quotaB / 1073741824).toFixed(1)} GB` : "نامحدود";
              const uNote = u.note ? ` · ${u.note}` : "";
              return `<option value="${a(u.uuid)}" ${u.uuid === selUuid ? "selected" : ""}>${a(u.username)} (${uGb}${a(uNote)})</option>`;
            }).join("")}
          </select>
          <button type="button" class="btn btn-xs" data-action="omni-outbound-refresh-json">${d("refresh")} به‌روزرسانی JSON</button>
          <div class="spacer"></div>
          <button type="button" class="btn btn-xs btn-primary" data-action="omni-outbound-copy-json" data-kind="single">کپی JSON تک‌بلوک</button>
          <button type="button" class="btn btn-xs btn-primary" data-action="omni-outbound-copy-json" data-kind="marzban">کپی JSON کامل با Routing</button>
          <button type="button" class="btn btn-xs" data-action="omni-copy" data-text="${a(jsonPack.uri)}">${d("link")} کپی لینک VLESS</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:10px;margin-top:10px">
          <div>
            <div style="font-size:12px;font-weight:700;margin-bottom:4px;color:var(--accent)">JSON تک‌بلوک (3x-ui / Hiddify)</div>
            <pre id="ob-single-json-box" class="codebox mono" dir="ltr" style="max-height:210px;overflow:auto;font-size:11px;margin:0">${a(jsonPack.singleJson)}</pre>
          </div>
          <div>
            <div style="font-size:12px;font-weight:700;margin-bottom:4px;color:var(--ok)">JSON کامل با Routing (Marzban / PasarGuard)</div>
            <pre id="ob-marzban-json-box" class="codebox mono" dir="ltr" style="max-height:210px;overflow:auto;font-size:11px;margin:0">${a(jsonPack.marzbanJson)}</pre>
          </div>
        </div>
      </div>
    </div>`;
  }
