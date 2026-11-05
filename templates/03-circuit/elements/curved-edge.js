import { gsap, reduced } from './_core.js';

// A dark curved lip at the top of a section that flattens away as you scroll.
export function mountCurvedEdge(el, { start = 'top bottom', end = 'top 5%', trigger } = {}) {
  if (reduced()) { gsap.set(el, { clipPath: 'ellipse(70% 0% at 50% 0%)' }); return; }
  gsap.fromTo(el, { clipPath: 'ellipse(70% 100% at 50% 0%)' }, { clipPath: 'ellipse(70% 0% at 50% 0%)', ease: 'none', scrollTrigger: { trigger: trigger || el.parentNode, start, end, scrub: 0.3 } });
}
