// Cuts short muted web videos from source footage.
// Run from the repo root: node tools/build-video.mjs [clip name]
// A clip with `follow` keeps its subject in the middle of the frame and removes camera shake from around it.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackCamera, trackSubject, lowpass } from './track.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp');
const HOME = os.homedir(), OUT = path.join(here, '../media/video'), FRAMES = path.join(here, '../toolkit/frames');
const MAKER = `${HOME}/Downloads/maker_portfolio_v1.mp4`, ICLOUD = `${HOME}/Downloads/iCloud Photos`;
const encode = ['-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart'];
const CLIPS = {
  // The raw recordings, converted from HDR to standard video by macOS: the hand placing the ball and the ball
  // settling, then a cut, with the ball in the same spot, to the pen knocking it three times and the beam bringing it back each time.
  // The first frame is the one the model is lined up with.
  seesaw() {
    const sdr = (name) => { const o = path.join(FRAMES, `${name}-sdr.mov`); if (!fs.existsSync(o)) execFileSync('avconvert', ['-s', `${HOME}/Downloads/${name}.MOV`, '-p', 'Preset1920x1080', '-o', o, '--replace']); return o; };
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '3.604', '-t', '3.7', '-i', sdr('IMG_1275'), '-ss', '10.0', '-t', '10.4', '-i', sdr('IMG_1256'), '-filter_complex', '[0:v]setpts=PTS-STARTPTS,fps=30,scale=1280:720[a];[1:v]setpts=PTS-STARTPTS,fps=30,scale=1280:720[b];[a][b]concat=n=2:v=1[o]', '-map', '[o]', ...encode, path.join(OUT, 'seesaw.mp4')]);
  },
  // The micromanipulator on the desk, its end effector moved by hand. The model lines up with the first frame.
  micromanipulator() {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '48.2', '-t', '5.3', '-i', MAKER, '-vf', 'fps=30,scale=1280:720', ...encode, path.join(OUT, 'micromanipulator.mp4')]);
  },
  // The dog's four shots back to back with hard cuts: side on, front three-quarter, head on, then walking. The
  // first three come steadied from build-frames.mjs, so run that and 'dog-walk' first.
  dog() {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', `${FRAMES}/dog/%04d.webp`, '-framerate', '30', '-i', `${FRAMES}/dog-quarter/%04d.webp`, '-framerate', '24', '-i', `${FRAMES}/dog-front/%04d.webp`, '-i', path.join(FRAMES, 'dog-walk.mp4'),
      '-filter_complex', '[0:v]fps=30,setsar=1[a];[1:v]fps=30,setsar=1[q];[2:v]fps=30,setsar=1[b];[3:v]fps=30,scale=1280:720,setsar=1[c];[a][q][b][c]concat=n=4:v=1[o]', '-map', '[o]', ...encode.map((v) => (v === '24' ? '27' : v)), path.join(OUT, 'dog.mp4')]); // a little lighter, being the longest
  },
  // The chess engine's own window from the screen recording: the board and its status line ("thinking..."), from the
  // first move to the engine's last reply before the recording ends, played at 1.6x so the pauses stay short.
  chess() {
    const src = `${HOME}/Downloads/maker portfolio b-roll/chess engine gui screen recording.mov`, out = path.join(here, '../media/projects/chess-engine/game.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1.0', '-t', '32.6', '-i', src, '-vf', 'crop=1600:1664:876:274,setpts=(PTS-STARTPTS)/1.6,fps=30,scale=-2:1080:flags=lanczos', ...encode.map((v) => (v === '24' ? '27' : v)), out]);
    return out;
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
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', path.join(out, '%04d.png'), ...encode, path.join(FRAMES, 'dog-walk.mp4')]);
    fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true });
  },
};
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(FRAMES, { recursive: true });
const only = process.argv[2];
for (const [name, build] of Object.entries(CLIPS)) {
  if (only && only !== name) continue;
  const made = (await build()) ?? [OUT, FRAMES].map((d) => path.join(d, `${name}.mp4`)).find((f) => fs.existsSync(f));
  console.log(name, (fs.statSync(made).size / 1e6).toFixed(1), 'MB');
}
