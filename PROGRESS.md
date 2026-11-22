# Progress

Hackathon end (Asia/Kolkata): **unknown — to confirm**
Repo: https://github.com/vishnu-1709/strobeproof (private)

## Milestones

| M | Name | Estimate | Status | Time used | Tag |
|---|---|---|---|---|---|
| M0 | Spike kit | 50 min | done (auto); manual Reddit/X run pending (flag GIF_VIDEO_PRESCAN = true meanwhile) | ~45 min | – |
| M1 | Spec lock | 15 min | done, expected.json locked 2026-11-22 | ~20 min | m1-done |
| M2 | Core engine | 75 min | done | ~35 min | m2-done |
| M3 | Lab | 60 min | done, e2e 8/8, axe 0 (deploy waits on public repo) | ~35 min | m3-done |
| M4 | Extension core | 70 min | done, e2e 7/7 | ~30 min | m4-done |
| M5 | Pre-scan | 50 min | done, e2e 9/9 (static WebP release max 0 ms) | ~20 min | m5-done |
| M6 | UX layer | 60 min | done, e2e 10/10, axe 0 everywhere | ~30 min | m6-done |
| M7 | E2E + latency | 40 min | done: Calm set 8–14 ms before the 4th transition is due on screen (10 runs) | ~15 min | m7-done |
| M8 | Benchmark support | 45 min | done: all 7 failing bench cases blocked; competitors compared via store listings | ~35 min | m8-done |
| M9 | Ship | 35 min | done except: public repo + Pages, v1.0 tag (both need the human) | ~30 min | – |

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
| 2026-11-22 | Speed mode (human) | Standing approval: C1, C3 (npm dev deps only), C6, C10 → take the recommended option, log it here, keep going. Still stop for C2, C5, C7 (>30% over), C8, C9. Batch questions once per milestone. One-line feature updates. Playwright/axe at milestone end only. |
| 2026-11-22 | M0 not blocking | CALM_BRIGHTNESS = 0.32 (measured sRGB in Edge). GIF-video pre-scan behind constants.js GIF_VIDEO_PRESCAN = true; update when the human pastes Reddit/X spike results. |
| 2026-11-22 | C1: live analysis worker | Content scripts can't easily start an extension-origin Worker, so live analysis runs inline in the content script (9,216 px + 576 tiles per frame, about 1 ms). Offscreen pre-scan unchanged. |
| 2026-11-22 | C1: extension can't import ../core | tools/sync-ext.mjs mirrors core/ + vendor/ into extension/ (committed, so Load unpacked works from a clone); drift.test.js fails if the copy is stale. A copy step, not a bundler. |
| 2026-11-22 | C1: live time base | Live detection uses rVFC wall-clock presentation time (expectedDisplayTime), not mediaTime: it's what the viewer sees, and it handles loops, seeks and playbackRate. Lab/offscreen keep exact media timestamps. |
| 2026-11-22 | C6: chips | "Checking…" chip appears only if a check takes > 800 ms (no chip flash on fast checks). [Keep Calm] is first in tab order and styled primary, but focus is not moved automatically (no focus stealing). "Can't check" announcements throttled to one per 10 s per page. |
| 2026-11-22 | C6: Lab area test | 320×180 at its own size is 57,600 px² > 21,824, so a full-frame 5 Hz clip correctly FAILS at native size; E2E covers both sides of the area limit. |
| 2026-11-22 | C1: plan says "2 Hz → released" (M4 done-when), but PRETRIP_TRANS = 4 and a 2 Hz full-frame flash is exactly 4 transitions/s | Kept the constant (no C2 change). 2 Hz is held in Calm while it flashes (pre-trip margin, never confirmed risky); the release test uses a non-flashing clip. Flag for the human: raising PRETRIP_TRANS to 5 would release 2 Hz but shrink the latency slack from 3 to 2 transitions. |
| 2026-11-22 | C6: popup labels | §3.6 "Strict (WCAG 2.3.1) / Comfort" → "Standard" / "Extra careful (not a medical standard)"; footer says "the web's flash-safety guideline" (CLAUDE.md: no WCAG in extension UI). |
| 2026-11-22 | C10: demo feed media | Tiny synthetic demo clips (45 KB) committed in demo/media so the hosted demo works; the demo page keeps every flashing item dim by itself, so it is safe without the extension. |
| 2026-11-22 | C1: live time base (revised) | Back to the plan: live detection uses media timestamps (accumulated across loops/seeks, ÷ playbackRate) instead of wall-clock, which removed jitter-induced false confirms. |
| 2026-11-22 | C6: frame-skip pre-trip | Only ≥ 2 consecutive missed frames count as "uncertain" (headless Edge skips single frames constantly, which held every video calm). A single drop can't hide a whole flash state near the threshold. |
| 2026-11-22 | C1: benchmark display size | Strobeproof's own row runs 160×90 clips in a 160 px-wide window = exactly the 1024×576 reference display (keeps the ≤ 160 px rule). Known: at exactly 3 Hz the live path errs on the safe side when frames are skipped; Lab and pre-scan are exact. |
| 2026-11-22 | C2: expected.json lock | Approved and locked by the human. |
| 2026-11-22 | C8: make public + Pages | Approved by the human, then held by Claude: commit history contains two personal email addresses that would become public. Asked how to proceed. |
| 2026-11-22 | C9: large bench clips | Keep the 640 px size behind ?allowLarge=1; the human opens it when recording. |
| 2026-11-22 | Review fix (C6) | Chips moved next to their media in the DOM so they follow it in Tab order (was: end of body). Transformed ancestors corrected for. |
| 2026-11-22 | PRETRIP_TRANS 4 → 5 (human decision) | So compliant 2 Hz video (4 transitions/s) plays at normal brightness; 2.5 Hz (5/s) is calmed. Slack drops from 3 to 2 transitions, justified by the re-measured latency: Calm set −10.4 … +7.3 ms around the triggering frame (12 runs), paints within ~1 display frame, so at most 5 transitions (2.5 flashes) show. E2E: 2 Hz released, 2.5 Hz calmed. |
| 2026-11-22 | History rewrite (human decision) | git filter-repo: both personal emails → GitHub noreply, attribution trailers stripped, dates verified identical for all 18 commits; force-pushed once; repo public; Pages on main. Backup bundle kept outside the repo. |
| 2026-11-22 | flashCounter.js / areaGrid.js authorship (human decision) | Keep the AI-drafted versions (restored unchanged from 490f4a9 after a brief stub). Credited everywhere as "AI-drafted by Claude Code; reviewed and approved by me"; no handwritten claims. |
| 2026-11-22 | PRETRIP_TRANS after the loaded-latency result (human decision) | Keep 5. Under heavy load the worst run let 6 transitions through (3 flashes, at the limit, not over); idle machines switch within ~1 frame. Reported in README and Devpost. |
| 2026-11-22 | Competitor benchmark (human decision) | Skip screen recordings. Compare NeuroShield, CogniShield, Seizafe, Epilepsy Blocker and PhotosensitivityPal using only their public store listings (lab/comparison.json → benchmark page, README, Devpost; "?" where a listing doesn't say). Epilepsy Blocker was read via the AMO public API (the page had a bot check); the PhotosensitivityPal listing showed no details. Strobeproof's own 7/7 result stays alongside. |

## Open issues
- Intermittent under full-suite load: the "30 static WebPs within 300 ms" test failed once (one image not released in the window); passes 3/3 in isolation (max 0 ms). Not changed.
- Not changed (no new behaviour without the human): an "uncertain" frame-skip pre-trip during warm-up restarts the 3 s quiet period, so very short clips can end before release on a busy machine. Safe-side. Option: let only pre-trip transitions (not skips) restart the quiet period.
- Hackathon deadline and AI-use rule not yet provided.
- C4: Reddit/X GIF-video fetchability + Reddit shadow DOM need the human's real-Chrome spike run (SPIKE.md).
- Human-only: NVDA/VoiceOver, 200% zoom, forced colours, hallway test; install GIF (docs/install.gif); demo video; Devpost ⚠ facts.

## Pre-submit checklist (plan §11)
- [ ] Final check that "Strobeproof" is still unused on Devpost / Web Store / GitHub
- [ ] Every ⚠ fact sourced or removed (DEVPOST.md)
- [x] CALM_BRIGHTNESS set from the spike measurement; test #15 green
- [x] Lab URL works in a clean profile; suite page 20/20 (Chrome 156, built-in browser)
- [x] Release ZIP installs on a clean profile (27/27 extension E2E on the unzipped ZIP)
- [x] Pre-trip latency number and benchmark method in README
- [ ] Video ≤ 3:00, warning card first, no unmasked flashing, own-code segment
- [x] Wording says "reduces exposure" everywhere, never "prevents seizures"
