// flip-brand: moves a word from one place on the page to another and scales it to fit,
// so a header name can fly into the first line of a paragraph and back.
export function mountFlipBrand(el, options = {}) {
  const { duration = 1.15, ease = 'expo.inOut' } = options;
  const { gsap } = window;
  return {
    to(targetEl, extra = {}) {
      gsap.set(el, { x: 0, y: 0, scale: 1 });
      const a = el.getBoundingClientRect(), b = targetEl.getBoundingClientRect();
      const scale = b.height / a.height;
      return gsap.to(el, { transformOrigin: '0 0', x: b.left - a.left, y: b.top - a.top, scale, duration, ease, ...extra });
    },
    home(extra = {}) { return gsap.to(el, { x: 0, y: 0, scale: 1, duration, ease, ...extra }); },
    snap() { gsap.set(el, { x: 0, y: 0, scale: 1 }); },
  };
}
