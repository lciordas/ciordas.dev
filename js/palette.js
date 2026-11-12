// Colours of the site. Each palette has a CSS half (css/site.css, under :root[data-palette]) and the values below,
// which the 3D name, the traced outline and the transitions read. ?palette=e (or b, c, d, f, g, peach, or a name such
// as crimson) previews another one across the whole site, baked pictures and videos included (see paletteContent).
// hue turns the stone's warm pigments green. Its rows say how much of the original red, green and blue goes into the
// new red, green and blue, so the clouds keep their shapes and depth and only change colour. tone() then keeps part of
// that colour (the rest goes grey, so the stone reads as jade rather than neon) and thickens the pigment.
const EMERALD = [0, 0, 1, 1, 0, 0, .45, .55, 0], JEWEL = [0, 0, 1, 1, 0, 0, .5, .5, 0], FOREST = [0, .7, .3, 1, 0, 0, .3, .5, .2];
// Crimson lets red through, holds back green hardest and blue a little less, so the reds lean cool and wine-dark.
// Ember keeps the original warm pigments but takes out more blue and a little less green, for a hotter, purer orange.
// Bottle is emerald with more of the blue held back, for a deeper, less minty green.
const BOTTLE = [0, 0, 1, 1, 0, 0, .38, .47, .15];
const CRIMSON = [1, 0, 0, 0, .3, 1.1, 0, .55, .6], EMBER = [1, 0, 0, 0, .95, 0, 0, 0, 1.6];
const tone = (m, keep, density) => m.map((v) => (v * keep + (1 - keep) / 3) * density);

