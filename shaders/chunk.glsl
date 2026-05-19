precision highp float;
uniform vec2  u_res;     // render-target size (px)
uniform vec2  u_fil;     // scene-uv half-extent (canvas aspect)
uniform float u_time;

vec2 fragUv()              { return (gl_FragCoord.xy/u_res - 0.5) * 2.0 * u_fil; }

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
vec2  grd(vec2 p){ float h=hash(p)*6.2832; return vec2(cos(h),sin(h)); }
float perlin(vec2 p){
  vec2 i=floor(p), f=fract(p), u=f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(dot(grd(i),          f          ), dot(grd(i+vec2(1,0)), f-vec2(1,0)), u.x),
             mix(dot(grd(i+vec2(0,1)),f-vec2(0,1)), dot(grd(i+vec2(1,1)), f-vec2(1  )), u.x), u.y);
}

// PCG2D — strong-avalanche integer hash (Jarzynski & Olano, JCGT 2020).
uvec2 pcg2d(uvec2 v){
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u;  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u;  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v;
}
float grainG(uvec2 p){
  uvec2 h  = pcg2d(p);
  float u1 = float(h.x) * (1.0/4294967295.0);
  float u2 = float(h.y) * (1.0/4294967295.0);
  return sqrt(-2.0 * log(max(u1, 1e-6))) * cos(6.28318530718 * u2);
}
float grainCell(vec2 g){
  vec2 i = floor(g), f = g - i;
  f = f*f*(3.0-2.0*f);
  uvec2 I = uvec2(i);
  float a = grainG(I);
  float b = grainG(I + uvec2(1u,0u));
  float c = grainG(I + uvec2(0u,1u));
  float d = grainG(I + uvec2(1u,1u));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
