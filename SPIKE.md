# M0 spike results

Run: `node spike/auto.mjs` (Playwright, Microsoft Edge 158 / Chromium engine, headless, spike extension loaded), 2026-11-22.
Raw output: `spike/results.json` (gitignored; regenerate with the command above).

> Why Edge: Google Chrome 137+ ignores `--load-extension`, and Playwright's bundled Chromium is blocked from starting on this machine
> (unsigned binary). Edge is the same Chromium engine and is signed. Spot-check in real Chrome with the manual kit (below).

| # | Question | Answer | Evidence | Decision |
|---|---|---|---|---|
| ④ | Does `grayscale(1) brightness(0.32)` work in sRGB space? | **Yes.** White → **82/255** (expected 82 for sRGB, 153 for linear). Relative luminance **0.0844**. Red → 17, grey 128 → 41. Same result from `captureVisibleTab` and from a plain page screenshot. | `probes.calm`, `probes.calmScreenshotCrossCheck` | `CALM_BRIGHTNESS = 0.32` confirmed. Max ΔL under Calm = 0.0844 < 0.10. |
| ⑤ | Does the filter survive fullscreen of the `<video>` itself? | **Yes.** In fullscreen the computed filter is unchanged and the centre pixel is 82/255. | `probes.fullscreen` | Protective states stay as CSS filters on the media element (plan A14). |
| ① | Is a YouTube video readable with `getImageData` from a content script? | **Yes.** `blob:` (MSE) `currentSrc`, no MediaKeys, `drawImage` + `getImageData` succeeded (no `SecurityError`). | `probes.youtube` | YouTube goes through the live path (warm-up Calm → release → pre-trip). |
| ② | X / Reddit: are "GIFs" `<video>` with a progressive https src, and can an extension page `fetch()` them? | **Not answered automatically.** Reddit served a bot check ("Prove your humanity"); X refused the automated request (`ERR_HTTP_RESPONSE_CODE_FAILURE`). **Giphy**: GIFs are served as animated **WebP** in `<img>`, and the offscreen doc fetched them cross-origin with `Range: bytes=0-1023` → **206** + `RIFF…WEBP` magic. | `probes.reddit`, `probes.x`, `probes.giphy` | Needs the human run in real Chrome (below). Range requests work on a major GIF CDN, which supports the 32-byte WebP header check. |
| ③ | Is the Reddit player in a shadow root? | **Not answered** (bot wall). YouTube: no shadow roots around `<video>`. | – | Build shadow-root walking anyway (plan A14); confirm on Reddit manually. |

## Still needed from the human (real Chrome, signed in as usual)

1. `chrome://extensions` → Developer mode → **Load unpacked** → pick `spike/extension`.
2. Open a Reddit post with a GIF or short video (e.g. from r/gifs), let it play, click the extension icon → **Probe this tab** → **Copy results** → paste in chat.
3. Do the same on an X post that has a GIF.
4. (Optional) Repeat ① on YouTube and ④/⑤ via **Open Calm + fullscreen test** to confirm Chrome matches Edge.

What to look for: `srcKind` ("progressive http(s)" vs "blob (MSE)"), `inShadow` / `hostPath`, and in `extensionFetch` a 200/206 status.
