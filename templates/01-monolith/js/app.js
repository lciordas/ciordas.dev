import * as THREE from 'three';
import { REDUCED, damp, clamp, smooth, lerp, paletteUniforms, tweenPalette, hasWebGL } from '../elements/_util.js';
import { mountStone, stoneSurface, STONE_H } from '../elements/stone.js';
import { mountDuskLandscape } from '../elements/dusk-landscape.js';
import { mountTitleRing } from '../elements/title-ring.js';
import { mountCarouselInput } from '../elements/carousel-input.js';
import { mountMediaPlane } from '../elements/media-plane.js';
import { mountFilmPost } from '../elements/film-post.js';
import { mountCursorSmear } from '../elements/cursor-smear.js';
import { mountRenderWindows } from '../elements/render-windows.js';
import { mountLoaderOutline } from '../elements/loader-outline.js';
import { mountCrackedWord, mountRollLink, mountDrawArrow } from '../elements/ui-links.js';
import { mountLineReveal } from '../elements/line-reveal.js';
import { mountFlipBrand } from '../elements/flip-brand.js';
import { mountSound } from '../elements/sound.js';

const SITE = window.SITE;
const { gsap } = window;
if (REDUCED) gsap.globalTimeline.timeScale(40); // every transition finishes almost at once
const $ = (s) => document.querySelector(s);
const P = SITE.projects, N = P.length;
const mod = (i) => ((i % N) + N) % N;

document.title = SITE.title;
document.querySelector('meta[name=description]').content = SITE.description;

/* ---------- DOM ---------- */
const brand = $('#site-header .brand'), navEl = $('#site-header .nav');
brand.textContent = SITE.name;
const nav = mountCrackedWord(navEl, SITE.navAbout);
const soundBtn = $('#sound-toggle');
const sound = SITE.sound ? mountSound(soundBtn) : (soundBtn.remove(), { tick() {}, crack() {}, shatter() {}, reform() {} });

$('#project-list ol').innerHTML = P.map((p, i) => `<li><a href="#/work/${p.slug}" data-i="${i}"><span class="index">${String(i + 1).padStart(2, '0')}</span><span class="title">${p.name}</span></a></li>`).join('');

const sheet = $('#project-sheet'), sheetP = sheet.querySelector('.description p'), sheetMeta = sheet.querySelector('.meta');
const visit = mountRollLink(sheet.querySelector('.visit'), { label: SITE.visitLabel });
const prevEl = $('#project-prev'), nextEl = $('#project-next');
mountDrawArrow(prevEl, { flipped: true }); mountDrawArrow(nextEl);

// About content
const A = SITE.about;
const about = $('#about-panel'), aboutC = about.querySelector('.content');
const lk = (l) => `<a href="${l.href}" target="_blank" rel="noopener noreferrer">${l.label}</a>`;
aboutC.innerHTML = `
  <div class="bio">
    <p class="lead"><span class="name"><a href="#/">${SITE.name}</a></span>${A.role}</p>
    ${A.paragraphs.map((t) => `<p>${t}</p>`).join('')}
    ${A.facts.map((f) => `<p class="fact">${f.text}${lk(f.link)}${f.and ? ' and ' + lk(f.and) : ''}${f.after}</p>`).join('')}
  </div>
  <section class="awards" aria-label="Awards"><ul>${A.awards.map(([c, l]) => `<li class="mask"><span class="row"><span class="count">${c}</span><span class="label">${l}</span></span></li>`).join('')}</ul></section>
  <nav class="links" aria-label="Links">${A.links.map((l) => `<a class="link" href="${l.href}" target="_blank" rel="noopener"><span class="mask"><span class="row">${l.label}</span></span></a>`).join('')}<button type="button" class="link copy"><span class="mask"><span class="row" aria-live="polite">${A.copyLabel}</span></span></button></nav>`;
const copyBtn = aboutC.querySelector('.copy');
copyBtn.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(A.email); } catch (e) { /* clipboard blocked */ }
  copyBtn.classList.add('is-copied'); copyBtn.querySelector('.row').textContent = A.copiedLabel;
  setTimeout(() => { copyBtn.classList.remove('is-copied'); copyBtn.querySelector('.row').textContent = A.copyLabel; }, 1500);
});

