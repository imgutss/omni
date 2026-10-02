/* ══════════════════════════════════════════════════════════════════════════
   Omni — tools/domain-check.mjs
   «آیا این دامنه می‌تواند به‌عنوان آدرس کانفیگ استفاده شود؟»

   قاعده‌ی کانفیگ‌های گروه «Domain»: کلاینت به آی‌پی دامنه وصل می‌شود ولی
   SNI و هدر Host دامنه‌ی خودِ پنل است. پس آن آی‌پی باید ورکر ما را سرو کند
   (نه ارور 1034 کلودفلر).

   این ابزار همان کار را از ترمینال انجام می‌دهد: DNS دامنه را می‌گیرد،
   TLS با SNI پنل + درخواست /api/health می‌فرستد و نتیجه را می‌گوید.

   اجرا:
     node tools/domain-check.mjs --base https://omni.rasa-744a56.workers.dev \
       cdn.jsdelivr.net registry.npmjs.org www.speedtest.net medium.com
   خروجی: فهرست دامنه‌های سالم — آماده‌ی گذاشتن در settings.address_domains
   ══════════════════════════════════════════════════════════════════════════ */
import dns from 'node:dns/promises';
import tls from 'node:tls';

const args = process.argv.slice(2);
const arg = (n, d = null) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const BASE = String(arg('base', process.env.OMNI_BASE || 'https://omni.rasa-744a56.workers.dev')).replace(/\/$/, '');
const HOST = new URL(BASE).hostname;
const PORT = Number(arg('port', 443));
const list = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--base') && args[i - 1] !== '--port');

/** اتصال TLS به ip:port با SNI = دامنه‌ی پنل، و درخواست /api/health */
function probe(ip, sni, port = 443, timeout = 10000) {
  return new Promise((res) => {
    const t0 = Date.now();
    let done = false, data = '';
    const finish = (ok, note) => {
      if (done) return; done = true;
      try { sock.destroy(); } catch { /* ignore */ }
      res({ ok, ms: Date.now() - t0, note });
    };
    const sock = tls.connect({ host: ip, port, servername: sni, rejectUnauthorized: false, timeout }, () => {
      sock.write(`GET /api/health HTTP/1.1\r\nHost: ${sni}\r\nUser-Agent: omni-domain-check\r\nAccept: */*\r\nConnection: close\r\n\r\n`);
    });
    sock.on('data', (d) => {
      data += d.toString('latin1');
      const line = data.split('\r\n')[0] || '';
      if (/^HTTP\/1\./.test(line)) {
        const code = Number(line.split(' ')[1]);
        // 200/401 = ورکر خودمان جواب داده | 403 + 1034 = آی‌پی، این هاست را سرو نمی‌کند
        finish(code === 200 || code === 401, `${code} ${code === 403 ? 'error 1034' : line.slice(9, 24)}`);
      }
    });
    sock.on('timeout', () => finish(false, 'timeout'));
    sock.on('error', (e) => finish(false, (e.code || e.message || '').slice(0, 28)));
  });
}

if (!list.length) {
  console.error('هیچ دامنه‌ای داده نشد.\nمثال: node tools/domain-check.mjs cdn.jsdelivr.net medium.com www.speedtest.net');
  process.exit(1);
}
console.log(`▸ ${list.length} دامنه در برابر SNI = ${HOST} بررسی می‌شود (پورت ${PORT})\n`);
const good = [];
for (const domain of list) {
  let ips = [];
  try { ips = (await dns.resolve4(domain)).slice(0, 2); } catch { console.log(`  ⚠️  ${domain.padEnd(28)} DNS ندارد`); continue; }
  let best = null;
  for (const ip of ips) {
    const r = await probe(ip, HOST, PORT);
    if (!best || (r.ok && !best.ok)) best = { ip, ...r };
    if (r.ok) break;
  }
  console.log(`  ${best.ok ? '✅' : '❌'} ${domain.padEnd(28)} ${String(best.ip).padEnd(16)} ${best.ok ? `${best.ms}ms` : best.note}`);
  if (best.ok) good.push(domain);
}
console.log(`\n▸ ${good.length}/${list.length} دامنه سالم`);
if (good.length) console.log(`▸ برای تنظیمات: ${JSON.stringify(good)}`);
