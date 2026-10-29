// rev147 panel patch — root rebuild of the Outbound section: honest per-IP measurement,
// persisted UI state, design-system v2 visuals. Catalog data and config generators stay.
const fs = require('fs');
let html = fs.readFileSync('/home/user/omni-fix/panel.v86.final.html', 'utf8');
const edits = [];
function rep(oldT, newT, label, expect = 1) {
  const n = html.split(oldT).length - 1;
  if (n !== expect) throw new Error(`anchor count ${n} (expected ${expect}) for: ${label}`);
  html = html.split(oldT).join(newT);
  edits.push(label);
}

/* 1) replace OUTBOUND_JSON_STATE block with the rev147 engine */
const oldState = `  var OUTBOUND_JSON_STATE = {
    selectedUserUuid: "",
    entryMode: "natnet_snapp",
    jsonTab: "marzban",
    regionFilter: "all",
    searchQuery: "",
    relaySource: "auto",
    pingMap: {},
    subSyncedCount: null
  };`;
const engine = fs.readFileSync('/home/user/omni-fix/.outbound_engine_v87.js', 'utf8').replace(/\n$/, '');
rep(oldState, engine, 'OUTBOUND_JSON_STATE -> rev147 outbound engine');

/* 2) replace the whole OutboundView function via brace matching */
const vStart = html.indexOf('  function OutboundView(e) {');
if (vStart < 0) throw new Error('OutboundView start not found');
let d = 0, started = false, vEnd = vStart;
for (; vEnd < html.length; vEnd++) {
  const c = html[vEnd];
  if (c === '{') { d++; started = true; }
  else if (c === '}') { d--; if (started && d === 0) { vEnd++; break; } }
}
const view = fs.readFileSync('/home/user/omni-fix/.outbound_view_v87.js', 'utf8').replace(/\n$/, '');
html = html.slice(0, vStart) + view + html.slice(vEnd);
edits.push('OutboundView replaced');

/* 3) replace the omni-outbound-* handler chain */
const chainStart = '        } else if (i === "omni-outbound-add") {';
const startIdx = html.indexOf(chainStart);
if (startIdx < 0) throw new Error('outbound handler chain start not found');
const twpAnchor = '\n        if (i === "omni-twp-health-native") {';
const twpIdx = html.indexOf(twpAnchor, startIdx);
if (twpIdx < 0) throw new Error('twp anchor after outbound chain not found');
const handlers = fs.readFileSync('/home/user/omni-fix/.outbound_handlers_v87.js', 'utf8').replace(/\n$/, '');
html = html.slice(0, startIdx) + handlers + html.slice(twpIdx);
edits.push('omni-outbound-* handler chain replaced');

/* 4) search input listener must write the new state */
rep(
  `if (t.target && t.target.id === "outbound-cc-search") { OUTBOUND_JSON_STATE.searchQuery = t.target.value; e.rerenderView("outbound");`,
  `if (t.target && t.target.id === "outbound-cc-search") { OUTBOUND_UI.searchQuery = t.target.value; obSave(); e.rerenderView("outbound");`,
  'search input wired to OUTBOUND_UI'
);

/* 5) relay context reads the new state */
rep(
  `    const src = OUTBOUND_JSON_STATE.relaySource || "auto";`,
  `    const src = OUTBOUND_UI.relaySource || "auto";`,
  'relay context reads OUTBOUND_UI.relaySource'
);

/* 6) existing global change listener rewired to OUTBOUND_UI + hide-dead switch */
rep(
  `      } else if (s.id === "outbound-relay-source") {
        OUTBOUND_JSON_STATE.relaySource = s.value;
        e.rerenderView("outbound");
      } else if (s.id === "ob-json-user-select" || s.id === "ob-quota-entry" || s.id === "ob-quota-exit") {
        if (s.id === "ob-json-user-select") OUTBOUND_JSON_STATE.selectedUserUuid = s.value;
        if (s.id === "ob-quota-entry") OUTBOUND_JSON_STATE.entryMode = s.value;
        if (s.id === "ob-quota-exit") {
          const allU = Array.isArray(l?.users) ? l.users : [];
          const curU = allU.find(u => u && u.uuid === (OUTBOUND_JSON_STATE.selectedUserUuid || (allU[0] && allU[0].uuid)));
          if (curU) curU.proxies = [s.value];
        }
        e.rerenderView("outbound");`,
  `      } else if (s.id === "outbound-relay-source") {
        OUTBOUND_UI.relaySource = s.value; obSave();
        e.rerenderView("outbound");
      } else if (s.id === "ob-hide-dead") {
        OUTBOUND_UI.hideDead = !!s.checked; obSave();
        e.rerenderView("outbound");
      } else if (s.id === "ob-json-user-select" || s.id === "ob-quota-entry" || s.id === "ob-quota-exit") {
        if (s.id === "ob-json-user-select") OUTBOUND_UI.selectedUserUuid = s.value;
        if (s.id === "ob-quota-entry") OUTBOUND_UI.entryMode = s.value;
        if (s.id === "ob-quota-exit") {
          const allU = Array.isArray(l?.users) ? l.users : [];
          const curU = allU.find(u => u && u.uuid === (OUTBOUND_UI.selectedUserUuid || (allU[0] && allU[0].uuid)));
          if (curU) curU.proxies = [s.value];
        }
        obSave();
        e.rerenderView("outbound");`,
  'global change listener rewired to OUTBOUND_UI'
);

/* integrity gates */
if (html.includes('OUTBOUND_JSON_STATE')) throw new Error('old OUTBOUND_JSON_STATE survived');
if (html.includes('pingMap')) throw new Error('emoji-string pingMap survived');
if (!html.includes('omni.outbound.v1')) throw new Error('new outbound store key missing');
if (!html.includes('obProbeEps') || !html.includes('omni-ob-measure-all')) throw new Error('measurement engine missing');
if (!html.includes('function OutboundView(e)')) throw new Error('OutboundView missing');
/* design-system hygiene inside the outbound view block */
const obBlock = html.slice(html.indexOf('function OutboundView(e)'), html.indexOf('function TelegramProxyView'));
for (const banned of ['rgba(15, 23, 42', 'rgba(15,23,42', '#06b6d4', '#22d3ee', '#34d399', '#38bdf8', '#10b981']) {
  if (obBlock.includes(banned)) throw new Error('hardcoded old-theme color survives in OutboundView: ' + banned);
}

fs.writeFileSync('/home/user/omni-fix/panel.v87.final.html', html);
console.log('PANEL PATCH rev147 OK —', edits.join(' | '), '| bytes=', Buffer.byteLength(html, 'utf8'));
