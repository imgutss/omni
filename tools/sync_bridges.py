"""Re-embed src/bridges.js into production/worker.js.

production/worker.js is canonical and carries the bridge module inline, between
the marker comment and `async function handleApi(`. After editing src/bridges.js
run this instead of tools/patch8.py --force (patch8 inserts, it is not idempotent).

    python3 tools/sync_bridges.py && node production/build.mjs
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
WORKER = ROOT / 'production' / 'worker.js'
BRIDGES = ROOT / 'src' / 'bridges.js'
PATCH8 = ROOT / 'tools' / 'patch8.py'

MARKER = '\n// src/bridges.js — Omni NationalNet bridge API (Vercel & Netlify auto-deploy)\n'
END = 'async function handleApi(request, env, ctx, url) {'

# lift the export stripper out of patch8.py so both stay in one place
p8 = PATCH8.read_text(encoding='utf-8')
start = p8.index('EXPORT_RE = re.compile(')
end = p8.index('mod, STRIPPED, KEPT = strip_module_exports')
ns = {'re': re}
exec(p8[start:end], ns)
strip_module_exports = ns['strip_module_exports']

mod, STRIPPED, KEPT = strip_module_exports(BRIDGES.read_text(encoding='utf-8'))
if len(STRIPPED) < 28:
    raise SystemExit(f'only {len(STRIPPED)} module exports were stripped; expected at least 28')
if KEPT:
    raise SystemExit(f'a module-level export survived the strip at offset {KEPT[0]}')
if 'export default function handler(req, res)' not in mod:
    raise SystemExit('template-literal export was stripped by mistake')

block = MARKER + mod.rstrip() + '\n\n'

worker = WORKER.read_text(encoding='utf-8')
if worker.count(MARKER) != 1:
    raise SystemExit(f'marker count = {worker.count(MARKER)}')
if worker.count(END) != 1:
    raise SystemExit(f'handleApi anchor count = {worker.count(END)}')
before = worker.index(MARKER)
after = worker.index(END, before)
old = worker[before:after]
if old == block:
    print('src/bridges.js is already embedded verbatim')
else:
    WORKER.write_text(worker[:before] + block + worker[after:], encoding='utf-8')
    print(f're-embedded src/bridges.js: {len(old)} -> {len(block)} chars')
