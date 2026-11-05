// cursor-smear: a crisp disc of glass that follows the pointer and bends the image behind it.
// The pointer stirs a small incompressible fluid and lays two dyes into it: one holds the disc's
// shape, and the other its strength. Only the strength fades, so the disc keeps its size as it
// travels. Its middle goes first, which leaves a crescent front running on after a sudden stop,
// and circling the pointer leaves swirling rings.
// Read .texture in a final image shader, where rg is the image offset in uv units and b is how
// far inside the glass a pixel is. Feed it with move(), and call update() once a frame.
import * as THREE from 'three';
import { REDUCED, clamp } from './_util.js';

const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
const HEAD = 'precision highp float; varying vec2 vUv;';

const SPLAT = `${HEAD} uniform sampler2D t; uniform vec2 uA,uB; uniform vec3 uVal; uniform float uR,uAspect,uMix;
  float seg(vec2 p,vec2 a,vec2 b){ vec2 ba=b-a; float k=dot(ba,ba); float h=k>0.?clamp(dot(p-a,ba)/k,0.,1.):0.; return length(p-a-ba*h); }
  void main(){ vec2 s=vec2(uAspect,1.); float d=seg(vUv*s,uA*s,uB*s); float g=exp(-d*d/(uR*uR));
    vec4 c=texture2D(t,vUv);
    // uMix above zero blends velocity toward the pointer. Otherwise this adds both dyes, which only
    // ever rise. The strength dye spreads wider than the shape, so the whole disc shares one strength.
    if(uMix>0.) c.xy=mix(c.xy,uVal.xy,g*uMix); else { c.x=max(c.x,uVal.x*g); c.y=max(c.y,uVal.x*pow(g,.4)); }
    gl_FragColor=c; }`;
// uSoft spreads each value into its neighbours, which keeps the flow broad and free of tiny eddies.
const ADVECT = `${HEAD} uniform sampler2D t,tVel; uniform vec2 uScale,uT,uFade,uDrift; uniform float uDt,uSoft,uClear;
  void main(){ vec2 back=vUv-uDt*(texture2D(tVel,vUv).xy+uDrift)*uScale; vec2 o=uT*1.5;
    vec4 c=texture2D(t,back), n=(texture2D(t,back+vec2(o.x,0.))+texture2D(t,back-vec2(o.x,0.))+texture2D(t,back+vec2(0.,o.y))+texture2D(t,back-vec2(0.,o.y)))*.25;
    vec4 o2=mix(c,n,uSoft); o2.xy*=uFade;
    // The shape dye is removed only once its strength has gone.
    if(uClear>0.) o2.x*=smoothstep(.03,.1,o2.y);
    gl_FragColor=o2; }`;
const CURL = `${HEAD} uniform sampler2D tVel; uniform vec2 uT;
  void main(){ float l=texture2D(tVel,vUv-vec2(uT.x,0.)).y,r=texture2D(tVel,vUv+vec2(uT.x,0.)).y,b=texture2D(tVel,vUv-vec2(0.,uT.y)).x,t=texture2D(tVel,vUv+vec2(0.,uT.y)).x;
    gl_FragColor=vec4(.5*(r-l-t+b),0.,0.,1.); }`;
const SWIRL = `${HEAD} uniform sampler2D tVel,tCurl; uniform vec2 uT; uniform float uDt,uAmt;
  void main(){ float l=texture2D(tCurl,vUv-vec2(uT.x,0.)).x,r=texture2D(tCurl,vUv+vec2(uT.x,0.)).x,b=texture2D(tCurl,vUv-vec2(0.,uT.y)).x,t=texture2D(tCurl,vUv+vec2(0.,uT.y)).x,c=texture2D(tCurl,vUv).x;
    vec2 f=.5*vec2(abs(t)-abs(b),abs(l)-abs(r)); f/=length(f)+.0001; f*=uAmt*c;
    gl_FragColor=vec4(texture2D(tVel,vUv).xy+f*uDt,0.,1.); }`;
const DIV = `${HEAD} uniform sampler2D tVel; uniform vec2 uT;
  void main(){ float l=texture2D(tVel,vUv-vec2(uT.x,0.)).x,r=texture2D(tVel,vUv+vec2(uT.x,0.)).x,b=texture2D(tVel,vUv-vec2(0.,uT.y)).y,t=texture2D(tVel,vUv+vec2(0.,uT.y)).y;
    gl_FragColor=vec4(.5*(r-l+t-b),0.,0.,1.); }`;
