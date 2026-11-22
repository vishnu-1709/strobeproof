import { describe, it, expect } from 'vitest';
import { relativeLuminance, tilesFromRGBA, LIN } from '../luminance.js';
import { greyForLum } from '../fixtures.js';
import { applyCalm } from '../calm.js';
import { CALM_BRIGHTNESS, LUM_DELTA, AREA_LIMIT_PX, FIELD_10DEG_PX } from '../constants.js';

describe('luminance', () => {
  it('white = 1, black = 0, sRGB 128 ≈ 0.216', () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 6);
    expect(relativeLuminance(0, 0, 0)).toBe(0);
    expect(relativeLuminance(128, 128, 128)).toBeCloseTo(0.2158, 3);
  });
  it('greyForLum inverts the transfer function', () => {
    for (const L of [0, 0.2, 0.26, 0.5, 0.85, 1]) expect(LIN[greyForLum(L)]).toBeCloseTo(L, 2);
  });
  it('tiles average linear light, not gamma-encoded values (A12)', () => {
    // 4×4 tile, half black half white pixels → linear mean 0.5 (sRGB-average would give L(128) ≈ 0.216)
    const d = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < 16; i++) { const v = i % 2 ? 255 : 0; d.set([v, v, v, 255], i * 4); }
    const t = tilesFromRGBA(d, 4, 4, 1, 1);
    expect(t.L[0]).toBeCloseTo(0.5, 5);
  });
  it('saturated red detection', () => {
    const d = new Uint8ClampedArray([255, 0, 0, 255]);
    const t = tilesFromRGBA(d, 1, 1, 1, 1);
    expect(t.satRed[0]).toBe(1);
    expect(t.red[0]).toBeCloseTo(320, 3);
  });
});

describe('constants', () => {
  it('area limit is 25% of the 341×256 field', () => {
    expect(FIELD_10DEG_PX).toBe(87296);
    expect(AREA_LIMIT_PX).toBeCloseTo(21824, 0);
  });
  it('Calm Mode bound: white under the calm filter stays below ΔL', () => {
    const white = { t: 0, width: 1, height: 1, data: new Uint8ClampedArray([255, 255, 255, 255]) };
    const c = applyCalm(white).data;
    const L = relativeLuminance(c[0], c[1], c[2]);
    expect(c[0]).toBe(Math.round(255 * CALM_BRIGHTNESS));
    expect(L).toBeLessThan(LUM_DELTA);
  });
});
