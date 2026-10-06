> **بازگردانی نسخهٔ قبلی — ۶ اکتبر ۲۰۲۶:** رابط کامل اسکنر و کانفیگ‌ساز قدیمی با اصلاح عملکرد دکمه‌ها، پورت‌ها و خروجی‌ها برگشت. منبع انتشار `production/worker.js` است؛ `src/` آرشیو قدیمی است و نباید جای نسخهٔ زنده منتشر شود. [راهنمای ساخت و آزمون](production/README.md).


<div align="center">

# ⚡ Omni

**پنل مدیریت پروکسی VLESS + Trojan روی Cloudflare Workers — کامل رایگان، بدون سرور**

پنل وب + ربات تلگرام + اسکنر آی‌پی تمیز + کنترل حجم و دستگاه — همه روی یک Cloudflare Worker

</div>

---

## ✨ چه چیزهایی دارد؟

| | |
|---|---|
| 🚀 **بدون سرور** | کاملاً روی Cloudflare Worker و D1 اجرا می‌شود؛ نه VPS لازم است نه Node.js |
| 🌐 **VLESS + Trojan** | هر دو پروتکل روی WebSocket (TLS خود کلودفلر) — مقاوم به فیلترینگ |
| 🎯 **آی‌پی تمیز خودکار** | اسکنر داخلی بهترین آی‌پی‌های کلودفلر را پیدا می‌کند و در ساب‌لینک همه‌ی کاربران می‌گذارد |
| 🤖 **مدیریت از تلگرام** | ساخت/حذف/تمدید کاربر، ساب‌لینک، آمار، اسکن آی‌پی، اعلان‌های خودکار |
| 📊 **کنترل کامل مصرف** | حجم، تاریخ انقضا، سقف دستگاه، سقف درخواست، حالت «فعال‌سازی در اولین اتصال» |
| 🧩 **ساب‌لینک چندفرمتی** | خروجی base64 (v2ray/xray) + Clash + sing-box + لینک خام، با فرگمنت و اثر انگشت (uTLS) |
| 🔒 **امنیت** | ورود با PBKDF2-SHA256، نشست کوکی HttpOnly، CSRF، کد بازیابی یک‌بارمصرف |
| 🕵️ **صفحه‌ی پوششی (Decoy)** | درخواست‌های نامعتبر، یک سایت معمولی می‌بینند |
| 💾 **پشتیبان‌گیری** | دانلود/بازیابی JSON کامل کاربران و تنظیمات |
| 📱 **پنل کاربر** | صفحه‌ی وضعیت `/status/<token>` با مصرف باقی‌مانده، انقضا و QR |

---

## 🧱 پیش‌نیازها

- یک حساب **Cloudflare** (رایگان) + یک توکن API با دسترسی‌های:
  `Account → D1: Edit` و `Account → Workers Scripts: Edit` (و `Zone` در صورت دامنه اختصاصی)
