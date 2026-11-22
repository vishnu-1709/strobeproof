// Lab E2E: suite page all green, file verdicts, axe-core zero violations. No screenshots/video/traces.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

const clip = (n) => path.resolve('clips', n);

async function axe(page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test('suite page: every case matches the locked answer', async ({ page }) => {
  await page.goto('/lab/suite.html');
  const res = page.locator('#suite-result');
  await expect(res).toBeVisible({ timeout: 45_000 });
  const pass = await res.getAttribute('data-pass'), total = await res.getAttribute('data-total');
  expect(Number(total)).toBeGreaterThanOrEqual(20);
  expect(pass).toBe(total);
  await axe(page);
});

async function check(page, file, { custom = true } = {}) {
  await page.goto('/lab/index.html');
  if (custom) {
    await page.check('#size-custom');
    await page.fill('#w', '1024'); await page.fill('#h', '576'); await page.fill('#vw', '1024');
  }
  await page.setInputFiles('#file', clip(file));
  await page.click('#go');
  const v = page.locator('#result-live .verdict');
  await expect(v).toBeVisible({ timeout: 30_000 });
  return (await v.textContent()).trim();
}

test('5 Hz MP4 at 1024×576 fails', async ({ page }) => {
  expect(await check(page, 'flash-5hz.mp4')).toMatch(/Flashes too fast at 0:00/);
  await expect(page.locator('#stats')).toContainText('of 90');
  await axe(page);
});
test('2 Hz MP4 is safe', async ({ page }) => {
  expect(await check(page, 'safe-2hz.mp4')).toMatch(/^Safe to post/);
});
test('red 5 Hz MP4 fails as red', async ({ page }) => {
  expect(await check(page, 'red-5hz.mp4')).toMatch(/red flashes/);
});
test('5 Hz GIF fails; 1 Hz GIF safe', async ({ page }) => {
  expect(await check(page, 'flash-5hz.gif')).toMatch(/Flashes too fast/);
  expect(await check(page, 'safe-1hz.gif')).toMatch(/^Safe to post/);
});
test('animated WebP 5 Hz fails; still WebP is not animated', async ({ page }) => {
  expect(await check(page, 'flash-5hz.webp')).toMatch(/Flashes too fast/);
  expect(await check(page, 'still.webp')).toMatch(/isn't animated/);
});
test('area rule: 5 Hz at its own size 320×180 (57,600 px²) fails; at 160×90 (14,400 px²) passes', async ({ page }) => {
  expect(await check(page, 'flash-5hz.mp4', { custom: false })).toMatch(/Flashes too fast/);
  await page.goto('/lab/index.html');
  await page.check('#size-custom');
  await page.fill('#w', '160'); await page.fill('#h', '90'); await page.fill('#vw', '1024');
  await page.setInputFiles('#file', clip('flash-5hz.mp4'));
  await page.click('#go');
  await expect(page.locator('#result-live .verdict')).toContainText('Safe to post', { timeout: 30_000 });
});
test('WebM falls back to calm playback and still fails', async ({ page }) => {
  const text = await check(page, 'flash-5hz.webm');
  expect(text).toMatch(/Flashes too fast|Couldn't check every frame/);
});

test('benchmark page renders every bench case and is axe clean', async ({ page }) => {
  await page.goto('/lab/benchmark.html');
  await expect(page.locator('#rows tr')).toHaveCount(18);
  await expect(page.locator('#status')).toContainText('Strobeproof row measured');
  await axe(page);
});

test('bench recorder is gated: nothing plays until consent, large size is off', async ({ page }) => {
  await page.goto('/bench/index.html');
  await expect(page.getByRole('button', { name: 'Start' })).toBeDisabled();
  await expect(page.locator('#s640')).toBeDisabled();
  await expect(page.locator('#stage')).toBeHidden();
  await axe(page);
});

test('crop mode (screen recordings): region size and screen width decide the area', async ({ page }) => {
  const run = async (vw) => {
    await page.goto('/lab/index.html');
    await page.check('#crop-on');
    await page.fill('#cx', '40'); await page.fill('#cy', '20'); await page.fill('#cw', '160'); await page.fill('#ch', '90');
    await page.fill('#vw', String(vw));
    await page.setInputFiles('#file', clip('flash-5hz.mp4'));
    await page.click('#go');
    const v = page.locator('#result-live .verdict');
    await expect(v).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#stats')).toContainText('160×90 px at (40, 20)');
    return (await v.textContent()).trim();
  };
  expect(await run(1024)).toMatch(/^Safe to post/);     // 14,400 px² on a 1024-wide screen: below the limit
  expect(await run(320)).toMatch(/Flashes too fast/);   // same region on a 320-wide screen: 147,456 px²
});

test('Try a sample: instant FAIL verdict and chart, only a 64 px grey still is shown, axe clean', async ({ page }) => {
  await page.goto('/lab/index.html');
  const t0 = Date.now();
  await page.getByRole('button', { name: 'Try a sample' }).click();
  await expect(page.locator('#result-live .verdict')).toContainText('Flashes too fast', { timeout: 10_000 });
  console.log(`sample verdict in ${Date.now() - t0} ms`);
  await expect(page.locator('#chart path')).toHaveCount(2);
  const prev = page.locator('#sample-canvas');
  await expect(prev).toBeVisible();
  expect(await prev.evaluate((c) => [c.getBoundingClientRect().width, c.getBoundingClientRect().height])).toEqual([64, 36]);
  expect(await page.locator('video:visible, img[src*="flash"]').count()).toBe(0); // the clip itself is never shown
  await axe(page);
});
