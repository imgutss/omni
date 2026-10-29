const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(path.join('/home/user/omni-fix/.dom', 'node_modules', 'jsdom'));
const html = fs.readFileSync('/home/user/omni-fix/panel.v92.final.html', 'utf8');
const errors = [], logs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push((e.detail && e.detail.message) || e.message));
vc.on('error', (...a) => logs.push('err:'+a.join(' ')));
vc.on('log', (...a) => logs.push(a.join(' ')));
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true,
  url: 'https://node.example.test/#/configs', virtualConsole: vc,
  beforeParse(window) {
    window.matchMedia = () => ({ matches:false, media:'', onchange:null, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}, dispatchEvent(){return false;} });
    window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} takeRecords(){return [];} };
    window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
    window.scrollTo = () => {};
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.RTCPeerConnection = class { constructor(){throw new Error('no webrtc');} };
    if (!window.AbortSignal.timeout) window.AbortSignal.timeout = ms => { const ac = new window.AbortController(); setTimeout(()=>ac.abort(), ms); return ac.signal; };
    const mem = new Map();
    Object.defineProperty(window,'localStorage',{configurable:true,get:()=>({getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k),clear:()=>mem.clear(),key:i=>[...mem.keys()][i]??null,get length(){return mem.size;}})});
    window.fetch = async (u) => { const j=o=>({ok:true,status:200,headers:{get:()=>null},json:async()=>o,text:async()=>JSON.stringify(o)});
      const url=String(u);
      if (url.includes('/api/whoami')) return j({ok:true,username:'admin',role:'owner',installed:true,panelName:'K',storageMode:'normal'});
      if (url.startsWith('http')) return j({ok:true});
      return j({ok:true,rows:[],users:[],settings:{}});
    };
  }});
(async () => {
  await new Promise(r=>setTimeout(r,2000));
  const w = dom.window, d = w.document;
  console.log('hash=', w.location.hash);
  console.log('app root children:', d.querySelector('#app')?.children.length || d.body.children.length);
  console.log('has cfg-clean:', !!d.querySelector('#cfg-clean'));
  console.log('view heads:', [...d.querySelectorAll('.view-head h2')].map(x=>x.textContent).slice(0,5));
  console.log('nav buttons sample:', [...d.querySelectorAll('[data-action="nav"]')].map(b=>b.dataset.view).slice(0,12));
  console.log('errors:', errors.slice(0,5));
  console.log('logs:', logs.slice(0,8));
  process.exit(0);
})();