/* ---------- Routes ---------- */
const parseRoute = () => {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === 'about') return { name: 'about' };
  if (h.startsWith('work/')) { const i = P.findIndex((p) => p.slug === h.slice(5)); if (i >= 0) return { name: 'project', index: i }; }
  return { name: 'home' };
};

/* ---------- No WebGL: keep every page readable. ---------- */
const fontsReady = Promise.all([document.fonts.load('400 100px "Archivo Black"'), document.fonts.load('400 14px "Hanken Grotesk"'), document.fonts.load('500 14px "Hanken Grotesk"')]).catch(() => {});

if (!hasWebGL()) {
  document.body.classList.remove('ui-hidden'); document.body.classList.add('no-gl');
  const applyPlain = () => {
    const r = parseRoute();
    document.body.classList.toggle('route-about', r.name === 'about');
    about.classList.toggle('is-active', r.name === 'about'); about.toggleAttribute('inert', r.name !== 'about');
    nav.set(r.name === 'home' ? SITE.navAbout : SITE.navClose);
    navEl.href = r.name === 'home' ? '#/about' : '#/';
    $('#project-list').style.display = r.name === 'about' ? 'none' : '';
    sheet.classList.toggle('is-visible', r.name === 'project'); sheet.toggleAttribute('inert', r.name !== 'project');
    if (r.name === 'project') { const p = P[r.index]; sheetP.textContent = p.description; sheetMeta.innerHTML = [...p.meta, '© ' + p.year].map((m) => `<p>${m}</p>`).join(''); visit.el.href = p.url; }
  };
  addEventListener('hashchange', applyPlain); applyPlain();
  throw new Error('WebGL unavailable: showing the plain layout.');
}

/* ---------- Scene ---------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.autoClear = true;
canvas.setAttribute('data-engine', 'three.js r' + THREE.REVISION);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 500);
const firstPalette = P[0].palette;
const palU = paletteUniforms(firstPalette);

const stone = mountStone(null, { scene, paletteUniforms: palU });
const land = mountDuskLandscape(null, { scene, paletteUniforms: palU, mirrorExtra: [stone.group] });
const plane = mountMediaPlane(null, { scene, paletteUniforms: palU });
// The stone and plane are mirrored together with the landscape.
scene.remove(plane.mesh); stone.group.add(plane.mesh);
const post = mountFilmPost(renderer, {});
const smear = mountCursorSmear(renderer);
// The stone and titles stay sharp in front of the smear, so they are drawn once more as a mask.
const smearKeep = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: true, samples: 4 });
post.setSmear(smear.texture, smearKeep.texture, 0);
const drawSmearKeep = () => {
  const skyV = land.sky.visible, rootV = land.root.visible;
  land.sky.visible = false; land.root.visible = false;
  renderer.setRenderTarget(smearKeep);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  land.sky.visible = skyV; land.root.visible = rootV;
};
let ring = null;

const windows = mountRenderWindows(renderer, {
  drawMode(mode) {
    const skyV = land.sky.visible, rootV = land.root.visible;
    land.sky.visible = false; land.root.visible = false; if (ring) ring.group.visible = false;
    stone.setMode(mode);
    plane.mesh.visible = false;
    renderer.render(scene, camera);
    stone.setMode('beauty');
    plane.mesh.visible = true;
    land.sky.visible = skyV; land.root.visible = rootV; if (ring) ring.group.visible = true;
  },
});

const S = {
  w: 1, h: 1, dpr: 1, time: 0,
  route: parseRoute(),
  phase: 'loading', // loading | windows | dissolve | ready
  index: 0,
  shatter: 0, zoom: 0, sideA: 0, fillA: 0, aboutMix: 0, aboutSpin: 0,
  camX: 0, camY: 0, mx: 0, my: 0, tmx: 0, tmy: 0, ptrX: 0, ptrY: 0, ptrSpeed: 0,
  hover: false, pal: firstPalette, busy: false, projectOpen: false,
  ptrInside: false, lastCrackAt: 0, crackCooldown: 0, lastPos: 0,
};

const stateForRoute = () => S.route;

/* ---------- Layout ---------- */
const camBase = { z: 11.15, y: 2.05, ly: 2.72 };
const camFor = (t = new THREE.Vector3(), look = new THREE.Vector3()) => {
  const aspect = S.w / S.h;
  const k = Math.max(1, Math.pow(1 / aspect, lerp(0.56, 0.85, smooth(0.5, 0.7, aspect))));
  let z = camBase.z * k, y = camBase.y, ly = lerp(camBase.ly, 2.87, smooth(1.05, 0.7, aspect));
  // Dragging pulls the whole scene back.
  const zoom = S.zoom;
  z = lerp(z, z * 1.26, zoom);
  ly = lerp(ly, ly - 0.12, zoom);
  y = lerp(y, y + 0.32, zoom);
  // About: level with the water and further back, so the stone stands on a wide expanse.
  const am = S.aboutMix;
  z = lerp(z, z * 1.095, am);
  y = lerp(y, 2.52, am);
  ly = lerp(ly, 2.58, am);
  t.set(S.camX, y + S.camY, z);
  look.set(S.camX * 0.1, ly, 0);
  return { t, look };
};
const tmpT = new THREE.Vector3(), tmpL = new THREE.Vector3();
const applyCamera = () => {
  camFor(tmpT, tmpL);
  camera.position.copy(tmpT);
  camera.lookAt(tmpL);
  camera.updateMatrixWorld(true);
};

