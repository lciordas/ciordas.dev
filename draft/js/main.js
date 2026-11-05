import * as THREE from 'three';
import { REDUCED, damp, clamp, lerp, paletteUniforms, hasWebGL } from './_util.js';
import { mountFilmPost } from './film-post.js';
import { mountRenderWindows } from './render-windows.js';
import { mountTrace } from './trace.js';
import { mountName, DEPTH } from './name.js';
import { bakeSurface } from './bake.js';

const gsap = window.gsap;
const params = new URLSearchParams(location.search);
const FONT_KEYS = ['barlow', 'shoulders', 'teko', 'inter', 'anton'];
const fontKey = FONT_KEYS.includes(params.get('font')) ? params.get('font') : 'barlow';
const STYLE = params.get('style');
const skipIntro = params.has('skip') || REDUCED || !!STYLE;

const PALETTE = { top: '#090706', mid: '#181310', haze: '#32271e', low: '#7a4a24', pale: '#f4e6cd', stone: '#b2663a', deep: '#5a0f06', shard: '#cdb596' };

const $ = (id) => document.getElementById(id);
const canvas = $('gl'), enterBtn = $('enter'), portfolio = $('portfolio'), replay = $('replay'), fallback = $('fallback');
replay.addEventListener('click', () => { location.href = location.pathname + (params.get('font') ? `?font=${params.get('font')}` : ''); });

const showPortfolio = () => {
  portfolio.hidden = false;
  document.body.classList.remove('is-intro'); document.body.classList.add('is-portfolio');
  gsap.fromTo(portfolio.children, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.09 });
};

if (!hasWebGL()) {
  // Without 3D the name is plain text, and clicking it fades straight to the portfolio.
  canvas.style.display = 'none'; fallback.hidden = false;
  gsap.from(fallback.children, { opacity: 0, y: 18, duration: 1, stagger: 0.12, ease: 'power3.out' });
  Object.assign(enterBtn.style, { inset: '0', width: '100%', height: '100%' }); enterBtn.hidden = false;
  enterBtn.addEventListener('click', () => { enterBtn.hidden = true; gsap.to(fallback, { opacity: 0, duration: 0.5, onComplete: () => { fallback.hidden = true; showPortfolio(); } }); });
} else {
  start(await (await fetch(`data/name-${fontKey}.json`)).json());
}

