// Draws EvoGrad's comparison slide: one target (a damped sine) fitted three ways by the library's 1D regression
// example: evolution alone, evolution with gradient descent, and that plus learnable Legendre activations. Top row:
// each run's final fit over the target; bottom: the best network's error by generation for all three, and the
// activations the Legendre run learned. Laid out on a 1600×900 grid and drawn at twice that, for sharp text on retina
// screens. Run tools/evograd-regression.py first (it runs the three and writes toolkit/sources/evograd-regression.json),
// then, from the repo root: node tools/build-evograd-fit.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp'), opentype = require('opentype.js');
const FONTS = path.join(here, '../toolkit/node_modules/@fontsource');
const D = JSON.parse(fs.readFileSync(path.join(here, '../toolkit/sources/evograd-regression.json'), 'utf8'));
const OUT = path.join(here, '../media/projects/hybrid-networks/modes.webp');
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
// A power of ten, 10 with a raised exponent, right-aligned on x.
function pow10(e, size, x, y, fill) {
  const ex = `−${-e}`, w2 = advance(REG, ex, size * 0.68), w1 = advance(REG, '10', size);
  return text(REG, '10', size, x - w2 - w1 - 1, y, fill) + text(REG, ex, size * 0.68, x - w2, y - size * 0.42, fill);
}
const line = (pts, stroke, w, extra = '') => `<path d="M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"${extra}/>`;

const W = 1600, H = 900, K = 2;
const BG = '#0e0c0b', INK = '#f4efe8', MUTED = 'rgba(244,239,232,.62)', FAINT = 'rgba(244,239,232,.14)', AXIS = 'rgba(244,239,232,.3)';
// Three series, one colour each throughout (validated as a set on this background for colour-blind separation).
const RUNS = [
  { key: 'neat', title: 'Evolution only', color: '#199e70' },
  { key: 'grad', title: '+ gradient descent', color: '#3987e5' },
  { key: 'legendre', title: '+ learnable activations', color: '#d95926' },
].map((r) => ({ ...r, ...D.runs[r.key] }));
const fmt = (v) => v >= 0.001 ? v.toFixed(4) : v.toPrecision(2).replace(/e-(\d+)/, (_, e) => `e-${e}`);
const sci = (v) => { const e = Math.floor(Math.log10(v)), m = v / 10 ** e; return `${m.toFixed(1)} × 10^${e}`; };
let body = `<rect width="${W}" height="${H}" fill="${BG}"/>`;

// Top row: three fits. The target as a broad faint band, the network's output as a line over it.
const COLS = [64, 568, 1072], CW = 464, FT = 132, FH = 300;
const xs = D.x, x0 = xs[0], x1 = xs[xs.length - 1];
const vals = [...D.target, ...RUNS.flatMap((r) => r.fit)], ylo = Math.min(...vals) - 0.06, yhi = Math.max(...vals) + 0.04;
const fx = (c, x) => COLS[c] + (x - x0) / (x1 - x0) * CW, fy = (y) => FT + 24 + (yhi - y) / (yhi - ylo) * (FH - 24);
RUNS.forEach((r, c) => {
  const X = COLS[c];
  body += `<rect x="${X}" y="${FT - 52}" width="14" height="14" rx="3" fill="${r.color}"/>` + text(SEMI, r.title, 25, X + 24, FT - 39, INK);
  const e = r.mse[r.mse.length - 1], [m, ex] = sci(e).split(' × 10^');
  body += text(REG, `${r.generations} generation${r.generations === 1 ? '' : 's'} · error ${m} × 10`, 18, X, FT - 10, MUTED);
  const wpre = advance(REG, `${r.generations} generation${r.generations === 1 ? '' : 's'} · error ${m} × 10`, 18);
  body += text(REG, `−${-ex}`, 12.5, X + wpre + 1, FT - 18, MUTED);
  body += `<line x1="${X}" y1="${FT + FH}" x2="${X + CW}" y2="${FT + FH}" stroke="${AXIS}" stroke-width="1.5"/>`;
  body += line(xs.map((x, i) => [fx(c, x), fy(D.target[i])]), 'rgba(244,239,232,.2)', 9);
  body += line(xs.map((x, i) => [fx(c, x), fy(r.fit[i])]), r.color, 3);
  body += text(REG, `${r.hidden} hidden node${r.hidden === 1 ? '' : 's'}, ${r.connections} connection${r.connections === 1 ? '' : 's'}`, 18, X, FT + FH + 32, MUTED);
});
{ const i = D.target.indexOf(Math.max(...D.target)); body += text(REG, 'target', 17, fx(0, xs[i]) + 22, fy(D.target[i]) - 4, MUTED); }

