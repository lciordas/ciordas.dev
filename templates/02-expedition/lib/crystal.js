// Faceted crystal: refractive shell, rough core chunk, and an object embedded inside.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { NOISE, LIGHT, WIPE, STONE } from './glsl.js';
import { rng, fbm3 } from './math.js';

export const LAYER_BACK = 1;

function polytope(rand, nPlanes, sx, sy, sz) {
  const planes = [];
  for (let i = 0; i < nPlanes; i++) {
    const u = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    planes.push([s * Math.cos(a), u, s * Math.sin(a), .72 + rand() * .3]);
  }
  return (x, y, z) => {
    const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
    let r = 1.08;
    for (const p of planes) { const d = x * p[0] + y * p[1] + z * p[2]; if (d > .01) r = Math.min(r, p[3] / d); }
    return [x * r * sx, y * r * sy, z * r * sz, r];
  };
}

function rockGeometry(rand, surf, detail, rockDir, seed) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const s = surf(x, y, z);
    const f = fbm3(x * 2.3 + seed, y * 2.3, z * 2.3 - seed, 5);
    const k = .9 + (f - .5) * .62;
    p.setXYZ(i, s[0] * k, s[1] * k, s[2] * k);
  }
  g.computeVertexNormals();
  return g;
}

function plaqueTexture(mark) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = '#fff'; x.lineWidth = 34; x.lineJoin = 'round';
  x.beginPath();
  [[-.62, -.86], [.28, -.86], [.74, -.3], [.74, .86], [-.28, .86], [-.74, .3]].forEach(([a, b], i) => { const X = 256 + a * 210, Y = 256 + b * 210; if (i) x.lineTo(X, Y); else x.moveTo(X, Y); });
  x.closePath(); x.stroke();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '900 188px "Archivo Black", Arial, sans-serif';
  x.fillText(mark, 256, 268);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}

