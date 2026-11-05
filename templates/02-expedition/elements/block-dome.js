// Domed block structure whose blocks lift and light up around the cursor.
// mountBlockDome(el, { wander: .6, autoRotate: .05 }) -> { destroy() }
import { createStage } from '../lib/stage.js';
import { createDome } from '../lib/dome.js';

export function mountBlockDome(el, { wander = .7, autoRotate = .06, distance = 62, background = '#a0a5b1' } = {}) {
  const st = createStage(el, { position: [-4, 13, distance], target: [1, 6.5, 0], background });
  const dome = createDome({ G: st.G }); st.scene.add(dome.group);
  let energy = 0, px = 0, py = 0;
  st.onFrame = (dt, t) => {
    energy = Math.min(1, energy * Math.exp(-dt * .62) + Math.hypot(st.mouse.x - px, st.mouse.y - py) * .0065); px = st.mouse.x; py = st.mouse.y;
    dome.group.rotation.y = Math.sin(t * .1) * autoRotate;
    st.camera.position.x = -4 - st.mouse.nx * 9; st.camera.lookAt(1, 6.5, 0);
    dome.update({ camera: st.camera, mx: st.mouse.x, my: st.mouse.y, w: st.width, h: st.height, energy, wander, dt, time: t });
  };
  return { destroy: st.destroy, stage: st };
}
