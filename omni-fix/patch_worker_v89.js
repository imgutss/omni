// rev149 worker patch — root-rebuilt DNS: shared DoH core, honest verdicts with
// reference comparison, and an authenticated batch endpoint for the new DNS view.
// The legacy GET /api/diag/dns keeps its old fields and gains verdict/ref_ips.
const fs = require('fs');
let js = fs.readFileSync('/home/user/omni-fix/omni.v88.js', 'utf8');
const edits = [];
function rep(oldT, newT, label, expect = 1) {
  const n = js.split(oldT).length - 1;
  if (n !== expect) throw new Error(`anchor count ${n} (expected ${expect}) for: ${label}`);
  js = js.split(oldT).join(newT);
  edits.push(label);
}

const oldBranch = `  if (p2 === "/api/diag/dns" && method === "GET") {
    const dnsName = String(url.searchParams.get("name") || "").trim();
    const dnsType = String(url.searchParams.get("type") || "A").trim().toUpperCase() === "AAAA" ? "AAAA" : "A";
    const dohUrl = String(url.searchParams.get("url") || "https://cloudflare-dns.com/dns-query").trim();
    if (!dnsName)
      return bad("bad_name", "نام دامنه لازم است", 422);
    const t0 = Date.now();
    try {
      const r2 = await fetch(dohUrl + "?name=" + encodeURIComponent(dnsName) + "&type=" + dnsType, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(7000)
      });
      const j = await r2.json().catch(() => null);
      const ips = ((j && j.Answer) || [])
        .filter((a) => a && (a.type === 1 || a.type === 28))
        .map((a) => String(a.data || "").trim())
        .filter(Boolean);
      return json({ ok: true, name: dnsName, type: dnsType, ips, ms: Date.now() - t0 });
    } catch (e) {
      const timedOut = /timeout|abort/i.test(String(e?.name || "") + String(e?.message || ""));
      return json({
        ok: false,
        name: dnsName,
        type: dnsType,
        ips: [],
        ms: Date.now() - t0,
        error: timedOut ? "پرسش DNS در مهلت ۷ ثانیه پاسخ نداد" : "پرسش DNS انجام نشد"
      });
    }
  }`;

