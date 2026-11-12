// Draws EvoGrad's CartPole clip: the fittest network of successive generations of one run, each playing one episode of
// Gymnasium's CartPole-v1 from the same start, one lane per generation, each with its network beside it. Every frame is
// one step of the recorded episodes (50 steps a second, so it plays in real time), drawn from the cart's position and
// the pole's angle as the environment reported them. Laid out on a 1600×900 grid.
// Run tools/cartpole.py first (it runs the evolution, picks the generations and the start, and writes
// toolkit/sources/cartpole.json), then, from the repo root: node tools/build-cartpole.mjs
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTES, DEFAULT_PALETTE } from '../js/palette.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp'), opentype = require('opentype.js');
const FONTS = path.join(here, '../toolkit/node_modules/@fontsource');
const DATA = JSON.parse(fs.readFileSync(path.join(here, '../toolkit/sources/cartpole.json'), 'utf8'));
// PALETTE=e draws it in palette e, as cartpole-e.mp4 beside the default one (see BAKED in js/palette.js).
const KEY = process.env.PALETTE || DEFAULT_PALETTE;
const OUT = path.join(here, `../media/projects/hybrid-networks/${KEY === DEFAULT_PALETTE ? 'cartpole' : `cartpole-${KEY}`}.mp4`);
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
const BG = '#0e0c0b', INK = '#f4efe8', MUTED = 'rgba(244,239,232,.62)', FAINT = 'rgba(244,239,232,.16)', ACCENT = PALETTES[KEY].accent; // the site palette's highlight
const tint = (a) => `rgba(${[1, 3, 5].map((i) => parseInt(ACCENT.slice(i, i + 2), 16)).join(',')},${a})`;
const POS = '#7aaef0', NEG = '#ee7f62'; // the network slide's blue and red, lifted for a dark ground

// The track and the cart in Gymnasium's own units: the cart may go 2.4 m either side of centre, the pole is 1 m long
// (pivot to tip) and fails past 12°; the cart is drawn 0.4 m by 0.24 m, as Gymnasium draws it.
const ep = DATA.episodes, LH = H / ep.length, FRAMES = Math.max(...ep.map((e) => e.steps)) + HOLD;
const S = Math.min(180, LH * 0.5), CX = 860, X_MAX = 2.4, POLE = 1.0, LIMIT = 12 * Math.PI / 180, CART_W = 0.4 * S, CART_H = 0.24 * S, WHEEL = Math.max(4, S * 0.045);
const avg = (e) => e.test_full === 100 ? 'balances 500 steps from all 100 test starts' : `averages ${Math.round(e.test_mean)} steps over 100 test starts`;
const LANES = ep.map((e, i) => ({ e, top: i * LH, sub: avg(e) }));

