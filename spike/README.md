# Strobeproof M0 spike kit

Developer-only Chrome extension. It answers the five spike questions in plan §6 step 0. It is **not** the product and is not published.

It shows no flashing content. The only test visuals are static patches on `calm.html`, and the page you test is whatever you open yourself.

## Load it (once)

1. Open `chrome://extensions` in your real Chrome (not the built-in browser pane).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose the `spike/extension` folder.
4. Pin the extension icon. Its popup is the spike panel.

After any change to the files, click the reload icon on the extension card. **Reload each open tab too**, because the content script only attaches to pages loaded after the extension starts.

## Run the tests

Each result is saved, so you can reopen the popup later. Use **Copy results** and paste the text back to me.

### ① Is a YouTube video readable? (`getImageData`)
1. Open a YouTube video, let it play for about 10 seconds (muted is fine).
2. Click the icon, then **Probe this tab**.
3. Look at `probe … → videos[0].readability`. `readable: true` means the content script can read pixels. `SecurityError` means it is tainted.

### ② Are X and Reddit "GIFs" progressive MP4 or WebP, and can an extension page fetch them?
1. Open an X post or a Reddit post with a GIF, and play it for a few seconds.
2. Click **Probe this tab**.
3. Look at `videos[*].srcKind` (want `http(s)`, not `blob:`) and the `fetch+decode (test 2)` entries. They show `status`, `contentType`, `magic`, `bytesRead`, and for GIF/WebP, `imageDecode.frameCount`.
4. Note the `blob:` results separately. They mean MSE or HLS, which needs the live-detection path.

### ③ Is the Reddit player in a shadow root?
Same probe. Check `shadowVideoCount` and `shadowHosts`. Reddit should show a `shreddit-player` host. If `videos` is empty on a page with a visible player, the player is probably closed-shadow or cross-origin iframe. Report that.

### ④ What does Calm Mode actually render? (sets `CALM_BRIGHTNESS`)
1. Click **Run Calm measurement**. A test tab opens and the popup closes. That is expected.
2. Wait about 3 seconds. Reopen the popup and read the `calm measurement` entry, or click **Copy results**.
3. The four patches should read approximately:
   - white, no filter: **≈255**
   - white with Calm filter: **≈82** if the filter works in sRGB. If it is linear-light, it will be much brighter.
   - gray 128 with Calm filter: **≈41** in sRGB, **≈74** in linear-light. This one tells the two cases apart.
   - red with Calm filter: **≈17**, because grayscale removes the red.

### ⑤ Does the filter survive fullscreen?
1. Open a page with a video (for example a YouTube video). Play it.
2. Click the video's fullscreen button, or press `F11`.
3. Click the icon, then **Apply Calm to first video**.
4. Look at the screen. The video should turn grey and dim. Tell me what you saw.
5. The result entry shows `computedFilter` and `fullscreenElement`. Then click **Remove Calm**.

## What to paste back
- The **Copy results** text, or the relevant entries.
- A one-line answer on whether the ⑤ fullscreen dimming was visible.
- Any page where the probe did not run (note the page and the error).
