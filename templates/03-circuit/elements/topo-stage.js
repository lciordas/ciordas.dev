import * as THREE from 'three';
import { buildFigure } from '../js/figure.js';
import { clamp, lerp, hexRGB, reduced, rem, fontsReady } from './_core.js';

const FULL_VERT = 'void main(){ gl_Position = vec4(position.xy, 0., 1.); }';

const MASK_FRAG = /* glsl */`
uniform sampler2D tPrev; uniform vec2 uRes; uniform vec2 uP; uniform vec2 uV; uniform float uStrength,uTime,uAspect;
float n2(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
 return mix(mix(n2(i),n2(i+vec2(1,0)),f.x),mix(n2(i+vec2(0,1)),n2(i+vec2(1,1)),f.x),f.y); }
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float e=.01, t=uTime*.12; vec2 q=uv*vec2(uAspect,1.)*3.2+t;
  vec2 curl=vec2(vn(q+vec2(0,e))-vn(q-vec2(0,e)), -(vn(q+vec2(e,0))-vn(q-vec2(e,0))))/(2.*e);
  float prev=texture2D(tPrev, uv-curl*.00085-uV*.012).r;
  float val=max(prev*.972-.0018,0.);
  vec2 d=(uv-uP)*vec2(uAspect,1.);
  // Long horizontal stroke, leaning with the direction of travel.
  float rx=.2+length(uV)*.18, ry=.055;
  float s=exp(-(d.x*d.x/(rx*rx)+d.y*d.y/(ry*ry)));
  val=max(val, s*uStrength);
  gl_FragColor=vec4(val,val,val,1.);
}`;

const STAGE_FRAG = /* glsl */`
uniform vec2 uRes; uniform float uDpr,uTime,uScroll,uTint,uFrameOn,uFigScale,uFocus,uHeroFade;
uniform vec4 uFrame; uniform vec3 uBg,uPaper,uTintCol;
uniform sampler2D tMask,tFig,tShell,tGhost,tM1,tM2;
uniform vec4 uM1,uM2; uniform float uMarq;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
 return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float field(vec2 p){ vec2 w=vec2(vn(p*.9+3.1),vn(p*.9+9.2)); p+=w*1.1; return .68*vn(p*1.05)+.32*vn(p*2.1+5.); }
float lum(vec3 c){ return dot(c,vec3(.299,.587,.114)); }
float contour(float h,float n,float wid){ float v=h*n; float a=abs(fract(v-.5)-.5)/max(fwidth(v),1e-4); return 1.-smoothstep(wid-.6,wid+.6,a); }
void main(){
  vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uDpr;
  vec2 res=uRes/uDpr;
  vec2 p=px/res.y;
  float h=field(p*2.05+vec2(.2,uScroll*.1));
  float lineK=contour(h,7.,.55);
  float L=lum(uBg);
  vec3 ink=L>.5?vec3(.19,.2,.16):vec3(.96,.96,.93);
  vec3 col=mix(uBg,ink,lineK*(L>.5?.1:.07));

  // Marquee rows run behind the frame.
  if(uMarq>.5){
    if(px.y>=uM1.x&&px.y<uM1.x+uM1.y){ vec2 u=vec2((px.x+uM1.z)/uM1.w,1.-(px.y-uM1.x)/uM1.y); vec4 t=texture2D(tM1,u); col=col*(1.-t.a)+t.rgb; }
    if(px.y>=uM2.x&&px.y<uM2.x+uM2.y){ vec2 u=vec2((px.x+uM2.z)/uM2.w,1.-(px.y-uM2.x)/uM2.y); vec4 t=texture2D(tM2,u); col=col*(1.-t.a)+t.rgb; }
  }

  if(uFrameOn>.5){
    vec2 c=uFrame.xy; vec2 s=uFrame.zw; vec2 loc=(px-c)/s;
    float inside=step(0.,loc.x)*step(loc.x,1.)*step(0.,loc.y)*step(loc.y,1.);
    if(inside>.5){
      vec3 fb=mix(uPaper,uTintCol,uTint);
      float m=texture2D(tMask,vec2(loc.x,1.-loc.y)).r;
      float kl=contour(h,7.,.55);
      float L2=lum(fb);
      fb=mix(fb,vec3(.2,.21,.17),kl*(.1*(1.-uTint)));
      // Camouflage patches open up along the contour bands where the pointer has passed.
      float pat=smoothstep(.0,.015,abs(fract(h*3.5+.15)-.5)-.2);
      float patm=smoothstep(.18,.3,m);
      fb=mix(fb,mix(vec3(.95,.95,.93),vec3(.89,.895,.875),pat),patm*(1.-uTint));
      vec3 c2=fb;
      vec2 fig=vec2(.5+(px.x-(c.x+s.x*.5))/(res.x*uFigScale),uFocus+(px.y-(c.y+s.y*.5))/(res.y*uFigScale));
      vec2 fuv=vec2(fig.x,1.-fig.y);
      float rows=floor(fig.y*res.y/15.);
      float rnd=h21(vec2(rows,floor(uTime*3.)*.0+1.))-.5;
      float reveal=smoothstep(.34,.42,m+rnd*.06);
      vec2 sluv=fuv+vec2(rnd*.05*smoothstep(.2,.45,m)*(1.-smoothstep(.75,1.,m)),0.);
      vec4 fi=texture2D(tFig,fuv);
      vec4 gh=texture2D(tGhost,fuv);
      vec4 sh=texture2D(tShell,sluv);
      vec3 under=c2*(1.-fi.a)+fi.rgb;
      float g=lum(under);
      vec3 toned=mix(under,vec3(g)*uTintCol*1.9,uTint*.86);
      vec3 f=toned;
      f=f*(1.-gh.a*(1.-uTint))+gh.rgb*(1.-uTint);
      f=mix(f,f*(1.-sh.a)+sh.rgb,reveal*(1.-uTint*.9));
      col=f;
    }
  }
  gl_FragColor=vec4(col,1.);
}`;

