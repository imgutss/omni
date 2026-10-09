"""Fix: `POST /v13/deployments` rejects `projectId` in the body.

Real answer from api.vercel.com with a valid hobby token:
  400 Invalid request: should NOT have additional property `projectId`.
  Please remove it.

The deployment is attached to the project through `name` (and `?teamId=` when the
account has a team), which is what the call already sends.

Applied to src/bridges.js (source of record) and to production/worker.js, where
the same module is embedded.

Run: python3 tools/patch14.py
"""
import pathlib

ROOT = pathlib.Path('/home/user/omni')

OLD = """      name: projectName,
      projectId: project.id,
      target: 'production',"""
NEW = """      name: projectName,
      // `projectId` is rejected here (400 "should NOT have additional property
      // `projectId`"); the deployment is bound to the project by `name`.
      target: 'production',"""

for name in ('src/bridges.js', 'production/worker.js'):
    p = ROOT / name
    s = p.read_text(encoding='utf-8')
    n = s.count(OLD)
    if n != 1:
        raise SystemExit(f'{name}: expected 1 occurrence, found {n}')
    p.write_text(s.replace(OLD, NEW, 1), encoding='utf-8')
    print('patched', name)
