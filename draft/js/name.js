// name: the 3D letters. They share one veined stone surface, float on small springs,
// crack from the point they are clicked, and burst into shards that settle into a slow ring.
import * as THREE from 'three';
import { GLSL_NOISE, rng, clamp, smooth } from './_util.js';

export const DEPTH = 0.24;

const VERT = /* glsl */`
attribute vec3 aQ; attribute float aFace;
varying vec3 vQ, vN, vV, vP; varying float vFace;
void main(){
  vP=aQ; vQ=aQ*.56+vec3(.3,.1,0.); vFace=aFace;
  vN=normalize(normalMatrix*normal);
  vec4 mv=modelViewMatrix*vec4(position,1.);
  vV=normalize(-mv.xyz);
  gl_Position=projectionMatrix*mv;
}`;

const FRAG = /* glsl */`
precision highp float;
varying vec3 vQ, vN, vV, vP; varying float vFace;
uniform int uMode;
uniform float uTime, uMatte, uHotAmt, uHotSize, uSweep, uFade;
uniform vec2 uHot;
uniform vec3 p_pale, p_stone, p_deep, p_shard;
${GLSL_NOISE}
vec3 surface(vec3 N, vec3 V){
  vec3 q=vec3(vQ.x,vQ.y/1.75,vQ.z);
  float tear=fbm(vec3(q.x*1.25,q.y*1.5,q.z*1.25)+3.1);
  float h=q.y*2.3+(tear-.5)*.8;
  float layer=fbm(vec3(h*1.2,0.,2.7));
  float blot=fbm(vec3(q.x*1.7,h*2.7,q.z*1.7)+9.);
  float blot2=fbm(vec3(q.x*3.6,h*6.5,q.z*3.6)+tear*1.5);
  float m=layer*.66+blot*.27+blot2*.07;
  m=(m-.5)*1.5+.5;
  vec3 pale=mix(p_pale,p_stone,.2);
  vec3 c=mix(pale,p_stone,smoothstep(.28,.5,m));
  c=mix(c,p_deep,smoothstep(.48,.72,m)*.94);
  float w=tear*2.4;
  float v1=fbm(q*vec3(3.1,5.4,3.1)+w);
  float v2=fbm(q*vec3(6.6,10.4,6.6)-w+7.);
  float veins=pow(1.-abs(2.*v1-1.),16.)+.75*pow(1.-abs(2.*v2-1.),18.);
  c=mix(c,mix(p_pale,p_stone,.3),clamp(veins,0.,1.)*.22);
  c+=(vnoise(q*120.)-.5)*.06*smoothstep(.42,.6,m)*p_pale;
  return c;
}
void main(){
  vec3 N=normalize(vN), V=normalize(vV);
  vec3 c;
  if(uMode==1){ // checker
    vec2 uv=vP.xy*vec2(3.2,3.2);
    float ch=mod(floor(uv.x)+floor(uv.y),2.);
    c=mix(vec3(.17,.16,.16),vec3(.95,.91,.84),ch)*(.72+.28*clamp(dot(N,V),0.,1.));
  } else if(uMode==2){ // normals
    c=mix(N*.5+.5,vec3(1.),.28); c.b=max(c.b,.86); c.g=mix(c.g,.68,.6);
  } else if(uMode==3){ // clay
    float l=clamp(dot(N,normalize(vec3(.1,.5,.85))),0.,1.);
    c=vec3(.42,.39,.37)*(.25+.85*l)*(.9+.2*vnoise(vP*6.));
  } else if(uMode==4){ // transmission
    float n=fbm(vQ*1.5+vec3(0.,uTime*.05,0.));
    c=mix(vec3(.37,.72,.82),vec3(.64,.27,.78),smoothstep(.34,.62,n));
  } else if(vFace>.5){
    c=surface(N,V);
    if(uMatte>.001){
      float l=clamp(dot(N,normalize(vec3(.25,.6,.75))),0.,1.);
      c=mix(c,p_shard*(.34+.86*pow(l,1.15)),uMatte);
    }
    // Soft edge light so the thick letters stay readable against the dark.
    c=mix(c,mix(p_pale,p_stone,.16),pow(1.-clamp(dot(N,V),0.,1.),3.2)*.62);
    // A band of light that crosses the name when it asks to be clicked.
    if(uSweep>-1.5){
      float s=exp(-pow((vP.x-uSweep*2.6+vP.y*.22)*3.4,2.));
      c=mix(c,c*.86+p_pale*.34,s*.75);
    }
    // Heat under the pointer.
    if(uHotAmt>.002){
      float d=distance(vP.xy,uHot);
      float n=fbm(vec3(vP.xy*3.4,uTime*.15));
      float h=smoothstep(uHotSize,uHotSize*.18,d+(n-.5)*uHotSize*.55);
      c=mix(c,vec3(1.22,1.14,1.03),h*h*uHotAmt);
      c+=p_pale*exp(-d*d/(uHotSize*uHotSize*2.6))*.2*uHotAmt;
    }
  } else {
    // Sides and the back: raw inner rock.
    float l=clamp(dot(N,normalize(vec3(-.3,.6,.7))),0.,1.);
    c=mix(p_deep*.42,p_shard*.78,l*l);
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
function solid(multi, dx = 0, dy = 0) {
  const g = new THREE.ExtrudeGeometry(shapesFrom(multi), { depth: DEPTH, bevelEnabled: false, steps: 1, curveSegments: 1 });
  g.translate(0, 0, -DEPTH / 2);
  const p = g.attributes.position, n = g.attributes.normal;
  const q = new Float32Array(p.count * 3), f = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) { q[i * 3] = p.getX(i); q[i * 3 + 1] = p.getY(i); q[i * 3 + 2] = p.getZ(i); f[i] = n.getZ(i) > 0.9 ? 1 : 0; }
  g.setAttribute('aQ', new THREE.BufferAttribute(q, 3));
  g.setAttribute('aFace', new THREE.BufferAttribute(f, 1));
  g.translate(-dx, -dy, 0);
  g.deleteAttribute('uv');
  return g;
}
const center = (flat) => { let x = 0, y = 0; const n = flat.length / 2; for (let i = 0; i < flat.length; i += 2) { x += flat[i]; y += flat[i + 1]; } return [x / n, y / n]; };
const polyArea = (r) => { let a = 0; const n = r.length; for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; a += r[i] * r[j + 1] - r[j] * r[i + 1]; } return Math.abs(a / 2); };

export function mountName(scene, data, palU) {
  const R = rng(31);
  const root = new THREE.Group(); scene.add(root);
  const uniforms = {
    ...palU,
    uMode: { value: 0 }, uTime: { value: 0 }, uMatte: { value: 0 }, uFade: { value: 1 },
    uHot: { value: new THREE.Vector2() }, uHotAmt: { value: 0 }, uHotSize: { value: 0.42 }, uSweep: { value: -2 },
  };
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });
  const crackU = { uO: { value: new THREE.Vector2() }, uR: { value: 0 }, uAmt: { value: 0 }, uFlare: { value: 0 } };
  const crackMat = new THREE.ShaderMaterial({ vertexShader: CRACK_VERT, fragmentShader: CRACK_FRAG, uniforms: crackU, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
  const wireMat = new THREE.LineBasicMaterial({ color: 0xf6ece0, transparent: true, opacity: 0.85 });

  const shards = [];
  const letters = data.letters.map((L, index) => {
    const all = L.contours.flatMap((c) => Array.from(c.pts));
    const [cx, cy] = center(all);
    const group = new THREE.Group(); group.position.set(cx, cy, 0); root.add(group);
    const whole = new THREE.Mesh(solid(L.shape, cx, cy), material); group.add(whole);

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
    root, letters, shards, uniforms, crackU, st,
    setMode(mode) {
      const m = { beauty: 0, uv: 1, normals: 2, clay: 3, transmission: 4, wireframe: -1 }[mode] ?? 0;
      uniforms.uMode.value = Math.max(0, m);
      letters.forEach((L) => { L.whole.visible = m !== -1; L.wire.visible = m === -1; });
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
          L.group.rotation.set(L.r.x, 0, L.r.z);
          L.group.scale.setScalar(L.s);
        });
        // Every few seconds a wave runs through the letters and a band of light crosses them.
        if (st.phase === 'float' && calm > 0.5 && t > st.nudgeAt) {
          st.nudgeAt = t + 3.4 + R() * 1.2;
          st.pulse = 1;
          st.sweepAt = t;
          letters.forEach((L) => { L.kickAt = t + (L.cx + 2) * 0.09; L.kicked = false; });
        }
        letters.forEach((L) => {
          if (L.kickAt && !L.kicked && t > L.kickAt) { L.kicked = true; L.v.y += 1.25; L.v.z += 2.1; L.w.z += (L.phase > 3.14 ? 1 : -1) * 0.8; L.sv += 0.55; }
        });
        st.pulse = (st.pulse || 0) * Math.exp(-1.7 * dt);
        if (st.sweepAt !== undefined) {
          const k = (t - st.sweepAt) / 1.15;
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
