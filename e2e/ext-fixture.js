// Playwright fixture: a persistent Edge (Chromium) context with the unpacked extension loaded.
// Safety: no video, no traces, no screenshots; pages keep every clip ≤ 160 px.
import { test as base, expect, chromium } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ext = path.resolve(process.env.SP_EXT || 'extension'); // SP_EXT: test an unzipped release instead

export const test = base.extend({
  context: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-e2e-'));
    const ctx = await chromium.launchPersistentContext(dir, {
      channel: process.env.SP_CHANNEL || 'msedge',
      headless: true,
      viewport: { width: 480, height: 800 },
      args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--autoplay-policy=no-user-gesture-required'],
    });
    await use(ctx);
    await ctx.close();
    fs.rmSync(dir, { recursive: true, force: true });
  },
  sw: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    // Wait until calm.css + content.js are registered (onInstalled is async).
    await expect.poll(() => sw.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).length), { timeout: 10_000 }).toBe(2);
    await use(sw);
  },
  extensionId: async ({ sw }, use) => { await use(new URL(sw.url()).host); },
  page: async ({ context, sw }, use) => {
    // Close the welcome tab opened on install so tests start clean.
    for (const p of context.pages()) if (p.url().includes('welcome.html')) await p.close();
    const page = await context.newPage();
    await use(page);
  },
});
export { expect };

/** States of media on the test page (works for closed shadow roots via the page's own hook). */
export const states = (page) => page.evaluate(() => window.__state());
