// Parts shared by every page: nav, menu, footer, loader, page transition, smooth scroll.
import { gsap, ScrollTrigger, rem, fontsReady, reduced } from '../elements/_core.js';
import { mountSmoothScroll } from '../elements/smooth-scroll.js';
import { mountMarkLoader, mountPageTransition } from '../elements/mark-loader.js';
import { mountMenuOverlay } from '../elements/menu-overlay.js';
import { mountNavTheme } from '../elements/nav-theme.js';
import { mountScrollBar } from '../elements/scroll-bar.js';
import { mountLineReveal } from '../elements/line-reveal.js';
import { mountScribble } from '../elements/scribble.js';
import { mountLogoMarquee } from '../elements/logo-marquee.js';
import { mountNotchCard } from '../elements/notch-card.js';
import { buttonHTML, rollHTML, linkRollHTML } from '../elements/char-roll.js';
import { MAIL, laurel, markSVG } from './icons.js';

export const S = window.SITE;

export function applyMeta() {
  document.title = S.meta.title;
  document.querySelector('meta[name=description]').content = S.meta.description;
  const c = S.colors; const r = document.documentElement.style;
  r.setProperty('--accent', c.accent); r.setProperty('--accent-soft', c.accentSoft); r.setProperty('--paper', c.paper);
  r.setProperty('--hero', c.hero); r.setProperty('--ink', c.ink); r.setProperty('--black', c.black); r.setProperty('--muted', c.muted);
}

export function navHTML(current) {
  const n = S.nav;
  return `<header class="nav">
    <div class="nav-row">
      <a class="brand" href="index.html" data-tr aria-label="${S.name.first} ${S.name.last}, home"><b class="b1">${S.name.first}</b><b class="b2">${S.name.last}</b></a>
      <a class="nav-mid" href="index.html" data-tr aria-label="Home">${markSVG(S.mark)}</a>
      <div class="nav-right">
        <a class="btn nav-cta" href="${n.cta.href}"><span class="btn-ico" style="overflow:visible;width:1.4rem;height:1.4rem">${MAIL}</span><span class="t-btn">${rollHTML(n.cta.label)}</span></a>
        <button class="ham" type="button" aria-label="Open menu" aria-expanded="false"><i></i><i></i></button>
      </div>
    </div>
    <div class="menu" id="menu"><div class="menu-grid">
      <div class="menu-images">${n.links.map((l) => `<div class="menu-img"><img class="tint" src="${l.image}" alt="" loading="lazy"><span class="tint-wash"></span><img class="full" src="${l.image}" alt="" loading="lazy"></div>`).join('')}</div>
      <nav class="menu-links" aria-label="Main">
        ${n.links.map((l) => `<a class="menu-link ${l.label === current ? 'is-current' : ''}" href="${l.href}" data-tr>${l.label}</a>`).join('')}
        <div class="menu-badge">${laurel()}<span class="t-eyebrow">${n.menuEyebrow}</span></div>
      </nav>
      <div class="menu-social"><span class="t-eyebrow">${n.socialsEyebrow}</span><div>${S.socials.map((s) => linkRollHTML({ label: s.label, href: s.href })).join('')}</div></div>
    </div></div>
  </header>`;
}

