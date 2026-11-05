import { gsap, ScrollTrigger, isPhone, reduced, clamp, lerp, rem } from './_core.js';
import { mountLineReveal } from './line-reveal.js';
import { mountScribble } from './scribble.js';

// Twelve slots as [left, top, width, height] in px at a 1440 x 900 reference.
const SLOTS = [[1080, 63, 243, 326], [1210, 502, 264, 289], [1627, 78, 232, 98], [1627, 307, 589, 560], [2358, 63, 198, 214], [2500, 453, 286, 340],
  [2928, 593, 192, 263], [3120, 135, 187, 212], [3449, 81, 549, 574], [3449, 745, 400, 98], [4281, 198, 285, 303], [4139, 584, 247, 249]];
const TRACK = 4583; const R = 0.075;

export function galleryHTML(items) {
  return items.map((it, i) => {
    const [x, y, w, h] = SLOTS[i % SLOTS.length];
    const pos = `left:${x * R}rem;top:calc(50vh + ${(y - 450) * R}rem);width:${w * R}rem;`;
    if (it.type === 'text') return `<div class="hgal-item is-text" style="${pos}"><p class="hgal-text" data-reveal>${it.text}</p><div class="hgal-scrib" data-tick></div></div>`;
    return `<figure class="hgal-item" style="${pos}margin:0"><figcaption class="t-eyebrow" data-reveal>${it.label}</figcaption><div class="hgal-img ${it.tint ? 'tint' : ''}" style="height:${(h - 17) * R}rem"><img src="${it.src}" alt="${it.alt || it.label || ''}" loading="lazy"></div></figure>`;
  }).join('');
}

// Pins a section and walks a wide track across it 1:1 with scroll. Images drift inside their frames.
// onProgress(0..1) fires across the pinned range, useful for fading the page color.
export function mountHorizontalGallery(section, { onProgress, colorBlock = 'var(--accent)' } = {}) {
  const track = section.querySelector('.hgal-track');
  const imgs = [...section.querySelectorAll('.hgal-img')].map((b) => ({ b, img: b.querySelector('img') }));
  section.querySelectorAll('[data-reveal]').forEach((el) => mountLineReveal(el, { color: colorBlock, stagger: 0.08, margin: '0px' }));
  section.querySelectorAll('[data-tick]').forEach((el) => mountScribble(el, { preset: 'tick' }));
  if (isPhone() || reduced()) {
    section.classList.add('is-stacked');
    if (onProgress) ScrollTrigger.create({ trigger: section, start: 'top 55%', end: 'bottom 55%', onUpdate: (st) => onProgress(st.progress), onRefresh: (st) => onProgress(st.progress) });
    return { refresh() {} };
  }
  const width = () => TRACK * R * rem();
  const measure = () => { section.style.height = `${width() - innerWidth}px`; track.style.width = `${width()}px`; };
  measure();
  ScrollTrigger.addEventListener('refreshInit', measure);
  gsap.to(track, {
    x: () => -(width() - innerWidth), ease: 'none',
    scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom bottom', scrub: 0.5, invalidateOnRefresh: true },
  });
  if (onProgress) ScrollTrigger.create({ trigger: section, start: 'top top', end: 'bottom bottom', onUpdate: (st) => onProgress(st.progress), onRefresh: (st) => onProgress(st.progress) });
  gsap.ticker.add(() => {
    const vw = innerWidth; const shift = 4 * rem();
    for (const { b, img } of imgs) {
      const r = b.getBoundingClientRect();
      if (r.right < -60 || r.left > vw + 60) continue;
      img.style.transform = `translate3d(${lerp(-shift, shift, clamp((r.left + r.width) / (vw + r.width)))}px,0,0)`;
    }
  });
  return { refresh: () => ScrollTrigger.refresh() };
}
