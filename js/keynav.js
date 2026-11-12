// keynav: on the portfolio, the down and up arrows, Page Down and Page Up, and Space and Shift+Space move a whole
// step at a time instead of nudging the page: to the next or previous stop, read from the page as it is now. The
// stops are the top of each project, the moments its model is built, its video shows and each slide is in, the end
// of its scrolling part, the start and end of each stream, each gallery picture, and the links at the end. On the
// overview the arrows still move between the cards (site.js), and past the last row (or with no card on screen) they
// move the page on a step here, into the projects; the page keys go between its two parts.
// A single press glides there. A press while the page is still gliding goes straight on to the stop after, carrying
// the speed it already has, and a key held down runs through the stops very fast.
import { REDUCED } from './_util.js';

const DOWN = new Set(['ArrowDown', 'PageDown']), UP = new Set(['ArrowUp', 'PageUp']);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
// Eases from a starting speed (m, as a share of the average speed of the whole step) to rest.
const carry = (m) => (t) => (m - 2) * t * t * t + (3 - 2 * m) * t * t + m * t;

export function mountKeynav({ work, root }) {
  if (new URLSearchParams(location.search).has('edit')) return;
  const lenis = work.lenis;
  const top = (el) => el.getBoundingClientRect().top + window.scrollY;
  const shown = (el) => el && !el.hidden && !el.closest('[hidden]') && el.offsetParent !== null;

  const stops = () => {
    const H = innerHeight, out = [0];
    // The overview: its top and its project cards.
    const grid = root?.querySelector('.ov-projects');
    if (shown(grid)) out.push(top(grid) - (root.querySelector('.ov-bar')?.offsetHeight || 0));
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
          (c.slides || []).forEach((sl) => out.push(at(sl[1] + 0.02)));
        } else [0.25, 0.5, 0.75].forEach((p) => out.push(at(p)));
        out.push(at(1));
      }
      // A gallery holds each picture still at an even step through its length.
      s.querySelectorAll('.gallery').forEach((g) => {
        const y0 = top(g), len = g.offsetHeight - H, n = g.querySelectorAll('.slide').length;
        for (let i = 0; i < n; i++) out.push(y0 + (n > 1 ? i / (n - 1) : 0) * len);
      });
      // A stream drifts along, so a long one goes in steps of about a screen.
      s.querySelectorAll('.stream').forEach((st) => {
        const y0 = top(st), len = st.offsetHeight - H, n = Math.max(1, Math.ceil(len / (H * 1.25)));
        for (let i = 0; i <= n; i++) out.push(y0 + (i / n) * len);
      });
      // The end links, at the bottom of the screen.
      s.querySelectorAll('.after').forEach((a) => out.push(top(a) + a.offsetHeight - H));
      // A project that holds a scroll at its end (below) is a stop there too.
      if (s.hasAttribute('data-scroll-stop')) out.push(top(s) + s.offsetHeight - H);
    });
    const max = document.documentElement.scrollHeight - H;
    // Stops closer together than half a screen count as one.
    const sorted = out.map((y) => Math.round(Math.max(0, Math.min(max, y)))).sort((a, b) => a - b), kept = [];
    sorted.forEach((y) => { if (!kept.length || y - kept[kept.length - 1] > H * 0.5) kept.push(y); });
    return kept;
  };

  // Presses still coming from skipping through the intro are held back for a moment, so they don't carry on into the
  // projects: for 0.7 s after the overview appears, longer while they keep coming, and never past 1.6 s.
  const t0 = performance.now();
  let holdUntil = t0 + 700;
  // How fast the page is moving, in pixels a second.
  let vy = 0, py = window.scrollY, pt = t0;
  lenis?.on('scroll', () => { const now = performance.now(), dt = now - pt; if (dt > 0) vy = ((window.scrollY - py) / dt) * 1000; py = window.scrollY; pt = now; });
  const go = (dir, held) => {
    // From where the page is headed: the end of a glide under way, or where it is.
    const running = lenis?.animate?.isRunning, y = lenis ? (running ? lenis.animate.to : lenis.targetScroll) : window.scrollY;
    const tol = Math.max(6, innerHeight * 0.02), all = stops();
    const to = dir > 0 ? all.find((s) => s > y + tol) : [...all].reverse().find((s) => s < y - tol);
    if (to == null) return;
    if (!lenis || REDUCED) { window.scrollTo(0, to); return; }
    // A key held down chases each next stop as it comes.
    if (held) { lenis.scrollTo(to, { lerp: 0.32, force: true }); return; }
    const from = lenis.animatedScroll, d = to - from, H = innerHeight;
    if (running && Math.abs(d) > 1) {
      // Mid-glide, it goes on without slowing first.
      const t = Math.min(0.8, Math.max(0.5, 0.45 + (Math.abs(d) / H) * 0.12)), v = performance.now() - pt < 120 ? vy : 0;
      lenis.scrollTo(to, { duration: t, easing: carry(Math.min(3, Math.max(0, (v * t) / d))), force: true });
      return;
    }
    // Longer steps take a little longer, from 0.8 to 1.2 seconds.
    const t = Math.min(1.2, Math.max(0.8, 0.7 + (Math.abs(d) / H) * 0.15));
    lenis.scrollTo(to, { duration: t, easing: ease, force: true });
  };

  mountScrollStops(work);

  addEventListener('keydown', (e) => {
    // The intro and the overview's cards take their keys first.
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const space = e.key === ' ';
    const dir = DOWN.has(e.key) || (space && !e.shiftKey) ? 1 : UP.has(e.key) || (space && e.shiftKey) ? -1 : 0;
    if (!dir || !document.body.classList.contains('is-portfolio')) return;
    const t = e.target;
    if (t?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]') || (space && t?.closest?.('button, video'))) return;
    e.preventDefault();
    const now = performance.now();
    if (now < holdUntil) { holdUntil = Math.min(t0 + 1600, now + 450); return; }
    go(dir, e.repeat);
  });
}

