        } else if (i === "omni-outbound-add") {
          const nameEl = document.getElementById("outbound-new-name");
          const flagEl = document.getElementById("outbound-new-flag");
          const specEl = document.getElementById("outbound-new-spec");
          const rawSpec = (specEl?.value || "").trim();
          if (!rawSpec) { y("لطفاً لینک کانفیگ یا IP:Port اوت‌باند را وارد کنید", "warn"); return; }
          if (!obParseSpec(rawSpec)) { y("الگوی ورودی شناخته نشد؛ لینک کامل vless/trojan/socks/http یا IP:Port معتبر وارد کنید", "err"); return; }
          let flag = (flagEl?.value || "🌍").trim();
          let name = (nameEl?.value || "").trim();
          if (!name) {
            if (rawSpec.includes("#")) { try { name = decodeURIComponent(rawSpec.split("#")[1]).trim(); } catch {} }
            if (!name) name = maskOutboundSpec(rawSpec).slice(0, 28);
          }
          const st0 = e.settings?.() || {};
          const list0 = parseOutboundList(st0);
          const id = "ob_" + Math.random().toString(36).slice(2, 9);
          list0.unshift({ id, name, flag, spec: rawSpec });
          const saved0 = await b.saveSettings({ custom_outbounds: JSON.stringify(list0) });
          if (saved0?.settings) l.settings = saved0.settings;
          y(`اوت‌باند «${flag} ${name}» ذخیره شد`, "ok", 4200);
          e.rerenderView("outbound");
          return;
        } else if (i === "omni-outbound-del") {
          const id = s.dataset.id || "";
          const st1 = e.settings?.() || {};
          const list1 = parseOutboundList(st1).filter((x) => x.id !== id);
          const saved1 = await b.saveSettings({ custom_outbounds: JSON.stringify(list1) });
          if (saved1?.settings) l.settings = saved1.settings;
          y("اوت‌باند اختصاصی حذف شد", "ok");
          e.rerenderView("outbound");
          return;
        } else if (i === "omni-outbound-toggle-cc") {
          const cc = s.dataset.cc || "";
          if (!cc) return;
          const st2 = e.settings?.() || {};
          const list2 = parseOutboundCountries(st2);
          const next = list2.includes(cc) ? list2.filter((x) => x !== cc) : [...list2, cc];
          const saved2 = await b.saveSettings({ outbound_countries: JSON.stringify(next) });
          if (saved2?.settings) l.settings = saved2.settings;
          y(`فهرست کشورها به‌روز شد (${next.length} کشور فعال) — برای اعمال در ساب «انتشار در ساب» را بزن`, "ok");
          e.rerenderView("outbound");
          return;
        } else if (i === "omni-outbound-all-cc") {
          const allCcs = getOutboundCatalog().map((x) => x.cc);
          const saved3 = await b.saveSettings({ outbound_countries: JSON.stringify(allCcs) });
          if (saved3?.settings) l.settings = saved3.settings;
          y(`همهٔ ${allCcs.length} کشور کاتالوگ انتخاب شدند`, "ok");
          e.rerenderView("outbound");
          return;
        } else if (i === "omni-outbound-none-cc") {
          const saved4 = await b.saveSettings({ outbound_countries: JSON.stringify([]) });
          if (saved4?.settings) l.settings = saved4.settings;
          y("انتخاب کشورها پاک شد", "info");
          e.rerenderView("outbound");
          return;
        } else if (i === "omni-outbound-region") {
          OUTBOUND_UI.regionFilter = s.dataset.region || "all";
          obSave();
          e.rerenderView("outbound");
          return;
        } else if (i === "omni-outbound-select-exit") {
          const spec = s.dataset.spec || "104.168.125.179:443";
          const exitSelect = document.getElementById("ob-quota-exit");
          if (exitSelect) exitSelect.value = spec;
          const allU = Array.isArray(l?.users) && l.users.length ? l.users : (window.__lastUsers || []);
          const curU = allU.find((u) => u && u.uuid === OUTBOUND_UI.selectedUserUuid) || allU[0];
          if (curU) { curU.proxies = [spec]; OUTBOUND_UI.selectedUserUuid = curU.uuid; obSave(); }
          e.rerenderView("outbound");
          document.getElementById("ob-single-json-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
          y(`نود خروجی ${spec} در تولیدکنندهٔ JSON قرار گرفت`, "ok");
          return;
        } else if (i === "omni-outbound-publish-sub" || i === "omni-outbound-publish-sub-all") {
          const stP = e.settings?.() || l?.settings || {};
          const allU2 = (Array.isArray(l?.users) && l.users.length ? l.users : (window.__lastUsers || [])).filter((u) => u && u.uuid);
          if (!allU2.length) { y("ابتدا در بخش کاربران حداقل یک کاربر بسازید", "warn"); return; }
          const targets = i === "omni-outbound-publish-sub-all"
            ? allU2
            : [allU2.find((u) => u.uuid === OUTBOUND_UI.selectedUserUuid) || natnetActiveUser(l) || allU2[0]].filter(Boolean);
          let totalSaved = 0;
          for (const u of targets) {
            const uris = buildStandardSubUrisForOutbound(u.uuid, stP.trojan_password || u.uuid, stP);
            if (!uris.length) { y("حداقل یک کشور یا اوت‌باند اختصاصی را انتخاب کنید", "warn"); return; }
            await omniBatchSave(u, uris, "countries");
            totalSaved = uris.length;
          }
          y(`${totalSaved} کانفیگ اوت‌باند در ساب ${targets.length === 1 ? `کاربر «${targets[0].username}»` : `${targets.length} کاربر`} منتشر شد (بسته‌های رله حفظ شدند)`, "ok", 4500);
          return;
        } else if (i === "omni-ob-measure-all" || i === "omni-ob-measure-custom" || i === "omni-ob-measure-cc") {
          if (obBusy) { y("سنجش قبلی هنوز تمام نشده", "warn"); return; }
          let eps = [];
          let label = "";
          if (i === "omni-ob-measure-all") { eps = obAllCatalogEps().map((x) => x.ep); label = "همهٔ نودهای کاتالوگ"; }
          else if (i === "omni-ob-measure-custom") { eps = obCustomEps(parseOutboundList(e.settings?.() || {})).map((x) => x.ep); label = "اوت‌باندهای اختصاصی"; }
          else {
            const cc = s.dataset.cc || "";
            const country = OUTBOUND_COUNTRIES.find((x) => x.cc === cc);
            if (!country) return;
            eps = obCountryEps(country).map((x) => x.ep);
            label = country.fa || cc;
          }
          if (!eps.length) { y("نودی برای سنجش وجود ندارد", "warn"); return; }
          obBusy = true;
          y(`در حال سنجش ${eps.length} نود «${label}» از دید ورکر…`, "info", 2500);
          try {
            await obProbeEps(eps);
            const stats = eps.map((ep) => obCellOf(ep)).filter(Boolean);
            const alive = stats.filter((c) => ["open", "handshake"].includes(c.state)).length;
            y(`سنجش ${label}: ${alive} پاسخ‌گو از ${stats.length} نود`, alive ? "ok" : "err", 4500);
          } catch (err) {
            y("سنجش کامل نشد: " + String(err?.message || err), "err");
          } finally {
            obBusy = false;
            e.rerenderView("outbound");
          }
          return;
        } else if (i === "omni-outbound-test" || i === "omni-outbound-test-input") {
          const spec = i === "omni-outbound-test-input"
            ? (document.getElementById("outbound-new-spec")?.value || "").trim()
            : (s.dataset.spec || "").trim();
          if (!spec) { y("ابتدا آدرس یا لینک اوت‌باند را وارد کنید", "warn"); return; }
          const parsed = obParseSpec(spec);
          if (!parsed) { y("الگوی ورودی معتبر نیست", "err"); return; }
          const stEl = document.getElementById("outbound-test-status");
          if (stEl) stEl.textContent = "در حال سنجش از دید ورکر…";
          try {
            await obProbeEps([parsed.ep]);
            const cell = obCellOf(parsed.ep);
            const good = cell && ["open", "handshake"].includes(cell.state);
            OUTBOUND_UI.lastTest = {
              spec,
              text: good
                ? `میزبان در دسترس است · ${v(obNum(cell.ms))}ms (${cell.via === "subrequest" ? "ساب‌ریکوئست" : "سوکت"}) — سنجش میزبان:پورت، نه اثبات کامل پروتکل`
                : "بدون پاسخ — میزبان:پورت از دید ورکر reachable نیست",
              at: new Date().toISOString()
            };
            obSave();
            y(good ? `اوت‌باند در دسترس است (${v(obNum(cell.ms))}ms)` : "اوت‌باند بدون پاسخ", good ? "ok" : "err", 4000);
          } catch (err) {
            OUTBOUND_UI.lastTest = { spec, text: "سنجش انجام نشد: " + String(err?.message || err), at: new Date().toISOString() };
            obSave();
          }
          e.rerenderView("outbound");
          return;
        } else if (i === "omni-outbound-create-quota") {
          let rawName = (document.getElementById("ob-quota-name")?.value || "").trim().replace(/[^a-zA-Z0-9._-]/g, "");
          if (!rawName || rawName.length < 3) rawName = "outbound-" + Math.random().toString(36).slice(2, 7);
          const qGb = Math.max(0, Number(document.getElementById("ob-quota-gb")?.value ?? 50));
          const qDays = Math.max(1, Number(document.getElementById("ob-quota-days")?.value ?? 30));
          const exitSpec = (document.getElementById("ob-quota-exit")?.value || "104.168.125.179:443").trim();
          const entryMode = (document.getElementById("ob-quota-entry")?.value || "natnet_snapp").trim();
          OUTBOUND_UI.entryMode = entryMode;
          obSave();
          y("در حال ساخت اوت‌باند حجم‌دار و تولید کد JSON…", "info", 2000);
          const res = await b.createUser({
            username: rawName,
            quota_gb: qGb,
            expiry_days: qDays,
            device_limit: 999,
            proxies: [exitSpec],
            note: `OUTBOUND (${qGb || "∞"}GB · ${qDays}d)`
          });
          if (res?.user?.uuid) OUTBOUND_UI.selectedUserUuid = res.user.uuid;
          obSave();
          await U();
          y(`اوت‌باند حجم‌دار «${rawName}» (${qGb || "∞"} GB · ${qDays} روز) ساخته شد و JSON آماده است`, "ok", 5000);
          e.rerenderView("outbound");
          return;
        } else if (i === "omni-outbound-copy-json") {
          const kind = s.dataset.kind || "single";
          const box = document.getElementById(kind === "marzban" ? "ob-marzban-json-box" : "ob-single-json-box");
          const txt = (box?.textContent || "").trim();
          if (txt) {
            await navigator.clipboard.writeText(txt);
            y(kind === "marzban" ? "کد JSON کامل (مرزبان / PasarGuard) کپی شد" : "کد JSON تک‌بلوک (3x-ui / Hiddify) کپی شد", "ok", 3500);
          }
          return;
        } else if (i === "omni-outbound-refresh-json") {
          const selU = document.getElementById("ob-json-user-select")?.value || "";
          const entryM = document.getElementById("ob-quota-entry")?.value || "natnet_snapp";
          const exitSpec2 = document.getElementById("ob-quota-exit")?.value || "";
          if (selU) OUTBOUND_UI.selectedUserUuid = selU;
          if (entryM) OUTBOUND_UI.entryMode = entryM;
          if (exitSpec2 && selU) {
            const allU3 = Array.isArray(l?.users) ? l.users : [];
            const found2 = allU3.find((u) => u && u.uuid === selU);
            if (found2) found2.proxies = [exitSpec2];
          }
          obSave();
          e.rerenderView("outbound");
          y("کد JSON با تنظیمات جدید به‌روز شد", "ok", 2200);
          return;
        }
