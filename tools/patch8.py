#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch8 — install the Vercel/Netlify auto-bridge (token -> deployed site) into the
canonical production Worker and its Telegram bot flow.

Idempotent: skips if already applied (pass --force to re-apply).
"""
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
WORKER = ROOT / "production" / "worker.js"
BRIDGES = ROOT / "src" / "bridges.js"

src = WORKER.read_text(encoding="utf-8")
orig_len = len(src)

if "Omni NationalNet bridge API" in src and "--force" not in sys.argv:
    print("already patched; use --force to re-apply")
    sys.exit(0)


EXPORT_RE = re.compile(r"export\s+(?=(?:async\s+)?(?:function|const|let|var)\b)")


def strip_module_exports(text):
    """Remove top-level `export` keywords from the module source.

    Anything inside a template literal is left alone, because the generated
    Vercel/Netlify files legitimately contain their own `export default`.
    Nested templates inside ${...} are handled with an explicit stack.
    """
    out = []
    stripped = []
    kept = []
    i = 0
    n = len(text)
    stack = []          # "tpl" | "code"
    line_start = True
    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        top = stack[-1] if stack else "code"
        if top == "code":
            if c == "\n":
                line_start = True
                out.append(c)
                i += 1
                continue
            if line_start and not stack and text.startswith("export", i):
                m = EXPORT_RE.match(text, i)
                if m:
                    stripped.append(text[i:m.end()])
                    i = m.end()
                    line_start = False
                    continue
                kept.append(i)
            if c == "`":
                stack.append("tpl")
                out.append(c)
                i += 1
                line_start = False
                continue
            if c == "}" and len(stack) > 1 and stack[-1] == "code":
                stack.pop()
                out.append(c)
                i += 1
                continue
            if c == "\\" and nxt:
                out.append(c)
                out.append(nxt)
                i += 2
                line_start = False
                continue
            out.append(c)
            line_start = False
            i += 1
            continue
        # inside a template literal
        if c == "\\" and nxt:
            out.append(c)
            out.append(nxt)
            i += 2
            continue
        if c == "`":
            stack.pop()
            out.append(c)
            i += 1
            continue
        if c == "$" and nxt == "{":
            stack.append("code")
            out.append("${")
            i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out), stripped, kept


mod, STRIPPED, KEPT = strip_module_exports(BRIDGES.read_text(encoding="utf-8"))
# The generated Vercel/Netlify files live inside template literals and keep their
# own `export` keywords; only module-level ones may be stripped.
# every module-level export must have been stripped, and the generated
# Vercel/Netlify sources (which live inside template literals) must keep theirs.
if len(STRIPPED) < 28:
    raise SystemExit("only %d module exports were stripped; expected at least 28" % len(STRIPPED))
for item in KEPT:
    raise SystemExit("a module-level export survived the strip at offset %d" % item)
if "export default function handler(req, res)" not in mod:
    raise SystemExit("template-literal export was stripped by mistake")

MODULE_BLOCK = (
    "\n// src/bridges.js — Omni NationalNet bridge API (Vercel & Netlify auto-deploy)\n"
    + mod.rstrip() + "\n\n"
)

ANCHOR_API = "async function handleApi(request, env, ctx, url) {"
if src.count(ANCHOR_API) != 1:
    raise SystemExit("handleApi anchor count = %d" % src.count(ANCHOR_API))
src = src.replace(ANCHOR_API, MODULE_BLOCK + ANCHOR_API, 1)

# ── /api/bridge* routes ──────────────────────────────────────────────────────
ROUTES_ANCHOR = (
    "  const settings = await settingsCached(env);\n"
    "  if (p.startsWith(\"/api/mesh/\"))\n"
    "    await ensureMeshSchema(env);"
)
if src.count(ROUTES_ANCHOR) != 1:
    raise SystemExit("routes anchor not unique")

ROUTES = r'''  const settings = await settingsCached(env);
  if (p === "/api/bridge" || p.startsWith("/api/bridge/")) {
    const isAdmin = String(account.role || "") === "admin";
    const bridgeTarget = () => {
      const raw = String(settings.public_host || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "") || url.hostname;
      return normalizeTargetHost(raw) || normalizeTargetHost(url.hostname) || "";
    };
    const bridgePath = () => {
      let t = String(settings.path || "/VZLdh9Ft").trim().split("?")[0];
      if (!t || t === "/") t = "/VZLdh9Ft";
      if (!t.startsWith("/")) t = "/" + t;
      return t;
    };
    if (method === "GET" && p === "/api/bridge") {
      const rows = await listBridges(env.DB, null, 40);
      return json({ ok: true, bridges: rows, target: bridgeTarget(), path: bridgePath(), can_deploy: isAdmin });
    }
    if (method === "GET" && p.startsWith("/api/bridge/")) {
      const id = Number(p.split("/")[3] || 0);
      const row = id ? await getBridge(env.DB, id) : null;
      if (!row) return bad("not_found", "\u067E\u0644\u06CC \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F", 404);
      return json({ ok: true, bridge: row });
    }
    if (!isAdmin) return bad("forbidden", "\u0641\u0642\u0637 \u0645\u062F\u06CC\u0631 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u067E\u0644 \u0627\u0628\u0631\u06CC \u0628\u0633\u0627\u0632\u062F", 403);
    if (method === "POST" && p === "/api/bridge/verify") {
      const body = await request.json().catch(() => ({}));
      const platform = String(body.platform || "").toLowerCase();
      if (!isBridgePlatform(platform)) return bad("bad_platform", "\u067E\u0644\u062A\u0641\u0631\u0645 \u0628\u0627\u06CC\u062F vercel \u06CC\u0627 netlify \u0628\u0627\u0634\u062F");
      const token = String(body.token || "").trim();
      if (!bridgeTokenShape(platform, token)) return bad("bad_token", "\u0633\u0627\u062E\u062A\u0627\u0631 \u062A\u0648\u06A9\u0646 \u062F\u0631\u0633\u062A \u0646\u06CC\u0633\u062A");
      try {
        const who = await verifyBridgeToken(platform, token);
        return json({ ok: true, platform, account: { username: who.username, email: who.email, plan: who.plan || "", team_slug: who.teamSlug || "" }, token: maskToken(token) });
      } catch (e) {
        await logEvent(env, "warn", `\u062A\u0648\u06A9\u0646 ${platform} \u0631\u062F \u0634\u062F: ${String(e?.message || e).slice(0, 120)}`);
        return bad("bad_token", `${platform === "vercel" ? "\u0648\u0631\u0633\u0644" : "\u0646\u062A\u0644\u06CC\u0641\u0627\u06CC"} \u062A\u0648\u06A9\u0646 \u0631\u0627 \u0642\u0628\u0648\u0644 \u0646\u06A9\u0631\u062F: ${String(e?.message || e).slice(0, 220)}`, e?.auth ? 401 : 400);
      }
    }
    if (method === "POST" && p === "/api/bridge") {
      const body = await request.json().catch(() => ({}));
      const platform = String(body.platform || "").toLowerCase();
      if (!isBridgePlatform(platform)) return bad("bad_platform", "\u067E\u0644\u062A\u0641\u0631\u0645 \u0628\u0627\u06CC\u062F vercel \u06CC\u0627 netlify \u0628\u0627\u0634\u062F");
      const token = String(body.token || "").trim();
      if (!bridgeTokenShape(platform, token)) return bad("bad_token", "\u0633\u0627\u062E\u062A\u0627\u0631 \u062A\u0648\u06A9\u0646 \u062F\u0631\u0633\u062A \u0646\u06CC\u0633\u062A");
      const target = normalizeTargetHost(body.target || bridgeTarget());
      if (!target) return bad("bad_target", "\u0622\u062F\u0631\u0633 \u0648\u0631\u06A9\u0631 \u0645\u0642\u0635\u062F \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A");
      const tunnelPath = String(body.tunnel_path || bridgePath()).slice(0, 60);
      try {
        const started = await startBridgeDeploy(env.DB, ctx, {
          owner: `panel:${account.username}`,
          platform, token,
          name: String(body.name || ""),
          target, tunnelPath,
          saveToken: Boolean(body.save_token)
        });
        await logEvent(env, "info", `\u0633\u0627\u062E\u062A \u067E\u0644 ${platform} \u0628\u0627 \u0646\u0627\u0645 \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u06CC \u00AB${started.name}\u00BB \u0628\u0647 \u0633\u0645\u062A ${target} \u0622\u063A\u0627\u0632 \u0634\u062F`);
        return json({ ok: true, id: started.id, name: started.name, platform, target, tunnel_path: tunnelPath, status: "deploying" });
      } catch (e) {
        return bad("deploy_failed", String(e?.message || e).slice(0, 300), e?.auth ? 401 : 400);
      }
    }
    return bad("not_found", "\u0631\u0648\u062A \u067E\u0644 \u0627\u0628\u0631\u06CC \u0634\u0646\u0627\u062E\u062A\u0647 \u0646\u0634\u062F", 404);
  }
  if (p.startsWith("/api/mesh/"))
    await ensureMeshSchema(env);'''

src = src.replace(ROUTES_ANCHOR, ROUTES, 1)

# ── bot: callback map ────────────────────────────────────────────────────────
MAP_OLD = 'const map = { menu: "/start", help: "/help", deploy: "/deploy", panels: "/panels", connect: "/connect", token: "/token", bridge: "/bridge", bd_donate: "/bridge-donate", bd_claim: "/bridge-claim", bd_stock: "/bridge-stock" };'
MAP_NEW = 'const map = { menu: "/start", help: "/help", deploy: "/deploy", panels: "/panels", connect: "/connect", token: "/token", bridge: "/bridge", bd_donate: "/bridge-donate", bd_claim: "/bridge-claim", bd_stock: "/bridge-stock", natbridge: "/natbridge", nb_vercel: "/natbridge vercel", nb_netlify: "/natbridge netlify", nb_list: "/natbridge list" };'
if src.count(MAP_OLD) != 1:
    raise SystemExit("bot map anchor not unique")
src = src.replace(MAP_OLD, MAP_NEW, 1)

# ── bot: bridge flow ─────────────────────────────────────────────────────────
FLOW_ANCHOR = '  if (ui?.state?.startsWith("deploy_")) {'
if src.count(FLOW_ANCHOR) != 1:
    raise SystemExit("bot flow anchor not unique")

FLOW = r'''  if (ui?.state === "bridge_token") {
    if (msg?.chat?.type !== "private")
      return send("\u{1F510} \u0628\u0631\u0627\u06CC \u0627\u0645\u0646\u06CC\u062A\u060C \u062A\u0648\u06A9\u0646 \u0631\u0627 \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC \u0628\u0641\u0631\u0633\u062A.");
    const wantPlatform = ui.data?.platform || "vercel";
    const label = wantPlatform === "vercel" ? "\u0648\u0631\u0633\u0644" : "\u0646\u062A\u0644\u06CC\u0641\u0627\u06CC";
    if (!bridgeTokenShape(wantPlatform, text.trim()))
      return send(`\u274C \u0633\u0627\u062E\u062A\u0627\u0631 \u062A\u0648\u06A9\u0646 ${label} \u062F\u0631\u0633\u062A \u0646\u06CC\u0633\u062A. \u062A\u0648\u06A9\u0646 \u06A9\u0627\u0645\u0644 \u0631\u0627 \u062F\u0648\u0628\u0627\u0631\u0647 \u0628\u0641\u0631\u0633\u062A \u06CC\u0627 /cancel \u0628\u0632\u0646.`);
    await tgApi(env, "deleteMessage", { chat_id: chatId, message_id: update.message?.message_id }).catch(() => {
    });
    await clearUiState(env, chatId);
    const target = normalizeTargetHost(ui.data?.target || "");
    const tunnelPath = String(ui.data?.path || "/VZLdh9Ft").slice(0, 60);
    const projectName = bridgeProjectName(ui.data?.name || "");
    if (!target)
      return send("\u274C \u0622\u062F\u0631\u0633 \u0648\u0631\u06A9\u0631 \u0645\u0642\u0635\u062F \u0645\u0634\u062E\u0635 \u0646\u06CC\u0633\u062A. \u0627\u0628\u062A\u062F\u0627 \u06CC\u06A9 \u067E\u0646\u0644 \u0628\u0633\u0627\u0632 \u06CC\u0627 \u0648\u0635\u0644 \u06A9\u0646\u060C \u0628\u0639\u062F /natbridge \u0628\u0632\u0646.");
    const progressMessage = await send(`\u23F3 \u0633\u0627\u062E\u062A \u067E\u0644 <b>${label}</b> \u0628\u0627 \u0646\u0627\u0645 <code>${esc2(projectName)}</code>\u2026\n\u0645\u0642\u0635\u062F: <code>${esc2(target)}</code>`);
    let lastStage = "";
    const progress = (stage) => {
      const s = String(stage || "").slice(0, 120);
      if (!s || s === lastStage) return Promise.resolve();
      lastStage = s;
      return tgApi(env, "editMessageText", {
        chat_id: chatId,
        message_id: progressMessage?.result?.message_id,
        text: `\u23F3 <b>${esc2(projectName)}</b>\n${esc2(s)}`,
        parse_mode: "HTML",
        disable_web_page_preview: true
      });
    };
    try {
      const started = await startBridgeDeploy(env.DB, ctx, {
        owner: `bot:${chatId}`,
        platform: wantPlatform,
        token: text.trim(),
        name: ui.data?.name || "",
        target,
        tunnelPath,
        saveToken: true,
        onProgress: progress
      });
      const result = await started.promise;
      const bridgeDomain = result.domain || "";
      const sub = await buildBridgeSubscription(env, chatId, wantPlatform, bridgeDomain, tunnelPath).catch(() => null);
      const finalText = `${result.state === "ready" ? "\u2705" : "\u{1F7E1}"} <b>\u067E\u0644 ${label} \u0633\u0627\u062E\u062A\u0647 \u0634\u062F</b>\n\n\u067E\u0631\u0648\u0698\u0647: <code>${esc2(result.name || projectName)}</code>\n\u062F\u0627\u0645\u0646\u0647: <code>${esc2(bridgeDomain)}</code>\n\u0645\u0642\u0635\u062F: <code>${esc2(result.target || target)}</code>\n\u0645\u0633\u06CC\u0631: <code>${esc2(tunnelPath)}</code>\n\u0648\u0636\u0639\u06CC\u062A: ${result.state === "ready" ? "\u0622\u0645\u0627\u062F\u0647" : "\u062F\u0631 \u062D\u0627\u0644 \u0633\u0627\u062E\u062A \u2014 \u0686\u0646\u062F \u062B\u0627\u0646\u06CC\u0647 \u062F\u06CC\u06AF\u0631 \u062A\u0627\u0632\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F"}\n${result.ms ? `\u0632\u0645\u0627\u0646: ${(Number(result.ms) / 1e3).toFixed(1)} \u062B\u0627\u0646\u06CC\u0647\n` : ""}${sub ? `\n${sub}` : ""}\n\n\u062F\u06CC\u06AF\u0631 \u0646\u06CC\u0627\u0632\u06CC \u0628\u0647 \u0622\u067E\u0644\u0648\u062F \u062F\u0633\u062A\u06CC \u0632\u06CC\u067E \u0646\u06CC\u0633\u062A \u2014 \u0647\u0645\u0647\u200C\u0686\u06CC\u0632 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0633\u0627\u062E\u062A\u0647 \u0648 \u0645\u0646\u062A\u0634\u0631 \u0634\u062F.`;
      const kb = [];
      if (result.url) kb.push([{ text: "\u{1F310} \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u067E\u0644", url: result.url }]);
      if (result.deploymentUrl) kb.push([{ text: "\u{1F50E} \u062C\u0632\u0626\u06CC\u0627\u062A \u062F\u06CC\u067E\u0644\u0648\u06CC", url: result.deploymentUrl }]);
      kb.push([{ text: "\u{1F504} \u0633\u0627\u062E\u062A \u06CC\u06A9 \u067E\u0644 \u062F\u06CC\u06AF\u0631", callback_data: "cmd:natbridge" }, { text: "\u{1F4CB} \u067E\u0644\u200C\u0647\u0627\u06CC \u0645\u0646", callback_data: "cmd:nb_list" }]);
      if (progressMessage?.result?.message_id)
        await tgApi(env, "editMessageText", { chat_id: chatId, message_id: progressMessage.result.message_id, text: finalText, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: kb } });
      else
        return send(finalText, { reply_markup: { inline_keyboard: kb } });
      return;
    } catch (error) {
      const detail = String(error?.message || error).slice(0, 400);
      const hint = error?.auth ? `\n\n\u26A0\uFE0F \u062A\u0648\u06A9\u0646 \u0631\u062F \u0634\u062F. \u062A\u0648\u06A9\u0646 \u062A\u0627\u0632\u0647 \u0627\u0632 \u0627\u06CC\u0646 \u0622\u062F\u0631\u0633 \u0628\u06AF\u06CC\u0631:\n<code>${wantPlatform === "vercel" ? "https://vercel.com/account/tokens" : "https://app.netlify.com/user/applications#personal-access-tokens"}</code>` : "";
      const failText = `\u274C <b>\u0633\u0627\u062E\u062A \u067E\u0644 ${label} \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F</b>\n\n<code>${esc2(detail)}</code>${hint}`;
      if (progressMessage?.result?.message_id)
        await tgApi(env, "editMessageText", { chat_id: chatId, message_id: progressMessage.result.message_id, text: failText, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: "\u{1F504} \u062A\u0644\u0627\u0634 \u062F\u0648\u0628\u0627\u0631\u0647", callback_data: "cmd:natbridge" }, { text: "\u2B05\uFE0F \u0645\u0646\u0648", callback_data: "cmd:menu" }]] } });
      else
        return send(failText, { reply_markup: { inline_keyboard: [[{ text: "\u{1F504} \u062A\u0644\u0627\u0634 \u062F\u0648\u0628\u0627\u0631\u0647", callback_data: "cmd:natbridge" }]] } });
      return;
    }
  }
  if (cmd === "/natbridge" || cmd === "/vercel" || cmd === "/netlify" || callbackData === "cmd:natbridge" || callbackData === "cmd:nb_list" || callbackData === "cmd:nb_vercel" || callbackData === "cmd:nb_netlify") {
    if (msg?.chat?.type !== "private" && !callbackData)
      return send("\u{1F510} \u0633\u0627\u062E\u062A \u067E\u0644 \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062E\u0635\u0648\u0635\u06CC.");
    const arg = String(text.split(/\s+/)[1] || "").toLowerCase();
    const rows = await listBridges(env.DB, `bot:${chatId}`, 10).catch(() => []);
    const listText = rows.length ? rows.map((r) => `${r.platform === "vercel" ? "\u25B2" : "\u25C8"} <code>${esc2(r.domain || r.name)}</code> \u2190 <code>${esc2(r.target_host || "")}</code> \u00B7 ${r.status === "ready" ? "\u2705 \u0622\u0645\u0627\u062F\u0647" : r.status === "building" ? "\u{1F7E1} \u062F\u0631 \u062D\u0627\u0644 \u0633\u0627\u062E\u062A" : "\u274C \u062E\u0637\u0627"}`).join("\n") : "\u0647\u0646\u0648\u0632 \u067E\u0644\u06CC \u0646\u0633\u0627\u062E\u062A\u0647\u200C\u0627\u06CC.";
    if (callbackData === "cmd:nb_list" || arg === "list")
      return send(`\u{1F4CB} <b>\u067E\u0644\u200C\u0647\u0627\u06CC \u0627\u0628\u0631\u06CC \u062A\u0648</b>\n\n${listText}`, { reply_markup: { inline_keyboard: [[{ text: "\u25B2 \u067E\u0644 \u0648\u0631\u0633\u0644", callback_data: "cmd:nb_vercel" }, { text: "\u25C8 \u067E\u0644 \u0646\u062A\u0644\u06CC\u0641\u0627\u06CC", callback_data: "cmd:nb_netlify" }], [{ text: "\u2B05\uFE0F \u0645\u0646\u0648", callback_data: "cmd:menu" }]] } });
    const chosen = callbackData === "cmd:nb_vercel" || arg === "vercel" || cmd === "/vercel" ? "vercel" : callbackData === "cmd:nb_netlify" || arg === "netlify" || cmd === "/netlify" ? "netlify" : "";
    const panel = await bridgeResolvePanel(env);
    const autoTarget = normalizeTargetHost(String(panel?.panel_url || "").replace(/^https?:\/\//, ""));
    const autoPath = await bridgePanelPath(env, chatId, panel);
    if (!chosen)
      return send(`\u{1F310} <b>\u067E\u0644 \u0627\u0628\u0631\u06CC \u0646\u062A \u0645\u0644\u06CC</b>\n\n\u0645\u062B\u0644 \u06A9\u0644\u0627\u0648\u062F\u0641\u0644\u06CC\u0631\u060C \u0641\u0642\u0637 \u062A\u0648\u06A9\u0646 \u0631\u0627 \u0645\u06CC\u200C\u062F\u0647\u06CC \u0648 \u062E\u0648\u062F\u0645 \u067E\u0631\u0648\u0698\u0647 \u0631\u0627 \u0645\u06CC\u200C\u0633\u0627\u0632\u0645\u060C \u06A9\u0627\u0646\u0641\u06CC\u06AF \u0631\u0627 \u0645\u06CC\u200C\u0646\u0648\u06CC\u0633\u0645 \u0648 \u0645\u0646\u062A\u0634\u0631 \u0645\u06CC\u200C\u06A9\u0646\u0645. \u062F\u06CC\u06AF\u0631 \u0646\u06CC\u0627\u0632\u06CC \u0628\u0647 \u0622\u067E\u0644\u0648\u062F \u062F\u0633\u062A\u06CC \u0632\u06CC\u067E \u0646\u06CC\u0633\u062A.\n\n${listText}`, { reply_markup: { inline_keyboard: [[{ text: "\u25B2 \u0633\u0627\u062E\u062A \u067E\u0644 \u0648\u0631\u0633\u0644 (Vercel)", callback_data: "cmd:nb_vercel" }, { text: "\u25C8 \u0633\u0627\u062E\u062A \u067E\u0644 \u0646\u062A\u0644\u06CC\u0641\u0627\u06CC (Netlify)", callback_data: "cmd:nb_netlify" }], [{ text: "\u{1F4CB} \u067E\u0644\u200C\u0647\u0627\u06CC \u0633\u0627\u062E\u062A\u0647\u200C\u0634\u062F\u0647", callback_data: "cmd:nb_list" }, { text: "\u2B05\uFE0F \u0645\u0646\u0648", callback_data: "cmd:menu" }]] } });
    if (!autoTarget)
      return send("\u26A0\uFE0F \u0647\u06CC\u0686 \u067E\u0646\u0644\u06CC \u0628\u0631\u0627\u06CC \u0647\u062F\u0627\u06CC\u062A \u062A\u0631\u0627\u0641\u06CC\u06A9 \u067E\u06CC\u062F\u0627 \u0646\u06A9\u0631\u062F\u0645. \u0627\u0628\u062A\u062F\u0627 \u0628\u0627 /deploy \u06CC\u06A9 \u067E\u0646\u0644 \u06A9\u0644\u0627\u0648\u062F\u0641\u0644\u06CC\u0631 \u0628\u0633\u0627\u0632 \u06CC\u0627 \u0628\u0627 /connect \u0648\u0635\u0644\u0634 \u06A9\u0646.");
    const names = [`${chosen === "vercel" ? "omni-bridge" : "omni-net"}-${Math.random().toString(36).slice(2, 6)}`, `${chosen === "vercel" ? "omni-edge" : "omni-relay"}-${Math.random().toString(36).slice(2, 6)}`, "\u270F\uFE0F \u0646\u0627\u0645 \u062F\u0644\u062E\u0648\u0627\u0647"];
    return send(`\u{1F680} <b>\u0633\u0627\u062E\u062A \u067E\u0644 ${chosen === "vercel" ? "\u0648\u0631\u0633\u0644" : "\u0646\u062A\u0644\u06CC\u0641\u0627\u06CC"}</b>\n\n\u0645\u0642\u0635\u062F: <code>${esc2(autoTarget)}</code>\n\u0645\u0633\u06CC\u0631 \u062A\u0648\u0646\u0644: <code>${esc2(autoPath)}</code>\n\n\u06CC\u06A9 \u0646\u0627\u0645 \u0628\u0631\u0627\u06CC \u067E\u0631\u0648\u0698\u0647 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646:`, { reply_markup: { inline_keyboard: [...names.map((n) => [{ text: n, callback_data: `nbname:${chosen}:${n}` }]), [{ text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: "cmd:natbridge" }]] } });
  }
  if (callbackData.startsWith("nbname:")) {
    const parts = callbackData.split(":");
    const platform = parts[1];
    const rawName = parts.slice(2).join(":");
    if (!isBridgePlatform(platform)) return send("\u067E\u0644\u062A\u0641\u0631\u0645 \u0646\u0627\u0645\u0639\u062A\u0628\u0631.");
    const panel2 = await bridgeResolvePanel(env);
    const autoPath2 = await bridgePanelPath(env, chatId, panel2);
    if (!rawName || rawName.includes("\u270F")) {
      await setUiState(env, chatId, "bridge_name", { platform, path: autoPath2 });
      return send("\u{1F4DD} \u0646\u0627\u0645 \u067E\u0631\u0648\u0698\u0647 \u0631\u0627 \u0628\u0641\u0631\u0633\u062A (\u062D\u0631\u0648\u0641 \u06A9\u0648\u0686\u06A9 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC\u060C \u0639\u062F\u062F \u0648 \u062E\u0637 \u062A\u0641\u0635\u06CC\u0644\u060C \u062D\u062F\u0627\u06A9\u062B\u0631 \u06F3\u06F2 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631).");
    }
    return askBridgeToken(env, chatId, platform, rawName, send, autoPath2);
  }
  if (ui?.state === "bridge_name") {
    const name = bridgeProjectName(text);
    await clearUiState(env, chatId);
    return askBridgeToken(env, chatId, ui.data?.platform || "vercel", name, send, ui.data?.path || await bridgePanelPath(env, chatId, await bridgeResolvePanel(env)));
  }
  if (ui?.state?.startsWith("deploy_")) {'''

src = src.replace(FLOW_ANCHOR, FLOW, 1)

# ── bot helpers ──────────────────────────────────────────────────────────────
HELPERS_ANCHOR = "async function setUiState(env, chatId, state, data = {}) {"
if src.count(HELPERS_ANCHOR) != 1:
    raise SystemExit("bot helpers anchor not unique")

HELPERS = r'''function bridgePathText(tunnelPath) {
  let t = String(tunnelPath || "").trim().split("?")[0];
  if (!t || t === "/")
    return "/VZLdh9Ft";
  if (t.charCodeAt(0) !== 47)
    t = "/" + t;
  return t.slice(0, 60);
}
async function bridgePanelPath(env, chatId, panel) {
  const fallback = "/VZLdh9Ft";
  if (!panel?.account_id || !panel?.database_id || !isPanelManagementVerified(panel))
    return fallback;
  try {
    const token = await getCachedToken(env, chatId);
    if (!token)
      return fallback;
    return bridgePathText(await panelSetting(token, panel, "path"));
  } catch {
    return fallback;
  }
}
async function bridgeResolvePanel(env) {
  return await env.DB.prepare("SELECT id,worker_name,panel_url,status,account_id,database_id,source FROM bot_panels WHERE panel_url IS NOT NULL ORDER BY id DESC LIMIT 1").first().catch(() => null);
}
async function askBridgeToken(env, chatId, platform, name, send, tunnelPath) {
  const panel = await env.DB.prepare("SELECT worker_name,panel_url FROM bot_panels WHERE panel_url IS NOT NULL ORDER BY id DESC LIMIT 1").first().catch(() => null);
  const target = normalizeTargetHost(String(panel?.panel_url || "").replace(/^https?:\/\//, ""));
  const tokenUrl = platform === "vercel" ? "https://vercel.com/account/tokens" : "https://app.netlify.com/user/applications#personal-access-tokens";
  const label = platform === "vercel" ? "\u0648\u0631\u0633\u0644 (Vercel)" : "\u0646\u062A\u0644\u06CC\u0641\u0627\u06CC (Netlify)";
  await setUiState(env, chatId, "bridge_token", { platform, name, target, path: bridgePathText(tunnelPath) });
  return send(`\u{1F511} <b>\u062A\u0648\u06A9\u0646 ${label} \u0631\u0627 \u0628\u0641\u0631\u0633\u062A</b>\n\n\u067E\u0631\u0648\u0698\u0647: <code>${esc2(name)}</code>\n\u0645\u0642\u0635\u062F: <code>${esc2(target || "\u2014")}</code>\n\u0645\u0633\u06CC\u0631 \u062A\u0648\u0646\u0644: <code>${esc2(bridgePathText(tunnelPath))}</code>\n\n\u062A\u0648\u06A9\u0646 \u0631\u0627 \u0627\u0632 \u0627\u06CC\u0646\u062C\u0627 \u0628\u06AF\u06CC\u0631 \u0648 \u0647\u0645\u06CC\u0646\u200C\u062C\u0627 \u0628\u0641\u0631\u0633\u062A:\n<code>${tokenUrl}</code>\n\n\u2022 \u0648\u0631\u0633\u0644: Create Token \u2192 Scope = Full Account \u2192 Expiration = No Expiration\n\u2022 \u0646\u062A\u0644\u06CC\u0641\u0627\u06CC: New access token \u062F\u0631 \u0628\u062E\u0634 Personal access tokens\n\n\u{1F512} \u067E\u06CC\u0627\u0645 \u062A\u0648\u06A9\u0646 \u0628\u0644\u0627\u0641\u0627\u0635\u0644\u0647 \u067E\u0627\u06A9 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0641\u0642\u0637 \u0631\u0648\u06CC \u067E\u0646\u0644 \u062E\u0648\u062F\u062A \u0630\u062E\u06CC\u0631\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F (\u0628\u0627 /forget \u067E\u0627\u06A9\u0634 \u06A9\u0646).\n\u0644\u063A\u0648: /cancel`, { reply_markup: { inline_keyboard: [[{ text: "\u{1F517} \u0635\u0641\u062D\u0647\u0654 \u0633\u0627\u062E\u062A \u062A\u0648\u06A9\u0646", url: tokenUrl }], [{ text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641", callback_data: "cmd:menu" }]] } });
}
async function buildBridgeSubscription(env, chatId, platform, domain, tunnelPath) {
  const panel = await env.DB.prepare("SELECT worker_name,panel_url,status FROM bot_panels WHERE panel_url IS NOT NULL ORDER BY id DESC LIMIT 1").first().catch(() => null);
  const base = normalizeTargetHost(String(panel?.panel_url || "").replace(/^https?:\/\//, ""));
  if (!base || !domain) return "";
  const host = String(domain).replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const path = String(tunnelPath || "/VZLdh9Ft").slice(0, 60);
  const brand = platform === "vercel" ? "\u{1F1EE}\u{1F1F7} Omni-Vercel-Bridge" : "\u{1F1EE}\u{1F1F7} Omni-Netlify-Bridge";
  return `\u{1F4E1} <b>\u06A9\u0627\u0646\u0641\u06CC\u06AF \u0622\u0645\u0627\u062F\u0647</b> \u2014 \u0627\u06CC\u0646 \u0631\u0627 \u062F\u0631 v2rayNG/Happ \u0648\u0627\u0631\u062F \u06A9\u0646:\n<code>${esc2(brand)}</code>\n\u0622\u062F\u0631\u0633/SNI/Host: <code>${esc2(host)}</code>\n\u0645\u0633\u06CC\u0631: <code>${esc2(path)}</code>\n\n\u0644\u06CC\u0646\u06A9 \u06A9\u0627\u0645\u0644 vless:// \u0628\u0627 UUID \u062E\u0648\u062F\u062A \u062F\u0631 \u067E\u0646\u0644 \u2190 \u0646\u062A \u0645\u0644\u06CC \u2190 \u06A9\u0627\u0631\u062A \u062E\u0648\u062F\u06A9\u0627\u0631 \u0633\u0627\u062E\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.`;
}
async function setUiState(env, chatId, state, data = {}) {'''

src = src.replace(HELPERS_ANCHOR, HELPERS, 1)

# ── bot command list ─────────────────────────────────────────────────────────
CMD_OLD = '{ command: "cancel", description: "\\u0644\\u063A\\u0648 \\u0639\\u0645\\u0644\\u06CC\\u0627\\u062A \\u062C\\u0627\\u0631\\u06CC" }'
CMD_NEW = '{ command: "natbridge", description: "\\u0633\\u0627\\u062E\\u062A \\u067E\\u0644 Vercel/Netlify \\u0628\\u0627 \\u062A\\u0648\\u06A9\\u0646" }, { command: "cancel", description: "\\u0644\\u063A\\u0648 \\u0639\\u0645\\u0644\\u06CC\\u0627\\u062A \\u062C\\u0627\\u0631\\u06CC" }'
if src.count(CMD_OLD) != 1:
    raise SystemExit("creator commands anchor not unique")
src = src.replace(CMD_OLD, CMD_NEW, 1)

WORKER.write_text(src, encoding="utf-8")
print("production/worker.js patched: %d -> %d chars (+%d)" % (orig_len, len(src), len(src) - orig_len))
