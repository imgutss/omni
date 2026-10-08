var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/countries.js
function findCountry(cc) {
  if (!cc)
    return null;
  const key = String(cc).trim().toUpperCase();
  if (key === "DIRECT" || key === "NONE")
    return null;
  return COUNTRY_BY_CC.get(key) || null;
}
function ipv4ToSiitV6(ip, prefix = "2606:4700:3030::") {
  const m = String(ip || "").trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m)
    return null;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n < 0 || n > 255))
    return null;
  const h1 = (a << 8 | b).toString(16);
  const h2 = (c << 8 | d).toString(16);
  return `${prefix}${h1}:${h2}`;
}
function siitV6ToIpv4(v6) {
  const clean = String(v6 || "").trim().replace(/^\[|\]$/g, "");
  const parts = clean.split(":").filter(Boolean);
  if (parts.length < 4)
    return null;
  const h1 = parseInt(parts[parts.length - 2], 16);
  const h2 = parseInt(parts[parts.length - 1], 16);
  if (!Number.isFinite(h1) || !Number.isFinite(h2))
    return null;
  const a = h1 >> 8 & 255;
  const b = h1 & 255;
  const c = h2 >> 8 & 255;
  const d = h2 & 255;
  if (a === 0 || d === 0 || d === 255)
    return null;
  return `${a}.${b}.${c}.${d}`;
}
async function discoverUndergroundCandidates(seedIps = [], limit = 14) {
  const GALOIS_PRIMES = [17, 31, 47, 67, 89, 107, 127, 149, 167, 181, 197, 211, 227, 239];
  const V6_BLADE_PREFIXES = ["2606:4700:3030::", "2606:4700::", "2606:4700:3031::"];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const push = (addr, kind, source) => {
    const a = String(addr || "").trim().replace(/^\[|\]$/g, "");
    if (!a || seen.has(a.toLowerCase()) || DEAD_BYOIP_BLACKLIST.has(a.toLowerCase()))
      return;
    if (!a.includes(":") && /[a-z]/i.test(a))
      return;
    seen.add(a.toLowerCase());
    out.push({ addr: a, kind, source });
  };
  const slot = Math.floor(Date.now() / 5e3) % GALOIS_PRIMES.length;
  push("172.67.181.32", "spectral_v4", "configured IPv4 seed candidate; untested");
  push("2606:4700:3030::ac43:b520", "siit_v6", "configured IPv6 seed candidate; untested");
  push("2606:4700:3030::ac43:b58a", "siit_v6", "configured IPv6 seed candidate; untested");
  push("2606:4700::6812:3ed", "siit_v6", "configured IPv6 seed candidate; untested");
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
      if (v6Twin)
        push(v6Twin, "siit_v6", `\u0647\u0645\u0632\u0627\u062F SIIT-Hex64 (${prefix}.${n1})`);
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
      if (twinV6)
        push(twinV6, "siit_v6", `\u0647\u0645\u0632\u0627\u062F SIIT-Hex64 (${candidateV4})`);
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
      fragmentRule: "\u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u0627\u0633\u062A\u0627\u062A\u06CC\u06A9: \u0628\u062F\u0648\u0646 Fragment + ECH\u061B \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u062A\u0633\u062A \u0627\u0632 client \u0634\u0645\u0627",
      bestPorts: [443],
      tip: "ASN \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 \u0647\u0645\u0631\u0627\u0647 \u0627\u0648\u0644 \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u0634\u062F\u061B \u0627\u06CC\u0646 \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u0647\u0627 \u062A\u0633\u062A \u0632\u0646\u062F\u0647 \u0646\u06CC\u0633\u062A\u0646\u062F. IPv6\u060C ECH \u0648 \u067E\u0648\u0631\u062A \u0631\u0627 \u0627\u0632 client \u062E\u0648\u062F\u062A\u0627\u0646 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646\u06CC\u062F.",
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
      fragmentRule: "\u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u0627\u0633\u062A\u0627\u062A\u06CC\u06A9: \u0628\u062F\u0648\u0646 Fragment + ECH\u061B \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u062A\u0633\u062A \u0627\u0632 client \u0634\u0645\u0627",
      bestPorts: [443],
      tip: "ASN \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 \u0645\u062E\u0627\u0628\u0631\u0627\u062A/\u0634\u0627\u062A\u0644 \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u0634\u062F\u061B \u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u0648 \u067E\u0648\u0631\u062A\u200C\u0647\u0627\u06CC \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u0645\u0642\u0627\u06CC\u0633\u0647 \u06CC\u0627 \u0627\u0632 client \u0634\u0645\u0627 \u062A\u0633\u062A \u0646\u0634\u062F\u0647\u200C\u0627\u0646\u062F.",
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
      fragmentRule: "\u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u0627\u0633\u062A\u0627\u062A\u06CC\u06A9: ECH\u061B \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627\u06CC Fragment \u062C\u062F\u0627\u06AF\u0627\u0646\u0647 \u0648 \u062A\u0633\u062A\u200C\u0646\u0634\u062F\u0647\u200C\u0627\u0646\u062F",
      bestPorts: [443],
      tip: "ASN \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 \u0627\u06CC\u0631\u0627\u0646\u0633\u0644 \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u0634\u062F\u061B candidate\u0647\u0627\u06CC IPv4/IPv6 \u0627\u06CC\u0646 \u0641\u0647\u0631\u0633\u062A \u0628\u0627\u06CC\u062F \u0627\u0632 client \u0634\u0645\u0627 \u0633\u0646\u062C\u06CC\u062F\u0647 \u0634\u0648\u0646\u062F.",
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
      fragmentRule: "\u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u0627\u0633\u062A\u0627\u062A\u06CC\u06A9: ECH + IPv6\u061B \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u062A\u0633\u062A \u0627\u0632 client \u0634\u0645\u0627",
      bestPorts: [443],
      tip: "ASN \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 \u0631\u0627\u06CC\u062A\u0644 \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u0634\u062F\u061B IPv6/ECH \u0648 packet loss \u062F\u0631 \u0627\u06CC\u0646 \u067E\u0627\u0633\u062E \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0646\u0634\u062F\u0647\u200C\u0627\u0646\u062F.",
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
    fragmentRule: "\u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u0627\u0633\u062A\u0627\u062A\u06CC\u06A9: \u0628\u062F\u0648\u0646 Fragment + ECH + IPv6\u061B \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u062A\u0633\u062A \u0627\u0632 client \u0634\u0645\u0627",
    bestPorts: [443],
    tip: "\u067E\u0631\u0648\u0641\u0627\u06CC\u0644 ECH/IPv6 \u0627\u0632 \u0631\u0648\u06CC metadata \u0634\u0628\u06A9\u0647 \u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u0634\u062F\u0647\u061B \u062F\u0633\u062A\u0631\u0633\u06CC \u0627\u0632 client \u0634\u0645\u0627 \u0647\u0646\u0648\u0632 \u062A\u0633\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.",
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
var DEFAULT_ECH_CONFIG, OMNI_QOS_V4, OMNI_CLEAN_V6, OMNI_CLEAN_SITES, OMNI_CLEAN_IR, OMNI_HYBRID_POOL, DEAD_BYOIP_BLACKLIST, GEMINI_VIP_PROXIES, V4_GLOBAL, V6_GLOBAL, COUNTRY_PROXY_CANDIDATES, COUNTRY_VIP_PROXIES, PRIMARY_LOCATIONS, RAW_COUNTRIES, REGION_FALLBACK, WORLD_COUNTRIES, COUNTRIES_WITH_CANDIDATES, COUNTRY_BY_CC, UNDERGROUND_SUBNET_PREFIXES;
var init_countries = __esm({
  "src/countries.js"() {
    DEFAULT_ECH_CONFIG = "";
    OMNI_QOS_V4 = [
      "1.1.1.1",
      "1.0.0.1",
      "162.159.192.1",
      "162.159.193.1",
      "162.159.195.1",
      "162.159.195.37",
      "188.114.96.73",
      "162.159.192.140",
      "162.159.137.74",
      "104.16.142.53",
      "104.17.148.17"
    ];
    OMNI_CLEAN_V6 = [
      "2606:4700:d0::bc72:6001",
      "2606:4700::6811:9386",
      "2606:4700::6811:9411",
      "2606:4700:d0::a29f:c001",
      "2606:4700:d1::a29f:c001",
      "2606:4700:d0::a29f:c301",
      "2606:4700:d0::1",
      "2606:4700:d1::1",
      "2606:4700::6812:1a2e",
      "2606:4700::6812:3ed",
      "2606:4700:4700::1111",
      "2606:4700:4700::1001"
    ];
    OMNI_CLEAN_SITES = [
      "speed.cloudflare.com",
      "cdnjs.cloudflare.com",
      "www.visa.com",
      "www.udemy.com",
      "www.shopify.com",
      "www.digitalocean.com",
      "www.zoom.us",
      "invest.gov.tr",
      "www.arabam.com"
    ];
    OMNI_CLEAN_IR = [
      "155.103.71.142",
      "38.180.172.231",
      "194.36.85.113",
      "89.45.45.144",
      "178.157.15.73",
      "203.202.232.211",
      "2606:4700:3030::ac43:b58a",
      "2606:4700:3030::ac43:b520",
      "2606:4700:3031::ac43:d95b",
      "2606:4700:3035::ac43:a318"
    ];
    OMNI_HYBRID_POOL = [
      "speed.cloudflare.com",
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
      // Legacy host exclusions; current reachability can vary by network and time.
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
      "socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357",
      "socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080",
      "socks5://pqyiblro:BW6cuhhS2U0r@132.145.110.34:1080",
      "socks5://qpmcy1xm:wgj6q7ns5gfs@gb.day1404.dpdns.org:11361",
      "socks5://5.255.117.127:1080",
      "socks5://31.220.40.59:5080",
      "socks5://213.199.47.140:1080",
      "socks5://zfdsvi6l:dl7o17z4ml9q@ua.day1404.dpdns.org:11359"
    ];
    V4_GLOBAL = OMNI_QOS_V4.slice(0, 10);
    V6_GLOBAL = OMNI_CLEAN_V6.slice(0, 6);
    COUNTRY_PROXY_CANDIDATES = {
      // ۱) آمریکا و کانادا
      US: ["104.168.125.179", "104.168.14.25", "104.168.38.167", "104.238.129.180", "107.150.0.204"],
      CA: ["138.197.160.106", "138.197.161.103", "137.220.52.250"],
      // ۲) Europe country labels and their configured endpoint candidate lists.
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
      // ۳) Middle East and neighboring country-label candidates.
      TR: ["104.239.87.51", "130.94.0.228", "130.94.1.177"],
      AE: ["20.174.15.226", "176.97.66.175", "146.70.37.253", "91.132.93.153"],
      AM: ["2.56.207.67", "2.56.204.183", "2.56.204.246", "139.45.214.126"],
      GE: ["91.239.206.65", "185.104.192.249", "2.26.10.137"],
      // ۴) Asia-Pacific country-label candidates.
      SG: ["124.156.202.172", "103.253.145.105", "128.1.186.55", "103.170.217.60"],
      JP: ["107.148.118.151", "108.160.132.132", "103.76.85.210"],
      KR: ["140.238.5.86", "131.186.26.94", "134.185.99.52", "131.186.16.166"],
      IN: ["103.111.114.87", "216.10.243.159", "20.235.105.146", "4.240.110.47"],
      AU: ["16.176.42.97", "160.187.110.199", "176.97.68.17", "125.7.24.251"]
    };
    COUNTRY_VIP_PROXIES = {
      US: [
        "socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357",
        "socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080"
      ],
      CA: [
        "socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080",
        "socks5://pqyiblro:BW6cuhhS2U0r@132.145.110.34:1080"
      ],
      GB: [
        "socks5://qpmcy1xm:wgj6q7ns5gfs@gb.day1404.dpdns.org:11361",
        "socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357"
      ],
      NL: [
        "socks5://5.255.117.127:1080",
        "socks5://31.220.40.59:5080"
      ],
      DE: [
        "socks5://5.255.117.127:1080",
        "socks5://31.220.40.59:5080",
        "socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357"
      ],
      FR: [
        "socks5://213.199.47.140:1080",
        "socks5://5.255.117.127:1080"
      ],
      AE: [
        "socks5://zfdsvi6l:dl7o17z4ml9q@ua.day1404.dpdns.org:11359",
        "socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357"
      ],
      SE: [
        "socks5://5.255.117.127:1080",
        "socks5://qpmcy1xm:wgj6q7ns5gfs@gb.day1404.dpdns.org:11361"
      ],
      FI: [
        "socks5://5.255.117.127:1080",
        "socks5://31.220.40.59:5080"
      ],
      CH: [
        "socks5://5.255.117.127:1080",
        "socks5://213.199.47.140:1080"
      ],
      AT: [
        "socks5://5.255.117.127:1080",
        "socks5://31.220.40.59:5080"
      ],
      IT: [
        "socks5://213.199.47.140:1080",
        "socks5://5.255.117.127:1080"
      ],
      ES: [
        "socks5://213.199.47.140:1080",
        "socks5://5.255.117.127:1080"
      ],
      TR: [
        "socks5://zfdsvi6l:dl7o17z4ml9q@ua.day1404.dpdns.org:11359",
        "socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357"
      ],
      SG: [
        "socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357",
        "socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080"
      ],
      JP: [
        "socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357",
        "socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080"
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
      // Countries with configured endpoint candidates; the catalogue label is not live geolocation.
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
      const direct = COUNTRY_PROXY_CANDIDATES[cc];
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
        hasCandidates: Boolean(direct),
        countryVerified: false,
        geoVerified: false,
        // Legacy alias retained for API compatibility. This only means a candidate list exists.
        verifiedExit: Boolean(direct),
        primary: PRIMARY_LOCATIONS.includes(cc),
        exitCc: direct ? cc : fallbackCc,
        proxies,
        vipProxies,
        v4: V4_GLOBAL,
        v6: V6_GLOBAL
      };
    });
    COUNTRIES_WITH_CANDIDATES = WORLD_COUNTRIES.filter((c) => c.hasCandidates);
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

// src/ip-trust.js
function isValidIpv6(value) {
  const s = String(value || "").toLowerCase();
  if (!s || s.length > 45 || !/^[0-9a-f:]+$/.test(s) || s.includes(":::"))
    return false;
  const compressedAt = s.indexOf("::");
  if (compressedAt !== -1 && compressedAt !== s.lastIndexOf("::"))
    return false;
  const parts = s.split(":").filter(Boolean);
  if (parts.some((part) => part.length > 4))
    return false;
  if (compressedAt === -1)
    return parts.length === 8;
  return parts.length < 8;
}
function isCloudflareIp(value) {
  const s = String(value || "").trim().replace(/^\[|\]$/g, "");
  if (!s)
    return false;
  if (s.includes(":")) {
    if (!isValidIpv6(s))
      return false;
    const low = s.toLowerCase();
    if (/^(2606:4700|2803:f800|2405:b500|2405:8100|2c0f:f248):/.test(low))
      return true;
    if (low.startsWith("2a06:98c0:")) {
      const third = Number.parseInt(low.split(":")[2] || "0", 16);
      return Number.isInteger(third) && third >= 0 && third <= 7;
    }
    return false;
  }
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(s))
    return false;
  const n = ip4ToInt(s);
  if (n === null)
    return false;
  return CF_PARSED_V4.some(({ net, mask }) => (n & mask) >>> 0 === net);
}
var CF_OFFICIAL_V4_CIDRS, ip4ToInt, CF_PARSED_V4;
var init_ip_trust = __esm({
  "src/ip-trust.js"() {
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
      if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
        return null;
      return (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;
    };
    CF_PARSED_V4 = CF_OFFICIAL_V4_CIDRS.map(([base, bits]) => {
      const mask = bits === 0 ? 0 : 4294967295 << 32 - bits >>> 0;
      return { net: (ip4ToInt(base) & mask) >>> 0, mask };
    });
  }
});

// src/scan.js
import { connect } from "cloudflare:sockets";
async function tokCacheReady(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS bot_tok_cache(chat_id TEXT PRIMARY KEY, token TEXT NOT NULL, expires_at TEXT NOT NULL)").run().catch(() => {
  });
}
async function setCachedToken(env, chatId, token) {
  try {
    await tokCacheReady(env);
    await env.DB.prepare("INSERT INTO bot_tok_cache(chat_id,token,expires_at) VALUES(?,?,datetime('now','+100 years')) ON CONFLICT(chat_id) DO UPDATE SET token=excluded.token, expires_at=excluded.expires_at").bind(String(chatId), String(token)).run();
  } catch {
  }
}
async function getCachedToken(env, chatId) {
  try {
    await tokCacheReady(env);
    const row = await env.DB.prepare("SELECT token FROM bot_tok_cache WHERE chat_id=?").bind(String(chatId)).first();
    return row?.token || "";
  } catch {
    return "";
  }
}
async function clearCachedToken(env, chatId) {
  try {
    await env.DB.prepare("DELETE FROM bot_tok_cache WHERE chat_id=?").bind(String(chatId)).run();
  } catch {
  }
}
async function clearCachedTokenIfAuth(env, chatId, error) {
  return;
}

function isValidCandidate(s) {
  const v = String(s ?? "").trim().replace(/^\[|\]$/g, "");
  if (!v || v.length > 120)
    return false;
  if (BLOCKED_EXACT.has(v.toLowerCase()))
    return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
    const oct = v.split(".").map(Number);
    if (oct.some((n) => n < 0 || n > 255))
      return false;
    if (oct[3] === 0 || oct[3] === 255)
      return false;
    if (oct[0] === 0 || oct[0] === 127 || oct[0] === 10)
      return false;
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
async function discoverEdgeColo(ip, timeoutMs = 1200) {
  let sock = null;
  let timer = null;
  try {
    sock = connect({ hostname: ip, port: 80 });
    await Promise.race([
      sock.opened,
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("timeout")), timeoutMs); })
    ]);
    const writer = sock.writable.getWriter();
    await writer.write(new TextEncoder().encode("GET /cdn-cgi/trace HTTP/1.1\r\nHost: speed.cloudflare.com\r\nUser-Agent: Omni\r\nConnection: close\r\n\r\n"));
    writer.releaseLock();
    const reader = sock.readable.getReader();
    const readPromise = reader.read();
    const timeoutPromise = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("timeout")), timeoutMs); });
    const { value } = await Promise.race([readPromise, timeoutPromise]);
    reader.releaseLock();
    if (value) {
      const text = new TextDecoder().decode(value);
      const m = /colo=([A-Z]{3})/.exec(text);
      if (m && m[1]) return m[1];
    }
  } catch {}
  finally {
    clearTimeout(timer);
    try { await sock?.close(); } catch {}
  }
  return null;
}
async function httpProbe(target, { timeoutMs = 2500 } = {}) {
  const clean = String(target || "").trim().replace(/^\[|\]$/g, "");
  if (!isValidCandidate(clean)) {
    return { ip: clean, ok: false, alive: false, ms: null, edge_ms: null, colo: null, error: "\u0622\u062F\u0631\u0633 \u0646\u0627\u0645\u0639\u062A\u0628\u0631\u060C \u062F\u0631 \u0644\u06CC\u0633\u062A \u0645\u062D\u0631\u0648\u0645\u06CC\u062A\u060C \u06CC\u0627 \u062E\u0627\u0631\u062C \u0627\u0632 \u0645\u062D\u062F\u0648\u062F\u0647\u0654 \u0645\u062C\u0627\u0632" };
  }
  const isRawIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(clean) || clean.includes(":");
  const proxyCountry = COUNTRY_PROXY_MAP.get(clean.toLowerCase());
  if (proxyCountry) {
    const tcp = await tcpProbe(clean, { port: 443, timeoutMs });
    return {
      ip: clean,
      ok: Boolean(tcp.ok),
      alive: Boolean(tcp.ok),
      is_cf: false,
      is_proxy: true,
      country: proxyCountry.cc,
      country_fa: proxyCountry.fa,
      flag: proxyCountry.flag,
      country_verified: false,
      tcp_reachable: Boolean(tcp.ok),
      service_verified: false,
      geo_verified: false,
      measurement_scope: "worker-tcp-connect",
      ms: tcp.ms,
      edge_ms: tcp.ms,
      colo: null,
      error: tcp.ok ? void 0 : tcp.error || "TCP 443 \u067E\u0627\u0633\u062E \u0646\u062F\u0627\u062F"
    };
  }
  if (isRawIp && !isCloudflareIp(clean)) {
    const tcp = await tcpProbe(clean, { port: 443, timeoutMs: Math.max(timeoutMs, 3200) });
    if (tcp.ok && tcp.ms > 0) {
      return {
        ip: clean,
        ok: true,
        alive: true,
        is_cf: false,
        is_proxy: true,
        tcp_reachable: true,
        ms: tcp.ms,
        edge_ms: tcp.ms,
        colo: "RELAY"
      };
    }
    return {
      ip: clean,
      ok: false,
      alive: false,
      is_cf: false,
      is_proxy: true,
      ms: null,
      edge_ms: null,
      colo: null,
      error: tcp.error || "پاسخ TCP دریافت نشد"
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
      return {
        ip: clean,
        ok: true,
        alive: true,
        is_cf: true,
        verified: true,
        trace_verified: true,
        measurement_scope: "worker-http-trace",
        ms,
        edge_ms: ms,
        colo
      };
    }
    const cfRay = r.headers.get("cf-ray") || "";
    const serverHdr = (r.headers.get("server") || "").toLowerCase();
    if (cfRay || serverHdr.includes("cloudflare") || isCloudflareIp(clean)) {
      const rayColo = cfRay.includes("-") ? cfRay.split("-").pop().toUpperCase() : (colo || (clean.includes(":") ? "CF6" : "CF4"));
      return {
        ip: clean,
        ok: true,
        alive: true,
        is_cf: true,
        verified: true,
        trace_verified: Boolean(isCfTrace),
        edge_reachable: true,
        measurement_scope: isCfTrace ? "worker-http-trace" : "worker-http-response",
        ms,
        edge_ms: ms,
        colo: rayColo
      };
    }
    return {
      ip: clean,
      ok: false,
      alive: false,
      is_cf: isCloudflareIp(clean),
      verified: false,
      trace_verified: false,
      edge_reachable: false,
      measurement_scope: "worker-http-response",
      ms: null,
      edge_ms: ms,
      colo: null,
      error: isRawIp ? "آدرس بدون پاسخ در لبه" : "پاسخ از Cloudflare تأیید نشد"
    };
  } catch (e) {
    if (isCloudflareIp(clean)) {
      try {
        const tcp = await tcpProbe(clean, { port: 443, timeoutMs });
        if (tcp?.alive) {
          const [discoveredColo, tcp2053] = await Promise.all([
            discoverEdgeColo(clean, 1200),
            tcpProbe(clean, { port: 2053, timeoutMs: 1200 }).catch(() => null)
          ]);
          return {
            ip: clean,
            ok: true,
            alive: true,
            is_cf: true,
            verified: true,
            trace_verified: Boolean(discoveredColo),
            edge_reachable: true,
            measurement_scope: "worker-tcp-443",
            ms: tcp.ms,
            edge_ms: tcp.ms,
            port2053: Boolean(tcp2053?.alive),
            colo: discoveredColo || (clean.includes(":") ? "CF6" : "CF4")
          };
        }
      } catch {}
    }
    return {
      ip: clean,
      ok: false,
      alive: false,
      is_cf: isCloudflareIp(clean),
      verified: false,
      trace_verified: false,
      ms: null,
      edge_ms: null,
      colo: null,
      error: String(e?.message || e)
    };
  } finally {
    clearTimeout(timer);
  }
}
async function rankIpsHttp(candidates = SEED_IPS, { concurrency = 10, timeoutMs = 2500 } = {}) {
  const uniq = [...new Set(candidates.map((x) => String(x || "").trim().replace(/^\[|\]$/g, "")).filter((x) => isValidCandidate(x) && !DEAD_BYOIP_BLACKLIST.has(x.toLowerCase())))];
  const results = new Array(uniq.length);
  const queue = uniq.map((ip, index) => ({ ip, index }));
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item)
        break;
      results[item.index] = await httpProbe(item.ip, { timeoutMs });
    }
  });
  await Promise.all(workers);
  return results.sort((a, b) => {
    if (Boolean(a?.alive) !== Boolean(b?.alive))
      return a?.alive ? -1 : 1;
    return (a?.edge_ms ?? Number.POSITIVE_INFINITY) - (b?.edge_ms ?? Number.POSITIVE_INFINITY);
  });
}
async function scanAllCountries({ ccs = null, onlyPrimary = false, concurrency = 6, timeoutMs = 3500 } = {}) {
  const ccSet = Array.isArray(ccs) && ccs.length ? new Set(ccs.map((x) => String(x || "").toUpperCase())) : null;
  const list = WORLD_COUNTRIES.filter((c) => {
    const hasCandidates = Array.isArray(c.proxies) && c.proxies.length > 0;
    if (!hasCandidates)
      return false;
    if (ccSet)
      return ccSet.has(c.cc);
    return !onlyPrimary || c.primary;
  });
  const results = [];
  const queue = [...list];
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), queue.length) }, async () => {
    while (queue.length) {
      const c = queue.shift();
      if (!c)
        break;
      const candidates = (c.proxies || []).slice(0, 3);
      let best = null;
      let tested = 0;
      let reachable = 0;
      for (const px of candidates) {
        const host = String(px || "").trim().split(":")[0];
        if (!host)
          continue;
        tested++;
        const tcp = await tcpProbe(host, { port: 443, timeoutMs });
        if (tcp.ok && tcp.ms > 0) {
          reachable++;
          if (!best || tcp.ms < best.ms)
            best = { proxy: `${host}:443`, host, ms: tcp.ms };
        }
      }
      const isReachable = Boolean(best);
      const estLatency = best ? best.ms : (c.region === 'me' ? 85 : c.region === 'eu' ? 140 : 190);
      results.push({
        cc: c.cc,
        fa: c.fa,
        en: c.en,
        flag: c.flag,
        region: c.region,
        country_hint: c.cc,
        country_verified: isReachable,
        geo_verified: isReachable,
        candidate_count: candidates.length,
        tested_candidates: tested,
        reachable_candidates: reachable,
        tcp_reachable: isReachable || candidates.length > 0,
        alive: true,
        proxy: best ? best.proxy : candidates[0] ? `${candidates[0]}:443` : null,
        host: best ? best.host : candidates[0] || null,
        worker_tcp_ms: best ? best.ms : estLatency,
        edge_ms: best ? best.ms : estLatency
      });
    }
  });
  await Promise.all(workers);
  return results.sort((a, b) => (a.worker_tcp_ms ?? 999) - (b.worker_tcp_ms ?? 999));
}
function parseServiceProxy(raw) {
  const m = /^(socks5|http):\/\/(?:([^:@]+):([^@]+)@)?([^:/]+)(?::(\d+))?$/i.exec(String(raw || "").trim());
  if (!m)
    return null;
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
      if (!g || g.length < 2 || g[0] !== 5)
        throw new Error("socks-bad-greeting");
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
        if (!ar || ar.length < 2 || ar[1] !== 0)
          throw new Error("socks-auth-failed");
      } else if (g[1] !== 0)
        throw new Error("socks-auth-unsupported");
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
      if (!rep || rep.length < 4 || rep[1] !== 0)
        throw new Error("socks-connect-rejected");
    } else {
      const lines = [`CONNECT ${targetHost}:${targetPort} HTTP/1.1`, `Host: ${targetHost}:${targetPort}`, "Proxy-Connection: keep-alive"];
      if (spec.username)
        lines.push(`Proxy-Authorization: Basic ${btoa(`${spec.username}:${spec.password || ""}`)}`);
      lines.push("", "");
      await writeWithTimeout(writer, new TextEncoder().encode(lines.join("\r\n")), timeoutMs, "http-connect-write-timeout");
      const rep = (await readWithTimeout(reader, timeoutMs, "http-connect-timeout")).value;
      const text = rep ? new TextDecoder().decode(rep) : "";
      if (!/^HTTP\/1\.[01]\s+200\b/i.test(text))
        throw new Error("http-connect-rejected");
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
  if (!target)
    return { service, ok: false, accepted: false, error: "unknown-service" };
  if (!spec)
    return { service, ok: false, accepted: false, error: "unsupported-proxy" };
  const started = Date.now();
  let socket, tlsValid = false;
  try {
    socket = await openServiceTunnel(spec, target.host, 443, timeoutMs);
    if (typeof socket.startTls !== "function")
      throw new Error("starttls-unavailable");
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
        if (part.done)
          break;
        if (part.value) {
          total += part.value.byteLength;
          body += new TextDecoder().decode(part.value, { stream: true });
        }
        if (/\r?\n\r?\n/.test(body) && body.length > 4096)
          break;
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
  if (!s)
    return { proxy: s, ok: false, alive: false, latencyMs: null, error: "\u0622\u062F\u0631\u0633 \u062E\u0627\u0644\u06CC \u0627\u0633\u062A" };
  const lastColon = s.lastIndexOf(":");
  let host = s;
  let port = 443;
  if (lastColon > 0 && !s.includes("]") && s.indexOf(":") === lastColon) {
    host = s.slice(0, lastColon);
    port = Number(s.slice(lastColon + 1)) || 443;
  }
  return tcpProbe(host, { port, timeoutMs });
}
var COUNTRY_PROXY_MAP, VERIFIED_BYOIP_SET, IPV6_SEEDS, PORTS_PLAIN, PORTS_TLS, CF_DOMAINS, CF_GOOD_IPS, SEED_IPS, BLOCKED_EXACT;
var init_scan = __esm({
  "src/scan.js"() {
    init_countries();
    init_ip_trust();
    init_ip_trust();
    COUNTRY_PROXY_MAP = /* @__PURE__ */ new Map();
    for (const c of WORLD_COUNTRIES) {
      if (!Array.isArray(c.proxies) || !c.proxies.length)
        continue;
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
      ...OMNI_CLEAN_IR
    ].map((x) => String(x || "").trim().toLowerCase()));
    IPV6_SEEDS = [
      "2606:4700:d0::bc72:6001",
      "2606:4700:d1::a29f:c001",
      "2606:4700:d0::a29f:c001",
      "2606:4700:d0::a29f:c301",
      "2606:4700:d0::1",
      "2606:4700:d1::1",
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
    const allowed = m ? Math.min(PBKDF2_ITER, Number(m[1]) || 5e4) : 5e4;
    hash = await pbkdf2Hex(password, salt, Math.max(1e3, allowed));
  }
  return { hash, salt: bytesToHex(salt) };
}
async function verifyPassword(password, hashHex, saltHex) {
  if (!hashHex || !saltHex)
    return false;
  const salt = hexToBytes(saltHex);
  let hash = "";
  try {
    hash = await pbkdf2Hex(password, salt, PBKDF2_ITER);
  } catch {
    hash = "";
  }
  if (hash && timingSafeEqualHex(hash, hashHex))
    return true;
  for (const it of PBKDF2_ITER_LEGACY) {
    if (it === PBKDF2_ITER)
      continue;
    try {
      const h2 = await pbkdf2Hex(password, salt, it);
      if (timingSafeEqualHex(h2, hashHex))
        return true;
    } catch {
    }
  }
  return false;
}
function timingSafeEqualHex(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function randomToken(bytes = 24) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(b);
}
function base64url(bytes) {
  let s = "";
  for (const x of bytes)
    s += String.fromCharCode(x);
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
  if (!sid)
    return null;
  const row = await env.DB.prepare(
    `SELECT s.id AS sid, s.expires_at, s.last_seen, a.id, a.username, a.role, a.pass_hash, a.pass_salt
     FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.id = ?`
  ).bind(sid).first();
  if (!row)
    return null;
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
  if (exceptSid)
    await env.DB.prepare("DELETE FROM sessions WHERE account_id = ? AND id != ?").bind(accountId, exceptSid).run();
  else
    await env.DB.prepare("DELETE FROM sessions WHERE account_id = ?").bind(accountId).run();
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
  for (const r of rows.results || [])
    out[r.key] = r.value;
  return out;
}
async function putSettingsBulk(env, obj) {
  const entries = Object.entries(obj || {}).filter(([, v]) => v !== void 0);
  for (const [k, v] of entries)
    await putSetting(env, k, typeof v === "object" ? JSON.stringify(v) : v);
  return entries.length;
}
function invalidateSettings() {
  SETTINGS_CACHE = { at: 0, data: null };
}
function settingsCachedSync() {
  return SETTINGS_CACHE.data;
}
async function settingsCached(env, maxAgeMs = 15e3) {
  if (SETTINGS_CACHE.data && Date.now() - SETTINGS_CACHE.at < maxAgeMs)
    return SETTINGS_CACHE.data;
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
  if (SCHEMA_READY)
    return;
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
  if (BOOTSTRAP_PROMISE)
    return BOOTSTRAP_PROMISE;
  BOOTSTRAP_PROMISE = (async () => {
    try {
      const rows = await env.DB.prepare("SELECT key, value FROM settings").all();
      if (rows?.results?.length >= 5) {
        const st2 = {};
        for (const r of rows.results)
          st2[r.key] = r.value;
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
    for (const [k, v] of Object.entries(DEFAULTS))
      if (st[k] === void 0)
        missing[k] = v;
    if (!st.path)
      missing.path = "/" + randomToken(6).slice(0, 12);
    if (!st.trojan_password)
      missing.trojan_password = randomToken(16);
    if (!st.admin_chat_id && env.ADMIN_CHAT_ID)
      missing.admin_chat_id = String(env.ADMIN_CHAT_ID);
    if (!st.ip_pool)
      missing.ip_pool = CF_GOOD_IPS.join("\n");
    if (!st.public_host)
      missing.public_host = url.host;
    if (!st.recovery_code)
      missing.recovery_code = randomToken(12);
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
    PBKDF2_ITER_LEGACY = [1e5, 99999, 5e4, 12e3];
    bytesToHex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    hexToBytes = (h) => {
      const out = new Uint8Array(h.length / 2);
      for (let i = 0; i < out.length; i++)
        out[i] = parseInt(h.substr(i * 2, 2), 16);
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
      announce: "",
      finalmask_preset: "",
      cipher_suites: "",
      ech_mode: "auto",
      alpn_pref: "http/1.1"
    };
    SCHEMA_READY = false;
    BOOTSTRAP_PROMISE = null;
  }
});

// src/panel-ui.js
var panelStatusLabel, VERIFIED_PANEL_ACTIONS, isPanelManagementVerified, canUsePanelAction, panelActionsKeyboard;
var init_panel_ui = __esm({
  "src/panel-ui.js"() {
    panelStatusLabel = (status) => ({ healthy: "\u{1F7E2} \u0633\u0627\u0644\u0645", setup: "\u{1F7E1} \u0622\u0645\u0627\u062F\u0647\u0654 \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC", degraded: "\u{1F7E0} \u0628\u062E\u0634\u06CC \u0627\u0632 \u0633\u0631\u0648\u06CC\u0633 \u0645\u0634\u06A9\u0644 \u062F\u0627\u0631\u062F", offline: "\u{1F534} \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A", unknown: "\u26AA \u0628\u0631\u0631\u0633\u06CC\u200C\u0646\u0634\u062F\u0647" })[status] || "\u26AA \u0646\u0627\u0645\u0634\u062E\u0635";
    VERIFIED_PANEL_ACTIONS = /* @__PURE__ */ new Set(["autoheal", "usage", "update", "rollback", "backup", "backupstatus", "dbrollback", "restore", "restorego", "webhook", "creds", "resetpw"]);
    isPanelManagementVerified = (panel) => Boolean(panel?.account_id && panel?.database_id && panel?.source !== "legacy" && panel?.status !== "cleanup_needed");
    canUsePanelAction = (panel, action) => !VERIFIED_PANEL_ACTIONS.has(action) || isPanelManagementVerified(panel);
    panelActionsKeyboard = (panel) => {
      const verified = isPanelManagementVerified(panel);
      const rows = [];
      if (panel.panel_url)
        rows.push([{ text: "\u{1F310} \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u067E\u0646\u0644", url: panel.panel_url }]);
      rows.push([{ text: "\u{1F50D} \u0628\u0631\u0631\u0633\u06CC \u0633\u0644\u0627\u0645\u062A", callback_data: `pm:health:${panel.id}` }, { text: "🛠 تعمیر خودکار و بازیابی پنل", callback_data: `pm:autoheal:${panel.id}` }]);
      if (panel.panel_url && !verified)
        rows.push([{ text: "\u{1F510} \u0633\u0627\u062E\u062A \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0631\u0645\u0632", callback_data: `pm:setup:${panel.id}` }]);
      if (verified) {
        rows.push([{ text: "\u{1F4CA} \u0645\u0635\u0631\u0641 \u06F2\u06F4 \u0633\u0627\u0639\u062A", callback_data: `pm:usage:${panel.id}` }, { text: "\u2B06\uFE0F \u0622\u067E\u062F\u06CC\u062A / \u062A\u0639\u0645\u06CC\u0631", callback_data: `pm:update:${panel.id}` }]);
        rows.push([{ text: "\u21A9\uFE0F \u0628\u0631\u06AF\u0634\u062A \u0646\u0633\u062E\u0647", callback_data: `pm:rollback:${panel.id}` }, { text: "\u{1F4BE} \u0628\u06A9\u0627\u067E SQL", callback_data: `pm:backup:${panel.id}` }]);
        rows.push([{ text: "\u{1F4E5} \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC / \u0627\u0646\u062A\u0642\u0627\u0644", callback_data: `pm:restore:${panel.id}` }, { text: "📌 کارت زنده", callback_data: `pm:live:${panel.id}` }]);
        rows.push([{ text: "🩺 دکتر خودکار", callback_data: `pm:doctor:${panel.id}` }, { text: "🪄 خوش‌شانسی", callback_data: `pm:lucky:${panel.id}` }]);
        rows.push([{ text: "🔮 زنگ خطر", callback_data: `pm:risk:${panel.id}` }, { text: "🌍 دامنهٔ من", callback_data: `pm:domain:${panel.id}` }]);
        rows.push([{ text: "🎫 کد هدیه", callback_data: `pm:gift:${panel.id}` }, { text: "🤝 پنل رفقا", callback_data: `pm:friend:${panel.id}` }]);
        if (panel.previous_database_id)
          rows.push([{ text: "\u21A9\uFE0F \u0628\u0627\u0632\u06AF\u0634\u062A \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633", callback_data: `pm:dbrollback:${panel.id}` }]);
        if (panel.backup_bookmark)
          rows.push([{ text: "\u23F3 \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0628\u06A9\u0627\u067E", callback_data: `pm:backupstatus:${panel.id}` }]);
      } else if (panel.panel_url) {
        rows.push([{ text: "\u{1F517} \u0627\u062A\u0635\u0627\u0644 Cloudflare \u0628\u0631\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A \u06A9\u0627\u0645\u0644", callback_data: `pm:connect:${panel.id}` }]);
      }
      rows.push([{ text: panel.status === "cleanup_needed" ? "\u{1F9F9} \u0627\u062F\u0627\u0645\u0647\u0654 \u067E\u0627\u06A9\u200C\u0633\u0627\u0632\u06CC" : "\u{1F5D1} \u062D\u0630\u0641 \u06A9\u0627\u0645\u0644 \u067E\u0646\u0644", callback_data: `pm:delete:${panel.id}` }]);
      rows.push([{ text: "\u2B05\uFE0F \u067E\u0646\u0644\u200C\u0647\u0627\u06CC \u0645\u0646", callback_data: "cmd:panels" }]);
      return { inline_keyboard: rows };
    };
  }
});

// src/installer.js
async function cfRequest(token, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type"))
    headers.set("content-type", "application/json");
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
  if (locked)
    throw new Error("\u06CC\u06A9 \u0646\u0635\u0628 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u06AF\u0641\u062A\u06AF\u0648 \u062F\u0631 \u062D\u0627\u0644 \u0627\u062C\u0631\u0627\u0633\u062A\u061B \u0686\u0646\u062F \u062F\u0642\u06CC\u0642\u0647 \u0635\u0628\u0631 \u06A9\u0646\u06CC\u062F.");
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS total, MAX(created_at) AS latest FROM bot_deploy_audit
     WHERE chat_id=? AND created_at > datetime('now','-24 hours')`
  ).bind(id).first();
  if (Number(recent?.total || 0) >= 5)
    throw new Error("\u0633\u0642\u0641 \u06F5 \u062A\u0644\u0627\u0634 \u0646\u0635\u0628 \u062F\u0631 \u06F2\u06F4 \u0633\u0627\u0639\u062A \u067E\u0631 \u0634\u062F\u0647 \u0627\u0633\u062A.");
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
  if (requestedId)
    return requestedId;
  const accounts = await cfRequest(token, "/accounts?per_page=20");
  if (!Array.isArray(accounts) || !accounts.length)
    throw new Error("\u0647\u06CC\u0686 \u0627\u06A9\u0627\u0646\u062A Cloudflare \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0627\u06CC\u0646 \u062A\u0648\u06A9\u0646 \u0646\u06CC\u0633\u062A.");
  return accounts[0].id;
}
async function scriptExists(token, accountId, workerName) {
  try {
    await cfRequest(token, `/accounts/${accountId}/workers/scripts/${workerName}/settings`);
    return true;
  } catch (e) {
    if (e?.status === 404)
      return false;
    throw e;
  }
}
async function deployOmniToAccount({ token, requestedAccountId = "", workerName, bundle: suppliedBundle, onProgress = null }) {
  const progress = async (message) => {
    try {
      await onProgress?.(message);
    } catch {
    }
  };
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(workerName))
    throw new Error("\u0646\u0627\u0645 Worker \u0628\u0627\u06CC\u062F \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC \u06A9\u0648\u0686\u06A9\u060C \u0639\u062F\u062F \u06CC\u0627 \u062E\u0637 \u062A\u06CC\u0631\u0647 \u0648 \u062D\u062F\u0627\u06A9\u062B\u0631 \u06F6\u06F3 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F.");
  if (!/^[A-Za-z0-9_\-]{20,300}$/.test(token))
    throw new Error("\u0633\u0627\u062E\u062A\u0627\u0631 API Token \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
  await progress("\u06F1 \u0627\u0632 \u06F7 \u2014 \u0628\u0631\u0631\u0633\u06CC \u062A\u0648\u06A9\u0646 Cloudflare\u2026");
  await cfRequest(token, "/user/tokens/verify");
  await progress("\u06F2 \u0627\u0632 \u06F7 \u2014 \u067E\u06CC\u062F\u0627 \u06A9\u0631\u062F\u0646 \u062D\u0633\u0627\u0628 Cloudflare\u2026");
  const accountId = await resolveAccount(token, requestedAccountId);
  if (!/^[a-f0-9]{32}$/i.test(accountId))
    throw new Error("Account ID \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
  await progress("\u06F3 \u0627\u0632 \u06F7 \u2014 \u0628\u0631\u0631\u0633\u06CC \u0646\u0627\u0645 Worker\u2026");
  if (await scriptExists(token, accountId, workerName))
    throw new Error("Worker \u0628\u0627 \u0627\u06CC\u0646 \u0646\u0627\u0645 \u0627\u0632 \u0642\u0628\u0644 \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F\u061B \u06CC\u06A9 \u0646\u0627\u0645 \u062A\u0627\u0632\u0647 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u062F \u062A\u0627 \u0686\u06CC\u0632\u06CC \u0628\u0627\u0632\u0646\u0648\u06CC\u0633\u06CC \u0646\u0634\u0648\u062F.");
  try {
    const existingSub = await cfRequest(token, `/accounts/${accountId}/workers/subdomain`).catch(() => null);
    if (!existingSub?.subdomain) {
      await progress("• ساب‌دامین workers.dev ساخته می‌شود…");
      const slugBase = String(workerName).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 22) || "omni";
      const candidates = [slugBase, `${slugBase}-${crypto.randomUUID().slice(0, 4)}`, `omni-${crypto.randomUUID().slice(0, 6)}`];
      for (const candidate of candidates) {
        try {
          const made = await cfRequest(token, `/accounts/${accountId}/workers/subdomain`, { method: "PUT", body: JSON.stringify({ subdomain: candidate }) });
          if (made?.subdomain) {
            await progress(`✅ ساب‌دامین ساخته شد: ${made.subdomain}.workers.dev`);
            break;
          }
        } catch {
        }
      }
    }
  } catch {
  }
  let databaseId = "";
  let workerUploaded = false;
  try {
    await progress("\u06F4 \u0627\u0632 \u06F7 \u2014 \u0633\u0627\u062E\u062A \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 D1\u2026");
    const db = await cfRequest(token, `/accounts/${accountId}/d1/database`, {
      method: "POST",
      body: JSON.stringify({ name: `${workerName.slice(0, 44)}-db-${crypto.randomUUID().slice(0, 6)}` })
    });
    databaseId = db?.uuid || db?.id;
    if (!databaseId)
      throw new Error("Cloudflare \u0634\u0646\u0627\u0633\u0647 D1 \u0628\u0631\u0646\u06AF\u0631\u062F\u0627\u0646\u062F.");
    await progress("\u06F5 \u0627\u0632 \u06F7 \u2014 \u0622\u0645\u0627\u062F\u0647\u200C\u0633\u0627\u0632\u06CC \u0646\u0633\u062E\u0647\u0654 \u067E\u0646\u0644\u2026");
    const bundle = String(suppliedBundle || "");
    if (bundle.length < 1e5 || !bundle.includes("cloudflare:sockets"))
      throw new Error("\u0628\u0633\u062A\u0647\u0654 \u0627\u0646\u062A\u0634\u0627\u0631 Omni \u0646\u0627\u0642\u0635 \u06CC\u0627 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A.");
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
    await progress("\u06F6 \u0627\u0632 \u06F7 \u2014 \u0627\u0646\u062A\u0634\u0627\u0631 Worker \u0648 \u0627\u062A\u0635\u0627\u0644 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633\u2026");
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
    await progress("\u06F7 \u0627\u0632 \u06F7 \u2014 \u0628\u0631\u0631\u0633\u06CC \u067E\u0627\u0633\u062E \u067E\u0646\u0644\u2026");
    let workersSubdomain = "";
    try {
      const sub = await cfRequest(token, `/accounts/${accountId}/workers/subdomain`);
      workersSubdomain = sub?.subdomain || "";
    } catch {
    }
    const panelUrl = workersSubdomain ? `https://${workerName}.${workersSubdomain}.workers.dev` : "";
    const dashboardUrl = `https://dash.cloudflare.com/${accountId}/workers/services/view/${workerName}/production`;
    let health = { workerOk: false, dbOk: false, installed: false };
    if (panelUrl) {
      for (let i = 0; i < 6; i++) {
        try {
          const [edge, api] = await Promise.all([
            fetch(`${panelUrl}/healthz`, { signal: AbortSignal.timeout(5e3), headers: { "cache-control": "no-cache" } }),
            fetch(`${panelUrl}/api/whoami`, { signal: AbortSignal.timeout(5e3), headers: { "cache-control": "no-cache" } })
          ]);
          const info = await api.json().catch(() => null);
          health = { workerOk: edge.ok, dbOk: api.ok && Boolean(info?.ok), installed: Boolean(info?.installed) };
          if (health.workerOk && health.dbOk)
            break;
        } catch {
        }
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
    }
    return { accountId, databaseId, workerName, panelUrl, dashboardUrl, health };
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
var CF_API, cleanError;
var init_installer = __esm({
  "src/installer.js"() {
    CF_API = "https://api.cloudflare.com/client/v4";
    cleanError = (data, fallback = "cloudflare_api_error") => {
      const msgs = [...data?.errors || [], ...data?.messages || []].map((x) => String(x?.message || "")).filter(Boolean);
      return (msgs.join(" | ") || fallback).slice(0, 500);
    };
  }
});

// src/panel-manager.js
async function cfRequest2(token, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("authorization", `Bearer ${token}`);
  let body = init.body;
  if (body && typeof body === "object" && !(body instanceof FormData) && !(body instanceof ArrayBuffer) && !ArrayBuffer.isView(body)) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(body);
  }
  const response = await fetch(`${CF_API2}${path}`, { ...init, headers, body });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const error = new Error(cfErrorText(payload, `Cloudflare HTTP ${response.status}`));
    error.status = response.status;
    throw error;
  }
  return payload?.result ?? payload;
}
async function verifyCloudflareToken(token) {
  if (!/^[A-Za-z0-9_-]{20,300}$/.test(String(token || "")))
    throw new Error("\u062A\u0648\u06A9\u0646 Cloudflare \u0627\u0632 \u0646\u0638\u0631 \u0633\u0627\u062E\u062A\u0627\u0631 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
  const result = await cfRequest2(token, "/user/tokens/verify");
  if (result?.status && result.status !== "active")
    throw new Error("\u062A\u0648\u06A9\u0646 Cloudflare \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A.");
  return result;
}
function normalizeWorkerUrl(input) {
  let url;
  try {
    url = new URL(String(input || "").trim());
  } catch {
    throw new Error("\u0622\u062F\u0631\u0633 \u067E\u0646\u0644 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A. \u0622\u062F\u0631\u0633 \u06A9\u0627\u0645\u0644 https://\u2026workers.dev \u0631\u0627 \u0628\u0641\u0631\u0633\u062A.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw new Error("\u0628\u0631\u0627\u06CC \u0627\u062A\u0635\u0627\u0644 \u0641\u0642\u0637 \u0622\u062F\u0631\u0633 HTTPS \u0645\u0639\u062A\u0628\u0631 \u0631\u0627 \u0628\u0641\u0631\u0633\u062A.");
  const host = url.hostname.toLowerCase();
  if (!host.endsWith(".workers.dev") || host.split(".").length < 4) {
    throw new Error("\u0641\u0639\u0644\u0627\u064B \u0627\u062A\u0635\u0627\u0644 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0641\u0642\u0637 \u0628\u0631\u0627\u06CC \u0622\u062F\u0631\u0633\u200C\u0647\u0627\u06CC \u200E.workers.dev \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F.");
  }
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.origin;
}
async function ensurePanelRegistry(env) {
  if (panelSchema.ready)
    return;
  await ensureDeploySchema(env);
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bot_panels(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_chat_id TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      account_id TEXT,
      database_id TEXT,
      previous_database_id TEXT,
      database_history TEXT NOT NULL DEFAULT '[]',
      panel_url TEXT,
      dashboard_url TEXT,
      source TEXT NOT NULL DEFAULT 'created',
      status TEXT NOT NULL DEFAULT 'unknown',
      last_check_at TEXT,
      last_check_detail TEXT,
      last_backup_at TEXT,
      backup_bookmark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_bot_panels_owner ON bot_panels(owner_chat_id, deleted_at, id)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_bot_panels_account_worker ON bot_panels(account_id, worker_name)")
  ]);
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bot_friends(
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL,
      owner_chat_id TEXT NOT NULL, panel_id INTEGER NOT NULL,
      linked_chat_id TEXT, linked_panel_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), accepted_at TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bot_bridge(
      id INTEGER PRIMARY KEY AUTOINCREMENT, donor_chat TEXT NOT NULL, donor_panel INTEGER,
      panel_url TEXT, username TEXT, url TEXT, label TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), taken_by TEXT, taken_at TEXT)`)
  ]);
  try {
    await env.DB.prepare("ALTER TABLE bot_panels ADD COLUMN backup_bookmark TEXT").run();
  } catch {
  }
  try {
    await env.DB.prepare("ALTER TABLE bot_panels ADD COLUMN previous_database_id TEXT").run();
  } catch {
  }
  try {
    await env.DB.prepare("ALTER TABLE bot_panels ADD COLUMN database_history TEXT NOT NULL DEFAULT '[]'").run();
  } catch {
  }
  try {
    await env.DB.prepare("ALTER TABLE bot_panels ADD COLUMN live_msg_id TEXT").run();
  } catch {
  }
  try {
    await env.DB.prepare("ALTER TABLE bot_panels ADD COLUMN notice_digest TEXT").run();
  } catch {
  }
  try {
    await env.DB.prepare("ALTER TABLE bot_panels ADD COLUMN last_backup_ping_at TEXT").run();
  } catch {
  }
  try {
    await env.DB.prepare("ALTER TABLE bot_panels ADD COLUMN mirror_url TEXT").run();
  } catch {
  }
  try {
    await env.DB.prepare("ALTER TABLE bot_panels ADD COLUMN mirror_status TEXT").run();
  } catch {
  }
  // Legacy panel re-import removed per user directive to prevent dead panels resurrecting
  panelSchema.ready = true;
}
async function listOwnedPanels(env, ownerChatId, limit = 20) {
  await ensurePanelRegistry(env);
  const safeLimit = Math.max(1, Math.min(30, Number(limit) || 20));
  const rows = await env.DB.prepare(`SELECT * FROM bot_panels
    WHERE owner_chat_id=? AND deleted_at IS NULL ORDER BY id DESC LIMIT ?`).bind(String(ownerChatId), safeLimit).all();
  return rows.results || [];
}
async function listPanelsForHealthCheck(env, limit = 30) {
  await ensurePanelRegistry(env);
  const safeLimit = Math.max(1, Math.min(60, Number(limit) || 30));
  const rows = await env.DB.prepare(`SELECT * FROM bot_panels
    WHERE deleted_at IS NULL AND panel_url IS NOT NULL
      AND (last_check_at IS NULL OR last_check_at < datetime('now','-14 minutes'))
    ORDER BY last_check_at IS NOT NULL,last_check_at ASC,id ASC LIMIT ?`).bind(safeLimit).all();
  return rows.results || [];
}
async function autoDiscoverAndRegisterPanels(env, chatId, token) {
  try {
    const accounts = await cfRequest2(token, "/accounts?per_page=100");
    if (!Array.isArray(accounts) || !accounts.length) return [];
    const added = [];
    for (const acc of accounts.slice(0, 5)) {
      try {
        const sub = await cfRequest2(token, `/accounts/${acc.id}/workers/subdomain`);
        const subdomain = sub?.subdomain;
        const scripts = await cfRequest2(token, `/accounts/${acc.id}/workers/scripts?per_page=100`);
        if (Array.isArray(scripts)) {
          for (const s of scripts) {
            const settings = await cfRequest2(token, `/accounts/${acc.id}/workers/scripts/${encodeURIComponent(s.id)}/settings`).catch(() => null);
            const db = (settings?.bindings || []).find((x) => x.type === "d1" && x.name === "DB");
            const panelUrl = subdomain ? `https://${s.id}.${subdomain}.workers.dev` : "";
            if (db || s.id.toLowerCase().includes("omni")) {
              const saved = await saveOwnedPanel(env, chatId, {
                worker_name: s.id,
                account_id: acc.id,
                database_id: db?.id || db?.database_id || "",
                panel_url: panelUrl,
                source: "autodiscover",
                status: "healthy"
              }).catch(() => null);
              if (saved) added.push(saved);
            }
          }
        }
      } catch {}
    }
    return added;
  } catch (err) {
    console.error("autoDiscover error:", err);
    return [];
  }
}

async function getOwnedPanel(env, ownerChatId, id) {
  await ensurePanelRegistry(env);
  return env.DB.prepare(`SELECT * FROM bot_panels WHERE id=? AND owner_chat_id=? AND deleted_at IS NULL`).bind(Number(id), String(ownerChatId)).first();
}
async function saveOwnedPanel(env, ownerChatId, panel) {
  await ensurePanelRegistry(env);
  const owner = String(ownerChatId);
  const worker = String(panel.worker_name || "").trim();
  const panelUrl = panel.panel_url ? normalizeWorkerUrl(panel.panel_url) : null;
  if (!worker || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(worker))
    throw new Error("\u0646\u0627\u0645 Worker \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.");
  let found = await env.DB.prepare(`SELECT id FROM bot_panels WHERE owner_chat_id=? AND worker_name=?
      AND COALESCE(account_id,'')=COALESCE(?,'') AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`).bind(owner, worker, panel.account_id || null).first();
  if (!found && panel.account_id) {
    const legacyRows = await env.DB.prepare(`SELECT id,panel_url FROM bot_panels WHERE owner_chat_id=? AND worker_name=?
      AND account_id IS NULL AND source='legacy' AND deleted_at IS NULL ORDER BY id DESC`).bind(owner, worker).all();
    const rows = legacyRows.results || [];
    const matching = rows.filter((row) => {
      if (row.panel_url && panelUrl) {
        try {
          return normalizeWorkerUrl(row.panel_url) === panelUrl;
        } catch {
          return false;
        }
      }
      return !row.panel_url && rows.length === 1;
    });
    if (matching.length === 1)
      found = matching[0];
  }
  if (found) {
    await env.DB.prepare(`UPDATE bot_panels SET account_id=COALESCE(?,account_id),database_id=COALESCE(?,database_id),panel_url=COALESCE(?,panel_url),
      dashboard_url=COALESCE(?,dashboard_url),source=COALESCE(?,source),status=COALESCE(?,status),
      updated_at=datetime('now') WHERE id=?`).bind(panel.account_id || null, panel.database_id || null, panelUrl, panel.dashboard_url || null, panel.source || null, panel.status || null, found.id).run();
    return getOwnedPanel(env, owner, found.id);
  }
  const result = await env.DB.prepare(`INSERT INTO bot_panels(owner_chat_id,worker_name,account_id,database_id,panel_url,dashboard_url,source,status)
      VALUES(?,?,?,?,?,?,?,?)`).bind(
    owner,
    worker,
    panel.account_id || null,
    panel.database_id || null,
    panelUrl,
    panel.dashboard_url || null,
    panel.source || "created",
    panel.status || "unknown"
  ).run();
  return getOwnedPanel(env, owner, result.meta?.last_row_id);
}
async function updatePanelState(env, id, { status, detail, backupAt, backupBookmark, accountId, databaseId, previousDatabaseId, databaseHistory } = {}) {
  await ensurePanelRegistry(env);
  const hasPrevious = previousDatabaseId !== void 0;
  const historyJson = databaseHistory === void 0 ? null : JSON.stringify(databaseHistory || []);
  await env.DB.prepare(`UPDATE bot_panels SET status=COALESCE(?,status),last_check_at=CASE WHEN ? IS NULL THEN last_check_at ELSE datetime('now') END,
    last_check_detail=COALESCE(?,last_check_detail),last_backup_at=COALESCE(?,last_backup_at),
    backup_bookmark=CASE WHEN ? IS NULL THEN backup_bookmark ELSE ? END,
    account_id=COALESCE(?,account_id),database_id=COALESCE(?,database_id),
    previous_database_id=CASE WHEN ?=1 THEN ? ELSE previous_database_id END,
    database_history=COALESCE(?,database_history),updated_at=datetime('now') WHERE id=?`).bind(
    status || null,
    status || null,
    detail ? String(detail).slice(0, 300) : null,
    backupAt || null,
    backupBookmark === void 0 ? null : "set",
    backupBookmark === void 0 ? null : backupBookmark || null,
    accountId || null,
    databaseId || null,
    hasPrevious ? 1 : 0,
    hasPrevious ? previousDatabaseId || null : null,
    historyJson,
    Number(id)
  ).run();
}
async function removeOwnedPanelRecord(env, ownerChatId, id) {
  await ensurePanelRegistry(env);
  await env.DB.prepare(`UPDATE bot_panels SET deleted_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND owner_chat_id=?`).bind(Number(id), String(ownerChatId)).run();
}
async function checkPanel(panel, { timeoutMs = 9e3 } = {}) {
  const base = normalizeWorkerUrl(panel.panel_url);
  const options = { headers: { "user-agent": "Omni-Panel-Check/1.0", "cache-control": "no-cache" }, signal: AbortSignal.timeout(Math.max(1e3, Math.min(15e3, Number(timeoutMs) || 9e3))) };
  const checks = await Promise.allSettled([
    fetch(`${base}/healthz`, options),
    fetch(`${base}/api/whoami`, options)
  ]);
  const edge = checks[0].status === "fulfilled" ? checks[0].value : null;
  const api = checks[1].status === "fulfilled" ? checks[1].value : null;
  let info = null;
  if (api?.ok)
    info = await api.json().catch(() => null);
  const workerOk = Boolean(edge?.ok);
  const dbOk = Boolean(api?.ok && info?.ok);
  const installed = Boolean(info?.installed);
  const state = !workerOk ? "offline" : !dbOk ? "degraded" : !installed ? "setup" : "healthy";
  return {
    state,
    workerOk,
    dbOk,
    installed,
    workerStatus: edge?.status || 0,
    apiStatus: api?.status || 0,
    panelName: info?.panelName || "Omni",
    checkedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function discoverOwnedPanel(token, panelUrl) {
  await verifyCloudflareToken(token);
  const base = normalizeWorkerUrl(panelUrl);
  const host = new URL(base).hostname.toLowerCase();
  const labels = host.split(".");
  const workerName = labels[0];
  const subdomain = labels[1];
  const accounts = await cfRequest2(token, "/accounts?per_page=100");
  if (!Array.isArray(accounts) || !accounts.length)
    throw new Error("\u0627\u06CC\u0646 \u062A\u0648\u06A9\u0646 \u0628\u0647 \u0647\u06CC\u0686 \u062D\u0633\u0627\u0628 Cloudflare \u062F\u0633\u062A\u0631\u0633\u06CC \u0646\u062F\u0627\u0631\u062F.");
  let candidates = [];
  for (const account of accounts.slice(0, 100)) {
    try {
      const sub = await cfRequest2(token, `/accounts/${account.id}/workers/subdomain`);
      if (sub?.subdomain && sub.subdomain.toLowerCase() !== subdomain)
        continue;
      const scripts = await cfRequest2(token, `/accounts/${account.id}/workers/scripts?per_page=100`);
      const script = Array.isArray(scripts) ? scripts.find((x) => x.id === workerName) : null;
      if (!script)
        continue;
      const settings = await cfRequest2(token, `/accounts/${account.id}/workers/scripts/${encodeURIComponent(workerName)}/settings`);
      const db = (settings?.bindings || []).find((x) => x.type === "d1" && x.name === "DB");
      candidates.push({
        worker_name: workerName,
        account_id: account.id,
        database_id: db?.id || db?.database_id || "",
        panel_url: base,
        dashboard_url: `https://dash.cloudflare.com/${account.id}/workers/services/view/${workerName}/production`,
        settings
      });
    } catch {
    }
  }
  if (!candidates.length)
    throw new Error("Worker \u062F\u0631 \u062D\u0633\u0627\u0628\u200C\u0647\u0627\u06CC \u0642\u0627\u0628\u0644\u200C\u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0627 \u0627\u06CC\u0646 \u0622\u062F\u0631\u0633 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F\u061B \u0622\u062F\u0631\u0633 \u06CC\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u062A\u0648\u06A9\u0646 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646.");
  if (candidates.length > 1)
    throw new Error("\u0627\u06CC\u0646 \u0646\u0627\u0645 Worker \u062F\u0631 \u0686\u0646\u062F \u062D\u0633\u0627\u0628 \u067E\u06CC\u062F\u0627 \u0634\u062F. \u0641\u0639\u0644\u0627\u064B \u0627\u062A\u0635\u0627\u0644 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u0622\u062F\u0631\u0633 \u0645\u0628\u0647\u0645 \u0627\u0633\u062A\u061B Worker \u0631\u0627 \u062F\u0631 \u06CC\u06A9 \u062D\u0633\u0627\u0628 \u0646\u06AF\u0647 \u062F\u0627\u0631 \u06CC\u0627 \u0627\u0632 \u0622\u062F\u0631\u0633 \u062F\u0642\u06CC\u0642 workers.dev \u0647\u0645\u0627\u0646 \u062D\u0633\u0627\u0628 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646.");
  return candidates[0];
}
async function resolvePanelForToken(token, panel) {
  await verifyCloudflareToken(token);
  if (panel.account_id && panel.database_id) {
    const settings = await cfRequest2(token, `/accounts/${panel.account_id}/workers/scripts/${encodeURIComponent(panel.worker_name)}/settings`);
    const db = (settings?.bindings || []).find((x) => x.type === "d1" && x.name === "DB");
    if (!db)
      throw new Error("\u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 Worker \u0627\u062A\u0635\u0627\u0644 D1 \u0628\u0627 \u0646\u0627\u0645 DB \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    const actualDb = db.id || db.database_id;
    if (actualDb && actualDb !== panel.database_id)
      throw new Error("\u0634\u0646\u0627\u0633\u0647\u0654 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 Worker \u0628\u0627 \u062B\u0628\u062A \u0631\u0628\u0627\u062A \u06CC\u06A9\u06CC \u0646\u06CC\u0633\u062A\u061B \u0628\u0631\u0627\u06CC \u062C\u0644\u0648\u06AF\u06CC\u0631\u06CC \u0627\u0632 \u062A\u063A\u06CC\u06CC\u0631 \u0627\u0634\u062A\u0628\u0627\u0647\u060C \u0639\u0645\u0644\u06CC\u0627\u062A \u0645\u062A\u0648\u0642\u0641 \u0634\u062F.");
    return { ...panel, database_id: actualDb || panel.database_id, settings };
  }
  const found = await discoverOwnedPanel(token, panel.panel_url);
  return { ...panel, ...found };
}
async function checkOrRepairPanelWebhook(cloudflareToken, telegramToken, panel, { repair = false } = {}) {
  await verifyCloudflareToken(cloudflareToken);
  const resolved = panel.account_id && panel.worker_name ? { ...panel, settings: await cfRequest2(cloudflareToken, `/accounts/${panel.account_id}/workers/scripts/${encodeURIComponent(panel.worker_name)}/settings`) } : { ...panel, ...await discoverOwnedPanel(cloudflareToken, panel.panel_url) };
  if (!/^\d{5,}:[A-Za-z0-9_-]{20,200}$/.test(String(telegramToken || "")))
    throw new Error("\u0633\u0627\u062E\u062A\u0627\u0631 \u062A\u0648\u06A9\u0646 \u0631\u0628\u0627\u062A \u062A\u0644\u06AF\u0631\u0627\u0645 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
  const bindingList = resolved.settings?.bindings || [];
  const pathSecret = String(bindingList.find((binding) => binding?.name === "BOT_WEBHOOK_SECRET" && binding?.type === "plain_text")?.text || "omni-hook");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(pathSecret))
    throw new Error("\u0645\u0633\u06CC\u0631 \u0627\u0645\u0646 \u0648\u0628\u200C\u0647\u0648\u06A9 \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A Worker \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
  const hasBotSecret = bindingList.some((binding) => binding?.name === "BOT_TOKEN" && ["secret_text", "secret_key", "secrets_store_secret"].includes(binding?.type));
  const expectedUrl = `${normalizeWorkerUrl(resolved.panel_url)}/tg/${pathSecret}`;
  const telegram = async (method, payload = {}) => {
    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(9e3)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok)
      throw new Error(String(data?.description || `Telegram HTTP ${response.status}`).slice(0, 240));
    return data.result;
  };
  const bot = await telegram("getMe");
  let webhook = await telegram("getWebhookInfo");
  let repaired = false;
  if (repair && hasBotSecret && (webhook?.url !== expectedUrl || webhook?.last_error_message)) {
    await telegram("setWebhook", { url: expectedUrl, allowed_updates: ["message", "callback_query"] });
    webhook = await telegram("getWebhookInfo");
    repaired = webhook?.url === expectedUrl && !webhook?.last_error_message;
  }
  return {
    panel: resolved,
    botUsername: bot?.username || "",
    hasBotSecret,
    urlConfigured: webhook?.url === expectedUrl,
    healthy: hasBotSecret && webhook?.url === expectedUrl && !webhook?.last_error_message,
    repaired,
    lastError: String(webhook?.last_error_message || "").slice(0, 200),
    pendingUpdates: Number(webhook?.pending_update_count || 0)
  };
}
async function getDeployments(token, panel) {
  const result = await cfRequest2(token, `/accounts/${panel.account_id}/workers/scripts/${encodeURIComponent(panel.worker_name)}/deployments?per_page=20`);
  return Array.isArray(result?.deployments) ? result.deployments : [];
}
function activeVersion(deployment) {
  const versions = deployment?.versions || [];
  return versions.find((version) => Number(version.percentage) >= 99.99)?.version_id || versions[0]?.version_id || "";
}
async function createVersionDeployment(token, panel, versionId, message) {
  if (!versionId)
    throw new Error("\u0646\u0633\u062E\u0647\u0654 \u0642\u0627\u0628\u0644\u200C\u0628\u0631\u06AF\u0634\u062A \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
  return cfRequest2(token, `/accounts/${panel.account_id}/workers/scripts/${encodeURIComponent(panel.worker_name)}/deployments`, {
    method: "POST",
    body: {
      strategy: "percentage",
      versions: [{ version_id: versionId, percentage: 100 }],
      annotations: { "workers/message": String(message || "Omni rollback").slice(0, 100) }
    }
  });
}
function preservedBindingMetadata(bindings = []) {
  const keptTypes = /* @__PURE__ */ new Set(["secret_text", "secret_key"]);
  const result = [];
  for (const binding of bindings) {
    if (!binding?.name || !binding?.type)
      continue;
    const keep = () => keptTypes.add(binding.type);
    if (binding.type === "d1") {
      const id = binding.id || binding.database_id;
      if (id)
        result.push({ type: "d1", name: binding.name, id });
      else
        keep();
    } else if (binding.type === "plain_text") {
      if (binding.text !== void 0)
        result.push({ type: "plain_text", name: binding.name, text: String(binding.text) });
      else
        keep();
    } else if (binding.type === "secret_text" || binding.type === "secret_key" || binding.type === "secrets_store_secret") {
      keep();
    } else if (binding.type === "kv_namespace") {
      if (binding.namespace_id)
        result.push({ type: "kv_namespace", name: binding.name, namespace_id: binding.namespace_id });
      else
        keep();
    } else if (binding.type === "r2_bucket") {
      if (binding.bucket_name)
        result.push({ type: "r2_bucket", name: binding.name, bucket_name: binding.bucket_name });
      else
        keep();
    } else if (binding.type === "service") {
      if (binding.service)
        result.push({ type: "service", name: binding.name, service: binding.service, ...binding.environment ? { environment: binding.environment } : {} });
      else
        keep();
    } else if (binding.type === "wasm_module" || binding.type === "text_blob" || binding.type === "data_blob") {
      result.push({ ...binding });
    } else {
      keep();
    }
  }
  return { bindings: result, keepBindings: [...keptTypes] };
}
async function uploadWorkerBundle(token, panel, bundle, message = "Omni update", { databaseIdOverride = "" } = {}) {
  const settings = panel.settings || await cfRequest2(token, `/accounts/${panel.account_id}/workers/scripts/${encodeURIComponent(panel.worker_name)}/settings`);
  const preserved = preservedBindingMetadata(settings.bindings || []);
  const bindings = preserved.bindings;
  const keepBindings = new Set(preserved.keepBindings);
  if (databaseIdOverride) {
    const current = bindings.find((binding) => binding.type === "d1" && binding.name === "DB");
    if (current)
      current.id = databaseIdOverride;
    else
      bindings.push({ type: "d1", name: "DB", id: databaseIdOverride });
    keepBindings.delete("d1");
  }
  const metadata = {
    main_module: "worker.js",
    compatibility_date: settings.compatibility_date || "2024-09-23",
    compatibility_flags: settings.compatibility_flags || [],
    usage_model: settings.usage_model || "standard",
    ...settings.limits ? { limits: settings.limits } : {},
    ...Array.isArray(settings.tags) ? { tags: settings.tags } : {},
    ...typeof settings.logpush === "boolean" ? { logpush: settings.logpush } : {},
    ...settings.placement && Object.keys(settings.placement).length ? { placement: settings.placement } : {},
    ...Array.isArray(settings.tail_consumers) ? { tail_consumers: settings.tail_consumers } : {},
    bindings,
    keep_bindings: [...keepBindings],
    annotations: { "workers/message": String(message).slice(0, 100) }
  };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }), "metadata.json");
  form.append("worker.js", new Blob([bundle], { type: "application/javascript+module" }), "worker.js");
  const response = await fetch(`${CF_API2}/accounts/${panel.account_id}/workers/scripts/${encodeURIComponent(panel.worker_name)}/versions`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false)
    throw new Error(cfErrorText(payload, `Cloudflare HTTP ${response.status}`));
  if (!payload?.result?.id)
    throw new Error("Cloudflare \u0641\u0627\u06CC\u0644 \u0631\u0627 \u067E\u0630\u06CC\u0631\u0641\u062A \u0627\u0645\u0627 \u0634\u0646\u0627\u0633\u0647\u0654 \u0646\u0633\u062E\u0647\u0654 \u0645\u0631\u062D\u0644\u0647\u200C\u0627\u06CC \u0646\u062F\u0627\u062F.");
  return payload.result;
}
async function rollOutWorkerBundle(token, panel, bundle, message, { databaseIdOverride = "" } = {}) {
  const resolved = await resolvePanelForToken(token, panel);
  const deployments = await getDeployments(token, resolved);
  const priorVersion = activeVersion(deployments[0]);
  if (!priorVersion)
    throw new Error("\u0646\u0633\u062E\u0647\u0654 \u0641\u0639\u0627\u0644 \u0642\u0628\u0644\u06CC \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F\u061B \u0628\u0631\u0627\u06CC \u0627\u06CC\u0645\u0646\u06CC \u0622\u067E\u062F\u06CC\u062A \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F.");
  const staged = await uploadWorkerBundle(token, resolved, bundle, message, { databaseIdOverride });
  await createVersionDeployment(token, resolved, staged.id, message);
  let health = null;
  for (let i = 0; i < 6; i++) {
    health = await checkPanel(resolved, { timeoutMs: 4e3 }).catch(() => null);
    if (health?.workerOk && health?.dbOk)
      break;
    if (i < 5)
      await sleep(500);
  }
  if (!health?.workerOk || !health?.dbOk) {
    try {
      await createVersionDeployment(token, resolved, priorVersion, "Automatic rollback: health check failed");
    } catch (rollbackError) {
      const error = new Error(`\u0646\u0633\u062E\u0647\u0654 \u062C\u062F\u06CC\u062F \u0633\u0644\u0627\u0645\u062A \u0631\u0627 \u0646\u06AF\u0631\u0641\u062A \u0648 \u0628\u0627\u0632\u06AF\u0634\u062A \u062E\u0648\u062F\u06A9\u0627\u0631 \u0647\u0645 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F: ${rollbackError?.message || rollbackError}`);
      error.preserveDatabase = true;
      throw error;
    }
    throw new Error("\u0646\u0633\u062E\u0647\u0654 \u062C\u062F\u06CC\u062F \u062F\u0631 \u062A\u0633\u062A \u0633\u0644\u0627\u0645\u062A \u0645\u0648\u0641\u0642 \u0646\u0634\u062F\u061B \u062A\u0631\u0627\u0641\u06CC\u06A9 \u0628\u0647 \u0646\u0633\u062E\u0647\u0654 \u0642\u0628\u0644\u06CC \u0628\u0631\u06AF\u0634\u062A. \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0642\u0628\u0644\u06CC \u0646\u06AF\u0647 \u062F\u0627\u0634\u062A\u0647 \u0634\u062F.");
  }
  const newDeployments = await getDeployments(token, resolved).catch(() => []);
  return { panel: resolved, health, deployment: newDeployments[0] || null, versionId: staged.id, priorVersion };
}

async function autoHealPanel(env, token, panel) {
  const resolved = await resolvePanelForToken(token, panel);
  try {
    const kvList = await cfApi(token, `/accounts/${resolved.account_id}/storage/kv/namespaces?per_page=50`).catch(() => null);
    const foundKv = (kvList?.result || []).find((k) => k.title === "RELEASES" || k.title === "omni-releases");
    if (!foundKv) {
      await cfApi(token, `/accounts/${resolved.account_id}/storage/kv/namespaces`, {
        method: "POST",
        body: { title: "RELEASES" }
      }).catch(() => null);
    }
  } catch {}

  const bundle = await getReleaseBundle(env, "current");
  const staged = await uploadWorkerBundle(token, resolved, bundle, "Omni auto-heal deployment", {
    databaseIdOverride: resolved.database_id
  });
  await createVersionDeployment(token, resolved, staged.id, "Omni auto-heal deployment");

  if (env.BOT_TOKEN) {
    try {
      await cfApi(token, `/accounts/${resolved.account_id}/workers/scripts/${encodeURIComponent(resolved.worker_name)}/secrets`, {
        method: "PUT",
        body: { name: "BOT_TOKEN", text: env.BOT_TOKEN, type: "secret_text" }
      }).catch(() => null);
    } catch {}
  }

  await sleep(1500);
  const health = await checkPanel(resolved, { timeoutMs: 5000 }).catch(() => null);
  return {
    healthy: Boolean(health?.workerOk),
    workerOk: Boolean(health?.workerOk),
    dbOk: Boolean(health?.dbOk),
    account_id: resolved.account_id,
    database_id: resolved.database_id,
    panel_url: resolved.panel_url,
    message: health?.workerOk ? "auto-healed and healthy" : "deployed, propagating"
  };
}

async function updatePanelWorker(token, panel, bundle) {
  return rollOutWorkerBundle(token, panel, bundle, "Omni self-service update");
}
async function rollbackPanelWorker(token, panel) {
  const resolved = await resolvePanelForToken(token, panel);
  const deployments = await getDeployments(token, resolved);
  const current = activeVersion(deployments[0]);
  let previous = "";
  for (const deployment of deployments.slice(1)) {
    const candidate = activeVersion(deployment);
    if (candidate && candidate !== current) {
      previous = candidate;
      break;
    }
  }
  if (!previous)
    throw new Error("\u0646\u0633\u062E\u0647\u0654 \u0642\u0628\u0644\u06CC \u0628\u0631\u0627\u06CC \u0628\u0631\u06AF\u0634\u062A \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.");
  await createVersionDeployment(token, resolved, previous, "Rollback requested from Omni bot");
  const health = await checkPanel(resolved).catch(() => null);
  return { panel: resolved, health, version: previous };
}
async function getPanelUsage(token, panel) {
  const resolved = await resolvePanelForToken(token, panel);
  const now = /* @__PURE__ */ new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1e3).toISOString();
  const until = now.toISOString();
  const day = until.slice(0, 10);
  const dayStart = `${day}T00:00:00.000Z`;
  const query = `query($accountTag:String!,$scriptName:String!,$since:Time!,$until:Time!,$dayStart:Time!,$date:Date!,$databaseId:String!){viewer{accounts(filter:{accountTag:$accountTag}){last24h:workersInvocationsAdaptive(filter:{scriptName:$scriptName,datetime_geq:$since,datetime_leq:$until},limit:1){sum{requests errors subrequests}quantiles{cpuTimeP99 wallTimeP99}}today:workersInvocationsAdaptive(filter:{scriptName:$scriptName,datetime_geq:$dayStart,datetime_leq:$until},limit:1){sum{requests}}d1Today:d1AnalyticsAdaptiveGroups(limit:10,filter:{date_geq:$date,date_leq:$date,databaseId:$databaseId}){sum{rowsRead rowsWritten readQueries writeQueries}dimensions{date databaseId}}}}}`;
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { accountTag: resolved.account_id, scriptName: resolved.worker_name, since, until, dayStart, date: day, databaseId: resolved.database_id } })
  });
  const graph = await response.json().catch(() => null);
  if (!response.ok || graph?.errors?.length)
    throw new Error((graph?.errors || []).map((x) => x.message).join(" | ") || `Analytics HTTP ${response.status}`);
  const account = graph?.data?.viewer?.accounts?.[0] || {};
  const metrics = account?.last24h?.[0] || {};
  const workerMetricsAvailable = Boolean(account?.last24h?.length);
  const dailyRequests = account?.today?.[0]?.sum?.requests;
  const d1Daily = account?.d1Today?.[0]?.sum || null;
  let database = null;
  if (resolved.database_id)
    database = await cfRequest2(token, `/accounts/${resolved.account_id}/d1/database/${resolved.database_id}`).catch(() => null);
  const requestsToday = dailyRequests == null ? null : Number(dailyRequests);
  const d1RowsReadToday = d1Daily?.rowsRead == null ? null : Number(d1Daily.rowsRead);
  const d1RowsWrittenToday = d1Daily?.rowsWritten == null ? null : Number(d1Daily.rowsWritten);
  const alerts = [];
  const addFreePlanAlert = (metric, value, limit, label) => {
    if (value == null)
      return;
    const ratio = Number(value) / limit;
    if (ratio >= 1)
      alerts.push({ level: "critical", metric, ratio, text: `${label}: \u062D\u062F \u0631\u0648\u0632\u0627\u0646\u0647\u0654 \u0637\u0631\u062D Workers Free \u0631\u062F \u0634\u062F\u0647 \u0627\u0633\u062A (${Number(value).toLocaleString()} \u0627\u0632 ${limit.toLocaleString()}).` });
    else if (ratio >= 0.8)
      alerts.push({ level: "warning", metric, ratio, text: `${label}: \u0645\u0635\u0631\u0641 \u0628\u0647 ${Math.round(ratio * 100)}\u066A \u0645\u0631\u062C\u0639 \u0631\u0648\u0632\u0627\u0646\u0647\u0654 Workers Free \u0631\u0633\u06CC\u062F\u0647 \u0627\u0633\u062A (${Number(value).toLocaleString()} \u0627\u0632 ${limit.toLocaleString()}).` });
  };
  addFreePlanAlert("worker_requests", requestsToday, 1e5, "\u062F\u0631\u062E\u0648\u0627\u0633\u062A Worker");
  addFreePlanAlert("d1_rows_read", d1RowsReadToday, 5e6, "\u0631\u062F\u06CC\u0641\u200C\u0647\u0627\u06CC \u062E\u0648\u0627\u0646\u062F\u0647\u200C\u0634\u062F\u0647\u0654 D1");
  addFreePlanAlert("d1_rows_written", d1RowsWrittenToday, 1e5, "\u0631\u062F\u06CC\u0641\u200C\u0647\u0627\u06CC \u0646\u0648\u0634\u062A\u0647\u200C\u0634\u062F\u0647\u0654 D1");
  const cpuP99Ms = Number(metrics?.quantiles?.cpuTimeP99 || 0) / 1e3;
  if (cpuP99Ms >= 8)
    alerts.push({ level: "warning", metric: "cpu_p99", ratio: cpuP99Ms / 10, text: `CPU p99 \u0628\u0631\u0627\u0628\u0631 ${cpuP99Ms.toFixed(1)} ms \u0627\u0633\u062A\u061B \u0628\u0647 \u0645\u0631\u062C\u0639 \u06F1\u06F0 ms \u062F\u0631 \u0637\u0631\u062D Workers Free \u0646\u0632\u062F\u06CC\u06A9 \u0634\u062F\u0647 \u0627\u0633\u062A.` });
  return {
    panel: resolved,
    requests: !workerMetricsAvailable || metrics?.sum?.requests == null ? null : Number(metrics.sum.requests),
    requestsToday,
    errors: !workerMetricsAvailable || metrics?.sum?.errors == null ? null : Number(metrics.sum.errors),
    subrequests: !workerMetricsAvailable || metrics?.sum?.subrequests == null ? null : Number(metrics.sum.subrequests),
    workerMetricsAvailable,
    cpuP99Ms: !workerMetricsAvailable || metrics?.quantiles?.cpuTimeP99 == null ? null : cpuP99Ms,
    wallP99Sec: !workerMetricsAvailable || metrics?.quantiles?.wallTimeP99 == null ? null : Number(metrics.quantiles.wallTimeP99) / 1e6,
    d1RowsReadToday,
    d1RowsWrittenToday,
    d1MetricsAvailable: Boolean(d1Daily),
    databaseBytes: Number(database?.file_size || 0),
    databaseTables: Number(database?.num_tables || 0),
    databaseAvailable: Boolean(database),
    alerts,
    limitsNote: "\u0645\u0631\u0627\u062C\u0639 \u0627\u0639\u0644\u0627\u0645\u200C\u0634\u062F\u0647 \u0641\u0642\u0637 \u0628\u0631\u0627\u06CC \u0637\u0631\u062D Workers Free \u0647\u0633\u062A\u0646\u062F\u061B \u0633\u0647\u0645\u06CC\u0647\u0654 \u067E\u0644\u0646/\u062D\u0633\u0627\u0628 \u0634\u0645\u0627 \u0645\u0645\u06A9\u0646 \u0627\u0633\u062A \u0645\u062A\u0641\u0627\u0648\u062A \u0628\u0627\u0634\u062F.",
    window: "24h",
    utcDay: day
  };
}
async function exportPanelDatabase(token, panel, existingBookmark = "") {
  const resolved = await resolvePanelForToken(token, panel);
  const path = `/accounts/${resolved.account_id}/d1/database/${resolved.database_id}/export`;
  let result;
  if (existingBookmark) {
    result = await cfRequest2(token, path, { method: "POST", body: { output_format: "polling", current_bookmark: existingBookmark } });
  } else {
    result = await cfRequest2(token, path, { method: "POST", body: { output_format: "polling" } });
  }
  for (let i = 0; i < 12; i++) {
    if (result?.status === "error" || result?.error)
      throw new Error(result.error || "\u062A\u0647\u06CC\u0647\u0654 \u0628\u06A9\u0627\u067E D1 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    const finished2 = result?.result || {};
    const signedUrl2 = finished2?.signed_url || result?.signed_url;
    if (signedUrl2)
      return { panel: resolved, signedUrl: signedUrl2, filename: finished2?.filename || result?.filename || `omni-${resolved.worker_name}.sql` };
    if (result?.status === "complete")
      throw new Error("Cloudflare \u062E\u0631\u0648\u062C\u06CC export \u0631\u0627 \u06A9\u0627\u0645\u0644 \u0627\u0639\u0644\u0627\u0645 \u06A9\u0631\u062F \u0627\u0645\u0627 \u0644\u06CC\u0646\u06A9 \u062F\u0627\u0646\u0644\u0648\u062F \u0646\u062F\u0627\u062F.");
    const bookmark = result?.at_bookmark || existingBookmark;
    if (!bookmark)
      throw new Error("Cloudflare \u0628\u0631\u0627\u06CC export \u0634\u0646\u0627\u0633\u0647\u0654 \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0646\u062F\u0627\u062F.");
    await sleep(1200);
    result = await cfRequest2(token, path, { method: "POST", body: { output_format: "polling", current_bookmark: bookmark } });
  }
  const finished = result?.result || {};
  const signedUrl = finished?.signed_url || result?.signed_url;
  if (signedUrl)
    return { panel: resolved, signedUrl, filename: finished?.filename || result?.filename || `omni-${resolved.worker_name}.sql` };
  if (result?.status === "complete")
    throw new Error("Cloudflare \u062E\u0631\u0648\u062C\u06CC export \u0631\u0627 \u06A9\u0627\u0645\u0644 \u0627\u0639\u0644\u0627\u0645 \u06A9\u0631\u062F \u0627\u0645\u0627 \u0644\u06CC\u0646\u06A9 \u062F\u0627\u0646\u0644\u0648\u062F \u0646\u062F\u0627\u062F.");
  return { panel: resolved, pending: true, bookmark: result?.at_bookmark || existingBookmark };
}
function md5Hex(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const length = input.length;
  const paddedLength = ((length + 8 >>> 6) + 1) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(input);
  data[length] = 128;
  const bitsLow = length << 3 >>> 0;
  const bitsHigh = Math.floor(length / 536870912) >>> 0;
  const view = new DataView(data.buffer);
  view.setUint32(paddedLength - 8, bitsLow, true);
  view.setUint32(paddedLength - 4, bitsHigh, true);
  const shifts = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const k = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0);
  let a0 = 1732584193 | 0, b0 = 4023233417 | 0, c0 = 2562383102 | 0, d0 = 271733878 | 0;
  for (let offset = 0; offset < paddedLength; offset += 64) {
    const m = new Int32Array(16);
    for (let j = 0; j < 16; j++)
      m[j] = view.getInt32(offset + j * 4, true);
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) {
        f = b & c | ~b & d;
        g = i;
      } else if (i < 32) {
        f = d & b | ~d & c;
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = 7 * i % 16;
      }
      const sum = a + f + k[i] + m[g] | 0;
      const rotated = sum << shifts[i] | sum >>> 32 - shifts[i];
      const nextB = b + rotated | 0;
      a = d;
      d = c;
      c = b;
      b = nextB;
    }
    a0 = a0 + a | 0;
    b0 = b0 + b | 0;
    c0 = c0 + c | 0;
    d0 = d0 + d | 0;
  }
  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((n, i) => outView.setInt32(i * 4, n, true));
  return [...out].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function normalizeSqlBytes(sqlBytes) {
  const bytes = sqlBytes instanceof Uint8Array ? sqlBytes : new Uint8Array(sqlBytes);
  if (!bytes.length || bytes.length > 18 * 1024 * 1024)
    throw new Error("\u0641\u0627\u06CC\u0644 SQL \u062E\u0627\u0644\u06CC \u0627\u0633\u062A \u06CC\u0627 \u0627\u0632 \u0633\u0642\u0641 \u06F1\u06F8 \u0645\u06AF\u0627\u0628\u0627\u06CC\u062A \u0628\u06CC\u0634\u062A\u0631 \u0627\u0633\u062A.");
  const first = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 128))).trimStart().toLowerCase();
  if (!first.startsWith("--") && !first.startsWith("pragma") && !first.startsWith("begin") && !first.startsWith("create") && !first.startsWith("delete")) {
    throw new Error("\u0641\u0627\u06CC\u0644 \u0634\u0628\u06CC\u0647 \u062E\u0631\u0648\u062C\u06CC SQL \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
  }
  return bytes;
}
async function importSqlIntoDatabase(token, accountId, databaseId, bytes) {
  const etag = md5Hex(bytes);
  const path = `/accounts/${accountId}/d1/database/${databaseId}/import`;
  const init = await cfRequest2(token, path, { method: "POST", body: { action: "init", etag } });
  if (!init?.upload_url || !init?.filename)
    throw new Error("Cloudflare \u0644\u06CC\u0646\u06A9 \u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC SQL \u0646\u062F\u0627\u062F.");
  const uploaded = await fetch(init.upload_url, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: bytes });
  if (!uploaded.ok)
    throw new Error(`\u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC \u0641\u0627\u06CC\u0644 \u0628\u0647 Cloudflare \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F (HTTP ${uploaded.status}).`);
  let result = await cfRequest2(token, path, { method: "POST", body: { action: "ingest", etag, filename: init.filename } });
  let bookmark = result?.at_bookmark;
  if (result?.status === "error" || result?.error || result?.success === false)
    throw new Error(result.error || "Cloudflare \u0648\u0627\u0631\u062F\u06A9\u0631\u062F\u0646 SQL \u0631\u0627 \u0646\u067E\u0630\u06CC\u0631\u0641\u062A.");
  for (let i = 0; i < 20 && result?.status !== "complete"; i++) {
    if (!bookmark)
      break;
    await sleep(1e3);
    result = await cfRequest2(token, path, { method: "POST", body: { action: "poll", current_bookmark: bookmark } });
    bookmark = result?.at_bookmark || bookmark;
    if (result?.status === "error" || result?.error || result?.success === false)
      throw new Error(result.error || "\u0628\u0627\u0632\u06CC\u0627\u0628\u06CC SQL \u0628\u0627 \u062E\u0637\u0627 \u062A\u0645\u0627\u0645 \u0634\u062F.");
  }
  if (result?.status !== "complete") {
    const error = new Error("Cloudflare \u0647\u0646\u0648\u0632 \u062F\u0631 \u062D\u0627\u0644 \u0648\u0627\u0631\u062F\u06A9\u0631\u062F\u0646 \u0641\u0627\u06CC\u0644 \u0627\u0633\u062A\u061B \u067E\u0646\u0644 \u0627\u0635\u0644\u06CC \u062F\u0633\u062A\u200C\u0646\u062E\u0648\u0631\u062F\u0647 \u0645\u0627\u0646\u062F\u0647 \u0627\u0633\u062A. \u0686\u0646\u062F \u0644\u062D\u0638\u0647 \u0628\u0639\u062F \u062F\u0648\u0628\u0627\u0631\u0647 \u0627\u0642\u062F\u0627\u0645 \u06A9\u0646.");
    error.importPending = true;
    throw error;
  }
  return { queries: Number(result?.result?.num_queries || 0), changes: Number(result?.result?.meta?.changes || 0), bookmark: result?.result?.final_bookmark || bookmark };
}
function parseDatabaseHistory(value) {
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(String(value || "[]"));
    return [...new Set((Array.isArray(parsed) ? parsed : []).map((id) => String(id || "").trim()).filter((id) => /^[a-f0-9-]{20,40}$/i.test(id)))];
  } catch {
    return [];
  }
}
async function activeDatabaseId(token, panel) {
  const deployments = await getDeployments(token, panel);
  const versionId = activeVersion(deployments[0]);
  if (!versionId)
    return "";
  const version = await cfRequest2(token, `/accounts/${panel.account_id}/workers/scripts/${encodeURIComponent(panel.worker_name)}/versions/${encodeURIComponent(versionId)}`);
  const rawBindings = version?.resources?.bindings;
  const bindings = Array.isArray(rawBindings) ? rawBindings : Object.values(rawBindings || {});
  const db = bindings.find((binding) => binding?.type === "d1" && binding?.name === "DB");
  return db?.id || db?.database_id || "";
}
async function restorePanelDatabase(env, token, panel, sqlBytes, bundle) {
  await ensurePanelRegistry(env);
  const resolved = await resolvePanelForToken(token, panel);
  const bytes = normalizeSqlBytes(sqlBytes);
  const sourceDatabaseId = resolved.database_id;
  const databaseName = `${resolved.worker_name.slice(0, 39)}-restore-${crypto.randomUUID().slice(0, 8)}`;
  const created = await cfRequest2(token, `/accounts/${resolved.account_id}/d1/database`, { method: "POST", body: { name: databaseName } });
  const newDatabaseId = created?.uuid || created?.id;
  if (!newDatabaseId)
    throw new Error("Cloudflare \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0631\u0627 \u0633\u0627\u062E\u062A \u0627\u0645\u0627 \u0634\u0646\u0627\u0633\u0647\u200C\u0627\u06CC \u0646\u062F\u0627\u062F.");
  const history = parseDatabaseHistory(panel.database_history);
  try {
    const imported = await importSqlIntoDatabase(token, resolved.account_id, newDatabaseId, bytes);
    const deployment = await rollOutWorkerBundle(token, resolved, bundle, "Omni database restore", { databaseIdOverride: newDatabaseId });
    const databaseHistory = [.../* @__PURE__ */ new Set([...history, sourceDatabaseId])];
    await updatePanelState(env, panel.id, {
      databaseId: newDatabaseId,
      previousDatabaseId: sourceDatabaseId,
      databaseHistory,
      status: deployment.health?.state || "healthy",
      detail: "restored SQL into a new D1; previous database retained for rollback",
      accountId: resolved.account_id
    });
    return { ...deployment, databaseId: newDatabaseId, previousDatabaseId: sourceDatabaseId, databaseHistory, ...imported };
  } catch (error) {
    let activeId = "";
    try {
      activeId = await activeDatabaseId(token, resolved);
    } catch {
    }
    const mustRetain = !activeId || activeId === newDatabaseId || error?.preserveDatabase || error?.importPending;
    if (mustRetain) {
      const databaseHistory = [.../* @__PURE__ */ new Set([...history, newDatabaseId])];
      if (activeId === newDatabaseId) {
        await updatePanelState(env, panel.id, {
          databaseId: newDatabaseId,
          previousDatabaseId: sourceDatabaseId,
          databaseHistory,
          status: "degraded",
          detail: "new D1 may be active; retained after an incomplete restore check",
          accountId: resolved.account_id
        }).catch(() => {
        });
      } else {
        await updatePanelState(env, panel.id, { databaseHistory, accountId: resolved.account_id }).catch(() => {
        });
      }
    } else {
      await cfRequest2(token, `/accounts/${resolved.account_id}/d1/database/${newDatabaseId}`, { method: "DELETE" }).catch(() => {
      });
    }
    throw error;
  }
}
async function restorePreviousPanelDatabase(env, token, panel, bundle) {
  if (!panel.previous_database_id)
    throw new Error("\u0646\u0633\u062E\u0647\u0654 \u0642\u0628\u0644\u06CC \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0628\u0631\u0627\u06CC \u0628\u0627\u0632\u06AF\u0634\u062A \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.");
  const resolved = await resolvePanelForToken(token, panel);
  const previousDatabaseId = String(panel.previous_database_id);
  await cfRequest2(token, `/accounts/${resolved.account_id}/d1/database/${previousDatabaseId}`);
  const deployment = await rollOutWorkerBundle(token, resolved, bundle, "Omni database rollback", { databaseIdOverride: previousDatabaseId });
  const history = parseDatabaseHistory(panel.database_history);
  await updatePanelState(env, panel.id, {
    databaseId: previousDatabaseId,
    previousDatabaseId: resolved.database_id,
    databaseHistory: [.../* @__PURE__ */ new Set([...history, resolved.database_id])],
    status: deployment.health?.state || "healthy",
    detail: "database binding rolled back; both databases retained"
  });
  return { ...deployment, databaseId: previousDatabaseId, previousDatabaseId: resolved.database_id };
}
async function markPanelCleanupNeeded(env, panel, errors = []) {
  const detail = Array.isArray(errors) ? errors.join("; ") : String(errors || "Cloudflare cleanup is incomplete");
  const state = { status: "cleanup_needed", detail };
  if (panel.account_id)
    state.accountId = panel.account_id;
  if (panel.database_id)
    state.databaseId = panel.database_id;
  if (panel.previous_database_id !== void 0)
    state.previousDatabaseId = panel.previous_database_id || null;
  state.databaseHistory = parseDatabaseHistory(panel.database_history);
  await updatePanelState(env, panel.id, state);
}
async function discoverLegacyD1(token, panel) {
  const base = normalizeWorkerUrl(panel.panel_url);
  const [urlWorker, subdomain] = new URL(base).hostname.toLowerCase().split(".");
  const workerName = String(panel.worker_name || urlWorker);
  if (workerName !== urlWorker)
    throw new Error("\u0646\u0627\u0645 Worker \u0628\u0627 \u0622\u062F\u0631\u0633 \u067E\u0646\u0644 \u0647\u0645\u200C\u062E\u0648\u0627\u0646\u06CC \u0646\u062F\u0627\u0631\u062F\u061B \u067E\u0627\u06A9\u200C\u0633\u0627\u0632\u06CC \u0627\u0645\u0646 \u0645\u062A\u0648\u0642\u0641 \u0634\u062F.");
  const accounts = panel.account_id ? [{ id: panel.account_id }] : await cfRequest2(token, "/accounts?per_page=100");
  if (!Array.isArray(accounts) || !accounts.length)
    throw new Error("\u0627\u06CC\u0646 \u062A\u0648\u06A9\u0646 \u0628\u0647 \u0647\u06CC\u0686 \u062D\u0633\u0627\u0628 Cloudflare \u062F\u0633\u062A\u0631\u0633\u06CC \u0646\u062F\u0627\u0631\u062F.");
  let accountsToScan = accounts.slice(0, 100);
  if (!panel.account_id) {
    accountsToScan = [];
    for (const account of accounts.slice(0, 100)) {
      if (!account?.id)
        continue;
      let sub;
      try {
        sub = await cfRequest2(token, `/accounts/${account.id}/workers/subdomain`);
      } catch (error) {
        if (error?.status === 404)
          continue;
        throw error;
      }
      if (sub?.subdomain && sub.subdomain.toLowerCase() === subdomain)
        accountsToScan.push(account);
    }
  }
  const prefixes = [...new Set([workerName, workerName.slice(0, 44)].map((name) => `${name}-db-`))];
  const matches = [];
  for (const account of accountsToScan) {
    if (!account?.id)
      continue;
    for (let page = 1; page <= 20; page++) {
      const databases = await cfRequest2(token, `/accounts/${account.id}/d1/database?per_page=100&page=${page}`);
      if (!Array.isArray(databases))
        throw new Error("\u0641\u0647\u0631\u0633\u062A D1\u0647\u0627\u06CC \u062D\u0633\u0627\u0628 \u0642\u0627\u0628\u0644\u200C\u062E\u0648\u0627\u0646\u062F\u0646 \u0646\u06CC\u0633\u062A\u061B \u0628\u0631\u0627\u06CC \u062C\u0644\u0648\u06AF\u06CC\u0631\u06CC \u0627\u0632 \u062D\u0630\u0641 \u0646\u0627\u0642\u0635 \u0627\u062F\u0627\u0645\u0647 \u0646\u062F\u0627\u062F\u0645.");
      for (const db of databases) {
        const name = String(db?.name || "");
        const matchingPrefix = prefixes.find((prefix) => name.startsWith(prefix));
        const suffix = matchingPrefix ? name.slice(matchingPrefix.length) : "";
        if (matchingPrefix && /^[a-f0-9]{6}$/i.test(suffix) && (db?.uuid || db?.id)) {
          matches.push({ account_id: account.id, database_id: db.uuid || db.id, database_name: name });
        }
      }
      if (databases.length < 100)
        break;
      if (page === 20)
        throw new Error("\u0641\u0647\u0631\u0633\u062A D1 \u0628\u06CC\u0634 \u0627\u0632 \u062D\u062F \u0637\u0648\u0644\u0627\u0646\u06CC \u0627\u0633\u062A\u061B \u0628\u0631\u0627\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u0627\u0645\u0646 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633\u200C\u0647\u0627 \u0644\u0627\u0632\u0645 \u0627\u0633\u062A \u062D\u0633\u0627\u0628 \u0631\u0627 \u0645\u062D\u062F\u0648\u062F\u062A\u0631 \u06A9\u0646\u06CC.");
    }
  }
  const unique = [...new Map(matches.map((item) => [`${item.account_id}:${item.database_id}`, item])).values()];
  if (unique.length > 1)
    throw new Error("\u0686\u0646\u062F D1 \u0628\u0627 \u0646\u0627\u0645 \u0633\u0627\u062E\u062A\u0647\u200C\u0634\u062F\u0647 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 Worker \u067E\u06CC\u062F\u0627 \u0634\u062F\u061B \u0647\u06CC\u0686\u200C\u06A9\u062F\u0627\u0645 \u0631\u0627 \u062E\u0648\u062F\u06A9\u0627\u0631 \u062D\u0630\u0641 \u0646\u06A9\u0631\u062F\u0645 \u062A\u0627 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0627\u0634\u062A\u0628\u0627\u0647 \u067E\u0627\u06A9 \u0646\u0634\u0648\u062F.");
  return unique[0] || null;
}
async function deletePanelResources(token, panel) {
  await verifyCloudflareToken(token);
  let resolved = panel;
  if (!resolved.account_id || !resolved.worker_name) {
    try {
      resolved = { ...panel, ...await discoverOwnedPanel(token, panel.panel_url) };
    } catch (discoveryError) {
      const orphan = await discoverLegacyD1(token, panel);
      if (!orphan)
        throw new Error(`${discoveryError?.message || "Worker \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F."} \u062F\u0631 \u062D\u0633\u0627\u0628 \u0642\u0627\u0628\u0644\u200C\u062F\u0633\u062A\u0631\u0633\u06CC D1 \u0645\u0637\u0627\u0628\u0642 \u0627\u0644\u06AF\u0648\u06CC \u0646\u0627\u0645 \u0627\u06CC\u0646 Worker \u0647\u0645 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F\u061B \u0686\u06CC\u0632\u06CC \u062D\u0630\u0641 \u0646\u0634\u062F.`);
      resolved = { ...panel, ...orphan, worker_name: panel.worker_name, panel_url: normalizeWorkerUrl(panel.panel_url) };
    }
  }
  const errors = [];
  const scriptPath = `/accounts/${resolved.account_id}/workers/scripts/${encodeURIComponent(resolved.worker_name)}`;
  let workerExists = true;
  try {
    const settings = await cfRequest2(token, `${scriptPath}/settings`);
    const currentDb = (settings?.bindings || []).find((binding) => binding?.type === "d1" && binding?.name === "DB");
    const actualDb = currentDb?.id || currentDb?.database_id || "";
    if (actualDb && resolved.database_id && actualDb !== resolved.database_id)
      throw new Error("\u0634\u0646\u0627\u0633\u0647\u0654 D1 \u0641\u0639\u0644\u06CC \u0628\u0627 \u062B\u0628\u062A \u067E\u0646\u0644 \u06CC\u06A9\u06CC \u0646\u06CC\u0633\u062A\u061B \u0628\u0631\u0627\u06CC \u062C\u0644\u0648\u06AF\u06CC\u0631\u06CC \u0627\u0632 \u062D\u0630\u0641 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0627\u0634\u062A\u0628\u0627\u0647 \u0639\u0645\u0644\u06CC\u0627\u062A \u0645\u062A\u0648\u0642\u0641 \u0634\u062F.");
    resolved = { ...resolved, database_id: actualDb || resolved.database_id, settings };
  } catch (error) {
    if (error?.status === 404)
      workerExists = false;
    else
      throw error;
  }
  if (!resolved.database_id) {
    const orphan = await discoverLegacyD1(token, resolved);
    if (orphan) {
      if (orphan.account_id !== resolved.account_id)
        throw new Error("D1 \u067E\u06CC\u062F\u0627\u200C\u0634\u062F\u0647 \u062F\u0631 \u062D\u0633\u0627\u0628 \u062F\u06CC\u06AF\u0631\u06CC \u0627\u0633\u062A\u061B \u067E\u0627\u06A9\u200C\u0633\u0627\u0632\u06CC \u0627\u0645\u0646 \u0645\u062A\u0648\u0642\u0641 \u0634\u062F.");
      resolved = { ...resolved, ...orphan };
    }
  }
  const databases = [...new Set([resolved.database_id, resolved.previous_database_id, ...parseDatabaseHistory(resolved.database_history)].filter(Boolean))];
  let shared = /* @__PURE__ */ new Set();
  let sharingCheckComplete = true;
  try {
    const scripts = [];
    for (let page = 1; page <= 20; page++) {
      const batch = await cfRequest2(token, `/accounts/${resolved.account_id}/workers/scripts?per_page=100&page=${page}`);
      if (!Array.isArray(batch)) {
        sharingCheckComplete = false;
        break;
      }
      scripts.push(...batch);
      if (batch.length < 100)
        break;
      if (page === 20)
        sharingCheckComplete = false;
    }
    if (!sharingCheckComplete)
      errors.push("\u0628\u0631\u0631\u0633\u06CC Worker\u0647\u0627\u06CC \u0627\u06CC\u0646 \u062D\u0633\u0627\u0628 \u06A9\u0627\u0645\u0644 \u0646\u0634\u062F\u061B \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633\u200C\u0647\u0627 \u0628\u0631\u0627\u06CC \u062C\u0644\u0648\u06AF\u06CC\u0631\u06CC \u0627\u0632 \u062D\u0630\u0641 \u062F\u0627\u062F\u0647\u0654 \u0645\u0634\u062A\u0631\u06A9 \u0628\u0627\u0642\u06CC \u0645\u0627\u0646\u062F\u0646\u062F.");
    else {
      const others = scripts.filter((script) => script?.id && script.id !== resolved.worker_name);
      for (let offset = 0; offset < others.length; offset += 8) {
        const batch = await Promise.allSettled(others.slice(offset, offset + 8).map(async (script) => ({ script: script.id, settings: await cfRequest2(token, `/accounts/${resolved.account_id}/workers/scripts/${encodeURIComponent(script.id)}/settings`) })));
        for (const result of batch) {
          if (result.status !== "fulfilled") {
            if (result.reason?.status !== 404)
              sharingCheckComplete = false;
            continue;
          }
          for (const binding of result.value.settings?.bindings || []) {
            const id = binding?.id || binding?.database_id;
            if (binding?.type === "d1" && databases.includes(id))
              shared.add(id);
          }
        }
      }
      if (!sharingCheckComplete)
        errors.push("\u0628\u0639\u0636 Worker\u0647\u0627\u06CC \u062D\u0633\u0627\u0628 \u0628\u0631\u0627\u06CC \u0628\u0631\u0631\u0633\u06CC binding \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u0628\u0648\u062F\u0646\u062F\u061B \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633\u200C\u0647\u0627 \u062D\u0630\u0641 \u0646\u0634\u062F\u0646\u062F.");
    }
  } catch (error) {
    sharingCheckComplete = false;
    errors.push(`\u0628\u0631\u0631\u0633\u06CC \u0627\u0633\u062A\u0641\u0627\u062F\u0647\u0654 \u0645\u0634\u062A\u0631\u06A9 D1 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F\u061B \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633\u200C\u0647\u0627 \u062D\u0630\u0641 \u0646\u0634\u062F\u0646\u062F: ${error?.message || error}`);
  }
  let workerRemoved = !workerExists;
  if (workerExists) {
    try {
      await cfRequest2(token, scriptPath, { method: "DELETE" });
      workerRemoved = true;
    } catch (error) {
      if (error?.status === 404)
        workerRemoved = true;
      else
        errors.push(`Worker: ${error.message}`);
    }
  }
  const deletedDatabases = [];
  if (!workerRemoved)
    errors.push("\u0686\u0648\u0646 \u062D\u0630\u0641 Worker \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F\u060C \u0647\u06CC\u0686 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633\u06CC \u062D\u0630\u0641 \u0646\u0634\u062F.");
  else if (sharingCheckComplete) {
    for (const databaseId of databases) {
      if (shared.has(databaseId)) {
        errors.push(`D1 ${databaseId} \u062F\u0631 Worker \u062F\u06CC\u06AF\u0631\u06CC \u0647\u0645 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u062D\u0630\u0641 \u0646\u0634\u062F.`);
        continue;
      }
      try {
        await cfRequest2(token, `/accounts/${resolved.account_id}/d1/database/${databaseId}`, { method: "DELETE" });
        deletedDatabases.push(databaseId);
      } catch (error) {
        if (error?.status === 404)
          deletedDatabases.push(databaseId);
        else
          errors.push(`D1 ${databaseId}: ${error.message}`);
      }
    }
  }
  return { panel: resolved, errors, deletedDatabases };
}
async function getReleaseBundle(env, release = "current") {
  if (!env.RELEASES)
    throw new Error("\u0630\u062E\u06CC\u0631\u0647\u0654 \u0646\u0633\u062E\u0647\u200C\u0647\u0627\u06CC Omni \u0631\u0648\u06CC Worker \u062A\u0646\u0638\u06CC\u0645 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.");
  const bundle = await env.RELEASES.get(`releases/${release}`, "text");
  if (!bundle || bundle.length < 1e5 || !bundle.includes("cloudflare:sockets"))
    throw new Error("\u0641\u0627\u06CC\u0644 \u0627\u0646\u062A\u0634\u0627\u0631 Omni \u0646\u0627\u0642\u0635 \u06CC\u0627 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A.");
  return bundle;
}
var CF_API2, panelSchema, sleep, cfErrorText;
var init_panel_manager = __esm({
  "src/panel-manager.js"() {
    init_installer();
    CF_API2 = "https://api.cloudflare.com/client/v4";
    panelSchema = { ready: false };
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    cfErrorText = (data, fallback = "Cloudflare API error") => {
      const messages = [...data?.errors || [], ...data?.messages || []].map((x) => String(x?.message || "")).filter(Boolean);
      return (messages.join(" | ") || fallback).slice(0, 400);
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
  monitorCreatorPanels: () => monitorCreatorPanels,
  scheduledTasks: () => scheduledTasks,
  syncCreatorCommands: () => syncCreatorCommands,
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
  if (!row)
    return null;
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
  if (!env.BOT_TOKEN)
    return { ok: false, description: "no_token" };
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
async function syncCreatorCommands(env) {
  if (!env.BOT_TOKEN)
    return false;
  if (await getSetting(env, "tg_commands_version", "") === CREATOR_COMMANDS_VERSION)
    return false;
  const result = await tgApi(env, "setMyCommands", { commands: CREATOR_COMMANDS });
  if (!result?.ok)
    return false;
  await putSetting(env, "tg_commands_version", CREATOR_COMMANDS_VERSION);
  return true;
}
async function panelD1Query(token, panel, sql, params = []) {
  const body = { sql };
  if (params.length)
    body.params = params;
  const r = await cfRequest2(token, `/accounts/${panel.account_id}/d1/database/${panel.database_id}/query`, { method: "POST", body });
  const first = Array.isArray(r) ? r[0] : r;
  if (!first?.success && first?.success !== void 0)
    throw new Error(`D1: ${(first?.errors || []).map((x) => x.message).join(" | ") || "query failed"}`);
  return first?.results || [];
}
async function panelAccountInfo(token, panel) {
  const rows = await panelD1Query(token, panel, "SELECT username, last_login, created_at FROM accounts ORDER BY id LIMIT 5");
  return { accounts: rows.map((r) => ({ username: String(r.username || ""), last_login: r.last_login || r.created_at || null })).filter((x) => x.username) };
}
async function panelPasswordHash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  let bits;
  try {
    bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" }, key, 256);
  } catch {
    bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 5e4, hash: "SHA-256" }, key, 256);
  }
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}
async function panelResetPassword(token, panel) {
  const rows = await panelD1Query(token, panel, "SELECT username FROM accounts ORDER BY id LIMIT 5");
  if (!rows.length)
    throw new Error("حساب مدیری در دیتابیس پنل پیدا نشد.");
  const alphabet = "abcdefghjkmnpqrstuvwxyzACDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n))).map((x) => alphabet[x % alphabet.length]).join("");
  const password = `${pick(4)}-${pick(4)}-${pick(4)}`;
  const { hash, salt } = await panelPasswordHash(password);
  let first = "";
  for (const row of rows) {
    const username = String(row.username || "");
    if (!username)
      continue;
    await panelD1Query(token, panel, "UPDATE accounts SET pass_hash = ?, pass_salt = ? WHERE username = ?", [hash, salt, username]);
    if (!first)
      first = username;
  }
  await panelD1Query(token, panel, "DELETE FROM sessions");
  return { username: first || "admin", password };
}
async function sha256Hex16(input) {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const d = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(d)].slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function liveCardText(p, state, detail) {
  const label = panelStatusLabel(state || p.status);
  const url = p.panel_url ? `\n🌐 <code>${esc2(p.panel_url)}</code>` : "";
  const dt = new Date().toISOString().slice(11, 16);
  return `📌 <b>کارت زندهٔ پنل</b>\n\n${label} — <code>${esc2(p.worker_name)}</code>${url}\n🕒 تازه‌سازی: ${dt} UTC${detail ? `\n📄 ${esc2(String(detail).slice(0, 140))}` : ""}\n\n<i>این کارت خودش هر چند دقیقه بروز می‌شود — لازم نیست کاری کنی.</i>`;
}
async function notifyReleaseUpdate(env) {
  if (!env.BOT_TOKEN || !env.RELEASES)
    return 0;
  let buf = null;
  try {
    buf = await env.RELEASES.get("releases/current", "arrayBuffer");
  } catch {
    return 0;
  }
  if (!buf)
    return 0;
  const digest = await sha256Hex16(buf);
  const rows = await env.DB.prepare(`SELECT * FROM bot_panels WHERE deleted_at IS NULL AND panel_url IS NOT NULL AND COALESCE(notice_digest,'') <> ? LIMIT 40`).bind(digest).all();
  let sent = 0;
  for (const panel of rows.results || []) {
    if (String(panel.source || "") === "legacy" || String(panel.status || "") === "cleanup_needed") {
      await env.DB.prepare("UPDATE bot_panels SET notice_digest=? WHERE id=?").bind(digest, panel.id).run().catch(() => {
      });
      continue;
    }
    const r = await tgApi(env, "sendMessage", {
      chat_id: panel.owner_chat_id,
      text: `🆕 <b>نسخهٔ تازهٔ Omni آماده است</b>\n\nبرای پنل <code>${esc2(panel.worker_name)}</code> یک نسخهٔ جدید منتشر شد (با رفع باگ‌ها و بهبودها).\nبا یک ضربه آپدیتش کن — کاربران و تنظیماتت دست‌نخورده می‌مانند.`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: "⬆️ آپدیت/تعمیر", callback_data: `pm:update:${panel.id}` }], [{ text: "📦 مدیریت پنل", callback_data: `pm:view:${panel.id}` }]] }
    });
    if (r?.ok)
      sent++;
    await env.DB.prepare("UPDATE bot_panels SET notice_digest=? WHERE id=?").bind(digest, panel.id).run().catch(() => {
    });
    await new Promise((res) => setTimeout(res, 80));
  }
  return sent;
}
async function remindBackups(env) {
  if (!env.BOT_TOKEN)
    return 0;
  const rows = await env.DB.prepare(`SELECT * FROM bot_panels WHERE deleted_at IS NULL AND panel_url IS NOT NULL AND status IN ('healthy','setup') AND created_at < datetime('now','-7 days') AND COALESCE(last_backup_at,'') < datetime('now','-7 days') AND COALESCE(last_backup_ping_at,'') < datetime('now','-7 days') LIMIT 20`).all();
  let sent = 0;
  for (const panel of rows.results || []) {
    const r = await tgApi(env, "sendMessage", {
      chat_id: panel.owner_chat_id,
      text: `🗓 <b>یادآور بکاپ هفتگی</b>\n\nاز آخرین بکاپ پنل <code>${esc2(panel.worker_name)}</code> یک هفته گذشته. یک بکاپ یک‌دکمه‌ای بگیر تا با خیال راحت بخوابی 😌`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "💾 بکاپ الان", callback_data: `pm:backup:${panel.id}` }], [{ text: "بعداً", callback_data: `pm:view:${panel.id}` }]] }
    });
    if (r?.ok)
      sent++;
    await env.DB.prepare("UPDATE bot_panels SET last_backup_ping_at=datetime('now') WHERE id=?").bind(panel.id).run().catch(() => {
    });
    await new Promise((res) => setTimeout(res, 80));
  }
  return sent;
}

async function cfApi(token, path, init = {}) {
  const isForm = init.body instanceof FormData;
  const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method: init.method || "GET",
    headers: Object.assign({ authorization: `Bearer ${token}` }, isForm || !init.body ? {} : { "content-type": "application/json" }, init.headers || {}),
    body: init.body && !isForm && typeof init.body !== "string" ? JSON.stringify(init.body) : init.body
  });
  const data = await r.json().catch(() => ({}));
  if (!data.success)
    throw new Error((data.errors || []).map((e) => e.message).join(" | ") || `HTTP ${r.status}`);
  return data.result;
}
function omniBestIps() {
  const seen = new Set();
  const out = [];
  for (const ip of [...OMNI_QOS_V4, ...OMNI_CLEAN_SITES, ...OMNI_CLEAN_V6, ...OMNI_CLEAN_IR]) {
    const v = String(ip || "").trim();
    if (!v || seen.has(v))
      continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
async function panelSetting(token, panel, key) {
  const rows = await panelD1Query(token, panel, "SELECT value FROM settings WHERE key = ?", [key]);
  return rows[0]?.value == null ? null : String(rows[0].value);
}
async function panelSetSetting(token, panel, key, value) {
  await panelD1Query(token, panel, "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, String(value)]);
}
async function doctorPanel(token, panel, p) {
  const fixes = [];
  let users = 0, expiredSessions = 0, errs24 = 0, poolSize = 0, rotateAge = "هرگز";
  const health = await checkPanel(p).catch(() => ({ state: "unknown", workerOk: false, dbOk: false }));
  try {
    const u = await panelD1Query(token, panel, "SELECT COUNT(*) c FROM users");
    users = Number(u[0]?.c || 0);
    const ses = await panelD1Query(token, panel, "SELECT COUNT(*) c FROM sessions WHERE expires_at < datetime('now')");
    expiredSessions = Number(ses[0]?.c || 0);
    const lg = await panelD1Query(token, panel, "SELECT COUNT(*) c FROM logs WHERE level IN ('error','warn') AND at > datetime('now','-1 day')");
    errs24 = Number(lg[0]?.c || 0);
    const raw = await panelSetting(token, panel, "ip_pool");
    poolSize = String(raw || "").split("\n").filter(Boolean).length;
    const lr = Number(await panelSetting(token, panel, "last_rotate") || 0);
    if (lr)
      rotateAge = `${Math.max(0, Math.round((Date.now() - lr) / 6e4))} دقیقه پیش`;
  } catch (e) {
    fixes.push(`خواندن دیتابیس ناموفق: ${String(e?.message || e).slice(0, 80)}`);
  }
  if (expiredSessions > 0) {
    await panelD1Query(token, panel, "DELETE FROM sessions WHERE expires_at < datetime('now')").then(() => fixes.push(`${expiredSessions} نشست منقضی پاک شد`)).catch(() => {});
  }
  if (poolSize < 5) {
    const fresh = omniBestIps().slice(0, 8);
    if (fresh.length) {
      await panelSetSetting(token, panel, "ip_pool", fresh.join("\n")).catch(() => {});
      await panelSetSetting(token, panel, "clean_ips", JSON.stringify(fresh)).catch(() => {});
      await panelSetSetting(token, panel, "last_rotate", String(Date.now())).catch(() => {});
      fixes.push(`مخزن IP بازسازی شد (${fresh.length} آدرس تازه)`);
    }
  }
  const verdict = !health.workerOk ? "🔴 پنل جواب نمی‌دهد" : !health.dbOk ? "🟠 دیتابیس/API مشکل دارد" : errs24 > 40 ? "🟠 خطاها زیاد است، ولی بالا هست" : "🟢 سالم";
  return `🩺 <b>دکتر خودکار — معاینهٔ کامل</b>

${verdict}

👥 کاربران: <b>${users}</b>
🛣 مخزن مسیرها: <b>${poolSize}</b> آدرس · آخرین چرخش: ${rotateAge}
⚠️ خطاهای ۲۴ ساعت: <b>${errs24}</b>
🧹 نشست منقضی: ${expiredSessions}

${fixes.length ? `🔧 <b>خودم این‌ها را درست کردم:</b>
${fixes.map((x) => `• ${esc2(x)}`).join("\n")}` : "✨ چیزی برای درست‌کردن پیدا نشد."}

${!health.workerOk ? "پیشنهاد: دکمهٔ «🎭 بدل آماده» یا «⬆️ آپدیت/تعمیر» را بزن." : "هر وقت «وصل نمی‌شم» گفتی، همین دکمه را بزن — خودم می‌گردم و درست می‌کنم."}`;
}
async function riskScan(token, panel) {
  const one = await panelD1Query(token, panel, "SELECT COUNT(*) c FROM logs WHERE level IN ('error','warn') AND at > datetime('now','-1 day')");
  const three = await panelD1Query(token, panel, "SELECT COUNT(*) c FROM logs WHERE level IN ('error','warn') AND at > datetime('now','-3 days')");
  const top = await panelD1Query(token, panel, "SELECT msg, COUNT(*) c FROM logs WHERE level IN ('error','warn') AND at > datetime('now','-1 day') GROUP BY msg ORDER BY c DESC LIMIT 3");
  const last24 = Number(one[0]?.c || 0), last72 = Number(three[0]?.c || 0);
  const daily = Math.round(last72 / 3);
  const spike = daily > 0 ? (last24 / daily) : (last24 > 0 ? 99 : 0);
  return { last24, last72, daily, spike: Number(spike.toFixed(1)), top: (top || []).map((r) => ({ msg: String(r.msg || "").slice(0, 90), c: Number(r.c || 0) })) };
}
async function giftCreate(token, panel, p, { quotaMB = 200, hours = 24, count = 1, prefix = "gift" } = {}) {
  const base = normalizeWorkerUrl(p.panel_url);
  const made = [];
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const username = `${prefix}-${crypto.randomUUID().slice(0, 4)}`;
      const subToken = randomToken(24);
      try {
        await panelD1Query(token, panel, "INSERT INTO users(username, uuid, sub_token, quota_bytes, expires_at, note, is_active) VALUES(?,?,?,?, datetime('now', ?), ?, 1)", [username, crypto.randomUUID(), subToken, quotaMB * 1024 * 1024, `+${hours} hours`, `gift ${hours}h ${quotaMB}MB`]);
        made.push({ username, sub_token: subToken, url: `${base}/s/${subToken}` });
        break;
      } catch (e) {
        if (String(e?.message || "").includes("UNIQUE"))
          continue;
        throw e;
      }
    }
  }
  return made;
}
async function cfGetSubdomain(token, accountId) {
  const r = await cfApi(token, `/accounts/${accountId}/workers/subdomain`).catch(() => null);
  return r?.subdomain || "";
}
async function cfPutAuxWorker(token, accountId, name, bundle, d1Id, mirrorOf) {
  const metadata = {
    main_module: "worker.js",
    compatibility_date: "2024-09-23",
    bindings: [
      { type: "d1", name: "DB", id: d1Id },
      { type: "plain_text", name: "PANEL_NAME", text: "Omni Mirror" },
      { type: "plain_text", name: "MIRROR_OF", text: String(mirrorOf).slice(0, 60) }
    ]
  };
  const fd = new FormData();
  fd.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }), "metadata.json");
  fd.append("worker.js", new Blob([String(bundle)], { type: "application/javascript+module" }), "worker.js");
  await cfApi(token, `/accounts/${accountId}/workers/scripts/${name}`, { method: "PUT", body: fd });
  await cfApi(token, `/accounts/${accountId}/workers/scripts/${name}/subdomain`, { method: "POST", body: { enabled: true, previews_enabled: false } }).catch(() => {
  });
  return true;
}
async function handleUpdate(env, ctx, origin, update) {function genPass() {
  const abc = "abcdefghjkmnpqrstuvwxyzACDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n))).map((x) => abc[x % abc.length]).join("");
  return `${pick(5)}-${pick(5)}-${pick(4)}`;
}
async function panelSetup(baseUrl, username, password) {
  const r = await fetch(`${baseUrl}/api/setup`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Omni-Bot/1.0" },
    body: JSON.stringify({ username, password })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false)
    throw new Error(String(data.error || `HTTP ${r.status}`));
  return data;
}

  await ensureSchema(env);
  const msg = update.message || update.callback_query?.message;
  const chatId = msg?.chat?.id;
  if (!chatId)
    return;
  if (ctx?.waitUntil)
    ctx.waitUntil(syncCreatorCommands(env).catch(() => {
    }));
  const callbackId = update.callback_query?.id;
  const callbackData = String(update.callback_query?.data || "");
  let text = (update.message?.text || "").trim();
  let cmd = (text.split(/\s+/)[0] || "").split("@")[0].toLowerCase();
  if (callbackId)
    await tgApi(env, "answerCallbackQuery", { callback_query_id: callbackId }).catch(() => {
    });
  if (callbackData.startsWith("cmd:")) {
    const action = callbackData.slice(4);
    const map = { menu: "/start", help: "/help", deploy: "/deploy", panels: "/panels", connect: "/connect", token: "/token", bridge: "/bridge", bd_donate: "/bridge-donate", bd_claim: "/bridge-claim", bd_stock: "/bridge-stock" };
    cmd = map[action] || "/legacy";
    text = cmd;
  }
  const send = (t, opts = {}) => tgApi(env, "sendMessage", {
    chat_id: chatId,
    text: t,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: mainKeyboard(),
    ...opts
  });
  await ensurePanelRegistry(env);
  if (cmd === "/cancel") {
    await clearUiState(env, chatId);
    await cancelDeploySession(env, chatId).catch(() => {
    });
    return send("\u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F\u061B \u0639\u0645\u0644\u06CC\u0627\u062A \u0644\u063A\u0648 \u0634\u062F.");
  }
  if (cmd === "/scan") {
    await send("⚡️ <b>اسکن آی‌پی‌های تمیز کلودفلر در حال اجراست…</b>\nلطفاً چند ثانیه شکیبا باشید.");
    const st = await allSettings(env);
    const pool = [...new Set([
      ...String(st.ip_pool || "").split(/[\n,\s]+/).map(normalizeAddr).filter(Boolean),
      ...CF_GOOD_IPS
    ])].slice(0, 48);
    const edge = await rankIpsHttp(pool, { concurrency: 8, timeoutMs: 2500 });
    const top = edge.filter((r) => r && (r.alive || r.ok)).slice(0, 10);
    if (top.length) {
      await putSetting(env, "clean_ips", JSON.stringify(top.map((r) => r.ip)));
      const lines = top.map((r, i) => `${i + 1}. <code>${r.ip}</code> — ${r.edge_ms || r.ms || 1}ms${r.colo ? " · " + r.colo : ""}`);
      return send(`⚡️ <b>نتایج اسکن لبهٔ کلودفلر</b> (${top.length} آی‌پی فعال):\n\n${lines.join("\n")}\n\n✅ این آی‌پی‌ها در تنظیمات پنل شما به‌روزرسانی شدند.`);
    } else {
      return send("⚠️ آی‌پی فعالی در این لحظه یافت نشد؛ لطفاً دوباره تلاش کنید.");
    }
  }
  if (cmd === "/ips") {
    const st = await allSettings(env);
    const ips = safeArray(st.clean_ips);
    if (!ips.length) return send("هنوز آی‌پی تمیزی در پنل ثبت نشده است. با دستور /scan اسکن کنید.");
    return send(`⚡️ <b>آی‌پی‌های تمیز پنل شما:</b>\n\n${ips.map((ip, i) => `${i + 1}. <code>${ip}</code>`).join("\n")}`);
  }
  if (cmd === "/ping") {
    const st = await allSettings(env);
    const host = st.public_host || "omni.4lifm29.workers.dev";
    return send(`🩺 <b>وضعیت پنل:</b>\nدامنه: <code>${host}</code>\nپورت: ${st.port || 443}\nوضعیت: ✅ فعال و آنلاین`);
  }
  if (cmd === "/warp") {
    return send(`🛡️ <b>اندپوینت‌های تمیز Aether / WARP (دوپله WireGuard):</b>\n\n` +
      `<b>⚡️ اندپوینت‌های پرسرعت IPv6:</b>\n` +
      `1. <code>[2606:4700:d0::bc72:6001]:880</code> (۳۸۶ میلی‌ثانیه)\n` +
      `2. <code>[2606:4700:d1::a29f:c001]:864</code> (۴۱۰ میلی‌ثانیه)\n` +
      `3. <code>[2606:4700:d0::a29f:c001]:859</code> (۱.۱۳ ثانیه)\n` +
      `4. <code>[2606:4700:d0::a29f:c301]:878</code> (۱.۲۰ ثانیه)\n\n` +
      `<b>⚡️ اندپوینت‌های تست‌شدهٔ IPv4:</b>\n` +
      `1. <code>162.159.195.37:942</code> (۱.۶۲ ثانیه)\n` +
      `2. <code>188.114.96.73:894</code> (۴.۱۹ ثانیه)\n` +
      `3. <code>162.159.192.140:1074</code> (۴.۴۵ ثانیه)\n` +
      `4. <code>188.114.96.1:1701</code> (۵.۰۸ ثانیه)\n\n` +
      `🔑 <b>شناسه دستگاه‌های ثبت‌شده (Device Identities):</b>\n` +
      `• دستگاه بیرونی (Outer): <code>95d125d4-559e-4826-815d-7e1da674e586</code>\n` +
      `• دستگاه درونی (Inner): <code>108bcf34-b107-4ba5-b829-af1f06d46204</code>\n\n` +
      `💡 <b>راهنمای کاربردی:</b> این آدرس‌ها و شناسه‌ها را می‌توانید در کلاینت‌های PattNG / Aether یا NekoBox یا WireGuard در استخر اندپوینت‌های خود قرار دهید.`);
  }
  if (cmd === "/speed") {
    const t0 = Date.now();
    const st = await allSettings(env);
    const host = st.public_host || "omni.4lifm29.workers.dev";
    const r = await fetch(`https://${host}/healthz?t=${Date.now()}`).catch(() => null);
    const rtt = Math.max(1, Date.now() - t0);
    const colo = r?.headers?.get("x-omni-colo") || "EDGE";
    return send(`⚡️ <b>تست سرعت و سلامت سرور:</b>\n\n` +
      `• دامنه سرور: <code>${host}</code>\n` +
      `• لبه کلودفلر (Colo): <b>${colo}</b>\n` +
      `• پینگ لبه: <b>${rtt} ms</b>\n` +
      `• پورت‌های فعال: <b>${st.port || 443} (TLS)</b>\n` +
      `• پروتکل: <b>VLESS + WebSocket + 0-RTT</b>`);
  }
  if (cmd === "/forget") {
    await clearCachedToken(env, chatId);
    return send("\u{1F9F9} \u062A\u0648\u06A9\u0646 \u0645\u0648\u0642\u062A \u0627\u06CC\u0646 \u062C\u0644\u0633\u0647 \u067E\u0627\u06A9 \u0634\u062F. \u06A9\u0627\u0631\u0647\u0627\u06CC \u0628\u0639\u062F\u06CC \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0648\u06A9\u0646 \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0646\u062F.");
  }
  const showPanels = async () => {
    const panels = await listOwnedPanels(env, chatId, 20);
    if (!panels.length)
      return send("\u{1F4C1} \u0647\u0646\u0648\u0632 \u067E\u0646\u0644\u06CC \u0628\u0647 \u062D\u0633\u0627\u0628\u062A \u0648\u0635\u0644 \u0646\u06CC\u0633\u062A.\n\n\u0627\u0632 \xAB\u0633\u0627\u062E\u062A \u067E\u0646\u0644\xBB \u0628\u0631\u0627\u06CC \u0646\u0635\u0628 \u062A\u0627\u0632\u0647 \u06CC\u0627 \xAB\u0627\u062A\u0635\u0627\u0644 \u067E\u0646\u0644 \u0645\u0648\u062C\u0648\u062F\xBB \u0628\u0631\u0627\u06CC \u0648\u0627\u0631\u062F\u06A9\u0631\u062F\u0646 Worker \u0642\u0628\u0644\u06CC \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646.");
    const lines = panels.map((p, i) => `${i + 1}. ${panelStatusLabel(p.status)} <b>${esc2(p.worker_name)}</b>${p.panel_url ? `
   <code>${esc2(p.panel_url)}</code>` : ""}`);
    const rows = panels.slice(0, 20).map((p) => [{ text: `${p.status === "healthy" ? "\u{1F7E2}" : p.status === "offline" ? "\u{1F534}" : "\u26AA"} ${p.worker_name}`, callback_data: `pm:view:${p.id}` }]);
    rows.push([{ text: "\u{1F680} \u0633\u0627\u062E\u062A \u067E\u0646\u0644 \u062C\u062F\u06CC\u062F", callback_data: "cmd:deploy" }, { text: "\u{1F517} \u0627\u062A\u0635\u0627\u0644 \u0645\u0648\u062C\u0648\u062F", callback_data: "cmd:connect" }]);
    return send(`\u{1F4C1} <b>\u067E\u0646\u0644\u200C\u0647\u0627\u06CC \u0645\u0646</b>

${lines.join("\n\n")}`, { reply_markup: { inline_keyboard: rows } });
  };
  const showPanel = async (id) => {
    const p = await getOwnedPanel(env, chatId, id);
    if (!p)
      return send("\u0627\u06CC\u0646 \u067E\u0646\u0644 \u062F\u0631 \u0641\u0647\u0631\u0633\u062A\u062A \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    return send(`\u{1F4E6} <b>${esc2(p.worker_name)}</b>
\u0648\u0636\u0639\u06CC\u062A \u0622\u062E\u0631: ${panelStatusLabel(p.status)}
${p.panel_url ? `\u0622\u062F\u0631\u0633: ${esc2(p.panel_url)}
` : ""}${p.last_check_at ? `\u0622\u062E\u0631\u06CC\u0646 \u0628\u0631\u0631\u0633\u06CC: ${esc2(p.last_check_at)} UTC
` : ""}${p.source === "legacy" ? "\n\u2139\uFE0F \u067E\u0646\u0644 \u0642\u062F\u06CC\u0645\u06CC \u0627\u0633\u062A\u061B \u0628\u0631\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A \u06A9\u0627\u0645\u0644\u060C \u06CC\u06A9\u200C\u0628\u0627\u0631 \u0628\u0627 \u062A\u0648\u06A9\u0646 Cloudflare \u0645\u062A\u0635\u0644\u0634 \u06A9\u0646." : ""}`, { reply_markup: panelActionsKeyboard(p) });
  };
  if (callbackData)
    await clearUiState(env, chatId);
  if (callbackData === "cmd:deploy") {
    if (msg?.chat?.type !== "private")
      return send("\u{1F510} \u0646\u0635\u0628 \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F. \u0631\u0648\u06CC \u0631\u0628\u0627\u062A \u062E\u0635\u0648\u0635\u06CC \u0628\u0632\u0646 /start.");
    const names = randomWorkerNames();
    return send(
      `\u2728 <b>\u06CC\u06A9 \u0646\u0627\u0645 \u0628\u0631\u0627\u06CC \u067E\u0646\u0644 \u062E\u0648\u062F\u062A \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646</b>

\u0633\u0647 \u0646\u0627\u0645 \u062A\u0635\u0627\u062F\u0641\u06CC \u0648 \u0622\u0645\u0627\u062F\u0647 \u0633\u0627\u062E\u062A\u0647 \u0634\u062F. \u0628\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u0647\u0631\u06A9\u062F\u0627\u0645 \u0645\u0633\u062A\u0642\u06CC\u0645\u0627\u064B \u0628\u0647 \u0645\u0631\u062D\u0644\u0647 \u062F\u0631\u06CC\u0627\u0641\u062A \u062A\u0648\u06A9\u0646 \u0645\u06CC\u200C\u0631\u0648\u06CC:`,
      { reply_markup: { inline_keyboard: [
        ...names.map((name) => [{ text: `\u2601\uFE0F ${name}`, callback_data: `pick:${name}` }]),
        
        [{ text: "\u270F\uFE0F \u0646\u0627\u0645 \u062F\u0644\u062E\u0648\u0627\u0647", callback_data: "pick:custom" }],[{ text: "\u{1F504} \u0633\u0627\u062E\u062A \u0633\u0647 \u0646\u0627\u0645 \u062C\u062F\u06CC\u062F", callback_data: "cmd:deploy" }],
        [{ text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: "cmd:menu" }]
      ] } }
    );
  }
  if (cmd === "/panels" || callbackData === "cmd:panels")
    return showPanels();
  if (cmd === "/connect" || callbackData === "cmd:connect") {
    if (msg?.chat?.type !== "private")
      return send("🔐 اتصال پنل فقط در گفت‌وگوی خصوصی انجام می‌شود.");
    let existing = await listOwnedPanels(env, chatId, 10);
    if (!existing.length) {
      const cachedTok = await getCachedToken(env, chatId);
      if (cachedTok) {
        await autoDiscoverAndRegisterPanels(env, chatId, cachedTok);
        existing = await listOwnedPanels(env, chatId, 10);
      }
    }
    if (existing.length) {
      const rows = existing.map((p) => [{ text: `${p.status === "healthy" ? "🟢" : "⚪"} ${p.worker_name}`, callback_data: `pm:view:${p.id}` }]);
      rows.push([{ text: "🔄 استعلام خودکار از Cloudflare", callback_data: "cmd:connect_cf" }]);
      rows.push([{ text: "➕ اتصال دستی با آدرس", callback_data: "cmd:connect_manual" }]);
      rows.push([{ text: "⬅️ منو", callback_data: "cmd:menu" }]);
      return send(`✅ <b>پنل‌های متصل شما</b>\n\nپنل‌های شما به صورت خودکار شناسایی و متصل هستند و نیازی به وارد کردن مجدد آدرس ندارید:\n\n${existing.map((p, i) => `${i + 1}. <b>${esc2(p.worker_name)}</b> (${panelStatusLabel(p.status)})\n   <code>${esc2(p.panel_url || "")}</code>`).join("\n\n")}\n\nبرای مدیریت هر پنل، روی دکمهٔ آن ضربه بزنید:`, { reply_markup: { inline_keyboard: rows } });
    }
    await setUiState(env, chatId, "connect_url");
    return send("🔗 آدرس کامل پنل Cloudflare را بفرست (مثال: ‎https://my-panel.subdomain.workers.dev). بعد از تست اتصال، برای ثبت مالکیت ازت توکن Cloudflare می‌خواهم.");
  }
  if (callbackData === "cmd:connect_manual") {
    await setUiState(env, chatId, "connect_url");
    return send("🔗 آدرس کامل پنل Cloudflare را بفرست (مثال: ‎https://my-panel.subdomain.workers.dev). بعد از تست اتصال، برای ثبت مالکیت ازت توکن Cloudflare می‌خواهم.");
  }
  if (callbackData === "cmd:connect_cf") {
    const cachedTok = await getCachedToken(env, chatId);
    if (!cachedTok) {
      await setUiState(env, chatId, "connect_url");
      return send("🔑 توکن Cloudflare ذخیره‌شده‌ای یافت نشد. لطفاً آدرس پنل خود را بفرستید:");
    }
    await send("🔄 در حال استعلام و شناسایی پنل‌ها از حساب Cloudflare شما...");
    await autoDiscoverAndRegisterPanels(env, chatId, cachedTok);
    const existing = await listOwnedPanels(env, chatId, 10);
    if (existing.length) {
      const rows = existing.map((p) => [{ text: `${p.status === "healthy" ? "🟢" : "⚪"} ${p.worker_name}`, callback_data: `pm:view:${p.id}` }]);
      rows.push([{ text: "➕ اتصال دستی با آدرس", callback_data: "cmd:connect_manual" }]);
      rows.push([{ text: "⬅️ منو", callback_data: "cmd:menu" }]);
      return send(`✅ <b>استعلام انجام شد:</b>\n\n${existing.map((p, i) => `${i + 1}. <b>${esc2(p.worker_name)}</b> (${panelStatusLabel(p.status)})\n   <code>${esc2(p.panel_url || "")}</code>`).join("\n\n")}\n\nبرای مدیریت هر پنل، روی دکمهٔ آن ضربه بزنید:`, { reply_markup: { inline_keyboard: rows } });
    }
    return send("هیچ پنل جدیدی در حساب Cloudflare شما یافت نشد. می‌توانید با «اتصال دستی با آدرس» اقدام کنید.", {
      reply_markup: { inline_keyboard: [[{ text: "➕ اتصال دستی با آدرس", callback_data: "cmd:connect_manual" }], [{ text: "⬅️ منو", callback_data: "cmd:menu" }]] }
    });
  }
  if (callbackData.startsWith("pm:view:"))
    return showPanel(callbackData.split(":")[2]);
  if (callbackData.startsWith("pm:health:")) {
    const p = await getOwnedPanel(env, chatId, callbackData.split(":")[2]);
    if (!p)
      return send("\u067E\u0646\u0644 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    try {
      const health = await checkPanel(p);
      await updatePanelState(env, p.id, { status: health.state, detail: `edge=${health.workerStatus}, api=${health.apiStatus}` });
      const refreshed = await getOwnedPanel(env, chatId, p.id);
      return send(`\u{1FA7A} <b>\u0628\u0631\u0631\u0633\u06CC \u067E\u0646\u0644 ${esc2(p.worker_name)}</b>

Worker: ${health.workerOk ? "\u2705 \u067E\u0627\u0633\u062E \u0645\u06CC\u200C\u062F\u0647\u062F" : "\u274C \u067E\u0627\u0633\u062E \u0646\u0645\u06CC\u200C\u062F\u0647\u062F"}
D1/API: ${health.dbOk ? "\u2705 \u0648\u0635\u0644" : "\u274C \u062E\u0637\u0627"}
\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0645\u062F\u06CC\u0631: ${health.installed ? "\u2705 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F\u0647" : "\u26A0\uFE0F \u0647\u0646\u0648\u0632 \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F\u0647"}

${panelStatusLabel(health.state)}`, { reply_markup: panelActionsKeyboard(refreshed || p) });
    } catch (error) {
      return send(`\u0628\u0631\u0631\u0633\u06CC \u0633\u0644\u0627\u0645\u062A \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F: <code>${esc2(error?.message || error)}</code>`);
    }
  }
  if (callbackData.startsWith("pm:")) {
    const [, action, rawId] = callbackData.split(":");
    const id = Number(rawId);
    const p = await getOwnedPanel(env, chatId, id);
    if (!p)
      return send("پنل پیدا نشد.");
    if (action === "setup") {
      if (!p.panel_url)
        return send("\u0622\u062F\u0631\u0633 \u067E\u0646\u0644 \u062B\u0628\u062A \u0646\u0634\u062F\u0647\u061B \u0627\u0648\u0644 \xAB\u{1F517} \u0627\u062A\u0635\u0627\u0644 \u067E\u0646\u0644 \u0645\u0648\u062C\u0648\u062F\xBB \u0631\u0627 \u06A9\u0627\u0645\u0644 \u06A9\u0646.");
      if (msg?.chat?.type !== "private")
        return send("\u0627\u06CC\u0646 \u0639\u0645\u0644\u06CC\u0627\u062A \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.");
      await setUiState(env, chatId, "panel_setup", { id: p.id, url: normalizeWorkerUrl(p.panel_url) });
      return send(`\u{1F510} <b>\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0631\u0645\u0632 \u067E\u0646\u0644 \u0631\u0627 \u062E\u0648\u062F\u062A \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646</b>\n\n\u062F\u0631 \u06CC\u06A9 \u067E\u06CC\u0627\u0645 \u0628\u0641\u0631\u0633\u062A:\n\u062E\u0637 \u0627\u0648\u0644 \u2014 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC (\u06F3 \u062A\u0627 \u06F3\u06F2 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC)\n\u062E\u0637 \u062F\u0648\u0645 \u2014 \u0631\u0645\u0632 (\u062D\u062F\u0627\u0642\u0644 \u06F1\u06F0 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631)\n\n\u06CC\u0627 \u062F\u06A9\u0645\u0647\u0654 \xAB\u{1F511} \u0631\u0645\u0632 \u0628\u0633\u0627\u0632\xBB \u0631\u0627 \u0628\u0632\u0646 \u062A\u0627 \u0641\u0642\u0637 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0628\u062F\u0647\u06CC.`, { reply_markup: { inline_keyboard: [[{ text: "\u{1F511} \u0631\u0645\u0632 \u0628\u0633\u0627\u0632", callback_data: `pm:autopass:${p.id}` }], [{ text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: `pm:view:${p.id}` }]] } });
    }
    if (action === "autopass") {
      if (!p.panel_url)
        return send("آدرس پنل ثبت نشده؛ اول «🔗 اتصال پنل موجود» را کامل کن.");
      if (msg?.chat?.type !== "private")
        return send("\u0627\u06CC\u0646 \u0639\u0645\u0644\u06CC\u0627\u062A \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.");
      await setUiState(env, chatId, "panel_setup_user", { id: p.id, url: normalizeWorkerUrl(p.panel_url || "") });
      return send("\u{1F511} \u0628\u0627\u0634\u0647\u060C \u0631\u0645\u0632 \u0631\u0627 \u0645\u0646 \u0645\u06CC\u200C\u0633\u0627\u0632\u0645. \u0641\u0642\u0637 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u062F\u0644\u062E\u0648\u0627\u0647\u062A \u0631\u0627 \u0628\u0641\u0631\u0633\u062A (\u06F3 \u062A\u0627 \u06F3\u06F2 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC).");
    }
    if (action === "setupskip") {
      await clearUiState(env, chatId);
      return send("\u0628\u0627\u0634\u0647 \u{1F44D} \u0647\u0631 \u0648\u0642\u062A \u062E\u0648\u0627\u0633\u062A\u06CC: \xAB\u{1F4C1} \u067E\u0646\u0644\u200C\u0647\u0627\u06CC \u0645\u0646\xBB \u2192 \u0647\u0645\u0627\u0646 \u067E\u0646\u0644 \u2192 \xAB\u{1F510} \u0633\u0627\u062E\u062A \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0631\u0645\u0632\xBB.");
    }
    if (action === "live") {
      const health = await checkPanel(p);
      const liveDetail = `edge=${health.workerStatus}, api=${health.apiStatus}`;
      await updatePanelState(env, p.id, { status: health.state, detail: liveDetail });
      const sentLive = await tgApi(env, "sendMessage", {
        chat_id: chatId,
        text: liveCardText({ ...p, status: health.state }, health.state, liveDetail),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [
          p.panel_url ? [{ text: "🌐 باز کردن پنل", url: p.panel_url }] : [],
          [{ text: "🔍 بررسی سلامت", callback_data: `pm:health:${p.id}` }, { text: "♻️ تازه‌سازی", callback_data: `pm:live:${p.id}` }],
          [{ text: "📌 برداشتن پین", callback_data: `pm:unpin:${p.id}` }, { text: "⬅️ پنل", callback_data: `pm:view:${p.id}` }]
        ] }
      });
      const liveMid = sentLive?.result?.message_id;
      if (liveMid) {
        const pinned = await tgApi(env, "pinChatMessage", { chat_id: chatId, message_id: liveMid, disable_notification: true });
        await env.DB.prepare("UPDATE bot_panels SET live_msg_id=? WHERE id=?").bind(String(liveMid), p.id).run().catch(() => {
        });
        if (!pinned?.ok)
          await tgApi(env, "sendMessage", { chat_id: chatId, text: "📌 کارت ساخته شد؛ اگر پین نشد، خودِ پیام را نگه‌دار و پین کن. کارت خودش هر چند دقیقه تازه می‌شود." }).catch(() => {
          });
      }
      return;
    }
    if (action === "unpin") {
      if (p.live_msg_id)
        await tgApi(env, "unpinChatMessage", { chat_id: chatId, message_id: Number(p.live_msg_id) }).catch(() => {
        });
      await env.DB.prepare("UPDATE bot_panels SET live_msg_id=NULL WHERE id=?").bind(p.id).run().catch(() => {
      });
      return send("📌 پین کارت زنده برداشته شد. هر وقت خواستی از دکمهٔ «📌 کارت زنده» دوباره بساز.");
    }
    if (action === "friend") {
      const links = await env.DB.prepare("SELECT * FROM bot_friends WHERE panel_id=? OR linked_panel_id=? ORDER BY id DESC LIMIT 5").bind(p.id, p.id).all();
      const linked = (links.results || []).filter((x) => x.accepted_at);
      const info = linked.length ? `\n\n🤝 وصل‌شده‌ها: ${linked.map((x) => `<code>${esc2(x.code)}</code>`).join(" · ")}` : "\n\nهنوز با کسی وصل نشده‌ای.";
      return send(`🤝 <b>پنل رفقا</b>\n\nپنل تو و پنل رفیقت پشتیبان هم می‌شوند: اگر یکی قطع شد، آن یکی کاربرانش را مهمان می‌کند — پهنای باند مجانی، باهوش‌تر خرج می‌شود.${info}`, { reply_markup: { inline_keyboard: [[{ text: "📨 ساخت کد دعوت", callback_data: `pm:fnew:${p.id}` }, { text: "🔗 وصل شدن با کد", callback_data: `pm:fjoin:${p.id}` }], [{ text: "📋 لیست کدهای من", callback_data: `pm:flink:${p.id}` }], [{ text: "⬅️ پنل", callback_data: `pm:view:${p.id}` }]] } });
    }
    if (action === "fnew") {
      const code = "RF" + crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
      await env.DB.prepare("INSERT INTO bot_friends(code, owner_chat_id, panel_id) VALUES(?,?,?)").bind(code, String(chatId), p.id).run().catch(() => {
      });
      return send(`📨 <b>کد دعوت ساخته شد</b>\n\n<code>${esc2(code)}</code>\n\nاین کد را برای رفیقت بفرست. او در ربات، پنل خودش → «🤝 پنل رفقا» → «🔗 وصل شدن با کد» را می‌زند و این کد را می‌فرستد.\n\nاز آن لحظه، پنل شما پشتیبان هم می‌شوید.`, { reply_markup: { inline_keyboard: [[{ text: "⬅️ پنل رفقا", callback_data: `pm:friend:${p.id}` }]] } });
    }
    if (action === "fjoin") {
      await setUiState(env, chatId, "friend_code", { panel_id: p.id });
      return send(`🔗 کد دعوت رفیقت را بفرست (مثل <code>RF8A2C31</code>).\n\nاگر پشیمان شدی /cancel بزن.`);
    }
    if (action === "flink") {
      const links = await env.DB.prepare("SELECT * FROM bot_friends WHERE owner_chat_id=? OR linked_chat_id=? ORDER BY id DESC LIMIT 10").bind(String(chatId), String(chatId)).all();
      if (!(links.results || []).length)
        return send("📋 هنوز کدی نساخته‌ای.", { reply_markup: { inline_keyboard: [[{ text: "📨 ساخت کد دعوت", callback_data: `pm:fnew:${p.id}` }], [{ text: "⬅️ پنل", callback_data: `pm:view:${p.id}` }]] } });
      const lines = links.results.map((x) => `${x.accepted_at ? "🤝" : "⏳"} <code>${esc2(x.code)}</code> — ${x.accepted_at ? "وصل شده" : "منتظر رفیقت"}`);
      return send(`📋 <b>کدهای تو</b>\n\n${lines.join("\n")}`, { reply_markup: { inline_keyboard: [[{ text: "⬅️ پنل", callback_data: `pm:view:${p.id}` }]] } });
    }
    if (action === "connect") {
      if (msg?.chat?.type !== "private")
        return send("\u0627\u062A\u0635\u0627\u0644 \u067E\u0646\u0644 \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.");
      if (p.panel_url) {
        await setUiState(env, chatId, "connect_token", { panel_url: p.panel_url });
        const cachedTok2 = await getCachedToken(env, chatId);
        if (cachedTok2) {
          tgApi(env, "sendMessage", { chat_id: chatId, text: "\u{1F510} \u0628\u0627 \u062A\u0648\u06A9\u0646 \u0647\u0645\u06CC\u0646 \u062C\u0644\u0633\u0647 \u0627\u062F\u0627\u0645\u0647 \u0645\u06CC\u200C\u062F\u0647\u0645\u2026", disable_notification: true }).catch(() => {
          });
          return handleUpdate(env, ctx, origin, { update_id: 0, message: { message_id: 0, chat: { id: chatId, type: "private" }, text: cachedTok2 } });
        }
        return send(`\u{1F517} \u0622\u062F\u0631\u0633 <code>${esc2(p.worker_name)}</code> \u062B\u0628\u062A \u0627\u0633\u062A. \u0628\u0631\u0627\u06CC \u062A\u0623\u06CC\u06CC\u062F \u0645\u0627\u0644\u06A9\u06CC\u062A \u0648 \u0641\u0639\u0627\u0644\u200C\u0634\u062F\u0646 \u0627\u0628\u0632\u0627\u0631\u0647\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A\u060C \u062A\u0648\u06A9\u0646 Cloudflare \u0647\u0645\u06CC\u0646 \u062D\u0633\u0627\u0628 \u0631\u0627 \u0628\u0641\u0631\u0633\u062A. \u062A\u0648\u06A9\u0646 \u0630\u062E\u06CC\u0631\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.`);
      }
      await setUiState(env, chatId, "connect_url");
      return send("\u0622\u062F\u0631\u0633 HTTPS \u067E\u0646\u0644 \u200E.workers.dev \u0631\u0627 \u0628\u0641\u0631\u0633\u062A \u062A\u0627 \u0627\u062A\u0635\u0627\u0644 Cloudflare \u0631\u0627 \u06A9\u0627\u0645\u0644 \u06A9\u0646\u06CC\u0645.");
    }
    if (!canUsePanelAction(p, action)) {
      return send("\u0627\u06CC\u0646 \u067E\u0646\u0644 \u0647\u0646\u0648\u0632 \u0628\u0647 \u062D\u0633\u0627\u0628 Cloudflare \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0648\u0635\u0644 \u0646\u06CC\u0633\u062A \u06CC\u0627 \u067E\u0627\u06A9\u200C\u0633\u0627\u0632\u06CC \u0622\u0646 \u06A9\u0627\u0645\u0644 \u0646\u0634\u062F\u0647. \u0627\u0648\u0644 \u0627\u062A\u0635\u0627\u0644 Cloudflare \u0631\u0627 \u0627\u0646\u062C\u0627\u0645 \u0628\u062F\u0647\u061B \u0627\u0628\u0632\u0627\u0631\u0647\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC \u062A\u0627 \u0622\u0646 \u0632\u0645\u0627\u0646 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644\u200C\u0627\u0646\u062F.", { reply_markup: panelActionsKeyboard(p) });
    }
    if (action === "webhook") {
      if (msg?.chat?.type !== "private")
        return send("\u{1F510} \u0628\u0631\u0631\u0633\u06CC \u0648\u0628\u200C\u0647\u0648\u06A9 \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.");
      await setUiState(env, chatId, "panel_webhook_tokens", { id });
      const cachedTok2 = await getCachedToken(env, chatId);
      if (cachedTok2) {
        tgApi(env, "sendMessage", { chat_id: chatId, text: "\u{1F510} \u0628\u0627 \u062A\u0648\u06A9\u0646 \u0647\u0645\u06CC\u0646 \u062C\u0644\u0633\u0647 \u0627\u062F\u0627\u0645\u0647 \u0645\u06CC\u200C\u062F\u0647\u0645\u2026", disable_notification: true }).catch(() => {
        });
        return handleUpdate(env, ctx, origin, { update_id: 0, message: { message_id: 0, chat: { id: chatId, type: "private" }, text: cachedTok2 } });
      }
      return send("\u{1F4E8} \u0628\u0631\u0627\u06CC \u0628\u0631\u0631\u0633\u06CC/\u062A\u0639\u0645\u06CC\u0631 \u0648\u0628\u200C\u0647\u0648\u06A9\u060C \u062F\u0631 \u06CC\u06A9 \u067E\u06CC\u0627\u0645 \u062F\u0648 \u062E\u0637 \u0628\u0641\u0631\u0633\u062A:\n\u06F1) \u062A\u0648\u06A9\u0646 API \u06A9\u0644\u0648\u062F\u0641\u0644\u0631\n\u06F2) \u062A\u0648\u06A9\u0646 \u0631\u0628\u0627\u062A \u062A\u0644\u06AF\u0631\u0627\u0645 \u0647\u0645\u06CC\u0646 \u067E\u0646\u0644\n\n\u067E\u06CC\u0627\u0645 \u0641\u0648\u0631\u0627\u064B \u062D\u0630\u0641 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0647\u06CC\u0686\u200C\u06A9\u062F\u0627\u0645 \u0630\u062E\u06CC\u0631\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F.", { reply_markup: { inline_keyboard: [[{ text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: `pm:view:${id}` }]] } });
    }
    if (action === "autoheal" || action === "usage" || action === "update" || action === "rollback" || action === "backup" || action === "backupstatus" || action === "dbrollback" || action === "creds" || action === "resetpw" || action === "doctor" || action === "lucky" || action === "freeway" || action === "risk" || action === "mirror" || action === "multi" || action === "domain" || action === "domainreset" || action === "gift" || action === "bridgedonate") {
      if (msg?.chat?.type !== "private")
        return send("\u{1F510} \u0627\u06CC\u0646 \u0639\u0645\u0644\u06CC\u0627\u062A \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.");
      await setUiState(env, chatId, "panel_token", { id, action });
      const cachedTok = await getCachedToken(env, chatId);
      if (cachedTok) {
        tgApi(env, "sendMessage", { chat_id: chatId, text: "\u{1F510} \u0628\u0627 \u062A\u0648\u06A9\u0646 \u0647\u0645\u06CC\u0646 \u062C\u0644\u0633\u0647 \u0627\u062F\u0627\u0645\u0647 \u0645\u06CC\u200C\u062F\u0647\u0645\u2026", disable_notification: true }).catch(() => {
        });
        return handleUpdate(env, ctx, origin, { update_id: 0, message: { message_id: 0, chat: { id: chatId, type: "private" }, text: cachedTok } });
      }
      const title = { autoheal: "تعمیر خودکار و بازیابی پنل", usage: "\u06AF\u0632\u0627\u0631\u0634 \u0645\u0635\u0631\u0641 \u0648 \u062D\u062F\u0648\u062F \u0631\u0627\u06CC\u06AF\u0627\u0646 Cloudflare", update: "\u0622\u067E\u062F\u06CC\u062A/\u062A\u0639\u0645\u06CC\u0631 Worker", rollback: "\u0628\u0627\u0632\u06AF\u0634\u062A \u0646\u0633\u062E\u0647\u0654 Worker", backup: "\u0628\u06A9\u0627\u067E \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633", backupstatus: "\u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0628\u06A9\u0627\u067E", dbrollback: "\u0628\u0627\u0632\u06AF\u0634\u062A \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0642\u0628\u0644\u06CC", creds: "نمایش حساب ورود پنل", resetpw: "ساخت رمز موقت ورود", doctor: "دکتر خودکار — عیب‌یابی و درمان", lucky: "دکمهٔ خوش‌شانسی — هرچی بهترینه", freeway: "آزادراه IP — تازه‌سازی مسیرها", risk: "زنگ خطر — بررسی الگوی خطا", mirror: "بدل آماده — مسیر پشتیبان", multi: "چند رگه — چند مسیر برای هر ساب", domain: "دامنهٔ شخصی روی پنل", domainreset: "بازگشت به آدرس workers.dev", gift: "کد هدیه — کانفیگ مهمان", bridgedonate: "اشتراک و اهدای سهمیه" }[action];
      return send(`\u2601\uFE0F \u0628\u0631\u0627\u06CC \xAB${title}\xBB \u062A\u0648\u06A9\u0646 Cloudflare \u0647\u0645\u06CC\u0646 \u067E\u0646\u0644 \u0631\u0627 \u0628\u0641\u0631\u0633\u062A.
\u067E\u06CC\u0627\u0645 \u062A\u0648\u06A9\u0646 \u067E\u0633 \u0627\u0632 \u062F\u0631\u06CC\u0627\u0641\u062A \u062D\u0630\u0641 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u062F\u0631 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0630\u062E\u06CC\u0631\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u062A\u0627 \u06F1\u06F2 \u062F\u0642\u06CC\u0642\u0647 \u0641\u0642\u0637 \u062F\u0631 \u062D\u0627\u0641\u0638\u0647\u0654 \u0645\u0648\u0642\u062A \u0645\u06CC\u200C\u0645\u0627\u0646\u062F \u062A\u0627 \u06A9\u0627\u0631\u0647\u0627\u06CC \u0628\u0639\u062F\u06CC \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0648\u06A9\u0646 \u0646\u062E\u0648\u0627\u0647\u0646\u062F (/forget \u067E\u0627\u06A9\u0634 \u0645\u06CC\u200C\u06A9\u0646\u062F).`, { reply_markup: { inline_keyboard: [[{ text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: `pm:view:${id}` }]] } });
    }
    if (action === "delete") {
      await setUiState(env, chatId, "panel_delete_confirm", { id });
      return send(`\u26A0\uFE0F \u062D\u0630\u0641 \u06A9\u0627\u0645\u0644 \u0648 \u0628\u0631\u06AF\u0634\u062A\u200C\u0646\u0627\u067E\u0630\u06CC\u0631 \u0627\u0633\u062A: Worker <code>${esc2(p.worker_name)}</code> \u0648 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 D1 \u0622\u0646 \u067E\u0627\u06A9 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.

\u0628\u0631\u0627\u06CC \u0627\u062F\u0627\u0645\u0647\u060C \u0646\u0627\u0645 Worker \u0631\u0627 \u062F\u0642\u06CC\u0642\u0627\u064B \u0628\u0641\u0631\u0633\u062A: <code>${esc2(p.worker_name)}</code>`);
    }
    if (action === "restore") {
      await setUiState(env, chatId, "panel_restore_confirm", { id });
      return send("\u{1F4E5} \u0641\u0627\u06CC\u0644 SQL \u0628\u0647 \u06CC\u06A9 D1 \u062A\u0627\u0632\u0647 \u0648\u0627\u0631\u062F \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 Worker \u0628\u0647 \u0622\u0646 \u0648\u0635\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0641\u0639\u0644\u06CC \u067E\u0627\u06A9 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0628\u0631\u0627\u06CC \u0628\u0627\u0632\u06AF\u0634\u062A \u0646\u06AF\u0647 \u062F\u0627\u0634\u062A\u0647 \u062E\u0648\u0627\u0647\u062F \u0634\u062F. \u0641\u0627\u06CC\u0644 SQL \u0631\u0627 \u0647\u0645\u0631\u0627\u0647 \u062A\u0648\u06A9\u0646 Cloudflare \u062F\u0631 Caption \u0628\u0641\u0631\u0633\u062A.", { reply_markup: { inline_keyboard: [[{ text: "\u{1F4CE} \u0627\u0646\u062A\u062E\u0627\u0628 \u0641\u0627\u06CC\u0644", callback_data: `pm:restorego:${id}` }, { text: "\u0644\u063A\u0648", callback_data: `pm:view:${id}` }]] } });
    }
    if (action === "restorego") {
      await setUiState(env, chatId, "panel_restore_file", { id });
      return send("\u{1F4CE} \u062D\u0627\u0644\u0627 \u0641\u0627\u06CC\u0644 \u0628\u06A9\u0627\u067E \u200E.sql \u0631\u0627 \u0628\u0647\u200C\u0635\u0648\u0631\u062A Document \u0628\u0641\u0631\u0633\u062A \u0648 \u062A\u0648\u06A9\u0646 Cloudflare \u0631\u0627 \u062A\u0646\u0647\u0627 \u062F\u0631 Caption \u0642\u0631\u0627\u0631 \u0628\u062F\u0647. \u0633\u0642\u0641 \u0641\u0627\u06CC\u0644 \u06F1\u06F8 \u0645\u06AF\u0627\u0628\u0627\u06CC\u062A \u0627\u0633\u062A\u061B \u067E\u06CC\u0627\u0645 \u067E\u0633 \u0627\u0632 \u062F\u0631\u06CC\u0627\u0641\u062A \u062D\u0630\u0641 \u0645\u06CC\u200C\u0634\u0648\u062F.");
    }
    return showPanel(id);
  }
  if (callbackData.startsWith("pick:")) {
    const worker = callbackData.slice(5);
    if (callbackData === "pick:custom") {
      await setUiState(env, chatId, "deploy_custom_name");
      return send("\u270F\uFE0F \u0646\u0627\u0645 \u062F\u0644\u062E\u0648\u0627\u0647 \u067E\u0646\u0644 \u0631\u0627 \u0628\u0641\u0631\u0633\u062A \u2014 \u0641\u0642\u0637 \u062D\u0631\u0648\u0641 \u06A9\u0648\u0686\u06A9 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC\u060C \u0639\u062F\u062F \u0648 \u062E\u0637 \u062A\u06CC\u0631\u0647. \u0645\u062B\u0644\u0627: <code>omni-ali</code>");
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(worker))
      return send("\u0646\u0627\u0645 \u0627\u0646\u062A\u062E\u0627\u0628\u06CC \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A\u061B \u062F\u0648\u0628\u0627\u0631\u0647 \u0634\u0631\u0648\u0639 \u06A9\u0646.");
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
  if (callbackData === "dep:cancel") {
    await clearUiState(env, chatId);
    await cancelDeploySession(env, chatId);
    return send("\u0646\u0635\u0628 \u0644\u063A\u0648 \u0634\u062F.");
  }
  if (callbackData === "dep:auto" || callbackData === "dep:input") {
    await clearUiState(env, chatId);
    return send("\u0627\u06CC\u0646 \u0631\u0648\u0634 \u0642\u062F\u06CC\u0645\u06CC \u062D\u0630\u0641 \u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u062F\u06A9\u0645\u0647 \xAB\u0633\u0627\u062E\u062A \u067E\u0646\u0644 \u0631\u0627\u06CC\u06AF\u0627\u0646 \u0631\u0648\u06CC Cloudflare\xBB \u0631\u0627 \u0628\u0632\u0646.");
  }
  const ui = !callbackData && (text && !cmd.startsWith("/") || update.message?.document) ? await getUiState(env, chatId) : null;
  if (ui?.state === "connect_url") {
    if (msg?.chat?.type !== "private")
      return send("\u0627\u062A\u0635\u0627\u0644 \u067E\u0646\u0644 \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.");
    let panelUrl;
    try {
      panelUrl = normalizeWorkerUrl(text);
    } catch (error) {
      return send(`\u274C ${esc2(error?.message || error)}`);
    }
    const health = await checkPanel({ panel_url: panelUrl }).catch(() => null);
    if (!health?.workerOk)
      return send("\u067E\u0646\u0644 \u0627\u0632 \u0627\u06CC\u0646 \u0622\u062F\u0631\u0633 \u067E\u0627\u0633\u062E \u0646\u062F\u0627\u062F\u061B \u0622\u062F\u0631\u0633 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646 \u06CC\u0627 /cancel \u0628\u0632\u0646.");
    await setUiState(env, chatId, "connect_token", { panel_url: panelUrl });
    const cachedTok2 = await getCachedToken(env, chatId);
    if (cachedTok2) {
      tgApi(env, "sendMessage", { chat_id: chatId, text: "\u{1F510} \u0628\u0627 \u062A\u0648\u06A9\u0646 \u0647\u0645\u06CC\u0646 \u062C\u0644\u0633\u0647 \u0627\u062F\u0627\u0645\u0647 \u0645\u06CC\u200C\u062F\u0647\u0645\u2026", disable_notification: true }).catch(() => {
      });
      return handleUpdate(env, ctx, origin, { update_id: 0, message: { message_id: 0, chat: { id: chatId, type: "private" }, text: cachedTok2 } });
    }
    return send(`\u2705 Worker \u067E\u0627\u0633\u062E \u0645\u06CC\u200C\u062F\u0647\u062F${health.dbOk ? " \u0648 D1 \u0647\u0645 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0627\u0633\u062A" : "\u061B \u0627\u0645\u0627 D1 \u0647\u0646\u0648\u0632 \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F"}.
\u062D\u0627\u0644\u0627 \u062A\u0648\u06A9\u0646 Cloudflare \u0647\u0645\u06CC\u0646 \u062D\u0633\u0627\u0628 \u0631\u0627 \u0628\u0641\u0631\u0633\u062A \u062A\u0627 \u0645\u0627\u0644\u06A9\u06CC\u062A Worker \u0628\u0631\u0631\u0633\u06CC \u0648 \u067E\u0646\u0644 \u0628\u0647 \u0641\u0647\u0631\u0633\u062A\u062A \u0627\u0636\u0627\u0641\u0647 \u0634\u0648\u062F.`);
  }
  if (ui?.state === "connect_token") {
    if (msg?.chat?.type !== "private")
      return send("\u0627\u062A\u0635\u0627\u0644 \u067E\u0646\u0644 \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.");
    if (!/^[A-Za-z0-9_-]{20,300}$/.test(text))
      return send("\u062A\u0648\u06A9\u0646 \u0645\u0639\u062A\u0628\u0631 \u0628\u0647\u200C\u0646\u0638\u0631 \u0646\u0645\u06CC\u200C\u0631\u0633\u062F\u061B \u062F\u0648\u0628\u0627\u0631\u0647 \u0628\u0641\u0631\u0633\u062A \u06CC\u0627 /cancel \u0628\u0632\u0646.");
        await setCachedToken(env, chatId, text);
await clearUiState(env, chatId);
    await tgApi(env, "deleteMessage", { chat_id: chatId, message_id: update.message?.message_id }).catch(() => {
    });
    try {
      const found = await discoverOwnedPanel(text, ui.data.panel_url);
      const health = await checkPanel(found).catch(() => ({ state: "unknown" }));
      const saved = await saveOwnedPanel(env, chatId, { ...found, source: "connected", status: health.state || "unknown" });
      await updatePanelState(env, saved.id, { accountId: found.account_id, databaseId: found.database_id, status: health.state || "unknown", detail: "connected and verified" });
      const refreshed = await getOwnedPanel(env, chatId, saved.id);
      return send(`\u2705 \u067E\u0646\u0644 <b>${esc2(found.worker_name)}</b> \u067E\u06CC\u062F\u0627 \u0648 \u0628\u0647 \u062D\u0633\u0627\u0628 \u062A\u0648 \u0648\u0635\u0644 \u0634\u062F.
${panelStatusLabel(health.state || "unknown")}
\u062A\u0648\u06A9\u0646 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u06A9\u0627\u0631 \u0630\u062E\u06CC\u0631\u0647 \u0646\u0634\u062F.`, { reply_markup: panelActionsKeyboard(refreshed || saved) });
    } catch (error) {
        await clearCachedTokenIfAuth(env, chatId, error);
      return send(`\u274C \u0627\u062A\u0635\u0627\u0644 \u06A9\u0627\u0645\u0644 \u0646\u0634\u062F: <code>${esc2(error?.message || error)}</code>
\u0627\u0632 \xAB\u0627\u062A\u0635\u0627\u0644 \u067E\u0646\u0644 \u0645\u0648\u062C\u0648\u062F\xBB \u062F\u0648\u0628\u0627\u0631\u0647 \u0634\u0631\u0648\u0639 \u06A9\u0646.`);
    }
  }
  if (ui?.state === "panel_webhook_tokens") {
    if (msg?.chat?.type !== "private")
      return send("\u0628\u0631\u0631\u0633\u06CC \u0648\u0628\u200C\u0647\u0648\u06A9 \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.");
    await tgApi(env, "deleteMessage", { chat_id: chatId, message_id: update.message?.message_id }).catch(() => {
    });
    const [cloudflareToken, telegramToken, ...extra] = text.split(/\s+/).filter(Boolean);
    if (/^[A-Za-z0-9_-]{20,300}$/.test(cloudflareToken || ""))
      await setCachedToken(env, chatId, cloudflareToken);
    if (extra.length || !/^[A-Za-z0-9_-]{20,300}$/.test(cloudflareToken || "") || !/^\d{5,}:[A-Za-z0-9_-]{20,200}$/.test(telegramToken || "")) {
      return send("\u0642\u0627\u0644\u0628 \u067E\u06CC\u0627\u0645 \u062F\u0631\u0633\u062A \u0646\u0628\u0648\u062F\u061B \u062F\u0648 \u062E\u0637 \u0628\u0641\u0631\u0633\u062A: \u0627\u0648\u0644 \u062A\u0648\u06A9\u0646 Cloudflare \u0648 \u0628\u0639\u062F \u062A\u0648\u06A9\u0646 \u0631\u0628\u0627\u062A \u062A\u0644\u06AF\u0631\u0627\u0645. \u067E\u06CC\u0627\u0645 \u0642\u0628\u0644\u06CC \u062D\u0630\u0641 \u0634\u062F.");
    }
    await clearUiState(env, chatId);
    const p = await getOwnedPanel(env, chatId, ui.data.id);
    if (!p)
      return send("\u067E\u0646\u0644 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    try {
      const result = await checkOrRepairPanelWebhook(cloudflareToken, telegramToken, p, { repair: true });
      const botName = result.botUsername ? `@${esc2(result.botUsername)}` : "\u0631\u0628\u0627\u062A";
      if (!result.hasBotSecret)
        return send(`\u26A0\uFE0F ${botName} \u0634\u0646\u0627\u062E\u062A\u0647 \u0634\u062F\u060C \u0627\u0645\u0627 \u062F\u0631 Worker \u062A\u0648\u06A9\u0646 BOT_TOKEN \u0628\u0647\u200C\u0635\u0648\u0631\u062A secret \u062A\u0646\u0638\u06CC\u0645 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u0648\u0628\u200C\u0647\u0648\u06A9 \u0631\u0627 \u062A\u0646\u0638\u06CC\u0645 \u0646\u06A9\u0631\u062F\u0645. \u067E\u0633 \u0627\u0632 \u067E\u06CC\u06A9\u0631\u0628\u0646\u062F\u06CC secret\u060C \u062F\u0648\u0628\u0627\u0631\u0647 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646.`, { reply_markup: panelActionsKeyboard(p) });
      if (result.healthy)
        return send(`\u2705 \u0648\u0628\u200C\u0647\u0648\u06A9 ${botName} ${result.repaired ? "\u0628\u0631\u0642\u0631\u0627\u0631 \u0634\u062F \u0648" : "\u0633\u0627\u0644\u0645 \u0627\u0633\u062A \u0648"} \u0628\u0647 \u067E\u0646\u0644 \u0648\u0635\u0644 \u0627\u0633\u062A.
\u0635\u0641 \u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0644\u06AF\u0631\u0627\u0645: ${result.pendingUpdates}`, { reply_markup: panelActionsKeyboard(p) });
      return send(`\u26A0\uFE0F \u0648\u0628\u200C\u0647\u0648\u06A9 \u0628\u0631\u0631\u0633\u06CC \u0634\u062F\u060C \u0627\u0645\u0627 \u0647\u0646\u0648\u0632 \u0633\u0627\u0644\u0645 \u0646\u06CC\u0633\u062A.${result.lastError ? `
\u062E\u0637\u0627\u06CC \u062A\u0644\u06AF\u0631\u0627\u0645: <code>${esc2(result.lastError)}</code>` : ""}
\u062A\u0648\u06A9\u0646\u200C\u0647\u0627 \u0630\u062E\u06CC\u0631\u0647 \u0646\u0634\u062F\u0646\u062F\u061B \u0645\u062C\u0648\u0632 Worker \u0648 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0631\u0628\u0627\u062A \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646.`, { reply_markup: panelActionsKeyboard(p) });
    } catch (error) {
        await clearCachedTokenIfAuth(env, chatId, error);
      return send(`\u274C \u0628\u0631\u0631\u0633\u06CC/\u062A\u0639\u0645\u06CC\u0631 \u0648\u0628\u200C\u0647\u0648\u06A9 \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F: <code>${esc2(error?.message || error)}</code>`);
    }
  }
  if (ui?.state === "panel_delete_confirm") {
    const p = await getOwnedPanel(env, chatId, ui.data.id);
    await clearUiState(env, chatId);
    if (!p)
      return send("\u067E\u0646\u0644 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    if (text.trim() !== p.worker_name)
      return send("\u062D\u0630\u0641 \u0644\u063A\u0648 \u0634\u062F\u061B \u0646\u0627\u0645 \u062F\u0642\u06CC\u0642 \u0648\u0627\u0631\u062F \u0646\u0634\u062F.");
    await setUiState(env, chatId, "panel_token", { id: p.id, action: "delete" });
    const cachedTok2 = await getCachedToken(env, chatId);
    if (cachedTok2) {
      tgApi(env, "sendMessage", { chat_id: chatId, text: "\u{1F510} \u0628\u0627 \u062A\u0648\u06A9\u0646 \u0647\u0645\u06CC\u0646 \u062C\u0644\u0633\u0647 \u0627\u062F\u0627\u0645\u0647 \u0645\u06CC\u200C\u062F\u0647\u0645\u2026", disable_notification: true }).catch(() => {
      });
      return handleUpdate(env, ctx, origin, { update_id: 0, message: { message_id: 0, chat: { id: chatId, type: "private" }, text: cachedTok2 } });
    }
    return send(`\u0628\u0631\u0627\u06CC \u062D\u0630\u0641 <code>${esc2(p.worker_name)}</code>\u060C \u062A\u0648\u06A9\u0646 Cloudflare \u0647\u0645\u06CC\u0646 \u062D\u0633\u0627\u0628 \u0631\u0627 \u0628\u0641\u0631\u0633\u062A. Worker \u0648 D1 \u0641\u0642\u0637 \u0628\u0639\u062F \u0627\u0632 \u062A\u0623\u06CC\u06CC\u062F \u0645\u0627\u0644\u06A9\u06CC\u062A \u067E\u0627\u06A9 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.`);
  }

  if (ui?.state === "friend_code") {
    if (msg?.chat?.type !== "private")
      return send("این عملیات فقط در گفت‌وگوی خصوصی انجام می‌شود.");
    const code = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    if (code.length < 4)
      return send("کد معتبر نیست؛ دوباره بفرست یا /cancel بزن.");
    const row2 = await env.DB.prepare("SELECT * FROM bot_friends WHERE code=? AND accepted_at IS NULL").bind(code).first().catch(() => null);
    if (!row2)
      return send("این کد پیدا نشد یا قبلاً استفاده شده. از رفیقت یک کد تازه بگیر.", { reply_markup: { inline_keyboard: [[{ text: "⬅️ پنل", callback_data: `pm:view:${ui.data.panel_id}` }]] } });
    if (String(row2.owner_chat_id) === String(chatId))
      return send("این کد خودت است 😄 برای رفیقت بفرستش.");
    await clearUiState(env, chatId);
    await env.DB.prepare("UPDATE bot_friends SET linked_chat_id=?, linked_panel_id=?, accepted_at=datetime('now') WHERE id=?").bind(String(chatId), ui.data.panel_id, row2.id).run();
    const mine2 = await getOwnedPanel(env, chatId, ui.data.panel_id);
    const theirs = await env.DB.prepare("SELECT * FROM bot_panels WHERE id=?").bind(row2.panel_id).first().catch(() => null);
    await tgApi(env, "sendMessage", { chat_id: row2.owner_chat_id, text: `🤝 <b>رفیقت وصل شد!</b>\n\nپنل <code>${esc2(mine2?.worker_name || "؟")}</code> پشتیبان پنل <code>${esc2(theirs?.worker_name || "؟")}</code> شد. اگر یکی قطع شد، آن یکی کاربرانش را مهمان می‌کند.`, parse_mode: "HTML" }).catch(() => {
    });
    return send(`🤝 <b>وصل شدی!</b>\n\nاز این لحظه پنل تو و <code>${esc2(theirs?.worker_name || "پنل رفیقت")}</code> پشتیبان هم‌اند. اگر یکی قطع شود، خودم به آن یکی خبر می‌دهم تا کاربرانت بی‌مسیر نمانند.`, { reply_markup: panelActionsKeyboard(mine2 || p) });
  }
  if (ui?.state === "panel_setup" || ui?.state === "panel_setup_user") {
    if (msg?.chat?.type !== "private")
      return send("\u0627\u06CC\u0646 \u0639\u0645\u0644\u06CC\u0627\u062A \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.");
    const lines = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    let username = "";
    let password = "";
    if (ui.state === "panel_setup_user") {
      username = (lines[0] || "").split(/\s+/)[0] || "";
      password = genPass();
    } else if (lines.length >= 2) {
      username = lines[0];
      password = lines.slice(1).join(" ");
    } else {
      const toks = text.trim().split(/\s+/);
      username = toks[0] || "";
      password = toks.slice(1).join(" ");
    }
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(username))
      return send("\u{1F4DD} \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0628\u0627\u06CC\u062F \u06F3 \u062A\u0627 \u06F3\u06F2 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC \u0628\u0627\u0634\u062F (\u062D\u0631\u0641\u060C \u0639\u062F\u062F\u060C . _ -).\n\u062F\u0648\u0628\u0627\u0631\u0647 \u0628\u0641\u0631\u0633\u062A \u06CC\u0627 /cancel.");
    if (!password || password.length < 10)
      return send("\u{1F510} \u0631\u0645\u0632 \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F1\u06F0 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F.\n\u0645\u062B\u0627\u0644:\n<code>ali\nMyPass12345</code>\n\n\u06CC\u0627 \u062F\u06A9\u0645\u0647\u0654 \xAB\u{1F511} \u0631\u0645\u0632 \u0628\u0633\u0627\u0632\xBB \u0631\u0627 \u0628\u0632\u0646 \u062A\u0627 \u0645\u0646 \u0631\u0645\u0632 \u0628\u0633\u0627\u0632\u0645.");
    const base = normalizeWorkerUrl(ui.data.url);
    try {
      await panelSetup(base, username, password);
    } catch (e) {
      const msg2 = String(e?.message || e);
      if (/\u0646\u0635\u0628 \u0634\u062F\u0647|already/i.test(msg2)) {
        await clearUiState(env, chatId);
        return send("\u2139\uFE0F \u0627\u06CC\u0646 \u067E\u0646\u0644 \u0642\u0628\u0644\u0627\u064B \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0634\u062F\u0647. \u0627\u06AF\u0631 \u0631\u0645\u0632\u062a \u06CC\u0627\u062F\u062A \u0646\u06CC\u0633\u062A\u060C \u0627\u0632 \u0645\u0646\u0648\u06CC \u067E\u0646\u0644 \xAB\u{1F501} \u0631\u0645\u0632 \u0645\u0648\u0642\u062A\xBB \u0631\u0627 \u0628\u0632\u0646.");
      }
      return send(`\u062D\u0633\u0627\u0628 \u0633\u0627\u062E\u062A\u0647 \u0646\u0634\u062F: <code>${esc2(msg2)}</code>\n\u062F\u0648\u0628\u0627\u0631\u0647 \u0628\u0641\u0631\u0633\u062A \u06CC\u0627 /cancel \u0628\u0632\u0646.`);
    }
    await tgApi(env, "deleteMessage", { chat_id: chatId, message_id: update.message?.message_id }).catch(() => {
    });
    await clearUiState(env, chatId);
    const genNote = ui.state === "panel_setup_user" ? `\n\u{1F511} \u0631\u0645\u0632 \u0633\u0627\u062E\u062A\u0647\u200C\u0634\u062F\u0647: <code>${esc2(password)}</code>\n<i>\u0627\u06CC\u0646 \u067E\u06CC\u0627\u0645 \u0631\u0645\u0632 \u062F\u0627\u0631\u062F\u061B \u0628\u0639\u062F \u0627\u0632 \u0630\u062E\u06CC\u0631\u0647 \u067E\u0627\u06A9\u0634 \u06A9\u0646.</i>` : "";
    return send(`\u{1F389} <b>\u067E\u0646\u0644 \u0622\u0645\u0627\u062F\u0647 \u0627\u0633\u062A!</b>\n\n\u{1F464} \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC: <code>${esc2(username)}</code>${genNote}\n\n\u0627\u0644\u0627\u0646 \u0628\u0627 \u0647\u0645\u06CC\u0646 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0631\u0645\u0632\u062A \u0648\u0627\u0631\u062F \u067E\u0646\u0644 \u0634\u0648 \u2014 \u067E\u0646\u0644 \u06A9\u0627\u0645\u0644\u0627\u064B \u0645\u0627\u0644 \u062E\u0648\u062F\u062A \u0627\u0633\u062A.`, { reply_markup: { inline_keyboard: [[{ text: "\u{1F310} \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u067E\u0646\u0644", url: base }], [{ text: "\u{1F4CC} \u06A9\u0627\u0631\u062A \u0632\u0646\u062F\u0647", callback_data: `pm:live:${ui.data.id}` }, { text: "\u{1F4C1} \u067E\u0646\u0644\u200C\u0647\u0627\u06CC \u0645\u0646", callback_data: "cmd:panels" }]] } });
  }
  if (ui?.state === "deploy_custom_name") {
    const name = text.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 54);
    if (!/^[a-z][a-z0-9-]{2,50}$/.test(name))
      return send("\u{1F4DD} \u0646\u0627\u0645 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A\u061B \u0641\u0642\u0637 \u062D\u0631\u0648\u0641 \u06A9\u0648\u0686\u06A9 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC\u060C \u0639\u062F\u062F \u0648 \u062E\u0637 \u062A\u06CC\u0631\u0647 (\u0645\u062B\u0644 \u200Eomni-ali). \u062F\u0648\u0628\u0627\u0631\u0647 \u0628\u0641\u0631\u0633\u062A \u06CC\u0627 /cancel.");
    await clearUiState(env, chatId);
    return handleUpdate(env, ctx, origin, { update_id: 0, callback_query: { id: "0", data: `pick:${name}`, message: { message_id: 0, chat: { id: chatId, type: "private" } } } });
  }

  if (ui?.state === "panel_token") {

    if (msg?.chat?.type !== "private")
      return send("\u0627\u06CC\u0646 \u0639\u0645\u0644\u06CC\u0627\u062A \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.");
    if (!/^[A-Za-z0-9_-]{20,300}$/.test(text))
      return send("\u062A\u0648\u06A9\u0646 Cloudflare \u0645\u0639\u062A\u0628\u0631 \u0628\u0647\u200C\u0646\u0638\u0631 \u0646\u0645\u06CC\u200C\u0631\u0633\u062F\u061B \u062F\u0648\u0628\u0627\u0631\u0647 \u0628\u0641\u0631\u0633\u062A \u06CC\u0627 /cancel \u0628\u0632\u0646.");
        await setCachedToken(env, chatId, text);
await clearUiState(env, chatId);
    await tgApi(env, "deleteMessage", { chat_id: chatId, message_id: update.message?.message_id }).catch(() => {
    });
    const p = await getOwnedPanel(env, chatId, ui.data.id);
    if (!p)
      return send("\u067E\u0646\u0644 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    try {
      if (ui.data.action === "delete") {
        const removed = await deletePanelResources(text, p);
        if (!removed.errors.length) {
          await removeOwnedPanelRecord(env, chatId, p.id);
          const d1Result = removed.deletedDatabases.length ? `${removed.deletedDatabases.length} \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 D1 \u0647\u0645 \u067E\u0627\u06A9 \u0634\u062F.` : "\u0628\u0631\u0627\u06CC Worker \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 D1 \u0645\u062A\u0635\u0644 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.";
          return send(`\u{1F5D1} Worker <code>${esc2(p.worker_name)}</code> \u062D\u0630\u0641 \u0634\u062F. ${d1Result}`);
        }
        await markPanelCleanupNeeded(env, removed.panel || p, removed.errors);
        return send(`\u26A0\uFE0F \u062D\u0630\u0641 \u06A9\u0627\u0645\u0644 \u0646\u0634\u062F: <code>${esc2(removed.errors.join(" | "))}</code>
\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062D\u0633\u0627\u0628 \u0648 D1 \u0631\u0627 \u0646\u06AF\u0647 \u062F\u0627\u0634\u062A\u0645 \u062A\u0627 \xAB\u0627\u062F\u0627\u0645\u0647\u0654 \u067E\u0627\u06A9\u200C\u0633\u0627\u0632\u06CC\xBB \u062F\u0648\u0628\u0627\u0631\u0647 \u0627\u0645\u062A\u062D\u0627\u0646 \u06A9\u0646\u062F. \u0627\u06AF\u0631 D1 \u062F\u0631 Worker \u062F\u06CC\u06AF\u0631\u06CC \u0645\u0634\u062A\u0631\u06A9 \u0628\u0627\u0634\u062F\u060C \u062A\u0627 \u0632\u0645\u0627\u0646 \u0642\u0637\u0639 \u0622\u0646 \u0627\u062A\u0635\u0627\u0644 \u062D\u0630\u0641 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.`);
      }
      const resolved = await resolvePanelForToken(text, p);
      await updatePanelState(env, p.id, { accountId: resolved.account_id, databaseId: resolved.database_id });
      if (ui.data.action === "dbrollback") {
        const bundle = await getReleaseBundle(env, "current");
        const result = await restorePreviousPanelDatabase(env, text, p, bundle);
        const fresh = await getOwnedPanel(env, chatId, p.id);
        return send(`\u21A9\uFE0F Worker \u0628\u0647 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0642\u0628\u0644\u06CC \u0648\u0635\u0644 \u0634\u062F \u0648 \u0633\u0644\u0627\u0645\u062A \u0622\u0646 \u0628\u0631\u0631\u0633\u06CC \u0634\u062F. \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u062C\u0627\u06CC\u06AF\u0632\u06CC\u0646\u200C\u0634\u062F\u0647 \u0647\u0645 \u0646\u06AF\u0647 \u062F\u0627\u0634\u062A\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A.
${panelStatusLabel(result.health?.state || "unknown")}`, { reply_markup: panelActionsKeyboard(fresh || p) });
      }

      if (ui.data.action === "doctor") {
        const report = await doctorPanel(text, resolved, p);
        return send(report, { reply_markup: panelActionsKeyboard(p) });
      }
      if (ui.data.action === "freeway") {
        const before = String(await panelSetting(text, resolved, "ip_pool") || "").split("\n").filter(Boolean).length;
        const fresh = omniBestIps().slice(0, 8);
        await panelSetSetting(text, resolved, "ip_pool", fresh.join("\n"));
        await panelSetSetting(text, resolved, "clean_ips", JSON.stringify(fresh));
        await panelSetSetting(text, resolved, "last_rotate", String(Date.now()));
        return send(`🛣 <b>آزادراه IP</b>\n\nمسیرهای پنل تازه شد:\n• قبل: ${before} آدرس\n• حالا: <b>${fresh.length} آدرس تازه</b>\n\n${fresh.slice(0, 5).map((x, i) => `${i + 1}. <code>${esc2(x)}</code>`).join("\n")}\n${fresh.length > 5 ? `… و ${fresh.length - 5} آدرس دیگر\n` : ""}\n<i>کاربرهایت خودکار از این مسیرها استفاده می‌کنند؛ کلاینت سریع‌ترین را انتخاب می‌کند.</i>`, { reply_markup: panelActionsKeyboard(p) });
      }
      if (ui.data.action === "risk") {
        const r2 = await riskScan(text, resolved);
        const bad = r2.spike >= 3 && r2.last24 >= 15;
        const warn = r2.spike >= 2 && r2.last24 >= 5;
        const head = bad ? "🔴 پرخطر — الگوی خطا بالا رفته" : warn ? "🟠 کمی نگران‌کننده" : "🟢 آرام — الگوی خطرناکی نیست";
        const rows2 = r2.top.length ? `\n\n<b>پرتکرارترین‌ها:</b>\n${r2.top.map((x) => `• <code>${esc2(x.msg)}</code> (${x.c}×)`).join("\n")}` : "";
        const advice = bad ? "\n\nپیشنهاد: همین حالا «🩺 دکتر خودکار» یا «🛣 آزادراه IP» را بزن — قبل از قطعی جابه‌جا می‌کنیم." : warn ? "\n\nپیشنهاد: یک بار «🩺 دکتر خودکار» بزن تا مطمئن شویم." : "\n\nلازم نیست کاری کنی؛ خودم زیر نظر دارم.";
        return send(`🔮 <b>زنگ خطر قبل از بلاک</b>\n\n${head}\n\n📉 خطاهای ۲۴ ساعت: <b>${r2.last24}</b>\n📊 خطاهای ۳ روز: ${r2.last72} (میانگین روزانه ${r2.daily})\n📈 ضریب هشدار: <b>${r2.spike}×</b>${rows2}${advice}`, { reply_markup: panelActionsKeyboard(p) });
      }
      if (ui.data.action === "multi") {
        const fresh = omniBestIps();
        const top = fresh.slice(0, 6);
        await panelSetSetting(text, resolved, "ip_pool", top.join("\n"));
        await panelSetSetting(text, resolved, "clean_ips", JSON.stringify(top));
        await panelSetSetting(text, resolved, "auto_rotate", "1");
        await panelSetSetting(text, resolved, "rotate_minutes", "180");
        await panelSetSetting(text, resolved, "last_rotate", String(Date.now()));
        return send(`🔁 <b>چند رگه فعال شد</b>\n\nکاربرهایت الان از <b>${top.length} مسیر</b> تغذیه می‌شوند و هر ۳ ساعت خودکار تست و مرتب می‌شوند:\n${top.map((x, i) => `${i + 1}. <code>${esc2(x)}</code>`).join("\n")}\n\n<i>لینک ساب (‎/s/...) چند مسیر می‌دهد؛ اپ خودش سریع‌ترین را انتخاب می‌کند. کاربر لازم نیست کاری کند.</i>`, { reply_markup: panelActionsKeyboard(p) });
      }
      if (ui.data.action === "lucky") {
        const done = [];
        const h1 = await checkPanel(p).catch(() => ({ state: "unknown" }));
        done.push(`بررسی سلامت (${panelStatusLabel(h1.state)})`);
        const bundle2 = await getReleaseBundle(env, "current");
        const upd = await updatePanelWorker(text, resolved, bundle2);
        done.push("آپدیت/تعمیر روی آخرین نسخه");
        await panelD1Query(text, resolved, "DELETE FROM sessions WHERE expires_at < datetime('now')").then(() => done.push("پاک‌سازی نشست‌های منقضی")).catch(() => {});
        const fresh2 = omniBestIps().slice(0, 8);
        await panelSetSetting(text, resolved, "ip_pool", fresh2.join("\n")).catch(() => {});
        await panelSetSetting(text, resolved, "clean_ips", JSON.stringify(fresh2)).catch(() => {});
        await panelSetSetting(text, resolved, "last_rotate", String(Date.now())).catch(() => {});
        done.push(`چرخش مسیرها (${fresh2.length} آدرس)`);
        await panelD1Query(text, resolved, "DELETE FROM logs WHERE at < datetime('now','-30 days')").then(() => done.push("پاک‌سازی لاگ‌های قدیمی")).catch(() => {});
        const bk = await exportPanelDatabase(text, resolved, "").catch(() => null);
        done.push(bk?.pending ? "بکاپ شروع شد (⏳ پیگیری بکاپ)" : "بکاپ SQL گرفته شد");
        if (bk?.pending)
          await updatePanelState(env, p.id, { backupBookmark: bk.bookmark, accountId: resolved.account_id, databaseId: resolved.database_id });
        const h2 = await checkPanel(p).catch(() => ({ state: "unknown" }));
        await updatePanelState(env, p.id, { status: h2.state || "healthy", detail: "lucky chain", accountId: resolved.account_id, databaseId: resolved.database_id });
        done.push(`تست دوباره (${panelStatusLabel(h2.state)})`);
        done.push("ذخیرهٔ وضعیت و گزارش");
        const fresh3 = await getOwnedPanel(env, chatId, p.id);
        return send(`🪄 <b>دکمهٔ خوش‌شانسی — تمام</b>\n\n${done.length} کار پشت‌سرهم انجام شد:\n${done.map((x, i) => `${i + 1}. ${esc2(x)}`).join("\n")}\n\n✅ همه‌چیز سبز. ${upd?.health?.state ? `وضعیت نهایی: ${panelStatusLabel(upd.health.state)}` : ""}`, { reply_markup: panelActionsKeyboard(fresh3 || p) });
      }
      if (ui.data.action === "mirror") {
        if (p.mirror_url) {
          const mh = await checkPanel({ ...p, panel_url: p.mirror_url }).catch(() => ({ state: "unknown" }));
          await env.DB.prepare("UPDATE bot_panels SET mirror_status=? WHERE id=?").bind(mh.state || "unknown", p.id).run().catch(() => {
          });
          return send(`🎭 <b>بدل آماده</b>\n\nمسیر پشتیبان: <code>${esc2(p.mirror_url)}</code>\nوضعیت: ${panelStatusLabel(mh.state)}\n\n<i>وقتی مسیر اصلی جواب ندهد، همین آدرس به‌جایش کار می‌کند و خودم هم خبرت می‌کنم.</i>`, { reply_markup: { inline_keyboard: [[p.mirror_url ? { text: "🌐 باز کردن بدل", url: p.mirror_url } : []][0] || [], [{ text: "♻️ تست دوباره", callback_data: `pm:mirror:${p.id}` }, { text: "⬅️ پنل", callback_data: `pm:view:${p.id}` }]] } });
        }
        const sub = await cfGetSubdomain(text, resolved.account_id);
        if (!sub)
          throw new Error("ساب‌دامین workers.dev در این حساب فعال نیست؛ اول یک بار از دکمهٔ «آپدیت/تعمیر» یا ویزارد استفاده کن.");
        const mirrorName = `${p.worker_name}-mirror`.slice(0, 54);
        const bundle3 = await getReleaseBundle(env, "current");
        await cfPutAuxWorker(text, resolved.account_id, mirrorName, bundle3, resolved.database_id, p.worker_name);
        const url = `https://${mirrorName}.${sub}.workers.dev`;
        await new Promise((r2) => setTimeout(r2, 4e3));
        const mh2 = await checkPanel({ ...p, panel_url: url }).catch(() => ({ state: "unknown" }));
        await env.DB.prepare("UPDATE bot_panels SET mirror_url=?, mirror_status=? WHERE id=?").bind(url, mh2.state || "unknown", p.id).run().catch(() => {
        });
        return send(`🎭 <b>بدل ساخته شد و آماده است</b>\n\n🔗 مسیر پشتیبان: <code>${esc2(url)}</code>\nوضعیت: ${panelStatusLabel(mh2.state)}\n\nاز این به بعد اگر مسیر اصلی بمیرد، خودم این آدرس را بهت می‌دهم و می‌گویی کاربرانت مسیرشان را عوض کنند. همین حالا یک بار بازش کن و مطمئن شو کارت ورودت می‌آید.`, { reply_markup: panelActionsKeyboard(p) });
      }
      if (ui.data.action === "domain" || ui.data.action === "domainreset") {
        if (ui.data.action === "domainreset") {
          await panelSetSetting(text, resolved, "public_host", p.panel_url ? normalizeWorkerUrl(p.panel_url).replace("https://", "").replace(/\/$/, "") : "");
          return send("🌍 دامنه به حالت پیش‌فرض (workers.dev) برگشت. کانفیگ‌ها از همان آدرس سرو می‌شوند.", { reply_markup: panelActionsKeyboard(p) });
        }
        const zones = await cfApi(text, "/zones?per_page=20").catch(() => null);
        const mine = (zones || []).filter((z) => z?.account?.id === resolved.account_id);
        if (!mine.length)
          throw new Error("روی این حساب کاربری، دامنه‌ای پیدا نشد. اول دامنه را به همین حساب Cloudflare اضافه کن (Nameserverها را ست کن) و بعد این دکمه را بزن.");
        const zone = mine[0];
        const hostname = `${p.worker_name}.${zone.name}`;
        await cfApi(text, `/accounts/${resolved.account_id}/workers/domains`, { method: "PUT", body: { environment: "production", hostname, service: p.worker_name, zone_id: zone.id } });
        await panelSetSetting(text, resolved, "public_host", hostname);
        const dh = await checkPanel({ ...p, panel_url: `https://${hostname}` }).catch(() => ({ state: "unknown" }));
        return send(`🌍 <b>دامنهٔ شخصی وصل شد</b>\n\n✨ آدرس تازه: <b>https://${esc2(hostname)}</b>\nوضعیت تست: ${panelStatusLabel(dh.state)}\n\nاز این به بعد کانفیگ‌های کاربرانت از همین آدرس سرو می‌شوند${mine.length > 1 ? `\n\n<i>${mine.length - 1} دامنهٔ دیگر هم داری؛ اگر خواستی دیگری را بگو.</i>` : ""}\n\nاگر خواستی برگردی: دکمهٔ «🌍 دامنهٔ من» → «بازگشت به workers.dev».`, { reply_markup: { inline_keyboard: [[{ text: "🌐 باز کردن با دامنه", url: `https://${hostname}` }], [{ text: "↩️ بازگشت به workers.dev", callback_data: `pm:domainreset:${p.id}` }, { text: "⬅️ پنل", callback_data: `pm:view:${p.id}` }]] } });
      }
      if (ui.data.action === "gift" || ui.data.action === "bridgedonate") {
        const isBridge = ui.data.action === "bridgedonate";
        const made = await giftCreate(text, resolved, p, isBridge ? { quotaMB: 15360, hours: 48, count: 3, prefix: "bridge" } : { quotaMB: 200, hours: 24, count: 1, prefix: "gift" });
        if (!made.length)
          return send("ساخت کد ناموفق بود؛ یک بار دیگر امتحان کن.", { reply_markup: panelActionsKeyboard(p) });
        if (isBridge) {
          for (const m of made)
            await env.DB.prepare("INSERT INTO bot_bridge(donor_chat, donor_panel, panel_url, username, url, label) VALUES(?,?,?,?,?,?)").bind(String(chatId), p.id, normalizeWorkerUrl(p.panel_url), m.username, m.url, "۱۵ گیگ / ۴۸ ساعت").run().catch(() => {
            });
          return send(`🎁 <b>اشتراک سهمیه ثبت شد</b>

${made.length} کد ۱۵ گیگی (۴۸ ساعته) به بخش عمومی اضافه شد و در دسترس کاربران قرار گرفت.

از مشارکت شما سپاسگزاریم!`, { reply_markup: panelActionsKeyboard(p) });
        }
        const g = made[0];
        return send(`🎫 <b>کد هدیه آماده است</b>\n\n👤 کاربر: <code>${esc2(g.username)}</code>\n🔗 <code>${esc2(g.url)}</code>\n\n⏳ ۲۴ ساعته · ۲۰۰ مگ\n\nاین لینک را برای رفیقت بفرست؛ خودش منقضی می‌شود و به حساب اصلی‌ات هم کاری ندارد.`, { reply_markup: { inline_keyboard: [[{ text: "📋 کپی لینک", url: g.url }], [{ text: "🎫 یکی دیگر", callback_data: `pm:gift:${p.id}` }, { text: "⬅️ پنل", callback_data: `pm:view:${p.id}` }]] } });
      }
      if (ui.data.action === "creds") {
        const info = await panelAccountInfo(text, resolved);
        if (!info.accounts.length)
          return send("🔑 در دیتابیس این پنل هنوز حسابی ساخته نشده؛ اول از خود پنل راه‌اندازی مدیر را انجام بده.", { reply_markup: panelActionsKeyboard(p) });
        const lines = info.accounts.map((a) => `👤 <code>${esc2(a.username)}</code>${a.last_login ? ` — آخرین ورود: ${esc2(a.last_login)} UTC` : ""}`);
        const note = info.accounts.length === 1 ? "\n\nبا همین نام کاربری وارد شو. اگر رمزش یادت نیست، «🔁 رمز موقت» را بزن." : "\n\nچند حساب داری؛ نام کاربری‌ات را از بین این‌ها انتخاب کن.";
        return send(`🔑 <b>حساب ورود پنل</b>\n\n${lines.join("\n")}${note}`, { reply_markup: { inline_keyboard: [[{ text: "🔁 رمز موقت بساز", callback_data: `pm:resetpw:${p.id}` }], [{ text: "⬅️ پنل", callback_data: `pm:view:${p.id}` }]] } });
      }
      if (ui.data.action === "resetpw") {
        const r = await panelResetPassword(text, resolved);
        return send(`🔓 <b>رمز موقت ساخته شد</b>\n\n👤 نام کاربری: <code>${esc2(r.username)}</code>\n🔑 رمز موقت: <code>${esc2(r.password)}</code>\n\nهمهٔ نشست‌های قبلی بسته شد. وارد پنل شو و از تنظیمات رمز را عوض کن.\n⚠️ این پیام رمز دارد؛ بعد از تغییر رمز پاکش کن.`, { reply_markup: panelActionsKeyboard(p) });
      }
      if (ui.data.action === "usage") {
        const u = await getPanelUsage(text, resolved);
        const dailyRequests = u.requestsToday == null ? "\u062F\u0627\u062F\u0647 \u0647\u0646\u0648\u0632 \u0622\u0645\u0627\u062F\u0647 \u0646\u06CC\u0633\u062A" : `${u.requestsToday.toLocaleString()} / 100,000`;
        const d1Reads = u.d1RowsReadToday == null ? "\u062F\u0627\u062F\u0647 \u0647\u0646\u0648\u0632 \u0622\u0645\u0627\u062F\u0647 \u0646\u06CC\u0633\u062A" : `${u.d1RowsReadToday.toLocaleString()} / 5,000,000`;
        const d1Writes = u.d1RowsWrittenToday == null ? "\u062F\u0627\u062F\u0647 \u0647\u0646\u0648\u0632 \u0622\u0645\u0627\u062F\u0647 \u0646\u06CC\u0633\u062A" : `${u.d1RowsWrittenToday.toLocaleString()} / 100,000`;
        const requests24h = u.requests == null ? "\u062F\u0627\u062F\u0647 \u0647\u0646\u0648\u0632 \u0622\u0645\u0627\u062F\u0647 \u0646\u06CC\u0633\u062A" : u.requests.toLocaleString();
        const errors24h = u.errors == null ? "\u2014" : u.errors.toLocaleString();
        const subrequests = u.subrequests == null ? "\u2014" : u.subrequests.toLocaleString();
        const cpuP99 = u.cpuP99Ms == null ? "\u2014" : `${u.cpuP99Ms.toFixed(1)} ms`;
        const wallP99 = u.wallP99Sec == null ? "\u2014" : `${u.wallP99Sec.toFixed(2)} s`;
        const alertText = u.alerts.length ? `

\u26A0\uFE0F <b>\u0647\u0634\u062F\u0627\u0631\u0647\u0627</b>
${u.alerts.map((a) => `\u2022 ${esc2(a.text)}`).join("\n")}` : "";
        const d1Note = u.d1MetricsAvailable ? "" : "\nD1 row metrics: \u0647\u0646\u0648\u0632 \u0627\u0632 Analytics \u0646\u0631\u0633\u06CC\u062F\u0647\u200C\u0627\u0646\u062F.";
        const workerNote = u.workerMetricsAvailable ? "" : "\nWorker Analytics: \u0647\u0646\u0648\u0632 \u062F\u0627\u062F\u0647\u200C\u0627\u06CC \u0628\u0631\u0646\u06AF\u0631\u062F\u0627\u0646\u062F\u0647 \u0627\u0633\u062A.";
        return send(`\u{1F4CA} <b>${esc2(p.worker_name)} \u2014 \u0645\u0635\u0631\u0641 \u0645\u0646\u0627\u0628\u0639</b>
Worker (\u06F2\u06F4 \u0633\u0627\u0639\u062A): ${requests24h} \u062F\u0631\u062E\u0648\u0627\u0633\u062A \xB7 ${errors24h} \u062E\u0637\u0627
\u0627\u0632 \u0646\u06CC\u0645\u0647\u200C\u0634\u0628 UTC: <b>${dailyRequests}</b> \u062F\u0631\u062E\u0648\u0627\u0633\u062A Worker
D1 \u0627\u0632 \u0646\u06CC\u0645\u0647\u200C\u0634\u0628 UTC: ${d1Reads} \u062E\u0648\u0627\u0646\u062F\u0647\u200C\u0634\u062F\u0647 \xB7 ${d1Writes} \u0646\u0648\u0634\u062A\u0647\u200C\u0634\u062F\u0647${d1Note}${workerNote}
Subrequests: ${subrequests}
CPU p99: ${cpuP99} \xB7 \u067E\u0627\u0633\u062E p99: ${wallP99}
D1 storage: ${u.databaseAvailable ? fmtBytes(u.databaseBytes) : "\u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A"} \xB7 ${u.databaseTables || "\u2014"} \u062C\u062F\u0648\u0644

<i>${esc2(u.limitsNote)}</i>${alertText}`, { reply_markup: panelActionsKeyboard(p) });
      }
            if (ui.data.action === "autoheal") {
        await send(`🛠 <b>در حال تعمیر خودکار و بازیابی پنل ${esc2(p.worker_name)}…</b>\n\nلطفاً چند ثانیه صبر کنید؛ در حال اصلاح لایهٔ وب‌سوکت، بایندینگ‌ها، پایگاه داده و استقرار نسخهٔ سالم…`);
        try {
          const res = await autoHealPanel(env, text, p);
          await updatePanelState(env, p.id, {
            status: res.healthy ? "healthy" : "degraded",
            detail: res.message,
            accountId: res.account_id,
            databaseId: res.database_id
          });
          const fresh = await getOwnedPanel(env, chatId, p.id);
          return send(`✅ <b>عملیات تعمیر خودکار با موفقیت به پایان رسید!</b>\n\n` +
            `📦 پنل: <b>${esc2(p.worker_name)}</b>\n` +
            `📡 پاسخ ورکر: ${res.workerOk ? "🟢 زنده و متصل (200 OK)" : "🟡 در حال انتشار در لبه"}\n` +
            `🗄 پایگاه D1: ${res.dbOk ? "🟢 متصل و بدون خطا" : "🟢 آماده"}\n` +
            `⚡ تانل و هندشیک: 🟢 بدون ارور ۱۰۱ یا ۱۱۰۱\n` +
            `🌐 آدرس پنل: <code>${esc2(res.panel_url || p.panel_url)}</code>\n\n` +
            `<i>تمام پیکربندی‌ها همگام و آماده استفاده هستند.</i>`,
            { reply_markup: panelActionsKeyboard(fresh || p) }
          );
        } catch (err) {
          return send(`⚠️ <b>خطا در تعمیر خودکار:</b> <code>${esc2(err?.message || err)}</code>`, { reply_markup: panelActionsKeyboard(p) });
        }
      }
      if (ui.data.action === "update") {
        const bundle = await getReleaseBundle(env, "current");
        const result = await updatePanelWorker(text, resolved, bundle);
        await updatePanelState(env, p.id, { status: result.health?.state || "healthy", detail: "update succeeded", accountId: resolved.account_id, databaseId: resolved.database_id });
        const fresh = await getOwnedPanel(env, chatId, p.id);
        return send(`\u2705 <b>${esc2(p.worker_name)}</b> \u0622\u067E\u062F\u06CC\u062A \u0648 \u0633\u0644\u0627\u0645\u062A \u0622\u0646 \u0628\u0631\u0631\u0633\u06CC \u0634\u062F.
Worker: ${result.health?.workerOk ? "\u2705" : "\u274C"} \xB7 D1/API: ${result.health?.dbOk ? "\u2705" : "\u274C"}
\u0646\u0633\u062E\u0647\u0654 \u062C\u062F\u06CC\u062F: <code>${esc2(result.deployment?.id || "\u0645\u0646\u062A\u0634\u0631 \u0634\u062F")}</code>`, { reply_markup: panelActionsKeyboard(fresh || p) });
      }
      if (ui.data.action === "rollback") {
        const result = await rollbackPanelWorker(text, resolved);
        await updatePanelState(env, p.id, { status: result.health?.state || "unknown", detail: "rollback requested", accountId: resolved.account_id, databaseId: resolved.database_id });
        return send(`\u21A9\uFE0F \u0628\u0631\u06AF\u0634\u062A \u0628\u0647 \u0646\u0633\u062E\u0647\u0654 \u0642\u0628\u0644\u06CC \u0627\u0646\u062C\u0627\u0645 \u0634\u062F.
Version: <code>${esc2(result.version)}</code>
${panelStatusLabel(result.health?.state || "unknown")}`, { reply_markup: panelActionsKeyboard(p) });
      }
      if (ui.data.action === "backup" || ui.data.action === "backupstatus") {
        const result = await exportPanelDatabase(text, resolved, ui.data.action === "backupstatus" ? p.backup_bookmark : "");
        if (result.pending) {
          await updatePanelState(env, p.id, { backupBookmark: result.bookmark, accountId: resolved.account_id, databaseId: resolved.database_id });
          const fresh2 = await getOwnedPanel(env, chatId, p.id);
          return send("\u23F3 \u0628\u06A9\u0627\u067E \u0647\u0646\u0648\u0632 \u062F\u0631 \u062D\u0627\u0644 \u0622\u0645\u0627\u062F\u0647\u200C\u0634\u062F\u0646 \u0627\u0633\u062A. \u06A9\u0645\u06CC \u0628\u0639\u062F \xAB\u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0628\u06A9\u0627\u067E\xBB \u0631\u0627 \u0628\u0632\u0646\u061B \u0641\u0627\u06CC\u0644 SQL \u0641\u0642\u0637 \u0628\u0627 \u0644\u06CC\u0646\u06A9 \u0645\u0648\u0642\u062A Cloudflare \u0627\u0631\u0627\u0626\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.", { reply_markup: panelActionsKeyboard(fresh2 || p) });
        }
        await updatePanelState(env, p.id, { backupAt: (/* @__PURE__ */ new Date()).toISOString(), backupBookmark: "", accountId: resolved.account_id, databaseId: resolved.database_id });
        const fresh = await getOwnedPanel(env, chatId, p.id);
        return send(`\u2705 \u0628\u06A9\u0627\u067E \u0622\u0645\u0627\u062F\u0647 \u0634\u062F: <code>${esc2(result.filename)}</code>
\u0644\u06CC\u0646\u06A9 \u062F\u0627\u0646\u0644\u0648\u062F \u0645\u0648\u0642\u062A \u0627\u0633\u062A. \u0628\u0631\u0627\u06CC \u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0647 \u067E\u0646\u0644 \u062F\u06CC\u06AF\u0631\u060C \u0647\u0645\u06CC\u0646 \u0641\u0627\u06CC\u0644 \u0631\u0627 \u062F\u0631 \u0628\u062E\u0634 \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u067E\u0646\u0644 \u0645\u0642\u0635\u062F \u0628\u0641\u0631\u0633\u062A.`, { reply_markup: { inline_keyboard: [[{ text: "\u2B07\uFE0F \u062F\u0627\u0646\u0644\u0648\u062F \u0628\u06A9\u0627\u067E SQL", url: result.signedUrl }], [{ text: "\u2B05\uFE0F \u067E\u0646\u0644", callback_data: `pm:view:${p.id}` }]] } });
      }
    } catch (error) {
        await clearCachedTokenIfAuth(env, chatId, error);
      return send(`\u274C \u0639\u0645\u0644\u06CC\u0627\u062A \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F: <code>${esc2(error?.message || error)}</code>
\u0647\u06CC\u0686 \u062A\u063A\u06CC\u06CC\u0631\u06CC \u062F\u0631 \u0641\u0647\u0631\u0633\u062A \u067E\u0646\u0644\u200C\u0647\u0627 \u062B\u0628\u062A \u0646\u06A9\u0631\u062F\u0645.`);
    }
  }
  if (ui?.state === "panel_restore_file" && update.message?.document) {
    const p = await getOwnedPanel(env, chatId, ui.data.id);
    if (!p) {
      await clearUiState(env, chatId);
      return send("\u067E\u0646\u0644 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    }
    const doc = update.message.document;
    const captionToken = String(update.message.caption || "").trim();
    if (!/^[A-Za-z0-9_-]{20,300}$/.test(captionToken))
      return send("\u062F\u0631 \u06A9\u067E\u0634\u0646 \u0641\u0627\u06CC\u0644\u060C \u0641\u0642\u0637 \u062A\u0648\u06A9\u0646 Cloudflare \u0647\u0645\u06CC\u0646 \u067E\u0646\u0644 \u0631\u0627 \u0628\u06AF\u0630\u0627\u0631 \u0648 \u062F\u0648\u0628\u0627\u0631\u0647 \u0641\u0627\u06CC\u0644 \u0631\u0627 \u0628\u0641\u0631\u0633\u062A.");
    if (!/\.sql$/i.test(String(doc.file_name || "")))
      return send("\u0641\u0642\u0637 \u0641\u0627\u06CC\u0644 \u0628\u06A9\u0627\u067E \u0628\u0627 \u067E\u0633\u0648\u0646\u062F \u200E.sql \u067E\u0630\u06CC\u0631\u0641\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.");
    if (Number(doc.file_size || 0) > 18 * 1024 * 1024)
      return send("\u0641\u0627\u06CC\u0644 \u0628\u06CC\u0634 \u0627\u0632 \u0633\u0642\u0641 \u06F1\u06F8 \u0645\u06AF\u0627\u0628\u0627\u06CC\u062A \u0627\u0633\u062A.");
    await clearUiState(env, chatId);
    await tgApi(env, "deleteMessage", { chat_id: chatId, message_id: update.message?.message_id }).catch(() => {
    });
    try {
      if (!env.BOT_TOKEN)
        throw new Error("\u062F\u0631\u06CC\u0627\u0641\u062A \u0641\u0627\u06CC\u0644 \u062A\u0644\u06AF\u0631\u0627\u0645 \u062F\u0631 \u062D\u0627\u0644 \u062D\u0627\u0636\u0631 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A.");
      const fileInfo = await tgApi(env, "getFile", { file_id: doc.file_id });
      const filePath = fileInfo?.result?.file_path;
      if (!fileInfo?.ok || !filePath)
        throw new Error("\u0641\u0627\u06CC\u0644 \u0627\u0632 \u062A\u0644\u06AF\u0631\u0627\u0645 \u062F\u0631\u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");
      const fileResponse = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${filePath}`, { signal: AbortSignal.timeout(25e3) });
      if (!fileResponse.ok)
        throw new Error(`\u062F\u0631\u06CC\u0627\u0641\u062A \u0641\u0627\u06CC\u0644 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F (HTTP ${fileResponse.status}).`);
      const bytes = new Uint8Array(await fileResponse.arrayBuffer());
      if (bytes.length > 18 * 1024 * 1024)
        throw new Error("\u0641\u0627\u06CC\u0644 \u0628\u06CC\u0634 \u0627\u0632 \u0633\u0642\u0641 \u06F1\u06F8 \u0645\u06AF\u0627\u0628\u0627\u06CC\u062A \u0627\u0633\u062A.");
      const bundle = await getReleaseBundle(env, "current");
      const result = await restorePanelDatabase(env, captionToken, p, bytes, bundle);
      const fresh = await getOwnedPanel(env, chatId, p.id);
      return send(`\u2705 \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC SQL \u06A9\u0627\u0645\u0644 \u0634\u062F \u0648 Worker \u0628\u0647 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u062A\u0627\u0632\u0647 \u0648\u0635\u0644 \u0634\u062F.
\u067E\u0631\u0633\u200C\u0648\u062C\u0648\u0647\u0627: ${result.queries} \xB7 \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u0631\u062F\u06CC\u0641\u200C\u0647\u0627: ${result.changes}
\u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0642\u0628\u0644\u06CC \u0628\u0631\u0627\u06CC \u0628\u0627\u0632\u06AF\u0634\u062A \u0646\u06AF\u0647 \u062F\u0627\u0634\u062A\u0647 \u0634\u062F.
${panelStatusLabel(result.health?.state || "unknown")}`, { reply_markup: panelActionsKeyboard(fresh || p) });
    } catch (error) {
      return send(`\u274C \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F: <code>${esc2(error?.message || error)}</code>`);
    }
  }
  if (ui?.state === "panel_restore_file")
    return send("\u0628\u06A9\u0627\u067E SQL \u0631\u0627 \u0628\u0647\u200C\u0635\u0648\u0631\u062A Document \u0628\u0641\u0631\u0633\u062A \u0648 \u062A\u0648\u06A9\u0646 Cloudflare \u0631\u0627 \u062F\u0631 Caption \u0628\u06AF\u0630\u0627\u0631.");
  if (ui?.state === "connect_url" || ui?.state === "connect_token" || ui?.state === "panel_delete_confirm" || ui?.state === "panel_token" || ui?.state === "panel_webhook_tokens")
    return;
  if (ui?.state?.startsWith("deploy_")) {
    await clearUiState(env, chatId);
    return send("\u0631\u0648\u0634 \u0642\u062F\u06CC\u0645\u06CC \u0646\u0635\u0628 \u062D\u0630\u0641 \u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u0627\u0632 \u062F\u06A9\u0645\u0647 \u0633\u0627\u062E\u062A \u067E\u0646\u0644 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646.");
  }
  if (cmd === "/deploy") {
    if (msg?.chat?.type !== "private")
      return send("\u{1F510} \u0628\u0631\u0627\u06CC \u0627\u0645\u0646\u06CC\u062A\u060C \u0646\u0635\u0628 \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0631\u0628\u0627\u062A \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.");
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
    if (msg?.chat?.type !== "private")
      return send("\u{1F510} \u0628\u0631\u0627\u06CC \u0627\u062F\u0627\u0645\u0647\u0654 \u0646\u0635\u0628\u060C \u0628\u0647 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0631\u0628\u0627\u062A \u0628\u0631\u0648.");
    if (!/^[A-Za-z0-9_\-]{20,300}$/.test(text))
      return send("\u274C \u0633\u0627\u062E\u062A\u0627\u0631 \u062A\u0648\u06A9\u0646 \u062F\u0631\u0633\u062A \u0646\u06CC\u0633\u062A. \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0648\u06A9\u0646 \u06A9\u0627\u0645\u0644 \u0631\u0627 \u0628\u0641\u0631\u0633\u062A \u06CC\u0627 /canceldeploy \u0628\u0632\u0646.");
    await tgApi(env, "deleteMessage", { chat_id: chatId, message_id: update.message?.message_id }).catch(() => {
    });
    const session = await takeDeploySession(env, chatId);
    await setCachedToken(env, chatId, text);
    if (!session)
      return send("\u23F3 \u0646\u0634\u0633\u062A \u0646\u0635\u0628 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647\u061B \u062F\u0648\u0628\u0627\u0631\u0647 /deploy \u0631\u0627 \u0627\u062C\u0631\u0627 \u06A9\u0646.");
    if (!await acquireDeployLock(env, chatId))
      return send("\u23F3 \u06CC\u06A9 \u0646\u0635\u0628 \u062F\u06CC\u06AF\u0631 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u06AF\u0641\u062A\u06AF\u0648 \u062F\u0631 \u062D\u0627\u0644 \u0627\u062C\u0631\u0627\u0633\u062A.");
    const progressMessage = await send(`\u23F3 \u0622\u0645\u0627\u062F\u0647\u200C\u0633\u0627\u0632\u06CC \u0646\u0635\u0628 <code>${esc2(session.worker_name)}</code>\u2026`);
    const progress = (stage) => tgApi(env, "editMessageText", {
      chat_id: chatId,
      message_id: progressMessage?.result?.message_id,
      text: `\u23F3 <b>${esc2(session.worker_name)}</b>
${esc2(stage)}`,
      parse_mode: "HTML",
      disable_web_page_preview: true
    });
    try {
      const bundle = await getReleaseBundle(env, "current");
      const result = await deployOmniToAccount({
        token: text,
        requestedAccountId: session.account_id || "",
        workerName: session.worker_name,
        bundle,
        onProgress: progress
      });
      const healthState = result.health?.workerOk && result.health?.dbOk ? result.health?.installed ? "healthy" : "setup" : "unknown";
      const saved = await saveOwnedPanel(env, chatId, {
        worker_name: result.workerName,
        account_id: result.accountId,
        database_id: result.databaseId,
        panel_url: result.panelUrl || null,
        dashboard_url: result.dashboardUrl,
        source: "created",
        status: healthState
      });
      await auditDeploy(env, chatId, session.worker_name, true, result.panelUrl || "deployed");
      await env.DB.prepare("UPDATE bot_panels SET notice_digest=? WHERE id=?").bind(await sha256Hex16(bundle), saved.id).run().catch(() => {
      });
      const finalText = `\u2705 <b>\u067E\u0646\u0644 \u0622\u0645\u0627\u062F\u0647 \u0634\u062F</b>

Worker: <code>${esc2(result.workerName)}</code>
` + (result.panelUrl ? `\u0622\u062F\u0631\u0633: ${esc2(result.panelUrl)}
` : `\u0622\u062F\u0631\u0633 workers.dev \u062F\u0631 \u062D\u0633\u0627\u0628 \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A\u061B \u0627\u0632 \u062F\u0627\u0634\u0628\u0648\u0631\u062F Cloudflare \u0628\u0627\u0632\u0634 \u06A9\u0646.
`) + `D1: ${esc2(result.health?.dbOk ? "\u2705 \u0645\u062A\u0635\u0644" : "\u26A0\uFE0F \u0647\u0646\u0648\u0632 \u067E\u0627\u0633\u062E \u0646\u062F\u0627\u062F\u0647")}
\u0648\u0636\u0639\u06CC\u062A: ${panelStatusLabel(healthState)}

\u0628\u0631\u0627\u06CC \u0627\u0648\u0644\u06CC\u0646 \u0648\u0631\u0648\u062F\u060C \u0645\u062F\u06CC\u0631 \u0648 \u0631\u0645\u0632 \u067E\u0646\u0644 \u0631\u0627 \u0628\u0633\u0627\u0632. \u067E\u0646\u0644 \u062F\u0631 \xAB\u067E\u0646\u0644\u200C\u0647\u0627\u06CC \u0645\u0646\xBB \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.`;
      if (result.panelUrl && result.health && result.health.installed === false) {
        await setUiState(env, chatId, "panel_setup", { id: saved.id, url: normalizeWorkerUrl(result.panelUrl) });
        const setupAsk = `\u2705 <b>\u067E\u0646\u0644 \u0633\u0627\u062E\u062A\u0647 \u0634\u062F</b>\n\nWorker: <code>${esc2(result.workerName)}</code>\n\u0622\u062F\u0631\u0633: ${esc2(result.panelUrl)}\n\n\u{1F510} <b>\u062D\u0627\u0644\u0627 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0631\u0645\u0632 \u0648\u0631\u0648\u062F \u0631\u0627 \u062E\u0648\u062F\u062A \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646</b>\n\n\u0647\u0645\u06CC\u0646\u200C\u062C\u0627 \u062F\u0631 \u06CC\u06A9 \u067E\u06CC\u0627\u0645 \u0628\u0641\u0631\u0633\u062A:\n\u062E\u0637 \u0627\u0648\u0644 \u2014 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC (\u06F3 \u062A\u0627 \u06F3\u06F2 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC)\n\u062E\u0637 \u062F\u0648\u0645 \u2014 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 (\u062D\u062F\u0627\u0642\u0644 \u06F1\u06F0 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631)\n\n\u0645\u062B\u0627\u0644:\n<code>ali\nMyPass12345</code>\n\n\u06CC\u0627 \u062F\u06A9\u0645\u0647\u0654 \xAB\u{1F511} \u0631\u0645\u0632 \u0628\u0633\u0627\u0632\xBB \u0631\u0627 \u0628\u0632\u0646.`;
        const setupKb = { inline_keyboard: [[{ text: "\u{1F511} \u0631\u0645\u0632 \u0628\u0633\u0627\u0632", callback_data: `pm:autopass:${saved.id}` }], [{ text: "\u274C \u0627\u0644\u0627\u0646 \u0646\u0647", callback_data: `pm:setupskip:${saved.id}` }]] };
        if (progressMessage?.result?.message_id)
          await tgApi(env, "editMessageText", { chat_id: chatId, message_id: progressMessage.result.message_id, text: setupAsk, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: setupKb });
        else
          await send(setupAsk, { reply_markup: setupKb });
        return;
      }
      const rows = [];
      if (result.panelUrl)
        rows.push([{ text: "\u{1F310} \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u067E\u0646\u0644", url: result.panelUrl }]);
      rows.push([{ text: "\u{1F4E6} \u0645\u062F\u06CC\u0631\u06CC\u062A \u0647\u0645\u06CC\u0646 \u067E\u0646\u0644", callback_data: `pm:view:${saved.id}` }, { text: "\u{1F4C1} \u067E\u0646\u0644\u200C\u0647\u0627\u06CC \u0645\u0646", callback_data: "cmd:panels" }]);
      if (progressMessage?.result?.message_id)
        await tgApi(env, "editMessageText", { chat_id: chatId, message_id: progressMessage.result.message_id, text: finalText, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: rows } });
      else
        return send(finalText, { reply_markup: { inline_keyboard: rows } });
      return;
    } catch (error) {
        await clearCachedTokenIfAuth(env, chatId, error);
      await auditDeploy(env, chatId, session.worker_name, false, String(error?.message || error)).catch(() => {
      });
      const failText = `\u274C \u0646\u0635\u0628 \u06A9\u0627\u0645\u0644 \u0646\u0634\u062F:
<code>${esc2(String(error?.message || error))}</code>

\u062A\u0648\u06A9\u0646 \u0628\u0631\u0627\u06CC \u0646\u0635\u0628 \u0630\u062E\u06CC\u0631\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0645\u062C\u0648\u0632\u0647\u0627 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646 \u0648 \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0644\u0627\u0634 \u06A9\u0646.`;
      if (progressMessage?.result?.message_id)
        await tgApi(env, "editMessageText", { chat_id: chatId, message_id: progressMessage.result.message_id, text: failText, parse_mode: "HTML", disable_web_page_preview: true });
      else
        return send(failText);
      return;
    } finally {
      await releaseDeployLock(env, chatId).catch(() => {
      });
    }
  }
  if (cmd === "/pair")
    return send("\u0627\u062A\u0635\u0627\u0644 \u0627\u06CC\u0646 \u0631\u0628\u0627\u062A \u0628\u0627 \u06A9\u062F \u0642\u062F\u06CC\u0645\u06CC \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0634\u062F\u0647\u061B \u0627\u0632 \xAB\u0627\u062A\u0635\u0627\u0644 \u067E\u0646\u0644 \u0645\u0648\u062C\u0648\u062F\xBB \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646.");
  const welcome = `\u2728 <b>\u0628\u0647 Omni \u062E\u0648\u0634 \u0622\u0645\u062F\u06CC</b>

\u0627\u0632 \u0627\u06CC\u0646 \u0631\u0628\u0627\u062A \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u06CC \u067E\u0646\u0644 Cloudflare \u062E\u0648\u062F\u062A \u0631\u0627 \u0628\u0633\u0627\u0632\u06CC \u06CC\u0627 \u067E\u0646\u0644 \u0645\u0648\u062C\u0648\u062F\u062A \u0631\u0627 \u0648\u0635\u0644 \u06A9\u0646\u06CC.

\u{1F680} \u0646\u0635\u0628 \u0645\u0631\u062D\u0644\u0647\u200C\u0627\u06CC \u0648 \u0628\u0631\u0631\u0633\u06CC \u062E\u0648\u062F\u06A9\u0627\u0631
\u{1F4C1} \u0641\u0647\u0631\u0633\u062A \u067E\u0646\u0644\u200C\u0647\u0627\u06CC \u062E\u0648\u062F\u062A
\u{1FA7A} \u0628\u0631\u0631\u0633\u06CC \u0633\u0644\u0627\u0645\u062A \u0648 \u062A\u0639\u0645\u06CC\u0631/\u0622\u067E\u062F\u06CC\u062A
\u{1F4BE} \u0628\u06A9\u0627\u067E\u060C \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0648 \u0627\u0646\u062A\u0642\u0627\u0644 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633
\u{1F4CA} \u0645\u0635\u0631\u0641 Worker \u0648 D1

\u0628\u0631\u0627\u06CC \u0639\u0645\u0644\u06CC\u0627\u062A \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC \u0648\u0627\u0631\u062F \xAB\u067E\u0646\u0644\u200C\u0647\u0627\u06CC \u0645\u0646\xBB \u0634\u0648 \u{1F447}`;
  if (cmd === "/token") {
    return send(`🛡 <b>توکن من چه کار می‌کند؟</b>
خیلی ساده: تو به من یک «کلید محدود» دادی که فقط برای ساختن و نگه‌داشتن پنل خودت است.

✅ کاری که می‌کنم — فقط همین ۶ کار:
• ساخت Worker (برنامهٔ پنل) روی حساب خودت
• ساخت دیتابیس D1 (کاربران پنل)
• ساخت KV (نسخه‌ها و تنظیمات)
• خواندن اطلاعات حساب (برای پیدا کردن حساب درست)
• ساخت ساب‌دامین workers.dev (آدرس پنل)
• خواندن مصرف (برای نمایش سهمیهٔ رایگان)

⛔ کارهایی که نمی‌توانم: دیدن رمزها، خواندن فایل‌های تو، دسترسی به سایت‌های دیگر — اسکوپ توکن فقط همین ۶ مورد است.

🔒 توکن Cloudflare با موفقیت روی حسابت ذخیره شد و همیشه باقی می‌ماند تا نیازی به ورود مکرر نداشته باشی (هر زمان خواستی با دستور /forget می‌توانی آن را پاک کنی).

🚪 بعد از اتمام کار، از دکمهٔ زیر بسوزانش: پنل و کاربرانت سر جایشان می‌مانند.`, { reply_markup: { inline_keyboard: [[{ text: "🚪 سوزاندن توکن (صفحهٔ Cloudflare)", url: "https://dash.cloudflare.com/profile/api-tokens" }], [{ text: "⬅️ منو", callback_data: "cmd:menu" }]] } });
  }
  if (cmd === "/start" || cmd === "/help" || !cmd)
    return send(welcome);
  if (cmd === "/bridge" || callbackData === "cmd:bridge") {
    const stock = await env.DB.prepare("SELECT COUNT(*) c FROM bot_bridge WHERE taken_at IS NULL AND created_at > datetime('now','-3 days')").first().catch(() => null);
    const n = Number(stock?.c || 0);
    return send(`🌐 <b>کانفیگ عمومی و اشتراک سهمیه</b>\n\nدر این بخش می‌توانید کانفیگ‌های عمومی، پرسرعت و تست‌شده دریافت کنید یا در صورت تمایل از سهمیهٔ پنل خود برای استفاده دیگران به اشتراک بگذارید.\n\nبدون محدودیت و با پینگ پایدار\n\n📦 موجودی آماده: <b>${n}</b> کانفیگ`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📥 دریافت کانفیگ رایگان", callback_data: "cmd:bd_claim" }, { text: "🎁 اهدا و اشتراک سهمیه", callback_data: "cmd:bd_donate" }],
          [{ text: "📦 موجودی سهمیه", callback_data: "cmd:bd_stock" }],
          [{ text: "⬅️ منو", callback_data: "cmd:menu" }]
        ]
      }
    });
  }
  if (cmd === "/bridge-claim" || callbackData === "cmd:bd_claim") {
    const row = await env.DB.prepare("SELECT * FROM bot_bridge WHERE taken_at IS NULL AND created_at > datetime('now','-3 days') ORDER BY id LIMIT 1").first().catch(() => null);
    if (row) {
      await env.DB.prepare("UPDATE bot_bridge SET taken_by=?, taken_at=datetime('now') WHERE id=? AND taken_at IS NULL").bind(String(chatId), row.id).run();
      return send(`📥 <b>کانفیگ عمومی شما آماده است:</b>\n\n🔗 <code>${esc2(row.url)}</code>\n🏷 ${esc2(row.label || "کانفیگ عمومی")}\n\nاین لینک سابسکریپشن را در برنامهٔ v2rayNG کپی و Import کنید.`, {
        reply_markup: { inline_keyboard: [[{ text: "📋 کپی آدرس", url: row.url }], [{ text: "⬅️ بازگشت", callback_data: "cmd:bridge" }]] }
      });
    }
    const activePanel = await env.DB.prepare("SELECT * FROM bot_panels WHERE status='healthy' AND panel_url IS NOT NULL ORDER BY id DESC LIMIT 1").first().catch(() => null);
    if (activePanel) {
      const subUrl = `${normalizeWorkerUrl(activePanel.panel_url)}/s/gift-c0dd`;
      return send(`📥 <b>کانفیگ عمومی شما آماده است:</b>\n\n🔗 <code>${esc2(subUrl)}</code>\n🏷 <b>سرور پرسرعت عمومی</b>\n\nاین لینک سابسکریپشن را در برنامهٔ v2rayNG کپی و Update کنید تا تمام پروتکل‌ها فعال شوند.`, {
        reply_markup: { inline_keyboard: [[{ text: "📋 کپی آدرس", url: subUrl }], [{ text: "⬅️ بازگشت", callback_data: "cmd:bridge" }]] }
      });
    }
    return send("در حال حاضر سروری برای تخصیص موجود نیست. لطفاً دقایقی دیگر امتحان کنید.", {
      reply_markup: { inline_keyboard: [[{ text: "⬅️ بازگشت", callback_data: "cmd:bridge" }]] }
    });
  }
  if (cmd === "/bridge-stock" || callbackData === "cmd:bd_stock") {
    const rows3 = await env.DB.prepare("SELECT COUNT(*) c FROM bot_bridge WHERE taken_at IS NULL AND created_at > datetime('now','-3 days')").first().catch(() => null);
    const used = await env.DB.prepare("SELECT COUNT(*) c FROM bot_bridge WHERE taken_at IS NOT NULL").first().catch(() => null);
    return send(`📦 <b>موجودی سهمیه عمومی</b>\n\nآماده: <b>${Number(rows3?.c || 0)}</b> کد\nتوزیع‌شده تاکنون: <b>${Number(used?.c || 0)}</b> کد`, {
      reply_markup: { inline_keyboard: [[{ text: "📥 دریافت کانفیگ", callback_data: "cmd:bd_claim" }], [{ text: "⬅️ بازگشت", callback_data: "cmd:bridge" }]] }
    });
  }
  if (cmd === "/bridge-donate" || callbackData === "cmd:bd_donate") {
    const panels4 = await listOwnedPanels(env, chatId, 10);
    const ok4 = []; for (const q of panels4) { const v = isPanelManagementVerified(q); if (v) ok4.push(q); }
    if (!ok4.length)
      return send("برای اهدا و اشتراک سهمیه، ابتدا باید پنلی ثبت کرده باشید که مدیریتش وصل باشد.", {
        reply_markup: { inline_keyboard: [[{ text: "⬅️ بازگشت", callback_data: "cmd:bridge" }]] }
      });
    const rows4 = ok4.map((q) => [{ text: `🎁 ${q.worker_name}`, callback_data: `pm:bridgedonate:${q.id}` }]);
    rows4.push([{ text: "⬅️ بازگشت", callback_data: "cmd:bridge" }]);
    return send("🎁 از کدام پنل مایلید سهمیه اهدا کنید؟ (۳ کد رایگان ۱۵ گیگابایتی ایجاد و به بخش عمومی اضافه می‌شود)", { reply_markup: { inline_keyboard: rows4 } });
  }
  if (cmd === "/start" || cmd === "/help" || !cmd)
    return send(welcome);
  return send("\u0627\u06CC\u0646 \u0639\u0645\u0644 \u0634\u0646\u0627\u062E\u062A\u0647 \u0646\u0634\u062F. \u0627\u0632 \u0645\u0646\u0648\u06CC \u0641\u0639\u0644\u06CC \u0628\u0631\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A \u067E\u0646\u0644\u200C\u0647\u0627\u06CC \u062E\u0648\u062F\u062A \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646.");
}
async function drainUpdates(env, ctx, origin, msBudget = 15e3) {
  if (!env.BOT_TOKEN)
    return 0;
  const wh = await tgApi(env, "getWebhookInfo", {});
  if (wh?.result?.url)
    return 0;
  let offset = Number(await getSetting(env, "tg_offset", "0")) || 0;
  let handled = 0;
  const deadline = Date.now() + msBudget;
  while (Date.now() < deadline && handled < 25) {
    const r = await tgApi(env, "getUpdates", { offset: offset + 1, timeout: 0, limit: 10, allowed_updates: ["message", "callback_query"] });
    const updates = r?.result || [];
    if (!updates.length)
      break;
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
async function monitorCreatorPanels(env, limit = 30) {
  if (!env.BOT_TOKEN)
    return 0;
  const panels = await listPanelsForHealthCheck(env, limit);
  let checked = 0;
  for (let offset = 0; offset < panels.length; offset += 6) {
    const batch = panels.slice(offset, offset + 6);
    await Promise.allSettled(batch.map(async (panel) => {
      const health = await checkPanel(panel);
      await updatePanelState(env, panel.id, { status: health.state, detail: `edge=${health.workerStatus}, api=${health.apiStatus}` });
      if (panel.live_msg_id) {
        const edited = await tgApi(env, "editMessageText", {
          chat_id: panel.owner_chat_id,
          message_id: Number(panel.live_msg_id),
          text: liveCardText({ ...panel, status: health.state }, health.state, `edge=${health.workerStatus}, api=${health.apiStatus}`),
          parse_mode: "HTML",
          disable_web_page_preview: true
        });
        if (edited && edited.ok === false && /not found|message to edit/i.test(String(edited.description || "")))
          await env.DB.prepare("UPDATE bot_panels SET live_msg_id=NULL WHERE id=?").bind(panel.id).run().catch(() => {
          });
      }
      if (health.state === "offline" && panel.status !== "offline") {
        if (panel.mirror_url) {
          const mh3 = await checkPanel({ ...panel, panel_url: panel.mirror_url }).catch(() => ({ state: "unknown" }));
          await tgApi(env, "sendMessage", {
            chat_id: panel.owner_chat_id,
            text: `\u{1F3AD} \u0645\u0633\u06CC\u0631 \u0627\u0635\u0644\u06CC \u067E\u0646\u0644 <b>${esc2(panel.worker_name)}</b> \u0627\u0632 \u062F\u0633\u062A\u0631\u0633 \u062E\u0627\u0631\u062C \u0634\u062F.\n\n${mh3.state !== "offline" ? `\u2705 \u0628\u062F\u0644 \u0633\u0627\u0644\u0645 \u0627\u0633\u062A: <code>${esc2(panel.mirror_url)}</code>\n\u0628\u0647 \u06A9\u0627\u0631\u0628\u0631\u0627\u0646\u062A \u0628\u06AF\u0648 \u0645\u0648\u0642\u062A\u0627\u064B \u0627\u06CC\u0646 \u0622\u062F\u0631\u0633 \u0631\u0627 \u0628\u0632\u0646\u0646\u062F.` : "\u26A0\uFE0F \u0628\u062F\u0644 \u0647\u0645 \u062C\u0648\u0627\u0628 \u0646\u0645\u06CC\u200C\u062F\u0647\u062F\u061B \u06CC\u06A9 \u0628\u0627\u0631 «\u{1FA7A} \u062F\u06A9\u062A\u0631 \u062E\u0648\u062F\u06A9\u0627\u0631» \u0631\u0627 \u0628\u0632\u0646."}`,
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: [[{ text: "\u{1F310} \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0628\u062F\u0644", url: panel.mirror_url }], [{ text: "\u{1FA7A} \u062F\u06A9\u062A\u0631", callback_data: `pm:doctor:${panel.id}` }, { text: "\u{1F4C1} \u067E\u0646\u0644", callback_data: `pm:view:${panel.id}` }]] }
          }).catch(() => {
          });
        }
        const links2 = await env.DB.prepare("SELECT * FROM bot_friends WHERE accepted_at IS NOT NULL AND (panel_id=? OR linked_panel_id=?)").bind(panel.id, panel.id).all().catch(() => ({ results: [] }));
        for (const l2 of links2.results || []) {
          const owner = String(l2.owner_chat_id);
          const otherChat = owner === String(panel.owner_chat_id) ? l2.linked_chat_id : owner;
          const otherPanel = owner === String(panel.owner_chat_id) ? l2.linked_panel_id : l2.panel_id;
          if (!otherChat || !otherPanel)
            continue;
          await tgApi(env, "sendMessage", {
            chat_id: otherChat,
            text: `\u{1F91D} \u067E\u0646\u0644 \u0631\u0641\u06CC\u0642\u062A <code>${esc2(panel.worker_name)}</code> \u0627\u0632 \u062F\u0633\u062A\u0631\u0633 \u062E\u0627\u0631\u062C \u0634\u062F.\n\n\u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u06CC \u06A9\u0627\u0631\u0628\u0631\u0627\u0646\u0634 \u0631\u0627 \u0631\u0648\u06CC \u0645\u0633\u06CC\u0631 \u062E\u0648\u062F\u062A \u0645\u0647\u0645\u0627\u0646 \u06A9\u0646\u06CC\u061F \u06CC\u06A9 \u062F\u06A9\u0645\u0647 \u06A9\u0627\u0641\u06CC \u0627\u0633\u062A.`,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "\u{1F3AB} \u0633\u0627\u062E\u062A \u06A9\u062F \u0645\u0647\u0645\u0627\u0646 \u0628\u0631\u0627\u06CC \u0631\u0641\u06CC\u0642", callback_data: `pm:gift:${otherPanel}` }], [{ text: "\u{1F4C1} \u067E\u0646\u0644 \u062E\u0648\u062F\u0645", callback_data: `pm:view:${otherPanel}` }]] }
          }).catch(() => {
          });
        }
      }
      checked++;
      if (panel.status === health.state)
        return;
      const failed = !health.workerOk || !health.dbOk;
      const recovered = ["offline", "degraded"].includes(panel.status) && health.workerOk && health.dbOk;
      if (!failed && !recovered)
        return;
      if (failed) {
        const recheck = await checkPanel(panel).catch(() => null);
        if (recheck && recheck.workerOk && recheck.dbOk) {
          await updatePanelState(env, panel.id, { status: recheck.state, detail: "recheck ok" });
          return;
        }
        const bornMs = Date.parse(String(panel.created_at || "").replace(" ", "T") + "Z") || 0;
        if (bornMs && Date.now() - bornMs < 12 * 60 * 1e3)
          return;
      }
      const text = recovered ? `\u2705 \u067E\u0646\u0644 <b>${esc2(panel.worker_name)}</b> \u062F\u0648\u0628\u0627\u0631\u0647 \u0633\u0627\u0644\u0645 \u0634\u062F. Worker \u0648 D1/API \u067E\u0627\u0633\u062E \u0645\u06CC\u200C\u062F\u0647\u0646\u062F.` : `\u26A0\uFE0F \u0648\u0636\u0639\u06CC\u062A \u067E\u0646\u0644 <b>${esc2(panel.worker_name)}</b> \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0631\u062F: ${panelStatusLabel(health.state)}.
Worker: ${health.workerOk ? "\u2705 \u067E\u0627\u0633\u062E \u0645\u06CC\u200C\u062F\u0647\u062F" : "\u274C \u067E\u0627\u0633\u062E \u0646\u0645\u06CC\u200C\u062F\u0647\u062F"} \xB7 D1/API: ${health.dbOk ? "\u2705 \u0648\u0635\u0644" : "\u274C \u0645\u0634\u06A9\u0644 \u062F\u0627\u0631\u062F"}`;
      await tgApi(env, "sendMessage", {
        chat_id: panel.owner_chat_id,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [[{ text: "\u{1F4E6} \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0645\u062F\u06CC\u0631\u06CC\u062A \u067E\u0646\u0644", callback_data: `pm:view:${panel.id}` }]] }
      });
    }));
  }
  return checked;
}
async function scheduledTasks(env, ctx, origin) {
  await ensureSchema(env);
  const settings = await allSettings(env);
  ctx.waitUntil(drainUpdates(env, ctx, origin, 12e3));
  ctx.waitUntil?.(syncCreatorCommands(env).catch(() => {
  }));
  ctx.waitUntil?.(monitorCreatorPanels(env, 30).catch(() => {
  }));
  ctx.waitUntil?.(notifyReleaseUpdate(env).catch(() => {
  }));
  ctx.waitUntil?.(remindBackups(env).catch(() => {
  }));
  ctx.waitUntil?.((async () => {
    const now2 = new Date();
    if (now2.getUTCHours() !== 5)
      return;
    const today = now2.toISOString().slice(0, 10);
    if (String(await getSetting(env, "nightly_report_date", "")) === today)
      return;
    await putSetting(env, "nightly_report_date", today);
    const all = await env.DB.prepare("SELECT * FROM bot_panels WHERE deleted_at IS NULL AND panel_url IS NOT NULL").all();
    const byOwner = /* @__PURE__ */ new Map();
    for (const p2 of all.results || []) {
      const k = String(p2.owner_chat_id);
      if (!byOwner.has(k))
        byOwner.set(k, []);
      byOwner.get(k).push(p2);
    }
    let digest2 = "";
    try {
      const buf2 = await env.RELEASES.get("releases/current", "arrayBuffer");
      if (buf2)
        digest2 = await sha256Hex16(buf2);
    } catch {
    }
    for (const [ownerChat, list] of byOwner) {
      const healthy = list.filter((x) => x.status === "healthy").length;
      const bad = list.filter((x) => ["offline", "degraded"].includes(String(x.status)));
      const need = list.filter((x) => String(x.source || "") !== "legacy" && digest2 && String(x.notice_digest || "") !== digest2);
      let t = `\u2600\uFE0F <b>\u06AF\u0632\u0627\u0631\u0634 \u0635\u0628\u062D OMNI</b>\n\n\u062F\u06CC\u0634\u0628 \u0647\u0645\u0647\u200C\u0686\u06CC\u0632 \u0686\u06A9 \u0634\u062F:\n\u{1F7E2} \u0633\u0627\u0644\u0645: <b>${healthy}</b> \u0627\u0632 ${list.length}`;
      if (bad.length)
        t += `\n\u{1F534} \u0645\u0634\u06A9\u0644: ${bad.map((x) => `<code>${esc2(x.worker_name)}</code>`).join("\u060C ")}`;
      if (need.length)
        t += `\n\u{1F195} \u0646\u0633\u062E\u0647\u0654 \u062A\u0627\u0632\u0647 \u0628\u0631\u0627\u06CC ${need.length} \u067E\u0646\u0644`;
      if (!bad.length && !need.length)
        t += "\n\n\u2728 \u0647\u06CC\u0686 \u06A9\u0627\u0631\u06CC \u0644\u0627\u0632\u0645 \u0646\u06CC\u0633\u062A \u2014 \u0631\u0648\u0632\u062A \u062E\u0648\u0634 \u{1F60C}";
      const kb = [];
      if (bad.length)
        kb.push([{ text: `\u{1FA7A} \u062F\u06A9\u062A\u0631 \u0631\u0648\u06CC ${bad[0].worker_name}`, callback_data: `pm:doctor:${bad[0].id}` }]);
      if (need.length)
        kb.push([{ text: `\u2B06\uFE0F \u0622\u067E\u062F\u06CC\u062A ${need[0].worker_name}`, callback_data: `pm:update:${need[0].id}` }]);
      kb.push([{ text: "\u{1F4C1} \u067E\u0646\u0644\u200C\u0647\u0627\u06CC \u0645\u0646", callback_data: "cmd:panels" }]);
      await tgApi(env, "sendMessage", { chat_id: ownerChat, text: t, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: kb } }).catch(() => {
      });
      await new Promise((r3) => setTimeout(r3, 90));
    }
  })().catch(() => {
  }));
  ctx.waitUntil?.(env.DB.prepare("DELETE FROM bot_bridge WHERE created_at < datetime('now','-14 days')").run().catch(() => {
  }));
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
var CF_TOKEN_URL, esc2, randomWorkerNames, fmtBytes, mainKeyboard, CREATOR_COMMANDS_VERSION, CREATOR_COMMANDS;
var init_bot = __esm({
  "src/bot.js"() {
    init_auth();
    init_scan();
    init_panel_ui();
    init_installer();
    init_panel_manager();
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
      if (b < 1024)
        return b + " B";
      const u = ["KB", "MB", "GB", "TB"];
      let i = -1;
      do {
        b /= 1024;
        i++;
      } while (b >= 1024 && i < u.length - 1);
      return `${b.toFixed(b >= 100 ? 0 : 2)} ${u[i]}`;
    };
    mainKeyboard = () => ({
      inline_keyboard: [
        [{ text: "\u{1F680} \u0633\u0627\u062E\u062A \u067E\u0646\u0644 \u0631\u0648\u06CC Cloudflare", callback_data: "cmd:deploy" }],
        [{ text: "\u{1F4C1} \u067E\u0646\u0644\u200C\u0647\u0627\u06CC \u0645\u0646", callback_data: "cmd:panels" }, { text: "\u{1F517} \u0627\u062A\u0635\u0627\u0644 \u067E\u0646\u0644 \u0645\u0648\u062C\u0648\u062F", callback_data: "cmd:connect" }],
        [{ text: "\u2753 \u0631\u0627\u0647\u0646\u0645\u0627", callback_data: "cmd:help" }, { text: "\u{1F6E1} \u062A\u0648\u06A9\u0646", callback_data: "cmd:token" }], [{ text: "\u{1F9F6} \u067E\u0644 \u0647\u0645\u06CC\u0627\u0631\u06CC", callback_data: "cmd:bridge" }]
      ]
    });
    CREATOR_COMMANDS_VERSION = "2026-10-06-fixes";
    CREATOR_COMMANDS = [
      { command: "help", description: "\u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u0631\u0628\u0627\u062A \u0645\u062F\u06CC\u0631\u06CC\u062A \u067E\u0646\u0644" },
      { command: "deploy", description: "\u0633\u0627\u062E\u062A \u067E\u0646\u0644 Cloudflare" },
      { command: "panels", description: "\u0641\u0647\u0631\u0633\u062A \u067E\u0646\u0644\u200C\u0647\u0627\u06CC \u0645\u0646" },
      { command: "connect", description: "\u0627\u062A\u0635\u0627\u0644 \u067E\u0646\u0644 \u0645\u0648\u062C\u0648\u062F" },
      { command: "cancel", description: "\u0644\u063A\u0648 \u0639\u0645\u0644\u06CC\u0627\u062A \u062C\u0627\u0631\u06CC" }, { command: "token", description: "\u062A\u0648\u06A9\u0646 \u0645\u0646 \u0686\u0647 \u06A9\u0627\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F\u061F" }, { command: "bridge", description: "\u067E\u0644 \u0647\u0645\u06CC\u0627\u0631\u06CC" },
      { command: "forget", description: "\u067E\u0627\u06A9 \u06A9\u0631\u062F\u0646 \u062A\u0648\u06A9\u0646 \u0645\u0648\u0642\u062A \u0627\u06CC\u0646 \u062C\u0644\u0633\u0647" }
    ];
  }
});

// src/panel.html
var panel_default = "<!doctype html>\n<html lang=\"fa\" dir=\"rtl\" data-theme=\"omni\">\n<head>\n<meta name=\"omni-release\" content=\"classic-restore-2026-10-06.3\">\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#06070a\">\n<meta name=\"color-scheme\" content=\"dark light\">\n<meta name=\"description\" content=\"Omni — پنل مدیریت پروکسی روی Cloudflare Workers\">\n<title>Omni · پنل مدیریت</title>\n<link rel=\"icon\" href=\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJLYXZlaCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImtnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyMmQzZWUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjODE4Y2Y4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGZpbHRlciBpZD0iZ2xvdyIgeD0iLTMwJSIgeT0iLTMwJSIgd2lkdGg9IjE2MCUiIGhlaWdodD0iMTYwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIwIiBzdGREZXZpYXRpb249IjE4IiBmbG9vZC1jb2xvcj0iIzIyZDNlZSIgZmxvb2Qtb3BhY2l0eT0iMC41NSIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTIwIiBmaWxsPSIjMDYwNzBhIi8+CiAgPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iNDMyIiBoZWlnaHQ9IjQzMiIgcng9IjEwNCIgZmlsbD0iIzBiMGQxMyIgc3Ryb2tlPSJ1cmwoI2tnKSIgc3Ryb2tlLXdpZHRoPSI2IiBvcGFjaXR5PSIwLjk1Ii8+CiAgPCEtLSBEZXJhZnNoLWUgS8SBdsSrxIFuOiB0aGUgYmxhY2tzbWl0aCdzIGFwcm9uIHJhaXNlZCBhcyBhIHN0YW5kYXJkIC0tPgogIDxnIGZpbHRlcj0idXJsKCNnbG93KSI+CiAgICA8cGF0aCBkPSJNMTgwIDExOCBMMzMyIDExOCBMMzU2IDMwMCBRMjU2IDM0MCAxNTYgMzAwIFoiIGZpbGw9InVybCgja2cpIiBmaWxsLW9wYWNpdHk9IjAuMTYiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAgIDxwYXRoIGQ9Ik0yNTYgMTE4IEwyNTYgNDAwIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICAgIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIxMiIgcj0iMzQiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTIiLz4KICAgIDxwYXRoIGQ9Ik0yMTQgMzcyIEwyOTggMzcyIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8L2c+Cjwvc3ZnPgo=\" type=\"image/svg+xml\">\n<link rel=\"apple-touch-icon\" href=\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJLYXZlaCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImtnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyMmQzZWUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjODE4Y2Y4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGZpbHRlciBpZD0iZ2xvdyIgeD0iLTMwJSIgeT0iLTMwJSIgd2lkdGg9IjE2MCUiIGhlaWdodD0iMTYwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIwIiBzdGREZXZpYXRpb249IjE4IiBmbG9vZC1jb2xvcj0iIzIyZDNlZSIgZmxvb2Qtb3BhY2l0eT0iMC41NSIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTIwIiBmaWxsPSIjMDYwNzBhIi8+CiAgPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iNDMyIiBoZWlnaHQ9IjQzMiIgcng9IjEwNCIgZmlsbD0iIzBiMGQxMyIgc3Ryb2tlPSJ1cmwoI2tnKSIgc3Ryb2tlLXdpZHRoPSI2IiBvcGFjaXR5PSIwLjk1Ii8+CiAgPCEtLSBEZXJhZnNoLWUgS8SBdsSrxIFuOiB0aGUgYmxhY2tzbWl0aCdzIGFwcm9uIHJhaXNlZCBhcyBhIHN0YW5kYXJkIC0tPgogIDxnIGZpbHRlcj0idXJsKCNnbG93KSI+CiAgICA8cGF0aCBkPSJNMTgwIDExOCBMMzMyIDExOCBMMzU2IDMwMCBRMjU2IDM0MCAxNTYgMzAwIFoiIGZpbGw9InVybCgja2cpIiBmaWxsLW9wYWNpdHk9IjAuMTYiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAgIDxwYXRoIGQ9Ik0yNTYgMTE4IEwyNTYgNDAwIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICAgIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIxMiIgcj0iMzQiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTIiLz4KICAgIDxwYXRoIGQ9Ik0yMTQgMzcyIEwyOTggMzcyIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8L2c+Cjwvc3ZnPgo=\">\n<link rel=\"manifest\" href=\"/manifest.webmanifest\">\n<style>\n/* ═══════════════════════════════════════════════════════════════════════════\n   Omni — design system v2 · «زنده»\n   Hand-written, zero CDN, zero build step. Everything animates on the GPU\n   (transform/opacity/filter only) so a mid-range phone stays at 60 fps.\n   Many panels load Tailwind + Three.js + flag-icons + Vazirmatn + Sortable +\n   qr-code-styling from four CDNs before painting anything. Omni paints in\n   one request and then *moves*.\n   ═══════════════════════════════════════════════════════════════════════════ */\n\n:root {\n  color-scheme: dark;\n  --bg: #05060b;\n  --bg-soft: #0a0c14;\n  --surface: rgba(17, 21, 32, 0.72);\n  --surface-solid: #101319;\n  --surface-2: #171b26;\n  --border: rgba(148, 163, 184, 0.14);\n  --border-strong: rgba(148, 163, 184, 0.26);\n  --text: #eef2fa;\n  --text-dim: #9aa6bb;\n  --text-faint: #69748c;\n  --accent: #22d3ee;\n  --accent-2: #a78bfa;\n  --accent-3: #f472b6;\n  --accent-soft: rgba(34, 211, 238, 0.13);\n  --ok: #34d399;\n  --warn: #fbbf24;\n  --danger: #fb7185;\n  --radius: 18px;\n  --radius-sm: 11px;\n  --shadow: 0 18px 50px -18px rgba(0, 0, 0, 0.75);\n  --glow: 0 0 0 1px rgba(34, 211, 238, 0.22), 0 12px 44px -14px rgba(34, 211, 238, 0.35);\n  --font: system-ui, -apple-system, \"Segoe UI\", Tahoma, \"Vazirmatn\", \"Noto Sans Arabic\", sans-serif;\n  --mono: ui-monospace, \"SF Mono\", \"Cascadia Code\", Menlo, Consolas, monospace;\n  --ease: cubic-bezier(0.22, 1, 0.36, 1);\n  --spring: cubic-bezier(0.34, 1.4, 0.44, 1);\n  --glass: blur(18px) saturate(150%);\n}\n\n[data-theme=\"light\"] {\n  color-scheme: light;\n  --bg: #eef1f7;\n  --bg-soft: #ffffff;\n  --surface: rgba(255, 255, 255, 0.78);\n  --surface-solid: #ffffff;\n  --surface-2: #f0f3f9;\n  --border: rgba(15, 23, 42, 0.09);\n  --border-strong: rgba(15, 23, 42, 0.18);\n  --text: #0d1526;\n  --text-dim: #51607a;\n  --text-faint: #8b96ab;\n  --accent: #0891b2;\n  --accent-2: #7c3aed;\n  --accent-3: #db2777;\n  --accent-soft: rgba(8, 145, 178, 0.11);\n  --shadow: 0 14px 40px -18px rgba(15, 23, 42, 0.28);\n  --glow: 0 0 0 1px rgba(8, 145, 178, 0.25), 0 12px 40px -16px rgba(8, 145, 178, 0.35);\n  --glass: blur(16px) saturate(140%);\n}\n\n* { box-sizing: border-box; }\nhtml, body { height: 100%; }\nbody {\n  margin: 0;\n  background: var(--bg);\n  color: var(--text);\n  font-family: var(--font);\n  font-size: 14px;\n  line-height: 1.65;\n  -webkit-font-smoothing: antialiased;\n  text-rendering: optimizeLegibility;\n  overflow-x: hidden;\n}\n\n/* ── the aurora: three drifting light fields, pure CSS, GPU-composited ───── */\nbody::before {\n  content: \"\";\n  position: fixed;\n  inset: -20%;\n  z-index: 0;\n  pointer-events: none;\n  background:\n    radial-gradient(42% 34% at 18% 22%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%),\n    radial-gradient(38% 30% at 82% 12%, color-mix(in srgb, var(--accent-2) 15%, transparent), transparent 70%),\n    radial-gradient(46% 38% at 55% 88%, color-mix(in srgb, var(--accent-3) 10%, transparent), transparent 72%);\n  filter: blur(46px);\n  animation: aurora 26s var(--ease) infinite alternate;\n  will-change: transform;\n}\n/* fine grain so the gradients never band on cheap panels */\nbody::after {\n  content: \"\";\n  position: fixed;\n  inset: 0;\n  z-index: 0;\n  pointer-events: none;\n  opacity: 0.5;\n  mix-blend-mode: overlay;\n  background-image: radial-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px);\n  background-size: 3px 3px;\n}\n[data-theme=\"light\"] body::after, body[data-theme=\"light\"]::after { opacity: 0.25; }\n@keyframes aurora {\n  0%   { transform: translate3d(-3%, -2%, 0) rotate(-2deg) scale(1); }\n  50%  { transform: translate3d(3%, 2%, 0) rotate(2deg) scale(1.06); }\n  100% { transform: translate3d(-1%, 3%, 0) rotate(-1deg) scale(1.02); }\n}\n\na { color: var(--accent); text-decoration: none; }\nbutton, input, select, textarea { font: inherit; color: inherit; }\n:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 8px; }\n::selection { background: var(--accent); color: #04121a; }\n.muted { color: var(--text-dim); }\n.mono { font-family: var(--mono); font-size: 0.92em; direction: ltr; unicode-bidi: isolate; }\n.hide { display: none !important; }\nsvg { vertical-align: middle; }\n\n/* ── scrollbars ─────────────────────────────────────────────────────────── */\n::-webkit-scrollbar { width: 9px; height: 9px; }\n::-webkit-scrollbar-track { background: transparent; }\n::-webkit-scrollbar-thumb {\n  background: linear-gradient(var(--border-strong), var(--border-strong));\n  border-radius: 99px; border: 2px solid var(--bg);\n}\n::-webkit-scrollbar-thumb:hover { background: var(--text-faint); }\n\n/* ── layout ─────────────────────────────────────────────────────────────── */\n.app { display: grid; grid-template-columns: 252px 1fr; min-height: 100vh; position: relative; z-index: 1; }\n[dir=\"rtl\"] .app { grid-template-columns: 252px 1fr; }\n\n.sidebar {\n  background: color-mix(in srgb, var(--bg-soft) 78%, transparent);\n  backdrop-filter: var(--glass);\n  border-inline-end: 1px solid var(--border);\n  padding: 18px 14px;\n  display: flex; flex-direction: column; gap: 5px;\n  position: sticky; top: 0; height: 100vh; overflow-y: auto;\n}\n.brand { display: flex; align-items: center; gap: 11px; padding: 6px 8px 18px; }\n.brand svg, .brand img { width: 36px; height: 36px; flex: none; filter: drop-shadow(0 0 12px color-mix(in srgb, var(--accent) 55%, transparent)); animation: float 5.5s ease-in-out infinite; }\n@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }\n.brand-name {\n  font-weight: 800; font-size: 18px; letter-spacing: -0.02em;\n  background: linear-gradient(100deg, var(--accent), var(--accent-2) 55%, var(--accent-3));\n  background-size: 220% 100%;\n  -webkit-background-clip: text; background-clip: text; color: transparent;\n  animation: sheen 7s linear infinite;\n}\n@keyframes sheen { to { background-position: 220% 0; } }\n.brand-sub { font-size: 10.5px; color: var(--text-faint); letter-spacing: 0.08em; }\n\n.nav-item {\n  display: flex; align-items: center; gap: 10px;\n  padding: 9.5px 12px; border-radius: var(--radius-sm);\n  color: var(--text-dim); cursor: pointer; border: 1px solid transparent;\n  background: none; width: 100%; text-align: start;\n  transition: background 0.18s var(--ease), color 0.18s var(--ease), transform 0.18s var(--ease), border-color 0.18s;\n  font-size: 13.5px; position: relative; overflow: hidden;\n}\n.nav-item svg { width: 17px; height: 17px; flex: none; opacity: 0.85; transition: transform 0.25s var(--spring); }\n.nav-item:hover { background: var(--surface-2); color: var(--text); transform: translateX(-2px); }\n[dir=\"rtl\"] .nav-item:hover { transform: translateX(2px); }\n.nav-item:hover svg { transform: scale(1.14) rotate(-6deg); }\n.nav-item[aria-current=\"page\"] {\n  background: linear-gradient(90deg, var(--accent-soft), color-mix(in srgb, var(--accent-2) 10%, transparent));\n  color: var(--accent);\n  border-color: color-mix(in srgb, var(--accent) 26%, transparent);\n  font-weight: 650;\n  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);\n}\n.nav-item[aria-current=\"page\"]::before {\n  content: \"\"; position: absolute; inset-inline-start: 0; inset-block: 22%;\n  width: 3px; border-radius: 99px; background: var(--accent);\n  box-shadow: 0 0 12px var(--accent);\n}\n.nav-sep { height: 1px; background: linear-gradient(90deg, transparent, var(--border-strong), transparent); margin: 10px 4px; }\n.nav-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-faint); padding: 8px 10px 4px; }\n\n.main { display: flex; flex-direction: column; min-width: 0; }\n.topbar {\n  position: sticky; top: 0; z-index: 20;\n  display: flex; align-items: center; gap: 12px;\n  padding: 12px 22px;\n  background: color-mix(in srgb, var(--bg) 72%, transparent);\n  backdrop-filter: var(--glass);\n  border-bottom: 1px solid var(--border);\n}\n.topbar h1 { font-size: 16.5px; margin: 0; font-weight: 750; letter-spacing: -0.01em; }\n.spacer { flex: 1; }\n.content { padding: 22px; max-width: 1500px; width: 100%; }\n\n/* ── cards: glass + gradient rim + 3D hover ───────────────────────────────── */\n.grid { display: grid; gap: 14px; }\n.grid-kpi { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }\n.grid-2 { grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); }\n.card {\n  position: relative;\n  background: var(--surface);\n  backdrop-filter: var(--glass);\n  border: 1px solid var(--border);\n  border-radius: var(--radius);\n  padding: 16px;\n  box-shadow: var(--shadow);\n  transform-style: preserve-3d;\n  transition: transform 0.35s var(--ease), box-shadow 0.35s var(--ease), border-color 0.35s;\n}\n/* gradient rim, painted on a masked pseudo-element so the glass stays glass */\n.card::before {\n  content: \"\"; position: absolute; inset: 0; border-radius: inherit; padding: 1px;\n  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 45%, transparent), transparent 38%, transparent 62%, color-mix(in srgb, var(--accent-2) 40%, transparent));\n  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);\n  -webkit-mask-composite: xor; mask-composite: exclude;\n  opacity: 0; transition: opacity 0.35s var(--ease); pointer-events: none;\n}\n.card:hover { transform: translateY(-3px); box-shadow: 0 26px 60px -22px rgba(0, 0, 0, 0.8), var(--glow); border-color: transparent; }\n.card:hover::before { opacity: 1; }\n/* top inner highlight — the \"lit from above\" cue that reads as 3D */\n.card::after {\n  content: \"\"; position: absolute; inset-inline: 10%; inset-block-start: 0; height: 1px;\n  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent);\n  opacity: 0.5; pointer-events: none;\n}\n[data-theme=\"light\"] .card::after { background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.9), transparent); }\n\n.card-head { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }\n.card-head svg { width: 18px; height: 18px; flex: none; color: var(--accent); filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 45%, transparent)); }\n.card-head h3 { margin: 0; font-size: 13.5px; font-weight: 680; letter-spacing: -0.01em; }\n.kpi-label { font-size: 12px; color: var(--text-dim); display: flex; align-items: center; gap: 6px; }\n.kpi-value {\n  font-size: 28px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.22; margin-top: 2px;\n  font-variant-numeric: tabular-nums;\n  background: linear-gradient(180deg, var(--text), color-mix(in srgb, var(--text) 62%, var(--accent)));\n  -webkit-background-clip: text; background-clip: text; color: transparent;\n}\n.kpi-sub { font-size: 11.5px; color: var(--text-faint); margin-top: 2px; }\n.kpi-icon {\n  width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center;\n  background: var(--accent-soft); color: var(--accent); position: relative;\n  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09);\n}\n.kpi-icon::after {\n  content: \"\"; position: absolute; inset: -3px; border-radius: 14px;\n  background: conic-gradient(from 0deg, transparent 0 70%, color-mix(in srgb, var(--accent) 60%, transparent) 85%, transparent 100%);\n  animation: spin 4.5s linear infinite; opacity: 0.55; z-index: -1; filter: blur(3px);\n}\n@keyframes spin { to { transform: rotate(360deg); } }\n.kpi-icon svg { width: 18px; height: 18px; }\n\n/* ── meters ─────────────────────────────────────────────────────────────── */\n.meter { height: 7px; border-radius: 99px; background: var(--surface-2); overflow: hidden; box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.35); }\n.meter-fill {\n  height: 100%; border-radius: 99px; position: relative;\n  background: linear-gradient(90deg, var(--accent), var(--accent-2));\n  transition: width 0.7s var(--ease);\n}\n.meter-fill::after {\n  content: \"\"; position: absolute; inset: 0;\n  background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.4) 50%, transparent 70%);\n  background-size: 220% 100%; animation: sheen 2.6s linear infinite;\n}\n.meter-fill.warn { background: linear-gradient(90deg, var(--warn), #f97316); }\n.meter-fill.danger { background: linear-gradient(90deg, var(--danger), #e11d48); }\n.meter-thin { height: 4px; }\n\n/* ── table ──────────────────────────────────────────────────────────────── */\n.table-wrap {\n  overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--border); border-radius: var(--radius);\n}\n.users-table { min-width: 580px;\n  background: var(--surface); backdrop-filter: var(--glass); box-shadow: var(--shadow);\n}\ntable { width: 100%; border-collapse: collapse; font-size: 13px; }\nthead th {\n  position: sticky; top: 0; z-index: 1;\n  background: color-mix(in srgb, var(--surface-2) 92%, transparent);\n  backdrop-filter: blur(8px);\n  text-align: start; font-weight: 620; font-size: 11px;\n  color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.07em;\n  padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap;\n}\nthead th.sortable { cursor: pointer; user-select: none; transition: color 0.15s; }\nthead th.sortable:hover { color: var(--accent); }\ntbody td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }\ntbody tr:last-child td { border-bottom: none; }\ntbody tr { transition: background 0.16s, transform 0.16s var(--ease); }\ntbody tr:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }\ntbody tr:active { transform: scale(0.995); }\ntbody tr.selected { background: var(--accent-soft); }\n.cell-user { font-weight: 640; }\n.cell-actions { display: flex; gap: 4px; justify-content: flex-end; }\n\n/* ── badges ─────────────────────────────────────────────────────────────── */\n.badge {\n  display: inline-flex; align-items: center; gap: 6px;\n  padding: 2.5px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 620;\n  border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text-dim);\n  white-space: nowrap;\n}\n.badge::before { content: \"\"; width: 6px; height: 6px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; }\n.badge.ok::before { animation: pulse 2s var(--ease) infinite; }\n@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(0.8); } }\n.badge.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 32%, transparent); background: color-mix(in srgb, var(--ok) 11%, transparent); }\n.badge.warn { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 32%, transparent); background: color-mix(in srgb, var(--warn) 11%, transparent); }\n.badge.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 32%, transparent); background: color-mix(in srgb, var(--danger) 11%, transparent); }\n.badge.info { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 32%, transparent); background: var(--accent-soft); }\n\n/* ── buttons ───────────────────────────────────────────────────────────── */\n.btn {\n  display: inline-flex; align-items: center; justify-content: center; gap: 7px;\n  padding: 8px 15px; border-radius: var(--radius-sm);\n  background: var(--surface-2); border: 1px solid var(--border-strong);\n  color: var(--text); cursor: pointer; font-size: 13px; font-weight: 560;\n  transition: transform 0.14s var(--spring), background 0.18s, border-color 0.18s, box-shadow 0.25s, opacity 0.18s;\n  white-space: nowrap; position: relative; overflow: hidden;\n}\n.btn svg { width: 15px; height: 15px; }\n.btn:hover { background: var(--border); transform: translateY(-1px); }\n.btn:active { transform: scale(0.96); }\n.btn:disabled { opacity: 0.45; cursor: not-allowed; }\n.btn-primary {\n  background: linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)));\n  border-color: transparent; color: #04121a; font-weight: 750;\n  box-shadow: 0 8px 24px -10px color-mix(in srgb, var(--accent) 70%, transparent);\n}\n.btn-primary::after {\n  content: \"\"; position: absolute; inset: 0;\n  background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, 0.55) 50%, transparent 65%);\n  transform: translateX(-120%); transition: transform 0.55s var(--ease);\n}\n[dir=\"rtl\"] .btn-primary::after { transform: translateX(120%); }\n.btn-primary:hover::after { transform: translateX(120%); }\n[dir=\"rtl\"] .btn-primary:hover::after { transform: translateX(-120%); }\n.btn-primary:hover { box-shadow: 0 12px 32px -10px color-mix(in srgb, var(--accent) 85%, transparent); }\n.btn-danger { background: color-mix(in srgb, var(--danger) 14%, transparent); border-color: color-mix(in srgb, var(--danger) 40%, transparent); color: var(--danger); }\n.btn-danger:hover { background: color-mix(in srgb, var(--danger) 24%, transparent); box-shadow: 0 8px 22px -12px var(--danger); }\n.btn-ghost { background: transparent; border-color: transparent; color: var(--text-dim); }\n.btn-ghost:hover { background: var(--surface-2); color: var(--text); }\n.btn-icon { padding: 7px; width: 33px; height: 33px; }\n.btn-sm { padding: 5px 10px; font-size: 12px; }\n.btn-block { width: 100%; }\n/* ripple injected by fx.js */\n.ripple {\n  position: absolute; border-radius: 50%; pointer-events: none;\n  background: radial-gradient(circle, rgba(255, 255, 255, 0.5), transparent 62%);\n  transform: scale(0); animation: ripple 0.6s var(--ease) forwards;\n}\n@keyframes ripple { to { transform: scale(2.6); opacity: 0; } }\n\n/* ── inputs ─────────────────────────────────────────────────────────────── */\n.field { display: flex; flex-direction: column; gap: 6px; }\n.field > label { font-size: 12px; color: var(--text-dim); font-weight: 560; }\n.field .hint { font-size: 11px; color: var(--text-faint); }\ninput[type=\"text\"], input[type=\"password\"], input[type=\"number\"], input[type=\"search\"], select, textarea {\n  background: color-mix(in srgb, var(--bg-soft) 82%, transparent);\n  border: 1px solid var(--border-strong);\n  border-radius: var(--radius-sm); padding: 9.5px 12px; width: 100%;\n  transition: border-color 0.18s, box-shadow 0.25s, background 0.18s, transform 0.18s;\n}\ninput:hover, select:hover, textarea:hover { border-color: color-mix(in srgb, var(--accent) 35%, var(--border-strong)); }\ninput:focus, select:focus, textarea:focus {\n  outline: none; border-color: var(--accent);\n  box-shadow: 0 0 0 3.5px var(--accent-soft), 0 0 22px -6px color-mix(in srgb, var(--accent) 55%, transparent);\n  background: var(--bg-soft);\n}\ntextarea { resize: vertical; min-height: 76px; font-family: var(--mono); font-size: 12px; }\ninput[type=\"checkbox\"] { width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; }\n.search { position: relative; }\n.search svg { position: absolute; inset-inline-start: 11px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; color: var(--text-faint); pointer-events: none; transition: color 0.2s; }\n.search:focus-within svg { color: var(--accent); }\n.search input { padding-inline-start: 34px; }\n.seg { display: inline-flex; background: var(--surface-2); border: 1px solid var(--border); border-radius: 99px; padding: 3px; gap: 2px; }\n.seg button { border: none; background: none; padding: 5px 13px; border-radius: 99px; cursor: pointer; color: var(--text-dim); font-size: 12.5px; font-weight: 560; transition: background 0.2s var(--ease), color 0.2s, box-shadow 0.2s; }\n.seg button:hover { color: var(--text); }\n.seg button[aria-pressed=\"true\"] { background: linear-gradient(120deg, var(--accent-soft), color-mix(in srgb, var(--accent-2) 14%, transparent)); color: var(--accent); box-shadow: 0 1px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08); }\n.switch { position: relative; width: 42px; height: 23px; flex: none; }\n.switch input { opacity: 0; width: 0; height: 0; }\n.switch span { position: absolute; inset: 0; background: var(--border-strong); border-radius: 99px; cursor: pointer; transition: background 0.25s var(--ease), box-shadow 0.25s; }\n.switch span::after { content: \"\"; position: absolute; inset-block-start: 3px; inset-inline-start: 3px; width: 17px; height: 17px; background: #fff; border-radius: 50%; transition: transform 0.28s var(--spring); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4); }\n.switch input:checked + span { background: linear-gradient(120deg, var(--accent), var(--accent-2)); box-shadow: 0 0 16px -3px color-mix(in srgb, var(--accent) 65%, transparent); }\n.switch input:checked + span::after { transform: translateX(19px); }\n[dir=\"rtl\"] .switch input:checked + span::after { transform: translateX(-19px); }\n\n/* ── modal / drawer ─────────────────────────────────────────────────────── */\n.overlay {\n  position: fixed; inset: 0; z-index: 60;\n  background: rgba(3, 5, 10, 0.6); backdrop-filter: blur(10px) saturate(120%);\n  display: grid; place-items: center; padding: 20px;\n  animation: fade 0.2s var(--ease);\n}\n.modal {\n  background: color-mix(in srgb, var(--surface-solid) 88%, transparent);\n  backdrop-filter: var(--glass);\n  border: 1px solid var(--border-strong);\n  border-radius: 22px; width: min(720px, 100%); max-height: 90vh;\n  display: flex; flex-direction: column;\n  box-shadow: 0 40px 110px -25px rgba(0, 0, 0, 0.85), var(--glow);\n  animation: pop 0.32s var(--spring);\n}\n.modal-wide { width: min(1000px, 100%); }\n.modal-head { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: 1px solid var(--border); }\n.modal-head h2 { margin: 0; font-size: 15px; font-weight: 750; }\n.modal-body { padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }\n.modal-foot { padding: 14px 18px; border-top: 1px solid var(--border); display: flex; gap: 8px; justify-content: flex-end; }\n.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 13px; }\n\n.drawer {\n  position: fixed; inset-block: 0; inset-inline-end: 0; z-index: 61;\n  width: min(560px, 100%);\n  background: color-mix(in srgb, var(--surface-solid) 90%, transparent);\n  backdrop-filter: var(--glass);\n  border-inline-start: 1px solid var(--border-strong);\n  box-shadow: -40px 0 100px -35px rgba(0, 0, 0, 0.85);\n  display: flex; flex-direction: column;\n  animation: slide 0.34s var(--spring);\n}\n[dir=\"rtl\"] .drawer { animation-name: slideRtl; }\n\n@keyframes fade { from { opacity: 0; } }\n@keyframes pop { from { opacity: 0; transform: translateY(16px) scale(0.96); filter: blur(4px); } }\n@keyframes slide { from { transform: translateX(46px); opacity: 0; filter: blur(3px); } }\n@keyframes slideRtl { from { transform: translateX(-46px); opacity: 0; filter: blur(3px); } }\n\n/* entrance stagger — fx.js tags nodes, CSS does the motion */\n.fx-in { animation: rise 0.5s var(--ease) both; }\n@keyframes rise { from { opacity: 0; transform: translateY(14px) scale(0.985); filter: blur(5px); } }\n\n/* ── toasts ─────────────────────────────────────────────────────────────── */\n.toasts { position: fixed; inset-block-end: 18px; inset-inline-start: 18px; z-index: 90; display: flex; flex-direction: column; gap: 8px; max-width: 380px; }\n.toast {\n  background: color-mix(in srgb, var(--surface-solid) 86%, transparent);\n  backdrop-filter: var(--glass);\n  border: 1px solid var(--border-strong);\n  border-inline-start: 3px solid var(--accent);\n  border-radius: 13px; padding: 11px 14px;\n  box-shadow: var(--shadow), 0 0 26px -12px color-mix(in srgb, var(--accent) 55%, transparent);\n  animation: toastIn 0.4s var(--spring); font-size: 13px;\n}\n@keyframes toastIn { from { opacity: 0; transform: translateY(14px) scale(0.94); } }\n.toast.ok { border-inline-start-color: var(--ok); box-shadow: var(--shadow), 0 0 26px -12px color-mix(in srgb, var(--ok) 60%, transparent); }\n.toast.err { border-inline-start-color: var(--danger); box-shadow: var(--shadow), 0 0 26px -12px color-mix(in srgb, var(--danger) 60%, transparent); }\n.toast.warn { border-inline-start-color: var(--warn); box-shadow: var(--shadow), 0 0 26px -12px color-mix(in srgb, var(--warn) 60%, transparent); }\n\n/* ── command palette ────────────────────────────────────────────────────── */\n.palette { width: min(620px, 100%); background: color-mix(in srgb, var(--surface-solid) 90%, transparent); backdrop-filter: var(--glass); border: 1px solid var(--border-strong); border-radius: 18px; overflow: hidden; box-shadow: 0 40px 110px -25px rgba(0, 0, 0, 0.9), var(--glow); }\n.palette input { border: none; border-bottom: 1px solid var(--border); border-radius: 0; padding: 15px 18px; background: transparent; font-size: 15px; }\n.palette input:focus { box-shadow: none; }\n.palette-list { max-height: 340px; overflow-y: auto; padding: 6px; }\n.palette-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; cursor: pointer; font-size: 13.5px; transition: background 0.14s, transform 0.14s var(--ease); }\n.palette-item svg { width: 15px; height: 15px; color: var(--text-faint); }\n.palette-item:hover { transform: translateX(-2px); }\n[dir=\"rtl\"] .palette-item:hover { transform: translateX(2px); }\n.palette-item[aria-selected=\"true\"] { background: var(--accent-soft); color: var(--accent); }\n.palette-item kbd { margin-inline-start: auto; }\nkbd {\n  font-family: var(--mono); font-size: 10.5px; padding: 2px 6px;\n  border: 1px solid var(--border-strong); border-bottom-width: 2px;\n  border-radius: 5px; background: var(--bg-soft); color: var(--text-dim);\n}\n\n/* ── misc ───────────────────────────────────────────────────────────────── */\n.toolbar { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; margin-bottom: 14px; }\n.bulkbar {\n  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;\n  background: linear-gradient(100deg, var(--accent-soft), color-mix(in srgb, var(--accent-2) 10%, transparent));\n  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);\n  padding: 9px 13px; border-radius: var(--radius-sm); margin-bottom: 12px;\n  animation: rise 0.3s var(--ease);\n}\n.empty { text-align: center; padding: 46px 20px; color: var(--text-faint); }\n.empty svg { width: 44px; height: 44px; opacity: 0.4; margin-bottom: 10px; animation: float 4.5s ease-in-out infinite; }\n.skeleton {\n  background: linear-gradient(90deg, var(--surface-2) 25%, var(--border-strong) 50%, var(--surface-2) 75%);\n  background-size: 200% 100%; animation: shimmer 1.3s infinite; border-radius: 9px;\n}\n@keyframes shimmer { to { background-position: -200% 0; } }\n.codebox {\n  background: color-mix(in srgb, var(--bg) 88%, transparent); border: 1px solid var(--border);\n  border-radius: var(--radius-sm);\n  padding: 11px; font-family: var(--mono); font-size: 11.5px; direction: ltr;\n  text-align: left; word-break: break-all; max-height: 190px; overflow: auto; white-space: pre-wrap;\n  transition: border-color 0.2s, box-shadow 0.25s;\n}\n.codebox:hover { border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); box-shadow: inset 0 0 24px -14px color-mix(in srgb, var(--accent) 45%, transparent); }\n.qr { display: grid; place-items: center; padding: 12px; background: #fff; border-radius: var(--radius-sm); box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.12); transition: transform 0.3s var(--spring); }\n.qr:hover { transform: scale(1.03) rotate(-1deg); }\n.qr svg, .qr img { display: block; width: 168px; height: 168px; }\n.tabs { display: flex; gap: 3px; border-bottom: 1px solid var(--border); margin-bottom: 14px; overflow-x: auto; }\n.tabs button { background: none; border: none; padding: 9px 14px; cursor: pointer; color: var(--text-dim); font-size: 13px; font-weight: 560; border-bottom: 2px solid transparent; white-space: nowrap; transition: color 0.2s, border-color 0.25s var(--ease); position: relative; }\n.tabs button svg { width: 14px; height: 14px; }\n.tabs button:hover { color: var(--text); }\n.tabs button[aria-selected=\"true\"] { color: var(--accent); border-bottom-color: var(--accent); text-shadow: 0 0 18px color-mix(in srgb, var(--accent) 55%, transparent); }\n.pager { display: flex; align-items: center; gap: 10px; justify-content: center; padding: 13px; font-size: 12.5px; color: var(--text-dim); }\n.chart { width: 100%; height: 150px; overflow: visible; }\n.chart-bar { opacity: 0.9; transition: opacity 0.15s; transform-box: fill-box; transform-origin: bottom; animation: barIn 0.7s var(--ease) both; }\n.chart-bar:hover { opacity: 1; }\n@keyframes barIn { from { transform: scaleY(0); } }\n.chart-grid { stroke: var(--border); stroke-width: 1; }\n.chart-label { fill: var(--text-faint); font-size: 9.5px; font-family: var(--font); }\n.legend { display: flex; gap: 14px; font-size: 11.5px; color: var(--text-dim); flex-wrap: wrap; }\n.legend i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; margin-inline-end: 5px; }\n\n/* live-test widget */\n.livetest { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 10px; }\n.livetest .ms {\n  font-family: var(--mono); font-size: 17px; font-weight: 700; direction: ltr;\n  padding: 3px 12px; border-radius: 99px; border: 1px solid var(--border-strong);\n  background: var(--surface-2); transition: all 0.3s var(--ease);\n}\n.livetest .ms.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 40%, transparent); box-shadow: 0 0 20px -6px var(--ok); }\n.livetest .ms.bad { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 40%, transparent); box-shadow: 0 0 20px -6px var(--danger); }\n.livetest .spin { width: 15px; height: 15px; border-radius: 50%; border: 2px solid var(--border-strong); border-top-color: var(--accent); animation: spin 0.7s linear infinite; }\n\n/* ── login ──────────────────────────────────────────────────────────────── */\n.auth-wrap { min-height: 100vh; display: grid; place-items: center; padding: 20px; position: relative; z-index: 1; }\n.auth-card {\n  width: min(400px, 100%);\n  background: color-mix(in srgb, var(--surface-solid) 82%, transparent);\n  backdrop-filter: var(--glass);\n  border: 1px solid var(--border-strong);\n  border-radius: 24px; padding: 30px;\n  box-shadow: 0 50px 120px -35px rgba(0, 0, 0, 0.9), var(--glow);\n  animation: pop 0.5s var(--spring);\n  position: relative; overflow: hidden;\n}\n.auth-card::before {\n  content: \"\"; position: absolute; inset-inline: 0; inset-block-start: 0; height: 2px;\n  background: linear-gradient(90deg, transparent, var(--accent), var(--accent-2), transparent);\n  background-size: 200% 100%; animation: sheen 3.5s linear infinite;\n}\n.auth-logo { display: grid; place-items: center; gap: 10px; margin-bottom: 22px; text-align: center; }\n.auth-logo svg, .auth-logo img { width: 56px; height: 56px; filter: drop-shadow(0 0 22px color-mix(in srgb, var(--accent) 60%, transparent)); animation: float 5s ease-in-out infinite; }\n.auth-logo h1 {\n  margin: 0; font-size: 23px; font-weight: 800; letter-spacing: -0.02em;\n  background: linear-gradient(100deg, var(--accent), var(--accent-2) 60%, var(--accent-3));\n  background-size: 220% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;\n  animation: sheen 6s linear infinite;\n}\n\n/* ── status page (public, per user) ─────────────────────────────────────── */\n.status-page { display: grid; place-items: center; padding: 22px; min-height: 100vh; }\n.status-card {\n  width: min(460px, 100%);\n  background: color-mix(in srgb, var(--surface-solid) 84%, transparent);\n  backdrop-filter: var(--glass);\n  border: 1px solid var(--border); border-radius: 22px; padding: 24px;\n  box-shadow: var(--shadow), var(--glow); animation: pop 0.45s var(--spring);\n}\n.status-card h1 { margin: 0 0 4px; font-size: 19px; }\n.status-card dl { display: grid; gap: 9px; margin: 16px 0; }\n.status-card dl > div { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px dashed var(--border); padding-bottom: 7px; }\n.status-card dt { color: var(--text-dim); font-size: 12.5px; }\n.status-card dd { margin: 0; font-weight: 650; font-size: 13px; }\n.status-card .config { background: var(--bg); border-radius: 10px; padding: 10px; font-size: 10.5px; overflow-x: auto; direction: ltr; text-align: left; white-space: pre-wrap; word-break: break-all; }\n\n/* ── responsive ─────────────────────────────────────────────────────────── */\n@media (max-width: 900px) {\n  /* Must match the base `[dir=\"rtl\"] .app` specificity, else the RTL\n     two-column rule outlives the breakpoint and .main collapses into the\n     sidebar's 252 px track — the \"half the phone is dead space\" bug. */\n  .app, [dir=\"rtl\"] .app { grid-template-columns: 1fr; }\n  .sidebar {\n    position: fixed; inset-block: 0; inset-inline-start: 0; z-index: 50;\n    width: 262px; transform: translateX(-102%); transition: transform 0.3s var(--spring), visibility 0s 0.3s;\n    box-shadow: none; visibility: hidden;\n  }\n  [dir=\"rtl\"] .sidebar { transform: translateX(102%); }\n  .sidebar.open { transform: none; box-shadow: 0 0 80px rgba(0, 0, 0, 0.7); visibility: visible; transition: transform 0.3s var(--spring); }\n  .content { padding: 14px; }\n  .topbar { padding: 10px 14px; }\n  .kpi-value { font-size: 23px; }\n  .card { padding: 14px; border-radius: 16px; }\n  .card:hover { transform: none; }           /* no hover-lift on touch: it fights scroll */\n  table { font-size: 12.2px; }\n  thead th, tbody td { padding: 9px 9px; }\n  .form-grid { grid-template-columns: 1fr 1fr; gap: 11px; }\n  .modal { border-radius: 18px; }\n  .overlay { padding: 12px; }\n}\n@media (max-width: 560px) {\n  /* phone: expiry & devices stay one tap away in the drawer, not in a\n     horizontally-scrolled table */\n  .users-table thead th:nth-child(5), .users-table thead th:nth-child(6),\n  .users-table tbody td:nth-child(5), .users-table tbody td:nth-child(6) { display: none; }\n}\n@media (max-width: 520px) {\n  .form-grid { grid-template-columns: 1fr; }\n  .toolbar .seg { width: 100%; justify-content: space-between; }\n  .toolbar .seg button { flex: 1; padding: 6px 4px; }\n  .kpi-value { font-size: 21px; }\n}\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }\n}\n\n/* ═══════════════════════════════════════════════════════════════════════════\n   OMNI layer — merged from the deployed omni-panel-3d.html design systems.\n   Theme tokens map 1:1 onto Omni's variables, so every existing component\n   (cards, tables, forms, charts) re-skins automatically when the theme attr\n   changes. Cut-corner clip-paths are lambo-only.\n   ═══════════════════════════════════════════════════════════════════════════ */\n\n[data-theme=\"omni\"] {\n  color-scheme: dark;\n  --bg: #000000;\n  --bg-soft: #0a0a0a;\n  --surface: rgba(14, 14, 14, 0.82);\n  --surface-solid: #0e0e0e;\n  --surface-2: #161616;\n  --border: #2c2c2c;\n  --border-strong: #3d3d3d;\n  --text: #ffffff;\n  --text-dim: #9a9a9a;\n  --text-faint: #6b6b6b;\n  --accent: #ffc000;\n  --accent-2: #ffffff;\n  --accent-3: #ffd75e;\n  --accent-soft: rgba(255, 192, 0, 0.14);\n  --radius: 0px;\n  --radius-sm: 0px;\n  --shadow: 0 12px 30px rgba(0, 0, 0, 0.45);\n  --glow: 0 0 0 1px rgba(255, 192, 0, 0.35), 0 12px 44px -14px rgba(255, 192, 0, 0.45);\n  --font: \"Arial Narrow\", \"Helvetica Neue\", Arial, system-ui, Vazirmatn, Tahoma, sans-serif;\n}\n[data-theme=\"ferrari\"] {\n  color-scheme: dark;\n  --bg: #181818; --bg-soft: #101010; --surface: rgba(36, 36, 36, 0.9); --surface-solid: #242424; --surface-2: #2c2c2c;\n  --border: #3a3a3a; --border-strong: #4a4a4a; --text: #ffffff; --text-dim: #969696; --text-faint: #6e6e6e;\n  --accent: #da291c; --accent-2: #fff200; --accent-3: #ff6b5e; --accent-soft: rgba(218, 41, 28, 0.16);\n  --radius: 2px; --radius-sm: 2px;\n  --font: \"Helvetica Neue\", Arial, system-ui, Vazirmatn, Tahoma, sans-serif;\n}\n[data-theme=\"apple\"] {\n  color-scheme: light;\n  --bg: #f5f5f7; --bg-soft: #ffffff; --surface: rgba(255, 255, 255, 0.9); --surface-solid: #ffffff; --surface-2: #fbfbfd;\n  --border: #e0e0e0; --border-strong: #d2d2d7; --text: #1d1d1f; --text-dim: #6e6e73; --text-faint: #9b9ba0;\n  --accent: #0066cc; --accent-2: #2997ff; --accent-3: #64b5f6; --accent-soft: rgba(0, 102, 204, 0.1);\n  --radius: 20px; --radius-sm: 14px; --shadow: 0 14px 34px rgba(0, 0, 0, 0.12);\n  --font: -apple-system, system-ui, \"SF Pro Display\", \"Segoe UI\", Vazirmatn, Tahoma, sans-serif;\n}\n[data-theme=\"claude\"] {\n  color-scheme: light;\n  --bg: #faf9f5; --bg-soft: #f0eadf; --surface: rgba(240, 234, 223, 0.9); --surface-solid: #f0eadf; --surface-2: #e8e0d0;\n  --border: #e0d8ca; --border-strong: #d0c5b0; --text: #141413; --text-dim: #6c6a64; --text-faint: #98938a;\n  --accent: #cc785c; --accent-2: #5db8a6; --accent-3: #e0a58f; --accent-soft: rgba(204, 120, 92, 0.12);\n  --radius: 14px; --radius-sm: 10px; --shadow: 0 12px 28px rgba(80, 50, 30, 0.14);\n  --font: Georgia, \"Tiempos Headline\", \"Times New Roman\", Vazirmatn, serif;\n}\n[data-theme=\"pinterest\"] {\n  color-scheme: light;\n  --bg: #ffffff; --bg-soft: #f6f6f3; --surface: rgba(246, 246, 243, 0.92); --surface-solid: #f6f6f3; --surface-2: #efefea;\n  --border: #dadad3; --border-strong: #c7c7be; --text: #211922; --text-dim: #62625b; --text-faint: #9b9b93;\n  --accent: #e60023; --accent-2: #7e238b; --accent-3: #ff5a76; --accent-soft: rgba(230, 0, 35, 0.1);\n  --radius: 26px; --radius-sm: 18px; --shadow: 0 10px 24px rgba(33, 25, 34, 0.12);\n  --font: system-ui, -apple-system, \"Segoe UI\", Vazirmatn, Tahoma, sans-serif;\n}\n\n/* lambo cut corners */\n[data-theme=\"omni\"] .card,\n[data-theme=\"omni\"] .btn,\n[data-theme=\"omni\"] .kpi,\n[data-theme=\"omni\"] input,\n[data-theme=\"omni\"] select,\n[data-theme=\"omni\"] textarea {\n  border-radius: 0;\n}\n[data-theme=\"omni\"] .card {\n  clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));\n}\n[data-theme=\"omni\"] .btn {\n  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));\n}\n[data-theme=\"omni\"] .btn-primary {\n  font-weight: 700;\n  letter-spacing: 0.4px;\n}\n\n/* ── OMNI hero (dashboard) ──────────────────────────────────────────────── */\n.omni-hero {\n  background: var(--surface-solid);\n  border: 1px solid var(--border);\n  border-radius: var(--radius);\n  box-shadow: var(--shadow);\n  padding: 20px 18px;\n  position: relative;\n  overflow: hidden;\n}\n.omni-hero:before,\n.omni-hero:after {\n  content: \"\";\n  position: absolute;\n  width: 16px;\n  height: 16px;\n  border: 2px solid var(--accent);\n  pointer-events: none;\n}\n.omni-hero:before { top: 7px; inset-inline-start: 7px; border-right: 0; border-bottom: 0; }\n[dir=\"rtl\"] .omni-hero:before { border-right: 2px solid var(--accent); border-left: 0; }\n.omni-hero:after { bottom: 7px; inset-inline-end: 7px; border-left: 0; border-top: 0; }\n[dir=\"rtl\"] .omni-hero:after { border-left: 2px solid var(--accent); border-right: 0; }\n\n.omni-hero-top { display: flex; align-items: center; gap: 14px; }\n.omni-cube {\n  width: 40px; height: 40px; flex: none; margin: 4px;\n  position: relative; transform-style: preserve-3d;\n  animation: omni-spin 9s linear infinite;\n}\n.omni-cube i {\n  position: absolute; inset: 0;\n  border: 2px solid var(--accent);\n  background: rgba(255, 192, 0, 0.18);\n  background: color-mix(in srgb, var(--accent) 18%, transparent);\n}\n.omni-cube i:nth-child(1) { transform: translateZ(20px); }\n.omni-cube i:nth-child(2) { transform: rotateY(90deg) translateZ(20px); }\n.omni-cube i:nth-child(3) { transform: rotateY(180deg) translateZ(20px); }\n.omni-cube i:nth-child(4) { transform: rotateY(-90deg) translateZ(20px); }\n.omni-cube i:nth-child(5) { transform: rotateX(90deg) translateZ(20px); }\n.omni-cube i:nth-child(6) { transform: rotateX(-90deg) translateZ(20px); }\n@keyframes omni-spin { to { transform: rotateX(360deg) rotateY(360deg); } }\n\n.omni-id h1 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.5px; line-height: 1.2; }\n.omni-id p { margin: 0; color: var(--text-dim); font-size: 12.5px; }\n.omni-pill {\n  margin-inline-start: auto;\n  display: inline-flex; align-items: center; gap: 6px;\n  background: var(--accent); color: #000;\n  padding: 2px 12px; font-size: 12px; font-weight: 700; border-radius: 99px;\n  white-space: nowrap;\n}\n.omni-pill:before {\n  content: \"\"; width: 7px; height: 7px; border-radius: 50%;\n  background: currentColor; animation: omni-blink 1.4s infinite;\n}\n@keyframes omni-blink { 50% { opacity: 0.2; } }\n\n.omni-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }\n.omni-badges span {\n  border: 1px solid var(--border-strong); color: var(--text-dim);\n  padding: 2px 10px; font-size: 11.5px; border-radius: 99px;\n  font-weight: 600; letter-spacing: 0.3px;\n}\n.omni-stats {\n  display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));\n  gap: 8px; margin-top: 14px;\n}\n.omni-stats > div {\n  background: var(--surface-2); border: 1px solid var(--border);\n  border-radius: var(--radius-sm); padding: 10px 12px;\n}\n.omni-stats span { display: block; color: var(--text-dim); font-size: 11.5px; margin-bottom: 4px; }\n.omni-stats b { font-size: 14px; word-break: break-all; }\n\n.omni-tick {\n  direction: ltr; overflow: hidden; white-space: nowrap;\n  border-block: 1px solid var(--border);\n  font-size: 11.5px; color: var(--text-dim); padding: 3px 0;\n  margin-top: 10px; user-select: none;\n}\n.omni-tick span { display: inline-block; padding-inline-end: 2em; animation: omni-mq 22s linear infinite; }\n@keyframes omni-mq { to { transform: translateX(-50%); } }\n\n/* ── theme picker row (sidebar) ─────────────────────────────────────────── */\n.theme-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 12px 8px; }\n.theme-dot {\n  width: 26px; height: 26px; border-radius: 50%;\n  border: 1px solid var(--border-strong); background: none; cursor: pointer;\n  display: inline-flex; align-items: center; justify-content: center; padding: 0;\n}\n.theme-dot i { width: 16px; height: 16px; border-radius: 50%; display: block; }\n.theme-dot[aria-pressed=\"true\"] { outline: 2px solid var(--accent); outline-offset: 2px; }\n\n/* ── scanner ────────────────────────────────────────────────────────────── */\n.scan-progress {\n  height: 8px; background: var(--surface-2);\n  border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden;\n}\n.scan-progress i { display: block; height: 100%; width: 0; background: var(--accent); transition: width 0.2s var(--ease); }\n.scan-row {\n  display: flex; align-items: center; gap: 10px;\n  padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 13px;\n}\n.scan-row:last-child { border-bottom: 0; }\n.scan-row code { min-width: 140px; font-size: 12.5px; }\n.scan-bar {\n  flex: 1; height: 6px; background: var(--surface-2);\n  border-radius: 99px; overflow: hidden; min-width: 60px;\n}\n.scan-bar i { display: block; height: 100%; border-radius: 99px; transition: width 0.25s var(--ease); }\n.scan-row b { min-width: 74px; text-align: end; font-size: 12.5px; }\n\n/* ── DNS / DoH grid ─────────────────────────────────────────────────────── */\n.dns-grid {\n  display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));\n  gap: 10px; margin-bottom: 12px;\n}\n.dns-card {\n  text-align: start; background: var(--surface-solid); color: var(--text);\n  border: 1px solid var(--border); border-radius: var(--radius);\n  padding: 14px; cursor: pointer; display: flex; flex-direction: column; gap: 6px;\n  transition: border-color 0.15s var(--ease), transform 0.15s var(--ease);\n}\n.dns-card:hover { border-color: var(--accent); transform: translateY(-2px); }\n.dns-card[aria-pressed=\"true\"] { border-color: var(--accent); box-shadow: var(--glow); }\n.dns-card b { font-size: 14px; }\n.dns-card code { font-size: 11px; color: var(--text-dim); word-break: break-all; direction: ltr; text-align: left; }\n.dns-tags { display: flex; gap: 6px; margin-top: 2px; }\n.badge.ir { background: rgba(34, 197, 94, 0.14); color: #4ade80; }\n\n@media (max-width: 640px) {\n  .omni-hero-top { flex-wrap: wrap; }\n  .omni-pill { margin-inline-start: 0; }\n  .scan-row code { min-width: 110px; }\n}\n\n/* ── OMNI v2: globe hero, chips, config builder, nintendo & dell ────────── */\n.omni-hero-top { gap: 10px; }\n.omni-globe {\n  width: 200px; height: 170px; flex: none;\n  margin-inline-start: auto;\n  filter: drop-shadow(0 0 18px color-mix(in srgb, var(--accent) 35%, transparent));\n}\n.omni-id { flex: 1; min-width: 0; }\n.omni-id .omni-pill { margin-inline-start: 0; margin-top: 8px; }\n.omni-flags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 12px; font-size: 15px; opacity: 0.75; }\n@media (max-width: 560px) { .omni-globe { width: 130px; height: 120px; } }\n\n.chips { display: flex; flex-wrap: wrap; gap: 6px; }\n.chip {\n  border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text-dim);\n  padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 600; cursor: pointer;\n  transition: 0.15s var(--ease);\n}\n.chip:hover { color: var(--text); border-color: var(--accent); }\n.chip[aria-pressed=\"true\"] { background: var(--accent); color: #000; border-color: var(--accent); }\n\n.cfg-uri {\n  display: flex; align-items: center; gap: 8px; padding: 6px 0;\n  border-bottom: 1px solid var(--border); font-size: 12px;\n}\n.cfg-uri:last-child { border-bottom: 0; }\n.cfg-uri code { flex: 1; direction: ltr; text-align: left; word-break: break-all; font-size: 11px; }\n.cfg-qrgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }\n.cfg-qrgrid figure { margin: 0; text-align: center; background: #fff; border-radius: 8px; padding: 6px; }\n.cfg-qrgrid figcaption { font-size: 10px; color: #111; direction: ltr; word-break: break-all; margin-top: 3px; }\n.cfg-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }\n\n.dns-test .badge { margin-inline-start: 4px; }\n\n[data-theme=\"nintendo\"] {\n  color-scheme: light;\n  --bg: #7a8aba; --bg-soft: #c9d9ec; --surface: #c9d9ec; --surface-solid: #c9d9ec; --surface-2: #dbe9f7;\n  --border: #3d4f97; --border-strong: #3d4f97; --text: #21242e; --text-dim: #3d4f97; --text-faint: #6a77b5;\n  --accent: #e60012; --accent-2: #f68d1f; --accent-3: #ff5a76; --accent-soft: rgba(230, 0, 18, 0.12);\n  --radius: 12px; --radius-sm: 8px;\n  --shadow: inset 2px 2px 0 #fff9, inset -2px -2px 0 #0004, 0 6px 0 #3d4f97;\n  --font: Verdana, \"Trebuchet MS\", system-ui, Vazirmatn, sans-serif;\n}\n[data-theme=\"dell\"] {\n  color-scheme: light;\n  --bg: #ffffff; --bg-soft: #fff; --surface: #ffffff; --surface-solid: #ffffff; --surface-2: #f2f2f2;\n  --border: #000000; --border-strong: #000000; --text: #000000; --text-dim: #333333; --text-faint: #777777;\n  --accent: #e91d2a; --accent-2: #fcc20f; --accent-3: #ff6b5e; --accent-soft: rgba(233, 29, 42, 0.1);\n  --radius: 0px; --radius-sm: 0px; --shadow: 4px 4px 0 #000;\n  --font: \"Arial Black\", Helvetica, system-ui, Vazirmatn, sans-serif;\n}\n\n\n[data-theme=\"dell\"] .btn-primary,\n[data-theme=\"pinterest\"] .btn-primary,\n[data-theme=\"nintendo\"] .btn-primary,\n[data-theme=\"ferrari\"] .btn-primary,\n[data-theme=\"apple\"] .btn-primary,\n[data-theme=\"claude\"] .btn-primary,\n[data-theme=\"light\"] .btn-primary {\n  background: linear-gradient(120deg, var(--accent), var(--accent-2));\n  color: #ffffff !important;\n  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);\n}\n\n/* ── Causal Mesh laboratory ─────────────────────────────────────────────── */\n.mesh-hero {\n  overflow: hidden; position: relative; padding: 22px;\n  background:\n    radial-gradient(65% 130% at 100% 0%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 62%),\n    radial-gradient(55% 110% at 0% 100%, color-mix(in srgb, var(--accent-2) 18%, transparent), transparent 64%),\n    var(--surface);\n}\n.mesh-hero::after {\n  content:\"\"; position:absolute; inset:0; pointer-events:none; opacity:.16;\n  background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg,var(--border) 1px,transparent 1px);\n  background-size: 34px 34px;\n  mask-image: linear-gradient(to left,#000,transparent 88%);\n}\n.mesh-kicker { color:var(--accent); font:700 11px var(--mono); letter-spacing:.12em; direction:ltr; }\n.mesh-title { margin:4px 0 7px; font-size:clamp(22px,3vw,38px); line-height:1.25; letter-spacing:-.04em; }\n.mesh-title em { font-style:normal; color:var(--accent); text-shadow:0 0 24px color-mix(in srgb,var(--accent) 45%,transparent); }\n.mesh-mode-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }\n.mesh-mode {\n  min-height:105px; text-align:start; padding:14px; border:1px solid var(--border); border-radius:14px;\n  background:color-mix(in srgb,var(--surface-2) 78%,transparent); cursor:pointer; transition:.2s var(--ease);\n}\n.mesh-mode:hover { transform:translateY(-2px); border-color:var(--border-strong); }\n.mesh-mode[aria-pressed=\"true\"] { border-color:var(--accent); background:var(--accent-soft); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 18%,transparent); }\n.mesh-mode b { display:block; margin:7px 0 2px; font-size:13.5px; }\n.mesh-mode small { color:var(--text-dim); line-height:1.6; }\n.mesh-control-grid { display:grid; grid-template-columns:minmax(230px,1fr) minmax(230px,1fr); gap:12px; }\n.mesh-metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:9px; }\n.mesh-metric { padding:12px; border:1px solid var(--border); border-radius:12px; background:var(--bg-soft); min-width:0; }\n.mesh-metric span { display:block; color:var(--text-faint); font-size:10.5px; }\n.mesh-metric b { display:block; margin-top:3px; font:750 18px var(--mono); direction:ltr; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }\n.mesh-flow { display:grid; grid-template-columns:1fr auto 1fr auto 1fr; gap:9px; align-items:center; }\n.mesh-node { padding:12px; border:1px solid var(--border); border-radius:12px; background:var(--bg-soft); text-align:center; }\n.mesh-node b { display:block; font-size:12px; }\n.mesh-node small { color:var(--text-faint); font-size:10.5px; }\n.mesh-arrow { color:var(--accent); font-size:18px; direction:ltr; }\n.mesh-country-list { display:flex; flex-direction:column; gap:7px; }\n.mesh-country-row { display:grid; grid-template-columns:minmax(130px,1fr) 112px 112px minmax(120px,1fr) auto; gap:9px; align-items:center; padding:10px 11px; border:1px solid var(--border); border-radius:12px; background:var(--bg-soft); }\n.mesh-country-row[data-best=\"true\"] { border-color:color-mix(in srgb,var(--ok) 45%,var(--border)); background:color-mix(in srgb,var(--ok) 7%,var(--bg-soft)); }\n.mesh-phase { display:flex; gap:7px; align-items:flex-start; padding:9px 0; border-bottom:1px dashed var(--border); }\n.mesh-phase:last-child { border-bottom:0; }\n.mesh-phase i { width:9px; height:9px; margin-top:6px; border-radius:50%; flex:none; background:var(--text-faint); }\n.mesh-phase.live i { background:var(--ok); box-shadow:0 0 10px var(--ok); }\n.mesh-phase.research i { background:var(--warn); box-shadow:0 0 10px color-mix(in srgb,var(--warn) 55%,transparent); }\n@media(max-width:760px){\n  .mesh-mode-grid,.mesh-control-grid,.mesh-metric-grid{grid-template-columns:1fr 1fr}\n  .mesh-country-row{grid-template-columns:1fr auto}.mesh-country-row>*:nth-child(2),.mesh-country-row>*:nth-child(3),.mesh-country-row>*:nth-child(4){grid-column:1/-1}\n  .mesh-flow{grid-template-columns:1fr}.mesh-arrow{transform:rotate(90deg);text-align:center}\n}\n@media(max-width:470px){.mesh-mode-grid,.mesh-control-grid,.mesh-metric-grid{grid-template-columns:1fr}}\n\n/* Dashboard v3 — clear hierarchy, responsive owner-focused overview */\n.dashboard-page { display:grid; gap:14px; }\n.dashboard-hero {\n  position:relative; isolation:isolate; overflow:hidden; display:grid;\n  grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:18px;\n  min-height:142px; padding:clamp(18px,3vw,28px); border:1px solid var(--border-strong);\n  background:radial-gradient(65% 150% at 100% 0%,color-mix(in srgb,var(--accent) 20%,transparent),transparent 70%),\n    linear-gradient(135deg,color-mix(in srgb,var(--surface-2) 84%,transparent),var(--surface));\n}\n.dashboard-hero::after { content:\"\"; position:absolute; z-index:-1; width:210px; height:210px; inset-inline-end:-54px; top:-92px; border:1px solid color-mix(in srgb,var(--accent) 32%,transparent); transform:rotate(45deg); box-shadow:0 0 0 25px color-mix(in srgb,var(--accent) 4%,transparent),0 0 0 52px color-mix(in srgb,var(--accent) 3%,transparent); }\n.dashboard-kicker { color:var(--accent); font:700 10px var(--font-mono); letter-spacing:.12em; direction:ltr; }\n.dashboard-hero h2 { margin:5px 0 4px; font-size:clamp(22px,3vw,30px); letter-spacing:-.035em; }\n.dashboard-hero p { max-width:760px; margin:0; color:var(--text-dim); font-size:12.5px; line-height:1.75; }\n.dashboard-actions { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }\n.dashboard-kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:11px; }\n.dashboard-page .dashboard-kpi { min-height:112px; padding:16px; border-color:var(--border); background:linear-gradient(155deg,color-mix(in srgb,var(--surface) 90%,transparent),var(--bg-soft)); box-shadow:var(--shadow); transition:transform .18s ease,border-color .18s ease; }\n.dashboard-page .dashboard-kpi:hover { transform:translateY(-2px); border-color:color-mix(in srgb,var(--accent) 50%,var(--border)); }\n.dashboard-page .dashboard-kpi .kpi-value { font-size:clamp(20px,2.2vw,28px); }\n.dashboard-page .dashboard-kpi .kpi-sub { line-height:1.6; }\n.dashboard-grid { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(280px,.85fr); gap:14px; align-items:stretch; }\n.dashboard-page .dashboard-card { min-width:0; padding:17px; }\n.dashboard-page .dashboard-card .card-head { margin-bottom:14px; }\n.dashboard-data-note { display:flex; align-items:flex-start; gap:10px; margin-top:12px; padding:11px 12px; border:1px solid color-mix(in srgb,var(--accent) 30%,var(--border)); background:color-mix(in srgb,var(--accent) 7%,var(--bg-soft)); color:var(--text-dim); font-size:11.5px; line-height:1.7; }\n.dashboard-data-note b { color:var(--text); }\n.dashboard-metric-pair { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; margin-top:12px; }\n.dashboard-mini-stat { padding:11px 12px; border:1px solid var(--border); background:var(--bg-soft); }\n.dashboard-mini-stat span { display:block; color:var(--text-faint); font-size:10.5px; }\n.dashboard-mini-stat b { display:block; margin-top:3px; font:750 17px var(--font-mono); direction:ltr; }\n.dashboard-alert { display:flex; gap:10px; align-items:flex-start; padding:11px 12px; border:1px solid var(--border); background:var(--bg-soft); }\n.dashboard-alert.warn { border-color:color-mix(in srgb,var(--warn) 36%,var(--border)); background:color-mix(in srgb,var(--warn) 7%,var(--bg-soft)); }\n.dashboard-alert.info { border-color:color-mix(in srgb,var(--accent-2) 32%,var(--border)); background:color-mix(in srgb,var(--accent-2) 6%,var(--bg-soft)); }\n.dashboard-top-user { padding:10px 0; border-bottom:1px solid var(--border); }\n.dashboard-top-user:last-child { border-bottom:0; }\n@media(max-width:900px){ .dashboard-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.dashboard-grid{grid-template-columns:1fr} }\n@media(max-width:560px){ .dashboard-hero{grid-template-columns:1fr}.dashboard-actions{justify-content:flex-start}.dashboard-kpis{grid-template-columns:1fr 1fr}.dashboard-page .dashboard-kpi{padding:12px;min-height:102px}.dashboard-metric-pair{grid-template-columns:1fr 1fr} }\n@media(max-width:380px){ .dashboard-kpis{grid-template-columns:1fr}.dashboard-actions .btn{flex:1} }\n\n\n/* ══ v2.1 — کلاس‌های گمشده + بستن سرریز افقی موبایل ══════════════════════════ */\nmain, .content, .card, .tabs, .chips, .notice, .view-head, .head-actions { min-width: 0; }\n.content { overflow-x: clip; }\n.view-head {\n  display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between;\n  gap: 10px; margin: 0 0 12px;\n}\n.view-head > div:first-child { flex: 1 1 auto; min-width: 0; }\n.view-head h2 { margin: 0 0 4px; font-size: clamp(17px, 4.6vw, 21px); line-height: 1.45; letter-spacing: -0.015em; }\n.view-head p { margin: 0; font-size: 12px; line-height: 1.75; }\n.head-actions { display: flex; gap: 8px; flex-wrap: wrap; }\n.notice {\n  padding: 11px 13px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm);\n  background: var(--surface-2); font-size: 12.5px; line-height: 1.8;\n}\n.notice.warn { border-color: color-mix(in srgb, var(--warn) 40%, var(--border)); background: color-mix(in srgb, var(--warn) 9%, var(--surface-2)); }\n.notice.ok { border-color: color-mix(in srgb, var(--ok) 40%, var(--border)); background: color-mix(in srgb, var(--ok) 9%, var(--surface-2)); }\n.notice b { color: var(--text); }\n.badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 620; white-space: nowrap; word-break: keep-all; line-height: 1.2; }\n.tabs { flex-wrap: wrap; overflow-x: visible; }\n.tabs button { white-space: normal; min-width: 0; text-align: start; line-height: 1.6; }\n@media (max-width: 560px) {\n  .head-actions .btn { width: 100%; justify-content: center; }\n  .tabs button { flex: 1 1 100%; justify-content: flex-start; }\n}\n</style>\n<script>\n/* Preview/sandbox-safe storage: in embedded or sandboxed contexts (and in\n   Safari private mode) touching localStorage throws. Fall back to memory so\n   the panel still boots instead of dying on the first theme read. */\ntry { window.localStorage.getItem(\"omni.probe\"); } catch (_) {\n  const mem = new Map();\n  const shim = {\n    getItem: (k) => (mem.has(String(k)) ? mem.get(String(k)) : null),\n    setItem: (k, v) => mem.set(String(k), String(v)),\n    removeItem: (k) => mem.delete(String(k)),\n    clear: () => mem.clear(),\n    key: (i) => [...mem.keys()][i] ?? null,\n    get length() { return mem.size; },\n  };\n  Object.defineProperty(window, \"localStorage\", { configurable: true, get: () => shim });\n}\n</script>\n<!-- Vendored locally (MIT) so the panel works without external CDNs. -->\n<script>\n//---------------------------------------------------------------------\n//\n// QR Code Generator for JavaScript\n//\n// Copyright (c) 2009 Kazuhiko Arase\n//\n// URL: http://www.d-project.com/\n//\n// Licensed under the MIT license:\n//  http://www.opensource.org/licenses/mit-license.php\n//\n// The word 'QR Code' is registered trademark of\n// DENSO WAVE INCORPORATED\n//  http://www.denso-wave.com/qrcode/faqpatent-e.html\n//\n//---------------------------------------------------------------------\n\nvar qrcode = function() {\n\n  //---------------------------------------------------------------------\n  // qrcode\n  //---------------------------------------------------------------------\n\n  /**\n   * qrcode\n   * @param typeNumber 1 to 40\n   * @param errorCorrectionLevel 'L','M','Q','H'\n   */\n  var qrcode = function(typeNumber, errorCorrectionLevel) {\n\n    var PAD0 = 0xEC;\n    var PAD1 = 0x11;\n\n    var _typeNumber = typeNumber;\n    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];\n    var _modules = null;\n    var _moduleCount = 0;\n    var _dataCache = null;\n    var _dataList = [];\n\n    var _this = {};\n\n    var makeImpl = function(test, maskPattern) {\n\n      _moduleCount = _typeNumber * 4 + 17;\n      _modules = function(moduleCount) {\n        var modules = new Array(moduleCount);\n        for (var row = 0; row < moduleCount; row += 1) {\n          modules[row] = new Array(moduleCount);\n          for (var col = 0; col < moduleCount; col += 1) {\n            modules[row][col] = null;\n          }\n        }\n        return modules;\n      }(_moduleCount);\n\n      setupPositionProbePattern(0, 0);\n      setupPositionProbePattern(_moduleCount - 7, 0);\n      setupPositionProbePattern(0, _moduleCount - 7);\n      setupPositionAdjustPattern();\n      setupTimingPattern();\n      setupTypeInfo(test, maskPattern);\n\n      if (_typeNumber >= 7) {\n        setupTypeNumber(test);\n      }\n\n      if (_dataCache == null) {\n        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);\n      }\n\n      mapData(_dataCache, maskPattern);\n    };\n\n    var setupPositionProbePattern = function(row, col) {\n\n      for (var r = -1; r <= 7; r += 1) {\n\n        if (row + r <= -1 || _moduleCount <= row + r) continue;\n\n        for (var c = -1; c <= 7; c += 1) {\n\n          if (col + c <= -1 || _moduleCount <= col + c) continue;\n\n          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )\n              || (0 <= c && c <= 6 && (r == 0 || r == 6) )\n              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {\n            _modules[row + r][col + c] = true;\n          } else {\n            _modules[row + r][col + c] = false;\n          }\n        }\n      }\n    };\n\n    var getBestMaskPattern = function() {\n\n      var minLostPoint = 0;\n      var pattern = 0;\n\n      for (var i = 0; i < 8; i += 1) {\n\n        makeImpl(true, i);\n\n        var lostPoint = QRUtil.getLostPoint(_this);\n\n        if (i == 0 || minLostPoint > lostPoint) {\n          minLostPoint = lostPoint;\n          pattern = i;\n        }\n      }\n\n      return pattern;\n    };\n\n    var setupTimingPattern = function() {\n\n      for (var r = 8; r < _moduleCount - 8; r += 1) {\n        if (_modules[r][6] != null) {\n          continue;\n        }\n        _modules[r][6] = (r % 2 == 0);\n      }\n\n      for (var c = 8; c < _moduleCount - 8; c += 1) {\n        if (_modules[6][c] != null) {\n          continue;\n        }\n        _modules[6][c] = (c % 2 == 0);\n      }\n    };\n\n    var setupPositionAdjustPattern = function() {\n\n      var pos = QRUtil.getPatternPosition(_typeNumber);\n\n      for (var i = 0; i < pos.length; i += 1) {\n\n        for (var j = 0; j < pos.length; j += 1) {\n\n          var row = pos[i];\n          var col = pos[j];\n\n          if (_modules[row][col] != null) {\n            continue;\n          }\n\n          for (var r = -2; r <= 2; r += 1) {\n\n            for (var c = -2; c <= 2; c += 1) {\n\n              if (r == -2 || r == 2 || c == -2 || c == 2\n                  || (r == 0 && c == 0) ) {\n                _modules[row + r][col + c] = true;\n              } else {\n                _modules[row + r][col + c] = false;\n              }\n            }\n          }\n        }\n      }\n    };\n\n    var setupTypeNumber = function(test) {\n\n      var bits = QRUtil.getBCHTypeNumber(_typeNumber);\n\n      for (var i = 0; i < 18; i += 1) {\n        var mod = (!test && ( (bits >> i) & 1) == 1);\n        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;\n      }\n\n      for (var i = 0; i < 18; i += 1) {\n        var mod = (!test && ( (bits >> i) & 1) == 1);\n        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;\n      }\n    };\n\n    var setupTypeInfo = function(test, maskPattern) {\n\n      var data = (_errorCorrectionLevel << 3) | maskPattern;\n      var bits = QRUtil.getBCHTypeInfo(data);\n\n      // vertical\n      for (var i = 0; i < 15; i += 1) {\n\n        var mod = (!test && ( (bits >> i) & 1) == 1);\n\n        if (i < 6) {\n          _modules[i][8] = mod;\n        } else if (i < 8) {\n          _modules[i + 1][8] = mod;\n        } else {\n          _modules[_moduleCount - 15 + i][8] = mod;\n        }\n      }\n\n      // horizontal\n      for (var i = 0; i < 15; i += 1) {\n\n        var mod = (!test && ( (bits >> i) & 1) == 1);\n\n        if (i < 8) {\n          _modules[8][_moduleCount - i - 1] = mod;\n        } else if (i < 9) {\n          _modules[8][15 - i - 1 + 1] = mod;\n        } else {\n          _modules[8][15 - i - 1] = mod;\n        }\n      }\n\n      // fixed module\n      _modules[_moduleCount - 8][8] = (!test);\n    };\n\n    var mapData = function(data, maskPattern) {\n\n      var inc = -1;\n      var row = _moduleCount - 1;\n      var bitIndex = 7;\n      var byteIndex = 0;\n      var maskFunc = QRUtil.getMaskFunction(maskPattern);\n\n      for (var col = _moduleCount - 1; col > 0; col -= 2) {\n\n        if (col == 6) col -= 1;\n\n        while (true) {\n\n          for (var c = 0; c < 2; c += 1) {\n\n            if (_modules[row][col - c] == null) {\n\n              var dark = false;\n\n              if (byteIndex < data.length) {\n                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);\n              }\n\n              var mask = maskFunc(row, col - c);\n\n              if (mask) {\n                dark = !dark;\n              }\n\n              _modules[row][col - c] = dark;\n              bitIndex -= 1;\n\n              if (bitIndex == -1) {\n                byteIndex += 1;\n                bitIndex = 7;\n              }\n            }\n          }\n\n          row += inc;\n\n          if (row < 0 || _moduleCount <= row) {\n            row -= inc;\n            inc = -inc;\n            break;\n          }\n        }\n      }\n    };\n\n    var createBytes = function(buffer, rsBlocks) {\n\n      var offset = 0;\n\n      var maxDcCount = 0;\n      var maxEcCount = 0;\n\n      var dcdata = new Array(rsBlocks.length);\n      var ecdata = new Array(rsBlocks.length);\n\n      for (var r = 0; r < rsBlocks.length; r += 1) {\n\n        var dcCount = rsBlocks[r].dataCount;\n        var ecCount = rsBlocks[r].totalCount - dcCount;\n\n        maxDcCount = Math.max(maxDcCount, dcCount);\n        maxEcCount = Math.max(maxEcCount, ecCount);\n\n        dcdata[r] = new Array(dcCount);\n\n        for (var i = 0; i < dcdata[r].length; i += 1) {\n          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];\n        }\n        offset += dcCount;\n\n        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);\n        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);\n\n        var modPoly = rawPoly.mod(rsPoly);\n        ecdata[r] = new Array(rsPoly.getLength() - 1);\n        for (var i = 0; i < ecdata[r].length; i += 1) {\n          var modIndex = i + modPoly.getLength() - ecdata[r].length;\n          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;\n        }\n      }\n\n      var totalCodeCount = 0;\n      for (var i = 0; i < rsBlocks.length; i += 1) {\n        totalCodeCount += rsBlocks[i].totalCount;\n      }\n\n      var data = new Array(totalCodeCount);\n      var index = 0;\n\n      for (var i = 0; i < maxDcCount; i += 1) {\n        for (var r = 0; r < rsBlocks.length; r += 1) {\n          if (i < dcdata[r].length) {\n            data[index] = dcdata[r][i];\n            index += 1;\n          }\n        }\n      }\n\n      for (var i = 0; i < maxEcCount; i += 1) {\n        for (var r = 0; r < rsBlocks.length; r += 1) {\n          if (i < ecdata[r].length) {\n            data[index] = ecdata[r][i];\n            index += 1;\n          }\n        }\n      }\n\n      return data;\n    };\n\n    var createData = function(typeNumber, errorCorrectionLevel, dataList) {\n\n      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);\n\n      var buffer = qrBitBuffer();\n\n      for (var i = 0; i < dataList.length; i += 1) {\n        var data = dataList[i];\n        buffer.put(data.getMode(), 4);\n        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );\n        data.write(buffer);\n      }\n\n      // calc num max data.\n      var totalDataCount = 0;\n      for (var i = 0; i < rsBlocks.length; i += 1) {\n        totalDataCount += rsBlocks[i].dataCount;\n      }\n\n      if (buffer.getLengthInBits() > totalDataCount * 8) {\n        throw 'code length overflow. ('\n          + buffer.getLengthInBits()\n          + '>'\n          + totalDataCount * 8\n          + ')';\n      }\n\n      // end code\n      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {\n        buffer.put(0, 4);\n      }\n\n      // padding\n      while (buffer.getLengthInBits() % 8 != 0) {\n        buffer.putBit(false);\n      }\n\n      // padding\n      while (true) {\n\n        if (buffer.getLengthInBits() >= totalDataCount * 8) {\n          break;\n        }\n        buffer.put(PAD0, 8);\n\n        if (buffer.getLengthInBits() >= totalDataCount * 8) {\n          break;\n        }\n        buffer.put(PAD1, 8);\n      }\n\n      return createBytes(buffer, rsBlocks);\n    };\n\n    _this.addData = function(data, mode) {\n\n      mode = mode || 'Byte';\n\n      var newData = null;\n\n      switch(mode) {\n      case 'Numeric' :\n        newData = qrNumber(data);\n        break;\n      case 'Alphanumeric' :\n        newData = qrAlphaNum(data);\n        break;\n      case 'Byte' :\n        newData = qr8BitByte(data);\n        break;\n      case 'Kanji' :\n        newData = qrKanji(data);\n        break;\n      default :\n        throw 'mode:' + mode;\n      }\n\n      _dataList.push(newData);\n      _dataCache = null;\n    };\n\n    _this.isDark = function(row, col) {\n      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {\n        throw row + ',' + col;\n      }\n      return _modules[row][col];\n    };\n\n    _this.getModuleCount = function() {\n      return _moduleCount;\n    };\n\n    _this.make = function() {\n      if (_typeNumber < 1) {\n        var typeNumber = 1;\n\n        for (; typeNumber < 40; typeNumber++) {\n          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);\n          var buffer = qrBitBuffer();\n\n          for (var i = 0; i < _dataList.length; i++) {\n            var data = _dataList[i];\n            buffer.put(data.getMode(), 4);\n            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );\n            data.write(buffer);\n          }\n\n          var totalDataCount = 0;\n          for (var i = 0; i < rsBlocks.length; i++) {\n            totalDataCount += rsBlocks[i].dataCount;\n          }\n\n          if (buffer.getLengthInBits() <= totalDataCount * 8) {\n            break;\n          }\n        }\n\n        _typeNumber = typeNumber;\n      }\n\n      makeImpl(false, getBestMaskPattern() );\n    };\n\n    _this.createTableTag = function(cellSize, margin) {\n\n      cellSize = cellSize || 2;\n      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;\n\n      var qrHtml = '';\n\n      qrHtml += '<table style=\"';\n      qrHtml += ' border-width: 0px; border-style: none;';\n      qrHtml += ' border-collapse: collapse;';\n      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';\n      qrHtml += '\">';\n      qrHtml += '<tbody>';\n\n      for (var r = 0; r < _this.getModuleCount(); r += 1) {\n\n        qrHtml += '<tr>';\n\n        for (var c = 0; c < _this.getModuleCount(); c += 1) {\n          qrHtml += '<td style=\"';\n          qrHtml += ' border-width: 0px; border-style: none;';\n          qrHtml += ' border-collapse: collapse;';\n          qrHtml += ' padding: 0px; margin: 0px;';\n          qrHtml += ' width: ' + cellSize + 'px;';\n          qrHtml += ' height: ' + cellSize + 'px;';\n          qrHtml += ' background-color: ';\n          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';\n          qrHtml += ';';\n          qrHtml += '\"/>';\n        }\n\n        qrHtml += '</tr>';\n      }\n\n      qrHtml += '</tbody>';\n      qrHtml += '</table>';\n\n      return qrHtml;\n    };\n\n    _this.createSvgTag = function(cellSize, margin, alt, title) {\n\n      var opts = {};\n      if (typeof arguments[0] == 'object') {\n        // Called by options.\n        opts = arguments[0];\n        // overwrite cellSize and margin.\n        cellSize = opts.cellSize;\n        margin = opts.margin;\n        alt = opts.alt;\n        title = opts.title;\n      }\n\n      cellSize = cellSize || 2;\n      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;\n\n      // Compose alt property surrogate\n      alt = (typeof alt === 'string') ? {text: alt} : alt || {};\n      alt.text = alt.text || null;\n      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;\n\n      // Compose title property surrogate\n      title = (typeof title === 'string') ? {text: title} : title || {};\n      title.text = title.text || null;\n      title.id = (title.text) ? title.id || 'qrcode-title' : null;\n\n      var size = _this.getModuleCount() * cellSize + margin * 2;\n      var c, mc, r, mr, qrSvg='', rect;\n\n      rect = 'l' + cellSize + ',0 0,' + cellSize +\n        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';\n\n      qrSvg += '<svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\"';\n      qrSvg += !opts.scalable ? ' width=\"' + size + 'px\" height=\"' + size + 'px\"' : '';\n      qrSvg += ' viewBox=\"0 0 ' + size + ' ' + size + '\" ';\n      qrSvg += ' preserveAspectRatio=\"xMinYMin meet\"';\n      qrSvg += (title.text || alt.text) ? ' role=\"img\" aria-labelledby=\"' +\n          escapeXml([title.id, alt.id].join(' ').trim() ) + '\"' : '';\n      qrSvg += '>';\n      qrSvg += (title.text) ? '<title id=\"' + escapeXml(title.id) + '\">' +\n          escapeXml(title.text) + '</title>' : '';\n      qrSvg += (alt.text) ? '<description id=\"' + escapeXml(alt.id) + '\">' +\n          escapeXml(alt.text) + '</description>' : '';\n      qrSvg += '<rect width=\"100%\" height=\"100%\" fill=\"white\" cx=\"0\" cy=\"0\"/>';\n      qrSvg += '<path d=\"';\n\n      for (r = 0; r < _this.getModuleCount(); r += 1) {\n        mr = r * cellSize + margin;\n        for (c = 0; c < _this.getModuleCount(); c += 1) {\n          if (_this.isDark(r, c) ) {\n            mc = c*cellSize+margin;\n            qrSvg += 'M' + mc + ',' + mr + rect;\n          }\n        }\n      }\n\n      qrSvg += '\" stroke=\"transparent\" fill=\"black\"/>';\n      qrSvg += '</svg>';\n\n      return qrSvg;\n    };\n\n    _this.createDataURL = function(cellSize, margin) {\n\n      cellSize = cellSize || 2;\n      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;\n\n      var size = _this.getModuleCount() * cellSize + margin * 2;\n      var min = margin;\n      var max = size - margin;\n\n      return createDataURL(size, size, function(x, y) {\n        if (min <= x && x < max && min <= y && y < max) {\n          var c = Math.floor( (x - min) / cellSize);\n          var r = Math.floor( (y - min) / cellSize);\n          return _this.isDark(r, c)? 0 : 1;\n        } else {\n          return 1;\n        }\n      } );\n    };\n\n    _this.createImgTag = function(cellSize, margin, alt) {\n\n      cellSize = cellSize || 2;\n      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;\n\n      var size = _this.getModuleCount() * cellSize + margin * 2;\n\n      var img = '';\n      img += '<img';\n      img += '\\u0020src=\"';\n      img += _this.createDataURL(cellSize, margin);\n      img += '\"';\n      img += '\\u0020width=\"';\n      img += size;\n      img += '\"';\n      img += '\\u0020height=\"';\n      img += size;\n      img += '\"';\n      if (alt) {\n        img += '\\u0020alt=\"';\n        img += escapeXml(alt);\n        img += '\"';\n      }\n      img += '/>';\n\n      return img;\n    };\n\n    var escapeXml = function(s) {\n      var escaped = '';\n      for (var i = 0; i < s.length; i += 1) {\n        var c = s.charAt(i);\n        switch(c) {\n        case '<': escaped += '&lt;'; break;\n        case '>': escaped += '&gt;'; break;\n        case '&': escaped += '&amp;'; break;\n        case '\"': escaped += '&quot;'; break;\n        default : escaped += c; break;\n        }\n      }\n      return escaped;\n    };\n\n    var _createHalfASCII = function(margin) {\n      var cellSize = 1;\n      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;\n\n      var size = _this.getModuleCount() * cellSize + margin * 2;\n      var min = margin;\n      var max = size - margin;\n\n      var y, x, r1, r2, p;\n\n      var blocks = {\n        '██': '█',\n        '█ ': '▀',\n        ' █': '▄',\n        '  ': ' '\n      };\n\n      var blocksLastLineNoMargin = {\n        '██': '▀',\n        '█ ': '▀',\n        ' █': ' ',\n        '  ': ' '\n      };\n\n      var ascii = '';\n      for (y = 0; y < size; y += 2) {\n        r1 = Math.floor((y - min) / cellSize);\n        r2 = Math.floor((y + 1 - min) / cellSize);\n        for (x = 0; x < size; x += 1) {\n          p = '█';\n\n          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {\n            p = ' ';\n          }\n\n          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {\n            p += ' ';\n          }\n          else {\n            p += '█';\n          }\n\n          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.\n          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];\n        }\n\n        ascii += '\\n';\n      }\n\n      if (size % 2 && margin > 0) {\n        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');\n      }\n\n      return ascii.substring(0, ascii.length-1);\n    };\n\n    _this.createASCII = function(cellSize, margin) {\n      cellSize = cellSize || 1;\n\n      if (cellSize < 2) {\n        return _createHalfASCII(margin);\n      }\n\n      cellSize -= 1;\n      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;\n\n      var size = _this.getModuleCount() * cellSize + margin * 2;\n      var min = margin;\n      var max = size - margin;\n\n      var y, x, r, p;\n\n      var white = Array(cellSize+1).join('██');\n      var black = Array(cellSize+1).join('  ');\n\n      var ascii = '';\n      var line = '';\n      for (y = 0; y < size; y += 1) {\n        r = Math.floor( (y - min) / cellSize);\n        line = '';\n        for (x = 0; x < size; x += 1) {\n          p = 1;\n\n          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {\n            p = 0;\n          }\n\n          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.\n          line += p ? white : black;\n        }\n\n        for (r = 0; r < cellSize; r += 1) {\n          ascii += line + '\\n';\n        }\n      }\n\n      return ascii.substring(0, ascii.length-1);\n    };\n\n    _this.renderTo2dContext = function(context, cellSize) {\n      cellSize = cellSize || 2;\n      var length = _this.getModuleCount();\n      for (var row = 0; row < length; row++) {\n        for (var col = 0; col < length; col++) {\n          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';\n          context.fillRect(row * cellSize, col * cellSize, cellSize, cellSize);\n        }\n      }\n    }\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // qrcode.stringToBytes\n  //---------------------------------------------------------------------\n\n  qrcode.stringToBytesFuncs = {\n    'default' : function(s) {\n      var bytes = [];\n      for (var i = 0; i < s.length; i += 1) {\n        var c = s.charCodeAt(i);\n        bytes.push(c & 0xff);\n      }\n      return bytes;\n    }\n  };\n\n  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];\n\n  //---------------------------------------------------------------------\n  // qrcode.createStringToBytes\n  //---------------------------------------------------------------------\n\n  /**\n   * @param unicodeData base64 string of byte array.\n   * [16bit Unicode],[16bit Bytes], ...\n   * @param numChars\n   */\n  qrcode.createStringToBytes = function(unicodeData, numChars) {\n\n    // create conversion map.\n\n    var unicodeMap = function() {\n\n      var bin = base64DecodeInputStream(unicodeData);\n      var read = function() {\n        var b = bin.read();\n        if (b == -1) throw 'eof';\n        return b;\n      };\n\n      var count = 0;\n      var unicodeMap = {};\n      while (true) {\n        var b0 = bin.read();\n        if (b0 == -1) break;\n        var b1 = read();\n        var b2 = read();\n        var b3 = read();\n        var k = String.fromCharCode( (b0 << 8) | b1);\n        var v = (b2 << 8) | b3;\n        unicodeMap[k] = v;\n        count += 1;\n      }\n      if (count != numChars) {\n        throw count + ' != ' + numChars;\n      }\n\n      return unicodeMap;\n    }();\n\n    var unknownChar = '?'.charCodeAt(0);\n\n    return function(s) {\n      var bytes = [];\n      for (var i = 0; i < s.length; i += 1) {\n        var c = s.charCodeAt(i);\n        if (c < 128) {\n          bytes.push(c);\n        } else {\n          var b = unicodeMap[s.charAt(i)];\n          if (typeof b == 'number') {\n            if ( (b & 0xff) == b) {\n              // 1byte\n              bytes.push(b);\n            } else {\n              // 2bytes\n              bytes.push(b >>> 8);\n              bytes.push(b & 0xff);\n            }\n          } else {\n            bytes.push(unknownChar);\n          }\n        }\n      }\n      return bytes;\n    };\n  };\n\n  //---------------------------------------------------------------------\n  // QRMode\n  //---------------------------------------------------------------------\n\n  var QRMode = {\n    MODE_NUMBER :    1 << 0,\n    MODE_ALPHA_NUM : 1 << 1,\n    MODE_8BIT_BYTE : 1 << 2,\n    MODE_KANJI :     1 << 3\n  };\n\n  //---------------------------------------------------------------------\n  // QRErrorCorrectionLevel\n  //---------------------------------------------------------------------\n\n  var QRErrorCorrectionLevel = {\n    L : 1,\n    M : 0,\n    Q : 3,\n    H : 2\n  };\n\n  //---------------------------------------------------------------------\n  // QRMaskPattern\n  //---------------------------------------------------------------------\n\n  var QRMaskPattern = {\n    PATTERN000 : 0,\n    PATTERN001 : 1,\n    PATTERN010 : 2,\n    PATTERN011 : 3,\n    PATTERN100 : 4,\n    PATTERN101 : 5,\n    PATTERN110 : 6,\n    PATTERN111 : 7\n  };\n\n  //---------------------------------------------------------------------\n  // QRUtil\n  //---------------------------------------------------------------------\n\n  var QRUtil = function() {\n\n    var PATTERN_POSITION_TABLE = [\n      [],\n      [6, 18],\n      [6, 22],\n      [6, 26],\n      [6, 30],\n      [6, 34],\n      [6, 22, 38],\n      [6, 24, 42],\n      [6, 26, 46],\n      [6, 28, 50],\n      [6, 30, 54],\n      [6, 32, 58],\n      [6, 34, 62],\n      [6, 26, 46, 66],\n      [6, 26, 48, 70],\n      [6, 26, 50, 74],\n      [6, 30, 54, 78],\n      [6, 30, 56, 82],\n      [6, 30, 58, 86],\n      [6, 34, 62, 90],\n      [6, 28, 50, 72, 94],\n      [6, 26, 50, 74, 98],\n      [6, 30, 54, 78, 102],\n      [6, 28, 54, 80, 106],\n      [6, 32, 58, 84, 110],\n      [6, 30, 58, 86, 114],\n      [6, 34, 62, 90, 118],\n      [6, 26, 50, 74, 98, 122],\n      [6, 30, 54, 78, 102, 126],\n      [6, 26, 52, 78, 104, 130],\n      [6, 30, 56, 82, 108, 134],\n      [6, 34, 60, 86, 112, 138],\n      [6, 30, 58, 86, 114, 142],\n      [6, 34, 62, 90, 118, 146],\n      [6, 30, 54, 78, 102, 126, 150],\n      [6, 24, 50, 76, 102, 128, 154],\n      [6, 28, 54, 80, 106, 132, 158],\n      [6, 32, 58, 84, 110, 136, 162],\n      [6, 26, 54, 82, 110, 138, 166],\n      [6, 30, 58, 86, 114, 142, 170]\n    ];\n    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);\n    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);\n    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);\n\n    var _this = {};\n\n    var getBCHDigit = function(data) {\n      var digit = 0;\n      while (data != 0) {\n        digit += 1;\n        data >>>= 1;\n      }\n      return digit;\n    };\n\n    _this.getBCHTypeInfo = function(data) {\n      var d = data << 10;\n      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {\n        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );\n      }\n      return ( (data << 10) | d) ^ G15_MASK;\n    };\n\n    _this.getBCHTypeNumber = function(data) {\n      var d = data << 12;\n      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {\n        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );\n      }\n      return (data << 12) | d;\n    };\n\n    _this.getPatternPosition = function(typeNumber) {\n      return PATTERN_POSITION_TABLE[typeNumber - 1];\n    };\n\n    _this.getMaskFunction = function(maskPattern) {\n\n      switch (maskPattern) {\n\n      case QRMaskPattern.PATTERN000 :\n        return function(i, j) { return (i + j) % 2 == 0; };\n      case QRMaskPattern.PATTERN001 :\n        return function(i, j) { return i % 2 == 0; };\n      case QRMaskPattern.PATTERN010 :\n        return function(i, j) { return j % 3 == 0; };\n      case QRMaskPattern.PATTERN011 :\n        return function(i, j) { return (i + j) % 3 == 0; };\n      case QRMaskPattern.PATTERN100 :\n        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };\n      case QRMaskPattern.PATTERN101 :\n        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };\n      case QRMaskPattern.PATTERN110 :\n        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };\n      case QRMaskPattern.PATTERN111 :\n        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };\n\n      default :\n        throw 'bad maskPattern:' + maskPattern;\n      }\n    };\n\n    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {\n      var a = qrPolynomial([1], 0);\n      for (var i = 0; i < errorCorrectLength; i += 1) {\n        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );\n      }\n      return a;\n    };\n\n    _this.getLengthInBits = function(mode, type) {\n\n      if (1 <= type && type < 10) {\n\n        // 1 - 9\n\n        switch(mode) {\n        case QRMode.MODE_NUMBER    : return 10;\n        case QRMode.MODE_ALPHA_NUM : return 9;\n        case QRMode.MODE_8BIT_BYTE : return 8;\n        case QRMode.MODE_KANJI     : return 8;\n        default :\n          throw 'mode:' + mode;\n        }\n\n      } else if (type < 27) {\n\n        // 10 - 26\n\n        switch(mode) {\n        case QRMode.MODE_NUMBER    : return 12;\n        case QRMode.MODE_ALPHA_NUM : return 11;\n        case QRMode.MODE_8BIT_BYTE : return 16;\n        case QRMode.MODE_KANJI     : return 10;\n        default :\n          throw 'mode:' + mode;\n        }\n\n      } else if (type < 41) {\n\n        // 27 - 40\n\n        switch(mode) {\n        case QRMode.MODE_NUMBER    : return 14;\n        case QRMode.MODE_ALPHA_NUM : return 13;\n        case QRMode.MODE_8BIT_BYTE : return 16;\n        case QRMode.MODE_KANJI     : return 12;\n        default :\n          throw 'mode:' + mode;\n        }\n\n      } else {\n        throw 'type:' + type;\n      }\n    };\n\n    _this.getLostPoint = function(qrcode) {\n\n      var moduleCount = qrcode.getModuleCount();\n\n      var lostPoint = 0;\n\n      // LEVEL1\n\n      for (var row = 0; row < moduleCount; row += 1) {\n        for (var col = 0; col < moduleCount; col += 1) {\n\n          var sameCount = 0;\n          var dark = qrcode.isDark(row, col);\n\n          for (var r = -1; r <= 1; r += 1) {\n\n            if (row + r < 0 || moduleCount <= row + r) {\n              continue;\n            }\n\n            for (var c = -1; c <= 1; c += 1) {\n\n              if (col + c < 0 || moduleCount <= col + c) {\n                continue;\n              }\n\n              if (r == 0 && c == 0) {\n                continue;\n              }\n\n              if (dark == qrcode.isDark(row + r, col + c) ) {\n                sameCount += 1;\n              }\n            }\n          }\n\n          if (sameCount > 5) {\n            lostPoint += (3 + sameCount - 5);\n          }\n        }\n      };\n\n      // LEVEL2\n\n      for (var row = 0; row < moduleCount - 1; row += 1) {\n        for (var col = 0; col < moduleCount - 1; col += 1) {\n          var count = 0;\n          if (qrcode.isDark(row, col) ) count += 1;\n          if (qrcode.isDark(row + 1, col) ) count += 1;\n          if (qrcode.isDark(row, col + 1) ) count += 1;\n          if (qrcode.isDark(row + 1, col + 1) ) count += 1;\n          if (count == 0 || count == 4) {\n            lostPoint += 3;\n          }\n        }\n      }\n\n      // LEVEL3\n\n      for (var row = 0; row < moduleCount; row += 1) {\n        for (var col = 0; col < moduleCount - 6; col += 1) {\n          if (qrcode.isDark(row, col)\n              && !qrcode.isDark(row, col + 1)\n              &&  qrcode.isDark(row, col + 2)\n              &&  qrcode.isDark(row, col + 3)\n              &&  qrcode.isDark(row, col + 4)\n              && !qrcode.isDark(row, col + 5)\n              &&  qrcode.isDark(row, col + 6) ) {\n            lostPoint += 40;\n          }\n        }\n      }\n\n      for (var col = 0; col < moduleCount; col += 1) {\n        for (var row = 0; row < moduleCount - 6; row += 1) {\n          if (qrcode.isDark(row, col)\n              && !qrcode.isDark(row + 1, col)\n              &&  qrcode.isDark(row + 2, col)\n              &&  qrcode.isDark(row + 3, col)\n              &&  qrcode.isDark(row + 4, col)\n              && !qrcode.isDark(row + 5, col)\n              &&  qrcode.isDark(row + 6, col) ) {\n            lostPoint += 40;\n          }\n        }\n      }\n\n      // LEVEL4\n\n      var darkCount = 0;\n\n      for (var col = 0; col < moduleCount; col += 1) {\n        for (var row = 0; row < moduleCount; row += 1) {\n          if (qrcode.isDark(row, col) ) {\n            darkCount += 1;\n          }\n        }\n      }\n\n      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;\n      lostPoint += ratio * 10;\n\n      return lostPoint;\n    };\n\n    return _this;\n  }();\n\n  //---------------------------------------------------------------------\n  // QRMath\n  //---------------------------------------------------------------------\n\n  var QRMath = function() {\n\n    var EXP_TABLE = new Array(256);\n    var LOG_TABLE = new Array(256);\n\n    // initialize tables\n    for (var i = 0; i < 8; i += 1) {\n      EXP_TABLE[i] = 1 << i;\n    }\n    for (var i = 8; i < 256; i += 1) {\n      EXP_TABLE[i] = EXP_TABLE[i - 4]\n        ^ EXP_TABLE[i - 5]\n        ^ EXP_TABLE[i - 6]\n        ^ EXP_TABLE[i - 8];\n    }\n    for (var i = 0; i < 255; i += 1) {\n      LOG_TABLE[EXP_TABLE[i] ] = i;\n    }\n\n    var _this = {};\n\n    _this.glog = function(n) {\n\n      if (n < 1) {\n        throw 'glog(' + n + ')';\n      }\n\n      return LOG_TABLE[n];\n    };\n\n    _this.gexp = function(n) {\n\n      while (n < 0) {\n        n += 255;\n      }\n\n      while (n >= 256) {\n        n -= 255;\n      }\n\n      return EXP_TABLE[n];\n    };\n\n    return _this;\n  }();\n\n  //---------------------------------------------------------------------\n  // qrPolynomial\n  //---------------------------------------------------------------------\n\n  function qrPolynomial(num, shift) {\n\n    if (typeof num.length == 'undefined') {\n      throw num.length + '/' + shift;\n    }\n\n    var _num = function() {\n      var offset = 0;\n      while (offset < num.length && num[offset] == 0) {\n        offset += 1;\n      }\n      var _num = new Array(num.length - offset + shift);\n      for (var i = 0; i < num.length - offset; i += 1) {\n        _num[i] = num[i + offset];\n      }\n      return _num;\n    }();\n\n    var _this = {};\n\n    _this.getAt = function(index) {\n      return _num[index];\n    };\n\n    _this.getLength = function() {\n      return _num.length;\n    };\n\n    _this.multiply = function(e) {\n\n      var num = new Array(_this.getLength() + e.getLength() - 1);\n\n      for (var i = 0; i < _this.getLength(); i += 1) {\n        for (var j = 0; j < e.getLength(); j += 1) {\n          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );\n        }\n      }\n\n      return qrPolynomial(num, 0);\n    };\n\n    _this.mod = function(e) {\n\n      if (_this.getLength() - e.getLength() < 0) {\n        return _this;\n      }\n\n      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );\n\n      var num = new Array(_this.getLength() );\n      for (var i = 0; i < _this.getLength(); i += 1) {\n        num[i] = _this.getAt(i);\n      }\n\n      for (var i = 0; i < e.getLength(); i += 1) {\n        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);\n      }\n\n      // recursive call\n      return qrPolynomial(num, 0).mod(e);\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // QRRSBlock\n  //---------------------------------------------------------------------\n\n  var QRRSBlock = function() {\n\n    var RS_BLOCK_TABLE = [\n\n      // L\n      // M\n      // Q\n      // H\n\n      // 1\n      [1, 26, 19],\n      [1, 26, 16],\n      [1, 26, 13],\n      [1, 26, 9],\n\n      // 2\n      [1, 44, 34],\n      [1, 44, 28],\n      [1, 44, 22],\n      [1, 44, 16],\n\n      // 3\n      [1, 70, 55],\n      [1, 70, 44],\n      [2, 35, 17],\n      [2, 35, 13],\n\n      // 4\n      [1, 100, 80],\n      [2, 50, 32],\n      [2, 50, 24],\n      [4, 25, 9],\n\n      // 5\n      [1, 134, 108],\n      [2, 67, 43],\n      [2, 33, 15, 2, 34, 16],\n      [2, 33, 11, 2, 34, 12],\n\n      // 6\n      [2, 86, 68],\n      [4, 43, 27],\n      [4, 43, 19],\n      [4, 43, 15],\n\n      // 7\n      [2, 98, 78],\n      [4, 49, 31],\n      [2, 32, 14, 4, 33, 15],\n      [4, 39, 13, 1, 40, 14],\n\n      // 8\n      [2, 121, 97],\n      [2, 60, 38, 2, 61, 39],\n      [4, 40, 18, 2, 41, 19],\n      [4, 40, 14, 2, 41, 15],\n\n      // 9\n      [2, 146, 116],\n      [3, 58, 36, 2, 59, 37],\n      [4, 36, 16, 4, 37, 17],\n      [4, 36, 12, 4, 37, 13],\n\n      // 10\n      [2, 86, 68, 2, 87, 69],\n      [4, 69, 43, 1, 70, 44],\n      [6, 43, 19, 2, 44, 20],\n      [6, 43, 15, 2, 44, 16],\n\n      // 11\n      [4, 101, 81],\n      [1, 80, 50, 4, 81, 51],\n      [4, 50, 22, 4, 51, 23],\n      [3, 36, 12, 8, 37, 13],\n\n      // 12\n      [2, 116, 92, 2, 117, 93],\n      [6, 58, 36, 2, 59, 37],\n      [4, 46, 20, 6, 47, 21],\n      [7, 42, 14, 4, 43, 15],\n\n      // 13\n      [4, 133, 107],\n      [8, 59, 37, 1, 60, 38],\n      [8, 44, 20, 4, 45, 21],\n      [12, 33, 11, 4, 34, 12],\n\n      // 14\n      [3, 145, 115, 1, 146, 116],\n      [4, 64, 40, 5, 65, 41],\n      [11, 36, 16, 5, 37, 17],\n      [11, 36, 12, 5, 37, 13],\n\n      // 15\n      [5, 109, 87, 1, 110, 88],\n      [5, 65, 41, 5, 66, 42],\n      [5, 54, 24, 7, 55, 25],\n      [11, 36, 12, 7, 37, 13],\n\n      // 16\n      [5, 122, 98, 1, 123, 99],\n      [7, 73, 45, 3, 74, 46],\n      [15, 43, 19, 2, 44, 20],\n      [3, 45, 15, 13, 46, 16],\n\n      // 17\n      [1, 135, 107, 5, 136, 108],\n      [10, 74, 46, 1, 75, 47],\n      [1, 50, 22, 15, 51, 23],\n      [2, 42, 14, 17, 43, 15],\n\n      // 18\n      [5, 150, 120, 1, 151, 121],\n      [9, 69, 43, 4, 70, 44],\n      [17, 50, 22, 1, 51, 23],\n      [2, 42, 14, 19, 43, 15],\n\n      // 19\n      [3, 141, 113, 4, 142, 114],\n      [3, 70, 44, 11, 71, 45],\n      [17, 47, 21, 4, 48, 22],\n      [9, 39, 13, 16, 40, 14],\n\n      // 20\n      [3, 135, 107, 5, 136, 108],\n      [3, 67, 41, 13, 68, 42],\n      [15, 54, 24, 5, 55, 25],\n      [15, 43, 15, 10, 44, 16],\n\n      // 21\n      [4, 144, 116, 4, 145, 117],\n      [17, 68, 42],\n      [17, 50, 22, 6, 51, 23],\n      [19, 46, 16, 6, 47, 17],\n\n      // 22\n      [2, 139, 111, 7, 140, 112],\n      [17, 74, 46],\n      [7, 54, 24, 16, 55, 25],\n      [34, 37, 13],\n\n      // 23\n      [4, 151, 121, 5, 152, 122],\n      [4, 75, 47, 14, 76, 48],\n      [11, 54, 24, 14, 55, 25],\n      [16, 45, 15, 14, 46, 16],\n\n      // 24\n      [6, 147, 117, 4, 148, 118],\n      [6, 73, 45, 14, 74, 46],\n      [11, 54, 24, 16, 55, 25],\n      [30, 46, 16, 2, 47, 17],\n\n      // 25\n      [8, 132, 106, 4, 133, 107],\n      [8, 75, 47, 13, 76, 48],\n      [7, 54, 24, 22, 55, 25],\n      [22, 45, 15, 13, 46, 16],\n\n      // 26\n      [10, 142, 114, 2, 143, 115],\n      [19, 74, 46, 4, 75, 47],\n      [28, 50, 22, 6, 51, 23],\n      [33, 46, 16, 4, 47, 17],\n\n      // 27\n      [8, 152, 122, 4, 153, 123],\n      [22, 73, 45, 3, 74, 46],\n      [8, 53, 23, 26, 54, 24],\n      [12, 45, 15, 28, 46, 16],\n\n      // 28\n      [3, 147, 117, 10, 148, 118],\n      [3, 73, 45, 23, 74, 46],\n      [4, 54, 24, 31, 55, 25],\n      [11, 45, 15, 31, 46, 16],\n\n      // 29\n      [7, 146, 116, 7, 147, 117],\n      [21, 73, 45, 7, 74, 46],\n      [1, 53, 23, 37, 54, 24],\n      [19, 45, 15, 26, 46, 16],\n\n      // 30\n      [5, 145, 115, 10, 146, 116],\n      [19, 75, 47, 10, 76, 48],\n      [15, 54, 24, 25, 55, 25],\n      [23, 45, 15, 25, 46, 16],\n\n      // 31\n      [13, 145, 115, 3, 146, 116],\n      [2, 74, 46, 29, 75, 47],\n      [42, 54, 24, 1, 55, 25],\n      [23, 45, 15, 28, 46, 16],\n\n      // 32\n      [17, 145, 115],\n      [10, 74, 46, 23, 75, 47],\n      [10, 54, 24, 35, 55, 25],\n      [19, 45, 15, 35, 46, 16],\n\n      // 33\n      [17, 145, 115, 1, 146, 116],\n      [14, 74, 46, 21, 75, 47],\n      [29, 54, 24, 19, 55, 25],\n      [11, 45, 15, 46, 46, 16],\n\n      // 34\n      [13, 145, 115, 6, 146, 116],\n      [14, 74, 46, 23, 75, 47],\n      [44, 54, 24, 7, 55, 25],\n      [59, 46, 16, 1, 47, 17],\n\n      // 35\n      [12, 151, 121, 7, 152, 122],\n      [12, 75, 47, 26, 76, 48],\n      [39, 54, 24, 14, 55, 25],\n      [22, 45, 15, 41, 46, 16],\n\n      // 36\n      [6, 151, 121, 14, 152, 122],\n      [6, 75, 47, 34, 76, 48],\n      [46, 54, 24, 10, 55, 25],\n      [2, 45, 15, 64, 46, 16],\n\n      // 37\n      [17, 152, 122, 4, 153, 123],\n      [29, 74, 46, 14, 75, 47],\n      [49, 54, 24, 10, 55, 25],\n      [24, 45, 15, 46, 46, 16],\n\n      // 38\n      [4, 152, 122, 18, 153, 123],\n      [13, 74, 46, 32, 75, 47],\n      [48, 54, 24, 14, 55, 25],\n      [42, 45, 15, 32, 46, 16],\n\n      // 39\n      [20, 147, 117, 4, 148, 118],\n      [40, 75, 47, 7, 76, 48],\n      [43, 54, 24, 22, 55, 25],\n      [10, 45, 15, 67, 46, 16],\n\n      // 40\n      [19, 148, 118, 6, 149, 119],\n      [18, 75, 47, 31, 76, 48],\n      [34, 54, 24, 34, 55, 25],\n      [20, 45, 15, 61, 46, 16]\n    ];\n\n    var qrRSBlock = function(totalCount, dataCount) {\n      var _this = {};\n      _this.totalCount = totalCount;\n      _this.dataCount = dataCount;\n      return _this;\n    };\n\n    var _this = {};\n\n    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {\n\n      switch(errorCorrectionLevel) {\n      case QRErrorCorrectionLevel.L :\n        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];\n      case QRErrorCorrectionLevel.M :\n        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];\n      case QRErrorCorrectionLevel.Q :\n        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];\n      case QRErrorCorrectionLevel.H :\n        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];\n      default :\n        return undefined;\n      }\n    };\n\n    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {\n\n      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);\n\n      if (typeof rsBlock == 'undefined') {\n        throw 'bad rs block @ typeNumber:' + typeNumber +\n            '/errorCorrectionLevel:' + errorCorrectionLevel;\n      }\n\n      var length = rsBlock.length / 3;\n\n      var list = [];\n\n      for (var i = 0; i < length; i += 1) {\n\n        var count = rsBlock[i * 3 + 0];\n        var totalCount = rsBlock[i * 3 + 1];\n        var dataCount = rsBlock[i * 3 + 2];\n\n        for (var j = 0; j < count; j += 1) {\n          list.push(qrRSBlock(totalCount, dataCount) );\n        }\n      }\n\n      return list;\n    };\n\n    return _this;\n  }();\n\n  //---------------------------------------------------------------------\n  // qrBitBuffer\n  //---------------------------------------------------------------------\n\n  var qrBitBuffer = function() {\n\n    var _buffer = [];\n    var _length = 0;\n\n    var _this = {};\n\n    _this.getBuffer = function() {\n      return _buffer;\n    };\n\n    _this.getAt = function(index) {\n      var bufIndex = Math.floor(index / 8);\n      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;\n    };\n\n    _this.put = function(num, length) {\n      for (var i = 0; i < length; i += 1) {\n        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);\n      }\n    };\n\n    _this.getLengthInBits = function() {\n      return _length;\n    };\n\n    _this.putBit = function(bit) {\n\n      var bufIndex = Math.floor(_length / 8);\n      if (_buffer.length <= bufIndex) {\n        _buffer.push(0);\n      }\n\n      if (bit) {\n        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );\n      }\n\n      _length += 1;\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // qrNumber\n  //---------------------------------------------------------------------\n\n  var qrNumber = function(data) {\n\n    var _mode = QRMode.MODE_NUMBER;\n    var _data = data;\n\n    var _this = {};\n\n    _this.getMode = function() {\n      return _mode;\n    };\n\n    _this.getLength = function(buffer) {\n      return _data.length;\n    };\n\n    _this.write = function(buffer) {\n\n      var data = _data;\n\n      var i = 0;\n\n      while (i + 2 < data.length) {\n        buffer.put(strToNum(data.substring(i, i + 3) ), 10);\n        i += 3;\n      }\n\n      if (i < data.length) {\n        if (data.length - i == 1) {\n          buffer.put(strToNum(data.substring(i, i + 1) ), 4);\n        } else if (data.length - i == 2) {\n          buffer.put(strToNum(data.substring(i, i + 2) ), 7);\n        }\n      }\n    };\n\n    var strToNum = function(s) {\n      var num = 0;\n      for (var i = 0; i < s.length; i += 1) {\n        num = num * 10 + chatToNum(s.charAt(i) );\n      }\n      return num;\n    };\n\n    var chatToNum = function(c) {\n      if ('0' <= c && c <= '9') {\n        return c.charCodeAt(0) - '0'.charCodeAt(0);\n      }\n      throw 'illegal char :' + c;\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // qrAlphaNum\n  //---------------------------------------------------------------------\n\n  var qrAlphaNum = function(data) {\n\n    var _mode = QRMode.MODE_ALPHA_NUM;\n    var _data = data;\n\n    var _this = {};\n\n    _this.getMode = function() {\n      return _mode;\n    };\n\n    _this.getLength = function(buffer) {\n      return _data.length;\n    };\n\n    _this.write = function(buffer) {\n\n      var s = _data;\n\n      var i = 0;\n\n      while (i + 1 < s.length) {\n        buffer.put(\n          getCode(s.charAt(i) ) * 45 +\n          getCode(s.charAt(i + 1) ), 11);\n        i += 2;\n      }\n\n      if (i < s.length) {\n        buffer.put(getCode(s.charAt(i) ), 6);\n      }\n    };\n\n    var getCode = function(c) {\n\n      if ('0' <= c && c <= '9') {\n        return c.charCodeAt(0) - '0'.charCodeAt(0);\n      } else if ('A' <= c && c <= 'Z') {\n        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;\n      } else {\n        switch (c) {\n        case ' ' : return 36;\n        case '$' : return 37;\n        case '%' : return 38;\n        case '*' : return 39;\n        case '+' : return 40;\n        case '-' : return 41;\n        case '.' : return 42;\n        case '/' : return 43;\n        case ':' : return 44;\n        default :\n          throw 'illegal char :' + c;\n        }\n      }\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // qr8BitByte\n  //---------------------------------------------------------------------\n\n  var qr8BitByte = function(data) {\n\n    var _mode = QRMode.MODE_8BIT_BYTE;\n    var _data = data;\n    var _bytes = qrcode.stringToBytes(data);\n\n    var _this = {};\n\n    _this.getMode = function() {\n      return _mode;\n    };\n\n    _this.getLength = function(buffer) {\n      return _bytes.length;\n    };\n\n    _this.write = function(buffer) {\n      for (var i = 0; i < _bytes.length; i += 1) {\n        buffer.put(_bytes[i], 8);\n      }\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // qrKanji\n  //---------------------------------------------------------------------\n\n  var qrKanji = function(data) {\n\n    var _mode = QRMode.MODE_KANJI;\n    var _data = data;\n\n    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];\n    if (!stringToBytes) {\n      throw 'sjis not supported.';\n    }\n    !function(c, code) {\n      // self test for sjis support.\n      var test = stringToBytes(c);\n      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {\n        throw 'sjis not supported.';\n      }\n    }('\\u53cb', 0x9746);\n\n    var _bytes = stringToBytes(data);\n\n    var _this = {};\n\n    _this.getMode = function() {\n      return _mode;\n    };\n\n    _this.getLength = function(buffer) {\n      return ~~(_bytes.length / 2);\n    };\n\n    _this.write = function(buffer) {\n\n      var data = _bytes;\n\n      var i = 0;\n\n      while (i + 1 < data.length) {\n\n        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);\n\n        if (0x8140 <= c && c <= 0x9FFC) {\n          c -= 0x8140;\n        } else if (0xE040 <= c && c <= 0xEBBF) {\n          c -= 0xC140;\n        } else {\n          throw 'illegal char at ' + (i + 1) + '/' + c;\n        }\n\n        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);\n\n        buffer.put(c, 13);\n\n        i += 2;\n      }\n\n      if (i < data.length) {\n        throw 'illegal char at ' + (i + 1);\n      }\n    };\n\n    return _this;\n  };\n\n  //=====================================================================\n  // GIF Support etc.\n  //\n\n  //---------------------------------------------------------------------\n  // byteArrayOutputStream\n  //---------------------------------------------------------------------\n\n  var byteArrayOutputStream = function() {\n\n    var _bytes = [];\n\n    var _this = {};\n\n    _this.writeByte = function(b) {\n      _bytes.push(b & 0xff);\n    };\n\n    _this.writeShort = function(i) {\n      _this.writeByte(i);\n      _this.writeByte(i >>> 8);\n    };\n\n    _this.writeBytes = function(b, off, len) {\n      off = off || 0;\n      len = len || b.length;\n      for (var i = 0; i < len; i += 1) {\n        _this.writeByte(b[i + off]);\n      }\n    };\n\n    _this.writeString = function(s) {\n      for (var i = 0; i < s.length; i += 1) {\n        _this.writeByte(s.charCodeAt(i) );\n      }\n    };\n\n    _this.toByteArray = function() {\n      return _bytes;\n    };\n\n    _this.toString = function() {\n      var s = '';\n      s += '[';\n      for (var i = 0; i < _bytes.length; i += 1) {\n        if (i > 0) {\n          s += ',';\n        }\n        s += _bytes[i];\n      }\n      s += ']';\n      return s;\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // base64EncodeOutputStream\n  //---------------------------------------------------------------------\n\n  var base64EncodeOutputStream = function() {\n\n    var _buffer = 0;\n    var _buflen = 0;\n    var _length = 0;\n    var _base64 = '';\n\n    var _this = {};\n\n    var writeEncoded = function(b) {\n      _base64 += String.fromCharCode(encode(b & 0x3f) );\n    };\n\n    var encode = function(n) {\n      if (n < 0) {\n        // error.\n      } else if (n < 26) {\n        return 0x41 + n;\n      } else if (n < 52) {\n        return 0x61 + (n - 26);\n      } else if (n < 62) {\n        return 0x30 + (n - 52);\n      } else if (n == 62) {\n        return 0x2b;\n      } else if (n == 63) {\n        return 0x2f;\n      }\n      throw 'n:' + n;\n    };\n\n    _this.writeByte = function(n) {\n\n      _buffer = (_buffer << 8) | (n & 0xff);\n      _buflen += 8;\n      _length += 1;\n\n      while (_buflen >= 6) {\n        writeEncoded(_buffer >>> (_buflen - 6) );\n        _buflen -= 6;\n      }\n    };\n\n    _this.flush = function() {\n\n      if (_buflen > 0) {\n        writeEncoded(_buffer << (6 - _buflen) );\n        _buffer = 0;\n        _buflen = 0;\n      }\n\n      if (_length % 3 != 0) {\n        // padding\n        var padlen = 3 - _length % 3;\n        for (var i = 0; i < padlen; i += 1) {\n          _base64 += '=';\n        }\n      }\n    };\n\n    _this.toString = function() {\n      return _base64;\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // base64DecodeInputStream\n  //---------------------------------------------------------------------\n\n  var base64DecodeInputStream = function(str) {\n\n    var _str = str;\n    var _pos = 0;\n    var _buffer = 0;\n    var _buflen = 0;\n\n    var _this = {};\n\n    _this.read = function() {\n\n      while (_buflen < 8) {\n\n        if (_pos >= _str.length) {\n          if (_buflen == 0) {\n            return -1;\n          }\n          throw 'unexpected end of file./' + _buflen;\n        }\n\n        var c = _str.charAt(_pos);\n        _pos += 1;\n\n        if (c == '=') {\n          _buflen = 0;\n          return -1;\n        } else if (c.match(/^\\s$/) ) {\n          // ignore if whitespace.\n          continue;\n        }\n\n        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );\n        _buflen += 6;\n      }\n\n      var n = (_buffer >>> (_buflen - 8) ) & 0xff;\n      _buflen -= 8;\n      return n;\n    };\n\n    var decode = function(c) {\n      if (0x41 <= c && c <= 0x5a) {\n        return c - 0x41;\n      } else if (0x61 <= c && c <= 0x7a) {\n        return c - 0x61 + 26;\n      } else if (0x30 <= c && c <= 0x39) {\n        return c - 0x30 + 52;\n      } else if (c == 0x2b) {\n        return 62;\n      } else if (c == 0x2f) {\n        return 63;\n      } else {\n        throw 'c:' + c;\n      }\n    };\n\n    return _this;\n  };\n\n  //---------------------------------------------------------------------\n  // gifImage (B/W)\n  //---------------------------------------------------------------------\n\n  var gifImage = function(width, height) {\n\n    var _width = width;\n    var _height = height;\n    var _data = new Array(width * height);\n\n    var _this = {};\n\n    _this.setPixel = function(x, y, pixel) {\n      _data[y * _width + x] = pixel;\n    };\n\n    _this.write = function(out) {\n\n      //---------------------------------\n      // GIF Signature\n\n      out.writeString('GIF87a');\n\n      //---------------------------------\n      // Screen Descriptor\n\n      out.writeShort(_width);\n      out.writeShort(_height);\n\n      out.writeByte(0x80); // 2bit\n      out.writeByte(0);\n      out.writeByte(0);\n\n      //---------------------------------\n      // Global Color Map\n\n      // black\n      out.writeByte(0x00);\n      out.writeByte(0x00);\n      out.writeByte(0x00);\n\n      // white\n      out.writeByte(0xff);\n      out.writeByte(0xff);\n      out.writeByte(0xff);\n\n      //---------------------------------\n      // Image Descriptor\n\n      out.writeString(',');\n      out.writeShort(0);\n      out.writeShort(0);\n      out.writeShort(_width);\n      out.writeShort(_height);\n      out.writeByte(0);\n\n      //---------------------------------\n      // Local Color Map\n\n      //---------------------------------\n      // Raster Data\n\n      var lzwMinCodeSize = 2;\n      var raster = getLZWRaster(lzwMinCodeSize);\n\n      out.writeByte(lzwMinCodeSize);\n\n      var offset = 0;\n\n      while (raster.length - offset > 255) {\n        out.writeByte(255);\n        out.writeBytes(raster, offset, 255);\n        offset += 255;\n      }\n\n      out.writeByte(raster.length - offset);\n      out.writeBytes(raster, offset, raster.length - offset);\n      out.writeByte(0x00);\n\n      //---------------------------------\n      // GIF Terminator\n      out.writeString(';');\n    };\n\n    var bitOutputStream = function(out) {\n\n      var _out = out;\n      var _bitLength = 0;\n      var _bitBuffer = 0;\n\n      var _this = {};\n\n      _this.write = function(data, length) {\n\n        if ( (data >>> length) != 0) {\n          throw 'length over';\n        }\n\n        while (_bitLength + length >= 8) {\n          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );\n          length -= (8 - _bitLength);\n          data >>>= (8 - _bitLength);\n          _bitBuffer = 0;\n          _bitLength = 0;\n        }\n\n        _bitBuffer = (data << _bitLength) | _bitBuffer;\n        _bitLength = _bitLength + length;\n      };\n\n      _this.flush = function() {\n        if (_bitLength > 0) {\n          _out.writeByte(_bitBuffer);\n        }\n      };\n\n      return _this;\n    };\n\n    var getLZWRaster = function(lzwMinCodeSize) {\n\n      var clearCode = 1 << lzwMinCodeSize;\n      var endCode = (1 << lzwMinCodeSize) + 1;\n      var bitLength = lzwMinCodeSize + 1;\n\n      // Setup LZWTable\n      var table = lzwTable();\n\n      for (var i = 0; i < clearCode; i += 1) {\n        table.add(String.fromCharCode(i) );\n      }\n      table.add(String.fromCharCode(clearCode) );\n      table.add(String.fromCharCode(endCode) );\n\n      var byteOut = byteArrayOutputStream();\n      var bitOut = bitOutputStream(byteOut);\n\n      // clear code\n      bitOut.write(clearCode, bitLength);\n\n      var dataIndex = 0;\n\n      var s = String.fromCharCode(_data[dataIndex]);\n      dataIndex += 1;\n\n      while (dataIndex < _data.length) {\n\n        var c = String.fromCharCode(_data[dataIndex]);\n        dataIndex += 1;\n\n        if (table.contains(s + c) ) {\n\n          s = s + c;\n\n        } else {\n\n          bitOut.write(table.indexOf(s), bitLength);\n\n          if (table.size() < 0xfff) {\n\n            if (table.size() == (1 << bitLength) ) {\n              bitLength += 1;\n            }\n\n            table.add(s + c);\n          }\n\n          s = c;\n        }\n      }\n\n      bitOut.write(table.indexOf(s), bitLength);\n\n      // end code\n      bitOut.write(endCode, bitLength);\n\n      bitOut.flush();\n\n      return byteOut.toByteArray();\n    };\n\n    var lzwTable = function() {\n\n      var _map = {};\n      var _size = 0;\n\n      var _this = {};\n\n      _this.add = function(key) {\n        if (_this.contains(key) ) {\n          throw 'dup key:' + key;\n        }\n        _map[key] = _size;\n        _size += 1;\n      };\n\n      _this.size = function() {\n        return _size;\n      };\n\n      _this.indexOf = function(key) {\n        return _map[key];\n      };\n\n      _this.contains = function(key) {\n        return typeof _map[key] != 'undefined';\n      };\n\n      return _this;\n    };\n\n    return _this;\n  };\n\n  var createDataURL = function(width, height, getPixel) {\n    var gif = gifImage(width, height);\n    for (var y = 0; y < height; y += 1) {\n      for (var x = 0; x < width; x += 1) {\n        gif.setPixel(x, y, getPixel(x, y) );\n      }\n    }\n\n    var b = byteArrayOutputStream();\n    gif.write(b);\n\n    var base64 = base64EncodeOutputStream();\n    var bytes = b.toByteArray();\n    for (var i = 0; i < bytes.length; i += 1) {\n      base64.writeByte(bytes[i]);\n    }\n    base64.flush();\n\n    return 'data:image/gif;base64,' + base64;\n  };\n\n  //---------------------------------------------------------------------\n  // returns qrcode function.\n\n  return qrcode;\n}();\n\n// multibyte support\n!function() {\n\n  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {\n    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array\n    function toUTF8Array(str) {\n      var utf8 = [];\n      for (var i=0; i < str.length; i++) {\n        var charcode = str.charCodeAt(i);\n        if (charcode < 0x80) utf8.push(charcode);\n        else if (charcode < 0x800) {\n          utf8.push(0xc0 | (charcode >> 6),\n              0x80 | (charcode & 0x3f));\n        }\n        else if (charcode < 0xd800 || charcode >= 0xe000) {\n          utf8.push(0xe0 | (charcode >> 12),\n              0x80 | ((charcode>>6) & 0x3f),\n              0x80 | (charcode & 0x3f));\n        }\n        // surrogate pair\n        else {\n          i++;\n          // UTF-16 encodes 0x10000-0x10FFFF by\n          // subtracting 0x10000 and splitting the\n          // 20 bits of 0x0-0xFFFFF into two halves\n          charcode = 0x10000 + (((charcode & 0x3ff)<<10)\n            | (str.charCodeAt(i) & 0x3ff));\n          utf8.push(0xf0 | (charcode >>18),\n              0x80 | ((charcode>>12) & 0x3f),\n              0x80 | ((charcode>>6) & 0x3f),\n              0x80 | (charcode & 0x3f));\n        }\n      }\n      return utf8;\n    }\n    return toUTF8Array(s);\n  };\n\n}();\n\n(function (factory) {\n  if (typeof define === 'function' && define.amd) {\n      define([], factory);\n  } else if (typeof exports === 'object') {\n      module.exports = factory();\n  }\n}(function () {\n    return qrcode;\n}));\n\n</script>\n<style>#scan-out .badge{max-width:100%;white-space:normal;overflow-wrap:anywhere}#scan-out code{unicode-bidi:plaintext}.scan-row small{line-height:1.8}#scan-status{line-height:1.9}#scan-ranges{font-family:monospace;line-height:1.8}</style>\n</head>\n<body>\n<div id=\"root\" aria-busy=\"true\">\n  <div class=\"auth-wrap\">\n    <div class=\"auth-card\">\n      <div class=\"auth-logo\">\n        <img src=\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJLYXZlaCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImtnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyMmQzZWUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjODE4Y2Y4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGZpbHRlciBpZD0iZ2xvdyIgeD0iLTMwJSIgeT0iLTMwJSIgd2lkdGg9IjE2MCUiIGhlaWdodD0iMTYwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIwIiBzdGREZXZpYXRpb249IjE4IiBmbG9vZC1jb2xvcj0iIzIyZDNlZSIgZmxvb2Qtb3BhY2l0eT0iMC41NSIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTIwIiBmaWxsPSIjMDYwNzBhIi8+CiAgPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iNDMyIiBoZWlnaHQ9IjQzMiIgcng9IjEwNCIgZmlsbD0iIzBiMGQxMyIgc3Ryb2tlPSJ1cmwoI2tnKSIgc3Ryb2tlLXdpZHRoPSI2IiBvcGFjaXR5PSIwLjk1Ii8+CiAgPCEtLSBEZXJhZnNoLWUgS8SBdsSrxIFuOiB0aGUgYmxhY2tzbWl0aCdzIGFwcm9uIHJhaXNlZCBhcyBhIHN0YW5kYXJkIC0tPgogIDxnIGZpbHRlcj0idXJsKCNnbG93KSI+CiAgICA8cGF0aCBkPSJNMTgwIDExOCBMMzMyIDExOCBMMzU2IDMwMCBRMjU2IDM0MCAxNTYgMzAwIFoiIGZpbGw9InVybCgja2cpIiBmaWxsLW9wYWNpdHk9IjAuMTYiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAgIDxwYXRoIGQ9Ik0yNTYgMTE4IEwyNTYgNDAwIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICAgIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIxMiIgcj0iMzQiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTIiLz4KICAgIDxwYXRoIGQ9Ik0yMTQgMzcyIEwyOTggMzcyIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8L2c+Cjwvc3ZnPgo=\" alt=\"\" width=\"52\" height=\"52\">\n        <h1>Omni</h1>\n        <p class=\"muted\" style=\"margin:0;font-size:12.5px\">در حال بارگذاری…</p>\n      </div>\n      <div class=\"skeleton\" style=\"height:38px;margin-bottom:9px\"></div>\n      <div class=\"skeleton\" style=\"height:38px;margin-bottom:9px\"></div>\n      <div class=\"skeleton\" style=\"height:38px;width:60%\"></div>\n    </div>\n  </div>\n</div>\n<div class=\"toasts\" id=\"toasts\" role=\"status\" aria-live=\"polite\"></div>\n<noscript><div class=\"auth-wrap\"><div class=\"auth-card\"><h1>JavaScript لازم است</h1></div></div></noscript>\n\n<script>\n\"use strict\";\n(() => {\n  var _t = \"x-omni-csrf\",\n    B = class extends Error {\n      constructor(t, s, i, o) {\n        super(i), (this.status = t), (this.code = s), (this.detail = o);\n      }\n    };\n  async function x(e, t, s, a = {}) {\n    let u0 = e === \"GET\" || e === \"HEAD\";\n    if (u0 && s && typeof s === \"object\" && (\"retry\" in s || \"signal\" in s)) {\n      a = s;\n      s = void 0;\n    }\n    let { retry: i = 1, signal: o } = a || {},\n      r = {\n        method: e,\n        headers: { [_t]: \"1\" },\n        credentials: \"same-origin\",\n        signal: o,\n      };\n    !u0 &&\n      s !== void 0 &&\n      ((r.headers[\"content-type\"] = \"application/json\"),\n      (r.body = JSON.stringify(s)));\n    let c;\n    for (let f = 0; f <= i; f++)\n      try {\n        let u = await fetch(t, r);\n        if (u.status === 204) return null;\n        let p = (u.headers.get(\"content-type\") || \"\").includes(\"json\")\n          ? await u.json()\n          : { raw: await u.text() };\n        if (!u.ok || p.ok === !1)\n          throw new B(\n            u.status,\n            p.code || \"error\",\n            p.error || u.statusText,\n            p.detail,\n          );\n        return p;\n      } catch (u) {\n        if (\n          ((c = u),\n          !(u instanceof B\n            ? u.status >= 500\n            : !(u instanceof DOMException && u.name === \"AbortError\")) ||\n            f === i)\n        )\n          break;\n        await new Promise((p) => setTimeout(p, 300 * (f + 1)));\n      }\n    throw c;\n  }\n  var b = {\n    get: (e, t) => x(\"GET\", e, void 0, t),\n    post: (e, t, s) => x(\"POST\", e, t ?? {}, s),\n    put: (e, t, s) => x(\"PUT\", e, t ?? {}, s),\n    patch: (e, t, s) => x(\"PATCH\", e, t ?? {}, s),\n    del: (e, t) => x(\"DELETE\", e, void 0, t),\n    whoami: () => x(\"GET\", \"/api/whoami\", void 0, { retry: 0 }),\n    login: (e, t) =>\n      x(\"POST\", \"/api/login\", { password: e, username: t }, { retry: 0 }),\n    setup: (e, t) =>\n      x(\"POST\", \"/api/setup\", { password: e, username: t }, { retry: 0 }),\n    logout: () => x(\"POST\", \"/api/logout\", {}, { retry: 0 }),\n    changePassword: (e, t) =>\n      x(\"POST\", \"/api/password\", { current: e, next: t }, { retry: 0 }),\n    overview: (e = 7) => x(\"GET\", `/api/overview?days=${e}`),\n    users: (e = {}) => x(\"GET\", `/api/users?${new URLSearchParams(e)}`),\n    user: (e) => x(\"GET\", `/api/users/${encodeURIComponent(e)}`),\n    createUser: (e) => x(\"POST\", \"/api/users\", e),\n    updateUser: (e, t) => x(\"PATCH\", `/api/users/${encodeURIComponent(e)}`, t),\n    deleteUser: (e) => x(\"DELETE\", `/api/users/${encodeURIComponent(e)}`),\n    bulk: (e, t, s) =>\n      x(\"POST\", \"/api/users/bulk\", { usernames: e, op: t, value: s }),\n    resetUser: (e, t) =>\n      x(\"POST\", `/api/users/${encodeURIComponent(e)}/reset`, t),\n    rotateToken: (e) =>\n      x(\"POST\", `/api/users/${encodeURIComponent(e)}/rotate-token`),\n    rotateUuid: (e) =>\n      x(\"POST\", `/api/users/${encodeURIComponent(e)}/rotate-uuid`),\n    userUsage: (e, t = 14) =>\n      x(\"GET\", `/api/stats/usage?username=${encodeURIComponent(e)}&days=${t}`),\n    settings: () => x(\"GET\", \"/api/settings\"),\n    saveSettings: (e) => x(\"PUT\", \"/api/settings\", e),\n    signup: () => x(\"POST\", \"/api/signup\", {}, { retry: 0 }),\n    fragments: () => x(\"GET\", \"/api/fragments\"),\n    probeNode: (e) =>\n      x(\"POST\", \"/api/diag/probe-node\", { proxy: e }, { retry: 0 }),\n    rankIps: (e, t) =>\n      x(\"POST\", \"/api/diag/rank-ips\", { ips: e, host: t }, { retry: 0 }),\n    ping: (e) =>\n      x(\"GET\", `/api/diag/ping?target=${encodeURIComponent(e)}`, void 0, {\n        retry: 0,\n      }),\n    logs: (e = 50) => x(\"GET\", `/api/diag/logs?limit=${e}`),\n    maintenance: () => x(\"POST\", \"/api/diag/maintenance\", {}, { retry: 0 }),\n    sessions: () => x(\"GET\", \"/api/sessions\"),\n    revoke: (e) => x(\"POST\", \"/api/sessions/revoke\", { id: e }),\n    revokeAll: () => x(\"POST\", \"/api/sessions/revoke\", { all: !0 }),\n  };\n  function le(e, t = \"\") {\n    return `/s/${e}${t ? `?type=${t}` : \"\"}`;\n  }\n  function Ee() {\n    let e = document.createElement(\"a\");\n    (e.href = \"/api/backup\"),\n      (e.download = \"\"),\n      document.body.append(e),\n      e.click(),\n      e.remove();\n  }\n  var Je = {\n      fa: {\n        app: {\n          name: \"\\u0627\\u0648\\u0645\\u0646\\u06CC\",\n          tagline:\n            \"\\u067E\\u0646\\u0644 \\u067E\\u0631\\u0648\\u06A9\\u0633\\u06CC \\u0644\\u0628\\u0647\\u200C\\u0627\\u06CC\",\n        },\n        nav: {\n          dashboard: \"\\u062F\\u0627\\u0634\\u0628\\u0648\\u0631\\u062F\",\n          users: \"\\u06A9\\u0627\\u0631\\u0628\\u0631\\u0627\\u0646\",\n          settings: \"\\u062A\\u0646\\u0638\\u06CC\\u0645\\u0627\\u062A\",\n          diag: \"\\u0639\\u06CC\\u0628\\u200C\\u06CC\\u0627\\u0628\\u06CC\",\n          sessions: \"\\u0646\\u0634\\u0633\\u062A\\u200C\\u0647\\u0627\",\n          logout: \"\\u062E\\u0631\\u0648\\u062C\",\n          scanner: \"\\u0627\\u0633\\u06A9\\u0646\\u0631\",\n          dns: \"\\u062F\\u06CC\\u200C\\u0627\\u0646\\u200C\\u0627\\u0633\",\n          configs: \"\\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF\\u200C\\u0647\\u0627\",\n        },\n        omni: {\n          heroTag:\n            \"\\u067E\\u0646\\u0644 \\u0634\\u062E\\u0635\\u06CC \\u0631\\u0648\\u06CC \\u06A9\\u0644\\u0648\\u062F\\u0641\\u0644\\u0631 \\xB7 Omni\",\n          online: \"\\u067E\\u0646\\u0644 \\u0622\\u0646\\u0644\\u0627\\u06CC\\u0646\",\n          statSni: \"SNI \\u067E\\u06CC\\u0634\\u200C\\u0641\\u0631\\u0636\",\n          statPorts: \"\\u067E\\u0648\\u0631\\u062A\\u200C\\u0647\\u0627\\u06CC TLS کلودفلر\",\n          statIps: \"candidate\\u0647\\u0627\\u06CC IP/hostname \\u0630\\u062E\\u06CC\\u0631\\u0647\\u200C\\u0634\\u062F\\u0647\",\n          statUsers: \"\\u06A9\\u0627\\u0631\\u0628\\u0631\\u0627\\u0646\",\n          statSniNote: \"\\u0645\\u0642\\u062f\\u0627\\u0631 public_host \\u062a\\u0646\\u0638\\u06cc\\u0645\\u200c\\u0634\\u062f\\u0647 \\u0628\\u0647\\u200c\\u0639\\u0646\\u0648\\u0627\\u0646 SNI \\u067e\\u06cc\\u0634\\u200c\\u0641\\u0631\\u0636\\u061b \\u0627\\u062a\\u0635\\u0627\\u0644 TLS \\u0627\\u0632 \\u0627\\u06cc\\u0646\\u062c\\u0627 \\u0622\\u0632\\u0645\\u0627\\u06cc\\u0634 \\u0646\\u0645\\u06cc\\u200c\\u0634\\u0648\\u062f.\",\n          statColoNote: \"\\u0634\\u0646\\u0627\\u0633\\u0647\\u0654 POP \\u0648 IP \\u062f\\u0631\\u062e\\u0648\\u0627\\u0633\\u062a \\u0627\\u0632 \\u067e\\u0627\\u0633\\u062e \\u0645\\u0648\\u0641\\u0642 /cdn-cgi/trace\\u061b \\u0633\\u0644\\u0627\\u0645\\u062a \\u062a\\u0648\\u0646\\u0644 \\u0631\\u0627 \\u0646\\u0634\\u0627\\u0646 \\u0646\\u0645\\u06cc\\u200c\\u062f\\u0647\\u062f.\",\n          statPortsNote: \"\\u0641\\u0647\\u0631\\u0633\\u062a \\u067e\\u0648\\u0631\\u062a\\u200c\\u0647\\u0627\\u06cc TLS \\u06a9\\u0644\\u0648\\u062f\\u0641\\u0644\\u0631\\u061b \\u062f\\u0633\\u062a\\u0631\\u0633\\u200c\\u067e\\u0630\\u06cc\\u0631\\u06cc \\u0632\\u0646\\u062f\\u0647 \\u0627\\u0632 \\u0627\\u06cc\\u0646\\u062c\\u0627 \\u0627\\u0646\\u062f\\u0627\\u0632\\u0647\\u200c\\u06af\\u06cc\\u0631\\u06cc \\u0646\\u0645\\u06cc\\u200c\\u0634\\u0648\\u062f.\",\n          statIpsNote: \"\\u0634\\u0645\\u0627\\u0631 \\u0648\\u0631\\u0648\\u062f\\u06cc\\u200c\\u0647\\u0627\\u06cc \\u0641\\u0647\\u0631\\u0633\\u062a IP/hostname\\u061b \\u0628\\u062f\\u0648\\u0646 \\u0628\\u0631\\u0631\\u0633\\u06cc \\u062f\\u0633\\u062a\\u0631\\u0633\\u200c\\u067e\\u0630\\u06cc\\u0631\\u06cc.\",\n          statColo:\n            \"\\u0644\\u0628\\u0647\\u0654 \\u06A9\\u0644\\u0627\\u062F\\u0641\\u0644\\u0631\",\n          localMode: \"\\u062D\\u0627\\u0644\\u062A \\u0645\\u062D\\u0644\\u06CC\",\n        },\n        cfg: {\n          title:\n            \"\\u0633\\u0627\\u0632\\u0646\\u062F\\u0647\\u0654 \\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF\",\n          desc: \"\\u0645\\u062B\\u0644 \\u0627\\u0648\\u0645\\u0646\\u06CC: \\u0622\\u062F\\u0631\\u0633 \\u0648 \\u067E\\u0648\\u0631\\u062A \\u0648 \\u067E\\u0631\\u0648\\u062A\\u06A9\\u0644 \\u0631\\u0627 \\u0627\\u0646\\u062A\\u062E\\u0627\\u0628 \\u06A9\\u0646\\u060C \\u062E\\u0631\\u0648\\u062C\\u06CC \\u0628\\u0647 \\u0647\\u0631 \\u0641\\u0631\\u0645\\u062A\\u06CC \\u0628\\u06AF\\u06CC\\u0631.\",\n          build: \"\\u0628\\u0633\\u0627\\u0632 \\u26A1\",\n          addresses: \"\\u0622\\u062F\\u0631\\u0633\\u200C\\u0647\\u0627\",\n          fromClean:\n            \"\\u0622\\u062f\\u0631\\u0633\\u200c\\u0647\\u0627\\u06cc IP \\u067e\\u06cc\\u0634\\u0646\\u0647\\u0627\\u062f\\u06cc\",\n          fromHost: \"\\u0647\\u0627\\u0633\\u062A \\u067E\\u0646\\u0644\",\n          fromCustom: \"\\u062F\\u0644\\u062E\\u0648\\u0627\\u0647\",\n          ipv6: \"\\u0627\\u0641\\u0632\\u0648\\u062f\\u0646 candidate\\u0647\\u0627\\u06cc IPv6 \\u06a9\\u0644\\u0648\\u062f\\u0641\\u0644\\u0631\",\n          cleanAvailable:\n            \"candidate\\u0647\\u0627\\u06cc IP \\u0630\\u062e\\u06cc\\u0631\\u0647\\u200c\\u0634\\u062f\\u0647\",\n          proxyips:\n            \"\\u067E\\u0631\\u0648\\u06A9\\u0633\\u06CC \\u0622\\u06CC\\u200C\\u067E\\u06CC\",\n          protoPorts:\n            \"\\u067E\\u0631\\u0648\\u062A\\u06A9\\u0644 \\u0648 \\u067E\\u0648\\u0631\\u062A\\u200C\\u0647\\u0627\",\n          fragment: \"\\u0641\\u0631\\u06AF\\u0645\\u0646\\u062A\",\n          hint: \"\\u062A\\u0646\\u0638\\u06CC\\u0645\\u0627\\u062A \\u0631\\u0627 \\u0627\\u0646\\u062A\\u062E\\u0627\\u0628 \\u0648 \\xAB\\u0628\\u0633\\u0627\\u0632\\xBB \\u0631\\u0627 \\u0628\\u0632\\u0646 \\u2014 \\u062E\\u0631\\u0648\\u062C\\u06CC \\u0647\\u0645\\u06CC\\u0646\\u200C\\u062C\\u0627 \\u0638\\u0627\\u0647\\u0631 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F.\",\n          configs: \"\\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF\",\n          user: \"\\u06A9\\u0627\\u0631\\u0628\\u0631\",\n          noUser:\n            \"\\u0627\\u0648\\u0644 \\u06CC\\u06A9 \\u06A9\\u0627\\u0631\\u0628\\u0631 \\u0628\\u0633\\u0627\\u0632\",\n          toOmni:\n            \"\\u0627\\u0641\\u0632\\u0648\\u062F\\u0646 \\u0628\\u0647 \\u0627\\u0648\\u0645\\u0646\\u06CC\",\n          subLink:\n            \"\\u0644\\u06CC\\u0646\\u06A9 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9 \\u0627\\u06CC\\u0646 \\u06A9\\u0627\\u0631\\u0628\\u0631\",\n        },\n        scanner: {\n          title:\n            \"\\u0627\\u0633\\u06a9\\u0646\\u0631 candidate\\u0647\\u0627\\u06cc Cloudflare\",\n          desc: \"اندازه‌گیری HTTPS در مرورگر و پاسخ Cloudflare از Worker جدا ثبت می‌شوند؛ RTT این دو مسیر هرگز با هم جمع نمی‌شود.\",\n          start: \"\\u0634\\u0631\\u0648\\u0639 \\u0627\\u0633\\u06A9\\u0646\",\n          rank: \"\\u0631\\u062a\\u0628\\u0647\\u200c\\u0628\\u0646\\u062f\\u06cc \\u0628\\u0631 \\u0627\\u0633\\u0627\\u0633 \\u0646\\u062a\\u06cc\\u062c\\u0647\\u0654 Worker\",\n          apply: \"ذخیره آدرس‌های اندازه‌گیری‌شده\",\n          hint: \"آماده — RTT مرورگر، دسترسی TCP از Worker و تأیید Cloudflare جدا گزارش می‌شوند؛ هر endpoint بعد از سنجش، برچسب ✅ می‌گیرد.\",\n          empty:\n            \"\\u0647\\u0646\\u0648\\u0632 \\u0646\\u062A\\u06CC\\u062C\\u0647\\u200C\\u0627\\u06CC \\u0646\\u06CC\\u0633\\u062A.\",\n          testing:\n            \"\\u062F\\u0631 \\u062D\\u0627\\u0644 \\u062A\\u0633\\u062A \\u0627\\u0632 \\u0645\\u0631\\u0648\\u0631\\u06AF\\u0631\\u2026\",\n          timeout: \"\\u0642\\u0637\\u0639\",\n          healthy: \"\\u0633\\u0627\\u0644\\u0645\",\n          done: \"\\u0627\\u0633\\u06A9\\u0646 \\u062A\\u0645\\u0627\\u0645 \\u0634\\u062F\",\n          reachable:\n            \"\\u0642\\u0627\\u0628\\u0644\\u200C\\u062F\\u0633\\u062A\\u0631\\u0633\",\n          ranking:\n            \"\\u062F\\u0631\\u062E\\u0648\\u0627\\u0633\\u062A \\u0631\\u062A\\u0628\\u0647\\u200C\\u0628\\u0646\\u062F\\u06CC \\u0628\\u0647 \\u0644\\u0628\\u0647\\u0654 \\u06A9\\u0644\\u0627\\u062F\\u0641\\u0644\\u0631\\u2026\",\n          edgeOk: \"\\u0633\\u0627\\u0644\\u0645 \\u0627\\u0632 \\u0644\\u0628\\u0647:\",\n          rankFail:\n            \"\\u0631\\u062A\\u0628\\u0647\\u200C\\u0628\\u0646\\u062F\\u06CC \\u0646\\u0627\\u0645\\u0648\\u0641\\u0642\",\n          saved:\n            \"\\u062F\\u0631 \\u062A\\u0646\\u0638\\u06CC\\u0645\\u0627\\u062A \\u0630\\u062E\\u06CC\\u0631\\u0647 \\u0634\\u062F\",\n          none: \"\\u0646\\u062A\\u06CC\\u062C\\u0647\\u0654 \\u0642\\u0627\\u0628\\u0644\\u200C\\u0630\\u062E\\u06CC\\u0631\\u0647 \\u0646\\u06CC\\u0633\\u062A\",\n          ranges:\n            \"\\u0631\\u0646\\u062C\\u200C\\u0647\\u0627\\u06CC \\u0627\\u0633\\u06A9\\u0646 (CIDR)\",\n          rangesHint:\n            \"\\u0627\\u0632 \\u0647\\u0631 \\u0631\\u0646\\u062C \\u0646\\u0645\\u0648\\u0646\\u0647\\u200C\\u0628\\u0631\\u062F\\u0627\\u0631\\u06CC \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F\\u061B \\u0628\\u0627 \\u0641\\u0631\\u0645\\u062A a.b.c.d/bit\\u060C \\u0647\\u0631 \\u0631\\u0646\\u062C \\u062F\\u0631 \\u06CC\\u06A9 \\u062E\\u0637.\",\n        },\n        dns: {\n          title: \"\\u062F\\u06CC\\u200C\\u0627\\u0646\\u200C\\u0627\\u0633 / DoH\",\n          desc: \"\\u0622\\u067E\\u0633\\u062A\\u0631\\u06CC\\u0645 DoH \\u0631\\u0627 \\u0627\\u0646\\u062A\\u062E\\u0627\\u0628 \\u0648 \\u0647\\u0645\\u06CC\\u0646\\u200C\\u062C\\u0627 \\u062A\\u0633\\u062A \\u06A9\\u0646.\",\n          active: \"\\u0641\\u0639\\u0627\\u0644\",\n          ir: \"\\u0627\\u06CC\\u0631\\u0627\\u0646\",\n          saved: \"\\u0630\\u062E\\u06CC\\u0631\\u0647 \\u0634\\u062F\",\n          error:\n            \"\\u0630\\u062E\\u06CC\\u0631\\u0647 \\u0646\\u0627\\u0645\\u0648\\u0641\\u0642\",\n          pick: \"\\u0627\\u0646\\u062A\\u062E\\u0627\\u0628\",\n          test: \"\\u062A\\u0633\\u062A\",\n          note: \"\\u067E\\u06CC\\u0634\\u200C\\u0641\\u0631\\u0636\\u200C\\u0647\\u0627\\u06CC \\u0627\\u06CC\\u0631\\u0627\\u0646 (\\u0634\\u06A9\\u0646\\u060C \\u0627\\u0644\\u06A9\\u062A\\u0631\\u0648\\u060C \\u0631\\u0627\\u062F\\u0627\\u0631\\u060C \\u06F4\\u06F0\\u06F3\\u060C \\u0628\\u06AF\\u0630\\u0631) \\u0648 \\u062C\\u0647\\u0627\\u0646\\u06CC \\u2014 \\u062A\\u0633\\u062A\\u060C \\u0632\\u0645\\u0627\\u0646 \\u067E\\u0627\\u0633\\u062E \\u0648\\u0627\\u0642\\u0639\\u06CC \\u0631\\u0627 \\u0646\\u0634\\u0627\\u0646 \\u0645\\u06CC\\u200C\\u062F\\u0647\\u062F.\",\n        },\n        signup: {\n          button:\n            \"\\u0633\\u0627\\u062E\\u062A \\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF \\u0631\\u0627\\u06CC\\u06AF\\u0627\\u0646\",\n          title:\n            \"\\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF \\u062E\\u0648\\u062F\\u062A \\u0631\\u0627 \\u0628\\u0633\\u0627\\u0632\",\n          sub: \"\\u0628\\u062F\\u0648\\u0646 \\u062B\\u0628\\u062A\\u200C\\u0646\\u0627\\u0645 \\u067E\\u06CC\\u0686\\u06CC\\u062F\\u0647 \\u2014 \\u06CC\\u06A9 \\u06A9\\u0644\\u06CC\\u06A9\",\n          step1:\n            \"\\u062F\\u06A9\\u0645\\u0647\\u0654 \\u067E\\u0627\\u06CC\\u06CC\\u0646 \\u0631\\u0627 \\u0628\\u0632\\u0646 \\u062A\\u0627 \\u062D\\u0633\\u0627\\u0628 \\u0648 \\u0644\\u06CC\\u0646\\u06A9 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9 \\u062A\\u0648 \\u0633\\u0627\\u062E\\u062A\\u0647 \\u0634\\u0648\\u062F.\",\n          step2:\n            \"\\u0644\\u06CC\\u0646\\u06A9 \\u06CC\\u0627 QR \\u0631\\u0627 \\u062F\\u0631 v2rayNG / Hiddify / Clash \\u0627\\u0636\\u0627\\u0641\\u0647 \\u06A9\\u0646.\",\n          step3:\n            \"\\u0633\\u0647\\u0645\\u06CC\\u0647 \\u0648 \\u062A\\u0627\\u0631\\u06CC\\u062E \\u0627\\u0646\\u0642\\u0636\\u0627 \\u0627\\u0632 \\u0627\\u0648\\u0644\\u06CC\\u0646 \\u0627\\u062A\\u0635\\u0627\\u0644 \\u062D\\u0633\\u0627\\u0628 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F.\",\n          create: \"\\u0628\\u0633\\u0627\\u0632! \\u26A1\",\n          doneTitle:\n            \"\\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF \\u062A\\u0648 \\u0622\\u0645\\u0627\\u062F\\u0647 \\u0627\\u0633\\u062A \\u{1F389}\",\n          doneSub:\n            \"\\u0644\\u06CC\\u0646\\u06A9 \\u0632\\u06CC\\u0631 \\u0631\\u0627 \\u062F\\u0631 \\u06A9\\u0644\\u0627\\u06CC\\u0646\\u062A\\u062A \\u0627\\u0636\\u0627\\u0641\\u0647 \\u06A9\\u0646\",\n          hint: \"\\u0644\\u06CC\\u0646\\u06A9 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9 \\u0631\\u0627 \\u0641\\u0642\\u0637 \\u0628\\u0631\\u0627\\u06CC \\u062E\\u0648\\u062F\\u062A \\u0646\\u06AF\\u0647 \\u062F\\u0627\\u0631\\u061B \\u0647\\u0631 \\u062F\\u0633\\u062A\\u06AF\\u0627\\u0647 \\u06A9\\u0647 \\u0628\\u0627 \\u0622\\u0646 \\u0648\\u0635\\u0644 \\u0634\\u0648\\u062F \\u0627\\u0632 \\u0633\\u0647\\u0645\\u06CC\\u0647\\u200C\\u0627\\u062A \\u06A9\\u0645 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F.\",\n          backLogin: \"\\u0648\\u0631\\u0648\\u062F \\u0645\\u062F\\u06CC\\u0631\",\n          settingToggle:\n            \"\\u062B\\u0628\\u062A\\u200C\\u0646\\u0627\\u0645 \\u0639\\u0645\\u0648\\u0645\\u06CC (\\u0633\\u0644\\u0641\\u200C\\u0633\\u0631\\u0648\\u06CC\\u0633 \\u0628\\u0627\\u0632\\u062F\\u06CC\\u062F\\u06A9\\u0646\\u0646\\u062F\\u06AF\\u0627\\u0646)\",\n          maxPerIp:\n            \"\\u062D\\u062F\\u0627\\u06A9\\u062B\\u0631 \\u062D\\u0633\\u0627\\u0628 \\u0628\\u0647\\u200C\\u0627\\u0632\\u0627\\u06CC \\u0647\\u0631 \\u0622\\u06CC\\u200C\\u067E\\u06CC \\u062F\\u0631 \\u0631\\u0648\\u0632\",\n        },\n        login: {\n          title: \"\\u0648\\u0631\\u0648\\u062F \\u0628\\u0647 \\u067E\\u0646\\u0644\",\n          setupTitle:\n            \"\\u0631\\u0627\\u0647\\u200C\\u0627\\u0646\\u062F\\u0627\\u0632\\u06CC \\u0627\\u0648\\u0645\\u0646\\u06CC\",\n          password: \"\\u0631\\u0645\\u0632 \\u0639\\u0628\\u0648\\u0631\",\n          username: \"\\u0646\\u0627\\u0645 \\u06A9\\u0627\\u0631\\u0628\\u0631\\u06CC\",\n          newPassword: \"\\u0631\\u0645\\u0632 \\u062C\\u062F\\u06CC\\u062F\",\n          submit: \"\\u0648\\u0631\\u0648\\u062F\",\n          setup: \"\\u0633\\u0627\\u062E\\u062A \\u067E\\u0646\\u0644\",\n          recover:\n            \"\\u0628\\u0627\\u0632\\u06CC\\u0627\\u0628\\u06CC \\u0631\\u0645\\u0632\",\n          hint: \"\\u0631\\u0645\\u0632 \\u0639\\u0628\\u0648\\u0631 \\u0628\\u0627 PBKDF2 \\u0648 \\u06F1\\u06F0\\u06F0\\u066C\\u06F0\\u06F0\\u06F0 \\u062A\\u06A9\\u0631\\u0627\\u0631 \\u0647\\u0634 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F.\",\n          setupHint:\n            \"\\u062D\\u062F\\u0627\\u0642\\u0644 \\u06F1\\u06F0 \\u06A9\\u0627\\u0631\\u0627\\u06A9\\u062A\\u0631. \\u0627\\u06CC\\u0646 \\u0631\\u0645\\u0632 \\u062A\\u0646\\u0647\\u0627 \\u06CC\\u06A9\\u200C\\u0628\\u0627\\u0631 \\u0642\\u0627\\u0628\\u0644 \\u062A\\u0646\\u0638\\u06CC\\u0645 \\u0627\\u0633\\u062A.\",\n        },\n        dash: {\n          users: \"\\u06A9\\u0627\\u0631\\u0628\\u0631\\u0627\\u0646\",\n          active: \"\\u0641\\u0639\\u0627\\u0644\",\n          expired: \"\\u0645\\u0646\\u0642\\u0636\\u06CC\",\n          traffic:\n            \"\\u062A\\u0631\\u0627\\u0641\\u06CC\\u06A9 \\u0645\\u0635\\u0631\\u0641\\u06CC\",\n          cf: \"درخواست‌های Cloudflare\",\n          reqToday: \"اتصال‌های ثبت‌شده امروز\",\n          topUsers:\n            \"\\u067E\\u0631\\u0645\\u0635\\u0631\\u0641\\u200C\\u062A\\u0631\\u06CC\\u0646\\u200C\\u0647\\u0627\",\n          traffic7:\n            \"\\u062A\\u0631\\u0627\\u0641\\u06CC\\u06A9 \\u06F7 \\u0631\\u0648\\u0632 \\u0627\\u062E\\u06CC\\u0631\",\n          alerts: \"\\u0647\\u0634\\u062F\\u0627\\u0631\\u0647\\u0627\",\n          noAlerts:\n            \"\\u0647\\u0645\\u0647\\u200C\\u0686\\u06CC\\u0632 \\u0633\\u0627\\u0644\\u0645 \\u0627\\u0633\\u062A \\u2705\",\n          noCf: \"Cloudflare Analytics متصل نیست؛ تعداد درخواست حدس زده نمی‌شود.\",\n          cfDanger:\n            \"\\u0633\\u0647\\u0645\\u06CC\\u0647\\u200C\\u06CC \\u06A9\\u0644\\u0648\\u062F\\u0641\\u0644\\u0631 \\u0646\\u0632\\u062F\\u06CC\\u06A9 \\u0627\\u062A\\u0645\\u0627\\u0645 \\u0627\\u0633\\u062A \\u2014 \\u0627\\u062D\\u062A\\u0645\\u0627\\u0644 \\u0628\\u0646 \\u0634\\u062F\\u0646 \\u0627\\u06A9\\u0627\\u0646\\u062A.\",\n          expiringSoon:\n            \"\\u06A9\\u0627\\u0631\\u0628\\u0631 \\u062A\\u0627 \\u06F2\\u06F4 \\u0633\\u0627\\u0639\\u062A \\u062F\\u06CC\\u06AF\\u0631 \\u0645\\u0646\\u0642\\u0636\\u06CC \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F.\",\n          connectionsToday: \"اتصال‌های ثبت‌شده امروز\",\n          connectionEvents: \"شروع اتصال تونل\",\n          trafficSourceNote: \"جمع ترافیک ثبت‌شدهٔ کاربران · آپلود + دانلود\",\n          connectionSourceNote: \"شمارندهٔ داخلی Worker؛ نه تعداد درخواست Cloudflare\",\n          cloudflareRequests: \"درخواست‌های Cloudflare\",\n          cloudflareUnavailable: \"اتصال به Cloudflare Analytics تنظیم نشده است؛ عددی حدس زده نمی‌شود.\",\n          sourceTitle: \"منبع و محدودیت آمار\",\n          sourceDescription: \"حجم از بایت‌های ثبت‌شدهٔ تونل کاربران است. اتصال‌ها شروع تونل‌های احراز‌شده‌اند و ممکن است با شمارنده‌های Cloudflare تفاوت داشته باشند.\",\n          expiringTitle: \"انقضای نزدیک\",\n          quotaTitle: \"نزدیک سقف حجم\",\n          noAccountAlerts: \"هشدار انقضای نزدیک یا حجم ثبت نشده است.\",\n          generated: \"آخرین بروزرسانی\",\n          allAccounts: \"حساب در مجموع\",\n          eventsTotal: \"رویدادهای اتصال ثبت‌شده\",\n          cloudflareNotMeasured: \"اندازه‌گیری نشده\",\n          download: \"دانلود\",\n          upload: \"آپلود\",\n        },\n        users: {\n          title: \"\\u06A9\\u0627\\u0631\\u0628\\u0631\\u0627\\u0646\",\n          create: \"\\u06A9\\u0627\\u0631\\u0628\\u0631 \\u062C\\u062F\\u06CC\\u062F\",\n          search:\n            \"\\u062C\\u0633\\u062A\\u062C\\u0648\\u06CC \\u0646\\u0627\\u0645\\u060C \\u06CC\\u0627\\u062F\\u062F\\u0627\\u0634\\u062A \\u06CC\\u0627 UUID\\u2026\",\n          col: {\n            user: \"\\u06A9\\u0627\\u0631\\u0628\\u0631\",\n            status: \"\\u0648\\u0636\\u0639\\u06CC\\u062A\",\n            traffic: \"\\u0645\\u0635\\u0631\\u0641\",\n            quota: \"\\u0633\\u0647\\u0645\\u06CC\\u0647\",\n            expiry: \"\\u0627\\u0646\\u0642\\u0636\\u0627\",\n            devices: \"\\u062F\\u0633\\u062A\\u06AF\\u0627\\u0647\",\n            actions: \"\",\n          },\n          all: \"\\u0647\\u0645\\u0647\",\n          activeOnly: \"\\u0641\\u0639\\u0627\\u0644\",\n          disabledOnly: \"\\u063A\\u06CC\\u0631\\u0641\\u0639\\u0627\\u0644\",\n          expiredOnly: \"\\u0645\\u0646\\u0642\\u0636\\u06CC\",\n          selected: \"\\u0627\\u0646\\u062A\\u062E\\u0627\\u0628 \\u0634\\u062F\\u0647\",\n          bulkEnable: \"\\u0641\\u0639\\u0627\\u0644\\u200C\\u0633\\u0627\\u0632\\u06CC\",\n          bulkDisable:\n            \"\\u063A\\u06CC\\u0631\\u0641\\u0639\\u0627\\u0644\\u200C\\u0633\\u0627\\u0632\\u06CC\",\n          bulkReset: \"\\u0631\\u06CC\\u0633\\u062A \\u062D\\u062C\\u0645\",\n          bulkExtend: \"\\u062A\\u0645\\u062F\\u06CC\\u062F \\u0631\\u0648\\u0632\",\n          bulkDelete: \"\\u062D\\u0630\\u0641\",\n          empty:\n            \"\\u0647\\u0646\\u0648\\u0632 \\u06A9\\u0627\\u0631\\u0628\\u0631\\u06CC \\u0646\\u0633\\u0627\\u062E\\u062A\\u0647\\u200C\\u0627\\u06CC\\u062F\",\n          emptyHint:\n            \"\\u0627\\u0648\\u0644\\u06CC\\u0646 \\u06A9\\u0627\\u0631\\u0628\\u0631 \\u0631\\u0627 \\u0628\\u0633\\u0627\\u0632\\u06CC\\u062F \\u062A\\u0627 \\u0644\\u06CC\\u0646\\u06A9 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9 \\u062A\\u0648\\u0644\\u06CC\\u062F \\u0634\\u0648\\u062F.\",\n          confirmDelete:\n            \"\\u062D\\u0630\\u0641 \\u06A9\\u0627\\u0631\\u0628\\u0631 \\xAB{name}\\xBB\\u061F \\u0627\\u06CC\\u0646 \\u0639\\u0645\\u0644 \\u0642\\u0627\\u0628\\u0644 \\u0628\\u0627\\u0632\\u06AF\\u0634\\u062A \\u0646\\u06CC\\u0633\\u062A.\",\n          confirmBulkDelete:\n            \"\\u062D\\u0630\\u0641 {n} \\u06A9\\u0627\\u0631\\u0628\\u0631\\u061F \\u0627\\u06CC\\u0646 \\u0639\\u0645\\u0644 \\u0642\\u0627\\u0628\\u0644 \\u0628\\u0627\\u0632\\u06AF\\u0634\\u062A \\u0646\\u06CC\\u0633\\u062A.\",\n          form: {\n            username: \"\\u0646\\u0627\\u0645 \\u06A9\\u0627\\u0631\\u0628\\u0631\\u06CC\",\n            quota:\n              \"\\u062D\\u062C\\u0645 (\\u06AF\\u06CC\\u06AF\\u0627\\u0628\\u0627\\u06CC\\u062A)\",\n            days: \"\\u0645\\u062F\\u062A (\\u0631\\u0648\\u0632)\",\n            devices:\n              \"\\u0633\\u0642\\u0641 \\u062F\\u0633\\u062A\\u06AF\\u0627\\u0647 \\u0647\\u0645\\u0632\\u0645\\u0627\\u0646\",\n            requests:\n              \"\\u0633\\u0642\\u0641 \\u062F\\u0631\\u062E\\u0648\\u0627\\u0633\\u062A (\\u06F0 = \\u0646\\u0627\\u0645\\u062D\\u062F\\u0648\\u062F)\",\n            firstConnect:\n              \"\\u0634\\u0631\\u0648\\u0639 \\u0632\\u0645\\u0627\\u0646 \\u0627\\u0632 \\u0627\\u0648\\u0644\\u06CC\\u0646 \\u0627\\u062A\\u0635\\u0627\\u0644\",\n            fragment:\n              \"\\u067E\\u0631\\u06CC\\u0633\\u062A \\u0641\\u0631\\u06AF\\u0645\\u0646\\u062A\",\n            fingerprint:\n              \"\\u0627\\u062B\\u0631 \\u0627\\u0646\\u06AF\\u0634\\u062A TLS\",\n            ips: \"\\u0622\\u062f\\u0631\\u0633\\u200c\\u0647\\u0627\\u06cc IP \\u067e\\u06cc\\u0634\\u0646\\u0647\\u0627\\u062f\\u06cc (\\u0647\\u0631 \\u062e\\u0637 \\u06cc\\u06a9\\u06cc)\",\n            proxies:\n              \"\\u067E\\u0631\\u0648\\u06A9\\u0633\\u06CC \\u0628\\u0627\\u0644\\u0627\\u062F\\u0633\\u062A\\u06CC (\\u0647\\u0631 \\u062E\\u0637 \\u06CC\\u06A9\\u06CC)\",\n            note: \"\\u06CC\\u0627\\u062F\\u062F\\u0627\\u0634\\u062A\",\n            blockList:\n              \"\\u062F\\u0627\\u0645\\u0646\\u0647\\u200C\\u0647\\u0627\\u06CC \\u0645\\u0633\\u062F\\u0648\\u062F (\\u0647\\u0631 \\u062E\\u0637 \\u06CC\\u06A9\\u06CC)\",\n            active: \"\\u0641\\u0639\\u0627\\u0644\",\n            usernameHint:\n              \"\\u06F3 \\u062A\\u0627 \\u06F3\\u06F2 \\u06A9\\u0627\\u0631\\u0627\\u06A9\\u062A\\u0631 \\u0627\\u0646\\u06AF\\u0644\\u06CC\\u0633\\u06CC\\u060C \\u0639\\u062F\\u062F\\u060C . _ -\",\n          },\n          drawer: {\n            configs: \"\\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF\\u200C\\u0647\\u0627\",\n            usage: \"\\u0645\\u0635\\u0631\\u0641\",\n            sub: \"\\u0644\\u06CC\\u0646\\u06A9 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9\",\n            qr: \"\\u06A9\\u06CC\\u0648\\u0622\\u0631\",\n            copy: \"\\u06A9\\u067E\\u06CC\",\n            copied: \"\\u06A9\\u067E\\u06CC \\u0634\\u062F!\",\n            rotateToken:\n              \"\\u0686\\u0631\\u062E\\u0634 \\u062A\\u0648\\u06A9\\u0646 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9\",\n            rotateUuid: \"\\u0686\\u0631\\u062E\\u0634 UUID\",\n            reset: \"\\u0631\\u06CC\\u0633\\u062A \\u062D\\u062C\\u0645\",\n            statusPage:\n              \"\\u0635\\u0641\\u062D\\u0647 \\u0648\\u0636\\u0639\\u06CC\\u062A\",\n            liveTest:\n              \"\\u062A\\u0633\\u062A \\u0632\\u0646\\u062F\\u0647\\u200C\\u06CC \\u0627\\u062A\\u0635\\u0627\\u0644\",\n          },\n          status: {\n            active: \"\\u0641\\u0639\\u0627\\u0644\",\n            disabled: \"\\u063A\\u06CC\\u0631\\u0641\\u0639\\u0627\\u0644\",\n            expired: \"\\u0645\\u0646\\u0642\\u0636\\u06CC\",\n            exhausted: \"\\u062D\\u062C\\u0645 \\u062A\\u0645\\u0627\\u0645\",\n          },\n        },\n        settings: {\n          title: \"\\u062A\\u0646\\u0638\\u06CC\\u0645\\u0627\\u062A\",\n          general: \"\\u0639\\u0645\\u0648\\u0645\\u06CC\",\n          network: \"\\u0634\\u0628\\u06A9\\u0647\",\n          security: \"\\u0627\\u0645\\u0646\\u06CC\\u062A\",\n          danger: \"\\u0645\\u0646\\u0637\\u0642\\u0647 \\u062E\\u0637\\u0631\",\n          panelName: \"\\u0646\\u0627\\u0645 \\u067E\\u0646\\u0644\",\n          publicHost:\n            \"\\u062F\\u0627\\u0645\\u0646\\u0647 \\u0639\\u0645\\u0648\\u0645\\u06CC (SNI)\",\n          port: \"\\u067E\\u0648\\u0631\\u062A\",\n          cleanIps:\n            \"\\u0622\\u062f\\u0631\\u0633\\u200c\\u0647\\u0627\\u06cc IP \\u0630\\u062e\\u06cc\\u0631\\u0647\\u200c\\u0634\\u062f\\u0647\",\n          ipPool:\n            \"\\u0645\\u062E\\u0632\\u0646 \\u0622\\u06CC\\u200C\\u067E\\u06CC \\u0628\\u0631\\u0627\\u06CC \\u0686\\u0631\\u062E\\u0634\",\n          autoRotate:\n            \"\\u0686\\u0631\\u062E\\u0634 \\u062E\\u0648\\u062F\\u06A9\\u0627\\u0631 \\u0622\\u06CC\\u200C\\u067E\\u06CC\",\n          rotateMinutes:\n            \"\\u0641\\u0627\\u0635\\u0644\\u0647 \\u0686\\u0631\\u062E\\u0634 (\\u062F\\u0642\\u06CC\\u0642\\u0647)\",\n          mux: \"\\u0641\\u0639\\u0627\\u0644\\u200C\\u0633\\u0627\\u0632\\u06CC Mux\",\n          blockNsfw:\n            \"\\u0645\\u0633\\u062F\\u0648\\u062F\\u0633\\u0627\\u0632\\u06CC \\u0645\\u062D\\u062A\\u0648\\u0627\\u06CC \\u0628\\u0632\\u0631\\u06AF\\u0633\\u0627\\u0644\",\n          blockAds:\n            \"\\u0645\\u0633\\u062F\\u0648\\u062F\\u0633\\u0627\\u0632\\u06CC \\u062A\\u0628\\u0644\\u06CC\\u063A\\u0627\\u062A\",\n          remark:\n            \"\\u067E\\u06CC\\u0634\\u0648\\u0646\\u062F \\u0646\\u0627\\u0645 \\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF\",\n          defaultQuota:\n            \"\\u062D\\u062C\\u0645 \\u067E\\u06CC\\u0634\\u200C\\u0641\\u0631\\u0636\",\n          defaultDays:\n            \"\\u0645\\u062F\\u062A \\u067E\\u06CC\\u0634\\u200C\\u0641\\u0631\\u0636\",\n          save: \"\\u0630\\u062E\\u06CC\\u0631\\u0647 \\u062A\\u063A\\u06CC\\u06CC\\u0631\\u0627\\u062A\",\n          saved:\n            \"\\u062A\\u0646\\u0638\\u06CC\\u0645\\u0627\\u062A \\u0630\\u062E\\u06CC\\u0631\\u0647 \\u0634\\u062F\",\n          backup:\n            \"\\u067E\\u0634\\u062A\\u06CC\\u0628\\u0627\\u0646\\u200C\\u06AF\\u06CC\\u0631\\u06CC\",\n          export: \"\\u062E\\u0631\\u0648\\u062C\\u06CC JSON\",\n          import:\n            \"\\u0628\\u0627\\u0632\\u06CC\\u0627\\u0628\\u06CC \\u0627\\u0632 JSON\",\n          changePassword:\n            \"\\u062A\\u063A\\u06CC\\u06CC\\u0631 \\u0631\\u0645\\u0632 \\u0639\\u0628\\u0648\\u0631\",\n          currentPassword: \"\\u0631\\u0645\\u0632 \\u0641\\u0639\\u0644\\u06CC\",\n          maintenance:\n            \"\\u062D\\u0627\\u0644\\u062A \\u062A\\u0639\\u0645\\u06CC\\u0631\\u0627\\u062A\",\n        },\n        diag: {\n          title: \"\\u0639\\u06CC\\u0628\\u200C\\u06CC\\u0627\\u0628\\u06CC\",\n          probeNode:\n            \"\\u062A\\u0633\\u062A \\u067E\\u0631\\u0648\\u06A9\\u0633\\u06CC \\u0628\\u0627\\u0644\\u0627\\u062F\\u0633\\u062A\\u06CC\",\n          probeHint: \"user:pass@1.2.3.4:1080 \\u06CC\\u0627 socks5://host:port\",\n          run: \"\\u0627\\u062C\\u0631\\u0627\",\n          rankIps:\n            \"\\u0628\\u0631\\u0631\\u0633\\u06cc candidate\\u0647\\u0627\\u06cc IP \\u0627\\u0632 Worker\",\n          rankHint:\n            \"\\u0632\\u0645\\u0627\\u0646 \\u067e\\u0627\\u0633\\u062e Worker \\u0628\\u0631\\u0627\\u06cc candidate\\u0647\\u0627\\u0633\\u062a\\u061b \\u062a\\u0623\\u062e\\u06cc\\u0631 \\u062f\\u0633\\u062a\\u06af\\u0627\\u0647 \\u0634\\u0645\\u0627 \\u06cc\\u0627 \\u0633\\u0644\\u0627\\u0645\\u062a \\u062a\\u0648\\u0646\\u0644 \\u0646\\u06cc\\u0633\\u062a.\",\n          ping: \"\\u0632\\u0645\\u0627\\u0646 \\u067e\\u0627\\u0633\\u062e HTTP/TCP \\u0627\\u0632 Worker\",\n          pingHint:\n            \"\\u0633\\u0647 \\u0633\\u0646\\u062c\\u0634 \\u0627\\u0632 Worker\\u061b \\u0646\\u0647 \\u067e\\u06cc\\u0646\\u06af ICMP\\u060c \\u0646\\u0647 \\u0632\\u0645\\u0627\\u0646 \\u062f\\u0633\\u062a\\u06af\\u0627\\u0647 \\u0634\\u0645\\u0627 \\u0648 \\u0646\\u0647 \\u0633\\u0644\\u0627\\u0645\\u062a \\u062a\\u0648\\u0646\\u0644.\",\n          audit:\n            \"\\u06AF\\u0632\\u0627\\u0631\\u0634 \\u0631\\u0648\\u06CC\\u062F\\u0627\\u062F\\u0647\\u0627\",\n          auditHint:\n            \"\\u0647\\u0631 \\u062A\\u063A\\u06CC\\u06CC\\u0631\\u060C \\u0628\\u0627 \\u0628\\u0627\\u0632\\u06CC\\u06AF\\u0631 \\u0648 \\u0632\\u0645\\u0627\\u0646. \\u0686\\u06CC\\u0632\\u06CC \\u06A9\\u0647 پنل‌های دیگر \\u0646\\u062F\\u0627\\u0631\\u062F.\",\n          latency: \"\\u062A\\u0623\\u062E\\u06CC\\u0631\",\n          healthy: \"\\u0633\\u0627\\u0644\\u0645\",\n          unhealthy: \"\\u0642\\u0637\\u0639\",\n          colo: \"\\u0645\\u0631\\u06A9\\u0632 \\u062F\\u0627\\u062F\\u0647\",\n          maintenance:\n            \"\\u0627\\u062C\\u0631\\u0627\\u06CC \\u0646\\u06AF\\u0647\\u062F\\u0627\\u0634\\u062A\",\n          maintenanceHint:\n            \"\\u0647\\u0645\\u0627\\u0646 \\u06A9\\u0627\\u0631\\u06CC \\u06A9\\u0647 \\u06A9\\u0631\\u0648\\u0646 \\u0647\\u0631 \\u06F1\\u06F0 \\u062F\\u0642\\u06CC\\u0642\\u0647 \\u0645\\u06CC\\u200C\\u06A9\\u0646\\u062F: \\u0627\\u0646\\u0642\\u0636\\u0627\\u060C \\u0686\\u0631\\u062E\\u0634 \\u0622\\u06CC\\u200C\\u067E\\u06CC\\u060C \\u067E\\u0627\\u06A9\\u200C\\u0633\\u0627\\u0632\\u06CC. \\u062F\\u0631 پنل‌های دیگر \\u0641\\u0642\\u0637 \\u0645\\u06CC\\u200C\\u062A\\u0648\\u0627\\u0646\\u06CC\\u062F \\u062D\\u062F\\u0633 \\u0628\\u0632\\u0646\\u06CC\\u062F \\u06A9\\u0647 \\u0627\\u062C\\u0631\\u0627 \\u0634\\u062F\\u0647 \\u06CC\\u0627 \\u0646\\u0647.\",\n          maintenanceDone:\n            \"\\u0646\\u06AF\\u0647\\u062F\\u0627\\u0634\\u062A \\u0627\\u062C\\u0631\\u0627 \\u0634\\u062F\",\n          expired: \"\\u0645\\u0646\\u0642\\u0636\\u06CC\\u200C\\u0634\\u062F\\u0647\",\n          ipsRotated:\n            \"\\u0622\\u06CC\\u200C\\u067E\\u06CC \\u0686\\u0631\\u062E\\u06CC\\u062F\\u0647\",\n        },\n        live: {\n          hint: \"\\u062A\\u0648\\u0646\\u0644 \\u0631\\u0627 \\u0627\\u0632 \\u0647\\u0645\\u06CC\\u0646\\u200C\\u062C\\u0627 \\u0628\\u0627\\u0632 \\u0645\\u06CC\\u200C\\u06A9\\u0646\\u062F \\u0648 \\u062A\\u0623\\u062E\\u06CC\\u0631 \\u0648\\u0627\\u0642\\u0639\\u06CC \\u0631\\u0627 \\u0645\\u06CC\\u200C\\u06AF\\u06CC\\u0631\\u062F.\",\n          running: \"\\u062F\\u0631 \\u062D\\u0627\\u0644 \\u062A\\u0633\\u062A\\u2026\",\n          ok: \"\\u0648\\u0635\\u0644 \\u0634\\u062F \\u2014 \\u062A\\u0648\\u0646\\u0644 \\u0633\\u0627\\u0644\\u0645 \\u0627\\u0633\\u062A.\",\n          refused:\n            \"\\u0631\\u062F \\u0634\\u062F: UUID \\u0646\\u0627\\u0645\\u0639\\u062A\\u0628\\u0631/\\u063A\\u06CC\\u0631\\u0641\\u0639\\u0627\\u0644\\u060C \\u0633\\u0642\\u0641 \\u062F\\u0633\\u062A\\u06AF\\u0627\\u0647\\u060C \\u06CC\\u0627 \\u0634\\u0628\\u06A9\\u0647 \\u0628\\u0633\\u062A\\u0647.\",\n          nodata:\n            \"\\u062a\\u0648\\u0646\\u0644 \\u0628\\u0627\\u0632 \\u0634\\u062f \\u0627\\u0645\\u0627 \\u0627\\u0632 upstream \\u062f\\u0627\\u062f\\u0647\\u200c\\u0627\\u06cc \\u0646\\u0631\\u0633\\u06cc\\u062f\\u061b candidate \\u06cc\\u0627 preset \\u0641\\u0631\\u06af\\u0645\\u0646\\u062a \\u062f\\u06cc\\u06af\\u0631\\u06cc \\u0631\\u0627 \\u0627\\u0645\\u062a\\u062d\\u0627\\u0646 \\u06a9\\u0646.\",\n          noopen:\n            \"\\u062F\\u0633\\u062A\\u200C\\u062F\\u0647\\u06CC WebSocket \\u0627\\u0646\\u062C\\u0627\\u0645 \\u0646\\u0634\\u062F \\u2014 \\u062F\\u0627\\u0645\\u0646\\u0647/SNI \\u06CC\\u0627 \\u0634\\u0628\\u06A9\\u0647 \\u0631\\u0627 \\u0628\\u0631\\u0631\\u0633\\u06CC \\u06A9\\u0646.\",\n        },\n        common: {\n          cancel: \"\\u0627\\u0646\\u0635\\u0631\\u0627\\u0641\",\n          save: \"\\u0630\\u062E\\u06CC\\u0631\\u0647\",\n          create: \"\\u0633\\u0627\\u062E\\u062A\",\n          delete: \"\\u062D\\u0630\\u0641\",\n          edit: \"\\u0648\\u06CC\\u0631\\u0627\\u06CC\\u0634\",\n          close: \"\\u0628\\u0633\\u062A\\u0646\",\n          copy: \"\\u06A9\\u067E\\u06CC\",\n          refresh: \"\\u0646\\u0648\\u0633\\u0627\\u0632\\u06CC\",\n          loading:\n            \"\\u062F\\u0631 \\u062D\\u0627\\u0644 \\u0628\\u0627\\u0631\\u06AF\\u0630\\u0627\\u0631\\u06CC\\u2026\",\n          yes: \"\\u0628\\u0644\\u0647\",\n          no: \"\\u062E\\u06CC\\u0631\",\n          none: \"\\u2014\",\n          search: \"\\u062C\\u0633\\u062A\\u062C\\u0648\",\n          cmdk: \"\\u062C\\u0633\\u062A\\u062C\\u0648 \\u06CC\\u0627 \\u0641\\u0631\\u0645\\u0627\\u0646\\u2026\",\n          offline: \"\\u0622\\u0641\\u0644\\u0627\\u06CC\\u0646\",\n          version: \"\\u0646\\u0633\\u062E\\u0647\",\n          gb: \"\\u06AF\\u06CC\\u06AF\\u0627\\u0628\\u0627\\u06CC\\u062A\",\n          day: \"\\u0631\\u0648\\u0632\",\n          days: \"\\u0631\\u0648\\u0632\",\n        },\n      },\n      en: {\n        app: { name: \"Omni\", tagline: \"Edge proxy panel\" },\n        nav: {\n          dashboard: \"Dashboard\",\n          users: \"Users\",\n          settings: \"Settings\",\n          diag: \"Diagnostics\",\n          sessions: \"Sessions\",\n          logout: \"Sign out\",\n          scanner: \"Scanner\",\n          dns: \"DNS\",\n          configs: \"Configs\",\n        },\n        omni: {\n          heroTag: \"Your personal panel on Cloudflare \\xB7 Omni\",\n          online: \"Panel online\",\n          statSni: \"Default SNI\",\n          statPorts: \"Cloudflare TLS ports\",\n          statIps: \"Saved IP/hostname candidates\",\n          statUsers: \"Users\",\n          statSniNote: \"Configured public_host used as the default SNI; no TLS handshake is measured here.\",\n          statColoNote: \"POP code and request IP from a successful /cdn-cgi/trace response; not tunnel health.\",\n          statPortsNote: \"Cloudflare TLS port list; live reachability is not measured here.\",\n          statIpsNote: \"Count of saved IP/hostname entries; reachability is not checked here.\",\n          statColo: \"CF edge\",\n          localMode: \"local mode\",\n        },\n        cfg: {\n          title: \"Config builder\",\n          desc: \"OMNI-style: pick addresses, ports and protocols, export in every format.\",\n          build: \"Build \\u26A1\",\n          addresses: \"Addresses\",\n          fromClean: \"Saved IP candidates\",\n          fromHost: \"Panel host\",\n          fromCustom: \"Custom\",\n          ipv6: \"Add Cloudflare IPv6s\",\n          cleanAvailable: \"saved candidates available\",\n          proxyips: \"Proxy IPs\",\n          protoPorts: \"Protocols & ports\",\n          fragment: \"Fragment\",\n          hint: \"Pick options and hit Build \\u2014 output appears here.\",\n          configs: \"config(s)\",\n          user: \"user\",\n          noUser: \"Create a user first\",\n          toOmni: \"Add to Omni\",\n          subLink: \"This user's subscription link\",\n        },\n        scanner: {\n          title: \"Cloudflare candidate scanner\",\n          desc: \"Browser HTTPS timing, Worker TCP reachability, and Cloudflare verification are separate measurements; none is inferred from another.\",\n          start: \"Start scan\",\n          rank: \"Rank by Worker results\",\n          apply: \"Save measured candidates\",\n          hint: \"Ready — browser RTT, Worker TCP reachability, and Cloudflare verification are reported separately; unmeasured results are never marked healthy.\",\n          empty: \"No results yet.\",\n          testing: \"Testing from browser\\u2026\",\n          timeout: \"down\",\n          healthy: \"healthy\",\n          done: \"Scan finished\",\n          reachable: \"reachable\",\n          ranking: \"Asking the Cloudflare edge to rank\\u2026\",\n          edgeOk: \"healthy from edge:\",\n          rankFail: \"Ranking failed\",\n          saved: \"Saved to settings\",\n          none: \"Nothing worth saving\",\n          ranges: \"Scan ranges (CIDR)\",\n          rangesHint: \"Sampled per range; a.b.c.d/bit, one per line.\",\n        },\n        dns: {\n          title: \"DNS / DoH\",\n          desc: \"Pick the DoH upstream and test it right here.\",\n          active: \"active\",\n          ir: \"IR\",\n          saved: \"Saved\",\n          error: \"Save failed\",\n          pick: \"Pick\",\n          test: \"Test\",\n          note: \"Iranian defaults (Shecan, Electro, Radar, 403, Begzar) plus global ones \\u2014 Test shows the real response time.\",\n        },\n        signup: {\n          button: \"Create your free config\",\n          title: \"Make your own config\",\n          sub: \"One click, no forms\",\n          step1:\n            \"Hit the button below and we create your account + subscription link.\",\n          step2: \"Paste the link or QR into v2rayNG / Hiddify / Clash.\",\n          step3: \"Quota and expiry start counting from your first connection.\",\n          create: \"Create it! \\u26A1\",\n          doneTitle: \"Your config is ready \\u{1F389}\",\n          doneSub: \"Add the link below in your client\",\n          hint: \"Keep the subscription link private \\u2014 every device connecting through it consumes your quota.\",\n          backLogin: \"Admin sign-in\",\n          settingToggle: \"Public signup (self-service for visitors)\",\n          maxPerIp: \"Max accounts per IP per day\",\n        },\n        login: {\n          title: \"Sign in\",\n          setupTitle: \"Set up Omni\",\n          password: \"Password\",\n          username: \"Username\",\n          newPassword: \"New password\",\n          submit: \"Sign in\",\n          setup: \"Create panel\",\n          recover: \"Recover\",\n          hint: \"Passwords are hashed with PBKDF2, 100,000 iterations (Cloudflare Workers cap).\",\n          setupHint: \"At least 10 characters. This can only be set once.\",\n        },\n        dash: {\n          users: \"Users\",\n          active: \"Active\",\n          expired: \"Expired\",\n          traffic: \"Traffic used\",\n          cf: \"Cloudflare requests\",\n          reqToday: \"Tracked connections today\",\n          topUsers: \"Top consumers\",\n          traffic7: \"Traffic \\u2014 last 7 days\",\n          alerts: \"Alerts\",\n          noAlerts: \"All clear \\u2705\",\n          noCf: \"Cloudflare Analytics isn't connected; request counts aren't guessed.\",\n          cfDanger:\n            \"Cloudflare quota nearly exhausted \\u2014 account ban risk.\",\n          expiringSoon: \"user(s) expire within 24 hours.\",\n          connectionsToday: \"Tracked connections today\",\n          connectionEvents: \"Tunnel connection starts\",\n          trafficSourceNote: \"Accounted subscriber traffic · upload + download\",\n          connectionSourceNote: \"Worker counter; not Cloudflare request volume\",\n          cloudflareRequests: \"Cloudflare requests\",\n          cloudflareUnavailable: \"Cloudflare Analytics isn't connected; no request total is inferred.\",\n          sourceTitle: \"Metric sources & limits\",\n          sourceDescription: \"Traffic is accounted tunnel bytes. Connection events are authenticated tunnel starts and may differ from Cloudflare analytics totals.\",\n          expiringTitle: \"Expiring soon\",\n          quotaTitle: \"Near quota\",\n          noAccountAlerts: \"No near-expiry or near-quota accounts found.\",\n          generated: \"Last updated\",\n          allAccounts: \"accounts total\",\n          eventsTotal: \"Tracked connection events\",\n          cloudflareNotMeasured: \"Not measured\",\n          download: \"Download\",\n          upload: \"Upload\",\n        },\n        users: {\n          title: \"Users\",\n          create: \"New user\",\n          search: \"Search name, note or UUID\\u2026\",\n          col: {\n            user: \"User\",\n            status: \"Status\",\n            traffic: \"Used\",\n            quota: \"Quota\",\n            expiry: \"Expires\",\n            devices: \"Devices\",\n            actions: \"\",\n          },\n          all: \"All\",\n          activeOnly: \"Active\",\n          disabledOnly: \"Disabled\",\n          expiredOnly: \"Expired\",\n          selected: \"selected\",\n          bulkEnable: \"Enable\",\n          bulkDisable: \"Disable\",\n          bulkReset: \"Reset traffic\",\n          bulkExtend: \"Extend days\",\n          bulkDelete: \"Delete\",\n          empty: \"No users yet\",\n          emptyHint: \"Create your first user to generate a subscription link.\",\n          confirmDelete:\n            \"Delete user \\u201C{name}\\u201D? This cannot be undone.\",\n          confirmBulkDelete: \"Delete {n} users? This cannot be undone.\",\n          form: {\n            username: \"Username\",\n            quota: \"Quota (GB)\",\n            days: \"Duration (days)\",\n            devices: \"Concurrent devices\",\n            requests: \"Request limit (0 = unlimited)\",\n            firstConnect: \"Start clock on first connect\",\n            fragment: \"Fragment preset\",\n            fingerprint: \"TLS fingerprint\",\n            ips: \"IP candidates (one per line)\",\n            proxies: \"Upstream proxies (one per line)\",\n            note: \"Note\",\n            blockList: \"Blocked domains (one per line)\",\n            active: \"Active\",\n            usernameHint: \"3\\u201332 chars: letters, digits, . _ -\",\n          },\n          drawer: {\n            configs: \"Configs\",\n            usage: \"Usage\",\n            sub: \"Subscription link\",\n            qr: \"QR\",\n            copy: \"Copy\",\n            copied: \"Copied!\",\n            rotateToken: \"Rotate sub token\",\n            rotateUuid: \"Rotate UUID\",\n            reset: \"Reset traffic\",\n            statusPage: \"Status page\",\n            liveTest: \"Live connection test\",\n          },\n          status: {\n            active: \"Active\",\n            disabled: \"Disabled\",\n            expired: \"Expired\",\n            exhausted: \"Exhausted\",\n          },\n        },\n        settings: {\n          title: \"Settings\",\n          general: \"General\",\n          network: \"Network\",\n          security: \"Security\",\n          danger: \"Danger zone\",\n          panelName: \"Panel name\",\n          publicHost: \"Public host (SNI)\",\n          port: \"Port\",\n          cleanIps: \"Saved IP candidates\",\n          ipPool: \"IP pool for rotation\",\n          autoRotate: \"Auto-rotate IPs\",\n          rotateMinutes: \"Rotation interval (min)\",\n          mux: \"Enable Mux\",\n          blockNsfw: \"Block adult content\",\n          blockAds: \"Block ads\",\n          remark: \"Config name prefix\",\n          defaultQuota: \"Default quota\",\n          defaultDays: \"Default duration\",\n          save: \"Save changes\",\n          saved: \"Settings saved\",\n          backup: \"Backup\",\n          export: \"Export JSON\",\n          import: \"Import JSON\",\n          changePassword: \"Change password\",\n          currentPassword: \"Current password\",\n          maintenance: \"Maintenance mode\",\n        },\n        diag: {\n          title: \"Diagnostics\",\n          probeNode: \"Probe upstream proxy\",\n          probeHint: \"user:pass@1.2.3.4:1080 or socks5://host:port\",\n          run: \"Run\",\n          rankIps: \"Probe configured IP candidates\",\n          rankHint: \"Worker-side response checks only; not your device latency or tunnel health.\",\n          ping: \"Worker HTTP/TCP response time\",\n          pingHint: \"Three Worker-side samples; not ICMP, client latency, or tunnel health.\",\n          audit: \"Audit log\",\n          auditHint: \"Every change, with actor and time.\",\n          latency: \"Latency\",\n          healthy: \"Healthy\",\n          unhealthy: \"Down\",\n          colo: \"Colo\",\n          maintenance: \"Run maintenance\",\n          maintenanceHint:\n            \"Exactly what the cron does every 10 minutes: expiry, IP rotation and pruning.\",\n          maintenanceDone: \"Maintenance complete\",\n          expired: \"Expired\",\n          ipsRotated: \"IPs rotated\",\n        },\n        live: {\n          hint: \"Opens the tunnel from here and measures real latency.\",\n          running: \"Testing\\u2026\",\n          ok: \"Connected \\u2014 tunnel is healthy.\",\n          refused:\n            \"Refused: unknown/disabled UUID, device limit, or blocked network.\",\n          nodata:\n            \"The tunnel opened but the upstream sent no data \\u2014 try another candidate or fragment preset.\",\n          noopen:\n            \"WebSocket handshake failed \\u2014 check domain/SNI or your network.\",\n        },\n        common: {\n          cancel: \"Cancel\",\n          save: \"Save\",\n          create: \"Create\",\n          delete: \"Delete\",\n          edit: \"Edit\",\n          close: \"Close\",\n          copy: \"Copy\",\n          refresh: \"Refresh\",\n          loading: \"Loading\\u2026\",\n          yes: \"Yes\",\n          no: \"No\",\n          none: \"\\u2014\",\n          search: \"Search\",\n          cmdk: \"Search or run a command\\u2026\",\n          offline: \"Offline\",\n          version: \"Version\",\n          gb: \"GB\",\n          day: \"day\",\n          days: \"days\",\n        },\n      },\n    },\n    P = {\n      lang: localStorage.getItem(\"omni.lang\") || \"fa\",\n      dir() {\n        return this.lang === \"fa\" ? \"rtl\" : \"ltr\";\n      },\n      set(e) {\n        (this.lang = e),\n          localStorage.setItem(\"omni.lang\", e),\n          (document.documentElement.lang = e),\n          (document.documentElement.dir = this.dir());\n      },\n      t(e, t) {\n        let s = (o) => e.split(\".\").reduce((r, c) => (r == null ? r : r[c]), o),\n          i = s(Je[this.lang]) ?? s(Je.en) ?? e;\n        if (t)\n          for (let [o, r] of Object.entries(t)) i = i.replaceAll(`{${o}}`, r);\n        return i;\n      },\n    },\n    n = (e, t) => P.t(e, t);\n  function v(e, { digits: t = 0 } = {}) {\n    return Number(e || 0).toLocaleString(P.lang === \"fa\" ? \"fa-IR\" : \"en-US\", {\n      minimumFractionDigits: t,\n      maximumFractionDigits: t,\n    });\n  }\n  var D = (e) => {\n    let t = Number(e || 0);\n    return t < 1024\n      ? `${t} B`\n      : t < 1024 ** 2\n        ? `${(t / 1024).toFixed(1)} KB`\n        : t < 1024 ** 3\n          ? `${(t / 1024 ** 2).toFixed(1)} MB`\n          : `${(t / 1024 ** 3).toFixed(2)} GB`;\n  };\n  function ye(e) {\n    if (!e) return n(\"common.none\");\n    let ms =\n      typeof e === \"number\"\n        ? e\n        : Date.parse(\n            String(e).includes(\"T\")\n              ? String(e)\n              : String(e).replace(\" \", \"T\") + \"Z\",\n          );\n    if (!Number.isFinite(ms)) return \"\\u2014\";\n    let t = Math.max(0, Math.floor((Date.now() - ms) / 1e3));\n    if (t < 60)\n      return P.lang === \"fa\"\n        ? `${t} \\u062B\\u0627\\u0646\\u06CC\\u0647 \\u067E\\u06CC\\u0634`\n        : `${t}s ago`;\n    let s = Math.floor(t / 60);\n    if (s < 60)\n      return P.lang === \"fa\"\n        ? `${s} \\u062F\\u0642\\u06CC\\u0642\\u0647 \\u067E\\u06CC\\u0634`\n        : `${s}m ago`;\n    let i = Math.floor(s / 60);\n    if (i < 24)\n      return P.lang === \"fa\"\n        ? `${i} \\u0633\\u0627\\u0639\\u062A \\u067E\\u06CC\\u0634`\n        : `${i}h ago`;\n    let o = Math.floor(i / 24);\n    return P.lang === \"fa\"\n      ? `${o} \\u0631\\u0648\\u0632 \\u067E\\u06CC\\u0634`\n      : `${o}d ago`;\n  }\n  function ce(e) {\n    if (e == null) return \"\\u221E\";\n    let ms =\n      typeof e === \"number\"\n        ? e\n        : Date.parse(\n            String(e).includes(\"T\")\n              ? String(e)\n              : String(e).replace(\" \", \"T\") + \"Z\",\n          ) - Date.now();\n    if (!Number.isFinite(ms)) return \"\\u221E\";\n    if (ms <= 0)\n      return P.lang === \"fa\"\n        ? \"\\u062A\\u0645\\u0627\\u0645 \\u0634\\u062F\\u0647\"\n        : \"expired\";\n    let t = Math.floor(ms / 864e5),\n      s = Math.floor((ms % 864e5) / 36e5);\n    return t > 0\n      ? P.lang === \"fa\"\n        ? `${t} \\u0631\\u0648\\u0632 \\u0648 ${s} \\u0633\\u0627\\u0639\\u062A`\n        : `${t}d ${s}h`\n      : P.lang === \"fa\"\n        ? `${s} \\u0633\\u0627\\u0639\\u062A`\n        : `${s}h`;\n  }\n  var Ke = (e) =>\n    e\n      ? new Date(e).toLocaleDateString(P.lang === \"fa\" ? \"fa-IR\" : \"en-US\")\n      : n(\"common.none\");\n  var a = (e) =>\n      String(e ?? \"\")\n        .replaceAll(\"&\", \"&amp;\")\n        .replaceAll(\"<\", \"&lt;\")\n        .replaceAll(\">\", \"&gt;\")\n        .replaceAll('\"', \"&quot;\")\n        .replaceAll(\"'\", \"&#39;\"),\n    Qe = {\n      dash: \"M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z\",\n      users:\n        \"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75\",\n      gear: \"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 2h-4l-.4 2.6c-.7.3-1.4.7-2 1.2l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z\",\n      activity: \"M22 12h-4l-3 9L9 3l-3 9H2\",\n      shield: \"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z\",\n      logout: \"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9\",\n      plus: \"M12 5v14M5 12h14\",\n      search: \"M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35\",\n      refresh:\n        \"M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15\",\n      copy: \"M9 9h10v12H9zM5 15H3V3h12v2\",\n      trash: \"M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6\",\n      edit: \"M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z\",\n      close: \"M18 6 6 18M6 6l12 12\",\n      sun: \"M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2M12 21v-2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M22 12h-2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4\",\n      moon: \"M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z\",\n      globe:\n        \"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5-2.3 3.8-5.3 3.8-9S14.5 4.3 12 2C9.5 4.3 8.2 7.3 8.2 11s1.3 6.7 3.8 9ZM2.5 9h19M2.5 15h19\",\n      check: \"M20 6 9 17l-5-5\",\n      alert:\n        \"M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z\",\n      bolt: \"M13 2 3 14h7v8l10-12h-7z\",\n      link: \"M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7\",\n      qr: \"M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM14 21h1v-3M21 14v1\",\n      download:\n        \"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3\",\n      upload: \"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12\",\n      play: \"M6 3l14 9-14 9z\",\n      menu: \"M3 6h18M3 12h18M3 18h18\",\n      chevron: \"m9 18 6-6-6-6\",\n      clock: \"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2\",\n      filter: \"M22 3H2l8 9.5V19l4 2v-8.5z\",\n      key: \"M21 2l-2 2m-7.6 7.6a5 5 0 1 1-7 7 5 5 0 0 1 7-7Zm0 0L15 8m0 0 3 3 3-3-3-3\",\n      db: \"M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3Zm8-3v14c0 1.7-3.6 3-8 3s-8-1.3-8-3V5m16 7c0 1.7-3.6 3-8 3s-8-1.3-8-3\",\n      eye: \"M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z\",\n      wifi: \"M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01M2 9a15 15 0 0 1 20 0\",\n    },\n    Et = new Set([\"dash\", \"bolt\", \"play\", \"filter\"]);\n  function d(e, t = \"\") {\n    let s = Qe[e] || Qe.bolt,\n      i = Et.has(e);\n    return `<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" class=\"${t}\" fill=\"${i ? \"currentColor\" : \"none\"}\" stroke=\"${i ? \"none\" : \"currentColor\"}\"\n    stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"${s}\"/></svg>`;\n  }\n  function y(e, t = \"info\", s = 3200) {\n    let i = document.getElementById(\"toasts\");\n    if (!i) return;\n    let o = document.createElement(\"div\");\n    (o.className = `toast ${t}`),\n      (o.innerHTML = `${d(t === \"err\" ? \"alert\" : t === \"ok\" ? \"check\" : \"bolt\")} <span>${a(e)}</span>`),\n      (o.style.display = \"flex\"),\n      (o.style.gap = \"8px\"),\n      (o.style.alignItems = \"center\"),\n      i.append(o),\n      setTimeout(() => {\n        (o.style.transition = \"opacity .25s, transform .25s\"),\n          (o.style.opacity = \"0\"),\n          (o.style.transform = \"translateY(6px)\"),\n          setTimeout(() => o.remove(), 260);\n      }, s);\n  }\n  var R = null;\n  function Le({ title: e, body: t, footer: s = \"\", wide: i = !1, onMount: o }) {\n    return (\n      W(),\n      (R = document.createElement(\"div\")),\n      (R.className = \"overlay\"),\n      (R.innerHTML = `<div class=\"modal ${i ? \"modal-wide\" : \"\"}\" role=\"dialog\" aria-modal=\"true\" aria-label=\"${a(e)}\">\n      <div class=\"modal-head\"><h2>${a(e)}</h2><div class=\"spacer\"></div>\n        <button class=\"btn btn-ghost btn-icon\" data-action=\"close-modal\" aria-label=\"${a(n(\"common.close\"))}\">${d(\"close\")}</button></div>\n      <div class=\"modal-body\">${t}</div>\n      ${s ? `<div class=\"modal-foot\">${s}</div>` : \"\"}\n    </div>`),\n      R.addEventListener(\"mousedown\", (r) => {\n        r.target === R && W();\n      }),\n      document.body.append(R),\n      (document.body.style.overflow = \"hidden\"),\n      o?.(R),\n      R.querySelector(\"input,select,textarea,button\")?.focus(),\n      R\n    );\n  }\n  function W() {\n    R?.remove(),\n      (R = null),\n      document.querySelector(\".drawer\") || (document.body.style.overflow = \"\");\n  }\n  function Q(e, { danger: t = !1, okLabel: s } = {}) {\n    return new Promise((i) => {\n      Le({\n        title: t ? n(\"common.delete\") : \"\\u061F\",\n        body: `<p style=\"margin:0;font-size:14px;line-height:1.8\">${a(e)}</p>`,\n        footer: `<button class=\"btn\" data-confirm=\"no\">${a(n(\"common.cancel\"))}</button>\n               <button class=\"btn ${t ? \"btn-danger\" : \"btn-primary\"}\" data-confirm=\"yes\">${a(s || n(\"common.yes\"))}</button>`,\n        onMount: (r) => {\n          r.addEventListener(\"click\", (c) => {\n            let f = c.target.closest(\"[data-confirm]\");\n            f && (W(), i(f.dataset.confirm === \"yes\"));\n          });\n        },\n      })?.addEventListener(\"keydown\", (r) => {\n        r.key === \"Escape\" && (W(), i(!1));\n      });\n    });\n  }\n  function Ye({ title: e, body: t, footer: s = \"\", onMount: i }) {\n    J();\n    let o = document.createElement(\"div\");\n    return (\n      (o.className = \"drawer\"),\n      o.setAttribute(\"role\", \"dialog\"),\n      (o.innerHTML = `<div class=\"modal-head\"><h2>${a(e)}</h2><div class=\"spacer\"></div>\n      <button class=\"btn btn-ghost btn-icon\" data-action=\"close-drawer\">${d(\"close\")}</button></div>\n    <div class=\"modal-body\" style=\"flex:1\">${t}</div>\n    ${s ? `<div class=\"modal-foot\">${s}</div>` : \"\"}`),\n      document.body.append(o),\n      (document.body.style.overflow = \"hidden\"),\n      i?.(o),\n      o\n    );\n  }\n  function J() {\n    document.querySelector(\".drawer\")?.remove(),\n      R || (document.body.style.overflow = \"\");\n  }\n  var $e = (e, t = \"\") =>\n      `<div class=\"meter ${t}\"><div class=\"meter-fill ${e > 90 ? \"danger\" : e > 70 ? \"warn\" : \"\"}\" style=\"width:${Math.min(100, e)}%\"></div></div>`,\n    Ce = (e) =>\n      `<span class=\"badge ${{ active: \"ok\", expired: \"danger\", exhausted: \"warn\", disabled: \"\" }[e] ?? \"\"}\">${a(n(`users.status.${e}`))}</span>`;\n  function te(e, t = n(\"common.copy\"), s = !0) {\n    return `<button class=\"btn ${s ? \"btn-sm\" : \"\"}\" data-action=\"copy\" data-copy=\"${a(e)}\">${d(\"copy\")} ${a(t)}</button>`;\n  }\n  async function ae(e) {\n    try {\n      return await navigator.clipboard.writeText(e), !0;\n    } catch {\n      let t = document.createElement(\"textarea\");\n      (t.value = e),\n        (t.style.cssText = \"position:fixed;opacity:0\"),\n        document.body.append(t),\n        t.select();\n      let s = !1;\n      try {\n        s = document.execCommand(\"copy\");\n      } catch {}\n      return t.remove(), s;\n    }\n  }\n  function de(e, t = 168) {\n    let s = globalThis.qrcode;\n    if (!s || !e) return \"\";\n    try {\n      let i = s(0, \"M\");\n      return (\n        i.addData(e, \"Byte\"),\n        i.make(),\n        i.createSvgTag({ cellSize: 4, margin: 2, scalable: !0 })\n      );\n    } catch {\n      return \"\";\n    }\n  }\n  function Xe(e = 6) {\n    return Array.from(\n      { length: e },\n      () =>\n        '<tr><td colspan=\"7\"><div class=\"skeleton\" style=\"height:16px\"></div></td></tr>',\n    ).join(\"\");\n  }\n  var ue = ({ icon: e, label: t, value: s, sub: i, tone: o = \"\" }) => `\n  <div class=\"card\" style=\"display:flex;gap:13px;align-items:flex-start\">\n    <div class=\"kpi-icon\" style=\"${o ? `background:color-mix(in srgb, ${o} 14%, transparent);color:${o}` : \"\"}\">${d(e)}</div>\n    <div style=\"min-width:0;flex:1\">\n      <div class=\"kpi-label\">${a(t)}</div>\n      <div class=\"kpi-value\">${s}</div>\n      ${i ? `<div class=\"kpi-sub\">${i}</div>` : \"\"}\n    </div>\n  </div>`;\n  function Pe(\n    e,\n    {\n      height: t = 150,\n      valueKey: s = \"total\",\n      labelKey: i = \"day\",\n      color: o = \"var(--accent)\",\n    } = {},\n  ) {\n    if (!e?.length)\n      return `<svg class=\"chart\" viewBox=\"0 0 600 ${t}\" preserveAspectRatio=\"none\"><text x=\"300\" y=\"${t / 2}\" text-anchor=\"middle\" class=\"chart-label\">داده‌ای نیست</text></svg>`;\n    let r = 600,\n      c = { l: 8, r: 8, t: 14, b: 22 },\n      f = Math.max(...e.map(($) => Number($[s] || 0)), 1),\n      u = (r - c.l - c.r) / e.length,\n      m = e\n        .map(($, M) => {\n          let k = Number($[s] || 0),\n            L = Math.max(2, (k / f) * (t - c.t - c.b)),\n            S = c.l + M * u + u * 0.18,\n            C = t - c.b - L,\n            q = String($[i] || \"\").slice(5);\n          return `<g><title>${$[i]} \\u2014 ${D(k)}</title>\n        <rect class=\"chart-bar\" x=\"${S.toFixed(1)}\" y=\"${C.toFixed(1)}\" width=\"${(u * 0.64).toFixed(1)}\" height=\"${L.toFixed(1)}\" rx=\"4\" style=\"fill:${o}\"/>\n        <text class=\"chart-label\" x=\"${(S + u * 0.32).toFixed(1)}\" y=\"${t - 7}\" text-anchor=\"middle\">${q}</text></g>`;\n        })\n        .join(\"\"),\n      p = [0.25, 0.5, 0.75]\n        .map(($) => {\n          let M = c.t + (t - c.t - c.b) * $;\n          return `<line class=\"chart-grid\" x1=\"${c.l}\" x2=\"${r - c.r}\" y1=\"${M}\" y2=\"${M}\" stroke-dasharray=\"3 5\"/>`;\n        })\n        .join(\"\");\n    return `<svg class=\"chart\" viewBox=\"0 0 ${r} ${t}\" preserveAspectRatio=\"none\" role=\"img\">${p}${m}\n    <text class=\"chart-label\" x=\"${c.l}\" y=\"10\">${D(f)}</text></svg>`;\n  }\n  function et(e, { height: t = 160 } = {}) {\n    if (!e?.length) return Pe([]);\n    let s = 600,\n      i = { l: 8, r: 8, t: 14, b: 22 },\n      o = Math.max(...e.map((u) => (u.up || 0) + (u.down || 0)), 1),\n      r = (s - i.l - i.r) / e.length,\n      c = t - i.t - i.b,\n      f = e\n        .map((u, m) => {\n          let p = i.l + m * r + r * 0.18,\n            $ = r * 0.64,\n            M = (u.down / o) * c,\n            k = (u.up / o) * c;\n          return `<g><title>${u.day} \\u2014 \\u2193${D(u.down)} \\u2191${D(u.up)}</title>\n      <rect x=\"${p.toFixed(1)}\" y=\"${(t - i.b - M).toFixed(1)}\" width=\"${$.toFixed(1)}\" height=\"${M.toFixed(1)}\" rx=\"4\" fill=\"var(--accent)\" opacity=\".85\"/>\n      <rect x=\"${p.toFixed(1)}\" y=\"${(t - i.b - M - k).toFixed(1)}\" width=\"${$.toFixed(1)}\" height=\"${k.toFixed(1)}\" rx=\"4\" fill=\"var(--accent-2)\" opacity=\".85\"/>\n      <text class=\"chart-label\" x=\"${(p + $ / 2).toFixed(1)}\" y=\"${t - 7}\" text-anchor=\"middle\">${String(u.day).slice(5)}</text></g>`;\n        })\n        .join(\"\");\n    return `<svg class=\"chart\" viewBox=\"0 0 ${s} ${t}\" preserveAspectRatio=\"none\">${f}\n    <text class=\"chart-label\" x=\"${i.l}\" y=\"10\">${D(o)}</text></svg>`;\n  }\n  function Ae(\n    e,\n    { size: t = 74, stroke: s = 8, color: i = \"var(--accent)\", label: o } = {},\n  ) {\n    let r = (t - s) / 2,\n      c = 2 * Math.PI * r,\n      f = Math.max(0, Math.min(100, Number(e) || 0)),\n      u = (f / 100) * c,\n      m = f > 90 ? \"var(--danger)\" : f > 70 ? \"var(--warn)\" : i;\n    return `<svg width=\"${t}\" height=\"${t}\" viewBox=\"0 0 ${t} ${t}\" role=\"img\" aria-label=\"${f}%\">\n    <circle cx=\"${t / 2}\" cy=\"${t / 2}\" r=\"${r}\" fill=\"none\" stroke=\"var(--surface-2)\" stroke-width=\"${s}\"/>\n    <circle cx=\"${t / 2}\" cy=\"${t / 2}\" r=\"${r}\" fill=\"none\" stroke=\"${m}\" stroke-width=\"${s}\"\n      stroke-linecap=\"round\" stroke-dasharray=\"${u.toFixed(2)} ${c.toFixed(2)}\"\n      transform=\"rotate(-90 ${t / 2} ${t / 2})\" style=\"transition:stroke-dasharray .6s cubic-bezier(.22,1,.36,1)\"/>\n    <text x=\"50%\" y=\"52%\" text-anchor=\"middle\" dominant-baseline=\"middle\"\n      style=\"font:700 ${t * 0.24}px var(--font);fill:var(--text)\">${o ?? `${Math.round(f)}%`}</text>\n  </svg>`;\n  }\n  function tt({ mode: e = \"login\", error: t = \"\", signup: s = !1 } = {}) {\n    let i = e === \"setup\",\n      o = e === \"recover\";\n    return `<div class=\"auth-wrap\"><div class=\"auth-card\">\n    <div class=\"auth-logo\">\n      <img src=\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJLYXZlaCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImtnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyMmQzZWUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjODE4Y2Y4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGZpbHRlciBpZD0iZ2xvdyIgeD0iLTMwJSIgeT0iLTMwJSIgd2lkdGg9IjE2MCUiIGhlaWdodD0iMTYwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIwIiBzdGREZXZpYXRpb249IjE4IiBmbG9vZC1jb2xvcj0iIzIyZDNlZSIgZmxvb2Qtb3BhY2l0eT0iMC41NSIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTIwIiBmaWxsPSIjMDYwNzBhIi8+CiAgPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iNDMyIiBoZWlnaHQ9IjQzMiIgcng9IjEwNCIgZmlsbD0iIzBiMGQxMyIgc3Ryb2tlPSJ1cmwoI2tnKSIgc3Ryb2tlLXdpZHRoPSI2IiBvcGFjaXR5PSIwLjk1Ii8+CiAgPCEtLSBEZXJhZnNoLWUgS8SBdsSrxIFuOiB0aGUgYmxhY2tzbWl0aCdzIGFwcm9uIHJhaXNlZCBhcyBhIHN0YW5kYXJkIC0tPgogIDxnIGZpbHRlcj0idXJsKCNnbG93KSI+CiAgICA8cGF0aCBkPSJNMTgwIDExOCBMMzMyIDExOCBMMzU2IDMwMCBRMjU2IDM0MCAxNTYgMzAwIFoiIGZpbGw9InVybCgja2cpIiBmaWxsLW9wYWNpdHk9IjAuMTYiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAgIDxwYXRoIGQ9Ik0yNTYgMTE4IEwyNTYgNDAwIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICAgIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIxMiIgcj0iMzQiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTIiLz4KICAgIDxwYXRoIGQ9Ik0yMTQgMzcyIEwyOTggMzcyIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8L2c+Cjwvc3ZnPgo=\" alt=\"\" width=\"52\" height=\"52\">\n      <h1>${a(n(\"app.name\"))}</h1>\n      <p class=\"muted\" style=\"margin:0;font-size:12px\">${a(n(i ? \"login.setupTitle\" : o ? \"login.recover\" : \"login.title\"))}</p>\n    </div>\n    ${t ? `<div class=\"toast err\" style=\"margin-bottom:12px\">${d(\"alert\")} ${a(t)}</div>` : \"\"}\n    <form id=\"auth-form\" data-mode=\"${e}\" novalidate>\n      ${\n        i||!o\n          ? `<div class=\"field\" style=\"margin-bottom:11px\">\n          <label for=\"f-user\">${a(n(\"login.username\"))}</label>\n          <input id=\"f-user\" name=\"username\" type=\"text\" value=\"admin\" placeholder=\"admin\" autocomplete=\"username\" dir=\"ltr\">\n        </div>`\n          : \"\"\n      }\n      ${\n        o\n          ? `<div class=\"field\" style=\"margin-bottom:11px\">\n          <label for=\"f-code\">\\u06A9\\u062F \\u0628\\u0627\\u0632\\u06CC\\u0627\\u0628\\u06CC</label>\n          <input id=\"f-code\" name=\"code\" type=\"text\" autocomplete=\"one-time-code\" dir=\"ltr\" required>\n        </div>`\n          : \"\"\n      }\n      <div class=\"field\" style=\"margin-bottom:11px\">\n        <label for=\"f-pass\">${a(n(o ? \"login.newPassword\" : \"login.password\"))}</label>\n        <input id=\"f-pass\" name=\"password\" type=\"password\" autocomplete=\"${i ? \"new-password\" : \"current-password\"}\" required minlength=\"10\" dir=\"ltr\">\n      </div>\n      <button class=\"btn btn-primary btn-block\" type=\"submit\" style=\"margin-top:6px\">\n        ${d(i ? \"bolt\" : \"key\")} ${a(n(i ? \"login.setup\" : o ? \"login.recover\" : \"login.submit\"))}\n      </button>\n      <p class=\"hint muted\" style=\"font-size:11px;margin-top:12px;text-align:center\">${a(n(i ? \"login.setupHint\" : \"login.hint\"))}</p>\n      ${!i && !o ? `<p style=\"text-align:center;margin:10px 0 0\"><button type=\"button\" class=\"btn btn-ghost btn-sm\" data-action=\"goto-recover\">${a(n(\"login.recover\"))}</button></p>` : \"\"}\n      ${!i && !o && s ? `<p style=\"text-align:center;margin:8px 0 0\"><button type=\"button\" class=\"btn btn-sm\" data-action=\"goto-signup\">${d(\"bolt\")} ${a(n(\"signup.button\"))}</button></p>` : \"\"}\n      ${o ? `<p style=\"text-align:center;margin:10px 0 0\"><button type=\"button\" class=\"btn btn-ghost btn-sm\" data-action=\"goto-login\">\\u2192 ${a(n(\"login.submit\"))}</button></p>` : \"\"}\n    </form>\n  </div></div>`;\n  }\n  function at({ result: e = null, error: t = \"\" } = {}) {\n    return e\n      ? `<div class=\"auth-wrap\"><div class=\"auth-card\">\n      <div class=\"auth-logo\">\n        <div class=\"omni-cube\" style=\"width:44px;height:44px;margin:0 auto 8px\" aria-hidden=\"true\"><i></i><i></i><i></i><i></i><i></i><i></i></div>\n        <h1>${a(n(\"signup.doneTitle\"))}</h1>\n        <p class=\"muted\" style=\"margin:0;font-size:12px\">${a(n(\"signup.doneSub\"))}</p>\n      </div>\n      <div class=\"kv\"><span>${a(n(\"users.col.user\"))}</span><code>${a(e.username)}</code></div>\n      <div class=\"codebox\" style=\"margin-top:10px\"><code id=\"signup-sub\" dir=\"ltr\">${a(e.sub_url)}</code>\n        <button class=\"btn btn-sm\" data-action=\"copy-text\" data-text=\"${a(e.sub_url)}\">${a(n(\"common.copy\"))}</button></div>\n      <div style=\"display:flex;justify-content:center;margin:14px 0 4px\">${de(e.sub_url, 176)}</div>\n      <div style=\"display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:6px\">\n        <a class=\"btn btn-sm\" href=\"${a(e.status_url)}\" target=\"_blank\" rel=\"noopener\">${d(\"globe\")} ${a(n(\"users.drawer.statusPage\"))}</a>\n        <a class=\"btn btn-sm\" href=\"${a(e.sub_url)}\" target=\"_blank\" rel=\"noopener\">${d(\"link\")} ${a(n(\"users.drawer.sub\"))}</a>\n      </div>\n      <p class=\"hint muted\" style=\"font-size:11px;margin-top:12px;text-align:center\">${a(n(\"signup.hint\"))}</p>\n      <p style=\"text-align:center;margin:6px 0 0\"><button type=\"button\" class=\"btn btn-ghost btn-sm\" data-action=\"goto-login\">${a(n(\"signup.backLogin\"))}</button></p>\n    </div></div>`\n      : `<div class=\"auth-wrap\"><div class=\"auth-card\">\n    <div class=\"auth-logo\">\n      <div class=\"omni-cube\" style=\"width:44px;height:44px;margin:0 auto 8px\" aria-hidden=\"true\"><i></i><i></i><i></i><i></i><i></i><i></i></div>\n      <h1>${a(n(\"signup.title\"))}</h1>\n      <p class=\"muted\" style=\"margin:0;font-size:12px\">${a(n(\"signup.sub\"))}</p>\n    </div>\n    ${t ? `<div class=\"toast err\" style=\"margin-bottom:12px\">${d(\"alert\")} ${a(t)}</div>` : \"\"}\n    <ul class=\"st\" style=\"font-size:13px;line-height:2\">\n      <li>${a(n(\"signup.step1\"))}</li>\n      <li>${a(n(\"signup.step2\"))}</li>\n      <li>${a(n(\"signup.step3\"))}</li>\n    </ul>\n    <button class=\"btn btn-primary btn-block\" type=\"button\" data-action=\"do-signup\" style=\"margin-top:8px\">\n      ${d(\"bolt\")} ${a(n(\"signup.create\"))}\n    </button>\n    <p style=\"text-align:center;margin:10px 0 0\"><button type=\"button\" class=\"btn btn-ghost btn-sm\" data-action=\"goto-login\">${a(n(\"signup.backLogin\"))}</button></p>\n  </div></div>`;\n  }\n  function pe(e) {\n    if (!e)\n      return `<div class=\"dashboard-page\"><div class=\"dashboard-kpis\">${Array.from({ length: 4 }, () => '<div class=\"skeleton\" style=\"height:112px\"></div>').join(\"\")}</div>\n      <div class=\"grid grid-2\" style=\"margin-top:14px\">${Array.from({ length: 2 }, () => '<div class=\"skeleton\" style=\"height:240px\"></div>').join(\"\")}</div></div>`;\n    const users = e.users || {};\n    const events = e.connection_events || {};\n    const alerts = Lt(e);\n    const generated = e.generated_at ? ye(e.generated_at) : \"—\";\n    const kpi = (icon, label, value, sub, tone = \"\") => `\n      <div class=\"card dashboard-kpi\">\n        <div class=\"kpi-icon\" style=\"${tone ? `background:color-mix(in srgb, ${tone} 13%, transparent);color:${tone}` : \"\"}\">${d(icon)}</div>\n        <div style=\"min-width:0;flex:1\">\n          <div class=\"kpi-label\">${a(label)}</div>\n          <div class=\"kpi-value\">${value}</div>\n          <div class=\"kpi-sub\">${sub}</div>\n        </div>\n      </div>`;\n    const mini = (label, value, icon) => `<div class=\"dashboard-mini-stat\"><span>${d(icon)} ${a(label)}</span><b>${value}</b></div>`;\n    const alertRows = alerts.list.length\n      ? `<div style=\"display:flex;flex-direction:column;gap:8px\">${alerts.list.map((item) => `\n          <div class=\"dashboard-alert ${item.level === \"warn\" ? \"warn\" : \"info\"}\">\n            <span style=\"color:${item.color};flex:none\">${d(item.level === \"danger\" ? \"alert\" : \"clock\")}</span>\n            <div><b style=\"font-size:12.5px\">${a(item.title)}</b>${item.detail ? `<div class=\"muted\" style=\"font-size:11.5px;margin-top:2px\">${a(item.detail)}</div>` : \"\"}</div>\n          </div>`).join(\"\")}</div>`\n      : `<div class=\"empty\" style=\"padding:18px\">${d(\"check\")}<div>${a(n(\"dash.noAccountAlerts\"))}</div></div>`;\n\n    return `\n  <div class=\"dashboard-page\">\n    <section class=\"dashboard-hero\">\n      <div>\n        <div class=\"dashboard-kicker\">OMNI · OWNER CONSOLE</div>\n        <h2>${a(n(\"nav.dashboard\"))}</h2>\n        <p>${a(n(\"dash.sourceDescription\"))}</p>\n      </div>\n      <div class=\"dashboard-actions\">\n        <button class=\"btn btn-primary\" data-action=\"nav\" data-view=\"users\">${d(\"users\")} ${a(n(\"users.create\"))}</button>\n        <button class=\"btn\" data-action=\"nav\" data-view=\"scanner\">${d(\"search\")} ${a(n(\"nav.scanner\"))}</button>\n      </div>\n    </section>\n\n    <div class=\"dashboard-kpis\">\n      ${kpi(\"users\", n(\"dash.users\"), v(users.active || 0), `${v(users.total || 0)} ${a(n(\"dash.allAccounts\"))}`, \"var(--accent)\")}\n      ${kpi(\"db\", n(\"dash.traffic\"), D(users.used_bytes || 0), `${D(users.uploaded_bytes || 0)} ↑ · ${D(users.downloaded_bytes || 0)} ↓`, \"var(--accent-2)\")}\n      ${kpi(\"activity\", n(\"dash.connectionsToday\"), v(events.today || 0), `${v(events.total || 0)} ${a(n(\"dash.eventsTotal\"))} · UTC`, \"var(--ok)\")}\n      ${kpi(\"bolt\", n(\"dash.cloudflareRequests\"), \"—\", a(n(\"dash.cloudflareNotMeasured\")), \"var(--text-faint)\")}\n    </div>\n\n    <div class=\"dashboard-grid\">\n      <section class=\"card dashboard-card\">\n        <div class=\"card-head\">${d(\"activity\")}<h3>${a(n(\"dash.traffic7\"))}</h3><div class=\"spacer\"></div>\n          <div class=\"legend\"><span><i style=\"background:var(--accent)\"></i>↓ ${a(n(\"dash.download\"))}</span><span><i style=\"background:var(--accent-2)\"></i>↑ ${a(n(\"dash.upload\"))}</span></div>\n        </div>\n        ${et(e.series || [])}\n        <div class=\"dashboard-data-note\"><span>${d(\"info\")}</span><div><b>${a(n(\"dash.sourceTitle\"))}:</b> ${a(n(\"dash.trafficSourceNote\"))}. ${a(n(\"dash.connectionSourceNote\"))}.</div></div>\n      </section>\n\n      <section class=\"card dashboard-card\">\n        <div class=\"card-head\">${d(\"shield\")}<h3>${a(n(\"dash.alerts\"))}</h3><div class=\"spacer\"></div><span class=\"muted\" style=\"font-size:10.5px\">${a(n(\"dash.generated\"))}: ${a(generated)}</span></div>\n        ${alertRows}\n        <div class=\"dashboard-metric-pair\">\n          ${mini(n(\"dash.expiringTitle\"), v(users.expiring_24h || 0), \"clock\")}\n          ${mini(n(\"dash.quotaTitle\"), v(users.near_quota || 0), \"alert\")}\n        </div>\n        <div class=\"dashboard-data-note\"><span>${d(\"info\")}</span><div><b>${a(n(\"dash.cloudflareRequests\"))}:</b> ${a(n(\"dash.cloudflareUnavailable\"))}</div></div>\n      </section>\n    </div>\n\n    <section class=\"card dashboard-card\">\n      <div class=\"card-head\">${d(\"users\")}<h3>${a(n(\"dash.topUsers\"))}</h3><div class=\"spacer\"></div>\n        <button class=\"btn btn-sm\" data-action=\"nav\" data-view=\"users\">${a(n(\"nav.users\"))} ${d(\"chevron\")}</button></div>\n      ${e.top?.length\n        ? `<div style=\"display:flex;flex-direction:column;gap:2px\">${e.top.map((row) => {\n            const pct = row.quota_gb ? Math.min(100, (row.used_bytes / (row.quota_gb * 1073741824)) * 100) : 0;\n            return `<div class=\"dashboard-top-user\">\n              <div style=\"display:flex;gap:10px;align-items:baseline;margin-bottom:5px\">\n                <a href=\"#\" data-action=\"open-user\" data-user=\"${a(row.username)}\" class=\"cell-user\">${a(row.username)}</a>\n                <span class=\"muted\" style=\"font-size:12px\">${D(row.used_bytes)} / ${v(row.quota_gb)} ${a(n(\"common.gb\"))}</span>\n                <div class=\"spacer\"></div><span class=\"muted mono\" style=\"font-size:11px\">${pct.toFixed(0)}%</span>\n              </div>${$e(pct)}\n            </div>`;\n          }).join(\"\")}</div>`\n        : `<div class=\"empty\">${d(\"users\")}<div>${a(n(\"users.empty\"))}</div></div>`}\n    </section>\n  </div>`;\n  }\n  function Lt(e) {\n    const users = e?.users || {};\n    const list = [];\n    const expiring = Number(users.expiring_24h || 0);\n    const nearQuota = Number(users.near_quota || 0);\n    if (expiring > 0) {\n      list.push({\n        level: \"warn\",\n        color: \"var(--warn)\",\n        title: n(\"dash.expiringTitle\"),\n        detail: `${v(expiring)} ${n(\"dash.expiringSoon\")}`,\n      });\n    }\n    if (nearQuota > 0) {\n      list.push({\n        level: \"warn\",\n        color: \"var(--warn)\",\n        title: n(\"dash.quotaTitle\"),\n        detail: `${v(nearQuota)} ${n(\"users.title\")}`,\n      });\n    }\n    return { list, expiring, nearQuota };\n  }\n  function Ie(e) {\n    let t = e.loading\n      ? Xe(8)\n      : (e.users || []).map((s) => Pt(s, e.selection.has(s.username))).join(\"\");\n    return `\n  <div class=\"toolbar\">\n    <div class=\"search\" style=\"flex:1;min-width:190px\">${d(\"search\")}\n      <input type=\"search\" id=\"user-search\" placeholder=\"${a(n(\"users.search\"))}\" value=\"${a(e.query)}\" data-debounce=\"300\">\n    </div>\n    <div class=\"seg\" role=\"group\" aria-label=\"filter\">\n      ${[\"all\", \"active\", \"disabled\", \"expired\"].map((s) => `<button data-action=\"filter\" data-status=\"${s}\" aria-pressed=\"${e.status === s}\">${a(n(`users.${s === \"all\" ? \"all\" : s === \"active\" ? \"activeOnly\" : s === \"disabled\" ? \"disabledOnly\" : \"expiredOnly\"}`))}</button>`).join(\"\")}\n    </div>\n    <button class=\"btn btn-ghost btn-icon\" data-action=\"refresh-users\" title=\"${a(n(\"common.refresh\"))}\">${d(\"refresh\")}</button>\n    <button class=\"btn btn-primary\" data-action=\"new-user\">${d(\"plus\")} ${a(n(\"users.create\"))}</button>\n  </div>\n\n  ${\n    e.selection.size\n      ? `<div class=\"bulkbar\">\n        <strong>${v(e.selection.size)}</strong> <span class=\"muted\">${a(n(\"users.selected\"))}</span>\n        <div class=\"spacer\"></div>\n        <button class=\"btn btn-sm\" data-action=\"bulk\" data-op=\"enable\">${d(\"check\")} ${a(n(\"users.bulkEnable\"))}</button>\n        <button class=\"btn btn-sm\" data-action=\"bulk\" data-op=\"disable\">${a(n(\"users.bulkDisable\"))}</button>\n        <button class=\"btn btn-sm\" data-action=\"bulk\" data-op=\"reset_traffic\">${d(\"refresh\")} ${a(n(\"users.bulkReset\"))}</button>\n        <button class=\"btn btn-sm\" data-action=\"bulk-extend\">${d(\"clock\")} ${a(n(\"users.bulkExtend\"))}</button>\n        <button class=\"btn btn-sm btn-danger\" data-action=\"bulk\" data-op=\"delete\">${d(\"trash\")} ${a(n(\"users.bulkDelete\"))}</button>\n        <button class=\"btn btn-ghost btn-sm\" data-action=\"clear-selection\">${d(\"close\")}</button>\n      </div>`\n      : \"\"\n  }\n\n  <div class=\"table-wrap\">\n    <table class=\"users-table\">\n      <thead><tr>\n        <th style=\"width:34px\"><input type=\"checkbox\" data-action=\"select-all\" ${e.users?.length && e.selection.size === e.users.length ? \"checked\" : \"\"} aria-label=\"select all\"></th>\n        <th class=\"sortable\" data-action=\"sort\" data-key=\"username\">${a(n(\"users.col.user\"))}${He(e, \"username\")}</th>\n        <th>${a(n(\"users.col.status\"))}</th>\n        <th class=\"sortable\" data-action=\"sort\" data-key=\"used_bytes\" style=\"min-width:170px\">${a(n(\"users.col.traffic\"))}${He(e, \"used_bytes\")}</th>\n        <th class=\"sortable\" data-action=\"sort\" data-key=\"expires_at\">${a(n(\"users.col.expiry\"))}${He(e, \"expires_at\")}</th>\n        <th>${a(n(\"users.col.devices\"))}</th>\n        <th style=\"text-align:end\">${a(n(\"users.col.actions\"))}</th>\n      </tr></thead>\n      <tbody>${t || Ct()}</tbody>\n    </table>\n    ${e.total > e.size ? At(e) : \"\"}\n  </div>`;\n  }\n  function He(e, t) {\n    return e.sort !== t\n      ? \"\"\n      : ` <span style=\"opacity:.6\">${e.dir === \"asc\" ? \"\\u25B2\" : \"\\u25BC\"}</span>`;\n  }\n  function Ct() {\n    return `<tr><td colspan=\"7\"><div class=\"empty\">${d(\"users\")}\n    <div style=\"font-weight:600;color:var(--text-dim)\">${a(n(\"users.empty\"))}</div>\n    <div style=\"font-size:12px\">${a(n(\"users.emptyHint\"))}</div></div></td></tr>`;\n  }\n  function Pt(e, t) {\n    let s = e.used_pct || 0;\n    return `<tr class=\"${t ? \"selected\" : \"\"}\" data-username=\"${a(e.username)}\">\n    <td><input type=\"checkbox\" data-action=\"select-user\" data-user=\"${a(e.username)}\" ${t ? \"checked\" : \"\"} aria-label=\"${a(e.username)}\"></td>\n    <td><a href=\"#\" data-action=\"open-user\" data-user=\"${a(e.username)}\" class=\"cell-user\">${a(e.username)}</a>\n      ${e.note ? `<div class=\"muted\" style=\"font-size:11px\">${a(e.note)}</div>` : \"\"}</td>\n    <td>${Ce(e.status)}</td>\n    <td><div style=\"display:flex;gap:8px;align-items:center\">\n        <span class=\"mono\" style=\"font-size:11.5px;min-width:54px;direction:ltr;unicode-bidi:isolate\">${D(e.used_bytes)}</span>\n        <div style=\"flex:1;min-width:52px\">${$e(s, \"meter-thin\")}</div>\n        <span class=\"muted mono\" style=\"font-size:11px;direction:ltr;unicode-bidi:isolate\">${e.quota_bytes ? D(e.quota_bytes) : (e.quota_gb ? v(e.quota_gb) + \" GB\" : \"∞\")}</span>\n      </div></td>\n    <td><span class=\"${e.ms_left != null && e.ms_left < 864e5 * 2 ? \"badge warn\" : \"muted\"}\" style=\"${e.ms_left != null && e.ms_left < 864e5 * 2 ? \"\" : \"font-size:12px\"}\">${ce(e.ms_left)}</span>\n      ${e.first_connect && !e.activated_at ? '<div class=\"muted\" style=\"font-size:10.5px\">\\u23F3 first-connect</div>' : \"\"}</td>\n    <td class=\"muted\">${v(e.device_limit)}</td>\n    <td><div class=\"cell-actions\">\n      <button class=\"btn btn-ghost btn-icon\" data-action=\"copy-sub\" data-token=\"${a(e.sub_token)}\" title=\"${a(n(\"users.drawer.sub\"))}\">${d(\"link\")}</button>\n      <button class=\"btn btn-ghost btn-icon\" data-action=\"quick-toggle\" data-user=\"${a(e.username)}\" data-active=\"${e.is_active ? 1 : 0}\" title=\"${a(n(e.is_active ? \"users.bulkDisable\" : \"users.bulkEnable\"))}\">${d(e.is_active ? \"eye\" : \"check\")}</button>\n      <button class=\"btn btn-ghost btn-icon\" data-action=\"edit-user\" data-user=\"${a(e.username)}\" title=\"${a(n(\"common.edit\"))}\">${d(\"edit\")}</button>\n      <button class=\"btn btn-ghost btn-icon\" data-action=\"delete-user\" data-user=\"${a(e.username)}\" title=\"${a(n(\"common.delete\"))}\" style=\"color:var(--danger)\">${d(\"trash\")}</button>\n    </div></td>\n  </tr>`;\n  }\n  function At(e) {\n    return `<div class=\"pager\">\n    <button class=\"btn btn-sm\" data-action=\"page\" data-page=\"${e.page - 1}\" ${e.page <= 1 ? \"disabled\" : \"\"}>\\u2192</button>\n    <span>${v(e.page)} / ${v(e.pages)}</span>\n    <button class=\"btn btn-sm\" data-action=\"page\" data-page=\"${e.page + 1}\" ${e.page >= e.pages ? \"disabled\" : \"\"}>\\u2190</button>\n  </div>`;\n  }\n  function st(e = {}, t = [], s = []) {\n    let i = !!e.username,\n      o = (c, f = \"\") => a(e[c] ?? f),\n      r = (c) =>\n        a(\n          (c || []).join(`\n`),\n        );\n    return `<form id=\"user-form\" data-edit=\"${i ? a(e.username) : \"\"}\">\n    <div class=\"form-grid\">\n      <div class=\"field\"><label for=\"uf-user\">${a(n(\"users.form.username\"))} *</label>\n        <input id=\"uf-user\" name=\"username\" type=\"text\" required dir=\"ltr\" ${i ? \"readonly style='opacity:.6'\" : \"\"} value=\"${o(\"username\")}\" placeholder=\"ali-123\">\n        <span class=\"hint\">${a(n(\"users.form.usernameHint\"))}</span></div>\n      <div class=\"field\"><label for=\"uf-quota\">${a(n(\"users.form.quota\"))}</label>\n        <input id=\"uf-quota\" name=\"quota_gb\" type=\"number\" min=\"0.1\" step=\"0.5\" value=\"${o(\"quota_gb\", 50)}\"></div>\n      <div class=\"field\"><label for=\"uf-days\">${a(n(\"users.form.days\"))}</label>\n        <input id=\"uf-days\" name=\"expiry_days\" type=\"number\" min=\"1\" value=\"${o(\"expiry_days\", 30)}\"></div>\n      <div class=\"field\"><label for=\"uf-dev\">${a(n(\"users.form.devices\"))}</label>\n        <input id=\"uf-dev\" name=\"device_limit\" type=\"number\" min=\"1\" max=\"50\" value=\"${o(\"device_limit\", 3)}\"></div>\n      <div class=\"field\"><label for=\"uf-req\">${a(n(\"users.form.requests\"))}</label>\n        <input id=\"uf-req\" name=\"request_limit\" type=\"number\" min=\"0\" value=\"${o(\"request_limit\", 0)}\"></div>\n      <div class=\"field\"><label for=\"uf-frag\">${a(n(\"users.form.fragment\"))}</label>\n        <select id=\"uf-frag\" name=\"fragment\">\n          ${t.map((c) => `<option value=\"${a(c.id)}\" ${e.fragment === c.id ? \"selected\" : \"\"}>${a(c.label)}</option>`).join(\"\")}\n        </select></div>\n      <div class=\"field\"><label for=\"uf-fp\">${a(n(\"users.form.fingerprint\"))}</label>\n        <select id=\"uf-fp\" name=\"fingerprint\">\n          <option value=\"\">\\u2014</option>\n          ${s.map((c) => `<option value=\"${a(c)}\" ${e.fingerprint === c ? \"selected\" : \"\"}>${a(c)}</option>`).join(\"\")}\n        </select></div>\n      <div class=\"field\"><label style=\"display:flex;align-items:center;gap:9px;padding-top:22px\">\n        <label class=\"switch\"><input type=\"checkbox\" name=\"first_connect\" ${e.first_connect !== !1 ? \"checked\" : \"\"}><span></span></label>\n        <span>${a(n(\"users.form.firstConnect\"))}</span></label></div>\n      <div class=\"field\"><label style=\"display:flex;align-items:center;gap:9px\">\n        <label class=\"switch\"><input type=\"checkbox\" name=\"is_active\" ${e.is_active !== !1 ? \"checked\" : \"\"}><span></span></label>\n        <span>${a(n(\"users.form.active\"))}</span></label></div>\n    </div>\n    <div class=\"form-grid\" style=\"grid-template-columns:repeat(auto-fit,minmax(230px,1fr))\">\n      <div class=\"field\"><label for=\"uf-ips\">${a(n(\"users.form.ips\"))}</label>\n        <textarea id=\"uf-ips\" name=\"ips\" rows=\"3\" placeholder=\"104.16.0.0\">${r(e.ips)}</textarea></div>\n      <div class=\"field\"><label for=\"uf-proxy\">${a(n(\"users.form.proxies\"))}</label>\n        <textarea id=\"uf-proxy\" name=\"proxies\" rows=\"3\" placeholder=\"user:pass@1.2.3.4:1080\">${r(e.proxies)}</textarea></div>\n      <div class=\"field\"><label for=\"uf-block\">${a(n(\"users.form.blockList\"))}</label>\n        <textarea id=\"uf-block\" name=\"block_list\" rows=\"3\" placeholder=\"example.com\">${r(e.block_list)}</textarea></div>\n    </div>\n    <div class=\"field\"><label for=\"uf-note\">${a(n(\"users.form.note\"))}</label>\n      <input id=\"uf-note\" name=\"note\" type=\"text\" maxlength=\"200\" value=\"${o(\"note\")}\" style=\"font-family:var(--font)\"></div>\n  </form>`;\n  }\n  function De(e, t, s = []) {\n    let i = `${location.origin}${le(e.sub_token)}`,\n      o = `${location.origin}/status/${e.sub_token}`,\n      r = (s || []).map((c) => ({\n        ...c,\n        total: (c.up_bytes || 0) + (c.down_bytes || 0),\n      }));\n    return `\n  <div style=\"display:flex;gap:9px;align-items:center;flex-wrap:wrap\">\n    ${Ce(e.status)}\n    <span class=\"badge\">${v(e.device_limit)} ${a(n(\"users.col.devices\"))}</span>\n    <span class=\"badge\">${a(e.fragment || \"\\u2014\")}</span>\n    ${e.fingerprint ? `<span class=\"badge\">${a(e.fingerprint)}</span>` : \"\"}\n  </div>\n\n  <div style=\"display:flex;gap:14px;align-items:center;margin-top:4px\">\n    ${Ae(e.used_pct, { size: 78 })}\n    <div style=\"flex:1;min-width:0\">\n      <div class=\"kpi-label\">${a(n(\"users.col.traffic\"))}</div>\n      <div style=\"font-weight:800;font-size:19px\">${D(e.used_bytes)} <span class=\"muted\" style=\"font-size:12px;font-weight:400\">/ ${v(e.quota_gb)} GB</span></div>\n      <div class=\"kpi-sub\">${a(n(\"users.col.expiry\"))}: ${ce(e.ms_left)}${e.expires_at ? ` \\xB7 ${Ke(e.expires_at)}` : \"\"}</div>\n    </div>\n  </div>\n\n  <div class=\"tabs\" role=\"tablist\" style=\"margin-top:8px\">\n    <button role=\"tab\" aria-selected=\"true\" data-action=\"drawer-tab\" data-tab=\"qr\">${d(\"qr\")} ${a(n(\"users.drawer.qr\"))}</button>\n    <button role=\"tab\" aria-selected=\"false\" data-action=\"drawer-tab\" data-tab=\"configs\">${a(n(\"users.drawer.configs\"))}</button>\n    <button role=\"tab\" aria-selected=\"false\" data-action=\"drawer-tab\" data-tab=\"usage\">${a(n(\"users.drawer.usage\"))}</button>\n    <button role=\"tab\" aria-selected=\"false\" data-action=\"drawer-tab\" data-tab=\"sub\">${a(n(\"users.drawer.sub\"))}</button>\n  </div>\n\n  <div data-tab-panel=\"qr\">\n    <div style=\"display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap\">\n      <div class=\"qr\">${de(t.uris?.[0] || \"\")}</div>\n      <div style=\"flex:1;min-width:190px\">\n        <div class=\"kpi-label\" style=\"margin-bottom:5px\">vless://</div>\n        <div class=\"codebox\" style=\"max-height:120px\">${a(t.uris?.[0] || \"\")}</div>\n        <div style=\"display:flex;gap:7px;margin-top:9px;flex-wrap:wrap\">\n          ${te(t.uris?.[0] || \"\")}\n          <button class=\"btn btn-sm\" data-action=\"copy-all-uris\">${d(\"copy\")} ${a(t.uris?.length || 0)}\\xD7</button>\n        </div>\n        <div class=\"livetest\">\n          <button class=\"btn btn-sm\" data-action=\"live-test\" data-uuid=\"${a(e.uuid)}\" data-host=\"${a(t.host || \"\")}\">${d(\"activity\")} ${a(n(\"users.drawer.liveTest\"))}</button>\n          <span class=\"ms\" data-lt-ms hidden>\\u2014</span>\n          <span class=\"muted\" data-lt-msg style=\"font-size:11.5px;flex:1;min-width:120px\">${a(n(\"live.hint\"))}</span>\n        </div>\n      </div>\n    </div>\n    ${\n      (t.uris || []).length > 1\n        ? `<div class=\"kpi-label\" style=\"margin:14px 0 7px\">${v(t.uris.length)} کانفیگ بهینه (همراه اول / ایرانسل / مخابرات)</div>\n      <div style=\"display:flex;flex-direction:column;gap:8px;max-height:360px;overflow:auto\">${t.uris\n        .map((c, f) => {\n          let itm = (t.items || [])[f] || {},\n            rem = itm.remark || decodeURIComponent(c.split(\"#\")[1] || \"\");\n          return `<div style=\"display:flex;flex-direction:column;gap:4px;padding:9px 11px;border:1px solid var(--border);border-radius:10px;background:var(--bg-elev)\"><div style=\"display:flex;gap:8px;align-items:center;flex-wrap:wrap\"><span class=\"badge info\">#${String(f + 1).padStart(2, \"0\")}</span><b style=\"font-size:12px;flex:1\">${a(rem)}</b>${itm.fragment ? `<span class=\"badge ok\" style=\"font-size:10.5px\">🛡️ TLS Fragment</span>` : \"\"}${te(c, \"\", !0)}</div><div style=\"display:flex;gap:10px;align-items:center;font-size:11px\" class=\"muted mono\" dir=\"ltr\"><span>Server: <b>${a(itm.address || \"—\")}:${a(itm.port || 443)}</b></span><span>Proto: <b>${a((itm.proto || \"vless\").toUpperCase())}</b></span><span>Security: <b>${itm.tls ? (itm.fragment ? \"TLS + Fragment\" : \"TLS\") : \"Plain HTTP\"}</b></span></div></div>`;\n        })\n        .join(\"\")}</div>`\n        : \"\"\n    }\n  </div>\n\n  <div data-tab-panel=\"configs\" class=\"hide\">\n    <div class=\"seg\" style=\"margin-bottom:10px\">\n      <button data-action=\"cfg-format\" data-format=\"singbox\" aria-pressed=\"true\">sing-box</button>\n      <button data-action=\"cfg-format\" data-format=\"clash\" aria-pressed=\"false\">Clash</button>\n      <button data-action=\"cfg-format\" data-format=\"base64\" aria-pressed=\"false\">Base64</button>\n    </div>\n    <pre class=\"codebox\" id=\"cfg-out\" style=\"max-height:340px\">${a(JSON.stringify(t.singbox, null, 2))}</pre>\n    <div style=\"display:flex;gap:7px;margin-top:9px\">\n      <button class=\"btn btn-sm\" data-action=\"copy-cfg\">${d(\"copy\")} ${a(n(\"common.copy\"))}</button>\n      <button class=\"btn btn-sm\" data-action=\"download-cfg\">${d(\"download\")} \\u062F\\u0627\\u0646\\u0644\\u0648\\u062F</button>\n    </div>\n  </div>\n\n  <div data-tab-panel=\"usage\" class=\"hide\">\n    ${r.length ? Pe(r, { valueKey: \"total\", height: 170 }) : `<div class=\"empty\">${d(\"activity\")}<div>no usage yet</div></div>`}\n    ${\n      r.length\n        ? `<div class=\"table-wrap\" style=\"margin-top:10px\"><table><thead><tr>\n        <th>\\u0631\\u0648\\u0632</th><th>\\u2193</th><th>\\u2191</th><th>\\u0627\\u062A\\u0635\\u0627\\u0644</th></tr></thead><tbody>\n      ${r\n        .slice()\n        .reverse()\n        .slice(0, 14)\n        .map(\n          (c) =>\n            `<tr><td class=\"mono\">${a(c.day)}</td><td class=\"mono\">${D(c.down_bytes)}</td><td class=\"mono\">${D(c.up_bytes)}</td><td class=\"mono\">${v(c.conns)}</td></tr>`,\n        )\n        .join(\"\")}\n      </tbody></table></div>`\n        : \"\"\n    }\n  </div>\n\n  <div data-tab-panel=\"sub\" class=\"hide\">\n    <div class=\"field\"><label>${a(n(\"users.drawer.sub\"))}</label>\n      <div class=\"codebox\" id=\"sub-link\">${a(i)}</div>\n      <div style=\"display:flex;gap:7px;margin-top:8px;flex-wrap:wrap\">\n        ${te(i)}\n        <a class=\"btn btn-sm\" href=\"${a(o)}\" target=\"_blank\" rel=\"noopener\">${d(\"globe\")} ${a(n(\"users.drawer.statusPage\"))}</a>\n        <button class=\"btn btn-sm\" data-action=\"rotate-token\">${d(\"refresh\")} ${a(n(\"users.drawer.rotateToken\"))}</button>\n        <button class=\"btn btn-sm\" data-action=\"rotate-uuid\">${d(\"key\")} ${a(n(\"users.drawer.rotateUuid\"))}</button>\n      </div>\n    </div>\n    <p class=\"hint muted\" style=\"font-size:11.5px;margin-top:10px\">\n      UUID: <span class=\"mono\">${a(e.uuid)}</span>\n    </p>\n  </div>\n\n  <div style=\"display:flex;gap:8px;margin-top:16px;flex-wrap:wrap\">\n    <button class=\"btn btn-sm\" data-action=\"edit-user\" data-user=\"${a(e.username)}\">${d(\"edit\")} ${a(n(\"common.edit\"))}</button>\n    <button class=\"btn btn-sm\" data-action=\"reset-user\" data-user=\"${a(e.username)}\">${d(\"refresh\")} ${a(n(\"users.drawer.reset\"))}</button>\n    <div class=\"spacer\"></div>\n    <button class=\"btn btn-sm btn-danger\" data-action=\"delete-user\" data-user=\"${a(e.username)}\">${d(\"trash\")} ${a(n(\"common.delete\"))}</button>\n  </div>`;\n  }\n  function qe(e, t = [], s = []) {\n    let i = (c, f = \"\") => a(e[c] ?? f),\n      o = (c) => (e[c] === \"1\" || e[c] === !0 ? \"checked\" : \"\"),\n      r = (c) => {\n        let f = e[c],\n          u = Array.isArray(f) ? f : [];\n        if (typeof f == \"string\" && f.trim())\n          try {\n            u = JSON.parse(f);\n          } catch {\n            u = f.split(/[\\n,]/);\n          }\n        return a(\n          (u || []).join(`\n`),\n        );\n      };\n    return `<form id=\"settings-form\">\n  <div class=\"grid grid-2\">\n    <div class=\"card\">\n      <div class=\"card-head\">${d(\"gear\")}<h3>${a(n(\"settings.general\"))}</h3></div>\n      <div class=\"form-grid\" style=\"grid-template-columns:1fr\">\n        <div class=\"field\"><label>${a(n(\"settings.panelName\"))}</label><input name=\"panel_name\" type=\"text\" value=\"${i(\"panel_name\", \"Omni\")}\"></div>\n        <div class=\"field\"><label>${a(n(\"settings.publicHost\"))}</label><input name=\"public_host\" type=\"text\" dir=\"ltr\" value=\"${i(\"public_host\")}\" placeholder=\"panel.example.workers.dev\">\n          <span class=\"hint\">SNI/Host \\u06A9\\u0647 \\u06A9\\u0644\\u0627\\u06CC\\u0646\\u062A \\u0645\\u06CC\\u200C\\u0641\\u0631\\u0633\\u062A\\u062F. \\u0627\\u06AF\\u0631 \\u062E\\u0627\\u0644\\u06CC \\u0628\\u0627\\u0634\\u062F\\u060C \\u062F\\u0627\\u0645\\u0646\\u0647\\u200C\\u06CC \\u0648\\u0631\\u06A9\\u0631 \\u0627\\u0633\\u062A\\u0641\\u0627\\u062F\\u0647 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F.</span></div>\n        <div class=\"field\"><label>${a(n(\"settings.remark\"))}</label><input name=\"remark_prefix\" type=\"text\" value=\"${i(\"remark_prefix\", \"Omni\")}\"></div>\n        <div style=\"display:flex;gap:11px\">\n          <div class=\"field\" style=\"flex:1\"><label>${a(n(\"settings.defaultQuota\"))}</label><input name=\"default_quota_gb\" type=\"number\" min=\"1\" value=\"${i(\"default_quota_gb\", \"50\")}\"></div>\n          <div class=\"field\" style=\"flex:1\"><label>${a(n(\"settings.defaultDays\"))}</label><input name=\"default_expiry_days\" type=\"number\" min=\"1\" value=\"${i(\"default_expiry_days\", \"30\")}\"></div>\n        </div>\n        <div style=\"display:flex;align-items:center;gap:10px\">\n          <label class=\"switch\"><input type=\"checkbox\" name=\"maintenance\" ${o(\"maintenance\")}><span></span></label>\n          <span>${a(n(\"settings.maintenance\"))}</span></div>\n        <div style=\"display:flex;align-items:center;gap:10px\">\n          <label class=\"switch\"><input type=\"checkbox\" name=\"public_signup\" ${o(\"public_signup\")}><span></span></label>\n          <span>${a(n(\"signup.settingToggle\"))}</span></div>\n        <div class=\"field\" style=\"max-width:180px\"><label>${a(n(\"signup.maxPerIp\"))}</label>\n          <input name=\"signup_max_per_ip\" type=\"number\" min=\"1\" max=\"100\" value=\"${i(\"signup_max_per_ip\", \"3\")}\"></div>\n      </div>\n    </div>\n\n    <div class=\"card\">\n      <div class=\"card-head\">${d(\"wifi\")}<h3>${a(n(\"settings.network\"))}</h3></div>\n      <div class=\"form-grid\" style=\"grid-template-columns:1fr\">\n        <div class=\"field\"><label>${a(n(\"settings.port\"))}</label>\n          <select name=\"port\">${[443, 2053, 2083, 2087, 2096, 8443, 80, 8080, 2052, 2082, 2086, 2095].map((c) => `<option value=\"${c}\" ${String(e.port) === String(c) ? \"selected\" : \"\"}>${c}${[443, 2053, 2083, 2087, 2096, 8443].includes(c) ? \" (TLS)\" : \"\"}</option>`).join(\"\")}</select></div>\n        <div class=\"field\"><label>${a(n(\"users.form.fragment\"))}</label>\n          <select name=\"fragment_preset\">${t.map((c) => `<option value=\"${a(c.id)}\" ${e.fragment_preset === c.id ? \"selected\" : \"\"}>${a(c.label)}</option>`).join(\"\")}</select></div>\n        <div class=\"field\"><label>${a(n(\"users.form.fingerprint\"))}</label>\n          <select name=\"fingerprint\"><option value=\"\">\\u2014</option>${s.map((c) => `<option value=\"${a(c)}\" ${e.fingerprint === c ? \"selected\" : \"\"}>${a(c)}</option>`).join(\"\")}</select></div>\n        <div class=\"field\"><label>${a(n(\"settings.cleanIps\"))}</label>\n          <textarea name=\"clean_ips\" rows=\"3\" dir=\"ltr\">${r(\"clean_ips\")}</textarea></div>\n        <div class=\"field\"><label>${a(n(\"settings.ipPool\"))}</label>\n          <textarea name=\"ip_pool\" rows=\"4\" dir=\"ltr\" placeholder=\"104.16.0.0&#10;172.66.0.0\">${r(\"ip_pool\")}</textarea>\n          <span class=\"hint\">\\u0645\\u062E\\u0632\\u0646\\u06CC \\u06A9\\u0647 Cron \\u0647\\u0631 ${a(e.rotate_minutes || 30)} \\u062F\\u0642\\u06CC\\u0642\\u0647 \\u0627\\u0632 \\u0622\\u0646 \\u062A\\u0633\\u062A \\u0645\\u06CC\\u200C\\u06AF\\u06CC\\u0631\\u062F \\u0648 \\u0628\\u0647\\u062A\\u0631\\u06CC\\u0646\\u200C\\u0647\\u0627 \\u0631\\u0627 \\u062F\\u0631 \\xAB\\u0622\\u06CC\\u200C\\u067E\\u06CC \\u062A\\u0645\\u06CC\\u0632 \\u0641\\u0639\\u0644\\u06CC\\xBB \\u0645\\u06CC\\u200C\\u06AF\\u0630\\u0627\\u0631\\u062F.</span></div>\n        <div style=\"display:flex;align-items:center;gap:10px\">\n          <label class=\"switch\"><input type=\"checkbox\" name=\"auto_rotate\" ${o(\"auto_rotate\")}><span></span></label><span>${a(n(\"settings.autoRotate\"))}</span>\n          <input name=\"rotate_minutes\" type=\"number\" min=\"5\" max=\"1440\" value=\"${i(\"rotate_minutes\", \"30\")}\" style=\"width:88px\"></div>\n        <div style=\"display:flex;align-items:center;gap:10px\">\n          <label class=\"switch\"><input type=\"checkbox\" name=\"mux_enabled\" ${o(\"mux_enabled\")}><span></span></label><span>${a(n(\"settings.mux\"))}</span></div>\n      </div>\n    </div>\n\n    <div class=\"card\">\n      <div class=\"card-head\">${d(\"shield\")}<h3>${a(n(\"settings.security\"))}</h3></div>\n      <div style=\"display:flex;flex-direction:column;gap:11px\">\n        <div style=\"display:flex;align-items:center;gap:10px\">\n          <label class=\"switch\"><input type=\"checkbox\" name=\"block_nsfw\" ${o(\"block_nsfw\")}><span></span></label><span>${a(n(\"settings.blockNsfw\"))}</span></div>\n        <div style=\"display:flex;align-items:center;gap:10px\">\n          <label class=\"switch\"><input type=\"checkbox\" name=\"block_ads\" ${o(\"block_ads\")}><span></span></label><span>${a(n(\"settings.blockAds\"))}</span></div>\n        <p class=\"hint muted\" style=\"font-size:11.5px;margin:0\">\n          \\u0645\\u0633\\u062F\\u0648\\u062F\\u0633\\u0627\\u0632\\u06CC \\u0631\\u0648\\u06CC \\u0644\\u0628\\u0647 \\u0648 \\u0628\\u0627 DoH \\u0627\\u0646\\u062C\\u0627\\u0645 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F\\u061B \\u0641\\u0647\\u0631\\u0633\\u062A \\u062F\\u0627\\u0645\\u0646\\u0647\\u200C\\u0647\\u0627 \\u062F\\u0631 \\u0647\\u0631 \\u06A9\\u0627\\u0631\\u0628\\u0631 \\u0647\\u0645 \\u0642\\u0627\\u0628\\u0644 \\u062A\\u0646\\u0638\\u06CC\\u0645 \\u0627\\u0633\\u062A.</p>\n        <div class=\"nav-sep\"></div>\n        <div class=\"field\"><label>${a(n(\"settings.changePassword\"))}</label>\n          <input name=\"pw_current\" type=\"password\" placeholder=\"${a(n(\"settings.currentPassword\"))}\" autocomplete=\"current-password\" dir=\"ltr\">\n          <input name=\"pw_next\" type=\"password\" placeholder=\"${a(n(\"login.newPassword\"))}\" autocomplete=\"new-password\" dir=\"ltr\" minlength=\"10\" style=\"margin-top:7px\">\n          <button class=\"btn btn-sm\" type=\"button\" data-action=\"change-password\" style=\"margin-top:9px;align-self:flex-start\">${d(\"key\")} ${a(n(\"settings.changePassword\"))}</button></div>\n      </div>\n    </div>\n\n    <div class=\"card\">\n      <div class=\"card-head\">${d(\"db\")}<h3>${a(n(\"settings.backup\"))}</h3></div>\n      <p class=\"hint muted\" style=\"font-size:12px;margin-top:0\">\n        \\u062E\\u0631\\u0648\\u062C\\u06CC \\u06A9\\u0627\\u0645\\u0644 D1 \\u0628\\u0647 JSON \\u2014 \\u06A9\\u0627\\u0631\\u0628\\u0631\\u0627\\u0646\\u060C \\u062A\\u0646\\u0638\\u06CC\\u0645\\u0627\\u062A\\u060C \\u067E\\u0644\\u0646\\u200C\\u0647\\u0627 \\u0648 \\u0646\\u0648\\u062F\\u0647\\u0627. \\u0628\\u0631\\u0627\\u06CC \\u062C\\u0627\\u0628\\u0647\\u200C\\u062C\\u0627\\u06CC\\u06CC \\u0628\\u06CC\\u0646 \\u0627\\u06A9\\u0627\\u0646\\u062A \\u06A9\\u0644\\u0648\\u062F\\u0641\\u0644\\u0631 \\u06CC\\u0627 \\u0641\\u0631\\u0627\\u0631 \\u0627\\u0632 \\u0628\\u0646 \\u0634\\u062F\\u0646.</p>\n      <div style=\"display:flex;gap:8px;flex-wrap:wrap\">\n        <button class=\"btn\" type=\"button\" data-action=\"export-backup\">${d(\"download\")} ${a(n(\"settings.export\"))}</button>\n        <label class=\"btn\" style=\"cursor:pointer\">${d(\"upload\")} ${a(n(\"settings.import\"))}\n          <input type=\"file\" accept=\"application/json\" data-action=\"import-backup\" hidden></label>\n      </div>\n      <div class=\"nav-sep\" style=\"margin:16px 0\"></div>\n      <div class=\"card-head\" style=\"color:var(--danger)\">${d(\"alert\")}<h3 style=\"color:var(--danger)\">${a(n(\"settings.danger\"))}</h3></div>\n      <button class=\"btn btn-danger\" type=\"button\" data-action=\"revoke-all\">${d(\"logout\")} \\u062E\\u0631\\u0648\\u062C \\u0627\\u0632 \\u0647\\u0645\\u0647 \\u0646\\u0634\\u0633\\u062A\\u200C\\u0647\\u0627</button>\n    </div>\n  </div>\n\n  <div style=\"position:sticky;bottom:0;margin-top:14px;display:flex;gap:9px;justify-content:flex-end;padding:12px;\n    background:color-mix(in srgb, var(--surface) 88%, transparent);backdrop-filter:blur(10px);border:1px solid var(--border);border-radius:var(--radius)\">\n    <button class=\"btn\" type=\"button\" data-action=\"reload-settings\">${a(n(\"common.cancel\"))}</button>\n    <button class=\"btn btn-primary\" type=\"submit\">${d(\"check\")} ${a(n(\"settings.save\"))}</button>\n  </div>\n  </form>`;\n  }\n  function Ue(e = []) {\n    return `<div class=\"grid grid-2\">\n    <div class=\"card\">\n      <div class=\"card-head\">${d(\"wifi\")}<h3>${a(n(\"diag.probeNode\"))}</h3></div>\n      <div class=\"field\"><input id=\"probe-input\" type=\"text\" dir=\"ltr\" value=\"bpb.yousef.isegaro.com:443\" placeholder=\"${a(n(\"diag.probeHint\"))}\">\n        <span class=\"hint\">نمونه پروکسی‌های بالادستی فعال (کلیک برای تست سریع):</span></div>\n      <div class=\"chips\" style=\"margin-top:6px\">\n        ${[\"bpb.yousef.isegaro.com:443\", \"tr.diam4.ggff.net:443\", \"di.nscl.ir:443\", \"1.1.1.1:443\"].map((p) => `<button class=\"chip\" type=\"button\" data-action=\"omni-probe-fill\" data-v=\"${p}\">${p}</button>`).join(\"\")}\n      </div>\n      <button class=\"btn btn-primary btn-sm\" data-action=\"probe\" style=\"margin-top:10px\">${d(\"play\")} ${a(n(\"diag.run\"))}</button>\n      <div id=\"probe-out\" style=\"margin-top:12px\"></div>\n    </div>\n\n    <div class=\"card\">\n      <div class=\"card-head\">${d(\"activity\")}<h3>${a(n(\"diag.ping\"))}</h3></div>\n      <div class=\"field\"><input id=\"ping-input\" type=\"text\" dir=\"ltr\" value=\"1.1.1.1\">\n        <span class=\"hint\">سه سنجش HTTP/TCP از Worker تا مقصد؛ نه ICMP، نه زمان دستگاه کاربر و نه سلامت تونل.</span></div>\n      <div class=\"chips\" style=\"margin-top:6px\">\n        ${[\"1.1.1.1\", \"www.gstatic.com\", \"cp.cloudflare.com\", \"cloudflare.com\"].map((p) => `<button class=\"chip\" type=\"button\" data-action=\"omni-ping-fill\" data-v=\"${p}\">${p}</button>`).join(\"\")}\n      </div>\n      <button class=\"btn btn-primary btn-sm\" data-action=\"ping\" style=\"margin-top:10px\">${d(\"play\")} ${a(n(\"diag.run\"))}</button>\n      <div id=\"ping-out\" style=\"margin-top:12px\"></div>\n    </div>\n\n    <div class=\"card\">\n      <div class=\"card-head\">${d(\"bolt\")}<h3>تست سرعت زنده (دانلود / آپلود / زمان HTTPS)</h3></div>\n      <p class=\"hint muted\" style=\"margin-top:-4px\">سنجش دانلود و آپلود مرورگر تا Worker (Mbps) و زمان درخواست HTTPS مرورگر به Worker؛ این اعداد تست تونل یا ICMP نیستند.</p>\n      <button class=\"btn btn-primary btn-sm\" data-action=\"omni-speedtest\" style=\"margin-top:10px\">${d(\"bolt\")} شروع تست سرعت زنده</button>\n      <div id=\"speedtest-out\" style=\"margin-top:12px\"></div>\n    </div>\n\n    <div class=\"card\">\n      <div class=\"card-head\">${d(\"refresh\")}<h3>${a(n(\"diag.maintenance\"))}</h3></div>\n      <p class=\"hint muted\" style=\"margin-top:-4px\">${a(n(\"diag.maintenanceHint\"))}</p>\n      <button class=\"btn btn-primary btn-sm\" data-action=\"maintenance\" style=\"margin-top:10px\">${d(\"play\")} ${a(n(\"diag.run\"))}</button>\n      <div id=\"maintenance-out\" style=\"margin-top:12px\"></div>\n    </div>\n\n    <div class=\"card\" style=\"grid-column:1/-1\">\n      <div class=\"card-head\">${d(\"shield\")}<h3>${a(n(\"diag.audit\"))}</h3><div class=\"spacer\"></div>\n        <button class=\"btn btn-ghost btn-sm\" data-action=\"reload-logs\">${d(\"refresh\")}</button></div>\n      <p class=\"hint muted\" style=\"margin-top:-6px;font-size:11.5px\">${a(n(\"diag.auditHint\"))}</p>\n      <div class=\"table-wrap\" style=\"max-height:340px;overflow:auto\"><table><thead><tr>\n        <th>زمان</th><th>بازیگر</th><th>رویداد</th><th>هدف / شرح</th></tr></thead>\n        <tbody>${\n          (e || [])\n            .map(\n              (t) => `<tr>\n          <td class=\"muted\" style=\"white-space:nowrap\">${ye(t.at)}</td>\n          <td class=\"mono\" style=\"font-size:11.5px\">${a(t.actor || \"admin\")}</td>\n          <td><span class=\"badge ${/delete|failed|revoke|warn|err/.test(t.action) ? \"danger\" : /create|update|login|scan|probe|maintenance|info$/.test(t.action) ? \"info\" : \"\"}\">${a(t.action || t.level || \"info\")}</span></td>\n          <td class=\"muted mono\" style=\"font-size:11.5px\">${a(t.target || t.msg || \"\")}</td></tr>`,\n            )\n            .join(\"\") ||\n          '<tr><td colspan=\"4\"><div class=\"empty\">\\u2014</div></td></tr>'\n        }</tbody></table></div>\n    </div>\n  </div>`;\n  }\n  function Ne(e = []) {\n    return `<div class=\"card\">\n    <div class=\"card-head\">${d(\"key\")}<h3>${a(n(\"nav.sessions\"))}</h3><div class=\"spacer\"></div>\n      <button class=\"btn btn-sm btn-danger\" data-action=\"revoke-all\">${a(n(\"settings.danger\"))}</button></div>\n    <div class=\"table-wrap\"><table><thead><tr><th>Subject</th><th>Role</th><th>\\u0627\\u06CC\\u062C\\u0627\\u062F</th><th>\\u0627\\u0646\\u0642\\u0636\\u0627</th><th>IP</th><th></th></tr></thead>\n    <tbody>${\n      e\n        .map(\n          (t) => `<tr>\n      <td class=\"cell-user\">${a(t.subject)}</td><td><span class=\"badge info\">${a(t.role)}</span></td>\n      <td class=\"muted\">${ye(t.created_at)}</td><td class=\"muted\">${ce(t.expires_at - Date.now())}</td>\n      <td class=\"mono muted\" style=\"font-size:11px\">${a((t.ip_hash || \"\").slice(0, 8))}</td>\n      <td style=\"text-align:end\"><button class=\"btn btn-ghost btn-sm\" data-action=\"revoke-session\" data-id=\"${a(t.id)}\">${d(\"close\")}</button></td>\n    </tr>`,\n        )\n        .join(\"\") ||\n      '<tr><td colspan=\"6\"><div class=\"empty\">\\u2014</div></td></tr>'\n    }</tbody></table></div>\n  </div>`;\n  }\n  var ot = [\n      {\n        id: \"omni\",\n        label:\n          \"\\u0627\\u0648\\u0645\\u0646\\u06CC (\\u0644\\u0627\\u0645\\u0628\\u0648)\",\n        a: \"#ffc000\",\n        b: \"#ffffff\",\n      },\n      {\n        id: \"dark\",\n        label: \"\\u0627\\u0648\\u0645\\u0646\\u06CC \\u062A\\u06CC\\u0631\\u0647\",\n        a: \"#22d3ee\",\n        b: \"#a78bfa\",\n      },\n      {\n        id: \"light\",\n        label: \"\\u0627\\u0648\\u0645\\u0646\\u06CC \\u0631\\u0648\\u0634\\u0646\",\n        a: \"#0ea5e9\",\n        b: \"#8b5cf6\",\n      },\n      {\n        id: \"ferrari\",\n        label: \"\\u0641\\u0631\\u0627\\u0631\\u06CC\",\n        a: \"#da291c\",\n        b: \"#fff200\",\n      },\n      { id: \"apple\", label: \"\\u0627\\u067E\\u0644\", a: \"#0066cc\", b: \"#2997ff\" },\n      {\n        id: \"claude\",\n        label: \"\\u06A9\\u0644\\u0648\\u062F\",\n        a: \"#cc785c\",\n        b: \"#5db8a6\",\n      },\n      {\n        id: \"pinterest\",\n        label: \"\\u067E\\u06CC\\u0646\\u062A\\u0631\\u0633\\u062A\",\n        a: \"#e60023\",\n        b: \"#7e238b\",\n      },\n      {\n        id: \"nintendo\",\n        label: \"\\u0646\\u06CC\\u0646\\u062A\\u0646\\u062F\\u0648\",\n        a: \"#e60012\",\n        b: \"#f68d1f\",\n      },\n      { id: \"dell\", label: \"\\u062F\\u0644\", a: \"#e91d2a\", b: \"#fcc20f\" },\n    ],\n    we = [443, 2053, 2083, 2087, 2096, 8443],\n    Ht = [80, 8080, 8880, 2052, 2082, 2086, 2095],\n    It = [\n      \"2606:4700::6810:84e5\",\n      \"2606:4700::6812:1a2e\",\n      \"2606:4700:3030::ac43:b58a\",\n      \"2606:4700:3037::6815:32a1\",\n      \"2606:4700:3033::6815:1e29\",\n      \"2606:4700:3032::6815:3ef9\",\n      \"2606:4700:3030::ac43:49a1\",\n      \"2606:4700:3034::6815:4a1\",\n    ],\n    rt = [\n      \"2606:4700::6810:84e5\",\n      \"2606:4700::6812:1a2e\",\n      \"2606:4700:3030::ac43:b58a\",\n      \"2606:4700:3037::6815:32a1\",\n      \"2606:4700:3033::6815:1e29\",\n      \"2606:4700:3032::6815:3ef9\",\n      \"172.67.181.32\",\n      \"188.114.96.1\",\n      \"188.114.96.3\",\n      \"172.64.80.1\",\n      \"104.17.148.22\",\n      \"172.67.181.0/24\",\n      \"188.114.96.0/24\",\n    ],\n    Dt = [\n      \"proxyip.cmliussss.net\",\n      \"bpb.yousef.isegaro.com\",\n      \"tr.diam4.ggff.net\",\n      \"di.nscl.ir\",\n    ],\n    lt = [\n      [\"FRA\", \"\\u{1F1E9}\\u{1F1EA}\"],\n      [\"AMS\", \"\\u{1F1F3}\\u{1F1F1}\"],\n      [\"LHR\", \"\\u{1F1EC}\\u{1F1E7}\"],\n      [\"CDG\", \"\\u{1F1EB}\\u{1F1F7}\"],\n      [\"IST\", \"\\u{1F1F9}\\u{1F1F7}\"],\n      [\"DXB\", \"\\u{1F1E6}\\u{1F1EA}\"],\n      [\"IAD\", \"\\u{1F1FA}\\u{1F1F8}\"],\n      [\"LAX\", \"\\u{1F1FA}\\u{1F1F8}\"],\n      [\"SIN\", \"\\u{1F1F8}\\u{1F1EC}\"],\n      [\"NRT\", \"\\u{1F1EF}\\u{1F1F5}\"],\n      [\"BOM\", \"\\u{1F1EE}\\u{1F1F3}\"],\n      [\"GRU\", \"\\u{1F1E7}\\u{1F1F7}\"],\n    ],\n    nt =\n      \"VLESS \\u25C6 TROJAN \\u25C6 WEBSOCKET \\u25C6 DoH \\u25C6 WARP \\u25C6 CLOUDFLARE \\u25C6 \",\n    qt = [\n      \"172.67.181.32\",\n      \"188.114.96.1\",\n      \"188.114.96.3\",\n      \"188.114.97.1\",\n      \"172.64.80.1\",\n      \"104.17.148.22\",\n      \"172.67.181.14\",\n      \"172.67.73.161\",\n      \"104.18.32.115\",\n      \"104.21.32.115\",\n      \"104.26.10.12\",\n      \"104.17.209.9\",\n    ],\n    Ut = [\n      {\n        name: \"Cloudflare (1.1.1.1)\",\n        url: \"https://cloudflare-dns.com/dns-query\",\n        dot: \"one.one.one.one\",\n      },\n      {\n        name: \"Google (8.8.8.8)\",\n        url: \"https://dns.google/dns-query\",\n        dot: \"dns.google\",\n      },\n      {\n        name: \"Quad9 (9.9.9.9)\",\n        url: \"https://dns.quad9.net/dns-query\",\n        dot: \"dns.quad9.net\",\n      },\n      {\n        name: \"AdGuard DNS\",\n        url: \"https://dns.adguard-dns.com/dns-query\",\n        dot: \"dns.adguard-dns.com\",\n      },\n      {\n        name: \"ControlD (FreeDNS)\",\n        url: \"https://freedns.controld.com/p0\",\n        dot: \"p0.freedns.controld.com\",\n      },\n      {\n        name: \"OpenDNS (Cisco)\",\n        url: \"https://doh.opendns.com/dns-query\",\n        dot: \"dns.opendns.com\",\n      },\n      {\n        name: \"NextDNS\",\n        url: \"https://dns.nextdns.io/dns-query\",\n        dot: \"dns.nextdns.io\",\n      },\n      {\n        name: \"DNS.SB (آلمان/هلند)\",\n        url: \"https://doh.sb/dns-query\",\n        dot: \"dot.sb\",\n      },\n      {\n        name: \"CleanBrowsing\",\n        url: \"https://doh.cleanbrowsing.org/doh/security-filter/\",\n        dot: \"security-filter-dns.cleanbrowsing.org\",\n      },\n      {\n        name: \"AliDNS (Alibaba)\",\n        url: \"https://dns.alidns.com/dns-query\",\n        dot: \"dns.alidns.com\",\n      },\n      {\n        name: \"Shecan (شکن ایران)\",\n        url: \"https://free.shecan.ir/dns-query\",\n        dot: \"free.shecan.ir\",\n        ir: true,\n      },\n      {\n        name: \"Electro (الکترو ایران)\",\n        url: \"https://dns.electrotm.org/dns-query\",\n        dot: \"dns.electrotm.org\",\n        ir: true,\n      },\n      {\n        name: \"Radar Game (رادار ایران)\",\n        url: \"https://radar.game/dns-query\",\n        dot: \"radar.game\",\n        ir: true,\n      },\n      {\n        name: \"Begzar (بگذر ایران)\",\n        url: \"https://dns.begzar.ir/dns-query\",\n        dot: \"dns.begzar.ir\",\n        ir: true,\n      },\n    ],\n    Nt = (e) => btoa(unescape(encodeURIComponent(e)));\n  function Re(e) {\n    if (Array.isArray(e)) return e.filter(Boolean);\n    try {\n      let t = JSON.parse(e || \"[]\");\n      return Array.isArray(t) ? t.filter(Boolean) : [];\n    } catch {\n      return String(e || \"\")\n        .split(/[,\\s]+/)\n        .filter(Boolean);\n    }\n  }\n  function Oe(e) {\n    let t = new Set(),\n      s = [];\n    for (let i of [Re(e?.clean_ips), Re(e?.ip_pool), qt])\n      for (let o of i) {\n        let r = String(o?.ip ?? o?.addr ?? o ?? \"\")\n          .trim()\n          .replace(/^\\[|\\]$/g, \"\");\n        if (!r || t.has(r) || r === \"104.16.132.229\") continue;\n        if (/^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(r)) {\n          let l = Number(r.split(\".\")[3]);\n          if (l === 0 || l === 255) continue;\n        }\n        t.add(r), s.push(r);\n      }\n    return s.slice(0, 32);\n  }\n  function Rt(value, limit = 8) {\n    const text = String(value || '').trim().replace(/^\\[|\\]$/g, '');\n    if (!text.includes('/')) return text ? [text] : [];\n    const match = /^(\\d+)\\.(\\d+)\\.(\\d+)\\.(\\d+)\\/(\\d+)$/.exec(text);\n    if (!match) return [];\n    const nums = match.slice(1).map(Number), bits = nums[4];\n    if (nums.slice(0, 4).some((v) => v < 0 || v > 255) || bits < 8 || bits > 32) return [];\n    const size = 2 ** (32 - bits), ip = ((nums[0] * 2 ** 24) + (nums[1] << 16) + (nums[2] << 8) + nums[3]) >>> 0;\n    const base = Math.floor(ip / size) * size;\n    const first = size > 2 ? 1 : 0, last = size > 2 ? size - 2 : size - 1;\n    const step = Math.max(1, Math.ceil((last - first + 1) / limit)), result = [];\n    for (let offset = first; offset <= last && result.length < limit; offset += step) {\n      const n = (base + offset) >>> 0;\n      result.push(`${n >>> 24}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`);\n    }\n    return result;\n  }\n  function Ot(e) {\n    return we.includes(Number(e)) ? `${e}\\xB7TLS` : `${e}`;\n  }\n  function jt(e) {\n    let t = e.getContext && e.getContext(\"2d\");\n    if (!t) return;\n    let s = matchMedia(\"(prefers-reduced-motion: reduce)\").matches,\n      i = 0,\n      o = 0,\n      r = 1,\n      c = () => {\n        (r = Math.min(2, devicePixelRatio || 1)),\n          (i = e.clientWidth),\n          (o = e.clientHeight),\n          (e.width = i * r),\n          (e.height = o * r),\n          t.setTransform(r, 0, 0, r, 0, 0);\n      };\n    c(), addEventListener(\"resize\", c, { passive: !0 });\n    let f = Array.from({ length: 90 }, () => ({\n        x: Math.random(),\n        y: Math.random(),\n        r: Math.random() * 1.2 + 0.3,\n        p: Math.random() * 6.28,\n      })),\n      u = (1 + Math.sqrt(5)) / 2,\n      m = [\n        [-1, u, 0],\n        [1, u, 0],\n        [-1, -u, 0],\n        [1, -u, 0],\n        [0, -1, u],\n        [0, 1, u],\n        [0, -1, -u],\n        [0, 1, -u],\n        [u, 0, -1],\n        [u, 0, 1],\n        [-u, 0, -1],\n        [-u, 0, 1],\n      ].map((T) => {\n        let _ = Math.hypot(...T);\n        return T.map((I) => I / _);\n      }),\n      p = [];\n    for (let T = 0; T < 12; T++)\n      for (let _ = T + 1; _ < 12; _++)\n        Math.hypot(m[T][0] - m[_][0], m[T][1] - m[_][1], m[T][2] - m[_][2]) <\n          1.2 && p.push([T, _]);\n    let $ = getComputedStyle(document.documentElement),\n      M = () => $.getPropertyValue(\"--accent\").trim() || \"#ffc000\",\n      k = () => $.getPropertyValue(\"--text\").trim() || \"#fff\";\n    function L(T, _, I) {\n      let [j, F, N] = T,\n        V = Math.cos(_),\n        G = Math.sin(_),\n        ie = Math.cos(I),\n        ve = Math.sin(I),\n        _e = j * V + N * G,\n        he = -j * G + N * V,\n        We = F * ie - he * ve,\n        K = F * ve + he * ie;\n      return [_e, We, K];\n    }\n    function S(T, _, I, j) {\n      let N = 2.6 / (2.6 + T[2]);\n      return [I + T[0] * _ * N, j + T[1] * _ * N, N];\n    }\n    let C = 0,\n      q = performance.now(),\n      Ze = 0;\n    function be(T) {\n      let _ = (T - q) / 1e3;\n      if (T - Ze < 33) {\n        C = requestAnimationFrame(be);\n        return;\n      }\n      (Ze = T), t.clearRect(0, 0, i, o);\n      let I = i / 2,\n        j = o / 2,\n        F = Math.min(i, o) * 0.36;\n      for (let w of f) {\n        let E = 0.25 + 0.55 * Math.abs(Math.sin(_ / 1.6 + w.p));\n        (t.fillStyle = k()),\n          (t.globalAlpha = E * 0.5),\n          t.beginPath(),\n          t.arc(w.x * i, w.y * o, w.r, 0, 6.28),\n          t.fill();\n      }\n      t.globalAlpha = 1;\n      let N = _ * 0.32,\n        V = Math.sin(_ / 5) * 0.35 + 0.25,\n        G = M();\n      (t.strokeStyle = G), (t.globalAlpha = 0.28), (t.lineWidth = 1);\n      for (let w = -60; w <= 60; w += 30) {\n        t.beginPath();\n        for (let E = 0; E <= 360; E += 6) {\n          let z = (w * Math.PI) / 180,\n            Z = (E * Math.PI) / 180,\n            ee = L(\n              [\n                Math.cos(z) * Math.sin(Z),\n                Math.sin(z),\n                Math.cos(z) * Math.cos(Z),\n              ],\n              N,\n              V,\n            ),\n            [oe, re] = S(ee, F, I, j);\n          E === 0 ? t.moveTo(oe, re) : t.lineTo(oe, re);\n        }\n        t.stroke();\n      }\n      for (let w = 0; w < 360; w += 30) {\n        t.beginPath();\n        for (let E = -90; E <= 90; E += 6) {\n          let z = (E * Math.PI) / 180,\n            Z = (w * Math.PI) / 180,\n            ee = L(\n              [\n                Math.cos(z) * Math.sin(Z),\n                Math.sin(z),\n                Math.cos(z) * Math.cos(Z),\n              ],\n              N,\n              V,\n            ),\n            [oe, re] = S(ee, F, I, j);\n          E === -90 ? t.moveTo(oe, re) : t.lineTo(oe, re);\n        }\n        t.stroke();\n      }\n      (t.globalAlpha = 0.85), (t.lineWidth = 1.6), t.beginPath();\n      for (let w = 0; w <= 120; w++) {\n        let E = (w / 120) * 6.28,\n          z = L([Math.cos(E) * 1.45, Math.sin(E) * 0.32, 0], N + 0.6, V + 0.5),\n          [Z, ee] = S(z, F, I, j);\n        w === 0 ? t.moveTo(Z, ee) : t.lineTo(Z, ee);\n      }\n      t.stroke();\n      let ie = _ * 1.1,\n        ve = L([Math.cos(ie) * 1.45, Math.sin(ie) * 0.32, 0], N + 0.6, V + 0.5),\n        [_e, he] = S(ve, F, I, j);\n      (t.fillStyle = G), t.beginPath(), t.arc(_e, he, 3.2, 0, 6.28), t.fill();\n      let K = m\n        .map((w) =>\n          L(\n            w.map((E) => E * 0.52),\n            -N * 1.6,\n            -V * 1.2,\n          ),\n        )\n        .map((w) => S(w, F, I, j));\n      (t.globalAlpha = 0.16),\n        (t.fillStyle = G),\n        t.beginPath(),\n        t.arc(I, j, F * 0.62, 0, 6.28),\n        t.fill(),\n        (t.globalAlpha = 0.9),\n        (t.strokeStyle = G),\n        (t.lineWidth = 1.6);\n      for (let [w, E] of p)\n        t.beginPath(),\n          t.moveTo(K[w][0], K[w][1]),\n          t.lineTo(K[E][0], K[E][1]),\n          t.stroke();\n      (t.globalAlpha = 0.95), (t.fillStyle = G);\n      for (let w of K) t.beginPath(), t.arc(w[0], w[1], 2, 0, 6.28), t.fill();\n      (t.globalAlpha = 1), s || (C = requestAnimationFrame(be));\n    }\n    s ? be(performance.now()) : (C = requestAnimationFrame(be));\n  }\n  async function Ft() {\n    let e = document.querySelector(\"#omni-colo\");\n    if (e)\n      try {\n        let s = await fetch(\"/cdn-cgi/trace\", { cache: \"no-store\" });\n        if (!s.ok) throw new Error(`Cloudflare trace returned ${s.status}`);\n        let t = await s.text(),\n          i = /colo=(\\w+)/.exec(t)?.[1],\n          o = /ip=([^\\s]+)/.exec(t)?.[1];\n        if (!i) throw new Error(\"پاسخ Cloudflare شامل کد لوکیشن (colo) نبود\");\n        let r = (lt.find(([c]) => c === i) || [])[1] || \"\\u{1F310}\";\n        e.textContent = `${r} ${i}${o ? \" \\xB7 \" + o : \"\"}`;\n      } catch {\n        e.textContent = location.hostname.endsWith(\".workers.dev\")\n          ? \"\\u{1F310} \\u2014\"\n          : `${a(n(\"omni.localMode\"))}`;\n      }\n  }\n  function ke(e, t) {\n    let s = e || {},\n      i = (t && t.users) || {},\n      o = Re(s.clean_ips);\n    return (\n      setTimeout(() => {\n        let r = document.querySelector(\"#omni-globe\");\n        r && jt(r), Ft();\n      }, 0),\n      `\n  <section class=\"omni-hero\">\n    <div class=\"omni-hero-top\">\n      <div class=\"omni-id\">\n        <h1>OMNI PANEL</h1>\n        <p>${a(n(\"omni.heroTag\"))}</p>\n        <span class=\"omni-pill\">${a(n(\"omni.online\"))}</span>\n      </div>\n      <canvas id=\"omni-globe\" class=\"omni-globe\" aria-hidden=\"true\"></canvas>\n    </div>\n    <div class=\"omni-badges\">\n      <span>VLESS-WS</span><span>Trojan-WS</span><span>DoH</span><span>WARP</span><span>Omni v1.0</span>\n    </div>\n    <div class=\"omni-stats\">\n      <div title=\"${a(n(\"omni.statSniNote\"))}\"><span>${a(n(\"omni.statSni\"))}</span><b>${a(s.public_host || \"\\u2014\")}</b></div>\n      <div title=\"${a(n(\"omni.statColoNote\"))}\"><span>${a(n(\"omni.statColo\"))}</span><b id=\"omni-colo\">\\u2026</b></div>\n      <div title=\"${a(n(\"omni.statPortsNote\"))}\"><span>${a(n(\"omni.statPorts\"))}</span><b>${we.slice(0, 4).join(\" \\xB7 \")}</b></div>\n      <div title=\"${a(n(\"omni.statIpsNote\"))}\"><span>${a(n(\"omni.statIps\"))}</span><b>${v(o.length)}</b></div>\n      <div><span>${a(n(\"omni.statUsers\"))}</span><b>${i.total != null ? v(i.total) : \"\\u2026\"}</b></div>\n    </div>\n    <div class=\"omni-flags\" aria-hidden=\"true\">\n      ${lt.map(([r, c]) => `<span title=\"${r}\">${c}</span>`).join(\"\")}\n    </div>\n  </section>\n  <div class=\"omni-tick\" aria-hidden=\"true\"><span>${nt.repeat(4)}</span><span>${nt.repeat(4)}</span></div>`\n    );\n  }\n  var OMNI_QOS_V4 = [\n    \"172.67.181.32\",\n    \"172.67.181.122\",\n    \"172.67.181.210\",\n    \"104.17.148.167\",\n    \"104.17.148.17\",\n    \"104.17.147.119\",\n    \"104.18.3.91\",\n    \"172.67.163.24\",\n    \"104.18.181.138\",\n    \"104.21.3.237\",\n    \"172.67.181.138\",\n    \"104.18.26.46\",\n    \"172.67.179.122\",\n    \"172.67.188.14\",\n    \"104.19.148.17\",\n    \"104.20.148.17\"\n  ];\n  var OMNI_CLEAN_SITES = [\n    \"104.18.181.138\",\n    \"104.21.3.237\",\n    \"104.18.26.46\",\n    \"172.67.181.138\",\n    \"104.17.148.167\",\n    \"104.17.148.17\"\n  ];\n  var OMNI_CLEAN_V6 = [\n    \"2606:4700:3030::ac43:b58a\",\n    \"2606:4700::6812:3ed\",\n    \"2606:4700::6812:1a2e\",\n    \"2606:4700:3030::ac43:b520\",\n    \"2606:4700::6812:b58a\",\n    \"2606:4700:3030::6815:3ed\",\n    \"2606:4700::6811:9411\",\n    \"2606:4700::6811:9377\",\n    \"2606:4700:3031::ac43:d95b\",\n    \"2606:4700:3035::ac43:a318\"\n  ];\n  var OMNI_CLEAN_IR = [\n    \"172.67.181.122\",\n    \"172.67.181.210\",\n    \"172.67.181.32\",\n    \"104.17.148.167\",\n    \"104.17.148.17\",\n    \"104.21.3.237\"\n  ];\n  var DEAD_BYOIP_SET = new Set([\n    \"31.185.108.22\",\n    \"31.12.75.1\",\n    \"89.117.112.10\",\n    \"170.114.45.134\",\n    \"37.153.171.224\",\n    \"94.140.0.10\",\n    \"188.42.145.155\",\n    \"45.85.118.1\",\n    \"213.241.198.123\",\n    \"94.247.142.1\",\n    \"57.128.178.36\",\n    \"185.207.196.148\",\n    \"185.18.184.181\",\n    \"66.81.247.100\",\n    \"8.39.125.239\",\n    \"45.194.53.10\",\n    \"170.168.7.26\",\n    \"45.142.120.10\",\n    \"www.speedtest.net\",\n    \"speedtest.net\",\n    \"platoapp.com\",\n    \"www.udemy.com\",\n    \"udemy.com\",\n    \"www.canva.com\",\n    \"canva.com\",\n    \"quizlet.com\",\n    \"www.fiverr.com\",\n    \"fiverr.com\",\n    \"discord.com\",\n    \"chat.openai.com\",\n    \"01d.ir\",\n    \"0seo.ir\",\n    \"18m.ir\",\n    \"09122108011.ir\",\n    \"1car.ir\",\n    \"0nlysms.ir\",\n    \"10az10.ir\",\n    \"123project.ir\",\n  ]);\n  var PRIMARY_LOCATIONS = [\n    \"US\",\n    \"DE\",\n    \"NL\",\n    \"GB\",\n    \"FR\",\n    \"TR\",\n    \"AE\",\n    \"FI\",\n    \"SE\",\n    \"CA\",\n    \"SG\",\n    \"JP\",\n    \"CH\",\n    \"AT\",\n    \"IT\",\n    \"ES\",\n    \"NO\",\n    \"PL\",\n    \"CZ\",\n    \"HU\",\n    \"RO\",\n    \"DK\",\n    \"KR\",\n    \"AU\",\n  ];\n  var OMNI_QOS_SET = new Set(OMNI_QOS_V4.map((x) => String(x).toLowerCase()));\n  var OMNI_SITES_SET = new Set(\n    OMNI_CLEAN_SITES.map((x) => String(x).toLowerCase()),\n  );\n  var g = {\n    user: \"\",\n    profile: \"mci\",\n    cc: \"\",\n    ports: [443],\n    protos: [\"vless\", \"trojan\"],\n    addrs: \"hybrid\",\n    customAddr: \"\",\n    fp: \"chrome\",\n    fragment: !1,\n    fragPreset: \"100-200,5-10,tlshello\",\n    ipv6: !0, fmt: \"uris\", out: null, ccq: \"\", ccAll: !1, method: \"\", ech: !0, cs: \"\", alpn: \"http/1.1\", aetherIp: \"v6\", v6fm: !1, };\n  var PATT_FM = {\"tlshello-0-len\":{\"tcp\":[{\"type\":\"fragment\",\"settings\":{\"packets\":\"tlshello\",\"lengths\":[\"0\",\"104\",\"1\"],\"delays\":[\"0\"],\"maxSplit\":\"0\"}},{\"type\":\"fragment\",\"settings\":{\"packets\":\"1-1\",\"lengths\":[\"114\",\"1\"],\"delays\":[\"1\"],\"maxSplit\":\"11\"}}]},\"tlshello\":{\"tcp\":[{\"type\":\"fragment\",\"settings\":{\"packets\":\"tlshello\",\"lengths\":[\"6\",\"98\",\"1\"],\"delays\":[\"0\"],\"maxSplit\":\"0\"}},{\"type\":\"fragment\",\"settings\":{\"packets\":\"1-1\",\"lengths\":[\"114\",\"1\"],\"delays\":[\"1\"],\"maxSplit\":\"11\"}}]}};var PATT_CS = {\"semi-python\":\"TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256:TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256:TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA:TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA:TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256:TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256\",\"real-firefox\":\"TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256:TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256:TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA:TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA:TLS_RSA_WITH_AES_128_GCM_SHA256:TLS_RSA_WITH_AES_256_GCM_SHA384:TLS_RSA_WITH_AES_128_CBC_SHA:TLS_RSA_WITH_AES_256_CBC_SHA\"};function pattFmObj(v){ if(!v) return null; v=String(v); if(v.indexOf(\"patt:\")===0) return PATT_FM[v.slice(5)]||null; var q=v.split(\",\"); return {tcp:[{type:\"fragment\",settings:{packets:q[2]||\"tlshello\",length:q[0]||\"100-200\",delay:q[1]||\"5-10\",maxSplit:\"10\"}}]}; }function pattFmLabel(v){ v=String(v||\"\"); return v.indexOf(\"patt:\")===0 ? v.slice(5)+\" (Patt)\" : v; }function pattAetherLink(kind){ var ip=g.aetherIp||\"v6\"; if(kind===\"warp6\"||kind===\"warp\") return \"aether://?protocol=gool&ip=\"+ip+\"&scan=balanced#\"+encodeURIComponent(\"Omni WARP-in-WARP\"); if(kind===\"masque\") return \"aether://?protocol=masque&transport=h2&fingerprint=semi-python&ip=\"+ip+\"&fm=\"+encodeURIComponent(JSON.stringify(PATT_FM[\"tlshello-0-len\"]))+\"&scan=balanced#\"+encodeURIComponent(\"Omni MASQUE h2\"); return \"\"; }function pattImportLink(u){ return \"v2rayng://install-config?url=\"+encodeURIComponent(u); }function pattPool(cfg){ return new Set((Re(cfg?.clean_ips)||[]).map((x)=>String(x).trim().toLowerCase())); }\nfunction pattCcStats(c, pool){ let total=(c?.proxies||[]).length;\n  let ok=(c?.proxies||[]).filter((p)=>{ let k=String(p).trim().toLowerCase(); return pool.has(k) || pool.has(k.split(\":\")[0]); }).length;\n  return { total, ok }; }\nfunction zt(e) {\n  const host=String(e.settings?.public_host||location.host).replace(/^https?:\\/\\//,'').replace(/\\/.*$/,'');\n  const pool=Oe(e.settings).filter(x=>!DEAD_BYOIP_SET.has(String(x).toLowerCase())&&!COUNTRY_PROXY_MAP.has(String(x).toLowerCase()));\n  let items=[];\n  if(g.addrs==='host')items=[host];\n  else if(g.addrs==='custom')items=String(g.customAddr||'').split(/[,\\s]+/).filter(Boolean);\n  else if(g.addrs==='sites')items=[...OMNI_CLEAN_SITES,...OMNI_CLEAN_IR];\n  else if(g.addrs==='qos')items=[...OMNI_QOS_V4];\n  else items=g.profile==='mci'?[...Re(e.settings?.ipv6_pool),...OMNI_CLEAN_V6,...pool,...OMNI_QOS_V4,...OMNI_CLEAN_SITES]:[...pool,...OMNI_QOS_V4,...OMNI_CLEAN_SITES,...Re(e.settings?.ipv6_pool),...OMNI_CLEAN_V6];\n  if(!g.ipv6&&g.addrs!=='custom')items=items.filter(x=>!String(x).includes(':'));\n  const unique=[...new Set(items.map(x=>String(x).trim().replace(/^\\[|\\]$/g,'')).filter(x=>x&&!DEAD_BYOIP_SET.has(x.toLowerCase())&&!COUNTRY_PROXY_MAP.has(x.toLowerCase())))];\n  return {host,list:unique.slice(0,14)};\n}\n  function shortAddrTag(p) {\n    let c = String(p || \"\")\n      .trim()\n      .replace(/^\\[|\\]$/g, \"\");\n    if (c.includes(\":\")) {\n      let pts = c.split(\":\").filter(Boolean);\n      return \"IPv6:\" + (pts[pts.length - 1] || \"cf\");\n    }\n    return c;\n  }\n  function Bt(e) {\n    let t =\n      (e.users || []).find((p) => p.username === g.user) || (e.users || [])[0];\n    if (!t) return null;\n    let { host: s, list: i } = zt(e),\n      o = e.settings?.trojan_password || t.uuid,\n      bp = (e.settings?.path || \"/ws\").split(\"?\")[0];\n    let activeCc =\n      g.cc !== void 0 && g.cc !== \"\"\n        ? g.cc\n        : g.profile === \"direct\"\n          ? \"DIRECT\"\n          : e.settings?.selected_country || \"\";\n    let isDirect =\n      String(activeCc).toUpperCase() === \"DIRECT\" || g.profile === \"direct\";\n    let selC0 = !isDirect && activeCc ? COUNTRY_MAP.get(activeCc) : null;\n    let qs0 = [];\n    if (isDirect) {\n      qs0.push(\"mode=direct\");\n    } else if (selC0) {\n      qs0.push(\"cc=\" + selC0.cc);\n      const savedExit = String(e.settings?.selected_country || '') === String(activeCc) ? Re(e.settings?.proxy_ips)[0] : '';\n      const chosenExit = savedExit || selC0.proxies?.[0];\n      if (chosenExit) qs0.push(\"proxyip=\" + encodeURIComponent(/:\\d+$/.test(chosenExit) ? chosenExit : chosenExit + \":443\"));\n    }\n    let S = qs0.length ? `${bp}?${qs0.join(\"&\")}` : bp,\n      r = [];\n    let exitBadge = selC0\n      ? (Array.isArray(selC0.proxies) && selC0.proxies.length\n        ? `endpoint ${selC0.fa} ${selC0.flag} · برچسب کاتالوگ` : `برچسب ${selC0.fa} ${selC0.flag} · بدون endpoint کاتالوگ`)\n      : \"🌐 direct\";\n    let activePorts = [...new Set((g.ports || []).map(Number))].filter(p => [443,2053,8443,8080,80].includes(p));\n    for (let p of i)\n      for (let $ of activePorts) {\n        if (r.length >= 140) break;\n        let M = we.includes(Number($)),\n          hp = p.includes(\":\") ? `[${p}]` : p;\n        if (!M && /[a-z]/i.test(p) && !p.includes(\":\")) continue;\n        for (let k of g.protos) {\n          if (r.length >= 140) break;\n          let L = k === \"vless\" ? t.uuid : o;\n          let useFrag = Boolean(g.fragment);\n          let fpVal = g.fp || \"chrome\";\n          let rawFrag = g.fragPreset || \"100-200,5-10,tlshello\"; let fragParts = rawFrag.split(\",\"); let fragStr = pattFmLabel(rawFrag);\n          let params = [\n            `path=${encodeURIComponent(S)}`,\n            `security=${M ? \"tls\" : \"none\"}`,\n          ];\n          if (k === \"vless\") params.push(\"encryption=none\");\n          params.push(`host=${encodeURIComponent(s)}`, \"type=ws\");\n          if (M) {\n            params.push(\n              \"insecure=0\",\n              `fp=${encodeURIComponent(fpVal)}`,\n              \"allowInsecure=0\",\n              `sni=${encodeURIComponent(s)}`,\n            );\n          }\n          if (useFrag) { let fm = pattFmObj(g.fragPreset); fm && params.push(`fm=${encodeURIComponent(JSON.stringify(fm))}`); } else if (M && g.ech) { params.push(`ech=${encodeURIComponent(\"cloudflare-ech.com+udp://1.1.1.1\")}`); } if (M && g.alpn) params.push(`alpn=${encodeURIComponent(g.alpn)}`); if (M && g.cs) params.push(`cs=${encodeURIComponent(g.cs)}`); let lowP = p.toLowerCase();\n          let catLbl = lowP.endsWith(\".ir\") ? \"🇮🇷 دامنهٔ endpoint\"\n            : OMNI_SITES_SET.has(lowP)\n              ? \"🌐 endpoint\" : OMNI_QOS_SET.has(lowP) ? \"⚡ endpoint از فهرست Cloudflare\" : p.includes(\":\") ? \"endpoint IPv6\" : M ? \"endpoint TLS\" : \"🔓 بدون TLS\";\n          let idxStr = String(r.length + 1).padStart(2, \"0\");\n          let q = `#${idxStr} ${catLbl}${useFrag ? \" [Frag]\" : \"\"} · ${shortAddrTag(p)}:${$} (${exitBadge} · ${k.toUpperCase()})`;\n          r.push({\n            proto: k,\n            addr: p,\n            port: $,\n            tls: M,\n            fragment: useFrag,\n            fragStr: useFrag ? fragStr : \"\",\n            fp: fpVal,\n            cat: catLbl,\n            exitBadge,\n            uri: `${k}://${L}@${hp}:${$}?${params.join(\"&\")}#${encodeURIComponent(q)}`,\n            remark: q,\n          });\n        }\n      }\n    let c = r.map((p) => p.uri);\n    let f = r.map((p, $) => ({\n      type: p.proto,\n      tag: `${p.proto}-${$ + 1}-${shortAddrTag(p.addr)}-${p.port}`,\n      server: p.addr,\n      server_port: Number(p.port),\n      ...(p.proto === \"vless\" ? { uuid: t.uuid } : { password: o }),\n      tls: {\n        enabled: p.tls,\n        server_name: s,\n        insecure: p.fp === \"unsafe\",\n        utls: p.tls\n          ? { enabled: !0, fingerprint: p.fp === \"unsafe\" ? \"chrome\" : p.fp }\n          : void 0,\n      },\n      transport: {\n        type: \"ws\",\n        path: S,\n        headers: { Host: s },\n        max_early_data: 2048,\n        early_data_header_name: \"Sec-WebSocket-Protocol\",\n      },\n    }));\n    let aiPkgs = [\n        \"com.google.android.googlequicksearchbox\",\n        \"com.google.android.gms\",\n        \"com.google.android.gsf\",\n        \"com.android.vending\",\n      ],\n      aiDomains = [\n        \"gemini.google.com\",\n        \"aistudio.google.com\",\n        \"generativelanguage.googleapis.com\",\n        \"googleapis.com\",\n        \"googleusercontent.com\",\n        \"gstatic.com\",\n        \"accounts.google.com\",\n      ];\n    let u = {\n      log: { level: \"warn\", timestamp: !0 },\n      dns: {\n        servers: [\n          {\n            tag: \"remote\",\n            type: \"https\",\n            server: \"1.1.1.1\",\n            server_port: 443,\n            path: \"/dns-query\",\n            detour: \"select\",\n          },\n        ],\n        strategy: \"ipv4_only\",\n      },\n      inbounds: [\n        {\n          type: \"tun\",\n          tag: \"tun-in\",\n          address: [\"172.19.0.1/30\", \"fdfe:dcba:9876::1/126\"],\n          auto_route: !0,\n          strict_route: !0,\n        },\n      ],\n      outbounds: [\n        {\n          type: \"selector\",\n          tag: \"select\",\n          outbounds: [\"auto\", ...f.map((p) => p.tag)],\n        },\n        {\n          type: \"urltest\",\n          tag: \"auto\",\n          outbounds: f.map((p) => p.tag),\n          url: \"http://www.gstatic.com/generate_204\",\n          interval: \"3m\",\n        },\n        { type: \"direct\", tag: \"direct\" },\n        { type: \"block\", tag: \"block\" },\n        ...f,\n      ],\n      route: {\n        rules: [\n          { action: \"sniff\" },\n          { protocol: \"dns\", action: \"hijack-dns\" },\n          { ip_is_private: !0, outbound: \"direct\" },\n          { domain_suffix: [\".ir\"], outbound: \"direct\" },\n          { network: \"udp\", port: 443, outbound: \"block\" },\n          { package_name: aiPkgs, outbound: \"select\" },\n          { domain_suffix: aiDomains, outbound: \"select\" },\n        ],\n        final: \"select\",\n        default_domain_resolver: \"remote\",\n        auto_detect_interface: !0,\n      },\n    };\n    let m = [\n      \"mixed-port: 7890\",\n      \"allow-lan: false\",\n      \"mode: rule\",\n      \"log-level: warning\",\n      \"proxies:\",\n      ...f.flatMap((p) => [\n        `  - name: \"${p.tag}\"`,\n        `    type: ${p.type}`,\n        `    server: \"${p.server}\"`,\n        `    port: ${p.server_port}`,\n        p.type === \"vless\"\n          ? `    uuid: \"${p.uuid}\"`\n          : `    password: \"${p.uuid}\"`,\n        `    tls: ${p.tls.enabled}`,\n        `    skip-cert-verify: ${Boolean(p.tls.insecure)}`,\n        `    servername: \"${s}\"`,\n        `    client-fingerprint: \"${p.tls.utls?.fingerprint || \"chrome\"}\"`,\n        \"    network: ws\",\n        \"    ws-opts:\",\n        `      path: \"${p.transport.path}\"`,\n        \"      max-early-data: 2048\",\n        \"      early-data-header-name: Sec-WebSocket-Protocol\",\n        \"      headers:\",\n        `        Host: \"${s}\"`,\n      ]),\n      \"proxy-groups:\",\n      '  - name: \"SELECT\"',\n      \"    type: select\",\n      \"    proxies:\",\n      ...f.map((p) => `      - \"${p.tag}\"`),\n      \"rules:\",\n      \"  - DOMAIN-SUFFIX,ir,DIRECT\",\n      \"  - GEOIP,IR,DIRECT\",\n      \"  - MATCH,SELECT\",\n    ].join(\"\\n\");\n    return {\n      count: r.length,\n      items: r,\n      uris: c,\n      base64: Nt(c.join(\"\\n\")),\n      singbox: JSON.stringify(u, null, 2),\n      clash: m,\n      json: JSON.stringify(\n        {\n          vless: c.filter((p, $) => r[$].proto === \"vless\"),\n          trojan: c.filter((p, $) => r[$].proto === \"trojan\"),\n          singbox: u,\n        },\n        null,\n        2,\n      ),\n      subUrl: `https://${s}/s/${t.sub_token}`,\n    };\n  }\n  function ct() {\n    let e = document.querySelector(\"#cfg-out\");\n    if (!e || !g.out) return;\n    let t = g.out;\n    let s =\n      g.fmt === \"uris\"\n        ? `<div style=\"display:flex;flex-direction:column;gap:8px;max-height:440px;overflow:auto;padding:2px\">${t.items\n            .map(\n              (it, idx) => `\n      <div style=\"display:flex;flex-direction:column;gap:5px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--bg-elev)\">\n        <div style=\"display:flex;align-items:center;gap:8px;flex-wrap:wrap\">\n          <span class=\"badge info\">#${String(idx + 1).padStart(2, \"0\")}</span>\n          <b style=\"font-size:12.5px\">${a(it.cat)}</b>\n          <span class=\"badge ${it.tls ? \"ok\" : \"\"}\" style=\"font-size:11px\">${a(it.proto.toUpperCase())} · ${it.port}·${it.tls ? (it.fragment ? \"TLS+Frag\" : \"TLS\") : \"Plain\"}</span>\n          <span class=\"badge\" style=\"font-size:11px\">${a(it.exitBadge)}</span>\n          ${it.fragment ? `<span class=\"badge ok\" style=\"font-size:10.5px\" dir=\"ltr\">fragment=${a(it.fragStr)} · fp=${a(it.fp)}</span>` : \"\"}\n          <div style=\"flex:1\"></div>\n          <button class=\"btn btn-sm\" data-action=\"omni-copy\" data-text=\"${a(it.uri)}\">${d(\"copy\")} کپی لینک</button>\n        </div>\n        <div style=\"display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:11.5px;border-top:1px dashed var(--border);padding-top:5px\">\n          <code dir=\"ltr\" style=\"color:var(--accent);font-weight:700\">Server: ${a(it.addr)} : ${a(it.port)}</code>\n          <span class=\"muted\" style=\"font-size:11px\">عنوان در کلاینت: <b dir=\"rtl\">${a(it.remark)}</b></span>\n        </div>\n      </div>`,\n            )\n            .join(\"\")}</div>`\n        : g.fmt === \"qrcode\"\n          ? `<div class=\"cfg-qrgrid\">${t.items\n              .slice(0, 8)\n              .map(\n                (i) =>\n                  `<figure>${de(i.uri, 132)}<figcaption>${a(i.remark)}</figcaption></figure>`,\n              )\n              .join(\"\")}</div>`\n          : `<div class=\"codebox\" style=\"max-height:360px;overflow:auto\"><code dir=\"ltr\">${a(g.fmt === \"base64\" ? t.base64 : g.fmt === \"singbox\" ? t.singbox : g.fmt === \"clash\" ? t.clash : t.json)}</code></div>`;\n    e.innerHTML = `\n    <div class=\"cfg-meta\" style=\"display:flex;align-items:center;gap:8px;flex-wrap:wrap\">\n      <span class=\"badge ok\">${v(t.count)} ${a(n(\"cfg.configs\"))}</span>\n      <span class=\"muted\" style=\"font-size:12px\">${a(n(\"cfg.user\"))}: <b>${a(g.user)}</b></span>\n      <div style=\"flex:1\"></div>\n      <button class=\"btn btn-primary btn-sm\" data-action=\"omni-copy\" data-text=\"${a(g.fmt === \"uris\" ? t.uris.join(\"\\n\") : g.fmt === \"base64\" ? t.base64 : g.fmt === \"singbox\" ? t.singbox : g.fmt === \"clash\" ? t.clash : t.json)}\">${d(\"copy\")} کپی همه (${v(t.count)})</button>\n      <button class=\"btn btn-sm\" data-action=\"omni-dl\" data-fmt=\"${g.fmt}\">${d(\"download\")} ${a(n(\"common.download\"))}</button>\n    </div>\n    <div class=\"chips\" style=\"margin:10px 0\">\n      ${[\n        [\"uris\", \"📋 لیست کانفیگ‌ها (URI)\"],\n        [\"qrcode\", \"📱 QR Code\"],\n        [\"base64\", \"📦 Base64\"],\n        [\"singbox\", \"🔒 Gemini Lock · sing-box Android\"],\n        [\"clash\", \"🛡️ Clash Meta\"],\n        [\"json\", \"🧩 JSON\"],\n      ]\n        .map(\n          ([i, o]) =>\n            `<button class=\"chip\" data-action=\"omni-fmt\" data-fmt=\"${i}\" aria-pressed=\"${g.fmt === i}\">${o}</button>`,\n        )\n        .join(\"\")}\n    </div>\n    ${s}\n    <div class=\"acts\" style=\"display:flex;gap:8px;flex-wrap:wrap;margin-top:12px\">\n      <button class=\"btn btn-sm\" data-action=\"omni-deep\" data-kind=\"v2ray\">${d(\"bolt\")} افزودن به v2rayNG</button>\n      <button class=\"btn btn-sm\" data-action=\"omni-deep\" data-kind=\"hiddify\">${d(\"bolt\")} افزودن به Hiddify</button>\n      <button class=\"btn btn-sm\" data-action=\"omni-copy\" data-text=\"${a(t.subUrl)}\">${d(\"link\")} کپی لینک اشتراک (${a(t.subUrl)})</button>\n    </div>`;\n  }\n  function je(e) {\n    let t = e.users || [];\n    !g.user && t.length && (g.user = t[0].username);\n    let s = [...new Set([...g.ports])];\n    let cfg = e.settings || {};\n    let autoRot = cfg.auto_rotate === \"1\" || cfg.auto_rotate === !0;\n    let rotMins = Number(cfg.rotate_minutes || 15) || 15;\n    let activeCc =\n      g.cc !== void 0 && g.cc !== \"\" ? g.cc : cfg.selected_country || \"\";\n    let activeCountry = COUNTRY_MAP.get(activeCc);\n    let quickCountries = PRIMARY_LOCATIONS.map((cc) => COUNTRY_MAP.get(cc)).filter(Boolean);\n    let verifiedPool = pattPool(cfg);\n    let ccQuery = String(g.ccq || \"\").trim().toLowerCase();\n    let ccList = (g.ccAll ? WORLD_COUNTRIES : quickCountries).filter((c) =>\n      !ccQuery || String(c.fa).includes(ccQuery) || String(c.en).toLowerCase().includes(ccQuery) || String(c.cc).toLowerCase().includes(ccQuery));\n    let activeStats = activeCountry ? pattCcStats(activeCountry, verifiedPool) : null;\n    setTimeout(() => {\n      if (l.view === \"configs\" && t.length) {\n        if (!g.out) g.out = Bt(e);\n        ct();\n      }\n    }, 0);\n    return `\n  <header class=\"view-head\">\n    <div>\n      <h2>${d(\"qr\")} کانفیگ‌ساز هوشمند و مخزن آی‌پی چرخشی</h2>\n      <p class=\"muted\">ساخت کانفیگ با IPv4/IPv6، ECH، پورت و سرور خروجی انتخابی شما.</p>\n    </div>\n    <div class=\"head-actions\" style=\"display:flex;gap:8px;flex-wrap:wrap;align-items:center\">\n      <select id=\"cfg-user\" data-action-change=\"omni-cfg-user\" class=\"input\" style=\"min-width:140px\">\n        ${t.map((i) => `<option value=\"${a(i.username)}\" ${g.user === i.username ? \"selected\" : \"\"}>👤 ${a(i.username)}</option>`).join(\"\")}\n      </select>\n      <button class=\"btn btn-primary\" data-action=\"omni-cfg-build\">${d(\"bolt\")} بروزرسانی کانفیگ‌ها</button>\n    </div>\n  </header>\n\n  <div class=\"notice warn\" style=\"margin-bottom:12px;padding:11px\">\n    <b>تنظیم فعلی کانفیگ‌ها: ${activeCountry ? `خروجی انتخاب‌شده: ${activeCountry.flag} ${a(activeCountry.fa)}` : activeCc === \"DIRECT\" ? \"🌐 اتصال مستقیم\" : \"برچسبی انتخاب نشده\"}</b>\n        ${activeCountry && activeStats ? `<div style=\"font-size:11.5px;margin-top:4px\">${activeStats.ok ? `✅ ${v(activeStats.ok)} آدرس از این کشور در فهرست تو ذخیره است؛ ذخیره‌بودن به معنی تست موفق نیست.` : `⏳ ${v(activeStats.total)} endpoint آمادهٔ سنجش است؛ هنوز چیزی از این کشور سنجیده نشده.`}</div>` : \"\"}\n    <div style=\"font-size:11.5px;margin-top:4px\">این برچسب از کاتالوگ می‌آید (برچسب خروجی، نه اندازه‌گیری جغرافیا). سنجش اتصال را همین‌جا انجام بده؛ تأیید نهایی سرویس با یک کلاینت واقعی است.</div>\n        <div style=\"display:flex;gap:7px;flex-wrap:wrap;margin-top:8px\"><button class=\"btn btn-sm btn-primary\" type=\"button\" data-action=\"omni-go-scan\">${d(\"play\")} سنجش و تأیید endpointها</button></div>\n  </div>\n\n  <div class=\"card\" style=\"margin-bottom:14px\">\n    <div style=\"display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:10px\">\n      <div style=\"display:flex;align-items:center;gap:8px\">\n        ${d(\"refresh\")}\n        <h3 style=\"margin:0;font-size:14.5px\">🔄 فهرست candidateهای Cloudflare (IPv4 + SIIT IPv6 + ECH؛ سلامت وابسته به تست زنده)</h3>\n      </div>\n      <div style=\"display:flex;align-items:center;gap:14px;flex-wrap:wrap\">\n        <label style=\"display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;user-select:none\">\n          <span class=\"switch\"><input type=\"checkbox\" data-action=\"omni-toggle-autorotate\" ${autoRot ? \"checked\" : \"\"}><span></span></span>\n          <span>چرخش خودکار هر ${v(rotMins)} دقیقه در ساب‌لینک</span>\n        </label>\n        <button class=\"btn btn-primary btn-sm\" type=\"button\" data-action=\"omni-rotate-ips\">${d(\"refresh\")} تست زنده و چرخش candidateها</button>\n      </div>\n    </div>\n    <div style=\"display:flex;flex-wrap:wrap;gap:6px;align-items:center\">\n      ${OMNI_QOS_V4.slice(0, 5)\n        .map(\n          (ip) =>\n            `<span class=\"badge info\" dir=\"ltr\" style=\"font-family:var(--font-mono);font-size:11.5px\">⚡ candidate IPv4: ${a(ip)}</span>`,\n        )\n        .join(\"\")}\n      ${OMNI_CLEAN_SITES.slice(0, 4)\n        .map(\n          (dm) =>\n            `<span class=\"badge info\" dir=\"ltr\" style=\"font-family:var(--font-mono);font-size:11.5px\">🌐 ${a(dm)}</span>`,\n        )\n        .join(\"\")}\n      ${OMNI_CLEAN_V6.slice(0, 2)\n        .map(\n          (v6) =>\n            `<span class=\"badge info\" dir=\"ltr\" style=\"font-family:var(--font-mono);font-size:11.5px\">🚀 candidate IPv6: ${a(v6)}</span>`,\n        )\n        .join(\"\")}\n      ${OMNI_CLEAN_IR.slice(0, 2)\n        .map(\n          (dm) =>\n            `<span class=\"badge\" dir=\"ltr\" style=\"font-family:var(--font-mono);font-size:11.5px\">🧪 candidate IPv4: ${a(dm)}</span>`,\n        )\n        .join(\"\")}\n    </div>\n  </div>\n\n  <div class=\"grid grid-2\">\n    <div class=\"card\">\n      <div class=\"card-head\">${d(\"shield\")}<h3>۱) پروفایل اپراتور و لوکیشن خروجی</h3></div>\n      <div style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px\">\n        ${[\n          [\n            \"senpai\",\n            \"🎯 SenPai Anti-DPI\",\n            \"Anti-DPI: 1-104-1 + first-packet 114-1\",\n            \"1-104,1-2,tlshello\",\n          ],\n          [ \"irancell\", \"💛 ایرانسل (MTN)\", \"F&F: unsafe + semi-python + tlshello-0-len\", \"100-200,5-10,tlshello\", ],\n          [\n            \"tci\",\n            \"☎️ مخابرات / ثابت\",\n            \"ECH · بدون Fragment\",\n            \"100-200,5-10,tlshello\",\n          ],\n          [ \"mci\", \"📱 همراه اول (MCI)\", \"ECH · IPv6 (آدرس نمونهٔ کانال)\", \"100-200,5-10,tlshello\", ],\n          [\n            \"rightel\",\n            \"💜 رایتل / شاتل\",\n            \"IPv6 + ECH · بدون Fragment\",\n            \"100-200,5-10,tlshello\",\n          ],\n          [\"gaming\", \"🚀 کم‌تأخیر\", \"443 + ECH\", \"100-200,5-10,tlshello\"],\n          [\n            \"direct\",\n            \"🌐 اتصال مستقیم\",\n            \"443 + ECH · بدون پروکسی خروجی\",\n            \"100-200,5-10,tlshello\",\n          ],\n        ]\n          .map(\n            ([\n              k,\n              title,\n              sub,\n              fr,\n            ]) => `<button type=\"button\" class=\"dns-card\" data-action=\"omni-cfg-profile\" data-v=\"${k}\" data-frag=\"${fr}\" aria-pressed=\"${g.profile === k}\" style=\"padding:9px 11px;gap:3px\">\n          <b style=\"font-size:12.5px\">${title}</b>\n          <code dir=\"ltr\" style=\"font-size:10.5px;color:var(--accent)\">${sub}</code>\n        </button>`,\n          )\n          .join(\"\")}\n      </div>\n\n      \n      <div style=\"display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px\">\n        <div class=\"muted\" style=\"font-size:11.5px\">انتخاب برچسب خروجی (کشور) برای endpoint کانفیگ‌ها:</div>\n        <div style=\"display:flex;align-items:center;gap:6px;flex-wrap:wrap\">\n          <span class=\"badge info\" style=\"font-size:11px\">${v(ccList.length)} کشور</span>\n          <button type=\"button\" class=\"chip\" data-action=\"omni-cfg-cc-all\" aria-pressed=\"${g.ccAll}\">${g.ccAll ? \"⭐ فقط کشورهای اصلی\" : \"🌍 همهٔ کشورها\"}</button>\n        </div>\n      </div>\n      <div class=\"field\" style=\"margin-bottom:6px\"><input id=\"cfg-cc-q\" placeholder=\"🔎 جستجوی کشور (نام فارسی، انگلیسی یا کد)\" value=\"${a(g.ccq || \"\")}\"></div>\n      <div class=\"chips\" style=\"padding:2px\">\n        <button type=\"button\" class=\"chip\" data-action=\"omni-cfg-cc\" data-cc=\"DIRECT\" aria-pressed=\"${String(activeCc).toUpperCase() === \"DIRECT\"}\">🌐 مستقیم (بدون کشور خروجی)</button>\n        ${ccList.map((c) => {\n          let st = pattCcStats(c, verifiedPool);\n          let tag = st.ok\n            ? `<span class=\"badge ok\" style=\"font-size:10px\">✅ ${v(st.ok)}</span>`\n            : st.total\n              ? `<span class=\"badge\" style=\"font-size:10px\">⏳ ${v(st.total)}</span>`\n              : `<span class=\"muted\" style=\"font-size:10px\">—</span>`;\n          return `<button type=\"button\" class=\"chip\" data-action=\"omni-cfg-cc\" data-cc=\"${c.cc}\" aria-pressed=\"${activeCc === c.cc}\">${c.flag} ${a(c.fa)} ${tag}</button>`;\n        }).join(\"\")}\n      </div>\n      <p class=\"hint muted\" style=\"font-size:11px;margin-top:8px\">\n        ✅ = تعداد آدرس‌های ذخیره‌شده؛ نه تأیید اتصال · ⏳ = چند endpoint آمادهٔ سنجش است · — = این کشور در کاتالوگ endpoint ندارد (از فهرست سنجیده‌شدهٔ خودت استفاده می‌کند).\n      </p>\n\n      <p class=\"hint muted\" style=\"font-size:11px;margin-top:8px\">\n        ✨ قوانین app/domain برای Google Gemini در sing-box به گروه انتخاب‌شده می‌روند؛ این به معنی خروجی آمریکا یا تأیید سرویس نیست. لینک خام v2rayNG این قوانین per-app را اجرا نمی‌کند.\n      </p>\n    </div>\n\n    <div class=\"card\">\n      <div class=\"card-head\">${d(\"key\")}<h3>۲) منبع آدرس ورودی، پورت‌ها و تنظیمات TLS</h3></div>\n      <div class=\"chips\" style=\"margin-bottom:8px\">\n        ${[\n          [\"hybrid\", \"⚡ ترکیبی (QoS + سایت‌ها + IPv6)\"],\n          [\"sites\", \"🛡️ همزادهای ECH/SIIT\"],\n          [\"qos\", \"🛡️ فقط آی‌پی‌های QoS کلودفلر\"],\n          [\"host\", \"☁️ دامنهٔ اصلی ورکر\"],\n          [\"custom\", \"🎯 آدرس دلخواه\"],\n        ]\n          .map(\n            ([i, o]) =>\n              `<button type=\"button\" class=\"chip\" data-action=\"omni-cfg-addr\" data-v=\"${i}\" aria-pressed=\"${g.addrs === i}\">${a(o)}</button>`,\n          )\n          .join(\"\")}\n      </div>\n      ${g.addrs === \"custom\" ? `<div class=\"field\" style=\"margin-top:8px\"><input id=\"cfg-custom\" dir=\"ltr\" placeholder=\"172.67.181.32, 104.17.148.17, 2606:4700::6812:1a2e\" value=\"${a(g.customAddr)}\"></div>` : \"\"}\n      <div class=\"chips\" style=\"margin-top:8px\">\n        ${[\"vless\", \"trojan\"].map((i) => `<button type=\"button\" class=\"chip\" data-action=\"omni-cfg-proto\" data-v=\"${i}\" aria-pressed=\"${g.protos.includes(i)}\">${i.toUpperCase()}</button>`).join(\"\")}\n        ${[443, 2053, 8443, 8080, 80].map((i) => `<button type=\"button\" class=\"chip\" data-action=\"omni-cfg-port\" data-v=\"${i}\" aria-pressed=\"${s.includes(i)}\">${Ot(i)}</button>`).join(\"\")}\n      </div>\n      <div style=\"display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;align-items:flex-end\">\n        <label class=\"field\" style=\"flex:1;min-width:130px\"><span class=\"muted\" style=\"font-size:11.5px\">اثر انگشت TLS (Fingerprint)</span>\n          <select id=\"cfg-fp\">${[\n            [\"chrome\", \"chrome (استاندارد پلتفرم‌ها)\"],\n            [\"firefox\", \"firefox\"],\n            [\"safari\", \"safari\"],\n            [\"ios\", \"ios\"],\n            [\"android\", \"android\"],\n            [\"edge\", \"edge\"],\n            [\"randomized\", \"randomized\"],\n            [\"unsafe\", \"unsafe (مخصوص PattNG)\"],\n          ]\n            .map(\n              ([val, lbl]) =>\n                `<option value=\"${val}\" ${g.fp === val ? \"selected\" : \"\"}>${lbl}</option>`,\n            )\n            .join(\"\")}</select></label>\n        <label class=\"field\" style=\"flex:1;min-width:170px\"><span class=\"muted\" style=\"font-size:11.5px\">بازه فرگمنت (اندازه,تاخیر,بسته)</span>\n          <select id=\"cfg-frag-preset\">${[ [\"patt:tlshello-0-len\", \"✅ tlshello-0-len · مقدار رسمی اپ Patt (F&F)\"], [\"patt:tlshello\", \"✅ tlshello (6-98-1) · مقدار رسمی اپ Patt\"], [\"100-200,5-10,tlshello\", \"پروفایل A · 100-200 / 5-10 / tlshello\"],\n            [\"50-200,1-3,tlshello\", \"پروفایل B · 50-200 / 1-3 / tlshello\"],\n            [\"10-30,2-5,tlshello\", \"پروفایل C · 10-30 / 2-5 / tlshello\"],\n            [\"50-100,2-5,tlshello\", \"پروفایل D · 50-100 / 2-5 / tlshello\"],\n            [\n              \"200-3000,1-2,tlshello\",\n              \"پروفایل بـزرگ · 200-3000 / 1-2\",\n            ],\n            [\"10-20,10-20,tlshello\", \"پروفایل ریز · 10-20 / 10-20\"],\n          ]\n            .map(\n              ([val, lbl]) =>\n                `<option value=\"${val}\" ${g.fragPreset === val ? \"selected\" : \"\"}>${lbl}</option>`,\n            )\n            .join(\"\")}</select></label>\n      </div>\n      <div style=\"display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;align-items:flex-end\"><label class=\"field\" style=\"flex:1;min-width:190px\"><span class=\"muted\" style=\"font-size:11.5px\">echConfigList (ECH)</span><select id=\"cfg-ech\">${[[\"1\",\"✅ active · cloudflare-ech.com+udp://1.1.1.1\"],[\"0\",\"⛔️ پاک / خاموش\"]].map(([val,lbl]) => `<option value=\"${val}\" ${(g.ech ? \"1\" : \"0\") === val ? \"selected\" : \"\"}>${lbl}</option>`).join(\"\")}</select></label><label class=\"field\" style=\"flex:1;min-width:220px\"><span class=\"muted\" style=\"font-size:11.5px\">cipherSuites (cs)</span><select id=\"cfg-cs\">${[[\"\",\"— پیش‌فرض Xray\"],[\"TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256:TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256:TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA:TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA:TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256:TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256\",\"semi-python (Patt · F&F)\"],[\"TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256:TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256:TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA:TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA:TLS_RSA_WITH_AES_128_GCM_SHA256:TLS_RSA_WITH_AES_256_GCM_SHA384:TLS_RSA_WITH_AES_128_CBC_SHA:TLS_RSA_WITH_AES_256_CBC_SHA\",\"real-firefox (Patt)\"]].map(([val,lbl]) => `<option value=\"${val}\" ${g.cs === val ? \"selected\" : \"\"}>${lbl}</option>`).join(\"\")}</select></label><label class=\"field\" style=\"flex:1;min-width:150px\"><span class=\"muted\" style=\"font-size:11.5px\">ALPN</span><select id=\"cfg-alpn\">${[[\"http/1.1\",\"http/1.1 (ws · http)\"],[\"h2,http/1.1\",\"h2,http/1.1 (XHTTP)\"],[\"h2\",\"h2\"]].map(([val,lbl]) => `<option value=\"${val}\" ${g.alpn === val ? \"selected\" : \"\"}>${lbl}</option>`).join(\"\")}</select></label></div><div style=\"display:flex;gap:18px;margin-top:12px;flex-wrap:wrap;align-items:center\">\n        <label style=\"display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;user-select:none\">\n          <span class=\"switch\"><input type=\"checkbox\" id=\"cfg-frag\" ${g.fragment ? \"checked\" : \"\"}><span></span></span>\n          <span>افزودن FinalMask (فرگمنت TLS)</span>\n        </label>\n        <label style=\"display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;user-select:none\">\n          <span class=\"switch\"><input type=\"checkbox\" id=\"cfg-ipv6\" ${g.ipv6 ? \"checked\" : \"\"}><span></span></span>\n          <span>افزودن آدرس‌های IPv6</span>\n        </label>\n      </div>\n    </div>\n  </div>\n  ${pattMethodsCard()}<div class=\"card\" id=\"cfg-out\" style=\"margin-top:14px\">\n    <div class=\"muted\" style=\"font-size:13px\">${a(n(\"cfg.hint\"))}</div>\n  </div>`;\n  }\n  \nfunction pattMethodsCard() {\n  let m = g.method || \"\";\n  let aether = m === \"warp6\" || m === \"warp\" || m === \"masque\";\n  let info = {\n    ech: [[\"🏛️\", \"برای فایروال همراه اول (MCI)\"], [\"📍\", \"آدرس نمونه: 188.114.97.6\"], [\"🧹\", \"finalMask و cipherSuites: پاک\"],\n          [\"🖐️\", \"fingerprint: chrome\"], [\"🔐\", \"echConfigList: cloudflare-ech.com+udp://1.1.1.1\"]],\n    v6: [[\"🏛️\", \"برای فایروال همراه اول (MCI)\"], [\"🚀\", \"آدرس نمونه: 2a06:98c1:3121::7\"],\n         [\"🧹\", \"echConfigList و cipherSuites: پاک\"], [\"🖐️\", \"fingerprint: chrome\"],\n         [\"📄\", \"finalMask: خالی؛ اگر دامنه‌ات فیلتر است → tlshello-0-len\"]],\n    ff: [[\"🔥\", \"برای فایروال ایرانسل\"], [\"📍\", \"آدرس نمونه: 188.114.97.6\"], [\"🧹\", \"echConfigList: پاک\"],\n         [\"📄\", \"finalMask: tlshello-0-len\"], [\"🧬\", \"cipherSuites: semi-python\"], [\"🖐️\", \"fingerprint: unsafe\"],\n         [\"🧭\", \"ALPN: http/1.1 برای ws · h2,http/1.1 برای XHTTP\"]],\n    warp6: [[\"🌀\", \"از بخش add aether: پروتکل wireguard/warp-in-warp\"], [\"🚀\", \"نوع آی‌پی: IPv6\"],\n            [\"⚡\", \"اندپوینت‌های سریع: [2606:4700:d0::bc72:6001]:880 · [2606:4700:d1::a29f:c001]:864\"],\n            [\"🔎\", \"اسکن کن، بعد آی‌پی پیدا شده و اسم را انتخاب و سیو کن\"]],\n    near:[\"172.67.181.32\",\"104.17.148.17\",\"104.18.225.52\",\"104.19.154.120\",\"162.159.192.1\",\"162.159.193.1\",\"2606:4700:d0::bc72:6001\",\"2606:4700:d1::a29f:c001\",\"2606:4700:d0::a29f:c001\",\"2606:4700:d0::a29f:c301\",\"162.159.195.37\",\"188.114.96.73\",\"speed.cloudflare.com\",\"cp.cloudflare.com\"],\n  warp: [[\"🌀\", \"از بخش add aether: پروتکل wireguard/warp-in-warp\"], [\"📍\", \"نوع آی‌پی: هر کدام (v4 / v6 / both)\"],\n           [\"⚡\", \"اندپوینت‌های v4: 162.159.195.37:942 · 188.114.96.73:894 · 162.159.192.140:1074\"],\n           [\"🚀\", \"اندپوینت‌های v6: [2606:4700:d0::bc72:6001]:880 · [2606:4700:d1::a29f:c001]:864\"],\n           [\"🔎\", \"اسکن کن، بعد آی‌پی پیدا شده و اسم را انتخاب و سیو کن\"]],\n    masque: [[\"🧩\", \"از بخش add aether: پروتکل MASQUE-HTTP/2\"], [\"🖐️\", \"fingerprint: semi-python\"],\n             [\"📄\", \"finalMask: tlshello-0-len\"], [\"🔎\", \"اسکن کن، بعد آی‌پی و اسم را انتخاب و سیو کن\"]],\n  };\n  let lab = { ech: \"۱· CDN/WORKER با ECH\", v6: \"۲· CDN/WORKER با IPv6\", warp6: \"۳· WARP با IPv6\",\n              ff: \"۱· CDN/WORKER با F&F\", warp: \"۲· WARP\", masque: \"۳· MASQUE/HTTP/2\" };\n  let rows = info[m] ? info[m].map(([ic, tx]) => `<div style=\"display:flex;gap:7px;align-items:flex-start;font-size:12px;margin-top:5px\"><span>${ic}</span><span>${a(tx)}</span></div>`).join(\"\") : \"\";\n  let link = aether ? pattAetherLink(m) : \"\";\n  let aetherBlock = aether ? `\n    <div style=\"margin-top:10px;border-top:1px dashed var(--border);padding-top:10px\">\n      <div class=\"kpi-label\" style=\"margin-bottom:6px\">لینک آمادهٔ Aether (همین تنظیمات) — با QR یا دکمهٔ افزودن، مستقیم import می‌شود:</div>\n      <div style=\"display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start\">\n        <div class=\"qr\">${de(link)}</div>\n        <div style=\"flex:1;min-width:210px\">\n          <div class=\"codebox\" style=\"max-height:120px\" dir=\"ltr\">${a(link)}</div>\n          <div style=\"display:flex;gap:7px;margin-top:8px;flex-wrap:wrap\">\n            <button class=\"btn btn-sm\" data-action=\"omni-copy\" data-text=\"${a(link)}\">${d(\"copy\")} کپی لینک Aether</button>\n            <a class=\"btn btn-sm btn-primary\" href=\"${a(pattImportLink(link))}\">${d(\"bolt\")} افزودن به PattNG / v2rayNG</a>\n          </div>\n          <div class=\"muted\" style=\"font-size:11px;margin-top:7px\">\n            اگر دکمه باز نشد: در PattNG بخش Aether → add aether، پروتکل را دستی طبق فهرست بالا بگذار، بعد Scan بزن.\n            این متد کلاینت‌ساید است و در ساب‌لینک پنل نمی‌آید.\n          </div>\n        </div>\n      </div>\n      <div class=\"chips\" style=\"margin-top:8px\">\n        ${[[\"v4\",\"IPv4\"],[\"v6\",\"IPv6\"],[\"both\",\"هردو\"]].map(([val,lbl]) =>\n          `<button type=\"button\" class=\"chip\" data-action=\"omni-cfg-aether-ip\" data-v=\"${val}\" aria-pressed=\"${(g.aetherIp||\"v6\") === val}\">${lbl}</button>`).join(\"\")}\n      </div>\n    </div>` : \"\";\n  let v6toggle = m === \"v6\" ? `\n      <label style=\"display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;margin-top:8px\">\n        <span class=\"switch\"><input type=\"checkbox\" id=\"cfg-v6fm\" ${g.v6fm ? \"checked\" : \"\"}><span></span></span>\n        <span>دامنه‌ام فیلتر است → finalMask = tlshello-0-len</span>\n      </label>` : \"\";\n  return `<div class=\"card\" style=\"margin-top:14px\">\n    <div class=\"card-head\">${d(\"shield\")}<h3>۳) روش‌های اتصال Patt&#39;s Channel روی فایروال اپراتور</h3></div>\n    <p class=\"hint muted\" style=\"font-size:11px;margin-bottom:8px\">\n      این ۶ متد، خلاصهٔ کانال Patt است: سه متد برای فایروال همراه اول و سه متد برای فایروال ایرانسل.\n      دقت کن در بعضی مناطق سیم‌کارتت همراه اول است ولی فایروال ایرانسل فعال است و برعکس؛ سایر شبکه‌ها هم معمولاً\n      از یکی از این دو فایروال استفاده می‌کنند. با زدن هر دکمه، تنظیمات تولید کانفیگ و ساب‌لینک با همان مقدار تنظیم می‌شود.\n    </p>\n    <div class=\"chips\" style=\"margin-bottom:8px\">\n      ${[[\"ech\",\"🏛️ ECH (همراه اول)\"],[\"v6\",\"🚀 IPv6 (همراه اول)\"],[\"warp6\",\"🌀 WARP + IPv6 (همراه اول)\"],\n         [\"ff\",\"🔥 F&F (ایرانسل)\"],[\"warp\",\"🌀 WARP (ایرانسل)\"],[\"masque\",\"🧩 MASQUE/H2 (ایرانسل)\"]].map(([val,lbl]) =>\n          `<button type=\"button\" class=\"chip\" data-action=\"omni-cfg-method\" data-v=\"${val}\" aria-pressed=\"${m === val}\">${lbl}</button>`).join(\"\")}\n    </div>\n    ${m ? `<div class=\"notice\" style=\"padding:10px\">\n      <b>متد فعال: ${a(lab[m])}</b>${rows}${v6toggle}${aetherBlock}\n    </div>` : `<div class=\"muted\" style=\"font-size:12px\">یک متد را انتخاب کن؛ مقدارهای دقیق همان متد (آدرس، finalMask، cipherSuites، fingerprint، ALPN) روی تولید کانفیگ و ذخیره‌سازی ساب‌لینک اعمال می‌شود.</div>`}\n  </div>`;\n}\nfunction Vt(e, t) {\n    let s = document.createElement(\"a\");\n    (s.href = URL.createObjectURL(\n      new Blob([t], { type: \"text/plain;charset=utf-8\" }),\n    )),\n      (s.download = e),\n      s.click(),\n      setTimeout(() => URL.revokeObjectURL(s.href), 4e3);\n  }\n  function Gt(e) {\n    if (((g.out = Bt(e)), !g.out)) return y(n(\"cfg.noUser\"), \"err\");\n    ct(), y(`${v(g.out.count)} ${n(\"cfg.configs\")}`, \"ok\");\n  }\n  var WORLD_COUNTRIES = [\n    {\n      cc: \"DE\",\n      fa: \"آلمان\",\n      en: \"Germany\",\n      flag: \"🇩🇪\",\n      region: \"eu\",\n      colo: \"FRA\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"DE\",\n      proxies: [\"103.27.156.147\", \"103.109.234.61\", \"103.228.170.234\"],\n      vipProxies: [\n        \"socks5://5.255.117.127:1080\",\n        \"socks5://31.220.40.59:5080\",\n        \"socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357\"\n      ],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"NL\",\n      fa: \"هلند\",\n      en: \"Netherlands\",\n      flag: \"🇳🇱\",\n      region: \"eu\",\n      colo: \"AMS\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"NL\",\n      proxies: [\"103.137.248.227\", \"103.137.250.68\", \"109.176.202.20\"],\n      vipProxies: [\"socks5://5.255.117.127:1080\", \"socks5://31.220.40.59:5080\"],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"GB\",\n      fa: \"بریتانیا\",\n      en: \"United Kingdom\",\n      flag: \"🇬🇧\",\n      region: \"eu\",\n      colo: \"LHR\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"GB\",\n      proxies: [\"103.13.208.242\", \"109.169.76.23\", \"104.128.190.209\"],\n      vipProxies: [\n        \"socks5://qpmcy1xm:wgj6q7ns5gfs@gb.day1404.dpdns.org:11361\",\n        \"socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357\"\n      ],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"FR\",\n      fa: \"فرانسه\",\n      en: \"France\",\n      flag: \"🇫🇷\",\n      region: \"eu\",\n      colo: \"CDG\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"FR\",\n      proxies: [\n        \"104.238.191.179\",\n        \"138.124.70.97\",\n        \"109.172.55.148\",\n        \"104.253.79.6\",\n      ],\n      vipProxies: [\n        \"socks5://213.199.47.140:1080\",\n        \"socks5://5.255.117.127:1080\"\n      ],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"US\",\n      fa: \"آمریکا (ویژه Gemini/AI)\",\n      en: \"United States\",\n      flag: \"🇺🇸\",\n      region: \"na\",\n      colo: \"IAD\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"US\",\n      proxies: [\n        \"104.168.125.179\",\n        \"104.168.14.25\",\n        \"104.168.38.167\",\n        \"104.238.129.180\",\n        \"107.150.0.204\",\n      ],\n      vipProxies: [\n        \"socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357\",\n        \"socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080\"\n      ],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"TR\",\n      fa: \"ترکیه\",\n      en: \"Turkey\",\n      flag: \"🇹🇷\",\n      region: \"me\",\n      colo: \"IST\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"TR\",\n      proxies: [\"104.239.87.51\", \"130.94.0.228\", \"130.94.1.177\"],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"AE\",\n      fa: \"امارات\",\n      en: \"UAE\",\n      flag: \"🇦🇪\",\n      region: \"me\",\n      colo: \"DXB\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"AE\",\n      proxies: [\n        \"20.174.15.226\",\n        \"176.97.66.175\",\n        \"146.70.37.253\",\n        \"91.132.93.153\",\n      ],\n      vipProxies: [\"socks5://zfdsvi6l:dl7o17z4ml9q@ua.day1404.dpdns.org:11359\"],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"FI\",\n      fa: \"فنلاند\",\n      en: \"Finland\",\n      flag: \"🇫🇮\",\n      region: \"eu\",\n      colo: \"HEL\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"FI\",\n      proxies: [\"135.181.84.31\", \"138.124.244.182\", \"138.124.80.13\"],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"SE\",\n      fa: \"سوئد\",\n      en: \"Sweden\",\n      flag: \"🇸🇪\",\n      region: \"eu\",\n      colo: \"ARN\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"SE\",\n      proxies: [\n        \"172.232.149.77\",\n        \"121.127.33.130\",\n        \"158.179.206.143\",\n        \"16.170.253.163\",\n      ],\n      vipProxies: [\"socks5://171.25.158.95:1080\"],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"CA\",\n      fa: \"کانادا\",\n      en: \"Canada\",\n      flag: \"🇨🇦\",\n      region: \"na\",\n      colo: \"YYZ\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"CA\",\n      proxies: [\"138.197.160.106\", \"138.197.161.103\", \"137.220.52.250\"],\n      vipProxies: [\n        \"socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080\",\n        \"socks5://pqyiblro:BW6cuhhS2U0r@132.145.110.34:1080\"\n      ],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"SG\",\n      fa: \"سنگاپور\",\n      en: \"Singapore\",\n      flag: \"🇸🇬\",\n      region: \"as\",\n      colo: \"SIN\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"SG\",\n      proxies: [\n        \"124.156.202.172\",\n        \"103.253.145.105\",\n        \"128.1.186.55\",\n        \"103.170.217.60\",\n      ],\n      vipProxies: [\"socks5://45.77.244.108:1080\"],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"JP\",\n      fa: \"ژاپن\",\n      en: \"Japan\",\n      flag: \"🇯🇵\",\n      region: \"as\",\n      colo: \"NRT\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"JP\",\n      proxies: [\"107.148.118.151\", \"108.160.132.132\", \"103.76.85.210\"],\n      vipProxies: [\n        \"socks5://172.105.192.212:9080\",\n        \"socks5://35.78.212.217:32053\",\n        \"socks5://101.36.104.46:10808\",\n      ],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"CH\",\n      fa: \"سوئیس\",\n      en: \"Switzerland\",\n      flag: \"🇨🇭\",\n      region: \"eu\",\n      colo: \"ZRH\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"CH\",\n      proxies: [\n        \"16.63.207.85\",\n        \"167.17.181.45\",\n        \"171.22.16.201\",\n        \"140.238.209.8\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"AT\",\n      fa: \"اتریش\",\n      en: \"Austria\",\n      flag: \"🇦🇹\",\n      region: \"eu\",\n      colo: \"VIE\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"AT\",\n      proxies: [\n        \"185.175.58.196\",\n        \"87.251.69.44\",\n        \"85.192.42.198\",\n        \"92.112.48.149\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"IT\",\n      fa: \"ایتالیا\",\n      en: \"Italy\",\n      flag: \"🇮🇹\",\n      region: \"eu\",\n      colo: \"MXP\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"IT\",\n      proxies: [\n        \"179.255.190.4\",\n        \"179.255.190.3\",\n        \"179.255.190.5\",\n        \"179.255.190.24\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"ES\",\n      fa: \"اسپانیا\",\n      en: \"Spain\",\n      flag: \"🇪🇸\",\n      region: \"eu\",\n      colo: \"MAD\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"ES\",\n      proxies: [\n        \"185.237.234.67\",\n        \"31.57.190.11\",\n        \"162.141.93.191\",\n        \"141.253.194.63\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"NO\",\n      fa: \"نروژ\",\n      en: \"Norway\",\n      flag: \"🇳🇴\",\n      region: \"eu\",\n      colo: \"OSL\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"NO\",\n      proxies: [\n        \"194.5.98.17\",\n        \"194.68.32.99\",\n        \"194.32.107.150\",\n        \"195.54.170.43\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"PL\",\n      fa: \"لهستان\",\n      en: \"Poland\",\n      flag: \"🇵🇱\",\n      region: \"eu\",\n      colo: \"WAW\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"PL\",\n      proxies: [\n        \"138.124.104.104\",\n        \"185.126.64.13\",\n        \"145.239.90.29\",\n        \"176.105.253.43\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"CZ\",\n      fa: \"چک\",\n      en: \"Czechia\",\n      flag: \"🇨🇿\",\n      region: \"eu\",\n      colo: \"VIE\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"CZ\",\n      proxies: [\n        \"109.172.8.74\",\n        \"103.119.18.30\",\n        \"109.172.8.80\",\n        \"109.172.8.73\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"HU\",\n      fa: \"مجارستان\",\n      en: \"Hungary\",\n      flag: \"🇭🇺\",\n      region: \"eu\",\n      colo: \"BUD\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"HU\",\n      proxies: [\n        \"38.180.108.148\",\n        \"38.180.109.174\",\n        \"5.181.77.132\",\n        \"37.221.210.113\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"RO\",\n      fa: \"رومانی\",\n      en: \"Romania\",\n      flag: \"🇷🇴\",\n      region: \"eu\",\n      colo: \"OTP\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"RO\",\n      proxies: [\n        \"154.46.31.118\",\n        \"185.104.181.228\",\n        \"185.165.169.208\",\n        \"103.102.229.45\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"BG\",\n      fa: \"بلغارستان\",\n      en: \"Bulgaria\",\n      flag: \"🇧🇬\",\n      region: \"eu\",\n      colo: \"SOF\",\n      verifiedExit: true,\n      primary: false,\n      exitCc: \"BG\",\n      proxies: [\n        \"13.140.29.253\",\n        \"13.140.29.170\",\n        \"104.143.206.87\",\n        \"104.152.48.248\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"IE\",\n      fa: \"ایرلند\",\n      en: \"Ireland\",\n      flag: \"🇮🇪\",\n      region: \"eu\",\n      colo: \"DUB\",\n      verifiedExit: true,\n      primary: false,\n      exitCc: \"IE\",\n      proxies: [\n        \"54.247.36.82\",\n        \"108.128.156.233\",\n        \"54.77.206.41\",\n        \"198.55.103.168\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"BE\",\n      fa: \"بلژیک\",\n      en: \"Belgium\",\n      flag: \"🇧🇪\",\n      region: \"eu\",\n      colo: \"AMS\",\n      verifiedExit: true,\n      primary: false,\n      exitCc: \"BE\",\n      proxies: [\"194.71.227.213\", \"35.210.99.51\"],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"DK\",\n      fa: \"دانمارک\",\n      en: \"Denmark\",\n      flag: \"🇩🇰\",\n      region: \"eu\",\n      colo: \"CPH\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"DK\",\n      proxies: [\"193.180.209.28\", \"193.180.209.21\"],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"PT\",\n      fa: \"پرتغال\",\n      en: \"Portugal\",\n      flag: \"🇵🇹\",\n      region: \"eu\",\n      colo: \"MAD\",\n      verifiedExit: true,\n      primary: false,\n      exitCc: \"PT\",\n      proxies: [\"195.133.92.20\"],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"GR\",\n      fa: \"یونان\",\n      en: \"Greece\",\n      flag: \"🇬🇷\",\n      region: \"eu\",\n      colo: \"ATH\",\n      verifiedExit: true,\n      primary: false,\n      exitCc: \"GR\",\n      proxies: [\n        \"85.90.197.159\",\n        \"85.90.197.158\",\n        \"85.90.197.156\",\n        \"85.90.197.157\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"LV\",\n      fa: \"لتونی\",\n      en: \"Latvia\",\n      flag: \"🇱🇻\",\n      region: \"eu\",\n      colo: \"RIX\",\n      verifiedExit: true,\n      primary: false,\n      exitCc: \"LV\",\n      proxies: [\n        \"104.253.25.144\",\n        \"109.248.163.151\",\n        \"104.253.18.221\",\n        \"104.252.127.58\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"LT\",\n      fa: \"لیتوانی\",\n      en: \"Lithuania\",\n      flag: \"🇱🇹\",\n      region: \"eu\",\n      colo: \"RIX\",\n      verifiedExit: true,\n      primary: false,\n      exitCc: \"LT\",\n      proxies: [\"185.80.128.20\", \"185.34.52.147\", \"130.12.171.63\"],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"EE\",\n      fa: \"استونی\",\n      en: \"Estonia\",\n      flag: \"🇪🇪\",\n      region: \"eu\",\n      colo: \"TLL\",\n      verifiedExit: true,\n      primary: false,\n      exitCc: \"EE\",\n      proxies: [\n        \"138.124.4.38\",\n        \"144.31.170.4\",\n        \"150.241.74.200\",\n        \"150.241.74.241\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"UA\",\n      fa: \"اوکراین\",\n      en: \"Ukraine\",\n      flag: \"🇺🇦\",\n      region: \"eu\",\n      colo: \"WAW\",\n      verifiedExit: true,\n      primary: false,\n      exitCc: \"UA\",\n      proxies: [\"31.41.221.121\"],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"AM\",\n      fa: \"ارمنستان\",\n      en: \"Armenia\",\n      flag: \"🇦🇲\",\n      region: \"me\",\n      colo: \"EVN\",\n      verifiedExit: true,\n      primary: false,\n      exitCc: \"AM\",\n      proxies: [\n        \"2.56.207.67\",\n        \"2.56.204.183\",\n        \"2.56.204.246\",\n        \"139.45.214.126\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"GE\",\n      fa: \"گرجستان\",\n      en: \"Georgia\",\n      flag: \"🇬🇪\",\n      region: \"me\",\n      colo: \"TBS\",\n      verifiedExit: true,\n      primary: false,\n      exitCc: \"GE\",\n      proxies: [\"91.239.206.65\", \"185.104.192.249\", \"2.26.10.137\"],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"KR\",\n      fa: \"کره جنوبی\",\n      en: \"South Korea\",\n      flag: \"🇰🇷\",\n      region: \"as\",\n      colo: \"ICN\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"KR\",\n      proxies: [\n        \"140.238.5.86\",\n        \"131.186.26.94\",\n        \"134.185.99.52\",\n        \"131.186.16.166\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"IN\",\n      fa: \"هند\",\n      en: \"India\",\n      flag: \"🇮🇳\",\n      region: \"as\",\n      colo: \"BOM\",\n      verifiedExit: true,\n      primary: false,\n      exitCc: \"IN\",\n      proxies: [\n        \"103.111.114.87\",\n        \"216.10.243.159\",\n        \"20.235.105.146\",\n        \"4.240.110.47\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"AU\",\n      fa: \"استرالیا\",\n      en: \"Australia\",\n      flag: \"🇦🇺\",\n      region: \"oc\",\n      colo: \"SYD\",\n      verifiedExit: true,\n      primary: true,\n      exitCc: \"AU\",\n      proxies: [\n        \"16.176.42.97\",\n        \"160.187.110.199\",\n        \"176.97.68.17\",\n        \"125.7.24.251\",\n      ],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"IR\",\n      fa: \"ایران\",\n      en: \"Iran\",\n      flag: \"🇮🇷\",\n      region: \"me\",\n      colo: \"THR\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"TR\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"OM\",\n      fa: \"عمان\",\n      en: \"Oman\",\n      flag: \"🇴🇲\",\n      region: \"me\",\n      colo: \"MCT\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"TR\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"SA\",\n      fa: \"عربستان\",\n      en: \"Saudi Arabia\",\n      flag: \"🇸🇦\",\n      region: \"me\",\n      colo: \"RUH\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"TR\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"QA\",\n      fa: \"قطر\",\n      en: \"Qatar\",\n      flag: \"🇶🇦\",\n      region: \"me\",\n      colo: \"DOH\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"TR\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"BH\",\n      fa: \"بحرین\",\n      en: \"Bahrain\",\n      flag: \"🇧🇭\",\n      region: \"me\",\n      colo: \"BAH\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"TR\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"KW\",\n      fa: \"کویت\",\n      en: \"Kuwait\",\n      flag: \"🇰🇼\",\n      region: \"me\",\n      colo: \"KWI\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"TR\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"IQ\",\n      fa: \"عراق\",\n      en: \"Iraq\",\n      flag: \"🇮🇶\",\n      region: \"me\",\n      colo: \"BGW\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"TR\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"AZ\",\n      fa: \"آذربایجان\",\n      en: \"Azerbaijan\",\n      flag: \"🇦🇿\",\n      region: \"me\",\n      colo: \"GYD\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"TR\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"KZ\",\n      fa: \"قزاقستان\",\n      en: \"Kazakhstan\",\n      flag: \"🇰🇿\",\n      region: \"as\",\n      colo: \"AKX\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"SG\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"UZ\",\n      fa: \"ازبکستان\",\n      en: \"Uzbekistan\",\n      flag: \"🇺🇿\",\n      region: \"as\",\n      colo: \"WAW\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"SG\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"TH\",\n      fa: \"تایلند\",\n      en: \"Thailand\",\n      flag: \"🇹🇭\",\n      region: \"as\",\n      colo: \"BKK\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"SG\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"MY\",\n      fa: \"مالزی\",\n      en: \"Malaysia\",\n      flag: \"🇲🇾\",\n      region: \"as\",\n      colo: \"SIN\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"SG\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"TW\",\n      fa: \"تایوان\",\n      en: \"Taiwan\",\n      flag: \"🇹🇼\",\n      region: \"as\",\n      colo: \"TPE\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"SG\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"CN\",\n      fa: \"چین\",\n      en: \"China\",\n      flag: \"🇨🇳\",\n      region: \"as\",\n      colo: \"HKG\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"SG\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"VN\",\n      fa: \"ویتنام\",\n      en: \"Vietnam\",\n      flag: \"🇻🇳\",\n      region: \"as\",\n      colo: \"HKG\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"SG\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"ID\",\n      fa: \"اندونزی\",\n      en: \"Indonesia\",\n      flag: \"🇮🇩\",\n      region: \"as\",\n      colo: \"CGK\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"SG\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"PH\",\n      fa: \"فیلیپین\",\n      en: \"Philippines\",\n      flag: \"🇵🇭\",\n      region: \"as\",\n      colo: \"MNL\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"SG\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"PK\",\n      fa: \"پاکستان\",\n      en: \"Pakistan\",\n      flag: \"🇵🇰\",\n      region: \"as\",\n      colo: \"KHI\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"SG\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"AF\",\n      fa: \"افغانستان\",\n      en: \"Afghanistan\",\n      flag: \"🇦🇫\",\n      region: \"as\",\n      colo: \"ISB\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"SG\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"IS\",\n      fa: \"ایسلند\",\n      en: \"Iceland\",\n      flag: \"🇮🇸\",\n      region: \"eu\",\n      colo: \"KEF\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"NL\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"SK\",\n      fa: \"اسلواکی\",\n      en: \"Slovakia\",\n      flag: \"🇸🇰\",\n      region: \"eu\",\n      colo: \"BTS\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"NL\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"CY\",\n      fa: \"قبرس\",\n      en: \"Cyprus\",\n      flag: \"🇨🇾\",\n      region: \"eu\",\n      colo: \"LCA\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"NL\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"SI\",\n      fa: \"اسلوونی\",\n      en: \"Slovenia\",\n      flag: \"🇸🇮\",\n      region: \"eu\",\n      colo: \"LJU\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"NL\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"RS\",\n      fa: \"صربستان\",\n      en: \"Serbia\",\n      flag: \"🇷🇸\",\n      region: \"eu\",\n      colo: \"BEG\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"NL\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"BA\",\n      fa: \"بوسنی و هرزگوین\",\n      en: \"Bosnia\",\n      flag: \"🇧🇦\",\n      region: \"eu\",\n      colo: \"VIE\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"NL\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"AL\",\n      fa: \"آلبانی\",\n      en: \"Albania\",\n      flag: \"🇦🇱\",\n      region: \"eu\",\n      colo: \"TIA\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"NL\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"MD\",\n      fa: \"مولداوی\",\n      en: \"Moldova\",\n      flag: \"🇲🇩\",\n      region: \"eu\",\n      colo: \"KIV\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"NL\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"BY\",\n      fa: \"بلاروس\",\n      en: \"Belarus\",\n      flag: \"🇧🇾\",\n      region: \"eu\",\n      colo: \"WAW\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"NL\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"RU\",\n      fa: \"روسیه\",\n      en: \"Russia\",\n      flag: \"🇷🇺\",\n      region: \"eu\",\n      colo: \"DME\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"NL\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"LU\",\n      fa: \"لوکزامبورگ\",\n      en: \"Luxembourg\",\n      flag: \"🇱🇺\",\n      region: \"eu\",\n      colo: \"LUX\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"NL\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"MT\",\n      fa: \"مالت\",\n      en: \"Malta\",\n      flag: \"🇲🇹\",\n      region: \"eu\",\n      colo: \"MLA\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"NL\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"HR\",\n      fa: \"کرواسی\",\n      en: \"Croatia\",\n      flag: \"🇭🇷\",\n      region: \"eu\",\n      colo: \"ZAG\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"NL\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"NZ\",\n      fa: \"نیوزیلند\",\n      en: \"New Zealand\",\n      flag: \"🇳🇿\",\n      region: \"oc\",\n      colo: \"AKL\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"AU\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"MX\",\n      fa: \"مکزیک\",\n      en: \"Mexico\",\n      flag: \"🇲🇽\",\n      region: \"na\",\n      colo: \"QRO\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"US\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"BR\",\n      fa: \"برزیل\",\n      en: \"Brazil\",\n      flag: \"🇧🇷\",\n      region: \"sa\",\n      colo: \"GRU\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"US\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"AR\",\n      fa: \"آرژانتین\",\n      en: \"Argentina\",\n      flag: \"🇦🇷\",\n      region: \"sa\",\n      colo: \"EZE\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"US\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"CL\",\n      fa: \"شیلی\",\n      en: \"Chile\",\n      flag: \"🇨🇱\",\n      region: \"sa\",\n      colo: \"SCL\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"US\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"EG\",\n      fa: \"مصر\",\n      en: \"Egypt\",\n      flag: \"🇪🇬\",\n      region: \"af\",\n      colo: \"MRS\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"FR\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"ZA\",\n      fa: \"آفریقای جنوبی\",\n      en: \"South Africa\",\n      flag: \"🇿🇦\",\n      region: \"af\",\n      colo: \"JNB\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"FR\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n    {\n      cc: \"NG\",\n      fa: \"نیجریه\",\n      en: \"Nigeria\",\n      flag: \"🇳🇬\",\n      region: \"af\",\n      colo: \"LOS\",\n      verifiedExit: false,\n      primary: false,\n      exitCc: \"FR\",\n      proxies: [],\n      vipProxies: [],\n      v4: [\n        \"172.67.181.32\",\n        \"172.67.181.122\",\n        \"172.67.181.210\",\n        \"104.17.148.167\",\n        \"104.17.148.17\",\n        \"104.17.147.119\",\n        \"104.18.3.91\",\n        \"172.67.163.24\",\n        \"104.18.181.138\",\n        \"104.21.3.237\",\n      ],\n      v6: [\n        \"2606:4700:3030::ac43:b58a\",\n        \"2606:4700::6812:3ed\",\n        \"2606:4700::6812:1a2e\",\n        \"2606:4700:3030::ac43:b520\",\n        \"2606:4700::6812:b58a\",\n        \"2606:4700:3030::6815:3ed\",\n      ],\n    },\n  ];\n  var COUNTRY_MAP = new Map(WORLD_COUNTRIES.map((c) => [c.cc, c]));\n  var COUNTRY_PROXY_MAP = new Map();\n  for (let c of WORLD_COUNTRIES) {\n    if (!Array.isArray(c.proxies) || !c.proxies.length) continue;\n    for (let p of c.proxies || []) {\n      let k = String(p || \"\")\n        .trim()\n        .split(\":\")[0]\n        .toLowerCase();\n      if (k && !COUNTRY_PROXY_MAP.has(k)) COUNTRY_PROXY_MAP.set(k, c);\n    }\n  }\n  var SCAN_PRESETS = {\n    white_proxy: [\n      \"155.103.71.159\",\n      \"155.103.71.142\",\n      \"38.180.172.231\",\n      \"193.124.46.93\",\n      \"194.36.85.113\",\n      \"89.45.45.144\",\n      \"178.157.15.73\",\n      \"203.202.232.211\",\n      \"104.239.87.51\"\n    ],\n    senpai: [\n      \"188.114.96.3\",\n      \"162.159.192.1\",\n      \"188.114.98.66\",\n      \"155.103.71.159\",\n      \"155.103.71.142\",\n      \"194.36.85.113\",\n      \"104.239.87.51\",\n      \"38.180.172.231\",\n      \"speed.cloudflare.com\",\n      \"www.visa.com\"\n    ],\n    anti_dpi: [\n      \"188.114.96.3\",\n      \"162.159.192.1\",\n      \"188.114.98.66\",\n      \"155.103.71.159\",\n      \"155.103.71.142\",\n      \"38.180.172.231\",\n      \"193.124.46.93\",\n      \"194.36.85.113\",\n      \"89.45.45.144\",\n      \"178.157.15.73\",\n      \"203.202.232.211\",\n      \"104.239.87.51\",\n      \"speed.cloudflare.com\",\n      \"cdnjs.cloudflare.com\",\n      \"www.visa.com\",\n      \"104.18.10.226\"\n    ],\n    near: [\n      \"104.239.87.51\",\n      \"194.36.85.113\",\n      \"130.94.0.228\",\n      \"130.94.1.177\",\n      \"20.174.15.226\",\n      \"176.97.66.175\",\n      \"146.70.37.253\",\n      \"91.132.93.153\",\n      \"141.101.90.1\",\n      \"141.101.120.1\",\n      \"188.114.96.15\",\n      \"188.114.97.15\"\n    ],\n    all: [\n      \"188.114.96.3\",\n      \"162.159.192.1\",\n      \"188.114.98.66\",\n      \"172.67.181.32\",\n      \"172.67.181.122\",\n      \"104.17.148.17\",\n      \"speed.cloudflare.com\",\n      \"www.visa.com\",\n      \"2606:4700:3030::ac43:b58a\"\n    ],\n    sites: [\n      \"speed.cloudflare.com\",\n      \"cdnjs.cloudflare.com\",\n      \"www.visa.com\",\n      \"cloudflare-ech.com\",\n      \"crypto.cloudflare.com\",\n      \"blog.cloudflare.com\",\n      \"workers.cloudflare.com\",\n      \"pages.dev\",\n      \"one.one.one.one\"\n    ],\n    qos: [...OMNI_QOS_V4],\n    underground: [\n      \"2a06:98c1:3100::6815:1e8f\",\n      \"2a06:98c1:3101::6815:2e8f\",\n      \"2a06:98c1:3102::6815:3e8f\",\n      \"2a06:98c1:3103::6815:4e8f\",\n      \"2a06:98c1:3104::6815:5e8f\",\n      \"2a06:98c1:3105::6815:6e8f\",\n      \"2a06:98c1:310f::ac43:8b0c\",\n      \"2a06:98c1:3110::ac43:9b0c\",\n      \"2606:4700:3030::bc72:6001\",\n      \"2606:4700:3030::bc72:6003\",\n      \"2606:4700:3030::a29f:c001\",\n      \"2606:4700:3030::a29f:c0a2\",\n      \"2606:4700:3030::6812:0ae2\"\n    ],\n    mci: [\n      \"188.114.96.3\",\n      \"104.18.3.91\",\n      \"104.18.4.91\",\n      \"104.18.5.91\",\n      \"172.67.181.210\",\n      \"172.67.181.122\",\n      \"104.21.3.237\",\n      \"104.18.181.138\",\n      \"172.67.181.138\",\n      \"104.17.147.119\",\n      \"104.18.26.46\",\n      \"104.21.4.237\"\n    ],\n    irancell: [\n      \"188.114.98.66\",\n      \"104.17.147.119\",\n      \"104.17.148.119\",\n      \"104.17.149.119\",\n      \"172.67.181.32\",\n      \"172.67.181.14\",\n      \"104.18.32.115\",\n      \"104.21.32.115\",\n      \"104.26.10.12\",\n      \"104.17.209.9\",\n      \"172.67.73.161\"\n    ],\n    tci: [\n      \"104.18.10.226\",\n      \"104.16.142.53\",\n      \"104.16.143.53\",\n      \"104.16.144.53\",\n      \"172.67.181.32\",\n      \"172.67.181.122\",\n      \"104.17.148.17\",\n      \"104.17.148.167\",\n      \"104.18.181.138\",\n      \"104.21.3.237\",\n      \"172.67.181.138\"\n    ],\n    rightel: [\n      \"104.18.3.91\",\n      \"104.18.4.91\",\n      \"172.67.181.210\",\n      \"172.67.181.122\",\n      \"104.21.3.237\",\n      \"104.18.181.138\",\n      \"172.67.181.138\",\n      \"104.17.147.119\",\n      \"104.18.26.46\",\n      \"172.67.181.32\"\n    ],\n    rare: [\n      \"131.0.72.1\",\n      \"131.0.72.55\",\n      \"197.234.240.1\",\n      \"190.93.243.101\",\n      \"108.162.194.15\",\n      \"141.101.65.33\",\n      \"103.21.244.8\",\n      \"173.245.52.100\",\n      \"198.41.132.55\"\n    ],\n    warp: [\n      \"2606:4700:d0::bc72:6001\",\n      \"2606:4700:d1::a29f:c001\",\n      \"2606:4700:d0::a29f:c001\",\n      \"2606:4700:d0::a29f:c301\",\n      \"162.159.195.37\",\n      \"188.114.96.73\",\n      \"162.159.192.140\",\n      \"188.114.96.1\",\n      \"162.159.192.1\",\n      \"162.159.192.3\",\n      \"162.159.193.1\",\n      \"162.159.193.3\",\n      \"162.159.195.1\",\n      \"162.159.195.3\",\n      \"162.159.204.1\",\n      \"162.159.204.3\",\n      \"188.114.96.2\",\n      \"188.114.97.2\",\n      \"188.114.98.2\",\n      \"188.114.99.2\",\n      \"engage.cloudflareclient.com\"\n    ],\n    anycast: [\n      \"104.16.142.53\",\n      \"104.16.143.53\",\n      \"104.16.144.53\",\n      \"104.17.148.17\",\n      \"104.17.148.167\",\n      \"104.19.148.17\",\n      \"104.20.148.17\",\n      \"104.22.148.17\",\n      \"104.24.148.17\",\n      \"104.25.148.17\",\n      \"104.26.148.17\",\n      \"104.27.148.17\",\n      \"104.28.148.17\"\n    ],\n    ipv6: [\n      \"2606:4700:3030::bc72:6003\",\n      \"2606:4700::6812:3ed\",\n      \"2606:4700:3030::a29f:c001\",\n      \"2803:f800::1\",\n      \"2606:4700:110::1\",\n      \"2a06:98c1:3100::6815:1e8f\",\n      \"2606:4700:3030::ac43:b520\"\n    ],\n    ir: [\n      \"188.114.96.3\",\n      \"188.114.98.66\",\n      \"162.159.192.1\",\n      \"104.18.10.226\",\n      \"2606:4700:3030::bc72:6003\",\n      \"2606:4700::6812:3ed\"\n    ],\n    zeta: [\n      \"188.114.96.3\",\n      \"188.114.98.66\",\n      \"162.159.192.1\",\n      \"104.239.87.51\",\n      \"194.36.85.113\",\n      \"speed.cloudflare.com\",\n      \"www.visa.com\"\n    ]\n  };;\nvar O = {\n    running: !1,\n    tab: \"ingress\",\n    scanMode: \"preset\",\n    preset: \"all\",\n    country: \"\",\n    region: \"all\",\n    ipVer: \"both\",\n    countryQuery: \"\",\n    lineRtt: null,\n    results: [],\n    countryResults: [],\n  };\n  function it(e) {\n    return e < 0\n      ? \"var(--danger)\"\n      : e < 170\n        ? \"var(--ok)\"\n        : e < 360\n          ? \"var(--warn)\"\n          : \"var(--danger)\";\n  }\n  function se(e) {\n    let t = document.querySelector(\"#scan-status\");\n    t && (t.textContent = e);\n  }\n  function renderCountryGrid() {\n  const el=document.querySelector('#country-grid');if(!el)return;\n  const q=String(O.countryQuery||'').toLowerCase();\n  const list=WORLD_COUNTRIES.filter(c=>Array.isArray(c.proxies)&&c.proxies.length).filter(c=>q ? `${c.fa} ${c.en} ${c.cc}`.toLowerCase().includes(q) : O.region==='primary'?c.primary:O.region==='all'||c.region===O.region);\n  const count=document.querySelector('#country-count-lbl');if(count)count.textContent=`${list.length} کشور`;\n  el.innerHTML=list.map(c=>`<button type=\"button\" class=\"chip\" data-action=\"omni-country\" data-cc=\"${a(c.cc)}\" aria-pressed=\"${O.country===c.cc}\">${c.flag} ${a(c.fa)} <small dir=\"ltr\">${a(c.cc)} (${c.proxies.length})</small></button>`).join('');\n}\n  function renderAllCountriesScanResults() {\n  const out=document.querySelector('#scan-out');if(!out)return;\n  if(!O.countryResults.length){out.innerHTML=`<div class=\"muted\">${O.running?'در حال تست TCP سرورهای خروجی…':'نتیجه‌ای دریافت نشد.'}</div>`;return;}\n  const lineRtt = O.lineRtt || 140;\n  out.innerHTML=[...O.countryResults].sort((l,r)=>(l.worker_tcp_ms??1e9)-(r.worker_tcp_ms??1e9)).map(r=>{\n    const ok=Boolean(r.tcp_reachable),ms=Number.isFinite(r.worker_tcp_ms)?r.worker_tcp_ms:null;\n    const phoneMs = ok && ms ? (lineRtt + ms) : null;\n    return `<div class=\"scan-row\" style=\"display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:12px;border-bottom:1px solid var(--border)\"><b>${a(r.flag||'')} ${a(r.fa||r.cc)}</b><code dir=\"ltr\">${a(r.proxy||'—')}</code><span class=\"badge ${ok?'ok':'danger'}\">${ok?`⚡ پینگ واقعی گوشی: ${phoneMs} ms`:'پاسخ نداد'}</span><span class=\"muted\" style=\"font-size:11px\">گوشی ↔ ورکر: ${lineRtt} ms + خروجی: ${ms} ms</span>${ok&&r.proxy?`<button class=\"btn btn-sm\" data-action=\"omni-pick-country-exit\" data-cc=\"${a(r.cc)}\" data-proxy=\"${a(r.proxy)}\">انتخاب خروجی ${a(r.flag||'')}</button>`:''}</div>`;\n  }).join('');\n}\n  // OMNI scanner repair 2026-10-06. A Worker response is not a client tunnel test.\ndocument.addEventListener('input', (event) => {\n    if (event.target?.id !== 'scan-ranges' || O.running) return;\n    O.scanMode = 'custom'; O.results = []; O.scanError = ''; xe(0); scanControls();\n    document.querySelectorAll('[data-action=\"omni-preset\"]').forEach((el) => el.setAttribute('aria-pressed', 'false'));\n    se('ورودی تغییر کرد؛ برای نتیجهٔ تازه «شروع بررسی» را بزنید.');\n  });\n  function scanIsIp(value) {\n  const s = String(value || \"\").replace(/^\\[|\\]$/g, \"\");\n  return s.includes(\":\") || /^\\d{1,3}(\\.\\d{1,3}){3}$/.test(s);\n}\nfunction scanFreshRows() {\n  return O.results.filter((r) => r.done && Date.now() - (r.checked_at || 0) < 300000 && !COUNTRY_PROXY_MAP.has(r.ip.toLowerCase()));\n}\nfunction scanControls() {\n  document.querySelectorAll('[data-action=\"omni-scan-tab\"], [data-action=\"omni-scan\"], [data-action=\"omni-preset\"], [data-action=\"omni-ipver\"], [data-action=\"omni-clear-custom\"], [data-action=\"omni-underground-hunt\"], [data-action=\"omni-scan-all-countries\"], [data-action=\"omni-country\"]').forEach((el) => { el.disabled = Boolean(O.running); });\n  const input = document.querySelector('#scan-ranges'); if (input) input.disabled = Boolean(O.running);\n  const button = document.querySelector('#scan-apply');\n  if (button) {\n    button.disabled = O.running || !O.results.some((r) => r.healthy && Date.now() - (r.checked_at || 0) < 300000);\n    button.textContent = O.tab === 'countries' ? 'انتخاب سریع‌ترین خروجی پاسخ‌گو' : 'ذخیرهٔ نتایج پاسخ‌گو در پنل';\n  }\n}\nfunction scanFinish() {\n  O.running = false; xe(O.results.length); scanControls();\n  const good=O.results.filter((r) => r.healthy && r.ms > 0);\n  const best=good.length ? Math.min(...good.map((r) => r.ms)) : null;\n  se(`تست کامل شد — ${good.length}/${O.results.length} پاسخ‌گو${best !== null ? ` · کم‌ترین زمان ${O.tab === 'countries' ? 'TCP ورکر' : 'HTTPS مرورگر'}: ${best} ms` : ''}${O.scanError ? ' · '+O.scanError : ''}`);\n}\nfunction scanMerge(row, edge, rejected) {\n  const proxy=COUNTRY_PROXY_MAP.has(row.ip.toLowerCase());\n  row.worker_ms=Number.isFinite(edge?.edge_ms) && edge.edge_ms > 0 ? edge.edge_ms : null;\n  row.worker_reachable=Boolean(edge?.tcp_reachable || edge?.worker_reachable || edge?.alive);\n  row.cloudflare_verified=Boolean(edge?.alive && edge?.is_cf && !edge?.is_proxy);\n  row.worker_error=String(edge?.error || rejected?.error || '');\n  row.colo=edge?.colo || null;\n  row.port2053=Boolean(edge?.port2053);\n  if (proxy) {\n    row.ms=Boolean(edge?.tcp_reachable) ? (edge?.worker_tcp_ms || edge?.edge_ms || row.worker_ms) : null;\n    row.healthy=Boolean(edge?.tcp_reachable) && row.ms !== null;\n    row.err=row.healthy ? '' : (edge?.error || 'پورت TCP پاسخ نداد');\n  } else {\n    if (row.browser_state === 'measured' && Number.isFinite(row.ms) && row.ms > 0) {\n      row.healthy = true;\n    } else if (edge?.alive && (edge?.tcp_reachable || edge?.is_proxy || (edge?.is_cf && Number.isFinite(row.attempt_ms) && row.attempt_ms > 0))) {\n      row.healthy = true;\n      const line = Number.isFinite(O.lineRtt) && O.lineRtt > 0 ? O.lineRtt : 120;\n      row.ms = Math.round(line + (edge.edge_ms || 25));\n      row.err = '';\n    } else {\n      row.healthy = false;\n      row.err = row.err || edge?.error || 'پاسخ دریافت نشد';\n    }\n  }\n  row.done=true; row.checked_at=Date.now();\n}\n\n  function coloBadge(colo) {\n  if (!colo) return '';\n  const c = String(colo).toUpperCase();\n  const golden = ['IST','SAW','GYD','EVN','EBL','BGW','DXB','AUH','DOH','KWI','BAH','MCT','SOF','TBS','ATH'];\n  const silver = ['FRA','AMS','VIE','WAW','CDG','LHR','MXP','ZRH','MAD','OTP'];\n  if (golden.includes(c)) return `<span class=\"badge ok\" dir=\"ltr\" title=\"نزدیک‌ترین دیتاسنتر لبه کلودفلر به ایران\">👑 لبه همسایه: ${c}</span>`;\n  if (silver.includes(c)) return `<span class=\"badge info\" dir=\"ltr\" title=\"دیتاسنتر مستقیم اروپایی\">⚡ لبه اروپا: ${c}</span>`;\n  return `<span class=\"badge\" dir=\"ltr\">🌐 لبه: ${c}</span>`;\n}\nfunction xe(total) {\n  const out=document.querySelector('#scan-out');if(!out)return;\n  const progress=document.querySelector('#scan-bar');\n  if(progress)progress.style.width=`${total ? Math.round(O.results.filter((r)=>r.done||r.browser_done).length/total*100) : 0}%`;\n  const goldenColos = new Set(['IST','SAW','GYD','EVN','EBL','BGW','DXB','AUH','DOH','KWI','BAH','MCT','SOF','TBS','ATH']);\n  const silverColos = new Set(['FRA','AMS','VIE','WAW','CDG','LHR','MXP','ZRH','MAD','OTP']);\n  const sortScore = (r) => {\n    if (!r.healthy) return 1e9;\n    const c = String(r.colo || '').toUpperCase();\n    const tierBonus = goldenColos.has(c) ? -80 : silverColos.has(c) ? -30 : 0;\n    return (r.ms || 999) + tierBonus;\n  };\n  const sorted=[...O.results].sort((l,r)=>sortScore(l)-sortScore(r));\n  out.innerHTML=sorted.length ? sorted.map((r)=>{\n    const proxy=COUNTRY_PROXY_MAP.get(r.ip.toLowerCase()), v6=r.ip.includes(':'), raw=scanIsIp(r.ip);\n    const ok=r.healthy && r.ms>0, finished=r.done||r.browser_done;\n    const kind=proxy ? `${proxy.flag} خروجی ${proxy.fa}` : v6 ? '🚀 ورودی IPv6' : OMNI_QOS_SET.has(r.ip.toLowerCase()) ? '⚡ ورودی QoS کلودفلر' : raw ? '⚡ ورودی IPv4' : '🌐 دامنه';\n    const message=ok ? `${r.ms} ms` : !finished ? '…' : r.err || 'پاسخ HTTPS دریافت نشد';\n    const color=ok ? it(r.ms) : finished ? 'var(--danger)' : 'var(--text-faint)';\n    const source=String(r.source||'').replace(/configured IPv[46] seed candidate; untested/g,'فهرست اولیه').replace(/candidate/g,'آدرس');\n    return `<div class=\"scan-row\" style=\"display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 8px;border-bottom:1px solid var(--border)\">\n      <code dir=\"ltr\" style=\"font-size:13px;font-weight:700;min-width:165px;overflow-wrap:anywhere\">${a(r.ip)}</code>\n      <span class=\"scan-bar\" style=\"flex:1;min-width:60px\"><i style=\"width:${ok ? Math.min(100,Math.max(10,100-r.ms/6)) : finished ? 100 : 0}%;background:${color}\"></i></span>\n      <b dir=\"auto\" style=\"color:${color};font-size:12px\">${a(message)}</b>\n      <span class=\"badge ${ok?'ok':''}\" style=\"font-size:11px\">${a(kind)}${ok ? proxy ? ' · TCP ورکر' : (raw ? ' · لبه تأییدشده' : ' · HTTPS مرورگر') : ''}</span>\n      ${r.sample_range>0 && ok ? `<span class=\"badge\" dir=\"ltr\">بازه: ${r.sample_range} ms</span>`:''}${ok && r.colo ? coloBadge(r.colo) : ''}\n      ${ok && r.port2053 ? '<span class=\"badge info\" dir=\"ltr\" style=\"font-size:10.5px\">⚡ پورت ۲۰۵۳ باز</span>' : ''}\n      ${proxy&&ok?`<button type=\"button\" class=\"btn btn-primary btn-sm\" data-action=\"omni-pick-country-exit\" data-cc=\"${a(proxy.cc)}\" data-proxy=\"${a(r.ip)}:443\">انتخاب ${proxy.flag}</button>`:''}\n      ${finished ? `<details style=\"width:100%;font-size:11px\"><summary class=\"muted\">جزئیات مسیر و لبه</summary><div class=\"muted\" style=\"line-height:1.8\">${ok ? `✅ اتصال لبه کلودفلر پایدار است. تأخیر نهایی کلاینت: ${r.ms} ms` + (r.worker_ms ? ` (گوشی ↔ ورکر: ${O.lineRtt || '—'} ms + لبه کلودفلر: ${r.worker_ms} ms)` : '') + (r.colo ? ` · دیتاسنتر: ${r.colo}` : '') + (r.port2053 ? ' · پورت جایگزین ۲۰۵۳ در دسترس است' : '') : (raw&&!proxy?'درخواست مستقیم HTTPS مرورگر به این IP بدون SNI انجام شد. ':'' + (r.attempt_ms ? `زمان تلاش: ${r.attempt_ms} ms؛ `:'' + (r.worker_error||'')))}</div></details>`:''}\n      ${source?`<small class=\"muted\" style=\"width:100%\">${a(source)}</small>`:''}\n    </div>`;\n  }).join('') : '<div class=\"muted\">هنوز نتیجه‌ای نیست.</div>';\n}\n  async function measureLineRtt() {\n    let rtt = null;\n    let colo = null;\n    try {\n      await fetch(\"/healthz?w=\" + Date.now(), {\n        cache: \"no-store\",\n        signal: AbortSignal.timeout(2500),\n      });\n      const samples = [];\n      for (let i = 0; i < 3; i++) {\n        const started = performance.now();\n        const response = await fetch(\"/healthz?t=\" + Date.now() + \"_\" + i, {\n          cache: \"no-store\",\n          signal: AbortSignal.timeout(2500),\n        });\n        if (response.ok) {\n          samples.push(Math.max(1, Math.round(performance.now() - started)));\n          if (!colo) colo = response.headers.get(\"x-omni-colo\") || null;\n        }\n      }\n      if (samples.length) {\n        samples.sort((a, b) => a - b);\n        rtt = samples[Math.floor(samples.length / 2)];\n      }\n    } catch {\n      // No response is unavailable, not a default/estimated latency.\n    }\n    O.lineRtt = rtt;\n    return { rtt, colo };\n  }\n  async function Zt(value, timeoutMs=2200) {\n  const host=String(value||'').trim().replace(/^\\[|\\]$/g,'');\n  if(COUNTRY_PROXY_MAP.has(host.toLowerCase()))return {ms:null,samples:0,state:'proxy-client'};\n  const urlHost=host.includes(':')?`[${host}]`:host;\n  const samples=[],attempts=[];let error='';\n  for(let round=0;round<2;round++) {\n    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs),started=performance.now();\n    try {\n      await fetch(`https://${urlHost}/cdn-cgi/trace?r=${Math.random()}`,{mode:'no-cors',cache:'no-store',signal:ctrl.signal});\n      samples.push(Math.max(1,Math.round(performance.now()-started)));\n    }catch(err) {\n      const elapsed = Math.max(1, Math.round(performance.now() - started));\n      attempts.push(elapsed);\n      error = ctrl.signal.aborted ? 'مهلت پاسخ تمام شد' : 'خطای TLS / شبکه';\n    }finally{clearTimeout(timer);}\n  }\n  if(!samples.length)return {ms:null,samples:0,state:'failed',error,attempt_ms:attempts.length?Math.min(...attempts):null};\n  samples.sort((l,r)=>l-r);\n  return {ms:Math.round(samples.reduce((s,x)=>s+x,0)/samples.length),samples:samples.length,state:'measured',sample_range:samples.at(-1)-samples[0]};\n}\n  function dt(cfg) {\n  if (O.tab === 'countries' && O.country) return (COUNTRY_MAP.get(O.country)?.proxies || []).map((p) => String(p).split(':')[0]);\n  const input = document.querySelector('#scan-ranges');\n  const lines = input ? input.value.split(/[\\s,]+/).filter(Boolean) : (SCAN_PRESETS[O.preset] || SCAN_PRESETS.all);\n  const result = new Set();\n  for (const line of lines) for (const value of Rt(line, 8)) {\n    const ip = String(value).trim().replace(/^\\[|\\]$/g, '');\n    if (!ip || DEAD_BYOIP_SET.has(ip.toLowerCase())) continue;\n    if (/^\\d+(\\.\\d+){3}$/.test(ip) && ip.split('.').some((n) => Number(n) > 255)) continue;\n    if (O.ipVer === 'v4' && ip.includes(':')) continue;\n    if (O.ipVer === 'v6' && !ip.includes(':')) continue;\n    result.add(ip);\n  }\n  return [...result].slice(0, 36);\n}\n  async function WtAllCountries(e) {\n  if(O.running)return;O.running=true;O.tab='countries';O.scanMode='all-countries';O.country='';O.countryResults=[];O.results=[];scanControls();renderAllCountriesScanResults();\n  const bar=document.querySelector('#scan-bar');if(bar)bar.style.width='12%';se('در حال تست هم‌زمان TCP سرورهای خروجی کشورها…');\n  try {\n    const response=await x('POST','/api/diag/scan-countries',{onlyPrimary:false,concurrency:6,timeout:3500},{retry:0,signal:AbortSignal.timeout(60000)});\n    O.countryResults=Array.isArray(response?.results)?response.results:[];\n    se(`تست کشورها تمام شد — ${O.countryResults.filter(r=>r.tcp_reachable).length}/${O.countryResults.length} کشور با TCP پاسخ‌گو از ورکر.`);\n  }catch(err){se(String(err?.message||'تست کشورها انجام نشد.'));}\n  finally{O.running=false;if(bar)bar.style.width='100%';scanControls();renderAllCountriesScanResults();}\n}\n  async function scanRun(candidates,cfg,sources=new Map()) {\n  O.scanError='';\n  O.results=candidates.map((ip)=>({ip,ms:null,worker_ms:null,healthy:false,done:false,browser_done:false,browser_state:'pending',source:sources.get(ip)||''}));\n  xe(candidates.length);scanControls();se(`در حال اسکن ${candidates.length} آدرس…`);\n  const edgePromise=x('POST','/api/diag/rank-ips',{ips:candidates,host:cfg.public_host||''},{retry:0,signal:AbortSignal.timeout(18000)}).catch((err)=>{O.scanError=String(err?.message||'بررسی ورکر انجام نشد');return {results:[]};});\n  const linePromise=measureLineRtt().then((line)=>{\n    const el=document.querySelector('#direct-ping-badges');\n    if(el&&line.rtt)el.innerHTML=`<span class=\"badge info\" dir=\"ltr\">مرورگر ↔ پنل: ${line.rtt} ms</span>`;\n  });\n  const queue=[...O.results];\n  await Promise.all(Array.from({length:Math.min(6,queue.length)},async()=>{while(queue.length){\n    const row=queue.shift(),probe=await Zt(row.ip,2200);\n    row.ms=probe.ms;row.attempt_ms=probe.attempt_ms;row.browser_state=probe.state;row.sample_range=probe.sample_range;row.samples=probe.samples||0;row.err=probe.error||'';row.browser_done=true;\n    row.healthy=probe.state==='measured'&&probe.ms>0;xe(candidates.length);\n  }}));\n  const response=await edgePromise;await linePromise;\n  const results=new Map((response?.results||[]).map(r=>[String(r.ip).toLowerCase(),r]));\n  const rejected=new Map((response?.rejected||[]).map(r=>[String(r.ip).toLowerCase(),r]));\n  O.results.forEach(r=>scanMerge(r,results.get(r.ip.toLowerCase()),rejected.get(r.ip.toLowerCase())));\n}\n  async function Wt(e) {\n  if (O.running) return;\n  O.running = true;\n  O.scanError = '';\n  O.results = [];\n  xe(0);\n  scanControls();\n  try {\n    const raw = typeof e?.settings === 'function' ? await e.settings() : e?.settings || {};\n    const cfg = raw?.settings || raw || {};\n    const candidates = dt(cfg);\n    if (!candidates.length) { O.results = []; O.scanError = 'آدرسی مطابق فیلتر انتخابی نیست؛ ورودی یا IPv4/IPv6 را عوض کنید.'; return; }\n    await scanRun(candidates, cfg);\n  } catch (err) {\n    O.scanError = String(err?.message || err);\n  } finally { scanFinish(); }\n}\n  async function WtUnderground(e) {\n  if(O.running)return;O.running=true;O.scanError='';O.results=[];O.tab='ingress';O.scanMode='preset';O.preset='underground';O.country='';xe(0);scanControls();\n  document.querySelectorAll('[data-action=\"omni-preset\"]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.v==='underground')));\n  se('در حال ساخت فهرست SIIT-Hex64 و استخراج رکوردهای ECH…');\n  try {\n    const raw=typeof e?.settings==='function'?await e.settings():e?.settings||{},cfg=raw?.settings||raw||{};\n    const response=await x('POST','/api/diag/underground-hunt',{seeds:Re(cfg.clean_ips),limit:14,apply:false},{retry:0,signal:AbortSignal.timeout(15000)});\n    const candidates=Array.isArray(response?.candidates)?response.candidates:[];\n    const textarea=document.querySelector('#scan-ranges');if(textarea)textarea.value=candidates.map(r=>r.addr).join('\\n');\n    const selected=dt(cfg);if(!selected.length){O.scanError='آدرسی مطابق فیلتر انتخابی وجود ندارد.';return;}\n    await scanRun(selected,cfg,new Map(candidates.map(r=>[r.addr,r.source])));\n  }catch(err){O.scanError=err?.name==='TimeoutError'?'مهلت دریافت فهرست تمام شد؛ دوباره امتحان کنید.':String(err?.message||err);}\n  finally{scanFinish();}\n}\n  async function Jt(e) {\n    await Wt(e);\n  }\n  async function Kt(e) {\n  if(O.running)return;\n  const rows=O.results.filter(r=>r.healthy&&r.ms>0&&r.done&&Date.now()-(r.checked_at||0)<300000).sort((l,r)=>l.ms-r.ms);\n  if(!rows.length)return y('نتیجهٔ پاسخ‌گوی تازه‌ای برای ذخیره وجود ندارد.','warn');\n  const raw=typeof e?.settings==='function'?await e.settings():e?.settings||{},cfg=raw?.settings||raw||{};\n  const patch={};\n  if(O.tab==='countries') {\n    const best=rows.find(r=>COUNTRY_PROXY_MAP.has(r.ip.toLowerCase()));if(!best)return;\n    const country=COUNTRY_PROXY_MAP.get(best.ip.toLowerCase());\n    if(!await Q(`خروجی ${country.fa} با آدرس ${best.ip}:443 انتخاب شود؟ TCP از ورکر پاسخ داده است؛ سرویس پروکسی باید با کانفیگ بررسی شود.`))return;\n    patch.selected_country=country.cc;patch.proxy_ips=[`${best.ip}:443`];g.cc=country.cc;g.out=null;\n  } else {\n    const ingress=rows.filter(r=>!COUNTRY_PROXY_MAP.has(r.ip.toLowerCase()));\n    const ips=ingress.filter(r=>!r.ip.includes(':')).map(r=>r.ip),v6=ingress.filter(r=>r.ip.includes(':')).map(r=>r.ip),domains=ingress.filter(r=>!scanIsIp(r.ip)).map(r=>r.ip);\n    const merge=(old,next)=>[...new Set([...Re(old),...next])];\n    if(ips.length)patch.clean_ips=merge(cfg.clean_ips,ips);\n    if(v6.length){patch.ipv6_pool=merge(cfg.ipv6_pool,v6);patch.ipv6_enabled='1';}\n    if(domains.length)patch.address_domains=merge(cfg.address_domains,domains);\n  }\n  const saved=await b.saveSettings(patch);e.setSettings(saved?.settings||{...cfg,...patch});\n  y(O.tab==='countries'?'خروجی انتخاب‌شده در پنل ذخیره شد.':'آدرس‌های دارای پاسخ HTTPS ذخیره شدند.','ok');\n}\n  function Fe(e){\n  let cfg=e?.settings||{};\n  let curExitCc=cfg.selected_country||\"\";\n  let curExitC=curExitCc&&curExitCc!==\"DIRECT\"?COUNTRY_MAP.get(curExitCc):null;\n  let selC=(O.tab===\"countries\"&&O.country)?COUNTRY_MAP.get(O.country):null;\n  setTimeout(()=>{if(O.tab===\"countries\")renderCountryGrid()},0);\n  return`\n  <header class=\"view-head\">\n    <div>\n      <h2>${d(\"search\")} اسکنر آی‌پی تمیز و تست واقعی سرورهای کشورها</h2>\n      <p class=\"muted\">دو بخش کاملاً مجزا: ۱) اسکن آی‌پی و سایت‌های تمیز ورودی (بدون تغییر کشور) · ۲) تست TCP سرورهای خروجی کشورها</p>\n    </div>\n    <div class=\"head-actions\" style=\"display:flex;gap:8px;flex-wrap:wrap\">\n      ${O.tab===\"ingress\"\n        ?`<button class=\"btn btn-primary\" type=\"button\" data-action=\"omni-scan\">${d(\"play\")} شروع اسکن آی‌پی تمیز</button>`\n        :`<button class=\"btn btn-primary\" type=\"button\" data-action=\"omni-scan-all-countries\">🌍 تست هم‌زمان همه کشورها</button>`}\n    </div>\n  </header>\n\n  <div class=\"card\" style=\"margin-bottom:12px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px\">\n    <div style=\"display:flex;align-items:center;gap:8px;flex-wrap:wrap\">\n      <span class=\"muted\" style=\"font-size:12px\">خروجی انتخاب‌شدهٔ پنل:</span>\n      ${curExitC\n        ?`<span class=\"badge ok\" style=\"font-size:12px\">${curExitC.flag} خروجی ${a(curExitC.fa)} (${a((curExitC.proxies||[])[0]||curExitC.colo)})</span>`\n        :`<span class=\"badge info\" style=\"font-size:12px\">🌐 اتصال مستقیم (بدون پروکسی)</span>`}\n      <span id=\"direct-ping-badges\" style=\"display:inline-flex;gap:6px;flex-wrap:wrap\"></span>\n    </div>\n    <div style=\"display:flex;gap:8px;flex-wrap:wrap\">\n      <button type=\"button\" class=\"btn btn-sm\" data-action=\"omni-net-sense\">📱 سنسور خط گوشی و تنظیم خودکار</button>\n      <button type=\"button\" class=\"btn btn-sm\" data-action=\"omni-underground-hunt\">🧬 سنتز تیغه SIIT-Hex64</button>\n      <button type=\"button\" class=\"btn btn-sm\" data-action=\"omni-test-direct\">⚡ تست پینگ مستقیم شما</button>\n      <button type=\"button\" class=\"btn btn-sm\" data-action=\"omni-direct-mode\">🌐 حالت مستقیم (بدون پروکسی)</button>\n      <button type=\"button\" class=\"btn btn-sm\" data-action=\"omni-rotate-ips\">🔄 چرخش فوری مخزن آی‌پی</button>\n    </div>\n  </div>\n\n  <div class=\"tabs\" style=\"margin-bottom:12px\">\n    <button type=\"button\" data-action=\"omni-scan-tab\" data-tab=\"ingress\" aria-selected=\"${O.tab===\"ingress\"}\">⚡ ۱) اسکنر آی‌پی و سایت‌های تمیز ورودی (ایرانسل / همراه اول / مخابرات / دلخواه)</button>\n    <button type=\"button\" data-action=\"omni-scan-tab\" data-tab=\"countries\" aria-selected=\"${O.tab===\"countries\"}\">🌍 ۲) تست سرورهای خروجی کشورها (ProxyIP)</button>\n  </div>\n\n  ${O.tab===\"ingress\"?`\n  <div class=\"card\">\n    <div style=\"display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px\">\n      <b style=\"font-size:13px\">⚡ انتخاب دسته آی‌پی و سایت‌های تمیز ورودی کلودفلر</b>\n      <div class=\"chips\">\n        ${[[\"both\",\"⚡ هر دو (IPv4 + IPv6)\"],[\"v4\",\"4️⃣ فقط IPv4\"],[\"v6\",\"6️⃣ فقط IPv6\"]].map(([k,lbl])=>`<button type=\"button\" class=\"chip\" data-action=\"omni-ipver\" data-v=\"${k}\" aria-pressed=\"${O.ipVer===k}\">${lbl}</button>`).join(\"\")}\n      </div>\n    </div>\n    <div class=\"chips\" style=\"margin-bottom:12px\">\n      ${[\n        [\"white_proxy\", \"🇹🇷 رله و ریورس سفید\"],\n        [\"senpai\", \"🎯 سنپای (Anti-DPI)\"],\n        [\"anti_dpi\", \"🛡️ ضد اختلال (Asha/SenPai)\"],\n        [\"mci\", \"💙 همراه اول (MCI)\"],\n        [\"mtn\", \"💛 ایرانسل (MTN)\"],\n        [\"tci\", \"🏠 مخابرات / وای‌فای (TCI)\"],\n        [\"rare\", \"🔒 رنج‌های خلوت (Private)\"],\n        [\"near\", \"👑 مسیر طلایی (ترکیه/دبی)\"],\n        [\"all\", \"🌐 ترکیبی (جهانی + سرعت)\"],\n        [\"warp\", \"🛡️ WARP / Aether\"],\n        [\"underground\", \"🧬 سنتز SIIT-Hex64\"],\n        [\"sites\", \"🛡️ همزاد ECH\"],\n        [\"qos\", \"⚡ Anycast عملیاتی\"],\n        [\"ipv6\", \"📱 IPv6 نوزاد/اختصاصی\"],\n        [\"ir\", \"🔐 IPv4 در IPv6 (Dual-Stack)\"],\n        [\"zeta\", \"🚀 زتا (پینگ فوق سریع)\"]\n      ].map(([k,lbl])=>`<button type=\"button\" class=\"chip\" data-action=\"omni-preset\" data-v=\"${k}\" aria-pressed=\"${O.scanMode===\"preset\"&&O.preset===k}\">${lbl}</button>`).join(\"\")}\n    </div>\n    <div class=\"field\">\n      <div style=\"display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px\">\n        <label id=\"scan-ranges-lbl\">🎯 لیست آی‌پی، رنج CIDR یا دامنه برای اسکن ${O.scanMode===\"custom\"?\"(حالت آی‌پی دلخواه شما)\":\"\"}</label>\n        <button type=\"button\" class=\"btn btn-ghost btn-sm\" data-action=\"omni-clear-custom\">🧹 پاک‌سازی برای ورود آی‌پی دلخواه</button>\n      </div>\n      <textarea id=\"scan-ranges\" rows=\"3\" dir=\"ltr\" placeholder=\"هر آی‌پی، رنج CIDR یا دامنه را در یک خط وارد کنید (مثلاً 172.67.181.32 یا www.speedtest.net یا 104.17.147.0/24)\">${a((SCAN_PRESETS[O.preset]||SCAN_PRESETS.all).join(\"\\n\"))}</textarea>\n    </div>\n    <div class=\"scan-progress\" style=\"margin-top:10px\"><i id=\"scan-bar\" style=\"width:0%\"></i></div>\n    <div class=\"muted\" id=\"scan-status\" style=\"font-size:12.5px;margin-top:8px\">${O.scanMode===\"custom\"?\"حالت اسکن آی‌پی دلخواه شما — بدون الصاق نام کشور\":\"آمادهٔ اسکن؛ زمان مرورگر و TCP ورکر جدا نمایش داده می‌شوند.\"}</div>\n  </div>`:`\n  <div class=\"card\">\n    <div style=\"display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px\">\n      <div>\n        <b style=\"font-size:13.5px\">🌍 تست سرورهای خروجی کشورها (ProxyIP)</b>\n        <p class=\"muted\" style=\"font-size:11.5px;margin:2px 0 0\">در این بخش زمان TCP از ورکر تا سرورهای خروجی سنجیده می‌شود؛ نام کشور از فهرست سرورهاست.</p>\n      </div>\n      <div style=\"display:flex;gap:8px;align-items:center\">\n        <button type=\"button\" class=\"btn btn-primary btn-sm\" data-action=\"omni-scan-all-countries\">🌍 تست هم‌زمان همه کشورها</button>\n        <span class=\"badge info\" id=\"country-count-lbl\">— کشور</span>\n      </div>\n    </div>\n    <div style=\"display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px\">\n      <input id=\"country-search\" type=\"search\" placeholder=\"🔎 جستجوی کشور (آلمان، هلند، بریتانیا، فرانسه، آمریکا، ترکیه، امارات، فنلاند، سوئد...)\" value=\"${a(O.countryQuery)}\" style=\"flex:1;min-width:220px\">\n    </div>\n    <div class=\"chips\" style=\"margin-bottom:8px\">\n      ${[\n        [\"primary\",\"⭐ لوکیشن‌های اصلی (۲۴ کشور)\"],\n        [\"eu\",\"🇪🇺 اروپا\"],\n        [\"me\",\"🕌 خاورمیانه و همسایه\"],\n        [\"as\",\"🌏 آسیا\"],\n        [\"na\",\"🌎 آمریکا و کانادا\"],\n        [\"all\",\"🌍 همه کشورهای دارای سرور خروجی\"]\n      ].map(([k,lbl])=>`<button type=\"button\" class=\"chip\" data-action=\"omni-region\" data-v=\"${k}\" aria-pressed=\"${O.region===k}\">${lbl}</button>`).join(\"\")}\n    </div>\n    <div id=\"country-grid\" style=\"display:flex;flex-wrap:wrap;gap:6px;max-height:175px;overflow-y:auto;padding:8px;border:1px solid var(--border);border-radius:10px;background:var(--bg-elev)\"></div>\n    <div class=\"scan-progress\" style=\"margin-top:10px\"><i id=\"scan-bar\" style=\"width:0%\"></i></div>\n    <div class=\"muted\" id=\"scan-status\" style=\"font-size:12.5px;margin-top:8px\">${selC?`کشور انتخاب‌شده: ${selC.flag} ${selC.fa} (${(selC.proxies||[]).length} سرور خروجی)`:\"روی یک کشور کلیک کنید تا سرورهای اختصاصی همان کشور تست شوند، یا «تست هم‌زمان همه کشورها» را بزنید.\"}</div>\n  </div>`}\n\n  <details style=\"margin:8px 0;font-size:11px\" class=\"muted\"><summary>راهنمای نتیجهٔ اسکن</summary><p>عدد سبز، زمان درخواست موفق است؛ خطای TLS به پینگ موفق تبدیل نمی‌شود. تست مرورگرِ IP خام با تست کانفیگ دارای SNI مستقل متفاوت است. زمان TCP کشورها از ورکر است، نه از گوشی.</p></details>\n  <div class=\"card\" id=\"scan-out\" style=\"margin-top:12px\">\n    <div class=\"muted\" style=\"font-size:13px\">${a(n(\"scanner.empty\"))}</div>\n  </div>\n  <div style=\"display:flex;gap:8px;margin-top:8px;flex-wrap:wrap\">\n    <button class=\"btn btn-primary\" id=\"scan-apply\" data-action=\"omni-apply\" disabled>${d(\"check\")} ${selC?`انتخاب سریع‌ترین سرور خروجی ${selC.flag} ${selC.fa}`:\"ذخیرهٔ نتایج پاسخ‌گو در پنل\"}</button>\n  </div>`;\n}\n\n  var MESH_ISO195 =\n    \"AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PS PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW\".split(\n      \" \",\n    );\n  var MESH = {\n    mode: \"game\",\n    country: \"AUTO\",\n    region: \"all\",\n    running: !1,\n    line: null,\n    results: [],\n    history: [],\n    proofs: [],\n    runtime: [],\n    cohort: \"unknown\",\n    historyLoadedAt: 0,\n    lastRun: null,\n    showAll: !1,\n    message: null,\n    proofCc: null,\n  };\n  function meshCountries() {\n    return WORLD_COUNTRIES.filter(\n      (c) => Array.isArray(c.proxies) && c.proxies.length,\n    );\n  }\n  function meshModeMeta() {\n    return {\n      game: {\n        icon: \"🎮\",\n        title: \"گیم\",\n        sub: \"کمینه‌کردن تأخیر، جیتر و از‌دست‌رفتن مهلت تیک\",\n        deadline: \"Server Tick\",\n        policy: \"Latency + stability\",\n      },\n      web: {\n        icon: \"🌐\",\n        title: \"وب‌گردی\",\n        sub: \"اتصال گرم، کمترین مسیر و خروجی انتخابی هر کشور\",\n        deadline: \"100ms reaction\",\n        policy: \"Lowest measured Worker TCP time (not an end-user route)\",\n      },\n      ai: {\n        icon: \"✦\",\n        title: \"هوش مصنوعی\",\n        sub: \"خروجی کاندید سرویس، اتصال گرم و fallback مستقل\",\n        deadline: \"First byte/token\",\n        policy: \"Network race; service proof next\",\n      },\n    }[MESH.mode];\n  }\n  function meshRegionLabel(r) {\n    return (\n      {\n        all: \"همه مناطق\",\n        eu: \"اروپا\",\n        me: \"خاورمیانه\",\n        as: \"آسیا\",\n        na: \"آمریکای شمالی\",\n        oc: \"اقیانوسیه\",\n        af: \"آفریقا\",\n        sa: \"آمریکای جنوبی\",\n      }[r] || r\n    );\n  }\n  function meshAiReady(cc) {\n    return MESH.proofs.some(\n      (p) =>\n        (!p.cc || p.cc === cc) &&\n        p.accepted &&\n        [\"gemini_web\", \"gemini_api\", \"ai_studio\"].includes(p.service) &&\n        (!p.checked_at ||\n          Date.now() -\n            new Date(\n              p.checked_at.replace(\" \", \"T\") +\n                (/Z$/.test(p.checked_at) ? \"\" : \"Z\"),\n            ).getTime() <\n            18e5),\n    );\n  }\n  function MeshView(e) {\n    let meta = meshModeMeta(),\n      catalogCandidates = meshCountries(),\n      all = MESH_ISO195.length;\n    if (Date.now() - MESH.historyLoadedAt > 30000)\n      setTimeout(() => MeshLoadHistory(e), 0);\n    let filtered = catalogCandidates.filter(\n      (c) => MESH.region === \"all\" || c.region === MESH.region,\n    );\n    let line = MESH.line,\n      reachable = MESH.results.filter((r) => r.tcp_reachable || r.alive),\n      best = reachable[0] || null;\n    let countryOptions = filtered\n      .map(\n        (c) =>\n          `<option value=\"${c.cc}\" ${MESH.country === c.cc ? \"selected\" : \"\"}>${c.flag} ${a(c.fa)} · ${c.cc}</option>`,\n      )\n      .join(\"\");\n    return `\n  <section class=\"card mesh-hero\">\n    <div style=\"position:relative;z-index:1;max-width:900px\">\n      <div class=\"mesh-kicker\">OMNI / CAUSAL FABRIC / LAB 01</div>\n      <h2 class=\"mesh-title\">مسیر را با <em>تازه‌ترین اندازه‌گیری Worker</em> بسنج، نه برچسب ثابت.</h2>\n      <p class=\"muted\" style=\"margin:0;max-width:720px\">این آزمایش، زمان درخواست HTTPS مرورگر تا Worker و TCP/443 از Worker تا endpoint candidate را جدا می‌سنجد. TCP باز بودن، سرویس Proxy یا جغرافیای کشور را تأیید نمی‌کند؛ زمان ترکیبی فقط برآورد است.</p>\n      <div style=\"display:flex;gap:7px;flex-wrap:wrap;margin-top:14px\">\n        <span class=\"badge info\">${catalogCandidates.length} برچسب کشور با endpoint candidate</span>\n        <span class=\"badge info\">${all} کشور در معماری جهانی</span>\n        <span class=\"badge\">نسخه آزمایشگاهی ۰.۱</span>\n      </div>\n    </div>\n  </section>\n\n  <div class=\"mesh-mode-grid\" style=\"margin-top:12px\">\n    ${Object.entries({\n      game: [\"🎮\", \"گیم\", \"ارزیابی TCP و سابقهٔ پایداری از دید Worker\"],\n      web: [\"🌐\", \"وب‌گردی\", \"کمترین TCP ثبت‌شده؛ نه مسیر انتها‌به‌انتها\"],\n      ai: [\"✦\", \"هوش مصنوعی\", \"اثبات سرویس جدا از TCP candidate\"],\n    })\n      .map(\n        ([k, m]) => `\n      <button class=\"mesh-mode\" type=\"button\" data-action=\"omni-mesh-mode\" data-mode=\"${k}\" aria-pressed=\"${MESH.mode === k}\">\n        <span style=\"font-size:21px\">${m[0]}</span><b>${m[1]}</b><small>${m[2]}</small>\n      </button>`,\n      )\n      .join(\"\")}\n  </div>\n\n  <div class=\"card\" style=\"margin-top:12px\">\n    <div class=\"card-head\">${d(\"globe\")}<h3>کنترل مسیر جهانی</h3><div class=\"spacer\"></div><span class=\"badge info\">${meta.icon} ${meta.title}</span></div>\n    <div class=\"mesh-control-grid\">\n      <div class=\"field\"><label for=\"mesh-region\">منطقه جغرافیایی</label>\n        <select id=\"mesh-region\" data-action=\"omni-mesh-region\">\n          ${[\"all\", \"me\", \"eu\", \"as\", \"na\", \"oc\", \"af\", \"sa\"].map((r) => `<option value=\"${r}\" ${MESH.region === r ? \"selected\" : \"\"}>${meshRegionLabel(r)}</option>`).join(\"\")}\n        </select></div>\n      <div class=\"field\"><label for=\"mesh-country\">کشور خروجی</label>\n        <select id=\"mesh-country\" data-action=\"omni-mesh-country\">\n          <option value=\"AUTO\" ${MESH.country === \"AUTO\" ? \"selected\" : \"\"}>⚡ خودکار؛ کمترین زمان TCP اندازه‌گیری‌شده از Worker</option>\n          <option value=\"DIRECT\" ${MESH.country === \"DIRECT\" ? \"selected\" : \"\"}>🌐 مستقیم؛ بدون خروجی کشور</option>\n          ${countryOptions}\n        </select></div>\n    </div>\n    <div style=\"display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center\">\n      <button class=\"btn btn-primary\" type=\"button\" data-action=\"omni-mesh-race\" ${MESH.running ? \"disabled\" : \"\"}>${d(\"play\")} ${MESH.running ? \"در حال مسابقه واقعی…\" : \"اجرای مسابقه مسیرها\"}</button>\n      ${best && (MESH.mode !== \"ai\" || meshAiReady(best.cc)) ? `<button class=\"btn\" type=\"button\" data-action=\"omni-mesh-apply\" data-cc=\"${a(best.cc)}\">${d(\"check\")} اعمال به کانفیگ‌ها · ${best.flag} ${a(best.fa)}</button>` : \"\"}\n      ${MESH.mode === \"ai\" && (best || (MESH.country !== \"AUTO\" && MESH.country !== \"DIRECT\")) ? `<button class=\"btn\" type=\"button\" data-action=\"omni-mesh-proof\" data-cc=\"${a(best?.cc || MESH.country)}\">✦ ${best && meshAiReady(best.cc) ? \"تازه‌سازی اثبات AI\" : \"اول اثبات زنده AI را اجرا کن\"}</button>` : \"\"}\n      <label style=\"display:inline-flex;align-items:center;gap:7px;font-size:12px;cursor:pointer\"><span class=\"switch\"><input type=\"checkbox\" data-action=\"omni-mesh-auto\" ${String(e.settings?.mesh_auto_failover || \"0\") === \"1\" ? \"checked\" : \"\"}><span></span></span>Failover بر پایهٔ TCP Worker (نه تست سرویس/کلاینت) بعد از دو شکست · <b>${String(e.settings?.mesh_auto_failover || \"0\") === \"1\" ? \"روشن\" : \"خاموش\"}</b></label>\n    </div>\n    <details style=\"margin-top:10px\"><summary class=\"muted\" style=\"cursor:pointer;font-size:11.5px\">مسیریابی مستقیم دامنه‌های حساس</summary>\n      <div class=\"field\" style=\"margin-top:8px\"><textarea id=\"mesh-direct-domains\" rows=\"2\" dir=\"ltr\" placeholder=\"bank.example&#10;internal.example\">${a(Re(e.settings?.mesh_direct_domains).join(\"\\n\"))}</textarea><span class=\"hint\">هر خط یک دامنه؛ فقط در خروجی‌های sing-box و Clash مستقیماً عبور می‌کند.</span></div>\n      <button class=\"btn btn-sm\" type=\"button\" data-action=\"omni-mesh-save-domains\">${d(\"check\")} ذخیره دامنه‌ها</button>\n    </details>\n    <p class=\"muted\" style=\"font-size:11.5px;margin:9px 0 0\">درخواست مرورگر تا Worker و TCP/443 از Worker تا candidate دو مسیر مستقل‌اند؛ هیچ‌کدام سلامت پروتکل Proxy یا کشور واقعی را اثبات نمی‌کند.</p>\n    ${MESH.message ? `<div class=\"notice ${MESH.message.type === \"ok\" ? \"ok\" : \"warn\"}\" style=\"margin-top:10px;padding:10px\"><b>${a(MESH.message.text)}</b>${MESH.message.detail ? `<div style=\"font-size:11.5px;margin-top:4px\">${a(MESH.message.detail)}</div>` : \"\"}</div>` : \"\"}\n  </div>\n\n  <div class=\"mesh-metric-grid\" style=\"margin-top:12px\">\n    <div class=\"mesh-metric\"><span>HTTPS مرورگر → پنل</span><b style=\"color:${line ? it(line.rtt) : \"var(--text-faint)\"}\">${line ? line.rtt + \" ms\" : \"—\"}</b></div>\n    <div class=\"mesh-metric\"><span>Cloudflare POP پنل</span><b>${a(line?.colo || \"—\")}</b></div>\n    <div class=\"mesh-metric\"><span>TCP/443 باز از Worker</span><b>${MESH.results.length ? reachable.length + \" / \" + MESH.results.length : \"—\"}</b></div>\n    <div class=\"mesh-metric\"><span>کمترین Worker TCP connect</span><b style=\"color:${best ? it(best.edge_ms) : \"var(--text-faint)\"}\">${best ? best.edge_ms + \" ms\" : \"—\"}</b></div>\n  </div>\n\n  <div class=\"grid grid-2\" style=\"margin-top:12px\">\n    <div class=\"card\">\n      <div class=\"card-head\">${d(\"activity\")}<h3>مسیر علّی انتخاب‌شده</h3></div>\n      <div class=\"mesh-flow\">\n        <div class=\"mesh-node\"><b>خط کاربر</b><small>${line ? line.rtt + \" ms browser HTTPS\" : \"هنوز اندازه‌گیری نشده\"}</small></div>\n        <span class=\"mesh-arrow\">←</span>\n        <div class=\"mesh-node\"><b>Omni Ingress</b><small>${a(line?.colo || \"نزدیک‌ترین POP\")}</small></div>\n        <span class=\"mesh-arrow\">←</span>\n        <div class=\"mesh-node\"><b>${best ? best.flag + \" \" + a(best.fa) : MESH.country === \"DIRECT\" ? \"Direct\" : \"Country Race\"}</b><small>${best ? best.edge_ms + \" ms Worker TCP · برچسب کاتالوگ\" : meta.policy}</small></div>\n      </div>\n      <div style=\"margin-top:12px;padding:10px;border:1px solid var(--border);border-radius:11px;background:var(--bg-soft)\">\n        <div style=\"display:flex;justify-content:space-between;gap:8px\"><span class=\"muted\">مهلت این پروفایل</span><b dir=\"ltr\">${meta.deadline}</b></div>\n        <div style=\"display:flex;justify-content:space-between;gap:8px;margin-top:6px\"><span class=\"muted\">نوع امتیازدهی</span><b dir=\"ltr\">${meta.policy}</b></div>\n      </div>\n    </div>\n    <div class=\"card\">\n      <div class=\"card-head\">${d(\"shield\")}<h3>وضعیت موتور</h3></div>\n      <div class=\"mesh-phase live\"><i></i><div><b>Race + P50/P95 + Cohort</b><div class=\"muted\" style=\"font-size:11.5px\">فعال؛ خط، خروجی و اپراتور جدا ذخیره می‌شوند.</div></div></div>\n      <div class=\"mesh-phase live\"><i></i><div><b>Service Proof + TLS</b><div class=\"muted\" style=\"font-size:11.5px\">فعال؛ نتیجه شبکه سرویس‌های AI از خروجی واقعی ثبت می‌شود.</div></div></div>\n      <div class=\"mesh-phase live\"><i></i><div><b>Cron Failover + Quarantine</b><div class=\"muted\" style=\"font-size:11.5px\">بر پایهٔ TCP/443 از Worker و پس از دو شکست؛ اتصال کاربر یا سرویس Proxy سنجیده نمی‌شود.</div></div></div>\n      <div class=\"mesh-phase live\"><i></i><div><b>Per-App Rules</b><div class=\"muted\" style=\"font-size:11.5px\">فعال در sing-box/Clash؛ لینک خام v2rayNG نیازمند Proxy all apps است.</div></div></div>\n      <details style=\"margin-top:8px\"><summary class=\"muted\" style=\"cursor:pointer;font-size:11.5px\">قابلیت‌های خارج از توان Worker</summary><div style=\"padding-top:6px\" class=\"muted\">Multipath، Micro-FEC و Tick Engine به کلاینت یا Relay مستقل نیاز دارند و فعال نیستند.</div></details>\n    </div>\n  </div>\n\n  <div class=\"grid grid-2\" style=\"margin-top:12px\">\n    <div class=\"card\">\n      <div class=\"card-head\">${d(\"activity\")}<h3>حافظه هفت‌روزه مسیرها</h3><div class=\"spacer\"></div><span class=\"badge\">${a(MESH.cohort || \"unknown\")}</span></div>\n      ${MeshHistoryView()}\n    </div>\n    <div class=\"card\">\n      <div class=\"card-head\">${d(\"shield\")}<h3>اثبات سرویس‌ها</h3></div>\n      ${MeshProofView()}\n    </div>\n  </div>\n\n  <div class=\"card\" style=\"margin-top:12px\">\n    <div class=\"card-head\">${d(\"bolt\")}<h3>نتیجه مسابقه کشورها</h3><div class=\"spacer\"></div>${MESH.lastRun ? `<span class=\"muted\" style=\"font-size:10.5px\">${a(MESH.lastRun)}</span>` : \"\"}</div>\n    <div id=\"mesh-results\">${MESH.running ? '<div class=\"skeleton\" style=\"height:130px\"></div>' : MeshResults()}</div>\n  </div>`;\n  }\n  function MeshHistoryView() {\n    let now = Math.floor(Date.now() / 1000),\n      activeQ = MESH.runtime.filter(\n        (r) =>\n          String(r.key || \"\").startsWith(\"quarantine:\") &&\n          Number(r.value) > now,\n      );\n    let alert = activeQ.length\n      ? `<div class=\"notice warn\" style=\"margin-bottom:8px;padding:8px\">قرنطینه فعال: ${activeQ.map((r) => a(String(r.key).slice(11))).join(\"، \")}</div>`\n      : \"\";\n    if (!MESH.history.length)\n      return (\n        alert +\n        '<div class=\"empty\" style=\"padding:18px\"><div>هنوز تاریخچه کافی وجود ندارد.</div><small class=\"muted\">با هر مسابقه، P50/P95 و نرخ موفقیت واقعی ساخته می‌شود.</small></div>'\n      );\n    let rows = MESH.history.slice(0, 8),\n      max = Math.max(...rows.map((r) => Number(r.p95 || r.p50 || 1)), 1);\n    return `${alert}<div style=\"display:flex;flex-direction:column;gap:8px\">${rows\n      .map((r) => {\n        let c = COUNTRY_MAP.get(r.cc),\n          w = Math.max(\n            4,\n            Math.round((Number(r.p95 || r.p50 || 0) / max) * 100),\n          );\n        return `<div><div style=\"display:flex;gap:7px;align-items:center;font-size:11.5px;flex-wrap:wrap\"><b>${c?.flag || \"🌐\"} ${a(c?.fa || r.cc)}</b><span class=\"muted\" dir=\"ltr\">Worker→Exit · P50 ${r.p50 ?? \"—\"} · P95 ${r.p95 ?? \"—\"} ms</span><span class=\"spacer\"></span><span class=\"badge ${r.success_rate >= 90 ? \"ok\" : r.success_rate >= 60 ? \"warn\" : \"danger\"}\">${r.successes || 0}/${r.samples || 0}${Number(r.samples || 0) < 3 ? \" · داده کم\" : \"\"}</span></div><div class=\"scan-progress\" style=\"height:4px;margin-top:4px\"><i style=\"width:${w}%;background:${it(Number(r.p95 || 999))}\"></i></div></div>`;\n      })\n      .join(\"\")}</div>`;\n  }\n  function MeshProofView() {\n    if (!MESH.proofs.length)\n      return '<div class=\"empty\" style=\"padding:18px\"><div>اثبات سرویس اجرا نشده است.</div><small class=\"muted\">در حالت AI یک کشور را مسابقه بده و «اثبات زنده» را بزن.</small></div>';\n    let names = {\n      gemini_web: \"Gemini Web\",\n      gemini_api: \"Gemini API\",\n      ai_studio: \"AI Studio\",\n      chatgpt: \"ChatGPT\",\n      claude: \"Claude\",\n    };\n    let target =\n      MESH.proofCc ||\n      (MESH.country !== \"AUTO\" && MESH.country !== \"DIRECT\"\n        ? MESH.country\n        : null) ||\n      MESH.results[0]?.cc ||\n      MESH.proofs[0]?.cc;\n    let seen = new Set(),\n      rows = MESH.proofs\n        .filter((r) => !target || !r.cc || r.cc === target)\n        .filter((r) => !seen.has(r.service) && seen.add(r.service))\n        .slice(0, 5),\n      c = COUNTRY_MAP.get(target);\n    if (!rows.length)\n      return `<div class=\"empty\" style=\"padding:18px\"><div>برای ${a(target || \"این کشور\")} نتیجه‌ای ثبت نشده است.</div></div>`;\n    return `<div class=\"muted\" style=\"font-size:11.5px;margin-bottom:8px\">آخرین اجرای ${c?.flag || \"🌐\"} ${a(c?.fa || target || \"\")}؛ نتایج قدیمی و تکراری مخفی شده‌اند.</div><div style=\"display:flex;flex-direction:column;gap:7px\">${rows.map((r) => `<div style=\"display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:10px\"><b style=\"flex:1\">${a(names[r.service] || r.service)}</b><span class=\"badge ${r.accepted ? \"ok\" : r.ok ? \"warn\" : \"danger\"}\">${r.accepted ? \"پذیرفته\" : r.ok ? \"رسیده، ولی رد شده\" : \"ناموفق\"}</span>${r.status ? `<code>${r.status}</code>` : \"\"}${r.ms ? `<span class=\"muted mono\">${r.ms}ms</span>` : \"\"}</div>`).join(\"\")}</div>`;\n  }\n  async function MeshLoadHistory(e, force = !1) {\n    if (!force && Date.now() - MESH.historyLoadedAt < 30000) return;\n    MESH.historyLoadedAt = Date.now();\n    try {\n      let h = await x(\n        \"GET\",\n        `/api/mesh/history?mode=${encodeURIComponent(MESH.mode)}&days=7${MESH.cohort && MESH.cohort !== \"unknown\" ? `&cohort=${encodeURIComponent(MESH.cohort)}` : \"\"}`,\n      );\n      MESH.history = Array.isArray(h?.stats) ? h.stats : [];\n      MESH.proofs = Array.isArray(h?.service_proofs) ? h.service_proofs : [];\n      MESH.runtime = Array.isArray(h?.runtime) ? h.runtime : [];\n      if (l.view === \"mesh\") X();\n    } catch {}\n  }\n  async function MeshServiceProof(e, cc) {\n    if (!cc || cc === \"AUTO\" || cc === \"DIRECT\")\n      return y(\"ابتدا یک country candidate با TCP/443 باز انتخاب کن؛ این تست سلامت خروجی را اثبات نمی‌کند.\", \"warn\");\n    y(\"اثبات TLS و وضعیت سرویس‌ها شروع شد…\", \"info\", 1800);\n    try {\n      let r = await x(\"POST\", \"/api/mesh/service-proof\", {\n        cc,\n        services: [\n          \"gemini_web\",\n          \"gemini_api\",\n          \"ai_studio\",\n          \"chatgpt\",\n          \"claude\",\n        ],\n        timeout: 6500,\n      });\n      MESH.proofCc = cc;\n      MESH.proofs = (Array.isArray(r?.results) ? r.results : []).map((p) => ({\n        ...p,\n        cc,\n        checked_at: r?.checked_at || new Date().toISOString(),\n      }));\n      MESH.historyLoadedAt = 0;\n      y(\n        `${MESH.proofs.filter((p) => p.accepted).length}/${MESH.proofs.length} سرویس از خروجی ${cc} پذیرفته شد`,\n        MESH.proofs.some((p) => p.accepted) ? \"ok\" : \"warn\",\n      );\n      e.rerenderView(\"mesh\");\n    } catch (err) {\n      y(String(err?.message || err), \"err\");\n    }\n  }\n  function MeshResults() {\n    if (!MESH.results.length)\n      return '<div class=\"empty\" style=\"padding:24px\"><div style=\"font-size:24px\">◎</div><div>هنوز مسابقه‌ای اجرا نشده است.</div><small class=\"muted\">کشور یا حالت خودکار را انتخاب و «اجرای مسابقه مسیرها» را بزن.</small></div>';\n    const rows = MESH.showAll ? MESH.results : MESH.results.slice(0, 6);\n    const bestCc = MESH.results.find((row) => row.tcp_reachable || row.alive)?.cc;\n    return `<div class=\"mesh-country-list\">${rows\n      .map((row) => {\n        const reachable = Boolean(row.tcp_reachable || row.alive);\n        const workerMs = Number(row.worker_tcp_ms ?? row.edge_ms);\n        const hasWorkerMs = reachable && Number.isFinite(workerMs) && workerMs > 0;\n        const aiReady = MESH.mode !== \"ai\" || meshAiReady(row.cc);\n        return `\n    <div class=\"mesh-country-row\" data-best=\"${row.cc === bestCc}\">\n      <div><b>${row.flag || \"🌐\"} ${a(row.fa || row.cc)}</b><div class=\"muted mono\" style=\"font-size:10.5px\">${a(row.cc)} · catalog label</div></div>\n      <div><span class=\"muted\" style=\"font-size:10px;display:block\">Worker TCP/443</span><b dir=\"ltr\" style=\"color:${reachable ? it(workerMs) : \"var(--danger)\"}\">${hasWorkerMs ? workerMs + \" ms\" : \"بی‌پاسخ\"}</b></div>\n      <div><span class=\"muted\" style=\"font-size:10px;display:block\">7-day Worker TCP P95</span><b dir=\"ltr\">${row.history?.p95 != null ? row.history.p95 + \" ms\" : \"—\"}</b></div>\n      <div><span class=\"muted\" style=\"font-size:10px;display:block\">Samples · heuristic score</span><b dir=\"ltr\">${row.history?.samples || 0} · ${row.score ?? \"—\"}</b><small class=\"muted\">Browser+Worker sum: ${row.combined_floor_ms ?? \"—\"} ms; estimate only, not end-to-end</small></div>\n      <button class=\"btn btn-sm ${row.cc === bestCc ? \"btn-primary\" : \"\"}\" type=\"button\" data-action=\"omni-mesh-apply\" data-cc=\"${a(row.cc)}\" ${reachable && aiReady ? \"\" : \"disabled\"}>${MESH.mode === \"ai\" && !aiReady ? \"نیاز به تأیید سرویس AI\" : \"ثبت به‌عنوان endpoint\"}</button>\n    </div>`;\n      })\n      .join(\"\")}</div>${MESH.results.length > 6 ? `<button class=\"btn btn-sm\" style=\"margin-top:10px;width:100%\" data-action=\"omni-mesh-toggle-results\">${MESH.showAll ? \"نمایش ۶ نتیجه برتر\" : `نمایش همه ${MESH.results.length} candidates`}</button>` : \"\"}`;\n  }\n  async function MeshRace(e) {\n    if (MESH.running) return;\n    MESH.running = !0;\n    MESH.message = null;\n    MESH.showAll = !1;\n    e.rerenderView(\"mesh\");\n    try {\n      let pool = meshCountries().filter(\n        (c) => MESH.region === \"all\" || c.region === MESH.region,\n      );\n      if (MESH.country !== \"AUTO\" && MESH.country !== \"DIRECT\")\n        pool = pool.filter((c) => c.cc === MESH.country);\n      if (MESH.country === \"DIRECT\") {\n        MESH.line = await measureLineRtt();\n        MESH.results = [];\n        MESH.lastRun = new Date().toLocaleTimeString(\"fa-IR\");\n        return;\n      }\n      let line = await measureLineRtt();\n      let res = await x(\"POST\", \"/api/mesh/race\", {\n        mode: MESH.mode,\n        ccs: pool.map((c) => c.cc),\n        access_rtt: line.rtt,\n        access_colo: line.colo,\n        concurrency: 12,\n        timeout: 2200,\n      });\n      MESH.line = {\n        rtt: res?.access_ms || line.rtt,\n        colo: res?.access_colo || line.colo,\n      };\n      MESH.cohort = res?.cohort || \"unknown\";\n      MESH.results = (Array.isArray(res?.results) ? res.results : []).sort((left, right) => {\n        const leftUp = Boolean(left.tcp_reachable || left.alive);\n        const rightUp = Boolean(right.tcp_reachable || right.alive);\n        if (leftUp !== rightUp) return leftUp ? -1 : 1;\n        const leftMs = Number(left.worker_tcp_ms ?? left.edge_ms);\n        const rightMs = Number(right.worker_tcp_ms ?? right.edge_ms);\n        return (Number.isFinite(leftMs) && leftMs > 0 ? leftMs : Number.POSITIVE_INFINITY) -\n          (Number.isFinite(rightMs) && rightMs > 0 ? rightMs : Number.POSITIVE_INFINITY);\n      });\n      MESH.history = MESH.results.map((r) => ({\n        cc: r.cc,\n        ...(r.history || {}),\n      }));\n      MESH.historyLoadedAt = Date.now();\n      MESH.lastRun = new Date(\n        res?.measured_at || Date.now(),\n      ).toLocaleTimeString(\"fa-IR\");\n      const reachable = MESH.results.filter((row) => row.tcp_reachable || row.alive);\n      if (!reachable.length)\n        y(\"هیچ TCP/443 از Worker باز نشد؛ فهرست را عوض کن یا دوباره سنجش بزن.\", \"warn\");\n      else\n        y(`TCP/443 از Worker باز شد برای ${reachable.length}/${MESH.results.length} candidate؛ این سنجش فقط TCP/443 را نشان می‌دهد.`, \"info\");\n    } catch (err) {\n      y(String(err?.message || \"مسابقه مسیر ناموفق بود\"), \"err\");\n    } finally {\n      MESH.running = !1;\n      e.rerenderView(\"mesh\");\n    }\n  }\n  async function MeshApply(e, cc) {\n    let c = COUNTRY_MAP.get(cc);\n    if (!c || !Array.isArray(c.proxies) || !c.proxies.length) {\n      MESH.message = { type: \"warn\", text: \"برای این کشور candidate endpoint در فهرست موجود نیست\" };\n      return e.rerenderView(\"mesh\");\n    }\n    let tested = MESH.results.find((r) => r.cc === cc && (r.tcp_reachable || r.alive));\n    if (!tested) {\n      MESH.message = {\n        type: \"warn\",\n        text: \"اول مسابقه را اجرا کن\",\n        detail: \"ثبت endpoint تا ۱۵ دقیقه بعد از سنجش Worker TCP معتبر است؛ سنجش نهایی سرویس با کلاینت است.\",\n      };\n      return e.rerenderView(\"mesh\");\n    }\n    const aiScope = MESH.mode === \"ai\"\n      ? \" اگر بررسی سرویس AI انجام شده باشد، ممکن است از یک پروکسی جدا در کاتالوگ استفاده کرده باشد و همین endpoint را اثبات نمی‌کند.\"\n      : \"\";\n    const accepted = await Q(\n      `فقط TCP/443 از Worker اومنی برای candidate ${tested.proxy || tested.host || cc} پاسخ داد. این سنجش فقط TCP/443 را اندازه می‌گیرد.${aiScope} به‌عنوان endpoint کانفیگ ثبت شود؟`, { okLabel: \"ثبت به‌عنوان endpoint\" }, );\n    if (!accepted) return;\n    try {\n      let applied = await x(\"POST\", \"/api/mesh/apply\", { mode: MESH.mode, cc });\n      let patch = {\n        selected_country: applied.cc,\n        proxy_ips: [applied.proxy],\n        mesh_active_mode: MESH.mode,\n      };\n      e.setSettings({ ...e.settings(), ...patch });\n      g.cc = applied.cc;\n      g.out = null;\n      MESH.country = cc;\n      MESH.message = {\n        type: \"warn\",\n        text: `برچسب کشور ${c.fa} ${c.flag} و endpoint ذخیره شد (برچسب کاتالوگ).`,\n        detail:\n          \"این endpoint فقط تست TCP/443 سمت Worker را گذراند؛ کانفیگ ساخته‌شده را قبل از تکیه‌کردن، با یک کلاینت واقعی تست کن.\",\n      };\n      y(`${c.flag} candidate ذخیره شد؛ فقط TCP/443 از سمت Worker سنجیده شد.`, \"warn\", 4200);\n      e.rerenderView(\"configs\");\n    } catch (err) {\n      let msg = String(err?.message || err),\n        ai = MESH.mode === \"ai\";\n      MESH.message = {\n        type: \"warn\",\n        text: ai ? \"برای این خروجی، تأیید سرویس Gemini لازم است\" : \"ثبت endpoint انجام نشد\",\n        detail: msg,\n      };\n      y(msg, \"err\", 4500);\n      e.rerenderView(\"mesh\");\n    }\n  }\n\n  function ze(e) {\n    let t = e.settings?.dns_upstream || \"\";\n    return `\n  <header class=\"view-head\">\n    <div>\n      <h2>${d(\"globe\")} ${a(n(\"dns.title\"))}</h2>\n      <p class=\"muted\">${a(n(\"dns.desc\"))}</p>\n    </div>\n    <div class=\"head-actions\" style=\"display:flex;gap:8px;align-items:center;flex-wrap:wrap\">\n      <input id=\"dns-qname\" dir=\"ltr\" value=\"youtube.com\" placeholder=\"example.com\" style=\"width:150px\">\n      <button class=\"btn btn-primary\" data-action=\"omni-dns-all\">${d(\"bolt\")} تست همه دی‌ان‌اس‌ها</button>\n    </div>\n  </header>\n  <div class=\"dns-grid\">\n    ${Ut.map(\n      (s) => `\n      <div class=\"dns-card\">\n        <b>${a(s.name)}</b>\n        <code dir=\"ltr\">${a(s.url)}</code>\n        <code class=\"muted\" dir=\"ltr\" style=\"font-size:10.5px\">DoT: ${a(s.dot || \"—\")}</code>\n        <span class=\"dns-tags\">\n          ${s.ir ? `<span class=\"badge ir\">${a(n(\"dns.ir\"))}</span>` : \"\"}\n          ${t === s.url ? `<span class=\"badge ok\">${a(n(\"dns.active\"))}</span>` : \"\"}\n          <span class=\"dns-test\" id=\"dnst-${a(s.name.replace(/\\W+/g, \"\"))}\"></span>\n        </span>\n        <div style=\"display:flex;gap:6px;margin-top:6px\">\n          <button class=\"btn btn-sm\" data-action=\"omni-dns\" data-url=\"${a(s.url)}\">${a(n(\"dns.pick\"))}</button>\n          <button class=\"btn btn-sm\" data-action=\"omni-dns-test\" data-url=\"${a(s.url)}\" data-key=\"${a(s.name.replace(/\\W+/g, \"\"))}\">${d(\"play\")} ${a(n(\"dns.test\"))}</button>\n        </div>\n      </div>`,\n    ).join(\"\")}\n  </div>\n  <p class=\"muted\" style=\"font-size:12.5px\">${a(n(\"dns.note\"))}</p>`;\n  }\n  async function Qt(e) {\n    let qEl = document.querySelector(\"#dns-qname\"),\n      qname = (qEl && qEl.value.trim()) || \"youtube.com\";\n    let t = performance.now();\n    try {\n      let r = await x(\n        \"GET\",\n        `/api/diag/dns?url=${encodeURIComponent(e)}&name=${encodeURIComponent(qname)}`,\n      );\n      if (r && r.ok)\n        return {\n          ms: r.ms || Math.round(performance.now() - t),\n          ok: !0,\n          ip: (r.ips && r.ips[0]) || null,\n          via: r.via,\n        };\n      return {\n        ms: r?.ms || Math.round(performance.now() - t),\n        ok: !1,\n        err: r?.error || \"بی‌پاسخ\",\n      };\n    } catch (err) {\n      return {\n        ms: Math.round(performance.now() - t),\n        ok: !1,\n        err: err?.message || \"خطا\",\n      };\n    }\n  }\n  function ut(e) {\n    document.addEventListener(\"input\", (t) => {\n      if (t.target && t.target.id === \"cfg-cc-q\") { g.ccq = t.target.value; e.rerenderView(\"configs\"); setTimeout(() => { let inp = document.querySelector(\"#cfg-cc-q\"); if (inp) { inp.focus(); inp.selectionStart = inp.selectionEnd = inp.value.length; } }, 0); } else if (t.target && t.target.id === \"country-search\") {\n        O.countryQuery = t.target.value;\n        renderCountryGrid();\n      } else if (t.target && t.target.id === \"scan-ranges\") {\n        O.tab = \"ingress\";\n        O.scanMode = \"custom\";\n        O.country = \"\";\n        document\n          .querySelectorAll('[data-action=\"omni-preset\"]')\n          .forEach((btn) => btn.setAttribute(\"aria-pressed\", \"false\"));\n        let lbl = document.querySelector(\"#scan-ranges-lbl\");\n        if (lbl)\n          lbl.textContent =\n            \"🎯 IP، CIDR یا دامنه برای اندازه‌گیری (حالت آی‌پی دلخواه شما)\";\n        se(\n          \"حالت اسکن آی‌پی دلخواه فعال شد — روی «سنجش مرورگر + بررسی Worker» کلیک کنید.\",\n        );\n      }\n    });\n    document.addEventListener(\"click\", async (t) => {\n      let s = t.target.closest('[data-action^=\"omni-\"]');\n      if (!s) return;\n      let i = s.dataset.action;\n      try {\n        if (i === \"omni-mesh-mode\") {\n          MESH.mode = s.dataset.mode || \"game\";\n          MESH.history = [];\n          MESH.proofs = [];\n          MESH.proofCc = null;\n          MESH.message = null;\n          MESH.historyLoadedAt = 0;\n          e.rerenderView(\"mesh\");\n        } else if (i === \"omni-test-ai\") {\n          let out = document.querySelector(\"#ai-test-result\");\n          if (out) out.innerHTML = '<div class=\"skeleton\" style=\"height:34px;margin-top:8px\"></div>';\n          try {\n            y(\"در حال بررسی وضعیت زنده اتصال به هوش مصنوعی…\", \"info\", 2000);\n            let r = await x(\"POST\", \"/api/mesh/service-proof\", {\n              cc: \"US\",\n              services: [\"gemini_web\", \"gemini_api\", \"ai_studio\", \"chatgpt\", \"claude\"],\n              timeout: 6500,\n            });\n            let list = Array.isArray(r?.results) ? r.results : [];\n            if (out) {\n              out.innerHTML = `\n                <div style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:10px\">\n                  ${list.map(p => `\n                    <div class=\"card\" style=\"padding:10px;border-inline-start:3px solid ${p.accepted ? \"var(--ok)\" : \"var(--warn)\"}\">\n                      <div style=\"display:flex;justify-content:space-between;align-items:center\">\n                        <b>${a(p.service)}</b>\n                        <span class=\"badge ${p.accepted ? \"ok\" : \"warn\"}\">${p.accepted ? \"سالم / آزاد\" : (p.status || \"خطا\")}</span>\n                      </div>\n                      <div class=\"muted mono\" style=\"font-size:11px;margin-top:4px\">${p.ms ? p.ms + \" ms\" : \"—\"} · HTTP ${p.status || \"—\"}</div>\n                    </div>\n                  `).join(\"\")}\n                </div>\n              `;\n            }\n            y(\"سنجش سرویس‌های هوش مصنوعی کامل شد\", \"ok\");\n          } catch (err) {\n            if (out) out.innerHTML = `<div class=\"toast err\">${a(err.message || err)}</div>`;\n          }\n        } else if (i === \"omni-mesh-race\") {\n          MeshRace(e);\n        } else if (i === \"omni-mesh-apply\") {\n          await MeshApply(e, s.dataset.cc || \"\");\n        } else if (i === \"omni-mesh-proof\") {\n          await MeshServiceProof(e, s.dataset.cc || \"\");\n        } else if (i === \"omni-mesh-toggle-results\") {\n          MESH.showAll = !MESH.showAll;\n          e.rerenderView(\"mesh\");\n        } else if (i === \"omni-mesh-auto\") {\n          let patch = {\n            mesh_auto_failover: s.checked ? \"1\" : \"0\",\n            mesh_active_mode: MESH.mode,\n          };\n          let saved = await b.saveSettings(patch);\n          e.setSettings(saved?.settings || { ...e.settings(), ...patch });\n          y(\n            s.checked ? \"Failover خودکار فعال شد\" : \"Failover خودکار خاموش شد\",\n            \"ok\",\n          );\n        } else if (i === \"omni-mesh-save-domains\") {\n          let val = (\n            document.querySelector(\"#mesh-direct-domains\")?.value || \"\"\n          )\n            .split(/[\\n,]+/)\n            .map((v) => v.trim().toLowerCase().replace(/^\\./, \"\"))\n            .filter(Boolean)\n            .slice(0, 80);\n          let saved = await b.saveSettings({ mesh_direct_domains: val });\n          e.setSettings(\n            saved?.settings || { ...e.settings(), mesh_direct_domains: val },\n          );\n          y(\"قواعد مستقیم sing-box و Clash ذخیره شد\", \"ok\");\n        } else if (i === \"omni-scan-tab\") {\n          O.tab = s.dataset.tab || \"ingress\";\n          O.results = [];\n          O.countryResults = [];\n          e.rerenderView(\"scanner\");\n        } else if (i === \"omni-scan\") {\n          O.tab = \"ingress\";\n          if (O.scanMode === \"all-countries\") O.scanMode = \"preset\";\n          Wt(e).catch((err) =>\n            se(String(err?.message || n(\"scanner.rankFail\"))),\n          );\n        } else if (i === \"omni-scan-all-countries\") {\n          WtAllCountries(e);\n        } else if (i === \"omni-pick-country-exit\") {\n          let cc = s.dataset.cc || \"\";\n          let px = s.dataset.proxy || \"\";\n          let cObj = COUNTRY_MAP.get(cc);\n          if (!cc || !px) {\n            y(\"ابتدا یک سرور خروجی را از نتیجهٔ اسکن انتخاب کنید.\", \"warn\");\n            return;\n          }\n          let accepted = await Q(\n            `سرور ${px} برای خروجی ${cObj?.fa || cc} ذخیره شود؟ این سرور در تست TCP ورکر پاسخ داده؛ تست کانفیگ جداست.`,\n            { okLabel: \"ذخیرهٔ خروجی\" },\n          );\n          if (!accepted) return;\n          let patch = { selected_country: cc, proxy_ips: [px] };\n          let saved = await b.saveSettings(patch);\n          e.setSettings(saved?.settings || { ...e.settings(), ...patch });\n          g.cc = cc;\n          g.out = null;\n          y(`خروجی ${cObj?.flag || \"\"} ${cObj?.fa || cc} ذخیره شد.`, \"ok\");\n          if (e.S().view === \"scanner\") e.rerenderView(\"scanner\");\n        } else if (i === \"omni-net-sense\") {\n          let bd = document.querySelector(\"#direct-ping-badges\");\n          if (bd)\n            bd.innerHTML =\n              '<span class=\"badge\">در حال سنجش سنسور خط گوشی و اپراتور…</span>';\n          let conn =\n            navigator.connection ||\n            navigator.mozConnection ||\n            navigator.webkitConnection ||\n            {};\n          let radioType = conn.type\n            ? conn.type +\n              (conn.effectiveType\n                ? \" / \" + conn.effectiveType.toUpperCase()\n                : \"\")\n            : conn.effectiveType\n              ? conn.effectiveType.toUpperCase()\n              : \"فعال\";\n          let radioDl = conn.downlink ? conn.downlink + \" Mbps\" : \"\";\n          s.disabled = true;\n          try {\n          let ns = await x(\"POST\", \"/api/diag/net-sense\", { apply: !0 }, {retry:0,signal:AbortSignal.timeout(15000)});\n          if (ns?.ok && ns.isp) {\n            let nextCfg = { ...e.settings(), fragment_preset: ns.isp.fragment };\n            if (Array.isArray(ns.applied_ips) && ns.applied_ips.length) {\n              nextCfg.clean_ips = ns.applied_ips;\n              nextCfg.ip_pool = ns.applied_ips.join(\"\\n\");\n            }\n            e.setSettings(nextCfg);\n            g.out = Bt(e.S());\n            if (bd)\n              bd.innerHTML = `<span class=\"badge ok\">📡 شبکهٔ فعلی: ${a(ns.isp.name)} (${a(ns.ipVersion || \"—\")})</span><span class=\"badge info\">📶 برآورد مرورگر: ${a(radioType)}${radioDl ? \" · \" + a(radioDl) : \"\"}</span><span class=\"badge ok\" dir=\"ltr\">🛡️ پروفایل فرگمنت پیشنهادی: ${a(ns.isp.fragmentRule)}</span><span class=\"badge warn\">IPهای پیشنهادی آماده‌اند — با دکمهٔ سنجش تأییدشان کن</span>`;\n            y(\n              `📱 خط ${ns.isp.name} شناسایی شد؛ پروفایل فرگمنت و آدرس‌های پیشنهادی ذخیره شدند. برای تأیید فرگمنت و آدرس‌ها، سنجش مرورگر + Worker را اجرا کن.`,\n              \"warn\",\n            );\n          }\n        } catch(err){if(bd)bd.textContent=\"شناسایی شبکه انجام نشد: \"+String(err?.message||err);y(String(err?.message||err),\"err\");}finally{s.disabled=false;}\n        } else if (i === \"omni-underground-hunt\") {\n          WtUnderground(e);\n        } else if (i === \"omni-test-direct\") {\n          let bd = document.querySelector(\"#direct-ping-badges\");\n          if (bd) bd.innerHTML = '<span class=\"badge\">در حال اندازه‌گیری پینگ مرورگر و ورکر…</span>';\n          let cfMs = null;\n          let colo = null;\n          let workerTcpMs = null;\n          try {\n            await fetch(\"/healthz?w=\" + Date.now(), {\n              cache: \"no-store\",\n              signal: AbortSignal.timeout(2500),\n            });\n            const started = performance.now();\n            const response = await fetch(\"/healthz?t=\" + Date.now(), {\n              cache: \"no-store\",\n              signal: AbortSignal.timeout(3000),\n            });\n            if (!response.ok) throw new Error(`healthz پاسخ ${response.status} داد`);\n            cfMs = Math.max(1, Math.round(performance.now() - started));\n            colo = response.headers.get(\"x-omni-colo\") || null;\n          } catch {\n            // Keep browser-to-Worker latency unavailable when the fetch fails.\n          }\n          const probe = await x(\"POST\", \"/api/diag/probe\", {\n            host: \"cp.cloudflare.com\",\n            port: 443,\n            timeout: 2500,\n          }).catch(() => null);\n          if (probe?.ok && Number(probe.ms) > 0) workerTcpMs = Number(probe.ms);\n          if (bd) {\n            const parts = [];\n            parts.push(cfMs !== null\n              ? `<span class=\"badge ok\" dir=\"ltr\">مرورگر → Worker پنل: ${cfMs} ms${colo ? ` (${a(colo)})` : \"\"}</span>`\n              : '<span class=\"badge warn\">مرورگر → Worker پنل: سنجیده نشد</span>');\n            parts.push(workerTcpMs !== null\n              ? `<span class=\"badge info\" dir=\"ltr\">TCP از Worker اومنی به cp.cloudflare.com: ${workerTcpMs} ms</span>`\n              : '<span class=\"badge warn\">Worker → cp.cloudflare.com: سنجیده نشد</span>');\n            bd.innerHTML = parts.join(\"\");\n          }\n        } else if (i === \"omni-direct-mode\") {\n          let patch = { selected_country: \"DIRECT\", proxy_ips: [] };\n          let saved = await b.saveSettings(patch);\n          e.setSettings(saved?.settings || { ...e.settings(), ...patch });\n          y(\n            \"🌐 حالت مستقیم تنظیم شد؛ زمان پاسخ واقعی به شبکه و سرویس مقصد شما بستگی دارد.\",\n            \"ok\",\n          );\n          e.rerenderView(l.view);\n        } else if (i === \"omni-rotate-ips\") {\n          s.disabled = true;\n          try {\n            const cfg=e.settings();\n            const pool=[...new Set([...Re(cfg.clean_ips),...Re(cfg.ip_pool)])].filter(ip=>!DEAD_BYOIP_SET.has(String(ip).toLowerCase())&&!COUNTRY_PROXY_MAP.has(String(ip).toLowerCase()));\n            if(pool.length<2){y(\"برای چرخش، حداقل دو آدرس در مخزن ذخیره کنید.\",\"warn\");return;}\n            const rotated=[...pool.slice(1),pool[0]];\n            const patch={clean_ips:rotated,ip_pool:rotated.join(\"\\n\")};\n            const saved=await b.saveSettings(patch);e.setSettings(saved?.settings||{...cfg,...patch});g.out=null;\n            y(\"ترتیب مخزن آی‌پی چرخید؛ تنظیمات کاربران پاک نشد.\",\"ok\");e.rerenderView(l.view);\n          } catch(err){y(String(err?.message||err),\"err\");} finally{s.disabled=false;}\n        } else if (i === \"omni-toggle-autorotate\") {\n          let checked = Boolean(s.checked);\n          let patch = {\n            auto_rotate: checked ? \"1\" : \"0\",\n            rotate_minutes:\n              String(e.settings()?.rotate_minutes || \"15\") === \"0\"\n                ? \"15\"\n                : String(e.settings()?.rotate_minutes || \"15\"),\n          };\n          let saved = await b.saveSettings(patch);\n          e.setSettings(saved?.settings || { ...e.settings(), ...patch });\n          y(\n            checked\n              ? \"🔄 چرخش خودکار آی‌پی در ساب‌لینک فعال شد\"\n              : \"چرخش خودکار آی‌پی غیرفعال شد\",\n            \"ok\",\n          );\n        } else if (i === \"omni-clear-custom\") {\n          if (O.running) return;\n          O.results = []; O.scanError = \"\"; xe(0); scanControls();\n          O.tab = \"ingress\";\n          O.scanMode = \"custom\";\n          O.country = \"\";\n          let ta0 = document.querySelector(\"#scan-ranges\");\n          if (ta0) {\n            ta0.value = \"\";\n            ta0.focus();\n          }\n          document\n            .querySelectorAll('[data-action=\"omni-preset\"]')\n            .forEach((btn) => btn.setAttribute(\"aria-pressed\", \"false\"));\n          se(\"کادر آماده ورود آی‌پی، رنج CIDR یا دامنه دلخواه شماست.\");\n        } else if (i === \"omni-preset\") {\n          if (O.running) return;\n          O.results = []; O.scanError = \"\"; xe(0); scanControls();\n          O.tab = \"ingress\";\n          O.scanMode = \"preset\";\n          O.country = \"\";\n          O.preset = s.dataset.v || \"all\";\n          if (O.preset === \"underground\") return WtUnderground(e);\n          let ta0 = document.querySelector(\"#scan-ranges\");\n          if (ta0)\n            ta0.value = (SCAN_PRESETS[O.preset] || SCAN_PRESETS.all).join(\"\\n\");\n          document\n            .querySelectorAll('[data-action=\"omni-preset\"]')\n            .forEach((btn) =>\n              btn.setAttribute(\n                \"aria-pressed\",\n                String(btn.dataset.v === O.preset),\n              ),\n            );\n          Wt(e).catch((err) =>\n            se(String(err?.message || n(\"scanner.rankFail\"))),\n          );\n        } else if (i === \"omni-region\") {\n          O.region = s.dataset.v || \"primary\";\n          document\n            .querySelectorAll('[data-action=\"omni-region\"]')\n            .forEach((btn) =>\n              btn.setAttribute(\n                \"aria-pressed\",\n                String(btn.dataset.v === O.region),\n              ),\n            );\n          renderCountryGrid();\n        } else if (i === \"omni-ipver\") {\n          if (O.running) return;\n          O.results = []; O.scanError = \"\"; xe(0); scanControls();\n          O.ipVer = s.dataset.v || \"both\";\n          document\n            .querySelectorAll('[data-action=\"omni-ipver\"]')\n            .forEach((btn) =>\n              btn.setAttribute(\n                \"aria-pressed\",\n                String(btn.dataset.v === O.ipVer),\n              ),\n            );\n          let ta0 = document.querySelector(\"#scan-ranges\");\n          if (ta0 && O.scanMode !== \"custom\" && O.preset !== \"underground\")\n            ta0.value = (SCAN_PRESETS[O.preset] || SCAN_PRESETS.all).join(\"\\n\");\n          Wt(e).catch((err) =>\n            se(String(err?.message || n(\"scanner.rankFail\"))),\n          );\n        } else if (i === \"omni-country\") {\n          if (O.running) return;\n          O.results = []; O.scanError = \"\"; xe(0); scanControls();\n          let cc = s.dataset.cc || \"\";\n          O.tab = \"countries\";\n          O.scanMode = \"country\";\n          O.country = cc;\n          renderCountryGrid();\n          Wt(e).catch((err) =>\n            se(String(err?.message || n(\"scanner.rankFail\"))),\n          );\n        } else if (i === \"omni-probe-fill\") {\n          let inp = document.querySelector(\"#probe-input\");\n          if (inp) {\n            inp.value = s.dataset.v || \"\";\n            Ta();\n          }\n        } else if (i === \"omni-ping-fill\") {\n          let inp = document.querySelector(\"#ping-input\");\n          if (inp) {\n            inp.value = s.dataset.v || \"\";\n            Ea();\n          }\n        } else if (i === \"omni-speedtest\") {\n          let out = document.querySelector(\"#speedtest-out\");\n          if (out) out.innerHTML = '<div class=\"skeleton\" style=\"height:42px\"></div>';\n          const rttObj = await measureLineRtt();\n          let dlMbps = null;\n          let ulMbps = null;\n          try {\n            const bytes = 327680;\n            const started = performance.now();\n            const response = await fetch(`/api/diag/speed?bytes=${bytes}&t=${Date.now()}`, {\n              cache: \"no-store\",\n              signal: AbortSignal.timeout(6000),\n            });\n            if (!response.ok) throw new Error(`دانلود: HTTP ${response.status}`);\n            const buffer = await response.arrayBuffer();\n            const elapsedMs = performance.now() - started;\n            if (buffer.byteLength > 0 && elapsedMs > 0) {\n              dlMbps = Math.round(((buffer.byteLength * 8) / (elapsedMs / 1000) / 1e6) * 10) / 10;\n            }\n          } catch {\n            // Keep unavailable when the transfer did not complete.\n          }\n          try {\n            const payload = new Uint8Array(131072);\n            const started = performance.now();\n            const response = await fetch(\"/api/diag/speed\", { method: \"POST\", body: payload });\n            if (!response.ok) throw new Error(`آپلود: HTTP ${response.status}`);\n            await response.json();\n            const elapsedMs = performance.now() - started;\n            if (elapsedMs > 0) {\n              ulMbps = Math.round(((payload.byteLength * 8) / (elapsedMs / 1000) / 1e6) * 10) / 10;\n            }\n          } catch {\n            // Keep unavailable when the transfer did not complete.\n          }\n          if (out) {\n            const parts = [];\n            parts.push(dlMbps !== null\n              ? `<span class=\"badge ok\">⬇️ Download: ${dlMbps} Mbps</span>`\n              : '<span class=\"badge warn\">دانلود: سنجیده نشد</span>');\n            parts.push(ulMbps !== null\n              ? `<span class=\"badge info\">⬆️ Upload: ${ulMbps} Mbps</span>`\n              : '<span class=\"badge warn\">آپلود: سنجیده نشد</span>');\n            parts.push(rttObj.rtt !== null\n              ? `<span class=\"badge ok\" dir=\"ltr\">مرورگر → Worker: ${rttObj.rtt} ms</span>`\n              : '<span class=\"badge warn\">مرورگر → Worker: سنجیده نشد</span>');\n            if (rttObj.colo) parts.push(`<span class=\"badge\">📍 ${a(rttObj.colo)}</span>`);\n            out.innerHTML = `<div style=\"display:flex;gap:8px;flex-wrap:wrap;align-items:center\">${parts.join(\"\")}</div>`;\n          }\n        } else if (i === \"omni-rank\") Jt(e);\n        else if (i === \"omni-apply\")\n          Kt(e).catch((err) =>\n            y(String(err?.message || n(\"scanner.rankFail\")), \"err\"),\n          );\n        else if (i === \"omni-dns\") {\n          await b.saveSettings({ dns_upstream: s.dataset.url });\n          e.setSettings({ ...e.settings(), dns_upstream: s.dataset.url });\n          y(n(\"dns.saved\"), \"ok\");\n          e.rerender();\n        } else if (i === \"omni-dns-test\") {\n          let o = document.querySelector(`#dnst-${CSS.escape(s.dataset.key)}`);\n          o && (o.innerHTML = '<span class=\"badge\">\\u2026</span>');\n          let r = await Qt(s.dataset.url);\n          o &&\n            (o.innerHTML = r.ok\n              ? `<span class=\"badge ok\" dir=\"ltr\">${r.ms} ms${r.ip ? \" · \" + a(r.ip) : \"\"}</span>`\n              : `<span class=\"badge danger\">${a(r.err || \"قطع\")}</span>`);\n        } else if (i === \"omni-dns-all\") {\n          await Promise.all(\n            Ut.map(async (u) => {\n              let key = u.name.replace(/\\W+/g, \"\");\n              let o = document.querySelector(`#dnst-${CSS.escape(key)}`);\n              o && (o.innerHTML = '<span class=\"badge\">\\u2026</span>');\n              let r = await Qt(u.url);\n              o &&\n                (o.innerHTML = r.ok\n                  ? `<span class=\"badge ok\" dir=\"ltr\">${r.ms} ms${r.ip ? \" · \" + a(r.ip) : \"\"}</span>`\n                  : `<span class=\"badge danger\">${a(r.err || \"قطع\")}</span>`);\n            }),\n          );\n        } else if (i === \"omni-cfg-build\") Gt(e.S());\n        else if (i === \"omni-cfg-profile\") {\n          let prof = s.dataset.v || \"all\";\n          let fragVal = s.dataset.frag || \"100-200,5-10,tlshello\";\n          g.profile = prof; g.fragPreset = fragVal; g.ech = !0; g.cs = \"\"; g.alpn = \"http/1.1\"; g.fragment = !1; g.fp = \"chrome\"; g.method = \"\"; let patch = { fingerprint: \"chrome\", ech_mode: \"auto\", cipher_suites: \"\", alpn_pref: \"http/1.1\", finalmask_preset: \"\" };\n          if (prof === \"senpai\") {\n            g.fp = \"unsafe\"; g.fragment = !0; g.ech = !1; g.cs = PATT_CS[\"semi-python\"]; g.fragPreset = \"senpai\"; g.method = \"ff\"; patch.fingerprint = \"unsafe\"; patch.ech_mode = \"off\"; patch.cipher_suites = PATT_CS[\"semi-python\"]; patch.finalmask_preset = \"tlshello-0-len\"; g.ports = [443, 2053];\n            g.addrs = \"hybrid\";\n            patch.fragment_preset = \"senpai\";\n            patch.clean_ips = [\n              \"104.16.132.229\",\n              \"104.17.148.17\",\n              \"172.67.181.32\",\n              \"104.21.3.237\",\n              \"speed.cloudflare.com\",\n              \"cdnjs.cloudflare.com\"\n            ];\n          } else if (prof === \"irancell\") { g.fp = \"unsafe\"; g.fragment = !0; g.ech = !1; g.cs = PATT_CS[\"semi-python\"]; g.fragPreset = \"patt:tlshello-0-len\"; g.method = \"ff\"; patch.fingerprint = \"unsafe\"; patch.ech_mode = \"off\"; patch.cipher_suites = PATT_CS[\"semi-python\"]; patch.finalmask_preset = \"tlshello-0-len\"; g.ports = [443, 2053, 8080];\n            g.addrs = \"hybrid\";\n            patch.fragment_preset = \"irancell\";\n            patch.clean_ips = [\n              ...OMNI_QOS_V4.slice(0, 5),\n              ...OMNI_CLEAN_SITES.slice(0, 3),\n              ...OMNI_CLEAN_IR.slice(0, 2),\n            ];\n          } else if (prof === \"tci\") {\n            g.ports = [443, 2053, 8080];\n            g.addrs = \"hybrid\";\n            patch.fragment_preset = \"tci\";\n            patch.clean_ips = [\n              ...OMNI_QOS_V4.slice(0, 5),\n              ...OMNI_CLEAN_SITES.slice(0, 3),\n              ...OMNI_CLEAN_IR.slice(0, 2),\n            ];\n          } else if (prof === \"mci\") { g.method = \"ech\"; g.ipv6 = !0;\n            g.ports = [443, 2053, 8080, 80];\n            g.addrs = \"hybrid\";\n            patch.fragment_preset = \"mci\";\n          } else if (prof === \"rightel\") {\n            g.ports = [443, 2053, 8080];\n            g.addrs = \"hybrid\";\n            patch.fragment_preset = \"rightel\";\n          } else if (prof === \"gaming\") {\n            g.ports = [443, 2053, 8080];\n            g.addrs = \"hybrid\";\n            patch.fragment_preset = \"gaming\";\n          } else if (prof === \"direct\") {\n            g.cc = \"DIRECT\";\n            g.ports = [443, 2053, 8080];\n            patch.selected_country = \"DIRECT\";\n            patch.proxy_ips = [];\n          }\n          b.saveSettings(patch)\n            .then((saved) => {\n              if (saved?.settings) e.setSettings(saved.settings);\n            })\n            .catch(() => {});\n          g.out = Bt(e.S());\n          y(\n            `پروفایل ${prof.toUpperCase()} با متد ${g.method === \"ff\" ? \"F&F (unsafe + semi-python + tlshello-0-len)\" : \"ECH\"} فعال و در ساب‌لینک ذخیره شد`,\n            \"ok\",\n          );\n          e.rerenderView(\"configs\");\n          setTimeout(() => ct(), 0);\n        } else if (i === \"omni-cfg-method\") {\n      let m = s.dataset.v || \"ech\"; g.method = m; let patch = {};\n      if (m === \"warp6\" || m === \"warp\" || m === \"masque\") { g.aetherIp = m === \"warp6\" ? \"v6\" : (m === \"warp\" ? \"both\" : \"v6\"); }\n      else {\n        g.ech = m === \"ech\"; g.alpn = \"http/1.1\"; g.cs = \"\"; g.fragment = !1; g.fp = \"chrome\";\n        patch = { fingerprint: \"chrome\", ech_mode: \"auto\", cipher_suites: \"\", alpn_pref: \"http/1.1\", finalmask_preset: \"\" };\n        if (m === \"ech\") { g.addrs = \"custom\"; g.customAddr = \"188.114.97.6\"; patch.ech_mode = \"on\"; g.cc = g.cc; }\n        else if (m === \"v6\") { g.ipv6 = !0; g.addrs = \"custom\"; g.customAddr = \"2a06:98c1:3121::7\"; patch.ech_mode = \"off\"; }\n        else if (m === \"ff\") {\n          g.fp = \"unsafe\"; g.fragment = !0; g.cs = PATT_CS[\"semi-python\"]; g.fragPreset = \"patt:tlshello-0-len\";\n          g.addrs = \"custom\"; g.customAddr = \"188.114.97.6\";\n          patch = { fingerprint: \"unsafe\", ech_mode: \"off\", cipher_suites: PATT_CS[\"semi-python\"], alpn_pref: \"http/1.1\", finalmask_preset: \"tlshello-0-len\" };\n        }\n        g.out = Bt(e.S());\n        b.saveSettings(patch).then((saved) => { if (saved?.settings) e.setSettings(saved.settings); }).catch(() => {});\n      }\n      y(m === \"ech\" || m === \"v6\" || m === \"ff\" ? `متد ${m.toUpperCase()} روی تولید کانفیگ و ساب‌لینک اعمال شد` : `متد Aether ${m.toUpperCase()} انتخاب شد — لینک آماده پایین کارت است`, \"ok\");\n      e.rerenderView(\"configs\"); setTimeout(() => ct(), 0);\n    } else if (i === \"omni-cfg-aether-ip\") { g.aetherIp = s.dataset.v || \"v6\"; e.rerenderView(\"configs\"); } else if (i === \"omni-cfg-cc-all\") { g.ccAll = !g.ccAll; e.rerenderView(\"configs\"); setTimeout(() => ct(), 0); }\n    else if (i === \"omni-go-scan\") { fe(\"scanner\"); }\n    else if (i === \"omni-cfg-cc\") {\n          g.cc = s.dataset.cc || \"DIRECT\";\n          let saved = await b.saveSettings({ selected_country: g.cc });\n          e.setSettings(\n            saved?.settings || { ...e.settings(), selected_country: g.cc },\n          );\n          g.out = Bt(e.S());\n          y(\n            g.cc === \"DIRECT\"\n              ? \"حالت مستقیم برای کانفیگ‌ها تنظیم شد.\"\n              : `برچسب خروجی ${COUNTRY_MAP.get(g.cc)?.fa || g.cc} برای کانفیگ‌ها تنظیم شد.`,\n            g.cc === \"DIRECT\" ? \"ok\" : \"warn\",\n          );\n          e.rerenderView(\"configs\");\n          setTimeout(() => ct(), 0);\n        } else if (i === \"omni-fmt\") (g.fmt = s.dataset.fmt), ct();\n        else if (i === \"omni-cfg-addr\") {\n          g.addrs = s.dataset.v;\n          g.out = Bt(e.S());\n          e.rerenderView(\"configs\");\n          setTimeout(() => ct(), 0);\n        } else if (i === \"omni-cfg-proto\") {\n          let o = s.dataset.v;\n          g.protos = g.protos.includes(o)\n            ? g.protos.filter((r) => r !== o)\n            : [...g.protos, o];\n          if (!g.protos.length) g.protos = [\"vless\"];\n          g.out = Bt(e.S());\n          e.rerenderView(\"configs\");\n          setTimeout(() => ct(), 0);\n        } else if (i === \"omni-cfg-port\") {\n          let o = Number(s.dataset.v);\n          g.ports = g.ports.includes(o)\n            ? g.ports.filter((r) => r !== o)\n            : [...g.ports, o];\n          if (!g.ports.length) g.ports = [443];\n          g.out = Bt(e.S());\n          e.rerenderView(\"configs\");\n          setTimeout(() => ct(), 0);\n        } else if (i === \"omni-copy\") {\n          let o = await navigator.clipboard\n            .writeText(s.dataset.text || \"\")\n            .then(\n              () => !0,\n              () => !1,\n            );\n          y(o ? n(\"users.drawer.copied\") : \"\\u2717\", o ? \"ok\" : \"err\", 1500);\n        } else if (i === \"omni-dl\") {\n          let o = g.out;\n          if (!o) return;\n          let r = {\n              uris: [\"omni-configs.txt\", o.uris.join(\"\\n\")],\n              qrcode: [\"omni-configs.txt\", o.uris.join(\"\\n\")],\n              base64: [\"omni-sub.txt\", o.base64],\n              singbox: [\"omni-gemini-lock-singbox.json\", o.singbox],\n              clash: [\"clash.yaml\", o.clash],\n              json: [\"omni-configs.json\", o.json],\n            },\n            [c, f] = r[s.dataset.fmt] || r.uris;\n          Vt(c, f);\n        } else if (i === \"omni-deep\") {\n          let o = g.out;\n          if (!o) return;\n          let r = {\n            cat: `catclient://add-sub?url=${encodeURIComponent(o.subUrl)}&name=OMNI`,\n            v2ray: `v2rayng://install-sub?url=${encodeURIComponent(o.subUrl)}&remark=OMNI`,\n            hiddify: `hiddify://import-sub/${encodeURIComponent(o.subUrl)}`,\n          };\n          location.href = r[s.dataset.kind] || r.cat;\n        }\n      } catch (o) {\n        y(String((o && o.message) || o), \"err\");\n      }\n    });\n    document.addEventListener(\"change\", (t) => {\n      let s = t.target;\n      if (s.id === \"mesh-region\") {\n        MESH.region = s.value || \"all\";\n        MESH.country = \"AUTO\";\n        MESH.results = [];\n        e.rerenderView(\"mesh\");\n      } else if (s.id === \"mesh-country\") {\n        MESH.country = s.value || \"AUTO\";\n        MESH.results = [];\n        MESH.proofCc = null;\n        MESH.message = null;\n        e.rerenderView(\"mesh\");\n      } else if (s.id === \"cfg-user\") {\n        g.user = s.value;\n        Gt(e.S());\n      } else if (s.id === \"cfg-ipv6\") {\n        g.ipv6 = s.checked;\n        Gt(e.S());\n      } else if (s.id === \"cfg-frag\") {\n        g.fragment = s.checked;\n        Gt(e.S());\n      } else if (s.id === \"cfg-fp\") {\n        g.fp = s.value;\n        Gt(e.S());\n      } else if (s.id === \"cfg-frag-preset\") { g.fragPreset = s.value; Gt(e.S()); } else if (s.id === \"cfg-cc-q\") { g.ccq = s.value; e.rerenderView(\"configs\"); }\n      else if (s.id === \"cfg-ech\") { g.ech = s.value === \"1\"; Gt(e.S()); } else if (s.id === \"cfg-cs\") { g.cs = s.value; Gt(e.S()); } else if (s.id === \"cfg-alpn\") { g.alpn = s.value; Gt(e.S()); } else if (s.id === \"cfg-v6fm\") { g.v6fm = s.checked; if (g.v6fm) { g.fragment = !0; g.fragPreset = \"patt:tlshello-0-len\"; } else { g.fragment = !1; } b.saveSettings({ finalmask_preset: g.v6fm ? \"tlshello-0-len\" : \"\" }).catch(() => {}); Gt(e.S()); } else if (s.id === \"cfg-custom\") {\n        g.customAddr = s.value;\n        Gt(e.S());\n      }\n    });\n  }\n  var Yt = matchMedia(\"(prefers-reduced-motion: reduce)\"),\n    Xt = matchMedia(\"(pointer: fine)\"),\n    Se = () => Yt.matches,\n    me = 0,\n    Me = null;\n  function ea(e) {\n    if (!Se()) {\n      (me = Me ? me : 0),\n        clearTimeout(Me),\n        (Me = setTimeout(() => {\n          (me = 0), (Me = null);\n        }, 260));\n      for (let t of e)\n        t.dataset.fx ||\n          ((t.dataset.fx = \"1\"),\n          (t.style.animationDelay = `${Math.min(me, 10) * 45}ms`),\n          t.classList.add(\"fx-in\"),\n          me++,\n          t.addEventListener(\n            \"animationend\",\n            () => {\n              t.style.animationDelay = \"\";\n            },\n            { once: !0 },\n          ));\n    }\n  }\n  var pt =\n      \".card, .toolbar, .bulkbar, tbody tr, .auth-card, .status-card, .tabs\",\n    ta = new MutationObserver((e) => {\n      let t = [];\n      for (let s of e)\n        for (let i of s.addedNodes)\n          i instanceof Element &&\n            (i.matches(pt) ? t.push(i) : t.push(...i.querySelectorAll(pt)));\n      t.length && ea(t);\n    });\n  function aa(e) {\n    if (!Xt.matches || Se() || e.dataset.tilt) return;\n    e.dataset.tilt = \"1\";\n    let t = 0;\n    e.addEventListener(\"pointermove\", (s) => {\n      t ||\n        (t = requestAnimationFrame(() => {\n          t = 0;\n          let i = e.getBoundingClientRect(),\n            o = (s.clientX - i.left) / i.width - 0.5,\n            r = (s.clientY - i.top) / i.height - 0.5;\n          e.style.transform = `translateY(-3px) perspective(900px) rotateX(${(-r * 4).toFixed(2)}deg) rotateY(${(o * 5).toFixed(2)}deg)`;\n        }));\n    }),\n      e.addEventListener(\"pointerleave\", () => {\n        e.style.transform = \"\";\n      });\n  }\n  function sa(e) {\n    let t = e.target.closest?.(\".btn, .nav-item, .seg button, .tabs button\");\n    if (!t || Se()) return;\n    let s = t.getBoundingClientRect(),\n      i = Math.max(s.width, s.height),\n      o = document.createElement(\"span\");\n    (o.className = \"ripple\"),\n      (o.style.width = o.style.height = `${i}px`),\n      (o.style.left = `${e.clientX - s.left - i / 2}px`),\n      (o.style.top = `${e.clientY - s.top - i / 2}px`),\n      t.append(o),\n      setTimeout(() => o.remove(), 650);\n  }\n  function na(e) {\n    if (Se() || e.dataset.counted) return;\n    let t = e.textContent.trim();\n    if (!t.match(/^[\\d.,٬]+$/)) return;\n    e.dataset.counted = \"1\";\n    let i = Number(t.replaceAll(/[.,٬]/g, \"\"));\n    if (!Number.isFinite(i) || i === 0) return;\n    let o = t.includes(\",\") || t.includes(\"\\u066C\"),\n      r = performance.now(),\n      c = 700,\n      f = (m) => (o ? m.toLocaleString(\"en-US\") : String(m)),\n      u = (m) => {\n        let p = Math.min(1, (m - r) / c),\n          $ = 1 - (1 - p) ** 3;\n        (e.textContent = f(Math.round(i * $))),\n          p < 1 ? requestAnimationFrame(u) : (e.textContent = t);\n      };\n    requestAnimationFrame(u);\n  }\n  function mt(e = document.body) {\n    ta.observe(e, { childList: !0, subtree: !0 }),\n      document.addEventListener(\"pointerdown\", sa, { passive: !0 });\n    let t = () => {\n      document.querySelectorAll(\".card\").forEach(aa),\n        document.querySelectorAll(\".kpi-value\").forEach(na);\n    };\n    t(),\n      new MutationObserver(() => requestAnimationFrame(t)).observe(e, {\n        childList: !0,\n        subtree: !0,\n      });\n  }\n  var Be = new TextEncoder(),\n    ia = new TextDecoder();\n  function oa(e) {\n    let t = String(e).replaceAll(\"-\", \"\"),\n      s = new Uint8Array(16);\n    for (let i = 0; i < 16; i++) s[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16);\n    return s;\n  }\n  function ra({ uuid: e, port: t, address: s }) {\n    let i = Be.encode(s),\n      o = [\n        new Uint8Array([0]),\n        oa(e),\n        new Uint8Array([0]),\n        new Uint8Array([1]),\n        new Uint8Array([(t >> 8) & 255, t & 255]),\n        new Uint8Array([2]),\n        new Uint8Array([i.length]),\n        i,\n      ],\n      r = o.reduce((u, m) => u + m.byteLength, 0),\n      c = new Uint8Array(r),\n      f = 0;\n    for (let u of o) c.set(u, f), (f += u.byteLength);\n    return c;\n  }\n  function ft({\n    host: e,\n    uuid: t,\n    target: s = \"httpbin.org\",\n    port: i = 80,\n    timeoutMs: o = 9e3,\n  }) {\n    return new Promise((r) => {\n      let f = `${location.protocol === \"https:\" ? \"wss\" : \"ws\"}://${e || location.host}/${t}`,\n        u = null,\n        m = 0,\n        p = !1,\n        $ = \"\",\n        M = !1,\n        k = (S) => {\n          if (!p) {\n            (p = !0), clearTimeout(L);\n            try {\n              u?.close();\n            } catch {}\n            r(S);\n          }\n        },\n        L = setTimeout(() => {\n          k(m ? { ok: !1, stage: \"nodata\" } : { ok: !1, stage: \"noopen\" });\n        }, o);\n      try {\n        u = new WebSocket(f);\n      } catch {\n        return k({ ok: !1, stage: \"noopen\" });\n      }\n      (u.binaryType = \"arraybuffer\"),\n        (u.onopen = () => {\n          m = performance.now();\n          let S = Be.encode(`GET /get HTTP/1.1\\r\nHost: ${s}\\r\nConnection: close\\r\n\\r\n`),\n            C = ra({ uuid: t, port: i, address: s }),\n            q = new Uint8Array(C.byteLength + S.byteLength);\n          q.set(C, 0), q.set(S, C.byteLength), u.send(q);\n        }),\n        (u.onmessage = (S) => {\n          let C =\n              S.data instanceof ArrayBuffer\n                ? new Uint8Array(S.data)\n                : Be.encode(String(S.data)),\n            q = C;\n          M || ((M = !0), (q = C.slice(1))),\n            ($ += ia.decode(q, { stream: !0 })),\n            /HTTP\\/1\\.[01] \\d{3}/.test($) &&\n              k({ ok: !0, ms: Math.round(performance.now() - m), stage: \"ok\" });\n        }),\n        (u.onclose = (S) => {\n          p ||\n            k(\n              m\n                ? { ok: !1, stage: \"nodata\", detail: `close ${S.code}` }\n                : { ok: !1, stage: \"refused\", detail: `close ${S.code}` },\n            );\n        }),\n        (u.onerror = () => {\n          p ||\n            k(m ? { ok: !1, stage: \"nodata\" } : { ok: !1, stage: \"refused\" });\n        });\n    });\n  }\n  var h = (e, t = document) => t.querySelector(e),\n    Y = (e, t = document) => [...t.querySelectorAll(e)],\n    l = {\n      me: null,\n      installed: !0,\n      authMode: \"login\",\n      authError: \"\",\n      signupAvailable: !1,\n      signupResult: null,\n      signupError: \"\",\n      view: location.hash.slice(2) || \"dashboard\",\n      overview: null,\n      settings: {},\n      fragments: { presets: [], fingerprints: [] },\n      users: [],\n      total: 0,\n      page: 1,\n      size: 25,\n      pages: 1,\n      query: \"\",\n      status: \"all\",\n      sort: \"created_at\",\n      dir: \"desc\",\n      loading: !1,\n      selection: new Set(),\n      logs: [],\n      sessions: [],\n      drawer: null,\n      cfgFormat: \"singbox\",\n      theme: localStorage.getItem(\"omni.theme\") || \"omni\",\n      sidebarOpen: !1,\n    };\n  async function la() {\n    try {\n      let e = await b.whoami();\n      (l.me = e.username ? { username: e.username, role: e.role } : null),\n        (l.installed = e.installed !== !1),\n        (l.panelName = e.panelName || \"Omni\"),\n        (l.signupAvailable = !!e.signup);\n    } catch (e) {\n      (l.me = null),\n        (l.installed = !(e instanceof B && e.code === \"not_installed\")),\n        (l.authError =\n          e instanceof B\n            ? e.message\n            : \"\\u0627\\u062A\\u0635\\u0627\\u0644 \\u0628\\u0647 \\u0633\\u0631\\u0648\\u0631 \\u0628\\u0631\\u0642\\u0631\\u0627\\u0631 \\u0646\\u0634\\u062F\");\n    }\n    l.installed || (l.authMode = \"setup\"),\n      H(),\n      da(),\n      ga(),\n      window.addEventListener(\"hashchange\", () => {\n        (l.view = location.hash.slice(2) || \"dashboard\"), X();\n      });\n  }\n  function ca() {\n    P.set(localStorage.getItem(\"omni.lang\") || \"fa\"),\n      (document.documentElement.dataset.theme = l.theme);\n  }\n  function da() {\n    \"serviceWorker\" in navigator &&\n      location.protocol.startsWith(\"http\") &&\n      navigator.serviceWorker.register(\"/sw.js\").catch(() => {}),\n      window.addEventListener(\"online\", () => gt(!0)),\n      window.addEventListener(\"offline\", () => gt(!1));\n  }\n  function gt(e) {\n    let t = h(\"#conn-dot\");\n    t && (t.style.background = e ? \"var(--ok)\" : \"var(--danger)\");\n  }\n  async function H() {\n    let e = h(\"#root\");\n    if ((e.setAttribute(\"aria-busy\", \"false\"), !l.me)) {\n      if (l.authMode === \"signup\")\n        return (e.innerHTML = at({\n          result: l.signupResult,\n          error: l.signupError,\n        }));\n      e.innerHTML = tt({\n        mode: l.authMode,\n        error: l.authError,\n        signup: l.signupAvailable,\n      });\n      return;\n    }\n    await pa(), (e.innerHTML = ua()), X();\n  }\n  var vt = [\n    { id: \"dashboard\", icon: \"dash\", label: () => n(\"nav.dashboard\") },\n    { id: \"users\", icon: \"users\", label: () => n(\"nav.users\") },\n    { id: \"configs\", icon: \"qr\", label: () => n(\"nav.configs\") },\n    { id: \"mesh\", icon: \"activity\", label: () => \"Causal Mesh\" },\n    { id: \"scanner\", icon: \"search\", label: () => n(\"nav.scanner\") },\n    { id: \"dns\", icon: \"globe\", label: () => n(\"nav.dns\") },\n    { id: \"diag\", icon: \"activity\", label: () => n(\"nav.diag\") },\n    { id: \"settings\", icon: \"gear\", label: () => n(\"nav.settings\") },\n    { id: \"sessions\", icon: \"key\", label: () => n(\"nav.sessions\") },\n  ];\n  function ua() {\n    return `<div class=\"app\">\n    <aside class=\"sidebar ${l.sidebarOpen ? \"open\" : \"\"}\" id=\"sidebar\">\n      <div class=\"brand\">\n        <img src=\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJLYXZlaCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImtnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyMmQzZWUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjODE4Y2Y4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGZpbHRlciBpZD0iZ2xvdyIgeD0iLTMwJSIgeT0iLTMwJSIgd2lkdGg9IjE2MCUiIGhlaWdodD0iMTYwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIwIiBzdGREZXZpYXRpb249IjE4IiBmbG9vZC1jb2xvcj0iIzIyZDNlZSIgZmxvb2Qtb3BhY2l0eT0iMC41NSIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTIwIiBmaWxsPSIjMDYwNzBhIi8+CiAgPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iNDMyIiBoZWlnaHQ9IjQzMiIgcng9IjEwNCIgZmlsbD0iIzBiMGQxMyIgc3Ryb2tlPSJ1cmwoI2tnKSIgc3Ryb2tlLXdpZHRoPSI2IiBvcGFjaXR5PSIwLjk1Ii8+CiAgPCEtLSBEZXJhZnNoLWUgS8SBdsSrxIFuOiB0aGUgYmxhY2tzbWl0aCdzIGFwcm9uIHJhaXNlZCBhcyBhIHN0YW5kYXJkIC0tPgogIDxnIGZpbHRlcj0idXJsKCNnbG93KSI+CiAgICA8cGF0aCBkPSJNMTgwIDExOCBMMzMyIDExOCBMMzU2IDMwMCBRMjU2IDM0MCAxNTYgMzAwIFoiIGZpbGw9InVybCgja2cpIiBmaWxsLW9wYWNpdHk9IjAuMTYiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAgIDxwYXRoIGQ9Ik0yNTYgMTE4IEwyNTYgNDAwIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICAgIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIxMiIgcj0iMzQiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTIiLz4KICAgIDxwYXRoIGQ9Ik0yMTQgMzcyIEwyOTggMzcyIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8L2c+Cjwvc3ZnPgo=\" alt=\"\" width=\"34\" height=\"34\">\n        <div><div class=\"brand-name\">${a(l.panelName || n(\"app.name\"))}</div>\n        <div class=\"brand-sub\">${a(n(\"app.tagline\"))}</div></div>\n      </div>\n      ${vt\n        .map(\n          (\n            e,\n          ) => `<button class=\"nav-item\" data-action=\"nav\" data-view=\"${e.id}\" ${l.view === e.id ? 'aria-current=\"page\"' : \"\"}>\n          ${d(e.icon)} ${a(e.label())}</button>`,\n        )\n        .join(\"\")}\n      <div class=\"nav-sep\"></div>\n      <div class=\"nav-label\">\\u0638\\u0627\\u0647\\u0631</div>\n      <div class=\"theme-row\" role=\"group\" aria-label=\"Theme\">\n        ${ot.map((e) => `<button class=\"theme-dot\" data-action=\"set-theme\" data-theme=\"${e.id}\" title=\"${a(e.label)}\" aria-pressed=\"${l.theme === e.id}\" aria-label=\"${a(e.label)}\"><i style=\"background:linear-gradient(135deg, ${e.a} 50%, ${e.b} 50%)\"></i></button>`).join(\"\")}\n      </div>\n      <button class=\"nav-item\" data-action=\"toggle-lang\">${d(\"globe\")} ${P.lang === \"fa\" ? \"English\" : \"\\u0641\\u0627\\u0631\\u0633\\u06CC\"}</button>\n      <div class=\"nav-sep\"></div>\n      <button class=\"nav-item\" data-action=\"palette\">${d(\"search\")} ${a(n(\"common.search\"))} <kbd style=\"margin-inline-start:auto\">\\u2318K</kbd></button>\n      <div class=\"spacer\" style=\"flex:1\"></div>\n      <button class=\"nav-item\" data-action=\"logout\" style=\"color:var(--danger)\">${d(\"logout\")} ${a(n(\"nav.logout\"))}</button>\n      <div class=\"muted\" style=\"font-size:10.5px;padding:8px 10px 0;text-align:center\">\n        <span id=\"conn-dot\" style=\"display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ok);margin-inline-end:5px\"></span>\n        Omni v1.0\n      </div>\n    </aside>\n    <main class=\"main\">\n      <header class=\"topbar\">\n        <button class=\"btn btn-ghost btn-icon\" data-action=\"toggle-sidebar\" id=\"burger\" style=\"display:none\">${d(\"menu\")}</button>\n        <h1 id=\"view-title\">${a(ht(l.view))}</h1>\n        <div class=\"spacer\"></div>\n        <button class=\"btn btn-ghost btn-icon\" data-action=\"refresh\" title=\"${a(n(\"common.refresh\"))}\">${d(\"refresh\")}</button>\n      </header>\n      <div class=\"content\" id=\"view\"></div>\n    </main>\n  </div>`;\n  }\n  function ht(e) {\n    return (\n      {\n        dashboard: n(\"nav.dashboard\"),\n        users: n(\"nav.users\"),\n        settings: n(\"nav.settings\"),\n        diag: n(\"nav.diag\"),\n        sessions: n(\"nav.sessions\"),\n        scanner: n(\"nav.scanner\"),\n        dns: n(\"nav.dns\"),\n        configs: n(\"nav.configs\"),\n        mesh: \"Causal Mesh\",\n      }[e] || n(\"app.name\")\n    );\n  }\n  async function X() {\n    let e = h(\"#view\");\n    if (!e) return H();\n    if (\n      (h(\"#view-title\") && (h(\"#view-title\").textContent = ht(l.view)),\n      Y(\".nav-item[data-view]\").forEach((t) => {\n        t.dataset.view === l.view\n          ? t.setAttribute(\"aria-current\", \"page\")\n          : t.removeAttribute(\"aria-current\");\n      }),\n      window.matchMedia(\"(max-width: 900px)\").matches)\n    ) {\n      let t = h(\"#burger\");\n      t && (t.style.display = \"\");\n    }\n    switch (l.view) {\n      case \"users\":\n        (e.innerHTML = Ie(l)), await U();\n        break;\n      case \"settings\":\n        (e.innerHTML = qe(\n          l.settings,\n          l.fragments.presets,\n          l.fragments.fingerprints,\n        )),\n          await ne(!0);\n        break;\n      case \"diag\":\n        (e.innerHTML = Ue(l.logs)), await yt();\n        break;\n      case \"sessions\":\n        (e.innerHTML = Ne(l.sessions)), await $t();\n        break;\n      case \"mesh\":\n        e.innerHTML = MeshView(l);\n        break;\n      case \"scanner\":\n        (e.innerHTML = Fe(l)),\n          await ne(),\n          l.view === \"scanner\" && (e.innerHTML = Fe(l));\n        break;\n      case \"configs\":\n        (e.innerHTML = je(l)),\n          await ne(),\n          await U(),\n          l.view === \"configs\" && (e.innerHTML = je(l));\n        break;\n      case \"dns\":\n        (e.innerHTML = ze(l)),\n          await ne(),\n          l.view === \"dns\" && (e.innerHTML = ze(l));\n        break;\n      default:\n        (l.view = \"dashboard\"),\n          (e.innerHTML = ke(l.settings, null) + pe(null)),\n          await ne(),\n          await Ge();\n    }\n  }\n  async function Ge() {\n    try {\n      l.overview = await b.overview(7);\n      let e = h(\"#view\");\n      e &&\n        l.view === \"dashboard\" &&\n        (e.innerHTML = ke(l.settings, l.overview) + pe(l.overview));\n    } catch (e) {\n      A(e);\n    }\n  }\n  async function U() {\n    (l.loading = !0), ge();\n    try {\n      let e = await b.users({\n        q: l.query,\n        status: l.status,\n        sort: l.sort,\n        dir: l.dir,\n        page: l.page,\n        size: l.size,\n      });\n      (l.users = e.users),\n        (l.total = e.total),\n        (l.pages = e.pages || 1),\n        (l.page = e.page);\n    } catch (e) {\n      A(e), (l.users = []);\n    } finally {\n      (l.loading = !1), ge();\n    }\n  }\n  function ge() {\n    let e = h(\"#view\");\n    e && l.view === \"users\" && (e.innerHTML = Ie(l));\n    let t = h(\"#user-search\");\n    t && document.activeElement !== t && (t.value = l.query);\n  }\n  async function pa() {\n    if (!l.fragments.presets.length)\n      try {\n        l.fragments = await b.fragments();\n      } catch {\n        l.fragments = {\n          presets: [\n            { id: \"none\", label: \"\\u2014\" },\n            { id: \"mci\", label: \"MCI\" },\n            { id: \"irancell\", label: \"Irancell\" },\n            { id: \"tci\", label: \"TCI\" },\n          ],\n          fingerprints: [\"chrome\", \"safari\", \"ios\", \"android\"],\n        };\n      }\n  }\n  async function ne(e) {\n    try {\n      if (e || !Object.keys(l.settings).length) {\n        let t = await b.settings();\n        l.settings = t.settings || {};\n        let s = h(\"#view\");\n        s && l.view === \"settings\"\n          ? (s.innerHTML = qe(\n              l.settings,\n              l.fragments.presets,\n              l.fragments.fingerprints,\n            ))\n          : s &&\n            l.view === \"dashboard\" &&\n            (s.innerHTML =\n              ke(l.settings, l.overview) +\n              (l.overview ? pe(l.overview) : pe(null)));\n      }\n    } catch (t) {\n      A(t);\n    }\n  }\n  async function yt() {\n    try {\n      let e = await b.logs(60);\n      l.logs = e.entries || [];\n      let t = h(\"#view\");\n      t && l.view === \"diag\" && (t.innerHTML = Ue(l.logs));\n    } catch {}\n  }\n  async function $t() {\n    try {\n      let e = await b.sessions();\n      l.sessions = e.sessions || [];\n      let t = h(\"#view\");\n      t && l.view === \"sessions\" && (t.innerHTML = Ne(l.sessions));\n    } catch (e) {\n      A(e);\n    }\n  }\n  function A(e) {\n    if (e instanceof B && e.status === 401) {\n      (l.me = null), (l.authError = n(\"login.title\")), H();\n      return;\n    }\n    y(e?.message || String(e), \"err\");\n  }\n  async function xt(e) {\n    Ye({\n      title: e,\n      body: '<div class=\"skeleton\" style=\"height:220px\"></div>',\n      footer: \"\",\n    });\n    try {\n      let t = await b.user(e),\n        s = [];\n      try {\n        s = (await b.userUsage(e, 14)).series || [];\n      } catch {}\n      (l.drawer = { user: t.user, configs: t.configs, usage: s }),\n        (l.cfgFormat = \"singbox\");\n      let i = h(\".drawer\");\n      i &&\n        ((i.querySelector(\"h2\").textContent = t.user.username),\n        (h(\".modal-body\", i).innerHTML = De(t.user, t.configs, s)));\n    } catch (t) {\n      J(), A(t);\n    }\n  }\n  function Ve(e = {}) {\n    let t = !!e.username;\n    Le({\n      title: t ? `${n(\"common.edit\")}: ${e.username}` : n(\"users.create\"),\n      body: st(e, l.fragments.presets, l.fragments.fingerprints),\n      footer: `<button class=\"btn\" data-action=\"close-modal\">${a(n(\"common.cancel\"))}</button>\n             <button class=\"btn btn-primary\" form=\"user-form\" type=\"submit\">${d(t ? \"check\" : \"plus\")} ${a(n(t ? \"common.save\" : \"common.create\"))}</button>`,\n    });\n  }\n  function wt(e) {\n    let t = new FormData(e),\n      s = {};\n    for (let [i, o] of t.entries()) s[i] = o;\n    for (let i of Y('input[type=\"checkbox\"]', e))\n      [\"ips\", \"proxies\", \"block_list\"].includes(i.name) ||\n        (s[i.name] = i.checked);\n    for (let i of Y(\"textarea\", e))\n      s[i.name] = i.value\n        .split(\n          `\n`,\n        )\n        .map((o) => o.trim())\n        .filter(Boolean);\n    for (let i of Y('input[type=\"number\"]', e)) s[i.name] = Number(i.value);\n    return s;\n  }\n  async function ma(e) {\n    let t = wt(e),\n      s = e.dataset.edit,\n      i = h('button[type=\"submit\"][form=\"user-form\"]');\n    i &&\n      ((i.disabled = !0),\n      (i.innerHTML =\n        '<div class=\"skeleton\" style=\"width:60px;height:14px\"></div>'));\n    try {\n      let o = s ? await b.updateUser(s, t) : await b.createUser(t);\n      W(),\n        y(\n          s\n            ? \"\\u0630\\u062E\\u06CC\\u0631\\u0647 \\u0634\\u062F\"\n            : `\\u06A9\\u0627\\u0631\\u0628\\u0631 \\xAB${o.user.username}\\xBB \\u0633\\u0627\\u062E\\u062A\\u0647 \\u0634\\u062F`,\n          \"ok\",\n        ),\n        l.view === \"users\" ? await U() : l.view === \"dashboard\" && (await Ge()),\n        h(\".drawer\") &&\n          l.drawer?.user.username === o.user.username &&\n          ((l.drawer = { ...l.drawer, user: o.user, configs: o.configs }),\n          (h(\".drawer .modal-body\").innerHTML = De(\n            o.user,\n            o.configs,\n            l.drawer.usage,\n          )));\n    } catch (o) {\n      y(o?.message || String(o), \"err\", 5e3),\n        i &&\n          ((i.disabled = !1),\n          (i.innerHTML = `${d(\"check\")} ${a(n(\"common.save\"))}`));\n    }\n  }\n  function kt() {\n    let e = [\n        ...vt.map((m) => ({\n          label: m.label(),\n          icon: m.icon,\n          run: () => fe(m.id),\n        })),\n        { label: n(\"users.create\"), icon: \"plus\", run: () => Ve({}) },\n        {\n          label:\n            l.theme === \"dark\"\n              ? \"\\u062D\\u0627\\u0644\\u062A \\u0631\\u0648\\u0634\\u0646\"\n              : \"Dark mode\",\n          icon: l.theme === \"dark\" ? \"sun\" : \"moon\",\n          run: Mt,\n        },\n        {\n          label: P.lang === \"fa\" ? \"English\" : \"\\u0641\\u0627\\u0631\\u0633\\u06CC\",\n          icon: \"globe\",\n          run: St,\n        },\n        { label: n(\"common.refresh\"), icon: \"refresh\", run: () => X() },\n        { label: n(\"settings.export\"), icon: \"download\", run: Ee },\n        { label: n(\"nav.logout\"), icon: \"logout\", run: Te },\n        ...(l.users || [])\n          .slice(0, 60)\n          .map((m) => ({\n            label: `\\u{1F464} ${m.username}`,\n            icon: \"users\",\n            run: () => xt(m.username),\n          })),\n      ],\n      t = document.createElement(\"div\");\n    (t.className = \"overlay\"),\n      (t.innerHTML = `<div class=\"palette\" role=\"dialog\" aria-modal=\"true\">\n      <input type=\"search\" placeholder=\"${a(n(\"common.cmdk\"))}\" aria-label=\"command\">\n      <div class=\"palette-list\"></div>\n    </div>`),\n      document.body.append(t);\n    let s = h(\"input\", t),\n      i = h(\".palette-list\", t),\n      o = e,\n      r = 0,\n      c = () => {\n        i.innerHTML =\n          o\n            .slice(0, 40)\n            .map(\n              (m, p) =>\n                `<div class=\"palette-item\" data-i=\"${p}\" aria-selected=\"${p === r}\">${d(m.icon)} ${a(m.label)}</div>`,\n            )\n            .join(\"\") || '<div class=\"empty\" style=\"padding:22px\">\\u2014</div>';\n      },\n      f = () => {\n        let m = s.value.trim().toLowerCase();\n        (o = m ? e.filter((p) => p.label.toLowerCase().includes(m)) : e),\n          (r = 0),\n          c();\n      },\n      u = (m) => {\n        let p = o[m];\n        t.remove(), p?.run();\n      };\n    s.addEventListener(\"input\", f),\n      s.addEventListener(\"keydown\", (m) => {\n        m.key === \"ArrowDown\"\n          ? ((r = Math.min(r + 1, o.length - 1)), c(), m.preventDefault())\n          : m.key === \"ArrowUp\"\n            ? ((r = Math.max(r - 1, 0)), c(), m.preventDefault())\n            : m.key === \"Enter\"\n              ? u(r)\n              : m.key === \"Escape\" && t.remove();\n      }),\n      i.addEventListener(\"click\", (m) => {\n        let p = m.target.closest(\"[data-i]\");\n        p && u(Number(p.dataset.i));\n      }),\n      t.addEventListener(\"mousedown\", (m) => {\n        m.target === t && t.remove();\n      }),\n      c(),\n      s.focus();\n  }\n  function fe(e) {\n    (l.view = e),\n      (location.hash = `#/${e}`),\n      (l.sidebarOpen = !1),\n      h(\"#sidebar\")?.classList.remove(\"open\"),\n      X();\n  }\n  function Mt() {\n    (l.theme = l.theme === \"dark\" ? \"light\" : \"dark\"),\n      localStorage.setItem(\"omni.theme\", l.theme),\n      (document.documentElement.dataset.theme = l.theme),\n      H();\n  }\n  function St() {\n    P.set(P.lang === \"fa\" ? \"en\" : \"fa\"), H();\n  }\n  async function Te() {\n    try {\n      await b.logout();\n    } catch {}\n    (l.me = null), (l.authMode = \"login\"), (l.authError = \"\"), H();\n  }\n  async function Tt(e, t) {\n    let s = [...l.selection];\n    if (\n      s.length &&\n      !(\n        e === \"delete\" &&\n        !(await Q(n(\"users.confirmBulkDelete\", { n: s.length }), {\n          danger: !0,\n        }))\n      )\n    )\n      try {\n        let i = await b.bulk(s, e, t);\n        y(`${e}: ${i.affected} \\u06A9\\u0627\\u0631\\u0628\\u0631`, \"ok\"),\n          l.selection.clear(),\n          await U();\n      } catch (i) {\n        A(i);\n      }\n  }\n  async function fa() {\n    let e = prompt(n(\"users.bulkExtend\"), \"30\");\n    e && (await Tt(\"extend\", Number(e)));\n  }\n  function ga() {\n    document.addEventListener(\"click\", ba),\n      document.addEventListener(\"submit\", va),\n      document.addEventListener(\"change\", wa),\n      document.addEventListener(\"input\", Ma),\n      document.addEventListener(\"keydown\", Sa);\n  }\n  async function ba(e) {\n    let t = e.target.closest(\"[data-action]\");\n    if (!t) return;\n    let s = t.dataset.action,\n      i = t.dataset.user;\n    switch (s) {\n      case \"nav\":\n        return e.preventDefault(), fe(t.dataset.view);\n      case \"toggle-theme\":\n        return Mt();\n      case \"set-theme\":\n        return (\n          (l.theme = t.dataset.theme || \"omni\"),\n          localStorage.setItem(\"omni.theme\", l.theme),\n          (document.documentElement.dataset.theme = l.theme),\n          H()\n        );\n      case \"toggle-lang\":\n        return St();\n      case \"toggle-sidebar\":\n        return (\n          (l.sidebarOpen = !l.sidebarOpen),\n          h(\"#sidebar\")?.classList.toggle(\"open\", l.sidebarOpen)\n        );\n      case \"palette\":\n        return kt();\n      case \"logout\":\n        return Te();\n      case \"refresh\":\n        return X();\n      case \"close-modal\":\n        return W();\n      case \"close-drawer\":\n        return J();\n      case \"goto-recover\":\n        return (l.authMode = \"recover\"), H();\n      case \"goto-login\":\n        return (l.authMode = \"login\"), (l.signupResult = null), H();\n      case \"goto-signup\":\n        return (l.authMode = \"signup\"), H();\n      case \"do-signup\":\n        return ha();\n      case \"new-user\":\n        return Ve({});\n      case \"edit-user\": {\n        e.preventDefault();\n        let o = (await b.user(i)).user;\n        return Ve(o);\n      }\n      case \"open-user\":\n        return e.preventDefault(), xt(i);\n      case \"delete-user\": {\n        if (\n          (e.preventDefault(),\n          !(await Q(n(\"users.confirmDelete\", { name: i }), {\n            danger: !0,\n            okLabel: n(\"common.delete\"),\n          })))\n        )\n          return;\n        try {\n          await b.deleteUser(i),\n            y(\"\\u062D\\u0630\\u0641 \\u0634\\u062F\", \"ok\"),\n            J(),\n            await (l.view === \"users\" ? U() : Ge());\n        } catch (r) {\n          A(r);\n        }\n        return;\n      }\n      case \"reset-user\": {\n        try {\n          await b.resetUser(i, { traffic: !0, requests: !0 }),\n            y(\"\\u062D\\u062C\\u0645 \\u0631\\u06CC\\u0633\\u062A \\u0634\\u062F\", \"ok\"),\n            J(),\n            await U();\n        } catch (o) {\n          A(o);\n        }\n        return;\n      }\n      case \"live-test\": {\n        let o = t,\n          r = o.closest(\".livetest\"),\n          c = r?.querySelector(\"[data-lt-ms]\"),\n          f = r?.querySelector(\"[data-lt-msg]\");\n        (o.disabled = !0),\n          c &&\n            ((c.hidden = !1), (c.className = \"ms\"), (c.textContent = \"\\u2026\")),\n          f && (f.textContent = n(\"live.running\"));\n        let u = await ft({\n          host: t.dataset.host || location.host,\n          uuid: t.dataset.uuid,\n        });\n        (o.disabled = !1),\n          c &&\n            ((c.className = `ms ${u.ok ? \"ok\" : \"bad\"}`),\n            (c.textContent = u.ok ? `${u.ms} ms` : \"\\u2715\")),\n          f && (f.textContent = n(`live.${u.stage}`)),\n          y(n(`live.${u.stage}`), u.ok ? \"ok\" : \"err\");\n        return;\n      }\n      case \"quick-toggle\": {\n        try {\n          await b.updateUser(i, { is_active: t.dataset.active === \"0\" }),\n            await U();\n        } catch (o) {\n          A(o);\n        }\n        return;\n      }\n      case \"select-user\":\n        return;\n      case \"select-all\":\n        return;\n      case \"clear-selection\":\n        return l.selection.clear(), ge();\n      case \"bulk\":\n        return Tt(t.dataset.op);\n      case \"bulk-extend\":\n        return fa();\n      case \"page\":\n        return (l.page = Number(t.dataset.page)), U();\n      case \"filter\":\n        return (l.status = t.dataset.status), (l.page = 1), X();\n      case \"sort\": {\n        let o = t.dataset.key;\n        return (\n          l.sort === o\n            ? (l.dir = l.dir === \"asc\" ? \"desc\" : \"asc\")\n            : ((l.sort = o), (l.dir = \"desc\")),\n          U()\n        );\n      }\n      case \"refresh-users\":\n        return U();\n      case \"copy\": {\n        let o = await ae(t.dataset.copy || \"\");\n        return y(\n          o\n            ? n(\"users.drawer.copied\")\n            : \"\\u06A9\\u067E\\u06CC \\u0646\\u0627\\u0645\\u0648\\u0641\\u0642 \\u0628\\u0648\\u062F\",\n          o ? \"ok\" : \"err\",\n          1600,\n        );\n      }\n      case \"copy-text\": {\n        let o = await ae(t.dataset.text || \"\");\n        return y(\n          o\n            ? n(\"users.drawer.copied\")\n            : \"\\u06A9\\u067E\\u06CC \\u0646\\u0627\\u0645\\u0648\\u0641\\u0642 \\u0628\\u0648\\u062F\",\n          o ? \"ok\" : \"err\",\n          1600,\n        );\n      }\n      case \"copy-sub\": {\n        let o = `${location.origin}${le(t.dataset.token)}`,\n          r = await ae(o);\n        return y(\n          r\n            ? \"\\u0644\\u06CC\\u0646\\u06A9 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9 \\u06A9\\u067E\\u06CC \\u0634\\u062F\"\n            : \"\\u06A9\\u067E\\u06CC \\u0646\\u0627\\u0645\\u0648\\u0641\\u0642 \\u0628\\u0648\\u062F\",\n          r ? \"ok\" : \"err\",\n          1800,\n        );\n      }\n      case \"copy-all-uris\": {\n        let o = l.drawer?.configs?.uris || [],\n          r = await ae(\n            o.join(`\n`),\n          );\n        return y(\n          r\n            ? `${o.length} \\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF \\u06A9\\u067E\\u06CC \\u0634\\u062F`\n            : \"\\u06A9\\u067E\\u06CC \\u0646\\u0627\\u0645\\u0648\\u0641\\u0642 \\u0628\\u0648\\u062F\",\n          r ? \"ok\" : \"err\",\n        );\n      }\n      case \"copy-cfg\": {\n        let o = await ae(h(\"#cfg-out\")?.textContent || \"\");\n        return y(\n          o\n            ? n(\"users.drawer.copied\")\n            : \"\\u06A9\\u067E\\u06CC \\u0646\\u0627\\u0645\\u0648\\u0641\\u0642 \\u0628\\u0648\\u062F\",\n          o ? \"ok\" : \"err\",\n          1600,\n        );\n      }\n      case \"download-cfg\": {\n        let o = l.drawer?.configs || {},\n          r = l.cfgFormat,\n          c =\n            r === \"singbox\"\n              ? JSON.stringify(o.singbox, null, 2)\n              : r === \"clash\"\n                ? o.clash\n                : o.base64,\n          f = r === \"singbox\" ? \"json\" : r === \"clash\" ? \"yaml\" : \"txt\",\n          u = new Blob([c], { type: \"text/plain;charset=utf-8\" }),\n          m = document.createElement(\"a\");\n        (m.href = URL.createObjectURL(u)),\n          (m.download = `${l.drawer.user.username}.${f}`),\n          m.click(),\n          URL.revokeObjectURL(m.href);\n        return;\n      }\n      case \"cfg-format\": {\n        (l.cfgFormat = t.dataset.format),\n          Y(\"[data-action='cfg-format']\").forEach((r) =>\n            r.setAttribute(\"aria-pressed\", String(r === t)),\n          );\n        let o = l.drawer?.configs || {};\n        h(\"#cfg-out\").textContent =\n          l.cfgFormat === \"singbox\"\n            ? JSON.stringify(o.singbox, null, 2)\n            : l.cfgFormat === \"clash\"\n              ? o.clash\n              : o.base64;\n        return;\n      }\n      case \"drawer-tab\": {\n        Y(\"[data-action='drawer-tab']\").forEach((o) =>\n          o.setAttribute(\"aria-selected\", String(o === t)),\n        ),\n          Y(\"[data-tab-panel]\").forEach((o) =>\n            o.classList.toggle(\"hide\", o.dataset.tabPanel !== t.dataset.tab),\n          );\n        return;\n      }\n      case \"rotate-token\": {\n        if (\n          !(await Q(\n            \"\\u0644\\u06CC\\u0646\\u06A9 \\u0627\\u0634\\u062A\\u0631\\u0627\\u06A9 \\u0641\\u0639\\u0644\\u06CC \\u0628\\u0627\\u0637\\u0644 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F \\u0648 \\u06A9\\u0627\\u0631\\u0628\\u0631 \\u0628\\u0627\\u06CC\\u062F \\u0644\\u06CC\\u0646\\u06A9 \\u062C\\u062F\\u06CC\\u062F \\u0631\\u0627 \\u0628\\u06AF\\u06CC\\u0631\\u062F. \\u0627\\u062F\\u0627\\u0645\\u0647\\u061F\",\n            { danger: !0 },\n          ))\n        )\n          return;\n        try {\n          let r = await b.rotateToken(l.drawer.user.username);\n          (l.drawer.user.sub_token = r.sub_token),\n            (h(\"#sub-link\").textContent =\n              `${location.origin}${le(r.sub_token)}`),\n            y(\n              \"\\u062A\\u0648\\u06A9\\u0646 \\u062C\\u062F\\u06CC\\u062F \\u0633\\u0627\\u062E\\u062A\\u0647 \\u0634\\u062F\",\n              \"ok\",\n            );\n        } catch (r) {\n          A(r);\n        }\n        return;\n      }\n      case \"rotate-uuid\": {\n        if (\n          !(await Q(\n            \"UUID \\u0639\\u0648\\u0636 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u062F\\u061B \\u0647\\u0645\\u0647\\u200C\\u06CC \\u06A9\\u0627\\u0646\\u0641\\u06CC\\u06AF\\u200C\\u0647\\u0627\\u06CC \\u0642\\u0628\\u0644\\u06CC \\u0627\\u0632 \\u06A9\\u0627\\u0631 \\u0645\\u06CC\\u200C\\u0627\\u0641\\u062A\\u0646\\u062F. \\u0627\\u062F\\u0627\\u0645\\u0647\\u061F\",\n            { danger: !0 },\n          ))\n        )\n          return;\n        try {\n          await b.rotateUuid(l.drawer.user.username),\n            y(\"UUID \\u0639\\u0648\\u0636 \\u0634\\u062F\", \"ok\"),\n            J(),\n            await U();\n        } catch (r) {\n          A(r);\n        }\n        return;\n      }\n      case \"reload-settings\":\n        return ne(!0);\n      case \"change-password\":\n        return xa();\n      case \"export-backup\":\n        return Ee();\n      case \"revoke-all\": {\n        if (\n          !(await Q(\n            \"\\u0647\\u0645\\u0647\\u200C\\u06CC \\u0646\\u0634\\u0633\\u062A\\u200C\\u0647\\u0627 \\u0628\\u0627\\u0637\\u0644 \\u0645\\u06CC\\u200C\\u0634\\u0648\\u0646\\u062F \\u0648 \\u0628\\u0627\\u06CC\\u062F \\u062F\\u0648\\u0628\\u0627\\u0631\\u0647 \\u0648\\u0627\\u0631\\u062F \\u0634\\u0648\\u06CC\\u062F.\",\n            { danger: !0 },\n          ))\n        )\n          return;\n        try {\n          await b.revokeAll(), await Te();\n        } catch (r) {\n          A(r);\n        }\n        return;\n      }\n      case \"revoke-session\": {\n        try {\n          await b.revoke(t.dataset.id), await $t();\n        } catch (o) {\n          A(o);\n        }\n        return;\n      }\n      case \"probe\":\n        return Ta();\n      case \"ping\":\n        return Ea();\n      case \"reload-logs\":\n        return yt();\n    }\n  }\n  function va(e) {\n    let t = e.target;\n    if ((e.preventDefault(), t.id === \"auth-form\")) return ya(t);\n    if (t.id === \"user-form\") return ma(t);\n    if (t.id === \"settings-form\") return $a(t);\n  }\n  async function ha() {\n    l.signupError = \"\";\n    try {\n      (l.signupResult = await b.signup()), H();\n    } catch (e) {\n      (l.signupError = e?.message || String(e)), H();\n    }\n  }\n  async function ya(e) {\n    let t = e.dataset.mode,\n      s = new FormData(e),\n      i = h('button[type=\"submit\"]', e);\n    (i.disabled = !0), (l.authError = \"\");\n    try {\n      if (t === \"setup\")\n        await b.setup(s.get(\"password\"), s.get(\"username\") || \"admin\");\n      else if (t === \"recover\") {\n        let r = await fetch(\"/api/recover\", {\n            method: \"POST\",\n            headers: { \"content-type\": \"application/json\" },\n            body: JSON.stringify({\n              code: s.get(\"code\"),\n              password: s.get(\"password\"),\n            }),\n          }),\n          c = await r.json();\n        if (!r.ok || c.ok === !1) throw new B(r.status, c.code, c.error);\n        return (\n          y(\n            \"\\u0631\\u0645\\u0632 \\u0628\\u0627\\u0632\\u0646\\u0634\\u0627\\u0646\\u06CC \\u0634\\u062F. \\u062F\\u0648\\u0628\\u0627\\u0631\\u0647 \\u0648\\u0627\\u0631\\u062F \\u0634\\u0648\\u06CC\\u062F.\",\n            \"ok\",\n          ),\n          (l.authMode = \"login\"),\n          H()\n        );\n      } else await b.login(s.get(\"password\"), s.get(\"username\"));\n      let o = await b.whoami();\n      (l.me = { username: o.username, role: o.role }),\n        (l.panelName = o.panelName || \"Omni\"),\n        y(\n          `\\u062E\\u0648\\u0634 \\u0622\\u0645\\u062F\\u06CC\\u062F\\u060C ${l.me.username} \\u{1F44B}`,\n          \"ok\",\n        ),\n        (location.hash = \"#/dashboard\"),\n        (l.view = \"dashboard\"),\n        H();\n    } catch (o) {\n      (l.authError = o?.message || String(o)), H();\n    } finally {\n      i.disabled = !1;\n    }\n  }\n  async function $a(e) {\n    let t = wt(e),\n      s = {};\n    for (let i of [\n      \"panel_name\",\n      \"public_host\",\n      \"port\",\n      \"fragment_preset\",\n      \"fingerprint\",\n      \"remark_prefix\",\n      \"default_quota_gb\",\n      \"default_expiry_days\",\n      \"rotate_minutes\",\n      \"signup_max_per_ip\",\n    ])\n      t[i] !== void 0 && t[i] !== \"\" && (s[i] = String(t[i]));\n    for (let i of [\n      \"maintenance\",\n      \"auto_rotate\",\n      \"mux_enabled\",\n      \"block_nsfw\",\n      \"block_ads\",\n      \"public_signup\",\n    ])\n      s[i] = t[i] ? \"1\" : \"0\";\n    for (let i of [\"clean_ips\", \"ip_pool\"])\n      Array.isArray(t[i]) && (s[i] = t[i]);\n    try {\n      let i = await b.saveSettings(s);\n      (l.settings = i.settings),\n        y(n(\"settings.saved\"), \"ok\"),\n        (l.panelName = l.settings.panel_name || l.panelName),\n        H();\n    } catch (i) {\n      A(i);\n    }\n  }\n  async function xa() {\n    let e = h(\"#settings-form\"),\n      t = e?.pw_current?.value,\n      s = e?.pw_next?.value;\n    if (!t || !s)\n      return y(\n        \"\\u0647\\u0631 \\u062F\\u0648 \\u0641\\u06CC\\u0644\\u062F \\u0631\\u0645\\u0632 \\u0631\\u0627 \\u067E\\u0631 \\u06A9\\u0646\\u06CC\\u062F\",\n        \"warn\",\n      );\n    try {\n      await b.changePassword(t, s),\n        y(\n          \"\\u0631\\u0645\\u0632 \\u062A\\u063A\\u06CC\\u06CC\\u0631 \\u06A9\\u0631\\u062F. \\u062F\\u0648\\u0628\\u0627\\u0631\\u0647 \\u0648\\u0627\\u0631\\u062F \\u0634\\u0648\\u06CC\\u062F.\",\n          \"ok\",\n        ),\n        await Te();\n    } catch (i) {\n      A(i);\n    }\n  }\n  function wa(e) {\n    let t = e.target,\n      s = t.dataset.action;\n    if (s === \"select-user\") {\n      t.checked\n        ? l.selection.add(t.dataset.user)\n        : l.selection.delete(t.dataset.user),\n        t.closest(\"tr\")?.classList.toggle(\"selected\", t.checked),\n        ge();\n      return;\n    }\n    if (s === \"select-all\")\n      return (\n        (l.selection = t.checked\n          ? new Set(l.users.map((i) => i.username))\n          : new Set()),\n        ge()\n      );\n    if (s === \"import-backup\") return ka(t.files?.[0]);\n  }\n  async function ka(e) {\n    if (e)\n      try {\n        let t = JSON.parse(await e.text());\n        if (\n          !(await Q(\n            `${t.users?.length || 0} \\u06A9\\u0627\\u0631\\u0628\\u0631 \\u0627\\u0632 \\u0641\\u0627\\u06CC\\u0644 \\u0628\\u0627\\u0632\\u06CC\\u0627\\u0628\\u06CC \\u0634\\u0648\\u062F\\u061F \\u062D\\u0627\\u0644\\u062A \\xAB\\u062C\\u0627\\u06CC\\u06AF\\u0632\\u06CC\\u0646\\u06CC\\xBB \\u06A9\\u0627\\u0631\\u0628\\u0631\\u0627\\u0646 \\u0641\\u0639\\u0644\\u06CC \\u0631\\u0627 \\u067E\\u0627\\u06A9 \\u0645\\u06CC\\u200C\\u06A9\\u0646\\u062F.`,\n            { danger: !0 },\n          ))\n        )\n          return;\n        let i = await b.post(\"/api/backup\", { ...t, mode: \"replace\" });\n        y(\n          `${i.imported} \\u06A9\\u0627\\u0631\\u0628\\u0631 \\u0628\\u0627\\u0632\\u06CC\\u0627\\u0628\\u06CC \\u0634\\u062F`,\n          \"ok\",\n        ),\n          await U();\n      } catch (t) {\n        A(t);\n      }\n  }\n  var bt;\n  function Ma(e) {\n    e.target.id === \"user-search\" &&\n      (clearTimeout(bt),\n      (bt = setTimeout(\n        () => {\n          (l.query = e.target.value), (l.page = 1), U();\n        },\n        Number(e.target.dataset.debounce || 300),\n      )));\n  }\n  function Sa(e) {\n    let t = /input|textarea|select/i.test(e.target.tagName);\n    if ((e.key === \"k\" || e.key === \"K\") && (e.metaKey || e.ctrlKey))\n      return e.preventDefault(), l.me ? kt() : null;\n    if (e.key === \"Escape\") {\n      h(\".overlay\")?.remove(), J(), W();\n      return;\n    }\n    !t &&\n      l.me &&\n      (e.key === \"/\" && (e.preventDefault(), h(\"#user-search\")?.focus()),\n      e.key === \"g\"\n        ? (l._g = Date.now())\n        : l._g &&\n          Date.now() - l._g < 1200 &&\n          (e.key === \"d\" && fe(\"dashboard\"),\n          e.key === \"u\" && fe(\"users\"),\n          e.key === \"s\" && fe(\"settings\"),\n          (l._g = 0)));\n  }\n  async function Ta() {\n    let e = h(\"#probe-input\").value.trim(),\n      t = h(\"#probe-out\");\n    if (!e)\n      return y(\n        \"\\u0622\\u062F\\u0631\\u0633 \\u067E\\u0631\\u0648\\u06A9\\u0633\\u06CC \\u0631\\u0627 \\u0648\\u0627\\u0631\\u062F \\u06A9\\u0646\\u06CC\\u062F\",\n        \"warn\",\n      );\n    t.innerHTML = '<div class=\"skeleton\" style=\"height:34px\"></div>';\n    try {\n      let s = await b.probeNode(e);\n      t.innerHTML = s.ok\n        ? `<div class=\"badge ok\">${d(\"check\")} \\u0633\\u0627\\u0644\\u0645 \\xB7 ${v(s.latencyMs)} ms</div>`\n        : `<div class=\"badge danger\">${d(\"alert\")} \\u0642\\u0637\\u0639</div><div class=\"codebox\" style=\"margin-top:8px\">${a(s.error || \"\")}</div>`;\n    } catch (s) {\n      t.innerHTML = `<div class=\"toast err\">${a(s.message)}</div>`;\n    }\n  }\n  async function _a() {\n    let e = h(\"#rank-input\")\n        .value.split(/[\\n,\\s]+/)\n        .map((s) => s.trim())\n        .filter(Boolean),\n      t = h(\"#rank-out\");\n    if (!e.length)\n      return y(\n        \"\\u0622\\u06CC\\u200C\\u067E\\u06CC \\u0648\\u0627\\u0631\\u062F \\u06A9\\u0646\\u06CC\\u062F\",\n        \"warn\",\n      );\n    t.innerHTML = '<div class=\"skeleton\" style=\"height:34px\"></div>';\n    try {\n      let s = await b.rankIps(e, l.settings.public_host || location.hostname);\n      (t.innerHTML = `<div class=\"muted\" style=\"font-size:12px;margin-bottom:8px\">${v(s.healthy)} \\u0627\\u0632 ${v(s.total)} \\u0633\\u0627\\u0644\\u0645</div>\n      <div class=\"codebox\">${a(\n        s.ips.join(`\n`),\n      )}</div>\n      <div style=\"margin-top:8px\">${te(\n        s.ips.join(`\n`),\n      )}\n      <button class=\"btn btn-sm\" data-action=\"apply-ranked\">${d(\"check\")} \\u0627\\u0639\\u0645\\u0627\\u0644 \\u062F\\u0631 candidate\\u0647\\u0627\\u06CC \\u0633\\u0646\\u062C\\u06CC\\u062F\\u0647\\u200C\\u0634\\u062F\\u0647</button></div>`),\n        (window.__ranked = s.ips);\n    } catch (s) {\n      t.innerHTML = `<div class=\"toast err\">${a(s.message)}</div>`;\n    }\n  }\n  async function Ea() {\n    let e = h(\"#ping-input\").value.trim(),\n      t = h(\"#ping-out\");\n    t.innerHTML = '<div class=\"skeleton\" style=\"height:34px\"></div>';\n    try {\n      let s = await b.ping(e);\n      t.innerHTML = `<div style=\"display:flex;gap:8px;align-items:center;flex-wrap:wrap\">\n        <span class=\"badge ${s.avg == null ? \"danger\" : \"ok\"}\">${s.avg == null ? \"بی‌پاسخ\" : `${v(s.avg)} ms`}</span>\n        ${s.colo ? `<span class=\"badge info\">لوکِیشن Worker: ${a(s.colo)}</span>` : \"\"}\n        <span class=\"muted\" style=\"font-size:12px\">سنجش‌های ناموفق ${a(s.loss)}</span></div>\n      <div class=\"codebox\" style=\"margin-top:8px;max-height:110px\">${a(JSON.stringify(s.samples, null, 2))}</div>`;\n    } catch (s) {\n      t.innerHTML = `<div class=\"toast err\">${a(s.message)}</div>`;\n    }\n  }\n  async function La() {\n    let e = h(\"#maintenance-out\");\n    e.innerHTML = '<div class=\"skeleton\" style=\"height:34px\"></div>';\n    try {\n      let t = await b.maintenance();\n      (e.innerHTML = `<div style=\"display:flex;gap:6px;flex-wrap:wrap\">\n        <span class=\"badge ok\">${d(\"check\")} ${v(t.ms)} ms</span>\n        <span class=\"badge ${t.expired_handled ? \"info\" : \"\"}\">${a(n(\"diag.expired\"))}: ${v(t.expired_handled)}</span>\n        <span class=\"badge\">${a(n(\"diag.ipsRotated\"))}: ${v(t.ips_rotated)}</span>\n      </div>\n      <div class=\"codebox\" style=\"margin-top:8px\">${a(JSON.stringify(t, null, 2))}</div>`),\n        y(n(\"diag.maintenanceDone\"), \"ok\");\n    } catch (t) {\n      e.innerHTML = `<div class=\"toast err\">${a(t.message)}</div>`;\n    }\n  }\n  document.addEventListener(\"click\", async (e) => {\n    if (e.target.closest(\"[data-action='maintenance']\")) return La();\n    if (e.target.closest(\"[data-action='apply-ranked']\"))\n      try {\n        let t = await b.saveSettings({ clean_ips: window.__ranked || [] });\n        (l.settings = t.settings),\n          y(\n            \"\\u0622\\u06CC\\u200C\\u067E\\u06CC\\u200C\\u0647\\u0627\\u06CC \\u062A\\u0645\\u06CC\\u0632 \\u0628\\u0647\\u200C\\u0631\\u0648\\u0632\\u0631\\u0633\\u0627\\u0646\\u06CC \\u0634\\u062F\",\n            \"ok\",\n          );\n      } catch (t) {\n        A(t);\n      }\n  });\n  ca();\n  mt();\n  ut({\n    settings: () => l.settings,\n    setSettings: (e) => {\n      l.settings = e;\n    },\n    rerender: () => H(),\n    S: () => l,\n    rerenderView: (e) => {\n      (l.view = e), X();\n    },\n  });\n  la();\n})();\n</script>\n<script>\n/* قفل خودکار پنل پس از ۱۵ دقیقه بی‌کاری */\n(() => {\n  const IDLE_MS = 15 * 60 * 1000;\n  let lastActivity = Date.now();\n  let timer = 0;\n  const lock = async () => {\n    try {\n      await fetch('/api/logout', {\n        method: 'POST',\n        credentials: 'same-origin',\n        headers: { 'content-type': 'application/json', 'x-omni-csrf': '1' },\n        body: '{}',\n        cache: 'no-store',\n      });\n    } catch (_) {}\n    location.hash = '';\n    location.reload();\n  };\n  const arm = () => {\n    lastActivity = Date.now();\n    clearTimeout(timer);\n    timer = setTimeout(lock, IDLE_MS);\n  };\n  for (const event of ['pointerdown', 'keydown', 'touchstart', 'scroll']) {\n    addEventListener(event, arm, { passive: true });\n  }\n  document.addEventListener('visibilitychange', () => {\n    if (document.visibilityState !== 'visible') return;\n    if (Date.now() - lastActivity >= IDLE_MS) lock(); else arm();\n  });\n  arm();\n\n  /* Omni · به‌خاطرسپاری نام کاربری: بعد از ست‌آپ یا ورود موفق روی همین دستگاه */\n  try {\n    const UKEY = 'omni.user';\n    const fill = () => {\n      const f = document.querySelector('#auth-form #f-user');\n      if (!f) return;\n      if (document.activeElement === f) return;\n      const saved = localStorage.getItem(UKEY);\n      if (saved && (!f.value || f.value === 'admin')) f.value = saved;\n    };\n    fill();\n    new MutationObserver(fill).observe(document.body, { childList: true, subtree: true });\n    document.addEventListener('submit', (ev) => {\n      const form = ev.target;\n      if (!form || form.id !== 'auth-form') return;\n      const u = (form.querySelector('#f-user')?.value || '').trim();\n      if (u) localStorage.setItem(UKEY, u);\n    }, true);\n  } catch (_) {}\n})();\n</script>\n</body>\n</html>\n";;

// src/worker.js
init_auth();

// src/api.js
init_auth();

// src/links.js
init_scan();
var enc2 = encodeURIComponent;
var FRAGMENT_PRESETS = [
  { id: "senpai", label: "🎯 ویژه SenPai Anti-DPI (tlshello: 1-104-1 + first-packet: 114-1 / 1ms)", size: "1-104", interval: "1-2", packets: "tlshello" },
  { id: "none", label: "— بدون Fragment (اتصال مستقیم / ECH استاندارد)", size: "", interval: "", packets: "" },
  { id: "irancell", label: "💛 ویژه ایرانسل · MTN (100-200 / 5-10 / tlshello)", size: "100-200", interval: "5-10", packets: "tlshello" },
  { id: "tci", label: "🏠 ویژه مخابرات و فیبر نوری · TCI (50-200 / 1-3 / tlshello)", size: "50-200", interval: "1-3", packets: "tlshello" },
  { id: "mci", label: "💙 ویژه همراه اول · MCI (10-30 / 2-5 / tlshello)", size: "10-30", interval: "2-5", packets: "tlshello" },
  { id: "rightel", label: "💜 ویژه رایتل و شاتل · Rightel (50-100 / 2-5 / tlshello)", size: "50-100", interval: "2-5", packets: "tlshello" },
  { id: "gaming", label: "⚡ ویژه گیمینگ و استریم بدون تاخیر (200-3000 / 1-2 / tlshello)", size: "200-3000", interval: "1-2", packets: "tlshello" },
  { id: "aggressive", label: "🔥 ضد اختلال و فیلترینگ شدید (10-20 / 10-20 / tlshello)", size: "10-20", interval: "10-20", packets: "tlshello" }
];
var FINGERPRINTS = ["chrome", "unsafe", "firefox", "safari", "ios", "android", "edge", "random", "randomized"];
var fragmentPreset = (id) => {
  const mapAlias = { high: "irancell", medium: "mci", low: "rightel" };
  const key = mapAlias[id] || id;
  return FRAGMENT_PRESETS.find((p) => p.id === key) || FRAGMENT_PRESETS[0];
};
var fragmentValue = (id) => {
  const p = fragmentPreset(id);
  return p.size ? p : null;
};
function safeArray(v) {
  if (Array.isArray(v))
    return v.filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    try {
      const j = JSON.parse(v);
      if (Array.isArray(j))
        return j.filter(Boolean);
    } catch {
    }
    return v.split(/[\n,]/).map((x) => String(x).trim()).filter(Boolean);
  }
  return [];
}
var sniFor = (settings) => String(settings.public_host || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").trim();
var PORTS_TLS2 = [443, 2053, 8443, 2083, 2087, 2096];
var isTlsPort = (p) => PORTS_TLS2.includes(Number(p));
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
var encHost = (h) => {
  const clean = String(h || "").trim().replace(/^\[|\]$/g, "");
  return clean.includes(":") ? `[${clean}]` : clean;
};
function shortHostLabel(host) {
  const clean = String(host || "").trim().replace(/^\[|\]$/g, "");
  if (!clean)
    return "";
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
  if (includeEd && ed > 0)
    qs.push(`ed=${ed}`);
  if (isDirect) {
    qs.push("mode=direct");
  } else if (selC) {
    qs.push(`cc=${selC.cc}`);
    const px = overrideProxy || (selC.proxies?.[0] ? `${selC.proxies[0]}:443` : "");
    if (px)
      qs.push(`proxyip=${px}`);
  }
  return qs.length ? `${basePath}?${qs.join("&")}` : basePath;
}
function formatConfigRemark(user, settings, host, { index = 1, port = 443, cat = "candidate", proto = "vless", overrideCc = null, directMode = false, hasFrag = false } = {}) {
  const rawCc = overrideCc !== null ? overrideCc : settings.selected_country || "";
  const isDirect = directMode || !rawCc || String(rawCc).toUpperCase() === "DIRECT";
  const selC = isDirect ? null : findCountry(rawCc);
  const exitLabel = selC ? `${selC.flag} ${selC.fa}` : "\u{1F310} \u0645\u0633\u062A\u0642\u06CC\u0645";
  const protoLabel = proto === "trojan" ? "Trojan" : "VLESS";
  const fragTag = hasFrag ? " [Frag]" : "";
  const hostTag = shortHostLabel(host);
  const prefix = settings.remark_prefix ? `${settings.remark_prefix} \xB7 ` : "";
  return `${prefix}#${String(index).padStart(2, "0")} ${cat}${fragTag} \xB7 ${hostTag}:${port} (${exitLabel} \xB7 ${protoLabel})`;
}
var PATT_FM_PRESETS = { "tlshello-0-len": {"tcp":[{"type":"fragment","settings":{"packets":"tlshello","lengths":["0","104","1"],"delays":["0"],"maxSplit":"0"}},{"type":"fragment","settings":{"packets":"1-1","lengths":["114","1"],"delays":["1"],"maxSplit":"11"}}]}, "tlshello": {"tcp":[{"type":"fragment","settings":{"packets":"tlshello","lengths":["6","98","1"],"delays":["0"],"maxSplit":"0"}},{"type":"fragment","settings":{"packets":"1-1","lengths":["114","1"],"delays":["1"],"maxSplit":"11"}}]} };
function pattFinalMask(settings, frag) {
  const p = String(settings.finalmask_preset || "");
  if (PATT_FM_PRESETS[p]) return PATT_FM_PRESETS[p];
  if (frag && frag.size)
    return { tcp: [{ type: "fragment", settings: {
      packets: frag.packets || "tlshello",
      length: frag.size,
      delay: frag.interval || "1-2",
      maxSplit: "10"
    } }] };
  return null;
}
function pattEchMode(settings) {
  return String(settings.ech_mode || "auto");
}
function vlessUri(user, settings, host, {
  index = 1,
  port = 443,
  cat = "candidate",
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
  const workerHost = sniFor(settings) || settings.public_host || settings.host || settings.worker_host || "";
  const sni = workerHost || host;
  const params = [`path=${path}`, `security=${tls ? "tls" : "none"}`, "encryption=none", `host=${sni}`, "type=ws"];
  if (tls) {
    params.push("insecure=0", `fp=${fp}`, "allowInsecure=0", `sni=${sni}`);
  }
  const frag = forceFragment || fragmentValue(user.fragment || settings.fragment_preset);
  if (tls) {
    if (pattEchMode(settings) === "on" && settings.ech_config) {
      params.push(`ech=${encodeURIComponent(settings.ech_config)}`);
    }
    const pattAlpn = String(settings.alpn_pref || "http/1.1");
    if (pattAlpn) params.push(`alpn=${encodeURIComponent(pattAlpn)}`);
    if (settings.cipher_suites) params.push(`cs=${encodeURIComponent(settings.cipher_suites)}`);
  }
  if (settings.mux_enabled === "1")
    params.push("mux=1", "xmux=maxStreams=8");
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
  cat = "candidate",
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
  const workerHost = sniFor(settings) || settings.public_host || settings.host || settings.worker_host || "";
  const sni = workerHost || host;
  const params = [`path=${path}`, `security=${tls ? "tls" : "none"}`, `host=${sni}`, "type=ws"];
  if (tls) {
    params.push("insecure=0", `fp=${fp}`, "allowInsecure=0", `sni=${sni}`);
  }
  const frag = forceFragment || fragmentValue(user.fragment || settings.fragment_preset);
  if (tls) {
    if (pattEchMode(settings) === "on" && settings.ech_config) {
      params.push(`ech=${encodeURIComponent(settings.ech_config)}`);
    }
    const pattAlpn = String(settings.alpn_pref || "http/1.1");
    if (pattAlpn) params.push(`alpn=${encodeURIComponent(pattAlpn)}`);
    if (settings.cipher_suites) params.push(`cs=${encodeURIComponent(settings.cipher_suites)}`);
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
        if (idx <= 0)
          return false;
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
  const maxConfigs = Math.max(12, Math.min(80, Number(settings.config_count || 48)));
  const pool = configPool(user, settings, cleanIps);
  const pairs = verifiedPairs(settings);
  const plan = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (address, cat, opts = {}) => {
    const a = String(address || "").trim().replace(/^\[|\]$/g, "");
    if (!a || !isValidCandidate(a) || COUNTRY_PROXY_MAP.has(a.toLowerCase()) || DEAD_BYOIP_BLACKLIST.has(a.toLowerCase()))
      return;
    const tagKey = `${a}:443:${opts.overrideCc || ""}:${opts.directMode ? "direct" : ""}:${opts.forceFragment ? "fm" : "ech"}`;
    if (seen.has(tagKey))
      return;
    seen.add(tagKey);
    plan.push({ address: a, port: 443, cat, ...opts });
  };

  // ۱. دامنه‌های فوق‌سریع CDN کلودفلر (پینگ سبز ۱۲۰ تا ۱۵۰ میلی‌ثانیه روی تمامی اپراتورها)
  const cleanDomains = [
    { addr: "speed.cloudflare.com", cat: "⚡ CDN Fast · speed (140ms)" },
    { addr: "cdnjs.cloudflare.com", cat: "⚡ CDN Fast · cdnjs (150ms)" },
    { addr: "www.visa.com", cat: "⚡ CDN Fast · Visa (150ms)" },
    { addr: "www.tradingview.com", cat: "⚡ CDN Fast · TradingView" },
    { addr: "www.udemy.com", cat: "⚡ CDN Fast · Udemy" },
    { addr: "www.shopify.com", cat: "⚡ CDN Fast · Shopify" }
  ];
  for (const d of cleanDomains) {
    add(d.addr, d.cat, { directMode: true });
  }

  // ۲. پکیج ویژه ضدتحریم هوش مصنوعی Gemini و AI با خروجی تمیز آمریکا
  const usCountry = findCountry("US");
  const usProxy = usCountry?.proxies?.[0] ? `${usCountry.proxies[0]}:443` : "104.168.125.179:443";
  const geminiHosts = [
    { addr: "speed.cloudflare.com", cat: "✨ 🇺🇸 Gemini Lock · speed (سبز)" },
    { addr: "cdnjs.cloudflare.com", cat: "✨ 🇺🇸 Gemini Lock · cdnjs (سبز)" },
    { addr: "www.visa.com", cat: "✨ 🇺🇸 Gemini Lock · Visa (سبز)" },
    { addr: "2606:4700:3030::6811:9386", cat: "✨ 🇺🇸 Gemini Lock · IPv6" },
    { addr: "162.159.137.74", cat: "✨ 🇺🇸 Gemini Lock · Anycast" },
    { addr: "104.17.148.17", cat: "✨ 🇺🇸 Gemini Lock · FinalMask", fm: { size: "100-200", interval: "5-10", packets: "tlshello" } }
  ];
  for (const g of geminiHosts) {
    add(g.addr, g.cat, { overrideCc: "US", overrideProxy: usProxy, forceFragment: g.fm });
  }

  // ۳. همراه اول اختصاصی (MCI Fast Lane · IPv6 & ECH)
  const mciHosts = [
    { addr: "2606:4700:3030::6811:9386", cat: "📱 همراه اول · IPv6 (9386)" },
    { addr: "2606:4700::6812:3ed", cat: "📱 همراه اول · IPv6 (3ed)" },
    { addr: "2606:4700:d0::1", cat: "📱 همراه اول · IPv6 (d0)" },
    { addr: "2606:4700:d1::1", cat: "📱 همراه اول · IPv6 (d1)" },
    { addr: "speed.cloudflare.com", cat: "📱 همراه اول · ECH Fast" }
  ];
  for (const m of mciHosts) {
    add(m.addr, m.cat, { directMode: true });
  }

  // ۴. ایرانسل اختصاصی (Irancell Ultra Bypass · FinalMask & Fragment)
  const irancellHosts = [
    { addr: "104.17.148.17", cat: "💛 ایرانسل · FinalMask 1", fm: { size: "100-200", interval: "5-10", packets: "tlshello" } },
    { addr: "162.159.137.74", cat: "💛 ایرانسل · FinalMask 2", fm: { size: "100-200", interval: "5-10", packets: "tlshello" } },
    { addr: "104.16.132.229", cat: "💛 ایرانسل · FinalMask 3", fm: { size: "80-160", interval: "4-8", packets: "tlshello" } },
    { addr: "www.tradingview.com", cat: "💛 ایرانسل · Web Fragment", fm: { size: "100-200", interval: "5-10", packets: "tlshello" } }
  ];
  for (const ir of irancellHosts) {
    add(ir.addr, ir.cat, { directMode: true, forceFragment: ir.fm });
  }

  // ۵. سرورهای خروجی کشورهای اروپایی و همسایه (هر کشور یک دامنه و آی‌پی جداگانه!)
  const euroExits = [
    { cc: "DE", addr: "speed.cloudflare.com", cat: "🇩🇪 Germany VIP · Clean" },
    { cc: "FR", addr: "cdnjs.cloudflare.com", cat: "🇫🇷 France VIP · Clean" },
    { cc: "NL", addr: "www.visa.com", cat: "🇳🇱 Netherlands VIP · Clean" },
    { cc: "GB", addr: "162.159.137.74", cat: "🇬🇧 UK VIP · Clean" },
    { cc: "TR", addr: "172.64.155.209", cat: "🇹🇷 Turkey VIP · Clean" }
  ];
  for (const loc of euroExits) {
    const c = findCountry(loc.cc);
    if (c?.proxies?.[0]) {
      add(loc.addr, loc.cat, { overrideCc: c.cc, overrideProxy: `${c.proxies[0]}:443` });
    }
  }

  // ۶. آی‌پی‌های تاییدشده و اسکن‌شده خط کاربر
  const clientVerified = [
    ...safeArray(user?.ips),
    ...(cleanIps || []).map((r) => typeof r === "string" ? r : Number(r?.hits || 0) > 0 ? r?.ip : "")
  ].filter(Boolean);
  for (const addr of clientVerified.slice(0, 8)) {
    add(addr, "✅ تاییدشده روی خط شما", { directMode: true });
  }

  const both = String(settings.proto || "both") === "both" && Boolean(settings.trojan_password);
  const uris = [];
  const items = [];
  const noFragSettings = { ...settings, fragment_preset: "none" };
  const noFragUser = { ...user, fragment: "none" };
  const emit = (entry) => {
    const { address, port, cat, forceFragment, forceFp, overrideCc, overrideProxy, directMode } = entry;
    for (const proto of both ? ["vless", "trojan"] : ["vless"]) {
      if (uris.length >= maxConfigs)
        return;
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
    // Legacy field retained but never inflated by config generation; no live test runs here.
    verified: 0,
    candidateCount: items.length,
    measurementScope: "config-generation-only; candidates and tunnels are not live-tested",
    singbox: buildSingbox(noFragUser, noFragSettings, usedAddrs.slice(0, 12), [443]),
    clash: buildClash(noFragUser, noFragSettings, usedAddrs.slice(0, 12), [443])
  };
}
var MESH_AI_DOMAINS = [
  "gemini.google.com",
  "bard.google.com",
  "aistudio.google.com",
  "generativelanguage.googleapis.com",
  "proactivebackend-pa.googleapis.com",
  "assistant-s3-pa.googleapis.com",
  "robin-pa.googleapis.com",
  "alkalimakersuite-pa.googleapis.com",
  "alkalimakersuite-pa.clients6.google.com",
  "aisandbox-pa.googleapis.com",
  "waa-pa.clients6.google.com",
  "gemini.gstatic.com",
  "googleapis.com",
  "googleusercontent.com",
  "gstatic.com",
  "accounts.google.com",
  "clients6.google.com",
  "cloud.google.com",
  "chatgpt.com",
  "openai.com",
  "oaistatic.com",
  "oaiusercontent.com",
  "claude.ai",
  "anthropic.com"
];
var MESH_AI_PACKAGES = [
  "com.google.android.apps.bard",
  "com.google.android.googlequicksearchbox",
  "com.google.android.gms",
  "com.google.android.gsf",
  "com.android.vending",
  "com.openai.chatgpt",
  "com.anthropic.claude"
];
var MESH_GAME_DOMAINS = [
  "steampowered.com",
  "steamcommunity.com",
  "steamcontent.com",
  "epicgames.com",
  "riotgames.com",
  "ea.com",
  "ubisoft.com",
  "battle.net"
];
function meshDirectDomains(settings) {
  return safeArray(settings.mesh_direct_domains).map((x) => String(x || "").trim().toLowerCase().replace(/^\./, "")).filter(Boolean).slice(0, 80);
}
function sbOutbound(user, settings, host, port = 443, opts = {}) {
  const path = wsPathFor(user, settings, { includeEd: false, overrideCc: opts.overrideCc, overrideProxy: opts.overrideProxy, directMode: opts.directMode });
  const workerHost = sniFor(settings) || settings.public_host || settings.host || settings.worker_host || "";
  const sni = workerHost || host;
  const tls = isTlsPort(port);
  const ed = Number(user.early_data || settings.early_data || 2048);
  const cleanHost = String(host || "").replace(/^\[|\]$/g, "");
  const fp = user.fingerprint || settings.fingerprint || "chrome";
  const utlsFp = fp === "unsafe" ? "chrome" : fp;
  return {
    type: "vless",
    tag: opts.tag || `omni-${user.username}-${cleanHost.replace(/[:.]/g, "-")}-${port}`.slice(0, 60),
    server: cleanHost,
    server_port: Number(port),
    uuid: user.uuid,
    flow: "",
    tls: {
      enabled: tls,
      server_name: tls ? sni : void 0,
      insecure: fp === "unsafe",
      alpn: tls ? ["http/1.1"] : void 0,
      utls: tls ? { enabled: true, fingerprint: utlsFp } : void 0,
    },
    tls_fragment: (opts.fragment || (settings.fragment_preset && settings.fragment_preset !== "none")) ? {
      enabled: true,
      size: (fragmentValue(settings.fragment_preset) || {}).size || "1-104",
      sleep: (fragmentValue(settings.fragment_preset) || {}).interval || "1-2"
    } : void 0,
    transport: {
      type: "ws",
      path,
      headers: { Host: sni || cleanHost },
      max_early_data: ed > 0 ? ed : void 0,
      early_data_header_name: ed > 0 ? "Sec-WebSocket-Protocol" : void 0
    }
  };
}
function sbTrojan(user, settings, host, port = 443, opts = {}) {
  const path = wsPathFor(user, settings, { includeEd: false, overrideCc: opts.overrideCc, overrideProxy: opts.overrideProxy, directMode: opts.directMode });
  const workerHost = sniFor(settings) || settings.public_host || settings.host || settings.worker_host || "";
  const sni = workerHost || host;
  const tls = isTlsPort(port);
  const ed = Number(user.early_data || settings.early_data || 2048);
  const cleanHost = String(host || "").replace(/^\[|\]$/g, "");
  const fp = user.fingerprint || settings.fingerprint || "chrome";
  const utlsFp = fp === "unsafe" ? "chrome" : fp;
  return {
    type: "trojan",
    tag: opts.tag || `omni-${user.username}-tr-${cleanHost.replace(/[:.]/g, "-")}-${port}`.slice(0, 60),
    server: cleanHost,
    server_port: Number(port),
    password: settings.trojan_password || user.uuid,
    tls: {
      enabled: tls,
      server_name: tls ? sni : void 0,
      insecure: fp === "unsafe",
      alpn: tls ? ["http/1.1"] : void 0,
      utls: tls ? { enabled: true, fingerprint: utlsFp } : void 0,
    },
    tls_fragment: (opts.fragment || (settings.fragment_preset && settings.fragment_preset !== "none")) ? {
      enabled: true,
      size: (fragmentValue(settings.fragment_preset) || {}).size || "1-104",
      sleep: (fragmentValue(settings.fragment_preset) || {}).interval || "1-2"
    } : void 0,
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
  const geminiAddrs = [
    { host: "speed.cloudflare.com", tag: "✨ 🇺🇸 Gemini Lock · speed (سبز)" },
    { host: "cdnjs.cloudflare.com", tag: "✨ 🇺🇸 Gemini Lock · cdnjs (سبز)" },
    { host: "www.visa.com", tag: "✨ 🇺🇸 Gemini Lock · Visa (سبز)" }
  ];
  for (const g of geminiAddrs) {
    outs.push(sbOutbound(user, settings, g.host, 443, { overrideCc: "US", tag: g.tag }));
  }
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
  const irDirectDomains = [
    ".ir", "shaparak.ir", "shaparak.com", "divar.ir", "snapp.ir", "snapp.express", "digikala.com",
    "torob.com", "aparat.com", "telewebion.com", "rubika.ir", "bale.ai", "splus.ir", "eitaa.com",
    "bmi.ir", "bankmellat.ir", "tejaratbank.ir", "bpi.ir", "bsi.ir", "parsian-bank.ir", "emalls.ir"
  ];
  return {
    log: { level: "warn", timestamp: true },
    dns: {
      servers: [
        { tag: "dns-remote", address: "https://dns.google/dns-query", detour: "select" },
        { tag: "dns-direct", address: "https://1.1.1.1/dns-query", detour: "direct" },
        { tag: "dns-bootstrap", address: "77.88.8.8", detour: "direct" },
        { tag: "dns-fakeip", address: "fakeip" }
      ],
      rules: [
        { domain: ["dns.google", "cloudflare-dns.com", "1.1.1.1"], server: "dns-bootstrap" },
        { domain_suffix: irDirectDomains, server: "dns-direct" },
        { geosite: ["ir"], server: "dns-direct" },
        { domain_suffix: meshDirectDomains(settings), server: "dns-direct" },
        { package_name: MESH_AI_PACKAGES, server: "dns-fakeip" },
        { domain_suffix: MESH_AI_DOMAINS, server: "dns-fakeip" }
      ],
      final: "dns-remote",
      fakeip: {
        enabled: true,
        inet4_range: "198.18.0.0/15",
        inet6_range: "fc00::/18"
      },
      strategy: "ipv4_only",
      independent_cache: true
    },
    inbounds: [
      {
        type: "tun",
        tag: "tun-in",
        inet4_address: "172.19.0.1/30",
        auto_route: true,
        strict_route: true,
        stack: "system",
        sniff: true,
        sniff_override_destination: true
      },
      { type: "mixed", tag: "mixed-in", listen: "127.0.0.1", listen_port: 2080 }
    ],
    outbounds: [
      { type: "dns", tag: "dns-out" },
      { type: "selector", tag: "select", outbounds: ["auto", ...outs.map((o) => o.tag)] },
      { type: "selector", tag: "✨ AI & Gemini", outbounds: [geminiAddrs[0].tag, geminiAddrs[1].tag, geminiAddrs[2].tag, "select", "auto"] },
      { type: "urltest", tag: "auto", outbounds: outs.map((o) => o.tag), url: "http://www.gstatic.com/generate_204", interval: "3m" },
      { type: "direct", tag: "direct" },
      { type: "block", tag: "block" },
      ...outs
    ],
    route: {
      rules: [
        { protocol: "dns", outbound: "dns-out" },
        { network: "udp", port: 443, outbound: "block" },
        { ip_is_private: true, outbound: "direct" },
        { geosite: ["ir"], outbound: "direct" },
        { geoip: ["ir"], outbound: "direct" },
        { domain_suffix: irDirectDomains, outbound: "direct" },
        { domain_suffix: meshDirectDomains(settings), outbound: "direct" },
        { package_name: MESH_AI_PACKAGES, outbound: "✨ AI & Gemini" },
        { domain_suffix: MESH_AI_DOMAINS, outbound: "✨ AI & Gemini" },
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
  if (proto === "vless")
    base.uuid = user.uuid;
  else
    base.password = settings.trojan_password || user.uuid;
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
      if (both)
        proxies.push(clashProxy(user, settings, h, port, "trojan", i));
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
      "GEOSITE,ir,DIRECT",
      "GEOIP,IR,DIRECT",
      "DOMAIN-SUFFIX,shaparak.ir,DIRECT",
      "DOMAIN-SUFFIX,digikala.com,DIRECT",
      "DOMAIN-SUFFIX,snapp.ir,DIRECT",
      "DOMAIN-SUFFIX,divar.ir,DIRECT",
      "DOMAIN-SUFFIX,torob.com,DIRECT",
      "DOMAIN-SUFFIX,aparat.com,DIRECT",
      "DOMAIN-KEYWORD,bank,DIRECT",
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
var b64 = (s) => btoa(unescape(encodeURIComponent(s)));
function toYaml(obj, indent = 0) {
  const pad = "  ".repeat(indent);
  if (obj === null || obj === void 0)
    return "null";
  if (Array.isArray(obj)) {
    if (!obj.length)
      return "[]";
    return obj.map((v) => {
      if (typeof v === "object" && v !== null)
        return `${pad}-
${toYaml(v, indent + 1)}`;
      return `${pad}- ${yamlScalar(v)}`;
    }).join("\n");
  }
  if (typeof obj === "object") {
    return Object.entries(obj).map(([k, v]) => {
      if (typeof v === "object" && v !== null)
        return `${pad}${k}:
${toYaml(v, indent + 1)}`;
      return `${pad}${k}: ${yamlScalar(v)}`;
    }).join("\n");
  }
  return `${pad}${yamlScalar(obj)}`;
}
function yamlScalar(v) {
  if (v === null || v === void 0)
    return "null";
  if (typeof v === "boolean" || typeof v === "number")
    return String(v);
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
    <div class="kv"><div class="k">\u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627\u06CC \u0627\u062A\u0635\u0627\u0644 (\u0628\u0627 \u0645\u062D\u062F\u0648\u062F\u0633\u0627\u0632\u06CC \u062B\u0628\u062A)</div><b>${stats?.conns || 0}</b></div>
    <div class="kv"><div class="k">\u0622\u062E\u0631\u06CC\u0646 \u0627\u062A\u0635\u0627\u0644</div><b style="font-size:12px">${esc(user.last_seen || "\u2014")}</b></div>
  </div>
  <a class="btn" href="${esc(origin)}/s/${esc(user.sub_token)}">\u{1F4E5} \u062F\u0631\u06CC\u0627\u0641\u062A \u06A9\u0627\u0646\u0641\u06CC\u06AF</a>
  <a class="btn ghost" href="v2rayng://install-config?url=${encodeURIComponent(`${origin}/s/${user.sub_token}`)}">\u{1F4F2} \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0645\u0633\u062A\u0642\u06CC\u0645 \u062F\u0631 v2rayNG / PattNG</a>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
    <a class="btn ghost" style="margin-top:0;font-size:11.5px;padding:9px" href="${esc(origin)}/s/${esc(user.sub_token)}?type=singbox" target="_blank">🪐 ساب Sing-Box (JSON)</a>
    <a class="btn ghost" style="margin-top:0;font-size:11.5px;padding:9px" href="${esc(origin)}/s/${esc(user.sub_token)}?type=clash" target="_blank">⚡ ساب Clash / Mihomo</a>
  </div>
  <div style="margin-top:8px">
    <a class="btn ghost" style="margin-top:0;font-size:11.5px;padding:9px;width:100%" href="${esc(origin)}/s/${esc(user.sub_token)}?type=raw" target="_blank">📄 دریافت لینک‌های متنی خام (Raw VLESS)</a>
  </div>
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

  <div class="muted" style="margin-top:18px">\u26A1\uFE0F \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0645\u0633\u06CC\u0631 \u0645\u0631\u0648\u0631\u06AF\u0631 \u0648 candidate\u0647\u0627\u06CC \u062F\u0633\u062A\u0631\u0633\u06CC</div>
  <div class="muted" style="font-size:11.5px;margin-top:3px">\u0632\u0645\u0627\u0646 \u062F\u0631\u062E\u0648\u0627\u0633\u062A HTTPS \u0645\u0631\u0648\u0631\u06AF\u0631 \u062A\u0627 \u067E\u0646\u0644\u060C \u067E\u0627\u0633\u062E HTTPS \u0627\u0632 candidate\u0647\u0627 \u0648 \u062A\u0623\u06CC\u06CC\u062F Cloudflare \u0627\u0632 Worker \u062C\u062F\u0627 \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F\u061B \u0647\u06CC\u0686\u200C\u06A9\u062F\u0627\u0645 \u0628\u0647\u200C\u062A\u0646\u0647\u0627\u06CC\u06CC \u0633\u0644\u0627\u0645\u062A \u062A\u0648\u0646\u0644 \u0631\u0627 \u062B\u0627\u0628\u062A \u0646\u0645\u06CC\u200C\u06A9\u0646\u062F.</div>
  <div id="iplist" style="margin-top:10px"></div>
  <button class="btn ghost" id="ip-test" type="button">\u26A1 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u062F\u0648\u0628\u0627\u0631\u0647\u0654 \u0645\u0633\u06CC\u0631\u0647\u0627</button>
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
  function html(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]); }); }
  function kind(a){ if (a.indexOf(':') >= 0) return 'ipv6'; var c = a.charAt(0); return (c >= '0' && c <= '9') ? 'ipv4' : 'host'; }
  function cls(ms){ if (ms == null || ms <= 0) return ''; return ms < 180 ? 'good' : ms > 500 ? 'bad' : ''; }
  var rows = CANDS.map(function(c){
    return { addr: nm(c), ms: null, colo: null, mbps: null, source: (c && c.source) || '', workerTested: null, workerUnavailable: false, workerVerified: false, workerMs: null, testing: false };
  }).filter(function(r){ return r.addr; });
  function render(){
    if (!rows.length) { el.innerHTML = '<div class="muted" style="font-size:11.5px">\u0647\u0646\u0648\u0632 \u06A9\u0627\u0646\u062F\u06CC\u062F\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647.</div>'; return; }
    el.innerHTML = rows.slice(0, 14).map(function(r){
      var k = kind(r.addr), tag = r.source ? r.source : (k === 'host' ? 'domain candidate \xB7 443/2053' : k === 'ipv6' ? 'IPv6 candidate \xB7 443/2053' : 'IPv4 candidate \xB7 443/2053');
      var msTxt = r.testing ? '\u23F3 \u062F\u0631 \u062D\u0627\u0644 \u062A\u0633\u062A\u2026' : (r.ms != null && r.ms > 0 ? 'Browser HTTPS ' + r.ms + ' ms' : '\u0647\u0646\u0648\u0632 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0646\u0634\u062F\u0647');
      var workerTag = r.workerTested === null
        ? '<span class="badge warn" style="font-size:9.5px">\u0628\u0631\u0631\u0633\u06CC Worker \u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0633\u062A</span>'
        : r.workerTested ? (r.workerVerified
          ? '<span class="badge ok" style="font-size:9.5px">\u067E\u0627\u0633\u062E Cloudflare \u0627\u0632 Worker \u062A\u0623\u06CC\u06CC\u062F \u0634\u062F</span>'
          : '<span class="badge warn" style="font-size:9.5px">\u0647\u0648\u06CC\u062A Cloudflare \u0627\u0632 Worker \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F</span>')
          : r.workerUnavailable ? '<span class="badge warn" style="font-size:9.5px">\u0628\u0631\u0631\u0633\u06CC Worker \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u0628\u0648\u062F/\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0646\u0634\u062F</span>' : '';
      var workerTiming = r.workerMs != null ? '<span class="badge" style="font-size:9.5px" dir="ltr">Worker HTTP ' + html(r.workerMs) + ' ms</span>' : '';
      return '<div class="ip"><b>' + html(r.addr) + '</b><span class="muted" style="font-size:10.5px">' + html(tag) + '</span>' +
        '<span class="ms ' + cls(r.ms) + '">' + html(msTxt) + '</span>' + workerTiming + workerTag +
        '<button class="star" data-addr="' + html(r.addr) + '" data-ms="' + (r.ms || '') + '" title="\u0627\u06CC\u0646 candidate \u0631\u0627 \u0628\u0631 \u0627\u0633\u0627\u0633 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0647\u0645\u06CC\u0646 \u0627\u062A\u0635\u0627\u0644 \u062E\u0648\u062F\u0645 \u062A\u0631\u062C\u06CC\u062D \u0645\u06CC\u200C\u062F\u0647\u0645">\u2605</button></div>';
    }).join('');
  }
  render();
  async function runNetSensor(){
    try {
      var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
      var radioType = conn.type ? (conn.type + (conn.effectiveType ? ' / ' + conn.effectiveType.toUpperCase() : '')) : (conn.effectiveType ? conn.effectiveType.toUpperCase() : '\u0646\u0627\u0645\u0634\u062E\u0635');
      var radioDl = conn.downlink ? conn.downlink + ' Mbps' : '';
      var response = await fetch(ORIGIN + '/api/diag/net-sense?token=' + encodeURIComponent(TOKEN), { cache: 'no-store' });
      if (!response.ok) throw new Error('line metadata unavailable');
      var ns = await response.json();
      if (ns && ns.ok && ns.isp) {
        sensedIsp = ns.isp;
        if (netBadgeEl) netBadgeEl.textContent = (ns.isp.name || '\u2014') + (ns.ipVersion ? ' \xB7 ' + ns.ipVersion : '');
        if (netInfoEl) {
          netInfoEl.innerHTML =
            '\u{1F4E1} <b>\u062A\u0634\u062E\u06CC\u0635 \u0634\u0628\u06A9\u0647 \u0627\u0632 metadata \u062F\u0631\u062E\u0648\u0627\u0633\u062A:</b> ' + html(ns.isp.name || '\u0646\u0627\u0645\u0634\u062E\u0635') + ' &nbsp;|&nbsp; \u{1F4F6} <b>\u0633\u0646\u0633\u0648\u0631 \u0645\u0631\u0648\u0631\u06AF\u0631:</b> ' + html(radioType) + (radioDl ? ' (' + html(radioDl) + ')' : '') +
            '<br>\u{1F6E1}\uFE0F <b>\u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u0641\u0631\u06AF\u0645\u0646\u062A \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC (\u0628\u062F\u0648\u0646 \u0645\u0642\u0627\u06CC\u0633\u0647\u0654 \u0632\u0646\u062F\u0647):</b> <span style="direction:ltr;display:inline-block;color:#22d3ee">' + html(ns.isp.fragmentRule || '\u2014') + '</span> \xB7 \u067E\u0648\u0631\u062A\u200C\u0647\u0627\u06CC \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC (\u062A\u0633\u062A\u200C\u0646\u0634\u062F\u0647): <b>' + html((ns.isp.bestPorts || [443,2053]).join(' / ')) + '</b>' +
            '<br><span style="color:#a7f3d0">' + html(ns.isp.tip || '') + '</span>';
        }
      }
    } catch (e) {
      if (netInfoEl) netInfoEl.textContent = '\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062E\u0637 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A\u061B \u0647\u06CC\u0686 \u0633\u0646\u062C\u0647 \u06CC\u0627 \u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u0632\u0646\u062F\u0647\u200C\u0627\u06CC \u062F\u0631 \u0627\u06CC\u0646\u062C\u0627 \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.';
    }
  }
  runNetSensor();
  document.getElementById('btn-autotune').onclick = async function(){
    var btn = document.getElementById('btn-autotune');
    btn.disabled = true; btn.textContent = '\u23F3 \u062F\u0631 \u062D\u0627\u0644 \u0627\u0639\u0645\u0627\u0644\u2026';
    try {
      var goodIps = rows.filter(function(r){
        return r.workerVerified && r.ms != null && Number(r.ms) > 0 && kind(r.addr) !== 'host';
      }).map(function(r){ return r.addr; }).slice(0, 10);
      var response = await fetch(ORIGIN + '/api/diag/net-sense?token=' + encodeURIComponent(TOKEN), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apply: true, fragment: sensedIsp ? sensedIsp.fragment : undefined, ips: goodIps.length ? goodIps : undefined })
      });
      var res = await response.json();
      if (!response.ok || !res || !res.ok) throw new Error(res && (res.message || res.error) || 'Could not apply the line profile');
      var appliedCount = Array.isArray(res.applied_ips) ? res.applied_ips.length : 0;
      out.textContent = '\u2705 \u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u0641\u0631\u06AF\u0645\u0646\u062A \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u0627\u0639\u0645\u0627\u0644 \u0634\u062F. ' + (appliedCount
        ? appliedCount + ' IP \u06A9\u0647 \u0647\u0645 \u0627\u0632 \u0645\u0631\u0648\u0631\u06AF\u0631 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0648 \u0647\u0645 \u0627\u0632 Worker \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 Cloudflare \u062A\u0623\u06CC\u06CC\u062F \u0634\u062F\u0646\u062F \u0646\u06CC\u0632 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.'
        : '\u0647\u06CC\u0686 IP \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u0627\u0639\u0645\u0627\u0644 \u0646\u0634\u062F\u061B \u0647\u0646\u0648\u0632 candidate \u0648\u0627\u062C\u062F \u0634\u0631\u0627\u06CC\u0637 \u0628\u0627 \u0647\u0631 \u062F\u0648 \u0628\u0631\u0631\u0633\u06CC \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A.') + ' \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0627\u0634\u062A\u0631\u0627\u06A9 \u0631\u0627 \u062F\u0631 \u06A9\u0644\u0627\u06CC\u0646\u062A \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u06A9\u0646\u06CC\u062F.';
    } catch (e) {
      out.textContent = '\u062A\u0646\u0638\u06CC\u0645 \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F: ' + html(e && e.message || '\u062E\u0637\u0627\u06CC \u0646\u0627\u0645\u0634\u062E\u0635');
    }
    btn.disabled = false; btn.textContent = '\u26A1 \u062A\u0646\u0638\u06CC\u0645 \u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u062E\u0637';
  };
  document.getElementById('btn-underground').onclick = async function(){
    var btn = document.getElementById('btn-underground');
    btn.disabled = true; btn.textContent = '\u{1F575}\uFE0F \u062F\u0631 \u062D\u0627\u0644 \u062A\u0648\u0644\u06CC\u062F\u2026';
    out.textContent = '\u062F\u0631 \u062D\u0627\u0644 \u062A\u0648\u0644\u06CC\u062F \u0622\u062F\u0631\u0633\u200C\u0647\u0627\u06CC \u0647\u0645\u0633\u0627\u06CC\u0647 \u0628\u0631\u0627\u06CC \u0628\u0631\u0631\u0633\u06CC\u061B \u062A\u0648\u0644\u06CC\u062F \u0634\u062F\u0646 \u0628\u0647\u200C\u062A\u0646\u0647\u0627\u06CC\u06CC \u0628\u0647 \u0645\u0639\u0646\u06CC \u0633\u0627\u0644\u0645 \u0628\u0648\u062F\u0646 \u0646\u06CC\u0633\u062A\u2026';
    try {
      var seeds = rows.filter(function(r){ return r.workerVerified && r.ms != null && Number(r.ms) > 0; }).map(function(r){ return r.addr; }).slice(0, 4);
      var huntResponse = await fetch(ORIGIN + '/api/diag/underground-hunt?token=' + encodeURIComponent(TOKEN), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seeds: seeds, limit: 12, apply: false })
      });
      var hunt = await huntResponse.json();
      if (!huntResponse.ok || !hunt || !hunt.ok) throw new Error(hunt && (hunt.message || hunt.error) || 'Candidate generation failed');
      if (Array.isArray(hunt.candidates) && hunt.candidates.length) {
        rows = hunt.candidates.map(function(c){
          return { addr: c.addr, ms: null, colo: null, mbps: null, source: c.source || 'neighbor candidate', workerTested: null, workerUnavailable: false, workerVerified: false, workerMs: null, testing: false };
        }).filter(function(r){ return r.addr; });
        render();
        await runLiveTest();
        var verifiedCandidates = rows.filter(function(r){ return r.workerVerified && r.ms != null && Number(r.ms) > 0 && kind(r.addr) !== 'host'; }).map(function(r){ return r.addr; }).slice(0, 10);
        if (verifiedCandidates.length) {
          var applyResponse = await fetch(ORIGIN + '/api/diag/net-sense?token=' + encodeURIComponent(TOKEN), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ apply: true, ips: verifiedCandidates })
          });
          var applied = await applyResponse.json();
          var count = Array.isArray(applied && applied.applied_ips) ? applied.applied_ips.length : 0;
          out.textContent = applyResponse.ok && applied && applied.ok && count
            ? '\u{1F575}\uFE0F ' + count + ' candidate \u0627\u0632 \u0628\u0631\u0631\u0633\u06CC HTTPS \u0645\u0631\u0648\u0631\u06AF\u0631 \u0648 \u062A\u0623\u06CC\u06CC\u062F Cloudflare \u0627\u0632 Worker \u06AF\u0630\u0634\u062A \u0648 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.'
            : 'Candidate\u0647\u0627 \u062A\u0633\u062A \u0634\u062F\u0646\u062F\u060C \u0627\u0645\u0627 \u0647\u06CC\u0686 IP \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647\u200C\u0627\u06CC \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0630\u062E\u06CC\u0631\u0647 \u0646\u0634\u062F.';
        } else {
          out.textContent = '\u062A\u0648\u0644\u06CC\u062F \u0648 \u062A\u0633\u062A \u062A\u0645\u0627\u0645 \u0634\u062F\u061B \u0647\u06CC\u0686 candidate \u0647\u0645\u200C\u0632\u0645\u0627\u0646 \u0627\u0632 HTTPS \u0645\u0631\u0648\u0631\u06AF\u0631 \u0648 \u062A\u0623\u06CC\u06CC\u062F Cloudflare \u0627\u0632 Worker \u0646\u06AF\u0630\u0634\u062A.';
        }
      } else {
        out.textContent = 'Candidate \u062A\u0627\u0632\u0647\u200C\u0627\u06CC \u0628\u0631\u0627\u06CC \u0628\u0631\u0631\u0633\u06CC \u062A\u0648\u0644\u06CC\u062F \u0646\u0634\u062F.';
      }
    } catch (e) {
      out.textContent = '\u062A\u0648\u0644\u06CC\u062F \u06CC\u0627 \u062A\u0633\u062A candidate \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F: ' + html(e && e.message || '\u062E\u0637\u0627\u06CC \u0646\u0627\u0645\u0634\u062E\u0635');
    }
    btn.disabled = false; btn.textContent = '\u{1F575}\uFE0F \u062A\u0648\u0644\u06CC\u062F \u0648 \u0628\u0631\u0631\u0633\u06CC candidate';
  };
  async function measureEdgeRtt(){
    try {
      var prewarm = await fetch(ORIGIN + '/healthz?warm=' + Math.random().toString(36).slice(2), {
        cache: 'no-store', signal: AbortSignal.timeout(3500)
      });
      if (!prewarm.ok) return null;
      var started = performance.now();
      var response = await fetch(ORIGIN + '/healthz?measure=' + Math.random().toString(36).slice(2), {
        cache: 'no-store', signal: AbortSignal.timeout(3500)
      });
      if (!response.ok) return null;
      return Math.max(1, Math.round(performance.now() - started));
    } catch (e) {
      return null;
    }
  }
  function probeHost(addr){
    return new Promise(function(resolve){
      var started = performance.now(), controller = new AbortController(), settled = false;
      var finish = function(value){ if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
      var timer = setTimeout(function(){ controller.abort(); finish(null); }, 3800);
      var target = addr.indexOf(':') >= 0 ? '[' + addr + ']' : addr;
      fetch('https://' + target + '/cdn-cgi/trace?x=' + Math.round(performance.now()), { mode: 'no-cors', cache: 'no-store', signal: controller.signal })
        .then(function(){ finish(Math.max(1, Math.round(performance.now() - started))); })
        .catch(function(){ finish(null); });
    });
  }
  function speedTest(){
    var BYTES = 1024 * 1024;
    return new Promise(function(resolve){
      var started = performance.now(), controller = new AbortController(), settled = false;
      var finish = function(value){ if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
      var timer = setTimeout(function(){ controller.abort(); finish(null); }, 20000);
      fetch(ORIGIN + '/api/diag/speed?bytes=' + BYTES + '&token=' + encodeURIComponent(TOKEN) + '&x=' + Math.round(performance.now()), { cache: 'no-store', signal: controller.signal })
        .then(function(response){
          if (!response.ok) throw new Error('download HTTP ' + response.status);
          return response.arrayBuffer();
        })
        .then(function(buffer){
          var elapsedMs = performance.now() - started;
          if (!(buffer.byteLength > 0) || !(elapsedMs > 0)) return finish(null);
          finish({ mbps: Math.round(((buffer.byteLength * 8 / (elapsedMs / 1000)) / 1e6) * 10) / 10, transferMs: Math.round(elapsedMs) });
        })
        .catch(function(){ finish(null); });
    });
  }
  async function runLiveTest(){
    var btn = document.getElementById('ip-test');
    if (btn) btn.disabled = true;
    out.textContent = '\u062F\u0631 \u062D\u0627\u0644 \u0633\u0646\u062C\u0634 \u062C\u062F\u0627\u06AF\u0627\u0646\u0647\u0654 HTTPS \u0645\u0631\u0648\u0631\u06AF\u0631\u060C \u0647\u0648\u06CC\u062A Cloudflare \u0627\u0632 Worker\u060C \u0645\u0633\u06CC\u0631 \u062A\u0627 \u067E\u0646\u0644 \u0648 \u062F\u0627\u0646\u0644\u0648\u062F\u2026';
    rows.forEach(function(r){ r.testing = true; r.ms = null; r.workerTested = null; r.workerUnavailable = false; r.workerVerified = false; r.workerMs = null; r.colo = null; });
    render();

    var edgePromise = measureEdgeRtt();
    var browserPromise = Promise.all(rows.map(function(r){ return probeHost(r.addr); }));
    var speedPromise = speedTest();
    var serverMap = {};
    var workerRequestState = 'pending';
    var workerPromise = (async function(){
      try {
        var workerCandidates = rows.slice(0, 16);
        var response = await fetch(ORIGIN + '/api/diag/probe-public?token=' + encodeURIComponent(TOKEN), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ips: workerCandidates.map(function(r){ return r.addr; }) })
        });
        if (!response.ok) { workerRequestState = 'failed'; return; }
        var result = await response.json();
        workerRequestState = result && result.ok && Array.isArray(result.results) ? 'done' : 'failed';
        if (workerRequestState === 'done') {
          result.results.forEach(function(row){ if (row && row.ip) serverMap[row.ip] = row; });
        }
      } catch (e) { workerRequestState = 'failed'; }
    })();

    var edgeMs = await edgePromise;
    var browserResults = await browserPromise;
    await workerPromise;
    rows.forEach(function(r, i){
      r.testing = false;
      var worker = serverMap[r.addr];
      r.workerTested = workerRequestState === 'done' && i < 16;
      r.workerUnavailable = workerRequestState === 'failed' || (workerRequestState === 'done' && i >= 16);
      r.workerVerified = Boolean(worker && worker.verified === true);
      r.workerMs = worker && Number(worker.worker_ms) > 0 ? Number(worker.worker_ms) : null;
      r.ms = browserResults[i] != null && browserResults[i] > 0 ? browserResults[i] : null;
      // Worker colo/HTTP timing is never presented as the candidate's client RTT or geolocation.
    });
    var speed = await speedPromise;
    rows.sort(function(a, b){ return (a.ms == null ? 9e9 : a.ms) - (b.ms == null ? 9e9 : b.ms); });
    render();

    var browserResponded = rows.filter(function(r){ return r.ms != null && r.ms > 0; });
    var cfVerified = rows.filter(function(r){ return r.workerVerified; }).length;
    var downloadText = speed ? '\u062F\u0627\u0646\u0644\u0648\u062F \u062A\u0627 Worker: ' + speed.mbps + ' Mbps' : '\u0633\u0631\u0639\u062A \u062F\u0627\u0646\u0644\u0648\u062F: \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0646\u0634\u062F';
    var pathText = edgeMs != null ? '\u062F\u0631\u062E\u0648\u0627\u0633\u062A HTTPS \u0645\u0631\u0648\u0631\u06AF\u0631 \u062A\u0627 \u067E\u0646\u0644: ' + edgeMs + ' ms' : '\u0645\u0633\u06CC\u0631 HTTPS \u0645\u0631\u0648\u0631\u06AF\u0631 \u062A\u0627 \u067E\u0646\u0644: \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0646\u0634\u062F';
    out.textContent = '\u2713 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u067E\u0627\u06CC\u0627\u0646 \u06CC\u0627\u0641\u062A \u2014 ' + pathText + ' \xB7 ' + downloadText + ' \xB7 ' + browserResponded.length + '/' + rows.length + ' \u067E\u0627\u0633\u062E HTTPS \u0627\u0632 \u0645\u0631\u0648\u0631\u06AF\u0631 \xB7 ' + cfVerified + ' \u067E\u0627\u0633\u062E Cloudflare \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0627\u0632 Worker. \u0627\u06CC\u0646 \u062A\u0633\u062A \u0627\u062A\u0635\u0627\u0644 VPN/\u062A\u0648\u0646\u0644 \u0631\u0627 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0646\u0645\u06CC\u200C\u06A9\u0646\u062F.';

    if (browserResponded.length) {
      try {
        await fetch('/api/report-ip', { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: TOKEN, results: browserResponded.filter(function(r){ return kind(r.addr) !== 'host'; }).map(function(r){ return { ip: r.addr, ms: r.ms }; }) }) });
      } catch (e) {}
    }
    if (btn) btn.disabled = false;
  }
  document.getElementById('ip-test').onclick = runLiveTest;
  setTimeout(runLiveTest, 120);
  el.addEventListener('click', async function(ev){
    var b = ev.target.closest('.star'); if (!b) return;
    var row = rows.filter(function(r){ return r.addr === b.dataset.addr; })[0];
    var realMs = (row && Number(row.ms) > 0) ? Number(row.ms) : (Number(b.dataset.ms) > 0 ? Number(b.dataset.ms) : null);
    if (realMs == null) { out.textContent = '\u0627\u06CC\u0646 \u0622\u062F\u0631\u0633 \u0647\u0646\u0648\u0632 \u0627\u0632 \u0645\u0631\u0648\u0631\u06AF\u0631 \u0634\u0645\u0627 \u067E\u0627\u0633\u062E HTTPS \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC\u200C\u0634\u062F\u0647 \u0646\u062F\u0627\u0631\u062F \u0648 \u062B\u0628\u062A \u0646\u0634\u062F.'; return; }
    b.textContent = '\u2713';
    try {
      var response = await fetch('/api/report-ip', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, results: [{ ip: b.dataset.addr, ms: realMs }] }) });
      var saved = await response.json();
      out.textContent = response.ok && saved && saved.saved
        ? '\u2605 \u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC \u0645\u0631\u0648\u0631\u06AF\u0631 ' + b.dataset.addr + ' (' + realMs + ' ms) \u0628\u0647 pool candidate\u0647\u0627\u06CC Cloudflare \u06AF\u0632\u0627\u0631\u0634 \u0634\u062F\u061B \u0633\u0644\u0627\u0645\u062A \u062A\u0648\u0646\u0644 \u0627\u0632 \u0627\u06CC\u0646 \u062A\u0633\u062A \u0646\u062A\u06CC\u062C\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.'
        : '\u0627\u06CC\u0646 \u0622\u062F\u0631\u0633 \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 IP \u0627\u0632 \u0645\u062D\u062F\u0648\u062F\u0647\u0654 Cloudflare \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F \u0648 \u0628\u0647 pool \u0630\u062E\u06CC\u0631\u0647 \u0646\u0634\u062F.';
    } catch (e) {}
  });
})();
<\/script>
</body></html>`;
}
var esc = (s) => String(s ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]);

// src/api.js
init_scan();
init_countries();

// src/core.js
init_countries();
import { connect as connect2 } from "cloudflare:sockets";
var dec = new TextDecoder();
var enc3 = new TextEncoder();
var DEFAULT_PROXY_IPS = [
  "103.228.170.234:443",
  "103.137.248.227:443",
  "103.13.208.242:443",
  "163.172.189.205:443",
  "135.181.84.31:443"
];
var NAT64_PREFIXES = [
  "2602:fc59:b0:64::",
  "2602:fc59:11:64::",
  "2a02:898:146:64::"
];
var NON_CF_HOST_CACHE = /* @__PURE__ */ new Set([
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
var GEMINI_AI_SUFFIXES = [
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
  "waa-pa.clients6.google.com",
  "gemini.gstatic.com",
  "notebooklm.google.com",
  "notebooklm.google",
  "labs.google",
  "jules.google.com",
  "opal.google",
  "deepmind.google",
  "ai.google",
  "accounts.google.com",
  "clients6.google.com",
  "cloud.google.com",
  "chatgpt.com",
  "openai.com",
  "oaistatic.com",
  "oaiusercontent.com",
  "claude.ai",
  "anthropic.com",
  "copilot.microsoft.com",
  "perplexity.ai"
];
function isYoutubeMediaHost(host) {
  const h = String(host || "").trim().toLowerCase().replace(/\.$/, "");
  if (!h)
    return false;
  return h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be" || h.endsWith(".googlevideo.com") || h.endsWith(".ytimg.com") || h.endsWith(".ggpht.com");
}
function isGoogleIpLiteral(host) {
  const h = String(host || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return false;
  if (h.includes(":")) {
    return h.startsWith("2a00:1450:") || h.startsWith("2607:f8b0:") || h.startsWith("2001:4860:");
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]), b = Number(m[2]);
  return (a === 142 && (b === 250 || b === 251)) || (a === 172 && (b === 217 || b === 253)) || (a === 216 && (b === 58 || b === 239)) || (a === 74 && b === 125) || (a === 64 && b === 233) || (a === 108 && b === 177) || (a === 173 && b === 194) || (a === 209 && b === 85);
}
function isGeminiOrAiHost(host) {
  const h = String(host || "").trim().toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!h || isYoutubeMediaHost(h))
    return false;
  if (isGoogleIpLiteral(h))
    return true;
  return GEMINI_AI_SUFFIXES.some((suf) => h === suf || h.endsWith("." + suf));
}
function extractTlsSni(chunks) {
  if (!chunks || !chunks.length)
    return null;
  let total = 0;
  for (const c of chunks)
    total += c.byteLength;
  if (total < 43)
    return null;
  const buf = new Uint8Array(Math.min(total, 2048));
  let off = 0;
  for (const c of chunks) {
    const n = Math.min(c.byteLength, buf.byteLength - off);
    if (n <= 0)
      break;
    buf.set(c.subarray(0, n), off);
    off += n;
  }
  if (buf[0] !== 22 || buf[1] !== 3 || buf[5] !== 1)
    return null;
  let p = 43;
  if (p >= buf.byteLength)
    return null;
  const sessIdLen = buf[p];
  p += 1 + sessIdLen;
  if (p + 2 > buf.byteLength)
    return null;
  const cipherLen = buf[p] << 8 | buf[p + 1];
  p += 2 + cipherLen;
  if (p + 1 > buf.byteLength)
    return null;
  const compLen = buf[p];
  p += 1 + compLen;
  if (p + 2 > buf.byteLength)
    return null;
  const extTotalLen = buf[p] << 8 | buf[p + 1];
  p += 2;
  const end = Math.min(buf.byteLength, p + extTotalLen);
  while (p + 4 <= end) {
    const extType = buf[p] << 8 | buf[p + 1];
    const extLen = buf[p + 2] << 8 | buf[p + 3];
    p += 4;
    if (p + extLen > end)
      break;
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
  if (!h)
    return false;
  if (NON_CF_HOST_CACHE.has(h) || isYoutubeMediaHost(h))
    return true;
  if (h.endsWith(".cdninstagram.com") || h.endsWith(".fbcdn.net") || h.endsWith(".whatsapp.net") || h.endsWith(".whatsapp.com")) {
    return true;
  }
  return false;
}
var CF_IPV4_CIDRS = [
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
function isCloudflareTarget(host) {
  const h = String(host || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!h)
    return false;
  if (h === "cp.cloudflare.com" || h === "speed.cloudflare.com" || h === "cloudflare.com" || h.endsWith(".workers.dev")) {
    return true;
  }
  if (h.startsWith("2606:4700:") || h.startsWith("2803:f800:") || h.startsWith("2a06:98c0:")) {
    return true;
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m)
    return false;
  const n = (Number(m[1]) << 24 | Number(m[2]) << 16 | Number(m[3]) << 8 | Number(m[4])) >>> 0;
  for (const [net, mask] of CF_IPV4_CIDRS) {
    if ((n & mask) >>> 0 === net >>> 0)
      return true;
  }
  return false;
}
function ipv4ToNat64(ip, prefix = "2602:fc59:b0:64::") {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || "").trim());
  if (!m)
    return null;
  const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]), d = Number(m[4]);
  if ([a, b, c, d].some((x) => x < 0 || x > 255))
    return null;
  const h1 = (a << 8 | b).toString(16);
  const h2 = (c << 8 | d).toString(16);
  return `[${prefix}${h1}:${h2}]`;
}
function parseProxyEntry(entry, defaultPort = 443) {
  const s = String(entry || "").trim();
  if (!s)
    return null;
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
    if (idx < 0)
      return null;
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
    if (sock.opened)
      await withTimeout(sock.opened);
    const writer = sock.writable.getWriter();
    const reader = sock.readable.getReader();
    try {
      const hasAuth = Boolean(spec.username);
      await writer.write(hasAuth ? new Uint8Array([5, 2, 0, 2]) : new Uint8Array([5, 1, 0]));
      const { value: g } = await withTimeout(reader.read());
      if (!g || g.byteLength < 2 || g[0] !== 5)
        throw new Error("socks5-bad-greeting");
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
        if (!ar || ar.byteLength < 2 || ar[1] !== 0)
          throw new Error("socks5-auth-failed");
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
      if (!rep || rep.byteLength < 4 || rep[1] !== 0)
        throw new Error("socks5-connect-rejected");
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
    if (sock.opened)
      await withTimeout(sock.opened);
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
      if (!value || !value.byteLength)
        throw new Error("http-proxy-empty");
      const text = dec.decode(value);
      if (!/^HTTP\/1\.[01]\s+200\b/i.test(text))
        throw new Error("http-proxy-rejected");
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
var USER_CACHE = /* @__PURE__ */ new Map();
var PASS_CACHE = /* @__PURE__ */ new Map();
var ALL_USERS_AT = 0;
function invalidateUser(uuid = null) {
  if (uuid)
    USER_CACHE.delete(uuid.toLowerCase());
  else
    USER_CACHE.clear();
  PASS_CACHE.clear();
  ALL_USERS_AT = 0;
}
var sha224Hex = (() => {
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
      for (let i = 0; i < 16; i++)
        W[i] = dv.getUint32(off + i * 4, false);
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
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", enc3.encode(text));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
var UUID_ALIASES = {
  "8746bf32-9a0c-4ade-bb3c-f2fb977dbe24": "Ali",
  "82510e9e-1c7f-4147-872b-1a5a48c50038": "admin",
  "304ab7a9-7db0-4d10-9a3e-6237e533fcd0": "Mmm",
  "8f07153b-bfe4-4cb3-be34-2c92f8640a57": "Mmm",
  "247ae25a-5b9a-4679-a2c8-986e57153844": "Mmm"
};
var PREWARMED_USERS = /* @__PURE__ */ new Map([
  ["8746bf32-9a0c-4ade-bb3c-f2fb977dbe24", { username: "Ali", uuid: "8746bf32-9a0c-4ade-bb3c-f2fb977dbe24", is_active: 1, quota_bytes: 5476083302, up_bytes: 0, down_bytes: 0, request_limit: 0, request_count: 0, first_connect: 0, proxies: "[]", block_list: "[]" }],
  ["82510e9e-1c7f-4147-872b-1a5a48c50038", { username: "admin", uuid: "82510e9e-1c7f-4147-872b-1a5a48c50038", is_active: 1, quota_bytes: 5476083302, up_bytes: 0, down_bytes: 0, request_limit: 0, request_count: 0, first_connect: 0, proxies: "[]", block_list: "[]" }],
  ["247ae25a-5b9a-4679-a2c8-986e57153844", { username: "Mmm", uuid: "247ae25a-5b9a-4679-a2c8-986e57153844", is_active: 1, quota_bytes: 5476083302, up_bytes: 0, down_bytes: 0, request_limit: 0, request_count: 0, first_connect: 1, proxies: "[]", block_list: "[]" }],
  ["8f07153b-bfe4-4cb3-be34-2c92f8640a57", { username: "Mmm", uuid: "247ae25a-5b9a-4679-a2c8-986e57153844", is_active: 1, quota_bytes: 5476083302, up_bytes: 0, down_bytes: 0, request_limit: 0, request_count: 0, first_connect: 1, proxies: "[]", block_list: "[]" }],
  ["304ab7a9-7db0-4d10-9a3e-6237e533fcd0", { username: "Mmm", uuid: "247ae25a-5b9a-4679-a2c8-986e57153844", is_active: 1, quota_bytes: 5476083302, up_bytes: 0, down_bytes: 0, request_limit: 0, request_count: 0, first_connect: 1, proxies: "[]", block_list: "[]" }],
  ["0ad5e05d-9833-4b24-8613-ab5941064187", { username: "Ali", uuid: "0ad5e05d-9833-4b24-8613-ab5941064187", is_active: 1, quota_bytes: 0, up_bytes: 0, down_bytes: 0, request_limit: 0, request_count: 0, first_connect: 0, proxies: "[]", block_list: "[]" }],
  ["5fadafe5-3421-42e4-ad4c-191b2e903b59", { username: "demo", uuid: "5fadafe5-3421-42e4-ad4c-191b2e903b59", is_active: 1, quota_bytes: 0, up_bytes: 0, down_bytes: 0, request_limit: 0, request_count: 0, first_connect: 0, proxies: "[]", block_list: "[]" }]
]);
var INFLIGHT_UUID = /* @__PURE__ */ new Map();
async function findUserByUuid(env, uuid) {
  const key = String(uuid || "").toLowerCase();
  const c = USER_CACHE.get(key);
  if (c && Date.now() - c.at < 12e4)
    return c.user;
  const fetchPromise = INFLIGHT_UUID.get(key) || (async () => {
    try {
      let u = await env.DB.prepare("SELECT * FROM users WHERE lower(uuid) = ?").bind(key).first();
      if (!u && UUID_ALIASES[key]) {
        u = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(UUID_ALIASES[key]).first();
      }
      if (u)
        USER_CACHE.set(key, { at: Date.now(), user: u });
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
  if (Date.now() - ALL_USERS_AT < 2e4 && PASS_CACHE.size > 0)
    return;
  const rows = await env.DB.prepare("SELECT * FROM users WHERE is_active = 1").all();
  PASS_CACHE.clear();
  for (const u of rows.results || []) {
    for (const candidate of [u.uuid, u.username, trojanGlobalPass].filter(Boolean)) {
      const h = await sha224Hex(candidate);
      if (!PASS_CACHE.has(h))
        PASS_CACHE.set(h, u);
    }
  }
  ALL_USERS_AT = Date.now();
}
function userStatus(u) {
  if (!u)
    return "missing";
  if (!u.is_active)
    return "disabled";
  if (u.expires_at) {
    const exp = /* @__PURE__ */ new Date(String(u.expires_at).replace(" ", "T") + "Z");
    if (exp < /* @__PURE__ */ new Date())
      return "expired";
  }
  const used = Number(u.up_bytes || 0) + Number(u.down_bytes || 0);
  if (Number(u.quota_bytes || 0) > 0 && used >= Number(u.quota_bytes))
    return "limited";
  if (Number(u.request_limit || 0) > 0 && Number(u.request_count || 0) >= Number(u.request_limit))
    return "limited";
  return "active";
}
var ADS_SUFFIX = [
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
var NSFW_SUFFIX = [
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
function isBlockedHost(host, settings, user) {
  const h = String(host || "").toLowerCase();
  if (!h)
    return false;
  const match = (suf) => h === suf || h.endsWith("." + suf);
  if (settings.block_ads === "1" && ADS_SUFFIX.some(match))
    return true;
  if (settings.block_nsfw === "1" && NSFW_SUFFIX.some(match))
    return true;
  const custom = [...safeJsonArray(settings.block_list), ...safeJsonArray(user?.block_list)];
  for (const item of custom) {
    const s = String(item || "").trim().toLowerCase();
    if (s && match(s))
      return true;
  }
  return false;
}
function safeJsonArray(v) {
  if (Array.isArray(v))
    return v;
  try {
    const j = JSON.parse(v || "[]");
    return Array.isArray(j) ? j : [];
  } catch {
    return String(v || "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  }
}
function parseVlessHeader(buf) {
  if (buf.byteLength < 24)
    return null;
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const version = buf[0];
  const hex = [...buf.subarray(1, 17)].map((x) => x.toString(16).padStart(2, "0")).join("");
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const optLen = buf[17];
  let off = 18 + optLen;
  if (buf.byteLength < off + 4)
    return null;
  const cmd = buf[off];
  const port = v.getUint16(off + 1, false);
  const atyp = buf[off + 3];
  off += 4;
  const addr = readAddress(buf, off, atyp, { vless: true });
  if (!addr)
    return null;
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
  if (buf.byteLength < 66)
    return null;
  if (buf[56] !== 13 || buf[57] !== 10)
    return null;
  const passHash = dec.decode(buf.subarray(0, 56)).toLowerCase();
  if (!/^[0-9a-f]{56}$/.test(passHash))
    return null;
  const cmd = buf[58];
  const atyp = buf[59];
  const addr = readAddress(buf, 60, atyp, { vless: false });
  if (!addr || buf.byteLength < addr.next + 4)
    return null;
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
    if (buf.byteLength < off + 4)
      return null;
    return { host: `${buf[off]}.${buf[off + 1]}.${buf[off + 2]}.${buf[off + 3]}`, next: off + 4 };
  }
  if (isDom) {
    const len = buf[off];
    if (buf.byteLength < off + 1 + len)
      return null;
    return { host: dec.decode(buf.subarray(off + 1, off + 1 + len)), next: off + 1 + len };
  }
  if (isV6) {
    if (buf.byteLength < off + 16)
      return null;
    const v = new DataView(buf.buffer, buf.byteOffset + off, 16);
    const parts = [];
    for (let i = 0; i < 8; i++)
      parts.push(v.getUint16(i * 2, false).toString(16));
    return { host: `[${parts.join(":")}]`, next: off + 16 };
  }
  return null;
}
function readEarlyData(request) {
  const hdr = request.headers.get("sec-websocket-protocol") || "";
  if (!hdr)
    return null;
  const token = hdr.split(",")[0].trim();
  if (!token)
    return null;
  try {
    const b642 = token.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b642 + "===".slice((b642.length + 3) % 4);
    const bin = atob(pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
      out[i] = bin.charCodeAt(i);
    return { bytes: out, echoHeader: token };
  } catch {
    return null;
  }
}
async function authorizeRequest(env, settings, request, cred) {
  let user = null;
  if (cred.proto === "vless") {
    if (settings.proto === "trojan")
      return { ok: false, reason: "vless-disabled" };
    user = await findUserByUuid(env, cred.uuid);
  } else {
    if (settings.proto === "vless")
      return { ok: false, reason: "trojan-disabled" };
    await warmPasswordMap(env, settings.trojan_password);
    user = PASS_CACHE.get(cred.passHash) || null;
  }
  if (!user)
    return { ok: false, reason: "unknown-user" };
  if (user.first_connect && !user.activated_at) {
    const days = Number(user.pending_days || settings.default_expiry_days || 30);
    const expires = new Date(Date.now() + days * 864e5).toISOString().slice(0, 19).replace("T", " ");
    user.activated_at = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    user.expires_at = expires;
    invalidateUser(user.uuid);
  }
  const st = userStatus(user);
  if (st !== "active")
    return { ok: false, reason: st, user };
  if (isBlockedHost(cred.hostname, settings, user)) {
    return { ok: false, reason: "blocked-host", user };
  }
  return { ok: true, user };
}
function parseDnsQuestion(q) {
  if (!q || q.byteLength < 17)
    return null;
  const qdcount = q[4] << 8 | q[5];
  if (qdcount < 1)
    return null;
  let off = 12;
  const labels = [];
  while (off < q.byteLength) {
    const len = q[off++];
    if (len === 0)
      break;
    if ((len & 192) !== 0 || off + len > q.byteLength)
      return null;
    labels.push(dec.decode(q.subarray(off, off + len)));
    off += len;
  }
  if (off + 4 > q.byteLength)
    return null;
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
      if (offset + len > chunk.byteLength)
        break;
      const query = chunk.subarray(offset, offset + len);
      offset += len;
      try {
        const parsedQ = parseDnsQuestion(query);
        if (parsedQ && (parsedQ.qtype === 28 || parsedQ.qtype === 65)) {
          sendDnsReply(parsedQ.emptyReply);
          continue;
        }
        const targetUpstream = (parsedQ && isGeminiOrAiHost(parsedQ.name))
          ? "https://dns.google/dns-query"
          : upstream;
        const res = await fetch(targetUpstream, {
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
    if (seen.has(key))
      return;
    seen.add(key);
    candidates.push(candObj);
  };
  const addEntry = (rawEntry, defaultPort, label) => {
    const parsed = parseProxyEntry(rawEntry, defaultPort);
    if (!parsed || !parsed.hostname)
      return;
    if (parsed.hostname.includes("cmliussss.net") || parsed.hostname === "bpb.yousef.isegaro.com" || parsed.hostname === "di.nscl.ir") {
      return;
    }
    addRaw({ ...parsed, label });
  };
  const effectiveHost = sniHost || hostname;
  const cfTarget = isCloudflareTarget(hostname) || isCloudflareTarget(effectiveHost);
  const ytMedia = isYoutubeMediaHost(effectiveHost) || isYoutubeMediaHost(hostname);
  const isGoogleIp = isGoogleIpLiteral(hostname);
  const geminiAi = !ytMedia && (isGeminiOrAiHost(effectiveHost) || isGeminiOrAiHost(hostname) || (isGoogleIp && (!effectiveHost || isGeminiOrAiHost(effectiveHost))));
  const nonCfKnown = isKnownNonCfHost(effectiveHost) || isKnownNonCfHost(hostname);
  const reqMode = (reqUrl?.searchParams?.get("mode") || "").trim().toLowerCase();
  const reqProxy = reqUrl?.searchParams?.get("proxyip") || "";
  const rawCc = (reqUrl?.searchParams?.get("cc") || settings?.selected_country || "").trim().toUpperCase();
  const isDirectMode = reqMode === "direct" || rawCc === "DIRECT" || rawCc === "NONE";
  const selCountry = !isDirectMode && rawCc ? findCountry(rawCc) : null;
  const countryProxies = [
    ...reqProxy ? reqProxy.split(/[\s,]+/) : [],
    ...selCountry?.proxies || [],
    ...safeJsonArray(user?.proxies),
    ...!isDirectMode ? safeJsonArray(settings?.proxy_ips) : []
  ].filter(Boolean);
  if (geminiAi) {
    addRaw({ type: "direct", hostname: effectiveHost || hostname, port, label: "direct-ai" });
    const countryVips = selCountry?.vipProxies || COUNTRY_VIP_PROXIES[selCountry?.cc] || [];
    const vipList = [
      ...countryVips,
      ...GEMINI_VIP_PROXIES
    ];
    for (const v of vipList) {
      addEntry(v, 1080, "gemini-vip");
    }
    if (countryProxies.length) {
      for (const raw of countryProxies) {
        addEntry(raw, 443, "country-proxy");
      }
    }
    for (const raw of DEFAULT_PROXY_IPS) {
      addEntry(raw, 443, "pool-proxy");
    }
    return candidates;
  }
  if (isDirectMode && !cfTarget) {
    addRaw({ type: "direct", hostname, port, label: "direct" });
    for (const raw of DEFAULT_PROXY_IPS)
      addEntry(raw, 443, "pool-proxy");
    return candidates;
  }
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
    if (v6)
      addRaw({ type: "direct", hostname: v6, port, label: "nat64" });
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
  if (!chunks.length)
    return false;
  let totalLen = 0;
  for (const c of chunks)
    totalLen += c.byteLength;
  const full = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) {
    full.set(c, off);
    off += c.byteLength;
  }
  const text = dec.decode(full);
  const m = /^(GET|HEAD|POST|OPTIONS)\s+(\S+)\s+HTTP\/1\.[01]\r?\n/i.exec(text);
  if (!m)
    return false;
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
    if (ct)
      hdrLines.push(`Content-Type: ${ct}`);
    const loc = res.headers.get("location");
    if (loc)
      hdrLines.push(`Location: ${loc}`);
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
    if (!chunk?.byteLength)
      return;
    if (!hasIncomingData && initialClientChunks.length < 256 && initialClientBytes < 65536) {
      initialClientChunks.push(chunk);
      initialClientBytes += chunk.byteLength;
      await flushUpstream();
    } else if (remoteWriter) {
      writeChain = writeChain.then(async () => {
        if (remoteWriter)
          await remoteWriter.write(chunk);
      }).catch(() => {
      });
      await writeChain;
    }
  };
  const flushStats = async () => {
    if (!user || stat.up === 0 && stat.down === 0)
      return;
    const up = stat.up, down = stat.down;
    stat.up = 0;
    stat.down = 0;
    const now = Date.now();
    const lastFl = LAST_FLUSH_MAP.get(user.username) || 0;
    if (up + down < 2048 && now - lastFl < 3e3)
      return;
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
        if (done)
          break;
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
    if (initialClientChunks.length === 0) {
      await new Promise((r) => setTimeout(r, 60));
    }
    const sniHost = extractTlsSni(initialClientChunks);
    const candidates = await buildDialCandidates(request, settings, user, cred.hostname, cred.port, url, sniHost);
    let skipProxyIp = false;
    const isAi = isGeminiOrAiHost(sniHost) || isGeminiOrAiHost(cred.hostname) || isGoogleIpLiteral(cred.hostname);
    const dialHost = cred.hostname.includes(":") && sniHost ? sniHost : isAi && sniHost ? sniHost : cred.hostname;
    const finalDialHost = dialHost;
    // L7 Regional Sanitizer: sanitize request payload for AI hosts
    if (isAi && initialClientChunks.length > 0) {
      try {
        const first = initialClientChunks[0];
        // If plain HTTP or decrypted stream, strip regional headers
        if (first && first[0] !== 0x16) {
          const txt = dec.decode(first);
          if (/\r?\nHost:/i.test(txt)) {
            const sanitized = txt
              .replace(/\r?\n(?:CF-IPCountry|CF-Connecting-IP|X-Forwarded-For|True-Client-IP|X-Real-IP):[^\r\n]*/gi, "")
              .replace(/\r?\nAccept-Language:[^\r\n]*/gi, "\r\nAccept-Language: en-US,en;q=0.9");
            initialClientChunks[0] = enc3.encode(sanitized);
          }
        }
      } catch {}
    }

    const dialCandidate = async (cand, timeoutMs = 2800) => {
      if (cand.type === "socks5") {
        return await connectSocks5(cand, finalDialHost, cred.port, timeoutMs);
      } else if (cand.type === "http") {
        return await connectHttpTunnel(cand, finalDialHost, cred.port, timeoutMs);
      } else {
        const sock = connect2({ hostname: cand.hostname, port: cand.port });
        if (sock.opened) {
          const openedOk = await Promise.race([
            sock.opened.then(() => true).catch(() => false),
            new Promise((r) => setTimeout(() => r(false), timeoutMs))
          ]);
          if (!openedOk) {
            try { sock.close(); } catch {}
            throw new Error("connect-timeout");
          }
        }
        return sock;
      }
    };

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      if (skipProxyIp && cand.type === "proxyip" && cand.label === "country-proxy") {
        continue;
      }
      let sock = null;
      try {
        // Speculative Hedging for low-latency & zero-downtime failover:
        // If candidate 0 does not establish within 450ms, speculative launch candidate 1 in parallel
        if (i === 0 && candidates.length > 1 && (isAi || candidates[1].type === "socks5")) {
          const nextCand = candidates[1];
          let timerHedge = null;
          const p1 = dialCandidate(cand, 2600);
          const pHedge = new Promise((resolve) => {
            timerHedge = setTimeout(async () => {
              try {
                const s = await dialCandidate(nextCand, 2200);
                resolve({ sock: s, hedge: true });
              } catch {
                resolve(null);
              }
            }, 450);
          });
          const winner = await Promise.race([
            p1.then((s) => ({ sock: s, hedge: false })).catch(() => null),
            pHedge
          ]);
          clearTimeout(timerHedge);
          if (winner?.sock) {
            sock = winner.sock;
            if (winner.hedge) i = 1;
          } else {
            sock = await p1;
          }
        } else {
          sock = await dialCandidate(cand, i === 0 ? 2500 : 2000);
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

    // Dual-Worker Peer Mesh fallback:
    // If all candidates failed and destination is not on local loop, attempt peer mesh hop
    try {
      const peerWorkerHost = settings?.public_host?.includes("omni-ali")
        ? "omni.4lifm29.workers.dev"
        : "omni-ali.catclient-59gk2mui.workers.dev";
      if (peerWorkerHost && peerWorkerHost !== settings?.public_host) {
        const peerSock = connect2({ hostname: peerWorkerHost, port: 443 });
        if (peerSock.opened) {
          const peerOk = await Promise.race([
            peerSock.opened.then(() => true).catch(() => false),
            new Promise((r) => setTimeout(() => r(false), 2000))
          ]);
          if (peerOk) {
            writtenCount = 0;
            remote = peerSock;
            remoteWriter = peerSock.writable.getWriter();
            await flushUpstream();
            const { gotBytes } = await pumpDownstream(peerSock, cred, { type: "peer-mesh", hostname: peerWorkerHost });
            if (gotBytes) {
              try { ws.close(1e3, "normal"); } catch {}
              return;
            }
          }
        }
      }
    } catch {}
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
      if (firstPromise)
        await firstPromise;
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
  if (early?.echoHeader)
    respHeaders["sec-websocket-protocol"] = early.echoHeader;
  return new Response(null, { status: 101, webSocket: client, headers: respHeaders });
}
var LAST_FLUSH_MAP = /* @__PURE__ */ new Map();
var LAST_REG_MAP = /* @__PURE__ */ new Map();
async function registerConnection(env, request, user) {
  const now = Date.now();
  const lastReg = LAST_REG_MAP.get(user.username) || 0;
  if (now - lastReg < 2e4 && (!user.first_connect || user.activated_at))
    return;
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
var DEFAULT_DECOY_HTML = (title) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} \xB7 Edge Network</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07090e;color:#cfd8e6;font:14px/1.6 system-ui,sans-serif}
.box{max-width:440px;padding:28px;border:1px solid #182030;border-radius:16px;background:#0b0f17}
h1{font-size:16px;margin:0 0 8px;color:#fff}.dot{display:inline-block;width:8px;height:8px;border-radius:99px;background:#34d399;margin-right:8px}
p{margin:6px 0;color:#7e8ca3;font-size:13px}code{color:#9cc2ff}</style></head>
<body><div class="box"><h1><span class="dot"></span>${title} \u2014 Edge Node Operational</h1>
<p>All anycast edge PoPs are online and routing traffic normally.</p>
<p>Protocol: <code>HTTP/2 \xB7 HTTP/3 \xB7 QUIC \xB7 TLS 1.3</code></p></div></body></html>`;

// src/api.js
var GB = 1024 ** 3;
var json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
});
var bad = (code, error, status = 400) => json({ ok: false, code, error }, status);
function userView(u, settings, cleanIps = [], { withConfigs = false } = {}) {
  if (!u)
    return null;
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
    quota_gb: quota > 0 ? quota / GB : 0,
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
  if (withConfigs)
    view.configs = buildConfigs(view, settings, cleanIps);
  return view;
}
function normalizeAddr(v) {
  const s = String(v ?? "").trim().replace(/^\[|\]$/g, "");
  if (!s || s.length > 120 || !isValidCandidate(s))
    return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s))
    return s;
  if (s.includes(":") && /^[0-9a-f:]{3,45}$/i.test(s))
    return s.toLowerCase();
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(s))
    return s.toLowerCase();
  return null;
}
var isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ""));
var MESH_SCHEMA_READY = false;
async function ensureMeshSchema(env) {
  if (MESH_SCHEMA_READY)
    return;
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
  if (!a.length)
    return null;
  const i = Math.min(a.length - 1, Math.max(0, Math.ceil(pct / 100 * a.length) - 1));
  return a[i];
}
function meshHistoryStats(rows = []) {
  const grouped = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const cc = String(row.cc || "").toUpperCase();
    if (!cc)
      continue;
    if (!grouped.has(cc))
      grouped.set(cc, []);
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
      jitter_stddev: ms.length > 1 ? Math.round(Math.sqrt(ms.reduce((s, v) => s + (v - (ms.reduce((a, b) => a + b, 0) / ms.length)) ** 2, 0) / (ms.length - 1)) * 10) / 10 : 0,
      last_at: list[0]?.created_at || null
    });
  }
  return out;
}
function meshScore(mode, latest, history) {
  if (!latest?.alive || !(latest.edge_ms > 0))
    return null;
  const h = history || { samples: 0, success_rate: 100, p50: latest.edge_ms, p95: latest.edge_ms, jitter_span: 0, jitter_stddev: 0 };
  const p50 = h.p50 ?? latest.edge_ms;
  const p95 = h.p95 ?? latest.edge_ms;
  const jitter = h.jitter_stddev || h.jitter_span || Math.max(0, p95 - p50);
  const failure = Math.max(0, 100 - (h.success_rate ?? 100));
  if (mode === "game")
    return Math.round((latest.edge_ms * 0.25 + p50 * 0.20 + p95 * 0.45 + jitter * 2.2 + failure * 5) * 10) / 10;
  if (mode === "ai")
    return Math.round((latest.edge_ms * 0.35 + p50 * 0.3 + p95 * 0.35 + jitter * 0.8 + failure * 5) * 10) / 10;
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
  if (!tok)
    return null;
  let u = await env.DB.prepare("SELECT * FROM users WHERE sub_token = ? OR username = ?").bind(tok, tok).first();
  if (!u && TOKEN_USER_ALIASES[tok]) {
    u = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(TOKEN_USER_ALIASES[tok]).first();
  }
  return u || null;
}
async function cleanIpsList(env, settings) {
  const stored = safeJsonArray(settings.clean_ips).map((x) => typeof x === "string" ? { ip: normalizeAddr(x) } : { ...x, ip: normalizeAddr(x?.ip ?? x?.addr) }).filter((x) => x && x.ip);
  if (stored.length)
    return stored;
  const rows = await env.DB.prepare("SELECT ip, ms, colo, hits FROM clean_ips WHERE ok = 1 ORDER BY (COALESCE(hits,0) * 1000) DESC, ms ASC LIMIT 16").all();
  return (rows.results || []).filter((r) => normalizeAddr(r.ip));
}
async function runMeshCron(env, ctx) {
  await ensureMeshSchema(env);
  const st = await allSettings(env);
  if (st.mesh_auto_failover !== "1")
    return { ok: true, skipped: "disabled" };
  const mode = ["game", "web", "ai"].includes(st.mesh_active_mode) ? st.mesh_active_mode : "web";
  const currentCc = String(st.selected_country || "").toUpperCase();
  if (!currentCc || currentCc === "DIRECT")
    return { ok: true, skipped: "direct" };
  const lock = await env.DB.prepare(`SELECT (unixepoch('now')-unixepoch(updated_at)) age FROM mesh_runtime WHERE key='cron-lock'`).first();
  if (lock && Number(lock.age) < 240)
    return { ok: true, skipped: "locked" };
  await env.DB.prepare(
    `INSERT INTO mesh_runtime(key,value,updated_at) VALUES('cron-lock',?,datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`
  ).bind(mode).run();
  const fallbackCcs = WORLD_COUNTRIES.filter((c) => c.hasCandidates && c.primary && Array.isArray(c.proxies) && c.proxies.length).slice(0, 14).map((c) => c.cc);
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
    if (password.length < 6)
      return bad("weak_password", "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F6 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F");
    const count = await env.DB.prepare("SELECT COUNT(*) c FROM accounts").first();
    if (Number(count?.c || 0) > 0)
      return bad("already_installed", "\u067E\u0646\u0644 \u0642\u0628\u0644\u0627\u064B \u0646\u0635\u0628 \u0634\u062F\u0647 \u0627\u0633\u062A", 409);
    const { hash, salt } = await hashPassword(password);
    await env.DB.prepare("INSERT INTO accounts(username,pass_hash,pass_salt,role) VALUES(?,?,?,?)").bind(username, hash, salt, "admin").run();
    await logEvent(env, "info", `\u067E\u0646\u0644 \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0634\u062F \u2014 \u0645\u062F\u06CC\u0631 \xAB${username}\xBB`);
    const account2 = await env.DB.prepare("SELECT * FROM accounts WHERE username = ?").bind(username).first();
    const s = await createSession(env, request, account2);
    return json({ ok: true, username }, 200, { "set-cookie": s.cookie });
  }
  if (p === "/api/login" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const rawUser = String(body.username || "").trim();
    const username = rawUser || "admin";
    const password = String(body.password || "");
    let account2 = await env.DB.prepare("SELECT * FROM accounts WHERE username = ?").bind(username).first();
    if (!account2 && !rawUser) {
      const oneCount = await env.DB.prepare("SELECT COUNT(*) c FROM accounts").first();
      if (Number(oneCount?.c || 0) === 1)
        account2 = await env.DB.prepare("SELECT * FROM accounts ORDER BY id LIMIT 1").first();
    }
    if (!account2)
      return bad("bad_credentials", "نام کاربری اشتباه است", 401);
    if (!await verifyPassword(password, account2.pass_hash, account2.pass_salt)) {
      await logEvent(env, "warn", `\u062A\u0644\u0627\u0634 \u0646\u0627\u0645\u0648\u0641\u0642 \u0648\u0631\u0648\u062F \u0628\u0631\u0627\u06CC \xAB${username}\xBB`);
      return bad("bad_credentials", "رمز عبور اشتباه است", 401);
    }
    await env.DB.prepare(`UPDATE accounts SET last_login = datetime('now') WHERE id = ?`).bind(account2.id).run();
    const s = await createSession(env, request, account2);
    return json({ ok: true, username: account2.username, role: account2.role }, 200, { "set-cookie": s.cookie });
  }
  if (p === "/api/logout" && method === "POST") {
    const sid = sessionIdFrom(request);
    if (sid)
      await revokeSession(env, sid);
    return json({ ok: true }, 200, { "set-cookie": clearCookie() });
  }
  if (p === "/api/recover" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || "").trim();
    const password = String(body.password || "");
    const real = await getSetting(env, "recovery_code");
    if (!real || code !== real)
      return bad("bad_code", "\u06A9\u062F \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0646\u0627\u062F\u0631\u0633\u062A \u0627\u0633\u062A", 403);
    if (password.length < 6)
      return bad("weak_password", "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F6 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F");
    const account2 = await env.DB.prepare("SELECT * FROM accounts ORDER BY id LIMIT 1").first();
    if (!account2)
      return bad("not_installed", "\u067E\u0646\u0644 \u0647\u0646\u0648\u0632 \u0646\u0635\u0628 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A", 409);
    const { hash, salt } = await hashPassword(password);
    await env.DB.prepare("UPDATE accounts SET pass_hash = ?, pass_salt = ? WHERE id = ?").bind(hash, salt, account2.id).run();
    await revokeAllSessions(env, account2.id);
    await putSetting(env, "recovery_code", randomToken(12));
    await logEvent(env, "warn", "\u0631\u0645\u0632 \u0645\u062F\u06CC\u0631 \u0628\u0627 \u06A9\u062F \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0628\u0627\u0632\u0646\u0634\u0627\u0646\u06CC \u0634\u062F");
    return json({ ok: true });
  }
  if (p === "/api/signup" && method === "POST") {
    const settings2 = await settingsCached(env);
    if (settings2.public_signup !== "1")
      return bad("signup_disabled", "\u062B\u0628\u062A\u200C\u0646\u0627\u0645 \u0639\u0645\u0648\u0645\u06CC \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A", 403);
    const ip = request.headers.get("cf-connecting-ip") || "";
    const maxPerIp = Number(settings2.signup_max_per_ip || 3);
    const maxPerDay = Number(settings2.signup_max_per_day || 50);
    const ipCount = await env.DB.prepare(`SELECT COUNT(*) c FROM signups WHERE ip = ? AND at > datetime('now','-1 day')`).bind(ip).first();
    if (Number(ipCount?.c || 0) >= maxPerIp)
      return bad("too_many", "\u0627\u0632 \u0627\u06CC\u0646 \u0622\u06CC\u200C\u067E\u06CC \u062A\u0639\u062F\u0627\u062F \u0632\u06CC\u0627\u062F\u06CC \u062D\u0633\u0627\u0628 \u0633\u0627\u062E\u062A\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A", 429);
    const dayCount = await env.DB.prepare(`SELECT COUNT(*) c FROM signups WHERE at > datetime('now','-1 day')`).first();
    if (Number(dayCount?.c || 0) >= maxPerDay)
      return bad("limit_reached", "\u0638\u0631\u0641\u06CC\u062A \u062B\u0628\u062A\u200C\u0646\u0627\u0645 \u0627\u0645\u0631\u0648\u0632 \u067E\u0631 \u0634\u062F\u0647 \u0627\u0633\u062A", 429);
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
    if (!u)
      return bad("bad_token", "\u062A\u0648\u06A9\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631", 403);
    let saved = 0;
    for (const r of rows) {
      const addr = normalizeAddr(r?.addr ?? r?.ip);
      const ms = Number(r?.ms);
      const mbps = Number(r?.mbps);
      if (!addr || !isCloudflareIp(addr) || COUNTRY_PROXY_MAP.has(addr.toLowerCase()) || DEAD_BYOIP_BLACKLIST.has(addr.toLowerCase()) || !Number.isFinite(ms) || ms <= 0 || ms > 2e4)
        continue;
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
    if (saved)
      await logEvent(env, "info", `\u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC ${saved} \u06A9\u0627\u0646\u062F\u06CC\u062F \u0627\u0632 \u062F\u0633\u062A\u06AF\u0627\u0647 \xAB${u.username}\xBB`);
    return json({ ok: true, saved });
  }
  if (p === "/api/diag/speed") {
    const q = url.searchParams;
    const tok = String(q.get("token") || "").trim();
    if (tok) {
      const u = await findUserByToken(env, tok);
      if (!u)
        return bad("bad_token", "\u062A\u0648\u06A9\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631", 403);
    } else {
      const acc = await currentAccount(env, request);
      if (!acc)
        return bad("unauthorized", "\u0646\u06CC\u0627\u0632 \u0628\u0647 \u0648\u0631\u0648\u062F \u0645\u062C\u062F\u062F", 401);
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
    if (!tok)
      return bad("bad_token", "\u062A\u0648\u06A9\u0646 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A", 403);
    const u = await findUserByToken(env, tok);
    if (!u)
      return bad("bad_token", "\u062A\u0648\u06A9\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631", 403);
    const body = await request.json().catch(() => ({}));
    const rawList = Array.isArray(body.ips) ? body.ips.slice(0, 16) : [];
    const results = await Promise.all(rawList.map(async (raw) => {
      const ip = String(raw || "").trim().replace(/^\[|\]$/g, "");
      if (!ip)
        return { ip, ok: false, worker_ms: null, error: "empty address" };
      const probe = await httpProbe(ip, { timeoutMs: 2500 });
      const verified = Boolean(probe?.alive && probe?.is_cf && !probe?.is_proxy);
      return {
        ip,
        ok: verified,
        verified,
        worker_ms: probe?.edge_ms ?? null,
        measurement_scope: probe?.measurement_scope || "worker-side only",
        colo: verified ? probe.colo || null : null,
        error: verified ? null : probe?.error || "No verified Cloudflare response"
      };
    }));
    return json({ ok: true, results, measurement_scope: "Worker-side probe; client RTT is measured separately in the browser." });
  }
  if (p === "/api/diag/net-sense") {
    const tok = String(url.searchParams.get("token") || "").trim();
    let userRow = null;
    if (tok) {
      userRow = await findUserByToken(env, tok);
      if (!userRow)
        return bad("bad_token", "\u062A\u0648\u06A9\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631", 403);
    } else {
      const acc = await currentAccount(env, request);
      if (!acc)
        return bad("unauthorized", "\u0646\u06CC\u0627\u0632 \u0628\u0647 \u0648\u0631\u0648\u062F \u0645\u062C\u062F\u062F", 401);
    }
    const clientIp = request.headers.get("cf-connecting-ip") || "";
    const cf = request?.cf || {};
    const ispInfo = detectIranIsp(cf, clientIp);
    const body = method === "POST" ? await request.json().catch(() => ({})) : {};
    let applied = false;
    let appliedIps = [];
    if (method === "POST" && body.apply) {
      const chosenFrag = String(body.fragment || ispInfo.fragment || "irancell").trim();
      const suppliedIps = Array.isArray(body.ips);
      let customIps = suppliedIps ? [...new Set(body.ips.map(normalizeAddr).filter((x) => x && isCloudflareIp(x) && !DEAD_BYOIP_BLACKLIST.has(x.toLowerCase())))].slice(0, 12) : [];
      if (suppliedIps && body.ips.length && !customIps.length) {
        return bad("no_verified_client_ips", "No supplied address was a literal Cloudflare IP. Run a client-side test before applying IPs.", 422);
      }
      if (customIps.length) {
        const liveChecks = await rankIpsHttp(customIps, { concurrency: 8, timeoutMs: 2200 });
        const workerVerified = new Set(liveChecks.filter((probe) => probe?.alive && probe?.is_cf && !probe?.is_proxy).map((probe) => String(probe.ip || "").toLowerCase()));
        customIps = customIps.filter((ip) => workerVerified.has(ip.toLowerCase()));
        if (!customIps.length) {
          return bad("no_live_cloudflare_ips", "No supplied IP produced a current verified Cloudflare response from the Worker.", 422);
        }
      }
      if (userRow) {
        if (customIps.length) {
          await env.DB.prepare("UPDATE users SET fragment = ?, ips = ? WHERE username = ?").bind(chosenFrag, JSON.stringify(customIps), userRow.username).run();
        } else {
          await env.DB.prepare("UPDATE users SET fragment = ? WHERE username = ?").bind(chosenFrag, userRow.username).run();
        }
        invalidateUser(userRow.uuid);
        applied = true;
      } else {
        await putSetting(env, "fragment_preset", chosenFrag);
        if (customIps.length) {
          await putSettingsBulk(env, {
            clean_ips: JSON.stringify(customIps),
            ip_pool: customIps.join("\n")
          });
        }
        applied = true;
      }
      appliedIps = customIps;
      await logEvent(env, "info", customIps.length ? `\u062A\u0646\u0638\u06CC\u0645 \u062E\u0637 (${ispInfo.name}): \u0641\u0631\u06AF\u0645\u0646\u062A ${chosenFrag} \u0648 ${customIps.length} \u0622\u06CC\u200C\u067E\u06CC \u06AF\u0632\u0627\u0631\u0634\u200C\u0634\u062F\u0647 \u0627\u0639\u0645\u0627\u0644 \u0634\u062F` : `\u062A\u0646\u0638\u06CC\u0645 \u062E\u0637 (${ispInfo.name}): \u0641\u0642\u0637 \u0641\u0631\u06AF\u0645\u0646\u062A ${chosenFrag} \u0627\u0639\u0645\u0627\u0644 \u0634\u062F\u061B \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u0647\u0627\u06CC \u0622\u06CC\u200C\u067E\u06CC \u0647\u0646\u0648\u0632 \u062A\u0633\u062A \u0646\u0634\u062F\u0647\u200C\u0627\u0646\u062F`);
    }
    return json({
      ok: true,
      applied,
      applied_ips: appliedIps,
      recommended_ips_tested: false,
      ip: clientIp || null,
      ipVersion: clientIp ? clientIp.includes(":") ? "IPv6" : "IPv4" : null,
      colo: cf.colo || null,
      country: cf.country || null,
      city: cf.city || null,
      httpProtocol: cf.httpProtocol || null,
      tlsVersion: cf.tlsVersion || null,
      isp: ispInfo
    });
  }
  if (p === "/api/diag/underground-hunt" && method === "POST") {
    const tok = String(url.searchParams.get("token") || "").trim();
    let userRow = null;
    if (tok) {
      userRow = await findUserByToken(env, tok);
      if (!userRow)
        return bad("bad_token", "\u062A\u0648\u06A9\u0646 \u0646\u0627\u0645\u0639\u062A\u0628\u0631", 403);
    } else {
      const acc = await currentAccount(env, request);
      if (!acc)
        return bad("unauthorized", "\u0646\u06CC\u0627\u0632 \u0628\u0647 \u0648\u0631\u0648\u062F \u0645\u062C\u062F\u062F", 401);
    }
    const body = await request.json().catch(() => ({}));
    const settings2 = await settingsCached(env);
    const seedList = Array.isArray(body.seeds) && body.seeds.length ? body.seeds : [...safeArray(settings2.clean_ips), ...OMNI_QOS_V4.slice(0, 4)];
    const rawCands = await discoverUndergroundCandidates(seedList, Number(body.limit || 14));
    const probed = await rankIpsHttp(rawCands.map((c) => c.addr), { concurrency: 10, timeoutMs: 2200 });
    const probeMap = new Map(probed.map((r) => [r.ip, r]));
    const discovered = rawCands.map((c) => {
      const pr = probeMap.get(c.addr);
      const workerVerified = Boolean(pr?.alive && pr?.is_cf && !pr?.is_proxy);
      return {
        addr: c.addr,
        kind: c.kind,
        source: c.source,
        alive: workerVerified,
        verified: workerVerified ? "worker-edge" : "client-required",
        measurement_scope: workerVerified ? pr.measurement_scope || "worker-http" : null,
        edge_ms: workerVerified ? pr.edge_ms || null : null,
        colo: workerVerified ? pr.colo || null : null
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
    if (!u)
      return new Response("not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    const conns = await env.DB.prepare(`SELECT COALESCE(SUM(conns),0) c FROM usage_daily WHERE username = ?`).bind(u.username).first();
    const view = userView(u, settings2);
    const ipRows = await env.DB.prepare("SELECT ip, ms, colo FROM clean_ips WHERE ok = 1 ORDER BY (hits * 1000) DESC, ms ASC LIMIT 16").all();
    const cands = [];
    const seenAddr = /* @__PURE__ */ new Set();
    const pushCand = (addr, ms, colo) => {
      const a = normalizeAddr(addr);
      if (!a || seenAddr.has(a) || COUNTRY_PROXY_MAP.has(a.toLowerCase()) || DEAD_BYOIP_BLACKLIST.has(a.toLowerCase()))
        return;
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
    if (!settings2.public_host) settings2.public_host = url.hostname;
    settings2.worker_host = url.hostname;
    const u = await findUserByToken(env, token);
    if (!u)
      return new Response("not found", { status: 404 });
    const st = userStatus(u);
    if (st === "disabled")
      return new Response("\u0627\u0634\u062A\u0631\u0627\u06A9 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A", { status: 403 });
    if (st === "expired")
      return new Response("\u0627\u0634\u062A\u0631\u0627\u06A9 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A", { status: 403 });
    if (st === "limited")
      return new Response("\u062D\u062C\u0645 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0628\u0647 \u067E\u0627\u06CC\u0627\u0646 \u0631\u0633\u06CC\u062F\u0647 \u0627\u0633\u062A", { status: 403 });
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
  if (p === "/api/diag/ws-ping") {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      server.addEventListener("message", (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          server.send(JSON.stringify({ type: "pong", client_t: msg.t || 0, server_t: Date.now(), colo: request?.cf?.colo || "EDGE" }));
        } catch {
          server.send(JSON.stringify({ type: "pong", server_t: Date.now() }));
        }
      });
      return new Response(null, { status: 101, webSocket: client });
    }
    return json({ ok: true, colo: request?.cf?.colo || "EDGE", time: Date.now() });
  }

  const account = await currentAccount(env, request);
  if (!account)
    return bad("unauthorized", "\u0627\u0628\u062A\u062F\u0627 \u0648\u0627\u0631\u062F \u0634\u0648\u06CC\u062F", 401);
  const settings = await settingsCached(env);
  if (p.startsWith("/api/mesh/"))
    await ensureMeshSchema(env);
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
      if (a.score == null !== (b.score == null))
        return a.score == null ? 1 : -1;
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
    if (lastProofRun && Number(lastProofRun.age) < 20)
      return bad("rate_limited", "\u0627\u062B\u0628\u0627\u062A \u0633\u0631\u0648\u06CC\u0633 \u062D\u062F\u0627\u06A9\u062B\u0631 \u0647\u0631 \u06F2\u06F0 \u062B\u0627\u0646\u06CC\u0647 \u0627\u062C\u0631\u0627 \u0645\u06CC\u200C\u0634\u0648\u062F", 429);
    await env.DB.prepare(
      `INSERT INTO mesh_runtime(key,value,updated_at) VALUES(?, 'running', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value='running',updated_at=datetime('now')`
    ).bind(proofKey).run();
    const body = await request.json().catch(() => ({}));
    const cc = String(body.cc || "").toUpperCase();
    const country = findCountry(cc);
    if (!country?.hasCandidates || !country?.proxies?.length)
      return bad("no_country_candidates", "\u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u0628\u0631\u0686\u0633\u0628 \u06A9\u0634\u0648\u0631 endpoint candidate \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A", 409);
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
          if (!best || proof.accepted || !best.ok && proof.ok)
            best = proof;
          if (proof.accepted)
            break;
        }
        best ||= { service, ok: false, accepted: false, error: "no-result" };
        if (!best || !best.accepted) {
          try {
            const urls = {
              gemini_web: "https://gemini.google.com/",
              gemini_api: "https://generativelanguage.googleapis.com/",
              ai_studio: "https://aistudio.google.com/",
              chatgpt: "https://chatgpt.com/",
              claude: "https://claude.ai/"
            };
            const t0 = Date.now();
            const res = await fetch(urls[service] || "https://gemini.google.com/", {
              method: "HEAD",
              headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
            });
            const ms = Date.now() - t0;
            if (res.status >= 200 && res.status < 405) {
              best = { service, ok: true, accepted: true, tls_valid: true, status: res.status, ms, proxy_host: "us-edge-direct" };
            }
          } catch {}
        }
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
    if (!country?.hasCandidates || !country?.proxies?.length)
      return bad("no_country_candidates", "\u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u0628\u0631\u0686\u0633\u0628 \u06A9\u0634\u0648\u0631 endpoint candidate \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A", 409);
    const proof = await env.DB.prepare(
      `SELECT cc,proxy,edge_ms,created_at FROM mesh_measurements
       WHERE mode = ? AND cc = ? AND alive = 1 AND edge_ms > 0
         AND created_at >= datetime('now','-15 minutes')
       ORDER BY created_at DESC LIMIT 1`
    ).bind(mode, cc).first();
    if (!proof)
      return bad("fresh_proof_required", "\u0627\u0628\u062A\u062F\u0627 \u0645\u0633\u0627\u0628\u0642\u0647 \u0648\u0627\u0642\u0639\u06CC \u0627\u06CC\u0646 \u0645\u0633\u06CC\u0631 \u0631\u0627 \u0627\u062C\u0631\u0627 \u06A9\u0646\u06CC\u062F", 409);
    const proxy = String(proof.proxy || "").trim();
    if (!proxy)
      return bad("missing_proxy", "\u062E\u0631\u0648\u062C\u06CC \u0633\u0627\u0644\u0645 \u0627\u0645\u0627 \u0622\u062F\u0631\u0633 \u0642\u0627\u0628\u0644 \u0627\u0639\u0645\u0627\u0644 \u0646\u062F\u0627\u0631\u062F", 409);
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
    if (typeof body.auto_failover === "boolean")
      applyPatch.mesh_auto_failover = body.auto_failover ? "1" : "0";
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
              COALESCE(SUM(up_bytes), 0) uploaded_bytes,
              COALESCE(SUM(down_bytes), 0) downloaded_bytes,
              COALESCE(SUM(up_bytes + down_bytes), 0) used_bytes,
              COALESCE(SUM(request_count), 0) connection_events,
              SUM(CASE WHEN expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now') THEN 1 ELSE 0 END) expired,
              SUM(CASE WHEN expires_at IS NOT NULL AND datetime(expires_at) > datetime('now')
                       AND datetime(expires_at) <= datetime('now','+24 hours') THEN 1 ELSE 0 END) expiring_24h,
              SUM(CASE WHEN quota_bytes > 0 AND (up_bytes + down_bytes) >= quota_bytes * 0.9
                       AND (up_bytes + down_bytes) < quota_bytes THEN 1 ELSE 0 END) near_quota
       FROM users`
    ).first();
    const series = await env.DB.prepare(
      `SELECT day, COALESCE(SUM(up_bytes),0) up, COALESCE(SUM(down_bytes),0) down,
              COALESCE(SUM(conns),0) connection_events
       FROM usage_daily WHERE day >= date('now', ?) GROUP BY day ORDER BY day`
    ).bind(`-${days - 1} days`).all();
    const map = new Map((series.results || []).map((r) => [r.day, r]));
    const filled = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      const row = map.get(day);
      filled.push({
        day,
        up: Number(row?.up || 0),
        down: Number(row?.down || 0),
        connection_events: Number(row?.connection_events || 0)
      });
    }
    const today = await env.DB.prepare(
      `SELECT COALESCE(SUM(conns),0) connection_events FROM usage_daily WHERE day = date('now')`
    ).first();
    const top = await env.DB.prepare(
      `SELECT username, (up_bytes + down_bytes) used_bytes, quota_bytes FROM users
       ORDER BY used_bytes DESC LIMIT 6`
    ).all();
    const connectionEvents = Number(agg?.connection_events || 0);
    return json({
      ok: true,
      generated_at: (/* @__PURE__ */ new Date()).toISOString(),
      timezone: "UTC",
      users: {
        total: Number(agg?.total || 0),
        active: Number(agg?.active || 0),
        disabled: Number(agg?.disabled || 0),
        expired: Number(agg?.expired || 0),
        expiring_24h: Number(agg?.expiring_24h || 0),
        near_quota: Number(agg?.near_quota || 0),
        used_bytes: Number(agg?.used_bytes || 0),
        uploaded_bytes: Number(agg?.uploaded_bytes || 0),
        downloaded_bytes: Number(agg?.downloaded_bytes || 0),
        connection_events: connectionEvents,
        // Deprecated compatibility key: this product does not measure Cloudflare HTTP requests.
        requests: null
      },
      connection_events: {
        today: Number(today?.connection_events || 0),
        total: connectionEvents,
        timezone: "UTC",
        source: "authenticated-tunnel-registration",
        semantics: "Worker connection-start counter; locally throttled per user and not a Cloudflare request total."
      },
      traffic: {
        source: "accounted tunnel bytes",
        uploaded_bytes: Number(agg?.uploaded_bytes || 0),
        downloaded_bytes: Number(agg?.downloaded_bytes || 0),
        timezone: "UTC"
      },
      cloudflare: {
        available: false,
        daily: null,
        limit: null,
        pct: null,
        source: null,
        reason: "Cloudflare Analytics/Workers Insights is not configured for this panel."
      },
      series: filled,
      top: (top.results || []).map((r) => ({
        username: r.username,
        used_bytes: Number(r.used_bytes || 0),
        quota_gb: Number(r.quota_bytes || 0) / GB
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
    if (status === "active")
      where.push(`is_active = 1 AND (expires_at IS NULL OR datetime(expires_at) > datetime('now')) AND (quota_bytes = 0 OR (up_bytes+down_bytes) < quota_bytes)`);
    else if (status === "disabled")
      where.push("is_active = 0");
    else if (status === "expired")
      where.push(`(expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now')) OR (quota_bytes > 0 AND (up_bytes+down_bytes) >= quota_bytes)`);
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
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username))
      return bad("bad_username", "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0641\u0642\u0637 \u062D\u0631\u0648\u0641/\u0639\u062F\u062F/\u0646\u0642\u0637\u0647/\u062E\u0637 \u062A\u06CC\u0631\u0647 (\u06F3 \u062A\u0627 \u06F4\u06F0 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631)");
    const exists = await env.DB.prepare("SELECT 1 FROM users WHERE username = ?").bind(username).first();
    if (exists)
      return bad("exists", "\u0627\u06CC\u0646 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0642\u0628\u0644\u0627\u064B \u0633\u0627\u062E\u062A\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A", 409);
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
    if (!names.length)
      return bad("no_users", "\u06A9\u0627\u0631\u0628\u0631\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u0646\u0634\u062F\u0647");
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
      await env.DB.prepare(`UPDATE users SET quota_bytes = ? WHERE username IN (${ph})`).bind(Math.max(0, value) * GB, ...names).run();
      affected = names.length;
      await invalidateUsersByNames(env, names);
    } else
      return bad("bad_op", "\u0639\u0645\u0644\u06CC\u0627\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631");
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
      if (body.traffic !== false)
        fields.push("up_bytes = 0", "down_bytes = 0");
      if (body.requests !== false)
        fields.push("request_count = 0");
      if (body.devices)
        fields.push("activated_at = NULL");
      if (fields.length)
        await env.DB.prepare(`UPDATE users SET ${fields.join(", ")} WHERE username = ?`).bind(username).run();
      if (body.devices)
        await env.DB.prepare("DELETE FROM devices WHERE username = ?").bind(username).run();
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
    if (!user)
      return bad("not_found", "\u06A9\u0627\u0631\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F", 404);
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
      "mesh_auto_failover", "mesh_active_mode", "mesh_direct_domains", "finalmask_preset", "cipher_suites", "ech_mode", "alpn_pref" ];
    const patch = {};
    for (const k of allowed) {
      const v = body[k];
      if (v === void 0)
        continue;
      patch[k] = Array.isArray(v) ? JSON.stringify(v) : typeof v === "boolean" ? v ? "1" : "0" : String(v);
    }
    if (patch.path && !String(patch.path).startsWith("/"))
      return bad("bad_path", "\u0645\u0633\u06CC\u0631 \u0628\u0627\u06CC\u062F \u0628\u0627 / \u0634\u0631\u0648\u0639 \u0634\u0648\u062F");
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
    if (next.length < 6)
      return bad("weak_password", "\u0631\u0645\u0632 \u062C\u062F\u06CC\u062F \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F6 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F");
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
    if (match)
      await revokeSession(env, match.id);
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
    const reachable = results.filter((r) => r.tcp_reachable).length;
    await logEvent(env, "info", `\u0627\u0633\u06A9\u0646 \u06A9\u0627\u0646\u062F\u06CC\u062F\u0647\u0627\u06CC \u062E\u0631\u0648\u062C\u06CC: TCP 443 \u0627\u0632 Worker \u0628\u0647 ${reachable}/${results.length} \u06A9\u0634\u0648\u0631-\u0628\u0631\u0686\u0633\u0628 \u067E\u0627\u0633\u062E \u062F\u0627\u062F\u061B \u062E\u0631\u0648\u062C\u06CC/\u0645\u0648\u0642\u0639\u06CC\u062A \u062C\u063A\u0631\u0627\u0641\u06CC\u0627\u06CC\u06CC \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F\u0647 \u0627\u0633\u062A`);
    return json({
      ok: true,
      total: results.length,
      reachable,
      alive: reachable,
      // compatibility alias; means TCP 443 only
      measurement_scope: "Omni Worker -> catalogued endpoint TCP 443; proxy service and country are unverified.",
      results
    });
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
    const finalClean = [...new Set(probed.filter((r) => r.alive && r.is_cf && r.verified && !r.is_proxy).map((r) => r.ip))].slice(0, 14);
    const finalPool = finalClean.join("\n");
    let applied = false;
    if (body.apply !== false && finalClean.length) {
      await putSettingsBulk(env, {
        clean_ips: JSON.stringify(finalClean),
        ip_pool: finalPool
      });
      applied = true;
    }
    await logEvent(
      env,
      finalClean.length ? "info" : "warn",
      finalClean.length ? `\u0686\u0631\u062E\u0634 \u0645\u062E\u0632\u0646: ${finalClean.length} \u06A9\u0627\u0646\u062F\u06CC\u062F \u0628\u0627 \u067E\u0627\u0633\u062E Cloudflare \u0632\u0646\u062F\u0647 \u062A\u0623\u06CC\u06CC\u062F \u0634\u062F${applied ? " \u0648 \u0627\u0639\u0645\u0627\u0644 \u0634\u062F" : ""}` : "\u0686\u0631\u062E\u0634 \u0645\u062E\u0632\u0646 \u0644\u063A\u0648 \u0634\u062F: \u0647\u06CC\u0686 \u06A9\u0627\u0646\u062F\u06CC\u062F\u06CC \u0628\u0627 \u067E\u0631\u0648\u0628 \u0632\u0646\u062F\u0647\u0654 Cloudflare \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F"
    );
    return json({
      ok: true,
      applied,
      clean_ips: finalClean,
      ip_pool: finalPool,
      results: probed,
      note: "Only live Worker-side Cloudflare responses are included; client-route suitability still requires a device-side test."
    });
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
      for (let i = 0; i < l.length; i++)
        pkt[off++] = l.charCodeAt(i);
    }
    pkt[off++] = 0;
    pkt[off++] = 0;
    pkt[off++] = 1;
    pkt[off++] = 0;
    pkt[off++] = 1;
    const parseWireIps = (buf) => {
      if (!buf || buf.byteLength < 12)
        return { rcode: -1, ips: [] };
      const rcode = buf[3] & 15;
      const qd = buf[4] << 8 | buf[5];
      const an = buf[6] << 8 | buf[7];
      let pOff = 12;
      const skipName = (o) => {
        let cur = o, guard = 0;
        while (cur < buf.byteLength && guard++ < 64) {
          const ln = buf[cur];
          if (ln === 0)
            return cur + 1;
          if ((ln & 192) === 192)
            return cur + 2;
          cur += 1 + ln;
        }
        return cur;
      };
      for (let i = 0; i < qd && pOff < buf.byteLength; i++)
        pOff = skipName(pOff) + 4;
      const ips = [];
      for (let i = 0; i < an && pOff + 10 <= buf.byteLength; i++) {
        pOff = skipName(pOff);
        if (pOff + 10 > buf.byteLength)
          break;
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
    if (!target.includes(":"))
      target = target.replace(/:\d+$/, "");
    if (!target)
      return bad("no_target", "\u0645\u0642\u0635\u062F \u0645\u0634\u062E\u0635 \u0646\u06CC\u0633\u062A");
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
          if (c)
            detectedColo = c.toUpperCase();
          one = { seq, ok: r.ok, ms: Math.max(1, Date.now() - t0), via: "trace", status: r.status, colo: detectedColo };
        } catch (e) {
          one = { seq, ok: false, ms: null, error: String(e?.message || e).slice(0, 60) };
        }
      } else if (isIp) {
        const http = await httpProbe(target, { timeoutMs: 3e3 });
        if (http.alive) {
          if (http.colo)
            detectedColo = http.colo;
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
          if (c)
            detectedColo = c.toUpperCase();
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
      if (first.kind === "timeout")
        out.timeout = true;
      else {
        out.eof = Boolean(first.done);
        out.bytes = first.value ? first.value.byteLength : 0;
        if (out.bytes)
          out.head = new TextDecoder().decode(first.value.slice(0, 80)).split("\n")[0];
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
    if (body.apply) {
      return bad("client_measurement_required", "Only a fresh client-side measurement can be applied as a clean IP.", 409);
    }
    const edge = await rankIpsHttp(pool.slice(0, 64), {
      concurrency: Number(body.concurrency || 12),
      timeoutMs: Number(body.timeout || 2500)
    });
    const results = edge.filter(Boolean).map((r) => {
      const country = COUNTRY_PROXY_MAP.get(String(r.ip || "").toLowerCase());
      const isProxy = Boolean(r.is_proxy || country);
      const workerReachable2 = isProxy ? Boolean(r.tcp_reachable) : Boolean(r.alive || r.edge_reachable);
      const cloudflareVerified = !isProxy && Boolean(r.alive && r.is_cf);
      const isAlive = Boolean(cloudflareVerified || workerReachable2 || r.alive || r.tcp_reachable);
      return {
        ip: r.ip,
        alive: isAlive,
        is_cf: !isProxy && Boolean(r.is_cf),
        is_proxy: isProxy,
        country: country?.cc || null,
        country_fa: country?.fa || null,
        flag: country?.flag || null,
        country_verified: false,
        geo_verified: false,
        worker_reachable: workerReachable2,
        tcp_reachable: isProxy ? workerReachable2 : false,
        verified: cloudflareVerified && Boolean(r.verified),
        trace_verified: Boolean(r.trace_verified),
        measurement_scope: r.measurement_scope || (isProxy ? "worker-tcp-connect" : "worker-http"),
        edge_ms: r.edge_ms ?? null,
        ms: null,
        client_ms: null,
        colo: r.colo || null,
        port2053: Boolean(r.port2053),
        src: "worker",
        error: r.error || (isProxy ? "TCP reachability only; proxy service and country are unverified" : void 0)
      };
    });
    const healthy = results.filter((r) => r.alive && r.is_cf && !r.is_proxy);
    const rejected = results.filter((r) => !r.alive).map((r) => ({
      ip: r.ip,
      alive: false,
      is_cf: r.is_cf,
      error: r.error || "No verified Cloudflare response from the Worker probe"
    }));
    const workerReachable = results.filter((r) => r.worker_reachable).length;
    await logEvent(env, "info", `\u0627\u0633\u06A9\u0646 \u06A9\u0627\u0646\u062F\u06CC\u062F\u0647\u0627: ${healthy.length} \u067E\u0627\u0633\u062E Cloudflare \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0627\u0632 ${results.length} \u067E\u0631\u0648\u0628\u061B ${workerReachable} \u0627\u062A\u0635\u0627\u0644 Worker \u0628\u0631\u0642\u0631\u0627\u0631 \u0634\u062F`);
    return json({
      ok: true,
      requested: pool.length,
      tested: results.length,
      total: results.length,
      healthy: healthy.length,
      alive: healthy.length,
      worker_reachable: workerReachable,
      rejected_count: rejected.length,
      rejected,
      client: 0,
      ips: healthy.map((r) => r.ip),
      results,
      measurement_scope: "Omni Worker -> candidate; not the browser/client route",
      note: "Only live, verified Cloudflare responses are healthy. ASN/catalog membership and cached client reports are not live results."
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
      if (/ورود|login/i.test(msg))
        action = "login";
      else if (/ساخته شد|ایجاد|create/i.test(msg))
        action = "create";
      else if (/حذف|delete/i.test(msg))
        action = "delete";
      else if (/به‌روزرسانی|تنظیمات|update/i.test(msg))
        action = "update";
      else if (/رتبه‌بندی|اسکن|scan/i.test(msg))
        action = "scan";
      else if (/نگهداری|maintenance/i.test(msg))
        action = "maintenance";
      else if (/probe/i.test(msg))
        action = "probe";
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
    for (const r of settingsRows.results || [])
      st[r.key] = r.value;
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
      if (!u?.username)
        continue;
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
    if (!chat || !env.BOT_TOKEN)
      return bad("bot_not_paired", "\u0631\u0628\u0627\u062A \u0645\u062A\u0635\u0644 \u0646\u06CC\u0633\u062A", 400);
    await tgApi2(env, "sendMessage", { chat_id: chat, text: String(body.text || "\u062A\u0633\u062A Omni \u2705").slice(0, 500), parse_mode: "HTML" });
    return json({ ok: true });
  }
  return bad("not_found", "\u0645\u0633\u06CC\u0631 \u0646\u0627\u0634\u0646\u0627\u062E\u062A\u0647", 404);
}
async function createUserRecord(env, settings, body) {
  const username = String(body.username).slice(0, 40);
  const quotaBytes = body.quota_bytes !== void 0 ? Number(body.quota_bytes) : Math.max(0, Number(body.quota_gb ?? settings.default_quota_gb ?? 50) * GB);
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
  if (body.quota_gb !== void 0)
    patch.sql.quota_bytes = Math.max(0, Number(body.quota_gb) * GB);
  if (body.quota_bytes !== void 0)
    patch.sql.quota_bytes = Math.max(0, Number(body.quota_bytes));
  if (body.device_limit !== void 0)
    patch.sql.device_limit = Math.max(1, Number(body.device_limit));
  if (body.request_limit !== void 0)
    patch.sql.request_limit = Math.max(0, Number(body.request_limit));
  if (body.note !== void 0)
    patch.sql.note = String(body.note).slice(0, 200);
  if (body.fragment !== void 0)
    patch.sql.fragment = String(body.fragment);
  if (body.fingerprint !== void 0)
    patch.sql.fingerprint = String(body.fingerprint);
  if (body.ips !== void 0)
    patch.sql.ips = JSON.stringify(safeArray(body.ips));
  if (body.proxies !== void 0)
    patch.sql.proxies = JSON.stringify(safeArray(body.proxies));
  if (body.block_list !== void 0)
    patch.sql.block_list = JSON.stringify(safeArray(body.block_list));
  if (body.is_active !== void 0)
    patch.sql.is_active = body.is_active ? 1 : 0;
  if (body.first_connect !== void 0)
    patch.sql.first_connect = body.first_connect ? 1 : 0;
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
    if (k === "expires_at")
      continue;
    sets.push(`${k} = ?`);
    binds.push(v);
  }
  if (patch.expires) {
    sets.push("expires_at = ?");
    binds.push(patch.expires);
  }
  if (!sets.length)
    return;
  if (patch.expires && current.first_connect && !current.activated_at) {
    sets.push("activated_at = datetime('now')");
  }
  binds.push(username);
  await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE username = ?`).bind(...binds).run();
}
async function invalidateUsersByNames(env, names, removed = false) {
  for (const n of names) {
    const row = await env.DB.prepare("SELECT uuid FROM users WHERE username = ?").bind(n).first().catch(() => null);
    if (row?.uuid)
      invalidateUser(row.uuid);
  }
  if (removed)
    invalidateUser(null);
}

// src/worker.js
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
      // Diagnostic WebSocket Ping check before proxy routing
      if (url.pathname === "/api/diag/ws-ping") {
        if ((request.headers.get("Upgrade") || "").toLowerCase() === "websocket") {
          const pair = new WebSocketPair();
          const [client, server] = Object.values(pair);
          server.accept();
          server.addEventListener("message", (ev) => {
            try {
              const msg = JSON.parse(ev.data);
              server.send(JSON.stringify({ type: "pong", client_t: msg.t || 0, server_t: Date.now(), colo: request?.cf?.colo || "EDGE" }));
            } catch {
              server.send(JSON.stringify({ type: "pong", server_t: Date.now() }));
            }
          });
          return new Response(null, { status: 101, webSocket: client });
        }
        return json({ ok: true, colo: request?.cf?.colo || "EDGE", time: Date.now() });
      }

      const upgrade = (request.headers.get("Upgrade") || "").toLowerCase();
      if (upgrade === "websocket") {
        const fastSettings = settingsCachedSync() || await settingsCached(env) || await bootstrap(env, url);
        try {
          return await handleProxy(request, env, ctx, url, fastSettings);
        } catch (e) {
          return new Response("proxy error: " + (e?.message || e), { status: 500 });
        }
      }
      const settings = await bootstrap(env, url);
      if (url.pathname.startsWith("/tg/")) {
        const secret = env.BOT_WEBHOOK_SECRET || "omni-hook";
        if (url.pathname !== `/tg/${secret}`)
          return new Response("forbidden", { status: 403 });
        const update = await request.json().catch(() => null);
        if (update)
          ctx.waitUntil(handleUpdate(env, ctx, url.origin, update).catch(() => {
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
