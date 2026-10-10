} else if (i === "omni-vps-create") {
          const d = await x("POST", "/api/vps/create", {label: document.getElementById("vps-label")?.value || "CDN origin"}, {retry:0});
          const box = document.getElementById("vps-install");
          if (box && d.install) {
            box.style.display = "block";
            box.innerHTML = '<p>روی VPS خودت به‌عنوان root اجرا کن. نصب بسته‌ها ممکن است چند دقیقه طول بکشد؛ این دستور هنوز CDN را وصل نمی‌کند.</p><code dir="ltr" style="font-size:11px;word-break:break-all">'+a(d.install)+'</code><br><button class="btn btn-xs" data-action="omni-copy" data-text="'+a(d.install)+'">📋 کپی دستور</button>';
          }
          y("ثبت نود ساخته شد؛ هنوز VPS یا مسیر CDN تأیید نشده.", "ok", 6000);
          await vpsRefreshList();
        } else if (i === "omni-vps-refresh") {
          await vpsRefreshList();
        } else if (i === "omni-vps-cdn") {
          vpsCdnModal(Number(s.dataset.node));
        } else if (i === "omni-vps-save-cdn") {
          const form = document.getElementById("vps-cdn-form");
          if (!form || !form.reportValidity()) return;
          const val = id => document.getElementById(id)?.value.trim() || "";
          const payload = {kind:"ws",via_cdn:true,domain:val("vps-cdn-domain"),address:val("vps-cdn-address"),path:val("vps-cdn-path"),uuid:val("vps-cdn-user"),fake_sni:val("vps-cdn-fake"),spoof_ip:val("vps-cdn-spoofip")};
          await x("POST", "/api/vps/task", {node_id:Number(s.dataset.node),payload}, {retry:0});
          W();
          y("نصب مبدا در صف قرار گرفت؛ نتیجهٔ گواهی و سرویس در کارت نود نمایش داده می‌شود. هنوز تست خط انجام نشده.", "ok", 7000);
          await vpsRefreshList();
          setTimeout(()=>vpsRefreshList(),30000);
        } else if (i === "omni-vps-line-check") {
          const confirmed = s.dataset.confirmed === "1", id = Number(s.dataset.node), key = s.dataset.key;
          if (confirmed && !await Q("این گزینه تست خودکار نیست. آیا همین کانفیگ را از اینترنت خط خودت وصل کرده‌ای و یک سایت خارجی واقعاً باز شده؟ فقط در صورت انجام این آزمایش تأیید کن.")) return;
          await x("POST", "/api/vps/line-check", {node_id:id,profile_key:key,confirmed}, {retry:0});
          y(confirmed ? "تأیید دستی خط تو ثبت شد؛ کانفیگ به خروجی اشتراک سازگار اضافه می‌شود." : "تأیید لغو شد؛ کانفیگ از اشتراک حذف می‌شود.", "ok", 6000);
          await vpsRefreshList();
        } else if (i === "omni-vps-task") {
          const kind = s.dataset.kind, id = Number(s.dataset.node);
          if (kind === "remove") {
            if (!await Q("حذف ثبت نود فقط ارتباط مدیریت را قطع می‌کند و Xray را روی VPS پاک نمی‌کند. اگر می‌خواهی سرویس متوقف شود، اول «توقف رله» را بزن. ثبت نود حذف شود؟", {danger:true})) return;
            await x("POST", "/api/vps/remove", {node_id:id}, {retry:0});
            y("ثبت نود حذف شد.", "ok");
          } else {
            const payload = {kind};
            if (kind === "ws" || kind === "reality") {
              if (!await Q("این حالت مستقیم است، نه مسیر CDN/اسنپ؛ و پروفایل فعلی همین نود را جایگزین می‌کند. ادامه؟")) return;
              if (kind === "ws") {
                const domain = prompt("دامنهٔ خودت که به این VPS می‌رسد (HTTP پورت ۸۰ برای گواهی باید باز باشد):");
                if (!domain) return;
                payload.domain = domain.trim();
              } else {
                const sni = prompt("دامنهٔ مقصد سازگار با REALITY را وارد کن؛ این گزینه به معنی عبور از سایت ایرانی نیست:");
                if (!sni) return;
                payload.sni = sni.trim();
              }
            }
            if (kind === "uninstall" && !await Q("رله روی VPS متوقف شود؟ ایجنت مدیریت باقی می‌ماند.",{danger:true})) return;
            await x("POST", "/api/vps/task", {node_id:id,payload}, {retry:0});
            y("دستور در صف قرار گرفت؛ نتیجه را در کارت نود ببین.", "ok", 6000);
            setTimeout(()=>vpsRefreshList(),30000);
          }
          await vpsRefreshList();
        }