// A small drawing of the lane's network: the four inputs (cart position and velocity, pole angle and angular velocity)
// in a column on the left, the two outputs (push left, push right) on the right, any hidden nodes between; edges
// coloured by the weight's sign, thicker for larger weights, inputs it doesn't use dimmed.
function network(net, top) {
  const ix = 1290, ox = 1470, hx = (ix + ox) / 2, r = 8, mid = top + LH * 0.42, gap = Math.min(28, LH * 0.15);
  const pos = {}, ins = net.nodes.filter((d) => d.type === 'input'), outs = net.nodes.filter((d) => d.type === 'output'), hid = net.nodes.filter((d) => d.type === 'hidden');
  ins.forEach((d, i) => { pos[d.id] = [ix, mid + (i - (ins.length - 1) / 2) * gap]; });
  outs.forEach((d, i) => { pos[d.id] = [ox, mid + (i - (outs.length - 1) / 2) * gap * 1.4]; });
  hid.forEach((d, i) => { pos[d.id] = [hx + (i - (hid.length - 1) / 2) * gap * 1.6, mid - gap * 2.1]; }); // a row above, clear of the edges
  const on = net.connections.filter((c) => c.enabled), used = new Set(on.flatMap((c) => [String(c.from), String(c.to)]));
  let s = '';
  for (const c of on) {
    const [x1, y1] = pos[c.from], [x2, y2] = pos[c.to], len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const sw = (1.2 + 2.6 * Math.min(Math.abs(c.weight), 30) / 30).toFixed(2);
    s += `<line x1="${n(x1 + ux * r)}" y1="${n(y1 + uy * r)}" x2="${n(x2 - ux * (r + 1))}" y2="${n(y2 - uy * (r + 1))}" stroke="${c.weight >= 0 ? POS : NEG}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  for (const d of ins) { const [x, y] = pos[d.id], u = used.has(String(d.id)); s += `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(244,239,232,${u ? 0.16 : 0.05})" stroke="rgba(244,239,232,${u ? 0.5 : 0.18})" stroke-width="1.5"/>`; }
  for (const d of hid) { const [x, y] = pos[d.id]; s += `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(244,239,232,.12)" stroke="rgba(244,239,232,.5)" stroke-width="1.5"/>`; }
  for (const d of outs) { const [x, y] = pos[d.id]; s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${tint(.2)}" stroke="${tint(.75)}" stroke-width="1.5"/>`; }
  const label = `${on.length} connection${on.length === 1 ? '' : 's'}${hid.length ? `, ${hid.length} hidden node${hid.length === 1 ? '' : 's'}` : ''}`;
  return s + text(REG, label, 19, (ix + ox) / 2, top + LH * 0.42 + gap * 1.5 + 34, MUTED, 'middle');
}

// What stays put in a lane: its title and test result, the track with its end stops and centre mark, and the network.
const railY = (top) => top + LH * 0.8;
function still({ e, top, sub }) {
  const rail = railY(top), x0 = CX - X_MAX * S, x1 = CX + X_MAX * S, ty = top + LH / 2 - 30;
  let s = text(SEMI, `Generation ${e.gen}`, 30, 64, ty, INK) + text(REG, sub, 20, 64, ty + 32, MUTED);
  s += `<line x1="${n(x0)}" y1="${n(rail)}" x2="${n(x1)}" y2="${n(rail)}" stroke="rgba(244,239,232,.3)" stroke-width="2"/>`;
  for (const x of [x0, x1]) s += `<line x1="${n(x)}" y1="${n(rail - 12)}" x2="${n(x)}" y2="${n(rail + 5)}" stroke="rgba(244,239,232,.45)" stroke-width="2" stroke-linecap="round"/>`;
  s += `<line x1="${CX}" y1="${n(rail + 2)}" x2="${CX}" y2="${n(rail + 8)}" stroke="rgba(244,239,232,.3)" stroke-width="2" stroke-linecap="round"/>`;
  return s + network(e.network, top);
}
const STILL = `<rect width="${W}" height="${H}" fill="${BG}"/>` + LANES.map(still).join('')
  + LANES.slice(1).map(({ top }) => `<line x1="64" y1="${n(top)}" x2="${W - 64}" y2="${n(top)}" stroke="rgba(244,239,232,.1)" stroke-width="1.5"/>`).join('');

// What moves: the cart and pole at step k (held on the last state once the episode is over), the ±12° limits
// around the pole, and the step counter, or how the episode ended.
const secs = (k) => (k / FPS).toFixed(2);
function moving({ e, top }, f) {
  const k = Math.min(f, e.steps), [x, , th] = e.obs[k], over = k === e.steps;
  const rail = railY(top), cx = CX + x * S, cy = rail - WHEEL * 1.6, px = cx, py = cy - CART_H * 0.78;
  const fade = over && e.end !== 'limit' ? 0.45 : 1;
  let s = `<g opacity="${fade}">`;
  for (const a of [-LIMIT, LIMIT]) s += `<line x1="${n(px)}" y1="${n(py)}" x2="${n(px + Math.sin(a) * POLE * S * 1.08)}" y2="${n(py - Math.cos(a) * POLE * S * 1.08)}" stroke="${FAINT}" stroke-width="1.5" stroke-dasharray="5 6"/>`;
  s += `<rect x="${n(cx - CART_W / 2)}" y="${n(cy - CART_H)}" width="${n(CART_W)}" height="${n(CART_H)}" rx="${n(CART_H * 0.15)}" fill="${INK}" fill-opacity=".9"/>`;
  for (const dx of [-CART_W * 0.28, CART_W * 0.28]) s += `<circle cx="${n(cx + dx)}" cy="${n(rail - WHEEL)}" r="${n(WHEEL)}" fill="${BG}" stroke="${INK}" stroke-opacity=".9" stroke-width="2"/>`;
  s += `<line x1="${n(px)}" y1="${n(py)}" x2="${n(px + Math.sin(th) * POLE * S)}" y2="${n(py - Math.cos(th) * POLE * S)}" stroke="${ACCENT}" stroke-width="${n(S * 0.066)}" stroke-linecap="round"/>`;
  s += `<circle cx="${n(px)}" cy="${n(py)}" r="${n(S * 0.024)}" fill="${BG}"/></g>`;
  const y = top + LH / 2 + 36;
  if (!over) s += text(MED, `Step ${k}  ·  ${secs(k)} s`, 20, 64, y, INK);
  else if (e.end === 'limit') s += text(MED, `${e.steps} of ${e.steps} steps (${secs(e.steps)} s)`, 20, 64, y, ACCENT);
  else s += text(MED, `${e.end === 'angle' ? 'Pole fell' : 'Cart left the track'} at step ${e.steps} (${secs(e.steps)} s)`, 20, 64, y, ACCENT);
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
console.log(path.basename(OUT), `${FRAMES} frames`, `${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB`, LANES.map(({ e }) => `generation ${e.gen}: ${e.steps} steps, ${e.end}`).join('; '));