// Silhouette of the stone in screen pixels, used by the loading outline.
const silhouette = () => {
  applyCamera();
  const left = [], right = [];
  const v = new THREE.Vector3();
  const samples = 110;
  for (let side = 0; side < 2; side++) {
    const arr = side ? right : left;
    for (let i = 0; i <= samples; i++) {
      const y01 = i / samples;
      // Bottom to top, scanning the widest point on that latitude.
      const uy = -0.999 + 1.998 * y01;
      const r = Math.sqrt(1 - uy * uy);
      let best = null, bx = side ? -1e9 : 1e9;
      for (let a = 0; a <= 28; a++) {
        const th = (a / 28) * Math.PI * 2;
        const p = stoneSurface(Math.cos(th) * r, uy, Math.sin(th) * r);
        v.set(p[0], p[1], p[2]).project(camera);
        if (side ? v.x > bx : v.x < bx) { bx = v.x; best = [(v.x * 0.5 + 0.5) * S.w, (-v.y * 0.5 + 0.5) * S.h]; }
      }
      arr.push(best);
    }
  }
  return { left, right };
};

const resize = () => {
  S.w = innerWidth; S.h = innerHeight;
  S.dpr = Math.min(devicePixelRatio || 1, S.w < 768 ? 1.5 : 2);
  renderer.setPixelRatio(S.dpr);
  renderer.setSize(S.w, S.h, false);
  camera.aspect = S.w / S.h;
  camera.updateProjectionMatrix();
  post.resize(S.w, S.h, S.dpr);
  smear.resize(S.w, S.h);
  smearKeep.setSize(Math.max(2, Math.floor(S.w * S.dpr / 2)), Math.max(2, Math.floor(S.h * S.dpr / 2)));
  land.resize(S.w * S.dpr, S.h * S.dpr);
  windows.layout(S.w, S.h, S.dpr);
  loader?.layout();
  layoutRing();
};
const layoutRing = () => {
  const portrait = S.w / S.h < 0.8;
  stone.ring.rx = portrait ? 2.75 : 4.25; stone.ring.ry = portrait ? 4.9 : 2.8;
  stone.ring.center.y = portrait ? 3.7 : 3.2;
  stone.ring.scale = portrait ? 0.74 : 1;
  stone.assignSlots();
  plane.mesh.scale.setScalar(portrait ? 0.5 : 1);
  plane.setBaseY(portrait ? 4.35 : 3.35);
  
};

