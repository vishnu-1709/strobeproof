# Strobeproof — rules

Source of truth: `strobeproof-build-plan-v2.md`. If this file and the plan disagree, stop and ask.

## Spec and tests
- All thresholds come from `core/constants.js`. Never hard-code a threshold elsewhere.
- NEVER edit `core/__tests__/expected.json` or weaken, skip or delete a test to make it pass. If a test fails, fix the code or stop and ask.
- Never write `core/flashCounter.js` or `core/areaGrid.js` logic unless explicitly asked ("write flashCounter" / "write areaGrid"). The human owns them. Tests, interfaces and `NotImplemented` stubs are fine.
- Analysis must decode every frame (WebCodecs `VideoDecoder` / `ImageDecoder`). Never sample by seeking at a fixed step.
- Run `npx vitest run` after every change to `core/`.

## Safety while building
- No test or demo page may render a failing clip larger than 160 px, and every one starts in Calm Mode.
- Never open, autoplay or screenshot a failing clip at full size, including in Playwright traces. Disable video and trace recording for flashing fixtures.
- Product copy says "reduces exposure", never "prevents seizures".

## UX and accessibility
- Zero animations, transitions or spinners in any UI.
- 44×44 px targets, visible focus, Tab/Enter/Esc for everything, `aria-live="polite"` only for events the user must act on.
- Safe items get no chip. At most one chip per media item.
- Extension UI copy is plain language. "WCAG", "luminance" and "transition" appear only in the Lab.
- Every UI surface must pass `@axe-core/playwright` with zero violations.

## Code
- Dependencies allowed without asking: `vitest`, `mp4box`, `playwright`, `@axe-core/playwright`. Anything else: ask.
- Manifest permissions: exactly `storage`, `offscreen`, `scripting`, host `<all_urls>`. Adding one is a conflict.
- Vanilla JS and ES modules. No framework, no build step unless approved.
- Run the relevant Playwright tests after every change to `extension/` or `lab/`.

## Git
- Work on `main`. Commit after every feature that passes its checks, and never go more than 45 minutes without a push.
- Conventional commits: `feat(core): …`, `feat(ext): …`, `feat(lab): …`, `test: …`, `fix: …`, `docs: …`, `chore: …`. Each body ends with `Milestone: M#`.
- Never commit secrets, `.env`, `node_modules`, binaries over 5 MB, or failing-clip recordings. Generated clips go in `.gitignore`.
- Never force-push, rewrite pushed history, delete branches or tags, or change repo visibility without asking.
- Tag each finished milestone: `git tag m#-done && git push --tags`.
