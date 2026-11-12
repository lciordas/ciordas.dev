// work: the project pages. Scattered CAD parts fly in and assemble inside a rounded window, a light line wipes
// from CAD to footage, then the footage moves with the scroll or plays as video. Words come from data/content.json.
import { mountCad, loadModel } from './cad.js';
import { hasWebGL, REDUCED } from '../_util.js';

// How each animated project behaves. Beats are positions from 0 to 1 through the section's scroll length. A caption
// shows either over a stretch of scroll, [from, to], or over a stretch of the video's own time, { t: [from, to] }.
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
  // Lined up with the first frame of the clip from matched screw heads on two of the motor mounts.
  micromanipulator: {
    model: 'micromanipulator', length: 440, clip: 'media/video/micromanipulator.mp4',
    up: [0.0223, 0.6193, 1.2759], fov: 28.58,
    views: [
      { p: 0, az: 0.8, el: 0.38, dist: 6.6, tx: -0.11, ty: 0.31, tz: 0 },
      { p: 0.5, az: -0.35, el: 0.12, dist: 6.2, tx: -0.11, ty: 0.31, tz: 0 },
      { p: 0.62, az: 0, el: 0, dist: 5.9152, tx: -0.1128, ty: 0.3136, tz: 0 },
    ],
    assemble: [0.03, 0.52], title: [0.08, 0.2], wipe: [0.62, 0.68], clipAt: 0.68,
    copyAt: [[0.12, 0.36], [0.38, 0.6], [0.62, 0.8], [0.82, 1]],
  },
  // Lined up with the first frame of the video. Its four shots run 0 to 6 s, 6 to 9.3 s, 9.3 to 15.8 s, and 15.8 to 22.8 s.
  'robot-dog': {
    model: 'dog', up: [0, 0, 1.5325], fov: 34.28, length: 440, clip: 'media/video/dog.mp4',
    views: [
      { p: 0, az: 1.7, el: 0.42, dist: 3.7, tx: 0, ty: 0, tz: 0 },
      { p: 0.636, az: 0.75, el: 0.2, dist: 3.4, tx: 0, ty: 0, tz: 0 },
      { p: 0.764, az: 0.3256, el: 0.3072, dist: 3.4439, tx: 0.1741, ty: -0.1379, tz: -0.0126 },
    ],
    // Little scroll after the clip starts, so the photo stream follows soon after.
    assemble: [0.038, 0.636], title: [0.089, 0.229], wipe: [0.764, 0.84], clipAt: 0.84,
    copyAt: [[0.255, 0.535], [0.56, 0.84], { t: [0, 22.77] }],
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

// A prompt at the start of each project's scrolling part, so it's clear the page plays as you scroll.
const CUE = '<div class="pcue" aria-hidden="true"><span>Scroll</span><svg viewBox="0 0 14 22"><path d="M7 1v19M1 14l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';

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
          ${cfg.clip ? `<video class="clip" muted playsinline loop preload="none" aria-label="${esc(p.title)} video"></video>` : ''}
          <i class="scan" aria-hidden="true"></i>
          <div class="bar" aria-hidden="true"><i></i></div>
        </div>
        <h3 class="head"><span class="index">${index}</span>${esc(p.title)}</h3>
        ${p.captions?.length ? `<ul class="points">${p.captions.map((c) => `<li class="point">${esc(c)}</li>`).join('')}</ul>` : ''}
        ${CUE}
      </div>
    </div>
    ${p.stream?.length ? stream(p, body(p)) : p.media?.length ? gallery(p, body(p)) : ''}
    ${endLinks(next, content)}`;
  return s;
}

const isVideo = (src) => /\.mp4$/i.test(src);
// Captions may carry links written [text](https://…); everything else is plain text. The alt text drops the address.
const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
const capHtml = (s) => esc(s).replace(LINK, '<a href="$2" target="_blank" rel="noopener">$1</a>');
const capText = (s) => String(s ?? '').replace(LINK, '$1');
// A slide with "points" (a list of short strings, **bold** allowed) shows its caption as a heading over those bullets.
const bold = (h) => h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const slideText = (m) => m.points?.length
  ? `<div class="gallery__cap gallery__cap--points">${m.caption ? `<p class="gallery__lead">${capHtml(m.caption)}</p>` : ''}<ul>${m.points.map((t) => `<li>${bold(capHtml(t))}</li>`).join('')}</ul></div>`
  : `<p class="gallery__cap">${capHtml(m.caption || '')}</p>`;
const body = (p) => `
  <div class="detail__body">
    ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
    ${p.tech?.length ? `<ul class="tech">${p.tech.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    ${p.links?.length ? `<p class="plinks">${p.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</p>` : ''}
  </div>`;
// Photos and clips in a row on the left two thirds of the screen, with their text on the right. Scrolling down
// slides the row across; each picture holds still for a while before the next slides in. Scrolling sideways,
// the left and right arrow keys, the buttons, or clicking the next picture move one picture at a time.
const SLIDE_VH = 85;
// The project's heading and words sit at the top of the same screen, so the whole thing fits one screen exactly.
const gallery = (p, head = '') => {
  const media = p.media || [], n = media.length;
  if (!n) return '';
  return `
  <div class="gallery" style="height:calc(${(n - 1) * SLIDE_VH}vh + 100vh)">
    <div class="gallery__stage">
      ${head ? `<div class="gallery__head">${head}</div>` : ''}
      <div class="gallery__main">
      <div class="gallery__view"><div class="gallery__track">${media.map((m, i) => `
        <figure class="slide${m.light ? ' slide--light' : ''}">
          <div class="slide__frame">${isVideo(m.src)
            ? `<video data-src="${esc(m.src)}" muted playsinline loop preload="none" aria-label="${esc(capText(m.caption) || p.title)}"></video>`
            : `<img data-src="${esc(m.src)}" alt="${esc(capText(m.caption) || p.title)}" decoding="async">`}</div>
        </figure>`).join('')}
      </div></div>
      <div class="gallery__text">
        <span class="gallery__count"><b>01</b> / ${String(n).padStart(2, '0')}</span>
        <div class="gallery__caps">${media.map(slideText).join('')}</div>
        ${n > 1 ? `<div class="gallery__nav">
          <button type="button" class="gallery__btn" data-go="-1" aria-label="Previous picture"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <span class="gallery__dots" aria-hidden="true">${media.map(() => '<i></i>').join('')}</span>
          <button type="button" class="gallery__btn" data-go="1" aria-label="Next picture"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>` : ''}
      </div>
      </div>
      ${n > 1 ? CUE : ''}
    </div>
  </div>`;
};

// A stream of photos and clips under a built project's video, or after a project's gallery, with no words: a loose
// collage that drifts from left to right as the page scrolls down. Each picture is large, medium or small, and the
// smaller ones sit further back and move more slowly, so the pictures slide over one another.
const DEPTH = { l: 1, m: 0.8, s: 0.62 };
const stream = (p, head = '') => `
  <div class="stream">
    <div class="stream__stage">
      ${head ? `<div class="gallery__head">${head}</div>` : ''}
      <div class="stream__band" role="group" aria-label="${esc(p.title)}: photos and clips">${p.stream.map((m) => {
        const size = DEPTH[m.size] ? m.size : 's', ar = m.ar || (isVideo(m.src) ? 16 / 9 : 4 / 3);
        return `
        <figure class="stream__item stream__item--${size}${m.light ? ' stream__item--light' : ''}" data-size="${size}" data-ar="${ar}">${isVideo(m.src)
          ? `<video data-src="${esc(m.src)}#t=0.001" muted playsinline loop preload="none" aria-hidden="true"></video>`
          : `<img data-src="${esc(m.src)}" alt="" decoding="async">`}</figure>`;
      }).join('')}
      </div>
    </div>
  </div>`;

function mountStream(el) {
  const band = el.querySelector('.stream__band');
  const s = {
    el, items: [...band.children].map((f, i) => ({ f, i, size: f.dataset.size, k: DEPTH[f.dataset.size], ar: +f.dataset.ar, media: f.firstElementChild, shown: true })),
    loaded: false, vw: 0, c0: 0, c1: 0, cam: NaN,
  };
  s.videos = s.items.filter((it) => it.media.tagName === 'VIDEO');
  s.load = () => { if (s.loaded) return; s.loaded = true; s.items.forEach(({ media: m }) => { m.src = m.dataset.src; if (m.tagName === 'VIDEO') m.preload = 'metadata'; }); };
  // Sizes come from the band's height, held to a share of its width. The pictures take turns between two rows (three
  // on a phone), each row about end to end, and the rows overlap a little in the middle. The section is as long as
  // the front pictures' journey across.
  s.measure = () => {
    const hb = band.clientHeight, vw = band.clientWidth;
    if (hb < 1) return;
    const narrow = vw < 760, rows = narrow ? 3 : 2, tall = narrow ? { l: 0.4, m: 0.34, s: 0.28 } : { l: 0.6, m: 0.5, s: 0.4 }, wide = narrow ? { l: 0.84, m: 0.68, s: 0.54 } : { l: 0.36, m: 0.28, s: 0.21 };
    const nudge = [0.04, -0.03, 0.06, 0, -0.05, 0.02], tilt = [-1.6, 1.2, -0.6, 1.8, -1.1, 0.7, -1.9, 0.4];
    let x = 0;
    s.items.forEach((it, i) => {
      let h = hb * tall[it.size], w = h * it.ar;
      if (w > vw * wide[it.size]) { w = vw * wide[it.size]; h = w / it.ar; }
      const lane = clamp((i % rows) / (rows - 1) + nudge[i % nudge.length]);
      if (i) x += (s.items[i - 1].w + w) / 2 * (narrow ? 0.4 : 0.6);
      Object.assign(it, { w, h, x, y: (hb - h) * lane, r: tilt[i % tilt.length] });
      it.f.style.width = `${w.toFixed(1)}px`; it.f.style.height = `${h.toFixed(1)}px`;
    });
    const m = Math.min(48, vw * 0.04), a = s.items[0], b = s.items[s.items.length - 1];
    s.vw = vw;
    s.c0 = a.x + (vw / 2 - a.w / 2 - m) / a.k;
    s.c1 = Math.max(s.c0 + 1, b.x - (vw / 2 - b.w / 2 - m) / b.k);
    el.style.height = `${Math.round(s.c1 - s.c0 + innerHeight)}px`;
    s.cam = NaN;
  };
  s.apply = (p, on) => {
    const cam = s.c0 + clamp(p) * (s.c1 - s.c0), vw = s.vw;
    if (!(Math.abs(cam - s.cam) < 0.05)) {
      s.cam = cam;
      s.items.forEach((it) => {
        const left = vw / 2 + it.k * (cam - it.x) - it.w / 2, show = left < vw + 60 && left + it.w > -60;
        it.left = left;
        if (show !== it.shown) { it.shown = show; it.f.style.visibility = show ? 'visible' : 'hidden'; }
        if (show) it.f.style.transform = `translate3d(${left.toFixed(1)}px,${it.y.toFixed(1)}px,0) rotate(${it.r}deg)`;
      });
    }
    // Only the few clips nearest the middle play; the rest wait.
    const playing = on && !REDUCED ? s.videos.filter((it) => it.shown && it.left > -it.w * 0.35 && it.left + it.w < vw + it.w * 0.35)
      .sort((u, v) => Math.abs(u.left + u.w / 2 - vw / 2) - Math.abs(v.left + v.w / 2 - vw / 2)).slice(0, vw < 760 ? 2 : 3) : [];
    s.videos.forEach((it) => {
      const m = it.media, play = playing.includes(it);
      if (play && m.paused) m.play().catch(() => {}); else if (!play && !m.paused) m.pause();
    });
  };
  return s;
}

function buildDetail(id, p, index, next, content) {
  const s = document.createElement('section');
  s.className = 'project project--detail'; s.id = id; s.dataset.project = id; s.setAttribute('aria-label', p.title);
  const head = `<h3 class="detail__title"><span class="index">${index}</span>${esc(p.title)}</h3>${body(p)}`;
  s.innerHTML = `
    ${p.media?.length ? gallery(p, head) : `<div class="detail detail--head">${head}</div>`}
    ${p.stream?.length ? stream(p) : ''}
    ${endLinks(next, content)}`;
  return s;
}

// Where the row sits for a scroll position from 0 to 1: each slide holds still, then eases across to the next.
const HOLD = 0.3;
function slidePos(p, n) {
  if (n < 2) return 0;
  const u = clamp(p) * (n - 1), i = Math.min(n - 2, Math.floor(u)), t = clamp((u - i - HOLD) / (1 - 2 * HOLD));
  return i + (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
}
function mountGallery(el) {
  const q = (sel) => [...el.querySelectorAll(sel)];
  const g = { el, cue: el.querySelector('.pcue'), track: el.querySelector('.gallery__track'), slides: q('.slide'), caps: q('.gallery__cap'), dots: q('.gallery__dots i'), count: el.querySelector('.gallery__count b'), media: q('.slide__frame > *'), step: 0, loaded: false, active: -1, pos: -1 };
  g.load = () => { if (g.loaded) return; g.loaded = true; g.media.forEach((m) => { m.src = m.dataset.src; if (m.tagName === 'VIDEO') m.preload = 'metadata'; }); };
  // Pictures take the room the heading leaves: as wide as the left two thirds allow, as tall as the screen allows.
  g.measure = () => {
    const main = el.querySelector('.gallery__main'), view = el.querySelector('.gallery__view');
    const stacked = getComputedStyle(main).gridTemplateColumns.split(' ').length < 2;
    const pad = parseFloat(getComputedStyle(g.track).paddingLeft) || 0;
    const wide = view.clientWidth - pad - (stacked ? pad : Math.min(120, Math.max(56, innerWidth * 0.07)));
    const tall = (stacked ? main.clientHeight - el.querySelector('.gallery__text').offsetHeight - 30 : main.clientHeight - 40) * 16 / 9;
    el.style.setProperty('--sw', `${Math.max(160, Math.min(wide, tall)).toFixed(0)}px`);
    const a = g.slides[0], b = g.slides[1]; g.step = b ? b.offsetLeft - a.offsetLeft : 0; g.pos = -1;
  };
  g.apply = (p, on) => {
    const n = g.slides.length, pos = slidePos(p, n);
    if (g.cue) g.cue.style.opacity = 1 - smooth(0.004, 0.05, p);
    if (Math.abs(pos - g.pos) > 0.0001) {
      g.pos = pos;
      g.track.style.transform = `translate3d(${(-pos * g.step).toFixed(1)}px,0,0)`;
      g.slides.forEach((s, i) => { const d = Math.min(1, Math.abs(i - pos)); s.style.transform = `scale(${1 - d * 0.1})`; s.style.opacity = 1 - d * 0.62; });
      g.caps.forEach((c, i) => { const a = clamp(1 - Math.abs(i - pos) * 2.4); c.style.opacity = a; c.style.transform = `translate3d(0,${((i - pos) * 10).toFixed(1)}px,0)`; c.style.visibility = a > 0.001 ? 'visible' : 'hidden'; });
    }
    const active = Math.round(pos);
    if (active !== g.active) {
      g.active = active;
      g.count.textContent = String(active + 1).padStart(2, '0');
      g.dots.forEach((d, i) => d.classList.toggle('on', i === active));
    }
    // A clip plays while it holds in the middle and waits while the row is moving.
    g.media.forEach((m, i) => {
      if (m.tagName !== 'VIDEO') return;
      const play = on && Math.abs(i - pos) < 0.01 && !REDUCED;
      if (play && m.paused) m.play().catch(() => {}); else if (!play && !m.paused) m.pause();
    });
  };
  return g;
}

export function mountWork(container, options = {}) {
  const { content } = options;
  const gl = hasWebGL();
  // Projects first, then research, each listed once.
  const order = [...new Set([...content.columns.flatMap((c) => c.items), ...(content.research?.items || [])])].filter((id) => content.projects[id]);
  const items = [], sections = [];
  order.forEach((id, i) => {
    const p = content.projects[id], next = order[i + 1], index = String(i + 1).padStart(2, '0');
    const cfg = ANIMATED[id];
    if (!cfg) { const el = buildDetail(id, p, index, next, content); container.appendChild(el); sections.push(el); return; }
    const el = buildAnimated(id, cfg, p, index, next, content);
    container.appendChild(el); sections.push(el);
    const q = (sel) => el.querySelector(sel);
    const item = {
      id, cfg, el, runway: q('.runway'), title: q('.title'), head: q('.head'), screen: q('.screen'), cadC: q('.cad'), video: q('.clip'), scan: q('.scan'), bar: q('.bar i'),
      copies: [...el.querySelectorAll('.point')], cue: q('.pcue'), cad: null, p: 0, loading: false, fit: 1, playing: false,
    };
    if (!gl) item.cadC.style.display = 'none';
    items.push(item);
  });
  const foot = document.createElement('div'); foot.className = 'after after--end'; foot.innerHTML = '<a class="after__back" href="#">Back to overview</a>'; container.appendChild(foot);
  const galleries = [...container.querySelectorAll('.gallery')].map(mountGallery);
  const streams = [...container.querySelectorAll('.stream')].map(mountStream);

  const size = () => {
    const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, w < 768 ? 1.5 : 2);
    items.forEach((it) => {
      const r = it.screen.getBoundingClientRect();
      if (r.height < 1) return;
      it.fit = h / r.height; // camera distances are set for a window that fills the screen's height
      if (it.cad) {
        it.cad.resize(w, h, dpr);
        // Measured against the section's own screen, so it's right wherever the page happens to be scrolled.
        const st = it.cadC.getBoundingClientRect();
        it.cad.setShift(r.left - st.left + r.width / 2 - st.width / 2, r.top - st.top + r.height / 2 - st.height / 2);
        const v = it.cfg.views[0];
        it.cad.setScatter({ ...v, dist: v.dist * it.fit }, w / h);
      }
    });
    galleries.forEach((g) => g.measure());
    streams.forEach((s) => s.measure());
  };
  const ensure = (it) => {
    if (it.loading) return; it.loading = true;
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
    const wipe = smooth(cfg.wipe[0], cfg.wipe[1], p), pct = wipe * 100;
    it.video.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    it.video.style.visibility = wipe > 0 ? 'visible' : 'hidden';
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
    // Footage that plays by itself once the model has given way to it.
    setPlaying(it, p >= cfg.clipAt);
    // Bullets: all of them stay on screen, and the one for what's showing now lights up.
    const vt = p >= cfg.clipAt ? it.video.currentTime : -1;
    it.copies.forEach((node, i) => {
      const at = cfg.copyAt[i] || [2, 3], edge = 0.018;
      const a = at.t
        ? (vt < 0 ? 0 : smooth(at.t[0], at.t[0] + 0.3, vt + (at.t[0] === 0 ? 0.3 : 0)) * (1 - smooth(at.t[1] - 0.3, at.t[1], vt)))
        : smooth(at[0], at[0] + edge, p) * (at[1] >= 1 ? 1 : 1 - smooth(at[1] - edge, at[1], p));
      node.style.setProperty('--on', a.toFixed(3));
    });
    it.bar.style.transform = `scaleX(${p})`;
    it.cue.style.opacity = 1 - smooth(0.002, 0.02, p);
  };

  // Smooth scrolling with a gentle glide, off for reduced motion and left native on touch.
  let lenis = null;
  if (!REDUCED && window.Lenis) lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
  const jump = (y) => { if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); };

  // Moving a gallery one picture sideways scrolls the page to where that picture holds still.
  const galleryAt = () => galleries.find((g) => { if (g.el.closest('.project').hidden) return false; const r = g.el.getBoundingClientRect(); return r.top <= 1 && r.bottom >= innerHeight - 1; });
  const goTo = (g, i) => {
    const n = g.slides.length; i = Math.max(0, Math.min(n - 1, i));
    const top = g.el.getBoundingClientRect().top + window.scrollY, y = top + (n > 1 ? i / (n - 1) : 0) * (g.el.offsetHeight - innerHeight);
    if (lenis) lenis.scrollTo(y, { duration: 0.9 }); else window.scrollTo({ top: y, behavior: REDUCED ? 'auto' : 'smooth' });
  };
  galleries.forEach((g) => {
    g.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-go]');
      if (b) { goTo(g, g.active + +b.dataset.go); return; }
      const s = e.target.closest('.slide'), i = g.slides.indexOf(s);
      if (s && i !== g.active) goTo(g, i);
    });
  });
  let sideAt = 0;
  addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 2) return;
    // Swiping sideways over a stream moves it the way the fingers go, by scrolling the page.
    const st = streams.find((x) => { if (x.el.closest('.project').hidden) return false; const r = x.el.getBoundingClientRect(); return r.top <= 1 && r.bottom >= innerHeight - 1; });
    if (st) {
      e.preventDefault();
      if (lenis) lenis.scrollTo(lenis.targetScroll - e.deltaX); else window.scrollBy(0, -e.deltaX);
      return;
    }
    const g = galleryAt();
    if (!g) return;
    e.preventDefault();
    const now = performance.now(), fresh = now - sideAt > 260; sideAt = now;
    if (fresh) goTo(g, g.active + Math.sign(e.deltaX));
  }, { passive: false });
  addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    const g = galleryAt();
    if (!g) return;
    e.preventDefault(); goTo(g, g.active + (e.key === 'ArrowRight' ? 1 : -1));
  });
  let touch = null;
  addEventListener('touchstart', (e) => { touch = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
  addEventListener('touchend', (e) => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch[0], dy = e.changedTouches[0].clientY - touch[1]; touch = null;
    const g = Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5 ? galleryAt() : null;
    if (g) goTo(g, g.active - Math.sign(dx));
  }, { passive: true });

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
    galleries.forEach((g) => {
      if (g.el.closest('.project').hidden) return;
      const r = g.el.getBoundingClientRect();
      if (r.top < H * 2.5 && r.bottom > -H) g.load();
      const on = r.top < H && r.bottom > 0;
      if (on) g.apply(clamp(-r.top / Math.max(1, r.height - H)), true);
      else if (g.on) g.apply(r.top >= H ? 0 : 1, false);
      g.on = on;
    });
    streams.forEach((s) => {
      if (s.el.closest('.project').hidden) return;
      const r = s.el.getBoundingClientRect();
      if (r.top < H * 2.5 && r.bottom > -H) s.load();
      const on = r.top < H && r.bottom > 0;
      if (on) s.apply(-r.top / Math.max(1, r.height - H), true);
      else if (s.on) s.apply(r.top >= H ? 0 : 1, false);
      s.on = on;
    });
  };
  size();
  addEventListener('resize', size);
  // The words under a picture change height once the fonts arrive, and the picture takes the room they leave.
  document.fonts?.ready.then(size);
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
