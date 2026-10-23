// Source bundled as api/index.js for each Vercel WebSocket relay deployment.
// Public client path: /ws/vl/{uuid}; upstream path is the job's private ws_path.
import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

const TARGET_DOMAIN = String(process.env.TARGET_DOMAIN || '').trim().replace(/\/+$/, '');
const TARGET_PATH = normalizePath(process.env.TARGET_PATH || '');
const PUBLIC_RELAY_PATH = normalizePath(process.env.PUBLIC_RELAY_PATH || '/ws/vl');
const MAX_ACTIVE_WEBSOCKETS = 128;
const UPSTREAM_HANDSHAKE_TIMEOUT_MS = 10000;
const MAX_WS_PAYLOAD = 16 * 1024 * 1024;
let activeWebSockets = 0;

const server = createServer(handleHttpRequest);
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: MAX_WS_PAYLOAD });

server.on('upgrade', (req, socket, head) => {
  socket.on('error', () => {});
  const url = parseRequestUrl(req);
  if (!url) return rejectUpgrade(socket, 400, 'Bad Request');
  const uuid = extractUuid(url);
  if (!uuid || !isUuid(uuid)) return rejectUpgrade(socket, 404, 'WebSocket route not found');
  if (!TARGET_DOMAIN || !TARGET_PATH || !PUBLIC_RELAY_PATH) return rejectUpgrade(socket, 500, 'Misconfigured relay');
  if (activeWebSockets >= MAX_ACTIVE_WEBSOCKETS) return rejectUpgrade(socket, 503, 'Relay is busy');

  let upstream;
  let client = null;
  let counted = false;
  let handshakeFinished = false;
  const timer = setTimeout(() => {
    if (handshakeFinished) return;
    handshakeFinished = true;
    try { upstream?.terminate(); } catch (_) {}
    rejectUpgrade(socket, 504, 'Upstream WebSocket handshake timed out');
  }, UPSTREAM_HANDSHAKE_TIMEOUT_MS);
  timer.unref?.();

  try {
    const headers = {
      'x-forwarded-for': getClientIp(req),
      'x-real-ip': getClientIp(req),
      'x-forwarded-proto': 'https',
      'x-forwarded-host': String(req.headers.host || ''),
      'user-agent': String(req.headers['user-agent'] || 'Omni-Vercel-Relay'),
    };
    if (req.headers.origin) headers.origin = String(req.headers.origin);
    upstream = new WebSocket(makeUpstreamUrl(), {
      headers,
      handshakeTimeout: UPSTREAM_HANDSHAKE_TIMEOUT_MS,
      perMessageDeflate: false,
      maxPayload: MAX_WS_PAYLOAD,
      followRedirects: false,
    });
  } catch (err) {
    clearTimeout(timer);
    handshakeFinished = true;
    console.error('[Omni WS relay] invalid upstream', { message: String(err?.message || err) });
    return rejectUpgrade(socket, 500, 'Invalid upstream URL');
  }

  upstream.once('open', () => {
    if (handshakeFinished || socket.destroyed) {
      try { upstream.close(); } catch (_) {}
      return;
    }
    handshakeFinished = true;
    clearTimeout(timer);
    try {
      wss.handleUpgrade(req, socket, head, (accepted) => {
        client = accepted;
        activeWebSockets += 1;
        counted = true;
        console.info('[Omni WS relay] connected', { uuid: uuid.slice(0, 8), active: activeWebSockets });

        client.on('message', (data, isBinary) => {
          if (upstream.readyState !== WebSocket.OPEN) return;
          if (upstream.bufferedAmount > 4 * 1024 * 1024) return closePair(1013, 'upstream backpressure');
          upstream.send(data, { binary: isBinary }, (err) => {
            if (err) {
              console.error('[Omni WS relay] client-to-upstream failed', { message: String(err.message || err) });
              closePair(1011, 'relay send failed');
            }
          });
        });
        upstream.on('message', (data, isBinary) => {
          if (client.readyState !== WebSocket.OPEN) return;
          if (client.bufferedAmount > 4 * 1024 * 1024) return closePair(1013, 'client backpressure');
          client.send(data, { binary: isBinary }, (err) => {
            if (err) {
              console.error('[Omni WS relay] upstream-to-client failed', { message: String(err.message || err) });
              closePair(1011, 'relay send failed');
            }
          });
        });
        client.on('close', (code, reason) => {
          releaseSlot();
          if (upstream.readyState === WebSocket.OPEN) closeUpstream(code, reason);
          else if (upstream.readyState === WebSocket.CONNECTING) upstream.terminate();
        });
        client.on('error', (err) => {
          console.warn('[Omni WS relay] client error', { message: String(err?.message || err) });
          if (upstream.readyState === WebSocket.OPEN) upstream.terminate();
        });
        upstream.on('close', (code, reason) => {
          releaseSlot();
          if (client.readyState === WebSocket.OPEN) closeClient(code, reason);
        });
        upstream.on('error', (err) => {
          console.warn('[Omni WS relay] upstream error', { uuid: uuid.slice(0, 8), message: String(err?.message || err) });
          if (client.readyState === WebSocket.OPEN) client.close(1011, 'upstream relay error');
        });
      });
    } catch (err) {
      console.error('[Omni WS relay] client upgrade failed', { message: String(err?.message || err) });
      try { upstream.terminate(); } catch (_) {}
      if (!socket.destroyed) rejectUpgrade(socket, 502, 'WebSocket upgrade failed');
    }
  });

  upstream.once('unexpected-response', (_request, response) => {
    clearTimeout(timer);
    if (handshakeFinished) return;
    handshakeFinished = true;
    console.warn('[Omni WS relay] upstream rejected upgrade', { uuid: uuid.slice(0, 8), status: response.statusCode });
    response.resume();
    rejectUpgrade(socket, 502, 'Upstream WebSocket rejected');
  });
  upstream.on('error', (err) => {
    clearTimeout(timer);
    if (handshakeFinished) return;
    handshakeFinished = true;
    console.error('[Omni WS relay] upstream handshake failed', { uuid: uuid.slice(0, 8), message: String(err?.message || err) });
    rejectUpgrade(socket, 502, 'Upstream WebSocket handshake failed');
  });

  function releaseSlot() {
    if (!counted) return;
    counted = false;
    activeWebSockets = Math.max(0, activeWebSockets - 1);
  }
  function closePair(code, reason) {
    if (client && client.readyState === WebSocket.OPEN) closeClient(code, Buffer.from(reason || ''));
    if (upstream && upstream.readyState === WebSocket.OPEN) closeUpstream(code, Buffer.from(reason || ''));
  }
  function closeClient(code, reason) {
    if (!client || client.readyState !== WebSocket.OPEN) return;
    const safe = closeReason(reason);
    if (isValidCloseCode(code)) client.close(code, safe); else client.close();
  }
  function closeUpstream(code, reason) {
    if (!upstream || upstream.readyState !== WebSocket.OPEN) return;
    const safe = closeReason(reason);
    if (isValidCloseCode(code)) upstream.close(code, safe); else upstream.close();
  }
});

