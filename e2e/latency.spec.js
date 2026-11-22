// M7: pre-trip latency (plan §3.3). A released video starts flashing at 3.0 s. Pre-trip fires at the
// PRETRIP_TRANS-th transition (5 → the frame at media time 3.4 s). We measure, on the page's own clock, from that frame's expected display time to the moment
// the extension sets data-fg to a calm state. The CSS filter then paints on the next frame.
import { test, expect } from './ext-fixture.js';
import fs from 'node:fs';
import { PRETRIP_TRANS } from '../core/constants.js';

// late-flash.mp4: transitions at 3.0, 3.1, 3.2 … s, so the n-th is at 3.0 + 0.1 (n − 1).
const TRIGGER_T = 3.0 + 0.1 * (PRETRIP_TRANS - 1);

const RUNS = 12;
// One file per run, so a worker restart (e.g. a slow browser launch) never loses earlier runs.
const DIR = 'test-results/latency-runs';

for (let run = 1; run <= RUNS; run++) {
  test(`pre-trip latency run ${run}/${RUNS}`, async ({ page }) => {
    await page.goto('http://localhost:8642/e2e/pages/media.html?v=late-flash.mp4&opts=controls,muted');
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    const r = await page.evaluate((TRIGGER_T) => new Promise((resolve, reject) => {
      const v = document.querySelector('video');
      let fourth = null, released = null, calmedAt = null;
      new MutationObserver(() => {
        const s = v.dataset.fg;
        if (s === 'safe' && released === null && !v.paused) released = performance.now();
        if (released !== null && calmedAt === null && ['calm', 'risky', 'hide'].includes(s)) calmedAt = performance.now();
      }).observe(v, { attributes: true, attributeFilter: ['data-fg'] });
      const onFrame = (now, m) => {
        if (fourth === null && m.mediaTime >= TRIGGER_T - 1e-3) fourth = m.expectedDisplayTime;
        if (calmedAt !== null && fourth !== null) return resolve({ latency: calmedAt - fourth, releasedBeforeFlash: released !== null, fourthAt: fourth, calmedAt });
        if (v.ended) return reject(new Error(`ended: released=${released} fourth=${fourth} calmedAt=${calmedAt}`));
        v.requestVideoFrameCallback(onFrame);
      };
      // Still calm when the flashing started (never released): nothing reached the screen, nothing to time.
      v.addEventListener('ended', () => { if (released === null) resolve({ alreadyCalm: true }); }, { once: true });
      v.requestVideoFrameCallback(onFrame);
      v.play().catch(reject);
    }), TRIGGER_T);
    if (run === 1) fs.rmSync(DIR, { recursive: true, force: true }); // fresh set; restarts keep earlier runs
    fs.mkdirSync(DIR, { recursive: true });
    if (r.alreadyCalm) { fs.writeFileSync(`${DIR}/${run}.json`, 'null'); console.log(`run ${run}: still calm when flashing began (not timed)`); return; }
    expect(r.releasedBeforeFlash).toBe(true); // the clip was shown normally before the flashing started
    fs.writeFileSync(`${DIR}/${run}.json`, JSON.stringify(r.latency));
    console.log(`run ${run}: ${r.latency.toFixed(1)} ms from transition #${PRETRIP_TRANS} to calm`);
  });
}

test.afterAll(() => {
  const all = fs.existsSync(DIR) ? fs.readdirSync(DIR).map((f) => JSON.parse(fs.readFileSync(`${DIR}/${f}`, 'utf8'))) : [];
  if (all.length < RUNS) return; // only the final, complete set is published
  const results = all.filter((x) => x !== null), alreadyCalm = all.length - results.length;
  const worst = Math.max(...results), median = [...results].sort((a, b) => a - b)[Math.floor(results.length / 2)];
  const out = { runs: results.length, already_calm_runs: alreadyCalm, worst_ms: +worst.toFixed(1), median_ms: +median.toFixed(1), all_ms: results.map((x) => +x.toFixed(1)),
    browser: 'Microsoft Edge (Chromium), headless, Playwright', clip: 'late-flash.mp4, 30 fps, 5 Hz from 3.0 s', trigger: `transition #${PRETRIP_TRANS} (media ${TRIGGER_T.toFixed(1)} s)`, date: new Date().toISOString().slice(0, 10) };
  fs.writeFileSync('e2e/latency.json', JSON.stringify(out, null, 2));
  console.log('LATENCY', JSON.stringify(out));
});
