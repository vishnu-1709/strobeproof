// Unit tests for the human-owned flashCounter.js and areaGrid.js (plan §4.3, §4.4).
import { describe, it, expect } from 'vitest';
import { createFlashCounter } from '../flashCounter.js';
import { areaVerdict } from '../areaGrid.js';
import { LUM_DELTA, DARKER_MAX, WINDOW_S, AREA_LIMIT_PX } from '../constants.js';

const lum = () => createFlashCounter({ delta: LUM_DELTA, darkerMax: DARKER_MAX, windowS: WINDOW_S, strict: false });
const feed = (c, samples) => samples.map(([L, t]) => c.push(L, t));

describe('flashCounter', () => {
  it('a hard black→white step is one transition', () => {
    expect(feed(lum(), [[0, 0], [1, 0.1]]).at(-1)).toBe(1);
  });
  it('changes below ΔL never count', () => {
    expect(feed(lum(), [[0.2, 0], [0.26, 0.1], [0.2, 0.2], [0.26, 0.3]]).at(-1)).toBe(0);
  });
  it('★ slow ramp from rest still builds a transition (A7)', () => {
    const s = [];
    for (let k = 0; k <= 6; k++) s.push([0.5 * k / 6, k / 60]); // steps of 0.083 < ΔL
    expect(feed(lum(), s).at(-1)).toBe(1);
  });
  it('★ a continuing move extends, it does not re-trigger', () => {
    expect(feed(lum(), [[0, 0], [0.3, 0.1], [0.6, 0.2], [1, 0.3]]).at(-1)).toBe(1);
  });
  it('★ falling move keeps updating its darker side (A8)', () => {
    // rise to 1.0, then fall 0.9 → 0.4: the fall is detected above 0.80 but must count once it goes below
    const c = lum();
    const out = feed(c, [[0.4, 0], [1.0, 0.1], [0.9, 0.2], [0.8, 0.3], [0.6, 0.4], [0.4, 0.5]]);
    expect(out.at(-1)).toBe(2);
  });
  it('transitions whose darker side is ≥ 0.80 do not count', () => {
    expect(feed(lum(), [[0.85, 0], [1, 0.1], [0.85, 0.2], [1, 0.3]]).at(-1)).toBe(0);
  });
  it('window is half-open (t−1, t]: a transition exactly 1 s ago is dropped', () => {
    const c = lum();
    c.push(0, 0); c.push(1, 0.5);          // transition at 0.5
    expect(c.push(1, 1.4)).toBe(1);
    expect(c.push(1, 1.5)).toBe(0);        // 0.5 ≤ 1.5 − 1.0 → dropped
  });
  it('strict mode (red rule) needs change > delta', () => {
    const r = createFlashCounter({ delta: 20, darkerMax: Infinity, windowS: 1, strict: true });
    expect(feed(r, [[0, 0], [20, 0.1]]).at(-1)).toBe(0);
    const r2 = createFlashCounter({ delta: 20, darkerMax: Infinity, windowS: 1, strict: true });
    expect(feed(r2, [[0, 0], [20.5, 0.1]]).at(-1)).toBe(1);
  });
});

describe('areaGrid', () => {
  const mask = (tx, ty, w, h, cols = 32, rows = 18) => {
    const m = new Uint8Array(cols * rows);
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) m[y * cols + x] = 1;
    return m;
  };
  const rect = { width: 1024, height: 576 }; // tile = 32×32 CSS px
  it('empty mask → 0 area', () => {
    expect(areaVerdict(new Uint8Array(576), 32, 18, rect, 1024)).toEqual({ maxAreaPx: 0, fail: false });
  });
  it('4×4 tiles (16,384 px²) passes, 6×6 tiles (36,864 px²) fails', () => {
    expect(areaVerdict(mask(2, 2, 4, 4), 32, 18, rect, 1024).fail).toBe(false);
    const big = areaVerdict(mask(2, 2, 6, 6), 32, 18, rect, 1024);
    expect(big.fail).toBe(true);
    expect(big.maxAreaPx).toBeGreaterThan(AREA_LIMIT_PX);
  });
  it('scales to the 1024 reference: same box on a 2048-wide viewport covers ¼ the reference area', () => {
    const r = areaVerdict(mask(2, 2, 6, 6), 32, 18, rect, 2048);
    expect(r.maxAreaPx).toBeCloseTo(36864 / 4, 0);
    expect(r.fail).toBe(false);
  });
  it('flashing spread far apart is not summed across separate 10° windows', () => {
    const m = mask(0, 0, 4, 4); for (let y = 14; y < 18; y++) for (let x = 28; x < 32; x++) m[y * 32 + x] = 1;
    expect(areaVerdict(m, 32, 18, rect, 1024).fail).toBe(false);
  });
});
