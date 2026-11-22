// The ONLY home of thresholds (plan §4.1). Nothing else may hard-code these values.
//
// Source for the flash definitions:
//   W3C, Understanding SC 2.3.1 Three Flashes or Below Threshold
//   https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
//   WCAG 2.2 glossary "general flash and red flash thresholds":
//   https://www.w3.org/TR/WCAG22/#dfn-general-flash-and-red-flash-thresholds
// Source for the 341×256 px 10° field at 1024×768:
//   https://digitalaccessibility.nyu.edu/testing/sc231.html

/** Opposing change in relative luminance must be ≥ this to be a transition (WCAG: "10% or more"). */
export const LUM_DELTA = 0.10;
/** The darker state of the pair must be below this (WCAG: "below 0.80"). */
export const DARKER_MAX = 0.80;
/** Saturated red: R/(R+G+B) ≥ this (WCAG red-flash definition). */
export const RED_RATIO = 0.80;
/** Red transition: change in max(0, R−G−B)×320 must be > this (WCAG red-flash definition). */
export const RED_DELTA = 20;
/** Multiplier in the red metric (R−G−B)×320. */
export const RED_SCALE = 320;
/** ≥ 7 transitions in a half-open (t−1 s, t] window means more than 3 flashes (plan A9). */
export const FAIL_TRANSITIONS = 7;
/**
 * Extension only: switch to Calm Mode at this many transitions in (t−1 s, t] (plan A17).
 * Was 4 (3 transitions of slack below FAIL_TRANSITIONS). Raised to 5 (human decision, 2026-11-22) so a
 * compliant 2 Hz flash (4 transitions/s) plays at normal brightness. 2 transitions of slack were judged enough:
 * measured in E2E: on an idle machine Calm is set within ~11 ms before to ~7 ms after the triggering
 * frame (about one display frame → at most 2.5 flashes). Under heavy load the worst seen was 155 ms late
 * (e2e/latency.json), letting the 6th transition through: 3 flashes, at the limit but not over it.
 */
export const PRETRIP_TRANS = 5;
/** Comfort mode (extension only, NOT a medical standard). */
export const COMFORT_PRETRIP_TRANS = 2;
export const COMFORT_FAIL_TRANSITIONS = 5;
/** Sliding window length in seconds. */
export const WINDOW_S = 1.0;

/** Reference display width in CSS px (WCAG assumes 1024×768 at typical viewing distance). */
export const REFERENCE_WIDTH_PX = 1024;
/** The 10° visual field at the 1024×768 reference: 341×256 px. */
export const FIELD_10DEG_W_PX = 341;
export const FIELD_10DEG_H_PX = 256;
export const FIELD_10DEG_PX = FIELD_10DEG_W_PX * FIELD_10DEG_H_PX; // 87,296 px²
/** Flashing is allowed only if it covers ≤ 25% of any 10° field ≈ 21,824 px² (scale by (innerWidth/1024)²). */
export const AREA_LIMIT_PX = 0.25 * FIELD_10DEG_PX;

/**
 * Calm Mode: `filter: grayscale(1) brightness(CALM_BRIGHTNESS)`.
 * White → sRGB 0.32 → relative luminance ≈ 0.084 < LUM_DELTA, so no transition is possible (plan §3.1).
 * ⚠ Valid only if Chrome applies CSS filter functions to sRGB-encoded values. Confirmed by M0 spike ④ (see SPIKE.md).
 */
export const CALM_BRIGHTNESS = 0.32;
export const CALM_FILTER = `grayscale(1) brightness(${CALM_BRIGHTNESS})`;

/** Analysis sampling: draw media at 128×72, convert each pixel to linear luminance, average into 32×18 tiles. */
export const SAMPLE_W = 128;
export const SAMPLE_H = 72;
export const TILES_X = 32;
export const TILES_Y = 18;

/**
 * Feature flag: pre-scan short muted looping/autoplay <video> ("GIF-videos") before release (plan A5).
 * ON by default; flip to false if the M0 spike ② shows X/Reddit CDNs aren't fetchable (Decision 2026-11-22).
 */
export const GIF_VIDEO_PRESCAN = true;
/** Pre-scan limits for GIF-style videos (plan §3.2). */
export const PRESCAN_MAX_DURATION_S = 30;
export const PRESCAN_MAX_BYTES = 15 * 1024 * 1024;
/** Max concurrent pre-scan decodes (plan M5). */
export const PRESCAN_CONCURRENCY = 3;
/** Start pre-scanning this far before an image scrolls into view (plan §3.5). */
export const PRESCAN_ROOT_MARGIN_PX = 800;
/** Playing video stays in Calm for the first N seconds of scanned playback (plan §3.2). */
export const LIVE_WARMUP_S = 2;
/** A pre-trip without confirmation returns to normal after this many seconds without transitions (plan §3.3). */
export const PRETRIP_RELEASE_S = 3;
