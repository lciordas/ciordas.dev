// film-post: the final image. Soft bloom, vignette and a fine woven grain, plus the
// block-dissolve mix used by the intro. Pass your scene through render().
// Call setSmear() with a cursor-smear texture to bend the image behind the pointer.
import * as THREE from 'three';
import { DISSOLVE_GLSL } from './block-dissolve.js';
import { PALETTE } from './palette.js';

const FS = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.);} `, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });

export function mountFilmPost(renderer, options = {}) {
  const { bloom = 0.2, threshold = 0.96, grain = 0.028, vignette = 0.2, msaa = 4 } = options;
  const quadScene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; quadScene.add(quad);
  const main = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: msaa, depthBuffer: true });
  const stage = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 0, depthBuffer: true });
  const blurA = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  const blurB = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  const blurMat = FS(`precision highp float; varying vec2 vUv; uniform sampler2D t; uniform vec2 d; uniform float th;
    void main(){ vec3 c=vec3(0.); float w[5]; w[0]=.227;w[1]=.195;w[2]=.122;w[3]=.054;w[4]=.016;
      for(int i=-4;i<=4;i++){ vec3 s=texture2D(t,vUv+d*float(i)*1.5).rgb; if(th>0.){ float l=max(s.r,max(s.g,s.b)); s*=smoothstep(th-.2,th+.2,l);} c+=s*w[i<0?-i:i]; }
      gl_FragColor=vec4(c,1.); }`, { t: { value: null }, d: { value: new THREE.Vector2() }, th: { value: 0 } });
  const u = {
    tMain: { value: main.texture }, tBloom: { value: blurB.texture }, tStage: { value: stage.texture },
    uBloom: { value: bloom }, uGrain: { value: grain }, uVig: { value: vignette }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 },
    tSmear: { value: null }, tKeep: { value: null }, uSmear: { value: 0 }, uSmearTint: { value: new THREE.Color(PALETTE.smear) },
    uDissolve: { value: 1 }, uCell: { value: 48 }, uMark: { value: new THREE.Color(PALETTE.mark) }, uBlack: { value: 0 },
  };
  const final = FS(`precision highp float; varying vec2 vUv; uniform vec3 uSmearTint; uniform sampler2D tMain,tBloom,tStage,tSmear,tKeep; uniform float uSmear,uBloom,uGrain,uVig,uTime,uDissolve,uCell,uDpr,uBlack; uniform vec2 uRes; uniform vec3 uMark;
    ${DISSOLVE_GLSL}
    float h(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
    void main(){
      vec2 uvS=vUv; float lens=0.;
      if(uSmear>.001){
        vec3 s=texture2D(tSmear,vUv).xyz;
        if(s.z>.002){
          const float E=.014;
          vec2 grad=vec2(texture2D(tSmear,vUv+vec2(E,0.)).z-texture2D(tSmear,vUv-vec2(E,0.)).z,
                         texture2D(tSmear,vUv+vec2(0.,E)).z-texture2D(tSmear,vUv-vec2(0.,E)).z);
          float keep=1.-texture2D(tKeep,vUv).a;
          lens=smoothstep(.01,.85,s.z)*keep*uSmear;
          // A random length per grain turns dark edges into a fine spray along the drag.
          float spray=h(floor(gl_FragCoord.xy/(1.5*uDpr))+floor(uTime*24.)*vec2(3.,5.));
          vec2 off=-s.xy*(.62+.55*spray*spray*spray)-grad*.09;
          uvS=vUv+off*keep*uSmear;
        }
      }
      vec3 c=texture2D(tMain,uvS).rgb;
      c+=texture2D(tBloom,uvS).rgb*uBloom;
      c=mix(c,max(c,uSmearTint),lens*.6);
      vec2 v=vUv-.5; c*=1.-dot(v,v)*uVig*1.6;
      c=min(c,vec3(1.));
      if(uDissolve<1.){
        vec2 d=blockDissolve(gl_FragCoord.xy/uDpr,uRes/uDpr,uDissolve,uCell);
        vec3 st=texture2D(tStage,vUv).rgb;
        c=mix(st,c,d.x);
        c=mix(c,uMark,d.y*.9);
      }
      // Woven grain: chunky luminance dither that stays visible in the dark sky.
      vec2 cellP=floor(gl_FragCoord.xy/(2.*uDpr));
      float g=h(cellP+floor(uTime*18.)*vec2(7.,13.))-.5;
      float g2=h(floor(gl_FragCoord.xy/(4.*uDpr))+13.)-.5;
      float lum=dot(c,vec3(.3,.6,.1));
      c+=(g*.9+g2*.28)*uGrain*(1.-lum*.75);
      c*=1.-uBlack;
      gl_FragColor=vec4(c,1.);
    }`, u);
  const api = {
    main, stage, uniforms: u,
    // keep is optional: pixels with alpha in that texture stay sharp.
    setSmear(texture, keep, amount = 1) { u.tSmear.value = texture; u.tKeep.value = keep; u.uSmear.value = amount; },
    resize(w, h, dpr) {
      const W = Math.floor(w * dpr), H = Math.floor(h * dpr);
      main.setSize(W, H); stage.setSize(W, H);
      blurA.setSize(Math.max(2, W >> 2), Math.max(2, H >> 2));
      blurB.setSize(Math.max(2, W >> 2), Math.max(2, H >> 2));
      u.uRes.value.set(W, H); u.uDpr.value = dpr;
    },
    bloomPass() {
      quad.material = blurMat;
      const px = 1 / blurA.width, py = 1 / blurA.height;
      blurMat.uniforms.t.value = main.texture; blurMat.uniforms.d.value.set(px, 0); blurMat.uniforms.th.value = threshold;
      renderer.setRenderTarget(blurA); renderer.render(quadScene, cam);
      blurMat.uniforms.t.value = blurA.texture; blurMat.uniforms.d.value.set(0, py); blurMat.uniforms.th.value = 0;
      renderer.setRenderTarget(blurB); renderer.render(quadScene, cam);
    },
    present(time) {
      u.uTime.value = time;
      quad.material = final;
      renderer.setRenderTarget(null);
      renderer.render(quadScene, cam);
    },
  };
  return api;
}