export const PALETTES = {
  a: {
    name: 'Emerald', accent: '#3ccf91', onWhite: '#14845a',
    top: '#050807', mid: '#0e1512', haze: '#173226', low: '#1f6048', pale: '#bff0d6', stone: '#2a9a6e', deep: '#053a2a', shard: '#7fd6ae',
    hue: tone(EMERALD, .7, 1.3), mark: '#bdf3d9', smear: '#2f6b52', line: '#c9f2de',
    trace: { stroke: 'rgba(200,245,222,.8)', tip: 'rgba(236,255,246,1)', glow: 'rgba(60,207,145,.62)', tipGlow: 'rgba(120,230,180,1)' },
  },
  b: {
    name: 'Forest and mint', accent: '#9fe3bb', onWhite: '#2f7a4e',
    top: '#060806', mid: '#111611', haze: '#1f2f21', low: '#2e5a36', pale: '#e3f2d6', stone: '#3f8a55', deep: '#0f3a1c', shard: '#93cc9f',
    hue: tone(FOREST, .65, 1.4), mark: '#d6f5e3', smear: '#3b5e42', line: '#d6f2dd',
    trace: { stroke: 'rgba(214,245,222,.8)', tip: 'rgba(244,255,246,1)', glow: 'rgba(76,175,125,.62)', tipGlow: 'rgba(150,225,180,1)' },
  },
  c: {
    name: 'Jewel and gold', accent: '#2fcf8e', onWhite: '#12805a',
    top: '#080706', mid: '#141310', haze: '#202b20', low: '#1d5c44', pale: '#f3e2b8', stone: '#1f8f66', deep: '#04392a', shard: '#c7c590',
    hue: tone(JEWEL, .7, 1.35), mark: '#f2dfae', smear: '#4a6a4a', line: '#f2e3bd',
    trace: { stroke: 'rgba(244,228,186,.8)', tip: 'rgba(255,250,236,1)', glow: 'rgba(47,207,142,.62)', tipGlow: 'rgba(240,215,150,1)' },
  },
  d: {
    name: 'Sage', accent: '#a7cfa9', onWhite: '#4f6e52',
    top: '#070807', mid: '#121512', haze: '#222a22', low: '#4a5e48', pale: '#e2e8d6', stone: '#647f62', deep: '#22321f', shard: '#a8bea2',
    hue: tone(FOREST, .45, 1.3), mark: '#dbe9d8', smear: '#55644f', line: '#dde8d8',
    trace: { stroke: 'rgba(222,234,214,.8)', tip: 'rgba(248,252,244,1)', glow: 'rgba(127,168,134,.62)', tipGlow: 'rgba(180,210,180,1)' },
  },
  e: {
    name: 'Crimson', accent: '#e8475f', onWhite: '#b01e3c',
    top: '#080505', mid: '#160c0e', haze: '#321419', low: '#74192c', pale: '#eeaaa6', stone: '#a8213e', deep: '#4c0514', shard: '#dc7f90',
    hue: tone(CRIMSON, .92, 1.75), mark: '#f9cfd7', smear: '#7c2a3b', line: '#f7d5dc',
    trace: { stroke: 'rgba(249,212,220,.8)', tip: 'rgba(255,241,244,1)', glow: 'rgba(214,40,70,.62)', tipGlow: 'rgba(242,108,132,1)' },
  },
  f: {
    name: 'Bright orange', accent: '#ff8f3f', onWhite: '#c2500c',
    top: '#0a0705', mid: '#1b1209', haze: '#3c230e', low: '#8f4612', pale: '#ffc690', stone: '#d4621c', deep: '#6c1f02', shard: '#f4a466',
    hue: tone(EMBER, .95, 1.15), mark: '#ffd8aa', smear: '#9c5422', line: '#ffe2c2',
    trace: { stroke: 'rgba(255,224,190,.8)', tip: 'rgba(255,246,234,1)', glow: 'rgba(255,128,40,.62)', tipGlow: 'rgba(255,170,90,1)' },
  },
  g: {
    name: 'Bottle green', accent: '#2f9e6c', onWhite: '#0f6a45',
    top: '#030504', mid: '#09100c', haze: '#0f2419', low: '#144531', pale: '#4f8a6a', stone: '#1b6c4a', deep: '#022a1c', shard: '#5aa682',
    hue: tone(BOTTLE, .78, 3.6), mark: '#a6dcbf', smear: '#214f3b', line: '#b0dfc6',
    trace: { stroke: 'rgba(176,223,198,.8)', tip: 'rgba(226,248,236,1)', glow: 'rgba(31,138,91,.62)', tipGlow: 'rgba(90,190,140,1)' },
  },
  // The colours before the change to green, kept for comparison.
  peach: {
    name: 'Peach', accent: '#ffb98a', onWhite: '#b4561f',
    top: '#090706', mid: '#181310', haze: '#32271e', low: '#7a4a24', pale: '#fccab2', stone: '#b2663a', deep: '#5a0f06', shard: '#d99a78',
    hue: [1, 0, 0, 0, 1, 0, 0, 0, 1], mark: '#ffd9b0', smear: '#8a5a36', line: '#ffe0c4',
    trace: { stroke: 'rgba(255,222,194,.8)', tip: 'rgba(255,246,234,1)', glow: 'rgba(255,164,104,.62)', tipGlow: 'rgba(255,190,130,1)' },
  },
};
export const DEFAULT_PALETTE = 'a';

// ?palette=e picks a palette by its letter or its name (crimson, orange, bottle...), in any case. The misspellings
// pallete and pallette work too, and so does a ?palette= typed after the #.
const ALIASES = { emerald: 'a', jade: 'a', green: 'a', mint: 'b', forest: 'g', jewel: 'c', gold: 'c', sage: 'd', crimson: 'e', red: 'e', ruby: 'e', orange: 'f', ember: 'f', bright: 'f', bottle: 'g', dark: 'g', darkgreen: 'g', deep: 'g', old: 'peach' };
function askedPalette() {
  if (typeof location === 'undefined') return null;
  const read = (q) => { const p = new URLSearchParams(q); for (const k of ['palette', 'pallete', 'pallette', 'palete', 'colour', 'color', 'theme']) if (p.get(k)) return p.get(k); return null; };
  let v = read(location.search);
  const h = location.hash.match(/[?&](?:palette|pallete|pallette|palete|colour|color|theme)=([^&]*)/i);
  if (!v && h) {
    v = decodeURIComponent(h[1]);
    // Move it out of the #, where it would be taken for a project's name.
    const q = new URLSearchParams(location.search); q.set('palette', v);
    try { const rest = location.hash.slice(0, h.index); history.replaceState(history.state, '', `${location.pathname}?${q}${rest.length > 1 ? rest : ''}`); } catch {}
  }
  if (!v) return null;
  const k = v.trim().toLowerCase().replace(/[^a-z]/g, '');
  const name = Object.keys(PALETTES).find((p) => PALETTES[p].name.toLowerCase().replace(/[^a-z]/g, '') === k);
  return Object.hasOwn(PALETTES, k) ? k : ALIASES[k] || name || ALIASES[k.split(/(?=green)/)[0]] || null;
}
export const PALETTE_KEY = askedPalette() || DEFAULT_PALETTE;
export const PALETTE = PALETTES[PALETTE_KEY];
if (typeof document !== 'undefined') document.documentElement.dataset.palette = PALETTE_KEY;
export const FILM = { bloom: 0.32, threshold: 1 };

