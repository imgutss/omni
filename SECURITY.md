# Security

## Report privately

Do not put tokens, session cookies, SQL exports, user subscriptions or recovery codes in a public issue. Use the repository's private vulnerability reporting channel if available; otherwise contact the maintainer through a private channel before sharing a reproducer. Never include working credentials in a public report.

## V1 security behavior

- Telegram updates require an independently generated webhook secret in both the URL and Telegram's authenticated header. The shared legacy fallback is not accepted.
- Bot diagnostic details require an admin session.
- Child-node automatic upgrades require `OMNI_AUTO_UPGRADE=1`.
- Deployment requires an explicit local opt-in and canonical artifact selection.
- Session cookies retain HTTPS/HttpOnly/SameSite protections; role and resource ownership remain separate checks.

An existing webhook **must be registered again with `secret_token`** before moving to v1. [Migration guide](docs/DEPLOY.md)

## Protect the control plane

Cloudflare tokens can create or modify infrastructure. D1 can contain user information, session state and retained provider credentials. RELEASES contains deployable code. Restrict each permission and keep backups encrypted and outside Git. Some provider workflows retain tokens in D1; there is no application-wide encrypted token vault.

Do not expose an uninitialized panel before the first account is claimed. Use temporary access restrictions for setup and a unique administrator password. Design final admin protection without accidentally blocking proxy and Telegram traffic.

Rotate any credential that has appeared in a repository, screenshot, terminal transcript or other shared material. Removing a current file does not remove its historical copies. Revoke old credentials rather than relying on redaction alone.

## Scope of validation

Automated tests, dependency advisories and a source review are not a complete penetration test. Offline provider mocks do not prove real provider compatibility, device connectivity or production deployment safety. Follow the staged rollout and rollback procedure in the deployment guide.

## فارسی

اطلاعات ورود، توکن، کوکی نشست، اشتراک کاربر و فایل SQL را در issue عمومی نفرستید. وب‌هوک نسخهٔ یک به مسیر خصوصی و هدر معتبر نیاز دارد و پیش از مهاجرت باید دوباره ثبت شود. D1 و پشتیبان آن ممکن است اعتبارنامهٔ ارائه‌دهنده داشته باشند؛ دسترسی و نگهداری آن‌ها را محرمانه در نظر بگیرید. اعتبارنامهٔ افشاشده را تعویض کنید؛ حذف از فایل، نسخه‌های تاریخی را حذف نمی‌کند. آزمون آفلاین یا بررسی سورس، تضمین امنیت کامل یا اتصال واقعی نیست.
