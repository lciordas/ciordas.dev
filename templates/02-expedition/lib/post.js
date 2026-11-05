// Scene buffer -> soft bloom -> final pass with spectral smear, panel darkening, grain and dot grid.
import * as THREE from 'three';
import { NOISE } from './glsl.js';

const VERT = `varying vec2 vUv; void main(){ vUv=position.xy*.5+.5; gl_Position=vec4(position.xy,0.,1.); }`;

const PRE = `varying vec2 vUv; uniform sampler2D t; uniform float uTh;
void main(){ vec3 c=texture2D(t,vUv).rgb; float l=max(c.r,max(c.g,c.b)); if(!(l==l)||l>1e4){ c=vec3(0.); l=0.; } float k=smoothstep(uTh,uTh*1.8,l); c=min(c,vec3(9.)); gl_FragColor=vec4(c*k,1.); }`;
const DOWN = `varying vec2 vUv; uniform sampler2D t; uniform vec2 uPx;
void main(){ vec2 p=uPx; vec3 c=texture2D(t,vUv).rgb*4.;
 c+=texture2D(t,vUv+vec2(-p.x,-p.y)).rgb+texture2D(t,vUv+vec2(p.x,-p.y)).rgb+texture2D(t,vUv+vec2(-p.x,p.y)).rgb+texture2D(t,vUv+vec2(p.x,p.y)).rgb;
 gl_FragColor=vec4(c/8.,1.); }`;
const UP = `varying vec2 vUv; uniform sampler2D t; uniform vec2 uPx;
void main(){ vec2 p=uPx*.5; vec3 c=vec3(0.);
 c+=texture2D(t,vUv+vec2(-2.*p.x,0.)).rgb+texture2D(t,vUv+vec2(2.*p.x,0.)).rgb+texture2D(t,vUv+vec2(0.,2.*p.y)).rgb+texture2D(t,vUv+vec2(0.,-2.*p.y)).rgb;
 c+=(texture2D(t,vUv+vec2(-p.x,p.y)).rgb+texture2D(t,vUv+vec2(p.x,p.y)).rgb+texture2D(t,vUv+vec2(-p.x,-p.y)).rgb+texture2D(t,vUv+vec2(p.x,-p.y)).rgb)*2.;
 gl_FragColor=vec4(c/12.,1.); }`;

