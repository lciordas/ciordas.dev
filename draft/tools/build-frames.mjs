// Turns a stretch of video into steadied, numbered WebP frames in toolkit/frames, which build-video.mjs joins into
// the dog's video. Run from the repo root: node draft/tools/build-frames.mjs [clip name]
// A clip with `lock` follows the background and cancels the camera's movement, so the subject stays put in the frame.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackCamera } from './track.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../toolkit/x.js'));
const sharp = require('sharp');
const HOME = os.homedir();
const CLIPS = {
  dog: { src: `${HOME}/Downloads/robot dog photos icloud/IMG_2665.MOV`, ss: 14.8, t: 6, vf: 'fps=30', lock: { margin: 64 } },
  // Front three-quarter, close: the body rolling and pitching over planted feet.
  'dog-quarter': { src: `${HOME}/Downloads/maker portfolio b-roll/quadruped gyrating.MOV`, ss: 0.2, t: 4.6, vf: 'fps=30', lock: { margin: 140 } },
  // Head on: one full sway, then the tilts. The phone was turned on its side partway through, so it needs turning back.
  'dog-front': { src: `${HOME}/Downloads/maker portfolio b-roll/quadrupedgyratingfrontview.MOV`, ss: 23.1, t: 6.4, pre: 'transpose=2', vf: 'transpose=2,fps=24', trackFps: 30, lock: { margin: 48 } },
};
const WIDTH = 1280, QUALITY = 72;

const only = process.argv[2];
for (const [name, c] of Object.entries(CLIPS)) {
  if (only && only !== name) continue;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'frames-'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(c.ss), '-t', String(c.t), '-i', c.src, '-an', '-vf', c.vf, path.join(tmp, '%04d.png')]);
  const out = path.join(here, '../../toolkit/frames', name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
  const { width: srcW, height: srcH } = await sharp(path.join(tmp, files[0])).metadata();
  let crop = null;
  if (c.lock) {
    const track = trackCamera(c.src, c.ss, c.t, c.pre).filter((_, i, all) => !c.trackFps || Math.round((i * 24) / c.trackFps) !== Math.round(((i - 1) * 24) / c.trackFps));
    const px = track.map(([x, y]) => [x * srcW, y * srcH]);
    const xs = px.map((p) => p[0]), ys = px.map((p) => p[1]);
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2, midY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const spreadX = Math.max(...xs) - Math.min(...xs), spreadY = Math.max(...ys) - Math.min(...ys);
    const mx = c.lock.margin, cw = srcW - mx * 2, ch = Math.round((cw * 9) / 16);
    if (spreadX / 2 > mx || spreadY / 2 > (srcH - ch) / 2) throw new Error(`${name}: camera moved ${spreadX.toFixed(0)}x${spreadY.toFixed(0)}px, more than the margin allows`);
    crop = (i) => ({ left: Math.round(mx + px[Math.min(i, px.length - 1)][0] - midX), top: Math.round((srcH - ch) / 2 + px[Math.min(i, px.length - 1)][1] - midY), width: cw, height: ch });
    console.log(name, `camera moved ${spreadX.toFixed(0)}x${spreadY.toFixed(0)}px at source size, locked`);
  }
  let bytes = 0, w = 0, h = 0;
  for (let i = 0; i < files.length; i++) {
    const dest = path.join(out, files[i].replace('.png', '.webp'));
    let img = sharp(path.join(tmp, files[i]));
    if (crop) img = img.extract(crop(i));
    const info = await img.resize({ width: WIDTH }).webp({ quality: QUALITY, effort: 5 }).toFile(dest);
    bytes += info.size; w = info.width; h = info.height;
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ count: files.length, width: w, height: h, fps: c.vf.includes('fps=24') ? 24 : 30 }));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(name, 'frames', files.length, `${w}x${h}`, 'total MB', (bytes / 1e6).toFixed(1));
}
