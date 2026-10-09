"""Show the resolved tunnel path in the bot's token prompt, so a wrong path is
visible before the token is ever pasted.

The text lives in production/worker.js (canonical) and inside a raw string in
tools/patch8.py (generator); both files keep it in the same escaped form, so the
same replacement applies to each.

Run: python3 tools/patch11.py
"""
import pathlib

ROOT = pathlib.Path('/home/user/omni')

NEEDLE = 'u0645\\u0642\\u0635\\u062F: <code>${esc2(target || "\\u2014")}</code>'
PATH_BIT = '\\n\\u0645\\u0633\\u06CC\\u0631 \\u062A\\u0648\\u0646\\u0644: <code>${esc2(bridgePathText(tunnelPath))}</code>'

for name in ('production/worker.js', 'tools/patch8.py'):
    p = ROOT / name
    s = p.read_text(encoding='utf-8')
    if PATH_BIT in s:
        print('already applied:', name)
        continue
    n = s.count(NEEDLE)
    if n != 1:
        raise SystemExit(f'{name}: expected 1 occurrence, found {n}')
    p.write_text(s.replace(NEEDLE, NEEDLE + PATH_BIT, 1), encoding='utf-8')
    print('patched', name)
