// Full-screen prismatic smear and noisy wipe over any three.js scene. Includes a demo scene.
// mountSpectralWipe(el, { auto: true }) -> { burst(), setWipe(cut, amount), destroy() }
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';

export function mountSpectralWipe(el, { auto = true, background = '#a0a5b1' } = {}) {
  const st = createStage(el, { position: [0, 0, 26], background });
  const stones = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(.1, .115, .15), roughness: .6, flatShading: true });
  st.scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 2.2), new THREE.DirectionalLight(0xffffff, 2));
  for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.7 + Math.random() * 1.9, 0), mat); m.position.set((Math.random() - .5) * 26, (Math.random() - .5) * 15, (Math.random() - .5) * 8); m.rotation.set(Math.random() * 6, Math.random() * 6, 0); stones.add(m); }
  st.scene.add(stones);
  const f = st.post.f; let burst = 0;
  st.onFrame = (dt, t) => {
    stones.rotation.y = t * .1; burst = Math.max(0, burst - dt * 1.8); f.uBurst.value = Math.sin(Math.min(1, burst) * Math.PI);
    if (auto) { f.uCut.value = .5 + Math.sin(t * .5) * .5; f.uBand.value = 1.5; }
  };
  return { destroy: st.destroy, stage: st, burst() { burst = 1; }, setWipe(cut, amount) { auto = false; f.uCut.value = cut; f.uBand.value = amount; } };
}
