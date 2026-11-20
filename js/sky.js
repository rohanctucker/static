// WebGL renderer for the whole-sky map: blends two radio frames and colours them with a palette
// that drifts with frequency, or shows real survey images past 5 THz, adds static, and draws the
// Mollweide ellipse with a soft halo.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform sampler2D uS;
uniform sampler2D uPA;
uniform sampler2D uPB;
uniform float uMix, uSpecial, uSpecialMode, uExposure, uGrain, uTime, uJitter, uGrid, uGamma;
uniform float uGsm, uWA, uWB, uSnow;
uniform vec4 uTintA, uTintB;
uniform vec3 uHalo;
uniform vec4 uRect;
uniform vec3 uP[5];
uniform vec3 uQ[5];

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 rampP(float v) {
  v = clamp(v, 0.0, 1.0) * 4.0;
  vec3 c = mix(uP[0], uP[1], clamp(v, 0.0, 1.0));
  c = mix(c, uP[2], clamp(v - 1.0, 0.0, 1.0));
  c = mix(c, uP[3], clamp(v - 2.0, 0.0, 1.0));
  return mix(c, uP[4], clamp(v - 3.0, 0.0, 1.0));
}

vec3 rampQ(float v) {
  v = clamp(v, 0.0, 1.0) * 4.0;
  vec3 c = mix(uQ[0], uQ[1], clamp(v, 0.0, 1.0));
  c = mix(c, uQ[2], clamp(v - 1.0, 0.0, 1.0));
  c = mix(c, uQ[3], clamp(v - 2.0, 0.0, 1.0));
  return mix(c, uQ[4], clamp(v - 3.0, 0.0, 1.0));
}

