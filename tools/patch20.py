import pathlib, sys

P = pathlib.Path('/home/user/omni/production/panel.html')
s = P.read_text(encoding='utf-8')

def rep(old, new, n=1):
    global s
    c = s.count(old)
    if c != n:
        print(f'FAIL anchor x{c} (want {n}): {old[:80]!r}'); sys.exit(1)
    s = s.replace(old, new, n)

def repall(old, new):
    global s
    c = s.count(old)
    if c < 1:
        print(f'FAIL repall anchor x0: {old[:80]!r}'); sys.exit(1)
    s = s.replace(old, new)
    return c

# A1
rep('bridgePlatform: "vercel", // "vercel" | "netlify"',
    'bridgePlatform: "vercel", // "vercel" | "netlify" | "deno"')
# A2
rep('(NATNET.bridgePlatform !== "vercel" && NATNET.bridgePlatform !== "netlify")',
    '(NATNET.bridgePlatform !== "vercel" && NATNET.bridgePlatform !== "netlify" && NATNET.bridgePlatform !== "deno")')
# A3 subtab button
rep("""      ◈ ۲. رله ابری نتلیفای (Netlify Relay)
    </button>
  </div>""",
"""      ◈ ۲. رله ابری نتلیفای (Netlify Relay)
    </button>
    <button class="btn ${NATNET.bridgePlatform === "deno" ? "btn-primary" : ""}" type="button" data-action="omni-natnet-subtab" data-sub="deno" style="flex:1;min-width:240px;padding:14px;font-weight:700;font-size:14px">
      🦕 . Deno Deploy — ترافیک واقعی (WS Relay)
    </button>
  </div>""")
# A4 deno branch before the big vercel ternary
rep("""  ${NATNET.bridgePlatform === "vercel" ? `
    <!-- ================= VERCEL PLATFORM ================= -->""",
"""  ${NATNET.bridgePlatform === "deno" ? `
    <!-- ================= DENO PLATFORM ================= -->
    <div class="card" style="margin-top:12px;border-inline-start:3px solid #10b981">
      <div class="card-head">
        <b style="color:#10b981;font-size:14px">🦕 Deno Deploy — رلهٔ واقعی WebSocket</b>
        <div class="spacer"></div>
      </div>
      <p class="muted" style="font-size:12.5px;line-height:1.9;margin:6px 0 10px">
        برخلاف ورسل و نتلیفای، لبهٔ Deno ارتقای WebSocket را می‌پذیرد؛ پس ترافیک کلاینت
        (VLESS/WS/TLS) واقعاً از این رله رد می‌شود و به ورکر شما می‌رسد — پینگ v2rayNG
        روی دامنهٔ آن واقعی است، نه پینگِ دست‌تکان‌دادن. بعد از ساخت پل، دکمهٔ
        «📥 استفاده در کانفیگ‌ها» دامنهٔ رله را به روت‌های سبز و بالانسر اضافه می‌کند.
      </p>
      <div class="badge ok" style="margin-bottom:10px">✅ ترافیک کلاینت: رله WS — قابل تست واقعی</div>
      ${autoCard}
    </div>
  ` : NATNET.bridgePlatform === "vercel" ? `
    <!-- ================= VERCEL PLATFORM ================= -->""")
# A5 autoCard ternaries
rep('const accent = platform === "vercel" ? "var(--accent)" : "#00c7b7";',
    'const accent = platform === "vercel" ? "var(--accent)" : platform === "deno" ? "#10b981" : "#00c7b7";')
rep('const brand = platform === "vercel" ? "▲ ورسل (Vercel)" : "◈ نتلیفای (Netlify)";',
    'const brand = platform === "vercel" ? "▲ ورسل (Vercel)" : platform === "deno" ? "🦕 دنو (Deno Deploy)" : "◈ نتلیفای (Netlify)";')
rep('const tokenKey = platform === "vercel" ? "vercelAutoToken" : "netlifyAutoToken";',
    'const tokenKey = platform === "vercel" ? "vercelAutoToken" : platform === "deno" ? "denoAutoToken" : "netlifyAutoToken";')
rep("""    const tokenUrl = platform === "vercel"
      ? "https://vercel.com/account/tokens"
      : "https://app.netlify.com/user/applications#personal-access-tokens";""",
"""    const tokenUrl = platform === "vercel"
      ? "https://vercel.com/account/tokens"
      : platform === "deno"
        ? "https://dash.deno.com/account/access-tokens"
        : "https://app.netlify.com/user/applications#personal-access-tokens";""")
rep("""    const tokenHint = platform === "vercel"
      ? "Create Token → Scope = Full Account → Expiration = No Expiration"
      : "User settings → Applications → Personal access tokens → New access token";""",
"""    const tokenHint = platform === "vercel"
      ? "Create Token → Scope = Full Account → Expiration = No Expiration"
      : platform === "deno"
        ? "Account → Access Tokens → New access token"
        : "User settings → Applications → Personal access tokens → New access token";""")
rep('${platform === "vercel" ? "vercel.json + api/relay.js" : "netlify.toml + edge function"}',
    '${platform === "vercel" ? "vercel.json + api/relay.js" : platform === "deno" ? "main.ts (رله WS)" : "netlify.toml + edge function"}')
rep('توکن API ${platform === "vercel" ? "ورسل" : "نتلیفای"}</label>',
    'توکن API ${platform === "vercel" ? "ورسل" : platform === "deno" ? "دنو" : "نتلیفای"}</label>')
