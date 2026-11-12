// Draws the chess engine's two explanatory slides: how bitboards hold a position and generate moves, and how an
// NNUE evaluates one. Laid out on a 1152×648 grid and drawn at twice that, for sharp text on retina screens.
// Run from the repo root: node tools/build-chess.mjs
// Not used on the site: the chess engine now shows only its game, with bullets beside it. Kept for reference.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp'), opentype = require('opentype.js');
const FONTS = path.join(here, '../toolkit/node_modules/@fontsource'), OUT = path.join(here, '../media/projects/chess-engine');
const font = (pkg, file) => { const b = fs.readFileSync(path.join(FONTS, pkg, 'files', file)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const SEMI = font('hanken-grotesk', 'hanken-grotesk-latin-600-normal.woff'), REG = font('hanken-grotesk', 'hanken-grotesk-latin-400-normal.woff');
const MONO = font('jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff');
const W = 1152, H = 648, K = 2;
const BG = '#171513', INK = '#f4efe8', MUTED = 'rgba(244,239,232,.6)', FAINT = 'rgba(244,239,232,.32)', ACCENT = '#ffb98a';
const LIGHT_SQ = '#3b332c', DARK_SQ = '#2a2420';

// Text as SVG paths, so the fonts don't need installing (as in build-paper.mjs). Align is 'start', 'middle' or 'end'.
const n = (v) => (Math.round(v * 100) / 100).toString();
const pathData = (p) => p.commands.map((c) => c.type === 'Z' ? 'Z' : c.type === 'Q' ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}` : c.type === 'C' ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}` : `${c.type}${n(c.x)} ${n(c.y)}`).join('');
const glyph = (f, ch) => { const g = f.charToGlyph(ch); if (!g.index && ch !== ' ') throw new Error(`no glyph for ${ch}`); return g; };
const width = (f, s, size, ls = 0) => {
  let w = 0, prev = null;
  for (const ch of s) { const g = glyph(f, ch); if (prev) w += f.getKerningValue(prev, g) * size / f.unitsPerEm; w += g.advanceWidth * size / f.unitsPerEm + ls * size; prev = g; }
  return w - (s.length ? ls * size : 0);
};
function text(f, s, size, x, y, fill, { align = 'start', ls = 0 } = {}) {
  let cx = x - (align === 'middle' ? width(f, s, size, ls) / 2 : align === 'end' ? width(f, s, size, ls) : 0), prev = null, d = '';
  for (const ch of s) {
    const g = glyph(f, ch);
    if (prev) cx += f.getKerningValue(prev, g) * size / f.unitsPerEm;
    d += pathData(g.getPath(cx, y, size));
    cx += g.advanceWidth * size / f.unitsPerEm + ls * size; prev = g;
  }
  return d ? `<path fill="${fill}" d="${d}"/>` : '';
}
const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * K}" height="${H * K}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${BG}"/>${body}</svg>`);
const save = (body, name, lift = 0) => sharp(svg(`<g transform="translate(0 ${-lift})">${body}</g>`)).webp({ quality: 90, effort: 6, smartSubsample: true }).toFile(path.join(OUT, `${name}.webp`));
const head = (x, y, title, sub) => text(SEMI, title, 19, x, y, INK) + text(REG, sub, 14.5, x, y + 22, MUTED);
const arrow = (x1, y1, x2, y2, stroke, w = 1.5) => {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 7, s = 0.45;
  return `<path d="M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`
    + `<path d="M${n(x2 - h * Math.cos(a - s))} ${n(y2 - h * Math.sin(a - s))}L${n(x2)} ${n(y2)}L${n(x2 - h * Math.cos(a + s))} ${n(y2 - h * Math.sin(a + s))}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
};

// Bitboards, on the position after 1.e4 e5 2.Nf3 Nc6. Squares run a1 = bit 0 to h8 = bit 63, as in the engine.
async function bitboards() {
  const RANKS = ['r.bqkbnr', 'pppp.ppp', '..n.....', '....p...', '....P...', '.....N..', 'PPPP.PPP', 'RNBQKB.R']; // rank 8 first
  const at = (file, rank) => RANKS[7 - rank][file];
  const knights = [], pawns = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { if (at(f, r) === 'N') knights.push(r * 8 + f); if (at(f, r) === 'P') pawns.push(r * 8 + f); }
  const S = 288, q = S / 8, TOP = 150, XS = [72, 432, 792], body = [];
  const sq = (x0, f, r) => [x0 + f * q, TOP + (7 - r) * q];
  const board = (x0, fill) => { let s = ''; for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const [x, y] = sq(x0, f, r); s += `<rect x="${x}" y="${y}" width="${q}" height="${q}" fill="${fill(f, r)}"/>`; } return s; };
  const shade = (f, r) => ((f + r) % 2 ? LIGHT_SQ : DARK_SQ);
  const token = (x0, f, r, ch, { ring = null, dim = false } = {}) => {
    const [x, y] = sq(x0, f, r), cx = x + q / 2, cy = y + q / 2, white = ch === ch.toUpperCase();
    const fill = white ? INK : '#0d0b0a', ink = white ? '#171513' : INK, o = dim ? ' opacity=".38"' : '';
    return `<g${o}><circle cx="${cx}" cy="${cy}" r="${q * 0.36}" fill="${fill}" stroke="${ring || (white ? 'none' : 'rgba(244,239,232,.55)')}" stroke-width="${ring ? 2.4 : 1.2}"/>`
      + `${text(SEMI, ch.toUpperCase(), 15, cx, cy + 5.4, ink, { align: 'middle' })}</g>`;
  };
  const files = (x0) => [...'abcdefgh'].map((c, f) => text(REG, c, 12, x0 + f * q + q / 2, TOP + S + 17, FAINT, { align: 'middle' })).join('')
    + [...'12345678'].map((c, r) => text(REG, c, 12, x0 - 9, TOP + (7 - r) * q + q / 2 + 4.5, FAINT, { align: 'end' })).join('');

  // The position, white knights ringed.
  body.push(head(XS[0], 96, 'Position', 'Stored as 12 bitboards, one per piece'));
  body.push(board(XS[0], shade), files(XS[0]));
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const c = at(f, r); if (c !== '.') body.push(token(XS[0], f, r, c, { ring: c === 'N' ? ACCENT : null })); }

  // The white knights' bitboard: a 1 on each square with a white knight.
  body.push(head(XS[1], 96, 'White knights', 'One bit per square'));
  body.push(board(XS[1], (f, r) => (knights.includes(r * 8 + f) ? 'rgba(255,185,138,.22)' : shade(f, r))), files(XS[1]));
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const [x, y] = sq(XS[1], f, r), on = knights.includes(r * 8 + f); body.push(text(MONO, on ? '1' : '0', on ? 17 : 14, x + q / 2, y + q / 2 + (on ? 6 : 5), on ? ACCENT : FAINT, { align: 'middle' })); }
  const hex = '0x' + knights.reduce((v, b) => v | (1n << BigInt(b)), 0n).toString(16).toUpperCase().padStart(16, '0');
  body.push(text(MONO, hex, 15, XS[1] + S / 2, TOP + S + 44, ACCENT, { align: 'middle' }));
  body.push(arrow(XS[0] + S + 22, TOP + S / 2, XS[1] - 24, TOP + S / 2, MUTED));

  // Every single pawn push at once: shift the pawns up a rank, keep the empty squares.
  body.push(head(XS[2], 96, 'Pawn pushes', 'All eight pawns in one operation'));
  const occupied = (f, r) => at(f, r) !== '.';
  body.push(board(XS[2], (f, r) => (r > 0 && pawns.includes((r - 1) * 8 + f) && !occupied(f, r) ? 'rgba(255,185,138,.22)' : shade(f, r))), files(XS[2]));
  for (const p of pawns) {
    const f = p % 8, r = p >> 3, [x, y] = sq(XS[2], f, r), cx = x + q / 2, blocked = occupied(f, r + 1);
    body.push(token(XS[2], f, r, 'P', { dim: true }));
    if (blocked) { body.push(token(XS[2], f, r + 1, at(f, r + 1), { dim: true })); const [bx, by] = sq(XS[2], f, r + 1); body.push(`<path d="M${bx + 10} ${by + 10}L${bx + q - 10} ${by + q - 10}M${bx + q - 10} ${by + 10}L${bx + 10} ${by + q - 10}" stroke="#e0705a" stroke-width="2.4" stroke-linecap="round"/>`); }
    else { const [tx, ty] = sq(XS[2], f, r + 1); body.push(`<circle cx="${tx + q / 2}" cy="${ty + q / 2}" r="5" fill="${ACCENT}"/>`); }
    body.push(arrow(cx, y + 3, cx, y - (blocked ? 3 : 8), blocked ? 'rgba(224,112,90,.8)' : ACCENT, 1.4));
  }
  body.push(text(MONO, '(pawns << 8) & empty', 15, XS[2] + S / 2, TOP + S + 44, ACCENT, { align: 'middle' }));

  // The knights' bitboard written out as the integer it is, bit 63 (h8) on the left down to bit 0 (a1).
  const c = 15, X0 = (W - 64 * c) / 2, Y = 540;
  body.push(text(REG, 'The same bitboard as one 64-bit integer', 14.5, X0, Y - 14, MUTED));
  for (let i = 0; i < 64; i++) {
    const bit = 63 - i, on = knights.includes(bit), x = X0 + i * c;
    body.push(`<rect x="${x + 1}" y="${Y}" width="${c - 2}" height="24" rx="2.5" fill="${on ? ACCENT : 'rgba(244,239,232,.07)'}"/>`);
    body.push(text(MONO, on ? '1' : '0', 11, x + c / 2, Y + 16.5, on ? '#171513' : FAINT, { align: 'middle' }));
  }
  for (let b = 0; b < 8; b++) { const x = X0 + b * 8 * c; body.push(`<path d="M${x + 2} ${Y + 32}H${x + 8 * c - 2}" stroke="${FAINT}" stroke-width="1"/>`, text(REG, `rank ${8 - b}`, 12, x + 4 * c, Y + 48, FAINT, { align: 'middle' })); }
  body.push(text(REG, 'bit 63 = h8', 12, X0, Y + 70, FAINT), text(REG, 'bit 0 = a1', 12, X0 + 64 * c, Y + 70, FAINT, { align: 'end' }));
  await save(body.join(''), 'bitboards', 20);
}

// NNUE: sparse board features feed a wide first layer (the accumulator), then small dense layers give the score.
// A move only switches a few features, so the accumulator is updated by adding and subtracting weight columns.
async function nnue() {
  const body = [], TOP = 150, BOT = 452;
  const col = (count, x, y0 = TOP, y1 = BOT) => Array.from({ length: count }, (_, i) => [x, y0 + (i + 0.5) * (y1 - y0) / count]);
  const inputs = col(28, 150), acc = col(16, 440, TOP + 6, BOT - 6), h1 = col(8, 690, TOP + 60, BOT - 60), h2 = col(8, 810, TOP + 60, BOT - 60), out = [[960, (TOP + BOT) / 2]];
  const on = [3, 7, 12, 16, 22, 25], gone = 9, added = 19; // which input rows are active; a knight leaves g1 (gone) for f3 (added)
  const lines = (a, b, stroke, w) => `<path d="${a.map(([x1, y1]) => b.map(([x2, y2]) => `M${x1} ${n(y1)}L${x2} ${n(y2)}`).join('')).join('')}" stroke="${stroke}" stroke-width="${w}" fill="none"/>`;
  // Only the active features reach the accumulator.
  body.push(lines(on.map((i) => [inputs[i][0] + 6, inputs[i][1]]), acc.map(([x, y]) => [x - 22, y]), 'rgba(244,239,232,.09)', 0.8));
  body.push(lines([[inputs[added][0] + 6, inputs[added][1]]], acc.map(([x, y]) => [x - 22, y]), 'rgba(255,185,138,.55)', 1));
  body.push(lines([[inputs[gone][0] + 6, inputs[gone][1]]], acc.map(([x, y]) => [x - 22, y]), 'rgba(224,112,90,.3)', 0.9));
  body.push(lines(acc.map(([x, y]) => [x + 22, y]), h1.map(([x, y]) => [x - 9, y]), 'rgba(244,239,232,.07)', 0.7));
  body.push(lines(h1.map(([x, y]) => [x + 9, y]), h2.map(([x, y]) => [x - 9, y]), 'rgba(244,239,232,.14)', 0.8));
  body.push(lines(h2.map(([x, y]) => [x + 9, y]), out.map(([x, y]) => [x - 16, y]), 'rgba(244,239,232,.22)', 0.9));
  inputs.forEach(([x, y], i) => {
    const fill = i === added ? ACCENT : i === gone ? 'none' : on.includes(i) ? INK : 'rgba(244,239,232,.14)';
    body.push(`<circle cx="${x}" cy="${n(y)}" r="4.6" fill="${fill}"${i === gone ? ' stroke="#e0705a" stroke-width="1.6"' : ''}/>`);
  });
  body.push(text(MONO, '+ knight f3', 13, 136, inputs[added][1] + 4.5, ACCENT, { align: 'end' }));
  body.push(text(MONO, '− knight g1', 13, 136, inputs[gone][1] + 4.5, '#e0705a', { align: 'end' }));
  acc.forEach(([x, y]) => body.push(`<rect x="${x - 22}" y="${n(y - 7.5)}" width="44" height="15" rx="3" fill="rgba(255,185,138,.16)" stroke="rgba(255,185,138,.6)" stroke-width="1"/>`));
  [...h1, ...h2].forEach(([x, y]) => body.push(`<circle cx="${x}" cy="${n(y)}" r="8.5" fill="${BG}" stroke="rgba(244,239,232,.6)" stroke-width="1.3"/>`));
  body.push(`<circle cx="${out[0][0]}" cy="${out[0][1]}" r="16" fill="${ACCENT}"/>`);
  body.push(text(SEMI, 'Score', 15, out[0][0] + 28, out[0][1] + 5.5, INK));

  body.push(head(80, 96, 'Board features', 'One input per piece and square'));
  body.push(text(REG, 'Sparse: at most 32 are on', 14.5, 150, BOT + 34, MUTED, { align: 'middle' }));
  body.push(head(380, 96, 'Accumulator', 'Wide first layer, kept up to date'));
  body.push(head(660, 96, 'Small dense layers', 'Cheap to run on a CPU'));
  body.push(head(930, 96, 'Evaluation', 'One number for the position'));

  // The incremental update, written out.
  const Y = 548;
  body.push(`<rect x="80" y="${Y - 34}" width="${W - 160}" height="74" rx="12" fill="rgba(244,239,232,.04)" stroke="rgba(244,239,232,.12)"/>`);
  body.push(text(REG, 'After Ng1–f3, only two weight columns change:', 15, 106, Y - 6, MUTED));
  body.push(text(MONO, 'acc = acc − W[knight, g1] + W[knight, f3]', 17, 106, Y + 22, INK));
  body.push(text(REG, 'no full recompute', 15, W - 106, Y + 22, ACCENT, { align: 'end' }));
  await save(body.join(''), 'nnue', 12);
}

fs.mkdirSync(OUT, { recursive: true });
await bitboards();
await nnue();
for (const f of ['bitboards', 'nnue']) console.log(f, (fs.statSync(path.join(OUT, `${f}.webp`)).size / 1e3).toFixed(0), 'kB');
