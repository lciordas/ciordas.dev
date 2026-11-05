// Virtual scroll: wheel and touch feed an endless value with heavy easing.
export function createInertia({ target = window, unit = 100, touchUnit = 150, ease = 5.4 } = {}) {
  const s = { goal: 0, value: 0, velocity: 0, locked: true };
  let touchY = null, lastY = 0, lastT = 0, fling = 0;
  const onWheel = (e) => {
    e.preventDefault();
    if (s.locked) return;
    const k = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1;
    s.goal += e.deltaY * k / unit;
  };
  const onStart = (e) => { if (s.locked || e.touches.length !== 1) return; touchY = lastY = e.touches[0].clientY; lastT = performance.now(); fling = 0; };
  const onMove = (e) => {
    if (touchY === null || s.locked) return;
    e.preventDefault();
    const y = e.touches[0].clientY, now = performance.now();
    s.goal += (lastY - y) / touchUnit;
    fling = (lastY - y) / Math.max(1, now - lastT);
    lastY = y; lastT = now;
  };
  const onEnd = () => { if (touchY === null) return; touchY = null; s.goal += fling * .4; fling = 0; };
  target.addEventListener('wheel', onWheel, { passive: false });
  target.addEventListener('touchstart', onStart, { passive: true });
  target.addEventListener('touchmove', onMove, { passive: false });
  target.addEventListener('touchend', onEnd);
  s.step = (dt) => {
    const prev = s.value;
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    s.value += (s.goal - s.value) * (1 - Math.exp(-(rm ? 16 : ease) * dt));
    s.velocity = (s.value - prev) / Math.max(dt, .001);
    return s.value;
  };
  s.destroy = () => { target.removeEventListener('wheel', onWheel); target.removeEventListener('touchstart', onStart); target.removeEventListener('touchmove', onMove); target.removeEventListener('touchend', onEnd); };
  return s;
}
