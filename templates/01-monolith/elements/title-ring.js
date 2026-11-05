// title-ring: huge titles standing on the inside of a cylinder around the viewer's focus.
// Text is solid while inside the centre window and an outline outside it, cut per pixel,
// and the outline blurs as it swings toward the camera.
import * as THREE from 'three';
import { ensureStage, clamp, damp, lerp, smooth } from './_util.js';

const CANVAS_H = 512;
function drawTitle(lines, font, tracking, stretch, stroke) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fontPx = 196;
  const lineH = fontPx * 0.8;
  ctx.font = `400 ${fontPx}px ${font}`;
  const measure = (s) => { let w = 0; for (const ch of s) w += ctx.measureText(ch).width + tracking * fontPx; return w - tracking * fontPx; };
  const pad = 22;
  const textW = Math.max(...lines.map(measure)) * stretch;
  const W = Math.min(4096, Math.ceil(textW + pad * 2)), H = Math.ceil(lineH * lines.length + fontPx * 0.26 + pad * 2);
  c.width = THREE.MathUtils.ceilPowerOfTwo(W); c.height = THREE.MathUtils.ceilPowerOfTwo(H);
  const sx = c.width / W, sy = c.height / H;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.font = `400 ${fontPx}px ${font}`;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  const drawLine = (s, y, mode) => {
    const lw = measure(s) * stretch;
    let x = (W - lw) / 2;
    for (const ch of s) {
      ctx.save();
      ctx.translate(x, y); ctx.scale(stretch, 1);
      if (mode === 0) { ctx.fillStyle = '#f00'; ctx.fillText(ch, 0, 0); }
      else { ctx.strokeStyle = '#0f0'; ctx.lineWidth = stroke; ctx.strokeText(ch, 0, 0); }
      ctx.restore();
      x += (ctx.measureText(ch).width + tracking * fontPx) * stretch;
    }
  };
  lines.forEach((s, i) => {
    const y = pad + fontPx * 0.86 + i * lineH;
    drawLine(s, y, 0); drawLine(s, y, 1);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 8;
  tex.colorSpace = THREE.NoColorSpace;
  return { tex, w: W / fontPx, h: H / fontPx };
}

const VERT = /* glsl */`
uniform vec2 uSize; uniform float uArc,uR,uFront,uY,uRoll,uVel,uTime,uScale,uArcScale;
varying vec2 vUv; varying float vArcPx;
void main(){
  vUv=uv;
  vec2 lp=position.xy*uSize*uScale;
  float arc=uArc*uArcScale+lp.x;
  float th=arc/uR;
  float y=uY+lp.y+uRoll*lp.x+sin(arc*.9+uTime*2.4)*uVel*.12;
  vec3 w=vec3(uR*sin(th),y,uFront+uR-uR*cos(th));
  vArcPx=arc;
  gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);
}`;
const FRAG = /* glsl */`
precision highp float;
uniform sampler2D uTex; uniform float uFillEdge,uFillA,uLineA,uBlur,uScale,uFillMul; uniform vec3 uFillC,uLineC;
varying vec2 vUv; varying float vArcPx;
void main(){
  float a=abs(vArcPx);
  float inFill=1.-smoothstep(uFillEdge*uScale*uFillMul-.03,uFillEdge*uScale*uFillMul+.03,a);
  float bias=smoothstep(2.1,7.5,a)*uBlur;
  vec4 s=texture2D(uTex,vUv,bias);
  // Outline gets a soft doubled look as it approaches the lens.
  float fill=s.r;
  float line=s.g;
  if(bias>.2){ line=max(line,texture2D(uTex,vUv+vec2(.004,.002)*bias,bias).g*.75); }
  vec3 c=mix(uLineC,uFillC,inFill);
  float alpha=mix(line*uLineA,fill*uFillA,inFill);
  if(alpha<.004) discard;
  gl_FragColor=vec4(c,alpha);
}`;

export function mountTitleRing(container, options = {}) {
  const {
    titles = [['PROJECT', 'ONE'], ['PROJECT', 'TWO'], ['PROJECT', 'THREE']],
    font = '"Archivo Black", sans-serif',
    R = 4.7, front = 1.72, y = 0.5, scale = 0.72, gap = 0.5,
    tracking = -0.026, stretch = 1.16, stroke = 3.2,
    fillColor = '#fff7f2', lineColor = '#c9c6cf',
  } = options;
  const stage = options.scene ? null : ensureStage(container, { position: [0, 2.0, 11.2], look: [0, 1.5, 0], background: 0x160605 });
  const parent = options.scene || stage.scene;
  const group = new THREE.Group();
  parent.add(group);
  const shared = { uFillMul: { value: 1 }, uScale: { value: 1 }, uArcScale: { value: 1 }, uR: { value: R }, uFront: { value: front }, uY: { value: y }, uRoll: { value: 0 }, uVel: { value: 0 }, uTime: { value: 0 }, uFillA: { value: 1 }, uLineA: { value: 0.62 }, uBlur: { value: 3.2 }, uFillC: { value: new THREE.Color(fillColor) }, uLineC: { value: new THREE.Color(lineColor) } };
  const geo = new THREE.PlaneGeometry(1, 1, 80, 1);
  const items = titles.map((lines) => {
    const { tex, w, h } = drawTitle(lines, font, tracking, stretch, stroke);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
      uniforms: { ...shared, uTex: { value: tex }, uSize: { value: new THREE.Vector2(w * scale, h * scale) }, uArc: { value: 0 }, uFillEdge: { value: (w * scale) / 2 + 0.02 } },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 20;
    group.add(mesh);
    return { mesh, mat, w: w * scale, h: h * scale };
  });
  // Arc positions: spaced by each title's width, so wide names do not collide.
  const N = items.length;
  let total = 0;
  const centers = items.map((it, i) => {
    const prev = items[(i - 1 + N) % N];
    const c = i === 0 ? 0 : total + prev.w / 2 + it.w / 2 + gap;
    total = c;
    return c;
  });
  const L = total + items[N - 1].w / 2 + items[0].w / 2 + gap;
  const arcOf = (pos) => {
    const p = ((pos % N) + N) % N, a = Math.floor(p), b = (a + 1) % N, f = p - a;
    const ca = centers[a], cb = b === 0 ? L : centers[b];
    return ca + (cb - ca) * f;
  };
  const wrap = (v) => { let x = (v + L / 2) % L; if (x < 0) x += L; return x - L / 2; };

  const api = {
    group, items, centers, shared,
    setFlatten(f) { // 0 = curved ring, 1 = nearly flat row
      const r = lerp(R, R * 3.4, f);
      shared.uR.value = r;
    },
    setAlpha(fill, line) { shared.uFillA.value = fill; shared.uLineA.value = line; },
    update(dt, time, pos, velocity = 0) {
      const center = arcOf(pos);
      shared.uTime.value = time;
      shared.uVel.value = clamp(velocity, -1.4, 1.4);
      shared.uRoll.value = damp(shared.uRoll.value, -0.018 - velocity * 0.05, 7, dt);
      items.forEach((it, i) => {
        const arc = wrap(centers[i] - center);
        it.arc = arc;
        it.mat.uniforms.uArc.value = arc;
        it.mesh.visible = Math.abs(arc) < shared.uR.value * 1.85 + it.w / 2;
      });
    },
    // True when the normalized device point falls on the title nearest the centre.
    hitFront(ndc, camera) {
      const best = items.reduce((a, b) => (Math.abs(b.arc ?? 9e9) < Math.abs(a.arc ?? 9e9) ? b : a));
      const rr = shared.uR.value, fr = shared.uFront.value, yy = shared.uY.value;
      const proj = (lx, ly) => {
        const arc = best.arc * shared.uArcScale.value + lx, th = arc / rr;
        return new THREE.Vector3(rr * Math.sin(th), yy + ly, fr + rr - rr * Math.cos(th)).project(camera);
      };
      const k = shared.uScale.value;
      const a = proj((-best.w / 2) * k, (-best.h / 2) * k), b = proj((best.w / 2) * k, (best.h / 2) * k);
      return ndc.x > Math.min(a.x, b.x) && ndc.x < Math.max(a.x, b.x) && ndc.y > Math.min(a.y, b.y) && ndc.y < Math.max(a.y, b.y);
    },
    start(fn) { stage.start((dt, t) => { fn && fn(dt, t, stage); }); },
    stage,
  };
  return api;
}
