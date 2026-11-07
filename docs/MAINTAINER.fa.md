# انتشار نسخهٔ بعدی

[English](MAINTAINER.md)

شمارهٔ محصول، revision داخلی و برچسب نسخه از مسیر واحد انتشار مدیریت می‌شوند:

```bash
npm run release:prepare -- 1.0.1
npm run test:all
git add .
git commit -m "release: 1.0.1"
git tag v1.0.1
git push origin main --tags
```

ابزار آماده‌سازی، نسخه و revision را بالا می‌برد. workflow انتشار آزمون‌ها را اجرا، بسته و SHA-256 را می‌سازد، Worker مرکزی و `RELEASES/current` را همگام و سپس release را عمومی می‌کند. پس از آن، دکمهٔ آپدیت تلگرام همان نسخه را برای نود انتخاب‌شده نصب می‌کند.

در GitHub Actions دو secret لازم‌اند: **`CF_API_TOKEN`** و **`CF_ACCOUNT_ID`**. توکن باید دسترسی لازم به Worker مرکزی و namespace انتشار داشته باشد. نام Worker مرکزی در workflow برابر `omni` است؛ در نصب خودتان آن را بازبینی کنید. اعتبارنامه‌ها را در کد نگذارید. پس از تعویض توکن Cloudflare، secret مربوط به Actions را هم عوض کنید.

نسخه‌های بازگشت کد و تنظیمات در namespace خصوصی انتشار نگه‌داری می‌شوند. SQL را هم جداگانه پشتیبان بگیرید. این مسیر ارتقای خودکار تمام حساب‌های کاربران را فعال نمی‌کند؛ آپدیت گسترده، تصمیم جداگانه است.
