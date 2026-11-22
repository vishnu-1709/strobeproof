# AI log

Strobeproof was built with AI assistance (Claude Code). "Me" below means the project owner. EvoHacks 2.0 rule: "AI is accepted but you should not use it to create the whole project." This file is the honest split; DEVPOST.md › "Built with AI assistance" says the same thing.

## The split

**The project owner (me)**
- Chose the idea and the approach. A verifiable flash detector: known-answer suite, benchmark, and Calm Mode by default, with an honest "can't check" state. I wrote the build plan with Claude's help.
- Researched the existing tools and the WCAG 2.3.1 flash rules before the build. (The comparison table itself was compiled by Claude Code from the store listings; see below.)
- Made every spec and design decision (PROGRESS.md › Decisions). Where Claude Code proposed options, I chose or approved them. That covers the WCAG 2.3.1 reading behind the constants, the transition definition, the pre-trip design, the change from 4 to 5 transitions, Calm Mode and its 0.32 → 0.084 maths, the red rule using linear RGB, and the UX rules.
- Wrote and approved the test answers (`core/__tests__/expected.json`, plan §4.5), including the case 9/9b fix: case 9 also asserts a general flash, and 9b isolates the red rule.
- Reviewed and approved `core/flashCounter.js` and `core/areaGrid.js`.
- Ran the real-browser checks: the release check in Chrome and testing on YouTube. The manual spike on Reddit/X was not done. Designed the benchmark (cases, method, what counts as blocked) and decided to compare other tools by their public store listings instead of screen recordings.
- Recorded the video's screen demos and narration (slides, captions and editing made with Claude).

**Claude Code (AI assistant): the implementation**
- `core/flashCounter.js` and `core/areaGrid.js`: AI-drafted by Claude Code from my §4.3/§4.4 pseudocode; reviewed and approved by me.
- The rest of the engine: luminance tiles, the analyser, and the GIF/WebP and MP4 every-frame decoders.
- The Lab UI: check page, suite, benchmark, demo feed, sample button.
- The extension: service worker, content script, offscreen pre-scan, chips, popup, welcome tab.
- The test harness: Vitest tests and the synthetic frame generators, built from my case list and answers, plus Playwright E2E, axe checks, latency and benchmark automation.
- The spike kit and its automated probes.
- Running the benchmark: the automated Strobeproof row (7/7 failing cases blocked), and the feature comparison table compiled from the other tools' public store listings.
- The clip, benchmark and release scripts.
- Scaffolding.
- Drafts of README.md and DEVPOST.md.

**Other AI help**
- I also used Claude (claude.ai) for research on existing tools and the WCAG rules, to help write the build plan, and to make the video's animated slides, captions and final edit. I recorded the screen demos and the narration myself.

## Per commit

| Commit | Claude Code wrote | Human wrote / decided |
|---|---|---|
| `211a5ae` chore: clear repo | Removal commit | Decided to reset the repo and start fresh |
| scaffold | `CLAUDE.md` (assembled verbatim from plan §7.1 + master prompt §2), `PROGRESS.md`, `AI_LOG.md`, `.gitignore` | Wrote the build plan (with Claude's help) and master prompt (copied into the repo unchanged) |
| `7f1489a` M0 spike kit | Spike extension, Playwright runner | Defined the five spike questions (plan) |
| `e688a24` core groundwork | constants.js transcribed from plan §4.1, fixtures, luminance, analyzer, decoders, tests | Constants and test cases specified in the plan |
| `1002278` flashCounter + areaGrid | Both files, AI-drafted from the owner's §4.3/§4.4 pseudocode (the versions in use today) | Reviewed and approved both; reviewed expected.json and added case 9b plus the case-9 general assertion; chose linear RGB for the red rule |
| `dcabdaf` spike results | Ran the automated spike, wrote SPIKE.md | Reddit/X manual run not done |
| `207d534` Lab | Lab pages, worker, clip generator, server, Lab E2E | – |
| `2392f32` extension core | manifest, calm.css, sw.js, content.js, settings, chips | Plan design (Calm by default, pre-trip, states) |
| `7bd525e` pre-scan | offscreen.js, cache, WebP header path | WebP fast-release rule (Decision C6) |
| `42bd761` UX layer | popup, welcome, chip.css, demo feed, UX E2E | Plan §3.4–§3.6 UX spec |
| `126ff12` latency | latency E2E + clip | Pre-trip design (plan A17) |
| M8 benchmark | make-bench, recorder page, benchmark page, bench E2E, crop mode | Benchmark method (plan §6) |
| M9 ship | README, DEVPOST.md draft, release.mjs (zip writer), review fixes (chip Tab order, VideoDecoder leak) | Approved the expected.json lock, go-public, gated large bench size |
| history rewrite | Ran git filter-repo as specified; verified dates; attribution settings | Decided: noreply email, no attribution trailers, go public |
| pre-trip 4 → 5 | Constant change, 2 Hz / 2.5 Hz E2E, latency re-run | Decided the change |
| Try a sample | Lab sample button + test | Specified it |
| stub, then restore | Briefly replaced both files with stubs, then restored the AI drafts from `490f4a9` unchanged and relabelled them | Decided to keep the AI-drafted versions, reviewed and approved, and credit them as such |
| comparison | Read the five store listings, wrote lab/comparison.json and the tables (benchmark page, README, Devpost) | Chose listing-based comparison over competitor recordings; chose the tools |
| How I built this | Pasted the section into DEVPOST.md and aligned this file with it | Wrote the "How I built this" text; confirmed which real-browser checks were done |
| sources + other AI help | Added the source links and AI-help wording to DEVPOST.md and this file | Found the sources for "The problem"; wrote the "Other AI help" text |
