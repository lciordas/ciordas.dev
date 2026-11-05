// sequence: plays a folder of numbered frames on a canvas, driven by a position from 0 to 1.
// Sparse frames load first, so scrubbing works right away and sharpens as the rest arrive.
export function mountSequence(canvas, base) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const frames = [];
  let count = 0, W = 1, H = 1, dpr = 1, current = -1, started = false, frameW = 16, frameH = 9;
  const ready = fetch(`${base}/manifest.json`).then((r) => r.json()).then((m) => { count = m.count; frameW = m.width; frameH = m.height; frames.length = count; });

  const load = (i) => new Promise((res) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => { frames[i] = img; if (current < 0 || Math.abs(i - current) < 3) api.draw(current < 0 ? 0 : current, true); res(); }); };
    img.onerror = () => res();
    img.src = `${base}/${String(i + 1).padStart(4, '0')}.webp`;
  });
  const start = async () => {
    if (started) return; started = true;
    await ready;
    const order = [], seen = new Set();
    for (const step of [16, 8, 4, 2, 1]) for (let i = 0; i < count; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
    let next = 0;
    const worker = async () => { while (next < order.length) await load(order[next++]); };
    await Promise.all(Array.from({ length: 6 }, worker));
  };
  const nearest = (i) => {
    if (frames[i]) return frames[i];
    for (let d = 1; d < count; d++) { if (frames[i - d]) return frames[i - d]; if (frames[i + d]) return frames[i + d]; }
    return null;
  };
  const api = {
    get aspect() { return frameW / frameH; },
    get loaded() { return frames.filter(Boolean).length; },
    get total() { return count; },
    start,
    resize(w, h, ratio) { W = w; H = h; dpr = ratio; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); current = -1; },
    // The on-screen rectangle of the frame: fills wide screens, sits whole on narrow ones.
    rect() {
      const a = frameW / frameH, wide = W / H > 0.9;
      const k = wide ? Math.max(W / frameW, H / frameH) : Math.max(W / frameW, (H * 0.5) / frameH);
      const dw = frameW * k, dh = frameH * k;
      return { x: (W - dw) / 2, y: (H - dh) / 2, w: dw, h: dh, a };
    },
    draw(i, force) {
      i = Math.max(0, Math.min(count - 1, i));
      if (i === current && !force) return;
      const img = nearest(i);
      if (!img) return;
      current = i;
      const r = api.rect();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, r.x, r.y, r.w, r.h);
    },
    seek(p) { if (count) api.draw(Math.round(p * (count - 1))); },
  };
  return api;
}
