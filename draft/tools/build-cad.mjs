// Turns a STEP assembly into a compact binary: one part per solid, posed into place, simplified meshes,
// crisp normals, and CAD edge lines. All poses are baked into the vertices, so the page needs no pose code.
// Run from the repo root: node draft/tools/build-cad.mjs [model name]
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../toolkit/x.js'));
const { MeshoptSimplifier } = require('meshoptimizer');
const occtImport = require('occt-import-js');
await MeshoptSimplifier.ready;
const HOME = os.homedir();
const CREASE = Math.cos((32 * Math.PI) / 180);
const DEG = Math.PI / 180;

// --- Rigid transforms: 3x4 matrices, as [r00,r01,r02,tx, r10,r11,r12,ty, r20,r21,r22,tz].
const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
const then = (b, a) => { // a first, then b
  const o = new Array(12);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) o[r * 4 + c] = b[r * 4] * a[c] + b[r * 4 + 1] * a[4 + c] + b[r * 4 + 2] * a[8 + c];
    o[r * 4 + 3] = b[r * 4] * a[3] + b[r * 4 + 1] * a[7] + b[r * 4 + 2] * a[11] + b[r * 4 + 3];
  }
  return o;
};
const move = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
const chain = (...m) => m.reduceRight((acc, x) => then(x, acc), ID); // chain(c, b, a) applies a, then b, then c
const aroundY = (deg, px = 0, pz = 0) => { const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG); return chain(move(px, 0, pz), [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0], move(-px, 0, -pz)); };
const aroundZ = (deg, px = 0, py = 0) => { const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG); return chain(move(px, py, 0), [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0], move(-px, -py, 0)); };
const apply = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3], m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7], m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]];
// The two solutions where a pair of pinned links with lengths r1 (from a) and r2 (from b) meet, in a 2D plane.
function meet(a, r1, b, r2) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy), t = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - t * t));
  const mx = a[0] + (t * dx) / d, my = a[1] + (t * dy) / d;
  return [[mx + (h * dy) / d, my - (h * dx) / d], [mx - (h * dy) / d, my + (h * dx) / d]];
}

