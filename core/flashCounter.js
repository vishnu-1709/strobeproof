// ★ HUMAN-OWNED FILE (plan §4.3, CLAUDE.md). Claude Code writes only this interface and stub.
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
//
// Required behaviour (plan §4.3 ★ lines, tests in __tests__/flashCounter.test.js):
//   • at rest, track running min AND max, so a slow ramp from rest still builds a transition (A7)
//   • while a move continues in the same direction, extend its extreme; don't re-trigger
//   • while a falling move keeps falling, keep updating that open transition's darker value (A8)
//   • drop transitions with t_i ≤ t − windowS (half-open window, A9)

export class NotImplemented extends Error {
  constructor(what) { super(`${what} is not implemented yet (human-owned file)`); this.name = 'NotImplemented'; }
}

export function createFlashCounter(_opts) {
  throw new NotImplemented('flashCounter.createFlashCounter');
}
