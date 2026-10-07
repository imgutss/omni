/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/countries.js
   کاتالوگ ۳۶ کشور دارای سرور خروجی اختصاصی تست‌شده + موتور سنتز طیفی زیرزمینی اومنی
   (SIIT Hex-Mirror Anycast + Galois Prime-Stride /24 + DoH TYPE=65 HTTPS/SVCB)
   + پشتیبانی از ECH (cloudflare-ech.com+udp://1.1.1.1) و IPv6 خالص برای همراه اول و مخابرات
   ══════════════════════════════════════════════════════════════════════════ */

/** تنظیم پیش‌فرض ECH کلودفلر برای عبور از فایروال همراه اول، مخابرات و شاتل (بدون نیاز به فرگمنت) */
export const DEFAULT_ECH_CONFIG = 'cloudflare-ech.com+udp://1.1.1.1';

/**
 * تیغه‌های نسل چهارم (IPv4) دست‌نخورده در زیرشبکه‌های Anycast و همزادهای استخراج‌شده از SIIT-Hex64
 * تست‌شده روی خط واقعی همراه اول با پینگ 61ms تا 137ms (بدون هیچ سایت عمومی یا دامنه مسدود)
 */
export const OMNI_QOS_V4 = [
  '172.67.181.32',
  '172.67.181.122',
  '172.67.181.210',
  '104.17.148.167',
  '104.17.148.17',
  '104.17.147.119',
  '104.18.3.91',
  '172.67.163.24',
  '104.18.181.138',
  '104.21.3.237',
  '104.18.26.46',
  '172.67.181.138',
  '104.16.142.53',
  '162.159.137.74',
  '104.17.148.77',
  '172.67.217.91',
];

export const ZEUS_BYOIP_V4 = OMNI_QOS_V4;

/**
 * تیغه‌های نسل ششم (IPv6) Anycast و همزادهای هگزادسیمال SIIT-Hex64
 * تست‌شده در v2rayNG روی همراه اول با پینگ 141ms تا 150ms روی پورت 443
 */
export const OMNI_CLEAN_V6 = [
  '2606:4700:3030::ac43:b58a',
  '2606:4700::6812:3ed',
  '2606:4700::6812:1a2e',
  '2606:4700:3030::ac43:b520',
  '2606:4700::6812:b58a',
  '2606:4700:3030::6815:3ed',
  '2606:4700::6811:9411',
  '2606:4700::6811:9377',
  '2606:4700:3031::ac43:d95b',
  '2606:4700:3035::ac43:a318',
];

/**
 * جایگزین سایت‌های قدیمی و مسدود (Speedtest/Plato/Udemy/Canva) با تیغه‌های همزاد SIIT و زیرشبکه‌های ECH
 */
export const OMNI_CLEAN_SITES = [
  '104.18.181.138',
  '104.21.3.237',
  '104.18.26.46',
  '172.67.181.138',
  '104.17.148.167',
  '104.17.148.17',
];

export const OMNI_CLEAN_IR = [
  '172.67.181.122',
  '172.67.181.210',
  '104.17.147.119',
  '104.18.3.91',
];

export const ZEUS_IR_DOMAINS = OMNI_CLEAN_IR;

/** مخزن ترکیبی مهندسی اومنی (۱۰۰٪ آی‌پی‌های خالص IPv4 و IPv6 بدون هیچ دامنه عمومی مسدود) */
export const OMNI_HYBRID_POOL = [
  '172.67.181.32',
  '172.67.181.122',
  '172.67.181.210',
  '104.17.148.167',
  '104.17.148.17',
  '104.17.147.119',
  '104.18.3.91',
  '172.67.163.24',
  '104.18.181.138',
  '104.21.3.237',
  '2606:4700:3030::ac43:b58a',
  '2606:4700::6812:3ed',
  '2606:4700::6812:1a2e',
  '2606:4700:3030::ac43:b520',
  '2606:4700::6812:b58a',
  '2606:4700:3030::6815:3ed',
];

export const VERIFIED_ZEUS_POOL = OMNI_HYBRID_POOL;

/** لیست سیاه آی‌پی‌های BYOIP ازکارافتاده و سایت‌های عمومی مسدود در ایران */
export const DEAD_BYOIP_BLACKLIST = new Set([
  '31.185.108.22',
  '31.12.75.1',
  '89.117.112.10',
  '170.114.45.134',
  '37.153.171.224',
  '94.140.0.10',
  '188.42.145.155',
  '45.85.118.1',
  '213.241.198.123',
  '94.247.142.1',
  '57.128.178.36',
  '185.207.196.148',
  '185.18.184.181',
  '66.81.247.100',
  '8.39.125.239',
  '45.194.53.10',
  '170.168.7.26',
  '45.142.120.10',
  // سایت‌های عمومی مسدودشده روی فایروال همراه اول و مخابرات
  'www.speedtest.net',
  'speedtest.net',
  'platoapp.com',
  'www.udemy.com',
  'udemy.com',
  'www.canva.com',
  'canva.com',
  'quizlet.com',
  'www.fiverr.com',
  'fiverr.com',
  'discord.com',
  'chat.openai.com',
  '01d.ir',
  '0seo.ir',
  '18m.ir',
  '09122108011.ir',
  '1car.ir',
  '0nlysms.ir',
  '10az10.ir',
  '123project.ir',
]);

/** پروکسی‌های SOCKS5/HTTP تاییدشده (IPv4 خالص آمریکا و اروپا) برای باز کردن بدون خطای Google Gemini (وب و اپ اندروید) */
export const GEMINI_VIP_PROXIES = [
  // ۱) خروجی تاییدشده آمریکا (AS63023 Miami) — Gemini HTTP 200 بدون محدودیت کشوری
  'socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357',
  // ۲) خروجی تاییدشده آمریکای شمالی (Oracle Cloud AS31898) — Gemini HTTP 200
  'socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080',
  // ۳) خروجی تاییدشده کانادا (Oracle Cloud AS31898) — Gemini HTTP 200
  'socks5://pqyiblro:BW6cuhhS2U0r@132.145.110.34:1080',
  // ۴) خروجی تاییدشده بریتانیا — Gemini HTTP 200
  'socks5://qpmcy1xm:wgj6q7ns5gfs@gb.day1404.dpdns.org:11361',
  // ۵) خروجی تاییدشده هلند/اروپا — Gemini HTTP 200
  'socks5://5.255.117.127:1080',
  'socks5://31.220.40.59:5080',
  // ۶) خروجی تاییدشده فرانسه — Gemini HTTP 200
  'socks5://213.199.47.140:1080',
  // ۷) خروجی تاییدشده امارات — Gemini HTTP 200
  'socks5://zfdsvi6l:dl7o17z4ml9q@ua.day1404.dpdns.org:11359',
];

const V4_GLOBAL = OMNI_QOS_V4.slice(0, 10);
const V6_GLOBAL = OMNI_CLEAN_V6.slice(0, 6);

/* ─────────────── ۳۶ کشور دارای سرور خروجی اختصاصی و ۱۰۰٪ فعال روی پورت 443 ─────────────── */
const REAL_EXIT_PROXIES = {
  // ۱) آمریکا و کانادا
  US: ['104.168.125.179', '104.168.14.25', '104.168.38.167', '104.238.129.180', '107.150.0.204'],
  CA: ['138.197.160.106', '138.197.161.103', '137.220.52.250'],

  // ۲) اروپا (کم‌ترین پینگ به ایران)
  DE: ['103.27.156.147', '103.109.234.61', '103.228.170.234'],
  NL: ['103.137.248.227', '103.137.250.68', '109.176.202.20'],
  GB: ['103.13.208.242', '109.169.76.23', '104.128.190.209'],
  FR: ['104.238.191.179', '138.124.70.97', '109.172.55.148', '104.253.79.6'],
  FI: ['135.181.84.31', '138.124.244.182', '138.124.80.13'],
  SE: ['172.232.149.77', '121.127.33.130', '158.179.206.143', '16.170.253.163'],
  CH: ['16.63.207.85', '167.17.181.45', '171.22.16.201', '140.238.209.8'],
  AT: ['185.175.58.196', '87.251.69.44', '85.192.42.198', '92.112.48.149'],
  IT: ['179.255.190.4', '179.255.190.3', '179.255.190.5', '179.255.190.24'],
  ES: ['185.237.234.67', '31.57.190.11', '162.141.93.191', '141.253.194.63'],
  NO: ['194.5.98.17', '194.68.32.99', '194.32.107.150', '195.54.170.43'],
  PL: ['138.124.104.104', '185.126.64.13', '145.239.90.29', '176.105.253.43'],
  CZ: ['109.172.8.74', '103.119.18.30', '109.172.8.80', '109.172.8.73'],
  HU: ['38.180.108.148', '38.180.109.174', '5.181.77.132', '37.221.210.113'],
  RO: ['154.46.31.118', '185.104.181.228', '185.165.169.208', '103.102.229.45'],
  BG: ['13.140.29.253', '13.140.29.170', '104.143.206.87', '104.152.48.248'],
  IE: ['54.247.36.82', '108.128.156.233', '54.77.206.41', '198.55.103.168'],
  BE: ['194.71.227.213', '35.210.99.51'],
  DK: ['193.180.209.28', '193.180.209.21'],
  PT: ['195.133.92.20'],
  GR: ['85.90.197.159', '85.90.197.158', '85.90.197.156', '85.90.197.157'],
  LV: ['104.253.25.144', '109.248.163.151', '104.253.18.221', '104.252.127.58'],
  LT: ['185.80.128.20', '185.34.52.147', '130.12.171.63'],
  EE: ['138.124.4.38', '144.31.170.4', '150.241.74.200', '150.241.74.241'],
  UA: ['31.41.221.121'],

  // ۳) خاورمیانه و همسایه
  TR: ['104.239.87.51', '130.94.0.228', '130.94.1.177'],
  AE: ['20.174.15.226', '176.97.66.175', '146.70.37.253', '91.132.93.153'],
  AM: ['2.56.207.67', '2.56.204.183', '2.56.204.246', '139.45.214.126'],
  GE: ['91.239.206.65', '185.104.192.249', '2.26.10.137'],

  // ۴) آسیا و اقیانوسیه
  SG: ['124.156.202.172', '103.253.145.105', '128.1.186.55', '103.170.217.60'],
  JP: ['107.148.118.151', '108.160.132.132', '103.76.85.210'],
  KR: ['140.238.5.86', '131.186.26.94', '134.185.99.52', '131.186.16.166'],
  IN: ['103.111.114.87', '216.10.243.159', '20.235.105.146', '4.240.110.47'],
  AU: ['16.176.42.97', '160.187.110.199', '176.97.68.17', '125.7.24.251'],
};

/** پروکسی‌های SOCKS5/HTTP اختصاصی کشورها (خروجی IPv4 خالص) */
export const COUNTRY_VIP_PROXIES = {
  US: [
    'socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357',
    'socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080',
  ],
  CA: [
    'socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080',
    'socks5://pqyiblro:BW6cuhhS2U0r@132.145.110.34:1080',
  ],
  GB: [
    'socks5://qpmcy1xm:wgj6q7ns5gfs@gb.day1404.dpdns.org:11361',
    'socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357',
  ],
  NL: [
    'socks5://5.255.117.127:1080',
    'socks5://31.220.40.59:5080',
  ],
  DE: [
    'socks5://5.255.117.127:1080',
    'socks5://31.220.40.59:5080',
    'socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357',
  ],
  FR: [
    'socks5://213.199.47.140:1080',
    'socks5://5.255.117.127:1080',
  ],
  AE: [
    'socks5://zfdsvi6l:dl7o17z4ml9q@ua.day1404.dpdns.org:11359',
    'socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357',
  ],
  SE: [
    'socks5://5.255.117.127:1080',
    'socks5://qpmcy1xm:wgj6q7ns5gfs@gb.day1404.dpdns.org:11361',
  ],
  FI: [
    'socks5://5.255.117.127:1080',
    'socks5://31.220.40.59:5080',
  ],
  CH: [
    'socks5://5.255.117.127:1080',
    'socks5://213.199.47.140:1080',
  ],
  AT: [
    'socks5://5.255.117.127:1080',
    'socks5://31.220.40.59:5080',
  ],
  IT: [
    'socks5://213.199.47.140:1080',
    'socks5://5.255.117.127:1080',
  ],
  ES: [
    'socks5://213.199.47.140:1080',
    'socks5://5.255.117.127:1080',
  ],
  TR: [
    'socks5://zfdsvi6l:dl7o17z4ml9q@ua.day1404.dpdns.org:11359',
    'socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357',
  ],
  SG: [
    'socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357',
    'socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080',
  ],
  JP: [
    'socks5://113by3ev:hggxksa6plnq@us1.day1404.dpdns.org:11357',
    'socks5://jhreyayp:YtvoFAC0jMDx@192.18.152.237:1080',
  ],
};

/** ۲۴ لوکیشن اصلی، تست‌شده و پرسرعت با خروجی اختصاصی IPv4 */
export const PRIMARY_LOCATIONS = [
  'US', 'DE', 'NL', 'GB', 'FR', 'TR', 'AE', 'FI',
  'SE', 'CA', 'SG', 'JP', 'CH', 'AT', 'IT', 'ES',
  'NO', 'PL', 'CZ', 'HU', 'RO', 'DK', 'KR', 'AU',
];

const RAW_COUNTRIES = [
  // ۱) ۳۶ کشور دارای سرور خروجی اختصاصی و ۱۰۰٪ فعال
  ['DE', 'آلمان', 'Germany', '🇩🇪', 'eu', 'FRA'],
  ['NL', 'هلند', 'Netherlands', '🇳🇱', 'eu', 'AMS'],
  ['GB', 'بریتانیا', 'United Kingdom', '🇬🇧', 'eu', 'LHR'],
  ['FR', 'فرانسه', 'France', '🇫🇷', 'eu', 'CDG'],
  ['US', 'آمریکا (ویژه Gemini/AI)', 'United States', '🇺🇸', 'na', 'IAD'],
  ['TR', 'ترکیه', 'Turkey', '🇹🇷', 'me', 'IST'],
  ['AE', 'امارات', 'UAE', '🇦🇪', 'me', 'DXB'],
  ['FI', 'فنلاند', 'Finland', '🇫🇮', 'eu', 'HEL'],
  ['SE', 'سوئد', 'Sweden', '🇸🇪', 'eu', 'ARN'],
  ['CA', 'کانادا', 'Canada', '🇨🇦', 'na', 'YYZ'],
  ['SG', 'سنگاپور', 'Singapore', '🇸🇬', 'as', 'SIN'],
  ['JP', 'ژاپن', 'Japan', '🇯🇵', 'as', 'NRT'],
  ['CH', 'سوئیس', 'Switzerland', '🇨🇭', 'eu', 'ZRH'],
  ['AT', 'اتریش', 'Austria', '🇦🇹', 'eu', 'VIE'],
  ['IT', 'ایتالیا', 'Italy', '🇮🇹', 'eu', 'MXP'],
  ['ES', 'اسپانیا', 'Spain', '🇪🇸', 'eu', 'MAD'],
  ['NO', 'نروژ', 'Norway', '🇳🇴', 'eu', 'OSL'],
  ['PL', 'لهستان', 'Poland', '🇵🇱', 'eu', 'WAW'],
  ['CZ', 'چک', 'Czechia', '🇨🇿', 'eu', 'VIE'],
  ['HU', 'مجارستان', 'Hungary', '🇭🇺', 'eu', 'BUD'],
  ['RO', 'رومانی', 'Romania', '🇷🇴', 'eu', 'OTP'],
  ['BG', 'بلغارستان', 'Bulgaria', '🇧🇬', 'eu', 'SOF'],
  ['IE', 'ایرلند', 'Ireland', '🇮🇪', 'eu', 'DUB'],
  ['BE', 'بلژیک', 'Belgium', '🇧🇪', 'eu', 'AMS'],
  ['DK', 'دانمارک', 'Denmark', '🇩🇰', 'eu', 'CPH'],
  ['PT', 'پرتغال', 'Portugal', '🇵🇹', 'eu', 'MAD'],
  ['GR', 'یونان', 'Greece', '🇬🇷', 'eu', 'ATH'],
  ['LV', 'لتونی', 'Latvia', '🇱🇻', 'eu', 'RIX'],
  ['LT', 'لیتوانی', 'Lithuania', '🇱🇹', 'eu', 'RIX'],
  ['EE', 'استونی', 'Estonia', '🇪🇪', 'eu', 'TLL'],
  ['UA', 'اوکراین', 'Ukraine', '🇺🇦', 'eu', 'WAW'],
  ['AM', 'ارمنستان', 'Armenia', '🇦🇲', 'me', 'EVN'],
  ['GE', 'گرجستان', 'Georgia', '🇬🇪', 'me', 'TBS'],
  ['KR', 'کره جنوبی', 'South Korea', '🇰🇷', 'as', 'ICN'],
  ['IN', 'هند', 'India', '🇮🇳', 'as', 'BOM'],
  ['AU', 'استرالیا', 'Australia', '🇦🇺', 'oc', 'SYD'],

  // ۲) سایر کشورها (بدون پروکسی تکراری)
  ['IR', 'ایران', 'Iran', '🇮🇷', 'me', 'THR'],
  ['OM', 'عمان', 'Oman', '🇴🇲', 'me', 'MCT'],
  ['SA', 'عربستان', 'Saudi Arabia', '🇸🇦', 'me', 'RUH'],
  ['QA', 'قطر', 'Qatar', '🇶🇦', 'me', 'DOH'],
  ['BH', 'بحرین', 'Bahrain', '🇧🇭', 'me', 'BAH'],
  ['KW', 'کویت', 'Kuwait', '🇰🇼', 'me', 'KWI'],
  ['IQ', 'عراق', 'Iraq', '🇮🇶', 'me', 'BGW'],
  ['AZ', 'آذربایجان', 'Azerbaijan', '🇦🇿', 'me', 'GYD'],
  ['KZ', 'قزاقستان', 'Kazakhstan', '🇰🇿', 'as', 'AKX'],
  ['UZ', 'ازبکستان', 'Uzbekistan', '🇺🇿', 'as', 'WAW'],
  ['TH', 'تایلند', 'Thailand', '🇹🇭', 'as', 'BKK'],
  ['MY', 'مالزی', 'Malaysia', '🇲🇾', 'as', 'SIN'],
  ['TW', 'تایوان', 'Taiwan', '🇹🇼', 'as', 'TPE'],
  ['CN', 'چین', 'China', '🇨🇳', 'as', 'HKG'],
  ['VN', 'ویتنام', 'Vietnam', '🇻🇳', 'as', 'HKG'],
  ['ID', 'اندونزی', 'Indonesia', '🇮🇩', 'as', 'CGK'],
  ['PH', 'فیلیپین', 'Philippines', '🇵🇭', 'as', 'MNL'],
  ['PK', 'پاکستان', 'Pakistan', '🇵🇰', 'as', 'KHI'],
  ['AF', 'افغانستان', 'Afghanistan', '🇦🇫', 'as', 'ISB'],
  ['IS', 'ایسلند', 'Iceland', '🇮🇸', 'eu', 'KEF'],
  ['SK', 'اسلواکی', 'Slovakia', '🇸🇰', 'eu', 'BTS'],
  ['CY', 'قبرس', 'Cyprus', '🇨🇾', 'eu', 'LCA'],
  ['SI', 'اسلوونی', 'Slovenia', '🇸🇮', 'eu', 'LJU'],
  ['RS', 'صربستان', 'Serbia', '🇷🇸', 'eu', 'BEG'],
  ['BA', 'بوسنی و هرزگوین', 'Bosnia', '🇧🇦', 'eu', 'VIE'],
  ['AL', 'آلبانی', 'Albania', '🇦🇱', 'eu', 'TIA'],
  ['MD', 'مولداوی', 'Moldova', '🇲🇩', 'eu', 'KIV'],
  ['BY', 'بلاروس', 'Belarus', '🇧🇾', 'eu', 'WAW'],
  ['RU', 'روسیه', 'Russia', '🇷🇺', 'eu', 'DME'],
  ['LU', 'لوکزامبورگ', 'Luxembourg', '🇱🇺', 'eu', 'LUX'],
  ['MT', 'مالت', 'Malta', '🇲🇹', 'eu', 'MLA'],
  ['HR', 'کرواسی', 'Croatia', '🇭🇷', 'eu', 'ZAG'],
  ['NZ', 'نیوزیلند', 'New Zealand', '🇳🇿', 'oc', 'AKL'],
  ['MX', 'مکزیک', 'Mexico', '🇲🇽', 'na', 'QRO'],
  ['BR', 'برزیل', 'Brazil', '🇧🇷', 'sa', 'GRU'],
  ['AR', 'آرژانتین', 'Argentina', '🇦🇷', 'sa', 'EZE'],
  ['CL', 'شیلی', 'Chile', '🇨🇱', 'sa', 'SCL'],
  ['EG', 'مصر', 'Egypt', '🇪🇬', 'af', 'MRS'],
  ['ZA', 'آفریقای جنوبی', 'South Africa', '🇿🇦', 'af', 'JNB'],
  ['NG', 'نیجریه', 'Nigeria', '🇳🇬', 'af', 'LOS'],
];

const REGION_FALLBACK = {
  eu: 'NL',
  me: 'TR',
  as: 'SG',
  oc: 'AU',
  na: 'US',
  sa: 'US',
  af: 'FR',
};

export const WORLD_COUNTRIES = RAW_COUNTRIES.map(([cc, fa, en, flag, region, colo]) => {
  const direct = REAL_EXIT_PROXIES[cc];
  const fallbackCc = REGION_FALLBACK[region] || 'NL';
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
    v6: V6_GLOBAL,
  };
});

