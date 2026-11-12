// Colours of the site. Each palette has a CSS half (css/site.css, under :root[data-palette]) and the values below,
// which the 3D name, the traced outline and the transitions read. ?palette=b (or c, d, peach) previews another one.
// hue turns the stone's warm pigments green. Its rows say how much of the original red, green and blue goes into the
// new red, green and blue, so the clouds keep their shapes and depth and only change colour. tone() then keeps part of
// that colour (the rest goes grey, so the stone reads as jade rather than neon) and thickens the pigment.
const EMERALD = [0, 0, 1, 1, 0, 0, .45, .55, 0], JEWEL = [0, 0, 1, 1, 0, 0, .5, .5, 0], FOREST = [0, .7, .3, 1, 0, 0, .3, .5, .2];
const tone = (m, keep, density) => m.map((v) => (v * keep + (1 - keep) / 3) * density);

export const PALETTES = {
  a: {
    name: 'Emerald', accent: '#3ccf91',
    top: '#050807', mid: '#0e1512', haze: '#173226', low: '#1f6048', pale: '#bff0d6', stone: '#2a9a6e', deep: '#053a2a', shard: '#7fd6ae',
    hue: tone(EMERALD, .7, 1.3), mark: '#bdf3d9', smear: '#2f6b52', line: '#c9f2de',
    trace: { stroke: 'rgba(200,245,222,.8)', tip: 'rgba(236,255,246,1)', glow: 'rgba(60,207,145,.62)', tipGlow: 'rgba(120,230,180,1)' },
  },
  b: {
    name: 'Forest and mint', accent: '#9fe3bb',
    top: '#060806', mid: '#111611', haze: '#1f2f21', low: '#2e5a36', pale: '#e3f2d6', stone: '#3f8a55', deep: '#0f3a1c', shard: '#93cc9f',
    hue: tone(FOREST, .65, 1.4), mark: '#d6f5e3', smear: '#3b5e42', line: '#d6f2dd',
    trace: { stroke: 'rgba(214,245,222,.8)', tip: 'rgba(244,255,246,1)', glow: 'rgba(76,175,125,.62)', tipGlow: 'rgba(150,225,180,1)' },
  },
  c: {
    name: 'Jewel and gold', accent: '#2fcf8e',
    top: '#080706', mid: '#141310', haze: '#202b20', low: '#1d5c44', pale: '#f3e2b8', stone: '#1f8f66', deep: '#04392a', shard: '#c7c590',
    hue: tone(JEWEL, .7, 1.35), mark: '#f2dfae', smear: '#4a6a4a', line: '#f2e3bd',
    trace: { stroke: 'rgba(244,228,186,.8)', tip: 'rgba(255,250,236,1)', glow: 'rgba(47,207,142,.62)', tipGlow: 'rgba(240,215,150,1)' },
  },
  d: {
    name: 'Sage', accent: '#a7cfa9',
    top: '#070807', mid: '#121512', haze: '#222a22', low: '#4a5e48', pale: '#e2e8d6', stone: '#647f62', deep: '#22321f', shard: '#a8bea2',
    hue: tone(FOREST, .45, 1.3), mark: '#dbe9d8', smear: '#55644f', line: '#dde8d8',
    trace: { stroke: 'rgba(222,234,214,.8)', tip: 'rgba(248,252,244,1)', glow: 'rgba(127,168,134,.62)', tipGlow: 'rgba(180,210,180,1)' },
  },
  // The colours before the change to green, kept for comparison.
  peach: {
    name: 'Peach', accent: '#ffb98a',
    top: '#090706', mid: '#181310', haze: '#32271e', low: '#7a4a24', pale: '#fccab2', stone: '#b2663a', deep: '#5a0f06', shard: '#d99a78',
    hue: [1, 0, 0, 0, 1, 0, 0, 0, 1], mark: '#ffd9b0', smear: '#8a5a36', line: '#ffe0c4',
    trace: { stroke: 'rgba(255,222,194,.8)', tip: 'rgba(255,246,234,1)', glow: 'rgba(255,164,104,.62)', tipGlow: 'rgba(255,190,130,1)' },
  },
};
export const DEFAULT_PALETTE = 'a';

const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('palette');
export const PALETTE_KEY = asked && Object.hasOwn(PALETTES, asked) ? asked : DEFAULT_PALETTE;
export const PALETTE = PALETTES[PALETTE_KEY];
if (typeof document !== 'undefined') document.documentElement.dataset.palette = PALETTE_KEY;
export const FILM = { bloom: 0.32, threshold: 1 };
