// keynav: on the portfolio, the down and up arrows, Page Down and Page Up, and Space and Shift+Space move a whole
// step at a time instead of nudging the page: to the next or previous stop, read from the page as it is now. The
// stops are the top of each project, the moments its model is built, its video shows and each slide is in, the end
// of its scrolling part, the start and end of each stream, each gallery picture, and the links at the end. On the
// overview the arrows still move between the cards (site.js), and past the last row (or with no card on screen) they
// move the page on a step here, into the projects; the page keys go between its two parts.
import { REDUCED } from './_util.js';

const DOWN = new Set(['ArrowDown', 'PageDown']), UP = new Set(['ArrowUp', 'PageUp']);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

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

  let busy = false, queued = 0, guard = 0;
  // Presses still coming from skipping through the intro are held back for a moment, so they don't carry on into the
  // projects: for 0.7 s after the overview appears, longer while they keep coming, and never past 1.6 s.
  const t0 = performance.now();
  let holdUntil = t0 + 700;
  const done = () => {
    busy = false; clearTimeout(guard);
    if (queued) { const d = queued; queued = 0; go(d); }
  };
  const go = (dir) => {
    const y = lenis ? lenis.targetScroll : window.scrollY, tol = Math.max(6, innerHeight * 0.02), all = stops();
    const to = dir > 0 ? all.find((s) => s > y + tol) : [...all].reverse().find((s) => s < y - tol);
    if (to == null) {
      // Past the end of a project shown on its own, the next one opens.
      const id = dir > 0 && work.focused?.();
      if (id) document.getElementById(id)?.querySelector('.after__next')?.click();
      return;
    }
    if (!lenis || REDUCED) { window.scrollTo(0, to); return; }
    // Longer steps take a little longer, from 0.8 to 1.2 seconds.
    const t = Math.min(1.2, Math.max(0.8, 0.7 + Math.abs(to - y) / innerHeight * 0.15));
    busy = true;
    lenis.scrollTo(to, { duration: t, easing: ease, force: true, onComplete: done });
    // A wheel or touch in the middle can cut the glide short without finishing it.
    clearTimeout(guard); guard = setTimeout(done, t * 1000 + 250);
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
    if (busy) { queued = dir; return; }
    go(dir);
  });
}

// A project marked data-scroll-stop (work.js, from "scrollStop" in the content file) can't be flung past in one go:
// the first time a scroll down would carry the page beyond its end (its bottom at the bottom of the screen), the page
// glides to rest there and the rest of that scroll is let go. The next scroll carries on as usual. It's set again only
// once the page has gone back up above the project, and it never touches scrolling up, the keys or touch.
const HOLD_GAP = 180, HOLD_FRESH = 320, HOLD_EVEN = 900, HOLD_MAX = 3000;
function mountScrollStops(work) {
  const lenis = work.lenis;
  if (!lenis) return;
  const spent = new WeakSet();
  let held = 0, lastAt = 0, lastD = 0;
  const end = (s) => s.getBoundingClientRect().top + window.scrollY + s.offsetHeight - innerHeight;
  const lines = (e) => (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
  addEventListener('wheel', (e) => {
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const now = performance.now(), d = e.deltaY * lines(e), gap = now - lastAt, prev = lastD;
    lastAt = now; lastD = Math.abs(d);
    if (held) {
      // Let go when the scroll pauses, turns back up or comes again as a fresh push. A trackpad's glide dies away
      // and is held to its end (3 s at most); a steady stream, like a spun wheel, only for 0.9 s.
      const t = now - held, fresh = t > HOLD_FRESH && Math.abs(d) > prev * 1.6 + 4, steady = t > HOLD_EVEN && Math.abs(d) >= prev;
      if (d < 0 || gap > HOLD_GAP || fresh || steady || t > HOLD_MAX) held = 0;
      else { e.preventDefault(); e.stopImmediatePropagation(); return; }
    }
    const y = lenis.targetScroll, H = innerHeight;
    for (const s of document.querySelectorAll('#work .project[data-scroll-stop]')) {
      if (s.hidden || s.offsetParent === null) continue;
      const at = end(s), from = s.getBoundingClientRect().top + window.scrollY;
      // Back up above the project, it holds the next scroll again.
      if (window.scrollY < from - H) spent.delete(s);
      else if (spent.has(s)) continue;
      if (y >= at - 1) { spent.add(s); continue; }
      if (d <= 0 || y + d * 0.9 < at) continue;
      spent.add(s); held = now;
      e.preventDefault(); e.stopImmediatePropagation();
      lenis.scrollTo(at);
      return;
    }
  }, { passive: false, capture: true });
}
