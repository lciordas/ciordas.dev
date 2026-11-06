// Draws the asteroid project's one slide: the observation of 6249 Jennifer beside the paper's orbit and photometry
// plots, on a 3200×1800 grid. The vector plots come from the paper's PDF, drawn at 600 dpi; the exposure is the
// wider frame of the same field in toolkit/sources/ssp-6249-jennifer-field.png.
// Run from the repo root: node tools/build-ssp.mjs
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp');
const D = `${os.homedir()}/Downloads`;
const PAPER = `${D}/${fs.readdirSync(D).find((f) => f.startsWith('Orbit_Determination'))}`;
const OUT = path.join(here, '../media/projects/asteroid-orbit'), THUMBS = path.join(here, '../media/thumbs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ssp-'));
const run = (...a) => execFileSync(a[0], a.slice(1), { stdio: ['ignore', 'ignore', 'pipe'] });

const W = 3200, H = 1800, BG = '#171513', GAP = 70;

// The exposure (Figure 1), from the wider 907×583 frame of the same field Lucas kept (toolkit/sources, gitignored).
// Only what's in the frame is kept: the red circle is painted out with the median of the sky just outside it and
// drawn again as a clean vector ring; the sky is smoothed (σ 1.5 px) while the stars, found from where that smoothed
// image rises above the sky, keep a much lighter blur (σ 0.8 px); the black point sits at the sky level with a gentle
// gamma, and the frame is enlarged with lanczos3 and a light unsharp mask. No stars are added or moved.
const SRC = path.join(here, '../toolkit/sources/ssp-6249-jennifer-field.png');
const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width, h = info.height, CX = 476.34, CY = 200.49, R0 = 18, R1 = 27.5;   // the ring, from its red pixels
const g = new Float32Array(w * h), hidden = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) {
  const r = data[3 * i], gg = data[3 * i + 1], b = data[3 * i + 2], d = Math.hypot(i % w - CX, Math.floor(i / w) - CY);
  g[i] = gg; if (Math.max(r, gg, b) - Math.min(r, gg, b) > 6 || (d > R0 && d < R1)) hidden[i] = 1;
}
const median = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
const filled = g.slice();
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (!hidden[y * w + x]) continue; const v = [];
  for (let j = -12; j <= 12; j++) for (let i = -12; i <= 12; i++) {
    const X = x + i, Y = y + j;
    if (X >= 0 && Y >= 0 && X < w && Y < h && !hidden[Y * w + X] && Math.hypot(X - CX, Y - CY) >= R1) v.push(g[Y * w + X]);
  }
  filled[y * w + x] = median(v);
}
const gauss = (src, s) => {   // separable Gaussian, edges clamped
  const r = Math.ceil(3 * s), k = []; for (let i = -r; i <= r; i++) k.push(Math.exp(-i * i / (2 * s * s)));
  const sum = k.reduce((a, b) => a + b), t = new Float32Array(w * h), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) a += k[i + r] * src[y * w + Math.min(w - 1, Math.max(0, x + i))]; t[y * w + x] = a / sum; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) a += k[i + r] * t[Math.min(h - 1, Math.max(0, y + i)) * w + x]; o[y * w + x] = a / sum; }
  return o;
};
const heavy = gauss(filled, 1.5), light = gauss(filled, 0.8);
const SKY = median(Array.from(heavy)), SIG = 1.4826 * median(Array.from(heavy, (v) => Math.abs(v - SKY)));
const star = gauss(heavy.map((v) => Math.max(0, Math.min(1, (v - SKY - 2 * SIG) / (3 * SIG)))), 1.2);
const sky = Buffer.alloc(w * h);
for (let i = 0; i < w * h; i++) {
  const v = star[i] * light[i] + (1 - star[i]) * heavy[i];
  sky[i] = Math.round(255 * Math.max(0, Math.min(1, (v - SKY) / (248 - SKY))) ** 1.3);
}
// The exposure enlarged by k, cut to a width×height window whose top-left is at (x0, y0) in the enlarged frame.
const RING = '#ea0909';   // the same red as the original circle
const exposure = async (k, x0, y0, width, height) => {
  const big = await sharp(sky, { raw: { width: w, height: h, channels: 1 } }).resize(Math.round(w * k), Math.round(h * k), { kernel: 'lanczos3', fit: 'fill' })
    .sharpen({ sigma: 1, m1: 0, m2: 0.5 }).extract({ left: x0, top: y0, width, height }).toColourspace('srgb').png().toBuffer();
  const sw = Math.max(6, 3.4 * k);
  const ring = `<svg width="${width}" height="${height}"><circle cx="${(CX + 0.5) * k - x0}" cy="${(CY + 0.5) * k - y0}" r="${26 * k}" fill="none" stroke="${RING}" stroke-width="${sw}"/></svg>`;
  return sharp(big).composite([{ input: Buffer.from(ring) }]).png().toBuffer();
};

