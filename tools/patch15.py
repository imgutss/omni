"""Fix: Vercel protects new deployments by default, exactly like Netlify's SSO wall.

A freshly created project on this account came back with
  "ssoProtection": {"deploymentType": "all_except_custom_domains"}
so every path of the deployed bridge answered
  302 "Protected by Vercel Authentication"
and the bridge was useless. Verified fix:
  PATCH /v9/projects/{id}  {"ssoProtection": null}   -> 200, ssoProtection: null
  then GET https://<deployment>.vercel.app/JOGpAVgq  -> 200 and the body is
  byte-identical to the same path on the target panel.

The property is now also sent on project creation, and re-asserted with a PATCH
for reused projects, mirroring netlifyAllowPublicAccess.

Applied to src/bridges.js (source of record) and production/worker.js (embedded).

Run: python3 tools/patch15.py
"""
import pathlib

ROOT = pathlib.Path('/home/user/omni')

HELPER = """/** Vercel turns deployment protection on for new projects; every path then
 *  answers 302 "Protected by Vercel Authentication". */
async function vercelAllowPublicAccess(token, projectId, teamId) {
  const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  await vfetch(token, `/v9/projects/${encodeURIComponent(projectId)}${q}`, {
    method: 'PATCH',
    body: JSON.stringify({ ssoProtection: null }),
  }).catch(() => null);
}

async function vercelEnsureProject(token, name, target, teamId) {"""

EDITS = [
    # 1. the helper, right above vercelEnsureProject
    ("async function vercelEnsureProject(token, name, target, teamId) {", HELPER),

    # 2. a reused project gets unprotected too
    ("""    const existing = await vfetch(token, `/v9/projects/${encodeURIComponent(name)}${q}`);
    if (existing?.id) return { id: existing.id, name: existing.name, created: false };""",
     """    const existing = await vfetch(token, `/v9/projects/${encodeURIComponent(name)}${q}`);
    if (existing?.id) {
      await vercelAllowPublicAccess(token, existing.id, teamId);
      return { id: existing.id, name: existing.name, created: false };
    }"""),

    # 3. creation asks for no protection in the first place
    ("""      installCommand: null,
      // `env` is not an accepted property here""",
     """      installCommand: null,
      ssoProtection: null,
      // `env` is not an accepted property here"""),

    # 4. and is unprotected again right after, which is the call that was verified
    ("""  if (!created?.id) throw new Error('ورسل شناسهٔ پروژه برنگرداند.');
  return { id: created.id, name: created.name || name, created: true };""",
     """  if (!created?.id) throw new Error('ورسل شناسهٔ پروژه برنگرداند.');
  await vercelAllowPublicAccess(token, created.id, teamId);
  return { id: created.id, name: created.name || name, created: true };"""),
]

for name in ('src/bridges.js', 'production/worker.js'):
    p = ROOT / name
    s = p.read_text(encoding='utf-8')
    for old, new in EDITS:
        n = s.count(old)
        if n != 1:
            raise SystemExit(f'{name}: expected 1 occurrence, found {n} for: {old[:70]!r}')
        s = s.replace(old, new, 1)
    if s.count('async function vercelAllowPublicAccess(') != 1:
        raise SystemExit(f'{name}: helper not defined exactly once')
    p.write_text(s, encoding='utf-8')
    print('patched', name)
