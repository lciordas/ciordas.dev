// name: the 3D letters. They share one veined stone surface, float on small springs,
// crack from the point they are clicked, and burst into shards that settle into a slow ring.
import * as THREE from 'three';
import { GLSL_NOISE, rng, clamp, smooth } from './_util.js';
import { SPAN, VOL_DEPTH } from './bake.js';

export const DEPTH = 0.13;
const LAYERS = matchMedia('(pointer: coarse)').matches ? 6 : 12;

const VERT = /* glsl */`
attribute vec3 aQ; attribute float aFace;
varying vec3 vP, vN, vRay; varying float vFace;
void main(){
  vP=aQ; vFace=aFace; vN=normal;
  // The view ray in the letter's own space, so the inside shifts as the letter or shard turns.
  vec3 cam=(inverse(modelMatrix)*vec4(cameraPosition,1.)).xyz;
  vRay=position-cam;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;

const FRAG = /* glsl */`
precision highp float;
#define LAYERS ${LAYERS}
varying vec3 vP, vN, vRay; varying float vFace;
uniform int uMode;
uniform float uTime, uMatte, uHotAmt, uHotSize, uSweep, uFade;
uniform vec2 uHot, uRes;
uniform sampler2D tField, tMask;
uniform highp sampler3D tVol;
uniform vec3 p_pale, p_stone, p_deep, p_shard, p_low;
${GLSL_NOISE}
const float SPAN=${SPAN.toFixed(1)};
const float FLOWRATE=.32;
const float VD=${VOL_DEPTH.toFixed(2)};

