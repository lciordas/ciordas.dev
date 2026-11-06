// render-windows: floating "render pass" panels that all look into the same 3D scene,
// each drawing it a different way, like peeking at the renderer at work.
import * as THREE from 'three';

// The label is the only part of the frame kept as an image, so resizing never stretches anything.
function labelTexture(label) {
  const dpr = 2, w = 180, h = 20;
  const c = document.createElement('canvas'); c.width = w * dpr; c.height = h * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  x.fillStyle = 'rgba(244,242,238,.62)'; x.font = '10px "Hanken Grotesk", system-ui, sans-serif'; x.textBaseline = 'middle';
  x.letterSpacing = '0.6px'; x.fillText(label, 0, 10.5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

// Window frame drawn in pixels: title bar, three dots, label, and a thin rounded border.
const CHROME_FS = /* glsl */`
precision highp float; varying vec2 vUv; uniform vec2 uSize; uniform sampler2D tLabel;
void main(){
  vec2 px=vec2(vUv.x*uSize.x,(1.-vUv.y)*uSize.y);
  const float R=6.;
  vec2 q=abs(px-uSize*.5)-uSize*.5+R;
  float d=length(max(q,0.))+min(max(q.x,q.y),0.)-R;
  float inside=smoothstep(.5,-.5,d);
  float bar=inside*step(px.y,20.);
  vec3 c=vec3(.106,.094,.09);
  float a=bar;
  float dots=0.;
  for(int i=0;i<3;i++) dots=max(dots,smoothstep(3.4,2.6,distance(px,vec2(10.+float(i)*11.,9.5))));
  c=mix(c,vec3(.48,.42,.36),dots*bar);
  if(bar>.0&&px.x>46.&&px.x<226.){
    vec4 l=texture2D(tLabel,vec2((px.x-46.)/180.,1.-px.y/20.));
    c=mix(c,l.rgb/max(l.a,.001),l.a*bar);
  }
  float line=smoothstep(1.2,.3,abs(d+.5));
  c=mix(c,vec3(1.,.878,.769),line*.42);
  a=max(a,line*.42);
  gl_FragColor=vec4(c,a);
}`;

// How a window opens, measured from the reference across its windows:
// it overshoots by about 13.5% at 190ms and settles at exactly full size by 350ms.
const OPEN = [0, 0.6, 0.95, 1.11, 1.135, 1.09, 1.025, 1];
const OPEN_STEP = 0.05;
export function openCurve(age) {
  if (age <= 0) return 0;
  const f = age / OPEN_STEP, i = Math.floor(f);
  if (i >= OPEN.length - 1) return 1;
  // Smooth interpolation through the measured points.
  const p0 = OPEN[Math.max(0, i - 1)], p1 = OPEN[i], p2 = OPEN[i + 1], p3 = OPEN[Math.min(OPEN.length - 1, i + 2)], t = f - i;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

export const DEFAULT_SLOTS = [
  { label: 'wireframe', mode: 'wireframe', bg: '#050404', x: 300, y: 196, w: 620, h: 420, t: 0.0 },
  { label: 'uv', mode: 'uv', bg: '#141211', x: 812, y: 108, w: 372, h: 304, t: 0.17 },
  { label: 'transmission', mode: 'transmission', bg: '#8e12a0', x: 168, y: 120, w: 410, h: 308, t: 0.34 },
  { label: 'depth', mode: 'depth', bg: '#000000', x: 176, y: 436, w: 430, h: 296, t: 0.5 },
  { label: 'distance', mode: 'rings', bg: '#0b0310', x: 776, y: 424, w: 430, h: 304, t: 0.67 },
  { label: 'beauty', mode: 'beauty', bg: '#000', x: 560, y: 140, w: 300, h: 236, t: 0.83 },
  { label: 'halftone', mode: 'halftone', bg: '#f5c02e', x: 456, y: 452, w: 420, h: 286, t: 1.0 },
  { label: 'thermal', mode: 'thermal', bg: '#06021c', x: 640, y: 196, w: 560, h: 380, t: 1.17 },
];

// options.drawMode(mode) renders the scene for one panel. options.drawBeauty(texture) is optional.
export function mountRenderWindows(renderer, options = {}) {
  const { slots = DEFAULT_SLOTS, drawMode, baseWidth = 1440, baseHeight = 900 } = options;
  const orthoS = new THREE.Scene(), ortho = new THREE.OrthographicCamera(0, 1, 1, 0, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, toneMapped: false }));
  quad.frustumCulled = false; orthoS.add(quad);
  const chromeU = { uSize: { value: new THREE.Vector2(1, 1) }, tLabel: { value: null } };
  const chrome = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0), new THREE.ShaderMaterial({
    uniforms: chromeU, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: CHROME_FS,
  }));
  chrome.frustumCulled = false;
  const chromeS = new THREE.Scene(); chromeS.add(chrome);
  const bgC = new THREE.Color();
  const items = slots.map((s) => ({ ...s, tex: labelTexture(s.label), open: 0 }));
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
      it.CX = cx; it.CY = cy;
    });
  };
  return {
    items, layout,
    // elapsed = seconds since the first panel appeared. target = where to draw.
    // panels: false draws only the backdrop, so the name dissolves straight in from the traced outline.
    render(elapsed, target, beautyTexture, backdrop, { panels = true } = {}) {
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x030303, 1);
      renderer.setScissorTest(false);
      renderer.clear();
      const ac = renderer.autoClear;
      renderer.autoClear = false;
      if (backdrop) {
        quad.material.map = backdrop; quad.material.transparent = false; quad.material.needsUpdate = true;
        renderer.render(orthoS, ortho);
      }
      if (panels) items.forEach((it) => {
        // Each window expands from its centre along the measured curve.
        it.open = openCurve(elapsed - it.t);
        const W = it.W * it.open, H = it.H * it.open;
        if (W < 2 || H < 2) return;
        const X = it.CX - W / 2, Y = it.CY - H / 2;
        const y = vh - Y - H;
        renderer.setScissorTest(true);
        renderer.setScissor(X, y, W, H);
        bgC.set(it.bg); renderer.setClearColor(bgC, 1);
        renderer.clear();
        if (it.mode === 'beauty' && beautyTexture) {
          quad.material.map = beautyTexture; quad.material.needsUpdate = true;
          quad.material.transparent = false;
          quad.scale.set(1, 1, 1); quad.position.set(0, 0, 0);
          renderer.render(orthoS, ortho);
        } else drawMode?.(it.mode, it);
        // Window frame on top, drawn at this frame's exact size.
        renderer.setScissorTest(false);
        chromeU.uSize.value.set(W, H); chromeU.tLabel.value = it.tex;
        chrome.position.set(X / vw, 1 - (Y + H) / vh, 0);
        chrome.scale.set(W / vw, H / vh, 1);
        renderer.render(chromeS, ortho);
      });
      renderer.autoClear = ac;
      renderer.setScissorTest(false);
    },
  };
}