// single-band surveys arrive as grayscale; tint.a > 0 colours them like the radio maps
vec3 tinted(vec3 c, vec4 t) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 tc = clamp(t.rgb * l * 1.6 + vec3(pow(l, 2.2)) * 0.8, 0.0, 1.0);
  return mix(c, tc, t.a);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float row = floor(frag.y / 2.0);
  float jit = (hash(vec2(row, floor(uTime * 30.0))) - 0.5) * uJitter * 7.0;
  vec2 p = (frag + vec2(jit, 0.0) - uRect.xy) / uRect.zw;
  vec2 q = p * 2.0 - 1.0;
  float r = length(q);
  float aa = 2.2 / uRect.w;
  float inside = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  vec2 uv = vec2(clamp(p.x, 0.0, 1.0), clamp(1.0 - p.y, 0.0, 1.0));

  float v = mix(texture2D(uA, uv).r, texture2D(uB, uv).r, uMix);
  v = pow(clamp(v, 0.0, 1.0), uGamma);
  vec3 col = rampP(v) * uExposure;

  float s = texture2D(uS, uv).r;
  col = mix(col, rampQ(uSpecialMode > 0.5 ? s : pow(s, 0.85)), uSpecial);
  col *= uGsm;

  // real survey images (premultiplied by their own coverage)
  if (uWA + uWB > 0.001) {
    vec4 pa = texture2D(uPA, uv);
    vec4 pb = texture2D(uPB, uv);
    col += tinted(pa.rgb, uTintA) * pa.a * uWA + tinted(pb.rgb, uTintB) * pb.a * uWB;
  }

  // faint graticule: galactic latitude every 30 deg, longitude every 60 deg
  float th = asin(clamp(q.y, -1.0, 1.0));
  float lat = asin(clamp((2.0 * th + sin(2.0 * th)) / 3.14159265, -1.0, 1.0));
  float lon = 3.14159265 * q.x / max(cos(th), 0.02);
  float latDeg = degrees(lat);
  float lonDeg = degrees(lon);
  float dLat = abs(fract(latDeg / 30.0 + 0.5) - 0.5) * 30.0;
  float dLon = abs(fract(lonDeg / 60.0 + 0.5) - 0.5) * 60.0 * cos(lat);
  float w = 0.32;
  float grid = max(1.0 - smoothstep(w * 0.4, w, dLat), (1.0 - smoothstep(w * 0.4, w, dLon)) * step(abs(latDeg), 84.0));
  col += grid * uGrid * vec3(0.95, 0.9, 0.8);

  float n = hash(frag + fract(uTime) * vec2(91.7, 37.3)) - 0.5;
  col += n * uGrain;
  // between survey stations: snow, like a detuned television
  if (uSnow > 0.001) {
    float sn = hash(floor(frag / 1.5) + fract(uTime * 13.0) * vec2(17.1, 53.7));
    col += vec3(smoothstep(1.0 - 0.17 * uSnow, 1.0, sn)) * (0.28 + 0.32 * uSnow);
    col += (hash(frag * 0.37 + uTime) - 0.5) * 0.14 * uSnow;
  }

  float halo = exp(-max(r - 1.0, 0.0) * 14.0) * (1.0 - inside);
  vec3 haloCol = (rampP(0.7) * 0.16 * uExposure + uQ[3] * 0.10 * uSpecial) * uGsm + uHalo;
  gl_FragColor = vec4(max(col, 0.0) * inside + haloCol * halo, max(inside, halo * 0.85));
}
`;

export class SkyRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const opts = { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false };
    let gl = canvas.getContext("webgl2", opts);
    this.gl2 = !!gl;
    if (!gl) gl = canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts);
    if (!gl) throw new Error("WebGL is not available in this browser.");
    this.gl = gl;
    this.prog = this._program(VERT, FRAG);
    gl.useProgram(this.prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ["uA", "uB", "uS", "uPA", "uPB", "uMix", "uSpecial", "uSpecialMode", "uExposure", "uGrain", "uTime",
      "uJitter", "uGrid", "uGamma", "uGsm", "uWA", "uWB", "uSnow", "uTintA", "uTintB", "uHalo", "uRect", "uP", "uQ"]) {
      this.u[n] = gl.getUniformLocation(this.prog, n);
    }
    // texture slots: 0, 1 radio frames; 2 special map; 3, 4 survey images
    this.tex = [this._texture(), this._texture(), this._texture(), this._texture(), this._texture()];
    this.keys = [null, null, null, null, null];
    gl.uniform1i(this.u.uA, 0);
    gl.uniform1i(this.u.uB, 1);
    gl.uniform1i(this.u.uS, 2);
    gl.uniform1i(this.u.uPA, 3);
    gl.uniform1i(this.u.uPB, 4);
    const black = new Uint8Array([0, 0, 0, 255]);
    for (let i = 0; i < 5; i++) this._uploadRaw(i, black, 1, 1);
    this.rect = { x: 0, y: 0, w: 1, h: 0.5 };
  }

  _program(vs, fs) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  _texture() {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    return t;
  }

  _uploadRaw(i, data, w, h) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  /** Upload an image into slot i (0: frame A, 1: frame B, 2: special) unless it's already there.
   *  The maps are grayscale data; RGBA uploads take the browser's fast path, and the shader
   *  reads the red channel. Colour management is off so the values arrive untouched. */
  set(i, src, key) {
    if (!src || this.keys[i] === key) return;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      if (this.gl2) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      }
      this.keys[i] = key;
    } catch (e) {
      console.warn("Texture upload failed", e);
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = this.canvas;
    const w = Math.max(2, Math.round(c.clientWidth * dpr));
    const h = Math.max(2, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    // fit a 2:1 ellipse with room for the halo
    const pad = 0.035;
    let ew = w * (1 - 2 * pad), eh = ew / 2;
    if (eh > h * (1 - 2 * pad * 2)) { eh = h * (1 - 4 * pad); ew = eh * 2; }
    this.rect = { x: (w - ew) / 2, y: (h - eh) / 2, w: ew, h: eh, dpr };
    this.gl.viewport(0, 0, w, h);
  }

  /** Ellipse box in CSS pixels, top-left origin (for hover and labels). */
  cssRect() {
    const r = this.rect, d = r.dpr || 1;
    return { x: r.x / d, y: (this.canvas.height - r.y - r.h) / d, w: r.w / d, h: r.h / d };
  }

  draw(s) {
    const gl = this.gl, u = this.u;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.uMix, s.mix);
    gl.uniform1f(u.uSpecial, s.special);
    gl.uniform1f(u.uSpecialMode, s.specialMode);
    gl.uniform1f(u.uExposure, s.exposure);
    gl.uniform1f(u.uGrain, s.grain);
    gl.uniform1f(u.uTime, s.time);
    gl.uniform1f(u.uJitter, s.jitter);
    gl.uniform1f(u.uGrid, s.grid);
    gl.uniform1f(u.uGamma, s.gamma);
    gl.uniform4f(u.uRect, this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    gl.uniform3fv(u.uP, s.palette);
    gl.uniform3fv(u.uQ, s.specialPalette);
    gl.uniform1f(u.uGsm, s.gsm ?? 1);
    gl.uniform1f(u.uWA, s.wA || 0);
    gl.uniform1f(u.uWB, s.wB || 0);
    gl.uniform1f(u.uSnow, s.snow || 0);
    gl.uniform4fv(u.uTintA, s.tintA || ZERO4);
    gl.uniform4fv(u.uTintB, s.tintB || ZERO4);
    gl.uniform3fv(u.uHalo, s.halo || ZERO3);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

const ZERO4 = new Float32Array(4);
const ZERO3 = new Float32Array(3);

// ----------------------------------------------------------------------------- palettes
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const pal = (...hs) => hs.map(hex);

// keyframes along log10(frequency in MHz): the sky burns like embers at the low end,
// cools to ice through the microwave band, and glows infrared at the top.
const KEYS = [
  { x: 1.0, p: pal("#07070c", "#2c0c15", "#8e2918", "#e6862f", "#fff1d2") },
  { x: 2.5, p: pal("#07070d", "#2a0e22", "#8c2a3f", "#e88e5f", "#fff2e4") },
  { x: 3.15, p: pal("#05070e", "#16183f", "#47408e", "#a2a7e8", "#f3f4ff") },
  { x: 4.3, p: pal("#04080e", "#0b2537", "#1e6b86", "#80d1d7", "#f1fffd") },
  { x: 5.15, p: pal("#05080d", "#0f2a38", "#2f7a84", "#e3c07e", "#fff7e8") },
  { x: 5.85, p: pal("#060408", "#250b13", "#6f1b1f", "#d2562f", "#ffdab2") },
  { x: 6.7, p: pal("#060307", "#1f0813", "#5b1527", "#c44b3c", "#ffd3c3") },
];

export const SPECIAL_PALETTES = {
  hi: pal("#03060b", "#072739", "#0f6f8f", "#71e1f0", "#f4ffff"),
  cmb: pal("#5fb3ec", "#1d4c7a", "#0a0d16", "#8b4c1d", "#ffb65c"),
};

export function paletteAt(x) {
  let i = 0;
  while (i < KEYS.length - 2 && x > KEYS[i + 1].x) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  let t = Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x)));
  t = t * t * (3 - 2 * t);
  const out = new Float32Array(15);
  for (let s = 0; s < 5; s++) {
    for (let c = 0; c < 3; c++) {
      const la = toLin(a.p[s][c]), lb = toLin(b.p[s][c]);
      out[s * 3 + c] = toSrgb(la + (lb - la) * t);
    }
  }
  return out;
}

export function flat(p) {
  return new Float32Array(p.flat());
}

export function cssGradient(p) {
  const stops = [];
  for (let s = 0; s < 5; s++) {
    const [r, g, b] = [p[s * 3], p[s * 3 + 1], p[s * 3 + 2]].map((v) => Math.round(v * 255));
    stops.push(`rgb(${r} ${g} ${b}) ${s * 25}%`);
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
