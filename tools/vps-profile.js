// Shared by Worker and panel. Keep real TLS identity separate from client spoofing.
// A public site's name is not proof that it currently shares a CDN with this route.
function vpsUriOf(n, p, spoof = false) {
  if (!p || !p.uuid) return "";
  const addr = p.kind === "reality" ? n.ip : (p.address || p.domain);
  if (!addr) return "";
  const authority = String(addr).includes(":") && !String(addr).startsWith("[") ? "[" + addr + "]" : addr;
  const q = new URLSearchParams({ encryption: "none" });
  let title;
  if (p.kind === "reality" && p.pbk && !spoof) {
    Object.entries({security:"reality",type:"tcp",headerType:"none",flow:"xtls-rprx-vision",sni:p.sni,pbk:p.pbk,sid:p.sid || "",fp:"chrome"}).forEach(([k,v])=>q.set(k,v));
    title = "💎 VPS مستقیم — " + addr;
  } else if (p.kind === "ws" && p.domain) {
    // Address can be a shared CDN edge; the actual SNI and Host MUST stay ours.
    Object.entries({security:"tls",type:"ws",sni:p.domain,host:p.domain,path:p.path || "/vzn",alpn:"http/1.1",fp:"chrome",allowInsecure:"0",insecure:"0"}).forEach(([k,v])=>q.set(k,v));
    title = p.via_cdn ? "💎 CDN — " + p.domain : "💎 WS مستقیم — " + p.domain;
    if (spoof) {
      if (!p.fake_sni || !p.spoof_ip) return "";
      // The SpiderPanel URI extension. NOT a replacement for real TLS SNI.
      q.set("snispoofing", '{\n  "active" : true,\n  "fakeSni" : ' + JSON.stringify(p.fake_sni) + ',\n  "spoofIp" : ' + JSON.stringify(p.spoof_ip) + ',\n  "targetPort" : 0\n}');
      title = "🧪 V2Box Spoof — " + p.fake_sni;
    }
  } else return "";
  return "vless://" + p.uuid + "@" + authority + ":" + (p.kind === "reality" ? (p.port || 443) : 443) + "?" + q.toString() + "#" + encodeURIComponent(title);
}
function vpsProofKey(n, p, spoof = false) {
  return vpsUriOf(n, p, spoof).split("#")[0];
}
