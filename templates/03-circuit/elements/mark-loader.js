import { gsap, reduced } from './_core.js';

const TR_KEY = 'circuit-transition';

// Full-bleed color field. A monogram draws in, then becomes a hole that grows until the page shows through.
export function mountMarkLoader({ mark, color = '#d2ff00', label = '', root = document.body, onOpen } = {}) {
  const fromTransition = (() => { try { const v = sessionStorage.getItem(TR_KEY); sessionStorage.removeItem(TR_KEY); return !!v; } catch { return false; } })();
  const el = document.createElement('div');
  el.className = 'loader';
  el.innerHTML = `
    <svg class="hole" aria-hidden="true"><defs><mask id="loader-hole" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
      <rect width="100%" height="100%" fill="#fff"/><g class="g"><path d="${mark.d}" fill="#000"/></g></mask></defs>
      <rect width="100%" height="100%" fill="${color}" mask="url(#loader-hole)"/></svg>
    <svg class="loader-mark" viewBox="${mark.viewBox}" aria-hidden="true"><path d="${mark.d}"/></svg>
    <div class="loader-label t-eyebrow">${label}</div>`;
  root.appendChild(el);
  const g = el.querySelector('.g'); const mk = el.querySelector('.loader-mark');
  const lab = el.querySelector('.loader-label');
  const [, , vw, vh] = mark.viewBox.split(' ').map(Number);
  const state = { s: 0 };
  const focus = mark.focus || [vw / 2, vh / 2];
  const smallScaleRef = (5 * parseFloat(getComputedStyle(document.documentElement).fontSize)) / vw;
  const place = () => {
    const W = innerWidth, H = innerHeight;
    // Drift the zoom toward a point inside a stroke so the screen never lands in a gap between strokes.
    const k = Math.min(1, state.s / (smallScaleRef * 5));
    const fx = vw * 0.5 + (focus[0] - vw * 0.5) * k; const fy = vh * 0.5 + (focus[1] - vh * 0.5) * k;
    g.setAttribute('transform', `translate(${W / 2} ${H / 2}) scale(${state.s}) translate(${-fx} ${-fy})`);
  };
  place();
  addEventListener('resize', place);

  const done = () => { removeEventListener('resize', place); el.remove(); };
  if (reduced()) { onOpen?.(); gsap.to(el, { opacity: 0, duration: 0.3, delay: 0.1, onComplete: done }); return { el }; }
  if (fromTransition) gsap.set(lab, { autoAlpha: 0 });

  const px = (rem) => rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
  const smallScale = px(5) / vw;
  const coverScale = (Math.hypot(innerWidth, innerHeight) / (mark.stroke || 20)) * 1.5;

  const tl = gsap.timeline({ delay: fromTransition ? 0.15 : 0.9, onComplete: done });
  tl.to(mk, { clipPath: 'inset(0% 0 0 0)', duration: 0.55, ease: 'power3.out' });
  tl.add(() => { gsap.set(mk, { autoAlpha: 0 }); state.s = smallScale; place(); onOpen?.(); }, '+=0.12');
  tl.to(lab, { autoAlpha: 0, duration: 0.2 }, '<');
  tl.to(state, { s: coverScale, duration: 1, ease: 'power2.in', onUpdate: place }, '<');
  return { el };
}

// mark grows out of the center to fill the screen, then navigates.
export function mountPageTransition({ mark, selector = 'a[data-tr]' } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'transition-mark'); svg.setAttribute('viewBox', mark.viewBox); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<path d="${mark.d}"/>`;
  document.body.appendChild(svg);
  const go = (href) => {
    if (reduced()) { location.href = href; return; }
    try { sessionStorage.setItem(TR_KEY, '1'); } catch { /* private mode */ }
    gsap.set(svg, { autoAlpha: 1, scale: 0, transformOrigin: '50% 60%' });
    gsap.to(svg, { scale: 42, duration: 0.95, ease: 'power3.in', onComplete: () => { location.href = href; } });
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest(selector);
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
    e.preventDefault(); go(url.href);
  });
  addEventListener('pageshow', (e) => { if (e.persisted) gsap.set(svg, { autoAlpha: 0 }); });
  return { go };
}
