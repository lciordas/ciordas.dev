import { gsap, ScrollTrigger, hexRGB, mixRGB, reduced, isTouch, rem, clamp } from '../elements/_core.js';
import { mountTopoStage } from '../elements/topo-stage.js';
import { mountLineReveal } from '../elements/line-reveal.js';
import { mountScribble } from '../elements/scribble.js';
import { galleryHTML, mountHorizontalGallery } from '../elements/horizontal-gallery.js';
import { mountSplitPanels } from '../elements/split-panels.js';
import { mountRiseImage } from '../elements/rise-image.js';
import { frameGridDefs, frameItemHTML, mountFrameGrid } from '../elements/frame-grid.js';
import { mountCurvedEdge } from '../elements/curved-edge.js';
import { mountParallaxStack } from '../elements/parallax-stack.js';
import { mountLogoMarquee } from '../elements/logo-marquee.js';
import { mountCardFan } from '../elements/card-fan.js';
import { mountOvalTitle } from '../elements/oval-title.js';
import { buttonHTML, iconButtonHTML, linkRollHTML } from '../elements/char-roll.js';
import { S, applyMeta, navHTML, footerHTML, mountShell, mountFooter, runLoader } from './shell.js';
import { laurel, markSVG, DOODLE, TAG, HAND } from './icons.js';

applyMeta();
const C = S.colors;
const P = S.projects, F = S.feature, CL = S.clients, SB = S.socialsBlock, SP = S.split;

