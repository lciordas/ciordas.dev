// The site's icon: an "LC" monogram in the name's typeface, cracked like the intro's letters, on a dark tile. Writes
// favicon.svg, favicon.ico (16, 32 and 48), apple-touch-icon.png, icon-192.png, icon-512.png and site.webmanifest
// to the repo root. Run from the repo root: node tools/build-icon.mjs
// With --preview <dir>, it instead draws every variant at 16, 32 and 180 px into that folder, for choosing between them.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTES, DEFAULT_PALETTE } from '../js/palette.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp'), opentype = require('opentype.js');
const ROOT = path.join(here, '..'), FONTS = path.join(here, '../toolkit/node_modules/@fontsource');
const font = (pkg, file) => { const b = fs.readFileSync(path.join(FONTS, pkg, 'files', file)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const BLACK = font('barlow-condensed', 'barlow-condensed-latin-900-normal.woff');
// The letters take the site palette's highlight colour.
const INK = '#f4efe8', ACCENT = PALETTES[process.env.PALETTE || DEFAULT_PALETTE].accent, BG = '#050404';

// The library's own path writer rounds some numbers to NaN, so the path is written out here.
const n = (v) => (Math.round(v * 100) / 100).toString();
const pathData = (p) => p.commands.map((c) => c.type === 'Z' ? 'Z' : c.type === 'Q' ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}` : c.type === 'C' ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}` : `${c.type}${n(c.x)} ${n(c.y)}`).join('');

// "LC" as one path, its capitals `cap` tall and centred on (cx, cy), in a 512 box.
function monogram(cap, cx = 256, cy = 256, text = 'LC', ls = 0.02) {
  const size = cap / (BLACK.tables.os2.sCapHeight / BLACK.unitsPerEm);
  const p = new opentype.Path(); let x = 0, prev = null;
  for (const ch of text) {
    const g = BLACK.charToGlyph(ch);
    if (prev) x += BLACK.getKerningValue(prev, g) * size / BLACK.unitsPerEm + ls * size;
    p.extend(g.getPath(x, 0, size)); x += g.advanceWidth * size / BLACK.unitsPerEm; prev = g;
  }
  const b = p.getBoundingBox(), dx = cx - (b.x1 + b.x2) / 2, dy = cy - (b.y1 + b.y2) / 2;
  for (const c of p.commands) for (const k of ['x', 'y', 'x1', 'y1', 'x2', 'y2']) if (c[k] !== undefined) c[k] += k[0] === 'x' ? dx : dy;
  return pathData(p);
}

// A jagged fissure from the top right down to the bottom left, through both letters, in the 512 box.
const CRACKS = {
  jag: [[420, 60], [338, 196], [292, 236], [258, 300], [196, 346], [92, 452]],
  slice: [[452, 60], [60, 452]],
  kink: [[440, 72], [300, 232], [244, 252], [72, 440]],
};
const crackPath = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('');
// The side of the fissure above and to the left, for shifting one piece of the letters off the other.
const upperSide = (pts) => `${crackPath(pts)}L-10 ${pts.at(-1)[1]}L-10 -10L522 -10L522 ${pts[0][1]}Z`;

// One drawing of the icon, in a 512 box. `tile` is 'round' for a rounded square on clear, 'full' for edge to edge.
function icon({ ink = INK, cap = 300, crack = 'gap', shape = 'jag', tile = 'round', width = 20, shift = 7, ls = 0.06 }) {
  const glyphs = monogram(cap, 256, 256, 'LC', ls), pts = CRACKS[shape], line = crackPath(pts), upper = upperSide(pts);
  const bg = tile === 'round'
    ? `<rect width="512" height="512" rx="112" fill="url(#bg)"/><rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="${INK}" stroke-opacity=".09" stroke-width="12"/>`
    : '<rect width="512" height="512" fill="url(#bg)"/>';
  const defs = `<defs><radialGradient id="bg" cx=".5" cy=".28" r=".85"><stop offset="0" stop-color="#151b18"/><stop offset=".6" stop-color="#0b0e0d"/><stop offset="1" stop-color="#060807"/></radialGradient>`
    + `<clipPath id="up"><path d="${upper}"/></clipPath>`
    + `<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter></defs>`;
  let body;
  if (crack === 'none') body = `<path fill="${ink}" d="${glyphs}"/>`;
  else {
    // The upper piece sits a little up and to the right of the lower one, as if the letters had just split.
    const pieces = `<g clip-path="url(#up)"><path fill="${ink}" transform="translate(${shift} ${-shift})" d="${glyphs}"/></g>`
      + `<path fill="${ink}" d="${glyphs}" clip-path="url(#lowside)"/>`;
    // The seam is kept to the letters, so it reads as a break in them rather than a line across the tile.
    const seam = crack === 'glow'
      ? `<g clip-path="url(#letters)"><path d="${line}" fill="none" stroke="${ACCENT}" stroke-width="${width * 2.2}" stroke-linejoin="round" filter="url(#glow)" opacity=".9"/>`
        + `<path d="${line}" fill="none" stroke="#fff4e6" stroke-width="${width * 0.55}" stroke-linejoin="round"/></g>`
      : `<path d="${line}" fill="none" stroke="${crack === 'hot' ? ACCENT : '#0b0908'}" stroke-width="${width}" stroke-linejoin="round" clip-path="url(#letters)"/>`;
    body = pieces + seam;
  }
  // The lower side is everything below the fissure: the box minus the upper side.
  const extra = `<clipPath id="lowside"><path clip-rule="evenodd" d="M-10 -10H522V522H-10Z${upper}"/></clipPath><clipPath id="letters"><path d="${glyphs}"/><path transform="translate(${shift} ${-shift})" d="${glyphs}"/></clipPath>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs.replace('</defs>', extra + '</defs>')}${bg}${body}</svg>`;
}

const png = (svg, px) => sharp(Buffer.from(svg), { density: Math.ceil(72 * px / 512) * 2 }).resize(px, px).png().toBuffer();

// An ICO holding PNGs, which every browser that still asks for favicon.ico reads.
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ px, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(px >= 256 ? 0 : px, e); head.writeUInt8(px >= 256 ? 0 : px, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12); offset += data.length;
  });
  return Buffer.concat([head, ...images.map((i) => i.data)]);
}

