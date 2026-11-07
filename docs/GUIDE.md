# Quick usage guide

[فارسی](GUIDE.fa.md) · [Home](../README.en.md)

## Profiles

Create an active user, select that user in Profiles, choose ingress, then set protocol, port and compatible client options. Copy a link/QR or import the user's subscription for ongoing updates. Connection address, Host and SNI are distinct: an alternative IP must not silently replace the service's valid Host/SNI. An IP pool is a candidate list, not a connectivity guarantee.

## Outbound & location

Ingress is where the client connects; outbound is how traffic leaves the panel. Select a prepared ingress and a trusted, owned exit. Measure available nodes, regenerate profiles and verify the public exit IP through the actual connection. Country labels, edge placement and Worker latency do not prove exit country or device performance.

## WARP Studio

Create or inspect the panel's WARP account, then select endpoint, IP family, DNS and output format. Import into a compatible WireGuard/client core. Start simple and change one setting at a time. Forced key replacement may invalidate older profiles. Profiles contain private keys; keep them secret and respect registration API limits.

## MASQUE Studio

1. Create the dedicated MASQUE key. It is independent of the WireGuard/WARP Studio device.
2. Choose the actual destination client; output formats are core-specific.
3. Start with an official endpoint and port 443. H2 uses TCP/TLS; H3 uses QUIC/UDP and depends on UDP reachability.
4. Select count, DNS and necessary client options, then copy/download.

Iran/China presets select routing rules, not a guaranteed exit country. Some alternative endpoints are third-party services. Enable fragment/noise/core-specific options only when supported. Forced renewal invalidates the previous key and requires new profiles. This is profile generation, not a general-purpose QUIC server inside the Worker.

## Other sections

| Section | Practical use |
|---|---|
| Dashboard | Inspect the overview, then open individual records for detail |
| Users | Quota, expiry, first-use activation, renewal, state and subscriptions |
| Relays | Optional owned Bot-Hosting/Arvan/Railway/Vercel infrastructure; validate provider support, quota and real traffic |
| Telegram proxy | Use the appropriate supported mode; web proxy, MTProto and VPN are not interchangeable |
| Causal Mesh | Configure and diagnose multi-node paths; verify every hop and the final path |
| Scanner | Test from the intended network; HTTP reachability is not a successful tunnel |
| DNS | Configure resolver options; DNS alone does not change egress IP |
| Diagnostics | Check reachability, TLS, user authorization, ingress and egress in order |
| Settings | Policies, panel naming and backup; global changes can affect every subscription |
| Sessions | Inspect active logins and revoke unfamiliar sessions |

## Telegram updates

Select the intended panel and use **Update/Repair**. The current bundle is installed in-place rather than creating a replacement database. Verify the displayed version and real client traffic. Back up SQL first. Installations with their own Telegram bot must have an authenticated webhook. [Migration](DEPLOY.md)