// --- Seesaw. STEP axes: X along the beam (the sensor end is -X), Y across it, Z up, pivot at the origin.
// The STEP gives the beam at 7.5 degrees with the sensor end down, and the other groups just laid out nearby.
// Left out on purpose: mesh 24, the plate under the servo mount, which isn't visible in the footage (the mount's
// feet stand on the cardboard, so it would be underneath, and here it would float), and meshes 25-26, a spare servo
// and horn from the robot dog file that isn't on the real machine.
function seesawPose() {
  const TILT = -8.5; // sensor end up, in degrees, measured off the first video frame (the ball is being placed)
  const BALL_ALONG = 94; // ball centre along the beam from the pivot, towards +X, measured off the same frame
  const BEAM = 7.5 + TILT;
  const beam = aroundY(BEAM);
  // Ball: slides along the groove (it is seated in it in the STEP at 80.06 mm), then tilts with the beam.
  const along = BALL_ALONG - 80.06, c0 = Math.cos(7.5 * DEG), s0 = Math.sin(7.5 * DEG);
  const ball = then(beam, move(along * c0, 0, along * s0));
  // Servo mount: its feet (z -50) go down onto the A-frame's foot plane (z -61.25). X and Y are read off the
  // footage, Y so that the shaft tip seats on the horn.
  const MOUNT = [-52.5, -4.85, -11.25];
  const mount = move(...MOUNT);
  // Linkage, a four-bar: beam pin, link, horn, servo shaft. The link's back face sits on the beam's flank.
  const LINK_Y = -11.63;
  const beamPin = apply(beam, [-140.47, 0, -5.63]);
  const P = [beamPin[0], beamPin[2]], S = [-55 + MOUNT[0], MOUNT[2]];
  const LA = [-124, 7.48], LB = [-145, -28.9], HA = [-145, -28.9], HB = [-111.77, -49.32]; // pin centres in the STEP
  const E = meet(P, Math.hypot(LA[0] - LB[0], LA[1] - LB[1]), S, Math.hypot(HA[0] - HB[0], HA[1] - HB[1])).sort((a, b) => a[1] - b[1])[0]; // the elbow on the far side from the pivot
  const pinned = (a0, b0, a1, b1) => { // takes the pin pair a0,b0 onto a1,b1 by turning about Y, with the link's Y shift
    const deg = (Math.atan2(b0[1] - a0[1], b0[0] - a0[0]) - Math.atan2(b1[1] - a1[1], b1[0] - a1[0])) / DEG;
    return chain(move(a1[0], LINK_Y, a1[1]), aroundY(deg), move(-a0[0], 0, -a0[1]));
  };
  const link = pinned(LA, LB, P, E), horn = pinned(HA, HB, E, S);
  console.log('seesaw: beam pin', P.map((v) => +v.toFixed(2)), 'elbow', E.map((v) => +v.toFixed(2)), 'shaft', S);
  return [
    { name: 'beam', meshes: [[6, beam]] },
    { name: 'ball', meshes: [[0, ball]], keep: true },
    { name: 'ir sensor', meshes: [[1, beam], [4, beam], [5, beam]] },
    { name: 'sensor lens a', meshes: [[2, beam]] },
    { name: 'sensor lens b', meshes: [[3, beam]] },
    { name: 'link', meshes: [[7, link]] },
    { name: 'link boss', meshes: [[8, link]] },
    { name: 'horn', meshes: [[9, horn]] },
    { name: 'horn boss', meshes: [[10, horn]] },
    { name: 'servo shaft', meshes: [[11, mount]] },
    { name: 'servo case', meshes: [[12, mount]] },
    ...[13, 14, 15, 16].map((i, k) => ({ name: `servo screw ${k + 1}`, meshes: [[i, mount]] })),
    { name: 'servo connector', meshes: [[18, mount]] },
    { name: 'servo', meshes: [[19, mount], [17, mount]] },
    ...[20, 21, 22].map((i, k) => ({ name: `servo wire ${k + 1}`, meshes: [[i, mount]] })),
    { name: 'servo mount', meshes: [[23, mount]] },
    { name: 'a-frame', meshes: [[27, ID]] },
    { name: 'pivot pin', meshes: [[28, ID]] },
    { name: 'pivot cap', meshes: [[29, ID]] },
  ];
}

