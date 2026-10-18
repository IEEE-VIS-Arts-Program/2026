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

// ── Hero background: metaball layout for A4 vertical canvas ────────────────
const PALETTE = {
  purple: "C_LAVENDER",
  lavender: "C_LAVENDER",
  teal: "C_TEAL",
  orange: "C_ORANGE",
  yellow: "C_YELLOW",
  pink: "C_PINK",
};

const OPACITY = 0.72; // blend strength for the purple blob
const SPREAD = 1.0; // layout scale multiplier
const CLUMP = 4; // sub-spheres — they orbit & merge into one organic rounded metaball
const CLUMP_R = 0.16; // tight sub-orbit radius to keep the blob distinctly rounded and smooth
const CLUMP_SP = 0.45; // sub-sphere angular speed (rad/s)
const SPD_VAR = 0.45; // ± fraction the per-sphere spin speed varies
const SIZE_VAR = 0.25; // ± fraction each sphere's size varies
const WOBBLE = 0.12; // subtle breathing wobble of the rounded contour
const SPEED = 0.75; // animation tempo
const RES = 1.0; // render scale: 1.0 for crisp sharpness

// Only one oval purple blob from the palette:
// - fx: 0.50, fy: 0.50 (centered on the vertical A4 canvas)
// - A = 28.0, D = 84.0 (horizontal oval with ~1.73 : 1 width-to-height ratio)
// - Gentle floating motion and organic breathing surface
const LAYERS = [
  {
    color: "purple",
    blobs: [
      {
        fx: 0.50,
        fy: 0.50,
        A: 28.0,
        B: 0.0,
        D: 84.0,
        orbitR: 0.025,
        orbitSp: 0.20,
        freqX: 1.0,
        freqY: 1.2,
        clumpR: 0.16,
      },
    ],
  },
];

// Vertical A4 aspect ratio (210mm / 297mm = 1 / √2)
const SVGA = 210 / 297;
const ORBIT_R = 0.05;
const ORBIT_SP = 0.25;
const TAU = 6.28318530718;

// Deterministic per-index hash in [0,1)
const noise = (n) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

