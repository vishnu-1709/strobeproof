// Lab "Check a file" page.
import { analyzeFrames } from '../core/analyzeFrames.js';
import { tilesFromRGBA } from '../core/luminance.js';
import { SAMPLE_W, SAMPLE_H, FAIL_TRANSITIONS, AREA_LIMIT_PX, CALM_FILTER } from '../core/constants.js';

const $ = (id) => document.getElementById(id);
const fileIn = $('file'), go = $('go'), status = $('status'), live = $('result-live');
let file = null, media = null, lastReport = null, mode = 'worker';
let worker = null;

const fmt = (s) => { const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${String(r).padStart(2, '0')}`; };
const num = (x, d = 0) => Number(x).toLocaleString(undefined, { maximumFractionDigits: d });

function display() {
  const custom = $('size-custom').checked;
  const vw = Math.max(320, +$('vw').value || 1024);
  if (!custom) return media ? { width: media.crop?.w ?? media.width, height: media.crop?.h ?? media.height, viewportWidth: vw } : { viewportWidth: vw };
  return { width: Math.max(16, +$('w').value || 640), height: Math.max(16, +$('h').value || 360), viewportWidth: vw };
}

let isSample = false;
function setFile(f, sample = false) {
  file = f; media = null; lastReport = null; isSample = sample;
  $('sample-preview').hidden = true;
  go.disabled = !f;
  $('details').hidden = true; live.innerHTML = '';
  status.textContent = f ? `Ready: ${f.name} (${num(f.size / 1024)} KB).` : '';
}
fileIn.addEventListener('change', () => setFile(fileIn.files[0] || null));
const drop = $('drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });

for (const id of ['size-native', 'size-custom', 'w', 'h', 'vw']) {
  $(id).addEventListener('change', () => { if (lastReport) reanalyze(); });
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'progress') status.textContent = m.text;
    else if (m.type === 'result') { media = m.media; mode = 'worker'; show(m.report); }
    else if (m.type === 'needs-playback') playbackAnalyze();
    else if (m.type === 'error') fail(m.message);
  };
  return worker;
}

function fail(message) {
  go.disabled = false;
  status.textContent = '';
  live.innerHTML = '';
  const v = document.createElement('div');
  v.className = 'verdict info';
  v.innerHTML = `<h2>Couldn't check this file</h2><p></p>`;
  v.querySelector('p').textContent = message;
  live.append(v);
}

$('sample').addEventListener('click', async () => {
  status.textContent = 'Loading the sample…';
  const res = await fetch('../demo/media/flash-5hz.mp4');
  if (!res.ok) return fail('The sample clip could not be loaded.');
  setFile(new File([await res.blob()], 'sample-flash-5hz.mp4', { type: 'video/mp4' }), true);
  go.click();
});

