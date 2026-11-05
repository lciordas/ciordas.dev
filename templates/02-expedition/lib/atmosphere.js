// Sky dome, drifting snow, ambient blurred words, and the load-in wire lines.
import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { rng } from './math.js';
import { LAYER_BACK } from './crystal.js';

export function createSky({ G }) {
  const U = { uTime: G.uTime, uTop: { value: new THREE.Color(.6, .62, .68) }, uMid: G.uFog, uLow: { value: new THREE.Color(.36, .38, .44) }, uCloud: { value: 0 }, uShade: { value: 0 }, uShaft: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, uniforms: U,
    vertexShader: `varying vec3 vD; void main(){ vD=position; vec4 p=projectionMatrix*mat4(mat3(viewMatrix))*vec4(position,1.); gl_Position=p.xyww; }`,
    fragmentShader: /* glsl */`
      varying vec3 vD; uniform vec3 uTop,uMid,uLow; uniform float uCloud,uShade,uTime,uShaft;
      ${NOISE}
      void main(){
        vec3 d=normalize(vD);
        vec3 c=d.y>0.?mix(uMid,uTop,smoothstep(.0,.42,d.y)):mix(uMid,uLow,smoothstep(0.,-.5,d.y));
        vec3 q=d*2.2+vec3(uTime*.018,0.,uTime*.01);
        float n=fbm3(q);
        c=mix(c,c*(.62+n*.85),uCloud);
        float sw=fbm3(d*1.15+vec3(-uTime*.012,3.1,0.));
        c=mix(c,c*smoothstep(.2,.65,sw)*1.25,uShade);
        // brighter core when looking down the shaft
        c+=vec3(.5,.56,.66)*uShaft*pow(max(-d.y,0.),10.);
        gl_FragColor=vec4(c,1.);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 24), m);
  mesh.frustumCulled = false; mesh.renderOrder = -10; mesh.layers.enable(LAYER_BACK);
  return { mesh, uniforms: U };
}

export function createSnow({ G, count = 700, box = 90 }) {
  const rand = rng(17);
  const P = new Float32Array(count * 3), S = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) { P[i * 3] = rand() * box; P[i * 3 + 1] = rand() * box; P[i * 3 + 2] = rand() * box; S[i * 2] = rand(); S[i * 2 + 1] = rand(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.BufferAttribute(S, 2));
  const U = { uTime: G.uTime, uBox: { value: box }, uCam: { value: new THREE.Vector3() }, uPx: G.uPxScale, uA: { value: 1 } };
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: U,
    vertexShader: /* glsl */`
      attribute vec2 aS; uniform float uTime,uBox,uPx; uniform vec3 uCam; varying float vA;
      void main(){
        vec3 p=position+vec3(uTime*(2.2+aS.x*2.4)+sin(uTime*.5+aS.y*9.)*1.4,-uTime*(1.3+aS.y*1.5),uTime*.7);
        p=mod(p-uCam,uBox)-uBox*.5+uCam;
        vec4 mv=viewMatrix*vec4(p,1.);
        float dz=-mv.z;
        vA=smoothstep(2.,10.,dz)*smoothstep(uBox*.5,uBox*.2,dz)*(.25+aS.x*.55);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=uPx*(.035+aS.y*.06)/dz;
      }`,
    fragmentShader: `varying float vA; uniform float uA; void main(){ float l=length(gl_PointCoord-.5); float a=smoothstep(.5,.05,l); gl_FragColor=vec4(vec3(1.05,1.1,1.2)*a*vA*uA,1.); }`,
  });
  const points = new THREE.Points(g, m); points.frustumCulled = false; points.renderOrder = 8;
  return { points, uniforms: U };
}

export function createAmbientText({ G, words = [] }) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 2048;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 2048, 2048);
  x.filter = 'blur(10px)'; x.fillStyle = '#fff'; x.textBaseline = 'top';
  const r = rng(8);
  const lines = Math.max(1, words.length) * 3;
  for (let i = 0; i < lines; i++) {
    const w = words[i % Math.max(1, words.length)] || '';
    x.globalAlpha = .4 + r() * .6;
    x.font = `500 ${46 + Math.floor(r() * 34)}px "IBM Plex Mono", ui-monospace, monospace`;
    x.fillText(w, r() * 1500, (i + r() * .6) * (2048 / lines));
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const U = { tT: { value: t }, uOff: { value: new THREE.Vector2() }, uA: { value: 0 }, uAspect: { value: 1.6 } };
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, uniforms: U,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,.9999,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tT; uniform vec2 uOff; uniform float uA,uAspect; void main(){ vec2 p=vec2(vUv.x*uAspect,vUv.y)*.62+uOff; float a=texture2D(tT,p).r; float e=smoothstep(.0,.2,vUv.x)*smoothstep(1.,.8,vUv.x); gl_FragColor=vec4(vec3(.9,.95,1.)*a*uA*.17*(.55+.45*e),1.); }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
  mesh.frustumCulled = false; mesh.renderOrder = -5;
  return { mesh, uniforms: U };
}

export function createWireField({ G, spread = 130, height = 62, triangles = 210 }) {
  const rand = rng(77); const pts = [];
  for (let i = 0; i < triangles; i++) {
    const ang = rand() * 6.283, d = 12 + Math.pow(rand(), .7) * spread;
    const cx = Math.cos(ang) * d, cz = Math.sin(ang) * d, cy = rand() * height - 8;
    const s = 3 + rand() * 11;
    const v = () => [cx + (rand() - .5) * s, cy + (rand() - .5) * s, cz + (rand() - .5) * s];
    const a = v(), b = v(), c = v();
    pts.push(...a, ...b, ...b, ...c); if (rand() < .55) pts.push(...c, ...a);
  }
  // loose dome outline
  const R = 10.6, n = 7;
  for (let i = 0; i < n; i++) {
    const e = i / n * Math.PI * .5, r = Math.cos(e) * R, y = 1.2 + Math.sin(e) * R;
    const segs = Math.max(5, Math.round(26 * Math.cos(e)));
    for (let j = 0; j < segs; j++) {
      const a = j / segs * 6.283, b = (j + 1) / segs * 6.283;
      pts.push(Math.sin(a) * r, y, Math.cos(a) * r, Math.sin(b) * r, y, Math.cos(b) * r);
      if (i < n - 1) {
        const e2 = (i + 1) / n * Math.PI * .5, r2 = Math.cos(e2) * R, y2 = 1.2 + Math.sin(e2) * R;
        pts.push(Math.sin(a + (i % 2) * .12) * r, y, Math.cos(a + (i % 2) * .12) * r, Math.sin(a + (i % 2) * .12) * r2, y2, Math.cos(a + (i % 2) * .12) * r2);
      }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const m = new THREE.LineBasicMaterial({ color: new THREE.Color(1.5, 1.6, 1.75), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const lines = new THREE.LineSegments(g, m); lines.frustumCulled = false; lines.visible = false;
  return { lines, material: m };
}
