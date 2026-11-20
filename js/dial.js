// The tuning dial: a backlit glass scale that scrolls under a fixed needle (log frequency),
// plus a strip below it showing the whole spectrum at once.

import { HUMAN_BANDS, SILENT_BANDS, BAND_INK, IONOSPHERE_MHZ, RAINBOW } from "./bands.js";
import { STATIONS } from "./stations.js";
import { LOG_MIN, LOG_MAX, clamp, tickText } from "./format.js";

const INK = "#2b1a0b";
const INK_SOFT = "rgba(43, 26, 11, 0.55)";
const NEEDLE = "#c8321e";
const LOCK_INK = "#9c2614";
const FONT = "Anybody, 'Arial Narrow', system-ui, sans-serif";

/** Set a canvas font, condensed when the browser supports variable font width in canvas. */
function setFont(ctx, spec, stretch = "semi-condensed") {
  ctx.font = spec;
  if ("fontStretch" in ctx) ctx.fontStretch = stretch;
}

const tickLabel = tickText;

// the spectrum's named regions, for the strip under the dial (log10 MHz)
const REGION_MARKS = [
  [1, 3.48, "Radio"], [3.48, 5.48, "Microwave"], [5.48, 8.6, "Infrared"], [8.6, 8.9, ""],
  [8.9, 10.48, "UV"], [10.48, 13.38, "X-rays"], [13.38, 18, "Gamma rays"],
];

function rainbow(ctx, x0, x1) {
  // printed from red (low frequency, left) to violet
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  RAINBOW.forEach((c, i) => g.addColorStop(i / (RAINBOW.length - 1), c));
  return g;
}

export class Dial {
  constructor(canvas, overview, handlers) {
    this.c = canvas;
    this.o = overview;
    this.h = handlers;
    this.x = Math.log10(98.7);
    this.locks = new Map();
    this.labelBoxes = [];
    this.dirty = true;
    this.hint = "";
    this._bindDial();
    this._bindOverview();
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    for (const cv of [this.c, this.o]) {
      cv.width = Math.round(cv.clientWidth * dpr);
      cv.height = Math.round(cv.clientHeight * dpr);
    }
    this.W = this.c.clientWidth;
    this.H = this.c.clientHeight;
    this.span = this.W >= 1000 ? 0.9 : this.W >= 640 ? 0.75 : 0.55;
    this.ppd = this.W / this.span; // pixels per decade
    this._buildGlass();
    this.dirty = true;
  }

  set(x, locks, hint) {
    if (x !== this.x || hint !== this.hint) this.dirty = true;
    for (const [id, v] of locks) {
      const old = this.locks.get(id) || 0;
      if (Math.abs(old - v) > 0.02) this.dirty = true;
    }
    this.x = x;
    this.locks = locks;
    this.hint = hint;
  }

