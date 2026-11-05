import { gsap, reduced } from './_core.js';

// Drops from the top in an ellipse. Links and images unfold in sequence; hovering a link colors its image.
export function mountMenuOverlay({ root = document.documentElement, menu, button, lenis } = {}) {
  const imgs = [...menu.querySelectorAll('.menu-img')];
  const links = [...menu.querySelectorAll('.menu-link')];
  const fades = [...menu.querySelectorAll('.menu-badge, .menu-social')];
  let open = false; let tl;
  links.forEach((l, i) => {
    l.addEventListener('mouseenter', () => imgs.forEach((m, j) => m.classList.toggle('is-active', j === i)));
    l.addEventListener('mouseleave', () => imgs[i]?.classList.remove('is-active'));
  });
  const set = (v) => {
    open = v;
    root.classList.toggle('menu-open', v);
    button.setAttribute('aria-expanded', v);
    button.setAttribute('aria-label', v ? 'Close menu' : 'Open menu');
    menu.inert = !v;
    tl?.kill();
    if (v) lenis?.stop(); else lenis?.start();
    if (reduced()) {
      gsap.set(menu, { visibility: v ? 'visible' : 'hidden', clipPath: v ? 'ellipse(120% 120% at 50% 0%)' : 'ellipse(120% 0% at 50% 0%)' });
      gsap.set([...imgs, ...links], { clipPath: 'none' }); gsap.set(fades, { opacity: 1 });
      return;
    }
    tl = gsap.timeline();
    if (v) {
      gsap.set(menu, { visibility: 'visible' });
      tl.to(menu, { clipPath: 'ellipse(120% 125% at 50% 0%)', duration: 0.85, ease: 'power3.out' }, 0);
      tl.to(imgs, { clipPath: 'ellipse(120% 130% at 50% 0%)', duration: 1, ease: 'power3.out', stagger: 0.07 }, 0.08);
      tl.to(links, { clipPath: 'ellipse(100% 140% at 50% 0%)', duration: 0.8, ease: 'power3.out', stagger: 0.06 }, 0.14);
      tl.to(fades, { opacity: 1, duration: 0.5, stagger: 0.1 }, 0.5);
    } else {
      tl.to(menu, { clipPath: 'ellipse(120% 0% at 50% 0%)', duration: 0.6, ease: 'power3.inOut' }, 0);
      tl.add(() => {
        gsap.set(menu, { visibility: 'hidden' });
        gsap.set(imgs, { clipPath: 'ellipse(120% 0% at 50% 0%)' });
        gsap.set(links, { clipPath: 'ellipse(30% 0% at 50% 0%)' });
        gsap.set(fades, { opacity: 0 });
      });
    }
  };
  menu.inert = true;
  button.addEventListener('click', () => set(!open));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { set(false); button.focus(); } });
  return { open: () => set(true), close: () => set(false) };
}
