// Point cloud that streams between shapes. A shape is a short string, or null for the stone form.
// mountParticleMorph(el, { shapes: [null,'GH','@'], count: 20000 }) -> { next(), to(i), hover(v), destroy() }
import { createStage } from '../lib/stage.js';
import { createParticleForm, stoneShape, textShape } from '../lib/particles.js';

export function mountParticleMorph(el, { shapes = [null, 'GH', '@'], count = 20000, size = .27, background = '#9da5b6', autoAdvance = 0 } = {}) {
  const st = createStage(el, { position: [0, 10, 52], target: [0, 9.5, 0], background });
  const form = createParticleForm({ G: st.G, count, shapes: shapes.map((m, i) => (m ? textShape(m, count, 30 + i) : stoneShape(count, 4 + i))) });
  form.uniforms.uSize.value = size; st.scene.add(form.points);
  let i = 0, h = 0, timer = 0;
  st.onFrame = (dt, t) => {
    form.update(t); form.points.rotation.y = t * .3 + st.mouse.nx * .3; form.uniforms.uHover.value += (h - form.uniforms.uHover.value) * dt * 2;
    if (autoAdvance && (timer += dt) > autoAdvance) { timer = 0; i = (i + 1) % shapes.length; form.morphTo(i, t); }
  };
  return { destroy: st.destroy, stage: st, next() { i = (i + 1) % shapes.length; form.morphTo(i, st.G.uTime.value); }, to(k) { i = k; form.morphTo(i, st.G.uTime.value); }, hover(v) { h = v; } };
}
