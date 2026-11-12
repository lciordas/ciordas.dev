// name: the 3D letters, cut from clear glass. They bend and disperse the light behind them, catch the studio
// lights on their bevels, float on small springs, crack from the point they are clicked, and burst into shards
// that keep refracting as they drift into a slow ring.
import * as THREE from 'three';
import { GLSL_NOISE, rng, smooth } from './_util.js';
import { SPAN } from './bake.js';
import { PALETTE } from './palette.js';

export const DEPTH = 0.2;
const COARSE = matchMedia('(pointer: coarse)').matches;
// Refraction is sampled several times per pixel for the rainbow fringes; phones take fewer and skip the
// back-face pass, and a slow frame rate drops a desktop to the same setting (see setQuality).
const QUALITY = {
  high: { samples: 8, bgScale: 1, back: true, backScale: 1, msaa: 4 },
  low: { samples: 4, bgScale: 0.5, back: false, backScale: 0.5, msaa: 0 },
};
const MAX_SAMPLES = 8;

const VERT = /* glsl */`
attribute vec3 aQ; attribute float aFace;
varying vec3 vWP, vWN, vP, vZ, vC; varying float vFace;
void main(){
  vP=aQ; vFace=aFace; vC=modelMatrix[3].xyz;
  vZ=normalize(mat3(modelMatrix)*vec3(0.,0.,1.));
  vec4 wp=modelMatrix*vec4(position,1.);
  vWP=wp.xyz;
  // Shards are flattened as they fly, so the normal is scaled back (inverse transpose of rotation times scale).
  vec3 s2=vec3(dot(modelMatrix[0].xyz,modelMatrix[0].xyz),dot(modelMatrix[1].xyz,modelMatrix[1].xyz),dot(modelMatrix[2].xyz,modelMatrix[2].xyz));
  vWN=normalize(mat3(modelMatrix)*(normal/s2));
  gl_Position=projectionMatrix*viewMatrix*wp;
}`;

