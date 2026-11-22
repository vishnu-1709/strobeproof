// Automated M0 spike: loads spike/extension into Playwright Chromium and runs all five probes.
// Usage: node spike/auto.mjs [--headed]
// Writes spike/results.json. No flashing content is used anywhere.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
const ext = path.join(here, 'extension');
const headed = process.argv.includes('--headed');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-spike-'));

const ctx = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: !headed,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--autoplay-policy=no-user-gesture-required'],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const extId = new URL(sw.url()).host;
const results = { date: new Date().toISOString(), browser: ctx.browser()?.version?.() ?? 'chromium (persistent)', probes: {} };

// ④⑤ Calm measurement + fullscreen, inside an extension page (captureVisibleTab).
{
  const p = await ctx.newPage();
  await p.goto(`chrome-extension://${extId}/calm.html`);
  await p.bringToFront();
  await p.waitForTimeout(800);
  await p.click('#measure');
  await p.waitForFunction(() => document.getElementById('out').textContent.includes('probe') || document.getElementById('out').textContent.includes('error'), null, { timeout: 15000 });
  results.probes.calm = JSON.parse(await p.textContent('#out'));
  await p.click('#fs');
  await p.waitForFunction(() => document.getElementById('out').textContent.includes('Fullscreen') || document.getElementById('out').textContent.includes('error'), null, { timeout: 15000 });
  results.probes.fullscreen = JSON.parse(await p.textContent('#out'));
  // Cross-check ④ with a plain page screenshot (same compositor, no extension involved).
  const q = await ctx.newPage();
  await q.setContent(`<body style="margin:0;background:#000"><div style="width:200px;height:200px;background:#fff;filter:grayscale(1) brightness(0.32)"></div><div style="width:200px;height:200px;background:#f00;filter:grayscale(1) brightness(0.32)"></div></body>`);
  const shot = await q.screenshot({ clip: { x: 0, y: 0, width: 200, height: 400 } });
  results.probes.calmScreenshotCrossCheck = await q.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const px = (x, y) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)];
    return { whiteCalm: px(100, 100), redCalm: px(100, 300) };
  }, shot.toString('base64'));
  await q.close(); await p.close();
}

// ①②③ Real sites. Each probe: load, wait for media, ask the content script via the SW, then fetch test.
const sites = {
  youtube: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  reddit: 'https://www.reddit.com/r/gifs/top/?t=week',
  x: 'https://x.com/NASA',
  giphy: 'https://giphy.com/trending-gifs',
};
for (const [name, url] of Object.entries(sites)) {
  const p = await ctx.newPage();
  const r = { url };
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(8000);
    await p.mouse.wheel(0, 1200); await p.waitForTimeout(3000);
    r.finalUrl = p.url();
    r.title = await p.title();
    r.report = await sw.evaluate(async (pageUrl) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find(t => t.url && t.url.startsWith(pageUrl.slice(0, 20)));
      if (!tab) return { error: 'tab not found' };
      return await chrome.tabs.sendMessage(tab.id, { type: 'spike-probe' });
    }, r.finalUrl);
    const urls = [...new Set([
      ...(r.report.videos || []).flatMap(v => [v.currentSrc, ...v.sources.map(s => s.src)]).filter(u => /^https?:/.test(u || '')),
      ...(r.report.animatedImgCandidates || []),
    ])].slice(0, 6);
    if (urls.length) {
      r.extensionFetch = await sw.evaluate(async (urls) => {
        if (!(await chrome.offscreen.hasDocument())) {
          await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['WORKERS'], justification: 'spike' });
        }
        return (await chrome.runtime.sendMessage({ type: 'offscreen-fetch', urls })).results;
      }, urls);
    }
  } catch (e) { r.error = String(e); }
  results.probes[name] = r;
  await p.close();
}

fs.writeFileSync(path.join(here, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await ctx.close();
