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

# ── P1: NATNET_DATA tables → verified 2026-10-09 ────────────────────────────
rep("""    vercel: {
      domains: [
        "react.dev", "nextjs.org", "cursor.com", "ai.vercel.com", 
        "api.vercel.com", "app.vercel.com", "blog.vercel.com", 
        "botid.vercel.com", "analytics.vercel.com", "community.vercel.com",
        "turborepo.org", "swc.rs"
      ],
      ips: [
        "76.76.21.21", "76.76.21.22", "76.76.21.98", "76.76.21.9",
        "198.169.2.1", "198.169.2.65", "18.173.154.0", "18.173.154.27", 
        "18.173.154.31", "18.173.154.32", "18.173.154.33", "18.173.154.59", 
        "18.173.154.104", "18.173.154.111", "18.173.154.123", "18.173.154.129"
      ]
    },
    netlify: {
      domains: [],
      ips: [
        "104.198.14.52", "75.2.60.5", "99.83.231.61", "75.2.70.75"
      ]
    },""",
"""    /* Live-verified 2026-10-09 against omni-bridge-okb6 / omni-net-okb6:
       - Netlify's edge routes by the (encrypted) Host header even when the SNI
         is another Netlify-hosted domain or a raw edge IP → the whitelisted-SNI
         trick WORKS (200 + byte-identical tunnel page, POST/?ed= included).
       - Vercel's edge now answers 403 when Host ≠ SNI → the old react.dev trick
         is DEAD. Only direct SNI and clean-IP (defeats DNS poisoning) remain. */
    verifiedAt: "2026-10-09",
    vercel: {
      deadSniDomains: [
        "react.dev", "nextjs.org", "cursor.com", "ai.vercel.com",
        "api.vercel.com", "app.vercel.com", "blog.vercel.com",
        "botid.vercel.com", "analytics.vercel.com", "community.vercel.com",
        "turborepo.org", "swc.rs"
      ],
      domains: [],
      ips: [
        "76.76.21.21", "76.76.21.22", "76.76.21.98",
        "198.169.2.1", "198.169.2.65"
      ]
    },
    netlify: {
      domains: [
        "helm.sh", "docs.helm.sh", "krew.sigs.k8s.io",
        "kustomize.sigs.k8s.io", "letsencrypt.org"
      ],
      snis: [
        "kubernetes.io", "letsencrypt.org", "helm.sh",
        "blog.helm.sh", "docs.helm.sh", "krew.sigs.k8s.io"
      ],
      ips: [
        "75.2.60.5", "104.198.14.52", "99.83.231.61"
      ]
    },""")

# ── P2: node builder ────────────────────────────────────────────────────────
rep("""    let nodes = [];
    if (platform === "vercel") {
      NATNET_DATA.vercel.domains.forEach((d) => {
        nodes.push({ name: `Vercel-${d}`, address: d, sni: d, host: host, path: path, uuid: uuid });
      });
      NATNET_DATA.vercel.ips.slice(0, 6).forEach((ip) => {
        nodes.push({ name: `Vercel-CF-${ip}`, address: ip, sni: "react.dev", host: host, path: path, uuid: uuid });
      });
    } else {
      NATNET_DATA.netlify.domains.slice(0, 8).forEach((d) => {
        nodes.push({ name: `Netlify-${d}`, address: d, sni: d, host: host, path: path, uuid: uuid });
      });
      NATNET_DATA.netlify.ips.slice(0, 8).forEach((ip) => {
        nodes.push({ name: `Netlify-Shecan-${ip}`, address: ip, sni: "kubernetes.io", host: host, path: path, uuid: uuid });
      });
    }""",
"""    const tag = platform === "vercel" ? "Vercel" : "Netlify";
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
    }""")

