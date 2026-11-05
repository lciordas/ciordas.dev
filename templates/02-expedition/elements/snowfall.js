// Soft drifting flakes on a transparent-feeling backdrop.
// mountSnowfall(el, { count: 700 }) -> { destroy() }
import { createStage } from '../lib/stage.js';
import { createSnow } from '../lib/atmosphere.js';

export function mountSnowfall(el, { count = 700, background = '#4b5363', scale = 3 } = {}) {
  const st = createStage(el, { position: [0, 0, 1], target: [0, 0, 0], background });
  const s = createSnow({ G: st.G, count }); st.scene.add(s.points);
  s.uniforms.uPx = { value: 1 };
  st.onFrame = () => { s.uniforms.uPx.value = st.G.uPxScale.value * scale; s.uniforms.uCam.value.copy(st.camera.position); };
  return { destroy: st.destroy, stage: st };
}