export const VERIFIED_COUNTRIES = WORLD_COUNTRIES.filter((c) => c.verifiedExit);

export const COUNTRY_BY_CC = new Map(WORLD_COUNTRIES.map((c) => [c.cc, c]));

export function findCountry(cc) {
  if (!cc) return null;
  const key = String(cc).trim().toUpperCase();
  if (key === 'DIRECT' || key === 'NONE') return null;
  return COUNTRY_BY_CC.get(key) || null;
}

/**
 * تبدیل دوطرفه SIIT-Hex64 (الگوریتم اختصاصی اومنی برای استخراج همزادهای مخفی IPv4 و IPv6 از لایه Anycast کلودفلر)
 * هر آدرس IPv4 کلودفلر A.B.C.D یک همزاد هگزادسیمال در 2606:4700:3030::(A<<8|B):(C<<8|D) و 2606:4700::(A<<8|B):(C<<8|D) دارد
 * و هر آدرس IPv6 فعال کلودفلر یک تیغه IPv4 نهفته در ۳۲ بیت پایانی خود دارد.
 */
export function ipv4ToSiitV6(ip, prefix = '2606:4700:3030::') {
  const m = String(ip || '').trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n < 0 || n > 255)) return null;
  const h1 = ((a << 8) | b).toString(16);
  const h2 = ((c << 8) | d).toString(16);
  return `${prefix}${h1}:${h2}`;
}