const canvas = document.querySelector("#bg");
const gl = canvas ? canvas.getContext("webgl2", { antialias: false, alpha: false }) : null;

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

  // Adjust shared colors in memory to match the website palette from style.css
  const adjustedTmpl = tmpl
    .replace("vec3 C_TEAL     = vec3(0.024, 0.247, 0.259);", "vec3 C_TEAL     = vec3(0.024, 0.247, 0.259);")  // Website --teal: #063f42
    .replace("vec3 C_LAVENDER = vec3(0.714, 0.408, 0.863);", "vec3 C_LAVENDER = vec3(0.714, 0.408, 0.863);")  // Website --purple: #b668dc
    .replace("vec3 C_ORANGE   = vec3(0.965, 0.416, 0.345);", "vec3 C_ORANGE   = vec3(0.965, 0.514, 0.431);")  // Website --orange: #f6836e
    .replace("vec3 C_YELLOW   = vec3(0.894, 0.863, 0.208);", "vec3 C_YELLOW   = vec3(0.894, 0.863, 0.208);")  // Website --yellow: #e4dc35
    .replace("vec3 C_PINK     = vec3(0.941, 0.424, 0.471);", "vec3 C_PINK     = vec3(0.941, 0.424, 0.471);")  // Website pink
    .replace("vec3 GROUND     = vec3(0.929, 0.882, 0.839);", "vec3 GROUND     = vec3(0.965, 0.945, 0.914);"); // Website --bg: #f6f1e9

  const { meta, src } = inject(adjustedTmpl, LAYERS);
  const prog = program(vs, "#version 300 es\n" + chunk + "\n" + src);

  // bake pass: 21-tap static grain kernel, written once to a texture
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

  // grain-texture format: R16F where renderable, else R8
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

  // one-time GL state
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

  // CPU calculation of orbited scene-uv centre per sub-sphere:
  // - Multi-frequency Lissajous drift moves the blob clusters across the canvas
  // - Sub-spheres orbit the cluster centroid, generating fluid morphing shapes
  function centers(t) {
    for (let j = 0; j < meta.length; j++) {
      const m = meta[j];
      const cx = (m.fx - 0.5) * SPREAD * SVGA * S;
      const cy = (0.5 - m.fy) * SPREAD * S;
      const a = t * (m.orbitSp || ORBIT_SP) + m.ph * TAU;
      const fX = m.freqX || 1.0;
      const fY = m.freqY || 1.0;
      const oR = m.orbitR !== undefined ? m.orbitR : ORBIT_R;

      // Smooth floating wandering around base position
      const wx =
        cx + oR * (Math.cos(a * fX + m.ph) + 0.35 * Math.cos(a * 1.6 + m.ph));
      const wy =
        cy + oR * (Math.sin(a * fY + m.ph * 1.5) + 0.35 * Math.sin(a * 1.4 + m.ph * 2.0));

      // Sub-spheres rotate around centroid, breathing in and out
      const cR = m.clumpR !== undefined ? m.clumpR : CLUMP_R;
      const r = cR * S * m.rad * (1 + WOBBLE * Math.sin(t * 0.6 + m.wph));
      const g = m.sa + t * CLUMP_SP * m.sp + m.ph * TAU;
      const aspectY = m.aspectY || 1.0;
      ctr[j * 2] = wx + r * Math.cos(g);
      ctr[j * 2 + 1] = wy + r * Math.sin(g) * aspectY;
    }
    return ctr;
  }

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
  centers(0);

  // Live blob screen positions (client px), grouped by colour
  window.heroBlobs = () => {
    const r = canvas.getBoundingClientRect();
    const fx2 = 2 * fil[0],
      fy2 = 2 * fil[1];
    const out = { teal: [], orange: [], yellow: [], lavender: [], purple: [], pink: [] };
    for (let j = 0; j < meta.length; j++) {
      const c = meta[j].c;
      const nx = ctr[j * 2] / fx2 + 0.5;
      const ny = ctr[j * 2 + 1] / fy2 + 0.5;
      const pt = { x: r.left + nx * r.width, y: r.top + (1 - ny) * r.height };
      if (out[c]) out[c].push(pt);
      if (c === "purple") out.lavender.push(pt);
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
    const t = ((performance.now() - t0) / 1000) * SPEED;
    const dx = e.clientX - lastRippleX;
    const dy = e.clientY - lastRippleY;
    const dist = Math.hypot(dx, dy);

    // Drop a water ripple if mouse moved enough distance and time has passed
    if (dist > 30 && t - lastRippleTime > 0.05) {
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
    const f = (x) => Number(x).toFixed(5);
    let fields = "";
    let composite = "";
    let k = 0; // global u_ctr index (one slot per sub-sphere)
    let pk = 0; // per-blob counter → golden-ratio cluster phase
    const meta = []; // [{fx,fy,ph,rad,sa}] in global k order

    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const { color, blobs, opacity = OPACITY } = layers[layerIdx];
      const colName = PALETTE[color];
      const fnName = `fld_${colName}_${layerIdx}`;

      const adds = blobs
        .flatMap((b) => {
          const fx = Number(f(b.fx));
          const fy = Number(f(b.fy));
          const ph = Number(f((pk++ * 0.6180339887) % 1));
          const rad = 1 / Math.sqrt(b.A); // blob radius ∝ 1/√A (in scene-uv ÷ s)
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
              clumpR: b.clumpR !== undefined ? b.clumpR : CLUMP_R,
              orbitR: b.orbitR !== undefined ? b.orbitR : ORBIT_R,
              orbitSp: b.orbitSp !== undefined ? b.orbitSp : ORBIT_SP,
              freqX: b.freqX || 1.0,
              freqY: b.freqY || 1.0,
              aspectY: Math.sqrt(b.A / b.D),
            });

            // split area across CLUMP, then scale radius by sz (A, B, D ∝ 1/r²)
            const scale = CLUMP / (sz * sz);
            const A = f(b.A * scale);
            const B = f((b.B || 0) * scale);
            const D = f(b.D * scale);
            lines.push(`  f += ell(p, u_ctr[${k}], ${A}, ${B}, ${D}, u_s);`);
            k++;
          }
          return lines;
        })
        .join("\n");

      fields += `float ${fnName}(vec2 p){\n  float f = 0.0;\n${adds}\n  return f;\n}\n`;
      composite +=
        `  col = mix(col, ${colName}, ` +
        `smoothstep(1.0 - mix(0.40, 0.11, n), 1.0 + mix(0.40, 0.11, n), ` +
        `${fnName}(puv)) * ${f(opacity)});\n`;
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
