// Draws the NeurIPS paper's cover for the overview and its three slides (title, programme, and the paper's figures),
// with the site's fonts. The slides are SVG on a 1600×900 grid, their words as vector paths, so they stay as sharp as
// the page's own text at any size: a picture of text, scaled down to fit, always came out soft. Only the title's photo
// is a picture, inside its SVG. Run from the repo root: node tools/build-paper.mjs
// Sources, downloaded once into toolkit/sources: the NeurIPS logo from neurips.cc, and Benh LIEU SONG's photo of the
// Sydney Opera House and Harbour Bridge from Wikimedia Commons (CC BY-SA 4.0, credited in a corner of the slide).
// The figures are cut from the paper's PDF as vectors with pdftocairo.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp'), opentype = require('opentype.js');
const SRC = path.join(here, '../toolkit/sources'), FONTS = path.join(here, '../toolkit/node_modules/@fontsource');
const OUT = path.join(here, '../media/projects/world-models'), THUMBS = path.join(here, '../media/thumbs');
const get = (name, url) => { const f = path.join(SRC, name); if (!fs.existsSync(f)) { fs.mkdirSync(SRC, { recursive: true }); execFileSync('curl', ['-sL', '-A', 'ciordas-dev-site/1.0', '-o', f, url]); } return f; };
const photo = get('sydney.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/Sydney_Opera_House_and_Harbour_Bridge_Dusk_%283%29_2019-06-21.jpg/1920px-Sydney_Opera_House_and_Harbour_Bridge_Dusk_%283%29_2019-06-21.jpg');
// The slides' backdrop, at 3840 wide; the overview cover keeps the 1920 one.
const photoBig = get('sydney-3840.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Sydney_Opera_House_and_Harbour_Bridge_Dusk_%283%29_2019-06-21.jpg/3840px-Sydney_Opera_House_and_Harbour_Bridge_Dusk_%283%29_2019-06-21.jpg');
const PAPER = path.join(os.homedir(), 'Documents/NeurIPS/authored papers/Plan_Shallow_While_You_Learn.pdf');
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
// The same logo as vector, h tall at x, y: its 36×36 drawing with Inkscape's extras dropped, and its "NeurIPS" (set in
// whatever sans the viewer has) drawn as a path, so it looks the same everywhere.
function logoSvg(x, y, h) {
  const src = fs.readFileSync(logo, 'utf8');
  const g = src.match(/<g[\s\S]*?<\/g>/)[0].replace(/\s(inkscape|sodipodi):[\w-]+="[^"]*"/g, '').replace(/\s(id|height|width)="[^"]*"/g, '');
  const word = line(REG, [['NeurIPS', '#b3b3b3']], 6.06136, 11.368404, 18.40287);
  return `<svg x="${x}" y="${y}" width="${h}" height="${h}" viewBox="0 0 36 36">${g}<g transform="scale(0.91392935,1.0941765)">${word}</g></svg>`;
}
const writeSvg = (name, body, W = 1600, H = 900) => {
  const f = path.join(OUT, `${name}.svg`);
  fs.writeFileSync(f, `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`);
  console.log(name, `${(fs.statSync(f).size / 1024).toFixed(0)} KB`);
};
// Drawn k times the size it's laid out at.
const svg = (w, h, body, k = 1) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w * k}" height="${h * k}" viewBox="0 0 ${w} ${h}">${body}</svg>`);
const K = 2;

// The photo with a dark wash on the left and bottom, where the words sit.
async function backdrop(w, h, crop, shade, k = 1, src = photo, wash = null) {
  const base = await sharp(src).extract(crop).resize(w * k, h * k, { fit: 'cover' }).modulate({ brightness: 0.92 }).toBuffer();
  return sharp(base).composite([...(wash ? [{ input: wash }] : []), { input: svg(w, h, shade, k) }]);
}
// A left-to-right wash of #080706, worked out pixel by pixel: drawn as an SVG gradient this large it shows a seam.
function wash(w, h, stops) {
  const buf = Buffer.alloc(w * h * 4), col = new Uint8Array(w);
  for (let x = 0; x < w; x++) {
    const f = (x + 0.5) / w, i = stops.findIndex(([o]) => o > f);
    const [o0, a0] = stops[i < 1 ? (i < 0 ? stops.length - 1 : 0) : i - 1], [o1, a1] = stops[i < 0 ? stops.length - 1 : i];
    col[x] = Math.round(255 * (o1 === o0 ? a0 : a0 + (a1 - a0) * Math.min(1, Math.max(0, (f - o0) / (o1 - o0)))));
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) buf.set([8, 7, 6, col[x]], (y * w + x) * 4);
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
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
  // The photo's credit, which its CC BY-SA 4.0 licence asks for: small and faint in the bottom right corner.
  const credit = 'Photo: Benh Lieu Song, CC BY-SA 4.0';
  body.push(line(REG, [[credit, 'rgba(244,239,232,.5)']], 15, W - 28 - advance(REG, credit, 15), H - 24));
  // The photo and its dark wash are the one picture, at twice the grid; the words and logo go over it as vectors.
  const shade = await wash(W * K, H * K, [[0, 0.95], [0.5, 0.78], [0.85, 0.12]]);
  const img = await backdrop(W, H, { left: 0, top: 0, width: 3840, height: 1518 }, '', K, photoBig, shade);
  const photoData = (await sharp(await img.toBuffer()).webp({ quality: 84, effort: 6, smartSubsample: true }).toBuffer()).toString('base64');
  writeSvg('title', `<image width="${W}" height="${H}" preserveAspectRatio="none" xlink:href="data:image/webp;base64,${photoData}"/>${logoSvg(X - 20, 70, 190)}${body.join('')}`);
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
  // A purple glow from the top right corner: an ellipse 0.7 of the slide across each way, fading out linearly.
  const glow = `<defs><radialGradient id="g" gradientUnits="userSpaceOnUse" cx="${W * 0.92}" cy="${H * 0.05}" r="${W * 0.7}" gradientTransform="translate(${W * 0.92} ${H * 0.05}) scale(1 ${H / W}) translate(${-W * 0.92} ${-H * 0.05})"><stop offset="0" stop-color="#7a4fa8" stop-opacity=".32"/><stop offset="1" stop-color="#7a4fa8" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="#0e0c0b"/><rect width="${W}" height="${H}" fill="url(#g)"/>`;
  writeSvg('programme', `${glow}${logoSvg(X - 14, 66, 130)}${body.join('')}`);
}