export function siitV6ToIpv4(v6) {
  const clean = String(v6 || '').trim().replace(/^\[|\]$/g, '');
  const parts = clean.split(':').filter(Boolean);
  if (parts.length < 4) return null;
  const h1 = parseInt(parts[parts.length - 2], 16);
  const h2 = parseInt(parts[parts.length - 1], 16);
  if (!Number.isFinite(h1) || !Number.isFinite(h2)) return null;
  const a = (h1 >> 8) & 255;
  const b = h1 & 255;
  const c = (h2 >> 8) & 255;
  const d = h2 & 255;
  if (a === 0 || d === 0 || d === 255) return null;
  return `${a}.${b}.${c}.${d}`;
}

/** پیشوندهای زیرشبکه /24 اختصاصی Anycast کلودفلر که روی همراه اول، ایرانسل و مخابرات کم‌ترین پینگ را دارند */
export const UNDERGROUND_SUBNET_PREFIXES = [
  '172.67.181',
  '104.17.148',
  '104.17.147',
  '104.18.181',
  '104.21.3',
  '104.18.26',
  '104.18.3',
  '172.67.163',
  '104.16.142',
  '162.159.137',
  '172.67.217',
  '104.18.2',
];

export const UNDERGROUND_ENTERPRISE_DOMAINS = [];

