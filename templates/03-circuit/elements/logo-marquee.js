import { gsap, reduced, clamp } from './_core.js';

// Endless row that speeds up with scroll velocity and turns around when you scroll back.
export function mountLogoMarquee(el, { items = [], speed = 40, boost = 0.6 } = {}) {
  const groupHTML = `<div class="marquee-group">${items.map((t) => `<span class="marquee-item">${t}</span>`).join('')}</div>`;
  el.classList.add('marquee');
  el.innerHTML = `<div class="marquee-track">${groupHTML}${groupHTML}</div>`;
  const track = el.firstChild;
  const fill = () => {
    const one = track.firstChild.getBoundingClientRect().width;
    if (one < 1) return one;
    while (track.children.length * one < innerWidth * 2 + one) track.insertAdjacentHTML('beforeend', groupHTML);
    return one;
  };
  el.querySelectorAll('.marquee-group').forEach((g, i) => { if (i) g.setAttribute('aria-hidden', 'true'); });
  let x = 0; let dir = 1; let lastY = scrollY; let one = 0;
  const measure = () => { one = fill(); };
  (document.fonts?.ready || Promise.resolve()).then(measure);
  addEventListener('resize', measure);
  if (reduced()) return { el };
  gsap.ticker.add((t, dtm) => {
    const dy = scrollY - lastY; lastY = scrollY;
    if (dy) dir = dy > 0 ? 1 : -1;
    if (!one) return;
    x -= dir * (speed * (dtm / 1000) + clamp(Math.abs(dy) * boost, 0, 40));
    if (x <= -one) x += one; if (x > 0) x -= one;
    track.style.transform = `translate3d(${x}px,0,0)`;
  });
  return { el };
}
