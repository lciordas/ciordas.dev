// Segmented stone ring with a glowing lip. Set glow from 0 to 1, or let the cursor drive it.
// mountRings(el, { glow: null }) -> { destroy(), setGlow(v) }
import { createStage } from '../lib/stage.js';
import { createPortal } from '../lib/rings.js';

export function mountRings(el, { glow = null, background = '#8e95a6' } = {}) {
  const st = createStage(el, { position: [0, 62, .1], target: [0, 0, 0], background });
  st.camera.up.set(0, 0, -1); st.camera.lookAt(0, 0, 0);
  const a = createPortal({ G: st.G, R: 14, segs: 6, thick: 4.7, depth: 5, gap: 1.2, seed: 21, lip: .96 });
  const b = createPortal({ G: st.G, R: 8.2, segs: 5, thick: 2.8, depth: 3.2, gap: 12, seed: 33, lip: .95 }); b.group.position.y = -8;
  const c = createPortal({ G: st.G, R: 4.6, segs: 5, thick: 1.8, depth: 2, gap: 18, seed: 47, extras: 2, lip: .95 }); c.group.position.y = -16;
  st.scene.add(a.group, b.group, c.group);
  let g = glow ?? .5, fixed = glow !== null;
  st.onFrame = (dt, t) => {
    if (!fixed) g += ((st.mouse.inside ? 1 - Math.min(1, Math.hypot(st.mouse.nx, st.mouse.ny)) * .7 : .5) - g) * dt * 2;
    a.uniforms.uGlow.value = g; b.uniforms.uGlow.value = g * .5; c.uniforms.uGlow.value = g * .35;
    a.group.rotation.y = t * .03; b.group.rotation.y = -t * .05; c.group.rotation.y = t * .08;
  };
  return { destroy: st.destroy, setGlow(v) { g = v; fixed = true; }, stage: st };
}
