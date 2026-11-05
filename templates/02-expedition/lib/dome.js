// Domed block structure. Each block lifts and tips by a per-block activation stored in a float texture.
import * as THREE from 'three';
import { NOISE, LIGHT, WIPE, STONE } from './glsl.js';
import { rng, clamp, damp, smooth } from './math.js';
import { bentBlock, mergeBlocks } from './blocks.js';

const RAD = Math.PI / 180;

export function createDome({ G, R = 10.5, thick = 1.75, doorAzimuth = 44 } = {}) {
  const rand = rng(11);
  const C = [0, 2.3, 0];
  const blocks = [];
  const az = doorAzimuth * RAD;
  const f = [Math.sin(az), 0, Math.cos(az)], side = [Math.cos(az), 0, -Math.sin(az)];

  const axisOf = () => { const a = [rand() - .5, rand() - .5, rand() - .5]; const l = Math.hypot(...a); return a.map((v) => v / l); };
  const addBlock = (b, center, top) => { b.center = center; b.axis = axisOf(); b.top = top; blocks.push(b); };

  // Dome rows: elevation start, end, count
  const rows = [[-14, 12, 15], [13.6, 32, 14], [32.6, 50, 12], [50.6, 66, 9], [66.6, 80, 5], [80.6, 90, 3]];
  rows.forEach(([e0, e1, n], ri) => {
    const dT = 360 / n, gap = .75 + ri * .2, dPhi = (e1 - e0);
    const off = ri % 2 ? dT * .5 : 0;
    for (let i = 0; i < n; i++) {
      const th = i * dT + off + (rand() - .5) * 2.;
      const ph = (e0 + e1) / 2;
      const cosP = Math.cos(ph * RAD);
      const hx = Math.max(.55, (dT - gap) * RAD * R * cosP * .5), hy = (dPhi - gap) * RAD * R * .5, hz = thick * .5;
      const cx = C[0] + (R - thick * .5) * cosP * Math.sin(th * RAD), cy = C[1] + (R - thick * .5) * Math.sin(ph * RAD), cz = C[2] + (R - thick * .5) * cosP * Math.cos(th * RAD);
      // Drop blocks sitting in the tunnel opening
      const rx = (cx - C[0]) * side[0] + (cz - C[2]) * side[2], fw = (cx - C[0]) * f[0] + (cz - C[2]) * f[2];
      if (fw > 0 && Math.abs(rx) < 4.5 && cy < 7.4) continue;
      const seed = blocks.length * 1.37 + 3;
      const map = (x, y, z) => {
        const t = (th + (x / (R * cosP)) / RAD) * RAD, p = (ph + (y / R) / RAD) * RAD, r = R - thick * .5 + z;
        const cp = Math.cos(p);
        return [C[0] + r * cp * Math.sin(t), Math.max(-1, C[1] + r * Math.sin(p)), C[2] + r * cp * Math.cos(t)];
      };
      addBlock(bentBlock({ hx, hy, hz, map, nx: 14, ny: 10, nz: 4, round: Math.min(.42, hy * .3), rough: .08, seed }), [cx, cy, cz], clamp(ph / 80));
    }
  });

  // Tunnel: arches of wedge blocks, plus straight legs.
  const archR = 3.45, archThick = 1.45, archC = 2.5;
  const tunnelPos = (s, a, r, ly = 0) => {
    const c = Math.cos(a), si = Math.sin(a);
    return [C[0] + f[0] * s + side[0] * c * r, archC + si * r + ly, C[2] + f[2] * s + side[2] * c * r];
  };
  const rings = [[8.3, 10.2], [10.25, 12.15], [12.2, 14.3]];
  rings.forEach(([s0, s1], ri) => {
    const segs = ri % 2 ? 4 : 5;
    const span = Math.PI / segs;
    for (let i = 0; i < segs; i++) {
      const a0 = i * span, a1 = (i + 1) * span, am = (a0 + a1) / 2, sm = (s0 + s1) / 2;
      const hx = (span * .5 - .012) * (archR + archThick * .5), hy = (s1 - s0) * .5 - .03, hz = archThick * .5;
      const map = (x, y, z) => tunnelPos(sm + y, am + x / (archR + archThick * .5), archR + archThick * .5 + z);
      const seed = blocks.length * 1.37 + 3;
      addBlock(bentBlock({ hx, hy, hz, map, nx: 10, ny: 7, nz: 4, round: .3, rough: .07, seed }), tunnelPos(sm, am, archR + archThick * .5), .25);
    }
    // Legs on both sides
    [-1, 1].forEach((sgn) => {
      const sm = (s0 + s1) / 2, r = archR + archThick * .5;
      const map = (x, y, z) => {
        const lat = sgn * (r + z);
        const along = sm + y * sgn; // mirror keeps the block's faces pointing outward on both sides
        return [C[0] + f[0] * along + side[0] * lat, archC / 2 - .55 + x, C[2] + f[2] * along + side[2] * lat];
      };
      const seed = blocks.length * 1.37 + 3;
      addBlock(bentBlock({ hx: archC / 2 + .5, hy: (s1 - s0) * .5 - .03, hz: archThick * .5, map, nx: 7, ny: 7, nz: 4, round: .28, rough: .07, seed }), [C[0] + f[0] * sm + side[0] * sgn * r, archC / 2 - .55, C[2] + f[2] * sm + side[2] * sgn * r], .05);
    });
  });
  const count = blocks.length;

  const data = new Float32Array(count * 4);
  const tex = new THREE.DataTexture(data, count, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;

  const uniforms = {
    uTime: G.uTime, uRes: G.uRes, uCut: G.uCut, tState: { value: tex }, uScatter: { value: 0 }, uRevealY: { value: -100 }, uDomeC: { value: new THREE.Vector3(...C) },
    uFade: { value: 0 }, uFog: G.uFog, uBaseY: { value: 0 }, uGlobalSeam: { value: 0 }
  };
  const brickMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      attribute vec3 aLocal,aCenter,aAxis; attribute vec4 aMeta;
      uniform sampler2D tState; uniform float uScatter; uniform vec3 uDomeC;
      varying vec3 vW,vN,vL; varying vec3 vP; varying float vA,vG,vEdge,vOuter,vTop;
      vec3 rot(vec3 v,vec3 a,float t){ float c=cos(t),s=sin(t); return v*c+cross(a,v)*s+a*dot(a,v)*(1.-c); }
      void main(){
        vec4 st=texelFetch(tState,ivec2(int(aMeta.x+.5),0),0);
        float a=st.r; vG=st.g; vA=a; vEdge=aMeta.z; vOuter=aMeta.w; vTop=aMeta.y; vL=aLocal;
        vec3 outw=normalize(aCenter-uDomeC);
        float lift=pow(a,1.25)*(.85+3.1*aMeta.y*aMeta.y);
        float tilt=a*(.16+.62*aMeta.y);
        vec3 ctr=aCenter+outw*lift+vec3(0.,1.,0.)*a*a*aMeta.y*1.1;
        // scatter state: blocks drift in from far away when the loop returns
        float sc=uScatter*(.45+.75*fract(aMeta.x*.3819));
        vec3 sdir=normalize(aAxis+outw*1.6+vec3(0.,.7,0.));
        ctr+=sdir*sc*15.;
        tilt+=sc*2.8;
        vec3 p=rot(position-aCenter,aAxis,tilt);
        vec3 n=rot(normal,aAxis,tilt);
        vec3 lp=ctr+p;
        vP=lp;
        vec4 w=modelMatrix*vec4(lp,1.); vW=w.xyz; vN=mat3(modelMatrix)*n;
        gl_Position=projectionMatrix*viewMatrix*w;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vW,vN,vL,vP; varying float vA,vG,vEdge,vOuter,vTop;
      uniform float uRevealY,uFade,uGlobalSeam; uniform vec3 uFog;
      ${NOISE}${LIGHT}${WIPE}${STONE}
      void main(){
        wipeDiscard();
        if(vP.y<uRevealY) discard;
        vec3 V=normalize(cameraPosition-vW);
        vec3 N=normalize(vN);
        vec3 Ns=stoneNormal(N,vL*1.05,.34);
        float nz=fbm3(vL*1.15);
        vec3 alb=mix(vec3(.04,.045,.058),vec3(.115,.125,.15),smoothstep(.28,.72,nz));
        alb+=vec3(.022)*smoothstep(.55,.85,vn3(vL*3.4));
        float seam=max(vG,uGlobalSeam);
        // edge frost that thickens when the seams light up
        float rim=smoothstep(.76+.0,.985,vEdge+(nz-.5)*.07);
        alb=mix(alb,vec3(.36,.39,.45),rim*.5*vOuter);
        vec3 c=overcast(alb,Ns,V,.75,.07);
        float side=1.-smoothstep(.45,.97,vOuter);
        // Glow on the rim and on the sides
        vec3 glow=vec3(.86,.93,1.);
        float lit=seam*(smoothstep(.83,.995,vEdge+(nz-.5)*.06)*1.05+side*.9);
        c=mix(c,glow*.9,clamp(seam*side*1.6,0.,1.));
        c+=glow*lit;
        // Fully lifted blocks catch the inner light across the whole face
        float back=pow(vA,3.)*(.25+.75*vTop);
        c=mix(c,glow*1.,clamp(back*1.15,0.,.82));
        // Reveal band
        float band=smoothstep(1.3,.0,vP.y-uRevealY);
        c=mix(c,vec3(3.),band*step(-90.,uRevealY));
        float dist=length(cameraPosition-vW);
        c=mix(c,uFog,clamp(1.-exp(-pow(dist*.00235,1.5)),0.,1.));
        c=mix(c,uFog,uFade);
        gl_FragColor=vec4(c,1.);
      }`,
  });
  const geo = mergeBlocks(blocks);
  const bricks = new THREE.Mesh(geo, brickMat); bricks.frustumCulled = false;

  // Inner white core, seen through the gaps
  const coreU = { uTime: G.uTime, uRes: G.uRes, uCut: G.uCut, uGlow: { value: .35 }, uRevealY: uniforms.uRevealY, uAct: { value: 0 } };
  const coreMat = new THREE.ShaderMaterial({
    uniforms: coreU, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`
      varying vec3 vP; uniform float uGlow,uRevealY;
      ${NOISE}${WIPE}
      void main(){ wipeDiscard(); if(vP.y<uRevealY) discard;
        float n=vn3(vP*.75)*.5+.5;
        vec3 c=vec3(.92,.97,1.)*(uGlow*2.0*n+.1);
        if(uRevealY>-90.) c=vec3(3.4);
        gl_FragColor=vec4(c,1.); }`,
  });
  const coreGeo = new THREE.SphereGeometry(R - thick + .25, 48, 24, 0, Math.PI * 2, 0, Math.PI * .52);
  coreGeo.translate(C[0], C[1], C[2]);
  const core = new THREE.Mesh(coreGeo, coreMat);

  // Tunnel interior
  const tun = new THREE.CylinderGeometry(archR - .05, archR - .05, 7, 24, 1, true, 0, Math.PI);
  tun.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
  const tunM = new THREE.Mesh(tun, new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uRes: G.uRes, uCut: G.uCut, uAct: coreU.uAct, uRevealY: uniforms.uRevealY }, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vP; varying float vY; void main(){ vP=position; vY=(modelMatrix*vec4(position,1.)).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; varying float vY; uniform float uAct,uRevealY; ${NOISE}${WIPE}
      void main(){ wipeDiscard(); if(uRevealY>-90.) discard; gl_FragColor=vec4(mix(vec3(.018,.021,.03),vec3(.8,.88,1.),uAct*uAct),1.); }`,
  }));
  tunM.position.set(f[0] * 10.6, archC, f[2] * 10.6);
  tunM.rotation.y = az;

  // Backstop for the doorway
  const group = new THREE.Group();
  group.add(core, tunM, bricks);

  const state = blocks.map((b, i) => ({
    a: 0, g: 0, c: new THREE.Vector3(...b.center), top: b.top, num: 10 + Math.floor(rand() * 89), phase: rand() * 100, front: true,
    isArch: i >= count - 21, out: new THREE.Vector3(b.center[0] - C[0], b.center[1] - C[1], b.center[2] - C[2]).normalize(), screen: new THREE.Vector2(),
  }));

  const v = new THREE.Vector3(), w1 = new THREE.Vector3(), w2 = new THREE.Vector3(), toCam = new THREE.Vector3();
  let doorAct = 0;
  // ctx: camera, mx, my, w, h, energy, wander, dt, time
  function update(ctx) {
    const { camera, mx, my, w, h, energy, wander, dt, time, floor = 0 } = ctx;
    const t = time * .23;
    w1.set(Math.sin(t * 1.1 + 1.) * .9, .5 + .45 * Math.sin(t * .8), Math.cos(t * 1.3 + .4) * .9).normalize();
    w2.set(Math.sin(t * .7 + 4.) * .95, .6 + .35 * Math.cos(t * 1.1), Math.cos(t * .9 + 2.) * .95).normalize();
    const rad = Math.min(w, h) * .29;
    let sumDoor = 0, nDoor = 0;
    const wpos = group.getWorldPosition(new THREE.Vector3());
    state.forEach((s, i) => {
      v.copy(s.c).add(wpos); toCam.copy(camera.position).sub(v).normalize();
      s.front = toCam.dot(s.out) > .05;
      v.project(camera);
      const sx = (v.x * .5 + .5) * w, sy = (-v.y * .5 + .5) * h;
      s.screen.set(sx, sy);
      const d = Math.hypot(sx - mx, sy - my) / rad;
      const pr = Math.exp(-d * d) * energy;
      const wd = Math.max(s.out.dot(w1), s.out.dot(w2));
      const pw = smooth(.74, .995, wd) * wander;
      const target = Math.max(pr, pw);
      const bias = .55 + .65 * s.top;
      const ta = Math.max(floor, target * bias);
      s.a = damp(s.a, ta, ta > s.a ? 4.2 : 1.15, dt);
      const tgRaw = Math.min(1, Math.max(ta * 1.4, Math.exp(-d * d * .55) * energy * .85, smooth(.5, .95, wd) * wander * .72));
      const tg = s.isArch ? tgRaw * .34 : tgRaw;
      s.g = damp(s.g, tg, tg > s.g ? 5 : 1.05, dt);
      data[i * 4] = s.a; data[i * 4 + 1] = s.g;
      if (s.isArch) { sumDoor += s.g; nDoor++; }
    });
    doorAct = nDoor ? sumDoor / nDoor : 0;
    tex.needsUpdate = true;
    coreU.uAct.value = doorAct;
    return doorAct;
  }
  // Reset instantly (reduced motion, tests)
  const doorWorld = new THREE.Vector3(f[0] * 15, 0, f[2] * 15);
  return { group, uniforms, coreUniforms: coreU, state, update, doorWorld, count, f, side, C };
}
