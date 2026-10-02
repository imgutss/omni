#!/usr/bin/env python3
"""Omni patch5 — حذف آمار فیک مینی‌اپ + یکی‌کردن اسکنر + کانفیگ‌های سریع (الگوی پنل کارکرده)"""
import io, re, sys

def edit(path, fn):
    s = io.open(path, encoding='utf-8').read()
    out = fn(s)
    if out == s:
        print(f'  ⚠️  {path}: بدون تغییر'); return False
    io.open(path, 'w', encoding='utf-8').write(out)
    print(f'  ✔  {path}'); return True

# ── ۱) panel.html ────────────────────────────────────────────────────────────
def panel(s):
    # الف) شریم «demo API» که وقتی API واقعی جواب نمی‌دهد آمار فیک نشان می‌دهد
    i = s.find('<script>/* demo API')
    j = s.find('</script>', i)
    assert i > 0 and j > i, 'شیم دمو پیدا نشد'
    s = s[:i] + s[j + len('</script>'):]
    # ب) کارت تکراری «رتبه‌بندی آی‌پی تمیز» در بخش عیب‌یابی (اسکنر باید فقط یکی باشد)
    card = '''<div class="card">
      <div class="card-head">${d("bolt")}<h3>${a(n("diag.rankIps"))}</h3></div>
      <div class="field"><textarea id="rank-input" rows="4" dir="ltr" placeholder="104.16.0.0&#10;172.66.0.0"></textarea>
        <span class="hint">${a(n("diag.rankHint"))}</span></div>
      <button class="btn btn-primary btn-sm" data-action="rank" style="margin-top:10px">${d("play")} ${a(n("diag.run"))}</button>
      <div id="rank-out" style="margin-top:12px"></div>
    </div>

'''
    assert card in s, 'کارت رنک دیاگ پیدا نشد'
    s = s.replace(card, '', 1)
    s = s.replace('case"rank":return _a();', '', 1)
    return s

# ── ۲) bot.js — حذف مینی‌اپ تلگرام (باز شدن در مرورگر) ──────────────────────
def bot(s):
    old = "{ inline_keyboard: [[{ text: '🌐 باز کردن پنل', web_app: { url: `${origin}/` } }]] }"
    new = "{ inline_keyboard: [[{ text: '🌐 باز کردن پنل در مرورگر', url: `${origin}/` }]] }"
    assert old in s, 'دکمه مینی‌اپ پیدا نشد'
    return s.replace(old, new, 1)

# ── ۳) links.js — ترتیب پورت‌ها (TLS اول) + IPv6 در اولویت + تأییدشده‌ها ─────
def links(s):
    old_rot = "  const rotation = [80, 443, 2053, 8080, 2087, 8443, 8880, 2082, 2083, 2095, 2096, 2086, 2052];"
    new_rot = ("  // الگوی پنل کارکرده: ۴۴۳ (TLS) اول — کمترین احتمال throttle؛ پورت‌های بدون TLS فقط در انتها\n"
               "  const rotation = [443, 2053, 8443, 2087, 2096, 2083, 80, 8080, 8880, 2052, 2082, 2086, 2095];")
    assert old_rot in s
    s = s.replace(old_rot, new_rot, 1)

    old_order = """  safeArray(user?.ips).forEach(push);
  verified.forEach(push);
  if (host) push(host);        // دامنه‌ی پنل: همیشه به‌عنوان گزینه‌ی مطمئن
  guessed.forEach(push);
  if (String(settings.ipv6_enabled || '1') === '1') {
    const pool = safeArray(settings.ipv6_pool).length ? safeArray(settings.ipv6_pool) : IPV6_SEEDS;
    pool.forEach(push);
  }
  return list.slice(0, limit);"""
    new_order = """  safeArray(user?.ips).forEach(push);          // ۱) انتخاب صریح ادمین
  verified.forEach(push);                       // ۲) آی‌پی‌هایی که واقعاً جواب داده‌اند
  if (host) push(host);                         // ۳) دامنه‌ی پنل — همیشه سالم
  if (String(settings.ipv6_enabled || '1') === '1') {   // ۴) IPv6 کلودفلر (در ایران اغلب تمیزترین راه)
    const pool = safeArray(settings.ipv6_pool).length ? safeArray(settings.ipv6_pool) : IPV6_SEEDS;
    pool.forEach(push);
  }
  guessed.forEach(push);                        // ۵) حدس‌ها، آخرین شانس
  return list.slice(0, limit);"""
    assert old_order in s
    s = s.replace(old_order, new_order, 1)

    # محدودیت آدرس‌ها: ۸ مثل پنل مرجع
    s = s.replace("{ limit = 6 } = {}", "{ limit = 8 } = {}", 1)

    # جفت‌های تأییدشده: اول TLS (سریع‌تر و مقاوم‌تر)، بعد بدون TLS
    old_pairs = """  const orderedPairs = [
    ...pairs.filter((pr) => userIps.some((ip) => pr.startsWith(ip + ':'))),
    ...pairs.filter((pr) => !userIps.some((ip) => pr.startsWith(ip + ':'))),
  ];"""
    new_pairs = """  const isTlsPair = (pr) => isTlsPort(pr.slice(pr.lastIndexOf(':') + 1));
  const orderedPairs = [
    ...pairs.filter((pr) => userIps.some((ip) => pr.startsWith(ip + ':'))),
    ...pairs.filter((pr) => !userIps.some((ip) => pr.startsWith(ip + ':')) && isTlsPair(pr)),
    ...pairs.filter((pr) => !userIps.some((ip) => pr.startsWith(ip + ':')) && !isTlsPair(pr)),
  ];"""
    assert old_pairs in s
    s = s.replace(old_pairs, new_pairs, 1)
    return s

# ── ۴) auth.js — پیش‌فرض‌ها: بدون فرگمنت (کم‌ترین پینگ) و پورت ۴۴۳ ─────────
def auth(s):
    s2 = s.replace("fragment_preset: 'mci',", "fragment_preset: 'none',", 1)
    if s2 == s: print('   (fragment_preset پیش‌فرض مci پیدا نشد؛ رد شد)')
    s = s2
    return s

edit('src/panel.html', panel)
edit('src/bot.js', bot)
edit('src/links.js', links)
edit('src/auth.js', auth)
