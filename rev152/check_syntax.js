const fs = require('fs');
const html = fs.readFileSync('/home/user/omni-fix/panel.v92.final.html','utf8');
const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
let m, i = 0, fail = 0;
while ((m = re.exec(html))) {
  i++;
  const code = m[1];
  if (!code.trim()) continue;
  try { new Function(code); }
  catch (e) { fail++; console.log(`script #${i} SYNTAX ERROR:`, e.message); }
}
console.log(`checked ${i} script blocks, failures=${fail}`);
process.exit(fail ? 1 : 0);
