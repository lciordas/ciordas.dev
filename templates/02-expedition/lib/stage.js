// Tiny self-contained stage for mounting one effect inside any element.
import * as THREE from 'three';
import { Post } from './post.js';
import { LAYER_BACK } from './crystal.js';

export function createStage(container, { fov = 35, position = [0, 0, 40], target = [0, 0, 0], background = '#a0a5b1', dprMax = 1.5, exposure, bloom } = {}) {
  THREE.ColorManagement.enabled = false;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  container.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  const post = new Post(renderer, { levels: 5, samples: 4 });
  if (exposure) post.f.uExposure.value = exposure; if (bloom !== undefined) post.f.uBloom.value = bloom;
  const scene = new THREE.Scene();
  const bgC = new THREE.Color(background); const lin = (v) => Math.pow(v, 2.2) / .72;
  scene.background = new THREE.Color(lin(bgC.r), lin(bgC.g), lin(bgC.b));
  const camera = new THREE.PerspectiveCamera(fov, 1, .1, 6000); camera.position.set(...position); camera.lookAt(...target); camera.layers.enable(LAYER_BACK);
  const G = { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uCut: { value: -1 }, uFog: { value: new THREE.Color(.35, .37, .42) }, uFogLight: { value: new THREE.Color(.55, .57, .64) }, uPxScale: { value: 1 } };
  const dpr = Math.min(devicePixelRatio || 1, dprMax);
  const mouse = { x: 0, y: 0, nx: 0, ny: 0, inside: false };
  const resize = () => {
    const r = container.getBoundingClientRect(); const w = Math.max(2, r.width), h = Math.max(2, r.height);
    renderer.setPixelRatio(1); renderer.setSize(Math.round(w * dpr), Math.round(h * dpr), false);
    post.setSize(Math.round(w * dpr), Math.round(h * dpr), dpr);
    G.uRes.value.set(Math.round(w * dpr), Math.round(h * dpr));
    camera.aspect = w / h; camera.updateProjectionMatrix();
    G.uPxScale.value = Math.round(h * dpr) / (2 * Math.tan(camera.fov * Math.PI / 360));
    s.width = w; s.height = h;
  };
  const onMove = (e) => { const r = container.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.nx = mouse.x / r.width * 2 - 1; mouse.ny = mouse.y / r.height * 2 - 1; mouse.inside = true; };
  container.addEventListener('pointermove', onMove);
  const ro = new ResizeObserver(resize); ro.observe(container);
  let raf = 0, last = performance.now(), running = true;
  const s = {
    scene, camera, renderer, post, G, mouse, width: 1, height: 1, useBack: false, onFrame: null,
    destroy() { running = false; cancelAnimationFrame(raf); ro.disconnect(); container.removeEventListener('pointermove', onMove); renderer.dispose(); renderer.forceContextLoss?.(); canvas.remove(); },
  };
  resize();
  const frame = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    G.uTime.value += dt; post.f.uTime.value = G.uTime.value;
    s.onFrame?.(dt, G.uTime.value);
    if (s.useBack) { camera.layers.set(LAYER_BACK); post.renderBack(scene, camera); camera.layers.enable(0); }
    post.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);
  return s;
}
