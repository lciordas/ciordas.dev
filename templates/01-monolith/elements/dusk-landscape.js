// dusk-landscape: procedural sky, hazy hills, spiky plants, tidal pools with a true
// mirror reflection, and small flying birds. Every colour follows one palette.
import * as THREE from 'three';
import { mergeBufferGeometries } from './_merge.js';
import { GLSL_NOISE, rng, fbm2, smooth, ensureStage, paletteUniforms, vnoise3 } from './_util.js';

export function terrainHeight(x, z) {
  const dn = Math.hypot(x, z > 0 ? z * 0.42 : z * 1.1) + (fbm2(x * 0.22 + 7, z * 0.22 + 2, 3) - 0.5) * 6.5;
  // Low sandbanks broken up by pools.
  const flats = (fbm2(x * 0.15 + 5.2, z * 0.26 + 1.3, 4) - 0.42) * 1.0;
  let h = flats * smooth(1.4, 4.4, dn) - 0.07 * (1 - smooth(1.2, 3.4, dn));
  // Mid-distance dark hills.
  const hillMask = smooth(-5.2, -10.5, z + (fbm2(x * 0.06, 3.3, 3) - 0.5) * 9);
  h = h * (1 - hillMask * 0.6) + hillMask * (0.45 + fbm2(x * 0.075 + 11, z * 0.11 + 3, 3) * 1.65);
  // Far ridges that fade into the haze.
  const far = smooth(-17, -27, z);
  h += far * (fbm2(x * 0.05 + 2, z * 0.05 + 8, 3) * 4.4 - 0.5);
  return h;
}

const FOG = /* glsl */`
vec3 applyFog(vec3 col, vec3 wp, vec3 cam){
  float d=distance(wp,cam);
  float f=1.-exp(-pow(d/36.,3.0));
  f=max(f,smoothstep(38.,80.,d));
  return mix(col,p_haze,clamp(f,0.,1.));
}`;
const PAL = /* glsl */`uniform vec3 p_top,p_mid,p_haze,p_low,p_pale,p_stone,p_deep,p_shard;`;

