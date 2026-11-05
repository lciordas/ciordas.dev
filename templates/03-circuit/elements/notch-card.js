// Clips a panel to a rounded rectangle with a raised tab on top and a wide lowered tab along the bottom.
// Recomputed in pixels so the corners never stretch.
export function notchPath(w, h, { top = 36, bottom = 25, tabW = 360, baseW = 970, r = 24, s = 44 } = {}) {
  const y0 = top; const yB = h - bottom; const c = w / 2;
  const a = c - tabW / 2, b = c + tabW / 2; const l = c - baseW / 2, q = c + baseW / 2;
  return [
    `M${r} ${y0}`, `H${a - s}`,
    `C${a - s * 0.3} ${y0} ${a - s * 0.1} ${y0 - top * 0.25} ${a + s * 0.1} ${y0 - top * 0.6}`,
    `C${a + s * 0.3} ${y0 - top * 0.92} ${a + s * 0.6} 0 ${a + s} 0`, `H${b - s}`,
    `C${b - s * 0.6} 0 ${b - s * 0.3} ${y0 - top * 0.92} ${b - s * 0.1} ${y0 - top * 0.6}`,
    `C${b + s * 0.1} ${y0 - top * 0.25} ${b + s * 0.3} ${y0} ${b + s} ${y0}`,
    `H${w - r}`, `A${r} ${r} 0 0 1 ${w} ${y0 + r}`, `V${yB - r}`, `A${r} ${r} 0 0 1 ${w - r} ${yB}`,
    `H${q + s * 0.6}`, `C${q + s * 0.1} ${yB} ${q - s * 0.05} ${yB + bottom * 0.25} ${q - s * 0.2} ${yB + bottom * 0.55}`,
    `C${q - s * 0.35} ${h - bottom * 0.1} ${q - s * 0.6} ${h} ${q - s} ${h}`, `H${l + s}`,
    `C${l + s * 0.6} ${h} ${l + s * 0.35} ${h - bottom * 0.1} ${l + s * 0.2} ${yB + bottom * 0.55}`,
    `C${l + s * 0.05} ${yB + bottom * 0.25} ${l - s * 0.1} ${yB} ${l - s * 0.6} ${yB}`,
    `H${r}`, `A${r} ${r} 0 0 1 0 ${yB - r}`, `V${y0 + r}`, `A${r} ${r} 0 0 1 ${r} ${y0}`, 'Z',
  ].join('');
}
export function mountNotchCard(el, options = {}) {
  const k = () => parseFloat(getComputedStyle(document.documentElement).fontSize) / (40 / 3);
  const apply = () => {
    const r = el.getBoundingClientRect(); const f = k();
    const narrow = innerWidth < 800;
    el.style.clipPath = `path("${notchPath(r.width, r.height, {
      top: 36 * f, bottom: 25 * f, tabW: (narrow ? 140 : 360) * f, baseW: (narrow ? r.width / f * 0.82 : 970) * f, r: 24 * f, s: 44 * f, ...options,
    })}")`;
  };
  apply();
  new ResizeObserver(apply).observe(el);
  return { apply };
}
