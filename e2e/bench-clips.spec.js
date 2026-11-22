// The encoded benchmark clips must give the same locked answers as the synthetic frame arrays
// (checks the ffmpeg → MP4 → WebCodecs path end to end). Analysed in the Lab; clips are never shown.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const expected = JSON.parse(fs.readFileSync('core/__tests__/expected.json', 'utf8')).cases;
const cases = JSON.parse(fs.readFileSync('bench/clips/cases.json', 'utf8'));

for (const { id, name } of cases) {
  test(`bench clip #${id} (${name}) → ${expected[id].verdict}`, async ({ page }) => {
    await page.goto('/lab/index.html');
    await page.check('#size-custom');
    await page.fill('#w', '1024'); await page.fill('#h', '576'); await page.fill('#vw', '1024');
    await page.setInputFiles('#file', path.resolve('bench/clips', `case-${id}.mp4`));
    await page.click('#go');
    const v = page.locator('#result-live .verdict');
    await expect(v).toBeVisible({ timeout: 30_000 });
    const text = (await v.textContent()).trim();
    expect(text).toMatch(expected[id].verdict === 'FAIL' ? /Flashes too fast/ : /^Safe to post/);
  });
}
