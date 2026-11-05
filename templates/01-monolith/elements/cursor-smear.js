// cursor-smear: a glassy trail that follows the pointer and bends the image behind it.
// A small feedback buffer stores the trail. Its channels are x and y velocity plus density.
// Feed it with move(), call update() once a frame, and read .texture in a final image shader.
import * as THREE from 'three';
import { REDUCED, clamp } from './_util.js';

const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
const FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tPrev;
uniform vec2 uA, uB, uVel, uTexel;
uniform float uStr, uRadius, uAspect, uFadeV, uFadeD, uAdvect;
float seg(vec2 p, vec2 a, vec2 b){ vec2 ba=b-a; float k=dot(ba,ba); float h=k>0.?clamp(dot(p-a,ba)/k,0.,1.):0.; return length(p-a-ba*h); }
void main(){
  vec2 back=vUv-texture2D(tPrev,vUv).xy*uAdvect;
  vec4 s=texture2D(tPrev,back);
  vec4 around=texture2D(tPrev,back+vec2(uTexel.x,0.))+texture2D(tPrev,back-vec2(uTexel.x,0.))
             +texture2D(tPrev,back+vec2(0.,uTexel.y))+texture2D(tPrev,back-vec2(0.,uTexel.y));
  s=mix(s,around*.25,.3);
  s.xy*=uFadeV; s.z*=uFadeD;
  if(uStr>0.){
    vec2 asp=vec2(uAspect,1.);
    float d=seg(vUv*asp,uA*asp,uB*asp);
    float g=smoothstep(uRadius,uRadius*.12,d)*uStr;
    s.xy=mix(s.xy,uVel,g);
    s.z=max(s.z,g);
  }
  gl_FragColor=vec4(s.xyz,1.);
}`;

export function mountCursorSmear(renderer, options = {}) {
  const { radius = 0.21, fadeVelocity = 3.4, fadeDensity = 2.1, maxVelocity = 0.085, fullSpeed = 0.4, gain = 0.05, enabled = !REDUCED } = options;
  const make = () => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  let read = make(), write = make();
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, depthTest: false, depthWrite: false,
    uniforms: {
      tPrev: { value: null }, uA: { value: new THREE.Vector2() }, uB: { value: new THREE.Vector2() }, uVel: { value: new THREE.Vector2() }, uTexel: { value: new THREE.Vector2() },
      uStr: { value: 0 }, uRadius: { value: radius }, uAspect: { value: 1 }, uFadeV: { value: 1 }, uFadeD: { value: 1 }, uAdvect: { value: 0.05 },
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; scene.add(quad);
  const u = mat.uniforms;
  const now = new THREE.Vector2(), last = new THREE.Vector2();
  let seen = false, armed = false, energy = 0;

  const api = {
    get texture() { return read.texture; },
    // The trail is still visible while this is above zero. Use it to skip extra work.
    get energy() { return energy; },
    resize(w, h) {
      const H = 180, W = Math.max(2, Math.round(H * (w / Math.max(1, h))));
      read.setSize(W, H); write.setSize(W, H);
      u.uAspect.value = w / Math.max(1, h); u.uTexel.value.set(1 / W, 1 / H);
      [read, write].forEach((t) => { renderer.setRenderTarget(t); renderer.setClearColor(0, 0); renderer.clear(); });
      renderer.setRenderTarget(null);
    },
    // x and y run from 0 to 1, with y measured from the bottom.
    move(x, y) {
      if (!enabled) return;
      now.set(x, y);
      if (!seen) { seen = true; last.copy(now); }
      armed = true;
    },
    // Forget the last position so a re-entering pointer does not draw a line across the screen.
    leave() { seen = false; armed = false; },
    update(dt) {
      if (!enabled) return;
      const moved = armed ? now.distanceTo(last) : 0;
      const speed = moved / Math.max(dt, 1e-3);
      const str = clamp(speed / fullSpeed);
      u.uA.value.copy(last); u.uB.value.copy(now);
      if (moved > 1e-5) {
        const k = Math.min(gain, maxVelocity / Math.max(speed, 1e-3));
        u.uVel.value.set((now.x - last.x) / dt * k, (now.y - last.y) / dt * k);
      }
      u.uStr.value = moved > 1e-5 ? str : 0;
      u.uFadeV.value = Math.exp(-fadeVelocity * dt);
      u.uFadeD.value = Math.exp(-fadeDensity * dt);
      energy = Math.max(str, energy * Math.exp(-fadeDensity * dt));
      if (energy < 0.004) energy = 0;
      last.copy(now);
      if (!energy && !str) return;
      u.tPrev.value = read.texture;
      renderer.setRenderTarget(write);
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      [read, write] = [write, read];
    },
    destroy() { read.dispose(); write.dispose(); mat.dispose(); quad.geometry.dispose(); },
  };
  return api;
}
