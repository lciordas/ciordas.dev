// The extra photos and short loops for the media stream under the robot dog's and the seesaw's videos, into
// media/projects/<id>. The pictures and clips the projects already had come from build-media.mjs.
// Run from the repo root: node tools/build-stream.mjs [project id]
// iPhone .MOV footage is HDR, so it goes through macOS's converter to standard video first (kept in toolkit/frames).
// A clip with `lock` follows the background and cancels the camera's movement, as in build-frames.mjs.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackCamera } from './track.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp');
const D = `${os.homedir()}/Downloads`, OLD = `${D}/old_clips`, BROLL = `${D}/maker portfolio b-roll`, DOG = `${D}/robot dog photos icloud`;
const OUT = path.join(here, '../media/projects'), FRAMES = path.join(here, '../toolkit/frames');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stream-'));
const run = (...a) => execFileSync(a[0], a.slice(1), { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 2 ** 31 });
let n = 0;
const temp = (ext) => path.join(tmp, `${n++}.${ext}`);
const encode = ['-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'slow', '-movflags', '+faststart'];

const sdr = (src) => {
  const o = path.join(FRAMES, `${path.basename(src).replace(/\.mov$/i, '').replace(/\s+/g, '-')}-sdr.mov`);
  if (!fs.existsSync(o)) run('avconvert', '-s', src, '-p', 'Preset1920x1080', '-o', o, '--replace');
  return o;
};
const frame = (src, t, trim = false) => { const o = temp('png'), raw = temp('png'); run('ffmpeg', '-v', 'error', '-y', '-ss', String(t), '-i', src, '-frames:v', '1', raw); return trim ? sharp(raw).trim({ threshold: 18 }).toFile(o).then(() => o) : raw; };
const heic = (p) => { const o = temp('jpg'); run('sips', '-s', 'format', 'jpeg', p, '--out', o); return o; };

const still = async (id, name, src, { width = 1100, crop = null } = {}) => {
  const dir = path.join(OUT, id); fs.mkdirSync(dir, { recursive: true });
  let img = sharp(await src).rotate();
  if (crop) img = sharp(await img.extract(crop).png().toBuffer());
  const info = await img.resize({ width, withoutEnlargement: true }).webp({ quality: 74, effort: 5 }).toFile(path.join(dir, `${name}.webp`));
  console.log(`${id}/${name}.webp`, `${info.width}x${info.height}`, (info.size / 1e3).toFixed(0), 'KB');
};
// Short muted loops, 720p. `crop` is a fraction of the frame [x, y, w, h], for a closer view. With `lock`, the
// margin in pixels the steadied picture can move within, `box` [centre x, centre y, w, h] in pixels picks the part kept.
const clip = async (id, name, src, ss, t, { crop = null, lock = 0, box = null, width = 1280 } = {}) => {
  const dir = path.join(OUT, id), dest = path.join(dir, `${name}.mp4`); fs.mkdirSync(dir, { recursive: true });
  const fit = `scale=${width}:-2,pad=ceil(iw/2)*2:ceil(ih/2)*2`;
  if (!lock) {
    const c = crop ? `crop=iw*${crop[2]}:ih*${crop[3]}:iw*${crop[0]}:ih*${crop[1]},` : '';
    run('ffmpeg', '-v', 'error', '-y', '-ss', String(ss), '-t', String(t), '-i', src, '-vf', `fps=30,${c}${fit}`, ...encode, dest);
  } else {
    // Each frame cut from where the background has moved to, so the camera holds still.
    const pngs = fs.mkdtempSync(path.join(tmp, 'f-'));
    run('ffmpeg', '-v', 'error', '-y', '-ss', String(ss), '-t', String(t), '-i', src, '-an', '-vf', 'fps=30', path.join(pngs, '%04d.png'));
    const files = fs.readdirSync(pngs).sort();
    const { width: W, height: H } = await sharp(path.join(pngs, files[0])).metadata();
    const px = trackCamera(src, ss, t).map(([x, y]) => [x * W, y * H]);
    const xs = px.map((p) => p[0]), ys = px.map((p) => p[1]), midX = (Math.min(...xs) + Math.max(...xs)) / 2, midY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const [bx, by, cw, ch] = box || [W / 2, H / 2, W - lock * 2, Math.round(((W - lock * 2) * 9) / 16)];
    const left0 = bx - cw / 2, top0 = by - ch / 2;
    if ((Math.max(...xs) - Math.min(...xs)) / 2 > Math.min(lock, left0, W - left0 - cw) || (Math.max(...ys) - Math.min(...ys)) / 2 > Math.min(top0, H - top0 - ch)) throw new Error(`${name}: camera moved ${(Math.max(...xs) - Math.min(...xs)).toFixed(0)}x${(Math.max(...ys) - Math.min(...ys)).toFixed(0)}px, more than the margin allows`);
    const out = fs.mkdtempSync(path.join(tmp, 'o-'));
    for (let i = 0; i < files.length; i++) {
      const [x, y] = px[Math.min(i, px.length - 1)];
      await sharp(path.join(pngs, files[i])).extract({ left: Math.round(left0 + x - midX), top: Math.round(top0 + y - midY), width: cw, height: ch }).png({ compressionLevel: 1 }).toFile(path.join(out, files[i]));
    }
    run('ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', path.join(out, '%04d.png'), '-vf', fit, ...encode, dest);
  }
  console.log(`${id}/${name}.mp4`, (fs.statSync(dest).size / 1e6).toFixed(2), 'MB');
};

const PROJECTS = {
  async 'robot-dog'() {
    // The CAD render from the old title card, without its lettering.
    await still('robot-dog', 'cad', frame(`${OLD}/13_dog_acrobat_cad_title.mp4`, 1), { crop: { left: 0, top: 90, width: 1080, height: 830 }, width: 1000 });
    // The leg designs that were considered, without the slide's heading.
    await still('robot-dog', 'leg-designs', frame(`${OLD}/14_dog_leg_designs_graphic.mp4`, 2), { crop: { left: 0, top: 210, width: 1920, height: 870 }, width: 1200 });
    // Poses held by the inverse kinematics, side on and head on.
    for (const [name, img] of [['pose-crouch', 2664], ['pose-pitch', 2692], ['pose-roll', 2694], ['pose-front', 2710], ['pose-tilt', 2720], ['pose-rear', 2733], ['pose-low', 2749]]) await still('robot-dog', name, heic(`${DOG}/IMG_${img}.HEIC`), { width: 1000 });
    // Side on, close in, the body moving through poses over its planted feet. The camera was still here.
    await clip('robot-dog', 'poses', sdr(`${DOG}/IMG_2665.MOV`), 28.5, 5.5, { crop: [0.12, 0.08, 0.76, 0.76] });
    // Head on, swaying, filmed upright before the phone was turned on its side.
    await clip('robot-dog', 'sway', sdr(`${BROLL}/quadrupedgyratingfrontview.MOV`), 0.3, 4.8, { lock: 60, box: [500, 880, 900, 750], width: 900 });
  },
  async 'pid-seesaw'() {
    await still('pid-seesaw', 'lego-top', frame(`${OLD}/02_seesaw_lego_topdown.mp4`, 0.4, true), { width: 1000 });
    await still('pid-seesaw', 'lego-base', frame(`${OLD}/04_seesaw_lego_baseplate_vertical.mp4`, 1.5, true), { width: 800 });
    await clip('pid-seesaw', 'arduino', `${OLD}/05_seesaw_lego_with_arduino.mp4`, 0, 4.8);
    for (const [name, img] of [['beam', 'IMG_1290.HEIC'], ['beam-low', 'IMG_1299.HEIC'], ['beam-warm', 'IMG_1300.heic']]) await still('pid-seesaw', name, heic(`${D}/${img}`), { width: 1000 });
    // Close on the ball: knocked and brought back to the middle.
    await clip('pid-seesaw', 'pokes', path.join(FRAMES, 'IMG_1256-sdr.mov'), 20.5, 6.5, { crop: [0.08, 0.12, 0.82, 0.82] });
  },
};
fs.mkdirSync(FRAMES, { recursive: true });
const only = process.argv[2];
for (const [id, build] of Object.entries(PROJECTS)) if (!only || only === id) await build();
fs.rmSync(tmp, { recursive: true, force: true });
