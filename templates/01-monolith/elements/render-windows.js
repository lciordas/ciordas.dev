// render-windows: floating "render pass" panels that all look into the same 3D scene,
// each drawing it a different way, like peeking at the renderer at work.
import * as THREE from 'three';

function chromeTexture(w, h, label) {
  const dpr = 2;
  const c = document.createElement('canvas'); c.width = w * dpr; c.height = h * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  x.clearRect(0, 0, w, h);
  // Bar
  const r = 6;
  x.beginPath(); x.roundRect(0.5, 0.5, w - 1, h - 1, r); x.save(); x.clip();
  x.fillStyle = '#1b1817'; x.fillRect(0, 0, w, 20);
  [10, 21, 32].forEach((cx) => { x.fillStyle = 'rgba(255,214,176,.32)'; x.beginPath(); x.arc(cx, 9.5, 3, 0, 7); x.fill(); });
  x.fillStyle = 'rgba(244,242,238,.55)'; x.font = '10px "Hanken Grotesk", system-ui, sans-serif'; x.textBaseline = 'middle';
  x.letterSpacing = '0.6px'; x.fillText(label, 46, 10.5);
  x.restore();
  // Thin border.
  x.strokeStyle = 'rgba(255,224,196,.42)'; x.lineWidth = 1;
  x.beginPath(); x.roundRect(0.5, 0.5, w - 1, h - 1, r); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter;
  return t;
}

export const DEFAULT_SLOTS = [
  { label: 'wireframe', mode: 'wireframe', bg: '#050404', x: 486, y: 235, w: 450, h: 378, t: 0.0 },
  { label: 'transmission', mode: 'transmission', bg: '#8e12a0', x: 383, y: 135, w: 300, h: 261, t: 0.33 },
  { label: 'uv', mode: 'uv', bg: '#141211', x: 569, y: 114, w: 263, h: 308, t: 0.46 },
  { label: 'normals', mode: 'normals', bg: '#050404', x: 603, y: 455, w: 374, h: 180, t: 0.6 },
  { label: 'clay', mode: 'clay', bg: '#050404', x: 377, y: 621, w: 430, h: 206, t: 0.74 },
  { label: 'beauty', mode: 'beauty', bg: '#000', x: 638, y: 222, w: 283, h: 210, t: 0.9 },
  { label: 'beauty', mode: 'beauty', bg: '#000', x: 985, y: 207, w: 440, h: 469, t: 1.05 },
];

// options.drawMode(mode) renders the scene for one panel. options.drawBeauty(texture) is optional.
export function mountRenderWindows(renderer, options = {}) {
  const { slots = DEFAULT_SLOTS, drawMode, baseWidth = 1440, baseHeight = 900 } = options;
  const orthoS = new THREE.Scene(), ortho = new THREE.OrthographicCamera(0, 1, 1, 0, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, toneMapped: false }));
  quad.frustumCulled = false; orthoS.add(quad);
  const bgC = new THREE.Color();
  const items = slots.map((s) => ({ ...s, tex: null, op: 0 }));
  let vw = 1, vh = 1, dpr = 1;
  const layout = (w, h, d) => {
    vw = w; vh = h; dpr = d;
    const k = Math.min(w / baseWidth, h / baseHeight);
    const small = w < 700 && baseWidth >= 1000;
    items.forEach((it) => {
      let sx = k, sy = k;
      if (small) { sx = w / 720; sy = h / 900; }
      const cx = (it.x + it.w / 2 - baseWidth / 2) * sx + w / 2, cy = (it.y + it.h / 2 - baseHeight / 2) * sy + h / 2;
      it.W = Math.round(it.w * sx); it.H = Math.round(it.h * sy);
      it.X = Math.round(cx - it.W / 2); it.Y = Math.round(cy - it.H / 2);
      it.tex?.dispose();
      it.tex = chromeTexture(it.W, it.H, it.label);
    });
  };
  return {
    items, layout,
    // elapsed = seconds since the first panel appeared. target = where to draw.
    render(elapsed, target, beautyTexture) {
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x030303, 1);
      renderer.setScissorTest(false);
      renderer.clear();
      const ac = renderer.autoClear;
      renderer.autoClear = false;
      items.forEach((it) => {
        if (elapsed < it.t) return;
        const y = vh - it.Y - it.H;
        renderer.setScissorTest(true);
        renderer.setScissor(it.X, y, it.W, it.H);
        bgC.set(it.bg); renderer.setClearColor(bgC, 1);
        renderer.clear();
        if (it.mode === 'beauty' && beautyTexture) {
          quad.material.map = beautyTexture; quad.material.needsUpdate = true;
          quad.material.transparent = false;
          quad.scale.set(1, 1, 1); quad.position.set(0, 0, 0);
          renderer.render(orthoS, ortho);
        } else drawMode?.(it.mode, it);
        // Panel chrome on top.
        renderer.setScissorTest(false);
        quad.material.map = it.tex; quad.material.transparent = true; quad.material.needsUpdate = true;
        quad.position.set(it.X / vw, 1 - (it.Y + it.H) / vh, 0);
        quad.scale.set(it.W / vw, it.H / vh, 1);
        renderer.render(orthoS, ortho);
        quad.position.set(0, 0, 0); quad.scale.set(1, 1, 1);
      });
      renderer.autoClear = ac;
      renderer.setScissorTest(false);
    },
  };
}
