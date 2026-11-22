# Strobeproof v2: Build Plan (EvoHacks 2.0, 10 hours, solo, built with Claude Code)

> **A flash detector you can verify.** An open WCAG 2.3.1 test suite, a benchmark of existing tools, and a browser shield built on the same engine that says plainly what it can't check.

> **Name: Strobeproof** (renamed from "Flash Guard", because "FlashGuard" is already a 2021 Melbourne Hack Chrome extension and a 2025 arXiv paper). No existing extension or Devpost project called Strobeproof was found on 22 Nov 2026. Check GitHub and Devpost once more before you create the repo.

---

## Part A: Breaking points in v1, and the fixes

Severity: 🔴 breaks the product or the pitch · 🟠 will cause wrong results or a bad demo · 🟡 polish or credibility

| # | Sev | v1 said | What breaks | v2 fix |
|---|---|---|---|---|
| A1 | 🔴 | Competitors: 4 old tools | **NeuroShield** (Chrome) already does WCAG-threshold flash detection on all sites, with a 4×4 region grid, red flash detection and sensitivity presets. **CogniShield** already smooths flashing in YouTube video. A judge finds them in 30 s. | Pitch changes to **verified + benchmark** (§1). Updated competitor table. |
| A2 | 🔴 | Name "Flash Guard" | "FlashGuard" is taken twice (see the banner above). | Renamed to **Strobeproof**. |
| A3 | 🔴 | Safe-start dim `contrast(.6) brightness(.85) saturate(.6)` | Black↔white under that filter goes from sRGB ≈0.17 to 0.68, which is relative luminance ≈0.02 to 0.42. ΔL ≈ **0.40**, four times the 0.10 threshold. The dim gives **no WCAG protection**, so the plan's main safety claim for video is false. | **Calm Mode**: `grayscale(1) brightness(0.32)`. Max output luminance ≈0.084, so **no transition can reach ΔL 0.10 at any frequency**, and grayscale makes red flashes impossible. It's provable, needs no pixel access, and works on DRM and cross-origin video (§3). Confirm the filter's colour space in the spike. |
| A4 | 🔴 | Calm Lens (WebGL EMA, α = 0.15, contrast 0.7) | 5 Hz square wave at 30 fps: the EMA still swings ≈24% of full range, and after contrast that's ΔL ≈0.16, so **still a FAIL**. At 60 fps it's worse (≈45% swing). Getting it to pass needs α ≈0.05, which leaves heavy ghost trails. It also needs readable pixels, so it can't cover the cases where help matters most. | **Cut WebGL Calm Lens.** Calm Mode (A3) replaces it: simpler, universal and provably under threshold. |
| A5 | 🔴 | "GIF pre-scan = zero exposure" is the headline | X, Reddit, Giphy and Tenor mostly serve "GIFs" as **MP4/WebP in `<video>`**. A modern attack would arrive as video, which v1 handles only reactively. | **GIF-video pre-scan**: short, muted, looping or autoplaying `<video>` with a fetchable progressive src → fetched and decoded frame by frame in the offscreen doc **before it's shown at normal brightness**. MSE/HLS streams fall back to live detection. Spike this first. |
| A6 | 🔴 | Content script at `document_idle` | GIFs and videos have **already painted and played** by then, so "zero frames" is false. | Manifest **CSS injected at `document_start`** puts all `video` and candidate animated images in Calm Mode by default. The script *releases* items once verified (`data-fg="safe"`), so there's no gap before the script runs. |
| A7 | 🔴 | flashCounter pseudocode, `direction == 0` branch | When the change is under 0.10 it resets the baseline to L, so a **gradual ramp from rest never builds up**. Test #8, the showcase case, fails on its first transition. | Track a running min *and* max until the first transition (§4.3). |
| A8 | 🟠 | Transition records `darker = min(L, lastExtreme)` when first detected | For a falling ramp detected at L = 0.85 that keeps falling to 0.40, the darker side is stored as 0.85 (≥ 0.80), so the flash is **wrongly ignored**. | Keep updating the open transition's darker value while the extreme keeps extending. |
| A9 | 🟠 | "> 3 flashes" not defined in transitions | 3.5 Hz, half-flashes and window edges are ambiguous, so tests can pass or fail depending on phase. | Flash = 2 opposing transitions. **FAIL if ≥ 7 transitions in any half-open window (t−1 s, t]**, i.e. more than 3 flashes. Add boundary tests at 3 Hz (pass) and 3.5 Hz (fail). |
| A10 | 🟠 | Lab decodes video by seeking in 1/30 s steps | **Aliasing**: a 30 Hz strobe sampled at 30 fps looks constant, so it gets a false PASS. A safety tool must never do this. | MP4: **mp4box.js + WebCodecs `VideoDecoder`**, decoding every frame with exact timestamps. Other formats: rVFC playback with a check on `presentedFrames`; any gap is reported as "incomplete analysis", never PASS. |
| A11 | 🟠 | Test clips made with canvas + MediaRecorder | MediaRecorder timestamps vary and it drops frames, so the clips aren't trustworthy ground truth. | Ground truth = **synthetic frame arrays in Vitest** (no encoding at all). Demo and E2E clips come from **ffmpeg** at a constant frame rate, falling back to MediaRecorder with a stated caveat. |
| A12 | 🟠 | Downscale 64×36 with `drawImage`, then average | `drawImage` averages gamma-encoded sRGB, which underestimates luminance swings in partly flashing tiles. | Sample at **128×72**, convert each pixel to linear luminance in the worker, *then* average into tiles (32×18). About 9k pixels per frame, still trivial. |
| A13 | 🟠 | Area: "341×256 px" | Easy to misread. 341×256 is the **10° field**. The limit is **25% of it ≈ 21,800 px²** (at 1024×768 reference, scaled by `innerWidth/1024`). Lab results also depend on the assumed display size. | Constants spelled out in §4.1. The Lab has a "display size" input (default: native size). The extension re-checks area on resize and fullscreen. |
| A14 | 🟠 | Overlay `div` over the video | **Fullscreen** shows only the fullscreen element, so the overlay disappears. **Shadow DOM** players (Reddit's `shreddit-player`, many custom players) are invisible to `querySelectorAll` and `MutationObserver`. | All protective states are **CSS filters on the media element itself**, which survive fullscreen. UI chips are inserted into `document.fullscreenElement` when needed. Walk shadow roots with `chrome.dom.openOrClosedShadowRoot()` and observe each one. |
| A15 | 🟠 | Verdict cache in `chrome.storage.session` | Content scripts **can't access** `storage.session` by default. | Call `chrome.storage.session.setAccessLevel({accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'})` in the SW, or route cache reads through the SW. |
| A16 | 🟠 | SW fetches bytes → offscreen decodes | `runtime.sendMessage` JSON-serialises messages, so ArrayBuffers don't transfer cleanly. `ImageDecoder` isn't available in service workers. | **The offscreen doc fetches and decodes itself.** Extension pages have host permissions, so page CORS doesn't apply. The SW only creates the offscreen doc and routes small JSON verdicts. Offscreen reason: `WORKERS`. |
| A17 | 🟠 | Reactive detection exposes the user for "up to ~1 s" | That's still more than 3 flashes on screen before the block. | **Pre-trip**: switch to Calm Mode at **4 transitions** (2 flashes), which is still compliant, and only show the "confirmed" UI at ≥ 7. That leaves 3 transitions of slack to cover worker latency. **Measure the latency in E2E** and publish the number (§3.3). |
| A18 | 🟡 | `tabCapture` "Check this tab" | 1–2 hours of offscreen stream plumbing for a rare case. | **Cut.** Calm Mode already makes unreadable media safe to watch. Fewer permissions is also a plus. |
| A19 | 🟡 | Rubric self-scores of 5/5 | Overconfident if a judge sees it. | Replaced with "where each criterion is earned" (§1.3). |
| A20 | 🟡 | Unverified facts (Eichenwald seizure length, Epilepsy Blocker "Aug 2019", PhotosensitivityPal "GIFs and videos", 1 in 4,000) | A wrong fact in a safety pitch costs trust. | Verified items marked ✓ in §1.2. Each ⚠ item needs a primary source before it goes on Devpost or in the video. |
| A21 | 🟡 | "Write flashCounter yourself" + an hour-by-hour plan built around typing speed | With Claude Code, coding stops being the bottleneck. Browser spikes, manual a11y testing, the benchmark and the video don't speed up. | Schedule rebuilt (§6). You still **own and can explain** `flashCounter` and `areaGrid` (§7). |
| A23 | 🔴 | UX treated as a polish pass at hour 7:45 | UX and accessibility are what judges will *feel*. Darkening every video, chips on everything, jargon ("WCAG", "luminance") and install friction would sink the experience even if the detection is perfect. | New **§3.5**: release paused videos immediately, no chip on safe items, panic shortcut, plain-language copy, welcome tab, caregiver lock, hosted demo feed, axe-core + hallway test. Has its own hour in the schedule. |
| A22 | 🟡 | Developer exposure while building | You'd be watching strobe clips for hours. | Test pages render clips at ≤160 px and in Calm Mode by default. E2E is automated (Playwright), so you rarely have to look. If you or anyone nearby is photosensitive, don't view failing clips at all. |

---

## 1. Pitch, competitors, rubric

### 1.1 One-sentence pitch
**"Every flash blocker says it follows WCAG. Strobeproof is the one that proves it: an open known-answer test suite, a benchmark of existing tools, and a shield whose Calm Mode stays below the WCAG flash threshold by construction, even on video it can't read."**

### 1.2 Competitors (name all of them on Devpost)

| Tool | What it does | Gap you fill | Verified |
|---|---|---|---|
| **NeuroShield** (Chrome) | WCAG-threshold flash detection on all sites, 4×4 region grid, red flash, sensitivity presets, runs at `document_start`, CSS-filter fallback for cross-origin video, accessible overlay with Dim (30%) / Pause / Continue | **Your closest rival, and its UX is already decent.** Gaps: dimming happens *after* detection, not by default; no public evidence of correctness on the hard cases (ramps, scene cuts, small area, VFR); no proof its dim stays under threshold | ✓ store listing |
| **CalmWeb** (Firefox, 2026) | Motion reduction, autoplay control, GIF freezing, page dimming when rapid brightness changes are detected, audio limiting | Firefox only; broad comfort tool; describes flash dimming as best-effort | ✓ AMO listing |
| **CogniShield** (Chrome) | Flash/flicker guard + blue-light filter, YouTube only | YouTube only; no published thresholds or tests | ✓ store listing |
| **Epilepsy Blocker** (Firefox) | Blocks risky animated GIFs | GIFs only; ~70 users | ✓ users · ⚠ last-update date |
| **PhotosensitivityPal** (Chrome) | Detects and blocks risky GIFs | GIFs only, block-only | ✓ listing says GIFs |
| **Photosensitivity Video Blocker** (Chrome, ~700 users) | Pauses animated images and blocks video playback until clicked several times | No analysis; pauses everything | ✓ listing |
| **Seizafe** (Chrome) | Warns before flashing scenes on YouTube | YouTube only; last listed update 2020 | ✓ listing |
| **Flikcer** (paper + extension, 2021) | Real-time luminance-frequency analysis of video | Research prototype | ✓ arXiv |
| **EPI-LENS** (open source) | Browser tool exporting temporal/spectral video metrics, "open-source PEAT" | Analysis tool, not protection; no known-answer suite | ✓ GitHub |
| **PEAT** (Trace Center) | Desktop analyzer for developers | Explicitly not for day-to-day screening by people with PSE | ✓ Trace |

**Your three differences (say these exact three):**
1. **Verified**: 14 known-answer tests plus a published benchmark of the tools above.
2. **Calm Mode by default**: anything unchecked starts below the threshold *by construction* (with the number shown and tested), on any video including DRM and cross-origin. NeuroShield has a similar 30% dim, but only after it detects flashing. Strobeproof's applies before checking, and its safety is proven by test #15.
3. **Zero exposure at normal brightness for GIFs and GIF-style videos**: pre-scanned before release (if the spike confirms it for X/Reddit).

### 1.3 Problem evidence (verify each ⚠ before using it)
- 2016: a strobing GIF sent to journalist Kurt Eichenwald caused a seizure; the sender was criminally charged. ⚠ seizure duration.
- Nov 2019 and May 2020: Epilepsy Foundation and Epilepsy Society followers were deliberately sent strobing GIFs. ⚠ dates and outcomes from the primary sources.
- ✓ Prevalence: photosensitive epilepsy affects about 1 in 4,000 people, 3–5% of people with epilepsy (Epilepsy Society, https://www.epilepsy.org.uk/?p=1833).

### 1.4 Where each rubric criterion is earned
| Criterion | Earned by |
|---|---|
| Fit to prompt | A safety tool for a specific, documented harm |
| Problem & impact | Real attacks + the benchmark showing gaps in existing tools |
| Technical depth | Spec-exact counter, every-frame WebCodecs decoding, pre-trip latency measurement, MV3 offscreen pre-scan, shadow DOM and fullscreen handling |
| Usability & accessibility | No-animation UI, honest states, keyboard and screen reader, Calm Mode instead of hard blocking |
| Appropriate use of tech | Deterministic implementation of a published spec; AI would be the wrong tool for a pass/fail safety check |

---

## 2. Surfaces

1. **Lab** (live URL, zero install): drop a file → every-frame analysis → timeline, verdict, worst-second stats, JSON export. Also hosts the **Test Suite** page (the 14 cases, expected vs actual) and the **Benchmark** page.
2. **Extension** (protection): content script, SW, offscreen doc, popup.
3. **Clip generator** (`tools/make-clips.mjs`): ffmpeg-based, constant frame rate, for E2E and benchmark pages.

**One engine, three consumers:** `core/` is pure functions used by Vitest, the Lab and the extension's worker and offscreen doc.

---

## 3. Protection model

### 3.1 The rule: unchecked = Calm
- **Calm Mode** = `filter: grayscale(1) brightness(0.32) !important` on the media element.
  - White → sRGB 0.32 → relative luminance ≈ **0.084**. Every possible transition is < 0.10, so nothing on screen meets WCAG's definition of a flash at any frequency or area. Grayscale removes saturated red, so red flashes can't happen either.
  - The brightness constant depends on whether Chrome applies CSS filter functions in sRGB (expected) or linear light (then you'd need ≈ 0.084). **Measure it in the spike** (§6, step 0). Put the measured value in `core/constants.js`.
  - Needs no pixel access, so it works on cross-origin, MSE and DRM video and survives fullscreen.
  - Limitation: HDR content on HDR displays can go above SDR white. State it.
- Default CSS (manifest `css`, `run_at: document_start`):
  ```css
  video:not([data-fg="safe"]):not([data-fg="allow"]),
  img:is([src*=".gif" i],[src*=".webp" i],[srcset*=".gif" i],[srcset*=".webp" i]):not([data-fg="safe"]):not([data-fg="allow"]) {
    filter: grayscale(1) brightness(0.32) !important;
  }
  ```
- Allowlisted sites: register content scripts dynamically (`chrome.scripting.registerContentScripts` with `excludeMatches`) so allowlisted pages never get the CSS.

### 3.2 Per-media paths
| Media | Path | Exposure at normal brightness |
|---|---|---|
| `<img>` GIF / animated WebP / APNG-by-URL | Offscreen fetch → `ImageDecoder` every frame + durations → `analyzeFrames` → release or keep Calm | **Zero** (pre-scanned) |
| Short muted looping/autoplay `<video>` with http(s) src (≤ 30 s, ≤ 15 MB) | Offscreen fetch → mp4box.js demux → `VideoDecoder` every frame → verdict → release | **Zero**, if the spike shows the CDN is fetchable |
| Other readable `<video>` (incl. YouTube MSE if readable) | Calm for first 2 s of scanned playback → release → live detection with **pre-trip** | ≤ 3 transitions of slack; latency measured (§3.3) |
| Unreadable (`SecurityError`), DRM (`mediaKeys !== null`), `<canvas>` | Stay in Calm; chip "Can't check this one, shown in Calm Mode" + [Play normally] | Zero unless the user opts out |
| CSS background GIFs, CSS/JS animations, `<canvas>` games | Not covered | State in Limitations |

### 3.3 Live detection with pre-trip
- rVFC on the *original* video (the filter doesn't affect `drawImage`), so detection keeps seeing true pixels while the user sees Calm.
- Use `metadata.mediaTime` for timestamps. If `metadata.presentedFrames` skips, mark the window "uncertain" and pre-trip to Calm.
- **≥ 4 transitions in (t−1, t] in any area-qualifying region → Calm** (still compliant: 2 flashes).
- **≥ 7 → confirmed FAIL**: Calm sticks for this element; non-animated chip "Flashing detected, Calm Mode on" with [Keep Calm] (default focus) · [Show original] · [Always allow this site].
- Pre-trip without confirmation → back to normal after 3 s with no transitions.
- **Publish the number**: in E2E, measure ms from the clip's 4th transition timestamp to the `data-fg` change. Claim "switches within X ms (worst of N runs)". Don't claim zero.

### 3.4 States (what the user sees, what the screen reader hears)
| State | Visual | `aria-live="polite"` |
|---|---|---|
| Checking | Calm; small static chip "Checking…" (no spinner) | silent |
| Safe | Normal; chip removed (no fade animation) | silent |
| Pre-tripped | Calm; chip "Calmed" | silent (it may flip back) |
| Confirmed risky | Calm sticks; chip with 3 buttons | "Flashing detected. 5 flashes per second. Calm Mode is on." |
| Can't check | Calm; chip + [Play normally] | "Couldn't check this video. Showing it in Calm Mode." |
| Overridden | Normal; chip [Undo] | "Showing original. Press Escape to return to Calm Mode." |
| Hide mode (setting) | `brightness(0)` + pause | "Flashing content hidden." |

UI rules: no animation of any kind, 44×44 targets, visible focus, Tab/Enter/Esc. [Show original] asks once: "This clip flashes about 5 times per second. Show it anyway?" Muted slate palette, no red.

### 3.5 UX and accessibility: the main thing judges will feel

The test: **someone installs it, never opens settings, and their browsing still feels normal, but safer.** Everything below serves that.

**Calm by default must not feel like a broken page**
- Paused, non-autoplay videos are **released right away** (the poster shows normally). Calm only starts on the `play` event and lasts until the first ~2 s are scanned. Most videos the user sees are never darkened at all.
- Verdicts are cached by URL, so a GIF seen once is never re-checked or re-darkened on scroll-back or revisit.
- GIF pre-scan starts 800 px before the image scrolls into view (IntersectionObserver), so most images are already released when they appear.
- Never more than **one chip per media item**, top-left, small, static. Safe items get no chip. Silence is the success state.

**Zero-setup start**
- Works the moment it's installed, with no account, no settings and no permissions prompt beyond install.
- A one-screen **welcome tab** after install: what it does in 2 sentences, what Calm Mode looks like (a static before/after image), one keyboard shortcut, and a link to the Limitations. A single [Got it] button. Fully keyboard- and screen-reader-operable.
- Plain language everywhere (reading level around grade 6): "Calmed", "Can't check this one", "Show original". No "WCAG", "luminance" or "transition" in the extension UI. Those belong in the Lab.

**Control the user can reach in one step**
- Keyboard shortcut (`commands` in the manifest, e.g. `Alt+Shift+F`): **Calm everything on this page now.** This is the panic button. Pressing it again restores.
- Every chip button is reachable with Tab. Esc always means "back to safe".
- Undo is always one action away, and an override lasts only for that item and that page, unless the user picks "Always allow this site".
- The popup's first control is the big on/off, then "Calm this page now". Settings come after.

**Accessible to the people who'll actually use it**
- Screen reader: polite announcements only for events the user must act on (confirmed risky, can't check, overridden). Nothing for checking/safe, so the feed stays quiet.
- Low vision: chips and popup at least 16 px text, at least 4.5:1 contrast, still usable at 200% zoom, and they respect forced-colors / Windows High Contrast.
- Motion: there are no animations anywhere, so there's nothing to turn off. Also honour `prefers-reduced-motion` and `prefers-contrast` for completeness.
- Cognitive: one decision at a time. The risky-content chip offers exactly three choices with a safe default focused.
- Caregivers: popup option to **lock settings behind a confirm step**, so a parent can set it up for a child and the child can't override it with one click. Plain "Show original" still needs a confirmation in this mode.

**Easy to get**
- Chrome Web Store review takes days, so for the hackathon: a **release ZIP + a 3-step "Load unpacked" GIF** in the README, plus a **hosted demo feed page** judges can open after installing to see every state without hunting for real flashing content.
- The **Lab needs no install at all** and is the first link on Devpost. It should be usable by a content creator with no technical background: drop a file, get a big "Safe to post" or "Flashes too fast at 0:12–0:13" in plain words, with the chart below for those who want it.
- Chromium only (Chrome, Edge, Brave). Say so up front rather than letting Firefox users find out after installing.

**Prove it, don't just claim it**
- **axe-core in Playwright** on the popup, welcome tab, chips and Lab: zero violations, screenshot in the README.
- A 15-minute **hallway test** with 2–3 people (not photosensitive, never shown failing clips): give them tasks ("make this video normal again", "stop it from calming this site", "calm everything on this page") with keyboard only, and note where they got stuck. Fix the top issue. Put one sentence about it on Devpost.

### 3.6 Popup
- Protection: **Strict (WCAG 2.3.1)** / **Comfort** (pre-trip at 2 transitions, fail at ≥ 5; clearly labelled "not a medical standard").
- On confirmed risk: Calm (default) / Hide.
- "Freeze all GIFs" (first frame only).
- Allowlist with remove buttons; "items calmed today" counter.
- Footer: "Reduces exposure to flashing above WCAG 2.3.1 thresholds. Not a medical device. Can't catch everything." + link to Limitations.

---

## 4. The math

### 4.1 Constants (`core/constants.js`, the only place they live)
```
LUM_DELTA         = 0.10    // opposing change must be ≥ this
DARKER_MAX        = 0.80    // darker state must be < this
RED_RATIO         = 0.80    // R/(R+G+B) ≥ this = saturated red
RED_DELTA         = 20      // change in max(0,(R−G−B))×320 must be > this
FAIL_TRANSITIONS  = 7       // ≥7 transitions in (t−1s, t] = >3 flashes
PRETRIP_TRANS     = 4       // extension only
WINDOW_S          = 1.0
FIELD_10DEG_PX    = 341*256 // at 1024×768 reference
AREA_LIMIT_PX     = 0.25 * FIELD_10DEG_PX   // ≈ 21,824 px² (scale by (innerWidth/1024)²)
CALM_BRIGHTNESS   = 0.32    // ⚠ set from spike measurement
SAMPLE_W, SAMPLE_H = 128, 72;  TILES_X, TILES_Y = 32, 18
```
Check each one against the W3C *Understanding SC 2.3.1* page and write the URL in a comment.

### 4.2 Luminance
Per pixel: sRGB 0–1 → linear (`c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`) → `L = 0.2126R + 0.7152G + 0.0722B`. **Average linear L per tile** (not the luminance of averaged sRGB).

### 4.3 flashCounter: corrected pseudocode (you own this file)
```
per tile: state = 'rest' | 'up' | 'down'
          lo, hi           # running min/max while at rest
          extreme          # running extreme of the current move
          open             # the newest transition {t, darkerL}
          transitions      # queue of {t, darkerL}

