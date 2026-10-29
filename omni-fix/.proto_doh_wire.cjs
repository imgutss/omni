// Prototype: RFC 8484 binary DoH codec — universal wire-format query/parse.
function dnsEncodeName(domain) {
  const parts = String(domain).replace(/\.$/, '').toLowerCase().split('.').filter(Boolean);
  const out = [];
  for (const p of parts) {
    const b = Buffer.from(p, 'ascii');
    if (!b.length || b.length > 63) throw new Error('bad label');
    out.push(b.length);
    for (const x of b) out.push(x);
  }
  out.push(0);
  return Buffer.from(out);
}
function dnsBuildQuery(domain, type) {
  const id = (Math.random() * 65536) | 0;
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id, 0);
  header.writeUInt16BE(0x0100, 2); // RD=1 standard query
  header.writeUInt16BE(1, 4);     // QDCOUNT=1
  const q = dnsEncodeName(domain);
  const tail = Buffer.alloc(4);
  tail.writeUInt16BE(type === 'AAAA' ? 28 : 1, 0);
  tail.writeUInt16BE(1, 2); // IN
  return Buffer.concat([header, q, tail]);
}
function dnsReadName(buf, off) {
  const labels = [];
  let jumped = false, retOff = off, guard = 0;
  while (off < buf.length) {
    if (++guard > 128) throw new Error('name loop');
    const len = buf[off];
    if (len === 0) { if (!jumped) retOff = off + 1; break; }
    if ((len & 0xc0) === 0xc0) {
      const ptr = ((len & 0x3f) << 8) | buf[off + 1];
      if (!jumped) retOff = off + 2;
      jumped = true; off = ptr; continue;
    }
    labels.push(buf.slice(off + 1, off + 1 + len).toString('ascii'));
    off += len + 1;
  }
  return { name: labels.join('.'), next: retOff };
}
function dnsParseMessage(buf) {
  if (buf.length < 12) throw new Error('short message');
  const flags = buf.readUInt16BE(2);
  const rcode = flags & 0x0f;
  const qd = buf.readUInt16BE(4), an = buf.readUInt16BE(6);
  let off = 12;
  for (let i = 0; i < qd; i++) { const q = dnsReadName(buf, off); off = q.next + 4; }
  const answers = [];
  for (let i = 0; i < an; i++) {
    const nm = dnsReadName(buf, off); off = nm.next;
    const type = buf.readUInt16BE(off), cls = buf.readUInt16BE(off + 2);
    const ttl = buf.readUInt32BE(off + 4), rdlen = buf.readUInt16BE(off + 8);
    off += 10;
    const rdata = buf.slice(off, off + rdlen);
    let data = null;
    if (type === 1 && rdlen === 4) data = [...rdata].join('.');
    else if (type === 28 && rdlen === 16) {
      const parts = [];
      for (let k = 0; k < 16; k += 2) parts.push(rdata.readUInt16BE(k).toString(16));
      data = parts.join(':');
    } else if (type === 5) data = dnsReadName(buf, off).name;
    answers.push({ name: nm.name, type, cls, ttl, data });
    off += rdlen;
  }
  return { rcode, answers };
}
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

module.exports = { dnsBuildQuery, dnsParseMessage, b64url };

if (require.main === module) {
  const fs = require('fs');
  let src = fs.readFileSync('/home/user/omni-fix/.dns_catalog_v89.js', 'utf8').trim().replace(/^Ut\s*=/, '').trim().replace(/,\s*$/, '');
  const Ut = eval('(' + src + ')');
  (async () => {
    for (const qtype of ['A', 'AAAA']) {
      console.log('===== qtype', qtype);
      for (const s of Ut) {
        const u = new URL(s.url);
        const wire = dnsBuildQuery('youtube.com', qtype);
        const target = u.origin + u.pathname + '?dns=' + b64url(wire);
        try {
          const r = await fetch(target, { headers: { accept: 'application/dns-message' }, signal: AbortSignal.timeout(8000) });
          if (!r.ok) { console.log(String(r.status).padEnd(4), s.id.padEnd(13), s.url); continue; }
          const buf = Buffer.from(await r.arrayBuffer());
          const msg = dnsParseMessage(buf);
          const ips = msg.answers.filter((a) => a.type === (qtype === 'A' ? 1 : 28)).map((a) => a.data);
          console.log('200 rcode=' + msg.rcode, ('ips=' + ips.length).padEnd(7), s.id.padEnd(13), ips.slice(0, 2).join(','));
        } catch (e) { console.log('ERR ', e.name.padEnd(11), s.id.padEnd(13), String(e.message).slice(0, 36)); }
      }
    }
  })();
}
