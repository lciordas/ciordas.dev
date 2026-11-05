// Procedural placeholder figure: a faceless sculpted bust plus a patterned shell.
// Set hero.portrait and hero.portraitReveal in content.js to use real images instead.
import * as THREE from 'three';

const raw = (hex) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);

const NOISE = /* glsl */`
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm3(vec3 p){return .6*vnoise(p)+.3*vnoise(p*2.03+7.)+.1*vnoise(p*4.1+3.);}
`;

const VERT = /* glsl */`
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main(){ vP=position; vN=normalize(normalMatrix*normal);
 vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`;

const gauss = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) ** 2) / (2 * sx * sx) + ((y - cy) ** 2) / (2 * sy * sy)));

export function headGeometry() {
  const g = new THREE.SphereGeometry(1, 128, 128);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = y;
    const jaw = n < 0 ? 1 - 0.3 * Math.pow(-n, 1.6) : 1 - 0.05 * n * n;
    x *= jaw * 0.8;
    z *= n < 0 ? 1 - 0.14 * Math.pow(-n, 1.5) : 1;
    y *= 1.22;
    if (z < 0) z *= 1.08;
    if (z > 0) {
      const f = Math.min(1, z * 1.6);
      z += f * 0.1 * gauss(x, y, 0, -0.24, 0.09, 0.3);
      z += f * 0.025 * gauss(x, y, 0, 0.28, 0.44, 0.1);
      z -= f * 0.035 * gauss(Math.abs(x), y, 0.3, 0.1, 0.17, 0.12);
      z += f * 0.02 * gauss(x, y, 0, -0.66, 0.2, 0.09);
      z += f * 0.05 * gauss(x, y, 0, -0.98, 0.2, 0.1);
      z += f * 0.03 * gauss(Math.abs(x), y, 0.46, -0.34, 0.16, 0.14);
    }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

function torsoGeometry() {
  const pts = [[0, 0.3], [0.56, 0.3], [0.64, 0.05], [0.7, -0.22], [0.86, -0.44], [1.35, -0.62], [2.2, -0.82], [2.95, -1.2], [3.25, -2.0], [3.3, -3.2], [3.2, -6], [0, -6]]
    .map(([r, y]) => new THREE.Vector2(r, y)).reverse();
  const g = new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(96), 96);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (1 - 0.46 * THREE.MathUtils.smoothstep(-p.getY(i), 0.3, 1.2)));
  g.computeVertexNormals();
  return g;
}

export function clayMaterial(color = '#dcd6cd', face = false) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: raw(color) }, uFace: { value: face ? 1 : 0 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform vec3 uC; uniform float uFace;
      float seg(vec2 p,vec2 a,vec2 b,float bend){ vec2 ba=b-a; float h=clamp(dot(p-a,ba)/dot(ba,ba),0.,1.);
        vec2 q=a+ba*h; q.y+=bend*4.*h*(1.-h); return length(p-q); }
      void main(){ vec3 n=normalize(vN);
        float key=.5+.5*dot(n,normalize(vec3(-.45,.62,.66)));
        float fill=.5+.5*dot(n,normalize(vec3(.7,.1,.5)));
        float rim=pow(1.-max(dot(n,vV),0.),3.);
        float light=.34+.62*key*key+.14*fill*fill;
        vec3 c=uC*mix(vec3(.72,.68,.66),vec3(1.05,1.03,1.),light)*light;
        if(uFace>.5&&vP.z>.2){
          vec2 f=vec2(abs(vP.x),vP.y);
          float k=0.;
          k=max(k,smoothstep(.016,.003,seg(f,vec2(.17,.13),vec2(.5,.14),-.02)));   // closed lids
          k=max(k,.55*smoothstep(.022,.004,seg(f,vec2(.15,.27),vec2(.54,.27),.045))); // brows
          k=max(k,smoothstep(.014,.002,seg(f,vec2(0.,-.66),vec2(.2,-.655),.012)));   // mouth
          k=max(k,.6*smoothstep(.012,.002,seg(f,vec2(0.,-.42),vec2(.075,-.36),-.012))); // nose base
          c*=1.-k*.62;
        }
        gl_FragColor=vec4(c+rim*.05,1.); }`,
  });
}

export function shellMaterial({ palette = ['#d2ff00', '#111112'], seed = 0, ghost = false } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: !ghost,
    side: ghost ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: { uA: { value: raw(palette[0]) }, uB: { value: raw(palette[1]) }, uSeed: { value: seed }, uGhost: { value: ghost ? 1 : 0 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform vec3 uA,uB; uniform float uSeed,uGhost;
      ${NOISE}
      void main(){
        vec3 n=normalize(vN);
        float fres=pow(1.-abs(dot(n,vV)),2.2);
        if(uGhost>.5){
          float rib=smoothstep(.012,.0,abs(abs(vP.y-.18)-.2))*smoothstep(0.,.3,vP.z);
          float a=clamp(pow(fres,1.6)*.42+rib*.16,0.,.5)*smoothstep(-.98,-.5,vP.y);
          gl_FragColor=vec4(vec3(.5,.51,.48),a); return;
        }
        float h=fbm3(vP*1.2+uSeed+vec3(0.,0.,2.));
        float ink=smoothstep(.13,.17,abs(fract(h*7.)-.5));
        vec3 c=mix(uB,uA,ink);
        float vis=smoothstep(.2,.18,abs(vP.y-.18))*smoothstep(.15,.3,vP.z);
        vec3 refl=mix(vec3(.02),vec3(.96),smoothstep(.45,.5,sin(vP.x*9.+.6+n.y*3.)*.5+.5));
        c=mix(c,refl,vis);
        c=mix(c,vec3(.02),smoothstep(.015,.0,abs(abs(vP.y-.18)-.2))*smoothstep(.1,.25,vP.z));
        vec3 L=normalize(vec3(.3,.8,.6));
        float dif=.62+.5*max(dot(n,L),0.);
        float spec=pow(max(dot(reflect(-L,n),vV),0.),36.);
        gl_FragColor=vec4(c*dif+spec*.5+fres*.12,1.);
      }`,
  });
}

