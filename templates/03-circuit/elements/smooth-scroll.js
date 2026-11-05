import { gsap, ScrollTrigger, reduced } from './_core.js';

// Smooth wheel scrolling wired into gsap's clock. Returns the Lenis instance, or null when motion is reduced.
export function mountSmoothScroll({ lerp = 0.1, wheelMultiplier = 1, touchMultiplier = 1.25 } = {}) {
  if (reduced() || !window.Lenis) return null;
  const lenis = new window.Lenis({ lerp, wheelMultiplier, touchMultiplier, smoothWheel: true, syncTouch: false, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.lenis = lenis;
  return lenis;
}
