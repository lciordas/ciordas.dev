import * as THREE from 'three';
import { Post } from '../lib/post.js';
import { hexToLinear } from '../lib/glsl.js';
import { clamp, damp, lerp, smooth, monotone } from '../lib/math.js';
import { createTerrain } from '../lib/terrain.js';
import { createDome } from '../lib/dome.js';
import { createCrystal, LAYER_BACK } from '../lib/crystal.js';
import { createRingSet } from '../lib/rings.js';
import { createPlatform } from '../lib/platform.js';
import { createParticleForm, stoneShape, textShape } from '../lib/particles.js';
import { createSky, createSnow, createAmbientText, createWireField } from '../lib/atmosphere.js';
import { scramble, bracket } from '../lib/ui.js';
import { createSound } from '../lib/audio.js';
import { createInertia } from '../lib/inertia.js';
import { buildTimeline } from './timeline.js';

const SITE = window.SITE;
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(pointer: coarse)').matches;

document.title = SITE.title;
document.querySelector('meta[name=description]')?.setAttribute('content', SITE.description);

/* ---------- Fallback content used by screen readers and browsers without WebGL ---------- */
function buildIndex() {
  const nav = $('#index');
  const h = document.createElement('h1'); h.textContent = SITE.owner; nav.appendChild(h);
  const m = document.createElement('p'); m.textContent = SITE.manifesto; nav.appendChild(m);
  const list = document.createElement('ul');
  SITE.projects.forEach((p, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button'); b.type = 'button'; b.textContent = p.name;
    b.addEventListener('click', () => window.__expedition?.openProject ? window.__expedition.openProject(i) : (li.querySelector('div').hidden = !li.querySelector('div').hidden));
    const d = document.createElement('div'); d.hidden = true;
    p.summary.forEach((s) => { const x = document.createElement('p'); x.textContent = s; d.appendChild(x); });
    [...p.discover, p.visit].forEach((l) => { const a = document.createElement('a'); a.href = l.url; a.textContent = l.label; a.rel = 'noopener'; d.appendChild(a); d.appendChild(document.createTextNode(' ')); });
    li.append(b, d); list.appendChild(li);
  });
  nav.appendChild(list);
  const links = document.createElement('p');
  SITE.links.forEach((l) => { const a = document.createElement('a'); a.href = l.url; a.textContent = l.label; a.rel = 'noopener'; links.appendChild(a); links.appendChild(document.createTextNode(' ')); });
  nav.appendChild(links);
}
buildIndex();

function webglOk() {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch { return false; }
}
if (!webglOk() || params.has('nogl')) {
  document.body.classList.add('no-webgl');
  $('#loader').hidden = true;
  throw new Error('WebGL2 not available; showing text version.');
}

/* ---------- Renderer ---------- */
THREE.ColorManagement.enabled = false;
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.autoClear = true;
renderer.setClearColor(0x000000, 1);
let dpr = Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 1.75);

const col = (hex) => new THREE.Color(...hexToLinear(hex));
const C = SITE.colors;
const G = {
  uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uCut: { value: -1 },
  uFog: { value: col(C.fog) }, uFogLight: { value: col(C.fogLight) }, uPxScale: { value: 1 },
};
const GP = { ...G, uCut: { value: -1 } }; // platform keeps its own wipe

const post = new Post(renderer, { levels: 6, samples: 4, panel: hexToLinear(C.panel) });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, .5, 6000);
camera.layers.enable(LAYER_BACK);

const nCrystals = Math.max(1, SITE.projects.length - 1);
const TL = buildTimeline(nCrystals);
const TOTAL = TL.total;
const NN = (n) => TL.sN(n); // shifted notch for anything after the crystals

const sky = createSky({ G }); scene.add(sky.mesh);
const ambient = createAmbientText({ G, words: SITE.ambientText });
const snow = createSnow({ G, count: TOUCH ? 300 : 650 }); scene.add(snow.points);

const campGroup = new THREE.Group(); scene.add(campGroup);
const terrain = createTerrain({ G, radial: TOUCH ? 240 : 340, spokes: TOUCH ? 400 : 620 }); campGroup.add(terrain.mesh);
const dome = createDome({ G }); campGroup.add(dome.group);
terrain.uniforms.uDoorPos.value.copy(dome.doorWorld);
const wires = createWireField({ G }); campGroup.add(wires.lines);

const crystals = TL.crystals.map((c, i) => {
  const k = createCrystal({ G, tBack: post.back.texture, seed: i + 1, kind: i % 2 ? 'mark' : 'stones', mark: SITE.projects[i].mark });
  k.group.position.set(0, c.y, c.z); scene.add(k.group);
  return { ...k, y: c.y, n: c.n, project: i };
});

const ringSet = createRingSet({ G, ys: TL.ringYs });
ringSet.group.position.set(TL.ringPos[0], 0, TL.ringPos[2]);
scene.add(ringSet.group);

const platformGroup = new THREE.Group(); platformGroup.position.set(0, TL.platformY, 60); scene.add(platformGroup);
const platform = createPlatform({ G: GP }); platformGroup.add(platform.group);

scene.add(ambient.mesh);

