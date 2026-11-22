// Strobeproof M0 spike: service worker.
// Routes popup requests, owns the offscreen document, and stores every result
// in chrome.storage.local so results survive the popup closing.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Serialise storage writes so concurrent results do not overwrite each other.
let writeQueue = Promise.resolve();
function record(test, data) {
  writeQueue = writeQueue.then(async () => {
    const { spikeResults = [] } = await chrome.storage.local.get('spikeResults');
    spikeResults.push({ ts: new Date().toISOString(), test, data });
    await chrome.storage.local.set({ spikeResults });
  });
  console.log('[spike]', test, data);
  return writeQueue;
}

// Test ④ sample points, as fractions of the captured viewport.
// calm.html draws four patches centred at these x positions (y = 0.5).
const CALM_POINTS = [
  { name: 'white, no filter (expect ~255)', fx: 0.15, fy: 0.5 },
  { name: 'white + Calm filter (sRGB predicts ~82)', fx: 0.40, fy: 0.5 },
  { name: 'gray 128 + Calm filter (sRGB ~41, linear-light ~74)', fx: 0.65, fy: 0.5 },
  { name: 'red + Calm filter (sRGB ~17)', fx: 0.90, fy: 0.5 },
];

let creatingOffscreen = null;
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen
      .createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: 'Spike: fetch and decode test media, sample PNG pixels',
      })
      .finally(() => { creatingOffscreen = null; });
  }
  await creatingOffscreen;
}

async function offscreenCall(msg) {
  await ensureOffscreen();
  return chrome.runtime.sendMessage({ target: 'offscreen', ...msg });
}

async function activeWebTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab) throw new Error('No active tab.');
  if (!/^https?:/.test(tab.url || '')) {
    throw new Error('Active tab is not a normal web page (' + (tab.url || 'no url') + '). Switch to the page you want to test first.');
  }
  return tab;
}

// Tests ①, ②-discovery, ③, ⑤-state. Then fetch and decode the media the page exposes (②).
async function probeActive() {
  const tab = await activeWebTab();
  const report = await chrome.tabs.sendMessage(tab.id, { type: 'probe' });
  if (!report || report.error) throw new Error('Content probe failed: ' + (report && report.error));
  await record('probe (tests 1, 3, 5 state) on ' + new URL(tab.url).host, report);

  for (const url of (report.fetchUrls || []).slice(0, 4)) {
    const r = await offscreenCall({ type: 'fetchTest', url });
    await record('fetch+decode (test 2) ' + url.slice(0, 160), r);
  }
  return report;
}

function waitForComplete(tabId) {
  return new Promise(async (resolve) => {
    const current = await chrome.tabs.get(tabId);
    if (current.status === 'complete') return resolve();
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

// Test ④: draw known patches with the Calm filter, capture the screen, read pixels back.
async function calmTest() {
  const tab = await chrome.tabs.create({ url: chrome.runtime.getURL('calm.html'), active: true });
  await waitForComplete(tab.id);
  await sleep(1000);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  const result = await offscreenCall({ type: 'samplePng', dataUrl, points: CALM_POINTS });
  await record('calm measurement (test 4, captureVisibleTab)', result);
  await chrome.tabs.remove(tab.id);
  return result;
}

// Test ⑤: apply or remove a Calm filter on the first video of the active tab, so it can be
// checked visually while fullscreen.
async function applyCalm(on) {
  const tab = await activeWebTab();
  const r = await chrome.tabs.sendMessage(tab.id, { type: 'applyCalm', on });
  await record('apply Calm to first video (test 5 visual check), on=' + on, r);
  return r;
}

async function handle(msg) {
  switch (msg.type) {
    case 'probeActive': return probeActive();
    case 'calmTest': return calmTest();
    case 'applyCalm': return applyCalm(msg.on);
    case 'clear':
      await chrome.storage.local.set({ spikeResults: [] });
      return { ok: true };
    default:
      return { error: 'unknown message ' + msg.type };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target) return false; // messages meant for the offscreen document
  handle(msg).then(
    (r) => sendResponse(r),
    (e) => sendResponse({ error: String((e && e.message) || e) })
  );
  return true; // async response
});
