// Extract the rev150 DNS core from the real worker file and run it against live DoH providers.
const fs = require('fs');
const src = fs.readFileSync('/home/user/omni-fix/omni.v90.base.js', 'utf8');
const start = src.indexOf('  function omniDnsIsBogon(');
const endMarker = '  if (p2 === "/api/diag/dns-batch" && method === "POST") {';
const end = src.indexOf(endMarker);
if (start < 0 || end < 0) throw new Error('DNS core anchors missing');
const block = src.slice(start, end);
const ctx = { btoa, fetch, URL, AbortSignal, console, Math, Date, String, Number, Set, DataView, Uint8Array };
const vm = require('vm');
vm.createContext(ctx);
vm.runInContext(block + '\nthis.omniDnsResolveUrl=omniDnsResolveUrl;this.omniDnsClassify=omniDnsClassify;this.omniDnsReference=omniDnsReference;', ctx);

let catSrc = fs.readFileSync('/home/user/omni-fix/.dns_catalog_v89.js', 'utf8').trim().replace(/^Ut\s*=/, '').trim().replace(/,\s*$/, '');
const Ut = eval('(' + catSrc + ')');

(async () => {
  let okCount = 0, failCount = 0;
  for (const qtype of ['A', 'AAAA']) {
    console.log('===== ' + qtype);
    for (const s of Ut) {
      const r = await ctx.omniDnsResolveUrl(s.url, 'youtube.com', qtype);
      if (r.ok) okCount++; else failCount++;
      console.log((r.ok ? 'OK ' : 'FAIL'), r.verdict.padEnd(10), ('ms=' + r.ms).padEnd(8), s.id.padEnd(13), r.ok ? r.ips.slice(0, 2).join(',') : (r.error || '').slice(0, 48));
    }
  }
  console.log('\nreference:', await ctx.omniDnsReference('youtube.com', 'A'));
  const nx = await ctx.omniDnsResolveUrl('https://cloudflare-dns.com/dns-query', 'nonexistent-omni-9f3k2.example', 'A');
  console.log('nxdomain verdict:', nx.verdict, 'ms=', nx.ms);
  const bad = await ctx.omniDnsResolveUrl('ftp://not-https.example/dns', 'youtube.com', 'A');
  console.log('bad scheme verdict:', bad.verdict);
  console.log('\ntotal ok=' + okCount + ' fail=' + failCount);
})();