// --- Robot dog. STEP axes: X up, Y along the body, Z across it. Each leg lies in an XY plane, and is a parallelogram:
// the thigh carries the knee servo, whose arm drives the shank through a rod that stays parallel to the thigh.
// Turning the thigh about the hip and the shank and arm by the same angle keeps every pin connected.
// In the footage the hip servo is coaxial with the knee servo: the hip servo sits in its housing with the shaft up
// (the STEP has it down, 20 mm lower), and the thigh's (4, 0) hole is on the hip shaft, not its (-20, 0) one.
// So here the hip servo is turned end for end, its horn is turned round on the thigh, and the thigh pivots at (4, 0).
// The angles are measured off the first video frame, with all four feet at the same height (x = -140.5).
const STANDING = {
  // Degrees. thigh: about the hip shaft, counterclockwise looking along -Z. knee: shank and arm, relative to the thigh.
  // side: the side servo tips the whole hip housing and leg about Y; positive lifts the +Z side.
  aNear: { thigh: -41.1, knee: 45.1, side: 8.6 },
  aFar: { thigh: -72.9, knee: 53.9, side: 4.5 },
  bNear: { thigh: -51.8, knee: 59.9, side: -11.6 },
  bFar: { thigh: -55.4, knee: 41.9, side: -13.5 },
};
function dogPose() {
  const REAR = -180; // the second pair of hips sits this far along Y
  // The STEP leaves out the near rear hip servo and horn, and has the near front pair twice, so that spare goes there.
  const spare = move(0, REAR, 0);
  const flipServo = (y) => aroundZ(180, -10, y); // about the middle of the servo, which is the middle of its housing
  const legs = [
    { key: 'aFar', base: 22, y: 0, axisZ: -116.3, kneeServo: 65, kneeHorn: 64, hipHorn: [3, ID], hipServo: [7, ID], housing: 11 },
    { key: 'bFar', base: 31, y: REAR, axisZ: -116.3, kneeServo: 63, kneeHorn: 62, hipHorn: [17, ID], hipServo: [18, ID], housing: 21, sideHorn: 19 },
    { key: 'aNear', base: 40, y: 0, axisZ: -29.3, kneeServo: 61, kneeHorn: 60, hipHorn: [2, ID], hipServo: [6, ID], housing: 10 },
    { key: 'bNear', base: 49, y: REAR, axisZ: -29.3, kneeServo: 14, kneeHorn: 13, hipHorn: [4, spare], hipServo: [8, spare], housing: 12, sideHorn: 15 },
  ];
  const parts = [
    { name: 'body', meshes: [[58, ID]], keep: true },
    { name: 'body bracket', meshes: [[59, ID]] },
    ...[66, 67, 68, 69].map((i, k) => ({ name: `servo bracket ${k + 1}`, meshes: [[i, ID]] })),
    ...[0, 1, 16, 20].map((i, k) => ({ name: `side servo ${k + 1}`, meshes: [[i, ID]] })),
  ];
  for (const { key, base, y, axisZ, kneeServo, kneeHorn, hipHorn, hipServo, housing, sideHorn } of legs) {
    const { thigh: t, knee: k, side } = STANDING[key];
    const tip = aroundY(side, -20.65, axisZ); // about the side servo's shaft
    const kneePin = [-81, y], armCentre = [4, y], armPin = [32.28, y + 28.28];
    const thigh = chain(tip, move(-4, 0, 0), aroundZ(t, ...armCentre)); // the (4, y) hole lands on the hip shaft at (0, y)
    const shank = then(thigh, aroundZ(k, ...kneePin));
    const arm = then(thigh, aroundZ(k, ...armCentre));
    const pinNow = apply(aroundZ(k, ...armCentre), [...armPin, 0]);
    const rod = then(thigh, move(pinNow[0] - armPin[0], pinNow[1] - armPin[1], 0));
    const horn = chain(thigh, aroundZ(180, -8, y), hipHorn[1]);
    if (sideHorn !== undefined) parts.push({ name: `${key} side servo horn`, meshes: [[sideHorn, tip]] });
    parts.push(
      { name: `${key} hip housing`, meshes: [[housing, tip]] },
      { name: `${key} hip servo`, meshes: [[hipServo[0], chain(tip, flipServo(y), hipServo[1])]] },
      { name: `${key} thigh`, meshes: [[base, thigh]], keep: true },
      { name: `${key} knee servo`, meshes: [[kneeServo, thigh]] },
      { name: `${key} knee servo horn`, meshes: [[kneeHorn, arm]] },
      { name: `${key} hip horn`, meshes: [[hipHorn[0], horn]] },
      { name: `${key} arm`, meshes: [[base + 1, arm]] },
      { name: `${key} rod`, meshes: [[base + 2, rod]] },
      { name: `${key} shank`, meshes: [[base + 3, shank]], keep: true },
      { name: `${key} knee pin`, meshes: [[base + 4, thigh]] },
      { name: `${key} knee cap`, meshes: [[base + 5, thigh]] },
      { name: `${key} rod pin`, meshes: [[base + 6, shank]] },
      { name: `${key} rod cap`, meshes: [[base + 7, shank]] },
      { name: `${key} arm cap`, meshes: [[base + 8, arm]] },
    );
  }
  return parts;
}


