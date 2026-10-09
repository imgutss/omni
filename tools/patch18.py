import pathlib, sys

P = pathlib.Path('/home/user/omni/production/panel.html')
s = P.read_text(encoding='utf-8')

def rep(old, new, n=1):
    global s
    c = s.count(old)
    if c == 0 and new and s.count(new) >= n:
        print('skip (already applied)'); return
    if c != n:
        print(f'FAIL anchor x{c}: {old[:70]!r}'); sys.exit(1)
    s = s.replace(old, new, n)

# drop the 4 dead per-config button triples
for var in ("vercelDirectWs", "vercelAnycastUris[0]", "netlifyDirectWs", "netlifyAnycastUris[0]"):
    rep(f"""              <button class="btn btn-xs" type="button" data-action="omni-copy" data-text="${{a({var})}}">${{d("copy")}} کپی</button>
              <button class="btn btn-xs btn-primary" type="button" data-action="omni-natnet-v2rayng" data-uri="${{a({var})}}">📲 نصب</button>
              <button class="btn btn-xs" type="button" data-action="omni-natnet-qr" data-uri="${{a({var})}}">${{d("qr")}}</button>
""", "")

# relabel the 4 cards as mirrors / dead
rep("""              <span class="badge ok">اتصال مستقیم WS</span>
              <b style="font-size:12.5px">${a(vercelDomain)}</b>""",
"""              <span class="badge warn">آینهٔ HTTP — فقط مرورگر</span>
              <b style="font-size:12.5px">${a(vercelDomain)}</b>""")
rep("""              <span class="badge ok">اتصال Anycast ورسل</span>""",
"""              <span class="badge danger">ترافیک کلاینت: ❌ تست زنده</span>""")
rep("""              <span class="badge ok">اتصال مستقیم WS</span>
              <b style="font-size:12.5px">${a(netlifyDomain)}</b>""",
"""              <span class="badge warn">آینهٔ HTTP — فقط مرورگر</span>
              <b style="font-size:12.5px">${a(netlifyDomain)}</b>""")
rep("""              <span class="badge ok">Anycast لبه نتلیفای</span>""",
"""              <span class="badge danger">ترافیک کلاینت: ❌ تست زنده</span>""")

rep("""          <div class="muted mono" style="font-size:11px;margin-top:4px">Address: ${a(vercelDomain)} · VLESS+WS</div>""",
"""          <div class="muted mono" style="font-size:11px;margin-top:4px">Mirror: https://${a(vercelDomain)} — ورود به پنل از مرورگر وقتی دامنه فیلتر است</div>""")
rep("""          <div class="muted mono" style="font-size:11px;margin-top:4px">Address: 76.76.21.21 · SNI: ${a(vercelDomain)}</div>""",
"""          <div class="muted mono" style="font-size:11px;margin-top:4px">WS upgrade در لبه ورسل رد می‌شود (۲۰۰ نه ۱۰۱) — کانفیگ کلاینت نسازید</div>""")
rep("""          <div class="muted mono" style="font-size:11px;margin-top:4px">Address: ${a(netlifyDomain)} · VLESS+WS</div>""",
"""          <div class="muted mono" style="font-size:11px;margin-top:4px">Mirror: https://${a(netlifyDomain)} — ورود به پنل از مرورگر وقتی دامنه فیلتر است</div>""")
rep("""          <div class="muted mono" style="font-size:11px;margin-top:4px">Address: 104.198.14.52 · SNI: ${a(netlifyDomain)}</div>""",
"""          <div class="muted mono" style="font-size:11px;margin-top:4px">WS upgrade در لبه نتلیفای رد می‌شود (۲۰۰ نه ۱۰۱) — کانفیگ کلاینت نسازید</div>""")

P.write_text(s, encoding='utf-8')
print('panel.html patched OK (patch18)')
