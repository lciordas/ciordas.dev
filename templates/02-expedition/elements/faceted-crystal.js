// Refractive crystal with an embedded mark or stone pile. Rotates towards the cursor.
// mountCrystal(el, { kind: 'mark', mark: 'P1' }) -> { destroy() }
import { createStage } from '../lib/stage.js';
import { createCrystal } from '../lib/crystal.js';
import { createSky } from '../lib/atmosphere.js';

export function mountCrystal(el, { kind = 'stones', mark = 'P1', seed = 1, spin = .22 } = {}) {
  const st = createStage(el, { position: [0, 0, 40], target: [0, 0, 0] });
  st.useBack = true;
  const sky = createSky({ G: st.G }); sky.uniforms.uCloud.value = .4; sky.uniforms.uShade.value = .5; st.scene.add(sky.mesh);
  const c = createCrystal({ G: st.G, tBack: st.post.back.texture, seed, kind, mark });
  st.scene.add(c.group); c.setFocus(1);
  st.onFrame = (dt, t) => { c.group.rotation.y = t * spin + st.mouse.nx * .42; c.group.rotation.x = -.06 + st.mouse.ny * .16; };
  return { destroy: st.destroy, stage: st, crystal: c };
}
