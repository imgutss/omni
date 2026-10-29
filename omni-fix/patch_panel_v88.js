// rev148 panel patch — dedicated ECH section in the config builder.
// Replaces the old single workers.dev/v4-only ECH switch with a full card
// (shell DNS discovery vs embedded base64, resolver/domain controls, live DoH refresh),
// and threads honest ECH payloads through URI / sing-box / mihomo outputs.
const fs = require('fs');
let html = fs.readFileSync('/home/user/omni-fix/panel.v87.final.html', 'utf8');
const edits = [];
function rep(oldT, newT, label, expect = 1) {
  const n = html.split(oldT).length - 1;
  if (n !== expect) throw new Error(`anchor count ${n} (expected ${expect}) for: ${label}`);
  html = html.split(oldT).join(newT);
  edits.push(label);
}

/* 1) g state gains the ECH fields */
rep(
  'aetherIp: "v6", v6fm: !1, ech: !1, srcMode: "auto"',
  'aetherIp: "v6", v6fm: !1, ech: !1, echMode: "shell", echDomain: "cloudflare-ech.com", echResolver: "1.1.1.1", echB64: "AEX+DQBBXgAgACBsvLac2HVdvp+J2QTKPNjn24b5D6yHyxAcG0m+cmDcXAAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA=", echV6: !1, srcMode: "auto"',
  'g state extended with ECH fields'
);

/* 2) old hardcoded constants -> rev148 ECH library */
const oldConsts = `  var OMNI_ECH_B64 = "AEX+DQBBEAAgACC8Pj+HmS7QtM01/LLssahZYzqLh8LsFmJGbrIfNQl+EQAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA=";
  var OMNI_ECH_OK = /(^|\\.)workers\\.dev$/i;`;
const lib = fs.readFileSync('/home/user/omni-fix/.ech_lib_v88.js', 'utf8').replace(/\n$/, '');
rep(oldConsts, lib, 'OMNI_ECH_* constants replaced by rev148 ECH library');

/* 3) URI builder: ECH row flag + forced chrome + cs suppression */
rep(
  `          let useFrag = Boolean(g.fragment);
          let fpVal = g.fp || "chrome";`,
  `          let useFrag = Boolean(g.fragment);
          let fpVal = g.fp || "chrome";
          const echRow = omniEchOn(p);
          if (echRow) fpVal = "chrome";`,
  'URI builder computes echRow and forces chrome'
);
rep(
  `              ...(g.ech && !p.includes(":") && OMNI_ECH_OK.test(s) ? [\`ech=\${OMNI_ECH_B64}\`] : []),`,
  `              ...(echRow ? [\`ech=\${omniEchUriPayload()}\`] : []),`,
  'URI ech param now uses rev148 payload helper'
);
rep(
  'if (M && g.alpn) params.push(`alpn=${encodeURIComponent(g.alpn)}`); if (M && g.cs) params.push(`cs=${encodeURIComponent(g.cs)}`);',
  'if (M && g.alpn) params.push(`alpn=${encodeURIComponent(g.alpn)}`); if (M && g.cs && !echRow) params.push(`cs=${encodeURIComponent(g.cs)}`);',
  'cipherSuites suppressed on ECH rows'
);
rep(
  'let q = `#${idxStr} ${catLbl}${useFrag ? " [F&F]" : ""} · ${shortAddrTag(p)}:${$} (${exitBadge} · ${k.toUpperCase()})`;',
  'let q = `#${idxStr} ${catLbl}${useFrag ? " [F&F]" : ""}${echRow ? " [ECH]" : ""} · ${shortAddrTag(p)}:${$} (${exitBadge} · ${k.toUpperCase()})`;',
  'ECH badge added to remark'
);
rep(
  `            if (g.ech && OMNI_ECH_OK.test(s)) p2.push(\`ech=\${OMNI_ECH_B64}\`);`,
  `            if (omniEchOn(p)) p2.push(\`ech=\${omniEchUriPayload()}\`);`,
  'TCI twin uses rev148 ECH helper'
);

