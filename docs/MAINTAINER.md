# Publishing the next release

[فارسی](MAINTAINER.fa.md)

```bash
npm run release:prepare -- 1.0.1
npm run test:all
git add .
git commit -m "release: 1.0.1"
git tag v1.0.1
git push origin main --tags
```

The preparation tool increments the public version and internal revision. The publish workflow tests, packages and hashes the build, synchronizes the central Worker and `RELEASES/current`, then publishes the GitHub release. Telegram's update action can then apply that version to the selected node.

Configure encrypted Actions secrets **`CF_API_TOKEN`** and **`CF_ACCOUNT_ID`** with appropriate Worker/KV permissions. The configured central Worker name is `omni`; review it for another installation. Rotate the Actions secret when rotating the Cloudflare token. Never commit credentials.

Private code/settings rollback copies are retained in the release namespace. Back up SQL separately. This pipeline does not enable automatic rollout to every customer account.
