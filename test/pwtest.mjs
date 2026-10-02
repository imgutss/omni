import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('http://127.0.0.1:8790/');
console.log('TITLE:', await p.title());
console.log('HTML len', (await p.content()).length);
await b.close();
