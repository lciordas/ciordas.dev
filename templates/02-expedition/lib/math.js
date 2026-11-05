// Small JS noise and helpers used to build geometry on the CPU.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const fract = (x) => x - Math.floor(x);
const h2 = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const h3 = (x, y, z) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
export function vn2(x, y) {
  const i = Math.floor(x), j = Math.floor(y); let f = x - i, g = y - j; f = f * f * (3 - 2 * f); g = g * g * (3 - 2 * g);
  return lerp(lerp(h2(i, j), h2(i + 1, j), f), lerp(h2(i, j + 1), h2(i + 1, j + 1), f), g);
}
export function vn3(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z); let f = x - i, g = y - j, l = z - k;
  f = f * f * (3 - 2 * f); g = g * g * (3 - 2 * g); l = l * l * (3 - 2 * l);
  const a = lerp(lerp(h3(i, j, k), h3(i + 1, j, k), f), lerp(h3(i, j + 1, k), h3(i + 1, j + 1, k), f), g);
  const b = lerp(lerp(h3(i, j, k + 1), h3(i + 1, j, k + 1), f), lerp(h3(i, j + 1, k + 1), h3(i + 1, j + 1, k + 1), f), g);
  return lerp(a, b, l);
}
export function fbm2(x, y, oct = 5) { let a = .5, s = 0; for (let i = 0; i < oct; i++) { s += a * vn2(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 9.2; a *= .5; } return s; }
export function fbm3(x, y, z, oct = 4) { let a = .5, s = 0; for (let i = 0; i < oct; i++) { s += a * vn3(x, y, z); x = x * 2.07 + 11.3; y = y * 2.07 + 4.7; z = z * 2.07 + 8.1; a *= .5; } return s; }
export function ridged2(x, y, oct = 5) { let a = .5, s = 0; for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(2 * vn2(x, y) - 1); s += a * n * n; x = x * 2.1 + 3.3; y = y * 2.1 + 1.7; a *= .5; } return s; }

// Monotone cubic interpolation so camera keys never overshoot.
export function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