/* ---------- Intro ---------- */
let loader = null;
const showUI = () => { document.body.classList.remove('ui-hidden'); document.body.classList.add('ui-in'); };
const finishIntro = () => {
  S.phase = 'ready';
  post.uniforms.uDissolve.value = 1;
  loader?.destroy(); loader = null;
};
const runIntro = () => {
  const route = S.route;
  if (!SITE.intro || REDUCED) {
    showUI(); S.sideA = 1; S.fillA = 1; finishIntro(); applyRoute(route, true); return;
  }
  loader = mountLoaderOutline(document.body, { points: silhouette });
  const d = { p: 0.02 };
  const tl = gsap.timeline();
  // Stand on the title before the first project so the ring can sweep in.
  input.set(-1, true);
  // Outline climbs for 3.4 seconds.
  tl.to(d, { p: 1, duration: 3.3, ease: 'power1.inOut', onUpdate: () => loader?.set(d.p) });
  tl.add(() => { S.phase = 'windows'; S.windowsAt = S.time; sound.tick(); });
  tl.to({}, { duration: 2.05 });
  tl.add(() => {
    S.phase = 'dissolve'; loader?.hide();
    sound.crack();
  });
  tl.fromTo(post.uniforms.uDissolve, { value: 0 }, { value: 1, duration: 1.05, ease: 'none' });
  tl.add(() => { S.sideA = 1; }, '-=0.95');
  tl.to(S, { fillA: 1, duration: 0.5, ease: 'power2.out' }, '-=0.8');
  tl.add(() => { showUI(); input.state.goal = 0; input.state.index = 0; S.index = 0; }, '-=0.55');
  tl.add(() => { finishIntro(); applyRoute(S.route, true); });
};

/* ---------- Transitions ---------- */
let sheetReveal = null, aboutReveal = null;
const fillSheet = (p, showNow = true) => {
  sheetReveal?.destroy();
  sheetP.textContent = p.description;
  sheetMeta.innerHTML = [...p.meta, '© ' + p.year].map((m) => `<p>${m}</p>`).join('');
  visit.el.href = p.url;
  sheetReveal = mountLineReveal([sheetP, ...sheetMeta.querySelectorAll('p')], { duration: 0.95, stagger: 0.045, delay: 0.25 });
  if (showNow) sheetReveal.in();
};
const setProjectUI = (i) => {
  const p = P[i];
  prevEl.href = `#/work/${P[mod(i - 1)].slug}`;
  nextEl.href = `#/work/${P[mod(i + 1)].slug}`;
  sheet.setAttribute('aria-label', p.name + ' project details');
};
const showProjectChrome = (on) => {
  sheet.classList.toggle('is-visible', on); sheet.toggleAttribute('inert', !on); sheet.setAttribute('aria-hidden', on ? 'false' : 'true');
  [prevEl, nextEl].forEach((el) => { el.classList.toggle('is-visible', on); el.tabIndex = on ? 0 : -1; el.setAttribute('aria-hidden', on ? 'false' : 'true'); });
};
const setNav = (word, href) => { nav.set(word); navEl.href = href; };
let timeline = null;
const tl = () => { timeline?.kill(); timeline = gsap.timeline(); return timeline; };

const openProject = (i, instant) => {
  S.index = i; S.projectOpen = true;
  S.pal = P[i].palette;
  input.set(nearestWrap(i), instant);
  plane.setProject(i, P[i].media);
  setProjectUI(i);
  fillSheet(P[i], true);
  showProjectChrome(true);
  setNav(SITE.navClose, '#/');
  stone.assignSlots();
  stone.state.hitActive = -1;
  if (instant || REDUCED) {
    timeline?.kill(); S.aboutMix = 0; about.classList.remove('is-active');
    S.shatter = 1; S.sideA = 0; S.fillA = 1; plane.uniforms.uFade.value = 1; plane.uniforms.uOpen.value = 1; stone.uniforms.uMatte.value = 1; stone.uniforms.uCrackAll.value = 0;
    return;
  }
  sound.crack();
  const t = tl();
  // Arriving from the about view: the stone returns to centre on the way.
  t.to(S, { aboutMix: 0, duration: 0.7, ease: 'power3.inOut' }, 0);
  t.add(() => about.classList.remove('is-active'), 0.6);
  // Cracks run over the whole stone and glow, then it bursts.
  t.to(S, { sideA: 0, fillA: 1, duration: 0.45, ease: 'power2.out' }, 0);
  t.to(stone.uniforms.uCrackAll, { value: 1, duration: 0.42, ease: 'power2.in' }, 0.02);
  t.to(stone.uniforms.uCrackGlow, { value: 1, duration: 0.48, ease: 'power2.in' }, 0.1);
  t.add(() => { sound.shatter(); stone.throwChips(70, 3); }, 0.72);
  t.set(stone.uniforms.uCrackAll, { value: 0 }, 0.86);
  t.set(stone.uniforms.uCrackGlow, { value: 0 }, 0.86);
  t.to(stone.uniforms.uMatte, { value: 1, duration: 0.3, ease: 'none' }, 0.7);
  t.to(S, { shatter: 1, duration: 1.15, ease: 'power2.out' }, 0.7);
  t.fromTo(plane.uniforms.uFade, { value: 0 }, { value: 1, duration: 0.25, ease: 'none' }, 0.82);
  t.fromTo(plane.uniforms.uOpen, { value: 0 }, { value: 1, duration: 0.95, ease: 'expo.out' }, 0.95);
};

