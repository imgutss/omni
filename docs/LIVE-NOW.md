# وضعیت زنده — ۲۰۲۶-۱۰-۰۹ ۰۸:۰۶ UTC (آخرین و معتبرترین)

اگر فقط یک فایل می‌خوانی، همین است. بقیهٔ فایل‌ها جزئیات و تاریخچه‌اند.

## چه چیزی همین الان بالا است

| چیز | آدرس |
|---|---|
| پنل | https://omni.4lifm29.workers.dev — مسیر تونل `/JOGpAVgq` |
| ورکر | اکانت `9a3aabde4bdecbff1e298100985c7e7e`، اسکریپت `omni`، نسخهٔ `b4102152-8aee-4d8f-a3c0-7d1a8b5caa9c` |
| ربات تلگرام | @OmniAiGateBot — وبهوک `POST https://omni.4lifm29.workers.dev/tg/omni-hook` |
| پل ورسل | https://omni-bridge-cu67-4lifm27-4000s-projects.vercel.app |
| پل نتلیفای | https://omni-net-cu67.netlify.app |
| ریپو | https://github.com/Alisarani7021/omni — شاخهٔ `main`، کامیت `bbf46ad` |

هر دو پل، مسیر تونل پنل را بایت‌به‌بایت پروکسی می‌کنند (۸۶۹ بایت، کاملاً یکسان با
پنل). صفحهٔ اول هر دو (`/`) یک صفحهٔ فریب است، نه پنل. سلامت پل ورسل:
`GET /__bridge` → `{"ok":true,"status":200,"ms":52,"relay":"omni-vercel"}`.

## چطور دوباره دیپلوی کنم (ساده‌ترین راه)

```bash
cd omni
export CLOUDFLARE_API_TOKEN=…      # همان توکن cfut_…
export CLOUDFLARE_ACCOUNT_ID=9a3aabde4bdecbff1e298100985c7e7e
npx wrangler deploy --config wrangler.toml
```

همین یک دستور، کد + هر شش بایندینگ + کرون را با هم می‌فرستد و `BOT_TOKEN`
(سکرت) هم سر جایش می‌ماند. بعدش اگر لازم بود:

```bash
npx wrangler secret put BOT_TOKEN --config wrangler.toml   # فقط اگر توکن ربات عوض شد
```

اعتبارنامه‌ها در `/home/user/cfpanel/.env` (خارج از ریپو، `chmod 600`) هم
ذخیره شد تا `node deploy/deploy.mjs` هم کار کند — آن اسکریپت علاوه بر دیپلوی،
وب‌هوک و منوی ربات را هم از نو ست می‌کند.

## فایل‌های دیپلوی

- `omni-worker.bundle.js` (در همین پوشه) — همان چیزی است که روی ورکر لایو است.
  SHA-256: `22cbde6953e95479a885e5ebf762cc1bec9bc06b45a7b7aeb7e4b1b4227772d5`
- `panel.html (current — still deployed)` (در همین پوشه) — **هنوز معتبر است**؛
  پنل با این تغییرات عوض نشد.
  SHA-256: `dce572184adb12fee1afb4d1d6e76268afe4bd44fcec06ac71c7aa72ade8cee7`
  (۵۵۲٬۹۴۹ بایت، بایت‌به‌بایت یکسان با چیزی که لایو سرو می‌شود). روی KV کلید
  `panel` با namespace `RELEASES` نشسته.

## کار باقی‌مانده: هیچ

**کرون `*/5 * * * *` ست شد** (۲۰۲۶-۱۰-۰۹ ۰۸:۰۱ UTC) با یک `wrangler deploy`
کامل. با توکن API خالی نمی‌شود ستش کرد
(`PUT …/workers/scripts/omni/settings` → `10405`؛ `…/workers/triggers/schedules` →
`7003 no route`)، ولی `wrangler deploy` هم کد را می‌فرستد و هم تریگرها را.

تأیید شد از راه API:

```json
GET /accounts/{acc}/workers/scripts/omni/schedules
{"result":{"schedules":[{"cron":"*/5 * * * *",
  "created_on":"2026-10-08T20:08:41Z","modified_on":"2026-10-09T08:01:16Z"}]}}
```

