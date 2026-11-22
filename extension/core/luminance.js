// Per-pixel linear luminance, averaged into tiles (plan §4.2, A12).
// Never average gamma-encoded sRGB: convert each pixel to linear light first, then average.
import { RED_RATIO, RED_SCALE, TILES_X, TILES_Y } from './constants.js';

/** sRGB 8-bit → linear 0..1 lookup table. */
export const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of one 8-bit sRGB colour. */
export function relativeLuminance(r, g, b) {
  return 0.2126 * LIN[r] + 0.7152 * LIN[g] + 0.0722 * LIN[b];
}

/**
 * RGBA frame → per-tile metrics.
 * L[i]      mean linear relative luminance of tile i
 * red[i]    mean of max(0, R−G−B)×320 over the tile's pixels (R,G,B linear, per WCAG "as in relative luminance")
 * satRed[i] 1 if the tile's mean linear colour has R/(R+G+B) ≥ RED_RATIO
 * Width and height must be multiples of tilesX / tilesY.
 */
export function tilesFromRGBA(data, width, height, tilesX = TILES_X, tilesY = TILES_Y) {
  const n = tilesX * tilesY;
  const L = new Float32Array(n), red = new Float32Array(n), satRed = new Uint8Array(n);
  const sumR = new Float32Array(n), sumG = new Float32Array(n), sumB = new Float32Array(n);
  const tw = width / tilesX, th = height / tilesY;
  if (!Number.isInteger(tw) || !Number.isInteger(th)) throw new Error(`frame ${width}×${height} not divisible into ${tilesX}×${tilesY} tiles`);
  for (let y = 0; y < height; y++) {
    const row = ((y / th) | 0) * tilesX;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = LIN[data[i]], g = LIN[data[i + 1]], b = LIN[data[i + 2]];
      const t = row + ((x / tw) | 0);
      L[t] += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const rm = r - g - b;
      if (rm > 0) red[t] += rm * RED_SCALE;
      sumR[t] += r; sumG[t] += g; sumB[t] += b;
    }
  }
  const px = tw * th;
  for (let t = 0; t < n; t++) {
    L[t] /= px; red[t] /= px;
    const s = sumR[t] + sumG[t] + sumB[t];
    satRed[t] = s > 0 && sumR[t] / s >= RED_RATIO ? 1 : 0;
  }
  return { L, red, satRed, tilesX, tilesY };
}
