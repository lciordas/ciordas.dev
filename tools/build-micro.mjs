// The micromanipulator's explanatory slides, shown in its scrolling window after the video: the microstepping
// comparison, and the magnet row's field beside the magnet arc on the motor horn. Run from the repo root: node tools/build-micro.mjs
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
// 2. The magnet slide: the field above a row of alternating axial magnets (2048 x 1260, trimmed to its frames) beside
// the 17-magnet arc on the motor horn passing the MT6835 encoder board, cut upright from the assembly photo
// (1536 x 2048) and enlarged to the same height, corners rounded. Side by side on white, about 2.5 : 1.
{
  const H = 1194, GAP = 64, PAD = 24, R = 28;
  const field = await sharp(deckImage(7, 0)).flatten({ background: '#ffffff' }).trim({ background: '#ffffff', threshold: 40 })
    .resize({ height: H, kernel: 'lanczos3' }).png().toBuffer({ resolveWithObject: true });
  const crop = { left: 700, top: 1090, width: 600, height: 724 }, pw = Math.round(H * crop.width / crop.height);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${H}"><rect width="${pw}" height="${H}" rx="${R}" fill="#fff"/></svg>`);
  const photo = await sharp(deckImage(7, 6)).extract(crop).resize({ width: pw, height: H, kernel: 'lanczos3' }).sharpen({ sigma: 0.7 })
    .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const fw = field.info.width, W = PAD * 2 + fw + GAP + pw;
  const sheet = await sharp({ create: { width: W, height: H + PAD * 2, channels: 3, background: '#ffffff' } })
    .composite([{ input: field.data, left: PAD, top: PAD }, { input: photo, left: PAD + fw + GAP, top: PAD }]).png().toBuffer();
  await sharp(sheet).resize({ width: 2560, kernel: 'lanczos3' }).sharpen({ sigma: 0.5 }).webp({ quality: 84, effort: 6 }).toFile(path.join(OUT, 'magnets.webp'));
}

fs.rmSync(tmp, { recursive: true, force: true });
