// Sound toggle with synthesised wind and interface tones. Stays silent until clicked.
// mountSynthSound(el, { on:'On', off:'Off', label:'Sound:' }) -> { sound }
import { createSound } from '../lib/audio.js';

export function mountSynthSound(el, { label = 'Sound:', on = 'On', off = 'Off' } = {}) {
  const sound = createSound();
  const b = document.createElement('button'); b.type = 'button'; b.style.cssText = 'display:inline-flex;gap:8px;align-items:center;background:none;border:0;color:inherit;font:500 13.8px "IBM Plex Mono",monospace;cursor:pointer';
  const render = () => { b.innerHTML = `<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path d="M2 6.5h3l4-3.2v11.4l-4-3.2H2z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>${sound.enabled ? '<path d="M12.2 5.8c1.6 1.8 1.6 4.6 0 6.4" fill="none" stroke="currentColor" stroke-width="1.2"/>' : '<path d="M12 6.8l4 4.4M16 6.8l-4 4.4" stroke="currentColor" stroke-width="1.2"/>'}</svg><span>${label} ${sound.enabled ? on : off}</span>`; };
  b.addEventListener('click', () => { sound.toggle(); render(); sound.blip(1320, .05, .05); });
  render(); el.appendChild(b);
  return { sound, el: b };
}
