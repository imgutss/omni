  if (p === "/api/vps" || p.startsWith("/api/vps/")) {
    if (account.role !== "admin") return bad("forbidden", "مدیریت VPS فقط برای مدیر پنل است", 403);
    await ensureVpsSchema(env);
    const j = async () => await request.json().catch(() => ({}));
    if (method === "GET" && p === "/api/vps") {
      const rows = await env.DB.prepare("SELECT id,label,ip,port,status,last_seen,info,profiles,CASE WHEN status='pending_join' THEN join_token ELSE NULL END AS join_token FROM vps_nodes ORDER BY id DESC").all();
      const checks = await env.DB.prepare("SELECT node_id,profile_key,verified_at FROM vps_line_checks").all();
      const tasks = await env.DB.prepare("SELECT id,node_id,state,result,created_at FROM vps_tasks ORDER BY id DESC LIMIT 80").all();
      return json({ ok: true, nodes: (rows.results || []).map(n => ({...n,
        checks: (checks.results || []).filter(c => c.node_id === n.id),
        tasks: (tasks.results || []).filter(t => t.node_id === n.id).slice(0, 3)
      })) });
    }
    if (method === "POST" && p === "/api/vps/create") {
      const b = await j();
      const jt = "join_" + crypto.randomUUID().replace(/-/g, "");
      const r = await env.DB.prepare("INSERT INTO vps_nodes(owner,label,join_token) VALUES(?,?,?)").bind(String(account.username), String(b.label || "CDN origin").slice(0, 80), jt).run();
      return json({ ok: true, id: r.meta?.last_row_id, join_token: jt,
        install: `curl -fsSL 'https://${url.hostname}/vps-agent.sh?join=${jt}' -o /root/omni-vps-install.sh && bash /root/omni-vps-install.sh` });
    }
    if (method === "POST" && p === "/api/vps/task") {
      const b = await j();
      const node = await env.DB.prepare("SELECT id,status,profiles FROM vps_nodes WHERE id=?").bind(Number(b.node_id)).first();
      if (!node) return bad("not_found", "نود پیدا نشد", 404);
      if (node.status === "pending_join") return bad("not_joined", "اول ایجنت را روی VPS نصب کن", 409);
      let payload;
      try { payload = vpsTaskPayload(b.payload || {}); }
      catch (err) { return bad("invalid_config", err.message); }
      if (["reality", "ws"].includes(payload.kind)) {
        const u = payload.uuid
          ? await env.DB.prepare("SELECT uuid FROM users WHERE uuid=? AND is_active=1").bind(payload.uuid).first()
          : await env.DB.prepare("SELECT uuid FROM users WHERE is_active=1 ORDER BY id LIMIT 1").first();
        if (!u) return bad("no_user", "یک کاربر فعال برای کانفیگ انتخاب یا ایجاد کن");
        payload.uuid = u.uuid;
      }
      const pending = await env.DB.prepare("SELECT id FROM vps_tasks WHERE node_id=? AND state IN (0,1) LIMIT 1").bind(node.id).first();
      if (pending) return bad("task_pending", "یک دستور در حال اجراست؛ اول نتیجه‌اش را ببین", 409);
      const r = await env.DB.prepare("INSERT INTO vps_tasks(node_id,payload) VALUES(?,?)").bind(node.id, JSON.stringify(payload)).run();
      return json({ ok: true, task_id: r.meta?.last_row_id, state: "queued", connectivity_verified: false });
    }
    if (method === "POST" && p === "/api/vps/line-check") {
      const b = await j();
      const node = await env.DB.prepare("SELECT id,ip,profiles FROM vps_nodes WHERE id=?").bind(Number(b.node_id)).first();
      if (!node) return bad("not_found", "نود پیدا نشد", 404);
      const profiles = safeArray(JSON.parse(node.profiles || "[]"));
      const key = String(b.profile_key || "");
      if (!profiles.some(pr => vpsProofKey(node, pr) === key || (vpsUriOf(node, pr, true) && vpsProofKey(node, pr, true) === key)))
        return bad("stale_profile", "این کانفیگ تغییر کرده؛ صفحه را تازه کن", 409);
      if (b.confirmed === true) {
        await env.DB.prepare("INSERT INTO vps_line_checks(node_id,profile_key,verified_at) VALUES(?,?,datetime('now')) ON CONFLICT(node_id,profile_key) DO UPDATE SET verified_at=datetime('now')").bind(node.id,key).run();
      } else await env.DB.prepare("DELETE FROM vps_line_checks WHERE node_id=? AND profile_key=?").bind(node.id,key).run();
      return json({ ok: true, source: "user-reported-line-test", confirmed: b.confirmed === true });
    }
    if (method === "POST" && p === "/api/vps/remove") {
      const b = await j(), id = Number(b.node_id);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM vps_line_checks WHERE node_id=?").bind(id),
        env.DB.prepare("DELETE FROM vps_tasks WHERE node_id=?").bind(id),
        env.DB.prepare("DELETE FROM vps_nodes WHERE id=?").bind(id)
      ]);
      return json({ ok: true, note: "Node registration removed; this does not remotely uninstall its software." });
    }
    return bad("not_found", "مسیر پیدا نشد", 404);
  }