export function footerHTML() {
  const f = S.footer;
  return `<footer class="footer" data-nav-theme="light">
    <div class="footer-grad"></div>
    <div class="footer-card">
      <div class="footer-clip" data-notch>
        <img class="footer-pattern" src="assets/placeholders/contours.webp" alt="" loading="lazy">
        <div class="footer-marquee" data-footer-marquee></div>
        <div class="footer-figure"><img src="${f.figure}" alt="" loading="lazy"></div>
        <h2 class="footer-line t-impact-sm is-center" data-reveal="accent">${f.line}</h2>
        <div class="footer-scrib" data-footer-scribble></div>
        <div class="footer-cols">
          <div class="footer-col"><span class="t-eyebrow">${f.pagesEyebrow}</span><nav class="footer-links" aria-label="Pages">${S.nav.links.map((l) => linkRollHTML({ label: l.label, href: l.href, attrs: 'data-tr' })).join('')}</nav>${linkRollHTML({ label: f.extra.label, href: f.extra.href, cls: 'footer-extra' })}</div>
          <div class="footer-col"><span class="t-eyebrow">${f.followEyebrow}</span><nav class="footer-links" aria-label="Social">${S.socials.map((l) => linkRollHTML({ label: l.label, href: l.href })).join('')}</nav></div>
        </div>
        ${buttonHTML({ label: f.cta.label, href: f.cta.href, cls: 'footer-cta' })}
      </div>
      <div class="footer-legal"><span><b>${S.meta.copyright}</b> ${S.meta.rights}</span><div>${f.legal.map((l) => linkRollHTML({ label: l.label, href: l.href })).join('')}</div></div>
    </div>
  </footer>`;
}

export function mountShell() {
  history.scrollRestoration = 'manual';
  matchMedia('(max-width: 991px)').addEventListener('change', () => location.reload());
  const lenis = mountSmoothScroll();
  lenis?.stop();
  mountNavTheme();
  mountScrollBar();
  mountPageTransition({ mark: S.mark });
  mountMenuOverlay({ menu: document.getElementById('menu'), button: document.querySelector('.ham'), lenis });
  // Fit the two brand lines to the same width.
  fontsReady().then(() => {
    const target = 7.9 * rem();
    document.querySelectorAll('.brand b').forEach((b) => {
      b.style.display = 'inline-block';
      const w = b.getBoundingClientRect().width; const fs = parseFloat(getComputedStyle(b).fontSize);
      b.style.fontSize = `${(fs * target) / Math.max(1, w)}px`; b.style.display = 'block';
    });
  });
  return lenis;
}

export function mountFooter() {
  const root = document.querySelector('.footer'); if (!root) return;
  mountNotchCard(root.querySelector('[data-notch]'));
  mountLogoMarquee(root.querySelector('[data-footer-marquee]'), { items: S.clients.names, speed: 34 });
  mountLineReveal(root.querySelector('.footer-line'), { color: S.colors.accent });
  mountScribble(root.querySelector('[data-footer-scribble]'), { preset: 'signature', width: 13, trigger: root.querySelector('.footer-line'), delay: 0.25 });
  if (!reduced()) gsap.fromTo(root.querySelector('.footer-figure'), { y: '4rem' }, { y: 0, ease: 'none', scrollTrigger: { trigger: root, start: 'top 60%', end: 'bottom bottom', scrub: 0.4 } });
  const reveal = root.querySelectorAll('.footer-links .btn-roll, .footer-extra .btn-roll, .footer-col .t-eyebrow');
  if (!reduced()) {
    gsap.set(reveal, { clipPath: 'inset(0 100% 0 0)' });
    ScrollTrigger.create({ trigger: root.querySelector('.footer-cols'), start: 'top 96%', once: true, onEnter: () => gsap.to(reveal, { clipPath: 'inset(-5% 0% -5% 0)', duration: 0.75, ease: 'power3.out', stagger: 0.04 }) });
  }
}

export function runLoader(onOpen, { lenis }) {
  mountMarkLoader({
    mark: S.mark, color: S.colors.accent, label: `${S.name.first} ${S.name.last}`,
    onOpen: () => {
      document.documentElement.classList.remove('is-loading');
      scrollTo(0, 0);
      lenis?.start();
      ScrollTrigger.refresh();
      onOpen?.();
      if (location.hash) { const t = document.querySelector(location.hash); if (t) setTimeout(() => (lenis ? lenis.scrollTo(t, { duration: 1.2 }) : t.scrollIntoView()), 900); }
    },
  });
}
