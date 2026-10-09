import pathlib, sys, re

B = pathlib.Path('/home/user/omni/src/bridges.js')
s = B.read_text(encoding='utf-8')

OLD_FN_START = 'export function netlifyEdgeFunction(target) {'
OLD_FN_END = 'export function netlifyFiles(target, tunnelPath) {'
i = -1 if 'xhttp-stream-one' in s else s.index(OLD_FN_START)
j = s.index(OLD_FN_END)
NEW_FN = '''export function netlifyEdgeFunction(target, tunnelPath) {
  const clean = String(target || '').replace(/^https?:\\/\\//, '').replace(/\\/+$/, '');
  let tp = String(tunnelPath || '/').trim().split('?')[0];
  if (!tp || tp === '/') tp = '/VZLdh9Ft';
  if (!tp.startsWith('/')) tp = '/' + tp;
  return `// netlify/edge-functions/relay.js — Omni Netlify Edge relay v2 (Deno)
// xhttp stream-one (فرمت قدیمی Parsashonam: SNI-front + xhttp) ⇄ WebSocket pipe + HTTP mirror
const TARGET_BASE = (Netlify.env.get("BACKEND_URL") || "https://${clean}").replace(/\\\\/$/, "");
const TUNNEL = ${JSON.stringify(tp)};
const WS_TARGET = TARGET_BASE.replace("https://", "wss://") + TUNNEL + "?ed=2048";

const STRIP = new Set([
  "host", "keep-alive", "proxy-authenticate", "proxy-authorization", "te",
  "trailer", "transfer-encoding", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port",
]);

export default async function handler(request, context) {
  const url = new URL(request.url);
  if (url.pathname === "/" || url.pathname === "/__bridge") return context.next();
  if (!TARGET_BASE) return new Response("misconfigured: BACKEND_URL", { status: 500 });

  // xhttp stream-one: the POST body IS the client byte-stream; the response body
  // is the downstream. Pipe both ends over one WebSocket to the panel worker.
  if (request.method === "POST" && url.pathname.indexOf(TUNNEL) === 0 && request.body) {
    const ws = new WebSocket(WS_TARGET);
    ws.binaryType = "arraybuffer";
    const ts = new TransformStream();
    const writer = ts.writable.getWriter();
    const opened = new Promise((res) => {
      ws.onopen = () => res(true);
      ws.onerror = () => res(false);
      ws.onclose = () => res(false);
    });
    ws.onmessage = (ev) => { writer.write(new Uint8Array(ev.data)).catch(() => {}); };
    ws.onclose = () => { writer.close().catch(() => {}); };
    ws.onerror = () => { writer.close().catch(() => {}); };
    const pump = async () => {
      const ok = await opened;
      if (!ok) { try { writer.close(); } catch (e) {} return; }
      const reader = request.body.getReader();
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if (ws.readyState === 1) ws.send(chunk.value);
      }
    };
    pump().catch(() => {});
    return new Response(ts.readable, {
      status: 200,
      headers: { "content-type": "application/octet-stream", "x-omni-relay": "xhttp-stream-one" },
    });
  }

  // plain HTTP mirror (browser access when the panel domain is filtered)
  const headers = new Headers();
  let clientIp = null;
  for (const [key, value] of request.headers) {
    const k = key.toLowerCase();
    if (STRIP.has(k)) continue;
    if (k.startsWith("x-nf-") || k.startsWith("x-netlify-")) continue;
    if (k === "x-real-ip") { clientIp = value; continue; }
    if (k === "x-forwarded-for") { if (!clientIp) clientIp = value; continue; }
    headers.set(k, value);
  }
  headers.set("host", new URL(TARGET_BASE).host);
  if (clientIp) headers.set("x-forwarded-for", clientIp);
  headers.set("x-relay-layer", "netlify-omni");

  const method = request.method;
  const init = { method, headers, redirect: "manual" };
  if (method !== "GET" && method !== "HEAD") init.body = request.body;

  try {
    const upstream = await fetch(TARGET_BASE + url.pathname + url.search, init);
    const out = new Headers();
    for (const [key, value] of upstream.headers) {
      if (key.toLowerCase() === "transfer-encoding") continue;
      out.set(key, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: out });
  } catch (e) {
    return new Response("bad gateway: " + (e && e.message ? e.message : "relay"), { status: 502 });
  }
}

export const config = { path: "/*", excludedPath: ["/", "/index.html", "/favicon.ico"] };
`;
}

'''
if i >= 0:
    s = s[:i] + NEW_FN + s[j:]
    s = s.replace("data: netlifyEdgeFunction(clean) },", "data: netlifyEdgeFunction(clean, tunnelPath) },", 1)
    B.write_text(s, encoding='utf-8')
    print('bridges.js netlifyEdgeFunction → v2')
else:
    print('bridges.js already v2 — skip')

P = pathlib.Path('/home/user/omni/production/panel.html')
p = P.read_text(encoding='utf-8')

