// engine parity: omni.v91.js vs omni.v92.js must differ ONLY in panel_default + OMNI_BUILD
const fs = require('fs');
const strip = f => fs.readFileSync(f,'utf8')
  .replace(/var panel_default = "[\s\S]*?";;/, '<PANEL>')
  .replace(/var OMNI_BUILD = \{[^}]*\};/, '<BUILD>');
const a = strip('/home/user/omni-fix/omni.v91.js');
const b = strip('/home/user/omni-fix/omni.v92.js');
console.log('engine parity:', a === b ? 'IDENTICAL' : 'DIVERGENT');
if (a !== b) { const la = a.split('\n'), lb = b.split('\n'); let n=0; for (let i=0;i<Math.max(la.length,lb.length);i++){ if(la[i]!==lb[i]){console.log('first diff at line',i+1); n++; if(n>=5)break;}} process.exit(1);} 
