# Progress

Hackathon end (Asia/Kolkata): **unknown — to confirm**
Repo: https://github.com/vishnu-1709/strobeproof (private)

## Milestones

| M | Name | Estimate | Status | Time used | Tag |
|---|---|---|---|---|---|
| M0 | Spike kit | 50 min | not started | – | – |
| M1 | Spec lock | 15 min | not started | – | – |
| M2 | Core engine | 75 min | not started | – | – |
| M3 | Lab | 60 min | not started | – | – |
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

## Open issues
- Hackathon deadline and AI-use rule not yet provided.
- Plan says "14 known-answer tests" in §1.2/§1.1 but §4.5 lists 15 (incl. Calm Mode #15). Treating it as 15.
