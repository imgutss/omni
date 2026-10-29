
const user865 = JSON.parse(fs.readFileSync('/home/user/rev152/user865.json', 'utf8'));
const clean139 = JSON.parse(fs.readFileSync('/home/user/rev152/clean139.json', 'utf8'));
const oldPanel = fs.readFileSync('panel.v91.final.html', 'utf8');
const old255 = [...oldPanel.match(/var OMNI_SEED_V4_USER = \[([^\]]+)\];/)[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);

(async () => {
  const bundle = makeDom(new Map());
  const w = bundle.dom.window, d = w.document;
  const { errors } = bundle;
  await new Promise((r) => setTimeout(r, 1600));
  const $ = (sel) => d.querySelector(sel);
  const $$ = (sel) => [...d.querySelectorAll(sel)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* navigate to the config-builder view the same way the sidebar does */
  const nav = $('.nav-item[data-view="configs"], [data-view="configs"]');
  ok(!!nav, 'configs nav entry rendered in sidebar');
  nav.click();
  await wait(400);
  const card = $('#cfg-clean');
  ok(!!card, 'configs view renders the IP pack card');
  const chips = $$('#cfg-clean .chip[data-action="omni-cfg-pack"]');
  const chipVals = chips.map(c => c.getAttribute('data-v'));
  ok(JSON.stringify(chipVals) === JSON.stringify(['userv4', 'userclean', 'userv6', 'mci', 'mtn', 'bn', 'world']),
    'pack chip order includes userclean: ' + chipVals.join(','));
  const userv4Chip = chips.find(c => c.dataset.v === 'userv4');
  const cleanChip = chips.find(c => c.dataset.v === 'userclean');
  ok(userv4Chip.textContent.includes('۸۶۵'), 'userv4 chip relabeled to 865');
  ok(cleanChip.textContent.includes('۱۳۹') && cleanChip.textContent.includes('عمومی'), 'userclean chip labeled 139 generic');

  /* recorder for the exact IPs the click flow feeds into config building */
  const captured = [];
  const orig = w.__omniHubBuild;
  ok(typeof orig === 'function', '__omniHubBuild exists before wrap');
  w.__omniHubBuild = (ips) => { captured.push(ips.map(String)); return true; };

  /* direct resolver checks */
  const p1 = w.omniPackIps('userv4');
  ok(!!p1 && p1.v4.length === 865 && p1.v6.length === 0, 'omniPackIps userv4 -> 865 v4, zero v6');
  ok(new Set(p1.v4).size === 865, 'userv4 resolver output has no duplicates');
  ok(JSON.stringify(p1.v4) === JSON.stringify(user865), 'userv4 resolver output equals merged uploaded union');
  ok(old255.every((ip, i) => p1.v4[i] === ip), 'original 255 preserved as ordered prefix');
  const p2 = w.omniPackIps('userclean');
  ok(!!p2 && p2.v4.length === 139 && p2.v6.length === 0, 'omniPackIps userclean -> 139 v4, zero v6');
  ok(new Set(p2.v4).size === 139, 'userclean resolver output has no duplicates');
  ok(JSON.stringify(p2.v4) === JSON.stringify(clean139), 'userclean resolver output equals clean-file union');
  ok(p2.label.includes('غیرکلادفلر'), 'userclean label honestly states non-Cloudflare');
  ok(p1.v4.every(ip => !p2.v4.includes(ip)), 'the two packs are disjoint');
  ok(w.omniPackIps('nope-not-a-pack') === null, 'unknown pack key resolves to null');

  /* click flow: userv4 */
  userv4Chip.click();
  await wait(200);
  ok(captured.length === 1 && captured[0].length === 865, 'clicking userv4 feeds exactly 865 IPs into config building');
  ok(new Set(captured[0]).size === 865, 'clicked userv4 build list is duplicate-free');
  ok(JSON.stringify([...captured[0]].sort()) === JSON.stringify([...user865].sort()), 'clicked userv4 build list is the full union');
  ok(userv4Chip.getAttribute('aria-pressed') === 'true', 'userv4 chip shows pressed state');
  const sec = $('#cfg-sectest');
  ok(!!sec && sec.textContent.includes('۸۶۵'), 'direct-build card shows the 865 count');

  /* click flow: userclean */
  cleanChip.click();
  await wait(200);
  ok(captured.length === 2 && captured[1].length === 139, 'clicking userclean feeds exactly 139 IPs into config building');
  ok(new Set(captured[1]).size === 139, 'clicked userclean build list is duplicate-free');
  ok(JSON.stringify([...captured[1]].sort()) === JSON.stringify([...clean139].sort()), 'clicked userclean build list is the full clean union');
  ok(cleanChip.getAttribute('aria-pressed') === 'true' && userv4Chip.getAttribute('aria-pressed') === 'false', 'pressed state moves to userclean');
  ok(sec.textContent.includes('۱۳۹'), 'direct-build card shows the 139 count');

  /* clear button resets the pack selection */
  const clearBtn = $('#cfg-clean [data-action="omni-cfg-clear"]');
  ok(!!clearBtn, 'clear-selection button present');
  clearBtn.click();
  await wait(150);
  ok(chips.every(c => c.getAttribute('aria-pressed') === 'false'), 'clear resets every pack chip');

  /* every single uploaded IP is reachable through one of the two packs */
  const allPack = new Set([...p1.v4, ...p2.v4]);
  ok(user865.every(ip => allPack.has(ip)) && clean139.every(ip => allPack.has(ip)) && allPack.size === 1004,
    'all 1,004 uploaded unique IPs live in a pack exactly once');

  w.__omniHubBuild = orig;
  ok(errors.length === 0, 'no unignored jsdom errors: ' + errors.join(' | '));
  console.log(fails ? '\nDOM PACK GATE FAIL ' + fails : '\nDOM PACK GATE ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('HARNESS CRASH', e); process.exit(2); });