// The glass. What is behind the letter was drawn first into uBuffer; each pixel bends a view ray into the glass
// (Snell's law, with a slightly different index per colour so the edges split into rainbows), finds where it
// leaves the slab and reads the buffer there. A ray that leaves through the back at a steep angle (from a bevel)
// sees the studio lights off to the side instead, split into a spectrum. Over that goes the Fresnel share of a
// small procedural studio (a softbox above, white strips left and right, two strips behind the camera that lay
// long streaks across the faces) and sharp highlights from three lamps, which glint as a facet turns through them.
const FRAG = /* glsl */`
precision highp float;
#define MAXS ${MAX_SAMPLES}
varying vec3 vWP, vWN, vP, vZ, vC; varying float vFace;
uniform sampler2D uBuffer;
uniform mat4 uProj;
uniform int uSamples;
uniform float uIor, uDisp, uThick, uTime, uFade, uReveal, uHotAmt, uHotSize, uBackPass, uShard, uEnvK;
uniform vec2 uHot;
uniform vec3 uAccent;
${GLSL_NOISE}
float sat(float v){ return clamp(v,0.,1.); }
// A soft-edged panel of light seen from inside a sphere, like a studio lightformer. P is its direction,
// T runs along it, size is in tangents of the angle it covers.
float panel(vec3 d, vec3 P, vec3 T, vec2 size, float soft){
  float k=dot(d,P); if(k<=0.) return 0.;
  vec3 B=normalize(cross(P,T));
  vec2 q=vec2(dot(d,T),dot(d,B))/k;
  return smoothstep(size.x,size.x-soft,abs(q.x))*smoothstep(size.y,size.y-soft,abs(q.y));
}
// A lightformer strip seen through the glass. Its brightness falls off along its length in soft pools, like a
// row of lamps of different strength, so a straight bevel that sweeps along it passes through bright cores,
// coloured edges and dark gaps instead of meeting one even band.
float strip(vec3 d, vec3 P, vec3 T, vec2 size, float soft, float f, float ph){
  float k=dot(d,P); if(k<=0.) return 0.;
  vec3 B=normalize(cross(P,T));
  vec2 q=vec2(dot(d,T),dot(d,B))/k;
  float a=.5+.5*cos(q.x*f+ph);
  return smoothstep(size.x,size.x-soft*6.,abs(q.x))*smoothstep(size.y,size.y-soft,abs(q.y))*(.08+.92*a*a);
}
// The lamps are a few metres off, not infinitely far: the direction to them changes from one end of an edge to
// the other, and as the letters drift and tilt.
vec3 near(vec3 d, vec3 p, float D){ return normalize(d*D+p); }
// For loose shards: a dark room with one broad soft key and a dim fill, so every face reflects a gradient
// rather than a flat panel.
vec3 envSoft(vec3 d){
  float k=sat(dot(d,normalize(vec3(-.35,.8,.5)))), f=sat(dot(d,normalize(vec3(.7,-.25,.6))));
  return vec3(1.,.99,.97)*pow(k,5.)*.85+vec3(.9,.95,1.)*pow(f,10.)*.4+vec3(.003);
}
// Keeps a colour from going fully saturated: real dispersion splits white light, so even its fringes keep
// some white in them, and dim fringes are paler still.
vec3 capSat(vec3 c, float m){
  float l=dot(c,vec3(.2126,.7152,.0722)), mx=max(c.r,max(c.g,c.b)), mn=min(c.r,min(c.g,c.b));
  float s=(mx-mn)/max(mx,1e-4);
  return mix(vec3(l),c,min(1.,m/max(s,1e-4)));
}
// The studio, as seen in reflections. Neutral white light; the accent shows only as one faint low strip.
vec3 env(vec3 d){
  vec3 c=vec3(.004,.0045,.005);
  c+=vec3(1.)*3.2*panel(d,normalize(vec3(0.,1.,.35)),vec3(1.,0.,0.),vec2(1.6,.42),.25);
  c+=vec3(.96,.98,1.)*3.6*panel(d,normalize(vec3(-1.,.1,.4)),vec3(0.,1.,0.),vec2(1.7,.16),.07);
  c+=vec3(.96,.98,1.)*3.6*panel(d,normalize(vec3(1.,.1,.4)),vec3(0.,1.,0.),vec2(1.7,.16),.07);
  c+=vec3(.9,.93,1.)*1.6*panel(d,normalize(vec3(0.,-1.,.3)),vec3(1.,0.,0.),vec2(1.6,.2),.12);
  // Behind the camera: two slanted strips the front faces mirror as long bright bands. uEnvK shrinks them when
  // the name covers a smaller angle (a tall phone screen), so they still cross it as bands.
  vec3 T1=normalize(vec3(.42,1.,0.)), T2=normalize(vec3(.5,1.,0.));
  float k=uEnvK;
  c+=vec3(1.)*9.*panel(d,normalize(vec3(-.13*k,.02*k,1.)),T1,vec2(.9,.05*k),.03*k);
  c+=vec3(1.)*5.*panel(d,normalize(vec3(.2*k,-.03*k,1.)),T2,vec2(.9,.028*k),.018*k);
  c+=uAccent*.5*panel(d,normalize(vec3(.6,-.5,.5)),vec3(1.,0.,0.),vec2(.9,.12),.1);
  return c;
}
// The lights seen through the glass, behind and to the sides of it: what a steep ray leaving a bevel meets.
vec3 envBack(vec3 d){
  vec3 c=vec3(0.);
  // Wide enough that a straight bevel (which sends its rays out about 25 degrees) crosses a strip; the pools
  // along each strip and the waviness of the bevels break it into white cores, short spectra and dark gaps.
  c+=vec3(2.8)*strip(d,normalize(vec3(-.5,.05,-1.)),vec3(0.,1.,0.),vec2(2.,.17),.07,9.,.3);
  c+=vec3(2.8)*strip(d,normalize(vec3(.5,.05,-1.)),vec3(0.,1.,0.),vec2(2.,.17),.07,8.,2.1);
  c+=vec3(2.2)*strip(d,normalize(vec3(0.,.5,-1.)),vec3(1.,0.,0.),vec2(2.,.15),.06,7.,1.2);
  c+=vec3(1.4)*strip(d,normalize(vec3(0.,-.5,-1.)),vec3(1.,0.,0.),vec2(2.,.15),.06,10.,4.);
  c+=vec3(1.1)*strip(d,normalize(vec3(-.95,-.1,-1.)),vec3(0.,1.,0.),vec2(2.,.1),.05,11.,.7);
  c+=vec3(1.1)*strip(d,normalize(vec3(.95,-.1,-1.)),vec3(0.,1.,0.),vec2(2.,.1),.05,12.,3.3);
  return c;
}
vec3 glint(vec3 N, vec3 V, vec3 L, vec3 col, float tight){
  vec3 H=normalize(L+V);
  float f=.04+.96*pow(1.-sat(dot(V,H)),5.);
  return col*f*pow(sat(dot(N,H)),tight);
}
void main(){
  // In the back pass the far faces are drawn (the renderer turns the winding round, so gl_FrontFacing can't tell);
  // their normals are turned to face the camera and they are shaded like a surface seen from inside.
  bool backP=uBackPass>.5;
  vec3 N=normalize(vWN)*(backP?-1.:1.);
  vec3 V=normalize(cameraPosition-vWP);
  // Cast glass is never quite flat: a faint ripple in the face bends what is behind it as the letter moves.
  vec2 rip=vec2(sin(vP.x*9.+vP.y*4.)+sin(vP.y*13.-vP.x*3.+1.7),sin(vP.y*8.-vP.x*5.+2.)+sin(vP.x*11.+vP.y*7.))*.5;
  N=normalize(N+vec3(rip,0.)*.007*uEnvK*uEnvK*vFace);
  // Polished bevels and walls are never perfectly flat either: a slow waviness along them turns each part of a
  // straight edge to a slightly different angle, so its colour shifts along its length.
  if(vFace<.5){ vec3 nq=vP*3.2; N=normalize(N+(vec3(vnoise(nq),vnoise(nq+17.1),vnoise(nq+31.7))-.5)*.17); }
  float NdV=sat(dot(N,V));
  float F=.04+.96*pow(1.-NdV,5.);
  vec3 Z=normalize(vZ);

  // Refraction: a few rays per pixel, spread in depth so the image through the glass softens a little
  // towards the back, and spread in index so red, green and blue leave at slightly different places.
  float thick=uThick*(backP?2.4:1.);
  float jit=hash21(gl_FragCoord.xy);
  // Each ray carries one wavelength: its index runs from red (lowest) to violet (highest) and it is weighted by
  // that colour, so a bright edge seen through a bevel spreads into a continuous spectrum.
  vec3 tr=vec3(0.), lit=vec3(0.), wsum=vec3(0.);
  // A ray trapped by total internal reflection (through the side walls) comes back the same for every colour.
  vec3 r0=refract(-V,N,1./uIor);
  // The far face is whichever of the two flat faces the ray is heading for: a shard that has turned over looks
  // in through its back.
  if(dot(r0,Z)>0.) Z=-Z;
  vec3 o0=refract(r0,Z,uIor);
  bool loose=uShard>.5;
  // A small shard is close to the lamps compared with its size, so they cross it as a band of light; a letter's
  // faces look straight through to the backdrop and only its edges reach the lamps.
  vec3 lp=(vWP-vC)*(loose?1.:1.-vFace);
  float ld=loose?.7:3.;
  vec3 tdir=near(reflect(r0,Z),lp,ld);
  vec3 trapped=backP?vec3(0.):(loose?envSoft(tdir)*.5:env(tdir)*.3);
  for(int i=0;i<MAXS;i++){
    if(i>=uSamples) break;
    float prog=(float(i)+jit)/float(uSamples);
    vec3 w=vec3(exp(-pow((prog-.12)/.24,2.)),exp(-pow((prog-.5)/.22,2.)),exp(-pow((prog-.88)/.24,2.)));
    float th=thick*(1.+.4*fract(prog*2.618+.3));
    float io=uIor+(uIor-1.)*uDisp*(prog-.5);
    vec3 r=refract(-V,N,1./io);
    vec4 ex=uProj*viewMatrix*vec4(vWP+r*th,1.);
    tr+=texture2D(uBuffer,ex.xy/ex.w*.5+.5).rgb*w;
    if(!backP){
      // The same ray leaving through the back face, into the lights behind and beside the glass.
      vec3 ro=refract(r,Z,io);
      lit+=(dot(o0,o0)>.01&&dot(ro,ro)>.01?envBack(near(ro,lp,ld)):trapped)*w;
    }
    wsum+=w;
  }
  tr/=wsum; lit/=wsum;
  lit=capSat(lit,.3+.4*sat(dot(lit,vec3(.33))));
  if(loose) lit*=.55;

  vec3 R=reflect(-V,N);
  // A loose shard turns its faces through every angle; it reflects the soft room, offset across the face so each
  // face carries a gradient.
  vec3 refl=loose?envSoft(normalize(R+vP*1.8)):env(R);
  float ph=uTime*.19;
  vec3 spec=glint(N,V,normalize(vec3(-.55+.3*sin(ph),.85,.55)),vec3(1.,.99,.97)*30.,900.)
           +glint(N,V,normalize(vec3(.55-.3*sin(ph),.85,.55)),vec3(.97,.99,1.)*30.,900.)
           +glint(N,V,normalize(vec3(.0,-.6,.75)),vec3(.9,.95,1.)*14.,600.);
  // Very tight flashes on top, for the occasional sparkle as a facet lines up with a lamp.
  spec+=glint(N,V,normalize(vec3(-.3+.25*sin(ph*1.7),.6,.75)),vec3(1.)*70.,6000.);
  spec+=glint(N,V,normalize(vec3(.35,.5+.2*cos(ph*1.3),.8)),vec3(1.)*60.,6000.);

  // Seen from inside, the back faces only give a faint reflection, or they cloud the letter.
  if(backP){ refl*=.25; spec*=.3; }
  float edge=1.-vFace;
  vec3 c=(1.-F)*(tr+lit)+F*refl+spec;
  // Materialising: the traced outline turns into the edges of the glass, hot in the accent colour at first,
  // then cooling to clear while the reflections settle in.
  float rv=uReveal*uReveal;
  c+=uAccent*(edge*1.1+pow(1.-NdV,4.)*.5)*rv*1.4;
  // A loose shard is lit a little harder at its broken edges, so it stays visible as it turns in the dark.
  // Its broken edges and rim pick up a spectrum that shifts as it turns, and now and then a glimmer runs over it.
  if(uShard>.5&&!backP){
    // Bright thin broken edges, a faint spectral rim, and only now and then a glimmer.
    float rim=edge*(.04+.32*pow(1.-NdV,2.))+pow(1.-NdV,4.)*.1;
    vec3 hue=.75+.25*cos(6.283*(fract(dot(N,vec3(1.3,.9,.6))*1.5+dot(vP.xy,vec2(.8,.5))+uTime*.05)+vec3(0.,.33,.67)));
    float gl=pow(.5+.5*sin(uTime*1.1+dot(vP,vec3(9.,6.,4.))),24.);
    c+=hue*rim*(1.+3.*gl)+spec*.25;
  }
  // Under the pointer the glass catches a soft, cool white light, brightest on its edges and rims.
  if(uHotAmt>.002){
    float d=distance(vP.xy,uHot);
    float h=smoothstep(uHotSize,0.,d);
    c+=vec3(.92,.95,1.)*h*h*uHotAmt*(.035+.12*pow(1.-NdV,2.));
  }
  gl_FragColor=vec4(c,uFade);
}`;

