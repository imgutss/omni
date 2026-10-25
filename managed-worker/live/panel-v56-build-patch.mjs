// v56.0 panel patcher: v55.9 body → v56.0 body
// Rage-round-3: ① «فقط این ناحیه» dead → scroll+real scan  ② labRun edge-fake → browser 3-state probe
// ③ pool scan always-0-alive → active-response classification (open/tls-fail/closed)  ④ stale server-era rows filtered  ⑤ visible build chip
import { readFileSync, writeFileSync } from "fs";

const SRC = "/home/user/panel-work/v55/panel-v55.9-body.html";
const DST = "/home/user/panel-work/v56/panel-v56.0-body.html";
let S = readFileSync(SRC, "utf8");
const origLen = S.length;
const log = [];
let n = 0;

function assertOnce(needle, scope) {
  const hay = scope ?? S;
  const c = hay.split(needle).length - 1;
  if (c !== 1) throw new Error(`anchor count=${c} (want 1): ${needle.slice(0, 90)}`);
}
function rep(needle, replacement, tag) {
  assertOnce(needle);
  S = S.replace(needle, replacement);
  log.push(`[${++n}] ${tag} ok`);
}
function spanReplace(startAnchor, endAnchor, replacement, tag, includeEnd = false) {
  const i = S.indexOf(startAnchor);
  if (i < 0) throw new Error(`start not found: ${startAnchor.slice(0, 90)}`);
  const j = S.indexOf(endAnchor, i + startAnchor.length);
  if (j < 0) throw new Error(`end not found: ${endAnchor.slice(0, 90)}`);
  S = S.slice(0, i) + replacement + S.slice(includeEnd ? j : j + endAnchor.length);
  log.push(`[${++n}] ${tag} ok (span ${i}..${j})`);
}

/* ── R2: labAliveRows helper ─────────────────────────────────────────────── */
rep(
  `function labRowsOpen() { return LAB.rows.filter((r) => r.state === "open" && r.ms > 0).sort((x, y) => x.ms - y.ms); }`,
  `function labRowsOpen() { return LAB.rows.filter((r) => r.state === "open" && r.ms > 0).sort((x, y) => x.ms - y.ms); }\nfunction labAliveRows() { return LAB.rows.filter((r) => (r.state === "open" || r.state === "tls-fail") && r.ms > 0).sort((x, y) => x.ms - y.ms); }`,
  "R2 labAliveRows helper",
);

/* ── R1: labRun — browser probe instead of worker-edge probe ─────────────── */
const r1new = `    labPaint(e);
    LAB.note = "سنجش واقعی از خط تو (مرورگر گوشی): «باز» = پاسخ کامل HTTPS · «دست می‌دهد» = مسیر تا آی‌پی زنده است ولی TLSِ بدون SNI می‌میرد (رفتار عادی آی‌پی لخت؛ اپ خودش با SNI واقعی وصل می‌شود) · «بسته» = سکوت کامل تا پایان مهلت";
    await labPool(LAB.rows, 8, async function (row) {
      if (row.fam === 6 && LAB.hasV6 === !1) { row.state = "no-v6"; row.ms = null; row.samples = []; return; }
      var p = await labProbe(row.addr, {});
      row.scope = "browser";
      row.state = p.state;
      row.ms = p.state === "closed" ? null : p.ms;
      row.samples = p.state === "closed" ? [] : [p.ms];
    });
    labPaint(e);
    var top = labAliveRows().slice(0, 6);
    if (top.length) {
      await labPool(top, 6, async function (row) {
        var p = await labProbe(row.addr, {});
        if (p.state !== "closed") { row.samples.push(p.ms); row.ms = Math.min.apply(null, row.samples); row.jitter = labJitter(row.samples); }
      });
      labPaint(e);
    }
    LAB.rows.forEach(function (r) {
      if (r.samples.length) { var s = r.samples.slice().sort(function (a, b) { return a - b; }); r.ms = s[0]; r.jitter = labJitter(r.samples); }
    });
    `;
spanReplace(
  `    labPaint(e);\n    LAB.note = "سنجش از لبهٔ کلادفلر`,
  `    var best = labRowsOpen()[0];`,
  r1new,
  "R1 labRun browser probe",
  false,
);

