// Lab analysis worker: decode every frame, then analyse. Keeps the page responsive.
// Messages in:  { type: 'analyze', buffer, mime, name, display? }  |  { type: 'reanalyze', display }
// Messages out: { type: 'progress', text } | { type: 'result', report, media } | { type: 'error', message }
import { decodeAnimatedImage, sniffImageType } from '../core/decode/gif.js';
import { decodeMp4 } from '../core/decode/mp4.js';
import { analyzeFrames } from '../core/analyzeFrames.js';

let cache = null; // { frames, media }

function isMp4(bytes) {
  return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70; // 'ftyp'
}

function run(display) {
  const { frames, media } = cache;
  const d = {
    displayWidth: display?.width ?? media.width,
    displayHeight: display?.height ?? media.height,
    viewportWidth: display?.viewportWidth ?? 1024,
    incomplete: media.incomplete,
  };
  const report = analyzeFrames(frames, d);
  report.display = d;
  self.postMessage({ type: 'result', report, media });
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'reanalyze') { if (cache) run(m.display); return; }
    if (m.type !== 'analyze') return;
    const bytes = new Uint8Array(m.buffer, 0, Math.min(64, m.buffer.byteLength));
    const imgType = sniffImageType(bytes);
    let media;
    if (imgType) {
      self.postMessage({ type: 'progress', text: 'Reading every frame of the image…' });
      const r = await decodeAnimatedImage(m.buffer, imgType);
      media = { kind: 'image', type: imgType, width: r.width, height: r.height, frameCount: r.frameCount,
        duration: r.loopDuration, animated: r.animated, incomplete: r.incomplete, loops: r.frames.length / Math.max(1, r.frameCount) };
      cache = { frames: r.frames, media };
    } else if (isMp4(bytes)) {
      self.postMessage({ type: 'progress', text: 'Reading every frame of the video…' });
      let last = 0;
      const r = await decodeMp4(m.buffer, {
        onProgress: (done, total) => {
          if (done - last >= 60 || done === total) { last = done; self.postMessage({ type: 'progress', text: `Read ${done} of ${total} frames…` }); }
        },
      });
      media = { kind: 'video', type: 'video/mp4', codec: r.codec, width: r.width, height: r.height,
        frameCount: r.frameCount, expectedFrames: r.expectedFrames, duration: r.duration, incomplete: r.incomplete, error: r.error };
      cache = { frames: r.frames, media };
    } else {
      self.postMessage({ type: 'needs-playback' });
      return;
    }
    self.postMessage({ type: 'progress', text: 'Checking for flashes…' });
    run(m.display);
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
