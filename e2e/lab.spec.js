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
