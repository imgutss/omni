'use strict';
// Repository-deployed relay only. The bot-created Worker remains the panel.
const http = require('node:http'), https = require('node:https');
const host = String(process.env.TARGET_HOST || '').toLowerCase();
const route = String(process.env.TUNNEL_PATH || '');
const configured = Boolean(host && route);
if ((host || route) && (!/^[-a-z0-9]+\.[-a-z0-9]+\.workers\.dev$/.test(host) || !/^\/[a-zA-Z0-9_/-]{1,99}$/.test(route) || route.startsWith('/api/'))) throw Error('Invalid fixed panel route');
let active = 0;
const server = http.createServer((req, res) => {
  res.setHeader('cache-control', 'no-store');
  if (req.method === 'GET' && ['/', '/healthz', '/_omni/railway-health', ...(configured ? [route] : [])].includes(req.url.split('?')[0])) {
    res.writeHead(200, {'content-type': 'application/json'});
    res.end(JSON.stringify({ok:true, service:'omni-cloudflare-railway', protocol:'omni-fork-relay-v1', configured, target:host, path:route}));
  } else { res.writeHead(404); res.end(); }
});
server.on('upgrade', (req, client, head) => {
  if (!configured || req.url.split('?')[0] !== route || active >= 256 || String(req.headers.upgrade).toLowerCase() !== 'websocket' || !/^[A-Za-z0-9+/]{22}==$/.test(String(req.headers['sec-websocket-key'] || '')) || String(req.headers['sec-websocket-version']) !== '13') {
    client.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return;
  }
  active++; client.pause(); client.setNoDelay(true);
  let remote;
  const headers = {host, connection:'Upgrade', upgrade:'websocket', 'sec-websocket-version':'13', 'sec-websocket-key':req.headers['sec-websocket-key']};
  if (req.headers['sec-websocket-protocol']) headers['sec-websocket-protocol'] = req.headers['sec-websocket-protocol'];
  const upstream = https.request({hostname:host, servername:host, port:443, path:req.url, method:'GET', headers, rejectUnauthorized:true, timeout:12000});
  const close = () => { client.destroy(); remote?.destroy(); upstream.destroy(); };
  client.on('error', close); client.once('close', () => { active--; remote?.destroy(); upstream.destroy(); });
  upstream.on('upgrade', (res, socket, extra) => {
    remote=socket; socket.setTimeout(0); socket.setNoDelay(true);
    const responseHeaders=[]; for(let i=0;i<res.rawHeaders.length;i+=2) responseHeaders.push(res.rawHeaders[i]+': '+res.rawHeaders[i+1]);
    client.write('HTTP/1.1 101 Switching Protocols\r\n'+responseHeaders.join('\r\n')+'\r\n\r\n');
    if(extra.length) client.write(extra); if(head.length) socket.write(head);
    socket.on('error',close); socket.once('close',()=>client.destroy()); client.pipe(socket); socket.pipe(client); client.resume();
  });
  upstream.on('response', res => { client.end('HTTP/1.1 '+res.statusCode+' Upstream Rejected\r\nConnection: close\r\n\r\n'); res.resume(); });
  upstream.on('timeout',close); upstream.on('error',close); upstream.end();
});
server.listen(Number(process.env.PORT || 8080), '0.0.0.0');
process.on('SIGTERM', () => { server.close(()=>process.exit(0)); setTimeout(()=>process.exit(0),10000).unref(); });