/* ---------- Particle form ---------- */
let form;
const FORM_SIZE = TOUCH ? .3 : .28;
async function buildForm() {
  try { await Promise.all([document.fonts.load('900 300px "Archivo Black"'), document.fonts.load('500 40px "IBM Plex Mono"')]); } catch {}
  const count = TOUCH ? 14000 : 42000;
  const shapes = SITE.links.map((l, i) => (l.mark ? textShape(l.mark, count, 30 + i) : stoneShape(count, 4 + i)));
  form = createParticleForm({ G, count, shapes });
  form.uniforms.uSize.value = FORM_SIZE;
  form.points.position.y = 1.9;
  platformGroup.add(form.points);
}

/* ---------- DOM ---------- */
$('#logo').textContent = SITE.logo;
const hud = {
  copyright: $('#hud-copyright'), owner: $('#hud-owner'), mfLabel: $('#hud-mf-label'), mf: $('#hud-mf'), hint: $('#hud-hint'), top: $('#hud-top'), tr: $('#hud-tr'),
  soundBtn: $('#sound'), soundText: $('#sound-text'), lines: $('#lines'), panel: $('#panel'), panelBody: $('#panel-body'), close: $('#panel-close'),
  callouts: $('#callouts'), carousel: $('#carousel'), cLabel: $('#car-label'), cPrev: $('#car-prev'), cNext: $('#car-next'), aL: $('#arrow-l'), aR: $('#arrow-r'), cMid: $('#car-mid'),
};
bracket(hud.close); bracket(hud.cMid);
const TEXT = {
  copyright: SITE.copyright, owner: `${SITE.owner}\n${SITE.rights}`, mfLabel: SITE.manifestoLabel, mf: SITE.manifesto, hint: SITE.scrollHint,
};
const sound = createSound();
const setSoundUi = () => { hud.soundText.textContent = `${SITE.soundLabel} ${sound.enabled ? SITE.soundOn : SITE.soundOff}`; hud.soundBtn.classList.toggle('on', sound.enabled); hud.soundBtn.setAttribute('aria-pressed', sound.enabled); };
setSoundUi();
hud.soundBtn.addEventListener('click', (e) => { e.stopPropagation(); sound.toggle(); setSoundUi(); sound.blip(1320, .05, .05); });
hud.close.querySelector('span').textContent = SITE.closeLabel;

let heroShown = false, hintShown = false;
function showHero(on) {
  if (on === heroShown) return; heroShown = on;
  const d = on ? { duration: .9 } : { duration: .4, hide: true, trail: 4 };
  scramble(hud.copyright, TEXT.copyright, d);
  scramble(hud.owner, TEXT.owner, { ...d, delay: on ? .12 : 0 });
  scramble(hud.mfLabel, TEXT.mfLabel, { ...d, delay: on ? .1 : 0 });
  scramble(hud.mf, TEXT.mf, { ...d, duration: on ? 1.4 : .45, delay: on ? .22 : 0, onTick: on ? (() => { if (Math.random() < .12) sound.blip(1500 + Math.random() * 500, .018, .012); }) : undefined });
}
function showHint(on) {
  if (on === hintShown) return; hintShown = on;
  scramble(hud.hint, TEXT.hint, on ? { duration: .7 } : { duration: .35, hide: true, trail: 3 });
}

/* Callouts */
const callouts = [];
function makeCallouts() {
  SITE.projects.forEach((p, i) => {
    const mk = (cls, html) => { const d = document.createElement('div'); d.className = 'callout ' + cls; d.innerHTML = html; hud.callouts.appendChild(d); return d; };
    const title = mk('c-title', '<b data-t></b><b data-t></b>');
    const meta = mk('c-meta', '<span data-t></span><span data-t></span><span data-t></span>');
    const date = mk('c-date', '<span data-t></span><b data-t></b>');
    callouts.push({ title, meta, date, shown: false, values: [[title, [p.code, p.name]], [meta, [p.metaLabel, ...p.metaValues]], [date, [p.date, p.cta]]] });
  });
}
makeCallouts();
function setCallouts(i, on) {
  const c = callouts[i]; if (!c || c.shown === on) return; c.shown = on;
  c.values.forEach(([el, texts]) => {
    el.classList.toggle('on', on);
    el.querySelectorAll('[data-t]').forEach((n, k) => scramble(n, texts[k], on ? { duration: .55, delay: k * .08 } : { duration: .22, hide: true, trail: 3 }));
  });
}

