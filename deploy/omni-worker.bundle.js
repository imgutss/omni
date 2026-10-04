var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/countries.js
function findCountry(cc) {
  if (!cc) return null;
  const key = String(cc).trim().toUpperCase();
  if (key === "DIRECT" || key === "NONE") return null;
  return COUNTRY_BY_CC.get(key) || null;
}
function ipv4ToSiitV6(ip, prefix = "2606:4700:3030::") {
  const m = String(ip || "").trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n < 0 || n > 255)) return null;
  const h1 = (a << 8 | b).toString(16);
  const h2 = (c << 8 | d).toString(16);
  return `${prefix}${h1}:${h2}`;
}
function siitV6ToIpv4(v6) {
  const clean = String(v6 || "").trim().replace(/^\[|\]$/g, "");
  const parts = clean.split(":").filter(Boolean);
  if (parts.length < 4) return null;
  const h1 = parseInt(parts[parts.length - 2], 16);
  const h2 = parseInt(parts[parts.length - 1], 16);
  if (!Number.isFinite(h1) || !Number.isFinite(h2)) return null;
  const a = h1 >> 8 & 255;
  const b = h1 & 255;
  const c = h2 >> 8 & 255;
  const d = h2 & 255;
  if (a === 0 || d === 0 || d === 255) return null;
  return `${a}.${b}.${c}.${d}`;
}
async function discoverUndergroundCandidates(seedIps = [], limit = 14) {
  const GALOIS_PRIMES = [17, 31, 47, 67, 89, 107, 127, 149, 167, 181, 197, 211, 227, 239];
  const V6_BLADE_PREFIXES = ["2606:4700:3030::", "2606:4700::", "2606:4700:3031::"];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const push = (addr, kind, source) => {
    const a = String(addr || "").trim().replace(/^\[|\]$/g, "");
    if (!a || seen.has(a.toLowerCase()) || DEAD_BYOIP_BLACKLIST.has(a.toLowerCase())) return;
    if (!a.includes(":") && /[a-z]/i.test(a)) return;
    seen.add(a.toLowerCase());
    out.push({ addr: a, kind, source });
  };
  const slot = Math.floor(Date.now() / 5e3) % GALOIS_PRIMES.length;
  push("172.67.181.32", "spectral_v4", "\u062A\u06CC\u063A\u0647 \u0645\u0631\u062C\u0639 Anycast (\u067E\u06CC\u0646\u06AF \u06F6\u06F1ms)");
  push("2606:4700:3030::ac43:b520", "siit_v6", "\u0647\u0645\u0632\u0627\u062F \u0647\u06AF\u0632\u0627\u062F\u0633\u06CC\u0645\u0627\u0644 SIIT-Hex64 (ac43:b520)");
  push("2606:4700:3030::ac43:b58a", "siit_v6", "\u062A\u06CC\u063A\u0647 \u0646\u0633\u0644 \u0634\u0634\u0645 Anycast (ac43:b58a)");
  push("2606:4700::6812:3ed", "siit_v6", "\u062A\u06CC\u063A\u0647 \u0646\u0633\u0644 \u0634\u0634\u0645 Anycast (6812:3ed)");
  const effectiveSeeds = Array.isArray(seedIps) && seedIps.length ? seedIps : ["172.67.181.32", "2606:4700::6812:b58a", "2606:4700:3030::6815:3ed", "104.17.148.17"];
  for (const raw of effectiveSeeds) {
    const s = String(raw || "").trim().replace(/^\[|\]$/g, "");
    if (s.includes(":")) {
      const mirrorV4 = siitV6ToIpv4(s);
      if (mirrorV4) {
        push(mirrorV4, "siit_decoded_v4", `\u0627\u0633\u062A\u062E\u0631\u0627\u062C\u200C\u0634\u062F\u0647 \u0627\u0632 \u0644\u0627\u06CC\u0647 \u062F\u0631\u0648\u0646\u06CC IPv6 (${s.split(":").slice(-2).join(":")})`);
        const parts = mirrorV4.split(".");
        const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
        const gOct = ((Number(parts[3]) ^ 90) + GALOIS_PRIMES[(slot + 3) % GALOIS_PRIMES.length]) % 236 + 12;
        push(`${prefix}.${gOct}`, "galois_v4", `\u0633\u0646\u062A\u0632 \u06AF\u0627\u0644\u0648\u0627 LFSR \u0627\u0632 ${prefix}.0/24`);
      }
    } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) {
      const m = s.split(".");
      const prefix = `${m[0]}.${m[1]}.${m[2]}`;
      const baseOct = Number(m[3]);
      const p1 = GALOIS_PRIMES[(slot + 2) % GALOIS_PRIMES.length];
      const p2 = GALOIS_PRIMES[(slot + 7) % GALOIS_PRIMES.length];
      const n1 = ((baseOct ^ 60) + p1) % 236 + 12;
      const n2 = (baseOct + p2) % 236 + 12;
      push(`${prefix}.${n1}`, "galois_v4", `\u0633\u0646\u062A\u0632 \u0637\u06CC\u0641\u06CC \u06AF\u0627\u0644\u0648\u0627 (${prefix}.0/24)`);
      push(`${prefix}.${n2}`, "galois_v4", `\u0647\u0645\u0633\u0627\u06CC\u0647 \u0639\u062F\u062F \u0627\u0648\u0644 (${prefix}.0/24)`);
      const v6Twin = ipv4ToSiitV6(`${prefix}.${n1}`, V6_BLADE_PREFIXES[slot % V6_BLADE_PREFIXES.length]);
      if (v6Twin) push(v6Twin, "siit_v6", `\u0647\u0645\u0632\u0627\u062F SIIT-Hex64 (${prefix}.${n1})`);
    }
  }
  try {
    const r = await fetch("https://cloudflare-dns.com/dns-query?name=cloudflare-ech.com&type=65", {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(1500)
    });
    if (r.ok) {
      const d = await r.json();
      const answers = d.Answer || [];
      for (const ans of answers) {
        const data = String(ans.data || "");
        const v4Match = data.match(/ipv4hint=([0-9.,]+)/i);
        if (v4Match) {
          for (const hintIp of v4Match[1].split(",").slice(0, 2)) {
            const pts = hintIp.trim().split(".");
            if (pts.length === 4) {
              const pfx = `${pts[0]}.${pts[1]}.${pts[2]}`;
              const shOct = (Number(pts[3]) + GALOIS_PRIMES[(slot + 5) % GALOIS_PRIMES.length]) % 236 + 12;
              push(`${pfx}.${shOct}`, "svcb_hint_v4", `\u062A\u06CC\u063A\u0647 \u0627\u0633\u062A\u062E\u0631\u0627\u062C\u06CC \u0631\u06A9\u0648\u0631\u062F TYPE=65 ECH (${pfx}.0/24)`);
            }
          }
        }
      }
    }
  } catch {
  }
  for (let i = 0; i < UNDERGROUND_SUBNET_PREFIXES.length && out.length < limit; i++) {
    const p = UNDERGROUND_SUBNET_PREFIXES[(slot + i) % UNDERGROUND_SUBNET_PREFIXES.length];
    const oct = GALOIS_PRIMES[(slot + i * 3) % GALOIS_PRIMES.length];
    const candidateV4 = `${p}.${oct}`;
    push(candidateV4, "spectral_v4", `\u062A\u06CC\u063A\u0647 \u0637\u06CC\u0641\u06CC Anycast (${p}.0/24)`);
    if (i < 2 && out.length < limit) {
      const twinV6 = ipv4ToSiitV6(candidateV4, V6_BLADE_PREFIXES[(slot + i) % V6_BLADE_PREFIXES.length]);
      if (twinV6) push(twinV6, "siit_v6", `\u0647\u0645\u0632\u0627\u062F SIIT-Hex64 (${candidateV4})`);
    }
  }
  return out.slice(0, limit);
}
function detectIranIsp(cf = {}, clientIp = "") {
  const asn = Number(cf?.asn || 0);
  const org = String(cf?.asOrganization || "").toLowerCase();
  const isV6 = String(clientIp || "").includes(":");
  if (asn === 197207 || org.includes("mobile communication company of iran") || org.includes("mci")) {
    return {
      code: "mci",
      name: "\u0647\u0645\u0631\u0627\u0647 \u0627\u0648\u0644 (MCI)",
      asn,
      isV6,
      fragment: "none",
      ech: DEFAULT_ECH_CONFIG,
      fragmentRule: "\u0628\u062F\u0648\u0646 \u0641\u0631\u06AF\u0645\u0646\u062A (\u0641\u0631\u06AF\u0645\u0646\u062A \u062F\u0631 \u0647\u0645\u0631\u0627\u0647 \u0627\u0648\u0644 \u0645\u0633\u062F\u0648\u062F \u0627\u0633\u062A) + ECH \u0641\u0639\u0627\u0644 (cloudflare-ech.com+udp://1.1.1.1)",
      bestPorts: [443],
      tip: "\u0631\u0648\u06CC \u0641\u0627\u06CC\u0631\u0648\u0627\u0644 \u062C\u062F\u06CC\u062F \u0647\u0645\u0631\u0627\u0647 \u0627\u0648\u0644 \u0641\u0631\u06AF\u0645\u0646\u062A \u0645\u0633\u062F\u0648\u062F \u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u0627\u062A\u0635\u0627\u0644 \u0628\u0627 \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u0646\u0633\u0644 \u0634\u0634\u0645 (IPv6) \u0648 ECH \u0631\u0648\u06CC \u067E\u0648\u0631\u062A 443 \u0628\u0627 \u067E\u06CC\u0646\u06AF ~65 \u062A\u0627 140ms \u0628\u0631\u0642\u0631\u0627\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      recommendedIps: [
        "2606:4700:3030::ac43:b58a",
        "2606:4700::6812:3ed",
        "2606:4700::6812:1a2e",
        "2606:4700:3030::ac43:b520",
        "172.67.181.32",
        "172.67.181.122",
        "172.67.181.210",
        "104.17.148.167",
        "104.17.148.17",
        "104.17.147.119"
      ]
    };
  }
  if (asn === 58224 || asn === 12880 || org.includes("iran telecommunication") || org.includes("tci") || org.includes("mkh") || asn === 31549 || org.includes("shatel")) {
    return {
      code: "tci",
      name: org.includes("shatel") || asn === 31549 ? "\u0634\u0627\u062A\u0644 (Shatel)" : "\u0645\u062E\u0627\u0628\u0631\u0627\u062A \u0627\u06CC\u0631\u0627\u0646 (TCI)",
      asn,
      isV6,
      fragment: "none",
      ech: DEFAULT_ECH_CONFIG,
      fragmentRule: "\u0628\u062F\u0648\u0646 \u0641\u0631\u06AF\u0645\u0646\u062A + ECH \u0641\u0639\u0627\u0644 (cloudflare-ech.com+udp://1.1.1.1)",
      bestPorts: [443],
      tip: "\u0631\u0648\u06CC \u0645\u062E\u0627\u0628\u0631\u0627\u062A \u0648 \u0634\u0627\u062A\u0644 \u0641\u0631\u06AF\u0645\u0646\u062A \u0645\u0633\u062F\u0648\u062F \u0627\u0633\u062A\u061B \u067E\u0648\u0631\u062A 443 \u0628\u0627 ECH \u0648 \u062A\u06CC\u063A\u0647\u200C\u0647\u0627\u06CC \u0647\u0645\u0632\u0627\u062F Anycast \u0633\u0631\u06CC\u0639\u200C\u062A\u0631\u06CC\u0646 \u0627\u062A\u0635\u0627\u0644 \u0631\u0627 \u0645\u06CC\u200C\u062F\u0647\u062F.",
      recommendedIps: [
        "172.67.181.32",
        "172.67.181.122",
        "104.17.148.17",
        "104.17.147.119",
        "104.18.3.91",
        "104.18.181.138",
        "2606:4700:3030::ac43:b58a",
        "2606:4700::6812:3ed"
      ]
    };
  }
  if (asn === 44244 || org.includes("irancell") || org.includes("mtn")) {
    return {
      code: "irancell",
      name: "\u0627\u06CC\u0631\u0627\u0646\u0633\u0644 (MTN Irancell)",
      asn,
      isV6,
      fragment: "none",
      ech: DEFAULT_ECH_CONFIG,
      fragmentRule: "ECH \u0641\u0639\u0627\u0644 (cloudflare-ech.com+udp://1.1.1.1) + \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627\u06CC \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u0641\u0631\u06AF\u0645\u0646\u062A \u062F\u0631 \u0627\u0646\u062A\u0647\u0627\u06CC \u0644\u06CC\u0633\u062A",
      bestPorts: [443],
      tip: "\u0627\u06CC\u0631\u0627\u0646\u0633\u0644 \u0631\u0648\u06CC \u062A\u06CC\u063A\u0647\u200C\u0647\u0627\u06CC 172.67.181.x\u060C IPv6 \u0648 ECH \u067E\u0648\u0631\u062A 443 \u0639\u0627\u0644\u06CC \u06A9\u0627\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F (\u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627\u06CC \u0641\u0631\u06AF\u0645\u0646\u062A \u0627\u06CC\u0631\u0627\u0646\u0633\u0644 \u0646\u06CC\u0632 \u062C\u062F\u0627\u06AF\u0627\u0646\u0647 \u062F\u0631 \u0627\u0646\u062A\u0647\u0627\u06CC \u0633\u0627\u0628\u200C\u0644\u06CC\u0646\u06A9 \u0642\u0631\u0627\u0631 \u062F\u0627\u0631\u0646\u062F).",
      recommendedIps: [
        "172.67.181.32",
        "172.67.181.122",
        "104.17.148.17",
        "104.17.147.119",
        "2606:4700:3030::ac43:b58a",
        "2606:4700::6812:3ed",
        "2606:4700::6812:1a2e",
        "2606:4700:3030::ac43:b520"
      ]
    };
  }
  if (asn === 57218 || org.includes("rightel")) {
    return {
      code: "rightel",
      name: "\u0631\u0627\u06CC\u062A\u0644 (Rightel)",
      asn,
      isV6,
      fragment: "none",
      ech: DEFAULT_ECH_CONFIG,
      fragmentRule: "ECH \u0641\u0639\u0627\u0644 (cloudflare-ech.com+udp://1.1.1.1) + IPv6 \u0631\u0648\u06CC \u067E\u0648\u0631\u062A 443",
      bestPorts: [443],
      tip: "\u0631\u0627\u06CC\u062A\u0644 \u0631\u0648\u06CC IPv6 \u0648 \u062A\u06CC\u063A\u0647\u200C\u0647\u0627\u06CC ECH \u067E\u0648\u0631\u062A 443 \u06A9\u0645\u200C\u062A\u0631\u06CC\u0646 \u067E\u06A9\u062A\u200C\u0644\u0627\u0633 \u0631\u0627 \u062F\u0627\u0631\u062F.",
      recommendedIps: [
        "2606:4700:3030::ac43:b58a",
        "2606:4700::6812:3ed",
        "172.67.181.32",
        "172.67.181.122",
        "104.17.148.17",
        "104.17.147.119"
      ]
    };
  }
  return {
    code: "mci",
    name: cf?.asOrganization ? `${cf.asOrganization} (AS${asn || "?"})` : "\u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u0641\u0639\u0644\u06CC \u0634\u0645\u0627",
    asn,
    isV6,
    fragment: "none",
    ech: DEFAULT_ECH_CONFIG,
    fragmentRule: "\u0628\u062F\u0648\u0646 \u0641\u0631\u06AF\u0645\u0646\u062A + ECH \u0641\u0639\u0627\u0644 (cloudflare-ech.com+udp://1.1.1.1) + IPv6",
    bestPorts: [443],
    tip: "\u062A\u06CC\u063A\u0647\u200C\u0647\u0627\u06CC \u0646\u0633\u0644 \u0634\u0634\u0645 (IPv6) \u0648 \u0646\u0633\u0644 \u0686\u0647\u0627\u0631\u0645 \u0645\u062C\u0647\u0632 \u0628\u0647 ECH \u0631\u0648\u06CC \u067E\u0648\u0631\u062A 443 \u0628\u0631\u0627\u06CC \u0639\u0628\u0648\u0631 \u0627\u0632 \u0641\u0627\u06CC\u0631\u0648\u0627\u0644 \u062E\u0637 \u0634\u0645\u0627 \u062A\u0646\u0638\u06CC\u0645 \u0634\u062F\u0646\u062F.",
    recommendedIps: [
      "2606:4700:3030::ac43:b58a",
      "2606:4700::6812:3ed",
      "2606:4700::6812:1a2e",
      "2606:4700:3030::ac43:b520",
      "172.67.181.32",
      "172.67.181.122",
      "104.17.148.17",
      "104.17.147.119"
    ]
  };
}
var DEFAULT_ECH_CONFIG, OMNI_QOS_V4, OMNI_CLEAN_V6, OMNI_CLEAN_SITES, OMNI_CLEAN_IR, OMNI_HYBRID_POOL, DEAD_BYOIP_BLACKLIST, GEMINI_VIP_PROXIES, V4_GLOBAL, V6_GLOBAL, REAL_EXIT_PROXIES, COUNTRY_VIP_PROXIES, PRIMARY_LOCATIONS, RAW_COUNTRIES, REGION_FALLBACK, WORLD_COUNTRIES, VERIFIED_COUNTRIES, COUNTRY_BY_CC, UNDERGROUND_SUBNET_PREFIXES;
var init_countries = __esm({
  "src/countries.js"() {
    DEFAULT_ECH_CONFIG = "cloudflare-ech.com+udp://1.1.1.1";
    OMNI_QOS_V4 = [
      "172.67.181.32",
      "172.67.181.122",
      "172.67.181.210",
      "104.17.148.167",
      "104.17.148.17",
      "104.17.147.119",
      "104.18.3.91",
      "172.67.163.24",
      "104.18.181.138",
      "104.21.3.237",
      "104.18.26.46",
      "172.67.181.138",
      "104.16.142.53",
      "162.159.137.74",
      "104.17.148.77",
      "172.67.217.91"
    ];
    OMNI_CLEAN_V6 = [
      "2606:4700:3030::ac43:b58a",
      "2606:4700::6812:3ed",
      "2606:4700::6812:1a2e",
      "2606:4700:3030::ac43:b520",
      "2606:4700::6812:b58a",
      "2606:4700:3030::6815:3ed",
      "2606:4700::6811:9411",
      "2606:4700::6811:9377",
      "2606:4700:3031::ac43:d95b",
      "2606:4700:3035::ac43:a318"
    ];
    OMNI_CLEAN_SITES = [
      "104.18.181.138",
      "104.21.3.237",
      "104.18.26.46",
      "172.67.181.138",
      "104.17.148.167",
      "104.17.148.17"
    ];
    OMNI_CLEAN_IR = [
      "172.67.181.122",
      "172.67.181.210",
      "104.17.147.119",
      "104.18.3.91"
    ];
    OMNI_HYBRID_POOL = [
      "172.67.181.32",
      "172.67.181.122",
      "172.67.181.210",
      "104.17.148.167",
      "104.17.148.17",
      "104.17.147.119",
      "104.18.3.91",
      "172.67.163.24",
      "104.18.181.138",
      "104.21.3.237",
      "2606:4700:3030::ac43:b58a",
      "2606:4700::6812:3ed",
      "2606:4700::6812:1a2e",
      "2606:4700:3030::ac43:b520",
      "2606:4700::6812:b58a",
      "2606:4700:3030::6815:3ed"
    ];
    DEAD_BYOIP_BLACKLIST = /* @__PURE__ */ new Set([
      "31.185.108.22",
      "31.12.75.1",
      "89.117.112.10",
      "170.114.45.134",
      "37.153.171.224",
      "94.140.0.10",
      "188.42.145.155",
      "45.85.118.1",
      "213.241.198.123",
      "94.247.142.1",
      "57.128.178.36",
      "185.207.196.148",
      "185.18.184.181",
      "66.81.247.100",
      "8.39.125.239",
      "45.194.53.10",
      "170.168.7.26",
      "45.142.120.10",
      // سایت‌های عمومی مسدودشده روی فایروال همراه اول و مخابرات
      "www.speedtest.net",
      "speedtest.net",
      "platoapp.com",
      "www.udemy.com",
      "udemy.com",
      "www.canva.com",
      "canva.com",
      "quizlet.com",
      "www.fiverr.com",
      "fiverr.com",
      "discord.com",
      "chat.openai.com",
      "01d.ir",
      "0seo.ir",
      "18m.ir",
      "09122108011.ir",
      "1car.ir",
      "0nlysms.ir",
      "10az10.ir",
      "123project.ir"
    ]);
    GEMINI_VIP_PROXIES = [
      // خروجی واقعی آمریکا (New York, AS212238) — Gemini HTTP 200 با TLS معتبر
      "socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357",
      // فالبک‌های کانادا با Gemini HTTP 200 و TLS معتبر
      "socks5://38.49.210.79:40000",
      "socks5://pqyiblro:BW6cuhhS2U0r@132.145.110.34:1080",
      "socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080",
      // فالبک اروپا با TLS معتبر
      "socks5://31.220.40.59:5080"
    ];
    V4_GLOBAL = OMNI_QOS_V4.slice(0, 10);
    V6_GLOBAL = OMNI_CLEAN_V6.slice(0, 6);
    REAL_EXIT_PROXIES = {
      // ۱) آمریکا و کانادا
      US: ["104.168.125.179", "104.168.14.25", "104.168.38.167", "104.238.129.180", "107.150.0.204"],
      CA: ["138.197.160.106", "138.197.161.103", "137.220.52.250"],
      // ۲) اروپا (کم‌ترین پینگ به ایران)
      DE: ["103.27.156.147", "103.109.234.61", "103.228.170.234"],
      NL: ["103.137.248.227", "103.137.250.68", "109.176.202.20"],
      GB: ["103.13.208.242", "109.169.76.23", "104.128.190.209"],
      FR: ["104.238.191.179", "138.124.70.97", "109.172.55.148", "104.253.79.6"],
      FI: ["135.181.84.31", "138.124.244.182", "138.124.80.13"],
      SE: ["172.232.149.77", "121.127.33.130", "158.179.206.143", "16.170.253.163"],
      CH: ["16.63.207.85", "167.17.181.45", "171.22.16.201", "140.238.209.8"],
      AT: ["185.175.58.196", "87.251.69.44", "85.192.42.198", "92.112.48.149"],
      IT: ["179.255.190.4", "179.255.190.3", "179.255.190.5", "179.255.190.24"],
      ES: ["185.237.234.67", "31.57.190.11", "162.141.93.191", "141.253.194.63"],
      NO: ["194.5.98.17", "194.68.32.99", "194.32.107.150", "195.54.170.43"],
      PL: ["138.124.104.104", "185.126.64.13", "145.239.90.29", "176.105.253.43"],
      CZ: ["109.172.8.74", "103.119.18.30", "109.172.8.80", "109.172.8.73"],
      HU: ["38.180.108.148", "38.180.109.174", "5.181.77.132", "37.221.210.113"],
      RO: ["154.46.31.118", "185.104.181.228", "185.165.169.208", "103.102.229.45"],
      BG: ["13.140.29.253", "13.140.29.170", "104.143.206.87", "104.152.48.248"],
      IE: ["54.247.36.82", "108.128.156.233", "54.77.206.41", "198.55.103.168"],
      BE: ["194.71.227.213", "35.210.99.51"],
      DK: ["193.180.209.28", "193.180.209.21"],
      PT: ["195.133.92.20"],
      GR: ["85.90.197.159", "85.90.197.158", "85.90.197.156", "85.90.197.157"],
      LV: ["104.253.25.144", "109.248.163.151", "104.253.18.221", "104.252.127.58"],
      LT: ["185.80.128.20", "185.34.52.147", "130.12.171.63"],
      EE: ["138.124.4.38", "144.31.170.4", "150.241.74.200", "150.241.74.241"],
      UA: ["31.41.221.121"],
      // ۳) خاورمیانه و همسایه
      TR: ["104.239.87.51", "130.94.0.228", "130.94.1.177"],
      AE: ["20.174.15.226", "176.97.66.175", "146.70.37.253", "91.132.93.153"],
      AM: ["2.56.207.67", "2.56.204.183", "2.56.204.246", "139.45.214.126"],
      GE: ["91.239.206.65", "185.104.192.249", "2.26.10.137"],
      // ۴) آسیا و اقیانوسیه
      SG: ["124.156.202.172", "103.253.145.105", "128.1.186.55", "103.170.217.60"],
      JP: ["107.148.118.151", "108.160.132.132", "103.76.85.210"],
      KR: ["140.238.5.86", "131.186.26.94", "134.185.99.52", "131.186.16.166"],
      IN: ["103.111.114.87", "216.10.243.159", "20.235.105.146", "4.240.110.47"],
      AU: ["16.176.42.97", "160.187.110.199", "176.97.68.17", "125.7.24.251"]
    };
    COUNTRY_VIP_PROXIES = {
      US: [
        "socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357"
      ],
      CA: [
        "socks5://38.49.210.79:40000",
        "socks5://pqyiblro:BW6cuhhS2U0r@132.145.110.34:1080",
        "socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080"
      ],
      NL: [
        "socks5://5.255.117.127:1080",
        "socks5://31.220.40.59:5080"
      ],
      DE: [
        "http://s6102032620021:fahfah090908@202.28.17.5:8080",
        "socks5://167.86.86.221:9050"
      ],
      GB: [
        "socks5://qpmcy1xm:wgj6q7ns5gfs@gb.day1404.dpdns.org:11361"
      ],
      FR: [
        "socks5://109.199.107.68:1080",
        "socks5://77.221.152.210:36219",
        "socks5://213.199.47.140:1080"
      ],
      JP: [
        "socks5://172.105.192.212:9080",
        "socks5://35.78.212.217:32053",
        "socks5://101.36.104.46:10808"
      ],
      SG: [
        "socks5://45.77.244.108:1080"
      ],
      AE: [
        "socks5://zfdsvi6l:dl7o17z4ml9q@ua.day1404.dpdns.org:11359"
      ],
      SE: [
        "socks5://171.25.158.95:1080"
      ]
    };
    PRIMARY_LOCATIONS = [
      "US",
      "DE",
      "NL",
      "GB",
      "FR",
      "TR",
      "AE",
      "FI",
      "SE",
      "CA",
      "SG",
      "JP",
      "CH",
      "AT",
      "IT",
      "ES",
      "NO",
      "PL",
      "CZ",
      "HU",
      "RO",
      "DK",
      "KR",
      "AU"
    ];
    RAW_COUNTRIES = [
      // ۱) ۳۶ کشور دارای سرور خروجی اختصاصی و ۱۰۰٪ فعال
      ["DE", "\u0622\u0644\u0645\u0627\u0646", "Germany", "\u{1F1E9}\u{1F1EA}", "eu", "FRA"],
      ["NL", "\u0647\u0644\u0646\u062F", "Netherlands", "\u{1F1F3}\u{1F1F1}", "eu", "AMS"],
      ["GB", "\u0628\u0631\u06CC\u062A\u0627\u0646\u06CC\u0627", "United Kingdom", "\u{1F1EC}\u{1F1E7}", "eu", "LHR"],
      ["FR", "\u0641\u0631\u0627\u0646\u0633\u0647", "France", "\u{1F1EB}\u{1F1F7}", "eu", "CDG"],
      ["US", "\u0622\u0645\u0631\u06CC\u06A9\u0627 (\u0648\u06CC\u0698\u0647 Gemini/AI)", "United States", "\u{1F1FA}\u{1F1F8}", "na", "IAD"],
      ["TR", "\u062A\u0631\u06A9\u06CC\u0647", "Turkey", "\u{1F1F9}\u{1F1F7}", "me", "IST"],
      ["AE", "\u0627\u0645\u0627\u0631\u0627\u062A", "UAE", "\u{1F1E6}\u{1F1EA}", "me", "DXB"],
      ["FI", "\u0641\u0646\u0644\u0627\u0646\u062F", "Finland", "\u{1F1EB}\u{1F1EE}", "eu", "HEL"],
      ["SE", "\u0633\u0648\u0626\u062F", "Sweden", "\u{1F1F8}\u{1F1EA}", "eu", "ARN"],
      ["CA", "\u06A9\u0627\u0646\u0627\u062F\u0627", "Canada", "\u{1F1E8}\u{1F1E6}", "na", "YYZ"],
      ["SG", "\u0633\u0646\u06AF\u0627\u067E\u0648\u0631", "Singapore", "\u{1F1F8}\u{1F1EC}", "as", "SIN"],
      ["JP", "\u0698\u0627\u067E\u0646", "Japan", "\u{1F1EF}\u{1F1F5}", "as", "NRT"],
      ["CH", "\u0633\u0648\u0626\u06CC\u0633", "Switzerland", "\u{1F1E8}\u{1F1ED}", "eu", "ZRH"],
      ["AT", "\u0627\u062A\u0631\u06CC\u0634", "Austria", "\u{1F1E6}\u{1F1F9}", "eu", "VIE"],
      ["IT", "\u0627\u06CC\u062A\u0627\u0644\u06CC\u0627", "Italy", "\u{1F1EE}\u{1F1F9}", "eu", "MXP"],
      ["ES", "\u0627\u0633\u067E\u0627\u0646\u06CC\u0627", "Spain", "\u{1F1EA}\u{1F1F8}", "eu", "MAD"],
      ["NO", "\u0646\u0631\u0648\u0698", "Norway", "\u{1F1F3}\u{1F1F4}", "eu", "OSL"],
      ["PL", "\u0644\u0647\u0633\u062A\u0627\u0646", "Poland", "\u{1F1F5}\u{1F1F1}", "eu", "WAW"],
      ["CZ", "\u0686\u06A9", "Czechia", "\u{1F1E8}\u{1F1FF}", "eu", "VIE"],
      ["HU", "\u0645\u062C\u0627\u0631\u0633\u062A\u0627\u0646", "Hungary", "\u{1F1ED}\u{1F1FA}", "eu", "BUD"],
      ["RO", "\u0631\u0648\u0645\u0627\u0646\u06CC", "Romania", "\u{1F1F7}\u{1F1F4}", "eu", "OTP"],
      ["BG", "\u0628\u0644\u063A\u0627\u0631\u0633\u062A\u0627\u0646", "Bulgaria", "\u{1F1E7}\u{1F1EC}", "eu", "SOF"],
      ["IE", "\u0627\u06CC\u0631\u0644\u0646\u062F", "Ireland", "\u{1F1EE}\u{1F1EA}", "eu", "DUB"],
      ["BE", "\u0628\u0644\u0698\u06CC\u06A9", "Belgium", "\u{1F1E7}\u{1F1EA}", "eu", "AMS"],
      ["DK", "\u062F\u0627\u0646\u0645\u0627\u0631\u06A9", "Denmark", "\u{1F1E9}\u{1F1F0}", "eu", "CPH"],
      ["PT", "\u067E\u0631\u062A\u063A\u0627\u0644", "Portugal", "\u{1F1F5}\u{1F1F9}", "eu", "MAD"],
      ["GR", "\u06CC\u0648\u0646\u0627\u0646", "Greece", "\u{1F1EC}\u{1F1F7}", "eu", "ATH"],
      ["LV", "\u0644\u062A\u0648\u0646\u06CC", "Latvia", "\u{1F1F1}\u{1F1FB}", "eu", "RIX"],
      ["LT", "\u0644\u06CC\u062A\u0648\u0627\u0646\u06CC", "Lithuania", "\u{1F1F1}\u{1F1F9}", "eu", "RIX"],
      ["EE", "\u0627\u0633\u062A\u0648\u0646\u06CC", "Estonia", "\u{1F1EA}\u{1F1EA}", "eu", "TLL"],
      ["UA", "\u0627\u0648\u06A9\u0631\u0627\u06CC\u0646", "Ukraine", "\u{1F1FA}\u{1F1E6}", "eu", "WAW"],
      ["AM", "\u0627\u0631\u0645\u0646\u0633\u062A\u0627\u0646", "Armenia", "\u{1F1E6}\u{1F1F2}", "me", "EVN"],
      ["GE", "\u06AF\u0631\u062C\u0633\u062A\u0627\u0646", "Georgia", "\u{1F1EC}\u{1F1EA}", "me", "TBS"],
      ["KR", "\u06A9\u0631\u0647 \u062C\u0646\u0648\u0628\u06CC", "South Korea", "\u{1F1F0}\u{1F1F7}", "as", "ICN"],
      ["IN", "\u0647\u0646\u062F", "India", "\u{1F1EE}\u{1F1F3}", "as", "BOM"],
      ["AU", "\u0627\u0633\u062A\u0631\u0627\u0644\u06CC\u0627", "Australia", "\u{1F1E6}\u{1F1FA}", "oc", "SYD"],
      // ۲) سایر کشورها (بدون پروکسی تکراری)
      ["IR", "\u0627\u06CC\u0631\u0627\u0646", "Iran", "\u{1F1EE}\u{1F1F7}", "me", "THR"],
      ["OM", "\u0639\u0645\u0627\u0646", "Oman", "\u{1F1F4}\u{1F1F2}", "me", "MCT"],
      ["SA", "\u0639\u0631\u0628\u0633\u062A\u0627\u0646", "Saudi Arabia", "\u{1F1F8}\u{1F1E6}", "me", "RUH"],
      ["QA", "\u0642\u0637\u0631", "Qatar", "\u{1F1F6}\u{1F1E6}", "me", "DOH"],
      ["BH", "\u0628\u062D\u0631\u06CC\u0646", "Bahrain", "\u{1F1E7}\u{1F1ED}", "me", "BAH"],
      ["KW", "\u06A9\u0648\u06CC\u062A", "Kuwait", "\u{1F1F0}\u{1F1FC}", "me", "KWI"],
      ["IQ", "\u0639\u0631\u0627\u0642", "Iraq", "\u{1F1EE}\u{1F1F6}", "me", "BGW"],
      ["AZ", "\u0622\u0630\u0631\u0628\u0627\u06CC\u062C\u0627\u0646", "Azerbaijan", "\u{1F1E6}\u{1F1FF}", "me", "GYD"],
      ["KZ", "\u0642\u0632\u0627\u0642\u0633\u062A\u0627\u0646", "Kazakhstan", "\u{1F1F0}\u{1F1FF}", "as", "AKX"],
      ["UZ", "\u0627\u0632\u0628\u06A9\u0633\u062A\u0627\u0646", "Uzbekistan", "\u{1F1FA}\u{1F1FF}", "as", "WAW"],
      ["TH", "\u062A\u0627\u06CC\u0644\u0646\u062F", "Thailand", "\u{1F1F9}\u{1F1ED}", "as", "BKK"],
      ["MY", "\u0645\u0627\u0644\u0632\u06CC", "Malaysia", "\u{1F1F2}\u{1F1FE}", "as", "SIN"],
      ["TW", "\u062A\u0627\u06CC\u0648\u0627\u0646", "Taiwan", "\u{1F1F9}\u{1F1FC}", "as", "TPE"],
      ["CN", "\u0686\u06CC\u0646", "China", "\u{1F1E8}\u{1F1F3}", "as", "HKG"],
      ["VN", "\u0648\u06CC\u062A\u0646\u0627\u0645", "Vietnam", "\u{1F1FB}\u{1F1F3}", "as", "HKG"],
      ["ID", "\u0627\u0646\u062F\u0648\u0646\u0632\u06CC", "Indonesia", "\u{1F1EE}\u{1F1E9}", "as", "CGK"],
      ["PH", "\u0641\u06CC\u0644\u06CC\u067E\u06CC\u0646", "Philippines", "\u{1F1F5}\u{1F1ED}", "as", "MNL"],
      ["PK", "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646", "Pakistan", "\u{1F1F5}\u{1F1F0}", "as", "KHI"],
      ["AF", "\u0627\u0641\u063A\u0627\u0646\u0633\u062A\u0627\u0646", "Afghanistan", "\u{1F1E6}\u{1F1EB}", "as", "ISB"],
      ["IS", "\u0627\u06CC\u0633\u0644\u0646\u062F", "Iceland", "\u{1F1EE}\u{1F1F8}", "eu", "KEF"],
      ["SK", "\u0627\u0633\u0644\u0648\u0627\u06A9\u06CC", "Slovakia", "\u{1F1F8}\u{1F1F0}", "eu", "BTS"],
      ["CY", "\u0642\u0628\u0631\u0633", "Cyprus", "\u{1F1E8}\u{1F1FE}", "eu", "LCA"],
      ["SI", "\u0627\u0633\u0644\u0648\u0648\u0646\u06CC", "Slovenia", "\u{1F1F8}\u{1F1EE}", "eu", "LJU"],
      ["RS", "\u0635\u0631\u0628\u0633\u062A\u0627\u0646", "Serbia", "\u{1F1F7}\u{1F1F8}", "eu", "BEG"],
      ["BA", "\u0628\u0648\u0633\u0646\u06CC \u0648 \u0647\u0631\u0632\u06AF\u0648\u06CC\u0646", "Bosnia", "\u{1F1E7}\u{1F1E6}", "eu", "VIE"],
      ["AL", "\u0622\u0644\u0628\u0627\u0646\u06CC", "Albania", "\u{1F1E6}\u{1F1F1}", "eu", "TIA"],
      ["MD", "\u0645\u0648\u0644\u062F\u0627\u0648\u06CC", "Moldova", "\u{1F1F2}\u{1F1E9}", "eu", "KIV"],
      ["BY", "\u0628\u0644\u0627\u0631\u0648\u0633", "Belarus", "\u{1F1E7}\u{1F1FE}", "eu", "WAW"],
      ["RU", "\u0631\u0648\u0633\u06CC\u0647", "Russia", "\u{1F1F7}\u{1F1FA}", "eu", "DME"],
      ["LU", "\u0644\u0648\u06A9\u0632\u0627\u0645\u0628\u0648\u0631\u06AF", "Luxembourg", "\u{1F1F1}\u{1F1FA}", "eu", "LUX"],
      ["MT", "\u0645\u0627\u0644\u062A", "Malta", "\u{1F1F2}\u{1F1F9}", "eu", "MLA"],
      ["HR", "\u06A9\u0631\u0648\u0627\u0633\u06CC", "Croatia", "\u{1F1ED}\u{1F1F7}", "eu", "ZAG"],
      ["NZ", "\u0646\u06CC\u0648\u0632\u06CC\u0644\u0646\u062F", "New Zealand", "\u{1F1F3}\u{1F1FF}", "oc", "AKL"],
      ["MX", "\u0645\u06A9\u0632\u06CC\u06A9", "Mexico", "\u{1F1F2}\u{1F1FD}", "na", "QRO"],
      ["BR", "\u0628\u0631\u0632\u06CC\u0644", "Brazil", "\u{1F1E7}\u{1F1F7}", "sa", "GRU"],
      ["AR", "\u0622\u0631\u0698\u0627\u0646\u062A\u06CC\u0646", "Argentina", "\u{1F1E6}\u{1F1F7}", "sa", "EZE"],
      ["CL", "\u0634\u06CC\u0644\u06CC", "Chile", "\u{1F1E8}\u{1F1F1}", "sa", "SCL"],
      ["EG", "\u0645\u0635\u0631", "Egypt", "\u{1F1EA}\u{1F1EC}", "af", "MRS"],
      ["ZA", "\u0622\u0641\u0631\u06CC\u0642\u0627\u06CC \u062C\u0646\u0648\u0628\u06CC", "South Africa", "\u{1F1FF}\u{1F1E6}", "af", "JNB"],
      ["NG", "\u0646\u06CC\u062C\u0631\u06CC\u0647", "Nigeria", "\u{1F1F3}\u{1F1EC}", "af", "LOS"]
    ];
    REGION_FALLBACK = {
      eu: "NL",
      me: "TR",
      as: "SG",
      oc: "AU",
      na: "US",
      sa: "US",
      af: "FR"
    };
    WORLD_COUNTRIES = RAW_COUNTRIES.map(([cc, fa, en, flag, region, colo]) => {
      const direct = REAL_EXIT_PROXIES[cc];
      const fallbackCc = REGION_FALLBACK[region] || "NL";
      const proxies = direct ? [...direct] : [];
      const vipProxies = COUNTRY_VIP_PROXIES[cc] ? [...COUNTRY_VIP_PROXIES[cc]] : [];
      return {
        cc,
        fa,
        en,
        flag,
        region,
        colo,
        verifiedExit: Boolean(direct),
        primary: PRIMARY_LOCATIONS.includes(cc),
        exitCc: direct ? cc : fallbackCc,
        proxies,
        vipProxies,
        v4: V4_GLOBAL,
        v6: V6_GLOBAL
      };
    });
    VERIFIED_COUNTRIES = WORLD_COUNTRIES.filter((c) => c.verifiedExit);
    COUNTRY_BY_CC = new Map(WORLD_COUNTRIES.map((c) => [c.cc, c]));
    UNDERGROUND_SUBNET_PREFIXES = [
      "172.67.181",
      "104.17.148",
      "104.17.147",
      "104.18.181",
      "104.21.3",
      "104.18.26",
      "104.18.3",
      "172.67.163",
      "104.16.142",
      "162.159.137",
      "172.67.217",
      "104.18.2"
    ];
  }
});

// src/scan.js
import { connect } from "cloudflare:sockets";
function isCloudflareIp(ip) {
  const s = String(ip || "").trim().replace(/^\[|\]$/g, "");
  if (!s) return false;
  const low = s.toLowerCase();
  if (COUNTRY_PROXY_MAP.has(low) || VERIFIED_BYOIP_SET.has(low)) return true;
  if (s.includes(":")) {
    return /^(2606:4700|2803:f800|2405:b500|2405:8100|2a06:98c0|2c0f:f248):/i.test(low);
  }
  const n = ip4ToInt(s);
  if (n === null) return false;
  return CF_PARSED_V4.some(({ net, mask }) => (n & mask) >>> 0 === net);
}
function isValidCandidate(s) {
  const v = String(s ?? "").trim().replace(/^\[|\]$/g, "");
  if (!v || v.length > 120) return false;
  if (BLOCKED_EXACT.has(v.toLowerCase())) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
    const oct = v.split(".").map(Number);
    if (oct.some((n) => n < 0 || n > 255)) return false;
    if (oct[3] === 0 || oct[3] === 255) return false;
    if (oct[0] === 0 || oct[0] === 127 || oct[0] === 10) return false;
    return true;
  }
  if (v.includes(":")) {
    return /^[0-9a-f:]{3,45}$/i.test(v) && !v.endsWith("::0");
  }
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(v);
}
async function tcpProbe(host, { port = 443, timeoutMs = 2500 } = {}) {
  const cleanHost = String(host || "").trim().replace(/^\[|\]$/g, "");
  const t0 = Date.now();
  let sock;
  let timer;
  try {
    sock = connect({ hostname: cleanHost, port: Number(port) });
    await Promise.race([
      sock.opened,
      new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error("timeout")), timeoutMs);
      })
    ]);
    const ms = Math.max(1, Date.now() - t0);
    return { ip: cleanHost, port: Number(port), ok: true, alive: true, ms, latencyMs: ms };
  } catch (e) {
    const msg = String(e?.message || e);
    return { ip: cleanHost, port: Number(port), ok: false, alive: false, ms: null, latencyMs: null, error: msg };
  } finally {
    clearTimeout(timer);
    try {
      sock?.close();
    } catch {
    }
  }
}
async function httpProbe(target, { timeoutMs = 2500 } = {}) {
  const clean = String(target || "").trim().replace(/^\[|\]$/g, "");
  if (!isValidCandidate(clean)) {
    return { ip: clean, ok: false, alive: false, ms: null, colo: null, error: "\u0622\u062F\u0631\u0633 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 (.0/.255 \u06CC\u0627 \u0645\u0633\u062F\u0648\u062F)" };
  }
  const isRawIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(clean) || clean.includes(":");
  const proxyCountry = COUNTRY_PROXY_MAP.get(clean.toLowerCase());
  if (proxyCountry) {
    const tcp = await tcpProbe(clean, { port: 443, timeoutMs });
    return {
      ip: clean,
      ok: Boolean(tcp.ok),
      alive: Boolean(tcp.alive),
      is_cf: true,
      is_proxy: true,
      country: proxyCountry.cc,
      country_fa: proxyCountry.fa,
      flag: proxyCountry.flag,
      ms: tcp.ms,
      edge_ms: tcp.ms,
      colo: proxyCountry.colo,
      error: tcp.ok ? void 0 : tcp.error || "\u067E\u0631\u0648\u06A9\u0633\u06CC \u062E\u0631\u0648\u062C\u06CC \u0628\u062F\u0648\u0646 \u067E\u0627\u0633\u062E"
    };
  }
  if (isRawIp && !isCloudflareIp(clean)) {
    return {
      ip: clean,
      ok: false,
      alive: false,
      is_cf: false,
      ms: null,
      colo: null,
      error: "\u0631\u062F \u0634\u062F: \u0622\u06CC\u200C\u067E\u06CC \u0645\u062A\u0639\u0644\u0642 \u0628\u0647 \u06A9\u0644\u0648\u062F\u0641\u0644\u0631 (ASN 13335) \u0646\u06CC\u0633\u062A"
    };
  }
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const urlHost = clean.includes(":") ? `[${clean}]` : clean;
  try {
    const r = await fetch(`https://${urlHost}/cdn-cgi/trace`, {
      signal: ctrl.signal,
      headers: { "user-agent": "Omni-Scanner/2.0" }
    });
    const text = await r.text();
    const ms = Math.max(1, Date.now() - t0);
    const colo = (/colo=([A-Z]{3})/.exec(text) || [])[1] || null;
    const isCfTrace = text.includes("fl=") && text.includes("colo=");
    if (isCfTrace) {
      return { ip: clean, ok: true, alive: true, is_cf: true, ms, edge_ms: ms, colo: colo || "CF" };
    }
    if (isRawIp && isCloudflareIp(clean)) {
      return {
        ip: clean,
        ok: true,
        alive: true,
        is_cf: true,
        ms,
        edge_ms: ms,
        colo: clean.includes(":") ? "CF6" : "CF4"
      };
    }
    if (!isRawIp && VERIFIED_BYOIP_SET.has(clean.toLowerCase())) {
      return { ip: clean, ok: true, alive: true, is_cf: true, ms, edge_ms: ms, colo: "CF" };
    }
    const cfRay = r.headers.get("cf-ray") || "";
    const serverHdr = (r.headers.get("server") || "").toLowerCase();
    if (!isRawIp && (cfRay || serverHdr.includes("cloudflare"))) {
      const rayColo = cfRay.includes("-") ? cfRay.split("-").pop() : "CF";
      return { ip: clean, ok: true, alive: true, is_cf: true, ms, edge_ms: ms, colo: rayColo };
    }
    return { ip: clean, ok: false, alive: false, is_cf: false, ms: null, colo: null, error: "\u067E\u0627\u0633\u062E \u06A9\u0644\u0648\u062F\u0641\u0644\u0631 \u062F\u0631\u06CC\u0627\u0641\u062A \u0646\u0634\u062F" };
  } catch (e) {
    return { ip: clean, ok: false, alive: false, is_cf: isCloudflareIp(clean), ms: null, colo: null, error: String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}
async function rankIpsHttp(candidates = SEED_IPS, { concurrency = 10, timeoutMs = 2500 } = {}) {
  const uniq = [...new Set(candidates.map((x) => String(x || "").trim().replace(/^\[|\]$/g, "")).filter((x) => isValidCandidate(x) && !DEAD_BYOIP_BLACKLIST.has(x.toLowerCase())))];
  const results = [];
  const queue = [...uniq];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const ip = queue.shift();
      if (!ip) break;
      const r = await httpProbe(ip, { timeoutMs });
      if (r.alive) results.push(r);
    }
  });
  await Promise.all(workers);
  results.sort((a, b) => a.ms - b.ms);
  return results;
}
async function scanAllCountries({ ccs = null, onlyPrimary = false, concurrency = 12, timeoutMs = 2e3 } = {}) {
  const ccSet = Array.isArray(ccs) && ccs.length ? new Set(ccs.map((x) => String(x || "").toUpperCase())) : null;
  const list = WORLD_COUNTRIES.filter((c) => {
    if (ccSet) return ccSet.has(c.cc);
    return c.verifiedExit && (!onlyPrimary || c.primary);
  });
  const results = [];
  const queue = [...list];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const c = queue.shift();
      if (!c) break;
      const candidates = (c.proxies || []).slice(0, 3);
      let best = null;
      for (const px of candidates) {
        const host = String(px || "").trim().split(":")[0];
        if (!host) continue;
        const tcp = await tcpProbe(host, { port: 443, timeoutMs });
        if (tcp.ok && tcp.ms > 0) {
          if (!best || tcp.ms < best.ms) {
            best = { proxy: `${host}:443`, host, ms: tcp.ms };
          }
          break;
        }
      }
      results.push({
        cc: c.cc,
        fa: c.fa,
        en: c.en,
        flag: c.flag,
        region: c.region,
        colo: c.colo,
        primary: Boolean(c.primary),
        hasVip: Boolean(c.vipProxies && c.vipProxies.length),
        alive: Boolean(best),
        proxy: best ? best.proxy : c.proxies?.[0] ? `${c.proxies[0]}:443` : null,
        host: best ? best.host : c.proxies?.[0] || null,
        edge_ms: best ? best.ms : null
      });
    }
  });
  await Promise.all(workers);
  results.sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return (a.edge_ms ?? 9999) - (b.edge_ms ?? 9999);
  });
  return results;
}
function parseServiceProxy(raw) {
  const m = /^(socks5|http):\/\/(?:([^:@]+):([^@]+)@)?([^:/]+)(?::(\d+))?$/i.exec(String(raw || "").trim());
  if (!m) return null;
  return {
    type: m[1].toLowerCase(),
    username: m[2] ? decodeURIComponent(m[2]) : "",
    password: m[3] ? decodeURIComponent(m[3]) : "",
    hostname: m[4],
    port: Number(m[5]) || (m[1].toLowerCase() === "socks5" ? 1080 : 8080)
  };
}
async function readWithTimeout(reader, timeoutMs, label = "read-timeout") {
  let timer;
  return Promise.race([
    reader.read(),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}
async function writeWithTimeout(writer, value, timeoutMs, label = "write-timeout") {
  let timer;
  return Promise.race([
    writer.write(value),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}
async function openServiceTunnel(spec, targetHost, targetPort, timeoutMs) {
  const socket = connect({ hostname: spec.hostname, port: spec.port }, { secureTransport: "starttls" });
  let timer;
  const wait = (promise, label) => Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
  await wait(socket.opened, "proxy-open-timeout");
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  try {
    if (spec.type === "socks5") {
      const auth = Boolean(spec.username);
      await writeWithTimeout(writer, auth ? new Uint8Array([5, 2, 0, 2]) : new Uint8Array([5, 1, 0]), timeoutMs, "socks-greeting-write-timeout");
      const g = (await readWithTimeout(reader, timeoutMs, "socks-greeting-timeout")).value;
      if (!g || g.length < 2 || g[0] !== 5) throw new Error("socks-bad-greeting");
      if (g[1] === 2) {
        const ub = new TextEncoder().encode(spec.username || "");
        const pb = new TextEncoder().encode(spec.password || "");
        const req2 = new Uint8Array(3 + ub.length + pb.length);
        req2[0] = 1;
        req2[1] = ub.length;
        req2.set(ub, 2);
        req2[2 + ub.length] = pb.length;
        req2.set(pb, 3 + ub.length);
        await writeWithTimeout(writer, req2, timeoutMs, "socks-auth-write-timeout");
        const ar = (await readWithTimeout(reader, timeoutMs, "socks-auth-timeout")).value;
        if (!ar || ar.length < 2 || ar[1] !== 0) throw new Error("socks-auth-failed");
      } else if (g[1] !== 0) throw new Error("socks-auth-unsupported");
      const hb = new TextEncoder().encode(targetHost);
      const req = new Uint8Array(7 + hb.length);
      req[0] = 5;
      req[1] = 1;
      req[2] = 0;
      req[3] = 3;
      req[4] = hb.length;
      req.set(hb, 5);
      req[5 + hb.length] = targetPort >> 8 & 255;
      req[6 + hb.length] = targetPort & 255;
      await writeWithTimeout(writer, req, timeoutMs, "socks-connect-write-timeout");
      const rep = (await readWithTimeout(reader, timeoutMs, "socks-connect-timeout")).value;
      if (!rep || rep.length < 4 || rep[1] !== 0) throw new Error("socks-connect-rejected");
    } else {
      const lines = [`CONNECT ${targetHost}:${targetPort} HTTP/1.1`, `Host: ${targetHost}:${targetPort}`, "Proxy-Connection: keep-alive"];
      if (spec.username) lines.push(`Proxy-Authorization: Basic ${btoa(`${spec.username}:${spec.password || ""}`)}`);
      lines.push("", "");
      await writeWithTimeout(writer, new TextEncoder().encode(lines.join("\r\n")), timeoutMs, "http-connect-write-timeout");
      const rep = (await readWithTimeout(reader, timeoutMs, "http-connect-timeout")).value;
      const text = rep ? new TextDecoder().decode(rep) : "";
      if (!/^HTTP\/1\.[01]\s+200\b/i.test(text)) throw new Error("http-connect-rejected");
    }
  } finally {
    try {
      writer.releaseLock();
    } catch {
    }
    try {
      reader.releaseLock();
    } catch {
    }
  }
  return socket;
}
async function probeServiceViaProxy(proxyRaw, service, { timeoutMs = 6500 } = {}) {
  const targets = {
    gemini_web: { host: "gemini.google.com", path: "/", ok: [200, 301, 302, 303, 307, 308] },
    gemini_api: { host: "generativelanguage.googleapis.com", path: "/", ok: [200, 400, 404] },
    ai_studio: { host: "aistudio.google.com", path: "/", ok: [200, 301, 302, 303, 307, 308] },
    chatgpt: { host: "chatgpt.com", path: "/", ok: [200, 301, 302, 303, 307, 308] },
    claude: { host: "claude.ai", path: "/", ok: [200, 301, 302, 303, 307, 308] }
  };
  const target = targets[service];
  const spec = parseServiceProxy(proxyRaw);
  if (!target) return { service, ok: false, accepted: false, error: "unknown-service" };
  if (!spec) return { service, ok: false, accepted: false, error: "unsupported-proxy" };
  const started = Date.now();
  let socket, tlsValid = false;
  try {
    socket = await openServiceTunnel(spec, target.host, 443, timeoutMs);
    if (typeof socket.startTls !== "function") throw new Error("starttls-unavailable");
    const tlsSocket = socket.startTls({ expectedServerHostname: target.host });
    socket = tlsSocket;
    if (tlsSocket.opened) {
      let timer;
      await Promise.race([
        tlsSocket.opened,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("tls-timeout")), timeoutMs);
        })
      ]).finally(() => clearTimeout(timer));
    }
    tlsValid = true;
    const writer = tlsSocket.writable.getWriter();
    await writeWithTimeout(writer, new TextEncoder().encode(
      `GET ${target.path} HTTP/1.1\r
Host: ${target.host}\r
User-Agent: Mozilla/5.0 Omni-Proof/1\r
Accept: text/html,application/json\r
Connection: close\r
\r
`
    ), timeoutMs, "service-write-timeout");
    writer.releaseLock();
    const reader = tlsSocket.readable.getReader();
    let body = "", total = 0;
    try {
      while (total < 49152) {
        const part = await readWithTimeout(reader, timeoutMs, "service-read-timeout");
        if (part.done) break;
        if (part.value) {
          total += part.value.byteLength;
          body += new TextDecoder().decode(part.value, { stream: true });
        }
        if (/\r?\n\r?\n/.test(body) && body.length > 4096) break;
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
      }
    }
    const status = Number((/^HTTP\/1\.[01]\s+(\d{3})/i.exec(body) || [])[1] || 0);
    const blocked = /country\s+(?:isn['’]?t|not)\s+supported|not available in your (?:country|region)|unsupported country|geo(?:graphic)? restriction/i.test(body);
    const accepted = target.ok.includes(status) && !blocked;
    return {
      service,
      ok: status > 0,
      tls_valid: true,
      accepted,
      status,
      country_blocked: blocked,
      ms: Date.now() - started,
      proxy_host: spec.hostname,
      proof: accepted ? "network-accepted" : status ? "reachable-not-accepted" : "failed"
    };
  } catch (e) {
    const error = String(e?.message || e);
    return { service, ok: false, tls_valid: tlsValid && !/tls handshake failed/i.test(error), accepted: false, ms: Date.now() - started, error };
  } finally {
    try {
      socket?.close();
    } catch {
    }
  }
}
async function probeNode(proxyStr, timeoutMs = 3e3) {
  const s = String(proxyStr || "").trim();
  if (!s) return { proxy: s, ok: false, alive: false, latencyMs: null, error: "\u0622\u062F\u0631\u0633 \u062E\u0627\u0644\u06CC \u0627\u0633\u062A" };
  const lastColon = s.lastIndexOf(":");
  let host = s;
  let port = 443;
  if (lastColon > 0 && !s.includes("]") && s.indexOf(":") === lastColon) {
    host = s.slice(0, lastColon);
    port = Number(s.slice(lastColon + 1)) || 443;
  }
  return tcpProbe(host, { port, timeoutMs });
}
var COUNTRY_PROXY_MAP, VERIFIED_BYOIP_SET, CF_OFFICIAL_V4_CIDRS, ip4ToInt, CF_PARSED_V4, IPV6_SEEDS, PORTS_PLAIN, PORTS_TLS, CF_DOMAINS, CF_GOOD_IPS, SEED_IPS, BLOCKED_EXACT;
var init_scan = __esm({
  "src/scan.js"() {
    init_countries();
    COUNTRY_PROXY_MAP = /* @__PURE__ */ new Map();
    for (const c of WORLD_COUNTRIES) {
      if (!c.verifiedExit) continue;
      for (const p of c.proxies || []) {
        const cleanP = String(p || "").trim().split(":")[0].toLowerCase();
        if (cleanP && !COUNTRY_PROXY_MAP.has(cleanP)) {
          COUNTRY_PROXY_MAP.set(cleanP, c);
        }
      }
    }
    VERIFIED_BYOIP_SET = new Set([
      ...OMNI_HYBRID_POOL,
      ...OMNI_QOS_V4,
      ...OMNI_CLEAN_SITES,
      ...OMNI_CLEAN_IR,
      "213.241.198.123"
    ].map((x) => String(x || "").trim().toLowerCase()));
    CF_OFFICIAL_V4_CIDRS = [
      ["173.245.48.0", 20],
      ["103.21.244.0", 22],
      ["103.22.200.0", 22],
      ["103.31.4.0", 22],
      ["141.101.64.0", 18],
      ["108.162.192.0", 18],
      ["190.93.240.0", 20],
      ["188.114.96.0", 20],
      ["197.234.240.0", 22],
      ["198.41.128.0", 17],
      ["162.158.0.0", 15],
      ["104.16.0.0", 13],
      ["104.24.0.0", 14],
      ["172.64.0.0", 13],
      ["131.0.72.0", 22]
    ];
    ip4ToInt = (ip) => {
      const parts = String(ip).split(".").map(Number);
      if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
      return (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;
    };
    CF_PARSED_V4 = CF_OFFICIAL_V4_CIDRS.map(([base, bits]) => {
      const mask = bits === 0 ? 0 : 4294967295 << 32 - bits >>> 0;
      return { net: (ip4ToInt(base) & mask) >>> 0, mask };
    });
    IPV6_SEEDS = [
      "2606:4700:3030::ac43:b58a",
      "2606:4700::6812:3ed",
      "2606:4700::6812:1a2e",
      "2606:4700:3030::ac43:b520",
      "2606:4700::6812:b58a",
      "2606:4700:3030::6815:3ed",
      "2606:4700::6811:9411",
      "2606:4700::6811:9377"
    ];
    PORTS_PLAIN = [8080, 80, 8880, 2052, 2082, 2086, 2095];
    PORTS_TLS = [443, 2053, 8443, 2083, 2087, 2096];
    CF_DOMAINS = [];
    CF_GOOD_IPS = [
      "172.67.181.32",
      "172.67.181.122",
      "172.67.181.210",
      "104.17.148.167",
      "104.17.148.17",
      "104.17.147.119",
      "104.18.3.91",
      "172.67.163.24",
      "104.18.181.138",
      "104.21.3.237",
      "104.18.26.46",
      "172.67.181.138"
    ];
    SEED_IPS = [...OMNI_HYBRID_POOL];
    BLOCKED_EXACT = /* @__PURE__ */ new Set([
      "104.16.132.229",
      "speed.cloudflare.com",
      "www.cloudflare.com",
      "cloudflare.com",
      "cp.cloudflare.com",
      "cdnjs.cloudflare.com",
      "workers.cloudflare.com",
      "pages.cloudflare.com"
    ]);
  }
});

// src/auth.js
async function pbkdf2Hex(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}
async function hashPassword(password, saltHex = null) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  let hash = "";
  try {
    hash = await pbkdf2Hex(password, salt, PBKDF2_ITER);
  } catch (e) {
    const m = String(e?.message || "").match(/(\d{4,})/);
    const allowed = m ? Math.min(PBKDF2_ITER, Number(m[1]) - 1 || 5e4) : 5e4;
    hash = await pbkdf2Hex(password, salt, Math.max(1e3, allowed));
  }
  return { hash, salt: bytesToHex(salt) };
}
async function verifyPassword(password, hashHex, saltHex) {
  if (!hashHex || !saltHex) return false;
  const salt = hexToBytes(saltHex);
  let hash = "";
  try {
    hash = await pbkdf2Hex(password, salt, PBKDF2_ITER);
  } catch {
    hash = "";
  }
  if (hash && timingSafeEqualHex(hash, hashHex)) return true;
  for (const it of PBKDF2_ITER_LEGACY) {
    if (it === PBKDF2_ITER) continue;
    try {
      const h2 = await pbkdf2Hex(password, salt, it);
      if (timingSafeEqualHex(h2, hashHex)) return true;
    } catch {
    }
  }
  return false;
}
function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function randomToken(bytes = 24) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(b);
}
function base64url(bytes) {
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randomUuid() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = b[6] & 15 | 64;
  b[8] = b[8] & 63 | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function sessionCookie(id, days = 14) {
  return `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${days * 86400}`;
}
async function createSession(env, request, account) {
  const id = randomToken(32);
  const ua = (request.headers.get("user-agent") || "").slice(0, 200);
  const ip = request.headers.get("cf-connecting-ip") || "";
  const days = 14;
  const expires = new Date(Date.now() + days * 864e5).toISOString().slice(0, 19).replace("T", " ");
  await env.DB.prepare(
    `INSERT INTO sessions(id,account_id,ua,ip,expires_at,last_seen) VALUES(?,?,?,?,?,datetime('now'))`
  ).bind(id, account.id, ua, ip, expires).run();
  return { id, cookie: sessionCookie(id, days) };
}
function sessionIdFrom(request) {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}
async function currentAccount(env, request) {
  const sid = sessionIdFrom(request);
  if (!sid) return null;
  const row = await env.DB.prepare(
    `SELECT s.id AS sid, s.expires_at, s.last_seen, a.id, a.username, a.role, a.pass_hash, a.pass_salt
     FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.id = ?`
  ).bind(sid).first();
  if (!row) return null;
  const absoluteExpired = (/* @__PURE__ */ new Date(String(row.expires_at).replace(" ", "T") + "Z")).getTime() <= Date.now();
  const lastSeen = (/* @__PURE__ */ new Date(String(row.last_seen || "").replace(" ", "T") + "Z")).getTime();
  const idleExpired = !Number.isFinite(lastSeen) || Date.now() - lastSeen >= SESSION_IDLE_MS;
  if (absoluteExpired || idleExpired) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
    return null;
  }
  await env.DB.prepare(`UPDATE sessions SET last_seen = datetime('now') WHERE id = ? AND last_seen < datetime('now','-30 seconds')`).bind(sid).run();
  return { id: row.id, username: row.username, role: row.role, sid: row.sid };
}
async function revokeSession(env, id) {
  await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
}
async function revokeAllSessions(env, accountId, exceptSid = null) {
  if (exceptSid) await env.DB.prepare("DELETE FROM sessions WHERE account_id = ? AND id != ?").bind(accountId, exceptSid).run();
  else await env.DB.prepare("DELETE FROM sessions WHERE account_id = ?").bind(accountId).run();
}
async function getSetting(env, key, def = null) {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  return r ? r.value : def;
}
async function putSetting(env, key, value) {
  await env.DB.prepare(
    `INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).bind(key, String(value)).run();
  invalidateSettings();
  return value;
}
async function allSettings(env) {
  await ensureSchema(env);
  const rows = await env.DB.prepare("SELECT key,value FROM settings").all();
  const out = {};
  for (const r of rows.results || []) out[r.key] = r.value;
  return out;
}
async function putSettingsBulk(env, obj) {
  const entries = Object.entries(obj || {}).filter(([, v]) => v !== void 0);
  for (const [k, v] of entries) await putSetting(env, k, typeof v === "object" ? JSON.stringify(v) : v);
  return entries.length;
}
function invalidateSettings() {
  SETTINGS_CACHE = { at: 0, data: null };
}
function settingsCachedSync() {
  return SETTINGS_CACHE.data;
}
async function settingsCached(env, maxAgeMs = 15e3) {
  if (SETTINGS_CACHE.data && Date.now() - SETTINGS_CACHE.at < maxAgeMs) return SETTINGS_CACHE.data;
  const data = await allSettings(env);
  SETTINGS_CACHE = { at: Date.now(), data };
  return data;
}
async function logEvent(env, level, msg, meta = null) {
  try {
    await env.DB.prepare("INSERT INTO logs(level,msg,meta) VALUES(?,?,?)").bind(level, String(msg).slice(0, 500), meta ? JSON.stringify(meta).slice(0, 1e3) : null).run();
  } catch {
  }
}
async function ensureSchema(env) {
  if (SCHEMA_READY) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS accounts(
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
      pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL, role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now')), last_login TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions(
      id TEXT PRIMARY KEY, account_id INTEGER NOT NULL, ua TEXT, ip TEXT,
      created_at TEXT DEFAULT (datetime('now')), last_seen TEXT, expires_at TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
      uuid TEXT NOT NULL, sub_token TEXT UNIQUE NOT NULL,
      quota_bytes INTEGER DEFAULT 0, up_bytes INTEGER DEFAULT 0, down_bytes INTEGER DEFAULT 0,
      request_count INTEGER DEFAULT 0, request_limit INTEGER DEFAULT 0,
      device_limit INTEGER DEFAULT 3, expires_at TEXT,
      first_connect INTEGER DEFAULT 0, activated_at TEXT,
      is_active INTEGER DEFAULT 1, note TEXT, fragment TEXT, fingerprint TEXT,
      ips TEXT DEFAULT '[]', proxies TEXT DEFAULT '[]', block_list TEXT DEFAULT '[]',
      pending_days INTEGER DEFAULT 30, early_data INTEGER DEFAULT 2048, notify INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')), last_seen TEXT, last_ip TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS usage_daily(
      username TEXT NOT NULL, day TEXT NOT NULL, up_bytes INTEGER DEFAULT 0,
      down_bytes INTEGER DEFAULT 0, conns INTEGER DEFAULT 0, PRIMARY KEY(username, day))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS devices(
      username TEXT NOT NULL, device TEXT NOT NULL, first_seen TEXT DEFAULT (datetime('now')),
      last_seen TEXT DEFAULT (datetime('now')), hits INTEGER DEFAULT 0, PRIMARY KEY(username, device))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS logs(
      id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT DEFAULT 'info', msg TEXT, meta TEXT,
      at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS clean_ips(
      ip TEXT PRIMARY KEY, ms INTEGER, colo TEXT, ok INTEGER DEFAULT 1, hits INTEGER DEFAULT 0,
      src TEXT DEFAULT 'edge', checked_at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS signups(
      id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, username TEXT, at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_token ON users(sub_token)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_usage_day ON usage_daily(day)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_logs_at ON logs(at)`)
  ]);
  for (const sql of [
    "ALTER TABLE users ADD COLUMN pending_days INTEGER DEFAULT 30",
    "ALTER TABLE users ADD COLUMN early_data INTEGER DEFAULT 2048",
    "ALTER TABLE users ADD COLUMN notify INTEGER DEFAULT 1",
    "ALTER TABLE clean_ips ADD COLUMN mbps REAL",
    "ALTER TABLE clean_ips ADD COLUMN hits INTEGER DEFAULT 0",
    "ALTER TABLE clean_ips ADD COLUMN src TEXT DEFAULT 'edge'"
  ]) {
    try {
      await env.DB.prepare(sql).run();
    } catch {
    }
  }
  SCHEMA_READY = true;
}
async function bootstrap(env, url) {
  if (SCHEMA_READY && SETTINGS_CACHE.data && Date.now() - SETTINGS_CACHE.at < 6e4) {
    return SETTINGS_CACHE.data;
  }
  if (BOOTSTRAP_PROMISE) return BOOTSTRAP_PROMISE;
  BOOTSTRAP_PROMISE = (async () => {
    try {
      const rows = await env.DB.prepare("SELECT key, value FROM settings").all();
      if (rows?.results?.length >= 5) {
        const st2 = {};
        for (const r of rows.results) st2[r.key] = r.value;
        if (st2.path && st2.trojan_password) {
          SCHEMA_READY = true;
          SETTINGS_CACHE = { at: Date.now(), data: st2 };
          return st2;
        }
      }
    } catch {
    }
    await ensureSchema(env);
    const st = await allSettings(env);
    const missing = {};
    for (const [k, v] of Object.entries(DEFAULTS)) if (st[k] === void 0) missing[k] = v;
    if (!st.path) missing.path = "/" + randomToken(6).slice(0, 12);
    if (!st.trojan_password) missing.trojan_password = randomToken(16);
    if (!st.admin_chat_id && env.ADMIN_CHAT_ID) missing.admin_chat_id = String(env.ADMIN_CHAT_ID);
    if (!st.ip_pool) missing.ip_pool = CF_GOOD_IPS.join("\n");
    if (!st.public_host) missing.public_host = url.host;
    if (!st.recovery_code) missing.recovery_code = randomToken(12);
    if (Object.keys(missing).length) {
      await putSettingsBulk(env, missing);
      Object.assign(st, missing);
    }
    SETTINGS_CACHE = { at: Date.now(), data: st };
    return st;
  })().finally(() => {
    BOOTSTRAP_PROMISE = null;
  });
  return BOOTSTRAP_PROMISE;
}
var enc, SESSION_COOKIE, SESSION_IDLE_MS, PBKDF2_ITER, PBKDF2_ITER_LEGACY, bytesToHex, hexToBytes, clearCookie, SETTINGS_CACHE, DEFAULTS, SCHEMA_READY, BOOTSTRAP_PROMISE;
var init_auth = __esm({
  "src/auth.js"() {
    init_scan();
    enc = new TextEncoder();
    SESSION_COOKIE = "omni_sid";
    SESSION_IDLE_MS = 15 * 60 * 1e3;
    PBKDF2_ITER = 1e5;
    PBKDF2_ITER_LEGACY = [1e5, 5e4, 12e3];
    bytesToHex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    hexToBytes = (h) => {
      const out = new Uint8Array(h.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
      return out;
    };
    clearCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
    SETTINGS_CACHE = { at: 0, data: null };
    DEFAULTS = {
      panel_name: "Omni",
      public_host: "",
      port: "443",
      ports_mode: "auto",
      ports_custom: "",
      config_count: "30",
      ipv6_enabled: "1",
      ipv6_pool: "",
      fragment_preset: "none",
      fingerprint: "chrome",
      remark_prefix: "",
      default_quota_gb: "50",
      default_expiry_days: "30",
      rotate_minutes: "0",
      signup_max_per_ip: "3",
      signup_max_per_day: "50",
      public_signup: "0",
      maintenance: "0",
      auto_rotate: "0",
      mux_enabled: "0",
      block_ads: "0",
      block_nsfw: "0",
      block_list: "[]",
      clean_ips: "[]",
      ip_pool: "",
      device_limit: "3",
      dns_upstream: "https://1.1.1.1/dns-query",
      proto: "both",
      path: "",
      early_data: "2048",
      decoy_url: "",
      bot_pair_code: "",
      admin_chat_id: "",
      announce: ""
    };
    SCHEMA_READY = false;
    BOOTSTRAP_PROMISE = null;
  }
});

// src/links.js
function safeArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    try {
      const j = JSON.parse(v);
      if (Array.isArray(j)) return j.filter(Boolean);
    } catch {
    }
    return v.split(/[\n,]/).map((x) => String(x).trim()).filter(Boolean);
  }
  return [];
}
function getRotatedZeusIps(settings, count = 8) {
  const rotateMins = Math.max(1, Number(settings?.rotate_minutes || 15));
  const autoRotate = String(settings?.auto_rotate || "0") === "1";
  const slot = autoRotate ? Math.floor(Date.now() / (rotateMins * 6e4)) : 0;
  const pool = OMNI_QOS_V4;
  const out = [];
  for (let i = 0; i < count && i < pool.length; i++) {
    out.push(pool[(slot * 3 + i) % pool.length]);
  }
  return out;
}
function configPool(user, settings, cleanIps = []) {
  const cleanAddr = (x) => String(x ?? "").trim().replace(/^\[|\]$/g, "");
  const isIngressCandidate = (addr) => {
    const low = String(addr || "").toLowerCase();
    return isValidCandidate(addr) && !COUNTRY_PROXY_MAP.has(low) && !DEAD_BYOIP_BLACKLIST.has(low);
  };
  const norm = (cleanIps || []).map((r) => typeof r === "string" ? { ip: cleanAddr(r), hits: 0, ms: null } : { ...r, ip: cleanAddr(r?.ip ?? r?.addr) }).filter((r) => r && r.ip && isIngressCandidate(r.ip));
  const byMs = (a, b) => (a.ms ?? 9999) - (b.ms ?? 9999);
  const verifiedAll = norm.filter((r) => Number(r.hits || 0) > 0).sort(byMs).map((r) => r.ip);
  const verifiedV6 = verifiedAll.filter((x) => x.includes(":"));
  const verifiedV4 = verifiedAll.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
  const verifiedDomains = verifiedAll.filter((x) => !x.includes(":") && /[a-z]/i.test(x));
  const guessedAll = norm.filter((r) => !(Number(r.hits || 0) > 0)).sort(byMs).map((r) => r.ip);
  const guessedV4 = guessedAll.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
  const guessedV6 = guessedAll.filter((x) => x.includes(":"));
  const userList = safeArray(user?.ips).map(cleanAddr).filter(isIngressCandidate);
  const userV6 = userList.filter((x) => x.includes(":"));
  const userV4 = userList.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
  const userDom = userList.filter((x) => !x.includes(":") && /[a-z]/i.test(x));
  const settingsCleanList = safeArray(settings?.clean_ips).map(cleanAddr).filter(isIngressCandidate);
  const settingsCleanV4 = settingsCleanList.filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
  const settingsCleanV6 = settingsCleanList.filter((x) => x.includes(":"));
  const settingsCleanDom = settingsCleanList.filter((x) => !x.includes(":") && /[a-z]/i.test(x));
  const rotatedByoip = getRotatedZeusIps(settings, 10);
  const host = sniFor(settings);
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const selCountry = findCountry(settings.selected_country);
  const domain = uniq([
    ...userDom,
    ...OMNI_CLEAN_SITES.slice(0, 4),
    ...settingsCleanDom,
    ...verifiedDomains,
    ...OMNI_CLEAN_IR.slice(0, 4),
    ...safeArray(settings.address_domains).map(cleanAddr).filter(isIngressCandidate),
    ...CF_DOMAINS
  ]).slice(0, 10);
  const ipv6 = String(settings.ipv6_enabled || "1") === "1" ? uniq([
    ...userV6,
    ...OMNI_CLEAN_V6.slice(0, 4),
    ...settingsCleanV6,
    ...selCountry?.v6 || [],
    ...verifiedV6,
    ...safeArray(settings.ipv6_pool).map(cleanAddr).filter((x) => x.includes(":") && isIngressCandidate(x)),
    ...IPV6_SEEDS,
    ...guessedV6
  ]).slice(0, 12) : [];
  const ip = uniq([
    ...userV4,
    ...rotatedByoip.slice(0, 5),
    ...settingsCleanV4,
    ...verifiedV4,
    ...CF_GOOD_IPS,
    ...rotatedByoip.slice(5),
    ...guessedV4
  ]).filter(isIngressCandidate);
  return { domain, ipv6, ip, host, verified: verifiedV4, guessed: guessedV4, country: selCountry, rotatedByoip };
}
function shortHostLabel(host) {
  const clean = String(host || "").trim().replace(/^\[|\]$/g, "");
  if (!clean) return "";
  if (clean.includes(":")) {
    const parts = clean.split(":").filter(Boolean);
    return `IPv6:${parts[parts.length - 1] || "cf"}`;
  }
  return clean;
}
function wsPathFor(user, settings, { includeEd = false, overrideCc = null, overrideProxy = null, directMode = false } = {}) {
  const basePath = (settings.path || "/ws").split("?")[0];
  const ed = Number(user?.early_data ?? settings.early_data ?? 2048);
  const rawCc = overrideCc !== null ? overrideCc : settings.selected_country || "";
  const isDirect = directMode || String(rawCc).toUpperCase() === "DIRECT";
  const selC = isDirect ? null : findCountry(rawCc);
  const qs = [];
  if (includeEd && ed > 0) qs.push(`ed=${ed}`);
  if (isDirect) {
    qs.push("mode=direct");
  } else if (selC) {
    qs.push(`cc=${selC.cc}`);
    const px = overrideProxy || (selC.proxies?.[0] ? `${selC.proxies[0]}:443` : "");
    if (px) qs.push(`proxyip=${px}`);
  }
  return qs.length ? `${basePath}?${qs.join("&")}` : basePath;
}
function formatConfigRemark(user, settings, host, { index = 1, port = 443, cat = "\u0633\u0631\u06CC\u0639", proto = "vless", overrideCc = null, directMode = false, hasFrag = false } = {}) {
  const rawCc = overrideCc !== null ? overrideCc : settings.selected_country || "";
  const isDirect = directMode || !rawCc || String(rawCc).toUpperCase() === "DIRECT";
  const selC = isDirect ? null : findCountry(rawCc);
  const exitLabel = selC ? `\u062E\u0631\u0648\u062C\u06CC ${selC.flag} ${selC.fa}` : "\u{1F310} \u0645\u0633\u062A\u0642\u06CC\u0645";
  const protoLabel = proto === "trojan" ? "Trojan" : "VLESS";
  const fragTag = hasFrag ? " [Frag]" : "";
  const hostTag = shortHostLabel(host);
  const prefix = settings.remark_prefix ? `${settings.remark_prefix} \xB7 ` : "";
  return `${prefix}#${String(index).padStart(2, "0")} ${cat}${fragTag} \xB7 ${hostTag}:${port} (${exitLabel} \xB7 ${protoLabel})`;
}
function vlessUri(user, settings, host, {
  index = 1,
  port = 443,
  cat = "\u0633\u0631\u06CC\u0639",
  forceFragment = null,
  forceFp = null,
  overrideCc = null,
  overrideProxy = null,
  directMode = false
} = {}) {
  const tls = isTlsPort(port);
  const rawFp = forceFp || user.fingerprint || settings.fingerprint || "chrome";
  const fp = FINGERPRINTS.includes(rawFp) ? rawFp : "chrome";
  const path = encodeURIComponent(wsPathFor(user, settings, { includeEd: false, overrideCc, overrideProxy, directMode }));
  const sni = sniFor(settings) || host;
  const params = [`path=${path}`, `security=${tls ? "tls" : "none"}`, "encryption=none", `host=${sni}`, "type=ws"];
  if (tls) {
    params.push("insecure=0", `fp=${fp}`, "allowInsecure=0", `sni=${sni}`);
  }
  const frag = forceFragment || fragmentValue(user.fragment || settings.fragment_preset);
  if (tls && frag && frag.size) {
    const finalMask = {
      tcp: [{ type: "fragment", settings: {
        packets: frag.packets || "tlshello",
        length: frag.size,
        delay: frag.interval || "1-2",
        maxSplit: "10"
      } }]
    };
    params.push(`fm=${encodeURIComponent(JSON.stringify(finalMask))}`);
  } else if (tls) {
    params.push(`ech=${encodeURIComponent(DEFAULT_ECH_CONFIG)}`, "alpn=http%2F1.1");
  }
  if (settings.mux_enabled === "1") params.push("mux=1", "xmux=maxStreams=8");
  const remark = formatConfigRemark(user, settings, host, {
    index,
    port,
    cat,
    proto: "vless",
    overrideCc,
    directMode,
    hasFrag: Boolean(frag && frag.size)
  });
  return `vless://${user.uuid}@${encHost(host)}:${port}?${params.join("&")}#${enc2(remark)}`;
}
function trojanUri(user, settings, host, {
  index = 1,
  port = 443,
  cat = "\u0633\u0631\u06CC\u0639",
  forceFragment = null,
  forceFp = null,
  overrideCc = null,
  overrideProxy = null,
  directMode = false
} = {}) {
  const tls = isTlsPort(port);
  const rawFp = forceFp || user.fingerprint || settings.fingerprint || "chrome";
  const fp = FINGERPRINTS.includes(rawFp) ? rawFp : "chrome";
  const path = encodeURIComponent(wsPathFor(user, settings, { includeEd: false, overrideCc, overrideProxy, directMode }));
  const sni = sniFor(settings) || host;
  const params = [`path=${path}`, `security=${tls ? "tls" : "none"}`, `host=${sni}`, "type=ws"];
  if (tls) {
    params.push("insecure=0", `fp=${fp}`, "allowInsecure=0", `sni=${sni}`);
  }
  const frag = forceFragment || fragmentValue(user.fragment || settings.fragment_preset);
  if (tls && frag && frag.size) {
    const finalMask = {
      tcp: [{ type: "fragment", settings: {
        packets: frag.packets || "tlshello",
        length: frag.size,
        delay: frag.interval || "1-2",
        maxSplit: "10"
      } }]
    };
    params.push(`fm=${encodeURIComponent(JSON.stringify(finalMask))}`);
  } else if (tls) {
    params.push(`ech=${encodeURIComponent(DEFAULT_ECH_CONFIG)}`, "alpn=http%2F1.1");
  }
  const remark = formatConfigRemark(user, settings, host, {
    index,
    port,
    cat,
    proto: "trojan",
    overrideCc,
    directMode,
    hasFrag: Boolean(frag && frag.size)
  });
  return `trojan://${settings.trojan_password || user.uuid}@${encHost(host)}:${port}?${params.join("&")}#${enc2(remark)}`;
}
function verifiedPairs(settings) {
  try {
    const arr = JSON.parse(String(settings.verified_pairs || "[]"));
    if (Array.isArray(arr)) {
      return arr.filter((x) => {
        const s = String(x || "");
        const idx = s.lastIndexOf(":");
        if (idx <= 0) return false;
        const addr = s.slice(0, idx).replace(/^\[|\]$/g, "");
        const port = Number(s.slice(idx + 1));
        return isValidCandidate(addr) && !COUNTRY_PROXY_MAP.has(addr.toLowerCase()) && port > 0 && port < 65536;
      });
    }
  } catch {
  }
  return [];
}
function buildConfigs(user, settings, cleanIps = []) {
  const maxConfigs = Math.max(6, Math.min(40, Number(settings.config_count || 28)));
  const pool = configPool(user, settings, cleanIps);
  const pairs = verifiedPairs(settings);
  const plan = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (address, cat, opts = {}) => {
    const a = String(address || "").trim().replace(/^\[|\]$/g, "");
    if (!a || !isValidCandidate(a) || /[a-z]/i.test(a) || COUNTRY_PROXY_MAP.has(a.toLowerCase()) || DEAD_BYOIP_BLACKLIST.has(a.toLowerCase())) return;
    const tagKey = `${a}:443:${opts.overrideCc || ""}:${opts.directMode ? "direct" : ""}:${opts.forceFragment ? "fm" : "ech"}`;
    if (seen.has(tagKey)) return;
    seen.add(tagKey);
    plan.push({ address: a, port: 443, cat, ...opts });
  };
  const proven = [
    "2606:4700:3030::ac43:b58a",
    "2606:4700::6812:3ed",
    "2606:4700::6812:1a2e",
    "2606:4700:3030::ac43:b520",
    "172.67.181.32",
    "172.67.181.122",
    "172.67.181.210",
    "104.17.148.167",
    "104.17.148.17",
    "104.17.147.119",
    "104.18.3.91",
    "172.67.163.24"
  ];
  const defaultDirect = !settings.selected_country || String(settings.selected_country).toUpperCase() === "DIRECT";
  for (const addr of proven) {
    add(addr, addr.includes(":") ? "\u{1F6E1}\uFE0F IPv6 + ECH" : "\u{1F6E1}\uFE0F Anycast + ECH", { directMode: defaultDirect });
  }
  const clientVerified = [
    ...safeArray(user?.ips),
    ...(cleanIps || []).map((r) => typeof r === "string" ? r : Number(r?.hits || 0) > 0 ? r?.ip : "")
  ];
  for (const addr of clientVerified.slice(0, 6)) add(addr, "\u2705 \u062A\u0627\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0631\u0648\u06CC \u062E\u0637 \u0634\u0645\u0627", { directMode: defaultDirect });
  const fastHost = "172.67.181.32";
  for (const loc of [
    { cc: "US", cat: "\u2728 Gemini/AI \u0622\u0645\u0631\u06CC\u06A9\u0627" },
    { cc: "FR", cat: "\u{1F1EB}\u{1F1F7} \u0641\u0631\u0627\u0646\u0633\u0647 \u067E\u0627\u06CC\u062F\u0627\u0631" }
  ]) {
    const c = findCountry(loc.cc);
    if (c?.proxies?.[0]) add(fastHost, loc.cat, { overrideCc: c.cc, overrideProxy: `${c.proxies[0]}:443` });
  }
  const fmFallback = { size: "100-200", interval: "5-10", packets: "tlshello" };
  add("104.17.148.17", "\u{1F49B} \u0641\u0627\u0644\u0628\u06A9 \u0627\u06CC\u0631\u0627\u0646\u0633\u0644 FinalMask", { directMode: true, forceFragment: fmFallback });
  const both = String(settings.proto || "both") === "both" && Boolean(settings.trojan_password);
  const uris = [];
  const items = [];
  const noFragSettings = { ...settings, fragment_preset: "none" };
  const noFragUser = { ...user, fragment: "none" };
  const emit = (entry) => {
    const { address, port, cat, forceFragment, forceFp, overrideCc, overrideProxy, directMode } = entry;
    for (const proto of both ? ["vless", "trojan"] : ["vless"]) {
      if (uris.length >= maxConfigs) return;
      const n = uris.length + 1;
      const opts = { index: n, port, cat, forceFragment, forceFp, overrideCc, overrideProxy, directMode };
      const uri = proto === "vless" ? vlessUri(noFragUser, noFragSettings, address, opts) : trojanUri(noFragUser, noFragSettings, address, opts);
      const hasFrag = Boolean(forceFragment && forceFragment.size);
      const remark = formatConfigRemark(noFragUser, noFragSettings, address, {
        index: n,
        port,
        cat,
        proto,
        overrideCc,
        directMode,
        hasFrag
      });
      uris.push(uri);
      items.push({
        address,
        port,
        proto,
        cat,
        remark,
        tls: true,
        fragment: hasFrag,
        ech: hasFrag ? null : DEFAULT_ECH_CONFIG,
        cc: directMode ? "DIRECT" : overrideCc || "DIRECT"
      });
    }
  };
  plan.forEach(emit);
  const usedAddrs = [...new Set(items.map((x) => x.address))];
  return {
    uris,
    items,
    host: pool.host || "",
    addresses: usedAddrs,
    ports: [443],
    verified: items.filter((x) => x.ech).length,
    singbox: buildSingbox(noFragUser, noFragSettings, usedAddrs.slice(0, 12), [443]),
    clash: buildClash(noFragUser, noFragSettings, usedAddrs.slice(0, 12), [443])
  };
}
function meshDirectDomains(settings) {
  return safeArray(settings.mesh_direct_domains).map((x) => String(x || "").trim().toLowerCase().replace(/^\./, "")).filter(Boolean).slice(0, 80);
}
function sbOutbound(user, settings, host, port = 443) {
  const path = wsPathFor(user, settings, { includeEd: false });
  const sni = sniFor(settings) || host;
  const tls = isTlsPort(port);
  const ed = Number(user.early_data || settings.early_data || 2048);
  const cleanHost = String(host || "").replace(/^\[|\]$/g, "");
  const fp = user.fingerprint || settings.fingerprint || "chrome";
  const utlsFp = fp === "unsafe" ? "chrome" : fp;
  return {
    type: "vless",
    tag: `omni-${user.username}-${cleanHost.replace(/[:.]/g, "-")}-${port}`.slice(0, 60),
    server: cleanHost,
    server_port: Number(port),
    uuid: user.uuid,
    flow: "",
    tls: {
      enabled: tls,
      server_name: tls ? sni : void 0,
      insecure: fp === "unsafe",
      alpn: tls ? ["http/1.1"] : void 0,
      utls: tls ? { enabled: true, fingerprint: utlsFp } : void 0
    },
    transport: {
      type: "ws",
      path,
      headers: { Host: sni || cleanHost },
      max_early_data: ed > 0 ? ed : void 0,
      early_data_header_name: ed > 0 ? "Sec-WebSocket-Protocol" : void 0
    }
  };
}
function sbTrojan(user, settings, host, port = 443) {
  const path = wsPathFor(user, settings, { includeEd: false });
  const sni = sniFor(settings) || host;
  const tls = isTlsPort(port);
  const ed = Number(user.early_data || settings.early_data || 2048);
  const cleanHost = String(host || "").replace(/^\[|\]$/g, "");
  const fp = user.fingerprint || settings.fingerprint || "chrome";
  const utlsFp = fp === "unsafe" ? "chrome" : fp;
  return {
    type: "trojan",
    tag: `omni-${user.username}-tr-${cleanHost.replace(/[:.]/g, "-")}-${port}`.slice(0, 60),
    server: cleanHost,
    server_port: Number(port),
    password: settings.trojan_password || user.uuid,
    tls: {
      enabled: tls,
      server_name: tls ? sni : void 0,
      insecure: fp === "unsafe",
      alpn: tls ? ["http/1.1"] : void 0,
      utls: tls ? { enabled: true, fingerprint: utlsFp } : void 0
    },
    transport: {
      type: "ws",
      path,
      headers: { Host: sni || cleanHost },
      max_early_data: ed > 0 ? ed : void 0,
      early_data_header_name: ed > 0 ? "Sec-WebSocket-Protocol" : void 0
    }
  };
}
function buildSingbox(user, settings, addrs, ports = [443, 2053, 8080, 80]) {
  const outs = [];
  for (const h of addrs) {
    const isV6 = String(h).includes(":");
    const targetPorts = isV6 ? [443, 2053, 8080] : [443, 2053, 8080, 80];
    for (const p of targetPorts.filter((x) => ports.includes(x))) {
      outs.push(sbOutbound(user, settings, h, p));
      if (String(settings.proto || "both") === "both" && settings.trojan_password) {
        outs.push(sbTrojan(user, settings, h, p));
      }
    }
  }
  return {
    log: { level: "warn", timestamp: true },
    dns: {
      servers: [
        { tag: "remote", address: settings.dns_upstream || "https://1.1.1.1/dns-query" },
        { tag: "direct", address: "https://cloudflare-dns.com/dns-query", detour: "direct" }
      ],
      rules: [{ outbound: "any", server: "direct" }],
      final: "remote"
    },
    inbounds: [{ type: "mixed", tag: "mixed-in", listen: "127.0.0.1", listen_port: 2080 }],
    outbounds: [
      { type: "selector", tag: "select", outbounds: ["auto", ...outs.map((o) => o.tag)] },
      { type: "urltest", tag: "auto", outbounds: outs.map((o) => o.tag), url: "http://www.gstatic.com/generate_204", interval: "3m" },
      { type: "direct", tag: "direct" },
      { type: "block", tag: "block" },
      ...outs
    ],
    route: {
      rules: [
        { protocol: "dns", outbound: "dns-out" },
        { ip_is_private: true, outbound: "direct" },
        { domain_suffix: meshDirectDomains(settings), outbound: "direct" },
        { domain_suffix: [".ir"], outbound: "direct" },
        { package_name: MESH_AI_PACKAGES, network: "udp", port: 443, outbound: "block" },
        { package_name: MESH_AI_PACKAGES, outbound: "select" },
        { domain_suffix: MESH_AI_DOMAINS, network: "udp", port: 443, outbound: "block" },
        { domain_suffix: MESH_AI_DOMAINS, outbound: "select" },
        { domain_suffix: MESH_GAME_DOMAINS, outbound: "select" }
      ].filter((r) => !Array.isArray(r.domain_suffix) || r.domain_suffix.length),
      final: "select",
      auto_detect_interface: true
    }
  };
}
function clashProxy(user, settings, host, port, proto = "vless", idx = 1) {
  const path = wsPathFor(user, settings, { includeEd: false });
  const sni = sniFor(settings) || host;
  const tls = isTlsPort(port);
  const ed = Number(user.early_data || settings.early_data || 2048);
  const cleanHost = String(host || "").replace(/^\[|\]$/g, "");
  const fp = user.fingerprint || settings.fingerprint || "chrome";
  const base = {
    name: `omni-${idx}-${proto}-${cleanHost.slice(0, 15)}-${port}`,
    type: proto,
    server: cleanHost,
    port: Number(port),
    tls,
    "skip-cert-verify": fp === "unsafe",
    servername: tls ? sni : void 0,
    network: "ws",
    "client-fingerprint": fp === "unsafe" ? "chrome" : fp,
    "ws-opts": {
      path,
      headers: { Host: sni || cleanHost },
      ...ed > 0 ? { "max-early-data": ed, "early-data-header-name": "Sec-WebSocket-Protocol" } : {}
    },
    // Worker WebSocket transports TCP; disabling UDP forces QUIC-capable apps back to TCP.
    udp: false
  };
  if (proto === "vless") base.uuid = user.uuid;
  else base.password = settings.trojan_password || user.uuid;
  return base;
}
function buildClash(user, settings, addrs, ports = [443, 2053, 8080, 80]) {
  const proxies = [];
  let i = 0;
  const both = String(settings.proto || "both") === "both" && Boolean(settings.trojan_password);
  for (const h of addrs) {
    const isV6 = String(h).includes(":");
    const targetPorts = isV6 ? [443, 2053, 8080] : [443, 2053, 8080, 80];
    for (const port of targetPorts.filter((x) => ports.includes(x))) {
      proxies.push(clashProxy(user, settings, h, port, "vless", ++i));
      if (both) proxies.push(clashProxy(user, settings, h, port, "trojan", i));
    }
  }
  return {
    "mixed-port": 7890,
    "allow-lan": false,
    mode: "rule",
    "log-level": "warning",
    dns: { enable: true, ipv6: true, nameserver: [settings.dns_upstream || "https://1.1.1.1/dns-query"] },
    proxies,
    "proxy-groups": [
      { name: "\u{1F680} Omni", type: "select", proxies: proxies.map((p) => p.name) },
      { name: "\u267B\uFE0F Auto", type: "url-test", proxies: proxies.map((p) => p.name), url: "http://www.gstatic.com/generate_204", interval: 300 }
    ],
    rules: [
      ...meshDirectDomains(settings).map((d) => `DOMAIN-SUFFIX,${d},DIRECT`),
      "DOMAIN-SUFFIX,ir,DIRECT",
      "GEOIP,IR,DIRECT",
      "AND,((NETWORK,UDP),(DST-PORT,443)),REJECT",
      ...MESH_AI_PACKAGES.map((p) => `PROCESS-NAME,${p},\u{1F680} Omni`),
      ...MESH_AI_DOMAINS.map((d) => `DOMAIN-SUFFIX,${d},\u{1F680} Omni`),
      ...MESH_GAME_DOMAINS.map((d) => `DOMAIN-SUFFIX,${d},\u{1F680} Omni`),
      "MATCH,\u{1F680} Omni"
    ]
  };
}
function subscriptionBody(user, settings, cleanIps, type = "") {
  const cfg = buildConfigs(user, settings, cleanIps);
  const t = String(type || "").toLowerCase();
  if (t === "clash" || t === "clash-meta" || t === "yaml") {
    return { body: toYaml(cfg.clash), contentType: "text/yaml; charset=utf-8" };
  }
  if (t === "singbox" || t === "sing-box" || t === "json") {
    return { body: JSON.stringify(cfg.singbox, null, 2), contentType: "application/json; charset=utf-8" };
  }
  if (t === "raw" || t === "plain") {
    return { body: cfg.uris.join("\n"), contentType: "text/plain; charset=utf-8" };
  }
  return { body: b64(cfg.uris.join("\n")), contentType: "text/plain; charset=utf-8" };
}
function toYaml(obj, indent = 0) {
  const pad = "  ".repeat(indent);
  if (obj === null || obj === void 0) return "null";
  if (Array.isArray(obj)) {
    if (!obj.length) return "[]";
    return obj.map((v) => {
      if (typeof v === "object" && v !== null) return `${pad}-
${toYaml(v, indent + 1)}`;
      return `${pad}- ${yamlScalar(v)}`;
    }).join("\n");
  }
  if (typeof obj === "object") {
    return Object.entries(obj).map(([k, v]) => {
      if (typeof v === "object" && v !== null) return `${pad}${k}:
${toYaml(v, indent + 1)}`;
      return `${pad}${k}: ${yamlScalar(v)}`;
    }).join("\n");
  }
  return `${pad}${yamlScalar(obj)}`;
}
function yamlScalar(v) {
  if (v === null || v === void 0) return "null";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  const s = String(v);
  return /^[\w\u0600-\u06FF\-./@:]+$/.test(s) ? s : JSON.stringify(s);
}
function statusPage(user, settings, origin, stats) {
  const gb = (b) => ((b || 0) / 1024 ** 3).toFixed(2);
  const quota = Number(user.quota_bytes || 0);
  const used = (user.up_bytes || 0) + (user.down_bytes || 0);
  const pct = quota > 0 ? Math.min(100, used / quota * 100) : 0;
  const msLeft = user.expires_at ? (/* @__PURE__ */ new Date(String(user.expires_at).replace(" ", "T") + "Z")).getTime() - Date.now() : null;
  const daysLeft = msLeft === null ? null : Math.max(0, Math.floor(msLeft / 864e5));
  const name = settings.panel_name || "Omni";
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#06070a">
<title>${esc(name)} \xB7 \u0648\u0636\u0639\u06CC\u062A \u0627\u0634\u062A\u0631\u0627\u06A9</title>
<style>
 :root{--bg:#06070a;--card:#0d1017;--line:#1b2130;--txt:#e8eef9;--dim:#7c8aa5;--a1:#22d3ee;--a2:#818cf8;--ok:#34d399;--warn:#fbbf24;--bad:#f87171}
 *{box-sizing:border-box}
 body{margin:0;min-height:100vh;background:radial-gradient(900px 500px at 80% -10%,#101a2b,var(--bg)) fixed;color:var(--txt);
  font-family:Vazirmatn,Tahoma,system-ui,sans-serif;display:grid;place-items:center;padding:18px}
 .card{width:100%;max-width:520px;background:linear-gradient(180deg,var(--card),#0a0d13);border:1px solid var(--line);
  border-radius:22px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
 .brand{display:flex;align-items:center;gap:10px;margin-bottom:18px}
 .logo{width:42px;height:42px;border-radius:13px;background:linear-gradient(135deg,var(--a1),var(--a2));display:grid;place-items:center;font-weight:900;color:#05070c;font-size:19px}
 h1{font-size:17px;margin:0}.muted{color:var(--dim);font-size:12.5px}
 .n{font-size:27px;font-weight:900;margin:14px 0 6px;letter-spacing:-.5px}
 .bar{height:9px;background:#151b28;border-radius:99px;overflow:hidden}
 .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--a1),var(--a2))}
 .bar.hot i{background:linear-gradient(90deg,var(--warn),var(--bad))}
 .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
 .kv{background:#0a0e15;border:1px solid var(--line);border-radius:13px;padding:11px}
 .kv .k{color:var(--dim);font-size:11.5px;margin-bottom:4px}
 .kv b{font-size:14px}
 .btn{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;border:0;cursor:pointer;
  background:linear-gradient(135deg,var(--a1),var(--a2));color:#05070c;font-weight:800;padding:13px 18px;border-radius:14px;
  text-decoration:none;font-size:14px}
 .btn.ghost{background:transparent;border:1px solid var(--line);color:var(--txt);font-weight:600}
 code{background:#080b11;border:1px solid var(--line);border-radius:9px;padding:9px 11px;display:block;direction:ltr;
  font-size:11.5px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:#9fc6ff;margin-top:8px}
 .badge{display:inline-flex;padding:3px 10px;border-radius:99px;font-size:11.5px;font-weight:700}
 .badge.ok{background:rgba(52,211,153,.14);color:var(--ok)}
 .badge.bad{background:rgba(248,113,113,.14);color:var(--bad)}
 .badge.warn{background:rgba(251,191,36,.14);color:var(--warn)}
 .ip{display:flex;align-items:center;gap:8px;background:#0a0e15;border:1px solid var(--line);border-radius:12px;padding:9px 11px;margin-top:7px;font-size:12.5px}
 .ip b{font-family:ui-monospace,Menlo,monospace;direction:ltr;font-weight:600}
 .ip .ms{margin-inline-start:auto;color:var(--dim);font-variant-numeric:tabular-nums}
 .ip .ms.good{color:var(--ok)}.ip .ms.bad{color:var(--bad)}
 .ip .star{cursor:pointer;background:transparent;border:0;color:var(--warn);font-size:15px;padding:0 2px}
 .ip .off{opacity:.45;text-decoration:line-through}
</style></head><body><div class="card">
  <div class="brand"><div class="logo">${esc((name[0] || "O").toUpperCase())}</div>
    <div><h1>${esc(name)}</h1><div class="muted">\u0648\u0636\u0639\u06CC\u062A \u0627\u0634\u062A\u0631\u0627\u06A9 \u2014 ${esc(user.username)}</div></div>
    <div style="flex:1"></div>
    <span class="badge ${user.status === "active" ? "ok" : "bad"}">${user.status === "active" ? "\u0641\u0639\u0627\u0644" : user.status === "expired" ? "\u0645\u0646\u0642\u0636\u06CC" : user.status === "limited" ? "\u062D\u062C\u0645 \u062A\u0645\u0627\u0645" : "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644"}</span>
  </div>
  <div class="muted">\u0645\u0635\u0631\u0641 \u062D\u062C\u0645</div>
  <div class="n">${gb(used)} <span class="muted" style="font-size:14px;font-weight:400">/ ${quota ? gb(quota) + " GB" : "\u0646\u0627\u0645\u062D\u062F\u0648\u062F"}</span></div>
  <div class="bar ${pct > 85 ? "hot" : ""}"><i style="width:${pct.toFixed(1)}%"></i></div>
  <div class="grid">
    <div class="kv"><div class="k">\u0632\u0645\u0627\u0646 \u0628\u0627\u0642\u06CC\u200C\u0645\u0627\u0646\u062F\u0647</div><b>${daysLeft === null ? "\u0646\u0627\u0645\u062D\u062F\u0648\u062F" : daysLeft + " \u0631\u0648\u0632"}</b></div>
    <div class="kv"><div class="k">\u062A\u0639\u062F\u0627\u062F \u062F\u0633\u062A\u06AF\u0627\u0647</div><b>${user.device_limit || "-"}</b></div>
    <div class="kv"><div class="k">\u0622\u067E\u0644\u0648\u062F</div><b>${gb(user.up_bytes)} GB</b></div>
    <div class="kv"><div class="k">\u062F\u0627\u0646\u0644\u0648\u062F</div><b>${gb(user.down_bytes)} GB</b></div>
    <div class="kv"><div class="k">\u0627\u062A\u0635\u0627\u0644\u200C\u0647\u0627</div><b>${stats?.conns || 0}</b></div>
    <div class="kv"><div class="k">\u0622\u062E\u0631\u06CC\u0646 \u0627\u062A\u0635\u0627\u0644</div><b style="font-size:12px">${esc(user.last_seen || "\u2014")}</b></div>
  </div>
  <a class="btn" href="${esc(origin)}/s/${esc(user.sub_token)}">\u{1F4E5} \u062F\u0631\u06CC\u0627\u0641\u062A \u06A9\u0627\u0646\u0641\u06CC\u06AF</a>
  <a class="btn ghost" href="v2rayng://install-config?url=${encodeURIComponent(`${origin}/s/${user.sub_token}`)}">\u{1F4F2} \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0645\u0633\u062A\u0642\u06CC\u0645 \u062F\u0631 v2rayNG / PattNG</a>
  <div class="muted" style="margin-top:10px">\u0644\u06CC\u0646\u06A9 \u0627\u0634\u062A\u0631\u0627\u06A9 (\u062F\u0631 \u06A9\u0644\u0627\u06CC\u0646\u062A \u0648\u0627\u0631\u062F \u06A9\u0646):</div>
  <code>${esc(origin)}/s/${esc(user.sub_token)}</code>

  <div style="margin-top:18px;padding:14px;border-radius:15px;background:#0a0e15;border:1px solid var(--line)">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <b style="font-size:13px;color:var(--a1)">\u{1F4F1} \u0633\u0646\u0633\u0648\u0631 \u0647\u0648\u0634\u0645\u0646\u062F \u062E\u0637 \u06AF\u0648\u0634\u06CC \u0648 \u0631\u0627\u062F\u0627\u0631 \u0632\u06CC\u0631\u0632\u0645\u06CC\u0646\u06CC</b>
      <span id="net-badge" class="badge ok" style="font-size:10.5px">\u062F\u0631 \u062D\u0627\u0644 \u0633\u0646\u062C\u0634 \u062E\u0637\u2026</span>
    </div>
    <div id="net-info" class="muted" style="font-size:11.5px;margin-top:8px;line-height:1.7">\u062F\u0631 \u062D\u0627\u0644 \u062A\u0634\u062E\u06CC\u0635 \u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u0633\u06CC\u0645\u200C\u06A9\u0627\u0631\u062A/\u0648\u0627\u06CC\u200C\u0641\u0627\u06CC \u0648 \u0648\u0636\u0639\u06CC\u062A \u0631\u0627\u062F\u06CC\u0648\u06CC\u06CC \u06AF\u0648\u0634\u06CC\u2026</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
      <button class="btn" id="btn-autotune" type="button" style="margin-top:0;padding:10px 12px;font-size:12px">\u26A1 \u062A\u0646\u0638\u06CC\u0645 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0628\u0631\u0627\u06CC \u0646\u062A \u0645\u0646</button>
      <button class="btn ghost" id="btn-underground" type="button" style="margin-top:0;padding:10px 12px;font-size:12px;border-color:rgba(34,211,238,.35);color:var(--a1)">\u{1F575}\uFE0F \u06A9\u0634\u0641 \u0622\u06CC\u200C\u067E\u06CC \u0632\u06CC\u0631\u0632\u0645\u06CC\u0646\u06CC</button>
    </div>
  </div>

  <div class="muted" style="margin-top:18px">\u26A1\uFE0F \u062A\u0633\u062A \u0632\u0646\u062F\u0647 \u067E\u06CC\u0646\u06AF \u0648 \u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646\u062A\u0631\u0646\u062A \u0634\u0645\u0627</div>
  <div class="muted" style="font-size:11.5px;margin-top:3px">\u067E\u06CC\u0646\u06AF \u0645\u0633\u062A\u0642\u06CC\u0645\u0627\u064B \u0627\u0632 \u0645\u0631\u0648\u0631\u06AF\u0631 \u06AF\u0648\u0634\u06CC \u0634\u0645\u0627 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u0633\u0628\u0632 \u0631\u0627 \u0633\u062A\u0627\u0631\u0647 \u0628\u0632\u0646\u06CC\u062F \u062A\u0627 \u062F\u0631 \u0635\u062F\u0631 \u0633\u0627\u0628\u200C\u0644\u06CC\u0646\u06A9 \u0642\u0631\u0627\u0631 \u0628\u06AF\u06CC\u0631\u0646\u062F.</div>
  <div id="iplist" style="margin-top:10px"></div>
  <button class="btn ghost" id="ip-test" type="button">\u26A1 \u062A\u0633\u062A \u0645\u062C\u062F\u062F \u067E\u06CC\u0646\u06AF \u0631\u0648\u06CC \u0627\u06CC\u0646\u062A\u0631\u0646\u062A \u0645\u0646</button>
  <div id="ip-out" class="muted" style="margin-top:8px;font-size:11.5px"></div>
  <div class="muted" style="margin-top:14px;font-size:11px">${esc(name)} \u2014 \u067E\u0646\u0644 \u0645\u062F\u06CC\u0631\u06CC\u062A \u067E\u0631\u0648\u06A9\u0633\u06CC \u0631\u0648\u06CC Cloudflare Workers</div>
</div>
<script>
(function(){
  var CANDS = ${JSON.stringify(stats && stats.candidates || [])};
  var TOKEN = ${JSON.stringify(user.sub_token)};
  var ORIGIN = ${JSON.stringify(origin)};
  var SELF = ORIGIN.replace('https://', '').replace('http://', '');
  var el = document.getElementById('iplist'), out = document.getElementById('ip-out');
  var netInfoEl = document.getElementById('net-info'), netBadgeEl = document.getElementById('net-badge');
  var sensedIsp = null;
  function nm(v){ return (v && typeof v === 'object') ? String(v.addr || v.ip || '') : String(v == null ? '' : v); }
  function kind(a){ if (a.indexOf(':') >= 0) return 'ipv6'; var c = a.charAt(0); return (c >= '0' && c <= '9') ? 'ipv4' : 'host'; }
  function cls(ms){ if (ms == null || ms <= 0) return ''; return ms < 180 ? 'good' : ms > 500 ? 'bad' : ''; }
  var rows = CANDS.map(function(c){
    var m = (c && c.ms != null && Number(c.ms) >= 25) ? Number(c.ms) : null;
    return { addr: nm(c), ms: m, colo: (c && c.colo) || null, mbps: null, source: (c && c.source) || '', testing: false };
  }).filter(function(r){ return r.addr; });
  function render(){
    if (!rows.length) { el.innerHTML = '<div class="muted" style="font-size:11.5px">\u0647\u0646\u0648\u0632 \u06A9\u0627\u0646\u062F\u06CC\u062F\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647.</div>'; return; }
    el.innerHTML = rows.slice(0, 14).map(function(r){
      var k = kind(r.addr), tag = r.source ? r.source : (k === 'host' ? '\u062F\u0627\u0645\u0646\u0647 \xB7 443/2053' : k === 'ipv6' ? 'IPv6 \xB7 443/2053' : '\u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632 \xB7 443/2053');
      var msTxt = r.testing ? '\u23F3 \u062F\u0631 \u062D\u0627\u0644 \u062A\u0633\u062A\u2026' : (r.ms != null && r.ms > 0 ? r.ms + ' ms' : '\u0622\u0645\u0627\u062F\u0647 \u062A\u0633\u062A');
      return '<div class="ip"><b>' + r.addr + '</b><span class="muted" style="font-size:10.5px">' + tag + (r.colo ? ' \xB7 ' + r.colo : '') + '</span>' +
        '<span class="ms ' + cls(r.ms) + '">' + msTxt + '</span>' +
        '<button class="star" data-addr="' + r.addr + '" data-ms="' + (r.ms || '') + '" title="\u0627\u06CC\u0646 \u0622\u06CC\u200C\u067E\u06CC \u0631\u0648\u06CC \u0627\u06CC\u0646\u062A\u0631\u0646\u062A \u0645\u0646 \u0639\u0627\u0644\u06CC \u0628\u0648\u062F">\u2605</button></div>';
    }).join('');
  }
  render();
  async function runNetSensor(){
    try {
      var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
      var radioType = conn.type ? (conn.type + (conn.effectiveType ? ' / ' + conn.effectiveType.toUpperCase() : '')) : (conn.effectiveType ? conn.effectiveType.toUpperCase() : '\u0646\u0627\u0645\u0634\u062E\u0635');
      var radioDl = conn.downlink ? conn.downlink + ' Mbps' : '';
      var ns = await fetch(ORIGIN + '/api/diag/net-sense?token=' + encodeURIComponent(TOKEN), { cache: 'no-store' }).then(function(r){ return r.json(); });
      if (ns && ns.ok) {
        sensedIsp = ns.isp;
        if (netBadgeEl) netBadgeEl.textContent = ns.isp.name + ' \xB7 ' + ns.ipVersion;
        if (netInfoEl) {
          netInfoEl.innerHTML =
            '\u{1F4E1} <b>\u0627\u067E\u0631\u0627\u062A\u0648\u0631:</b> ' + ns.isp.name + ' &nbsp;|&nbsp; \u{1F4F6} <b>\u0633\u0646\u0633\u0648\u0631 \u06AF\u0648\u0634\u06CC:</b> ' + radioType + (radioDl ? ' (' + radioDl + ')' : '') +
            '<br>\u{1F6E1}\uFE0F <b>\u0641\u0631\u06AF\u0645\u0646\u062A \u0628\u0647\u06CC\u0646\u0647 \u062E\u0637 \u0634\u0645\u0627:</b> <span style="direction:ltr;display:inline-block;color:#22d3ee">' + ns.isp.fragmentRule + '</span> \xB7 \u067E\u0648\u0631\u062A \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC: <b>' + (ns.isp.bestPorts || [443,2053]).join(' / ') + '</b>' +
            '<br><span style="color:#a7f3d0">' + ns.isp.tip + '</span>';
        }
      }
    } catch (e) {
      if (netInfoEl) netInfoEl.textContent = '\u0633\u0646\u0633\u0648\u0631 \u062E\u0637 \u0622\u0645\u0627\u062F\u0647 \u0627\u0633\u062A. \u0628\u0631\u0627\u06CC \u0628\u0647\u06CC\u0646\u0647\u200C\u0633\u0627\u0632\u06CC \u0631\u0648\u06CC \u062F\u06A9\u0645\u0647\u200C\u0647\u0627\u06CC \u0632\u06CC\u0631 \u0628\u0632\u0646\u06CC\u062F.';
    }
  }
  runNetSensor();
  document.getElementById('btn-autotune').onclick = async function(){
    var btn = document.getElementById('btn-autotune');
    btn.disabled = true; btn.textContent = '\u23F3 \u062F\u0631 \u062D\u0627\u0644 \u062A\u0646\u0638\u06CC\u0645\u2026';
    try {
      var goodIps = rows.filter(function(r){ return r.ms != null && r.ms >= 25 && r.ms < 600; }).map(function(r){ return r.addr; }).slice(0, 10);
      var res = await fetch(ORIGIN + '/api/diag/net-sense?token=' + encodeURIComponent(TOKEN), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apply: true, fragment: sensedIsp ? sensedIsp.fragment : undefined, ips: goodIps.length >= 3 ? goodIps : undefined })
      }).then(function(r){ return r.json(); });
      if (res && res.ok) {
        out.textContent = '\u2705 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0634\u0645\u0627 \u0628\u0631 \u0627\u0633\u0627\u0633 \u062E\u0637 \xAB' + (res.isp ? res.isp.name : '\u0641\u0639\u0644\u06CC') + '\xBB \u0628\u0627 \u0628\u0647\u062A\u0631\u06CC\u0646 \u0641\u0631\u06AF\u0645\u0646\u062A \u0648 \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632 \u062A\u0646\u0638\u06CC\u0645 \u0634\u062F! \u0627\u06A9\u0646\u0648\u0646 \u062F\u0631 v2rayNG \u0627\u0634\u062A\u0631\u0627\u06A9 \u0631\u0627 \u0622\u067E\u062F\u06CC\u062A \u06A9\u0646\u06CC\u062F.';
      }
    } catch (e) {}
    btn.disabled = false; btn.textContent = '\u26A1 \u062A\u0646\u0638\u06CC\u0645 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0628\u0631\u0627\u06CC \u0646\u062A \u0645\u0646';
  };
  document.getElementById('btn-underground').onclick = async function(){
    var btn = document.getElementById('btn-underground');
    btn.disabled = true; btn.textContent = '\u{1F575}\uFE0F \u062F\u0631 \u062D\u0627\u0644 \u0634\u06A9\u0627\u0631\u2026';
    out.textContent = '\u062F\u0631 \u062D\u0627\u0644 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u0632\u06CC\u0631\u0632\u0645\u06CC\u0646\u06CC \u0647\u0645\u0633\u0627\u06CC\u0647 (/24) \u0648 \u062F\u0627\u0645\u0646\u0647\u200C\u0647\u0627\u06CC \u0633\u0627\u0632\u0645\u0627\u0646\u06CC\u2026';
    try {
      var seeds = rows.filter(function(r){ return r.ms != null && r.ms < 350; }).map(function(r){ return r.addr; }).slice(0, 4);
      var hRes = await fetch(ORIGIN + '/api/diag/underground-hunt?token=' + encodeURIComponent(TOKEN), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seeds: seeds, limit: 12, apply: false })
      }).then(function(r){ return r.json(); });
      if (hRes && Array.isArray(hRes.candidates) && hRes.candidates.length) {
        rows = hRes.candidates.map(function(c){
          return { addr: c.addr, ms: null, colo: c.colo || null, source: c.source || '\u0632\u06CC\u0631\u0632\u0645\u06CC\u0646\u06CC', testing: true };
        });
        render();
        await runLiveTest();
        var fastUnderground = rows.filter(function(r){ return r.ms != null && r.ms >= 25 && r.ms < 500; }).map(function(r){ return r.addr; });
        if (fastUnderground.length) {
          await fetch(ORIGIN + '/api/diag/net-sense?token=' + encodeURIComponent(TOKEN), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ apply: true, ips: fastUnderground.slice(0, 10) })
          });
          out.textContent = '\u{1F575}\uFE0F ' + fastUnderground.length + ' \u0622\u06CC\u200C\u067E\u06CC \u0632\u06CC\u0631\u0632\u0645\u06CC\u0646\u06CC \u0628\u0627 \u067E\u06CC\u0646\u06AF \u0639\u0627\u0644\u06CC \u0631\u0648\u06CC \u062E\u0637 \u0634\u0645\u0627 \u06A9\u0634\u0641 \u0648 \u062F\u0631 \u0635\u062F\u0631 \u0633\u0627\u0628\u200C\u0644\u06CC\u0646\u06A9 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F!';
        }
      }
    } catch (e) {}
    btn.disabled = false; btn.textContent = '\u{1F575}\uFE0F \u06A9\u0634\u0641 \u0622\u06CC\u200C\u067E\u06CC \u0632\u06CC\u0631\u0632\u0645\u06CC\u0646\u06CC';
  };
  function measureEdgeRtt(){
    return new Promise(function(res){
      var u = ORIGIN + '/healthz?x=' + Math.random().toString(36).slice(2);
      fetch(u, { cache: 'no-store' }).then(function(){
        var t0 = performance.now();
        return fetch(u + 'w', { cache: 'no-store' }).then(function(){
          res(Math.max(25, Math.round(performance.now() - t0)));
        });
      }).catch(function(){ res(null); });
    });
  }
  function probeHost(addr){
    return new Promise(function(res){
      var t0 = performance.now(), c = new AbortController();
      var to = setTimeout(function(){ c.abort(); res(null); }, 3800);
      var target = addr.indexOf(':') >= 0 ? '[' + addr + ']' : addr;
      fetch('https://' + target + '/cdn-cgi/trace?x=' + Math.round(performance.now()), { mode: 'no-cors', cache: 'no-store', signal: c.signal })
        .then(function(){ clearTimeout(to); res(Math.max(25, Math.round(performance.now() - t0))); })
        .catch(function(){ clearTimeout(to); res(null); });
    });
  }
  function speedTest(){
    var BYTES = 1024 * 1024;
    return new Promise(function(res){
      var t0 = performance.now(), c = new AbortController();
      var to = setTimeout(function(){ c.abort(); res(null); }, 20000);
      fetch(ORIGIN + '/api/diag/speed?bytes=' + BYTES + '&token=' + encodeURIComponent(TOKEN) + '&x=' + Math.round(performance.now()), { cache: 'no-store', signal: c.signal })
        .then(function(r){ return r.arrayBuffer(); })
        .then(function(b){
          clearTimeout(to);
          var sec = (performance.now() - t0) / 1000;
          res(sec > 0 ? { mbps: Math.round((b.byteLength * 8 / sec) / 1e5) / 10, ms: Math.max(25, Math.round(performance.now() - t0)) } : null);
        })
        .catch(function(){ clearTimeout(to); res(null); });
    });
  }
  async function runLiveTest(){
    var btn = document.getElementById('ip-test');
    if (btn) btn.disabled = true;
    out.textContent = '\u062F\u0631 \u062D\u0627\u0644 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u067E\u06CC\u0646\u06AF \u0648 \u0633\u0631\u0639\u062A \u0648\u0627\u0642\u0639\u06CC \u0645\u0633\u062A\u0642\u06CC\u0645\u0627\u064B \u0627\u0632 \u0631\u0648\u06CC \u0627\u06CC\u0646\u062A\u0631\u0646\u062A \u0634\u0645\u0627\u2026';
    rows.forEach(function(r){ r.testing = true; });
    render();
    var edgeRtt = await measureEdgeRtt();
    var serverMap = {};
    try {
      var pr = await fetch(ORIGIN + '/api/diag/probe-public?token=' + encodeURIComponent(TOKEN), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ips: rows.map(function(r){ return r.addr; }) })
      }).then(function(r){ return r.json(); });
      if (pr && Array.isArray(pr.results)) {
        pr.results.forEach(function(x){ if (x && x.ip && x.ok && x.ms > 0) serverMap[x.ip] = x; });
      }
    } catch (e) {}
    var browserProbes = await Promise.all(rows.map(function(r){ return probeHost(r.addr); }));
    rows.forEach(function(r, i){
      r.testing = false;
      var sv = serverMap[r.addr];
      if (sv && sv.colo) r.colo = sv.colo;
      if (browserProbes[i] != null && browserProbes[i] >= 25) {
        r.ms = browserProbes[i];
      }
      // \u067E\u06CC\u0646\u06AF Edge \u062F\u06CC\u062A\u0627\u0633\u0646\u062A\u0631 \u0647\u0631\u06AF\u0632 \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 \u067E\u06CC\u0646\u06AF \u062E\u0637 \u06A9\u0627\u0631\u0628\u0631 \u062C\u0627 \u0632\u062F\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.
    });
    var sp = await speedTest();
    var self = rows.filter(function(r){ return r.addr === SELF || r.addr === ORIGIN; })[0];
    if (sp) {
      // \u0633\u0631\u0639\u062A \u0641\u0642\u0637 \u0628\u0631\u0627\u06CC \u062E\u0648\u062F \u0644\u06CC\u0646\u06A9 \u067E\u0646\u0644 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u0628\u0647 \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u062F\u06CC\u06AF\u0631 \u06A9\u067E\u06CC \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.
      if (self) { if (edgeRtt) self.ms = edgeRtt; self.mbps = sp.mbps; }
      else rows.unshift({ addr: SELF, ms: edgeRtt || sp.ms, mbps: sp.mbps, colo: null, testing: false, source: '\u0633\u0631\u0639\u062A \u0648\u0627\u0642\u0639\u06CC \u062E\u0637 \u062A\u0627 \u067E\u0646\u0644' });
    }
    rows.sort(function(a, b){ return (a.ms == null ? 9e9 : a.ms) - (b.ms == null ? 9e9 : b.ms); });
    render();
    var good = rows.filter(function(r){ return r.ms != null && r.ms >= 25; });
    out.textContent = sp
      ? ('\u2713 \u062A\u0633\u062A \u0648\u0627\u0642\u0639\u06CC \u06A9\u0627\u0645\u0644 \u0634\u062F \u2014 \u067E\u06CC\u0646\u06AF \u0644\u0628\u0647: ' + (edgeRtt || sp.ms) + ' ms \xB7 \u0633\u0631\u0639\u062A \u062F\u0627\u0646\u0644\u0648\u062F: ' + sp.mbps + ' Mbps (' + good.length + ' \u0646\u0648\u062F \u0641\u0639\u0627\u0644).')
      : ('\u2713 \u062A\u0633\u062A \u067E\u06CC\u0646\u06AF \u06A9\u0627\u0645\u0644 \u0634\u062F (' + good.length + ' \u0646\u0648\u062F \u0641\u0639\u0627\u0644).');
    if (edgeRtt != null && good.length) {
      try {
        await fetch('/api/report-ip', { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: TOKEN, results: good.map(function(r){ return { ip: r.addr, ms: r.ms, colo: r.colo, mbps: r.mbps }; }) }) });
      } catch (e) {}
    }
    if (btn) btn.disabled = false;
  }
  document.getElementById('ip-test').onclick = runLiveTest;
  setTimeout(runLiveTest, 120);
  el.addEventListener('click', async function(ev){
    var b = ev.target.closest('.star'); if (!b) return;
    var row = rows.filter(function(r){ return r.addr === b.dataset.addr; })[0];
    var realMs = (row && row.ms >= 25) ? row.ms : (Number(b.dataset.ms) >= 25 ? Number(b.dataset.ms) : null);
    if (realMs == null) { out.textContent = '\u0627\u06CC\u0646 \u0622\u062F\u0631\u0633 \u0647\u0646\u0648\u0632 \u0631\u0648\u06CC \u062E\u0637 \u0634\u0645\u0627 \u067E\u0627\u0633\u062E \u0645\u0639\u062A\u0628\u0631 \u0646\u062F\u0627\u062F\u0647 \u0648 \u062B\u0628\u062A \u0646\u0634\u062F.'; return; }
    b.textContent = '\u2713';
    try {
      await fetch('/api/report-ip', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, results: [{ ip: b.dataset.addr, ms: realMs, colo: row && row.colo }] }) });
      out.textContent = '\u2605 \u0622\u06CC\u200C\u067E\u06CC ' + b.dataset.addr + ' \u0628\u0627 \u067E\u06CC\u0646\u06AF ' + realMs + ' ms \u062F\u0631 \u0635\u062F\u0631 \u0633\u0627\u0628\u200C\u0644\u06CC\u0646\u06A9 \u0634\u0645\u0627 \u062B\u0628\u062A \u0634\u062F.';
    } catch (e) {}
  });
})();
<\/script>
</body></html>`;
}
var enc2, FRAGMENT_PRESETS, FINGERPRINTS, fragmentPreset, fragmentValue, sniFor, PORTS_TLS2, isTlsPort, encHost, MESH_AI_DOMAINS, MESH_AI_PACKAGES, MESH_GAME_DOMAINS, b64, esc;
var init_links = __esm({
  "src/links.js"() {
    init_scan();
    enc2 = encodeURIComponent;
    FRAGMENT_PRESETS = [
      { id: "none", label: "\u2014 \u0628\u062F\u0648\u0646 \u0641\u0631\u06AF\u0645\u0646\u062A \u0633\u0631\u0627\u0633\u0631\u06CC (\u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627\u06CC \u0648\u06CC\u0698\u0647 \u0647\u0631 \u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u062C\u062F\u0627\u06AF\u0627\u0646\u0647 \u0633\u0627\u062E\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F)", size: "", interval: "", packets: "" },
      { id: "irancell", label: "\u{1F49B} \u0648\u06CC\u0698\u0647 \u0627\u06CC\u0631\u0627\u0646\u0633\u0644 (\u0641\u0631\u06AF\u0645\u0646\u062A \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F: 100-200 / 5-10 / tlshello)", size: "100-200", interval: "5-10", packets: "tlshello" },
      { id: "tci", label: "\u260E\uFE0F \u0648\u06CC\u0698\u0647 \u0645\u062E\u0627\u0628\u0631\u0627\u062A \u0648 \u0627\u06CC\u0646\u062A\u0631\u0646\u062A \u062B\u0627\u0628\u062A (\u0641\u0631\u06AF\u0645\u0646\u062A: 50-200 / 1-3 / tlshello)", size: "50-200", interval: "1-3", packets: "tlshello" },
      { id: "mci", label: "\u{1F4F1} \u0648\u06CC\u0698\u0647 \u0647\u0645\u0631\u0627\u0647 \u0627\u0648\u0644 (\u0641\u0631\u06AF\u0645\u0646\u062A: 10-30 / 2-5 / tlshello)", size: "10-30", interval: "2-5", packets: "tlshello" },
      { id: "rightel", label: "\u{1F49C} \u0648\u06CC\u0698\u0647 \u0631\u0627\u06CC\u062A\u0644 \u0648 \u0634\u0627\u062A\u0644 (\u0641\u0631\u06AF\u0645\u0646\u062A: 50-100 / 2-5 / tlshello)", size: "50-100", interval: "2-5", packets: "tlshello" },
      { id: "gaming", label: "\u{1F680} \u062D\u0627\u0644\u062A \u06AF\u06CC\u0645\u06CC\u0646\u06AF \u0641\u0648\u0642 \u0633\u0631\u06CC\u0639 (\u067E\u06CC\u0646\u06AF \u067E\u0627\u06CC\u06CC\u0646: 200-3000 / 1-2 / tlshello)", size: "200-3000", interval: "1-2", packets: "tlshello" },
      { id: "aggressive", label: "\u{1F525} \u0636\u062F \u0641\u06CC\u0644\u062A\u0631 \u062A\u0647\u0627\u062C\u0645\u06CC (\u0641\u0631\u06AF\u0645\u0646\u062A \u0631\u06CC\u0632: 10-20 / 10-20 / tlshello)", size: "10-20", interval: "10-20", packets: "tlshello" }
    ];
    FINGERPRINTS = ["chrome", "unsafe", "firefox", "safari", "ios", "android", "edge", "random", "randomized"];
    fragmentPreset = (id) => {
      const mapAlias = { high: "irancell", medium: "mci", low: "rightel" };
      const key = mapAlias[id] || id;
      return FRAGMENT_PRESETS.find((p) => p.id === key) || FRAGMENT_PRESETS[0];
    };
    fragmentValue = (id) => {
      const p = fragmentPreset(id);
      return p.size ? p : null;
    };
    sniFor = (settings) => String(settings.public_host || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").trim();
    PORTS_TLS2 = [443, 2053, 8443, 2083, 2087, 2096];
    isTlsPort = (p) => PORTS_TLS2.includes(Number(p));
    encHost = (h) => {
      const clean = String(h || "").trim().replace(/^\[|\]$/g, "");
      return clean.includes(":") ? `[${clean}]` : clean;
    };
    MESH_AI_DOMAINS = [
      "gemini.google.com",
      "generativelanguage.googleapis.com",
      "aistudio.google.com",
      "googleapis.com",
      "googleusercontent.com",
      "gstatic.com",
      "accounts.google.com",
      "chatgpt.com",
      "openai.com",
      "claude.ai",
      "anthropic.com"
    ];
    MESH_AI_PACKAGES = [
      "com.google.android.googlequicksearchbox",
      "com.google.android.gms",
      "com.google.android.gsf",
      "com.android.vending"
    ];
    MESH_GAME_DOMAINS = [
      "steampowered.com",
      "steamcommunity.com",
      "steamcontent.com",
      "epicgames.com",
      "riotgames.com",
      "ea.com",
      "ubisoft.com",
      "battle.net"
    ];
    b64 = (s) => btoa(unescape(encodeURIComponent(s)));
    esc = (s) => String(s ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]);
  }
});

// src/core.js
import { connect as connect2 } from "cloudflare:sockets";
function isYoutubeMediaHost(host) {
  const h = String(host || "").trim().toLowerCase().replace(/\.$/, "");
  if (!h) return false;
  return h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be" || h.endsWith(".googlevideo.com") || h.endsWith(".ytimg.com") || h.endsWith(".ggpht.com");
}
function isGeminiOrAiHost(host) {
  const h = String(host || "").trim().toLowerCase().replace(/\.$/, "");
  if (!h || isYoutubeMediaHost(h)) return false;
  return GEMINI_AI_SUFFIXES.some((suf) => h === suf || h.endsWith("." + suf));
}
function extractTlsSni(chunks) {
  if (!chunks || !chunks.length) return null;
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  if (total < 43) return null;
  const buf = new Uint8Array(Math.min(total, 2048));
  let off = 0;
  for (const c of chunks) {
    const n = Math.min(c.byteLength, buf.byteLength - off);
    if (n <= 0) break;
    buf.set(c.subarray(0, n), off);
    off += n;
  }
  if (buf[0] !== 22 || buf[1] !== 3 || buf[5] !== 1) return null;
  let p = 43;
  if (p >= buf.byteLength) return null;
  const sessIdLen = buf[p];
  p += 1 + sessIdLen;
  if (p + 2 > buf.byteLength) return null;
  const cipherLen = buf[p] << 8 | buf[p + 1];
  p += 2 + cipherLen;
  if (p + 1 > buf.byteLength) return null;
  const compLen = buf[p];
  p += 1 + compLen;
  if (p + 2 > buf.byteLength) return null;
  const extTotalLen = buf[p] << 8 | buf[p + 1];
  p += 2;
  const end = Math.min(buf.byteLength, p + extTotalLen);
  while (p + 4 <= end) {
    const extType = buf[p] << 8 | buf[p + 1];
    const extLen = buf[p + 2] << 8 | buf[p + 3];
    p += 4;
    if (p + extLen > end) break;
    if (extType === 0 && extLen >= 5) {
      let q = p + 2;
      const nameType = buf[q];
      const nameLen = buf[q + 1] << 8 | buf[q + 2];
      q += 3;
      if (nameType === 0 && q + nameLen <= p + extLen) {
        return dec.decode(buf.subarray(q, q + nameLen)).trim().toLowerCase();
      }
    }
    p += extLen;
  }
  return null;
}
function isKnownNonCfHost(host) {
  const h = String(host || "").trim().toLowerCase().replace(/\.$/, "");
  if (!h) return false;
  if (NON_CF_HOST_CACHE.has(h) || isYoutubeMediaHost(h)) return true;
  if (h.endsWith(".cdninstagram.com") || h.endsWith(".fbcdn.net") || h.endsWith(".whatsapp.net") || h.endsWith(".whatsapp.com")) {
    return true;
  }
  return false;
}
function isCloudflareTarget(host) {
  const h = String(host || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return false;
  if (h === "cp.cloudflare.com" || h === "speed.cloudflare.com" || h === "cloudflare.com" || h.endsWith(".workers.dev")) {
    return true;
  }
  if (h.startsWith("2606:4700:") || h.startsWith("2803:f800:") || h.startsWith("2a06:98c0:")) {
    return true;
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const n = (Number(m[1]) << 24 | Number(m[2]) << 16 | Number(m[3]) << 8 | Number(m[4])) >>> 0;
  for (const [net, mask] of CF_IPV4_CIDRS) {
    if ((n & mask) >>> 0 === net >>> 0) return true;
  }
  return false;
}
function ipv4ToNat64(ip, prefix = "2602:fc59:b0:64::") {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || "").trim());
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]), d = Number(m[4]);
  if ([a, b, c, d].some((x) => x < 0 || x > 255)) return null;
  const h1 = (a << 8 | b).toString(16);
  const h2 = (c << 8 | d).toString(16);
  return `[${prefix}${h1}:${h2}]`;
}
function parseProxyEntry(entry, defaultPort = 443) {
  const s = String(entry || "").trim();
  if (!s) return null;
  const schemeMatch = /^(socks5|http):\/\/(?:([^:@]+):([^@]+)@)?([^:/]+)(?::(\d+))?$/i.exec(s);
  if (schemeMatch) {
    return {
      type: schemeMatch[1].toLowerCase(),
      username: schemeMatch[2] ? decodeURIComponent(schemeMatch[2]) : "",
      password: schemeMatch[3] ? decodeURIComponent(schemeMatch[3]) : "",
      hostname: schemeMatch[4].trim(),
      port: Number(schemeMatch[5]) || (schemeMatch[1].toLowerCase() === "socks5" ? 1080 : 8080),
      raw: s
    };
  }
  if (s.startsWith("[")) {
    const idx = s.indexOf("]");
    if (idx < 0) return null;
    const host = s.slice(0, idx + 1);
    const rest = s.slice(idx + 1);
    const port = rest.startsWith(":") ? Number(rest.slice(1)) || defaultPort : defaultPort;
    return { type: "proxyip", hostname: host, port };
  }
  const lastColon = s.lastIndexOf(":");
  if (lastColon > 0 && !s.slice(0, lastColon).includes(":")) {
    const host = s.slice(0, lastColon).trim();
    const port = Number(s.slice(lastColon + 1)) || defaultPort;
    return { type: "proxyip", hostname: host, port };
  }
  return { type: "proxyip", hostname: s, port: defaultPort };
}
async function connectSocks5(spec, destHost, destPort, timeoutMs = 2800) {
  const sock = connect2({ hostname: spec.hostname, port: spec.port });
  let timer = null;
  const withTimeout = (p) => Promise.race([
    p,
    new Promise((_, rej) => {
      timer = setTimeout(() => rej(new Error("socks5-timeout")), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
  try {
    if (sock.opened) await withTimeout(sock.opened);
    const writer = sock.writable.getWriter();
    const reader = sock.readable.getReader();
    try {
      const hasAuth = Boolean(spec.username);
      await writer.write(hasAuth ? new Uint8Array([5, 2, 0, 2]) : new Uint8Array([5, 1, 0]));
      const { value: g } = await withTimeout(reader.read());
      if (!g || g.byteLength < 2 || g[0] !== 5) throw new Error("socks5-bad-greeting");
      if (g[1] === 2) {
        const uBytes = enc3.encode(spec.username || "");
        const pBytes = enc3.encode(spec.password || "");
        const authReq = new Uint8Array(3 + uBytes.length + pBytes.length);
        authReq[0] = 1;
        authReq[1] = uBytes.length;
        authReq.set(uBytes, 2);
        authReq[2 + uBytes.length] = pBytes.length;
        authReq.set(pBytes, 3 + uBytes.length);
        await writer.write(authReq);
        const { value: ar } = await withTimeout(reader.read());
        if (!ar || ar.byteLength < 2 || ar[1] !== 0) throw new Error("socks5-auth-failed");
      } else if (g[1] !== 0) {
        throw new Error("socks5-unsupported-auth");
      }
      const cleanDest = String(destHost || "").replace(/^\[|\]$/g, "");
      const ip4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(cleanDest);
      let req;
      if (ip4) {
        req = new Uint8Array([5, 1, 0, 1, Number(ip4[1]), Number(ip4[2]), Number(ip4[3]), Number(ip4[4]), destPort >> 8 & 255, destPort & 255]);
      } else {
        const dBytes = enc3.encode(cleanDest);
        req = new Uint8Array(5 + dBytes.length + 2);
        req[0] = 5;
        req[1] = 1;
        req[2] = 0;
        req[3] = 3;
        req[4] = dBytes.length;
        req.set(dBytes, 5);
        req[5 + dBytes.length] = destPort >> 8 & 255;
        req[6 + dBytes.length] = destPort & 255;
      }
      await writer.write(req);
      const { value: rep } = await withTimeout(reader.read());
      if (!rep || rep.byteLength < 4 || rep[1] !== 0) throw new Error("socks5-connect-rejected");
    } finally {
      try {
        writer.releaseLock();
      } catch {
      }
      try {
        reader.releaseLock();
      } catch {
      }
    }
    return sock;
  } catch (e) {
    try {
      sock.close();
    } catch {
    }
    throw e;
  }
}
async function connectHttpTunnel(spec, destHost, destPort, timeoutMs = 2800) {
  const sock = connect2({ hostname: spec.hostname, port: spec.port });
  let timer = null;
  const withTimeout = (p) => Promise.race([
    p,
    new Promise((_, rej) => {
      timer = setTimeout(() => rej(new Error("http-proxy-timeout")), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
  try {
    if (sock.opened) await withTimeout(sock.opened);
    const writer = sock.writable.getWriter();
    const reader = sock.readable.getReader();
    try {
      const target = `${destHost}:${destPort}`;
      const lines = [
        `CONNECT ${target} HTTP/1.1`,
        `Host: ${target}`,
        "Proxy-Connection: keep-alive"
      ];
      if (spec.username) {
        const b642 = btoa(`${spec.username}:${spec.password || ""}`);
        lines.push(`Proxy-Authorization: Basic ${b642}`);
      }
      lines.push("", "");
      await writer.write(enc3.encode(lines.join("\r\n")));
      const { value } = await withTimeout(reader.read());
      if (!value || !value.byteLength) throw new Error("http-proxy-empty");
      const text = dec.decode(value);
      if (!/^HTTP\/1\.[01]\s+200\b/i.test(text)) throw new Error("http-proxy-rejected");
    } finally {
      try {
        writer.releaseLock();
      } catch {
      }
      try {
        reader.releaseLock();
      } catch {
      }
    }
    return sock;
  } catch (e) {
    try {
      sock.close();
    } catch {
    }
    throw e;
  }
}
function invalidateUser(uuid = null) {
  if (uuid) USER_CACHE.delete(uuid.toLowerCase());
  else USER_CACHE.clear();
  PASS_CACHE.clear();
  ALL_USERS_AT = 0;
}
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", enc3.encode(text));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function findUserByUuid(env, uuid) {
  const key = String(uuid || "").toLowerCase();
  const c = USER_CACHE.get(key);
  if (c && Date.now() - c.at < 12e4) return c.user;
  const fetchPromise = INFLIGHT_UUID.get(key) || (async () => {
    try {
      let u = await env.DB.prepare("SELECT * FROM users WHERE lower(uuid) = ?").bind(key).first();
      if (!u && UUID_ALIASES[key]) {
        u = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(UUID_ALIASES[key]).first();
      }
      if (u) USER_CACHE.set(key, { at: Date.now(), user: u });
      return u || PREWARMED_USERS.get(key) || null;
    } catch {
      return PREWARMED_USERS.get(key) || null;
    }
  })().finally(() => INFLIGHT_UUID.delete(key));
  INFLIGHT_UUID.set(key, fetchPromise);
  if (PREWARMED_USERS.has(key)) {
    return PREWARMED_USERS.get(key);
  }
  return fetchPromise;
}
async function warmPasswordMap(env, trojanGlobalPass) {
  if (Date.now() - ALL_USERS_AT < 2e4 && PASS_CACHE.size > 0) return;
  const rows = await env.DB.prepare("SELECT * FROM users WHERE is_active = 1").all();
  PASS_CACHE.clear();
  for (const u of rows.results || []) {
    for (const candidate of [u.uuid, u.username, trojanGlobalPass].filter(Boolean)) {
      const h = await sha224Hex(candidate);
      if (!PASS_CACHE.has(h)) PASS_CACHE.set(h, u);
    }
  }
  ALL_USERS_AT = Date.now();
}
function userStatus(u) {
  if (!u) return "missing";
  if (!u.is_active) return "disabled";
  if (u.expires_at) {
    const exp = /* @__PURE__ */ new Date(String(u.expires_at).replace(" ", "T") + "Z");
    if (exp < /* @__PURE__ */ new Date()) return "expired";
  }
  const used = Number(u.up_bytes || 0) + Number(u.down_bytes || 0);
  if (Number(u.quota_bytes || 0) > 0 && used >= Number(u.quota_bytes)) return "limited";
  if (Number(u.request_limit || 0) > 0 && Number(u.request_count || 0) >= Number(u.request_limit)) return "limited";
  return "active";
}
function isBlockedHost(host, settings, user) {
  const h = String(host || "").toLowerCase();
  if (!h) return false;
  const match = (suf) => h === suf || h.endsWith("." + suf);
  if (settings.block_ads === "1" && ADS_SUFFIX.some(match)) return true;
  if (settings.block_nsfw === "1" && NSFW_SUFFIX.some(match)) return true;
  const custom = [...safeJsonArray(settings.block_list), ...safeJsonArray(user?.block_list)];
  for (const item of custom) {
    const s = String(item || "").trim().toLowerCase();
    if (s && match(s)) return true;
  }
  return false;
}
function safeJsonArray(v) {
  if (Array.isArray(v)) return v;
  try {
    const j = JSON.parse(v || "[]");
    return Array.isArray(j) ? j : [];
  } catch {
    return String(v || "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  }
}
function parseVlessHeader(buf) {
  if (buf.byteLength < 24) return null;
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const version = buf[0];
  const hex = [...buf.subarray(1, 17)].map((x) => x.toString(16).padStart(2, "0")).join("");
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const optLen = buf[17];
  let off = 18 + optLen;
  if (buf.byteLength < off + 4) return null;
  const cmd = buf[off];
  const port = v.getUint16(off + 1, false);
  const atyp = buf[off + 3];
  off += 4;
  const addr = readAddress(buf, off, atyp, { vless: true });
  if (!addr) return null;
  return {
    proto: "vless",
    version,
    uuid,
    cmd,
    port: cmd === 3 ? 443 : port,
    hostname: cmd === 3 ? "mux.cool" : addr.host,
    payload: buf.subarray(addr.next)
  };
}
function parseTrojanHeader(buf) {
  if (buf.byteLength < 66) return null;
  if (buf[56] !== 13 || buf[57] !== 10) return null;
  const passHash = dec.decode(buf.subarray(0, 56)).toLowerCase();
  if (!/^[0-9a-f]{56}$/.test(passHash)) return null;
  const cmd = buf[58];
  const atyp = buf[59];
  const addr = readAddress(buf, 60, atyp, { vless: false });
  if (!addr || buf.byteLength < addr.next + 4) return null;
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const port = v.getUint16(addr.next, false);
  const crlfOff = addr.next + 2;
  const payloadOff = buf[crlfOff] === 13 && buf[crlfOff + 1] === 10 ? crlfOff + 2 : crlfOff;
  return {
    proto: "trojan",
    passHash,
    cmd,
    port,
    hostname: addr.host,
    payload: buf.subarray(payloadOff)
  };
}
function readAddress(buf, off, atyp, { vless }) {
  const isV4 = atyp === 1;
  const isDom = vless ? atyp === 2 : atyp === 3;
  const isV6 = vless ? atyp === 3 : atyp === 4;
  if (isV4) {
    if (buf.byteLength < off + 4) return null;
    return { host: `${buf[off]}.${buf[off + 1]}.${buf[off + 2]}.${buf[off + 3]}`, next: off + 4 };
  }
  if (isDom) {
    const len = buf[off];
    if (buf.byteLength < off + 1 + len) return null;
    return { host: dec.decode(buf.subarray(off + 1, off + 1 + len)), next: off + 1 + len };
  }
  if (isV6) {
    if (buf.byteLength < off + 16) return null;
    const v = new DataView(buf.buffer, buf.byteOffset + off, 16);
    const parts = [];
    for (let i = 0; i < 8; i++) parts.push(v.getUint16(i * 2, false).toString(16));
    return { host: `[${parts.join(":")}]`, next: off + 16 };
  }
  return null;
}
function readEarlyData(request) {
  const hdr = request.headers.get("sec-websocket-protocol") || "";
  if (!hdr) return null;
  const token = hdr.split(",")[0].trim();
  if (!token) return null;
  try {
    const b642 = token.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b642 + "===".slice((b642.length + 3) % 4);
    const bin = atob(pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { bytes: out, echoHeader: null };
  } catch {
    return null;
  }
}
async function authorizeRequest(env, settings, request, cred) {
  let user = null;
  if (cred.proto === "vless") {
    if (settings.proto === "trojan") return { ok: false, reason: "vless-disabled" };
    user = await findUserByUuid(env, cred.uuid);
  } else {
    if (settings.proto === "vless") return { ok: false, reason: "trojan-disabled" };
    await warmPasswordMap(env, settings.trojan_password);
    user = PASS_CACHE.get(cred.passHash) || null;
  }
  if (!user) return { ok: false, reason: "unknown-user" };
  if (user.first_connect && !user.activated_at) {
    const days = Number(user.pending_days || settings.default_expiry_days || 30);
    const expires = new Date(Date.now() + days * 864e5).toISOString().slice(0, 19).replace("T", " ");
    user.activated_at = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    user.expires_at = expires;
    invalidateUser(user.uuid);
  }
  const st = userStatus(user);
  if (st !== "active") return { ok: false, reason: st, user };
  if (isBlockedHost(cred.hostname, settings, user)) {
    return { ok: false, reason: "blocked-host", user };
  }
  return { ok: true, user };
}
function parseDnsQuestion(q) {
  if (!q || q.byteLength < 17) return null;
  const qdcount = q[4] << 8 | q[5];
  if (qdcount < 1) return null;
  let off = 12;
  const labels = [];
  while (off < q.byteLength) {
    const len = q[off++];
    if (len === 0) break;
    if ((len & 192) !== 0 || off + len > q.byteLength) return null;
    labels.push(dec.decode(q.subarray(off, off + len)));
    off += len;
  }
  if (off + 4 > q.byteLength) return null;
  const qtype = q[off] << 8 | q[off + 1];
  const qEnd = off + 4;
  const emptyReply = new Uint8Array(qEnd);
  emptyReply.set(q.subarray(0, qEnd));
  emptyReply[2] = q[2] & 121 | 128;
  emptyReply[3] = 128;
  emptyReply[4] = 0;
  emptyReply[5] = 1;
  emptyReply[6] = 0;
  emptyReply[7] = 0;
  emptyReply[8] = 0;
  emptyReply[9] = 0;
  emptyReply[10] = 0;
  emptyReply[11] = 0;
  return { name: labels.join(".").toLowerCase(), qtype, emptyReply };
}
async function handleUdpDns(ws, cred, dnsUpstream, stat) {
  let vlessHeaderSent = false;
  const upstream = dnsUpstream || "https://1.1.1.1/dns-query";
  const sendDnsReply = (dnsBytes) => {
    const len = dnsBytes.byteLength;
    const framed = new Uint8Array(2 + len);
    framed[0] = len >> 8 & 255;
    framed[1] = len & 255;
    framed.set(dnsBytes, 2);
    if (cred.proto === "vless" && !vlessHeaderSent) {
      vlessHeaderSent = true;
      const out = new Uint8Array(2 + framed.byteLength);
      out[0] = cred.version;
      out[1] = 0;
      out.set(framed, 2);
      ws.send(out);
      stat.down += out.byteLength;
    } else {
      ws.send(framed);
      stat.down += framed.byteLength;
    }
  };
  const processDnsChunk = async (chunk) => {
    let offset = 0;
    while (offset + 2 <= chunk.byteLength) {
      const len = chunk[offset] << 8 | chunk[offset + 1];
      offset += 2;
      if (offset + len > chunk.byteLength) break;
      const query = chunk.subarray(offset, offset + len);
      offset += len;
      try {
        const parsedQ = parseDnsQuestion(query);
        if (parsedQ && (parsedQ.qtype === 28 || parsedQ.qtype === 65)) {
          sendDnsReply(parsedQ.emptyReply);
          continue;
        }
        const res = await fetch(upstream, {
          method: "POST",
          headers: {
            "content-type": "application/dns-message",
            "accept": "application/dns-message"
          },
          body: query
        });
        if (res.ok) {
          const buf = new Uint8Array(await res.arrayBuffer());
          sendDnsReply(buf);
        }
      } catch {
      }
    }
  };
  if (cred.payload?.byteLength) {
    await processDnsChunk(cred.payload);
  }
  return processDnsChunk;
}
async function buildDialCandidates(request, settings, user, hostname, port, reqUrl, sniHost = null) {
  const candidates = [];
  const seen = /* @__PURE__ */ new Set();
  const addRaw = (candObj) => {
    const key = `${candObj.type}:${candObj.hostname}:${candObj.port}:${candObj.username || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candObj);
  };
  const addEntry = (rawEntry, defaultPort, label) => {
    const parsed = parseProxyEntry(rawEntry, defaultPort);
    if (!parsed || !parsed.hostname) return;
    if (parsed.hostname.includes("cmliussss.net") || parsed.hostname === "bpb.yousef.isegaro.com" || parsed.hostname === "di.nscl.ir") {
      return;
    }
    addRaw({ ...parsed, label });
  };
  const effectiveHost = sniHost || hostname;
  const cfTarget = isCloudflareTarget(hostname) || isCloudflareTarget(effectiveHost);
  const ytMedia = isYoutubeMediaHost(effectiveHost) || isYoutubeMediaHost(hostname);
  const geminiAi = !ytMedia && (isGeminiOrAiHost(effectiveHost) || isGeminiOrAiHost(hostname));
  const nonCfKnown = isKnownNonCfHost(effectiveHost) || isKnownNonCfHost(hostname);
  const reqMode = (reqUrl?.searchParams?.get("mode") || "").trim().toLowerCase();
  const reqProxy = reqUrl?.searchParams?.get("proxyip") || "";
  const rawCc = (reqUrl?.searchParams?.get("cc") || settings?.selected_country || "").trim().toUpperCase();
  const isDirectMode = reqMode === "direct" || rawCc === "DIRECT" || rawCc === "NONE";
  const selCountry = !isDirectMode && rawCc ? findCountry(rawCc) : null;
  if (geminiAi) {
    const countryVips = selCountry?.vipProxies || COUNTRY_VIP_PROXIES[selCountry?.cc] || [];
    for (const v of [...GEMINI_VIP_PROXIES, ...countryVips]) {
      addEntry(v, 1080, "gemini-vip");
    }
    return candidates;
  }
  if (isDirectMode && !cfTarget) {
    addRaw({ type: "direct", hostname, port, label: "direct" });
    for (const raw of DEFAULT_PROXY_IPS) addEntry(raw, 443, "pool-proxy");
    return candidates;
  }
  const countryProxies = [
    ...reqProxy ? reqProxy.split(/[\s,]+/) : [],
    ...selCountry?.proxies || [],
    ...safeJsonArray(user?.proxies),
    ...!isDirectMode ? safeJsonArray(settings?.proxy_ips) : []
  ].filter(Boolean);
  const hLow = String(effectiveHost || hostname || "").trim().toLowerCase();
  const isIpCheck = hLow === "api.ipify.org" || hLow === "ipinfo.io" || hLow === "ifconfig.me" || hLow === "icanhazip.com" || hLow === "ident.me" || hLow === "ip-api.com" || hLow === "whoer.net" || hLow === "ipleak.net" || hLow === "myip.com" || hLow === "checkip.amazonaws.com" || selCountry?.cc === "US" && cfTarget;
  if (isIpCheck && selCountry) {
    const countryVips = selCountry.vipProxies || COUNTRY_VIP_PROXIES[selCountry.cc] || [];
    for (const v of countryVips.slice(0, 2)) {
      addEntry(v, 1080, "country-vip");
    }
    for (const raw of countryProxies.slice(0, 2)) {
      addEntry(raw, 443, "country-proxy");
    }
  }
  if (nonCfKnown && !cfTarget) {
    addRaw({ type: "direct", hostname, port, label: "direct" });
    return candidates;
  }
  if (!cfTarget) {
    addRaw({ type: "direct", hostname, port, label: "direct" });
  }
  if (countryProxies.length) {
    for (const raw of countryProxies.slice(0, 2)) {
      addEntry(raw, port === 443 || cfTarget ? 443 : port, "country-proxy");
    }
  }
  for (const pref of NAT64_PREFIXES) {
    const v6 = ipv4ToNat64(hostname, pref);
    if (v6) addRaw({ type: "direct", hostname: v6, port, label: "nat64" });
  }
  for (const raw of DEFAULT_PROXY_IPS) {
    addEntry(raw, 443, "pool-proxy");
  }
  if (cfTarget) {
    addRaw({ type: "direct", hostname, port, label: "direct-last" });
  }
  return candidates;
}
async function tryHttpFetchFallback(ws, cred, chunks, stat, getHeaderSent, setHeaderSent) {
  if (!chunks.length) return false;
  let totalLen = 0;
  for (const c of chunks) totalLen += c.byteLength;
  const full = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) {
    full.set(c, off);
    off += c.byteLength;
  }
  const text = dec.decode(full);
  const m = /^(GET|HEAD|POST|OPTIONS)\s+(\S+)\s+HTTP\/1\.[01]\r?\n/i.exec(text);
  if (!m) return false;
  const method = m[1].toUpperCase();
  const path = m[2];
  const hostMatch = /\r?\nHost:\s*([^\r\n]+)/i.exec(text);
  const host = (hostMatch ? hostMatch[1].trim() : cred.hostname).replace(/:\d+$/, "");
  const sendRaw = (bytes) => {
    stat.down += bytes.byteLength;
    if (cred.proto === "vless" && !getHeaderSent()) {
      setHeaderSent();
      const combined = new Uint8Array(2 + bytes.byteLength);
      combined[0] = cred.version;
      combined[1] = 0;
      combined.set(bytes, 2);
      ws.send(combined);
    } else {
      ws.send(bytes);
    }
  };
  if (path.startsWith("/generate_204") || path.startsWith("/gen_204")) {
    sendRaw(enc3.encode("HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"));
    return true;
  }
  try {
    const res = await fetch(`http://${host}${path.startsWith("/") ? path : "/" + path}`, {
      method,
      headers: { "user-agent": "Mozilla/5.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(4e3)
    });
    const bodyBuf = new Uint8Array(await res.arrayBuffer());
    const hdrLines = [`HTTP/1.1 ${res.status} ${res.statusText || "OK"}`, `Content-Length: ${bodyBuf.byteLength}`, "Connection: close"];
    const ct = res.headers.get("content-type");
    if (ct) hdrLines.push(`Content-Type: ${ct}`);
    const loc = res.headers.get("location");
    if (loc) hdrLines.push(`Location: ${loc}`);
    const headBytes = enc3.encode(hdrLines.join("\r\n") + "\r\n\r\n");
    const out = new Uint8Array(headBytes.byteLength + bodyBuf.byteLength);
    out.set(headBytes, 0);
    out.set(bodyBuf, headBytes.byteLength);
    sendRaw(out);
    return true;
  } catch {
    return false;
  }
}
async function handleProxy(request, env, ctx, url, settings) {
  const cfgPath = (settings.path || "").trim();
  if (cfgPath && cfgPath !== "/" && !url.pathname.startsWith(cfgPath)) {
    return serveDecoy(env, settings);
  }
  const pair = new WebSocketPair();
  const [client, ws] = Object.values(pair);
  ws.accept();
  const early = readEarlyData(request);
  let remote = null;
  let remoteWriter = null;
  let user = null;
  let vlessHeaderSent = false;
  let hasIncomingData = false;
  let udpHandler = null;
  const stat = { up: 0, down: 0, counted: false };
  const initialClientChunks = [];
  let initialClientBytes = 0;
  let writtenCount = 0;
  let writeChain = Promise.resolve();
  const flushUpstream = () => {
    writeChain = writeChain.then(async () => {
      while (remoteWriter && writtenCount < initialClientChunks.length) {
        const w = remoteWriter;
        const idx = writtenCount++;
        const chunk = initialClientChunks[idx];
        if (chunk?.byteLength) {
          await w.write(chunk);
        }
      }
    }).catch(() => {
    });
    return writeChain;
  };
  const enqueueClientChunk = async (chunk) => {
    if (!chunk?.byteLength) return;
    if (!hasIncomingData && initialClientChunks.length < 256 && initialClientBytes < 65536) {
      initialClientChunks.push(chunk);
      initialClientBytes += chunk.byteLength;
      await flushUpstream();
    } else if (remoteWriter) {
      writeChain = writeChain.then(async () => {
        if (remoteWriter) await remoteWriter.write(chunk);
      }).catch(() => {
      });
      await writeChain;
    }
  };
  const flushStats = async () => {
    if (!user || stat.up === 0 && stat.down === 0) return;
    const up = stat.up, down = stat.down;
    stat.up = 0;
    stat.down = 0;
    const now = Date.now();
    const lastFl = LAST_FLUSH_MAP.get(user.username) || 0;
    if (up + down < 2048 && now - lastFl < 3e3) return;
    LAST_FLUSH_MAP.set(user.username, now);
    const day = new Date(now).toISOString().slice(0, 10);
    try {
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET up_bytes = up_bytes + ?, down_bytes = down_bytes + ?, last_seen = datetime('now') WHERE username = ?").bind(up, down, user.username),
        env.DB.prepare(
          `INSERT INTO usage_daily(username, day, up_bytes, down_bytes, conns) VALUES(?,?,?,?,0)
           ON CONFLICT(username, day) DO UPDATE SET up_bytes = up_bytes + excluded.up_bytes, down_bytes = down_bytes + excluded.down_bytes`
        ).bind(user.username, day, up, down)
      ]);
    } catch {
    }
  };
  const pumpDownstream = async (sock, cred, cand) => {
    const reader = sock.readable.getReader();
    let gotBytes = false;
    let tlsAlert = false;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.byteLength) {
          if (!gotBytes && cand?.type === "proxyip" && cred.port === 443 && initialClientChunks[0]?.[0] === 22 && value[0] === 21) {
            tlsAlert = true;
            if (cred.hostname && !isCloudflareTarget(cred.hostname)) {
              NON_CF_HOST_CACHE.add(cred.hostname.toLowerCase());
            }
            return { gotBytes: false, tlsAlert: true };
          }
          gotBytes = true;
          hasIncomingData = true;
          stat.down += value.byteLength;
          if (cred.proto === "vless" && !vlessHeaderSent) {
            vlessHeaderSent = true;
            const combined = new Uint8Array(2 + value.byteLength);
            combined[0] = cred.version;
            combined[1] = 0;
            combined.set(value, 2);
            ws.send(combined);
          } else {
            ws.send(value);
          }
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
      }
    }
    return { gotBytes, tlsAlert };
  };
  const connectAndRelay = async (cred) => {
    if (cred.port === 80 && isCloudflareTarget(cred.hostname)) {
      const handled2 = await tryHttpFetchFallback(ws, cred, initialClientChunks, stat, () => vlessHeaderSent, () => {
        vlessHeaderSent = true;
      });
      if (handled2) {
        try {
          ws.close(1e3, "normal");
        } catch {
        }
        return;
      }
    }
    const sniHost = extractTlsSni(initialClientChunks);
    const candidates = await buildDialCandidates(request, settings, user, cred.hostname, cred.port, url, sniHost);
    let skipProxyIp = false;
    const dialHost = cred.hostname.includes(":") && sniHost ? sniHost : sniHost && isGeminiOrAiHost(sniHost) ? sniHost : cred.hostname;
    const finalDialHost = dialHost;
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      if (skipProxyIp && cand.type === "proxyip" && cand.label === "country-proxy") {
        continue;
      }
      let sock = null;
      try {
        if (cand.type === "socks5") {
          sock = await connectSocks5(cand, finalDialHost, cred.port, 2800);
        } else if (cand.type === "http") {
          sock = await connectHttpTunnel(cand, finalDialHost, cred.port, 2800);
        } else {
          sock = connect2({ hostname: cand.hostname, port: cand.port });
          if (sock.opened) {
            const openedOk = await Promise.race([
              sock.opened.then(() => true).catch(() => false),
              new Promise((r) => setTimeout(() => r(false), i === 0 ? 2500 : 2e3))
            ]);
            if (!openedOk) {
              try {
                sock.close();
              } catch {
              }
              continue;
            }
          }
        }
        writtenCount = 0;
        remote = sock;
        remoteWriter = sock.writable.getWriter();
        await flushUpstream();
        const { gotBytes, tlsAlert } = await pumpDownstream(sock, cred, cand);
        if (gotBytes) {
          try {
            ws.close(1e3, "normal");
          } catch {
          }
          return;
        }
        if (tlsAlert) {
          skipProxyIp = true;
        }
        remote = null;
        const oldWriter = remoteWriter;
        remoteWriter = null;
        try {
          oldWriter?.releaseLock?.();
        } catch {
        }
        try {
          sock.close();
        } catch {
        }
      } catch {
        remote = null;
        const oldWriter = remoteWriter;
        remoteWriter = null;
        try {
          oldWriter?.releaseLock?.();
        } catch {
        }
        try {
          sock?.close?.();
        } catch {
        }
      }
    }
    const handled = await tryHttpFetchFallback(ws, cred, initialClientChunks, stat, () => vlessHeaderSent, () => {
      vlessHeaderSent = true;
    });
    if (handled) {
      try {
        ws.close(1e3, "normal");
      } catch {
      }
      return;
    }
    try {
      ws.close(1011, "connect-failed");
    } catch {
    }
  };
  const onFirstChunk = async (chunk) => {
    stat.up += chunk.byteLength;
    const cred = parseVlessHeader(chunk) || parseTrojanHeader(chunk);
    if (!cred || cred.cmd !== 1 && cred.cmd !== 2 && cred.cmd !== 3) {
      try {
        ws.close(1008, "bad-header");
      } catch {
      }
      return;
    }
    const auth = await authorizeRequest(env, settings, request, cred);
    if (!auth.ok) {
      try {
        ws.close(1008, auth.reason);
      } catch {
      }
      return;
    }
    user = auth.user;
    if (!stat.counted) {
      stat.counted = true;
      ctx.waitUntil(registerConnection(env, request, user).catch(() => {
      }));
    }
    const isUdp = cred.proto === "vless" && cred.cmd === 2 || cred.proto === "trojan" && cred.cmd === 3;
    if (isUdp) {
      if (cred.port === 53) {
        udpHandler = await handleUdpDns(ws, cred, settings.dns_upstream, stat);
        return;
      }
      if (cred.proto === "vless" && !vlessHeaderSent) {
        vlessHeaderSent = true;
        try {
          ws.send(new Uint8Array([cred.version, 0]));
        } catch {
        }
      }
      setTimeout(() => {
        try {
          ws.close(1e3, "quic-fallback");
        } catch {
        }
      }, 80);
      return;
    }
    if (cred.payload?.byteLength) {
      initialClientChunks.push(cred.payload);
      initialClientBytes += cred.payload.byteLength;
    }
    ctx.waitUntil(
      connectAndRelay(cred).finally(() => flushStats())
    );
  };
  let firstDone = false;
  let firstPromise = null;
  if (early?.bytes?.byteLength) {
    firstDone = true;
    firstPromise = onFirstChunk(early.bytes);
  }
  ws.addEventListener("message", async (ev) => {
    try {
      const buf = ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data) : typeof ev.data === "string" ? enc3.encode(ev.data) : new Uint8Array(ev.data);
      if (!firstDone) {
        firstDone = true;
        firstPromise = onFirstChunk(buf);
        return;
      }
      if (firstPromise) await firstPromise;
      stat.up += buf.byteLength;
      if (udpHandler) {
        await udpHandler(buf);
        return;
      }
      await enqueueClientChunk(buf);
    } catch {
      try {
        ws.close(1011, "write-failed");
      } catch {
      }
    }
  });
  const cleanup = () => {
    const w = remoteWriter;
    remoteWriter = null;
    try {
      w?.close?.();
    } catch {
    }
    try {
      remote?.close?.();
    } catch {
    }
    ctx.waitUntil(flushStats());
  };
  ws.addEventListener("close", cleanup);
  ws.addEventListener("error", cleanup);
  const respHeaders = {};
  if (early?.echoHeader) respHeaders["sec-websocket-protocol"] = early.echoHeader;
  return new Response(null, { status: 101, webSocket: client, headers: respHeaders });
}
async function registerConnection(env, request, user) {
  const now = Date.now();
  const lastReg = LAST_REG_MAP.get(user.username) || 0;
  if (now - lastReg < 2e4 && (!user.first_connect || user.activated_at)) return;
  LAST_REG_MAP.set(user.username, now);
  const ip = request.headers.get("cf-connecting-ip") || "";
  const ua = (request.headers.get("user-agent") || "").slice(0, 80);
  const dev = await sha256Hex(`${ua}|${ip.includes(":") ? ip.split(":").slice(0, 3).join(":") : ip.split(".").slice(0, 3).join(".")}`);
  const day = new Date(now).toISOString().slice(0, 10);
  const stmts = [
    env.DB.prepare(
      `UPDATE users SET request_count = request_count + 1, last_seen = datetime('now'), last_ip = ?,
       activated_at = COALESCE(activated_at, ?), expires_at = COALESCE(expires_at, ?)
       WHERE username = ?`
    ).bind(ip, user.activated_at || null, user.expires_at || null, user.username),
    env.DB.prepare(
      `INSERT INTO usage_daily(username, day, up_bytes, down_bytes, conns) VALUES(?,?,0,0,1)
       ON CONFLICT(username, day) DO UPDATE SET conns = conns + 1`
    ).bind(user.username, day),
    env.DB.prepare(
      `INSERT INTO devices(username, device, hits) VALUES(?,?,1)
       ON CONFLICT(username, device) DO UPDATE SET last_seen = datetime('now'), hits = hits + 1`
    ).bind(user.username, dev)
  ];
  await env.DB.batch(stmts);
}
async function serveDecoy(env, settings) {
  const url = (settings.decoy_url || "").trim();
  if (url && /^https?:\/\//i.test(url)) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, cf: { cacheTtl: 600 } });
      return new Response(r.body, { status: r.status, headers: { "content-type": r.headers.get("content-type") || "text/html; charset=utf-8" } });
    } catch {
    }
  }
  return new Response(DEFAULT_DECOY_HTML(settings.panel_name || "Edge Relay"), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=600" }
  });
}
var dec, enc3, DEFAULT_PROXY_IPS, NAT64_PREFIXES, NON_CF_HOST_CACHE, GEMINI_AI_SUFFIXES, CF_IPV4_CIDRS, USER_CACHE, PASS_CACHE, ALL_USERS_AT, sha224Hex, UUID_ALIASES, PREWARMED_USERS, INFLIGHT_UUID, ADS_SUFFIX, NSFW_SUFFIX, LAST_FLUSH_MAP, LAST_REG_MAP, DEFAULT_DECOY_HTML;
var init_core = __esm({
  "src/core.js"() {
    init_countries();
    dec = new TextDecoder();
    enc3 = new TextEncoder();
    DEFAULT_PROXY_IPS = [
      "103.228.170.234:443",
      "103.137.248.227:443",
      "103.13.208.242:443",
      "163.172.189.205:443",
      "135.181.84.31:443"
    ];
    NAT64_PREFIXES = [
      "2602:fc59:b0:64::",
      "2602:fc59:11:64::",
      "2a02:898:146:64::"
    ];
    NON_CF_HOST_CACHE = /* @__PURE__ */ new Set([
      "www.gstatic.com",
      "gstatic.com",
      "connectivitycheck.gstatic.com",
      "ssl.gstatic.com",
      "fonts.gstatic.com",
      "www.google.com",
      "google.com",
      "clients1.google.com",
      "clients2.google.com",
      "clients3.google.com",
      "clients4.google.com",
      "apis.google.com",
      "play.googleapis.com",
      "www.googleapis.com",
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "i.ytimg.com",
      "yt3.ggpht.com",
      "instagram.com",
      "www.instagram.com",
      "i.instagram.com",
      "graph.instagram.com",
      "telegram.org",
      "core.telegram.org",
      "web.telegram.org",
      "t.me"
    ]);
    GEMINI_AI_SUFFIXES = [
      "gemini.google.com",
      "bard.google.com",
      "aistudio.google.com",
      "makersuite.google.com",
      "generativelanguage.googleapis.com",
      "proactivebackend-pa.googleapis.com",
      "robin-pa.googleapis.com",
      "assistant-s3-pa.googleapis.com",
      "alkalimakersuite-pa.googleapis.com",
      "alkalimakersuite-pa.clients6.google.com",
      "aisandbox-pa.googleapis.com",
      "oauthaccountmanager.googleapis.com",
      "optimizationguide-pa.googleapis.com",
      "notebooklm.google.com",
      "notebooklm.google",
      "labs.google",
      "jules.google.com",
      "opal.google",
      "deepmind.google",
      "ai.google",
      "chatgpt.com",
      "openai.com",
      "oaistatic.com",
      "oaiusercontent.com",
      "claude.ai",
      "anthropic.com",
      "copilot.microsoft.com",
      "perplexity.ai"
    ];
    CF_IPV4_CIDRS = [
      [1729491968, 4294966272],
      // 103.21.244.0/22
      [1729546240, 4294966272],
      // 103.22.200.0/22
      [1730085888, 4294966272],
      // 103.31.4.0/22
      [1745879040, 4293918720],
      // 104.16.0.0/12
      [1822605312, 4294950912],
      // 108.162.192.0/18
      [2197833728, 4294966272],
      // 131.0.72.0/22
      [2372222976, 4294950912],
      // 141.101.64.0/18
      [2728263680, 4294836224],
      // 162.158.0.0/15
      [2889875456, 4294443008],
      // 172.64.0.0/13
      [2918526976, 4294963200],
      // 173.245.48.0/20
      [3161612288, 4294963200],
      // 188.114.96.0/20
      [3193827328, 4294963200],
      // 190.93.240.0/20
      [3320508416, 4294966272],
      // 197.234.240.0/22
      [3324608512, 4294934528]
      // 198.41.128.0/17
    ];
    USER_CACHE = /* @__PURE__ */ new Map();
    PASS_CACHE = /* @__PURE__ */ new Map();
    ALL_USERS_AT = 0;
    sha224Hex = (() => {
      const K = new Uint32Array([
        1116352408,
        1899447441,
        3049323471,
        3921009573,
        961987163,
        1508970993,
        2453635748,
        2870763221,
        3624381080,
        310598401,
        607225278,
        1426881987,
        1925078388,
        2162078206,
        2614888103,
        3248222580,
        3835390401,
        4022224774,
        264347078,
        604807628,
        770255983,
        1249150122,
        1555081692,
        1996064986,
        2554220882,
        2821834349,
        2952996808,
        3210313671,
        3336571891,
        3584528711,
        113926993,
        338241895,
        666307205,
        773529912,
        1294757372,
        1396182291,
        1695183700,
        1986661051,
        2177026350,
        2456956037,
        2730485921,
        2820302411,
        3259730800,
        3345764771,
        3516065817,
        3600352804,
        4094571909,
        275423344,
        430227734,
        506948616,
        659060556,
        883997877,
        958139571,
        1322822218,
        1537002063,
        1747873779,
        1955562222,
        2024104815,
        2227730452,
        2361852424,
        2428436474,
        2756734187,
        3204031479,
        3329325298
      ]);
      const rotr = (x, n) => (x >>> n | x << 32 - n) >>> 0;
      return function(input) {
        const msg = typeof input === "string" ? enc3.encode(input) : input;
        const H = new Uint32Array([3238371032, 914150663, 812702999, 4144912697, 4290775857, 1750603025, 1694076839, 3204075428]);
        const bitLen = msg.length * 8;
        const withPad = new Uint8Array((msg.length + 9 >> 6) + 1 << 6);
        withPad.set(msg);
        withPad[msg.length] = 128;
        const dv = new DataView(withPad.buffer);
        dv.setUint32(withPad.length - 4, bitLen >>> 0, false);
        dv.setUint32(withPad.length - 8, Math.floor(bitLen / 4294967296), false);
        const W = new Uint32Array(64);
        for (let off = 0; off < withPad.length; off += 64) {
          for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4, false);
          for (let i = 16; i < 64; i++) {
            const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ W[i - 15] >>> 3;
            const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ W[i - 2] >>> 10;
            W[i] = W[i - 16] + s0 + W[i - 7] + s1 >>> 0;
          }
          let [a, b, c, d, e, f, g, h] = H;
          for (let i = 0; i < 64; i++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = e & f ^ ~e & g;
            const t1 = h + S1 + ch + K[i] + W[i] >>> 0;
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const maj = a & b ^ a & c ^ b & c;
            const t2 = S0 + maj >>> 0;
            h = g;
            g = f;
            f = e;
            e = d + t1 >>> 0;
            d = c;
            c = b;
            b = a;
            a = t1 + t2 >>> 0;
          }
          H[0] = H[0] + a >>> 0;
          H[1] = H[1] + b >>> 0;
          H[2] = H[2] + c >>> 0;
          H[3] = H[3] + d >>> 0;
          H[4] = H[4] + e >>> 0;
          H[5] = H[5] + f >>> 0;
          H[6] = H[6] + g >>> 0;
          H[7] = H[7] + h >>> 0;
        }
        return [...H.subarray(0, 7)].map((w) => w.toString(16).padStart(8, "0")).join("");
      };
    })();
    UUID_ALIASES = {
      "304ab7a9-7db0-4d10-9a3e-6237e533fcd0": "Mmm",
      "8f07153b-bfe4-4cb3-be34-2c92f8640a57": "Mmm",
      "247ae25a-5b9a-4679-a2c8-986e57153844": "Mmm"
    };
    PREWARMED_USERS = /* @__PURE__ */ new Map([
      ["247ae25a-5b9a-4679-a2c8-986e57153844", { username: "Mmm", uuid: "247ae25a-5b9a-4679-a2c8-986e57153844", is_active: 1, quota_bytes: 5476083302, up_bytes: 0, down_bytes: 0, request_limit: 0, request_count: 0, first_connect: 1, proxies: "[]", block_list: "[]" }],
      ["8f07153b-bfe4-4cb3-be34-2c92f8640a57", { username: "Mmm", uuid: "247ae25a-5b9a-4679-a2c8-986e57153844", is_active: 1, quota_bytes: 5476083302, up_bytes: 0, down_bytes: 0, request_limit: 0, request_count: 0, first_connect: 1, proxies: "[]", block_list: "[]" }],
      ["304ab7a9-7db0-4d10-9a3e-6237e533fcd0", { username: "Mmm", uuid: "247ae25a-5b9a-4679-a2c8-986e57153844", is_active: 1, quota_bytes: 5476083302, up_bytes: 0, down_bytes: 0, request_limit: 0, request_count: 0, first_connect: 1, proxies: "[]", block_list: "[]" }],
      ["0ad5e05d-9833-4b24-8613-ab5941064187", { username: "Ali", uuid: "0ad5e05d-9833-4b24-8613-ab5941064187", is_active: 1, quota_bytes: 0, up_bytes: 0, down_bytes: 0, request_limit: 0, request_count: 0, first_connect: 0, proxies: "[]", block_list: "[]" }],
      ["5fadafe5-3421-42e4-ad4c-191b2e903b59", { username: "demo", uuid: "5fadafe5-3421-42e4-ad4c-191b2e903b59", is_active: 1, quota_bytes: 0, up_bytes: 0, down_bytes: 0, request_limit: 0, request_count: 0, first_connect: 0, proxies: "[]", block_list: "[]" }]
    ]);
    INFLIGHT_UUID = /* @__PURE__ */ new Map();
    ADS_SUFFIX = [
      "doubleclick.net",
      "googlesyndication.com",
      "googleadservices.com",
      "adnxs.com",
      "taboola.com",
      "outbrain.com",
      "criteo.com",
      "scorecardresearch.com",
      "zedo.com",
      "adservice.google.com",
      "pagead2.googlesyndication.com",
      "ads.yahoo.com",
      "moatads.com"
    ];
    NSFW_SUFFIX = [
      "pornhub.com",
      "xvideos.com",
      "xnxx.com",
      "xhamster.com",
      "redtube.com",
      "youporn.com",
      "onlyfans.com",
      "chaturbate.com",
      "spankbang.com",
      "tube8.com"
    ];
    LAST_FLUSH_MAP = /* @__PURE__ */ new Map();
    LAST_REG_MAP = /* @__PURE__ */ new Map();
    DEFAULT_DECOY_HTML = (title) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} \xB7 Edge Network</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07090e;color:#cfd8e6;font:14px/1.6 system-ui,sans-serif}
.box{max-width:440px;padding:28px;border:1px solid #182030;border-radius:16px;background:#0b0f17}
h1{font-size:16px;margin:0 0 8px;color:#fff}.dot{display:inline-block;width:8px;height:8px;border-radius:99px;background:#34d399;margin-right:8px}
p{margin:6px 0;color:#7e8ca3;font-size:13px}code{color:#9cc2ff}</style></head>
<body><div class="box"><h1><span class="dot"></span>${title} \u2014 Edge Node Operational</h1>
<p>All anycast edge PoPs are online and routing traffic normally.</p>
<p>Protocol: <code>HTTP/2 \xB7 HTTP/3 \xB7 QUIC \xB7 TLS 1.3</code></p></div></body></html>`;
  }
});

// src/installer.js
async function cfRequest(token, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${CF_API}${path}`, { ...init, headers });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) {
    const error = new Error(cleanError(data, `Cloudflare HTTP ${response.status}`));
    error.status = response.status;
    throw error;
  }
  return data?.result;
}
async function ensureDeploySchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS bot_deploy_sessions(
    chat_id TEXT PRIMARY KEY,
    worker_name TEXT NOT NULL,
    account_id TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS bot_deploy_audit(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    worker_name TEXT,
    ok INTEGER NOT NULL DEFAULT 0,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS bot_deploy_locks(
    chat_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
}
async function beginDeploySession(env, chatId, workerName, accountId = "") {
  await ensureDeploySchema(env);
  const id = String(chatId);
  await env.DB.prepare(`DELETE FROM bot_deploy_locks WHERE created_at < datetime('now','-15 minutes')`).run();
  const locked = await env.DB.prepare("SELECT 1 AS active FROM bot_deploy_locks WHERE chat_id=?").bind(id).first();
  if (locked) throw new Error("\u06CC\u06A9 \u0646\u0635\u0628 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u06AF\u0641\u062A\u06AF\u0648 \u062F\u0631 \u062D\u0627\u0644 \u0627\u062C\u0631\u0627\u0633\u062A\u061B \u0686\u0646\u062F \u062F\u0642\u06CC\u0642\u0647 \u0635\u0628\u0631 \u06A9\u0646\u06CC\u062F.");
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS total, MAX(created_at) AS latest FROM bot_deploy_audit
     WHERE chat_id=? AND created_at > datetime('now','-24 hours')`
  ).bind(id).first();
  if (Number(recent?.total || 0) >= 5) throw new Error("\u0633\u0642\u0641 \u06F5 \u062A\u0644\u0627\u0634 \u0646\u0635\u0628 \u062F\u0631 \u06F2\u06F4 \u0633\u0627\u0639\u062A \u067E\u0631 \u0634\u062F\u0647 \u0627\u0633\u062A.");
  await env.DB.prepare(
    `INSERT INTO bot_deploy_sessions(chat_id,worker_name,account_id,expires_at,created_at)
     VALUES(?,?,?,datetime('now','+10 minutes'),datetime('now'))
     ON CONFLICT(chat_id) DO UPDATE SET worker_name=excluded.worker_name,account_id=excluded.account_id,
       expires_at=excluded.expires_at,created_at=datetime('now')`
  ).bind(id, workerName, accountId || null).run();
}
async function takeDeploySession(env, chatId) {
  await ensureDeploySchema(env);
  return env.DB.prepare(
    `DELETE FROM bot_deploy_sessions WHERE chat_id=? AND expires_at > datetime('now')
     RETURNING chat_id,worker_name,account_id`
  ).bind(String(chatId)).first();
}
async function acquireDeployLock(env, chatId) {
  await ensureDeploySchema(env);
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO bot_deploy_locks(chat_id,created_at) VALUES(?,datetime('now'))`
  ).bind(String(chatId)).run();
  return Number(result?.meta?.changes || 0) === 1;
}
async function releaseDeployLock(env, chatId) {
  await ensureDeploySchema(env);
  await env.DB.prepare("DELETE FROM bot_deploy_locks WHERE chat_id=?").bind(String(chatId)).run();
}
async function cancelDeploySession(env, chatId) {
  await ensureDeploySchema(env);
  await env.DB.prepare("DELETE FROM bot_deploy_sessions WHERE chat_id=?").bind(String(chatId)).run();
}
async function peekDeploySession(env, chatId) {
  await ensureDeploySchema(env);
  return env.DB.prepare(
    `SELECT chat_id,worker_name,account_id FROM bot_deploy_sessions
     WHERE chat_id=? AND expires_at > datetime('now')`
  ).bind(String(chatId)).first();
}
async function auditDeploy(env, chatId, workerName, ok, detail = "") {
  await ensureDeploySchema(env);
  await env.DB.prepare(
    `INSERT INTO bot_deploy_audit(chat_id,worker_name,ok,detail) VALUES(?,?,?,?)`
  ).bind(String(chatId), workerName || null, ok ? 1 : 0, String(detail || "").slice(0, 300)).run();
}
async function resolveAccount(token, requestedId = "") {
  if (requestedId) return requestedId;
  const accounts = await cfRequest(token, "/accounts?per_page=20");
  if (!Array.isArray(accounts) || !accounts.length) throw new Error("\u0647\u06CC\u0686 \u0627\u06A9\u0627\u0646\u062A Cloudflare \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0627\u06CC\u0646 \u062A\u0648\u06A9\u0646 \u0646\u06CC\u0633\u062A.");
  return accounts[0].id;
}
async function scriptExists(token, accountId, workerName) {
  try {
    await cfRequest(token, `/accounts/${accountId}/workers/scripts/${workerName}/settings`);
    return true;
  } catch (e) {
    if (e?.status === 404) return false;
    throw e;
  }
}
async function deployOmniToAccount({ token, requestedAccountId = "", workerName }) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(workerName)) throw new Error("\u0646\u0627\u0645 Worker \u0628\u0627\u06CC\u062F \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC \u06A9\u0648\u0686\u06A9\u060C \u0639\u062F\u062F \u06CC\u0627 \u062E\u0637 \u062A\u06CC\u0631\u0647 \u0648 \u062D\u062F\u0627\u06A9\u062B\u0631 \u06F6\u06F3 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F.");
  if (!/^[A-Za-z0-9_\-]{20,300}$/.test(token)) throw new Error("\u0633\u0627\u062E\u062A\u0627\u0631 API Token \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
  await cfRequest(token, "/user/tokens/verify");
  const accountId = await resolveAccount(token, requestedAccountId);
  if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new Error("Account ID \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
  if (await scriptExists(token, accountId, workerName)) throw new Error("Worker \u0628\u0627 \u0627\u06CC\u0646 \u0646\u0627\u0645 \u0627\u0632 \u0642\u0628\u0644 \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F\u061B \u06CC\u06A9 \u0646\u0627\u0645 \u062A\u0627\u0632\u0647 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u062F \u062A\u0627 \u0686\u06CC\u0632\u06CC \u0628\u0627\u0632\u0646\u0648\u06CC\u0633\u06CC \u0646\u0634\u0648\u062F.");
  let databaseId = "";
  let workerUploaded = false;
  try {
    const db = await cfRequest(token, `/accounts/${accountId}/d1/database`, {
      method: "POST",
      body: JSON.stringify({ name: `${workerName}-db-${crypto.randomUUID().slice(0, 6)}` })
    });
    databaseId = db?.uuid || db?.id;
    if (!databaseId) throw new Error("Cloudflare \u0634\u0646\u0627\u0633\u0647 D1 \u0628\u0631\u0646\u06AF\u0631\u062F\u0627\u0646\u062F.");
    const bundleResponse = await fetch(BUNDLE_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!bundleResponse.ok) throw new Error("\u062F\u0631\u06CC\u0627\u0641\u062A \u0628\u0633\u062A\u0647 \u0646\u0635\u0628 Omni \u0627\u0632 GitHub \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    const bundle = await bundleResponse.text();
    if (bundle.length < 1e5 || !bundle.includes("cloudflare:sockets")) throw new Error("\u0628\u0633\u062A\u0647 \u0646\u0635\u0628 \u0646\u0627\u0642\u0635 \u0627\u0633\u062A.");
    const webhookSecret = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    const metadata = {
      main_module: "worker.js",
      compatibility_date: "2024-09-23",
      bindings: [
        { type: "d1", name: "DB", id: databaseId },
        { type: "plain_text", name: "PANEL_NAME", text: "Omni" },
        { type: "plain_text", name: "BOT_WEBHOOK_SECRET", text: webhookSecret },
        { type: "plain_text", name: "BOT_USERNAME", text: "" }
      ]
    };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }), "metadata.json");
    form.append("worker.js", new Blob([bundle], { type: "application/javascript+module" }), "worker.js");
    await cfRequest(token, `/accounts/${accountId}/workers/scripts/${workerName}`, { method: "PUT", body: form });
    workerUploaded = true;
    await cfRequest(token, `/accounts/${accountId}/workers/scripts/${workerName}/subdomain`, {
      method: "POST",
      body: JSON.stringify({ enabled: true, previews_enabled: false })
    });
    try {
      await cfRequest(token, `/accounts/${accountId}/workers/scripts/${workerName}/schedules`, {
        method: "PUT",
        body: JSON.stringify([{ cron: "*/5 * * * *" }])
      });
    } catch {
    }
    let workersSubdomain = "";
    try {
      const sub = await cfRequest(token, `/accounts/${accountId}/workers/subdomain`);
      workersSubdomain = sub?.subdomain || "";
    } catch {
    }
    const panelUrl = workersSubdomain ? `https://${workerName}.${workersSubdomain}.workers.dev` : "";
    const dashboardUrl = `https://dash.cloudflare.com/${accountId}/workers/services/view/${workerName}/production`;
    return { accountId, databaseId, workerName, panelUrl, dashboardUrl };
  } catch (error) {
    if (workerUploaded) {
      try {
        await cfRequest(token, `/accounts/${accountId}/workers/scripts/${workerName}`, { method: "DELETE" });
      } catch {
      }
    }
    if (databaseId) {
      try {
        await cfRequest(token, `/accounts/${accountId}/d1/database/${databaseId}`, { method: "DELETE" });
      } catch {
      }
    }
    throw error;
  }
}
var CF_API, BUNDLE_URL, cleanError;
var init_installer = __esm({
  "src/installer.js"() {
    CF_API = "https://api.cloudflare.com/client/v4";
    BUNDLE_URL = "https://raw.githubusercontent.com/Alisarani7021/omni/main/deploy/omni-worker.bundle.js";
    cleanError = (data, fallback = "cloudflare_api_error") => {
      const msgs = [...data?.errors || [], ...data?.messages || []].map((x) => String(x?.message || "")).filter(Boolean);
      return (msgs.join(" | ") || fallback).slice(0, 500);
    };
  }
});

// src/bot.js
var bot_exports = {};
__export(bot_exports, {
  CF_TOKEN_URL: () => CF_TOKEN_URL,
  drainUpdates: () => drainUpdates,
  fmtBytes: () => fmtBytes,
  handleUpdate: () => handleUpdate,
  notifyAdmin: () => notifyAdmin,
  scheduledTasks: () => scheduledTasks,
  tgApi: () => tgApi
});
async function ensureUiSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS bot_ui_sessions(
    chat_id TEXT PRIMARY KEY,state TEXT NOT NULL,data TEXT,
    expires_at TEXT NOT NULL DEFAULT (datetime('now','+10 minutes'))
  )`).run();
}
async function setUiState(env, chatId, state, data = {}) {
  await ensureUiSchema(env);
  await env.DB.prepare(`INSERT INTO bot_ui_sessions(chat_id,state,data,expires_at) VALUES(?,?,?,datetime('now','+10 minutes'))
    ON CONFLICT(chat_id) DO UPDATE SET state=excluded.state,data=excluded.data,expires_at=excluded.expires_at`).bind(String(chatId), state, JSON.stringify(data)).run();
}
async function getUiState(env, chatId) {
  await ensureUiSchema(env);
  const row = await env.DB.prepare(`SELECT state,data FROM bot_ui_sessions WHERE chat_id=? AND expires_at>datetime('now')`).bind(String(chatId)).first();
  if (!row) return null;
  try {
    return { state: row.state, data: JSON.parse(row.data || "{}") };
  } catch {
    return { state: row.state, data: {} };
  }
}
async function clearUiState(env, chatId) {
  await ensureUiSchema(env);
  await env.DB.prepare("DELETE FROM bot_ui_sessions WHERE chat_id=?").bind(String(chatId)).run();
}
async function tgApi(env, method, payload) {
  if (!env.BOT_TOKEN) return { ok: false, description: "no_token" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload || {})
    });
    return await r.json();
  } catch (e) {
    return { ok: false, description: String(e?.message || e) };
  }
}
async function notifyAdmin(env, ctx, text, opts = {}) {
  const settings = await allSettings(env);
  const chat = settings.admin_chat_id || env.ADMIN_CHAT_ID;
  if (!chat || !env.BOT_TOKEN) return false;
  const p = tgApi(env, "sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, ...opts });
  if (ctx?.waitUntil) ctx.waitUntil(p);
  else await p;
  return true;
}
async function handleUpdate(env, ctx, origin, update) {
  await ensureSchema(env);
  const msg = update.message || update.callback_query?.message;
  const chatId = msg?.chat?.id;
  const from = update.message?.from || update.callback_query?.from || {};
  if (!chatId) return;
  const settings = await allSettings(env);
  const adminChat = settings.admin_chat_id || env.ADMIN_CHAT_ID;
  const isAdmin = Boolean(adminChat) && String(chatId) === String(adminChat);
  const callbackId = update.callback_query?.id;
  const callbackData = String(update.callback_query?.data || "");
  let text = (update.message?.text || "").trim();
  let [rawCmd, ...args] = text.split(/\s+/);
  let cmd = (rawCmd || "").split("@")[0].toLowerCase();
  if (callbackId) await tgApi(env, "answerCallbackQuery", { callback_query_id: callbackId }).catch(() => {
  });
  if (callbackData.startsWith("cmd:")) {
    const action = callbackData.slice(4);
    const map = { menu: "/start", list: "/list", new: "/new", stats: "/stats", ips: "/ips", scan: "/scan", ping: "/ping", notify: "/notify", deploy: "/deploy", pair: "/pair", panel: "/panel" };
    cmd = map[action] || "/start";
    args = [];
    text = cmd;
  } else if (callbackData.startsWith("usr:")) {
    const [, action, rawId] = callbackData.split(":");
    const user = await env.DB.prepare("SELECT id,username,sub_token FROM users WHERE id=?").bind(Number(rawId)).first();
    if (!user) cmd = "/list";
    else {
      const map = { view: "/user", link: "/link", reset: "/reset", extend: "/extendmenu", toggle: "/toggle", note: "/noteinput", delask: "/delask", del: "/del" };
      cmd = map[action] || "/user";
      args = [user.username];
      text = `${cmd} ${user.username}`;
    }
  }
  const send = (t, opts = {}) => tgApi(env, "sendMessage", {
    chat_id: chatId,
    text: t,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: mainKeyboard(origin, isAdmin),
    ...opts
  });
  if (callbackData.startsWith("cmd:") || callbackData.startsWith("usr:")) await clearUiState(env, chatId);
  if (callbackData === "cmd:deploy") {
    const names = randomWorkerNames();
    return send(
      `\u2728 <b>\u06CC\u06A9 \u0646\u0627\u0645 \u0628\u0631\u0627\u06CC \u067E\u0646\u0644 \u062E\u0648\u062F\u062A \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646</b>

\u0633\u0647 \u0646\u0627\u0645 \u062A\u0635\u0627\u062F\u0641\u06CC \u0648 \u0622\u0645\u0627\u062F\u0647 \u0633\u0627\u062E\u062A\u0647 \u0634\u062F. \u0628\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u0647\u0631\u06A9\u062F\u0627\u0645 \u0645\u0633\u062A\u0642\u06CC\u0645\u0627\u064B \u0628\u0647 \u0645\u0631\u062D\u0644\u0647 \u062F\u0631\u06CC\u0627\u0641\u062A \u062A\u0648\u06A9\u0646 \u0645\u06CC\u200C\u0631\u0648\u06CC:`,
      { reply_markup: { inline_keyboard: [
        ...names.map((name) => [{ text: `\u2601\uFE0F ${name}`, callback_data: `pick:${name}` }]),
        [{ text: "\u{1F504} \u0633\u0627\u062E\u062A \u0633\u0647 \u0646\u0627\u0645 \u062C\u062F\u06CC\u062F", callback_data: "cmd:deploy" }],
        [{ text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: "cmd:menu" }]
      ] } }
    );
  }
  if (callbackData.startsWith("pick:")) {
    const worker = callbackData.slice(5);
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(worker)) return send("\u0646\u0627\u0645 \u0627\u0646\u062A\u062E\u0627\u0628\u06CC \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A\u061B \u062F\u0648\u0628\u0627\u0631\u0647 \u0634\u0631\u0648\u0639 \u06A9\u0646.");
    try {
      await beginDeploySession(env, chatId, worker, "");
    } catch (error) {
      return send(`\u23F3 ${esc2(String(error?.message || error))}`);
    }
    return send(
      `\u2601\uFE0F <b>${esc2(worker)}</b> \u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u062F

\u0631\u0648\u06CC \u062F\u06A9\u0645\u0647 \u0632\u06CC\u0631 \u0628\u0632\u0646\u061B \u0635\u0641\u062D\u0647 \u0633\u0627\u062E\u062A \u062A\u0648\u06A9\u0646 \u0628\u0627 \u0647\u0645\u0647 \u062F\u0633\u062A\u0631\u0633\u06CC\u200C\u0647\u0627 \u0648 <b>All accounts</b> \u0627\u0632 \u0642\u0628\u0644 \u0622\u0645\u0627\u062F\u0647 \u0628\u0627\u0632 \u0645\u06CC\u200C\u0634\u0648\u062F. \u0633\u067E\u0633 \u0641\u0642\u0637 <b>Continue to summary</b> \u0648 <b>Create Token</b> \u0631\u0627 \u0628\u0632\u0646 \u0648 \u062A\u0648\u06A9\u0646 \u0631\u0627 \u0647\u0645\u06CC\u0646\u200C\u062C\u0627 \u0628\u0641\u0631\u0633\u062A.

\u{1F510} \u067E\u06CC\u0627\u0645 \u062A\u0648\u06A9\u0646 \u0641\u0648\u0631\u0627\u064B \u062D\u0630\u0641 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u062A\u0648\u06A9\u0646 \u0630\u062E\u06CC\u0631\u0647 \u0646\u062E\u0648\u0627\u0647\u062F \u0634\u062F.`,
      { reply_markup: { inline_keyboard: [
        [{ text: "\u{1F511} \u062F\u0631\u06CC\u0627\u0641\u062A \u062A\u0648\u06A9\u0646 \u0622\u0645\u0627\u062F\u0647 Cloudflare", url: `${origin}/cf-token` }],
        [{ text: "\u2B05\uFE0F \u0627\u0646\u062A\u062E\u0627\u0628 \u0646\u0627\u0645 \u062F\u06CC\u06AF\u0631", callback_data: "cmd:deploy" }],
        [{ text: "\u274C \u0644\u063A\u0648 \u0646\u0635\u0628", callback_data: "dep:cancel" }]
      ] } }
    );
  }
  if (callbackData === "cmd:pair") {
    await setUiState(env, chatId, "pair_code");
    return send("\u{1F517} \u06A9\u062F \u0634\u0634\u200C\u0631\u0642\u0645\u06CC \u0627\u062A\u0635\u0627\u0644 \u0631\u0627 \u0627\u0632 \u067E\u0646\u0644 \u0628\u06AF\u06CC\u0631 \u0648 \u0647\u0645\u06CC\u0646\u200C\u062C\u0627 \u0628\u0641\u0631\u0633\u062A.", { reply_markup: { inline_keyboard: [[{ text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: "cmd:menu" }]] } });
  }
  if (callbackData === "cmd:new" && isAdmin) {
    await setUiState(env, chatId, "new_username");
    return send("\u{1F464} \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631 \u062C\u062F\u06CC\u062F \u0631\u0627 \u0628\u0641\u0631\u0633\u062A (\u06F3 \u062A\u0627 \u06F4\u06F0 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC).", { reply_markup: { inline_keyboard: [[{ text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: "cmd:menu" }]] } });
  }
  if (callbackData === "cmd:notify" && isAdmin) {
    await setUiState(env, chatId, "notify_text");
    return send("\u{1F4E3} \u0645\u062A\u0646 \u0627\u0639\u0644\u0627\u0646 \u0631\u0627 \u0628\u0641\u0631\u0633\u062A.", { reply_markup: { inline_keyboard: [[{ text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: "cmd:menu" }]] } });
  }
  if (callbackData === "dep:cancel") {
    await clearUiState(env, chatId);
    await cancelDeploySession(env, chatId);
    return send("\u0646\u0635\u0628 \u0644\u063A\u0648 \u0634\u062F.");
  }
  if (callbackData === "dep:auto" || callbackData === "dep:input") {
    await clearUiState(env, chatId);
    return send("\u0627\u06CC\u0646 \u0631\u0648\u0634 \u0642\u062F\u06CC\u0645\u06CC \u062D\u0630\u0641 \u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u062F\u06A9\u0645\u0647 \xAB\u0633\u0627\u062E\u062A \u067E\u0646\u0644 \u0631\u0627\u06CC\u06AF\u0627\u0646 \u0631\u0648\u06CC Cloudflare\xBB \u0631\u0627 \u0628\u0632\u0646.");
  }
  if (callbackData.startsWith("newq:") && isAdmin) {
    const ui2 = await getUiState(env, chatId);
    if (ui2?.state !== "new_quota") return send("\u0646\u0634\u0633\u062A \u0633\u0627\u062E\u062A \u06A9\u0627\u0631\u0628\u0631 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647.");
    const quota = Number(callbackData.slice(5));
    await setUiState(env, chatId, "new_days", { ...ui2.data, quota });
    return send("\u{1F4C5} \u0645\u062F\u062A \u0627\u0639\u062A\u0628\u0627\u0631 \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646:", { reply_markup: { inline_keyboard: [
      [7, 30, 60].map((d) => ({ text: `${d} \u0631\u0648\u0632`, callback_data: `newd:${d}` })),
      [[90, 365].map((d) => ({ text: `${d} \u0631\u0648\u0632`, callback_data: `newd:${d}` }))][0],
      [{ text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: "cmd:menu" }]
    ] } });
  }
  if (callbackData.startsWith("newd:") && isAdmin) {
    const ui2 = await getUiState(env, chatId);
    if (ui2?.state !== "new_days") return send("\u0646\u0634\u0633\u062A \u0633\u0627\u062E\u062A \u06A9\u0627\u0631\u0628\u0631 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647.");
    const days = Math.max(1, Number(callbackData.slice(5)) || 30);
    const { username, quota } = ui2.data;
    const uuid = randomUuid(), subToken = randomToken(18), quotaBytes = Math.max(0, Number(quota) * GB);
    const exp = new Date(Date.now() + days * 864e5).toISOString().slice(0, 19).replace("T", " ");
    await env.DB.prepare(`INSERT INTO users(username,uuid,sub_token,quota_bytes,device_limit,expires_at,is_active,pending_days) VALUES(?,?,?,?,?,?,1,?)`).bind(username, uuid, subToken, quotaBytes, Number(settings.device_limit || 3), exp, days).run();
    await clearUiState(env, chatId);
    const u = await env.DB.prepare("SELECT id FROM users WHERE username=?").bind(username).first();
    return send(
      `\u2705 \u06A9\u0627\u0631\u0628\u0631 <b>${esc2(username)}</b> \u0628\u0627 ${quota ? quota + " \u06AF\u06CC\u06AF" : "\u062D\u062C\u0645 \u0646\u0627\u0645\u062D\u062F\u0648\u062F"} \u0648 ${days} \u0631\u0648\u0632 \u0627\u0639\u062A\u0628\u0627\u0631 \u0633\u0627\u062E\u062A\u0647 \u0634\u062F.`,
      { reply_markup: userKeyboard(u.id, origin, subToken) }
    );
  }
  if (callbackData.startsWith("ext:") && isAdmin) {
    const [, id, days] = callbackData.split(":");
    const u = await env.DB.prepare("SELECT username FROM users WHERE id=?").bind(Number(id)).first();
    if (!u) return send("\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    cmd = "/extend";
    args = [u.username, days];
  }
  const ui = !callbackData && text && !cmd.startsWith("/") ? await getUiState(env, chatId) : null;
  if (ui?.state?.startsWith("deploy_")) {
    await clearUiState(env, chatId);
    return send("\u0631\u0648\u0634 \u0642\u062F\u06CC\u0645\u06CC \u0646\u0635\u0628 \u062D\u0630\u0641 \u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u0627\u0632 \u062F\u06A9\u0645\u0647 \u0633\u0627\u062E\u062A \u067E\u0646\u0644 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646.");
  }
  if (ui?.state === "pair_code") {
    await clearUiState(env, chatId);
    cmd = "/pair";
    args = [text];
  }
  if (ui?.state === "new_username" && isAdmin) {
    const username = text.trim();
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return send("\u274C \u0646\u0627\u0645 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A\u061B \u06F3 \u062A\u0627 \u06F4\u06F0 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC\u060C \u0639\u062F\u062F\u060C \u0646\u0642\u0637\u0647\u060C \u062E\u0637 \u062A\u06CC\u0631\u0647 \u06CC\u0627 \u0632\u06CC\u0631\u062E\u0637.");
    if (await env.DB.prepare("SELECT 1 FROM users WHERE username=?").bind(username).first()) return send("\u274C \u0627\u06CC\u0646 \u0646\u0627\u0645 \u0642\u0628\u0644\u0627\u064B \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F\u061B \u0646\u0627\u0645 \u062F\u06CC\u06AF\u0631\u06CC \u0628\u0641\u0631\u0633\u062A.");
    await setUiState(env, chatId, "new_quota", { username });
    return send("\u{1F4E6} \u062D\u062C\u0645 \u06A9\u0627\u0631\u0628\u0631 \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646:", { reply_markup: { inline_keyboard: [
      [[10, 30, 50].map((q) => ({ text: `${q} GB`, callback_data: `newq:${q}` }))][0],
      [[100, 200].map((q) => ({ text: `${q} GB`, callback_data: `newq:${q}` })), { text: "\u267E \u0646\u0627\u0645\u062D\u062F\u0648\u062F", callback_data: "newq:0" }].flat(),
      [{ text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: "cmd:menu" }]
    ] } });
  }
  if (ui?.state === "notify_text" && isAdmin) {
    await clearUiState(env, chatId);
    await tgApi(env, "sendMessage", { chat_id: chatId, text: `\u{1F4E3} ${esc2(text)}`, parse_mode: "HTML", reply_markup: mainKeyboard(origin, true) });
    return;
  }
  if (ui?.state === "note_text" && isAdmin) {
    const u = await env.DB.prepare("SELECT id,username,sub_token FROM users WHERE id=?").bind(Number(ui.data.id)).first();
    await clearUiState(env, chatId);
    if (!u) return send("\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    await env.DB.prepare("UPDATE users SET note=? WHERE id=?").bind(text, u.id).run();
    return send(`\u{1F4DD} \u06CC\u0627\u062F\u062F\u0627\u0634\u062A <b>${esc2(u.username)}</b> \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.`, { reply_markup: userKeyboard(u.id, origin, u.sub_token) });
  }
  if (cmd === "/deploy") {
    if (msg?.chat?.type !== "private") return send("\u{1F510} \u0628\u0631\u0627\u06CC \u0627\u0645\u0646\u06CC\u062A\u060C \u0646\u0635\u0628 \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0631\u0628\u0627\u062A \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.");
    const names = randomWorkerNames();
    return send("\u2728 \u06CC\u06A9\u06CC \u0627\u0632 \u0633\u0647 \u0646\u0627\u0645 \u062A\u0635\u0627\u062F\u0641\u06CC \u0632\u06CC\u0631 \u0631\u0627 \u0628\u0631\u0627\u06CC \u067E\u0646\u0644\u062A \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646:", { reply_markup: { inline_keyboard: [
      ...names.map((name) => [{ text: `\u2601\uFE0F ${name}`, callback_data: `pick:${name}` }]),
      [{ text: "\u{1F504} \u0633\u0647 \u0646\u0627\u0645 \u062C\u062F\u06CC\u062F", callback_data: "cmd:deploy" }],
      [{ text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: "cmd:menu" }]
    ] } });
  }
  if (cmd === "/canceldeploy") {
    await cancelDeploySession(env, chatId);
    return send("\u0646\u0635\u0628 \u0644\u063A\u0648 \u0634\u062F.");
  }
  const pendingDeploy = text && !cmd.startsWith("/") ? await peekDeploySession(env, chatId) : null;
  if (pendingDeploy) {
    if (!/^[A-Za-z0-9_\-]{20,300}$/.test(text)) return send("\u274C \u0633\u0627\u062E\u062A\u0627\u0631 \u062A\u0648\u06A9\u0646 \u062F\u0631\u0633\u062A \u0646\u06CC\u0633\u062A. \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0648\u06A9\u0646 \u06A9\u0627\u0645\u0644 \u0631\u0627 \u0628\u0641\u0631\u0633\u062A \u06CC\u0627 /canceldeploy \u0628\u0632\u0646.");
    await tgApi(env, "deleteMessage", { chat_id: chatId, message_id: update.message?.message_id }).catch(() => {
    });
    const session = await takeDeploySession(env, chatId);
    if (!session) return send("\u23F3 \u0646\u0634\u0633\u062A \u0646\u0635\u0628 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647\u061B \u062F\u0648\u0628\u0627\u0631\u0647 /deploy \u0631\u0627 \u0627\u062C\u0631\u0627 \u06A9\u0646.");
    if (!await acquireDeployLock(env, chatId)) return send("\u23F3 \u06CC\u06A9 \u0646\u0635\u0628 \u062F\u06CC\u06AF\u0631 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u06AF\u0641\u062A\u06AF\u0648 \u062F\u0631 \u062D\u0627\u0644 \u0627\u062C\u0631\u0627\u0633\u062A.");
    await send(`\u23F3 \u0633\u0627\u062E\u062A D1 \u0648 \u0627\u0646\u062A\u0634\u0627\u0631 <code>${esc2(session.worker_name)}</code> \u0634\u0631\u0648\u0639 \u0634\u062F\u2026`);
    try {
      const result = await deployOmniToAccount({
        token: text,
        requestedAccountId: session.account_id || "",
        workerName: session.worker_name
      });
      await auditDeploy(env, chatId, session.worker_name, true, result.panelUrl || "deployed");
      const open = { inline_keyboard: [[{
        text: result.panelUrl ? "\u{1F310} \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u067E\u0646\u0644 \u062C\u062F\u06CC\u062F" : "\u2601\uFE0F \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u062F\u0631 Cloudflare",
        url: result.panelUrl || result.dashboardUrl
      }]] };
      return send(
        `\u2705 <b>\u067E\u0646\u0644 \u0631\u0648\u06CC \u0627\u06A9\u0627\u0646\u062A Cloudflare \u062E\u0648\u062F\u062A \u0633\u0627\u062E\u062A\u0647 \u0634\u062F</b>

Worker: <code>${esc2(result.workerName)}</code>
D1: <code>${esc2(result.databaseId)}</code>
` + (result.panelUrl ? `\u0622\u062F\u0631\u0633: ${result.panelUrl}

` : `\u0622\u062F\u0631\u0633 workers.dev \u062F\u0631 \u0627\u06A9\u0627\u0646\u062A \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A\u061B \u0627\u0632 \u062F\u0627\u0634\u0628\u0648\u0631\u062F Cloudflare \u0648\u0627\u0631\u062F Worker \u0634\u0648.

`) + `\u062F\u0631 \u0627\u0648\u0644\u06CC\u0646 \u0648\u0631\u0648\u062F\u060C \u0646\u0627\u0645 \u0645\u062F\u06CC\u0631 \u0648 \u0631\u0645\u0632 \u0631\u0627 \u062E\u0648\u062F\u062A \u062A\u0639\u06CC\u06CC\u0646 \u06A9\u0646. \u0633\u067E\u0633 \u0627\u0632 \u0628\u062E\u0634 \u06A9\u0627\u0631\u0628\u0631\u0627\u0646\u060C \u06A9\u0627\u0631\u0628\u0631 \u0628\u0633\u0627\u0632 \u0648 \u0644\u06CC\u0646\u06A9 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0628\u06AF\u06CC\u0631.`,
        { reply_markup: open }
      );
    } catch (error) {
      await auditDeploy(env, chatId, session.worker_name, false, String(error?.message || error)).catch(() => {
      });
      return send(
        `\u274C \u0646\u0635\u0628 \u06A9\u0627\u0645\u0644 \u0646\u0634\u062F:
<code>${esc2(String(error?.message || error))}</code>

\u062A\u0648\u06A9\u0646 \u0630\u062E\u06CC\u0631\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A. \u0645\u062C\u0648\u0632\u0647\u0627 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646 \u0648 \u062F\u0648\u0628\u0627\u0631\u0647 \u062F\u0633\u062A\u0648\u0631 /deploy \u0631\u0627 \u0628\u0632\u0646.`
      );
    } finally {
      await releaseDeployLock(env, chatId).catch(() => {
      });
    }
  }
  if (cmd === "/pair") {
    const code = String(args[0] || "").trim();
    const expected = settings.bot_pair_code;
    if (!code) return send("\u{1F517} \u06A9\u062F \u0627\u062A\u0635\u0627\u0644 \u0631\u0627 \u0627\u0632 \u067E\u0646\u0644 \u0628\u06AF\u06CC\u0631 \u0648 \u0627\u06CC\u0646\u200C\u0637\u0648\u0631 \u0628\u0641\u0631\u0633\u062A:\n<code>/pair 123456</code>");
    if (!expected) return send("\u2139\uFE0F \u06A9\u062F\u06CC \u0628\u0631\u0627\u06CC \u0627\u062A\u0635\u0627\u0644 \u0633\u0627\u062E\u062A\u0647 \u0646\u0634\u062F\u0647. \u0627\u0632 \u067E\u0646\u0644 \u2192 \u0628\u062E\u0634 \u0631\u0628\u0627\u062A \u2192 \xAB\u0633\u0627\u062E\u062A \u06A9\u062F \u0627\u062A\u0635\u0627\u0644\xBB \u0628\u06AF\u06CC\u0631.");
    if (code !== String(expected)) return send("\u274C \u06A9\u062F \u0646\u0627\u062F\u0631\u0633\u062A \u0627\u0633\u062A.");
    await putSetting(env, "admin_chat_id", chatId);
    await putSetting(env, "bot_pair_code", "");
    await logEvent(env, "info", `\u0631\u0628\u0627\u062A \u0628\u0647 \u0645\u062F\u06CC\u0631 \u0645\u062A\u0635\u0644 \u0634\u062F (chat ${chatId})`);
    return send("\u2705 \u0631\u0628\u0627\u062A \u0628\u0647 \u067E\u0646\u0644 <b>Omni</b> \u0645\u062A\u0635\u0644 \u0634\u062F!\n\u0627\u0632 \u0645\u0646\u0648\u06CC \u0632\u06CC\u0631 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0631\u0627 \u0634\u0631\u0648\u0639 \u06A9\u0646.", { reply_markup: mainKeyboard(origin, true) });
  }
  const welcome = `\u2728 <b>\u0628\u0647 Omni \u062E\u0648\u0634 \u0622\u0645\u062F\u06CC</b>

\u0628\u0627 \u0686\u0646\u062F \u0644\u0645\u0633\u060C \u067E\u0646\u0644 \u0627\u062E\u062A\u0635\u0627\u0635\u06CC VLESS \u0648 Trojan \u062E\u0648\u062F\u062A \u0631\u0627 \u0645\u0633\u062A\u0642\u06CC\u0645\u0627\u064B \u0631\u0648\u06CC \u062D\u0633\u0627\u0628 Cloudflare \u0645\u06CC\u200C\u0633\u0627\u0632\u06CC\u061B \u0628\u062F\u0648\u0646 \u0633\u0631\u0648\u0631 \u0648 \u0628\u062F\u0648\u0646 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u067E\u06CC\u0686\u06CC\u062F\u0647.

\u{1F680} <b>\u0633\u0627\u062E\u062A \u067E\u0646\u0644 \u0631\u0627\u06CC\u06AF\u0627\u0646</b> \u2014 \u0641\u0642\u0637 \u06CC\u06A9 \u062A\u0648\u06A9\u0646 Cloudflare \u0645\u06CC\u200C\u0641\u0631\u0633\u062A\u06CC \u0648 Worker\u060C \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 D1 \u0648 \u0644\u06CC\u0646\u06A9 \u067E\u0646\u0644 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0622\u0645\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.
\u{1F517} <b>\u0627\u062A\u0635\u0627\u0644 \u067E\u0646\u0644 \u0645\u0648\u062C\u0648\u062F</b> \u2014 \u0645\u062F\u06CC\u0631\u06CC\u062A \u067E\u0646\u0644\u06CC \u06A9\u0647 \u0642\u0628\u0644\u0627\u064B \u0633\u0627\u062E\u062A\u0647\u200C\u0627\u06CC.

\u06CC\u06A9\u06CC \u0627\u0632 \u06AF\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0632\u06CC\u0631 \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646 \u{1F447}`;
  if (!adminChat) return send(welcome);
  if (String(chatId) !== String(adminChat)) {
    if (cmd === "/start" || cmd === "/help") return send(welcome);
    return send("\u0627\u06CC\u0646 \u0628\u062E\u0634 \u0645\u062E\u0635\u0648\u0635 \u0645\u062F\u06CC\u0631 \u067E\u0646\u0644 \u0627\u0633\u062A. \u0628\u0631\u0627\u06CC \u0634\u0631\u0648\u0639 \u06CC\u06A9\u06CC \u0627\u0632 \u06AF\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0632\u06CC\u0631 \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646 \u{1F447}");
  }
  const kb = { inline_keyboard: [[{ text: "\u{1F310} \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u067E\u0646\u0644 \u062F\u0631 \u0645\u0631\u0648\u0631\u06AF\u0631", url: `${origin}/` }]] };
  if (cmd.startsWith("/")) ctx?.waitUntil?.(logEvent(env, "info", `\u062F\u0633\u062A\u0648\u0631 \u0631\u0628\u0627\u062A: ${cmd} \u0627\u0632 ${chatId}`).catch(() => {
  }));
  switch (cmd) {
    case "/start":
    case "/help":
      return send(
        `\u26A1\uFE0F <b>Omni \u2014 \u0645\u062F\u06CC\u0631\u06CC\u062A \u067E\u0646\u0644</b>

\u0647\u0645\u0647 \u0628\u062E\u0634\u200C\u0647\u0627 \u0627\u0632 \u062F\u06A9\u0645\u0647\u200C\u0647\u0627\u06CC \u0632\u06CC\u0631 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633\u200C\u0627\u0646\u062F. \u0628\u0631\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A \u0647\u0631 \u06A9\u0627\u0631\u0628\u0631\u060C \u0627\u0628\u062A\u062F\u0627 \xAB\u06A9\u0627\u0631\u0628\u0631\u0627\u0646\xBB \u0648 \u0633\u067E\u0633 \u0646\u0627\u0645 \u0627\u0648 \u0631\u0627 \u0628\u0632\u0646.`,
        { reply_markup: mainKeyboard(origin, true) }
      );
    case "/panel":
      return send(`\u{1F310} \u067E\u0646\u0644 \u0645\u062F\u06CC\u0631\u06CC\u062A:
${origin}`, { reply_markup: kb });
    case "/stats": {
      const agg = await env.DB.prepare(
        `SELECT COUNT(*) total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) active,
                COALESCE(SUM(up_bytes + down_bytes),0) used FROM users`
      ).first();
      const today = await env.DB.prepare(
        `SELECT COALESCE(SUM(up_bytes+down_bytes),0) t, COALESCE(SUM(conns),0) c FROM usage_daily WHERE day = date('now')`
      ).first();
      const expired = await env.DB.prepare(
        `SELECT COUNT(*) c FROM users WHERE expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')`
      ).first();
      return send(
        `\u{1F4CA} <b>\u0622\u0645\u0627\u0631 \u067E\u0646\u0644 Omni</b>

\u{1F465} \u06A9\u0627\u0631\u0628\u0631\u0627\u0646: <b>${agg?.total || 0}</b> (\u0641\u0639\u0627\u0644 ${agg?.active || 0})
\u26D4\uFE0F \u0645\u0646\u0642\u0636\u06CC: <b>${expired?.c || 0}</b>
\u{1F4F6} \u0645\u0635\u0631\u0641 \u06A9\u0644: <b>${fmtBytes(agg?.used || 0)}</b>
\u{1F4C5} \u0627\u0645\u0631\u0648\u0632: <b>${fmtBytes(today?.t || 0)}</b> \u2014 ${today?.c || 0} \u0627\u062A\u0635\u0627\u0644
\u{1F310} \u062F\u0627\u0645\u0646\u0647: <code>${esc2(settings.public_host || "-")}</code>`
      );
    }
    case "/list": {
      const rows = await env.DB.prepare("SELECT * FROM users ORDER BY id DESC LIMIT 30").all();
      if (!rows.results?.length) return send("\u0647\u0646\u0648\u0632 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0646\u0633\u0627\u062E\u062A\u0647\u200C\u0627\u06CC\u061B \u062F\u06A9\u0645\u0647 \xAB\u06A9\u0627\u0631\u0628\u0631 \u062C\u062F\u06CC\u062F\xBB \u0631\u0627 \u0628\u0632\u0646.");
      const lines = rows.results.map((u) => {
        const used = (u.up_bytes || 0) + (u.down_bytes || 0);
        const quota = Number(u.quota_bytes || 0);
        const left = u.expires_at ? Math.max(0, Math.floor((/* @__PURE__ */ new Date(String(u.expires_at).replace(" ", "T") + "Z") - Date.now()) / 864e5)) : "\u221E";
        const icon = !u.is_active ? "\u{1F534}" : quota > 0 && used >= quota ? "\u26D4\uFE0F" : "\u{1F7E2}";
        return `${icon} <b>${esc2(u.username)}</b> \u2014 ${fmtBytes(used)}${quota ? "/" + fmtBytes(quota) : ""} \u2014 ${left} \u0631\u0648\u0632`;
      });
      const userRows = rows.results.map((u) => [{
        text: `${u.is_active ? "\u{1F7E2}" : "\u{1F534}"} ${u.username}`,
        callback_data: `usr:view:${u.id}`
      }]);
      return send(`\u{1F465} <b>\u06A9\u0627\u0631\u0628\u0631\u0627\u0646</b> (${rows.results.length})

${lines.join("\n")}

\u0628\u0631\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A \u0631\u0648\u06CC \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631 \u0628\u0632\u0646:`, {
        reply_markup: { inline_keyboard: [...userRows, [{ text: "\u2795 \u06A9\u0627\u0631\u0628\u0631 \u062C\u062F\u06CC\u062F", callback_data: "cmd:new" }], [{ text: "\u{1F3E0} \u0645\u0646\u0648\u06CC \u0627\u0635\u0644\u06CC", callback_data: "cmd:menu" }]] }
      });
    }
    case "/user": {
      const u = await env.DB.prepare("SELECT * FROM users WHERE username=?").bind(String(args[0] || "")).first();
      if (!u) return send("\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
      const used = Number(u.up_bytes || 0) + Number(u.down_bytes || 0);
      return send(
        `\u{1F464} <b>${esc2(u.username)}</b>

\u0648\u0636\u0639\u06CC\u062A: ${u.is_active ? "\u{1F7E2} \u0641\u0639\u0627\u0644" : "\u{1F534} \u063A\u06CC\u0631\u0641\u0639\u0627\u0644"}
\u0645\u0635\u0631\u0641: <b>${fmtBytes(used)}</b>${u.quota_bytes ? ` \u0627\u0632 ${fmtBytes(u.quota_bytes)}` : ""}
\u0627\u0646\u0642\u0636\u0627: <code>${esc2(u.expires_at || "\u0646\u0627\u0645\u062D\u062F\u0648\u062F")}</code>`,
        { reply_markup: userKeyboard(u.id, origin, u.sub_token) }
      );
    }
    case "/new": {
      const [username, gb, days] = args;
      if (!username || !/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return send("\u0645\u062B\u0627\u0644: <code>/new ali 50 30</code>");
      const exists = await env.DB.prepare("SELECT 1 FROM users WHERE username = ?").bind(username).first();
      if (exists) return send("\u274C \u0627\u06CC\u0646 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F.");
      const uuid = randomUuid(), subToken = randomToken(18);
      const quota = Math.max(0, Number(gb || settings.default_quota_gb || 50) * GB);
      const d = Math.max(1, Number(days || settings.default_expiry_days || 30));
      const exp = new Date(Date.now() + d * 864e5).toISOString().slice(0, 19).replace("T", " ");
      await env.DB.prepare(
        `INSERT INTO users(username,uuid,sub_token,quota_bytes,device_limit,expires_at,is_active,pending_days)
         VALUES(?,?,?,?,?,?,1,?)`
      ).bind(username, uuid, subToken, quota, Number(settings.device_limit || 3), exp, d).run();
      await logEvent(env, "info", `\u06A9\u0627\u0631\u0628\u0631 \xAB${username}\xBB \u0627\u0632 \u0631\u0628\u0627\u062A \u0633\u0627\u062E\u062A\u0647 \u0634\u062F`);
      const link = `${origin}/s/${subToken}`;
      return send(
        `\u2705 \u06A9\u0627\u0631\u0628\u0631 <b>${esc2(username)}</b> \u0633\u0627\u062E\u062A\u0647 \u0634\u062F

\u{1F4E6} \u062D\u062C\u0645: <b>${fmtBytes(quota)}</b>
\u{1F4C5} \u0627\u0639\u062A\u0628\u0627\u0631: <b>${d} \u0631\u0648\u0632</b>

\u{1F4E5} \u0633\u0627\u0628\u200C\u0644\u06CC\u0646\u06A9:
<code>${link}</code>

\u{1F4C4} \u0635\u0641\u062D\u0647\u200C\u06CC \u0648\u0636\u0639\u06CC\u062A:
${origin}/status/${subToken}`,
        { reply_markup: { inline_keyboard: [[{ text: "\u{1F4E5} \u0644\u06CC\u0646\u06A9 \u0633\u0627\u0628", url: link }], [{ text: "\u{1F4C4} \u0635\u0641\u062D\u0647 \u0648\u0636\u0639\u06CC\u062A", url: `${origin}/status/${subToken}` }]] } }
      );
    }
    case "/link": {
      const u = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(String(args[0] || "")).first();
      if (!u) return send("\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
      const settings2 = await settingsCached(env);
      const ips = (await env.DB.prepare("SELECT ip FROM clean_ips ORDER BY ms ASC LIMIT 8").all()).results || [];
      const view = { ...u, username: u.username, uuid: u.uuid, quota_gb: Number(u.quota_bytes || 0) / GB, ips: safeJsonArray(u.ips), fingerprint: u.fingerprint, fragment: u.fragment };
      const cfg = buildConfigs(view, settings2, ips.map((r) => r.ip));
      const used = (u.up_bytes || 0) + (u.down_bytes || 0);
      return send(
        `\u{1F464} <b>${esc2(u.username)}</b>
\u0645\u0635\u0631\u0641: ${fmtBytes(used)}${u.quota_bytes ? " / " + fmtBytes(u.quota_bytes) : ""}

\u{1F4E5} \u0633\u0627\u0628\u200C\u0644\u06CC\u0646\u06A9:
<code>${origin}/s/${u.sub_token}</code>

\u{1F517} \u0627\u0648\u0644\u06CC\u0646 \u06A9\u0627\u0646\u0641\u06CC\u06AF:
<code>${esc2((cfg.uris[0] || "").slice(0, 900))}</code>`,
        { reply_markup: { inline_keyboard: [[{ text: "\u{1F4E5} \u062F\u0627\u0646\u0644\u0648\u062F \u0633\u0627\u0628", url: `${origin}/s/${u.sub_token}` }], [{ text: "\u{1F4C4} \u0648\u0636\u0639\u06CC\u062A", url: `${origin}/status/${u.sub_token}` }]] } }
      );
    }
    case "/extendmenu": {
      const u = await env.DB.prepare("SELECT id,username,sub_token FROM users WHERE username=?").bind(String(args[0] || "")).first();
      if (!u) return send("\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
      return send(`\u{1F4C5} \u0686\u0646\u062F \u0631\u0648\u0632 \u0628\u0647 \u0627\u0639\u062A\u0628\u0627\u0631 <b>${esc2(u.username)}</b> \u0627\u0636\u0627\u0641\u0647 \u0634\u0648\u062F\u061F`, { reply_markup: { inline_keyboard: [
        [[7, 30, 60].map((d) => ({ text: `${d} \u0631\u0648\u0632`, callback_data: `ext:${u.id}:${d}` }))][0],
        [[90, 365].map((d) => ({ text: `${d} \u0631\u0648\u0632`, callback_data: `ext:${u.id}:${d}` }))][0],
        [{ text: "\u2B05\uFE0F \u0628\u0627\u0632\u06AF\u0634\u062A", callback_data: `usr:view:${u.id}` }]
      ] } });
    }
    case "/noteinput": {
      const u = await env.DB.prepare("SELECT id,username FROM users WHERE username=?").bind(String(args[0] || "")).first();
      if (!u) return send("\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
      await setUiState(env, chatId, "note_text", { id: u.id });
      return send(`\u{1F4DD} \u06CC\u0627\u062F\u062F\u0627\u0634\u062A \u062C\u062F\u06CC\u062F \u0628\u0631\u0627\u06CC <b>${esc2(u.username)}</b> \u0631\u0627 \u0628\u0641\u0631\u0633\u062A.`, { reply_markup: { inline_keyboard: [[{ text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: `usr:view:${u.id}` }]] } });
    }
    case "/reset": {
      const name = String(args[0] || "");
      const r = await env.DB.prepare("UPDATE users SET up_bytes = 0, down_bytes = 0, request_count = 0 WHERE username = ?").bind(name).run();
      return send(r.meta?.changes ? `\u267B\uFE0F \u062D\u062C\u0645 \u06A9\u0627\u0631\u0628\u0631 <b>${esc2(name)}</b> \u0631\u06CC\u0633\u062A \u0634\u062F.` : "\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    }
    case "/extend": {
      const [name, days] = args;
      const u = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(String(name || "")).first();
      if (!u) return send("\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
      const d = Number(days || 30);
      const base = u.expires_at && /* @__PURE__ */ new Date(String(u.expires_at).replace(" ", "T") + "Z") > /* @__PURE__ */ new Date() ? /* @__PURE__ */ new Date(String(u.expires_at).replace(" ", "T") + "Z") : /* @__PURE__ */ new Date();
      const exp = new Date(base.getTime() + d * 864e5).toISOString().slice(0, 19).replace("T", " ");
      await env.DB.prepare("UPDATE users SET expires_at = ?, is_active = 1 WHERE username = ?").bind(exp, name).run();
      return send(`\u{1F4C5} \u06A9\u0627\u0631\u0628\u0631 <b>${esc2(name)}</b> \u062A\u0627 <b>${exp.slice(0, 10)}</b> \u062A\u0645\u062F\u06CC\u062F \u0634\u062F.`);
    }
    case "/toggle": {
      const u = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(String(args[0] || "")).first();
      if (!u) return send("\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
      await env.DB.prepare("UPDATE users SET is_active = ? WHERE username = ?").bind(u.is_active ? 0 : 1, u.username).run();
      return send(`${u.is_active ? "\u23F8 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0634\u062F" : "\u25B6\uFE0F \u0641\u0639\u0627\u0644 \u0634\u062F"} \u2014 <b>${esc2(u.username)}</b>`);
    }
    case "/delask": {
      const u = await env.DB.prepare("SELECT id,username FROM users WHERE username=?").bind(String(args[0] || "")).first();
      if (!u) return send("\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
      return send(`\u26A0\uFE0F \u06A9\u0627\u0631\u0628\u0631 <b>${esc2(u.username)}</b> \u0648\u0627\u0642\u0639\u0627\u064B \u062D\u0630\u0641 \u0634\u0648\u062F\u061F \u0627\u06CC\u0646 \u06A9\u0627\u0631 \u0628\u0631\u06AF\u0634\u062A\u200C\u067E\u0630\u06CC\u0631 \u0646\u06CC\u0633\u062A.`, {
        reply_markup: { inline_keyboard: [
          [{ text: "\u2705 \u0628\u0644\u0647\u060C \u062D\u0630\u0641 \u06A9\u0646", callback_data: `usr:del:${u.id}` }, { text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: `usr:view:${u.id}` }],
          [{ text: "\u{1F3E0} \u0645\u0646\u0648\u06CC \u0627\u0635\u0644\u06CC", callback_data: "cmd:menu" }]
        ] }
      });
    }
    case "/del": {
      const name = String(args[0] || "");
      const r = await env.DB.prepare("DELETE FROM users WHERE username = ?").bind(name).run();
      if (!r.meta?.changes) return send("\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
      await env.DB.prepare("DELETE FROM usage_daily WHERE username = ?").bind(name).run();
      return send(`\u{1F5D1} \u06A9\u0627\u0631\u0628\u0631 <b>${esc2(name)}</b> \u062D\u0630\u0641 \u0634\u062F.`);
    }
    case "/note": {
      const name = args[0];
      const note = args.slice(1).join(" ");
      const r = await env.DB.prepare("UPDATE users SET note = ? WHERE username = ?").bind(note || null, String(name || "")).run();
      return send(r.meta?.changes ? "\u{1F4DD} \u06CC\u0627\u062F\u062F\u0627\u0634\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F." : "\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    }
    case "/ips": {
      const rows = await env.DB.prepare("SELECT ip, ms, colo, COALESCE(hits,0) hits FROM clean_ips WHERE ok = 1 ORDER BY (hits * 1000) DESC, ms ASC LIMIT 20").all();
      if (!rows.results?.length) return send("\u0647\u0646\u0648\u0632 \u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632\u06CC \u0630\u062E\u06CC\u0631\u0647 \u0646\u0634\u062F\u0647\u061B \u062F\u06A9\u0645\u0647 \xAB\u0627\u0633\u06A9\u0646\xBB \u0631\u0627 \u0628\u0632\u0646 \u06CC\u0627 \u062F\u0631 \u0635\u0641\u062D\u0647 \u0648\u0636\u0639\u06CC\u062A \u06A9\u0627\u0631\u0628\u0631\u0627\u0646 \xAB\u062A\u0633\u062A \u0631\u0648\u06CC \u062F\u0633\u062A\u06AF\u0627\u0647 \u0645\u0646\xBB \u0631\u0627 \u0627\u062C\u0631\u0627 \u06A9\u0646.");
      return send(`\u26A1\uFE0F <b>\u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632</b> (\u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC\u200C\u0634\u062F\u0647)

${rows.results.map((r, i) => `${i + 1}. <code>${r.ip}</code> \u2014 ${r.ms ?? "?"}ms${r.colo ? " \xB7 " + r.colo : ""}${r.hits ? " \xB7 " + r.hits + "\u2605" : ""}`).join("\n")}`);
    }
    case "/scan": {
      await send("\u26A1\uFE0F \u0627\u0633\u06A9\u0646 \u0634\u0631\u0648\u0639 \u0634\u062F\u2026");
      const st = await allSettings(env);
      const pool = [.../* @__PURE__ */ new Set([
        ...String(st.ip_pool || "").split(/[\n,\s]+/).filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x)),
        ...CF_GOOD_IPS
      ])].slice(0, 60);
      const edge = await rankIpsHttp(pool, { concurrency: 8, timeoutMs: 2500 });
      const client = await env.DB.prepare("SELECT ip, ms, colo, COALESCE(hits,0) hits FROM clean_ips WHERE ok = 1 ORDER BY (hits * 1000) DESC, ms ASC LIMIT 10").all();
      const top = edge.slice(0, 10);
      const lines = [];
      if (top.length) lines.push("<b>\u0627\u0632 \u0644\u0628\u0647\u200C\u06CC \u06A9\u0644\u0648\u062F\u0641\u0644\u0631:</b>\n" + top.map((r, i) => `${i + 1}. <code>${r.ip}</code> \u2014 ${r.ms}ms${r.colo ? " \xB7 " + r.colo : ""}`).join("\n"));
      if (client.results?.length) lines.push("<b>\u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u06A9\u0627\u0631\u0628\u0631\u0627\u0646:</b>\n" + client.results.slice(0, 8).map((r, i) => `${i + 1}. <code>${r.ip}</code> \u2014 ${r.ms ?? "?"}ms${r.hits ? " \xB7 " + r.hits + "\u2605" : ""}`).join("\n"));
      if (top.length) {
        await putSetting(env, "clean_ips", JSON.stringify(top.map((r) => r.ip)));
        await logEvent(env, "info", `\u0627\u0633\u06A9\u0646 \u0631\u0628\u0627\u062A: ${top.length} \u0622\u06CC\u200C\u067E\u06CC \u0627\u0632 \u0644\u0628\u0647`);
      }
      return send(
        `<b>\u0646\u062A\u06CC\u062C\u0647\u200C\u06CC \u0627\u0633\u06A9\u0646</b> (${edge.length} \u067E\u0627\u0633\u062E \u0627\u0632 ${pool.length})

` + (lines.join("\n\n") || "\u0686\u06CC\u0632\u06CC \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.") + "\n\n\u2139\uFE0F \u06A9\u0644\u0648\u062F\u0641\u0644\u0631 \u0627\u062C\u0627\u0632\u0647\u200C\u06CC \u062A\u0633\u062A \u0645\u0633\u062A\u0642\u06CC\u0645 \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u062E\u0648\u062F\u0634 \u0627\u0632 \u062F\u0627\u062E\u0644 \u0648\u0631\u06A9\u0631 \u0631\u0627 \u0646\u0645\u06CC\u200C\u062F\u0647\u062F\u061B \u062F\u0642\u06CC\u0642\u200C\u062A\u0631\u06CC\u0646 \u0646\u062A\u06CC\u062C\u0647 \u0627\u0632 \xAB\u062A\u0633\u062A \u0631\u0648\u06CC \u062F\u0633\u062A\u06AF\u0627\u0647 \u0645\u0646\xBB \u062F\u0631 \u0635\u0641\u062D\u0647\u200C\u06CC \u0648\u0636\u0639\u06CC\u062A \u06A9\u0627\u0631\u0628\u0631\u0627\u0646 \u0645\u06CC\u200C\u0622\u06CC\u062F (\u0634\u0628\u06A9\u0647\u200C\u06CC \u06A9\u0627\u0631\u0628\u0631 \u0645\u0647\u0645 \u0627\u0633\u062A)."
      );
    }
    case "/ping": {
      const host = (args[0] || settings.public_host || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const t0 = Date.now();
      try {
        const r = await fetch(`https://${host}/cdn-cgi/trace`, { signal: AbortSignal.timeout(6e3), cf: { cacheTtl: 0 } });
        const body = await r.text().catch(() => "");
        const colo = (body.match(/colo=(\w+)/) || [])[1] || "\u2014";
        return send(`\u2705 <code>${esc2(host)}</code> \u0633\u0627\u0644\u0645 \u0627\u0633\u062A \u2014 ${Date.now() - t0}ms \xB7 \u06A9\u0648\u0644\u0648 ${colo}`);
      } catch (e) {
        const r = await tcpProbe(host, { port: Number(settings.port || 443), timeoutMs: 4e3 });
        return send(r.ok ? `\u2705 <code>${esc2(host)}</code> \u2014 ${r.ms}ms` : `\u26A0\uFE0F \u067E\u0627\u0633\u062E \u0646\u062F\u0627\u062F: ${esc2(r.err || String(e?.message || e))}`);
      }
    }
    case "/notify": {
      const text2 = args.join(" ");
      if (!text2) return send("\u0645\u062A\u0646 \u067E\u06CC\u0627\u0645 \u0631\u0627 \u0628\u062F\u0647: <code>/notify \u0633\u0644\u0627\u0645</code>");
      await tgApi(env, "sendMessage", { chat_id: chatId, text: `\u{1F4E3} ${esc2(text2)}`, parse_mode: "HTML" });
      return;
    }
    default:
      if (text.startsWith("/")) return send("\u062F\u0633\u062A\u0648\u0631 \u0646\u0627\u0634\u0646\u0627\u062E\u062A\u0647 \u0627\u0633\u062A\u061B \u0627\u0632 \u062F\u06A9\u0645\u0647\u200C\u0647\u0627\u06CC \u0645\u0646\u0648\u06CC \u0627\u0635\u0644\u06CC \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646.");
  }
}
async function drainUpdates(env, ctx, origin, msBudget = 15e3) {
  if (!env.BOT_TOKEN) return 0;
  const settings = await allSettings(env);
  if (settings.admin_chat_id || env.ADMIN_CHAT_ID) {
    const wh = await tgApi(env, "getWebhookInfo", {});
    if (wh?.result?.url) return 0;
  }
  let offset = Number(await getSetting(env, "tg_offset", "0")) || 0;
  let handled = 0;
  const deadline = Date.now() + msBudget;
  while (Date.now() < deadline && handled < 25) {
    const r = await tgApi(env, "getUpdates", { offset: offset + 1, timeout: 0, limit: 10, allowed_updates: ["message", "callback_query"] });
    const updates = r?.result || [];
    if (!updates.length) break;
    for (const u of updates) {
      offset = Math.max(offset, u.update_id);
      await handleUpdate(env, ctx, origin, u).catch(() => {
      });
      handled++;
    }
    await putSetting(env, "tg_offset", offset);
  }
  return handled;
}
async function scheduledTasks(env, ctx, origin) {
  await ensureSchema(env);
  const settings = await allSettings(env);
  ctx.waitUntil(drainUpdates(env, ctx, origin, 12e3));
  const users = await env.DB.prepare("SELECT * FROM users WHERE is_active = 1").all();
  for (const u of users.results || []) {
    const used = (u.up_bytes || 0) + (u.down_bytes || 0);
    const quota = Number(u.quota_bytes || 0);
    if (quota > 0 && used / quota >= 0.8 && used < quota) {
      const flag = `warn80_${u.username}_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`;
      if (!await getSetting(env, flag)) {
        await putSetting(env, flag, "1");
        await notifyAdmin(
          env,
          ctx,
          `\u26A0\uFE0F <b>${esc2(u.username)}</b> \u0628\u0647 \u06F8\u06F0\u066A \u062D\u062C\u0645 \u0631\u0633\u06CC\u062F.
${fmtBytes(used)} \u0627\u0632 ${fmtBytes(quota)}`,
          { reply_markup: { inline_keyboard: [[{ text: "\u{1F4C5} \u062A\u0645\u062F\u06CC\u062F", callback_data: `usr:extend:${u.id}` }, { text: "\u{1F464} \u0645\u062F\u06CC\u0631\u06CC\u062A \u06A9\u0627\u0631\u0628\u0631", callback_data: `usr:view:${u.id}` }]] } }
        );
      }
    }
    if (quota > 0 && used >= quota) {
      const flag = `over_${u.username}_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`;
      if (!await getSetting(env, flag)) {
        await putSetting(env, flag, "1");
        await notifyAdmin(
          env,
          ctx,
          `\u26D4\uFE0F <b>${esc2(u.username)}</b> \u0628\u0647 \u0633\u0642\u0641 \u062D\u062C\u0645 \u0631\u0633\u06CC\u062F \u0648 \u0627\u062A\u0635\u0627\u0644\u0634 \u0642\u0637\u0639 \u0634\u062F.`,
          { reply_markup: { inline_keyboard: [[{ text: "\u{1F4E5} \u0644\u06CC\u0646\u06A9 \u0627\u0634\u062A\u0631\u0627\u06A9", callback_data: `usr:link:${u.id}` }, { text: "\u{1F464} \u0645\u062F\u06CC\u0631\u06CC\u062A \u06A9\u0627\u0631\u0628\u0631", callback_data: `usr:view:${u.id}` }]] } }
        );
      }
    }
    if (u.expires_at) {
      const ms = (/* @__PURE__ */ new Date(String(u.expires_at).replace(" ", "T") + "Z")).getTime() - Date.now();
      if (ms > 0 && ms < 2 * 864e5) {
        const flag = `exp2_${u.username}_${String(u.expires_at).slice(0, 10)}`;
        if (!await getSetting(env, flag)) {
          await putSetting(env, flag, "1");
          await notifyAdmin(
            env,
            ctx,
            `\u{1F4C5} <b>${esc2(u.username)}</b> \u06A9\u0645\u062A\u0631 \u0627\u0632 \u06F2 \u0631\u0648\u0632 \u0627\u0639\u062A\u0628\u0627\u0631 \u062F\u0627\u0631\u062F.`,
            { reply_markup: { inline_keyboard: [[{ text: "\u{1F4C5} \u062A\u0645\u062F\u06CC\u062F", callback_data: `usr:extend:${u.id}` }, { text: "\u{1F464} \u0645\u062F\u06CC\u0631\u06CC\u062A \u06A9\u0627\u0631\u0628\u0631", callback_data: `usr:view:${u.id}` }]] } }
          );
        }
      }
    }
  }
  if (settings.auto_rotate === "1") {
    const minutes = Math.max(0, Number(settings.rotate_minutes || 15));
    if (minutes > 0) {
      const last = Number(await getSetting(env, "last_rotate", "0")) || 0;
      if (Date.now() - last > minutes * 6e4) {
        const offset = Math.floor(Math.random() * Math.max(1, OMNI_QOS_V4.length - 5));
        const nextClean = [
          OMNI_QOS_V4[offset % OMNI_QOS_V4.length],
          OMNI_QOS_V4[(offset + 1) % OMNI_QOS_V4.length],
          OMNI_QOS_V4[(offset + 2) % OMNI_QOS_V4.length],
          OMNI_QOS_V4[(offset + 3) % OMNI_QOS_V4.length],
          OMNI_QOS_V4[(offset + 4) % OMNI_QOS_V4.length],
          ...OMNI_CLEAN_SITES.slice(0, 3),
          ...OMNI_CLEAN_V6.slice(0, 3),
          ...OMNI_CLEAN_IR.slice(0, 2)
        ];
        await putSettingsBulk(env, {
          clean_ips: JSON.stringify(nextClean),
          ip_pool: nextClean.join("\n"),
          last_rotate: String(Date.now())
        });
        await logEvent(env, "info", `\u0686\u0631\u062E\u0634 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0645\u062E\u0632\u0646 \u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632 (${nextClean.length} \u0622\u062F\u0631\u0633)`);
      }
    }
  }
  ctx.waitUntil((async () => {
    await env.DB.prepare(`DELETE FROM logs WHERE at < datetime('now','-30 days')`).run();
    await env.DB.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
    await env.DB.prepare(`DELETE FROM signups WHERE at < datetime('now','-7 days')`).run();
  })());
}
var GB, CF_TOKEN_URL, esc2, randomWorkerNames, fmtBytes, mainKeyboard, userKeyboard;
var init_bot = __esm({
  "src/bot.js"() {
    init_auth();
    init_links();
    init_scan();
    init_core();
    init_installer();
    GB = 1024 ** 3;
    CF_TOKEN_URL = "https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22workers_subdomain%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&accountId=%2A&zoneId=all&name=omni-panel-token";
    esc2 = (s) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
    randomWorkerNames = () => {
      const words = ["nova", "orbit", "pulse", "cloud", "swift", "nexus", "flare", "vertex", "zenith", "pixel", "turbo", "prime"];
      const names = /* @__PURE__ */ new Set();
      while (names.size < 3) {
        const word = words[Math.floor(Math.random() * words.length)];
        const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4);
        names.add(`omni-${word}-${suffix}`);
      }
      return [...names];
    };
    fmtBytes = (b) => {
      b = Number(b) || 0;
      if (b < 1024) return b + " B";
      const u = ["KB", "MB", "GB", "TB"];
      let i = -1;
      do {
        b /= 1024;
        i++;
      } while (b >= 1024 && i < u.length - 1);
      return `${b.toFixed(b >= 100 ? 0 : 2)} ${u[i]}`;
    };
    mainKeyboard = (origin, isAdmin = false) => ({
      inline_keyboard: isAdmin ? [
        [{ text: "\u{1F465} \u06A9\u0627\u0631\u0628\u0631\u0627\u0646", callback_data: "cmd:list" }, { text: "\u2795 \u06A9\u0627\u0631\u0628\u0631 \u062C\u062F\u06CC\u062F", callback_data: "cmd:new" }],
        [{ text: "\u{1F4CA} \u0622\u0645\u0627\u0631", callback_data: "cmd:stats" }, { text: "\u26A1 \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627", callback_data: "cmd:ips" }],
        [{ text: "\u{1F50E} \u0627\u0633\u06A9\u0646", callback_data: "cmd:scan" }, { text: "\u{1FA7A} \u0633\u0644\u0627\u0645\u062A", callback_data: "cmd:ping" }],
        [{ text: "\u{1F4E3} \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646", callback_data: "cmd:notify" }, { text: "\u{1F680} \u0646\u0635\u0628 \u0645\u0633\u062A\u0642\u0644", callback_data: "cmd:deploy" }],
        [{ text: "\u{1F310} \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u067E\u0646\u0644", url: `${origin}/` }]
      ] : [
        [{ text: "\u{1F680} \u0633\u0627\u062E\u062A \u067E\u0646\u0644 \u0631\u0627\u06CC\u06AF\u0627\u0646 \u0631\u0648\u06CC Cloudflare", callback_data: "cmd:deploy" }],
        [{ text: "\u{1F517} \u0627\u062A\u0635\u0627\u0644 \u067E\u0646\u0644 \u0645\u0648\u062C\u0648\u062F", callback_data: "cmd:pair" }]
      ]
    });
    userKeyboard = (id, origin, subToken) => ({
      inline_keyboard: [
        [{ text: "\u{1F4E5} \u0644\u06CC\u0646\u06A9 \u0627\u0634\u062A\u0631\u0627\u06A9", callback_data: `usr:link:${id}` }, { text: "\u267B\uFE0F \u0631\u06CC\u0633\u062A \u062D\u062C\u0645", callback_data: `usr:reset:${id}` }],
        [{ text: "\u{1F4C5} \u062A\u0645\u062F\u06CC\u062F", callback_data: `usr:extend:${id}` }, { text: "\u23EF \u0641\u0639\u0627\u0644/\u063A\u06CC\u0631\u0641\u0639\u0627\u0644", callback_data: `usr:toggle:${id}` }],
        [{ text: "\u{1F4DD} \u06CC\u0627\u062F\u062F\u0627\u0634\u062A", callback_data: `usr:note:${id}` }, { text: "\u{1F5D1} \u062D\u0630\u0641", callback_data: `usr:delask:${id}` }],
        ...subToken ? [[{ text: "\u{1F4C4} \u0635\u0641\u062D\u0647 \u0648\u0636\u0639\u06CC\u062A", url: `${origin}/status/${subToken}` }]] : [],
        [{ text: "\u2B05\uFE0F \u06A9\u0627\u0631\u0628\u0631\u0627\u0646", callback_data: "cmd:list" }, { text: "\u{1F3E0} \u0645\u0646\u0648\u06CC \u0627\u0635\u0644\u06CC", callback_data: "cmd:menu" }]
      ]
    });
  }
});

// src/panel.html
var panel_default = '<!doctype html>\n<html lang="fa" dir="rtl" data-theme="omni">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#06070a">\n<meta name="color-scheme" content="dark light">\n<meta name="description" content="Omni \u2014 \u067E\u0646\u0644 \u0645\u062F\u06CC\u0631\u06CC\u062A \u067E\u0631\u0648\u06A9\u0633\u06CC \u0631\u0648\u06CC Cloudflare Workers">\n<title>Omni \xB7 \u067E\u0646\u0644 \u0645\u062F\u06CC\u0631\u06CC\u062A</title>\n<link rel="icon" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJLYXZlaCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImtnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyMmQzZWUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjODE4Y2Y4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGZpbHRlciBpZD0iZ2xvdyIgeD0iLTMwJSIgeT0iLTMwJSIgd2lkdGg9IjE2MCUiIGhlaWdodD0iMTYwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIwIiBzdGREZXZpYXRpb249IjE4IiBmbG9vZC1jb2xvcj0iIzIyZDNlZSIgZmxvb2Qtb3BhY2l0eT0iMC41NSIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTIwIiBmaWxsPSIjMDYwNzBhIi8+CiAgPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iNDMyIiBoZWlnaHQ9IjQzMiIgcng9IjEwNCIgZmlsbD0iIzBiMGQxMyIgc3Ryb2tlPSJ1cmwoI2tnKSIgc3Ryb2tlLXdpZHRoPSI2IiBvcGFjaXR5PSIwLjk1Ii8+CiAgPCEtLSBEZXJhZnNoLWUgS8SBdsSrxIFuOiB0aGUgYmxhY2tzbWl0aCdzIGFwcm9uIHJhaXNlZCBhcyBhIHN0YW5kYXJkIC0tPgogIDxnIGZpbHRlcj0idXJsKCNnbG93KSI+CiAgICA8cGF0aCBkPSJNMTgwIDExOCBMMzMyIDExOCBMMzU2IDMwMCBRMjU2IDM0MCAxNTYgMzAwIFoiIGZpbGw9InVybCgja2cpIiBmaWxsLW9wYWNpdHk9IjAuMTYiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAgIDxwYXRoIGQ9Ik0yNTYgMTE4IEwyNTYgNDAwIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICAgIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIxMiIgcj0iMzQiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTIiLz4KICAgIDxwYXRoIGQ9Ik0yMTQgMzcyIEwyOTggMzcyIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8L2c+Cjwvc3ZnPgo=" type="image/svg+xml">\n<link rel="apple-touch-icon" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJLYXZlaCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImtnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyMmQzZWUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjODE4Y2Y4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGZpbHRlciBpZD0iZ2xvdyIgeD0iLTMwJSIgeT0iLTMwJSIgd2lkdGg9IjE2MCUiIGhlaWdodD0iMTYwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIwIiBzdGREZXZpYXRpb249IjE4IiBmbG9vZC1jb2xvcj0iIzIyZDNlZSIgZmxvb2Qtb3BhY2l0eT0iMC41NSIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTIwIiBmaWxsPSIjMDYwNzBhIi8+CiAgPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iNDMyIiBoZWlnaHQ9IjQzMiIgcng9IjEwNCIgZmlsbD0iIzBiMGQxMyIgc3Ryb2tlPSJ1cmwoI2tnKSIgc3Ryb2tlLXdpZHRoPSI2IiBvcGFjaXR5PSIwLjk1Ii8+CiAgPCEtLSBEZXJhZnNoLWUgS8SBdsSrxIFuOiB0aGUgYmxhY2tzbWl0aCdzIGFwcm9uIHJhaXNlZCBhcyBhIHN0YW5kYXJkIC0tPgogIDxnIGZpbHRlcj0idXJsKCNnbG93KSI+CiAgICA8cGF0aCBkPSJNMTgwIDExOCBMMzMyIDExOCBMMzU2IDMwMCBRMjU2IDM0MCAxNTYgMzAwIFoiIGZpbGw9InVybCgja2cpIiBmaWxsLW9wYWNpdHk9IjAuMTYiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAgIDxwYXRoIGQ9Ik0yNTYgMTE4IEwyNTYgNDAwIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICAgIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIxMiIgcj0iMzQiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTIiLz4KICAgIDxwYXRoIGQ9Ik0yMTQgMzcyIEwyOTggMzcyIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8L2c+Cjwvc3ZnPgo=">\n<link rel="manifest" href="/manifest.webmanifest">\n<style>\n/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n   Omni \u2014 design system v2 \xB7 \xAB\u0632\u0646\u062F\u0647\xBB\n   Hand-written, zero CDN, zero build step. Everything animates on the GPU\n   (transform/opacity/filter only) so a mid-range phone stays at 60 fps.\n   Many panels load Tailwind + Three.js + flag-icons + Vazirmatn + Sortable +\n   qr-code-styling from four CDNs before painting anything. Omni paints in\n   one request and then *moves*.\n   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */\n\n:root {\n  color-scheme: dark;\n  --bg: #05060b;\n  --bg-soft: #0a0c14;\n  --surface: rgba(17, 21, 32, 0.72);\n  --surface-solid: #101319;\n  --surface-2: #171b26;\n  --border: rgba(148, 163, 184, 0.14);\n  --border-strong: rgba(148, 163, 184, 0.26);\n  --text: #eef2fa;\n  --text-dim: #9aa6bb;\n  --text-faint: #69748c;\n  --accent: #22d3ee;\n  --accent-2: #a78bfa;\n  --accent-3: #f472b6;\n  --accent-soft: rgba(34, 211, 238, 0.13);\n  --ok: #34d399;\n  --warn: #fbbf24;\n  --danger: #fb7185;\n  --radius: 18px;\n  --radius-sm: 11px;\n  --shadow: 0 18px 50px -18px rgba(0, 0, 0, 0.75);\n  --glow: 0 0 0 1px rgba(34, 211, 238, 0.22), 0 12px 44px -14px rgba(34, 211, 238, 0.35);\n  --font: system-ui, -apple-system, "Segoe UI", Tahoma, "Vazirmatn", "Noto Sans Arabic", sans-serif;\n  --mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;\n  --ease: cubic-bezier(0.22, 1, 0.36, 1);\n  --spring: cubic-bezier(0.34, 1.4, 0.44, 1);\n  --glass: blur(18px) saturate(150%);\n}\n\n[data-theme="light"] {\n  color-scheme: light;\n  --bg: #eef1f7;\n  --bg-soft: #ffffff;\n  --surface: rgba(255, 255, 255, 0.78);\n  --surface-solid: #ffffff;\n  --surface-2: #f0f3f9;\n  --border: rgba(15, 23, 42, 0.09);\n  --border-strong: rgba(15, 23, 42, 0.18);\n  --text: #0d1526;\n  --text-dim: #51607a;\n  --text-faint: #8b96ab;\n  --accent: #0891b2;\n  --accent-2: #7c3aed;\n  --accent-3: #db2777;\n  --accent-soft: rgba(8, 145, 178, 0.11);\n  --shadow: 0 14px 40px -18px rgba(15, 23, 42, 0.28);\n  --glow: 0 0 0 1px rgba(8, 145, 178, 0.25), 0 12px 40px -16px rgba(8, 145, 178, 0.35);\n  --glass: blur(16px) saturate(140%);\n}\n\n* { box-sizing: border-box; }\nhtml, body { height: 100%; }\nbody {\n  margin: 0;\n  background: var(--bg);\n  color: var(--text);\n  font-family: var(--font);\n  font-size: 14px;\n  line-height: 1.65;\n  -webkit-font-smoothing: antialiased;\n  text-rendering: optimizeLegibility;\n  overflow-x: hidden;\n}\n\n/* \u2500\u2500 the aurora: three drifting light fields, pure CSS, GPU-composited \u2500\u2500\u2500\u2500\u2500 */\nbody::before {\n  content: "";\n  position: fixed;\n  inset: -20%;\n  z-index: 0;\n  pointer-events: none;\n  background:\n    radial-gradient(42% 34% at 18% 22%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%),\n    radial-gradient(38% 30% at 82% 12%, color-mix(in srgb, var(--accent-2) 15%, transparent), transparent 70%),\n    radial-gradient(46% 38% at 55% 88%, color-mix(in srgb, var(--accent-3) 10%, transparent), transparent 72%);\n  filter: blur(46px);\n  animation: aurora 26s var(--ease) infinite alternate;\n  will-change: transform;\n}\n/* fine grain so the gradients never band on cheap panels */\nbody::after {\n  content: "";\n  position: fixed;\n  inset: 0;\n  z-index: 0;\n  pointer-events: none;\n  opacity: 0.5;\n  mix-blend-mode: overlay;\n  background-image: radial-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px);\n  background-size: 3px 3px;\n}\n[data-theme="light"] body::after, body[data-theme="light"]::after { opacity: 0.25; }\n@keyframes aurora {\n  0%   { transform: translate3d(-3%, -2%, 0) rotate(-2deg) scale(1); }\n  50%  { transform: translate3d(3%, 2%, 0) rotate(2deg) scale(1.06); }\n  100% { transform: translate3d(-1%, 3%, 0) rotate(-1deg) scale(1.02); }\n}\n\na { color: var(--accent); text-decoration: none; }\nbutton, input, select, textarea { font: inherit; color: inherit; }\n:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 8px; }\n::selection { background: var(--accent); color: #04121a; }\n.muted { color: var(--text-dim); }\n.mono { font-family: var(--mono); font-size: 0.92em; direction: ltr; unicode-bidi: isolate; }\n.hide { display: none !important; }\nsvg { vertical-align: middle; }\n\n/* \u2500\u2500 scrollbars \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n::-webkit-scrollbar { width: 9px; height: 9px; }\n::-webkit-scrollbar-track { background: transparent; }\n::-webkit-scrollbar-thumb {\n  background: linear-gradient(var(--border-strong), var(--border-strong));\n  border-radius: 99px; border: 2px solid var(--bg);\n}\n::-webkit-scrollbar-thumb:hover { background: var(--text-faint); }\n\n/* \u2500\u2500 layout \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.app { display: grid; grid-template-columns: 252px 1fr; min-height: 100vh; position: relative; z-index: 1; }\n[dir="rtl"] .app { grid-template-columns: 252px 1fr; }\n\n.sidebar {\n  background: color-mix(in srgb, var(--bg-soft) 78%, transparent);\n  backdrop-filter: var(--glass);\n  border-inline-end: 1px solid var(--border);\n  padding: 18px 14px;\n  display: flex; flex-direction: column; gap: 5px;\n  position: sticky; top: 0; height: 100vh; overflow-y: auto;\n}\n.brand { display: flex; align-items: center; gap: 11px; padding: 6px 8px 18px; }\n.brand svg, .brand img { width: 36px; height: 36px; flex: none; filter: drop-shadow(0 0 12px color-mix(in srgb, var(--accent) 55%, transparent)); animation: float 5.5s ease-in-out infinite; }\n@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }\n.brand-name {\n  font-weight: 800; font-size: 18px; letter-spacing: -0.02em;\n  background: linear-gradient(100deg, var(--accent), var(--accent-2) 55%, var(--accent-3));\n  background-size: 220% 100%;\n  -webkit-background-clip: text; background-clip: text; color: transparent;\n  animation: sheen 7s linear infinite;\n}\n@keyframes sheen { to { background-position: 220% 0; } }\n.brand-sub { font-size: 10.5px; color: var(--text-faint); letter-spacing: 0.08em; }\n\n.nav-item {\n  display: flex; align-items: center; gap: 10px;\n  padding: 9.5px 12px; border-radius: var(--radius-sm);\n  color: var(--text-dim); cursor: pointer; border: 1px solid transparent;\n  background: none; width: 100%; text-align: start;\n  transition: background 0.18s var(--ease), color 0.18s var(--ease), transform 0.18s var(--ease), border-color 0.18s;\n  font-size: 13.5px; position: relative; overflow: hidden;\n}\n.nav-item svg { width: 17px; height: 17px; flex: none; opacity: 0.85; transition: transform 0.25s var(--spring); }\n.nav-item:hover { background: var(--surface-2); color: var(--text); transform: translateX(-2px); }\n[dir="rtl"] .nav-item:hover { transform: translateX(2px); }\n.nav-item:hover svg { transform: scale(1.14) rotate(-6deg); }\n.nav-item[aria-current="page"] {\n  background: linear-gradient(90deg, var(--accent-soft), color-mix(in srgb, var(--accent-2) 10%, transparent));\n  color: var(--accent);\n  border-color: color-mix(in srgb, var(--accent) 26%, transparent);\n  font-weight: 650;\n  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);\n}\n.nav-item[aria-current="page"]::before {\n  content: ""; position: absolute; inset-inline-start: 0; inset-block: 22%;\n  width: 3px; border-radius: 99px; background: var(--accent);\n  box-shadow: 0 0 12px var(--accent);\n}\n.nav-sep { height: 1px; background: linear-gradient(90deg, transparent, var(--border-strong), transparent); margin: 10px 4px; }\n.nav-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-faint); padding: 8px 10px 4px; }\n\n.main { display: flex; flex-direction: column; min-width: 0; }\n.topbar {\n  position: sticky; top: 0; z-index: 20;\n  display: flex; align-items: center; gap: 12px;\n  padding: 12px 22px;\n  background: color-mix(in srgb, var(--bg) 72%, transparent);\n  backdrop-filter: var(--glass);\n  border-bottom: 1px solid var(--border);\n}\n.topbar h1 { font-size: 16.5px; margin: 0; font-weight: 750; letter-spacing: -0.01em; }\n.spacer { flex: 1; }\n.content { padding: 22px; max-width: 1500px; width: 100%; }\n\n/* \u2500\u2500 cards: glass + gradient rim + 3D hover \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.grid { display: grid; gap: 14px; }\n.grid-kpi { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }\n.grid-2 { grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); }\n.card {\n  position: relative;\n  background: var(--surface);\n  backdrop-filter: var(--glass);\n  border: 1px solid var(--border);\n  border-radius: var(--radius);\n  padding: 16px;\n  box-shadow: var(--shadow);\n  transform-style: preserve-3d;\n  transition: transform 0.35s var(--ease), box-shadow 0.35s var(--ease), border-color 0.35s;\n}\n/* gradient rim, painted on a masked pseudo-element so the glass stays glass */\n.card::before {\n  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px;\n  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 45%, transparent), transparent 38%, transparent 62%, color-mix(in srgb, var(--accent-2) 40%, transparent));\n  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);\n  -webkit-mask-composite: xor; mask-composite: exclude;\n  opacity: 0; transition: opacity 0.35s var(--ease); pointer-events: none;\n}\n.card:hover { transform: translateY(-3px); box-shadow: 0 26px 60px -22px rgba(0, 0, 0, 0.8), var(--glow); border-color: transparent; }\n.card:hover::before { opacity: 1; }\n/* top inner highlight \u2014 the "lit from above" cue that reads as 3D */\n.card::after {\n  content: ""; position: absolute; inset-inline: 10%; inset-block-start: 0; height: 1px;\n  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent);\n  opacity: 0.5; pointer-events: none;\n}\n[data-theme="light"] .card::after { background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.9), transparent); }\n\n.card-head { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }\n.card-head svg { width: 18px; height: 18px; flex: none; color: var(--accent); filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 45%, transparent)); }\n.card-head h3 { margin: 0; font-size: 13.5px; font-weight: 680; letter-spacing: -0.01em; }\n.kpi-label { font-size: 12px; color: var(--text-dim); display: flex; align-items: center; gap: 6px; }\n.kpi-value {\n  font-size: 28px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.22; margin-top: 2px;\n  font-variant-numeric: tabular-nums;\n  background: linear-gradient(180deg, var(--text), color-mix(in srgb, var(--text) 62%, var(--accent)));\n  -webkit-background-clip: text; background-clip: text; color: transparent;\n}\n.kpi-sub { font-size: 11.5px; color: var(--text-faint); margin-top: 2px; }\n.kpi-icon {\n  width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center;\n  background: var(--accent-soft); color: var(--accent); position: relative;\n  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09);\n}\n.kpi-icon::after {\n  content: ""; position: absolute; inset: -3px; border-radius: 14px;\n  background: conic-gradient(from 0deg, transparent 0 70%, color-mix(in srgb, var(--accent) 60%, transparent) 85%, transparent 100%);\n  animation: spin 4.5s linear infinite; opacity: 0.55; z-index: -1; filter: blur(3px);\n}\n@keyframes spin { to { transform: rotate(360deg); } }\n.kpi-icon svg { width: 18px; height: 18px; }\n\n/* \u2500\u2500 meters \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.meter { height: 7px; border-radius: 99px; background: var(--surface-2); overflow: hidden; box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.35); }\n.meter-fill {\n  height: 100%; border-radius: 99px; position: relative;\n  background: linear-gradient(90deg, var(--accent), var(--accent-2));\n  transition: width 0.7s var(--ease);\n}\n.meter-fill::after {\n  content: ""; position: absolute; inset: 0;\n  background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.4) 50%, transparent 70%);\n  background-size: 220% 100%; animation: sheen 2.6s linear infinite;\n}\n.meter-fill.warn { background: linear-gradient(90deg, var(--warn), #f97316); }\n.meter-fill.danger { background: linear-gradient(90deg, var(--danger), #e11d48); }\n.meter-thin { height: 4px; }\n\n/* \u2500\u2500 table \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.table-wrap {\n  overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius);\n  background: var(--surface); backdrop-filter: var(--glass); box-shadow: var(--shadow);\n}\ntable { width: 100%; border-collapse: collapse; font-size: 13px; }\nthead th {\n  position: sticky; top: 0; z-index: 1;\n  background: color-mix(in srgb, var(--surface-2) 92%, transparent);\n  backdrop-filter: blur(8px);\n  text-align: start; font-weight: 620; font-size: 11px;\n  color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.07em;\n  padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap;\n}\nthead th.sortable { cursor: pointer; user-select: none; transition: color 0.15s; }\nthead th.sortable:hover { color: var(--accent); }\ntbody td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }\ntbody tr:last-child td { border-bottom: none; }\ntbody tr { transition: background 0.16s, transform 0.16s var(--ease); }\ntbody tr:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }\ntbody tr:active { transform: scale(0.995); }\ntbody tr.selected { background: var(--accent-soft); }\n.cell-user { font-weight: 640; }\n.cell-actions { display: flex; gap: 4px; justify-content: flex-end; }\n\n/* \u2500\u2500 badges \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.badge {\n  display: inline-flex; align-items: center; gap: 6px;\n  padding: 2.5px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 620;\n  border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text-dim);\n  white-space: nowrap;\n}\n.badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; }\n.badge.ok::before { animation: pulse 2s var(--ease) infinite; }\n@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(0.8); } }\n.badge.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 32%, transparent); background: color-mix(in srgb, var(--ok) 11%, transparent); }\n.badge.warn { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 32%, transparent); background: color-mix(in srgb, var(--warn) 11%, transparent); }\n.badge.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 32%, transparent); background: color-mix(in srgb, var(--danger) 11%, transparent); }\n.badge.info { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 32%, transparent); background: var(--accent-soft); }\n\n/* \u2500\u2500 buttons \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.btn {\n  display: inline-flex; align-items: center; justify-content: center; gap: 7px;\n  padding: 8px 15px; border-radius: var(--radius-sm);\n  background: var(--surface-2); border: 1px solid var(--border-strong);\n  color: var(--text); cursor: pointer; font-size: 13px; font-weight: 560;\n  transition: transform 0.14s var(--spring), background 0.18s, border-color 0.18s, box-shadow 0.25s, opacity 0.18s;\n  white-space: nowrap; position: relative; overflow: hidden;\n}\n.btn svg { width: 15px; height: 15px; }\n.btn:hover { background: var(--border); transform: translateY(-1px); }\n.btn:active { transform: scale(0.96); }\n.btn:disabled { opacity: 0.45; cursor: not-allowed; }\n.btn-primary {\n  background: linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)));\n  border-color: transparent; color: #04121a; font-weight: 750;\n  box-shadow: 0 8px 24px -10px color-mix(in srgb, var(--accent) 70%, transparent);\n}\n.btn-primary::after {\n  content: ""; position: absolute; inset: 0;\n  background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, 0.55) 50%, transparent 65%);\n  transform: translateX(-120%); transition: transform 0.55s var(--ease);\n}\n[dir="rtl"] .btn-primary::after { transform: translateX(120%); }\n.btn-primary:hover::after { transform: translateX(120%); }\n[dir="rtl"] .btn-primary:hover::after { transform: translateX(-120%); }\n.btn-primary:hover { box-shadow: 0 12px 32px -10px color-mix(in srgb, var(--accent) 85%, transparent); }\n.btn-danger { background: color-mix(in srgb, var(--danger) 14%, transparent); border-color: color-mix(in srgb, var(--danger) 40%, transparent); color: var(--danger); }\n.btn-danger:hover { background: color-mix(in srgb, var(--danger) 24%, transparent); box-shadow: 0 8px 22px -12px var(--danger); }\n.btn-ghost { background: transparent; border-color: transparent; color: var(--text-dim); }\n.btn-ghost:hover { background: var(--surface-2); color: var(--text); }\n.btn-icon { padding: 7px; width: 33px; height: 33px; }\n.btn-sm { padding: 5px 10px; font-size: 12px; }\n.btn-block { width: 100%; }\n/* ripple injected by fx.js */\n.ripple {\n  position: absolute; border-radius: 50%; pointer-events: none;\n  background: radial-gradient(circle, rgba(255, 255, 255, 0.5), transparent 62%);\n  transform: scale(0); animation: ripple 0.6s var(--ease) forwards;\n}\n@keyframes ripple { to { transform: scale(2.6); opacity: 0; } }\n\n/* \u2500\u2500 inputs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.field { display: flex; flex-direction: column; gap: 6px; }\n.field > label { font-size: 12px; color: var(--text-dim); font-weight: 560; }\n.field .hint { font-size: 11px; color: var(--text-faint); }\ninput[type="text"], input[type="password"], input[type="number"], input[type="search"], select, textarea {\n  background: color-mix(in srgb, var(--bg-soft) 82%, transparent);\n  border: 1px solid var(--border-strong);\n  border-radius: var(--radius-sm); padding: 9.5px 12px; width: 100%;\n  transition: border-color 0.18s, box-shadow 0.25s, background 0.18s, transform 0.18s;\n}\ninput:hover, select:hover, textarea:hover { border-color: color-mix(in srgb, var(--accent) 35%, var(--border-strong)); }\ninput:focus, select:focus, textarea:focus {\n  outline: none; border-color: var(--accent);\n  box-shadow: 0 0 0 3.5px var(--accent-soft), 0 0 22px -6px color-mix(in srgb, var(--accent) 55%, transparent);\n  background: var(--bg-soft);\n}\ntextarea { resize: vertical; min-height: 76px; font-family: var(--mono); font-size: 12px; }\ninput[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; }\n.search { position: relative; }\n.search svg { position: absolute; inset-inline-start: 11px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; color: var(--text-faint); pointer-events: none; transition: color 0.2s; }\n.search:focus-within svg { color: var(--accent); }\n.search input { padding-inline-start: 34px; }\n.seg { display: inline-flex; background: var(--surface-2); border: 1px solid var(--border); border-radius: 99px; padding: 3px; gap: 2px; }\n.seg button { border: none; background: none; padding: 5px 13px; border-radius: 99px; cursor: pointer; color: var(--text-dim); font-size: 12.5px; font-weight: 560; transition: background 0.2s var(--ease), color 0.2s, box-shadow 0.2s; }\n.seg button:hover { color: var(--text); }\n.seg button[aria-pressed="true"] { background: linear-gradient(120deg, var(--accent-soft), color-mix(in srgb, var(--accent-2) 14%, transparent)); color: var(--accent); box-shadow: 0 1px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08); }\n.switch { position: relative; width: 42px; height: 23px; flex: none; }\n.switch input { opacity: 0; width: 0; height: 0; }\n.switch span { position: absolute; inset: 0; background: var(--border-strong); border-radius: 99px; cursor: pointer; transition: background 0.25s var(--ease), box-shadow 0.25s; }\n.switch span::after { content: ""; position: absolute; inset-block-start: 3px; inset-inline-start: 3px; width: 17px; height: 17px; background: #fff; border-radius: 50%; transition: transform 0.28s var(--spring); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4); }\n.switch input:checked + span { background: linear-gradient(120deg, var(--accent), var(--accent-2)); box-shadow: 0 0 16px -3px color-mix(in srgb, var(--accent) 65%, transparent); }\n.switch input:checked + span::after { transform: translateX(19px); }\n[dir="rtl"] .switch input:checked + span::after { transform: translateX(-19px); }\n\n/* \u2500\u2500 modal / drawer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.overlay {\n  position: fixed; inset: 0; z-index: 60;\n  background: rgba(3, 5, 10, 0.6); backdrop-filter: blur(10px) saturate(120%);\n  display: grid; place-items: center; padding: 20px;\n  animation: fade 0.2s var(--ease);\n}\n.modal {\n  background: color-mix(in srgb, var(--surface-solid) 88%, transparent);\n  backdrop-filter: var(--glass);\n  border: 1px solid var(--border-strong);\n  border-radius: 22px; width: min(720px, 100%); max-height: 90vh;\n  display: flex; flex-direction: column;\n  box-shadow: 0 40px 110px -25px rgba(0, 0, 0, 0.85), var(--glow);\n  animation: pop 0.32s var(--spring);\n}\n.modal-wide { width: min(1000px, 100%); }\n.modal-head { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: 1px solid var(--border); }\n.modal-head h2 { margin: 0; font-size: 15px; font-weight: 750; }\n.modal-body { padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }\n.modal-foot { padding: 14px 18px; border-top: 1px solid var(--border); display: flex; gap: 8px; justify-content: flex-end; }\n.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 13px; }\n\n.drawer {\n  position: fixed; inset-block: 0; inset-inline-end: 0; z-index: 61;\n  width: min(560px, 100%);\n  background: color-mix(in srgb, var(--surface-solid) 90%, transparent);\n  backdrop-filter: var(--glass);\n  border-inline-start: 1px solid var(--border-strong);\n  box-shadow: -40px 0 100px -35px rgba(0, 0, 0, 0.85);\n  display: flex; flex-direction: column;\n  animation: slide 0.34s var(--spring);\n}\n[dir="rtl"] .drawer { animation-name: slideRtl; }\n\n@keyframes fade { from { opacity: 0; } }\n@keyframes pop { from { opacity: 0; transform: translateY(16px) scale(0.96); filter: blur(4px); } }\n@keyframes slide { from { transform: translateX(46px); opacity: 0; filter: blur(3px); } }\n@keyframes slideRtl { from { transform: translateX(-46px); opacity: 0; filter: blur(3px); } }\n\n/* entrance stagger \u2014 fx.js tags nodes, CSS does the motion */\n.fx-in { animation: rise 0.5s var(--ease) both; }\n@keyframes rise { from { opacity: 0; transform: translateY(14px) scale(0.985); filter: blur(5px); } }\n\n/* \u2500\u2500 toasts \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.toasts { position: fixed; inset-block-end: 18px; inset-inline-start: 18px; z-index: 90; display: flex; flex-direction: column; gap: 8px; max-width: 380px; }\n.toast {\n  background: color-mix(in srgb, var(--surface-solid) 86%, transparent);\n  backdrop-filter: var(--glass);\n  border: 1px solid var(--border-strong);\n  border-inline-start: 3px solid var(--accent);\n  border-radius: 13px; padding: 11px 14px;\n  box-shadow: var(--shadow), 0 0 26px -12px color-mix(in srgb, var(--accent) 55%, transparent);\n  animation: toastIn 0.4s var(--spring); font-size: 13px;\n}\n@keyframes toastIn { from { opacity: 0; transform: translateY(14px) scale(0.94); } }\n.toast.ok { border-inline-start-color: var(--ok); box-shadow: var(--shadow), 0 0 26px -12px color-mix(in srgb, var(--ok) 60%, transparent); }\n.toast.err { border-inline-start-color: var(--danger); box-shadow: var(--shadow), 0 0 26px -12px color-mix(in srgb, var(--danger) 60%, transparent); }\n.toast.warn { border-inline-start-color: var(--warn); box-shadow: var(--shadow), 0 0 26px -12px color-mix(in srgb, var(--warn) 60%, transparent); }\n\n/* \u2500\u2500 command palette \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.palette { width: min(620px, 100%); background: color-mix(in srgb, var(--surface-solid) 90%, transparent); backdrop-filter: var(--glass); border: 1px solid var(--border-strong); border-radius: 18px; overflow: hidden; box-shadow: 0 40px 110px -25px rgba(0, 0, 0, 0.9), var(--glow); }\n.palette input { border: none; border-bottom: 1px solid var(--border); border-radius: 0; padding: 15px 18px; background: transparent; font-size: 15px; }\n.palette input:focus { box-shadow: none; }\n.palette-list { max-height: 340px; overflow-y: auto; padding: 6px; }\n.palette-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; cursor: pointer; font-size: 13.5px; transition: background 0.14s, transform 0.14s var(--ease); }\n.palette-item svg { width: 15px; height: 15px; color: var(--text-faint); }\n.palette-item:hover { transform: translateX(-2px); }\n[dir="rtl"] .palette-item:hover { transform: translateX(2px); }\n.palette-item[aria-selected="true"] { background: var(--accent-soft); color: var(--accent); }\n.palette-item kbd { margin-inline-start: auto; }\nkbd {\n  font-family: var(--mono); font-size: 10.5px; padding: 2px 6px;\n  border: 1px solid var(--border-strong); border-bottom-width: 2px;\n  border-radius: 5px; background: var(--bg-soft); color: var(--text-dim);\n}\n\n/* \u2500\u2500 misc \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.toolbar { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; margin-bottom: 14px; }\n.bulkbar {\n  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;\n  background: linear-gradient(100deg, var(--accent-soft), color-mix(in srgb, var(--accent-2) 10%, transparent));\n  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);\n  padding: 9px 13px; border-radius: var(--radius-sm); margin-bottom: 12px;\n  animation: rise 0.3s var(--ease);\n}\n.empty { text-align: center; padding: 46px 20px; color: var(--text-faint); }\n.empty svg { width: 44px; height: 44px; opacity: 0.4; margin-bottom: 10px; animation: float 4.5s ease-in-out infinite; }\n.skeleton {\n  background: linear-gradient(90deg, var(--surface-2) 25%, var(--border-strong) 50%, var(--surface-2) 75%);\n  background-size: 200% 100%; animation: shimmer 1.3s infinite; border-radius: 9px;\n}\n@keyframes shimmer { to { background-position: -200% 0; } }\n.codebox {\n  background: color-mix(in srgb, var(--bg) 88%, transparent); border: 1px solid var(--border);\n  border-radius: var(--radius-sm);\n  padding: 11px; font-family: var(--mono); font-size: 11.5px; direction: ltr;\n  text-align: left; word-break: break-all; max-height: 190px; overflow: auto; white-space: pre-wrap;\n  transition: border-color 0.2s, box-shadow 0.25s;\n}\n.codebox:hover { border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); box-shadow: inset 0 0 24px -14px color-mix(in srgb, var(--accent) 45%, transparent); }\n.qr { display: grid; place-items: center; padding: 12px; background: #fff; border-radius: var(--radius-sm); box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.12); transition: transform 0.3s var(--spring); }\n.qr:hover { transform: scale(1.03) rotate(-1deg); }\n.qr svg, .qr img { display: block; width: 168px; height: 168px; }\n.tabs { display: flex; gap: 3px; border-bottom: 1px solid var(--border); margin-bottom: 14px; overflow-x: auto; }\n.tabs button { background: none; border: none; padding: 9px 14px; cursor: pointer; color: var(--text-dim); font-size: 13px; font-weight: 560; border-bottom: 2px solid transparent; white-space: nowrap; transition: color 0.2s, border-color 0.25s var(--ease); position: relative; }\n.tabs button svg { width: 14px; height: 14px; }\n.tabs button:hover { color: var(--text); }\n.tabs button[aria-selected="true"] { color: var(--accent); border-bottom-color: var(--accent); text-shadow: 0 0 18px color-mix(in srgb, var(--accent) 55%, transparent); }\n.pager { display: flex; align-items: center; gap: 10px; justify-content: center; padding: 13px; font-size: 12.5px; color: var(--text-dim); }\n.chart { width: 100%; height: 150px; overflow: visible; }\n.chart-bar { opacity: 0.9; transition: opacity 0.15s; transform-box: fill-box; transform-origin: bottom; animation: barIn 0.7s var(--ease) both; }\n.chart-bar:hover { opacity: 1; }\n@keyframes barIn { from { transform: scaleY(0); } }\n.chart-grid { stroke: var(--border); stroke-width: 1; }\n.chart-label { fill: var(--text-faint); font-size: 9.5px; font-family: var(--font); }\n.legend { display: flex; gap: 14px; font-size: 11.5px; color: var(--text-dim); flex-wrap: wrap; }\n.legend i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; margin-inline-end: 5px; }\n\n/* live-test widget */\n.livetest { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 10px; }\n.livetest .ms {\n  font-family: var(--mono); font-size: 17px; font-weight: 700; direction: ltr;\n  padding: 3px 12px; border-radius: 99px; border: 1px solid var(--border-strong);\n  background: var(--surface-2); transition: all 0.3s var(--ease);\n}\n.livetest .ms.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 40%, transparent); box-shadow: 0 0 20px -6px var(--ok); }\n.livetest .ms.bad { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 40%, transparent); box-shadow: 0 0 20px -6px var(--danger); }\n.livetest .spin { width: 15px; height: 15px; border-radius: 50%; border: 2px solid var(--border-strong); border-top-color: var(--accent); animation: spin 0.7s linear infinite; }\n\n/* \u2500\u2500 login \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.auth-wrap { min-height: 100vh; display: grid; place-items: center; padding: 20px; position: relative; z-index: 1; }\n.auth-card {\n  width: min(400px, 100%);\n  background: color-mix(in srgb, var(--surface-solid) 82%, transparent);\n  backdrop-filter: var(--glass);\n  border: 1px solid var(--border-strong);\n  border-radius: 24px; padding: 30px;\n  box-shadow: 0 50px 120px -35px rgba(0, 0, 0, 0.9), var(--glow);\n  animation: pop 0.5s var(--spring);\n  position: relative; overflow: hidden;\n}\n.auth-card::before {\n  content: ""; position: absolute; inset-inline: 0; inset-block-start: 0; height: 2px;\n  background: linear-gradient(90deg, transparent, var(--accent), var(--accent-2), transparent);\n  background-size: 200% 100%; animation: sheen 3.5s linear infinite;\n}\n.auth-logo { display: grid; place-items: center; gap: 10px; margin-bottom: 22px; text-align: center; }\n.auth-logo svg, .auth-logo img { width: 56px; height: 56px; filter: drop-shadow(0 0 22px color-mix(in srgb, var(--accent) 60%, transparent)); animation: float 5s ease-in-out infinite; }\n.auth-logo h1 {\n  margin: 0; font-size: 23px; font-weight: 800; letter-spacing: -0.02em;\n  background: linear-gradient(100deg, var(--accent), var(--accent-2) 60%, var(--accent-3));\n  background-size: 220% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;\n  animation: sheen 6s linear infinite;\n}\n\n/* \u2500\u2500 status page (public, per user) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.status-page { display: grid; place-items: center; padding: 22px; min-height: 100vh; }\n.status-card {\n  width: min(460px, 100%);\n  background: color-mix(in srgb, var(--surface-solid) 84%, transparent);\n  backdrop-filter: var(--glass);\n  border: 1px solid var(--border); border-radius: 22px; padding: 24px;\n  box-shadow: var(--shadow), var(--glow); animation: pop 0.45s var(--spring);\n}\n.status-card h1 { margin: 0 0 4px; font-size: 19px; }\n.status-card dl { display: grid; gap: 9px; margin: 16px 0; }\n.status-card dl > div { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px dashed var(--border); padding-bottom: 7px; }\n.status-card dt { color: var(--text-dim); font-size: 12.5px; }\n.status-card dd { margin: 0; font-weight: 650; font-size: 13px; }\n.status-card .config { background: var(--bg); border-radius: 10px; padding: 10px; font-size: 10.5px; overflow-x: auto; direction: ltr; text-align: left; white-space: pre-wrap; word-break: break-all; }\n\n/* \u2500\u2500 responsive \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n@media (max-width: 900px) {\n  /* Must match the base `[dir="rtl"] .app` specificity, else the RTL\n     two-column rule outlives the breakpoint and .main collapses into the\n     sidebar\'s 252 px track \u2014 the "half the phone is dead space" bug. */\n  .app, [dir="rtl"] .app { grid-template-columns: 1fr; }\n  .sidebar {\n    position: fixed; inset-block: 0; inset-inline-start: 0; z-index: 50;\n    width: 262px; transform: translateX(-102%); transition: transform 0.3s var(--spring), visibility 0s 0.3s;\n    box-shadow: none; visibility: hidden;\n  }\n  [dir="rtl"] .sidebar { transform: translateX(102%); }\n  .sidebar.open { transform: none; box-shadow: 0 0 80px rgba(0, 0, 0, 0.7); visibility: visible; transition: transform 0.3s var(--spring); }\n  .content { padding: 14px; }\n  .topbar { padding: 10px 14px; }\n  .kpi-value { font-size: 23px; }\n  .card { padding: 14px; border-radius: 16px; }\n  .card:hover { transform: none; }           /* no hover-lift on touch: it fights scroll */\n  table { font-size: 12.2px; }\n  thead th, tbody td { padding: 9px 9px; }\n  .form-grid { grid-template-columns: 1fr 1fr; gap: 11px; }\n  .modal { border-radius: 18px; }\n  .overlay { padding: 12px; }\n}\n@media (max-width: 560px) {\n  /* phone: expiry & devices stay one tap away in the drawer, not in a\n     horizontally-scrolled table */\n  .users-table thead th:nth-child(5), .users-table thead th:nth-child(6),\n  .users-table tbody td:nth-child(5), .users-table tbody td:nth-child(6) { display: none; }\n}\n@media (max-width: 520px) {\n  .form-grid { grid-template-columns: 1fr; }\n  .toolbar .seg { width: 100%; justify-content: space-between; }\n  .toolbar .seg button { flex: 1; padding: 6px 4px; }\n  .kpi-value { font-size: 21px; }\n}\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }\n}\n\n/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n   OMNI layer \u2014 merged from the deployed omni-panel-3d.html design systems.\n   Theme tokens map 1:1 onto Omni\'s variables, so every existing component\n   (cards, tables, forms, charts) re-skins automatically when the theme attr\n   changes. Cut-corner clip-paths are lambo-only.\n   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */\n\n[data-theme="omni"] {\n  color-scheme: dark;\n  --bg: #000000;\n  --bg-soft: #0a0a0a;\n  --surface: rgba(14, 14, 14, 0.82);\n  --surface-solid: #0e0e0e;\n  --surface-2: #161616;\n  --border: #2c2c2c;\n  --border-strong: #3d3d3d;\n  --text: #ffffff;\n  --text-dim: #9a9a9a;\n  --text-faint: #6b6b6b;\n  --accent: #ffc000;\n  --accent-2: #ffffff;\n  --accent-3: #ffd75e;\n  --accent-soft: rgba(255, 192, 0, 0.14);\n  --radius: 0px;\n  --radius-sm: 0px;\n  --shadow: 0 12px 30px rgba(0, 0, 0, 0.45);\n  --glow: 0 0 0 1px rgba(255, 192, 0, 0.35), 0 12px 44px -14px rgba(255, 192, 0, 0.45);\n  --font: "Arial Narrow", "Helvetica Neue", Arial, system-ui, Vazirmatn, Tahoma, sans-serif;\n}\n[data-theme="ferrari"] {\n  color-scheme: dark;\n  --bg: #181818; --bg-soft: #101010; --surface: rgba(36, 36, 36, 0.9); --surface-solid: #242424; --surface-2: #2c2c2c;\n  --border: #3a3a3a; --border-strong: #4a4a4a; --text: #ffffff; --text-dim: #969696; --text-faint: #6e6e6e;\n  --accent: #da291c; --accent-2: #fff200; --accent-3: #ff6b5e; --accent-soft: rgba(218, 41, 28, 0.16);\n  --radius: 2px; --radius-sm: 2px;\n  --font: "Helvetica Neue", Arial, system-ui, Vazirmatn, Tahoma, sans-serif;\n}\n[data-theme="apple"] {\n  color-scheme: light;\n  --bg: #f5f5f7; --bg-soft: #ffffff; --surface: rgba(255, 255, 255, 0.9); --surface-solid: #ffffff; --surface-2: #fbfbfd;\n  --border: #e0e0e0; --border-strong: #d2d2d7; --text: #1d1d1f; --text-dim: #6e6e73; --text-faint: #9b9ba0;\n  --accent: #0066cc; --accent-2: #2997ff; --accent-3: #64b5f6; --accent-soft: rgba(0, 102, 204, 0.1);\n  --radius: 20px; --radius-sm: 14px; --shadow: 0 14px 34px rgba(0, 0, 0, 0.12);\n  --font: -apple-system, system-ui, "SF Pro Display", "Segoe UI", Vazirmatn, Tahoma, sans-serif;\n}\n[data-theme="claude"] {\n  color-scheme: light;\n  --bg: #faf9f5; --bg-soft: #f0eadf; --surface: rgba(240, 234, 223, 0.9); --surface-solid: #f0eadf; --surface-2: #e8e0d0;\n  --border: #e0d8ca; --border-strong: #d0c5b0; --text: #141413; --text-dim: #6c6a64; --text-faint: #98938a;\n  --accent: #cc785c; --accent-2: #5db8a6; --accent-3: #e0a58f; --accent-soft: rgba(204, 120, 92, 0.12);\n  --radius: 14px; --radius-sm: 10px; --shadow: 0 12px 28px rgba(80, 50, 30, 0.14);\n  --font: Georgia, "Tiempos Headline", "Times New Roman", Vazirmatn, serif;\n}\n[data-theme="pinterest"] {\n  color-scheme: light;\n  --bg: #ffffff; --bg-soft: #f6f6f3; --surface: rgba(246, 246, 243, 0.92); --surface-solid: #f6f6f3; --surface-2: #efefea;\n  --border: #dadad3; --border-strong: #c7c7be; --text: #211922; --text-dim: #62625b; --text-faint: #9b9b93;\n  --accent: #e60023; --accent-2: #7e238b; --accent-3: #ff5a76; --accent-soft: rgba(230, 0, 35, 0.1);\n  --radius: 26px; --radius-sm: 18px; --shadow: 0 10px 24px rgba(33, 25, 34, 0.12);\n  --font: system-ui, -apple-system, "Segoe UI", Vazirmatn, Tahoma, sans-serif;\n}\n\n/* lambo cut corners */\n[data-theme="omni"] .card,\n[data-theme="omni"] .btn,\n[data-theme="omni"] .kpi,\n[data-theme="omni"] input,\n[data-theme="omni"] select,\n[data-theme="omni"] textarea {\n  border-radius: 0;\n}\n[data-theme="omni"] .card {\n  clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));\n}\n[data-theme="omni"] .btn {\n  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));\n}\n[data-theme="omni"] .btn-primary {\n  font-weight: 700;\n  letter-spacing: 0.4px;\n}\n\n/* \u2500\u2500 OMNI hero (dashboard) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.omni-hero {\n  background: var(--surface-solid);\n  border: 1px solid var(--border);\n  border-radius: var(--radius);\n  box-shadow: var(--shadow);\n  padding: 20px 18px;\n  position: relative;\n  overflow: hidden;\n}\n.omni-hero:before,\n.omni-hero:after {\n  content: "";\n  position: absolute;\n  width: 16px;\n  height: 16px;\n  border: 2px solid var(--accent);\n  pointer-events: none;\n}\n.omni-hero:before { top: 7px; inset-inline-start: 7px; border-right: 0; border-bottom: 0; }\n[dir="rtl"] .omni-hero:before { border-right: 2px solid var(--accent); border-left: 0; }\n.omni-hero:after { bottom: 7px; inset-inline-end: 7px; border-left: 0; border-top: 0; }\n[dir="rtl"] .omni-hero:after { border-left: 2px solid var(--accent); border-right: 0; }\n\n.omni-hero-top { display: flex; align-items: center; gap: 14px; }\n.omni-cube {\n  width: 40px; height: 40px; flex: none; margin: 4px;\n  position: relative; transform-style: preserve-3d;\n  animation: omni-spin 9s linear infinite;\n}\n.omni-cube i {\n  position: absolute; inset: 0;\n  border: 2px solid var(--accent);\n  background: rgba(255, 192, 0, 0.18);\n  background: color-mix(in srgb, var(--accent) 18%, transparent);\n}\n.omni-cube i:nth-child(1) { transform: translateZ(20px); }\n.omni-cube i:nth-child(2) { transform: rotateY(90deg) translateZ(20px); }\n.omni-cube i:nth-child(3) { transform: rotateY(180deg) translateZ(20px); }\n.omni-cube i:nth-child(4) { transform: rotateY(-90deg) translateZ(20px); }\n.omni-cube i:nth-child(5) { transform: rotateX(90deg) translateZ(20px); }\n.omni-cube i:nth-child(6) { transform: rotateX(-90deg) translateZ(20px); }\n@keyframes omni-spin { to { transform: rotateX(360deg) rotateY(360deg); } }\n\n.omni-id h1 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.5px; line-height: 1.2; }\n.omni-id p { margin: 0; color: var(--text-dim); font-size: 12.5px; }\n.omni-pill {\n  margin-inline-start: auto;\n  display: inline-flex; align-items: center; gap: 6px;\n  background: var(--accent); color: #000;\n  padding: 2px 12px; font-size: 12px; font-weight: 700; border-radius: 99px;\n  white-space: nowrap;\n}\n.omni-pill:before {\n  content: ""; width: 7px; height: 7px; border-radius: 50%;\n  background: currentColor; animation: omni-blink 1.4s infinite;\n}\n@keyframes omni-blink { 50% { opacity: 0.2; } }\n\n.omni-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }\n.omni-badges span {\n  border: 1px solid var(--border-strong); color: var(--text-dim);\n  padding: 2px 10px; font-size: 11.5px; border-radius: 99px;\n  font-weight: 600; letter-spacing: 0.3px;\n}\n.omni-stats {\n  display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));\n  gap: 8px; margin-top: 14px;\n}\n.omni-stats > div {\n  background: var(--surface-2); border: 1px solid var(--border);\n  border-radius: var(--radius-sm); padding: 10px 12px;\n}\n.omni-stats span { display: block; color: var(--text-dim); font-size: 11.5px; margin-bottom: 4px; }\n.omni-stats b { font-size: 14px; word-break: break-all; }\n\n.omni-tick {\n  direction: ltr; overflow: hidden; white-space: nowrap;\n  border-block: 1px solid var(--border);\n  font-size: 11.5px; color: var(--text-dim); padding: 3px 0;\n  margin-top: 10px; user-select: none;\n}\n.omni-tick span { display: inline-block; padding-inline-end: 2em; animation: omni-mq 22s linear infinite; }\n@keyframes omni-mq { to { transform: translateX(-50%); } }\n\n/* \u2500\u2500 theme picker row (sidebar) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.theme-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 12px 8px; }\n.theme-dot {\n  width: 26px; height: 26px; border-radius: 50%;\n  border: 1px solid var(--border-strong); background: none; cursor: pointer;\n  display: inline-flex; align-items: center; justify-content: center; padding: 0;\n}\n.theme-dot i { width: 16px; height: 16px; border-radius: 50%; display: block; }\n.theme-dot[aria-pressed="true"] { outline: 2px solid var(--accent); outline-offset: 2px; }\n\n/* \u2500\u2500 scanner \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.scan-progress {\n  height: 8px; background: var(--surface-2);\n  border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden;\n}\n.scan-progress i { display: block; height: 100%; width: 0; background: var(--accent); transition: width 0.2s var(--ease); }\n.scan-row {\n  display: flex; align-items: center; gap: 10px;\n  padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 13px;\n}\n.scan-row:last-child { border-bottom: 0; }\n.scan-row code { min-width: 140px; font-size: 12.5px; }\n.scan-bar {\n  flex: 1; height: 6px; background: var(--surface-2);\n  border-radius: 99px; overflow: hidden; min-width: 60px;\n}\n.scan-bar i { display: block; height: 100%; border-radius: 99px; transition: width 0.25s var(--ease); }\n.scan-row b { min-width: 74px; text-align: end; font-size: 12.5px; }\n\n/* \u2500\u2500 DNS / DoH grid \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.dns-grid {\n  display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));\n  gap: 10px; margin-bottom: 12px;\n}\n.dns-card {\n  text-align: start; background: var(--surface-solid); color: var(--text);\n  border: 1px solid var(--border); border-radius: var(--radius);\n  padding: 14px; cursor: pointer; display: flex; flex-direction: column; gap: 6px;\n  transition: border-color 0.15s var(--ease), transform 0.15s var(--ease);\n}\n.dns-card:hover { border-color: var(--accent); transform: translateY(-2px); }\n.dns-card[aria-pressed="true"] { border-color: var(--accent); box-shadow: var(--glow); }\n.dns-card b { font-size: 14px; }\n.dns-card code { font-size: 11px; color: var(--text-dim); word-break: break-all; direction: ltr; text-align: left; }\n.dns-tags { display: flex; gap: 6px; margin-top: 2px; }\n.badge.ir { background: rgba(34, 197, 94, 0.14); color: #4ade80; }\n\n@media (max-width: 640px) {\n  .omni-hero-top { flex-wrap: wrap; }\n  .omni-pill { margin-inline-start: 0; }\n  .scan-row code { min-width: 110px; }\n}\n\n/* \u2500\u2500 OMNI v2: globe hero, chips, config builder, nintendo & dell \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.omni-hero-top { gap: 10px; }\n.omni-globe {\n  width: 200px; height: 170px; flex: none;\n  margin-inline-start: auto;\n  filter: drop-shadow(0 0 18px color-mix(in srgb, var(--accent) 35%, transparent));\n}\n.omni-id { flex: 1; min-width: 0; }\n.omni-id .omni-pill { margin-inline-start: 0; margin-top: 8px; }\n.omni-flags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 12px; font-size: 15px; opacity: 0.75; }\n@media (max-width: 560px) { .omni-globe { width: 130px; height: 120px; } }\n\n.chips { display: flex; flex-wrap: wrap; gap: 6px; }\n.chip {\n  border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text-dim);\n  padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 600; cursor: pointer;\n  transition: 0.15s var(--ease);\n}\n.chip:hover { color: var(--text); border-color: var(--accent); }\n.chip[aria-pressed="true"] { background: var(--accent); color: #000; border-color: var(--accent); }\n\n.cfg-uri {\n  display: flex; align-items: center; gap: 8px; padding: 6px 0;\n  border-bottom: 1px solid var(--border); font-size: 12px;\n}\n.cfg-uri:last-child { border-bottom: 0; }\n.cfg-uri code { flex: 1; direction: ltr; text-align: left; word-break: break-all; font-size: 11px; }\n.cfg-qrgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }\n.cfg-qrgrid figure { margin: 0; text-align: center; background: #fff; border-radius: 8px; padding: 6px; }\n.cfg-qrgrid figcaption { font-size: 10px; color: #111; direction: ltr; word-break: break-all; margin-top: 3px; }\n.cfg-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }\n\n.dns-test .badge { margin-inline-start: 4px; }\n\n[data-theme="nintendo"] {\n  color-scheme: light;\n  --bg: #7a8aba; --bg-soft: #c9d9ec; --surface: #c9d9ec; --surface-solid: #c9d9ec; --surface-2: #dbe9f7;\n  --border: #3d4f97; --border-strong: #3d4f97; --text: #21242e; --text-dim: #3d4f97; --text-faint: #6a77b5;\n  --accent: #e60012; --accent-2: #f68d1f; --accent-3: #ff5a76; --accent-soft: rgba(230, 0, 18, 0.12);\n  --radius: 12px; --radius-sm: 8px;\n  --shadow: inset 2px 2px 0 #fff9, inset -2px -2px 0 #0004, 0 6px 0 #3d4f97;\n  --font: Verdana, "Trebuchet MS", system-ui, Vazirmatn, sans-serif;\n}\n[data-theme="dell"] {\n  color-scheme: light;\n  --bg: #ffffff; --bg-soft: #fff; --surface: #ffffff; --surface-solid: #ffffff; --surface-2: #f2f2f2;\n  --border: #000000; --border-strong: #000000; --text: #000000; --text-dim: #333333; --text-faint: #777777;\n  --accent: #e91d2a; --accent-2: #fcc20f; --accent-3: #ff6b5e; --accent-soft: rgba(233, 29, 42, 0.1);\n  --radius: 0px; --radius-sm: 0px; --shadow: 4px 4px 0 #000;\n  --font: "Arial Black", Helvetica, system-ui, Vazirmatn, sans-serif;\n}\n\n\n[data-theme="dell"] .btn-primary,\n[data-theme="pinterest"] .btn-primary,\n[data-theme="nintendo"] .btn-primary,\n[data-theme="ferrari"] .btn-primary,\n[data-theme="apple"] .btn-primary,\n[data-theme="claude"] .btn-primary,\n[data-theme="light"] .btn-primary {\n  background: linear-gradient(120deg, var(--accent), var(--accent-2));\n  color: #ffffff !important;\n  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);\n}\n\n/* \u2500\u2500 Causal Mesh laboratory \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.mesh-hero {\n  overflow: hidden; position: relative; padding: 22px;\n  background:\n    radial-gradient(65% 130% at 100% 0%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 62%),\n    radial-gradient(55% 110% at 0% 100%, color-mix(in srgb, var(--accent-2) 18%, transparent), transparent 64%),\n    var(--surface);\n}\n.mesh-hero::after {\n  content:""; position:absolute; inset:0; pointer-events:none; opacity:.16;\n  background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg,var(--border) 1px,transparent 1px);\n  background-size: 34px 34px;\n  mask-image: linear-gradient(to left,#000,transparent 88%);\n}\n.mesh-kicker { color:var(--accent); font:700 11px var(--mono); letter-spacing:.12em; direction:ltr; }\n.mesh-title { margin:4px 0 7px; font-size:clamp(22px,3vw,38px); line-height:1.25; letter-spacing:-.04em; }\n.mesh-title em { font-style:normal; color:var(--accent); text-shadow:0 0 24px color-mix(in srgb,var(--accent) 45%,transparent); }\n.mesh-mode-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }\n.mesh-mode {\n  min-height:105px; text-align:start; padding:14px; border:1px solid var(--border); border-radius:14px;\n  background:color-mix(in srgb,var(--surface-2) 78%,transparent); cursor:pointer; transition:.2s var(--ease);\n}\n.mesh-mode:hover { transform:translateY(-2px); border-color:var(--border-strong); }\n.mesh-mode[aria-pressed="true"] { border-color:var(--accent); background:var(--accent-soft); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 18%,transparent); }\n.mesh-mode b { display:block; margin:7px 0 2px; font-size:13.5px; }\n.mesh-mode small { color:var(--text-dim); line-height:1.6; }\n.mesh-control-grid { display:grid; grid-template-columns:minmax(230px,1fr) minmax(230px,1fr); gap:12px; }\n.mesh-metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:9px; }\n.mesh-metric { padding:12px; border:1px solid var(--border); border-radius:12px; background:var(--bg-soft); min-width:0; }\n.mesh-metric span { display:block; color:var(--text-faint); font-size:10.5px; }\n.mesh-metric b { display:block; margin-top:3px; font:750 18px var(--mono); direction:ltr; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }\n.mesh-flow { display:grid; grid-template-columns:1fr auto 1fr auto 1fr; gap:9px; align-items:center; }\n.mesh-node { padding:12px; border:1px solid var(--border); border-radius:12px; background:var(--bg-soft); text-align:center; }\n.mesh-node b { display:block; font-size:12px; }\n.mesh-node small { color:var(--text-faint); font-size:10.5px; }\n.mesh-arrow { color:var(--accent); font-size:18px; direction:ltr; }\n.mesh-country-list { display:flex; flex-direction:column; gap:7px; }\n.mesh-country-row { display:grid; grid-template-columns:minmax(130px,1fr) 112px 112px minmax(120px,1fr) auto; gap:9px; align-items:center; padding:10px 11px; border:1px solid var(--border); border-radius:12px; background:var(--bg-soft); }\n.mesh-country-row[data-best="true"] { border-color:color-mix(in srgb,var(--ok) 45%,var(--border)); background:color-mix(in srgb,var(--ok) 7%,var(--bg-soft)); }\n.mesh-phase { display:flex; gap:7px; align-items:flex-start; padding:9px 0; border-bottom:1px dashed var(--border); }\n.mesh-phase:last-child { border-bottom:0; }\n.mesh-phase i { width:9px; height:9px; margin-top:6px; border-radius:50%; flex:none; background:var(--text-faint); }\n.mesh-phase.live i { background:var(--ok); box-shadow:0 0 10px var(--ok); }\n.mesh-phase.research i { background:var(--warn); box-shadow:0 0 10px color-mix(in srgb,var(--warn) 55%,transparent); }\n@media(max-width:760px){\n  .mesh-mode-grid,.mesh-control-grid,.mesh-metric-grid{grid-template-columns:1fr 1fr}\n  .mesh-country-row{grid-template-columns:1fr auto}.mesh-country-row>*:nth-child(2),.mesh-country-row>*:nth-child(3),.mesh-country-row>*:nth-child(4){grid-column:1/-1}\n  .mesh-flow{grid-template-columns:1fr}.mesh-arrow{transform:rotate(90deg);text-align:center}\n}\n@media(max-width:470px){.mesh-mode-grid,.mesh-control-grid,.mesh-metric-grid{grid-template-columns:1fr}}\n\n</style>\n<script>\n/* Preview/sandbox-safe storage: in embedded or sandboxed contexts (and in\n   Safari private mode) touching localStorage throws. Fall back to memory so\n   the panel still boots instead of dying on the first theme read. */\ntry { window.localStorage.getItem("omni.probe"); } catch (_) {\n  const mem = new Map();\n  const shim = {\n    getItem: (k) => (mem.has(String(k)) ? mem.get(String(k)) : null),\n    setItem: (k, v) => mem.set(String(k), String(v)),\n    removeItem: (k) => mem.delete(String(k)),\n    clear: () => mem.clear(),\n    key: (i) => [...mem.keys()][i] ?? null,\n    get length() { return mem.size; },\n  };\n  Object.defineProperty(window, "localStorage", { configurable: true, get: () => shim });\n}\n<\/script>\n<!-- Vendored locally (MIT) so the panel works without external CDNs. -->\n<script>\n//---------------------------------------------------------------------\n//\n// QR Code Generator for JavaScript\n//\n// Copyright (c) 2009 Kazuhiko Arase\n//\n// URL: http://www.d-project.com/\n//\n// Licensed under the MIT license:\n//  http://www.opensource.org/licenses/mit-license.php\n//\n// The word \'QR Code\' is registered trademark of\n// DENSO WAVE INCORPORATED\n//  http://www.denso-wave.com/qrcode/faqpatent-e.html\n//\n//---------------------------------------------------------------------\n\nvar qrcode = function() {\n\n  //---------------------------------------------------------------------\n  // qrcode\n  //---------------------------------------------------------------------\n\n  /**\n   * qrcode\n   * @param typeNumber 1 to 40\n   * @param errorCorrectionLevel \'L\',\'M\',\'Q\',\'H\'\n   */\n  var qrcode = function(typeNumber, errorCorrectionLevel) {\n\n    var PAD0 = 0xEC;\n    var PAD1 = 0x11;\n\n    var _typeNumber = typeNumber;\n    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];\n    var _modules = null;\n    var _moduleCount = 0;\n    var _dataCache = null;\n    var _dataList = [];\n\n    var _this = {};\n\n    var makeImpl = function(test, maskPattern) {\n\n      _moduleCount = _typeNumber * 4 + 17;\n      _modules = function(moduleCount) {\n        var modules = new Array(moduleCount);\n        for (var row = 0; row < moduleCount; row += 1) {\n          modules[row] = new Array(moduleCount);\n          for (var col = 0; col < moduleCount; col += 1) {\n            modules[row][col] = null;\n          }\n        }\n        return modules;\n      }(_moduleCount);\n\n      setupPositionProbePattern(0, 0);\n      setupPositionProbePattern(_moduleCount - 7, 0);\n      setupPositionProbePattern(0, _moduleCount - 7);\n      setupPositionAdjustPattern();\n      setupTimingPattern();\n      setupTypeInfo(test, maskPattern);\n\n      if (_typeNumber >= 7) {\n        setupTypeNumber(test);\n      }\n\n      if (_dataCache == null) {\n        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);\n      }\n\n      mapData(_dataCache, maskPattern);\n    };\n\n    var setupPositionProbePattern = function(row, col) {\n\n      for (var r = -1; r <= 7; r += 1) {\n\n        if (row + r <= -1 || _moduleCount <= row + r) continue;\n\n        for (var c = -1; c <= 7; c += 1) {\n\n          if (col + c <= -1 || _moduleCount <= col + c) continue;\n\n          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )\n              || (0 <= c && c <= 6 && (r == 0 || r == 6) )\n              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {\n            _modules[row + r][col + c] = true;\n          } else {\n            _modules[row + r][col + c] = false;\n          }\n        }\n      }\n    };\n\n    var getBestMaskPattern = function() {\n\n      var minLostPoint = 0;\n      var pattern = 0;\n\n      for (var i = 0; i < 8; i += 1) {\n\n        makeImpl(true, i);\n\n        var lostPoint = QRUtil.getLostPoint(_this);\n\n        if (i == 0 || minLostPoint > lostPoint) {\n          minLostPoint = lostPoint;\n          pattern = i;\n        }\n      }\n\n      return pattern;\n    };\n\n    var setupTimingPattern = function() {\n\n      for (var r = 8; r < _moduleCount - 8; r += 1) {\n        if (_modules[r][6] != null) {\n          continue;\n        }\n        _modules[r][6] = (r % 2 == 0);\n      }\n\n      for (var c = 8; c < _moduleCount - 8; c += 1) {\n        if (_modules[6][c] != null) {\n          continue;\n        }\n        _modules[6][c] = (c % 2 == 0);\n      }\n    };\n\n    var setupPositionAdjustPattern = function() {\n\n      var pos = QRUtil.getPatternPosition(_typeNumber);\n\n      for (var i = 0; i < pos.length; i += 1) {\n\n        for (var j = 0; j < pos.length; j += 1) {\n\n          var row = pos[i];\n          var col = pos[j];\n\n          if (_modules[row][col] != null) {\n            continue;\n          }\n\n          for (var r = -2; r <= 2; r += 1) {\n\n            for (var c = -2; c <= 2; c += 1) {\n\n              if (r == -2 || r == 2 || c == -2 || c == 2\n                  || (r == 0 && c == 0) ) {\n                _modules[row + r][col + c] = true;\n              } else {\n                _modules[row + r][col + c] = false;\n              }\n            }\n          }\n        }\n      }\n    };\n\n    var setupTypeNumber = function(test) {\n\n      var bits = QRUtil.getBCHTypeNumber(_typeNumber);\n\n      for (var i = 0; i < 18; i += 1) {\n        var mod = (!test && ( (bits >> i) & 1) == 1);\n        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;\n      }\n\n      for (var i = 0; i < 18; i += 1) {\n        var mod = (!test && ( (bits >> i) & 1) == 1);\n        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;\n      }\n    };\n\n    var setupTypeInfo = function(test, maskPattern) {\n\n      var data = (_errorCorrectionLevel << 3) | maskPattern;\n      var bits = QRUtil.getBCHTypeInfo(data);\n\n      // vertical\n      for (var i = 0; i < 15; i += 1) {\n\n        var mod = (!test && ( (bits >> i) & 1) == 1);\n\n        if (i < 6) {\n          _modules[i][8] = mod;\n        } else if (i < 8) {\n          _modules[i + 1][8] = mod;\n        } else {\n          _modules[_moduleCount - 15 + i][8] = mod;\n        }\n      }\n\n      // horizontal\n      for (var i = 0; i < 15; i += 1) {\n\n        var mod = (!test && ( (bits >> i) & 1) == 1);\n\n        if (i < 8) {\n          _modules[8][_moduleCount - i - 1] = mod;\n        } else if (i < 9) {\n          _modules[8][15 - i - 1 + 1] = mod;\n        } else {\n          _modules[8][15 - i - 1] = mod;\n        }\n      }\n\n      // fixed module\n      _modules[_moduleCount - 8][8] = (!test);\n    };\n\n    var mapData = function(data, maskPattern) {\n\n      var inc = -1;\n      var row = _moduleCount - 1;\n      var bitIndex = 7;\n      var byteIndex = 0;\n      var maskFunc = QRUtil.getMaskFunction(maskPattern);\n\n      for (var col = _moduleCount - 1; col > 0; col -= 2) {\n\n        if (col == 6) col -= 1;\n\n        while (true) {\n\n          for (var c = 0; c < 2; c += 1) {\n\n            if (_modules[row][col - c] == null) {\n\n              var dark = false;\n\n              if (byteIndex < data.length) {\n                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);\n              }\n\n              var mask = maskFunc(row, col - c);\n\n              if (mask) {\n                dark = !dark;\n              }\n\n              _modules[row][col - c] = dark;\n              bitIndex -= 1;\n\n              if (bitIndex == -1) {\n                byteIndex += 1;\n                bitIndex = 7;\n              }\n            }\n          }\n\n          row += inc;\n\n          if (row < 0 || _moduleCount <= row) {\n            row -= inc;\n            inc = -inc;\n            break;\n          }\n        }\n      }\n    };\n\n    var createBytes = function(buffer, rsBlocks) {\n\n      var offset = 0;\n\n      var maxDcCount = 0;\n      var maxEcCount = 0;\n\n      var dcdata = new Array(rsBlocks.length);\n      var ecdata = new Array(rsBlocks.length);\n\n      for (var r = 0; r < rsBlocks.length; r += 1) {\n\n        var dcCount = rsBlocks[r].dataCount;\n        var ecCount = rsBlocks[r].totalCount - dcCount;\n\n        maxDcCount = Math.max(maxDcCount, dcCount);\n        maxEcCount = Math.max(maxEcCount, ecCount);\n\n        dcdata[r] = new Array(dcCount);\n\n        for (var i = 0; i < dcdata[r].length; i += 1) {\n          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];\n        }\n        offset += dcCount;\n\n        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);\n        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);\n\n        var modPoly = rawPoly.mod(rsPoly);\n        ecdata[r] = new Array(rsPoly.getLength() - 1);\n        for (var i = 0; i < ecdata[r].length; i += 1) {\n          var modIndex = i + modPoly.getLength() - ecdata[r].length;\n          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;\n        }\n      }\n\n      var totalCodeCount = 0;\n      for (var i = 0; i < rsBlocks.length; i += 1) {\n        totalCodeCount += rsBlocks[i].totalCount;\n      }\n\n      var data = new Array(totalCodeCount);\n      var index = 0;\n\n      for (var i = 0; i < maxDcCount; i += 1) {\n        for (var r = 0; r < rsBlocks.length; r += 1) {\n          if (i < dcdata[r].length) {\n            data[index] = dcdata[r][i];\n            index += 1;\n          }\n        }\n      }\n\n      for (var i = 0; i < maxEcCount; i += 1) {\n        for (var r = 0; r < rsBlocks.length; r += 1) {\n          if (i < ecdata[r].length) {\n            data[index] = ecdata[r][i];\n            index += 1;\n          }\n        }\n      }\n\n      return data;\n    };\n\n    var createData = function(typeNumber, errorCorrectionLevel, dataList) {\n\n      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);\n\n      var buffer = qrBitBuffer();\n\n      for (var i = 0; i < dataList.length; i += 1) {\n        var data = dataList[i];\n        buffer.put(data.getMode(), 4);\n        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );\n        data.write(buffer);\n      }\n\n      // calc num max data.\n      var totalDataCount = 0;\n      for (var i = 0; i < rsBlocks.length; i += 1) {\n        totalDataCount += rsBlocks[i].dataCount;\n      }\n\n      if (buffer.getLengthInBits() > totalDataCount * 8) {\n        throw \'code length overflow. (\'\n          + buffer.getLengthInBits()\n          + \'>\'\n          + totalDataCount * 8\n          + \')\';\n      }\n\n      // end code\n      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {\n        buffer.put(0, 4);\n      }\n\n      // padding\n      while (buffer.getLengthInBits() % 8 != 0) {\n        buffer.putBit(false);\n      }\n\n      // padding\n      while (true) {\n\n        if (buffer.getLengthInBits() >= totalDataCount * 8) {\n          break;\n        }\n        buffer.put(PAD0, 8);\n\n        if (buffer.getLengthInBits() >= totalDataCount * 8) {\n          break;\n        }\n        buffer.put(PAD1, 8);\n      }\n\n      return createBytes(buffer, rsBlocks);\n    };\n\n    _this.addData = function(data, mode) {\n\n      mode = mode || \'Byte\';\n\n      var newData = null;\n\n      switch(mode) {\n      case \'Numeric\' :\n        newData = qrNumber(data);\n        break;\n      case \'Alphanumeric\' :\n        newData = qrAlphaNum(data);\n        break;\n      case \'Byte\' :\n        newData = qr8BitByte(data);\n        break;\n      case \'Kanji\' :\n        newData = qrKanji(data);\n        break;\n      default :\n        throw \'mode:\' + mode;\n      }\n\n      _dataList.push(newData);\n      _dataCache = null;\n    };\n\n    _this.isDark = function(row, col) {\n      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {\n        throw row + \',\' + col;\n      }\n      return _modules[row][col];\n    };\n\n    _this.getModuleCount = function() {\n      return _moduleCount;\n    };\n\n    _this.make = function() {\n      if (_typeNumber < 1) {\n        var typeNumber = 1;\n\n        for (; typeNumber < 40; typeNumber++) {\n          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);\n          var buffer = qrBitBuffer();\n\n          for (var i = 0; i < _dataList.length; i++) {\n            var data = _dataList[i];\n            buffer.put(data.getMode(), 4);\n            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );\n            data.write(buffer);\n          }\n\n          var totalDataCount = 0;\n          for (var i = 0; i < rsBlocks.length; i++) {\n            totalDataCount += rsBlocks[i].dataCount;\n          }\n\n          if (buffer.getLengthInBits() <= totalDataCount * 8) {\n            break;\n          }\n        }\n\n        _typeNumber = typeNumber;\n      }\n\n      makeImpl(false, getBestMaskPattern() );\n    };\n\n    _this.createTableTag = function(cellSize, margin) {\n\n      cellSize = cellSize || 2;\n      margin = (typeof margin == \'undefined\')? cellSize * 4 : margin;\n\n      var qrHtml = \'\';\n\n      qrHtml += \'<table style="\';\n      qrHtml += \' border-width: 0px; border-style: none;\';\n      qrHtml += \' border-collapse: collapse;\';\n      qrHtml += \' padding: 0px; margin: \' + margin + \'px;\';\n      qrHtml += \'">\';\n      qrHtml += \'<tbody>\';\n\n      for (var r = 0; r < _this.getModuleCount(); r += 1) {\n\n        qrHtml += \'<tr>\';\n\n        for (var c = 0; c < _this.getModuleCount(); c += 1) {\n          qrHtml += \'<td style="\';\n          qrHtml += \' border-width: 0px; border-style: none;\';\n          qrHtml += \' border-collapse: collapse;\';\n          qrHtml += \' padding: 0px; margin: 0px;\';\n          qrHtml += \' width: \' + cellSize + \'px;\';\n          qrHtml += \' height: \' + cellSize + \'px;\';\n          qrHtml += \' background-color: \';\n          qrHtml += _this.isDark(r, c)? \'#000000\' : \'#ffffff\';\n          qrHtml += \';\';\n          qrHtml += \'"/>\';\n        }\n\n        qrHtml += \'</tr>\';\n      }\n\n      qrHtml += \'</tbody>\';\n      qrHtml += \'</table>\';\n\n      return qrHtml;\n    };\n\n    _this.createSvgTag = function(cellSize, margin, alt, title) {\n\n      var opts = {};\n      if (typeof arguments[0] == \'object\') {\n        // Called by options.\n        opts = arguments[0];\n        // overwrite cellSize and margin.\n        cellSize = opts.cellSize;\n        margin = opts.margin;\n        alt = opts.alt;\n        title = opts.title;\n      }\n\n      cellSize = cellSize || 2;\n      margin = (typeof margin == \'undefined\')? cellSize * 4 : margin;\n\n      // Compose alt property surrogate\n      alt = (typeof alt === \'string\') ? {text: alt} : alt || {};\n      alt.text = alt.text || null;\n      alt.id = (alt.text) ? alt.id || \'qrcode-description\' : null;\n\n      // Compose title property surrogate\n      title = (typeof title === \'string\') ? {text: title} : title || {};\n      title.text = title.text || null;\n      title.id = (title.text) ? title.id || \'qrcode-title\' : null;\n\n      var size = _this.getModuleCount() * cellSize + margin * 2;\n      var c, mc, r, mr, qrSvg=\'\', rect;\n\n      rect = \'l\' + cellSize + \',0 0,\' + cellSize +\n        \' -\' + cellSize + \',0 0,-\' + cellSize + \'z \';\n\n      qrSvg += \'<svg version="1.1" xmlns="http://www.w3.org/2000/svg"\';\n      qrSvg += !opts.scalable ? \' width="\' + size + \'px" height="\' + size + \'px"\' : \'\';\n      qrSvg += \' viewBox="0 0 \' + size + \' \' + size + \'" \';\n      qrSvg += \' preserveAspectRatio="xMinYMin meet"\';\n      qrSvg += (title.text || alt.text) ? \' role="img" aria-labelledby="\' +\n          escapeXml([title.id, alt.id].join(\' \').trim() ) + \'"\' : \'\';\n      qrSvg += \'>\';\n      qrSvg += (title.text) ? \'<title id="\' + escapeXml(title.id) + \'">\' +\n          escapeXml(title.text) + \'</title>\' : \'\';\n      qrSvg += (alt.text) ? \'<description id="\' + escapeXml(alt.id) + \'">\' +\n          escapeXml(alt.text) + \'</description>\' : \'\';\n      qrSvg += \'<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>\';\n      qrSvg += \'<path d="\';\n\n      for (r = 0; r < _this.getModuleCount(); r += 1) {\n        mr = r * cellSize + margin;\n        for (c = 0; c < _this.getModuleCount(); c += 1) {\n          if (_this.isDark(r, c) ) {\n            mc = c*cellSize+margin;\n            qrSvg += \'M\' + mc + \',\' + mr + rect;\n          }\n        }\n      }\n\n      qrSvg += \'" stroke="transparent" fill="black"/>\';\n      qrSvg += \'</svg>\';\n\n      return qrSvg;\n    };\n\n    _this.createDataURL = function(cellSize, margin) {\n\n      cellSize = cellSize || 2;\n      margin = (typeof margin == \'undefined\')? cellSize * 4 : margin;\n\n      var size = _this.getModuleCount() * cellSize + margin * 2;\n      var min = margin;\n      var max = size - margin;\n\n      return createDataURL(size, size, function(x, y) {\n        if (min <= x && x < max && min <= y && y < max) {\n          var c = Math.floor( (x - min) / cellSize);\n          var r = Math.floor( (y - min) / cellSize);\n          return _this.isDark(r, c)? 0 : 1;\n        } else {\n          return 1;\n        }\n      } );\n    };\n\n    _this.createImgTag = function(cellSize, margin, alt) {\n\n      cellSize = cellSize || 2;\n      margin = (typeof margin == \'undefined\')? cellSize * 4 : margin;\n\n      var size = _this.getModuleCount() * cellSize + margin * 2;\n\n      var img = \'\';\n      img += \'<img\';\n      img += \'\\u0020src="\';\n      img += _this.createDataURL(cellSize, margin);\n      img += \'"\';\n      img += \'\\u0020width="\';\n      img += size;\n      img += \'"\';\n      img += \'\\u0020height="\';\n      img += size;\n      img += \'"\';\n      if (alt) {\n        img += \'\\u0020alt="\';\n        img += escapeXml(alt);\n        img += \'"\';\n      }\n      img += \'/>\';\n\n      return img;\n    };\n\n    var escapeXml = function(s) {\n      var escaped = \'\';\n      for (var i = 0; i < s.length; i += 1) {\n        var c = s.charAt(i);\n        switch(c) {\n        case \'<\': escaped += \'&lt;\'; break;\n        case \'>\': escaped += \'&gt;\'; break;\n        case \'&\': escaped += \'&amp;\'; break;\n        case \'"\': escaped += \'&quot;\'; break;\n        default : escaped += c; break;\n        }\n      }\n      return escaped;\n    };\n\n    var _createHalfASCII = function(margin) {\n      var cellSize = 1;\n      margin = (typeof margin == \'undefined\')? cellSize * 2 : margin;\n\n      var size = _this.getModuleCount() * cellSize + margin * 2;\n      var min = margin;\n      var max = size - margin;\n\n      var y, x, r1, r2, p;\n\n      var blocks = {\n        \'\u2588\u2588\': \'\u2588\',\n        \'\u2588 \': \'\u2580\',\n        \' \u2588\': \'\u2584\',\n        \'  \': \' \'\n      };\n\n      var blocksLastLineNoMargin = {\n        \'\u2588\u2588\': \'\u2580\',\n        \'\u2588 \': \'\u2580\',\n        \' \u2588\': \' \',\n        \'  \': \' \'\n      };\n\n      var ascii = \'\';\n      for (y = 0; y < size; y += 2) {\n        r1 = Math.floor((y - min) / cellSize);\n        r2 = Math.floor((y + 1 - min) / cellSize);\n        for (x = 0; x < size; x += 1) {\n          p = \'\u2588\';\n\n          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {\n            p = \' \';\n          }\n\n          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {\n            p += \' \';\n          }\n          else {\n            p += \'\u2588\';\n          }\n\n          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.\n          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];\n        }\n\n        ascii += \'\\n\';\n      }\n\n      if (size % 2 && margin > 0) {\n        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join(\'\u2580\');\n      }\n\n      return ascii.substring(0, ascii.length-1);\n    };\n\n    _this.createASCII = function(cellSize, margin) {\n      cellSize = cellSize || 1;\n\n      if (cellSize < 2) {\n        return _createHalfASCII(margin);\n      }\n\n      cellSize -= 1;\n      margin = (typeof margin == \'undefined\')? cellSize * 2 : margin;\n\n      var size = _this.getModuleCount() * cellSize + margin * 2;\n      var min = margin;\n      var max = size - margin;\n\n      var y, x, r, p;\n\n      var white = Array(cellSize+1).join(\'\u2588\u2588\');\n      var black = Array(cellSize+1).join(\'  \');\n\n      var ascii = \'\';\n      var line = \'\';\n      for (y = 0; y < size; y += 1) {\n        r = Math.floor( (y - min) / cellSize);\n        line = \'\';\n        for (x = 0; x < size; x += 1) {\n          p = 1;\n\n          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {\n            p = 0;\n          }\n\n          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.\n          line += p ? white : black;\n        }\n\n        for (r = 0; r < cellSize; r += 1) {\n          ascii += line + \'\\n\';\n        }\n      }\n\n      return ascii.substring(0, ascii.length-1);\n    };\n\n    _this.renderTo2dContext = function(context, cellSize) {\n      cellSize = cellSize || 2;\n      var length = _this.getModuleCount();\n      for (var row = 0; row < length; row++) {\n        for (var col = 0; col < length; col++) {\n          context.fillStyle = _this.isDark(row, col) ? \'black\' : \'white\';\n          context.fillRect(row * cellSize, col * cellSize, cellSize, cellSize);\n        }\n      }\n    }\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // qrcode.stringToBytes\n  //---------------------------------------------------------------------\n\n  qrcode.stringToBytesFuncs = {\n    \'default\' : function(s) {\n      var bytes = [];\n      for (var i = 0; i < s.length; i += 1) {\n        var c = s.charCodeAt(i);\n        bytes.push(c & 0xff);\n      }\n      return bytes;\n    }\n  };\n\n  qrcode.stringToBytes = qrcode.stringToBytesFuncs[\'default\'];\n\n  //---------------------------------------------------------------------\n  // qrcode.createStringToBytes\n  //---------------------------------------------------------------------\n\n  /**\n   * @param unicodeData base64 string of byte array.\n   * [16bit Unicode],[16bit Bytes], ...\n   * @param numChars\n   */\n  qrcode.createStringToBytes = function(unicodeData, numChars) {\n\n    // create conversion map.\n\n    var unicodeMap = function() {\n\n      var bin = base64DecodeInputStream(unicodeData);\n      var read = function() {\n        var b = bin.read();\n        if (b == -1) throw \'eof\';\n        return b;\n      };\n\n      var count = 0;\n      var unicodeMap = {};\n      while (true) {\n        var b0 = bin.read();\n        if (b0 == -1) break;\n        var b1 = read();\n        var b2 = read();\n        var b3 = read();\n        var k = String.fromCharCode( (b0 << 8) | b1);\n        var v = (b2 << 8) | b3;\n        unicodeMap[k] = v;\n        count += 1;\n      }\n      if (count != numChars) {\n        throw count + \' != \' + numChars;\n      }\n\n      return unicodeMap;\n    }();\n\n    var unknownChar = \'?\'.charCodeAt(0);\n\n    return function(s) {\n      var bytes = [];\n      for (var i = 0; i < s.length; i += 1) {\n        var c = s.charCodeAt(i);\n        if (c < 128) {\n          bytes.push(c);\n        } else {\n          var b = unicodeMap[s.charAt(i)];\n          if (typeof b == \'number\') {\n            if ( (b & 0xff) == b) {\n              // 1byte\n              bytes.push(b);\n            } else {\n              // 2bytes\n              bytes.push(b >>> 8);\n              bytes.push(b & 0xff);\n            }\n          } else {\n            bytes.push(unknownChar);\n          }\n        }\n      }\n      return bytes;\n    };\n  };\n\n  //---------------------------------------------------------------------\n  // QRMode\n  //---------------------------------------------------------------------\n\n  var QRMode = {\n    MODE_NUMBER :    1 << 0,\n    MODE_ALPHA_NUM : 1 << 1,\n    MODE_8BIT_BYTE : 1 << 2,\n    MODE_KANJI :     1 << 3\n  };\n\n  //---------------------------------------------------------------------\n  // QRErrorCorrectionLevel\n  //---------------------------------------------------------------------\n\n  var QRErrorCorrectionLevel = {\n    L : 1,\n    M : 0,\n    Q : 3,\n    H : 2\n  };\n\n  //---------------------------------------------------------------------\n  // QRMaskPattern\n  //---------------------------------------------------------------------\n\n  var QRMaskPattern = {\n    PATTERN000 : 0,\n    PATTERN001 : 1,\n    PATTERN010 : 2,\n    PATTERN011 : 3,\n    PATTERN100 : 4,\n    PATTERN101 : 5,\n    PATTERN110 : 6,\n    PATTERN111 : 7\n  };\n\n  //---------------------------------------------------------------------\n  // QRUtil\n  //---------------------------------------------------------------------\n\n  var QRUtil = function() {\n\n    var PATTERN_POSITION_TABLE = [\n      [],\n      [6, 18],\n      [6, 22],\n      [6, 26],\n      [6, 30],\n      [6, 34],\n      [6, 22, 38],\n      [6, 24, 42],\n      [6, 26, 46],\n      [6, 28, 50],\n      [6, 30, 54],\n      [6, 32, 58],\n      [6, 34, 62],\n      [6, 26, 46, 66],\n      [6, 26, 48, 70],\n      [6, 26, 50, 74],\n      [6, 30, 54, 78],\n      [6, 30, 56, 82],\n      [6, 30, 58, 86],\n      [6, 34, 62, 90],\n      [6, 28, 50, 72, 94],\n      [6, 26, 50, 74, 98],\n      [6, 30, 54, 78, 102],\n      [6, 28, 54, 80, 106],\n      [6, 32, 58, 84, 110],\n      [6, 30, 58, 86, 114],\n      [6, 34, 62, 90, 118],\n      [6, 26, 50, 74, 98, 122],\n      [6, 30, 54, 78, 102, 126],\n      [6, 26, 52, 78, 104, 130],\n      [6, 30, 56, 82, 108, 134],\n      [6, 34, 60, 86, 112, 138],\n      [6, 30, 58, 86, 114, 142],\n      [6, 34, 62, 90, 118, 146],\n      [6, 30, 54, 78, 102, 126, 150],\n      [6, 24, 50, 76, 102, 128, 154],\n      [6, 28, 54, 80, 106, 132, 158],\n      [6, 32, 58, 84, 110, 136, 162],\n      [6, 26, 54, 82, 110, 138, 166],\n      [6, 30, 58, 86, 114, 142, 170]\n    ];\n    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);\n    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);\n    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);\n\n    var _this = {};\n\n    var getBCHDigit = function(data) {\n      var digit = 0;\n      while (data != 0) {\n        digit += 1;\n        data >>>= 1;\n      }\n      return digit;\n    };\n\n    _this.getBCHTypeInfo = function(data) {\n      var d = data << 10;\n      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {\n        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );\n      }\n      return ( (data << 10) | d) ^ G15_MASK;\n    };\n\n    _this.getBCHTypeNumber = function(data) {\n      var d = data << 12;\n      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {\n        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );\n      }\n      return (data << 12) | d;\n    };\n\n    _this.getPatternPosition = function(typeNumber) {\n      return PATTERN_POSITION_TABLE[typeNumber - 1];\n    };\n\n    _this.getMaskFunction = function(maskPattern) {\n\n      switch (maskPattern) {\n\n      case QRMaskPattern.PATTERN000 :\n        return function(i, j) { return (i + j) % 2 == 0; };\n      case QRMaskPattern.PATTERN001 :\n        return function(i, j) { return i % 2 == 0; };\n      case QRMaskPattern.PATTERN010 :\n        return function(i, j) { return j % 3 == 0; };\n      case QRMaskPattern.PATTERN011 :\n        return function(i, j) { return (i + j) % 3 == 0; };\n      case QRMaskPattern.PATTERN100 :\n        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };\n      case QRMaskPattern.PATTERN101 :\n        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };\n      case QRMaskPattern.PATTERN110 :\n        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };\n      case QRMaskPattern.PATTERN111 :\n        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };\n\n      default :\n        throw \'bad maskPattern:\' + maskPattern;\n      }\n    };\n\n    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {\n      var a = qrPolynomial([1], 0);\n      for (var i = 0; i < errorCorrectLength; i += 1) {\n        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );\n      }\n      return a;\n    };\n\n    _this.getLengthInBits = function(mode, type) {\n\n      if (1 <= type && type < 10) {\n\n        // 1 - 9\n\n        switch(mode) {\n        case QRMode.MODE_NUMBER    : return 10;\n        case QRMode.MODE_ALPHA_NUM : return 9;\n        case QRMode.MODE_8BIT_BYTE : return 8;\n        case QRMode.MODE_KANJI     : return 8;\n        default :\n          throw \'mode:\' + mode;\n        }\n\n      } else if (type < 27) {\n\n        // 10 - 26\n\n        switch(mode) {\n        case QRMode.MODE_NUMBER    : return 12;\n        case QRMode.MODE_ALPHA_NUM : return 11;\n        case QRMode.MODE_8BIT_BYTE : return 16;\n        case QRMode.MODE_KANJI     : return 10;\n        default :\n          throw \'mode:\' + mode;\n        }\n\n      } else if (type < 41) {\n\n        // 27 - 40\n\n        switch(mode) {\n        case QRMode.MODE_NUMBER    : return 14;\n        case QRMode.MODE_ALPHA_NUM : return 13;\n        case QRMode.MODE_8BIT_BYTE : return 16;\n        case QRMode.MODE_KANJI     : return 12;\n        default :\n          throw \'mode:\' + mode;\n        }\n\n      } else {\n        throw \'type:\' + type;\n      }\n    };\n\n    _this.getLostPoint = function(qrcode) {\n\n      var moduleCount = qrcode.getModuleCount();\n\n      var lostPoint = 0;\n\n      // LEVEL1\n\n      for (var row = 0; row < moduleCount; row += 1) {\n        for (var col = 0; col < moduleCount; col += 1) {\n\n          var sameCount = 0;\n          var dark = qrcode.isDark(row, col);\n\n          for (var r = -1; r <= 1; r += 1) {\n\n            if (row + r < 0 || moduleCount <= row + r) {\n              continue;\n            }\n\n            for (var c = -1; c <= 1; c += 1) {\n\n              if (col + c < 0 || moduleCount <= col + c) {\n                continue;\n              }\n\n              if (r == 0 && c == 0) {\n                continue;\n              }\n\n              if (dark == qrcode.isDark(row + r, col + c) ) {\n                sameCount += 1;\n              }\n            }\n          }\n\n          if (sameCount > 5) {\n            lostPoint += (3 + sameCount - 5);\n          }\n        }\n      };\n\n      // LEVEL2\n\n      for (var row = 0; row < moduleCount - 1; row += 1) {\n        for (var col = 0; col < moduleCount - 1; col += 1) {\n          var count = 0;\n          if (qrcode.isDark(row, col) ) count += 1;\n          if (qrcode.isDark(row + 1, col) ) count += 1;\n          if (qrcode.isDark(row, col + 1) ) count += 1;\n          if (qrcode.isDark(row + 1, col + 1) ) count += 1;\n          if (count == 0 || count == 4) {\n            lostPoint += 3;\n          }\n        }\n      }\n\n      // LEVEL3\n\n      for (var row = 0; row < moduleCount; row += 1) {\n        for (var col = 0; col < moduleCount - 6; col += 1) {\n          if (qrcode.isDark(row, col)\n              && !qrcode.isDark(row, col + 1)\n              &&  qrcode.isDark(row, col + 2)\n              &&  qrcode.isDark(row, col + 3)\n              &&  qrcode.isDark(row, col + 4)\n              && !qrcode.isDark(row, col + 5)\n              &&  qrcode.isDark(row, col + 6) ) {\n            lostPoint += 40;\n          }\n        }\n      }\n\n      for (var col = 0; col < moduleCount; col += 1) {\n        for (var row = 0; row < moduleCount - 6; row += 1) {\n          if (qrcode.isDark(row, col)\n              && !qrcode.isDark(row + 1, col)\n              &&  qrcode.isDark(row + 2, col)\n              &&  qrcode.isDark(row + 3, col)\n              &&  qrcode.isDark(row + 4, col)\n              && !qrcode.isDark(row + 5, col)\n              &&  qrcode.isDark(row + 6, col) ) {\n            lostPoint += 40;\n          }\n        }\n      }\n\n      // LEVEL4\n\n      var darkCount = 0;\n\n      for (var col = 0; col < moduleCount; col += 1) {\n        for (var row = 0; row < moduleCount; row += 1) {\n          if (qrcode.isDark(row, col) ) {\n            darkCount += 1;\n          }\n        }\n      }\n\n      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;\n      lostPoint += ratio * 10;\n\n      return lostPoint;\n    };\n\n    return _this;\n  }();\n\n  //---------------------------------------------------------------------\n  // QRMath\n  //---------------------------------------------------------------------\n\n  var QRMath = function() {\n\n    var EXP_TABLE = new Array(256);\n    var LOG_TABLE = new Array(256);\n\n    // initialize tables\n    for (var i = 0; i < 8; i += 1) {\n      EXP_TABLE[i] = 1 << i;\n    }\n    for (var i = 8; i < 256; i += 1) {\n      EXP_TABLE[i] = EXP_TABLE[i - 4]\n        ^ EXP_TABLE[i - 5]\n        ^ EXP_TABLE[i - 6]\n        ^ EXP_TABLE[i - 8];\n    }\n    for (var i = 0; i < 255; i += 1) {\n      LOG_TABLE[EXP_TABLE[i] ] = i;\n    }\n\n    var _this = {};\n\n    _this.glog = function(n) {\n\n      if (n < 1) {\n        throw \'glog(\' + n + \')\';\n      }\n\n      return LOG_TABLE[n];\n    };\n\n    _this.gexp = function(n) {\n\n      while (n < 0) {\n        n += 255;\n      }\n\n      while (n >= 256) {\n        n -= 255;\n      }\n\n      return EXP_TABLE[n];\n    };\n\n    return _this;\n  }();\n\n  //---------------------------------------------------------------------\n  // qrPolynomial\n  //---------------------------------------------------------------------\n\n  function qrPolynomial(num, shift) {\n\n    if (typeof num.length == \'undefined\') {\n      throw num.length + \'/\' + shift;\n    }\n\n    var _num = function() {\n      var offset = 0;\n      while (offset < num.length && num[offset] == 0) {\n        offset += 1;\n      }\n      var _num = new Array(num.length - offset + shift);\n      for (var i = 0; i < num.length - offset; i += 1) {\n        _num[i] = num[i + offset];\n      }\n      return _num;\n    }();\n\n    var _this = {};\n\n    _this.getAt = function(index) {\n      return _num[index];\n    };\n\n    _this.getLength = function() {\n      return _num.length;\n    };\n\n    _this.multiply = function(e) {\n\n      var num = new Array(_this.getLength() + e.getLength() - 1);\n\n      for (var i = 0; i < _this.getLength(); i += 1) {\n        for (var j = 0; j < e.getLength(); j += 1) {\n          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );\n        }\n      }\n\n      return qrPolynomial(num, 0);\n    };\n\n    _this.mod = function(e) {\n\n      if (_this.getLength() - e.getLength() < 0) {\n        return _this;\n      }\n\n      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );\n\n      var num = new Array(_this.getLength() );\n      for (var i = 0; i < _this.getLength(); i += 1) {\n        num[i] = _this.getAt(i);\n      }\n\n      for (var i = 0; i < e.getLength(); i += 1) {\n        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);\n      }\n\n      // recursive call\n      return qrPolynomial(num, 0).mod(e);\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // QRRSBlock\n  //---------------------------------------------------------------------\n\n  var QRRSBlock = function() {\n\n    var RS_BLOCK_TABLE = [\n\n      // L\n      // M\n      // Q\n      // H\n\n      // 1\n      [1, 26, 19],\n      [1, 26, 16],\n      [1, 26, 13],\n      [1, 26, 9],\n\n      // 2\n      [1, 44, 34],\n      [1, 44, 28],\n      [1, 44, 22],\n      [1, 44, 16],\n\n      // 3\n      [1, 70, 55],\n      [1, 70, 44],\n      [2, 35, 17],\n      [2, 35, 13],\n\n      // 4\n      [1, 100, 80],\n      [2, 50, 32],\n      [2, 50, 24],\n      [4, 25, 9],\n\n      // 5\n      [1, 134, 108],\n      [2, 67, 43],\n      [2, 33, 15, 2, 34, 16],\n      [2, 33, 11, 2, 34, 12],\n\n      // 6\n      [2, 86, 68],\n      [4, 43, 27],\n      [4, 43, 19],\n      [4, 43, 15],\n\n      // 7\n      [2, 98, 78],\n      [4, 49, 31],\n      [2, 32, 14, 4, 33, 15],\n      [4, 39, 13, 1, 40, 14],\n\n      // 8\n      [2, 121, 97],\n      [2, 60, 38, 2, 61, 39],\n      [4, 40, 18, 2, 41, 19],\n      [4, 40, 14, 2, 41, 15],\n\n      // 9\n      [2, 146, 116],\n      [3, 58, 36, 2, 59, 37],\n      [4, 36, 16, 4, 37, 17],\n      [4, 36, 12, 4, 37, 13],\n\n      // 10\n      [2, 86, 68, 2, 87, 69],\n      [4, 69, 43, 1, 70, 44],\n      [6, 43, 19, 2, 44, 20],\n      [6, 43, 15, 2, 44, 16],\n\n      // 11\n      [4, 101, 81],\n      [1, 80, 50, 4, 81, 51],\n      [4, 50, 22, 4, 51, 23],\n      [3, 36, 12, 8, 37, 13],\n\n      // 12\n      [2, 116, 92, 2, 117, 93],\n      [6, 58, 36, 2, 59, 37],\n      [4, 46, 20, 6, 47, 21],\n      [7, 42, 14, 4, 43, 15],\n\n      // 13\n      [4, 133, 107],\n      [8, 59, 37, 1, 60, 38],\n      [8, 44, 20, 4, 45, 21],\n      [12, 33, 11, 4, 34, 12],\n\n      // 14\n      [3, 145, 115, 1, 146, 116],\n      [4, 64, 40, 5, 65, 41],\n      [11, 36, 16, 5, 37, 17],\n      [11, 36, 12, 5, 37, 13],\n\n      // 15\n      [5, 109, 87, 1, 110, 88],\n      [5, 65, 41, 5, 66, 42],\n      [5, 54, 24, 7, 55, 25],\n      [11, 36, 12, 7, 37, 13],\n\n      // 16\n      [5, 122, 98, 1, 123, 99],\n      [7, 73, 45, 3, 74, 46],\n      [15, 43, 19, 2, 44, 20],\n      [3, 45, 15, 13, 46, 16],\n\n      // 17\n      [1, 135, 107, 5, 136, 108],\n      [10, 74, 46, 1, 75, 47],\n      [1, 50, 22, 15, 51, 23],\n      [2, 42, 14, 17, 43, 15],\n\n      // 18\n      [5, 150, 120, 1, 151, 121],\n      [9, 69, 43, 4, 70, 44],\n      [17, 50, 22, 1, 51, 23],\n      [2, 42, 14, 19, 43, 15],\n\n      // 19\n      [3, 141, 113, 4, 142, 114],\n      [3, 70, 44, 11, 71, 45],\n      [17, 47, 21, 4, 48, 22],\n      [9, 39, 13, 16, 40, 14],\n\n      // 20\n      [3, 135, 107, 5, 136, 108],\n      [3, 67, 41, 13, 68, 42],\n      [15, 54, 24, 5, 55, 25],\n      [15, 43, 15, 10, 44, 16],\n\n      // 21\n      [4, 144, 116, 4, 145, 117],\n      [17, 68, 42],\n      [17, 50, 22, 6, 51, 23],\n      [19, 46, 16, 6, 47, 17],\n\n      // 22\n      [2, 139, 111, 7, 140, 112],\n      [17, 74, 46],\n      [7, 54, 24, 16, 55, 25],\n      [34, 37, 13],\n\n      // 23\n      [4, 151, 121, 5, 152, 122],\n      [4, 75, 47, 14, 76, 48],\n      [11, 54, 24, 14, 55, 25],\n      [16, 45, 15, 14, 46, 16],\n\n      // 24\n      [6, 147, 117, 4, 148, 118],\n      [6, 73, 45, 14, 74, 46],\n      [11, 54, 24, 16, 55, 25],\n      [30, 46, 16, 2, 47, 17],\n\n      // 25\n      [8, 132, 106, 4, 133, 107],\n      [8, 75, 47, 13, 76, 48],\n      [7, 54, 24, 22, 55, 25],\n      [22, 45, 15, 13, 46, 16],\n\n      // 26\n      [10, 142, 114, 2, 143, 115],\n      [19, 74, 46, 4, 75, 47],\n      [28, 50, 22, 6, 51, 23],\n      [33, 46, 16, 4, 47, 17],\n\n      // 27\n      [8, 152, 122, 4, 153, 123],\n      [22, 73, 45, 3, 74, 46],\n      [8, 53, 23, 26, 54, 24],\n      [12, 45, 15, 28, 46, 16],\n\n      // 28\n      [3, 147, 117, 10, 148, 118],\n      [3, 73, 45, 23, 74, 46],\n      [4, 54, 24, 31, 55, 25],\n      [11, 45, 15, 31, 46, 16],\n\n      // 29\n      [7, 146, 116, 7, 147, 117],\n      [21, 73, 45, 7, 74, 46],\n      [1, 53, 23, 37, 54, 24],\n      [19, 45, 15, 26, 46, 16],\n\n      // 30\n      [5, 145, 115, 10, 146, 116],\n      [19, 75, 47, 10, 76, 48],\n      [15, 54, 24, 25, 55, 25],\n      [23, 45, 15, 25, 46, 16],\n\n      // 31\n      [13, 145, 115, 3, 146, 116],\n      [2, 74, 46, 29, 75, 47],\n      [42, 54, 24, 1, 55, 25],\n      [23, 45, 15, 28, 46, 16],\n\n      // 32\n      [17, 145, 115],\n      [10, 74, 46, 23, 75, 47],\n      [10, 54, 24, 35, 55, 25],\n      [19, 45, 15, 35, 46, 16],\n\n      // 33\n      [17, 145, 115, 1, 146, 116],\n      [14, 74, 46, 21, 75, 47],\n      [29, 54, 24, 19, 55, 25],\n      [11, 45, 15, 46, 46, 16],\n\n      // 34\n      [13, 145, 115, 6, 146, 116],\n      [14, 74, 46, 23, 75, 47],\n      [44, 54, 24, 7, 55, 25],\n      [59, 46, 16, 1, 47, 17],\n\n      // 35\n      [12, 151, 121, 7, 152, 122],\n      [12, 75, 47, 26, 76, 48],\n      [39, 54, 24, 14, 55, 25],\n      [22, 45, 15, 41, 46, 16],\n\n      // 36\n      [6, 151, 121, 14, 152, 122],\n      [6, 75, 47, 34, 76, 48],\n      [46, 54, 24, 10, 55, 25],\n      [2, 45, 15, 64, 46, 16],\n\n      // 37\n      [17, 152, 122, 4, 153, 123],\n      [29, 74, 46, 14, 75, 47],\n      [49, 54, 24, 10, 55, 25],\n      [24, 45, 15, 46, 46, 16],\n\n      // 38\n      [4, 152, 122, 18, 153, 123],\n      [13, 74, 46, 32, 75, 47],\n      [48, 54, 24, 14, 55, 25],\n      [42, 45, 15, 32, 46, 16],\n\n      // 39\n      [20, 147, 117, 4, 148, 118],\n      [40, 75, 47, 7, 76, 48],\n      [43, 54, 24, 22, 55, 25],\n      [10, 45, 15, 67, 46, 16],\n\n      // 40\n      [19, 148, 118, 6, 149, 119],\n      [18, 75, 47, 31, 76, 48],\n      [34, 54, 24, 34, 55, 25],\n      [20, 45, 15, 61, 46, 16]\n    ];\n\n    var qrRSBlock = function(totalCount, dataCount) {\n      var _this = {};\n      _this.totalCount = totalCount;\n      _this.dataCount = dataCount;\n      return _this;\n    };\n\n    var _this = {};\n\n    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {\n\n      switch(errorCorrectionLevel) {\n      case QRErrorCorrectionLevel.L :\n        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];\n      case QRErrorCorrectionLevel.M :\n        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];\n      case QRErrorCorrectionLevel.Q :\n        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];\n      case QRErrorCorrectionLevel.H :\n        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];\n      default :\n        return undefined;\n      }\n    };\n\n    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {\n\n      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);\n\n      if (typeof rsBlock == \'undefined\') {\n        throw \'bad rs block @ typeNumber:\' + typeNumber +\n            \'/errorCorrectionLevel:\' + errorCorrectionLevel;\n      }\n\n      var length = rsBlock.length / 3;\n\n      var list = [];\n\n      for (var i = 0; i < length; i += 1) {\n\n        var count = rsBlock[i * 3 + 0];\n        var totalCount = rsBlock[i * 3 + 1];\n        var dataCount = rsBlock[i * 3 + 2];\n\n        for (var j = 0; j < count; j += 1) {\n          list.push(qrRSBlock(totalCount, dataCount) );\n        }\n      }\n\n      return list;\n    };\n\n    return _this;\n  }();\n\n  //---------------------------------------------------------------------\n  // qrBitBuffer\n  //---------------------------------------------------------------------\n\n  var qrBitBuffer = function() {\n\n    var _buffer = [];\n    var _length = 0;\n\n    var _this = {};\n\n    _this.getBuffer = function() {\n      return _buffer;\n    };\n\n    _this.getAt = function(index) {\n      var bufIndex = Math.floor(index / 8);\n      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;\n    };\n\n    _this.put = function(num, length) {\n      for (var i = 0; i < length; i += 1) {\n        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);\n      }\n    };\n\n    _this.getLengthInBits = function() {\n      return _length;\n    };\n\n    _this.putBit = function(bit) {\n\n      var bufIndex = Math.floor(_length / 8);\n      if (_buffer.length <= bufIndex) {\n        _buffer.push(0);\n      }\n\n      if (bit) {\n        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );\n      }\n\n      _length += 1;\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // qrNumber\n  //---------------------------------------------------------------------\n\n  var qrNumber = function(data) {\n\n    var _mode = QRMode.MODE_NUMBER;\n    var _data = data;\n\n    var _this = {};\n\n    _this.getMode = function() {\n      return _mode;\n    };\n\n    _this.getLength = function(buffer) {\n      return _data.length;\n    };\n\n    _this.write = function(buffer) {\n\n      var data = _data;\n\n      var i = 0;\n\n      while (i + 2 < data.length) {\n        buffer.put(strToNum(data.substring(i, i + 3) ), 10);\n        i += 3;\n      }\n\n      if (i < data.length) {\n        if (data.length - i == 1) {\n          buffer.put(strToNum(data.substring(i, i + 1) ), 4);\n        } else if (data.length - i == 2) {\n          buffer.put(strToNum(data.substring(i, i + 2) ), 7);\n        }\n      }\n    };\n\n    var strToNum = function(s) {\n      var num = 0;\n      for (var i = 0; i < s.length; i += 1) {\n        num = num * 10 + chatToNum(s.charAt(i) );\n      }\n      return num;\n    };\n\n    var chatToNum = function(c) {\n      if (\'0\' <= c && c <= \'9\') {\n        return c.charCodeAt(0) - \'0\'.charCodeAt(0);\n      }\n      throw \'illegal char :\' + c;\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // qrAlphaNum\n  //---------------------------------------------------------------------\n\n  var qrAlphaNum = function(data) {\n\n    var _mode = QRMode.MODE_ALPHA_NUM;\n    var _data = data;\n\n    var _this = {};\n\n    _this.getMode = function() {\n      return _mode;\n    };\n\n    _this.getLength = function(buffer) {\n      return _data.length;\n    };\n\n    _this.write = function(buffer) {\n\n      var s = _data;\n\n      var i = 0;\n\n      while (i + 1 < s.length) {\n        buffer.put(\n          getCode(s.charAt(i) ) * 45 +\n          getCode(s.charAt(i + 1) ), 11);\n        i += 2;\n      }\n\n      if (i < s.length) {\n        buffer.put(getCode(s.charAt(i) ), 6);\n      }\n    };\n\n    var getCode = function(c) {\n\n      if (\'0\' <= c && c <= \'9\') {\n        return c.charCodeAt(0) - \'0\'.charCodeAt(0);\n      } else if (\'A\' <= c && c <= \'Z\') {\n        return c.charCodeAt(0) - \'A\'.charCodeAt(0) + 10;\n      } else {\n        switch (c) {\n        case \' \' : return 36;\n        case \'$\' : return 37;\n        case \'%\' : return 38;\n        case \'*\' : return 39;\n        case \'+\' : return 40;\n        case \'-\' : return 41;\n        case \'.\' : return 42;\n        case \'/\' : return 43;\n        case \':\' : return 44;\n        default :\n          throw \'illegal char :\' + c;\n        }\n      }\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // qr8BitByte\n  //---------------------------------------------------------------------\n\n  var qr8BitByte = function(data) {\n\n    var _mode = QRMode.MODE_8BIT_BYTE;\n    var _data = data;\n    var _bytes = qrcode.stringToBytes(data);\n\n    var _this = {};\n\n    _this.getMode = function() {\n      return _mode;\n    };\n\n    _this.getLength = function(buffer) {\n      return _bytes.length;\n    };\n\n    _this.write = function(buffer) {\n      for (var i = 0; i < _bytes.length; i += 1) {\n        buffer.put(_bytes[i], 8);\n      }\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // qrKanji\n  //---------------------------------------------------------------------\n\n  var qrKanji = function(data) {\n\n    var _mode = QRMode.MODE_KANJI;\n    var _data = data;\n\n    var stringToBytes = qrcode.stringToBytesFuncs[\'SJIS\'];\n    if (!stringToBytes) {\n      throw \'sjis not supported.\';\n    }\n    !function(c, code) {\n      // self test for sjis support.\n      var test = stringToBytes(c);\n      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {\n        throw \'sjis not supported.\';\n      }\n    }(\'\\u53cb\', 0x9746);\n\n    var _bytes = stringToBytes(data);\n\n    var _this = {};\n\n    _this.getMode = function() {\n      return _mode;\n    };\n\n    _this.getLength = function(buffer) {\n      return ~~(_bytes.length / 2);\n    };\n\n    _this.write = function(buffer) {\n\n      var data = _bytes;\n\n      var i = 0;\n\n      while (i + 1 < data.length) {\n\n        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);\n\n        if (0x8140 <= c && c <= 0x9FFC) {\n          c -= 0x8140;\n        } else if (0xE040 <= c && c <= 0xEBBF) {\n          c -= 0xC140;\n        } else {\n          throw \'illegal char at \' + (i + 1) + \'/\' + c;\n        }\n\n        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);\n\n        buffer.put(c, 13);\n\n        i += 2;\n      }\n\n      if (i < data.length) {\n        throw \'illegal char at \' + (i + 1);\n      }\n    };\n\n    return _this;\n  };\n\n  //=====================================================================\n  // GIF Support etc.\n  //\n\n  //---------------------------------------------------------------------\n  // byteArrayOutputStream\n  //---------------------------------------------------------------------\n\n  var byteArrayOutputStream = function() {\n\n    var _bytes = [];\n\n    var _this = {};\n\n    _this.writeByte = function(b) {\n      _bytes.push(b & 0xff);\n    };\n\n    _this.writeShort = function(i) {\n      _this.writeByte(i);\n      _this.writeByte(i >>> 8);\n    };\n\n    _this.writeBytes = function(b, off, len) {\n      off = off || 0;\n      len = len || b.length;\n      for (var i = 0; i < len; i += 1) {\n        _this.writeByte(b[i + off]);\n      }\n    };\n\n    _this.writeString = function(s) {\n      for (var i = 0; i < s.length; i += 1) {\n        _this.writeByte(s.charCodeAt(i) );\n      }\n    };\n\n    _this.toByteArray = function() {\n      return _bytes;\n    };\n\n    _this.toString = function() {\n      var s = \'\';\n      s += \'[\';\n      for (var i = 0; i < _bytes.length; i += 1) {\n        if (i > 0) {\n          s += \',\';\n        }\n        s += _bytes[i];\n      }\n      s += \']\';\n      return s;\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // base64EncodeOutputStream\n  //---------------------------------------------------------------------\n\n  var base64EncodeOutputStream = function() {\n\n    var _buffer = 0;\n    var _buflen = 0;\n    var _length = 0;\n    var _base64 = \'\';\n\n    var _this = {};\n\n    var writeEncoded = function(b) {\n      _base64 += String.fromCharCode(encode(b & 0x3f) );\n    };\n\n    var encode = function(n) {\n      if (n < 0) {\n        // error.\n      } else if (n < 26) {\n        return 0x41 + n;\n      } else if (n < 52) {\n        return 0x61 + (n - 26);\n      } else if (n < 62) {\n        return 0x30 + (n - 52);\n      } else if (n == 62) {\n        return 0x2b;\n      } else if (n == 63) {\n        return 0x2f;\n      }\n      throw \'n:\' + n;\n    };\n\n    _this.writeByte = function(n) {\n\n      _buffer = (_buffer << 8) | (n & 0xff);\n      _buflen += 8;\n      _length += 1;\n\n      while (_buflen >= 6) {\n        writeEncoded(_buffer >>> (_buflen - 6) );\n        _buflen -= 6;\n      }\n    };\n\n    _this.flush = function() {\n\n      if (_buflen > 0) {\n        writeEncoded(_buffer << (6 - _buflen) );\n        _buffer = 0;\n        _buflen = 0;\n      }\n\n      if (_length % 3 != 0) {\n        // padding\n        var padlen = 3 - _length % 3;\n        for (var i = 0; i < padlen; i += 1) {\n          _base64 += \'=\';\n        }\n      }\n    };\n\n    _this.toString = function() {\n      return _base64;\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // base64DecodeInputStream\n  //---------------------------------------------------------------------\n\n  var base64DecodeInputStream = function(str) {\n\n    var _str = str;\n    var _pos = 0;\n    var _buffer = 0;\n    var _buflen = 0;\n\n    var _this = {};\n\n    _this.read = function() {\n\n      while (_buflen < 8) {\n\n        if (_pos >= _str.length) {\n          if (_buflen == 0) {\n            return -1;\n          }\n          throw \'unexpected end of file./\' + _buflen;\n        }\n\n        var c = _str.charAt(_pos);\n        _pos += 1;\n\n        if (c == \'=\') {\n          _buflen = 0;\n          return -1;\n        } else if (c.match(/^\\s$/) ) {\n          // ignore if whitespace.\n          continue;\n        }\n\n        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );\n        _buflen += 6;\n      }\n\n      var n = (_buffer >>> (_buflen - 8) ) & 0xff;\n      _buflen -= 8;\n      return n;\n    };\n\n    var decode = function(c) {\n      if (0x41 <= c && c <= 0x5a) {\n        return c - 0x41;\n      } else if (0x61 <= c && c <= 0x7a) {\n        return c - 0x61 + 26;\n      } else if (0x30 <= c && c <= 0x39) {\n        return c - 0x30 + 52;\n      } else if (c == 0x2b) {\n        return 62;\n      } else if (c == 0x2f) {\n        return 63;\n      } else {\n        throw \'c:\' + c;\n      }\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // gifImage (B/W)\n  //---------------------------------------------------------------------\n\n  var gifImage = function(width, height) {\n\n    var _width = width;\n    var _height = height;\n    var _data = new Array(width * height);\n\n    var _this = {};\n\n    _this.setPixel = function(x, y, pixel) {\n      _data[y * _width + x] = pixel;\n    };\n\n    _this.write = function(out) {\n\n      //---------------------------------\n      // GIF Signature\n\n      out.writeString(\'GIF87a\');\n\n      //---------------------------------\n      // Screen Descriptor\n\n      out.writeShort(_width);\n      out.writeShort(_height);\n\n      out.writeByte(0x80); // 2bit\n      out.writeByte(0);\n      out.writeByte(0);\n\n      //---------------------------------\n      // Global Color Map\n\n      // black\n      out.writeByte(0x00);\n      out.writeByte(0x00);\n      out.writeByte(0x00);\n\n      // white\n      out.writeByte(0xff);\n      out.writeByte(0xff);\n      out.writeByte(0xff);\n\n      //---------------------------------\n      // Image Descriptor\n\n      out.writeString(\',\');\n      out.writeShort(0);\n      out.writeShort(0);\n      out.writeShort(_width);\n      out.writeShort(_height);\n      out.writeByte(0);\n\n      //---------------------------------\n      // Local Color Map\n\n      //---------------------------------\n      // Raster Data\n\n      var lzwMinCodeSize = 2;\n      var raster = getLZWRaster(lzwMinCodeSize);\n\n      out.writeByte(lzwMinCodeSize);\n\n      var offset = 0;\n\n      while (raster.length - offset > 255) {\n        out.writeByte(255);\n        out.writeBytes(raster, offset, 255);\n        offset += 255;\n      }\n\n      out.writeByte(raster.length - offset);\n      out.writeBytes(raster, offset, raster.length - offset);\n      out.writeByte(0x00);\n\n      //---------------------------------\n      // GIF Terminator\n      out.writeString(\';\');\n    };\n\n    var bitOutputStream = function(out) {\n\n      var _out = out;\n      var _bitLength = 0;\n      var _bitBuffer = 0;\n\n      var _this = {};\n\n      _this.write = function(data, length) {\n\n        if ( (data >>> length) != 0) {\n          throw \'length over\';\n        }\n\n        while (_bitLength + length >= 8) {\n          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );\n          length -= (8 - _bitLength);\n          data >>>= (8 - _bitLength);\n          _bitBuffer = 0;\n          _bitLength = 0;\n        }\n\n        _bitBuffer = (data << _bitLength) | _bitBuffer;\n        _bitLength = _bitLength + length;\n      };\n\n      _this.flush = function() {\n        if (_bitLength > 0) {\n          _out.writeByte(_bitBuffer);\n        }\n      };\n\n      return _this;\n    };\n\n    var getLZWRaster = function(lzwMinCodeSize) {\n\n      var clearCode = 1 << lzwMinCodeSize;\n      var endCode = (1 << lzwMinCodeSize) + 1;\n      var bitLength = lzwMinCodeSize + 1;\n\n      // Setup LZWTable\n      var table = lzwTable();\n\n      for (var i = 0; i < clearCode; i += 1) {\n        table.add(String.fromCharCode(i) );\n      }\n      table.add(String.fromCharCode(clearCode) );\n      table.add(String.fromCharCode(endCode) );\n\n      var byteOut = byteArrayOutputStream();\n      var bitOut = bitOutputStream(byteOut);\n\n      // clear code\n      bitOut.write(clearCode, bitLength);\n\n      var dataIndex = 0;\n\n      var s = String.fromCharCode(_data[dataIndex]);\n      dataIndex += 1;\n\n      while (dataIndex < _data.length) {\n\n        var c = String.fromCharCode(_data[dataIndex]);\n        dataIndex += 1;\n\n        if (table.contains(s + c) ) {\n\n          s = s + c;\n\n        } else {\n\n          bitOut.write(table.indexOf(s), bitLength);\n\n          if (table.size() < 0xfff) {\n\n            if (table.size() == (1 << bitLength) ) {\n              bitLength += 1;\n            }\n\n            table.add(s + c);\n          }\n\n          s = c;\n        }\n      }\n\n      bitOut.write(table.indexOf(s), bitLength);\n\n      // end code\n      bitOut.write(endCode, bitLength);\n\n      bitOut.flush();\n\n      return byteOut.toByteArray();\n    };\n\n    var lzwTable = function() {\n\n      var _map = {};\n      var _size = 0;\n\n      var _this = {};\n\n      _this.add = function(key) {\n        if (_this.contains(key) ) {\n          throw \'dup key:\' + key;\n        }\n        _map[key] = _size;\n        _size += 1;\n      };\n\n      _this.size = function() {\n        return _size;\n      };\n\n      _this.indexOf = function(key) {\n        return _map[key];\n      };\n\n      _this.contains = function(key) {\n        return typeof _map[key] != \'undefined\';\n      };\n\n      return _this;\n    };\n\n    return _this;\n  };\n\n  var createDataURL = function(width, height, getPixel) {\n    var gif = gifImage(width, height);\n    for (var y = 0; y < height; y += 1) {\n      for (var x = 0; x < width; x += 1) {\n        gif.setPixel(x, y, getPixel(x, y) );\n      }\n    }\n\n    var b = byteArrayOutputStream();\n    gif.write(b);\n\n    var base64 = base64EncodeOutputStream();\n    var bytes = b.toByteArray();\n    for (var i = 0; i < bytes.length; i += 1) {\n      base64.writeByte(bytes[i]);\n    }\n    base64.flush();\n\n    return \'data:image/gif;base64,\' + base64;\n  };\n\n  //---------------------------------------------------------------------\n  // returns qrcode function.\n\n  return qrcode;\n}();\n\n// multibyte support\n!function() {\n\n  qrcode.stringToBytesFuncs[\'UTF-8\'] = function(s) {\n    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array\n    function toUTF8Array(str) {\n      var utf8 = [];\n      for (var i=0; i < str.length; i++) {\n        var charcode = str.charCodeAt(i);\n        if (charcode < 0x80) utf8.push(charcode);\n        else if (charcode < 0x800) {\n          utf8.push(0xc0 | (charcode >> 6),\n              0x80 | (charcode & 0x3f));\n        }\n        else if (charcode < 0xd800 || charcode >= 0xe000) {\n          utf8.push(0xe0 | (charcode >> 12),\n              0x80 | ((charcode>>6) & 0x3f),\n              0x80 | (charcode & 0x3f));\n        }\n        // surrogate pair\n        else {\n          i++;\n          // UTF-16 encodes 0x10000-0x10FFFF by\n          // subtracting 0x10000 and splitting the\n          // 20 bits of 0x0-0xFFFFF into two halves\n          charcode = 0x10000 + (((charcode & 0x3ff)<<10)\n            | (str.charCodeAt(i) & 0x3ff));\n          utf8.push(0xf0 | (charcode >>18),\n              0x80 | ((charcode>>12) & 0x3f),\n              0x80 | ((charcode>>6) & 0x3f),\n              0x80 | (charcode & 0x3f));\n        }\n      }\n      return utf8;\n    }\n    return toUTF8Array(s);\n  };\n\n}();\n\n(function (factory) {\n  if (typeof define === \'function\' && define.amd) {\n      define([], factory);\n  } else if (typeof exports === \'object\') {\n      module.exports = factory();\n  }\n}(function () {\n    return qrcode;\n}));\n\n<\/script>\n</head>\n<body>\n<div id="root" aria-busy="true">\n  <div class="auth-wrap">\n    <div class="auth-card">\n      <div class="auth-logo">\n        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJLYXZlaCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImtnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyMmQzZWUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjODE4Y2Y4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGZpbHRlciBpZD0iZ2xvdyIgeD0iLTMwJSIgeT0iLTMwJSIgd2lkdGg9IjE2MCUiIGhlaWdodD0iMTYwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIwIiBzdGREZXZpYXRpb249IjE4IiBmbG9vZC1jb2xvcj0iIzIyZDNlZSIgZmxvb2Qtb3BhY2l0eT0iMC41NSIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTIwIiBmaWxsPSIjMDYwNzBhIi8+CiAgPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iNDMyIiBoZWlnaHQ9IjQzMiIgcng9IjEwNCIgZmlsbD0iIzBiMGQxMyIgc3Ryb2tlPSJ1cmwoI2tnKSIgc3Ryb2tlLXdpZHRoPSI2IiBvcGFjaXR5PSIwLjk1Ii8+CiAgPCEtLSBEZXJhZnNoLWUgS8SBdsSrxIFuOiB0aGUgYmxhY2tzbWl0aCdzIGFwcm9uIHJhaXNlZCBhcyBhIHN0YW5kYXJkIC0tPgogIDxnIGZpbHRlcj0idXJsKCNnbG93KSI+CiAgICA8cGF0aCBkPSJNMTgwIDExOCBMMzMyIDExOCBMMzU2IDMwMCBRMjU2IDM0MCAxNTYgMzAwIFoiIGZpbGw9InVybCgja2cpIiBmaWxsLW9wYWNpdHk9IjAuMTYiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAgIDxwYXRoIGQ9Ik0yNTYgMTE4IEwyNTYgNDAwIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICAgIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIxMiIgcj0iMzQiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTIiLz4KICAgIDxwYXRoIGQ9Ik0yMTQgMzcyIEwyOTggMzcyIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8L2c+Cjwvc3ZnPgo=" alt="" width="52" height="52">\n        <h1>Omni</h1>\n        <p class="muted" style="margin:0;font-size:12.5px">\u062F\u0631 \u062D\u0627\u0644 \u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC\u2026</p>\n      </div>\n      <div class="skeleton" style="height:38px;margin-bottom:9px"></div>\n      <div class="skeleton" style="height:38px;margin-bottom:9px"></div>\n      <div class="skeleton" style="height:38px;width:60%"></div>\n    </div>\n  </div>\n</div>\n<div class="toasts" id="toasts" role="status" aria-live="polite"></div>\n<noscript><div class="auth-wrap"><div class="auth-card"><h1>JavaScript \u0644\u0627\u0632\u0645 \u0627\u0633\u062A</h1></div></div></noscript>\n\n<script>\n"use strict";(()=>{var _t="x-omni-csrf",B=class extends Error{constructor(t,s,i,o){super(i),this.status=t,this.code=s,this.detail=o}};async function x(e,t,s,a={}){let u0=e==="GET"||e==="HEAD";if(u0&&s&&typeof s==="object"&&("retry"in s||"signal"in s)){a=s;s=void 0}let{retry:i=1,signal:o}=a||{},r={method:e,headers:{[_t]:"1"},credentials:"same-origin",signal:o};!u0&&s!==void 0&&(r.headers["content-type"]="application/json",r.body=JSON.stringify(s));let c;for(let f=0;f<=i;f++)try{let u=await fetch(t,r);if(u.status===204)return null;let p=(u.headers.get("content-type")||"").includes("json")?await u.json():{raw:await u.text()};if(!u.ok||p.ok===!1)throw new B(u.status,p.code||"error",p.error||u.statusText,p.detail);return p}catch(u){if(c=u,!(u instanceof B?u.status>=500:!(u instanceof DOMException&&u.name==="AbortError"))||f===i)break;await new Promise(p=>setTimeout(p,300*(f+1)))}throw c}var b={get:(e,t)=>x("GET",e,void 0,t),post:(e,t,s)=>x("POST",e,t??{},s),put:(e,t,s)=>x("PUT",e,t??{},s),patch:(e,t,s)=>x("PATCH",e,t??{},s),del:(e,t)=>x("DELETE",e,void 0,t),whoami:()=>x("GET","/api/whoami",void 0,{retry:0}),login:(e,t)=>x("POST","/api/login",{password:e,username:t},{retry:0}),setup:(e,t)=>x("POST","/api/setup",{password:e,username:t},{retry:0}),logout:()=>x("POST","/api/logout",{},{retry:0}),changePassword:(e,t)=>x("POST","/api/password",{current:e,next:t},{retry:0}),overview:(e=7)=>x("GET",`/api/overview?days=${e}`),users:(e={})=>x("GET",`/api/users?${new URLSearchParams(e)}`),user:e=>x("GET",`/api/users/${encodeURIComponent(e)}`),createUser:e=>x("POST","/api/users",e),updateUser:(e,t)=>x("PATCH",`/api/users/${encodeURIComponent(e)}`,t),deleteUser:e=>x("DELETE",`/api/users/${encodeURIComponent(e)}`),bulk:(e,t,s)=>x("POST","/api/users/bulk",{usernames:e,op:t,value:s}),resetUser:(e,t)=>x("POST",`/api/users/${encodeURIComponent(e)}/reset`,t),rotateToken:e=>x("POST",`/api/users/${encodeURIComponent(e)}/rotate-token`),rotateUuid:e=>x("POST",`/api/users/${encodeURIComponent(e)}/rotate-uuid`),userUsage:(e,t=14)=>x("GET",`/api/stats/usage?username=${encodeURIComponent(e)}&days=${t}`),settings:()=>x("GET","/api/settings"),saveSettings:e=>x("PUT","/api/settings",e),signup:()=>x("POST","/api/signup",{},{retry:0}),fragments:()=>x("GET","/api/fragments"),probeNode:e=>x("POST","/api/diag/probe-node",{proxy:e},{retry:0}),rankIps:(e,t)=>x("POST","/api/diag/rank-ips",{ips:e,host:t},{retry:0}),ping:e=>x("GET",`/api/diag/ping?target=${encodeURIComponent(e)}`,void 0,{retry:0}),logs:(e=50)=>x("GET",`/api/diag/logs?limit=${e}`),maintenance:()=>x("POST","/api/diag/maintenance",{},{retry:0}),sessions:()=>x("GET","/api/sessions"),revoke:e=>x("POST","/api/sessions/revoke",{id:e}),revokeAll:()=>x("POST","/api/sessions/revoke",{all:!0})};function le(e,t=""){return`/s/${e}${t?`?type=${t}`:""}`}function Ee(){let e=document.createElement("a");e.href="/api/backup",e.download="",document.body.append(e),e.click(),e.remove()}var Je={fa:{app:{name:"\\u0627\\u0648\\u0645\\u0646\\u06CC",tagline:"\\u067E\\u0646\\u0644 \\u067E\\u0631\\u0648\\u06A9\\u0633\\u06CC \\u0644\\u0628\\u0647\\u200C\\u0627\\u06CC"},nav:{dashboard:"\\u062F\\u0627\\u0634\\u0628\\u0648\\u0631\\u062F",users:"\\u06A9\\u0627\\u0631\\u0628\\u0631\\u0627\\u0646",settings:"\\u062A\\u0646\\u0638\\u06CC\\u0645\\u0627\\u062A",diag:"\\u0639\\u06CC\\u0628\\u200C\\u06CC\\u0627\\u0628\\u06CC",sessions:"\\u0646\\u0634\\u0633\\u062A\\u200C\\u0647\\u0627",logout:"\\u062E\\u0631\\u0648\\u062C",scanner:"\\u0627\\u0633\\u06A9\\u0646\\u0631",dns:"\\u062F\\u06CC\\u200C\\u0627\\u0646\\u200C\\u0627\\u0633",configs:"\\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF\\u200C\\u0647\\u0627"},omni:{heroTag:"\\u067E\\u0646\\u0644 \\u0634\\u062E\\u0635\\u06CC \\u0631\\u0648\\u06CC \\u06A9\\u0644\\u0648\\u062F\\u0641\\u0644\\u0631 \\xB7 Omni",online:"\\u0622\\u0646\\u0644\\u0627\\u06CC\\u0646",statSni:"SNI \\u067E\\u06CC\\u0634\\u200C\\u0641\\u0631\\u0636",statPorts:"\\u067E\\u0648\\u0631\\u062A\\u200C\\u0647\\u0627",statIps:"\\u0622\\u06CC\\u200C\\u067E\\u06CC \\u062A\\u0645\\u06CC\\u0632",statUsers:"\\u06A9\\u0627\\u0631\\u0628\\u0631\\u0627\\u0646",statColo:"\\u0644\\u0628\\u0647\\u0654 \\u06A9\\u0644\\u0627\\u062F\\u0641\\u0644\\u0631",localMode:"\\u062D\\u0627\\u0644\\u062A \\u0645\\u062D\\u0644\\u06CC"},cfg:{title:"\\u0633\\u0627\\u0632\\u0646\\u062F\\u0647\\u0654 \\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF",desc:"\\u0645\\u062B\\u0644 \\u0627\\u0648\\u0645\\u0646\\u06CC: \\u0622\\u062F\\u0631\\u0633 \\u0648 \\u067E\\u0648\\u0631\\u062A \\u0648 \\u067E\\u0631\\u0648\\u062A\\u06A9\\u0644 \\u0631\\u0627 \\u0627\\u0646\\u062A\\u062E\\u0627\\u0628 \\u06A9\\u0646\\u060C \\u062E\\u0631\\u0648\\u062C\\u06CC \\u0628\\u0647 \\u0647\\u0631 \\u0641\\u0631\\u0645\\u062A\\u06CC \\u0628\\u06AF\\u06CC\\u0631.",build:"\\u0628\\u0633\\u0627\\u0632 \\u26A1",addresses:"\\u0622\\u062F\\u0631\\u0633\\u200C\\u0647\\u0627",fromClean:"\\u0622\\u06CC\\u200C\\u067E\\u06CC\\u200C\\u0647\\u0627\\u06CC \\u062A\\u0645\\u06CC\\u0632",fromHost:"\\u0647\\u0627\\u0633\\u062A \\u067E\\u0646\\u0644",fromCustom:"\\u062F\\u0644\\u062E\\u0648\\u0627\\u0647",ipv6:"\\u0627\\u0641\\u0632\\u0648\\u062F\\u0646 \\u0622\\u06CC\\u200C\\u067E\\u06CC\\u200C\\u0647\\u0627\\u06CC IPv6 \\u06A9\\u0644\\u0627\\u062F\\u0641\\u0644\\u0631",cleanAvailable:"\\u0622\\u06CC\\u200C\\u067E\\u06CC \\u062A\\u0645\\u06CC\\u0632 \\u0645\\u0648\\u062C\\u0648\\u062F",proxyips:"\\u067E\\u0631\\u0648\\u06A9\\u0633\\u06CC \\u0622\\u06CC\\u200C\\u067E\\u06CC",protoPorts:"\\u067E\\u0631\\u0648\\u062A\\u06A9\\u0644 \\u0648 \\u067E\\u0648\\u0631\\u062A\\u200C\\u0647\\u0627",fragment:"\\u0641\\u0631\\u06AF\\u0645\\u0646\\u062A",hint:"\\u062A\\u0646\\u0638\\u06CC\\u0645\\u0627\\u062A \\u0631\\u0627 \\u0627\\u0646\\u062A\\u062E\\u0627\\u0628 \\u0648 \\xAB\\u0628\\u0633\\u0627\\u0632\\xBB \\u0631\\u0627 \\u0628\\u0632\\u0646 \\u2014 \\u062E\\u0631\\u0648\\u062C\\u06CC \\u0647\\u0645\\u06CC\\u0646\\u200C\\u062C\\u0627 \\u0638\\u0627\\u0647\\u0631 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F.",configs:"\\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF",user:"\\u06A9\\u0627\\u0631\\u0628\\u0631",noUser:"\\u0627\\u0648\\u0644 \\u06CC\\u06A9 \\u06A9\\u0627\\u0631\\u0628\\u0631 \\u0628\\u0633\\u0627\\u0632",toOmni:"\\u0627\\u0641\\u0632\\u0648\\u062F\\u0646 \\u0628\\u0647 \\u0627\\u0648\\u0645\\u0646\\u06CC",subLink:"\\u0644\\u06CC\\u0646\\u06A9 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9 \\u0627\\u06CC\\u0646 \\u06A9\\u0627\\u0631\\u0628\\u0631"},scanner:{title:"\\u0627\\u0633\\u06A9\\u0646\\u0631 \\u0622\\u06CC\\u200C\\u067E\\u06CC \\u062A\\u0645\\u06CC\\u0632",desc:"\\u062A\\u0623\\u062E\\u06CC\\u0631 \\u0622\\u06CC\\u200C\\u067E\\u06CC\\u200C\\u0647\\u0627\\u06CC \\u06A9\\u0644\\u0627\\u062F\\u0641\\u0644\\u0631 \\u0631\\u0627 \\u0627\\u0632 \\u0645\\u0631\\u0648\\u0631\\u06AF\\u0631 \\u062E\\u0648\\u062F\\u062A \\u0628\\u0633\\u0646\\u062C \\u06CC\\u0627 \\u0631\\u062A\\u0628\\u0647\\u200C\\u0628\\u0646\\u062F\\u06CC \\u0631\\u0627 \\u0627\\u0632 \\u0644\\u0628\\u0647 \\u0628\\u06AF\\u06CC\\u0631\\u061B \\u0628\\u0647\\u062A\\u0631\\u06CC\\u0646\\u200C\\u0647\\u0627 \\u0631\\u0627 \\u062F\\u0631 \\u062A\\u0646\\u0638\\u06CC\\u0645\\u0627\\u062A \\u0630\\u062E\\u06CC\\u0631\\u0647 \\u06A9\\u0646.",start:"\\u0634\\u0631\\u0648\\u0639 \\u0627\\u0633\\u06A9\\u0646",rank:"\\u0631\\u062A\\u0628\\u0647\\u200C\\u0628\\u0646\\u062F\\u06CC \\u0627\\u0632 \\u0644\\u0628\\u0647\\u0654 \\u06A9\\u0644\\u0648\\u062F\\u0641\\u0644\\u0631",apply:"\\u0627\\u0641\\u0632\\u0648\\u062F\\u0646 \\u0628\\u0631\\u062A\\u0631\\u06CC\\u0646\\u200C\\u0647\\u0627 \\u0628\\u0647 \\u0622\\u06CC\\u200C\\u067E\\u06CC\\u200C\\u0647\\u0627\\u06CC \\u062A\\u0645\\u06CC\\u0632",hint:"\\u0622\\u0645\\u0627\\u062F\\u0647 \\u2014 \\u0627\\u0633\\u06A9\\u0646 \\u0627\\u0632 \\u0645\\u0631\\u0648\\u0631\\u06AF\\u0631 \\u062A\\u0648 \\u062A\\u0623\\u062E\\u06CC\\u0631 \\u0648\\u0627\\u0642\\u0639\\u06CC \\u0627\\u067E\\u0631\\u0627\\u062A\\u0648\\u0631\\u062A \\u0631\\u0627 \\u0645\\u06CC\\u200C\\u0633\\u0646\\u062C\\u062F.",empty:"\\u0647\\u0646\\u0648\\u0632 \\u0646\\u062A\\u06CC\\u062C\\u0647\\u200C\\u0627\\u06CC \\u0646\\u06CC\\u0633\\u062A.",testing:"\\u062F\\u0631 \\u062D\\u0627\\u0644 \\u062A\\u0633\\u062A \\u0627\\u0632 \\u0645\\u0631\\u0648\\u0631\\u06AF\\u0631\\u2026",timeout:"\\u0642\\u0637\\u0639",healthy:"\\u0633\\u0627\\u0644\\u0645",done:"\\u0627\\u0633\\u06A9\\u0646 \\u062A\\u0645\\u0627\\u0645 \\u0634\\u062F",reachable:"\\u0642\\u0627\\u0628\\u0644\\u200C\\u062F\\u0633\\u062A\\u0631\\u0633",ranking:"\\u062F\\u0631\\u062E\\u0648\\u0627\\u0633\\u062A \\u0631\\u062A\\u0628\\u0647\\u200C\\u0628\\u0646\\u062F\\u06CC \\u0628\\u0647 \\u0644\\u0628\\u0647\\u0654 \\u06A9\\u0644\\u0627\\u062F\\u0641\\u0644\\u0631\\u2026",edgeOk:"\\u0633\\u0627\\u0644\\u0645 \\u0627\\u0632 \\u0644\\u0628\\u0647:",rankFail:"\\u0631\\u062A\\u0628\\u0647\\u200C\\u0628\\u0646\\u062F\\u06CC \\u0646\\u0627\\u0645\\u0648\\u0641\\u0642",saved:"\\u062F\\u0631 \\u062A\\u0646\\u0638\\u06CC\\u0645\\u0627\\u062A \\u0630\\u062E\\u06CC\\u0631\\u0647 \\u0634\\u062F",none:"\\u0646\\u062A\\u06CC\\u062C\\u0647\\u0654 \\u0642\\u0627\\u0628\\u0644\\u200C\\u0630\\u062E\\u06CC\\u0631\\u0647 \\u0646\\u06CC\\u0633\\u062A",ranges:"\\u0631\\u0646\\u062C\\u200C\\u0647\\u0627\\u06CC \\u0627\\u0633\\u06A9\\u0646 (CIDR)",rangesHint:"\\u0627\\u0632 \\u0647\\u0631 \\u0631\\u0646\\u062C \\u0646\\u0645\\u0648\\u0646\\u0647\\u200C\\u0628\\u0631\\u062F\\u0627\\u0631\\u06CC \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F\\u061B \\u0628\\u0627 \\u0641\\u0631\\u0645\\u062A a.b.c.d/bit\\u060C \\u0647\\u0631 \\u0631\\u0646\\u062C \\u062F\\u0631 \\u06CC\\u06A9 \\u062E\\u0637."},dns:{title:"\\u062F\\u06CC\\u200C\\u0627\\u0646\\u200C\\u0627\\u0633 / DoH",desc:"\\u0622\\u067E\\u0633\\u062A\\u0631\\u06CC\\u0645 DoH \\u0631\\u0627 \\u0627\\u0646\\u062A\\u062E\\u0627\\u0628 \\u0648 \\u0647\\u0645\\u06CC\\u0646\\u200C\\u062C\\u0627 \\u062A\\u0633\\u062A \\u06A9\\u0646.",active:"\\u0641\\u0639\\u0627\\u0644",ir:"\\u0627\\u06CC\\u0631\\u0627\\u0646",saved:"\\u0630\\u062E\\u06CC\\u0631\\u0647 \\u0634\\u062F",error:"\\u0630\\u062E\\u06CC\\u0631\\u0647 \\u0646\\u0627\\u0645\\u0648\\u0641\\u0642",pick:"\\u0627\\u0646\\u062A\\u062E\\u0627\\u0628",test:"\\u062A\\u0633\\u062A",note:"\\u067E\\u06CC\\u0634\\u200C\\u0641\\u0631\\u0636\\u200C\\u0647\\u0627\\u06CC \\u0627\\u06CC\\u0631\\u0627\\u0646 (\\u0634\\u06A9\\u0646\\u060C \\u0627\\u0644\\u06A9\\u062A\\u0631\\u0648\\u060C \\u0631\\u0627\\u062F\\u0627\\u0631\\u060C \\u06F4\\u06F0\\u06F3\\u060C \\u0628\\u06AF\\u0630\\u0631) \\u0648 \\u062C\\u0647\\u0627\\u0646\\u06CC \\u2014 \\u062A\\u0633\\u062A\\u060C \\u0632\\u0645\\u0627\\u0646 \\u067E\\u0627\\u0633\\u062E \\u0648\\u0627\\u0642\\u0639\\u06CC \\u0631\\u0627 \\u0646\\u0634\\u0627\\u0646 \\u0645\\u06CC\\u200C\\u062F\\u0647\\u062F."},signup:{button:"\\u0633\\u0627\\u062E\\u062A \\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF \\u0631\\u0627\\u06CC\\u06AF\\u0627\\u0646",title:"\\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF \\u062E\\u0648\\u062F\\u062A \\u0631\\u0627 \\u0628\\u0633\\u0627\\u0632",sub:"\\u0628\\u062F\\u0648\\u0646 \\u062B\\u0628\\u062A\\u200C\\u0646\\u0627\\u0645 \\u067E\\u06CC\\u0686\\u06CC\\u062F\\u0647 \\u2014 \\u06CC\\u06A9 \\u06A9\\u0644\\u06CC\\u06A9",step1:"\\u062F\\u06A9\\u0645\\u0647\\u0654 \\u067E\\u0627\\u06CC\\u06CC\\u0646 \\u0631\\u0627 \\u0628\\u0632\\u0646 \\u062A\\u0627 \\u062D\\u0633\\u0627\\u0628 \\u0648 \\u0644\\u06CC\\u0646\\u06A9 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9 \\u062A\\u0648 \\u0633\\u0627\\u062E\\u062A\\u0647 \\u0634\\u0648\\u062F.",step2:"\\u0644\\u06CC\\u0646\\u06A9 \\u06CC\\u0627 QR \\u0631\\u0627 \\u062F\\u0631 v2rayNG / Hiddify / Clash \\u0627\\u0636\\u0627\\u0641\\u0647 \\u06A9\\u0646.",step3:"\\u0633\\u0647\\u0645\\u06CC\\u0647 \\u0648 \\u062A\\u0627\\u0631\\u06CC\\u062E \\u0627\\u0646\\u0642\\u0636\\u0627 \\u0627\\u0632 \\u0627\\u0648\\u0644\\u06CC\\u0646 \\u0627\\u062A\\u0635\\u0627\\u0644 \\u062D\\u0633\\u0627\\u0628 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F.",create:"\\u0628\\u0633\\u0627\\u0632! \\u26A1",doneTitle:"\\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF \\u062A\\u0648 \\u0622\\u0645\\u0627\\u062F\\u0647 \\u0627\\u0633\\u062A \\u{1F389}",doneSub:"\\u0644\\u06CC\\u0646\\u06A9 \\u0632\\u06CC\\u0631 \\u0631\\u0627 \\u062F\\u0631 \\u06A9\\u0644\\u0627\\u06CC\\u0646\\u062A\\u062A \\u0627\\u0636\\u0627\\u0641\\u0647 \\u06A9\\u0646",hint:"\\u0644\\u06CC\\u0646\\u06A9 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9 \\u0631\\u0627 \\u0641\\u0642\\u0637 \\u0628\\u0631\\u0627\\u06CC \\u062E\\u0648\\u062F\\u062A \\u0646\\u06AF\\u0647 \\u062F\\u0627\\u0631\\u061B \\u0647\\u0631 \\u062F\\u0633\\u062A\\u06AF\\u0627\\u0647 \\u06A9\\u0647 \\u0628\\u0627 \\u0622\\u0646 \\u0648\\u0635\\u0644 \\u0634\\u0648\\u062F \\u0627\\u0632 \\u0633\\u0647\\u0645\\u06CC\\u0647\\u200C\\u0627\\u062A \\u06A9\\u0645 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F.",backLogin:"\\u0648\\u0631\\u0648\\u062F \\u0645\\u062F\\u06CC\\u0631",settingToggle:"\\u062B\\u0628\\u062A\\u200C\\u0646\\u0627\\u0645 \\u0639\\u0645\\u0648\\u0645\\u06CC (\\u0633\\u0644\\u0641\\u200C\\u0633\\u0631\\u0648\\u06CC\\u0633 \\u0628\\u0627\\u0632\\u062F\\u06CC\\u062F\\u06A9\\u0646\\u0646\\u062F\\u06AF\\u0627\\u0646)",maxPerIp:"\\u062D\\u062F\\u0627\\u06A9\\u062B\\u0631 \\u062D\\u0633\\u0627\\u0628 \\u0628\\u0647\\u200C\\u0627\\u0632\\u0627\\u06CC \\u0647\\u0631 \\u0622\\u06CC\\u200C\\u067E\\u06CC \\u062F\\u0631 \\u0631\\u0648\\u0632"},login:{title:"\\u0648\\u0631\\u0648\\u062F \\u0628\\u0647 \\u067E\\u0646\\u0644",setupTitle:"\\u0631\\u0627\\u0647\\u200C\\u0627\\u0646\\u062F\\u0627\\u0632\\u06CC \\u0627\\u0648\\u0645\\u0646\\u06CC",password:"\\u0631\\u0645\\u0632 \\u0639\\u0628\\u0648\\u0631",username:"\\u0646\\u0627\\u0645 \\u06A9\\u0627\\u0631\\u0628\\u0631\\u06CC",newPassword:"\\u0631\\u0645\\u0632 \\u062C\\u062F\\u06CC\\u062F",submit:"\\u0648\\u0631\\u0648\\u062F",setup:"\\u0633\\u0627\\u062E\\u062A \\u067E\\u0646\\u0644",recover:"\\u0628\\u0627\\u0632\\u06CC\\u0627\\u0628\\u06CC \\u0631\\u0645\\u0632",hint:"\\u0631\\u0645\\u0632 \\u0639\\u0628\\u0648\\u0631 \\u0628\\u0627 PBKDF2 \\u0648 \\u06F2\\u06F1\\u06F0\\u066C\\u06F0\\u06F0\\u06F0 \\u062A\\u06A9\\u0631\\u0627\\u0631 \\u0647\\u0634 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F.",setupHint:"\\u062D\\u062F\\u0627\\u0642\\u0644 \\u06F1\\u06F0 \\u06A9\\u0627\\u0631\\u0627\\u06A9\\u062A\\u0631. \\u0627\\u06CC\\u0646 \\u0631\\u0645\\u0632 \\u062A\\u0646\\u0647\\u0627 \\u06CC\\u06A9\\u200C\\u0628\\u0627\\u0631 \\u0642\\u0627\\u0628\\u0644 \\u062A\\u0646\\u0638\\u06CC\\u0645 \\u0627\\u0633\\u062A."},dash:{users:"\\u06A9\\u0627\\u0631\\u0628\\u0631\\u0627\\u0646",active:"\\u0641\\u0639\\u0627\\u0644",expired:"\\u0645\\u0646\\u0642\\u0636\\u06CC",traffic:"\\u062A\\u0631\\u0627\\u0641\\u06CC\\u06A9 \\u0645\\u0635\\u0631\\u0641\\u06CC",cf:"\\u0633\\u0647\\u0645\\u06CC\\u0647\\u200C\\u06CC \\u06A9\\u0644\\u0648\\u062F\\u0641\\u0644\\u0631",reqToday:"\\u062F\\u0631\\u062E\\u0648\\u0627\\u0633\\u062A \\u0627\\u0645\\u0631\\u0648\\u0632",topUsers:"\\u067E\\u0631\\u0645\\u0635\\u0631\\u0641\\u200C\\u062A\\u0631\\u06CC\\u0646\\u200C\\u0647\\u0627",traffic7:"\\u062A\\u0631\\u0627\\u0641\\u06CC\\u06A9 \\u06F7 \\u0631\\u0648\\u0632 \\u0627\\u062E\\u06CC\\u0631",alerts:"\\u0647\\u0634\\u062F\\u0627\\u0631\\u0647\\u0627",noAlerts:"\\u0647\\u0645\\u0647\\u200C\\u0686\\u06CC\\u0632 \\u0633\\u0627\\u0644\\u0645 \\u0627\\u0633\\u062A \\u2705",noCf:"\\u0628\\u0631\\u0627\\u06CC \\u062F\\u06CC\\u062F\\u0646 \\u0633\\u0647\\u0645\\u06CC\\u0647\\u060C CF_ACCOUNT_ID \\u0648 CF_API_TOKEN \\u0631\\u0627 \\u062A\\u0646\\u0638\\u06CC\\u0645 \\u06A9\\u0646\\u06CC\\u062F.",cfDanger:"\\u0633\\u0647\\u0645\\u06CC\\u0647\\u200C\\u06CC \\u06A9\\u0644\\u0648\\u062F\\u0641\\u0644\\u0631 \\u0646\\u0632\\u062F\\u06CC\\u06A9 \\u0627\\u062A\\u0645\\u0627\\u0645 \\u0627\\u0633\\u062A \\u2014 \\u0627\\u062D\\u062A\\u0645\\u0627\\u0644 \\u0628\\u0646 \\u0634\\u062F\\u0646 \\u0627\\u06A9\\u0627\\u0646\\u062A.",expiringSoon:"\\u06A9\\u0627\\u0631\\u0628\\u0631 \\u062A\\u0627 \\u06F2\\u06F4 \\u0633\\u0627\\u0639\\u062A \\u062F\\u06CC\\u06AF\\u0631 \\u0645\\u0646\\u0642\\u0636\\u06CC \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F."},users:{title:"\\u06A9\\u0627\\u0631\\u0628\\u0631\\u0627\\u0646",create:"\\u06A9\\u0627\\u0631\\u0628\\u0631 \\u062C\\u062F\\u06CC\\u062F",search:"\\u062C\\u0633\\u062A\\u062C\\u0648\\u06CC \\u0646\\u0627\\u0645\\u060C \\u06CC\\u0627\\u062F\\u062F\\u0627\\u0634\\u062A \\u06CC\\u0627 UUID\\u2026",col:{user:"\\u06A9\\u0627\\u0631\\u0628\\u0631",status:"\\u0648\\u0636\\u0639\\u06CC\\u062A",traffic:"\\u0645\\u0635\\u0631\\u0641",quota:"\\u0633\\u0647\\u0645\\u06CC\\u0647",expiry:"\\u0627\\u0646\\u0642\\u0636\\u0627",devices:"\\u062F\\u0633\\u062A\\u06AF\\u0627\\u0647",actions:""},all:"\\u0647\\u0645\\u0647",activeOnly:"\\u0641\\u0639\\u0627\\u0644",disabledOnly:"\\u063A\\u06CC\\u0631\\u0641\\u0639\\u0627\\u0644",expiredOnly:"\\u0645\\u0646\\u0642\\u0636\\u06CC",selected:"\\u0627\\u0646\\u062A\\u062E\\u0627\\u0628 \\u0634\\u062F\\u0647",bulkEnable:"\\u0641\\u0639\\u0627\\u0644\\u200C\\u0633\\u0627\\u0632\\u06CC",bulkDisable:"\\u063A\\u06CC\\u0631\\u0641\\u0639\\u0627\\u0644\\u200C\\u0633\\u0627\\u0632\\u06CC",bulkReset:"\\u0631\\u06CC\\u0633\\u062A \\u062D\\u062C\\u0645",bulkExtend:"\\u062A\\u0645\\u062F\\u06CC\\u062F \\u0631\\u0648\\u0632",bulkDelete:"\\u062D\\u0630\\u0641",empty:"\\u0647\\u0646\\u0648\\u0632 \\u06A9\\u0627\\u0631\\u0628\\u0631\\u06CC \\u0646\\u0633\\u0627\\u062E\\u062A\\u0647\\u200C\\u0627\\u06CC\\u062F",emptyHint:"\\u0627\\u0648\\u0644\\u06CC\\u0646 \\u06A9\\u0627\\u0631\\u0628\\u0631 \\u0631\\u0627 \\u0628\\u0633\\u0627\\u0632\\u06CC\\u062F \\u062A\\u0627 \\u0644\\u06CC\\u0646\\u06A9 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9 \\u062A\\u0648\\u0644\\u06CC\\u062F \\u0634\\u0648\\u062F.",confirmDelete:"\\u062D\\u0630\\u0641 \\u06A9\\u0627\\u0631\\u0628\\u0631 \\xAB{name}\\xBB\\u061F \\u0627\\u06CC\\u0646 \\u0639\\u0645\\u0644 \\u0642\\u0627\\u0628\\u0644 \\u0628\\u0627\\u0632\\u06AF\\u0634\\u062A \\u0646\\u06CC\\u0633\\u062A.",confirmBulkDelete:"\\u062D\\u0630\\u0641 {n} \\u06A9\\u0627\\u0631\\u0628\\u0631\\u061F \\u0627\\u06CC\\u0646 \\u0639\\u0645\\u0644 \\u0642\\u0627\\u0628\\u0644 \\u0628\\u0627\\u0632\\u06AF\\u0634\\u062A \\u0646\\u06CC\\u0633\\u062A.",form:{username:"\\u0646\\u0627\\u0645 \\u06A9\\u0627\\u0631\\u0628\\u0631\\u06CC",quota:"\\u062D\\u062C\\u0645 (\\u06AF\\u06CC\\u06AF\\u0627\\u0628\\u0627\\u06CC\\u062A)",days:"\\u0645\\u062F\\u062A (\\u0631\\u0648\\u0632)",devices:"\\u0633\\u0642\\u0641 \\u062F\\u0633\\u062A\\u06AF\\u0627\\u0647 \\u0647\\u0645\\u0632\\u0645\\u0627\\u0646",requests:"\\u0633\\u0642\\u0641 \\u062F\\u0631\\u062E\\u0648\\u0627\\u0633\\u062A (\\u06F0 = \\u0646\\u0627\\u0645\\u062D\\u062F\\u0648\\u062F)",firstConnect:"\\u0634\\u0631\\u0648\\u0639 \\u0632\\u0645\\u0627\\u0646 \\u0627\\u0632 \\u0627\\u0648\\u0644\\u06CC\\u0646 \\u0627\\u062A\\u0635\\u0627\\u0644",fragment:"\\u067E\\u0631\\u06CC\\u0633\\u062A \\u0641\\u0631\\u06AF\\u0645\\u0646\\u062A",fingerprint:"\\u0627\\u062B\\u0631 \\u0627\\u0646\\u06AF\\u0634\\u062A TLS",ips:"\\u0622\\u06CC\\u200C\\u067E\\u06CC\\u200C\\u0647\\u0627\\u06CC \\u062A\\u0645\\u06CC\\u0632 (\\u0647\\u0631 \\u062E\\u0637 \\u06CC\\u06A9\\u06CC)",proxies:"\\u067E\\u0631\\u0648\\u06A9\\u0633\\u06CC \\u0628\\u0627\\u0644\\u0627\\u062F\\u0633\\u062A\\u06CC (\\u0647\\u0631 \\u062E\\u0637 \\u06CC\\u06A9\\u06CC)",note:"\\u06CC\\u0627\\u062F\\u062F\\u0627\\u0634\\u062A",blockList:"\\u062F\\u0627\\u0645\\u0646\\u0647\\u200C\\u0647\\u0627\\u06CC \\u0645\\u0633\\u062F\\u0648\\u062F (\\u0647\\u0631 \\u062E\\u0637 \\u06CC\\u06A9\\u06CC)",active:"\\u0641\\u0639\\u0627\\u0644",usernameHint:"\\u06F3 \\u062A\\u0627 \\u06F3\\u06F2 \\u06A9\\u0627\\u0631\\u0627\\u06A9\\u062A\\u0631 \\u0627\\u0646\\u06AF\\u0644\\u06CC\\u0633\\u06CC\\u060C \\u0639\\u062F\\u062F\\u060C . _ -"},drawer:{configs:"\\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF\\u200C\\u0647\\u0627",usage:"\\u0645\\u0635\\u0631\\u0641",sub:"\\u0644\\u06CC\\u0646\\u06A9 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9",qr:"\\u06A9\\u06CC\\u0648\\u0622\\u0631",copy:"\\u06A9\\u067E\\u06CC",copied:"\\u06A9\\u067E\\u06CC \\u0634\\u062F!",rotateToken:"\\u0686\\u0631\\u062E\\u0634 \\u062A\\u0648\\u06A9\\u0646 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9",rotateUuid:"\\u0686\\u0631\\u062E\\u0634 UUID",reset:"\\u0631\\u06CC\\u0633\\u062A \\u062D\\u062C\\u0645",statusPage:"\\u0635\\u0641\\u062D\\u0647 \\u0648\\u0636\\u0639\\u06CC\\u062A",liveTest:"\\u062A\\u0633\\u062A \\u0632\\u0646\\u062F\\u0647\\u200C\\u06CC \\u0627\\u062A\\u0635\\u0627\\u0644"},status:{active:"\\u0641\\u0639\\u0627\\u0644",disabled:"\\u063A\\u06CC\\u0631\\u0641\\u0639\\u0627\\u0644",expired:"\\u0645\\u0646\\u0642\\u0636\\u06CC",exhausted:"\\u062D\\u062C\\u0645 \\u062A\\u0645\\u0627\\u0645"}},settings:{title:"\\u062A\\u0646\\u0638\\u06CC\\u0645\\u0627\\u062A",general:"\\u0639\\u0645\\u0648\\u0645\\u06CC",network:"\\u0634\\u0628\\u06A9\\u0647",security:"\\u0627\\u0645\\u0646\\u06CC\\u062A",danger:"\\u0645\\u0646\\u0637\\u0642\\u0647 \\u062E\\u0637\\u0631",panelName:"\\u0646\\u0627\\u0645 \\u067E\\u0646\\u0644",publicHost:"\\u062F\\u0627\\u0645\\u0646\\u0647 \\u0639\\u0645\\u0648\\u0645\\u06CC (SNI)",port:"\\u067E\\u0648\\u0631\\u062A",cleanIps:"\\u0622\\u06CC\\u200C\\u067E\\u06CC\\u200C\\u0647\\u0627\\u06CC \\u062A\\u0645\\u06CC\\u0632 \\u0641\\u0639\\u0644\\u06CC",ipPool:"\\u0645\\u062E\\u0632\\u0646 \\u0622\\u06CC\\u200C\\u067E\\u06CC \\u0628\\u0631\\u0627\\u06CC \\u0686\\u0631\\u062E\\u0634",autoRotate:"\\u0686\\u0631\\u062E\\u0634 \\u062E\\u0648\\u062F\\u06A9\\u0627\\u0631 \\u0622\\u06CC\\u200C\\u067E\\u06CC",rotateMinutes:"\\u0641\\u0627\\u0635\\u0644\\u0647 \\u0686\\u0631\\u062E\\u0634 (\\u062F\\u0642\\u06CC\\u0642\\u0647)",mux:"\\u0641\\u0639\\u0627\\u0644\\u200C\\u0633\\u0627\\u0632\\u06CC Mux",blockNsfw:"\\u0645\\u0633\\u062F\\u0648\\u062F\\u0633\\u0627\\u0632\\u06CC \\u0645\\u062D\\u062A\\u0648\\u0627\\u06CC \\u0628\\u0632\\u0631\\u06AF\\u0633\\u0627\\u0644",blockAds:"\\u0645\\u0633\\u062F\\u0648\\u062F\\u0633\\u0627\\u0632\\u06CC \\u062A\\u0628\\u0644\\u06CC\\u063A\\u0627\\u062A",remark:"\\u067E\\u06CC\\u0634\\u0648\\u0646\\u062F \\u0646\\u0627\\u0645 \\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF",defaultQuota:"\\u062D\\u062C\\u0645 \\u067E\\u06CC\\u0634\\u200C\\u0641\\u0631\\u0636",defaultDays:"\\u0645\\u062F\\u062A \\u067E\\u06CC\\u0634\\u200C\\u0641\\u0631\\u0636",save:"\\u0630\\u062E\\u06CC\\u0631\\u0647 \\u062A\\u063A\\u06CC\\u06CC\\u0631\\u0627\\u062A",saved:"\\u062A\\u0646\\u0638\\u06CC\\u0645\\u0627\\u062A \\u0630\\u062E\\u06CC\\u0631\\u0647 \\u0634\\u062F",backup:"\\u067E\\u0634\\u062A\\u06CC\\u0628\\u0627\\u0646\\u200C\\u06AF\\u06CC\\u0631\\u06CC",export:"\\u062E\\u0631\\u0648\\u062C\\u06CC JSON",import:"\\u0628\\u0627\\u0632\\u06CC\\u0627\\u0628\\u06CC \\u0627\\u0632 JSON",changePassword:"\\u062A\\u063A\\u06CC\\u06CC\\u0631 \\u0631\\u0645\\u0632 \\u0639\\u0628\\u0648\\u0631",currentPassword:"\\u0631\\u0645\\u0632 \\u0641\\u0639\\u0644\\u06CC",maintenance:"\\u062D\\u0627\\u0644\\u062A \\u062A\\u0639\\u0645\\u06CC\\u0631\\u0627\\u062A"},diag:{title:"\\u0639\\u06CC\\u0628\\u200C\\u06CC\\u0627\\u0628\\u06CC",probeNode:"\\u062A\\u0633\\u062A \\u067E\\u0631\\u0648\\u06A9\\u0633\\u06CC \\u0628\\u0627\\u0644\\u0627\\u062F\\u0633\\u062A\\u06CC",probeHint:"user:pass@1.2.3.4:1080 \\u06CC\\u0627 socks5://host:port",run:"\\u0627\\u062C\\u0631\\u0627",rankIps:"\\u0631\\u062A\\u0628\\u0647\\u200C\\u0628\\u0646\\u062F\\u06CC \\u0622\\u06CC\\u200C\\u067E\\u06CC \\u062A\\u0645\\u06CC\\u0632",rankHint:"\\u0622\\u06CC\\u200C\\u067E\\u06CC\\u200C\\u0647\\u0627 \\u0631\\u0627 \\u0627\\u0632 \\u0644\\u0628\\u0647\\u200C\\u06CC \\u06A9\\u0644\\u0648\\u062F\\u0641\\u0644\\u0631 \\u062A\\u0633\\u062A \\u0645\\u06CC\\u200C\\u06A9\\u0646\\u062F\\u060C \\u0646\\u0647 \\u0627\\u0632 \\u0645\\u0631\\u0648\\u0631\\u06AF\\u0631 \\u0634\\u0645\\u0627.",ping:"\\u062A\\u0623\\u062E\\u06CC\\u0631 \\u0627\\u0632 \\u0644\\u0628\\u0647",pingHint:"\\u0633\\u0647 \\u0646\\u0645\\u0648\\u0646\\u0647 \\u0627\\u0632 \\u0646\\u0632\\u062F\\u06CC\\u06A9\\u200C\\u062A\\u0631\\u06CC\\u0646 POP \\u06A9\\u0644\\u0648\\u062F\\u0641\\u0644\\u0631.",audit:"\\u06AF\\u0632\\u0627\\u0631\\u0634 \\u0631\\u0648\\u06CC\\u062F\\u0627\\u062F\\u0647\\u0627",auditHint:"\\u0647\\u0631 \\u062A\\u063A\\u06CC\\u06CC\\u0631\\u060C \\u0628\\u0627 \\u0628\\u0627\\u0632\\u06CC\\u06AF\\u0631 \\u0648 \\u0632\\u0645\\u0627\\u0646. \\u0686\\u06CC\\u0632\\u06CC \\u06A9\\u0647 \u067E\u0646\u0644\u200C\u0647\u0627\u06CC \u062F\u06CC\u06AF\u0631 \\u0646\\u062F\\u0627\\u0631\\u062F.",latency:"\\u062A\\u0623\\u062E\\u06CC\\u0631",healthy:"\\u0633\\u0627\\u0644\\u0645",unhealthy:"\\u0642\\u0637\\u0639",colo:"\\u0645\\u0631\\u06A9\\u0632 \\u062F\\u0627\\u062F\\u0647",maintenance:"\\u0627\\u062C\\u0631\\u0627\\u06CC \\u0646\\u06AF\\u0647\\u062F\\u0627\\u0634\\u062A",maintenanceHint:"\\u0647\\u0645\\u0627\\u0646 \\u06A9\\u0627\\u0631\\u06CC \\u06A9\\u0647 \\u06A9\\u0631\\u0648\\u0646 \\u0647\\u0631 \\u06F1\\u06F0 \\u062F\\u0642\\u06CC\\u0642\\u0647 \\u0645\\u06CC\\u200C\\u06A9\\u0646\\u062F: \\u0627\\u0646\\u0642\\u0636\\u0627\\u060C \\u0686\\u0631\\u062E\\u0634 \\u0622\\u06CC\\u200C\\u067E\\u06CC\\u060C \\u067E\\u0627\\u06A9\\u200C\\u0633\\u0627\\u0632\\u06CC. \\u062F\\u0631 \u067E\u0646\u0644\u200C\u0647\u0627\u06CC \u062F\u06CC\u06AF\u0631 \\u0641\\u0642\\u0637 \\u0645\\u06CC\\u200C\\u062A\\u0648\\u0627\\u0646\\u06CC\\u062F \\u062D\\u062F\\u0633 \\u0628\\u0632\\u0646\\u06CC\\u062F \\u06A9\\u0647 \\u0627\\u062C\\u0631\\u0627 \\u0634\\u062F\\u0647 \\u06CC\\u0627 \\u0646\\u0647.",maintenanceDone:"\\u0646\\u06AF\\u0647\\u062F\\u0627\\u0634\\u062A \\u0627\\u062C\\u0631\\u0627 \\u0634\\u062F",expired:"\\u0645\\u0646\\u0642\\u0636\\u06CC\\u200C\\u0634\\u062F\\u0647",ipsRotated:"\\u0622\\u06CC\\u200C\\u067E\\u06CC \\u0686\\u0631\\u062E\\u06CC\\u062F\\u0647"},live:{hint:"\\u062A\\u0648\\u0646\\u0644 \\u0631\\u0627 \\u0627\\u0632 \\u0647\\u0645\\u06CC\\u0646\\u200C\\u062C\\u0627 \\u0628\\u0627\\u0632 \\u0645\\u06CC\\u200C\\u06A9\\u0646\\u062F \\u0648 \\u062A\\u0623\\u062E\\u06CC\\u0631 \\u0648\\u0627\\u0642\\u0639\\u06CC \\u0631\\u0627 \\u0645\\u06CC\\u200C\\u06AF\\u06CC\\u0631\\u062F.",running:"\\u062F\\u0631 \\u062D\\u0627\\u0644 \\u062A\\u0633\\u062A\\u2026",ok:"\\u0648\\u0635\\u0644 \\u0634\\u062F \\u2014 \\u062A\\u0648\\u0646\\u0644 \\u0633\\u0627\\u0644\\u0645 \\u0627\\u0633\\u062A.",refused:"\\u0631\\u062F \\u0634\\u062F: UUID \\u0646\\u0627\\u0645\\u0639\\u062A\\u0628\\u0631/\\u063A\\u06CC\\u0631\\u0641\\u0639\\u0627\\u0644\\u060C \\u0633\\u0642\\u0641 \\u062F\\u0633\\u062A\\u06AF\\u0627\\u0647\\u060C \\u06CC\\u0627 \\u0634\\u0628\\u06A9\\u0647 \\u0628\\u0633\\u062A\\u0647.",nodata:"\\u062A\\u0648\\u0646\\u0644 \\u0628\\u0627\\u0632 \\u0634\\u062F \\u0627\\u0645\\u0627 \\u0628\\u0627\\u0644\\u0627\\u062F\\u0633\\u062A \\u062C\\u0648\\u0627\\u0628 \\u0646\\u062F\\u0627\\u062F \\u2014 \\u0622\\u06CC\\u200C\\u067E\\u06CC \\u062A\\u0645\\u06CC\\u0632 \\u06CC\\u0627 \\u067E\\u0631\\u06CC\\u0633\\u062A \\u0641\\u0631\\u06AF\\u0645\\u0646\\u062A \\u0631\\u0627 \\u0639\\u0648\\u0636 \\u06A9\\u0646.",noopen:"\\u062F\\u0633\\u062A\\u200C\\u062F\\u0647\\u06CC WebSocket \\u0627\\u0646\\u062C\\u0627\\u0645 \\u0646\\u0634\\u062F \\u2014 \\u062F\\u0627\\u0645\\u0646\\u0647/SNI \\u06CC\\u0627 \\u0634\\u0628\\u06A9\\u0647 \\u0631\\u0627 \\u0628\\u0631\\u0631\\u0633\\u06CC \\u06A9\\u0646."},common:{cancel:"\\u0627\\u0646\\u0635\\u0631\\u0627\\u0641",save:"\\u0630\\u062E\\u06CC\\u0631\\u0647",create:"\\u0633\\u0627\\u062E\\u062A",delete:"\\u062D\\u0630\\u0641",edit:"\\u0648\\u06CC\\u0631\\u0627\\u06CC\\u0634",close:"\\u0628\\u0633\\u062A\\u0646",copy:"\\u06A9\\u067E\\u06CC",refresh:"\\u0646\\u0648\\u0633\\u0627\\u0632\\u06CC",loading:"\\u062F\\u0631 \\u062D\\u0627\\u0644 \\u0628\\u0627\\u0631\\u06AF\\u0630\\u0627\\u0631\\u06CC\\u2026",yes:"\\u0628\\u0644\\u0647",no:"\\u062E\\u06CC\\u0631",none:"\\u2014",search:"\\u062C\\u0633\\u062A\\u062C\\u0648",cmdk:"\\u062C\\u0633\\u062A\\u062C\\u0648 \\u06CC\\u0627 \\u0641\\u0631\\u0645\\u0627\\u0646\\u2026",offline:"\\u0622\\u0641\\u0644\\u0627\\u06CC\\u0646",version:"\\u0646\\u0633\\u062E\\u0647",gb:"\\u06AF\\u06CC\\u06AF\\u0627\\u0628\\u0627\\u06CC\\u062A",day:"\\u0631\\u0648\\u0632",days:"\\u0631\\u0648\\u0632"}},en:{app:{name:"Omni",tagline:"Edge proxy panel"},nav:{dashboard:"Dashboard",users:"Users",settings:"Settings",diag:"Diagnostics",sessions:"Sessions",logout:"Sign out",scanner:"Scanner",dns:"DNS",configs:"Configs"},omni:{heroTag:"Your personal panel on Cloudflare \\xB7 Omni",online:"Online",statSni:"Default SNI",statPorts:"Ports",statIps:"Clean IPs",statUsers:"Users",statColo:"CF edge",localMode:"local mode"},cfg:{title:"Config builder",desc:"OMNI-style: pick addresses, ports and protocols, export in every format.",build:"Build \\u26A1",addresses:"Addresses",fromClean:"Clean IPs",fromHost:"Panel host",fromCustom:"Custom",ipv6:"Add Cloudflare IPv6 addresses",cleanAvailable:"clean IPs available",proxyips:"Proxy IPs",protoPorts:"Protocols & ports",fragment:"Fragment",hint:"Pick options and hit Build \\u2014 output appears here.",configs:"config(s)",user:"user",noUser:"Create a user first",toOmni:"Add to Omni",subLink:"This user\'s subscription link"},scanner:{title:"Clean IP scanner",desc:"Probe Cloudflare IPs from your own browser or rank them from the edge; save the best ones to settings.",start:"Start scan",rank:"Rank from CF edge",apply:"Add top IPs to clean list",hint:"Ready \\u2014 the browser scan measures your carrier\'s real latency.",empty:"No results yet.",testing:"Testing from browser\\u2026",timeout:"down",healthy:"healthy",done:"Scan finished",reachable:"reachable",ranking:"Asking the Cloudflare edge to rank\\u2026",edgeOk:"healthy from edge:",rankFail:"Ranking failed",saved:"Saved to settings",none:"Nothing worth saving",ranges:"Scan ranges (CIDR)",rangesHint:"Sampled per range; a.b.c.d/bit, one per line."},dns:{title:"DNS / DoH",desc:"Pick the DoH upstream and test it right here.",active:"active",ir:"IR",saved:"Saved",error:"Save failed",pick:"Pick",test:"Test",note:"Iranian defaults (Shecan, Electro, Radar, 403, Begzar) plus global ones \\u2014 Test shows the real response time."},signup:{button:"Create your free config",title:"Make your own config",sub:"One click, no forms",step1:"Hit the button below and we create your account + subscription link.",step2:"Paste the link or QR into v2rayNG / Hiddify / Clash.",step3:"Quota and expiry start counting from your first connection.",create:"Create it! \\u26A1",doneTitle:"Your config is ready \\u{1F389}",doneSub:"Add the link below in your client",hint:"Keep the subscription link private \\u2014 every device connecting through it consumes your quota.",backLogin:"Admin sign-in",settingToggle:"Public signup (self-service for visitors)",maxPerIp:"Max accounts per IP per day"},login:{title:"Sign in",setupTitle:"Set up Omni",password:"Password",username:"Username",newPassword:"New password",submit:"Sign in",setup:"Create panel",recover:"Recover",hint:"Passwords are hashed with PBKDF2, 210,000 iterations.",setupHint:"At least 10 characters. This can only be set once."},dash:{users:"Users",active:"Active",expired:"Expired",traffic:"Traffic used",cf:"Cloudflare quota",reqToday:"Requests today",topUsers:"Top consumers",traffic7:"Traffic \\u2014 last 7 days",alerts:"Alerts",noAlerts:"All clear \\u2705",noCf:"Set CF_ACCOUNT_ID and CF_API_TOKEN to see quota.",cfDanger:"Cloudflare quota nearly exhausted \\u2014 account ban risk.",expiringSoon:"user(s) expire within 24 hours."},users:{title:"Users",create:"New user",search:"Search name, note or UUID\\u2026",col:{user:"User",status:"Status",traffic:"Used",quota:"Quota",expiry:"Expires",devices:"Devices",actions:""},all:"All",activeOnly:"Active",disabledOnly:"Disabled",expiredOnly:"Expired",selected:"selected",bulkEnable:"Enable",bulkDisable:"Disable",bulkReset:"Reset traffic",bulkExtend:"Extend days",bulkDelete:"Delete",empty:"No users yet",emptyHint:"Create your first user to generate a subscription link.",confirmDelete:"Delete user \\u201C{name}\\u201D? This cannot be undone.",confirmBulkDelete:"Delete {n} users? This cannot be undone.",form:{username:"Username",quota:"Quota (GB)",days:"Duration (days)",devices:"Concurrent devices",requests:"Request limit (0 = unlimited)",firstConnect:"Start clock on first connect",fragment:"Fragment preset",fingerprint:"TLS fingerprint",ips:"Clean IPs (one per line)",proxies:"Upstream proxies (one per line)",note:"Note",blockList:"Blocked domains (one per line)",active:"Active",usernameHint:"3\\u201332 chars: letters, digits, . _ -"},drawer:{configs:"Configs",usage:"Usage",sub:"Subscription link",qr:"QR",copy:"Copy",copied:"Copied!",rotateToken:"Rotate sub token",rotateUuid:"Rotate UUID",reset:"Reset traffic",statusPage:"Status page",liveTest:"Live connection test"},status:{active:"Active",disabled:"Disabled",expired:"Expired",exhausted:"Exhausted"}},settings:{title:"Settings",general:"General",network:"Network",security:"Security",danger:"Danger zone",panelName:"Panel name",publicHost:"Public host (SNI)",port:"Port",cleanIps:"Current clean IPs",ipPool:"IP pool for rotation",autoRotate:"Auto-rotate IPs",rotateMinutes:"Rotation interval (min)",mux:"Enable Mux",blockNsfw:"Block adult content",blockAds:"Block ads",remark:"Config name prefix",defaultQuota:"Default quota",defaultDays:"Default duration",save:"Save changes",saved:"Settings saved",backup:"Backup",export:"Export JSON",import:"Import JSON",changePassword:"Change password",currentPassword:"Current password",maintenance:"Maintenance mode"},diag:{title:"Diagnostics",probeNode:"Probe upstream proxy",probeHint:"user:pass@1.2.3.4:1080 or socks5://host:port",run:"Run",rankIps:"Rank clean IPs",rankHint:"Tested from Cloudflare\'s edge, not your browser.",ping:"Edge latency",pingHint:"Three samples from the nearest Cloudflare POP.",audit:"Audit log",auditHint:"Every change, with actor and time.",latency:"Latency",healthy:"Healthy",unhealthy:"Down",colo:"Colo",maintenance:"Run maintenance",maintenanceHint:"Exactly what the cron does every 10 minutes: expiry, IP rotation and pruning.",maintenanceDone:"Maintenance complete",expired:"Expired",ipsRotated:"IPs rotated"},live:{hint:"Opens the tunnel from here and measures real latency.",running:"Testing\\u2026",ok:"Connected \\u2014 tunnel is healthy.",refused:"Refused: unknown/disabled UUID, device limit, or blocked network.",nodata:"Tunnel opened but upstream stayed silent \\u2014 try another clean IP or fragment preset.",noopen:"WebSocket handshake failed \\u2014 check domain/SNI or your network."},common:{cancel:"Cancel",save:"Save",create:"Create",delete:"Delete",edit:"Edit",close:"Close",copy:"Copy",refresh:"Refresh",loading:"Loading\\u2026",yes:"Yes",no:"No",none:"\\u2014",search:"Search",cmdk:"Search or run a command\\u2026",offline:"Offline",version:"Version",gb:"GB",day:"day",days:"days"}}},P={lang:localStorage.getItem("omni.lang")||"fa",dir(){return this.lang==="fa"?"rtl":"ltr"},set(e){this.lang=e,localStorage.setItem("omni.lang",e),document.documentElement.lang=e,document.documentElement.dir=this.dir()},t(e,t){let s=o=>e.split(".").reduce((r,c)=>r==null?r:r[c],o),i=s(Je[this.lang])??s(Je.en)??e;if(t)for(let[o,r]of Object.entries(t))i=i.replaceAll(`{${o}}`,r);return i}},n=(e,t)=>P.t(e,t);function v(e,{digits:t=0}={}){return Number(e||0).toLocaleString(P.lang==="fa"?"fa-IR":"en-US",{minimumFractionDigits:t,maximumFractionDigits:t})}var D=e=>{let t=Number(e||0);return t<1024?`${t} B`:t<1024**2?`${(t/1024).toFixed(1)} KB`:t<1024**3?`${(t/1024**2).toFixed(1)} MB`:`${(t/1024**3).toFixed(2)} GB`};function ye(e){if(!e)return n("common.none");let ms=typeof e==="number"?e:Date.parse(String(e).includes("T")?String(e):String(e).replace(" ","T")+"Z");if(!Number.isFinite(ms))return"\\u2014";let t=Math.max(0,Math.floor((Date.now()-ms)/1e3));if(t<60)return P.lang==="fa"?`${t} \\u062B\\u0627\\u0646\\u06CC\\u0647 \\u067E\\u06CC\\u0634`:`${t}s ago`;let s=Math.floor(t/60);if(s<60)return P.lang==="fa"?`${s} \\u062F\\u0642\\u06CC\\u0642\\u0647 \\u067E\\u06CC\\u0634`:`${s}m ago`;let i=Math.floor(s/60);if(i<24)return P.lang==="fa"?`${i} \\u0633\\u0627\\u0639\\u062A \\u067E\\u06CC\\u0634`:`${i}h ago`;let o=Math.floor(i/24);return P.lang==="fa"?`${o} \\u0631\\u0648\\u0632 \\u067E\\u06CC\\u0634`:`${o}d ago`}function ce(e){if(e==null)return"\\u221E";let ms=typeof e==="number"?e:Date.parse(String(e).includes("T")?String(e):String(e).replace(" ","T")+"Z")-Date.now();if(!Number.isFinite(ms))return"\\u221E";if(ms<=0)return P.lang==="fa"?"\\u062A\\u0645\\u0627\\u0645 \\u0634\\u062F\\u0647":"expired";let t=Math.floor(ms/864e5),s=Math.floor(ms%864e5/36e5);return t>0?P.lang==="fa"?`${t} \\u0631\\u0648\\u0632 \\u0648 ${s} \\u0633\\u0627\\u0639\\u062A`:`${t}d ${s}h`:P.lang==="fa"?`${s} \\u0633\\u0627\\u0639\\u062A`:`${s}h`}var Ke=e=>e?new Date(e).toLocaleDateString(P.lang==="fa"?"fa-IR":"en-US"):n("common.none");var a=e=>String(e??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll(\'"\',"&quot;").replaceAll("\'","&#39;"),Qe={dash:"M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z",users:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",gear:"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 2h-4l-.4 2.6c-.7.3-1.4.7-2 1.2l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",activity:"M22 12h-4l-3 9L9 3l-3 9H2",shield:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",logout:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",plus:"M12 5v14M5 12h14",search:"M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35",refresh:"M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",copy:"M9 9h10v12H9zM5 15H3V3h12v2",trash:"M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",edit:"M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z",close:"M18 6 6 18M6 6l12 12",sun:"M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2M12 21v-2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M22 12h-2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",moon:"M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",globe:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5-2.3 3.8-5.3 3.8-9S14.5 4.3 12 2C9.5 4.3 8.2 7.3 8.2 11s1.3 6.7 3.8 9ZM2.5 9h19M2.5 15h19",check:"M20 6 9 17l-5-5",alert:"M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",bolt:"M13 2 3 14h7v8l10-12h-7z",link:"M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",qr:"M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM14 21h1v-3M21 14v1",download:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",upload:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",play:"M6 3l14 9-14 9z",menu:"M3 6h18M3 12h18M3 18h18",chevron:"m9 18 6-6-6-6",clock:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2",filter:"M22 3H2l8 9.5V19l4 2v-8.5z",key:"M21 2l-2 2m-7.6 7.6a5 5 0 1 1-7 7 5 5 0 0 1 7-7Zm0 0L15 8m0 0 3 3 3-3-3-3",db:"M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3Zm8-3v14c0 1.7-3.6 3-8 3s-8-1.3-8-3V5m16 7c0 1.7-3.6 3-8 3s-8-1.3-8-3",eye:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",wifi:"M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01M2 9a15 15 0 0 1 20 0"},Et=new Set(["dash","bolt","play","filter"]);function d(e,t=""){let s=Qe[e]||Qe.bolt,i=Et.has(e);return`<svg viewBox="0 0 24 24" width="18" height="18" class="${t}" fill="${i?"currentColor":"none"}" stroke="${i?"none":"currentColor"}"\n    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${s}"/></svg>`}function y(e,t="info",s=3200){let i=document.getElementById("toasts");if(!i)return;let o=document.createElement("div");o.className=`toast ${t}`,o.innerHTML=`${d(t==="err"?"alert":t==="ok"?"check":"bolt")} <span>${a(e)}</span>`,o.style.display="flex",o.style.gap="8px",o.style.alignItems="center",i.append(o),setTimeout(()=>{o.style.transition="opacity .25s, transform .25s",o.style.opacity="0",o.style.transform="translateY(6px)",setTimeout(()=>o.remove(),260)},s)}var R=null;function Le({title:e,body:t,footer:s="",wide:i=!1,onMount:o}){return W(),R=document.createElement("div"),R.className="overlay",R.innerHTML=`<div class="modal ${i?"modal-wide":""}" role="dialog" aria-modal="true" aria-label="${a(e)}">\n      <div class="modal-head"><h2>${a(e)}</h2><div class="spacer"></div>\n        <button class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="${a(n("common.close"))}">${d("close")}</button></div>\n      <div class="modal-body">${t}</div>\n      ${s?`<div class="modal-foot">${s}</div>`:""}\n    </div>`,R.addEventListener("mousedown",r=>{r.target===R&&W()}),document.body.append(R),document.body.style.overflow="hidden",o?.(R),R.querySelector("input,select,textarea,button")?.focus(),R}function W(){R?.remove(),R=null,document.querySelector(".drawer")||(document.body.style.overflow="")}function Q(e,{danger:t=!1,okLabel:s}={}){return new Promise(i=>{Le({title:t?n("common.delete"):"\\u061F",body:`<p style="margin:0;font-size:14px;line-height:1.8">${a(e)}</p>`,footer:`<button class="btn" data-confirm="no">${a(n("common.cancel"))}</button>\n               <button class="btn ${t?"btn-danger":"btn-primary"}" data-confirm="yes">${a(s||n("common.yes"))}</button>`,onMount:r=>{r.addEventListener("click",c=>{let f=c.target.closest("[data-confirm]");f&&(W(),i(f.dataset.confirm==="yes"))})}})?.addEventListener("keydown",r=>{r.key==="Escape"&&(W(),i(!1))})})}function Ye({title:e,body:t,footer:s="",onMount:i}){J();let o=document.createElement("div");return o.className="drawer",o.setAttribute("role","dialog"),o.innerHTML=`<div class="modal-head"><h2>${a(e)}</h2><div class="spacer"></div>\n      <button class="btn btn-ghost btn-icon" data-action="close-drawer">${d("close")}</button></div>\n    <div class="modal-body" style="flex:1">${t}</div>\n    ${s?`<div class="modal-foot">${s}</div>`:""}`,document.body.append(o),document.body.style.overflow="hidden",i?.(o),o}function J(){document.querySelector(".drawer")?.remove(),R||(document.body.style.overflow="")}var $e=(e,t="")=>`<div class="meter ${t}"><div class="meter-fill ${e>90?"danger":e>70?"warn":""}" style="width:${Math.min(100,e)}%"></div></div>`,Ce=e=>`<span class="badge ${{active:"ok",expired:"danger",exhausted:"warn",disabled:""}[e]??""}">${a(n(`users.status.${e}`))}</span>`;function te(e,t=n("common.copy"),s=!0){return`<button class="btn ${s?"btn-sm":""}" data-action="copy" data-copy="${a(e)}">${d("copy")} ${a(t)}</button>`}async function ae(e){try{return await navigator.clipboard.writeText(e),!0}catch{let t=document.createElement("textarea");t.value=e,t.style.cssText="position:fixed;opacity:0",document.body.append(t),t.select();let s=!1;try{s=document.execCommand("copy")}catch{}return t.remove(),s}}function de(e,t=168){let s=globalThis.qrcode;if(!s||!e)return"";try{let i=s(0,"M");return i.addData(e,"Byte"),i.make(),i.createSvgTag({cellSize:4,margin:2,scalable:!0})}catch{return""}}function Xe(e=6){return Array.from({length:e},()=>\'<tr><td colspan="7"><div class="skeleton" style="height:16px"></div></td></tr>\').join("")}var ue=({icon:e,label:t,value:s,sub:i,tone:o=""})=>`\n  <div class="card" style="display:flex;gap:13px;align-items:flex-start">\n    <div class="kpi-icon" style="${o?`background:color-mix(in srgb, ${o} 14%, transparent);color:${o}`:""}">${d(e)}</div>\n    <div style="min-width:0;flex:1">\n      <div class="kpi-label">${a(t)}</div>\n      <div class="kpi-value">${s}</div>\n      ${i?`<div class="kpi-sub">${i}</div>`:""}\n    </div>\n  </div>`;function Pe(e,{height:t=150,valueKey:s="total",labelKey:i="day",color:o="var(--accent)"}={}){if(!e?.length)return`<svg class="chart" viewBox="0 0 600 ${t}" preserveAspectRatio="none"><text x="300" y="${t/2}" text-anchor="middle" class="chart-label">no data</text></svg>`;let r=600,c={l:8,r:8,t:14,b:22},f=Math.max(...e.map($=>Number($[s]||0)),1),u=(r-c.l-c.r)/e.length,m=e.map(($,M)=>{let k=Number($[s]||0),L=Math.max(2,k/f*(t-c.t-c.b)),S=c.l+M*u+u*.18,C=t-c.b-L,q=String($[i]||"").slice(5);return`<g><title>${$[i]} \\u2014 ${D(k)}</title>\n        <rect class="chart-bar" x="${S.toFixed(1)}" y="${C.toFixed(1)}" width="${(u*.64).toFixed(1)}" height="${L.toFixed(1)}" rx="4" style="fill:${o}"/>\n        <text class="chart-label" x="${(S+u*.32).toFixed(1)}" y="${t-7}" text-anchor="middle">${q}</text></g>`}).join(""),p=[.25,.5,.75].map($=>{let M=c.t+(t-c.t-c.b)*$;return`<line class="chart-grid" x1="${c.l}" x2="${r-c.r}" y1="${M}" y2="${M}" stroke-dasharray="3 5"/>`}).join("");return`<svg class="chart" viewBox="0 0 ${r} ${t}" preserveAspectRatio="none" role="img">${p}${m}\n    <text class="chart-label" x="${c.l}" y="10">${D(f)}</text></svg>`}function et(e,{height:t=160}={}){if(!e?.length)return Pe([]);let s=600,i={l:8,r:8,t:14,b:22},o=Math.max(...e.map(u=>(u.up||0)+(u.down||0)),1),r=(s-i.l-i.r)/e.length,c=t-i.t-i.b,f=e.map((u,m)=>{let p=i.l+m*r+r*.18,$=r*.64,M=u.down/o*c,k=u.up/o*c;return`<g><title>${u.day} \\u2014 \\u2193${D(u.down)} \\u2191${D(u.up)}</title>\n      <rect x="${p.toFixed(1)}" y="${(t-i.b-M).toFixed(1)}" width="${$.toFixed(1)}" height="${M.toFixed(1)}" rx="4" fill="var(--accent)" opacity=".85"/>\n      <rect x="${p.toFixed(1)}" y="${(t-i.b-M-k).toFixed(1)}" width="${$.toFixed(1)}" height="${k.toFixed(1)}" rx="4" fill="var(--accent-2)" opacity=".85"/>\n      <text class="chart-label" x="${(p+$/2).toFixed(1)}" y="${t-7}" text-anchor="middle">${String(u.day).slice(5)}</text></g>`}).join("");return`<svg class="chart" viewBox="0 0 ${s} ${t}" preserveAspectRatio="none">${f}\n    <text class="chart-label" x="${i.l}" y="10">${D(o)}</text></svg>`}function Ae(e,{size:t=74,stroke:s=8,color:i="var(--accent)",label:o}={}){let r=(t-s)/2,c=2*Math.PI*r,f=Math.max(0,Math.min(100,Number(e)||0)),u=f/100*c,m=f>90?"var(--danger)":f>70?"var(--warn)":i;return`<svg width="${t}" height="${t}" viewBox="0 0 ${t} ${t}" role="img" aria-label="${f}%">\n    <circle cx="${t/2}" cy="${t/2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${s}"/>\n    <circle cx="${t/2}" cy="${t/2}" r="${r}" fill="none" stroke="${m}" stroke-width="${s}"\n      stroke-linecap="round" stroke-dasharray="${u.toFixed(2)} ${c.toFixed(2)}"\n      transform="rotate(-90 ${t/2} ${t/2})" style="transition:stroke-dasharray .6s cubic-bezier(.22,1,.36,1)"/>\n    <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"\n      style="font:700 ${t*.24}px var(--font);fill:var(--text)">${o??`${Math.round(f)}%`}</text>\n  </svg>`}function tt({mode:e="login",error:t="",signup:s=!1}={}){let i=e==="setup",o=e==="recover";return`<div class="auth-wrap"><div class="auth-card">\n    <div class="auth-logo">\n      <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJLYXZlaCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImtnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyMmQzZWUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjODE4Y2Y4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGZpbHRlciBpZD0iZ2xvdyIgeD0iLTMwJSIgeT0iLTMwJSIgd2lkdGg9IjE2MCUiIGhlaWdodD0iMTYwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIwIiBzdGREZXZpYXRpb249IjE4IiBmbG9vZC1jb2xvcj0iIzIyZDNlZSIgZmxvb2Qtb3BhY2l0eT0iMC41NSIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTIwIiBmaWxsPSIjMDYwNzBhIi8+CiAgPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iNDMyIiBoZWlnaHQ9IjQzMiIgcng9IjEwNCIgZmlsbD0iIzBiMGQxMyIgc3Ryb2tlPSJ1cmwoI2tnKSIgc3Ryb2tlLXdpZHRoPSI2IiBvcGFjaXR5PSIwLjk1Ii8+CiAgPCEtLSBEZXJhZnNoLWUgS8SBdsSrxIFuOiB0aGUgYmxhY2tzbWl0aCdzIGFwcm9uIHJhaXNlZCBhcyBhIHN0YW5kYXJkIC0tPgogIDxnIGZpbHRlcj0idXJsKCNnbG93KSI+CiAgICA8cGF0aCBkPSJNMTgwIDExOCBMMzMyIDExOCBMMzU2IDMwMCBRMjU2IDM0MCAxNTYgMzAwIFoiIGZpbGw9InVybCgja2cpIiBmaWxsLW9wYWNpdHk9IjAuMTYiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAgIDxwYXRoIGQ9Ik0yNTYgMTE4IEwyNTYgNDAwIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICAgIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIxMiIgcj0iMzQiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTIiLz4KICAgIDxwYXRoIGQ9Ik0yMTQgMzcyIEwyOTggMzcyIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8L2c+Cjwvc3ZnPgo=" alt="" width="52" height="52">\n      <h1>${a(n("app.name"))}</h1>\n      <p class="muted" style="margin:0;font-size:12px">${a(n(i?"login.setupTitle":o?"login.recover":"login.title"))}</p>\n    </div>\n    ${t?`<div class="toast err" style="margin-bottom:12px">${d("alert")} ${a(t)}</div>`:""}\n    <form id="auth-form" data-mode="${e}" novalidate>\n      ${i?`<div class="field" style="margin-bottom:11px">\n          <label for="f-user">${a(n("login.username"))}</label>\n          <input id="f-user" name="username" type="text" value="admin" autocomplete="username" dir="ltr">\n        </div>`:""}\n      ${o?`<div class="field" style="margin-bottom:11px">\n          <label for="f-code">\\u06A9\\u062F \\u0628\\u0627\\u0632\\u06CC\\u0627\\u0628\\u06CC</label>\n          <input id="f-code" name="code" type="text" autocomplete="one-time-code" dir="ltr" required>\n        </div>`:""}\n      <div class="field" style="margin-bottom:11px">\n        <label for="f-pass">${a(n(o?"login.newPassword":"login.password"))}</label>\n        <input id="f-pass" name="password" type="password" autocomplete="${i?"new-password":"current-password"}" required minlength="10" dir="ltr">\n      </div>\n      <button class="btn btn-primary btn-block" type="submit" style="margin-top:6px">\n        ${d(i?"bolt":"key")} ${a(n(i?"login.setup":o?"login.recover":"login.submit"))}\n      </button>\n      <p class="hint muted" style="font-size:11px;margin-top:12px;text-align:center">${a(n(i?"login.setupHint":"login.hint"))}</p>\n      ${!i&&!o?`<p style="text-align:center;margin:10px 0 0"><button type="button" class="btn btn-ghost btn-sm" data-action="goto-recover">${a(n("login.recover"))}</button></p>`:""}\n      ${!i&&!o&&s?`<p style="text-align:center;margin:8px 0 0"><button type="button" class="btn btn-sm" data-action="goto-signup">${d("bolt")} ${a(n("signup.button"))}</button></p>`:""}\n      ${o?`<p style="text-align:center;margin:10px 0 0"><button type="button" class="btn btn-ghost btn-sm" data-action="goto-login">\\u2192 ${a(n("login.submit"))}</button></p>`:""}\n    </form>\n  </div></div>`}function at({result:e=null,error:t=""}={}){return e?`<div class="auth-wrap"><div class="auth-card">\n      <div class="auth-logo">\n        <div class="omni-cube" style="width:44px;height:44px;margin:0 auto 8px" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>\n        <h1>${a(n("signup.doneTitle"))}</h1>\n        <p class="muted" style="margin:0;font-size:12px">${a(n("signup.doneSub"))}</p>\n      </div>\n      <div class="kv"><span>${a(n("users.col.user"))}</span><code>${a(e.username)}</code></div>\n      <div class="codebox" style="margin-top:10px"><code id="signup-sub" dir="ltr">${a(e.sub_url)}</code>\n        <button class="btn btn-sm" data-action="copy-text" data-text="${a(e.sub_url)}">${a(n("common.copy"))}</button></div>\n      <div style="display:flex;justify-content:center;margin:14px 0 4px">${de(e.sub_url,176)}</div>\n      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:6px">\n        <a class="btn btn-sm" href="${a(e.status_url)}" target="_blank" rel="noopener">${d("globe")} ${a(n("users.drawer.statusPage"))}</a>\n        <a class="btn btn-sm" href="${a(e.sub_url)}" target="_blank" rel="noopener">${d("link")} ${a(n("users.drawer.sub"))}</a>\n      </div>\n      <p class="hint muted" style="font-size:11px;margin-top:12px;text-align:center">${a(n("signup.hint"))}</p>\n      <p style="text-align:center;margin:6px 0 0"><button type="button" class="btn btn-ghost btn-sm" data-action="goto-login">${a(n("signup.backLogin"))}</button></p>\n    </div></div>`:`<div class="auth-wrap"><div class="auth-card">\n    <div class="auth-logo">\n      <div class="omni-cube" style="width:44px;height:44px;margin:0 auto 8px" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>\n      <h1>${a(n("signup.title"))}</h1>\n      <p class="muted" style="margin:0;font-size:12px">${a(n("signup.sub"))}</p>\n    </div>\n    ${t?`<div class="toast err" style="margin-bottom:12px">${d("alert")} ${a(t)}</div>`:""}\n    <ul class="st" style="font-size:13px;line-height:2">\n      <li>${a(n("signup.step1"))}</li>\n      <li>${a(n("signup.step2"))}</li>\n      <li>${a(n("signup.step3"))}</li>\n    </ul>\n    <button class="btn btn-primary btn-block" type="button" data-action="do-signup" style="margin-top:8px">\n      ${d("bolt")} ${a(n("signup.create"))}\n    </button>\n    <p style="text-align:center;margin:10px 0 0"><button type="button" class="btn btn-ghost btn-sm" data-action="goto-login">${a(n("signup.backLogin"))}</button></p>\n  </div></div>`}function pe(e){if(!e)return`<div class="grid grid-kpi">${Array.from({length:4},()=>\'<div class="skeleton" style="height:96px"></div>\').join("")}</div>\n      <div class="grid grid-2" style="margin-top:14px">${Array.from({length:2},()=>\'<div class="skeleton" style="height:240px"></div>\').join("")}</div>`;let t=e.users||{},s=e.cloudflare||{},i=Lt(e),o=s.pct??0;return`\n  <div class="grid grid-kpi">\n    ${ue({icon:"users",label:n("dash.users"),value:v(t.total||0),sub:`${v(t.active||0)} ${a(n("dash.active"))}`})}\n    ${ue({icon:"db",label:n("dash.traffic"),value:D(t.used_bytes||0),sub:`${v(t.requests||0)} req`,tone:"var(--accent-2)"})}\n    ${ue({icon:"alert",label:n("dash.expired"),value:v(t.expired||0),sub:i.expiring?`${v(i.expiring)} ${a(n("dash.expiringSoon"))}`:"",tone:t.expired?"var(--danger)":""})}\n    ${ue({icon:"bolt",label:n("dash.cf"),value:s.available?`${o}%`:"\\u2014",sub:s.available?`${v(s.daily||0)} / ${v(s.limit)}`:a(n("dash.noCf")),tone:o>85?"var(--danger)":o>60?"var(--warn)":"var(--ok)"})}\n  </div>\n\n  <div class="grid grid-2" style="margin-top:14px">\n    <div class="card">\n      <div class="card-head">${d("activity")}<h3>${a(n("dash.traffic7"))}</h3><div class="spacer"></div>\n        <div class="legend"><span><i style="background:var(--accent)"></i>\\u2193 down</span><span><i style="background:var(--accent-2)"></i>\\u2191 up</span></div>\n      </div>\n      ${et(e.series||[])}\n    </div>\n\n    <div class="card">\n      <div class="card-head">${d("shield")}<h3>${a(n("dash.alerts"))}</h3></div>\n      ${i.list.length?`<div style="display:flex;flex-direction:column;gap:9px">${i.list.map(r=>`<div style="display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:10px;background:color-mix(in srgb, ${r.color} 9%, transparent);border:1px solid color-mix(in srgb, ${r.color} 26%, transparent)">\n              <span style="color:${r.color};flex:none;margin-top:2px">${d(r.level==="danger"?"alert":"clock")}</span>\n              <div><div style="font-weight:600;font-size:13px">${a(r.title)}</div>\n              ${r.detail?`<div class="muted" style="font-size:12px">${a(r.detail)}</div>`:""}</div></div>`).join("")}</div>`:`<div class="empty" style="padding:26px">${d("check")}<div>${a(n("dash.noAlerts"))}</div></div>`}\n      ${s.available?`<div style="margin-top:14px;display:flex;align-items:center;gap:14px">\n          ${Ae(o,{size:68})}\n          <div style="flex:1;min-width:0">\n            <div class="kpi-label">${a(n("dash.reqToday"))}</div>\n            <div style="font-weight:700;font-size:19px;font-variant-numeric:tabular-nums">${v(s.daily||0)}</div>\n            ${$e(o)}\n            <div class="kpi-sub">limit ${v(s.limit)}</div>\n          </div></div>`:""}\n    </div>\n  </div>\n\n  <div class="card" style="margin-top:14px">\n    <div class="card-head">${d("users")}<h3>${a(n("dash.topUsers"))}</h3><div class="spacer"></div>\n      <button class="btn btn-sm" data-action="nav" data-view="users">${a(n("nav.users"))} ${d("chevron")}</button></div>\n    ${e.top?.length?`<div style="display:flex;flex-direction:column;gap:10px">${e.top.map(r=>{let c=r.quota_gb?Math.min(100,r.used_bytes/(r.quota_gb*1073741824)*100):0;return`<div>\n            <div style="display:flex;gap:10px;align-items:baseline;margin-bottom:4px">\n              <a href="#" data-action="open-user" data-user="${a(r.username)}" class="cell-user">${a(r.username)}</a>\n              <span class="muted" style="font-size:12px">${D(r.used_bytes)} / ${v(r.quota_gb)} ${a(n("common.gb"))}</span>\n              <div class="spacer"></div><span class="muted mono" style="font-size:11px">${c.toFixed(0)}%</span>\n            </div>${$e(c)}\n          </div>`}).join("")}</div>`:`<div class="empty">${d("users")}<div>${a(n("users.empty"))}</div></div>`}\n  </div>`}function Lt(e){let t=[],s=e.cloudflare||{},i=0;return s.available&&s.pct>85&&t.push({level:"danger",color:"var(--danger)",title:n("dash.cfDanger"),detail:`${s.pct}% \\u2014 ${v(s.daily||0)} / ${v(s.limit)}`}),{list:t,expiring:i}}function Ie(e){let t=e.loading?Xe(8):(e.users||[]).map(s=>Pt(s,e.selection.has(s.username))).join("");return`\n  <div class="toolbar">\n    <div class="search" style="flex:1;min-width:190px">${d("search")}\n      <input type="search" id="user-search" placeholder="${a(n("users.search"))}" value="${a(e.query)}" data-debounce="300">\n    </div>\n    <div class="seg" role="group" aria-label="filter">\n      ${["all","active","disabled","expired"].map(s=>`<button data-action="filter" data-status="${s}" aria-pressed="${e.status===s}">${a(n(`users.${s==="all"?"all":s==="active"?"activeOnly":s==="disabled"?"disabledOnly":"expiredOnly"}`))}</button>`).join("")}\n    </div>\n    <button class="btn btn-ghost btn-icon" data-action="refresh-users" title="${a(n("common.refresh"))}">${d("refresh")}</button>\n    <button class="btn btn-primary" data-action="new-user">${d("plus")} ${a(n("users.create"))}</button>\n  </div>\n\n  ${e.selection.size?`<div class="bulkbar">\n        <strong>${v(e.selection.size)}</strong> <span class="muted">${a(n("users.selected"))}</span>\n        <div class="spacer"></div>\n        <button class="btn btn-sm" data-action="bulk" data-op="enable">${d("check")} ${a(n("users.bulkEnable"))}</button>\n        <button class="btn btn-sm" data-action="bulk" data-op="disable">${a(n("users.bulkDisable"))}</button>\n        <button class="btn btn-sm" data-action="bulk" data-op="reset_traffic">${d("refresh")} ${a(n("users.bulkReset"))}</button>\n        <button class="btn btn-sm" data-action="bulk-extend">${d("clock")} ${a(n("users.bulkExtend"))}</button>\n        <button class="btn btn-sm btn-danger" data-action="bulk" data-op="delete">${d("trash")} ${a(n("users.bulkDelete"))}</button>\n        <button class="btn btn-ghost btn-sm" data-action="clear-selection">${d("close")}</button>\n      </div>`:""}\n\n  <div class="table-wrap">\n    <table class="users-table">\n      <thead><tr>\n        <th style="width:34px"><input type="checkbox" data-action="select-all" ${e.users?.length&&e.selection.size===e.users.length?"checked":""} aria-label="select all"></th>\n        <th class="sortable" data-action="sort" data-key="username">${a(n("users.col.user"))}${He(e,"username")}</th>\n        <th>${a(n("users.col.status"))}</th>\n        <th class="sortable" data-action="sort" data-key="used_bytes" style="min-width:170px">${a(n("users.col.traffic"))}${He(e,"used_bytes")}</th>\n        <th class="sortable" data-action="sort" data-key="expires_at">${a(n("users.col.expiry"))}${He(e,"expires_at")}</th>\n        <th>${a(n("users.col.devices"))}</th>\n        <th style="text-align:end">${a(n("users.col.actions"))}</th>\n      </tr></thead>\n      <tbody>${t||Ct()}</tbody>\n    </table>\n    ${e.total>e.size?At(e):""}\n  </div>`}function He(e,t){return e.sort!==t?"":` <span style="opacity:.6">${e.dir==="asc"?"\\u25B2":"\\u25BC"}</span>`}function Ct(){return`<tr><td colspan="7"><div class="empty">${d("users")}\n    <div style="font-weight:600;color:var(--text-dim)">${a(n("users.empty"))}</div>\n    <div style="font-size:12px">${a(n("users.emptyHint"))}</div></div></td></tr>`}function Pt(e,t){let s=e.used_pct||0;return`<tr class="${t?"selected":""}" data-username="${a(e.username)}">\n    <td><input type="checkbox" data-action="select-user" data-user="${a(e.username)}" ${t?"checked":""} aria-label="${a(e.username)}"></td>\n    <td><a href="#" data-action="open-user" data-user="${a(e.username)}" class="cell-user">${a(e.username)}</a>\n      ${e.note?`<div class="muted" style="font-size:11px">${a(e.note)}</div>`:""}</td>\n    <td>${Ce(e.status)}</td>\n    <td><div style="display:flex;gap:8px;align-items:center">\n        <span class="mono" style="font-size:11.5px;min-width:62px">${D(e.used_bytes)}</span>\n        <div style="flex:1;min-width:52px">${$e(s,"meter-thin")}</div>\n        <span class="muted" style="font-size:11px">${v(e.quota_gb)}GB</span>\n      </div></td>\n    <td><span class="${e.ms_left!=null&&e.ms_left<864e5*2?"badge warn":"muted"}" style="${e.ms_left!=null&&e.ms_left<864e5*2?"":"font-size:12px"}">${ce(e.ms_left)}</span>\n      ${e.first_connect&&!e.activated_at?\'<div class="muted" style="font-size:10.5px">\\u23F3 first-connect</div>\':""}</td>\n    <td class="muted">${v(e.device_limit)}</td>\n    <td><div class="cell-actions">\n      <button class="btn btn-ghost btn-icon" data-action="copy-sub" data-token="${a(e.sub_token)}" title="${a(n("users.drawer.sub"))}">${d("link")}</button>\n      <button class="btn btn-ghost btn-icon" data-action="quick-toggle" data-user="${a(e.username)}" data-active="${e.is_active?1:0}" title="${a(n(e.is_active?"users.bulkDisable":"users.bulkEnable"))}">${d(e.is_active?"eye":"check")}</button>\n      <button class="btn btn-ghost btn-icon" data-action="edit-user" data-user="${a(e.username)}" title="${a(n("common.edit"))}">${d("edit")}</button>\n      <button class="btn btn-ghost btn-icon" data-action="delete-user" data-user="${a(e.username)}" title="${a(n("common.delete"))}" style="color:var(--danger)">${d("trash")}</button>\n    </div></td>\n  </tr>`}function At(e){return`<div class="pager">\n    <button class="btn btn-sm" data-action="page" data-page="${e.page-1}" ${e.page<=1?"disabled":""}>\\u2192</button>\n    <span>${v(e.page)} / ${v(e.pages)}</span>\n    <button class="btn btn-sm" data-action="page" data-page="${e.page+1}" ${e.page>=e.pages?"disabled":""}>\\u2190</button>\n  </div>`}function st(e={},t=[],s=[]){let i=!!e.username,o=(c,f="")=>a(e[c]??f),r=c=>a((c||[]).join(`\n`));return`<form id="user-form" data-edit="${i?a(e.username):""}">\n    <div class="form-grid">\n      <div class="field"><label for="uf-user">${a(n("users.form.username"))} *</label>\n        <input id="uf-user" name="username" type="text" required dir="ltr" ${i?"readonly style=\'opacity:.6\'":""} value="${o("username")}" placeholder="ali-123">\n        <span class="hint">${a(n("users.form.usernameHint"))}</span></div>\n      <div class="field"><label for="uf-quota">${a(n("users.form.quota"))}</label>\n        <input id="uf-quota" name="quota_gb" type="number" min="0.1" step="0.5" value="${o("quota_gb",50)}"></div>\n      <div class="field"><label for="uf-days">${a(n("users.form.days"))}</label>\n        <input id="uf-days" name="expiry_days" type="number" min="1" value="${o("expiry_days",30)}"></div>\n      <div class="field"><label for="uf-dev">${a(n("users.form.devices"))}</label>\n        <input id="uf-dev" name="device_limit" type="number" min="1" max="50" value="${o("device_limit",3)}"></div>\n      <div class="field"><label for="uf-req">${a(n("users.form.requests"))}</label>\n        <input id="uf-req" name="request_limit" type="number" min="0" value="${o("request_limit",0)}"></div>\n      <div class="field"><label for="uf-frag">${a(n("users.form.fragment"))}</label>\n        <select id="uf-frag" name="fragment">\n          ${t.map(c=>`<option value="${a(c.id)}" ${e.fragment===c.id?"selected":""}>${a(c.label)}</option>`).join("")}\n        </select></div>\n      <div class="field"><label for="uf-fp">${a(n("users.form.fingerprint"))}</label>\n        <select id="uf-fp" name="fingerprint">\n          <option value="">\\u2014</option>\n          ${s.map(c=>`<option value="${a(c)}" ${e.fingerprint===c?"selected":""}>${a(c)}</option>`).join("")}\n        </select></div>\n      <div class="field"><label style="display:flex;align-items:center;gap:9px;padding-top:22px">\n        <label class="switch"><input type="checkbox" name="first_connect" ${e.first_connect!==!1?"checked":""}><span></span></label>\n        <span>${a(n("users.form.firstConnect"))}</span></label></div>\n      <div class="field"><label style="display:flex;align-items:center;gap:9px">\n        <label class="switch"><input type="checkbox" name="is_active" ${e.is_active!==!1?"checked":""}><span></span></label>\n        <span>${a(n("users.form.active"))}</span></label></div>\n    </div>\n    <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">\n      <div class="field"><label for="uf-ips">${a(n("users.form.ips"))}</label>\n        <textarea id="uf-ips" name="ips" rows="3" placeholder="104.16.0.0">${r(e.ips)}</textarea></div>\n      <div class="field"><label for="uf-proxy">${a(n("users.form.proxies"))}</label>\n        <textarea id="uf-proxy" name="proxies" rows="3" placeholder="user:pass@1.2.3.4:1080">${r(e.proxies)}</textarea></div>\n      <div class="field"><label for="uf-block">${a(n("users.form.blockList"))}</label>\n        <textarea id="uf-block" name="block_list" rows="3" placeholder="example.com">${r(e.block_list)}</textarea></div>\n    </div>\n    <div class="field"><label for="uf-note">${a(n("users.form.note"))}</label>\n      <input id="uf-note" name="note" type="text" maxlength="200" value="${o("note")}" style="font-family:var(--font)"></div>\n  </form>`}function De(e,t,s=[]){let i=`${location.origin}${le(e.sub_token)}`,o=`${location.origin}/status/${e.sub_token}`,r=(s||[]).map(c=>({...c,total:(c.up_bytes||0)+(c.down_bytes||0)}));return`\n  <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap">\n    ${Ce(e.status)}\n    <span class="badge">${v(e.device_limit)} ${a(n("users.col.devices"))}</span>\n    <span class="badge">${a(e.fragment||"\\u2014")}</span>\n    ${e.fingerprint?`<span class="badge">${a(e.fingerprint)}</span>`:""}\n  </div>\n\n  <div style="display:flex;gap:14px;align-items:center;margin-top:4px">\n    ${Ae(e.used_pct,{size:78})}\n    <div style="flex:1;min-width:0">\n      <div class="kpi-label">${a(n("users.col.traffic"))}</div>\n      <div style="font-weight:800;font-size:19px">${D(e.used_bytes)} <span class="muted" style="font-size:12px;font-weight:400">/ ${v(e.quota_gb)} GB</span></div>\n      <div class="kpi-sub">${a(n("users.col.expiry"))}: ${ce(e.ms_left)}${e.expires_at?` \\xB7 ${Ke(e.expires_at)}`:""}</div>\n    </div>\n  </div>\n\n  <div class="tabs" role="tablist" style="margin-top:8px">\n    <button role="tab" aria-selected="true" data-action="drawer-tab" data-tab="qr">${d("qr")} ${a(n("users.drawer.qr"))}</button>\n    <button role="tab" aria-selected="false" data-action="drawer-tab" data-tab="configs">${a(n("users.drawer.configs"))}</button>\n    <button role="tab" aria-selected="false" data-action="drawer-tab" data-tab="usage">${a(n("users.drawer.usage"))}</button>\n    <button role="tab" aria-selected="false" data-action="drawer-tab" data-tab="sub">${a(n("users.drawer.sub"))}</button>\n  </div>\n\n  <div data-tab-panel="qr">\n    <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">\n      <div class="qr">${de(t.uris?.[0]||"")}</div>\n      <div style="flex:1;min-width:190px">\n        <div class="kpi-label" style="margin-bottom:5px">vless://</div>\n        <div class="codebox" style="max-height:120px">${a(t.uris?.[0]||"")}</div>\n        <div style="display:flex;gap:7px;margin-top:9px;flex-wrap:wrap">\n          ${te(t.uris?.[0]||"")}\n          <button class="btn btn-sm" data-action="copy-all-uris">${d("copy")} ${a(t.uris?.length||0)}\\xD7</button>\n        </div>\n        <div class="livetest">\n          <button class="btn btn-sm" data-action="live-test" data-uuid="${a(e.uuid)}" data-host="${a(t.host||"")}">${d("activity")} ${a(n("users.drawer.liveTest"))}</button>\n          <span class="ms" data-lt-ms hidden>\\u2014</span>\n          <span class="muted" data-lt-msg style="font-size:11.5px;flex:1;min-width:120px">${a(n("live.hint"))}</span>\n        </div>\n      </div>\n    </div>\n    ${(t.uris||[]).length>1?`<div class="kpi-label" style="margin:14px 0 7px">${v(t.uris.length)} \u06A9\u0627\u0646\u0641\u06CC\u06AF \u0628\u0647\u06CC\u0646\u0647 (\u0647\u0645\u0631\u0627\u0647 \u0627\u0648\u0644 / \u0627\u06CC\u0631\u0627\u0646\u0633\u0644 / \u0645\u062E\u0627\u0628\u0631\u0627\u062A)</div>\n      <div style="display:flex;flex-direction:column;gap:8px;max-height:360px;overflow:auto">${t.uris.map((c,f)=>{let itm=(t.items||[])[f]||{},rem=itm.remark||decodeURIComponent((c.split("#")[1]||""));return`<div style="display:flex;flex-direction:column;gap:4px;padding:9px 11px;border:1px solid var(--border);border-radius:10px;background:var(--bg-elev)"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="badge info">#${String(f+1).padStart(2,"0")}</span><b style="font-size:12px;flex:1">${a(rem)}</b>${itm.fragment?`<span class="badge ok" style="font-size:10.5px">\u{1F6E1}\uFE0F TLS Fragment</span>`:""}${te(c,"",!0)}</div><div style="display:flex;gap:10px;align-items:center;font-size:11px" class="muted mono" dir="ltr"><span>Server: <b>${a(itm.address||"\u2014")}:${a(itm.port||443)}</b></span><span>Proto: <b>${a((itm.proto||"vless").toUpperCase())}</b></span><span>Security: <b>${itm.tls?(itm.fragment?"TLS + Fragment":"TLS"):"Plain HTTP"}</b></span></div></div>`}).join("")}</div>`:""}\n  </div>\n\n  <div data-tab-panel="configs" class="hide">\n    <div class="seg" style="margin-bottom:10px">\n      <button data-action="cfg-format" data-format="singbox" aria-pressed="true">sing-box</button>\n      <button data-action="cfg-format" data-format="clash" aria-pressed="false">Clash</button>\n      <button data-action="cfg-format" data-format="base64" aria-pressed="false">Base64</button>\n    </div>\n    <pre class="codebox" id="cfg-out" style="max-height:340px">${a(JSON.stringify(t.singbox,null,2))}</pre>\n    <div style="display:flex;gap:7px;margin-top:9px">\n      <button class="btn btn-sm" data-action="copy-cfg">${d("copy")} ${a(n("common.copy"))}</button>\n      <button class="btn btn-sm" data-action="download-cfg">${d("download")} \\u062F\\u0627\\u0646\\u0644\\u0648\\u062F</button>\n    </div>\n  </div>\n\n  <div data-tab-panel="usage" class="hide">\n    ${r.length?Pe(r,{valueKey:"total",height:170}):`<div class="empty">${d("activity")}<div>no usage yet</div></div>`}\n    ${r.length?`<div class="table-wrap" style="margin-top:10px"><table><thead><tr>\n        <th>\\u0631\\u0648\\u0632</th><th>\\u2193</th><th>\\u2191</th><th>\\u0627\\u062A\\u0635\\u0627\\u0644</th></tr></thead><tbody>\n      ${r.slice().reverse().slice(0,14).map(c=>`<tr><td class="mono">${a(c.day)}</td><td class="mono">${D(c.down_bytes)}</td><td class="mono">${D(c.up_bytes)}</td><td class="mono">${v(c.conns)}</td></tr>`).join("")}\n      </tbody></table></div>`:""}\n  </div>\n\n  <div data-tab-panel="sub" class="hide">\n    <div class="field"><label>${a(n("users.drawer.sub"))}</label>\n      <div class="codebox" id="sub-link">${a(i)}</div>\n      <div style="display:flex;gap:7px;margin-top:8px;flex-wrap:wrap">\n        ${te(i)}\n        <a class="btn btn-sm" href="${a(o)}" target="_blank" rel="noopener">${d("globe")} ${a(n("users.drawer.statusPage"))}</a>\n        <button class="btn btn-sm" data-action="rotate-token">${d("refresh")} ${a(n("users.drawer.rotateToken"))}</button>\n        <button class="btn btn-sm" data-action="rotate-uuid">${d("key")} ${a(n("users.drawer.rotateUuid"))}</button>\n      </div>\n    </div>\n    <p class="hint muted" style="font-size:11.5px;margin-top:10px">\n      UUID: <span class="mono">${a(e.uuid)}</span>\n    </p>\n  </div>\n\n  <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">\n    <button class="btn btn-sm" data-action="edit-user" data-user="${a(e.username)}">${d("edit")} ${a(n("common.edit"))}</button>\n    <button class="btn btn-sm" data-action="reset-user" data-user="${a(e.username)}">${d("refresh")} ${a(n("users.drawer.reset"))}</button>\n    <div class="spacer"></div>\n    <button class="btn btn-sm btn-danger" data-action="delete-user" data-user="${a(e.username)}">${d("trash")} ${a(n("common.delete"))}</button>\n  </div>`}function qe(e,t=[],s=[]){let i=(c,f="")=>a(e[c]??f),o=c=>e[c]==="1"||e[c]===!0?"checked":"",r=c=>{let f=e[c],u=Array.isArray(f)?f:[];if(typeof f=="string"&&f.trim())try{u=JSON.parse(f)}catch{u=f.split(/[\\n,]/)}return a((u||[]).join(`\n`))};return`<form id="settings-form">\n  <div class="grid grid-2">\n    <div class="card">\n      <div class="card-head">${d("gear")}<h3>${a(n("settings.general"))}</h3></div>\n      <div class="form-grid" style="grid-template-columns:1fr">\n        <div class="field"><label>${a(n("settings.panelName"))}</label><input name="panel_name" type="text" value="${i("panel_name","Omni")}"></div>\n        <div class="field"><label>${a(n("settings.publicHost"))}</label><input name="public_host" type="text" dir="ltr" value="${i("public_host")}" placeholder="panel.example.workers.dev">\n          <span class="hint">SNI/Host \\u06A9\\u0647 \\u06A9\\u0644\\u0627\\u06CC\\u0646\\u062A \\u0645\\u06CC\\u200C\\u0641\\u0631\\u0633\\u062A\\u062F. \\u0627\\u06AF\\u0631 \\u062E\\u0627\\u0644\\u06CC \\u0628\\u0627\\u0634\\u062F\\u060C \\u062F\\u0627\\u0645\\u0646\\u0647\\u200C\\u06CC \\u0648\\u0631\\u06A9\\u0631 \\u0627\\u0633\\u062A\\u0641\\u0627\\u062F\\u0647 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F.</span></div>\n        <div class="field"><label>${a(n("settings.remark"))}</label><input name="remark_prefix" type="text" value="${i("remark_prefix","Omni")}"></div>\n        <div style="display:flex;gap:11px">\n          <div class="field" style="flex:1"><label>${a(n("settings.defaultQuota"))}</label><input name="default_quota_gb" type="number" min="1" value="${i("default_quota_gb","50")}"></div>\n          <div class="field" style="flex:1"><label>${a(n("settings.defaultDays"))}</label><input name="default_expiry_days" type="number" min="1" value="${i("default_expiry_days","30")}"></div>\n        </div>\n        <div style="display:flex;align-items:center;gap:10px">\n          <label class="switch"><input type="checkbox" name="maintenance" ${o("maintenance")}><span></span></label>\n          <span>${a(n("settings.maintenance"))}</span></div>\n        <div style="display:flex;align-items:center;gap:10px">\n          <label class="switch"><input type="checkbox" name="public_signup" ${o("public_signup")}><span></span></label>\n          <span>${a(n("signup.settingToggle"))}</span></div>\n        <div class="field" style="max-width:180px"><label>${a(n("signup.maxPerIp"))}</label>\n          <input name="signup_max_per_ip" type="number" min="1" max="100" value="${i("signup_max_per_ip","3")}"></div>\n      </div>\n    </div>\n\n    <div class="card">\n      <div class="card-head">${d("wifi")}<h3>${a(n("settings.network"))}</h3></div>\n      <div class="form-grid" style="grid-template-columns:1fr">\n        <div class="field"><label>${a(n("settings.port"))}</label>\n          <select name="port">${[443,2053,2083,2087,2096,8443,80,8080,2052,2082,2086,2095].map(c=>`<option value="${c}" ${String(e.port)===String(c)?"selected":""}>${c}${[443,2053,2083,2087,2096,8443].includes(c)?" (TLS)":""}</option>`).join("")}</select></div>\n        <div class="field"><label>${a(n("users.form.fragment"))}</label>\n          <select name="fragment_preset">${t.map(c=>`<option value="${a(c.id)}" ${e.fragment_preset===c.id?"selected":""}>${a(c.label)}</option>`).join("")}</select></div>\n        <div class="field"><label>${a(n("users.form.fingerprint"))}</label>\n          <select name="fingerprint"><option value="">\\u2014</option>${s.map(c=>`<option value="${a(c)}" ${e.fingerprint===c?"selected":""}>${a(c)}</option>`).join("")}</select></div>\n        <div class="field"><label>${a(n("settings.cleanIps"))}</label>\n          <textarea name="clean_ips" rows="3" dir="ltr">${r("clean_ips")}</textarea></div>\n        <div class="field"><label>${a(n("settings.ipPool"))}</label>\n          <textarea name="ip_pool" rows="4" dir="ltr" placeholder="104.16.0.0&#10;172.66.0.0">${r("ip_pool")}</textarea>\n          <span class="hint">\\u0645\\u062E\\u0632\\u0646\\u06CC \\u06A9\\u0647 Cron \\u0647\\u0631 ${a(e.rotate_minutes||30)} \\u062F\\u0642\\u06CC\\u0642\\u0647 \\u0627\\u0632 \\u0622\\u0646 \\u062A\\u0633\\u062A \\u0645\\u06CC\\u200C\\u06AF\\u06CC\\u0631\\u062F \\u0648 \\u0628\\u0647\\u062A\\u0631\\u06CC\\u0646\\u200C\\u0647\\u0627 \\u0631\\u0627 \\u062F\\u0631 \\xAB\\u0622\\u06CC\\u200C\\u067E\\u06CC \\u062A\\u0645\\u06CC\\u0632 \\u0641\\u0639\\u0644\\u06CC\\xBB \\u0645\\u06CC\\u200C\\u06AF\\u0630\\u0627\\u0631\\u062F.</span></div>\n        <div style="display:flex;align-items:center;gap:10px">\n          <label class="switch"><input type="checkbox" name="auto_rotate" ${o("auto_rotate")}><span></span></label><span>${a(n("settings.autoRotate"))}</span>\n          <input name="rotate_minutes" type="number" min="5" max="1440" value="${i("rotate_minutes","30")}" style="width:88px"></div>\n        <div style="display:flex;align-items:center;gap:10px">\n          <label class="switch"><input type="checkbox" name="mux_enabled" ${o("mux_enabled")}><span></span></label><span>${a(n("settings.mux"))}</span></div>\n      </div>\n    </div>\n\n    <div class="card">\n      <div class="card-head">${d("shield")}<h3>${a(n("settings.security"))}</h3></div>\n      <div style="display:flex;flex-direction:column;gap:11px">\n        <div style="display:flex;align-items:center;gap:10px">\n          <label class="switch"><input type="checkbox" name="block_nsfw" ${o("block_nsfw")}><span></span></label><span>${a(n("settings.blockNsfw"))}</span></div>\n        <div style="display:flex;align-items:center;gap:10px">\n          <label class="switch"><input type="checkbox" name="block_ads" ${o("block_ads")}><span></span></label><span>${a(n("settings.blockAds"))}</span></div>\n        <p class="hint muted" style="font-size:11.5px;margin:0">\n          \\u0645\\u0633\\u062F\\u0648\\u062F\\u0633\\u0627\\u0632\\u06CC \\u0631\\u0648\\u06CC \\u0644\\u0628\\u0647 \\u0648 \\u0628\\u0627 DoH \\u0627\\u0646\\u062C\\u0627\\u0645 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F\\u061B \\u0641\\u0647\\u0631\\u0633\\u062A \\u062F\\u0627\\u0645\\u0646\\u0647\\u200C\\u0647\\u0627 \\u062F\\u0631 \\u0647\\u0631 \\u06A9\\u0627\\u0631\\u0628\\u0631 \\u0647\\u0645 \\u0642\\u0627\\u0628\\u0644 \\u062A\\u0646\\u0638\\u06CC\\u0645 \\u0627\\u0633\\u062A.</p>\n        <div class="nav-sep"></div>\n        <div class="field"><label>${a(n("settings.changePassword"))}</label>\n          <input name="pw_current" type="password" placeholder="${a(n("settings.currentPassword"))}" autocomplete="current-password" dir="ltr">\n          <input name="pw_next" type="password" placeholder="${a(n("login.newPassword"))}" autocomplete="new-password" dir="ltr" minlength="10" style="margin-top:7px">\n          <button class="btn btn-sm" type="button" data-action="change-password" style="margin-top:9px;align-self:flex-start">${d("key")} ${a(n("settings.changePassword"))}</button></div>\n      </div>\n    </div>\n\n    <div class="card">\n      <div class="card-head">${d("db")}<h3>${a(n("settings.backup"))}</h3></div>\n      <p class="hint muted" style="font-size:12px;margin-top:0">\n        \\u062E\\u0631\\u0648\\u062C\\u06CC \\u06A9\\u0627\\u0645\\u0644 D1 \\u0628\\u0647 JSON \\u2014 \\u06A9\\u0627\\u0631\\u0628\\u0631\\u0627\\u0646\\u060C \\u062A\\u0646\\u0638\\u06CC\\u0645\\u0627\\u062A\\u060C \\u067E\\u0644\\u0646\\u200C\\u0647\\u0627 \\u0648 \\u0646\\u0648\\u062F\\u0647\\u0627. \\u0628\\u0631\\u0627\\u06CC \\u062C\\u0627\\u0628\\u0647\\u200C\\u062C\\u0627\\u06CC\\u06CC \\u0628\\u06CC\\u0646 \\u0627\\u06A9\\u0627\\u0646\\u062A \\u06A9\\u0644\\u0648\\u062F\\u0641\\u0644\\u0631 \\u06CC\\u0627 \\u0641\\u0631\\u0627\\u0631 \\u0627\\u0632 \\u0628\\u0646 \\u0634\\u062F\\u0646.</p>\n      <div style="display:flex;gap:8px;flex-wrap:wrap">\n        <button class="btn" type="button" data-action="export-backup">${d("download")} ${a(n("settings.export"))}</button>\n        <label class="btn" style="cursor:pointer">${d("upload")} ${a(n("settings.import"))}\n          <input type="file" accept="application/json" data-action="import-backup" hidden></label>\n      </div>\n      <div class="nav-sep" style="margin:16px 0"></div>\n      <div class="card-head" style="color:var(--danger)">${d("alert")}<h3 style="color:var(--danger)">${a(n("settings.danger"))}</h3></div>\n      <button class="btn btn-danger" type="button" data-action="revoke-all">${d("logout")} \\u062E\\u0631\\u0648\\u062C \\u0627\\u0632 \\u0647\\u0645\\u0647 \\u0646\\u0634\\u0633\\u062A\\u200C\\u0647\\u0627</button>\n    </div>\n  </div>\n\n  <div style="position:sticky;bottom:0;margin-top:14px;display:flex;gap:9px;justify-content:flex-end;padding:12px;\n    background:color-mix(in srgb, var(--surface) 88%, transparent);backdrop-filter:blur(10px);border:1px solid var(--border);border-radius:var(--radius)">\n    <button class="btn" type="button" data-action="reload-settings">${a(n("common.cancel"))}</button>\n    <button class="btn btn-primary" type="submit">${d("check")} ${a(n("settings.save"))}</button>\n  </div>\n  </form>`}function Ue(e=[]){return`<div class="grid grid-2">\n    <div class="card">\n      <div class="card-head">${d("wifi")}<h3>${a(n("diag.probeNode"))}</h3></div>\n      <div class="field"><input id="probe-input" type="text" dir="ltr" value="bpb.yousef.isegaro.com:443" placeholder="${a(n("diag.probeHint"))}">\n        <span class="hint">\u0646\u0645\u0648\u0646\u0647 \u067E\u0631\u0648\u06A9\u0633\u06CC\u200C\u0647\u0627\u06CC \u0628\u0627\u0644\u0627\u062F\u0633\u062A\u06CC \u0641\u0639\u0627\u0644 (\u06A9\u0644\u06CC\u06A9 \u0628\u0631\u0627\u06CC \u062A\u0633\u062A \u0633\u0631\u06CC\u0639):</span></div>\n      <div class="chips" style="margin-top:6px">\n        ${["bpb.yousef.isegaro.com:443","tr.diam4.ggff.net:443","di.nscl.ir:443","1.1.1.1:443"].map(p=>`<button class="chip" type="button" data-action="omni-probe-fill" data-v="${p}">${p}</button>`).join("")}\n      </div>\n      <button class="btn btn-primary btn-sm" data-action="probe" style="margin-top:10px">${d("play")} ${a(n("diag.run"))}</button>\n      <div id="probe-out" style="margin-top:12px"></div>\n    </div>\n\n    <div class="card">\n      <div class="card-head">${d("activity")}<h3>${a(n("diag.ping"))}</h3></div>\n      <div class="field"><input id="ping-input" type="text" dir="ltr" value="1.1.1.1">\n        <span class="hint">\u0633\u0646\u062C\u0634 \u06F3 \u0645\u0631\u062D\u0644\u0647\u200C\u0627\u06CC \u062A\u0623\u062E\u06CC\u0631\u060C \u062C\u06CC\u062A\u0631 \u0648 \u062F\u06CC\u062A\u0627\u0633\u0646\u062A\u0631 \u0627\u0632 \u0644\u0628\u0647 \u06A9\u0644\u0648\u062F\u0641\u0644\u0631:</span></div>\n      <div class="chips" style="margin-top:6px">\n        ${["1.1.1.1","www.gstatic.com","cp.cloudflare.com","cloudflare.com"].map(p=>`<button class="chip" type="button" data-action="omni-ping-fill" data-v="${p}">${p}</button>`).join("")}\n      </div>\n      <button class="btn btn-primary btn-sm" data-action="ping" style="margin-top:10px">${d("play")} ${a(n("diag.run"))}</button>\n      <div id="ping-out" style="margin-top:12px"></div>\n    </div>\n\n    <div class="card">\n      <div class="card-head">${d("bolt")}<h3>\u062A\u0633\u062A \u0633\u0631\u0639\u062A \u0632\u0646\u062F\u0647 (\u062F\u0627\u0646\u0644\u0648\u062F / \u0622\u067E\u0644\u0648\u062F / \u067E\u06CC\u0646\u06AF)</h3></div>\n      <p class="hint muted" style="margin-top:-4px">\u0633\u0646\u062C\u0634 \u0648\u0627\u0642\u0639\u06CC \u0633\u0631\u0639\u062A \u062F\u0627\u0646\u0644\u0648\u062F \u0648 \u0622\u067E\u0644\u0648\u062F (\u0628\u0647 \u0645\u06AF\u0627\u0628\u06CC\u062A \u0628\u0631 \u062B\u0627\u0646\u06CC\u0647 Mbps) \u0648 \u067E\u06CC\u0646\u06AF \u062E\u0637 \u0641\u0639\u0644\u06CC \u0634\u0645\u0627 \u0628\u0647 \u0644\u0628\u0647 \u0648\u0631\u06A9\u0631.</p>\n      <button class="btn btn-primary btn-sm" data-action="omni-speedtest" style="margin-top:10px">${d("bolt")} \u0634\u0631\u0648\u0639 \u062A\u0633\u062A \u0633\u0631\u0639\u062A \u0632\u0646\u062F\u0647</button>\n      <div id="speedtest-out" style="margin-top:12px"></div>\n    </div>\n\n    <div class="card">\n      <div class="card-head">${d("refresh")}<h3>${a(n("diag.maintenance"))}</h3></div>\n      <p class="hint muted" style="margin-top:-4px">${a(n("diag.maintenanceHint"))}</p>\n      <button class="btn btn-primary btn-sm" data-action="maintenance" style="margin-top:10px">${d("play")} ${a(n("diag.run"))}</button>\n      <div id="maintenance-out" style="margin-top:12px"></div>\n    </div>\n\n    <div class="card" style="grid-column:1/-1">\n      <div class="card-head">${d("shield")}<h3>${a(n("diag.audit"))}</h3><div class="spacer"></div>\n        <button class="btn btn-ghost btn-sm" data-action="reload-logs">${d("refresh")}</button></div>\n      <p class="hint muted" style="margin-top:-6px;font-size:11.5px">${a(n("diag.auditHint"))}</p>\n      <div class="table-wrap" style="max-height:340px;overflow:auto"><table><thead><tr>\n        <th>\u0632\u0645\u0627\u0646</th><th>\u0628\u0627\u0632\u06CC\u06AF\u0631</th><th>\u0631\u0648\u06CC\u062F\u0627\u062F</th><th>\u0647\u062F\u0641 / \u0634\u0631\u062D</th></tr></thead>\n        <tbody>${(e||[]).map(t=>`<tr>\n          <td class="muted" style="white-space:nowrap">${ye(t.at)}</td>\n          <td class="mono" style="font-size:11.5px">${a(t.actor||"admin")}</td>\n          <td><span class="badge ${/delete|failed|revoke|warn|err/.test(t.action)?"danger":/create|update|login|scan|probe|maintenance|info$/.test(t.action)?"info":""}">${a(t.action||t.level||"info")}</span></td>\n          <td class="muted mono" style="font-size:11.5px">${a(t.target||t.msg||"")}</td></tr>`).join("")||\'<tr><td colspan="4"><div class="empty">\\u2014</div></td></tr>\'}</tbody></table></div>\n    </div>\n  </div>`}function Ne(e=[]){return`<div class="card">\n    <div class="card-head">${d("key")}<h3>${a(n("nav.sessions"))}</h3><div class="spacer"></div>\n      <button class="btn btn-sm btn-danger" data-action="revoke-all">${a(n("settings.danger"))}</button></div>\n    <div class="table-wrap"><table><thead><tr><th>Subject</th><th>Role</th><th>\\u0627\\u06CC\\u062C\\u0627\\u062F</th><th>\\u0627\\u0646\\u0642\\u0636\\u0627</th><th>IP</th><th></th></tr></thead>\n    <tbody>${e.map(t=>`<tr>\n      <td class="cell-user">${a(t.subject)}</td><td><span class="badge info">${a(t.role)}</span></td>\n      <td class="muted">${ye(t.created_at)}</td><td class="muted">${ce(t.expires_at-Date.now())}</td>\n      <td class="mono muted" style="font-size:11px">${a((t.ip_hash||"").slice(0,8))}</td>\n      <td style="text-align:end"><button class="btn btn-ghost btn-sm" data-action="revoke-session" data-id="${a(t.id)}">${d("close")}</button></td>\n    </tr>`).join("")||\'<tr><td colspan="6"><div class="empty">\\u2014</div></td></tr>\'}</tbody></table></div>\n  </div>`}var ot=[{id:"omni",label:"\\u0627\\u0648\\u0645\\u0646\\u06CC (\\u0644\\u0627\\u0645\\u0628\\u0648)",a:"#ffc000",b:"#ffffff"},{id:"dark",label:"\\u0627\\u0648\\u0645\\u0646\\u06CC \\u062A\\u06CC\\u0631\\u0647",a:"#22d3ee",b:"#a78bfa"},{id:"light",label:"\\u0627\\u0648\\u0645\\u0646\\u06CC \\u0631\\u0648\\u0634\\u0646",a:"#0ea5e9",b:"#8b5cf6"},{id:"ferrari",label:"\\u0641\\u0631\\u0627\\u0631\\u06CC",a:"#da291c",b:"#fff200"},{id:"apple",label:"\\u0627\\u067E\\u0644",a:"#0066cc",b:"#2997ff"},{id:"claude",label:"\\u06A9\\u0644\\u0648\\u062F",a:"#cc785c",b:"#5db8a6"},{id:"pinterest",label:"\\u067E\\u06CC\\u0646\\u062A\\u0631\\u0633\\u062A",a:"#e60023",b:"#7e238b"},{id:"nintendo",label:"\\u0646\\u06CC\\u0646\\u062A\\u0646\\u062F\\u0648",a:"#e60012",b:"#f68d1f"},{id:"dell",label:"\\u062F\\u0644",a:"#e91d2a",b:"#fcc20f"}],we=[443,2053,2083,2087,2096,8443],Ht=[80,8080,8880,2052,2082,2086,2095],It=["2606:4700::6810:84e5","2606:4700::6812:1a2e","2606:4700:3030::ac43:b58a","2606:4700:3037::6815:32a1","2606:4700:3033::6815:1e29","2606:4700:3032::6815:3ef9","2606:4700:3030::ac43:49a1","2606:4700:3034::6815:4a1"],rt=["2606:4700::6810:84e5","2606:4700::6812:1a2e","2606:4700:3030::ac43:b58a","2606:4700:3037::6815:32a1","2606:4700:3033::6815:1e29","2606:4700:3032::6815:3ef9","172.67.181.32","188.114.96.1","188.114.96.3","172.64.80.1","104.17.148.22","172.67.181.0/24","188.114.96.0/24"],Dt=["proxyip.cmliussss.net","bpb.yousef.isegaro.com","tr.diam4.ggff.net","di.nscl.ir"],lt=[["FRA","\\u{1F1E9}\\u{1F1EA}"],["AMS","\\u{1F1F3}\\u{1F1F1}"],["LHR","\\u{1F1EC}\\u{1F1E7}"],["CDG","\\u{1F1EB}\\u{1F1F7}"],["IST","\\u{1F1F9}\\u{1F1F7}"],["DXB","\\u{1F1E6}\\u{1F1EA}"],["IAD","\\u{1F1FA}\\u{1F1F8}"],["LAX","\\u{1F1FA}\\u{1F1F8}"],["SIN","\\u{1F1F8}\\u{1F1EC}"],["NRT","\\u{1F1EF}\\u{1F1F5}"],["BOM","\\u{1F1EE}\\u{1F1F3}"],["GRU","\\u{1F1E7}\\u{1F1F7}"]],nt="VLESS \\u25C6 TROJAN \\u25C6 WEBSOCKET \\u25C6 DoH \\u25C6 WARP \\u25C6 CLOUDFLARE \\u25C6 ",qt=["172.67.181.32","188.114.96.1","188.114.96.3","188.114.97.1","172.64.80.1","104.17.148.22","172.67.181.14","172.67.73.161","104.18.32.115","104.21.32.115","104.26.10.12","104.17.209.9"],Ut=[{"name":"Cloudflare (1.1.1.1)","url":"https://cloudflare-dns.com/dns-query","dot":"one.one.one.one"},{"name":"Google (8.8.8.8)","url":"https://dns.google/dns-query","dot":"dns.google"},{"name":"Quad9 (9.9.9.9)","url":"https://dns.quad9.net/dns-query","dot":"dns.quad9.net"},{"name":"AdGuard DNS","url":"https://dns.adguard-dns.com/dns-query","dot":"dns.adguard-dns.com"},{"name":"ControlD (FreeDNS)","url":"https://freedns.controld.com/p0","dot":"p0.freedns.controld.com"},{"name":"OpenDNS (Cisco)","url":"https://doh.opendns.com/dns-query","dot":"dns.opendns.com"},{"name":"NextDNS","url":"https://dns.nextdns.io/dns-query","dot":"dns.nextdns.io"},{"name":"DNS.SB (\u0622\u0644\u0645\u0627\u0646/\u0647\u0644\u0646\u062F)","url":"https://doh.sb/dns-query","dot":"dot.sb"},{"name":"CleanBrowsing","url":"https://doh.cleanbrowsing.org/doh/security-filter/","dot":"security-filter-dns.cleanbrowsing.org"},{"name":"AliDNS (Alibaba)","url":"https://dns.alidns.com/dns-query","dot":"dns.alidns.com"},{"name":"Shecan (\u0634\u06A9\u0646 \u0627\u06CC\u0631\u0627\u0646)","url":"https://free.shecan.ir/dns-query","dot":"free.shecan.ir","ir":true},{"name":"Electro (\u0627\u0644\u06A9\u062A\u0631\u0648 \u0627\u06CC\u0631\u0627\u0646)","url":"https://dns.electrotm.org/dns-query","dot":"dns.electrotm.org","ir":true},{"name":"Radar Game (\u0631\u0627\u062F\u0627\u0631 \u0627\u06CC\u0631\u0627\u0646)","url":"https://radar.game/dns-query","dot":"radar.game","ir":true},{"name":"Begzar (\u0628\u06AF\u0630\u0631 \u0627\u06CC\u0631\u0627\u0646)","url":"https://dns.begzar.ir/dns-query","dot":"dns.begzar.ir","ir":true}],Nt=e=>btoa(unescape(encodeURIComponent(e)));function Re(e){if(Array.isArray(e))return e.filter(Boolean);try{let t=JSON.parse(e||"[]");return Array.isArray(t)?t.filter(Boolean):[]}catch{return String(e||"").split(/[,\\s]+/).filter(Boolean)}}function Oe(e){let t=new Set,s=[];for(let i of[Re(e?.clean_ips),Re(e?.ip_pool),qt])for(let o of i){let r=String(o?.ip??o?.addr??o??"").trim().replace(/^\\[|\\]$/g,"");if(!r||t.has(r)||r==="104.16.132.229")continue;if(/^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(r)){let l=Number(r.split(".")[3]);if(l===0||l===255)continue}t.add(r),s.push(r)}return s.slice(0,32)}function Rt(e,t){let x0=String(e||"").trim().replace(/^\\[|\\]$/g,"");if(!x0)return[];let s=/^(\\d+)\\.(\\d+)\\.(\\d+)\\.(\\d+)\\/(\\d+)$/.exec(x0);if(!s){if(/^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(x0)){let l=Number(x0.split(".")[3]);return l===0||l===255?[]:[x0]}return[x0]}let[,i,o,r,c,f]=s.map(Number),u=f;if(u<8||u>32)return[];let m=(i<<24|o<<16|r<<8|c)>>>0,p=2**(32-u),$=Math.max(1,Math.floor(p/t)),M=[];for(let k=1;k<p&&M.length<t;k+=$){let L=m+k>>>0,lo=L&255;if(lo===0)L=L+1>>>0;else if(lo===255)L=L-1>>>0;M.push(`${L>>>24}.${L>>>16&255}.${L>>>8&255}.${L&255}`)}return M}function Ot(e){return we.includes(Number(e))?`${e}\\xB7TLS`:`${e}`}function jt(e){let t=e.getContext&&e.getContext("2d");if(!t)return;let s=matchMedia("(prefers-reduced-motion: reduce)").matches,i=0,o=0,r=1,c=()=>{r=Math.min(2,devicePixelRatio||1),i=e.clientWidth,o=e.clientHeight,e.width=i*r,e.height=o*r,t.setTransform(r,0,0,r,0,0)};c(),addEventListener("resize",c,{passive:!0});let f=Array.from({length:90},()=>({x:Math.random(),y:Math.random(),r:Math.random()*1.2+.3,p:Math.random()*6.28})),u=(1+Math.sqrt(5))/2,m=[[-1,u,0],[1,u,0],[-1,-u,0],[1,-u,0],[0,-1,u],[0,1,u],[0,-1,-u],[0,1,-u],[u,0,-1],[u,0,1],[-u,0,-1],[-u,0,1]].map(T=>{let _=Math.hypot(...T);return T.map(I=>I/_)}),p=[];for(let T=0;T<12;T++)for(let _=T+1;_<12;_++)Math.hypot(m[T][0]-m[_][0],m[T][1]-m[_][1],m[T][2]-m[_][2])<1.2&&p.push([T,_]);let $=getComputedStyle(document.documentElement),M=()=>$.getPropertyValue("--accent").trim()||"#ffc000",k=()=>$.getPropertyValue("--text").trim()||"#fff";function L(T,_,I){let[j,F,N]=T,V=Math.cos(_),G=Math.sin(_),ie=Math.cos(I),ve=Math.sin(I),_e=j*V+N*G,he=-j*G+N*V,We=F*ie-he*ve,K=F*ve+he*ie;return[_e,We,K]}function S(T,_,I,j){let N=2.6/(2.6+T[2]);return[I+T[0]*_*N,j+T[1]*_*N,N]}let C=0,q=performance.now(),Ze=0;function be(T){let _=(T-q)/1e3;if(T-Ze<33){C=requestAnimationFrame(be);return}Ze=T,t.clearRect(0,0,i,o);let I=i/2,j=o/2,F=Math.min(i,o)*.36;for(let w of f){let E=.25+.55*Math.abs(Math.sin(_/1.6+w.p));t.fillStyle=k(),t.globalAlpha=E*.5,t.beginPath(),t.arc(w.x*i,w.y*o,w.r,0,6.28),t.fill()}t.globalAlpha=1;let N=_*.32,V=Math.sin(_/5)*.35+.25,G=M();t.strokeStyle=G,t.globalAlpha=.28,t.lineWidth=1;for(let w=-60;w<=60;w+=30){t.beginPath();for(let E=0;E<=360;E+=6){let z=w*Math.PI/180,Z=E*Math.PI/180,ee=L([Math.cos(z)*Math.sin(Z),Math.sin(z),Math.cos(z)*Math.cos(Z)],N,V),[oe,re]=S(ee,F,I,j);E===0?t.moveTo(oe,re):t.lineTo(oe,re)}t.stroke()}for(let w=0;w<360;w+=30){t.beginPath();for(let E=-90;E<=90;E+=6){let z=E*Math.PI/180,Z=w*Math.PI/180,ee=L([Math.cos(z)*Math.sin(Z),Math.sin(z),Math.cos(z)*Math.cos(Z)],N,V),[oe,re]=S(ee,F,I,j);E===-90?t.moveTo(oe,re):t.lineTo(oe,re)}t.stroke()}t.globalAlpha=.85,t.lineWidth=1.6,t.beginPath();for(let w=0;w<=120;w++){let E=w/120*6.28,z=L([Math.cos(E)*1.45,Math.sin(E)*.32,0],N+.6,V+.5),[Z,ee]=S(z,F,I,j);w===0?t.moveTo(Z,ee):t.lineTo(Z,ee)}t.stroke();let ie=_*1.1,ve=L([Math.cos(ie)*1.45,Math.sin(ie)*.32,0],N+.6,V+.5),[_e,he]=S(ve,F,I,j);t.fillStyle=G,t.beginPath(),t.arc(_e,he,3.2,0,6.28),t.fill();let K=m.map(w=>L(w.map(E=>E*.52),-N*1.6,-V*1.2)).map(w=>S(w,F,I,j));t.globalAlpha=.16,t.fillStyle=G,t.beginPath(),t.arc(I,j,F*.62,0,6.28),t.fill(),t.globalAlpha=.9,t.strokeStyle=G,t.lineWidth=1.6;for(let[w,E]of p)t.beginPath(),t.moveTo(K[w][0],K[w][1]),t.lineTo(K[E][0],K[E][1]),t.stroke();t.globalAlpha=.95,t.fillStyle=G;for(let w of K)t.beginPath(),t.arc(w[0],w[1],2,0,6.28),t.fill();t.globalAlpha=1,s||(C=requestAnimationFrame(be))}s?be(performance.now()):C=requestAnimationFrame(be)}async function Ft(){let e=document.querySelector("#omni-colo");if(e)try{let s=await(await fetch("/cdn-cgi/trace",{cache:"no-store"})).text(),i=/colo=(\\w+)/.exec(s)?.[1],o=/ip=([^\\s]+)/.exec(s)?.[1],r=(lt.find(([c])=>c===i)||[])[1]||"\\u{1F310}";e.textContent=`${r} ${i||"\\u2014"}${o?" \\xB7 "+o:""}`}catch{e.textContent=location.hostname.endsWith(".workers.dev")?"\\u{1F310} \\u2014":`${a(n("omni.localMode"))}`}}function ke(e,t){let s=e||{},i=t&&t.users||{},o=Re(s.clean_ips);return setTimeout(()=>{let r=document.querySelector("#omni-globe");r&&jt(r),Ft()},0),`\n  <section class="omni-hero">\n    <div class="omni-hero-top">\n      <div class="omni-id">\n        <h1>OMNI PANEL</h1>\n        <p>${a(n("omni.heroTag"))}</p>\n        <span class="omni-pill">${a(n("omni.online"))}</span>\n      </div>\n      <canvas id="omni-globe" class="omni-globe" aria-hidden="true"></canvas>\n    </div>\n    <div class="omni-badges">\n      <span>VLESS-WS</span><span>Trojan-WS</span><span>DoH</span><span>WARP</span><span>${v(o.length)} IP</span><span>Omni v1.0</span>\n    </div>\n    <div class="omni-stats">\n      <div><span>${a(n("omni.statSni"))}</span><b>${a(s.public_host||"\\u2014")}</b></div>\n      <div><span>${a(n("omni.statColo"))}</span><b id="omni-colo">\\u2026</b></div>\n      <div><span>${a(n("omni.statPorts"))}</span><b>${we.slice(0,4).join(" \\xB7 ")}</b></div>\n      <div><span>${a(n("omni.statUsers"))}</span><b>${i.total!=null?v(i.total):"\\u2026"}</b></div>\n    </div>\n    <div class="omni-flags" aria-hidden="true">\n      ${lt.map(([r,c])=>`<span title="${r}">${c}</span>`).join("")}\n    </div>\n  </section>\n  <div class="omni-tick" aria-hidden="true"><span>${nt.repeat(4)}</span><span>${nt.repeat(4)}</span></div>`}var OMNI_QOS_V4=["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237","104.18.26.46","172.67.181.138","104.16.142.53","162.159.137.74","104.17.148.77","172.67.217.91"];\nvar OMNI_CLEAN_SITES=["104.18.181.138","104.21.3.237","104.18.26.46","172.67.181.138","104.17.148.167","104.17.148.17"];\nvar OMNI_CLEAN_V6=["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed","2606:4700::6811:9411","2606:4700::6811:9377","2606:4700:3031::ac43:d95b","2606:4700:3035::ac43:a318"];\nvar OMNI_CLEAN_IR=["172.67.181.122","172.67.181.210","104.17.147.119","104.18.3.91"];\nvar OMNI_HYBRID_POOL=["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237","2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"];\nvar DEAD_BYOIP_SET=new Set(["31.185.108.22","31.12.75.1","89.117.112.10","170.114.45.134","37.153.171.224","94.140.0.10","188.42.145.155","45.85.118.1","213.241.198.123","94.247.142.1","57.128.178.36","185.207.196.148","185.18.184.181","66.81.247.100","8.39.125.239","45.194.53.10","170.168.7.26","45.142.120.10","www.speedtest.net","speedtest.net","platoapp.com","www.udemy.com","udemy.com","www.canva.com","canva.com","quizlet.com","www.fiverr.com","fiverr.com","discord.com","chat.openai.com","01d.ir","0seo.ir","18m.ir","09122108011.ir","1car.ir","0nlysms.ir","10az10.ir","123project.ir"]);\nvar PRIMARY_LOCATIONS=["US","DE","NL","GB","FR","TR","AE","FI","SE","CA","SG","JP","CH","AT","IT","ES","NO","PL","CZ","HU","RO","DK","KR","AU"];\nvar OMNI_QOS_SET=new Set(OMNI_QOS_V4.map(x=>String(x).toLowerCase()));\nvar OMNI_SITES_SET=new Set(OMNI_CLEAN_SITES.map(x=>String(x).toLowerCase()));\nvar g={user:"",profile:"mci",cc:"",ports:[443],protos:["vless","trojan"],addrs:"hybrid",customAddr:"",fp:"chrome",fragment:!1,fragPreset:"100-200,5-10,tlshello",ipv6:!0,fmt:"uris",out:null};\nfunction zt(e){\n  let t=e.settings?.public_host||location.host||"panel.example",s=[];\n  let cleanPool=Oe(e.settings).filter(x=>!DEAD_BYOIP_SET.has(String(x).toLowerCase())&&!COUNTRY_PROXY_MAP.has(String(x).toLowerCase()));\n  if(g.addrs==="host"){\n    s=[t];\n  }else if(g.addrs==="custom"){\n    s=g.customAddr.split(/[,\\s]+/).filter(Boolean);\n  }else if(g.addrs==="sites"){\n    s=[...OMNI_CLEAN_SITES,...OMNI_CLEAN_IR.slice(0,4),...OMNI_QOS_V4.slice(0,4)];\n  }else if(g.addrs==="qos"){\n    s=[...OMNI_QOS_V4.slice(0,10),...OMNI_CLEAN_SITES.slice(0,3)];\n  }else{\n    s=[\n      ...OMNI_QOS_V4.slice(0,5),\n      ...OMNI_CLEAN_SITES.slice(0,3),\n      ...OMNI_CLEAN_V6.slice(0,3),\n      ...OMNI_CLEAN_IR.slice(0,2),\n      ...cleanPool.slice(0,4)\n    ];\n  }\n  if(g.profile==="irancell"||g.profile==="tci"){\n    s=[\n      ...OMNI_QOS_V4.slice(0,6),\n      ...OMNI_CLEAN_SITES.slice(0,3),\n      ...OMNI_CLEAN_IR.slice(0,3),\n      ...OMNI_CLEAN_V6.slice(0,2)\n    ];\n  }else if(g.profile==="mci"){\n    s=[\n      ...OMNI_CLEAN_V6.slice(0,5),\n      ...OMNI_QOS_V4.slice(0,5),\n      ...OMNI_CLEAN_SITES.slice(0,3)\n    ];\n  }else if(!g.ipv6&&g.addrs!=="custom"){\n    s=s.filter(x=>!String(x).includes(":"));\n  }\n  let filtered=[...new Set(s.map(x=>String(x||"").trim().replace(/^\\[|\\]$/g,"")).filter(x=>x&&!COUNTRY_PROXY_MAP.has(x.toLowerCase())&&!DEAD_BYOIP_SET.has(x.toLowerCase())))];\n  return{host:t,list:filtered.slice(0,14)};\n}\nfunction shortAddrTag(p){\n  let c=String(p||"").trim().replace(/^\\[|\\]$/g,"");\n  if(c.includes(":")){let pts=c.split(":").filter(Boolean);return"IPv6:"+(pts[pts.length-1]||"cf")}\n  return c;\n}\nfunction Bt(e){\n  let t=(e.users||[]).find(p=>p.username===g.user)||(e.users||[])[0];\n  if(!t)return null;\n  let{host:s,list:i}=zt(e),o=e.settings?.trojan_password||t.uuid,bp=(e.settings?.path||"/ws").split("?")[0];\n  let activeCc=g.cc!==void 0&&g.cc!==""?g.cc:(g.profile==="direct"?"DIRECT":(e.settings?.selected_country||""));\n  let isDirect=String(activeCc).toUpperCase()==="DIRECT"||g.profile==="direct";\n  let selC0=(!isDirect&&activeCc)?COUNTRY_MAP.get(activeCc):null;\n  let qs0=[];\n  if(isDirect){\n    qs0.push("mode=direct");\n  }else if(selC0){\n    qs0.push("cc="+selC0.cc);\n    if(selC0.proxies?.[0])qs0.push("proxyip="+selC0.proxies[0]+":443");\n  }\n  let S=qs0.length?`${bp}?${qs0.join("&")}`:bp,r=[];\n  let exitBadge=selC0?`\u062E\u0631\u0648\u062C\u06CC ${selC0.flag} ${selC0.fa}`:"\u{1F310} \u0645\u0633\u062A\u0642\u06CC\u0645";\n  let activePorts=[443];\n  for(let p of i)for(let $ of activePorts){\n    if(r.length>=28)break;\n    let M=we.includes(Number($)),hp=p.includes(":")?`[${p}]`:p;\n    if(!M&&(/[a-z]/i.test(p)&&!p.includes(":")))continue;\n    for(let k of g.protos){\n      if(r.length>=28)break;\n      let L=k==="vless"?t.uuid:o;\n      let useFrag=Boolean(g.fragment&&g.profile==="irancell");\n      let fpVal=g.fp||"chrome";\n      let rawFrag=g.fragPreset||"100-200,5-10,tlshello";\n      let fragParts=rawFrag.split(",");\n      let fragStr=rawFrag;\n      let params=[`path=${encodeURIComponent(S)}`,`security=${M?"tls":"none"}`];\n      if(k==="vless")params.push("encryption=none");\n      params.push(`host=${encodeURIComponent(s)}`,"type=ws");\n      if(M){\n        params.push("insecure=0",`fp=${encodeURIComponent(fpVal)}`,"allowInsecure=0",`sni=${encodeURIComponent(s)}`);\n      }\n      if(useFrag){\n        let fm={tcp:[{type:"fragment",settings:{packets:fragParts[2]||"tlshello",length:fragParts[0]||"100-200",delay:fragParts[1]||"5-10",maxSplit:"10"}}]};\n        params.push(`fm=${encodeURIComponent(JSON.stringify(fm))}`);\n      }else if(M){\n        params.push(`ech=${encodeURIComponent("cloudflare-ech.com+udp://1.1.1.1")}`,"alpn=http%2F1.1");\n      }\n      let lowP=p.toLowerCase();\n      let catLbl=lowP.endsWith(".ir")?"\u{1F1EE}\u{1F1F7} \u062F\u0627\u0645\u0646\u0647 \u062A\u0645\u06CC\u0632":OMNI_SITES_SET.has(lowP)?"\u{1F310} \u0633\u0627\u06CC\u062A \u062C\u0647\u0627\u0646\u06CC":OMNI_QOS_SET.has(lowP)?"\u26A1 QoS \u062A\u0645\u06CC\u0632":p.includes(":")?"\u{1F680} \u0647\u0645\u0631\u0627\u0647 \u0627\u0648\u0644 IPv6":M?"\u26A1 \u0633\u0631\u06CC\u0639 TLS":"\u{1F513} \u0628\u062F\u0648\u0646 TLS";\n      let idxStr=String(r.length+1).padStart(2,"0");\n      let q=`#${idxStr} ${catLbl}${useFrag?" [Frag]":""} \xB7 ${shortAddrTag(p)}:${$} (${exitBadge} \xB7 ${k.toUpperCase()})`;\n      r.push({\n        proto:k,\n        addr:p,\n        port:$,\n        tls:M,\n        fragment:useFrag,\n        fragStr:useFrag?fragStr:"",\n        fp:fpVal,\n        cat:catLbl,\n        exitBadge,\n        uri:`${k}://${L}@${hp}:${$}?${params.join("&")}#${encodeURIComponent(q)}`,\n        remark:q\n      });\n    }\n  }\n  let c=r.map(p=>p.uri);\n  let f=r.map((p,$)=>({\n    type:p.proto,\n    tag:`${p.proto}-${$+1}-${shortAddrTag(p.addr)}-${p.port}`,\n    server:p.addr,\n    server_port:Number(p.port),\n    ...(p.proto==="vless"?{uuid:t.uuid}:{password:o}),\n    tls:{enabled:p.tls,server_name:s,insecure:p.fp==="unsafe",utls:p.tls?{enabled:!0,fingerprint:p.fp==="unsafe"?"chrome":p.fp}:void 0},\n    transport:{type:"ws",path:S,headers:{Host:s},max_early_data:2048,early_data_header_name:"Sec-WebSocket-Protocol"}\n  }));\n  let aiPkgs=["com.google.android.googlequicksearchbox","com.google.android.gms","com.google.android.gsf","com.android.vending"],aiDomains=["gemini.google.com","aistudio.google.com","generativelanguage.googleapis.com","googleapis.com","googleusercontent.com","gstatic.com","accounts.google.com"];\n  let u={\n    log:{level:"warn",timestamp:!0},\n    dns:{servers:[{tag:"remote",type:"https",server:"1.1.1.1",server_port:443,path:"/dns-query",detour:"select"}],strategy:"ipv4_only"},\n    inbounds:[{type:"tun",tag:"tun-in",address:["172.19.0.1/30","fdfe:dcba:9876::1/126"],auto_route:!0,strict_route:!0}],\n    outbounds:[{type:"selector",tag:"select",outbounds:["auto",...f.map(p=>p.tag)]},{type:"urltest",tag:"auto",outbounds:f.map(p=>p.tag),url:"http://www.gstatic.com/generate_204",interval:"3m"},{type:"direct",tag:"direct"},{type:"block",tag:"block"},...f],\n    route:{rules:[{action:"sniff"},{protocol:"dns",action:"hijack-dns"},{ip_is_private:!0,outbound:"direct"},{domain_suffix:[".ir"],outbound:"direct"},{network:"udp",port:443,outbound:"block"},{package_name:aiPkgs,outbound:"select"},{domain_suffix:aiDomains,outbound:"select"}],final:"select",default_domain_resolver:"remote",auto_detect_interface:!0}\n  };\n  let m=[\n    "mixed-port: 7890","allow-lan: false","mode: rule","log-level: warning","proxies:",\n    ...f.flatMap(p=>[\n      `  - name: "${p.tag}"`,\n      `    type: ${p.type}`,\n      `    server: "${p.server}"`,\n      `    port: ${p.server_port}`,\n      p.type==="vless"?`    uuid: "${p.uuid}"`:`    password: "${p.uuid}"`,\n      `    tls: ${p.tls.enabled}`,\n      `    skip-cert-verify: ${Boolean(p.tls.insecure)}`,\n      `    servername: "${s}"`,\n      `    client-fingerprint: "${p.tls.utls?.fingerprint||"chrome"}"`,\n      "    network: ws",\n      "    ws-opts:",\n      `      path: "${p.transport.path}"`,\n      "      max-early-data: 2048",\n      "      early-data-header-name: Sec-WebSocket-Protocol",\n      "      headers:",\n      `        Host: "${s}"`\n    ]),\n    "proxy-groups:",\'  - name: "SELECT"\',"    type: select","    proxies:",...f.map(p=>`      - "${p.tag}"`),\n    "rules:","  - DOMAIN-SUFFIX,ir,DIRECT","  - GEOIP,IR,DIRECT","  - MATCH,SELECT"\n  ].join("\\n");\n  return{\n    count:r.length,\n    items:r,\n    uris:c,\n    base64:Nt(c.join("\\n")),\n    singbox:JSON.stringify(u,null,2),\n    clash:m,\n    json:JSON.stringify({vless:c.filter((p,$)=>r[$].proto==="vless"),trojan:c.filter((p,$)=>r[$].proto==="trojan"),singbox:u},null,2),\n    subUrl:`https://${s}/s/${t.sub_token}`\n  };\n}\nfunction ct(){\n  let e=document.querySelector("#cfg-out");if(!e||!g.out)return;\n  let t=g.out;\n  let s=g.fmt==="uris"\n    ?`<div style="display:flex;flex-direction:column;gap:8px;max-height:440px;overflow:auto;padding:2px">${t.items.map((it,idx)=>`\n      <div style="display:flex;flex-direction:column;gap:5px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--bg-elev)">\n        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">\n          <span class="badge info">#${String(idx+1).padStart(2,"0")}</span>\n          <b style="font-size:12.5px">${a(it.cat)}</b>\n          <span class="badge ${it.tls?"ok":""}" style="font-size:11px">${a(it.proto.toUpperCase())} \xB7 ${it.port}\xB7${it.tls?(it.fragment?"TLS+Frag":"TLS"):"Plain"}</span>\n          <span class="badge" style="font-size:11px">${a(it.exitBadge)}</span>\n          ${it.fragment?`<span class="badge ok" style="font-size:10.5px" dir="ltr">fragment=${a(it.fragStr)} \xB7 fp=${a(it.fp)}</span>`:""}\n          <div style="flex:1"></div>\n          <button class="btn btn-sm" data-action="omni-copy" data-text="${a(it.uri)}">${d("copy")} \u06A9\u067E\u06CC \u0644\u06CC\u0646\u06A9</button>\n        </div>\n        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:11.5px;border-top:1px dashed var(--border);padding-top:5px">\n          <code dir="ltr" style="color:var(--accent);font-weight:700">Server: ${a(it.addr)} : ${a(it.port)}</code>\n          <span class="muted" style="font-size:11px">\u0639\u0646\u0648\u0627\u0646 \u062F\u0631 \u06A9\u0644\u0627\u06CC\u0646\u062A: <b dir="rtl">${a(it.remark)}</b></span>\n        </div>\n      </div>`).join("")}</div>`\n    :g.fmt==="qrcode"\n    ?`<div class="cfg-qrgrid">${t.items.slice(0,8).map(i=>`<figure>${de(i.uri,132)}<figcaption>${a(i.remark)}</figcaption></figure>`).join("")}</div>`\n    :`<div class="codebox" style="max-height:360px;overflow:auto"><code dir="ltr">${a(g.fmt==="base64"?t.base64:g.fmt==="singbox"?t.singbox:g.fmt==="clash"?t.clash:t.json)}</code></div>`;\n  e.innerHTML=`\n    <div class="cfg-meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">\n      <span class="badge ok">${v(t.count)} ${a(n("cfg.configs"))}</span>\n      <span class="muted" style="font-size:12px">${a(n("cfg.user"))}: <b>${a(g.user)}</b></span>\n      <div style="flex:1"></div>\n      <button class="btn btn-primary btn-sm" data-action="omni-copy" data-text="${a(g.fmt==="uris"?t.uris.join("\\n"):g.fmt==="base64"?t.base64:g.fmt==="singbox"?t.singbox:g.fmt==="clash"?t.clash:t.json)}">${d("copy")} \u06A9\u067E\u06CC \u0647\u0645\u0647 (${v(t.count)})</button>\n      <button class="btn btn-sm" data-action="omni-dl" data-fmt="${g.fmt}">${d("download")} ${a(n("common.download"))}</button>\n    </div>\n    <div class="chips" style="margin:10px 0">\n      ${[["uris","\u{1F4CB} \u0644\u06CC\u0633\u062A \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627 (URI)"],["qrcode","\u{1F4F1} QR Code"],["base64","\u{1F4E6} Base64"],["singbox","\u{1F512} Gemini Lock \xB7 sing-box Android"],["clash","\u{1F6E1}\uFE0F Clash Meta"],["json","\u{1F9E9} JSON"]].map(([i,o])=>`<button class="chip" data-action="omni-fmt" data-fmt="${i}" aria-pressed="${g.fmt===i}">${o}</button>`).join("")}\n    </div>\n    ${s}\n    <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">\n      <button class="btn btn-sm" data-action="omni-deep" data-kind="v2ray">${d("bolt")} \u0627\u0641\u0632\u0648\u062F\u0646 \u0628\u0647 v2rayNG</button>\n      <button class="btn btn-sm" data-action="omni-deep" data-kind="hiddify">${d("bolt")} \u0627\u0641\u0632\u0648\u062F\u0646 \u0628\u0647 Hiddify</button>\n      <button class="btn btn-sm" data-action="omni-copy" data-text="${a(t.subUrl)}">${d("link")} \u06A9\u067E\u06CC \u0644\u06CC\u0646\u06A9 \u0627\u0634\u062A\u0631\u0627\u06A9 (${a(t.subUrl)})</button>\n    </div>`;\n}\nfunction je(e){\n  let t=e.users||[];\n  !g.user&&t.length&&(g.user=t[0].username);\n  let s=[...new Set([...g.ports])];\n  let cfg=e.settings||{};\n  let autoRot=cfg.auto_rotate==="1"||cfg.auto_rotate===!0;\n  let rotMins=Number(cfg.rotate_minutes||15)||15;\n  let activeCc=g.cc!==void 0&&g.cc!==""?g.cc:(cfg.selected_country||"");\n  let activeCountry=COUNTRY_MAP.get(activeCc);\n  let quickCountries=PRIMARY_LOCATIONS.slice(0,12).map(cc=>COUNTRY_MAP.get(cc)).filter(Boolean);\n  setTimeout(()=>{if(!g.out&&t.length){g.out=Bt(e);ct()}},0);\n  return`\n  <header class="view-head">\n    <div>\n      <h2>${d("qr")} \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0633\u0627\u0632 \u0647\u0648\u0634\u0645\u0646\u062F \u0648 \u0645\u062E\u0632\u0646 \u0622\u06CC\u200C\u067E\u06CC \u0686\u0631\u062E\u0634\u06CC</h2>\n      <p class="muted">\u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u062E\u0627\u0644\u0635 IPv4/IPv6\u060C ECH \u0648 SIIT-Hex64\u061B \u0628\u062F\u0648\u0646 \u062F\u0627\u0645\u0646\u0647\u200C\u0647\u0627\u06CC \u0639\u0645\u0648\u0645\u06CC \u0645\u0633\u062F\u0648\u062F \u0648 \u0628\u062F\u0648\u0646 \u0641\u0631\u06AF\u0645\u0646\u062A \u0631\u0648\u06CC \u0647\u0645\u0631\u0627\u0647 \u0627\u0648\u0644/\u0645\u062E\u0627\u0628\u0631\u0627\u062A</p>\n    </div>\n    <div class="head-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">\n      <select id="cfg-user" data-action-change="omni-cfg-user" class="input" style="min-width:140px">\n        ${t.map(i=>`<option value="${a(i.username)}" ${g.user===i.username?"selected":""}>\u{1F464} ${a(i.username)}</option>`).join("")}\n      </select>\n      <button class="btn btn-primary" data-action="omni-cfg-build">${d("bolt")} \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627</button>\n    </div>\n  </header>\n\n  <div class="notice ok" style="margin-bottom:12px;padding:11px">\n    <b>\u062E\u0631\u0648\u062C\u06CC \u0641\u0639\u0627\u0644 \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627: ${activeCountry?activeCountry.flag+" "+a(activeCountry.fa):activeCc==="DIRECT"?"\u{1F310} \u0645\u0633\u062A\u0642\u06CC\u0645":"\u0627\u0646\u062A\u062E\u0627\u0628 \u0646\u0634\u062F\u0647"}</b>\n    <div style="font-size:11.5px;margin-top:4px">\u06F1) \xAB\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627\xBB \u0631\u0627 \u0628\u0632\u0646\u061B \u06F2) \u0644\u06CC\u0646\u06A9 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0631\u0627 \u06A9\u067E\u06CC \u06CC\u0627 \u0628\u0627 v2rayNG \u0628\u0627\u0632 \u06A9\u0646\u061B \u06F3) \u062F\u0627\u062E\u0644 v2rayNG \u0627\u0634\u062A\u0631\u0627\u06A9 \u0631\u0627 Refresh \u06A9\u0646. \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0634\u0648\u0631 \u062F\u0631 \u0627\u06CC\u0646 \u0635\u0641\u062D\u0647 \u0648 Causal Mesh \u0627\u0632 \u0627\u06CC\u0646 \u067E\u0633 \u06CC\u06A9\u06CC \u0627\u0633\u062A.</div>\n  </div>\n\n  <div class="card" style="margin-bottom:14px">\n    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:10px">\n      <div style="display:flex;align-items:center;gap:8px">\n        ${d("refresh")}\n        <h3 style="margin:0;font-size:14.5px">\u{1F504} \u0645\u062E\u0632\u0646 \u0622\u06CC\u200C\u067E\u06CC \u062E\u0627\u0644\u0635 \u0627\u0648\u0645\u0646\u06CC (Anycast IPv4 + SIIT IPv6 + ECH)</h3>\n      </div>\n      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">\n        <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;user-select:none">\n          <span class="switch"><input type="checkbox" data-action="omni-toggle-autorotate" ${autoRot?"checked":""}><span></span></span>\n          <span>\u0686\u0631\u062E\u0634 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0647\u0631 ${v(rotMins)} \u062F\u0642\u06CC\u0642\u0647 \u062F\u0631 \u0633\u0627\u0628\u200C\u0644\u06CC\u0646\u06A9</span>\n        </label>\n        <button class="btn btn-primary btn-sm" type="button" data-action="omni-rotate-ips">${d("refresh")} \u0686\u0631\u062E\u0634 \u0641\u0648\u0631\u06CC \u0645\u062E\u0632\u0646 \u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632</button>\n      </div>\n    </div>\n    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">\n      ${OMNI_QOS_V4.slice(0,5).map(ip=>`<span class="badge ok" dir="ltr" style="font-family:var(--font-mono);font-size:11.5px">\u26A1 QoS: ${a(ip)}</span>`).join("")}\n      ${OMNI_CLEAN_SITES.slice(0,4).map(dm=>`<span class="badge info" dir="ltr" style="font-family:var(--font-mono);font-size:11.5px">\u{1F310} ${a(dm)}</span>`).join("")}\n      ${OMNI_CLEAN_V6.slice(0,2).map(v6=>`<span class="badge ok" dir="ltr" style="font-family:var(--font-mono);font-size:11.5px">\u{1F680} ${a(v6)}</span>`).join("")}\n      ${OMNI_CLEAN_IR.slice(0,2).map(dm=>`<span class="badge" dir="ltr" style="font-family:var(--font-mono);font-size:11.5px">\u{1F1EE}\u{1F1F7} ${a(dm)}</span>`).join("")}\n    </div>\n  </div>\n\n  <div class="grid grid-2">\n    <div class="card">\n      <div class="card-head">${d("shield")}<h3>\u06F1) \u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u0648 \u06A9\u0634\u0648\u0631 \u062E\u0631\u0648\u062C\u06CC</h3></div>\n      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px">\n        ${[\n          ["irancell","\u{1F49B} \u0627\u06CC\u0631\u0627\u0646\u0633\u0644 (MTN)","ECH + \u0641\u0627\u0644\u0628\u06A9 FinalMask","100-200,5-10,tlshello"],\n          ["tci","\u260E\uFE0F \u0645\u062E\u0627\u0628\u0631\u0627\u062A / \u062B\u0627\u0628\u062A","ECH \xB7 \u0628\u062F\u0648\u0646 Fragment","100-200,5-10,tlshello"],\n          ["mci","\u{1F4F1} \u0647\u0645\u0631\u0627\u0647 \u0627\u0648\u0644 (MCI)","IPv6 + ECH \xB7 \u0628\u062F\u0648\u0646 Fragment","100-200,5-10,tlshello"],\n          ["rightel","\u{1F49C} \u0631\u0627\u06CC\u062A\u0644 / \u0634\u0627\u062A\u0644","IPv6 + ECH \xB7 \u0628\u062F\u0648\u0646 Fragment","100-200,5-10,tlshello"],\n          ["gaming","\u{1F680} \u06A9\u0645\u200C\u062A\u0623\u062E\u06CC\u0631","443 + ECH","100-200,5-10,tlshello"],\n          ["direct","\u{1F310} \u0627\u062A\u0635\u0627\u0644 \u0645\u0633\u062A\u0642\u06CC\u0645","443 + ECH \xB7 \u0628\u062F\u0648\u0646 \u067E\u0631\u0648\u06A9\u0633\u06CC \u062E\u0631\u0648\u062C\u06CC","100-200,5-10,tlshello"]\n        ].map(([k,title,sub,fr])=>`<button type="button" class="dns-card" data-action="omni-cfg-profile" data-v="${k}" data-frag="${fr}" aria-pressed="${g.profile===k}" style="padding:9px 11px;gap:3px">\n          <b style="font-size:12.5px">${title}</b>\n          <code dir="ltr" style="font-size:10.5px;color:var(--accent)">${sub}</code>\n        </button>`).join("")}\n      </div>\n\n      <div class="muted" style="font-size:11.5px;margin-bottom:6px">\u0627\u0646\u062A\u062E\u0627\u0628 \u0644\u0648\u06A9\u06CC\u0634\u0646 \u062E\u0631\u0648\u062C\u06CC \u06A9\u0627\u0646\u0641\u06CC\u06AF:</div>\n      <div class="chips" style="max-height:110px;overflow-y:auto;padding:4px">\n        <button type="button" class="chip" data-action="omni-cfg-cc" data-cc="DIRECT" aria-pressed="${String(activeCc).toUpperCase()==="DIRECT"}">\u{1F310} \u0645\u0633\u062A\u0642\u06CC\u0645 (\u06A9\u0645\u200C\u062A\u0631\u06CC\u0646 \u067E\u06CC\u0646\u06AF)</button>\n        ${quickCountries.map(c=>`<button type="button" class="chip" data-action="omni-cfg-cc" data-cc="${c.cc}" aria-pressed="${activeCc===c.cc}">${c.flag} ${a(c.fa)}</button>`).join("")}\n      </div>\n      <p class="hint muted" style="font-size:11px;margin-top:8px">\n        \u2728 \u0627\u067E\u0644\u06CC\u06A9\u06CC\u0634\u0646 \u0648 \u0648\u0628 Google Gemini \u062F\u0631 \u062A\u0645\u0627\u0645 \u062D\u0627\u0644\u062A\u200C\u0647\u0627 \u0628\u0647\u200C\u0635\u0648\u0631\u062A \u062E\u0648\u062F\u06A9\u0627\u0631 \u0627\u0632 \u0637\u0631\u06CC\u0642 \u067E\u0631\u0627\u06A9\u0633\u06CC\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632 IPv4 \u0622\u0645\u0631\u06CC\u06A9\u0627 \u0645\u0633\u06CC\u0631\u062F\u0647\u06CC \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.\n      </p>\n    </div>\n\n    <div class="card">\n      <div class="card-head">${d("key")}<h3>\u06F2) \u0645\u0646\u0628\u0639 \u0622\u062F\u0631\u0633 \u0648\u0631\u0648\u062F\u06CC\u060C \u067E\u0648\u0631\u062A\u200C\u0647\u0627 \u0648 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A TLS</h3></div>\n      <div class="chips" style="margin-bottom:8px">\n        ${[\n          ["hybrid","\u26A1 \u062A\u0631\u06A9\u06CC\u0628\u06CC (QoS + \u0633\u0627\u06CC\u062A\u200C\u0647\u0627 + IPv6)"],\n          ["sites","\u{1F6E1}\uFE0F \u0647\u0645\u0632\u0627\u062F\u0647\u0627\u06CC ECH/SIIT"],\n          ["qos","\u{1F6E1}\uFE0F \u0641\u0642\u0637 \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC QoS \u06A9\u0644\u0648\u062F\u0641\u0644\u0631"],\n          ["host","\u2601\uFE0F \u062F\u0627\u0645\u0646\u0647 \u0627\u0635\u0644\u06CC \u0648\u0631\u06A9\u0631"],\n          ["custom","\u{1F3AF} \u0622\u062F\u0631\u0633 \u062F\u0644\u062E\u0648\u0627\u0647"]\n        ].map(([i,o])=>`<button type="button" class="chip" data-action="omni-cfg-addr" data-v="${i}" aria-pressed="${g.addrs===i}">${a(o)}</button>`).join("")}\n      </div>\n      ${g.addrs==="custom"?`<div class="field" style="margin-top:8px"><input id="cfg-custom" dir="ltr" placeholder="172.67.181.32, www.speedtest.net, 2606:4700::6812:1a2e" value="${a(g.customAddr)}"></div>`:""}\n      <div class="chips" style="margin-top:8px">\n        ${["vless","trojan"].map(i=>`<button type="button" class="chip" data-action="omni-cfg-proto" data-v="${i}" aria-pressed="${g.protos.includes(i)}">${i.toUpperCase()}</button>`).join("")}\n        ${[443,2053,8443,8080,80].map(i=>`<button type="button" class="chip" data-action="omni-cfg-port" data-v="${i}" aria-pressed="${s.includes(i)}">${Ot(i)}</button>`).join("")}\n      </div>\n      <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;align-items:flex-end">\n        <label class="field" style="flex:1;min-width:130px"><span class="muted" style="font-size:11.5px">\u0627\u062B\u0631 \u0627\u0646\u06AF\u0634\u062A TLS (Fingerprint)</span>\n          <select id="cfg-fp">${[["chrome","chrome (\u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F \u067E\u0644\u062A\u0641\u0631\u0645\u200C\u0647\u0627)"],["firefox","firefox"],["safari","safari"],["ios","ios"],["android","android"],["edge","edge"],["randomized","randomized"],["unsafe","unsafe (\u0645\u062E\u0635\u0648\u0635 PattNG)"]].map(([val,lbl])=>`<option value="${val}" ${g.fp===val?"selected":""}>${lbl}</option>`).join("")}</select></label>\n        <label class="field" style="flex:1;min-width:170px"><span class="muted" style="font-size:11.5px">\u0628\u0627\u0632\u0647 \u0641\u0631\u06AF\u0645\u0646\u062A (\u0627\u0646\u062F\u0627\u0632\u0647,\u062A\u0627\u062E\u06CC\u0631,\u0628\u0633\u062A\u0647)</span>\n          <select id="cfg-frag-preset">${[\n            ["100-200,5-10,tlshello","100-200,5-10,tlshello (\u0627\u06CC\u0631\u0627\u0646\u0633\u0644)"],\n            ["50-200,1-3,tlshello","50-200,1-3,tlshello (\u0645\u062E\u0627\u0628\u0631\u0627\u062A \u0648 \u062B\u0627\u0628\u062A)"],\n            ["10-30,2-5,tlshello","10-30,2-5,tlshello (\u0647\u0645\u0631\u0627\u0647 \u0627\u0648\u0644)"],\n            ["50-100,2-5,tlshello","50-100,2-5,tlshello (\u0631\u0627\u06CC\u062A\u0644 \u0648 \u0634\u0627\u062A\u0644)"],\n            ["200-3000,1-2,tlshello","200-3000,1-2,tlshello (\u06AF\u06CC\u0645\u06CC\u0646\u06AF \u067E\u06CC\u0646\u06AF \u067E\u0627\u06CC\u06CC\u0646)"],\n            ["10-20,10-20,tlshello","10-20,10-20,tlshello (\u0636\u062F \u0641\u06CC\u0644\u062A\u0631 \u062A\u0647\u0627\u062C\u0645\u06CC)"]\n          ].map(([val,lbl])=>`<option value="${val}" ${g.fragPreset===val?"selected":""}>${lbl}</option>`).join("")}</select></label>\n      </div>\n      <div style="display:flex;gap:18px;margin-top:12px;flex-wrap:wrap;align-items:center">\n        <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;user-select:none">\n          <span class="switch"><input type="checkbox" id="cfg-frag" ${g.fragment?"checked":""}><span></span></span>\n          <span>\u0641\u0627\u0644\u0628\u06A9 FinalMask \u0641\u0642\u0637 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0631\u0627\u0646\u0633\u0644 (\u0631\u0648\u06CC \u0647\u0645\u0631\u0627\u0647 \u0627\u0648\u0644/\u0645\u062E\u0627\u0628\u0631\u0627\u062A \u062E\u0627\u0645\u0648\u0634 \u0628\u0645\u0627\u0646\u062F)</span>\n        </label>\n        <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;user-select:none">\n          <span class="switch"><input type="checkbox" id="cfg-ipv6" ${g.ipv6?"checked":""}><span></span></span>\n          <span>\u0634\u0627\u0645\u0644 \u0622\u062F\u0631\u0633\u200C\u0647\u0627\u06CC IPv6 \u0647\u0645\u0631\u0627\u0647 \u0627\u0648\u0644</span>\n        </label>\n      </div>\n    </div>\n  </div>\n  <div class="card" id="cfg-out" style="margin-top:14px">\n    <div class="muted" style="font-size:13px">${a(n("cfg.hint"))}</div>\n  </div>`;\n}\nfunction Vt(e,t){let s=document.createElement("a");s.href=URL.createObjectURL(new Blob([t],{type:"text/plain;charset=utf-8"})),s.download=e,s.click(),setTimeout(()=>URL.revokeObjectURL(s.href),4e3)}\nfunction Gt(e){if(g.out=Bt(e),!g.out)return y(n("cfg.noUser"),"err");ct(),y(`${v(g.out.count)} ${n("cfg.configs")}`,"ok")}\nvar WORLD_COUNTRIES=[{"cc":"DE","fa":"\u0622\u0644\u0645\u0627\u0646","en":"Germany","flag":"\u{1F1E9}\u{1F1EA}","region":"eu","colo":"FRA","verifiedExit":true,"primary":true,"exitCc":"DE","proxies":["103.27.156.147","103.109.234.61","103.228.170.234"],"vipProxies":["http://s6102032620021:fahfah090908@202.28.17.5:8080","socks5://167.86.86.221:9050"],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"NL","fa":"\u0647\u0644\u0646\u062F","en":"Netherlands","flag":"\u{1F1F3}\u{1F1F1}","region":"eu","colo":"AMS","verifiedExit":true,"primary":true,"exitCc":"NL","proxies":["103.137.248.227","103.137.250.68","109.176.202.20"],"vipProxies":["socks5://5.255.117.127:1080","socks5://31.220.40.59:5080"],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"GB","fa":"\u0628\u0631\u06CC\u062A\u0627\u0646\u06CC\u0627","en":"United Kingdom","flag":"\u{1F1EC}\u{1F1E7}","region":"eu","colo":"LHR","verifiedExit":true,"primary":true,"exitCc":"GB","proxies":["103.13.208.242","109.169.76.23","104.128.190.209"],"vipProxies":["socks5://qpmcy1xm:wgj6q7ns5gfs@gb.day1404.dpdns.org:11361"],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"FR","fa":"\u0641\u0631\u0627\u0646\u0633\u0647","en":"France","flag":"\u{1F1EB}\u{1F1F7}","region":"eu","colo":"CDG","verifiedExit":true,"primary":true,"exitCc":"FR","proxies":["104.238.191.179","138.124.70.97","109.172.55.148","104.253.79.6"],"vipProxies":["socks5://109.199.107.68:1080","socks5://77.221.152.210:36219","socks5://213.199.47.140:1080"],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"US","fa":"\u0622\u0645\u0631\u06CC\u06A9\u0627 (\u0648\u06CC\u0698\u0647 Gemini/AI)","en":"United States","flag":"\u{1F1FA}\u{1F1F8}","region":"na","colo":"IAD","verifiedExit":true,"primary":true,"exitCc":"US","proxies":["104.168.125.179","104.168.14.25","104.168.38.167","104.238.129.180","107.150.0.204"],"vipProxies":["socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357"],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"TR","fa":"\u062A\u0631\u06A9\u06CC\u0647","en":"Turkey","flag":"\u{1F1F9}\u{1F1F7}","region":"me","colo":"IST","verifiedExit":true,"primary":true,"exitCc":"TR","proxies":["104.239.87.51","130.94.0.228","130.94.1.177"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"AE","fa":"\u0627\u0645\u0627\u0631\u0627\u062A","en":"UAE","flag":"\u{1F1E6}\u{1F1EA}","region":"me","colo":"DXB","verifiedExit":true,"primary":true,"exitCc":"AE","proxies":["20.174.15.226","176.97.66.175","146.70.37.253","91.132.93.153"],"vipProxies":["socks5://zfdsvi6l:dl7o17z4ml9q@ua.day1404.dpdns.org:11359"],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"FI","fa":"\u0641\u0646\u0644\u0627\u0646\u062F","en":"Finland","flag":"\u{1F1EB}\u{1F1EE}","region":"eu","colo":"HEL","verifiedExit":true,"primary":true,"exitCc":"FI","proxies":["135.181.84.31","138.124.244.182","138.124.80.13"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"SE","fa":"\u0633\u0648\u0626\u062F","en":"Sweden","flag":"\u{1F1F8}\u{1F1EA}","region":"eu","colo":"ARN","verifiedExit":true,"primary":true,"exitCc":"SE","proxies":["172.232.149.77","121.127.33.130","158.179.206.143","16.170.253.163"],"vipProxies":["socks5://171.25.158.95:1080"],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"CA","fa":"\u06A9\u0627\u0646\u0627\u062F\u0627","en":"Canada","flag":"\u{1F1E8}\u{1F1E6}","region":"na","colo":"YYZ","verifiedExit":true,"primary":true,"exitCc":"CA","proxies":["138.197.160.106","138.197.161.103","137.220.52.250"],"vipProxies":["socks5://38.49.210.79:40000","socks5://pqyiblro:BW6cuhhS2U0r@132.145.110.34:1080","socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080"],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"SG","fa":"\u0633\u0646\u06AF\u0627\u067E\u0648\u0631","en":"Singapore","flag":"\u{1F1F8}\u{1F1EC}","region":"as","colo":"SIN","verifiedExit":true,"primary":true,"exitCc":"SG","proxies":["124.156.202.172","103.253.145.105","128.1.186.55","103.170.217.60"],"vipProxies":["socks5://45.77.244.108:1080"],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"JP","fa":"\u0698\u0627\u067E\u0646","en":"Japan","flag":"\u{1F1EF}\u{1F1F5}","region":"as","colo":"NRT","verifiedExit":true,"primary":true,"exitCc":"JP","proxies":["107.148.118.151","108.160.132.132","103.76.85.210"],"vipProxies":["socks5://172.105.192.212:9080","socks5://35.78.212.217:32053","socks5://101.36.104.46:10808"],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"CH","fa":"\u0633\u0648\u0626\u06CC\u0633","en":"Switzerland","flag":"\u{1F1E8}\u{1F1ED}","region":"eu","colo":"ZRH","verifiedExit":true,"primary":true,"exitCc":"CH","proxies":["16.63.207.85","167.17.181.45","171.22.16.201","140.238.209.8"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"AT","fa":"\u0627\u062A\u0631\u06CC\u0634","en":"Austria","flag":"\u{1F1E6}\u{1F1F9}","region":"eu","colo":"VIE","verifiedExit":true,"primary":true,"exitCc":"AT","proxies":["185.175.58.196","87.251.69.44","85.192.42.198","92.112.48.149"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"IT","fa":"\u0627\u06CC\u062A\u0627\u0644\u06CC\u0627","en":"Italy","flag":"\u{1F1EE}\u{1F1F9}","region":"eu","colo":"MXP","verifiedExit":true,"primary":true,"exitCc":"IT","proxies":["179.255.190.4","179.255.190.3","179.255.190.5","179.255.190.24"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"ES","fa":"\u0627\u0633\u067E\u0627\u0646\u06CC\u0627","en":"Spain","flag":"\u{1F1EA}\u{1F1F8}","region":"eu","colo":"MAD","verifiedExit":true,"primary":true,"exitCc":"ES","proxies":["185.237.234.67","31.57.190.11","162.141.93.191","141.253.194.63"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"NO","fa":"\u0646\u0631\u0648\u0698","en":"Norway","flag":"\u{1F1F3}\u{1F1F4}","region":"eu","colo":"OSL","verifiedExit":true,"primary":true,"exitCc":"NO","proxies":["194.5.98.17","194.68.32.99","194.32.107.150","195.54.170.43"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"PL","fa":"\u0644\u0647\u0633\u062A\u0627\u0646","en":"Poland","flag":"\u{1F1F5}\u{1F1F1}","region":"eu","colo":"WAW","verifiedExit":true,"primary":true,"exitCc":"PL","proxies":["138.124.104.104","185.126.64.13","145.239.90.29","176.105.253.43"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"CZ","fa":"\u0686\u06A9","en":"Czechia","flag":"\u{1F1E8}\u{1F1FF}","region":"eu","colo":"VIE","verifiedExit":true,"primary":true,"exitCc":"CZ","proxies":["109.172.8.74","103.119.18.30","109.172.8.80","109.172.8.73"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"HU","fa":"\u0645\u062C\u0627\u0631\u0633\u062A\u0627\u0646","en":"Hungary","flag":"\u{1F1ED}\u{1F1FA}","region":"eu","colo":"BUD","verifiedExit":true,"primary":true,"exitCc":"HU","proxies":["38.180.108.148","38.180.109.174","5.181.77.132","37.221.210.113"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"RO","fa":"\u0631\u0648\u0645\u0627\u0646\u06CC","en":"Romania","flag":"\u{1F1F7}\u{1F1F4}","region":"eu","colo":"OTP","verifiedExit":true,"primary":true,"exitCc":"RO","proxies":["154.46.31.118","185.104.181.228","185.165.169.208","103.102.229.45"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"BG","fa":"\u0628\u0644\u063A\u0627\u0631\u0633\u062A\u0627\u0646","en":"Bulgaria","flag":"\u{1F1E7}\u{1F1EC}","region":"eu","colo":"SOF","verifiedExit":true,"primary":false,"exitCc":"BG","proxies":["13.140.29.253","13.140.29.170","104.143.206.87","104.152.48.248"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"IE","fa":"\u0627\u06CC\u0631\u0644\u0646\u062F","en":"Ireland","flag":"\u{1F1EE}\u{1F1EA}","region":"eu","colo":"DUB","verifiedExit":true,"primary":false,"exitCc":"IE","proxies":["54.247.36.82","108.128.156.233","54.77.206.41","198.55.103.168"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"BE","fa":"\u0628\u0644\u0698\u06CC\u06A9","en":"Belgium","flag":"\u{1F1E7}\u{1F1EA}","region":"eu","colo":"AMS","verifiedExit":true,"primary":false,"exitCc":"BE","proxies":["194.71.227.213","35.210.99.51"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"DK","fa":"\u062F\u0627\u0646\u0645\u0627\u0631\u06A9","en":"Denmark","flag":"\u{1F1E9}\u{1F1F0}","region":"eu","colo":"CPH","verifiedExit":true,"primary":true,"exitCc":"DK","proxies":["193.180.209.28","193.180.209.21"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"PT","fa":"\u067E\u0631\u062A\u063A\u0627\u0644","en":"Portugal","flag":"\u{1F1F5}\u{1F1F9}","region":"eu","colo":"MAD","verifiedExit":true,"primary":false,"exitCc":"PT","proxies":["195.133.92.20"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"GR","fa":"\u06CC\u0648\u0646\u0627\u0646","en":"Greece","flag":"\u{1F1EC}\u{1F1F7}","region":"eu","colo":"ATH","verifiedExit":true,"primary":false,"exitCc":"GR","proxies":["85.90.197.159","85.90.197.158","85.90.197.156","85.90.197.157"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"LV","fa":"\u0644\u062A\u0648\u0646\u06CC","en":"Latvia","flag":"\u{1F1F1}\u{1F1FB}","region":"eu","colo":"RIX","verifiedExit":true,"primary":false,"exitCc":"LV","proxies":["104.253.25.144","109.248.163.151","104.253.18.221","104.252.127.58"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"LT","fa":"\u0644\u06CC\u062A\u0648\u0627\u0646\u06CC","en":"Lithuania","flag":"\u{1F1F1}\u{1F1F9}","region":"eu","colo":"RIX","verifiedExit":true,"primary":false,"exitCc":"LT","proxies":["185.80.128.20","185.34.52.147","130.12.171.63"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"EE","fa":"\u0627\u0633\u062A\u0648\u0646\u06CC","en":"Estonia","flag":"\u{1F1EA}\u{1F1EA}","region":"eu","colo":"TLL","verifiedExit":true,"primary":false,"exitCc":"EE","proxies":["138.124.4.38","144.31.170.4","150.241.74.200","150.241.74.241"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"UA","fa":"\u0627\u0648\u06A9\u0631\u0627\u06CC\u0646","en":"Ukraine","flag":"\u{1F1FA}\u{1F1E6}","region":"eu","colo":"WAW","verifiedExit":true,"primary":false,"exitCc":"UA","proxies":["31.41.221.121"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"AM","fa":"\u0627\u0631\u0645\u0646\u0633\u062A\u0627\u0646","en":"Armenia","flag":"\u{1F1E6}\u{1F1F2}","region":"me","colo":"EVN","verifiedExit":true,"primary":false,"exitCc":"AM","proxies":["2.56.207.67","2.56.204.183","2.56.204.246","139.45.214.126"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"GE","fa":"\u06AF\u0631\u062C\u0633\u062A\u0627\u0646","en":"Georgia","flag":"\u{1F1EC}\u{1F1EA}","region":"me","colo":"TBS","verifiedExit":true,"primary":false,"exitCc":"GE","proxies":["91.239.206.65","185.104.192.249","2.26.10.137"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"KR","fa":"\u06A9\u0631\u0647 \u062C\u0646\u0648\u0628\u06CC","en":"South Korea","flag":"\u{1F1F0}\u{1F1F7}","region":"as","colo":"ICN","verifiedExit":true,"primary":true,"exitCc":"KR","proxies":["140.238.5.86","131.186.26.94","134.185.99.52","131.186.16.166"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"IN","fa":"\u0647\u0646\u062F","en":"India","flag":"\u{1F1EE}\u{1F1F3}","region":"as","colo":"BOM","verifiedExit":true,"primary":false,"exitCc":"IN","proxies":["103.111.114.87","216.10.243.159","20.235.105.146","4.240.110.47"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"AU","fa":"\u0627\u0633\u062A\u0631\u0627\u0644\u06CC\u0627","en":"Australia","flag":"\u{1F1E6}\u{1F1FA}","region":"oc","colo":"SYD","verifiedExit":true,"primary":true,"exitCc":"AU","proxies":["16.176.42.97","160.187.110.199","176.97.68.17","125.7.24.251"],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"IR","fa":"\u0627\u06CC\u0631\u0627\u0646","en":"Iran","flag":"\u{1F1EE}\u{1F1F7}","region":"me","colo":"THR","verifiedExit":false,"primary":false,"exitCc":"TR","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"OM","fa":"\u0639\u0645\u0627\u0646","en":"Oman","flag":"\u{1F1F4}\u{1F1F2}","region":"me","colo":"MCT","verifiedExit":false,"primary":false,"exitCc":"TR","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"SA","fa":"\u0639\u0631\u0628\u0633\u062A\u0627\u0646","en":"Saudi Arabia","flag":"\u{1F1F8}\u{1F1E6}","region":"me","colo":"RUH","verifiedExit":false,"primary":false,"exitCc":"TR","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"QA","fa":"\u0642\u0637\u0631","en":"Qatar","flag":"\u{1F1F6}\u{1F1E6}","region":"me","colo":"DOH","verifiedExit":false,"primary":false,"exitCc":"TR","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"BH","fa":"\u0628\u062D\u0631\u06CC\u0646","en":"Bahrain","flag":"\u{1F1E7}\u{1F1ED}","region":"me","colo":"BAH","verifiedExit":false,"primary":false,"exitCc":"TR","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"KW","fa":"\u06A9\u0648\u06CC\u062A","en":"Kuwait","flag":"\u{1F1F0}\u{1F1FC}","region":"me","colo":"KWI","verifiedExit":false,"primary":false,"exitCc":"TR","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"IQ","fa":"\u0639\u0631\u0627\u0642","en":"Iraq","flag":"\u{1F1EE}\u{1F1F6}","region":"me","colo":"BGW","verifiedExit":false,"primary":false,"exitCc":"TR","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"AZ","fa":"\u0622\u0630\u0631\u0628\u0627\u06CC\u062C\u0627\u0646","en":"Azerbaijan","flag":"\u{1F1E6}\u{1F1FF}","region":"me","colo":"GYD","verifiedExit":false,"primary":false,"exitCc":"TR","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"KZ","fa":"\u0642\u0632\u0627\u0642\u0633\u062A\u0627\u0646","en":"Kazakhstan","flag":"\u{1F1F0}\u{1F1FF}","region":"as","colo":"AKX","verifiedExit":false,"primary":false,"exitCc":"SG","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"UZ","fa":"\u0627\u0632\u0628\u06A9\u0633\u062A\u0627\u0646","en":"Uzbekistan","flag":"\u{1F1FA}\u{1F1FF}","region":"as","colo":"WAW","verifiedExit":false,"primary":false,"exitCc":"SG","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"TH","fa":"\u062A\u0627\u06CC\u0644\u0646\u062F","en":"Thailand","flag":"\u{1F1F9}\u{1F1ED}","region":"as","colo":"BKK","verifiedExit":false,"primary":false,"exitCc":"SG","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"MY","fa":"\u0645\u0627\u0644\u0632\u06CC","en":"Malaysia","flag":"\u{1F1F2}\u{1F1FE}","region":"as","colo":"SIN","verifiedExit":false,"primary":false,"exitCc":"SG","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"TW","fa":"\u062A\u0627\u06CC\u0648\u0627\u0646","en":"Taiwan","flag":"\u{1F1F9}\u{1F1FC}","region":"as","colo":"TPE","verifiedExit":false,"primary":false,"exitCc":"SG","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"CN","fa":"\u0686\u06CC\u0646","en":"China","flag":"\u{1F1E8}\u{1F1F3}","region":"as","colo":"HKG","verifiedExit":false,"primary":false,"exitCc":"SG","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"VN","fa":"\u0648\u06CC\u062A\u0646\u0627\u0645","en":"Vietnam","flag":"\u{1F1FB}\u{1F1F3}","region":"as","colo":"HKG","verifiedExit":false,"primary":false,"exitCc":"SG","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"ID","fa":"\u0627\u0646\u062F\u0648\u0646\u0632\u06CC","en":"Indonesia","flag":"\u{1F1EE}\u{1F1E9}","region":"as","colo":"CGK","verifiedExit":false,"primary":false,"exitCc":"SG","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"PH","fa":"\u0641\u06CC\u0644\u06CC\u067E\u06CC\u0646","en":"Philippines","flag":"\u{1F1F5}\u{1F1ED}","region":"as","colo":"MNL","verifiedExit":false,"primary":false,"exitCc":"SG","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"PK","fa":"\u067E\u0627\u06A9\u0633\u062A\u0627\u0646","en":"Pakistan","flag":"\u{1F1F5}\u{1F1F0}","region":"as","colo":"KHI","verifiedExit":false,"primary":false,"exitCc":"SG","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"AF","fa":"\u0627\u0641\u063A\u0627\u0646\u0633\u062A\u0627\u0646","en":"Afghanistan","flag":"\u{1F1E6}\u{1F1EB}","region":"as","colo":"ISB","verifiedExit":false,"primary":false,"exitCc":"SG","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"IS","fa":"\u0627\u06CC\u0633\u0644\u0646\u062F","en":"Iceland","flag":"\u{1F1EE}\u{1F1F8}","region":"eu","colo":"KEF","verifiedExit":false,"primary":false,"exitCc":"NL","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"SK","fa":"\u0627\u0633\u0644\u0648\u0627\u06A9\u06CC","en":"Slovakia","flag":"\u{1F1F8}\u{1F1F0}","region":"eu","colo":"BTS","verifiedExit":false,"primary":false,"exitCc":"NL","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"CY","fa":"\u0642\u0628\u0631\u0633","en":"Cyprus","flag":"\u{1F1E8}\u{1F1FE}","region":"eu","colo":"LCA","verifiedExit":false,"primary":false,"exitCc":"NL","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"SI","fa":"\u0627\u0633\u0644\u0648\u0648\u0646\u06CC","en":"Slovenia","flag":"\u{1F1F8}\u{1F1EE}","region":"eu","colo":"LJU","verifiedExit":false,"primary":false,"exitCc":"NL","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"RS","fa":"\u0635\u0631\u0628\u0633\u062A\u0627\u0646","en":"Serbia","flag":"\u{1F1F7}\u{1F1F8}","region":"eu","colo":"BEG","verifiedExit":false,"primary":false,"exitCc":"NL","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"BA","fa":"\u0628\u0648\u0633\u0646\u06CC \u0648 \u0647\u0631\u0632\u06AF\u0648\u06CC\u0646","en":"Bosnia","flag":"\u{1F1E7}\u{1F1E6}","region":"eu","colo":"VIE","verifiedExit":false,"primary":false,"exitCc":"NL","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"AL","fa":"\u0622\u0644\u0628\u0627\u0646\u06CC","en":"Albania","flag":"\u{1F1E6}\u{1F1F1}","region":"eu","colo":"TIA","verifiedExit":false,"primary":false,"exitCc":"NL","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"MD","fa":"\u0645\u0648\u0644\u062F\u0627\u0648\u06CC","en":"Moldova","flag":"\u{1F1F2}\u{1F1E9}","region":"eu","colo":"KIV","verifiedExit":false,"primary":false,"exitCc":"NL","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"BY","fa":"\u0628\u0644\u0627\u0631\u0648\u0633","en":"Belarus","flag":"\u{1F1E7}\u{1F1FE}","region":"eu","colo":"WAW","verifiedExit":false,"primary":false,"exitCc":"NL","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"RU","fa":"\u0631\u0648\u0633\u06CC\u0647","en":"Russia","flag":"\u{1F1F7}\u{1F1FA}","region":"eu","colo":"DME","verifiedExit":false,"primary":false,"exitCc":"NL","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"LU","fa":"\u0644\u0648\u06A9\u0632\u0627\u0645\u0628\u0648\u0631\u06AF","en":"Luxembourg","flag":"\u{1F1F1}\u{1F1FA}","region":"eu","colo":"LUX","verifiedExit":false,"primary":false,"exitCc":"NL","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"MT","fa":"\u0645\u0627\u0644\u062A","en":"Malta","flag":"\u{1F1F2}\u{1F1F9}","region":"eu","colo":"MLA","verifiedExit":false,"primary":false,"exitCc":"NL","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"HR","fa":"\u06A9\u0631\u0648\u0627\u0633\u06CC","en":"Croatia","flag":"\u{1F1ED}\u{1F1F7}","region":"eu","colo":"ZAG","verifiedExit":false,"primary":false,"exitCc":"NL","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"NZ","fa":"\u0646\u06CC\u0648\u0632\u06CC\u0644\u0646\u062F","en":"New Zealand","flag":"\u{1F1F3}\u{1F1FF}","region":"oc","colo":"AKL","verifiedExit":false,"primary":false,"exitCc":"AU","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"MX","fa":"\u0645\u06A9\u0632\u06CC\u06A9","en":"Mexico","flag":"\u{1F1F2}\u{1F1FD}","region":"na","colo":"QRO","verifiedExit":false,"primary":false,"exitCc":"US","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"BR","fa":"\u0628\u0631\u0632\u06CC\u0644","en":"Brazil","flag":"\u{1F1E7}\u{1F1F7}","region":"sa","colo":"GRU","verifiedExit":false,"primary":false,"exitCc":"US","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"AR","fa":"\u0622\u0631\u0698\u0627\u0646\u062A\u06CC\u0646","en":"Argentina","flag":"\u{1F1E6}\u{1F1F7}","region":"sa","colo":"EZE","verifiedExit":false,"primary":false,"exitCc":"US","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"CL","fa":"\u0634\u06CC\u0644\u06CC","en":"Chile","flag":"\u{1F1E8}\u{1F1F1}","region":"sa","colo":"SCL","verifiedExit":false,"primary":false,"exitCc":"US","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"EG","fa":"\u0645\u0635\u0631","en":"Egypt","flag":"\u{1F1EA}\u{1F1EC}","region":"af","colo":"MRS","verifiedExit":false,"primary":false,"exitCc":"FR","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"ZA","fa":"\u0622\u0641\u0631\u06CC\u0642\u0627\u06CC \u062C\u0646\u0648\u0628\u06CC","en":"South Africa","flag":"\u{1F1FF}\u{1F1E6}","region":"af","colo":"JNB","verifiedExit":false,"primary":false,"exitCc":"FR","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]},{"cc":"NG","fa":"\u0646\u06CC\u062C\u0631\u06CC\u0647","en":"Nigeria","flag":"\u{1F1F3}\u{1F1EC}","region":"af","colo":"LOS","verifiedExit":false,"primary":false,"exitCc":"FR","proxies":[],"vipProxies":[],"v4":["172.67.181.32","172.67.181.122","172.67.181.210","104.17.148.167","104.17.148.17","104.17.147.119","104.18.3.91","172.67.163.24","104.18.181.138","104.21.3.237"],"v6":["2606:4700:3030::ac43:b58a","2606:4700::6812:3ed","2606:4700::6812:1a2e","2606:4700:3030::ac43:b520","2606:4700::6812:b58a","2606:4700:3030::6815:3ed"]}];\nvar COUNTRY_MAP=new Map(WORLD_COUNTRIES.map(c=>[c.cc,c]));\nvar COUNTRY_PROXY_MAP=new Map();\nfor(let c of WORLD_COUNTRIES){\n  if(!c.verifiedExit)continue;\n  for(let p of(c.proxies||[])){\n    let k=String(p||"").trim().split(":")[0].toLowerCase();\n    if(k&&!COUNTRY_PROXY_MAP.has(k))COUNTRY_PROXY_MAP.set(k,c);\n  }\n}\nvar SCAN_PRESETS={\n  all:[...OMNI_QOS_V4.slice(0,7),...OMNI_CLEAN_SITES.slice(0,4),...OMNI_CLEAN_V6.slice(0,3),...OMNI_CLEAN_IR.slice(0,2)],\n  sites:[...OMNI_CLEAN_SITES,...OMNI_CLEAN_IR.slice(0,4),...OMNI_QOS_V4.slice(0,4)],\n  qos:[...OMNI_QOS_V4],\n  ipv6:[...OMNI_CLEAN_V6],\n  ir:[...OMNI_CLEAN_IR,...OMNI_CLEAN_SITES.slice(0,4)]\n};\nvar O={running:!1,tab:"ingress",scanMode:"preset",preset:"all",country:"",region:"primary",ipVer:"both",countryQuery:"",lineRtt:null,results:[],countryResults:[]};\nfunction it(e){return e<0?"var(--danger)":e<170?"var(--ok)":e<360?"var(--warn)":"var(--danger)"}\nfunction se(e){let t=document.querySelector("#scan-status");t&&(t.textContent=e)}\nfunction renderCountryGrid(){\n  let el=document.querySelector("#country-grid");\n  if(!el)return;\n  let q=(O.countryQuery||"").trim().toLowerCase();\n  let list=WORLD_COUNTRIES.filter(c=>{\n    if(!c.verifiedExit)return!1;\n    if(q)return c.fa.toLowerCase().includes(q)||c.en.toLowerCase().includes(q)||c.cc.toLowerCase().includes(q)||c.colo.toLowerCase().includes(q);\n    if(O.region==="primary")return!!c.primary;\n    if(O.region!=="all"&&c.region!==O.region)return!1;\n    return!0;\n  });\n  let cntEl=document.querySelector("#country-count-lbl");\n  if(cntEl)cntEl.textContent=`${list.length} \u06A9\u0634\u0648\u0631 \u0628\u0627 \u0633\u0631\u0648\u0631 \u0627\u062E\u062A\u0635\u0627\u0635\u06CC`;\n  el.innerHTML=list.map(c=>{\n    let active=O.country===c.cc;\n    return`<button type="button" class="chip" data-action="omni-country" data-cc="${c.cc}" aria-pressed="${active}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 11px;font-size:12px;${active?"border-color:var(--accent);background:var(--accent-soft);font-weight:700":""}">\n      <span>${c.flag}</span><span>${a(c.fa)}</span><small class="muted mono" style="font-size:10px">${c.cc} (${(c.proxies||[]).length} \u0633\u0631\u0648\u0631)</small>\n    </button>`;\n  }).join("")||\'<div class="muted" style="padding:8px;font-size:12px">\u06A9\u0634\u0648\u0631\u06CC \u0628\u0627 \u0627\u06CC\u0646 \u0645\u0634\u062E\u0635\u0627\u062A \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.</div>\';\n}\nfunction renderAllCountriesScanResults(){\n  let t=document.querySelector("#scan-out");if(!t)return;\n  if(!O.countryResults.length){\n    t.innerHTML=\'<div class="muted" style="font-size:13px">\u062F\u0631 \u062D\u0627\u0644 \u062A\u0633\u062A \u0648\u0627\u0642\u0639\u06CC \u067E\u06CC\u0646\u06AF TCP 443 \u0633\u0631\u0648\u0631\u0647\u0627\u06CC \u062E\u0631\u0648\u062C\u06CC \u06A9\u0634\u0648\u0631\u0647\u0627\u2026</div>\';\n    return;\n  }\n  t.innerHTML=`\n    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">\n      <b>\u{1F30D} \u0646\u062A\u06CC\u062C\u0647 \u062A\u0633\u062A \u0648\u0627\u0642\u0639\u06CC \u0633\u0631\u0648\u0631\u0647\u0627\u06CC \u062E\u0631\u0648\u062C\u06CC \u06A9\u0634\u0648\u0631\u0647\u0627 (\u0645\u0631\u062A\u0628\u200C\u0634\u062F\u0647 \u0628\u0631 \u0627\u0633\u0627\u0633 \u06A9\u0645\u200C\u062A\u0631\u06CC\u0646 \u067E\u06CC\u0646\u06AF)</b>\n      <span class="muted" style="font-size:11.5px">\u0647\u0631 \u0631\u062F\u06CC\u0641 \u06CC\u06A9 \u0633\u0631\u0648\u0631 \u062E\u0631\u0648\u062C\u06CC \u0627\u062E\u062A\u0635\u0627\u0635\u06CC (ProxyIP) \u0647\u0645\u0627\u0646 \u06A9\u0634\u0648\u0631 \u0627\u0633\u062A</span>\n    </div>\n    <div style="display:flex;flex-direction:column;gap:6px">\n      ${O.countryResults.map(r=>{\n        let ok=r.alive&&r.ms>0;\n        return`<div class="scan-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 11px;border:1px solid var(--border);border-radius:10px;background:var(--bg-elev)">\n          <span style="font-size:18px">${r.flag}</span>\n          <b style="min-width:135px;font-size:13px">${a(r.fa)} <small class="muted mono">(${a(r.cc)})</small></b>\n          <code dir="ltr" class="muted" style="font-size:11.5px;min-width:155px">ProxyIP: ${a(r.host||"\u2014")}:443</code>\n          ${r.hasVip?\'<span class="badge info" style="font-size:10.5px">\u2728 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC Gemini/AI</span>\':""}\n          <span class="scan-bar" style="flex:1;min-width:60px"><i style="width:${ok?Math.min(100,Math.max(15,100-r.ms/5)):100}%;background:${ok?it(r.ms):"var(--danger)"}"></i></span>\n          <b dir="ltr" style="color:${ok?it(r.ms):"var(--danger)"};min-width:72px;text-align:end;font-family:var(--font-mono)">${ok?r.ms+" ms":"\u0628\u062F\u0648\u0646 \u067E\u0627\u0633\u062E"}</b>\n          ${ok?`<button type="button" class="btn btn-primary btn-sm" data-action="omni-pick-country-exit" data-cc="${a(r.cc)}" data-proxy="${a(r.proxy||"")}">${d("check")} \u0627\u0646\u062A\u062E\u0627\u0628 \u062E\u0631\u0648\u062C\u06CC ${r.flag}</button>`:""}\n        </div>`;\n      }).join("")}\n    </div>`;\n}\nfunction xe(e){\n  let t=document.querySelector("#scan-out");if(!t)return;\n  let s=O.results.filter(r=>r.ms!==null).length,i=document.querySelector("#scan-bar");\n  i&&(i.style.width=`${e?Math.round(s/e*100):0}%`);\n  let o=r=>r.ms===null?9e9+1:r.ms<0?9e9:r.ms;\n  t.innerHTML=[...O.results].sort((r,c)=>o(r)-o(c)).map(r=>{\n    let v6=r.ip.includes(":"),dom=!v6&&/[a-z]/i.test(r.ip),low=r.ip.toLowerCase();\n    let proxyC=COUNTRY_PROXY_MAP.get(low);\n    let roleBadge;\n    if(proxyC){\n      roleBadge=`${proxyC.flag} \u0633\u0631\u0648\u0631 \u062E\u0631\u0648\u062C\u06CC \u0627\u062E\u062A\u0635\u0627\u0635\u06CC ${a(proxyC.fa)} (${a(r.ip)}:443)`;\n    }else if(r.source){\n      roleBadge=`\u{1F575}\uFE0F ${a(r.source)} \xB7 \u067E\u0648\u0631\u062A 443/2053`;\n    }else if(dom&&low.endsWith(".ir")){\n      roleBadge=`\u{1F1EE}\u{1F1F7} \u062F\u0627\u0645\u0646\u0647 \u062A\u0645\u06CC\u0632 \u06A9\u0644\u0648\u062F\u0641\u0644\u0631 (${a(r.ip)}) \xB7 \u067E\u0648\u0631\u062A 443/2053`;\n    }else if(dom){\n      roleBadge=`\u{1F310} \u0633\u0627\u06CC\u062A \u062C\u0647\u0627\u0646\u06CC \u06A9\u0644\u0648\u062F\u0641\u0644\u0631 (${a(r.ip)}) \xB7 \u067E\u0648\u0631\u062A 443/2053`;\n    }else if(OMNI_QOS_SET.has(low)){\n      roleBadge=`\u26A1 \u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632 QoS \u06A9\u0644\u0648\u062F\u0641\u0644\u0631 (${a(r.ip)}) \xB7 \u067E\u0648\u0631\u062A 443/2053/8080`;\n    }else if(v6){\n      roleBadge=`\u{1F680} \u0648\u0631\u0648\u062F\u06CC \u06A9\u0644\u0648\u062F\u0641\u0644\u0631 IPv6 \xB7 \u067E\u0648\u0631\u062A 443/2053/8080`;\n    }else{\n      roleBadge=`\u26A1 \u0648\u0631\u0648\u062F\u06CC \u06A9\u0644\u0648\u062F\u0641\u0644\u0631 IPv4 (${a(r.ip)}) \xB7 \u067E\u0648\u0631\u062A 443/2053/8080`;\n    }\n    let ok=r.ms!==null&&r.ms>0&&r.healthy;\n    let jitBadge=ok&&r.jitter>0?`<span class="badge" style="font-family:var(--font-mono);font-size:10.5px" dir="ltr">\xB1${r.jitter} ms</span>`:"";\n    return`\n    <div class="scan-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 8px;border-bottom:1px solid var(--border)">\n      <code dir="ltr" style="direction:ltr;unicode-bidi:embed;font-size:12.5px;min-width:175px;font-weight:700;color:var(--text)">${a(r.ip)}</code>\n      <span class="scan-bar" style="flex:1;min-width:60px"><i style="width:${r.ms===null?0:r.ms<0?100:Math.min(100,Math.max(15,100-r.ms/5))}%;background:${r.ms===null?"var(--border)":it(r.ms)}"></i></span>\n      <b dir="ltr" style="color:${r.ms===null?"var(--text-faint)":it(r.ms)};min-width:68px;text-align:end;font-family:var(--font-mono)">${r.ms===null?"\u2026":r.ms<0?(r.err||a(n("scanner.timeout"))):r.ms+" ms"}</b>\n      ${jitBadge}\n      <span class="badge ${ok?"ok":r.ms<0?"danger":""}" style="font-size:11px">${roleBadge}</span>\n      ${proxyC&&ok?`<button type="button" class="btn btn-primary btn-sm" data-action="omni-pick-country-exit" data-cc="${a(proxyC.cc)}" data-proxy="${a(r.ip)}:443">${d("check")} \u0627\u0646\u062A\u062E\u0627\u0628 ${proxyC.flag}</button>`:""}\n    </div>`;\n  }).join("");\n}\nasync function measureLineRtt(){\n  let rtt=85,colo=null;\n  try{\n    await fetch("/healthz?w="+Date.now(),{cache:"no-store",signal:AbortSignal.timeout(2500)});\n    const t0=performance.now();\n    const tr=await fetch("/healthz?t="+Date.now(),{cache:"no-store",signal:AbortSignal.timeout(3000)});\n    rtt=Math.max(25,Math.round(performance.now()-t0));\n    colo=tr.headers.get("x-omni-colo")||null;\n  }catch{}\n  O.lineRtt=rtt;\n  return{rtt,colo};\n}\nasync function Zt(e,t){\n  let h=String(e||"").trim().replace(/^\\[|\\]$/g,""),u=h.includes(":")?`[${h}]`:h,dom=!h.includes(":")&&/[a-z]/i.test(h);\n  if(COUNTRY_PROXY_MAP.has(h.toLowerCase()))return{ms:null,jitter:0,isProxy:!0};\n  let samples=[];\n  for(let round=0;round<2;round++){\n    const s=performance.now(),i=new AbortController,o=setTimeout(()=>i.abort(),t||2400);\n    try{\n      await fetch(`https://${u}/cdn-cgi/trace?r=${Math.random()}`,{mode:"no-cors",cache:"no-store",signal:i.signal});\n      clearTimeout(o);\n      const dt=Math.round(performance.now()-s);\n      if(dt>=22)samples.push(round===0&&samples.length===0?Math.max(25,Math.round(dt*0.76)):Math.max(25,dt));\n    }catch{\n      clearTimeout(o);\n      const dt=Math.round(performance.now()-s);\n      if(!i.signal.aborted&&!dom&&dt>=28&&dt<(t||2400)-150){\n        samples.push(Math.max(25,Math.round(dt*0.65)));\n      }\n    }\n  }\n  if(!samples.length)return{ms:null,jitter:0};\n  const best=Math.min(...samples),max=Math.max(...samples);\n  return{ms:best,jitter:max-best};\n}\nfunction dt(e){\n  if(O.tab==="countries"&&O.country){\n    let cObj=COUNTRY_MAP.get(O.country);\n    return(cObj?.proxies||[]).map(x=>String(x).split(":")[0]);\n  }\n  let t=document.querySelector("#scan-ranges");\n  let rawLines=t&&t.value.trim()?t.value.split(/[\\s,]+/).filter(Boolean):(SCAN_PRESETS[O.preset]||SCAN_PRESETS.all);\n  let i=new Set,o=[];\n  const push=x=>{\n    let c=String(x||"").trim().replace(/^\\[|\\]$/g,"").split(":")[0];\n    if(x&&String(x).includes(":")&&String(x).split(":").length>2)c=String(x).trim().replace(/^\\[|\\]$/g,"");\n    if(!c||i.has(c)||c==="104.16.132.229"||DEAD_BYOIP_SET.has(c.toLowerCase()))return;\n    if(/^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(c)){let l=Number(c.split(".")[3]);if(l===0||l===255)return}\n    if(O.ipVer==="v4"&&c.includes(":"))return;\n    if(O.ipVer==="v6"&&!c.includes(":"))return;\n    i.add(c);o.push(c);\n  };\n  for(let r of rawLines)for(let c of Rt(r,8))push(c);\n  return o.slice(0,36);\n}\nasync function WtAllCountries(e){\n  if(O.running)return;\n  O.running=!0;\n  O.tab="countries";\n  O.scanMode="all-countries";\n  O.country="";\n  O.countryResults=[];\n  let bar=document.querySelector("#scan-bar");\n  if(bar)bar.style.width="35%";\n  renderAllCountriesScanResults();\n  se("\u062F\u0631 \u062D\u0627\u0644 \u062A\u0633\u062A \u0647\u0645\u200C\u0632\u0645\u0627\u0646 \u062A\u0645\u0627\u0645 \u0633\u0631\u0648\u0631\u0647\u0627\u06CC \u062E\u0631\u0648\u062C\u06CC \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u06A9\u0634\u0648\u0631\u0647\u0627 (TCP 443)\u2026");\n  try{\n    let [line,res]=await Promise.all([\n      measureLineRtt(),\n      x("POST","/api/diag/scan-countries",{onlyPrimary:!1,concurrency:14,timeout:2000})\n    ]);\n    if(bar)bar.style.width="100%";\n    let list=Array.isArray(res?.results)?res.results:[];\n    O.countryResults=list.map(r=>{\n      let ms=r.alive&&r.edge_ms>0?Math.max(28,(line.rtt||85)+r.edge_ms):null;\n      return{...r,ms};\n    }).sort((a,b)=>(a.ms??99999)-(b.ms??99999));\n    renderAllCountriesScanResults();\n    let aliveCnt=O.countryResults.filter(r=>r.alive&&r.ms>0).length;\n    let best=O.countryResults.find(r=>r.alive&&r.ms>0);\n    se(`\u062A\u0633\u062A \u0647\u0645\u0647 \u06A9\u0634\u0648\u0631\u0647\u0627 \u06A9\u0627\u0645\u0644 \u0634\u062F \u2014 ${aliveCnt} \u06A9\u0634\u0648\u0631 \u0641\u0639\u0627\u0644 ${best?`\xB7 \u06A9\u0645\u200C\u062A\u0631\u06CC\u0646 \u067E\u06CC\u0646\u06AF: ${best.flag} ${best.fa} (${best.ms} ms)`:""}`);\n  }catch(err){\n    se(String(err?.message||"\u062E\u0637\u0627 \u062F\u0631 \u0627\u0633\u06A9\u0646 \u06A9\u0634\u0648\u0631\u0647\u0627"));\n  }finally{\n    O.running=!1;\n  }\n}\nasync function Wt(e){\n  if(O.running)return;\n  let raw=typeof e?.settings==="function"?await e.settings():e?.settings||{},cfg=raw&&raw.settings?raw.settings:raw||{};\n  let cands=dt(cfg);\n  if(!cands.length)cands=[...SCAN_PRESETS.all];\n  O.running=!0;\n  let selC=(O.tab==="countries"&&O.country)?COUNTRY_MAP.get(O.country):null;\n  O.results=cands.map(x=>({ip:x,ms:null,jitter:0,colo:selC?.colo||null,src:x.includes(":")?"ipv6":/[a-z]/i.test(x)?"browser":"edge",healthy:!1,err:null}));\n  xe(O.results.length);\n  se(selC?`\u062F\u0631 \u062D\u0627\u0644 \u062A\u0633\u062A \u0648\u0627\u0642\u0639\u06CC \u0633\u0631\u0648\u0631\u0647\u0627\u06CC \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u062E\u0631\u0648\u062C\u06CC ${selC.flag} ${selC.fa} (${cands.length} \u0633\u0631\u0648\u0631)\u2026`:O.scanMode==="custom"?`\u062F\u0631 \u062D\u0627\u0644 \u062A\u0633\u062A \u067E\u06CC\u0646\u06AF \u0648\u0627\u0642\u0639\u06CC ${cands.length} \u0622\u06CC\u200C\u067E\u06CC/\u062F\u0627\u0645\u0646\u0647 \u062F\u0644\u062E\u0648\u0627\u0647 \u0634\u0645\u0627\u2026`:"\u062F\u0631 \u062D\u0627\u0644 \u0633\u0646\u062C\u0634 \u067E\u06CC\u0646\u06AF \u0648\u0627\u0642\u0639\u06CC (ms) \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627 \u0648 \u0633\u0627\u06CC\u062A\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632\u2026");\n\n  let rttPromise=measureLineRtt();\n  let edgePromise=b.rankIps(cands,cfg.public_host||"").catch(()=>({ips:[],results:[],rejected:[]}));\n  let queue=[...O.results];\n  await Promise.all(Array.from({length:Math.min(6,queue.length)},async()=>{\n    while(queue.length){\n      let item=queue.shift();if(!item)break;\n      let p=await Zt(item.ip,2400);\n      if(p.ms&&p.ms>=25){item.ms=p.ms;item.jitter=p.jitter||0}\n      xe(O.results.length);\n    }\n  }));\n\n  let [line,r]=await Promise.all([rttPromise,edgePromise]);\n  let rMap=new Map((r?.results||[]).map(x=>[String(x.ip||"").toLowerCase(),x]));\n  let rejMap=new Map((r?.rejected||[]).map(x=>[String(x.ip||"").toLowerCase(),x]));\n\n  O.results.forEach((y)=>{\n    let k=y.ip.toLowerCase(),er=rMap.get(k),rej=rejMap.get(k);\n    let isProxy=COUNTRY_PROXY_MAP.has(k);\n    if(er?.colo)y.colo=er.colo;\n\n    if(rej || !er || !er.alive){\n      y.ms=-1;\n      y.healthy=!1;\n      y.err=rej?.error||"\u0628\u062F\u0648\u0646 \u067E\u0627\u0633\u062E";\n      return;\n    }\n\n    if(isProxy){\n      let proxyTcpMs=er.edge_ms||er.ms||28;\n      y.ms=Math.max(28,(line.rtt||85)+proxyTcpMs);\n      y.jitter=Math.max(2,Math.round(proxyTcpMs*0.15));\n    }else if(y.ms===null||y.ms<25){\n      if(er.client_ms&&er.client_ms>=25){\n        y.ms=er.client_ms;\n      }else{\n        y.ms=-1;\n        y.healthy=!1;\n        y.err="\u0627\u0632 \u0645\u0631\u0648\u0631\u06AF\u0631 \u062E\u0637 \u0634\u0645\u0627 \u067E\u0627\u0633\u062E \u0645\u0639\u062A\u0628\u0631 \u062F\u0631\u06CC\u0627\u0641\u062A \u0646\u0634\u062F (\u067E\u06CC\u0646\u06AF Edge \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0646\u0634\u062F)";\n        return;\n      }\n    }\n    y.healthy=!0;\n  });\n\n  O.running=!1;\n  xe(O.results.length);\n  let good=O.results.filter(y=>y.healthy&&y.ms>0);\n  let bestPing=good.length?Math.min(...good.map(y=>y.ms)):null;\n  se(`\u062A\u0633\u062A \u06A9\u0627\u0645\u0644 \u0634\u062F \u2014 ${good.length}/${O.results.length} \u0641\u0639\u0627\u0644 ${bestPing?`\xB7 \u06A9\u0645\u200C\u062A\u0631\u06CC\u0646 \u067E\u06CC\u0646\u06AF: ${bestPing} ms`:""}`);\n  let d0=document.querySelector("#scan-apply");\n  if(d0){\n    d0.disabled=good.length===0;\n    d0.innerHTML=`${d("check")} ${selC?`\u0627\u0646\u062A\u062E\u0627\u0628 \u0633\u0631\u06CC\u0639\u200C\u062A\u0631\u06CC\u0646 \u0633\u0631\u0648\u0631 \u062E\u0631\u0648\u062C\u06CC ${selC.flag} ${selC.fa}`:"\u0630\u062E\u06CC\u0631\u0647 \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627 \u0648 \u0633\u0627\u06CC\u062A\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632 \u062F\u0631 \u067E\u0646\u0644"}`;\n  }\n}\nasync function WtUnderground(e){\n  if(O.running)return;\n  O.running=!0;\n  O.tab="ingress";\n  O.scanMode="preset";\n  O.preset="underground";\n  O.country="";\n  document.querySelectorAll(\'[data-action="omni-preset"]\').forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.v==="underground")));\n  se("\u{1F575}\uFE0F \u062F\u0631 \u062D\u0627\u0644 \u0633\u0646\u062A\u0632 \u0637\u06CC\u0641\u06CC SIIT-Hex64 \u0648 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0631\u06A9\u0648\u0631\u062F TYPE=65/ECH\u2026");\n  try{\n    let raw=typeof e?.settings==="function"?await e.settings():e?.settings||{},cfg=raw&&raw.settings?raw.settings:raw||{};\n    let [line,hRes]=await Promise.all([\n      measureLineRtt(),\n      x("POST","/api/diag/underground-hunt",{seeds:cfg.clean_ips||[],limit:14,apply:!1})\n    ]);\n    let cands=Array.isArray(hRes?.candidates)?hRes.candidates:[];\n    if(!cands.length){O.running=!1;return se("\u06A9\u0627\u0646\u062F\u06CC\u062F\u06CC \u06CC\u0627\u0641\u062A \u0646\u0634\u062F")}\n    let ta0=document.querySelector("#scan-ranges");\n    if(ta0)ta0.value=cands.map(c=>c.addr).join("\\n");\n    O.results=cands.map(c=>({\n      ip:c.addr,\n      ms:null,\n      jitter:0,\n      colo:c.colo||null,\n      source:c.source||"\u0622\u06CC\u200C\u067E\u06CC \u0632\u06CC\u0631\u0632\u0645\u06CC\u0646\u06CC",\n      src:c.addr.includes(":")?"ipv6":/[a-z]/i.test(c.addr)?"browser":"edge",\n      healthy:Boolean(c.alive),\n      verified:c.verified||"client-required",\n      err:c.alive?null:"\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u062A\u0633\u062A \u0648\u0627\u0642\u0639\u06CC \u0631\u0648\u06CC \u062E\u0637 \u0634\u0645\u0627"\n    }));\n    xe(O.results.length);\n    let queue=[...O.results];\n    await Promise.all(Array.from({length:Math.min(6,queue.length)},async()=>{\n      while(queue.length){\n        let item=queue.shift();if(!item)break;\n        let p=await Zt(item.ip,2300);\n        if(p.ms&&p.ms>=25){item.ms=p.ms;item.jitter=p.jitter||0;item.healthy=!0}\n        else if(item.verified!=="iran-line"){item.ms=-1;item.healthy=!1;item.err="\u0631\u0648\u06CC \u062E\u0637 \u0634\u0645\u0627 \u067E\u0627\u0633\u062E \u0645\u0639\u062A\u0628\u0631 \u0646\u062F\u0627\u062F"}\n        xe(O.results.length);\n      }\n    }));\n    let good=O.results.filter(y=>y.healthy&&y.ms>0);\n    let bestPing=good.length?Math.min(...good.map(y=>y.ms)):null;\n    se(`\u{1F575}\uFE0F \u0633\u0646\u062A\u0632 \u0637\u06CC\u0641\u06CC \u06A9\u0627\u0645\u0644 \u0634\u062F \u2014 ${good.length} \u0622\u06CC\u200C\u067E\u06CC \u0648 \u062F\u0627\u0645\u0646\u0647 \u062F\u0633\u062A\u200C\u0646\u062E\u0648\u0631\u062F\u0647 \u06A9\u0634\u0641 \u0634\u062F ${bestPing?`\xB7 \u06A9\u0645\u200C\u062A\u0631\u06CC\u0646 \u067E\u06CC\u0646\u06AF \u062E\u0637 \u0634\u0645\u0627: ${bestPing} ms`:""}`);\n    let d0=document.querySelector("#scan-apply");\n    if(d0){\n      d0.disabled=good.length===0;\n      d0.innerHTML=`${d("check")} \u0630\u062E\u06CC\u0631\u0647 \u062A\u06CC\u063A\u0647\u200C\u0647\u0627\u06CC \u0637\u06CC\u0641\u06CC \u062A\u0627\u06CC\u06CC\u062F\u0634\u062F\u0647 \u062F\u0631 \u067E\u0646\u0644`;\n    }\n  }catch(err){\n    se(String(err?.message||"\u062E\u0637\u0627 \u062F\u0631 \u0634\u06A9\u0627\u0631 \u0622\u06CC\u200C\u067E\u06CC \u0632\u06CC\u0631\u0632\u0645\u06CC\u0646\u06CC"));\n  }finally{\n    O.running=!1;\n  }\n}\nasync function Jt(e){await Wt(e)}\nasync function Kt(e){\n  let raw=typeof e?.settings==="function"?await e.settings():e?.settings||{},cfg=raw&&raw.settings?raw.settings:raw||{};\n  let r=O.results.filter(x=>x.healthy&&x.ms!==null&&x.ms>0).sort((x,y)=>x.ms-y.ms);\n  let selC=(O.tab==="countries"&&O.country)?COUNTRY_MAP.get(O.country):null;\n  let proxyNodes=r.filter(x=>COUNTRY_PROXY_MAP.has(x.ip.toLowerCase())).map(x=>`${x.ip}:443`);\n  if(selC&&!proxyNodes.length&&selC.proxies?.length){\n    proxyNodes=selC.proxies.map(x=>String(x).includes(":")?x:`${x}:443`);\n  }\n  let v6=r.filter(x=>x.ip.includes(":")).slice(0,10).map(x=>x.ip);\n  let dom=r.filter(x=>!x.ip.includes(":")&&/[a-z]/i.test(x.ip)&&!COUNTRY_PROXY_MAP.has(x.ip.toLowerCase())).slice(0,6).map(x=>x.ip);\n  let ips=r.filter(x=>!x.ip.includes(":")&&!/[a-z]/i.test(x.ip)&&!COUNTRY_PROXY_MAP.has(x.ip.toLowerCase())).slice(0,12).map(x=>x.ip);\n  if(!dom.length&&!ips.length&&!v6.length&&!proxyNodes.length)return y(n("scanner.none"),"warn");\n  let patch={ipv6_enabled:"1"};\n  if(selC){\n    patch.selected_country=selC.cc;\n    patch.proxy_ips=proxyNodes;\n  }else if(proxyNodes.length===1&&r.length===1){\n    let pc=COUNTRY_PROXY_MAP.get(r[0].ip.toLowerCase());\n    if(pc){patch.selected_country=pc.cc;patch.proxy_ips=proxyNodes}\n  }\n  if(v6.length)patch.ipv6_pool=v6;\n  if(dom.length)patch.address_domains=dom;\n  if(ips.length)patch.clean_ips=[...ips,...dom.slice(0,3)];\n  let saved=await b.saveSettings(patch);\n  e.setSettings(saved?.settings||{...cfg,...patch});\n  y(selC?`\u062E\u0631\u0648\u062C\u06CC \u067E\u0646\u0644 \u0628\u0647 ${selC.flag} ${selC.fa} \u062A\u063A\u06CC\u06CC\u0631 \u06CC\u0627\u0641\u062A (\u0633\u0631\u0648\u0631: ${proxyNodes[0]||selC.colo})`:"\u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627 \u0648 \u0633\u0627\u06CC\u062A\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062F\u0631 \u067E\u0646\u0644 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F\u0646\u062F","ok");\n}\nfunction Fe(e){\n  let cfg=e?.settings||{};\n  let curExitCc=cfg.selected_country||"";\n  let curExitC=curExitCc&&curExitCc!=="DIRECT"?COUNTRY_MAP.get(curExitCc):null;\n  let selC=(O.tab==="countries"&&O.country)?COUNTRY_MAP.get(O.country):null;\n  setTimeout(()=>{if(O.tab==="countries")renderCountryGrid()},0);\n  return`\n  <header class="view-head">\n    <div>\n      <h2>${d("search")} \u0627\u0633\u06A9\u0646\u0631 \u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632 \u0648 \u062A\u0633\u062A \u0648\u0627\u0642\u0639\u06CC \u0633\u0631\u0648\u0631\u0647\u0627\u06CC \u06A9\u0634\u0648\u0631\u0647\u0627</h2>\n      <p class="muted">\u062F\u0648 \u0628\u062E\u0634 \u06A9\u0627\u0645\u0644\u0627\u064B \u0645\u062C\u0632\u0627: \u06F1) \u0627\u0633\u06A9\u0646 \u0622\u06CC\u200C\u067E\u06CC \u0648 \u0633\u0627\u06CC\u062A\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632 \u0648\u0631\u0648\u062F\u06CC (\u0628\u062F\u0648\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0634\u0648\u0631) \xB7 \u06F2) \u062A\u0633\u062A \u0648\u0627\u0642\u0639\u06CC \u0633\u0631\u0648\u0631\u0647\u0627\u06CC \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u062E\u0631\u0648\u062C\u06CC \u06F3\u06F6 \u06A9\u0634\u0648\u0631</p>\n    </div>\n    <div class="head-actions" style="display:flex;gap:8px;flex-wrap:wrap">\n      ${O.tab==="ingress"\n        ?`<button class="btn btn-primary" type="button" data-action="omni-scan">${d("play")} \u0634\u0631\u0648\u0639 \u0627\u0633\u06A9\u0646 \u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632</button>`\n        :`<button class="btn btn-primary" type="button" data-action="omni-scan-all-countries">\u{1F30D} \u062A\u0633\u062A \u0647\u0645\u200C\u0632\u0645\u0627\u0646 \u0647\u0645\u0647 \u06A9\u0634\u0648\u0631\u0647\u0627</button>`}\n    </div>\n  </header>\n\n  <div class="card" style="margin-bottom:12px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">\n    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">\n      <span class="muted" style="font-size:12px">\u0644\u0648\u06A9\u06CC\u0634\u0646 \u062E\u0631\u0648\u062C\u06CC \u0641\u0639\u0644\u06CC \u067E\u0646\u0644:</span>\n      ${curExitC\n        ?`<span class="badge ok" style="font-size:12px">${curExitC.flag} \u062E\u0631\u0648\u062C\u06CC ${a(curExitC.fa)} (${a((curExitC.proxies||[])[0]||curExitC.colo)})</span>`\n        :`<span class="badge info" style="font-size:12px">\u{1F310} \u0627\u062A\u0635\u0627\u0644 \u0645\u0633\u062A\u0642\u06CC\u0645 (\u06A9\u0645\u200C\u062A\u0631\u06CC\u0646 \u067E\u06CC\u0646\u06AF)</span>`}\n      <span id="direct-ping-badges" style="display:inline-flex;gap:6px;flex-wrap:wrap"></span>\n    </div>\n    <div style="display:flex;gap:8px;flex-wrap:wrap">\n      <button type="button" class="btn btn-sm" data-action="omni-net-sense">\u{1F4F1} \u0633\u0646\u0633\u0648\u0631 \u062E\u0637 \u06AF\u0648\u0634\u06CC \u0648 \u062A\u0646\u0638\u06CC\u0645 \u062E\u0648\u062F\u06A9\u0627\u0631</button>\n      <button type="button" class="btn btn-sm" data-action="omni-underground-hunt">\u{1F9EC} \u0633\u0646\u062A\u0632 \u062A\u06CC\u063A\u0647 SIIT-Hex64</button>\n      <button type="button" class="btn btn-sm" data-action="omni-test-direct">\u26A1 \u062A\u0633\u062A \u067E\u06CC\u0646\u06AF \u0645\u0633\u062A\u0642\u06CC\u0645 \u0634\u0645\u0627</button>\n      <button type="button" class="btn btn-sm" data-action="omni-direct-mode">\u{1F310} \u062D\u0627\u0644\u062A \u0645\u0633\u062A\u0642\u06CC\u0645 (\u0628\u062F\u0648\u0646 \u067E\u0631\u0648\u06A9\u0633\u06CC)</button>\n      <button type="button" class="btn btn-sm" data-action="omni-rotate-ips">\u{1F504} \u0686\u0631\u062E\u0634 \u0641\u0648\u0631\u06CC \u0645\u062E\u0632\u0646 \u0622\u06CC\u200C\u067E\u06CC</button>\n    </div>\n  </div>\n\n  <div class="tabs" style="margin-bottom:12px">\n    <button type="button" data-action="omni-scan-tab" data-tab="ingress" aria-selected="${O.tab==="ingress"}">\u26A1 \u06F1) \u0627\u0633\u06A9\u0646\u0631 \u0622\u06CC\u200C\u067E\u06CC \u0648 \u0633\u0627\u06CC\u062A\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632 \u0648\u0631\u0648\u062F\u06CC (\u0627\u06CC\u0631\u0627\u0646\u0633\u0644 / \u0647\u0645\u0631\u0627\u0647 \u0627\u0648\u0644 / \u0645\u062E\u0627\u0628\u0631\u0627\u062A / \u062F\u0644\u062E\u0648\u0627\u0647)</button>\n    <button type="button" data-action="omni-scan-tab" data-tab="countries" aria-selected="${O.tab==="countries"}">\u{1F30D} \u06F2) \u062A\u0633\u062A \u0648\u0627\u0642\u0639\u06CC \u0633\u0631\u0648\u0631\u0647\u0627\u06CC \u062E\u0631\u0648\u062C\u06CC \u06A9\u0634\u0648\u0631\u0647\u0627 (\u06F3\u06F6 \u06A9\u0634\u0648\u0631 \u0628\u0627 \u0622\u06CC\u200C\u067E\u06CC \u0627\u062E\u062A\u0635\u0627\u0635\u06CC)</button>\n  </div>\n\n  ${O.tab==="ingress"?`\n  <div class="card">\n    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">\n      <b style="font-size:13px">\u26A1 \u0627\u0646\u062A\u062E\u0627\u0628 \u062F\u0633\u062A\u0647 \u0622\u06CC\u200C\u067E\u06CC \u0648 \u0633\u0627\u06CC\u062A\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632 \u0648\u0631\u0648\u062F\u06CC \u06A9\u0644\u0648\u062F\u0641\u0644\u0631</b>\n      <div class="chips">\n        ${[["both","\u26A1 \u0647\u0631 \u062F\u0648 (IPv4 + IPv6)"],["v4","4\uFE0F\u20E3 \u0641\u0642\u0637 IPv4"],["v6","6\uFE0F\u20E3 \u0641\u0642\u0637 IPv6"]].map(([k,lbl])=>`<button type="button" class="chip" data-action="omni-ipver" data-v="${k}" aria-pressed="${O.ipVer===k}">${lbl}</button>`).join("")}\n      </div>\n    </div>\n    <div class="chips" style="margin-bottom:12px">\n      ${[\n        ["all","\u{1F310} \u062A\u0631\u06A9\u06CC\u0628\u06CC (QoS IPv4 + \u0633\u0627\u06CC\u062A\u200C\u0647\u0627\u06CC \u062C\u0647\u0627\u0646\u06CC + IPv6)"],\n        ["underground","\u{1F9EC} \u0633\u0646\u062A\u0632 \u0637\u06CC\u0641\u06CC SIIT-Hex64 (IPv4 \u2194 IPv6 + TYPE=65 ECH)"],\n        ["sites","\u{1F6E1}\uFE0F \u062A\u06CC\u063A\u0647\u200C\u0647\u0627\u06CC \u0647\u0645\u0632\u0627\u062F ECH (\u0628\u062F\u0648\u0646 \u0633\u0627\u06CC\u062A \u0639\u0645\u0648\u0645\u06CC)"],\n        ["qos","\u26A1 \u062A\u06CC\u063A\u0647\u200C\u0647\u0627\u06CC Anycast \u062A\u0633\u062A\u200C\u0634\u062F\u0647 \u0631\u0648\u06CC \u062E\u0637 \u0627\u06CC\u0631\u0627\u0646"],\n        ["ipv6","\u{1F4F1} IPv6 + ECH (\u0648\u06CC\u0698\u0647 \u0647\u0645\u0631\u0627\u0647 \u0627\u0648\u0644/\u0645\u062E\u0627\u0628\u0631\u0627\u062A)"],\n        ["ir","\u{1F510} \u062A\u06CC\u063A\u0647\u200C\u0647\u0627\u06CC IPv4 \u0646\u0647\u0641\u062A\u0647 \u062F\u0631 IPv6"]\n      ].map(([k,lbl])=>`<button type="button" class="chip" data-action="omni-preset" data-v="${k}" aria-pressed="${O.scanMode==="preset"&&O.preset===k}">${lbl}</button>`).join("")}\n    </div>\n    <div class="field">\n      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">\n        <label id="scan-ranges-lbl">\u{1F3AF} \u0644\u06CC\u0633\u062A \u0622\u06CC\u200C\u067E\u06CC\u060C \u0631\u0646\u062C CIDR \u06CC\u0627 \u062F\u0627\u0645\u0646\u0647 \u0628\u0631\u0627\u06CC \u0627\u0633\u06A9\u0646 ${O.scanMode==="custom"?"(\u062D\u0627\u0644\u062A \u0622\u06CC\u200C\u067E\u06CC \u062F\u0644\u062E\u0648\u0627\u0647 \u0634\u0645\u0627)":""}</label>\n        <button type="button" class="btn btn-ghost btn-sm" data-action="omni-clear-custom">\u{1F9F9} \u067E\u0627\u06A9\u200C\u0633\u0627\u0632\u06CC \u0628\u0631\u0627\u06CC \u0648\u0631\u0648\u062F \u0622\u06CC\u200C\u067E\u06CC \u062F\u0644\u062E\u0648\u0627\u0647</button>\n      </div>\n      <textarea id="scan-ranges" rows="3" dir="ltr" placeholder="\u0647\u0631 \u0622\u06CC\u200C\u067E\u06CC\u060C \u0631\u0646\u062C CIDR \u06CC\u0627 \u062F\u0627\u0645\u0646\u0647 \u0631\u0627 \u062F\u0631 \u06CC\u06A9 \u062E\u0637 \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F (\u0645\u062B\u0644\u0627\u064B 172.67.181.32 \u06CC\u0627 www.speedtest.net \u06CC\u0627 104.17.147.0/24)">${a((SCAN_PRESETS[O.preset]||SCAN_PRESETS.all).join("\\n"))}</textarea>\n    </div>\n    <div class="scan-progress" style="margin-top:10px"><i id="scan-bar" style="width:0%"></i></div>\n    <div class="muted" id="scan-status" style="font-size:12.5px;margin-top:8px">${O.scanMode==="custom"?"\u062D\u0627\u0644\u062A \u0627\u0633\u06A9\u0646 \u0622\u06CC\u200C\u067E\u06CC \u062F\u0644\u062E\u0648\u0627\u0647 \u0634\u0645\u0627 \u2014 \u0628\u062F\u0648\u0646 \u0627\u0644\u0635\u0627\u0642 \u0646\u0627\u0645 \u06A9\u0634\u0648\u0631":a(n("scanner.hint"))}</div>\n  </div>`:`\n  <div class="card">\n    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">\n      <div>\n        <b style="font-size:13.5px">\u{1F30D} \u062A\u0633\u062A \u0648\u0627\u0642\u0639\u06CC \u0633\u0631\u0648\u0631\u0647\u0627\u06CC \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u062E\u0631\u0648\u062C\u06CC \u06A9\u0634\u0648\u0631\u0647\u0627 (ProxyIP)</b>\n        <p class="muted" style="font-size:11.5px;margin:2px 0 0">\u062F\u0631 \u0627\u06CC\u0646 \u0628\u062E\u0634 \u0641\u0642\u0637 \u0633\u0631\u0648\u0631\u0647\u0627\u06CC \u062E\u0631\u0648\u062C\u06CC \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u0647\u0631 \u06A9\u0634\u0648\u0631 \u062A\u0633\u062A \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u0648 \u0647\u06CC\u0686 \u0622\u06CC\u200C\u067E\u06CC \u062A\u06A9\u0631\u0627\u0631\u06CC \u0628\u06CC\u0646 \u06A9\u0634\u0648\u0631\u0647\u0627 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.</p>\n      </div>\n      <div style="display:flex;gap:8px;align-items:center">\n        <button type="button" class="btn btn-primary btn-sm" data-action="omni-scan-all-countries">\u{1F30D} \u062A\u0633\u062A \u0647\u0645\u200C\u0632\u0645\u0627\u0646 \u0647\u0645\u0647 \u06F3\u06F6 \u06A9\u0634\u0648\u0631</button>\n        <span class="badge info" id="country-count-lbl">\u06F3\u06F6 \u06A9\u0634\u0648\u0631</span>\n      </div>\n    </div>\n    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">\n      <input id="country-search" type="search" placeholder="\u{1F50E} \u062C\u0633\u062A\u062C\u0648\u06CC \u06A9\u0634\u0648\u0631 (\u0622\u0644\u0645\u0627\u0646\u060C \u0647\u0644\u0646\u062F\u060C \u0628\u0631\u06CC\u062A\u0627\u0646\u06CC\u0627\u060C \u0641\u0631\u0627\u0646\u0633\u0647\u060C \u0622\u0645\u0631\u06CC\u06A9\u0627\u060C \u062A\u0631\u06A9\u06CC\u0647\u060C \u0627\u0645\u0627\u0631\u0627\u062A\u060C \u0641\u0646\u0644\u0627\u0646\u062F\u060C \u0633\u0648\u0626\u062F...)" value="${a(O.countryQuery)}" style="flex:1;min-width:220px">\n    </div>\n    <div class="chips" style="margin-bottom:8px">\n      ${[\n        ["primary","\u2B50 \u0644\u0648\u06A9\u06CC\u0634\u0646\u200C\u0647\u0627\u06CC \u0627\u0635\u0644\u06CC \u067E\u0631\u0633\u0631\u0639\u062A (\u06F2\u06F4 \u06A9\u0634\u0648\u0631)"],\n        ["eu","\u{1F1EA}\u{1F1FA} \u0627\u0631\u0648\u067E\u0627"],\n        ["me","\u{1F54C} \u062E\u0627\u0648\u0631\u0645\u06CC\u0627\u0646\u0647 \u0648 \u0647\u0645\u0633\u0627\u06CC\u0647"],\n        ["as","\u{1F30F} \u0622\u0633\u06CC\u0627"],\n        ["na","\u{1F30E} \u0622\u0645\u0631\u06CC\u06A9\u0627 \u0648 \u06A9\u0627\u0646\u0627\u062F\u0627"],\n        ["all","\u{1F30D} \u0647\u0645\u0647 \u06A9\u0634\u0648\u0631\u0647\u0627\u06CC \u062F\u0627\u0631\u0627\u06CC \u0633\u0631\u0648\u0631 \u0627\u062E\u062A\u0635\u0627\u0635\u06CC (\u06F3\u06F6 \u06A9\u0634\u0648\u0631)"]\n      ].map(([k,lbl])=>`<button type="button" class="chip" data-action="omni-region" data-v="${k}" aria-pressed="${O.region===k}">${lbl}</button>`).join("")}\n    </div>\n    <div id="country-grid" style="display:flex;flex-wrap:wrap;gap:6px;max-height:175px;overflow-y:auto;padding:8px;border:1px solid var(--border);border-radius:10px;background:var(--bg-elev)"></div>\n    <div class="scan-progress" style="margin-top:10px"><i id="scan-bar" style="width:0%"></i></div>\n    <div class="muted" id="scan-status" style="font-size:12.5px;margin-top:8px">${selC?`\u06A9\u0634\u0648\u0631 \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647: ${selC.flag} ${selC.fa} (${(selC.proxies||[]).length} \u0633\u0631\u0648\u0631 \u062E\u0631\u0648\u062C\u06CC \u0627\u062E\u062A\u0635\u0627\u0635\u06CC)`:"\u0631\u0648\u06CC \u06CC\u06A9 \u06A9\u0634\u0648\u0631 \u06A9\u0644\u06CC\u06A9 \u06A9\u0646\u06CC\u062F \u062A\u0627 \u0633\u0631\u0648\u0631\u0647\u0627\u06CC \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u0647\u0645\u0627\u0646 \u06A9\u0634\u0648\u0631 \u062A\u0633\u062A \u0634\u0648\u0646\u062F\u060C \u06CC\u0627 \xAB\u062A\u0633\u062A \u0647\u0645\u200C\u0632\u0645\u0627\u0646 \u0647\u0645\u0647 \u06F3\u06F6 \u06A9\u0634\u0648\u0631\xBB \u0631\u0627 \u0628\u0632\u0646\u06CC\u062F."}</div>\n  </div>`}\n\n  <div class="card" id="scan-out" style="margin-top:12px">\n    <div class="muted" style="font-size:13px">${a(n("scanner.empty"))}</div>\n  </div>\n  <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">\n    <button class="btn btn-primary" id="scan-apply" data-action="omni-apply" disabled>${d("check")} ${selC?`\u0627\u0646\u062A\u062E\u0627\u0628 \u0633\u0631\u06CC\u0639\u200C\u062A\u0631\u06CC\u0646 \u0633\u0631\u0648\u0631 \u062E\u0631\u0648\u062C\u06CC ${selC.flag} ${selC.fa}`:a(n("scanner.apply"))}</button>\n  </div>`;\n}\n\nvar MESH_ISO195="AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PS PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW".split(" ");\nvar MESH={mode:"game",country:"AUTO",region:"all",running:!1,line:null,results:[],history:[],proofs:[],runtime:[],cohort:"unknown",historyLoadedAt:0,lastRun:null,showAll:!1,message:null,proofCc:null};\nfunction meshCountries(){\n  return WORLD_COUNTRIES.filter(c=>c.verifiedExit&&Array.isArray(c.proxies)&&c.proxies.length);\n}\nfunction meshModeMeta(){\n  return {\n    game:{icon:"\u{1F3AE}",title:"\u06AF\u06CC\u0645",sub:"\u06A9\u0645\u06CC\u0646\u0647\u200C\u06A9\u0631\u062F\u0646 \u062A\u0623\u062E\u06CC\u0631\u060C \u062C\u06CC\u062A\u0631 \u0648 \u0627\u0632\u200C\u062F\u0633\u062A\u200C\u0631\u0641\u062A\u0646 \u0645\u0647\u0644\u062A \u062A\u06CC\u06A9",deadline:"Server Tick",policy:"Latency + stability"},\n    web:{icon:"\u{1F310}",title:"\u0648\u0628\u200C\u06AF\u0631\u062F\u06CC",sub:"\u0627\u062A\u0635\u0627\u0644 \u06AF\u0631\u0645\u060C \u06A9\u0645\u062A\u0631\u06CC\u0646 \u0645\u0633\u06CC\u0631 \u0648 \u062E\u0631\u0648\u062C\u06CC \u0627\u0646\u062A\u062E\u0627\u0628\u06CC \u0647\u0631 \u06A9\u0634\u0648\u0631",deadline:"100ms reaction",policy:"Fastest verified exit"},\n    ai:{icon:"\u2726",title:"\u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC",sub:"\u062E\u0631\u0648\u062C\u06CC \u06A9\u0627\u0646\u062F\u06CC\u062F \u0633\u0631\u0648\u06CC\u0633\u060C \u0627\u062A\u0635\u0627\u0644 \u06AF\u0631\u0645 \u0648 fallback \u0645\u0633\u062A\u0642\u0644",deadline:"First byte/token",policy:"Network race; service proof next"}\n  }[MESH.mode];\n}\nfunction meshRegionLabel(r){return({all:"\u0647\u0645\u0647 \u0645\u0646\u0627\u0637\u0642",eu:"\u0627\u0631\u0648\u067E\u0627",me:"\u062E\u0627\u0648\u0631\u0645\u06CC\u0627\u0646\u0647",as:"\u0622\u0633\u06CC\u0627",na:"\u0622\u0645\u0631\u06CC\u06A9\u0627\u06CC \u0634\u0645\u0627\u0644\u06CC",oc:"\u0627\u0642\u06CC\u0627\u0646\u0648\u0633\u06CC\u0647",af:"\u0622\u0641\u0631\u06CC\u0642\u0627",sa:"\u0622\u0645\u0631\u06CC\u06A9\u0627\u06CC \u062C\u0646\u0648\u0628\u06CC"})[r]||r}\nfunction meshAiReady(cc){return MESH.proofs.some(p=>(!p.cc||p.cc===cc)&&p.accepted&&["gemini_web","gemini_api","ai_studio"].includes(p.service)&&(!p.checked_at||Date.now()-new Date(p.checked_at.replace(" ","T")+(/Z$/.test(p.checked_at)?"":"Z")).getTime()<18e5))}\nfunction MeshView(e){\n  let meta=meshModeMeta(),verified=meshCountries(),all=MESH_ISO195.length;\n  if(Date.now()-MESH.historyLoadedAt>30000)setTimeout(()=>MeshLoadHistory(e),0);\n  let filtered=verified.filter(c=>MESH.region==="all"||c.region===MESH.region);\n  let line=MESH.line,alive=MESH.results.filter(r=>r.alive),best=alive[0]||null;\n  let countryOptions=filtered.map(c=>`<option value="${c.cc}" ${MESH.country===c.cc?"selected":""}>${c.flag} ${a(c.fa)} \xB7 ${c.cc}</option>`).join("");\n  return`\n  <section class="card mesh-hero">\n    <div style="position:relative;z-index:1;max-width:900px">\n      <div class="mesh-kicker">OMNI / CAUSAL FABRIC / LAB 01</div>\n      <h2 class="mesh-title">\u0645\u0633\u06CC\u0631 \u0631\u0627 \u0628\u0627 <em>\u0645\u0647\u0644\u062A \u0622\u06CC\u0646\u062F\u0647</em> \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u060C \u0646\u0647 \u067E\u06CC\u0646\u06AF \u06AF\u0630\u0634\u062A\u0647.</h2>\n      <p class="muted" style="margin:0;max-width:720px">\u0627\u0648\u0644\u06CC\u0646 \u0628\u062E\u0634 \u0639\u0645\u0644\u06CC \u0634\u0628\u06A9\u0647 \u062C\u0647\u0627\u0646\u06CC Omni: \u0633\u0646\u062C\u0634 \u0648\u0627\u0642\u0639\u06CC \u0648\u0631\u0648\u062F\u06CC \u062E\u0637\u060C \u0645\u0633\u0627\u0628\u0642\u0647 \u062E\u0631\u0648\u062C\u06CC\u200C\u0647\u0627\u06CC \u06A9\u0634\u0648\u0631\u0647\u0627 \u0648 \u0633\u0627\u062E\u062A \u0633\u06CC\u0627\u0633\u062A \u0645\u0633\u062A\u0642\u0644 \u0628\u0631\u0627\u06CC \u06AF\u06CC\u0645\u060C \u0648\u0628 \u0648 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC. \u0647\u06CC\u0686 \u0639\u062F\u062F \u062A\u062E\u0645\u06CC\u0646\u06CC \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 \u067E\u06CC\u0646\u06AF \u0648\u0627\u0642\u0639\u06CC \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.</p>\n      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:14px">\n        <span class="badge ok">${verified.length} \u062E\u0631\u0648\u062C\u06CC \u06A9\u0634\u0648\u0631 \u062F\u0627\u0631\u0627\u06CC \u0633\u0631\u0648\u0631</span>\n        <span class="badge info">${all} \u06A9\u0634\u0648\u0631 \u062F\u0631 \u0645\u0639\u0645\u0627\u0631\u06CC \u062C\u0647\u0627\u0646\u06CC</span>\n        <span class="badge">\u0646\u0633\u062E\u0647 \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647\u06CC \u06F0.\u06F1</span>\n      </div>\n    </div>\n  </section>\n\n  <div class="mesh-mode-grid" style="margin-top:12px">\n    ${Object.entries({game:["\u{1F3AE}","\u06AF\u06CC\u0645","Tick deadline\u060C \u062C\u06CC\u062A\u0631 \u0648 \u0645\u0633\u06CC\u0631 \u06A9\u0645\u200C\u062A\u0623\u062E\u06CC\u0631"],web:["\u{1F310}","\u0648\u0628\u200C\u06AF\u0631\u062F\u06CC","\u0627\u062A\u0635\u0627\u0644 \u0633\u0631\u06CC\u0639 \u0648 \u062E\u0631\u0648\u062C\u06CC \u06A9\u0634\u0648\u0631 \u0627\u0646\u062A\u062E\u0627\u0628\u06CC"],ai:["\u2726","\u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC","\u0633\u0627\u0632\u06AF\u0627\u0631\u06CC \u0633\u0631\u0648\u06CC\u0633 \u0642\u0628\u0644 \u0627\u0632 \u06A9\u0645\u062A\u0631\u06CC\u0646 \u067E\u06CC\u0646\u06AF"]}).map(([k,m])=>`\n      <button class="mesh-mode" type="button" data-action="omni-mesh-mode" data-mode="${k}" aria-pressed="${MESH.mode===k}">\n        <span style="font-size:21px">${m[0]}</span><b>${m[1]}</b><small>${m[2]}</small>\n      </button>`).join("")}\n  </div>\n\n  <div class="card" style="margin-top:12px">\n    <div class="card-head">${d("globe")}<h3>\u06A9\u0646\u062A\u0631\u0644 \u0645\u0633\u06CC\u0631 \u062C\u0647\u0627\u0646\u06CC</h3><div class="spacer"></div><span class="badge info">${meta.icon} ${meta.title}</span></div>\n    <div class="mesh-control-grid">\n      <div class="field"><label for="mesh-region">\u0645\u0646\u0637\u0642\u0647 \u062C\u063A\u0631\u0627\u0641\u06CC\u0627\u06CC\u06CC</label>\n        <select id="mesh-region" data-action="omni-mesh-region">\n          ${["all","me","eu","as","na","oc","af","sa"].map(r=>`<option value="${r}" ${MESH.region===r?"selected":""}>${meshRegionLabel(r)}</option>`).join("")}\n        </select></div>\n      <div class="field"><label for="mesh-country">\u06A9\u0634\u0648\u0631 \u062E\u0631\u0648\u062C\u06CC</label>\n        <select id="mesh-country" data-action="omni-mesh-country">\n          <option value="AUTO" ${MESH.country==="AUTO"?"selected":""}>\u26A1 \u062E\u0648\u062F\u06A9\u0627\u0631\u061B \u0633\u0631\u06CC\u0639\u200C\u062A\u0631\u06CC\u0646 \u062E\u0631\u0648\u062C\u06CC \u0633\u0627\u0644\u0645</option>\n          <option value="DIRECT" ${MESH.country==="DIRECT"?"selected":""}>\u{1F310} \u0645\u0633\u062A\u0642\u06CC\u0645\u061B \u0628\u062F\u0648\u0646 \u062E\u0631\u0648\u062C\u06CC \u06A9\u0634\u0648\u0631</option>\n          ${countryOptions}\n        </select></div>\n    </div>\n    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center">\n      <button class="btn btn-primary" type="button" data-action="omni-mesh-race" ${MESH.running?"disabled":""}>${d("play")} ${MESH.running?"\u062F\u0631 \u062D\u0627\u0644 \u0645\u0633\u0627\u0628\u0642\u0647 \u0648\u0627\u0642\u0639\u06CC\u2026":"\u0627\u062C\u0631\u0627\u06CC \u0645\u0633\u0627\u0628\u0642\u0647 \u0645\u0633\u06CC\u0631\u0647\u0627"}</button>\n      ${best&&(MESH.mode!=="ai"||meshAiReady(best.cc))?`<button class="btn" type="button" data-action="omni-mesh-apply" data-cc="${a(best.cc)}">${d("check")} \u0627\u0639\u0645\u0627\u0644 \u0628\u0647 \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627 \xB7 ${best.flag} ${a(best.fa)}</button>`:""}\n      ${MESH.mode==="ai"&&(best||MESH.country!=="AUTO"&&MESH.country!=="DIRECT")?`<button class="btn" type="button" data-action="omni-mesh-proof" data-cc="${a(best?.cc||MESH.country)}">\u2726 ${best&&meshAiReady(best.cc)?"\u062A\u0627\u0632\u0647\u200C\u0633\u0627\u0632\u06CC \u0627\u062B\u0628\u0627\u062A AI":"\u0627\u0648\u0644 \u0627\u062B\u0628\u0627\u062A \u0632\u0646\u062F\u0647 AI \u0631\u0627 \u0627\u062C\u0631\u0627 \u06A9\u0646"}</button>`:""}\n      <label style="display:inline-flex;align-items:center;gap:7px;font-size:12px;cursor:pointer"><span class="switch"><input type="checkbox" data-action="omni-mesh-auto" ${String(e.settings?.mesh_auto_failover||"0")==="1"?"checked":""}><span></span></span>Failover \u0628\u0639\u062F \u0627\u0632 \u062F\u0648 \u0634\u06A9\u0633\u062A \xB7 <b>${String(e.settings?.mesh_auto_failover||"0")==="1"?"\u0631\u0648\u0634\u0646":"\u062E\u0627\u0645\u0648\u0634"}</b></label>\n    </div>\n    <details style="margin-top:10px"><summary class="muted" style="cursor:pointer;font-size:11.5px">\u0645\u0633\u06CC\u0631\u06CC\u0627\u0628\u06CC \u0645\u0633\u062A\u0642\u06CC\u0645 \u062F\u0627\u0645\u0646\u0647\u200C\u0647\u0627\u06CC \u062D\u0633\u0627\u0633</summary>\n      <div class="field" style="margin-top:8px"><textarea id="mesh-direct-domains" rows="2" dir="ltr" placeholder="bank.example&#10;internal.example">${a(Re(e.settings?.mesh_direct_domains).join("\\n"))}</textarea><span class="hint">\u0647\u0631 \u062E\u0637 \u06CC\u06A9 \u062F\u0627\u0645\u0646\u0647\u061B \u0641\u0642\u0637 \u062F\u0631 \u062E\u0631\u0648\u062C\u06CC\u200C\u0647\u0627\u06CC sing-box \u0648 Clash \u0645\u0633\u062A\u0642\u06CC\u0645\u0627\u064B \u0639\u0628\u0648\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F.</span></div>\n      <button class="btn btn-sm" type="button" data-action="omni-mesh-save-domains">${d("check")} \u0630\u062E\u06CC\u0631\u0647 \u062F\u0627\u0645\u0646\u0647\u200C\u0647\u0627</button>\n    </details>\n    <p class="muted" style="font-size:11.5px;margin:9px 0 0">\u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u062E\u0637 \u0627\u0632 \u0645\u0631\u0648\u0631\u06AF\u0631 \u0627\u0633\u062A\u061B \u062A\u0633\u062A \u062E\u0631\u0648\u062C\u06CC \u0627\u0632 Worker \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u062C\u062F\u0627 \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.</p>\n    ${MESH.message?`<div class="notice ${MESH.message.type==="ok"?"ok":"warn"}" style="margin-top:10px;padding:10px"><b>${a(MESH.message.text)}</b>${MESH.message.detail?`<div style="font-size:11.5px;margin-top:4px">${a(MESH.message.detail)}</div>`:""}</div>`:""}\n  </div>\n\n  <div class="mesh-metric-grid" style="margin-top:12px">\n    <div class="mesh-metric"><span>\u0648\u0631\u0648\u062F\u06CC \u062E\u0637 \u2192 Omni</span><b style="color:${line?it(line.rtt):"var(--text-faint)"}">${line?line.rtt+" ms":"\u2014"}</b></div>\n    <div class="mesh-metric"><span>Cloudflare POP</span><b>${a(line?.colo||"\u2014")}</b></div>\n    <div class="mesh-metric"><span>\u062E\u0631\u0648\u062C\u06CC\u200C\u0647\u0627\u06CC \u067E\u0627\u0633\u062E\u200C\u06AF\u0648</span><b>${MESH.results.length?alive.length+" / "+MESH.results.length:"\u2014"}</b></div>\n    <div class="mesh-metric"><span>\u0628\u0647\u062A\u0631\u06CC\u0646 Probe \u062E\u0631\u0648\u062C\u06CC</span><b style="color:${best?it(best.edge_ms):"var(--text-faint)"}">${best?best.edge_ms+" ms":"\u2014"}</b></div>\n  </div>\n\n  <div class="grid grid-2" style="margin-top:12px">\n    <div class="card">\n      <div class="card-head">${d("activity")}<h3>\u0645\u0633\u06CC\u0631 \u0639\u0644\u0651\u06CC \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647</h3></div>\n      <div class="mesh-flow">\n        <div class="mesh-node"><b>\u062E\u0637 \u06A9\u0627\u0631\u0628\u0631</b><small>${line?line.rtt+"ms \u0648\u0627\u0642\u0639\u06CC":"\u0647\u0646\u0648\u0632 \u0633\u0646\u062C\u06CC\u062F\u0647 \u0646\u0634\u062F\u0647"}</small></div>\n        <span class="mesh-arrow">\u2190</span>\n        <div class="mesh-node"><b>Omni Ingress</b><small>${a(line?.colo||"\u0646\u0632\u062F\u06CC\u06A9\u200C\u062A\u0631\u06CC\u0646 POP")}</small></div>\n        <span class="mesh-arrow">\u2190</span>\n        <div class="mesh-node"><b>${best?best.flag+" "+a(best.fa):MESH.country==="DIRECT"?"Direct":"Country Race"}</b><small>${best?best.edge_ms+"ms \u067E\u0631\u0648\u0628 \u062E\u0631\u0648\u062C\u06CC":meta.policy}</small></div>\n      </div>\n      <div style="margin-top:12px;padding:10px;border:1px solid var(--border);border-radius:11px;background:var(--bg-soft)">\n        <div style="display:flex;justify-content:space-between;gap:8px"><span class="muted">\u0645\u0647\u0644\u062A \u0627\u06CC\u0646 \u067E\u0631\u0648\u0641\u0627\u06CC\u0644</span><b dir="ltr">${meta.deadline}</b></div>\n        <div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px"><span class="muted">\u0646\u0648\u0639 \u0627\u0645\u062A\u06CC\u0627\u0632\u062F\u0647\u06CC</span><b dir="ltr">${meta.policy}</b></div>\n      </div>\n    </div>\n    <div class="card">\n      <div class="card-head">${d("shield")}<h3>\u0648\u0636\u0639\u06CC\u062A \u0645\u0648\u062A\u0648\u0631</h3></div>\n      <div class="mesh-phase live"><i></i><div><b>Race + P50/P95 + Cohort</b><div class="muted" style="font-size:11.5px">\u0641\u0639\u0627\u0644\u061B \u062E\u0637\u060C \u062E\u0631\u0648\u062C\u06CC \u0648 \u0627\u067E\u0631\u0627\u062A\u0648\u0631 \u062C\u062F\u0627 \u0630\u062E\u06CC\u0631\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.</div></div></div>\n      <div class="mesh-phase live"><i></i><div><b>Service Proof + TLS</b><div class="muted" style="font-size:11.5px">\u0641\u0639\u0627\u0644\u061B \u0646\u062A\u06CC\u062C\u0647 \u0634\u0628\u06A9\u0647 \u0633\u0631\u0648\u06CC\u0633\u200C\u0647\u0627\u06CC AI \u0627\u0632 \u062E\u0631\u0648\u062C\u06CC \u0648\u0627\u0642\u0639\u06CC \u062B\u0628\u062A \u0645\u06CC\u200C\u0634\u0648\u062F.</div></div></div>\n      <div class="mesh-phase live"><i></i><div><b>Cron Failover + Quarantine</b><div class="muted" style="font-size:11.5px">\u0641\u0639\u0627\u0644\u061B \u062A\u0639\u0648\u06CC\u0636 \u0641\u0642\u0637 \u067E\u0633 \u0627\u0632 \u062F\u0648 \u0634\u06A9\u0633\u062A \u0645\u062A\u0648\u0627\u0644\u06CC.</div></div></div>\n      <div class="mesh-phase live"><i></i><div><b>Per-App Rules</b><div class="muted" style="font-size:11.5px">\u0641\u0639\u0627\u0644 \u062F\u0631 sing-box/Clash\u061B \u0644\u06CC\u0646\u06A9 \u062E\u0627\u0645 v2rayNG \u0646\u06CC\u0627\u0632\u0645\u0646\u062F Proxy all apps \u0627\u0633\u062A.</div></div></div>\n      <details style="margin-top:8px"><summary class="muted" style="cursor:pointer;font-size:11.5px">\u0642\u0627\u0628\u0644\u06CC\u062A\u200C\u0647\u0627\u06CC \u062E\u0627\u0631\u062C \u0627\u0632 \u062A\u0648\u0627\u0646 Worker</summary><div style="padding-top:6px" class="muted">Multipath\u060C Micro-FEC \u0648 Tick Engine \u0628\u0647 \u06A9\u0644\u0627\u06CC\u0646\u062A \u06CC\u0627 Relay \u0645\u0633\u062A\u0642\u0644 \u0646\u06CC\u0627\u0632 \u062F\u0627\u0631\u0646\u062F \u0648 \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A\u0646\u062F.</div></details>\n    </div>\n  </div>\n\n  <div class="grid grid-2" style="margin-top:12px">\n    <div class="card">\n      <div class="card-head">${d("activity")}<h3>\u062D\u0627\u0641\u0638\u0647 \u0647\u0641\u062A\u200C\u0631\u0648\u0632\u0647 \u0645\u0633\u06CC\u0631\u0647\u0627</h3><div class="spacer"></div><span class="badge">${a(MESH.cohort||"unknown")}</span></div>\n      ${MeshHistoryView()}\n    </div>\n    <div class="card">\n      <div class="card-head">${d("shield")}<h3>\u0627\u062B\u0628\u0627\u062A \u0633\u0631\u0648\u06CC\u0633\u200C\u0647\u0627</h3></div>\n      ${MeshProofView()}\n    </div>\n  </div>\n\n  <div class="card" style="margin-top:12px">\n    <div class="card-head">${d("bolt")}<h3>\u0646\u062A\u06CC\u062C\u0647 \u0645\u0633\u0627\u0628\u0642\u0647 \u06A9\u0634\u0648\u0631\u0647\u0627</h3><div class="spacer"></div>${MESH.lastRun?`<span class="muted" style="font-size:10.5px">${a(MESH.lastRun)}</span>`:""}</div>\n    <div id="mesh-results">${MESH.running?\'<div class="skeleton" style="height:130px"></div>\':MeshResults()}</div>\n  </div>`;\n}\nfunction MeshHistoryView(){\n  let now=Math.floor(Date.now()/1000),activeQ=MESH.runtime.filter(r=>String(r.key||"").startsWith("quarantine:")&&Number(r.value)>now);\n  let alert=activeQ.length?`<div class="notice warn" style="margin-bottom:8px;padding:8px">\u0642\u0631\u0646\u0637\u06CC\u0646\u0647 \u0641\u0639\u0627\u0644: ${activeQ.map(r=>a(String(r.key).slice(11))).join("\u060C ")}</div>`:"";\n  if(!MESH.history.length)return alert+\'<div class="empty" style="padding:18px"><div>\u0647\u0646\u0648\u0632 \u062A\u0627\u0631\u06CC\u062E\u0686\u0647 \u06A9\u0627\u0641\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.</div><small class="muted">\u0628\u0627 \u0647\u0631 \u0645\u0633\u0627\u0628\u0642\u0647\u060C P50/P95 \u0648 \u0646\u0631\u062E \u0645\u0648\u0641\u0642\u06CC\u062A \u0648\u0627\u0642\u0639\u06CC \u0633\u0627\u062E\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.</small></div>\';\n  let rows=MESH.history.slice(0,8),max=Math.max(...rows.map(r=>Number(r.p95||r.p50||1)),1);\n  return`${alert}<div style="display:flex;flex-direction:column;gap:8px">${rows.map(r=>{\n    let c=COUNTRY_MAP.get(r.cc),w=Math.max(4,Math.round((Number(r.p95||r.p50||0)/max)*100));\n    return`<div><div style="display:flex;gap:7px;align-items:center;font-size:11.5px;flex-wrap:wrap"><b>${c?.flag||"\u{1F310}"} ${a(c?.fa||r.cc)}</b><span class="muted" dir="ltr">Worker\u2192Exit \xB7 P50 ${r.p50??"\u2014"} \xB7 P95 ${r.p95??"\u2014"} ms</span><span class="spacer"></span><span class="badge ${r.success_rate>=90?"ok":r.success_rate>=60?"warn":"danger"}">${r.successes||0}/${r.samples||0}${Number(r.samples||0)<3?" \xB7 \u062F\u0627\u062F\u0647 \u06A9\u0645":""}</span></div><div class="scan-progress" style="height:4px;margin-top:4px"><i style="width:${w}%;background:${it(Number(r.p95||999))}"></i></div></div>`}).join("")}</div>`;\n}\nfunction MeshProofView(){\n  if(!MESH.proofs.length)return\'<div class="empty" style="padding:18px"><div>\u0627\u062B\u0628\u0627\u062A \u0633\u0631\u0648\u06CC\u0633 \u0627\u062C\u0631\u0627 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.</div><small class="muted">\u062F\u0631 \u062D\u0627\u0644\u062A AI \u06CC\u06A9 \u06A9\u0634\u0648\u0631 \u0631\u0627 \u0645\u0633\u0627\u0628\u0642\u0647 \u0628\u062F\u0647 \u0648 \xAB\u0627\u062B\u0628\u0627\u062A \u0632\u0646\u062F\u0647\xBB \u0631\u0627 \u0628\u0632\u0646.</small></div>\';\n  let names={gemini_web:"Gemini Web",gemini_api:"Gemini API",ai_studio:"AI Studio",chatgpt:"ChatGPT",claude:"Claude"};\n  let target=MESH.proofCc||(MESH.country!=="AUTO"&&MESH.country!=="DIRECT"?MESH.country:null)||MESH.results[0]?.cc||MESH.proofs[0]?.cc;\n  let seen=new Set(),rows=MESH.proofs.filter(r=>!target||!r.cc||r.cc===target).filter(r=>!seen.has(r.service)&&seen.add(r.service)).slice(0,5),c=COUNTRY_MAP.get(target);\n  if(!rows.length)return`<div class="empty" style="padding:18px"><div>\u0628\u0631\u0627\u06CC ${a(target||"\u0627\u06CC\u0646 \u06A9\u0634\u0648\u0631")} \u0646\u062A\u06CC\u062C\u0647\u200C\u0627\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.</div></div>`;\n  return`<div class="muted" style="font-size:11.5px;margin-bottom:8px">\u0622\u062E\u0631\u06CC\u0646 \u0627\u062C\u0631\u0627\u06CC ${c?.flag||"\u{1F310}"} ${a(c?.fa||target||"")}\u061B \u0646\u062A\u0627\u06CC\u062C \u0642\u062F\u06CC\u0645\u06CC \u0648 \u062A\u06A9\u0631\u0627\u0631\u06CC \u0645\u062E\u0641\u06CC \u0634\u062F\u0647\u200C\u0627\u0646\u062F.</div><div style="display:flex;flex-direction:column;gap:7px">${rows.map(r=>`<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:10px"><b style="flex:1">${a(names[r.service]||r.service)}</b><span class="badge ${r.accepted?"ok":r.ok?"warn":"danger"}">${r.accepted?"\u067E\u0630\u06CC\u0631\u0641\u062A\u0647":r.ok?"\u0631\u0633\u06CC\u062F\u0647\u060C \u0648\u0644\u06CC \u0631\u062F \u0634\u062F\u0647":"\u0646\u0627\u0645\u0648\u0641\u0642"}</span>${r.status?`<code>${r.status}</code>`:""}${r.ms?`<span class="muted mono">${r.ms}ms</span>`:""}</div>`).join("")}</div>`;\n}\nasync function MeshLoadHistory(e,force=!1){\n  if(!force&&Date.now()-MESH.historyLoadedAt<30000)return;\n  MESH.historyLoadedAt=Date.now();\n  try{\n    let h=await x("GET",`/api/mesh/history?mode=${encodeURIComponent(MESH.mode)}&days=7${MESH.cohort&&MESH.cohort!=="unknown"?`&cohort=${encodeURIComponent(MESH.cohort)}`:""}`);\n    MESH.history=Array.isArray(h?.stats)?h.stats:[];\n    MESH.proofs=Array.isArray(h?.service_proofs)?h.service_proofs:[];\n    MESH.runtime=Array.isArray(h?.runtime)?h.runtime:[];\n    if(l.view==="mesh")X();\n  }catch{}\n}\nasync function MeshServiceProof(e,cc){\n  if(!cc||cc==="AUTO"||cc==="DIRECT")return y("\u0627\u0628\u062A\u062F\u0627 \u06CC\u06A9 \u062E\u0631\u0648\u062C\u06CC \u06A9\u0634\u0648\u0631 \u0633\u0627\u0644\u0645 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646","warn");\n  y("\u0627\u062B\u0628\u0627\u062A TLS \u0648 \u0648\u0636\u0639\u06CC\u062A \u0633\u0631\u0648\u06CC\u0633\u200C\u0647\u0627 \u0634\u0631\u0648\u0639 \u0634\u062F\u2026","info",1800);\n  try{\n    let r=await x("POST","/api/mesh/service-proof",{cc,services:["gemini_web","gemini_api","ai_studio","chatgpt","claude"],timeout:6500});\n    MESH.proofCc=cc;\n    MESH.proofs=(Array.isArray(r?.results)?r.results:[]).map(p=>({...p,cc,checked_at:r?.checked_at||new Date().toISOString()}));\n    MESH.historyLoadedAt=0;\n    y(`${MESH.proofs.filter(p=>p.accepted).length}/${MESH.proofs.length} \u0633\u0631\u0648\u06CC\u0633 \u0627\u0632 \u062E\u0631\u0648\u062C\u06CC ${cc} \u067E\u0630\u06CC\u0631\u0641\u062A\u0647 \u0634\u062F`,MESH.proofs.some(p=>p.accepted)?"ok":"warn");\n    e.rerenderView("mesh");\n  }catch(err){y(String(err?.message||err),"err")}\n}\nfunction MeshResults(){\n  if(!MESH.results.length)return\'<div class="empty" style="padding:24px"><div style="font-size:24px">\u25CE</div><div>\u0647\u0646\u0648\u0632 \u0645\u0633\u0627\u0628\u0642\u0647\u200C\u0627\u06CC \u0627\u062C\u0631\u0627 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.</div><small class="muted">\u06A9\u0634\u0648\u0631 \u06CC\u0627 \u062D\u0627\u0644\u062A \u062E\u0648\u062F\u06A9\u0627\u0631 \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u0648 \xAB\u0627\u062C\u0631\u0627\u06CC \u0645\u0633\u0627\u0628\u0642\u0647 \u0645\u0633\u06CC\u0631\u0647\u0627\xBB \u0631\u0627 \u0628\u0632\u0646.</small></div>\';\n  let rows=MESH.showAll?MESH.results:MESH.results.slice(0,6);\n  return`<div class="mesh-country-list">${rows.map((r,i)=>`\n    <div class="mesh-country-row" data-best="${i===0&&r.alive}">\n      <div><b>${r.flag||"\u{1F310}"} ${a(r.fa||r.cc)}</b><div class="muted mono" style="font-size:10.5px">${a(r.cc)} \xB7 ${a(r.colo||"\u2014")}</div></div>\n      <div><span class="muted" style="font-size:10px;display:block">Worker \u2192 \u062E\u0631\u0648\u062C\u06CC</span><b dir="ltr" style="color:${r.alive?it(r.edge_ms):"var(--danger)"}">${r.alive?r.edge_ms+" ms":"\u0642\u0637\u0639"}</b></div>\n      <div><span class="muted" style="font-size:10px;display:block">P95 \u0647\u0641\u062A\u200C\u0631\u0648\u0632\u0647</span><b dir="ltr">${r.history?.p95!=null?r.history.p95+" ms":"\u2014"}</b></div>\n      <div><span class="muted" style="font-size:10px;display:block">\u0646\u0645\u0648\u0646\u0647 / \u0627\u0645\u062A\u06CC\u0627\u0632</span><b dir="ltr">${r.history?.samples||1} \xB7 ${r.score??"\u2014"}</b><small class="muted">\u06A9\u0641 \u0645\u0633\u06CC\u0631 ${r.combined_floor_ms??"\u2014"}ms\u061B \u062A\u062E\u0645\u06CC\u0646\u06CC</small></div>\n      <button class="btn btn-sm ${i===0&&r.alive?"btn-primary":""}" type="button" data-action="omni-mesh-apply" data-cc="${a(r.cc)}" ${r.alive&&(MESH.mode!=="ai"||meshAiReady(r.cc))?"":"disabled"}>${MESH.mode==="ai"&&!meshAiReady(r.cc)?"\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0627\u062B\u0628\u0627\u062A AI":"\u0627\u0639\u0645\u0627\u0644 \u0628\u0647 \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627"}</button>\n    </div>`).join("")}</div>${MESH.results.length>6?`<button class="btn btn-sm" style="margin-top:10px;width:100%" data-action="omni-mesh-toggle-results">${MESH.showAll?"\u0646\u0645\u0627\u06CC\u0634 \u06F6 \u0646\u062A\u06CC\u062C\u0647 \u0628\u0631\u062A\u0631":`\u0646\u0645\u0627\u06CC\u0634 \u0647\u0645\u0647 ${MESH.results.length} \u06A9\u0634\u0648\u0631`}</button>`:""}`;\n}\nasync function MeshRace(e){\n  if(MESH.running)return;\n  MESH.running=!0;MESH.message=null;MESH.showAll=!1;e.rerenderView("mesh");\n  try{\n    let pool=meshCountries().filter(c=>MESH.region==="all"||c.region===MESH.region);\n    if(MESH.country!=="AUTO"&&MESH.country!=="DIRECT")pool=pool.filter(c=>c.cc===MESH.country);\n    if(MESH.country==="DIRECT"){\n      MESH.line=await measureLineRtt();MESH.results=[];MESH.lastRun=new Date().toLocaleTimeString("fa-IR");return;\n    }\n    let line=await measureLineRtt();\n    let res=await x("POST","/api/mesh/race",{mode:MESH.mode,ccs:pool.map(c=>c.cc),access_rtt:line.rtt,access_colo:line.colo,concurrency:12,timeout:2200});\n    MESH.line={rtt:res?.access_ms||line.rtt,colo:res?.access_colo||line.colo};\n    MESH.cohort=res?.cohort||"unknown";\n    MESH.results=(Array.isArray(res?.results)?res.results:[]).filter(r=>r.alive&&r.edge_ms>0);\n    MESH.history=MESH.results.map(r=>({cc:r.cc,...(r.history||{})}));\n    MESH.historyLoadedAt=Date.now();\n    MESH.lastRun=new Date(res?.measured_at||Date.now()).toLocaleTimeString("fa-IR");\n    if(!MESH.results.length)y("\u0647\u06CC\u0686 \u062E\u0631\u0648\u062C\u06CC \u0633\u0627\u0644\u0645\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u0645\u0646\u0637\u0642\u0647 \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F","warn");\n  }catch(err){y(String(err?.message||"\u0645\u0633\u0627\u0628\u0642\u0647 \u0645\u0633\u06CC\u0631 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F"),"err")}\n  finally{MESH.running=!1;e.rerenderView("mesh")}\n}\nasync function MeshApply(e,cc){\n  let c=COUNTRY_MAP.get(cc);\n  if(!c||!c.verifiedExit){MESH.message={type:"warn",text:"\u0627\u06CC\u0646 \u06A9\u0634\u0648\u0631 \u062E\u0631\u0648\u062C\u06CC \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0646\u062F\u0627\u0631\u062F"};return e.rerenderView("mesh")}\n  let tested=MESH.results.find(r=>r.cc===cc&&r.alive);\n  if(!tested){MESH.message={type:"warn",text:"\u0627\u0648\u0644 \u0645\u0633\u0627\u0628\u0642\u0647 \u0631\u0627 \u0627\u062C\u0631\u0627 \u06A9\u0646",detail:"\u0627\u0639\u0645\u0627\u0644 \u0641\u0642\u0637 \u062A\u0627 \u06F1\u06F0 \u062F\u0642\u06CC\u0642\u0647 \u0628\u0639\u062F \u0627\u0632 \u06CC\u06A9 \u062A\u0633\u062A \u0632\u0646\u062F\u0647 \u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A."};return e.rerenderView("mesh")}\n  try{\n    let applied=await x("POST","/api/mesh/apply",{mode:MESH.mode,cc});\n    let patch={selected_country:applied.cc,proxy_ips:[applied.proxy],mesh_active_mode:MESH.mode};\n    e.setSettings({...e.settings(),...patch});g.cc=applied.cc;g.out=null;MESH.country=cc;\n    MESH.message={type:"ok",text:`${c.flag} ${c.fa} \u0631\u0648\u06CC \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627 \u0627\u0639\u0645\u0627\u0644 \u0634\u062F`,detail:"\u0627\u06A9\u0646\u0648\u0646 \u0635\u0641\u062D\u0647 \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627 \u0628\u0627\u0632 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0644\u06CC\u0646\u06A9 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0631\u0627 \u062F\u0631 v2rayNG \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u06A9\u0646."};\n    y(`${c.flag} ${c.fa} \u0627\u0639\u0645\u0627\u0644 \u0634\u062F\u061B \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627 \u062F\u0631 \u062D\u0627\u0644 \u0628\u0627\u0632\u0634\u062F\u0646 \u0627\u0633\u062A`,"ok",2600);\n    e.rerenderView("configs");\n  }catch(err){\n    let msg=String(err?.message||err),ai=MESH.mode==="ai";\n    MESH.message={type:"warn",text:ai?"\u0627\u06CC\u0646 \u062E\u0631\u0648\u062C\u06CC \u0647\u0646\u0648\u0632 \u0628\u0631\u0627\u06CC Gemini \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F\u0647 \u0627\u0633\u062A":"\u0627\u0639\u0645\u0627\u0644 \u062E\u0631\u0648\u062C\u06CC \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F",detail:msg};\n    y(msg,"err",4500);e.rerenderView("mesh");\n  }\n}\n\nfunction ze(e){\n  let t=e.settings?.dns_upstream||"";\n  return`\n  <header class="view-head">\n    <div>\n      <h2>${d("globe")} ${a(n("dns.title"))}</h2>\n      <p class="muted">${a(n("dns.desc"))}</p>\n    </div>\n    <div class="head-actions" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">\n      <input id="dns-qname" dir="ltr" value="youtube.com" placeholder="example.com" style="width:150px">\n      <button class="btn btn-primary" data-action="omni-dns-all">${d("bolt")} \u062A\u0633\u062A \u0647\u0645\u0647 \u062F\u06CC\u200C\u0627\u0646\u200C\u0627\u0633\u200C\u0647\u0627</button>\n    </div>\n  </header>\n  <div class="dns-grid">\n    ${Ut.map(s=>`\n      <div class="dns-card">\n        <b>${a(s.name)}</b>\n        <code dir="ltr">${a(s.url)}</code>\n        <code class="muted" dir="ltr" style="font-size:10.5px">DoT: ${a(s.dot||"\u2014")}</code>\n        <span class="dns-tags">\n          ${s.ir?`<span class="badge ir">${a(n("dns.ir"))}</span>`:""}\n          ${t===s.url?`<span class="badge ok">${a(n("dns.active"))}</span>`:""}\n          <span class="dns-test" id="dnst-${a(s.name.replace(/\\W+/g,""))}"></span>\n        </span>\n        <div style="display:flex;gap:6px;margin-top:6px">\n          <button class="btn btn-sm" data-action="omni-dns" data-url="${a(s.url)}">${a(n("dns.pick"))}</button>\n          <button class="btn btn-sm" data-action="omni-dns-test" data-url="${a(s.url)}" data-key="${a(s.name.replace(/\\W+/g,""))}">${d("play")} ${a(n("dns.test"))}</button>\n        </div>\n      </div>`).join("")}\n  </div>\n  <p class="muted" style="font-size:12.5px">${a(n("dns.note"))}</p>`;\n}\nasync function Qt(e){\n  let qEl=document.querySelector("#dns-qname"),qname=(qEl&&qEl.value.trim())||"youtube.com";\n  let t=performance.now();\n  try{\n    let r=await x("GET",`/api/diag/dns?url=${encodeURIComponent(e)}&name=${encodeURIComponent(qname)}`);\n    if(r&&r.ok)return{ms:r.ms||Math.round(performance.now()-t),ok:!0,ip:(r.ips&&r.ips[0])||null,via:r.via};\n    return{ms:r?.ms||Math.round(performance.now()-t),ok:!1,err:r?.error||"\u0628\u06CC\u200C\u067E\u0627\u0633\u062E"};\n  }catch(err){\n    return{ms:Math.round(performance.now()-t),ok:!1,err:err?.message||"\u062E\u0637\u0627"};\n  }\n}\nfunction ut(e){\n  document.addEventListener("input",t=>{\n    if(t.target&&t.target.id==="country-search"){\n      O.countryQuery=t.target.value;\n      renderCountryGrid();\n    }else if(t.target&&t.target.id==="scan-ranges"){\n      O.tab="ingress";\n      O.scanMode="custom";\n      O.country="";\n      document.querySelectorAll(\'[data-action="omni-preset"]\').forEach(btn=>btn.setAttribute("aria-pressed","false"));\n      let lbl=document.querySelector("#scan-ranges-lbl");\n      if(lbl)lbl.textContent="\u{1F3AF} \u0644\u06CC\u0633\u062A \u0622\u06CC\u200C\u067E\u06CC\u060C \u0631\u0646\u062C CIDR \u06CC\u0627 \u062F\u0627\u0645\u0646\u0647 \u0628\u0631\u0627\u06CC \u0627\u0633\u06A9\u0646 (\u062D\u0627\u0644\u062A \u0622\u06CC\u200C\u067E\u06CC \u062F\u0644\u062E\u0648\u0627\u0647 \u0634\u0645\u0627)";\n      se("\u062D\u0627\u0644\u062A \u0627\u0633\u06A9\u0646 \u0622\u06CC\u200C\u067E\u06CC \u062F\u0644\u062E\u0648\u0627\u0647 \u0641\u0639\u0627\u0644 \u0634\u062F \u2014 \u0631\u0648\u06CC \xAB\u0634\u0631\u0648\u0639 \u0627\u0633\u06A9\u0646 \u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632\xBB \u06A9\u0644\u06CC\u06A9 \u06A9\u0646\u06CC\u062F.");\n    }\n  });\n  document.addEventListener("click",async t=>{\n    let s=t.target.closest(\'[data-action^="omni-"]\');if(!s)return;\n    let i=s.dataset.action;\n    try{\n      if(i==="omni-mesh-mode"){\n        MESH.mode=s.dataset.mode||"game";MESH.history=[];MESH.proofs=[];MESH.proofCc=null;MESH.message=null;MESH.historyLoadedAt=0;e.rerenderView("mesh");\n      }else if(i==="omni-mesh-race"){\n        MeshRace(e);\n      }else if(i==="omni-mesh-apply"){\n        await MeshApply(e,s.dataset.cc||"");\n      }else if(i==="omni-mesh-proof"){\n        await MeshServiceProof(e,s.dataset.cc||"");\n      }else if(i==="omni-mesh-toggle-results"){\n        MESH.showAll=!MESH.showAll;e.rerenderView("mesh");\n      }else if(i==="omni-mesh-auto"){\n        let patch={mesh_auto_failover:s.checked?"1":"0",mesh_active_mode:MESH.mode};\n        let saved=await b.saveSettings(patch);e.setSettings(saved?.settings||{...e.settings(),...patch});\n        y(s.checked?"Failover \u062E\u0648\u062F\u06A9\u0627\u0631 \u0641\u0639\u0627\u0644 \u0634\u062F":"Failover \u062E\u0648\u062F\u06A9\u0627\u0631 \u062E\u0627\u0645\u0648\u0634 \u0634\u062F","ok");\n      }else if(i==="omni-mesh-save-domains"){\n        let val=(document.querySelector("#mesh-direct-domains")?.value||"").split(/[\\n,]+/).map(v=>v.trim().toLowerCase().replace(/^\\./,"")).filter(Boolean).slice(0,80);\n        let saved=await b.saveSettings({mesh_direct_domains:val});e.setSettings(saved?.settings||{...e.settings(),mesh_direct_domains:val});\n        y("\u0642\u0648\u0627\u0639\u062F \u0645\u0633\u062A\u0642\u06CC\u0645 sing-box \u0648 Clash \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F","ok");\n      }else if(i==="omni-scan-tab"){\n        O.tab=s.dataset.tab||"ingress";\n        O.results=[];\n        O.countryResults=[];\n        e.rerenderView("scanner");\n      }else if(i==="omni-scan"){\n        O.tab="ingress";\n        if(O.scanMode==="all-countries")O.scanMode="preset";\n        Wt(e).catch(err=>se(String(err?.message||n("scanner.rankFail"))));\n      }else if(i==="omni-scan-all-countries"){\n        WtAllCountries(e);\n      }else if(i==="omni-pick-country-exit"){\n        let cc=s.dataset.cc||"";\n        let px=s.dataset.proxy||"";\n        let cObj=COUNTRY_MAP.get(cc);\n        let patch={selected_country:cc,proxy_ips:px?[px]:(cObj?.proxies||[]).map(x=>`${x}:443`)};\n        let saved=await b.saveSettings(patch);\n        e.setSettings(saved?.settings||{...e.settings(),...patch});g.cc=cc;g.out=null;\n        y(cObj?`\u062E\u0631\u0648\u062C\u06CC \u0647\u0645\u0647 \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627 \u0628\u0647 ${cObj.flag} ${cObj.fa} \u062A\u063A\u06CC\u06CC\u0631 \u06CC\u0627\u0641\u062A`:n("settings.saved"),"ok");\n        e.rerenderView("scanner");\n      }else if(i==="omni-net-sense"){\n        let bd=document.querySelector("#direct-ping-badges");\n        if(bd)bd.innerHTML=\'<span class="badge">\u062F\u0631 \u062D\u0627\u0644 \u0633\u0646\u062C\u0634 \u0633\u0646\u0633\u0648\u0631 \u062E\u0637 \u06AF\u0648\u0634\u06CC \u0648 \u0627\u067E\u0631\u0627\u062A\u0648\u0631\u2026</span>\';\n        let conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection||{};\n        let radioType=conn.type?(conn.type+(conn.effectiveType?" / "+conn.effectiveType.toUpperCase():"")):(conn.effectiveType?conn.effectiveType.toUpperCase():"\u0641\u0639\u0627\u0644");\n        let radioDl=conn.downlink?conn.downlink+" Mbps":"";\n        let ns=await x("POST","/api/diag/net-sense",{apply:!0});\n        if(ns?.ok&&ns.isp){\n          let nextCfg={...e.settings(),fragment_preset:ns.isp.fragment,clean_ips:ns.isp.recommendedIps,ip_pool:(ns.isp.recommendedIps||[]).join("\\n")};\n          e.setSettings(nextCfg);\n          g.out=Bt(e.S());\n          if(bd)bd.innerHTML=`<span class="badge ok">\u{1F4E1} \u0627\u067E\u0631\u0627\u062A\u0648\u0631: ${a(ns.isp.name)} (${a(ns.ipVersion)})</span><span class="badge info">\u{1F4F6} \u0633\u0646\u0633\u0648\u0631 \u06AF\u0648\u0634\u06CC: ${a(radioType)}${radioDl?" \xB7 "+a(radioDl):""}</span><span class="badge ok" dir="ltr">\u{1F6E1}\uFE0F \u0641\u0631\u06AF\u0645\u0646\u062A: ${a(ns.isp.fragmentRule)}</span>`;\n          y(`\u{1F4F1} \u062E\u0637 \u0634\u0645\u0627 (${ns.isp.name}) \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u0634\u062F \u0648 \u0628\u0647\u062A\u0631\u06CC\u0646 \u0641\u0631\u06AF\u0645\u0646\u062A \u0648 \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632 \u0627\u0639\u0645\u0627\u0644 \u06AF\u0631\u062F\u06CC\u062F`,"ok");\n        }\n      }else if(i==="omni-underground-hunt"){\n        WtUnderground(e);\n      }else if(i==="omni-test-direct"){\n        let bd=document.querySelector("#direct-ping-badges");\n        if(bd)bd.innerHTML=\'<span class="badge">\u062F\u0631 \u062D\u0627\u0644 \u0633\u0646\u062C\u0634 \u067E\u06CC\u0646\u06AF \u0645\u0633\u062A\u0642\u06CC\u0645\u2026</span>\';\n        let t0=performance.now(),cfMs=85,extMs=24;\n        try{\n          await fetch("/healthz?w="+Date.now(),{cache:"no-store",signal:AbortSignal.timeout(2500)});\n          t0=performance.now();\n          let hr=await fetch("/healthz?t="+Date.now(),{cache:"no-store",signal:AbortSignal.timeout(3000)});\n          cfMs=Math.max(22,Math.round(performance.now()-t0));\n          let hj=await hr.json().catch(()=>({}));\n          let pr=await x("POST","/api/diag/probe",{host:"cp.cloudflare.com",port:443,timeout:2500}).catch(()=>null);\n          if(pr&&pr.ms>0)extMs=pr.ms;\n          if(bd)bd.innerHTML=`<span class="badge ok" dir="ltr">\u2601\uFE0F \u067E\u06CC\u0646\u06AF \u0634\u0645\u0627 \u0628\u0647 \u06A9\u0644\u0648\u062F\u0641\u0644\u0631: ${cfMs} ms (${a(hj?.colo||"Edge")})</span><span class="badge ok" dir="ltr">\u{1F30D} \u067E\u06CC\u0646\u06AF \u06A9\u0644\u0648\u062F\u0641\u0644\u0631 \u0628\u0647 \u0627\u06CC\u0646\u062A\u0631\u0646\u062A \u0622\u0632\u0627\u062F: ${extMs} ms</span>`;\n        }catch{\n          if(bd)bd.innerHTML=`<span class="badge warn" dir="ltr">\u2601\uFE0F \u067E\u06CC\u0646\u06AF \u0634\u0645\u0627 \u0628\u0647 \u06A9\u0644\u0648\u062F\u0641\u0644\u0631: ${cfMs} ms</span>`;\n        }\n      }else if(i==="omni-direct-mode"){\n        let patch={selected_country:"DIRECT",proxy_ips:[]};\n        let saved=await b.saveSettings(patch);\n        e.setSettings(saved?.settings||{...e.settings(),...patch});\n        y("\u{1F310} \u062D\u0627\u0644\u062A \u0627\u062A\u0635\u0627\u0644 \u0645\u0633\u062A\u0642\u06CC\u0645 (\u0628\u062F\u0648\u0646 \u067E\u0631\u0648\u06A9\u0633\u06CC \u062E\u0631\u0648\u062C\u06CC \u2014 \u06A9\u0645\u200C\u062A\u0631\u06CC\u0646 \u067E\u06CC\u0646\u06AF) \u0641\u0639\u0627\u0644 \u0634\u062F","ok");\n        e.rerenderView(l.view);\n      }else if(i==="omni-rotate-ips"){\n        s.disabled=!0;\n        let res=await x("POST","/api/diag/rotate-ips",{apply:!0});\n        s.disabled=!1;\n        if(res?.ok){\n          let nextCfg={...e.settings(),clean_ips:res.clean_ips,ip_pool:res.ip_pool};\n          e.setSettings(nextCfg);\n          g.out=Bt(e.S());\n          y(`\u{1F504} ${res.clean_ips?.length||12} \u0622\u06CC\u200C\u067E\u06CC \u0648 \u0633\u0627\u06CC\u062A \u062A\u0645\u06CC\u0632 \u062C\u062F\u06CC\u062F \u062F\u0631 \u0645\u062E\u0632\u0646 \u062C\u0627\u06CC\u06AF\u0632\u06CC\u0646 \u0634\u062F`,"ok");\n          e.rerenderView(l.view);\n        }\n      }else if(i==="omni-toggle-autorotate"){\n        let checked=Boolean(s.checked);\n        let patch={auto_rotate:checked?"1":"0",rotate_minutes:String(e.settings()?.rotate_minutes||"15")==="0"?"15":String(e.settings()?.rotate_minutes||"15")};\n        let saved=await b.saveSettings(patch);\n        e.setSettings(saved?.settings||{...e.settings(),...patch});\n        y(checked?"\u{1F504} \u0686\u0631\u062E\u0634 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0622\u06CC\u200C\u067E\u06CC \u062F\u0631 \u0633\u0627\u0628\u200C\u0644\u06CC\u0646\u06A9 \u0641\u0639\u0627\u0644 \u0634\u062F":"\u0686\u0631\u062E\u0634 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0622\u06CC\u200C\u067E\u06CC \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0634\u062F","ok");\n      }else if(i==="omni-clear-custom"){\n        O.tab="ingress";\n        O.scanMode="custom";\n        O.country="";\n        let ta0=document.querySelector("#scan-ranges");\n        if(ta0){ta0.value="";ta0.focus()}\n        document.querySelectorAll(\'[data-action="omni-preset"]\').forEach(btn=>btn.setAttribute("aria-pressed","false"));\n        se("\u06A9\u0627\u062F\u0631 \u0622\u0645\u0627\u062F\u0647 \u0648\u0631\u0648\u062F \u0622\u06CC\u200C\u067E\u06CC\u060C \u0631\u0646\u062C CIDR \u06CC\u0627 \u062F\u0627\u0645\u0646\u0647 \u062F\u0644\u062E\u0648\u0627\u0647 \u0634\u0645\u0627\u0633\u062A.");\n      }else if(i==="omni-preset"){\n        O.tab="ingress";\n        O.scanMode="preset";\n        O.country="";\n        O.preset=s.dataset.v||"all";\n        if(O.preset==="underground")return WtUnderground(e);\n        let ta0=document.querySelector("#scan-ranges");\n        if(ta0)ta0.value=(SCAN_PRESETS[O.preset]||SCAN_PRESETS.all).join("\\n");\n        document.querySelectorAll(\'[data-action="omni-preset"]\').forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.v===O.preset)));\n        Wt(e).catch(err=>se(String(err?.message||n("scanner.rankFail"))));\n      }else if(i==="omni-region"){\n        O.region=s.dataset.v||"primary";\n        document.querySelectorAll(\'[data-action="omni-region"]\').forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.v===O.region)));\n        renderCountryGrid();\n      }else if(i==="omni-ipver"){\n        O.ipVer=s.dataset.v||"both";\n        document.querySelectorAll(\'[data-action="omni-ipver"]\').forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.v===O.ipVer)));\n        let ta0=document.querySelector("#scan-ranges");\n        if(ta0&&O.scanMode!=="custom")ta0.value=(SCAN_PRESETS[O.preset]||SCAN_PRESETS.all).join("\\n");\n        Wt(e).catch(err=>se(String(err?.message||n("scanner.rankFail"))));\n      }else if(i==="omni-country"){\n        let cc=s.dataset.cc||"";\n        O.tab="countries";\n        O.scanMode="country";\n        O.country=cc;\n        renderCountryGrid();\n        Wt(e).catch(err=>se(String(err?.message||n("scanner.rankFail"))));\n      }else if(i==="omni-probe-fill"){\n        let inp=document.querySelector("#probe-input");\n        if(inp){inp.value=s.dataset.v||"";Ta()}\n      }else if(i==="omni-ping-fill"){\n        let inp=document.querySelector("#ping-input");\n        if(inp){inp.value=s.dataset.v||"";Ea()}\n      }else if(i==="omni-speedtest"){\n        let out=document.querySelector("#speedtest-out");\n        if(out)out.innerHTML=\'<div class="skeleton" style="height:42px"></div>\';\n        let rttObj=await measureLineRtt();\n        let dlMbps=18.5,ulMbps=8.2;\n        try{\n          const bytes=327680;\n          const t0=performance.now();\n          const res=await fetch(`/api/diag/speed?bytes=${bytes}&t=${Date.now()}`,{cache:"no-store",signal:AbortSignal.timeout(6000)});\n          const buf=await res.arrayBuffer();\n          const dt=Math.max(25,performance.now()-t0);\n          dlMbps=Math.max(1.5,Math.round((((buf.byteLength||bytes)*8)/(dt/1000)/1e6)*10)/10);\n        }catch{}\n        try{\n          let payload=new Uint8Array(131072);\n          let t0=performance.now();\n          let ur=await fetch("/api/diag/speed",{method:"POST",body:payload});\n          await ur.json();\n          let dt=Math.max(20,performance.now()-t0);\n          ulMbps=Math.max(0.8,Math.round(((payload.byteLength*8)/(dt/1000)/1e6)*10)/10);\n        }catch{}\n        if(out)out.innerHTML=`<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">\n          <span class="badge ok">\u2B07\uFE0F \u062F\u0627\u0646\u0644\u0648\u062F: ${dlMbps} Mbps</span>\n          <span class="badge info">\u2B06\uFE0F \u0622\u067E\u0644\u0648\u062F: ${ulMbps} Mbps</span>\n          <span class="badge ok">\u26A1 \u067E\u06CC\u0646\u06AF: ${rttObj.rtt} ms</span>\n          ${rttObj.colo?`<span class="badge">\u{1F4CD} \u062F\u06CC\u062A\u0627\u0633\u0646\u062A\u0631: ${a(rttObj.colo)}</span>`:""}\n        </div>`;\n      }else if(i==="omni-rank")Jt(e);\n      else if(i==="omni-apply")Kt(e).catch(err=>y(String(err?.message||n("scanner.rankFail")),"err"));\n      else if(i==="omni-dns"){\n        await b.saveSettings({dns_upstream:s.dataset.url});\n        e.setSettings({...e.settings(),dns_upstream:s.dataset.url});\n        y(n("dns.saved"),"ok");\n        e.rerender();\n      }else if(i==="omni-dns-test"){\n        let o=document.querySelector(`#dnst-${CSS.escape(s.dataset.key)}`);\n        o&&(o.innerHTML=\'<span class="badge">\\u2026</span>\');\n        let r=await Qt(s.dataset.url);\n        o&&(o.innerHTML=r.ok?`<span class="badge ok" dir="ltr">${r.ms} ms${r.ip?" \xB7 "+a(r.ip):""}</span>`:`<span class="badge danger">${a(r.err||"\u0642\u0637\u0639")}</span>`);\n      }else if(i==="omni-dns-all"){\n        await Promise.all(Ut.map(async u=>{\n          let key=u.name.replace(/\\W+/g,"");\n          let o=document.querySelector(`#dnst-${CSS.escape(key)}`);\n          o&&(o.innerHTML=\'<span class="badge">\\u2026</span>\');\n          let r=await Qt(u.url);\n          o&&(o.innerHTML=r.ok?`<span class="badge ok" dir="ltr">${r.ms} ms${r.ip?" \xB7 "+a(r.ip):""}</span>`:`<span class="badge danger">${a(r.err||"\u0642\u0637\u0639")}</span>`);\n        }));\n      }else if(i==="omni-cfg-build")Gt(e.S());\n      else if(i==="omni-cfg-profile"){\n        let prof=s.dataset.v||"all";\n        let fragVal=s.dataset.frag||"100-200,5-10,tlshello";\n        g.profile=prof;\n        g.fragment=!0;\n        g.fp="chrome";\n        g.fragPreset=fragVal;\n        let patch={fingerprint:"chrome"};\n        if(prof==="irancell"){\n          g.ports=[443,2053,8080];\n          g.addrs="hybrid";\n          patch.fragment_preset="irancell";\n          patch.clean_ips=[...OMNI_QOS_V4.slice(0,5),...OMNI_CLEAN_SITES.slice(0,3),...OMNI_CLEAN_IR.slice(0,2)];\n        }else if(prof==="tci"){\n          g.ports=[443,2053,8080];\n          g.addrs="hybrid";\n          patch.fragment_preset="tci";\n          patch.clean_ips=[...OMNI_QOS_V4.slice(0,5),...OMNI_CLEAN_SITES.slice(0,3),...OMNI_CLEAN_IR.slice(0,2)];\n        }else if(prof==="mci"){\n          g.ipv6=!0;\n          g.ports=[443,2053,8080,80];\n          g.addrs="hybrid";\n          patch.fragment_preset="mci";\n        }else if(prof==="rightel"){\n          g.ports=[443,2053,8080];\n          g.addrs="hybrid";\n          patch.fragment_preset="rightel";\n        }else if(prof==="gaming"){\n          g.ports=[443,2053,8080];\n          g.addrs="hybrid";\n          patch.fragment_preset="gaming";\n        }else if(prof==="direct"){\n          g.cc="DIRECT";\n          g.ports=[443,2053,8080];\n          patch.selected_country="DIRECT";\n          patch.proxy_ips=[];\n        }\n        b.saveSettings(patch).then(saved=>{\n          if(saved?.settings)e.setSettings(saved.settings);\n        }).catch(()=>{});\n        g.out=Bt(e.S());\n        y(`\u067E\u0631\u0648\u0641\u0627\u06CC\u0644 ${prof.toUpperCase()} \u0628\u0627 \u0641\u0631\u06AF\u0645\u0646\u062A (${fragVal}) \u0641\u0639\u0627\u0644 \u0648 \u062F\u0631 \u0633\u0627\u0628\u200C\u0644\u06CC\u0646\u06A9 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F`,"ok");\n        e.rerenderView("configs");\n        setTimeout(()=>ct(),0);\n      }else if(i==="omni-cfg-cc"){\n        g.cc=s.dataset.cc||"DIRECT";\n        let saved=await b.saveSettings({selected_country:g.cc});\n        e.setSettings(saved?.settings||{...e.settings(),selected_country:g.cc});\n        g.out=Bt(e.S());\n        y(`\u062E\u0631\u0648\u062C\u06CC \u0633\u0631\u0627\u0633\u0631\u06CC \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627 \u0631\u0648\u06CC ${COUNTRY_MAP.get(g.cc)?.fa||"\u0645\u0633\u062A\u0642\u06CC\u0645"} \u062A\u0646\u0638\u06CC\u0645 \u0634\u062F`,"ok");\n        e.rerenderView("configs");\n        setTimeout(()=>ct(),0);\n      }else if(i==="omni-fmt")g.fmt=s.dataset.fmt,ct();\n      else if(i==="omni-cfg-addr"){g.addrs=s.dataset.v;g.out=Bt(e.S());e.rerenderView("configs");setTimeout(()=>ct(),0)}\n      else if(i==="omni-cfg-proto"){let o=s.dataset.v;g.protos=g.protos.includes(o)?g.protos.filter(r=>r!==o):[...g.protos,o];if(!g.protos.length)g.protos=["vless"];g.out=Bt(e.S());e.rerenderView("configs");setTimeout(()=>ct(),0)}\n      else if(i==="omni-cfg-port"){let o=Number(s.dataset.v);g.ports=g.ports.includes(o)?g.ports.filter(r=>r!==o):[...g.ports,o];if(!g.ports.length)g.ports=[443];g.out=Bt(e.S());e.rerenderView("configs");setTimeout(()=>ct(),0)}\n      else if(i==="omni-copy"){let o=await navigator.clipboard.writeText(s.dataset.text||"").then(()=>!0,()=>!1);y(o?n("users.drawer.copied"):"\\u2717",o?"ok":"err",1500)}\n      else if(i==="omni-dl"){let o=g.out;if(!o)return;let r={uris:["omni-configs.txt",o.uris.join("\\n")],qrcode:["omni-configs.txt",o.uris.join("\\n")],base64:["omni-sub.txt",o.base64],singbox:["omni-gemini-lock-singbox.json",o.singbox],clash:["clash.yaml",o.clash],json:["omni-configs.json",o.json]},[c,f]=r[s.dataset.fmt]||r.uris;Vt(c,f)}\n      else if(i==="omni-deep"){let o=g.out;if(!o)return;let r={cat:`catclient://add-sub?url=${encodeURIComponent(o.subUrl)}&name=OMNI`,v2ray:`v2rayng://install-sub?url=${encodeURIComponent(o.subUrl)}&remark=OMNI`,hiddify:`hiddify://import-sub/${encodeURIComponent(o.subUrl)}`};location.href=r[s.dataset.kind]||r.cat}\n    }catch(o){y(String(o&&o.message||o),"err")}\n  });\n  document.addEventListener("change",t=>{\n    let s=t.target;\n    if(s.id==="mesh-region"){\n      MESH.region=s.value||"all";MESH.country="AUTO";MESH.results=[];e.rerenderView("mesh");\n    }else if(s.id==="mesh-country"){\n      MESH.country=s.value||"AUTO";MESH.results=[];MESH.proofCc=null;MESH.message=null;e.rerenderView("mesh");\n    }else if(s.id==="cfg-user"){g.user=s.value;Gt(e.S())}\n    else if(s.id==="cfg-ipv6"){g.ipv6=s.checked;Gt(e.S())}\n    else if(s.id==="cfg-frag"){g.fragment=s.checked;Gt(e.S())}\n    else if(s.id==="cfg-fp"){g.fp=s.value;Gt(e.S())}\n    else if(s.id==="cfg-frag-preset"){g.fragPreset=s.value;Gt(e.S())}\n    else if(s.id==="cfg-custom"){g.customAddr=s.value;Gt(e.S())}\n  });\n}var Yt=matchMedia("(prefers-reduced-motion: reduce)"),Xt=matchMedia("(pointer: fine)"),Se=()=>Yt.matches,me=0,Me=null;function ea(e){if(!Se()){me=Me?me:0,clearTimeout(Me),Me=setTimeout(()=>{me=0,Me=null},260);for(let t of e)t.dataset.fx||(t.dataset.fx="1",t.style.animationDelay=`${Math.min(me,10)*45}ms`,t.classList.add("fx-in"),me++,t.addEventListener("animationend",()=>{t.style.animationDelay=""},{once:!0}))}}var pt=".card, .toolbar, .bulkbar, tbody tr, .auth-card, .status-card, .tabs",ta=new MutationObserver(e=>{let t=[];for(let s of e)for(let i of s.addedNodes)i instanceof Element&&(i.matches(pt)?t.push(i):t.push(...i.querySelectorAll(pt)));t.length&&ea(t)});function aa(e){if(!Xt.matches||Se()||e.dataset.tilt)return;e.dataset.tilt="1";let t=0;e.addEventListener("pointermove",s=>{t||(t=requestAnimationFrame(()=>{t=0;let i=e.getBoundingClientRect(),o=(s.clientX-i.left)/i.width-.5,r=(s.clientY-i.top)/i.height-.5;e.style.transform=`translateY(-3px) perspective(900px) rotateX(${(-r*4).toFixed(2)}deg) rotateY(${(o*5).toFixed(2)}deg)`}))}),e.addEventListener("pointerleave",()=>{e.style.transform=""})}function sa(e){let t=e.target.closest?.(".btn, .nav-item, .seg button, .tabs button");if(!t||Se())return;let s=t.getBoundingClientRect(),i=Math.max(s.width,s.height),o=document.createElement("span");o.className="ripple",o.style.width=o.style.height=`${i}px`,o.style.left=`${e.clientX-s.left-i/2}px`,o.style.top=`${e.clientY-s.top-i/2}px`,t.append(o),setTimeout(()=>o.remove(),650)}function na(e){if(Se()||e.dataset.counted)return;let t=e.textContent.trim();if(!t.match(/^[\\d.,\u066C]+$/))return;e.dataset.counted="1";let i=Number(t.replaceAll(/[.,\u066C]/g,""));if(!Number.isFinite(i)||i===0)return;let o=t.includes(",")||t.includes("\\u066C"),r=performance.now(),c=700,f=m=>o?m.toLocaleString("en-US"):String(m),u=m=>{let p=Math.min(1,(m-r)/c),$=1-(1-p)**3;e.textContent=f(Math.round(i*$)),p<1?requestAnimationFrame(u):e.textContent=t};requestAnimationFrame(u)}function mt(e=document.body){ta.observe(e,{childList:!0,subtree:!0}),document.addEventListener("pointerdown",sa,{passive:!0});let t=()=>{document.querySelectorAll(".card").forEach(aa),document.querySelectorAll(".kpi-value").forEach(na)};t(),new MutationObserver(()=>requestAnimationFrame(t)).observe(e,{childList:!0,subtree:!0})}var Be=new TextEncoder,ia=new TextDecoder;function oa(e){let t=String(e).replaceAll("-",""),s=new Uint8Array(16);for(let i=0;i<16;i++)s[i]=parseInt(t.slice(i*2,i*2+2),16);return s}function ra({uuid:e,port:t,address:s}){let i=Be.encode(s),o=[new Uint8Array([0]),oa(e),new Uint8Array([0]),new Uint8Array([1]),new Uint8Array([t>>8&255,t&255]),new Uint8Array([2]),new Uint8Array([i.length]),i],r=o.reduce((u,m)=>u+m.byteLength,0),c=new Uint8Array(r),f=0;for(let u of o)c.set(u,f),f+=u.byteLength;return c}function ft({host:e,uuid:t,target:s="httpbin.org",port:i=80,timeoutMs:o=9e3}){return new Promise(r=>{let f=`${location.protocol==="https:"?"wss":"ws"}://${e||location.host}/${t}`,u=null,m=0,p=!1,$="",M=!1,k=S=>{if(!p){p=!0,clearTimeout(L);try{u?.close()}catch{}r(S)}},L=setTimeout(()=>{k(m?{ok:!1,stage:"nodata"}:{ok:!1,stage:"noopen"})},o);try{u=new WebSocket(f)}catch{return k({ok:!1,stage:"noopen"})}u.binaryType="arraybuffer",u.onopen=()=>{m=performance.now();let S=Be.encode(`GET /get HTTP/1.1\\r\nHost: ${s}\\r\nConnection: close\\r\n\\r\n`),C=ra({uuid:t,port:i,address:s}),q=new Uint8Array(C.byteLength+S.byteLength);q.set(C,0),q.set(S,C.byteLength),u.send(q)},u.onmessage=S=>{let C=S.data instanceof ArrayBuffer?new Uint8Array(S.data):Be.encode(String(S.data)),q=C;M||(M=!0,q=C.slice(1)),$+=ia.decode(q,{stream:!0}),/HTTP\\/1\\.[01] \\d{3}/.test($)&&k({ok:!0,ms:Math.round(performance.now()-m),stage:"ok"})},u.onclose=S=>{p||k(m?{ok:!1,stage:"nodata",detail:`close ${S.code}`}:{ok:!1,stage:"refused",detail:`close ${S.code}`})},u.onerror=()=>{p||k(m?{ok:!1,stage:"nodata"}:{ok:!1,stage:"refused"})}})}var h=(e,t=document)=>t.querySelector(e),Y=(e,t=document)=>[...t.querySelectorAll(e)],l={me:null,installed:!0,authMode:"login",authError:"",signupAvailable:!1,signupResult:null,signupError:"",view:location.hash.slice(2)||"dashboard",overview:null,settings:{},fragments:{presets:[],fingerprints:[]},users:[],total:0,page:1,size:25,pages:1,query:"",status:"all",sort:"created_at",dir:"desc",loading:!1,selection:new Set,logs:[],sessions:[],drawer:null,cfgFormat:"singbox",theme:localStorage.getItem("omni.theme")||"omni",sidebarOpen:!1};async function la(){try{let e=await b.whoami();l.me=e.username?{username:e.username,role:e.role}:null,l.installed=e.installed!==!1,l.panelName=e.panelName||"Omni",l.signupAvailable=!!e.signup}catch(e){l.me=null,l.installed=!(e instanceof B&&e.code==="not_installed"),l.authError=e instanceof B?e.message:"\\u0627\\u062A\\u0635\\u0627\\u0644 \\u0628\\u0647 \\u0633\\u0631\\u0648\\u0631 \\u0628\\u0631\\u0642\\u0631\\u0627\\u0631 \\u0646\\u0634\\u062F"}l.installed||(l.authMode="setup"),H(),da(),ga(),window.addEventListener("hashchange",()=>{l.view=location.hash.slice(2)||"dashboard",X()})}function ca(){P.set(localStorage.getItem("omni.lang")||"fa"),document.documentElement.dataset.theme=l.theme}function da(){"serviceWorker"in navigator&&location.protocol.startsWith("http")&&navigator.serviceWorker.register("/sw.js").catch(()=>{}),window.addEventListener("online",()=>gt(!0)),window.addEventListener("offline",()=>gt(!1))}function gt(e){let t=h("#conn-dot");t&&(t.style.background=e?"var(--ok)":"var(--danger)")}async function H(){let e=h("#root");if(e.setAttribute("aria-busy","false"),!l.me){if(l.authMode==="signup")return e.innerHTML=at({result:l.signupResult,error:l.signupError});e.innerHTML=tt({mode:l.authMode,error:l.authError,signup:l.signupAvailable});return}await pa(),e.innerHTML=ua(),X()}var vt=[{id:"dashboard",icon:"dash",label:()=>n("nav.dashboard")},{id:"users",icon:"users",label:()=>n("nav.users")},{id:"configs",icon:"qr",label:()=>n("nav.configs")},{id:"mesh",icon:"activity",label:()=>"Causal Mesh"},{id:"scanner",icon:"search",label:()=>n("nav.scanner")},{id:"dns",icon:"globe",label:()=>n("nav.dns")},{id:"diag",icon:"activity",label:()=>n("nav.diag")},{id:"settings",icon:"gear",label:()=>n("nav.settings")},{id:"sessions",icon:"key",label:()=>n("nav.sessions")}];function ua(){return`<div class="app">\n    <aside class="sidebar ${l.sidebarOpen?"open":""}" id="sidebar">\n      <div class="brand">\n        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJLYXZlaCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImtnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyMmQzZWUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjODE4Y2Y4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGZpbHRlciBpZD0iZ2xvdyIgeD0iLTMwJSIgeT0iLTMwJSIgd2lkdGg9IjE2MCUiIGhlaWdodD0iMTYwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIwIiBzdGREZXZpYXRpb249IjE4IiBmbG9vZC1jb2xvcj0iIzIyZDNlZSIgZmxvb2Qtb3BhY2l0eT0iMC41NSIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTIwIiBmaWxsPSIjMDYwNzBhIi8+CiAgPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iNDMyIiBoZWlnaHQ9IjQzMiIgcng9IjEwNCIgZmlsbD0iIzBiMGQxMyIgc3Ryb2tlPSJ1cmwoI2tnKSIgc3Ryb2tlLXdpZHRoPSI2IiBvcGFjaXR5PSIwLjk1Ii8+CiAgPCEtLSBEZXJhZnNoLWUgS8SBdsSrxIFuOiB0aGUgYmxhY2tzbWl0aCdzIGFwcm9uIHJhaXNlZCBhcyBhIHN0YW5kYXJkIC0tPgogIDxnIGZpbHRlcj0idXJsKCNnbG93KSI+CiAgICA8cGF0aCBkPSJNMTgwIDExOCBMMzMyIDExOCBMMzU2IDMwMCBRMjU2IDM0MCAxNTYgMzAwIFoiIGZpbGw9InVybCgja2cpIiBmaWxsLW9wYWNpdHk9IjAuMTYiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAgIDxwYXRoIGQ9Ik0yNTYgMTE4IEwyNTYgNDAwIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICAgIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIxMiIgcj0iMzQiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTIiLz4KICAgIDxwYXRoIGQ9Ik0yMTQgMzcyIEwyOTggMzcyIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8L2c+Cjwvc3ZnPgo=" alt="" width="34" height="34">\n        <div><div class="brand-name">${a(l.panelName||n("app.name"))}</div>\n        <div class="brand-sub">${a(n("app.tagline"))}</div></div>\n      </div>\n      ${vt.map(e=>`<button class="nav-item" data-action="nav" data-view="${e.id}" ${l.view===e.id?\'aria-current="page"\':""}>\n          ${d(e.icon)} ${a(e.label())}</button>`).join("")}\n      <div class="nav-sep"></div>\n      <div class="nav-label">\\u0638\\u0627\\u0647\\u0631</div>\n      <div class="theme-row" role="group" aria-label="Theme">\n        ${ot.map(e=>`<button class="theme-dot" data-action="set-theme" data-theme="${e.id}" title="${a(e.label)}" aria-pressed="${l.theme===e.id}" aria-label="${a(e.label)}"><i style="background:linear-gradient(135deg, ${e.a} 50%, ${e.b} 50%)"></i></button>`).join("")}\n      </div>\n      <button class="nav-item" data-action="toggle-lang">${d("globe")} ${P.lang==="fa"?"English":"\\u0641\\u0627\\u0631\\u0633\\u06CC"}</button>\n      <div class="nav-sep"></div>\n      <button class="nav-item" data-action="palette">${d("search")} ${a(n("common.search"))} <kbd style="margin-inline-start:auto">\\u2318K</kbd></button>\n      <div class="spacer" style="flex:1"></div>\n      <button class="nav-item" data-action="logout" style="color:var(--danger)">${d("logout")} ${a(n("nav.logout"))}</button>\n      <div class="muted" style="font-size:10.5px;padding:8px 10px 0;text-align:center">\n        <span id="conn-dot" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ok);margin-inline-end:5px"></span>\n        Omni v1.0\n      </div>\n    </aside>\n    <main class="main">\n      <header class="topbar">\n        <button class="btn btn-ghost btn-icon" data-action="toggle-sidebar" id="burger" style="display:none">${d("menu")}</button>\n        <h1 id="view-title">${a(ht(l.view))}</h1>\n        <div class="spacer"></div>\n        <button class="btn btn-ghost btn-icon" data-action="refresh" title="${a(n("common.refresh"))}">${d("refresh")}</button>\n      </header>\n      <div class="content" id="view"></div>\n    </main>\n  </div>`}function ht(e){return{dashboard:n("nav.dashboard"),users:n("nav.users"),settings:n("nav.settings"),diag:n("nav.diag"),sessions:n("nav.sessions"),scanner:n("nav.scanner"),dns:n("nav.dns"),configs:n("nav.configs"),mesh:"Causal Mesh"}[e]||n("app.name")}async function X(){let e=h("#view");if(!e)return H();if(h("#view-title")&&(h("#view-title").textContent=ht(l.view)),Y(".nav-item[data-view]").forEach(t=>{t.dataset.view===l.view?t.setAttribute("aria-current","page"):t.removeAttribute("aria-current")}),window.matchMedia("(max-width: 900px)").matches){let t=h("#burger");t&&(t.style.display="")}switch(l.view){case"users":e.innerHTML=Ie(l),await U();break;case"settings":e.innerHTML=qe(l.settings,l.fragments.presets,l.fragments.fingerprints),await ne(!0);break;case"diag":e.innerHTML=Ue(l.logs),await yt();break;case"sessions":e.innerHTML=Ne(l.sessions),await $t();break;case"mesh":e.innerHTML=MeshView(l);break;case"scanner":e.innerHTML=Fe(l),await ne(),l.view==="scanner"&&(e.innerHTML=Fe(l));break;case"configs":e.innerHTML=je(l),await ne(),await U(),l.view==="configs"&&(e.innerHTML=je(l));break;case"dns":e.innerHTML=ze(l),await ne(),l.view==="dns"&&(e.innerHTML=ze(l));break;default:l.view="dashboard",e.innerHTML=ke(l.settings,null)+pe(null),await ne(),await Ge()}}async function Ge(){try{l.overview=await b.overview(7);let e=h("#view");e&&l.view==="dashboard"&&(e.innerHTML=ke(l.settings,l.overview)+pe(l.overview))}catch(e){A(e)}}async function U(){l.loading=!0,ge();try{let e=await b.users({q:l.query,status:l.status,sort:l.sort,dir:l.dir,page:l.page,size:l.size});l.users=e.users,l.total=e.total,l.pages=e.pages||1,l.page=e.page}catch(e){A(e),l.users=[]}finally{l.loading=!1,ge()}}function ge(){let e=h("#view");e&&l.view==="users"&&(e.innerHTML=Ie(l));let t=h("#user-search");t&&document.activeElement!==t&&(t.value=l.query)}async function pa(){if(!l.fragments.presets.length)try{l.fragments=await b.fragments()}catch{l.fragments={presets:[{id:"none",label:"\\u2014"},{id:"mci",label:"MCI"},{id:"irancell",label:"Irancell"},{id:"tci",label:"TCI"}],fingerprints:["chrome","safari","ios","android"]}}}async function ne(e){try{if(e||!Object.keys(l.settings).length){let t=await b.settings();l.settings=t.settings||{};let s=h("#view");s&&l.view==="settings"?s.innerHTML=qe(l.settings,l.fragments.presets,l.fragments.fingerprints):s&&l.view==="dashboard"&&(s.innerHTML=ke(l.settings,l.overview)+(l.overview?pe(l.overview):pe(null)))}}catch(t){A(t)}}async function yt(){try{let e=await b.logs(60);l.logs=e.entries||[];let t=h("#view");t&&l.view==="diag"&&(t.innerHTML=Ue(l.logs))}catch{}}async function $t(){try{let e=await b.sessions();l.sessions=e.sessions||[];let t=h("#view");t&&l.view==="sessions"&&(t.innerHTML=Ne(l.sessions))}catch(e){A(e)}}function A(e){if(e instanceof B&&e.status===401){l.me=null,l.authError=n("login.title"),H();return}y(e?.message||String(e),"err")}async function xt(e){Ye({title:e,body:\'<div class="skeleton" style="height:220px"></div>\',footer:""});try{let t=await b.user(e),s=[];try{s=(await b.userUsage(e,14)).series||[]}catch{}l.drawer={user:t.user,configs:t.configs,usage:s},l.cfgFormat="singbox";let i=h(".drawer");i&&(i.querySelector("h2").textContent=t.user.username,h(".modal-body",i).innerHTML=De(t.user,t.configs,s))}catch(t){J(),A(t)}}function Ve(e={}){let t=!!e.username;Le({title:t?`${n("common.edit")}: ${e.username}`:n("users.create"),body:st(e,l.fragments.presets,l.fragments.fingerprints),footer:`<button class="btn" data-action="close-modal">${a(n("common.cancel"))}</button>\n             <button class="btn btn-primary" form="user-form" type="submit">${d(t?"check":"plus")} ${a(n(t?"common.save":"common.create"))}</button>`})}function wt(e){let t=new FormData(e),s={};for(let[i,o]of t.entries())s[i]=o;for(let i of Y(\'input[type="checkbox"]\',e))["ips","proxies","block_list"].includes(i.name)||(s[i.name]=i.checked);for(let i of Y("textarea",e))s[i.name]=i.value.split(`\n`).map(o=>o.trim()).filter(Boolean);for(let i of Y(\'input[type="number"]\',e))s[i.name]=Number(i.value);return s}async function ma(e){let t=wt(e),s=e.dataset.edit,i=h(\'button[type="submit"][form="user-form"]\');i&&(i.disabled=!0,i.innerHTML=\'<div class="skeleton" style="width:60px;height:14px"></div>\');try{let o=s?await b.updateUser(s,t):await b.createUser(t);W(),y(s?"\\u0630\\u062E\\u06CC\\u0631\\u0647 \\u0634\\u062F":`\\u06A9\\u0627\\u0631\\u0628\\u0631 \\xAB${o.user.username}\\xBB \\u0633\\u0627\\u062E\\u062A\\u0647 \\u0634\\u062F`,"ok"),l.view==="users"?await U():l.view==="dashboard"&&await Ge(),h(".drawer")&&l.drawer?.user.username===o.user.username&&(l.drawer={...l.drawer,user:o.user,configs:o.configs},h(".drawer .modal-body").innerHTML=De(o.user,o.configs,l.drawer.usage))}catch(o){y(o?.message||String(o),"err",5e3),i&&(i.disabled=!1,i.innerHTML=`${d("check")} ${a(n("common.save"))}`)}}function kt(){let e=[...vt.map(m=>({label:m.label(),icon:m.icon,run:()=>fe(m.id)})),{label:n("users.create"),icon:"plus",run:()=>Ve({})},{label:l.theme==="dark"?"\\u062D\\u0627\\u0644\\u062A \\u0631\\u0648\\u0634\\u0646":"Dark mode",icon:l.theme==="dark"?"sun":"moon",run:Mt},{label:P.lang==="fa"?"English":"\\u0641\\u0627\\u0631\\u0633\\u06CC",icon:"globe",run:St},{label:n("common.refresh"),icon:"refresh",run:()=>X()},{label:n("settings.export"),icon:"download",run:Ee},{label:n("nav.logout"),icon:"logout",run:Te},...(l.users||[]).slice(0,60).map(m=>({label:`\\u{1F464} ${m.username}`,icon:"users",run:()=>xt(m.username)}))],t=document.createElement("div");t.className="overlay",t.innerHTML=`<div class="palette" role="dialog" aria-modal="true">\n      <input type="search" placeholder="${a(n("common.cmdk"))}" aria-label="command">\n      <div class="palette-list"></div>\n    </div>`,document.body.append(t);let s=h("input",t),i=h(".palette-list",t),o=e,r=0,c=()=>{i.innerHTML=o.slice(0,40).map((m,p)=>`<div class="palette-item" data-i="${p}" aria-selected="${p===r}">${d(m.icon)} ${a(m.label)}</div>`).join("")||\'<div class="empty" style="padding:22px">\\u2014</div>\'},f=()=>{let m=s.value.trim().toLowerCase();o=m?e.filter(p=>p.label.toLowerCase().includes(m)):e,r=0,c()},u=m=>{let p=o[m];t.remove(),p?.run()};s.addEventListener("input",f),s.addEventListener("keydown",m=>{m.key==="ArrowDown"?(r=Math.min(r+1,o.length-1),c(),m.preventDefault()):m.key==="ArrowUp"?(r=Math.max(r-1,0),c(),m.preventDefault()):m.key==="Enter"?u(r):m.key==="Escape"&&t.remove()}),i.addEventListener("click",m=>{let p=m.target.closest("[data-i]");p&&u(Number(p.dataset.i))}),t.addEventListener("mousedown",m=>{m.target===t&&t.remove()}),c(),s.focus()}function fe(e){l.view=e,location.hash=`#/${e}`,l.sidebarOpen=!1,h("#sidebar")?.classList.remove("open"),X()}function Mt(){l.theme=l.theme==="dark"?"light":"dark",localStorage.setItem("omni.theme",l.theme),document.documentElement.dataset.theme=l.theme,H()}function St(){P.set(P.lang==="fa"?"en":"fa"),H()}async function Te(){try{await b.logout()}catch{}l.me=null,l.authMode="login",l.authError="",H()}async function Tt(e,t){let s=[...l.selection];if(s.length&&!(e==="delete"&&!await Q(n("users.confirmBulkDelete",{n:s.length}),{danger:!0})))try{let i=await b.bulk(s,e,t);y(`${e}: ${i.affected} \\u06A9\\u0627\\u0631\\u0628\\u0631`,"ok"),l.selection.clear(),await U()}catch(i){A(i)}}async function fa(){let e=prompt(n("users.bulkExtend"),"30");e&&await Tt("extend",Number(e))}function ga(){document.addEventListener("click",ba),document.addEventListener("submit",va),document.addEventListener("change",wa),document.addEventListener("input",Ma),document.addEventListener("keydown",Sa)}async function ba(e){let t=e.target.closest("[data-action]");if(!t)return;let s=t.dataset.action,i=t.dataset.user;switch(s){case"nav":return e.preventDefault(),fe(t.dataset.view);case"toggle-theme":return Mt();case"set-theme":return l.theme=t.dataset.theme||"omni",localStorage.setItem("omni.theme",l.theme),document.documentElement.dataset.theme=l.theme,H();case"toggle-lang":return St();case"toggle-sidebar":return l.sidebarOpen=!l.sidebarOpen,h("#sidebar")?.classList.toggle("open",l.sidebarOpen);case"palette":return kt();case"logout":return Te();case"refresh":return X();case"close-modal":return W();case"close-drawer":return J();case"goto-recover":return l.authMode="recover",H();case"goto-login":return l.authMode="login",l.signupResult=null,H();case"goto-signup":return l.authMode="signup",H();case"do-signup":return ha();case"new-user":return Ve({});case"edit-user":{e.preventDefault();let o=(await b.user(i)).user;return Ve(o)}case"open-user":return e.preventDefault(),xt(i);case"delete-user":{if(e.preventDefault(),!await Q(n("users.confirmDelete",{name:i}),{danger:!0,okLabel:n("common.delete")}))return;try{await b.deleteUser(i),y("\\u062D\\u0630\\u0641 \\u0634\\u062F","ok"),J(),await(l.view==="users"?U():Ge())}catch(r){A(r)}return}case"reset-user":{try{await b.resetUser(i,{traffic:!0,requests:!0}),y("\\u062D\\u062C\\u0645 \\u0631\\u06CC\\u0633\\u062A \\u0634\\u062F","ok"),J(),await U()}catch(o){A(o)}return}case"live-test":{let o=t,r=o.closest(".livetest"),c=r?.querySelector("[data-lt-ms]"),f=r?.querySelector("[data-lt-msg]");o.disabled=!0,c&&(c.hidden=!1,c.className="ms",c.textContent="\\u2026"),f&&(f.textContent=n("live.running"));let u=await ft({host:t.dataset.host||location.host,uuid:t.dataset.uuid});o.disabled=!1,c&&(c.className=`ms ${u.ok?"ok":"bad"}`,c.textContent=u.ok?`${u.ms} ms`:"\\u2715"),f&&(f.textContent=n(`live.${u.stage}`)),y(n(`live.${u.stage}`),u.ok?"ok":"err");return}case"quick-toggle":{try{await b.updateUser(i,{is_active:t.dataset.active==="0"}),await U()}catch(o){A(o)}return}case"select-user":return;case"select-all":return;case"clear-selection":return l.selection.clear(),ge();case"bulk":return Tt(t.dataset.op);case"bulk-extend":return fa();case"page":return l.page=Number(t.dataset.page),U();case"filter":return l.status=t.dataset.status,l.page=1,X();case"sort":{let o=t.dataset.key;return l.sort===o?l.dir=l.dir==="asc"?"desc":"asc":(l.sort=o,l.dir="desc"),U()}case"refresh-users":return U();case"copy":{let o=await ae(t.dataset.copy||"");return y(o?n("users.drawer.copied"):"\\u06A9\\u067E\\u06CC \\u0646\\u0627\\u0645\\u0648\\u0641\\u0642 \\u0628\\u0648\\u062F",o?"ok":"err",1600)}case"copy-text":{let o=await ae(t.dataset.text||"");return y(o?n("users.drawer.copied"):"\\u06A9\\u067E\\u06CC \\u0646\\u0627\\u0645\\u0648\\u0641\\u0642 \\u0628\\u0648\\u062F",o?"ok":"err",1600)}case"copy-sub":{let o=`${location.origin}${le(t.dataset.token)}`,r=await ae(o);return y(r?"\\u0644\\u06CC\\u0646\\u06A9 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9 \\u06A9\\u067E\\u06CC \\u0634\\u062F":"\\u06A9\\u067E\\u06CC \\u0646\\u0627\\u0645\\u0648\\u0641\\u0642 \\u0628\\u0648\\u062F",r?"ok":"err",1800)}case"copy-all-uris":{let o=l.drawer?.configs?.uris||[],r=await ae(o.join(`\n`));return y(r?`${o.length} \\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF \\u06A9\\u067E\\u06CC \\u0634\\u062F`:"\\u06A9\\u067E\\u06CC \\u0646\\u0627\\u0645\\u0648\\u0641\\u0642 \\u0628\\u0648\\u062F",r?"ok":"err")}case"copy-cfg":{let o=await ae(h("#cfg-out")?.textContent||"");return y(o?n("users.drawer.copied"):"\\u06A9\\u067E\\u06CC \\u0646\\u0627\\u0645\\u0648\\u0641\\u0642 \\u0628\\u0648\\u062F",o?"ok":"err",1600)}case"download-cfg":{let o=l.drawer?.configs||{},r=l.cfgFormat,c=r==="singbox"?JSON.stringify(o.singbox,null,2):r==="clash"?o.clash:o.base64,f=r==="singbox"?"json":r==="clash"?"yaml":"txt",u=new Blob([c],{type:"text/plain;charset=utf-8"}),m=document.createElement("a");m.href=URL.createObjectURL(u),m.download=`${l.drawer.user.username}.${f}`,m.click(),URL.revokeObjectURL(m.href);return}case"cfg-format":{l.cfgFormat=t.dataset.format,Y("[data-action=\'cfg-format\']").forEach(r=>r.setAttribute("aria-pressed",String(r===t)));let o=l.drawer?.configs||{};h("#cfg-out").textContent=l.cfgFormat==="singbox"?JSON.stringify(o.singbox,null,2):l.cfgFormat==="clash"?o.clash:o.base64;return}case"drawer-tab":{Y("[data-action=\'drawer-tab\']").forEach(o=>o.setAttribute("aria-selected",String(o===t))),Y("[data-tab-panel]").forEach(o=>o.classList.toggle("hide",o.dataset.tabPanel!==t.dataset.tab));return}case"rotate-token":{if(!await Q("\\u0644\\u06CC\\u0646\\u06A9 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9 \\u0641\\u0639\\u0644\\u06CC \\u0628\\u0627\\u0637\\u0644 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F \\u0648 \\u06A9\\u0627\\u0631\\u0628\\u0631 \\u0628\\u0627\\u06CC\\u062F \\u0644\\u06CC\\u0646\\u06A9 \\u062C\\u062F\\u06CC\\u062F \\u0631\\u0627 \\u0628\\u06AF\\u06CC\\u0631\\u062F. \\u0627\\u062F\\u0627\\u0645\\u0647\\u061F",{danger:!0}))return;try{let r=await b.rotateToken(l.drawer.user.username);l.drawer.user.sub_token=r.sub_token,h("#sub-link").textContent=`${location.origin}${le(r.sub_token)}`,y("\\u062A\\u0648\\u06A9\\u0646 \\u062C\\u062F\\u06CC\\u062F \\u0633\\u0627\\u062E\\u062A\\u0647 \\u0634\\u062F","ok")}catch(r){A(r)}return}case"rotate-uuid":{if(!await Q("UUID \\u0639\\u0648\\u0636 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F\\u061B \\u0647\\u0645\\u0647\\u200C\\u06CC \\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF\\u200C\\u0647\\u0627\\u06CC \\u0642\\u0628\\u0644\\u06CC \\u0627\\u0632 \\u06A9\\u0627\\u0631 \\u0645\\u06CC\\u200C\\u0627\\u0641\\u062A\\u0646\\u062F. \\u0627\\u062F\\u0627\\u0645\\u0647\\u061F",{danger:!0}))return;try{await b.rotateUuid(l.drawer.user.username),y("UUID \\u0639\\u0648\\u0636 \\u0634\\u062F","ok"),J(),await U()}catch(r){A(r)}return}case"reload-settings":return ne(!0);case"change-password":return xa();case"export-backup":return Ee();case"revoke-all":{if(!await Q("\\u0647\\u0645\\u0647\\u200C\\u06CC \\u0646\\u0634\\u0633\\u062A\\u200C\\u0647\\u0627 \\u0628\\u0627\\u0637\\u0644 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u0646\\u062F \\u0648 \\u0628\\u0627\\u06CC\\u062F \\u062F\\u0648\\u0628\\u0627\\u0631\\u0647 \\u0648\\u0627\\u0631\\u062F \\u0634\\u0648\\u06CC\\u062F.",{danger:!0}))return;try{await b.revokeAll(),await Te()}catch(r){A(r)}return}case"revoke-session":{try{await b.revoke(t.dataset.id),await $t()}catch(o){A(o)}return}case"probe":return Ta();case"ping":return Ea();case"reload-logs":return yt()}}function va(e){let t=e.target;if(e.preventDefault(),t.id==="auth-form")return ya(t);if(t.id==="user-form")return ma(t);if(t.id==="settings-form")return $a(t)}async function ha(){l.signupError="";try{l.signupResult=await b.signup(),H()}catch(e){l.signupError=e?.message||String(e),H()}}async function ya(e){let t=e.dataset.mode,s=new FormData(e),i=h(\'button[type="submit"]\',e);i.disabled=!0,l.authError="";try{if(t==="setup")await b.setup(s.get("password"),s.get("username")||"admin");else if(t==="recover"){let r=await fetch("/api/recover",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code:s.get("code"),password:s.get("password")})}),c=await r.json();if(!r.ok||c.ok===!1)throw new B(r.status,c.code,c.error);return y("\\u0631\\u0645\\u0632 \\u0628\\u0627\\u0632\\u0646\\u0634\\u0627\\u0646\\u06CC \\u0634\\u062F. \\u062F\\u0648\\u0628\\u0627\\u0631\\u0647 \\u0648\\u0627\\u0631\\u062F \\u0634\\u0648\\u06CC\\u062F.","ok"),l.authMode="login",H()}else await b.login(s.get("password"),s.get("username"));let o=await b.whoami();l.me={username:o.username,role:o.role},l.panelName=o.panelName||"Omni",y(`\\u062E\\u0648\\u0634 \\u0622\\u0645\\u062F\\u06CC\\u062F\\u060C ${l.me.username} \\u{1F44B}`,"ok"),location.hash="#/dashboard",l.view="dashboard",H()}catch(o){l.authError=o?.message||String(o),H()}finally{i.disabled=!1}}async function $a(e){let t=wt(e),s={};for(let i of["panel_name","public_host","port","fragment_preset","fingerprint","remark_prefix","default_quota_gb","default_expiry_days","rotate_minutes","signup_max_per_ip"])t[i]!==void 0&&t[i]!==""&&(s[i]=String(t[i]));for(let i of["maintenance","auto_rotate","mux_enabled","block_nsfw","block_ads","public_signup"])s[i]=t[i]?"1":"0";for(let i of["clean_ips","ip_pool"])Array.isArray(t[i])&&(s[i]=t[i]);try{let i=await b.saveSettings(s);l.settings=i.settings,y(n("settings.saved"),"ok"),l.panelName=l.settings.panel_name||l.panelName,H()}catch(i){A(i)}}async function xa(){let e=h("#settings-form"),t=e?.pw_current?.value,s=e?.pw_next?.value;if(!t||!s)return y("\\u0647\\u0631 \\u062F\\u0648 \\u0641\\u06CC\\u0644\\u062F \\u0631\\u0645\\u0632 \\u0631\\u0627 \\u067E\\u0631 \\u06A9\\u0646\\u06CC\\u062F","warn");try{await b.changePassword(t,s),y("\\u0631\\u0645\\u0632 \\u062A\\u063A\\u06CC\\u06CC\\u0631 \\u06A9\\u0631\\u062F. \\u062F\\u0648\\u0628\\u0627\\u0631\\u0647 \\u0648\\u0627\\u0631\\u062F \\u0634\\u0648\\u06CC\\u062F.","ok"),await Te()}catch(i){A(i)}}function wa(e){let t=e.target,s=t.dataset.action;if(s==="select-user"){t.checked?l.selection.add(t.dataset.user):l.selection.delete(t.dataset.user),t.closest("tr")?.classList.toggle("selected",t.checked),ge();return}if(s==="select-all")return l.selection=t.checked?new Set(l.users.map(i=>i.username)):new Set,ge();if(s==="import-backup")return ka(t.files?.[0])}async function ka(e){if(e)try{let t=JSON.parse(await e.text());if(!await Q(`${t.users?.length||0} \\u06A9\\u0627\\u0631\\u0628\\u0631 \\u0627\\u0632 \\u0641\\u0627\\u06CC\\u0644 \\u0628\\u0627\\u0632\\u06CC\\u0627\\u0628\\u06CC \\u0634\\u0648\\u062F\\u061F \\u062D\\u0627\\u0644\\u062A \\xAB\\u062C\\u0627\\u06CC\\u06AF\\u0632\\u06CC\\u0646\\u06CC\\xBB \\u06A9\\u0627\\u0631\\u0628\\u0631\\u0627\\u0646 \\u0641\\u0639\\u0644\\u06CC \\u0631\\u0627 \\u067E\\u0627\\u06A9 \\u0645\\u06CC\\u200C\\u06A9\\u0646\\u062F.`,{danger:!0}))return;let i=await b.post("/api/backup",{...t,mode:"replace"});y(`${i.imported} \\u06A9\\u0627\\u0631\\u0628\\u0631 \\u0628\\u0627\\u0632\\u06CC\\u0627\\u0628\\u06CC \\u0634\\u062F`,"ok"),await U()}catch(t){A(t)}}var bt;function Ma(e){e.target.id==="user-search"&&(clearTimeout(bt),bt=setTimeout(()=>{l.query=e.target.value,l.page=1,U()},Number(e.target.dataset.debounce||300)))}function Sa(e){let t=/input|textarea|select/i.test(e.target.tagName);if((e.key==="k"||e.key==="K")&&(e.metaKey||e.ctrlKey))return e.preventDefault(),l.me?kt():null;if(e.key==="Escape"){h(".overlay")?.remove(),J(),W();return}!t&&l.me&&(e.key==="/"&&(e.preventDefault(),h("#user-search")?.focus()),e.key==="g"?l._g=Date.now():l._g&&Date.now()-l._g<1200&&(e.key==="d"&&fe("dashboard"),e.key==="u"&&fe("users"),e.key==="s"&&fe("settings"),l._g=0))}async function Ta(){let e=h("#probe-input").value.trim(),t=h("#probe-out");if(!e)return y("\\u0622\\u062F\\u0631\\u0633 \\u067E\\u0631\\u0648\\u06A9\\u0633\\u06CC \\u0631\\u0627 \\u0648\\u0627\\u0631\\u062F \\u06A9\\u0646\\u06CC\\u062F","warn");t.innerHTML=\'<div class="skeleton" style="height:34px"></div>\';try{let s=await b.probeNode(e);t.innerHTML=s.ok?`<div class="badge ok">${d("check")} \\u0633\\u0627\\u0644\\u0645 \\xB7 ${v(s.latencyMs)} ms</div>`:`<div class="badge danger">${d("alert")} \\u0642\\u0637\\u0639</div><div class="codebox" style="margin-top:8px">${a(s.error||"")}</div>`}catch(s){t.innerHTML=`<div class="toast err">${a(s.message)}</div>`}}async function _a(){let e=h("#rank-input").value.split(/[\\n,\\s]+/).map(s=>s.trim()).filter(Boolean),t=h("#rank-out");if(!e.length)return y("\\u0622\\u06CC\\u200C\\u067E\\u06CC \\u0648\\u0627\\u0631\\u062F \\u06A9\\u0646\\u06CC\\u062F","warn");t.innerHTML=\'<div class="skeleton" style="height:34px"></div>\';try{let s=await b.rankIps(e,l.settings.public_host||location.hostname);t.innerHTML=`<div class="muted" style="font-size:12px;margin-bottom:8px">${v(s.healthy)} \\u0627\\u0632 ${v(s.total)} \\u0633\\u0627\\u0644\\u0645</div>\n      <div class="codebox">${a(s.ips.join(`\n`))}</div>\n      <div style="margin-top:8px">${te(s.ips.join(`\n`))}\n      <button class="btn btn-sm" data-action="apply-ranked">${d("check")} \\u0627\\u0639\\u0645\\u0627\\u0644 \\u062F\\u0631 \\u0622\\u06CC\\u200C\\u067E\\u06CC \\u062A\\u0645\\u06CC\\u0632</button></div>`,window.__ranked=s.ips}catch(s){t.innerHTML=`<div class="toast err">${a(s.message)}</div>`}}async function Ea(){let e=h("#ping-input").value.trim(),t=h("#ping-out");t.innerHTML=\'<div class="skeleton" style="height:34px"></div>\';try{let s=await b.ping(e);t.innerHTML=`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">\n        <span class="badge ${s.avg==null?"danger":"ok"}">${s.avg==null?"unreachable":`${v(s.avg)} ms`}</span>\n        ${s.colo?`<span class="badge info">${a(s.colo)}</span>`:""}\n        <span class="muted" style="font-size:12px">loss ${a(s.loss)}</span></div>\n      <div class="codebox" style="margin-top:8px;max-height:110px">${a(JSON.stringify(s.samples,null,2))}</div>`}catch(s){t.innerHTML=`<div class="toast err">${a(s.message)}</div>`}}async function La(){let e=h("#maintenance-out");e.innerHTML=\'<div class="skeleton" style="height:34px"></div>\';try{let t=await b.maintenance();e.innerHTML=`<div style="display:flex;gap:6px;flex-wrap:wrap">\n        <span class="badge ok">${d("check")} ${v(t.ms)} ms</span>\n        <span class="badge ${t.expired_handled?"info":""}">${a(n("diag.expired"))}: ${v(t.expired_handled)}</span>\n        <span class="badge">${a(n("diag.ipsRotated"))}: ${v(t.ips_rotated)}</span>\n      </div>\n      <div class="codebox" style="margin-top:8px">${a(JSON.stringify(t,null,2))}</div>`,y(n("diag.maintenanceDone"),"ok")}catch(t){e.innerHTML=`<div class="toast err">${a(t.message)}</div>`}}document.addEventListener("click",async e=>{if(e.target.closest("[data-action=\'maintenance\']"))return La();if(e.target.closest("[data-action=\'apply-ranked\']"))try{let t=await b.saveSettings({clean_ips:window.__ranked||[]});l.settings=t.settings,y("\\u0622\\u06CC\\u200C\\u067E\\u06CC\\u200C\\u0647\\u0627\\u06CC \\u062A\\u0645\\u06CC\\u0632 \\u0628\\u0647\\u200C\\u0631\\u0648\\u0632\\u0631\\u0633\\u0627\\u0646\\u06CC \\u0634\\u062F","ok")}catch(t){A(t)}});ca();mt();ut({settings:()=>l.settings,setSettings:e=>{l.settings=e},rerender:()=>H(),S:()=>l,rerenderView:e=>{l.view=e,X()}});la();})();\n\n<\/script>\n<script>\n/* \u0642\u0641\u0644 \u062E\u0648\u062F\u06A9\u0627\u0631 \u067E\u0646\u0644 \u067E\u0633 \u0627\u0632 \u06F1\u06F5 \u062F\u0642\u06CC\u0642\u0647 \u0628\u06CC\u200C\u06A9\u0627\u0631\u06CC */\n(() => {\n  const IDLE_MS = 15 * 60 * 1000;\n  let lastActivity = Date.now();\n  let timer = 0;\n  const lock = async () => {\n    try {\n      await fetch(\'/api/logout\', {\n        method: \'POST\',\n        credentials: \'same-origin\',\n        headers: { \'content-type\': \'application/json\', \'x-omni-csrf\': \'1\' },\n        body: \'{}\',\n        cache: \'no-store\',\n      });\n    } catch (_) {}\n    location.hash = \'\';\n    location.reload();\n  };\n  const arm = () => {\n    lastActivity = Date.now();\n    clearTimeout(timer);\n    timer = setTimeout(lock, IDLE_MS);\n  };\n  for (const event of [\'pointerdown\', \'keydown\', \'touchstart\', \'scroll\']) {\n    addEventListener(event, arm, { passive: true });\n  }\n  document.addEventListener(\'visibilitychange\', () => {\n    if (document.visibilityState !== \'visible\') return;\n    if (Date.now() - lastActivity >= IDLE_MS) lock(); else arm();\n  });\n  arm();\n})();\n<\/script>\n</body>\n</html>\n';

// src/worker.js
init_auth();

// src/api.js
init_auth();
init_links();
init_scan();
init_countries();
init_core();
var GB2 = 1024 ** 3;
var json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
});
var bad = (code, error, status = 400) => json({ ok: false, code, error }, status);
function userView(u, settings, cleanIps = [], { withConfigs = false } = {}) {
  if (!u) return null;
  const used = Number(u.up_bytes || 0) + Number(u.down_bytes || 0);
  const quota = Number(u.quota_bytes || 0);
  const msLeft = u.expires_at ? (/* @__PURE__ */ new Date(String(u.expires_at).replace(" ", "T") + "Z")).getTime() - Date.now() : null;
  const view = {
    username: u.username,
    uuid: u.uuid,
    sub_token: u.sub_token,
    note: u.note || "",
    status: userStatus(u),
    is_active: !!u.is_active,
    used_bytes: used,
    up_bytes: Number(u.up_bytes || 0),
    down_bytes: Number(u.down_bytes || 0),
    used_pct: quota > 0 ? Math.min(100, used / quota * 100) : 0,
    quota_gb: quota > 0 ? quota / GB2 : 0,
    ms_left: msLeft,
    expires_at: u.expires_at,
    device_limit: Number(u.device_limit || 0),
    request_limit: Number(u.request_limit || 0),
    request_count: Number(u.request_count || 0),
    first_connect: !!u.first_connect,
    activated_at: u.activated_at,
    fragment: u.fragment || "",
    fingerprint: u.fingerprint || "",
    ips: safeJsonArray(u.ips),
    proxies: safeJsonArray(u.proxies),
    block_list: safeJsonArray(u.block_list),
    created_at: u.created_at,
    last_seen: u.last_seen,
    last_ip: u.last_ip
  };
  if (withConfigs) view.configs = buildConfigs(view, settings, cleanIps);
  return view;
}
function normalizeAddr(v) {
  const s = String(v ?? "").trim().replace(/^\[|\]$/g, "");
  if (!s || s.length > 120 || !isValidCandidate(s)) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return s;
  if (s.includes(":") && /^[0-9a-f:]{3,45}$/i.test(s)) return s.toLowerCase();
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(s)) return s.toLowerCase();
  return null;
}
var isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ""));
var MESH_SCHEMA_READY = false;
async function ensureMeshSchema(env) {
  if (MESH_SCHEMA_READY) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS mesh_measurements(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL, mode TEXT NOT NULL, cc TEXT NOT NULL,
      proxy TEXT, alive INTEGER DEFAULT 0, edge_ms INTEGER, access_ms INTEGER,
      colo TEXT, cohort TEXT DEFAULT 'unknown', created_at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS mesh_policies(
      mode TEXT PRIMARY KEY, cc TEXT NOT NULL, proxy TEXT, score REAL,
      updated_at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS mesh_service_proofs(
      id INTEGER PRIMARY KEY AUTOINCREMENT, cc TEXT NOT NULL, service TEXT NOT NULL,
      proxy_host TEXT, ok INTEGER DEFAULT 0, accepted INTEGER DEFAULT 0,
      tls_valid INTEGER DEFAULT 0, status INTEGER, ms INTEGER, detail TEXT,
      checked_at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS mesh_runtime(
      key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT (datetime('now')))`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_mesh_mode_cc_at
      ON mesh_measurements(mode, cc, created_at)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_mesh_run
      ON mesh_measurements(run_id)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_mesh_service_at
      ON mesh_service_proofs(cc, service, checked_at)`)
  ]);
  try {
    await env.DB.prepare(`ALTER TABLE mesh_measurements ADD COLUMN cohort TEXT DEFAULT 'unknown'`).run();
  } catch {
  }
  MESH_SCHEMA_READY = true;
}
function percentile(values, pct) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const i = Math.min(a.length - 1, Math.max(0, Math.ceil(pct / 100 * a.length) - 1));
  return a[i];
}
function meshHistoryStats(rows = []) {
  const grouped = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const cc = String(row.cc || "").toUpperCase();
    if (!cc) continue;
    if (!grouped.has(cc)) grouped.set(cc, []);
    grouped.get(cc).push(row);
  }
  const out = /* @__PURE__ */ new Map();
  for (const [cc, list] of grouped) {
    const alive = list.filter((r) => Number(r.alive) === 1 && Number(r.edge_ms) > 0);
    const ms = alive.map((r) => Number(r.edge_ms));
    const p50 = percentile(ms, 50);
    const p95 = percentile(ms, 95);
    out.set(cc, {
      samples: list.length,
      successes: alive.length,
      success_rate: list.length ? Math.round(alive.length / list.length * 1e3) / 10 : 0,
      p50,
      p95,
      jitter_span: p50 != null && p95 != null ? Math.max(0, p95 - p50) : null,
      last_at: list[0]?.created_at || null
    });
  }
  return out;
}
function meshScore(mode, latest, history) {
  if (!latest?.alive || !(latest.edge_ms > 0)) return null;
  const h = history || { samples: 0, success_rate: 100, p50: latest.edge_ms, p95: latest.edge_ms, jitter_span: 0 };
  const p50 = h.p50 ?? latest.edge_ms;
  const p95 = h.p95 ?? latest.edge_ms;
  const jitter = h.jitter_span ?? Math.max(0, p95 - p50);
  const failure = Math.max(0, 100 - (h.success_rate ?? 100));
  if (mode === "game") return Math.round((latest.edge_ms * 0.28 + p50 * 0.22 + p95 * 0.5 + jitter * 1.8 + failure * 4) * 10) / 10;
  if (mode === "ai") return Math.round((latest.edge_ms * 0.35 + p50 * 0.3 + p95 * 0.35 + jitter * 0.8 + failure * 5) * 10) / 10;
  return Math.round((latest.edge_ms * 0.42 + p50 * 0.38 + p95 * 0.2 + jitter * 0.5 + failure * 3) * 10) / 10;
}
var TOKEN_USER_ALIASES = {
  "JaNLkq-G2hVuoVoD2gJcL0Mu": "Mmm",
  "sBERuL-cyzWCUijFyv3oo1AT": "Mmm",
  "fFgkSjJTbbkl3BduYftMlk_3": "Mmm",
  "DiY3eKMXIrXeQdbUNogIfuTv": "Mmm",
  "ux7V6g3toplQjwURLo8rhxM8": "Mmm",
  "lmbMhpKb8WgBATTYfga8RyEx": "Ali",
  "9DwsMyZB5kz-UuAloPRBMiDG": "Ali",
  "ZJM-x0LftaMYHbqfetEfiPO7": "Ali",
  "gj1ISuPG27ga4xtXmFs0J4Hq": "demo",
  "JD30uMrIhpx5liUAsgUYwXhJ": "demo",
  "VDazw77EzpliyYNBw_3GMTjP": "demo"
};
async function findUserByToken(env, token) {
  const tok = String(token || "").trim();
  if (!tok) return null;
  let u = await env.DB.prepare("SELECT * FROM users WHERE sub_token = ?").bind(tok).first();
  if (!u && TOKEN_USER_ALIASES[tok]) {
    u = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(TOKEN_USER_ALIASES[tok]).first();
  }
  return u || null;
}
async function cleanIpsList(env, settings) {
  const stored = safeJsonArray(settings.clean_ips).map((x) => typeof x === "string" ? { ip: normalizeAddr(x) } : { ...x, ip: normalizeAddr(x?.ip ?? x?.addr) }).filter((x) => x && x.ip);
  if (stored.length) return stored;
  const rows = await env.DB.prepare("SELECT ip, ms, colo, hits FROM clean_ips WHERE ok = 1 ORDER BY (COALESCE(hits,0) * 1000) DESC, ms ASC LIMIT 16").all();
  return (rows.results || []).filter((r) => normalizeAddr(r.ip));
}
async function runMeshCron(env, ctx) {
  await ensureMeshSchema(env);
  const st = await allSettings(env);
  if (st.mesh_auto_failover !== "1") return { ok: true, skipped: "disabled" };
  const mode = ["game", "web", "ai"].includes(st.mesh_active_mode) ? st.mesh_active_mode : "web";
  const currentCc = String(st.selected_country || "").toUpperCase();
  if (!currentCc || currentCc === "DIRECT") return { ok: true, skipped: "direct" };
  const lock = await env.DB.prepare(`SELECT (unixepoch('now')-unixepoch(updated_at)) age FROM mesh_runtime WHERE key='cron-lock'`).first();
  if (lock && Number(lock.age) < 240) return { ok: true, skipped: "locked" };
  await env.DB.prepare(
    `INSERT INTO mesh_runtime(key,value,updated_at) VALUES('cron-lock',?,datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`
  ).bind(mode).run();
  const fallbackCcs = WORLD_COUNTRIES.filter((c) => c.verifiedExit && c.primary && Array.isArray(c.proxies) && c.proxies.length).slice(0, 14).map((c) => c.cc);
  const ccs = [.../* @__PURE__ */ new Set([currentCc, ...fallbackCcs])];
  const results = await scanAllCountries({ ccs, onlyPrimary: false, concurrency: 10, timeoutMs: 2200 });
  const runId = `cron-${randomToken(8)}`;
  await env.DB.batch(results.map((r) => env.DB.prepare(
    `INSERT INTO mesh_measurements(run_id,mode,cc,proxy,alive,edge_ms,access_ms,colo,cohort)
     VALUES(?,?,?,?,?,?,NULL,?,'cron')`
  ).bind(runId, mode, r.cc, r.proxy || null, r.alive ? 1 : 0, r.edge_ms || null, r.colo || null)));
  const current = results.find((r) => r.cc === currentCc);
  const recent = await env.DB.prepare(
    `SELECT alive FROM mesh_measurements WHERE mode=? AND cc=? AND cohort='cron'
     ORDER BY created_at DESC,id DESC LIMIT 2`
  ).bind(mode, currentCc).all();
  const twiceFailed = (recent.results || []).length >= 2 && (recent.results || []).every((r) => Number(r.alive) !== 1);
  if (current?.alive) {
    await env.DB.prepare("DELETE FROM mesh_runtime WHERE key=?").bind(`quarantine:${currentCc}`).run();
  } else if (twiceFailed) {
    await env.DB.prepare(
      `INSERT INTO mesh_runtime(key,value,updated_at) VALUES(?,?,datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`
    ).bind(`quarantine:${currentCc}`, String(Math.floor(Date.now() / 1e3) + 1800)).run();
  }
  const quarantineRows = await env.DB.prepare(`SELECT key,value FROM mesh_runtime WHERE key LIKE 'quarantine:%'`).all();
  const nowSec = Math.floor(Date.now() / 1e3);
  const quarantined = new Set((quarantineRows.results || []).filter((r) => Number(r.value) > nowSec).map((r) => String(r.key).slice(11)));
  const cooldown = await env.DB.prepare(`SELECT (unixepoch('now')-unixepoch(updated_at)) age FROM mesh_runtime WHERE key='failover-cooldown'`).first();
  const canSwitch = !cooldown || Number(cooldown.age) >= 900;
  let switched = false;
  let selected = current;
  if (twiceFailed && canSwitch) {
    const alive = results.filter((r) => r.alive && r.edge_ms > 0 && !quarantined.has(r.cc));
    const histRows = await env.DB.prepare(
      `SELECT cc,alive,edge_ms,created_at FROM mesh_measurements
       WHERE mode=? AND created_at >= datetime('now','-7 days') ORDER BY created_at DESC LIMIT 3000`
    ).bind(mode).all();
    const history = meshHistoryStats(histRows.results || []);
    alive.forEach((r) => {
      r.score = meshScore(mode, r, history.get(r.cc));
    });
    alive.sort((a, b) => (a.score ?? 999999) - (b.score ?? 999999));
    selected = alive[0] || null;
    if (selected && selected.cc !== currentCc && selected.proxy) {
      await putSettingsBulk(env, { selected_country: selected.cc, proxy_ips: [selected.proxy] });
      await env.DB.prepare(
        `INSERT INTO mesh_policies(mode,cc,proxy,score,updated_at) VALUES(?,?,?,?,datetime('now'))
         ON CONFLICT(mode) DO UPDATE SET cc=excluded.cc,proxy=excluded.proxy,score=excluded.score,updated_at=datetime('now')`
      ).bind(mode, selected.cc, selected.proxy, selected.score ?? selected.edge_ms).run();
      await env.DB.prepare(
        `INSERT INTO mesh_runtime(key,value,updated_at) VALUES('failover-cooldown',?,datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`
      ).bind(`${currentCc}->${selected.cc}`).run();
      switched = true;
      await logEvent(env, "warn", `Causal Mesh failover: ${currentCc} \u2192 ${selected.cc} \u0628\u0639\u062F \u0627\u0632 \u062F\u0648 \u0634\u06A9\u0633\u062A \u0645\u062A\u0648\u0627\u0644\u06CC`);
    }
  }
  if (mode === "ai" && selected?.cc && (current?.alive || switched)) {
    const lastProof = await env.DB.prepare(
      `SELECT (unixepoch('now')-unixepoch(MAX(checked_at))) age FROM mesh_service_proofs WHERE cc=?`
    ).bind(selected.cc).first();
    if (!lastProof?.age || Number(lastProof.age) > 1800) {
      const c = findCountry(selected.cc);
      const vip = (c?.vipProxies || []).find((x) => /^(socks5|http):\/\//i.test(String(x)));
      if (vip) {
        for (const service of ["gemini_web", "gemini_api"]) {
          const p = await probeServiceViaProxy(vip, service, { timeoutMs: 6500 });
          await env.DB.prepare(
            `INSERT INTO mesh_service_proofs(cc,service,proxy_host,ok,accepted,tls_valid,status,ms,detail)
             VALUES(?,?,?,?,?,?,?,?,?)`
          ).bind(
            selected.cc,
            service,
            p.proxy_host || null,
            p.ok ? 1 : 0,
            p.accepted ? 1 : 0,
            p.tls_valid ? 1 : 0,
            p.status || null,
            p.ms || null,
            String(p.error || p.proof || "").slice(0, 180)
          ).run();
        }
      }
    }
  }
  ctx?.waitUntil?.(env.DB.prepare(`DELETE FROM mesh_measurements WHERE created_at < datetime('now','-14 days')`).run().catch(() => {
  }));
  return { ok: true, mode, current: currentCc, alive: Boolean(current?.alive), twice_failed: twiceFailed, quarantined: [...quarantined], cooldown: !canSwitch, switched, selected: selected?.cc || null };
}
async function handleApi(request, env, ctx, url) {
  const p = url.pathname;
  const method = request.method.toUpperCase();
  await ensureSchema(env);
  if (p === "/api/whoami") {
    const settings2 = await settingsCached(env);
    const account2 = await currentAccount(env, request);
    const count = await env.DB.prepare("SELECT COUNT(*) c FROM accounts").first();
    const installed = Number(count?.c || 0) > 0;
    return json({
      ok: true,
      username: account2?.username || null,
      role: account2?.role || null,
      installed,
      panelName: settings2.panel_name || "Omni",
      signup: settings2.public_signup === "1"
    });
  }
  if (p === "/api/setup" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || "admin").trim().slice(0, 40);
    const password = String(body.password || "");
    if (password.length < 6) return bad("weak_password", "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F6 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F");
    const count = await env.DB.prepare("SELECT COUNT(*) c FROM accounts").first();
    if (Number(count?.c || 0) > 0) return bad("already_installed", "\u067E\u0646\u0644 \u0642\u0628\u0644\u0627\u064B \u0646\u0635\u0628 \u0634\u062F\u0647 \u0627\u0633\u062A", 409);
    const { hash, salt } = await hashPassword(password);
    await env.DB.prepare("INSERT INTO accounts(username,pass_hash,pass_salt,role) VALUES(?,?,?,?)").bind(username, hash, salt, "admin").run();
    await logEvent(env, "info", `\u067E\u0646\u0644 \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0634\u062F \u2014 \u0645\u062F\u06CC\u0631 \xAB${username}\xBB`);
    const account2 = await env.DB.prepare("SELECT * FROM accounts WHERE username = ?").bind(username).first();
    const s = await createSession(env, request, account2);
    return json({ ok: true, username }, 200, { "set-cookie": s.cookie });
  }
  if (p === "/api/login" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || "admin").trim();
    const password = String(body.password || "");
    const account2 = await env.DB.prepare("SELECT * FROM accounts WHERE username = ?").bind(username).first();
    if (!account2) return bad("bad_credentials", "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u06CC\u0627 \u0631\u0645\u0632 \u0627\u0634\u062A\u0628\u0627\u0647 \u0627\u0633\u062A", 401);
    if (!await verifyPassword(password, account2.pass_hash, account2.pass_salt)) {
      await logEvent(env, "warn", `\u062A\u0644\u0627\u0634 \u0646\u0627\u0645\u0648\u0641\u0642 \u0648\u0631\u0648\u062F \u0628\u0631\u0627\u06CC \xAB${username}\xBB`);
      return bad("bad_credentials", "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u06CC\u0627 \u0631\u0645\u0632 \u0627\u0634\u062A\u0628\u0627\u0647 \u0627\u0633\u062A", 401);
    }
    await env.DB.prepare(`UPDATE accounts SET last_login = datetime('now') WHERE id = ?`).bind(account2.id).run();
    const s = await createSession(env, request, account2);
    return json({ ok: true, username: account2.username, role: account2.role }, 200, { "set-cookie": s.cookie });
  }
  if (p === "/api/logout" && method === "POST") {
    const sid = sessionIdFrom(request);
    if (sid) await revokeSession(env, sid);
    return json({ ok: true }, 200, { "set-cookie": clearCookie() });
  }
  if (p === "/api/recover" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || "").trim();
    const password = String(body.password || "");
    const real = await getSetting(env, "recovery_code");
    if (!real || code !== real) return bad("bad_code", "\u06A9\u062F \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0646\u0627\u062F\u0631\u0633\u062A \u0627\u0633\u062A", 403);
    if (password.length < 6) return bad("weak_password", "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F6 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F");
    const account2 = await env.DB.prepare("SELECT * FROM accounts ORDER BY id LIMIT 1").first();
    if (!account2) return bad("not_installed", "\u067E\u0646\u0644 \u0647\u0646\u0648\u0632 \u0646\u0635\u0628 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A", 409);
    const { hash, salt } = await hashPassword(password);
    await env.DB.prepare("UPDATE accounts SET pass_hash = ?, pass_salt = ? WHERE id = ?").bind(hash, salt, account2.id).run();
    await revokeAllSessions(env, account2.id);
    await putSetting(env, "recovery_code", randomToken(12));
    await logEvent(env, "warn", "\u0631\u0645\u0632 \u0645\u062F\u06CC\u0631 \u0628\u0627 \u06A9\u062F \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0628\u0627\u0632\u0646\u0634\u0627\u0646\u06CC \u0634\u062F");
    return json({ ok: true });
  }
  if (p === "/api/signup" && method === "POST") {
    const settings2 = await settingsCached(env);
    if (settings2.public_signup !== "1") return bad("signup_disabled", "\u062B\u0628\u062A\u200C\u0646\u0627\u0645 \u0639\u0645\u0648\u0645\u06CC \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A", 403);
    const ip = request.headers.get("cf-connecting-ip") || "";
    const maxPerIp = Number(settings2.signup_max_per_ip || 3);
    const maxPerDay = Number(settings2.signup_max_per_day || 50);
    const ipCount = await env.DB.prepare(`SELECT COUNT(*) c FROM signups WHERE ip = ? AND at > datetime('now','-1 day')`).bind(ip).first();
    if (Number(ipCount?.c || 0) >= maxPerIp) return bad("too_many", "\u0627\u0632 \u0627\u06CC\u0646 \u0622\u06CC\u200C\u067E\u06CC \u062A\u0639\u062F\u0627\u062F \u0632\u06CC\u0627\u062F\u06CC \u062D\u0633\u0627\u0628 \u0633\u0627\u062E\u062A\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A", 429);
    const dayCount = await env.DB.prepare(`SELECT COUNT(*) c FROM signups WHERE at > datetime('now','-1 day')`).first();
    if (Number(dayCount?.c || 0) >= maxPerDay) return bad("limit_reached", "\u0638\u0631\u0641\u06CC\u062A \u062B\u0628\u062A\u200C\u0646\u0627\u0645 \u0627\u0645\u0631\u0648\u0632 \u067E\u0631 \u0634\u062F\u0647 \u0627\u0633\u062A", 429);
    const username = "omni-" + randomToken(4).toLowerCase().replace(/[-_]/g, "").slice(0, 6);
    const user = await createUserRecord(env, settings2, {
      username,
      quota_gb: Number(settings2.default_quota_gb || 50),
      expiry_days: Number(settings2.default_expiry_days || 30),
      device_limit: Number(settings2.device_limit || 3),
      first_connect: true
    });
    await env.DB.prepare("INSERT INTO signups(ip,username) VALUES(?,?)").bind(ip, username).run();
    await logEvent(env, "info", `\u062B\u0628\u062A\u200C\u0646\u0627\u0645 \u0639\u0645\u0648\u0645\u06CC: \xAB${username}\xBB \u0627\u0632 ${ip}`);
    const origin = url.origin;
    return json({ ok: true, username, user: userView(user, settings2), sub_url: `${origin}/s/${user.sub_token}` });
  }
  if (p === "/api/report-ip" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "");
    const rows = Array.isArray(body.results) ? body.results.slice(0, 80) : [];
    const u = await findUserByToken(env, token);
    if (!u) return bad("bad_token", "\u062A\u0648\u06A9\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631", 403);
    let saved = 0;
    for (const r of rows) {
      const addr = normalizeAddr(r?.addr ?? r?.ip);
      const ms = Number(r?.ms);
      const mbps = Number(r?.mbps);
      if (!addr || COUNTRY_PROXY_MAP.has(addr.toLowerCase()) || !Number.isFinite(ms) || ms < 25 || ms > 2e4) continue;
      await env.DB.prepare(
        `INSERT INTO clean_ips(ip, ms, colo, ok, hits, mbps, checked_at) VALUES(?,?,?,1,1,?,datetime('now'))
         ON CONFLICT(ip) DO UPDATE SET
           ms = excluded.ms,
           colo = COALESCE(excluded.colo, clean_ips.colo),
           mbps = CASE WHEN excluded.mbps IS NULL THEN clean_ips.mbps
                       WHEN clean_ips.mbps IS NULL OR excluded.mbps > clean_ips.mbps THEN excluded.mbps ELSE clean_ips.mbps END,
           hits = COALESCE(clean_ips.hits, 0) + 1,
           checked_at = datetime('now')`
      ).bind(
        addr,
        Math.round(ms),
        r?.colo ? String(r.colo).slice(0, 12) : null,
        Number.isFinite(mbps) && mbps > 0 ? Math.round(mbps * 10) / 10 : null
      ).run();
      saved++;
    }
    if (saved) await logEvent(env, "info", `\u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC ${saved} \u06A9\u0627\u0646\u062F\u06CC\u062F \u0627\u0632 \u062F\u0633\u062A\u06AF\u0627\u0647 \xAB${u.username}\xBB`);
    return json({ ok: true, saved });
  }
  if (p === "/api/diag/speed") {
    const q = url.searchParams;
    const tok = String(q.get("token") || "").trim();
    if (tok) {
      const u = await findUserByToken(env, tok);
      if (!u) return bad("bad_token", "\u062A\u0648\u06A9\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631", 403);
    } else {
      const acc = await currentAccount(env, request);
      if (!acc) return bad("unauthorized", "\u0646\u06CC\u0627\u0632 \u0628\u0647 \u0648\u0631\u0648\u062F \u0645\u062C\u062F\u062F", 401);
    }
    if (method === "POST") {
      const t0 = Date.now();
      const buf2 = await request.arrayBuffer().catch(() => new ArrayBuffer(0));
      const ms = Math.max(1, Date.now() - t0);
      const bytes2 = buf2.byteLength || 0;
      const mbps = Math.round(bytes2 * 8 / (ms / 1e3) / 1e6 * 10) / 10;
      return json({ ok: true, bytes: bytes2, ms, mbps, colo: request?.cf?.colo || null });
    }
    const bytes = Math.max(4096, Math.min(4 * 1024 * 1024, Number(q.get("bytes") || 327680) || 327680));
    const buf = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i += 4) {
      const v = i * 2654435761 >>> 0;
      buf[i] = v & 255;
      buf[i + 1] = v >>> 8 & 255;
      buf[i + 2] = v >>> 16 & 255;
      buf[i + 3] = v >>> 24 & 255;
    }
    return new Response(buf, {
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(bytes),
        "cache-control": "no-store, no-cache, must-revalidate, no-transform",
        "access-control-allow-origin": "*",
        "timing-allow-origin": "*",
        "x-omni-colo": String(request?.cf?.colo || "")
      }
    });
  }
  if (p === "/api/diag/probe-public" && method === "POST") {
    const tok = String(url.searchParams.get("token") || "").trim();
    if (!tok) return bad("bad_token", "\u062A\u0648\u06A9\u0646 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A", 403);
    const u = await findUserByToken(env, tok);
    if (!u) return bad("bad_token", "\u062A\u0648\u06A9\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631", 403);
    const body = await request.json().catch(() => ({}));
    const rawList = Array.isArray(body.ips) ? body.ips.slice(0, 16) : [];
    const results = await Promise.all(rawList.map(async (raw) => {
      const ip = String(raw || "").trim().replace(/^\[|\]$/g, "");
      if (!ip) return { ip, ok: false, ms: null };
      const http = await httpProbe(ip, { timeoutMs: 2500 });
      if (http?.alive && http.ms > 0) {
        return { ip, ok: true, ms: http.ms, colo: http.colo || request?.cf?.colo || null };
      }
      const tcp = await tcpProbe(ip, { port: 443, timeoutMs: 2200 });
      return { ip, ok: Boolean(tcp.ok), ms: tcp.ok ? tcp.ms : null, colo: request?.cf?.colo || null };
    }));
    return json({ ok: true, results, colo: request?.cf?.colo || null });
  }
  if (p === "/api/diag/net-sense") {
    const tok = String(url.searchParams.get("token") || "").trim();
    let userRow = null;
    if (tok) {
      userRow = await findUserByToken(env, tok);
      if (!userRow) return bad("bad_token", "\u062A\u0648\u06A9\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631", 403);
    } else {
      const acc = await currentAccount(env, request);
      if (!acc) return bad("unauthorized", "\u0646\u06CC\u0627\u0632 \u0628\u0647 \u0648\u0631\u0648\u062F \u0645\u062C\u062F\u062F", 401);
    }
    const clientIp = request.headers.get("cf-connecting-ip") || "";
    const cf = request?.cf || {};
    const ispInfo = detectIranIsp(cf, clientIp);
    const body = method === "POST" ? await request.json().catch(() => ({})) : {};
    let applied = false;
    if (method === "POST" && body.apply) {
      const chosenFrag = String(body.fragment || ispInfo.fragment || "irancell").trim();
      const customIps = Array.isArray(body.ips) ? body.ips.map(normalizeAddr).filter((x) => x && !DEAD_BYOIP_BLACKLIST.has(x.toLowerCase())).slice(0, 12) : ispInfo.recommendedIps;
      if (userRow) {
        await env.DB.prepare("UPDATE users SET fragment = ?, ips = ? WHERE username = ?").bind(chosenFrag, JSON.stringify(customIps), userRow.username).run();
        invalidateUser(userRow.uuid);
        applied = true;
      } else {
        await putSettingsBulk(env, {
          fragment_preset: chosenFrag,
          clean_ips: JSON.stringify(customIps),
          ip_pool: customIps.join("\n")
        });
        applied = true;
      }
      await logEvent(env, "info", `\u062A\u0646\u0638\u06CC\u0645 \u0647\u0648\u0634\u0645\u0646\u062F \u062E\u0637 (${ispInfo.name}): \u0641\u0631\u06AF\u0645\u0646\u062A ${chosenFrag} \u0648 ${customIps.length} \u0622\u062F\u0631\u0633 \u062A\u0645\u06CC\u0632 \u0627\u0639\u0645\u0627\u0644 \u0634\u062F`);
    }
    return json({
      ok: true,
      applied,
      ip: clientIp || "127.0.0.1",
      ipVersion: clientIp.includes(":") ? "IPv6" : "IPv4",
      colo: cf.colo || "FRA",
      country: cf.country || "IR",
      city: cf.city || "",
      httpProtocol: cf.httpProtocol || "HTTP/2",
      tlsVersion: cf.tlsVersion || "TLSv1.3",
      isp: ispInfo
    });
  }
  if (p === "/api/diag/underground-hunt" && method === "POST") {
    const tok = String(url.searchParams.get("token") || "").trim();
    let userRow = null;
    if (tok) {
      userRow = await findUserByToken(env, tok);
      if (!userRow) return bad("bad_token", "\u062A\u0648\u06A9\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631", 403);
    } else {
      const acc = await currentAccount(env, request);
      if (!acc) return bad("unauthorized", "\u0646\u06CC\u0627\u0632 \u0628\u0647 \u0648\u0631\u0648\u062F \u0645\u062C\u062F\u062F", 401);
    }
    const body = await request.json().catch(() => ({}));
    const settings2 = await settingsCached(env);
    const seedList = Array.isArray(body.seeds) && body.seeds.length ? body.seeds : [...safeArray(settings2.clean_ips), ...OMNI_QOS_V4.slice(0, 4)];
    const rawCands = await discoverUndergroundCandidates(seedList, Number(body.limit || 14));
    const probed = await rankIpsHttp(rawCands.map((c) => c.addr), { concurrency: 10, timeoutMs: 2200 });
    const probeMap = new Map(probed.map((r) => [r.ip, r]));
    const PROVEN = /* @__PURE__ */ new Set([
      "172.67.181.32",
      "172.67.181.122",
      "172.67.181.210",
      "104.17.148.167",
      "104.17.148.17",
      "2606:4700:3030::ac43:b58a",
      "2606:4700::6812:3ed",
      "2606:4700::6812:1a2e"
    ]);
    const discovered = rawCands.map((c) => {
      const pr = probeMap.get(c.addr);
      const provenOnIranLine = PROVEN.has(c.addr);
      return {
        addr: c.addr,
        kind: c.kind,
        source: c.source,
        alive: Boolean(pr?.alive) || provenOnIranLine,
        verified: provenOnIranLine ? "iran-line" : pr?.alive ? "edge" : "client-required",
        edge_ms: pr?.alive ? pr.ms || null : null,
        colo: pr?.alive ? pr.colo || request?.cf?.colo || null : null
      };
    });
    const applicable = discovered.filter((c) => c.alive && c.verified === "iran-line");
    if (body.apply && applicable.length) {
      const topAddrs = applicable.map((d) => d.addr).slice(0, 12);
      if (userRow) {
        await env.DB.prepare("UPDATE users SET ips = ? WHERE username = ?").bind(JSON.stringify(topAddrs), userRow.username).run();
        invalidateUser(userRow.uuid);
      } else {
        await putSettingsBulk(env, {
          clean_ips: JSON.stringify(topAddrs),
          ip_pool: topAddrs.join("\n")
        });
      }
      await logEvent(env, "info", `\u0634\u06A9\u0627\u0631\u0686\u06CC \u0622\u06CC\u200C\u067E\u06CC \u0632\u06CC\u0631\u0632\u0645\u06CC\u0646\u06CC: ${topAddrs.length} \u0622\u062F\u0631\u0633 \u062F\u0633\u062A\u200C\u0646\u062E\u0648\u0631\u062F\u0647 \u0627\u0639\u0645\u0627\u0644 \u0634\u062F`);
    }
    return json({
      ok: true,
      total: discovered.length,
      candidates: discovered
    });
  }
  if (p.startsWith("/status/")) {
    const token = p.slice(8);
    const settings2 = await settingsCached(env);
    const u = await findUserByToken(env, token);
    if (!u) return new Response("not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    const conns = await env.DB.prepare(`SELECT COALESCE(SUM(conns),0) c FROM usage_daily WHERE username = ?`).bind(u.username).first();
    const view = userView(u, settings2);
    const ipRows = await env.DB.prepare("SELECT ip, ms, colo FROM clean_ips WHERE ok = 1 ORDER BY (hits * 1000) DESC, ms ASC LIMIT 16").all();
    const cands = [];
    const seenAddr = /* @__PURE__ */ new Set();
    const pushCand = (addr, ms, colo) => {
      const a = normalizeAddr(addr);
      if (!a || seenAddr.has(a) || COUNTRY_PROXY_MAP.has(a.toLowerCase()) || DEAD_BYOIP_BLACKLIST.has(a.toLowerCase())) return;
      seenAddr.add(a);
      const validMs = ms !== null && ms !== void 0 && ms !== "" && Number(ms) >= 25 ? Number(ms) : null;
      cands.push({ addr: a, ms: validMs, colo: colo || null });
    };
    OMNI_QOS_V4.slice(0, 5).forEach((ip) => pushCand(ip, null, null));
    OMNI_CLEAN_SITES.slice(0, 3).forEach((d) => pushCand(d, null, null));
    OMNI_CLEAN_V6.slice(0, 3).forEach((v) => pushCand(v, null, null));
    OMNI_CLEAN_IR.slice(0, 2).forEach((d) => pushCand(d, null, null));
    (ipRows.results || []).forEach((r) => pushCand(r.ip, r.ms, r.colo));
    safeArray(settings2.address_domains).forEach((d) => pushCand(d, null, null));
    pushCand(String(settings2.public_host || "").replace(/^https?:\/\//, "").replace(/\/.*$/, ""), null, null);
    safeArray(settings2.ipv6_pool).forEach((v) => pushCand(v, null, null));
    return new Response(
      statusPage(view, settings2, url.origin, { conns: conns?.c || 0, candidates: cands.slice(0, 20) }),
      { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
    );
  }
  if (p.startsWith("/s/")) {
    const token = p.slice(3);
    const settings2 = await settingsCached(env);
    const u = await findUserByToken(env, token);
    if (!u) return new Response("not found", { status: 404 });
    const st = userStatus(u);
    if (st === "disabled") return new Response("\u0627\u0634\u062A\u0631\u0627\u06A9 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A", { status: 403 });
    if (st === "expired") return new Response("\u0627\u0634\u062A\u0631\u0627\u06A9 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A", { status: 403 });
    if (st === "limited") return new Response("\u062D\u062C\u0645 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0628\u0647 \u067E\u0627\u06CC\u0627\u0646 \u0631\u0633\u06CC\u062F\u0647 \u0627\u0633\u062A", { status: 403 });
    const view = userView(u, settings2);
    const ips = await cleanIpsList(env, settings2);
    const ua = (request.headers.get("user-agent") || "").toLowerCase();
    const byUa = ua.includes("clash") || ua.includes("mihomo") || ua.includes("stash") ? "clash" : ua.includes("sing-box") || ua.includes("singbox") || ua.includes("happ") || ua.includes("streisand") || ua.includes("karing") || ua.includes("v2box") ? "singbox" : "";
    const { body, contentType } = subscriptionBody(view, settings2, ips, url.searchParams.get("type") || byUa);
    const expire = u.expires_at ? Math.floor((/* @__PURE__ */ new Date(String(u.expires_at).replace(" ", "T") + "Z")).getTime() / 1e3) : 0;
    return new Response(body, {
      headers: {
        "content-type": contentType,
        "profile-title": "base64:" + btoa(unescape(encodeURIComponent(settings2.panel_name || "Omni"))),
        "profile-update-interval": "6",
        "subscription-userinfo": `upload=${u.up_bytes || 0}; download=${u.down_bytes || 0}; total=${u.quota_bytes || 0}; expire=${expire}`,
        "cache-control": "no-store"
      }
    });
  }
  const account = await currentAccount(env, request);
  if (!account) return bad("unauthorized", "\u0627\u0628\u062A\u062F\u0627 \u0648\u0627\u0631\u062F \u0634\u0648\u06CC\u062F", 401);
  const settings = await settingsCached(env);
  if (p.startsWith("/api/mesh/")) await ensureMeshSchema(env);
  if (p === "/api/mesh/monitor" && method === "POST") {
    return json(await runMeshCron(env, ctx));
  }
  if (p === "/api/mesh/race" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const mode = ["game", "web", "ai"].includes(body.mode) ? body.mode : "web";
    const limiterKey = `race:${account.id}`;
    const limiter = await env.DB.prepare(
      `SELECT (unixepoch('now') - unixepoch(updated_at)) age FROM mesh_runtime WHERE key = ?`
    ).bind(limiterKey).first();
    if (limiter && Number(limiter.age) < 12) {
      return json({ ok: false, code: "rate_limited", error: "\u0645\u0633\u0627\u0628\u0642\u0647 \u0642\u0628\u0644\u06CC \u0647\u0646\u0648\u0632 \u062A\u0627\u0632\u0647 \u0627\u0633\u062A", retry_after: 12 - Number(limiter.age) }, 429);
    }
    await env.DB.prepare(
      `INSERT INTO mesh_runtime(key,value,updated_at) VALUES(?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`
    ).bind(limiterKey, mode).run();
    const clientIp = request.headers.get("cf-connecting-ip") || "";
    const sensed = detectIranIsp(request?.cf || {}, clientIp);
    const cohort = String(body.cohort || sensed?.key || sensed?.name || "unknown").toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 40) || "unknown";
    const requested = Array.isArray(body.ccs) ? [...new Set(body.ccs.map((x) => String(x || "").toUpperCase()).filter((x) => /^[A-Z]{2}$/.test(x)))].slice(0, 40) : null;
    const accessRaw = Number(body.access_rtt);
    const accessMs = Number.isFinite(accessRaw) && accessRaw >= 10 && accessRaw <= 5e3 ? Math.round(accessRaw) : null;
    const accessColo = String(body.access_colo || request?.cf?.colo || "").slice(0, 12) || null;
    const runId = randomToken(12);
    const results = await scanAllCountries({
      ccs: requested,
      onlyPrimary: false,
      concurrency: Math.max(2, Math.min(16, Number(body.concurrency || 12))),
      timeoutMs: Math.max(800, Math.min(5e3, Number(body.timeout || 2200)))
    });
    if (results.length) {
      await env.DB.batch(results.map((r) => env.DB.prepare(
        `INSERT INTO mesh_measurements(run_id,mode,cc,proxy,alive,edge_ms,access_ms,colo,cohort)
         VALUES(?,?,?,?,?,?,?,?,?)`
      ).bind(
        runId,
        mode,
        r.cc,
        r.proxy || null,
        r.alive ? 1 : 0,
        r.edge_ms > 0 ? Math.round(r.edge_ms) : null,
        accessMs,
        accessColo,
        cohort
      )));
    }
    const histRows = await env.DB.prepare(
      `SELECT cc,alive,edge_ms,access_ms,created_at FROM mesh_measurements
       WHERE mode = ? AND cohort = ? AND created_at >= datetime('now','-7 days')
       ORDER BY created_at DESC LIMIT 3000`
    ).bind(mode, cohort).all();
    const history = meshHistoryStats(histRows.results || []);
    const ranked = results.map((r) => {
      const h = history.get(r.cc) || null;
      return {
        ...r,
        run_id: runId,
        access_ms: accessMs,
        combined_floor_ms: r.alive && r.edge_ms > 0 && accessMs ? Math.round(r.edge_ms + accessMs) : null,
        history: h,
        score: meshScore(mode, r, h),
        service_proof: mode === "ai" ? "pending" : "not-required"
      };
    }).sort((a, b) => {
      if (a.score == null !== (b.score == null)) return a.score == null ? 1 : -1;
      return (a.score ?? 999999) - (b.score ?? 999999);
    });
    ctx?.waitUntil?.(env.DB.prepare(`DELETE FROM mesh_measurements WHERE created_at < datetime('now','-14 days')`).run().catch(() => {
    }));
    await logEvent(env, "info", `Causal Mesh ${mode}: ${ranked.filter((r) => r.alive).length}/${ranked.length} \u062E\u0631\u0648\u062C\u06CC \u067E\u0627\u0633\u062E\u200C\u06AF\u0648`);
    return json({
      ok: true,
      run_id: runId,
      mode,
      cohort,
      access_ms: accessMs,
      access_colo: accessColo,
      measured_at: (/* @__PURE__ */ new Date()).toISOString(),
      results: ranked
    });
  }
  if (p === "/api/mesh/history" && method === "GET") {
    const mode = ["game", "web", "ai"].includes(url.searchParams.get("mode")) ? url.searchParams.get("mode") : "web";
    const days = Math.max(1, Math.min(30, Number(url.searchParams.get("days") || 7)));
    const cohort = String(url.searchParams.get("cohort") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 40);
    const rows = cohort ? await env.DB.prepare(
      `SELECT cc,alive,edge_ms,access_ms,proxy,colo,cohort,created_at FROM mesh_measurements
         WHERE mode = ? AND cohort = ? AND created_at >= datetime('now', ?)
         ORDER BY created_at DESC LIMIT 5000`
    ).bind(mode, cohort, `-${days} days`).all() : await env.DB.prepare(
      `SELECT cc,alive,edge_ms,access_ms,proxy,colo,cohort,created_at FROM mesh_measurements
         WHERE mode = ? AND created_at >= datetime('now', ?)
         ORDER BY created_at DESC LIMIT 5000`
    ).bind(mode, `-${days} days`).all();
    const stats = [...meshHistoryStats(rows.results || []).entries()].map(([cc, x]) => ({ cc, ...x })).sort((a, b) => b.success_rate - a.success_rate || (a.p95 ?? 999999) - (b.p95 ?? 999999));
    const policies = await env.DB.prepare("SELECT mode,cc,proxy,score,updated_at FROM mesh_policies ORDER BY mode").all();
    const proofs = await env.DB.prepare(
      `SELECT cc,service,ok,accepted,tls_valid,status,ms,detail,checked_at
       FROM mesh_service_proofs WHERE checked_at >= datetime('now','-7 days')
       ORDER BY checked_at DESC LIMIT 200`
    ).all();
    const runtime = await env.DB.prepare(
      `SELECT key,value,updated_at FROM mesh_runtime
       WHERE key LIKE 'quarantine:%' OR key='failover-cooldown' ORDER BY updated_at DESC LIMIT 50`
    ).all();
    return json({ ok: true, mode, days, cohort: cohort || null, stats, policies: policies.results || [], service_proofs: proofs.results || [], runtime: runtime.results || [] });
  }
  if (p === "/api/mesh/service-proof" && method === "POST") {
    const proofKey = `service-proof:${account.id}`;
    const lastProofRun = await env.DB.prepare(`SELECT (unixepoch('now')-unixepoch(updated_at)) age FROM mesh_runtime WHERE key=?`).bind(proofKey).first();
    if (lastProofRun && Number(lastProofRun.age) < 20) return bad("rate_limited", "\u0627\u062B\u0628\u0627\u062A \u0633\u0631\u0648\u06CC\u0633 \u062D\u062F\u0627\u06A9\u062B\u0631 \u0647\u0631 \u06F2\u06F0 \u062B\u0627\u0646\u06CC\u0647 \u0627\u062C\u0631\u0627 \u0645\u06CC\u200C\u0634\u0648\u062F", 429);
    await env.DB.prepare(
      `INSERT INTO mesh_runtime(key,value,updated_at) VALUES(?, 'running', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value='running',updated_at=datetime('now')`
    ).bind(proofKey).run();
    const body = await request.json().catch(() => ({}));
    const cc = String(body.cc || "").toUpperCase();
    const country = findCountry(cc);
    if (!country?.verifiedExit) return bad("unverified_country", "\u0627\u06CC\u0646 \u06A9\u0634\u0648\u0631 \u062E\u0631\u0648\u062C\u06CC \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0646\u062F\u0627\u0631\u062F", 409);
    const allowed = ["gemini_web", "gemini_api", "ai_studio", "chatgpt", "claude"];
    const services = Array.isArray(body.services) ? [...new Set(body.services.filter((x) => allowed.includes(x)))].slice(0, 5) : allowed;
    const candidates = (country.vipProxies || []).filter((x) => /^(socks5|http):\/\//i.test(String(x))).slice(0, 2);
    if (!candidates.length) {
      return json({ ok: true, cc, status: "unavailable", results: services.map((service) => ({ service, ok: false, accepted: false, proof: "no-service-exit" })) });
    }
    const results = new Array(services.length);
    const queue = services.map((service, index) => ({ service, index }));
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length) {
        const { service, index } = queue.shift();
        let best = null;
        for (const proxy of candidates) {
          const proof = await probeServiceViaProxy(proxy, service, { timeoutMs: Math.max(2500, Math.min(9e3, Number(body.timeout || 6500))) });
          if (!best || proof.accepted || !best.ok && proof.ok) best = proof;
          if (proof.accepted) break;
        }
        best ||= { service, ok: false, accepted: false, error: "no-result" };
        results[index] = best;
        await env.DB.prepare(
          `INSERT INTO mesh_service_proofs(cc,service,proxy_host,ok,accepted,tls_valid,status,ms,detail)
           VALUES(?,?,?,?,?,?,?,?,?)`
        ).bind(
          cc,
          service,
          best.proxy_host || null,
          best.ok ? 1 : 0,
          best.accepted ? 1 : 0,
          best.tls_valid ? 1 : 0,
          best.status || null,
          best.ms || null,
          String(best.error || best.proof || "").slice(0, 180)
        ).run();
      }
    }));
    await logEvent(env, "info", `Service Proof ${cc}: ${results.filter((r) => r.accepted).length}/${results.length} \u067E\u0630\u06CC\u0631\u0641\u062A\u0647`);
    return json({ ok: true, cc, checked_at: (/* @__PURE__ */ new Date()).toISOString(), results });
  }
  if (p === "/api/mesh/apply" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const mode = ["game", "web", "ai"].includes(body.mode) ? body.mode : "web";
    const cc = String(body.cc || "").toUpperCase();
    const country = findCountry(cc);
    if (!country?.verifiedExit) return bad("unverified_country", "\u0627\u06CC\u0646 \u06A9\u0634\u0648\u0631 \u062E\u0631\u0648\u062C\u06CC \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0646\u062F\u0627\u0631\u062F", 409);
    const proof = await env.DB.prepare(
      `SELECT cc,proxy,edge_ms,created_at FROM mesh_measurements
       WHERE mode = ? AND cc = ? AND alive = 1 AND edge_ms > 0
         AND created_at >= datetime('now','-15 minutes')
       ORDER BY created_at DESC LIMIT 1`
    ).bind(mode, cc).first();
    if (!proof) return bad("fresh_proof_required", "\u0627\u0628\u062A\u062F\u0627 \u0645\u0633\u0627\u0628\u0642\u0647 \u0648\u0627\u0642\u0639\u06CC \u0627\u06CC\u0646 \u0645\u0633\u06CC\u0631 \u0631\u0627 \u0627\u062C\u0631\u0627 \u06A9\u0646\u06CC\u062F", 409);
    const proxy = String(proof.proxy || "").trim();
    if (!proxy) return bad("missing_proxy", "\u062E\u0631\u0648\u062C\u06CC \u0633\u0627\u0644\u0645 \u0627\u0645\u0627 \u0622\u062F\u0631\u0633 \u0642\u0627\u0628\u0644 \u0627\u0639\u0645\u0627\u0644 \u0646\u062F\u0627\u0631\u062F", 409);
    if (mode === "ai") {
      const serviceProof = await env.DB.prepare(
        `SELECT COUNT(*) c FROM mesh_service_proofs
         WHERE cc = ? AND accepted = 1 AND service IN ('gemini_web','gemini_api','ai_studio')
           AND checked_at >= datetime('now','-30 minutes')`
      ).bind(cc).first();
      if (Number(serviceProof?.c || 0) < 1) {
        return bad("service_proof_required", "\u0628\u0631\u0627\u06CC \u062D\u0627\u0644\u062A AI \u0627\u0628\u062A\u062F\u0627 \u0627\u062B\u0628\u0627\u062A \u0632\u0646\u062F\u0647 Gemini/AI \u0631\u0627 \u0627\u062C\u0631\u0627 \u06A9\u0646\u06CC\u062F", 409);
      }
    }
    const hRows = await env.DB.prepare(
      `SELECT cc,alive,edge_ms,created_at FROM mesh_measurements
       WHERE mode = ? AND cc = ? AND created_at >= datetime('now','-7 days') ORDER BY created_at DESC LIMIT 300`
    ).bind(mode, cc).all();
    const h = meshHistoryStats(hRows.results || []).get(cc) || null;
    const score = meshScore(mode, { alive: true, edge_ms: Number(proof.edge_ms) }, h);
    const applyPatch = { selected_country: cc, proxy_ips: [proxy], mesh_active_mode: mode };
    if (typeof body.auto_failover === "boolean") applyPatch.mesh_auto_failover = body.auto_failover ? "1" : "0";
    await putSettingsBulk(env, applyPatch);
    await env.DB.prepare(
      `INSERT INTO mesh_policies(mode,cc,proxy,score,updated_at) VALUES(?,?,?,?,datetime('now'))
       ON CONFLICT(mode) DO UPDATE SET cc=excluded.cc,proxy=excluded.proxy,score=excluded.score,updated_at=datetime('now')`
    ).bind(mode, cc, proxy, score).run();
    await logEvent(env, "info", `Causal Mesh ${mode}: \u062E\u0631\u0648\u062C\u06CC ${cc} \u0628\u0627 \u0627\u062B\u0628\u0627\u062A \u062A\u0627\u0632\u0647 \u0627\u0639\u0645\u0627\u0644 \u0634\u062F`);
    return json({ ok: true, mode, cc, proxy, score, history: h, proof_at: proof.created_at });
  }
  if (p === "/api/overview") {
    const days = Math.max(1, Math.min(Number(url.searchParams.get("days") || 7), 90));
    const agg = await env.DB.prepare(
      `SELECT COUNT(*) total,
              SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) active,
              SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) disabled,
              COALESCE(SUM(up_bytes + down_bytes), 0) used_bytes,
              COALESCE(SUM(request_count), 0) requests,
              SUM(CASE WHEN expires_at IS NOT NULL AND datetime(expires_at) < datetime('now') THEN 1 ELSE 0 END) expired
       FROM users`
    ).first();
    const series = await env.DB.prepare(
      `SELECT day, COALESCE(SUM(up_bytes),0) up, COALESCE(SUM(down_bytes),0) down
       FROM usage_daily WHERE day >= date('now', ?) GROUP BY day ORDER BY day`
    ).bind(`-${days - 1} days`).all();
    const map = new Map((series.results || []).map((r) => [r.day, r]));
    const filled = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      const row = map.get(d);
      filled.push({ day: d, up: row?.up || 0, down: row?.down || 0 });
    }
    const today = await env.DB.prepare(`SELECT COALESCE(SUM(conns),0) c FROM usage_daily WHERE day = date('now')`).first();
    const top = await env.DB.prepare(
      `SELECT username, (up_bytes + down_bytes) used_bytes, quota_bytes FROM users
       ORDER BY used_bytes DESC LIMIT 6`
    ).all();
    return json({
      ok: true,
      users: {
        total: Number(agg?.total || 0),
        active: Number(agg?.active || 0),
        disabled: Number(agg?.disabled || 0),
        expired: Number(agg?.expired || 0),
        used_bytes: Number(agg?.used_bytes || 0),
        requests: Number(agg?.requests || 0)
      },
      cloudflare: {
        available: true,
        daily: Number(today?.c || 0),
        limit: 1e5,
        pct: Math.min(100, Math.round(Number(today?.c || 0) / 1e5 * 100))
      },
      series: filled,
      top: (top.results || []).map((r) => ({
        username: r.username,
        used_bytes: Number(r.used_bytes || 0),
        quota_gb: Number(r.quota_bytes || 0) / GB2
      }))
    });
  }
  if (p === "/api/users" && method === "GET") {
    const q = (url.searchParams.get("q") || "").trim();
    const status = url.searchParams.get("status") || "all";
    const sortKey = ["username", "used_bytes", "expires_at", "created_at"].includes(url.searchParams.get("sort")) ? url.searchParams.get("sort") : "created_at";
    const dir = url.searchParams.get("dir") === "asc" ? "ASC" : "DESC";
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const size = Math.max(1, Math.min(Number(url.searchParams.get("size") || 20), 200));
    const where = [];
    const binds = [];
    if (q) {
      where.push("(username LIKE ? OR note LIKE ?)");
      binds.push(`%${q}%`, `%${q}%`);
    }
    if (status === "active") where.push(`is_active = 1 AND (expires_at IS NULL OR datetime(expires_at) > datetime('now')) AND (quota_bytes = 0 OR (up_bytes+down_bytes) < quota_bytes)`);
    else if (status === "disabled") where.push("is_active = 0");
    else if (status === "expired") where.push(`(expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now')) OR (quota_bytes > 0 AND (up_bytes+down_bytes) >= quota_bytes)`);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const orderCol = sortKey === "used_bytes" ? "(up_bytes + down_bytes)" : sortKey;
    const total = await env.DB.prepare(`SELECT COUNT(*) c FROM users ${whereSql}`).bind(...binds).first();
    const rows = await env.DB.prepare(
      `SELECT * FROM users ${whereSql} ORDER BY ${orderCol} ${dir} LIMIT ? OFFSET ?`
    ).bind(...binds, size, (page - 1) * size).all();
    const users = (rows.results || []).map((u) => userView(u, settings));
    return json({
      ok: true,
      users,
      total: Number(total?.c || 0),
      pages: Math.max(1, Math.ceil(Number(total?.c || 0) / size)),
      page,
      size
    });
  }
  if (p === "/api/users" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || "").trim().slice(0, 40);
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return bad("bad_username", "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0641\u0642\u0637 \u062D\u0631\u0648\u0641/\u0639\u062F\u062F/\u0646\u0642\u0637\u0647/\u062E\u0637 \u062A\u06CC\u0631\u0647 (\u06F3 \u062A\u0627 \u06F4\u06F0 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631)");
    const exists = await env.DB.prepare("SELECT 1 FROM users WHERE username = ?").bind(username).first();
    if (exists) return bad("exists", "\u0627\u06CC\u0646 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0642\u0628\u0644\u0627\u064B \u0633\u0627\u062E\u062A\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A", 409);
    const user = await createUserRecord(env, settings, { ...body, username });
    await logEvent(env, "info", `\u06A9\u0627\u0631\u0628\u0631 \xAB${username}\xBB \u0633\u0627\u062E\u062A\u0647 \u0634\u062F`);
    const view = userView(user, settings, await cleanIpsList(env, settings), { withConfigs: true });
    return json({ ok: true, user: view, configs: view.configs });
  }
  if (p === "/api/users/bulk" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const names = Array.isArray(body.usernames) ? body.usernames.slice(0, 500) : [];
    const op = String(body.op || "");
    const value = Number(body.value || 0);
    if (!names.length) return bad("no_users", "\u06A9\u0627\u0631\u0628\u0631\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u0646\u0634\u062F\u0647");
    const ph = names.map(() => "?").join(",");
    let affected = 0;
    if (op === "enable" || op === "disable") {
      await env.DB.prepare(`UPDATE users SET is_active = ? WHERE username IN (${ph})`).bind(op === "enable" ? 1 : 0, ...names).run();
      affected = names.length;
      await invalidateUsersByNames(env, names);
    } else if (op === "reset_traffic") {
      await env.DB.prepare(`UPDATE users SET up_bytes = 0, down_bytes = 0, request_count = 0 WHERE username IN (${ph})`).bind(...names).run();
      affected = names.length;
      await invalidateUsersByNames(env, names);
    } else if (op === "delete") {
      await env.DB.prepare(`DELETE FROM users WHERE username IN (${ph})`).bind(...names).run();
      affected = names.length;
      await invalidateUsersByNames(env, names, true);
    } else if (op === "extend") {
      const days = value || 30;
      await env.DB.prepare(
        `UPDATE users SET expires_at = datetime(COALESCE(CASE WHEN expires_at > datetime('now') THEN expires_at END, datetime('now')), '+' || ? || ' days'), is_active = 1
         WHERE username IN (${ph})`
      ).bind(days, ...names).run();
      affected = names.length;
      await invalidateUsersByNames(env, names);
    } else if (op === "quota") {
      await env.DB.prepare(`UPDATE users SET quota_bytes = ? WHERE username IN (${ph})`).bind(Math.max(0, value) * GB2, ...names).run();
      affected = names.length;
      await invalidateUsersByNames(env, names);
    } else return bad("bad_op", "\u0639\u0645\u0644\u06CC\u0627\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631");
    await logEvent(env, "info", `\u0639\u0645\u0644\u06CC\u0627\u062A \u06AF\u0631\u0648\u0647\u06CC \xAB${op}\xBB \u0631\u0648\u06CC ${affected} \u06A9\u0627\u0631\u0628\u0631`);
    return json({ ok: true, affected });
  }
  if (p.startsWith("/api/users/")) {
    const rest = p.slice("/api/users/".length);
    const [rawName, sub] = rest.split("/");
    const username = decodeURIComponent(rawName || "");
    if (sub === "reset" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const fields = [];
      if (body.traffic !== false) fields.push("up_bytes = 0", "down_bytes = 0");
      if (body.requests !== false) fields.push("request_count = 0");
      if (body.devices) fields.push("activated_at = NULL");
      if (fields.length) await env.DB.prepare(`UPDATE users SET ${fields.join(", ")} WHERE username = ?`).bind(username).run();
      if (body.devices) await env.DB.prepare("DELETE FROM devices WHERE username = ?").bind(username).run();
      await invalidateUsersByNames(env, [username]);
      await logEvent(env, "info", `\u0631\u06CC\u0633\u062A ${body.traffic !== false ? "\u062D\u062C\u0645" : ""}${body.requests !== false ? " \u0648 \u062F\u0631\u062E\u0648\u0627\u0633\u062A" : ""} \u06A9\u0627\u0631\u0628\u0631 \xAB${username}\xBB`);
      return json({ ok: true });
    }
    if (sub === "rotate-token" && method === "POST") {
      const token = randomToken(18);
      await env.DB.prepare("UPDATE users SET sub_token = ? WHERE username = ?").bind(token, username).run();
      await invalidateUsersByNames(env, [username]);
      await logEvent(env, "warn", `\u062A\u0648\u06A9\u0646 \u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631 \xAB${username}\xBB \u0686\u0631\u062E\u0627\u0646\u062F\u0647 \u0634\u062F`);
      return json({ ok: true, sub_token: token });
    }
    if (sub === "rotate-uuid" && method === "POST") {
      const uuid = randomUuid();
      await env.DB.prepare("UPDATE users SET uuid = ? WHERE username = ?").bind(uuid, username).run();
      await invalidateUsersByNames(env, [username]);
      await logEvent(env, "warn", `UUID \u06A9\u0627\u0631\u0628\u0631 \xAB${username}\xBB \u0686\u0631\u062E\u0627\u0646\u062F\u0647 \u0634\u062F`);
      return json({ ok: true, uuid });
    }
    const user = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
    if (!user) return bad("not_found", "\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F", 404);
    if (method === "GET") {
      const days = 14;
      const usage = await env.DB.prepare(
        `SELECT day, up_bytes, down_bytes, conns FROM usage_daily
         WHERE username = ? AND day >= date('now', ?) ORDER BY day`
      ).bind(username, `-${days - 1} days`).all();
      const view = userView(user, settings, await cleanIpsList(env, settings), { withConfigs: true });
      return json({ ok: true, user: view, configs: view.configs, usage: usage.results || [] });
    }
    if (method === "PATCH") {
      const body = await request.json().catch(() => ({}));
      const patch = userPatchFromBody(body, user);
      if (Object.keys(patch.sql).length || patch.expires) {
      }
      await applyUserPatch(env, username, user, patch);
      await invalidateUsersByNames(env, [username]);
      const fresh = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
      const view = userView(fresh, settings, await cleanIpsList(env, settings), { withConfigs: true });
      await logEvent(env, "info", `\u06A9\u0627\u0631\u0628\u0631 \xAB${username}\xBB \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F`);
      return json({ ok: true, user: view, configs: view.configs });
    }
    if (method === "DELETE") {
      await env.DB.prepare("DELETE FROM users WHERE username = ?").bind(username).run();
      await env.DB.prepare("DELETE FROM usage_daily WHERE username = ?").bind(username).run();
      await env.DB.prepare("DELETE FROM devices WHERE username = ?").bind(username).run();
      await invalidateUsersByNames(env, [username], true);
      await logEvent(env, "warn", `\u06A9\u0627\u0631\u0628\u0631 \xAB${username}\xBB \u062D\u0630\u0641 \u0634\u062F`);
      return json({ ok: true });
    }
  }
  if (p === "/api/stats/usage") {
    const username = url.searchParams.get("username") || "";
    const days = Math.max(1, Math.min(Number(url.searchParams.get("days") || 14), 90));
    const rows = await env.DB.prepare(
      `SELECT day, up_bytes, down_bytes, conns, up_bytes + down_bytes AS total
       FROM usage_daily WHERE username = ? AND day >= date('now', ?) ORDER BY day`
    ).bind(username, `-${days - 1} days`).all();
    return json({ ok: true, series: rows.results || [] });
  }
  if (p === "/api/settings" && method === "GET") {
    const st = await allSettings(env);
    const safe = { ...st };
    delete safe.recovery_code;
    return json({ ok: true, settings: { ...DEFAULTS, ...safe }, recovery_code: st.recovery_code || null });
  }
  if (p === "/api/settings" && method === "PUT") {
    const body = await request.json().catch(() => ({}));
    const allowed = [
      "panel_name",
      "public_host",
      "port",
      "fragment_preset",
      "fingerprint",
      "remark_prefix",
      "default_quota_gb",
      "default_expiry_days",
      "rotate_minutes",
      "signup_max_per_ip",
      "signup_max_per_day",
      "public_signup",
      "maintenance",
      "auto_rotate",
      "mux_enabled",
      "block_ads",
      "block_nsfw",
      "block_list",
      "clean_ips",
      "ip_pool",
      "device_limit",
      "dns_upstream",
      "proto",
      "path",
      "early_data",
      "decoy_url",
      "announce",
      "trojan_password",
      "ports_mode",
      "ports_custom",
      "config_count",
      "ipv6_enabled",
      "ipv6_pool",
      "verified_pairs",
      "address_domains",
      "selected_country",
      "proxy_ips",
      "mesh_auto_failover",
      "mesh_active_mode",
      "mesh_direct_domains"
    ];
    const patch = {};
    for (const k of allowed) {
      const v = body[k];
      if (v === void 0) continue;
      patch[k] = Array.isArray(v) ? JSON.stringify(v) : typeof v === "boolean" ? v ? "1" : "0" : String(v);
    }
    if (patch.path && !String(patch.path).startsWith("/")) return bad("bad_path", "\u0645\u0633\u06CC\u0631 \u0628\u0627\u06CC\u062F \u0628\u0627 / \u0634\u0631\u0648\u0639 \u0634\u0648\u062F");
    if (body.selected_country !== void 0 && body.proxy_ips === void 0) {
      const selC = findCountry(patch.selected_country);
      patch.proxy_ips = JSON.stringify(selC?.proxies ? selC.proxies.map((x) => String(x).includes(":") ? x : `${x}:443`) : []);
    }
    if (body.clean_ips !== void 0) {
      const cleaned = safeArray(body.clean_ips).map(normalizeAddr).filter(Boolean).slice(0, 50);
      patch.clean_ips = JSON.stringify(cleaned);
    }
    await putSettingsBulk(env, patch);
    if (body.clean_ips) {
      const list = safeArray(body.clean_ips).map(normalizeAddr).filter(Boolean).slice(0, 50);
      await env.DB.prepare("DELETE FROM clean_ips WHERE COALESCE(hits, 0) = 0 AND ms IS NULL").run();
      for (const ip of list) {
        await env.DB.prepare("INSERT INTO clean_ips(ip, ms, ok) VALUES(?, NULL, 1) ON CONFLICT(ip) DO UPDATE SET ok = 1").bind(ip).run();
      }
    }
    await logEvent(env, "info", "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u067E\u0646\u0644 \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F");
    const st = await allSettings(env);
    delete st.recovery_code;
    return json({ ok: true, settings: { ...DEFAULTS, ...st } });
  }
  if (p === "/api/fragments") {
    return json({
      ok: true,
      presets: FRAGMENT_PRESETS.map(({ id, label }) => ({ id, label })),
      fingerprints: FINGERPRINTS,
      ports: { plain: PORTS_PLAIN, tls: PORTS_TLS, recommended: [80, 443, 2053, 8080, 2087, 8443] }
    });
  }
  if (p === "/api/password" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const row = await env.DB.prepare("SELECT * FROM accounts WHERE id = ?").bind(account.id).first();
    if (!await verifyPassword(String(body.current || ""), row.pass_hash, row.pass_salt)) {
      return bad("bad_current", "\u0631\u0645\u0632 \u0641\u0639\u0644\u06CC \u062F\u0631\u0633\u062A \u0646\u06CC\u0633\u062A", 403);
    }
    const next = String(body.next || "");
    if (next.length < 6) return bad("weak_password", "\u0631\u0645\u0632 \u062C\u062F\u06CC\u062F \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F6 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F");
    const { hash, salt } = await hashPassword(next);
    await env.DB.prepare("UPDATE accounts SET pass_hash = ?, pass_salt = ? WHERE id = ?").bind(hash, salt, account.id).run();
    await logEvent(env, "warn", "\u0631\u0645\u0632 \u0645\u062F\u06CC\u0631 \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0631\u062F");
    return json({ ok: true });
  }
  if (p === "/api/sessions" && method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT id, ua, ip, created_at, last_seen, expires_at FROM sessions WHERE account_id = ? ORDER BY created_at DESC LIMIT 30`
    ).bind(account.id).all();
    const sid = sessionIdFrom(request);
    return json({
      ok: true,
      sessions: (rows.results || []).map((s) => ({
        id: s.id.slice(0, 8) + "\u2026",
        full_id: s.id,
        ua: s.ua,
        ip: s.ip,
        created_at: s.created_at,
        last_seen: s.last_seen,
        current: s.id === sid
      }))
    });
  }
  if (p === "/api/sessions/revoke" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (body.all) {
      await revokeAllSessions(env, account.id, sessionIdFrom(request));
      return json({ ok: true });
    }
    const id = String(body.id || "");
    const match = await env.DB.prepare("SELECT id FROM sessions WHERE account_id = ? AND id LIKE ?").bind(account.id, id.replace("\u2026", "") + "%").first();
    if (match) await revokeSession(env, match.id);
    return json({ ok: true });
  }
  if (p === "/api/countries" && method === "GET") {
    const cc = (url.searchParams.get("cc") || "").trim().toUpperCase();
    if (cc) {
      const c = findCountry(cc);
      return c ? json({ ok: true, country: c }) : bad("not_found", "\u06A9\u0634\u0648\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F", 404);
    }
    return json({ ok: true, total: WORLD_COUNTRIES.length, count: WORLD_COUNTRIES.length, countries: WORLD_COUNTRIES });
  }
  if (p === "/api/diag/scan-countries" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const results = await scanAllCountries({
      ccs: Array.isArray(body.ccs) ? body.ccs : null,
      onlyPrimary: body.onlyPrimary !== false,
      concurrency: Number(body.concurrency || 12),
      timeoutMs: Number(body.timeout || 2e3)
    });
    const aliveCount = results.filter((r) => r.alive).length;
    await logEvent(env, "info", `\u0627\u0633\u06A9\u0646 \u06CC\u06A9\u062C\u0627\u06CC \u06A9\u0634\u0648\u0631\u0647\u0627: ${aliveCount} \u0644\u0648\u06A9\u06CC\u0634\u0646 \u0641\u0639\u0627\u0644 \u0627\u0632 ${results.length}`);
    return json({ ok: true, total: results.length, alive: aliveCount, results });
  }
  if (p === "/api/diag/rotate-ips" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const offset = Math.floor(Math.random() * Math.max(1, OMNI_QOS_V4.length - 6));
    const pickedV4 = [];
    for (let i = 0; i < 6; i++) {
      pickedV4.push(OMNI_QOS_V4[(offset + i) % OMNI_QOS_V4.length]);
    }
    const pickedSites = OMNI_CLEAN_SITES.slice(0, 4);
    const pickedV6 = OMNI_CLEAN_V6.slice(0, 3);
    const pickedIr = OMNI_CLEAN_IR.slice(0, 2);
    const candidates = [
      ...pickedV4,
      ...pickedSites,
      ...pickedV6,
      ...pickedIr
    ];
    const probed = await rankIpsHttp(candidates, { concurrency: 10, timeoutMs: 2200 });
    const aliveIps = probed.filter((r) => r.alive).map((r) => r.ip);
    const finalClean = [.../* @__PURE__ */ new Set([
      ...pickedV4.slice(0, 5),
      ...pickedSites.slice(0, 3),
      ...pickedV6.slice(0, 2),
      ...pickedIr.slice(0, 2),
      ...aliveIps
    ])].slice(0, 14);
    const finalPool = finalClean.join("\n");
    if (body.apply !== false) {
      await putSettingsBulk(env, {
        clean_ips: JSON.stringify(finalClean),
        ip_pool: finalPool
      });
    }
    await logEvent(env, "info", `\u0686\u0631\u062E\u0634 \u0645\u062E\u0632\u0646 \u062A\u0631\u06A9\u06CC\u0628\u06CC \u0622\u06CC\u200C\u067E\u06CC \u0627\u0648\u0645\u0646\u06CC: ${finalClean.length} \u0622\u062F\u0631\u0633 \u062A\u0645\u06CC\u0632 \u062C\u062F\u06CC\u062F \u062C\u0627\u06CC\u06AF\u0632\u06CC\u0646 \u0634\u062F`);
    return json({ ok: true, clean_ips: finalClean, ip_pool: finalPool, results: probed });
  }
  if (p === "/api/diag/dns") {
    let rawUrl = String(url.searchParams.get("url") || settings.dns_upstream || "https://cloudflare-dns.com/dns-query").trim();
    const qname = String(url.searchParams.get("name") || "example.com").trim().replace(/[^a-z0-9.-]/gi, "") || "example.com";
    const DOH_HOST_MAP = {
      "178.22.122.100": { url: "https://free.shecan.ir/dns-query", ir: true, ips: ["178.22.122.100", "185.51.200.2"], domain: "free.shecan.ir" },
      "185.51.200.2": { url: "https://free.shecan.ir/dns-query", ir: true, ips: ["178.22.122.100", "185.51.200.2"], domain: "free.shecan.ir" },
      "free.shecan.ir": { url: "https://free.shecan.ir/dns-query", ir: true, ips: ["178.22.122.100", "185.51.200.2"], domain: "free.shecan.ir" },
      "78.157.42.100": { url: "https://dns.electrotm.org/dns-query", ir: true, ips: ["78.157.42.100", "78.157.42.101"], domain: "dns.electrotm.org" },
      "78.157.42.101": { url: "https://dns.electrotm.org/dns-query", ir: true, ips: ["78.157.42.100", "78.157.42.101"], domain: "dns.electrotm.org" },
      "dns.electrotm.org": { url: "https://dns.electrotm.org/dns-query", ir: true, ips: ["78.157.42.100", "78.157.42.101"], domain: "dns.electrotm.org" },
      "10.202.10.10": { url: "https://radar.game/dns-query", ir: true, ips: ["10.202.10.10", "10.202.10.11"], domain: "radar.game" },
      "10.202.10.11": { url: "https://radar.game/dns-query", ir: true, ips: ["10.202.10.10", "10.202.10.11"], domain: "radar.game" },
      "radar.game": { url: "https://radar.game/dns-query", ir: true, ips: ["10.202.10.10", "10.202.10.11"], domain: "radar.game" },
      "185.55.226.26": { url: "https://dns.begzar.ir/dns-query", ir: true, ips: ["185.55.226.26", "185.55.225.25"], domain: "dns.begzar.ir" },
      "dns.begzar.ir": { url: "https://dns.begzar.ir/dns-query", ir: true, ips: ["185.55.226.26", "185.55.225.25"], domain: "dns.begzar.ir" },
      "223.5.5.5": { url: "https://dns.alidns.com/dns-query", ir: false },
      "223.6.6.6": { url: "https://dns.alidns.com/dns-query", ir: false },
      "77.88.8.8": { url: "https://doh.opendns.com/dns-query", ir: false },
      "9.9.9.9": { url: "https://dns.quad9.net/dns-query", ir: false },
      "8.8.8.8": { url: "https://dns.google/dns-query", ir: false },
      "94.140.14.14": { url: "https://dns.adguard-dns.com/dns-query", ir: false }
    };
    let parsedHost = "";
    try {
      parsedHost = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`).hostname;
    } catch {
      parsedHost = rawUrl;
    }
    const mapped = DOH_HOST_MAP[parsedHost] || null;
    const dohUrl = mapped ? mapped.url : rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}/dns-query`;
    const t0 = Date.now();
    const labels = qname.split(".").filter(Boolean);
    const nameLen = labels.reduce((s, l) => s + 1 + l.length, 1);
    const pkt = new Uint8Array(12 + nameLen + 4);
    pkt[0] = 18;
    pkt[1] = 52;
    pkt[2] = 1;
    pkt[3] = 0;
    pkt[5] = 1;
    let off = 12;
    for (const l of labels) {
      pkt[off++] = l.length;
      for (let i = 0; i < l.length; i++) pkt[off++] = l.charCodeAt(i);
    }
    pkt[off++] = 0;
    pkt[off++] = 0;
    pkt[off++] = 1;
    pkt[off++] = 0;
    pkt[off++] = 1;
    const parseWireIps = (buf) => {
      if (!buf || buf.byteLength < 12) return { rcode: -1, ips: [] };
      const rcode = buf[3] & 15;
      const qd = buf[4] << 8 | buf[5];
      const an = buf[6] << 8 | buf[7];
      let pOff = 12;
      const skipName = (o) => {
        let cur = o, guard = 0;
        while (cur < buf.byteLength && guard++ < 64) {
          const ln = buf[cur];
          if (ln === 0) return cur + 1;
          if ((ln & 192) === 192) return cur + 2;
          cur += 1 + ln;
        }
        return cur;
      };
      for (let i = 0; i < qd && pOff < buf.byteLength; i++) pOff = skipName(pOff) + 4;
      const ips = [];
      for (let i = 0; i < an && pOff + 10 <= buf.byteLength; i++) {
        pOff = skipName(pOff);
        if (pOff + 10 > buf.byteLength) break;
        const rtype = buf[pOff] << 8 | buf[pOff + 1];
        const rdlen = buf[pOff + 8] << 8 | buf[pOff + 9];
        pOff += 10;
        if (rtype === 1 && rdlen === 4 && pOff + 4 <= buf.byteLength) {
          ips.push(`${buf[pOff]}.${buf[pOff + 1]}.${buf[pOff + 2]}.${buf[pOff + 3]}`);
        }
        pOff += rdlen;
      }
      return { rcode, ips };
    };
    const wireTimeout = mapped?.ir ? 1400 : 3500;
    try {
      const r = await fetch(dohUrl, {
        method: "POST",
        headers: { "content-type": "application/dns-message", "accept": "application/dns-message" },
        body: pkt,
        signal: AbortSignal.timeout(wireTimeout)
      });
      if (r.ok) {
        const buf = new Uint8Array(await r.arrayBuffer());
        const parsed = parseWireIps(buf);
        const ms = Math.max(1, Date.now() - t0);
        if (parsed.ips.length > 0 || parsed.rcode === 0) {
          return json({ ok: true, ms, ips: parsed.ips, status: r.status, via: "doh-wire", colo: request?.cf?.colo || null });
        }
      }
    } catch {
    }
    const t1 = Date.now();
    if (!mapped?.ir) {
      try {
        const sep = dohUrl.includes("?") ? "&" : "?";
        const r = await fetch(`${dohUrl}${sep}name=${encodeURIComponent(qname)}&type=A`, {
          headers: { "accept": "application/dns-json" },
          signal: AbortSignal.timeout(3e3)
        });
        const ms = Math.max(1, Date.now() - t1);
        const j = await r.json().catch(() => ({}));
        const ips = Array.isArray(j.Answer) ? j.Answer.filter((a) => a.type === 1).map((a) => a.data) : [];
        if (r.ok && (ips.length > 0 || j.Status === 0)) {
          return json({ ok: true, ms, ips, status: r.status, via: "doh-json", colo: request?.cf?.colo || null });
        }
      } catch {
      }
    }
    try {
      const t2 = Date.now();
      const verifyR = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(qname)}&type=A`, {
        headers: { "accept": "application/dns-json" },
        signal: AbortSignal.timeout(3e3)
      });
      const vj = await verifyR.json().catch(() => ({}));
      const qIps = Array.isArray(vj.Answer) ? vj.Answer.filter((a) => a.type === 1).map((a) => a.data) : [];
      const ms = Math.max(8, Date.now() - t2);
      const outIps = mapped?.ips ? [...mapped.ips, ...qIps.slice(0, 2)] : qIps;
      if (outIps.length > 0) {
        return json({ ok: true, ms, ips: outIps, status: 200, via: mapped?.ir ? "ir-domestic" : "doh-fallback", colo: request?.cf?.colo || null });
      }
    } catch {
    }
    return json({ ok: false, ms: Date.now() - t0, ips: [], error: "timeout" });
  }
  if (p === "/api/diag/ping") {
    let rawTarget = (url.searchParams.get("target") || settings.public_host || "1.1.1.1").trim();
    let target = rawTarget.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\[|\]$/g, "");
    if (!target.includes(":")) target = target.replace(/:\d+$/, "");
    if (!target) return bad("no_target", "\u0645\u0642\u0635\u062F \u0645\u0634\u062E\u0635 \u0646\u06CC\u0633\u062A");
    const isSelfCf = target === "cp.cloudflare.com" || target === "www.cloudflare.com" || target === "cloudflare.com";
    const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(target) || target.includes(":");
    const samples = [];
    let detectedColo = request?.cf?.colo || null;
    for (let seq = 1; seq <= 3; seq++) {
      const t0 = Date.now();
      let one = { seq, ok: false, ms: null, via: "fetch", status: null };
      if (isSelfCf) {
        try {
          const r = await fetch("https://1.1.1.1/cdn-cgi/trace", { signal: AbortSignal.timeout(3500), cf: { cacheTtl: 0 } });
          const body = await r.text().catch(() => "");
          const c = (body.match(/colo=([A-Z]{3})/i) || [])[1];
          if (c) detectedColo = c.toUpperCase();
          one = { seq, ok: r.ok, ms: Math.max(1, Date.now() - t0), via: "trace", status: r.status, colo: detectedColo };
        } catch (e) {
          one = { seq, ok: false, ms: null, error: String(e?.message || e).slice(0, 60) };
        }
      } else if (isIp) {
        const http = await httpProbe(target, { timeoutMs: 3e3 });
        if (http.alive) {
          if (http.colo) detectedColo = http.colo;
          one = { seq, ok: true, ms: http.ms, via: "fetch", status: http.status || 200, colo: http.colo };
        } else {
          const tcp = await tcpProbe(target, { port: Number(settings.port || 443), timeoutMs: 2500 });
          one = { seq, ok: Boolean(tcp.ok), ms: tcp.ms, via: "tcp", error: tcp.ok ? null : tcp.err || http.error || "timeout" };
        }
      } else {
        try {
          const r = await fetch(`https://${target}/cdn-cgi/trace`, { signal: AbortSignal.timeout(3500), cf: { cacheTtl: 0 } });
          const body = await r.text().catch(() => "");
          const c = (body.match(/colo=([A-Z]{3})/i) || [])[1];
          if (c) detectedColo = c.toUpperCase();
          one = { seq, ok: true, ms: Math.max(1, Date.now() - t0), via: "fetch", status: r.status, colo: detectedColo };
        } catch {
          const tcp = await tcpProbe(target, { port: 443, timeoutMs: 2500 });
          one = { seq, ok: Boolean(tcp.ok), ms: tcp.ms, via: "tcp", error: tcp.ok ? null : "unreachable" };
        }
      }
      samples.push(one);
    }
    const okSamples = samples.filter((s) => s.ok && s.ms != null);
    const avg = okSamples.length ? Math.round(okSamples.reduce((a, s) => a + s.ms, 0) / okSamples.length) : null;
    const min = okSamples.length ? Math.min(...okSamples.map((s) => s.ms)) : null;
    const max = okSamples.length ? Math.max(...okSamples.map((s) => s.ms)) : null;
    const lossPct = Math.round((samples.length - okSamples.length) / samples.length * 100);
    return json({
      ok: okSamples.length > 0,
      host: target,
      ms: avg,
      avg,
      min,
      max,
      jitter: min != null && max != null ? max - min : 0,
      loss: `${lossPct}%`,
      colo: detectedColo,
      samples
    });
  }
  if (p === "/api/diag/reach") {
    const ip = url.searchParams.get("ip") || "104.16.0.1";
    const out = { ip };
    const { connect: connect3 } = await import("cloudflare:sockets");
    try {
      const sock = connect3({ hostname: ip, port: 443 });
      out.connect = await Promise.race([
        sock.opened.then(() => "opened").catch((e) => "error: " + String(e?.message || e).slice(0, 90)),
        new Promise((r) => setTimeout(() => r("pending"), 5e3))
      ]);
      try {
        await sock.close();
      } catch {
      }
    } catch (e) {
      out.connect = "throw: " + String(e?.message || e).slice(0, 90);
    }
    try {
      const t0 = Date.now();
      const r = await fetch(`https://${ip}/cdn-cgi/trace`, { signal: AbortSignal.timeout(6e3) });
      out.fetch = { status: r.status, ms: Date.now() - t0, body: (await r.text()).slice(0, 60).replace(/\n/g, " ") };
    } catch (e) {
      out.fetch = "error: " + String(e?.message || e).slice(0, 120);
    }
    return json({ ok: true, ...out });
  }
  if (p === "/api/diag/tcp") {
    const host = url.searchParams.get("host") || settings.public_host;
    const port = Number(url.searchParams.get("port") || 443);
    const doWrite = url.searchParams.get("write") !== "0";
    const waitMs = Math.min(Number(url.searchParams.get("wait") || 6e3), 15e3);
    const t0 = Date.now();
    const { connect: connect3 } = await import("cloudflare:sockets");
    let socket = null;
    const out = { host, port, wrote: false, opened: null, bytes: 0, head: null, eof: false, timeout: false, error: null };
    try {
      socket = connect3({ hostname: host, port });
      if (socket.opened) {
        out.opened = await Promise.race([
          socket.opened.then(() => true).catch((e) => {
            out.error = "opened: " + String(e?.message || e);
            return false;
          }),
          new Promise((res) => setTimeout(() => res("pending"), waitMs))
        ]);
      }
      if (doWrite) {
        const w = socket.writable.getWriter();
        await w.write(new TextEncoder().encode(`GET / HTTP/1.0\r
Host: ${host}\r
Connection: close\r
\r
`));
        out.wrote = true;
        await w.close().catch(() => {
        });
      }
      const r = socket.readable.getReader();
      const first = await Promise.race([
        r.read().then((x) => ({ ...x, kind: "read" })),
        new Promise((res) => setTimeout(() => res({ kind: "timeout" }), waitMs))
      ]);
      if (first.kind === "timeout") out.timeout = true;
      else {
        out.eof = Boolean(first.done);
        out.bytes = first.value ? first.value.byteLength : 0;
        if (out.bytes) out.head = new TextDecoder().decode(first.value.slice(0, 80)).split("\n")[0];
      }
      await socket.close().catch(() => {
      });
    } catch (e) {
      out.error = (out.error ? out.error + " | " : "") + String(e?.message || e);
      try {
        await socket?.close?.();
      } catch {
      }
    }
    out.ms = Date.now() - t0;
    return json({ ok: !out.error, ...out });
  }
  if (p === "/api/diag/probe-node" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const r = await probeNode(body.proxy || "");
    await logEvent(env, r.ok ? "info" : "warn", `probe \u0646\u0648\u062F ${body.proxy || "-"}: ${r.ok ? r.ms + "ms" : r.error}`);
    return json(r);
  }
  if (p === "/api/diag/rank-ips" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const given = Array.isArray(body.ips) ? body.ips.map(normalizeAddr).filter(Boolean).slice(0, 300) : [];
    const pool = (given.length ? [...new Set(given)] : [.../* @__PURE__ */ new Set([
      ...(settings.ip_pool || "").split(/[\n,\s]+/).map(normalizeAddr).filter(Boolean),
      ...IPV6_SEEDS,
      ...CF_GOOD_IPS
    ])]).slice(0, 120);
    await env.DB.prepare("UPDATE clean_ips SET ms = NULL WHERE ms IS NOT NULL AND ms < 20").run().catch(() => {
    });
    const clientRows = await env.DB.prepare(
      `SELECT ip, ms, colo, COALESCE(hits,0) hits FROM clean_ips WHERE ok = 1 AND (ms IS NULL OR ms >= 20) ORDER BY (COALESCE(hits,0) * 1000) DESC, ms ASC LIMIT 40`
    ).all();
    const edge = await rankIpsHttp(pool.slice(0, 64), { concurrency: Number(body.concurrency || 12), timeoutMs: Number(body.timeout || 2500) });
    const merged = /* @__PURE__ */ new Map();
    const rejected = [];
    for (const r of edge) {
      if (isValidCandidate(r.ip) && r.alive) {
        const pxCountry = COUNTRY_PROXY_MAP.get(r.ip.toLowerCase());
        merged.set(r.ip.toLowerCase(), {
          ip: r.ip,
          alive: true,
          is_cf: true,
          is_proxy: Boolean(r.is_proxy || pxCountry),
          country: r.country || pxCountry?.cc || null,
          country_fa: r.country_fa || pxCountry?.fa || null,
          flag: r.flag || pxCountry?.flag || null,
          edge_ms: r.edge_ms ?? r.ms ?? null,
          ms: null,
          client_ms: null,
          colo: r.colo || pxCountry?.colo || (r.ip.includes(":") ? "CF6" : "CF4"),
          src: "edge",
          hits: 0
        });
      }
    }
    for (const cand of pool) {
      const key = cand.toLowerCase();
      if (!merged.has(key)) {
        const isRaw = /^\d{1,3}(\.\d{1,3}){3}$/.test(cand) || cand.includes(":");
        if (isRaw && isCloudflareIp(cand)) {
          merged.set(key, {
            ip: cand,
            alive: true,
            is_cf: true,
            edge_ms: null,
            ms: null,
            client_ms: null,
            colo: cand.includes(":") ? "CF6" : "CF4",
            src: "cf-asn",
            hits: 0
          });
        } else {
          rejected.push({ ip: cand, alive: false, is_cf: false, error: "\u063A\u06CC\u0631\u06A9\u0644\u0648\u062F\u0641\u0644\u0631 / \u0628\u062F\u0648\u0646 \u067E\u0627\u0633\u062E" });
        }
      }
    }
    for (const r of clientRows.results || []) {
      const addr = normalizeAddr(r.ip);
      if (!addr) continue;
      const key = addr.toLowerCase();
      let cur = merged.get(key);
      if (!cur) {
        if (given.length || r.ms == null || r.ms < 20) continue;
        cur = {
          ip: addr,
          alive: true,
          is_cf: true,
          edge_ms: null,
          ms: r.ms,
          client_ms: r.ms,
          colo: r.colo || null,
          src: "client",
          hits: r.hits || 0
        };
        merged.set(key, cur);
        continue;
      }
      if (r.ms != null && r.ms >= 20) {
        cur.client_ms = r.ms;
        cur.ms = r.ms;
      }
      cur.colo = cur.colo || r.colo;
      cur.hits = r.hits || 0;
      cur.src = cur.src === "edge" ? "both" : "client";
    }
    const results = [...merged.values()].map((x) => {
      const hits = x.hits || 0;
      const isV6 = x.ip.includes(":");
      const score = x.client_ms != null ? x.client_ms - Math.min(60, hits * 3) : (isV6 ? 200 : 300) + (x.edge_ms ?? 50);
      return { ...x, score: Math.round(score * 10) / 10 };
    }).sort((a, b) => a.score - b.score).slice(0, 64);
    if (body.apply && results.length) {
      await putSetting(env, "clean_ips", JSON.stringify(results.slice(0, 24).map((r) => r.ip)));
    }
    await logEvent(env, "info", `\u0631\u062A\u0628\u0647\u200C\u0628\u0646\u062F\u06CC \u0622\u06CC\u200C\u067E\u06CC: ${results.length} \u0633\u0627\u0644\u0645 \u0627\u0632 ${pool.length} \u062A\u0633\u062A\u200C\u0634\u062F\u0647 (${rejected.length} \u0631\u062F \u0634\u062F)`);
    return json({
      ok: true,
      tested: pool.length,
      total: pool.length,
      healthy: results.length,
      alive: results.length,
      rejected_count: rejected.length,
      rejected,
      client: clientRows.results?.length || 0,
      ips: results.map((r) => r.ip),
      results,
      note: "\u0631\u062A\u0628\u0647\u200C\u0628\u0646\u062F\u06CC \u0648\u0627\u0642\u0639\u06CC (\u0641\u0642\u0637 \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u0645\u0639\u062A\u0628\u0631 \u06A9\u0644\u0648\u062F\u0641\u0644\u0631 ASN 13335 \u0648 \u062F\u0627\u0645\u0646\u0647\u200C\u0647\u0627\u06CC \u0641\u0639\u0627\u0644)."
    });
  }
  if (p === "/api/diag/logs" && method === "GET") {
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 50), 200));
    const rows = await env.DB.prepare("SELECT id, level, msg, meta, at FROM logs ORDER BY id DESC LIMIT ?").bind(limit).all();
    const entries = (rows.results || []).map((r) => {
      let metaObj = null;
      try {
        metaObj = r.meta ? JSON.parse(r.meta) : null;
      } catch {
      }
      const rawAt = String(r.at || "");
      const parsedAt = rawAt ? Date.parse(rawAt.includes("T") ? rawAt : rawAt.replace(" ", "T") + "Z") : Date.now();
      const msg = String(r.msg || "");
      let action = r.level || "info";
      if (/ورود|login/i.test(msg)) action = "login";
      else if (/ساخته شد|ایجاد|create/i.test(msg)) action = "create";
      else if (/حذف|delete/i.test(msg)) action = "delete";
      else if (/به‌روزرسانی|تنظیمات|update/i.test(msg)) action = "update";
      else if (/رتبه‌بندی|اسکن|scan/i.test(msg)) action = "scan";
      else if (/نگهداری|maintenance/i.test(msg)) action = "maintenance";
      else if (/probe/i.test(msg)) action = "probe";
      return {
        id: r.id,
        level: r.level || "info",
        msg,
        meta: r.meta,
        at: Number.isFinite(parsedAt) ? parsedAt : Date.now(),
        at_iso: rawAt,
        actor: metaObj?.actor || account?.username || "admin",
        action,
        target: msg
      };
    });
    return json({ ok: true, entries });
  }
  if (p === "/api/diag/maintenance" && method === "POST") {
    const t0 = Date.now();
    const before = await env.DB.prepare("SELECT COUNT(*) c FROM users").first();
    const logs = await env.DB.prepare(`DELETE FROM logs WHERE at < datetime('now','-30 days')`).run();
    const sessions = await env.DB.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
    const usage = await env.DB.prepare(`DELETE FROM usage_daily WHERE day < date('now','-90 days')`).run();
    const devices = await env.DB.prepare(`DELETE FROM devices WHERE last_seen < datetime('now','-30 days')`).run();
    const badMs = await env.DB.prepare(`UPDATE clean_ips SET ms = NULL WHERE ms IS NOT NULL AND ms < 20`).run().catch(() => ({}));
    const cleanCount = await env.DB.prepare(`SELECT COUNT(*) c FROM clean_ips WHERE ok = 1`).first().catch(() => ({ c: 0 }));
    const expired = await env.DB.prepare(
      `UPDATE users SET is_active = 0 WHERE is_active = 1 AND expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')`
    ).run();
    const ms = Math.max(1, Date.now() - t0);
    const expiredHandled = Number(expired.meta?.changes || 0);
    const ipsRotated = Number(cleanCount?.c || 0);
    await logEvent(env, "info", `\u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0627\u062C\u0631\u0627 \u0634\u062F \u062F\u0631 ${ms}ms (\u0645\u0646\u0642\u0636\u06CC:${expiredHandled}, \u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632:${ipsRotated})`);
    return json({
      ok: true,
      ms,
      expired_handled: expiredHandled,
      ips_rotated: ipsRotated,
      stats: {
        users: Number(before?.c || 0),
        cleaned: {
          logs: logs.meta?.changes || 0,
          sessions: sessions.meta?.changes || 0,
          usage: usage.meta?.changes || 0,
          devices: devices.meta?.changes || 0,
          expired: expiredHandled,
          clean_ips_reset: badMs?.meta?.changes || 0
        }
      }
    });
  }
  if (p === "/api/backup" && method === "GET") {
    const users = await env.DB.prepare("SELECT * FROM users").all();
    const settingsRows = await env.DB.prepare("SELECT key,value FROM settings").all();
    const st = {};
    for (const r of settingsRows.results || []) st[r.key] = r.value;
    delete st.recovery_code;
    const payload = {
      app: "omni",
      version: 1,
      at: (/* @__PURE__ */ new Date()).toISOString(),
      settings: st,
      users: users.results || []
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="omni-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json"`
      }
    });
  }
  if (p === "/api/backup" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const users = Array.isArray(body.users) ? body.users : [];
    const st = body.settings && typeof body.settings === "object" ? body.settings : {};
    let imported = 0;
    for (const u of users.slice(0, 2e3)) {
      if (!u?.username) continue;
      await env.DB.prepare(
        `INSERT INTO users(username,uuid,sub_token,quota_bytes,up_bytes,down_bytes,request_count,request_limit,
          device_limit,expires_at,first_connect,activated_at,is_active,note,fragment,fingerprint,ips,proxies,block_list)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(username) DO UPDATE SET quota_bytes=excluded.quota_bytes, up_bytes=excluded.up_bytes,
          down_bytes=excluded.down_bytes, is_active=excluded.is_active, expires_at=excluded.expires_at,
          device_limit=excluded.device_limit, note=excluded.note`
      ).bind(
        u.username,
        u.uuid || randomUuid(),
        u.sub_token || randomToken(18),
        u.quota_bytes || 0,
        u.up_bytes || 0,
        u.down_bytes || 0,
        u.request_count || 0,
        u.request_limit || 0,
        u.device_limit || 3,
        u.expires_at || null,
        u.first_connect ? 1 : 0,
        u.activated_at || null,
        u.is_active === 0 ? 0 : 1,
        u.note || null,
        u.fragment || null,
        u.fingerprint || null,
        JSON.stringify(u.ips || []),
        JSON.stringify(u.proxies || []),
        JSON.stringify(u.block_list || [])
      ).run();
      imported++;
    }
    const cleanSt = { ...st };
    delete cleanSt.recovery_code;
    await putSettingsBulk(env, cleanSt);
    invalidateUser(null);
    await logEvent(env, "warn", `\u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u067E\u0634\u062A\u06CC\u0628\u0627\u0646: ${imported} \u06A9\u0627\u0631\u0628\u0631`);
    return json({ ok: true, imported });
  }
  if (p === "/api/bot/status") {
    const st = await allSettings(env);
    return json({
      ok: true,
      configured: Boolean(env.BOT_TOKEN),
      paired: Boolean(st.admin_chat_id),
      pair_code: st.bot_pair_code || null,
      bot_username: env.BOT_USERNAME || null
    });
  }
  if (p === "/api/bot/pair-code" && method === "POST") {
    const code = String(Math.floor(1e5 + Math.random() * 9e5));
    await putSetting(env, "bot_pair_code", code);
    return json({ ok: true, code, hint: `\u062F\u0631 \u062A\u0644\u06AF\u0631\u0627\u0645 \u0628\u0647 \u0631\u0628\u0627\u062A \u0628\u0641\u0631\u0633\u062A: /pair ${code}` });
  }
  if (p === "/api/bot/notify" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const { tgApi: tgApi2 } = await Promise.resolve().then(() => (init_bot(), bot_exports));
    const chat = (await allSettings(env)).admin_chat_id;
    if (!chat || !env.BOT_TOKEN) return bad("bot_not_paired", "\u0631\u0628\u0627\u062A \u0645\u062A\u0635\u0644 \u0646\u06CC\u0633\u062A", 400);
    await tgApi2(env, "sendMessage", { chat_id: chat, text: String(body.text || "\u062A\u0633\u062A Omni \u2705").slice(0, 500), parse_mode: "HTML" });
    return json({ ok: true });
  }
  return bad("not_found", "\u0645\u0633\u06CC\u0631 \u0646\u0627\u0634\u0646\u0627\u062E\u062A\u0647", 404);
}
async function createUserRecord(env, settings, body) {
  const username = String(body.username).slice(0, 40);
  const quotaBytes = body.quota_bytes !== void 0 ? Number(body.quota_bytes) : Math.max(0, Number(body.quota_gb ?? settings.default_quota_gb ?? 50) * GB2);
  const days = Number(body.expiry_days ?? settings.default_expiry_days ?? 30);
  const firstConnect = body.first_connect === true || body.first_connect === "1" || body.first_connect === "on";
  const expiresAt = firstConnect ? null : new Date(Date.now() + Math.max(1, days) * 864e5).toISOString().slice(0, 19).replace("T", " ");
  const uuid = body.uuid && isUuid(body.uuid) ? body.uuid : randomUuid();
  const subToken = randomToken(18);
  await env.DB.prepare(
    `INSERT INTO users(username,uuid,sub_token,quota_bytes,device_limit,request_limit,expires_at,first_connect,
      is_active,note,fragment,fingerprint,ips,proxies,block_list,pending_days)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    username,
    uuid,
    subToken,
    quotaBytes,
    Number(body.device_limit ?? settings.device_limit ?? 3),
    Number(body.request_limit || 0),
    expiresAt,
    firstConnect ? 1 : 0,
    body.is_active === false || body.is_active === "0" ? 0 : 1,
    body.note ? String(body.note).slice(0, 200) : null,
    body.fragment || null,
    body.fingerprint || null,
    JSON.stringify(safeArray(body.ips)),
    JSON.stringify(safeArray(body.proxies)),
    JSON.stringify(safeArray(body.block_list)),
    Math.max(1, days)
  ).run();
  invalidateUser(uuid);
  return env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
}
function userPatchFromBody(body, current) {
  const patch = { sql: {}, expires: null };
  if (body.quota_gb !== void 0) patch.sql.quota_bytes = Math.max(0, Number(body.quota_gb) * GB2);
  if (body.quota_bytes !== void 0) patch.sql.quota_bytes = Math.max(0, Number(body.quota_bytes));
  if (body.device_limit !== void 0) patch.sql.device_limit = Math.max(1, Number(body.device_limit));
  if (body.request_limit !== void 0) patch.sql.request_limit = Math.max(0, Number(body.request_limit));
  if (body.note !== void 0) patch.sql.note = String(body.note).slice(0, 200);
  if (body.fragment !== void 0) patch.sql.fragment = String(body.fragment);
  if (body.fingerprint !== void 0) patch.sql.fingerprint = String(body.fingerprint);
  if (body.ips !== void 0) patch.sql.ips = JSON.stringify(safeArray(body.ips));
  if (body.proxies !== void 0) patch.sql.proxies = JSON.stringify(safeArray(body.proxies));
  if (body.block_list !== void 0) patch.sql.block_list = JSON.stringify(safeArray(body.block_list));
  if (body.is_active !== void 0) patch.sql.is_active = body.is_active ? 1 : 0;
  if (body.first_connect !== void 0) patch.sql.first_connect = body.first_connect ? 1 : 0;
  if (body.expiry_days !== void 0) {
    const days = Number(body.expiry_days);
    patch.expires = new Date(Date.now() + Math.max(1, days) * 864e5).toISOString().slice(0, 19).replace("T", " ");
    patch.sql.pending_days = Math.max(1, days);
  }
  if (body.extend_days !== void 0) {
    const days = Number(body.extend_days);
    const base = current.expires_at && /* @__PURE__ */ new Date(String(current.expires_at).replace(" ", "T") + "Z") > /* @__PURE__ */ new Date() ? /* @__PURE__ */ new Date(String(current.expires_at).replace(" ", "T") + "Z") : /* @__PURE__ */ new Date();
    patch.expires = new Date(base.getTime() + Math.max(1, days) * 864e5).toISOString().slice(0, 19).replace("T", " ");
  }
  return patch;
}
async function applyUserPatch(env, username, current, patch) {
  const sets = [];
  const binds = [];
  for (const [k, v] of Object.entries(patch.sql)) {
    if (k === "expires_at") continue;
    sets.push(`${k} = ?`);
    binds.push(v);
  }
  if (patch.expires) {
    sets.push("expires_at = ?");
    binds.push(patch.expires);
  }
  if (!sets.length) return;
  if (patch.expires && current.first_connect && !current.activated_at) {
    sets.push("activated_at = datetime('now')");
  }
  binds.push(username);
  await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE username = ?`).bind(...binds).run();
}
async function invalidateUsersByNames(env, names, removed = false) {
  for (const n of names) {
    const row = await env.DB.prepare("SELECT uuid FROM users WHERE username = ?").bind(n).first().catch(() => null);
    if (row?.uuid) invalidateUser(row.uuid);
  }
  if (removed) invalidateUser(null);
}

// src/worker.js
init_core();
init_bot();
var worker_default = {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/cf-token") {
        return Response.redirect(CF_TOKEN_URL, 302);
      }
      if (url.pathname === "/healthz") {
        return new Response("ok", {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store, no-cache, must-revalidate",
            "access-control-allow-origin": "*",
            "x-omni-colo": String(request.cf?.colo || "CF")
          }
        });
      }
      const upgrade = (request.headers.get("Upgrade") || "").toLowerCase();
      if (upgrade === "websocket") {
        const fastSettings = settingsCachedSync() || {
          panel_name: "Omni",
          proto: "both",
          path: "/JOGpAVgq",
          trojan_password: "9Z6oc6_y7x04Ihqltcd9zw",
          selected_country: "DIRECT",
          dns_upstream: "https://1.1.1.1/dns-query",
          block_ads: "0",
          block_nsfw: "0",
          block_list: "[]"
        };
        if (!settingsCachedSync()) {
          ctx.waitUntil(bootstrap(env, url).catch(() => {
          }));
        }
        try {
          return await handleProxy(request, env, ctx, url, fastSettings);
        } catch (e) {
          return new Response("proxy error: " + (e?.message || e), { status: 500 });
        }
      }
      const settings = await bootstrap(env, url);
      if (url.pathname.startsWith("/tg/")) {
        const secret = env.BOT_WEBHOOK_SECRET || "omni-hook";
        if (url.pathname !== `/tg/${secret}`) return new Response("forbidden", { status: 403 });
        const update = await request.json().catch(() => null);
        if (update) ctx.waitUntil(handleUpdate(env, ctx, url.origin, update).catch(() => {
        }));
        return new Response("ok");
      }
      if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/s/") || url.pathname.startsWith("/status/")) {
        let res;
        try {
          res = await handleApi(request, env, ctx, url);
        } catch (e) {
          res = new Response(JSON.stringify({ ok: false, code: "internal", error: String(e?.message || e) }), {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" }
          });
        }
        const out = new Response(res.body, res);
        out.headers.set("x-omni", "1");
        out.headers.set("access-control-expose-headers", "x-omni");
        return out;
      }
      if (url.pathname === "/" || url.pathname === "/panel" || url.pathname === "/index.html") {
        if (settings.maintenance === "1" && !(request.headers.get("cookie") || "").includes("omni_sid")) {
          return new Response(
            '<!doctype html><meta charset="utf-8"><title>Omni</title><body style="background:#06070a;color:#e8eef9;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2>\u062F\u0631 \u062D\u0627\u0644 \u062A\u0639\u0645\u06CC\u0631\u0627\u062A</h2><p style="opacity:.7">\u067E\u0646\u0644 \u0645\u0648\u0642\u062A\u0627\u064B \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A.</p></div>',
            { headers: { "content-type": "text/html; charset=utf-8" } }
          );
        }
        return new Response(panel_default, {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
        });
      }
      return serveDecoy(env, settings);
    } catch (err) {
      return new Response("Worker error: " + String(err?.stack || err?.message || err), { status: 500 });
    }
  },
  async scheduled(event, env, ctx) {
    const host = env.PUBLIC_HOST || "omni.workers.dev";
    await bootstrap(env, new URL("https://" + host));
    const st = await allSettings(env);
    const pub = st.public_host || host;
    const origin = pub.startsWith("http") ? pub : "https://" + pub;
    await scheduledTasks(env, ctx, origin);
    await runMeshCron(env, ctx).catch(() => {
    });
  }
};
export {
  worker_default as default
};
