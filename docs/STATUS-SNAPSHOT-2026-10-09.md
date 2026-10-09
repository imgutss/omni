# 📌 وضعیت پروژه Omni — نگه‌داشته شد (۲۰۲۶-۱۰-۰۹)

> این فایل وضعیت «پنل + ربات» را **قبل از تغییرات جدید** ثبت می‌کند تا هر وقت چت پاک شد،
> 📎 تغییرات انجام‌شده در همین تاریخ: `docs/BRIDGE-CHANGES-2026-10-09.md`
> همه‌چیز قابل بازیابی باشد. منبع: مخزن `github.com/Alisarani7021/omni` (private) + تست زندهٔ APIها.

---

## ۱) هویت پروژه

| مورد | مقدار |
|---|---|
| مخزن | `Alisarani7021/omni` — خصوصی |
| توضیح | ⚡ Omni — پنل VLESS/Trojan روی Cloudflare Workers با مدیریت تلگرام |
| آخرین کامیت | `4cfa8f8` — embed anti-DPI TLS fragment across all subscriber configs, fix SenPai ping, persist new user activation in D1, remove 12m token expiry notice |
| ربات تلگرام | `@OmniAiGateBot` (id `8792…5421`) — ✅ زنده و پاسخ‌گو (`getMe` ok) |
| نام ورکرها | `omni` (اصلی) و `omni-ali` (نصب‌شدهٔ فرزند) |
| D1 | `omni-db` → `9660e603-a4e9-4b2c-8071-788e2539e618` |
| KV | `RELEASES` → `f7ac482df0f04daf96378b6b55224dc9` |
| کرون | `*/5 * * * *` |
| نسخهٔ انتشار | `classic-restore-2026-10-06.3` |
| مسیر امن (path) | `/VZLdh9Ft` |

## ۲) منبع حقیقت کد (خیلی مهم)

- `production/worker.js` ← **تنها فایل قابل دیپلوی** (۹٬۴۲۹ خط، ۱٫۰۶ MB، self-contained).
- `production/panel.html` ← فرانت‌اند قابل ویرایش (۱۳٬۱۲۷ خط) که با `node production/build.mjs`
  به‌صورت یک literal داخل `production/worker.js` جاسازی می‌شود و همزمان `deploy/omni-worker.bundle.js` را به‌روز می‌کند.
- `src/` ← **آرشیو قدیمی است**؛ نباید روی نصب‌های زنده دیپلوی شود (طبق `production/README.md`).
- SHA256 نسخهٔ فعال: main `5612f774…` / panel `854df099…` — ali `b6f33771…` / `076f8c07…`

## ۳) بخش‌های پنل (views)

`dashboard · users · configs · scanner · dns · mesh · national_net (+bridge/spoofer/relays) · diag · logs · sessions · settings`

روت‌های بک‌اند موجود (۴۳ عدد):
`/api/whoami · setup · login · logout · recover · signup · password · settings · users · users/ · users/bulk ·
overview · stats/usage · sessions · sessions/revoke · backup · report-ip · fragments · countries ·
bot/status · bot/notify · bot/pair-code · mesh/ · mesh/apply · mesh/history · mesh/monitor · mesh/race ·
mesh/service-proof · diag/dns · diag/logs · diag/maintenance · diag/net-sense · diag/ping · diag/probe-node ·
diag/probe-public · diag/rank-ips · diag/reach · diag/rotate-ips · diag/scan-countries · diag/speed ·
diag/tcp · diag/underground-hunt · diag/ws-ping`

## ۴) وضعیت «نت ملی / Vercel & Netlify» قبل از این تغییر

کد در `production/panel.html` خط‌های ~۱۰۱۲۰ تا ~۱۱۱۰۰:

- `NATNET` state: `tab, bridgePlatform(vercel|netlify), vercelMode(rewrite|relay), netlifyMode(rewrite|edge), user, bridgeDomain, vercelDomain, spoofer*, relayIp`
- `NATNET_DATA`: دامنه‌های ورسل (`react.dev, nextjs.org, cursor.com, ai.vercel.com, …`)،
  آی‌پی‌های ورسل (`76.76.21.21 …`)، آی‌پی‌های نتلیفای (`104.198.14.52, 75.2.60.5, 99.83.231.61, 75.2.70.75`)،
  fastly، communitySpoofHosts، DNSTT، emergencyDns/Proxies.
- ژنراتورها: `natnetVercelRewriteJson()`، `natnetVercelRelayJs()`، `natnetNetlifyRewriteToml()`،
  `natnetNetlifyEdgeFunction()`، `natnetSpooferJson()`، `natnetBuildBalancerJson()`، `natnetCreateZip()` (زیپ دستی با CRC32).
