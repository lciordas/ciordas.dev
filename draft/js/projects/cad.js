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
  const target = new THREE.Vector3();
  const root = new THREE.Group(); root.rotation.set(up[0], up[1], up[2]); scene.add(root);
  root.updateMatrixWorld(true);
  const R = (i) => { const s = Math.sin(i * 127.1 + 3.3) * 43758.5453; return s - Math.floor(s); };
  const AXIS_Y = new THREE.Vector3(0, 1, 0), AXIS_Z = new THREE.Vector3(0, 0, 1), tiltQ = new THREE.Quaternion(), tiltV = new THREE.Vector3();
  const v1 = new THREE.Vector3(), right = new THREE.Vector3(), upV = new THREE.Vector3(), forward = new THREE.Vector3();
  const parts = model.parts.map((p, i) => {
    const group = new THREE.Group(); root.add(group);
    group.add(new THREE.Mesh(p.mesh, material)); group.add(new THREE.LineSegments(p.lines, lineMat));
    group.children.forEach((c) => { c.frustumCulled = false; });
    p.mesh.computeBoundingSphere();
    return { group, center: p.center, size: p.mesh.boundingSphere.radius, scatter: new THREE.Vector3(), axis: new THREE.Vector3(R(i + 6) - 0.5, R(i + 7) - 0.5, R(i + 8) - 0.5).normalize(), spin: 1.3 + R(i + 11) * 1.7 };
  });
  // Biggest parts land first and small ones last, and each one gets its own spot in a ring around the screen.
  [...parts].sort((a, b) => b.size - a.size).forEach((p, rank, list) => {
    const t = list.length > 1 ? rank / (list.length - 1) : 0;
    p.order = (1 - t) * 0.85 + R(rank + 21) * 0.15;
    const angle = rank * 2.39996 + 0.7, cos = Math.cos(angle), sin = Math.sin(angle), box = Math.max(Math.abs(cos), Math.abs(sin));
    // With only a few parts, keep them all on screen. With many, the smallest can start just off it.
    const r = list.length < 12 ? 0.72 + R(rank + 31) * 0.2 : 0.74 + R(rank + 31) * (0.2 + t * 0.34);
    p.place = { u: (cos / box) * r, v: (sin / box) * r, w: (R(rank + 41) - 0.55) * 1.3 };
  });
  const api = {
    renderer, camera, scene, root, parts, material, lineMat, target,
    resize(w, h, dpr) { renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
    // Works out where each part sits when scattered, so they fill this view at any screen shape.
    setScatter(view, aspect) {
      api.setView(view.az, view.el, view.dist, view.tx, view.ty, view.tz);
      camera.updateMatrixWorld(true);
      camera.matrixWorld.extractBasis(right, upV, forward);
      const halfH = view.dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), halfW = halfH * aspect;
      root.updateMatrixWorld(true);
      parts.forEach((p) => {
        // Long parts stay close enough in to be seen.
        const reachX = Math.max(halfW * 0.3, halfW - p.size * 0.42), reachY = Math.max(halfH * 0.3, halfH - p.size * 0.42);
        const u = p.place.u * (Math.abs(p.place.u) > 1 ? halfW : reachX), v = p.place.v * (Math.abs(p.place.v) > 1 ? halfH : reachY);
        v1.copy(target).addScaledVector(right, u).addScaledVector(upV, v).addScaledVector(forward, p.place.w);
        root.worldToLocal(v1);
        p.scatter.copy(v1).sub(p.center);
      });
    },
    // amount: 1 is fully scattered, 0 is assembled.
    setExplode(amount) {
      const S = 0.7;
      parts.forEach((p) => {
        const local = Math.min(1, Math.max(0, amount * (1 + S) - p.order * S));
        const e = local * local * (3 - 2 * local);
        p.group.position.copy(p.scatter).multiplyScalar(e);
        // A slight curve on the way in, so the parts swoop rather than slide.
        v1.copy(p.scatter).cross(p.axis).multiplyScalar(0.16 * Math.sin(Math.PI * e));
        p.group.position.add(v1);
        // Each part tumbles around its own centre, so it stays where it was placed.
        p.group.quaternion.setFromAxisAngle(p.axis, e * p.spin);
        v1.copy(p.center).applyQuaternion(p.group.quaternion);
        p.group.position.add(p.center).sub(v1);
      });
    },
    // Tips some parts around a pivot in model space, for moving the assembled mechanism.
    tilt(ids, pivot, angle, axis = 'y', slide = null) {
      const ax = axis === 'y' ? AXIS_Y : AXIS_Z;
      tiltQ.setFromAxisAngle(ax, angle);
      ids.forEach((i) => {
        const g = parts[i].group;
        tiltV.copy(g.position).sub(pivot).applyQuaternion(tiltQ).add(pivot);
        g.position.copy(tiltV);
        g.quaternion.premultiply(tiltQ);
      });
      if (slide) {
        tiltV.set(slide.x, slide.y, slide.z).applyQuaternion(tiltQ);
        parts[slide.part].group.position.add(tiltV);
      }
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
