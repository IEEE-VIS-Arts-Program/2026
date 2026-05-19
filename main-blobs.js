const toggle = document.querySelector("#toggle");
const nav = document.querySelector("body > nav");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  const menuLinks = document.querySelectorAll("#menu a");
  menuLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (nav.classList.contains("open")) {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  });
}

// ── Hero background: metaball layout sampled from sketch.svg ────────────────
const PALETTE = {
  teal: "C_TEAL",
  orange: "C_ORANGE",
  lavender: "C_LAVENDER",
  yellow: "C_YELLOW",
  pink: "C_PINK",
};
const OPACITY = 0.6; // per-color blend strength
const SPREAD = 1; // sphere-spacing multiplier — 1.0 = baked layout, >1 = farther apart
const CLUMP = 4; // sub-spheres per baked blob — they orbit & merge into one metaball
const CLUMP_R = 0.55; // sub-orbit radius as a fraction of the blob's own radius
const CLUMP_SP = 0.5; // sub-sphere base angular speed (rad/s) around the centre
const SPD_VAR = 0.55; // ± fraction the per-sphere spin speed varies (noise)
const SIZE_VAR = 0.35; // ± fraction each sphere's size varies (noise)
const WOBBLE = 0.15; // noise breathing of cluster spread over time (0 = off)
const SPEED = 0.7; // global animation tempo — <1 slower, 1 = original, >1 faster
const RES = 0.85; // internal render scale — 1.0 = native sharpness, lower = faster

// Blob layout baked from sketch.svg (equal-area circles, paint-order sorted).
// sketch.svg is no longer read at runtime. To regenerate after editing the
// SVG, re-run the old getTotalLength/shoelace extraction in a browser (the
// blobs() routine in git history) and paste its JSON output here.
const LAYERS = [
/*
  {
    color: "teal",
    blobs: [
      {
        fx: 0.6533892667129327,
        fy: 0.557839811144196,
        A: 11.603034642344756,
        B: 0,
        D: 11.603034642344756,
      },
      {
        fx: 0.20458072830094914,
        fy: 0.13710950636465538,
        A: 47.27500008635689,
        B: 0,
        D: 47.27500008635689,
      },
      {
        fx: 0.4387076207356397,
        fy: 0.885872427212848,
        A: 825.7293679467969,
        B: 0,
        D: 825.7293679467969,
      },
    ],
  },
*/
  {
    color: "lavender",
    blobs: [
      {
        fx: 0.5,
        fy: 0.5,
        A: 80.0,
        B: 2.0,
        D: 20.0,
      }
/*,
      {
        fx: 0.46278696054475854,
        fy: 0.564164918339559,
        A: 72.91663938982117,
        B: 0,
        D: 72.91663938982117,
      },
      {
        fx: 0.14759822113225227,
        fy: 0.3820170972742382,
        A: 126.41770713564458,
        B: 0,
        D: 126.41770713564458,
      }
*/
    ],
  }
/*,
  {
    color: "yellow",
    blobs: [
      {
        fx: 0.21392174316513965,
        fy: 0.7602202030238026,
        A: 20.72515653926128,
        B: 0,
        D: 20.72515653926128,
      },
      {
        fx: 0.3672185913877172,
        fy: 0.1978274903348792,
        A: 99.193300590501,
        B: 0,
        D: 99.193300590501,
      },
      {
        fx: 0.8671221958105809,
        fy: 0.5437643750069042,
        A: 262.0308068829056,
        B: 0,
        D: 262.0308068829056,
      },
      {
        fx: 0.6883223601565908,
        fy: 0.34565670235712914,
        A: 410.48989743572895,
        B: 0,
        D: 410.48989743572895,
      },
    ],
  },
  {
    color: "lavender",
    blobs: [
      {
        fx: 0.8545886573490123,
        fy: 0.8484774371962233,
        A: 53.07607780203845,
        B: 0,
        D: 53.07607780203845,
      },
      {
        fx: 0.5435612081742,
        fy: 0.8306345329394453,
        A: 76.69333474327499,
        B: 0,
        D: 76.69333474327499,
      },
      {
        fx: 0.8962312071144286,
        fy: 0.09203332642201652,
        A: 252.10798463779886,
        B: 0,
        D: 252.10798463779886,
      },
      {
        fx: 0.26456352553113516,
        fy: 0.2852400263202124,
        A: 1376.7544880862765,
        B: 0,
        D: 1376.7544880862765,
      },
    ],
  },
  {
    color: "pink",
    blobs: [
      {
        fx: 0.9374563543030439,
        fy: 0.7544763924209188,
        A: 1291.7641073560046,
        B: 0,
        D: 1291.7641073560046,
      },
      {
        fx: 0.3846261557992157,
        fy: 0.7772792047706668,
        A: 414.30399094436007,
        B: 0,
        D: 414.30399094436007,
      },
    ],
  }
*/
];