// The one in use, and the others it was picked over.
const VARIANTS = {
  cracked: { ink: ACCENT, crack: 'gap', shape: 'kink', width: 12, shift: 6 },
  solid: { ink: ACCENT, crack: 'none' },
  ember: { ink: INK, crack: 'glow', shape: 'kink' },
  seam: { ink: INK, crack: 'hot', shape: 'kink', width: 12, shift: 6 },
  slice: { ink: INK, crack: 'gap', shape: 'slice', width: 26, shift: 9 },
};
const CHOSEN = 'cracked';

const args = process.argv.slice(2);
if (args[0] === '--preview') {
  const dir = path.resolve(args[1] || '.'); fs.mkdirSync(dir, { recursive: true });
  for (const [name, v] of Object.entries(VARIANTS)) {
    const svg = icon(v); fs.writeFileSync(path.join(dir, `${name}.svg`), svg);
    // Each size drawn small, then blown up with hard pixels so it can be judged; plus the real sizes side by side.
    const tiles = [];
    for (const px of [16, 32]) tiles.push(await sharp(await png(svg, px)).resize(180, 180, { kernel: 'nearest' }).png().toBuffer());
    tiles.push(await png(svg, 180));
    const sheet = sharp({ create: { width: 3 * 180 + 4 * 20 + 100, height: 220, channels: 4, background: '#2a2a2a' } });
    const small = [await png(svg, 16), await png(svg, 32), await png(svg, 48)];
    await sheet.composite([
      ...tiles.map((t, i) => ({ input: t, left: 20 + i * 200, top: 20 })),
      { input: small[0], left: 620, top: 20 }, { input: small[1], left: 620, top: 50 }, { input: small[2], left: 620, top: 100 },
    ]).png().toFile(path.join(dir, `${name}.png`));
  }
  console.log('previews in', dir);
} else {
  const v = VARIANTS[CHOSEN];
  // The full squares get smaller letters: phones cut their own corners off, and Android may crop to a circle that
  // must still hold them (the middle 80%).
  const tab = icon(v), full = icon({ ...v, tile: 'full', cap: 228 });
  fs.writeFileSync(path.join(ROOT, 'favicon.svg'), tab + '\n');
  // At 16 and 32 pixels the crack is only a smudge, so the ICO's two smallest sizes leave it out.
  const plain = icon({ ...v, crack: 'none' });
  fs.writeFileSync(path.join(ROOT, 'favicon.ico'), ico(await Promise.all([16, 32, 48].map(async (px) => ({ px, data: await png(px < 48 ? plain : tab, px) })))));
  // Phones round the corners themselves and want no see-through parts, so these fill the square.
  await sharp(await png(full, 180)).flatten({ background: BG }).toFile(path.join(ROOT, 'apple-touch-icon.png'));
  for (const px of [192, 512]) await sharp(await png(full, px)).flatten({ background: BG }).toFile(path.join(ROOT, `icon-${px}.png`));
  const manifest = {
    name: 'Lucas Ciordas', short_name: 'Ciordas', start_url: '/', display: 'standalone',
    background_color: BG, theme_color: BG,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  fs.writeFileSync(path.join(ROOT, 'site.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('wrote favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, site.webmanifest');
}
