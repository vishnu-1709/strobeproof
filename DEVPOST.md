# Strobeproof: Devpost draft

> ⚠ = must be sourced from a primary source (or removed) before submitting. Plan §1.3, §11.

## 1. What it does
Every flash blocker says it follows WCAG. Strobeproof is the one that proves it: an open known-answer test suite, a benchmark of existing tools, and a browser shield whose Calm Mode stays below the WCAG flash threshold by construction, even on video it can't read.

**Try it:** Lab (no install): https://vishnu-1709.github.io/strobeproof/lab/ · Demo feed: https://vishnu-1709.github.io/strobeproof/demo/ · Extension ZIP: see README.

## 2. The problem
- People with photosensitive epilepsy have been deliberately attacked with strobing GIFs. In 2016 a strobing GIF sent to journalist Kurt Eichenwald caused a seizure and the sender was criminally charged. ⚠ (seizure details)
- In Nov 2019 and May 2020, followers of the Epilepsy Foundation and the Epilepsy Society were sent strobing GIFs. ⚠ (dates and outcomes from primary sources: TIME, Epilepsy Society)
- Photosensitive epilepsy affects about 1 in 4,000 people, 3–5% of people with epilepsy (Epilepsy Society, https://www.epilepsy.org.uk/?p=1833).

## 3. Prior art and how Strobeproof compares
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

Also related, not re-checked against their listings today ⚠: CalmWeb (Firefox), Photosensitivity Video Blocker (Chrome), Flikcer (2021 research prototype), EPI-LENS (open-source analysis tool), PEAT (Trace Center desktop analyser for developers).

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
- Benchmark: Strobeproof blocked all 7 failing benchmark cases, with 0 frames at normal brightness (case 14 can't be a constant-rate file, so it's suite-only). Other tools weren't run through the benchmark; section 3 compares them using their public store listings.

## 8. Accessibility of the tool itself
No animation anywhere; 44 px targets; Tab/Enter/Esc; labels next to their media in Tab order; polite announcements only for events you must act on; forced colours; caregiver lock; plain language (grade-6 style) in the extension. axe-core: 0 violations on every surface. Hallway test: (one sentence after running it, plan §3.5).

## 9. Why no AI
WCAG 2.3.1 is a published numeric safety spec. A pass/fail safety check should be deterministic and testable, so it's arithmetic with known answers, not a model.

## 10. Limitations
See the README Limitations section (canvas, CSS animation, CSS backgrounds, stripes; live latency; exact-3 Hz live over-caution; DRM/cross-origin can't be read; HDR; reference viewing conditions; never tested with people who have epilepsy).

## 11. Built with AI assistance

Strobeproof was built with the help of **Claude Code** (Anthropic's AI coding assistant). In line with the EvoHacks 2.0 rule ("AI is accepted but you should not use it to create the whole project"), here is the split. The full per-commit record is in [AI_LOG.md](AI_LOG.md), which matches this section.

**What I did**
- **Chose the idea and the approach.** A flash detector you can verify: a known-answer suite, a benchmark of existing tools, and Calm Mode by default, with an honest "can't check" state. I wrote the build plan.
- **Researched the existing tools and the WCAG 2.3.1 flash rules** before the build. (Claude Code compiled the comparison table from the store listings.)
- **Made every spec and design decision** (PROGRESS.md › Decisions). Where Claude Code proposed options, I chose or approved them. That covers the WCAG 2.3.1 reading behind the constants, the transition rule, the pre-trip design (including moving it from 4 to 5 transitions), Calm Mode and its 0.32 → 0.084 maths, the red rule using linear RGB, and the UX rules.
- **Wrote and approved the test answers** (`expected.json`), including the case 9/9b fix: case 9 also asserts a general flash, and 9b isolates the red-only rule.
- **Ran the real-browser checks and the spike**: the spike on Reddit/X in real Chrome, testing on YouTube, and the release check in Chrome. ⚠ confirm both are done before submitting.
- **Designed the benchmark**: the cases, the method, what counts as blocked. I chose to compare other tools by their public store listings instead of screen-recording them.
- **Made the video.** ⚠

**What Claude Code did: the implementation**
- The detection engine, including `core/flashCounter.js` and `core/areaGrid.js`. These two were AI-drafted by Claude Code from my pseudocode, then reviewed and approved by me.
- Luminance tiles, the analyser, and the every-frame GIF/WebP/MP4 decoders.
- The Lab UI.
- The browser extension: service worker, content script, offscreen pre-scan, chips, popup, welcome tab.
- The test harness from my cases and answers: Vitest, synthetic frame generators, Playwright E2E, axe, latency and benchmark automation.
- The spike kit and its automated probes.
- Running the benchmark (the automated Strobeproof row) and compiling the comparison table from public store listings.
- The build and clip scripts, and scaffolding.
- Drafts of the README and this page.

Commits don't carry AI co-author trailers; AI use is disclosed here and in AI_LOG.md instead.

## How I built this

I'm a college student and still a beginner at coding, but I love building things and wanted to take part in hackathons instead of waiting until I "know enough". Strobeproof is the result of that enthusiasm.

I chose the problem after reading about strobing GIFs being used to attack people with epilepsy. I researched the existing tools and the WCAG 2.3.1 flash rules, designed the approach (Calm Mode, test-first, an honest "can't check" state), made every design decision along the way, approved all 20 test answers (including catching that pure red is also a general flash), tested it in real Chrome and on YouTube, and made this video.

Since I'm still learning, I built it with Claude Code as my pair programmer. It wrote most of the implementation, including the detection engine, which I reviewed, approved and can explain.

The biggest thing I learned is that safety software has to be provable, not just plausible, which is why the project starts with a test suite. I'm leaving this hackathon understanding how flash detection works frame by frame, how browser extensions are structured, and why accessibility has to be designed in from the start. Next time, I want to write more of the code myself.
