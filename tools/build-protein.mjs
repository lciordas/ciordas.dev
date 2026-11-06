// The Alzheimer's protein classifier's slide: the project's four charts (accuracy against dataset size for the protein
// and genome models, and the sequence length histograms) on one white 3200×1800 slide. The charts come from Lucas's
// screenshot of his write-up, toolkit/sources/protein-figures.png (3456×1910). Each is cut from its quarter with its
// "Fig." label, trimmed to its ink, and all four are scaled by one factor so their lettering matches; they only
// shrink a little, so nothing is upscaled. Run from the repo root: node tools/build-protein.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp');
const SRC = path.join(here, '../toolkit/sources/protein-figures.png');
const OUT = path.join(here, '../media/projects/protein-classifier');

// Quarters of the screenshot in its pixels, clear of the rule along its top edge and the line along its bottom.
const COLS = [[60, 1905], [1905, 3456]], ROWS = [[30, 975], [975, 1895]];
const W = 3200, H = 1800, M = 56, GX = 90, GY = 70;

const flat = await sharp(SRC).flatten({ background: '#fff' }).png().toBuffer();
const charts = [];
for (const [top, bottom] of ROWS) for (const [left, right] of COLS) {
  const cut = await sharp(flat).extract({ left, top, width: right - left, height: bottom - top }).png().toBuffer();
  const { data, info } = await sharp(cut).trim({ background: '#fff', threshold: 24 }).png().toBuffer({ resolveWithObject: true });
  charts.push({ buf: data, w: info.width, h: info.height });
}
// One scale for all four, as large as the slide allows in a 2×2 grid.
const colW = [0, 1].map((c) => Math.max(charts[c].w, charts[c + 2].w)), rowH = [0, 1].map((r) => Math.max(charts[2 * r].h, charts[2 * r + 1].h));
const s = Math.min(1, (W - 2 * M - GX) / (colW[0] + colW[1]), (H - 2 * M - GY) / (rowH[0] + rowH[1]));
const x0 = Math.round((W - s * (colW[0] + colW[1]) - GX) / 2), y0 = Math.round((H - s * (rowH[0] + rowH[1]) - GY) / 2);
const comps = await Promise.all(charts.map(async (c, i) => {
  const col = i % 2, row = i >> 1, w = Math.round(c.w * s), h = Math.round(c.h * s);
  const cx = x0 + (col ? Math.round(s * colW[0]) + GX : 0), cy = y0 + (row ? Math.round(s * rowH[0]) + GY : 0);
  // Each chart sits at the top of its cell, centred across it.
  const left = cx + Math.round((s * colW[col] - w) / 2), top = cy;
  let img = sharp(c.buf).resize(w, h, { kernel: 'lanczos3' });
  if (s < 0.98) img = img.sharpen({ sigma: 0.5 });
  return { input: await img.png().toBuffer(), left, top };
}));
fs.mkdirSync(OUT, { recursive: true });
const slide = sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite(comps);
// Lossless: thin coloured lines and small grey type on white blur under lossy chroma subsampling.
await slide.webp({ lossless: true, effort: 6 }).toFile(path.join(OUT, 'charts.webp'));
console.log('scale', s.toFixed(3), 'charts.webp', `${(fs.statSync(path.join(OUT, 'charts.webp')).size / 1024).toFixed(0)} KB`);
