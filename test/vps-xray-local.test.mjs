// Real Xray WS+TLS/VLESS on LOOPBACK ONLY. No CDN, ACME, VPS or carrier claim.
// Set OMNI_TEST_XRAY to a checksum-verified Xray binary before running.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {WebSocket} from 'ws';
const binary=process.env.OMNI_TEST_XRAY;
assert(binary && fs.existsSync(binary),'OMNI_TEST_XRAY is required');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'omni-xray-local-'));
const agent=new URL('../tools/vps-agent.py',import.meta.url).pathname;
const uid='11111111-1111-4111-8111-111111111111';
const nonce='OMNI-LOOPBACK-ONLY-'+Date.now();
let processXray,ws;
const destination=http.createServer((req,res)=>res.end(nonce));
try {
 destination.listen(0,'127.0.0.1');await once(destination,'listening');
 const targetPort=destination.address().port;
 const reserve=net.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');
 const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const make=pl=>{
  const script='import importlib.util,json,sys;s=importlib.util.spec_from_file_location("agent",sys.argv[1]);a=importlib.util.module_from_spec(s);s.loader.exec_module(a);print(json.dumps(a.make_config(json.loads(sys.argv[2]))))';
  const r=spawnSync('python3',['-c',script,agent,JSON.stringify(pl)],{encoding:'utf8',env:{...process.env,OMNI_XRAY_BIN:binary}});
  assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
 };
 const cert=path.join(temp,'cert.pem'),key=path.join(temp,'key.pem');
 const openssl=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=relay.example.com','-addext','subjectAltName=DNS:relay.example.com','-keyout',key,'-out',cert],{encoding:'utf8'});
 assert.equal(openssl.status,0,openssl.stderr);
 const [cfg,profile]=make({kind:'ws',uuid:uid,domain:'relay.example.com',via_cdn:true,address:'snapp.ir',path:'/vzn'});
 cfg.inbounds[0].port=port;cfg.inbounds[0].listen='127.0.0.1';
 cfg.inbounds[0].streamSettings.tlsSettings.certificates=[{certificateFile:cert,keyFile:key}];
 const config=path.join(temp,'config.json');fs.writeFileSync(config,JSON.stringify(cfg));
 let validation=spawnSync(binary,['run','-test','-c',config],{encoding:'utf8'});assert.equal(validation.status,0,validation.stderr+validation.stdout);
 const [real]=make({kind:'reality',uuid:uid,sni:'www.example.com',port:port+1});
 const realPath=path.join(temp,'reality.json');fs.writeFileSync(realPath,JSON.stringify(real));
 validation=spawnSync(binary,['run','-test','-c',realPath],{encoding:'utf8'});assert.equal(validation.status,0,validation.stderr+validation.stdout);
 processXray=spawn(binary,['run','-c',config],{stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error('Xray startup timeout')),8000);let logs='';
  const data=d=>{logs+=d.toString();if(logs.includes('started')){clearTimeout(timeout);resolve();}};
  processXray.stdout.on('data',data);processXray.stderr.on('data',data);
  processXray.once('exit',code=>{clearTimeout(timeout);reject(new Error('Xray stopped '+code+' '+logs));});
 });
 ws=new WebSocket('wss://127.0.0.1:'+port+'/vzn',{servername:profile.domain,ca:fs.readFileSync(cert),rejectUnauthorized:true,headers:{Host:profile.domain},handshakeTimeout:5000});
 await once(ws,'open');
 assert.equal(ws._socket.authorized,true,'TLS certificate validation remains enabled');
 const reply=new Promise((resolve,reject)=>{
  const chunks=[];const timer=setTimeout(()=>reject(new Error('VLESS round trip timeout')),8000);
  ws.on('error',e=>{clearTimeout(timer);reject(e);});
  ws.on('message',b=>{chunks.push(Buffer.from(b));const data=Buffer.concat(chunks);if(data.includes(Buffer.from(nonce))){clearTimeout(timer);resolve(data);}});
 });
 const portBytes=Buffer.alloc(2);portBytes.writeUInt16BE(targetPort);
 const header=Buffer.concat([Buffer.from([0]),Buffer.from(uid.replaceAll('-',''),'hex'),Buffer.from([0,1]),portBytes,Buffer.from([1,127,0,0,1])]);
 ws.send(Buffer.concat([header,Buffer.from('GET / HTTP/1.1\r\nHost: loopback.test\r\nConnection: close\r\n\r\n')]));
 const received=await reply;assert(received.includes(Buffer.from('200 OK')));assert(received.includes(Buffer.from(nonce)));
 console.log('Xray REAL local test PASS: generated WS+TLS config, verified certificate, VLESS round trip, Reality config syntax. LOOPBACK ONLY; no national-network proof.');
} finally {
 ws?.terminate();
 if(processXray && processXray.exitCode===null){processXray.kill('SIGTERM');await once(processXray,'exit');}
 await new Promise(r=>destination.close(r));
 fs.rmSync(temp,{recursive:true,force:true});
}
