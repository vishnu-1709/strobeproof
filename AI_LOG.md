# AI log

Strobeproof was built with AI assistance (Claude Code). EvoHacks 2.0 rule: "AI is accepted but you should not use it to create the whole project." This file is the honest split; DEVPOST.md › "Built with AI assistance" says the same thing.

## The split

**The human (project owner)**
- **Spec interpretation**: the build plan and its WCAG 2.3.1 reading. That covers the constants, the transition definition (half-open window, ≥ 7 transitions), the pre-trip design, Calm Mode and its 0.32 → 0.084 maths, and the protection model.
- **`core/__tests__/expected.json`**: the known-answer cases and their answers (plan §4.5). Reviewed the drafted file, added case 9b and the case-9 general assertion, chose linear RGB for the red rule, and approved and locked it.
- **`core/flashCounter.js` and `core/areaGrid.js`**: the final versions are written by hand. (Earlier drafts in git history, commit `1002278`, were written by Claude Code on delegation and were replaced; see `chore: hand over flashCounter/areaGrid to human`.)
- **Spike**: designed the five spike questions and runs the manual real-Chrome checks (Reddit/X GIF-video fetchability, Reddit shadow DOM).
- **Benchmark**: designed the method and records the competitor tools.
- **Manual accessibility testing**: NVDA/VoiceOver, 200% zoom, forced colours, hallway test.
- **The demo video and the Devpost submission.**
- **All decisions in PROGRESS.md › Decisions**: made by the human, or approved by the human, some under a standing approval to take Claude Code's recommended option.

**Claude Code (AI assistant)**
- Scaffolding: repo setup, CLAUDE.md assembled from the plan, progress logs.
- Lab UI: the check-a-file page, suite page, benchmark page, demo feed and sample button.
- Engine plumbing around the human's files: luminance and tiles, the analyser, and the GIF/WebP and MP4 every-frame decoders.
- Extension plumbing: manifest, service worker, content script (discovery, state machine, live detection), offscreen pre-scan, chips, popup, welcome tab.
- Test harness: Vitest tests and synthetic frame generators from the human's case list, plus Playwright E2E, axe checks, latency and benchmark automation.
- Tools: the clip, benchmark and release scripts. Spike kit code and the automated spike run.
- Drafts of README.md and DEVPOST.md.

## Per commit

| Commit | Claude Code wrote | Human wrote / decided |
|---|---|---|
| `211a5ae` chore: clear repo | Removal commit | Decided to reset the repo and start fresh |
| scaffold | `CLAUDE.md` (assembled verbatim from plan §7.1 + master prompt §2), `PROGRESS.md`, `AI_LOG.md`, `.gitignore` | Wrote the build plan and master prompt (copied into the repo unchanged) |
| `7f1489a` M0 spike kit | Spike extension, Playwright runner | Defined the five spike questions (plan) |
| `e688a24` core groundwork | constants.js transcribed from plan §4.1, fixtures, luminance, analyzer, decoders, tests | Constants and test cases specified in the plan |
| `1002278` flashCounter + areaGrid (drafts) | Draft versions, written on delegation from the human's §4.3/§4.4 pseudocode; later replaced | Reviewed expected.json and added case 9b plus the case-9 general assertion; chose linear RGB for the red rule |
| `dcabdaf` spike results | Ran the automated spike, wrote SPIKE.md | Reddit/X manual run pending |
| `207d534` Lab | Lab pages, worker, clip generator, server, Lab E2E | – |
| `2392f32` extension core | manifest, calm.css, sw.js, content.js, settings, chips | Plan design (Calm by default, pre-trip, states) |
| `7bd525e` pre-scan | offscreen.js, cache, WebP header path | WebP fast-release rule (Decision C6) |
| `42bd761` UX layer | popup, welcome, chip.css, demo feed, UX E2E | Plan §3.4–§3.6 UX spec |
| `126ff12` latency | latency E2E + clip | Pre-trip design (plan A17) |
| M8 benchmark | make-bench, recorder page, benchmark page, bench E2E, crop mode | Benchmark method (plan §6); competitor recordings pending |
| M9 ship | README, DEVPOST.md draft, release.mjs (zip writer), review fixes (chip Tab order, VideoDecoder leak) | Approved the expected.json lock, go-public, gated large bench size |
| history rewrite | Ran git filter-repo as specified; verified dates; attribution settings | Decided: noreply email, no attribution trailers, go public |
| pre-trip 4 → 5 | Constant change, 2 Hz / 2.5 Hz E2E, latency re-run | Decided the change |
| Try a sample | Lab sample button + test | Specified it |
| hand-over | Replaced both files with stubs (interfaces and tests kept) | Writes `flashCounter.js` and `areaGrid.js` by hand |
