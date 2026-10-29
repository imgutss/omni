function MeshView(e) {
    if (!MESH.runs.tcp && !MESH.runs.vless && !MESH.runs.udp) meshStoreLoad();
    setTimeout(() => { meshLoadLive(e, false); meshHistory(e, false); }, 0);
    const libCount = meshLibRows().length;
    const run = MESH.runs[MESH.mode] || null;
    const facts = run?.facts || null;
    const modePill = (k, label) => `<button class="mseg-btn ${MESH.mode === k ? "on" : ""}" type="button" data-action="omni-mesh-mode" data-mode="${k}" aria-pressed="${MESH.mode === k}">${label}</button>`;

    const live = MESH.live;
    const hist = MESH.history;
    const bench = MESH.bench;
    const benchSt = bench ? bench.st : null;
    const modeHint = {
      tcp: "برای هر اندپوینت مخزن، اول پورت خودِ همان اندپوینت و بعد شش پورت TLS، جداگانه و واقعاً از همین گوشی سنجیده می‌شود. پینگ فقط وقتی سبز می‌شود که پاسخ واقعی با زمان واقعی گرفته شده باشد؛ ردیف بی‌پاسخ هرگز پینگ صفر نمی‌گیرد. ستون ورکر برای رنج کلادفلر با ساب‌ریکوئست واقعی و برای بقیه با سوکت خام اندازه‌گیری می‌شود.",
      vless: "برای هر اندپوینت دو سنجش جدا: لایهٔ انتقال روی پورت خودِ اندپوینت و روی ۴۴۳، هم از دستگاه هم از ورکر. اثبات کامل پروتکل VLESS فقط با ترافیک واقعی اپ به‌دست می‌آید؛ هر اتصال واقعی در کارت «شواهد ترافیک واقعی» با کد مرکز داده ثبت می‌شود.",
      udp: "مرورگر سوکت UDP دلخواه ندارد؛ تنها سنجش واقعی UDP از داخل صفحه، WebRTC/STUN است. چند سرور STUN مستقل (هرکدام آی‌پی جدای خودش) تک‌به‌تک با پینگ و باخت واقعی سنجیده می‌شوند. ورکرهای کلادفلر APIی UDP ندارند، پس ستون ورکر عمداً «پشتیبانی نمی‌شود» است."
    };

    const famHeader = (st) => st && st.total ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:14px 4px 6px">
        <b style="font-size:12.5px">آی‌پی نسخهٔ ${st.fam === 6 ? "۶" : "۴"}</b>
        <span class="badge ${st.fam === 6 ? "info" : ""}">${v(st.total)} اندپوینت</span>
        <span class="badge ${st.open ? "ok" : "danger"}">${v(st.open)} پاسخ‌گو</span>
        <span class="badge ${st.bestMs === null ? "" : "ok"}">بهترین پینگ: ${meshMs(st.bestMs)}${st.bestMs === null ? "" : "ms"}</span>
        <span class="badge ${st.loss && st.loss >= 100 ? "danger" : "warn"}">باخت: ${meshMs(st.loss)}٪</span>
      </div>` : "";

    const tcpCard = (r) => {
      const best = meshBestMs(r);
      const own = Number(r.port);
      return `<div class="mrow">
        <div class="mrow-main">
          <div class="mono mrow-ep" dir="ltr">${a(r.ep)}</div>
          <div class="mrow-sub">
            <span class="badge ${r.fam === 6 ? "info" : ""}">IPv${r.fam === 6 ? "6" : "4"}</span>
            ${meshPingBadge(best < 9e9 ? best : null)}
            ${r.ports.map((p) => {
              const c = r.dev[p] || { state: "filtered" };
              const cls = c.state === "open" ? "ok" : c.state === "handshake" ? "ok" : c.state === "no-v6" ? "warn" : "danger";
              const isOwn = p === own;
              const tail = c.state === "open" || c.state === "handshake" ? " " + meshMs(c.ms) + "ms" : c.state === "no-v6" ? " بی‌مسیر" : " فیلتر";
              const ownStyle = isOwn ? ' style="outline:1.5px solid var(--accent);outline-offset:1px;font-weight:700"' : "";
              return `<span class="badge ${cls}" dir="ltr"${ownStyle} title="${isOwn ? "پورت خودِ این اندپوینت در مخزن" : ""}">${isOwn ? "خودش " : ""}${p}:${tail}</span>`;
            }).join("")}
            ${meshWkBadge(r.wk, own)}
            ${r.src === "user" ? '<span class="badge">گوشی خودت</span>' : ""}
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" data-action="omni-mesh-apply" data-ep="${a(r.ep)}">اعمال</button>
      </div>`;
    };

    const vlessCard = (r) => {
      const ping = meshNum(r.dev?.ms) ?? meshNum(r.dev443?.ms);
      return `<div class="mrow">
        <div class="mrow-main">
          <div class="mono mrow-ep" dir="ltr">${a(r.ep)}</div>
          <div class="mrow-sub">
            <span class="badge ${r.fam === 6 ? "info" : ""}">IPv${r.fam === 6 ? "6" : "4"}</span>
            ${meshPingBadge(ping)}
            ${meshDevBadge("پورت خودش " + r.port, r.dev)}
            ${Number(r.port) !== 443 ? meshDevBadge("۴۴۳", r.dev443) : ""}
            ${meshWkBadge(r.wk, Number(r.port))}
            ${r.src === "user" ? '<span class="badge">گوشی خودت</span>' : ""}
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" data-action="omni-mesh-apply" data-ep="${a(r.ep)}">اعمال</button>
      </div>`;
    };

    const groupedRows = (cardFn) => {
      const st4 = (run.famStats || []).find((s) => s.fam === 4);
      const st6 = (run.famStats || []).find((s) => s.fam === 6);
      const r4 = run.rows.filter((r) => r.fam !== 6);
      const r6 = run.rows.filter((r) => r.fam === 6);
      return famHeader(st4) + r4.map(cardFn).join("") + famHeader(st6) + r6.map(cardFn).join("");
    };

    const stunCard = (t) => {
      const reach = t.okCount > 0;
      return `<div class="mrow">
        <div class="mrow-main">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <b style="font-size:12.5px">${a(t.label)}</b>
            <span class="mono muted" dir="ltr" style="font-size:11px">${a(t.target)}</span>
          </div>
          <div class="mrow-sub" style="margin-top:6px">
            <span class="badge ${reach ? "ok" : "danger"}">${reach ? "پاسخ واقعی" : "بی‌پاسخ"}</span>
            <span class="badge">نمونه: ${v(t.okCount)}/${v(t.sent)}</span>
            <span class="badge">پینگ میانه: ${meshMs(t.st.p50)}${t.st.p50 === null ? "" : "ms"}</span>
            <span class="badge">بهترین: ${meshMs(t.samples.length ? Math.min.apply(null, t.samples) : null)}${t.samples.length ? "ms" : ""}</span>
            <span class="badge ${t.st.loss ? "warn" : "ok"}">باخت: ${meshMs(t.st.loss)}٪</span>
            ${t.fam ? `<span class="badge ${t.fam === 6 ? "info" : ""}">خروجی IPv${t.fam === 6 ? "6" : "4"}</span>` : ""}
            <span class="badge" title="ورکر هیچ APIی برای UDP ندارد">ورکر: پشتیبانی نمی‌شود</span>
          </div>
          ${t.ip ? `<div class="muted" style="font-size:11px;margin-top:7px" dir="ltr">آی‌پی عمومی برگشتی از STUN: ${a(t.ip)}</div>` : ""}
          <div class="muted" style="font-size:10.5px;margin-top:5px">تلاش‌ها: ${t.attempts.map((z) => `${z.i}:${z.ok ? meshMs(z.ms) + "ms" : "✗"}`).join(" · ")}</div>
        </div>
      </div>`;
    };

    const udpAggCard = () => {
      const s = run.summary;
      return `<div class="mrow" style="display:block;background:color-mix(in srgb,var(--accent) 6%,var(--bg-soft))">
        <b style="font-size:12px">جمع‌بندی همین دستگاه</b>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <span class="badge ${facts?.udp?.ok ? "ok" : "danger"}">UDP/STUN: ${facts?.udp?.ok ? "باز · " + meshMs(facts.udp.ms) + "ms" : "بی‌پاسخ"}</span>
          <span class="badge">سرورهای پاسخ‌گو: ${v(s.targetsOk)}/${v(s.targetsTotal)}</span>
          <span class="badge">نمونه: ${v(s.stunOk)}/${v(s.stunSent)}</span>
          <span class="badge">باخت کل: ${meshMs(run.st.loss)}٪</span>
          <span class="badge">میانه: ${meshMs(run.st.p50)}ms</span>
          <span class="badge">p95: ${meshMs(run.st.p95)}ms</span>
          <span class="badge">جیتر: ${meshMs(run.st.jitter)}ms</span>
          <span class="badge ${s.v6 ? "ok" : "warn"}">خروجی ${s.v6 ? "IPv6" : "IPv4-only"}</span>
          <span class="badge">خط: IPv${facts?.ipVersion === "IPv6" ? "6 دارد" : "4-only"}</span>
        </div>
        ${facts?.udp?.ip ? `<div class="muted" style="font-size:11px;margin-top:8px" dir="ltr">آی‌پی عمومی: ${a(facts.udp.ip)}</div>` : ""}
        <p class="muted" style="font-size:11.5px;margin:10px 0 0;line-height:1.9">مرورگر نمی‌تواند به آی‌پی دلخواه UDP بزند؛ پس به‌جای ردیف ساختگی، سرورهای STUN واقعیِ مستقل تک‌به‌تک سنجیده می‌شوند. اگر STUN پاسخ داد یعنی مسیر UDP این خط باز است و اپ‌های VLESS/Xray می‌توانند از همین مسیر استفاده کنند.</p>
      </div>`;
    };

    const edgeCard = () => `<div class="card" style="margin-top:12px">
      <div class="card-head">${d("activity")}<h3>شواهد ترافیک واقعی VLESS</h3><div class="spacer"></div></div>
      <p class="hint muted" style="margin-top:-4px;font-size:11.5px">هر ردیف از یک اتصال واقعی VLESS/Trojan که اپِ کاربران به این ورکر برقرار کرده ثبت شده — نه حدس و نه شبیه‌سازی.</p>
      ${(run.edges || []).length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px">
        ${run.edges.map((g2) => `<div class="mesh-metric"><span>colo ${a(g2.colo || "—")} · IPv${a(g2.fam)}</span><b style="font-size:15px">${v(g2.hits)} اتصال</b><span class="muted" style="font-size:10.5px">آخرین: ${a(meshFmtTime(g2.last_at))}</span></div>`).join("")}
      </div>` : `<p class="muted" style="font-size:12px;border:1px dashed var(--border);border-radius:12px;padding:18px;text-align:center">هنوز هیچ اتصال واقعی VLESS روی این ورکر ثبت نشده. بعد از وصل‌شدن اپ با کانفیگ همین پنل، شواهد واقعی اینجا ظاهر می‌شوند.</p>`}
    </div>`;

    const reachableTcp = (r) => r.ports.some((p) => r.dev[p]?.state === "open" || r.dev[p]?.state === "handshake");
    const reachableVless = (r) => [r.dev, r.dev443].some((c) => c && (c.state === "open" || c.state === "handshake"));
    const best = run && run.mode !== "udp" ? run.rows.find((r) => run.mode === "tcp" ? reachableTcp(r) : reachableVless(r)) : null;
    const bestMs = best ? (run.mode === "tcp" ? (meshBestMs(best) < 9e9 ? meshBestMs(best) : null) : (meshNum(best.dev.ms) ?? meshNum(best.dev443.ms))) : null;

    return `
  <section class="card mesh-hero">
    <div style="position:relative;z-index:1;max-width:900px">
      <div class="mesh-kicker">ROUTE LAB / rev146</div>
      <h2 class="mesh-title">آزمایشگاه مسیر — <em>سنجش واقعیِ خودِ اندپوینت‌های مخزن، با پینگ صادقانه</em></h2>
      <p class="muted" style="margin:0;max-width:760px">${a(modeHint[MESH.mode] || "")}</p>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:14px">
        <span class="badge info">${v(libCount)} اندپوینت مخزن</span>
        <span class="badge">حالت: ${a(MESH_MODE_LABEL[MESH.mode] || MESH.mode)}</span>
        <span class="badge ${run ? "ok" : "warn"}">${run ? "آخرین سنجش: " + a(meshFmtTime(run.at)) : "هنوز سنجیده نشده"}</span>
        ${facts?.net ? `<span class="badge">${a(facts.net.name || facts.net.code || "—")}${facts.ipVersion ? " · " + a(facts.ipVersion) : ""}</span>` : ""}
      </div>
    </div>
  </section>

  <div class="card" style="margin-top:12px">
    <div class="card-head">${d("globe")}<h3>سنجش خط من + ورکر</h3><div class="spacer"></div>
      <button class="btn btn-primary btn-sm" type="button" data-action="omni-mesh-race" ${MESH.running ? "disabled" : ""}>${d("play")} ${MESH.running ? "در حال سنجش تک‌تک آیتم‌ها…" : "شروع سنجش کامل"}</button>
    </div>
    <div class="mseg">
      ${modePill("tcp", "TCP / پورت‌ها")}
      ${modePill("vless", "VLESS / پروتکل")}
      ${modePill("udp", "UDP / STUN")}
    </div>
    ${facts && MESH.mode === "udp" ? `<div class="mrow" style="background:color-mix(in srgb,var(--accent) 6%,var(--bg-soft))">
      <div class="mrow-main"><b style="font-size:12px">وضعیت همین دستگاه</b>
        <div class="mrow-sub">
          <span class="badge ${facts.udp.ok ? "ok" : "danger"}">UDP/STUN: ${facts.udp.ok ? "باز · " + meshMs(facts.udp.ms) + "ms" : "بسته/بی‌پاسخ"}</span>
          <span class="badge">IPv6 خط: ${facts.ipVersion === "IPv6" ? "دارد" : facts.ipVersion === "IPv4" ? "ندارد (IPv4-only)" : "نامشخص"}</span>
          ${facts.udp.ip ? `<span class="badge" dir="ltr">خروجی: ${a(facts.udp.ip)}</span>` : ""}
        </div>
      </div>
    </div>` : ""}
    ${run && run.mode === "tcp" ? `<div class="notice ${run.summary.hostsOpen ? "ok" : "warn"}" style="margin:6px 0 10px;padding:10px">
      <b>${v(run.summary.hostsOpen)} میزبان پاسخ‌گو از ${v(run.summary.total)} · مجموع ${v(run.summary.openPorts)} پورت باز · ردیف بی‌مسیر v6: ${v(run.summary.noV6)} · ورکر ${v(run.summary.workerMeasured)} اندپوینت را واقعاً سنجید که ${v(run.summary.workerRoute || 0)} مورد تا مسیر کامل سرویس جواب داد</b>
      ${best ? `<div style="font-size:11.5px;margin-top:4px">بهترین: <code dir="ltr">${a(best.ep)}</code>${bestMs === null ? "" : " (" + meshMs(bestMs) + "ms)"}
        <button class="btn btn-sm" style="margin-inline-start:8px" type="button" data-action="omni-mesh-apply" data-ep="${a(best.ep)}">${d("check")} اعمال همین</button></div>` : ""}
    </div>` : ""}
    ${run && run.mode === "vless" ? `<div class="notice ${run.summary.transportOpen ? "ok" : "warn"}" style="margin:6px 0 10px;padding:10px">
      <b>لایهٔ انتقالِ ${v(run.summary.transportOpen)} اندپوینت از ${v(run.summary.total)} باز است · ورکر ${v(run.summary.workerMeasured)} ردیف را سنجید؛ ${v(run.summary.workerRoute || 0)} ردیف تا «مسیر کامل سرویس» (Host/Path واقعی) جواب داد، بقیه فقط لبه · شواهد ترافیک واقعی از ${v(run.summary.realTrafficColos)} مرکز داده</b>
      ${best ? `<div style="font-size:11.5px;margin-top:4px">بهترین لبه: <code dir="ltr">${a(best.ep)}</code>${bestMs === null ? "" : " (" + meshMs(bestMs) + "ms)"}
        <button class="btn btn-sm" style="margin-inline-start:8px" type="button" data-action="omni-mesh-apply" data-ep="${a(best.ep)}">${d("check")} اعمال همین</button></div>` : ""}
    </div>` : ""}
    ${run ? (MESH.mode === "udp"
      ? udpAggCard() + `<div style="max-height:520px;overflow:auto;padding:2px;margin-top:10px">${(run.targets || []).map(stunCard).join("")}</div>`
      : `<div style="max-height:560px;overflow:auto;padding:2px">${groupedRows(MESH.mode === "tcp" ? tcpCard : vlessCard)}</div>
        <p class="muted" style="font-size:11px;margin:9px 0 0">${MESH.mode === "tcp"
          ? "نشان «خودش» پورت واقعی همان اندپوینت در مخزن است؛ بقیه پورت‌ها هم جداگانه سنجیده شده‌اند. پینگ سبز یعنی پاسخ واقعی با زمان واقعی؛ «بدون پاسخ» یعنی هیچ پاسخی نگرفتیم و عددی ساخت نمی‌شود. ردیف‌های IPv6 روی خط بی‌v6 واقعاً تلاش می‌شوند."
          : "هر ردیف دو سنجش جدا دارد: پورت خودِ اندپوینت و ۴۴۳. اثبات کامل پروتکل فقط با ترافیک واقعی می‌آید (کارت شواهد). سنجش ورکر برای رنج کلادفلر با ساب‌ریکوئست و برای بقیه با سوکت خام انجام می‌شود."}</p>`)
      : `<p class="muted" style="font-size:12px;border:1px dashed var(--border);border-radius:12px;padding:18px;text-align:center">هنوز سنجشی انجام نشده. حالت را انتخاب کن و «شروع سنجش کامل» را بزن تا تک‌تک آیتم‌های مخزن سنجیده شوند.</p>`}
  </div>

  ${MESH.mode === "vless" && run ? edgeCard() : ""}

  <div class="card" style="margin-top:12px">
    <div class="card-head">${d("globe")}<h3>تشخیص سه‌لایه</h3><div class="spacer"></div>
      <button class="btn btn-primary btn-sm" type="button" data-action="omni-mesh-diag" ${MESH.diagBusy ? "disabled" : ""}>${MESH.diagBusy ? "در حال سنجش…" : "چرا وصلم نمی‌شود؟"}</button>
    </div>
    <p class="hint muted" style="margin-top:-4px;font-size:11.5px">سه سؤال جدا: DNS از خط تو، لبهٔ ۴۴۳ از خط تو، و مسیر خروج از دید ورکر.</p>
    ${MESH.diag ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px">
      <div class="mesh-metric"><span>DNS از خط تو (۴ ارائه‌دهنده)</span><b style="font-size:13px">${MESH.diag.dns === null ? "—" : MESH.diag.dns ? '<span style="color:var(--ok)">✓ باز</span>' : '<span style="color:var(--danger)">✗ بسته</span>'}</b>${MESH.diag.dnsVia ? `<span class="muted" style="font-size:10.5px">از ${a(MESH.diag.dnsVia)}</span>` : ""}</div>
      <div class="mesh-metric"><span>لبه از خط تو (۸ میزبان)</span><b style="font-size:13px">${MESH.diag.edge === null ? "—" : MESH.diag.edge ? '<span style="color:var(--ok)">✓ باز</span>' : '<span style="color:var(--danger)">✗ بسته</span>'}</b>${MESH.diag.edgeCount ? `<span class="muted" style="font-size:10.5px">${v(MESH.diag.edgeCount.ok)}/${v(MESH.diag.edgeCount.total)} پاسخ‌گو</span>` : ""}</div>
      <div class="mesh-metric"><span>خروج از دید ورکر · پورت خودِ اندپوینت</span><b style="font-size:13px">${MESH.diag.exit === null ? "—" : MESH.diag.exit ? '<span style="color:var(--ok)">✓ باز</span>' : '<span style="color:var(--danger)">✗ بسته</span>'}</b>${meshNum(MESH.diag.exitMs) !== null ? `<span class="muted" style="font-size:10.5px">${meshMs(MESH.diag.exitMs)}ms${MESH.diag.exitColo ? " · colo " + a(MESH.diag.exitColo) : ""} · ${a(MESH.diag.exitRoute ? "مسیر کامل" : MESH.diag.exitVia === "subrequest" ? "فقط لبه" : MESH.diag.exitVia || "—")}</span>` : (MESH.diag.exitState ? `<span class="muted" style="font-size:10.5px">وضعیت: ${a(MESH.diag.exitState)}</span>` : "")}${MESH.diag.exitService ? `<span class="muted" style="font-size:10.5px;color:${MESH.diag.exitService.route ? "var(--ok)" : "var(--warn)"}">سرویس خودِ ورکر: ${MESH.diag.exitService.route ? "پاسخ‌گوی کامل" : "بدون پاسخ سرویس"}${meshNum(MESH.diag.exitService.ms) !== null ? " · " + meshMs(MESH.diag.exitService.ms) + "ms" : ""}</span>` : ""}</div>
    </div>
    ${MESH.diag.exitEp ? `<div class="muted mono" style="font-size:10.5px;margin-top:7px" dir="ltr">اندپوینت سنجش خروج: ${a(MESH.diag.exitEp)}</div>` : ""}
    <div class="notice ${MESH.diag.dns && MESH.diag.edge && MESH.diag.exit ? "ok" : "warn"}" style="margin-top:10px;padding:10px">
      <b>${a(MESH.diag.title)}</b><div style="font-size:11.5px;margin-top:4px;line-height:1.9">${a(MESH.diag.detail)}</div>
      <div class="muted" style="font-size:10.5px;margin-top:6px">زمان سنجش: ${a(meshFmtTime(MESH.diag.at))}</div>
    </div>` : ""}
  </div>

  <div class="card" style="margin-top:12px">
    <div class="card-head">${d("refresh")}<h3>نسخه‌های زنده و مراقبت</h3><div class="spacer"></div>
      <span class="badge ${live?.watching ? "ok" : ""}">${live ? (live.watching ? "مراقبت روشن" : "مراقبت خاموش") : "…"}</span>
      <button class="btn btn-ghost btn-sm" type="button" data-action="omni-mesh-live-refresh">تازه‌سازی</button>
    </div>
    <p class="hint muted" style="margin-top:-4px;font-size:11.5px">اندپوینت‌ها از اندپوینت اعمال‌شده و مخزن IP همین پنل ساخته می‌شوند (هیچ نسخهٔ هاردکدی وجود ندارد). وقتی مراقبت روشن باشد، تا وقتی همین پنل باز است هر ۶۰ ثانیه یک بار ورکر سه نسخه را روی پورت خودشان می‌سنجد؛ در پس‌زمینهٔ بستهٔ پنل قولی نمی‌دهیم.</p>
    ${live ? (live.slots && live.slots.length ? live.slots.map((r) => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line)">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${r.state === "ok" ? "var(--ok)" : r.state ? "var(--danger)" : "var(--text-faint)"};flex:none"></span>
        <div style="flex:1;min-width:0">
          <div class="mono" dir="ltr" style="font-size:11.5px;word-break:break-all">${a(r.ep)}</div>
          <div class="muted" style="font-size:10.5px">IPv${r.fam === 6 ? 6 : 4}${r.label ? " · " + a(r.label) : ""} · ${r.state === "ok" ? "سالم" : r.state ? "بی‌جواب" : "سنجیده نشده"}${r.ms != null ? " · " + meshMs(r.ms) + "ms" : ""}${r.via ? " · " + (r.via === "subrequest" ? "ساب‌ریکوئست" : "سوکت") : ""}${r.fails ? " · " + v(r.fails) + " شکست پیاپی" : ""}</div>
        </div>
        ${r.active ? '<span class="badge ok">فعال</span>' : `<button class="btn btn-ghost btn-sm" type="button" data-action="omni-mesh-live-set" data-ep="${a(r.ep)}" ${MESH.liveBusy ? "disabled" : ""}>بگذار</button>`}
      </div>`).join("") : '<p class="muted" style="font-size:12px">هنوز اندپوینت فعالی برای ساخت نسخه‌ها ذخیره نشده؛ یک سنجش کامل انجام بده و دکمهٔ زیر را بزن تا سه نسخه از بهترین اندپوینت‌های پاسخ‌گو ساخته شود.</p>')
      : '<p class="muted" style="font-size:12px">در حال خواندن وضعیت ورکر…</p>'}
    ${live ? `<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
      ${(!live.slots || !live.slots.length) ? `<button class="btn btn-primary btn-sm" type="button" data-action="omni-mesh-apply-best" ${MESH.liveBusy ? "disabled" : ""}>ساخت نسخهٔ زنده از بهترین سنجش</button>` : ""}
      <button class="btn btn-sm" type="button" data-action="omni-mesh-live-next" ${MESH.liveBusy || !live.slots?.length ? "disabled" : ""}>جابه‌جایی به نسخهٔ بعد</button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="omni-mesh-live-tick" ${MESH.liveBusy ? "disabled" : ""}>${MESH.liveBusy === "tick" ? "در حال سنجش…" : "همین حالا بسنج"}</button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="omni-mesh-live-watch" data-on="${live.watching ? "0" : "1"}">${live.watching ? "خاموش کردن مراقبت" : "روشن کردن مراقبت"}</button>
    </div>
    ${Array.isArray(live.events) && live.events.length ? `<div style="margin-top:9px;padding-top:8px;border-top:1px solid var(--line)">
      ${live.events.map((ev) => `<div class="muted" style="font-size:10.5px;line-height:1.9">• <b>${a(meshFmtTime(ev.at))}</b> — ${a(ev.reason || "")}${ev.frm && ev.frm !== ev.dst ? ` (<span class="mono" dir="ltr">${a(ev.frm)} → ${a(ev.dst)}</span>)` : ""}</div>`).join("")}
    </div>` : ""}` : ""}
  </div>

  <div class="card" style="margin-top:12px">
    <div class="card-head">${d("activity")}<h3>پروندهٔ همین خط</h3><div class="spacer"></div>
      <button class="btn btn-ghost btn-sm" type="button" data-action="omni-mesh-history">تازه‌سازی</button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="omni-mesh-reset" ${MESH.resetBusy ? "disabled" : ""} style="color:var(--danger)">${MESH.resetBusy ? "در حال پاک‌سازی…" : "پاک‌سازی همهٔ داده‌ها"}</button>
    </div>
    ${hist && hist.mine ? `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div style="display:flex;align-items:baseline;gap:4px"><b style="font-size:34px;line-height:1;color:${hist.mine.score >= 70 ? "var(--ok)" : hist.mine.score >= 45 ? "var(--warn)" : "var(--danger)"}" dir="ltr">${v(hist.mine.score)}</b><span class="muted" style="font-size:12px">/۱۰۰</span></div>
      <div style="flex:1;min-width:210px;font-size:11.5px;line-height:2">
        <div>سنجش‌های ثبت‌شده: <b>${v(hist.mine.samples)}</b> · موفقیت: <b>${v(Math.round(hist.mine.succ * 100))}٪</b> · میانه: <b dir="ltr">${meshMs(hist.mine.p50)}ms</b> · باخت: <b>${v(hist.mine.loss)}٪</b></div>
        ${hist.mine.best ? `<div>بهترین: <code dir="ltr">${a(hist.mine.best.ep)}</code> · ${v(Math.round(hist.mine.best.succ * 100))}٪ موفق</div>` : ""}
        ${hist.mine.worst ? `<div>بدترین: <code dir="ltr">${a(hist.mine.worst.ep)}</code></div>` : ""}
        <div class="muted" style="font-size:10.5px">فرمول: ${a(hist.weights || "")} — فقط دادهٔ همین خط طی ۱۴ روز</div>
      </div>
    </div>` : `<p class="muted" style="font-size:12px">تا این لحظه یک سنجش واقعی هم برای این خط در سرور ثبت نشده. بعد از اولین «شروع سنجش کامل»، امتیاز و تاریخچه همین‌جا ساخته می‌شود؛ هیچ عدد قرض‌گرفته‌ای از اپراتور دیگر نشان داده نمی‌شود.</p>`}
    <div class="muted" style="font-size:11px;margin:12px 0 5px">ساعت‌های موفق سنجش (به وقت محلی مرورگر) — ${hist ? v(hist.samples) : 0} نمونهٔ ثبت‌شده:</div>
    <div class="mheat">${(hist ? hist.hours : Array.from({ length: 24 }, () => ({ total: 0, ok: 0 }))).map((h2) => {
      const ratio = h2.total ? h2.ok / h2.total : 0;
      const bg = !h2.total ? "transparent" : ratio > 0.66 ? "var(--ok)" : ratio > 0.33 ? "var(--warn)" : "var(--danger)";
      return `<i class="${h2.total ? "on" : ""}" style="background:${bg}" title="${h2.ok}/${h2.total}"></i>`;
    }).join("")}</div>
    <div class="muted" style="display:flex;justify-content:space-between;font-size:10.5px;margin-top:3px" dir="ltr"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
  </div>

  <div class="card" style="margin-top:12px">
    <div class="card-head">${d("activity")}<h3>پینگ تا پنل (WebSocket)</h3><div class="spacer"></div>
      <button class="btn btn-sm" type="button" data-action="omni-mesh-bench" ${MESH.benchBusy ? "disabled" : ""}>${MESH.benchBusy ? "…" : "۲۰ پینگ پشت‌سرهم"}</button>
    </div>
    <p class="hint muted" style="margin-top:-4px;font-size:11.5px">مسیر واقعی مرورگرِ همین گوشی تا خود پنل روی WSS — نه تونل WARP. میانه، p95، جیتر و باخت از ۲۰ نمونهٔ واقعی محاسبه می‌شود.</p>
    <div class="mesh-metric-grid" style="margin-top:10px">
      <div class="mesh-metric"><span>میانه</span><b>${benchSt && benchSt.p50 != null ? meshMs(benchSt.p50) + " ms" : "—"}</b></div>
      <div class="mesh-metric"><span>p95</span><b>${benchSt && benchSt.p95 != null ? meshMs(benchSt.p95) + " ms" : "—"}</b></div>
      <div class="mesh-metric"><span>جیتر</span><b>${benchSt && benchSt.jitter != null ? meshMs(benchSt.jitter) + " ms" : "—"}</b></div>
      <div class="mesh-metric"><span>باخت</span><b style="color:${benchSt && benchSt.loss ? "var(--danger)" : "var(--ok)"}">${benchSt ? v(benchSt.loss) + "٪" : "—"}</b></div>
    </div>
    ${bench && bench.samples.length ? `<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px">${meshSparkline(bench.samples)}<span class="muted" style="font-size:11px" dir="ltr">${bench.samples.slice(0, 20).join(", ")}</span></div>` : ""}
  </div>

  <details class="card" style="margin-top:12px"><summary class="muted" style="cursor:pointer;font-size:12px">مسیریابی مستقیم دامنه‌های حساس</summary>
    <div class="field" style="margin-top:8px"><textarea id="mesh-direct-domains" rows="2" dir="ltr" placeholder="bank.example&#10;internal.example">${a(Re(e.settings?.mesh_direct_domains).join("\n"))}</textarea><span class="hint">هر خط یک دامنه؛ فقط در خروجی‌های sing-box و Clash مستقیماً عبور می‌کند.</span></div>
    <button class="btn btn-sm" type="button" data-action="omni-mesh-save-domains">${d("check")} ذخیره دامنه‌ها</button>
  </details>`;
  }