کرون هر ۵ دقیقه این کارها را می‌کند: `drainUpdates` (صف پیام‌های ربات)،
`syncCreatorCommands` (ثبت منوی دستورات)، `monitorCreatorPanels`،
`notifyReleaseUpdate`، `remindBackups`، و گزارش شبانه ساعت ۵ UTC.

## هفت بایندینگ زنده (بعد از دیپلوی دوباره چک شد)

```
secret_text   BOT_TOKEN              (سر جایش ماند)
plain_text    BOT_USERNAME           = OmniAiGateBot
plain_text    BOT_WEBHOOK_SECRET     = omni-hook
plain_text    PANEL_NAME             = Omni
plain_text    PUBLIC_HOST            = omni.4lifm29.workers.dev   ← جدید
d1            DB                     = omni-db / 9660e603-a4e9-4b2c-8071-788e2539e618
kv_namespace  RELEASES               = f7ac482df0f04daf96378b6b55224dc9
```

`PUBLIC_HOST` در `wrangler.toml` اضافه شد تا هندلر `scheduled` از همان اول
آدرس درست پنل را داشته باشد (قبلاً به `omni.workers.dev` پیش‌فرض می‌رفت).

**اثر عملی کرون که همین الان دیده شد:** اجرای ساعت ۰۸:۰۵ منوی دستورات ربات را
دوباره ثبت کرد و `getMyCommands` حالا این‌ها را نشان می‌دهد:
`help deploy panels connect natbridge cancel token bridge forget`
(یعنی `/natbridge` در منوی ربات هست). وب‌هوک هم بدون خطاست.

## نکتهٔ مهم دربارهٔ وب‌سوکت

هیچ‌کدام از ورسل و نتلیفای ارتقای وب‌سوکت را برای این مسیر انجام نمی‌دهند
(جواب ۲۰۰ می‌آید، نه ۱۰۱). پس کلاینت‌ها باید با ترنسپورت استریم/POST کار کنند
(مسیر XHTTP پنل). این ویژگی پلتفرم است، نه باگ پل.

## چک‌لیست نهایی (همه ✅)

- ورکر لایو با کد نهایی و هر هفت بایندینگ
- کرون `*/5 * * * *` ست شد و اجرای واقعی‌اش با `wrangler tail` دیده شد: `"*/5 * * * *" @ 8:05:16 AM - Ok`
- منوی دستورات ربات شامل `/natbridge`
- وب‌هوک ربات فعال و بدون خطا
- پنل لایو بایت‌به‌بایت یکسان با `production/panel.html`
- پل ورسل و پل نتلیفای، هر دو مسیر تونل را بایت‌به‌بایت پروکسی می‌کنند
- همهٔ تست‌ها سبز (۱۵ + ۱۶ + ۱۸ + ۹ + رگرسیون پنل)
- ریپو به‌روز و پوشهٔ درایو به‌روز
- سایت‌ها/پروژه‌های آزمایشی و شکست‌خورده پاک شدند

## چیزهایی که باید بدانی

- توکن `cfut_…` که اول به‌عنوان توکن ورسل داده شد، **توکن کلاودفلیر** است
  (`active`) و با آن خود ورکر دیپلوی شد. جلوی فیلد ورسل که بگذاری، درست
  «نامعتبر» می‌گوید.
- توکن‌ها هیچ‌جا در ریپو ذخیره نشده‌اند. توکن تلگرام هر کاربر بعد از خواندن
  بلافاصله پاک می‌شود و فقط در صورت درخواست «ذخیره» در جدول `bot_bridge_tokens`
  همان پنل می‌نشیند.
- علت واقعی اینکه «نتلیفای اصلا کار نمی‌کرد»: سایت‌های نتلیفای با
  `sso_login: true` ساخته می‌شوند و هر مسیری ۴۰۱ می‌دهد؛ پروژه‌های ورسل هم
  `ssoProtection` پیش‌فرض دارند و ۳۰۲ می‌دهند. هر دو حالا خودکار خاموش می‌شوند.
  سایت‌های قدیمی اکانتت (مثل `omni-net-qj6m` که باز شد، و بقیه که دست نخوردند)
  همه پشت همین دیوار لاگین بودند.
- سایت‌ها و پروژه‌های آزمایشی و شکست‌خوردهٔ این جلسه پاک شدند. روی اکانت‌هایت
  فقط دو پل سالم مانده‌اند. پروژه‌های واقعی خودت دست نخورد.
