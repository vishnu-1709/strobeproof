import { describe, it, expect } from 'vitest';
import { analyzeFrames } from '../analyzeFrames.js';
import { CASES } from '../fixtures.js';

describe('analyzeFrames safety', () => {
  it('zero frames is never a PASS', () => {
    expect(analyzeFrames([]).verdict).toBe('INCOMPLETE');
  });
  it('incomplete decode of a safe clip is INCOMPLETE, not PASS', () => {
    expect(analyzeFrames(CASES['1'].make(), { ...CASES['1'].display, incomplete: true }).verdict).toBe('INCOMPLETE');
  });
  it('incomplete decode of a failing clip still FAILs', () => {
    expect(analyzeFrames(CASES['2'].make(), { ...CASES['2'].display, incomplete: true }).verdict).toBe('FAIL');
  });
  it('report has fail ranges covering the flashing', () => {
    const r = analyzeFrames(CASES['2'].make(), CASES['2'].display);
    expect(r.failRanges.length).toBeGreaterThan(0);
    expect(r.worst.flashesPerSecond).toBeGreaterThanOrEqual(3.5);
  });
});
