// cad: shows a model from a compact part file in clean grey with crisp edge lines.
// Parts can drift apart along lines from the centre for an exploded view.
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
  const { up = [-Math.PI / 2, 0, 0], color = 0x8c8b88, edge = 0x1d1b19, explode = 0.7 } = options;
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
  const maxD = Math.max(...model.parts.map((p) => p.center.length()), 0.001);
  const R = (i) => { const s = Math.sin(i * 127.1 + 3.3) * 43758.5453; return s - Math.floor(s); };
  const AXIS_Y = new THREE.Vector3(0, 1, 0), AXIS_Z = new THREE.Vector3(0, 0, 1), tiltQ = new THREE.Quaternion(), tiltV = new THREE.Vector3();
  const parts = model.parts.map((p, i) => {
    const group = new THREE.Group(); root.add(group);
    group.add(new THREE.Mesh(p.mesh, material)); group.add(new THREE.LineSegments(p.lines, lineMat));
    group.children.forEach((c) => { c.frustumCulled = false; });
    const dir = p.center.clone();
    if (dir.lengthSq() < 1e-4) dir.set(R(i) - 0.5, R(i + 9) - 0.5, 1);
    dir.normalize().add(new THREE.Vector3(R(i + 1) - 0.5, R(i + 2) - 0.5, R(i + 3) - 0.5).multiplyScalar(0.22)).normalize();
    return { group, center: p.center, dir, reach: (0.3 + (p.center.length() / maxD) * 0.9) * explode, order: R(i + 5), small: p.tris < 900, axis: new THREE.Vector3(R(i + 6) - 0.5, R(i + 7) - 0.5, R(i + 8) - 0.5).normalize() };
  });
  const api = {
    renderer, camera, scene, root, parts, material, lineMat, target,
    resize(w, h, dpr) { renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
    // amount: 1 is fully apart, 0 is assembled.
    setExplode(amount) {
      parts.forEach((p) => {
        const local = Math.min(1, Math.max(0, (amount * 1.35 - p.order * 0.35)));
        const e = local * local * (3 - 2 * local);
        p.group.position.copy(p.dir).multiplyScalar(p.reach * e);
        p.group.quaternion.setFromAxisAngle(p.axis, e * 0.55);
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
