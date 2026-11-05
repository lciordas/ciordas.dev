// carousel-input: turns wheel and pointer drag into one snapping, springy position.
// A small nudge springs back. A full step lands on the next item.
import { REDUCED } from './_util.js';

export function mountCarouselInput(target, options = {}) {
  const {
    count = 12,
    wheelPerStep = 500, dragPerStep = 900,
    stiffness = 42, damping = 11,
    snapDelay = 150,
    onStep = () => {}, onTap = () => {}, onDragStart = () => {}, onDragEnd = () => {}, onMove = () => {},
    enabled = () => true,
  } = options;
  const s = { pos: 0, vel: 0, goal: 0, dragging: false, pressed: false, last: 0, index: 0 };
  let timer = 0;
  const snap = () => {
    const near = Math.round(s.goal);
    // Needs to pass about a third of the way to commit.
    const diff = s.goal - s.index;
    s.goal = Math.abs(diff) > 0.35 ? (Math.abs(diff) < 1 ? s.index + Math.sign(diff) : near) : s.index;
  };
  const onWheel = (e) => {
    if (!enabled()) return;
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    const dx = e.deltaMode === 1 ? e.deltaX * 40 : e.deltaX;
    s.goal += (Math.abs(dx) > Math.abs(d) ? dx : d) / wheelPerStep;
    onMove('wheel', d);
    clearTimeout(timer);
    timer = setTimeout(snap, snapDelay);
  };
  let sx = 0, sy = 0, lx = 0, lastT = 0, flick = 0, moved = false, goalAtPress = 0;
  const onDown = (e) => {
    if (!enabled() || e.button > 0) return;
    s.pressed = true; moved = false; sx = lx = e.clientX; sy = e.clientY; lastT = performance.now(); flick = 0; goalAtPress = s.goal;
    target.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!s.pressed) return;
    const dx = e.clientX - sx;
    if (!moved && Math.hypot(dx, e.clientY - sy) > 5) { moved = true; s.dragging = true; onDragStart(e); }
    if (moved) {
      s.goal = goalAtPress - dx / (e.pointerType === 'touch' ? dragPerStep * 0.45 : dragPerStep);
      const now = performance.now();
      flick = (e.clientX - lx) / Math.max(1, now - lastT);
      lx = e.clientX; lastT = now;
      onMove('drag', dx);
    }
  };
  const onUp = (e) => {
    if (!s.pressed) return;
    s.pressed = false;
    if (moved) {
      s.dragging = false;
      s.goal -= flick * 0.32;
      snap();
      onDragEnd(e);
    } else onTap(e);
  };
  target.addEventListener('wheel', onWheel, { passive: false });
  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onUp);
  return {
    state: s,
    set(i, instant) { s.goal = s.index = i; if (instant) { s.pos = i; s.vel = 0; } },
    update(dt) {
      if (REDUCED) { s.pos = s.goal; s.vel = 0; } else {
        const a = (s.goal - s.pos) * stiffness - s.vel * damping;
        s.vel += a * dt; s.pos += s.vel * dt;
      }
      const nearest = Math.round(s.pos);
      if (nearest !== s.last) { s.last = nearest; onStep(((nearest % count) + count) % count, nearest); }
      if (!s.dragging && Number.isInteger(s.goal)) s.index = s.goal;
      return s.pos;
    },
    destroy() {
      target.removeEventListener('wheel', onWheel);
      target.removeEventListener('pointerdown', onDown);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
    },
  };
}
