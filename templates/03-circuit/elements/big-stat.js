import { gsap, reduced } from './_core.js';

// Huge number pinned to the viewport that settles from oversized as you scroll past.
export function mountBigStat(section) {
  const num = section.querySelector('.big-num'); const label = section.querySelector('.big-label');
  if (reduced()) return;
  gsap.fromTo(num, { scale: 1.7, yPercent: 14 }, { scale: 1, yPercent: 0, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'center center', scrub: 0.4 } });
  if (label) gsap.fromTo(label, { y: '6rem', opacity: 0 }, { y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: section, start: 'top 30%', end: 'top top', scrub: 0.4 } });
}
