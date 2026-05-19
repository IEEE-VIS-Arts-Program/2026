// VISAP palette
vec3 C_YELLOW   = vec3(0.894, 0.863, 0.208);
vec3 C_ORANGE   = vec3(0.965, 0.416, 0.345);
vec3 C_PINK     = vec3(0.941, 0.424, 0.471);
vec3 C_LAVENDER = vec3(0.714, 0.408, 0.863);
vec3 C_TEAL     = vec3(0.024, 0.247, 0.259);
vec3 GROUND     = vec3(0.929, 0.882, 0.839);

uniform sampler2D u_grain;   // baked static film grain (one texel per pixel)
uniform vec2      u_gdec;    // grain decode (mul, add) — undoes the bake-store remap
uniform float     u_s;       // cover-scale (recomputed on resize)

#define MAX_RIPPLES 10
uniform vec3      u_ripples[MAX_RIPPLES]; // interactive ripples from mouse

// oriented metaball: (A,B,D) is the path's equal-area ellipse as a quadratic
// form; the Q=1 contour matches the path's area, elongation and tilt.
// centre c is the orbited scene-uv position, precomputed on the CPU each frame.
float ell(vec2 p, vec2 c, float A, float B, float D, float s){
  vec2 d = p - c;
  float Q = (A*d.x*d.x - 2.0*B*d.x*d.y + D*d.y*d.y) / (s*s);
  return 1.0 / (Q + 1e-3);
}

//__FIELDS__

out vec4 outColor;
void main(){
  vec2  uv  = fragUv();

  float nf  = perlin(uv*1.8 + vec2(u_time*0.020, -u_time*0.015)) * 0.5 + 0.5;
  vec2  puv = uv;

  // calculate and apply ripple distortion
  vec2 rippleWarp = vec2(0.0);
  for(int i=0; i<MAX_RIPPLES; i++) {
    vec3 r = u_ripples[i];
    if (r.z > 0.0) {
      float age = u_time - r.z;
      if (age > 0.0 && age < 1.5) {
        vec2 d = uv - r.xy;
        float dist = length(d);
        
        float radius = age * 0.22;
        float wave = sin((dist - radius) * 35.0);
        
        float env = smoothstep(0.08, 0.0, abs(dist - radius));
        env *= exp(-age * 2.2); 
        env *= smoothstep(0.5, 0.0, dist);
        
        rippleWarp += d * wave * env * 0.14;
      }
    }
  }
  puv -= rippleWarp;

  float n   = smoothstep(0.46, 0.54, nf);

  vec3 col = GROUND;
//__COMPOSITE__

  // film grain — baked once to a screen-space texture; modulated by live luma
  float lum   = dot(col, vec3(0.299, 0.587, 0.114));
  float grain = texelFetch(u_grain, ivec2(gl_FragCoord.xy), 0).r * u_gdec.x + u_gdec.y;
  col += grain * 0.22 * (0.4 + 0.6 * (1.0 - abs(lum * 2.0 - 1.0)));

  outColor = vec4(col, 1.0);
}