/* 4) sing-box outbound tls.ech (documented shapes only) */
rep(
  `      tls: {
        enabled: p.tls,
        server_name: s,
        insecure: p.fp === "unsafe",
        utls: p.tls
          ? { enabled: !0, fingerprint: p.fp === "unsafe" ? "chrome" : p.fp }
          : void 0,
      },`,
  `      tls: {
        enabled: p.tls,
        server_name: s,
        insecure: p.fp === "unsafe",
        utls: p.tls
          ? { enabled: !0, fingerprint: p.fp === "unsafe" ? "chrome" : p.fp }
          : void 0,
        ...(p.tls && omniEchOn(p.addr)
          ? g.echMode === "embed"
            ? { ech: { enabled: !0, config: omniEchPemLines() } }
            : { ech: { enabled: !0, query_server_name: omniEchDomain() } }
          : {}),
      },`
);

/* 5) mihomo/Clash Meta ech-opts (documented shape) */
rep(
  `        \`    client-fingerprint: "\${p.tls.utls?.fingerprint || "chrome"}"\`,
        "    network: ws",`,
  `        \`    client-fingerprint: "\${p.tls.utls?.fingerprint || "chrome"}"\`,
        ...(p.tls.enabled && omniEchOn(p.server)
          ? g.echMode === "embed"
            ? ["    ech-opts:", "      enable: true", \`      config: "\${omniEchB64()}"\`]
            : ["    ech-opts:", "      enable: true", \`      query-server-name: "\${omniEchDomain()}"\`]
          : []),
        "    network: ws",`,
  'mihomo ech-opts emitted'
);

/* 5b) compact remark keeps an honest ECH marker */
rep(
  `  if(p.get('bridge')==='1')method='پل';
  if(u.protocol==='trojan:')method='Trojan '+method;`,
  `  if(p.get('bridge')==='1')method='پل';
  if(q.get('ech'))method+=' · ECH';
  if(u.protocol==='trojan:')method='Trojan '+method;`,
  'compact labels carry an ECH marker'
);

/* 5c) live DoH refresh rebuilds the output immediately */
rep(
  `      y("کلید ECH تازه از رکورد HTTPS خوانده شد", "ok");
      if (e && e.rerenderView) e.rerenderView("configs");`,
  `      y("کلید ECH تازه از رکورد HTTPS خوانده شد", "ok");
      if (e && typeof omniCfgSoft === "function") omniCfgSoft(e);
      else if (e && e.rerenderView) e.rerenderView("configs");`,
  'DoH refresh rebuilds builder output'
);

/* 6) old inline switch removed from the ports card */
rep(
  `      <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;user-select:none">
        <span class="switch"><input type="checkbox" id="cfg-ech" \${g.ech ? "checked" : ""}><span></span></span>
        <span>ECH (فقط IPv4 · پیش‌فرض خاموش — روی IPv6 پینگ را خراب می‌کند)</span>
      </label>
`,
  '',
  'old cfg-ech switch removed from ports card'
);

/* 7) ECH card mounted between ports and Patt card */
rep(
  `  \${cfgPortsHtml()}

  \${pattMethodsCard()}`,
  `  \${cfgPortsHtml()}

  \${omniEchCardHtml()}

  \${pattMethodsCard()}`,
  'ECH card mounted in configs view'
);

/* 8) omniCfgSoft must re-render the ECH card too */
rep(
  "[['cfg-ports', cfgPortsHtml], ['patt-card', pattMethodsCard], ['cfg-linescan', lineScanHtml]].forEach(function (pr) {",
  "[['cfg-ports', cfgPortsHtml], ['cfg-ech-card', omniEchCardHtml], ['patt-card', pattMethodsCard], ['cfg-linescan', lineScanHtml]].forEach(function (pr) {",
  'omniCfgSoft re-renders ECH card'
);

