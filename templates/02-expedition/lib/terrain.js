// Snowfield: procedural height on a polar grid (dense near the centre, sparse at the horizon).
import * as THREE from 'three';
import { NOISE, LIGHT, WIPE } from './glsl.js';
import { fbm2, ridged2, smooth, vn2 } from './math.js';

const gauss = (x, z, cx, cz, rx, rz) => Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));

export function heightAt(x, z) {
  const d = Math.hypot(x, z);
  const wx = x + (fbm2(x * .006 + 3, z * .006 + 7, 3) - .5) * 80, wz = z + (fbm2(x * .006 + 11, z * .006 + 2, 3) - .5) * 80;
  // rolling local ground, kept low in front of the camera
  let h = (fbm2(wx * .02 + 5.2, wz * .02 + 1.3, 4) - .5) * 15;
  h += (fbm2(wx * .06, wz * .06, 3) - .5) * 2.2 * smooth(12, 40, d);
  // named landforms, placed to frame the view from the resting camera
  h += gauss(x, z, -44, 15, 22, 15) * 8.5;                // rounded mound, front left
  h += gauss(x, z, -92, -30, 46, 26) * 13;                // shelf behind left
  h += gauss(x, z, 66, -26, 30, 30) * 9;                  // rocky bluff, right
  h += gauss(x, z, 118, 8, 50, 40) * 12;
  const ridge = (fbm2(wx * .012 + 8, wz * .012 + 2, 4) - .5) * 26 * smooth(50, 130, d);
  h += ridge;
  h += gauss(wx, wz, -105, -290, 130, 95) * 74;          // main peak
  h += gauss(wx, wz, 165, -400, 160, 95) * 78;           // second peak, right
  h += gauss(wx, wz, -430, -520, 210, 130) * 92;
  h += gauss(wx, wz, 470, -620, 260, 150) * 118;
  h += gauss(wx, wz, 30, -760, 300, 110) * 96;
  h += ridged2(wx * .0038 + 1.7, wz * .0038 + 4.2, 4) * 34 * smooth(160, 420, d) * smooth(40, -120, z);
  // falling away towards the camera
  const camSide = smooth(6, 54, z) * smooth(110, 30, Math.abs(x));
  h = h * (1 - camSide * .8) - camSide * 9;
  // flat pad; the ground rolls away from it on every side
  const pad = smooth(12.5, 30, d);
  h = h * pad + (1 - pad) * -.35 - smooth(14, 40, d) * smooth(70, 30, d) * smooth(-14, 18, z) * 2.2;
  return h;
}

export function createTerrain({ G, radial = 340, spokes = 620, maxR = 2200 } = {}) {
  const n = (radial + 1) * spokes + 1;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  const idx = [];
  const rad = (i) => (i / radial) ** 2.55 * maxR;
  P[0] = 0; P[1] = heightAt(0, 0); P[2] = 0; N[1] = 1;
  const h = (x, z) => heightAt(x, z);
  let v = 1;
  for (let i = 1; i <= radial + 1; i++) {
    const r = rad(i - .001 + 0);
    const e = Math.max(.12, r * .006);
    for (let j = 0; j < spokes; j++) {
      const a = j / spokes * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = h(x, z);
      P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
      const nx = h(x - e, z) - h(x + e, z), nz = h(x, z - e) - h(x, z + e), ny = 2 * e, l = Math.hypot(nx, ny, nz);
      N[v * 3] = nx / l; N[v * 3 + 1] = ny / l; N[v * 3 + 2] = nz / l;
      v++;
    }
  }
  const at = (i, j) => 1 + (i * spokes) + ((j + spokes) % spokes);
  for (let j = 0; j < spokes; j++) idx.push(0, at(0, j + 1), at(0, j));
  for (let i = 0; i < radial; i++) for (let j = 0; j < spokes; j++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    idx.push(a, d, b, d, c, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));

  const uniforms = {
    uTime: G.uTime, uRes: G.uRes, uCut: G.uCut, uFog: G.uFog, uFogLight: G.uFogLight,
    uReveal: { value: 1e5 }, uDoorGlow: { value: 0 }, uDoorPos: { value: new THREE.Vector3(14, 0, 16) }, uBaseY: { value: 0 }, uFade: { value: 0 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec3 vN; varying vec3 vP;
      void main(){ vP=position; vN=normal; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      varying vec3 vW; varying vec3 vN; varying vec3 vP;
      uniform vec3 uFog,uFogLight,uDoorPos; uniform float uReveal,uDoorGlow,uFade;
      ${NOISE}${LIGHT}${WIPE}
      float tH(vec2 p){ return fbm2(p*.42)*1.2 + vn2(p*2.1)*.18 + vn2(p*6.3)*.075 + vn2(p*17.)*.03; }
      void main(){
        wipeDiscard();
        float d0=length(vP.xz);
        float rn=uReveal*(1.+(fbm2(vP.xz*.09)-.5)*.75);
        if(d0>rn) discard;
        vec3 V=normalize(cameraPosition-vW);
        float dist=length(cameraPosition-vW);
        vec3 N=normalize(vN);
        // close relief fades out with distance
        float near=smoothstep(420.,40.,dist);
        const float e=.05;
        vec2 p=vP.xz;
        float h0=tH(p);
        vec2 g=vec2(tH(p+vec2(e,0.))-h0,tH(p+vec2(0.,e))-h0)/e;
        N=normalize(N-vec3(g.x,0.,g.y)*.46*near);
        float frost=fbm2(p*.11+3.);
        float slope=1.-N.y;
        vec3 alb=mix(vec3(.038,.043,.056),vec3(.135,.145,.175),smoothstep(.3,.72,frost+h0*.14-slope*.42));
        alb=mix(alb,vec3(.3,.32,.37),smoothstep(.66,.92,vn2(p*1.4)*.42+h0*.46-slope*.3)*.8);
        vec3 c=overcast(alb,N,V,.8,.05);
        // far mountains read as soft, bright silhouettes
        float fogK=1.-exp(-pow(dist*.00235,1.5));
        fogK=mix(fogK,1.,uFade);
        c=mix(c,uFog*1.02,clamp(fogK,0.,1.));
        // low drifting cloud between ridges
        float cl=fbm2(vW.xz*.006+vec2(uTime*.012,0.))*smoothstep(90.,260.,dist)*smoothstep(26.,-4.,vP.y);
        c=mix(c,uFogLight,cl*.42);
        // plume streaks fanning from the doorway
        vec2 dp=vP.xz-uDoorPos.xz;
        float dl=length(dp);
        float ang=atan(dp.y,dp.x);
        float streak=(pow(vn2(vec2(ang*42.,dl*.1-uTime*.25)),1.6)*.9+.05)*exp(-dl*.21)*smoothstep(.0,2.5,dl);
        c+=vec3(.92,.96,1.)*streak*uDoorGlow*.95;
        // reveal front burns white
        float edge=smoothstep(uReveal*.2+2.5,0.,rn-d0)*step(uReveal,3000.);
        c=mix(c,vec3(2.6,2.75,3.),edge);
        gl_FragColor=vec4(c,1.);
      }`,
  });
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