function drawPreview(L) {
  const c = $('sample-canvas'), g = c.getContext('2d'), img = g.createImageData(32, 18);
  for (let i = 0; i < 576; i++) {
    const l = L[i], v = Math.round(255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055));
    img.data.set([v, v, v, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  $('sample-preview').hidden = false;
}

go.addEventListener('click', async () => {
  if (!file) return;
  go.disabled = true;
  status.textContent = 'Loading…';
  live.innerHTML = '';
  const buffer = await file.arrayBuffer();
  // Native size isn't known until decode; the worker fills in media width/height when width is absent.
  const d = $('size-custom').checked ? display() : { viewportWidth: display().viewportWidth };
  const crop = $('crop-on').checked
    ? { x: Math.max(0, +$('cx').value || 0), y: Math.max(0, +$('cy').value || 0), w: Math.max(8, +$('cw').value || 8), h: Math.max(8, +$('ch').value || 8) }
    : undefined;
  getWorker().postMessage({ type: 'analyze', buffer, mime: file.type, name: file.name, display: d, crop }, [buffer]);
});

let playbackFrames = null;
function reanalyze() {
  if (mode === 'worker') getWorker().postMessage({ type: 'reanalyze', display: display() });
  else if (playbackFrames) {
    const d = display();
    const r = analyzeFrames(playbackFrames, { displayWidth: d.width, displayHeight: d.height, viewportWidth: d.viewportWidth, incomplete: media.incomplete });
    r.display = { displayWidth: d.width, displayHeight: d.height, viewportWidth: d.viewportWidth };
    show(r);
  }
}

/** Fallback for formats WebCodecs can't demux here (e.g. WebM): play once in Calm at 160 px, read every presented frame. */
async function playbackAnalyze() {
  const v = $('player'), box = $('player-box');
  v.style.filter = CALM_FILTER;
  box.hidden = false;
  status.textContent = 'Playing once in Calm Mode to check every frame…';
  const url = URL.createObjectURL(file);
  v.src = url;
  const canvas = new OffscreenCanvas(SAMPLE_W, SAMPLE_H);
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const frames = [];
  let lastPresented = null, gaps = 0;
  const crop = $('crop-on').checked
    ? { x: Math.max(0, +$('cx').value || 0), y: Math.max(0, +$('cy').value || 0), w: Math.max(8, +$('cw').value || 8), h: Math.max(8, +$('ch').value || 8) }
    : null;
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('This browser cannot play this file.')); }).catch((e) => { fail(e.message); throw e; });
  const done = new Promise((res) => { v.onended = res; });
  const onFrame = (_now, meta) => {
    if (lastPresented !== null && meta.presentedFrames - lastPresented > 1) gaps += meta.presentedFrames - lastPresented - 1;
    lastPresented = meta.presentedFrames;
    // Filters don't apply to drawImage: we read true pixels.
    if (crop) g.drawImage(v, crop.x, crop.y, crop.w, crop.h, 0, 0, SAMPLE_W, SAMPLE_H);
    else g.drawImage(v, 0, 0, SAMPLE_W, SAMPLE_H);
    frames.push({ t: meta.mediaTime, tiles: tilesFromRGBA(g.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data, SAMPLE_W, SAMPLE_H) });
    if (!v.ended) v.requestVideoFrameCallback(onFrame);
  };
  v.requestVideoFrameCallback(onFrame);
  await v.play();
  await done;
  box.hidden = true;
  URL.revokeObjectURL(url);
  frames.sort((a, b) => a.t - b.t);
  media = { kind: 'video', type: file.type || 'video', width: v.videoWidth, height: v.videoHeight, frameCount: frames.length,
    duration: v.duration, incomplete: gaps > 0, droppedFrames: gaps, method: 'playback (requestVideoFrameCallback)', crop };
  playbackFrames = frames;
  mode = 'playback';
  reanalyze();
}

function show(report) {
  lastReport = report;
  go.disabled = false;
  status.textContent = '';
  $('native-label').textContent = media?.width ? `At its own size (${media.width}×${media.height} px)` : 'At its own size';

  const v = document.createElement('div');
  if (media?.kind === 'image' && !media.animated) {
    v.className = 'verdict ok';
    v.innerHTML = '<h2>Safe to post</h2><p>This image isn\'t animated, so it can\'t flash.</p>';
  } else if (report.verdict === 'PASS') {
    v.className = 'verdict ok';
    v.innerHTML = `<h2>Safe to post</h2><p>No flashing above the WCAG 2.3.1 limits in any 1-second window. Worst second: ${num(report.worst.flashesPerSecond, 1)} flashes (limit: 3).</p>`;
  } else if (report.verdict === 'FAIL') {
    const ranges = report.failRanges.slice(0, 3).map((r) => `${fmt(r.start)}–${fmt(Math.max(r.end, r.start + 1))}`).join(', ');
    const kinds = [report.general.fail && 'brightness', report.red.fail && 'red'].filter(Boolean).join(' and ');
    v.className = 'verdict fail';
    v.innerHTML = `<h2>Flashes too fast at ${ranges}${report.failRanges.length > 3 ? ' and more' : ''}</h2>
      <p>About ${num(report.worst.flashesPerSecond, 1)} ${kinds} flashes per second in the worst second (limit: 3), over a large enough area to fail WCAG 2.3.1.</p>`;
  } else {
    v.className = 'verdict info';
    v.innerHTML = `<h2>Couldn't check every frame</h2><p>No failing flashes were found, but ${media?.droppedFrames ? `${media.droppedFrames} frames were skipped during playback` : 'some frames could not be decoded'}, so this is not a pass. Try an MP4 or GIF version.</p>`;
  }
  live.innerHTML = '';
  live.append(v);
  if (isSample && media?.preview) drawPreview(media.preview);
  drawChart(report);
  drawStats(report);
  $('details').hidden = false;
}

