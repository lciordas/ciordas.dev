// Row of D H M S digits counting down to a date.
export function mountCountdown(el, target) {
  const end = new Date(target).getTime();
  const parts = ['D', 'H', 'M', 'S'];
  el.innerHTML = parts.map((p) => `<b data-p="${p}">00</b><i>${p}</i>`).join('');
  const set = (p, v) => { el.querySelector(`[data-p="${p}"]`).textContent = String(v).padStart(2, '0'); };
  const up = () => {
    const d = Math.max(0, end - Date.now()) / 1000;
    set('D', Math.floor(d / 86400)); set('H', Math.floor(d / 3600) % 24); set('M', Math.floor(d / 60) % 60); set('S', Math.floor(d) % 60);
  };
  up(); const t = setInterval(up, 1000);
  return { stop: () => clearInterval(t) };
}
