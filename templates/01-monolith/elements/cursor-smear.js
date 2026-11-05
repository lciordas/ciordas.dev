// cursor-smear: a glassy puff of fluid that follows the pointer and bends the image behind it.
// The pointer stirs a small incompressible fluid. Momentum keeps the puff travelling after a
// sudden stop, and circling the pointer leaves swirls. A dome of dye carried by that fluid acts
// as a soft lens: read .texture in a final image shader, where rg is the image offset in uv
// units and b is the lens strength. Feed it with move(), and call update() once a frame.
import * as THREE from 'three';
import { REDUCED, clamp } from './_util.js';

const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
const HEAD = 'precision highp float; varying vec2 vUv;';

const SPLAT = `${HEAD} uniform sampler2D t; uniform vec2 uA,uB; uniform vec3 uVal; uniform float uR,uAspect,uMix,uGrow,uCap;
  float seg(vec2 p,vec2 a,vec2 b){ vec2 ba=b-a; float k=dot(ba,ba); float h=k>0.?clamp(dot(p-a,ba)/k,0.,1.):0.; return length(p-a-ba*h); }
  void main(){ vec2 s=vec2(uAspect,1.); float d=seg(vUv*s,uA*s,uB*s); float g=exp(-d*d/(uR*uR));
    vec4 c=texture2D(t,vUv);
    // uMix above zero blends velocity toward the pointer. Otherwise this adds dye, which only ever
    // rises, and its outer edge keeps building, so sustained motion makes a larger lens.
    if(uMix>0.) c.xy=mix(c.xy,uVal.xy,g*uMix); else c.x=min(uCap,max(c.x,uVal.x*g)+uVal.x*g*uGrow);
    gl_FragColor=c; }`;
