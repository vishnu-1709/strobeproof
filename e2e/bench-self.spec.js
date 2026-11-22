// Strobeproof's own benchmark row: play every bench clip through the extension and record, frame by frame,
// whether the clip was ever shown at normal brightness while it was flashing. Clips are 160×90 px in a 160 px-wide
// viewport, which is exactly the suite's 1024×576 reference display (area scales with 1024 / innerWidth). No screenshots.
import { test, expect } from './ext-fixture.js';
import fs from 'node:fs';

const expected = JSON.parse(fs.readFileSync('core/__tests__/expected.json', 'utf8')).cases;
const cases = JSON.parse(fs.readFileSync('bench/clips/cases.json', 'utf8'));
const row = {};

for (const { id } of cases) {
  test(`Strobeproof vs bench case #${id}`, async ({ page }) => {
    await page.setViewportSize({ width: 160, height: 400 });
    await page.goto(`http://localhost:8642/e2e/pages/media.html?opts=controls,muted`);
    const r = await page.evaluate((src) => new Promise((resolve) => {
      const v = document.createElement('video');
      Object.assign(v, { src, muted: true, playsInline: true, controls: true, width: 160, height: 90 });
      v.style.cssText = 'width:160px;height:90px;position:fixed;left:0;top:0;margin:0';
      document.getElementById('root').append(v);
      let normalFrames = 0, frames = 0;
      v.addEventListener('loadeddata', () => {
        const onFrame = () => {
          frames++;
          if (getComputedStyle(v).filter === 'none') normalFrames++;
          if (!v.ended) v.requestVideoFrameCallback(onFrame);
        };
        v.requestVideoFrameCallback(onFrame);
        v.play();
      }, { once: true });
      v.addEventListener('ended', () => resolve({ normalFrames, frames, final: v.dataset.fg }), { once: true });
    }), `/bench/clips/case-${id}.mp4`);
    const fails = expected[id].verdict === 'FAIL';
    row[id] = fails
      ? (r.normalFrames === 0 ? 'blocked' : 'reached')
      : (r.final === 'safe' ? 'released after check' : 'held calm');
    console.log(`#${id}: ${row[id]} (${r.normalFrames}/${r.frames} frames at normal brightness, final ${r.final})`);
    if (fails) expect(r.normalFrames).toBe(0);
  });
}

test.afterAll(() => {
  if (!Object.keys(row).length) return;
  const j = JSON.parse(fs.readFileSync('lab/benchmark.json', 'utf8'));
  const sp = j.tools.find((t) => t.name === 'Strobeproof');
  sp.results = { ...sp.results, ...row };
  sp.date = new Date().toISOString().slice(0, 10);
  fs.writeFileSync('lab/benchmark.json', JSON.stringify(j, null, 2) + '\n');
});
