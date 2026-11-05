// Flips nav colors to suit whichever section sits under them.
// Tag sections with data-nav-theme="dark|light"; "auto" reads the stage's current brightness.
export function mountNavTheme({ root = document.documentElement, probeY = 45 } = {}) {
  let last = '';
  const tick = () => {
    let theme = root.dataset.stageTheme || 'dark';
    const hits = document.elementsFromPoint(innerWidth / 2, probeY);
    for (const n of hits) {
      const t = n.closest?.('[data-nav-theme]');
      if (t) { const v = t.dataset.navTheme; theme = v === 'auto' ? theme : v; break; }
    }
    if (theme !== last) { root.dataset.nav = theme; last = theme; }
    root.classList.toggle('is-scrolled', scrollY > 60);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