/* Detail panel */
let panelOpen = false, panelProject = -1;
const panelEls = [];
function fillPanel(p) {
  hud.panelBody.innerHTML = ''; panelEls.length = 0;
  const line = (cls, text, tag = 'div') => { const d = document.createElement(tag); d.className = cls; hud.panelBody.appendChild(d); panelEls.push([d, text]); return d; };
  line('p-label', p.summaryLabel);
  p.summary.forEach((s) => line('p-text', s, 'p'));
  line('p-label sp', p.discoverLabel);
  const row = document.createElement('div'); row.className = 'p-links'; hud.panelBody.appendChild(row);
  p.discover.forEach((l) => { const a = document.createElement('a'); a.href = l.url; a.target = '_blank'; a.rel = 'noopener'; a.className = 'p-link'; const s = document.createElement('span'); a.appendChild(s); row.appendChild(a); panelEls.push([s, `${l.label} ↗`]); });
  line('p-label sp', p.visitLabel);
  const row2 = document.createElement('div'); row2.className = 'p-links'; hud.panelBody.appendChild(row2);
  const a = document.createElement('a'); a.href = p.visit.url; a.target = '_blank'; a.rel = 'noopener'; a.className = 'p-link'; const s = document.createElement('span'); a.appendChild(s); row2.appendChild(a); panelEls.push([s, `${p.visit.label} ↗`]);
}
const fx = { burst: 0, dark: 0 };
function openProject(i, jump = true) {
  if (panelOpen || !started) return;
  panelOpen = true; panelProject = i; scroll.locked = true;
  if (jump) goToProject(i);
  fillPanel(SITE.projects[i]);
  sound.whoosh(.25, .8); sound.blip(420, .12, .05, 'triangle');
  gsap.killTweensOf(fx);
  if (REDUCED) { fx.dark = 1; fx.burst = 0; }
  else gsap.timeline()
    .to(fx, { burst: 1, duration: .32, ease: 'power2.in' })
    .to(fx, { burst: 0, duration: .55, ease: 'power2.out' }, .32)
    .to(fx, { dark: 1, duration: .55, ease: 'power2.inOut' }, .22);
  hud.panel.hidden = false; hud.panel.setAttribute('aria-hidden', 'false');
  document.body.classList.add('panel-open');
  let t = REDUCED ? 0 : .62;
  panelEls.forEach(([el, text]) => {
    const long = text.length > 60;
    scramble(el, text, { duration: long ? Math.min(1.3, text.length / 330) : .32, delay: t, trail: long ? 24 : 6 });
    t += long ? .16 : .1;
  });
  gsap.fromTo(hud.close, { opacity: 0 }, { opacity: 1, duration: .35, delay: REDUCED ? 0 : .55 });
  setTimeout(() => hud.close.focus({ preventScroll: true }), 700);
}
function closePanel() {
  if (!panelOpen) return;
  panelOpen = false; sound.whoosh(.14, .5); sound.blip(660, .06, .04, 'triangle');
  gsap.killTweensOf(fx);
  if (REDUCED) fx.dark = 0;
  else gsap.timeline().to(fx, { burst: .55, duration: .16 }).to(fx, { burst: 0, duration: .4 }, .16).to(fx, { dark: 0, duration: .55, ease: 'power2.inOut' }, .05);
  panelEls.forEach(([el, text]) => scramble(el, text, { duration: .24, hide: true, trail: 4 }));
  gsap.to(hud.close, { opacity: 0, duration: .2 });
  document.body.classList.remove('panel-open');
  setTimeout(() => { if (!panelOpen) { hud.panel.hidden = true; hud.panel.setAttribute('aria-hidden', 'true'); } }, 520);
  scroll.locked = false;
}
hud.close.addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
hud.panel.addEventListener('wheel', (e) => { /* the panel scrolls itself when text is long */ if (hud.panelBody.scrollHeight <= hud.panelBody.clientHeight) e.preventDefault(); }, { passive: false });

/* Link carousel */
let linkIndex = 0;
function setLink(i, animate = true) {
  const n = SITE.links.length; linkIndex = (i + n) % n;
  const l = SITE.links[linkIndex];
  hud.cLabel.textContent = '';
  scramble(hud.cLabel, l.label, { duration: animate ? .4 : .01 });
  hud.cPrev.textContent = SITE.links[(linkIndex - 1 + n) % n].label;
  hud.cNext.textContent = SITE.links[(linkIndex + 1) % n].label;
  hud.cMid.href = l.url;
  if (animate && form) { form.morphTo(linkIndex, G.uTime.value); sound.whoosh(.16, .9); sound.blip(780, .05, .04); }
}
hud.aL.addEventListener('click', (e) => { e.stopPropagation(); setLink(linkIndex - 1); });
hud.aR.addEventListener('click', (e) => { e.stopPropagation(); setLink(linkIndex + 1); });
hud.cPrev.addEventListener('click', (e) => { e.stopPropagation(); setLink(linkIndex - 1); });
hud.cNext.addEventListener('click', (e) => { e.stopPropagation(); setLink(linkIndex + 1); });
let flowGoal = 0;
hud.cMid.addEventListener('pointerenter', () => { flowGoal = 1; sound.blip(1200, .03, .025); });
hud.cMid.addEventListener('pointerleave', () => { flowGoal = 0; });
hud.cMid.addEventListener('focus', () => { flowGoal = 1; });
hud.cMid.addEventListener('blur', () => { flowGoal = 0; });
hud.cMid.addEventListener('click', (e) => e.stopPropagation());
[hud.aL, hud.aR, hud.cPrev, hud.cNext].forEach((el) => el.addEventListener('pointerenter', () => sound.blip(1200, .03, .02)));

/* ---------- Scroll, pointer, keyboard ---------- */
const scroll = createInertia({ target: window });
const startN = parseFloat(params.get('n') || '0');
scroll.goal = scroll.value = startN;
const wrap = (n) => ((n % TOTAL) + TOTAL) % TOTAL;
function goToProject(i) {
  const target = i < crystals.length ? crystals[i].n : NN(47);
  const cur = wrap(scroll.value);
  const d = ((target - cur + TOTAL * 1.5) % TOTAL) - TOTAL * .5;
  scroll.goal = scroll.value + d;
}