// Pictures and videos with the highlight colour baked in. Videos have a copy per palette next to the original
// (match.mp4 has match-e.mp4 and so on, drawn by tools/build-tennis.py and tools/build-cartpole.mjs with PALETTE=e);
// the NeurIPS slides are SVG, so their colours are swapped as they load. Palettes without a baked copy show the default.
export const BAKED = {
  'media/projects/tennis-simulation/match.mp4': ['e', 'f', 'g', 'peach'],
  'media/projects/hybrid-networks/cartpole.mp4': ['e', 'f', 'g', 'peach'],
  'media/thumbs/world-models.webp': ['b', 'c', 'd', 'e', 'f', 'g', 'peach'],
};
const RECOLOR = /^media\/projects\/world-models\/[a-z]+\.svg$/;
export const bakedSrc = (src, key = PALETTE_KEY) => (BAKED[src]?.includes(key) ? src.replace(/(\.\w+)$/, `-${key}$1`) : src);
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
// An SVG drawn in the default palette, redrawn in this one.
export function recolorSvg(text, from = PALETTES[DEFAULT_PALETTE], to = PALETTE) {
  return text.split(from.accent).join(to.accent).split(hexRgb(from.accent)).join(hexRgb(to.accent)).split(from.onWhite).join(to.onWhite);
}
// The content file with each baked picture and video swapped for this palette's copy. Thumbnails are named by id.
export async function paletteContent(content) {
  if (PALETTE_KEY === DEFAULT_PALETTE || !content) return content;
  const svgs = new Map();
  const walk = (o) => {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object') walk(v);
      else if (typeof v === 'string' && RECOLOR.test(v)) svgs.set(v, null);
      else if (typeof v === 'string' && BAKED[v]) o[k] = bakedSrc(v);
      else if (k === 'thumb' && typeof v === 'string' && BAKED[`media/thumbs/${v}.webp`]?.includes(PALETTE_KEY)) o[k] = `${v}-${PALETTE_KEY}`;
    }
  };
  walk(content);
  await Promise.all([...svgs.keys()].map(async (src) => {
    try {
      const text = await (await fetch(src)).text();
      svgs.set(src, URL.createObjectURL(new Blob([recolorSvg(text)], { type: 'image/svg+xml' })));
    } catch { svgs.set(src, src); }
  }));
  const put = (o) => { for (const [k, v] of Object.entries(o)) { if (v && typeof v === 'object') put(v); else if (svgs.has(v)) o[k] = svgs.get(v); } };
  put(content);
  return content;
}
// The tab's icon in this palette's colour.
if (typeof document !== 'undefined' && PALETTE_KEY !== DEFAULT_PALETTE) {
  fetch('favicon.svg').then((r) => r.text()).then((t) => {
    document.querySelectorAll('link[rel="icon"]').forEach((l) => l.remove());
    const l = document.createElement('link'); l.rel = 'icon'; l.type = 'image/svg+xml';
    l.href = URL.createObjectURL(new Blob([recolorSvg(t)], { type: 'image/svg+xml' }));
    document.head.append(l);
  }).catch(() => {});
}
