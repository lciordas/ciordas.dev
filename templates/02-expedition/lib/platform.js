// Concentric stepped platform with light in the grooves, an overhead halo and a faint net column.
import * as THREE from 'three';
import { NOISE, LIGHT, WIPE, STONE } from './glsl.js';

export function createPlatform({ G }) {
  // radius, height pairs, stepped outward
  const prof = [[0, 1.9], [11.6, 1.9], [11.9, 1.75], [12, .95], [12.3, .85], [19.4, .78], [19.7, .78], [19.9, .3], [28.6, .26], [28.9, .24], [29.1, -.1], [41, -.14], [41.3, -.16], [41.5, -.5], [58, -.56], [58.4, -.95], [84, -1], [84.4, -1.4], [130, -1.45], [800, -2]];
  const pts = prof.map(([r, y]) => new THREE.Vector2(r + 1e-3, y));
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], d = a.distanceTo(b), n = Math.max(1, Math.min(14, Math.floor(d / 2.5)));
    for (let j = 0; j < n; j++) dense.push(a.clone().lerp(b, j / n));
  }
  dense.push(pts[pts.length - 1]);
  const geo = new THREE.LatheGeometry(dense.reverse(), 180);
  geo.computeVertexNormals();
  const U = { uTime: G.uTime, uRes: G.uRes, uCut: G.uCut, uFog: G.uFog, uGlow: { value: 1 } };
  const floor = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vW,vN,vP; void main(){ vP=position; vN=mat3(modelMatrix)*normal; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      varying vec3 vW,vN,vP; uniform vec3 uFog; uniform float uGlow;
      ${NOISE}${LIGHT}${WIPE}${STONE}
      float rim(float r,float R,float w){ return smoothstep(w,0.,abs(r-R)); }
      void main(){
        wipeDiscard();
        float r=length(vP.xz);
        vec3 V=normalize(cameraPosition-vW);
        vec3 Nb=normalize(vN);
        vec3 N=stoneNormal(Nb,vP*.14,.03);
        float n=vn2(vP.xz*.035)*.6+vn2(vP.xz*.11)*.4;
        vec3 a=mix(vec3(.088,.098,.12),vec3(.125,.138,.168),n);
        float pit=smoothstep(.76,.86,vn2(vP.xz*.9))*smoothstep(.45,.7,vn2(vP.xz*.09));
        a*=1.-pit*.28;
        vec3 c=overcast(a,N,V,.34,.25);
        float grz=pow(1.-max(dot(Nb,V),0.),4.);
        c-=vec3(.55,.6,.72)*grz*.28;
        c=max(c,vec3(.01));
        // light on the step edges
        float g=rim(r,11.95,.3)*.8+rim(r,19.8,.3)*.75+rim(r,29.,.26)*.42+rim(r,41.4,.3)*.8;
        float ang=atan(vP.z,vP.x);
        float sweep=.5+.5*sin(ang+.6);
        g+=rim(r,58.2,.6)*(.8+sweep*1.6)+rim(r,84.2,.8)*(.5+sweep*1.1);
        c+=vec3(.68,.82,1.)*g*uGlow;
        float dist=length(cameraPosition-vW);
        float fk=1.-exp(-pow(dist*.0052,2.1));
        c=mix(c,uFog*1.1,clamp(fk,0.,1.));
        gl_FragColor=vec4(c,1.);
      }`,
  }));
  floor.frustumCulled = false;

  const halo = new THREE.Mesh(new THREE.TorusGeometry(30, 1.15, 16, 128), new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uRes: G.uRes, uCut: G.uCut, uA: { value: 1 } },
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uA; void main(){ gl_FragColor=vec4(vec3(3.4,3.7,4.)*uA,1.); }`,
  }));
  halo.rotation.x = Math.PI / 2; halo.position.y = 41;

  // Net column around the form
  const col = new THREE.Mesh(new THREE.CylinderGeometry(19, 19, 48, 64, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: G.uTime, uA: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying float vF; void main(){ vUv=uv; vec3 n=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vF=abs(dot(n,normalize(-mv.xyz))); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; varying float vF; uniform float uTime,uA; ${NOISE}
      float tri(vec2 p){ vec2 s=vec2(1.,1.732); vec2 a=mod(p,s)-s*.5; vec2 b=mod(p-s*.5,s)-s*.5; float d=min(abs(a.y),abs(b.y)); vec2 q=p*mat2(.5,.866,-.866,.5); a=mod(q,s)-s*.5;b=mod(q-s*.5,s)-s*.5; d=min(d,min(abs(a.y),abs(b.y))); q=p*mat2(.5,-.866,.866,.5); a=mod(q,s)-s*.5;b=mod(q-s*.5,s)-s*.5; d=min(d,min(abs(a.y),abs(b.y))); return d; }
      void main(){ float d=tri(vUv*vec2(120.,48.)); float l=smoothstep(.05,.0,d);
        float mask=smoothstep(.42,.72,fbm2(vUv*vec2(9.,4.)+uTime*.03));
        float side=smoothstep(.0,.5,vF)*smoothstep(1.,.75,vF);
        gl_FragColor=vec4(vec3(.85,.9,1.)*l*mask*side*uA*.42,1.); }`,
  }));
  col.position.y = 22;

  const group = new THREE.Group();
  group.add(floor, halo, col);
  return { group, uniforms: U, halo, col, floor };
}
