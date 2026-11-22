// Service worker: script registration (allowlist-aware), offscreen lifecycle, routing, commands.
// Holds no long-lived state (MV3 SWs restart); everything persistent is in chrome.storage.
import { getSettings, setSettings, hostPatterns } from './settings.js';

const SCRIPT_IDS = ['sp-calm', 'sp-content'];

/** (Re)register calm.css + content.js at document_start on every site except the allowlist (plan §3.1, Decision C1). */
async function syncRegistration() {
  const s = await getSettings();
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: SCRIPT_IDS });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: existing.map((e) => e.id) });
  if (!s.enabled) return;
  const excludeMatches = s.allowlist.flatMap(hostPatterns);
  const base = { matches: ['<all_urls>'], runAt: 'document_start', allFrames: true, persistAcrossSessions: true };
  if (excludeMatches.length) base.excludeMatches = excludeMatches;
  await chrome.scripting.registerContentScripts([
    { id: 'sp-calm', css: ['calm.css'], ...base },
    { id: 'sp-content', js: ['content.js'], ...base },
  ]);
}

async function setup() {
  // Content scripts can read the per-session verdict cache (plan A15).
  await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
  await syncRegistration();
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await setup();
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
});
chrome.runtime.onStartup.addListener(setup);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    const a = changes.settings.oldValue || {}, b = changes.settings.newValue || {};
    if (a.enabled !== b.enabled || JSON.stringify(a.allowlist) !== JSON.stringify(b.allowlist)) syncRegistration();
  }
});

// ---- offscreen pre-scan (plan §3.2, A16): the offscreen doc fetches + decodes itself; SW only routes JSON.
let creating = null;
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creating) {
    creating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Decode GIFs and short videos frame by frame to check them for flashing before they are shown.',
    }).finally(() => { creating = null; });
  }
  await creating;
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.to !== 'sw') return false;
  (async () => {
    try {
      if (msg.type === 'prescan') {
        await ensureOffscreen();
        reply(await chrome.runtime.sendMessage({ to: 'offscreen', type: 'prescan', job: msg.job }));
      } else if (msg.type === 'allow-site') {
        const s = await getSettings();
        if (!s.allowlist.includes(msg.host)) await setSettings({ allowlist: [...s.allowlist, msg.host] });
        reply({ ok: true });
      } else if (msg.type === 'count-calmed') {
        const key = 'calmed-' + new Date().toISOString().slice(0, 10);
        const cur = (await chrome.storage.local.get(key))[key] || 0;
        await chrome.storage.local.set({ [key]: cur + (msg.n || 1) });
        reply({ ok: true });
      } else if (msg.type === 'open-welcome') {
        await chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
        reply({ ok: true });
      } else reply({ error: 'unknown message' });
    } catch (e) { reply({ error: String(e?.message || e) }); }
  })();
  return true;
});

// ---- panic shortcut: Calm everything on this page now; press again to restore (plan §3.5).
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'calm-page') return;
  const t = tab?.id ? tab : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (t?.id) chrome.tabs.sendMessage(t.id, { type: 'toggle-calm-page' }).catch(() => {});
});
