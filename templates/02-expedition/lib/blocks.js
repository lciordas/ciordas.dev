// Rounded blocks bent through any mapping. Used for dome bricks, arch pieces and ring segments.
import * as THREE from 'three';
import { vn3 } from './math.js';

// map(x,y,z) takes box coordinates (x in +-hx, y in +-hy, z in +-hz) and returns [X,Y,Z].
export function bentBlock({ hx, hy, hz, map, nx = 12, ny = 8, nz = 4, round = .26, rough = .1, seed = 0 }) {
  const ix = hx - round, iy = hy - round, iz = hz - round;
  const index = new Map(); const pos = [], loc = [], edge = [], outer = [];
  const key = (i, j, k) => i + (nx + 1) * (j + (ny + 1) * k);
  const push = (i, j, k) => {
    const K = key(i, j, k); if (index.has(K)) return index.get(K);
    let x = (i / nx * 2 - 1) * hx, y = (j / ny * 2 - 1) * hy, z = (k / nz * 2 - 1) * hz;
    const cx = Math.max(-ix, Math.min(ix, x)), cy = Math.max(-iy, Math.min(iy, y)), cz = Math.max(-iz, Math.min(iz, z));
    let dx = x - cx, dy = y - cy, dz = z - cz; const l = Math.hypot(dx, dy, dz);
    if (l > 1e-5) { x = cx + dx / l * round; y = cy + dy / l * round; z = cz + dz / l * round; }
    const n = vn3(x * 1.1 + seed, y * 1.1 - seed, z * 1.1 + seed * 2) * .7 + vn3(x * 3.1 + seed, y * 3.1, z * 3.1) * .3 - .5;
    const zz = z + n * rough * 2, xx = x + n * rough * (y / hy), yy = y - n * rough * (x / hx);
    const p = map(xx, yy, zz);
    const id = pos.length / 3; pos.push(p[0], p[1], p[2]);
    loc.push(x + seed * 13.1, y + seed * 7.7, z - seed * 3.3);
    edge.push(Math.max(Math.abs(x) / hx, Math.abs(y) / hy));
    outer.push(Math.min(1, Math.max(0, (z / hz) * .5 + .5)));
    index.set(K, id); return id;
  };
  const idx = [];
  const quad = (a, b, c, d) => idx.push(a, b, c, a, c, d);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    quad(push(i, j, nz), push(i + 1, j, nz), push(i + 1, j + 1, nz), push(i, j + 1, nz));
    quad(push(i, j + 1, 0), push(i + 1, j + 1, 0), push(i + 1, j, 0), push(i, j, 0));
  }
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    quad(push(i, ny, k + 1), push(i + 1, ny, k + 1), push(i + 1, ny, k), push(i, ny, k));
    quad(push(i, 0, k), push(i + 1, 0, k), push(i + 1, 0, k + 1), push(i, 0, k + 1));
  }
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    quad(push(nx, j, k), push(nx, j + 1, k), push(nx, j + 1, k + 1), push(nx, j, k + 1));
    quad(push(0, j, k + 1), push(0, j + 1, k + 1), push(0, j + 1, k), push(0, j, k));
  }
  return { pos, idx, loc, edge, outer };
}

// Merge blocks into one buffer. Each block keeps an id, centre, random axis and height factor.
export function mergeBlocks(blocks) {
  let nv = 0, ni = 0; for (const b of blocks) { nv += b.pos.length / 3; ni += b.idx.length; }
  const P = new Float32Array(nv * 3), L = new Float32Array(nv * 3), C = new Float32Array(nv * 3), A = new Float32Array(nv * 3), M = new Float32Array(nv * 4);
  const I = new Uint32Array(ni); let v = 0, n = 0;
  blocks.forEach((b, id) => {
    const count = b.pos.length / 3;
    const c = b.center, a = b.axis;
    P.set(b.pos, v * 3); L.set(b.loc, v * 3);
    for (let i = 0; i < count; i++) {
      const o = (v + i);
      C[o * 3] = c[0]; C[o * 3 + 1] = c[1]; C[o * 3 + 2] = c[2];
      A[o * 3] = a[0]; A[o * 3 + 1] = a[1]; A[o * 3 + 2] = a[2];
      M[o * 4] = id; M[o * 4 + 1] = b.top; M[o * 4 + 2] = b.edge[i]; M[o * 4 + 3] = b.outer[i];
    }
    for (let i = 0; i < b.idx.length; i++) I[n + i] = b.idx[i] + v;
    v += count; n += b.idx.length;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('aLocal', new THREE.BufferAttribute(L, 3));
  g.setAttribute('aCenter', new THREE.BufferAttribute(C, 3));
  g.setAttribute('aAxis', new THREE.BufferAttribute(A, 3));
  g.setAttribute('aMeta', new THREE.BufferAttribute(M, 4));
  g.setIndex(new THREE.BufferAttribute(I, 1));
  g.computeVertexNormals();
  return g;
}
