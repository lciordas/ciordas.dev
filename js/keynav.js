// keynav: the page moves a whole step at a time, from one full screen to the next, instead of scrolling freely. The
// stops are read from the page as it is now: the two screens of the overview, the top of each project, the moments its
// model is built, its video shows, each bullet over the video lights and each slide is in, the end of its scrolling
// part, the start and end of each stream (and steps of about a screen through it), each gallery picture, and the end
// of the page. Whatever plays with the scroll (the build, the wipes, the slides, the galleries and streams) plays on
// the way from one stop to the next.
// The down and up arrows, Page Down and Page Up, and Space and Shift+Space step through them. On the overview the
// arrows still move between the cards (site.js), and past the last row (or with no card on screen) they move the page
// on a step here. A press while the page is still gliding goes straight on to the stop after, carrying the speed it
// already has, and a key held down runs through the stops very fast.
// A scroll with a mouse wheel or trackpad does the same: one push is one step, however long the trackpad's glide
// carries on after it. A fresh push, even while that glide is still dying away, is another step, and a scroll that
// keeps going at a steady pace steps on each time the page arrives. The page never comes to rest between two stops:
// let go of the scroll bar between them and it settles on the nearest. Sideways scrolling over a gallery or a stream
// still moves that, and anywhere in a stream is a place to rest. Touch screens scroll as usual, and ?scroll=free brings
// back the free scrolling for the wheel and trackpad.
import { REDUCED } from './_util.js';

const DOWN = new Set(['ArrowDown', 'PageDown']), UP = new Set(['ArrowUp', 'PageUp']);
// Eases from a starting speed (m, as a share of the average speed of the whole step) to rest.
const carry = (m) => (t) => (m - 2) * t * t * t + (3 - 2 * m) * t * t + m * t;
// A step sets off at once, gently, and comes to rest softly.
const glide = carry(0.6);

const params = new URLSearchParams(location.search);
export const SNAP = !params.has('edit') && params.get('scroll') !== 'free' && !matchMedia('(hover: none) and (pointer: coarse)').matches;

// Wheel and trackpad gestures. This is heard from the moment the page loads (index.html loads this file before the
// intro), so a scroll that skipped through the intro is known as one and its trackpad glide is spent, not stepped on.
// A gesture is a run of scrolling with no pause longer than GAP. Inside one, a sudden pick-up in speed after it had
// been slowing down is a fresh push: a trackpad's glide only ever dies away.
const GAP = 200;
let g = null, wheelAt = -1e9, hist = [], onGesture = null;
// How fast the scroll went over the w milliseconds up to t, in pixels per millisecond. Each event is spread over the
// time since the one before, so events a busy page has run together don't read as a burst of speed.
const rate = (t, w) => { let n = 0; for (const [at, d, dt] of hist) n += (d * Math.max(0, Math.min(at, t) - Math.max(at - dt, t - w))) / dt; return n / w; };
if (SNAP) addEventListener('wheel', (e) => {
  if (e.ctrlKey) return; // pinch zoom
  const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1, dy = e.deltaY * k, dx = e.deltaX * k;
  const on = !!onGesture && document.body.classList.contains('is-portfolio');
  // The page itself never scrolls by the wheel; sideways scrolling goes on to the galleries and streams (work.js).
  if (on) e.preventDefault();
  if (!dy || Math.abs(dx) > Math.abs(dy)) return;
  const now = e.timeStamp || performance.now(), gap = now - wheelAt, d = Math.abs(dy), dir = Math.sign(dy);
  wheelAt = now;
  let fresh = !g || gap > GAP || dir !== g.dir;
  if (fresh) hist = [];
  hist.push([now, d, fresh ? 16 : Math.max(1, gap)]);
  while (hist[0][0] < now - 400) hist.shift();
  const r = rate(now, 50);
  if (!fresh && g.n > 4 && now - g.t0 > 120 && g.low < g.peak * 0.7 && r > g.low * 2 + 0.35 && r > 0.6) fresh = true;
  if (fresh) g = { dir, t0: now, n: 0, sum: 0, peak: 0, low: Infinity, done: !on };
  g.n++; g.sum += d;
  if (r > g.peak) { g.peak = g.low = r; } else g.low = Math.min(g.low, r);
  if (!on) { g.done = true; return; }
  onGesture(g, r, now);
}, { passive: false, capture: true });

