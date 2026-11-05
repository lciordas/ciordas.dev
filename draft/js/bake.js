// bake: prepares two textures once at startup, so the live material only has to look them up.
// field holds the rock inside the letters: pigment density, filaments, pigment colour, and tearing.
// mask holds the letter shapes blurred at two widths, which give glowing edges and a rounded look.
import * as THREE from 'three';
import { GLSL_NOISE } from './_util.js';

export const SPAN = 5; // world units covered by the textures

const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
const FIELD_FS = /* glsl */`
precision highp float; varying vec2 vUv;
${GLSL_NOISE}
void main(){
  vec2 w=(vUv-.5)*${SPAN.toFixed(1)};
  // Warp the rock so its layers tear and bend instead of running in straight lines.
  vec2 warp=vec2(fbm(vec3(w*.62,1.3)),fbm(vec3(w*.62+5.,2.1)))-.5;
  vec2 p=w+warp*vec2(.9,.62);
  // Pigment: wide strata with softer clouds and fine torn edges on top.
  float s1=fbm(vec3(p.x*.4,p.y*1.75,3.));
  float s2=fbm(vec3(p.x*.95,p.y*3.5,7.));
  float s3=fbm(vec3(p.x*2.6,p.y*6.8,11.));
  float m=clamp((s1*.52+s2*.31+s3*.17-.5)*2.7+.55,0.,1.);
  // Filaments: thin bright webs running through the pigment.
  float t=fbm(vec3(w*.9,6.))*2.6;
  float a=fbm(vec3(w.x*1.5,w.y*2.6,.7)+t);
  float b=fbm(vec3(w.x*3.2,w.y*4.8,3.1)-t+7.);
  float c=fbm(vec3(w.x*6.5,w.y*8.5,5.9)+t*.6+2.);
  float web=pow(1.-abs(2.*a-1.),18.)+.85*pow(1.-abs(2.*b-1.),20.)+.5*pow(1.-abs(2.*c-1.),16.);
  web*=smoothstep(.34,.62,fbm(vec3(w*.8+9.,8.)));
  // Which pigment sits here: low values are red, high values are olive.
  float tint=clamp((fbm(vec3(p.x*.62,p.y*1.45,19.))-.5)*3.+.5,0.,1.);
  float tear=fbm(vec3(w*vec2(5.,8.5),13.));
  gl_FragColor=vec4(m,clamp(web,0.,1.),tint,tear);
}`;
const BLUR_FS = /* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D t; uniform vec2 d; uniform vec4 keep;
void main(){
  vec4 base=texture2D(t,vUv); vec4 s=base*.1964;
  float w[6]; w[0]=.1747;w[1]=.1217;w[2]=.0667;w[3]=.0286;w[4]=.0097;w[5]=.0025;
  for(int i=0;i<6;i++){ vec2 o=d*float(i+1); s+=(texture2D(t,vUv+o)+texture2D(t,vUv-o))*w[i]; }
  gl_FragColor=mix(s,base,keep);
}`;

export function bakeSurface(renderer, data, size = 1024) {
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; scene.add(quad);
  const rt = (s) => new THREE.WebGLRenderTarget(s, s, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.MirroredRepeatWrapping, wrapT: THREE.MirroredRepeatWrapping });

  const field = rt(size);
  quad.material = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FIELD_FS, depthTest: false, depthWrite: false });
  renderer.setRenderTarget(field); renderer.render(scene, cam);
  quad.material.dispose();

  // Draw the letters flat in white.
  const flat = new THREE.Scene();
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const toV = (r) => { const o = []; for (let i = 0; i < r.length; i += 2) o.push(new THREE.Vector2(r[i], r[i + 1])); return o; };
  data.letters.forEach((L) => L.shape.forEach((poly) => {
    const sh = new THREE.Shape(toV(poly[0])); poly.slice(1).forEach((h) => sh.holes.push(new THREE.Path(toV(h))));
    flat.add(new THREE.Mesh(new THREE.ShapeGeometry(sh), white));
  }));
  const ortho = new THREE.OrthographicCamera(-SPAN / 2, SPAN / 2, SPAN / 2, -SPAN / 2, -1, 1);
  let a = rt(size), b = rt(size);
  renderer.setRenderTarget(a); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(flat, ortho);

  // r: tight blur, g: wide blur, b: the sharp shape.
  const blur = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: BLUR_FS, depthTest: false, depthWrite: false, uniforms: { t: { value: null }, d: { value: new THREE.Vector2() }, keep: { value: new THREE.Vector4() } } });
  quad.material = blur;
  const px = 1 / size;
  const pass = (dx, dy, keep) => {
    blur.uniforms.t.value = a.texture; blur.uniforms.d.value.set(dx, dy); blur.uniforms.keep.value.copy(keep);
    renderer.setRenderTarget(b); renderer.render(scene, cam); [a, b] = [b, a];
  };
  const onlyR = new THREE.Vector4(0, 1, 1, 1), onlyG = new THREE.Vector4(1, 0, 1, 1);
  for (let i = 0; i < 2; i++) { pass(px * 1.6, 0, onlyR); pass(0, px * 1.6, onlyR); }
  for (const s of [9, 5, 2.5, 1.2]) { pass(px * s, 0, onlyG); pass(0, px * s, onlyG); }
  renderer.setRenderTarget(null);
  b.dispose(); blur.dispose(); white.dispose();
  flat.traverse((o) => o.geometry?.dispose());
  return { field: field.texture, mask: a.texture };
}
