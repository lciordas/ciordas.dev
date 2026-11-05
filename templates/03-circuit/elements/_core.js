// Shared helpers for the elements. Expects gsap, ScrollTrigger, SplitText, and Lenis on window.
export const { gsap, ScrollTrigger, SplitText } = window;
gsap.registerPlugin(ScrollTrigger, SplitText);

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouch = () => matchMedia('(hover: none)').matches;
export const isPhone = () => matchMedia('(max-width: 991px)').matches;
export const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const hexRGB = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
export const mixRGB = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

// Cubic bezier as a gsap ease. The default easing across the template.
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  return (p) => {
    if (p <= 0) return 0; if (p >= 1) return 1;
    let t = p;
    for (let i = 0; i < 8; i++) { const e = X(t) - p; const d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(e) < 1e-4 || !d) break; t -= e / d; }
    return Y(clamp(t));
  };
}
export const easeDefault = bezier(0.65, 0.05, 0, 1);

export function inView(el, cb, { margin = '0px 0px -8% 0px', once = true } = {}) {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { cb(e); if (once) io.disconnect(); }
  }), { rootMargin: margin });
  io.observe(el);
  return () => io.disconnect();
}
export const fontsReady = () => (document.fonts ? document.fonts.ready : Promise.resolve());
