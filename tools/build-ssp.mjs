// Draws the asteroid project's one slide: the observation of 6249 Jennifer beside the paper's orbit and photometry
// plots, on a 3200×1800 grid. Everything comes from the paper's PDF: the exposure is pulled out at its native
// 441×442 pixels (no page rasterizing), and the vector plots are drawn at 600 dpi.
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

// The exposure (Figure 1). The paper's red circle is painted out with the sky just beyond it and drawn again as a
// clean vector ring; the sky is lightly smoothed and its black point set at the background level, so the noise
// floor goes dark and the stars stay as they are.
run('pdfimages', '-png', '-f', '3', '-l', '3', PAPER, path.join(tmp, 'fig1'));
const { data, info } = await sharp(path.join(tmp, 'fig1-000.png')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width, h = info.height, CX = 210.45, CY = 200.5, R = 23;   // the ring, measured from its red pixels
const g = new Float32Array(w * h);
for (let i = 0; i < w * h; i++) g[i] = data[3 * i] * 0.3 + data[3 * i + 1] * 0.59 + data[3 * i + 2] * 0.11;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const dx = x - CX, dy = y - CY, r = Math.hypot(dx, dy);
  if (r < 18.5 || r > 27.5) continue;
  const rr = r + 11; g[y * w + x] = g[Math.round(CY + dy / r * rr) * w + Math.round(CX + dx / r * rr)];
}
const gray = Buffer.from(g.map((v) => Math.round(v)));
const smooth = await sharp(gray, { raw: { width: w, height: h, channels: 1 } }).blur(0.7).extractChannel(0).raw().toBuffer();
const BLACK = 70;   // the sky median; its spread is about 23
const sky = Buffer.from(smooth.map((v) => Math.round(255 * Math.max(0, Math.min(1, (v - BLACK) / (255 - BLACK))))));
// The exposure at a given height, optionally cropped to columns x0..x0+cw of the original.
const exposure = async (height, x0 = 0, cw = w) => {
  const k = height / h, width = Math.round(cw * k);
  const ring = `<svg width="${width}" height="${height}"><circle cx="${(CX + 0.5 - x0) * k}" cy="${(CY + 0.5) * k}" r="${(R + 1) * k}" fill="none" stroke="#ff3b30" stroke-width="${3.2 * k}"/></svg>`;
  const img = await sharp(sky, { raw: { width: w, height: h, channels: 1 } }).extract({ left: x0, top: 0, width: cw, height: h }).resize(width, height, { kernel: 'lanczos3', fit: 'fill' }).toColourspace('srgb').png().toBuffer();
  return sharp(img).composite([{ input: Buffer.from(ring) }]).png().toBuffer();
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

// The exposure fills the left edge, cropped to a column centred on the asteroid; the two plots stack on the right.
const left = await exposure(H, 20, 380), lw = (await sharp(left).metadata()).width;
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
await sharp(await exposure(840)).resize(840, 840, { fit: 'cover' }).webp({ quality: 74, effort: 6 }).toFile(path.join(THUMBS, 'asteroid-orbit.webp'));

fs.rmSync(tmp, { recursive: true, force: true });
console.log('collage KB', (fs.statSync(path.join(OUT, 'collage.webp')).size / 1e3).toFixed(0));