const PRESSURE = `${HEAD} uniform sampler2D tP,tDiv; uniform vec2 uT;
  void main(){ float l=texture2D(tP,vUv-vec2(uT.x,0.)).x,r=texture2D(tP,vUv+vec2(uT.x,0.)).x,b=texture2D(tP,vUv-vec2(0.,uT.y)).x,t=texture2D(tP,vUv+vec2(0.,uT.y)).x;
    gl_FragColor=vec4((l+r+b+t-texture2D(tDiv,vUv).x)*.25,0.,0.,1.); }`;
const SUBTRACT = `${HEAD} uniform sampler2D tP,tVel; uniform vec2 uT;
  void main(){ float l=texture2D(tP,vUv-vec2(uT.x,0.)).x,r=texture2D(tP,vUv+vec2(uT.x,0.)).x,b=texture2D(tP,vUv-vec2(0.,uT.y)).x,t=texture2D(tP,vUv+vec2(0.,uT.y)).x;
    gl_FragColor=vec4(texture2D(tVel,vUv).xy-.5*vec2(r-l,t-b),0.,1.); }`;
// Cuts the shape dye at a threshold to make the glass. As the strength fades, the middle goes
// before the rim, leaving a crescent front. The image bends most at that rim.
const LENS = `${HEAD} uniform sampler2D tDye,tVel; uniform vec2 uT,uScale,uCut,uDir,uHead,uAsp; uniform float uLens,uDrag,uMax,uTail;
  float d(vec2 o){ return smoothstep(uCut.x,uCut.y,texture2D(tDye,vUv+o*uT).x); }
  void main(){
    vec2 q=texture2D(tDye,vUv).xy; float a=min(1.,q.y);
    float gx=(d(vec2(2.,0.))-d(vec2(-2.,0.)))*.6+(d(vec2(2.,2.))-d(vec2(-2.,2.))+d(vec2(2.,-2.))-d(vec2(-2.,-2.)))*.2;
    float gy=(d(vec2(0.,2.))-d(vec2(0.,-2.)))*.6+(d(vec2(2.,2.))-d(vec2(2.,-2.))+d(vec2(-2.,2.))-d(vec2(-2.,-2.)))*.2;
    float c=d(vec2(0.));
    float rim=c*(1.-smoothstep(.2,.98,q.x));
    // A coasting disc wears away from behind, measured back from its front.
    float wear=1.;
    if(uTail>0.){ float k=length(uDir); vec2 nd=uDir/(k+.0001); wear=mix(1.,smoothstep(-uTail,-uTail*.15,dot(vUv*uAsp-uHead,nd)),k); }
    // The body stays filled for a while, then empties from the middle and leaves the rim.
    float body=smoothstep(.22,.7,a);
    float glass=(c*body+rim*smoothstep(.0,.22,a)*(1.-body)*.8)*wear;
    vec2 off=(vec2(gx,gy)/(4.*uT.y)*uLens*sqrt(a)-texture2D(tVel,vUv).xy*uDrag*c*a)*wear;
    float m=length(off); if(m>uMax) off*=uMax/m;
    gl_FragColor=vec4(off*uScale,glass,1.); }`;

