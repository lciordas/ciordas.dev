// Concentric segmented rings. Each portal is a set of curved stone blocks around a glowing lip.
import * as THREE from 'three';
import { NOISE, LIGHT, WIPE, STONE } from './glsl.js';
import { rng } from './math.js';
import { bentBlock, mergeBlocks } from './blocks.js';

function ringBlocks(R, segs, thick, depth, gapDeg, seed, extras = 0) {
  const rand = rng(seed);
  const blocks = [];
  const a0 = rand() * 6.283;
  let total = 0; const weights = [];
  for (let i = 0; i < segs; i++) { const w = .75 + rand() * .55; weights.push(w); total += w; }
  let acc = 0;
  weights.forEach((w, i) => {
    const span = w / total * Math.PI * 2, am = a0 + acc + span / 2, gap = gapDeg * Math.PI / 180;
    acc += span;
    const rc = R + thick * .5;
    const hx = (span - gap) * .5 * rc, hy = depth * .5, hz = thick * .5;
    const map = (x, y, z) => {
      const a = am + x / rc, r = rc + z;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    };
    const b = bentBlock({ hx, hy, hz, map, nx: 36, ny: 10, nz: 8, round: Math.min(thick, depth) * .24, rough: .05, seed: seed * .17 + i });
    b.center = [Math.cos(am) * rc, 0, Math.sin(am) * rc]; b.axis = [0, 1, 0]; b.top = 0;
    blocks.push(b);
  });
  for (let i = 0; i < extras; i++) {
    const am = rand() * 6.283, rc = R + thick * .3, s = thick * .55;
    const map = (x, y, z) => { const a = am + x / rc, r = rc + z; return [Math.cos(a) * r, y + 1.2, Math.sin(a) * r]; };
    const b = bentBlock({ hx: s, hy: s, hz: s, map, nx: 8, ny: 8, nz: 8, round: s * .36, rough: .05, seed: seed * .9 + i * 3 });
    b.center = [Math.cos(am) * rc, 1.2, Math.sin(am) * rc]; b.axis = [0, 1, 0]; b.top = 0;
    blocks.push(b);
  }
  return mergeBlocks(blocks);
}

export function createPortal({ G, R = 14, segs = 6, thick = 3.4, depth = 4.6, gap = 1.4, seed = 1, extras = 0, lip = .82 } = {}) {
  const U = { uTime: G.uTime, uRes: G.uRes, uCut: G.uCut, uGlow: { value: 0 }, uR: { value: R } };
  const geo = ringBlocks(R, segs, thick, depth, gap, seed, extras);
  const stone = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */`
      attribute vec3 aLocal; attribute vec4 aMeta;
      varying vec3 vW,vN,vL,vP; varying float vEdge,vOuter;
      void main(){ vL=aLocal; vP=position; vEdge=aMeta.z; vOuter=aMeta.w; vN=mat3(modelMatrix)*normal; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      varying vec3 vW,vN,vL,vP; varying float vEdge,vOuter; uniform float uGlow,uR;
      ${NOISE}${LIGHT}${WIPE}${STONE}
      void main(){
        vec3 V=normalize(cameraPosition-vW);
        vec3 N=normalize(vN);
        N=stoneNormal(N,vL*.62,.075);
        float n=fbm3(vL*.85);
        vec3 a=mix(vec3(.075,.085,.108),vec3(.18,.2,.24),n);
        vec3 c=overcast(a,N,V,.34,.42);
        float rr=length(vP.xz)/uR;
        float inner=1.-smoothstep(1.,1.2,rr);
        c=mix(c,vec3(.8,.88,1.)*.95,inner*uGlow*.62);
        c+=vec3(.75,.86,1.)*pow(inner,3.)*uGlow*.55;
        gl_FragColor=vec4(c,1.);
      }`,
  }));
  stone.frustumCulled = false;

  // Glowing lip, crackling sparks and thin web across the opening
  const haloR = R * 1.35;
  const planeGeo = new THREE.CircleGeometry(haloR, 96);
  planeGeo.rotateX(-Math.PI / 2);
  const glowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: G.uTime, uGlow: U.uGlow, uR: U.uR, uLip: { value: lip } },
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`
      varying vec3 vP; uniform float uTime,uGlow,uR,uLip;
      ${NOISE}
      vec2 hash22(vec2 p){ float a=hash12(p),b=hash12(p+19.1); return vec2(a,b); }
      float web(vec2 p){
        vec2 i=floor(p),f=fract(p); float F1=8.,F2=8.;
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){ vec2 g=vec2(float(x),float(y)); vec2 o=hash22(i+g); o=.5+.42*sin(uTime*.25+6.28*o); float d=length(g+o-f); if(d<F1){F2=F1;F1=d;}else if(d<F2)F2=d; }
        return smoothstep(.055,.0,F2-F1);
      }
      void main(){
        vec2 p=vP.xz/uR; float r=length(p); float a=atan(p.y,p.x);
        float lipR=uLip+(vn2(vec2(a*3.,uTime*.25))-.5)*.02;
        float core=exp(-abs(r-lipR)*26.);
        float wide=exp(-abs(r-lipR)*8.);
        float spark=pow(vn2(vec2(a*22.,uTime*.22)),7.)*7.;
        float rays=spark*exp(-abs(r-lipR)*4.5)*smoothstep(1.28,1.,r);
        float haze=smoothstep(lipR+.02,.2,r)*.06*(fbm2(p*3.+uTime*.05)+.3);
        float net=web(p*23.)*smoothstep(lipR+.01,lipR-.06,r)*smoothstep(.45,.82,r)*smoothstep(.42,.6,fbm2(p*2.4+3.));
        vec3 c=vec3(.82,.91,1.)*(core*1.3+wide*.2+rays*.15+haze*.5)+vec3(.92)*net*.2;
        float fade=smoothstep(1.34,1.15,r);
        gl_FragColor=vec4(c*uGlow*fade,1.);
      }`,
  });
  const glow = new THREE.Mesh(planeGeo, glowMat);
  glow.renderOrder = 3;
  const group = new THREE.Group();
  group.add(stone, glow);
  return { group, uniforms: U, stone, glow, R };
}

export function createRingSet({ G, ys, Rs = [14, 9.4, 6.1] }) {
  const a = createPortal({ G, R: Rs[0], segs: 6, thick: Rs[0] * .34, depth: Rs[0] * .36, gap: 1.2, seed: 21, lip: .96 });
  const b = createPortal({ G, R: Rs[1], segs: 5, thick: Rs[1] * .36, depth: Rs[1] * .4, gap: 4.5, seed: 33, lip: .95 });
  const c = createPortal({ G, R: Rs[2], segs: 5, thick: Rs[2] * .42, depth: Rs[2] * .46, gap: 17, seed: 47, extras: 2, lip: .95 });
  [a, b, c].forEach((p, i) => { p.group.position.y = ys[i]; });
  const group = new THREE.Group();
  group.add(a.group, b.group, c.group);
  return { group, portals: [a, b, c] };
}
