import pathlib, sys

P = pathlib.Path('/home/user/omni/production/panel.html')
s = P.read_text(encoding='utf-8')

def rep(old, new, n=1):
    global s
    c = s.count(old)
    if c == 0 and s.count(new) >= n:
        print('skip (already applied)'); return
    if c != n:
        print(f'FAIL anchor x{c}: {old[:70]!r}'); sys.exit(1)
    s = s.replace(old, new, n)

# ── P1: green endpoints → live-verified 2026-10-09 with real Xray ───────────
rep("""    // 4 Verified Green Benchmark Endpoints (Tested live with Xray: 58ms - 126ms in Iran)
    let verifiedDirectEndpoints = [
      { name: "همراه اول (تست‌شده ۷۰ms)", ip: "188.114.96.73", ping: "70ms" },
      { name: "ایرانسل (تست‌شده ۱۲۶ms)", ip: "162.159.192.140", ping: "126ms" },
      { name: "مخابرات (تست‌شده ۵۸ms)", ip: "162.159.137.74", ping: "58ms" },
      { name: "رایتل و شاتل (تست‌شده ۱۲۰ms)", ip: "162.159.195.1", ping: "120ms" }
    ];""",
"""    // Green endpoints — live-tested 2026-10-09 with a REAL Xray client (socks→204):
    // WS + TLS + CF clean IP carries traffic; every bridge-edge transport failed.
    let verifiedDirectEndpoints = [
      { name: "دامنهٔ خود ورکر (مستقیم)", ip: publicHost, ping: "پایه" },
      { name: "CF-1 104.16.5.5 (تست زنده ✅)", ip: "104.16.5.5", ping: "0.21s" },
      { name: "CF-2 104.18.32.1 (تست زنده ✅)", ip: "104.18.32.1", ping: "0.37s" },
      { name: "CF-3 162.159.130.25 (تست زنده ✅)", ip: "162.159.130.25", ping: "0.20s" },
      { name: "CF-4 188.114.96.3 (تست زنده ✅)", ip: "188.114.96.3", ping: "1.8s" }
    ];""")

# ── P2: dead bridge client URIs → none (bridges = HTTP mirrors only) ────────
start = s.find("    // Vercel Relay Configs")
endmark = "    let allNetlifyUris = [netlifyDirectWs, netlifyDirectXhttp, ...netlifyAnycastUris];"
end = s.find(endmark)
if start == -1 or end == -1:
    if "    let allVercelUris = [];" in s:
        print('skip (already applied)')
    else:
        print('FAIL P2 span'); sys.exit(1)
else:
    end += len(endmark)
    s = s[:start] + """    // 2026-10-09, real Xray client tests: NO client transport survives the
    // Vercel/Netlify edge (WS upgrade refused → 200 not 101; the panel server
    // speaks WS only, so xhttp clients fail everywhere). Bridges stay useful
    // as HTTP mirrors for browser access — client traffic = CF WS below.
    let allVercelUris = [];
    let allNetlifyUris = [];""" + s[end:]

# ── P3: copy-all buttons → mirror notice ────────────────────────────────────
rep("""            <button class="btn btn-sm btn-primary" type="button" data-action="omni-copy" data-text="${a(allVercelUris.join('\\n'))}">
              📋 کپی همه کانفیگ‌های ورسل
            </button>""",
"""            <div class="badge warn" style="margin:4px 0">⛔ ترافیک کلاینت از لبهٔ ورسل رد نمی‌شود (نه WS، نه xhttp — تست زنده Xray). پل ورسل = آینهٔ HTTP برای مرورگر. کانفیگ‌های کاری: «endpointهای سبز» همین پایین.</div>""")
rep("""            <button class="btn btn-sm btn-primary" type="button" data-action="omni-copy" data-text="${a(allNetlifyUris.join('\\n'))}">
              📋 کپی همه کانفیگ‌های نتلیفای
            </button>""",
"""            <div class="badge warn" style="margin:4px 0">⛔ ترافیک کلاینت از لبهٔ نتلیفای رد نمی‌شود — پل نتلیفای = آینهٔ HTTP برای مرورگر (ورود به پنل وقتی دامنه فیلتر است). کانفیگ‌های کاری: «endpointهای سبز».</div>""")

