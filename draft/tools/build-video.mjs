// Cuts short muted web videos from source footage.
// Run from the repo root: node draft/tools/build-video.mjs [clip name]
// A clip with `follow` keeps its subject in the middle of the frame and removes camera shake from around it.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackCamera, trackSubject, lowpass } from './track.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../toolkit/x.js'));
const sharp = require('sharp');
const HOME = os.homedir(), OUT = path.join(here, '../media/video');
const MAKER = `${HOME}/Downloads/maker_portfolio_v1.mp4`, ICLOUD = `${HOME}/Downloads/iCloud Photos`;
const encode = ['-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart'];
const CLIPS = {
  // The hand placing the ball comes first. It cuts to the pen striking the ball at the moment the ball and beam
  // sit in the same place in both shots. Both stretches of the portfolio video have no code on screen.
  seesaw() {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '13.4', '-t', '1.7', '-i', MAKER, '-ss', '20.867', '-t', '5.1', '-i', MAKER, '-filter_complex', '[0:v]setpts=PTS-STARTPTS,fps=30,scale=1280:720[a];[1:v]setpts=PTS-STARTPTS,fps=30,scale=1280:720[b];[a][b]concat=n=2:v=1[o]', '-map', '[o]', ...encode, path.join(OUT, 'seesaw.mp4')]);
  },
  // The micromanipulator on the desk, its end effector moved by hand. The model lines up with the first frame.
  micromanipulator() {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '48.2', '-t', '5.3', '-i', MAKER, '-vf', 'fps=30,scale=1280:720', ...encode, path.join(OUT, 'micromanipulator.mp4')]);
  },
  // The dog already mid-stride on the mat, held in the middle of the frame.
  async 'dog-walk'() {
    const src = `${HOME}/Downloads/maker portfolio b-roll/quadruped walking.MOV`, ss = 6.5, t = 7, box = { x: 0.45, y: 0.2, w: 0.34, h: 0.32 };
    const subject = lowpass(trackSubject(src, ss, t, box), 12);
    const camera = trackCamera(src, ss, t), slow = lowpass(camera, 8);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'walk-'));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(ss), '-t', String(t), '-i', src, '-an', '-vf', 'fps=30', path.join(tmp, '%04d.png')]);
    const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
    const srcW = 1920, srcH = 1080, cw = 1600, ch = 900, at = (a, i) => a[Math.min(i, a.length - 1)];
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'walkout-'));
    for (let i = 0; i < files.length; i++) {
      const [sx, sy] = at(subject, i), [cx, cy] = at(camera, i), [lx, ly] = at(slow, i);
      const fx = (sx + box.w / 2 + cx - lx) * srcW, fy = (sy + box.h / 2 + cy - ly) * srcH;
      const left = Math.max(0, Math.min(srcW - cw, Math.round(fx - cw / 2))), top = Math.max(0, Math.min(srcH - ch, Math.round(fy - ch * 0.36)));
      await sharp(path.join(tmp, files[i])).extract({ left, top, width: cw, height: ch }).resize({ width: 1280 }).png({ compressionLevel: 1 }).toFile(path.join(out, files[i]));
    }
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', path.join(out, '%04d.png'), ...encode, path.join(OUT, 'dog-walk.mp4')]);
    fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true });
  },
};
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
for (const [name, build] of Object.entries(CLIPS)) {
  if (only && only !== name) continue;
  await build();
  console.log(name, (fs.statSync(path.join(OUT, `${name}.mp4`)).size / 1e6).toFixed(1), 'MB');
}