const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, sx: 0, sy: 0, energy: TOUCH ? 0 : .0, speed: 0, seen: false };
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  const dx = e.clientX - mouse.x, dy = e.clientY - mouse.y;
  mouse.x = e.clientX; mouse.y = e.clientY; mouse.seen = true;
  mouse.nx = e.clientX / innerWidth * 2 - 1; mouse.ny = e.clientY / innerHeight * 2 - 1;
  mouse.energy = Math.min(1, mouse.energy + Math.hypot(dx, dy) * .0065);
});
let pressX = 0, pressY = 0, pressT = 0;
addEventListener('pointerdown', (e) => { pressX = e.clientX; pressY = e.clientY; pressT = performance.now(); });
addEventListener('pointerup', (e) => {
  if (!started || panelOpen) return;
  if (Math.hypot(e.clientX - pressX, e.clientY - pressY) > 10 || performance.now() - pressT > 600) return;
  if (e.target.closest && e.target.closest('button,a,#panel')) return;
  if (e.pointerType === 'touch') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.energy = 1; }
  const h = hitProject(e.clientX, e.clientY);
  if (h >= 0) openProject(h, false);
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closePanel(); return; }
  if (panelOpen || !started) return;
  if (e.key === 'ArrowDown') scroll.goal += 2;
  else if (e.key === 'ArrowUp') scroll.goal -= 2;
  else if (e.key === 'PageDown' || e.key === ' ') { scroll.goal += 10; e.preventDefault(); }
  else if (e.key === 'PageUp') { scroll.goal -= 10; e.preventDefault(); }
  else if (figureActive && e.key === 'ArrowRight') setLink(linkIndex + 1);
  else if (figureActive && e.key === 'ArrowLeft') setLink(linkIndex - 1);
  else if (e.key === 'Enter' && focusProject >= 0 && e.target === document.body) openProject(focusProject, false);
});

/* ---------- Sizing ---------- */
let W = 1, H = 1;
function resize() {
  W = innerWidth; H = innerHeight;
  const dw = Math.round(W * dpr), dh = Math.round(H * dpr);
  renderer.setPixelRatio(1); renderer.setSize(dw, dh, false);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  post.setSize(dw, dh, dpr);
  G.uRes.value.set(dw, dh);
  const aspect = W / H;
  const tanV = Math.max(.3153, .272 / aspect);
  camera.fov = Math.atan(tanV) * 2 * 180 / Math.PI; camera.aspect = aspect; camera.updateProjectionMatrix();
  G.uPxScale.value = dh / (2 * tanV);
  ambient.uniforms.uAspect.value = aspect;
  const lc = hud.lines; lc.width = Math.round(W * Math.min(devicePixelRatio, 2)); lc.height = Math.round(H * Math.min(devicePixelRatio, 2));
}
addEventListener('resize', resize); resize();

/* ---------- Per-notch keyed values ---------- */
const keyed = (pairs) => { const xs = pairs.map((p) => p[0]); const ys = pairs.map((p) => p[1]); return monotone(xs, ys); };
const cEnd = TL.crystals.at(-1).n + 5;
const K = {
  cloud: keyed([[0, .05], [9, .08], [13, .4], [cEnd, .4], [NN(40), .3], [NN(72), .25], [NN(84), .2], [NN(110), .2], [NN(116), .05]]),
  shade: keyed([[0, 0], [10, 0], [14, .5], [cEnd, .5], [NN(40), .25], [NN(72), .05], [NN(116), 0]]),
  shaft: keyed([[NN(40), 0], [NN(48), .55], [NN(72), .6], [NN(82), 0], [NN(116), 0]]),
  grid: keyed([[0, 0], [12, 0], [15, .9], [cEnd - 2, .9], [NN(39), 0], [NN(83), 0], [NN(88), .8], [NN(108), .8], [NN(111), 0]]),
  amb: keyed([[0, 0], [12, 0], [15, 1], [cEnd - 2, 1], [NN(38), 0], [NN(82), 0], [NN(88), .9], [NN(108), .9], [NN(110), 0]]),
  band: keyed([[0, 0], [5.5, 0], [8, .6], [11, .9], [14, .7], [16, 0], [NN(105.5), 0], [NN(108), .9], [NN(112), .75], [NN(114.5), 0]]),
  seam: keyed([[0, 0], [6.5, 0], [8, .16], [10.5, .5], [13, 0], [NN(113), 0], [NN(116), .0]]),
  cutA: keyed([[0, -.5], [6, -.5], [7.5, .1], [10, .36], [12, .62], [14, 1.], [15.5, 1.4], [18, 1.4]]),
  cutB: keyed([[NN(106), 1.4], [NN(108), 1.1], [NN(109.5), .6], [NN(111), .15], [NN(112.4), -.5], [NN(116), -.5]]),
  cutP: keyed([[NN(100), -.5], [NN(105.5), -.35], [NN(107.5), .1], [NN(109), .34], [NN(111), 1.4], [NN(116), 1.4]]),
  platRel: keyed([[NN(106), -16], [NN(108), -16], [NN(110), -6], [NN(112), 9], [NN(114), 24], [NN(116), 46]]),
  platDist: keyed([[NN(106), 58], [NN(108), 58], [NN(112), 104], [NN(116), 140]]),
  ring2: keyed([[NN(36), TL.sY(-254)], [NN(50), TL.sY(-255)], [NN(52), TL.sY(-273)], [NN(54.2), TL.sY(-325)], [NN(76), TL.sY(-325)]]),
  ring3: keyed([[NN(36), TL.sY(-267)], [NN(48), TL.sY(-266)], [NN(52), TL.sY(-310)], [NN(54.2), TL.sY(-330)], [NN(58), TL.sY(-348)], [NN(62), TL.sY(-354)], [NN(64.2), TL.sY(-380)], [NN(76), TL.sY(-380)]]),
  scatter: keyed([[NN(107.5), 1], [NN(113), .62], [NN(115), .25], [NN(116), 0]]),
  top: keyed([[0, .55], [9, .55], [13, .75], [cEnd, .6], [NN(84), .52], [NN(88), .92], [NN(108), .9], [NN(112), .55], [NN(116), .55]]),
};
const skyTopA = new THREE.Color(), fogC = col(C.fog), fogL = col(C.fogLight);

