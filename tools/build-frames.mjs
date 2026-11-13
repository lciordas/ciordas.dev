// Turns a stretch of video into steadied, numbered lossless WebP frames in toolkit/frames, 1920 wide, which build-video.mjs joins into
// the dog's video. Run from the repo root: node tools/build-frames.mjs [clip name]
// A clip with `lock` follows the background and cancels the camera's movement, so the subject stays put in the frame.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackCamera, trackSubject } from './track.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp');
const HOME = os.homedir();
const CLIPS = {
  dog: { src: `${HOME}/Downloads/robot dog photos icloud/IMG_2665.MOV`, ss: 14.8, t: 6, vf: 'fps=30', lock: { margin: 64 } },
  // Front three-quarter, close: the body rolling and pitching over planted feet.
  'dog-quarter': { src: `${HOME}/Downloads/maker portfolio b-roll/quadruped gyrating.MOV`, ss: 1.75, t: 3.3, vf: 'fps=30', lock: { margin: 140 } },
  // Head on: one full sway, then the tilts. The phone was turned on its side partway through, so it needs turning back.
  // Kept at the footage's own 30 fps: at 24 the joined video has to repeat every fifth frame, which judders.
  'dog-front': { src: `${HOME}/Downloads/maker portfolio b-roll/quadrupedgyratingfrontview.MOV`, ss: 23.1, t: 6.4, pre: 'transpose=2', vf: 'transpose=2,fps=30', lock: { margin: 48 } },
};
// Lossless, as the frames are encoded again when they're joined into the dog's video. The crop is worked out in
// the source's own pixels, so the width only changes how sharp the frames are, not what they show.
const WIDTH = 1920;

const only = process.argv[2];
for (const [name, c] of Object.entries(CLIPS)) {
  if (only && only !== name) continue;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'frames-'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(c.ss), '-t', String(c.t), '-i', c.src, '-an', '-vf', c.vf, path.join(tmp, '%04d.png')]);
  const out = path.join(here, '../toolkit/frames', name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
  const { width: srcW, height: srcH } = await sharp(path.join(tmp, files[0])).metadata();
  let crop = null;
  if (c.lock) {
    const refs = c.lock.ref?.map(([x, y, w, h]) => trackSubject(c.src, c.ss, c.t, { x, y, w, h }, c.pre).map(([px, py]) => [px - x, py - y]));
    const track = refs ? refs[0].map((_, i) => [0, 1].map((k) => refs.reduce((sum, r) => sum + r[i][k], 0) / refs.length)) : trackCamera(c.src, c.ss, c.t, c.pre);
    const px = track.map(([x, y]) => [x * srcW, y * srcH]);
    const xs = px.map((p) => p[0]), ys = px.map((p) => p[1]);
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2, midY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const spreadX = Math.max(...xs) - Math.min(...xs), spreadY = Math.max(...ys) - Math.min(...ys);
    const mx = c.lock.margin ?? 0, [bx, by, cw, ch] = c.lock.box || [srcW / 2, srcH / 2, srcW - mx * 2, Math.round(((srcW - mx * 2) * 9) / 16)];
    const left0 = bx - cw / 2, top0 = by - ch / 2;
    if (spreadX / 2 > Math.min(left0, srcW - left0 - cw) || spreadY / 2 > Math.min(top0, srcH - top0 - ch)) throw new Error(`${name}: camera moved ${spreadX.toFixed(0)}x${spreadY.toFixed(0)}px, more than the margin allows`);
    crop = (i) => ({ left: Math.round(left0 + px[Math.min(i, px.length - 1)][0] - midX), top: Math.round(top0 + px[Math.min(i, px.length - 1)][1] - midY), width: cw, height: ch });
    console.log(name, `camera moved ${spreadX.toFixed(0)}x${spreadY.toFixed(0)}px at source size, locked`);
  }
  let bytes = 0, w = 0, h = 0;
  for (let i = 0; i < files.length; i++) {
    const dest = path.join(out, files[i].replace('.png', '.webp'));
    let img = sharp(path.join(tmp, files[i]));
    if (crop) img = img.extract(crop(i));
    const info = await img.resize({ width: WIDTH, kernel: 'lanczos3' }).webp({ lossless: true, effort: 2 }).toFile(dest);
    bytes += info.size; w = info.width; h = info.height;
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ count: files.length, width: w, height: h, fps: 30 }));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(name, 'frames', files.length, `${w}x${h}`, 'total MB', (bytes / 1e6).toFixed(1));
}
