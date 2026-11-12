// Cuts the short build video for the ship in a bottle page from the long YouTube video, hard cuts, about 14 s.
// Run from the repo root: node tools/build-ship.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = `${os.homedir()}/Downloads/YTDown.com_YouTube_Media_3DkmBDOjDKI_Building-a-Ship-in-a-Bottle-From-Scratch_001_720p.mp4`;
const OUT = path.join(here, '../media/projects/ship-in-a-bottle/build.mp4');
const encode = ['-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '26', '-preset', 'slow', '-movflags', '+faststart'];
// [start, duration] in seconds of the source. None of these has on-screen text, and each starts mid-motion. It opens
// on the finished ship in its bottle, framed much like the photo the page shows before it, then runs through the
// build and ends raising the masts inside, which loops back round to the finished ship.
const CUTS = [
  [831.2, 1.4], // the finished ship in the bottle
  [40.0, 1.5], // shaping the hull block with the rotary tool
  [84.3, 1.5], // carving the recessed deck in the vise
  [246.3, 1.4], // bending the wire railing with pliers
  [319.5, 1.4], // drilling a mast with the pin vise
  [510.0, 1.5], // tying off rigging with tweezers
  [716.2, 1.5], // the clothes-hanger tool setting the hull down inside the bottle
  [771.2, 1.6], // the folded ship going through the neck
  [803.2, 1.9], // pulling the lines to raise the masts
];
const inputs = CUTS.flatMap(([ss, t]) => ['-ss', String(ss), '-t', String(t), '-i', SRC]);
const chains = CUTS.map((_, i) => `[${i}:v]setpts=PTS-STARTPTS,fps=30,scale=1280:720,setsar=1[v${i}]`).join(';'); // the source is already 16:9
const filter = `${chains};${CUTS.map((_, i) => `[v${i}]`).join('')}concat=n=${CUTS.length}:v=1[o]`;
execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-map', '[o]', ...encode, OUT]);
console.log('build', (fs.statSync(OUT).size / 1e6).toFixed(1), 'MB', CUTS.reduce((s, [, t]) => s + t, 0).toFixed(1), 's');
