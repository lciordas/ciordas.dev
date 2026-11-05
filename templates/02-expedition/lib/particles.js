// Point-cloud form that streams into new shapes. Shapes can be a stone form or any short text.
import * as THREE from 'three';
import { rng, fbm3 } from './math.js';

const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; };

// Pile of soft stones, built from a blended distance field.
function stonesSDF(x, y, z) {
  const ell = (cx, cy, cz, rx, ry, rz) => { const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz; const k0 = Math.hypot(px, py, pz); const k1 = Math.hypot(px / rx, py / ry, pz / rz); return k1 > 1e-5 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz); };
  let d = ell(0, 3.1, 0, 7.6, 3.6, 6.8);
  d = smin(d, ell(.8, 8.5, -.2, 6.0, 3.0, 5.4), 1.1);
  d = smin(d, ell(-.5, 12.9, .3, 4.4, 2.3, 3.9), .9);
  d = smin(d, ell(.6, 16.3, 0, 2.9, 1.8, 2.7), .8);
  d = smin(d, ell(-5.6, 2.1, 3.8, 2.1, 1.7, 2.), .7);
  d += (fbm3(x * .34, y * .34, z * .34, 3) - .5) * 1.2;
  return d;
}

export function stoneShape(count, seed = 4) {
  const rand = rng(seed);
  const P = new Float32Array(count * 3), N = new Float32Array(count * 3);
  const e = .08;
  for (let i = 0; i < count; i++) {
    let x = (rand() - .5) * 18, y = rand() * 19, z = (rand() - .5) * 16;
    let nx = 0, ny = 1, nz = 0;
    for (let k = 0; k < 7; k++) {
      const d = stonesSDF(x, y, z);
      nx = stonesSDF(x + e, y, z) - d; ny = stonesSDF(x, y + e, z) - d; nz = stonesSDF(x, y, z + e) - d;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      x -= nx * d; y -= ny * d; z -= nz * d;
    }
    const j = -rand() * rand() * .55;
    P[i * 3] = x + nx * j; P[i * 3 + 1] = y + ny * j; P[i * 3 + 2] = z + nz * j;
    N[i * 3] = nx; N[i * 3 + 1] = ny; N[i * 3 + 2] = nz;
  }
  return { P, N };
}

// Extruded letters sampled from a canvas mask.
export function textShape(text, count, seed = 8, font = '"Archivo Black", Arial, sans-serif') {
  const rand = rng(seed);
  const S = 420;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let fs = 300; x.font = `900 ${fs}px ${font}`;
  const m = x.measureText(text).width; if (m > S * .9) { fs = Math.floor(fs * S * .9 / m); x.font = `900 ${fs}px ${font}`; }
  x.fillText(text, S / 2, S / 2 + fs * .03);
  const d = x.getImageData(0, 0, S, S).data;
  const at = (i, j) => (i < 0 || j < 0 || i >= S || j >= S) ? 0 : d[(i + j * S) * 4] / 255;
  const P = new Float32Array(count * 3), N = new Float32Array(count * 3);
  const scale = 21 / S, depth = 2.5;
  let i = 0, guard = 0;
  while (i < count && guard++ < count * 200) {
    const u = rand() * S, v = rand() * S, ui = u | 0, vi = v | 0;
    if (at(ui, vi) < .5) continue;
    const gx = at(ui + 2, vi) - at(ui - 2, vi), gy = at(ui, vi + 2) - at(ui, vi - 2), gl = Math.hypot(gx, gy);
    const isEdge = gl > .1;
    if (!isEdge && rand() < .3) continue;
    let nx, ny, nz, z;
    if (isEdge && rand() < .75) { z = (rand() * 2 - 1) * depth; nx = -gx / gl; ny = gy / gl; nz = 0; }
    else { const s = rand() < .72 ? 1 : -1; z = s * depth; nx = 0; ny = 0; nz = s; }
    P[i * 3] = (u - S / 2) * scale; P[i * 3 + 1] = (S / 2 - v) * scale + 9.5; P[i * 3 + 2] = z;
    N[i * 3] = nx; N[i * 3 + 1] = ny; N[i * 3 + 2] = nz;
    i++;
  }
  for (; i < count; i++) { P[i * 3] = P[0]; P[i * 3 + 1] = P[1]; P[i * 3 + 2] = P[2]; N[i * 3 + 2] = 1; }
  return { P, N };
}

// Sort so particles move to shapes at similar heights.
function sortShape(s, count) {
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => s.P[a * 3 + 1] - s.P[b * 3 + 1]);
  const P = new Float32Array(count * 3), N = new Float32Array(count * 3);
  order.forEach((o, i) => { P.set(s.P.subarray(o * 3, o * 3 + 3), i * 3); N.set(s.N.subarray(o * 3, o * 3 + 3), i * 3); });
  return { P, N };
}

