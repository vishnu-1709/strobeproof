// Strobeproof content script (classic script, document_start, all frames).
// Discovery (+ shadow roots), per-element state machine, live detection with pre-trip, pre-scan requests, chips.
// Plan §3.1–§3.5. calm.css already holds every candidate in Calm Mode before this runs.
(() => {
  if (window.__strobeproof) return;
  window.__strobeproof = true;

  const url = (p) => chrome.runtime.getURL(p);
  const load = Promise.all([
    import(url('core/constants.js')),
    import(url('core/luminance.js')),
    import(url('core/analyzeFrames.js')),
    import(url('settings.js')),
  ]);

  load.then(([C, LUM, AN, SET]) => main(C, LUM, AN, SET)).catch((e) => console.warn('[strobeproof] failed to start', e));

  function main(C, LUM, AN, SET) {
    const { CALM_FILTER, SAMPLE_W, SAMPLE_H, LIVE_WARMUP_S, PRETRIP_RELEASE_S, AREA_LIMIT_PX, REFERENCE_WIDTH_PX,
      FAIL_TRANSITIONS, PRETRIP_TRANS, COMFORT_FAIL_TRANSITIONS, COMFORT_PRETRIP_TRANS,
      PRESCAN_MAX_DURATION_S, PRESCAN_CONCURRENCY, PRESCAN_ROOT_MARGIN_PX } = C;

    let settings = { ...SET.DEFAULTS };
    let pageCalm = false;              // panic toggle
    let confirmedShowOnce = false;     // "Show original" asks once per page (always under caregiver lock)
    const items = new Map();           // element → controller
    const observedRoots = new WeakSet();
    const thresholds = () => settings.mode === 'comfort'
      ? { failAt: COMFORT_FAIL_TRANSITIONS, pretripAt: COMFORT_PRETRIP_TRANS }
      : { failAt: FAIL_TRANSITIONS, pretripAt: PRETRIP_TRANS };

    // ------------------------------------------------------------------ state
    // checking | calm (pre-tripped) | risky | cant | hide | safe | allow
    const CALM_STATES = new Set(['checking', 'calm', 'risky', 'cant']);
    function setState(c, state, info = {}) {
      const prev = c.state;
      c.state = state;
      c.info = { ...c.info, ...info };
      const el = c.el;
      el.dataset.fg = state;
      if (pageCalm || CALM_STATES.has(state)) el.style.setProperty('filter', CALM_FILTER, 'important');
      else if (state === 'hide') el.style.setProperty('filter', 'brightness(0)', 'important');
      else if (c.origFilter) el.style.setProperty('filter', c.origFilter); else el.style.removeProperty('filter');
      if (state === 'hide' && el.tagName === 'VIDEO') el.pause();
      if (prev !== state) {
        if ((state === 'risky' || state === 'hide') && prev !== 'risky') send({ type: 'count-calmed' });
        announceFor(c, prev);
      }
      renderChip(c);
    }
    function send(msg) { return chrome.runtime.sendMessage({ to: 'sw', ...msg }).catch(() => null); }

    function track(el, kind) {
      if (items.has(el)) return items.get(el);
      const c = { el, kind, state: null, info: {}, origFilter: el.style.getPropertyValue('filter') || '' };
      items.set(el, c);
      return c;
    }

    // Area in 1024-reference px² — media this small can't fail no matter what (Decision C6.2).
    function refArea(el) {
      const r = el.getBoundingClientRect();
      const s = REFERENCE_WIDTH_PX / Math.max(1, innerWidth);
      return r.width * r.height * s * s;
    }
    const tooSmallToFail = (el) => { const a = refArea(el); return a > 0 && a <= AREA_LIMIT_PX; };

    // ------------------------------------------------------------------ images
    const IMG_RE = /\.(gif|webp)(\?|#|$)|format=gif/i;
    const imgSrc = (img) => img.currentSrc || img.src || '';
    const isCandidateImg = (img) => IMG_RE.test(img.getAttribute('src') || '') || IMG_RE.test(img.getAttribute('srcset') || '') || IMG_RE.test(imgSrc(img));

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); const c = items.get(e.target); if (c) prescanImage(c); }
    }, { rootMargin: `${PRESCAN_ROOT_MARGIN_PX}px` });

    function considerImg(img) {
      if (!isCandidateImg(img)) return;
      const c = track(img, 'img');
      const src = imgSrc(img);
      if (c.src === src && c.state) return;
      c.src = src;
      if (pageCalm) return setState(c, 'checking');
      setState(c, 'checking');
      const decideSmall = () => { if (c.state === 'checking' && tooSmallToFail(img)) setState(c, 'safe', { reason: 'small' }); };
      if (img.complete) decideSmall(); else img.addEventListener('load', decideSmall, { once: true });
      io.observe(img);
    }

    const queue = []; let inflight = 0;
    async function prescanImage(c) {
      if (c.state !== 'checking' || !c.src || !/^https?:|^data:|^blob:/.test(c.src)) return;
      if (tooSmallToFail(c.el)) return setState(c, 'safe', { reason: 'small' });
      const cached = await cacheGet(c.src);
      if (cachedFits(c, cached)) return applyVerdict(c, cached);
      if (/^(blob|data):/.test(c.src)) return localImageScan(c);
      queue.push(c); pump();
    }
    // A cached verdict holds if it doesn't depend on size, or the item isn't shown larger than when it was checked.
    const cachedFits = (c, v) => !!v && (v.sizeIndependent || v.verdict === 'FAIL' || refArea(c.el) <= (v.rectArea || 0) * 1.25);

    // blob:/data: images belong to the page's origin, so the offscreen doc can't fetch them; decode here instead.
    async function localImageScan(c) {
      try {
        const [{ decodeAnimatedImage, sniffImageType }] = await Promise.all([import(url('core/decode/gif.js'))]);
        const buf = await (await fetch(c.src)).arrayBuffer();
        const type = sniffImageType(new Uint8Array(buf, 0, 16));
        if (!type) return setState(c, 'cant', { reason: 'unsupported' });
        const r = await decodeAnimatedImage(buf, type);
        if (!r.animated) return applyVerdict(c, { verdict: 'STATIC' });
        const rect = c.el.getBoundingClientRect();
        const rep = AN.analyzeFrames(r.frames, { displayWidth: rect.width, displayHeight: rect.height, viewportWidth: innerWidth, incomplete: r.incomplete });
        applyVerdict(c, { verdict: rep.verdict, flashesPerSecond: rep.worst.flashesPerSecond });
      } catch (e) { setState(c, 'cant', { reason: String(e?.message || e) }); }
    }
    function pump() {
      while (inflight < PRESCAN_CONCURRENCY && queue.length) {
        const c = queue.shift();
        if (c.state !== 'checking') continue;
        inflight++;
        const src = c.src;
        const r = c.el.getBoundingClientRect();
        const job = { url: src, kind: c.kind === 'img' ? 'image' : 'video', freeze: settings.freezeGifs && c.kind === 'img',
          rect: { width: Math.max(1, r.width), height: Math.max(1, r.height) }, viewportWidth: innerWidth };
        c.prescanStarted = performance.now();
        send({ type: 'prescan', job })
          .then((v) => { if (v && !v.error && v.verdict !== 'ERROR') cacheSet(src, v); if (c.src === src || c.kind === 'video') applyVerdict(c, v); })
          .finally(() => { inflight--; pump(); });
      }
    }
    function applyVerdict(c, v) {
      if (!v || v.error) { c.prescan = 'failed'; if (c.kind === 'img') return setState(c, 'cant', { reason: v?.error || 'unreachable' }); return; }
      c.prescan = v.verdict;
      if (v.verdict === 'PASS' || v.verdict === 'STATIC') {
        if (c.kind === 'img' && settings.freezeGifs && v.firstFrame) { c.el.removeAttribute('srcset'); c.el.src = v.firstFrame; c.src = v.firstFrame; }
        if (c.state === 'checking') setState(c, 'safe', { reason: 'prescan', fps: v.flashesPerSecond });
      } else if (v.verdict === 'FAIL') {
        risky(c, v.flashesPerSecond);
      } else if (c.kind === 'img') {
        setState(c, 'cant', { reason: v.verdict.toLowerCase() });
      } // videos: INCOMPLETE/unsupported → the live path decides
    }

    // Verdict cache (storage.session, readable here thanks to setAccessLevel in sw.js — plan A15).
    async function cacheGet(u) {
      if (u.startsWith('blob:') || u.startsWith('data:')) return null;
      try { return (await chrome.storage.session.get('v:' + u))['v:' + u] || null; } catch { return null; }
    }
    function cacheSet(u, v) {
      if (u.startsWith('blob:') || u.startsWith('data:')) return;
      const { firstFrame, ...rest } = v;
      chrome.storage.session.set({ ['v:' + u]: rest }).catch(() => {});
    }

    // ------------------------------------------------------------------ videos
    function isGifLikeVideo(v) {
      const src = v.currentSrc || v.src || v.querySelector('source')?.src || '';
      const short = !Number.isFinite(v.duration) || v.duration <= PRESCAN_MAX_DURATION_S;
      return /^https?:/.test(src) && (v.muted || v.defaultMuted) && (v.loop || v.autoplay) && short;
    }

    function considerVideo(v) {
      const c = track(v, 'video');
      if (c.state) return;
      if (v.mediaKeys) return setState(c, 'cant', { reason: 'drm' });
      // Paused, non-autoplay videos are released right away: the poster shows normally (plan §3.5).
      if (v.paused && !v.autoplay) setState(c, 'safe', { reason: 'paused' });
      else setState(c, 'checking');
      v.addEventListener('play', () => onPlay(c));
      v.addEventListener('seeking', () => c.analyzer && c.resetAnalyzer?.());
      v.addEventListener('emptied', () => { c.checkedOnce = false; c.prescan = null; c.analyzer = null; if (!v.paused || v.autoplay) setState(c, 'checking'); });
      v.addEventListener('encrypted', () => setState(c, 'cant', { reason: 'drm' }));
      if (!v.paused) onPlay(c);
      else if (v.autoplay) v.addEventListener('loadedmetadata', () => maybePrescanVideo(c), { once: true });
    }

    function maybePrescanVideo(c) {
      if (!C.GIF_VIDEO_PRESCAN || c.prescan || !isGifLikeVideo(c.el)) return;
      c.prescan = 'pending';
      c.src = c.el.currentSrc || c.el.src || c.el.querySelector('source')?.src;
      cacheGet(c.src).then((cached) => { if (cachedFits(c, cached)) applyVerdict(c, cached); else { queue.push(c); pump(); } });
    }

    function onPlay(c) {
      const v = c.el;
      if (c.state === 'allow' || c.state === 'risky' || c.state === 'hide') return;
      if (v.mediaKeys) return setState(c, 'cant', { reason: 'drm' });
      if (c.state === 'safe' && !c.checkedOnce && c.info.reason !== 'prescan') setState(c, 'checking');
      maybePrescanVideo(c);
      startLive(c);
    }

    function startLive(c) {
      if (c.live) return;
      c.live = true;
      const v = c.el;
      const canvas = new OffscreenCanvas(SAMPLE_W, SAMPLE_H);
      const g = canvas.getContext('2d', { willReadFrequently: true });
      let rectEvery = 0, firstT = null, lastTrip = null, lastPF = null;
      // Time base: exact media timestamps (plan §3.3), accumulated so loops and seeks never run time backwards,
      // and divided by playbackRate so 2× playback counts as twice the flash rate the viewer sees.
      let lastMT = null, lastDt = 1 / 30, acc = 0;
      const make = () => {
        const r = v.getBoundingClientRect();
        c.analyzer = AN.createAnalyzer({ rect: { width: r.width || 1, height: r.height || 1 }, viewportWidth: innerWidth, ...thresholds() });
        firstT = null; lastPF = null;
      };
      c.resetAnalyzer = make;
      make();
      const tick = (now, meta) => {
        if (!c.live) return;
        if (c.state === 'allow' || c.state === 'risky' || c.state === 'hide' || c.state === 'cant') { c.live = false; return; }
        if (!c.analyzer) make();
        let dt = lastMT === null ? 0 : meta.mediaTime - lastMT;
        lastMT = meta.mediaTime;
        if (dt < 0 || dt > 1) dt = lastDt; else if (dt > 0) lastDt = dt; // loop / seek: continue smoothly
        acc += dt / (v.playbackRate || 1);
        const t = acc;
        let px;
        try {
          g.drawImage(v, 0, 0, SAMPLE_W, SAMPLE_H); // CSS filters don't affect drawImage: true pixels
          px = g.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
        } catch (e) {
          c.live = false;
          return setState(c, 'cant', { reason: e?.name === 'SecurityError' ? 'cross-origin' : 'unreadable' });
        }
        if (++rectEvery % 15 === 0) { const r = v.getBoundingClientRect(); c.analyzer.setRect({ width: r.width || 1, height: r.height || 1 }, innerWidth); }
        // ≥ 2 consecutive frames never reached us → we may have missed a flash: pre-trip to Calm (plan §3.3).
        // A single dropped frame can't hide a whole flash state near the threshold (≥ 4 frames per state at 30 fps
        // up to 3.5 Hz), and much faster flicker still shows far more than 7 transitions with one frame missing.
        const uncertain = lastPF !== null && meta.presentedFrames - lastPF > 2;
        lastPF = meta.presentedFrames;
        const s = c.analyzer.push(LUM.tilesFromRGBA(px, SAMPLE_W, SAMPLE_H), t);
        if (firstT === null) firstT = t;
        c.lastStatus = s;
        if (s.fail) {
          c.info.detectedAt = performance.now();
          risky(c, Math.max(s.generalMax, s.redMax) / 2);
          c.live = false;
          return;
        }
        if (s.pretrip || uncertain) {
          lastTrip = t;
          if (c.state === 'safe') { c.info.pretripAt = performance.now(); setState(c, 'calm', { uncertain }); }
        } else {
          const quiet = lastTrip === null || t - lastTrip >= PRETRIP_RELEASE_S;
          const prescanBlocks = c.prescan === 'pending';
          if (c.state === 'checking' && !prescanBlocks && quiet && t - firstT >= LIVE_WARMUP_S && !pageCalm) { c.checkedOnce = true; setState(c, 'safe', { reason: 'live' }); }
          else if (c.state === 'calm' && quiet && !pageCalm) setState(c, 'safe', { reason: 'live' });
        }
        v.requestVideoFrameCallback(tick);
      };
      if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(tick);
      else setState(c, 'cant', { reason: 'no-rvfc' });
    }

    function risky(c, fps) {
      const f = Math.max(3.5, Math.round((fps || 0) * 2) / 2);
      setState(c, settings.onRisk === 'hide' ? 'hide' : 'risky', { fps: f });
    }

    // ------------------------------------------------------------------ discovery (+ shadow roots, plan A14)
    function shadowOf(el) {
      try { return chrome.dom?.openOrClosedShadowRoot?.(el) || el.shadowRoot || null; } catch { return el.shadowRoot || null; }
    }
    function consider(el) {
      if (el.tagName === 'VIDEO') considerVideo(el);
      else if (el.tagName === 'IMG') considerImg(el);
    }
    function scan(root) {
      root.querySelectorAll?.('video, img').forEach(consider);
      for (const el of root.querySelectorAll?.('*') || []) {
        const sr = shadowOf(el);
        if (sr && !observedRoots.has(sr)) { observe(sr); scan(sr); }
      }
    }
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') { if (r.target.tagName === 'IMG') { const c = items.get(r.target); if (c) c.state = null; considerImg(r.target); } continue; }
        for (const n of r.addedNodes) {
          if (n.nodeType !== 1) continue;
          consider(n);
          scan(n);
        }
      }
    });
    function observe(root) {
      observedRoots.add(root);
      mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset'] });
    }
    // Late-attached shadow roots (custom elements upgrading after insertion): periodic sweep.
    let sweeps = 0;
    const sweep = () => { scan(document); sweeps++; setTimeout(sweep, sweeps < 15 ? 2000 : 5000); };

    // ------------------------------------------------------------------ panic: calm everything on this page
    let pageStyle = null;
    function setPageCalm(on) {
      pageCalm = on;
      if (on) {
        pageStyle = document.createElement('style');
        pageStyle.textContent = `html { filter: ${CALM_FILTER} !important; }`;
        (document.head || document.documentElement).append(pageStyle);
      } else { pageStyle?.remove(); pageStyle = null; }
      for (const c of items.values()) setState(c, c.state);
      announce(on ? 'Calm Mode is on for this whole page. Press Alt+Shift+F again to undo.' : 'Page restored.');
    }

    // ------------------------------------------------------------------ chips + announcements (plan §3.4)
    let liveHost = null, liveEl = null;
    function announce(text) {
      if (window.top !== window && !document.fullscreenElement) { /* frames announce too; fine */ }
      if (!liveHost) {
        liveHost = document.createElement('strobeproof-live');
        const sr = liveHost.attachShadow({ mode: 'open' });
        liveEl = document.createElement('div');
        liveEl.setAttribute('aria-live', 'polite');
        liveEl.setAttribute('role', 'status');
        liveEl.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
        sr.append(liveEl);
        (document.body || document.documentElement).append(liveHost);
      }
      liveEl.textContent = '';
      setTimeout(() => { liveEl.textContent = text; }, 50);
    }
    let lastCantAnnounce = 0;
    function announceFor(c, prev) {
      const what = c.kind === 'img' ? 'image' : 'video';
      if (c.state === 'risky') announce(`Flashing detected. About ${c.info.fps} flashes per second. Calm Mode is on.`);
      else if (c.state === 'hide') announce('Flashing content hidden.');
      else if (c.state === 'cant' && performance.now() - lastCantAnnounce > 10000) { lastCantAnnounce = performance.now(); announce(`Couldn't check this ${what}. Showing it in Calm Mode.`); }
      else if (c.state === 'allow' && prev) announce('Showing original. Press Escape to return to Calm Mode.');
    }

    let chipCss = null;
    fetch(url('chip.css')).then((r) => r.text()).then((t) => { chipCss = t; for (const c of items.values()) renderChip(c); }).catch(() => {});

    function chipModel(c) {
      const what = c.kind === 'img' ? 'image' : 'video';
      switch (c.state) {
        case 'checking': return c.kind === 'video' && !c.el.paused ? { text: 'Checking…', buttons: [] } : null;
        case 'calm': return { text: 'Calmed', buttons: [] };
        case 'risky': return { text: 'Flashing detected. Calm Mode on.', buttons: [['keep', 'Keep Calm'], ['show', 'Show original'], ['site', 'Always allow this site']], important: true };
        case 'hide': return { text: 'Flashing content hidden.', buttons: [['show', 'Show original'], ['site', 'Always allow this site']], important: true };
        case 'cant': return { text: `Can't check this ${what}. Shown in Calm Mode.`, buttons: [['play', 'Play normally']] };
        case 'allow': return c.overridden ? { text: 'Showing original.', buttons: [['undo', 'Undo']] } : null;
        default: return null; // safe → no chip (silence is the success state)
      }
    }

    function renderChip(c) {
      const model = pageCalm ? null : chipModel(c);
      if (c.state === 'checking' && model) {
        // Don't flash a "Checking…" chip for quick checks: only show it after 800 ms.
        clearTimeout(c.chipTimer);
        if (!c.chipHost) { c.chipTimer = setTimeout(() => { if (c.state === 'checking') drawChip(c, model); }, 800); return; }
      }
      if (!model) { removeChip(c); return; }
      drawChip(c, model);
    }
    function removeChip(c) { clearTimeout(c.chipTimer); c.chipHost?.remove(); c.chipHost = null; c.confirming = false; }

    function drawChip(c, model) {
      if (!chipCss) return;
      if (!c.chipHost) {
        c.chipHost = document.createElement('strobeproof-chip');
        c.chipRoot = c.chipHost.attachShadow({ mode: 'open' });
        c.chipHost.dataset.for = c.kind;
        placeChip(c);
      }
      const root = c.chipRoot;
      root.innerHTML = '';
      const style = document.createElement('style'); style.textContent = chipCss; root.append(style);
      const box = document.createElement('div');
      box.className = 'chip' + (model.important ? ' important' : '');
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'Strobeproof');
      const p = document.createElement('p');
      if (c.confirming) {
        p.textContent = c.info.fps ? `This flashes about ${c.info.fps} times per second. Show it anyway?` : 'This hasn\'t been checked. Play it normally anyway?';
        box.append(p);
        box.append(btn('Cancel', () => { c.confirming = false; drawChip(c, chipModel(c)); focusFirst(c); }, true));
        box.append(btn(c.info.fps ? 'Show it' : 'Play it', () => { c.confirming = false; override(c); }));
      } else {
        p.textContent = model.text;
        box.append(p);
        for (const [id, label] of model.buttons) box.append(btn(label, () => act(c, id), id === 'keep'));
      }
      box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); backToSafe(c); } });
      root.append(box);
      positionChip(c);
    }
    function btn(label, fn, primary = false) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label; if (primary) b.className = 'primary';
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
      return b;
    }
    function focusFirst(c) { c.chipRoot?.querySelector('button')?.focus(); }

    function act(c, id) {
      if (id === 'keep') { c.kept = true; removeChip(c); c.el.dataset.fg = c.state; announce('Calm Mode stays on.'); }
      else if (id === 'show' || id === 'play') {
        if (settings.lock || !confirmedShowOnce || id === 'show') { c.confirming = true; drawChip(c, chipModel(c)); focusFirst(c); return; }
        override(c);
      } else if (id === 'site') {
        send({ type: 'allow-site', host: location.hostname });
        for (const x of items.values()) { x.overridden = false; setState(x, 'allow'); }
        announce(`${location.hostname} is now allowed. Strobeproof won't calm media here.`);
      } else if (id === 'undo') backToSafe(c);
    }
    function override(c) {
      confirmedShowOnce = true;
      c.prevState = c.state;
      c.overridden = true;
      c.live = false;
      setState(c, 'allow');
      if (c.el.tagName === 'VIDEO' && c.prevState === 'hide') c.el.play().catch(() => {});
      focusFirst(c);
    }
    function backToSafe(c) {
      if (c.state !== 'allow') return;
      c.overridden = false;
      setState(c, c.prevState === 'hide' ? 'hide' : c.prevState === 'cant' ? 'cant' : 'risky', {});
      announce('Back in Calm Mode.');
      focusFirst(c);
    }
    // Esc anywhere: return the most recent override on this page to Calm (never blocks the page's own Esc).
    addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const over = [...items.values()].filter((x) => x.state === 'allow' && x.overridden);
      if (over.length) backToSafe(over[over.length - 1]);
    }, true);

    // The chip lives right after its media in the DOM, so keyboard users reach it next to the media in Tab order
    // (not at the end of a long feed). Outside links/pictures/labels to avoid nested interactive content.
    // Inside the fullscreen element too, when the media is in a fullscreen container (plan A14).
    function placeChip(c) {
      const anchor = c.el.closest?.('a, button, picture, label, summary') || c.el;
      if (anchor.nextSibling !== c.chipHost) anchor.after(c.chipHost);
    }
    function positionChip(c) {
      if (!c.chipHost) return;
      const r = c.el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
      const want = { left: Math.max(4, r.left + 8), top: Math.max(4, r.top + 8) };
      const css = (l, t) => `all:initial;position:fixed;z-index:2147483646;left:${l}px;top:${t}px;display:${visible ? 'block' : 'none'};`;
      c.chipHost.style.cssText = css(want.left, want.top);
      if (!visible) return;
      // A transformed/filtered ancestor makes position:fixed relative to it: correct by the measured offset.
      const got = c.chipHost.getBoundingClientRect();
      const dx = want.left - got.left, dy = want.top - got.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) c.chipHost.style.cssText = css(want.left + dx, want.top + dy);
    }
    let posQueued = false;
    const reposition = () => {
      if (posQueued) return; posQueued = true;
      requestAnimationFrame(() => { posQueued = false; for (const c of items.values()) if (c.chipHost) positionChip(c); });
    };
    addEventListener('scroll', reposition, { passive: true, capture: true });
    addEventListener('resize', () => {
      reposition();
      for (const c of items.values()) {
        if (c.analyzer) { const r = c.el.getBoundingClientRect(); c.analyzer.setRect({ width: r.width || 1, height: r.height || 1 }, innerWidth); }
      }
    });
    document.addEventListener('fullscreenchange', () => {
      for (const c of items.values()) if (c.chipHost) positionChip(c);
      dispatchEvent(new Event('resize'));
    });

    // ------------------------------------------------------------------ messages + settings
    chrome.runtime.onMessage.addListener((m, _s, reply) => {
      if (m?.type === 'toggle-calm-page') { if (window === window.top) setPageCalm(!pageCalm); else setPageCalm(!pageCalm); reply?.({ pageCalm }); }
      else if (m?.type === 'get-page-state') reply?.({ pageCalm, counts: countStates(), host: location.hostname });
      return false;
    });
    function countStates() { const n = {}; for (const c of items.values()) n[c.state] = (n[c.state] || 0) + 1; return n; }
    // Exposed for E2E tests (read-only snapshot, no page-world access to internals).
    document.documentElement.dataset.strobeproof = 'on';

    function releaseAll() {
      mo.disconnect(); io.disconnect();
      for (const c of items.values()) { c.live = false; removeChip(c); c.el.removeAttribute('data-fg'); if (c.origFilter) c.el.style.setProperty('filter', c.origFilter); else c.el.style.removeProperty('filter'); }
      items.clear();
      document.documentElement.dataset.strobeproof = 'off';
    }
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local' || !ch.settings) return;
      settings = { ...SET.DEFAULTS, ...ch.settings.newValue };
      if (!settings.enabled || settings.allowlist.some((h) => location.hostname === h || location.hostname.endsWith('.' + h))) releaseAll();
    });

    SET.getSettings().then((s) => {
      settings = s;
      if (!s.enabled) return releaseAll();
      const start = () => { observe(document); sweep(); };
      if (document.documentElement) start(); else document.addEventListener('readystatechange', start, { once: true });
    });
  }
})();
