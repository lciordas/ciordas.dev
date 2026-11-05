import { gsap, ScrollTrigger, hexRGB } from '../elements/_core.js';
import { mountSmoothScroll } from '../elements/smooth-scroll.js';
import { mountTopoStage } from '../elements/topo-stage.js';
import { mountLineReveal } from '../elements/line-reveal.js';
import { buttonHTML, iconButtonHTML, linkRollHTML, mountCharRoll } from '../elements/char-roll.js';
import { mountScribble } from '../elements/scribble.js';
import { mountMarkLoader, mountPageTransition } from '../elements/mark-loader.js';
import { mountMenuOverlay } from '../elements/menu-overlay.js';
import { mountScrollBar } from '../elements/scroll-bar.js';
import { galleryHTML, mountHorizontalGallery } from '../elements/horizontal-gallery.js';
import { mountSplitPanels } from '../elements/split-panels.js';
import { mountRiseImage } from '../elements/rise-image.js';
import { frameGridDefs, frameItemHTML, mountFrameGrid } from '../elements/frame-grid.js';
import { mountCurvedEdge } from '../elements/curved-edge.js';
import { mountParallaxStack } from '../elements/parallax-stack.js';
import { mountLogoMarquee } from '../elements/logo-marquee.js';
import { mountCardFan } from '../elements/card-fan.js';
import { mountOvalTitle } from '../elements/oval-title.js';
import { mountNotchCard } from '../elements/notch-card.js';
import { mountBigStat } from '../elements/big-stat.js';
import { mountCountdown } from '../elements/countdown.js';
import { mountFloatObject } from '../elements/float-object.js';

const S = window.SITE; const C = S.colors;
const head = (name, use) => `<div class="eg-head"><h2>${name}</h2><code>${use}</code></div>`;
const sec = (cls, name, use, body) => `<section class="eg ${cls}">${head(name, use)}${body}</section>`;
const ph = (n) => `assets/placeholders/photo-${String(n).padStart(2, '0')}.webp`;