const switchProject = (i, direction) => {
  // The screen fades, pieces swirl to new places and the next one arrives.
  S.index = i; S.pal = P[i].palette;
  setProjectUI(i);
  sound.tick(); sound.reform();
  sheetReveal?.out({ onComplete: () => fillSheet(P[i], true) });
  stone.assignSlots((i + 1) * 0.37, false);
  const t = tl();
  t.to(plane.uniforms.uFade, { value: 0, duration: 0.2, ease: 'none' }, 0);
  t.to(S, { fillA: 0.0, duration: 0.14, ease: 'none' }, 0);
  t.add(() => { input.set(nearestWrap(i) - direction * 0.25, true); input.state.goal = nearestWrap(i); input.state.index = nearestWrap(i); }, 0.16);
  t.to(S, { fillA: 1, duration: 0.3, ease: 'power2.out' }, 0.2);
  t.add(() => { plane.setProject(i, P[i].media); plane.uniforms.uOpen.value = 0; }, 0.28);
  t.to(plane.uniforms.uFade, { value: 1, duration: 0.3, ease: 'none' }, 0.5);
  t.to(plane.uniforms.uOpen, { value: 1, duration: 0.8, ease: 'expo.out' }, 0.5);
};

const closeProject = () => {
  S.projectOpen = false;
  showProjectChrome(false);
  sheetReveal?.reset();
  setNav(SITE.navAbout, '#/about');
  const t = tl();
  sound.reform();
  t.to(plane.uniforms.uOpen, { value: 0, duration: 0.5, ease: 'power3.inOut' }, 0);
  t.to(plane.uniforms.uFade, { value: 0, duration: 0.25, ease: 'none' }, 0.42);
  t.to(S, { shatter: 0, duration: 1.0, ease: 'power3.inOut' }, 0.08);
  t.to(stone.uniforms.uMatte, { value: 0, duration: 0.45, ease: 'none' }, 0.55);
  t.add(() => { stone.throwChips(36, 1.5); stone.crackBurst(null, 0.3); }, 0.92);
  t.to(S, { sideA: 1, duration: 0.6, ease: 'power2.out' }, 0.8);
};