/* ---------- Intro state ---------- */
const intro = { wire: 0, revealY: -100, reveal: 1e5, floor: 0, seam: 0, camK: 1, wander: 1, core: .35, snow: 1 };
let started = false, figureActive = false, focusProject = -1;
const skipIntro = params.has('skip') || REDUCED;

function runIntro() {
  const loader = $('#loader-text');
  const L = 1.5;
  scramble(loader, SITE.loaderText, { duration: .5 });
  const shuffle = setInterval(() => { scramble(loader, SITE.loaderText, { duration: .5 }); }, 520);
  Object.assign(intro, { wire: 0, revealY: 13, reveal: 0, seam: 0, camK: 0, wander: 0, core: 1, snow: 0 });
  wires.lines.visible = true;
  const tl = gsap.timeline({ delay: L, onStart() { clearInterval(shuffle); gsap.to('#loader', { opacity: 0, duration: .25, onComplete() { $('#loader').hidden = true; } }); } });
  tl.to(intro, { wire: 1, duration: .75, ease: 'power1.out' }, 0)
    .to(intro, { revealY: -1.3, duration: 1.05, ease: 'power1.inOut' }, .78)
    .to(intro, { revealY: -100, duration: .01 }, 2.0)
    .to(intro, { reveal: 90, duration: .95, ease: 'power1.in' }, 1.7)
    .to(intro, { reveal: 4000, duration: .75, ease: 'power3.in' }, 2.65)
    .to(intro, { camK: 1, duration: 3.45, ease: 'power2.inOut' }, .55)
    .to(intro, { wire: 0, duration: .9, ease: 'power1.in' }, 2.55)
    .to(intro, { seam: 1, duration: .75, ease: 'power1.inOut' }, 2.8)
    .to(intro, { wander: 1, duration: 1.1, ease: 'power1.out' }, 3.55)
    .to(intro, { seam: 0, duration: 1.1 }, 3.8)
    .to(intro, { core: .35, snow: 1, duration: 1.2 }, 3.2)
    .call(() => { wires.lines.visible = false; }, null, 3.6)
    .call(() => { showHero(true); showHint(true); }, null, 4.05)
    .call(() => { started = true; scroll.locked = false; }, null, 4.05);
}
function skip() {
  $('#loader').hidden = true; wires.lines.visible = false;
  started = true; scroll.locked = false;
}

/* ---------- Overlay lines ---------- */
const lctx = hud.lines.getContext('2d');
let netMembers = [];
const v3 = new THREE.Vector3(), v3b = new THREE.Vector3();
const crossPx = (ctx, x, y, s = 6) => { ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); };

function projectPoint(p) { v3.copy(p).project(camera); return { x: (v3.x * .5 + .5) * W, y: (-v3.y * .5 + .5) * H, front: v3.z < 1 }; }

function drawNet(ctx, active) {
  if (!active) { netMembers = []; return; }
  const st = dome.state;
  netMembers = netMembers.filter((s) => s.a > .22 && s.front);
  if (netMembers.length < 5) {
    const add = st.filter((s) => s.a > .34 && s.front && !netMembers.includes(s) && !s.isArch && s.top < .8).sort((a, b) => b.a - a.a).slice(0, 5 - netMembers.length);
    netMembers.push(...add);
  }
  if (netMembers.length < 2) return;
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.font = '500 12px "IBM Plex Mono", monospace'; ctx.textBaseline = 'middle';
  const pts = netMembers.map((s) => { const lift = Math.pow(s.a, 1.25) * (.85 + 3.1 * s.top * s.top); v3b.copy(s.c).addScaledVector(s.out, lift + .6).add(campGroup.position); const p = projectPoint(v3b); return { ...p, s }; });
  ctx.globalAlpha = Math.min(1, ...pts.map((p) => p.s.a * 2.4));
  ctx.beginPath(); pts.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke();
  ctx.beginPath(); pts.forEach((p) => crossPx(ctx, p.x, p.y, 4)); ctx.stroke();
  pts.forEach((p) => ctx.fillText(p.s.num, p.x - 24, p.y - 10));
  ctx.globalAlpha = 1;
}

/* ---------- Main loop ---------- */
const cam = new Array(6).fill(0);
const fw = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3(), tgt = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), mZ = new THREE.Vector3(0, 0, -1);
const introFrom = new THREE.Vector3(16, 72, 132), introTgt = new THREE.Vector3(2, 3, 0);
let last = performance.now(), frames = 0, frameAcc = 0, adaptAfter = 0, flow = 0;