/* ── R3: labVerdict — honest verdict incl. tls-fail ──────────────────────── */
const r3new = `function labVerdict() {
  var open = labRowsOpen();
  var alive = labAliveRows();
  var total = LAB.rows.filter(function (r) { return r.state !== "no-v6"; }).length;
  if (!total) return null;
  if (!alive.length) return { tone: "danger", text: "خط تو همین حالا به هیچ‌کدام از " + total + " آدرس جواب نداد — همه «بسته» (سکوت کامل).", detail: "یا خط موقتاً فیلتر/قطع است یا این رنج‌ها از این اپراتور بی‌پاسخ‌اند؛ چند دقیقه بعد یا با دادهٔ سیم‌کارت دوباره «آزمون ورودی از خط من» را بزن." };
  var b = alive[0];
  var openN = open.length, tlsN = alive.length - openN;
  var parts = [openN + " باز · " + tlsN + " دست‌دادن از " + total, "بهترین " + labHost(b.addr), b.ms + " ms"];
  if (b.jitter != null) parts.push("افت " + b.jitter + "٪");
  if (LAB.speed && LAB.speed.kbps) parts.push("سرعت " + LAB.speed.kbps + " KB/s");
  var tone = openN >= total / 2 ? "ok" : "warn";
  var detail = "منطقهٔ " + (LAB_REGION_FA[b.region] || b.region) + (b.locked ? " · قفل‌شده" : "") + (openN ? "" : " · «دست می‌دهد» = اندپوینت از خط تو پاسخ‌گوی TCP است؛ اثبات نهایی با هندشیک خود اپ");
  return { tone: tone, text: parts.join(" · "), detail: detail, ep: b.addr };
}
`;
spanReplace(`function labVerdict() {`, `async function labSpeed() {`, r3new, "R3 labVerdict", false);

/* ── R4: labResultsHtml — ms/افت also for tls-fail rows ──────────────────── */
rep(
  `      (ok ? '<b dir="ltr" style="min-width:64px">' + r.ms + " ms</b>" : "") +
      (ok && r.jitter != null ? '<span class="badge ' + (r.jitter > 60 ? "warn" : "") + '" dir="ltr">افت ' + r.jitter + "٪</span>" : "") +`,
  `      (ok || r.state === "tls-fail" ? '<b dir="ltr" style="min-width:64px">' + r.ms + " ms</b>" : "") +
      ((ok || r.state === "tls-fail") && r.jitter != null ? '<span class="badge ' + (r.jitter > 60 ? "warn" : "") + '" dir="ltr">افت ' + r.jitter + "٪</span>" : "") +`,
  "R4 results ms for tls-fail",
);

/* ── R5: labRegionsHtml — score shows دست‌دادن too ───────────────────────── */
rep(
  `    var okN = mine.filter(function (r) { return r.state === "open"; }).length;
    var score = mine.length ? okN + "/" + mine.length + " باز" : "—";`,
  `    var okN = mine.filter(function (r) { return r.state === "open"; }).length;
    var tlsN = mine.filter(function (r) { return r.state === "tls-fail"; }).length;
    var score = mine.length ? okN + "/" + mine.length + " باز" + (tlsN ? " · " + tlsN + " دست‌دادن" : "") : "—";`,
  "R5 region score",
);