  // --------------------------------------------------------------------------- glass
  _buildGlass() {
    const W = this.W, H = this.H, d = this.dpr;
    const g = document.createElement("canvas");
    g.width = Math.round(W * d);
    g.height = Math.round(H * d);
    const ctx = g.getContext("2d");
    ctx.scale(d, d);
    const base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, "#e3bf83");
    base.addColorStop(0.35, "#f6e1b4");
    base.addColorStop(0.7, "#f2d9a6");
    base.addColorStop(1, "#d9b276");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    const hot = ctx.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, Math.max(W * 0.42, 200));
    hot.addColorStop(0, "rgba(255, 249, 228, 0.65)");
    hot.addColorStop(1, "rgba(255, 249, 228, 0)");
    ctx.fillStyle = hot;
    ctx.fillRect(0, 0, W, H);
    const side = ctx.createLinearGradient(0, 0, W, 0);
    side.addColorStop(0, "rgba(70, 36, 6, 0.55)");
    side.addColorStop(0.16, "rgba(70, 36, 6, 0)");
    side.addColorStop(0.84, "rgba(70, 36, 6, 0)");
    side.addColorStop(1, "rgba(70, 36, 6, 0.55)");
    ctx.fillStyle = side;
    ctx.fillRect(0, 0, W, H);
    // glass grain
    const n = document.createElement("canvas");
    n.width = n.height = 96;
    const nc = n.getContext("2d");
    const img = nc.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    nc.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = ctx.createPattern(n, "repeat");
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    this.glass = g;
  }

  // --------------------------------------------------------------------------- drawing
  _xOf(lf) {
    return this.W / 2 + (lf - this.x) * this.ppd;
  }

  draw() {
    if (!this.dirty) return;
    this.dirty = false;
    this._drawDial();
    this._drawOverview();
  }

  _drawDial() {
    const ctx = this.c.getContext("2d");
    const W = this.W, H = this.H, d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.glass, 0, 0, W, H);

    const xMin = this.x - this.span / 2 - 0.05;
    const xMax = this.x + this.span / 2 + 0.05;
    const yLine = Math.round(H * 0.4) + 0.5;
    const yBands = H - 27;

    // silent bands: unprinted glass, the backlight shows through
    ctx.globalCompositeOperation = "lighter";
    for (const b of SILENT_BANDS) {
      const l0 = Math.log10(b.lo), l1 = Math.log10(b.hi);
      if (l1 < xMin || l0 > xMax) continue;
      let x0 = this._xOf(l0), x1 = this._xOf(l1);
      if (x1 - x0 < 2) { const m = (x0 + x1) / 2; x0 = m - 1; x1 = m + 1; }
      const gr = ctx.createLinearGradient(0, 4, 0, H - 4);
      gr.addColorStop(0, "rgba(190, 225, 255, 0.10)");
      gr.addColorStop(0.5, "rgba(235, 248, 255, 0.55)");
      gr.addColorStop(1, "rgba(190, 225, 255, 0.10)");
      ctx.fillStyle = gr;
      ctx.fillRect(x0, 4, x1 - x0, H - 8);
    }
    ctx.globalCompositeOperation = "source-over";

    // the ionosphere and the ends of the scale
    const xIono = this._xOf(Math.log10(IONOSPHERE_MHZ));
    if (xIono > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, Math.max(0, xIono), H);
      ctx.clip();
      ctx.fillStyle = "rgba(70, 40, 12, 0.10)";
      ctx.fillRect(0, 0, xIono, H);
      ctx.strokeStyle = "rgba(43, 26, 11, 0.16)";
      ctx.lineWidth = 1;
      for (let x = -H; x < xIono + H; x += 7) {
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(x + H, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
    const xEndL = this._xOf(LOG_MIN), xEndR = this._xOf(LOG_MAX);
    ctx.fillStyle = "rgba(55, 30, 8, 0.32)";
    if (xEndL > 0) ctx.fillRect(0, 0, xEndL, H);
    if (xEndR < W) ctx.fillRect(xEndR, 0, W - xEndR, H);

    // human bands, printed as ink blocks with knocked-out labels
    setFont(ctx, `700 9.5px ${FONT}`);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    for (const b of HUMAN_BANDS) {
      const l0 = Math.log10(b.lo), l1 = Math.log10(b.hi);
      if (l1 < xMin || l0 > xMax) continue;
      const x0 = this._xOf(l0), x1 = this._xOf(l1);
      ctx.globalAlpha = b.kind === "visible" ? 0.9 : 0.72;
      ctx.fillStyle = b.kind === "visible" ? rainbow(ctx, x0, x1) : BAND_INK[b.kind] || INK;
      ctx.fillRect(x0, yBands, Math.max(1, x1 - x0), 15);
      ctx.globalAlpha = 1;
      const wText = ctx.measureText(b.label).width;
      if (x1 - x0 > wText + 8) {
        ctx.fillStyle = "rgba(255, 241, 214, 0.94)";
        ctx.fillText(b.label, (x0 + x1) / 2, yBands + 8);
      }
    }

    // scale
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.max(0, xEndL), yLine);
    ctx.lineTo(Math.min(W, xEndR), yLine);
    ctx.stroke();
    setFont(ctx, `560 13px ${FONT}`);
    ctx.textBaseline = "alphabetic";
    const fine = this.ppd > 900;
    for (let dd = Math.floor(xMin); dd <= Math.ceil(xMax); dd++) {
      for (let m = 1; m <= 9; m += fine ? 0.5 : 1) {
        const lf = Math.log10(m) + dd;
        if (lf < LOG_MIN - 1e-9 || lf > LOG_MAX + 1e-9) continue;
        const x = Math.round(this._xOf(lf)) + 0.5;
        if (x < -40 || x > W + 40) continue;
        const major = m === 1, mid = m === 2 || m === 5, half = m % 1 !== 0;
        const len = major ? 20 : mid ? 14 : half ? 5 : 9;
        ctx.globalAlpha = half ? 0.55 : 1;
        ctx.beginPath();
        ctx.moveTo(x, yLine);
        ctx.lineTo(x, yLine + len);
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (major || mid) {
          setFont(ctx, major ? `700 13px ${FONT}` : `560 12.5px ${FONT}`);
          ctx.fillText(tickLabel(m, dd), x, yLine + len + 15);
        }
      }
    }
    if (xEndR < W) { ctx.beginPath(); ctx.moveTo(xEndR, yLine - 8); ctx.lineTo(xEndR, yLine + 20); ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; }
    if (xEndL > 0) { ctx.beginPath(); ctx.moveTo(xEndL, yLine - 8); ctx.lineTo(xEndL, yLine + 20); ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; }

    // stations, printed above the scale in two staggered rows
    this.labelBoxes = [];
    const items = [];
    setFont(ctx, `700 11px ${FONT}`);
    for (const s of STATIONS) {
      const xs = s.kind === "point" ? this._xOf(s.logf) : (this._xOf(s.loLog) + this._xOf(s.hiLog)) / 2;
      if (s.kind === "zone") continue;
      const tw = this._spaced(ctx, s.dial).w;
      if (xs + tw / 2 < -20 || xs - tw / 2 > W + 20) continue;
      items.push({ s, xs, tw });
    }
    // place labels in two rows, most important first (the station you're locked on always wins);
    // a label with no room is left off, but its mark on the scale stays
    const rowY = [17, 31];
    const placed = [[], []];
    const zoneBox = this._zoneLabelBox(xEndL, xIono);
    if (zoneBox) placed[0].push(zoneBox);
    const order = items.slice().sort((a, b) => {
      const la = (this.locks.get(a.s.id) || 0) > 0.5, lb = (this.locks.get(b.s.id) || 0) > 0.5;
      return (lb - la) || (b.s.priority - a.s.priority) || (a.xs - b.xs);
    });
    const fits = (r, x0, x1) => placed[r].every(([a, b]) => x1 < a || x0 > b);
    // the first-use hint sits just right of the needle, after any station you're locked on
    let hintRow = -1, hintPlaced = !this.hint;
    setFont(ctx, `600 12px ${FONT}`);
    const hintW = this.hint ? ctx.measureText(this.hint).width : 0;
    setFont(ctx, `700 11px ${FONT}`);
    const placeHint = () => {
      hintPlaced = true;
      const x0 = W / 2 + 8, x1 = W / 2 + 16 + hintW;
      for (const r of [1, 0]) if (fits(r, x0, x1)) { placed[r].push([x0, x1]); hintRow = r; return; }
    };
    for (const it of order) {
      if (!hintPlaced && !((this.locks.get(it.s.id) || 0) > 0.5)) placeHint();
      const x0 = it.xs - it.tw / 2 - 7, x1 = it.xs + it.tw / 2 + 7;
      it.row = -1;
      for (let r = 0; r < 2; r++) {
        if (fits(r, x0, x1)) { placed[r].push([x0, x1]); it.row = r; break; }
      }
    }
    if (!hintPlaced) placeHint();
    for (const it of items) {
      const { s, xs, tw, row } = it;
      const lock = this.locks.get(s.id) || 0;
      if (row < 0) {
        if (s.kind === "point") {
          ctx.fillStyle = lock > 0.5 ? LOCK_INK : s.landmark ? INK_SOFT : INK;
          ctx.beginPath();
          ctx.arc(xs, yLine, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
      const y = rowY[row];
      const color = lock > 0.5 ? LOCK_INK : s.landmark ? INK_SOFT : INK;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      if (s.kind === "band") {
        const x0 = this._xOf(s.loLog), x1 = this._xOf(s.hiLog);
        ctx.beginPath();
        ctx.moveTo(x0, y + 6);
        ctx.lineTo(x0, y + 3);
        ctx.lineTo(x1, y + 3);
        ctx.lineTo(x1, y + 6);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(Math.round(xs) + 0.5, y + 4);
        ctx.lineTo(Math.round(xs) + 0.5, yLine - 3);
        ctx.globalAlpha = 0.55;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(xs, yLine, lock > 0.5 ? 3.4 : 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      const yText = s.kind === "band" ? y : y;
      this._spaced(ctx, s.dial, xs, yText);
      this.labelBoxes.push({ s, x0: xs - tw / 2 - 6, x1: xs + tw / 2 + 6, y0: y - 13, y1: y + 6 });
    }
    // the ionosphere zone gets its label printed like a station, centred in the hatched glass
    if (zoneBox) {
      ctx.fillStyle = INK_SOFT;
      setFont(ctx, `700 11px ${FONT}`);
      this._spaced(ctx, "IONOSPHERE", (zoneBox[0] + zoneBox[1]) / 2, 17);
    }

    // first-use hint
    if (this.hint && hintRow >= 0) {
      setFont(ctx, `600 12px ${FONT}`);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(43, 26, 11, 0.78)";
      ctx.fillText(this.hint, W / 2 + 12, rowY[hintRow]);
      ctx.textAlign = "center";
    }

    // needle
    const cx = Math.round(W / 2) + 0.5;
    ctx.save();
    ctx.shadowColor = "rgba(40, 10, 0, 0.45)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1.5;
    ctx.strokeStyle = NEEDLE;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx, 3);
    ctx.lineTo(cx, H - 3);
    ctx.stroke();
    ctx.fillStyle = NEEDLE;
    ctx.beginPath();
    ctx.moveTo(cx - 6, 0);
    ctx.lineTo(cx + 6, 0);
    ctx.lineTo(cx, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // a sheen across the top of the glass
    const sheen = ctx.createLinearGradient(0, 0, 0, H * 0.5);
    sheen.addColorStop(0, "rgba(255, 255, 255, 0.22)");
    sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H * 0.5);
  }

  /** Where the IONOSPHERE label goes (x0, x1), or null if the hatched zone is too narrow. */
  _zoneLabelBox(xEndL, xIono) {
    const l = Math.max(0, xEndL), r = Math.min(this.W, xIono);
    if (r - l < 96) return null;
    const c = (l + r) / 2;
    return [c - 46, c + 46];
  }

  /** Draw (or measure) letter-spaced caps, the way dial lettering was printed. */
  _spaced(ctx, text, cx, y) {
    const track = 1.2;
    const chars = [...text];
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const w = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
    if (cx === undefined) return { w };
    const align = ctx.textAlign;
    ctx.textAlign = "left";
    let x = cx - w / 2;
    chars.forEach((ch, i) => { ctx.fillText(ch, x, y); x += widths[i] + track; });
    ctx.textAlign = align;
    return { w };
  }

  // --------------------------------------------------------------------------- overview
  _ox(lf) {
    const pad = 10;
    return pad + ((lf - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (this.o.clientWidth - 2 * pad);
  }

  _drawOverview() {
    const ctx = this.o.getContext("2d");
    const W = this.o.clientWidth, H = this.o.clientHeight, d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const top = 6, bot = 22;
    ctx.fillStyle = "rgba(236, 230, 214, 0.06)";
    ctx.fillRect(this._ox(LOG_MIN), top + 5, this._ox(LOG_MAX) - this._ox(LOG_MIN), 6);
    for (const b of HUMAN_BANDS) {
      const x0 = this._ox(Math.log10(b.lo)), x1 = this._ox(Math.log10(b.hi));
      ctx.fillStyle = b.kind === "visible" ? rainbow(ctx, x0, x1) : BAND_INK[b.kind] || INK;
      ctx.globalAlpha = 0.95;
      ctx.fillRect(x0, b.kind === "visible" ? top + 1 : top + 4, Math.max(b.kind === "visible" ? 3 : 1, x1 - x0), b.kind === "visible" ? 14 : 8);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "rgba(200, 230, 255, 0.85)";
    for (const b of SILENT_BANDS) {
      const x0 = this._ox(Math.log10(b.lo)), x1 = this._ox(Math.log10(b.hi));
      ctx.fillRect(x0, top, Math.max(1, x1 - x0), bot - top);
    }
    ctx.fillStyle = "#e9b35f";
    for (const s of STATIONS) {
      if (s.kind === "zone") continue;
      ctx.beginPath();
      ctx.arc(this._ox(s.logf), bot + 4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // the window you're looking through on the dial
    const w0 = this._ox(Math.max(LOG_MIN, this.x - this.span / 2));
    const w1 = this._ox(Math.min(LOG_MAX, this.x + this.span / 2));
    ctx.fillStyle = "rgba(246, 225, 180, 0.10)";
    ctx.fillRect(w0, 2, w1 - w0, bot);
    ctx.strokeStyle = "rgba(246, 225, 180, 0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(w0) + 0.5, 2.5, Math.round(w1 - w0), bot - 1);
    ctx.strokeStyle = NEEDLE;
    ctx.lineWidth = 2;
    const xn = this._ox(this.x);
    ctx.beginPath();
    ctx.moveTo(xn, 0);
    ctx.lineTo(xn, bot + 2);
    ctx.stroke();
    // named regions of the spectrum, with faint dividers
    setFont(ctx, `500 10.5px ${FONT}`);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "center";
    for (const [a, b, name] of REGION_MARKS) {
      const x0 = this._ox(a), x1 = this._ox(b);
      if (a > LOG_MIN) {
        ctx.fillStyle = "rgba(170, 178, 196, 0.22)";
        ctx.fillRect(Math.round(x0), bot + 7, 1, H - bot - 9);
      }
      if (!name) continue;
      const here = this.x >= a && this.x < b;
      ctx.fillStyle = here ? "rgba(236, 230, 214, 0.95)" : "rgba(170, 178, 196, 0.8)";
      if (ctx.measureText(name).width + 6 < x1 - x0) ctx.fillText(name, (x0 + x1) / 2, H - 2);
    }
  }

  // --------------------------------------------------------------------------- input
  _bindDial() {
    const c = this.c;
    let drag = null;
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, x0: e.clientX, t: performance.now(), t0: performance.now(), moved: 0, v: 0 };
      this.h.onGrab && this.h.onGrab();
    });
    c.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const now = performance.now();
      const dx = e.clientX - drag.x;
      const dt = Math.max(1, now - drag.t) / 1000;
      const delta = -dx / this.ppd;
      drag.v = drag.v * 0.6 + (delta / dt) * 0.4;
      drag.moved += Math.abs(dx);
      drag.x = e.clientX;
      drag.t = now;
      if (dx) this.h.onTune(delta);
    });
    const end = (e) => {
      if (!drag) return;
      const quick = performance.now() - drag.t0 < 350;
      if (drag.moved < 5 && quick) {
        const r = c.getBoundingClientRect();
        const px = e.clientX - r.left, py = e.clientY - r.top;
        const hit = this.labelBoxes.find((b) => px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1);
        if (hit) this.h.onStation(hit.s);
        else this.h.onSeek(clamp(this.x + (px - this.W / 2) / this.ppd, LOG_MIN, LOG_MAX));
      } else if (performance.now() - drag.t < 80) {
        this.h.onFling(drag.v);
      } else {
        this.h.onFling(0);
      }
      drag = null;
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      this.h.onTune(raw * scale * 0.00035 * (e.shiftKey ? 8 : 1), { wheel: true });
    }, { passive: false });
    c.addEventListener("pointermove", (e) => {
      if (drag) return;
      const r = c.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const hit = this.labelBoxes.some((b) => px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1);
      c.style.cursor = hit ? "pointer" : "grab";
    });
  }

  _bindOverview() {
    const o = this.o;
    let down = false;
    const at = (e) => {
      const r = o.getBoundingClientRect();
      const pad = 10;
      const f = (e.clientX - r.left - pad) / (r.width - 2 * pad);
      return clamp(LOG_MIN + f * (LOG_MAX - LOG_MIN), LOG_MIN, LOG_MAX);
    };
    o.addEventListener("pointerdown", (e) => { down = true; o.setPointerCapture(e.pointerId); this.h.onSeek(at(e), { fast: true }); });
    o.addEventListener("pointermove", (e) => { if (down) this.h.onJump(at(e)); });
    const up = () => { down = false; };
    o.addEventListener("pointerup", up);
    o.addEventListener("pointercancel", up);
  }
}
