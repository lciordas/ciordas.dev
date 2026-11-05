// Dark full-area panel with line-by-line scrambled text and a bracket Close button.
// mountTakeoverPanel(el, { sections: [{label, text:[...], links:[{label,url}]}], closeLabel }) -> { open(), close() }
import { scramble } from '../lib/ui.js';
import { mountBracketButton } from './bracket-button.js';

export function mountTakeoverPanel(el, { sections = [], closeLabel = 'Close', background = 'radial-gradient(90% 80% at 96% 4%, #3a4453 0, #121824 60%)' } = {}) {
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  const root = document.createElement('div');
  root.style.cssText = `position:absolute;inset:0;background:${background};color:rgba(205,214,228,.85);font:500 14px/18px "IBM Plex Mono",monospace;display:none;opacity:0;transition:opacity .45s;overflow:auto;z-index:5`;
  const body = document.createElement('div'); body.style.cssText = 'max-width:506px;margin:0 auto;padding:64px 20px;'; root.appendChild(body);
  const closeWrap = document.createElement('div'); closeWrap.style.cssText = 'position:absolute;right:20px;top:18px;color:#fff'; root.appendChild(closeWrap);
  const parts = [];
  const line = (css, text, tag = 'div') => { const d = document.createElement(tag); d.style.cssText = css; body.appendChild(d); parts.push([d, text]); };
  sections.forEach((s) => {
    if (s.label) line('color:rgba(170,180,197,.62);min-height:18px;margin:0 0 26px', s.label);
    (s.text || []).forEach((t) => line('margin:0 0 18px;min-height:18px', t, 'p'));
    if (s.links) { const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px 22px;margin-bottom:30px'; body.appendChild(row); s.links.forEach((l) => { const a = document.createElement('a'); a.href = l.url; a.style.cssText = 'color:inherit;text-decoration:none'; const sp = document.createElement('span'); a.appendChild(sp); row.appendChild(a); parts.push([sp, l.label + ' ↗']); }); }
  });
  el.appendChild(root);
  const open = () => { root.style.display = 'block'; requestAnimationFrame(() => { root.style.opacity = 1; }); let t = .2; parts.forEach(([n, x]) => { const long = x.length > 60; scramble(n, x, { duration: long ? Math.min(1.3, x.length / 330) : .32, delay: t, trail: long ? 24 : 6 }); t += long ? .16 : .1; }); };
  const close = () => { root.style.opacity = 0; setTimeout(() => { root.style.display = 'none'; }, 460); };
  mountBracketButton(closeWrap, { label: closeLabel, onClick: close });
  return { open, close, el: root };
}
