// Spike service worker: offscreen doc lifecycle, routing, and captureVisibleTab (probe ④⑤).

async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument?.();
  if (has) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['WORKERS'],
    justification: 'Spike: fetch media bytes from an extension context to test CORS-free access.',
  });
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    if (msg?.type === 'spike-fetch') {
      await ensureOffscreen();
      const res = await chrome.runtime.sendMessage({ type: 'offscreen-fetch', urls: msg.urls });
      reply(res);
    } else if (msg?.type === 'spike-capture') {
      const windowId = sender.tab ? sender.tab.windowId : chrome.windows.WINDOW_ID_CURRENT;
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
        reply({ ok: true, dataUrl });
      } catch (e) { reply({ ok: false, error: String(e) }); }
    }
  })();
  return true;
});
