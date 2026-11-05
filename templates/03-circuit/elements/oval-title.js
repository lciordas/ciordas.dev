import { gsap, reduced, inView } from './_core.js';

// Title lines open out of a small ellipse at the top of each line, one after another.
export function mountOvalTitle(el, { stagger = 0.1, duration = 1 } = {}) {
  const lines = [...el.querySelectorAll('.oval-clip')];
  if (reduced()) { gsap.set(lines, { clipPath: 'none' }); return; }
  inView(el, () => gsap.to(lines, { clipPath: 'ellipse(100% 150% at 50% 0%)', duration, ease: 'power3.out', stagger }));
}