const FINAL = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tScene, tBloom;
uniform vec2 uRes;
uniform float uTime,uCut,uBand,uBurst,uDark,uGrid,uExposure,uBloom,uDpr,uBandTop;
uniform vec3 uPanel;
${NOISE}
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
vec3 spectrum(float t){ return clamp(vec3(1.5-abs(4.*t-1.2), 1.5-abs(4.*t-2.), 1.5-abs(4.*t-2.8)),0.,1.); }
void main(){
  vec2 uv=vUv;
  float f=uv.y+(fbm2(uv*vec2(3.,5.)+uTime*.035)-.5)*.55;
  float band=exp(-abs(f-uCut)*17.)*uBand;
  float edgeX=smoothstep(.12,.46,abs(uv.x-.5));
  band+=exp(-abs((1.-uv.y)+(fbm2(uv*vec2(4.,3.)+uTime*.05)-.5)*.5-uBandTop)*15.)*uBand*.7*edgeX;
  float burstMask=uBurst*smoothstep(.0,.55,fbm2(uv*vec2(4.,7.)+uTime*.8));
  float m=clamp(band+burstMask,0.,1.);
  vec3 col;
  float tint=0.;
  if(m>.004){
    float blk=7.*uDpr;
    vec2 cell=floor(uv*uRes/blk);
    float r1=hash12(cell), r2=hash12(cell+7.);
    float blocky=smoothstep(.55,.9,fbm2(uv*vec2(5.,16.)+uTime*.12));
    vec2 buv=mix(uv,(cell+.5)*blk/uRes,blocky*m);
    float flow=fbm2(uv*vec2(5.,2.)+vec2(uTime*.05,0.));
    vec2 off=vec2((flow-.5)*.2+(r1-.5)*.018*blocky,(fbm2(uv*vec2(2.,6.)+11.)-.5)*.1+(r2-.5)*.012*blocky)*m;
    vec3 acc=vec3(0.),tot=vec3(0.);
    for(int i=0;i<9;i++){
      float t=float(i)/8.;
      vec3 w=spectrum(t)+.04;
      acc+=texture2D(tScene,buv+off*(t-.5)).rgb*w; tot+=w;
    }
    col=acc/tot;
    tint=m;
    float hue=fract(flow*2.4+uv.x*.7+uv.y*.3);
    vec3 rb=spectrum(hue);
    float lum=dot(col,vec3(.3,.6,.1));
    col=mix(col,col*(.82+rb*.55),smoothstep(.1,.85,m)*.62);
  } else col=texture2D(tScene,uv).rgb;
  col+=texture2D(tBloom,uv).rgb*uBloom;
  col=max(col,vec3(0.));
  col*=uExposure;
  col=aces(col);
  // takeover panel
  if(uDark>.001){
    vec2 q=uv-.5;
    float corner=pow(smoothstep(.62,.0,length(vec2(q.x-.52,q.y-.46))),2.)*.085+pow(smoothstep(.5,.0,length(vec2(q.x+.56,q.y+.46))),2.)*.012;
    vec3 dark=col*vec3(.022,.027,.04)+uPanel*.8+corner*vec3(.72,.82,.98);
    col=mix(col,dark,uDark);
  }
  col=pow(col,vec3(1./2.2));
  // fine grain plus a fixed dot grid
  float g=hash12(gl_FragCoord.xy+fract(uTime)*137.)-.5;
  col+=g*.016;
  if(uGrid>.001){
    vec2 cell=fract(gl_FragCoord.xy/(uDpr*66.5));
    float d=length((cell-.5)*66.5);
    col+=smoothstep(1.,.3,d)*.3*uGrid;
  }
  gl_FragColor=vec4(col,1.);
}`;

const mat = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false });

export class Post {
  constructor(renderer, { levels = 5, samples = 4, panel = [0.009, 0.013, 0.022] } = {}) {
    this.r = renderer; this.levels = levels;
    const opt = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.scene = new THREE.WebGLRenderTarget(4, 4, { ...opt, depthBuffer: true, samples });
    this.back = new THREE.WebGLRenderTarget(4, 4, { ...opt, depthBuffer: true });
    this.down = []; this.up = [];
    for (let i = 0; i < levels; i++) { this.down.push(new THREE.WebGLRenderTarget(4, 4, opt)); this.up.push(new THREE.WebGLRenderTarget(4, 4, opt)); }
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.q = new THREE.Scene(); this.q.add(this.quad);
    this.mPre = mat(PRE, { t: { value: null }, uTh: { value: 1.25 } });
    this.mDown = mat(DOWN, { t: { value: null }, uPx: { value: new THREE.Vector2() } });
    this.mUp = mat(UP, { t: { value: null }, uPx: { value: new THREE.Vector2() } });
    this.mUp.blending = THREE.CustomBlending; this.mUp.blendSrc = THREE.OneFactor; this.mUp.blendDst = THREE.OneFactor; this.mUp.transparent = true;
    this.f = {
      tScene: { value: this.scene.texture }, tBloom: { value: null }, uRes: { value: new THREE.Vector2() }, uTime: { value: 0 }, uCut: { value: -1 }, uBand: { value: 0 }, uBandTop: { value: -1 },
      uBurst: { value: 0 }, uDark: { value: 0 }, uGrid: { value: 0 }, uExposure: { value: .72 }, uBloom: { value: .5 }, uDpr: { value: 1 }, uPanel: { value: new THREE.Vector3(...panel) }
    };
    this.mFinal = mat(FINAL, this.f);
  }
  setSize(w, h, dpr) {
    this.scene.setSize(w, h);
    this.back.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    let x = w >> 1, y = h >> 1;
    for (let i = 0; i < this.levels; i++) { this.down[i].setSize(Math.max(2, x), Math.max(2, y)); this.up[i].setSize(Math.max(2, x), Math.max(2, y)); x >>= 1; y >>= 1; }
    this.f.uRes.value.set(w, h); this.f.uDpr.value = dpr;
  }
  pass(m, target) { this.quad.material = m; this.r.setRenderTarget(target); this.r.render(this.q, this.cam); }
  renderBack(scene, camera) { this.r.setRenderTarget(this.back); this.r.clear(); this.r.render(scene, camera); }
  render(scene, camera) {
    const r = this.r;
    r.setRenderTarget(this.scene); r.clear(); r.render(scene, camera);
    this.mPre.uniforms.t.value = this.scene.texture;
    this.pass(this.mPre, this.down[0]);
    for (let i = 1; i < this.levels; i++) {
      const s = this.down[i - 1];
      this.mDown.uniforms.t.value = s.texture; this.mDown.uniforms.uPx.value.set(1 / s.width, 1 / s.height);
      this.pass(this.mDown, this.down[i]);
    }
    let src = this.down[this.levels - 1];
    for (let i = this.levels - 2; i >= 0; i--) {
      // copy lower-res down level then add upsampled
      const dst = this.up[i];
      this.mDown.uniforms.t.value = this.down[i].texture; this.mDown.uniforms.uPx.value.set(0, 0);
      this.pass(this.mDown, dst);
      const auto = r.autoClear; r.autoClear = false;
      this.mUp.uniforms.t.value = src.texture; this.mUp.uniforms.uPx.value.set(1 / src.width, 1 / src.height);
      this.pass(this.mUp, dst);
      r.autoClear = auto;
      src = dst;
    }
    this.f.tBloom.value = src.texture;
    this.pass(this.mFinal, null);
  }
}
