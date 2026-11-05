import { gsap, reduced, isPhone, rem } from './_core.js';

// Two text columns slide together while side images glide in from the edges, as the section arrives.
export function mountSplitPanels(track, { start = 'top bottom', travel = 1.89 } = {}) {
  if (reduced() || isPhone()) return;
  const [cl, cr] = [track.querySelector('.split-col.l'), track.querySelector('.split-col.r')];
  const [il, ir] = [track.querySelector('.split-side.l img'), track.querySelector('.split-side.r img')];
  const R = () => rem();
  const st = () => ({ trigger: track, start, end: () => `+=${innerHeight * travel}`, scrub: 0.3, invalidateOnRefresh: true });
  gsap.fromTo(il, { x: () => -20 * R() }, { x: 0, ease: 'power2.out', scrollTrigger: st() });
  gsap.fromTo(ir, { x: () => 20 * R() }, { x: 0, ease: 'power2.out', scrollTrigger: st() });
  const near = () => ({ trigger: track, start, end: () => `+=${innerHeight * 1.18}`, scrub: 0.3, invalidateOnRefresh: true });
  gsap.fromTo(cl, { x: () => -5 * R() }, { x: 0, ease: 'none', scrollTrigger: near() });
  gsap.fromTo(cr, { x: () => 5 * R() }, { x: 0, ease: 'none', scrollTrigger: near() });
}
