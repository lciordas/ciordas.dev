// Draws EvoGrad's CartPole clip: the fittest network of the first generation and of the last, each playing one episode
// of Gymnasium's CartPole-v1 from the same start, one above the other, each beside a drawing of its network. Every
// frame is one step of the recorded episodes (50 steps a second, so it plays in real time), drawn from the cart's
// position and the pole's angle as the environment reported them. Laid out on a 1600×900 grid.
// Run tools/cartpole.py first (it runs the evolution and writes toolkit/sources/cartpole.json), then, from the repo root:
// node tools/build-cartpole.mjs
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp'), opentype = require('opentype.js');
const FONTS = path.join(here, '../toolkit/node_modules/@fontsource');
const DATA = JSON.parse(fs.readFileSync(path.join(here, '../toolkit/sources/cartpole.json'), 'utf8'));
const OUT = path.join(here, '../media/projects/hybrid-networks/cartpole.mp4');
const font = (pkg, file) => { const b = fs.readFileSync(path.join(FONTS, pkg, 'files', file)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const REG = font('hanken-grotesk', 'hanken-grotesk-latin-400-normal.woff'), MED = font('hanken-grotesk', 'hanken-grotesk-latin-500-normal.woff'), SEMI = font('hanken-grotesk', 'hanken-grotesk-latin-600-normal.woff');

// Text as SVG paths, glyph by glyph with kerning. Digits all take the widest digit's width, so counters don't jitter.
const n = (v) => (Math.round(v * 100) / 100).toString();
const pathData = (p) => p.commands.map((c) => c.type === 'Z' ? 'Z' : c.type === 'Q' ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}` : c.type === 'C' ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}` : `${c.type}${n(c.x)} ${n(c.y)}`).join('');
const DIGIT = (f) => Math.max(...'0123456789'.split('').map((d) => f.charToGlyph(d).advanceWidth));
function run(f, s, size) {
  const k = size / f.unitsPerEm, dw = DIGIT(f) * k, out = []; let x = 0, prev = null;
  for (const ch of s) {
    const g = f.charToGlyph(ch), digit = /\d/.test(ch);
    if (prev && !digit) x += f.getKerningValue(prev, g) * k;
    const adv = digit ? dw : g.advanceWidth * k;
    out.push({ g, x: x + (digit ? (dw - g.advanceWidth * k) / 2 : 0) }); x += adv; prev = digit ? null : g;
  }
  return { out, w: x };
}
function text(f, s, size, x, y, fill, anchor = 'start', opacity = 1) {
  const r = run(f, s, size), x0 = anchor === 'end' ? x - r.w : anchor === 'middle' ? x - r.w / 2 : x;
  return `<path fill="${fill}"${opacity < 1 ? ` opacity="${opacity}"` : ''} d="${r.out.map(({ g, x: gx }) => pathData(g.getPath(x0 + gx, y, size))).join('')}"/>`;
}

const W = 1600, H = 900, FPS = 50, HOLD = 1.5 * FPS;
const BG = '#0e0c0b', INK = '#f4efe8', MUTED = 'rgba(244,239,232,.62)', FAINT = 'rgba(244,239,232,.16)', ACCENT = '#ffb98a';
const POS = '#7aaef0', NEG = '#ee7f62'; // the network slide's blue and red, lifted for a dark ground

// The track and the cart in Gymnasium's own units: the cart may go 2.4 m either side of centre, the pole is 1 m long
// (pivot to tip) and fails past 12°; the cart is drawn 0.4 m by 0.24 m, as Gymnasium draws it.
const S = 180, CX = 520, X_MAX = 2.4, POLE = 1.0, LIMIT = 12 * Math.PI / 180, CART_W = 0.4 * S, CART_H = 0.24 * S, WHEEL = 7;
const ep = DATA.episodes, LAST = ep[ep.length - 1], FRAMES = Math.max(...ep.map((e) => e.steps)) + HOLD;
const LANES = [
  { e: ep[0], top: 0, sub: `the best of ${DATA.population} random starting networks` },
  { e: LAST, top: 450, sub: `the best after ${LAST.gen} generations of evolution` },
];

// A network, as in the gallery's network slide: inputs in a column on the left, outputs on the right, any hidden nodes
// between; edges coloured by the weight's sign, thicker for larger weights.
const INPUTS = ['cart position', 'cart velocity', 'pole angle', 'pole angular velocity'], OUTPUTS = ['push left', 'push right'];
function network(net, top) {
  const ix = 1196, ox = 1418, hx = (ix + ox) / 2, r = 16, mid = top + 268;
  const pos = {}, ins = net.nodes.filter((d) => d.type === 'input'), outs = net.nodes.filter((d) => d.type === 'output'), hid = net.nodes.filter((d) => d.type === 'hidden');
  ins.forEach((d, i) => { pos[d.id] = [ix, mid + (i - (ins.length - 1) / 2) * 56]; });
  outs.forEach((d, i) => { pos[d.id] = [ox, mid + (i - (outs.length - 1) / 2) * 76]; });
  hid.forEach((d, i) => { pos[d.id] = [hx, mid + (i - (hid.length - 1) / 2) * 64]; });
  const used = new Set(net.connections.filter((c) => c.enabled).flatMap((c) => [String(c.from), String(c.to)]));
  let s = text(MED, 'Network', 19, 1006, top + 76, INK);
  const nc = net.connections.filter((c) => c.enabled).length;
  s += text(REG, `${nc} connection${nc === 1 ? '' : 's'}, ${hid.length ? `${hid.length} hidden node${hid.length === 1 ? '' : 's'}` : 'no hidden nodes'}`, 17, 1006, top + 104, MUTED);
  for (const c of net.connections.filter((c) => c.enabled)) {
    const [x1, y1] = pos[c.from], [x2, y2] = pos[c.to], len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const sw = (1.4 + 3.6 * Math.min(Math.abs(c.weight), 30) / 30).toFixed(2);
    s += `<line x1="${n(x1 + ux * r)}" y1="${n(y1 + uy * r)}" x2="${n(x2 - ux * (r + 2))}" y2="${n(y2 - uy * (r + 2))}" stroke="${c.weight >= 0 ? POS : NEG}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  ins.forEach((d, i) => {
    const [x, y] = pos[d.id], on = used.has(String(d.id));
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(244,239,232,${on ? 0.16 : 0.06})" stroke="rgba(244,239,232,${on ? 0.5 : 0.2})" stroke-width="1.5"/>`;
    s += text(REG, INPUTS[i], 17, x - r - 14, y + 6, INK, 'end', on ? 0.85 : 0.38);
  });
  hid.forEach((d) => { const [x, y] = pos[d.id]; s += `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(244,239,232,.1)" stroke="rgba(244,239,232,.45)" stroke-width="1.5"/>`; });
  outs.forEach((d, i) => {
    const [x, y] = pos[d.id];
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,185,138,.2)" stroke="rgba(255,185,138,.75)" stroke-width="1.5"/>`;
    s += text(REG, OUTPUTS[i], 17, x + r + 14, y + 6, INK, 'start', 0.85);
  });
  return s;
}