# ── P4: balancer nodes → WS CF set ──────────────────────────────────────────
rep("""    const tag = platform === "vercel" ? "Vercel" : "Netlify";
    let nodes = [{ name: `${tag}-direct`, address: host, sni: host, host: host, path: path, uuid: uuid }];
    if (platform === "vercel") {
      /* SNI must stay the bridge itself (Host≠SNI ⇒ 403 at the edge since
         2026-10); the clean IPs only defeat DNS poisoning / resolver blocks. */
      NATNET_DATA.vercel.ips.forEach((ip) => {
        nodes.push({ name: `Vercel-IP-${ip}`, address: ip, sni: host, host: host, path: path, uuid: uuid });
      });
    } else {
      NATNET_DATA.netlify.domains.forEach((d) => {
        nodes.push({ name: `Netlify-DNS-${d}`, address: d, sni: d, host: host, path: path, uuid: uuid });
      });
      NATNET_DATA.netlify.ips.forEach((ip) => {
        NATNET_DATA.netlify.snis.forEach((sni) => {
          nodes.push({ name: `Netlify-${sni}-${ip}`, address: ip, sni: sni, host: host, path: path, uuid: uuid });
        });
      });
    }""",
"""    /* 2026-10-09: the only client transport proven end-to-end (real Xray,
       socks→204) is WS+TLS to Cloudflare: direct workers.dev domain or a clean
       CF anycast IP with SNI/Host = the panel domain. Bridges carry no client
       traffic, so the balancer is built from the CF set regardless of platform. */
    const panelHost = (typeof location !== "undefined" && location.hostname) ? location.hostname : host;
    let nodes = [{ name: "CF-direct", address: panelHost, sni: panelHost, host: panelHost, path: path, uuid: uuid }];
    NATNET_DATA.cf.cleanIps.forEach((ip) => {
      nodes.push({ name: `CF-IP-${ip}`, address: ip, sni: panelHost, host: panelHost, path: path, uuid: uuid });
    });""")

# ── P5: xray outbound → ws ───────────────────────────────────────────────────
rep("""        streamSettings: {
          network: "xhttp",
          security: "tls",
          tlsSettings: { serverName: n.sni, allowInsecure: true },
          xhttpSettings: { host: n.host, path: n.path, mode: "auto" },
          sockopt: { dialerProxy: "" }
        }""",
"""        streamSettings: {
          network: "ws",
          security: "tls",
          tlsSettings: { serverName: n.sni, allowInsecure: false, fingerprint: "chrome", alpn: ["http/1.1"] },
          wsSettings: { host: n.host, path: n.path, headers: { Pragma: "no-cache" } }
        }""")

# ── P6: sing-box outbound → ws ───────────────────────────────────────────────
rep("""        transport: {
          type: "xhttp",
          host: n.host,
          path: n.path,
          mode: "auto"
        }""",
"""        transport: { type: "ws", host: n.host, path: n.path, headers: { Pragma: "no-cache" } }""")

# ── P7: NATNET_DATA gains cf.cleanIps ────────────────────────────────────────
rep("""    verifiedAt: "2026-10-09",""",
"""    verifiedAt: "2026-10-09",
    cf: { cleanIps: ["104.16.5.5", "104.18.32.1", "162.159.130.25", "188.114.96.3"] },""")

# ── P8: modal wording → the hard truth ──────────────────────────────────────
rep("""بررسی زنده ${NATNET_DATA.verifiedAt}: نتلیفای = SNI سفید‌لیست‌شده + آی‌پی لبه ✅ · ورسل = مستقیم و آی‌پی تمیز ✅ (ترفند SNI ورسل از این تاریخ ۴۰۳ می‌شود). بالانسر خودش نود مرده را کنار می‌گذارد:""",
"""تست زنده با کلاینت واقعی Xray (${NATNET_DATA.verifiedAt}): ترافیک کلاینت فقط با WS روی آی‌پی تمیز کلاودفلر رد می‌شود ✅ — لبهٔ ورسل/نتلیفای نه WS upgrade می‌دهد نه سرور xhttp دارد ⛔ (پل‌ها فقط آینهٔ HTTP برای مرورگرند). این بالانسر = ۵ نود کاری CF و خودش نود مرده را کنار می‌گذارد:""")