// --- Micromanipulator, from the FreeCAD files, as designed. Three identical actuators sit round the base block. The
// tree lists each actuator as 51 solids in the same order, starting at index 2, 53 and 104. The rest are the base
// block (0), the end effector (1), and the screws and pins that hold the actuators to the base (155 to 172).
// Small parts that sit together are joined: each motor, each ball joint with its crimp beads, and each rod with its
// collets and rubber bands. (The real rods look a little longer than these, so the end effector here sits lower.)
function micromanipulatorPose() {
  const parts = [{ name: 'base block', meshes: [[0, ID]], keep: true }, { name: 'end effector', meshes: [[1, ID]], keep: true }];
  for (let i = 155; i <= 172; i++) parts.push({ name: `base fastener ${i - 154}`, meshes: [[i, ID]] });
  ['A', 'B', 'C'].forEach((key, k) => {
    const b = 2 + k * 51, group = (name, list, keep) => parts.push({ name: `${key} ${name}`, meshes: list.map((j) => [b + j, ID]), keep });
    group('motor mount', [0], true);
    group('stepper motor', Array.from({ length: 11 }, (_, j) => 1 + j));
    group('horn', [12], true);
    group('encoder magnets', [37]);
    group('encoder board', [38]);
    group('horn ball joints', [19, 20, 21, 24, 25, 26, 27]);
    group('end ball joints', [28, 29, 30, 33, 34, 35, 36]);
    group('rod 1', [13, 16, 18, 22, 32]);
    group('rod 2', [14, 15, 17, 23, 31]);
    [39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50].forEach((j, n) => group(`fastener ${n + 1}`, [j]));
  });
  return parts;
}

const MODELS = {
  seesaw: { file: `${HOME}/Downloads/full pid seesaw ref.step`, parts: seesawPose, angular: 0.25, ratio: 0.7, keepRatio: 1, error: 0.002 },
  dog: { file: `${HOME}/Downloads/robot dog reference.step`, parts: dogPose, angular: 0.35, ratio: 0.34, keepRatio: 0.7, error: 0.006 },
  micromanipulator: { freecad: [`${HOME}/Downloads/micromanip files`, 'Assembly_MicroManipulator'], parts: micromanipulatorPose, angular: 0.6, ratio: 0.12, keepRatio: 0.6, error: 0.02, keepError: 0.004 },
};

const occt = await occtImport();
function readStep(file, angular) {
  const r = occt.ReadStepFile(new Uint8Array(fs.readFileSync(file)), { linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.002, angularDeflection: angular });
  if (!r.success) throw new Error(`could not read ${file}`);
  return r.meshes;
}
// A FreeCAD assembly: one mesh per placed solid, already moved into place, in the order the assembly lists them.
function readFreecad([folder, top], angular) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'freecad-'));
  try {
    const placed = JSON.parse(execFileSync('python3', ['-I', path.join(here, 'freecad-assembly.py'), folder, top, tmp], { maxBuffer: 2 ** 28 }).toString());
    const shapes = new Map();
    return placed.map((p) => {
      if (!shapes.has(p.brp)) {
        const r = occt.ReadBrepFile(new Uint8Array(fs.readFileSync(p.brp)), { linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.004, angularDeflection: angular });
        if (!r.success) throw new Error(`could not read ${p.label}`);
        shapes.set(p.brp, r.meshes);
      }
      const [x, y, z, w] = p.q, m = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), p.pos[0], 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), p.pos[1], 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), p.pos[2]];
      const pos = [], idx = [];
      for (const me of shapes.get(p.brp)) {
        const a = me.attributes.position.array, base = pos.length / 3;
        for (let i = 0; i < a.length; i += 3) pos.push(...apply(m, [a[i], a[i + 1], a[i + 2]]));
        for (const v of me.index.array) idx.push(v + base);
      }
      return { attributes: { position: { array: pos } }, index: { array: idx } };
    });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
