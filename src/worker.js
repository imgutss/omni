/* ══════════════════════════════════════════════════════════════════════════
   Omni — src/worker.js  (نقطه‌ی ورود ورکر)
   پنل مدیریت + پروکسی VLESS/Trojan + ربات تلگرام + اسکنر، همه روی Cloudflare
   ══════════════════════════════════════════════════════════════════════════ */
import PANEL_HTML from './panel.html';
import { bootstrap, settingsCached, settingsCachedSync, allSettings } from './auth.js';
import { handleApi } from './api.js';
import { handleProxy, serveDecoy } from './core.js';
import { handleUpdate, scheduledTasks } from './bot.js';

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      /* ── پینگ واقعی لبه برای اسکنر و صفحه وضعیت (بدون کش و بدون درگیر کردن D1) ── */
      if (url.pathname === '/healthz') {
        return new Response('ok', {
          status: 200,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'no-store, no-cache, must-revalidate',
            'access-control-allow-origin': '*',
            'x-omni-colo': String(request.cf?.colo || 'CF'),
          },
        });
      }

      /* ── مسیر فوق‌سریع WebSocket پروکسی (بدون بلاک شدن روی کوئری دیتابیس D1 در شروع سرد) ── */
      const upgrade = (request.headers.get('Upgrade') || '').toLowerCase();
      if (upgrade === 'websocket') {
        const fastSettings = settingsCachedSync() || {
          panel_name: 'Omni',
          proto: 'both',
          path: '/JOGpAVgq',
          trojan_password: '9Z6oc6_y7x04Ihqltcd9zw',
          selected_country: 'DIRECT',
          dns_upstream: 'https://1.1.1.1/dns-query',
          block_ads: '0',
          block_nsfw: '0',
          block_list: '[]',
        };
        if (!settingsCachedSync()) {
          ctx.waitUntil(bootstrap(env, url).catch(() => {}));
        }
        try {
          return await handleProxy(request, env, ctx, url, fastSettings);
        } catch (e) {
          return new Response('proxy error: ' + (e?.message || e), { status: 500 });
        }
      }

      const settings = await bootstrap(env, url);

    /* ── وب‌هوک تلگرام ── */
    if (url.pathname.startsWith('/tg/')) {
      const secret = env.BOT_WEBHOOK_SECRET || 'omni-hook';
      if (url.pathname !== `/tg/${secret}`) return new Response('forbidden', { status: 403 });
      const update = await request.json().catch(() => null);
      if (update) ctx.waitUntil(handleUpdate(env, ctx, url.origin, update).catch(() => {}));
      return new Response('ok');
    }

    /* ── روت‌های API / ساب / وضعیت ── */
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/s/') || url.pathname.startsWith('/status/')) {
      let res;
      try {
        res = await handleApi(request, env, ctx, url);
      } catch (e) {
        // خطای پیش‌بینی‌نشده باید همان شکل خطای فرانت‌اند را داشته باشد
        res = new Response(JSON.stringify({ ok: false, code: 'internal', error: String(e?.message || e) }), {
          status: 500, headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
      const out = new Response(res.body, res);
      out.headers.set('x-omni', '1');          // فرانت‌اند از این هدر می‌فهمد بک‌اند واقعی است
      out.headers.set('access-control-expose-headers', 'x-omni');
      return out;
    }

    /* ── پنل (طراحی Omni) ── */
    if (url.pathname === '/' || url.pathname === '/panel' || url.pathname === '/index.html') {
      if (settings.maintenance === '1' && !(request.headers.get('cookie') || '').includes('omni_sid')) {
        return new Response('<!doctype html><meta charset="utf-8"><title>Omni</title><body style="background:#06070a;color:#e8eef9;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2>در حال تعمیرات</h2><p style="opacity:.7">پنل موقتاً در دسترس نیست.</p></div>',
          { headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      return new Response(PANEL_HTML, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    /* ── صفحه‌ی پوششی ── */
    return serveDecoy(env, settings);
    } catch (err) {
      return new Response('Worker error: ' + String(err?.stack || err?.message || err), { status: 500 });
    }
  },

  async scheduled(event, env, ctx) {
    const host = env.PUBLIC_HOST || 'omni.workers.dev';
    await bootstrap(env, new URL('https://' + host));
    const st = await allSettings(env);
    const pub = st.public_host || host;
    const origin = pub.startsWith('http') ? pub : 'https://' + pub;
    await scheduledTasks(env, ctx, origin);
  },
};