function hitProject(x, y) {
  if (focusProject < 0) return -1;
  if (focusProject < crystals.length) {
    const c = crystals[focusProject];
    v3b.copy(c.group.position); const p = projectPoint(v3b);
    const rad = (c.size * 1.3) / (2 * 40 * Math.tan(camera.fov * Math.PI / 360)) * H;
    return Math.hypot(x - p.x, (y - p.y) * .85) < rad ? focusProject : -1;
  }
  return Math.hypot(x - W / 2, y - H / 2) < Math.min(W, H) * .46 ? focusProject : -1;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  G.uTime.value += dt;
  const time = G.uTime.value;
  scroll.step(dt);
  const N = wrap(scroll.value);

  /* Which world sections are on */
  const campOn = N < 17 || N > NN(107);
  campGroup.visible = campOn;
  campGroup.position.y = N > TOTAL * .5 ? TL.loopY : 0;
  crystals.forEach((c) => { c.group.visible = N > c.n - 8 && N < c.n + 8; });
  const anyCrystal = crystals.some((c) => c.group.visible);
  ringSet.group.visible = N > NN(35) && N < NN(76);
  platformGroup.visible = N > NN(52) && N < NN(115.2);
  platform.floor.visible = N > NN(70.5);

  /* Camera */
  TL.camera(N, cam);
  camera.position.set(cam[0], cam[1], cam[2]); tgt.set(cam[3], cam[4], cam[5]);
  if (intro.camK < 1) {
    const k = intro.camK;
    camera.position.lerpVectors(introFrom, camera.position, k); tgt.lerpVectors(introTgt, tgt, k);
  }
  const amp = (() => {
    if (REDUCED) return 0;
    if (N < 14) return .185 * intro.camK;
    if (N < cEnd) return .05;
    if (N < NN(83)) return .03;
    if (N < NN(109)) return .1;
    return .12;
  })();
  mouse.sx = damp(mouse.sx, mouse.nx, 2.3, dt); mouse.sy = damp(mouse.sy, mouse.ny, 2.3, dt);
  fw.subVectors(tgt, camera.position);
  const dist = fw.length(); fw.normalize();
  const k = smooth(.75, .995, Math.abs(fw.y));
  up.copy(Y).multiplyScalar(1 - k).addScaledVector(mZ, k).normalize();
  right.crossVectors(fw, up).normalize();
  const upT = new THREE.Vector3().crossVectors(right, fw);
  camera.position.addScaledVector(right, -mouse.sx * amp * dist).addScaledVector(upT, mouse.sy * amp * .5 * dist);
  camera.up.copy(up); camera.lookAt(tgt); camera.updateMatrixWorld();

  /* Camp section */
  const heroBlend = (1 - smooth(1, 5.2, N)) + smooth(NN(112), NN(116), N);
  if (campOn) {
    mouse.energy *= Math.exp(-dt * .62);
    const touchWander = TOUCH ? 1 : 1;
    const wander = (REDUCED ? 0 : 1) * intro.wander * clamp(heroBlend) * (mouse.seen ? .78 : 1) * touchWander;
    const seamNow = Math.max(K.seam(N), intro.seam);
    const act = dome.update({ camera, mx: mouse.x, my: mouse.y, w: W, h: H, energy: REDUCED ? 0 : mouse.energy * clamp(heroBlend), wander, dt, time, floor: 0 });
    dome.uniforms.uGlobalSeam.value = seamNow;
    dome.uniforms.uRevealY.value = intro.revealY;
    dome.coreUniforms.uGlow.value = intro.core + .25 * Math.max(act, seamNow);
    dome.uniforms.uScatter.value = N < NN(100) ? 0 : K.scatter(N);
    terrain.uniforms.uReveal.value = intro.reveal;
    terrain.uniforms.uDoorGlow.value = Math.max(act * .95, seamNow * .5) * 1.0 + .05;
    wires.material.opacity = intro.wire * .62;
  }

  /* Wipes */
  let cut = -1;
  if (N < 18) cut = K.cutA(N);
  else if (N > NN(106)) cut = K.cutB(N);
  G.uCut.value = cut;
  const pCut = N > NN(100) ? K.cutP(N) : -1;
  GP.uCut.value = pCut;
  post.f.uCut.value = N < 60 ? cut : pCut > -.3 && pCut < 1.25 ? pCut : cut;
  post.f.uBand.value = REDUCED ? 0 : K.band(N);
  post.f.uBandTop.value = N < 18 ? lerp(-.5, .33, smooth(7.5, 14, N)) : N > NN(106) ? lerp(.24, -.5, smooth(NN(108), NN(114), N)) : -1;

  /* Crystals */
  focusProject = -1;
  const lpx = hud.lines.width / W;
  lctx.setTransform(lpx, 0, 0, lpx, 0, 0); lctx.clearRect(0, 0, W, H);
  crystals.forEach((c, i) => {
    if (!c.group.visible) { setCallouts(i, false); return; }
    const rel = N - c.n;
    c.group.rotation.y = rel * .205 + i * 1.4 + time * .035 + mouse.sx * .42;
    c.group.rotation.x = -.06 + mouse.sy * .16;
    c.group.rotation.z = .1 * Math.sin(i * 2.1 + 1.);
    c.group.position.y = c.y + Math.sin(time * .5 + i) * .15;
    const inFocus = Math.abs(rel) < 3.1;
    const focusAmt = 1 - smooth(1.8, 3.3, Math.abs(rel));
    c.setFocus(panelOpen ? 0 : focusAmt);
    setCallouts(i, inFocus && !panelOpen && started);
    if (inFocus) focusProject = i;
    if (focusAmt > .01 && !panelOpen) drawCallouts(i, c, focusAmt);
  });

  /* Rings */
  if (ringSet.group.visible) {
    const P = ringSet.portals;
    const glowAt = [
      smooth(NN(44), NN(50), N) * (1 - smooth(NN(54.6), NN(56), N)),
      smooth(NN(51.5), NN(56.5), N) * (1 - smooth(NN(63.8), NN(65.5), N)),
      smooth(NN(61), NN(66), N) * (1 - smooth(NN(71.8), NN(73.5), N)),
    ];
    // Inner rings hold closer while the outer one is in front, then fall back into place
    P[1].group.position.y = K.ring2(N);
    P[2].group.position.y = K.ring3(N);
    P.forEach((p, i) => {
      p.uniforms.uGlow.value = glowAt[i];
      p.group.rotation.y = (i % 2 ? -1 : 1) * (time * .022 + (N - NN(44)) * .022 + i * 1.1) + mouse.sx * .05;
      p.group.rotation.x = mouse.sy * .022;
    });
    const rp = SITE.projects.length - 1;
    const onR = N > NN(43) && N < NN(51.5) && SITE.projects[rp];
    setCallouts(rp, !!onR && !panelOpen && started);
    if (onR) { focusProject = rp; if (!panelOpen) drawRingCallouts(rp, 1 - smooth(NN(49.5), NN(51.5), N)); }
  } else setCallouts(SITE.projects.length - 1, false);

  /* Platform and form */
  figureActive = N > NN(86) && N < NN(107.5) && started;
  document.body.classList.toggle('fig-on', figureActive && !panelOpen);
  if (platformGroup.visible && form) {
    form.update(time);
    form.points.rotation.y = N * (Math.PI * 2 / 17) + time * .1 + mouse.sx * .2;
    flow = damp(flow, flowGoal && figureActive ? 1 : 0, flowGoal ? 1.3 : 2.4, dt);
    form.uniforms.uHover.value = flow;
    form.uniforms.uHot.value = 1 - smooth(NN(72), NN(78.5), N);
  }
  if (platformGroup.visible) {
    // The form stays in view above the camera while the next loop rises from below
    if (N > NN(108)) {
      platformGroup.position.y = camera.position.y + K.platRel(N);
      platformGroup.position.z = camera.position.z - K.platDist(N);
      if (form) form.uniforms.uSize.value = FORM_SIZE * (1 - smooth(NN(112.5), NN(114.8), N));
    } else { platformGroup.position.set(0, TL.platformY, 60); if (form) form.uniforms.uSize.value = FORM_SIZE; }
    const haloA = smooth(NN(84), NN(92), N) * (1 - smooth(NN(110), NN(113), N));
    platform.halo.visible = haloA > .01;
    platform.halo.material.uniforms.uA.value = haloA;
    const colA = smooth(NN(84), NN(90), N) * (.04 + flow * 1.1) * (1 - smooth(NN(107), NN(110), N));
    platform.col.visible = colA > .005;
    platform.col.material.uniforms.uA.value = colA;
  }

  /* Dome net overlay and HUD text */
  drawNet(lctx, campOn && clamp(heroBlend) > .35 && !panelOpen && started && N < 14 + 100);
  if (started) {
    const inHero = N < 13.2 || N > NN(114.7);
    showHero(inHero && !panelOpen);
    showHint((N < 4.4 || N > NN(115.5)) && !panelOpen);
    const lift = N < 20 ? Math.max(0, N - 7.2) * 15 : 0;
    hud.top.style.transform = `translate3d(0,${-lift}px,0)`;
    hud.tr.style.transform = `translate3d(0,${-lift}px,0)`;
  }

  /* Sky */
  sky.uniforms.uCloud.value = K.cloud(N);
  sky.uniforms.uShade.value = K.shade(N);
  sky.uniforms.uShaft.value = K.shaft(N);
  sky.uniforms.uTop.value.setRGB(fogL.r * K.top(N) * 1.2, fogL.g * K.top(N) * 1.2, fogL.b * K.top(N) * 1.23);
  sky.uniforms.uLow.value.setRGB(fogC.r * .72, fogC.g * .72, fogC.b * .74);

  /* Ambient blurred words */
  const ambA = K.amb(N);
  ambient.mesh.visible = ambA > .01;
  ambient.uniforms.uA.value = ambA;
  ambient.uniforms.uOff.value.set(mouse.sx * .012 + time * .002, camera.position.y * -.0035);

  /* Snow */
  snow.uniforms.uCam.value.copy(camera.position);
  snow.uniforms.uA.value = intro.snow * (.95 - .35 * smooth(14, 20, N));

  /* Final pass settings */
  post.f.uTime.value = time;
  post.f.uGrid.value = K.grid(N);
  post.f.uBurst.value = fx.burst;
  post.f.uDark.value = fx.dark;

  if (anyCrystal) {
    camera.layers.set(LAYER_BACK);
    post.renderBack(scene, camera);
    camera.layers.enable(0);
  }
  post.render(scene, camera);

  /* Cursor */
  if (!TOUCH && started) {
    const hit = !panelOpen ? hitProject(mouse.x, mouse.y) : -1;
    canvas.style.cursor = hit >= 0 ? 'pointer' : 'default';
  }

  sound.setSpeed(Math.abs(scroll.velocity));

  /* Drop resolution if the machine is struggling */
  if (started && !params.has('fixdpr')) {
    frameAcc += dt; frames++;
    if (frames === 90) {
      const avg = frameAcc / frames; frames = 0; frameAcc = 0;
      if (avg > 1 / 38 && dpr > .75 && now > adaptAfter) { dpr = Math.max(.75, dpr * .82); resize(); adaptAfter = now + 2500; }
    }
  }
}

