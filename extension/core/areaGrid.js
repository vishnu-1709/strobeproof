// ★ HUMAN-OWNED FILE (plan §4.4, CLAUDE.md). Written by hand by the human (EvoHacks AI rule).
// Claude Code must not edit this file.
//
// Interface:
//   areaVerdict(mask, tilesX, tilesY, rect, viewportWidth) → { maxAreaPx, fail }
//     mask           Uint8Array(tilesX*tilesY), 1 = tile is flashing (count ≥ threshold) at this instant
//     rect           { width, height } of the media as displayed, in CSS px
//     viewportWidth  current window.innerWidth (CSS px); areas are scaled to the 1024-wide reference
//     maxAreaPx      largest flashing area (reference px²) inside any FIELD_10DEG_W_PX × FIELD_10DEG_H_PX window
//     fail           maxAreaPx > AREA_LIMIT_PX
//
// Required behaviour (plan §4.4, tests in __tests__/flashCounter.test.js › areaGrid):
//   • tile area = (rect.width/tilesX) × (rect.height/tilesY), scaled by (REFERENCE_WIDTH_PX / viewportWidth)²
//   • slide a 341×256 (reference px) window over the mask using a summed-area table
//   • if the media is smaller than the window, the whole media fits in one window
//   • an empty mask returns { maxAreaPx: 0, fail: false }
//   • all constants come from constants.js

import { NotImplemented } from './flashCounter.js';

export function areaVerdict(_mask, _tilesX, _tilesY, _rect, _viewportWidth) {
  throw new NotImplemented('areaGrid.areaVerdict');
}
