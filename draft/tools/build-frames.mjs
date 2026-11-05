// Turns a stretch of video into numbered WebP frames for scroll scrubbing.
// Run from the repo root: node draft/tools/build-frames.mjs
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
  dog: { src: `${HOME}/Downloads/robot dog photos icloud/IMG_2666.MOV`, ss: 12.0, t: 5.0, vf: 'fps=30,crop=1690:950:0:60' },
};
const WIDTH = 1280, QUALITY = 72;
for (const [name, c] of Object.entries(CLIPS)) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'frames-'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(c.ss), '-t', String(c.t), '-i', c.src, '-an', '-vf', c.vf, path.join(tmp, '%04d.png')]);
  const out = path.join(here, '../media', name);
  fs.mkdirSync(out, { recursive: true });
  const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
  let bytes = 0, w = 0, h = 0;
  for (const f of files) {
    const dest = path.join(out, f.replace('.png', '.webp'));
    const info = await sharp(path.join(tmp, f)).resize({ width: WIDTH }).webp({ quality: QUALITY, effort: 5 }).toFile(dest);
    bytes += info.size; w = info.width; h = info.height;
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ count: files.length, width: w, height: h, fps: 30 }));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(name, 'frames', files.length, `${w}x${h}`, 'total MB', (bytes / 1e6).toFixed(1));
}
