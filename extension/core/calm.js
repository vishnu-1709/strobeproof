// Simulates what Calm Mode (`grayscale(1) brightness(CALM_BRIGHTNESS)`) does to pixels,
// so test #15 can prove the filter keeps every possible transition below LUM_DELTA.
// Model: CSS filter functions operate on sRGB-encoded values (confirmed by M0 spike ④, see SPIKE.md).
import { CALM_BRIGHTNESS } from './constants.js';

/** Filter Effects spec grayscale(1) matrix row, applied to sRGB-encoded channels. */
const GR = 0.2126, GG = 0.7152, GB = 0.0722;

/** Returns a new RGBA frame with Calm Mode applied. */
export function applyCalm(frame) {
  const src = frame.data;
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const y = (GR * src[i] + GG * src[i + 1] + GB * src[i + 2]) * CALM_BRIGHTNESS;
    out[i] = out[i + 1] = out[i + 2] = y;
    out[i + 3] = src[i + 3];
  }
  return { ...frame, data: out };
}
