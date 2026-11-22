// Probe ④: what pixel does Chrome actually paint for grayscale(1) brightness(0.32) over white?
// If filters run in sRGB: white → 0.32*255 ≈ 82. If in linear light: ≈ 153.
// Probe ⑤: does the element's filter survive when the <video> itself is fullscreen?

const out = document.getElementById('out');
const log = (o) => { out.textContent = JSON.stringify(o, null, 2); console.log('[spike calm]', o); };

// A solid-white video stream (no file needed).
const c = document.createElement('canvas'); c.width = 320; c.height = 180;
const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 320, 180);
const v = document.getElementById('v');
v.srcObject = c.captureStream(5);
v.play().catch(() => {});
setInterval(() => { g.fillRect(0, 0, 320, 180); }, 200); // keep the stream producing frames

const srgbToLin = (c8) => { const c = c8 / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const relLum = ([r, g, b]) => 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);

async function capture() {
  const r = await chrome.runtime.sendMessage({ type: 'spike-capture' });
  if (!r.ok) throw new Error(r.error);
  const img = new Image(); img.src = r.dataUrl; await img.decode();
  const cv = new OffscreenCanvas(img.width, img.height);
  const cg = cv.getContext('2d'); cg.drawImage(img, 0, 0);
  return { cg, w: img.width, h: img.height, scale: img.width / innerWidth };
}

function pixelAt(cap, el) {
  const b = el.getBoundingClientRect();
  const x = Math.round((b.left + b.width / 2) * cap.scale), y = Math.round((b.top + b.height / 2) * cap.scale);
  const d = cap.cg.getImageData(x, y, 1, 1).data;
  const rgb = [d[0], d[1], d[2]];
  return { rgb, relLum: +relLum(rgb).toFixed(4) };
}

document.getElementById('measure').onclick = async () => {
  try {
    const cap = await capture();
    const res = {
      probe: '④ Calm measurement',
      dpr: devicePixelRatio,
      whiteNoFilter: pixelAt(cap, document.getElementById('w')),
      whiteCalm: pixelAt(cap, document.getElementById('wc')),
      redCalm: pixelAt(cap, document.getElementById('rc')),
      grey128Calm: pixelAt(cap, document.getElementById('gc')),
      videoCalm: pixelAt(cap, v),
      expectIfSRGB: 82, expectIfLinear: 153,
    };
    res.verdict = Math.abs(res.whiteCalm.rgb[0] - 82) <= 3 ? 'sRGB-space filter: CALM_BRIGHTNESS 0.32 is correct' :
      Math.abs(res.whiteCalm.rgb[0] - 153) <= 3 ? 'LINEAR-space filter: needs ≈0.084' : 'unexpected; investigate';
    res.maxDeltaL = +(res.whiteCalm.relLum - 0).toFixed(4);
    log(res);
  } catch (e) { log({ error: String(e) }); }
};

document.getElementById('fs').onclick = async () => {
  try {
    await v.requestFullscreen();
    await new Promise(r => setTimeout(r, 1200));
    const style = getComputedStyle(v).filter;
    const cap = await capture();
    const d = cap.cg.getImageData(Math.floor(cap.w / 2), Math.floor(cap.h / 2), 1, 1).data;
    const rgb = [d[0], d[1], d[2]];
    await document.exitFullscreen();
    log({
      probe: '⑤ Fullscreen', fullscreenElementWasVideo: true, computedFilter: style,
      centerPixel: rgb, relLum: +relLum(rgb).toFixed(4),
      verdict: rgb[0] < 120 ? 'filter persists in fullscreen' : 'filter LOST in fullscreen (white at full brightness)',
    });
  } catch (e) { log({ error: String(e) }); }
};