export function mountCursorSmear(renderer, options = {}) {
  const {
    radius = 0.116, // sets the disc size, in screen heights
    pushRadius = 0.16, // how wide the pointer stirs the fluid
    follow = 26, // how tightly the stirring point chases the pointer, per second
    carry = 0.165, maxCarry = 0.36, carryFade = 1.7, drift = 1.95,
    tailStart = 0.42, tailEnd = 0.09, tailRate = 0.36, // how quickly a coasting disc wears away from behind
    // how far the front coasts after a stop
    gain = 0.32, maxVelocity = 0.55, // how much pointer speed the fluid takes on
    fullSpeed = 0.5, // pointer speed that makes a full-strength disc, in screen heights per second
    fadeVelocity = 1.1, fadeDye = 0.95, // per second
    swirl = 1.6, iterations = 16,
    softVelocity = 0.14, softDye = 0.05, // viscosity and dye spreading, per frame
    cutLow = 0.16, cutHigh = 0.5, // the dye level at the disc's rim, which sets how crisp it is
    lens = 0.00055, drag = 0.018, maxOffset = 0.07, // image bending, in screen heights
    enabled = !REDUCED,
  } = options;
  const RT = () => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const pair = () => { const a = RT(), b = RT(); return { get read() { return this.a; }, a, b, swap() { const t = this.a; this.a = this.b; this.b = t; } }; };
  const vel = pair(), dye = pair(), press = pair(), curl = RT(), div = RT(), out = RT();
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; scene.add(quad);
  const mat = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader, uniforms, depthTest: false, depthWrite: false });
  const v2 = () => ({ value: new THREE.Vector2() }), tx = () => ({ value: null }), f = (value) => ({ value });
  const M = {
    splat: mat(SPLAT, { t: tx(), uA: v2(), uB: v2(), uVal: { value: new THREE.Vector3() }, uR: f(radius), uAspect: f(1), uMix: f(0) }),
    advect: mat(ADVECT, { t: tx(), tVel: tx(), uScale: v2(), uT: v2(), uDrift: v2(), uDt: f(0), uFade: v2(), uSoft: f(0), uClear: f(0) }),
    curl: mat(CURL, { tVel: tx(), uT: v2() }),
    swirl: mat(SWIRL, { tVel: tx(), tCurl: tx(), uT: v2(), uDt: f(0), uAmt: f(swirl) }),
    div: mat(DIV, { tVel: tx(), uT: v2() }),
    press: mat(PRESSURE, { tP: tx(), tDiv: tx(), uT: v2() }),
    sub: mat(SUBTRACT, { tP: tx(), tVel: tx(), uT: v2() }),
    lens: mat(LENS, { tDye: tx(), tVel: tx(), uT: v2(), uScale: v2(), uCut: { value: new THREE.Vector2(cutLow, cutHigh) }, uDir: v2(), uHead: v2(), uAsp: v2(), uTail: f(0), uLens: f(lens), uDrag: f(drag), uMax: f(maxOffset) }),
  };
  const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(scene, cam); };

  const target = new THREE.Vector2(), now = new THREE.Vector2(), last = new THREE.Vector2();
  let seen = false, energy = 0, aspect = 1;
  const dirN = new THREE.Vector2(1, 0), stamp = new THREE.Vector2(), lastStamp = new THREE.Vector2(), push = new THREE.Vector2(), head = new THREE.Vector2();
  let coast = 0, coastTime = 0;
  const simT = new THREE.Vector2(), dyeT = new THREE.Vector2();

  const clearAll = () => {
    const clearColor = new THREE.Color(); renderer.getClearColor(clearColor); const a = renderer.getClearAlpha();
    renderer.setClearColor(0, 0);
    [vel.a, vel.b, dye.a, dye.b, press.a, press.b, curl, div, out].forEach((t) => { renderer.setRenderTarget(t); renderer.clear(); });
    renderer.setRenderTarget(null); renderer.setClearColor(clearColor, a);
  };

  const api = {
    get texture() { return out.texture; },
    // The puff is still visible while this is above zero. Use it to skip extra work.
    get energy() { return energy; },
    resize(w, h) {
      aspect = w / Math.max(1, h);
      const SH = 90, DH = 160;
      const SW = Math.max(2, Math.round(SH * aspect)), DW = Math.max(2, Math.round(DH * aspect));
      [vel.a, vel.b, press.a, press.b, curl, div].forEach((t) => t.setSize(SW, SH));
      [dye.a, dye.b, out].forEach((t) => t.setSize(DW, DH));
      simT.set(1 / SW, 1 / SH); dyeT.set(1 / DW, 1 / DH);
      M.splat.uniforms.uAspect.value = aspect;
      M.advect.uniforms.uScale.value.set(1 / aspect, 1);
      [M.curl, M.swirl, M.div, M.press, M.sub].forEach((m) => m.uniforms.uT.value.copy(simT));
      M.lens.uniforms.uT.value.copy(dyeT);
      M.lens.uniforms.uScale.value.set(1 / aspect, 1);
      clearAll();
    },
    // x and y run from 0 to 1, with y measured from the bottom.
    move(x, y) {
      if (!enabled) return;
      // A jump this large in one event is the pointer re-entering, not a stroke.
      if (seen && Math.hypot((x - target.x) * aspect, y - target.y) > 0.3) seen = false;
      target.set(x, y);
      if (!seen) { seen = true; now.copy(target); last.copy(target); lastStamp.copy(target); push.set(0, 0); coast = 0; }
    },
    // Forget the last position so a re-entering pointer does not draw a line across the screen.
    leave() { seen = false; },
    update(dt) {
      if (!enabled) return;
      dt = Math.min(dt, 1 / 30);
      // The stirring point eases after the pointer, so its motion never starts or stops dead.
      now.lerp(target, 1 - Math.exp(-follow * dt));
      const dx = (now.x - last.x) * aspect, dy = now.y - last.y;
      const moved = seen ? Math.hypot(dx, dy) : 0;
      const speed = moved / Math.max(dt, 1e-3);
      last.copy(now);
      // Momentum rises with faster motion or a change of direction. Once the pointer slows, the
      // momentum carries the whole disc onward, and the coasting amount says how far along that is.
      const vx = dx / dt * carry, vy = dy / dt * carry, vm = Math.hypot(vx, vy), pm = push.length();
      if (vm >= pm * 0.8 || vx * push.x + vy * push.y < 0) {
        const k = 1 - Math.exp(-24 * dt);
        push.x += (vx - push.x) * k; push.y += (vy - push.y) * k;
        const m = push.length(); if (m > maxCarry) push.multiplyScalar(maxCarry / m);
        coast = Math.max(0, coast - dt * 8);
        coastTime = 0; head.set(now.x * aspect, now.y);
      } else {
        push.multiplyScalar(Math.exp(-carryFade * dt));
        coast = Math.min(1, coast + dt * 14);
        coastTime += dt;
        head.addScaledVector(push, drift * coast * dt);
      }
      stamp.copy(now);
      const sx = (stamp.x - lastStamp.x) * aspect, sy = stamp.y - lastStamp.y;
      const stampMoved = seen ? Math.hypot(sx, sy) : 0;
      const stampSpeed = stampMoved / Math.max(dt, 1e-3);
      const strength = clamp(stampSpeed / 0.09) * (0.62 + 0.38 * clamp(stampSpeed / fullSpeed));
      energy = Math.max(strength, energy * Math.exp(-1.2 * dt));
      if (energy < 0.02 && stampMoved < 1e-5 && push.length() < 0.01) {
        // Fully at rest: wipe the buffers so nothing old can reappear with the next stroke.
        if (energy > 0) clearAll();
        energy = 0; lastStamp.copy(stamp); return;
      }
      renderer.setScissorTest(false);

      // Stir: blend the fluid toward this point's velocity along the path it moved this frame.
      if (stampMoved > 1e-5) {
        const k = Math.min(gain, maxVelocity / Math.max(stampSpeed, 1e-3));
        const s = M.splat.uniforms;
        s.uA.value.copy(lastStamp); s.uB.value.copy(stamp);
        s.t.value = vel.a.texture; s.uR.value = pushRadius; s.uMix.value = 0.85 * Math.min(1, stampSpeed / 0.06);
        s.uVal.value.set((sx / dt) * k, (sy / dt) * k, 0);
        pass(M.splat, vel.b); vel.swap();
        s.t.value = dye.a.texture; s.uR.value = radius; s.uMix.value = 0; s.uVal.value.set(strength, 0, 0);
        pass(M.splat, dye.b); dye.swap();
      }
      lastStamp.copy(stamp);

      // Keep the swirls alive, then make the velocity field incompressible.
      M.curl.uniforms.tVel.value = vel.a.texture; pass(M.curl, curl);
      M.swirl.uniforms.tVel.value = vel.a.texture; M.swirl.uniforms.tCurl.value = curl.texture; M.swirl.uniforms.uDt.value = dt;
      pass(M.swirl, vel.b); vel.swap();
      M.div.uniforms.tVel.value = vel.a.texture; pass(M.div, div);
      M.press.uniforms.tDiv.value = div.texture;
      for (let i = 0; i < iterations; i++) { M.press.uniforms.tP.value = press.a.texture; pass(M.press, press.b); press.swap(); }
      M.sub.uniforms.tP.value = press.a.texture; M.sub.uniforms.tVel.value = vel.a.texture;
      pass(M.sub, vel.b); vel.swap();

      // Carry the velocity and the dye along the flow.
      const a = M.advect.uniforms;
      a.uDt.value = dt; a.tVel.value = vel.a.texture;
      a.uT.value.copy(simT); a.uSoft.value = softVelocity;
      const fv = Math.exp(-fadeVelocity * dt);
      a.uDrift.value.set(0, 0);
      a.t.value = vel.a.texture; a.uFade.value.set(fv, fv); a.uClear.value = 0; pass(M.advect, vel.b); vel.swap();
      a.tVel.value = vel.a.texture;
      a.uT.value.copy(dyeT); a.uSoft.value = softDye;
      a.uDrift.value.copy(push).multiplyScalar(drift * coast);
      a.t.value = dye.a.texture; a.uFade.value.set(1, Math.exp(-fadeDye * dt)); a.uClear.value = 1; pass(M.advect, dye.b); dye.swap();

      const pl = push.length(), L = M.lens.uniforms;
      if (pl > 1e-3) dirN.copy(push).divideScalar(pl);
      L.uDir.value.copy(dirN).multiplyScalar(coast);
      L.uHead.value.copy(head); L.uAsp.value.set(aspect, 1);
      L.uTail.value = coast > 0.01 ? Math.max(tailEnd, tailStart - coastTime * tailRate) : 0;
      M.lens.uniforms.tDye.value = dye.a.texture; M.lens.uniforms.tVel.value = vel.a.texture;
      pass(M.lens, out);
      renderer.setRenderTarget(null);
    },
    destroy() { [vel.a, vel.b, dye.a, dye.b, press.a, press.b, curl, div, out].forEach((t) => t.dispose()); Object.values(M).forEach((m) => m.dispose()); quad.geometry.dispose(); },
  };
  return api;
}
