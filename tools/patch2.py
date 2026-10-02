import io

p = 'src/links.js'
s = io.open(p, encoding='utf-8').read()

start = s.index('export function buildClash(user, settings, addrs) {')
end = s.index('/* ─────────────── ساب‌لینک ─────────────── */')

new_clash = r'''function clashProxy(user, settings, host, port, proto = 'vless', idx = 1) {
  const path = settings.path || '/ws';
  const sni = sniFor(settings) || host;
  const tls = isTlsPort(port);
  const ed = Number(user.early_data || settings.early_data || 2048);
  const base = {
    name: `omni-${idx}-${proto}-${port}`,
    type: proto,
    server: host,
    port: Number(port),
    tls,
    servername: tls ? sni : undefined,
    network: 'ws',
    'client-fingerprint': user.fingerprint || settings.fingerprint || 'chrome',
    'ws-opts': {
      path,
      headers: { Host: sni || host },
      ...(ed > 0 ? { 'max-early-data': ed, 'early-data-header-name': 'Sec-WebSocket-Protocol' } : {}),
    },
    udp: true,
  };
  if (proto === 'vless') base.uuid = user.uuid;
  else base.password = settings.trojan_password || '';
  return base;
}

export function buildClash(user, settings, addrs, ports = [443]) {
  const proxies = [];
  let i = 0;
  const both = String(settings.proto || 'both') === 'both' && Boolean(settings.trojan_password);
  for (const h of addrs) {
    for (const port of ports) {
      proxies.push(clashProxy(user, settings, h, port, 'vless', ++i));
      if (both) proxies.push(clashProxy(user, settings, h, port, 'trojan', i));
    }
  }
  return {
    'mixed-port': 7890,
    'allow-lan': false,
    mode: 'rule',
    'log-level': 'warning',
    dns: { enable: true, ipv6: false, nameserver: [settings.dns_upstream || 'https://1.1.1.1/dns-query'] },
    proxies,
    'proxy-groups': [
      { name: '🚀 Omni', type: 'select', proxies: proxies.map((p) => p.name) },
      { name: '♻️ Auto', type: 'url-test', proxies: proxies.map((p) => p.name), url: 'http://www.gstatic.com/generate_204', interval: 300 },
    ],
    rules: ['DOMAIN-SUFFIX,ir,DIRECT', 'GEOIP,IR,DIRECT', 'MATCH,🚀 Omni'],
  };
}

'''
s = s[:start] + new_clash + s[end:]
io.open(p, 'w', encoding='utf-8').write(s)
print('buildClash چند‌پورتی شد:', len(s), 'بایت')
