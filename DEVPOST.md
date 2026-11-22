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
- Pre-trip latency: pre-trip at the 5th transition. Idle machine: Calm Mode set within about one display frame (−11 to +7 ms around that frame). Under heavy load, the worst of 12 runs was 155 ms late: the 6th transition showed, which is 3 flashes, at the limit but not over it.
- Benchmark: Strobeproof blocked all 7 failing benchmark cases, with 0 frames at normal brightness (case 14 can't be a constant-rate file, so it's suite-only). Competitor rows: (fill in after recording, with versions and date).

## 8. Accessibility of the tool itself
No animation anywhere; 44 px targets; Tab/Enter/Esc; labels next to their media in Tab order; polite announcements only for events you must act on; forced colours; caregiver lock; plain language (grade-6 style) in the extension. axe-core: 0 violations on every surface. Hallway test: (one sentence after running it, plan §3.5).

## 9. Why no AI
WCAG 2.3.1 is a published numeric safety spec. A pass/fail safety check should be deterministic and testable, so it's arithmetic with known answers, not a model.

## 10. Limitations
See the README Limitations section (canvas, CSS animation, CSS backgrounds, stripes; live latency; exact-3 Hz live over-caution; DRM/cross-origin can't be read; HDR; reference viewing conditions; never tested with people who have epilepsy).

## 11. Built with AI assistance

Strobeproof was built with the help of **Claude Code** (Anthropic's AI coding assistant). In line with the EvoHacks 2.0 rule ("AI is accepted but you should not use it to create the whole project"), here is the split. The full per-commit record is in [AI_LOG.md](AI_LOG.md), which matches this section.

**What I did**
- **Chose the idea and the approach.** A flash detector you can verify: a known-answer suite, a benchmark of existing tools, and Calm Mode by default. I wrote the build plan.
- **Made every spec and design decision** (PROGRESS.md › Decisions). Where Claude Code proposed options, I chose or approved them. That covers the WCAG 2.3.1 reading behind the constants, the transition rule, the pre-trip design (including moving it from 4 to 5 transitions), Calm Mode and its 0.32 → 0.084 maths, the red rule using linear RGB, and the UX rules.
- **Wrote and approved the test answers** (`expected.json`), including the case 9/9b fix: case 9 also asserts a general flash, and 9b isolates the red-only rule.
- **Ran the real-browser checks, the spike and the benchmark**: the spike on Reddit/X in real Chrome, the release check in Chrome, and the competitor recordings. ⚠ confirm each is done before submitting.
- **Made the video.** ⚠

**What Claude Code did: the implementation**
- The detection engine, including `core/flashCounter.js` and `core/areaGrid.js`. These two were AI-drafted by Claude Code from my pseudocode, then reviewed and approved by me.
- Luminance tiles, the analyser, and the every-frame GIF/WebP/MP4 decoders.
- The Lab UI.
- The browser extension: service worker, content script, offscreen pre-scan, chips, popup, welcome tab.
- The test harness from my cases and answers: Vitest, synthetic frame generators, Playwright E2E, axe, latency and benchmark automation.
- The spike kit and its automated probes.
- The build and clip scripts, and scaffolding.
- Drafts of the README and this page.

Commits don't carry AI co-author trailers; AI use is disclosed here and in AI_LOG.md instead.