# ── P9: bridge rows gain a live ping button ─────────────────────────────────
rep("""          <button class="btn btn-xs" type="button" data-action="omni-natnet-auto-redeploy" data-id="${Number(r.id)}" data-plat="${platform}">♻️ دیپلوی دوباره</button>""",
"""          <button class="btn btn-xs" type="button" data-action="omni-bridge-ping" data-row="${Number(r.id)}" data-domain="${a(r.domain || "")}" data-path="${a(r.tunnel_path || "")}">🩺 تست زنده</button><span id="bp-${Number(r.id)}" style="font-size:11px"></span>
          <button class="btn btn-xs" type="button" data-action="omni-natnet-auto-redeploy" data-id="${Number(r.id)}" data-plat="${platform}">♻️ دیپلوی دوباره</button>""")

# ── P10: handler for the ping button ────────────────────────────────────────
rep("""        } else if (i === "omni-natnet-auto-deploy" || i === "omni-natnet-auto-redeploy") {""",
"""        } else if (i === "omni-bridge-ping") {
          const sp = document.getElementById(`bp-${s.dataset.row || 0}`);
          if (sp) sp.innerHTML = `<span class="badge warn">…</span>`;
          try {
            const r = await b.post("/api/bridge/ping", { domain: s.dataset.domain || "", path: s.dataset.path || "" });
            if (sp) sp.innerHTML = r.ok ? `<span class="badge ok">✅ ${r.status} · ${r.ms}ms</span>` : `<span class="badge danger">❌ ${r.status || "ERR"}</span>`;
          } catch (err) { if (sp) sp.innerHTML = `<span class="badge danger">❌ ${a(String(err.message || err).slice(0, 60))}</span>`; }
          return;
        } else if (i === "omni-natnet-auto-deploy" || i === "omni-natnet-auto-redeploy") {""")

P.write_text(s, encoding='utf-8')
print('panel.html patched OK')

# ── W1: worker gains /api/bridge/ping ───────────────────────────────────────
W = pathlib.Path('/home/user/omni/production/worker.js')
w = W.read_text(encoding='utf-8')
anchor = '    if (method === "POST" && p === "/api/bridge") {'
assert w.count(anchor) == 1, w.count(anchor)
if '/api/bridge/ping' not in w:
    ping = '''    if (method === "POST" && p === "/api/bridge/ping") {
      const body = await request.json().catch(() => ({}));
      const domain = normalizeTargetHost(String(body.domain || ""));
      if (!domain) return bad("bad_domain", "\\u062F\\u0627\\u0645\\u0646\\u0647 \\u0645\\u0639\\u062A\\u0628\\u0631 \\u0646\\u06CC\\u0633\\u062A");
      const tp = String(body.path || bridgePath()).slice(0, 60);
      const t0 = Date.now();
      try {
        const r = await fetch("https://" + domain + tp, { redirect: "manual" });
        return json({ ok: r.status === 200, status: r.status, ms: Date.now() - t0 });
      } catch (e2) {
        return json({ ok: false, status: 0, ms: Date.now() - t0, error: String(e2?.message || e2).slice(0, 140) });
      }
    }
'''
    w = w.replace(anchor, ping + anchor, 1)
else:
    print('worker ping skip (already applied)')

# ── W2: bot sanction line → WS CF truth ─────────────────────────────────────
lead = '\n\\ud83d\\udee1'
i = w.find(lead)
assert i != -1, 'shield line not found'
j = w.find('`}.', i)
assert j != -1, 'shield end not found'
j += 3
new_line = ("\n\U0001F6E1 <b>تحریم‌شکن</b> (تست زنده ۲۰۲۶-۱۰-۰۹): ترافیک فقط با WS روی آی‌پی تمیز CF رد می‌شود، مثل <code>104.16.5.5</code> + SNI/Host = دامنه ورکر. پل ورسل/نتلیفای = آینهٔ HTTP برای مرورگر، نه کلاینت. لینک‌های کاری: پنل ← نت ملی ← «endpointهای سبز».")
out = []
for ch in new_line:
    o = ord(ch)
    if o < 128:
        out.append(ch)
    elif o <= 0xFFFF:
        out.append('\\u%04x' % o)
    else:
        o2 = o - 0x10000
        out.append('\\u%04x\\u%04x' % (0xD800 + (o2 >> 10), 0xDC00 + (o2 & 0x3FF)))
esc = ''.join(out)
if esc not in w:
    w = w[:i] + esc + w[j:]
else:
    print('worker bot line skip (already applied)')

W.write_text(w, encoding='utf-8')
print('worker.js patched OK')
