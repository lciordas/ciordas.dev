// Bottom-centre carousel: bracket label, fading neighbours and two long arrows. Calls onChange(i).
// mountLinkCarousel(el, { links: [{label,url}], onChange }) -> { go(i), index }
import { scramble } from '../lib/ui.js';
import { mountBracketButton } from './bracket-button.js';

export function mountLinkCarousel(el, { links = [], onChange } = {}) {
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  const row = document.createElement('div'); row.style.cssText = 'position:absolute;left:50%;bottom:20px;transform:translateX(-50%);display:flex;align-items:center;gap:30px;color:#fff;font:500 14px "IBM Plex Mono",monospace;white-space:nowrap';
  const side = (dir) => { const b = document.createElement('button'); b.type = 'button'; b.style.cssText = `width:90px;background:none;border:0;color:inherit;font:inherit;cursor:pointer;opacity:.55;overflow:hidden;text-align:${dir < 0 ? 'right' : 'left'};-webkit-mask:linear-gradient(${dir < 0 ? 90 : 270}deg,transparent,#000 75%);mask:linear-gradient(${dir < 0 ? 90 : 270}deg,transparent,#000 75%)`; return b; };
  const prev = side(-1), next = side(1); const mid = document.createElement('div'); row.append(prev, mid, next); el.appendChild(row);
  const { el: btn } = mountBracketButton(mid, { label: '', href: '#' }); btn.style.minWidth = '150px'; const lab = btn.querySelector('span');
  const arrow = (d, css) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', d); b.style.cssText = `position:absolute;top:50%;${css};background:none;border:0;color:#fff;padding:20px 8px;cursor:pointer;transform:translateY(-50%);transition:transform .45s cubic-bezier(.2,.8,.2,1)`; b.innerHTML = `<svg viewBox="0 0 78 14" width="78" height="14"><path d="${d === 'Previous' ? 'M78 12.5H2L12 1' : 'M0 12.5h76L66 1'}" fill="none" stroke="currentColor"/></svg>`; return b; };
  const aL = arrow('Previous', 'left:6%'), aR = arrow('Next', 'right:6%'); el.append(aL, aR);
  const api = { index: 0, go(i) { const n = links.length; api.index = (i + n) % n; const l = links[api.index]; scramble(lab, l.label, { duration: .4 }); btn.href = l.url; prev.textContent = links[(api.index - 1 + n) % n].label; next.textContent = links[(api.index + 1) % n].label; onChange?.(api.index); } };
  [prev, aL].forEach((b) => b.addEventListener('click', () => api.go(api.index - 1)));
  [next, aR].forEach((b) => b.addEventListener('click', () => api.go(api.index + 1)));
  const n = links.length; lab.textContent = links[0].label; btn.href = links[0].url; prev.textContent = links[n - 1].label; next.textContent = links[1 % n].label;
  return api;
}
