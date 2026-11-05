import { gsap, reduced, isPhone, rem } from './_core.js';

// Own notched outline: bottom right steps up to leave room for a label.
const SHAPE = 'M8 1H399a7 7 0 0 1 7 7V365a7 7 0 0 1-7 7H264a24 24 0 0 0-19 9l-16 21a22 22 0 0 1-18 8H8a7 7 0 0 1-7-7V8A7 7 0 0 1 8 1Z';

export function frameGridDefs() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><clipPath id="frameClip" clipPathUnits="objectBoundingBox"><path transform="scale(${1 / 407} ${1 / 411})" d="${SHAPE}"/></clipPath></defs></svg>`;
}
export function frameItemHTML({ name, year, href = '#', image, hover }, attrs = '') {
  return `<div class="fgrid-outer"><a class="fgrid-item" href="${href}" ${attrs}>
    <svg class="fgrid-frame" viewBox="0 0 407 411" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="${SHAPE}" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke"/><path class="over" d="${SHAPE}" pathLength="1" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
    <span class="fgrid-obj"><img src="${image}" alt="${name}" loading="lazy"></span>
    ${hover ? `<span class="fgrid-hover"><img src="${hover}" alt="" loading="lazy"></span>` : ''}
    <span class="fgrid-text t-label"><span>${name}</span><b>${year}</b></span></a></div>`;
}

// Cards drift up into place as they scroll in; even columns travel further.
export function mountFrameGrid(grid, { odd = 5, even = 15 } = {}) {
  if (reduced() || isPhone()) return;
  [...grid.querySelectorAll('.fgrid-item')].forEach((item, i) => {
    const y = (i % 2 ? even : odd);
    gsap.fromTo(item, { y: () => y * rem() }, { y: 0, ease: 'none', scrollTrigger: { trigger: item.parentNode, start: 'top bottom', end: 'top 30%', scrub: 0.4, invalidateOnRefresh: true } });
  });
}