document.getElementById('app').innerHTML = `
<canvas class="gl" aria-hidden="true"></canvas>
${navHTML('Home')}
<main class="page">
  <h1 class="sr">${S.name.first} ${S.name.last}</h1>
  <div class="hero-track" data-nav-theme="auto">
    <div class="hero-sticky">
      <img class="fallback-frame" src="assets/placeholders/figure-base.webp" alt="">
      <div class="hero-phone-title" aria-hidden="true">${markSVG(S.mark)}<b><span>${S.name.first}</span>${S.name.last}</b><span class="t-eyebrow" style="font-size:.95rem">${S.hero.card.badge}</span></div>
      <div class="hero-card" aria-label="${S.hero.card.eyebrow}: ${S.hero.card.title}">
        <svg class="outline" viewBox="0 0 119 244" preserveAspectRatio="none" fill="none" stroke="currentColor" aria-hidden="true"><path d="M118.5 6V238a5.5 5.5 0 0 1-5.5 5.5H6A5.5 5.5 0 0 1 .5 238V25A5.5 5.5 0 0 1 6 19.5H50c5 0 9-2 12-5.5l8-8.5A16 16 0 0 1 83 .5H113a5.5 5.5 0 0 1 5.5 5.5Z" vector-effect="non-scaling-stroke"/></svg>
        <div class="eb t-eyebrow">${S.hero.card.eyebrow}</div>
        <div class="hc-row">${DOODLE}<span class="hc-title">${S.hero.card.title}</span></div>
        <div class="hc-row">${laurel()}<span class="hc-title">${S.hero.card.badge}</span></div>
      </div>
      <div class="home-message">
        <div class="msg-top">${markSVG(S.mark)}<span class="t-eyebrow" data-reveal-msg>${S.message.eyebrow}</span></div>
        <div class="msg-rows" aria-hidden="true"></div>
        <p class="sr">${S.message.rows.join('. ')}</p>
        <div class="fallback-marquee" aria-hidden="true">${S.message.rows[0]}</div>
        <div class="msg-target"><div class="msg-scribble"></div></div>
      </div>
      <div class="touch-lock"><span class="t-eyebrow" data-touch-hint>${S.hero.touchHint.lock}</span><button class="btn" type="button" aria-pressed="false" aria-label="${S.hero.touchHint.lock}">${HAND}</button></div>
    </div>
  </div>

  <section class="statement" id="statement" data-nav-theme="auto">
    <div class="statement-in">
      <div class="statement-icon">${laurel()}<span class="t-eyebrow" data-reveal="accent">${S.statement.eyebrow}</span></div>
      <h2 class="t-impact is-center" data-reveal="soft">${S.statement.text}</h2>
    </div>
  </section>

  <section class="hgal" data-nav-theme="auto" aria-label="Gallery"><div class="hgal-sticky"><div class="hgal-track">${galleryHTML(S.gallery.items)}</div></div></section>

  <div class="split-track" data-nav-theme="light">
    <section class="split-sticky">
      <div class="split-bg">
        <div class="split-side l"><img src="${SP.left.image}" alt="" loading="lazy"></div>
        <div class="split-side r"><img src="${SP.right.image}" alt="" loading="lazy"></div>
      </div>
      <div class="split-mid">
        ${['left', 'right'].map((k) => `<div class="split-col ${k[0]}">
          <h2 class="t-impact-reg"><span class="serif" style="display:block" data-reveal="deep">${SP[k].top}</span><span style="display:block" data-reveal="deep">${SP[k].bottom}</span></h2>
          ${k === 'left' ? '<div class="split-scrib"></div>' : ''}
          <p class="split-p t-body" data-reveal="deep">${SP[k].text}</p>
          <div class="split-btn">${iconButtonHTML({ href: SP[k].href, label: `${SP[k].top} ${SP[k].bottom}`, attrs: 'data-tr' })}</div>
        </div>`).join('')}
      </div>
    </section>
    <section class="rise" data-nav-theme="dark"><img src="${SP.rise}" alt="" loading="lazy"></section>
  </div>

  <div class="dark-group" id="projects" data-nav-theme="dark">
    ${frameGridDefs()}
    <section>
      <div class="title-row">
        <h2 class="t-title"><span style="display:block" data-reveal="accent">${P.titleTop}</span><em style="display:block" data-reveal="accent">${P.titleBottom}</em></h2>
        <p class="title-para t-body" data-reveal="accent">${P.text}</p>
      </div>
      <div class="fgrid">${P.items.map((it) => frameItemHTML(it, 'data-tr')).join('')}</div>
    </section>
    <section class="callout">
      ${laurel()}
      <p class="t-serif is-center" data-reveal="accent">${P.callout.text}</p>
      ${buttonHTML({ label: P.callout.cta.label, href: P.callout.cta.href, attrs: 'data-tr' })}
    </section>
  </div>

  <section class="feature" data-nav-theme="light">
    <div class="visor"></div>
    <div class="feature-grid" data-stack>
      <div class="feature-text">
        <div class="feature-eb">${TAG}<span class="t-eyebrow lg" data-reveal="deep">${F.eyebrow}</span></div>
        <h2 class="t-impact-reg">${F.lines.map((l) => `<span style="display:block" data-reveal="deep">${l}</span>`).join('')}</h2>
        <p class="feature-p t-body" data-reveal="deep">${F.text}</p>
        ${buttonHTML({ label: F.cta.label, href: F.cta.href, attrs: 'data-tr' })}
        <div class="pimg feature-cor" data-speed="4"><img src="${F.images.corner}" alt="" loading="lazy"></div>
      </div>
      <div class="feature-col">
        <div class="pimg main"><img src="${F.images.main}" alt="" loading="lazy"></div>
        <div class="pimg float" data-speed="5"><img src="${F.images.float}" alt="" loading="lazy"></div>
        <div class="pimg low" data-speed="7"><img src="${F.images.low}" alt="" loading="lazy"></div>
        <div class="feature-sticker" data-speed="10"><img src="${F.images.sticker}" alt="" loading="lazy"></div>
      </div>
    </div>
  </section>

  <section class="clients" data-nav-theme="light">
    <div class="clients-scrib"></div>
    <div class="title-row">
      <h2 class="t-title"><span style="display:block" data-reveal="deep">${CL.titleTop}</span><em style="display:block;color:var(--ink)" data-reveal="deep">${CL.titleBottom}</em></h2>
      <p class="title-para t-body" data-reveal="deep">${CL.text}</p>
    </div>
    <div class="clients-marquee"></div>
  </section>

  <section class="socials" data-nav-theme="light">
    <div class="socials-ico">${markSVG(S.mark)}</div>
    <h2 class="oval t-title" data-oval>
      <span class="oval-clip"><span class="oval-inner">${SB.titleTop}</span></span>
      <span class="oval-clip"><span class="oval-inner serif">${SB.titleBottom}</span></span>
    </h2>
    <div class="fan">${SB.cards.map((c) => `<a class="fan-card" href="${c.href}" aria-label="Social post"><img src="${c.image}" alt="" loading="lazy"></a>`).join('')}</div>
    <p class="socials-cap t-serif" data-reveal="deep">${SB.caption}</p>
    <div class="socials-links">${S.socials.map((l) => linkRollHTML({ label: l.label, href: l.href })).join('')}</div>
  </section>

  ${footerHTML()}
</main>`;

const lenis = mountShell();
const INK = hexRGB(C.ink), PAPER = hexRGB(C.paper);
const root = document.documentElement;

const stage = mountTopoStage(document.querySelector('.gl'), {
  colors: C,
  frameTarget: document.querySelector('.msg-target'),
  rowsEl: document.querySelector('.msg-rows'),
  rows: S.message.rows,
  portrait: S.hero.portrait,
  portraitReveal: S.hero.portraitReveal,
  getVelocity: () => (lenis ? Math.abs(lenis.velocity) : 0) * 0.35,
});

// Page color: dark through the hero and statement, then fades to paper across the gallery.
let themeP = 0;
const applyTheme = (p) => {
  themeP = p;
  const e = 1 - Math.pow(1 - p, 3);
  const rgb = mixRGB(INK, PAPER, e);
  stage?.setBg(rgb);
  root.style.setProperty('--stage-bg', `rgb(${rgb.map((v) => Math.round(v * 255)).join(',')})`);
  const light = e > 0.62;
  root.style.setProperty('--gal-text', light ? C.ink : C.paper);
  root.style.setProperty('--gal-label', light ? '#535450' : C.muted);
};
applyTheme(0);
gsap.ticker.add(() => {
  const light = scrollY < 90 || (themeP > 0 && 1 - Math.pow(1 - themeP, 3) > 0.55);
  root.dataset.stageTheme = light ? 'light' : 'dark';
});