export function createCrystal({ G, tBack, seed = 1, kind = 'stones', mark = 'P1', size = 6.5 }) {
  const rand = rng(seed * 991 + 7);
  const surf = polytope(rand, 15, size * 1.02, size * 1.3, size * .92);

  // Clean flat facets: convex hull of scattered points on the shard surface
  const hullPts = [];
  for (let i = 0; i < 46; i++) {
    const u = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const q = surf(s * Math.cos(a), u, s * Math.sin(a));
    hullPts.push(new THREE.Vector3(q[0], q[1], q[2]));
  }
  const shellGeo = new ConvexGeometry(hullPts);
  const U = {
    uTime: G.uTime, uRes: G.uRes, uCut: G.uCut, tBack: { value: tBack }, uDim: { value: 0 }, uFocus: { value: 0 },
  };
  const shell = new THREE.Mesh(shellGeo, new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vW; varying vec3 vO; void main(){ vO=position; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      varying vec3 vW,vO; uniform sampler2D tBack;
      ${NOISE}${WIPE}
      void main(){
        vec3 V=normalize(cameraPosition-vW);
        vec3 N=normalize(cross(dFdx(vW),dFdy(vW))); if(dot(N,V)<0.) N=-N;
        float nv=max(dot(N,V),0.);
        vec3 Nv=(viewMatrix*vec4(N,0.)).xyz;
        vec2 suv=gl_FragCoord.xy/uRes;
        vec2 off=Nv.xy*.024;
        vec3 col=vec3(texture2D(tBack,suv-off).r,texture2D(tBack,suv-off*1.03).g,texture2D(tBack,suv-off*1.07).b);
        float rnd=hash13(floor(N*38.)+3.);
        col*=mix(vec3(.62,.67,.76),vec3(1.0,1.04,1.12),rnd);
        vec3 R=reflect(-V,N);
        vec3 env=mix(vec3(.07,.085,.115),vec3(.3,.335,.4),smoothstep(-.3,.8,R.y+(fbm3(R*3.)-.5)*.5));
        float fres=pow(1.-nv,2.6);
        col=mix(col,env,clamp(fres*.86+.06,0.,1.));
        float frost=smoothstep(.46,.72,fbm3(vO*1.15+N*1.5));
        col=mix(col*1.12,env*1.25+vec3(.05),frost*.34);
        col+=vec3(.5,.55,.62)*smoothstep(.56,.6,vn3(vO*vec3(.5,5.,.5)+N*3.))*frost*.12;
        vec3 H=normalize(normalize(vec3(-.45,.8,.5))+V);
        col+=vec3(1.)*pow(max(dot(N,H),0.),420.)*1.2;
        float fw=length(fwidth(N));
        col+=vec3(.8,.88,1.)*smoothstep(.05,.5,fw)*.2;
        gl_FragColor=vec4(col,1.);
      }`,
  }));

  // Facets seen from inside, only in the refraction buffer.
  const inner = new THREE.Mesh(shellGeo, new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: false, uniforms: { uTime: G.uTime },
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      varying vec3 vW; ${NOISE}
      void main(){ vec3 N=normalize(cross(dFdx(vW),dFdy(vW)));
        float r=hash13(floor(N*38.)+9.);
        float l=clamp(N.y*.5+.5,0.,1.);
        vec3 c=mix(vec3(.06,.07,.095),vec3(.3,.34,.41),l*.8+r*.25);
        gl_FragColor=vec4(c,1.); }`,
  }));
  inner.layers.set(LAYER_BACK);

  // Rock chunk
  const rockDir = new THREE.Vector3(rand() - .5, rand() * .6 - .9, rand() - .5).normalize();
  const rockU = { uTime: G.uTime, uRes: G.uRes, uCut: G.uCut, uRockDir: { value: rockDir } };
  const rockGeo = rockGeometry(rand, surf, 44, rockDir, seed * 3.1);
  const rock = new THREE.Mesh(rockGeo, new THREE.ShaderMaterial({
    uniforms: rockU,
    vertexShader: `varying vec3 vW,vN,vO; void main(){ vO=position; vN=mat3(modelMatrix)*normal; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      varying vec3 vW,vN,vO; uniform vec3 uRockDir;
      ${NOISE}${LIGHT}${WIPE}${STONE}
      void main(){
        vec3 od=normalize(vO);
        float mask=dot(od,uRockDir)+(fbm3(vO*.5)-.5)*1.1+(vn3(vO*2.6)-.5)*.16;
        if(mask<-.02) discard;
        vec3 V=normalize(cameraPosition-vW);
        vec3 N=normalize(vN);
        vec3 Ns=stoneNormal(N,vO*1.25,.62);
        float h=fbm3(vO*1.5);
        vec3 alb=mix(vec3(.035,.045,.065),vec3(.22,.25,.31),smoothstep(.3,.7,h));
        vec3 c=overcast(alb,Ns,V,.28,.8);
        c+=vec3(1.,1.04,1.1)*smoothstep(.62,.72,vn3(vO*4.8)+h*.25)*max(Ns.y*.5+.5,0.)*.24;
        gl_FragColor=vec4(c,1.);
      }`,
  }));
  rock.layers.enable(LAYER_BACK);

  const group = new THREE.Group();
  group.add(shell, inner, rock);

  // Embedded object
  let embed;
  if (kind === 'mark') {
    const pw = size * .66, ph = size * .86;
    const g = new THREE.BoxGeometry(pw * 1.05, ph * 1.05, size * .24, 1, 1, 1);
    const tex = plaqueTexture(mark);
    embed = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { tMark: { value: tex }, uTime: G.uTime },
      vertexShader: `varying vec2 vUv; varying vec3 vN,vW,vO; varying float vFace; void main(){ vUv=uv; vO=position; vFace=abs(normal.z); vN=mat3(modelMatrix)*normal; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */`
        varying vec2 vUv; varying vec3 vN,vW,vO; varying float vFace; uniform sampler2D tMark;
        ${NOISE}${LIGHT}
        void main(){
          vec3 V=normalize(cameraPosition-vW); vec3 N=normalize(vN);
          float m=texture2D(tMark,vUv).r*step(.9,vFace);
          float e=.004;
          vec2 g=vec2(texture2D(tMark,vUv+vec2(e,0)).r-texture2D(tMark,vUv-vec2(e,0)).r,texture2D(tMark,vUv+vec2(0,e)).r-texture2D(tMark,vUv-vec2(0,e)).r)*step(.9,vFace);
          N=normalize(N+vec3(-g.x,-g.y,0.)*1.6);
          float n=fbm3(vO*1.2);
          vec3 a=mix(vec3(.09,.1,.13),vec3(.24,.27,.33),n);
          a=mix(a,vec3(.62,.68,.78),m);
          gl_FragColor=vec4(overcast(a,N,V,.5,.4),1.);
        }`,
    }));
    embed.rotation.y = .3; embed.rotation.x = -.05;
  } else {
    // Rounded pile of stones
    const g = new THREE.SphereGeometry(1, 96, 64);
    g.deleteAttribute('uv');
    const P = g.attributes.position;
    const stack = [[-1.7, 2.1], [.05, 1.62], [1.45, 1.18], [2.45, .78]];
    for (let i = 0; i < P.count; i++) {
      const dx = P.getX(i), dy = P.getY(i), dz = P.getZ(i);
      const yy = dy * 3.3;
      let w = 0;
      for (const [cy, r] of stack) { const t = (yy - cy) / r; if (Math.abs(t) < 1) w = Math.max(w, Math.sqrt(1 - t * t) * r); }
      w = Math.max(w, .001);
      const rr = Math.hypot(dx, dz) || 1;
      const f = fbm3(dx * 2.2 + seed, dy * 2.2, dz * 2.2, 4);
      P.setXYZ(i, dx / rr * w * (.84 + f * .3) * (rr > .001 ? 1 : 0), yy, dz / rr * w * (.84 + f * .3));
    }
    g.computeVertexNormals();
    embed = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { uTime: G.uTime },
      vertexShader: `varying vec3 vN,vW,vO; void main(){ vO=position; vN=mat3(modelMatrix)*normal; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */`
        varying vec3 vN,vW,vO; ${NOISE}${LIGHT}${STONE}
        void main(){ vec3 V=normalize(cameraPosition-vW); vec3 N=stoneNormal(normalize(vN),vO*2.,.24);
          float n=fbm3(vO*1.4); vec3 a=mix(vec3(.06,.07,.09),vec3(.2,.22,.27),n);
          gl_FragColor=vec4(overcast(a,N,V,.7,.1),1.); }`,
    }));
    embed.scale.setScalar(size * .19);
  }
  embed.layers.set(LAYER_BACK);
  const pivot = new THREE.Group(); pivot.add(embed); group.add(pivot);

  // Wire cage used by the callouts
  const pts = [];
  const pick = () => { const u = rand() * 2 - 1, a = rand() * 6.283, s = Math.sqrt(1 - u * u); return surf(s * Math.cos(a), u, s * Math.sin(a)).slice(0, 3).map((v) => v * 1.18); };
  for (let i = 0; i < 14; i++) { const a = pick(), b = pick(), c = pick(); pts.push(...a, ...b, ...b, ...c, ...c, ...a); }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const wire = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  group.add(wire);

  // Local anchor points for the callouts
  const anchors = {
    title: new THREE.Vector3(...surf(-.55, .75, .4).slice(0, 3)),
    meta: new THREE.Vector3(...surf(.8, .42, .4).slice(0, 3)),
    date: new THREE.Vector3(...surf(.55, -.72, .4).slice(0, 3)),
  };
  return { group, wire, anchors, size, shell, setFocus(v) { wire.material.opacity = v * .13; } };
}
