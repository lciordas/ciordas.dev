// stone: a translucent veined monolith that is secretly made of fracture cells.
// It can crack along those cells, open a slab under the pointer, glow, burst into
// a ring of hollow shards, and reassemble. Also draws debug render modes.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, vnoise3, GLSL_NOISE, ensureStage, damp, clamp, smooth, lerp, paletteUniforms, REDUCED } from './_util.js';

export const STONE_H = 5.75, STONE_W = 1.62, STONE_D = 0.98;
const CELLS = 26;
// Plate motion under the pointer, in stone units and radians.
const PLATE_REACH = 2.2, PLATE_GAP = 0.2, PLATE_LIFT = 0.08, PLATE_TIP = 0.15;

const wobble = (x, y, z) => [
  x + 0.05 * Math.sin(y * 9 + z * 5),
  y + 0.05 * Math.sin(z * 8 + x * 6),
  z + 0.05 * Math.sin(x * 10 + y * 4),
];
const GLSL_WOBBLE = /* glsl */`vec3 wob(vec3 p){ return vec3(p.x+.05*sin(p.y*9.+p.z*5.),p.y+.05*sin(p.z*8.+p.x*6.),p.z+.05*sin(p.x*10.+p.y*4.)); }`;

// Unit-sphere point to an even "material space": cells and bands look uniform on screen here.
export const Q_Y = 1.75;
export function qOf(ux, uy, uz) {
  const yn = Math.sign(uy) * Math.pow(Math.abs(uy), 0.6);
  const r = Math.sqrt(Math.max(1e-5, 1 - uy * uy));
  const rr = Math.pow(r, 0.12);
  return [(ux / r) * rr, yn * Q_Y, (uz / r) * rr];
}

// Unit-sphere point to stone surface.
const PROFILE = [[-1, 0.36], [-0.97, 0.46], [-0.85, 0.62], [-0.6, 0.84], [-0.35, 0.95], [0.03, 1.0], [0.4, 0.97], [0.654, 0.83], [0.905, 0.6], [0.975, 0.48], [1, 0.34]];
const profile = (y) => {
  for (let i = 1; i < PROFILE.length; i++) {
    if (y <= PROFILE[i][0]) { const [a, wa] = PROFILE[i - 1], [b, wb] = PROFILE[i]; return wa + (wb - wa) * ((y - a) / (b - a)); }
  }
  return PROFILE[PROFILE.length - 1][1];
};
export function stoneSurface(ux, uy, uz, s = 3.1) {
  const yn = Math.sign(uy) * Math.pow(Math.abs(uy), 0.6);
  const r = Math.sqrt(Math.max(1e-5, 1 - uy * uy));
  const rr = Math.pow(r, 0.12);
  const dx = ux / r, dz = uz / r;
  const w = profile(yn);
  // Broad planes and a little lumpiness, so it reads as a cut block.
  const a = Math.atan2(dz, dx);
  const facet = Math.abs(Math.sin(a * 2.5 + uy * 1.6 + 0.8)) * 0.035;
  const n1 = vnoise3(ux * 1.7 + s, uy * 2.1 + s, uz * 1.7) - 0.5;
  const n2 = vnoise3(ux * 3.6 + 9, uy * 3.6 + s, uz * 3.6 + 2) - 0.5;
  const k = 1 + n1 * 0.09 + n2 * 0.045 + facet * 0.7;
  const lean = smooth(0.1, 1, yn) * -0.1 + smooth(-0.3, -1, yn) * 0.06;
  const x = dx * rr * STONE_W * w * k + lean;
  const z = dz * rr * STONE_D * w * k;
  const y = (yn * 0.5 + 0.5) * STONE_H + smooth(0.72, 0.97, yn) * x * 0.11 - 0.04;
  return [x, y, z];
}

