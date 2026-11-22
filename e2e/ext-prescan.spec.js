// M5: offscreen pre-scan — GIF / animated WebP / GIF-video verdicts before release; static WebP fast path.
import { test, expect, states } from './ext-fixture.js';

const P = (q) => `http://localhost:8642/e2e/pages/media.html?${q}`;
const fg = async (page, i = 0) => (await states(page))[i]?.fg;

/** Polls states and fails if the item is ever shown at normal brightness before its verdict. */
async function neverNormalUntil(page, final, timeout = 10_000) {
  const t0 = Date.now(); const seen = [];
  for (;;) {
    const s = (await states(page))[0];
    seen.push(s.fg);
    if (s.fg === final) return seen;
    expect(s.filter === 'none' && final !== 'safe', `shown normally before verdict (seen: ${seen.join(',')})`).toBe(false);
    if (Date.now() - t0 > timeout) throw new Error(`never reached ${final}; seen ${[...new Set(seen)].join(',')}`);
    await page.waitForTimeout(25);
  }
}

test('flashing GIF stays calm and is confirmed risky (never shown normally)', async ({ page }) => {
  await page.goto(P('img=flash-5hz.gif'));
  await neverNormalUntil(page, 'risky');
  expect((await states(page))[0].filter).toContain('brightness(0.32)');
});

test('slow GIF is released after the check', async ({ page }) => {
  await page.goto(P('img=safe-1hz.gif'));
  await expect.poll(() => fg(page), { timeout: 10_000 }).toBe('safe');
  expect((await states(page))[0].filter).toBe('none');
});

test('animated WebP 5 Hz is risky; static WebP and static GIF are released', async ({ page }) => {
  await page.goto(P('img=flash-5hz.webp'));
  await neverNormalUntil(page, 'risky');
  await page.goto(P('img=still.webp'));
  await expect.poll(() => fg(page), { timeout: 10_000 }).toBe('safe');
  await page.goto(P('img=still.gif'));
  await expect.poll(() => fg(page), { timeout: 10_000 }).toBe('safe');
});

test('cross-origin GIF is still pre-scanned (extension fetch ignores page CORS)', async ({ page }) => {
  await page.goto(P('img=flash-5hz.gif&opts=cross'));
  await neverNormalUntil(page, 'risky');
});

test('GIF that is too small to fail (60×40) is released without decoding', async ({ page }) => {
  await page.goto(P('img=flash-5hz.gif&size=60x40'));
  await expect.poll(() => fg(page), { timeout: 5000 }).toBe('safe');
});

test('GIF-style video (muted, autoplay, loop): flashing one is risky before ever showing normally', async ({ page }) => {
  await page.goto(P('v=flash-5hz.mp4&opts=autoplay,muted,loop'));
  await neverNormalUntil(page, 'risky');
});

test('GIF-style video that is calm is released by the pre-scan', async ({ page }) => {
  await page.goto(P('v=calm-fade.mp4&opts=autoplay,muted,loop'));
  await expect.poll(() => fg(page), { timeout: 10_000 }).toBe('safe');
});

test('30 static WebPs are each released within 300 ms of entering the viewport (Decision C6.3)', async ({ page }) => {
  await page.goto(P('img=still.webp&n=30&opts=far'));
  for (let y = 0; y < 6000; y += 400) { await page.mouse.wheel(0, 400); await page.waitForTimeout(120); }
  await page.waitForTimeout(800);
  const lat = (await page.evaluate(() => window.__releaseLatency())).filter((x) => x !== null);
  expect(lat.length).toBeGreaterThanOrEqual(25);
  console.log(`static WebP release latency after entering viewport: max ${Math.max(...lat).toFixed(0)} ms, n=${lat.length}`);
  expect(Math.max(...lat)).toBeLessThanOrEqual(300);
});

test('verdicts are cached by URL: a revisit releases without re-checking', async ({ page, sw }) => {
  await page.goto(P('img=safe-1hz.gif'));
  await expect.poll(() => fg(page), { timeout: 10_000 }).toBe('safe');
  const keys = await sw.evaluate(async () => Object.keys(await chrome.storage.session.get(null)));
  expect(keys.some((k) => k.startsWith('v:') && k.includes('safe-1hz.gif'))).toBe(true);
  await page.reload();
  await expect.poll(() => fg(page), { timeout: 2000 }).toBe('safe');
});
