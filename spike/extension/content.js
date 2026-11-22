// Strobeproof M0 spike: content script. Describes the media on the page.
// Read-only except for applyCalm, which sets a CSS filter on the first video for test 5.
(() => {
  if (window.__strobeproofSpike) return;
  window.__strobeproofSpike = true;

  // Walk every element, descending into OPEN and CLOSED shadow roots (test 3).
  function* walk(root, depth = 0) {
    for (const el of root.querySelectorAll('*')) {
      yield { el, depth };
      let sr = null;
      try {
        sr = chrome.dom && chrome.dom.openOrClosedShadowRoot
          ? chrome.dom.openOrClosedShadowRoot(el)
          : el.shadowRoot;
      } catch (e) {
        sr = el.shadowRoot;
      }
      if (sr) yield* walk(sr, depth + 1);
    }
  }

  function allVideos() {
    return [...walk(document)].filter((x) => x.el.tagName === 'VIDEO');
  }

  // Test 1: can a content script read pixels from this video? (SecurityError = tainted)
  function readability(v) {
    try {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 72;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, 128, 72);
      const d = ctx.getImageData(0, 0, 128, 72).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      return { readable: true, meanRGB: Math.round(sum / (128 * 72 * 3)), readyState: v.readyState };
    } catch (e) {
      return { readable: false, error: e.name + ': ' + e.message, readyState: v.readyState };
    }
  }

  function describeVideo({ el, depth }) {
    const src = el.currentSrc || el.src || '';
    const root = el.getRootNode();
    const rect = el.getBoundingClientRect();
    return {
      inShadowRoot: depth > 0,
      shadowHost: depth > 0 && root.host ? root.host.tagName.toLowerCase() : null,
      src: src.slice(0, 200),
      srcKind: src.startsWith('blob:')
        ? 'blob: (MSE or object URL, not directly fetchable)'
        : /^https?:/.test(src) ? 'http(s)' : src ? 'other' : 'none',
      sourceChildren: [...el.querySelectorAll('source')].map((s) => s.src).slice(0, 3),
      paused: el.paused,
      muted: el.muted,
      autoplay: el.autoplay,
      loop: el.loop,
      duration: el.duration,
      videoWidth: el.videoWidth,
      videoHeight: el.videoHeight,
      cssSize: [Math.round(rect.width), Math.round(rect.height)],
      hasMediaKeys: !!el.mediaKeys,
      computedFilter: getComputedStyle(el).filter,
      isFullscreenElement: document.fullscreenElement === el,
      readability: readability(el),
    };
  }

  function probe() {
    const vids = allVideos();
    const imgs = [...walk(document)]
      .filter((x) => x.el.tagName === 'IMG')
      .map((x) => x.el)
      .filter((img) => /\.(gif|webp)(\?|$)/i.test(img.currentSrc || img.src || ''));

    const httpVideoUrls = vids
      .map(({ el }) => el.currentSrc || el.src || '')
      .filter((u) => /^https?:/.test(u));
    const gifUrls = imgs.map((img) => img.currentSrc || img.src).filter((u) => /^https?:/.test(u));
    const fetchUrls = [...new Set([...httpVideoUrls, ...gifUrls])];

    const shadowHosts = [...new Set(
      vids.filter((v) => v.depth > 0).map((v) => v.el.getRootNode().host.tagName.toLowerCase())
    )];

    return {
      page: location.host,
      fullscreenElement: document.fullscreenElement ? document.fullscreenElement.tagName : null,
      videoCount: vids.length,
      shadowVideoCount: vids.filter((v) => v.depth > 0).length,
      shadowHosts,
      iframeCount: document.querySelectorAll('iframe').length,
      canvasCount: document.querySelectorAll('canvas').length,
      gifOrWebpImgCount: imgs.length,
      likelyYouTubePlayer: !!document.querySelector('#movie_player'),
      likelyRedditPlayer: !!document.querySelector('shreddit-player'),
      videos: vids.map(describeVideo),
      gifImgs: imgs.slice(0, 6).map((img) => ({
        src: (img.currentSrc || img.src).slice(0, 200),
        naturalSize: [img.naturalWidth, img.naturalHeight],
        complete: img.complete,
      })),
      fetchUrls: fetchUrls.slice(0, 6),
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg.type === 'probe') {
        sendResponse(probe());
      } else if (msg.type === 'applyCalm') {
        const first = allVideos()[0];
        if (!first) return sendResponse({ error: 'No video element found on this page.' });
        const v = first.el;
        v.style.setProperty('filter', msg.on ? 'grayscale(1) brightness(0.32)' : '', 'important');
        sendResponse({
          applied: msg.on,
          tag: v.tagName,
          computedFilter: getComputedStyle(v).filter,
          fullscreenElement: document.fullscreenElement ? document.fullscreenElement.tagName : null,
        });
      } else {
        sendResponse({ error: 'unknown message ' + msg.type });
      }
    } catch (e) {
      sendResponse({ error: e.name + ': ' + e.message });
    }
    return false;
  });
})();