function buildStone(seed) {
  const R = rng(seed);
  // Fracture seeds, spread evenly over the visible height.
  const unitSeeds = [], seeds = [];
  for (let i = 0; i < CELLS; i++) {
    const t = (i + 0.5) / CELLS;
    const yn = 1 - 2 * t;
    const uy = Math.sign(yn) * Math.pow(Math.abs(yn), 1 / 0.6);
    const r = Math.sqrt(1 - uy * uy), a = i * 2.39996 + R() * 0.5;
    const u = new THREE.Vector3(Math.cos(a) * r, uy, Math.sin(a) * r).add(new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(0.1)).normalize();
    unitSeeds.push(u);
    seeds.push(new THREE.Vector3(...qOf(u.x, u.y, u.z)));
  }
  // Surface mesh with shared vertices.
  let ico = new THREE.IcosahedronGeometry(1, 36);
  ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
  ico = mergeVertices(ico, 1e-4);
  const unit = ico.attributes.position.array.slice();
  const pos = ico.attributes.position.array;
  const qs = new Float32Array(unit.length);
  for (let i = 0; i < pos.length; i += 3) {
    const q = qOf(unit[i], unit[i + 1], unit[i + 2]);
    qs[i] = q[0]; qs[i + 1] = q[1]; qs[i + 2] = q[2];
    const p = stoneSurface(unit[i], unit[i + 1], unit[i + 2]);
    pos[i] = p[0]; pos[i + 1] = p[1]; pos[i + 2] = p[2];
  }
  ico.computeVertexNormals();
  const nor = ico.attributes.normal.array, idx = ico.index.array;

  // Each triangle joins every cell that one of its corners or its centre falls in.
  // Border triangles therefore belong to both sides, and the shader trims them along the true line.
  const cellTris = seeds.map(() => []);
  const nearest = (x, y, z) => {
    const w = wobble(x, y, z);
    let best = 0, bd = 1e9;
    for (let s = 0; s < CELLS; s++) {
      const d = (w[0] - seeds[s].x) ** 2 + (w[1] - seeds[s].y) ** 2 + (w[2] - seeds[s].z) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  };
  const vertexCell = new Int16Array(qs.length / 3);
  for (let v = 0; v < vertexCell.length; v++) vertexCell[v] = nearest(qs[v * 3], qs[v * 3 + 1], qs[v * 3 + 2]);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const owners = new Set([
      vertexCell[idx[t]], vertexCell[idx[t + 1]], vertexCell[idx[t + 2]],
      nearest((qs[a] + qs[b] + qs[c]) / 3, (qs[a + 1] + qs[b + 1] + qs[c + 1]) / 3, (qs[a + 2] + qs[b + 2] + qs[c + 2]) / 3),
    ]);
    owners.forEach((o) => cellTris[o].push(idx[t], idx[t + 1], idx[t + 2]));
  }

  // Each cell becomes a thin hollow shell: outer skin, inner skin, walls.
  const T = 0.06;
  const shards = cellTris.map((tris, cellIndex) => {
    const center = new THREE.Vector3();
    const used = new Set(tris);
    used.forEach((v) => center.add(new THREE.Vector3(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])));
    center.divideScalar(Math.max(1, used.size));
    const P = [], N = [], U = [], Q = [], F = [], Ci = [];
    const push = (v, inner, face, nx, ny, nz) => {
      const i = v * 3;
      const k = inner ? T : 0;
      P.push(pos[i] - nor[i] * k - center.x, pos[i + 1] - nor[i + 1] * k - center.y, pos[i + 2] - nor[i + 2] * k - center.z);
      if (nx === undefined) N.push(nor[i] * (inner ? -1 : 1), nor[i + 1] * (inner ? -1 : 1), nor[i + 2] * (inner ? -1 : 1));
      else N.push(nx, ny, nz);
      U.push(unit[i], unit[i + 1], unit[i + 2]);
      Q.push(qs[i], qs[i + 1], qs[i + 2]);
      F.push(face); Ci.push(cellIndex);
    };
    for (let t = 0; t < tris.length; t += 3) {
      const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
      push(a, false, 1); push(b, false, 1); push(c, false, 1);
      push(c, true, 0); push(b, true, 0); push(a, true, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('aUnit', new THREE.Float32BufferAttribute(U, 3));
    g.setAttribute('aQ', new THREE.Float32BufferAttribute(Q, 3));
    g.setAttribute('aFace', new THREE.Float32BufferAttribute(F, 1));
    g.setAttribute('aCell', new THREE.Float32BufferAttribute(Ci, 1));
    return { geometry: g, center };
  });

  // A coarser, jittered net for the wireframe pass.
  const low = new THREE.IcosahedronGeometry(1, 9);
  low.deleteAttribute('normal'); low.deleteAttribute('uv');
  const lowM = mergeVertices(low, 1e-4);
  const lp = lowM.attributes.position.array;
  for (let i = 0; i < lp.length; i += 3) {
    const v = new THREE.Vector3(lp[i] + (R() - 0.5) * 0.09, lp[i + 1] + (R() - 0.5) * 0.09, lp[i + 2] + (R() - 0.5) * 0.09).normalize();
    const p = stoneSurface(v.x, v.y, v.z);
    lp[i] = p[0]; lp[i + 1] = p[1]; lp[i + 2] = p[2];
  }
  const wire = new THREE.WireframeGeometry(lowM);
  return { seeds, unitSeeds, shards, wire };
}

const VERT = /* glsl */`
attribute vec3 aUnit, aQ; attribute float aFace, aCell;
varying vec3 vUnit, vQ, vN, vV, vMv, vCreaseN; varying float vFace, vCell;
uniform float uMatte;
void main(){
  vUnit=aUnit; vQ=aQ; vFace=aFace; vCell=aCell;
  vN=normalize(normalMatrix*normal);
  vec3 p=position;
  // Broken pieces crumple along a few sharp creases.
  vec3 A=vec3(1.9,1.2,1.6),B=vec3(-1.3,2.2,.9);
  float sa=sin(dot(aQ,A)+aCell*1.7), sb=sin(dot(aQ,B)+aCell*2.9);
  float cr=abs(sa)+.5*abs(sb);
  p+=normal*(cr-.7)*.22*uMatte;
  vec3 grad=sign(sa)*cos(dot(aQ,A)+aCell*1.7)*A+.5*sign(sb)*cos(dot(aQ,B)+aCell*2.9)*B;
  vCreaseN=normalize(normalMatrix*normalize(normal-grad*.34*sign(aFace-.25)));
  vec4 mv=modelViewMatrix*vec4(p,1.);
  vV=normalize(-mv.xyz); vMv=mv.xyz;
  gl_Position=projectionMatrix*mv;
}`;

const FRAG = /* glsl */`
precision highp float;
#define CELLS ${CELLS}
varying vec3 vUnit, vQ, vN, vV, vMv, vCreaseN; varying float vFace, vCell;
uniform int uMode;
uniform vec3 uSeeds[CELLS];
uniform float uSeedShift, uTime, uMatte;
uniform float uBurstR, uBurstAmt, uCrackAll, uCrackGlow, uActiveAmt, uHotAmt, uHotSize, uFade, uPlateAmt, uPlateR;
uniform vec3 uBurstO, uHot;
uniform int uActive;
uniform vec3 p_pale, p_stone, p_deep, p_shard, p_low;
${GLSL_NOISE}
${GLSL_WOBBLE}
vec3 beauty(vec3 N, vec3 V){
  vec3 q=vec3(vQ.x,vQ.y/1.75,vQ.z);
  vec3 p=q+vec3(0.,uSeedShift,uSeedShift*.3);
  // Sediment: broad horizontal layers with cloudy, torn edges.
  float tear=fbm(vec3(p.x*1.25,p.y*1.5,p.z*1.25)+3.1);
  float h=q.y*2.3+uSeedShift*1.7+(tear-.5)*.8;
  float layer=fbm(vec3(h*1.2,uSeedShift*.3,2.7));
  float blot=fbm(vec3(p.x*1.7,h*2.7,p.z*1.7)+9.);
  float blot2=fbm(vec3(p.x*3.6,h*6.5,p.z*3.6)+tear*1.5);
  float m=layer*.66+blot*.27+blot2*.07;
  m=(m-.5)*1.5+.5;
  vec3 pale=mix(p_pale,p_stone,.2);
  vec3 c=mix(pale,p_stone,smoothstep(.28,.5,m));
  c=mix(c,p_deep,smoothstep(.48,.72,m)*.94);
  // Veins: faint and cloud-like, strongest in the mid tones.
  float w=tear*2.4;
  float v1=fbm(p*vec3(3.1,5.4,3.1)+w);
  float v2=fbm(p*vec3(6.6,10.4,6.6)-w+7.);
  float veins=pow(1.-abs(2.*v1-1.),16.)+.75*pow(1.-abs(2.*v2-1.),18.);
  c=mix(c,mix(p_pale,p_stone,.3),clamp(veins,0.,1.)*.22);
  // A tiny speckle of mineral grain in the darker parts.
  float g=vnoise(q*120.);
  c+=(g-.5)*.06*smoothstep(.42,.6,m)*p_pale;
  float nv=clamp(dot(N,V),0.,1.);
  float rim=pow(1.-nv,3.2);
  c=mix(c,mix(p_pale,p_stone,.16),rim*.62);
  return c;
}
void main(){
  vec3 N=normalize(vN), V=normalize(vV);
  vec3 c; float alpha=1.;
  if(uMode==1){ // checker
    float a=atan(vUnit.x,vUnit.z)/3.14159;
    vec2 uv=vec2(a*6.,vUnit.y*3.4);
    float ch=mod(floor(uv.x)+floor(uv.y),2.);
    c=mix(vec3(.17,.16,.16),vec3(.95,.91,.84),ch)*(.72+.28*clamp(dot(N,V),0.,1.));
  } else if(uMode==2){ // normals
    c=mix(N*.5+.5,vec3(1.),.28); c.b=max(c.b,.86); c.g=mix(c.g,.68,.6);
  } else if(uMode==3){ // clay
    float l=clamp(dot(N,normalize(vec3(.1,.5,.85))),0.,1.);
    c=vec3(.42,.39,.37)*(.25+.85*l)*(.9+.2*vnoise(vUnit*6.));
  } else if(uMode==4){ // transmission
    float n=fbm(vQ*1.5+vec3(0.,uTime*.05,0.));
    c=mix(vec3(.37,.72,.82),vec3(.64,.27,.78),smoothstep(.34,.62,n));
  } else {
    // Distance to the nearest fracture line, needed for shard edges and cracks.
    float e=1.; int i1=-1,i2=-1;
    if(uMatte>.001||uBurstAmt>.002||uCrackAll>.002||uActiveAmt>.002||uPlateAmt>.002){
      vec3 q=wob(vQ);
      float d1=9.,d2=9.;
      for(int i=0;i<CELLS;i++){ float d=distance(q,uSeeds[i]); if(d<d1){d2=d1;i2=i1;d1=d;i1=i;} else if(d<d2){d2=d;i2=i;} }
      e=d2-d1;
      // Separated plates end exactly on the fracture line, with a hair of overlap to hide the seam.
      if((uMatte>.001||uPlateAmt>.002)&&i1!=int(vCell+.5)&&distance(q,uSeeds[int(vCell+.5)])>d1+.005) discard;
    }
    // Broken pieces get a clean edge cut along that line.
    if(uMatte>.001){
      float clip=.07*uMatte;
      alpha=smoothstep(clip-.006,clip+.006,e+(vnoise(vQ*5.)-.5)*.05*uMatte);
      if(alpha<.02) discard;
    }
    vec3 FN=normalize(vCreaseN);
    if(vFace>.75){
      c=beauty(N,V);
      if(uMatte>.001){
        float l=clamp(dot(FN,normalize(vec3(.25,.6,.75))),0.,1.);
        vec3 m=p_shard*(.3+.86*pow(l,1.15));
        c=mix(c,m,uMatte);
      }
    } else {
      // Inside of the shell: folds from near black up to the shard colour.
      float l=clamp(dot(FN,normalize(vec3(-.3,.55,.8))),0.,1.);
      vec3 inner=mix(p_low*.05,p_shard*.9,smoothstep(.42,.98,l));
      c=mix(mix(p_deep*.5,p_stone*.56,l),inner,clamp(uMatte*1.2,0.,1.));
    }
    // Cracks along the fracture cells.
    if(vFace>.75 && (uBurstAmt>.002||uCrackAll>.002||uActiveAmt>.002)){
      float jag=vnoise(vQ*30.)*.016;
      float burst=smoothstep(uBurstR,uBurstR-.06,distance(vQ,uBurstO)+jag*3.)*uBurstAmt;
      float amt=max(burst,uCrackAll);
      float w=mix(.009,.034,uCrackGlow)+jag*.3;
      float line=(1.-smoothstep(w*.4,w,e))*amt;
      c=mix(c,mix(p_deep*.16,vec3(1.8,1.68,1.5),uCrackGlow),line);
      c+=uCrackGlow*uCrackAll*p_pale*exp(-e*14.)*.42;
      // The slit under the pointer: widest nearest the pointer, tapering to nothing.
      if((i1==uActive||i2==uActive)&&uActiveAmt>.002){
        float near=smoothstep(.6,.1,distance(vQ,uHot))*uActiveAmt;
        float sw=.004+.036*near+jag*.2*near;
        float slit=(1.-smoothstep(sw*.72,sw,e))*step(.02,near);
        vec3 lip=mix(p_deep*.2,p_stone*.42,smoothstep(sw*.2,sw*.75,e));
        c=mix(c,lip,slit);
      }
    }
    // Plates pulled apart by the pointer: a fine seam with a pale lip, and a lift in tone.
    if(vFace>.75&&uPlateAmt>.002){
      float pl=smoothstep(uPlateR,uPlateR*.4,distance(vQ,uHot))*uPlateAmt;
      if(pl>.003){
        float w=.004+.007*pl;
        c=mix(c,p_deep*.42,(1.-smoothstep(w*.4,w,e))*min(1.,pl*3.));
        c+=p_pale*exp(-e*48.)*pl*.2;
        c=mix(c,c*.9+p_pale*.16,pl*.42);
      }
    }
    // Heat under the pointer.
    if(uHotAmt>.002){
      float d=distance(vQ,uHot);
      float n=fbm(vQ*3.4+uTime*.15);
      float h=smoothstep(uHotSize,uHotSize*.18,d+(n-.5)*uHotSize*.55);
      c=mix(c,vec3(1.22,1.14,1.03),h*h*uHotAmt);
      c+=p_pale*exp(-d*d/(uHotSize*uHotSize*2.6))*.2*uHotAmt;
    }
  }
  gl_FragColor=vec4(c,uFade*alpha);
}`;

export function mountStone(container, options = {}) {
  const { palette = {}, seed = 7, shardSeed = 11 } = options;
  const stage = options.scene ? null : ensureStage(container, { position: [0, 2.9, 12.5], look: [0, 2.9, 0], background: options.background ?? 0x120605 });
  const parent = options.scene || stage.scene;
  const { seeds, unitSeeds, shards, wire } = buildStone(seed);

  const uniforms = {
    ...(options.paletteUniforms || paletteUniforms({ top: '#170505', mid: '#452019', haze: '#6d4b31', low: '#4a3220', pale: '#ffe2cf', stone: '#dc6e4d', deep: '#8d1d12', shard: '#d2ae8e', ...palette })),
    uSeeds: { value: seeds },
    uMode: { value: 0 }, uSeedShift: { value: 0 }, uTime: { value: 0 }, uMatte: { value: 0 }, uFade: { value: 1 },
    uBurstR: { value: 0 }, uBurstAmt: { value: 0 }, uBurstO: { value: new THREE.Vector3(0, 0, 1) },
    uCrackAll: { value: 0 }, uCrackGlow: { value: 0 },
    uActive: { value: -1 }, uActiveAmt: { value: 0 },
    uHot: { value: new THREE.Vector3(0, 0, 1) }, uHotAmt: { value: 0 }, uHotSize: { value: 0.55 },
    uPlateAmt: { value: 0 }, uPlateR: { value: 1.25 },
      };
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, alphaToCoverage: true });

  const group = new THREE.Group();
  group.name = 'stone';
  parent.add(group);
  // The spin lives on a pivot so shards can leave it for world space.
  const pivot = new THREE.Group();
  group.add(pivot);
  const R = rng(shardSeed);
  const items = shards.map((s, i) => {
    const mesh = new THREE.Mesh(s.geometry, material);
    mesh.position.copy(s.center);
    mesh.frustumCulled = false;
    mesh.layers.enable(1);
    pivot.add(mesh);
    return {
      mesh, center: s.center.clone(), s: 0,
      axis: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(),
      spinSpeed: 0.07 + R() * 0.12,
      phase: R() * 6.28,
      slot: new THREE.Vector3(), slotQ: new THREE.Quaternion(), slotScale: 1, cur: new THREE.Vector3(), curQ: new THREE.Quaternion(), curScale: 1,
      lift: 0,
      delay: 0,
      // Plate motion under the pointer.
      open: new THREE.Vector3(), tilt: 0, tiltAxis: new THREE.Vector3(1, 0, 0), openRate: 6.5 + R() * 4.5,
    };
  });
  const wireframe = new THREE.LineSegments(wire, new THREE.LineBasicMaterial({ color: 0xf6ece0, transparent: true, opacity: 0.85 }));
  wireframe.visible = false; wireframe.frustumCulled = false;
  pivot.add(wireframe);

  // Slot layout: a loose ring facing the viewer, plus a few further out past the frame.
  const ring = { center: new THREE.Vector3(0, 3.2, 0), rx: 4.25, ry: 2.8, scale: 1 };
  const VISIBLE = 15;
  const assignSlots = (scatter = 0, snap = true) => {
    const r = rng(shardSeed + Math.floor(scatter * 991));
    const order = items.map((_, i) => i).sort(() => r() - 0.5);
    const off = r() * 6.28;
    order.forEach((idx, k) => {
      const it = items[idx];
      const inner = k < VISIBLE;
      const a = off + (inner ? (k / VISIBLE) * Math.PI * 2 : ((k - VISIBLE) / (items.length - VISIBLE)) * Math.PI * 2 + 0.3) + (r() - 0.5) * 0.18;
      const rr = inner ? 1 + (r() - 0.5) * 0.2 : 1.55 + r() * 0.3;
      const x = Math.cos(a) * ring.rx * rr, y = Math.sin(a) * ring.ry * rr;
      const z = inner ? (y < -1 ? -0.5 + r() * 0.8 : 0.1 + r() * 1.0) : -1.2 + r() * 2;
      it.slot.set(x, y, z).add(ring.center);
      it.slotQ.setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28));
      it.slotScale = (inner ? 0.86 + r() * 0.3 : 1.0 + r() * 0.3) * ring.scale;
      it.delay = (STONE_H - it.center.y) / STONE_H;
      if (snap) { it.cur.copy(it.slot); it.curQ.copy(it.slotQ); it.curScale = it.slotScale; }
    });
  };
  assignSlots();

  // Small chips thrown off when the stone breaks.
  const chipN = REDUCED ? 0 : 90;
  const chipMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vN; void main(){ vN=normalMatrix*normalize(position); gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);} `,
    fragmentShader: `varying vec3 vN; uniform vec3 p_shard; void main(){ float l=clamp(dot(normalize(vN),vec3(.2,.6,.75)),0.,1.); gl_FragColor=vec4(p_shard*(.28+.8*l),1.);} `,
  });
  const chips = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), chipMat, Math.max(1, chipN));
  chips.frustumCulled = false; chips.count = chipN; chips.layers.enable(1);
  group.add(chips);
  const chipState = [];
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3a = new THREE.Vector3(), v3s = new THREE.Vector3();
  for (let i = 0; i < chipN; i++) {
    chipState.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, s: 0.02 + R() * 0.05, axis: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), a: R() * 6 });
    m4.makeScale(0, 0, 0); chips.setMatrixAt(i, m4);
  }
  const throwChips = (n = 50, speed = 2.6) => {
    let c = 0;
    for (const s of chipState) {
      if (c >= n) break;
      if (s.life > 0) continue;
      const u = new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize();
      const p = stoneSurface(u.x, u.y, u.z);
      s.p.set(p[0], p[1], p[2]);
      s.v.set(p[0] * 0.9, (p[1] - STONE_H / 2) * 0.34 + 0.25, Math.abs(p[2]) + 0.5).multiplyScalar(speed * (0.4 + R()));
      s.max = s.life = 0.9 + R() * 1.1;
      c++;
    }
  };

  // Travelling sparks on the surface.
  const sprCanvas = document.createElement('canvas'); sprCanvas.width = sprCanvas.height = 128;
  const sc = sprCanvas.getContext('2d');
  const gr = sc.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,248,235,.92)'); gr.addColorStop(0.32, 'rgba(255,214,170,.28)'); gr.addColorStop(1, 'rgba(255,190,140,0)');
  sc.fillStyle = gr; sc.fillRect(0, 0, 128, 128);
  const sprTex = new THREE.CanvasTexture(sprCanvas);
  const orbs = [0, 1, 2].map((i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true, opacity: 0, color: [0xffffff, 0xfff2c8, 0xffd8b8][i] }));
    sp.scale.setScalar(0.62); pivot.add(sp);
    return { sp, from: new THREE.Vector3().copy(unitSeeds[(i * 7) % CELLS]), to: new THREE.Vector3().copy(unitSeeds[(i * 7 + 3) % CELLS]), t: R(), speed: 0.9 + R() * 0.7 };
  });

  // State
  const st = { energy: 0, burst: 0, burstR: 0, hot: 0, hotTarget: 0, activeAmt: 0, activeTarget: 0, shatter: 0, parallaxX: 0, parallaxY: 0, hitActive: -1, plate: 0, plateTarget: 0, hitRaw: new THREE.Vector3(0, STONE_H / 2, STONE_D), hitP: new THREE.Vector3(0, STONE_H / 2, STONE_D), hitFresh: true };
  const tmpInv = new THREE.Matrix4(), rO = new THREE.Vector3(), rD = new THREE.Vector3();
  const plateDir = new THREE.Vector3(), plateN = new THREE.Vector3(), plateT = new THREE.Vector3(), plateAxis = new THREE.Vector3(), tiltQ = new THREE.Quaternion();
  const axisQ = new THREE.Quaternion(), scratchV = new THREE.Vector3(), scratchQ = new THREE.Quaternion(), worldInvQ = new THREE.Quaternion();

  const api = {
    group, pivot, uniforms, items, seeds, wireframe, ring,
    assignSlots,
    setMode(mode) { // 'beauty' | 'wireframe' | 'uv' | 'normals' | 'clay' | 'transmission'
      const m = { beauty: 0, uv: 1, normals: 2, clay: 3, transmission: 4, wireframe: -1 }[mode] ?? 0;
      uniforms.uMode.value = Math.max(0, m);
      wireframe.visible = m === -1;
      items.forEach((it) => { it.mesh.visible = m !== -1; });
      chips.visible = m === 0;
      orbs.forEach((o) => { o.sp.visible = m === 0; });
    },
    crackBurst(u, maxR = 0.72) { // small crack spreading out from a surface point
      st.burstMax = maxR;
      if (u) uniforms.uBurstO.value.copy(u);
      else {
        const facing = Math.sign(Math.cos(pivot.rotation.y)) || 1; // which side is toward the camera
        uniforms.uBurstO.value.set(R() * 1.1 - 0.55, (R() * 1.3 - 0.65) * 1.75, facing * (0.8 + R() * 0.2));
      }
      st.burst = 1; st.burstR = 0.02;
    },
    addEnergy(v) { st.energy = Math.min(1, st.energy + v); },
    setHot(v, size) { st.hotTarget = v; if (size) uniforms.uHotSize.value = size; },
    // How far the plates around the pointer pull apart, from 0 to 1. Faster pointers open them wider.
    setPlates(v) { st.plateTarget = REDUCED ? 0 : clamp(v); },
    // Ray in world space. Returns true when it hits the stone.
    pointerRay(origin, dir) {
      pivot.updateWorldMatrix(true, false);
      tmpInv.copy(pivot.matrixWorld).invert();
      rO.copy(origin).applyMatrix4(tmpInv);
      rD.copy(dir).transformDirection(tmpInv);
      const ox = rO.x / STONE_W, oy = (rO.y - STONE_H / 2) / (STONE_H / 2), oz = rO.z / STONE_D;
      const dx = rD.x / STONE_W, dy = rD.y / (STONE_H / 2), dz = rD.z / STONE_D;
      const a = dx * dx + dy * dy + dz * dz, b = 2 * (ox * dx + oy * dy + oz * dz), c = ox * ox + oy * oy + oz * oz - 1.0;
      const D = b * b - 4 * a * c;
      if (D < 0) { st.hitActive = -1; return false; }
      const t = (-b - Math.sqrt(D)) / (2 * a);
      const e = new THREE.Vector3(ox + dx * t, oy + dy * t, oz + dz * t).normalize();
      const u = new THREE.Vector3(e.x, e.y * 1.75, e.z);
      uniforms.uHot.value.lerp(u, 0.3);
      st.hitRaw.set(e.x * STONE_W, e.y * (STONE_H / 2) + STONE_H / 2, e.z * STONE_D);
      if (st.plate < 0.01) st.hitP.copy(st.hitRaw);
      let best = 0, bd = 9;
      seeds.forEach((s, i) => { const d = s.distanceTo(u); if (d < bd) { bd = d; best = i; } });
      st.hitActive = best;
      return true;
    },
    clearPointer() { st.hitActive = -1; },
    setActiveOpen(v) { st.activeTarget = v; },
    throwChips,
    state: st,
    update(dt, time, opts = {}) {
      uniforms.uTime.value = time;
      st.energy = Math.max(0, st.energy - dt * 0.9);
      // crack spreading
      if (st.burst > 0) {
        st.burstR = Math.min(st.burstMax ?? 0.72, st.burstR + dt * 1.5);
        st.burst = Math.max(0, st.burst - dt * 0.62);
      }
      uniforms.uBurstAmt.value = smooth(0, 0.34, st.burst);
      uniforms.uBurstR.value = st.burstR;
      st.hot = damp(st.hot, st.hotTarget, 4.2, dt);
      uniforms.uHotAmt.value = st.hot;
      // the slab under the pointer
      if (st.hitActive >= 0 && st.hitActive !== uniforms.uActive.value) {
        if (st.activeAmt < 0.06) uniforms.uActive.value = st.hitActive;
        else st.activeTarget = 0;
      }
      const wantOpen = st.hitActive >= 0 && st.hitActive === uniforms.uActive.value;
      st.activeAmt = damp(st.activeAmt, wantOpen ? 1 : 0, wantOpen ? 3.6 : 5, dt);
      // The plates replace the old painted slit whenever they are in use.
      uniforms.uActiveAmt.value = st.plateTarget > 0 || st.plate > 0.01 ? 0 : st.activeAmt;
      st.plate = damp(st.plate, st.plateTarget, st.plateTarget > st.plate ? 10 : 4.5, dt);
      if (st.plate < 0.001 && !st.plateTarget) st.plate = 0;
      uniforms.uPlateAmt.value = st.plate;
      st.hitP.x = damp(st.hitP.x, st.hitRaw.x, 12, dt); st.hitP.y = damp(st.hitP.y, st.hitRaw.y, 12, dt); st.hitP.z = damp(st.hitP.z, st.hitRaw.z, 12, dt);
      // Shard placement
      const shatter = opts.shatter ?? st.shatter;
      pivot.getWorldQuaternion(worldInvQ).invert();
      pivot.updateWorldMatrix(true, false);
      tmpInv.copy(pivot.matrixWorld).invert();
      items.forEach((it, i) => {
        const raw = clamp(shatter * 1.28 - it.delay * 0.28);
        const e = 1 - Math.pow(1 - raw, 3);
        // Drift and parallax in world space.
        const t = time * it.spinSpeed + it.phase;
        // Pieces glide when they are given a new place, spinning harder on the way.
        const away = it.cur.distanceTo(it.slot);
        it.cur.x = damp(it.cur.x, it.slot.x, 2.6, dt); it.cur.y = damp(it.cur.y, it.slot.y, 2.6, dt); it.cur.z = damp(it.cur.z, it.slot.z, 2.6, dt);
        it.curQ.slerp(it.slotQ, 1 - Math.exp(-2.4 * dt));
        it.curScale = damp(it.curScale, it.slotScale, 2.6, dt);
        scratchV.copy(it.cur);
        scratchV.x += Math.sin(t * 1.3) * 0.16 + (opts.parallaxX || 0) * (0.25 + (it.slot.z + 1) * 0.1);
        scratchV.y += Math.cos(t) * 0.14 + (opts.parallaxY || 0) * (0.2 + (it.slot.z + 1) * 0.08);
        scratchV.z += away * 0.25;
        scratchV.applyMatrix4(tmpInv);
        it.mesh.position.lerpVectors(it.center, scratchV, e);
        axisQ.setFromAxisAngle(it.axis, t);
        scratchQ.copy(worldInvQ).multiply(it.curQ).multiply(axisQ);
        it.mesh.quaternion.identity().slerp(scratchQ, e);
        // Add arc so they do not all travel in straight lines.
        it.mesh.position.y += Math.sin(raw * Math.PI) * (it.center.y - STONE_H / 2) * 0.22;
        const sc = lerp(1, it.curScale, e);
        it.mesh.scale.setScalar(sc);
        // Plates near the pointer slide apart and tip, like a shell splitting open.
        const whole = 1 - clamp(shatter * 6);
        if (whole > 0 && (st.plate > 0 || it.tilt > 1e-4 || it.open.lengthSq() > 1e-7)) {
          plateDir.subVectors(it.center, st.hitP);
          const dist = plateDir.length();
          if (dist > 1e-3) plateDir.divideScalar(dist); else plateDir.set(0, 1, 0);
          plateN.set(it.center.x / (STONE_W * STONE_W), 0, it.center.z / (STONE_D * STONE_D)).normalize();
          const near = st.plate * (1 - smooth(0.35, PLATE_REACH, dist));
          plateT.copy(plateDir).multiplyScalar(PLATE_GAP * near).addScaledVector(plateN, PLATE_LIFT * near);
          const rate = (near > it.tilt ? 1 : 0.55) * it.openRate;
          it.open.x = damp(it.open.x, plateT.x, rate, dt); it.open.y = damp(it.open.y, plateT.y, rate, dt); it.open.z = damp(it.open.z, plateT.z, rate, dt);
          it.tilt = damp(it.tilt, near, rate, dt);
          plateAxis.crossVectors(plateN, plateDir);
          if (plateAxis.lengthSq() > 1e-5) it.tiltAxis.copy(plateAxis.normalize());
          it.mesh.position.addScaledVector(it.open, whole);
          tiltQ.setFromAxisAngle(it.tiltAxis, it.tilt * PLATE_TIP * whole);
          it.mesh.quaternion.multiply(tiltQ);
        }
      });
      // Chips
      chipState.forEach((s, i) => {
        if (s.life > 0) {
          s.life -= dt;
          s.v.y -= dt * 2.4; s.v.multiplyScalar(1 - dt * 0.5);
          s.p.addScaledVector(s.v, dt);
          s.a += dt * 6;
          q4.setFromAxisAngle(s.axis, s.a);
          const k = s.s * smooth(0, 0.25, s.life / s.max) * 1.6;
          m4.compose(s.p, q4, v3s.setScalar(k));
          chips.setMatrixAt(i, m4);
        } else if (s.max) { m4.makeScale(0, 0, 0); chips.setMatrixAt(i, m4); s.max = 0; }
      });
      if (chipN) chips.instanceMatrix.needsUpdate = true;
      // Sparks hop between cell seeds, visible only while the stone is disturbed.
      const orbVis = clamp(st.energy * 2.2) * (1 - clamp(shatter * 4));
      orbs.forEach((o, i) => {
        o.t += dt * o.speed * (0.25 + st.energy);
        if (o.t > 1) { o.t = 0; o.from.copy(o.to); o.to.copy(unitSeeds[Math.floor(R() * CELLS)]); }
        const u = v3a.copy(o.from).lerp(o.to, o.t * o.t * (3 - 2 * o.t)).normalize();
        const p = stoneSurface(u.x, u.y, u.z);
        o.sp.position.set(p[0] * 1.03, p[1], p[2] * 1.03);
        o.sp.material.opacity = orbVis * (0.55 + 0.45 * Math.sin(time * (3 + i) + i * 2));
      });
    },
    start(fn) { stage.start((dt, t) => { api.update(dt, t); fn && fn(dt, t, stage); }); },
    stage,
    destroy() {
      stage?.destroy();
      shards.forEach((s) => s.geometry.dispose());
      material.dispose();
    },
  };
  return api;
}
