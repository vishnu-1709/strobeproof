// ★ HUMAN-OWNED FILE (plan §4.3, CLAUDE.md).
// Written pair-style by Claude Code on the human's explicit delegation (2026-11-22, PROGRESS.md › Decisions).
// The human reads and annotates every line; see AI_LOG.md.
//
// Interface:
//   createFlashCounter({ delta, darkerMax, windowS, strict })
//     delta      minimum opposing change to count as a transition (LUM_DELTA, or RED_DELTA for red)
//     darkerMax  the darker side of a transition must be < this (DARKER_MAX; Infinity for red)
//     windowS    window length in seconds (WINDOW_S); the window is half-open (t − windowS, t]
//     strict     if true the change must be > delta (red rule "> 20"); if false ≥ delta (luminance rule)
//   returns { push(value, t) → number, reset() }
//     push: feed one sample (tile value at timestamp t in seconds, non-decreasing).
//           Returns how many qualifying transitions lie in (t − windowS, t].

export class NotImplemented extends Error {
  constructor(what) { super(`${what} is not implemented yet (human-owned file)`); this.name = 'NotImplemented'; }
}

/** Float slack for the window edge: frame timestamps like 10/60 don't subtract exactly. */
const EDGE_EPS = 1e-9;

export function createFlashCounter({ delta, darkerMax, windowS, strict = false }) {
  const crosses = strict ? (d) => d > delta : (d) => d >= delta;

  let state;        // 'rest' | 'up' | 'down'
  let lo, hi;       // running min / max while at rest
  let extreme;      // running extreme of the current move
  let open;         // the newest transition { t, darker }
  let queue;        // transitions still inside the window, oldest first

  function reset() {
    state = 'rest'; lo = Infinity; hi = -Infinity; extreme = 0; open = null; queue = [];
  }
  reset();

  function begin(dir, t, darker, ext) {
    state = dir;
    extreme = ext;
    open = { t, darker };
    queue.push(open);
  }

  function push(v, t) {
    if (state === 'rest') {
      // ★ Rest tracks min AND max, so a slow ramp from rest still builds a transition (A7).
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      if (crosses(v - lo)) begin('up', t, lo, v);
      else if (crosses(hi - v)) begin('down', t, v, v);
    } else if (state === 'up') {
      // ★ A move that keeps going extends its extreme instead of re-triggering.
      if (v > extreme) extreme = v;
      else if (crosses(extreme - v)) begin('down', t, v, v);
    } else {
      if (v < extreme) {
        // ★ A fall that keeps falling keeps updating its darker side, so a fall detected
        //   above 0.80 still qualifies once it drops below (A8).
        extreme = v;
        open.darker = v;
      } else if (crosses(v - extreme)) begin('up', t, extreme, v);
    }

    // Half-open window (t − windowS, t]: drop transitions with t_i ≤ t − windowS (A9).
    const edge = t - windowS + EDGE_EPS;
    while (queue.length && queue[0].t <= edge) queue.shift();

    let n = 0;
    for (const tr of queue) if (tr.darker < darkerMax) n++;
    return n;
  }

  return { push, reset };
}
