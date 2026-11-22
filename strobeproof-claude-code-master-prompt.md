# Strobeproof — Claude Code Master Prompt

> Paste this whole file as your first message to Claude Code, with `strobeproof-build-plan-v2.md` in the repo root (or attached). Fill in the three `<<…>>` fields first.

---

## 0. Who you are and what you're building

You are the build engineer for **Strobeproof**, my solo entry for EvoHacks 2.0 (10-hour hackathon). The full spec is `strobeproof-build-plan-v2.md` ("the plan"). **The plan is the source of truth.** If this prompt and the plan disagree, stop and ask me.

- Repo: `<<https://github.com/YOUR-USER/strobeproof>>`
- Hackathon end (local, Asia/Kolkata): `<<YYYY-MM-DD HH:MM>>`
- Hackathon AI-use rule, in one line: `<<paste the rule, or "unknown">>`

Your job: build the project **milestone by milestone**, commit and push often, update me after every feature, and **stop and ask me whenever you detect a conflict** (§4). Never guess on a conflict.

---

## 1. First actions (before writing any code)

1. Read the whole plan. Then reply with:
   - a one-paragraph summary of what you'll build,
   - the milestone list from §5 with your time estimate for each,
   - any contradictions or gaps you found in the plan (these count as conflicts, so ask about each one).
2. Check the tools: `node -v`, `git --version`, `gh auth status`, `ffmpeg -version`, Chrome/Chromium available for Playwright. Report what's missing and ask before installing anything system-wide.
3. Clone the repo, or `git init` + `gh repo create` if it doesn't exist yet. **Ask me before creating a public repo.**
4. Create `CLAUDE.md` from plan §7.1 exactly, plus the house rules in §2 below. Create `PROGRESS.md` and `AI_LOG.md` (formats in §3).
5. Commit `chore: scaffold, CLAUDE.md, progress log` and push. Then wait for my "go" before starting M0.

---

## 2. House rules (also copy these into CLAUDE.md)

**Spec and tests**
- All thresholds live in `core/constants.js`. Never hard-code a threshold anywhere else.
- **Never edit `core/__tests__/expected.json`**, and never skip, weaken or delete a test to make it pass. If a test fails and you believe the expectation is wrong, that is a conflict: stop and ask.
- `core/flashCounter.js` and `core/areaGrid.js` are **mine**. Don't write their logic unless I explicitly say "write flashCounter" / "write areaGrid" for that session. You may write their tests, interfaces and stubs that throw `NotImplemented`.
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
- Vanilla JS and ES modules, no framework, no build step unless I approve one.
- Run `npx vitest run` after every change to `core/`, and the relevant Playwright tests after every change to `extension/` or `lab/`.

**Git**
- Work on `main`. Commit after every feature that passes its checks (roughly every 20–40 min, **never more than 45 min without a push**).
- Conventional commits: `feat(core): …`, `feat(ext): …`, `feat(lab): …`, `test: …`, `fix: …`, `docs: …`, `chore: …`. Each body ends with `Milestone: M#`.
- Never commit secrets, `.env`, `node_modules`, large binaries (> 5 MB) or failing-clip recordings. Put generated clips in `.gitignore` and regenerate them with `tools/make-clips.mjs`.
- **Never** force-push, rewrite pushed history, delete branches or tags, or change repo visibility without asking.
- Tag each finished milestone: `git tag m#-done && git push --tags`.

---

## 3. Updating me

### 3.1 After every feature (short, in chat)
```
✅ <feature> — M#
What: <one line, plain language>
Check: <tests run + result, e.g. "vitest 15/15 · e2e 6/6 · axe 0">
Pushed: <short sha> "<commit subject>"
Next: <next feature> (~<min> min)
Needs you: <nothing | what I must do or look at>
```

### 3.2 After every milestone (longer)
- What's done vs the milestone's "done when" in the plan.
- Time used vs estimate, and what that means for the cut order (plan §6).
- Anything you cut or simplified, and why.
- Updated `PROGRESS.md`, pushed and tagged.

### 3.3 Files you keep current
- `PROGRESS.md`: a table of milestones (status, time used, tag), then a "Decisions" log (date, question, my answer) and an "Open issues" list.
- `AI_LOG.md`: for each commit, what you wrote vs what I wrote or decided. Be precise and honest; this goes on Devpost.

### 3.4 Time checks
Every milestone update includes **time left until the deadline**. If you're more than 20% over a milestone's estimate, that's a conflict (§4): propose what to cut, using the plan's cut order.

---

## 4. Conflicts: when to stop and ask

**Stop, don't guess, and ask me** when any of these happens:

| # | Trigger |
|---|---|
| C1 | The plan contradicts itself, this prompt, or reality (e.g. a browser API behaves differently from what the plan assumes) |
| C2 | A test fails and the fix would change `expected.json`, a test, or a constant in `constants.js` |
| C3 | You need a dependency, permission, build step or service not already allowed |
| C4 | A spike result (M0) decides scope: readability, X/Reddit fetchability, shadow DOM, the `CALM_BRIGHTNESS` measurement, fullscreen behaviour |
| C5 | Anything touches `flashCounter.js` / `areaGrid.js` logic |
| C6 | A UX or accessibility trade-off not covered by the plan (copy, defaults, what the user sees) |
| C7 | A milestone runs > 20% over estimate, or the deadline is at risk |
| C8 | Anything destructive, public or irreversible (repo visibility, force-push, deleting files I wrote, publishing) |
| C9 | You'd need to look at or produce full-size flashing content to proceed |
| C10 | You're unsure whether something is a conflict (treat it as one) |

