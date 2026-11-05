// Turns a stretch of video into numbered WebP frames for scroll scrubbing.
// Run from the repo root: node draft/tools/build-frames.mjs [clip name]
// A clip with `lock` follows the background and cancels the camera's movement, so the subject stays put in the frame.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../toolkit/x.js'));
const sharp = require('sharp');
const HOME = os.homedir();
const CLIPS = {
  seesaw: { src: `${HOME}/Downloads/maker_portfolio_v1.mp4`, ss: 21.03, t: 4.87, vf: 'fps=30' },
  dog: { src: `${HOME}/Downloads/robot dog photos icloud/IMG_2665.MOV`, ss: 14.8, t: 6, vf: 'fps=30', lock: { margin: 64 } },
};
const WIDTH = 1280, QUALITY = 72;

// Measures how far the background moved between frames, using patches around the edge of the picture.
function trackCamera(file, ss, t) {
  const W = 480, H = 270, PW = 48, PH = 32, R = 10;
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(ss), '-t', String(t), '-i', file, '-vf', `fps=30,scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 2 ** 31 });
  const n = Math.floor(raw.length / (W * H));
  const patches = [];
  for (const x of [6, 70, 150, 282, 362, 426]) patches.push([x, 226]);
  for (const x of [6, 426]) for (const y of [6, 50, 100, 150]) patches.push([x, y]);
  for (const x of [130, 220, 310]) patches.push([x, 6]);
  const sad = (a, b, x, y, dx, dy) => { let s = 0; for (let j = 0; j < PH; j += 2) for (let i = 0; i < PW; i += 2) s += Math.abs(a[(y + j) * W + x + i] - b[(y + j + dy) * W + x + i + dx]); return s; };
  const estimate = (a, b, [x, y]) => {
    let detail = 0;
    for (let j = 0; j < PH; j++) for (let i = 1; i < PW; i++) detail += Math.abs(a[(y + j) * W + x + i] - a[(y + j) * W + x + i - 1]);
    if (detail / (PW * PH) < 1.2) return null;
    let best = Infinity, bx = 0, by = 0;
    for (let dy = -R; dy <= R; dy++) { if (y + dy < 0 || y + dy + PH >= H) continue; for (let dx = -R; dx <= R; dx++) { if (x + dx < 0 || x + dx + PW >= W) continue; const s = sad(a, b, x, y, dx, dy); if (s < best) { best = s; bx = dx; by = dy; } } }
    const refine = (l, c, r) => { const d = l + r - 2 * c; return d > 0 ? (l - r) / (2 * d) : 0; };
    let fx = bx, fy = by;
    if (x + bx - 1 >= 0 && x + bx + 1 + PW < W) fx += refine(sad(a, b, x, y, bx - 1, by), best, sad(a, b, x, y, bx + 1, by));
    if (y + by - 1 >= 0 && y + by + 1 + PH < H) fy += refine(sad(a, b, x, y, bx, by - 1), best, sad(a, b, x, y, bx, by + 1));
    return [fx, fy];
  };
  const median = (v) => { const s = [...v].sort((p, q) => p - q); return s[s.length >> 1]; };
  const out = [[0, 0]];
  let cx = 0, cy = 0;
  for (let f = 1; f < n; f++) {
    const a = raw.subarray((f - 1) * W * H, f * W * H), b = raw.subarray(f * W * H, (f + 1) * W * H);
    const es = patches.map((p) => estimate(a, b, p)).filter(Boolean);
    if (es.length) { cx += median(es.map((e) => e[0])); cy += median(es.map((e) => e[1])); }
    out.push([cx, cy]);
  }
  return out.map(([x, y]) => [x / W, y / H]);
}

const only = process.argv[2];
for (const [name, c] of Object.entries(CLIPS)) {
  if (only && only !== name) continue;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'frames-'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(c.ss), '-t', String(c.t), '-i', c.src, '-an', '-vf', c.vf, path.join(tmp, '%04d.png')]);
  const out = path.join(here, '../media', name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
  const { width: srcW, height: srcH } = await sharp(path.join(tmp, files[0])).metadata();
  let crop = null;
  if (c.lock) {
    const track = trackCamera(c.src, c.ss, c.t);
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
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ count: files.length, width: w, height: h, fps: 30 }));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(name, 'frames', files.length, `${w}x${h}`, 'total MB', (bytes / 1e6).toFixed(1));
}