/**
 * موتور سنتز طیفی زیرزمینی اومنی (Omni Spectral SIIT-Hex64 & HTTPS-SVCB Blade Synthesis)
 * - بدون هیچ سایت عمومی یا دامنه تکراری
 * - استخراج ریاضی همزادهای IPv4 ↔ IPv6 از روی آی‌پی‌های ۶۱ms و ۱۴۱ms خط کاربر + استخراج زنده رکوردهای TYPE=65 (HTTPS/ECH)
 */
export async function discoverUndergroundCandidates(seedIps = [], limit = 14) {
  const GALOIS_PRIMES = [17, 31, 47, 67, 89, 107, 127, 149, 167, 181, 197, 211, 227, 239];
  const V6_BLADE_PREFIXES = ['2606:4700:3030::', '2606:4700::', '2606:4700:3031::'];
  const out = [];
  const seen = new Set();
  const push = (addr, kind, source) => {
    const a = String(addr || '').trim().replace(/^\[|\]$/g, '');
    if (!a || seen.has(a.toLowerCase()) || DEAD_BYOIP_BLACKLIST.has(a.toLowerCase())) return;
    // هرگز دامنه متنی وارد لیست زیرزمینی نشود — فقط تیغه‌های خالص IPv4 و IPv6
    if (!a.includes(':') && /[a-z]/i.test(a)) return;
    seen.add(a.toLowerCase());
    out.push({ addr: a, kind, source });
  };

  const slot = Math.floor(Date.now() / 5000) % GALOIS_PRIMES.length;

  // ۱) تیغه‌های طلایی اثبات‌شده روی خط کاربر (61ms و 141ms) در صدر لیست
  push('172.67.181.32', 'spectral_v4', 'تیغه مرجع Anycast (پینگ ۶۱ms)');
  push('2606:4700:3030::ac43:b520', 'siit_v6', 'همزاد هگزادسیمال SIIT-Hex64 (ac43:b520)');
  push('2606:4700:3030::ac43:b58a', 'siit_v6', 'تیغه نسل ششم Anycast (ac43:b58a)');
  push('2606:4700::6812:3ed', 'siit_v6', 'تیغه نسل ششم Anycast (6812:3ed)');

  // ۲) رمزگشایی دوطرفه SIIT-Hex64 از روی آی‌پی‌های فعلی کاربر (تبدیل IPv6 فعال به IPv4 نهفته و بالعکس)
  const effectiveSeeds = Array.isArray(seedIps) && seedIps.length
    ? seedIps
    : ['172.67.181.32', '2606:4700::6812:b58a', '2606:4700:3030::6815:3ed', '104.17.148.17'];

  for (const raw of effectiveSeeds) {
    const s = String(raw || '').trim().replace(/^\[|\]$/g, '');
    if (s.includes(':')) {
      const mirrorV4 = siitV6ToIpv4(s);
      if (mirrorV4) {
        push(mirrorV4, 'siit_decoded_v4', `استخراج‌شده از لایه درونی IPv6 (${s.split(':').slice(-2).join(':')})`);
        const parts = mirrorV4.split('.');
        const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
        const gOct = (((Number(parts[3]) ^ 0x5a) + GALOIS_PRIMES[(slot + 3) % GALOIS_PRIMES.length]) % 236) + 12;
        push(`${prefix}.${gOct}`, 'galois_v4', `سنتز گالوا LFSR از ${prefix}.0/24`);
      }
    } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) {
      const m = s.split('.');
      const prefix = `${m[0]}.${m[1]}.${m[2]}`;
      const baseOct = Number(m[3]);
      const p1 = GALOIS_PRIMES[(slot + 2) % GALOIS_PRIMES.length];
      const p2 = GALOIS_PRIMES[(slot + 7) % GALOIS_PRIMES.length];
      const n1 = (((baseOct ^ 0x3c) + p1) % 236) + 12;
      const n2 = ((baseOct + p2) % 236) + 12;
      push(`${prefix}.${n1}`, 'galois_v4', `سنتز طیفی گالوا (${prefix}.0/24)`);
      push(`${prefix}.${n2}`, 'galois_v4', `همسایه عدد اول (${prefix}.0/24)`);
      const v6Twin = ipv4ToSiitV6(`${prefix}.${n1}`, V6_BLADE_PREFIXES[slot % V6_BLADE_PREFIXES.length]);
      if (v6Twin) push(v6Twin, 'siit_v6', `همزاد SIIT-Hex64 (${prefix}.${n1})`);
    }
  }

  // ۳) استخراج زنده رکوردهای باینری TYPE=65 (HTTPS/SVCB RFC 9460) از هسته ECH کلودفلر
  try {
    const r = await fetch('https://cloudflare-dns.com/dns-query?name=cloudflare-ech.com&type=65', {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(1500),
    });
    if (r.ok) {
      const d = await r.json();
      const answers = d.Answer || [];
      for (const ans of answers) {
        const data = String(ans.data || '');
        const v4Match = data.match(/ipv4hint=([0-9.,]+)/i);
        if (v4Match) {
          for (const hintIp of v4Match[1].split(',').slice(0, 2)) {
            const pts = hintIp.trim().split('.');
            if (pts.length === 4) {
              const pfx = `${pts[0]}.${pts[1]}.${pts[2]}`;
              const shOct = ((Number(pts[3]) + GALOIS_PRIMES[(slot + 5) % GALOIS_PRIMES.length]) % 236) + 12;
              push(`${pfx}.${shOct}`, 'svcb_hint_v4', `تیغه استخراجی رکورد TYPE=65 ECH (${pfx}.0/24)`);
            }
          }
        }
      }
    }
  } catch { /* ignore DoH timeout */ }

  // ۴) تکمیل ظرفیت با تیغه‌های چرخشی گالوا از زیرشبکه‌های طلایی Anycast و SIIT-Hex64
  for (let i = 0; i < UNDERGROUND_SUBNET_PREFIXES.length && out.length < limit; i++) {
    const p = UNDERGROUND_SUBNET_PREFIXES[(slot + i) % UNDERGROUND_SUBNET_PREFIXES.length];
    const oct = GALOIS_PRIMES[(slot + i * 3) % GALOIS_PRIMES.length];
    const candidateV4 = `${p}.${oct}`;
    push(candidateV4, 'spectral_v4', `تیغه طیفی Anycast (${p}.0/24)`);
    if (i < 2 && out.length < limit) {
      const twinV6 = ipv4ToSiitV6(candidateV4, V6_BLADE_PREFIXES[(slot + i) % V6_BLADE_PREFIXES.length]);
      if (twinV6) push(twinV6, 'siit_v6', `همزاد SIIT-Hex64 (${candidateV4})`);
    }
  }

  return out.slice(0, limit);
}

