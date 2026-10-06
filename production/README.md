# Production release: classic-restore-2026-10-06.3

## Canonical source

`production/worker.js` is the deployable self-contained Worker. `production/panel.html` is its editable frontend. The main and installed child had different production backends; each backend is preserved byte-for-byte outside its panel literal. The historical `src/` directory is not the production source. Do not deploy it over existing installations.

`node production/build.mjs` embeds the panel, checks JavaScript syntax and updates `deploy/omni-worker.bundle.js`. Building does not deploy or update the bot's KV bundle.

## Restored classic experience

The classic scanner view and preset lists were recovered from the October 4 historical panel, rather than replaced with a companion application:

- Network sensor, SIIT-Hex64/ECH list, direct panel RTT, direct mode and manual IP-pool rotation.
- Ingress/country tabs, IPv4/IPv6/both filters, six preset families, custom addresses/CIDRs, progress, compact results and explicit save.
- Country search, regions, full country grid and parallel country TCP checks with selectable responsive endpoints.
- Configuration source selection, custom addresses, IPv6 switch, port buttons, operator presets, ECH/cipher/FinalMask controls and country output selection.

## Actual fixes

- Browser requests are performed for selected ingress addresses. HTTPS errors remain errors; elapsed error time is never made into a green ping. Successful sample times are not scaled.
- Browser HTTPS success and Worker TCP response are separately labeled. The scanner does not fabricate an operator baseline or SIIT reachability.
- The country scanner reads `tcp_reachable`, not the unrelated legacy `alive` field, and saves the actual responsive endpoint.
- Scanning alone does not save settings. Fresh successful ingress results merge with existing addresses rather than replacing the pool. IPv4-only saves do not force IPv6.
- Busy controls are released on SIIT/network-sensor failures. Preset/family/tab controls lock during a scan.
- Manual rotation reorders the configured pool and preserves its addresses.
- Configuration port buttons now control generated ports instead of always emitting 443.
- Host/QoS/custom/site address selection and the IPv6 switch are honored independently of the operator preset.
- A selected saved ProxyIP is retained instead of silently substituting the first catalog address.
- Generated configurations survive the asynchronous view/user-list rerender that previously erased them.
- A late country-save response no longer forces navigation back to the scanner.

## Measurement scope

Browser HTTPS-to-IP is not a tunnel test using a separate intended SNI. A browser cannot independently choose a socket IP and TLS hostname; `no-cors` does not bypass TLS. A resolved opaque request is a connectivity observation, not proof of Cloudflare identity or a working VLESS/Trojan tunnel. Country TCP times measure Worker-to-server connectivity, not the phone's route or verified exit geography. Preset and SIIT lists are inputs to test, not guaranteed-working discoveries.

The restored interface retains these distinctions in short result labels and an optional explanation, without substituting a separate mobile application for the requested panel.

## Tests

```sh
npm --prefix production install
npm run test:scanner
npx --prefix production playwright install --with-deps chromium
npm run test:scanner:browser
npm run build:production
```

18 deterministic unit checks passed. The complete main and child panels each passed 16 mocked mobile-browser workflows (393 × 852 viewport), including success/error paths, save/merge, country selection, configuration ports/source/proxy, IPv6 and async output retention, with no uncaught JavaScript errors. Canonical production build and tests were also rerun successfully. Recorded main/child results are in `production/test/verified-*.json`.

Mock responses are explicitly not live carrier measurements. Live smoke checks cover served HTML hashes, login rendering, health/API readiness and preserved bindings, not every Telegram command or the user's carrier tunnel.

## Rollout safety

Scope is the main `omni`, installed `omni-ali`, and the bot's future install/update release. Deliberately configured previous/test Workers are excluded. No migration or direct change to users, passwords, stored configuration pools or webhook settings is required.

Stage both versions with existing bindings/secrets, guard against concurrent source changes, retain rollback version IDs, allow bounded edge propagation, and verify each served panel hash. Update `RELEASES` KV only after both pass. Publishing the install bundle does not automatically update other existing child Workers. No credentials belong in this repository.
