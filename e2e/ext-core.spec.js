// M4: extension core — Calm by default, release paused video, live detection with pre-trip, can't-check, shadow DOM, allowlist.
import { test, expect, states } from './ext-fixture.js';

const P = (q) => `http://localhost:8642/e2e/pages/media.html?${q}`;
const fg = async (page, i = 0) => (await states(page))[i]?.fg;

test('paused, non-autoplay video is released immediately (never darkened)', async ({ page }) => {
  await page.goto(P('v=safe-2hz.mp4&opts=controls,muted'));
  await expect.poll(() => fg(page)).toBe('safe');
  expect((await states(page))[0].filter).toBe('none');
});

test('5 Hz video: calm while checking, then confirmed risky (stays calm)', async ({ page }) => {
  await page.goto(P('v=flash-5hz.mp4&opts=controls,muted'));
  await expect.poll(() => fg(page)).toBe('safe');
  await page.evaluate(() => window.__play());
  await expect.poll(() => fg(page), { timeout: 8000 }).toBe('risky');
  expect((await states(page))[0].filter).toContain('brightness(0.32)');
});

test('non-flashing video: calm during the 2 s warm-up, then released', async ({ page }) => {
  await page.goto(P('v=calm-fade.mp4&opts=controls,muted'));
  await expect.poll(() => fg(page)).toBe('safe');
  await page.evaluate(() => window.__play());
  await expect.poll(() => fg(page), { timeout: 3000 }).toBe('checking');
  await expect.poll(() => fg(page), { timeout: 8000 }).toBe('safe');
});

test('2 Hz full-frame flash (4 transitions/s, compliant) is released and plays at normal brightness', async ({ page }) => {
  // PRETRIP_TRANS = 5: 4 transitions/s stays below the pre-trip level.
  await page.goto(P('v=flash-2hz-6s.mp4&opts=controls,muted'));
  await page.evaluate(() => window.__play());
  await expect.poll(() => fg(page), { timeout: 8000 }).toBe('safe');
  expect((await states(page))[0].filter).toBe('none');
});

test('2.5 Hz full-frame flash (5 transitions/s) is calmed but never confirmed risky', async ({ page }) => {
  await page.goto(P('v=flash-2p5hz-6s.mp4&opts=controls,muted'));
  await page.evaluate(() => window.__play());
  await page.waitForTimeout(4500);
  const s = (await states(page))[0];
  expect(['checking', 'calm']).toContain(s.fg);
  expect(s.filter).toContain('brightness(0.32)');
});

test('cross-origin video without CORS: "can\'t check", stays calm', async ({ page }) => {
  await page.goto(P('v=calm-fade.mp4&opts=controls,muted,cross'));
  await page.evaluate(() => window.__play());
  await expect.poll(() => fg(page), { timeout: 8000 }).toBe('cant');
  expect((await states(page))[0].filter).toContain('brightness(0.32)');
});

test('video inside a closed shadow root is found and calmed inline', async ({ page }) => {
  await page.goto(P('v=flash-5hz.mp4&opts=controls,muted,shadow'));
  await expect.poll(() => fg(page)).toBe('safe');
  await page.evaluate(() => window.__play());
  await expect.poll(() => fg(page), { timeout: 8000 }).toBe('risky');
  expect((await states(page))[0].filter).toContain('brightness(0.32)');
});

test('allowlisted site never gets the calm CSS or the script', async ({ page, sw }) => {
  await sw.evaluate(() => chrome.storage.local.set({ settings: { enabled: true, mode: 'strict', onRisk: 'calm', freezeGifs: false, allowlist: ['localhost'], lock: false } }));
  await expect.poll(() => sw.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts())[0]?.excludeMatches?.length || 0)).toBeGreaterThan(0);
  await page.goto(P('v=flash-5hz.mp4&opts=autoplay,muted,loop'));
  await page.waitForTimeout(1500);
  const s = (await states(page))[0];
  expect(s.fg).toBeNull();
  expect(s.filter).toBe('none');
});
