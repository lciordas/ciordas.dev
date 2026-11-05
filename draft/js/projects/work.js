// work: the scroll-driven project sections. Each one runs CAD explode, turn, scan into footage, then motion on scroll.
import { mountSequence } from './sequence.js';
import { mountCad, loadModel } from './cad.js';
import { hasWebGL, REDUCED } from '../_util.js';

export const PROJECTS = [
  {
    id: 'seesaw', index: '01', title: 'PID Seesaw', model: 'seesaw', frames: 'media/seesaw', explode: 0.75,
    views: [
      { p: 0, az: -0.75, el: 0.42, dist: 5.2, tx: 0, ty: 0, tz: 0 },
      { p: 0.42, az: 0.5, el: 0.2, dist: 4.4, tx: 0, ty: 0, tz: 0 },
      { p: 0.54, az: 0, el: 0.06, dist: 3.09, tx: 0.037, ty: 0.023, tz: 0 },
    ],
    // The beam tips over and the ball rolls to where the footage starts.
    pose(cad, p) {
      const k = smooth(0.4, 0.54, p);
      const pv = cad.parts[3].center;
      const pivot = cad.tiltPivot || (cad.tiltPivot = cad.parts[3].group.position.clone().set(pv.x, 0, pv.z));
      cad.tilt([1, 2, 3, 4], pivot, POSE.seesawAngle * k, 'y', { part: 2, x: POSE.seesawSlide * k, y: 0, z: POSE.seesawDrop * k });
    },
    copy: [
      { from: 0.17, to: 0.36, side: 'left', text: 'A ball-balancing seesaw. A servo and an infrared sensor keep the ball at its center.' },
      { from: 0.67, to: 0.82, side: 'left', text: 'I upgraded the hardware, and got past a conceptual bug: I was adding the PID output to the seesaw’s angle.' },
      { from: 0.84, to: 0.985, side: 'right', text: 'Setting the angle to the output removed the lag. I had been integrating the controller’s output by accident.' },
    ],
  },
  {
    id: 'dog', index: '02', title: 'Robot Dog', model: 'dog', frames: 'media/dog', explode: 0.8, up: [0, 0, Math.PI / 2],
    views: [
      { p: 0, az: 2.4, el: 0.42, dist: 6.2, tx: 0, ty: 0, tz: 0 },
      { p: 0.42, az: 1.5, el: 0.22, dist: 5.2, tx: 0, ty: 0, tz: 0 },
      { p: 0.54, az: 0.77, el: 0.1, dist: 3.6, tx: -0.03, ty: 0.22, tz: 0 },
    ],
    copy: [
      { from: 0.17, to: 0.36, side: 'left', text: 'A quadruped robot, designed in CAD with a few friends.' },
      { from: 0.67, to: 0.82, side: 'left', text: 'Inverse kinematics uses three degrees of freedom per leg to give the body a full six.' },
      { from: 0.84, to: 0.985, side: 'right', text: 'So it can not only walk, but also gyrate and dance.' },
    ],
  },
];

const POSE = { seesawAngle: 0.045, seesawSlide: -0.84, seesawDrop: -0.1 };

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function viewAt(views, p) {
  let i = 0;
  while (i < views.length - 2 && p > views[i + 1].p) i++;
  const a = views[i], b = views[i + 1];
  const t = smooth(a.p, b.p, p);
  const out = {};
  for (const k of ['az', 'el', 'dist', 'tx', 'ty', 'tz']) out[k] = lerp(a[k], b[k], t);
  return out;
}

function buildSection(cfg) {
  const s = document.createElement('section');
  s.className = 'project'; s.id = cfg.id; s.setAttribute('aria-label', cfg.title);
  s.innerHTML = `
    <div class="stage">
      <div class="title" aria-hidden="false"><span class="index">${cfg.index}</span><h3>${cfg.title}</h3></div>
      <canvas class="cad" aria-hidden="true"></canvas>
      <canvas class="frames" role="img" aria-label="${cfg.title} in motion"></canvas>
      <i class="scan" aria-hidden="true"></i>
      <i class="shade" aria-hidden="true"></i>
      ${cfg.copy.map((c) => `<p class="copy copy--${c.side}">${c.text}</p>`).join('')}
      <div class="bar" aria-hidden="true"><i></i></div>
    </div>`;
  return s;
}