const CRACK_VERT = `attribute vec2 aP; varying vec2 vP; void main(){ vP=aP; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
// Fine bright fissures, as light scatters off the fracture surfaces, with a hot front racing outward.
// uFlare lights every crack just before the burst.
const CRACK_FRAG = `precision highp float; varying vec2 vP; uniform vec2 uO; uniform float uR, uAmt, uFlare; uniform vec3 uAccent;
  void main(){ float d=distance(vP,uO); float a=smoothstep(uR,uR-.1,d)*uAmt; if(a<.004) discard;
    float hot=smoothstep(uR-.55,uR-.04,d);
    float f=max(hot,uFlare); vec3 c=mix(vec3(.85,.9,1.),vec3(1.)+uAccent*.25,smoothstep(0.,.45,f)); c=mix(c,vec3(2.6,2.6,2.7),smoothstep(.45,1.,f));
    gl_FragColor=vec4(c,a*.85); }`;

function shapesFrom(multi) {
  // multi: list of polygons, each a list of flat rings. The first ring is the outside.
  return multi.map((poly) => {
    const toV = (r) => { const out = []; for (let i = 0; i < r.length; i += 2) out.push(new THREE.Vector2(r[i], r[i + 1])); return out; };
    const shape = new THREE.Shape(toV(poly[0]));
    poly.slice(1).forEach((h) => shape.holes.push(new THREE.Path(toV(h))));
    return shape;
  });
}
// A slab of glass cut to the outline. Whole letters get a chamfered edge all round, which is where glass
// catches the light; shards get a finer one so their broken edges glint too.
function solid(multi, dx = 0, dy = 0, whole = false) {
  const R = whole ? 0.042 : 0.012;
  const opts = whole
    ? { depth: DEPTH - R * 2, bevelEnabled: true, bevelThickness: R, bevelSize: R, bevelOffset: -R, bevelSegments: 2, steps: 1, curveSegments: 1 }
    : { depth: DEPTH - R * 2, bevelEnabled: true, bevelThickness: R, bevelSize: R * 0.6, bevelOffset: 0, bevelSegments: 1, steps: 1, curveSegments: 1 };
  const g = new THREE.ExtrudeGeometry(shapesFrom(multi), opts);
  g.translate(0, 0, -(DEPTH - R * 2) / 2);
  const p = g.attributes.position, n = g.attributes.normal;
  const q = new Float32Array(p.count * 3), f = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) { q[i * 3] = p.getX(i); q[i * 3 + 1] = p.getY(i); q[i * 3 + 2] = p.getZ(i); f[i] = Math.abs(n.getZ(i)) > 0.95 ? 1 : 0; } // aFace: 1 on the flat front and back, 0 on bevels and walls
  g.setAttribute('aQ', new THREE.BufferAttribute(q, 3));
  g.setAttribute('aFace', new THREE.BufferAttribute(f, 1));
  g.translate(-dx, -dy, 0);
  g.deleteAttribute('uv');
  return g;
}
const center = (flat) => { let x = 0, y = 0; const n = flat.length / 2; for (let i = 0; i < flat.length; i += 2) { x += flat[i]; y += flat[i + 1]; } return [x / n, y / n]; };
const polyArea = (r) => { let a = 0; const n = r.length; for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; a += r[i] * r[j + 1] - r[j] * r[i + 1]; } return Math.abs(a / 2); };

// Layer 1 holds the glass, so the backdrop can be drawn on its own for the glass to look through.
const GLASS = 1;

export function mountName(scene, data, palU, baked) {
  const R = rng(31);
  const root = new THREE.Group(); scene.add(root);
  const accent = new THREE.Color(PALETTE.accent);
  const uniforms = {
    ...palU, uAccent: { value: accent },
    uBuffer: { value: null }, uProj: { value: new THREE.Matrix4() }, uSamples: { value: QUALITY.high.samples }, uBackPass: { value: 0 },
    uIor: { value: 1.5 }, uDisp: { value: 0.26 }, uThick: { value: DEPTH * 1.4 },
    uTime: { value: 0 }, uFade: { value: 1 }, uReveal: { value: 0 }, uShard: { value: 0 }, uEnvK: { value: 1 },
    uHot: { value: new THREE.Vector2() }, uHotAmt: { value: 0 }, uHotSize: { value: 0.42 },
  };
  // Front and back faces are drawn in separate passes (see render), so they are two materials on one set of uniforms.
  const frontMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });
  const backMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.BackSide });
  // Shards share every uniform object with the letters except the one that marks them as loose.
  const shardU = { ...uniforms, uShard: { value: 1 } };
  const shardFront = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: shardU });
  const shardBack = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: shardU, side: THREE.BackSide });
  const crackU = { uO: { value: new THREE.Vector2() }, uR: { value: 0 }, uAmt: { value: 0 }, uFlare: { value: 0 }, uAccent: { value: accent } };
  const crackMat = new THREE.ShaderMaterial({ vertexShader: CRACK_VERT, fragmentShader: CRACK_FRAG, uniforms: crackU, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
  const wireMat = new THREE.LineBasicMaterial({ color: 0xf6ece0, transparent: true, opacity: 0.85 });

  // Soft light behind the letters, in their own shape. The glass looks through it, so the letters read as lit
  // from behind, and a little of it spills out around them.
  const haloU = { tMask: { value: baked.mask }, uAmt: { value: 1 }, uAccent: { value: accent }, ...palU };
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, SPAN), new THREE.ShaderMaterial({
    uniforms: haloU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'precision highp float; varying vec2 vUv; uniform sampler2D tMask; uniform float uAmt; uniform vec3 uAccent,p_pale; void main(){ vec2 m=texture2D(tMask,vUv).rg; float g=m.g, r=m.r; gl_FragColor=vec4((vec3(.9,.93,1.)*g*g*.07+vec3(.92,.95,1.)*r*r*.035+uAccent*g*g*.006)*uAmt,1.); }',
  }));
  halo.position.z = -DEPTH / 2 - 0.03; halo.renderOrder = -1; root.add(halo);

  const shards = [], glass = [];
  const letters = data.letters.map((L, index) => {
    const all = L.contours.flatMap((c) => Array.from(c.pts));
    const [cx, cy] = center(all);
    const group = new THREE.Group(); group.position.set(cx, cy, 0); root.add(group);
    const whole = new THREE.Mesh(solid(L.shape, cx, cy, true), frontMat); whole.layers.set(GLASS); group.add(whole); glass.push(whole);
    whole.userData = { front: frontMat, back: backMat };

    // Shards are prebuilt and hidden until the moment of the burst.
    const wireParts = [];
    const list = L.shards.map((s) => {
      const [sx, sy] = center(s.rings[0]);
      const g = solid([s.rings], cx + sx, cy + sy);
      const mesh = new THREE.Mesh(g, shardFront); mesh.layers.set(GLASS); glass.push(mesh);
      mesh.userData = { front: shardFront, back: shardBack };
      mesh.position.set(sx, sy, 0); mesh.visible = false; mesh.frustumCulled = false; group.add(mesh);
      const wire = new THREE.WireframeGeometry(g), wp = wire.attributes.position;
      for (let i = 0; i < wp.count; i++) wireParts.push(wp.getX(i) + sx, wp.getY(i) + sy, wp.getZ(i));
      wire.dispose();
      const item = {
        mesh, area: polyArea(s.rings[0]), letter: index,
        p: new THREE.Vector3(), v: new THREE.Vector3(), axis: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), spin: 0,
        slot: new THREE.Vector3(), angle: 0, ring: 1, depth: 0, delay: 0, settle: 0, keep: false, age: 0, scale: 1, q: new THREE.Quaternion(), rate: 0.06 + R() * 0.1, phase: R() * 6.28,
        R: [R(), R(), R(), R(), R()],
      };
      shards.push(item);
      return item;
    });
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wireParts, 3));
    const wire = new THREE.LineSegments(wg, wireMat); wire.visible = false; wire.frustumCulled = false; wire.layers.set(GLASS); group.add(wire);

    // Crack lines drawn as thin ribbons on the front face.
    const P = [], A = [], I = [];
    const W = 0.0045, Z = DEPTH / 2 + 0.003;
    let v = 0;
    for (let i = 0; i < L.cracks.length; i += 4) {
      const [x0, y0, x1, y1] = [L.cracks[i], L.cracks[i + 1], L.cracks[i + 2], L.cracks[i + 3]];
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * W, ny = dx / l * W;
      P.push(x0 - nx - cx, y0 - ny - cy, Z, x0 + nx - cx, y0 + ny - cy, Z, x1 + nx - cx, y1 + ny - cy, Z, x1 - nx - cx, y1 - ny - cy, Z);
      A.push(x0, y0, x0, y0, x1, y1, x1, y1);
      I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); cg.setAttribute('aP', new THREE.Float32BufferAttribute(A, 2)); cg.setIndex(I);
    const cracks = new THREE.Mesh(cg, crackMat); cracks.visible = false; cracks.frustumCulled = false; cracks.renderOrder = 5; cracks.layers.set(GLASS); group.add(cracks);

    return {
      group, whole, wire, cracks, list, cx, cy, index,
      p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: 1, sv: 0,
      phase: R() * 6.28, rate: 0.5 + R() * 0.3, kick: -1,
    };
  });

  const st = { sp: new THREE.Vector2(), on: 0, phase: 'float', mx: 0, my: 0, hover: 0, hoverT: 0, active: 0, burstAt: 0, time: 0, mouseOn: false, ptr: new THREE.Vector2(), click: new THREE.Vector2(), view: { w: 7.4, h: 4.6 } };
  const v3 = new THREE.Vector3(), q5 = new THREE.Quaternion();

  const showShards = () => {
    letters.forEach((L) => { L.whole.visible = false; L.cracks.visible = false; L.list.forEach((s) => { s.mesh.visible = true; }); });
  };

  // Off-screen buffers for the glass to look through, at the quality in use.
  let quality = COARSE ? QUALITY.low : QUALITY.high;
  let size = { w: 2, h: 2 };
  const rtType = (renderer) => (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType);
  let bg = null, back = null;
  const buffers = (renderer) => {
    bg?.dispose(); back?.dispose();
    const type = rtType(renderer);
    bg = new THREE.WebGLRenderTarget(Math.max(2, Math.round(size.w * quality.bgScale)), Math.max(2, Math.round(size.h * quality.bgScale)), { type, depthBuffer: false });
    back = quality.back ? new THREE.WebGLRenderTarget(Math.max(2, Math.round(size.w * quality.backScale)), Math.max(2, Math.round(size.h * quality.backScale)), { type, samples: quality.msaa, depthBuffer: true }) : null;
    uniforms.uSamples.value = quality.samples;
  };

  const api = {
    root, letters, shards, uniforms, crackU, st, halo, haloU,
    setMode(mode) {
      // The other render styles belonged to the stone; glass draws only its beauty pass and a wireframe.
      const wire = mode === 'wireframe';
      letters.forEach((L) => { L.whole.visible = !wire; L.wire.visible = wire; });
      halo.visible = !wire;
    },
    // Rest pose for the entrance: letters sit back in depth and spring forward.
    settleIn() { letters.forEach((L, i) => { L.p.z = -0.5; L.p.y = -0.08; L.s = 0.97; L.kick = st.time + i * 0.03; }); },
    setActive(v) { st.active = v; },
    setHover(v) { st.hoverT = v ? 1 : 0; },
    setPointer(x, y, on) { st.ptr.set(x, y); st.mouseOn = on; },
    setView(w, h) {
      st.view.w = w; st.view.h = h;
      // How large the name looks next to a wide screen, where it fills 62% of the height.
      uniforms.uEnvK.value = THREE.MathUtils.clamp(data.height / (0.62 * h), 0.3, 1);
    },
    // Buffers follow the canvas size in device pixels.
    resize(w, h, dpr, renderer) { size = { w: Math.floor(w * dpr), h: Math.floor(h * dpr) }; buffers(renderer); },
    quality: () => (quality === QUALITY.low ? 'low' : 'high'),
    setQuality(level, renderer) { quality = QUALITY[level] || QUALITY.high; buffers(renderer); },
    // Draws the scene into target in up to three passes: the backdrop alone, then the back faces of the glass
    // bending it, then the front faces bending that. Other objects in the scene draw every time.
    render(renderer, scene, camera, target) {
      uniforms.uProj.value.copy(camera.projectionMatrix);
      camera.layers.set(0);
      renderer.setRenderTarget(bg); renderer.setClearColor(0x000000, 1); renderer.clear();
      renderer.render(scene, camera);
      camera.layers.enableAll();
      if (back) {
        glass.forEach((m) => { m.material = m.userData.back; });
        uniforms.uBuffer.value = bg.texture; uniforms.uBackPass.value = 1;
        renderer.setRenderTarget(back); renderer.clear();
        renderer.render(scene, camera);
        glass.forEach((m) => { m.material = m.userData.front; });
      }
      uniforms.uBuffer.value = (back || bg).texture; uniforms.uBackPass.value = 0;
      renderer.setRenderTarget(target); renderer.clear();
      renderer.render(scene, camera);
    },
    // Start the break from a point on the name.
    crack(x, y) {
      st.phase = 'crack'; st.click.set(x, y);
      crackU.uO.value.set(x, y); uniforms.uHot.value.set(x, y);
      letters.forEach((L) => { L.cracks.visible = true; });
    },
    burst() {
      st.phase = 'burst'; st.burstAt = st.time;
      root.updateMatrixWorld(true);
      const { w, h } = st.view;
      const sorted = [...shards].sort((a, b) => b.area - a.area);
      const keepN = Math.min(sorted.length, Math.max(26, Math.round(sorted.length * 0.36)));
      // The smallest crumbs are left out, so only real pieces of the letters fly.
      const crumbN = Math.round(sorted.length * 0.3);
      sorted.forEach((s, i) => { s.keep = i < keepN; s.order = i; s.crumb = i >= sorted.length - crumbN; });
      const spots = sorted.slice(0, keepN);
      spots.forEach((s, i) => {
        // A loose ring that leaves the middle of the screen open.
        const a = (i / keepN) * Math.PI * 2 * 3.0 + s.R[0] * 0.9;
        s.angle = a; s.ring = 0.82 + s.R[1] * 0.42;
        s.depth = -0.9 + s.R[2] * 1.5;
      });
      shards.forEach((s) => {
        s.mesh.getWorldPosition(s.p); s.mesh.getWorldQuaternion(s.q);
        scene.attach(s.mesh);
        s.mesh.position.copy(s.p); s.mesh.quaternion.copy(s.q);
        v3.set(s.p.x - st.click.x, s.p.y - st.click.y, 0);
        const dist = v3.length();
        v3.divideScalar(Math.max(dist, 0.001));
        const speed = (1.9 + s.R[0] * 3.2) * (1.5 / (0.55 + dist));
        s.v.set(v3.x * speed + (s.R[1] - 0.5) * 0.9, v3.y * speed + (s.R[2] - 0.5) * 0.9 + 0.25, 0.7 + s.R[3] * 3.4);
        s.spin = (2.2 + s.R[4] * 6) * (0.5 + 1 / (0.8 + dist));
        s.delay = dist * 0.05;
        s.settle = 0.72 + s.R[3] * 0.42;
        s.age = 0; s.scale = 1;
      });
      showShards();
      shards.forEach((s) => { if (s.crumb) { s.scale = 0; s.mesh.visible = false; } });
    },
    update(dt, t) {
      st.time = t;
      uniforms.uTime.value = t;
      st.hover += (st.hoverT - st.hover) * (1 - Math.exp(-7 * dt));
      if (st.phase === 'float' || st.phase === 'crack') {
        const calm = st.phase === 'crack' ? 0 : st.active;
        // The whole name tilts a little toward the pointer on a loose spring.
        const tiltX = -st.my * 0.05 * calm, tiltY = st.mx * 0.07 * calm; // small, so the name stays centred wherever the pointer is
        root.rotation.x += (tiltX + Math.sin(t * 0.43) * 0.016 * calm - root.rotation.x) * (1 - Math.exp(-3.4 * dt));
        root.rotation.y += (tiltY + Math.sin(t * 0.31 + 1) * 0.024 * calm - root.rotation.y) * (1 - Math.exp(-3.4 * dt));
        root.position.y = Math.sin(t * 0.72) * 0.065 * calm;
        // The pointer is followed smoothly, so the letters lean away from it without snapping.
        const ease = 1 - Math.exp(-4 * dt);
        st.sp.lerp(st.ptr, ease); st.on += ((st.mouseOn ? 1 : 0) - st.on) * (1 - Math.exp(-2.5 * dt));
        // Each letter floats on its own slow, out-of-phase drift, on a spring that never overshoots.
        letters.forEach((L) => {
          const amp = (0.034 + st.hover * 0.014) * calm;
          let tx = 0, ty = Math.sin(t * L.rate + L.phase) * amp, tz = (Math.sin(t * L.rate * 0.8 + L.phase * 2) * 0.05 + st.hover * 0.07) * calm;
          let trz = Math.sin(t * L.rate * 0.7 + L.phase * 3) * 0.012 * calm;
          if (st.on > 0.001 && calm) {
            const dx = L.cx - st.sp.x, dy = L.cy - st.sp.y, d = Math.hypot(dx, dy), f = (1 - smooth(0.15, 1.3, d)) * st.on;
            tx += (dx / Math.max(d, 0.1)) * f * 0.035; ty += (dy / Math.max(d, 0.1)) * f * 0.035; tz += f * 0.11;
            trz += -dx * f * 0.02;
          }
          const K = 40, C = 12.6; // stiffness and damping: critically damped, so no bounce
          L.v.x += (K * (tx - L.p.x) - C * L.v.x) * dt; L.v.y += (K * (ty - L.p.y) - C * L.v.y) * dt; L.v.z += (K * (tz - L.p.z) - C * L.v.z) * dt;
          L.p.addScaledVector(L.v, dt);
          L.w.z += (K * (trz - L.r.z) - C * L.w.z) * dt; L.r.z += L.w.z * dt;
          L.w.x += (K * (-L.v.y * 0.05 - L.r.x) - C * L.w.x) * dt; L.r.x += L.w.x * dt;
          L.sv += (K * (1 - L.s) - C * L.sv) * dt; L.s += L.sv * dt;
          L.group.position.set(L.cx + L.p.x, L.cy + L.p.y, L.p.z);
          // A slow turn of each letter moves the reflections across its bevels.
          L.group.rotation.set(L.r.x + Math.sin(t * L.rate * 0.53 + L.phase * 1.3) * 0.045 * calm, Math.sin(t * L.rate * 0.61 + L.phase) * 0.085 * calm, L.r.z);
          L.group.scale.setScalar(L.s);
        });
      } else {
        // Shards fly, then ease into their place in the ring. The rest shrink away.
        const { w, h } = st.view;
        const portrait = w < h;
        const rx = w * (portrait ? 0.47 : 0.45), ry = h * (portrait ? 0.43 : 0.43);
        shards.forEach((s) => {
          if (s.crumb) return;
          s.age += dt;
          if (s.age < s.delay) return;
          const a = s.age - s.delay;
          const hold = smooth(s.settle, s.settle + 1.15, a);
          if (s.keep) {
            const ang = s.angle + t * 0.022;
            s.slot.set(Math.cos(ang) * rx * s.ring + st.mx * 0.18 * (1.2 + s.depth * 0.3), Math.sin(ang) * ry * s.ring + st.my * 0.12 * (1.2 + s.depth * 0.3) + Math.sin(t * 0.6 + s.phase) * 0.05, s.depth);
            const k = 2.6 * hold;
            s.v.x += (s.slot.x - s.p.x) * k * dt; s.v.y += (s.slot.y - s.p.y) * k * dt; s.v.z += (s.slot.z - s.p.z) * k * dt;
            const drag = Math.exp(-(0.75 + hold * 1.7) * dt);
            s.v.multiplyScalar(drag);
          } else {
            s.v.multiplyScalar(Math.exp(-0.55 * dt));
            s.v.y -= 1.05 * dt;
            s.scale = 1 - smooth(0.7, 1.75 + s.R[2] * 0.5, a);
          }
          s.p.addScaledVector(s.v, dt);
          const spin = (s.keep ? THREE.MathUtils.lerp(s.spin, s.rate, hold) : s.spin) * dt;
          q5.setFromAxisAngle(s.axis, spin);
          s.q.premultiply(q5);
          s.mesh.position.copy(s.p); s.mesh.quaternion.copy(s.q);
          // Shards thin out as they fly, into slivers rather than blocks.
          const sc = Math.max(0.0001, s.scale);
          s.mesh.scale.set(sc, sc, sc * (1 - 0.82 * smooth(0, 0.45, a)));
          s.mesh.visible = s.scale > 0.002;
        });
      }
    },
  };
  return api;
}