// Bottom left: the best network's mean squared error at every generation, both axes logarithmic.
const CL = 128, CR = 1000, CT = 560, CB = 838, GMAX = Math.max(...RUNS.map((r) => r.generations)) + 1;
const all = RUNS.flatMap((r) => r.mse), EMIN = Math.floor(Math.log10(Math.min(...all))), EMAX = Math.ceil(Math.log10(Math.max(...all)));
const gx = (g) => CL + Math.log10(g + 1) / Math.log10(GMAX) * (CR - CL), ey = (e) => CT + (EMAX - Math.log10(e)) / (EMAX - EMIN) * (CB - CT);
body += text(MED, 'Error of the best network, by generation', 20, 64, CT - 34, INK);
for (let e = EMIN; e <= EMAX; e++) { body += `<line x1="${CL}" y1="${n(ey(10 ** e))}" x2="${CR}" y2="${n(ey(10 ** e))}" stroke="${FAINT}" stroke-width="1"/>` + pow10(e, 16, CL - 12, ey(10 ** e) + 6, MUTED); }
for (const g of [0, 1, 10, 100, GMAX - 1].filter((g, i, a) => g < GMAX && a.indexOf(g) === i)) body += `<line x1="${n(gx(g))}" y1="${CB}" x2="${n(gx(g))}" y2="${CB + 6}" stroke="${AXIS}" stroke-width="1.5"/>` + text(REG, String(g), 16, gx(g), CB + 26, MUTED, 'middle');
body += `<line x1="${CL}" y1="${CB}" x2="${CR}" y2="${CB}" stroke="${AXIS}" stroke-width="1.5"/>`;
body += text(REG, 'generation', 16, CR, CB + 26 + 22, MUTED, 'end');
body += `<line x1="${CL}" y1="${n(ey(2e-4))}" x2="${CR}" y2="${n(ey(2e-4))}" stroke="rgba(244,239,232,.45)" stroke-width="1.5" stroke-dasharray="6 6"/>` + text(REG, 'stopping threshold', 16, CR, ey(2e-4) - 9, MUTED, 'end');
for (const r of RUNS) {
  const pts = r.mse.map((e, g) => [gx(g), ey(e)]);
  body += line(pts, BG, 6) + line(pts, r.color, 2.5);
  const [lx, ly] = pts[pts.length - 1];
  body += `<circle cx="${n(lx)}" cy="${n(ly)}" r="5" fill="${r.color}" stroke="${BG}" stroke-width="2"/>`;
}

// Bottom right: what the Legendre run's nodes learned. Each node's activation is a sum of 10 Legendre polynomials of
// tanh(z), its coefficients trained by gradient descent with the weights; shown over the inputs z that node receives.
const L = RUNS[2], curves = Object.values(L.curves).sort((a, b) => (a.type === 'output') - (b.type === 'output'));
body += text(MED, 'Activations it learned', 20, COLS[2], CT - 34, INK);
const AW = (CW - 24 * (curves.length - 1)) / curves.length, AT = CT + 10, AH = 200;
curves.forEach((cv, i) => {
  const X = COLS[2] + i * (AW + 24), zmin = cv.z[0], zmax = cv.z[cv.z.length - 1], fmin = Math.min(...cv.f), fmax = Math.max(...cv.f), pad = (fmax - fmin) * 0.12 || 1;
  const px = (z) => X + (z - zmin) / (zmax - zmin) * AW, py = (f) => AT + (fmax + pad - f) / (fmax - fmin + 2 * pad) * AH;
  body += `<rect x="${X}" y="${AT}" width="${n(AW)}" height="${AH}" rx="10" fill="rgba(244,239,232,.04)" stroke="${FAINT}"/>`;
  body += line(cv.z.map((z, j) => [px(z), py(cv.f[j])]), L.color, 3);
  body += text(REG, `${cv.type === 'output' ? 'output' : 'hidden'} node`, 17, X + AW / 2, AT + AH + 28, MUTED, 'middle');
});

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * K}" height="${H * K}" viewBox="0 0 ${W} ${H}">${body}</svg>`);
await sharp(svg).webp({ quality: 90, effort: 6, smartSubsample: true }).toFile(OUT);
console.log('modes.webp', RUNS.map((r) => `${r.key}: ${r.generations} gens, MSE ${r.mse[r.mse.length - 1].toExponential(2)}, ${r.hidden} hidden, ${r.connections} cxns, ${r.seconds}s`).join('; '));
