// Endless virtual scroll. onUpdate receives the eased position wrapped to [0, length).
// mountInertiaLoop(el, { length: 116, onUpdate(n, velocity) }) -> { destroy(), setPosition(n) }
import { createInertia } from '../lib/inertia.js';

export function mountInertiaLoop(el, { length = 116, unit = 100, onUpdate } = {}) {
  el.style.touchAction = 'none';
  const s = createInertia({ target: el, unit }); s.locked = false;
  let raf = 0, last = performance.now(), on = true;
  const loop = (now) => { if (!on) return; raf = requestAnimationFrame(loop); s.step(Math.min(.05, (now - last) / 1000)); last = now; onUpdate?.(((s.value % length) + length) % length, s.velocity); };
  raf = requestAnimationFrame(loop);
  return { destroy() { on = false; cancelAnimationFrame(raf); s.destroy(); }, setPosition(n) { s.goal = s.value = n; } };
}
