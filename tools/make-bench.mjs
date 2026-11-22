// Benchmark clips: the known-answer suite cases encoded as constant-frame-rate MP4 (plan §6, M8).
// Frames come straight from core/fixtures.js (128×72, exact), upscaled with nearest-neighbour so nothing is blurred.
// Output: bench/clips/case-<id>.mp4 (gitignored). Usage: node tools/make-bench.mjs [width=640]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES } from '../core/fixtures.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'bench', 'clips');
fs.mkdirSync(out, { recursive: true });
const width = +(process.argv[2] || 640), height = Math.round((width * 9) / 16);

function ffmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  if (spawnSync('ffmpeg', ['-version']).status === 0) return 'ffmpeg';
  const pk = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  for (const d of fs.existsSync(pk) ? fs.readdirSync(pk).filter((d) => d.startsWith('Gyan.FFmpeg')) : []) {
    for (const sub of fs.readdirSync(path.join(pk, d))) {
      const exe = path.join(pk, d, sub, 'bin', 'ffmpeg.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  throw new Error('ffmpeg not found');
}
const FF = ffmpeg();

// 14 (VFR) can't be expressed as a CFR file; 15 is Strobeproof's own Calm Mode, not an input.
export const BENCH_CASES = Object.keys(CASES).filter((id) => id !== '14' && id !== '15');

for (const id of BENCH_CASES) {
  const frames = CASES[id].make();
  const fps = Math.round(1 / (frames[1].t - frames[0].t));
  const { width: w, height: h } = frames[0];
  const raw = Buffer.alloc(frames.length * w * h * 3);
  frames.forEach((f, i) => { for (let p = 0; p < w * h; p++) { raw[(i * w * h + p) * 3] = f.data[p * 4]; raw[(i * w * h + p) * 3 + 1] = f.data[p * 4 + 1]; raw[(i * w * h + p) * 3 + 2] = f.data[p * 4 + 2]; } });
  const file = path.join(out, `case-${id}.mp4`);
  const r = spawnSync(FF, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-',
    '-vf', `scale=${width}:${height}:flags=neighbor`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-color_range', 'pc', '-crf', '10', '-g', String(fps), '-bf', '0', '-movflags', '+faststart', file], { input: raw, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`${id}: ${r.stderr}`);
  console.log(`case ${id}: ${frames.length} frames @ ${fps} fps → ${path.relative(root, file)}`);
}
fs.writeFileSync(path.join(out, 'cases.json'), JSON.stringify(BENCH_CASES.map((id) => ({ id, name: CASES[id].name })), null, 2));