// A plot cut from the paper at 600 dpi: a box in points, trimmed to its ink.
const plot = async (page, x0, y0, x1, y1) => {
  const dpi = 600, s = dpi / 72, pre = path.join(tmp, `p${page}`);
  run('pdftoppm', '-r', String(dpi), '-f', String(page), '-l', String(page), '-singlefile', '-png', '-x', String(Math.round(x0 * s)), '-y', String(Math.round(y0 * s)), '-W', String(Math.round((x1 - x0) * s)), '-H', String(Math.round((y1 - y0) * s)), PAPER, pre);
  return sharp(await sharp(`${pre}.png`).flatten({ background: '#ffffff' }).png().toBuffer()).trim({ threshold: 12 }).png().toBuffer();
};
const orbit = await plot(8, 312, 496, 600, 662);         // Figure 7: the orbit, above its caption
const photometry = await plot(4, 40, 56, 574, 242);      // Figure 2: nightly photometric fits

// A white card holding a plot, the plot fitted inside a padded box.
const card = async (img, cw, ch, pad = 44) => {
  const fitted = await sharp(img).resize(cw - 2 * pad, ch - 2 * pad, { fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
  const m = await sharp(fitted).metadata();
  const bg = `<svg width="${cw}" height="${ch}"><rect width="${cw}" height="${ch}" rx="30" fill="#ffffff"/></svg>`;
  return { buf: await sharp(Buffer.from(bg)).composite([{ input: fitted, left: Math.round((cw - m.width) / 2), top: Math.round((ch - m.height) / 2) }]).png().toBuffer(), w: cw, h: ch };
};

// The exposure fills the left edge at full height, cut to a 1700 px column centred on the asteroid; the two plots
// stack on the right.
const KL = H / h, lw = 1700;
const left = await exposure(KL, Math.round((CX + 0.5) * KL - lw / 2), 0, lw, H);
const colX = lw + GAP, colW = W - colX - GAP;
const pm = await sharp(photometry).metadata(), om = await sharp(orbit).metadata();
const phH = Math.round((colW - 88) * pm.height / pm.width) + 88;
const orH = Math.min(H - 3 * GAP - phH, Math.round((colW - 88) * om.height / om.width) + 88);
const top = Math.round((H - orH - phH - GAP) / 2);
const c1 = await card(orbit, colW, orH), c2 = await card(photometry, colW, phH);
fs.mkdirSync(OUT, { recursive: true });
await sharp({ create: { width: W, height: H, channels: 3, background: BG } })
  .composite([{ input: left, left: 0, top: 0 }, { input: c1.buf, left: colX, top }, { input: c2.buf, left: colX, top: top + orH + GAP }])
  .webp({ quality: 88, effort: 6, smartSubsample: true }).toFile(path.join(OUT, 'collage.webp'));
// The overview's card: the exposure on its own.
const KT = 840 / 400;   // a 400 px square of the frame, the asteroid at its centre
await sharp(await exposure(KT, Math.round((CX + 0.5) * KT - 420), Math.max(0, Math.round((CY + 0.5) * KT - 420)), 840, 840)).webp({ quality: 74, effort: 6 }).toFile(path.join(THUMBS, 'asteroid-orbit.webp'));

fs.rmSync(tmp, { recursive: true, force: true });
console.log('collage KB', (fs.statSync(path.join(OUT, 'collage.webp')).size / 1e3).toFixed(0));