/* 9) change listener: switch + v6 + domain + b64 */
rep(
  `      } else if (s.id === "cfg-ech") {
        g.ech = s.checked;
        Gt(e.S());
      } else if (s.id === "cfg-frag") {`,
  `      } else if (s.id === "cfg-ech") {
        g.ech = s.checked; omniEchSave();
        e.rerenderView("configs"); Gt(e.S());
      } else if (s.id === "cfg-ech-v6") {
        g.echV6 = s.checked; omniEchSave(); Gt(e.S());
      } else if (s.id === "cfg-ech-domain") {
        const echDom = s.value.trim().toLowerCase();
        if (omniEchValidDomain(echDom)) { g.echDomain = echDom; omniEchSave(); Gt(e.S()); }
        else y("دامنهٔ ECH معتبر نیست؛ مقدار قبلی ماند", "err");
      } else if (s.id === "cfg-ech-b64") {
        const echKey = s.value.trim();
        if (omniEchValidB64(echKey)) { g.echB64 = echKey; omniEchSave(); Gt(e.S()); }
        else y("کلید ECH باید بیس۶۴ معتبر (AEX…) باشد؛ مقدار قبلی ماند", "err");
      } else if (s.id === "cfg-frag") {`,
  'change listener wired to ECH controls'
);

/* 10) click handler: mode / resolver / domain suggest / refresh */
rep(
  `        else if (i === "omni-cfg-fam") {
          g.fam = String(s.dataset.v || "all");
          g.ipv6 = g.fam !== "v4";
          omniCfgSoft(e);
          y("خروجی: " + (g.fam === "v4" ? "فقط IPv4" : g.fam === "v6" ? "فقط IPv6" : "همهٔ آدرس‌ها"), "ok");
        }`,
  `        else if (i === "omni-cfg-fam") {
          g.fam = String(s.dataset.v || "all");
          g.ipv6 = g.fam !== "v4";
          omniCfgSoft(e);
          y("خروجی: " + (g.fam === "v4" ? "فقط IPv4" : g.fam === "v6" ? "فقط IPv6" : "همهٔ آدرس‌ها"), "ok");
        }
        else if (i === "omni-cfg-ech-mode") {
          g.echMode = s.dataset.v === "embed" ? "embed" : "shell"; omniEchSave(); omniCfgSoft(e);
          if (g.out) Gt(e.S());
        }
        else if (i === "omni-cfg-ech-resolver") {
          g.echResolver = String(s.dataset.v || ""); omniEchSave(); omniCfgSoft(e);
          if (g.out) Gt(e.S());
        }
        else if (i === "omni-cfg-ech-domain-suggest") {
          g.echDomain = String(s.dataset.v || ""); omniEchSave(); omniCfgSoft(e);
          if (g.out) Gt(e.S());
        }
        else if (i === "omni-cfg-ech-refresh") {
          await omniEchRefresh(e);
        }`,
  'ECH click actions registered'
);

/* integrity gates */
if (html.includes('OMNI_ECH_OK')) throw new Error('old OMNI_ECH_OK gate still present');
if (html.includes('OMNI_ECH_B64')) throw new Error('old OMNI_ECH_B64 constant still present');
if (!html.includes('omni.ech.v1')) throw new Error('ECH store key missing');
if (!html.includes('/api/ech-config')) throw new Error('DoH refresh endpoint missing in panel');
/* card source carries one switch per render branch (collapsed/expanded); exactly one renders at runtime */
if ((html.match(/id="cfg-ech"/g) || []).length !== 2) throw new Error('cfg-ech switch must appear once per card branch');
if (html.indexOf('�') >= 0) throw new Error('U+FFFD in panel');

fs.writeFileSync('/home/user/omni-fix/panel.v88.final.html', html);
console.log('panel patches applied:', edits.join(' | '));
console.log('panel.v88.final.html bytes=', Buffer.byteLength(html, 'utf8'),
  'md5=', require('crypto').createHash('md5').update(html, 'utf8').digest('hex'));