const blocks = { accent: C.accent, soft: C.accentSoft, deep: '#3b3c38' };
document.querySelectorAll('.page [data-reveal]').forEach((el) => {
  if (el.closest('.hgal') || el.closest('.footer')) return;
  mountLineReveal(el, { color: blocks[el.dataset.reveal] || C.accent });
});

mountHorizontalGallery(document.querySelector('.hgal'), { onProgress: applyTheme, colorBlock: C.accent });
mountSplitPanels(document.querySelector('.split-track'));
mountRiseImage(document.querySelector('.rise'));
mountScribble(document.querySelector('.split-scrib'), { preset: 'small', mode: 'scrub', trigger: document.querySelector('.split-track'), start: 'top 12%', end: 'top -12%' });
mountFrameGrid(document.querySelector('.fgrid'));
mountCurvedEdge(document.querySelector('.visor'));
mountParallaxStack(document.querySelector('[data-stack]'), { trigger: document.querySelector('.feature') });
mountLogoMarquee(document.querySelector('.clients-marquee'), { items: CL.names });
mountScribble(document.querySelector('.clients-scrib'), { preset: 'word', mode: 'scrub', trigger: document.querySelector('.clients'), start: 'top 85%', end: 'top 15%' });
mountOvalTitle(document.querySelector('[data-oval]'));
mountCardFan(document.querySelector('.fan'), { trigger: document.querySelector('.socials') , start: 'top 62%', end: 'top 6%' });
mountFooter();

// Hero details that key off scroll.
const msgScribble = mountScribble(document.querySelector('.msg-scribble'), { preset: 'signature', mode: 'none' });
const msgMark = document.querySelector('.msg-top svg');
const msgEb = document.querySelector('[data-reveal-msg]');
const heroCard = document.querySelector('.hero-card');
if (!reduced()) {
  gsap.set([msgMark, msgEb], { clipPath: 'inset(0 100% 0 0)' });
  ScrollTrigger.create({
    trigger: '.hero-track', start: 'top top', end: 'bottom top',
    onUpdate: () => {
      const vh = innerHeight; const y = scrollY;
      msgScribble.progress(clamp((y - vh * 0.62) / (vh * 0.2)));
      const ebP = clamp((y - vh * 0.7) / (vh * 0.12));
      gsap.set([msgMark, msgEb], { clipPath: `inset(-10% ${100 - ebP * 100}% -10% 0)` });
    },
  });
  ScrollTrigger.create({
    trigger: '.hero-track', start: () => `${innerHeight * 0.08} top`,
    onEnter: () => gsap.to(heroCard, { clipPath: 'ellipse(100% 0% at 50% 100%)', duration: 0.75, ease: 'power3.inOut' }),
    onLeaveBack: () => gsap.to(heroCard, { clipPath: 'ellipse(100% 120% at 50% 100%)', duration: 0.75, ease: 'power3.inOut' }),
  });
  gsap.set(heroCard, { clipPath: 'ellipse(100% 0% at 50% 100%)' });
} else {
  // Reduced motion: no drawing, the signature simply appears once the frame has shrunk.
  ScrollTrigger.create({ trigger: '.hero-track', start: () => `${innerHeight * 0.7} top`, end: 'bottom top', onToggle: (st) => msgScribble.progress(st.isActive ? 1 : 0) });
}

// Touch: a lock button freezes scrolling so a finger can paint the reveal.
if (isTouch()) {
  const wrap = document.querySelector('.touch-lock'); const btn = wrap.querySelector('button'); const hint = wrap.querySelector('[data-touch-hint]');
  let locked = false;
  btn.addEventListener('click', () => {
    locked = !locked;
    wrap.classList.toggle('is-locked', locked); btn.setAttribute('aria-pressed', locked);
    hint.textContent = locked ? S.hero.touchHint.unlock : S.hero.touchHint.lock;
    if (locked) { lenis?.stop(); document.body.style.overflow = 'hidden'; document.body.style.touchAction = 'none'; }
    else { lenis?.start(); document.body.style.overflow = ''; document.body.style.touchAction = ''; }
  });
}

runLoader(() => {
  if (!reduced()) {
    gsap.fromTo('.brand', { scale: 1.2 }, { scale: 1, duration: 1.2, ease: 'power3.inOut', delay: 0.5 });
    gsap.fromTo('.nav-right', { scale: 1.2 }, { scale: 1, duration: 1.2, ease: 'power3.inOut', delay: 0.5 });
    gsap.to(heroCard, { clipPath: 'ellipse(100% 120% at 50% 100%)', duration: 1, ease: 'power3.out', delay: 1 });
  }
}, { lenis });

let refreshT; addEventListener('load', () => ScrollTrigger.refresh());
addEventListener('resize', () => { clearTimeout(refreshT); refreshT = setTimeout(() => ScrollTrigger.refresh(), 200); });
window.__stage = stage;
