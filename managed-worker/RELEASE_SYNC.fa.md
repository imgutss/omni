# یادداشت عملیاتی: همگام‌سازی بایگانی RELEASES پس از هر استقرار ورکر

## قانون الزامی
هر بار که کد/پنل ورکر `omni` تغییر و مستقر می‌شود، چون `panel_default` داخل باندل
تغییر می‌کند، باید کلید KV زیر هم با باندل جدید بازنویسی شود وگرنه جریان «استقرار
سریع» (Omni Launchpad) با این خطا متوقف می‌شود:

> بایگانی RELEASES با نسخه فعلی همگام نیست. همگام‌سازی انتشار ناموفق بود؛ توکن شما ذخیره نشد.

## چرا
تابع `getReleaseBundle(env, "current")` (worker.js ~L4351):
1. کلید `releases/current` را از namespace اتصال `RELEASES` می‌خواند.
2. شرط‌ها: اندازه ≥ ۱۰۰٬۰۰۰ کاراکتر، شامل `cloudflare:sockets`، و مهم‌تر:
   `extractJsStringAssignment(bundle, "panel_default") === panel_defaultِ` ورکر زنده.
3. نابرابری پنل → پرتاب همان خطای بالا. همهٔ مسیرهای استقرار/بازسازی/آپگرید نودها
   (لانچ‌پد، دکتر، mirror، dbrollback، auto-upgrade) به همین کلید وابسته‌اند.

## مقادیر ثابت محیط
- Account: `9a3aabde4bdecbff1e298100985c7e7e`
- Namespace RELEASES: `f7ac482df0f04daf96378b6b55224dc9`
- کلید: `releases/current` (آدرس URL-encoded: `releases%2Fcurrent`)
- مقدار = دقیقاً محتوای ماژول ورکر مستقرشده (همان `build/worker.js`، byte-identical)
- کلیدهای دیگر (`releases/current.js`, `manifest.json`, `latest.json`, نسخه‌های
  تاریخ‌دار) توسط کد ورکر خوانده نمی‌شوند؛ فقط `releases/current` بحرانی است.

## دستور انتشار (پس از build و deploy)
```bash
NS=f7ac482df0f04daf96378b6b55224dc9
ACCT=9a3aabde4bdecbff1e298100985c7e7e
TOK=<cf token>
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/$ACCT/storage/kv/namespaces/$NS/values/releases%2Fcurrent" \
  -H "Authorization: Bearer $TOK" -H "content-type: application/octet-stream" \
  --data-binary @build/worker.js
```
انتشار در edge معمولاً ظرف ۸–۶۰ ثانیه فراگیر می‌شود. با خواندن مجدد کلید و
مقایسهٔ بایت‌به‌بایت با `build/worker.js` تأیید شود.

## رخداد ۲۰۲۶-۱۰-۲۲
بازسازی bothost پنل را به md5 `630f109339b55972b1e705cefac9d23f` (v53.0, rev71)
تغییر داد ولی KV هنوز باندل قدیمی (پنل `ce2e110177`) را داشت → لانچ‌پد خطا می‌داد.
باندل زنده (۲٬۸۳۴٬۸۸۴ بایت، byte-identical با اسکریپت مستقر) در KV منتشر و
از داخل یک ورکر موقت با اتصال RELEASES تأیید شد: `getReleaseBundleWouldPass=true`.
ورکر موقت بلافاصله حذف شد؛ در حساب فقط اسکریپت `omni` باقی مانده است.

## نکته سکویی
از داخل یک ورکر کلودفلر، fetch مستقیم به دامنهٔ `*.workers.dev` (حتی همان ورکر)
با خطای ۱۰۴۲/۴۰۴ لبه روبه‌رو می‌شود؛ تست‌های درون-ورکری باید با ثابت‌ها یا مسیر
غیر workers.dev انجام شوند.

## رخداد ۲۰۲۶-۱۰-۲۳ (rev74 / v53.1)
بازنویسی `mbConfigs` (ماتریس ۴۰ کانفیگی + `mbResolveAll4`) بدون تغییر پنل؛
باندل مستقر و کلید `releases/current` هر دو md5
`3b657e9c976e8c8371e8ea549c505a2b` (۲٬۸۵۱٬۸۸۸ بایت). روال همان بالا:
`deploy.py` سپس PUT روی کلید و مقایسهٔ بایت‌به‌بایت.

## رخداد ۲۰۲۶-۱۰-۲۳ (rev75 / v53.2)
بازطراحی `mbConfigs` با استخر دامنه‌های ایرانی (`MB_IRANIAN_FRONTS`؛ آدرس ایرانی،
SNI خودمان). باندل مستقر و `releases/current` هر دو md5
`f96eff2c63736e521d38436d9d10179c` (۲٬۸۵۲٬۱۶۱ بایت). smoke 27/27.
نکتهٔ سکویی: پوشهٔ `build/` در اسنپ‌شات ورک‌اسپیس نگه داشته نمی‌شود؛ در صورت نبود،
از `live/worker.js` (باندل آخرین استقرار) بازسازی شود سپس وصله/استقرار انجام گیرد.

