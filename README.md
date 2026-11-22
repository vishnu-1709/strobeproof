# Strobeproof

**A flash detector you can verify.** An open WCAG 2.3.1 known-answer test suite, a benchmark of the tools that already exist, and a browser shield built on the same engine that says plainly what it can't check.

> Strobeproof **reduces exposure** to flashing content. It is not a medical device and can't catch everything.

| | |
|---|---|
| **Lab** (no install): check a GIF or video | https://vishnu-1709.github.io/strobeproof/lab/ |
| **Test suite**, run live in your browser | https://vishnu-1709.github.io/strobeproof/lab/suite.html |
| **Benchmark** | https://vishnu-1709.github.io/strobeproof/lab/benchmark.html |
| **Demo feed** (open after installing) | https://vishnu-1709.github.io/strobeproof/demo/ |

## Install (Chrome, Edge, Brave)

1. Download [`strobeproof-extension-v1.0.0.zip`](https://github.com/vishnu-1709/strobeproof/releases/latest/download/strobeproof-extension-v1.0.0.zip) from the [latest release](https://github.com/vishnu-1709/strobeproof/releases/latest), then right-click it and choose **Extract All…**.
2. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder. A one-screen welcome tab opens.

![Load unpacked in three steps](docs/install.gif) <!-- placeholder: record before submission -->

Then open the [demo feed](https://vishnu-1709.github.io/strobeproof/demo/) to see every state. It's safe without the extension too: the page keeps its flashing items dim by itself.

Chromium only. Firefox isn't supported.

## What it does

- **Unchecked = Calm.** Every GIF, animated WebP and playing video starts in **Calm Mode** (`grayscale(1) brightness(0.32)`) until it's checked. Calm Mode can't flash, even on video Strobeproof can't read (DRM, cross-origin).
- **Checked before you see it.** GIFs, animated WebPs and short muted looping "GIF-style" videos are decoded frame by frame in the background and released only if they pass. Static WebPs are released from their first 32 bytes.
- **Watched while it plays.** Normal videos are calm for their first 2 seconds, then released and watched frame by frame. From 2.5 flashes in a second (5 changes) they drop back to Calm. At 3.5+ flashes per second they stay calm, with a label and three choices.
- **Quiet when things are fine.** Paused videos are never darkened. Safe items get no label at all. One shortcut, <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>, calms the whole page.

| State | What you see | Screen reader (polite) |
|---|---|---|
| Checking | Calm; small static "Checking…" label (only if a check takes > 0.8 s) | silent |
| Safe | Normal; no label | silent |
| Calmed (pre-trip) | Calm; "Calmed" | silent |
| Flashing found | Calm; Keep Calm · Show original · Always allow this site | "Flashing detected. About 5 flashes per second. Calm Mode is on." |
| Can't check | Calm; Play normally | "Couldn't check this video. Showing it in Calm Mode." |
| Shown by you | Normal; Undo (Esc) | "Showing original. Press Escape to return to Calm Mode." |
| Hide mode | Blacked out and paused | "Flashing content hidden." |

No animations anywhere, 44 px targets, visible focus, Tab/Enter/Esc everywhere, forced-colours support. Labels sit right after their media in Tab order. `@axe-core/playwright` reports **0 violations** on the chips (every state), popup (including the caregiver-lock dialog), welcome tab, demo feed and every Lab page.

## How it works

One engine, three consumers: `core/` is pure JS used by Vitest, the Lab, and the extension's content script and offscreen document.

| Media | Path | Shown at normal brightness before the verdict? |
|---|---|---|
| `<img>` GIF / animated WebP / APNG-by-URL | Offscreen fetch → `ImageDecoder`, every frame + its duration → analyse | **No** (pre-scanned) |
| Static WebP | 32-byte `Range` read of the VP8X header | **No** (released in ≈0 ms; prefetch starts 800 px early) |
| Short muted looping/autoplay `<video>`, progressive MP4 | Offscreen fetch → mp4box.js → WebCodecs `VideoDecoder`, every frame | **No** |
| Other readable `<video>` (incl. YouTube MSE) | Calm for 2 s of playback → release → live `requestVideoFrameCallback` detection with pre-trip at 5 transitions | 2 transitions of slack (see latency) |
| Unreadable (cross-origin, DRM) | Stays in Calm; "Play normally" | No, unless you choose to |
| CSS backgrounds, canvas, CSS/JS animation | Not covered | See Limitations |

Analysis samples media at 128×72, converts **each pixel** to linear relative luminance, averages into 32×18 tiles, runs a transition counter per tile, then checks the flashing area against the 10° field with a summed-area table.

## The math

All thresholds live in [`core/constants.js`](core/constants.js), sourced from [W3C Understanding SC 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html).

- **Transition**: an opposing change in relative luminance of ≥ 0.10 where the darker side is < 0.80. Red: R/(R+G+B) ≥ 0.8 and a change in max(0, R−G−B)×320 of more than 20 (linear R, G, B).
- **Fail**: ≥ 7 transitions (more than 3 flashes) in any half-open window (t − 1 s, t], over more than 25% of a 10° field: 21,824 px² at the 1024×768 reference, scaled by (1024 / screen width)².
- **The counter** ([`core/flashCounter.js`](core/flashCounter.js)) tracks the running min and max at rest, so slow ramps still count. Continuing moves extend instead of re-triggering. A falling move keeps updating its darker side, so a fall that is first detected above 0.80 still counts once it drops below.
- **Calm Mode proof**: white × 0.32 in sRGB = 82/255, which is relative luminance **0.084 < 0.10**. No transition is possible, at any frequency or size. Grayscale removes saturated red. Measured in the browser: white under the filter paints as exactly 82/255, also in fullscreen ([SPIKE.md](SPIKE.md)). Test #15 runs the 5 Hz case through Calm Mode and gets PASS.

## Proof

**Known-answer suite**: 20 cases, locked in [`core/__tests__/expected.json`](core/__tests__/expected.json) (human-approved). 45 unit tests in total.

| # | Case | Expected |
|---|---|---|
| 1 | Full-frame black↔white 2 Hz | PASS |
| 2 | Full-frame black↔white 5 Hz | FAIL |
| 3a–d | Exactly 3 Hz, four phase offsets | PASS |
| 4 | 3.5 Hz | FAIL |
| 5 | 5 Hz, ΔL 0.06 | PASS |
| 6 | 5 Hz between L 0.85 and 1.0 | PASS |
| 7 / 8 | 5 Hz box, 16,384 px² / 36,864 px² | PASS / FAIL |
| 9 / 9b | Red↔black / dark red (ΔL < 0.10) ↔ black | FAIL (general + red) / FAIL (red only) |
| 10 | 60 fps ramp strobe from rest, every step < 0.10 | FAIL |
| 11 | Falling ramp that crosses ΔL above 0.80 | FAIL |
| 12a / 12b | Single hard cut / 2 s fade | PASS |
| 13 | Fine checkerboard inversion 10 Hz | PASS |
| 14 | Case 2 with dropped frames and jittered timestamps | FAIL |
| 15 | Case 2 in Calm Mode | PASS |

Mutation-checked: re-introducing the "darker side frozen" bug fails only #11; closing the window edge fails only the 3 Hz boundary cases. Every case was also encoded to MP4 with ffmpeg and gives the same answer through WebCodecs in the Lab.

**Pre-trip latency** (live video, [`e2e/latency.json`](e2e/latency.json)): pre-trip fires at the 5th transition in a second. On an idle machine (12-run sets), Strobeproof set Calm Mode within about 11 ms before to 7 ms after the frame carrying that 5th transition was due on screen, so at most about one display frame of it shows (2.5 flashes). **Under heavy load** (the published run in [`e2e/latency.json`](e2e/latency.json), taken during the full E2E suite) 2 of 12 runs were late, by 51 ms and **155 ms**. In the 155 ms run the 6th transition also reached the screen: 6 transitions = 3 flashes, at the limit but not over it. Two other runs were already calm about 1 s early, after frame-skip pre-trips. Not zero, and not claimed as zero.

**Benchmark** ([page](https://vishnu-1709.github.io/strobeproof/lab/benchmark.html), [method](lab/benchmark.html)): Strobeproof's own row is automated and frame-exact. **All 7 failing cases were blocked with 0 frames at normal brightness.** The 11 passing clips are only 3 s long: in the published run all of them were held calm, because headless Edge dropped 2+ frames in a row during warm-up, which (by design) restarts the 3 s quiet period. In an earlier run 6 of the 11 were released. Longer clips are released (E2E: 2 Hz and calm 6 s videos play at normal brightness). The exact-3 Hz cases err on the safe side in the live path.

## How it compares

<!-- comparison:start -->
Other tools: only what each tool's public store listing states, checked 2026-11-22. "?" means the listing doesn't say. Strobeproof: this repo. Other tools weren't run through the benchmark.

| Feature | **Strobeproof** | **NeuroShield** | **CogniShield** | **Seizafe** | **Epilepsy Blocker** |
|---|---|---|---|---|---|
| Browser | Chrome, Edge, Brave | Chrome | Chrome | Chrome | Firefox |
| Works on | All sites (except ones you allow) | All websites | YouTube only | YouTube only | ? |
| Media covered | GIF, animated WebP, video | Video (GIFs: ?) | YouTube video | YouTube video | Animated GIFs |
| How flashing is detected | WCAG 2.3.1: ΔL ≥ 0.10, darker < 0.80, ≥ 7 transitions in any 1 s, per-pixel linear luminance in 32×18 tiles | WCAG 2.3.1: ΔL > 0.1, darker < 0.80, 1 s window; frames sampled at 15 fps, 32×32 | Rapid brightness changes in video frames; says it follows WCAG 2.3.1 (no numbers given) | ? ("an algorithm") | ? ("specialized algorithm" based on photosensitivity research) |
| Red-flash rule | Yes (WCAG red rule) | Yes (WCAG 2.3.2) | ? | ? | ? |
| Screen-area / region check | Yes: 25% of a 10° field, scaled to screen width | Yes: 4×4 grid of zones | ? | ? | ? |
| Checked or calmed before it's shown | Yes: unchecked media starts in Calm Mode; GIFs and GIF-style videos are decoded before release | ? (runs at document_start; overlay appears when flashing is detected) | ? (dims when flashing is detected) | Says it warns before flashing scenes (how: ?) | ? |
| What happens to flashing content | Calm Mode (grey, dimmed below the threshold) or hide; Keep Calm / Show original / Allow site | Overlay with Dim (30%) / Pause / Continue | Dims the video | Warning | Blocks the GIF |
| Cross-origin / DRM video | Shown in Calm Mode (can't flash) with "Play normally" | Cross-origin: opt-in CSS filter. DRM: ? | ? | ? | ? |
| Sensitivity settings | Standard / Extra careful | 4 levels (1+, 2+, 3+, 5+ flashes/s) | Auto-detect and sliders (flash-guard sensitivity: ?) | Sensitivity control | ? |
| Keyboard / screen reader | Yes: Tab/Enter/Esc, polite announcements, axe-core 0 violations | Yes: ARIA roles, keyboard (Esc), screen reader | ? | ? | ? |
| Published evidence | Public 20-case known-answer suite, latency and benchmark results | Claims 84 unit tests; published results: ? | ? | ? | ? |
| Strobeproof benchmark: failing cases blocked | 7/7 blocked, 0 frames at normal brightness | not tested | not tested | not tested | not tested |
| Listing: version · updated · users | 1.0.0 · 2026-11-22 · – | 1.0.0 · 2026-04-13 · 40 | 1.0.0 · 2026-04-19 · 25 | 0.0.0.5 · 2025-01-31 · 244 | 1.0.41 · 2019-08-22 · 70 |

Sources: [Strobeproof](https://github.com/vishnu-1709/strobeproof) · [NeuroShield](https://chromewebstore.google.com/detail/neuroshield/dbmdhjhmfmdnohcphcmdlfaiipdoldfk) · [CogniShield](https://chromewebstore.google.com/detail/kmengpakcdmpcliojljfepdokneehmdn) · [Seizafe](https://chromewebstore.google.com/detail/goageegpmdbgenkgkhfhnnjmgmgboegi) · [Epilepsy Blocker](https://addons.mozilla.org/en-US/firefox/addon/epilepsy-blocker/).

[PhotosensitivityPal](https://chromewebstore.google.com/detail/photosensitivitypal/jfbeiilmcgaofgkhkbdepkafoikbmklh): listing unavailable on 22 Nov 2026.
<!-- comparison:end -->

## Limitations

- Not covered: `<canvas>`/WebGL games, CSS/JS animations of page elements, CSS background GIFs, animated PNGs whose URL doesn't look animated, spatial pattern (stripe) hazards.
- Live video: a short, measured switch latency after the 5th transition (above). At exactly 3 flashes per second the live path can err on the safe side when the browser skips frames. GIFs and pre-scanned videos are decoded frame by frame and are exact.
- Unreadable and DRM video can't be analysed. It runs in Calm Mode unless the user opts out.
- Media inside shadow roots is calmed when the script finds it (within milliseconds), not by the `document_start` stylesheet.
- HDR content on HDR displays can exceed Calm Mode's bound.
- Thresholds follow WCAG reference viewing conditions; real risk varies by person, screen size and distance.
- Validated only against the spec with synthetic ground truth. It has not been tested with people who have epilepsy, and must not be.
- The benchmark reflects specific tool versions on a specific date, judged by this project's own analyser (method published).
- Tested in Microsoft Edge (Chromium) via Playwright; Chrome 137+ no longer allows automated extension loading.

## Development

```
npm install
npx vitest run                 # 45 unit tests incl. the locked suite
node tools/make-clips.mjs      # ffmpeg CFR test clips → clips/ (gitignored)
node tools/make-bench.mjs      # suite cases as MP4 → bench/clips/ (gitignored)
npx playwright test            # E2E on Edge: Lab, extension, pre-scan, UX + axe, latency, benchmark
node tools/sync-ext.mjs        # mirror core/ into extension/ (drift test enforces it)
node tools/release.mjs         # dist/strobeproof-extension-v1.0.0.zip
```

Test pages never show a failing clip larger than 160 px, and E2E records no video, traces or screenshots.

## Credits and AI use

Built solo for EvoHacks 2.0 with Claude Code. What the human wrote or decided and what Claude Code wrote is logged per commit in [AI_LOG.md](AI_LOG.md). Decisions are in [PROGRESS.md](PROGRESS.md). Bundled: [mp4box.js](https://github.com/gpac/mp4box.js) (BSD-3-Clause, `vendor/mp4box/LICENSE`).

**Why no AI in the product:** WCAG 2.3.1 is a published, numeric safety spec. A pass/fail safety check should be deterministic and testable, so Strobeproof's engine is plain arithmetic with known answers.
