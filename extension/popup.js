import { getSettings, setSettings } from './settings.js';

const $ = (id) => document.getElementById(id);
let s = await getSettings();

/** Under the caregiver lock every change needs a confirm step (plan §3.5). */
function guarded(text, apply, revert) {
  if (!s.lock) return apply();
  const box = $('confirm');
  $('confirm-text').textContent = `Settings are locked. ${text}`;
  box.hidden = false;
  $('confirm-ok').focus();
  $('confirm-ok').onclick = async () => { box.hidden = true; await apply(); };
  $('confirm-cancel').onclick = () => { box.hidden = true; revert?.(); render(); };
  box.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); $('confirm-cancel').click(); } };
}
async function save(patch) { s = await setSettings(patch); render(); }

function render() {
  $('power').setAttribute('aria-checked', String(s.enabled));
  $('power').textContent = s.enabled ? 'On' : 'Off';
  $('power-label').textContent = s.enabled ? 'Protection is on' : 'Protection is off';
  $('power-hint').textContent = s.enabled ? 'Unchecked GIFs and videos start calm.' : 'Nothing is being checked or calmed.';
  $('calm-page').disabled = !s.enabled;
  $('mode-' + s.mode).checked = true;
  $('risk-' + s.onRisk).checked = true;
  $('freeze').checked = s.freezeGifs;
  $('lock').checked = s.lock;
  const ul = $('allow');
  ul.replaceChildren();
  $('allow-empty').hidden = s.allowlist.length > 0;
  for (const host of s.allowlist) {
    const li = document.createElement('li');
    const span = document.createElement('span'); span.textContent = host;
    const b = document.createElement('button');
    b.className = 'secondary'; b.textContent = 'Remove'; b.setAttribute('aria-label', `Remove ${host}`);
    b.onclick = () => guarded(`Start protecting ${host} again?`, () => save({ allowlist: s.allowlist.filter((h) => h !== host) }));
    li.append(span, b); ul.append(li);
  }
}

$('power').onclick = () => {
  const next = !s.enabled;
  guarded(next ? 'Turn protection on?' : 'Turn protection off?', () => save({ enabled: next }));
};
for (const r of document.querySelectorAll('input[name="mode"]')) r.onchange = () => guarded('Change how careful it is?', () => save({ mode: r.value }));
for (const r of document.querySelectorAll('input[name="onRisk"]')) r.onchange = () => guarded('Change what happens to flashing?', () => save({ onRisk: r.value }));
$('freeze').onchange = (e) => guarded(e.target.checked ? 'Freeze all GIFs?' : 'Let GIFs move again?', () => save({ freezeGifs: e.target.checked }));
$('lock').onchange = (e) => {
  // Turning the lock ON never needs confirmation; turning it OFF does.
  if (e.target.checked) save({ lock: true }); else guarded('Unlock settings?', () => save({ lock: false }));
};
$('calm-page').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: 'toggle-calm-page' }).catch(() => {});
  window.close();
};
$('limits').onclick = () => { chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html#limits') }); window.close(); };

const key = 'calmed-' + new Date().toISOString().slice(0, 10);
const n = (await chrome.storage.local.get(key))[key] || 0;
$('count').textContent = n === 1 ? '1 flashing item calmed today.' : `${n} flashing items calmed today.`;
render();
$('power').focus();