function handleHttpRequest(req, res) {
  const url = parseRequestUrl(req);
  const path = url ? normalizePath(url.pathname) : '';
  if (req.method === 'OPTIONS' && path === '/_omni-health') {
    res.statusCode = 204;
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
    res.setHeader('access-control-max-age', '600');
    res.end();
    return;
  }
  const isHealth = path === '/_omni-health' ||
    ((path === '/api/index' || path === '/api' || path === '/') && url?.searchParams.get('health') === '1');
  if (isHealth) {
    if (!TARGET_DOMAIN || !TARGET_PATH) return sendHealth(res, 503, false, 'Relay is not configured');
    probeUpstreamWebSocket()
      .then(() => sendHealth(res, 200, true, 'Omni Vercel WebSocket relay is online'))
      .catch((err) => {
        console.warn('[Omni WS relay] health probe failed', { message: String(err?.message || err) });
        sendHealth(res, 502, false, 'Upstream WebSocket health check failed');
      });
    return;
  }
  if (path === PUBLIC_RELAY_PATH || path.startsWith(PUBLIC_RELAY_PATH + '/')) {
    res.statusCode = 426;
    res.setHeader('upgrade', 'websocket');
    res.setHeader('connection', 'Upgrade');
    res.end('WebSocket upgrade required');
    return;
  }
  res.statusCode = 404;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end('Not Found');
}