// What stays put in a lane: its title, the track with its end stops and centre mark, and the network.
function still({ e, top, sub }) {
  const rail = top + 392, x0 = CX - X_MAX * S, x1 = CX + X_MAX * S;
  let s = text(SEMI, `Generation ${e.gen}`, 30, 64, top + 78, INK) + text(REG, sub, 19, 64, top + 108, MUTED);
  s += `<line x1="${x0}" y1="${rail}" x2="${x1}" y2="${rail}" stroke="rgba(244,239,232,.3)" stroke-width="2"/>`;
  for (const x of [x0, x1]) s += `<line x1="${x}" y1="${rail - 16}" x2="${x}" y2="${rail + 6}" stroke="rgba(244,239,232,.45)" stroke-width="2" stroke-linecap="round"/>`;
  s += `<line x1="${CX}" y1="${rail + 2}" x2="${CX}" y2="${rail + 10}" stroke="rgba(244,239,232,.3)" stroke-width="2" stroke-linecap="round"/>`;
  return s + network(e.network, top);
}
const STILL = `<rect width="${W}" height="${H}" fill="${BG}"/>` + LANES.map(still).join('') + `<line x1="64" y1="450" x2="${W - 64}" y2="450" stroke="rgba(244,239,232,.1)" stroke-width="1.5"/>`;

