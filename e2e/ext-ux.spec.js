// M6: UX layer — chips by keyboard, confirm, Esc, allow site, panic, hide mode, popup, welcome, demo feed, axe.
import { test, expect, states } from './ext-fixture.js';
import AxeBuilder from '@axe-core/playwright';

const P = (q) => `http://localhost:8642/e2e/pages/media.html?${q}`;
const fg = async (page, i = 0) => (await states(page))[i]?.fg;
const chip = (page) => page.locator('strobeproof-chip');
const said = (page) => page.evaluate(() => document.querySelector('strobeproof-live')?.shadowRoot?.textContent || '');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
async function axe(page, include) {
  let b = new AxeBuilder({ page }).withTags(TAGS);
  if (include) b = b.include(include);
  const r = await b.analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
/** Press Tab until focus is on a chip button with this name (keyboard only). */
async function tabTo(page, name, max = 25) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const t = await page.evaluate(() => { const a = document.activeElement; return a?.tagName === 'STROBEPROOF-CHIP' ? a.shadowRoot.activeElement?.textContent : null; });
    if (t === name) return;
  }
  throw new Error(`could not Tab to "${name}"`);
}
const settings = (sw, patch) => sw.evaluate((p) => chrome.storage.local.set({ settings: { enabled: true, mode: 'strict', onRisk: 'calm', freezeGifs: false, allowlist: [], lock: false, ...p } }), patch);

test('risky chip: keyboard only — Show original asks first, Esc returns to Calm; announced politely', async ({ page }) => {
  await page.goto(P('img=flash-5hz.gif'));
  await expect.poll(() => fg(page), { timeout: 10_000 }).toBe('risky');
  await expect(chip(page)).toContainText('Flashing detected');
  await expect.poll(() => said(page)).toMatch(/Flashing detected\. About \d+(\.\d)? flashes per second\. Calm Mode is on\./);
  await axe(page, 'strobeproof-chip');
  await tabTo(page, 'Show original');
  await page.keyboard.press('Enter');
  await expect(chip(page)).toContainText('Show it anyway?');
  await axe(page, 'strobeproof-chip');
  await page.keyboard.press('Tab'); // Cancel → Show it
  await page.keyboard.press('Enter');
  await expect.poll(() => fg(page)).toBe('allow');
  expect((await states(page))[0].filter).toBe('none');
  await expect.poll(() => said(page)).toMatch(/Press Escape to return to Calm Mode/);
  await page.keyboard.press('Escape');
  await expect.poll(() => fg(page)).toBe('risky');
  expect((await states(page))[0].filter).toContain('brightness(0.32)');
});

test('Keep Calm dismisses the chip and keeps the item calm', async ({ page }) => {
  await page.goto(P('img=flash-5hz.gif'));
  await expect.poll(() => fg(page), { timeout: 10_000 }).toBe('risky');
  await tabTo(page, 'Keep Calm');
  await page.keyboard.press('Enter');
  await expect(chip(page)).toHaveCount(0);
  expect((await states(page))[0].filter).toContain('brightness(0.32)');
});

test('safe items get no chip at all', async ({ page }) => {
  await page.goto(P('img=safe-1hz.gif,still.webp'));
  await expect.poll(async () => (await states(page)).map((s) => s.fg).join(), { timeout: 10_000 }).toBe('safe,safe');
  await page.waitForTimeout(1000);
  await expect(chip(page)).toHaveCount(0);
});

test('Always allow this site adds it to the allowlist', async ({ page, sw }) => {
  await page.goto(P('img=flash-5hz.gif'));
  await expect.poll(() => fg(page), { timeout: 10_000 }).toBe('risky');
  await tabTo(page, 'Always allow this site');
  await page.keyboard.press('Enter');
  await expect.poll(() => sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings?.allowlist || [])).toContain('localhost');
});

test("can't-check chip: Play normally (with confirm) shows it normally", async ({ page }) => {
  await page.goto(P('v=calm-fade.mp4&opts=controls,muted,cross'));
  await page.evaluate(() => window.__play());
  await expect.poll(() => fg(page), { timeout: 8000 }).toBe('cant');
  await expect(chip(page)).toContainText("Can't check this video");
  await axe(page, 'strobeproof-chip');
  await tabTo(page, 'Play normally');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect.poll(() => fg(page)).toBe('allow');
});

test('panic toggle calms the whole page, and again restores it', async ({ page, sw }) => {
  await page.goto(P('img=still.webp'));
  await expect.poll(() => fg(page), { timeout: 10_000 }).toBe('safe');
  const toggle = () => sw.evaluate(async () => { const [t] = await chrome.tabs.query({ url: 'http://localhost:8642/*' }); return chrome.tabs.sendMessage(t.id, { type: 'toggle-calm-page' }); });
  await toggle();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).filter)).toContain('brightness(0.32)');
  await expect.poll(() => said(page)).toMatch(/whole page/);
  await toggle();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).filter)).toBe('none');
});

test('hide mode blacks out flashing content', async ({ page, sw }) => {
  await settings(sw, { onRisk: 'hide' });
  await page.goto(P('img=flash-5hz.gif'));
  await expect.poll(() => fg(page), { timeout: 10_000 }).toBe('hide');
  expect((await states(page))[0].filter).toBe('brightness(0)');
  await expect.poll(() => said(page)).toMatch(/Flashing content hidden/);
});

test('popup: axe clean, power switch, caregiver lock asks before changing', async ({ page, extensionId, sw }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByRole('switch', { name: 'Protection is on' })).toBeVisible();
  await axe(page);
  await page.getByRole('checkbox', { name: /Lock these settings/ }).check();
  await page.getByRole('switch').click();
  await expect(page.getByRole('alertdialog')).toContainText('Settings are locked. Turn protection off?');
  await axe(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  expect((await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings)).enabled).toBe(true);
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: 'Change it' }).click();
  await expect.poll(async () => (await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings)).enabled).toBe(false);
  await expect(page.getByRole('switch', { name: 'Protection is off' })).toBeVisible();
  await expect.poll(() => sw.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).length)).toBe(0);
});

test('welcome tab: axe clean, Got it focused, limitations open from #limits', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/welcome.html`);
  await expect(page.getByRole('button', { name: 'Got it' })).toBeFocused();
  await axe(page);
  await page.goto(`chrome-extension://${extensionId}/welcome.html#limits`);
  await expect(page.locator('#limits')).toHaveAttribute('open', '');
});

test('demo feed: every post reports a state; page is axe clean', async ({ page }) => {
  await page.goto('http://localhost:8642/demo/index.html');
  await expect(page.locator('#ext')).toContainText('running', { timeout: 5000 });
  await expect.poll(async () => (await page.locator('.post .state').allTextContents()).filter((t) => /waiting|not running/.test(t)).length, { timeout: 15_000 }).toBe(0);
  const flashing = await page.locator('.media.flashes').evaluateAll((els) => els.map((e) => getComputedStyle(e).filter));
  for (const f of flashing) expect(f).toMatch(/brightness\(0\.32\)|brightness\(0\)/);
  await axe(page, '#main');
});

test('chip is next to its media in Tab order (not at the end of the page)', async ({ page }) => {
  await page.goto(P('img=flash-5hz.gif&opts=links'));
  await expect.poll(() => fg(page), { timeout: 10_000 }).toBe('risky');
  await page.focus('#before-19');
  await page.keyboard.press('Tab');
  const t = await page.evaluate(() => { const a = document.activeElement; return a?.tagName === 'STROBEPROOF-CHIP' ? a.shadowRoot.activeElement?.textContent : a?.id; });
  expect(t).toBe('Keep Calm');
});
