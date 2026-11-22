// Every-frame decode of animated images (GIF, animated WebP, APNG) with ImageDecoder (plan A10, §3.2).
// Output: { frames: [{ t, tiles }], loopDuration, frameCount, animated, width, height, incomplete } — tiles at SAMPLE_W×SAMPLE_H.
// Runs in window or worker contexts (needs ImageDecoder + OffscreenCanvas). Not in service workers.
import { SAMPLE_W, SAMPLE_H, WINDOW_S } from '../constants.js';
import { tilesFromRGBA } from '../luminance.js';

/** Chrome shows GIF frames with a delay ≤ 10 ms as 100 ms; mirror that so timing matches what users see. */
const MIN_DELAY_US = 10_000, CLAMPED_DELAY_US = 100_000;

/**
 * @param {ArrayBuffer|ReadableStream} data
 * @param {string} type  MIME type, e.g. 'image/gif', 'image/webp', 'image/png'
 * @param {{ maxFrames?: number, crop?: {x:number,y:number,w:number,h:number} }} [opts]  crop: source-pixel region (screen recordings)
 */
export async function decodeAnimatedImage(data, type, opts = {}) {
  if (typeof ImageDecoder === 'undefined') throw new Error('ImageDecoder not supported in this browser');
  if (!(await ImageDecoder.isTypeSupported(type))) throw new Error(`ImageDecoder cannot decode ${type}`);
  const dec = new ImageDecoder({ data, type });
  try {
    await dec.tracks.ready;
    await dec.completed;
    const track = dec.tracks.selectedTrack;
    const frameCount = track.frameCount;
    const canvas = new OffscreenCanvas(SAMPLE_W, SAMPLE_H);
    const g = canvas.getContext('2d', { willReadFrequently: true });
    const one = [];
    let t = 0, width = 0, height = 0;
    const max = opts.maxFrames ?? 5000;
    for (let i = 0; i < Math.min(frameCount, max); i++) {
      const { image } = await dec.decode({ frameIndex: i, completeFramesOnly: true });
      if (!width) { width = image.displayWidth; height = image.displayHeight; }
      g.clearRect(0, 0, SAMPLE_W, SAMPLE_H);
      if (opts.crop) g.drawImage(image, opts.crop.x, opts.crop.y, opts.crop.w, opts.crop.h, 0, 0, SAMPLE_W, SAMPLE_H);
      else g.drawImage(image, 0, 0, SAMPLE_W, SAMPLE_H);
      const px = g.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
      one.push({ t: t / 1e6, tiles: tilesFromRGBA(px, SAMPLE_W, SAMPLE_H) });
      let d = image.duration ?? 0;
      if (d <= MIN_DELAY_US) d = CLAMPED_DELAY_US;
      t += d;
      image.close();
    }
    const loopDuration = t / 1e6;
    const animated = frameCount > 1;
    // Loop the sequence so every 1 s window — including the seam between loops — is analysed.
    const frames = [...one];
    if (animated && track.repetitionCount !== 0 && loopDuration > 0) {
      const target = loopDuration + WINDOW_S;
      for (let k = 1; frames[frames.length - 1].t < target; k++) {
        for (const f of one) frames.push({ t: f.t + k * loopDuration, tiles: f.tiles });
      }
    }
    return { frames, loopDuration, frameCount, animated, width, height, incomplete: frameCount > max };
  } finally {
    dec.close();
  }
}

/** Quick check from the first bytes: is this WebP animated? (VP8X chunk, animation flag bit 1). */
export function isAnimatedWebPHeader(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 21) return null; // unknown
  const tag = (o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return null;
  if (tag(12) !== 'VP8X') return false; // simple lossy/lossless WebP cannot animate
  return (b[20] & 0x02) !== 0;
}

/** Sniff a MIME type from magic bytes. */
export function sniffImageType(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57) return 'image/webp';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  return null;
}