// What moves: the cart and pole at step k (held on the last state once the episode is over), the ±12° limits
// around the pole, and the step counter, or how the episode ended.
const secs = (k) => (k / FPS).toFixed(2);
function moving({ e, top }, f) {
  const k = Math.min(f, e.steps), [x, , th] = e.obs[k], over = k === e.steps;
  const rail = top + 392, cx = CX + x * S, cy = rail - WHEEL - 3, px = cx, py = cy - CART_H + 9;
  const fade = over && e.end !== 'limit' ? 0.5 : 1;
  let s = `<g opacity="${fade}">`;
  for (const a of [-LIMIT, LIMIT]) s += `<line x1="${n(px)}" y1="${n(py)}" x2="${n(px + Math.sin(a) * POLE * S * 1.08)}" y2="${n(py - Math.cos(a) * POLE * S * 1.08)}" stroke="${FAINT}" stroke-width="1.5" stroke-dasharray="5 6"/>`;
  s += `<rect x="${n(cx - CART_W / 2)}" y="${n(cy - CART_H)}" width="${n(CART_W)}" height="${n(CART_H)}" rx="6" fill="${INK}" fill-opacity=".9"/>`;
  for (const dx of [-CART_W / 2 + 15, CART_W / 2 - 15]) s += `<circle cx="${n(cx + dx)}" cy="${n(rail - WHEEL)}" r="${WHEEL}" fill="${BG}" stroke="${INK}" stroke-opacity=".9" stroke-width="2.5"/>`;
  s += `<line x1="${n(px)}" y1="${n(py)}" x2="${n(px + Math.sin(th) * POLE * S)}" y2="${n(py - Math.cos(th) * POLE * S)}" stroke="${ACCENT}" stroke-width="12" stroke-linecap="round"/>`;
  s += `<circle cx="${n(px)}" cy="${n(py)}" r="4.5" fill="${BG}"/></g>`;
  const y = top + 146;
  if (!over) s += text(MED, `Step ${k}  ·  ${secs(k)} s`, 19, 64, y, INK);
  else if (e.end === 'limit') s += text(MED, `${e.steps} of ${e.steps} steps (${secs(e.steps)} s), the episode's limit`, 19, 64, y, ACCENT);
  else s += text(MED, `Failed at step ${e.steps} (${secs(e.steps)} s): ${e.end === 'angle' ? 'pole past 12°' : 'cart off the track'}`, 19, 64, y, ACCENT);
  return s;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cartpole-'));
for (let f = 0; f < FRAMES; f++) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${STILL}${LANES.map((l) => moving(l, f)).join('')}</svg>`;
  await sharp(Buffer.from(svg)).png({ compressionLevel: 1 }).toFile(path.join(tmp, `${String(f).padStart(4, '0')}.png`));
}
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(tmp, '%04d.png'), '-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '27', '-preset', 'slow', '-movflags', '+faststart', OUT]);
for (const f of [0, 300, FRAMES - 1]) fs.copyFileSync(path.join(tmp, `${String(f).padStart(4, '0')}.png`), path.join(os.tmpdir(), `cartpole-${f}.png`));
fs.rmSync(tmp, { recursive: true, force: true });
console.log('cartpole.mp4', `${FRAMES} frames`, `${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB`, LANES.map(({ e }) => `generation ${e.gen}: ${e.steps} steps, ${e.end}`).join('; '));