/* Callout drawing */
function labelAt(el, x, y) {
  const cx = Math.max(12, Math.min(W - el.offsetWidth - 12, x));
  el.style.transform = `translate3d(${Math.round(cx)}px,${Math.round(y)}px,0)`;
}
const WS = new THREE.Vector3();
function anchorScreen(c, a) { WS.copy(a).applyMatrix4(c.group.matrixWorld); return projectPoint(WS); }
function drawCallouts(i, c, a) {
  c.group.updateMatrixWorld();
  const co = callouts[i];
  const pTitle = anchorScreen(c, c.anchors.title), pMeta = anchorScreen(c, c.anchors.meta), pDate = anchorScreen(c, c.anchors.date);
  const narrow = W < 700;
  const tx = pTitle.x - (narrow ? 90 : 205), ty = pTitle.y - (narrow ? 60 : 106);
  const mx = pMeta.x + (narrow ? 8 : 58), my = pMeta.y - 34;
  const tw0 = co.title.offsetWidth || 160, dw0 = co.date.offsetWidth || 170;
  const dx = Math.min(W - dw0 - 12, pDate.x + (narrow ? -20 : 36)), dy = pDate.y + 34;
  labelAt(co.title, tx, ty); labelAt(co.meta, mx, my); labelAt(co.date, dx, dy);
  lctx.globalAlpha = a; lctx.strokeStyle = 'rgba(255,255,255,.9)'; lctx.lineWidth = 1;
  lctx.beginPath();
  const tw = co.title.offsetWidth || 160, dw = co.date.offsetWidth || 170;
  lctx.moveTo(tx, ty + 36); lctx.lineTo(tx + tw, ty + 36); lctx.lineTo(pTitle.x, pTitle.y);
  lctx.moveTo(dx, dy + 36); lctx.lineTo(dx + dw, dy + 36); lctx.moveTo(dx, dy + 36); lctx.lineTo(pDate.x, pDate.y);
  crossPx(lctx, mx - 8, my + 10, 4);
  lctx.stroke(); lctx.globalAlpha = 1;
}
function drawRingCallouts(i, a) {
  const co = callouts[i];
  const y = ringSet.portals[0].group.position.y, R = ringSet.portals[0].R;
  const pt = (ang) => { WS.set(TL.ringPos[0] + Math.cos(ang) * R * 1.12, y, TL.ringPos[2] + Math.sin(ang) * R * 1.12); return projectPoint(WS); };
  const p1 = pt(-2.35), p2 = pt(-.45), p3 = pt(.72);
  const narrow = W < 700;
  const tx = Math.max(16, p1.x - (narrow ? 60 : 165)), ty = Math.max(90, p1.y - 56);
  const mx = Math.min(W - 110, p2.x + 14), my = p2.y - 20;
  const dx = Math.min(W - 190, p3.x + 12), dy = Math.min(H - 110, p3.y + 8);
  labelAt(co.title, tx, ty); labelAt(co.meta, mx, my); labelAt(co.date, dx, dy);
  lctx.globalAlpha = a; lctx.strokeStyle = 'rgba(255,255,255,.9)'; lctx.lineWidth = 1;
  lctx.beginPath();
  const tw = co.title.offsetWidth || 160, dw = co.date.offsetWidth || 170;
  lctx.moveTo(tx, ty + 36); lctx.lineTo(tx + tw, ty + 36); lctx.lineTo(p1.x, p1.y);
  lctx.moveTo(dx, dy + 36); lctx.lineTo(dx + dw, dy + 36); lctx.moveTo(dx, dy + 36); lctx.lineTo(p3.x, p3.y);
  crossPx(lctx, mx - 8, my + 10, 4);
  lctx.stroke(); lctx.globalAlpha = 1;
}

window.addEventListener('webglcontextlost', (e) => { e.preventDefault(); document.body.classList.add('no-webgl'); });

/* ---------- Boot ---------- */
buildForm().then(() => {
  setLink(0, false);
  requestAnimationFrame(frame);
  if (skipIntro) { skip(); if (startN < 13) { showHero(true); showHint(startN < 4.4); } } else runIntro();
});

// Small API used by the keyboard index and for jumping to a state with ?n=18&skip=1
window.__expedition = {
  openProject: (i) => openProject(i, true), closePanel, setLink: (i) => setLink(i),
  setN(n) { scroll.goal = scroll.value = n; }, get N() { return wrap(scroll.value); }, get total() { return TOTAL; },
};
