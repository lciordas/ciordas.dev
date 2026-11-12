// bake: draws the letter shapes once at startup, sharp and blurred at two widths. The blurred copies make the
// soft glow that sits behind the glass, so the letters have light to bend and stay legible on the dark backdrop.
import * as THREE from 'three';

export const SPAN = 5; // world units covered by the texture

const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
const BLUR_FS = /* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D t; uniform vec2 d; uniform vec4 keep;
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
  return { mask: a.texture };
}
