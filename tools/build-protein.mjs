// The Alzheimer's protein classifier's slide: the original NCBI protein data beside the length-matched dataset Lucas
// built to take sequence length out of the picture. Top row: how long the Alzheimer's-associated and other proteins
// are in each; bottom row: the SVM's raw and length-adjusted accuracy as the dataset shrinks, the gap between them
// being what length alone explains. Redrawn from the charts in Lucas's research presentation, read off them pixel by
// pixel, so the lettering is large enough to read on the site:
//   toolkit/sources/protein-figures.png            screenshot of the write-up's results (Figs. 2.1 and 3.1 used)
//   toolkit/sources/protein-balanced-accuracy.jpg  Fig. 4.1 } pulled from the deck's PDF, page 10, with
//   toolkit/sources/protein-balanced-lengths.jpg   Fig. 4.2 } pdfimages -j -f 10 -l 10
// Laid out on a 1600×900 grid and drawn at twice that, for sharp text on retina screens.
// Run from the repo root: node tools/build-protein.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp'), opentype = require('opentype.js');
const SRC = path.join(here, '../toolkit/sources'), FONTS = path.join(here, '../toolkit/node_modules/@fontsource');
const OUT = path.join(here, '../media/projects/protein-classifier/charts.webp');

// ---- Reading the charts ----------------------------------------------------------------------------------------
const raster = async (file) => {
  const { data, info } = await sharp(path.join(SRC, file)).flatten({ background: '#fff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { at: (x, y) => { const i = 3 * (y * info.width + x); return [data[i], data[i + 1], data[i + 2]]; } };
};
// Accuracy charts: the blue (raw) and red (adjusted) dots, found as solid discs inside the plot, left to right at
// 100%, 90% … 10% of the dataset. y100 is the pixel row of the 100% gridline, perUnit the pixels per point.
async function dots(file, [x0, y0, x1, y1], y100, perUnit) {
  const img = await raster(file);
  const kind = ([r, g, b]) => (b > 200 && r < 120 && g > 100 && g < 170 ? 'raw' : r > 200 && g < 110 && b < 100 ? 'adj' : null);
  const out = {};
  for (const k of ['raw', 'adj']) {
    const hit = new Set();
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (kind(img.at(x, y)) === k) hit.add(y * 1e5 + x);
    const groups = [];
    for (const key of hit) {
      const x = key % 1e5, y = Math.floor(key / 1e5); let n = 0;
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) if (hit.has((y + j) * 1e5 + x + i)) n++;
      if (n < 70) continue; // the line between dots is thin; only a disc fills this neighbourhood
      let g = groups.find((q) => Math.abs(q.x / q.n - x) < 15 && Math.abs(q.y / q.n - y) < 15);
      if (!g) groups.push(g = { x: 0, y: 0, n: 0 });
      g.x += x; g.y += y; g.n++;
    }
    const pts = groups.filter((g) => g.n > 5).sort((a, b) => a.x / a.n - b.x / b.n);
    if (pts.length !== 10) throw new Error(`${file}: found ${pts.length} ${k} dots`);
    out[k] = pts.map((g) => 100 - (g.y / g.n - y100) / perUnit);
  }
  return out;
}
// Histograms: for each pixel column, the top of the blue (other proteins) and orange (Alzheimer's) bars. Orange is
// drawn over blue, so where both rise the overlap is a darker orange; below the taller bar's top the other one's top
// is where that colour changes. Columns of one height are one bar. x/y map pixels to amino acids and counts.
async function bars(file, c) {
  const img = await raster(file);
  const kind = ([r, g, b]) => (b > r + 40 ? 'B' : r > b + 80 ? (g < c.gmid ? 'D' : 'L') : null);
  const solid = (x, y, k) => [0, 1, 2].every((d) => (k ? kind(img.at(x, y + d)) === k : kind(img.at(x, y + d))));
  const blue = [], orange = [];
  for (let x = c.x0; x < c.x1; x++) {
    let top = -1, under = c.axis;
    for (let y = x >= c.legend[0] ? c.legend[1] : c.top; y < c.axis; y++) if (solid(x, y)) { top = y; break; }
    if (top < 0) { blue.push(0); orange.push(0); continue; }
    const blueOnTop = kind(img.at(x, top)) === 'B';
    for (let y = top; y < c.axis; y++) {
      const k = kind(img.at(x, y));
      if (k && (blueOnTop ? k !== 'B' : k !== 'L') && solid(x, y, k)) { under = y; break; }
    }
    blue.push(c.axis - (blueOnTop ? top : under)); orange.push(c.axis - (blueOnTop ? under : top));
  }
  // Runs of equal height (within 2.5 px); a run of under 5 px is the antialiased edge between two bars.
  const steps = (h) => {
    const runs = [];
    h.forEach((v, i) => { const r = runs[runs.length - 1]; if (r && Math.abs(v - r.ref) <= 2.5) { r.v.push(v); r.b = i; } else runs.push({ a: i, b: i, ref: v, v: [v] }); });
    const keep = runs.filter((r) => r.b - r.a >= 4);
    return keep.map((r, i) => {
      const a = i ? (keep[i - 1].b + r.a) / 2 + 0.5 : r.a, b = i < keep.length - 1 ? (r.b + keep[i + 1].a) / 2 + 0.5 : r.b + 1;
      const v = r.v.sort((p, q) => p - q)[r.v.length >> 1];
      return [c.x(c.x0 + a), c.x(c.x0 + b), Math.max(0, v / c.perCount)];
    });
  };
  return { blue: steps(blue), orange: steps(orange) };
}

// Figs. 2.1 and 3.1 from the screenshot. Gridlines: 100% at row 348.5, 12.386 px a point; 0 aa at column 469.5,
// 0.1972 px an amino acid; counts 1.008 px each, up from row 1795.3.
const ORIG = {
  acc: await dots('protein-figures.png', [380, 330, 1600, 800], 348.5, 12.386),
  len: await bars('protein-figures.png', { x0: 420, x1: 1556, top: 1093, axis: 1795, legend: [990, 1192], gmid: 128, x: (px) => (px - 469.5) / 0.1972, perCount: 1.008 }),
};
// Figs. 4.1 and 4.2. 100% at row 224.5, 10.743 px a point; 0 aa at column 198.5, 0.2625 px an amino acid; counts
// 0.8338 px each, up from row 832.5.
const BAL = {
  acc: await dots('protein-balanced-accuracy.jpg', [140, 200, 1180, 620], 224.5, 10.743),
  len: await bars('protein-balanced-lengths.jpg', { x0: 147, x1: 1382, top: 64, axis: 831, legend: [762, 172], gmid: 136, x: (px) => (px - 198.5) / 0.2625, perCount: 0.8338 }),
};

// ---- Drawing ---------------------------------------------------------------------------------------------------
const font = (pkg, file) => { const b = fs.readFileSync(path.join(FONTS, pkg, 'files', file)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const REG = font('hanken-grotesk', 'hanken-grotesk-latin-400-normal.woff'), MED = font('hanken-grotesk', 'hanken-grotesk-latin-500-normal.woff'), SEMI = font('hanken-grotesk', 'hanken-grotesk-latin-600-normal.woff');
const n = (v) => (Math.round(v * 100) / 100).toString();
const pathData = (p) => p.commands.map((c) => c.type === 'Z' ? 'Z' : c.type === 'Q' ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}` : c.type === 'C' ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}` : `${c.type}${n(c.x)} ${n(c.y)}`).join('');
const advance = (f, s, size) => { let w = 0, prev = null; for (const ch of s) { const g = f.charToGlyph(ch); if (prev) w += f.getKerningValue(prev, g) * size / f.unitsPerEm; w += g.advanceWidth * size / f.unitsPerEm; prev = g; } return w; };
function text(f, s, size, x, y, fill, anchor = 'start') {
  let cx = anchor === 'middle' ? x - advance(f, s, size) / 2 : anchor === 'end' ? x - advance(f, s, size) : x, prev = null, d = '';
  for (const ch of s) { const g = f.charToGlyph(ch); if (prev) cx += f.getKerningValue(prev, g) * size / f.unitsPerEm; d += pathData(g.getPath(cx, y, size)); cx += g.advanceWidth * size / f.unitsPerEm; prev = g; }
  return `<path fill="${fill}" d="${d}"/>`;
}
const line = (pts, stroke, w) => `<path d="M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;

const W = 1600, H = 900, K = 2;
const BG = '#171513', INK = '#f4efe8', MUTED = 'rgba(244,239,232,.62)', FAINT = 'rgba(244,239,232,.1)', AXIS = 'rgba(244,239,232,.32)';
// Validated as pairs on this surface (colour-blind separation, contrast): proteins by class, accuracy by kind.
const AD = '#d95926', OTHER = '#3987e5', RAW = '#9085e9', ADJ = '#199e70';
const COLS = [
  { x: 64, data: ORIG, title: 'Original dataset', sub: '7,857 NCBI proteins. Lengths misaligned.', xmax: 2500, ymax: 700, gap: '9.3', pct: ['89.6%', '80.3%'] },
  { x: 840, data: BAL, title: 'Length-matched dataset', sub: '18,824 NCBI proteins. Lengths aligned.', xmax: 4000, ymax: 900, gap: '3', pct: ['86%', '83%'] },
];
const CW = 696, YL = 62; // column width; room on the left of each plot for its tick labels
const R1 = { t: 194, b: 414 }, R2 = { t: 566, b: 786 };
const fmt = (v) => v.toLocaleString('en-US');
let body = `<rect width="${W}" height="${H}" fill="${BG}"/>`;

COLS.forEach((c, ci) => {
  const L = c.x + YL, R = c.x + CW;
  body += text(SEMI, c.title, 38, c.x, 86, INK) + text(REG, c.sub, 24, c.x, 122, MUTED);

  // Length distribution: each class as a translucent step area with a solid outline.
  const hx = (v) => L + Math.max(0, Math.min(v, c.xmax)) / c.xmax * (R - L), hy = (v) => R1.b - v / c.ymax * (R1.b - R1.t);
  body += text(MED, 'Protein length', 25, c.x, R1.t - 22, INK);
  for (let v = 0; v <= c.ymax; v += 200) {
    body += `<line x1="${L}" y1="${n(hy(v))}" x2="${R}" y2="${n(hy(v))}" stroke="${v ? FAINT : AXIS}" stroke-width="${v ? 1 : 1.5}"/>`;
    body += text(REG, fmt(v), 20, L - 12, hy(v) + 7, MUTED, 'end');
  }
  for (let v = 0; v <= c.xmax; v += c.xmax > 3000 ? 1000 : 500) body += text(REG, fmt(v), 20, hx(v), R1.b + 28, MUTED, 'middle');
  body += text(REG, 'amino acids', 20, R, R1.b + 56, MUTED, 'end');
  for (const [series, color] of [[c.data.len.blue, OTHER], [c.data.len.orange, AD]]) {
    const pts = []; let last = 0;
    for (const [a, b, v] of series) { if (a >= c.xmax) break; pts.push([hx(a), hy(last)], [hx(a), hy(v)], [hx(b), hy(v)]); last = v; }
    pts.push([pts[pts.length - 1][0], hy(0)]);
    body += `<path d="M${n(pts[0][0])} ${n(hy(0))}L${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z" fill="${color}" fill-opacity=".28"/>` + line(pts, color, 2.5);
  }
  // Legend on the heading's line, right-aligned.
  let lx = R;
  [[OTHER, 'Other proteins'], [AD, "Alzheimer's-associated"]].forEach(([color, label]) => {
    lx -= advance(REG, label, 22);
    body += text(REG, label, 22, lx, R1.t - 22, INK) + `<rect x="${n(lx - 28)}" y="${R1.t - 39}" width="18" height="18" rx="3" fill="${color}"/>`;
    lx -= 28 + 26;
  });
  if (ci === 0) body += text(REG, 'Tail to 5,300 not shown', 18, R, R1.t + 30, 'rgba(244,239,232,.45)', 'end');

  // Accuracy: raw and length-adjusted, the band between them shaded and named in the row's heading.
  const ax = (i) => L + 8 + i / 9 * (R - L - 16), ay = (v) => R2.t + (100 - v) / 35 * (R2.b - R2.t);
  const head = 'Accuracy as data shrinks', hw = advance(MED, head, 25);
  body += text(MED, head, 25, c.x, R2.t - 22, INK) + text(REG, ` · ${c.gap} pts from length alone`, 25, c.x + hw, R2.t - 22, MUTED);
  for (let v = 70; v <= 100; v += 10) {
    body += `<line x1="${L}" y1="${n(ay(v))}" x2="${R}" y2="${n(ay(v))}" stroke="${FAINT}" stroke-width="1"/>`;
    body += text(REG, `${v}%`, 20, L - 12, ay(v) + 7, MUTED, 'end');
  }
  body += `<line x1="${L}" y1="${R2.b}" x2="${R}" y2="${R2.b}" stroke="${AXIS}" stroke-width="1.5"/>`;
  for (let i = 0; i <= 9; i += 2) body += text(REG, `${100 - i * 10}%`, 20, ax(i), R2.b + 28, MUTED, 'middle');
  body += text(REG, 'of the dataset used', 20, R, R2.b + 56, MUTED, 'end');
  const raw = c.data.acc.raw.map((v, i) => [ax(i), ay(v)]), adj = c.data.acc.adj.map((v, i) => [ax(i), ay(v)]);
  body += `<path d="M${raw.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}L${[...adj].reverse().map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z" fill="${INK}" fill-opacity=".08"/>`;
  for (const [pts, color] of [[raw, RAW], [adj, ADJ]]) {
    body += line(pts, color, 3);
    pts.forEach(([x, y]) => { body += `<circle cx="${n(x)}" cy="${n(y)}" r="5" fill="${color}" stroke="${BG}" stroke-width="2"/>`; });
  }
  // Direct labels at the full dataset, with the presentation's figures.
  const label = (color, name, pct, y) => `<circle cx="${n(L + 16)}" cy="${n(y - 8)}" r="7" fill="${color}"/>`
    + text(REG, name, 22, L + 32, y, MUTED) + text(SEMI, pct, 22, L + 32 + advance(REG, name, 22), y, INK);
  body += label(RAW, 'Raw ', c.pct[0], raw[0][1] - 22) + label(ADJ, 'Length-adjusted ', c.pct[1], adj[0][1] + 40);
});
// A hairline between the two datasets.
const mid = (COLS[0].x + CW + COLS[1].x) / 2;
body += `<line x1="${mid}" y1="56" x2="${mid}" y2="${H - 50}" stroke="${FAINT}" stroke-width="1.5"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * K}" height="${H * K}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await sharp(Buffer.from(svg)).webp({ lossless: true, effort: 6 }).toFile(OUT);
const r = (a) => a.map((v) => v.toFixed(1)).join(' ');
console.log('original raw', r(ORIG.acc.raw), '\n         adj', r(ORIG.acc.adj), '\nmatched  raw', r(BAL.acc.raw), '\n         adj', r(BAL.acc.adj));
console.log('bars', ORIG.len.blue.length, ORIG.len.orange.length, BAL.len.blue.length, BAL.len.orange.length);
console.log(OUT, `${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
