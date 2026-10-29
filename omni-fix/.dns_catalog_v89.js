    Ut = [
      {
        id: "cf", name: "Cloudflare", vendor: "1.1.1.1", region: "global",
        url: "https://cloudflare-dns.com/dns-query", dot: "one.one.one.one",
        ips: ["1.1.1.1", "1.0.0.1", "2606:4700:4700::1111"],
        note: "بدون ثبت وقفه (privacy-first)"
      },
      {
        id: "google", name: "Google", vendor: "Public DNS", region: "global",
        url: "https://dns.google/dns-query", dot: "dns.google",
        ips: ["8.8.8.8", "8.8.4.4", "2001:4860:4860::8888"],
        note: "پایدار و در دسترس جهانی"
      },
      {
        id: "quad9", name: "Quad9", vendor: "9.9.9.9", region: "global",
        url: "https://dns.quad9.net/dns-query", dot: "dns.quad9.net",
        ips: ["9.9.9.9", "149.112.112.112", "2620:fe::fe"],
        note: "مسدودسازی بدافزار و فیشینگ"
      },
      {
        id: "adguard", name: "AdGuard DNS", vendor: "adguard-dns", region: "global",
        url: "https://dns.adguard-dns.com/dns-query", dot: "dns.adguard-dns.com",
        ips: ["94.140.14.14", "94.140.15.15"],
        note: "بلوک‌کننده تبلیغ و ردیاب"
      },
      {
        id: "controld", name: "ControlD", vendor: "FreeDNS p0", region: "global",
        url: "https://freedns.controld.com/p0", dot: "p0.freedns.controld.com",
        ips: ["76.76.2.0", "76.76.10.0"],
        note: "نسخه رایگان بدون فیلتر"
      },
      {
        id: "opendns", name: "OpenDNS", vendor: "Cisco", region: "global",
        url: "https://doh.opendns.com/dns-query", dot: "dns.opendns.com",
        ips: ["208.67.222.222", "208.67.220.220"],
        note: "زیردانش‌ساخت سیسکو"
      },
      {
        id: "nextdns", name: "NextDNS", vendor: "nextdns.io", region: "global",
        url: "https://dns.nextdns.io/dns-query", dot: "dns.nextdns.io",
        ips: ["45.90.28.0", "45.90.30.0"],
        note: "نسخه کامل نیازمند پروفایل اختصاصی"
      },
      {
        id: "dnssb", name: "DNS.SB", vendor: "آلمان/هلند", region: "global",
        url: "https://doh.sb/dns-query", dot: "dot.sb",
        ips: ["45.11.45.11", "185.222.222.222"],
        note: "بدون ثبت وقفه"
      },
      {
        id: "cleanbrowsing", name: "CleanBrowsing", vendor: "Security Filter", region: "global",
        url: "https://doh.cleanbrowsing.org/doh/security-filter/", dot: "security-filter-dns.cleanbrowsing.org",
        ips: ["185.228.168.9", "185.228.169.9"],
        note: "فیلتر امنیتی محتوای مخرب"
      },
      {
        id: "alidns", name: "AliDNS", vendor: "Alibaba", region: "global",
        url: "https://dns.alidns.com/dns-query", dot: "dns.alidns.com",
        ips: ["223.5.5.5", "223.6.6.6"],
        note: "سریع در مسیر آسیا"
      },
      {
        id: "mullvad", name: "Mullvad DNS", vendor: "mullvad.net", region: "global",
        url: "https://doh.mullvad.net/dns-query", dot: "dns.mullvad.net",
        ips: ["194.242.2.2"],
        note: "ضدردیابی از سازنده VPN مول‌واد"
      },
      {
        id: "dns0", name: "dns0.eu", vendor: "اروپا", region: "global",
        url: "https://dns0.eu/dns-query", dot: "dns0.eu",
        ips: ["193.110.81.0", "185.253.5.0"],
        note: "بنیاد غیرانتفاعی اروپایی"
      },
      {
        id: "cznic", name: "CZ.NIC", vendor: "ODVR", region: "global",
        url: "https://odvr.nic.cz/dns-query", dot: "odvr.nic.cz",
        ips: ["193.17.47.1"],
        note: "رجیستری ملی چک"
      },
      {
        id: "libredns", name: "LibreDNS", vendor: "libredns.gr", region: "global",
        url: "https://doh.libredns.gr/dns-query", dot: "doh.libredns.gr",
        ips: ["116.202.176.26"],
        note: "سرویس آزاد یونانی"
      },
      {
        id: "uncensored", name: "UncensoredDNS", vendor: "دانمارک", region: "global",
        url: "https://anycast.uncensoreddns.org/dns-query", dot: "anycast.uncensoreddns.org",
        ips: ["91.239.100.100"],
        note: "بدون سانسور و بدون وقفه‌نگاری"
      },
      {
        id: "shecan", name: "شکن", vendor: "Shecan", region: "ir",
        url: "https://free.shecan.ir/dns-query", dot: "free.shecan.ir",
        ips: ["178.22.122.122", "185.51.200.2"],
        note: "دسترسی به سرویس‌های تحریم‌شده"
      },
      {
        id: "electro", name: "الکترو", vendor: "ElectroTM", region: "ir",
        url: "https://dns.electrotm.org/dns-query", dot: "dns.electrotm.org",
        ips: ["78.157.42.100", "78.157.42.101"],
        note: "رزولوور ایرانی"
      },
      {
        id: "radar", name: "رادار گیم", vendor: "Radar Game", region: "ir",
        url: "https://radar.game/dns-query", dot: "radar.game",
        ips: ["10.202.10.10", "10.202.10.11"],
        note: "بهینه برای بازی"
      },
      {
        id: "begzar", name: "بگذر", vendor: "Begzar", region: "ir",
        url: "https://dns.begzar.ir/dns-query", dot: "dns.begzar.ir",
        ips: ["185.55.226.26", "185.55.225.25"],
        note: "دور زدن تحریم"
      },
      {
        id: "f403", name: "۴۰۳", vendor: "403.online", region: "ir",
        url: "https://dns.403.online/dns-query", dot: "dns.403.online",
        ips: ["10.202.10.202", "10.202.10.102"],
        note: "سرویس عمومی ایرانی"
      }
    ],