export function patternMaterial({ palette = ['#a59d91', '#1d1c1a'], seed = 3, scale = 1.3, bands = 6, grain = true } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uA: { value: raw(palette[0]) }, uB: { value: raw(palette[1]) }, uSeed: { value: seed }, uS: { value: scale }, uBands: { value: bands }, uG: { value: grain ? 1 : 0 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform vec3 uA,uB; uniform float uSeed,uS,uBands,uG;
      ${NOISE}
      void main(){
        vec3 n=normalize(vN);
        float h=fbm3(vP*uS+uSeed);
        vec3 c=mix(uB,uA,smoothstep(.18,.23,abs(fract(h*uBands)-.5)));
        c*=1.+uG*(.28*vnoise(vP*80.)-.14);
        vec3 L=normalize(vec3(-.2,.7,.8));
        float d=.5+.62*max(dot(n,L),0.);
        float spec=(1.-uG)*pow(max(dot(reflect(-L,n),vV),0.),28.)*.6;
        float rim=pow(1.-max(dot(n,vV),0.),3.)*.1;
        gl_FragColor=vec4(c*d+spec+rim,1.);
      }`,
  });
}

export function buildFigure({ skin = '#dcd6cd', jacket = ['#a59d91', '#1d1c1a'], shell = ['#d2ff00', '#111112'], seed = 0 } = {}) {
  const bust = new THREE.Group();
  const head = new THREE.Mesh(headGeometry(), clayMaterial(skin));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.9, 48), clayMaterial(skin));
  neck.position.y = -1.2;
  const torso = new THREE.Mesh(torsoGeometry(), patternMaterial({ palette: jacket, seed: 4 + seed, scale: 1.55, bands: 7 }));
  torso.position.y = -1.42;
  bust.add(neck, head, torso);

  const shellG = new THREE.SphereGeometry(1.36, 96, 96, 0, Math.PI * 2, 0, Math.PI * 0.74);
  const sp = shellG.attributes.position;
  for (let i = 0; i < sp.count; i++) { sp.setY(i, sp.getY(i) * 1.18); sp.setZ(i, sp.getZ(i) * 1.06); }
  shellG.computeVertexNormals();
  const solidShell = new THREE.Mesh(shellG, shellMaterial({ palette: shell, seed }));
  const ghostShell = new THREE.Mesh(shellG, shellMaterial({ ghost: true }));
  solidShell.position.y = ghostShell.position.y = 0.14;
  return { bust, head, solidShell, ghostShell };
}
