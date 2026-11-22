# Progress

Hackathon end (Asia/Kolkata): **unknown — to confirm**
Repo: https://github.com/vishnu-1709/strobeproof (private)

## Milestones

| M | Name | Estimate | Status | Time used | Tag |
|---|---|---|---|---|---|
| M0 | Spike kit | 50 min | done (auto); manual Reddit/X run pending | ~45 min | – |
| M1 | Spec lock | 15 min | done except expected.json lock (awaiting human) | ~20 min | – |
| M2 | Core engine | 75 min | done, 39/39 tests | ~35 min | – |
| M3 | Lab | 60 min | in progress | – | – |
| M4 | Extension core | 70 min | not started | – | – |
| M5 | Pre-scan | 50 min | not started | – | – |
| M6 | UX layer | 60 min | not started | – | – |
| M7 | E2E + latency | 40 min | not started | – | – |
| M8 | Benchmark support | 45 min | not started | – | – |
| M9 | Ship | 35 min | not started | – | – |

## Decisions

| Date | Question | Answer |
|---|---|---|
| 2026-11-22 | Existing `strobeproof` repo had a scaffold + M0 spike kit. Keep or reset? | Reset: all files removed in `1da101c` (no force-push; old work recoverable at `8a6a996`). Start fresh. |
| 2026-11-22 | C1/C8: repo is private, and GitHub Pages on a private repo needs a paid plan. How to host the Lab? | Keep it private for now and make it public at M3 (ask again at that point), then use GitHub Pages. |
| 2026-11-22 | C1: manifest `calm.css` can't be excluded on allowlisted sites. | Register `calm.css` dynamically with `chrome.scripting.registerContentScripts` (`runAt: document_start`, `excludeMatches` = allowlist). No manifest `css` entry. |
| 2026-11-22 | C6: calm.css darkens all `.webp` images (most static photos on Reddit/X). | Keep WebP calm by default, but make the release near-instant: (1) The offscreen doc fetches only bytes 0–31 (`Range: bytes=0-31`) and reads the VP8X animation flag. Not animated → release immediately and cache the verdict by URL. Only animated WebPs get the full frame decode. If the server ignores Range, abort the fetch after the first chunk. (2) Release any image whose displayed area is below the area limit (`AREA_LIMIT_PX`, scaled), because it can't fail. (3) E2E check: on a page of 30 static WebPs, every image is released within 300 ms of entering the viewport. |
| 2026-11-22 | C3: ffmpeg missing. | Installed via winget (Gyan.FFmpeg); available as `ffmpeg` in new shells. |

| 2026-11-22 | C5: who writes flashCounter.js / areaGrid.js? | Claude Code writes them pair-style; human reads and annotates every line. |
| 2026-11-22 | M1: expected.json review | Human asked: case 9 also asserts general.fail; add 9b (dark saturated red (102,0,0)↔black, ΔL < 0.10, red metric > 20 → general false, red true). Show final file before locking. Done; awaiting lock. |
| 2026-11-22 | C1: red-flash R,G,B encoding | Linear (as in the relative-luminance definition). |
| 2026-11-22 | C4 (partial): spike ④⑤① | CALM_BRIGHTNESS 0.32 confirmed (sRGB-space filter, white → 82/255, L 0.0844). Filter persists in fullscreen. YouTube readable → live path. See SPIKE.md. |
| 2026-11-22 | Test browser | Chrome 137+ ignores --load-extension and bundled Chromium is blocked on this machine, so E2E uses Microsoft Edge (Chromium) via Playwright channel msedge. |

## Open issues
- Hackathon deadline and AI-use rule not yet provided.
- C4 open: Reddit/X GIF-video fetchability + Reddit shadow DOM need the human's real-Chrome run (SPIKE.md). GIF-video pre-scan is built behind that answer.
- expected.json lock pending human approval.
- Plan says "14 known-answer tests" in §1.2/§1.1 but §4.5 lists 15 (incl. Calm Mode #15). Treating it as 15.
