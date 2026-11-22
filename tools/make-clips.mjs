// Generates constant-frame-rate demo/E2E clips with ffmpeg (plan A11). Output: clips/ (gitignored).
// Clips are 320×180 and must be DISPLAYED at ≤160 px and in Calm Mode by every page that uses them.
// Usage: node tools/make-clips.mjs   (set FFMPEG=path\to\ffmpeg.exe if ffmpeg isn't on PATH)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'clips');
fs.mkdirSync(out, { recursive: true });

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const probe = spawnSync('ffmpeg', ['-version']);
  if (probe.status === 0) return 'ffmpeg';
  const pk = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(pk)) {
    for (const d of fs.readdirSync(pk).filter((d) => d.startsWith('Gyan.FFmpeg'))) {
      const base = path.join(pk, d);
      for (const sub of fs.readdirSync(base)) {
        const exe = path.join(base, sub, 'bin', 'ffmpeg.exe');
        if (fs.existsSync(exe)) return exe;
      }
    }
  }
  throw new Error('ffmpeg not found. Install it or set FFMPEG.');
}
const FF = findFfmpeg();
const W = 320, H = 180;

/** Square wave: `toggles` transitions per second between colours a and b, at fps, for seconds. */
function squareFrames(fps, seconds, toggles, a, b) {
  const n = fps * seconds, buf = Buffer.alloc(n * W * H * 3);
  for (let i = 0; i < n; i++) {
    const c = Math.floor((i * toggles) / fps) % 2 ? b : a;
    for (let p = 0; p < W * H; p++) buf.set(c, (i * W * H + p) * 3);
  }
  return buf;
}

function encode(name, fps, raw, codecArgs) {
  const file = path.join(out, name);
  const r = spawnSync(FF, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-', ...codecArgs, file], { input: raw, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`${name}: ${r.stderr}`);
  console.log('wrote', path.relative(root, file), fs.statSync(file).size, 'bytes');
}

const BLACK = [0, 0, 0], WHITE = [255, 255, 255], RED = [255, 0, 0], GREY = [128, 128, 128];
const mp4 = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-color_range', 'pc', '-g', '30', '-bf', '0', '-crf', '12', '-movflags', '+faststart'];
const webm = ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-b:v', '0', '-crf', '20'];
const gif = ['-loop', '0'];
const awebp = ['-c:v', 'libwebp_anim', '-lossless', '1', '-loop', '0'];

encode('flash-5hz.mp4', 30, squareFrames(30, 3, 10, BLACK, WHITE), mp4);
encode('safe-2hz.mp4', 30, squareFrames(30, 3, 4, BLACK, WHITE), mp4);
// Pre-trip boundary (PRETRIP_TRANS = 5): 2 Hz = 4 transitions/s → released; 2.5 Hz = 5/s → calmed. 6 s each.
encode('flash-2hz-6s.mp4', 30, squareFrames(30, 6, 4, BLACK, WHITE), mp4);
encode('flash-2p5hz-6s.mp4', 30, squareFrames(30, 6, 5, BLACK, WHITE), mp4);
encode('red-5hz.mp4', 30, squareFrames(30, 3, 10, BLACK, RED), mp4);
encode('flash-5hz.webm', 30, squareFrames(30, 3, 10, BLACK, WHITE), webm);
encode('flash-5hz.gif', 20, squareFrames(20, 2, 10, BLACK, WHITE), gif);
encode('safe-1hz.gif', 10, squareFrames(10, 2, 2, BLACK, WHITE), gif);
encode('flash-5hz.webp', 20, squareFrames(20, 2, 10, BLACK, WHITE), awebp);
encode('still.webp', 1, squareFrames(1, 1, 0, GREY, GREY), ['-c:v', 'libwebp', '-frames:v', '1']);
encode('still.gif', 1, squareFrames(1, 1, 0, GREY, GREY), ['-frames:v', '1']);
// Latency clip (plan §3.3): 3 s steady grey (gets released), then 5 Hz black/white from frame 90.
// Transitions at 3.0 (grey→black), 3.1, 3.2, 3.3 s … so the 4th transition is the frame at 3.3 s.
encode('late-flash.mp4', 30, (() => {
  const n = 30 * 6, buf = Buffer.alloc(n * W * H * 3);
  for (let i = 0; i < n; i++) {
    const c = i < 90 ? GREY : (Math.floor((i - 90) / 3) % 2 ? WHITE : BLACK);
    for (let p = 0; p < W * H; p++) buf.set(c, (i * W * H + p) * 3);
  }
  return buf;
})(), mp4);
// A long, safe, slowly changing clip for "live video" demos (no flashing at all).
encode('calm-fade.mp4', 30, (() => {
  const n = 30 * 6, buf = Buffer.alloc(n * W * H * 3);
  for (let i = 0; i < n; i++) { const v = Math.round(60 + 60 * Math.sin((i / n) * Math.PI * 2)); for (let p = 0; p < W * H; p++) buf.set([v, v, v + 20], (i * W * H + p) * 3); }
  return buf;
})(), mp4);
