"""Fix: the "custom project name" branch of /natbridge dropped the resolved
tunnel path, because the bridge_name UI state only carried the platform and the
follow-up handler passed `ui.data?.path` (undefined) to askBridgeToken. The bot
then built the bridge against the hard-coded default path instead of the panel's
real one — the bridge would have been dead on arrival.

Applied to production/worker.js (canonical) and tools/patch8.py (generator).
Run: python3 tools/patch12.py
"""
import pathlib

ROOT = pathlib.Path('/home/user/omni')

PAIRS = [
    ('      await setUiState(env, chatId, "bridge_name", { platform });',
     '      await setUiState(env, chatId, "bridge_name", { platform, path: autoPath2 });'),
    ('    return askBridgeToken(env, chatId, ui.data?.platform || "vercel", name, send, ui.data?.path);',
     '    return askBridgeToken(env, chatId, ui.data?.platform || "vercel", name, send, ui.data?.path || await bridgePanelPath(env, chatId, await bridgeResolvePanel(env)));'),
]

for name in ('production/worker.js', 'tools/patch8.py'):
    p = ROOT / name
    s = p.read_text(encoding='utf-8')
    for old, new in PAIRS:
        n = s.count(old)
        if n != 1:
            raise SystemExit(f'{name}: expected 1 occurrence, found {n} for: {old[:70]!r}')
        s = s.replace(old, new, 1)
    p.write_text(s, encoding='utf-8')
    print('patched', name)