// orbit/cover constants — must match the ex-GLSL ctr()/orb() exactly
const SVGA = 860 / 592;
const ORBIT_R = 0.06;
const ORBIT_SP = 0.16;
const TAU = 6.28318530718;
// deterministic per-index hash in [0,1) — cheap noise source for sub-sphere jitter
const noise = (n) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

const canvas = document.querySelector("#bg");
const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });

if (gl) {
  boot();
} else {
  console.warn("WebGL2 unavailable — hero stays flat.");
}

async function boot() {
  const [vs, chunk, tmpl] = await Promise.all([
    fetch("./shaders/vs.glsl").then((r) => r.text()),
    fetch("./shaders/chunk.glsl").then((r) => r.text()),
    fetch("./shaders/display.glsl").then((r) => r.text()),
  ]);

  const { meta, src } = inject(tmpl, LAYERS);
  const prog = program(vs, "#version 300 es\n" + chunk + "\n" + src);

  // bake pass: the exact 21-tap static grain kernel, written once to a texture
  const bakeFS = `
out vec4 o;
void main(){
  const float GRAIN_PX = 0.25;
  vec2  gco = gl_FragCoord.xy / GRAIN_PX;
  float g = ( grainCell(gco)
            + grainCell(gco + vec2( 5.0, 0.0))
            + grainCell(gco + vec2(-5.0, 0.0))
            + grainCell(gco + vec2( 0.0, 5.0))
            + grainCell(gco + vec2( 0.0,-5.0))
            + grainCell(gco + vec2( 3.5, 3.5))
            + grainCell(gco + vec2(-3.5, 3.5))
            + grainCell(gco + vec2( 3.5,-3.5))
            + grainCell(gco + vec2(-3.5,-3.5))
            + grainCell(gco + vec2( 8.0, 0.0))
            + grainCell(gco + vec2(-8.0, 0.0))
            + grainCell(gco + vec2( 0.0, 8.0))
            + grainCell(gco + vec2( 0.0,-8.0))
            + grainCell(gco + vec2( 5.5, 5.5))
            + grainCell(gco + vec2(-5.5, 5.5))
            + grainCell(gco + vec2( 5.5,-5.5))
            + grainCell(gco + vec2(-5.5,-5.5))
            + grainCell(gco + vec2(11.0, 0.0))
            + grainCell(gco + vec2(-11.0, 0.0))
            + grainCell(gco + vec2( 0.0,11.0))
            + grainCell(gco + vec2( 0.0,-11.0)) ) * (1.0/21.0);
  o = vec4(g * u_genc.x + u_genc.y);
}`;
  const gprog = program(
    vs,
    "#version 300 es\n" + chunk + "\nuniform vec2 u_genc;\n" + bakeFS,
  );

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // grain-texture format: R16F (bit-exact) where renderable, else R8 (≤1/255)
  const flt =
    gl.getExtension("EXT_color_buffer_float") ||
    gl.getExtension("EXT_color_buffer_half_float");
  const FMT =
    flt ?
      { internal: gl.R16F, type: gl.HALF_FLOAT, enc: [1, 0], dec: [1, 0] }
      : {
        internal: gl.R8,
        type: gl.UNSIGNED_BYTE,
        enc: [0.25, 0.5],
        dec: [4.0, -2.0],
      };
  console.info("grain bake:", flt ? "R16F (exact)" : "R8 (fallback)");

  const gtex = gl.createTexture();
  const gfbo = gl.createFramebuffer();

  const uRes = gl.getUniformLocation(prog, "u_res");
  const uFil = gl.getUniformLocation(prog, "u_fil");
  const uTime = gl.getUniformLocation(prog, "u_time");
  const uS = gl.getUniformLocation(prog, "u_s");
  const uCtr = gl.getUniformLocation(prog, "u_ctr");
  const uGrain = gl.getUniformLocation(prog, "u_grain");
  const uGdec = gl.getUniformLocation(prog, "u_gdec");
  const uRipples = gl.getUniformLocation(prog, "u_ripples");
  const uGenc = gl.getUniformLocation(gprog, "u_genc");

  // one-time GL state — never changes per frame
  gl.useProgram(gprog);
  gl.uniform2f(uGenc, FMT.enc[0], FMT.enc[1]);
  gl.useProgram(prog);
  gl.uniform1i(uGrain, 0);
  gl.uniform2f(uGdec, FMT.dec[0], FMT.dec[1]);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gtex);
  gl.bindVertexArray(vao);

  let fil = [0.5, 0.5];
  let S = 0;
  const ctr = new Float32Array(meta.length * 2);

  // CPU port of the ex-GLSL ctr()+orb(): orbited scene-uv centre per blob.
  // double precision ≥ GPU float; the shared 5-dp literal rounding (baked into
  // `meta`) is matched on both sides, so positions stay sub-pixel identical.
  function centers(t) {
    for (let j = 0; j < meta.length; j++) {
      const m = meta[j];
      const cx = (m.fx - 0.5) * SPREAD * SVGA * S;
      const cy = (0.5 - m.fy) * SPREAD * S;
      const a = t * ORBIT_SP + m.ph * TAU;
      // cluster centroid — the old single-sphere drift, shared by all siblings
      const wx =
        cx + ORBIT_R * (Math.cos(a) + 0.45 * Math.cos(a * 0.41 + m.ph));
      const wy =
        cy + ORBIT_R * (Math.sin(a) + 0.45 * Math.sin(a * 0.57 + m.ph * 2.0));
      // sub-sphere rotating around that centroid → siblings orbit & merge,
      // each at its own noise-jittered speed, with a gentle breathing spread
      const r = CLUMP_R * S * m.rad * (1 + WOBBLE * Math.sin(t * 0.5 + m.wph));
      const g = m.sa + t * CLUMP_SP * m.sp + m.ph * TAU;
      ctr[j * 2] = wx + r * Math.cos(g);
      ctr[j * 2 + 1] = wy + r * Math.sin(g);
    }
    return ctr;
  }

  // re-bake the static grain at the current resolution, then restore display
  // state (the bake pass swaps program/FBO/viewport).
  function bake() {
    const w = canvas.width,
      h = canvas.height;
    gl.bindTexture(gl.TEXTURE_2D, gtex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      FMT.internal,
      w,
      h,
      0,
      gl.RED,
      FMT.type,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, gfbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      gtex,
      0,
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      console.warn("grain FBO incomplete — grain may not render");
    gl.viewport(0, 0, w, h);
    gl.useProgram(gprog);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr * RES));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr * RES));
    const sized = canvas.width !== w || canvas.height !== h;
    if (sized) {
      canvas.width = w;
      canvas.height = h;
    }
    const a = w / h;
    fil = a >= 1 ? [0.5 * a, 0.5] : [0.5, 0.5 / a];
    S = Math.max((2 * fil[0]) / SVGA, 2 * fil[1]);
    gl.useProgram(prog);
    gl.uniform2f(uRes, w, h);
    gl.uniform2f(uFil, fil[0], fil[1]);
    gl.uniform1f(uS, S);
    if (sized) bake();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  centers(0); // warm ctr so heroBlobs() is valid before the first frame

  // live blob screen positions (client px), grouped by colour — the audio
  // proximity engine reads this instead of DOM .blob-* elements.
  window.heroBlobs = () => {
    const r = canvas.getBoundingClientRect();
    const fx2 = 2 * fil[0],
      fy2 = 2 * fil[1];
    const out = { teal: [], orange: [], yellow: [], lavender: [], pink: [] };
    for (let j = 0; j < meta.length; j++) {
      const g = out[meta[j].c];
      if (!g) continue;
      const nx = ctr[j * 2] / fx2 + 0.5;
      const ny = ctr[j * 2 + 1] / fy2 + 0.5;
      g.push({ x: r.left + nx * r.width, y: r.top + (1 - ny) * r.height });
    }
    return out;
  };

  let inview = false;
  let looping = false;
  function kick() {
    const run = inview && !document.hidden;
    if (run && !looping) {
      looping = true;
      requestAnimationFrame(loop);
    }
  }
  new IntersectionObserver(
    ([e]) => {
      inview = e.isIntersecting;
      kick();
    },
    { threshold: 0 },
  ).observe(canvas);
  document.addEventListener("visibilitychange", kick);

  const t0 = performance.now();

  const MAX_RIPPLES = 10;
  const ripples = new Float32Array(MAX_RIPPLES * 3);
  let rippleIdx = 0;
  let lastRippleTime = 0;
  let lastRippleX = -1000;
  let lastRippleY = -1000;

  document.getElementById("hero")?.addEventListener("mousemove", (e) => {
    if (window.innerWidth < 768) return;
    const t = ((performance.now() - t0) / 1000) * SPEED;
    const dx = e.clientX - lastRippleX;
    const dy = e.clientY - lastRippleY;
    const dist = Math.hypot(dx, dy);

    // Only drop a ripple if mouse moved enough distance and time has passed
    if (dist > 40 && t - lastRippleTime > 0.05) {
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = 1.0 - (e.clientY - rect.top) / rect.height;
      const uvx = (nx - 0.5) * 2.0 * fil[0];
      const uvy = (ny - 0.5) * 2.0 * fil[1];

      ripples[rippleIdx * 3 + 0] = uvx;
      ripples[rippleIdx * 3 + 1] = uvy;
      ripples[rippleIdx * 3 + 2] = t;

      rippleIdx = (rippleIdx + 1) % MAX_RIPPLES;
      lastRippleTime = t;
      lastRippleX = e.clientX;
      lastRippleY = e.clientY;
    }
  });

  function loop() {
    if (!(inview && !document.hidden)) {
      looping = false;
      return;
    }
    const t = ((performance.now() - t0) / 1000) * SPEED;
    gl.uniform2fv(uCtr, centers(t));
    gl.uniform1f(uTime, t);
    gl.uniform3fv(uRipples, ripples);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(loop);
  }

  function inject(srcTmpl, layers) {
    const f = (x) => x.toFixed(5);
    let fields = "";
    let composite = "";
    let k = 0; // global u_ctr index (one slot per sub-sphere)
    let pk = 0; // per-blob counter → golden-ratio cluster phase
    const meta = []; // [{fx,fy,ph,rad,sa}] in global k order
    for (const { color, blobs } of layers) {
      const name = PALETTE[color];
      const adds = blobs
        .flatMap((b) => {
          const fx = Number(f(b.fx));
          const fy = Number(f(b.fy));
          const ph = Number(f((pk++ * 0.6180339887) % 1));
          const rad = 1 / Math.sqrt(b.A); // blob radius ∝ 1/√A (in scene-uv ÷ s)
          const B = f(b.B);
          const lines = [];
          for (let i = 0; i < CLUMP; i++) {
            // noise-jittered per sub-sphere: spin speed, size, wobble phase
            const sp = 1 + SPD_VAR * (noise(k * 1.7 + 0.5) * 2 - 1);
            const sz = 1 + SIZE_VAR * (noise(k * 1.7 + 9.3) * 2 - 1);
            const wph = noise(k * 1.7 + 3.1) * TAU;
            meta.push({
              c: color,
              fx,
              fy,
              ph,
              rad,
              sa: (i * TAU) / CLUMP,
              sp,
              wph,
            });
            // split area across CLUMP, then scale radius by sz (A ∝ 1/r²)
            const A = f((b.A * CLUMP) / (sz * sz));
            const D = f((b.D * CLUMP) / (sz * sz));
            lines.push(`  f += ell(p, u_ctr[${k}], ${A}, ${B}, ${D}, u_s);`);
            k++;
          }
          return lines;
        })
        .join("\n");
      fields += `float fld_${name}(vec2 p){\n  float f = 0.0;\n${adds}\n  return f;\n}\n`;
      composite +=
        `  col = mix(col, ${name}, ` +
        `smoothstep(1.0 - mix(0.40, 0.11, n), 1.0 + mix(0.40, 0.11, n), ` +
        `fld_${name}(puv)) * ${f(OPACITY)});\n`;
    }
    const decl = `uniform vec2 u_ctr[${k}];\n`;
    return {
      meta,
      src: srcTmpl
        .replace("//__FIELDS__", decl + fields)
        .replace("//__COMPOSITE__", composite),
    };
  }

  function shader(type, code) {
    const s = gl.createShader(type);
    gl.shaderSource(s, code);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s) + "\n" + code);
    return s;
  }
  function program(v, frag) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, v));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, "a_pos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
}