- **مشکل اصلی:** کل این بخش فقط **zip/کد** می‌دهد → کاربر باید خودش برود `vercel.com/new` یا
  `app.netlify.com/drop` و دستی آپلود کند. یعنی هیچ مسیر خودکاری با توکن وجود نداشت.
- در بک‌اند (`production/worker.js`) **صفر** روت یا تابع مربوط به vercel/netlify وجود داشت
  (grep: `vercel` = 0 در بخش غیر panel، `netlify` = 0).

## ۵) الگوی موجودِ «توکن بده، خودش بساز» (کلودفلر) — که باید کپی می‌شد

- `src/installer.js` (باندل‌شده در worker از خط ۱۶۹۳):
  `deployOmniToAccount({token, requestedAccountId, workerName, bundle, onProgress})`
  → verify توکن (`/user/tokens/verify`) → ساخت D1 → آپلود worker.js با FormData/metadata →
  فعال‌سازی subdomain → کرون → ساخت panelUrl/dashboardUrl → در صورت خطا rollback (حذف worker و D1).
- جریان ربات: `/deploy` → انتخاب نام تصادفی (`pick:<name>`) → `setUiState` → کاربر توکن را می‌فرستد →
  اعتبارسنجی `^[A-Za-z0-9_\-]{20,300}$` → `deleteMessage` (پاک کردن توکن از چت) →
  `takeDeploySession` → `setCachedToken` → `acquireDeployLock` → پیام پیشرفت مرحله‌به‌مرحله →
  `saveOwnedPanel` → `auditDeploy` → پیشنهاد ساخت رمز.
- جدول‌های D1 ربات: `bot_deploy_sessions`, `bot_deploy_audit`, `bot_deploy_locks`, `bot_ui_sessions`,
  `bot_tok_cache`, `bot_panels`, `bot_bridge` (بخش اهدای کانفیگ).
- محدودیت‌ها: فقط چت خصوصی، سقف ۵ نصب در ۲۴ ساعت، لاکن ۱۵ دقیقه‌ای، نشست ۱۰ دقیقه‌ای.
- ⚠️ نکته: `/bridge` فعلی = **اهدا/دریافت کانفیگ عمومی** است، ربطی به پل Vercel/Netlify ندارد.

## ۶) نتیجهٔ تست زندهٔ توکن‌هایی که دادی (۲۰۲۶-۱۰-۰۹)

| سرویس | نتیجه |
|---|---|
| GitHub `ghp_…C3EFuwC` | ✅ معتبر — کاربر `Alisarani7021` (Guts)، ۱۶ ریپازیتوری دیده شد |
| Telegram `8792…5421` | ✅ معتبر — `@OmniAiGateBot` |
| Vercel `cfut_g••••a624` | ❌ `403 forbidden / invalidToken:true` — توکن باطل یا منقضی یا Team-scoped اشتباه |
| Netlify | ❌ توکنی ارسال نشد (فقط دامنهٔ `unique-begonia-46df26.netlify.app` در کد بود) |

⚠️ توکن ورسل باید از این مسیر ساخته شود: `vercel.com/account/tokens` → scope = **Full Account** →
Expiration = No Expiration (یا طولانی). اگر اکانت تیمی است، یا `teamId` لازم است یا توکن باید team-scoped باشد.
توکن نتلیفای: `app.netlify.com/user/applications#personal-access-tokens`.

> 🔒 توصیهٔ امنیتی: این سه توکن در چت明文 فرستاده شدند. بعد از اتمام کار، توکن GitHub و
> توکن ربات را **rotate** کن (توکن ورسل که خودش باطل است).

## ۷) دسترسی شبکه از این محیط

- `api.github.com`, `api.telegram.org`, `api.vercel.com`, `api.netlify.com` → ✅ در دسترس
- `*.workers.dev` → ❌ DNS در سندباکس resolve نمی‌شود؛ پس تست زندهٔ ورکر از اینجا ممکن نبود.

## ۸) کارهایی که در همین نشست انجام شد

1. بک‌اند جدید `src/bridges.js` → نصب خودکار روی Vercel و Netlify فقط با توکن (مثل کلودفلر).
2. روت‌های جدید `/api/bridge*` در `production/worker.js` (async + polling، بدون timeout).
3. جریان جدید ربات: `/natbridge` (و `/vercel`, `/netlify`) → انتخاب پلتفرم → انتخاب نام →
   فرستادن توکن → ساخت خودکار پروژه و دیپلوی → تحویل دامنه + کانفیگ VLESS آماده.
4. بخش «نت ملی» پنل: حالت سوم **«خودکار با توکن»** به‌عنوان پیش‌فرض + کارت دیپلوی + لیست پل‌های ساخته‌شده.
5. تست‌های واحد آفلاین (payload/zip/sha1/name) + build + commit + push به GitHub.

جزئیات فنی کامل در `omni-status/CHANGES-2026-10-09.md`.