// How strongly the rock and each pigment absorb red, green, and blue per unit of depth.
// Red gets through almost everything, so more rock means a deeper, more saturated colour.
const vec3 ROCK=vec3(.06,.22,.28);
const vec3 MAROON=vec3(1.,2.8,3.85);
const vec3 SAND=vec3(.7,1.,2.1);
const vec3 ORANGE=vec3(1.,3.5,4.4);
// Keeps the march from showing its layers as steps.
float dither(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715)))); }
// Slight rounding from the blurred letter shape. It only bends the view into the rock.
vec3 pillow(vec2 uv){
  const float E=.01;
  vec2 g=vec2(texture2D(tMask,uv+vec2(E,0.)).g-texture2D(tMask,uv-vec2(E,0.)).g,
              texture2D(tMask,uv+vec2(0.,E)).g-texture2D(tMask,uv-vec2(0.,E)).g);
  return normalize(vec3(-g*1.6,1.));
}
vec2 toUv(vec2 p){ return p/SPAN+.5; }
// Slow currents inside the stone. Each depth moves on its own, so the clouds churn as well as slide.
const float FLOW=.11;
vec2 current(vec2 p, float z){
  float t=uTime*FLOWRATE;
  vec2 a=vec2(sin(p.y*1.5+t*.92+z*2.4)+.55*sin(p.y*3.4-t*1.26+p.x*1.2+z*1.1),cos(p.x*1.3-t*.78+z*3.)+.55*cos(p.x*3.1+t*1.08+p.y*1.4-z*1.7));
  return a*FLOW+vec2(t*.05,t*.012)*(.5+z);
}
// A lamp hung far behind the name. Being so deep, it slides against the letters as they turn.
float lamp(vec2 p){
  vec2 a=vec2(sin(uTime*.13)*1.5,cos(uTime*.17)*.55-.1), b=vec2(cos(uTime*.09+1.)*2.1,sin(uTime*.11+2.)*.8);
  return .9+.22*exp(-dot(p-a,p-a)*.55)+.16*exp(-dot(p-b,p-b)*.9);
}
// The letter is treated as a tall prism running back through the block. A ray that slips out of a
// stroke's side crosses no more rock until it enters the next stroke, so thin strokes let more light
// through and the walls and neighbouring strokes show through as the letter turns.
vec3 volume(vec3 p, vec3 d, float len, float clear, float dens){
  float dt=len/float(LAYERS);
  vec3 tau=vec3(0.), glow=vec3(0.);
  float jit=dither(gl_FragCoord.xy);
  float sandSum=0.;
  // Fine tearing roughens the pigment clouds, which on their own are too soft at this size.
  float tear=mix(.62,1.38,smoothstep(.3,.7,texture2D(tField,toUv(p.xy+d.xy*VD*.2+current(p.xy,.2))).a));
  for(int i=0;i<LAYERS;i++){
    float t=(float(i)+jit)*dt, depth=t/VD;
    vec3 q=p+d*t;
    vec2 w=toUv(q.xy+current(q.xy,depth));
    float inside=smoothstep(.3,.7,texture2D(tMask,toUv(p.xy+d.xy*t*.55)).r);
    // Light scatters on its way out, so the deeper a cloud hangs the softer it looks.
    vec4 v=textureLod(tVol,vec3(w,q.z/VD+.5),depth*1.7);
    // Pigment keeps showing past the wall, only fainter, so the bands still run through thin parts.
    vec3 sig=(ROCK*inside+(v.r*MAROON*1.9+v.g*SAND*.72+v.b*ORANGE*.85)*mix(.45,1.,inside)*tear)*(1.-clear)*dens;
    vec3 here=exp(-tau);
    glow+=here*dt*inside*(v.r*vec3(.1,.012,.004)+v.g*vec3(.1,.055,.02)+v.b*vec3(.14,.04,.016)+v.a*vec3(1.,.82,.74)*.42);
    sandSum+=v.g*dt*inside;
    // Filaments hang at a few depths: crisp near the face, hazy further in.
    if(i==1||i==3||i==6){
      vec2 fw=toUv(p.xy+d.xy*(float(i)+.5)*dt+current(p.xy,depth)*1.15);
      glow+=here*inside*p_pale*textureLod(tField,fw,float(i)*.12).g*.27;
    }
    tau+=sig*dt;
  }
  vec3 c=p_pale*lamp(p.xy+d.xy*(len+2.2))*exp(-tau)+glow;
  // Mineral flecks suspended at two depths, so they drift against each other rather than sit on top.
  vec2 fa=(p.xy+d.xy*VD*.12)/SPAN+.5, fb=(p.xy+d.xy*VD*.4)/SPAN+.5;
  float fleck=step(.97,hash21(floor(fa*1500.)))+.6*step(.975,hash21(floor(fb*1100.)+7.));
  c+=vec3(.8,.55,.34)*fleck*smoothstep(.04,.26,sandSum)*.07;
  return c;
}
vec3 beauty(vec2 uv, vec3 d, vec3 N, float edge, float thick, float clear){
  // Bend the view as it enters the stone, then cross the whole depth of the block.
  vec3 dir=normalize(vec3((d.xy+N.xy*.12)*1.15,d.z));
  float len=VD/max(.5,-dir.z);
  vec3 start=vec3(vP.xy,VD*.5);
  vec3 c=volume(start,dir,len,clear,mix(.55,1.,thick));
  // Most of the light has been knocked about on its way through, so a share of it comes out as a
  // soft blur of the same clouds. That gives the dark bands a red bloom instead of a hard edge.
  vec2 mid=toUv(vP.xy+dir.xy*VD*.5+current(vP.xy,.5));
  vec4 s=textureLod(tVol,vec3(mid,.5),3.);
  vec3 soft=p_pale*lamp(vP.xy+dir.xy*(len+2.2))*exp(-(ROCK*.6+s.r*MAROON*1.8+s.g*SAND*.65+s.b*ORANGE*.85)*mix(.55,1.,thick)*(1.-clear));
  c=mix(c,soft,.28);
  // The thinnest rock at the outline glows, with no hard rim.
  c=mix(c,p_pale*1.04,.4*pow(1.-edge,2.));
  // Ease the brightest light down as a whole, so it stays peach and reads as light through stone rather than glare.
  float m=max(c.r,max(c.g,c.b));
  return m>.88?c*(.88+.12*(1.-exp((.88-m)/.12)))/m:c;
}
// Screen-space helpers for the printed looks.
float cell(float size){ vec2 p=mod(gl_FragCoord.xy,size)-size*.5; return length(p)/(size*.5); }
void main(){
  vec3 V=normalize(-vRay);
  vec2 uv=vP.xy/SPAN+.5;
  vec2 ray=vRay.xy/max(.25,-vRay.z);
  vec4 mk=texture2D(tMask,uv);
  float edge=clamp((mk.r-.5)*2.,0.,1.), thick=smoothstep(.5,.84,mk.g);
  vec3 NF=pillow(uv);
  vec3 N=vFace>.5?NF:normalize(vN);
  vec4 f=texture2D(tField,uv);
  vec3 c;
  if(uMode==1){ // warped checker
    vec2 u=(vP.xy+NF.xy*.26)*3.3;
    float ch=mod(floor(u.x)+floor(u.y),2.);
    c=mix(vec3(.1,.095,.09),vec3(.97,.93,.86),ch)*(.66+.34*clamp(dot(N,V),0.,1.));
  } else if(uMode==4){ // transmission: plasma clouds
    vec4 g=texture2D(tField,uv+ray*.34/SPAN+vec2(uTime*.006,0.));
    c=mix(vec3(.16,.92,.72),vec3(.34,.5,1.),smoothstep(.3,.62,g.b));
    c=mix(c,vec3(.74,.1,.82),smoothstep(.42,.74,g.r));
    c+=vec3(.5,.8,.8)*g.g*.55;
  } else if(uMode==6){ // depth: a height map in greys
    float h=pow(mk.g,1.5)*.62+edge*.38;
    c=vec3(h)*(vFace>.5?1.:.3);
    c*=.92+.08*step(.5,fract(gl_FragCoord.y*.25));
  } else if(uMode==7){ // false-colour thermal camera
    float t=clamp(1.08-f.r*1.02-(1.-edge)*.12+f.g*.28,0.,1.);
    c=mix(vec3(.03,.01,.26),vec3(.68,.02,.62),smoothstep(.06,.4,t));
    c=mix(c,vec3(1.,.36,.03),smoothstep(.36,.66,t));
    c=mix(c,vec3(1.,.95,.42),smoothstep(.64,.95,t));
  } else if(uMode==9){ // halftone print
    float lum=dot(beauty(uv,normalize(vRay),NF,edge,thick,0.),vec3(.3,.6,.1));
    float r=clamp(1.02-lum*.92,0.,1.);
    c=mix(vec3(1.,.8,.2),vec3(.05,.04,.04),smoothstep(r-.07,r+.07,1.-cell(7.*uRes.x)));
    if(vFace<.5) c=vec3(.05,.04,.04);
  } else if(uMode==10){ // distance rings
    float v=mk.r*7.+mk.g*11.;
    float ln=smoothstep(.34,.5,abs(fract(v)-.5));
    c=mix(vec3(.03,.01,.05),vec3(1.,.12,.48),ln);
    if(vFace<.5) c=vec3(.24,.02,.12);
  } else if(vFace>.5){
    // Heat under the pointer thins the pigment, letting more light through.
    float clear=0.;
    if(uHotAmt>.002){
      float d=distance(vP.xy,uHot);
      float h=smoothstep(uHotSize,uHotSize*.18,d+(f.b-.5)*uHotSize*.55);
      clear=h*h*uHotAmt;
    }
    c=beauty(uv,normalize(vRay),NF,edge,thick,clear);
    c*=1.+clear*.14;
    if(uMatte>.001) c=mix(c,c*.82+p_shard*.1,uMatte);
    // A band of light that crosses the name when it asks to be clicked.
    if(uSweep>-1.5){
      float s=exp(-pow((vP.x-uSweep*2.8+vP.y*.22)*2.1,2.));
      c*=1.+s*.1;
    }
  } else {
    // Sides and broken faces: the same lit rock at an angle. Starting all rays near one depth keeps
    // the layers from showing as stripes on a face that cuts across them.
    vec3 dir=normalize(normalize(vRay)-normalize(vN)*.4);
    c=volume(vec3(vP.xy,VD*(.3+.1*vP.z/${(DEPTH / 2).toFixed(4)})),dir,VD*.5,0.,.8);
    c=mix(c,p_stone*1.25,.25);
  }
  gl_FragColor=vec4(c,uFade);
}`;

const CRACK_VERT = `attribute vec2 aP; varying vec2 vP; void main(){ vP=aP; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
// Dark fissures with a white-hot front racing outward. uFlare lights every crack just before the burst.
const CRACK_FRAG = `precision highp float; varying vec2 vP; uniform vec2 uO; uniform float uR, uAmt, uFlare;
  void main(){ float d=distance(vP,uO); float a=smoothstep(uR,uR-.1,d)*uAmt; if(a<.004) discard;
    float hot=smoothstep(uR-.55,uR-.04,d);
    float f=max(hot,uFlare); vec3 c=mix(vec3(.07,.012,.006),vec3(1.5,.42,.1),smoothstep(0.,.45,f)); c=mix(c,vec3(2.4,2.,1.5),smoothstep(.45,1.,f));
    gl_FragColor=vec4(c,a); }`;

function shapesFrom(multi) {
  // multi: list of polygons, each a list of flat rings. The first ring is the outside.
  return multi.map((poly) => {
    const toV = (r) => { const out = []; for (let i = 0; i < r.length; i += 2) out.push(new THREE.Vector2(r[i], r[i + 1])); return out; };
    const shape = new THREE.Shape(toV(poly[0]));
    poly.slice(1).forEach((h) => shape.holes.push(new THREE.Path(toV(h))));
    return shape;
  });
}
function solid(multi, dx = 0, dy = 0, round = false) {
  // Whole letters get rounded edges, so the face melts into the sides like a worn pebble.
  const R = 0.05;
  const opts = round
    ? { depth: DEPTH - R * 2, bevelEnabled: true, bevelThickness: R, bevelSize: R, bevelOffset: -R, bevelSegments: 4, steps: 1, curveSegments: 1 }
    : { depth: DEPTH, bevelEnabled: false, steps: 1, curveSegments: 1 };
  const g = new THREE.ExtrudeGeometry(shapesFrom(multi), opts);
  g.translate(0, 0, round ? -(DEPTH - R * 2) / 2 : -DEPTH / 2);
  const p = g.attributes.position, n = g.attributes.normal;
  const q = new Float32Array(p.count * 3), f = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) { q[i * 3] = p.getX(i); q[i * 3 + 1] = p.getY(i); q[i * 3 + 2] = p.getZ(i); f[i] = n.getZ(i) > (round ? 0.08 : 0.9) ? 1 : 0; }
  g.setAttribute('aQ', new THREE.BufferAttribute(q, 3));
  g.setAttribute('aFace', new THREE.BufferAttribute(f, 1));
  g.translate(-dx, -dy, 0);
  g.deleteAttribute('uv');
  return g;
}
const center = (flat) => { let x = 0, y = 0; const n = flat.length / 2; for (let i = 0; i < flat.length; i += 2) { x += flat[i]; y += flat[i + 1]; } return [x / n, y / n]; };
const polyArea = (r) => { let a = 0; const n = r.length; for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; a += r[i] * r[j + 1] - r[j] * r[i + 1]; } return Math.abs(a / 2); };