## استقرار ۲۰۲۶-۱۰-۲۳ (rev76 / v53.3)
یکپارچه‌سازی اختیاری Vercel WebSocket bridge در خود پنل Omni، بدون تغییر relay/data-plane زنده؛
ساخت پل Vercel از پنل به Bot-Hosting با مسیر خصوصی `ws_path`، تولید یک خط کانفیگ
VLESS اضافه (۴۰ خط اصلی + یک خط Vercel)، پینگ ۴نمونه‌ای مرورگر، پاک‌سازی پروژه و
migrations کنترل‌شدهٔ D1. smoke: 45/45؛ `node --check` روی bundle/source موفق.
باندل مستقر و `RELEASES`/`releases/current` هر دو byte-identical، md5
`6df97a927dfdcdf1de0c7660f4a787b3` (۲٬۸۸۶٬۲۰۸ بایت). Vercel Hobby می‌تواند
اتصال WebSocket را در سقف ۳۰۰ ثانیه ببندد؛ استمرار اتصال تضمین نمی‌شود.

## استقرار ۲۰۲۶-۱۰-۲۳ (rev77 / v53.4) — Worker اصلی

- بخش مستقل شمارهٔ ۶ برای Vercel در UI رله‌ها اضافه شد؛ API مستقل با مسیر پایهٔ
  `/api/vercel-relays` و جدول جداگانهٔ `vercel_relays`. بخش Bot-Hosting/Arvan و
  ۴۰ کانفیگ اصلی جدا و بدون تغییر باقی ماندند.
- Worker اصلی `omni` با شناسهٔ استقرار `ca885631eac04b429ce190700f685d1b`
  منتشر شد. `GET /api/version` با cache-buster نسخهٔ v53.4/rev77 را برگرداند.
- باندل اصلی: ۲٬۸۹۸٬۴۶۵ بایت، md5
  `b201f9be97877ecda6db0785bc575db4`؛ مقدار `RELEASES/releases/current` پس از PUT
  بایت‌به‌بایت با آن تطبیق داده شد.
- binding محرمانهٔ `BOT_TOKEN` در Worker اصلی با `keep_bindings` حفظ شد؛ مقدارش
  نه خوانده شد و نه در فایل ذخیره شد.
- اعتبارسنجی: smoke **48/48**، `node --check`، و بازسازی از `live/worker.js`
  بایت‌به‌بایت برابر با باندل مستقر.
- Worker پنل کاربر `omni-cloud-5649.alis-1eef.workers.dev` هنوز v53.3/rev76 است.
  توکن ارائه‌شده فقط به حساب Worker اصلی دسترسی داشت و اسکریپت فرزند در آن حساب
  وجود نداشت؛ برای این Worker استقرار انجام نشد. رله/data-plane تولیدی تغییر نکرد.

## آمادهٔ محلی، هنوز منتشر نشده — v53.5/rev78 (۲۰۲۶-۱۰-۲۳)

- اصلاح جریان Vercel برای پنل‌های فورک‌شده: کاربر کلید Bot-Hosting و توکن Vercel
  خودش را وارد می‌کند؛ دکمهٔ بررسی هر دو توکن را اعتبارسنجی و deploymentهای همان
  حساب را پیدا می‌کند. مبدأ از رکورد آمادهٔ بخش دیگر از پیش انتخاب نمی‌شود.
- مسیر WS از snapshot محلی همان deployment یا فایل entry در Bot-Hosting با scope
  `files:read` تشخیص داده می‌شود. هنگام ساخت، کلید Bot-Hosting دوباره بررسی می‌شود؛
  هیچ‌یک از دو کلید در D1 ذخیره نمی‌شوند و deployment مبدأ تغییر نمی‌کند.
- دکمهٔ تلگرام «ارتقا به آخرین نسخه» اکنون `upgradeOwnedPanel` را روی همان
  `account_id/worker_name` اجرا می‌کند. مسیر ارتقا فقط `PUT` درجا دارد و دیگر
  Worker را برای health-check ناموفقِ `workers.dev` حذف و دوباره ایجاد نمی‌کند.
  bindingهای D1 (حتی وقتی Cloudflare آن را با `database_id` برمی‌گرداند)، منابع
  غیرمحرمانهٔ دیگر و secret bindingهای موجود حفظ می‌شوند؛ پیام موفقیت نیز صریحاً
  می‌گوید پنل جدیدی ساخته نشده است. بازسازی صریح 1101 مسیر جداگانه‌اش را نگه می‌دارد.
  رسید انتشار `v/rev/md5` در D1 هم از PUT دوباره جلوگیری می‌کند اگر probe از
  داخل Worker به `workers.dev` در دسترس نباشد.
- Build محلی v53.5/rev78؛ smoke **62/62** و syntax checks موفق.
- **این نسخه هنوز منتشر نشده است.** Worker اصلی و `live/worker.js` روی v53.4/rev77
  می‌مانند تا مجوز تازهٔ حساب اصلی برای انتشار کد ربات فراهم شود. بعد از انتشار
  main، دکمهٔ بات با اعتبارنامهٔ ذخیره‌شدهٔ همان حساب Cloudflare می‌تواند Worker
  فرزند را درجا ارتقا دهد؛ توکن قبلی فقط به حساب اصلی دسترسی داشت و نباید دوباره
  استفاده شود.
