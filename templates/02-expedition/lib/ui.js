// DOM helpers: scrambled type-on text, bracket frames.
const GLYPHS = '!<>-_\\/[]{}=+*^?#0123456789ABCDEFXYZ';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const live = new WeakMap();

// Type text in with a noisy leading edge. Set hide:true to erase it the same way.
export function scramble(el, text, { duration = .9, delay = 0, hide = false, trail = 7, onTick } = {}) {
  const prev = live.get(el); if (prev) cancelAnimationFrame(prev.raf);
  const handle = { raf: 0 };
  live.set(el, handle);
  if (reduced()) { el.textContent = hide ? '' : text; return handle; }
  const start = performance.now() + delay * 1000;
  let last = 0;
  if (!hide) el.textContent = '';
  const N = text.length;
  const frame = (now) => {
    if (now < start) { handle.raf = requestAnimationFrame(frame); return; }
    if (now - last > 32) {
      last = now;
      const p = Math.min(1, (now - start) / (duration * 1000));
      const shown = hide ? Math.floor((1 - p) * N) : Math.floor(p * N);
      let s = text.slice(0, shown);
      const tail = Math.min(trail, hide ? shown : N - shown);
      for (let i = 0; i < tail; i++) {
        const c = text[shown + i];
        s += (c === '\n' || c === ' ') ? (c || ' ') : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      el.textContent = s;
      if (onTick) onTick(p);
      if (p >= 1) { el.textContent = hide ? '' : text; return; }
    }
    handle.raf = requestAnimationFrame(frame);
  };
  handle.raf = requestAnimationFrame(frame);
  return handle;
}

export function bracket(el) {
  ['tl', 'tr', 'bl', 'br'].forEach((c) => { const i = document.createElement('i'); i.className = 'br-' + c; el.appendChild(i); });
  el.classList.add('bracket');
  return el;
}