export function mountName(scene, data, palU, baked) {
  const R = rng(31);
  const root = new THREE.Group(); scene.add(root);
  const uniforms = {
    ...palU,
    uMode: { value: 0 }, uTime: { value: 0 }, uMatte: { value: 0 }, uFade: { value: 1 },
    uHot: { value: new THREE.Vector2() }, uHotAmt: { value: 0 }, uHotSize: { value: 0.42 }, uSweep: { value: -2 },
    tField: { value: baked.field }, tMask: { value: baked.mask }, tVol: { value: baked.vol }, uRes: { value: new THREE.Vector2(1, 1) },
  };
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });
  const crackU = { uO: { value: new THREE.Vector2() }, uR: { value: 0 }, uAmt: { value: 0 }, uFlare: { value: 0 } };
  const crackMat = new THREE.ShaderMaterial({ vertexShader: CRACK_VERT, fragmentShader: CRACK_FRAG, uniforms: crackU, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
  const wireMat = new THREE.LineBasicMaterial({ color: 0xf6ece0, transparent: true, opacity: 0.85 });

  // Soft light that spills out around the letters.
  const haloU = { tMask: { value: baked.mask }, uAmt: { value: 1 }, ...palU };
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, SPAN), new THREE.ShaderMaterial({
    uniforms: haloU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'precision highp float; varying vec2 vUv; uniform sampler2D tMask; uniform float uAmt; uniform vec3 p_stone,p_pale; void main(){ float g=texture2D(tMask,vUv).g; gl_FragColor=vec4(mix(p_stone,p_pale,g*.45)*g*g*.24*uAmt,1.); }',
  }));
  halo.position.z = -DEPTH / 2 - 0.02; halo.renderOrder = -1; root.add(halo);

  const shards = [];
  const letters = data.letters.map((L, index) => {
    const all = L.contours.flatMap((c) => Array.from(c.pts));
    const [cx, cy] = center(all);
    const group = new THREE.Group(); group.position.set(cx, cy, 0); root.add(group);
    const whole = new THREE.Mesh(solid(L.shape, cx, cy, true), material); group.add(whole);

    // Shards are prebuilt and hidden until the moment of the burst.
    const wireParts = [];
    const list = L.shards.map((s) => {
      const [sx, sy] = center(s.rings[0]);
      const g = solid([s.rings], cx + sx, cy + sy);
      const mesh = new THREE.Mesh(g, material);
      mesh.position.set(sx, sy, 0); mesh.visible = false; mesh.frustumCulled = false; group.add(mesh);
      const wire = new THREE.WireframeGeometry(g), wp = wire.attributes.position;
      for (let i = 0; i < wp.count; i++) wireParts.push(wp.getX(i) + sx, wp.getY(i) + sy, wp.getZ(i));
      wire.dispose();
      const item = {
        mesh, area: polyArea(s.rings[0]), letter: index,
        p: new THREE.Vector3(), v: new THREE.Vector3(), axis: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), spin: 0,
        slot: new THREE.Vector3(), angle: 0, ring: 1, depth: 0, delay: 0, settle: 0, keep: false, age: 0, scale: 1, q: new THREE.Quaternion(), rate: 0.06 + R() * 0.1, phase: R() * 6.28,
        R: [R(), R(), R(), R(), R()],
      };
      shards.push(item);
      return item;
    });
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wireParts, 3));
    const wire = new THREE.LineSegments(wg, wireMat); wire.visible = false; wire.frustumCulled = false; group.add(wire);

    // Crack lines drawn as thin ribbons on the front face.
    const P = [], A = [], I = [];
    const W = 0.0105, Z = DEPTH / 2 + 0.003;
    let v = 0;
    for (let i = 0; i < L.cracks.length; i += 4) {
      const [x0, y0, x1, y1] = [L.cracks[i], L.cracks[i + 1], L.cracks[i + 2], L.cracks[i + 3]];
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * W, ny = dx / l * W;
      P.push(x0 - nx - cx, y0 - ny - cy, Z, x0 + nx - cx, y0 + ny - cy, Z, x1 + nx - cx, y1 + ny - cy, Z, x1 - nx - cx, y1 - ny - cy, Z);
      A.push(x0, y0, x0, y0, x1, y1, x1, y1);
      I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); cg.setAttribute('aP', new THREE.Float32BufferAttribute(A, 2)); cg.setIndex(I);
    const cracks = new THREE.Mesh(cg, crackMat); cracks.visible = false; cracks.frustumCulled = false; cracks.renderOrder = 5; group.add(cracks);

    return {
      group, whole, wire, cracks, list, cx, cy, index,
      p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: 1, sv: 0,
      phase: R() * 6.28, rate: 0.75 + R() * 0.4, kick: -1,
    };
  });

  // Small chips thrown when the name breaks.
  const chipN = 110;
  const chips = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), new THREE.ShaderMaterial({
    uniforms: { p_shard: palU.p_shard },
    vertexShader: 'varying vec3 vN; void main(){ vN=normalMatrix*normalize(position); gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 vN; uniform vec3 p_shard; void main(){ float l=clamp(dot(normalize(vN),vec3(.2,.6,.75)),0.,1.); gl_FragColor=vec4(p_shard*(.28+.8*l),1.); }',
  }), chipN);
  chips.frustumCulled = false; chips.visible = false; scene.add(chips);
  const chipS = Array.from({ length: chipN }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), a: R() * 6, axis: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), s: 0.012 + R() * 0.035, life: 0, max: 1 }));

  const st = { phase: 'float', mx: 0, my: 0, hover: 0, hoverT: 0, active: 0, burstAt: 0, time: 0, nudgeAt: 3.2, mouseOn: false, ptr: new THREE.Vector2(), click: new THREE.Vector2(), view: { w: 7.4, h: 4.6 } };
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), e3 = new THREE.Euler(), q5 = new THREE.Quaternion();

  const showShards = () => {
    letters.forEach((L) => { L.whole.visible = false; L.cracks.visible = false; L.list.forEach((s) => { s.mesh.visible = true; }); });
  };

  const api = {
    root, letters, shards, uniforms, crackU, st, halo, haloU,
    setMode(mode) {
      const m = { beauty: 0, uv: 1, transmission: 4, depth: 6, thermal: 7, halftone: 9, rings: 10, wireframe: -1 }[mode] ?? 0;
      uniforms.uMode.value = Math.max(0, m);
      letters.forEach((L) => { L.whole.visible = m !== -1; L.wire.visible = m === -1; });
      halo.visible = m === 0;
      chips.visible = false;
    },
    // Rest pose for the entrance: letters sit back in depth and spring forward.
    settleIn() { letters.forEach((L, i) => { L.p.z = -0.5; L.p.y = -0.08; L.s = 0.97; L.kick = st.time + i * 0.03; }); },
    setActive(v) { st.active = v; },
    setHover(v) { st.hoverT = v ? 1 : 0; },
    setPointer(x, y, on) { st.ptr.set(x, y); st.mouseOn = on; },
    setView(w, h) { st.view.w = w; st.view.h = h; },
    // Start the break from a point on the name.
    crack(x, y) {
      st.phase = 'crack'; st.click.set(x, y);
      crackU.uO.value.set(x, y); uniforms.uHot.value.set(x, y);
      letters.forEach((L) => { L.cracks.visible = true; });
    },
    burst() {
      st.phase = 'burst'; st.burstAt = st.time;
      root.updateMatrixWorld(true);
      const { w, h } = st.view;
      const sorted = [...shards].sort((a, b) => b.area - a.area);
      const keepN = Math.min(sorted.length, Math.max(26, Math.round(sorted.length * 0.36)));
      sorted.forEach((s, i) => { s.keep = i < keepN; s.order = i; });
      const spots = sorted.slice(0, keepN);
      const portrait = w < h;
      spots.forEach((s, i) => {
        // A loose ring that leaves the middle of the screen open.
        const a = (i / keepN) * Math.PI * 2 * 3.0 + s.R[0] * 0.9;
        s.angle = a; s.ring = 0.82 + s.R[1] * 0.42;
        s.depth = -0.9 + s.R[2] * 1.5;
      });
      shards.forEach((s) => {
        s.mesh.getWorldPosition(s.p); s.mesh.getWorldQuaternion(s.q);
        scene.attach(s.mesh);
        s.mesh.position.copy(s.p); s.mesh.quaternion.copy(s.q);
        v3.set(s.p.x - st.click.x, s.p.y - st.click.y, 0);
        const dist = v3.length();
        v3.divideScalar(Math.max(dist, 0.001));
        const speed = (1.9 + s.R[0] * 3.2) * (1.5 / (0.55 + dist));
        s.v.set(v3.x * speed + (s.R[1] - 0.5) * 0.9, v3.y * speed + (s.R[2] - 0.5) * 0.9 + 0.25, 0.7 + s.R[3] * 3.4);
        s.spin = (2.2 + s.R[4] * 6) * (0.5 + 1 / (0.8 + dist));
        s.delay = dist * 0.05;
        s.settle = 0.72 + s.R[3] * 0.42;
        s.age = 0; s.scale = 1;
      });
      showShards();
      chips.visible = true;
      chipS.forEach((c) => {
        const a = R() * 6.28, r = R() * 1.6;
        c.p.set(st.click.x + Math.cos(a) * r, st.click.y + Math.sin(a) * r * 0.8, DEPTH / 2);
        c.v.set(Math.cos(a) * (1.2 + R() * 3.4), Math.sin(a) * (1.2 + R() * 3.4) + 0.5, 0.5 + R() * 2.8);
        c.max = c.life = 0.9 + R() * 1.2;
      });
    },
    update(dt, t) {
      st.time = t;
      uniforms.uTime.value = t;
      st.hover += (st.hoverT - st.hover) * (1 - Math.exp(-7 * dt));
      if (st.phase === 'float' || st.phase === 'crack') {
        const calm = st.phase === 'crack' ? 0 : st.active;
        // The whole name tilts toward the pointer on a loose spring.
        const tiltX = -st.my * 0.13 * calm, tiltY = st.mx * 0.2 * calm;
        root.rotation.x += (tiltX + Math.sin(t * 0.43) * 0.016 * calm - root.rotation.x) * (1 - Math.exp(-3.4 * dt));
        root.rotation.y += (tiltY + Math.sin(t * 0.31 + 1) * 0.024 * calm - root.rotation.y) * (1 - Math.exp(-3.4 * dt));
        root.position.y = Math.sin(t * 0.72) * 0.065 * calm;
        // Each letter hangs on its own spring.
        letters.forEach((L) => {
          const amp = (0.034 + st.hover * 0.014) * calm;
          let tx = 0, ty = Math.sin(t * L.rate + L.phase) * amp, tz = (Math.sin(t * L.rate * 0.8 + L.phase * 2) * 0.05 + st.hover * 0.07) * calm;
          let trz = Math.sin(t * L.rate * 0.7 + L.phase * 3) * 0.012 * calm;
          if (st.mouseOn && calm) {
            const dx = L.cx - st.ptr.x, dy = L.cy - st.ptr.y, d = Math.hypot(dx, dy), f = 1 - smooth(0.15, 1.15, d);
            tx += (dx / Math.max(d, 0.1)) * f * 0.035; ty += (dy / Math.max(d, 0.1)) * f * 0.035; tz += f * 0.11;
            trz += -dx * f * 0.02;
          }
          const K = 72, C = 8.6; // stiffness and damping: a little overshoot
          L.v.x += (K * (tx - L.p.x) - C * L.v.x) * dt; L.v.y += (K * (ty - L.p.y) - C * L.v.y) * dt; L.v.z += (K * (tz - L.p.z) - C * L.v.z) * dt;
          L.p.addScaledVector(L.v, dt);
          L.w.z += (K * (trz - L.r.z) - C * L.w.z) * dt; L.r.z += L.w.z * dt;
          L.w.x += (K * (-L.v.y * 0.05 - L.r.x) - C * L.w.x) * dt; L.r.x += L.w.x * dt;
          L.sv += (K * (1 - L.s) - C * L.sv) * dt; L.s += L.sv * dt;
          L.group.position.set(L.cx + L.p.x, L.cy + L.p.y, L.p.z);
          // A slow turn of each letter lets the clouds inside slide past each other.
          L.group.rotation.set(L.r.x + Math.sin(t * L.rate * 0.53 + L.phase * 1.3) * 0.045 * calm, Math.sin(t * L.rate * 0.61 + L.phase) * 0.085 * calm, L.r.z);
          L.group.scale.setScalar(L.s);
        });
        // Every few seconds a wave runs through the letters and a band of light crosses them.
        if (st.phase === 'float' && calm > 0.5 && t > st.nudgeAt) {
          st.nudgeAt = t + 5.2 + R() * 1.6;
          st.pulse = 1;
          st.sweepAt = t;
          letters.forEach((L) => { L.kickAt = t + (L.cx + 2) * 0.09; L.kicked = false; });
        }
        letters.forEach((L) => {
          if (L.kickAt && !L.kicked && t > L.kickAt) { L.kicked = true; L.v.y += 1.25; L.v.z += 2.1; L.w.z += (L.phase > 3.14 ? 1 : -1) * 0.8; L.sv += 0.55; }
        });
        st.pulse = (st.pulse || 0) * Math.exp(-1.7 * dt);
        if (st.sweepAt !== undefined) {
          const k = (t - st.sweepAt) / 2.9;
          uniforms.uSweep.value = k > 1.1 ? -2 : -1.1 + k * 2.2;
        }
      } else {
        // Shards fly, then ease into their place in the ring. The rest shrink away.
        const { w, h } = st.view;
        const portrait = w < h;
        const rx = w * (portrait ? 0.47 : 0.45), ry = h * (portrait ? 0.43 : 0.43);
        shards.forEach((s) => {
          s.age += dt;
          if (s.age < s.delay) return;
          const a = s.age - s.delay;
          const hold = smooth(s.settle, s.settle + 1.15, a);
          if (s.keep) {
            const ang = s.angle + t * 0.022;
            s.slot.set(Math.cos(ang) * rx * s.ring + st.mx * 0.18 * (1.2 + s.depth * 0.3), Math.sin(ang) * ry * s.ring + st.my * 0.12 * (1.2 + s.depth * 0.3) + Math.sin(t * 0.6 + s.phase) * 0.05, s.depth);
            const k = 2.6 * hold;
            s.v.x += (s.slot.x - s.p.x) * k * dt; s.v.y += (s.slot.y - s.p.y) * k * dt; s.v.z += (s.slot.z - s.p.z) * k * dt;
            const drag = Math.exp(-(0.75 + hold * 1.7) * dt);
            s.v.multiplyScalar(drag);
          } else {
            s.v.multiplyScalar(Math.exp(-0.55 * dt));
            s.v.y -= 1.05 * dt;
            s.scale = 1 - smooth(0.7, 1.75 + s.R[2] * 0.5, a);
          }
          s.p.addScaledVector(s.v, dt);
          const spin = (s.keep ? THREE.MathUtils.lerp(s.spin, s.rate, hold) : s.spin) * dt;
          q5.setFromAxisAngle(s.axis, spin);
          s.q.premultiply(q5);
          s.mesh.position.copy(s.p); s.mesh.quaternion.copy(s.q);
          s.mesh.scale.setScalar(Math.max(0.0001, s.scale));
          s.mesh.visible = s.scale > 0.002;
        });
        chipS.forEach((c, i) => {
          if (c.life > 0) {
            c.life -= dt; c.v.y -= dt * 2.4; c.v.multiplyScalar(1 - dt * 0.5);
            c.p.addScaledVector(c.v, dt); c.a += dt * 6;
            q4.setFromAxisAngle(c.axis, c.a);
            m4.compose(c.p, q4, v3.setScalar(c.s * clamp(c.life / c.max * 3) * 1.6));
          } else m4.makeScale(0, 0, 0);
          chips.setMatrixAt(i, m4);
        });
        chips.instanceMatrix.needsUpdate = true;
      }
    },
  };
  return api;
}
