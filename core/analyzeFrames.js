// The engine: tiles → per-tile transition counters → area check → verdict.
// One engine, three consumers (Vitest, Lab, extension worker/offscreen). Plan §2, §4.
import {
  LUM_DELTA, DARKER_MAX, RED_DELTA, WINDOW_S, FAIL_TRANSITIONS, PRETRIP_TRANS, TILES_X, TILES_Y,
} from './constants.js';
import { tilesFromRGBA } from './luminance.js';
import { createFlashCounter } from './flashCounter.js';
import { areaVerdict } from './areaGrid.js';

/**
 * Streaming analyzer for one media element.
 * opts: { rect:{width,height}, viewportWidth, failAt, pretripAt, tilesX, tilesY }
 * push(tiles, t) → { t, generalMax, redMax, generalAreaPx, redAreaPx, pretrip, fail, failKind }
 */
export function createAnalyzer(opts = {}) {
  const tilesX = opts.tilesX ?? TILES_X, tilesY = opts.tilesY ?? TILES_Y, n = tilesX * tilesY;
  const failAt = opts.failAt ?? FAIL_TRANSITIONS, pretripAt = opts.pretripAt ?? PRETRIP_TRANS;
  let rect = opts.rect ?? { width: 1024, height: 576 };
  let viewportWidth = opts.viewportWidth ?? 1024;
  const gen = [], red = [];
  for (let i = 0; i < n; i++) {
    gen.push(createFlashCounter({ delta: LUM_DELTA, darkerMax: DARKER_MAX, windowS: WINDOW_S, strict: false }));
    red.push(createFlashCounter({ delta: RED_DELTA, darkerMax: Infinity, windowS: WINDOW_S, strict: true }));
  }
  const gFail = new Uint8Array(n), gPre = new Uint8Array(n), rFail = new Uint8Array(n), rPre = new Uint8Array(n);

  const area = (mask, any) => (any ? areaVerdict(mask, tilesX, tilesY, rect, viewportWidth) : { maxAreaPx: 0, fail: false });

  return {
    setRect(r, vw) { rect = r; if (vw) viewportWidth = vw; },
    push(tiles, t) {
      let gMax = 0, rMax = 0, anyGF = false, anyGP = false, anyRF = false, anyRP = false;
      for (let i = 0; i < n; i++) {
        const g = gen[i].push(tiles.L[i], t);
        const r = red[i].push(tiles.satRed[i] ? tiles.red[i] : 0, t);
        if (g > gMax) gMax = g;
        if (r > rMax) rMax = r;
        anyGF = (gFail[i] = g >= failAt ? 1 : 0) || anyGF;
        anyGP = (gPre[i] = g >= pretripAt ? 1 : 0) || anyGP;
        anyRF = (rFail[i] = r >= failAt ? 1 : 0) || anyRF;
        anyRP = (rPre[i] = r >= pretripAt ? 1 : 0) || anyRP;
      }
      const gf = area(gFail, anyGF), rf = area(rFail, anyRF);
      const gp = anyGP ? area(gPre, true) : gf, rp = anyRP ? area(rPre, true) : rf;
      const failKind = gf.fail && rf.fail ? 'general+red' : gf.fail ? 'general' : rf.fail ? 'red' : null;
      return {
        t, generalMax: gMax, redMax: rMax,
        generalAreaPx: gf.maxAreaPx, redAreaPx: rf.maxAreaPx,
        pretrip: gp.fail || rp.fail, fail: !!failKind, failKind,
      };
    },
  };
}

/** Frame → tiles (frames may already carry .tiles, e.g. from the extension worker). */
export function frameTiles(f) {
  return f.tiles ?? tilesFromRGBA(f.data, f.width, f.height);
}

/**
 * Batch analysis.
 * frames: [{ t, width, height, data } | { t, tiles }], in presentation order, every frame (never sampled).
 * opts: { displayWidth, displayHeight, viewportWidth, incomplete }
 * Returns a report; verdict is 'FAIL' | 'PASS' | 'INCOMPLETE' (never PASS when frames were missed).
 */
export function analyzeFrames(frames, opts = {}) {
  const a = createAnalyzer({
    rect: { width: opts.displayWidth ?? 1024, height: opts.displayHeight ?? 576 },
    viewportWidth: opts.viewportWidth ?? 1024,
  });
  const timeline = { t: [], general: [], red: [], areaPx: [] };
  let generalFail = false, redFail = false, maxG = 0, maxR = 0, maxGA = 0, maxRA = 0;
  let worst = { t: 0, transitions: 0 };
  const failRanges = [];
  for (const f of frames) {
    const s = a.push(frameTiles(f), f.t);
    timeline.t.push(f.t); timeline.general.push(s.generalMax); timeline.red.push(s.redMax);
    timeline.areaPx.push(Math.max(s.generalAreaPx, s.redAreaPx));
    maxG = Math.max(maxG, s.generalMax); maxR = Math.max(maxR, s.redMax);
    maxGA = Math.max(maxGA, s.generalAreaPx); maxRA = Math.max(maxRA, s.redAreaPx);
    const tr = Math.max(s.generalMax, s.redMax);
    if (tr > worst.transitions) worst = { t: f.t, transitions: tr };
    if (s.fail) {
      if (s.failKind.includes('general')) generalFail = true;
      if (s.failKind.includes('red')) redFail = true;
      const start = Math.max(0, f.t - WINDOW_S), last = failRanges[failRanges.length - 1];
      if (last && start <= last.end) last.end = f.t; else failRanges.push({ start, end: f.t });
    }
  }
  const fail = generalFail || redFail;
  const duration = frames.length ? frames[frames.length - 1].t - frames[0].t : 0;
  return {
    verdict: fail ? 'FAIL' : opts.incomplete ? 'INCOMPLETE' : 'PASS',
    general: { fail: generalFail, maxTransitions: maxG, maxAreaPx: maxGA },
    red: { fail: redFail, maxTransitions: maxR, maxAreaPx: maxRA },
    worst: { ...worst, flashesPerSecond: worst.transitions / 2 },
    failRanges,
    frameCount: frames.length,
    duration,
    incomplete: !!opts.incomplete,
    timeline,
  };
}