// A project marked data-scroll-stop (work.js, from "scrollStop" in the content file) catches a scroll down at its end.
// When a scroll would carry the page past it, the page glides to rest with the project's bottom at the bottom of the
// screen, and what is left of that scroll (a trackpad's glide dying away) is held back. Anything that looks like the
// visitor scrolling on lets go at once: a pause of a fifth of a second, a scroll that picks up again after slowing,
// one that keeps its pace instead of dying away, a scroll back up, or the keys moving the page. It never holds for
// more than a second. Each stop catches once on the way down, and again only after the page has gone back up above
// it. Touch is never held.
const GAP = 180, SETTLE = 250, MAX = 1000;
function mountScrollStops(work) {
  const lenis = work.lenis;
  if (!lenis) return;
  const passed = new WeakSet();
  // The scroll going on, as [time, distance, how long it took] steps over the last half second, and the hold while a
  // stop has it.
  let steps = [], hold = null, last = -1e9;
  const end = (s) => s.getBoundingClientRect().top + window.scrollY + s.offsetHeight - innerHeight;
  const lines = (e) => (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
  const swallow = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
  // Where the page is headed: the end of a glide under way, or where it is.
  const headed = () => (lenis.animate.isRunning ? lenis.animate.to : lenis.targetScroll);
  // How fast the scroll went over the w milliseconds up to t, in pixels per millisecond. Each step is spread over the
  // time since the one before, so steps a busy page has run together don't read as a burst of speed.
  const rate = (t, w) => { let n = 0; for (const [at, d, dt] of steps) n += (d * Math.max(0, Math.min(at, t) - Math.max(at - dt, t - w))) / dt; return n / w; };
  addEventListener('wheel', (e) => {
    if (e.ctrlKey || !e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const now = e.timeStamp || performance.now(), gap = now - last, d = e.deltaY * lines(e);
    last = now;
    if (d < 0 || gap > GAP) steps = [];
    if (d > 0) { steps.push([now, d, gap > GAP ? 16 : Math.max(1, gap)]); while (steps[0][0] < now - 500) steps.shift(); }
    const marked = [...document.querySelectorAll('#work .project[data-scroll-stop]')].filter((s) => s.offsetParent !== null);
    marked.forEach((s) => { if (window.scrollY < end(s) - innerHeight * 0.6) passed.delete(s); });
    if (hold) {
      const h = hold, r = rate(now, 100), at = end(h.s);
      // Signs of the visitor scrolling on: a pause, picking up again after slowing down, or still going at nearly its
      // top speed a quarter of a second on, where a glide would be dying away. Once the page has come to rest at the
      // stop, it carries on.
      if (gap > GAP || (h.low < h.peak * 0.75 && r > h.low * 1.5 + 0.1) || (now - h.peakAt > SETTLE && r >= h.peak * 0.8)) h.on = true;
      if (d < 0 || (h.on && Math.abs(window.scrollY - at) <= 12) || now - h.t0 > MAX || Math.abs(headed() - at) > 4) {
        passed.add(h.s); hold = null;
        return;
      }
      if (r > h.peak) { if (r > h.peak * 1.05) h.peakAt = now; h.peak = h.low = r; } else h.low = Math.min(h.low, r);
      swallow(e);
      return;
    }
    if (d < 0) return;
    const y = headed();
    for (const s of marked) {
      const at = end(s);
      if (passed.has(s) || y > at + 2) continue;
      // Already resting at its end (the keys took it there): the scroll goes on.
      if (!lenis.animate.isRunning && Math.abs(window.scrollY - at) <= 2) { passed.add(s); return; }
      if (y + d * lenis.options.wheelMultiplier >= at - 1) {
        const r = rate(now, 100);
        hold = { s, t0: now, peak: r, low: r, peakAt: now };
        swallow(e);
        lenis.scrollTo(at);
      }
      return;
    }
  }, { passive: false, capture: true });
}