- یک ربات **Telegram** از [@BotFather](https://t.me/BotFather)
- Node.js 18+ برای دیپلوی

---

## 🚀 نصب سریع (خودکار)

```bash
git clone https://github.com/Alisarani7021/omni.git && cd omni
npm install

# توکن‌ها را در یک فایل .env بگذار:
cat > ../cfpanel/.env <<'EOF'
CF_API_TOKEN=توکن_کلودفلر
BOT_TOKEN=توکن_ربات_تلگرام
ADMIN_CHAT_ID=آیدی_عددی_خودت
EOF

npm run deploy:auto      # ساخت D1 + دیپلوی + تنظیم رمزها + وب‌هوک ربات
```

خروجی، آدرس ورکر را چاپ می‌کند؛ پنل را باز کن، نام کاربری و رمز مدیر را بساز — تمام.

### نصب دستی

```bash
npx wrangler d1 create omni-db         # database_id را در wrangler.toml بگذار
npx wrangler deploy
npx wrangler secret put BOT_TOKEN      # توکن ربات
npx wrangler secret put ADMIN_CHAT_ID  # آیدی عددی مدیر (از @userinfobot)
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<worker>/tg/omni-hook"
```

---

## 🤖 دستورات ربات

| دستور | کار |
|---|---|
| `/start` `/help` | راهنما |
| `/list` | لیست کاربران + مصرف و روز باقی‌مانده |
| `/new ali 50 30` | ساخت کاربر (نام، گیگ، روز) |
| `/link ali` | ساب‌لینک + کانفیگ + دکمه‌های دانلود |
| `/reset ali` | ریست حجم |
| `/extend ali 30` | تمدید ۳۰ روز |
| `/toggle ali` | فعال/غیرفعال |
| `/del ali` | حذف |
| `/note ali متن` | یادداشت |
| `/stats` | آمار کلی پنل |
| `/scan` | اسکن و ذخیره‌ی آی‌پی‌های تمیز (روی همه‌ی ساب‌لینک‌ها اعمال می‌شود) |
| `/ips` | لیست آی‌پی‌های تمیز |
| `/ping [host]` | سلامت سرویس |
| `/panel` | لینک پنل |

اعلان‌های خودکار: رسیدن به ۸۰٪ حجم، اتمام حجم، و کمتر از ۲ روز مانده به انقضا.

---

## 🌐 API (همان چیزی که فرانت‌اند پنل استفاده می‌کند)

```
GET    /api/whoami                     → {username,role,installed,panelName,signup}
POST   /api/setup | /api/login | /api/logout | /api/password
GET    /api/overview?days=7
GET    /api/users?q&status&sort&dir&page&size      POST /api/users
GET    /api/users/:u    PATCH /api/users/:u    DELETE /api/users/:u
POST   /api/users/:u/reset | /rotate-token | /rotate-uuid
POST   /api/users/bulk   {usernames,op,value}
GET    /api/stats/usage?username&days
GET|PUT /api/settings            GET /api/fragments
POST   /api/diag/probe-node | /rank-ips    GET /api/diag/ping?target=&logs?limit=
POST   /api/diag/maintenance     GET|POST /api/backup
GET    /api/sessions             POST /api/sessions/revoke
POST   /api/signup | /api/recover
GET    /s/<sub_token>?type=clash|singbox|base64|raw     (ساب‌لینک)
GET    /status/<sub_token>                              (صفحه‌ی وضعیت کاربر)
```

همه‌ی درخواست‌های غیر GET هدر `x-kaveh-csrf: 1` را می‌فرستند؛ خطاها `{ok:false,code,error}` هستند.

---

## 🗂 ساختار

```
src/worker.js     روتر: /api, /panel, /s/, /status/, WebSocket پروکسی, /tg (وب‌هوک ربات)
src/api.js        پیاده‌سازی کامل API پنل
src/auth.js       احراز هویت، نشست، تنظیمات، اسکیما و بوت‌استرپ D1
src/core.js       موتور پروکسی VLESS/Trojan روی WebSocket + حسابداری مصرف
src/links.js      ساخت لینک‌ها، ساب‌لینک (base64/clash/sing-box)، صفحه‌ی وضعیت
src/scan.js       اسکنر TCP آی‌پی‌های کلودفلر و رتبه‌بندی
src/bot.js        ربات تلگرام (وب‌هوک + پولینگ با کرون)
src/panel.html    پنل وب (طراحی کامل، تک‌فایل)
test/             تست E2E (۷۳ بررسی + تونل واقعی WS)
deploy/           اسکریپت دیپلوی و ساخت مخزن گیت‌هاب
```

## 🧪 تست

```bash
npm test          # راه‌اندازی wrangler محلی + اجرای E2E (پنل، ساب‌لینک، تونل VLESS/Trojan)
```

## 🎯 آی‌پی تمیز و کم‌پینگ (مهم)

Cloudflare اجازه نمی‌دهد یک Worker با `connect()` به آی‌پی‌های خودش (مثل `104.16.0.0`) وصل شود؛
پس «تست آی‌پی» از داخل ورکر برای این آی‌پی‌ها ممکن نیست. Omni این را دو لایه حل می‌کند:

1. **تست روی دستگاه کاربر** — در صفحه‌ی `/status/<token>` دکمه‌ی «تست آی‌پی‌ها روی دستگاه من» وجود دارد؛
   آی‌پی‌ها از مرورگر خودِ کاربر (همان شبکه‌ای که فیلتر می‌شود) تست و نتیجه در D1 ذخیره می‌شود.
   یعنی رتبه‌بندی بر اساس شبکه‌ی واقعی کاربران ایران، نه دیتاسنتر کلودفلر.
2. **ادغام با پروب لبه** — `/api/diag/rank-ips` هر دو منبع را قاطی می‌کند: اندازه‌گیری کاربران (وزن بالا)
   + پروب `fetch` از لبه. نتیجه‌ی برتر به‌صورت خودکار در `clean_ips` ذخیره و در **همه‌ی ساب‌لینک‌ها** استفاده می‌شود.

⚠️ یک محدودیت ذاتی پروکسی روی Worker: مقصدهایی که خودشان پشت Cloudflare هستند
(مثل `example.com` یا `cloudflare.com`) از `connect()` قابل دسترسی نیستند و از تونل رد نمی‌شوند.
این محدودیت مربوط به خود Cloudflare است و همه‌ی پنل‌های Worker-based همین رفتار را دارند.

## 📝 نکته‌ها

- Free tier کلودفلر: ۱۰۰٬۰۰۰ درخواست در روز، D1 با ۵ میلیون خواندن/روز — برای صدها کاربر کافی است.
- کرون هر ۵ دقیقه: پولینگ ربات (اگر وب‌هوک نباشد)، هشدارهای مصرف/انقضا، چرخش خودکار توکن، نظافت لاگ‌ها.
- برای دامنه اختصاصی: در تنظیمات پنل `public_host` را به دامنه‌ات تغییر بده و دامنه را در Workers به ورکر وصل کن.
