// loader-outline: load progress drawn as the outline of your 3D object, climbing both
// sides at once from the base, with a hot glowing tip on each side.
export function mountLoaderOutline(parent, options = {}) {
  const { points = () => [], stroke = 'rgba(255,214,176,.55)', tip = 'rgb(255,241,224)' } = options;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('loader-outline');
  Object.assign(svg.style, { position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' });
  const mk = (cls) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('pathLength', '1'); p.setAttribute('fill', 'none'); p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('class', cls); svg.appendChild(p);
    return p;
  };
  const left = mk('flank'), right = mk('flank'), tipL = mk('tip'), tipR = mk('tip');
  [left, right].forEach((p) => { p.setAttribute('stroke', stroke); p.setAttribute('stroke-width', '1'); p.style.strokeDasharray = '1 1'; });
  [tipL, tipR].forEach((p) => { p.setAttribute('stroke', tip); p.setAttribute('stroke-width', '1.8'); p.style.strokeDasharray = '.025 1'; p.style.filter = 'drop-shadow(0 0 6px rgba(255,170,110,.9))'; });
  parent.appendChild(svg);
  const toD = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  const api = {
    el: svg, progress: 0,
    layout() {
      const { left: a, right: b } = points();
      if (!a?.length) return;
      left.setAttribute('d', toD(a)); tipL.setAttribute('d', toD(a));
      right.setAttribute('d', toD(b)); tipR.setAttribute('d', toD(b));
      api.set(api.progress);
    },
    set(p) {
      api.progress = p;
      [left, right].forEach((el) => { el.style.strokeDashoffset = String(1 - p); });
      [tipL, tipR].forEach((el) => { el.style.strokeDashoffset = String(0.025 - p); });
    },
    hide() { svg.style.transition = 'opacity .5s ease-out'; svg.style.opacity = 0; },
    destroy() { svg.remove(); },
  };
  api.layout(); api.set(0.02);
  return api;
}
