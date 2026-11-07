# Panel source

| Path | Purpose |
|---|---|
| `src/worker.mjs` | Bundled backend template; build before deploying |
| `src/panel.html` | Editable dashboard; version comes from release metadata |
| `release.json` | Public version and increasing internal revision |
| `build.mjs` | Deterministic embedding, syntax validation and hashes |
| `test/` | Release, actual local runtime and browser checks |
| `build/` | Generated Worker, HTML and manifest |

Run commands from the repository root. Do not deploy the source template directly.

[Architecture](../docs/ARCHITECTURE.md) · [Deployment](../docs/DEPLOY.md)
