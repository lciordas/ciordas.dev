// Types text in behind a noisy leading edge, or erases it the same way.
// mountTypeScramble(el, { text, duration: .9, on: 'load' | 'hover' }) -> { play(), erase() }
import { scramble } from '../lib/ui.js';

export function mountTypeScramble(el, { text = el.textContent, duration = .9, on = 'load', trail = 7 } = {}) {
  el.setAttribute('aria-label', text);
  const play = () => scramble(el, text, { duration, trail });
  const erase = () => scramble(el, text, { duration: duration * .5, hide: true, trail });
  if (on === 'load') play();
  if (on === 'hover') { el.textContent = text; el.addEventListener('pointerenter', play); }
  return { play, erase };
}
