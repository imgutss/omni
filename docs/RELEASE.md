# Omni Panel

**کاربران، کانفیگ‌ها و مسیر اتصال؛ همه در یک پنل.**

- پنل وب و کنسول تلگرام با نمایش نسخهٔ انتشار.
- کانفیگ‌ساز، اوت‌باند و لوکیشن، WARP Studio و MASQUE Studio.
- راهنمای کوتاه فارسی و انگلیسی برای تمام بخش‌ها.
- آپدیت درجا از تلگرام با بستهٔ همگام Worker و RELEASES.
- مسیر انتشار نسخه‌های بعدی با آزمون خودکار و SHA-256.

[شروع کار](https://github.com/imgutss/omni/blob/main/docs/GUIDE.fa.md) · [نصب](https://github.com/imgutss/omni/blob/main/docs/DEPLOY.fa.md) · [Omni App](https://github.com/imgutss/Omni-App/releases/tag/v1.0.0)

## Downloads

`worker.js` embeds the complete panel. `panel.html` is provided for inspection; `manifest.json` and `SHA256SUMS` verify the artifacts. The ZIP contains all four files.

Back up existing data and preserve bindings. A personal Telegram bot requires a webhook registered with `secret_token`. Provider availability, quota and client compatibility still apply.

Automated checks cover release consistency, managed workflow mocks, actual local workerd/D1 behavior and mobile/desktop rendering. They do not guarantee every provider or physical-device connection.
