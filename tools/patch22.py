from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
wfile=root/'production/worker.js'; pfile=root/'production/panel.html'
w=wfile.read_text(); p=pfile.read_text()
def replace_once(text,old,new):
    assert text.count(old)==1,(text.count(old),old[:100])
    return text.replace(old,new,1)
# Shared code is embedded byte-for-byte at build time.
start=w.index('var VPS_AGENT_SH = '); end=w.index('\nvar EXP_DOMAINS = ',start)
w=w[:start]+'// VPS-PROFILES-BEGIN\n// VPS-PROFILES-END\n// VPS-VALIDATION-BEGIN\n'+(root/'tools/vps-validate.js').read_text()+'// VPS-VALIDATION-END\n// VPS-AGENT-BEGIN\nvar VPS_AGENT_SH = "";\n// VPS-AGENT-END\n'+w[end:]
w=replace_once(w,'    env.DB.prepare(`CREATE TABLE IF NOT EXISTS accounts(','''    env.DB.prepare(`CREATE TABLE IF NOT EXISTS vps_line_checks(
      node_id INTEGER NOT NULL, profile_key TEXT NOT NULL,
      verified_at TEXT NOT NULL, PRIMARY KEY(node_id,profile_key))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS accounts(''')
start=w.index('  if (p === "/api/vps" || p.startsWith("/api/vps/")) {')
end=w.index('  if (p === "/api/bridge" || p.startsWith("/api/bridge/")) {',start)
w=w[:start]+(root/'tools/vps-api.fragment.js').read_text()+w[end:]
start=w.index('    // v10: premium national-net nodes')
end=w.index('    const { body, contentType } = subscriptionBody',start)
w=w[:start]+'''    // v10.1: no candidate becomes a shutdown claim. Explicit user-line approval
    // is bound to the exact URI and installed UUID, not just an online heartbeat.
    try {
      const vn = await env.DB.prepare("SELECT id,ip,port,profiles FROM vps_nodes WHERE status='online'").all();
      const vc = await env.DB.prepare("SELECT node_id,profile_key FROM vps_line_checks").all();
      const keys = new Set((vc.results || []).map(c => c.node_id + "|" + c.profile_key));
      const v2box = (url.searchParams.get("type") || byUa) === "v2box";
      for (const row of vn.results || []) for (const pr of safeArray(JSON.parse(row.profiles || "[]"))) {
        if (String(pr.uuid || "").toLowerCase() !== String(view.uuid).toLowerCase()) continue;
        for (const spoof of (v2box ? [false,true] : [false])) {
          const uri = vpsUriOf(row,pr,spoof);
          if (uri && keys.has(row.id + "|" + vpsProofKey(row,pr,spoof))) relayUris.push(uri);
        }
      }
    } catch (e) { /* optional paid nodes have no effect on existing free routes */ }
'''+w[end:]
w=replace_once(w,'ua.includes("clash") || ua.includes("mihomo")', 'ua.includes("v2box") ? "v2box" : ua.includes("clash") || ua.includes("mihomo")')
w=replace_once(w,'if (t === "raw" || t === "plain") {','if (t === "raw" || t === "plain" || t === "v2box") {')
start=w.index('      if (url.pathname === "/vps-agent.sh") {')
end=w.index('      if (url.pathname === "/healthz") {',start)
w=w[:start]+'''      if (url.pathname === "/vps-agent.sh") {
        const join = String(url.searchParams.get("join") || "");
        if (!/^join_[a-f0-9]{18,64}$/.test(join)) return new Response("invalid join token", {status:400});
        return new Response(VPS_AGENT_SH.replace(/__API__/g, url.origin).replace(/__JOIN__/g, join), {
          headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"}
        });
      }
      if (url.pathname.startsWith("/api/vps/") && ["/api/vps/join","/api/vps/poll","/api/vps/report"].includes(url.pathname) && request.method === "POST") {
        await ensureSchema(env);
        const b = await request.json().catch(()=>({}));
        if (url.pathname === "/api/vps/join") {
          const row = await env.DB.prepare("SELECT id FROM vps_nodes WHERE join_token=? AND status='pending_join'").bind(String(b.join || "")).first();
          if (!row) return bad("invalid_join", "join token not found", 404);
          const token = "vps_"+crypto.randomUUID().replace(/-/g, "");
          const ip = vpsPublicIp(request.headers.get("cf-connecting-ip")) || vpsPublicIp(b.ip) || "";
          const result = await env.DB.prepare("UPDATE vps_nodes SET node_token=?,join_token=NULL,status='agent_ready',ip=?,last_seen=datetime('now') WHERE id=? AND status='pending_join'").bind(token,ip,row.id).run();
          if (result.meta?.changes !== 1) return bad("used_join", "join token already consumed", 409);
          return json({ok:true,token,connectivity_verified:false});
        }
        const node = await env.DB.prepare("SELECT id FROM vps_nodes WHERE node_token=?").bind(String(b.token || "")).first();
        if (!node) return bad("invalid_node", "invalid node token", 403);
        if (url.pathname === "/api/vps/poll") {
          // Atomically lease one job. v10.1 agents remember unacknowledged results.
          const tt = await env.DB.prepare("UPDATE vps_tasks SET state=1,result='running' WHERE id=(SELECT id FROM vps_tasks WHERE node_id=? AND (state=0 OR (state=1 AND created_at<datetime('now','-15 minutes'))) ORDER BY id LIMIT 1) RETURNING id,payload").bind(node.id).all();
          return json({ok:true,tasks:(tt.results || []).map(t=>({id:t.id,payload:JSON.parse(t.payload)}))});
        }
        const info = b.info && typeof b.info === "object" ? b.info : {};
        const active = b.status === "online" && info.xray_active === true;
        const profiles = active && Array.isArray(b.profiles) ? b.profiles.slice(0,8) : [];
        if (JSON.stringify(profiles).length>32768 || JSON.stringify(info).length>8192) return bad("too_large","report too large",413);
        await env.DB.prepare("UPDATE vps_nodes SET status=?,info=?,profiles=?,last_seen=datetime('now') WHERE id=?").bind(active ? "online" : "agent_ready",JSON.stringify(info),JSON.stringify(profiles),node.id).run();
        for (const id of (Array.isArray(b.done) ? b.done.slice(0,25) : [])) {
          const result = String((b.results || {})[id] || "no result").slice(0,1600);
          await env.DB.prepare("UPDATE vps_tasks SET state=?,result=? WHERE id=? AND node_id=?").bind(result.startsWith("error:") ? 3 : 2,result,Number(id),node.id).run();
        }
        return json({ok:true,connectivity_verified:false});
      }
'''+w[end:]
start=p.index('  function vpsUriOf('); end=p.index('  function NationalNetView(',start)
p=p[:start]+(root/'tools/vps-panel.fragment.js').read_text()+p[end:]
start=p.index('} else if (i === "omni-vps-create") {'); end=p.index('} else if (i === "omni-natnet-v2rayng") {',start)
actions=(root/'tools/vps-actions.fragment.js').read_text().rstrip()
assert actions.endswith('}')
p=p[:start]+actions[:-1]+p[end:]
p=replace_once(p,'💎 نت ملی پرو (پولی)','💎 VPS + CDN ایرانی (پولی)')
p=replace_once(p,'💎 نت ملی پرو — VPS ایرانی + دامنه (پولی)','💎 VPS + CDN ایرانی — پولی / نیازمند تست خط')
p=p.replace('بخش 💎 نت ملی پرو را ببین','بخش 💎 VPS + CDN ایرانی را ببین')
wfile.write_text(w);pfile.write_text(p)
print('v10.1 patch applied')
