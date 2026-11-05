// ui-links: the small interface details. Each function enhances an existing element.
// mountCrackedWord: a word split along a jagged line, its halves shifting apart on hover.
// mountRollLink:    letters roll upward in sequence, the rule sweeps, the arrow exits and returns.
// mountDrawArrow:   a long arrow that erases forward and redraws from its tail.

export function mountCrackedWord(el, text) {
  el.classList.add('cracked');
  const set = (t) => { el.innerHTML = ''; const s = document.createElement('span'); s.className = 'word'; s.dataset.word = t; s.textContent = t; el.appendChild(s); };
  set(text);
  return { set };
}

export function mountRollLink(el, { label = 'Visit website', href = '#', external = true } = {}) {
  el.classList.add('roll-link');
  el.href = href;
  if (external) { el.target = '_blank'; el.rel = 'noopener noreferrer'; }
  const chars = [...label].map((c, i) => `<span class="char" style="--i:${i}" data-char="${c === ' ' ? '&nbsp;' : c.replace(/"/g, '&quot;')}">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  el.innerHTML = `<span class="sr">${label}</span><span class="roll" aria-hidden="true">${chars}</span><span class="ne" aria-hidden="true"><span>↗</span><span>↗</span></span><span class="rule"></span>`;
  return { el };
}

const ARROW = `<g class="leave"><path class="shaft" pathLength="1" d="M1 6h26"/><path class="barb" pathLength="1" d="M27 6l-5.5-5"/><path class="barb" pathLength="1" d="M27 6l-5.5 5"/></g><g class="enter"><path class="shaft" pathLength="1" d="M1 6h26"/><path class="barb" pathLength="1" d="M27 6l-5.5-5"/><path class="barb" pathLength="1" d="M27 6l-5.5 5"/></g>`;
export function mountDrawArrow(el, { flipped = false } = {}) {
  el.classList.add('draw-arrow');
  el.innerHTML = `<svg class="arrow${flipped ? ' is-flipped' : ''}" viewBox="0 0 28 12" aria-hidden="true">${ARROW}</svg>`;
  return { el };
}