const brandFlip = mountFlipBrand(brand, { duration: 1.2, ease: 'expo.inOut' });
const aboutTargets = () => {
  const lines = aboutC.querySelectorAll('.bio p');
  return [...lines];
};
const openAbout = (instant) => {
  S.projectOpen = false;
  S.pal = SITE.aboutPalette;
  setNav(SITE.navClose, '#/');
  showProjectChrome(false);
  about.classList.add('is-active');
  about.removeAttribute('inert'); about.setAttribute('aria-hidden', 'false');
  if (!aboutReveal) aboutReveal = mountLineReveal(aboutTargets(), { duration: 1.1, stagger: 0.06 });
  const rows = aboutC.querySelectorAll('.awards .row, .links .row');
  const name = aboutC.querySelector('.name');
  if (instant || REDUCED) {
    S.aboutMix = 1; S.sideA = 0; S.fillA = 0; S.shatter = 0; stone.uniforms.uMatte.value = 0; plane.uniforms.uFade.value = 0;
    gsap.set(aboutReveal.lines, { yPercent: 0 }); gsap.set(rows, { yPercent: 0 });
    document.body.classList.add('brand-flipped'); about.classList.add('is-live');
    return;
  }
  aboutReveal.reset();
  gsap.set(rows, { yPercent: 110 });
  const t = tl();
  const rebuilding = S.shatter > 0.01;
  if (rebuilding) { t.to(S, { shatter: 0, duration: 0.8, ease: 'power3.inOut' }, 0); t.to(plane.uniforms.uFade, { value: 0, duration: 0.3 }, 0); t.to(stone.uniforms.uMatte, { value: 0, duration: 0.4 }, 0.3); }
  t.to(S, { fillA: 0, sideA: 0, duration: 0.42, ease: 'power2.out' }, 0);
  t.to(S, { aboutMix: 1, duration: 1.5, ease: 'expo.inOut' }, 0);
  t.to(S, { aboutSpin: S.aboutSpin + Math.PI * 4, duration: 1.8, ease: 'expo.inOut' }, 0);
  t.add(() => brandFlip.to(name), 0.05);
  t.add(() => { aboutReveal.in(); }, 0.32);
  t.to(rows, { yPercent: 0, duration: 1.0, stagger: 0.04, ease: 'expo.out' }, 0.62);
  t.add(() => {
    document.body.classList.add('brand-flipped'); brandFlip.snap();
    about.classList.add('is-live');
  }, 1.28);
};
const closeAbout = () => {
  about.classList.remove('is-live');
  about.setAttribute('inert', ''); about.setAttribute('aria-hidden', 'true');
  setNav(SITE.navAbout, '#/about');
  S.pal = P[S.index].palette;
  const name = aboutC.querySelector('.name');
  const rows = aboutC.querySelectorAll('.awards .row, .links .row');
  const t = tl();
  // The name flies home from where it sits in the paragraph.
  const a = name.getBoundingClientRect();
  document.body.classList.remove('brand-flipped');
  gsap.set(brand, { x: 0, y: 0, scale: 1 });
  const b = brand.getBoundingClientRect();
  gsap.set(brand, { x: a.left - b.left, y: a.top - b.top, scale: a.height / b.height, transformOrigin: '0 0' });
  t.add(() => brandFlip.home(), 0);
  aboutReveal?.out();
  t.to(rows, { yPercent: -110, duration: 0.42, stagger: 0.01, ease: 'power3.in' }, 0);
  t.to(S, { aboutMix: 0, duration: 1.3, ease: 'expo.inOut' }, 0);
  t.to(S, { aboutSpin: S.aboutSpin - Math.PI * 2, duration: 1.45, ease: 'expo.inOut' }, 0);
  t.to(S, { fillA: 1, sideA: 1, duration: 0.7, ease: 'power2.out' }, 0.75);
  t.add(() => about.classList.remove('is-active'), 0.75);
};

const nearestWrap = (i) => {
  const cur = input.state.goal;
  const base = Math.round((cur - i) / N) * N + i;
  return base;
};

let currentRoute = null;
const applyRoute = (r, instant) => {
  const prev = currentRoute;
  currentRoute = r;
  S.route = r;
  document.querySelectorAll('#project-list a').forEach((a) => a.toggleAttribute('aria-current', r.name === 'project' && +a.dataset.i === r.index));
  if (S.phase !== 'ready') return;
  if (r.name === 'about') {
    if (prev?.name !== 'about') openAbout(instant);
  } else if (r.name === 'project') {
    if (prev?.name === 'about') closeAbout();
    if (prev?.name === 'project' && S.projectOpen) {
      if (prev.index !== r.index) {
        const dir = ((r.index - prev.index + N) % N) === 1 ? 1 : -1;
        switchProject(r.index, dir);
      }
    } else openProject(r.index, instant);
  } else {
    if (prev?.name === 'about') closeAbout();
    else if (prev?.name === 'project') closeProject();
    else { S.pal = P[S.index].palette; S.sideA = 1; S.fillA = 1; setNav(SITE.navAbout, '#/about'); }
  }
};
addEventListener('hashchange', () => applyRoute(parseRoute(), false));

/* ---------- Input ---------- */
const canInteract = () => S.phase === 'ready' && S.route.name === 'home';
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
const hitStone = () => { raycaster.setFromCamera(ndc, camera); return stone.pointerRay(raycaster.ray.origin, raycaster.ray.direction); };