function drawChart(r) {
  const svg = $('chart');
  const W = 1000, H = 240, L = 44, R = 12, T = 14, B = 30;
  const { t, general, red } = r.timeline;
  const t0 = t[0] ?? 0, t1 = Math.max(t0 + 1, t[t.length - 1] ?? 1);
  const yMax = Math.max(10, ...general, ...red) + 1;
  const x = (s) => L + ((s - t0) / (t1 - t0)) * (W - L - R);
  const y = (n) => T + (1 - n / yMax) * (H - T - B);
  const path = (arr) => arr.map((n, i) => `${i ? 'L' : 'M'}${x(t[i]).toFixed(1)},${y(n).toFixed(1)}`).join('');
  const NS = 'http://www.w3.org/2000/svg';
  const keep = [...svg.querySelectorAll('title,desc')];
  svg.replaceChildren(...keep);
  const el = (name, attrs) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); svg.append(e); return e; };
  for (const fr of r.failRanges) el('rect', { x: x(fr.start), y: T, width: Math.max(2, x(fr.end) - x(fr.start)), height: H - T - B, fill: 'var(--shade)' });
  for (let n = 0; n <= yMax; n += yMax > 20 ? 5 : 2) {
    el('line', { x1: L, x2: W - R, y1: y(n), y2: y(n), stroke: 'var(--line)', 'stroke-width': 1 });
    el('text', { x: L - 8, y: y(n) + 4, 'text-anchor': 'end' }).textContent = n;
  }
  const step = Math.max(1, Math.ceil((t1 - t0) / 8));
  for (let s = Math.ceil(t0); s <= t1; s += step) el('text', { x: x(s), y: H - 10, 'text-anchor': 'middle' }).textContent = fmt(s);
  el('line', { x1: L, x2: W - R, y1: y(FAIL_TRANSITIONS), y2: y(FAIL_TRANSITIONS), stroke: 'var(--limit)', 'stroke-width': 2, 'stroke-dasharray': '6 4' });
  el('path', { d: path(red), fill: 'none', stroke: 'var(--series-b)', 'stroke-width': 2 });
  el('path', { d: path(general), fill: 'none', stroke: 'var(--series-a)', 'stroke-width': 2.5 });
  svg.querySelector('desc').textContent = `Peak ${r.general.maxTransitions} general and ${r.red.maxTransitions} red transitions in one second; limit is ${FAIL_TRANSITIONS}. ${r.failRanges.length} failing span(s).`;
}

function drawStats(r) {
  const d = r.display || {};
  const rows = [
    ['Result', r.verdict],
    ['Frames checked', `${num(r.frameCount)}${media?.expectedFrames ? ` of ${num(media.expectedFrames)}` : ''}${media?.kind === 'image' && media.animated ? ` (${media.frameCount} unique, looped)` : ''}`],
    ['Duration', `${num(media?.duration ?? r.duration, 2)} s`],
    ['Method', media?.method || (media?.kind === 'image' ? 'ImageDecoder, every frame' : 'WebCodecs VideoDecoder, every frame')],
    ['Worst second', `${r.worst.transitions} transitions ≈ ${num(r.worst.flashesPerSecond, 1)} flashes, ending at ${fmt(r.worst.t)}`],
    ['General flash', r.general.fail ? `Fails (peak ${r.general.maxTransitions} transitions/s)` : `Passes (peak ${r.general.maxTransitions} transitions/s)`],
    ['Red flash', r.red.fail ? `Fails (peak ${r.red.maxTransitions} transitions/s)` : `Passes (peak ${r.red.maxTransitions} transitions/s)`],
    ['Largest flashing area', `${num(Math.max(r.general.maxAreaPx, r.red.maxAreaPx))} px² (limit ${num(AREA_LIMIT_PX)} px² at 1024-wide reference)`],
    ['Assumed display', `${num(d.displayWidth)}×${num(d.displayHeight)} CSS px on a ${num(d.viewportWidth)} px-wide screen`],
    ...(media?.crop ? [['Region checked', `${media.crop.w}×${media.crop.h} px at (${media.crop.x}, ${media.crop.y})`]] : []),
  ];
  const dl = $('stats');
  dl.replaceChildren();
  for (const [k, v] of rows) { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); }
}

$('export').addEventListener('click', () => {
  if (!lastReport) return;
  const out = { tool: 'Strobeproof Lab', file: file?.name, media, report: lastReport, generated: new Date().toISOString() };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  a.download = (file?.name || 'report') + '.strobeproof.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
