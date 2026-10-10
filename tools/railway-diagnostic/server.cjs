'use strict';
// Owned diagnostic web app only. No proxy, VLESS, SOCKS, tunneling or arbitrary destinations.
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs');
const nonce=crypto.randomBytes(18).toString('hex');
const html=process.env.OMNI_DIAG_HTML_B64?Buffer.from(process.env.OMNI_DIAG_HTML_B64,'base64'):fs.readFileSync(__dirname+'/index.html');
let egress=[];
async function checkEgress(){
 const targets=[['gstatic','https://www.gstatic.com/generate_204',204],['example','https://example.com/',200]];
 egress=await Promise.all(targets.map(async([name,url,expected])=>{try{const t=Date.now(),r=await fetch(url,{signal:AbortSignal.timeout(12000),redirect:'error'});const data={name,status:r.status,ok:r.status===expected,ms:Date.now()-t};await r.body?.cancel();return data;}catch(e){return{name,ok:false,error:String(e.message).slice(0,120)};}}));
}
const common={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const server=http.createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if((req.method==='GET'||req.method==='HEAD')&&path==='/'){
  res.writeHead(200,{...common,'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self' wss:; base-uri 'none'; frame-ancestors 'none'"});return res.end(req.method==='HEAD'?undefined:html);
 }
 if(req.method==='GET'&&path==='/healthz'){
  res.writeHead(200,{...common,'content-type':'application/json'});return res.end(JSON.stringify({ok:true,probe:'omni-railway-diagnostic',scope:'HTTP and WebSocket echo only',nonce,egress}));
 }
 res.writeHead(404,common);res.end('not found');
});
server.on('upgrade',(req,socket,head)=>{
 const key=req.headers['sec-websocket-key'];
 if(req.url!=='/ws'||!key||req.headers.upgrade?.toLowerCase()!=='websocket')return socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
 const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
 socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
 socket.setTimeout(18000,()=>socket.destroy());socket.on('error',()=>socket.destroy());let pending=head;
 function parse(){while(pending.length>=2){const op=pending[0]&15,fin=!!(pending[0]&128),masked=!!(pending[1]&128),len=pending[1]&127;if(!fin||!masked||len>125)return socket.destroy();if(pending.length<6+len)return;const mask=pending.subarray(2,6),payload=Buffer.from(pending.subarray(6,6+len));for(let i=0;i<len;i++)payload[i]^=mask[i%4];pending=pending.subarray(6+len);if(op===8)return socket.end(Buffer.from([136,0]));if(op!==1&&op!==2&&op!==9)return socket.destroy();socket.write(Buffer.concat([Buffer.from([128|(op===9?10:op),payload.length]),payload]));}}
 socket.on('data',chunk=>{pending=Buffer.concat([pending,chunk]);if(pending.length>1024)return socket.destroy();parse();});parse();
});
server.maxConnections=60;server.headersTimeout=15000;server.requestTimeout=20000;
server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>{console.log('OMNI_DIAGNOSTIC_READY (HTTP/WS echo; not a proxy)');checkEgress().catch(()=>{});});
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),1500).unref();});