rep('placeholder="${platform === "vercel" ? "cfut_… یا vercel_…" : "nlp_… / توکن شخصی"}"',
    'placeholder="${platform === "vercel" ? "cfut_… یا vercel_…" : platform === "deno" ? "توکن دسترسی Deno" : "nlp_… / توکن شخصی"}"')
# A6 empty list label
rep('هنوز پل ${platform === "vercel" ? "ورسلی" : "نتلیفایی"} با این پنل نساخته‌ای.',
    'هنوز پل ${platform === "vercel" ? "ورسلی" : platform === "deno" ? "دنویی" : "نتلیفایی"} با این پنل نساخته‌ای.')
# A7 hero badge
rep('<span class="badge ok">◈ Netlify Edge Relay</span>',
    '<span class="badge ok">◈ Netlify Edge Relay</span>\n        <span class="badge ok">🦕 Deno Deploy WS Relay</span>')
# A8 helpers
rep("""  function natnetTunnelPath(settings) {""",
"""  function natnetTokKey(p) { return p === "vercel" ? "vercelAutoToken" : p === "deno" ? "denoAutoToken" : "netlifyAutoToken"; }
  function natnetPlatFa(p) { return p === "vercel" ? "ورسل" : p === "deno" ? "دنو" : "نتلیفای"; }

  function natnetTunnelPath(settings) {""")
# A9 token-key ternaries (4x)
n = repall('NATNET[plat === "vercel" ? "vercelAutoToken" : "netlifyAutoToken"]', 'NATNET[natnetTokKey(plat)]')
print('A9 replaced', n)
# A10 host label
rep('let host = `${plat === "vercel" ? "ورسل" : "نتلیفای"}`;', 'let host = natnetPlatFa(plat);')
# A11 domain assignment (2x)
n = repall('if (plat === "vercel") NATNET.vercelDomain = dom; else NATNET.bridgeDomain = dom;',
           'if (plat === "vercel") NATNET.vercelDomain = dom; else if (plat === "deno") { NATNET.denoDomain = dom; NATNET.denoEndpoints = [{ name: `Deno relay ${dom} (ترافیک واقعی ✅)`, ip: dom }]; } else NATNET.bridgeDomain = dom;')
print('A11 replaced', n)
# A12 deno endpoints into green routes
rep("""    let verifiedDirectEndpoints = [
      { name: "دامنهٔ خود ورکر (مستقیم)", ip: publicHost, ping: "پایه" },""",
"""    let verifiedDirectEndpoints = [
      ...(NATNET.denoEndpoints || []).map(x => ({ name: x.name, ip: x.ip, ping: "relay" })),
      { name: "دامنهٔ خود ورکر (مستقیم)", ip: publicHost, ping: "پایه" },""")
P.write_text(s, encoding='utf-8')
print('panel patched for deno')

W = pathlib.Path('/home/user/omni/production/worker.js')
w = W.read_text(encoding='utf-8')

def wrep(old, new, n):
    global w
    c = w.count(old)
    if c != n:
        print(f'FAIL worker anchor x{c} (want {n}): {old[:80]!r}'); sys.exit(1)
    w = w.replace(old, new, n)

# W1 route error texts (escaped persian in file)
wrep('"\\u067E\\u0644\\u062A\\u0641\\u0631\\u0645 \\u0628\\u0627\\u06CC\\u062F vercel \\u06CC\\u0627 netlify \\u0628\\u0627\\u0634\\u062F"',
     '"\\u067E\\u0644\\u062A\\u0641\\u0631\\u0645 \\u0628\\u0627\\u06CC\\u062F vercel\\u060C netlify \\u06CC\\u0627 deno \\u0628\\u0627\\u0634\\u062F"', 2)
# W2 bot list icon
wrep('${r.platform === "vercel" ? "\\u25B2" : "\\u25C8"}',
     '${r.platform === "vercel" ? "\\u25B2" : r.platform === "deno" ? "\\u{1F995}" : "\\u25C8"}', 1)
# W3 bot token url / label / brand
wrep('const tokenUrl = platform === "vercel" ? "https://vercel.com/account/tokens" : "https://app.netlify.com/user/applications#personal-access-tokens";',
     'const tokenUrl = platform === "vercel" ? "https://vercel.com/account/tokens" : platform === "deno" ? "https://dash.deno.com/account/access-tokens" : "https://app.netlify.com/user/applications#personal-access-tokens";', 1)
wrep('const label = platform === "vercel" ? "\\u0648\\u0631\\u0633\\u0644 (Vercel)" : "\\u0646\\u062A\\u0644\\u06CC\\u0641\\u0627\\u06CC (Netlify)";',
     'const label = platform === "vercel" ? "\\u0648\\u0631\\u0633\\u0644 (Vercel)" : platform === "deno" ? "\\u062F\\u0646\\u0648 (Deno Deploy)" : "\\u0646\\u062A\\u0644\\u06CC\\u0641\\u0627\\u06CC (Netlify)";', 1)
wrep('const brand = platform === "vercel" ? "\\u{1F1EE}\\u{1F1F7} Omni-Vercel-Bridge" : "\\u{1F1EE}\\u{1F1F7} Omni-Netlify-Bridge";',
     'const brand = platform === "vercel" ? "\\u{1F1EE}\\u{1F1F7} Omni-Vercel-Bridge" : platform === "deno" ? "\\u{1F1EE}\\u{1F1F7} Omni-Deno-Relay" : "\\u{1F1EE}\\u{1F1F7} Omni-Netlify-Bridge";', 1)
W.write_text(w, encoding='utf-8')
print('worker patched for deno')
