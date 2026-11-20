// Loads the rendered sky: manifest, instant previews, full-resolution frames (streamed by
// distance from where you're tuned), special maps, and per-frequency statistics.

import { clamp } from "./format.js";

const DECODE_CACHE = 10; // full-res frames kept decoded at once

/** Decode an image as raw data: no colour management, no premultiplication. */
function decode(blob) {
  return createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" })
    .catch(() => createImageBitmap(blob));
}

export class SkyData {
  constructor(base = "data/") {
    this.base = base;
    this.frames = [];
    this.special = {};
    this.loaded = 0;
    this.onProgress = null;
    this._lru = [];
    this._crop = document.createElement("canvas");
    this._pixels = new Map(); // key -> {w, h, data} for temperature readout
  }

  async init() {
    const res = await fetch(this.base + "manifest.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`Couldn't load ${this.base}manifest.json (${res.status}).`);
    const m = await res.json();
    this.manifest = m;
    this.frames = m.frames.map((f, k) => ({
      ...f, k, logf: Math.log10(f.f), blob: null, bitmap: null, decoding: null, fetching: false,
      // GSM2016's maps up to 1.42 GHz already contain the CMB; `inc` says how much of it
      lsky: Math.log10(Math.max(f.tmed + f.tcmb * (1 - (f.inc ?? 0)), 1e-9)),
    }));
    this.logs = this.frames.map((f) => f.logf);

    const lo = m.lo;
    this.sprite = await decode(await (await fetch(this.base + lo.src)).blob());
    this.loCols = lo.cols;
    this.loW = lo.w;
    this.loH = lo.h;
    this._crop.width = lo.w;
    this._crop.height = lo.h;
    this._cropCtx = this._crop.getContext("2d", { willReadFrequently: true });

    // special maps: the CMB, and real hydrogen once the add-on has been run (it adds itself here)
    const specials = { ...(m.special || {}) };
    for (const [key, spec] of Object.entries(specials)) {
      this.special[key] = { ...spec, bitmap: null };
      this._loadSpecial(key);
    }
  }

  async _loadSpecial(key) {
    const s = this.special[key];
    try {
      const blob = await (await fetch(this.base + s.src)).blob();
      s.bitmap = await decode(blob);
    } catch (e) {
      console.warn("Special map failed to load:", key, e);
    }
  }

  /** Stream full-resolution frames, nearest to the current tuning first. */
  stream(getLogf, concurrency = 5) {
    const next = () => {
      const x = getLogf();
      let best = null, bestD = Infinity;
      for (const f of this.frames) {
        if (f.blob || f.fetching) continue;
        const d = Math.abs(f.logf - x);
        if (d < bestD) { bestD = d; best = f; }
      }
      return best;
    };
    const worker = async () => {
      for (let f = next(); f; f = next()) {
        f.fetching = true;
        try {
          const r = await fetch(this.base + f.src);
          if (!r.ok) throw new Error(r.status);
          f.blob = await r.blob();
          this.loaded++;
          this.onProgress && this.onProgress(this.loaded, this.frames.length);
        } catch (e) {
          f.fetching = false;
          await new Promise((ok) => setTimeout(ok, 1500));
        }
      }
    };
    for (let i = 0; i < concurrency; i++) worker();
  }

  /** Bracketing frames for a log-frequency, with the blend between them. */
  bracket(x) {
    const L = this.logs;
    if (x <= L[0]) return { i0: 0, i1: 0, t: 0 };
    if (x >= L[L.length - 1]) return { i0: L.length - 1, i1: L.length - 1, t: 0 };
    let lo = 0, hi = L.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (L[mid] <= x) lo = mid; else hi = mid;
    }
    return { i0: lo, i1: hi, t: (x - L[lo]) / (L[hi] - L[lo]) };
  }

  /** Best available image for frame k: decoded full-res if ready, else the preview. */
  source(k) {
    const f = this.frames[k];
    if (f.bitmap) {
      this._touch(k);
      return { img: f.bitmap, key: `h${k}`, hi: true };
    }
    if (f.blob && !f.decoding) {
      f.decoding = decode(f.blob)
        .then((b) => { f.bitmap = b; this._touch(k); this._evict(); })
        .catch(() => {})
        .finally(() => { f.decoding = null; });
    }
    const c = this.loCols, w = this.loW, h = this.loH;
    this._cropCtx.clearRect(0, 0, w, h);
    this._cropCtx.drawImage(this.sprite, (k % c) * w, Math.floor(k / c) * h, w, h, 0, 0, w, h);
    return { img: this._crop, key: `l${k}`, hi: false, fresh: true };
  }

