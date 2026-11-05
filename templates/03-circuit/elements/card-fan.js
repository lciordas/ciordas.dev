import { gsap, reduced, isPhone, rem, lerp, clamp, isTouch } from './_core.js';

// Half a fan at 1440, mirrored: [rotation deg, scale, x, y] in px at the reference width.
const FAN = [[0, 1, 0, 0], [6.97, 0.935, 146, 17.3], [14.06, 0.849, 294.5, 53.5], [21.4, 0.771, 408, 99.3]];
const pose = (i, n) => { const o = i - (n - 1) / 2; const a = FAN[Math.min(3, Math.round(Math.abs(o)))]; const s = Math.sign(o); return { r: a[0] * s, sc: a[1], x: a[2] * s * 0.075, y: a[3] * 0.075 }; };

// Cards spread out of a stack on scroll. The hovered card lifts and pushes its neighbors aside.
export function mountCardFan(root, { trigger, start = 'top 95%', end = 'top 40%' } = {}) {
  const cards = [...root.querySelectorAll('.fan-card')]; const n = cards.length;
  const state = cards.map((c, i) => ({ c, i, p: pose(i, n), lift: 0, push: 0, sx: 0 }));
  state.forEach((s) => { s.c.style.zIndex = 10 - Math.abs(s.i - (n - 1) / 2); });
  const open = { v: reduced() ? 1 : 0 }; let hover = -1; let mx = 0; const phoneScale = () => (isPhone() ? 0.8 : 1);
  if (!reduced()) gsap.to(open, { v: 1, ease: 'power2.out', scrollTrigger: { trigger: trigger || root, start, end, scrub: 0.5 } });
  if (!isTouch()) {
    cards.forEach((c, i) => { c.addEventListener('pointerenter', () => { hover = i; }); c.addEventListener('pointerleave', () => { if (hover === i) hover = -1; }); });
    root.addEventListener('pointermove', (e) => { const r = root.getBoundingClientRect(); mx = ((e.clientX - r.left) / r.width - 0.5) * 2; });
    root.addEventListener('pointerleave', () => { mx = 0; });
  }
  let smx = 0;
  const draw = () => {
    const R = rem() * phoneScale(); const v = open.v;
    smx = lerp(smx, mx, 0.06);
    for (const s of state) {
      const d = hover < 0 ? 0 : s.i - hover;
      const tL = d === 0 && hover >= 0 ? 1 : 0;
      const tP = hover < 0 || d === 0 ? 0 : Math.sign(d) * (2.6 / Math.abs(d));
      s.lift = lerp(s.lift, tL, 0.09); s.push = lerp(s.push, tP, 0.09);
      const x = (s.p.x * v + s.push + smx * 0.5) * R;
      const y = (s.p.y * v + (1 - v) * 4 - s.lift * 1.8) * R;
      s.c.style.transform = `translate3d(${x}px,${y}px,0) rotate(${s.p.r * v}deg) scale(${lerp(0.9, s.p.sc, v) + s.lift * 0.035})`;
      s.c.style.zIndex = hover === s.i ? 20 : 10 - Math.abs(s.i - (n - 1) / 2);
    }
  };
  gsap.ticker.add(draw);
  return { root };
}