# ── P3: xray balancer → leastPing + observatory ────────────────────────────
rep("""        routing: {
          balancers: [{
            tag: "omni-round-robin",
            selector: platform === "vercel" ? ["Vercel-"] : ["Netlify-"],
            strategy: { type: "roundRobin" }
          }],
          rules: [{ type: "field", network: "tcp,udp", balancerTag: "omni-round-robin" }]
        }""",
"""        observatory: {
          subjectSelector: nodes.map((n) => n.name),
          probeUrl: "http://cp.cloudflare.com/generate_204",
          probeInterval: "45s"
        },
        routing: {
          balancers: [{
            tag: "omni-least-ping",
            selector: nodes.map((n) => n.name),
            strategy: { type: "leastPing" }
          }],
          rules: [{ type: "field", network: "tcp,udp", balancerTag: "omni-least-ping" }]
        }""")

# ── P4: sing-box urltest faster ─────────────────────────────────────────────
rep("""        url: "http://cp.cloudflare.com/generate_204",
        interval: "3m",
        tolerance: 50""",
"""        url: "http://cp.cloudflare.com/generate_204",
        interval: "1m",
        tolerance: 50""")

# ── P5: modal copy → verified wording ───────────────────────────────────────
rep("""            title: `خروجی بالانسر چرخشی (${core === "xray" ? "Xray Balancer (Round-Robin)" : "Sing-box URL-Test (با Fragment)"})`,
            body: `<div style="padding:10px">
              <p class="muted" style="font-size:12px;margin:0 0 8px 0">این پیکربندی تمام نودهای ${NATNET.bridgePlatform === "vercel" ? "ورسل" : "نتلیفای"} را با چک خودکار سلامت و ترفندهای ضد فیلتر ادغام می‌کند:</p>""",
"""            title: `بالانسر تحریم‌شکن (${core === "xray" ? "Xray · leastPing + Observatory" : "Sing-box · URL-Test + Fragment"})`,
            body: `<div style="padding:10px">
              <p class="muted" style="font-size:12px;margin:0 0 8px 0">بررسی زنده ${NATNET_DATA.verifiedAt}: نتلیفای = SNI سفید‌لیست‌شده + آی‌پی لبه ✅ · ورسل = مستقیم و آی‌پی تمیز ✅ (ترفند SNI ورسل از این تاریخ ۴۰۳ می‌شود). بالانسر خودش نود مرده را کنار می‌گذارد:</p>""")

P.write_text(s, encoding='utf-8')
print('panel.html patched OK')

# ── W1: bot bridge message gains a sanction line ────────────────────────────
W = pathlib.Path('/home/user/omni/production/worker.js')
w = W.read_text(encoding='utf-8')
lead = '\\n\\n\\u0644\\u06CC\\u0646\\u06A9 \\u06A9\\u0627\\u0645\\u0644 vless://'
assert w.count(lead) == 1, w.count(lead)
snippet = ("\n\U0001F6E1 <b>\u062a\u062d\u0631\u06cc\u0645\u200c\u0634\u06a9\u0646</b> (\u0628\u0631\u0631\u0633\u06cc \u0632\u0646\u062f\u0647 \u06f2\u06f0\u06f2\u06f6-\u06f1\u06f0-\u06f0\u06f9): " +
           "${platform === \"netlify\" ? `\u0622\u062f\u0631\u0633 IPv4: <code>75.2.60.5</code> \u00b7 SNI: <code>kubernetes.io</code> \u00b7 Host: \u0647\u0645\u0627\u0646 \u062f\u0627\u0645\u0646\u0647` : `\u0622\u062f\u0631\u0633 \u0636\u062f \u0633\u0645\u200c\u067e\u0627\u0634\u06cc DNS: <code>76.76.21.21</code> \u00b7 SNI/Host: \u0647\u0645\u0627\u0646 \u062f\u0627\u0645\u0646\u0647`}.")
out = []
for ch in snippet:
    o = ord(ch)
    if o < 128:
        out.append(ch)
    elif o <= 0xFFFF:
        out.append('\\u%04x' % o)
    else:
        o2 = o - 0x10000
        out.append('\\u%04x\\u%04x' % (0xD800 + (o2 >> 10), 0xDC00 + (o2 & 0x3FF)))
esc = ''.join(out)
if esc in w:
    print('worker.js skip (already applied)')
else:
    j = w.index(lead)
    w = w[:j] + esc + w[j:]
    W.write_text(w, encoding='utf-8')
    print('worker.js patched OK')
