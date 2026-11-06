// Draws the NeurIPS paper's cover for the overview and its title and programme slides, with the site's fonts.
// Run from the repo root: node tools/build-paper.mjs
// Sources, downloaded once into toolkit/sources: the NeurIPS logo from neurips.cc, and Benh LIEU SONG's photo of the
// Sydney Opera House and Harbour Bridge from Wikimedia Commons (CC BY-SA 4.0, credited in the slide's caption).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp'), opentype = require('opentype.js');
const SRC = path.join(here, '../toolkit/sources'), FONTS = path.join(here, '../toolkit/node_modules/@fontsource');
const OUT = path.join(here, '../media/projects/world-models'), THUMBS = path.join(here, '../media/thumbs');
const get = (name, url) => { const f = path.join(SRC, name); if (!fs.existsSync(f)) { fs.mkdirSync(SRC, { recursive: true }); execFileSync('curl', ['-sL', '-A', 'ciordas-dev-site/1.0', '-o', f, url]); } return f; };
const photo = get('sydney.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/Sydney_Opera_House_and_Harbour_Bridge_Dusk_%283%29_2019-06-21.jpg/1920px-Sydney_Opera_House_and_Harbour_Bridge_Dusk_%283%29_2019-06-21.jpg');
const logo = get('neurips-logo.svg', 'https://neurips.cc/static/core/img/neurips-navbar-logo.svg');
const font = (pkg, file) => { const b = fs.readFileSync(path.join(FONTS, pkg, 'files', file)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const BLACK = font('barlow-condensed', 'barlow-condensed-latin-900-normal.woff');
const MED = font('hanken-grotesk', 'hanken-grotesk-latin-500-normal.woff'), SEMI = font('hanken-grotesk', 'hanken-grotesk-latin-600-normal.woff'), REG = font('hanken-grotesk', 'hanken-grotesk-latin-400-normal.woff');

// Text as SVG paths, so the fonts don't need installing. Glyph by glyph with kerning, which these fonts need no more
// than. Runs is a list of [text, colour] pieces on one line.
const advance = (f, s, size, ls = 0) => {
  let w = 0, prev = null;
  for (const ch of s) { const g = f.charToGlyph(ch); if (prev) w += f.getKerningValue(prev, g) * size / f.unitsPerEm; w += g.advanceWidth * size / f.unitsPerEm + ls * size; prev = g; }
  return w - (s.length ? ls * size : 0);
};
const width = advance;
// The library's own path writer rounds some numbers to NaN, so the path is written out here.
const n = (v) => (Math.round(v * 100) / 100).toString();
const pathData = (p) => p.commands.map((c) => c.type === 'Z' ? 'Z' : c.type === 'Q' ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}` : c.type === 'C' ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}` : `${c.type}${n(c.x)} ${n(c.y)}`).join('');
function line(f, runs, size, x, y, { ls = 0 } = {}) {
  let out = '', cx = x, prev = null;
  for (const [s, fill] of runs) {
    for (const ch of s) {
      const g = f.charToGlyph(ch);
      if (prev) cx += f.getKerningValue(prev, g) * size / f.unitsPerEm;
      const d = pathData(g.getPath(cx, y, size));
      if (d) out += `<path fill="${fill}" d="${d}"/>`;
      cx += g.advanceWidth * size / f.unitsPerEm + ls * size; prev = g;
    }
  }
  return out;
}
function wrap(f, s, size, max, ls = 0) {
  const lines = []; let cur = '';
  for (const w of s.split(' ')) { const t = cur ? `${cur} ${w}` : w; if (cur && width(f, t, size, ls) > max) { lines.push(cur); cur = w; } else cur = t; }
  return [...lines, cur];
}
const INK = '#f4efe8', MUTED = 'rgba(244,239,232,.68)', ACCENT = '#ffb98a';
const TITLE = 'Plan Shallow While You Learn', SUB = 'Reallocating Planning Compute During World-Model Adaptation';
const AUTHORS = [['Nicholas Ciordas', INK], ['  ·  ', MUTED], ['Jan Safrata', INK], ['  ·  ', MUTED], ['Lucas Ciordas', ACCENT], ['  ·  ', MUTED], ['David Safrata', INK]];
const logoPng = (h) => sharp(fs.readFileSync(logo), { density: Math.round((h / 36) * 72) }).png().toBuffer();
const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);

// The photo with a dark wash on the left and bottom, where the words sit.
async function backdrop(w, h, crop, shade) {
  const base = await sharp(photo).extract(crop).resize(w, h, { fit: 'cover' }).modulate({ brightness: 0.92 }).toBuffer();
  return sharp(base).composite([{ input: svg(w, h, shade) }]);
}

