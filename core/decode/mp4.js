// Every-frame MP4 decode: mp4box.js demux + WebCodecs VideoDecoder, exact timestamps (plan A10).
// Never seeks at a fixed step, so a 30 Hz strobe can't alias into a false PASS.
// Output: { frames: [{ t, tiles }], duration, frameCount, codec, incomplete }
import { createFile, DataStream, Endianness, MP4BoxBuffer } from '../../vendor/mp4box/mp4box.all.mjs';
import { SAMPLE_W, SAMPLE_H } from '../constants.js';
import { tilesFromRGBA } from '../luminance.js';

function codecDescription(file, trackId) {
  const trak = file.getTrackById(trackId);
  for (const entry of trak.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
    if (box) {
      const s = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
      box.write(s);
      return new Uint8Array(s.buffer, 8); // strip the box header
    }
  }
  return undefined;
}

/**
 * @param {ArrayBuffer} buffer  the whole file
 * @param {{ maxDurationS?: number, onProgress?: (done:number, total:number)=>void, crop?: {x:number,y:number,w:number,h:number} }} [opts]
 */
export async function decodeMp4(buffer, opts = {}) {
  if (typeof VideoDecoder === 'undefined') throw new Error('WebCodecs VideoDecoder not supported in this browser');
  const file = createFile();
  const canvas = new OffscreenCanvas(SAMPLE_W, SAMPLE_H);
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const frames = [];
  let total = 0, decodeError = null;

  // Extraction must be configured inside onReady, before the parser finishes with the buffer;
  // configuring it afterwards silently yields zero samples.
  const samples = [];
  const info = await new Promise((resolve, reject) => {
    file.onError = (e) => reject(new Error('mp4 parse error: ' + e));
    file.onReady = (info) => {
      const vt = info.videoTracks?.[0];
      if (vt) {
        file.onSamples = (_id, _user, s) => { samples.push(...s); };
        file.setExtractionOptions(vt.id, null, { nbSamples: Infinity });
        file.start();
      }
      resolve(info);
    };
    const buf = MP4BoxBuffer.fromArrayBuffer(buffer.slice(0), 0);
    file.appendBuffer(buf);
    file.flush();
  });
  const track = info.videoTracks?.[0];
  if (!track) throw new Error('no video track');
  if (samples.length === 0) throw new Error('no video frames found in this file');
  const maxT = opts.maxDurationS ?? Infinity;

  const decoder = new VideoDecoder({
    output(frame) {
      const t = frame.timestamp / 1e6;
      if (t <= maxT) {
        if (opts.crop) g.drawImage(frame, opts.crop.x, opts.crop.y, opts.crop.w, opts.crop.h, 0, 0, SAMPLE_W, SAMPLE_H);
        else g.drawImage(frame, 0, 0, SAMPLE_W, SAMPLE_H);
        frames.push({ t, tiles: tilesFromRGBA(g.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data, SAMPLE_W, SAMPLE_H) });
      }
      frame.close();
      opts.onProgress?.(frames.length, total);
    },
    error(e) { decodeError = e; for (const wake of waiters.splice(0)) wake(); },
  });
  const waiters = []; // back-pressure waits, woken on dequeue OR on error (an errored decoder never dequeues)
  try {
    const config = {
      codec: track.codec.startsWith('vp08') ? 'vp8' : track.codec,
      codedWidth: track.video.width,
      codedHeight: track.video.height,
      description: codecDescription(file, track.id),
    };
    const support = await VideoDecoder.isConfigSupported(config);
    if (!support.supported) throw new Error(`codec ${track.codec} not supported`);
    decoder.configure(config);

    total = samples.length;
    for (const s of samples) {
      if (decodeError) break;
      decoder.decode(new EncodedVideoChunk({
        type: s.is_sync ? 'key' : 'delta',
        timestamp: (1e6 * s.cts) / s.timescale,
        duration: (1e6 * s.duration) / s.timescale,
        data: s.data,
      }));
      // Back-pressure so huge files don't queue everything at once.
      if (decoder.decodeQueueSize > 30) {
        await new Promise((r) => { waiters.push(r); decoder.addEventListener('dequeue', r, { once: true }); });
      }
    }
    if (!decodeError) await decoder.flush().catch((e) => { decodeError = e; });
  } finally {
    if (decoder.state !== 'closed') decoder.close(); // never leak a decoder, even when a chunk throws
  }
  frames.sort((a, b) => a.t - b.t);
  const t0 = frames.length ? frames[0].t : 0;
  for (const f of frames) f.t -= t0;
  return {
    frames,
    duration: track.duration / track.timescale,
    frameCount: frames.length,
    expectedFrames: total,
    codec: track.codec,
    width: track.video.width,
    height: track.video.height,
    // Every encoded sample must come out as a frame, otherwise the verdict can't be PASS.
    incomplete: !!decodeError || frames.length === 0 || (!Number.isFinite(maxT) && frames.length < total),
    error: decodeError ? String(decodeError) : null,
  };
}
