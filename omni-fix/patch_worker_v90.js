// rev150 worker patch — universal RFC 8484 binary DoH: build a real DNS wire
// query (?dns= base64url, accept: application/dns-message) so the same request
// works against every compliant DoH provider (Google/Quad9/OpenDNS/AdGuard/
// CleanBrowsing/ControlD only accept binary; JSON form gave them 400/http-error).
const fs = require('fs');
let js = fs.readFileSync('/home/user/omni-fix/omni.v89.js', 'utf8');
const edits = [];
function rep(oldT, newT, label, expect = 1) {
  const n = js.split(oldT).length - 1;
  if (n !== expect) throw new Error(`anchor count ${n} (expected ${expect}) for: ${label}`);
  js = js.split(oldT).join(newT);
  edits.push(label);
}

/* ── anchor: the whole rev149 DNS core, replaced wholesale (String.raw keeps regex escapes) ── */
const oldBlock = String.raw`  function omniDnsIsBogon(ip) {
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
  }`;

const newBlock = String.raw`  function omniDnsIsBogon(ip) {
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(String(ip))) return false;
    const o = String(ip).split(".").map(Number);
    if (o.some((x) => x < 0 || x > 255)) return true;
    return o[0] === 0 || o[0] === 10 || o[0] === 127 || (o[0] === 100 && o[1] >= 64 && o[1] <= 127) ||
      (o[0] === 169 && o[1] === 254) || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
      (o[0] === 192 && o[1] === 168) || (o[0] === 198 && (o[1] === 18 || o[1] === 19)) ||
      o[0] >= 224;
  }
  /* rev150 — RFC 8484 binary DoH codec (pure Uint8Array, zero deps, Workers-safe) */
  function omniDnsB64Url(bytes) {
    let bin = "";
    for (let k = 0; k < bytes.length; k++) bin += String.fromCharCode(bytes[k]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function omniDnsEncodeName(domain) {
    const parts = String(domain).replace(/\.$/, "").toLowerCase().split(".").filter(Boolean);
    const bytes = [];
    for (const p of parts) {
      const label = [];
      for (let k = 0; k < p.length; k++) label.push(p.charCodeAt(k) & 0xff);
      if (!label.length || label.length > 63) throw new Error("bad_label");
      bytes.push(label.length);
      for (const x of label) bytes.push(x);
    }
    bytes.push(0);
    return bytes;
  }
  function omniDnsBuildQuery(domain, qtype) {
    const head = new Uint8Array(12);
    const hv = new DataView(head.buffer);
    hv.setUint16(0, (Math.random() * 65536) | 0);
    hv.setUint16(2, 0x0100); /* standard recursive query */
    hv.setUint16(4, 1);      /* QDCOUNT */
    const name = omniDnsEncodeName(domain);
    const tail = new Uint8Array(4);
    const tv = new DataView(tail.buffer);
    tv.setUint16(0, qtype === "AAAA" ? 28 : 1);
    tv.setUint16(2, 1); /* CLASS IN */
    const out = new Uint8Array(head.length + name.length + tail.length);
    out.set(head, 0);
    out.set(name, head.length);
    out.set(tail, head.length + name.length);
    return out;
  }
  function omniDnsReadName(buf, dv, off) {
    const labels = [];
    let jumped = false, ret = off, guard = 0;
    while (off < buf.length) {
      if (++guard > 128) throw new Error("name_loop");
      const len = buf[off];
      if (len === 0) { if (!jumped) ret = off + 1; break; }
      if ((len & 0xc0) === 0xc0) {
        const ptr = ((len & 0x3f) << 8) | buf[off + 1];
        if (!jumped) ret = off + 2;
        jumped = true;
        off = ptr;
        continue;
      }
      let s = "";
      for (let k = 1; k <= len; k++) s += String.fromCharCode(buf[off + k]);
      labels.push(s);
      off += len + 1;
    }
    return { name: labels.join("."), next: ret };
  }
  function omniDnsParseMessage(buf) {
    if (buf.length < 12) throw new Error("short_message");
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const rcode = dv.getUint16(2) & 0x0f;
    const qd = dv.getUint16(4), an = dv.getUint16(6);
    let off = 12;
    for (let i = 0; i < qd; i++) { const q = omniDnsReadName(buf, dv, off); off = q.next + 4; }
    const ips = [];
    for (let i = 0; i < an; i++) {
      const nm = omniDnsReadName(buf, dv, off);
      off = nm.next;
      const type = dv.getUint16(off), rdlen = dv.getUint16(off + 8);
      off += 10;
      if (type === 1 && rdlen === 4) {
        ips.push([buf[off], buf[off + 1], buf[off + 2], buf[off + 3]].join("."));
      } else if (type === 28 && rdlen === 16) {
        const p = [];
        for (let k = 0; k < 16; k += 2) p.push(dv.getUint16(off + k).toString(16));
        ips.push(p.join(":"));
      }
      off += rdlen;
    }
    return { rcode, ips };
  }
  async function omniDnsResolveUrl(dohUrl, qname, qtype) {
    const t0 = Date.now();
    let u;
    try { u = new URL(dohUrl); if (u.protocol !== "https:") throw new Error("bad_scheme"); }
    catch (e) { return { ok: false, verdict: "http-error", ips: [], ms: null, error: "نشانی DoH معتبر نیست" }; }
    try {
      const wire = omniDnsBuildQuery(qname, qtype);
      const target = u.origin + u.pathname + "?dns=" + omniDnsB64Url(wire);
      const r2 = await fetch(target, {
        headers: { accept: "application/dns-message" },
        signal: AbortSignal.timeout(7000)
      });
      const ms = Date.now() - t0;
      if (!r2.ok) return { ok: false, verdict: "http-error", ips: [], ms: null, http: r2.status, error: "HTTP " + r2.status };
      const buf = new Uint8Array(await r2.arrayBuffer());
      let msg;
      try { msg = omniDnsParseMessage(buf); }
      catch (pe) { return { ok: false, verdict: "no-answer", ips: [], ms: null, error: "پاسخ DNS قابل خواندن نیست" }; }
      if (msg.rcode === 3) return { ok: false, verdict: "nxdomain", ips: [], ms, status: 3 };
      const ips = msg.ips.map((x) => String(x).replace(/\.$/, "").trim()).filter(Boolean);
      if (!ips.length) return { ok: false, verdict: "empty", ips: [], ms, status: msg.rcode || 0 };
      return { ok: true, verdict: "ok", ips, ms: ms > 0 ? ms : 1, status: msg.rcode || 0 };
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
  }`;

