import { gsap, reduced } from './_core.js';

// A full-bleed image climbs over the pinned section before it, drifting more slowly inside its box.
export function mountRiseImage(section, { travel = 16.7 } = {}) {
  const img = section.querySelector('img');
  if (reduced()) return;
  gsap.fromTo(img, { yPercent: 0 }, { yPercent: -travel, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } });
}
