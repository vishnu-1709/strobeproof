// ★ HUMAN-OWNED FILE (plan §4.4, CLAUDE.md).
// Written pair-style by Claude Code on the human's explicit delegation (2026-11-22, PROGRESS.md › Decisions).
//
// Interface:
//   areaVerdict(mask, tilesX, tilesY, rect, viewportWidth) → { maxAreaPx, fail }
//     mask           Uint8Array(tilesX*tilesY), 1 = tile is flashing (count ≥ threshold) at this instant
//     rect           { width, height } of the media as displayed, in CSS px
//     viewportWidth  current window.innerWidth (CSS px); areas are scaled to the 1024-wide reference
//     maxAreaPx      largest flashing area (reference px²) inside any 341×256 reference-px window
//     fail           maxAreaPx > AREA_LIMIT_PX

import { AREA_LIMIT_PX, FIELD_10DEG_W_PX, FIELD_10DEG_H_PX, REFERENCE_WIDTH_PX } from './constants.js';

export function areaVerdict(mask, tilesX, tilesY, rect, viewportWidth) {
  // Tile size in reference px: what the tile would measure on a 1024-wide screen.
  const scale = REFERENCE_WIDTH_PX / viewportWidth;
  const tileW = (rect.width / tilesX) * scale;
  const tileH = (rect.height / tilesY) * scale;
  const tileArea = tileW * tileH;

  // The 10° window in tiles. Rounded UP, so the window is never smaller than the real field
  // (conservative: may count slightly more area, never less). Media smaller than the window
  // fits in one window.
  const wx = Math.min(tilesX, Math.max(1, Math.ceil(FIELD_10DEG_W_PX / tileW)));
  const wy = Math.min(tilesY, Math.max(1, Math.ceil(FIELD_10DEG_H_PX / tileH)));

  // Summed-area table: S[y][x] = flashing tiles in the rectangle [0,x) × [0,y).
  const W = tilesX + 1;
  const S = new Uint32Array(W * (tilesY + 1));
  let any = false;
  for (let y = 0; y < tilesY; y++) {
    let row = 0;
    for (let x = 0; x < tilesX; x++) {
      const m = mask[y * tilesX + x] ? 1 : 0;
      any ||= m === 1;
      row += m;
      S[(y + 1) * W + x + 1] = S[y * W + x + 1] + row;
    }
  }
  if (!any) return { maxAreaPx: 0, fail: false };

  // Slide the window over every tile position; keep the most flashing tiles in any one window.
  let best = 0;
  for (let y = 0; y + wy <= tilesY; y++) {
    for (let x = 0; x + wx <= tilesX; x++) {
      const n = S[(y + wy) * W + x + wx] - S[y * W + x + wx] - S[(y + wy) * W + x] + S[y * W + x];
      if (n > best) best = n;
    }
  }
  const maxAreaPx = best * tileArea;
  return { maxAreaPx, fail: maxAreaPx > AREA_LIMIT_PX };
}