// The paper's three figures on one white slide: depth and reallocation side by side, the deployment streams wide
// below, all at one scale so their lettering matches. Each is cut from its page (fractions of a letter page) as SVG
// with pdftocairo and framed to its ink. The paper's Figure 3 clips the last 0 of its top-right "1000"; dropping that
// one clip (the "unclip" id) brings the digit back.
const FIGS = [
  ['1  Return vs. imagination depth', 2, 0.2, 0.05, 0.62, 0.215],
  ['2  Gain from reallocation, same budget', 3, 0.15, 0.05, 0.7, 0.16],
  ['3  Deployment streams on the drag tiers', 4, 0.12, 0.045, 0.76, 0.273, 'clip-5'],
];
async function figures() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-')), figs = [];
  for (const [i, [label, page, fx, fy, fw, fh, unclip]] of FIGS.entries()) {
    const f = path.join(tmp, `p${page}.svg`), pt = (v) => String(Math.round(v));
    execFileSync('pdftocairo', ['-svg', '-f', String(page), '-l', String(page), '-x', pt(fx * 612), '-y', pt(fy * 792), '-W', pt(fw * 612), '-H', pt(fh * 792), PAPER, f]);
    let src = fs.readFileSync(f, 'utf8');
    if (unclip) src = src.replace(`<g clip-path="url(#${unclip})">`, '<g>');
    // Where the ink is, in the SVG's own points: drawn at 600 dpi and trimmed to it.
    const D = 600 / 72, { info } = await sharp(Buffer.from(src.replace(/(width|height)="([\d.]+)pt"/g, '$1="$2"')), { density: 600 }).flatten({ background: '#fff' }).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });
    const box = { x: -info.trimOffsetLeft / D, y: -info.trimOffsetTop / D, w: info.width / D, h: info.height / D };
    // Its insides, ids made unique per figure, coordinates to two decimals.
    const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
      .replace(/id="/g, `id="f${i}-`).replace(/(href|url\()(=")?#/g, (m) => m.replace('#', `#f${i}-`))
      .replace(/ (d|x|y)="([^"]*)"/g, (m, k, v) => ` ${k}="${v.replace(/(\d+\.\d\d)\d+/g, '$1')}"`);
    figs.push({ label, inner, box, w: box.w, h: box.h });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  // Laid out on the 1600×900 grid. One scale s (grid units per point) for all three, as large as fits.
  const W = 1600, H = 900, M = 50, GAP = 50, LH = 40, LS = 22;
  const [a, b, c] = figs;
  const s = Math.min((W - 2 * M - GAP) / (a.w + b.w), (W - 2 * M) / c.w, (H - 2 * M - 2 * LH - GAP) / (Math.max(a.h, b.h) + c.h));
  const [A, B, C] = figs.map((f) => ({ w: f.w * s, h: f.h * s }));
  const topH = Math.max(A.h, B.h), used = 2 * LH + topH + GAP + C.h, y0 = (H - used) / 2;
  const rowW = A.w + GAP + B.w, x0 = (W - rowW) / 2;
  const place = [
    [a, A, x0, y0 + LH + (topH - A.h)],
    [b, B, x0 + A.w + GAP, y0 + LH + (topH - B.h)],
    [c, C, (W - C.w) / 2, y0 + LH + topH + GAP + LH],
  ];
  const r = (v) => n(v);
  const labels = place.map(([f, , x, y]) => { const [num, ...rest] = f.label.split('  '); return line(SEMI, [[`FIG. ${num}`, '#b4561f'], [`   ${rest.join(' ')}`, '#57514b']], LS, x, y - 18, { ls: 0.02 }); }).join('');
  const art = place.map(([f, d, x, y]) => `<svg x="${r(x)}" y="${r(y)}" width="${r(d.w)}" height="${r(d.h)}" viewBox="${r(f.box.x)} ${r(f.box.y)} ${r(f.box.w)} ${r(f.box.h)}">${f.inner}</svg>`).join('');
  writeSvg('figures', `<rect width="${W}" height="${H}" fill="#ffffff"/>${labels}${art}`);
}

// Any of cover, title, programme and figures can be named to draw only those; with none named, all four.
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2), want = (f) => !only.length || only.includes(f.name);
for (const f of [cover, title, programme, figures]) if (want(f)) await f();
console.log('paper graphics done');
