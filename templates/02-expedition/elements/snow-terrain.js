// Procedural snowfield with mountains and a white reveal front.
// mountSnowTerrain(el, { reveal: true }) -> { destroy() }
import { createStage } from '../lib/stage.js';
import { createTerrain } from '../lib/terrain.js';

export function mountSnowTerrain(el, { reveal = true, detail = .6, background = '#c5c9d3' } = {}) {
  const st = createStage(el, { position: [-4, 13, 62], target: [1, 6, 0], background });
  const t = createTerrain({ G: st.G, radial: Math.round(340 * detail), spokes: Math.round(620 * detail) });
  st.scene.add(t.mesh);
  let r = reveal ? 0 : 1e5;
  st.onFrame = (dt) => { if (reveal && r < 4000) { r += (6 + r * 1.9) * dt * 6; } t.uniforms.uReveal.value = r; st.camera.position.x = -4 - st.mouse.nx * 8; st.camera.lookAt(1, 6, 0); };
  return { destroy: st.destroy, replay() { r = 0; }, stage: st };
}
