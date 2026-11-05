// line-reveal: splits text blocks into masked lines that slide up one after another.
export function mountLineReveal(targets, options = {}) {
  const { duration = 1.05, stagger = 0.06, ease = 'expo.out', yPercent = 110, delay = 0 } = options;
  const { gsap, SplitText } = window;
  gsap.registerPlugin(SplitText);
  const nodes = gsap.utils.toArray(targets);
  let split = null, lines = [];
  const build = () => {
    split?.revert();
    split = new SplitText(nodes, { type: 'lines', mask: 'lines', linesClass: 'lr-line' });
    lines = split.lines;
    gsap.set(lines, { yPercent });
  };
  build();
  return {
    get lines() { return lines; },
    in(extra = {}) { gsap.killTweensOf(lines); return gsap.to(lines, { yPercent: 0, duration, stagger, ease, delay, ...extra }); },
    out(extra = {}) { gsap.killTweensOf(lines); return gsap.to(lines, { yPercent: -yPercent, duration: 0.45, stagger: 0.012, ease: 'power3.in', ...extra }); },
    reset() { gsap.killTweensOf(lines); gsap.set(lines, { yPercent }); },
    rebuild: build,
    destroy() { split?.revert(); },
  };
}