export function mountDuskLandscape(container, options = {}) {
  const { palette = {}, plants = 170, birds = 6, seed = 5 } = options;
  const stage = options.scene ? null : ensureStage(container, { position: [0, 2.2, 11], look: [0, 2.9, 0] });
  const parent = options.scene || stage.scene;
  const shared = options.paletteUniforms || paletteUniforms({ top: '#170505', mid: '#452019', haze: '#6d4b31', low: '#4a3220', pale: '#ffe2cf', stone: '#dc6e4d', deep: '#8d1d12', shard: '#d2ae8e', ...palette });
  const u = { ...shared, uTime: { value: 0 }, uMirror: { value: 0 }, uMirrorTex: { value: null }, uFlood: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } };
  const root = new THREE.Group();
  parent.add(root);
  const R = rng(seed);

  // Sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: u,
    vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); vec4 p=projectionMatrix*mat4(mat3(viewMatrix))*vec4(position,1.); gl_Position=p.xyww; }`,
    fragmentShader: `precision highp float; varying vec3 vD; uniform float uTime; ${PAL} ${GLSL_NOISE}
      void main(){ vec3 d=normalize(vD); float e=d.y;
        vec3 c=mix(p_haze*1.2,p_mid,smoothstep(.04,.2,e));
        c=mix(c,p_top,smoothstep(.14,.36,e));
        float cl=fbm(vec3(d.x*7.,d.y*22.,uTime*.012));
        c*=.93+.14*cl;
        // A pale veiled disc high on the left.
        vec2 q=vec2((d.x+.35)/.34,(e-.235)/.145);
        float disc=smoothstep(1.,.2,length(q));
        c+=p_haze*.13*disc*(.6+.5*cl);
        gl_FragColor=vec4(c,1.); }`,
  }));
  sky.frustumCulled = false; sky.renderOrder = -10;
  parent.add(sky);

  // Terrain
  const size = 170, seg = 340;
  const tg = new THREE.PlaneGeometry(size, size, seg, seg);
  tg.rotateX(-Math.PI / 2);
  tg.translate(0, 0, -size / 2 + 26);
  const tp = tg.attributes.position.array;
  for (let i = 0; i < tp.length; i += 3) tp[i + 1] = terrainHeight(tp[i], tp[i + 2]);
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `varying vec3 vW,vN; varying float vH; uniform float uFlood; void main(){ vec3 p=position; p.y=p.y*(1.-uFlood*.86)-uFlood*.16; vH=p.y; vN=mix(normal,vec3(0.,1.,0.),uFlood); vW=(modelMatrix*vec4(p,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);} `,
    fragmentShader: `precision highp float; varying vec3 vW,vN; varying float vH; uniform float uMirror; ${PAL} ${GLSL_NOISE} ${FOG}
      void main(){
        if(uMirror>.5&&vH<.0) discard;
        vec3 N=normalize(vN);
        vec3 wp=vec3(vW.x,abs(vW.y),vW.z);
        float n=fbm(vec3(wp.x*.8,wp.z*1.4,1.));
        float fine=vnoise(vec3(wp.x*6.,wp.z*9.,4.));
        vec3 sand=mix(p_mid,p_haze,.3)*1.42;
        vec3 soil=p_low*.14;
        // Hills read as dark backlit forms, flats near the water catch the sky.
        float flatness=smoothstep(.72,.99,N.y);
        float nearWater=1.-smoothstep(.04,.55,vH);
        vec3 c=mix(soil,sand,flatness*nearWater*(.5+.65*n));
        c*=.86+.26*fine;
        // Wet dark rim right where sand meets water.
        c=mix(c,p_low*.32,smoothstep(.055,.0,vH)*.75);
        // Bright thin line at the waterline.
        c+=p_haze*.1*smoothstep(.016,.0,abs(vH-.042));
        vec3 cam=cameraPosition;
        gl_FragColor=vec4(applyFog(c,wp,cam),1.);
      }`,
  }));
  terrain.frustumCulled = false; terrain.layers.enable(1);
  root.add(terrain);

  // Water
  const water = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2).translate(0, 0, -size / 2 + 26), new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `varying vec3 vW; varying vec4 vP; void main(){ vW=(modelMatrix*vec4(position,1.)).xyz; vP=projectionMatrix*viewMatrix*vec4(vW,1.); gl_Position=vP; }`,
    fragmentShader: `precision highp float; varying vec3 vW; varying vec4 vP; uniform sampler2D uMirrorTex; uniform float uTime,uFlood; ${PAL} ${GLSL_NOISE} ${FOG}
      void main(){
        vec2 uv=vP.xy/vP.w*.5+.5;
        vec3 V=normalize(cameraPosition-vW);
        float rip=vnoise(vec3(vW.x*2.6,vW.z*6.5,uTime*.45))-.5;
        float rip2=vnoise(vec3(vW.x*7.,vW.z*18.,uTime*.8))-.5;
        vec2 ofs=vec2((rip+rip2*.6)*.012,(rip*.9+rip2)*.022*(1.+vW.z*.02));
        vec4 m=texture2D(uMirrorTex,uv+ofs);
        float fres=.62+.38*pow(1.-clamp(V.y,0.,1.),2.4);
        vec3 refl=mix(p_low*.26,p_mid*.92,smoothstep(.62,.98,fres));
        refl*=mix(1.,.5+1.05*fbm(vec3(vW.x*.2,vW.z*.42,3.)),uFlood);
        refl=mix(refl,m.rgb,m.a);
        vec3 deep=p_low*.12;
        vec3 c=mix(deep,refl,fres);
        gl_FragColor=vec4(applyFog(c,vW,cameraPosition),1.);
      }`,
  }));
  water.frustumCulled = false; water.position.y = 0;
  root.add(water);

  // Plants: fans of tapered, drooping blades.
  const blade = (angle, len, lean, width) => {
    const g = new THREE.PlaneGeometry(width, len, 1, 6);
    g.translate(0, len / 2, 0);
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const t = p[i + 1] / len;
      p[i] *= (1 - t) * (1 - t * 0.2) + 0.02;
      p[i + 2] = lean * t * t * len;
      p[i + 1] *= 1 - lean * 0.34 * t;
    }
    g.rotateY(angle);
    return g;
  };
  const parts = [];
  const r2 = rng(seed + 3);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r2() * 0.6;
    const central = i < 3;
    parts.push(blade(a, central ? 1.55 + r2() * 0.75 : 1.0 + r2() * 0.5, central ? 0.14 + r2() * 0.14 : 0.85 + r2() * 0.65, central ? 0.46 : 0.36));
  }
  const plantGeo = mergeBufferGeometries(parts);
  const plantMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: u,
    vertexShader: `varying vec3 vW; varying float vT; uniform float uTime,uFlood; void main(){ vec4 w=modelMatrix*instanceMatrix*vec4(position*(1.-uFlood),1.); w.y-=uFlood*1.5; w.x+=sin(uTime*.7+w.z*.4+w.x)*.03*position.y; vW=w.xyz; vT=position.y; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `precision highp float; varying vec3 vW; varying float vT; uniform float uMirror; ${PAL} ${FOG}
      void main(){ vec3 wp=vec3(vW.x,abs(vW.y),vW.z); vec3 c=p_low*.1*(.8+vT*.25); gl_FragColor=vec4(applyFog(c,wp,cameraPosition),1.); }`,
  });
  const positions = [];
  for (let i = 0; i < plants * 40 && positions.length < plants * 0.42; i++) {
    const x = (R() - 0.5) * 72, z = 3 - R() * 58;
    const h = terrainHeight(x, z);
    if (h < 0.28 || Math.hypot(x, z) < 6.4) continue;
    if (fbm2(x * 0.14 + 40, z * 0.14, 2) < 0.5) continue; // clumps
    positions.push([x, h - 0.04, z, 0.5 + R() * 0.55]);
  }
  // A few large plants placed by hand so the mid-ground always has a strong silhouette.
  for (const [x, z, sc] of [[3.9, -7.8, 0.72], [5.3, -8.6, 1.05], [6.9, -7.6, 0.8], [8.6, -9.2, 1.25], [10.8, -8.2, 0.8], [-4.6, -9.2, 0.62], [-6.6, -8.3, 0.85], [-12, -8.8, 0.8], [13.2, -10, 1.05]]) {
    positions.push([x, Math.max(0, terrainHeight(x, z)) - 0.05, z, sc]);
  }
  const plantMesh = new THREE.InstancedMesh(plantGeo, plantMat, positions.length);
  const dummy = new THREE.Object3D();
  positions.forEach((p, i) => {
    dummy.position.set(p[0], p[1], p[2]);
    dummy.rotation.y = R() * 6.28;
    dummy.scale.setScalar(p[3]);
    dummy.updateMatrix();
    plantMesh.setMatrixAt(i, dummy.matrix);
  });
  plantMesh.frustumCulled = false; plantMesh.layers.enable(1);
  root.add(plantMesh);

  // Birds
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -1, 0, 0.1, -0.35, 0, -0.26, 0, 0, 0, 1, 0, 0.1, 0.35, 0, -0.26], 3));
  const birdMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: { ...u },
    vertexShader: `attribute float aPhase; varying float vX; uniform float uTime; void main(){ vec3 p=position; float f=sin(uTime*7.+aPhase*6.)*.42; p.y+=abs(p.x)*f; vec4 w=modelMatrix*instanceMatrix*vec4(p,1.); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 p_top,p_mid; void main(){ gl_FragColor=vec4(mix(p_top,p_mid,.35)*.62,1.); }`,
  });
  const birdMesh = new THREE.InstancedMesh(birdGeo, birdMat, birds);
  const phases = new Float32Array(birds);
  const birdS = [];
  for (let i = 0; i < birds; i++) {
    phases[i] = R();
    birdS.push({ a: R() * 6.28, r: 14 + R() * 26, y: 6.6 + R() * 7.4, z: -12 - R() * 22, sp: (0.018 + R() * 0.02) * (R() < 0.5 ? -1 : 1), s: 0.18 + R() * 0.12 });
  }
  birdGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  birdMesh.frustumCulled = false;
  root.add(birdMesh);

  const mirrorRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true, samples: 0 });
  u.uMirrorTex.value = mirrorRT.texture;
  const clearC = new THREE.Color();

  const api = {
    root, uniforms: u, sky,
    setFlood(v) { u.uFlood.value = v; plantMesh.visible = v < 0.97; },
    resize(w, h) { mirrorRT.setSize(Math.max(2, Math.floor(w / 2)), Math.max(2, Math.floor(h / 2))); },
    // Renders everything on camera layer 1 upside down, for the pools to sample.
    renderMirror(renderer, scene, camera) {
      const prev = renderer.getRenderTarget(), prevAlpha = renderer.getClearAlpha();
      renderer.getClearColor(clearC);
      const skyVis = sky.visible;
      sky.visible = false;
      root.scale.y = -1;
      (options.mirrorExtra || []).forEach((o) => { o.scale.y = -Math.abs(o.scale.y); o.updateMatrixWorld(true); });
      root.updateMatrixWorld(true);
      u.uMirror.value = 1;
      camera.layers.set(1);
      renderer.setRenderTarget(mirrorRT);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      camera.layers.set(0);
      u.uMirror.value = 0;
      root.scale.y = 1;
      (options.mirrorExtra || []).forEach((o) => { o.scale.y = Math.abs(o.scale.y); o.updateMatrixWorld(true); });
      root.updateMatrixWorld(true);
      sky.visible = skyVis;
      renderer.setRenderTarget(prev);
      renderer.setClearColor(clearC, prevAlpha);
    },
    update(dt, time) {
      u.uTime.value = time;
      birdS.forEach((b, i) => {
        b.a += b.sp * dt * 2.2;
        dummy.position.set(Math.cos(b.a) * b.r, b.y + Math.sin(b.a * 3) * 0.5, b.z + Math.sin(b.a) * 6);
        dummy.rotation.set(0.15, -b.a + (b.sp > 0 ? 0 : Math.PI), 0);
        dummy.scale.setScalar(b.s);
        dummy.updateMatrix();
        birdMesh.setMatrixAt(i, dummy.matrix);
      });
      birdMesh.instanceMatrix.needsUpdate = true;
    },
    start(fn) {
      stage.start((dt, t) => {
        api.update(dt, t);
        const s = stage.renderer.getSize(new THREE.Vector2());
        if (mirrorRT.width !== Math.floor(s.x / 2)) api.resize(s.x, s.y);
        api.renderMirror(stage.renderer, stage.scene, stage.camera);
        fn && fn(dt, t, stage);
      });
    },
    stage,
  };
  return api;
}
