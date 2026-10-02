/* demo API — answers /api/* when no backend is reachable */
/**
 * demo-api.js — in-browser mock of the Kaveh Worker API.
 *
 * Bundled into the single-file HTML build (scripts/make-singlefile.mjs).
 * It wraps window.fetch: any same-origin /api/* call is answered from local
 * demo state whenever the real backend is unreachable (file://, static host,
 * sandboxed preview). Deployed on the Worker, the real API answers first and
 * this shim never fires.
 */
(() => {
  const realFetch = window.fetch.bind(window);
  const DAY = 86400000, GB = 1024 ** 3;
  const now = Date.now();

  function rnd(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
  const R = rnd(20260913);
  function hex(n) { let s = ""; const c = "0123456789abcdef"; for (let i = 0; i < n; i++) s += c[Math.floor(R() * 16)]; return s; }

  const NAMES = ["ali","sara","reza","maryam","hossein","zahra","amir","narges","mehdi","fateme","saeed","leila","omid","shirin","kaveh","dana","arash","roja","behnam","sanaz","farhad","ghazal","hamid","yasmin","iman","taraneh","javad","elham","kian","mehrane","navid","parisa","ramin","setare","taha","vida","yaser","ziba","babak","catayoun"];
  const IPS = ["104.16.0.0","104.17.0.0","104.18.0.0","172.66.0.0","188.114.96.0","104.20.0.0","172.67.0.0","141.101.120.0"];
  const PRESETS = ["", "mci", "irancell", "rightel", "tci", "aggressive"];
  const FPS = ["", "chrome", "safari", "ios", "android", "randomized"];

  const users = NAMES.map((name, i) => {
    const quota = [10, 25, 50, 100, 200][Math.floor(R() * 5)];
    const usedPct = Math.pow(R(), 1.6);
    const days = [7, 14, 30, 60, 90][Math.floor(R() * 5)];
    const createdAt = now - Math.floor(R() * 120) * DAY;
    const active = R() > 0.08;
    const firstConnect = R() > 0.5;
    const roll = R();
    let expiresAt;
    if (!firstConnect) expiresAt = null;
    else if (roll < 0.7) expiresAt = now + Math.floor((2 + R() * days) * DAY);
    else if (roll < 0.82) expiresAt = now + Math.floor(R() * 2 * DAY);
    else expiresAt = now - Math.floor((1 + R() * 6) * DAY);
    return {
      id: i + 1, username: `${name}-${100 + i}`, uuid: crypto.randomUUID(), sub_token: hex(32),
      quota_gb: quota, used_bytes: Math.floor(quota * GB * Math.min(1.02, usedPct)), expiry_days: days,
      first_connect: firstConnect ? 1 : 0, activated_at: expiresAt ? createdAt + DAY : null, expires_at: expiresAt,
      device_limit: [1, 2, 3, 5][Math.floor(R() * 4)], request_limit: 0, requests_used: Math.floor(R() * 4000),
      ips: JSON.stringify(IPS.slice(0, 1 + Math.floor(R() * 3))), proxies: "[]", connection: "ws", tls: "on",
      fragment: PRESETS[Math.floor(R() * PRESETS.length)], fingerprint: FPS[Math.floor(R() * FPS.length)],
      block_list: "[]", is_active: active ? 1 : 0, created_by: "admin", note: "",
      created_at: createdAt, updated_at: createdAt + Math.floor(R() * 10) * DAY,
    };
  });

  const settings = {
    schema_version: "1", panel_name: "Kaveh", public_host: "kaveh.example.workers.dev", port: "443",
    fragment_preset: "mci", fingerprint: "chrome", clean_ips: JSON.stringify(IPS.slice(0, 4)), ip_pool: JSON.stringify(IPS),
    auto_rotate: "1", rotate_minutes: "30", mux_enabled: "0", public_signup: "1", signup_max_per_ip: "3",
    block_nsfw: "1", block_ads: "1", remark_prefix: "Kaveh", default_quota_gb: "50", default_expiry_days: "30",
    status_page_enabled: "1", maintenance: "0", on_expiry: "disable",
  };

  const series = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * DAY).toISOString().slice(0, 10);
    const base = 18 + Math.sin(i / 1.7) * 7 + R() * 9;
    return { day: d, down: Math.floor(base * GB), up: Math.floor(base * GB * 0.11), conns: Math.floor(base * 240) };
  });

  const usageByUsername = Object.fromEntries(users.map((u) => [u.username, Array.from({ length: 14 }, (_, i) => {
    const day = new Date(now - (13 - i) * DAY).toISOString().slice(0, 10);
    const v = R() * u.quota_gb * GB * 0.03;
    return { day, down_bytes: Math.floor(v), up_bytes: Math.floor(v * 0.1), conns: Math.floor(R() * 90) };
  })]));

  const audit = [
    { action: "login", actor: "admin" },
    { action: "user.create", actor: "admin", target: users[3].username },
    { action: "settings.update", actor: "admin", detail: { keys: ["clean_ips"] } },
    { action: "user.bulk.reset_traffic", actor: "admin", detail: { n: 12 } },
    { action: "user.delete", actor: "admin", target: "test-99" },
    { action: "backup.export", actor: "admin" },
    { action: "login_failed", actor: "unknown" },
    { action: "user.rotate_sub", actor: "admin", target: users[9].username },
  ].map((e, i) => ({ id: 100 - i, at: now - i * 3600_000 * (1 + R() * 5), ip_hash: hex(16), detail: e.detail ? JSON.stringify(e.detail) : null, ...e }));

  let sessions = [
    { id: hex(16), subject: "admin", role: "owner", created_at: now - 3600_000 * 2, expires_at: now + 3600_000 * 10, ip_hash: hex(16), ua_hash: hex(16) },
    { id: hex(16), subject: "admin", role: "owner", created_at: now - DAY, expires_at: now + 3600_000 * 6, ip_hash: hex(16), ua_hash: hex(16) },
  ];
  let installed = true;
  const PASSWORD = "kaveh1234567";

  const log = (actor, action, target = null, detail = null) =>
    audit.unshift({ id: audit.length + 101, at: Date.now(), actor, action, target, ip_hash: hex(16), detail: detail ? JSON.stringify(detail) : null });

  function hydrate(u) {
    const quotaBytes = Math.round(u.quota_gb * GB);
    const expired = u.expires_at != null && u.expires_at <= Date.now();
    return {
      ...u,
      ips: JSON.parse(u.ips || "[]"), proxies: JSON.parse(u.proxies || "[]"), block_list: JSON.parse(u.block_list || "[]"),
      is_active: !!u.is_active, first_connect: !!u.first_connect,
      quota_bytes: quotaBytes,
      used_pct: quotaBytes ? Math.min(100, Math.round((u.used_bytes / quotaBytes) * 1000) / 10) : 0,
      status: !u.is_active ? "disabled" : expired ? "expired" : u.used_bytes >= quotaBytes ? "exhausted" : "active",
      ms_left: u.expires_at ? Math.max(0, u.expires_at - Date.now()) : null,
    };
  }

  function buildConfigs(user) {
    const host = settings.public_host || "kaveh.example.workers.dev";
    const port = Number(settings.port || 443);
    const ips = JSON.parse(user.ips || "[]");
    const pool = ips.length ? ips : JSON.parse(settings.clean_ips || "[]");
    const frag = user.fragment || settings.fragment_preset || "";
    const fp = user.fingerprint || settings.fingerprint || "";
    const items = (pool.length ? pool : [host]).slice(0, 8).map((ip, i) => ({
      uuid: user.uuid, host, address: ip, port, path: `/${user.uuid}`, fingerprint: fp,
      remark: pool.length > 1 ? `${settings.remark_prefix || host}#${i + 1}` : settings.remark_prefix || host,
    }));
    const uris = items.map((it) => {
      const q = new URLSearchParams({ encryption: "none", security: "tls", type: "ws", host: it.host, sni: it.host, alpn: "http/1.1", path: it.path });
      if (fp) q.set("fp", fp);
      if (frag && frag !== "none") { q.set("fragment", "100-200"); q.set("fragmentPackets", "tlshello"); }
      return `vless://${it.uuid}@${it.address}:${it.port}?${q.toString()}#${encodeURIComponent(it.remark)}`;
    });
    const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
    return { host, port, items, uris, vless: uris, base64: b64(uris.join("\n")), qr: uris[0] || "" };
  }

  const J = (obj, status = 200) => new Response(JSON.stringify({ ok: true, ...obj }), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  const JE = (status, code, error) => new Response(JSON.stringify({ ok: false, code, error }), { status, headers: { "content-type": "application/json; charset=utf-8" } });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const b64dec = (s) => decodeURIComponent(escape(atob(s)));

  async function demoApi(pathname, method, url, bodyRaw) {
    const q = url.searchParams;
    let b = {};
    try { b = bodyRaw ? JSON.parse(bodyRaw) : {}; } catch { b = {}; }
    const who = "admin";
    const p = pathname;

    if (p === "/api/whoami") return { username: installed ? who : null, role: "owner", installed, panelName: settings.panel_name, signup: settings.public_signup === "1", version: "0.1.0" };

    if (p === "/api/signup" && method === "POST") {
      if (settings.public_signup !== "1") throw [403, "forbidden", "ثبت‌نام عمومی روی این پنل بسته است"];
      await sleep(400);
      const uname = "u-" + Math.random().toString(36).slice(2, 8);
      const token = crypto.randomUUID();
      users.unshift({ id: users.length + 1, username: uname, uuid: crypto.randomUUID(), sub_token: token, quota_gb: Number(settings.default_quota_gb || 5), used_bytes: 0, expiry_days: Number(settings.default_expiry_days || 30), first_connect: 1, activated_at: null, expires_at: null, device_limit: 3, request_limit: 0, requests_used: 0, ips: "[]", proxies: "[]", connection: "ws", tls: "on", fragment: "", fingerprint: "", block_list: "[]", is_active: 1, created_by: "signup", note: "self-signup", created_at: Date.now(), updated_at: Date.now() });
      log(uname, "signup");
      const host = settings.public_host || location.host || "panel.example";
      return { username: uname, quota_gb: Number(settings.default_quota_gb || 5), expiry_days: Number(settings.default_expiry_days || 30), sub_url: `https://${host}/s/${token}`, status_url: `https://${host}/status/${token}` };
    }

    if (p === "/api/login" && method === "POST") {
      if (b.password !== PASSWORD) throw [401, "unauthorized", "رمز عبور اشتباه است"];
      log(who, "login");
      return { username: who, role: "owner" };
    }
    if (p === "/api/setup" && method === "POST") { installed = true; return { username: who }; }
    if (p === "/api/logout" && method === "POST") return {};
    if (p === "/api/recover" && method === "POST") return {};
    if (p === "/api/password" && method === "POST") { log(who, "change_password"); return {}; }

    if (p === "/api/overview") {
      const total = users.length;
      const active = users.filter((u) => u.is_active).length;
      const expired = users.filter((u) => u.expires_at && u.expires_at <= Date.now()).length;
      const used = users.reduce((a, u) => a + u.used_bytes, 0);
      const requests = users.reduce((a, u) => a + u.requests_used, 0);
      return {
        users: { total, active, expired, used_bytes: used, requests },
        cloudflare: { available: true, total: 1_840_000, daily: 62_400, limit: 100_000, pct: 62.4 },
        series,
        top: [...users].sort((a, b) => b.used_bytes - a.used_bytes).slice(0, 8).map((u) => ({ username: u.username, used_bytes: u.used_bytes, quota_gb: u.quota_gb, requests_used: u.requests_used })),
        settings: { panelName: settings.panel_name, publicHost: settings.public_host },
      };
    }

    if (p === "/api/users" && method === "GET") {
      const search = (q.get("q") || "").toLowerCase();
      const status = q.get("status") || "all";
      const sort = q.get("sort") || "created_at";
      const dir = q.get("dir") || "desc";
      const page = Math.max(1, Number(q.get("page") || 1));
      const size = Math.min(200, Number(q.get("size") || 25));
      let list = users.map(hydrate);
      if (search) list = list.filter((u) => [u.username, u.note, u.uuid].some((f) => String(f).toLowerCase().includes(search)));
      if (status !== "all") list = list.filter((u) => u.status === status);
      list.sort((a, b) => {
        const av = a[sort] ?? 0, bv = b[sort] ?? 0;
        const c = typeof av === "string" ? av.localeCompare(bv) : av - bv;
        return dir === "asc" ? c : -c;
      });
      return { users: list.slice((page - 1) * size, page * size), total: list.length, page, size, pages: Math.ceil(list.length / size) };
    }

    if (p === "/api/users" && method === "POST") {
      if (!b.username) throw [400, "bad_request", "نام کاربری لازم است"];
      if (users.some((u) => u.username === b.username)) throw [409, "conflict", `کاربر «${b.username}» از قبل وجود دارد`];
      const u = {
        id: users.length + 1, username: b.username, uuid: crypto.randomUUID(), sub_token: hex(32),
        quota_gb: Number(b.quota_gb || 50), used_bytes: 0, expiry_days: Number(b.expiry_days || 30),
        first_connect: b.first_connect === false ? 0 : 1, activated_at: null,
        expires_at: b.first_connect === false ? Date.now() + Number(b.expiry_days || 30) * DAY : null,
        device_limit: Number(b.device_limit || 3), request_limit: Number(b.request_limit || 0), requests_used: 0,
        ips: JSON.stringify(b.ips || []), proxies: JSON.stringify(b.proxies || []), connection: "ws", tls: "on",
        fragment: b.fragment || "", fingerprint: b.fingerprint || "", block_list: JSON.stringify(b.block_list || []),
        is_active: b.is_active === false ? 0 : 1, created_by: who, note: b.note || "", created_at: Date.now(), updated_at: Date.now(),
      };
      users.unshift(u);
      log(who, "user.create", u.username);
      return { user: hydrate(u), configs: buildConfigs(u) };
    }

    if (p === "/api/users/bulk" && method === "POST") {
      const set = new Set(b.usernames || []);
      let affected = 0;
      if (b.op === "delete") {
        for (let i = users.length - 1; i >= 0; i--) if (set.has(users[i].username)) { users.splice(i, 1); affected++; }
      } else {
        for (const u of users) {
          if (!set.has(u.username)) continue;
          affected++;
          if (b.op === "enable") u.is_active = 1;
          if (b.op === "disable") u.is_active = 0;
          if (b.op === "reset_traffic") u.used_bytes = 0;
          if (b.op === "reset_requests") u.requests_used = 0;
          if (b.op === "extend") u.expires_at = (u.expires_at || Date.now()) + Number(b.value || 30) * DAY;
          u.updated_at = Date.now();
        }
      }
      log(who, `user.bulk.${b.op}`, null, { n: affected });
      return { affected, op: b.op };
    }

    const um = /^\/api\/users\/([^/]+)(?:\/([\w-]+))?$/.exec(p);
    if (um) {
      const name = decodeURIComponent(um[1]);
      const sub = um[2];
      const idx = users.findIndex((u) => u.username === name);
      if (idx < 0) throw [404, "not_found", "user not found"];
      const u = users[idx];
      if (!sub && method === "GET") return { user: hydrate(u), configs: buildConfigs(u) };
      if (!sub && method === "PATCH") {
        Object.assign(u, {
          ...b,
          ips: b.ips ? JSON.stringify(b.ips) : u.ips,
          proxies: b.proxies ? JSON.stringify(b.proxies) : u.proxies,
          block_list: b.block_list ? JSON.stringify(b.block_list) : u.block_list,
          is_active: b.is_active === undefined ? u.is_active : b.is_active ? 1 : 0,
          first_connect: b.first_connect === undefined ? u.first_connect : b.first_connect ? 1 : 0,
          updated_at: Date.now(),
        });
        if (b.expiry_days) u.expires_at = Date.now() + Number(b.expiry_days) * DAY;
        log(who, "user.update", name, { keys: Object.keys(b) });
        return { user: hydrate(u), configs: buildConfigs(u) };
      }
      if (!sub && method === "DELETE") { users.splice(idx, 1); log(who, "user.delete", name); return {}; }
      if (sub === "reset") { u.used_bytes = 0; u.requests_used = 0; log(who, "user.reset", name); return { user: hydrate(u) }; }
      if (sub === "rotate-token") { u.sub_token = hex(32); log(who, "user.rotate_sub", name); return { sub_token: u.sub_token }; }
      if (sub === "rotate-uuid") { u.uuid = crypto.randomUUID(); log(who, "user.rotate_uuid", name); return { uuid: u.uuid }; }
    }

    if (p === "/api/stats/usage") {
      const name = q.get("username");
      return { username: name, series: usageByUsername[name] || [] };
    }

    if (p === "/api/settings" && method === "GET") return { settings: { ...settings } };
    if (p === "/api/settings" && method === "PUT") {
      for (const [k, v] of Object.entries(b)) settings[k] = typeof v === "string" ? v : JSON.stringify(v);
      log(who, "settings.update", null, { keys: Object.keys(b) });
      return { settings };
    }

    if (p === "/api/backup" && method === "GET") {
      return new Response(JSON.stringify({ format: "kaveh-backup", version: 1, exported_at: new Date().toISOString(), users, settings, plans: [], nodes: [] }, null, 2), { headers: { "content-type": "application/json", "content-disposition": "attachment; filename=kaveh-backup.json" } });
    }
    if (p === "/api/backup" && method === "POST") return { imported: (b.users || []).length, mode: b.mode || "replace" };

    if (p === "/api/fragments") {
      return {
        presets: [
          { id: "none", label: "بدون فرگمنت" }, { id: "mci", label: "همراه اول (MCI)" }, { id: "irancell", label: "ایرانسل" },
          { id: "rightel", label: "رایتل" }, { id: "tci", label: "مخابرات (TCI)" }, { id: "aggressive", label: "حالت تهاجمی" },
        ],
        fingerprints: ["chrome", "safari", "ios", "android", "edge", "firefox", "randomized"],
        tlsPorts: [443, 2053, 2083, 2087, 2096, 8443], httpPorts: [80, 8080, 8880, 2052, 2082, 2086, 2095],
      };
    }

    if (p === "/api/diag/cf-usage") return { available: true, daily: 62400, total: 1840000, limit: 100000, pct: 62.4 };
    if (p === "/api/diag/probe-node" && method === "POST") {
      await sleep(700);
      const good = (b.proxy || "").split(".").length === 4 || (b.proxy || "").includes(host());
      return good ? { spec: b.proxy, ok: true, latencyMs: 120 + Math.floor(Math.random() * 180) } : { spec: b.proxy, ok: false, latencyMs: 3000, error: "connection refused" };
    }
    if (p === "/api/diag/rank-ips" && method === "POST") {
      await sleep(900);
      const ips = (b.ips || []).filter(() => Math.random() > 0.25);
      return { total: (b.ips || []).length, healthy: ips.length, ips };
    }
    if (p === "/api/diag/ping") {
      await sleep(800);
      const s = [1, 2, 3].map(() => ({ ms: 18 + Math.floor(Math.random() * 40), status: 200 }));
      return { target: q.get("target"), samples: s, colo: "FRA", country: "DE", avg: Math.round(s.reduce((a, x) => a + x.ms, 0) / 3), loss: "0/3" };
    }
    if (p === "/api/diag/logs") return { entries: audit.slice(0, Number(q.get("limit") || 50)) };
    if (p === "/api/diag/maintenance" && method === "POST") {
      await sleep(260);
      const expired = users.filter((u) => u.expires_at && u.expires_at < Date.now()).length;
      log("admin", "maintenance.manual");
      return { expired_handled: expired, policy: settings.on_expiry || "disable", ips_rotated: 0, sessions_purged: 1, ms: 240 + Math.floor(Math.random() * 40) };
    }
    if (p === "/api/diag/unban" && method === "POST") {
      const ip = b.ip || "203.0.113.7";
      log("admin", "guard.unban", ip);
      return { ip, ok: true, unbanned: `login:${ip}` };
    }

    if (p === "/api/sessions" && method === "GET") return { sessions };
    if (p === "/api/sessions/revoke" && method === "POST") {
      sessions = b.all ? [] : sessions.filter((s) => s.id !== b.id);
      log(who, "revoke_session", null, { all: !!b.all });
      return {};
    }

    throw [404, "not_found", `demo API: ${method} ${p} پیاده‌سازی نشده`];
  }

  function host() { return settings.public_host || "kaveh.example.workers.dev"; }

  window.fetch = async (input, init) => {
    // Path-first: relative /api/* calls must be handled even when the document
    // base is opaque (about:srcdoc in sandboxed previews, file://, …) where
    // `new URL(path, location.href)` itself throws.
    let urlStr = typeof input === "string" ? input : (input && input.url) || "";
    const method = (init && init.method) || (input instanceof Request ? input.method : "GET");
    const bodyRaw = init && typeof init.body === "string" ? init.body : "";
    if (urlStr.startsWith("/api/")) return answer(urlStr, method, bodyRaw);
    let url;
    try { url = new URL(urlStr, location.href); } catch { return realFetch(input, init); }
    if ((url.origin === location.origin || url.origin === "null" || urlStr.startsWith("/")) && url.pathname.startsWith("/api/")) {
      return answer(url.pathname, method, bodyRaw);
    }
    return realFetch(input, init);
  };

  async function answer(pathname, method, bodyRaw) {
    try {
      const url = new URL(pathname, "https://demo.local");
      const data = await demoApi(url.pathname, (method || "GET").toUpperCase(), url, bodyRaw);
      return J(data);
    } catch (e) {
      if (Array.isArray(e)) return JE(e[0], e[1], e[2]);
      return JE(500, "internal_error", String((e && e.message) || e));
    }
  }
})();