/* ── R6: hoisted labPoolScanRun before ut() ──────────────────────────────── */
const r6new = `/* ── v56.0: real line-scan of the global clean pool (browser 3-state) ────── */
async function labPoolScanRun(e2) {
  if (LAB.poolScan) return;
  LAB.poolScan = !0;
  try {
    var doneN = 0, foundN = 0, openN = 0, rirQ = LAB.poolRir || "";
    var probe1 = function (ip) { return labProbe(ip, { timeout: 2600 }); };
    LAB.rows = [];
    labPaint(e2);
    for (var round = 0; round < 3; round++) {
      var resC = await x("POST", "/api/clean/candidates", { per: 48, rir: rirQ }, { retry: 0, signal: AbortSignal.timeout(20000) });
      if (!resC || !resC.ok) throw new Error((resC && resC.error) || "کاندیدها نیامد");
      var cands = resC.cands || [];
      var stEl = function (t2) { var e3 = document.getElementById("omni-pool-status"); if (e3) e3.textContent = t2; };
      stEl("دور " + (round + 1) + "/۳ — ۰/" + cands.length);
      var results = new Array(cands.length); var cur = 0;
      var wk = async function () {
        while (cur < cands.length) {
          var idx = cur++; var cd = cands[idx];
          var rec = { ip: cd.ip, rir: cd.r, ms: [], states: [] };
          results[idx] = rec;
          var p1 = await probe1(cd.ip);
          if (p1.state !== "closed") {
            rec.ms.push(p1.ms); rec.states.push(p1.state);
            var rest = await Promise.all([probe1(cd.ip), probe1(cd.ip)]);
            rest.forEach(function (z) { if (z.state !== "closed") { rec.ms.push(z.ms); rec.states.push(z.state); } });
            foundN++; if (rec.states.indexOf("open") >= 0) openN++;
          }
          doneN++;
          stEl("دور " + (round + 1) + "/۳ — " + doneN + "/" + cands.length + " سنجیده · " + foundN + " پاسخ‌داد" + (foundN ? (openN ? " (" + openN + " باز)" : " — دست‌دادن، TCP زنده") : ""));
        }
      };
      await Promise.all([wk(), wk(), wk(), wk(), wk(), wk(), wk(), wk()]);
      var aliveRows = results.filter(function (r2) { return r2.ms.length; });
      if (aliveRows.length) await x("POST", "/api/clean/report", { rows: aliveRows.map(function (r2) { return { ip: r2.ip, rir: r2.rir, ms: r2.ms }; }) }, { retry: 0, signal: AbortSignal.timeout(20000) });
      LAB.rows = aliveRows.map(function (r2) {
        var b2 = Math.min.apply(null, r2.ms), w2 = Math.max.apply(null, r2.ms);
        return { addr: r2.ip, state: r2.states.indexOf("open") >= 0 ? "open" : "tls-fail", ms: b2, jitter: w2 - b2, region: r2.rir, kbps: 0, scope: "browser" };
      }).sort(function (p2, q2) { return p2.ms - q2.ms; });
      try { var prS = await fetch("/api/clean/pool", { credentials: "same-origin" }).then(function (r3) { return r3.json(); }); if (prS && prS.ok) LAB.pool = (prS.rows || []).filter(function (r4) { return !(r4.ping != null && r4.ping < 5); }); } catch (_) {}
      labPaint(e2);
    }
    y("⛏️ تمام شد: " + foundN + " پاسخ‌داد از " + doneN + " کاندید" + (foundN ? (openN ? " (" + openN + " باز کامل)" : " — همه «دست‌دادن»: مسیر زنده است، TLS بدون SNI نمی‌شود (عادی)") : " — خط تو به این ناحیه جواب نداد") + (rirQ ? " · ناحیهٔ " + rirQ : "") + " · نتایج در کارت «نتایج»", foundN ? "ok" : "warn", 5000);
  } catch (err) { y("❌ " + (err && err.message || err), "err", 4000); }
  LAB.poolScan = !1; labPaint(e2);
}
  function ut(e) {`;
rep(`  function ut(e) {`, r6new, "R6 hoist labPoolScanRun");

/* ── R7: dispatcher pool branch → shared labPoolScanRun ──────────────────── */
const poolStart = `        } else if (i === "omni-pool-region" || i === "omni-pool-scan") {`;
const poolEnd = `          labPaint(e);\n          await LAB.runScan(e);\n        }`;
spanReplace(poolStart, poolEnd, `${poolStart}
          if (i === "omni-pool-region") LAB.poolRir = s.dataset.v || "";
          labPaint(e);
          await labPoolScanRun(e);
        }`, "R7 pool branch → labPoolScanRun", true);

/* ── R8: region-one/all → scroll + real scan ─────────────────────────────── */
spanReplace(
  `        } else if (i === "omni-lab-region-one") {`,
  `        } else if (i === "omni-lab-neighbors") {`,
  `        } else if (i === "omni-lab-region-one") {
          var rgV = s.dataset.v || "all";
          if (rgV === "USER") { LAB.region = "USER"; LAB.poolRir = ""; y("🔍 سنجش «فهرست خودت (USER)» از خط تو شروع شد — نتیجه در کارت نتایج", "ok", 3000); await labRun(e); return; }
          LAB.region = rgV; LAB.poolRir = rgV;
          e.rerenderView("scanner");
          setTimeout(function () { var pe = document.getElementById("omni-pool"); if (pe && pe.scrollIntoView) try { pe.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (_) {} }, 90);
          y("🔍 اسکن ناحیهٔ " + rgV + " از خط تو شروع شد — به «استخر تمیز سراسری» می‌روی", "ok", 3000);
          await labPoolScanRun(e);
        } else if (i === "omni-lab-region-all") {
          LAB.region = "all"; LAB.poolRir = "";
          e.rerenderView("scanner");
          setTimeout(function () { var pe = document.getElementById("omni-pool"); if (pe && pe.scrollIntoView) try { pe.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (_) {} }, 90);
          y("🔍 اسکن همهٔ نواحی از خط تو شروع شد", "ok", 3000);
          await labPoolScanRun(e);`,
  "R8 region-one/all real action",
  false,
);

