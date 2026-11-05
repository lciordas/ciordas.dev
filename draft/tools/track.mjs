// Follows movement through a video, for steadying footage. Positions come back as fractions of the frame.
import { execFileSync } from 'node:child_process';
const W = 480, H = 270;
const grab = (file, ss, t, pre = '') => {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(ss), '-t', String(t), '-i', file, '-vf', `${pre ? `${pre},` : ''}fps=30,scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 2 ** 31 });
  return { raw, n: Math.floor(raw.length / (W * H)) };
};
const median = (v) => { const s = [...v].sort((p, q) => p - q); return s[s.length >> 1]; };
const refine = (l, c, r) => { const d = l + r - 2 * c; return d > 0 ? (l - r) / (2 * d) : 0; };
function match(a, b, x, y, pw, ph, R, ox = 0, oy = 0) {
  const sad = (dx, dy) => { let s = 0; for (let j = 0; j < ph; j += 2) for (let i = 0; i < pw; i += 2) s += Math.abs(a[(y + j) * W + x + i] - b[(y + j + dy) * W + x + i + dx]); return s; };
  const ok = (dx, dy) => x + dx >= 0 && y + dy >= 0 && x + dx + pw < W && y + dy + ph < H;
  let best = Infinity, bx = 0, by = 0;
  for (let dy = oy - R; dy <= oy + R; dy++) for (let dx = ox - R; dx <= ox + R; dx++) { if (!ok(dx, dy)) continue; const s = sad(dx, dy); if (s < best) { best = s; bx = dx; by = dy; } }
  let fx = bx, fy = by;
  if (ok(bx - 1, by) && ok(bx + 1, by)) fx += refine(sad(bx - 1, by), best, sad(bx + 1, by));
  if (ok(bx, by - 1) && ok(bx, by + 1)) fy += refine(sad(bx, by - 1), best, sad(bx, by + 1));
  return [fx, fy];
}
// Camera movement, measured from patches around the edge of the picture.
export function trackCamera(file, ss, t, pre = '') {
  const { raw, n } = grab(file, ss, t, pre), PW = 48, PH = 32, patches = [];
  for (const x of [6, 70, 150, 282, 362, 426]) patches.push([x, 226]);
  for (const x of [6, 426]) for (const y of [6, 50, 100, 150]) patches.push([x, y]);
  for (const x of [130, 220, 310]) patches.push([x, 6]);
  const out = [[0, 0]]; let cx = 0, cy = 0;
  for (let f = 1; f < n; f++) {
    const a = raw.subarray((f - 1) * W * H, f * W * H), b = raw.subarray(f * W * H, (f + 1) * W * H);
    const es = [];
    for (const [x, y] of patches) {
      let detail = 0;
      for (let j = 0; j < PH; j++) for (let i = 1; i < PW; i++) detail += Math.abs(a[(y + j) * W + x + i] - a[(y + j) * W + x + i - 1]);
      if (detail / (PW * PH) >= 1.2) es.push(match(a, b, x, y, PW, PH, 10));
    }
    if (es.length) { cx += median(es.map((e) => e[0])); cy += median(es.map((e) => e[1])); }
    out.push([cx, cy]);
  }
  return out.map(([x, y]) => [x / W, y / H]);
}
// Where a moving subject goes, starting from a box around it. Compares against a few earlier frames to limit drift.
export function trackSubject(file, ss, t, box) {
  const { raw, n } = grab(file, ss, t);
  const frame = (f) => raw.subarray(f * W * H, (f + 1) * W * H);
  const pw = Math.round(box.w * W), ph = Math.round(box.h * H);
  let x = box.x * W, y = box.y * H;
  const out = [[x / W, y / H]];
  for (let f = 1; f < n; f++) {
    const px = Math.round(x), py = Math.round(y);
    const [dx, dy] = match(frame(f - 1), frame(f), Math.max(0, Math.min(W - pw - 1, px)), Math.max(0, Math.min(H - ph - 1, py)), pw, ph, 14);
    x += dx; y += dy;
    out.push([x / W, y / H]);
  }
  return out;
}
export const lowpass = (path, radius) => path.map((_, i) => {
  let a = 0, b = 0, c = 0;
  for (let k = Math.max(0, i - radius); k <= Math.min(path.length - 1, i + radius); k++) { a += path[k][0]; b += path[k][1]; c++; }
  return [a / c, b / c];
});
