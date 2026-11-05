// Per-character roll on hover. The second copy of each glyph is a text shadow, so no duplicate markup.
const ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12 12 4M5.5 4H12v6.5"/></svg>';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function rollHTML(text) {
  const chars = [...String(text)].map((c, i) => `<span class="ch" style="--i:${i}" aria-hidden="true">${c === ' ' ? ' ' : esc(c)}</span>`).join('');
  return `<span class="btn-roll" aria-label="${esc(text)}">${chars}</span>`;
}
export function buttonHTML({ label, href = '#', cls = '', icon = true, attrs = '' }) {
  const ico = icon ? `<span class="btn-ico" aria-hidden="true">${ARROW}${ARROW}</span>` : '';
  return `<a class="btn ${cls}" href="${esc(href)}" ${attrs}><span class="t-btn">${rollHTML(label)}</span>${ico}</a>`;
}
export function iconButtonHTML({ href = '#', label = 'Open', attrs = '' }) {
  return `<a class="btn icon-only" href="${esc(href)}" aria-label="${esc(label)}" ${attrs}><span class="btn-ico" aria-hidden="true">${ARROW}${ARROW}</span></a>`;
}
export function linkRollHTML({ label, href = '#', cls = '', attrs = '' }) {
  return `<a class="link-roll ${cls}" href="${esc(href)}" ${attrs}>${rollHTML(label)}</a>`;
}
// Upgrades an existing element's text in place.
export function mountCharRoll(el) { el.innerHTML = rollHTML(el.textContent.trim()); return el; }