function weld(mesh) {
  const P = mesh.attributes.position.array, I = mesh.index.array, map = new Map(), pos = [], remap = new Int32Array(P.length / 3);
  for (let i = 0; i < remap.length; i++) {
    const k = `${Math.round(P[i * 3] * 500)},${Math.round(P[i * 3 + 1] * 500)},${Math.round(P[i * 3 + 2] * 500)}`;
    let v = map.get(k);
    if (v === undefined) { v = pos.length / 3; map.set(k, v); pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); }
    remap[i] = v;
  }
  const idx = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = remap[I[t]], b = remap[I[t + 1]], c = remap[I[t + 2]];
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  }
  return { idx, pos };
}
// Welds and poses a list of [mesh index, transform] into one vertex table.
function gather(meshes, list) {
  const idx = [], pos = [];
  for (const [i, xf] of list) {
    const w = weld(meshes[i]), base = pos.length / 3;
    for (let v = 0; v < w.pos.length; v += 3) pos.push(...apply(xf, [w.pos[v], w.pos[v + 1], w.pos[v + 2]]));
    for (const v of w.idx) idx.push(v + base);
  }
  return { idx, pos };
}
function buildPart(tris, pos, cfg) {
  let indices = Uint32Array.from(tris); const lpos = Float32Array.from(pos);
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
const only = process.argv[2];
for (const [name, cfg] of Object.entries(MODELS)) {
  if (only && only !== name) continue;
  const meshes = cfg.freecad ? readFreecad(cfg.freecad, cfg.angular) : readStep(cfg.file, cfg.angular);
  const parts = cfg.parts().map((def) => {
    const { idx, pos } = gather(meshes, def.meshes);
    return { name: def.name, srcTris: idx.length / 3, ...buildPart(idx, pos, { ratio: def.keep ? cfg.keepRatio : cfg.ratio, error: def.keep ? (cfg.keepError ?? cfg.error) : cfg.error }) };
  }).sort((a, b) => b.I.length - a.I.length);
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (const p of parts) for (let i = 0; i < p.P.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], p.P[i + a]); max[a] = Math.max(max[a], p.P[i + a]); }
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const q = (v, a) => Math.round(((v - min[a]) / span) * 65535) - 32768;
  const chunks = []; let off = 0; const meta = [];
  const put = (buf) => { const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; } const at = off; chunks.push(buf); off += buf.length; return at; };
  for (const p of parts) {
    const vc = p.P.length / 3, ps = new Int16Array(p.P.length), ns = new Int8Array(p.N.length), ls = new Int16Array(p.L.length);
    for (let i = 0; i < p.P.length; i++) ps[i] = q(p.P[i], i % 3);
    for (let i = 0; i < p.N.length; i++) ns[i] = Math.round(p.N[i] * 127);
    for (let i = 0; i < p.L.length; i++) ls[i] = q(p.L[i], i % 3);
    const wide = vc > 65535, ix = wide ? Uint32Array.from(p.I) : Uint16Array.from(p.I);
    let cx = 0, cy = 0, cz = 0; for (let i = 0; i < p.P.length; i += 3) { cx += p.P[i]; cy += p.P[i + 1]; cz += p.P[i + 2]; }
    meta.push({ name: p.name, vc, ic: p.I.length, lc: p.L.length, wide, pos: put(Buffer.from(ps.buffer)), nor: put(Buffer.from(ns.buffer)), idx: put(Buffer.from(ix.buffer)), lin: put(Buffer.from(ls.buffer)), center: [cx / vc, cy / vc, cz / vc] });
  }
  const dir = path.join(here, '../data/cad'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.bin`), Buffer.concat(chunks));
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify({ min, max, span, parts: meta }));
  const src = parts.reduce((n, p) => n + p.srcTris, 0), tri = meta.reduce((n, m) => n + m.ic / 3, 0), ln = meta.reduce((n, m) => n + m.lc / 6, 0);
  console.log(name, 'parts', meta.length, 'tris', src, '->', tri, 'edges', ln, 'MB', (off / 1e6).toFixed(2), 'bbox', min.map((v) => +v.toFixed(1)), max.map((v) => +v.toFixed(1)));
}