**How to ask** (use the AskUserQuestion tool if you have it, otherwise this format in chat):
```
⚠️ Decision needed — C# — M#
Situation: <2–3 plain sentences: what you found and why it matters>
Options:
  A) <option> — <consequence / time cost>
  B) <option> — <consequence / time cost>
  (C) <optional>
Recommendation: <A/B/C> because <one line>
While you decide I will: <work on an unrelated, unblocked task | wait>
```
Then record my answer in `PROGRESS.md › Decisions` and follow it. Don't ask the same question twice. If my answer contradicts the plan, my answer wins; note it in Decisions.

**Don't ask about** things the plan or the house rules already decide. Just follow them.

---

## 5. Milestones

Follow plan §6 for timings and §3–§5 for the detail. Before each milestone, post a 3–6 bullet plan of the features you'll build, then start without waiting unless something in it is a conflict.

| M | Name | Main work (plan section) | Done when | Needs me |
|---|---|---|---|---|
| **M0** | Spike kit | Build `spike/`: tiny extension + pages to test ① YouTube `getImageData`, ② X/Reddit GIF-video src + offscreen `fetch`, ③ shadow-root players, ④ Calm measurement via `captureVisibleTab`, ⑤ filter in fullscreen. Print results to a page and console. (§6 step 0) | Kit runs; I've run it and pasted results; `SPIKE.md` written; decisions C4 recorded | **Yes:** I run it in my real Chrome and answer C4 |
| **M1** | Spec lock | `core/constants.js` (with `CALM_BRIGHTNESS` from M0), `expected.json` drafted from §4.5 **for my review**, test harness + synthetic frame generators for all 15 cases | I've approved `expected.json`; harness runs; tests fail only for missing logic | **Yes:** approve expected.json |
| **M2** | Core engine | `luminance.js` (linear per-pixel, tile averaging), `analyzeFrames.js` (batch + streaming `push(tiles,t,rect)`), red metric, `decode/gif.js`, `decode/mp4.js`. **Stubs** for flashCounter/areaGrid, then pause for me (C5) | All tests that don't depend on my files pass; after I write mine, **15/15 green** | **Yes:** I write (or explicitly delegate) flashCounter + areaGrid |
| **M3** | Lab | `lab/index.html` (drop file → every-frame decode → chart, table, plain-language verdict, aria-live, JSON export, display-size input), `suite.html` (15 cases live), never autoplays visibly. Deploy to GitHub Pages. | Public URL works in incognito; suite all green in Chrome; axe 0 | Approve going public (C8) |
| **M4** | Extension core | Manifest, `calm.css` at document_start, discovery (+ shadow roots, iframes, MutationObserver), per-element state machine, worker live path, **pre-trip** (§3.3), dynamic content-script registration for the allowlist | Local test page: 5 Hz → Calm then confirmed; 2 Hz → released; paused video never darkened | — |
| **M5** | Pre-scan | Offscreen doc (fetch + ImageDecoder / mp4box+VideoDecoder), SW routing + `storage.session` access level, URL verdict cache, IntersectionObserver 800 px, max 3 concurrent decodes. GIF-video path only if M0 said yes | GIFs and (if in scope) GIF-videos released only after their verdict; nothing is shown at normal brightness first | — |
| **M6** | UX layer | Chips (all states in §3.4), fullscreen handling, panic shortcut (`commands`), popup (§3.6), welcome tab, caregiver lock, plain-language copy, hosted demo feed page | Every state reachable by keyboard; axe 0 on chips, popup, welcome; demo feed works | Review copy and defaults (C6) |
| **M7** | E2E + latency | Playwright with the unpacked extension: every state, axe on every surface, **pre-trip latency over 10 runs** written to README | All E2E green; latency number recorded | — |
| **M8** | Benchmark support | `benchmark.html` + a Lab "analyse a screen recording, crop to region" mode + a results table template | Tool ready. **I** run competitors and record; you analyse my recordings and fill the table | **Yes:** I record the competitors (you never view them) |
| **M9** | Ship | README (install GIF placeholder, limitations §10, suite table, latency, benchmark method), release ZIP script, Devpost draft from §9 as `DEVPOST.md`, final `/review` pass (plan §7.2 checklist), pre-submit checklist §11 | ZIP installs on a clean profile; all checks green; tag `v1.0` | Final approval before tagging |

**Order is fixed** unless I say otherwise. If you're blocked on me, work on the next unblocked feature and tell me you did.

**Cut order** (only with my OK, C7): Comfort mode → JSON export → caregiver lock → benchmark beyond 2 tools → GIF-video pre-scan.
**Never cut:** core tests, Calm Mode, suite page, honest "can't check" state, §3.5 basics, demo feed, axe-clean UI.

---

## 6. Things only I can do (ask me, don't fake them)
- Run the M0 spike in my real Chrome and report results.
- Write or approve `flashCounter.js` / `areaGrid.js`, and approve `expected.json`.
- Manual accessibility checks: NVDA/VoiceOver, 200% zoom, forced colours, the hallway test.
- Record the competitor benchmark.
- Record the demo video, and submit on Devpost.

When one of these is next, tell me exactly what to do in numbered steps, and what to paste back to you.

---

## 7. Definition of done for every feature
1. Code follows the plan section it implements (cite the section in the commit body).
2. Relevant tests pass; no test was weakened.
3. If it has UI: keyboard-operable, no animation, axe 0.
4. `PROGRESS.md` and `AI_LOG.md` updated.
5. Committed, pushed, and you sent me the §3.1 update.

Start with §1 now.
