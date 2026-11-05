import { gsap, ScrollTrigger, hexRGB, reduced } from '../elements/_core.js';
import { mountTopoStage } from '../elements/topo-stage.js';
import { mountLineReveal } from '../elements/line-reveal.js';
import { mountScribble } from '../elements/scribble.js';
import { galleryHTML, mountHorizontalGallery } from '../elements/horizontal-gallery.js';
import { mountBigStat } from '../elements/big-stat.js';
import { mountCountdown } from '../elements/countdown.js';
import { mountFloatObject } from '../elements/float-object.js';
import { S, applyMeta, navHTML, footerHTML, mountShell, mountFooter, runLoader } from './shell.js';

applyMeta();
const C = S.colors, W = S.work;
document.documentElement.dataset.stageTheme = 'dark';
document.getElementById('app').innerHTML = `
<canvas class="gl" aria-hidden="true"></canvas>
${navHTML('Work')}
<div class="w-float" aria-hidden="true"></div>
<main class="page">
  <section class="w-hero">
    <h1 class="w-word">${W.titleWord}</h1>
    <div class="w-scrib"></div>
    <div class="w-object"><img src="assets/placeholders/token-07.webp" alt=""></div>
    <div class="w-facts">${W.facts.map(([a, b]) => `<div class="w-fact"><b>${a}</b><span data-reveal>${b}</span></div>`).join('')}</div>
    <p class="w-intro" data-reveal>${W.intro}</p>
  </section>
  <section class="w-statement"><h2 class="t-impact is-center" data-reveal>${W.statement}</h2></section>
  ${W.stats.map(([n, l]) => `<section class="big-stat"><div class="big-stat-in"><div class="big-num" aria-hidden="true">${n}</div><div class="big-label">${l}<span class="sr">: ${n}</span></div></div></section>`).join('')}
  <section class="ledger">
    <h2 class="ledger-title t-title"><span><span data-reveal style="display:block">${W.ledgerTitleTop}</span><em data-reveal style="display:block">${W.ledgerTitleBottom}</em></span></h2>
    <div>${W.ledger.map((r) => `<a class="ledger-row" href="#">${r.map((c) => `<span>${c}</span>`).join('')}</a>`).join('')}</div>
  </section>
  <section class="hgal" aria-label="Gallery"><div class="hgal-sticky"><div class="hgal-track">${galleryHTML(S.gallery.items)}</div></div></section>
  <section class="count" aria-label="${W.countdown.label}"><div class="count-row" style="display:flex;align-items:baseline"></div><div class="count-scrib"></div></section>
  ${footerHTML()}
</main>`;

const lenis = mountShell();
const stage = mountTopoStage(document.querySelector('.gl'), { colors: C });
stage?.setBg(hexRGB(C.black));
document.documentElement.style.setProperty('--stage-bg', C.black);
document.documentElement.style.setProperty('--gal-text', C.paper);
document.documentElement.style.setProperty('--gal-label', C.muted);

document.querySelectorAll('.page [data-reveal]').forEach((el) => { if (!el.closest('.hgal') && !el.closest('.footer')) mountLineReveal(el, { color: C.accent }); });
mountScribble(document.querySelector('.w-scrib'), { preset: 'small', width: 13, trigger: document.querySelector('.w-hero'), delay: 1.2 });
document.querySelectorAll('.big-stat').forEach(mountBigStat);
mountHorizontalGallery(document.querySelector('.hgal'), { colorBlock: C.accent });
mountCountdown(document.querySelector('.count-row'), W.countdown.target);
mountScribble(document.querySelector('.count-scrib'), { preset: 'small', width: 9, trigger: document.querySelector('.count') });
mountFooter();
const floatHost = document.querySelector('.w-float');
mountFloatObject(floatHost);
gsap.set(floatHost, { autoAlpha: 0 });
if (reduced()) gsap.set(floatHost, { autoAlpha: 1 });
else ScrollTrigger.create({ trigger: '.w-statement', start: 'top 80%', endTrigger: '.ledger', end: 'bottom 40%', onToggle: (st) => gsap.to(floatHost, { autoAlpha: st.isActive ? 1 : 0, duration: 0.4 }) });

runLoader(null, { lenis });
addEventListener('load', () => ScrollTrigger.refresh());