// uSoft spreads each value into its neighbours, which keeps the flow broad and free of tiny eddies.
const ADVECT = `${HEAD} uniform sampler2D t,tVel; uniform vec2 uScale,uT; uniform float uDt,uFade,uSoft,uOver;
  void main(){ vec2 back=vUv-uDt*texture2D(tVel,vUv).xy*uScale; vec2 o=uT*1.5;
    vec4 c=texture2D(t,back), n=(texture2D(t,back+vec2(o.x,0.))+texture2D(t,back-vec2(o.x,0.))+texture2D(t,back+vec2(0.,o.y))+texture2D(t,back-vec2(0.,o.y)))*.25;
    // uOver drains built-up dye faster, so a long spin settles as quickly as a short flick.
    vec4 o2=mix(c,n,uSoft)*uFade; o2.x/=1.+uOver*uDt*max(o2.x-.8,0.);
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
// Turns the dye dome into a smooth image offset, so the picture stays continuous between texels.
const LENS = `${HEAD} uniform sampler2D tDye,tVel; uniform vec2 uT,uScale; uniform float uLens,uDrag,uMax;
  float d(vec2 o){ return min(1.,texture2D(tDye,vUv+o*uT).x); }
  void main(){
    float gx=(d(vec2(2.,0.))-d(vec2(-2.,0.)))*.6+(d(vec2(2.,2.))-d(vec2(-2.,2.))+d(vec2(2.,-2.))-d(vec2(-2.,-2.)))*.2;
    float gy=(d(vec2(0.,2.))-d(vec2(0.,-2.)))*.6+(d(vec2(2.,2.))-d(vec2(2.,-2.))+d(vec2(-2.,2.))-d(vec2(-2.,-2.)))*.2;
    float c=d(vec2(0.));
    // Steeper where the dye is thin: the lens keeps a defined rim as it fades, like a drop of glass.
    vec2 off=vec2(gx,gy)/(4.*uT.y)*uLens*(.25+1.75*(1.-min(c,1.)))-texture2D(tVel,vUv).xy*uDrag*smoothstep(.04,.4,c);
    float m=length(off); if(m>uMax) off*=uMax/m;
    // b keeps the full dye amount, which climbs above 1 under sustained motion.
    gl_FragColor=vec4(off*uScale,texture2D(tDye,vUv).x,1.); }`;

export function mountCursorSmear(renderer, options = {}) {
  const {
    radius = 0.13, // puff size, in screen heights
    pushRadius = 0.14, // how wide the pointer stirs the fluid
    widen = 1.25, // how much sustained motion widens the puff
    drain = 0.4, // how fast built-up dye falls back, per second
    cap = 2.8, // the most dye sustained motion can build up
    grow = 6, // how quickly sustained motion enlarges the lens, per second
    follow = 22, // how tightly the stirring point chases the pointer, per second
    gain = 1.0, maxVelocity = 1.8, // how much pointer speed the fluid takes on
    fullSpeed = 0.95, // pointer speed that makes a full-strength puff, in screen heights per second
    fadeVelocity = 1.0, fadeDye = 1.3, // per second
    swirl = 1.6, iterations = 16,
    softVelocity = 0.14, softDye = 0.07, // viscosity and dye spreading, per frame
    lens = 0.0026, drag = 0.024, maxOffset = 0.14, // image bending, in screen heights
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
    splat: mat(SPLAT, { t: tx(), uA: v2(), uB: v2(), uVal: { value: new THREE.Vector3() }, uR: f(radius), uAspect: f(1), uMix: f(0), uGrow: f(0), uCap: f(cap) }),
    advect: mat(ADVECT, { t: tx(), tVel: tx(), uScale: v2(), uT: v2(), uDt: f(0), uFade: f(1), uSoft: f(0), uOver: f(0) }),
    curl: mat(CURL, { tVel: tx(), uT: v2() }),
    swirl: mat(SWIRL, { tVel: tx(), tCurl: tx(), uT: v2(), uDt: f(0), uAmt: f(swirl) }),
    div: mat(DIV, { tVel: tx(), uT: v2() }),
    press: mat(PRESSURE, { tP: tx(), tDiv: tx(), uT: v2() }),
    sub: mat(SUBTRACT, { tP: tx(), tVel: tx(), uT: v2() }),
    lens: mat(LENS, { tDye: tx(), tVel: tx(), uT: v2(), uScale: v2(), uLens: f(lens), uDrag: f(drag), uMax: f(maxOffset) }),
  };
  const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(scene, cam); };

  const target = new THREE.Vector2(), now = new THREE.Vector2(), last = new THREE.Vector2();
  let seen = false, energy = 0, aspect = 1, sustain = 0;
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
      const SH = 90, DH = 128;
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
      target.set(x, y);
      if (!seen) { seen = true; now.copy(target); last.copy(target); }
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
      const strength = clamp(speed / fullSpeed);
      energy = Math.max(strength, energy * Math.exp(-1.9 * dt));
      // Rises only with motion that lasts, so a long spin spreads further than a quick flick.
      sustain += (strength - sustain) * (1 - Math.exp(-(strength > sustain ? 1.7 : 3) * dt));
      if (energy < 0.003) { energy = 0; if (!seen || moved === 0) { last.copy(now); return; } }
      renderer.setScissorTest(false);

      // Stir: blend the fluid toward the pointer's velocity along the path it moved this frame.
      if (moved > 1e-5) {
        const k = Math.min(gain, maxVelocity / Math.max(speed, 1e-3));
        const s = M.splat.uniforms;
        s.uA.value.copy(last); s.uB.value.copy(now);
        s.t.value = vel.a.texture; s.uR.value = pushRadius; s.uMix.value = 0.85 * Math.min(1, speed / 0.06);
        s.uVal.value.set((dx / dt) * k, (dy / dt) * k, 0);
        pass(M.splat, vel.b); vel.swap();
        s.t.value = dye.a.texture; s.uR.value = radius * (1 + widen * sustain); s.uMix.value = 0; s.uGrow.value = grow * dt; s.uVal.value.set(strength, 0, 0);
        pass(M.splat, dye.b); dye.swap();
      }
      last.copy(now);

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
      a.uT.value.copy(simT); a.uSoft.value = softVelocity; a.uOver.value = 0;
      a.t.value = vel.a.texture; a.uFade.value = Math.exp(-fadeVelocity * dt); pass(M.advect, vel.b); vel.swap();
      a.tVel.value = vel.a.texture;
      a.uT.value.copy(dyeT); a.uSoft.value = softDye; a.uOver.value = drain;
      a.t.value = dye.a.texture; a.uFade.value = Math.exp(-fadeDye * dt); pass(M.advect, dye.b); dye.swap();

      M.lens.uniforms.tDye.value = dye.a.texture; M.lens.uniforms.tVel.value = vel.a.texture;
      pass(M.lens, out);
      renderer.setRenderTarget(null);
    },
    destroy() { [vel.a, vel.b, dye.a, dye.b, press.a, press.b, curl, div, out].forEach((t) => t.dispose()); Object.values(M).forEach((m) => m.dispose()); quad.geometry.dispose(); },
  };
  return api;
}
