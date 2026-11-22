# Strobeproof: Devpost draft

> ⚠ = must be sourced from a primary source (or removed) before submitting. Plan §1.3, §11.

## 1. What it does
Every flash blocker says it follows WCAG. Strobeproof is the one that proves it: an open known-answer test suite, a benchmark of existing tools, and a browser shield whose Calm Mode stays below the WCAG flash threshold by construction, even on video it can't read.

**Try it:** Lab (no install): https://vishnu-1709.github.io/strobeproof/lab/ · Demo feed: https://vishnu-1709.github.io/strobeproof/demo/ · Extension ZIP: see README.

## 2. The problem
- People with photosensitive epilepsy have been deliberately attacked with strobing GIFs. In 2016 a strobing GIF sent to journalist Kurt Eichenwald caused a seizure and the sender was criminally charged. ⚠ (seizure details)
- In Nov 2019 and May 2020, followers of the Epilepsy Foundation and the Epilepsy Society were sent strobing GIFs. ⚠ (dates and outcomes from primary sources: TIME, Epilepsy Society)
- Photosensitive epilepsy affects about 1 in 4,000 people, 3–5% of people with epilepsy (Epilepsy Society, https://www.epilepsy.org.uk/?p=1833).

## 3. Prior art (honestly)
| Tool | What it does | Gap |
|---|---|---|
| NeuroShield (Chrome) | WCAG-threshold detection on all sites, 4×4 region grid, red flash, presets, dim/pause overlay | Closest rival with decent UX. It dims after detection, not by default, and publishes no evidence on the hard cases |
| CalmWeb (Firefox) | Motion reduction, GIF freezing, dimming on rapid brightness changes | Firefox only; flash dimming described as best-effort |
| CogniShield (Chrome) | Flash/flicker guard, YouTube only | No published thresholds or tests |
| Epilepsy Blocker (Firefox) | Blocks risky GIFs | GIFs only ⚠ (last-update date) |
| PhotosensitivityPal (Chrome) | Detects and blocks risky GIFs | GIFs only, block-only |
| Photosensitivity Video Blocker (Chrome) | Pauses animated images, blocks video until clicked | No analysis |
| Seizafe (Chrome) | Warns before flashing scenes on YouTube | YouTube only |
| Flikcer (2021) | Real-time luminance-frequency analysis | Research prototype |
| EPI-LENS | Open-source video metrics | Analysis tool, no known-answer suite |
| PEAT (Trace Center) | Desktop analyser for developers | Not for day-to-day screening by people with PSE |

## 4. What's new
1. **Verified**: 20 locked known-answer cases (ramps from rest, falling ramps above 0.80, exact 3 Hz vs 3.5 Hz boundaries, small vs large area, red-only flashes, dropped frames), run live in the browser, plus a published benchmark method.
2. **Calm Mode by default**: anything unchecked starts below the threshold by construction (white → 0.084 relative luminance), on any video, including DRM and cross-origin. Test #15 proves it.
3. **Zero exposure at normal brightness for GIFs and GIF-style videos**: decoded frame by frame before release. Static WebPs are released from a 32-byte header read.

## 5. How it works
One engine (`core/`), three consumers: Vitest, the Lab, and the extension (content script and offscreen document). See the protection-paths table in the README.

## 6. The math
Constants with the W3C link; the transition rule (≥ 0.10 change, darker side < 0.80, ≥ 7 transitions in any (t−1, t] window, > 25% of a 10° field); the Calm Mode proof (0.32 × white in sRGB = 82/255, relative luminance 0.084 < 0.10, measured in the browser, also in fullscreen).

## 7. Proof
- Suite: 20/20 cases match. Mutation-checked: the A8 bug breaks only #11, and the A9 bug breaks only the 3 Hz boundaries.
- Every case encoded with ffmpeg → MP4 → WebCodecs gives the same answer.
- Pre-trip latency: Calm Mode set 9–14 ms *before* the 4th transition's frame was due on screen (10 runs). At most about one display frame of it shows: 2 flashes, under the limit.
- Benchmark: Strobeproof blocked all 9 failing cases, with 0 frames at normal brightness. Competitor rows: (fill in after recording, with versions and date).

## 8. Accessibility of the tool itself
No animation anywhere; 44 px targets; Tab/Enter/Esc; labels next to their media in Tab order; polite announcements only for events you must act on; forced colours; caregiver lock; plain language (grade-6 style) in the extension. axe-core: 0 violations on every surface. Hallway test: (one sentence after running it, plan §3.5).

## 9. Why no AI
WCAG 2.3.1 is a published numeric safety spec. A pass/fail safety check should be deterministic and testable, so it's arithmetic with known answers, not a model.

## 10. Limitations
See the README Limitations section (canvas, CSS animation, CSS backgrounds, stripes; live latency; exact-3 Hz live over-caution; DRM/cross-origin can't be read; HDR; reference viewing conditions; never tested with people who have epilepsy).

## 11. What I wrote vs what Claude Code wrote
From AI_LOG.md. Mine: the spec interpretation (constants, transition definition, pre-trip design, Calm Mode math), the review of the expected answers (including case 9b), the red-rule decision, the spike plan and findings, the benchmark method. Written by Claude Code on my explicit delegation and annotated by me line by line: `flashCounter.js`, `areaGrid.js`. Claude Code wrote the rest of the code and tests.
