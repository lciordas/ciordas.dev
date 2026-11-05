// Turns an STL export into a compact binary: separate parts, simplified meshes, crisp normals, and CAD edge lines.
// Run from the repo root: node draft/tools/build-cad.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../toolkit/x.js'));
const { MeshoptSimplifier } = require('meshoptimizer');
await MeshoptSimplifier.ready;
const HOME = os.homedir();
const MODELS = {
  seesaw: { file: `${HOME}/Downloads/pid seesaw w ball reference.stl`, ratio: 1, error: 0 },
  dog: { file: `${HOME}/Downloads/robot dog reference.stl`, ratio: 0.3, error: 0.004 },
};
const CREASE = Math.cos((32 * Math.PI) / 180);

function readStl(file) {
  const b = fs.readFileSync(file), n = b.readUInt32LE(80), P = new Float32Array(n * 9);
  let o = 84;
  for (let i = 0; i < n; i++) { o += 12; for (let k = 0; k < 9; k++) { P[i * 9 + k] = b.readFloatLE(o); o += 4; } o += 2; }
  return { n, P };
}
function weld({ n, P }) {
  const map = new Map(), idx = new Uint32Array(n * 3), pos = [];
  for (let i = 0; i < n * 3; i++) {
    const k = `${Math.round(P[i * 3] * 500)},${Math.round(P[i * 3 + 1] * 500)},${Math.round(P[i * 3 + 2] * 500)}`;
    let v = map.get(k);
    if (v === undefined) { v = pos.length / 3; map.set(k, v); pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); }
    idx[i] = v;
  }
  return { idx, pos: Float32Array.from(pos) };
}
function components(idx, vc) {
  const par = new Int32Array(vc).map((_, i) => i);
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]); par[find(idx[t + 1])] = a; par[find(idx[t + 2])] = a; }
  const groups = new Map();
  for (let t = 0; t < idx.length; t += 3) { const r = find(idx[t]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(idx[t], idx[t + 1], idx[t + 2]); }
  return [...groups.values()];
}
function buildPart(tris, pos, cfg) {
  // Local vertex table.
  const remap = new Map(); const lp = [];
  const local = tris.map((v) => { let l = remap.get(v); if (l === undefined) { l = lp.length / 3; remap.set(v, l); lp.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); } return l; });
  let indices = Uint32Array.from(local); const lpos = Float32Array.from(lp);
  if (cfg.ratio < 1 && indices.length > 900) {
    const target = Math.max(300, Math.floor((indices.length * cfg.ratio) / 3) * 3);
    const [out] = MeshoptSimplifier.simplify(indices, lpos, 3, target, cfg.error, ['LockBorder']);
    indices = out;
  }
  // Face normals, then split each vertex wherever the surface creases.
  const F = indices.length / 3, fn = new Float32Array(F * 3), vf = new Map();
  for (let f = 0; f < F; f++) {
    const [a, b, c] = [indices[f * 3], indices[f * 3 + 1], indices[f * 3 + 2]];
    const ux = lpos[b * 3] - lpos[a * 3], uy = lpos[b * 3 + 1] - lpos[a * 3 + 1], uz = lpos[b * 3 + 2] - lpos[a * 3 + 2];
    const wx = lpos[c * 3] - lpos[a * 3], wy = lpos[c * 3 + 1] - lpos[a * 3 + 1], wz = lpos[c * 3 + 2] - lpos[a * 3 + 2];
    fn[f * 3] = uy * wz - uz * wy; fn[f * 3 + 1] = uz * wx - ux * wz; fn[f * 3 + 2] = ux * wy - uy * wx; // length is twice the area
    for (const v of [a, b, c]) { if (!vf.has(v)) vf.set(v, []); vf.get(v).push(f); }
  }
  const unit = (f) => { const x = fn[f * 3], y = fn[f * 3 + 1], z = fn[f * 3 + 2], l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const outP = [], outN = [], outI = new Uint32Array(indices.length), corner = new Map();
  for (const [v, faces] of vf) {
    const clusters = [];
    for (const f of faces) {
      const n = unit(f);
      let c = clusters.find((g) => g.n0[0] * n[0] + g.n0[1] * n[1] + g.n0[2] * n[2] > CREASE);
      if (!c) { c = { n0: n, sum: [0, 0, 0], faces: [] }; clusters.push(c); }
      c.sum[0] += fn[f * 3]; c.sum[1] += fn[f * 3 + 1]; c.sum[2] += fn[f * 3 + 2]; c.faces.push(f);
    }
    for (const c of clusters) {
      const id = outP.length / 3, l = Math.hypot(...c.sum) || 1;
      outP.push(lpos[v * 3], lpos[v * 3 + 1], lpos[v * 3 + 2]); outN.push(c.sum[0] / l, c.sum[1] / l, c.sum[2] / l);
      for (const f of c.faces) corner.set(`${f}:${v}`, id);
    }
  }
  for (let f = 0; f < F; f++) for (let k = 0; k < 3; k++) outI[f * 3 + k] = corner.get(`${f}:${indices[f * 3 + k]}`);
  // CAD edges: outlines and sharp folds.
  const edges = new Map();
  for (let f = 0; f < F; f++) for (let k = 0; k < 3; k++) {
    const a = indices[f * 3 + k], b = indices[f * 3 + ((k + 1) % 3)], key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (!edges.has(key)) edges.set(key, []); edges.get(key).push(f);
  }
  const lines = [];
  for (const [key, fs2] of edges) {
    let sharp = fs2.length !== 2;
    if (!sharp) { const n0 = unit(fs2[0]), n1 = unit(fs2[1]); sharp = n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] < CREASE; }
    if (sharp) { const [a, b] = key.split('_').map(Number); lines.push(lpos[a * 3], lpos[a * 3 + 1], lpos[a * 3 + 2], lpos[b * 3], lpos[b * 3 + 1], lpos[b * 3 + 2]); }
  }
  return { P: outP, N: outN, I: outI, L: lines };
}
for (const [name, cfg] of Object.entries(MODELS)) {
  const stl = readStl(cfg.file), { idx, pos } = weld(stl);
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], pos[i + a]); max[a] = Math.max(max[a], pos[i + a]); }
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const q = (v, a) => Math.round(((v - min[a]) / span) * 65535) - 32768;
  const parts = components(idx, pos.length / 3).map((t) => buildPart(t, pos, cfg)).sort((a, b) => b.I.length - a.I.length);
  const chunks = []; let off = 0; const meta = [];
  const put = (buf) => { const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; } const at = off; chunks.push(buf); off += buf.length; return at; };
  for (const p of parts) {
    const vc = p.P.length / 3, ps = new Int16Array(p.P.length), ns = new Int8Array(p.N.length), ls = new Int16Array(p.L.length);
    for (let i = 0; i < p.P.length; i++) ps[i] = q(p.P[i], i % 3);
    for (let i = 0; i < p.N.length; i++) ns[i] = Math.round(p.N[i] * 127);
    for (let i = 0; i < p.L.length; i++) ls[i] = q(p.L[i], i % 3);
    const wide = vc > 65535, ix = wide ? Uint32Array.from(p.I) : Uint16Array.from(p.I);
    let cx = 0, cy = 0, cz = 0; for (let i = 0; i < p.P.length; i += 3) { cx += p.P[i]; cy += p.P[i + 1]; cz += p.P[i + 2]; }
    meta.push({ vc, ic: p.I.length, lc: p.L.length, wide, pos: put(Buffer.from(ps.buffer)), nor: put(Buffer.from(ns.buffer)), idx: put(Buffer.from(ix.buffer)), lin: put(Buffer.from(ls.buffer)), center: [cx / vc, cy / vc, cz / vc] });
  }
  const dir = path.join(here, '../data/cad'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.bin`), Buffer.concat(chunks));
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify({ min, max, span, parts: meta }));
  const tri = meta.reduce((n, m) => n + m.ic / 3, 0), ln = meta.reduce((n, m) => n + m.lc / 6, 0);
  console.log(name, 'parts', meta.length, 'tris', stl.n, '->', tri, 'edges', ln, 'MB', (off / 1e6).toFixed(2), 'part centers', meta.slice(0, 5).map((m) => m.center.map((v) => +v.toFixed(0))).join(' | '));
}
