// cad: shows a model from a compact part file in clean grey with crisp edge lines.
// Parts can start scattered across the whole screen and fly in to assemble themselves.
import * as THREE from 'three';
import { RoomEnvironment } from '../../lib/jsm/RoomEnvironment.js';

export async function loadModel(name) {
  const [meta, buf] = await Promise.all([
    fetch(`data/cad/${name}.json`).then((r) => r.json()),
    fetch(`data/cad/${name}.bin`).then((r) => r.arrayBuffer()),
  ]);
  const c = [0, 1, 2].map((a) => (meta.min[a] + meta.max[a]) / 2);
  const k = 2 / meta.span; // the longest side becomes 2 units
  const toUnit = (src, count) => {
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) { const a = i % 3; out[i] = (((src[i] + 32768) / 65535) * meta.span + meta.min[a] - c[a]) * k; }
    return out;
  };
  const parts = meta.parts.map((p) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(toUnit(new Int16Array(buf, p.pos, p.vc * 3), p.vc * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(buf, p.nor, p.vc * 3), 3, true));
    g.setIndex(new THREE.BufferAttribute(p.wide ? new Uint32Array(buf, p.idx, p.ic) : new Uint16Array(buf, p.idx, p.ic), 1));
    const l = new THREE.BufferGeometry();
    l.setAttribute('position', new THREE.BufferAttribute(toUnit(new Int16Array(buf, p.lin, p.lc), p.lc), 3));
    return { mesh: g, lines: l, center: new THREE.Vector3((p.center[0] - c[0]) * k, (p.center[1] - c[1]) * k, (p.center[2] - c[2]) * k), tris: p.ic / 3 };
  });
  return { parts, name };
}

