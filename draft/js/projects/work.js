// work: the project pages. Scattered CAD parts fly in and assemble inside a rounded window, a light line wipes
// from CAD to footage, then the footage moves with the scroll or plays as video. Words come from data/content.json.
import { mountSequence } from './sequence.js';
import { mountCad, loadModel } from './cad.js';
import { hasWebGL, REDUCED } from '../_util.js';

// How each animated project behaves. Beats are positions from 0 to 1 through the section's scroll length.
const ANIMATED = {
  'pid-seesaw': {
    model: 'seesaw', length: 460, clip: 'media/video/seesaw.mp4',
    up: [-1.5708, 0.0058, -3.1416], fov: 33.58,
    views: [
      { p: 0, az: -0.75, el: 0.42, dist: 2.95, tx: 0, ty: 0, tz: 0 },
      { p: 0.5, az: 0.5, el: 0.2, dist: 2.6, tx: 0, ty: 0, tz: 0 },
      { p: 0.62, az: 0.03, el: 0.2473, dist: 2.18, tx: 0.036, ty: 0.0679, tz: -0.0155 },
    ],
    assemble: [0.03, 0.52], title: [0.08, 0.2], wipe: [0.62, 0.68], clipAt: 0.68,
    copyAt: [[0.28, 0.6], [0.7, 1]],
  },
  'robot-dog': {
    model: 'dog', up: [0, 0, 1.5325], fov: 34.28, length: 1500, frames: 'media/dog', frames2: 'media/dog-front', clip: 'media/video/dog-walk.mp4',
    views: [
      { p: 0, az: 1.7, el: 0.42, dist: 3.7, tx: 0, ty: 0, tz: 0 },
      { p: 0.18, az: 0.75, el: 0.2, dist: 3.4, tx: 0, ty: 0, tz: 0 },
      { p: 0.22, az: 0.3256, el: 0.3072, dist: 3.4439, tx: 0.1741, ty: -0.1379, tz: -0.0126 },
    ],
    assemble: [0.012, 0.18], title: [0.025, 0.07], wipe: [0.22, 0.238], scrub: [0.24, 0.55], frames2Fade: [0.55, 0.565], scrub2: [0.565, 0.86], clipFade: [0.86, 0.875], clipAt: 0.868,
    copyAt: [[0.1, 0.21], [0.25, 0.39], [0.41, 0.545], [0.575, 0.85], [0.885, 1]],
  },
};

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function viewAt(views, p) {
  let i = 0;
  while (i < views.length - 2 && p > views[i + 1].p) i++;
  const a = views[i], b = views[i + 1], t = smooth(a.p, b.p, p), out = {};
  for (const k of ['az', 'el', 'dist', 'tx', 'ty', 'tz']) out[k] = lerp(a[k], b[k], t);
  return out;
}

const endLinks = (next, content) => `
  <div class="after">
    <a class="after__back" href="#">Back to overview</a>
    ${next ? `<a class="after__next" href="#${next}"><span>Next</span>${esc(content.projects[next].title)}</a>` : ''}
  </div>`;

function buildAnimated(id, cfg, p, index, next, content) {
  const s = document.createElement('section');
  s.className = 'project'; s.id = id; s.dataset.project = id; s.setAttribute('aria-label', p.title);
  s.innerHTML = `
    <div class="runway" style="height:${cfg.length}vh">
      <div class="stage">
        <div class="window" aria-hidden="true"><div class="title"><span class="index">${index}</span><span class="big">${esc(p.title)}</span></div></div>
        <canvas class="cad" aria-hidden="true"></canvas>
        <div class="screen">
          ${cfg.frames ? `<canvas class="frames" role="img" aria-label="${esc(p.title)} in motion"></canvas>` : ''}
          ${cfg.frames2 ? `<canvas class="frames frames--2" role="img" aria-label="${esc(p.title)} from the front quarter"></canvas>` : ''}
          ${cfg.clip ? `<video class="clip" muted playsinline loop preload="none" aria-label="${esc(p.title)} video"></video>` : ''}
          <i class="scan" aria-hidden="true"></i>
          <div class="bar" aria-hidden="true"><i></i></div>
        </div>
        <h3 class="head"><span class="index">${index}</span>${esc(p.title)}</h3>
        ${(p.captions || []).map((c, i) => `<p class="copy copy--${i % 2 ? 'right' : 'left'}">${esc(c)}</p>`).join('')}
      </div>
    </div>
    ${endLinks(next, content)}`;
  return s;
}

const isVideo = (src) => /\.mp4$/i.test(src);
const figure = (m, alt, cls = '') => `
  <figure class="fig ${cls}${m.light ? ' fig--light' : ''}">
    <div class="fig__frame">${isVideo(m.src)
      ? `<video src="${esc(m.src)}" muted playsinline loop preload="none" aria-label="${esc(m.caption || alt)}"></video>`
      : `<img src="${esc(m.src)}" alt="${esc(m.caption || alt)}" loading="lazy" decoding="async">`}</div>
    ${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}
  </figure>`;

