// Label framed by four corner brackets that spread on hover.
// mountBracketButton(el, { label: 'Close', onClick }) -> { el }
import { bracket } from '../lib/ui.js';

const CSS = `.bracket{position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:92px;min-height:41px;padding:0 14px;font:500 13.8px "IBM Plex Mono",monospace;color:inherit;background:none;border:0;cursor:pointer}
.bracket i{position:absolute;width:11px;height:11px;border:0 solid currentColor;transition:transform .35s cubic-bezier(.2,.8,.2,1)}
.br-tl{left:0;top:0;border-left-width:2px!important;border-top-width:2px!important}.br-tr{right:0;top:0;border-right-width:2px!important;border-top-width:2px!important}
.br-bl{left:0;bottom:0;border-left-width:2px!important;border-bottom-width:2px!important}.br-br{right:0;bottom:0;border-right-width:2px!important;border-bottom-width:2px!important}
.bracket:hover .br-tl{transform:translate(-4px,-4px)}.bracket:hover .br-tr{transform:translate(4px,-4px)}.bracket:hover .br-bl{transform:translate(-4px,4px)}.bracket:hover .br-br{transform:translate(4px,4px)}`;

export function mountBracketButton(el, { label = 'Close', href, onClick } = {}) {
  if (!document.getElementById('bracket-css')) { const s = document.createElement('style'); s.id = 'bracket-css'; s.textContent = CSS; document.head.appendChild(s); }
  const b = document.createElement(href ? 'a' : 'button'); if (href) b.href = href; else b.type = 'button';
  const span = document.createElement('span'); span.textContent = label; b.appendChild(span); bracket(b);
  if (onClick) b.addEventListener('click', onClick);
  el.appendChild(b);
  return { el: b };
}
