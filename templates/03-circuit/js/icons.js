// Small inline drawings used around the template.
export const MAIL = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><rect x="1.5" y="3.5" width="15" height="11" rx="2"/><path d="m2 5 7 5 7-5"/></svg>';
export const TAG = '<svg viewBox="0 0 17 18" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M2 8V3h5l8 8-5 5-8-8Z"/><circle cx="5.2" cy="6" r=".6" fill="currentColor"/></svg>';
export const HAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11l5 1.2c1.3.3 2 1.3 2 2.5V17c0 2.5-2 4.5-4.5 4.5h-2c-1.6 0-3-.8-3.8-2.1L4.4 15a1.5 1.5 0 0 1 2.4-1.7L8 14.5"/></svg>';
export const DOODLE = '<svg viewBox="0 0 44 26" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true"><path d="M3 15C8 6 13 3 18 4s6 4 11 3 11 0 12 4-5 9-11 9-9-3-14-2-11 3-13-3Z"/><path d="M12 13c3-3 8-3 11-1s6 2 9 0"/></svg>';

export function laurel() {
  const leaf = (x, y, r) => `<ellipse cx="${x}" cy="${y}" rx="1.4" ry="3.6" transform="rotate(${r} ${x} ${y})" fill="currentColor"/>`;
  const side = [[20, 34, -46], [15, 29, -34], [12, 23, -20], [11, 17, -6], [13, 11, 10], [16, 6, 24]];
  const L = side.map(([x, y, r]) => leaf(x, y, r)).join('');
  const R = side.map(([x, y, r]) => leaf(81 - x, y, -r)).join('');
  return `<svg class="laurel" viewBox="0 0 81 43" aria-hidden="true">${L}${R}<circle cx="40.5" cy="21" r="9.5" fill="none" stroke="currentColor" stroke-width="1"/><path d="M31.5 21h18M33 16.5h15M33 25.5h15" stroke="currentColor" stroke-width=".8"/></svg>`;
}
export const markSVG = (mark, cls = '') => `<svg class="${cls}" viewBox="${mark.viewBox}" aria-hidden="true"><path d="${mark.d}"/></svg>`;
