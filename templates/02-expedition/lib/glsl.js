// Shared GLSL chunks.
export const NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float hash13(vec3 p3){ p3=fract(p3*.1031); p3+=dot(p3,p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
float vn2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x),f.y); }
float vn3(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x),mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm2(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vn2(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }
float fbm3(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn3(p); p=p*2.07+vec3(11.3,4.7,8.1); a*=.5; } return s; }
`;

// Cold, soft, overcast light. Linear output.
export const LIGHT = /* glsl */ `
const vec3 SUN_DIR = normalize(vec3(-.45,.72,.53));
vec3 overcast(vec3 albedo, vec3 N, vec3 V, float rough, float spec){
  float h = N.y*.5+.5;
  vec3 amb = mix(vec3(.26,.29,.36), vec3(.80,.85,.95), h);
  float d = max(dot(N,SUN_DIR),0.);
  vec3 c = albedo*(amb + vec3(1.05,1.05,1.1)*d*.75);
  vec3 H = normalize(SUN_DIR+V);
  float m = pow(max(dot(N,H),0.), mix(90.,12.,rough));
  c += vec3(.9,.95,1.)*m*spec;
  float fr = pow(1.-max(dot(N,V),0.),4.);
  c += vec3(.55,.6,.72)*fr*.35;
  return c;
}
`;

// Screen-space noisy wipe shared by world materials and the final pass.
export const WIPE = /* glsl */ `
uniform float uCut;
uniform vec2 uRes;
uniform float uTime;
float wipeField(vec2 uv){ return uv.y + (fbm2(uv*vec2(3.,5.)+uTime*.035)-.5)*.55; }
void wipeDiscard(){
  if(uCut<=-.5) return;
  vec2 uv=gl_FragCoord.xy/uRes;
  float f=wipeField(uv);
  float keep=smoothstep(0.,.07,f-uCut);
  if(keep<.999 && hash12(gl_FragCoord.xy+fract(uTime)*91.)>keep) discard;
}
`;

// Stone relief: returns a height sample used for finite-difference normals.
export const STONE = /* glsl */ `
float stoneH(vec3 p){
  float big=vn3(p*.85)*1.;
  float mid=vn3(p*2.6+3.)*.42;
  float fine=vn3(p*7.3+7.)*.16;
  float grit=vn3(p*19.+1.)*.055;
  return big+mid+fine+grit;
}
vec3 stoneNormal(vec3 N, vec3 p, float k){
  const float e=.022;
  float h0=stoneH(p);
  vec3 g=vec3(stoneH(p+vec3(e,0,0))-h0, stoneH(p+vec3(0,e,0))-h0, stoneH(p+vec3(0,0,e))-h0)/e;
  g-=N*dot(g,N);
  return normalize(N-g*k);
}
`;

export const hexToLinear = (hex) => {
  const c = parseInt(hex.slice(1), 16);
  const f = (v) => Math.pow(v / 255, 2.2);
  return [f((c >> 16) & 255), f((c >> 8) & 255), f(c & 255)];
};