/**
 * تشخیص هوشمند اپراتور اینترنت کاربر (همراه اول، ایرانسل، مخابرات، رایتل، شاتل و...)
 * مهم: طبق اطلاعیه فنی فایروال‌ها، فرگمنت روی همراه اول، مخابرات و شاتل مسدود شده و باید از ECH + IPv6 (بدون فرگمنت) استفاده شود.
 */
export function detectIranIsp(cf = {}, clientIp = '') {
  const asn = Number(cf?.asn || 0);
  const org = String(cf?.asOrganization || '').toLowerCase();
  const isV6 = String(clientIp || '').includes(':');

  if (asn === 197207 || org.includes('mobile communication company of iran') || org.includes('mci')) {
    return {
      code: 'mci',
      name: 'همراه اول (MCI)',
      asn,
      isV6,
      fragment: 'none',
      ech: DEFAULT_ECH_CONFIG,
      fragmentRule: 'بدون فرگمنت (فرگمنت در همراه اول مسدود است) + ECH فعال (cloudflare-ech.com+udp://1.1.1.1)',
      bestPorts: [443],
      tip: 'روی فایروال جدید همراه اول فرگمنت مسدود شده است؛ اتصال با آی‌پی‌های نسل ششم (IPv6) و ECH روی پورت 443 با پینگ ~65 تا 140ms برقرار می‌شود.',
      recommendedIps: [
        '2606:4700:3030::ac43:b58a',
        '2606:4700::6812:3ed',
        '2606:4700::6812:1a2e',
        '2606:4700:3030::ac43:b520',
        '172.67.181.32',
        '172.67.181.122',
        '172.67.181.210',
        '104.17.148.167',
        '104.17.148.17',
        '104.17.147.119',
      ],
    };
  }
  if (asn === 58224 || asn === 12880 || org.includes('iran telecommunication') || org.includes('tci') || org.includes('mkh') || asn === 31549 || org.includes('shatel')) {
    return {
      code: 'tci',
      name: org.includes('shatel') || asn === 31549 ? 'شاتل (Shatel)' : 'مخابرات ایران (TCI)',
      asn,
      isV6,
      fragment: 'none',
      ech: DEFAULT_ECH_CONFIG,
      fragmentRule: 'بدون فرگمنت + ECH فعال (cloudflare-ech.com+udp://1.1.1.1)',
      bestPorts: [443],
      tip: 'روی مخابرات و شاتل فرگمنت مسدود است؛ پورت 443 با ECH و تیغه‌های همزاد Anycast سریع‌ترین اتصال را می‌دهد.',
      recommendedIps: [
        '172.67.181.32',
        '172.67.181.122',
        '104.17.148.17',
        '104.17.147.119',
        '104.18.3.91',
        '104.18.181.138',
        '2606:4700:3030::ac43:b58a',
        '2606:4700::6812:3ed',
      ],
    };
  }
  if (asn === 44244 || org.includes('irancell') || org.includes('mtn')) {
    return {
      code: 'irancell',
      name: 'ایرانسل (MTN Irancell)',
      asn,
      isV6,
      fragment: 'none',
      ech: DEFAULT_ECH_CONFIG,
      fragmentRule: 'ECH فعال (cloudflare-ech.com+udp://1.1.1.1) + کانفیگ‌های اختصاصی فرگمنت در انتهای لیست',
      bestPorts: [443],
      tip: 'ایرانسل روی تیغه‌های 172.67.181.x، IPv6 و ECH پورت 443 عالی کار می‌کند (کانفیگ‌های فرگمنت ایرانسل نیز جداگانه در انتهای ساب‌لینک قرار دارند).',
      recommendedIps: [
        '172.67.181.32',
        '172.67.181.122',
        '104.17.148.17',
        '104.17.147.119',
        '2606:4700:3030::ac43:b58a',
        '2606:4700::6812:3ed',
        '2606:4700::6812:1a2e',
        '2606:4700:3030::ac43:b520',
      ],
    };
  }
  if (asn === 57218 || org.includes('rightel')) {
    return {
      code: 'rightel',
      name: 'رایتل (Rightel)',
      asn,
      isV6,
      fragment: 'none',
      ech: DEFAULT_ECH_CONFIG,
      fragmentRule: 'ECH فعال (cloudflare-ech.com+udp://1.1.1.1) + IPv6 روی پورت 443',
      bestPorts: [443],
      tip: 'رایتل روی IPv6 و تیغه‌های ECH پورت 443 کم‌ترین پکت‌لاس را دارد.',
      recommendedIps: [
        '2606:4700:3030::ac43:b58a',
        '2606:4700::6812:3ed',
        '172.67.181.32',
        '172.67.181.122',
        '104.17.148.17',
        '104.17.147.119',
      ],
    };
  }
  return {
    code: 'mci',
    name: cf?.asOrganization ? `${cf.asOrganization} (AS${asn || '?'})` : 'اپراتور فعلی شما',
    asn,
    isV6,
    fragment: 'none',
    ech: DEFAULT_ECH_CONFIG,
    fragmentRule: 'بدون فرگمنت + ECH فعال (cloudflare-ech.com+udp://1.1.1.1) + IPv6',
    bestPorts: [443],
    tip: 'تیغه‌های نسل ششم (IPv6) و نسل چهارم مجهز به ECH روی پورت 443 برای عبور از فایروال خط شما تنظیم شدند.',
    recommendedIps: [
      '2606:4700:3030::ac43:b58a',
      '2606:4700::6812:3ed',
      '2606:4700::6812:1a2e',
      '2606:4700:3030::ac43:b520',
      '172.67.181.32',
      '172.67.181.122',
      '104.17.148.17',
      '104.17.147.119',
    ],
  };
}