function drawRow(text, { font, color, letterSpacing = 0, h }) {
  const c = document.createElement('canvas'); const x = c.getContext('2d');
  x.font = font; if ('letterSpacing' in x) x.letterSpacing = `${letterSpacing}px`;
  const unit = `${text.toUpperCase()}   `;
  const w = Math.max(32, x.measureText(unit).width);
  const repeat = Math.max(1, Math.ceil(2800 / w));
  c.width = Math.ceil(w * repeat); c.height = Math.ceil(h);
  x.font = font; if ('letterSpacing' in x) x.letterSpacing = `${letterSpacing}px`;
  x.fillStyle = color; x.textBaseline = 'middle';
  for (let i = 0; i < repeat; i++) x.fillText(unit, i * w, h * 0.54);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.premultiplyAlpha = true;
  t.colorSpace = THREE.NoColorSpace;
  return { t, width: c.width };
}

/**
 * Full-viewport canvas behind the page: contour field, optional hero frame with pointer reveal, marquee rows.
 * mountTopoStage(canvas, { colors, frameTarget, rows, rowsEl, track, portrait, portraitReveal, getScroll })
 * Returns { setBg(rgb), setPaused(bool), setScroll... } or null when WebGL is unavailable.
 */
export function mountTopoStage(canvas, opts = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { document.documentElement.classList.add('no-gl'); return null; }
  if (!renderer.getContext()) { document.documentElement.classList.add('no-gl'); return null; }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = true;

  const hasFrame = !!opts.frameTarget;
  const colors = opts.colors || {};
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.Camera();

  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); blank.needsUpdate = true;
  const stage = new THREE.ShaderMaterial({
    vertexShader: FULL_VERT, fragmentShader: STAGE_FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      uRes: { value: new THREE.Vector2() }, uDpr: { value: 1 }, uTime: { value: 0 }, uScroll: { value: 0 },
      uTint: { value: 0 }, uFrameOn: { value: hasFrame ? 1 : 0 }, uFigScale: { value: 1 }, uFocus: { value: 0.5 }, uHeroFade: { value: 1 },
      uFrame: { value: new THREE.Vector4() },
      uBg: { value: new THREE.Vector3(...hexRGB(colors.ink || '#282c20')) },
      uPaper: { value: new THREE.Vector3(...hexRGB(colors.hero || '#fcfcfa')) },
      uTintCol: { value: new THREE.Vector3(0.42, 0.44, 0.38) },
      tMask: { value: blank }, tFig: { value: blank }, tShell: { value: blank }, tGhost: { value: blank }, tM1: { value: blank }, tM2: { value: blank },
      uM1: { value: new THREE.Vector4() }, uM2: { value: new THREE.Vector4() }, uMarq: { value: 0 },
    },
  });
  quad.material = stage;

  // Pointer-fed mask with a feedback loop.
  let maskA, maskB, maskMat, figRT, shellRT, ghostRT, figScene, figCam, figGroup, shellSolid, ghost, figBust;
  const pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, s: 0, last: -9, on: false, locked: false, tx: 0, ty: 0, mx: 0, my: 0 };
  if (hasFrame) {
    const mk = (w, h, o = {}) => new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, ...o });
    maskA = mk(320, 200); maskB = mk(320, 200);
    maskMat = new THREE.ShaderMaterial({
      vertexShader: FULL_VERT, fragmentShader: MASK_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tPrev: { value: null }, uRes: { value: new THREE.Vector2(320, 200) }, uP: { value: new THREE.Vector2(0.5, 0.5) }, uV: { value: new THREE.Vector2() }, uStrength: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1.6 } },
    });

    figScene = new THREE.Scene();
    figCam = new THREE.PerspectiveCamera(26, 1.6, 0.1, 60);
    figCam.position.set(0, -0.62, 8.5); figCam.lookAt(0, -0.62, 0);
    figGroup = new THREE.Group(); figScene.add(figGroup);
    if (opts.portrait) {
      // Real images: two aligned planes, fit by height and anchored to the bottom.
      const load = (src) => new Promise((r) => new THREE.TextureLoader().load(src, r));
      Promise.all([load(opts.portrait), load(opts.portraitReveal || opts.portrait)]).then(([a, b]) => {
        [a, b].forEach((t) => { t.colorSpace = THREE.NoColorSpace; });
        const ratio = a.image.width / a.image.height; const H = 3.92;
        const geo = new THREE.PlaneGeometry(H * ratio, H);
        figBust = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: a, transparent: true, toneMapped: false }));
        shellSolid = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: b, transparent: true, toneMapped: false }));
        figBust.position.y = shellSolid.position.y = -2.58 + H / 2;
        figGroup.add(figBust);
      });
    } else {
      const F = buildFigure({ shell: [colors.accent || '#d2ff00', '#111112'] });
      figBust = F.bust; shellSolid = F.solidShell; ghost = F.ghostShell;
      figGroup.add(figBust);
    }
  }

  // Marquee textures, rebuilt on resize at the current type size.
  let rows = null; const marq = { x1: 0, x2: 0 };
  const buildRows = () => {
    if (!opts.rows || !opts.rowsEl) return;
    const R = opts.rowsEl.getBoundingClientRect();
    const rh = R.height / 2; const dpr = renderer.getPixelRatio();
    const size = rh * 1.152 * dpr;
    const a = drawRow(opts.rows[0], { font: `400 ${size}px "Display Serif", serif`, color: colors.accentSoft || '#b2c73a', letterSpacing: -2.4 * dpr, h: rh * dpr * 1.04 });
    const b = drawRow(opts.rows[1], { font: `700 ${size * 0.96}px "Mona Sans", sans-serif`, color: colors.paper || '#f4f4ed', letterSpacing: -2 * dpr, h: rh * dpr * 1.04 });
    if (rows) { rows.a.t.dispose(); rows.b.t.dispose(); }
    rows = { a, b, rh: rh * 1.04, dpr };
    stage.uniforms.tM1.value = a.t; stage.uniforms.tM2.value = b.t;
    stage.uniforms.uMarq.value = 1;
  };

  const size = { w: 1, h: 1, dpr: 1 };
  const resize = () => {
    size.w = innerWidth; size.h = canvas.clientHeight || innerHeight; size.dpr = Math.min(devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(size.dpr); renderer.setSize(size.w, size.h, false);
    stage.uniforms.uRes.value.set(size.w * size.dpr, size.h * size.dpr); stage.uniforms.uDpr.value = size.dpr;
    if (hasFrame) {
      const W = size.w * size.dpr, H = size.h * size.dpr;
      const o = { depthBuffer: true, type: THREE.UnsignedByteType, samples: 4, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
      figRT?.dispose(); shellRT?.dispose(); ghostRT?.dispose();
      figRT = new THREE.WebGLRenderTarget(W, H, o); shellRT = new THREE.WebGLRenderTarget(W, H, o); ghostRT = new THREE.WebGLRenderTarget(W, H, o);
      figCam.aspect = size.w / size.h; figCam.updateProjectionMatrix();
      const tall = size.w / size.h < 1;
      figCam.position.set(0, tall ? 0.42 : -0.62, tall ? 10.6 : 8.5); figCam.lookAt(0, tall ? 0.42 : -0.62, 0);
      if (maskMat) maskMat.uniforms.uAspect.value = size.w / size.h;
    }
    fontsReady().then(buildRows);
  };
  resize();
  let rT; const onResize = () => { clearTimeout(rT); rT = setTimeout(resize, 120); };
  addEventListener('resize', onResize);

  const onMove = (e) => {
    pointer.tx = e.clientX; pointer.ty = e.clientY; pointer.last = clock; pointer.on = true;
    pointer.mx = (e.clientX / innerWidth) * 2 - 1; pointer.my = (e.clientY / innerHeight) * 2 - 1;
  };
  if (hasFrame) addEventListener('pointermove', onMove, { passive: true });

  let clock = 0; let prevNow = performance.now(); let raf = 0; let running = true;
  let scanT = 0; let scanY = -1; const smooth = { rx: 0, ry: 0 };
  const bg = stage.uniforms.uBg.value;
  const motion = !reduced();

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - prevNow) / 1000); prevNow = now;
    if (!running) return;
    clock += dt;
    const sy = opts.getScroll ? opts.getScroll() : window.scrollY;
    const vh = size.h, vw = size.w;
    stage.uniforms.uTime.value = clock;
    stage.uniforms.uScroll.value = sy / vh;

    if (hasFrame) {
      const p = clamp(sy / vh);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const r = opts.frameTarget.getBoundingClientRect();
      const fx = lerp(0, r.left, e), fy = lerp(0, r.top, e), fw = lerp(vw, r.width, e), fh = lerp(vh, r.height, e);
      stage.uniforms.uFrame.value.set(fx, fy, fw, fh);
      stage.uniforms.uTint.value = clamp((p - 0.18) / 0.62);
      stage.uniforms.uFigScale.value = lerp(1, 0.49, e);
      stage.uniforms.uFocus.value = lerp(0.5, 0.44, e);
      const visible = fy + fh > -20;
      stage.uniforms.uFrameOn.value = visible ? 1 : 0;

      if (visible) {
        // Idle sweep: when the pointer rests, a stroke travels down the figure.
        let sx, syy, strength = 0;
        if (pointer.on && clock - pointer.last < 2.4) {
          sx = (pointer.tx - fx) / Math.max(1, fw); syy = 1 - (pointer.ty - fy) / Math.max(1, fh); strength = clock - pointer.last < 0.5 ? 0.95 : 0;
          scanY = -1;
        } else if (motion) {
          scanT += dt; if (scanY < 0 && scanT > 1.1) { scanY = 0; scanT = 0; }
          if (scanY >= 0) {
            scanY = scanT / 3.0;
            sx = 0.5 + Math.sin(scanT * 1.7) * 0.05; syy = 0.86 - scanY * 0.78; strength = scanY < 1 ? 0.95 : 0;
            if (scanY >= 1) { scanY = -1; scanT = -1.4; }
          } else { sx = 0.5; syy = 0.5; }
        } else { sx = 0.5; syy = 0.5; }
        const u = maskMat.uniforms;
        const vx = clamp(sx - pointer.px, -0.2, 0.2), vyy = clamp(syy - pointer.py, -0.2, 0.2);
        pointer.px = lerp(pointer.px, sx, 0.25); pointer.py = lerp(pointer.py, syy, 0.25);
        u.uP.value.set(pointer.px, pointer.py); u.uV.value.set(vx, vyy); u.uStrength.value = strength; u.uTime.value = clock; u.tPrev.value = maskA.texture;
        quad.material = maskMat;
        renderer.setRenderTarget(maskB); renderer.render(scene, cam);
        const swap = maskA; maskA = maskB; maskB = swap;
        stage.uniforms.tMask.value = maskA.texture;

        // Figure layers.
        smooth.rx = lerp(smooth.rx, pointer.my * 0.09, 0.06); smooth.ry = lerp(smooth.ry, pointer.mx * 0.34, 0.06);
        if (figBust) {
          figGroup.rotation.set(0, 0, 0);
          figBust.rotation.set(0, 0, 0);
          if (!opts.portrait) { figBust.children[1].rotation.set(smooth.rx * 0.5, smooth.ry * 0.3, 0); }
          const clear = () => { renderer.setClearColor(0, 0); renderer.clear(); };
          renderer.setRenderTarget(figRT); clear(); renderer.render(figScene, figCam);
          if (shellSolid) {
            const swapIn = (m) => { figGroup.remove(figBust); figGroup.add(m); };
            const swapOut = (m) => { figGroup.remove(m); figGroup.add(figBust); };
            shellSolid.rotation.set(smooth.rx, opts.portrait ? 0 : smooth.ry, 0);
            swapIn(shellSolid); renderer.setRenderTarget(shellRT); clear(); renderer.render(figScene, figCam); swapOut(shellSolid);
            stage.uniforms.tShell.value = shellRT.texture;
            if (ghost) {
              ghost.rotation.set(smooth.rx, smooth.ry, 0);
              swapIn(ghost); renderer.setRenderTarget(ghostRT); clear(); renderer.render(figScene, figCam); swapOut(ghost);
              stage.uniforms.tGhost.value = ghostRT.texture;
            }
          }
          stage.uniforms.tFig.value = figRT.texture;
        }
        renderer.setClearColor(0, 1);
      }

      if (rows) {
        const rr = opts.rowsEl.getBoundingClientRect();
        const vel = opts.getVelocity ? opts.getVelocity() : 0;
        marq.x1 += dt * 70 + vel * 0.5; marq.x2 -= dt * 70 + vel * 0.5;
        const k = rows.dpr;
        stage.uniforms.uM1.value.set(rr.top - rows.rh * 0.02, rows.rh, marq.x1, rows.a.width / k);
        stage.uniforms.uM2.value.set(rr.top + rows.rh * 0.94, rows.rh, marq.x2, rows.b.width / k);
        stage.uniforms.uMarq.value = rr.bottom > -40 && rr.top < vh ? 1 : 0;
      }
    }
    quad.material = stage;
    renderer.setRenderTarget(null);
    renderer.render(scene, cam);
  };
  raf = requestAnimationFrame(frame);

  return {
    setBg(rgb) { bg.set(rgb[0], rgb[1], rgb[2]); },
    setPaused(v) { running = !v; },
    setPointer(x, y) { pointer.tx = x; pointer.ty = y; pointer.last = clock; pointer.on = true; },
    rebuildRows: buildRows,
    destroy() { cancelAnimationFrame(raf); removeEventListener('resize', onResize); removeEventListener('pointermove', onMove); renderer.dispose(); },
  };
}
