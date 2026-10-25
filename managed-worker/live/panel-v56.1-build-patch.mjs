import { readFileSync, writeFileSync } from "fs";
let S = readFileSync("panel-v56.0-body.html", "utf8");
const log = [];
function rep(bad, good, tag) {
  const c = S.split(bad).length - 1;
  if (c !== 1) throw new Error(`[${tag}] anchor count=${c}`);
  S = S.replace(bad, good);
  log.push(`[${tag}] ok`);
}
rep(`    if (best) {\n      var sp = await labSpeed();`,
    `    var best = labRowsOpen()[0];\n    if (best) {\n      var sp = await labSpeed();`, "P1 var best");
rep(`          await labPoolScanRun(e);\n          await labNeighbors(e);\n        } else if (i === "omni-lab-stall") {`,
    `          await labPoolScanRun(e);\n        } else if (i === "omni-lab-neighbors") {\n          await labNeighbors(e);\n        } else if (i === "omni-lab-stall") {`, "P2 neighbors header");
rep(`      var cands = resC.cands || [];`,
    `      var cands = resC.cands || [];
      try {
        if (!LAB.ranges) await labRanges();
        var seenC = {}; cands.forEach(function (cc) { seenC[cc.ip] = 1; });
        var extra = [];
        ((LAB.ranges && LAB.ranges.regions) || []).forEach(function (rg) {
          if (rirQ && rg.code !== rirQ) return;
          ((rg.seeds && rg.seeds.v4) || []).slice(0, 6).forEach(function (ip4) { if (!seenC[ip4]) { seenC[ip4] = 1; extra.push({ ip: ip4, r: rg.code }); } });
          ((rg.seeds && rg.seeds.v6) || []).slice(0, 4).forEach(function (ip6) { if (!seenC[ip6]) { seenC[ip6] = 1; extra.push({ ip: ip6, r: rg.code }); } });
        });
        cands = cands.concat(extra);
      } catch (_) {}`, "P3 v6 candidates");
rep(`    var ep = r.ip + ":2408";`,
    `    var ep = (String(r.ip).indexOf(":") >= 0 ? "[" + r.ip + "]" : r.ip) + ":2408";`, "P4 ep v6");
rep(`          var linkV = "vless://" + uuidV + "@" + ipV + ":443?`,
    `          var hostPartV = ipV.indexOf(":") >= 0 ? "[" + ipV + "]" : ipV;\n          var linkV = "vless://" + uuidV + "@" + hostPartV + ":443?`, "P5 vless v6");
rep(`"⛏️ اسکن همهٔ نواحی از خط من (۳×۴۸)"))`,
    `"⛏️ اسکن همهٔ نواحی از خط من (۳ دور)"))`, "P6 label");
for (const [needle, want] of [
  ["var best = labRowsOpen()[0];", 1],
  ["omni-lab-neighbors", 2],
  ["await labNeighbors(e);", 1],
  ["labPoolScanRun", 4],
  ["seenC", 6],
  ["LAB.runScan", 0],
]) {
  const c = S.split(needle).length - 1;
  if (c !== want) throw new Error("assert fail: " + needle.slice(0, 40) + " = " + c + " want " + want);
  log.push("OK " + needle.slice(0, 40) + " = " + c);
}
writeFileSync("panel-v56.1-body.html", S);
log.push("bytes: " + S.length);
console.log(log.join("\n"));
