// block-dissolve: a grid wipe between two images. Cells open outward from the centre,
// survivors keep bumpy rounded corners, and small registration marks flash just before a cell opens.
import * as THREE from 'three';

export const DISSOLVE_GLSL = /* glsl */`
float bdHash(vec2 id){ return fract(sin(dot(id,vec2(41.3,289.1)))*43758.5453); }
float bdRank(vec2 id,vec2 res,float cell){ vec2 c=(id+.5)*cell-res*.5; return length(c/vec2(res.y))*.8+bdHash(id)*.24; }
// Returns: x = how open this pixel is (0 shows "from", 1 shows "to"), y = registration mark.
vec2 blockDissolve(vec2 px, vec2 res, float p, float cell){
  vec2 g=px/cell;
  vec2 id=floor(g), f=fract(g)-.5;
  float rv=bdRank(id,res,cell);
  float front=p*1.34-.06;
  float open=step(rv,front);
  float pix=open;
  if(open<.5){
    // A corner is rounded only when both neighbours around it have already opened.
    vec2 sg=sign(f);
    float nx=step(bdRank(id+vec2(sg.x,0.),res,cell),front);
    float ny=step(bdRank(id+vec2(0.,sg.y),res,cell),front);
    if(nx*ny>.5){
      vec2 q=abs(f)-(.5-.2);
      float sd=length(max(q,0.))-.2;
      pix=smoothstep(-.012,.012,sd);
    }
  }
  float ahead=rv-front;
  float mark=0.;
  if(open<.5&&ahead<.16&&ahead>0.){
    vec2 a=abs(f);
    float t=.014;
    float corner=(step(.33,a.x)*step(a.x,.45)*step(abs(a.y-.33),t))+(step(.33,a.y)*step(a.y,.45)*step(abs(a.x-.33),t));
    float cross=(step(a.x,.1)*step(a.y,t))+(step(a.y,.1)*step(a.x,t));
    mark=clamp(ahead<.055?cross:corner*step(.4,bdHash(id+3.)),0.,1.);
  }
  return vec2(pix,mark);
}`;

export function mountBlockDissolve(container, options = {}) {
  const { cell = 48, duration = 1.4, from = '#000000', to = '#b6573a', markColor = '#ffd9b0', loop = true } = options;
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block' });
  container.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = { uP: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uCell: { value: cell }, uA: { value: new THREE.Color(from) }, uB: { value: new THREE.Color(to) }, uM: { value: new THREE.Color(markColor) } };
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `void main(){ gl_Position=vec4(position.xy,0.,1.);} `,
    fragmentShader: `precision highp float; uniform float uP,uCell; uniform vec2 uRes; uniform vec3 uA,uB,uM; ${DISSOLVE_GLSL}
      void main(){ vec2 d=blockDissolve(gl_FragCoord.xy,uRes,uP,uCell); vec3 c=mix(uA,uB,d.x); c=mix(c,uM,d.y*.9); gl_FragColor=vec4(c,1.);} `,
  })));
  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
  };
  new ResizeObserver(resize).observe(container); resize();
  let t = 0, last = performance.now(), run = true;
  const tick = (now) => {
    if (!run) return;
    t += (now - last) / 1000; last = now;
    const c = loop ? (t % (duration + 0.8)) / duration : t / duration;
    uniforms.uP.value = Math.min(1, c);
    renderer.render(scene, cam);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return { uniforms, destroy() { run = false; renderer.dispose(); canvas.remove(); } };
}
