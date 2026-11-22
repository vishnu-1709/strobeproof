// M7: pre-trip latency (plan §3.3). A released video starts flashing at 3.0 s; its 4th transition is the frame
// at media time 3.3 s. We measure, on the page's own clock, from that frame's expected display time to the moment
// the extension sets data-fg to a calm state. The CSS filter then paints on the next frame.
import { test, expect } from './ext-fixture.js';
import fs from 'node:fs';

const RUNS = 10;
const results = [];

for (let run = 1; run <= RUNS; run++) {
  test(`pre-trip latency run ${run}/${RUNS}`, async ({ page }) => {
    await page.goto('http://localhost:8642/e2e/pages/media.html?v=late-flash.mp4&opts=controls,muted');
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    const r = await page.evaluate(() => new Promise((resolve, reject) => {
      const v = document.querySelector('video');
      let fourth = null, released = null, calmedAt = null;
      new MutationObserver(() => {
        const s = v.dataset.fg;
        if (s === 'safe' && released === null && !v.paused) released = performance.now();
        if (released !== null && calmedAt === null && ['calm', 'risky', 'hide'].includes(s)) calmedAt = performance.now();
      }).observe(v, { attributes: true, attributeFilter: ['data-fg'] });
      const onFrame = (now, m) => {
        if (fourth === null && m.mediaTime >= 3.3 - 1e-3) fourth = m.expectedDisplayTime;
        if (calmedAt !== null && fourth !== null) return resolve({ latency: calmedAt - fourth, releasedBeforeFlash: released !== null, fourthAt: fourth, calmedAt });
        if (v.ended) return reject(new Error(`ended: released=${released} fourth=${fourth} calmedAt=${calmedAt}`));
        v.requestVideoFrameCallback(onFrame);
      };
      v.requestVideoFrameCallback(onFrame);
      v.play().catch(reject);
    }));
    expect(r.releasedBeforeFlash).toBe(true); // the clip was shown normally before the flashing started
    results.push(r.latency);
    console.log(`run ${run}: ${r.latency.toFixed(1)} ms from 4th transition to calm`);
  });
}

test.afterAll(() => {
  if (!results.length) return;
  const worst = Math.max(...results), median = [...results].sort((a, b) => a - b)[Math.floor(results.length / 2)];
  const out = { runs: results.length, worst_ms: +worst.toFixed(1), median_ms: +median.toFixed(1), all_ms: results.map((x) => +x.toFixed(1)),
    browser: 'Microsoft Edge (Chromium), headless, Playwright', clip: 'late-flash.mp4, 30 fps, 5 Hz from 3.0 s', date: new Date().toISOString().slice(0, 10) };
  fs.writeFileSync('e2e/latency.json', JSON.stringify(out, null, 2));
  console.log('LATENCY', JSON.stringify(out));
});