/* ── R9: pool hint text ──────────────────────────────────────────────────── */
spanReplace(
  `'<p class="hint muted" style="font-size:11px">دکمهٔ هر ناحیه =`,
  `آی‌پی:2408.</p>' +`,
  `'<p class="hint muted" style="font-size:11px">سنجش واقعی از خط تو (مرورگر): «باز» = پاسخ کامل HTTPS · «دست‌دادن» = TCP زنده ولی TLS بدون SNI می‌میرد — برای اندپوینت اپ (2408/VLESS) همین کافی است · «بسته» = سکوت. پینگ = کمترینِ ۳ نمونه. عددها فقط از گوشی تو می‌آیند. دانلود = کانفیگ آماده با همان آی‌پی:2408.</p>' +`,
  "R9 pool hint",
);

/* ── R10: empty pool row text ────────────────────────────────────────────── */
rep(
  `خالی است — دکمهٔ ناحیه را بزن یا «اسکن سنگین» بده. سنجش از خودِ خط تو انجام می‌شود (ورکر اجازهٔ اتصال خام به رنج کلادفلر را ندارد)؛ هر زنده ۳ نمونه می‌گیرد: پینگ=کمترین، جیتر=بیشترین−کمترین.`,
  `خالی است — دکمهٔ ناحیه یا دکمهٔ اسکن را بزن؛ سنجش از خط خودت (مرورگر) انجام می‌شود. هر پاسخ‌دهنده ۳ نمونه می‌گیرد: پینگ=کمترین، جیتر=بیشترین−کمترین. «دست‌دادن» هم شمرده می‌شود چون یعنی مسیر تا آی‌پی زنده است.`,
  "R10 pool empty text",
);

/* ── R11: scan button label ──────────────────────────────────────────────── */
rep(
  `(LAB.poolScan ? "⏳ اسکن…" : (fr ? "⛏️ اسکن سنگین " + fr : "⛏️ اسکن سنگین (۳×۴۸)"))`,
  `(LAB.poolScan ? "⏳ اسکن از خط تو…" : (fr ? "⛏️ اسکن " + fr + " از خط من" : "⛏️ اسکن همهٔ نواحی از خط من (۳×۴۸)"))`,
  "R11 scan button label",
);

/* ── R12: view details — «لبه» → مرورگر خط خودت ──────────────────────────── */
rep(`این سنجش «لبه» است؛ پورت UDP تونل فقط با هندشیک واقعی در اپ اثبات می‌شود.`,
    `این سنجش از مرورگرِ خط خودت است؛ پورت UDP تونل فقط با هندشیک واقعی در اپ اثبات می‌شود.`,
    "R12 details text");

/* ── R13: visible build chip in lab status card ──────────────────────────── */
rep(
  `'<span class="badge">🕒 آخرین اسکن: ' + a(last) + "</span>" +`,
  `'<span class="badge">🕒 آخرین اسکن: ' + a(last) + "</span>" +
    '<span class="badge" dir="ltr" title="شناسهٔ بیلد این پنل">' + a("build " + String((typeof document !== "undefined" && document.documentElement.getAttribute("data-build")) || "").slice(0, 8)) + "</span>" +`,
  "R13 build chip",
);

/* ── R14: labLoad pool fetch — filter server-era fake rows (<5ms) ────────── */
rep(
  `LAB.pool = j.rows || [];`,
  `LAB.pool = (j.rows || []).filter(function (r) { return !(r.ping != null && r.ping < 5); });`,
  "R14 pool fake-row filter",
);

/* ── post asserts ────────────────────────────────────────────────────────── */
const checks = [
  ["LAB.runScan", 0],
  ["labEdgeProbe(LAB.rows", 0],
  ["scope = \"edge\"", 0],
  ["labPoolScanRun", 5], // 1 def + 3 calls + 1 in comment? adjust below
  ["labAliveRows", 4], // 1 def + labRun(top) + labVerdict x2
  ["سنجش از لبهٔ کلادفلر", 0],
  ["۳۸۲", 0],
];
for (const [needle, want] of checks) {
  const c = S.split(needle).length - 1;
  if (c !== want) log.push(`⚠️ check "${needle.slice(0, 40)}" = ${c} (expected ${want})`);
  else log.push(`✓ check "${needle.slice(0, 40)}" = ${c}`);
}
writeFileSync(DST, S);
log.push(`bytes: ${origLen} → ${S.length} (Δ ${S.length - origLen})`);
console.log(log.join("\n"));