const newBranch = String.raw`  /* rev149 — shared DoH measurement core: real positive ms, honest failures, reference-verdicts */
  function omniDnsIsBogon(ip) {
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(String(ip))) return false;
    const o = String(ip).split(".").map(Number);
    if (o.some((x) => x < 0 || x > 255)) return true;
    return o[0] === 0 || o[0] === 10 || o[0] === 127 || (o[0] === 100 && o[1] >= 64 && o[1] <= 127) ||
      (o[0] === 169 && o[1] === 254) || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
      (o[0] === 192 && o[1] === 168) || (o[0] === 198 && (o[1] === 18 || o[1] === 19)) ||
      o[0] >= 224;
  }
  async function omniDnsResolveUrl(dohUrl, qname, qtype) {
    const t0 = Date.now();
    let u;
    try { u = new URL(dohUrl); if (u.protocol !== "https:") throw new Error("bad_scheme"); }
    catch (e) { return { ok: false, verdict: "http-error", ips: [], ms: null, error: "نشانی DoH معتبر نیست" }; }
    try {
      const r2 = await fetch(u.origin + u.pathname + "?name=" + encodeURIComponent(qname) + "&type=" + qtype, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(7000)
      });
      const ms = Date.now() - t0;
      if (!r2.ok) return { ok: false, verdict: "http-error", ips: [], ms: null, http: r2.status, error: "HTTP " + r2.status };
      const j = await r2.json().catch(() => null);
      if (!j) return { ok: false, verdict: "no-answer", ips: [], ms: null, error: "پاسخ DNS قابل خواندن نیست" };
      if (Number(j.Status) === 3) return { ok: false, verdict: "nxdomain", ips: [], ms, status: 3 };
      const ips = ((j.Answer) || [])
        .filter((a) => a && (a.type === 1 || a.type === 28))
        .map((a) => String(a.data || "").replace(/\.$/, "").trim())
        .filter(Boolean);
      if (!ips.length) return { ok: false, verdict: "empty", ips: [], ms, status: Number(j.Status) || 0 };
      return { ok: true, verdict: "ok", ips, ms: ms > 0 ? ms : 1, status: Number(j.Status) || 0 };
    } catch (e) {
      const timedOut = /timeout|abort/i.test(String(e?.name || "") + String(e?.message || ""));
      return { ok: false, verdict: "no-answer", ips: [], ms: null, error: timedOut ? "پرسش DNS در مهلت ۷ ثانیه پاسخ نداد" : "پرسش DNS انجام نشد" };
    }
  }
  function omniDnsClassify(res, refIps) {
    if (!res.ok) return { verdict: res.verdict, compared: false };
    const ref = (refIps || []).filter((x) => !omniDnsIsBogon(x));
    if (!ref.length) return { verdict: "ok", compared: false };
    if (res.ips.some((x) => omniDnsIsBogon(x))) return { verdict: "poisoned", compared: true };
    const refSet = new Set(ref);
    if (res.ips.some((x) => refSet.has(x))) return { verdict: "ok", compared: true };
    return { verdict: "divergent", compared: true };
  }
  async function omniDnsReference(qname, qtype) {
    for (const base of ["https://cloudflare-dns.com/dns-query", "https://dns.google/dns-query"]) {
      const ref = await omniDnsResolveUrl(base, qname, qtype);
      if (ref.ok && ref.ips.length) return ref.ips;
    }
    return [];
  }
  if (p2 === "/api/diag/dns-batch" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const qname = String(body.qname || "").trim().toLowerCase();
    const qtype = String(body.qtype || "A").trim().toUpperCase() === "AAAA" ? "AAAA" : "A";
    if (!/^[a-z0-9.-]{2,253}$/.test(qname)) return bad("bad_name", "نام دامنه معتبر نیست", 422);
    const servers = (Array.isArray(body.servers) ? body.servers : []).slice(0, 32)
      .map((s) => ({ id: String(s?.id || "").slice(0, 40), url: String(s?.url || "").trim() }))
      .filter((s) => /^https:\/\/[a-z0-9.-]+(?::\d+)?\//i.test(s.url) && s.id);
    if (!servers.length) return bad("bad_servers", "فهرست سرور معتبر نیست", 422);
    const refIps = await omniDnsReference(qname, qtype);
    const results = new Array(servers.length);
    const CONC = 6;
    for (let off = 0; off < servers.length; off += CONC) {
      const chunk = servers.slice(off, off + CONC);
      await Promise.all(chunk.map(async (srv, idx) => {
        const res = await omniDnsResolveUrl(srv.url, qname, qtype);
        const cls = omniDnsClassify(res, refIps);
        results[off + idx] = {
          id: srv.id, url: srv.url, ok: res.ok, verdict: cls.verdict, compared: cls.compared,
          ips: res.ips, ms: res.ms, http: res.http || null, error: res.error || null, at: Date.now()
        };
      }));
    }
    return json({
      ok: true, qname, qtype, colo: request?.cf?.colo || null,
      ref_ips: refIps, at: Date.now(), results
    });
  }
  if (p2 === "/api/diag/dns" && method === "GET") {
    const dnsName = String(url.searchParams.get("name") || "").trim();
    const dnsType = String(url.searchParams.get("type") || "A").trim().toUpperCase() === "AAAA" ? "AAAA" : "A";
    const dohUrl = String(url.searchParams.get("url") || "https://cloudflare-dns.com/dns-query").trim();
    if (!dnsName)
      return bad("bad_name", "نام دامنه لازم است", 422);
    const res = await omniDnsResolveUrl(dohUrl, dnsName, dnsType);
    const refIps = res.ok ? await omniDnsReference(dnsName, dnsType) : [];
    const cls = omniDnsClassify(res, refIps);
    return json({
      ok: res.ok, name: dnsName, type: dnsType, ips: res.ips, ms: res.ms,
      verdict: cls.verdict, ref_ips: refIps, compared: cls.compared,
      http: res.http || null, error: res.error || null,
      colo: request?.cf?.colo || null, via: "worker"
    });
  }`;

rep(oldBranch, newBranch, 'DNS core + batch endpoint + legacy retrofit');

if (js.includes('�')) throw new Error('U+FFFD after patch');
fs.writeFileSync('/home/user/omni-fix/omni.v89.base.js', js);
console.log('worker patches applied:', edits.join(' | '));
console.log('omni.v89.base.js bytes=', Buffer.byteLength(js, 'utf8'));
