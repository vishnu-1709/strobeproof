// Spike probes ①②③ run in the page's content-script world.
// Answers: are <video> pixels readable? what is their src? are they inside shadow roots?

function shadowRootOf(el) {
  // chrome.dom.openOrClosedShadowRoot sees closed roots too (content scripts only).
  try { return chrome.dom.openOrClosedShadowRoot(el) || el.shadowRoot || null; }
  catch { return el.shadowRoot || null; }
}

function walk(root, out, depth = 0, hostPath = []) {
  const els = root.querySelectorAll('*');
  for (const el of els) {
    if (el.tagName === 'VIDEO') out.videos.push({ el, hostPath: [...hostPath] });
    if (el.tagName === 'IMG') out.imgs.push({ el, hostPath: [...hostPath] });
    const sr = shadowRootOf(el);
    if (sr) {
      out.shadowHosts.push({ tag: el.tagName.toLowerCase(), mode: sr.mode, depth: depth + 1 });
      walk(sr, out, depth + 1, [...hostPath, `${el.tagName.toLowerCase()}(${sr.mode})`]);
    }
  }
}

function readable(video) {
  if (video.readyState < 2) return 'not-ready (readyState ' + video.readyState + ')';
  try {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 9;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(video, 0, 0, 16, 9);
    const d = g.getImageData(0, 0, 16, 9).data;
    let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    return 'readable (mean rgb ' + Math.round(sum / (d.length / 4) / 3) + ')';
  } catch (e) { return 'ERROR ' + e.name; }
}

function probe() {
  const out = { videos: [], imgs: [], shadowHosts: [] };
  walk(document, out);
  const lightVideos = document.querySelectorAll('video').length;
  return {
    url: location.href,
    lightDomVideos: lightVideos,
    totalVideosInclShadow: out.videos.length,
    shadowHosts: out.shadowHosts.slice(0, 40),
    videos: out.videos.slice(0, 20).map(({ el, hostPath }) => ({
      inShadow: hostPath.length > 0,
      hostPath,
      src: el.getAttribute('src'),
      currentSrc: el.currentSrc,
      srcKind: (el.currentSrc || '').startsWith('blob:') ? 'blob (MSE)' :
        (el.currentSrc || '').startsWith('http') ? 'progressive http(s)' : (el.currentSrc ? 'other' : 'none'),
      sources: [...el.querySelectorAll('source')].map(s => ({ src: s.src, type: s.type })),
      muted: el.muted, loop: el.loop, autoplay: el.autoplay, paused: el.paused,
      duration: el.duration, readyState: el.readyState,
      drm: el.mediaKeys !== null && el.mediaKeys !== undefined,
      size: `${el.clientWidth}x${el.clientHeight}`,
      pixels: readable(el),
    })),
    animatedImgCandidates: out.imgs
      .map(({ el }) => el.currentSrc || el.src)
      .filter(s => /\.(gif|webp)(\?|$)/i.test(s) || /format=(gif|webp)/i.test(s))
      .slice(0, 20),
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'spike-probe') { reply(probe()); }
  return false;
});
