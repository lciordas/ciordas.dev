// media-plane: a floating project screen with soft torn edges. It opens from a narrow
// column, cross-cuts between media, and shows a generated placeholder until media exists.
import * as THREE from 'three';
import { GLSL_NOISE, ensureStage, damp } from './_util.js';

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uOpen,uFade,uTime,uSeed,uCut,uMix,uHas,uHasB,uAspect; uniform sampler2D uA,uB; uniform vec3 p_haze,p_pale,p_deep,p_top,p_stone;
uniform vec2 uCoverA,uCoverB;
${GLSL_NOISE}
vec3 placeholder(vec2 uv,float seed){
  // Three shot types per project, cut between like an edit.
  float t=uTime*.16;
  float kind=mod(seed,3.);
  vec2 p=(uv-.5)*vec2(uAspect,1.);
  vec3 c;
  if(kind<1.){ // slow ink plumes
    float n=fbm(vec3(p*2.2+vec2(0.,t*1.2),seed+t*.4));
    float m=fbm(vec3(p*5.+n*1.8,seed*2.+t*.3));
    c=mix(p_top*.45,mix(p_haze,p_pale,.45),smoothstep(.42,.74,n*.6+m*.5));
  } else if(kind<2.){ // light on a sphere
    float r=length(p-vec2(sin(t+seed)*.12,.03));
    float s=smoothstep(.34,.33,r);
    vec3 n=vec3(p,sqrt(max(0.,.1156-r*r))/.34);
    float l=clamp(dot(normalize(n),normalize(vec3(sin(t*2.)*.6,.5,.65))),0.,1.);
    float grain=fbm(vec3(p*9.,seed));
    c=mix(p_top*.5+p_haze*.18*(1.-r),mix(p_deep,p_pale,pow(l,1.5))*(.8+.35*grain),s);
  } else { // horizon with drifting stars
    float h=smoothstep(-.22,-.1,p.y+.04*fbm(vec3(p.x*4.,seed,1.)));
    c=mix(p_stone*.45,mix(p_haze*.75,p_top*.35,smoothstep(-.1,.5,p.y)),h);
    vec2 g=p*18.+vec2(t*.4,0.); vec2 i=floor(g);
    float st=step(.965,hash21(i+seed))*smoothstep(.32,.05,length(fract(g)-.5));
    c+=st*h*p_pale*1.1;
  }
  return c;
}
vec2 cover(vec2 uv,vec2 k){ return (uv-.5)*k+.5; }
void main(){
  vec2 uv=vUv;
  // The window is open wide only once uOpen reaches 1, starting as a monolith-width column.
  float halfW=mix(.13,.5,uOpen);
  float x=abs(uv.x-.5);
  float n=vnoise(vec3(uv*7.,uSeed))*.018;
  float edge=(1.-smoothstep(halfW-.022-n,halfW-.002,x));
  float ey=(1.-smoothstep(.5-.03-n*1.4,.5-.002,abs(uv.y-.5)));
  float alpha=edge*ey*uFade;
  if(alpha<.004) discard;
  vec3 a=uHas>.5?texture2D(uA,cover(uv,uCoverA)).rgb:placeholder(uv,uSeed+uCut);
  vec3 b=uHasB>.5?texture2D(uB,cover(uv,uCoverB)).rgb:placeholder(uv,uSeed+uCut-1.);
  vec3 c=mix(b,a,uMix);
  c*=.97+.06*hash21(uv*vec2(913.,411.)+uTime);
  gl_FragColor=vec4(c,alpha);
}`;

export function mountMediaPlane(container, options = {}) {
  const { width = 8.2, height = 4.75, position = [0, 3.35, -0.4], interval = 3.4, paletteUniforms: palU } = options;
  const stage = options.scene ? null : ensureStage(container, { position: [0, 3.2, 11], look: [0, 3.2, 0], background: 0x0b0a10 });
  const parent = options.scene || stage.scene;
  const base = palU || {
    p_haze: { value: new THREE.Color('#a79b8f') }, p_pale: { value: new THREE.Color('#ffe9d8') }, p_deep: { value: new THREE.Color('#7b2a1d') }, p_top: { value: new THREE.Color('#14090c') }, p_stone: { value: new THREE.Color('#c96f4d') },
  };
  const uniforms = {
    ...base, uOpen: { value: 0 }, uFade: { value: 0 }, uTime: { value: 0 }, uSeed: { value: 0 }, uCut: { value: 0 }, uMix: { value: 1 }, uHas: { value: 0 }, uHasB: { value: 0 }, uAspect: { value: width / height },
    uA: { value: null }, uB: { value: null }, uCoverA: { value: new THREE.Vector2(1, 1) }, uCoverB: { value: new THREE.Vector2(1, 1) },
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 1, 1), new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
    fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  mesh.position.set(...position);
  mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.layers.enable(1);
  parent.add(mesh);
  const basePos = mesh.position.clone();

  const loader = new THREE.TextureLoader();
  const cache = new Map();
  const load = (m) => {
    if (cache.has(m.src)) return cache.get(m.src);
    let entry;
    if (m.type === 'video' || /\.(mp4|webm|mov)$/i.test(m.src)) {
      const v = document.createElement('video');
      Object.assign(v, { src: m.src, muted: true, loop: true, playsInline: true, crossOrigin: 'anonymous', preload: 'auto' });
      const t = new THREE.VideoTexture(v); t.colorSpace = THREE.NoColorSpace;
      entry = { tex: t, video: v, aspect: () => (v.videoWidth / v.videoHeight) || 16 / 9 };
    } else {
      const t = loader.load(m.src); t.colorSpace = THREE.NoColorSpace;
      entry = { tex: t, aspect: () => (t.image ? t.image.width / t.image.height : 16 / 9) };
    }
    cache.set(m.src, entry);
    return entry;
  };
  const coverK = (out, imgAspect) => {
    const pa = width / height;
    if (imgAspect > pa) out.set(pa / imgAspect, 1); else out.set(1, imgAspect / pa);
  };
  const st = { media: [], cursor: 0, clock: 0, seed: 0, mixing: 1, active: null };
  const playIn = (slotUniform, hasUniform, coverU, m) => {
    if (!m) { hasUniform.value = 0; return null; }
    const e = load(m);
    slotUniform.value = e.tex; hasUniform.value = 1;
    if (e.video) e.video.play().catch(() => {});
    coverK(coverU, e.aspect());
    return e;
  };
  const api = {
    mesh, uniforms,
    setBaseY(y) { basePos.y = y; mesh.position.y = y; },
    setProject(seed, media = []) {
      st.seed = seed; st.media = media; st.cursor = 0; st.clock = 0;
      uniforms.uSeed.value = seed * 3.0; uniforms.uCut.value = 0; uniforms.uMix.value = 1;
      st.active = playIn(uniforms.uA, uniforms.uHas, uniforms.uCoverA.value, media[0]);
    },
    update(dt, time, parallaxX = 0, parallaxY = 0) {
      uniforms.uTime.value = time;
      mesh.position.x = damp(mesh.position.x, basePos.x + parallaxX * 0.32, 4, dt);
      mesh.position.y = damp(mesh.position.y, basePos.y + parallaxY * 0.18, 4, dt);
      mesh.rotation.y = damp(mesh.rotation.y, parallaxX * 0.11 - 0.015, 4, dt);
      mesh.rotation.x = damp(mesh.rotation.x, -parallaxY * 0.05, 4, dt);
      mesh.rotation.z = 0.006;
      st.active?.video && coverK(uniforms.uCoverA.value, st.active.aspect());
      if (uniforms.uOpen.value < 0.5) return;
      st.clock += dt;
      const many = st.media.length > 1 || st.media.length === 0;
      if (many && st.clock > interval) {
        st.clock = 0;
        st.cursor++;
        // Hard cut with a very short dissolve, the way an edit reads.
        uniforms.uB.value = uniforms.uA.value; uniforms.uHasB.value = uniforms.uHas.value; uniforms.uCoverB.value.copy(uniforms.uCoverA.value);
        uniforms.uCut.value += 1;
        uniforms.uMix.value = 0;
        if (st.media.length) st.active = playIn(uniforms.uA, uniforms.uHas, uniforms.uCoverA.value, st.media[st.cursor % st.media.length]);
      }
      uniforms.uMix.value = Math.min(1, uniforms.uMix.value + dt * 7);
    },
    start(fn) { stage.start((dt, t) => { api.update(dt, t); fn && fn(dt, t, stage); }); },
    stage,
  };
  return api;
}