push(L, t):
  if state == 'rest':
     lo = min(lo, L); hi = max(hi, L)
     if L - lo >= Δ:  begin('up',   t, darker=lo, extreme=L)     # ★ ramp from rest
     elif hi - L >= Δ: begin('down', t, darker=L,  extreme=L)
  elif state == 'up':
     if L > extreme: extreme = L                                  # ★ extend, don't re-trigger
     elif extreme - L >= Δ: begin('down', t, darker=L, extreme=L)
  elif state == 'down':
     if L < extreme: extreme = L; open.darkerL = L                # ★ darker keeps falling (A8)
     elif L - extreme >= Δ: begin('up', t, darker=extreme, extreme=L)

  drop transitions with t_i <= t - 1.0                            # half-open window
  count only transitions whose darkerL < 0.80
  return count                                                    # FAIL if ≥ 7
```
Red flash: the same machine running on the red metric with its own Δ (> 20), counting only frames where the tile is saturated red.

**Walkthrough (30 s):** the three ★ lines. Rest tracks min and max, so a slow ramp from rest still counts. Moves extend their extreme rather than re-triggering. The darker side keeps updating, so a fall that starts above 0.80 still qualifies once it drops below.

### 4.4 Area (`areaGrid.js`, you own this file)
- A tile is "flashing" at time t if its count ≥ 7 (or ≥ 4 for pre-trip).
- Convert tile area to on-screen CSS px using the element's current `getBoundingClientRect()`, scaled to the 1024-wide reference.
- Slide a 341×256 (scaled) window over the flashing-tile mask using a summed-area table. FAIL if any window holds > AREA_LIMIT_PX of flashing area. If the media is smaller than the window, the whole media fits in one window.
- Recompute on resize and fullscreen. The tile counts don't change, only the area does.

### 4.5 Known-answer tests (frame arrays in Vitest, no encoding)
| # | Case | Expected |
|---|---|---|
| 1 | Full-frame black↔white 2 Hz | PASS |
| 2 | Full-frame black↔white 5 Hz | **FAIL general** |
| 3 | **3 Hz exactly (6 transitions/s), several phase offsets** | PASS (boundary) |
| 4 | **3.5 Hz (7 transitions/s)** | **FAIL** (boundary) |
| 5 | 5 Hz, ΔL = 0.06 | PASS |
| 6 | 5 Hz between L = 0.85 and 1.0 | PASS (darker ≥ 0.80) |
| 7 | 5 Hz box, area below limit at stated display size | PASS |
| 8 | Same box, area above limit | **FAIL general** |
| 9 | Red↔black 5 Hz | **FAIL red** |
| 10 | 60 fps ramp strobe at 5 Hz, **starting from rest** | **FAIL** (A7) |
| 11 | Falling ramp 1.0 → 0.4 that crosses Δ above 0.80 | counted (A8) |
| 12 | Single hard cut black→white; fade to white over 2 s | PASS |
| 13 | Fine checkerboard inversion 10 Hz | PASS (pattern averages out) |
| 14 | Case 2 with random dropped frames / VFR timestamps | FAIL (same verdict as #2) |
| 15 | **Calm Mode applied to case 2** (simulate `CALM_BRIGHTNESS` on frames) | PASS: proves Calm Mode |

Lock the expected values in `core/__tests__/expected.json`. Claude Code may not edit that file (§7).

---

## 5. Architecture

```
strobeproof/
├── CLAUDE.md                     # rules for Claude Code (§7)
├── core/                         # pure JS, no DOM
│   ├── constants.js              # §4.1, the only home of thresholds
│   ├── luminance.js
│   ├── flashCounter.js           # ★ yours
│   ├── areaGrid.js               # ★ yours
│   ├── analyzeFrames.js          # batch: frames[] → report; streaming: push(tiles, t, rect)
│   ├── decode/                   # shared by Lab + offscreen
│   │   ├── gif.js                # ImageDecoder, every frame + duration
│   │   └── mp4.js                # mp4box.js + VideoDecoder, every frame
│   └── __tests__/                # Vitest, expected.json (locked)
├── extension/
│   ├── manifest.json             # MV3: storage, offscreen, scripting; host_permissions <all_urls>
│   ├── calm.css                  # document_start default-Calm rules
│   ├── content.js                # discovery (+shadow roots), state machine, rVFC, chips
│   ├── worker.js                 # OffscreenCanvas 128×72 → linear tiles → core streaming
│   ├── sw.js                     # offscreen lifecycle, routing, storage.session access level
│   ├── offscreen.html/.js        # fetch + decode + analyzeFrames (reason: WORKERS)
│   └── popup.html/.js
├── lab/                          # GitHub Pages / Vercel
│   ├── index.html                # analyze a file
│   ├── suite.html                # 15 cases, expected vs actual, run live in browser
│   └── benchmark.html            # competitor results table + method
├── tools/make-clips.mjs          # ffmpeg CFR clips + test pages (clips ≤160 px)
├── e2e/                          # Playwright: load unpacked, assert states, measure pre-trip latency
└── README.md
```

---

## 6. Ten-hour schedule (Claude Code)

The coding blocks shrink. Spikes, real-browser checks, the benchmark and the video stay at human speed.

| Time | Block | Done when |
|---|---|---|
| **0:00–0:50** | **Spike (you, in a real Chrome):** ① Is a YouTube video readable with `getImageData` from a content script? ② On X and Reddit, are "GIFs" `<video>` with a progressive https src, and does an extension page `fetch()` it? ③ Is the Reddit player in a shadow root? ④ **Measure Calm**: white div with `grayscale(1) brightness(0.32)` → `chrome.tabs.captureVisibleTab` → read the pixel (expect ≈ 82/255 if the filter works in sRGB). ⑤ Does the filter persist when the video is fullscreened? | A short `SPIKE.md` with answers. Decide the GIF-video headline (keep or drop) and `CALM_BRIGHTNESS`. |
| 0:50–1:05 | Repo + `CLAUDE.md` + `constants.js` + `expected.json` (you write the last two). | Locked spec in the repo. |
| 1:05–2:20 | **core/**: Claude Code writes luminance, decode, analyzeFrames and the test harness; **you write flashCounter + areaGrid** (or write them with Claude Code pair-style, then annotate every line yourself). | All 15 tests green. |
| 2:20–3:20 | **Lab**: analyze page (every-frame decode, chart, table, aria-live verdict, JSON), suite page. Deploy. | Public URL; suite page all green in Chrome. |
| 3:20–5:20 | **Extension**: calm.css, discovery + shadow roots + iframes, state machine, worker live path + pre-trip, offscreen pre-scan (GIF, then GIF-video), chips, fullscreen, popup, allowlist. | Local test page: 5 Hz clip → Calm/confirmed; 2 Hz → released; cross-origin clip → "Can't check". |
| 5:20–6:00 | **E2E (Playwright, extension loaded)**: every state reachable; pre-trip latency over 10 runs. | Latency number in README. |
| 6:00–6:45 | **Benchmark (2 tools minimum)**: separate Chrome profile per competitor; serve the same test page; screen-record at 60 fps (OBS); analyse each recording in the Lab, cropped to the clip region. **Don't watch**: lower the hardware brightness and look away. Record tool versions and the date. | `benchmark.html` table: per case, did above-threshold flashing reach the screen? |
| 6:45–7:45 | **UX and accessibility (§3.5)**: welcome tab, panic shortcut, plain-language copy, caregiver lock, hosted demo feed. axe-core in Playwright. Then **you**: keyboard-only run, NVDA/VoiceOver, 200% zoom, forced colors, and a 15-min hallway test with 2–3 people. | Zero axe violations; whole flow without a mouse; top hallway-test issue fixed. |
| 7:45–8:20 | README (install GIF, limitations, test table, latency, benchmark method), release ZIP, `/review` pass with Claude Code. | Clean-profile install works. |
| 8:20–9:20 | Video (§8). | ≤ 3:00 exported. |
| 9:20–10:00 | Devpost (§9), final checks (§10). | Submitted with 15 min spare. |

**Cut order:** Comfort mode → JSON export → caregiver lock → benchmark beyond 2 competitors → GIF-video pre-scan (keep GIF).
**Never cut:** core tests, Calm Mode, suite page, honest "can't check" state, the §3.5 basics (release paused videos, one chip max, panic shortcut, keyboard + screen reader, axe clean), the hosted demo feed, a 2-tool benchmark.

---

## 7. Working with Claude Code

### 7.1 `CLAUDE.md` (put this in the repo root)
```
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
```

### 7.2 How to drive each block
- Start each block in **plan mode** and paste the matching section of this doc (e.g. §3.2–3.4 for the extension). Approve the plan, then let it build.
- For core/: ask for **tests first** from `expected.json`, see them fail, then implement.
- For the extension: ask Claude Code to build the **Playwright harness early** (`chromium.launchPersistentContext` with `--load-extension`), so it can check its own work against the test page instead of you watching clips.
- Final pass: "Review for MV3 permission minimality, observer/worker/ImageDecoder/VideoDecoder leaks (`close()`), SW restarts, offscreen doc lifecycle, shadow-root and fullscreen paths, keyboard and screen reader in chips and popup. List bugs with file:line. Don't rewrite."

### 7.3 Ownership and the AI policy
- Read EvoHacks 2.0's AI-use rules before you start. If they require a declared split, keep a running `AI_LOG.md`.
- What you can honestly claim as yours: the spec interpretation (constants, transition definition, pre-trip design, Calm Mode math), `flashCounter.js`, `areaGrid.js`, `expected.json`, the benchmark method, all spike findings.
- Be able to explain every ★ line and the Calm Mode number (0.32 → 0.084) without notes.

---

## 8. Three-minute video

| Time | On screen | Say |
|---|---|---|
| 0:00–0:05 | Static card: "This video discusses flashing content. No unmasked flashing is shown." | (read it) |
| 0:05–0:20 | Static headlines (sourced) | "People with photosensitive epilepsy have been deliberately attacked with strobing GIFs. Several browser tools try to block these. None show you they work." |
| 0:20–0:45 | Lab **suite page**: 15 rows, ramps and boundary cases, all green | "So I built a test suite first: fifteen known-answer cases, including the ones naive detectors get wrong." |
| 0:45–1:10 | **Benchmark table** (results only, no clips) | "Then I ran existing tools against it. Here's what reached the screen." (state the facts neutrally) |
| 1:10–1:40 | Fake feed: GIF-video tile stays calm grey → released; risky one stays calm with chip | "Strobeproof checks short videos and GIFs before they're shown at full brightness. Anything it hasn't checked runs in Calm Mode, which stays below the WCAG flash threshold by construction." |
| 1:40–2:10 | Install → welcome tab → normal feed with **no chips at all** on safe items; cross-origin video "Can't check, shown in Calm Mode"; keyboard-only Tab through a chip; panic shortcut calms the page; screen-reader caption | "You install it and forget it. Safe things look normal, it tells you when it can't check something, one shortcut calms the whole page, and every control works by keyboard and screen reader. The UI never animates." |
| 2:10–2:35 | `flashCounter.js`, ★ lines; the 0.32 → 0.084 calculation | (own-code walkthrough) |
| 2:35–3:00 | Limitations + architecture | "It can't see canvas games or CSS animations, and it isn't a medical device. No AI: this is a published safety spec, so it should be deterministic." |

Never show a failing clip unmasked. Devpost thumbnail is a static screenshot.

---

## 9. Devpost skeleton
1. What it does (the §1.1 sentence).
2. The problem (sourced attacks + prevalence).
3. Prior art: the §1.2 table, honestly.
4. What's new: verified suite, benchmark, Calm Mode, GIF/GIF-video pre-scan.
5. How it works: one engine / three consumers diagram; the protection paths table (§3.2).
6. The math: constants with the W3C link; transition rule; Calm Mode proof.
7. Proof: suite table, benchmark table + method, measured pre-trip latency.
8. Accessibility of the tool itself: states table.
9. Why no AI.
10. Limitations.
11. What I wrote vs what Claude Code wrote.

## 10. Limitations (state all of these)
- Not covered: `<canvas>`/WebGL games, CSS/JS animations of page elements, CSS background GIFs, animated PNGs whose URL doesn't look animated, spatial pattern (stripe) hazards.
- Live video: a short, measured switch latency after the 4th transition. Pre-scanned GIFs/GIF-videos: no exposure at normal brightness.
- Unreadable and DRM video can't be analysed. They run in Calm Mode unless the user opts out.
- HDR on HDR displays can exceed Calm Mode's bound.
- Thresholds follow WCAG reference viewing conditions; real risk varies by person, screen size and distance.
- Validated only against the spec with synthetic ground truth; not tested with people who have epilepsy, and must not be.
- Benchmark reflects specific tool versions on a specific date, judged by this project's own analyzer (method published).

## 11. Pre-submit checklist
- [ ] Final check that "Strobeproof" is still unused on Devpost / Web Store / GitHub
- [ ] Every ⚠ fact sourced or removed
- [ ] `CALM_BRIGHTNESS` set from the spike measurement; test #15 green
- [ ] Lab URL works in incognito; suite page all green
- [ ] Release ZIP installs on a clean Chrome profile
- [ ] Pre-trip latency number and benchmark method in README
- [ ] Video ≤ 3:00, warning card first, no unmasked flashing, own-code segment
- [ ] Wording says "reduces exposure" everywhere, never "prevents seizures"

## Sources
- W3C, Understanding SC 2.3.1: https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
- NYU Digital Accessibility, SC 2.3.1 (341×256 field): https://digitalaccessibility.nyu.edu/testing/sc231.html
- NeuroShield: https://chromewebstore.google.com/detail/neuroshield/dbmdhjhmfmdnohcphcmdlfaiipdoldfk
- CogniShield: https://chromewebstore.google.com/detail/kmengpakcdmpcliojljfepdokneehmdn
- FlashGuard (Melbourne Hack 2021): https://chromewebstore.google.com/detail/flashguard/hfokofogmejaehelinjhgnkcooojhdgf
- FlashGuard paper (arXiv 2507.19692): https://arxiv.org/abs/2507.19692v1
- Flikcer (arXiv 2108.09491): https://arxiv.org/pdf/2108.09491
- EPI-LENS: https://github.com/pi-0r-tau/epi-lens
- Epilepsy Blocker: https://addons.mozilla.org/firefox/addon/epilepsy-blocker/
- PhotosensitivityPal: https://chrome.google.com/webstore/detail/photosensitivitypal/jfbeiilmcgaofgkhkbdepkafoikbmklh
- Photosensitivity Video Blocker: https://chrome.google.com/webstore/detail/photosensitivity-video-bl/epmpnnakndnajenpfacadlkbfinbamdk
- Seizafe: https://chrome.google.com/webstore/detail/goageegpmdbgenkgkhfhnnjmgmgboegi
- PEAT (Trace Center): https://trace.umd.edu/?p=719
- MDN ImageDecoder: https://developer.mozilla.org/docs/Web/API/ImageDecoder
- MDN VideoDecoder: https://developer.mozilla.org/docs/Web/API/VideoDecoder
- Chrome offscreen API: https://developer.chrome.com/docs/extensions/reference/api/offscreen
- Chrome storage.session access level: https://developer.chrome.com/docs/extensions/reference/api/storage
- Attack coverage (verify before citing): TIME https://time.com/5752038/epilepsy-foundation-cyberattack-cause-seizures · Epilepsy Society https://epilepsysociety.org.uk/node/3414
