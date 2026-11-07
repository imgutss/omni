// Deployment is deliberately opt-in; an update can fan out through the bot.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const config=process.env.OMNI_WRANGLER_CONFIG;
if(process.env.OMNI_ALLOW_DEPLOY!=='1'||!config||!fs.existsSync(config)){
 console.error('Deployment stopped. Read docs/DEPLOY.md, back up D1 and RELEASES, and supply OMNI_ALLOW_DEPLOY=1 and OMNI_WRANGLER_CONFIG pointing to your reviewed local configuration.');
 process.exit(1);
}
const text=fs.readFileSync(config,'utf8');
if(/REPLACE_WITH_|omni\.4lifm29|production\/worker\.js|managed-worker\/live/.test(text))throw Error('Placeholder or legacy configuration: refusing deployment');
if(!/^main\s*=\s*["'][^"']*panel\/build\/worker\.js["']/m.test(text))throw Error('Configuration must target the canonical panel/build/worker.js');
const r=spawnSync('npx',['--no-install','wrangler','deploy','--no-bundle','--config',config],{stdio:'inherit'});
process.exit(r.status??1);
