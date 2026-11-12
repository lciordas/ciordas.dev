// The Alzheimer's protein classifier's slide: Lucas's four results charts from his research presentation, the original
// NCBI protein dataset on the left and the length-matched dataset he rebuilt on the right. Top row: how long the
// Alzheimer's-associated and other proteins are (his matplotlib histograms); bottom row: the SVM's raw and adjusted
// accuracy as the dataset shrinks (his Google Sheets charts).
//
// The charts in the deck are too small to read at the slide's size, so each is redrawn here in its own tool's default
// look (Google Sheets: Arial, grey title, #4285F4 and #EA4335, minor gridlines; matplotlib: DejaVu Sans, tab:blue and
// tab:orange at 90% opacity, grey grid) with the values read off the originals, only with the lettering larger next
// to the plot. Changes from the originals: the four chart titles are replaced by one heading per dataset, and the
// histogram legends sit just above the plot instead of inside it, where at this size they'd cover the bars.
//   toolkit/sources/protein-original-accuracy.jpg  Fig. 2.1 } embedded in the deck's PDF, pages 6 and 10,
//   toolkit/sources/protein-balanced-accuracy.jpg  Fig. 4.1 } pulled with pdfimages -j
//   toolkit/sources/protein-balanced-lengths.jpg   Fig. 4.2 }
//   toolkit/sources/protein-figures.png            screenshot of the results slide, Fig. 3.1 read from it (sharper
//                                                  than the PDF's copy, protein-original-lengths.jpg)
//   toolkit/sources/fonts/Arial.ttf, DejaVuSans.ttf  the two charting tools' default fonts (macOS / matplotlib)
// Laid out on a 1600×900 grid and drawn at twice that, for sharp text on retina screens.
// Run from the repo root: node tools/build-protein.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp'), opentype = require('opentype.js');
const SRC = path.join(here, '../toolkit/sources');
const OUT = path.join(here, '../media/projects/protein-classifier/charts.webp');

