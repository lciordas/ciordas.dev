// trace: the name's outlines drawn by hand, climbing both sides of every letter at once
// from its base, with a hot tip on each strand and a soft glow behind the line.
const lengths = (pts) => { const out = [0]; for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return out; };

export function mountTrace(parent, letters, options = {}) {
  const { stroke = 'rgba(255,222,194,.8)', tip = 'rgba(255,246,234,1)', glow = 'rgba(255,164,104,.62)', tipGlow = 'rgba(255,190,130,1)', lineWidth = 1.1 } = options;
  const make = (cls) => { const c = document.createElement('canvas'); c.className = cls; c.setAttribute('aria-hidden', 'true'); parent.appendChild(c); return c; };
  const glowC = make('trace trace--glow'), lineC = make('trace');
  const gx = glowC.getContext('2d'), lx = lineC.getContext('2d');

  // Each outline becomes two strands that start at its lowest point and meet at its highest.
  const strands = [];
  letters.forEach((L, li) => {
    L.contours.forEach((c, ci) => {
      const pts = []; for (let i = 0; i < c.pts.length; i += 2) pts.push([c.pts[i], c.pts[i + 1]]);
      let lo = 0, hi = 0;
      pts.forEach((p, i) => { if (p[1] < pts[lo][1] - 1e-4) lo = i; if (p[1] > pts[hi][1] + 1e-4) hi = i; });
      const n = pts.length, a = [], b = [];
      for (let i = lo; ; i = (i + 1) % n) { a.push(pts[i]); if (i === hi) break; }
      for (let i = lo; ; i = (i - 1 + n) % n) { b.push(pts[i]); if (i === hi) break; }
      const delay = (li / Math.max(1, letters.length - 1)) * 0.54 + ci * 0.035;
      [a, b].forEach((s) => { const len = lengths(s); strands.push({ pts: s, len, total: len[len.length - 1], delay, dur: 0.42 }); });
    });
  });

  let map = (x, y) => [x, y], dpr = 1, W = 1, H = 1, last = 0;
  const walk = (ctx, s, upto) => {
    const target = s.total * upto;
    let [x, y] = map(s.pts[0][0], s.pts[0][1]);
    ctx.moveTo(x, y);
    for (let i = 1; i < s.pts.length; i++) {
      if (s.len[i] >= target) {
        const k = (target - s.len[i - 1]) / Math.max(1e-6, s.len[i] - s.len[i - 1]);
        [x, y] = map(s.pts[i - 1][0] + (s.pts[i][0] - s.pts[i - 1][0]) * k, s.pts[i - 1][1] + (s.pts[i][1] - s.pts[i - 1][1]) * k);
        ctx.lineTo(x, y);
        return [x, y];
      }
      [x, y] = map(s.pts[i][0], s.pts[i][1]);
      ctx.lineTo(x, y);
    }
    return [x, y];
  };
  const ease = (t) => t * t * (3 - 2 * t);

  const api = {
    layout(w, h, ratio, mapper) {
      W = w; H = h; dpr = ratio; map = mapper;
      [glowC, lineC].forEach((c) => { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); });
      glowC.width = Math.round(w * dpr / 2); glowC.height = Math.round(h * dpr / 2);
      api.set(last);
    },
    // p runs from 0 to 1 across the whole name.
    set(p) {
      last = p;
      lx.setTransform(dpr, 0, 0, dpr, 0, 0); lx.clearRect(0, 0, W, H);
      gx.setTransform(dpr / 2, 0, 0, dpr / 2, 0, 0); gx.clearRect(0, 0, W, H);
      lx.lineCap = gx.lineCap = 'round'; lx.lineJoin = gx.lineJoin = 'round';
      lx.strokeStyle = stroke; lx.lineWidth = lineWidth; gx.strokeStyle = glow; gx.lineWidth = 2.6;
      const tips = [];
      lx.beginPath(); gx.beginPath();
      strands.forEach((s) => {
        const t = Math.min(1, Math.max(0, (p - s.delay) / s.dur));
        if (t <= 0) return;
        const u = ease(t);
        const end = walk(lx, s, u); walk(gx, s, u);
        if (t < 1) tips.push({ s, u, end });
      });
      lx.stroke(); gx.stroke();
      // Hot tips: a short bright stretch and a small glow where the line is being drawn.
      if (tips.length) {
        lx.strokeStyle = tip; lx.lineWidth = lineWidth * 1.7;
        lx.beginPath();
        tips.forEach(({ s, u }) => {
          const from = Math.max(0, u - 0.05 / Math.max(0.4, s.total));
          const target = s.total * from;
          let i = 1; while (i < s.pts.length - 1 && s.len[i] < target) i++;
          const k = (target - s.len[i - 1]) / Math.max(1e-6, s.len[i] - s.len[i - 1]);
          const [x0, y0] = map(s.pts[i - 1][0] + (s.pts[i][0] - s.pts[i - 1][0]) * k, s.pts[i - 1][1] + (s.pts[i][1] - s.pts[i - 1][1]) * k);
          lx.moveTo(x0, y0);
          const stop = s.total * u;
          for (; i < s.pts.length && s.len[i] < stop; i++) { const [x, y] = map(s.pts[i][0], s.pts[i][1]); lx.lineTo(x, y); }
          lx.lineTo(tips.find((q) => q.s === s).end[0], tips.find((q) => q.s === s).end[1]);
        });
        lx.stroke();
        gx.fillStyle = tipGlow;
        tips.forEach(({ end }) => { gx.beginPath(); gx.arc(end[0], end[1], 5, 0, 6.3); gx.fill(); });
      }
    },
    // A flattened copy with the glow, for use as the backdrop behind the windows.
    snapshot() {
      const c = document.createElement('canvas'); c.width = lineC.width; c.height = lineC.height;
      const x = c.getContext('2d');
      x.fillStyle = '#030303'; x.fillRect(0, 0, c.width, c.height);
      if ('filter' in x) x.filter = `blur(${7 * dpr}px)`;
      x.globalAlpha = 0.85;
      x.drawImage(glowC, 0, 0, c.width, c.height);
      if ('filter' in x) x.filter = 'none';
      x.globalAlpha = 1;
      x.drawImage(lineC, 0, 0);
      return c;
    },
    hide() { [glowC, lineC].forEach((c) => { c.style.display = 'none'; }); },
    destroy() { glowC.remove(); lineC.remove(); },
  };
  return api;
}
