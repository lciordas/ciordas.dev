// Turns a font and a name into the geometry the intro uses: outlines for tracing,
// and each letter already cut into shards with the crack lines between them.
// Run from the repo root: node tools/build-name.mjs
// Needs the local toolkit folder, which holds fontkit, polygon-clipping, and d3-delaunay.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const toolkit = path.join(here, '../toolkit/');
const require = createRequire(toolkit + 'x.js');
const fontkit = require('fontkit');
const pc = require('polygon-clipping');
const { Delaunay } = require('d3-delaunay');

const S = path.join(toolkit, 'node_modules/@fontsource/');
const FONTS = {
  barlow: { file: S + 'barlow-condensed/files/barlow-condensed-latin-900-normal.woff', gap: 0.07 },
  shoulders: { file: S + 'big-shoulders-display/files/big-shoulders-display-latin-900-normal.woff', gap: 0.07 },
  teko: { file: S + 'teko/files/teko-latin-700-normal.woff', gap: 0.08 },
  inter: { file: S + 'inter-tight/files/inter-tight-latin-900-normal.woff', gap: 0.08 },
  anton: { file: S + 'anton/files/anton-latin-400-normal.woff', gap: 0.07 },
};
const LINES = ['LUCAS', 'CIORDAS'];
const WIDTH = 4; // world units

const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const round = (v) => Math.round(v * 10000) / 10000;

function flatten(path, sx, sy, ox, oy) {
  const out = []; let cur = null, x = 0, y = 0;
  const add = (px, py) => { const X = px * sx + ox, Y = py * sy + oy; const l = cur[cur.length - 1]; if (!l || Math.hypot(l[0] - X, l[1] - Y) > 1e-5) cur.push([X, Y]); };
  for (const c of path.commands) {
    const a = c.args;
    if (c.command === 'moveTo') { if (cur?.length > 2) out.push(cur); cur = []; add(a[0], a[1]); x = a[0]; y = a[1]; }
    else if (c.command === 'lineTo') { add(a[0], a[1]); x = a[0]; y = a[1]; }
    else if (c.command === 'quadraticCurveTo') { for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; add(u * u * x + 2 * u * t * a[0] + t * t * a[2], u * u * y + 2 * u * t * a[1] + t * t * a[3]); } x = a[2]; y = a[3]; }
    else if (c.command === 'bezierCurveTo') { for (let i = 1; i <= 10; i++) { const t = i / 10, u = 1 - t; add(u * u * u * x + 3 * u * u * t * a[0] + 3 * u * t * t * a[2] + t * t * t * a[4], u * u * u * y + 3 * u * u * t * a[1] + 3 * u * t * t * a[3] + t * t * t * a[5]); } x = a[4]; y = a[5]; }
    else if (c.command === 'closePath') { if (cur?.length > 2) out.push(cur); cur = null; }
  }
  if (cur?.length > 2) out.push(cur);
  return out;
}
const area = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const closed = (r) => { const a = r[0], b = r[r.length - 1]; return a[0] === b[0] && a[1] === b[1] ? r : [...r, a]; };
const open = (r) => { const a = r[0], b = r[r.length - 1]; return a[0] === b[0] && a[1] === b[1] ? r.slice(0, -1) : r; };
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], k = dx * dx + dy * dy; const t = k ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / k)) : 0; return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t); };

// Smooth two-axis noise so a shared crack bends the same way for the shards on both sides.
const nz = (x, y) => { const f = (a, b) => Math.sin(a * 127.1 + b * 311.7) * 43758.5453 % 1; const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, s = u * u * (3 - 2 * u), t = v * v * (3 - 2 * v); const m = (a, b, k) => a + (b - a) * k; return m(m(f(i, j), f(i + 1, j), s), m(f(i, j + 1), f(i + 1, j + 1), s), t); };
const warp = (p) => {
  const a = nz(p[0] * 3.3 + 4, p[1] * 3.3) * 0.075 + nz(p[0] * 11 + 9, p[1] * 11 + 1) * 0.022;
  const b = nz(p[0] * 3.3 + 21, p[1] * 3.3 + 8) * 0.075 + nz(p[0] * 11 + 3, p[1] * 11 + 17) * 0.022;
  return [p[0] + a, p[1] + b];
};

