// The micromanipulator's explanatory slides: the microstepping comparison, the magnet row's field, and the magnet arc
// on the motor horn. Run from the repo root: node tools/build-micro.mjs
// Sources: Lucas's microstepping comparison chart and his SRP presentation (page 7: field simulation and photo).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp');
const D = `${os.homedir()}/Downloads`;
const DECK = `${D}/SRP Micromanipulator Presentation - Lucas Ciordas.pdf`;
const OUT = path.join(here, '../media/projects/micromanipulator');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'micro-'));
fs.mkdirSync(OUT, { recursive: true });

// Embedded image `index` (0-based, in pdfimages order) on a page of the deck, at its original resolution.
const deckImage = (page, index) => {
  const pre = path.join(tmp, `p${page}`);
  execFileSync('pdfimages', ['-j', '-f', String(page), '-l', String(page), DECK, pre]);
  return `${pre}-${String(index).padStart(3, '0')}.jpg`;
};
// Slides show in a 16:9 frame about 1150 CSS px wide, so images are enlarged towards twice that with Lanczos and a
// light sharpen; none of the sources is that large.
const slide = async (name, src, { width, crop = null, flat = false, quality = 82 }) => {
  let img = sharp(src).rotate();
  if (crop) img = sharp(await img.extract(crop).png().toBuffer());
  if (flat) img = img.flatten({ background: '#ffffff' });
  await img.resize({ width, kernel: 'lanczos3' }).sharpen({ sigma: 0.6 }).webp({ quality, effort: 6 }).toFile(path.join(OUT, `${name}.webp`));
};

// 1. Traditional vs. geometric microstepping: phase currents, field angle, angle error (1413 x 900).
await slide('microstepping', `${D}/microstepping_comparison.png`, { width: 2000, flat: true });
// 2. Field lines above a row of alternating axial magnets, and the field direction along the row (2048 x 1260).
await slide('magnet-field', deckImage(7, 0), { width: 2048, flat: true });
// 3. The 17-magnet arc on the motor horn beside the MT6835 encoder board, cut 16:9 from the assembly photo.
await slide('magnet-arc', deckImage(7, 6), { width: 1792, crop: { left: 330, top: 1110, width: 1120, height: 630 }, quality: 80 });

fs.rmSync(tmp, { recursive: true, force: true });
