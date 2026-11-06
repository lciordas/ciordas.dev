// Shared helpers for the monolith elements. Not an element itself.
import * as THREE from 'three';

THREE.ColorManagement.enabled = false; // the whole pipeline works directly in display colour

export const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const h3 = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
export function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const m = (a, b, t) => a + (b - a) * t;
  return m(
    m(m(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), m(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    m(m(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), m(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v),
    w
  );
}
export function fbm2(x, y, octaves = 4) {
  let a = 0.5, s = 0, n = 0;
  for (let i = 0; i < octaves; i++) {
    s += a * vnoise3(x, y, i * 3.7);
    n += a;
    a *= 0.5; x *= 2.03; y *= 2.03;
  }
  return s / n;
}

export const GLSL_NOISE = /* glsl */`
float hash31(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yxz+33.33); return fract((p.x+p.y)*p.z); }
float hash21(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float vnoise(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec3(11.3,7.1,3.7); a*=.5; } return s/.97; }
`;

// A palette is plain hex strings. This keeps the matching uniforms and lets them cross-fade.
export const PALETTE_KEYS = ['top', 'mid', 'haze', 'low', 'pale', 'stone', 'deep', 'shard'];
export function paletteUniforms(p) {
  const u = {};
  for (const k of PALETTE_KEYS) u['p_' + k] = { value: new THREE.Color(p[k]) };
  return u;
}
const _c = new THREE.Color();
export function tweenPalette(uniforms, target, lambda, dt) {
  for (const k of PALETTE_KEYS) {
    _c.set(target[k]);
    const c = uniforms['p_' + k].value;
    const t = 1 - Math.exp(-lambda * dt);
    c.r += (_c.r - c.r) * t; c.g += (_c.g - c.g) * t; c.b += (_c.b - c.b) * t;
  }
}

// Minimal standalone stage, used when an element is mounted on its own.
export function ensureStage(container, { fov = 35, position = [0, 2.8, 11], look = [0, 2.8, 0], background = 0x000000 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(background, 1);
  container.appendChild(renderer.domElement);
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 400);
  camera.position.set(...position);
  camera.lookAt(...look);
  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  let raf = 0, last = performance.now(), running = true;
  const start = (fn) => {
    const tick = (t) => {
      if (!running) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      fn(dt, t / 1000);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  const destroy = () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); };
  return { renderer, scene, camera, start, destroy };
}

export const hasWebGL = () => {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch (e) { return false; }
};
