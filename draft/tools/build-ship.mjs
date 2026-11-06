// Cuts the short build video for the ship in a bottle page from the long YouTube video, hard cuts in build order.
// Run from the repo root: node draft/tools/build-ship.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = `${os.homedir()}/Downloads/YTDown.com_YouTube_Media_3DkmBDOjDKI_Building-a-Ship-in-a-Bottle-From-Scratch_001_720p.mp4`;
const OUT = path.join(here, '../media/projects/ship-in-a-bottle/build.mp4');
const encode = ['-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '26', '-preset', 'slow', '-movflags', '+faststart'];
// [start, duration] in seconds of the source. None of these has on-screen text.
const CUTS = [
  [40.0, 2.3], // shaping the hull block with the rotary tool
  [84.25, 2.2], // carving the recessed deck in the vise
  [152.25, 1.45], // painting the stripe along the hull
  [246.25, 2.2], // bending the wire railing with pliers
  [297.0, 2.0], // the finished hull turned in the hand
  [319.5, 2.2], // drilling a mast with the pin vise
  [510.0, 2.5], // tying off rigging with tweezers
  [587.0, 2.5], // gluing the sails on
  [624.0, 2.0], // the rigged ship with all its sails
  [712.1, 2.4], // the hull set down on its stand inside the bottle
  [771.0, 2.3], // the folded ship going through the neck
  [789.5, 2.5], // lowering it onto the hull
  [803.2, 2.3], // pulling the lines to raise the masts
  [831.0, 2.8], // the finished ship in the bottle
];
const inputs = CUTS.flatMap(([ss, t]) => ['-ss', String(ss), '-t', String(t), '-i', SRC]);
const chains = CUTS.map((_, i) => `[${i}:v]setpts=PTS-STARTPTS,fps=30,scale=1280:720,setsar=1[v${i}]`).join(';'); // the source is already 16:9
const filter = `${chains};${CUTS.map((_, i) => `[v${i}]`).join('')}concat=n=${CUTS.length}:v=1[o]`;
execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-map', '[o]', ...encode, OUT]);
console.log('build', (fs.statSync(OUT).size / 1e6).toFixed(1), 'MB', CUTS.reduce((s, [, t]) => s + t, 0).toFixed(1), 's');
