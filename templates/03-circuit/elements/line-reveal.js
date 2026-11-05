import { gsap, SplitText, easeDefault, reduced, inView, fontsReady } from './_core.js';

// Splits text into lines, wipes each open from the left while a colored block retracts to the right.
// mountLineReveal(el, { color, stagger, delay, trigger })
export function mountLineReveal(el, { color = 'var(--accent)', stagger = 0.1, delay = 0, trigger = 'view', margin } = {}) {
  let split; let played = false;
  const finish = () => { el.classList.add('is-ready'); if (split) { split.revert(); split = null; } };
  const api = { play: () => {} };
  fontsReady().then(() => {
    if (reduced()) { el.classList.add('is-ready'); return; }
    split = SplitText.create(el, { type: 'lines', linesClass: 'line' });
    split.lines.forEach((l) => {
      const b = document.createElement('i');
      b.className = 'line-block'; b.style.background = color; b.setAttribute('aria-hidden', 'true');
      l.appendChild(b);
      gsap.set(l, { clipPath: 'inset(-14% 100% -14% 0%)' });
    });
    el.classList.add('is-ready');
    api.play = () => {
      if (played || !split) return; played = true;
      const tl = gsap.timeline({ delay, onComplete: finish });
      split.lines.forEach((l, i) => {
        tl.to(l, { clipPath: 'inset(-14% 0% -14% 0%)', duration: 0.75, ease: 'power3.out' }, i * stagger);
        tl.to(l.querySelector('.line-block'), { scaleX: 0, duration: 0.75, ease: easeDefault }, i * stagger + 0.15);
      });
    };
    if (trigger === 'view') inView(el, api.play, margin ? { margin } : undefined);
  });
  return api;
}
