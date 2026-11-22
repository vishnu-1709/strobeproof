// Known-answer suite (plan §4.5). Expectations come ONLY from expected.json (locked).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CASES } from '../fixtures.js';
import { analyzeFrames } from '../analyzeFrames.js';

const expected = JSON.parse(readFileSync(new URL('./expected.json', import.meta.url), 'utf8')).cases;

describe('known-answer suite', () => {
  it('every expected case has a fixture and vice versa', () => {
    expect(Object.keys(CASES).sort()).toEqual(Object.keys(expected).sort());
  });
  for (const [id, exp] of Object.entries(expected)) {
    it(`#${id} ${CASES[id]?.name} → ${exp.verdict}${exp.red ? ' (red)' : exp.general ? ' (general)' : ''}`, () => {
      const c = CASES[id];
      const report = analyzeFrames(c.make(), c.display);
      expect(report.verdict).toBe(exp.verdict);
      if (exp.general) expect(report.general.fail).toBe(true);
      if (exp.red) expect(report.red.fail).toBe(true);
    });
  }
});
