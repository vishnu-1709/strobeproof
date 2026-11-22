// Strobeproof M0 spike: offscreen document.
// Fetches media (test 2), decodes GIF/WebP frame by frame with ImageDecoder, and
// samples pixels from a PNG screenshot (test 4).

const CAP_BYTES = 16 * 1024 * 1024; // do not read more than 16 MB per URL
const MAX_FRAMES = 2000;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== 'offscreen') return false;
  handle(msg).then(
    (r) => sendResponse(r),
    (e) => sendResponse({ error: e.name + ': ' + e.message })
  );
  return true;
});

async function handle(msg) {
  if (msg.type === 'fetchTest') return fetchTest(msg.url);
  if (msg.type === 'samplePng') return samplePng(msg.dataUrl, msg.points);
  return { error: 'unknown offscreen message ' + msg.type };
}

function magicOf(buf) {
  const ascii = (a, b) => String.fromCharCode(...buf.subarray(a, b));
  if (ascii(0, 4) === 'GIF8') return { kind: 'gif', mime: 'image/gif' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { kind: 'webp', mime: 'image/webp' };
  if (ascii(4, 8) === 'ftyp') return { kind: 'mp4', mime: 'video/mp4' };
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { kind: 'webm', mime: 'video/webm' };
  return { kind: 'unknown', mime: null, first12: ascii(0, 12).replace(/[^\x20-\x7e]/g, '.') };
}

async function fetchTest(url) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { cache: 'no-store', credentials: 'omit' });
    const info = {
      url: url.slice(0, 160),
      status: res.status,
      responseType: res.type,
      contentType: res.headers.get('content-type'),
      contentLength: res.headers.get('content-length'),
      acceptRanges: res.headers.get('accept-ranges'),
    };
    if (!res.ok || !res.body) {
      return { ...info, error: 'HTTP ' + res.status, ms: Math.round(performance.now() - t0) };
    }

    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    let truncated = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      chunks.push(value);
      if (total > CAP_BYTES) {
        truncated = true;
        await reader.cancel();
        break;
      }
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.byteLength;
    }

    const magic = magicOf(buf);
    Object.assign(info, {
      bytesRead: total,
      truncated,
      magic: magic.kind,
      first12: magic.first12 || null,
      ms: Math.round(performance.now() - t0),
    });

    if ((magic.kind === 'gif' || magic.kind === 'webp') && !truncated) {
      info.imageDecode = await decodeAnimated(buf, magic.mime);
    } else if (magic.kind === 'mp4' || magic.kind === 'webm') {
      info.note = 'Video container. Frame-by-frame check needs mp4box + VideoDecoder (M5).';
    }
    return info;
  } catch (e) {
    return { url: url.slice(0, 160), error: e.name + ': ' + e.message, ms: Math.round(performance.now() - t0) };
  }
}

// Decode every frame of a GIF or WebP, and report counts and durations.
async function decodeAnimated(buf, type) {
  if (typeof ImageDecoder === 'undefined') return { error: 'ImageDecoder not available in this context' };
  let dec;
  try {
    dec = new ImageDecoder({ data: buf, type });
    await dec.tracks.ready;
    const track = dec.tracks.selectedTrack;
    const n = Math.min(track.frameCount, MAX_FRAMES);
    let totalMs = 0;
    let minMs = Infinity;
    let maxMs = 0;
    for (let i = 0; i < n; i++) {
      const { image } = await dec.decode({ frameIndex: i });
      const ms = (image.duration || 0) / 1000;
      totalMs += ms;
      minMs = Math.min(minMs, ms);
      maxMs = Math.max(maxMs, ms);
      image.close();
    }
    return {
      type,
      animated: track.animated,
      frameCount: track.frameCount,
      decodedFrames: n,
      repetitionCount: track.repetitionCount,
      totalMs: Math.round(totalMs),
      minFrameMs: Math.round(minMs),
      maxFrameMs: Math.round(maxMs),
    };
  } catch (e) {
    return { type, error: e.name + ': ' + e.message };
  } finally {
    if (dec) dec.close();
  }
}

// Test 4: decode the screenshot, average a 9x9 patch at each sample point (sRGB values).
async function samplePng(dataUrl, points) {
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);

  const samples = points.map((p) => {
    const cx = Math.round(p.fx * bmp.width);
    const cy = Math.round(p.fy * bmp.height);
    const d = ctx.getImageData(cx - 4, cy - 4, 9, 9).data;
    let r = 0, g = 0, b = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
    }
    return { name: p.name, rgb: [Math.round(r / n), Math.round(g / n), Math.round(b / n)] };
  });
  return { imageSize: [bmp.width, bmp.height], devicePixelRatio: self.devicePixelRatio, samples };
}