// ---- Reading the charts ----------------------------------------------------------------------------------------
const raster = async (file) => {
  const { data, info } = await sharp(path.join(SRC, file)).flatten({ background: '#fff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { at: (x, y) => { const i = 3 * (y * info.width + x); return [data[i], data[i + 1], data[i + 2]]; } };
};

// Accuracy: the blue (raw) and red (adjusted) dots sit on the vertical gridlines at 100%, 90% … 10% (columns
// x100 + i*dx). Down each of those columns the dot is the longest run of its colour (the line through it is far
// thinner); its middle is the value. y100 is the pixel row of the 100% gridline, perUnit the pixels a point.
async function dots(file, x100, dx, y100, perUnit) {
  const img = await raster(file);
  const kind = ([r, g, b]) => (b > 200 && r < 140 && g < 190 ? 'raw' : r > 200 && g < 120 && b < 110 ? 'adj' : null);
  const out = { raw: [], adj: [] };
  for (let i = 0; i < 10; i++) {
    const x = Math.round(x100 + i * dx);
    for (const k of ['raw', 'adj']) {
      let best = null;
      for (let c = x - 1; c <= x + 1; c++) {
        let run = null;
        for (let y = 215; y < 612; y++) { // inside the plot, clear of the legend's dots
          if (kind(img.at(c, y)) === k) { run = run || { a: y, b: y }; run.b = y; }
          else if (run && y - run.b > 2) { if (!best || run.b - run.a > best.b - best.a) best = run; run = null; } // JPEG can blur a row or two
        }
      }
      if (!best || best.b - best.a < 9) throw new Error(`${file}: no ${k} dot at column ${x}`);
      out[k].push(Math.round((100 - ((best.a + best.b) / 2 - y100) / perUnit) * 10) / 10);
    }
  }
  return out;
}

// Histograms: matplotlib's hist() with 50 bins per class, blue (other proteins) drawn first and orange (Alzheimer's)
// over it at 90% opacity, so where both rise the overlap is a darker orange. Each pixel is matched to the nearest of
// the chart's colours. Down a column, blue's top is the first blue or overlap pixel, orange's the first light or dark
// orange one. First the bin grid: the edges between bars fall on lo + k*w; w and the phase come from where the bar
// heights step, lo from the first bar (`first`, read off the chart). Then each bin's height from its middle columns.
async function hist(file, c) {
  const img = await raster(file);
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  const refs = { W: [255, 255, 255], K: [0, 0, 0], G: c.grid, B: c.B, D: c.D, L: c.L };
  const kind = (p) => { let k = null, m = 1e9; for (const [n, q] of Object.entries(refs)) { const d = d2(p, q); if (d < m) { m = d; k = n; } } return m < 45 ** 2 ? k : null; };
  const px = (aa) => c.x0 + aa * c.perAA, top = (x) => (x >= c.legend[0] ? c.legend[1] : c.top);
  // Column heights of each class, in counts.
  const height = (x, set) => { for (let y = top(x); y < c.axis; y++) if (set.includes(kind(img.at(x, y)))) return (c.axis - y) / c.perCount; return 0; };
  const cols = { blue: [], orange: [] };
  for (let x = Math.ceil(px(-50)); x < px(c.xmax); x++) { cols.blue.push([x, height(x, 'BD')]); cols.orange.push([x, height(x, 'DL')]); }
  const out = {};
  for (const k of ['blue', 'orange']) {
    // Steps: columns where the height jumps by more than 4 counts.
    const steps = [];
    for (let i = 1; i < cols[k].length; i++) if (Math.abs(cols[k][i][1] - cols[k][i - 1][1]) > 4) steps.push((cols[k][i][0] - 0.5 - c.x0) / c.perAA);
    let best = null;
    for (let w = c.w[0]; w <= c.w[1]; w += 0.02) for (let ph = 0; ph < w; ph += 0.25) {
      let n = 0, err = 0;
      for (const s of steps) { const d = Math.abs(((s - ph) % w + w * 1.5) % w - w / 2); if (d < 4) { n++; err += d; } }
      if (!best || n > best.n || (n === best.n && err < best.err)) best = { n, err, w, ph };
    }
    const lo = best.ph + Math.round((c.first[k] - best.ph) / best.w) * best.w, w = best.w;
    const counts = [];
    for (let b = 0; b < 50; b++) {
      const a = Math.ceil(px(lo + b * w) + 2), z = Math.floor(px(lo + (b + 1) * w) - 2), hs = [];
      for (let x = a; x <= z; x++) hs.push(height(x, k === 'blue' ? 'BD' : 'DL'));
      hs.sort((p, q) => p - q);
      let v = Math.max(0, Math.round(hs[hs.length >> 1] || 0));
      // A bar of one or two sequences is under a pixel tall: in the JPEG it only tints the rows just above the axis.
      if (!v && c.tint) {
        const x = Math.round((a + z) / 2), [r, , bl] = img.at(x, c.axis - 3);
        if (k === 'blue' ? bl - r > 30 : r - bl > 40) v = 1;
      }
      counts.push(v);
    }
    out[k] = { lo, w, counts, fit: `${best.n}/${steps.length}` };
  }
  return out;
}

const SHOT = { B: [56, 116, 174], D: [216, 128, 56], L: [240, 144, 64] }; // the screenshots' colours (display profile)
const ORIG = {
  acc: await dots('protein-original-accuracy.jpg', 172.5, 108.89, 224.5, 10.743),
  // 0 aa at column 469.5, 0.1972 px an amino acid; 1.008 px a count up from row 1795.
  len: await hist('protein-figures.png', { ...SHOT, grid: [176, 176, 176], x0: 469.5, perAA: 0.1972, xmax: 5400, top: 1093, axis: 1795, perCount: 1.008, legend: [990, 1192], w: [80, 130], first: { blue: 8, orange: 0 } }),
};
const BAL = {
  acc: await dots('protein-balanced-accuracy.jpg', 172.5, 108.89, 224.5, 10.743),
  // 0 aa at column 198.5, 0.2625 px an amino acid; 0.8338 px a count up from row 832.
  len: await hist('protein-balanced-lengths.jpg', { ...SHOT, B: [57, 117, 179], grid: [193, 193, 193], x0: 198.5, perAA: 0.2625, xmax: 4400, top: 64, axis: 832, perCount: 0.8338, legend: [762, 172], w: [70, 100], first: { blue: 3, orange: 6 }, tint: true }),
};

// ---- Drawing ---------------------------------------------------------------------------------------------------
const font = (file) => { const b = fs.readFileSync(path.join(SRC, 'fonts', file)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const ARIAL = font('Arial.ttf'), DEJAVU = font('DejaVuSans.ttf');
const n = (v) => (Math.round(v * 100) / 100).toString();
const pathData = (p) => p.commands.map((c) => c.type === 'Z' ? 'Z' : c.type === 'Q' ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}` : c.type === 'C' ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}` : `${c.type}${n(c.x)} ${n(c.y)}`).join('');
const advance = (f, s, size) => { let w = 0, prev = null; for (const ch of s) { const g = f.charToGlyph(ch); if (prev) w += f.getKerningValue(prev, g) * size / f.unitsPerEm; w += g.advanceWidth * size / f.unitsPerEm; prev = g; } return w; };
function text(f, s, size, x, y, fill, anchor = 'start', rotate = 0) {
  let cx = anchor === 'middle' ? x - advance(f, s, size) / 2 : anchor === 'end' ? x - advance(f, s, size) : x, prev = null, d = '';
  for (const ch of s) { const g = f.charToGlyph(ch); if (prev) cx += f.getKerningValue(prev, g) * size / f.unitsPerEm; d += pathData(g.getPath(cx, y, size)); cx += g.advanceWidth * size / f.unitsPerEm; prev = g; }
  return `<path fill="${fill}" d="${d}"${rotate ? ` transform="rotate(${rotate} ${n(x)} ${n(y)})"` : ''}/>`;
}
const hline = (x1, x2, y, stroke, w) => `<line x1="${n(x1)}" y1="${n(y)}" x2="${n(x2)}" y2="${n(y)}" stroke="${stroke}" stroke-width="${n(w)}"/>`;
const vline = (x, y1, y2, stroke, w) => `<line x1="${n(x)}" y1="${n(y1)}" x2="${n(x)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${n(w)}"/>`;

// Google Sheets line chart, as in Figs. 2.1 and 4.1. U canvas units to a Sheets pixel; the measurements are the
// originals' (a 600×371 chart): 12 px Arial in black for axes and #222 for the legend, legend centred on top with
// 12 px dots, a black left axis with ticks at every point (longer at every 5), major gridlines #ccc every 5 points
// and 20% of the data, minor ones #e6e6e6 every point and 5%, 2 px lines and 3.5 px dots.
const U = 2;
function sheets(x0, y0, w, h, acc) {
  const s = (v) => v * U, W = w / U, H = h / U;
  const L = 58.25, R = W - 6, T = 26, B = H - 37, AX = L - 4;
  const X = (pct) => x0 + s(L + (100 - pct) / (100 - 9.17) * (R - L)), Y = (v) => y0 + s(T + (100 - v) / 35 * (B - T));
  let o = '';
  for (let p = 95; p >= 10; p -= 5) if (p % 20) o += vline(X(p), Y(100), Y(65), '#e6e6e6', s(1));
  for (let v = 99; v > 65; v--) if (v % 5) o += hline(x0 + s(L), x0 + s(R), Y(v), '#e6e6e6', s(1));
  for (let p = 100; p >= 20; p -= 20) o += vline(X(p), Y(100), Y(65), '#cccccc', s(1));
  for (let v = 100; v >= 65; v -= 5) o += hline(x0 + s(L), x0 + s(R), Y(v), '#cccccc', s(1));
  o += vline(x0 + s(AX), Y(100) - s(0.5), Y(65) + s(0.5), '#000', s(1));
  for (let v = 100; v >= 65; v--) o += hline(x0 + s(AX - (v % 5 ? 2.75 : 5.5)), x0 + s(AX + (v % 5 ? 2.75 : 5.5)), Y(v), '#000', s(1));
  for (let v = 100; v >= 65; v -= 5) o += text(ARIAL, String(v), s(12), x0 + s(AX - 13.25), Y(v) + s(4.3), '#000', 'end');
  for (let p = 100; p >= 20; p -= 20) o += text(ARIAL, String(p), s(12), X(p), y0 + s(B + 16.5), '#000', 'middle');
  o += text(ARIAL, 'Percentage of Dataset Used', s(12), x0 + s((L + R) / 2), y0 + s(B + 34), '#000', 'middle');
  o += text(ARIAL, 'Model Accuracy (%)', s(12), x0 + s(10.6), y0 + s((T + B) / 2), '#000', 'middle', -90);
  for (const [k, color] of [['raw', '#4285F4'], ['adj', '#EA4335']]) {
    const pts = acc[k].map((v, i) => [X(100 - i * 10), Y(v)]);
    o += `<path d="M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}" fill="none" stroke="${color}" stroke-width="${s(2)}" stroke-linejoin="round"/>`;
    o += pts.map(([x, y]) => `<circle cx="${n(x)}" cy="${n(y)}" r="${s(3.5)}" fill="${color}"/>`).join('');
  }
  // Legend: dot, 8 px, label, 17 px to the next dot; the whole row centred on the chart.
  const items = [['#4285F4', 'Raw Accuracy'], ['#EA4335', 'Adjusted Accuracy']];
  const total = items.reduce((t, [, l]) => t + 12 + 8 + advance(ARIAL, l, s(12)) / U, 0) + 17;
  let lx = x0 + s((W - total) / 2);
  for (const [color, label] of items) {
    o += `<circle cx="${n(lx + s(6))}" cy="${n(y0 + s(8))}" r="${s(6)}" fill="${color}"/>` + text(ARIAL, label, s(12), lx + s(20), y0 + s(12.3), '#222222');
    lx += s(20 + 17) + advance(ARIAL, label, s(12));
  }
  return o;
}

// matplotlib histogram with its defaults, as in Figs. 3.1 and 4.2. P canvas units to a point: 10 pt DejaVu Sans,
// 0.8 pt black spines and 3.5 pt outward ticks, #b0b0b0 grid under the bars, tab:blue then tab:orange at 0.9 alpha,
// 5% margins, MaxNLocator ticks; legend box white at 0.8 alpha with a #ccc edge and rounded corners, measured off the
// original: its rows 1.52 em apart with 2 × 0.7 em patches.
const P = 2.3, FS = 10 * P;
const nice = (lo, hi, nbins) => { // matplotlib's MaxNLocator with steps 1, 2, 2.5, 5, 10
  const raw = (hi - lo) / nbins, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw - 1e-9);
  const t = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) t.push(v); return t;
};
function mpl(x0, y0, w, h, len, yticksMax) {
  const series = [['blue', '#1f77b4', 1], ['orange', '#ff7f0e', 0.9]];
  const lo = Math.min(...series.map(([k]) => len[k].lo)), hi = Math.max(...series.map(([k]) => len[k].lo + 50 * len[k].w));
  const ymax = Math.max(...series.flatMap(([k]) => len[k].counts));
  const xl = [lo - (hi - lo) * 0.05, hi + (hi - lo) * 0.05], yl = [0, ymax * 1.05];
  // Legend first, above the plot at its right edge; then the axes box below it.
  const labels = ["Non-Alzheimer's associated proteins", "Alzheimer's associated proteins"];
  const lw = (0.58 + 2.02 + 0.8 + 0.75) * FS + Math.max(...labels.map((l) => advance(DEJAVU, l, FS))), lh = 3.79 * FS;
  const yTicksW = advance(DEJAVU, String(yticksMax), FS);
  const AL = x0 + FS * 1.2 + 4 * P + yTicksW + 7 * P, AR = x0 + w - P, AT = y0 + lh + 0.5 * FS, AB = y0 + h - (7 * P + FS + 4 * P + FS);
  const X = (v) => AL + (v - xl[0]) / (xl[1] - xl[0]) * (AR - AL), Y = (v) => AB - (v - yl[0]) / (yl[1] - yl[0]) * (AB - AT);
  const xt = nice(xl[0], xl[1], Math.min(9, Math.floor((AR - AL) / P / (FS / P * 3)))).filter((v) => v >= xl[0] && v <= xl[1]);
  const yt = nice(yl[0], yl[1], Math.min(9, Math.floor((AB - AT) / P / (FS / P * 2)))).filter((v) => v <= yl[1]);
  let o = '';
  for (const v of xt) o += vline(X(v), AT, AB, '#b0b0b0', 0.8 * P);
  for (const v of yt) o += hline(AL, AR, Y(v), '#b0b0b0', 0.8 * P);
  for (const [k, color, alpha] of series) {
    const { lo: a, w: bw, counts } = len[k];
    counts.forEach((c, i) => { if (c > 0) o += `<rect x="${n(X(a + i * bw))}" y="${n(Y(c))}" width="${n(X(a + (i + 1) * bw) - X(a + i * bw))}" height="${n(Y(0) - Y(c))}" fill="${color}"${alpha < 1 ? ` fill-opacity="${alpha}"` : ''}/>`; });
  }
  o += `<rect x="${n(AL)}" y="${n(AT)}" width="${n(AR - AL)}" height="${n(AB - AT)}" fill="none" stroke="#000" stroke-width="${n(0.8 * P)}"/>`;
  for (const v of xt) o += vline(X(v), AB, AB + 3.5 * P, '#000', 0.8 * P) + text(DEJAVU, String(v), FS, X(v), AB + 7 * P + 0.76 * FS, '#000', 'middle');
  for (const v of yt) o += hline(AL - 3.5 * P, AL, Y(v), '#000', 0.8 * P) + text(DEJAVU, String(v), FS, AL - 7 * P, Y(v) + 0.364 * FS, '#000', 'end');
  o += text(DEJAVU, 'Protein Sequence Length (Amino Acids)', FS, (AL + AR) / 2, AB + 7 * P + FS + 4 * P + 0.76 * FS, '#000', 'middle');
  o += text(DEJAVU, 'Number of Protein Sequences', FS, AL - 7 * P - yTicksW - 4 * P - 0.24 * FS, (AT + AB) / 2, '#000', 'middle', -90);
  const bx = AR - lw, by = y0;
  o += `<rect x="${n(bx)}" y="${n(by)}" width="${n(lw)}" height="${n(lh)}" rx="${n(0.2 * FS)}" fill="#fff" fill-opacity=".8" stroke="#cccccc" stroke-opacity=".8" stroke-width="${n(P)}"/>`;
  labels.forEach((label, i) => {
    const base = by + 1.37 * FS + i * 1.52 * FS, [, color, alpha] = series[i];
    o += `<rect x="${n(bx + 0.58 * FS)}" y="${n(base - 0.05 * FS - 0.7 * FS)}" width="${n(2.02 * FS)}" height="${n(0.7 * FS)}" fill="${color}"${alpha < 1 ? ` fill-opacity="${alpha}"` : ''}/>`;
    o += text(DEJAVU, label, FS, bx + (0.58 + 2.02 + 0.8) * FS, base, '#000');
  });
  return o;
}

// ---- The slide -------------------------------------------------------------------------------------------------
const W = 1600, H = 900, K = 2;
const COLS = [
  { x: 56, data: ORIG, title: 'Original dataset', sub: '7,857 NCBI protein sequences' },
  { x: 839, data: BAL, title: 'Length-matched dataset', sub: '18,824 NCBI protein sequences' },
];
const CW = 705, HEAD = 60, R1 = [82, 444], R2 = [542, 326];
let body = `<rect width="${W}" height="${H}" fill="#fff"/>`;
for (const c of COLS) {
  // Each dataset's heading in the Sheets title style (Arial, #757575), standing in for the charts' own titles.
  body += text(ARIAL, c.title, 34, c.x, HEAD, '#757575') + text(ARIAL, c.sub, 23, c.x + advance(ARIAL, c.title, 34) + 16, HEAD, '#9e9e9e');
  body += mpl(c.x, R1[0], CW, R1[1], c.data.len, 800);
  body += sheets(c.x, R2[0], CW, R2[1], c.data.acc);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * K}" height="${H * K}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await sharp(Buffer.from(svg)).webp({ lossless: true, effort: 6 }).toFile(OUT);
if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify({ ORIG, BAL })); // the values read, for checking
const r = (a) => a.map((v) => v.toFixed(1)).join(' ');
console.log('original raw', r(ORIG.acc.raw), '\n         adj', r(ORIG.acc.adj), '\nmatched  raw', r(BAL.acc.raw), '\n         adj', r(BAL.acc.adj));
for (const [nm, d] of [['original', ORIG], ['matched ', BAL]]) for (const k of ['blue', 'orange']) console.log(nm, k, `lo ${d.len[k].lo.toFixed(1)} w ${d.len[k].w.toFixed(2)} fit ${d.len[k].fit}`, d.len[k].counts.join(' '));
console.log(OUT, `${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
