// Synthetic ground-truth clips for the known-answer suite (plan §4.5, A11).
// Pure JS: runs in Vitest and in the Lab suite page. No encoding anywhere.
// A frame is { t: seconds, width, height, data: Uint8ClampedArray RGBA }, already at SAMPLE_W×SAMPLE_H.
import { SAMPLE_W, SAMPLE_H, TILES_X, TILES_Y } from './constants.js';
import { applyCalm } from './calm.js';

const W = SAMPLE_W, H = SAMPLE_H;
const TILE_W = W / TILES_X, TILE_H = H / TILES_Y; // 4×4 sample px per tile

/** Display assumed for every case: 1024×576 CSS px media on a 1024-wide viewport (the WCAG reference). */
export const SUITE_DISPLAY = { displayWidth: 1024, displayHeight: 576, viewportWidth: 1024 };

/** Inverse of the sRGB transfer: relative luminance of a grey → 8-bit value. */
export function greyForLum(L) {
  const c = L <= 0.0031308 ? 12.92 * L : 1.055 * L ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
}

function frame(t, fill) {
  const data = new Uint8ClampedArray(W * H * 4);
  fill(data);
  return { t, width: W, height: H, data };
}
const solid = ([r, g, b]) => (d) => {
  for (let i = 0; i < d.length; i += 4) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
};
const greyOf = (L) => { const v = greyForLum(L); return [v, v, v]; };
const BLACK = [0, 0, 0], WHITE = [255, 255, 255], RED = [255, 0, 0];

/** Box in tile units on a black background. */
const box = (tx, ty, tw, th, rgb) => (d) => {
  solid(BLACK)(d);
  for (let y = ty * TILE_H; y < (ty + th) * TILE_H; y++)
    for (let x = tx * TILE_W; x < (tx + tw) * TILE_W; x++) {
      const i = (y * W + x) * 4; d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2];
    }
};

/** Builds a clip from a per-frame colour/fill function at a constant frame rate. Integer frame maths only. */
function clip(fps, seconds, fillAt) {
  const n = Math.round(fps * seconds);
  const frames = [];
  for (let i = 0; i < n; i++) frames.push(frame(i / fps, fillAt(i, fps)));
  return frames;
}

/** Square wave: `toggles` = transitions per second; state flips every fps/toggles frames. `offset` in frames. */
function square(fps, seconds, togglesPerS, a, b, offset = 0, fillFor = solid) {
  return clip(fps, seconds, (i) => {
    const state = Math.floor(((i + offset) * togglesPerS) / fps) % 2;
    return fillFor(state ? b : a);
  });
}

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const case2 = () => square(60, 3, 10, BLACK, WHITE);

/** id → { name, make() → frames, display } . Expected answers live ONLY in __tests__/expected.json. */
export const CASES = {
  '1': { name: 'Full-frame black↔white, 2 Hz', make: () => square(60, 3, 4, BLACK, WHITE) },
  '2': { name: 'Full-frame black↔white, 5 Hz', make: case2 },
  '3a': { name: '3 Hz exactly (6 transitions/s), phase 0', make: () => square(60, 3, 6, BLACK, WHITE, 0) },
  '3b': { name: '3 Hz exactly, phase ¼ period', make: () => square(60, 3, 6, BLACK, WHITE, 5) },
  '3c': { name: '3 Hz exactly, phase ½ period', make: () => square(60, 3, 6, BLACK, WHITE, 10) },
  '3d': { name: '3 Hz exactly, phase ¾ period', make: () => square(60, 3, 6, BLACK, WHITE, 15) },
  '4': { name: '3.5 Hz (7 transitions/s)', make: () => square(70, 3, 7, BLACK, WHITE) },
  '5': { name: '5 Hz with ΔL = 0.06', make: () => square(60, 3, 10, greyOf(0.20), greyOf(0.26)) },
  '6': { name: '5 Hz between L = 0.85 and 1.0', make: () => square(60, 3, 10, greyOf(0.85), greyOf(1.0)) },
  '7': {
    name: '5 Hz box, 128×128 CSS px (16,384 px², below limit)',
    make: () => square(60, 3, 10, 0, 1, 0, (s) => box(2, 2, 4, 4, s ? WHITE : BLACK)),
  },
  '8': {
    name: '5 Hz box, 192×192 CSS px (36,864 px², above limit)',
    make: () => square(60, 3, 10, 0, 1, 0, (s) => box(2, 2, 6, 6, s ? WHITE : BLACK)),
  },
  '9': { name: 'Red↔black, 5 Hz', make: () => square(60, 3, 10, BLACK, RED) },
  '10': {
    name: '60 fps ramp strobe at 5 Hz, starting from rest (each frame step < 0.10)',
    make: () => clip(60, 3, (i) => {
      if (i < 60) return solid(BLACK);                // 1 s at rest
      const k = (i - 60) % 12;                         // 12 frames = one 5 Hz period
      const L = k <= 6 ? (0.5 * k) / 6 : (0.5 * (12 - k)) / 6; // 0 → 0.5 → 0 in steps of 0.083
      return solid(greyOf(L));
    }),
  },
  '11': {
    name: 'Falling ramp 1.0 → 0.4 that crosses ΔL above 0.80, 5 Hz',
    make: () => clip(60, 3, (i) => {
      const k = i % 12;
      if (k === 0) return solid(greyOf(1.0));          // hard rise
      if (k <= 6) return solid(greyOf(1.0 - 0.1 * k)); // 0.9, 0.8 … 0.4
      return solid(greyOf(0.4));
    }),
  },
  '12a': { name: 'Single hard cut black → white', make: () => clip(60, 3, (i) => solid(i < 60 ? BLACK : WHITE)) },
  '12b': { name: 'Fade black → white over 2 s', make: () => clip(60, 3, (i) => solid(greyOf(Math.min(1, i / 120)))) },
  '13': {
    name: 'Fine checkerboard inversion, 10 Hz',
    make: () => clip(60, 3, (i) => (d) => {
      const inv = Math.floor((i * 20) / 60) % 2;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const on = ((x + y + inv) & 1) === 1, j = (y * W + x) * 4, v = on ? 255 : 0;
        d[j] = d[j + 1] = d[j + 2] = v; d[j + 3] = 255;
      }
    }),
  },
  '14': {
    name: 'Case 2 with random dropped frames and VFR timestamps',
    make: () => {
      const rnd = mulberry32(14);
      return case2()
        .filter(() => rnd() > 0.2)
        .map((f) => ({ ...f, t: Math.max(0, f.t + (rnd() - 0.5) * 0.006) }))
        .sort((a, b) => a.t - b.t);
    },
  },
  '15': { name: 'Calm Mode applied to case 2', make: () => case2().map(applyCalm) },
};
for (const c of Object.values(CASES)) c.display = SUITE_DISPLAY;
