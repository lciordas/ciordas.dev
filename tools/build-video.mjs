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
const encode = ['-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart'];
const CLIPS = {
  // The raw recordings, converted from HDR to standard video by macOS: the hand placing the ball and the ball
  // settling, then a cut, with the ball in the same spot, to the pen knocking it three times and the beam bringing it back each time.
  // The first frame is the one the model is lined up with.
  seesaw() {
    const sdr = (name) => { const o = path.join(FRAMES, `${name}-sdr.mov`); if (!fs.existsSync(o)) execFileSync('avconvert', ['-s', `${HOME}/Downloads/${name}.MOV`, '-p', 'Preset1920x1080', '-o', o, '--replace']); return o; };
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '3.604', '-t', '3.7', '-i', sdr('IMG_1275'), '-ss', '10.0', '-t', '10.4', '-i', sdr('IMG_1256'), '-filter_complex', '[0:v]setpts=PTS-STARTPTS,fps=30,scale=1920:1080:flags=lanczos[a];[1:v]setpts=PTS-STARTPTS,fps=30,scale=1920:1080:flags=lanczos[b];[a][b]concat=n=2:v=1[o]', '-map', '[o]', ...encode, path.join(OUT, 'seesaw.mp4')]);
  },
  // The micromanipulator on the desk, its end effector moved by hand. The model lines up with the first frame.
  micromanipulator() {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '48.2', '-t', '5.3', '-i', MAKER, '-vf', 'fps=30,scale=1920:1080:flags=lanczos', ...encode, path.join(OUT, 'micromanipulator.mp4')]);
  },
  // The dog's highlight cut: the liveliest stretch of each of its shots, back to back with hard cuts, each one already
  // moving when it starts. All but the walk come steadied from build-frames.mjs, so run that and 'dog-walk' first; the
  // trims below are frames into those clips, at 30 fps throughout so no frame is ever repeated or dropped. The last shot
  // cuts straight back into the first when the video loops. Each cut starts a keyframe.
  dog() {
    const shots = [
      [`${FRAMES}/dog/%04d.webp`, 0, 51], // 0 to 1.7 s, side on: pitching nose down, then settling level; its first frame is the one the model lines up with
      [`${FRAMES}/dog-front/%04d.webp`, 96, 153], // 1.7 to 3.6 s, head on: gyrating, one side of the body tilting up, then the other
      [path.join(FRAMES, 'dog-walk.mp4'), 136, 190], // 3.6 to 5.4 s, walking on the mat, mid-stride
      [`${FRAMES}/dog-quarter/%04d.webp`, 5, 59], // 5.4 to 7.2 s, front three-quarter: the side-to-side level change, rising and rolling away, then dropping low
    ];
    const inputs = shots.flatMap(([file]) => [...(file.endsWith('.webp') ? ['-framerate', '30'] : []), '-i', file]);
    const chains = shots.map(([, a, b], i) => `[${i}:v]trim=start_frame=${a}:end_frame=${b},setpts=N/30/TB,scale=1920:1080:flags=lanczos,setsar=1[s${i}]`);
    let at = 0; const cuts = shots.slice(0, -1).map(([, a, b]) => ((at += b - a) / 30).toFixed(4));
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', `${chains.join(';')};${shots.map((_, i) => `[s${i}]`).join('')}concat=n=${shots.length}:v=1,fps=30[o]`, '-map', '[o]',
      ...encode, '-force_key_frames', `0,${cuts.join(',')}`, path.join(OUT, 'dog.mp4')]);
  },
  // The chess engine's own window from the screen recording: the board and its status line ("thinking..."), from the
  // first move to the engine's last reply before the recording ends, played at 1.6x so the pauses stay short.
  chess() {
    const src = `${HOME}/Downloads/maker portfolio b-roll/chess engine gui screen recording.mov`, out = path.join(here, '../media/projects/chess-engine/game.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1.0', '-t', '32.6', '-i', src, '-vf', 'crop=1600:1664:876:274,setpts=(PTS-STARTPTS)/1.6,fps=30,scale=-2:1080:flags=lanczos', ...encode.map((v) => (v === '20' ? '27' : v)), out]);
    return out;
  },
  // The dog already mid-stride on the mat, held in the middle of the frame. Kept at the crop's own 1600x900, and
  // scaled up to 1080p when it's joined into the dog's video.
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
      await sharp(path.join(tmp, files[i])).extract({ left, top, width: cw, height: ch }).png({ compressionLevel: 1 }).toFile(path.join(out, files[i]));
    }
    // Kept near lossless, as it's encoded again when it's joined into the dog's video.
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', path.join(out, '%04d.png'), ...encode.map((v) => (v === '20' ? '8' : v)), path.join(FRAMES, 'dog-walk.mp4')]);
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