export function mountKeynav({ work, root }) {
  if (params.has('edit')) return;
  const lenis = work.lenis;
  const top = (el) => el.getBoundingClientRect().top + window.scrollY;
  const shown = (el) => el && !el.hidden && !el.closest('[hidden]') && el.offsetParent !== null;
  // Stretches where any place is a whole screen to rest on: the streams, which also scroll sideways.
  let free = [];

  const stops = () => {
    const H = innerHeight, out = [0], loose = [];
    // The overview: its first screen, and its project cards filling the second. A first screen taller than the
    // window rests at its foot too.
    const grid = root?.querySelector('.ov-projects');
    if (shown(grid)) { const y = top(grid); if (y > H * 1.15) out.push(y - H); out.push(y); }
    document.querySelectorAll('#work .project').forEach((s) => {
      if (!shown(s)) return;
      out.push(top(s));
      // An animated project: its key moments, as positions through its runway.
      const it = work.items?.find((x) => x.el === s), run = s.querySelector('.runway');
      if (run) {
        const y0 = top(run), len = run.offsetHeight - H, at = (p) => y0 + Math.min(1, p) * len;
        if (it?.cfg) {
          const c = it.cfg;
          if (c.assemble) out.push(at(c.assemble[1]));
          if (c.clipAt != null) out.push(at(c.clipAt + 0.02));
          // Each bullet that lights over the video at its own place in the scroll.
          (c.copyAt || []).forEach((a) => { if (Array.isArray(a) && a[0] > c.clipAt) out.push(at(a[0] + 0.02)); });
          (c.slides || []).forEach((sl) => out.push(at(sl[1] + 0.02)));
        } else [0.25, 0.5, 0.75].forEach((p) => out.push(at(p)));
        out.push(at(1));
      }
      // A gallery holds each picture still at an even step through its length.
      s.querySelectorAll('.gallery').forEach((gl) => {
        const y0 = top(gl), len = gl.offsetHeight - H, n = gl.querySelectorAll('.slide').length;
        for (let i = 0; i < n; i++) out.push(y0 + (n > 1 ? i / (n - 1) : 0) * len);
      });
      // A stream drifts along, so a long one goes in steps of about a screen and a quarter.
      s.querySelectorAll('.stream').forEach((st) => {
        const y0 = top(st), len = st.offsetHeight - H, n = Math.max(1, Math.ceil(len / (H * 1.25)));
        for (let i = 0; i <= n; i++) out.push(y0 + (i / n) * len);
        loose.push([y0, y0 + len]);
      });
      // The end links, at the bottom of the screen.
      s.querySelectorAll('.after').forEach((a) => out.push(top(a) + a.offsetHeight - H));
    });
    const max = document.documentElement.scrollHeight - H;
    out.push(max);
    free = loose;
    // Stops closer together than about half a screen count as one.
    const sorted = out.map((y) => Math.round(Math.max(0, Math.min(max, y)))).sort((a, b) => a - b), kept = [];
    sorted.forEach((y) => { if (!kept.length || y - kept[kept.length - 1] > H * 0.45) kept.push(y); });
    if (kept[kept.length - 1] !== Math.round(max)) kept[kept.length - 1] = Math.round(max);
    return kept;
  };

  // Presses and pushes still coming from skipping through the intro are held back for a moment, so they don't carry on
  // into the projects: for 0.7 s after the overview appears, longer while they keep coming, and never past 1.6 s.
  const t0 = performance.now();
  let holdUntil = t0 + 700;
  const held = (now) => { if (now < holdUntil) { holdUntil = Math.min(t0 + 1600, now + 450); return true; } return false; };
  // How fast the page is moving, in pixels a second, and when it last arrived at a stop.
  let vy = 0, py = window.scrollY, pt = t0, restAt = 0, wasRunning = false;
  const running = () => !!lenis?.animate?.isRunning;
  lenis?.on('scroll', () => {
    const now = performance.now(), dt = now - pt;
    if (dt > 0) vy = ((window.scrollY - py) / dt) * 1000;
    py = window.scrollY; pt = now;
  });
  // Where the page is headed: the end of a glide under way, or where it is.
  const headed = () => (running() ? lenis.animate.to : window.scrollY);
  const glideTo = (to, t, easing = glide) => {
    if (!lenis || REDUCED) { window.scrollTo(0, to); return; }
    lenis.scrollTo(to, { duration: t, easing, force: true });
  };
  const go = (dir, hold) => {
    const y = headed(), tol = Math.max(6, innerHeight * 0.02), all = stops();
    const to = dir > 0 ? all.find((s) => s > y + tol) : [...all].reverse().find((s) => s < y - tol);
    if (to == null) return;
    if (!lenis || REDUCED) { window.scrollTo(0, to); return; }
    // A key held down chases each next stop as it comes.
    if (hold) { lenis.scrollTo(to, { lerp: 0.32, force: true }); return; }
    const from = lenis.animatedScroll, d = to - from, H = innerHeight;
    if (running() && Math.abs(d) > 1) {
      // Mid-glide, it goes on without slowing first.
      const t = Math.min(0.8, Math.max(0.5, 0.45 + (Math.abs(d) / H) * 0.12)), v = performance.now() - pt < 120 ? vy : 0;
      glideTo(to, t, carry(Math.min(3, Math.max(0, (v * t) / d))));
      return;
    }
    // Quick, a little longer for a longer step: from 0.6 s for a screen or less to 0.95 s for three.
    glideTo(to, Math.min(0.95, Math.max(0.6, 0.48 + (Math.abs(d) / H) * 0.15)));
  };

  addEventListener('keydown', (e) => {
    // The intro and the overview's cards take their keys first.
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const space = e.key === ' ';
    const dir = DOWN.has(e.key) || (space && !e.shiftKey) ? 1 : UP.has(e.key) || (space && e.shiftKey) ? -1 : 0;
    if (!dir || !document.body.classList.contains('is-portfolio')) return;
    const t = e.target;
    if (t?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]') || (space && t?.closest?.('button, video'))) return;
    e.preventDefault();
    if (held(performance.now())) return;
    go(dir, e.repeat);
  });

  if (!SNAP) return;
  // The wheel no longer moves the page through the smooth scroller; the steps below do.
  if (lenis) lenis.options.virtualScroll = (v) => !v.event?.type?.includes('wheel');
  // A gesture under way when the overview appeared was spent on the intro.
  if (g && performance.now() - wheelAt < GAP) g.done = true;
  onGesture = (gs, r, now) => {
    if (!gs.done) {
      // A light brush of a pixel or two isn't a push yet.
      if (gs.sum < 3) return;
      gs.done = true; gs.at = now;
      if (held(now)) return;
      go(gs.dir);
      return;
    }
    // Scrolling on at a steady pace, rather than a glide dying away, steps on once the page has arrived.
    if (!running() && now - restAt > 80 && now - gs.at > 450 && r > 0.12 && r >= gs.peak * 0.45) {
      gs.at = now; gs.peak = gs.low = r;
      go(gs.dir);
    }
  };

  // Never at rest between two stops: once the page has been still for a moment, with nothing held down, it settles on
  // the nearest one (after the scroll bar, a text selection that scrolled, the browser's find, or a resize).
  let down = false, touchAt = -1e9, timer = 0;
  const later = (ms = 260) => { clearTimeout(timer); timer = setTimeout(settle, ms); };
  const settle = () => {
    const now = performance.now();
    if (down || now - touchAt < 1500 || !document.body.classList.contains('is-portfolio') || document.getElementById('veil')?.classList.contains('on')) return;
    if (running() || now - wheelAt < 240 || lenis?.isScrolling) { later(); return; }
    const y = window.scrollY, all = stops(), tol = Math.max(3, innerHeight * 0.01);
    const near = all.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a), all[0]);
    if (Math.abs(near - y) <= tol || free.some(([a, b]) => y >= a - 1 && y <= b + 1)) return;
    glideTo(near, Math.min(0.8, Math.max(0.45, 0.4 + (Math.abs(near - y) / innerHeight) * 0.4)));
  };
  addEventListener('scroll', () => later(), { passive: true });
  addEventListener('resize', () => later(400));
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') touchAt = performance.now(); else if (e.button === 0) down = true; }, { passive: true, capture: true });
  const up = () => { if (down) { down = false; later(); } };
  addEventListener('pointerup', up, { passive: true, capture: true });
  addEventListener('mouseup', up, { passive: true, capture: true });
  addEventListener('pointermove', (e) => { if (down && !e.buttons) up(); }, { passive: true });
  addEventListener('touchstart', () => { touchAt = performance.now(); }, { passive: true });
  addEventListener('touchmove', () => { touchAt = performance.now(); }, { passive: true });
  // Arriving at a stop is marked, for the steady scroll above.
  const watch = () => { const r = running(); if (wasRunning && !r) restAt = performance.now(); wasRunning = r; requestAnimationFrame(watch); };
  requestAnimationFrame(watch);
  window.__snap = { stops, go, free: () => free };
}
