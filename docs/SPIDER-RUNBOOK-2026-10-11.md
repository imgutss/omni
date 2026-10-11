# Spider route runbook (verified path, 2026-10-11)

Purpose: reproduce the working route phone -> Arvan CDN -> Railway origin (SpiderPanel) -> Internet.
Secrets (panel password, API keys, Cloudflare tokens) are NOT in this file. Keep them in private notes only.

## Status at time of writing

| Step | Result |
|---|---|
| Domain on Arvan (NS = o/k.ns.arvancdn.ir) | Done, status "فعال" |
| Railway service deployed from GitHub (SpiderPanel) | Done, status Active |
| Railway custom domain `drsarli.ir` (port 8080) | Done, login page loads over HTTPS |
| Arvan `@` record: ANAME -> `h31kw6jf.up.railway.app`, Host header `drsarli.ir`, cloud OFF | Done |
| Panel login from phone, no VPN | Confirmed by user (screenshot) |
| V2Box ping from phone, no VPN | Confirmed by user (ping shown in V2Box) |
| Arvan cloud toggle for `@` record | OFF. This is the working config per the user. Keep it OFF. |

## Steps (in order)

1. **Arvan domain**: add the domain in the CDN panel, switch its NS at the registrar to the two Arvan NS only.
   Remove Cloudflare NS at the same time; mixed NS was observed to be risky.
2. **Railway service**: New Project -> Deploy from GitHub repo (`amirh00sain/SpiderPanel`). Builder Dockerfile, port 8080.
3. **Railway custom domain**: Settings -> Networking -> Custom Domain -> `drsarli.ir`, port 8080.
   Railway returns a CNAME target (`*.up.railway.app`) and a TXT verification record.
4. **Arvan DNS**:
   - Type `ANAME` (CNAME-like at root), name `@`, value = Railway CNAME target.
   - Host header = `drsarli.ir` (so Railway routes the request to the custom domain).
   - Add the TXT verification record that Railway shows (name starts with `_railway`).
   - Cloud service toggle: OFF during initial test, ON for the CDN test.
5. **Arvan origin protocol**: CDN -> "ارتباط با سرورهای اصلی" -> protocol HTTPS.
6. **Login**: open `https://drsarli.ir/login`. Change the default panel password at once.
7. **Inbound**: use the default `TLS + WS` inbound (VLESS over WS over TLS, same domain).
8. **User**: create a user with only the `TLS + WS` inbound enabled; take the Subscription link or QR.
9. **Client test**: V2Box, VPN OFF. Check ping and a real page load. Record a screenshot.

## Notes

- Panel loading over HTTPS does not prove that proxy traffic works. Only a connected client with a real page load does.
- Railway custom domains need a CNAME target. An ANAME at the Arvan root is what made the root domain work here.
- While cloud is OFF, the client path is phone -> Arvan DNS answer -> Railway. It is not through the Arvan CDN edge.
- Free Railway trial limits apply. Check usage in the Railway dashboard.