function start(data) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 120);
  const palU = paletteUniforms(PALETTE);

  // Backdrop: near black with a faint warm haze behind the name.
  const skyU = { ...palU, uLift: { value: 0 }, uGlow: { value: 0 }, uMouse: { value: new THREE.Vector2() }, uAspect: { value: 1 } };
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: skyU, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,.9999,1.); }',
    fragmentShader: `precision highp float; varying vec2 vUv; uniform vec3 p_top,p_mid,p_haze; uniform float uLift,uGlow,uAspect; uniform vec2 uMouse;
      void main(){
        vec2 p=(vUv-.5)*vec2(uAspect,1.)-uMouse*vec2(.03,.02);
        float r=length(p*vec2(.72,1.05));
        vec3 c=mix(p_mid,p_top,smoothstep(.02,.8,r));
        c=mix(c,p_haze,exp(-r*r*5.2)*(.2+.28*uGlow));
        c+=p_haze*uLift*exp(-r*r*1.6)*.62;
        gl_FragColor=vec4(c,1.);
      }`,
  }));
  sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

  const baked = bakeSurface(renderer, data);
  const name = mountName(scene, data, palU, baked);
  const post = mountFilmPost(renderer, { bloom: 0.2, threshold: 1 });

  const windows = mountRenderWindows(renderer, {
    drawMode(mode) {
      const skyV = sky.visible; sky.visible = false;
      name.setMode(mode);
      renderer.render(scene, camera);
      name.setMode('beauty');
      sky.visible = skyV;
    },
  });

  const S = { w: 1, h: 1, dpr: 1, time: 0, phase: 'loading', visW: 7, visH: 4, camZ: 10, mx: 0, my: 0, tmx: 0, tmy: 0, shake: 0, punch: 0, windowsAt: 0, backdrop: null };
  const trace = skipIntro ? null : mountTrace(document.body, data.letters);
  const toPx = (x, y) => [S.w / 2 + (x / S.visW) * S.w, S.h / 2 - (y / S.visH) * S.h];

  const resize = () => {
    S.w = innerWidth; S.h = innerHeight;
    S.dpr = Math.min(devicePixelRatio || 1, S.w < 768 ? 1.5 : 2);
    renderer.setPixelRatio(S.dpr); renderer.setSize(S.w, S.h, false);
    const aspect = S.w / S.h;
    camera.aspect = aspect;
    // Fit the block of the name: limited by height on wide screens and by width on narrow ones.
    const fitH = data.height / 0.62, fitW = data.width / (aspect < 0.9 ? 0.88 : 0.72);
    S.visH = Math.max(fitH, fitW / aspect); S.visW = S.visH * aspect;
    S.camZ = DEPTH / 2 + S.visH / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.set(0, 0, S.camZ); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
    skyU.uAspect.value = aspect;
    post.resize(S.w, S.h, S.dpr);
    windows.layout(S.w, S.h, S.dpr);
    name.setView(S.visW, S.visH);
    name.uniforms.uRes.value.set(S.dpr, S.dpr);
    trace?.layout(S.w, S.h, S.dpr, toPx);
    const [l, t] = toPx(-data.width / 2, data.height / 2), [r, b] = toPx(data.width / 2, -data.height / 2);
    const pad = 10;
    Object.assign(enterBtn.style, { left: `${l - pad}px`, top: `${t - pad}px`, width: `${r - l + pad * 2}px`, height: `${b - t + pad * 2}px` });
  };
  resize();
  addEventListener('resize', resize);

  /* Pointer */
  const toWorld = (cx, cy) => [((cx / S.w) - 0.5) * S.visW, (0.5 - cy / S.h) * S.visH];
  addEventListener('pointermove', (e) => {
    S.tmx = (e.clientX / S.w) * 2 - 1; S.tmy = -((e.clientY / S.h) * 2 - 1);
    const [x, y] = toWorld(e.clientX, e.clientY);
    const touch = e.pointerType === 'touch';
    name.setPointer(x, y, !touch);
    if (!touch && name.st.phase === 'float') { name.uniforms.uHot.value.lerp(new THREE.Vector2(x, y), 0.35); }
  });
  enterBtn.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') { name.setHover(true); S.hotT = 0.42; } });
  enterBtn.addEventListener('pointerleave', () => { name.setHover(false); S.hotT = 0; });
  enterBtn.addEventListener('focus', () => { if (enterBtn.matches(':focus-visible')) name.setHover(true); });
  enterBtn.addEventListener('blur', () => name.setHover(false));

  /* Shatter */
  const shatter = (x, y) => {
    if (S.phase !== 'ready') return;
    S.phase = 'shatter';
    enterBtn.hidden = true; S.hotT = 0; name.setHover(false);
    if (REDUCED) {
      gsap.to(name.uniforms.uFade, { value: 0, duration: 0.01 });
      name.root.visible = false; showPortfolio(); S.phase = 'portfolio';
      return;
    }
    name.crack(x, y);
    const heat = name.uniforms.uHotAmt;
    const tl = gsap.timeline();
    // Cracks race out from the click while the name tenses backward.
    tl.to(name.crackU.uAmt, { value: 1, duration: 0.08 }, 0);
    tl.to(name.crackU.uR, { value: 5.2, duration: 0.62, ease: 'power2.in' }, 0);
    tl.to(heat, { value: 0.72, duration: 0.5, ease: 'power2.in' }, 0);
    tl.to(name.uniforms.uHotSize, { value: 0.8, duration: 0.6, ease: 'power2.in' }, 0);
    tl.to(name.crackU.uFlare, { value: 1, duration: 0.11, ease: 'power2.in' }, 0.51);
    tl.to(S, { punch: -0.16, duration: 0.6, ease: 'power2.in' }, 0);
    tl.to(S, { shake: 0.022, duration: 0.6, ease: 'power3.in' }, 0);
    tl.add(() => {
      name.burst();
      name.halo.visible = false;
      heat.value = 0;
      name.uniforms.uHotSize.value = 0.42;
    }, 0.62);
    tl.to(S, { punch: 0.24, duration: 0.22, ease: 'expo.out' }, 0.62);
    tl.to(S, { punch: 0, duration: 1.3, ease: 'power3.inOut' }, 0.86);
    tl.to(S, { shake: 0, duration: 0.8, ease: 'power2.out' }, 0.62);
    tl.fromTo(skyU.uLift, { value: 0 }, { value: 1.25, duration: 0.14, ease: 'power2.out' }, 0.62);
    tl.to(skyU.uLift, { value: 0.2, duration: 1.7, ease: 'power2.out' }, 0.76);
    tl.fromTo(post.uniforms.uBloom, { value: 0.2 }, { value: 1.5, duration: 0.1 }, 0.62);
    tl.to(post.uniforms.uBloom, { value: 0.2, duration: 1, ease: 'power2.out' }, 0.72);
    tl.to(name.uniforms.uMatte, { value: 0.42, duration: 1.2, ease: 'power2.out' }, 0.62);
    tl.add(() => { showPortfolio(); S.phase = 'portfolio'; }, 1.5);
  };
  enterBtn.addEventListener('click', (e) => {
    // Keyboard presses report no position, so they break from the middle of the name.
    const [x, y] = e.detail ? toWorld(e.clientX, e.clientY) : [0, 0];
    shatter(x, y);
  });

  /* Intro */
  const ready = () => {
    S.phase = 'ready';
    post.uniforms.uDissolve.value = 1;
    trace?.destroy();
    name.setActive(1);
    enterBtn.hidden = false;
    name.st.nudgeAt = S.time + 2.2;
  };
  const runIntro = () => {
    if (skipIntro) { gsap.fromTo(post.uniforms.uBlack, { value: 1 }, { value: 0, duration: REDUCED ? 0.01 : 0.6 }); skyU.uGlow.value = 1; ready(); if (REDUCED) name.setActive(0); return; }
    S.phase = 'trace';
    trace.set(0);
    const d = { p: 0 };
    const tl = gsap.timeline({ delay: 0.3 });
    tl.to(d, { p: 1, duration: 3.6, ease: 'none', onUpdate: () => trace.set(d.p) });
    tl.to({}, { duration: 0.28 });
    tl.add(() => {
      const c = trace.snapshot();
      S.backdrop = new THREE.CanvasTexture(c); S.backdrop.colorSpace = THREE.NoColorSpace; S.backdrop.minFilter = THREE.LinearFilter; S.backdrop.generateMipmaps = false;
      trace.hide();
      S.phase = 'windows'; S.windowsAt = S.time;
      post.uniforms.uDissolve.value = 0;
      // The letters are already swaying when the first window opens onto them.
      name.settleIn();
      name.st.nudgeAt = Infinity;
      name.setActive(1);
    });
    tl.to({}, { duration: 2.15 });
    tl.add(() => { S.phase = 'dissolve'; });
    tl.fromTo(post.uniforms.uDissolve, { value: 0 }, { value: 1, duration: 1.05, ease: 'none' });
    tl.to(skyU.uGlow, { value: 1, duration: 1.4, ease: 'power2.out' }, '-=1.05');
    tl.add(() => { S.backdrop?.dispose(); S.backdrop = null; ready(); });
  };

  /* Frame */
  const clock = new THREE.Clock();
  let frames = 0, fpsT = 0;
  const frame = () => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    S.time += dt;
    const t = S.time;
    frames++; fpsT += dt; if (fpsT > 1) { window.__fps = frames / fpsT; frames = 0; fpsT = 0; }

    S.mx = damp(S.mx, S.tmx, 3, dt); S.my = damp(S.my, S.tmy, 3, dt);
    name.st.mx = S.mx; name.st.my = S.my;
    skyU.uMouse.value.set(S.mx, S.my);
    if (S.phase === 'ready') skyU.uGlow.value = 1 + (name.st.pulse || 0) * 0.35;
    if (S.phase === 'ready' || S.phase === 'portfolio') {
      if (name.st.phase === 'float') name.uniforms.uHotAmt.value = damp(name.uniforms.uHotAmt.value, S.hotT || 0, 5, dt);
    }
    name.update(dt, t);

    camera.position.set(
      S.mx * (name.st.phase === 'burst' ? 0.14 : 0.05) + (S.shake ? (Math.sin(t * 91) + Math.sin(t * 57)) * S.shake : 0),
      S.my * (name.st.phase === 'burst' ? 0.09 : 0.03) + (S.shake ? (Math.cos(t * 83) + Math.sin(t * 43)) * S.shake : 0),
      S.camZ * (1 - S.punch * 0.12),
    );
    camera.lookAt(0, 0, 0);

    // Shows one window style across the whole screen, for choosing between them.
    if (STYLE && STYLE !== 'beauty') {
      const slot = windows.items.find((i) => i.mode === STYLE);
      sky.visible = false; name.setMode(STYLE);
      renderer.setRenderTarget(null); renderer.setClearColor(new THREE.Color(slot?.bg || '#000'), 1); renderer.clear();
      renderer.render(scene, camera);
      name.setMode('beauty'); sky.visible = true;
      return;
    }
    if (S.phase === 'loading' || S.phase === 'trace') {
      renderer.setRenderTarget(null); renderer.setClearColor(0x030303, 1); renderer.clear();
      return;
    }
    renderer.setRenderTarget(post.main);
    renderer.setClearColor(0x000000, 1); renderer.clear();
    renderer.render(scene, camera);
    post.bloomPass();
    if (S.phase === 'windows' || S.phase === 'dissolve') windows.render(t - S.windowsAt, post.stage, post.main.texture, S.backdrop);
    post.present(t);
  };
  window.__draft = { S, name, post, trace, windows, fps: () => window.__fps };

  document.fonts.load('10px "Hanken Grotesk"').catch(() => {}).finally(() => {
    resize();
    frame();
    runIntro();
  });
}