function buildDetail(id, p, index, next, content) {
  const s = document.createElement('section');
  s.className = 'project project--detail'; s.id = id; s.dataset.project = id; s.setAttribute('aria-label', p.title);
  const [hero, ...rest] = p.media || [];
  s.innerHTML = `
    <div class="detail">
      <h3 class="detail__title"><span class="index">${index}</span>${esc(p.title)}</h3>
      <div class="detail__top">
        ${hero ? figure(hero, p.title, 'fig--hero') : ''}
        <div class="detail__body">
          <p>${esc(p.summary)}</p>
          ${p.tech?.length ? `<ul class="tech">${p.tech.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          ${p.links?.length ? `<p class="plinks">${p.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</p>` : ''}
        </div>
      </div>
      ${rest.length ? `<div class="detail__grid">${rest.map((m) => figure(m, p.title)).join('')}</div>` : ''}
    </div>
    ${endLinks(next, content)}`;
  return s;
}

export function mountWork(container, options = {}) {
  const { content } = options;
  const gl = hasWebGL();
  const order = content.columns.flatMap((c) => c.items).filter((id) => content.projects[id]);
  const items = [], sections = [];
  order.forEach((id, i) => {
    const p = content.projects[id], next = order[i + 1], index = String(i + 1).padStart(2, '0');
    const cfg = ANIMATED[id];
    if (!cfg) { const el = buildDetail(id, p, index, next, content); container.appendChild(el); sections.push(el); return; }
    const el = buildAnimated(id, cfg, p, index, next, content);
    container.appendChild(el); sections.push(el);
    const q = (sel) => el.querySelector(sel);
    const item = {
      id, cfg, el, runway: q('.runway'), title: q('.title'), head: q('.head'), screen: q('.screen'), cadC: q('.cad'), framesC: q('.frames'), video: q('.clip'), scan: q('.scan'), bar: q('.bar i'),
      copies: [...el.querySelectorAll('.copy')], seq: cfg.frames ? mountSequence(q('.frames'), cfg.frames) : null, seq2: cfg.frames2 ? mountSequence(q('.frames--2'), cfg.frames2) : null, frames2C: q('.frames--2'), cad: null, p: 0, loading: false, fit: 1, playing: false,
    };
    if (!gl) item.cadC.style.display = 'none';
    items.push(item);
  });
  const foot = document.createElement('div'); foot.className = 'after after--end'; foot.innerHTML = '<a class="after__back" href="#">Back to overview</a>'; container.appendChild(foot);

  const clips = new IntersectionObserver((seen) => seen.forEach((e) => { if (REDUCED) return; if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); }), { threshold: 0.2 });
  container.querySelectorAll('.fig video').forEach((v) => clips.observe(v));

  const size = () => {
    const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, w < 768 ? 1.5 : 2);
    items.forEach((it) => {
      const r = it.screen.getBoundingClientRect();
      if (r.height < 1) return;
      it.seq?.resize(r.width, r.height, Math.min(dpr, 1.5));
      it.seq2?.resize(r.width, r.height, Math.min(dpr, 1.5));
      it.fit = h / r.height; // camera distances are set for a window that fills the screen's height
      if (it.cad) {
        it.cad.resize(w, h, dpr);
        const v = it.cfg.views[0];
        it.cad.setScatter({ ...v, dist: v.dist * it.fit }, w / h);
      }
      it.forceDraw = true; it.forceDraw2 = true;
    });
  };
  const ensure = (it) => {
    if (it.loading) return; it.loading = true;
    it.seq?.start();
    if (it.seq2) setTimeout(() => it.seq2.start(), 1500); // after the first clip has a head start
    if (it.video) { it.video.src = it.cfg.clip; it.video.preload = 'auto'; it.video.load(); }
    if (gl) loadModel(it.cfg.model).then((m) => {
      it.cad = mountCad(it.cadC, m, { up: it.cfg.up, fov: it.cfg.fov });
      size();
    });
  };
  const setPlaying = (it, on) => {
    if (!it.video || it.playing === on) return;
    it.playing = on;
    if (on && !REDUCED) it.video.play().catch(() => {});
    else if (!on) { it.video.pause(); try { it.video.currentTime = 0; } catch { /* not loaded yet */ } }
  };
  let mx = 0, my = 0;
  addEventListener('pointermove', (e) => { mx = (e.clientX / innerWidth - 0.5) * 2; my = -(e.clientY / innerHeight - 0.5) * 2; }, { passive: true });

  const apply = (it, p, time) => {
    const { cfg } = it;
    // Big title in the empty window, small heading once it's gone.
    const tOut = 1 - smooth(cfg.title[0], cfg.title[1], p);
    it.title.style.opacity = tOut;
    it.title.style.visibility = tOut > 0.001 ? 'visible' : 'hidden';
    it.head.style.opacity = smooth(cfg.title[1] - 0.02, cfg.title[1] + 0.02, p);
    // Light line from CAD into the footage.
    const wipe = smooth(cfg.wipe[0], cfg.wipe[1], p), pct = wipe * 100, reveal = cfg.frames ? it.framesC : it.video;
    reveal.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    reveal.style.visibility = wipe > 0 ? 'visible' : 'hidden';
    it.scan.style.left = `${pct}%`;
    it.scan.style.opacity = wipe > 0.001 && wipe < 0.999 ? 1 : 0;
    // Model.
    if (it.cad) {
      const show = p < cfg.wipe[1] + 0.01;
      it.cadC.style.visibility = show ? 'visible' : 'hidden';
      if (show) {
        const [a, b] = cfg.assemble;
        it.cad.setExplode(REDUCED ? 0 : 1 - clamp((p - a) / (b - a)), REDUCED ? 0 : time, mx, my); // each part eases on its own
        const v = viewAt(cfg.views, p);
        it.cad.setView(v.az, v.el, v.dist * it.fit, v.tx, v.ty, v.tz);
        it.cad.render();
      }
    }
    // Footage moved by the scroll.
    if (cfg.scrub && it.seq?.total) {
      const k = smooth(cfg.scrub[0], cfg.scrub[1], p);
      if (it.forceDraw) { it.seq.draw(Math.round(k * (it.seq.total - 1)), true); it.forceDraw = false; } else it.seq.seek(k * 0.9999);
    }
    if (cfg.scrub2 && it.seq2?.total) {
      const f = smooth(cfg.frames2Fade[0], cfg.frames2Fade[1], p);
      it.frames2C.style.opacity = f; it.frames2C.style.visibility = f > 0 ? 'visible' : 'hidden';
      const k = smooth(cfg.scrub2[0], cfg.scrub2[1], p);
      if (it.forceDraw2) { it.seq2.draw(Math.round(k * (it.seq2.total - 1)), true); it.forceDraw2 = false; } else it.seq2.seek(k * 0.9999);
    }
    // Footage that plays by itself.
    if (it.video) {
      if (cfg.clipFade) {
        const f = smooth(cfg.clipFade[0], cfg.clipFade[1], p);
        it.video.style.opacity = f; it.video.style.visibility = f > 0 ? 'visible' : 'hidden';
      }
      setPlaying(it, p >= cfg.clipAt);
    }
    // Words.
    it.copies.forEach((node, i) => {
      const at = cfg.copyAt[i] || [2, 3], edge = 0.018;
      const a = smooth(at[0], at[0] + edge, p) * (at[1] >= 1 ? 1 : 1 - smooth(at[1] - edge, at[1], p));
      node.style.opacity = a; node.style.transform = `translate3d(0,${(1 - a) * 14}px,0)`;
      node.style.visibility = a > 0.001 ? 'visible' : 'hidden';
    });
    it.bar.style.transform = `scaleX(${p})`;
  };

  // Smooth scrolling with a gentle glide, off for reduced motion and left native on touch.
  let lenis = null;
  if (!REDUCED && window.Lenis) lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
  const jump = (y) => { if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); };

  const heroEls = options.fade || [];
  let last = performance.now(), focusId = null, time = 0;
  const tick = (now) => {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    lenis?.raf(now);
    const H = innerHeight, y = window.scrollY, hero = clamp(1 - y / (H * 0.8));
    heroEls.forEach((e) => { e.style.opacity = hero; });
    options.onHero?.(hero, y);
    items.forEach((it) => {
      if (it.el.hidden) { setPlaying(it, false); return; }
      const r = it.runway.getBoundingClientRect();
      if (r.top < H * 2 && r.bottom > -H) ensure(it);
      const visible = r.top < H && r.bottom > 0;
      const target = clamp(-r.top / Math.max(1, r.height - H));
      it.p += (target - it.p) * (1 - Math.exp(-(REDUCED ? 60 : 11) * dt));
      if (Math.abs(target - it.p) < 0.00005) it.p = target;
      if (visible) apply(it, it.p, time); else setPlaying(it, false);
    });
  };
  size();
  addEventListener('resize', size);
  requestAnimationFrame(tick);

  const showAll = () => { sections.forEach((s) => { s.hidden = false; }); container.classList.remove('is-focus'); focusId = null; size(); lenis?.resize(); };
  const api = {
    items, lenis, jump,
    // Show one project on its own, right below the overview, so scrolling up leads straight back.
    focus(id) {
      sections.forEach((s) => { s.hidden = s.dataset.project !== id; });
      container.classList.add('is-focus'); focusId = id;
      size(); lenis?.resize();
      const el = sections.find((s) => s.dataset.project === id);
      const it = items.find((x) => x.id === id);
      if (it) it.p = 0;
      jump(el.getBoundingClientRect().top + window.scrollY);
    },
    clearFocus: showAll,
    focused: () => focusId,
    toTop() { jump(0); },
  };
  window.__work = api;
  return api;
}
