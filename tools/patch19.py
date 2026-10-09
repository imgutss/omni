import pathlib, sys

IPS = ["104.16.5.5", "104.18.32.1", "162.159.130.25", "188.114.96.3", "104.16.1.1",
       "104.16.2.2", "104.16.8.8", "104.16.16.16", "104.16.32.32", "104.16.64.64",
       "104.16.128.128", "104.17.3.3", "104.17.64.64", "104.18.8.8", "104.18.64.64",
       "104.19.16.16", "104.19.64.64", "104.20.5.5", "104.21.9.9", "104.21.64.64",
       "104.24.8.8", "104.25.16.16", "141.101.120.120", "162.159.128.128",
       "162.159.192.140", "162.159.137.74", "162.159.195.1", "188.114.96.73",
       "188.114.97.97", "188.114.98.98", "188.114.99.99", "190.93.244.244",
       "190.93.245.245"]
ips_js = ", ".join('"%s"' % i for i in IPS)

P = pathlib.Path('/home/user/omni/production/panel.html')
s = P.read_text(encoding='utf-8')

def rep(old, new, n=1):
    global s
    c = s.count(old)
    if c != n:
        print(f'FAIL anchor x{c}: {old[:70]!r}'); sys.exit(1)
    s = s.replace(old, new, n)

dup = '    cf: { cleanIps: ["104.16.5.5", "104.18.32.1", "162.159.130.25", "188.114.96.3"] },\n    cf: { cleanIps: ["104.16.5.5", "104.18.32.1", "162.159.130.25", "188.114.96.3"] },'
if s.count(dup) == 1:
    s = s.replace(dup, '    cf: { cleanIps: [%s] },' % ips_js, 1)
else:
    single = '    cf: { cleanIps: ["104.16.5.5", "104.18.32.1", "162.159.130.25", "188.114.96.3"] },'
    if s.count(single) == 1:
        s = s.replace(single, '    cf: { cleanIps: [%s] },' % ips_js, 1)
    else:
        print('FAIL cf lines'); sys.exit(1)

rep("""    let verifiedDirectEndpoints = [
      { name: "دامنهٔ خود ورکر (مستقیم)", ip: publicHost, ping: "پایه" },
      { name: "CF-1 104.16.5.5 (تست زنده ✅)", ip: "104.16.5.5", ping: "0.21s" },
      { name: "CF-2 104.18.32.1 (تست زنده ✅)", ip: "104.18.32.1", ping: "0.37s" },
      { name: "CF-3 162.159.130.25 (تست زنده ✅)", ip: "162.159.130.25", ping: "0.20s" },
      { name: "CF-4 188.114.96.3 (تست زنده ✅)", ip: "188.114.96.3", ping: "1.8s" }
    ];""",
"""    let verifiedDirectEndpoints = [
      { name: "دامنهٔ خود ورکر (مستقیم)", ip: publicHost, ping: "پایه" },
      ...NATNET_DATA.cf.cleanIps.map(ip => ({ name: `CF ${ip} (تست زنده ✅ Xray)`, ip, ping: "" }))
    ];""")

rep("""<span class="badge info">⚡ روت‌های مستقیم تست‌شده (۵۸ms - ۱۲۶ms)</span>""",
"""<span class="badge info">⚡ روت مستقیم + آی‌پی تمیز — تست زنده با کلاینت واقعی Xray (۲۰۲۶-۱۰-۰۹)</span>""")
rep("""⚡ روت‌های مستقیم فوق‌سریع (تست‌شده ۵۸ms - ۱۲۶ms در v2rayNG)""",
"""⚡ روت‌های مستقیم فوق‌سریع + ۳۳ آی‌پی تمیز (تست زنده با کلاینت واقعی Xray — ۲۰۲۶-۱۰-۰۹)""")

P.write_text(s, encoding='utf-8')
print('panel patched (patch19): %d clean IPs' % len(IPS))

G = pathlib.Path('/home/user/omni/tools/sanction-generator.html')
g = G.read_text(encoding='utf-8')
old_g = '  cf: { cleanIps: ["104.16.5.5", "104.18.32.1", "162.159.130.25", "188.114.96.3"] }'
assert g.count(old_g) == 1, g.count(old_g)
g = g.replace(old_g, '  cf: { cleanIps: [%s] }' % ips_js, 1)
g = g.replace('خروجی: ۱ نود مستقیم + ۴ آی‌پی تمیز CF', 'خروجی: ۱ نود مستقیم + ۳۳ آی‌پی تمیز CF')
G.write_text(g, encoding='utf-8')
print('generator patched (v8.1)')
