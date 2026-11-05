// Scroll position is measured in "notches" (one wheel click is one notch). The loop is continuous.
import { monotone } from '../lib/math.js';

export function buildTimeline(nCrystals = 2) {
  const extra = Math.max(0, nCrystals - 2);
  const dN = extra * 13, dY = extra * 48;
  const crystalY = (i) => -58 - 48 * i;
  const crystalN = (i) => 18 + 13 * i;
  const LOOP_BASE = 600;
  const k = [];
  const add = (n, px, py, pz, tx, ty, tz) => k.push([n, px, py, pz, tx, ty, tz]);
  // Intro section: pull back, lift, then sink through the wipe
  add(0, -4, 12.5, 62, 1.5, 6.6, 0);
  add(4, -4, 12.8, 66, 1.4, 7, 0);
  add(8, -3, 13.5, 74, 1, 6.5, 0);
  add(10, -1, 11, 90, .5, 2.5, 0);
  add(12, 0, 2, 100, 0, -10, 0);
  add(13, 0, -12, 103, 0, -25, 0);
  // Crystal sections
  for (let i = 0; i < nCrystals; i++) {
    const n = crystalN(i), y = crystalY(i);
    add(n - 4, 0, y + 16, 105, 0, y + 16, 65);
    add(n - 2, 0, y + 7.5, 105, 0, y + 7.5, 65);
    add(n, 0, y, 105, 0, y, 65);
    add(n + 2, 0, y - 7.5, 105, 0, y - 7.5, 65);
    add(n + 4, 0, y - 18, 105, 0, y - 18, 65);
  }
  const sN = (n) => n + dN, sY = (y) => y - dY;
  // Tilt down to the ring shaft
  add(sN(36.2), 0, sY(-133), 108, 0, sY(-158), 68);
  add(sN(37.5), 0, sY(-139), 118, 0, sY(-192), 63);
  add(sN(39.5), 0, sY(-147), 100, 0, sY(-226), 60.4);
  add(sN(41.5), 0, sY(-158), 78, 0, sY(-240), 60.1);
  add(sN(43.5), 0, sY(-166), 60.2, 0, sY(-240), 60);
  // Portal passes: slow approach, quick plunge
  add(sN(44), 0, sY(-168), 60.2, 0, sY(-300), 60);
  add(sN(48), 0, sY(-182), 60.2, 0, sY(-300), 60);
  add(sN(52), 0, sY(-200), 60.2, 0, sY(-300), 60);
  add(sN(53.1), 0, sY(-225), 60.2, 0, sY(-340), 60);
  add(sN(54.2), 0, sY(-248), 60.2, 0, sY(-340), 60);
  add(sN(58), 0, sY(-266), 60.2, 0, sY(-380), 60);
  add(sN(62), 0, sY(-292), 60.2, 0, sY(-400), 60);
  add(sN(63.1), 0, sY(-312), 60.2, 0, sY(-420), 60);
  add(sN(64.2), 0, sY(-331), 60.2, 0, sY(-440), 60);
  add(sN(68), 0, sY(-349), 60.2, 0, sY(-470), 60);
  add(sN(70), 0, sY(-362), 60.2, 0, sY(-480), 60);
  add(sN(71.1), 0, sY(-375), 60.2, 0, sY(-490), 60);
  add(sN(72.2), 0, sY(-392), 60.2, 0, sY(-500), 60);
  // Down onto the platform, then level out, looking slightly up at the form
  add(sN(76), 0, sY(-414), 60.3, 0, sY(-500), 60);
  add(sN(80), 0, sY(-432), 74, 0, sY(-497), 60);
  add(sN(84), 0, sY(-478), 100, 0, sY(-490), 60);
  add(sN(88), 0, sY(-494.4), 107, 0, sY(-488), 60);
  add(sN(96), 0, sY(-494.4), 110, 0, sY(-488), 60);
  add(sN(104), 0, sY(-494), 114, 0, sY(-488), 60);
  add(sN(108), 0, sY(-493.6), 118, 0, sY(-488), 60);
  // Fall through to the next loop
  add(sN(110), 0, sY(45 - LOOP_BASE), 84, 0, sY(44 - LOOP_BASE), 40);
  add(sN(112), -1, sY(36 - LOOP_BASE), 66, 1, sY(33 - LOOP_BASE), 0);
  add(sN(114), -3, sY(22 - LOOP_BASE), 63, 1.4, sY(17 - LOOP_BASE), 0);
  add(sN(116), -4, sY(12.5 - LOOP_BASE), 62, 1.5, sY(6.6 - LOOP_BASE), 0);

  const xs = k.map((r) => r[0]);
  const fns = [1, 2, 3, 4, 5, 6].map((c) => monotone(xs, k.map((r) => r[c])));
  const total = sN(116);
  return {
    total, dN, dY,
    loopY: sY(-LOOP_BASE),
    sN, sY,
    camera: (n, out) => { for (let i = 0; i < 6; i++) out[i] = fns[i](n); return out; },
    crystals: Array.from({ length: nCrystals }, (_, i) => ({ y: crystalY(i), n: crystalN(i), z: 65 })),
    ringYs: [sY(-240), sY(-325), sY(-380)], ringPos: [0, 0, 60],
    platformY: sY(-500),
  };
}