function probeUpstreamWebSocket() {
  return new Promise((resolve, reject) => {
    let settled = false;
    let socket;
    const timeout = setTimeout(() => finish(new Error('upstream WebSocket probe timed out')), 7000);
    timeout.unref?.();
    function finish(err) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        if (socket && socket.readyState === WebSocket.OPEN) socket.close(1000, 'health probe complete');
        else if (socket && socket.readyState === WebSocket.CONNECTING) socket.terminate();
      } catch (_) {}
      if (err) reject(err); else resolve();
    }
    try {
      socket = new WebSocket(makeUpstreamUrl(), {
        headers: { 'user-agent': 'Omni-Vercel-Health-Probe' },
        handshakeTimeout: 5000,
        perMessageDeflate: false,
        followRedirects: false,
      });
      socket.once('open', () => finish());
      socket.once('unexpected-response', (_request, response) => {
        response.resume();
        finish(new Error('upstream returned HTTP ' + String(response.statusCode || 'unknown')));
      });
      socket.once('error', (err) => finish(err));
    } catch (err) { finish(err); }
  });
}

function makeUpstreamUrl() {
  const target = new URL(TARGET_DOMAIN);
  target.protocol = target.protocol === 'https:' ? 'wss:' : target.protocol === 'http:' ? 'ws:' : target.protocol;
  target.pathname = TARGET_PATH;
  target.search = '';
  target.hash = '';
  return target.toString();
}
function parseRequestUrl(req) {
  try { return new URL(req.url || '/', 'https://' + String(req.headers.host || 'localhost')); }
  catch (_) { return null; }
}
function extractUuid(url) {
  const path = normalizePath(url.pathname);
  let raw = '';
  if (path.startsWith(PUBLIC_RELAY_PATH + '/')) raw = path.slice(PUBLIC_RELAY_PATH.length + 1).split('/')[0] || '';
  else if ((path === '/api/index' || path === '/api') && url.searchParams.get('ws') === '1') raw = url.searchParams.get('uuid') || '';
  try { return decodeURIComponent(raw).toLowerCase(); } catch (_) { return ''; }
}
function getClientIp(req) {
  const real = String(req.headers['x-real-ip'] || '').split(',')[0].trim();
  if (real) return real;
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}
function sendHealth(res, status, healthy, body) {
  if (res.writableEnded || res.destroyed) return;
  res.statusCode = status;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('cache-control', 'no-store, no-cache, must-revalidate');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('x-omni-relay', healthy ? 'healthy' : 'unhealthy');
  res.end(body);
}
function rejectUpgrade(socket, status, message) {
  if (!socket || socket.destroyed) return;
  const body = String(message || 'Bad Gateway');
  try {
    socket.write('HTTP/1.1 ' + status + ' ' + statusText(status) + '\r\n' +
      'Connection: close\r\nContent-Type: text/plain; charset=utf-8\r\n' +
      'Content-Length: ' + Buffer.byteLength(body) + '\r\n\r\n' + body);
  } catch (_) {}
  socket.destroy();
}
function statusText(status) {
  return ({400:'Bad Request',404:'Not Found',426:'Upgrade Required',500:'Internal Server Error',502:'Bad Gateway',503:'Service Unavailable',504:'Gateway Timeout'})[status] || 'Error';
}
function normalizePath(value) {
  let path = String(value || '').trim();
  if (!path) return '';
  if (!path.startsWith('/')) path = '/' + path;
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}
function isValidCloseCode(code) {
  return Number.isInteger(code) && code >= 1000 && code <= 4999 && ![1004,1005,1006,1015].includes(code);
}
function closeReason(reason) {
  const text = Buffer.isBuffer(reason) ? reason.toString('utf8') : String(reason || '');
  return Buffer.from(text).subarray(0, 123).toString('utf8');
}

export default server;