async function cover() {
  const S = 840, body = [];
  const t = wrap(BLACK, TITLE.toUpperCase(), 92, S * 0.74, 0.01);
  let y = S * 0.86 - (t.length - 1) * 88;
  body.push(line(MED, [['NEURIPS 2026 WORKSHOP', ACCENT]], 24, S * 0.13, y - 92, { ls: 0.16 }));
  t.forEach((l) => { body.push(line(BLACK, [[l, INK]], 92, S * 0.13, y, { ls: 0.01 })); y += 88; });
  const shade = `<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#080706" stop-opacity=".8"/><stop offset=".34" stop-color="#080706" stop-opacity=".3"/><stop offset=".62" stop-color="#080706" stop-opacity=".72"/><stop offset="1" stop-color="#080706" stop-opacity=".94"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#b)"/>${body.join('')}`;
  const img = await backdrop(S, S, { left: 230, top: 0, width: 759, height: 759 }, shade);
  const lg = await logoPng(240);
  await sharp(await img.toBuffer()).composite([{ input: lg, left: Math.round(S * 0.085), top: Math.round(S * 0.07) }]).webp({ quality: 80, effort: 5 }).toFile(path.join(THUMBS, 'world-models.webp'));
}

async function title() {
  const W = 1600, H = 900, X = 110, body = [];
  body.push(line(MED, [['CONTINUAL WORLD MODELS WORKSHOP  ·  NEURIPS 2026', ACCENT]], 22, X, 318, { ls: 0.16 }));
  let y = 432;
  wrap(BLACK, TITLE.toUpperCase(), 124, 900, 0.005).forEach((l) => { body.push(line(BLACK, [[l, INK]], 124, X, y, { ls: 0.005 })); y += 114; });
  y -= 46;
  wrap(MED, SUB, 34, 900).forEach((l) => { body.push(line(MED, [[l, INK]], 34, X, y)); y += 46; });
  body.push(line(REG, AUTHORS, 26, X, y + 30));
  body.push(line(MED, [['Sydney  ·  December 12, 2026', MUTED]], 24, X, y + 82));
  const shade = `<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#080706" stop-opacity=".95"/><stop offset=".5" stop-color="#080706" stop-opacity=".78"/><stop offset=".85" stop-color="#080706" stop-opacity=".12"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#a)"/>${body.join('')}`;
  const img = await backdrop(W, H, { left: 0, top: 0, width: 1920, height: 759 }, shade);
  await sharp(await img.toBuffer()).composite([{ input: await logoPng(190), left: X - 20, top: 70 }]).webp({ quality: 82, effort: 5 }).toFile(path.join(OUT, 'title.webp'));
}

// Three of the workshop's accepted papers, from its schedule on neurips.cc, with this one marked.
async function programme() {
  const W = 1600, H = 900, X = 120, body = [];
  const papers = [
    ['AdaJEPA: An Adaptive Latent World Model', [['Ying Wang  ·  Oumayma Bounou  ·  ', MUTED], ['Yann LeCun', INK], ['  ·  Mengye Ren', MUTED]]],
    ['Planning with View World Models', [['Kangrui Wang  ·  Linjie Li  ·  Zhengyuan Yang  ·  Shiqi Chen  ·  Zihan Wang  ·  ', MUTED], ['Fei-Fei Li', INK], ['  ·  Jiajun Wu  ·  …', MUTED]]],
    ['Plan Shallow While You Learn: Reallocating Planning Compute During World-Model Adaptation', [['Nicholas Ciordas  ·  Jan Safrata  ·  ', MUTED], ['Lucas Ciordas', ACCENT], ['  ·  David Safrata', MUTED]], true],
  ];
  body.push(line(MED, [['CONTINUAL WORLD MODELS  ·  NEURIPS 2026', ACCENT]], 22, X + 150, 128, { ls: 0.16 }));
  body.push(line(MED, [['Saturday, December 12, 2026  ·  Sydney', MUTED]], 24, X + 150, 168));
  body.push(line(BLACK, [['ACCEPTED PAPERS INCLUDE', INK]], 58, X, 300, { ls: 0.01 }));
  let y = 410;
  for (const [t, by, mine] of papers) {
    const ts = wrap(SEMI, t, 34, W - X * 2 - 60);
    const h = ts.length * 44 + 48;
    if (mine) body.push(`<rect x="${X - 30}" y="${y - 50}" width="${W - X * 2 + 60}" height="${h + 34}" rx="18" fill="rgba(255,185,138,.1)" stroke="rgba(255,185,138,.55)" stroke-width="1.5"/>`);
    ts.forEach((l, i) => body.push(line(SEMI, [[l, INK]], 34, X, y + i * 44)));
    body.push(line(REG, by, 24, X, y + ts.length * 44 + 4));
    y += h + 66;
  }
  const bg = `<rect width="100%" height="100%" fill="#0e0c0b"/><defs><radialGradient id="g" cx=".92" cy=".05" r=".7"><stop offset="0" stop-color="#7a4fa8" stop-opacity=".32"/><stop offset="1" stop-color="#7a4fa8" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`;
  await sharp(svg(W, H, bg + body.join(''))).composite([{ input: await logoPng(130), left: X - 14, top: 66 }]).webp({ quality: 84, effort: 5 }).toFile(path.join(OUT, 'programme.webp'));
}

fs.mkdirSync(OUT, { recursive: true });
await cover(); await title(); await programme();
console.log('paper graphics done');