export function createParticleForm({ G, count = 28000, shapes = [] }) {
  const rand = rng(5);
  const sorted = shapes.map((s) => sortShape(s, count));
  const g = new THREE.BufferGeometry();
  const A = new THREE.BufferAttribute(new Float32Array(sorted[0].P), 3), B = new THREE.BufferAttribute(new Float32Array(sorted[0].P), 3);
  const NA = new THREE.BufferAttribute(new Float32Array(sorted[0].N), 3), NB = new THREE.BufferAttribute(new Float32Array(sorted[0].N), 3);
  const seed = new Float32Array(count * 4); for (let i = 0; i < count * 4; i++) seed[i] = rand();
  g.setAttribute('position', A); g.setAttribute('aB', B); g.setAttribute('aNa', NA); g.setAttribute('aNb', NB);
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const U = { uTime: G.uTime, uRes: G.uRes, uCut: G.uCut, uMorph: { value: 0 }, uHover: { value: 0 }, uSize: { value: 1 }, uPx: G.uPxScale, uAlpha: { value: 1 }, uHot: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */`
      attribute vec3 aB,aNa,aNb; attribute vec4 aSeed;
      uniform float uMorph,uTime,uHover,uSize,uPx,uHot;
      varying vec3 vN; varying float vHeat;
      vec3 flow(vec3 p,float t){ return vec3(sin(p.y*.6+t)+sin(p.z*.9-t*.7), sin(p.z*.7+t*.8)+sin(p.x*.5+t*.3), sin(p.x*.8-t*.6)+sin(p.y*.4+t*.5)); }
      void main(){
        float yn=clamp(position.y/20.,0.,1.);
        float delay=clamp(yn*.42+aSeed.x*.2,0.,.62);
        float p=clamp((uMorph-delay)/.38,0.,1.);
        float e=p*p*(3.-2.*p);
        vec3 pos=mix(position,aB,e);
        float k=sin(3.14159*p);
        pos+=flow(pos*.3+aSeed.xyz*2.,uTime*.8+aSeed.w*6.)*k*k*(2.2+aSeed.w*3.6)+vec3(0.,.8,0.)*k*sin(aSeed.y*6.28)*2.;
        vec3 nrm=normalize(mix(aNa,aNb,e)+vec3(1e-4));
        // hover: the lower body slowly unravels
        float lv=(1.-smoothstep(uHover*.2-.05,uHover*.2+.09,yn))*uHover;
        float fall=fract(aSeed.w+uTime*(.09+aSeed.y*.14))*lv;
        pos+=flow(pos*.35+aSeed.yzx*4.,uTime*.55+aSeed.w*9.)*fall*2.3;
        pos.y-=fall*fall*6.5;
        // idle shiver
        pos+=nrm*sin(uTime*1.4+aSeed.z*40.)*.035;
        vHeat=clamp(k*k*k*k*.9*step(.45,aSeed.y)+fall*fall*1.3+uHot*aSeed.x*aSeed.x,0.,1.);
        vN=mat3(modelMatrix)*nrm;
        vec4 mv=modelViewMatrix*vec4(pos,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=uPx*uSize*(.8+.45*aSeed.y)*(1.+vHeat*.3)/-mv.z;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vN; varying float vHeat; uniform float uAlpha;
      void main(){
        vec2 q=gl_PointCoord*2.-1.; float l=dot(q,q); if(l>1.) discard;
        vec3 N=normalize(normalize(vN)*1.4+vec3(q.x,-q.y,sqrt(1.-l))*.75);
        float d=max(dot(N,normalize(vec3(-.25,.8,.55))),0.);
        float amb=mix(.5,.95,N.y*.5+.5);
        vec3 alb=vec3(.145,.16,.2);
        vec3 c=alb*(amb*.7+d*2.5);
        c*=.65+.35*sqrt(1.-l);
        c=mix(c,vec3(1.25,1.5,1.85),vHeat);
        gl_FragColor=vec4(c,1.);
      }`,
  });
  const points = new THREE.Points(g, m); points.frustumCulled = false;
  let current = 0, target = 0, morphing = false, t0 = 0, dur = 2.1;
  function morphTo(i, now) {
    if (i === target && !morphing) return;
    // collapse in-flight morph to its target first
    A.array.set(sorted[target].P); NA.array.set(sorted[target].N);
    target = i; B.array.set(sorted[i].P); NB.array.set(sorted[i].N);
    A.needsUpdate = B.needsUpdate = NA.needsUpdate = NB.needsUpdate = true;
    U.uMorph.value = 0; morphing = true; t0 = now; current = target;
  }
  function update(now) {
    if (!morphing) return;
    const p = Math.min(1, (now - t0) / dur);
    U.uMorph.value = p;
    if (p >= 1) morphing = false;
  }
  return { points, uniforms: U, morphTo, update, get index() { return target; }, count };
}
