import { gsap, reduced, rem, isPhone } from './_core.js';

// Overlapping images at different speeds. data-speed sets travel in rem; images also drift inside their frames.
export function mountParallaxStack(root, { trigger } = {}) {
  if (reduced() || isPhone()) return;
  const tr = trigger || root;
  root.querySelectorAll('[data-speed]').forEach((el) => {
    const s = parseFloat(el.dataset.speed);
    gsap.fromTo(el, { y: () => s * rem() }, { y: () => -s * rem(), ease: 'none', scrollTrigger: { trigger: tr, start: 'top bottom', end: 'bottom top', scrub: 0.4, invalidateOnRefresh: true } });
  });
  root.querySelectorAll('.pimg img').forEach((img) => {
    gsap.fromTo(img, { yPercent: 0 }, { yPercent: -7.4, ease: 'none', scrollTrigger: { trigger: img.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}
