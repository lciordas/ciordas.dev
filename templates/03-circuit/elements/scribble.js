import { gsap, reduced, inView } from './_core.js';

// Hand-drawn stroke that draws itself. Presets are generated, so swap in your own `d` for a real signature.
function catmull(points, tension = 0.5) {
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) * tension / 3, p1[1] + (p2[1] - p0[1]) * tension / 3];
    const c2 = [p2[0] - (p3[0] - p1[0]) * tension / 3, p2[1] - (p3[1] - p1[1]) * tension / 3];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}
// Monoline letters in unit space. x runs right, y runs up from the baseline.
const GLYPHS = {
  h: { w: 0.62, p: [[0, 0.1], [0.2, 0.7], [0.3, 1.25], [0.2, 1.42], [0.07, 1.1], [0, 0.45], [0, 0], [0.12, 0.42], [0.32, 0.58], [0.42, 0.42], [0.4, 0.08], [0.62, 0.1]] },
  e: { w: 0.5, p: [[0, 0.1], [0.3, 0.32], [0.38, 0.5], [0.24, 0.6], [0.06, 0.4], [0.1, 0.1], [0.3, 0.02], [0.5, 0.14]] },
  l: { w: 0.42, p: [[0, 0.14], [0.22, 0.72], [0.34, 1.28], [0.22, 1.46], [0.08, 1.12], [0.06, 0.4], [0.16, 0.04], [0.42, 0.14]] },
  o: { w: 0.62, p: [[0, 0.14], [0.14, 0.5], [0.34, 0.6], [0.46, 0.38], [0.36, 0.08], [0.16, 0.06], [0.14, 0.32], [0.34, 0.5], [0.62, 0.42]] },
};
function cursive(word, { x = 40, y = 500, size = 240, slant = 0.42, rise = 0.28, tail = 0 } = {}) {
  const pts = []; let cx = 0;
  for (const c of word) {
    const g = GLYPHS[c]; if (!g) continue;
    g.p.forEach(([gx, gy]) => {
      const ux = cx + gx; const X = x + (ux + gy * slant) * size; const Y = y - (gy + ux * rise) * size;
      pts.push([Math.round(X), Math.round(Y)]);
    });
    cx += g.w;
  }
  if (tail) { const last = pts[pts.length - 1]; pts.push([last[0] + tail * 0.7, last[1] - tail * 0.5], [last[0] + tail, last[1] - tail * 0.95]); }
  return catmull(pts, 1);
}
export const SCRIBBLES = {
  signature: {
    viewBox: '0 0 800 570', width: 7.5,
    d: catmull([[70, 395], [230, 315], [430, 205], [620, 112], [735, 118], [690, 205], [480, 312], [240, 400], [96, 425], [190, 392]], 1)
      + catmull([[330, 520], [392, 360], [430, 190], [400, 330], [468, 248], [455, 345], [530, 245], [522, 345], [610, 270]], 0.8)
      + catmull([[205, 505], [420, 410], [610, 335], [790, 290]], 1) + catmull([[690, 205], [742, 240], [708, 268], [778, 262]], 1),
  },
  word: { viewBox: '0 0 1060 660', width: 24, d: cursive('hello', { x: 30, y: 575, size: 300, slant: 0.44, rise: 0.24, tail: 90 }) },
  small: { viewBox: '0 0 213 162', width: 9, d: cursive('hello', { x: 10, y: 135, size: 72, slant: 0.42, rise: 0.2, tail: 14 }) },
  tick: { viewBox: '0 0 76 32', width: 2, d: catmull([[2, 22], [16, 10], [26, 22], [36, 8], [42, 20], [52, 10], [74, 16]], 1) },
};

// mountScribble(el, { preset | d + viewBox, width, mode: 'view' | 'scrub', start, end, trigger, duration, delay })
export function mountScribble(el, { preset = 'signature', d, viewBox, width, mode = 'view', start = 'top 80%', end = 'top 20%', trigger, duration = 1.4, delay = 0 } = {}) {
  const P = SCRIBBLES[preset] || {};
  el.innerHTML = `<svg viewBox="${viewBox || P.viewBox}" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="${width || P.width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" preserveAspectRatio="xMidYMid meet" style="overflow:visible"><path pathLength="1" d="${d || P.d}"/></svg>`;
  const path = el.querySelector('path');
  const setP = (v) => { path.style.strokeDashoffset = 1 - v; path.style.opacity = v > 0.001 ? 1 : 0; };
  path.style.strokeDasharray = '1 1';
  const state = { v: 0 };
  const render = () => setP(state.v);
  if (reduced()) { state.v = 1; render(); return { progress: () => {} }; }
  render();
  if (mode === 'scrub') gsap.to(state, { v: 1, ease: 'none', onUpdate: render, scrollTrigger: { trigger: trigger || el, start, end, scrub: 0.3 } });
  else if (mode === 'view') inView(trigger || el, () => gsap.to(state, { v: 1, duration, delay, ease: 'power1.inOut', onUpdate: render }));
  return { progress: (v) => { state.v = v; render(); }, play: () => gsap.to(state, { v: 1, duration, delay, ease: 'power1.inOut', onUpdate: render }) };
}
