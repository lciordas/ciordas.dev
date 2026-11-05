import * as THREE from 'three';
import { patternMaterial } from '../js/figure.js';
import { reduced } from './_core.js';

// Small 3D token fixed to the viewport. It spins with scroll and leans toward the pointer.
export function mountFloatObject(host, { palette = ['#c79a3e', '#111112'], bands = 7 } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); } catch { return null; }
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 30); cam.position.z = 5.4;
  const g = new THREE.SphereGeometry(1, 96, 64); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 1 + 0.08 * Math.sin(x * 2.1) * Math.cos(y * 1.7); p.setXYZ(i, x * n * 1.14, y * n * 0.92, z * n); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, patternMaterial({ palette, bands, seed: 2, scale: 1.5, grain: false })); scene.add(m);
  const size = () => { const r = host.getBoundingClientRect(); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(r.width, r.height); };
  size(); addEventListener('resize', size);
  let mx = 0, my = 0, sx = 0, sy = 0, raf;
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
  const still = reduced();
  const tick = () => {
    raf = requestAnimationFrame(tick);
    sx += (mx - sx) * 0.06; sy += (my - sy) * 0.06;
    m.rotation.y = (still ? 0.4 : scrollY * 0.0022) + sx * 1.2; m.rotation.x = 0.2 + sy * 0.8;
    renderer.render(scene, cam);
  };
  tick();
  return { destroy() { cancelAnimationFrame(raf); renderer.dispose(); } };
}
