// Offscreen pre-scan (plan §3.2, A16): fetch + decode every frame + analyse, then reply with a small JSON verdict.
// Extension pages have host permissions, so page CORS doesn't apply. Cookies are never sent (credentials: 'omit').
import { decodeAnimatedImage, isAnimatedWebPHeader, sniffImageType } from './core/decode/gif.js';
import { decodeMp4 } from './core/decode/mp4.js';
import { analyzeFrames } from './core/analyzeFrames.js';
import { PRESCAN_MAX_BYTES, PRESCAN_MAX_DURATION_S, PRESCAN_CONCURRENCY, PRETRIP_TRANS } from './core/constants.js';

let running = 0;
const waiting = [];
const slot = () => new Promise((r) => { if (running < PRESCAN_CONCURRENCY) { running++; r(); } else waiting.push(r); });
const release = () => { const next = waiting.shift(); if (next) next(); else running--; };

/** First bytes only (Decision C6.1): Range 0-31; if the server ignores Range, abort after the first chunk. */
async function head(url) {
  const ctl = new AbortController();
  const res = await fetch(url, { headers: { Range: 'bytes=0-31' }, credentials: 'omit', signal: ctl.signal });
  if (!res.ok && res.status !== 206) throw new Error('HTTP ' + res.status);
  const reader = res.body.getReader();
  const chunks = []; let n = 0;
  while (n < 32) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); n += value.length; }
  ctl.abort();
  const out = new Uint8Array(Math.min(n, 64)); let o = 0;
  for (const c of chunks) { const take = Math.min(c.length, out.length - o); out.set(c.subarray(0, take), o); o += take; if (o >= out.length) break; }
  return { bytes: out, type: res.headers.get('content-type') || '' };
}

/** Whole body with a hard size cap (plan §3.2: ≤ 15 MB). */
async function body(url) {
  const ctl = new AbortController();
  const res = await fetch(url, { credentials: 'omit', signal: ctl.signal });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const len = +res.headers.get('content-length') || 0;
  if (len > PRESCAN_MAX_BYTES) { ctl.abort(); throw new Error('too large'); }
  const reader = res.body.getReader();
  const parts = []; let n = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > PRESCAN_MAX_BYTES) { ctl.abort(); throw new Error('too large'); }
    parts.push(value);
  }
  const buf = new Uint8Array(n); let o = 0;
  for (const p of parts) { buf.set(p, o); o += p.length; }
  return buf.buffer;
}

async function firstFrameDataUrl(buffer, type) {
  const dec = new ImageDecoder({ data: buffer, type });
  try {
    const { image } = await dec.decode({ frameIndex: 0 });
    const s = Math.min(1, 1024 / Math.max(image.displayWidth, image.displayHeight));
    const c = new OffscreenCanvas(Math.round(image.displayWidth * s), Math.round(image.displayHeight * s));
    c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
    image.close();
    const blob = await c.convertToBlob({ type: 'image/png' });
    return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  } finally { dec.close(); }
}

function verdictOf(report, extra = {}) {
  const peak = Math.max(report.general.maxTransitions, report.red.maxTransitions);
  return {
    verdict: report.verdict,
    flashesPerSecond: report.worst.flashesPerSecond,
    peakTransitions: peak,
    // Below the pre-trip level the clip is fine at ANY display size, so the cached verdict never needs a re-check.
    sizeIndependent: report.verdict === 'PASS' && peak < PRETRIP_TRANS,
    ...extra,
  };
}

async function prescan(job) {
  const display = { displayWidth: job.rect?.width || 480, displayHeight: job.rect?.height || 270, viewportWidth: job.viewportWidth || 1024 };
  const rectArea = (display.displayWidth * display.displayHeight * (1024 / display.viewportWidth) ** 2);
  if (job.kind === 'image') {
    const h = await head(job.url);
    const type = sniffImageType(h.bytes) || (/image\/(gif|webp|png|apng)/.exec(h.type)?.[0]);
    if (type === 'image/webp' && isAnimatedWebPHeader(h.bytes) === false) return { verdict: 'STATIC', rectArea, sizeIndependent: true, via: 'header' };
    if (!type) return { verdict: 'UNSUPPORTED', rectArea };
    const buffer = await body(job.url);
    const r = await decodeAnimatedImage(buffer, type);
    if (!r.animated) return { verdict: 'STATIC', rectArea, sizeIndependent: true, via: 'decode' };
    const report = analyzeFrames(r.frames, { ...display, incomplete: r.incomplete });
    const out = verdictOf(report, { rectArea, frames: r.frameCount });
    if (job.freeze && out.verdict === 'PASS') out.firstFrame = await firstFrameDataUrl(buffer, type);
    return out;
  }
  // GIF-style video: progressive MP4 only; anything else goes to the live path.
  const buffer = await body(job.url);
  const b = new Uint8Array(buffer, 0, Math.min(12, buffer.byteLength));
  if (!(b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70)) return { verdict: 'UNSUPPORTED', rectArea };
  const r = await decodeMp4(buffer, { maxDurationS: PRESCAN_MAX_DURATION_S });
  const report = analyzeFrames(r.frames, { ...display, incomplete: r.incomplete });
  return verdictOf(report, { rectArea, frames: r.frameCount });
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.to !== 'offscreen' || msg.type !== 'prescan') return false;
  (async () => {
    await slot();
    const t0 = performance.now();
    try { reply({ ...(await prescan(msg.job)), ms: Math.round(performance.now() - t0) }); }
    catch (e) { reply({ verdict: 'ERROR', error: String(e?.message || e) }); }
    finally { release(); }
  })();
  return true;
});
