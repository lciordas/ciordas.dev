// Draws EvoGrad's one slide: the networks it evolved for XOR, sin(x) and a damped sine, side by side on white. Laid out
// on a 1600×900 grid and drawn at twice that, for sharp text on retina screens. Run from the repo root:
// node tools/build-evograd.mjs
// Sources: the Graphviz renders of the three evolved genomes in ~/Downloads/evograd_networks/*_script.svg (top-down
// layout, edges coloured by the weight's sign and labelled with its value). The drawing is kept as is; colours, line
// widths and text are restyled, and the text is set as paths in the site's font so nothing needs installing.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp'), opentype = require('opentype.js');
const FONTS = path.join(here, '../toolkit/node_modules/@fontsource');
const SRC = path.join(os.homedir(), 'Downloads/evograd_networks');
const OUT = path.join(here, '../media/projects/hybrid-networks');
const font = (pkg, file) => { const b = fs.readFileSync(path.join(FONTS, pkg, 'files', file)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const REG = font('hanken-grotesk', 'hanken-grotesk-latin-400-normal.woff'), MED = font('hanken-grotesk', 'hanken-grotesk-latin-500-normal.woff'), SEMI = font('hanken-grotesk', 'hanken-grotesk-latin-600-normal.woff');

// Text as SVG paths: glyph by glyph with kerning. Anchor 'middle' centres the run on x.
const n = (v) => (Math.round(v * 100) / 100).toString();
const pathData = (p) => p.commands.map((c) => c.type === 'Z' ? 'Z' : c.type === 'Q' ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}` : c.type === 'C' ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}` : `${c.type}${n(c.x)} ${n(c.y)}`).join('');
const advance = (f, s, size) => { let w = 0, prev = null; for (const ch of s) { const g = f.charToGlyph(ch); if (prev) w += f.getKerningValue(prev, g) * size / f.unitsPerEm; w += g.advanceWidth * size / f.unitsPerEm; prev = g; } return w; };
function text(f, s, size, x, y, fill, anchor = 'start') {
  let cx = anchor === 'middle' ? x - advance(f, s, size) / 2 : x, prev = null, d = '';
  for (const ch of s) { const g = f.charToGlyph(ch); if (prev) cx += f.getKerningValue(prev, g) * size / f.unitsPerEm; d += pathData(g.getPath(cx, y, size)); cx += g.advanceWidth * size / f.unitsPerEm; prev = g; }
  return `<path fill="${fill}" d="${d}"/>`;
}
// A variable name with an optional subscript digit, e.g. x₁, centred on x.
function symbol(name, sub, size, x, y, fill) {
  const w = advance(MED, name, size) + (sub ? advance(MED, sub, size * 0.62) + size * 0.04 : 0), x0 = x - w / 2;
  return text(MED, name, size, x0, y, fill) + (sub ? text(MED, sub, size * 0.62, x0 + advance(MED, name, size) + size * 0.04, y + size * 0.2, fill) : '');
}

const INK = '#1d1b19', MUTED = '#6f6a63', LABEL = '#3d3934';
const POS = '#2f6db8', NEG = '#d0533a';
const NODE = { green: '#e4dfd6', lightblue: '#cfe1f2', red: '#f6d5bf' };

// One Graphviz drawing, restyled: returns its inner group (with Graphviz's own transform, which maps the drawing's
// points onto the SVG's pt units), its size in pt, and a count of hidden nodes and connections.
function network(file) {
  const svg = fs.readFileSync(path.join(SRC, file), 'utf8');
  const [, w, h] = svg.match(/<svg width="([\d.]+)pt" height="([\d.]+)pt"/);
  let g = svg.slice(svg.indexOf('<g id="graph0"'), svg.lastIndexOf('</svg>'));
  g = g.replace(/<polygon fill="white" stroke="none"[^>]*\/>/, '').replace(/<title>[^<]*<\/title>/g, '').replace(/<!--[^>]*-->/g, '');
  let hidden = 0, edges = 0, inputs = 0;
  const numInputs = (svg.match(/<ellipse fill="green"/g) || []).length;
  // Nodes: a soft fill, no outline, and a symbol in place of Graphviz's ids: inputs x (or x₁, x₂), the output y,
  // hidden nodes left blank.
  g = g.replace(/<g id="node\d+" class="node">([\s\S]*?)<\/g>/g, (_, body) => {
    const [, fill, cx, cy] = body.match(/<ellipse fill="(\w+)" stroke="\w+" cx="([-\d.]+)" cy="([-\d.]+)"/);
    const e = body.match(/<ellipse[^>]*\/>/)[0].replace(/fill="\w+" stroke="\w+"/, `fill="${NODE[fill]}" stroke="none"`);
    const x = +cx, y = +cy + 15 * 0.36;
    let label = '';
    if (fill === 'green') { inputs++; label = symbol('x', numInputs > 1 ? String(inputs) : '', 15, x, y, INK); }
    else if (fill === 'red') label = symbol('y', '', 15, x, y, INK);
    else hidden++;
    return `<g>${e}${label}</g>`;
  });
  // Edges: blue/red become the site's blue and red, and line width grows with |w|. Graphviz centres each weight label
// just right of its edge; the site's font runs wider than Times, so the label is reset from the same left edge
// (Times: digits ½ em, the point ¼, the hyphen ⅓) rather than the same centre, and grows away from the line.
  g = g.replace(/<g id="edge\d+" class="edge">([\s\S]*?)<\/g>/g, (_, body) => {
    edges++;
    const t = body.match(/<text[^>]*x="([-\d.]+)" y="([-\d.]+)"[^>]*>([^<]*)<\/text>/);
    const wv = parseFloat(t[3].replace('&#45;', '-')), col = wv >= 0 ? POS : NEG;
    const sw = (1.2 + 3.2 * Math.min(Math.abs(wv), 30) / 30).toFixed(2);
    let b = body.replace(/<text[\s\S]*?<\/text>/g, '')
      .replace(/stroke="(blue|red)"/g, `stroke="${col}"`).replace(/fill="(blue|red)"/g, `fill="${col}"`)
      .replace(/<path fill="none"([^>]*)stroke-width="[\d.]+"/, `<path fill="none"$1stroke-width="${sw}" stroke-linecap="round"`)
      .replace(/<polygon([^>]*)stroke-width="[\d.]+"/, '<polygon$1stroke-width="1" stroke-linejoin="round"');
    const label = `${wv < 0 ? '−' : ''}${Math.abs(wv).toFixed(2)}`;
    const timesWidth = [...t[3].replace('&#45;', '-')].reduce((a, c) => a + 14 * (c === '.' ? 0.25 : c === '-' ? 0.333 : 0.5), 0);
    return `<g>${b}${text(REG, label, 11, +t[1] - timesWidth / 2 + 2.5, +t[2] - 1, LABEL)}</g>`;
  });
  return { g, w: +w, h: +h, hidden, edges };
}

const nets = [
  { file: 'xor_script.svg', title: 'XOR' },
  { file: 'sine_regression_script.svg', title: 'sin(x)' },
  { file: 'damped_sine_script.svg', title: 'Damped sine' },
].map((d) => ({ ...d, ...network(d.file) }));

// Layout: one scale for all three, so nodes and labels match in size; the tallest fills the height left under the
// titles, and the columns share the width evenly.
const W = 1600, H = 900, K = 2, TOP = 150, BOTTOM = 48;
const s = (H - TOP - BOTTOM) / Math.max(...nets.map((d) => d.h));
const gap = (W - nets.reduce((a, d) => a + d.w * s, 0)) / (nets.length + 1);
let x = gap, body = `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
for (const d of nets) {
  const cx = x + d.w * s / 2, top = TOP + (H - TOP - BOTTOM - d.h * s) / 2;
  body += text(SEMI, d.title, 34, cx, 74, INK, 'middle');
  body += text(REG, `${d.hidden} hidden node${d.hidden === 1 ? '' : 's'} · ${d.edges} connections`, 19, cx, 106, MUTED, 'middle');
  body += `<g transform="translate(${n(x)} ${n(top)}) scale(${s})">${d.g}</g>`;
  x += d.w * s + gap;
}
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * K}" height="${H * K}" viewBox="0 0 ${W} ${H}">${body}</svg>`);
fs.mkdirSync(OUT, { recursive: true });
await sharp(svg).webp({ quality: 90, effort: 6, smartSubsample: true }).toFile(path.join(OUT, 'networks.webp'));
console.log('networks.webp', nets.map((d) => `${d.title}: ${d.hidden} hidden, ${d.edges} edges`).join('; '), `scale ${s.toFixed(3)}`);
