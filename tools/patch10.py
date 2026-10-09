"""Fix: the bot deployed bridges with a hard-coded tunnel path.

Every Omni panel picks a random `settings.path` at bootstrap, so a bridge built
against "/VZLdh9Ft" proxies to a path the target panel rejects. The bot now
reads the real path from the panel's own D1 through the Cloudflare API (the same
channel `panelSetting` already uses for /doctor), and falls back to the default
when the panel is not management-connected.

Applied to production/worker.js (canonical) and tools/patch8.py (generator).
Run: python3 tools/patch10.py
"""
import pathlib

ROOT = pathlib.Path('/home/user/omni')

HELPERS = (
    'function bridgePathText(tunnelPath) {\n'
    '  let t = String(tunnelPath || "").trim().split("?")[0];\n'
    '  if (!t || t === "/")\n'
    '    return "/VZLdh9Ft";\n'
    '  if (t.charCodeAt(0) !== 47)\n'
    '    t = "/" + t;\n'
    '  return t.slice(0, 60);\n'
    '}\n'
    'async function bridgePanelPath(env, chatId, panel) {\n'
    '  const fallback = "/VZLdh9Ft";\n'
    '  if (!panel?.account_id || !panel?.database_id || !isPanelManagementVerified(panel))\n'
    '    return fallback;\n'
    '  try {\n'
    '    const token = await getCachedToken(env, chatId);\n'
    '    if (!token)\n'
    '      return fallback;\n'
    '    return bridgePathText(await panelSetting(token, panel, "path"));\n'
    '  } catch {\n'
    '    return fallback;\n'
    '  }\n'
    '}\n'
    'async function bridgeResolvePanel(env) {\n'
    '  return await env.DB.prepare('
    '"SELECT id,worker_name,panel_url,status,account_id,database_id,source '
    'FROM bot_panels WHERE panel_url IS NOT NULL ORDER BY id DESC LIMIT 1"'
    ').first().catch(() => null);\n'
    '}\n'
)

NBNAME_OLD = (
    '    if (!isBridgePlatform(platform)) return send("\\u067E\\u0644\\u062A\\u0641\\u0631\\u0645 \\u0646\\u0627\\u0645\\u0639\\u062A\\u0628\\u0631.");\n'
    '    if (!rawName || rawName.includes("\\u270F")) {\n'
)
NBNAME_NEW = (
    '    if (!isBridgePlatform(platform)) return send("\\u067E\\u0644\\u062A\\u0641\\u0631\\u0645 \\u0646\\u0627\\u0645\\u0639\\u062A\\u0628\\u0631.");\n'
    '    const panel2 = await bridgeResolvePanel(env);\n'
    '    const autoPath2 = await bridgePanelPath(env, chatId, panel2);\n'
    '    if (!rawName || rawName.includes("\\u270F")) {\n'
)

PAIRS = [
    # 1. /natbridge must look up the panel's real tunnel path
    ('    const autoPath = "/VZLdh9Ft";\n',
     '    const autoPath = await bridgePanelPath(env, chatId, panel);\n'),
    # 2. that lookup needs the panel's management ids
    ('const panel = await env.DB.prepare("SELECT worker_name,panel_url,status FROM bot_panels WHERE panel_url IS NOT NULL ORDER BY id DESC LIMIT 1").first().catch(() => null);\n    const autoTarget',
     'const panel = await bridgeResolvePanel(env);\n    const autoTarget'),
    # 3. askBridgeToken takes the resolved path instead of hard-coding it
    ('async function askBridgeToken(env, chatId, platform, name, send) {',
     'async function askBridgeToken(env, chatId, platform, name, send, tunnelPath) {'),
    ('{ platform, name, target, path: "/VZLdh9Ft" }',
     '{ platform, name, target, path: bridgePathText(tunnelPath) }'),
    # 4. both call sites pass it through
    ('    return askBridgeToken(env, chatId, platform, rawName, send);',
     '    return askBridgeToken(env, chatId, platform, rawName, send, autoPath2);'),
    ('    return askBridgeToken(env, chatId, ui.data?.platform || "vercel", name, send);',
     '    return askBridgeToken(env, chatId, ui.data?.platform || "vercel", name, send, ui.data?.path);'),
    # 5. the nbname: branch is its own scope, so it resolves the panel itself
    (NBNAME_OLD, NBNAME_NEW),
    # 6. the helpers, parked right above askBridgeToken
    ('async function askBridgeToken(env, chatId, platform, name, send, tunnelPath) {',
     HELPERS + 'async function askBridgeToken(env, chatId, platform, name, send, tunnelPath) {'),
]

for name in ('production/worker.js', 'tools/patch8.py'):
    p = ROOT / name
    s = p.read_text(encoding='utf-8')
    for old, new in PAIRS:
        n = s.count(old)
        if n != 1:
            raise SystemExit(f'{name}: expected 1 occurrence, found {n} for: {old[:70]!r}')
        s = s.replace(old, new, 1)
    for ident in ('bridgePathText', 'bridgePanelPath', 'bridgeResolvePanel'):
        if s.count(f'function {ident}(') != 1:
            raise SystemExit(f'{name}: {ident} is not defined exactly once')
    p.write_text(s, encoding='utf-8')
    print('patched', name)