export function mountWork(container, options = {}) {
  const gl = hasWebGL();
  const items = PROJECTS.map((cfg) => {
    const el = buildSection(cfg);
    container.appendChild(el);
    const q = (sel) => el.querySelector(sel);
    const item = {
      cfg, el, stage: q('.stage'), title: q('.title'), cadC: q('.cad'), framesC: q('.frames'), scan: q('.scan'), shade: q('.shade'), bar: q('.bar i'),
      copies: [...el.querySelectorAll('.copy')], seq: mountSequence(q('.frames'), cfg.frames), cad: null, p: 0, near: false, loading: false,
    };
    if (!gl) item.cadC.style.display = 'none';
    return item;
  });
  const size = () => {
    const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, w < 768 ? 1.5 : 2);
    items.forEach((it) => { it.seq.resize(w, h, Math.min(dpr, 1.5)); it.cad?.resize(w, h, dpr); it.forceDraw = true; });
  };
  const ensure = (it) => {
    if (it.loading) return; it.loading = true;
    it.seq.start();
    if (gl) loadModel(it.cfg.model).then((m) => {
      it.cad = mountCad(it.cadC, m, { up: it.cfg.up, explode: it.cfg.explode });
      size();
    });
  };
  const apply = (it, p) => {
    const { cfg } = it;
    // Title, behind the model.
    const tOut = 1 - smooth(0.09, 0.19, p);
    it.title.style.opacity = tOut; it.title.style.transform = `translate3d(0,${-p * 90}vh,0)`;
    it.title.style.visibility = tOut > 0.001 ? 'visible' : 'hidden';
    // Scan from CAD into footage.
    const wipe = smooth(0.54, 0.66, p);
    const pct = wipe * 100;
    it.framesC.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    it.framesC.style.visibility = wipe > 0 ? 'visible' : 'hidden';
    it.scan.style.left = `${pct}%`;
    it.scan.style.opacity = wipe > 0.001 && wipe < 0.999 ? 1 : 0;
    // Model.
    if (it.cad) {
      const show = p < 0.68;
      it.cadC.style.visibility = show ? 'visible' : 'hidden';
      if (show) {
        it.cad.setExplode(REDUCED ? 0 : 1 - smooth(0.05, 0.4, p));
        cfg.pose?.(it.cad, p);
        const v = viewAt(cfg.views, p);
        // Wide shots pull back on narrow screens. The final shot follows the footage's on-screen size.
        const H = innerHeight, A = innerWidth / H, matchT = smooth(cfg.views[cfg.views.length - 2].p, cfg.views[cfg.views.length - 1].p, p);
        const wideFit = Math.max(1, 1.45 / A), footFit = H / it.seq.rect().h;
        it.cad.setView(v.az, v.el, v.dist * lerp(wideFit, footFit, matchT), v.tx, v.ty, v.tz);
        it.cad.render();
      }
    }
    // Motion.
    if (it.seq.total) it.seq.seek(smooth(0.64, 0.995, p) * 0.9999);
    if (it.forceDraw && it.seq.total) { it.seq.draw(Math.round(smooth(0.64, 0.995, p) * (it.seq.total - 1)), true); it.forceDraw = false; }
    it.shade.style.opacity = smooth(0.62, 0.7, p);
    // Words.
    it.copies.forEach((node, i) => {
      const c = cfg.copy[i];
      const a = smooth(c.from, c.from + 0.025, p) * (1 - smooth(c.to - 0.025, c.to, p));
      node.style.opacity = a; node.style.transform = `translate3d(0,${(1 - a) * 18}px,0)`;
      node.style.visibility = a > 0.001 ? 'visible' : 'hidden';
    });
    it.bar.style.transform = `scaleX(${p})`;
  };

  // Smooth scrolling with a gentle glide, off for reduced motion and left native on touch.
  let lenis = null;
  if (!REDUCED && window.Lenis) { lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true }); }

  const heroEls = options.fade || [];
  let last = performance.now();
  const tick = (now) => {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    lenis?.raf(now);
    const H = innerHeight;
    const y = window.scrollY;
    const hero = clamp(1 - y / (H * 0.8));
    heroEls.forEach((e) => { e.style.opacity = hero; });
    options.onHero?.(hero, y);
    items.forEach((it) => {
      const r = it.el.getBoundingClientRect();
      const near = r.top < H * 2 && r.bottom > -H;
      if (near) ensure(it);
      const visible = r.top < H && r.bottom > 0;
      const target = clamp(-r.top / Math.max(1, r.height - H));
      it.p += (target - it.p) * (1 - Math.exp(-(REDUCED ? 60 : 11) * dt));
      if (Math.abs(target - it.p) < 0.00005) it.p = target;
      if (visible) apply(it, it.p);
    });
  };
  size();
  addEventListener('resize', size);
  requestAnimationFrame(tick);
  const api = { items, lenis, scrollToProject(id) { const it = items.find((i) => i.cfg.id === id); if (it) window.scrollTo(0, it.el.offsetTop); } };
  window.__work = api; window.__POSE = POSE;
  return api;
}
