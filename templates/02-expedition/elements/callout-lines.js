// Thin leader lines from a label to a moving point. Give it anchors that return {x,y} in pixels.
// mountCallouts(el, { items: [{ lines: ['TITLE','NAME'], anchor: () => ({x,y}), offset: [-180,-80] }] }) -> { destroy() }
import { scramble } from '../lib/ui.js';

export function mountCallouts(el, { items = [], color = '#fff' } = {}) {
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  const c = document.createElement('canvas'); c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; el.appendChild(c);
  const x = c.getContext('2d');
  const nodes = items.map((it) => {
    const d = document.createElement('div'); d.style.cssText = `position:absolute;left:0;top:0;font:500 12px/13px "IBM Plex Mono",monospace;color:${color};white-space:pre;pointer-events:none`;
    el.appendChild(d); scramble(d, it.lines.join('\n'), { duration: .6 }); return d;
  });
  let raf = 0, on = true;
  const loop = () => {
    if (!on) return; raf = requestAnimationFrame(loop);
    const r = el.getBoundingClientRect(), k = Math.min(devicePixelRatio, 2);
    if (c.width !== Math.round(r.width * k) || c.height !== Math.round(r.height * k)) { c.width = Math.round(r.width * k); c.height = Math.round(r.height * k); }
    x.setTransform(k, 0, 0, k, 0, 0); x.clearRect(0, 0, r.width, r.height); x.strokeStyle = color; x.lineWidth = 1; x.beginPath();
    items.forEach((it, i) => {
      const a = it.anchor(); const lx = a.x + it.offset[0], ly = a.y + it.offset[1], d = nodes[i], w = d.offsetWidth, h = d.offsetHeight;
      d.style.transform = `translate(${Math.round(lx)}px,${Math.round(ly)}px)`;
      x.moveTo(lx, ly + h + 3); x.lineTo(lx + w, ly + h + 3); x.lineTo(a.x, a.y);
      x.moveTo(a.x - 4, a.y); x.lineTo(a.x + 4, a.y); x.moveTo(a.x, a.y - 4); x.lineTo(a.x, a.y + 4);
    });
    x.stroke();
  };
  loop();
  return { destroy() { on = false; cancelAnimationFrame(raf); c.remove(); nodes.forEach((n) => n.remove()); } };
}