function build(key, cfg) {
  const font = fontkit.openSync(cfg.file);
  const cap = font.capHeight || 700;
  // Both lines share one type size and are centred. The longest line sets the overall width.
  const laid = LINES.map((text) => {
    const run = font.layout(text);
    const glyphs = []; let x = 0;
    run.glyphs.forEach((g, i) => { glyphs.push({ char: text[i], path: g.path, x }); x += run.positions[i].xAdvance; });
    const flat = glyphs.flatMap((g) => flatten(g.path, 1, 1, g.x, 0));
    const xs = flat.flat().map((p) => p[0]);
    const min = Math.min(...xs), max = Math.max(...xs);
    return { glyphs, min, max, text };
  });
  const scale = WIDTH / Math.max(...laid.map((l) => l.max - l.min));
  laid.forEach((l) => { l.scale = scale; });
  const gap = WIDTH * cfg.gap;
  const heights = laid.map((l) => cap * l.scale);
  const total = heights[0] + gap + heights[1];
  const letters = [];
  laid.forEach((l, li) => {
    const base = li === 0 ? total / 2 - heights[0] : -total / 2;
    l.glyphs.forEach((g) => {
      const contours = flatten(g.path, l.scale, l.scale, (g.x - (l.min + l.max) / 2) * l.scale, base);
      letters.push({ char: g.char, line: li, contours });
    });
  });

  // Fracture: a jittered grid of seeds across the block, denser near the middle.
  const R = rng(key.length * 97 + 11);
  const seeds = [];
  const nx = 11, ny = 10;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const u = (i + 0.5 + (R() - 0.5) * 0.92) / nx, v = (j + 0.5 + (R() - 0.5) * 0.92) / ny;
    seeds.push([(u - 0.5) * (WIDTH + 0.5), (v - 0.5) * (total + 0.5)]);
  }
  const box = [-WIDTH, -total, WIDTH, total];
  const vor = Delaunay.from(seeds).voronoi(box);
  const cells = seeds.map((_, i) => {
    const poly = vor.cellPolygon(i); if (!poly) return null;
    const out = [];
    const ring = open(poly);
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length];
      const steps = Math.max(2, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / 0.05));
      for (let s = 0; s < steps; s++) out.push(warp([a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps]));
    }
    return closed(out);
  }).filter(Boolean);

  let shardCount = 0;
  const data = letters.map((L) => {
    const rings = L.contours;
    let shape = null;
    rings.forEach((r) => { const poly = [[closed(r)]]; shape = shape ? pc.xor(shape, poly) : poly; });
    const shards = [], crackSeen = new Set(), cracks = [];
    const onEdge = (p) => rings.some((r) => r.some((a, i) => segDist(p, a, r[(i + 1) % r.length]) < 0.0035));
    cells.forEach((cell) => {
      const parts = pc.intersection(shape, [[cell]]);
      parts.forEach((poly) => {
        const a = Math.abs(area(open(poly[0])));
        if (a < 0.00035) return;
        shards.push({ rings: poly.map((r) => open(r).flatMap((p) => [round(p[0]), round(p[1])])) });
        shardCount++;
        poly.forEach((r) => {
          const pts = open(r);
          pts.forEach((p, i) => {
            const q = pts[(i + 1) % pts.length];
            const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
            if (onEdge(mid)) return;
            const k = [round(mid[0]), round(mid[1])].join();
            if (crackSeen.has(k)) return; crackSeen.add(k);
            cracks.push(round(p[0]), round(p[1]), round(q[0]), round(q[1]));
          });
        });
      });
    });
    return {
      char: L.char, line: L.line,
      contours: rings.map((r) => ({ hole: false, area: area(r), pts: r.flatMap((p) => [round(p[0]), round(p[1])]) })),
      shape: shape.map((poly) => poly.map((r) => open(r).flatMap((p) => [round(p[0]), round(p[1])]))),
      shards, cracks,
    };
  });
  const out = { key, lines: LINES, width: WIDTH, height: round(total), letters: data };
  const file = path.join(here, '../data', `name-${key}.json`);
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(key.padEnd(10), 'letters', data.length, 'shards', shardCount, 'cracks', data.reduce((n, l) => n + l.cracks.length / 4, 0), 'height', round(total), 'kb', Math.round(fs.statSync(file).size / 1024));
}
for (const [k, c] of Object.entries(FONTS)) build(k, c);