const input = mountCarouselInput(canvas, {
  count: N,
  enabled: canInteract,
  onStep(i) {
    if (S.phase !== 'ready') return;
    S.index = i; S.pal = P[i].palette;
    sound.tick();
    if (S.route.name === 'home') { stone.addEnergy(0.6); }
  },
  onMove(kind) {
    if (S.time - S.lastCrackAt > 0.55) { S.lastCrackAt = S.time; stone.crackBurst(); stone.addEnergy(0.5); sound.crack(); }
  },
  onDragStart() { document.body.classList.add('is-dragging'); gsap.to(S, { zoom: 1, duration: 0.8, ease: 'expo.out', overwrite: 'auto' }); },
  onDragEnd() { document.body.classList.remove('is-dragging'); gsap.to(S, { zoom: 0, duration: 1.25, ease: 'power3.inOut', overwrite: 'auto' }); },
  onTap(e) {
    if (!canInteract()) return;
    ndc.set((e.clientX / S.w) * 2 - 1, -(e.clientY / S.h) * 2 + 1);
    if (ring?.hitFront(ndc, camera) || hitStone()) location.hash = `#/work/${P[S.index].slug}`;
  },
});
addEventListener('pointermove', (e) => {
  ndc.set((e.clientX / S.w) * 2 - 1, -(e.clientY / S.h) * 2 + 1);
  S.tmx = ndc.x; S.tmy = ndc.y; S.ptrInside = e.pointerType !== 'touch';
  if (e.pointerType !== 'touch') smear.move(e.clientX / S.w, 1 - e.clientY / S.h);
});
document.addEventListener('pointerleave', () => { S.ptrInside = false; smear.leave(); });
// Project view: scrolling or clicking anywhere outside the screen goes back home.
canvas.addEventListener('wheel', (e) => {
  if (S.route.name !== 'project' || S.phase !== 'ready') return;
  e.preventDefault();
  if (Math.abs(e.deltaY) >= 30 && plane.uniforms.uOpen.value > 0.6) location.hash = '#/';
}, { passive: false });
let downX = 0, downY = 0;
canvas.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
canvas.addEventListener('click', (e) => {
  if (S.route.name !== 'project' || S.phase !== 'ready' || plane.uniforms.uOpen.value < 0.6) return;
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
  ndc.set((e.clientX / S.w) * 2 - 1, -(e.clientY / S.h) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  raycaster.layers.enable(1);
  if (!raycaster.intersectObject(plane.mesh, false).length) location.hash = '#/';
});
addEventListener('keydown', (e) => {
  if (S.route.name === 'project') {
    if (e.key === 'ArrowRight') location.hash = `#/work/${P[mod(S.route.index + 1)].slug}`;
    if (e.key === 'ArrowLeft') location.hash = `#/work/${P[mod(S.route.index - 1)].slug}`;
    if (e.key === 'Escape') location.hash = '#/';
  } else if (S.route.name === 'about' && e.key === 'Escape') location.hash = '#/';
});
document.querySelectorAll('#project-list a').forEach((a) => a.addEventListener('focus', () => {
  if (canInteract()) { const i = +a.dataset.i; const g = nearestWrap(i); input.state.goal = g; input.state.index = g; }
}));

/* ---------- Frame ---------- */
const clock = new THREE.Clock();
let frames = 0, fpsT = 0;
const frame = () => {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  S.time += dt;
  const t = S.time;
  frames++; fpsT += dt; if (fpsT > 1) { window.__fps = frames / fpsT; frames = 0; fpsT = 0; }

  // Pointer parallax
  S.mx = damp(S.mx, S.tmx, 2.6, dt); S.my = damp(S.my, S.tmy, 2.6, dt);
  S.camX = S.mx * 0.34; S.camY = S.my * 0.11;

  const pos = input.update(dt);
  const vel = input.state.vel;
  tweenPalette(palU, S.pal, 4.2, dt);

  // Stone placement. Half a turn per project so its wide face returns each time.
  const am = S.aboutMix;
  const portrait = S.w / S.h < 0.8;
  stone.group.position.x = lerp(0, portrait ? 7.5 : 2.62, am);
  stone.group.position.y = lerp(0, 0, am);
  land.setFlood(am);
  stone.pivot.rotation.y = pos * Math.PI + S.aboutSpin + S.mx * 0.05;
  stone.uniforms.uSeedShift.value = pos * 0.91;
  if (Math.abs(vel) > 0.3) stone.addEnergy(dt * 2);

  // Pointer on the stone
  applyCamera();
  const moving = Math.abs(input.state.goal - pos) > 0.015 || Math.abs(vel) > 0.04;
  if (moving) S.quietAt = t + 0.5;
  const canHover = S.phase === 'ready' && S.ptrInside && S.shatter < 0.01 && (S.route.name === 'home' || S.route.name === 'about') && !input.state.dragging && t > (S.quietAt || 0);
  let over = false;
  if (canHover) { raycaster.setFromCamera(ndc, camera); over = stone.pointerRay(raycaster.ray.origin, raycaster.ray.direction); }
  if (!over) stone.clearPointer();
  if (S.route.name === 'about') { stone.clearPointer(); }
  stone.setHot(over ? (S.route.name === 'about' ? 1 : 0.55) : 0, S.route.name === 'about' ? 0.46 : 0.34);
  // A resting pointer leaves a narrow split. Moving it pulls the plates wide apart.
  const ptrStep = Math.hypot(ndc.x - S.ptrX, ndc.y - S.ptrY) / Math.max(dt, 1e-3);
  S.ptrX = ndc.x; S.ptrY = ndc.y;
  S.ptrSpeed = damp(S.ptrSpeed, ptrStep, ptrStep > S.ptrSpeed ? 16 : 3, dt);
  stone.setPlates(over && S.route.name === 'home' ? 0.13 + 0.87 * clamp(S.ptrSpeed / 1.15) : 0);

  stone.update(dt, t, { shatter: S.shatter, parallaxX: S.mx * 0.7, parallaxY: S.my * 0.45 });
  land.update(dt, t);
  plane.update(dt, t, S.mx, S.my);
  plane.mesh.visible = plane.uniforms.uFade.value > 0.002;

  if (ring) {
    ring.update(dt, t, pos, vel);
    ring.setFlatten(S.zoom);
    const tall = smooth(1.05, 0.56, S.w / S.h);
    ring.shared.uY.value = lerp(lerp(0.5, -0.9, tall), lerp(-0.42, -1.3, tall), S.zoom);
    ring.shared.uScale.value = lerp(1, 0.8, tall) * lerp(1, 0.56, S.zoom);
    ring.shared.uArcScale.value = lerp(1, 0.66, S.zoom);
    ring.shared.uFillMul.value = lerp(1, 2.5, S.zoom);
    // Phones drop the big title on project pages, the description takes over.
    ring.setAlpha(S.fillA * (S.w < 768 ? 1 - clamp(S.shatter * 2) : 1), 0.62 * S.sideA);
    ring.group.visible = S.fillA > 0.002 || S.sideA > 0.002;
  }

  if (S.phase === 'loading') {
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x050404, 1);
    renderer.clear();
    return;
  }
  // Beauty
  land.renderMirror(renderer, scene, camera);
  renderer.setRenderTarget(post.main);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(scene, camera);
  post.bloomPass();
  const smearOn = S.phase === 'ready';
  if (smearOn) smear.update(dt); else smear.leave();
  post.uniforms.tSmear.value = smear.texture;
  post.uniforms.uSmearTint.value.copy(palU.p_haze.value);
  post.uniforms.uSmear.value = smearOn && smear.energy > 0 ? 1 : 0;
  if (post.uniforms.uSmear.value) drawSmearKeep();
  if (S.phase === 'windows' || S.phase === 'dissolve') {
    // Panels look into the same camera, so the stone lines up across all of them.
    windows.render(t - (S.windowsAt ?? t), post.stage, post.main.texture);
    post.uniforms.uDissolve.value = S.phase === 'windows' ? 0 : post.uniforms.uDissolve.value;
  }
  post.present(t);
};

/* ---------- Boot ---------- */
fontsReady.then(() => {
  ring = mountTitleRing(null, { scene, titles: P.map((p) => p.title) });
  resize();
  addEventListener('resize', resize);
  // Mark the input's starting position on the first project.
  input.set(0, true);
  S.index = 0;
  frame();
  runIntro();
});
window.__monolith = { S, stone, input, post, smear };