# 1) display-copy of the edge function → same v2 source (span replace)
a = p.index('function natnetNetlifyEdgeFunction(host) {')
b = p.index('\n};\n', a + 40)
NEW_PANEL_FN = '''function natnetNetlifyEdgeFunction(host) {
    let clean = (host || "").trim().replace(/^https?:\\/\\//, "").replace(/\\/+$/, "");
    let tp = natnetTunnelPath();
    return `// netlify/edge-functions/relay.js — Omni Netlify Edge relay v2 (Deno)
// xhttp stream-one (فرمت قدیمی: SNI-front + xhttp) ⇄ WebSocket pipe + HTTP mirror
const TARGET_BASE = (Netlify.env.get("BACKEND_URL") || "https://${clean}").replace(/\\\\/$/, "");
const TUNNEL = ${JSON.stringify(tp)};
const WS_TARGET = TARGET_BASE.replace("https://", "wss://") + TUNNEL + "?ed=2048";
export default async function handler(request, context) {
  const url = new URL(request.url);
  if (url.pathname === "/" || url.pathname === "/__bridge") return context.next();
  if (request.method === "POST" && url.pathname.indexOf(TUNNEL) === 0 && request.body) {
    const ws = new WebSocket(WS_TARGET);
    ws.binaryType = "arraybuffer";
    const ts = new TransformStream();
    const writer = ts.writable.getWriter();
    const opened = new Promise((res) => { ws.onopen = () => res(true); ws.onerror = () => res(false); ws.onclose = () => res(false); });
    ws.onmessage = (ev) => { writer.write(new Uint8Array(ev.data)).catch(() => {}); };
    ws.onclose = () => writer.close().catch(() => {});
    ws.onerror = () => writer.close().catch(() => {});
    const pump = async () => {
      const ok = await opened;
      if (!ok) { try { writer.close(); } catch (e) {} return; }
      const reader = request.body.getReader();
      for (;;) { const c = await reader.read(); if (c.done) break; if (ws.readyState === 1) ws.send(c.value); }
    };
    pump().catch(() => {});
    return new Response(ts.readable, { status: 200, headers: { "content-type": "application/octet-stream", "x-omni-relay": "xhttp-stream-one" } });
  }
  return new Response("Omni mirror - Netlify relay v2 alive", { status: 200 });
}
export const config = { path: "/*", excludedPath: ["/", "/index.html", "/favicon.ico"] };
`;
}
'''
p = p[:a] + NEW_PANEL_FN + p[b+1:]

# 2) old-format config card in the NETLIFY branch
marker = '    <!-- ================= NETLIFY PLATFORM ================= -->'
assert p.count(marker) == 1
CARD = marker + '''
    <div class="card" style="margin-top:12px;border-inline-start:3px solid #00c7b7">
      <div class="card-head">
        <b style="color:#00c7b7;font-size:14px">⚡ فرمت قدیمی (SNI-front + xhttp) — پینگ واقعی، دقیقاً مثل شش ماه پیش</b>
        <div class="spacer"></div>
      </div>
      <p class="muted" style="font-size:12.5px;line-height:1.9;margin:6px 0 10px">
        راز فرمت قدیمی: دامنه‌های <code dir="ltr">blog.helm.sh</code> و <code dir="ltr">kubernetes.io</code> روی لبهٔ
        <b>نتلیفای</b> هستند و SNIشان در ایران سفید است. کلاینت با SNI آن‌ها وصل می‌شود، هدر Host
        دامنهٔ پل نتلیفای توست وedge function رلهٔ v2 (xhttp stream-one ⇄ WS) ترافیک را رد می‌کند.
        <b>شرط کار:</b> اول پل نتلیفای را با کد جدید «♻️ دیپلوی دوباره» بزن (توکن را در کادر بالا بچسبان).
      </p>
      ${(() => {
        const nb = (natnetBridges || []).find((r) => r.platform === "netlify" && r.status === "ready" && r.domain);
        if (!nb) return `<div class="badge warn">اول یک پل نتلیفای آماده بساز (تب بالا)</div>`;
        const fronts = [["blog.helm.sh", "helm blog · SNI سفید"], ["kubernetes.io", "k8s docs · SNI سفید"]];
        const mk = (addr, sni, name) =>
          `vless://${uuid}@${addr}:443?encryption=none&security=tls&sni=${sni}&alpn=h2,http/1.1&insecure=0&allowInsecure=0&type=xhttp&mode=stream-one&host=${nb.domain}&path=${encodeURIComponent(xhttpPath)}&fp=chrome#${encodeURIComponent("🇮🇷 " + name)}`;
        const rows = [
          ...fronts.map((f) => mk(f[0], f[0], "SNI-front " + f[0] + " (فرمت قدیمی)")),
          mk(nb.domain, nb.domain, "Netlify مستقیم " + nb.domain),
        ];
        return `<div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map((u) => `<div class="codebox" style="font-size:11px;word-break:break-all" dir="ltr">${a(u)}</div>${te(u)}`).join("")}
        </div>
        <div class="muted" style="font-size:12px;margin-top:8px">mode=stream-one · host=${a(nb.domain)} · بعد از دیپلوی دوبارهٔ پل، «Test real delay» پینگ واقعی می‌دهد.</div>`;
      })()}
    </div>
'''
p = p.replace(marker, CARD, 1)
P.write_text(p, encoding='utf-8')
print('panel: relay v2 display + old-format card')