rep(oldBlock, newBlock, 'DNS core replaced with RFC 8484 binary codec');

/* integrity — the diag resolver must speak wire format; unrelated ECH/Arvan JSON DoH callers stay untouched */
const diagIdx = js.indexOf('async function omniDnsResolveUrl(');
const diagSnippet = js.slice(diagIdx, diagIdx + 1400);
if (diagSnippet.includes('application/dns-json') || !diagSnippet.includes('application/dns-message')) {
  throw new Error('diag resolver did not switch to wire format');
}
if (js.split('function omniDnsParseMessage(').length - 1 !== 1) throw new Error('parser count mismatch');
if (js.split('function omniDnsBuildQuery(').length - 1 !== 1) throw new Error('encoder count mismatch');
for (const must of ['?dns=', 'application/dns-message', 'omniDnsB64Url', 'omniDnsReadName', 'rcode === 3']) {
  if (!js.includes(must)) throw new Error('missing rev150 marker: ' + must);
}
if (js.includes('�')) throw new Error('U+FFFD in worker');
fs.writeFileSync('/home/user/omni-fix/omni.v90.base.js', js);
console.log('worker patches applied:', edits.join(' | '));
console.log('omni.v90.base.js bytes=', Buffer.byteLength(js, 'utf8'),
  'md5=', require('crypto').createHash('md5').update(js, 'utf8').digest('hex'));