export function mountCad(canvas, model, options = {}) {
  const { up = [-Math.PI / 2, 0, 0], color = 0x8c8b88, edge = 0x1d1b19 } = options;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 0.42); key.position.set(-2, 4, 3); scene.add(key);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02, envMapIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, transparent: true });
  const lineMat = new THREE.LineBasicMaterial({ color: edge, transparent: true, opacity: 0.62 });
  const camera = new THREE.PerspectiveCamera(options.fov ?? 26, 1, 0.05, 60);
  let size = [1, 1], shift = [0, 0];
  const target = new THREE.Vector3();
  const root = new THREE.Group(); root.rotation.set(up[0], up[1], up[2]); scene.add(root);
  root.updateMatrixWorld(true);
  const R = (i) => { const s = Math.sin(i * 127.1 + 3.3) * 43758.5453; return s - Math.floor(s); };
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), right = new THREE.Vector3(), upV = new THREE.Vector3(), forward = new THREE.Vector3();
  const parts = model.parts.map((p, i) => {
    const group = new THREE.Group(); root.add(group);
    group.add(new THREE.Mesh(p.mesh, material)); group.add(new THREE.LineSegments(p.lines, lineMat));
    group.children.forEach((c) => { c.frustumCulled = false; });
    p.mesh.computeBoundingSphere();
    return { group, center: p.center, size: p.mesh.boundingSphere.radius, scatter: new THREE.Vector3(), axis: new THREE.Vector3(R(i + 6) - 0.5, R(i + 7) - 0.5, R(i + 8) - 0.5).normalize(), spin: 0.15 + R(i + 11) * 0.4 };
  });
  // Biggest parts land first and small ones last. Each part picks a random spot, far from those already taken.
  const placed = [];
  [...parts].sort((a, b) => b.size - a.size).forEach((p, rank, list) => {
    const t = list.length > 1 ? rank / (list.length - 1) : 0;
    p.order = (1 - t) * 0.85 + R(rank + 21) * 0.15;
    let best = null, bestGap = -1;
    for (let k = 0; k < 18; k++) {
      const u = (R(rank * 19 + k * 3 + 31) - 0.5) * 2.1, v = (R(rank * 23 + k * 5 + 37) - 0.5) * 2.1;
      const gap = placed.reduce((m, q) => Math.min(m, Math.hypot(u - q.u, v - q.v) - (q.size + p.size) * 0.16), 9);
      if (gap > bestGap) { bestGap = gap; best = { u, v }; }
    }
    p.place = { u: best.u, v: best.v, w: (R(rank + 41) - 0.5) * 2 };
    placed.push({ u: best.u, v: best.v, size: p.size });
    // Its own slow drift and tumble while it floats.
    p.float = { ax: 0.05 + R(rank + 51) * 0.1, ay: 0.05 + R(rank + 53) * 0.1, fx: 0.11 + R(rank + 55) * 0.2, fy: 0.1 + R(rank + 57) * 0.2, ph: R(rank + 59) * 6.28, spin: (R(rank + 61) - 0.5) * 0.14, depth: 0.45 + R(rank + 63) * 1.1 };
  });
  const api = {
    renderer, camera, scene, root, parts, material, lineMat, target,
    resize(w, h, dpr) { renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; size = [w, h]; api.setShift(...shift); },
    // Moves the picture across the screen without changing the view, so the model lines up with a window
    // that isn't in the middle.
    setShift(dx = 0, dy = 0) {
      shift = [dx, dy];
      if (dx || dy) camera.setViewOffset(size[0], size[1], -dx, -dy, size[0], size[1]); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    },
    // Works out where each part floats when scattered, so they fill this view at any screen shape.
    setScatter(view, aspect) {
      api.setView(view.az, view.el, view.dist, view.tx, view.ty, view.tz);
      camera.updateMatrixWorld(true);
      camera.matrixWorld.extractBasis(right, upV, forward);
      const halfH = view.dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), halfW = halfH * aspect;
      root.updateMatrixWorld(true);
      parts.forEach((p) => {
        v1.copy(target).addScaledVector(right, p.place.u * halfW).addScaledVector(upV, p.place.v * halfH).addScaledVector(forward, p.place.w);
        root.worldToLocal(v1);
        p.scatter.copy(v1).sub(p.center);
        p.right = root.worldToLocal(v2.copy(right)).clone(); p.upV = root.worldToLocal(v2.copy(upV)).clone();
      });
    },
    // amount: 1 is fully scattered, 0 is assembled. time and mouse keep the loose parts drifting.
    setExplode(amount, time = 0, mx = 0, my = 0) {
      const S = 0.7;
      parts.forEach((p) => {
        const local = Math.min(1, Math.max(0, amount * (1 + S) - p.order * S));
        const e = local * local * (3 - 2 * local);
        const f = p.float;
        p.group.position.copy(p.scatter).multiplyScalar(e);
        // A slight curve on the way in, so the parts swoop rather than slide.
        v1.copy(p.scatter).cross(p.axis).multiplyScalar(0.16 * Math.sin(Math.PI * e));
        p.group.position.add(v1);
        // Floating, and leaning a little with the pointer, fading out as the part lands.
        if (e > 0 && p.right) {
          const dx = Math.sin(time * f.fx + f.ph) * f.ax + mx * 0.09 * f.depth, dy = Math.cos(time * f.fy + f.ph * 1.7) * f.ay + my * 0.06 * f.depth;
          p.group.position.addScaledVector(p.right, dx * e).addScaledVector(p.upV, dy * e);
        }
        // Each part tumbles around its own centre, so it stays where it was placed.
        p.group.quaternion.setFromAxisAngle(p.axis, e * (p.spin + time * f.spin));
        v1.copy(p.center).applyQuaternion(p.group.quaternion);
        p.group.position.add(p.center).sub(v1);
      });
    },
    setOpacity(a) { material.opacity = a; lineMat.opacity = 0.62 * a; material.depthWrite = a > 0.98; },
    setView(az, el, dist, tx = 0, ty = 0, tz = 0) {
      target.set(tx, ty, tz);
      camera.position.set(tx + Math.sin(az) * Math.cos(el) * dist, ty + Math.sin(el) * dist, tz + Math.cos(az) * Math.cos(el) * dist);
      camera.lookAt(target);
    },
    render() { renderer.render(scene, camera); },
  };
  return api;
}