  _touch(k) {
    const i = this._lru.indexOf(k);
    if (i >= 0) this._lru.splice(i, 1);
    this._lru.push(k);
  }

  _evict() {
    while (this._lru.length > DECODE_CACHE) {
      const k = this._lru.shift();
      const f = this.frames[k];
      if (f.bitmap) { f.bitmap.close && f.bitmap.close(); f.bitmap = null; }
      this._pixels.delete(`h${k}`);
    }
  }

  /** Sky noise temperature (median of the whole sky, CMB included) at log-frequency x, in kelvin. */
  skyTemp(x) {
    const { i0, i1, t } = this.bracket(x);
    const a = this.frames[i0].lsky, b = this.frames[i1].lsky;
    return 10 ** (a + (b - a) * t);
  }

  /** True where frame k is best read as brightness above the CMB rather than total brightness. */
  relative(k) {
    return (this.frames[k].inc ?? 0) < 0.5;
  }

  /** Map value (0..1) in frame k back to temperature (K): total brightness, or brightness above
   *  the CMB average when `rel` (by default, wherever the map itself mostly lacks the CMB). */
  tempOf(k, u, rel = this.relative(k)) {
    const f = this.frames[k];
    const raw = f.a * Math.sinh(f.lo_d + u * (f.hi_d - f.lo_d));
    const inc = f.inc ?? 0;
    return raw + (rel ? -f.tcmb * inc : f.tcmb * (1 - inc));
  }

  /** Temperature at normalized image coords (x, y in 0..1, y down) in the current blend. */
  sampleTemp(i0, i1, t, x, y) {
    const rel = this.relative(t < 0.5 ? i0 : i1);
    const read = (k) => {
      const f = this.frames[k];
      let px = f.bitmap ? this._pixelsFor(`h${k}`, f.bitmap) : null;
      if (!px) px = this._pixelsFor(`l${k}`, null, k);
      const ix = clamp(Math.floor(x * px.w), 0, px.w - 1);
      const iy = clamp(Math.floor(y * px.h), 0, px.h - 1);
      return this.tempOf(k, px.data[(iy * px.w + ix) * 4] / 255, rel);
    };
    const a = read(i0);
    if (i0 === i1 || t <= 0) return a;
    const b = read(i1);
    if (a > 0 && b > 0) return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
    return a + (b - a) * t;
  }

  _pixelsFor(key, bitmap, k) {
    let px = this._pixels.get(key);
    if (px) return px;
    let w, h, ctx;
    if (bitmap) {
      // half resolution is plenty for a readout, and keeps memory down
      w = Math.min(bitmap.width, 800); h = Math.round((w * bitmap.height) / bitmap.width);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, w, h);
    } else {
      w = this.loW; h = this.loH;
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(this.sprite, (k % this.loCols) * w, Math.floor(k / this.loCols) * h, w, h, 0, 0, w, h);
    }
    px = { w, h, data: ctx.getImageData(0, 0, w, h).data };
    this._pixels.set(key, px);
    if (this._pixels.size > 8) this._pixels.delete(this._pixels.keys().next().value);
    return px;
  }

  specialValue(key, x, y) {
    const s = this.special[key];
    if (!s || !s.bitmap) return null;
    const px = this._pixelsFor(`s:${key}`, s.bitmap);
    const ix = clamp(Math.floor(x * px.w), 0, px.w - 1);
    const iy = clamp(Math.floor(y * px.h), 0, px.h - 1);
    const u = px.data[(iy * px.w + ix) * 4] / 255;
    if (s.mode === "diverging") return { value: s.min + u * (s.max - s.min), unit: s.unit };
    if (s.mode === "log" && s.min && s.max) {
      return { value: 10 ** (Math.log10(s.min) + u * (Math.log10(s.max) - Math.log10(s.min))), unit: s.unit };
    }
    return null;
  }
}