document.getElementById('eg').innerHTML = `
<header class="eg-intro"><h1>Circuit<br>elements</h1><p class="t-body" style="margin-top:2rem;max-width:44rem">Every effect from the template on its own. Each file in elements/ exports one mount function. Copy the file and elements/_core.js, then load gsap, ScrollTrigger, SplitText, and Lenis on the page.</p></header>
${sec('dark', 'line-reveal.js', "mountLineReveal(el, { color: '#d2ff00', stagger: 0.1 })", '<h3 class="t-impact is-center" id="e-line">Text that <em>wipes</em> open with a <em>colored</em> block, line by line.</h3>')}
${sec('', 'char-roll.js', "buttonHTML({ label, href }) · linkRollHTML({ label, href }) · mountCharRoll(el)", `<div class="row">${buttonHTML({ label: 'Roll this button' })}${iconButtonHTML({ label: 'Open' })}<span style="font-size:1.875rem">${linkRollHTML({ label: 'Text link' })}</span></div>`)}
${sec('dark', 'scribble.js', "mountScribble(el, { preset: 'signature' | 'word' | 'small', mode: 'view' | 'scrub' })", '<div class="row" style="justify-content:space-between"><div class="box" id="e-s1" style="width:32rem"></div><div class="box" id="e-s2" style="width:34rem"></div><div class="box" id="e-s3" style="width:20rem"></div></div>')}
${sec('', 'topo-stage.js', "mountTopoStage(canvas, { colors }) for contours. Add frameTarget, rowsEl, rows for the hero (see index.html).", '<p class="t-body eg-note">The contour lines behind this page come from this element. Move the page color with stage.setBg([r, g, b]). The pointer reveal and shrinking frame run in the home page hero.</p>')}
${sec('dark', 'mark-loader.js', "mountMarkLoader({ mark, color, label, onOpen }) · mountPageTransition({ mark })", `<div class="row"><button class="btn" id="e-loader" type="button"><span class="t-btn">Replay the loader</span></button><a class="btn" href="elements.html" data-tr><span class="t-btn">Play the page transition</span></a></div>`)}
${sec('', 'menu-overlay.js', "mountMenuOverlay({ menu, button, lenis })", `<button class="btn" id="e-menu-btn" type="button"><span class="t-btn">Open the menu</span></button>`)}
${sec('dark', 'horizontal-gallery.js', "section.innerHTML = galleryHTML(items); mountHorizontalGallery(section, { onProgress })", '')}
<section class="hgal" id="e-gal"><div class="hgal-sticky"><div class="hgal-track">${galleryHTML(S.gallery.items)}</div></div></section>
${sec('full', 'split-panels.js + rise-image.js', "mountSplitPanels(track) · mountRiseImage(section)", `<div class="split-track" id="e-split"><section class="split-sticky"><div class="split-bg"><div class="split-side l"><img src="${S.split.left.image}" alt=""></div><div class="split-side r"><img src="${S.split.right.image}" alt=""></div></div><div class="split-mid"><div class="split-col l"><h2 class="t-impact-reg"><span class="serif" style="display:block">Left</span><span style="display:block">Panel</span></h2></div><div class="split-col r"><h2 class="t-impact-reg"><span class="serif" style="display:block">Right</span><span style="display:block">Panel</span></h2></div></div></section><section class="rise" id="e-rise"><img src="${S.split.rise}" alt=""></section></div>`)}
${sec('black', 'frame-grid.js', "grid.innerHTML = frameGridDefs() + items.map(frameItemHTML); mountFrameGrid(grid)", `${frameGridDefs()}<div class="fgrid" id="e-grid" style="padding:0 0 12rem">${S.projects.items.slice(0, 8).map((i) => frameItemHTML(i)).join('')}</div>`)}
<section class="eg full" id="e-curve-host" style="padding-bottom:8rem">
  <div class="visor" id="e-curve"></div>
  ${head('curved-edge.js + parallax-stack.js', "mountCurvedEdge(el) · mountParallaxStack(root) with data-speed")}
  <div class="stack-demo" id="e-stack" style="margin:0 12rem"><div class="pimg main"><img src="${ph(11)}" alt=""></div><div class="pimg float" data-speed="5"><img src="${ph(12)}" alt=""></div><div class="pimg" data-speed="8" style="left:-8rem;top:30rem;width:18rem;height:18rem"><img src="${ph(13)}" alt=""></div></div>
</section>
${sec('', 'logo-marquee.js', "mountLogoMarquee(el, { items, speed })", '<div id="e-marq"></div>')}
${sec('', 'oval-title.js', "mountOvalTitle(el) with .oval-clip lines", `<h3 class="oval t-title" id="e-oval"><span class="oval-clip"><span class="oval-inner">Opens from</span></span><span class="oval-clip"><span class="oval-inner serif">An ellipse</span></span></h3>`)}
${sec('fan-wrap', 'card-fan.js', "mountCardFan(root) with .fan-card children", `<div class="fan" id="e-fan">${S.socialsBlock.cards.map((c) => `<a class="fan-card" href="#"><img src="${c.image}" alt=""></a>`).join('')}</div>`)}
${sec('', 'notch-card.js', "mountNotchCard(el, { top, bottom, tabW, baseW, r })", '<div id="e-notch" style="height:26rem;background:var(--ink)"></div>')}
${sec('black', 'big-stat.js', "mountBigStat(section) with .big-num and .big-label", '')}
<section class="big-stat" id="e-big" style="background:var(--black)"><div class="big-stat-in"><div class="big-num">48</div><div class="big-label">Things</div></div></section>
${sec('black', 'countdown.js', "mountCountdown(el, '2027-01-15T09:00:00Z')", '<div id="e-count" class="count" style="padding:0;justify-content:flex-start;display:flex;align-items:baseline"></div>')}
${sec('black', 'float-object.js', "mountFloatObject(host, { palette, bands })", '<div id="e-float" style="position:relative;width:18rem;height:18rem"></div>')}
${sec('', 'smooth-scroll.js + scroll-bar.js + nav-theme.js', "mountSmoothScroll() · mountScrollBar() · mountNavTheme()", '<p class="t-body eg-note">Smooth scrolling and the thin bar on the right edge are running on this page. The nav theme element is on the home page, where the nav flips color by section.</p>')}
<div class="menu" id="e-menu" style="z-index:60"><div class="menu-grid"><div class="menu-images">${S.nav.links.map((l) => `<div class="menu-img"><img class="tint" src="${l.image}" alt=""><span class="tint-wash"></span><img class="full" src="${l.image}" alt=""></div>`).join('')}</div><nav class="menu-links">${S.nav.links.map((l) => `<a class="menu-link" href="#" data-close>${l.label}</a>`).join('')}</nav></div></div>
`;

const lenis = mountSmoothScroll();
mountScrollBar();
const stage = mountTopoStage(document.querySelector('.gl'), { colors: C });
stage?.setBg(hexRGB(C.paper));
document.documentElement.dataset.nav = 'light';
document.documentElement.style.setProperty('--gal-text', C.ink);
document.documentElement.style.setProperty('--gal-label', '#535450');

const $ = (id) => document.getElementById(id);
mountLineReveal($('e-line'), { color: C.accentSoft });
mountScribble($('e-s1'), { preset: 'signature' });
mountScribble($('e-s2'), { preset: 'word', width: 30 });
mountScribble($('e-s3'), { preset: 'small' });
$('e-loader').addEventListener('click', () => mountMarkLoader({ mark: S.mark, color: C.accent, label: 'Your name' }));
mountPageTransition({ mark: S.mark });
const menuCtl = mountMenuOverlay({ menu: $('e-menu'), button: $('e-menu-btn'), lenis });
$('e-menu').addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === e.currentTarget) { e.preventDefault(); menuCtl.close(); } });
mountHorizontalGallery($('e-gal'), { colorBlock: C.accent });
mountSplitPanels($('e-split'));
mountRiseImage($('e-rise'));
mountFrameGrid($('e-grid'));
mountCurvedEdge($('e-curve'), { trigger: $('e-curve-host') });
mountParallaxStack($('e-stack'));
mountLogoMarquee($('e-marq'), { items: S.clients.names });
mountOvalTitle($('e-oval'));
mountCardFan($('e-fan'), { start: 'top 90%', end: 'top 45%' });
mountNotchCard($('e-notch'), { top: 24, bottom: 18 });
mountBigStat($('e-big'));
mountCountdown($('e-count'), S.work.countdown.target);
mountFloatObject($('e-float'));
addEventListener('load', () => ScrollTrigger.refresh());
