# Strobeproof — rules
- All thresholds come from core/constants.js. Never hard-code a threshold elsewhere.
- NEVER edit core/__tests__/expected.json or weaken a test to make it pass. If a test fails, fix the code or stop and ask.
- Never write flashCounter.js or areaGrid.js unless explicitly asked; the human owns them.
- UI: zero animations/transitions/spinners anywhere. 44px targets. Visible focus. aria-live polite only.
- Test/demo pages render clips at ≤160px and default to Calm Mode. Never autoplay a failing clip at full size.
- Decoding for analysis must visit every frame (WebCodecs/ImageDecoder). Never sample by seeking at a fixed step.
- Ask before adding a dependency. Allowed: vitest, mp4box, playwright, @axe-core/playwright.
- Extension UI copy is plain language (no "WCAG", "luminance", "transition"); technical terms belong in the Lab only.
- Safe items get no chip. Max one chip per media item. Every interactive element must pass axe-core.
- Wording: "reduces exposure", never "prevents seizures".
- Run `npx vitest run` after every change to core/.

## Source of truth
- `strobeproof-build-plan-v2.md` ("the plan") is the spec. `strobeproof-claude-code-master-prompt.md` defines how work is run.
- If they disagree with each other or with reality, stop and ask (conflict C1). Never guess on a conflict.

## House rules

**Spec and tests**
- All thresholds live in `core/constants.js`. Never hard-code a threshold anywhere else.
- **Never edit `core/__tests__/expected.json`**, and never skip, weaken or delete a test to make it pass. If a test fails and you believe the expectation is wrong, that is a conflict: stop and ask.
- `core/flashCounter.js` and `core/areaGrid.js` are **the human's**. Don't write their logic unless explicitly told "write flashCounter" / "write areaGrid" for that session. Tests, interfaces and stubs that throw `NotImplemented` are fine.
- Analysis must decode **every frame** (WebCodecs `VideoDecoder` / `ImageDecoder`). Never sample by seeking at a fixed step.

**Safety while building**
- No test or demo page may render a failing clip larger than 160 px, and every one must start in Calm Mode.
- Never open, autoplay or screenshot a failing clip at full size, including in Playwright traces. Disable video and trace recording for flashing fixtures.
- Product copy says "reduces exposure", never "prevents seizures".

**UX and accessibility (the top judging priority)**
- Zero animations, transitions or spinners in any UI.
- 44×44 px targets, visible focus, Tab/Enter/Esc for everything, `aria-live="polite"` only for events the user must act on.
- Safe items get **no** chip. At most one chip per media item.
- Extension UI copy is plain language; "WCAG", "luminance" and "transition" appear only in the Lab.
- Every UI surface must pass `@axe-core/playwright` with zero violations before its milestone is done.

**Code**
- Dependencies allowed without asking: `vitest`, `mp4box`, `playwright`, `@axe-core/playwright`. Anything else: ask.
- Manifest permissions: exactly those in the plan (`storage`, `offscreen`, `scripting`, host `<all_urls>`). Adding one is a conflict.
- Vanilla JS and ES modules, no framework, no build step unless approved.
- Run `npx vitest run` after every change to `core/`, and the relevant Playwright tests after every change to `extension/` or `lab/`.

**Git**
- Work on `main`. Commit after every feature that passes its checks (roughly every 20–40 min, **never more than 45 min without a push**).
- Conventional commits: `feat(core): …`, `feat(ext): …`, `feat(lab): …`, `test: …`, `fix: …`, `docs: …`, `chore: …`. Each body ends with `Milestone: M#`.
- Never commit secrets, `.env`, `node_modules`, large binaries (> 5 MB) or failing-clip recordings. Generated clips are gitignored and regenerated with `tools/make-clips.mjs`.
- **Never** force-push, rewrite pushed history, delete branches or tags, or change repo visibility without asking.
- Do not add Co-Authored-By or Claude attribution lines to commits or PRs. (AI use is disclosed in AI_LOG.md and on Devpost instead.)
- Never edit `core/flashCounter.js` or `core/areaGrid.js` again: the human writes them by hand (EvoHacks AI rule).
- Tag each finished milestone: `git tag m#-done && git push --tags`.

**Reporting**
- After every feature: the short ✅ update (master prompt §3.1). After every milestone: the longer update with time left (§3.2, §3.4).
- Keep `PROGRESS.md` and `AI_LOG.md` current with every commit.
