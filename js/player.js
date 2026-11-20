// The tape player: an original portable with a radio built in.
// TAPE plays the shelf's recordings; RADIO hands the controls to the sky.

import { cassetteSVG, BAY_SVG, HUB_L, HUB_R, PACK_MIN, PACK_MAX } from "./cassette.js";
import { foley } from "./foley.js";
import { clock } from "./tapes.js";

const TAPE_MM_S = 47.6; // a cassette's real speed: 4.76 cm per second
const WIND = 14; // fast wind, times play speed (for the counter)
const WIND_VIS = 5; // ...and for the reels, which would strobe any faster
const CUE = 3; // cue and review while playing
const BLANK_SECONDS = 9;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// design units: the player is drawn in a 410 × 292 box
const BOX_W = 410, BOX_H = 292;
const pct = (v, of) => `${((v / of) * 100).toFixed(4)}%`;
const place = (x, y, w, h) => `left:${pct(x, BOX_W)};top:${pct(y, BOX_H)};width:${pct(w, BOX_W)};height:${pct(h, BOX_H)}`;

// inside the door (242 × 162): the window and the cassette behind it
const DOOR = { x: 24, y: 38, w: 242, h: 162 };
const HOLE = { x: 14, y: 10, w: 214, h: 141 };
const SLOT = { x: 17, y: 13.95, w: 208, h: 133.1 };
const dpl = (r) => `left:${pct(r.x, DOOR.w)};top:${pct(r.y, DOOR.h)};width:${pct(r.w, DOOR.w)};height:${pct(r.h, DOOR.h)}`;

const ICONS = {
  rew: '<path d="M11.5 6.5 4 12l7.5 5.5zM20 6.5 12.5 12l7.5 5.5z"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  ff: '<path d="M4 6.5 11.5 12 4 17.5zM12.5 6.5 20 12l-7.5 5.5z"/>',
  stop: '<rect x="4" y="6.5" width="8" height="8" rx="0.8"/><path d="m14.5 14 3.5-5 3.5 5z"/><rect x="14.5" y="15.2" width="7" height="1.8" rx="0.5"/>',
};

const SHELL_SVG = `<svg class="pl-art" viewBox="0 0 ${BOX_W} ${BOX_H}" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="plBump" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3d414b"/><stop offset="0.5" stop-color="#2b2e35"/><stop offset="1" stop-color="#1c1e23"/>
    </linearGradient>
    <linearGradient id="plFace" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="#f1eee7"/><stop offset="0.5" stop-color="#e3dfd5"/><stop offset="1" stop-color="#cbc6ba"/>
    </linearGradient>
    <linearGradient id="plPanel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e6e2d8"/><stop offset="1" stop-color="#d3cec2"/>
    </linearGradient>
    <filter id="plGrain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.09 0"/>
    </filter>
  </defs>
  <rect x="28" y="15" width="248" height="12" rx="6" fill="#0d0e11"/>
  <rect x="0" y="20" width="400" height="270" rx="36" fill="url(#plBump)"/>
  <rect x="0.6" y="20.6" width="398.8" height="268.8" rx="35.4" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="1.2"/>
  ${Array.from({ length: 15 }, (_, i) => `<rect x="2.5" y="${74 + i * 10}" width="5" height="5" rx="2.5" fill="#16181c"/>`).join("")}
  <rect x="391" y="90" width="12" height="112" rx="5" fill="#0c0d10"/>
  <rect x="10" y="30" width="380" height="250" rx="27" fill="url(#plFace)"/>
  <rect x="10" y="30" width="380" height="250" rx="27" fill="#000" filter="url(#plGrain)"/>
  <path d="M38 30.8 H362" stroke="#fff" stroke-opacity="0.75" stroke-width="1.2"/>
  <rect x="19.5" y="33.5" width="251" height="171" rx="15" fill="rgba(60,52,40,0.07)" stroke="rgba(40,34,26,0.2)" stroke-width="1"/>
  <path d="M34 205.2 H256" stroke="#fff" stroke-opacity="0.5" stroke-width="1"/>
  <rect x="19" y="210" width="252" height="66" rx="11" fill="#24262c"/>
  <rect x="19" y="210" width="252" height="66" rx="11" fill="none" stroke="rgba(255,255,255,0.08)"/>
  <rect x="276.5" y="33.5" width="106" height="242" rx="15" fill="url(#plPanel)" stroke="rgba(40,34,26,0.16)" stroke-width="1"/>
  <text class="pl-brand" x="300" y="66" transform="skewX(-12)" textLength="84" lengthAdjust="spacingAndGlyphs">STATIC</text>
  <rect x="287" y="74" width="20" height="3.2" rx="1.6" fill="#f0592a"/>
  <text class="pl-model" x="311" y="79">1420</text>
  <text class="pl-print" x="287" y="194">ALL-SKY RECEIVER</text>
  <text class="pl-print pl-print-soft" x="287" y="206">10 MHz – 1 YHz</text>
  ${Array.from({ length: 4 }, (_, r) => Array.from({ length: 8 }, (_, c) =>
    `<circle cx="${292 + c * 11.4}" cy="${228 + r * 11.5}" r="2.6" fill="#2a2c32"/><circle cx="${292 + c * 11.4}" cy="${227.4 + r * 11.5}" r="2.6" fill="none" stroke="rgba(0,0,0,0.22)" stroke-width="0.6"/>`).join("")).join("")}
  <text class="pl-print pl-print-tiny" x="0" y="0" transform="translate(399.5 252) rotate(-90)">TUNING</text>
  <path d="M398.5 81 l-3.2 5 h6.4z M398.5 211 l-3.2 -5 h6.4z" fill="#8c909a"/>
</svg>`;

const DOOR_SVG = `<svg class="pl-door-art" viewBox="0 0 ${DOOR.w} ${DOOR.h}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="plDoorF" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ece9e1"/><stop offset="1" stop-color="#d4cfc4"/>
    </linearGradient>
  </defs>
  <path fill-rule="evenodd" fill="url(#plDoorF)" d="
    M12 0 H${DOOR.w - 12} Q${DOOR.w} 0 ${DOOR.w} 12 V${DOOR.h - 12} Q${DOOR.w} ${DOOR.h} ${DOOR.w - 12} ${DOOR.h} H12 Q0 ${DOOR.h} 0 ${DOOR.h - 12} V12 Q0 0 12 0 Z
    M${HOLE.x + 7} ${HOLE.y} H${HOLE.x + HOLE.w - 7} Q${HOLE.x + HOLE.w} ${HOLE.y} ${HOLE.x + HOLE.w} ${HOLE.y + 7} V${HOLE.y + HOLE.h - 7} Q${HOLE.x + HOLE.w} ${HOLE.y + HOLE.h} ${HOLE.x + HOLE.w - 7} ${HOLE.y + HOLE.h} H${HOLE.x + 7} Q${HOLE.x} ${HOLE.y + HOLE.h} ${HOLE.x} ${HOLE.y + HOLE.h - 7} V${HOLE.y + 7} Q${HOLE.x} ${HOLE.y} ${HOLE.x + 7} ${HOLE.y} Z"/>
  <rect x="0.5" y="0.5" width="${DOOR.w - 1}" height="${DOOR.h - 1}" rx="11.5" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1"/>
  <rect x="${HOLE.x - 0.5}" y="${HOLE.y - 0.5}" width="${HOLE.w + 1}" height="${HOLE.h + 1}" rx="7.5" fill="none" stroke="rgba(30,24,16,0.35)" stroke-width="1.2"/>
  ${Array.from({ length: 7 }, (_, i) => `<rect x="${103 + i * 5.4}" y="3" width="2.4" height="4.4" rx="1.2" fill="rgba(40,34,26,0.22)"/>`).join("")}
  <text class="pl-print pl-print-tiny" x="${HOLE.x + 2}" y="7.6">OPEN</text>
  <text class="pl-print pl-print-tiny" x="${DOOR.w - 16}" y="${DOOR.h - 3.2}" text-anchor="end">AUTO STOP</text>
</svg>`;

export class Player {
  constructor(root, opts = {}) {
    this.root = root;
    this.o = opts;
    this.mode = "radio";
    this.tape = null;
    this.side = 0;
    this.pos = [0, 0];
    this.dur = [null, null];
    this.playing = false;
    this.wind = 0; // +1 fast-forward, −1 rewind (stopped)
    this.cue = 0; // +1 cue, −1 review (while playing)
    this.busy = false;
    this.powered = false;
    this.files = {};
    this.durations = {};
    this.ang = [0, 0];
    this.ribs = 0;
    this.vu = 0;
    this.radio = null;
    this.lastLcd = "";
    this._build();
  }

  // --------------------------------------------------------------------------- build
  _build() {
    const r = this.root;
    r.classList.add("player");
    r.dataset.mode = "radio";
    r.innerHTML = `
      <div class="pl-keys" role="group" aria-label="Tape controls">
        ${[["rew", 34, 52, "Rewind"], ["play", 92, 62, "Play"], ["ff", 160, 52, "Fast forward"], ["stop", 218, 52, "Stop, or eject when stopped"]]
          .map(([k, x, w, label]) => `<button type="button" class="pl-key pl-key-${k}" data-k="${k}" aria-label="${label}" style="${place(x, 0, w, 40)}">
            <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg></button>`).join("")}
      </div>
      ${SHELL_SVG}
      <div class="pl-bay" style="${place(DOOR.x, DOOR.y, DOOR.w, DOOR.h)}">
        <div class="pl-recess">${BAY_SVG}</div>
        <div class="pl-door">
          <div class="pl-hole" style="${dpl(HOLE)}"></div>
          <div class="pl-slot" style="${dpl(SLOT)}"></div>
          <div class="pl-glass" style="${dpl(HOLE)}"></div>
          ${DOOR_SVG}
        </div>
      </div>
      <canvas class="pl-lcd" style="${place(25, 216, 240, 54)}" aria-hidden="true"></canvas>
      <button type="button" class="pl-btn" data-k="band" style="${place(286, 98, 44, 24)}" aria-label="Next band">Band</button>
      <button type="button" class="pl-btn" data-k="side" style="${place(336, 98, 40, 24)}" aria-label="Turn the tape over">A/B</button>
      <button type="button" class="pl-switch" role="switch" aria-checked="true" aria-label="Radio" style="${place(286, 134, 90, 36)}">
        <span class="pl-switch-label">Tape</span><span class="pl-switch-track"><i></i></span><span class="pl-switch-label">Radio</span>
      </button>
      <div class="pl-wheel" role="slider" tabindex="0" aria-label="Tuning wheel" aria-valuetext="" style="${place(392, 92, 14, 108)}"></div>`;

    this.keys = Object.fromEntries([...r.querySelectorAll(".pl-key")].map((b) => [b.dataset.k, b]));
    this.door = r.querySelector(".pl-door");
    this.slot = r.querySelector(".pl-slot");
    this.lcd = r.querySelector(".pl-lcd");
    this.lcdCtx = this.lcd.getContext("2d");
    this.switchBtn = r.querySelector(".pl-switch");
    this.wheel = r.querySelector(".pl-wheel");

    // transport keys: press and hold for the winders
    for (const [k, b] of Object.entries(this.keys)) {
      b.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        this._lastPress = performance.now();
        b.setPointerCapture(e.pointerId);
        this._press(k);
      });
      const up = () => this._release(k);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up);
      b.addEventListener("lostpointercapture", up);
      b.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); this._lastPress = performance.now(); this._press(k); }
      });
      b.addEventListener("keyup", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._release(k); } });
      b.addEventListener("click", (e) => {
        e.preventDefault();
        if (performance.now() - (this._lastPress || 0) < 600) return;
        this._press(k);
        setTimeout(() => this._release(k), 150);
      });
    }
    r.querySelector('[data-k="band"]').addEventListener("click", () => {
      this._sfx("button");
      this.setMode("radio");
      this.o.onBand && this.o.onBand();
    });
    r.querySelector('[data-k="side"]').addEventListener("click", () => { this._sfx("button"); this.flip(); });
    this.switchBtn.addEventListener("click", () => {
      if (this.mode === "radio" && !this.tape) {
        this.o.announce && this.o.announce("Pick a tape from the shelf first.");
        this.o.onNeedTape && this.o.onNeedTape();
        this._nudge(this.switchBtn);
        return;
      }
      this.setMode(this.mode === "radio" ? "tape" : "radio");
    });
    this._bindWheel();

    if ("ResizeObserver" in window) new ResizeObserver(() => this.layout()).observe(r);
    this._labelKeys();
    this.layout();
  }

  _labelKeys() {
    const radio = this.mode === "radio";
    this.keys.rew.setAttribute("aria-label", radio ? "Previous station" : "Rewind (hold)");
    this.keys.ff.setAttribute("aria-label", radio ? "Next station" : "Fast forward (hold)");
  }

  _bindWheel() {
    const w = this.wheel;
    let lastY = null;
    w.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      lastY = e.clientY;
      w.setPointerCapture(e.pointerId);
      w.classList.add("is-turning");
    });
    w.addEventListener("pointermove", (e) => {
      if (lastY === null) return;
      const dy = e.clientY - lastY;
      lastY = e.clientY;
      if (dy) this._wheelTurn(-dy * (e.shiftKey ? 0.012 : 0.0035), dy);
    });
    const end = () => { lastY = null; w.classList.remove("is-turning"); this.o.onTuneEnd && this.o.onTuneEnd(); };
    w.addEventListener("pointerup", end);
    w.addEventListener("pointercancel", end);
    w.addEventListener("wheel", (e) => {
      e.preventDefault();
      const d = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      this._wheelTurn(-d * 0.0012, d * 0.25);
      clearTimeout(this._wheelIdle);
      this._wheelIdle = setTimeout(() => this.o.onTuneEnd && this.o.onTuneEnd(), 260);
    }, { passive: false });
    w.addEventListener("keydown", (e) => {
      const steps = { ArrowUp: 0.0015, ArrowRight: 0.0015, ArrowDown: -0.0015, ArrowLeft: -0.0015, PageUp: 0.05, PageDown: -0.05 };
      if (!(e.key in steps)) return;
      e.preventDefault();
      e.stopPropagation();
      this._wheelTurn(steps[e.key] * (e.shiftKey ? 12 : 1), -Math.sign(steps[e.key]) * 4);
    });
  }

  _wheelTurn(dLog, dPx) {
    this.setMode("radio");
    this.ribs += dPx;
    this.wheel.style.setProperty("--ribs", `${this.ribs.toFixed(1)}px`);
    this.o.onTune && this.o.onTune(dLog);
  }

  /** Turn the wheel along with tuning that came from somewhere else. */
  follow(dLog) {
    this.ribs -= dLog * 260;
    this.wheel.style.setProperty("--ribs", `${this.ribs.toFixed(1)}px`);
  }

  setWheelText(t) { this.wheel.setAttribute("aria-valuetext", t); }

  layout() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.lcd.clientWidth, h = this.lcd.clientHeight;
    if (!w || !h) return;
    this.lcd.width = Math.round(w * dpr);
    this.lcd.height = Math.round(h * dpr);
    this.lcdScale = (w / 240) * dpr;
    this.lastLcd = "";
  }

  // --------------------------------------------------------------------------- audio
  setAudio(engine) {
    this.engine = engine;
    this.powered = true;
    this.root.classList.add("is-on");
    this.lastLcd = "";
  }

  get ctx() { return this.engine && this.engine.ready ? this.engine.ctx : null; }
  get out() { return this.engine && this.engine.ready ? this.engine.tapeOut : null; }

  _sfx(name, ...args) {
    const ctx = this.ctx, out = this.out;
    return ctx && out ? foley[name](ctx, out, ...args) : null;
  }

  setVolume(v, muted) {
    this.volume = v;
    this.muted = muted;
    if (this.el && this.route === "direct") {
      this.el.volume = Math.min(1, v);
      this.el.muted = muted;
    }
  }

  /** Local copies (from tools/fetch_tapes.py) and their durations, from data/tapes/tapes.json. */
  setFiles(files = {}, durations = {}) {
    this.files = files;
    this.durations = durations;
  }

  _unloadAudio() {
    if (this.el) {
      try { this.el.pause(); } catch (e) { /* gone */ }
      this.el.removeAttribute("src");
      try { this.el.load(); } catch (e) { /* gone */ }
    }
    if (this.srcNode) { try { this.srcNode.disconnect(); } catch (e) { /* gone */ } }
    this.el = null;
    this.srcNode = null;
    this.analyser = null;
    this.route = null;
    this.loadState = "none";
  }

  /** Load the current side: the local copy if there is one, otherwise straight from NASA. */
  _loadSide() {
    this._unloadAudio();
    const s = this.tape && this.tape.sides[this.side];
    const sideIdx = this.side;
    if (!s) { this.dur[sideIdx] = BLANK_SECONDS; this.loadState = "blank"; return; }
    if (this.durations[s.file]) this.dur[sideIdx] = this.durations[s.file];
    const attempts = [];
    if (this.files[s.file]) attempts.push({ src: `data/tapes/${this.files[s.file]}`, route: "graph" });
    attempts.push({ src: s.url, route: "graph", cors: true });
    attempts.push({ src: s.url, route: "direct" });
    const token = (this._loadToken = {});
    this.loadState = "loading";
    const tryNext = () => {
      if (token !== this._loadToken) return;
      const a = attempts.shift();
      if (!a) {
        this.loadState = "error";
        this.lastLcd = "";
        if (this.playing) { this.stop({ quiet: true }); this._sfx("clunk"); }
        this.o.onLoadError && this.o.onLoadError(this.tape, sideIdx);
        this.o.announce && this.o.announce("This recording couldn't load. Check your connection and press play again.");
        return;
      }
      if (a.route === "graph" && !this.ctx) {
        // no Web Audio: a local copy can still play straight through the element
        if (a.cors) { tryNext(); return; }
        a.route = "direct";
      }
      const el = new Audio();
      el.preload = "auto";
      el.setAttribute("playsinline", "");
      if (a.cors) el.crossOrigin = "anonymous";
      if ("preservesPitch" in el) el.preservesPitch = false;
      else if ("webkitPreservesPitch" in el) el.webkitPreservesPitch = false;
      else if ("mozPreservesPitch" in el) el.mozPreservesPitch = false;
      const fail = () => { if (token === this._loadToken && this.el === el) { this.el = null; tryNext(); } };
      el.addEventListener("error", fail, { once: true });
      el.addEventListener("loadedmetadata", () => {
        if (token !== this._loadToken) return;
        if (isFinite(el.duration) && el.duration > 0) this.dur[sideIdx] = el.duration;
        this.route = a.route;
        if (a.route === "graph") {
          try {
            const ctx = this.ctx;
            this.srcNode = ctx.createMediaElementSource(el);
            this.analyser = ctx.createAnalyser();
            this.analyser.fftSize = 1024;
            this.srcNode.connect(this.analyser).connect(this.out);
          } catch (e) {
            this.route = "direct";
          }
        }
        if (this.route === "direct") this.setVolume(this.volume ?? 0.8, !!this.muted);
        this.loadState = "ready";
        this.lastLcd = "";
        if (this.playing && el.paused) this._startElement(0);
      }, { once: true });
      el.addEventListener("ended", () => { if (this.el === el && this.playing) this._autoStop(); });
      this.el = el;
      el.src = a.src;
    };
    tryNext();
  }

  _startElement(delay) {
    const el = this.el;
    if (!el) return;
    clearTimeout(this._startT);
    this._startT = setTimeout(() => {
      if (this.el !== el || !this.playing) return;
      const d = this.dur[this.side];
      try { el.currentTime = Math.min(this.pos[this.side], d ? d - 0.05 : Infinity); } catch (e) { /* not seekable yet */ }
      el.playbackRate = this.cue > 0 ? CUE : 1;
      const p = el.play();
      if (p && p.catch) p.catch((e) => console.warn("Tape couldn't play:", e));
    }, delay);
  }

  // --------------------------------------------------------------------------- keys
  _press(k) {
    const b = this.keys[k];
    if (k === "play") {
      if (!this.tape) { this._keyBlip(b); this._nudgeShelf(); return; }
      if (this.playing) { this._keyBlip(b); return; }
      this.play();
      return;
    }
    b.classList.add("is-down");
    this._sfx("keyDown");
    if (k === "stop") {
      if (this.playing || this.wind) this.stop();
      else if (this.tape) this.eject();
      else this._nudgeShelf();
      return;
    }
    const dir = k === "ff" ? 1 : -1;
    if (this.mode === "radio") {
      // on the radio, the same keys jump between stations
      this.o.onSeek && this.o.onSeek(dir);
      return;
    }
    if (!this.tape || this.busy) return;
    if (this.playing) {
      // cue (forward, faster and higher) and review (back, in skips)
      this.cue = dir;
      if (dir > 0 && this.el) this.el.playbackRate = CUE;
      if (dir < 0 && this.el) this.el.pause();
      this.motor && this.motor.set(3);
    } else {
      this.wind = dir;
      this._ensureMotor().set(3);
    }
  }

  _release(k) {
    const b = this.keys[k];
    if (k === "play") return;
    if (b.classList.contains("is-down")) { b.classList.remove("is-down"); this._sfx("keyUp"); }
    if ((k === "ff" || k === "rew") && (this.cue || this.wind)) {
      if (this.cue) {
        const wasReview = this.cue < 0;
        this.cue = 0;
        if (this.el) {
          this.el.playbackRate = 1;
          if (wasReview && this.playing) this._startElement(0);
        }
        this.motor && this.motor.set(this.playing ? 1 : 0);
      }
      if (this.wind) { this.wind = 0; this.motor && this.motor.set(this.playing ? 1 : 0); }
    }
  }

  _keyBlip(b) {
    b.classList.add("is-down");
    this._sfx("keyDown");
    setTimeout(() => { if (!(b === this.keys.play && this.playing)) b.classList.remove("is-down"); this._sfx("keyUp"); }, 140);
  }

  _nudge(el) {
    if (reduceMotion) return;
    el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
      { duration: 220, easing: "ease-in-out" });
  }

  _nudgeShelf() {
    this.o.announce && this.o.announce("No tape in the player. Pick one from the shelf.");
    this.o.onNeedTape && this.o.onNeedTape();
  }

  _ensureMotor() {
    if (!this.motor && this.ctx) this.motor = foley.motor(this.ctx, this.out);
    return this.motor || { set() {}, stop() {} };
  }

  // --------------------------------------------------------------------------- transport
  async play() {
    if (!this.tape || this.busy || this.playing) return;
    this.setMode("tape");
    const d = this.dur[this.side];
    if (d && this.pos[this.side] >= d - 0.2) await this._autoRewind();
    if (this.loadState === "error") this._loadSide(); // try again
    this.playing = true;
    this.root.classList.add("is-playing");
    this.root.classList.remove("wants-play");
    this.keys.play.classList.add("is-down");
    this._sfx("keyDown", true);
    this._ensureMotor().set(1);
    const leader = this.pos[this.side] < 0.05;
    if (!this.tape.sides[this.side]) {
      // a blank side: nothing but tape hiss until the end
      this._blankHiss = this._sfx("hiss", Math.max(0.5, BLANK_SECONDS - this.pos[this.side]), 0.022);
    } else {
      if (leader) this._sfx("hiss", 0.5);
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    }
    this._startElement(leader ? 420 : 40);
    this.o.onPlayState && this.o.onPlayState(true);
    this.lastLcd = "";
  }

  stop({ quiet = false } = {}) {
    const was = this.playing || this.wind;
    clearTimeout(this._startT);
    this.playing = false;
    this.cue = 0;
    this.wind = 0;
    this.root.classList.remove("is-playing");
    if (this.el) { try { this.el.pause(); } catch (e) { /* fine */ } }
    if (this._blankHiss) { this._blankHiss.stop(); this._blankHiss = null; }
    if (this.keys.play.classList.contains("is-down")) {
      this.keys.play.classList.remove("is-down");
      if (!quiet) this._sfx("keyUp");
    }
    this.motor && this.motor.set(0);
    if (was) this.o.onPlayState && this.o.onPlayState(false);
    this.lastLcd = "";
  }

  togglePlay() { if (this.playing) this.stop(); else this.play(); }

  _autoStop() {
    this.pos[this.side] = this.dur[this.side] || this.pos[this.side];
    this.stop({ quiet: true });
    this._sfx("clunk");
    this.o.announce && this.o.announce(`End of side ${this.side ? "B" : "A"}.`);
  }

  async _autoRewind() {
    // a quick, audible rewind to the start, the way a deck with auto-rewind would
    this.wind = -1;
    this._ensureMotor().set(3);
    const d = this.dur[this.side] || 1;
    const ms = reduceMotion ? 0 : Math.min(700, 250 + d * 12);
    await new Promise((ok) => setTimeout(ok, ms));
    this.wind = 0;
    this.pos[this.side] = 0;
    this.motor && this.motor.set(0);
  }

  setMode(mode) {
    if (mode === this.mode) return;
    if (mode === "radio" && (this.playing || this.wind)) this.stop();
    this.mode = mode;
    this.root.dataset.mode = mode;
    this.switchBtn.setAttribute("aria-checked", String(mode === "radio"));
    this._labelKeys();
    this._sfx("switchSlide");
    this.lastLcd = "";
    this.o.onMode && this.o.onMode(mode);
  }

  // --------------------------------------------------------------------------- the tape itself
  /** Where the tape sits with the door shut, whatever the door is doing right now. */
  _slotRect() {
    const b = this.root.querySelector(".pl-bay").getBoundingClientRect();
    const kx = b.width / DOOR.w, ky = b.height / DOOR.h;
    return { left: b.left + SLOT.x * kx, top: b.top + SLOT.y * ky, width: SLOT.w * kx, height: SLOT.h * ky };
  }

  _setSlot(tape, side) {
    this.slot.innerHTML = tape ? cassetteSVG(tape, side) : "";
    this.hubs = tape ? [this.slot.querySelector(".cs-hubL"), this.slot.querySelector(".cs-hubR")] : null;
    this.packs = tape ? [this.slot.querySelector(".cs-packL"), this.slot.querySelector(".cs-packR")] : null;
    this.root.classList.toggle("has-tape", !!tape);
    this._drawReels(true);
  }

  /** Put a tape in: the door springs open, the tape flies over from the shelf, the door snaps shut. */
  async insert(tape, side = 0) {
    if (this.busy) return;
    if (this.tape && this.tape.id === tape.id) { if (!this.playing) this.play(); return; }
    this.busy = true;
    try {
      if (this.tape) await this._takeOut(true);
      this.tape = tape;
      this.side = side;
      this.pos = [0, 0];
      this.dur = [null, null];
      this.o.onSpine && this.o.onSpine(tape.id, true);
      this._setSlot(tape, side);
      this.slot.style.visibility = "hidden";
      this._loadSide();
      const flat = this._slotRect();
      const from = this.o.spineRect ? this.o.spineRect(tape.id) : null;
      const opening = this._door(true);
      await this._fly(cassetteSVG(tape, side), from, flat, "in");
      await opening;
      await this._dropIn(cassetteSVG(tape, side), flat);
      this.root.classList.add("wants-play");
      this.setMode("tape");
      this.o.onTape && this.o.onTape(tape, side);
      this.o.announce && this.o.announce(`${tape.cat}, ${tape.title}, side ${side ? "B" : "A"}. Press play.`);
    } finally {
      this.busy = false;
      this.lastLcd = "";
    }
  }

  async eject() {
    if (!this.tape || this.busy) return;
    this.busy = true;
    try {
      await this._takeOut(false);
      this.setMode("radio"); // nothing left to play: the radio comes back on
      this.o.onTape && this.o.onTape(null, 0);
      this.o.announce && this.o.announce("Tape ejected. Back to the radio.");
    } finally {
      this.busy = false;
      this.lastLcd = "";
    }
  }

  /** Door open, tape out and back to the shelf. `swap`: another tape is on its way in. */
  async _takeOut(swap) {
    const tape = this.tape;
    this.stop({ quiet: true });
    this._unloadAudio();
    this.root.classList.remove("wants-play");
    const flat = this._slotRect();
    const svg = cassetteSVG(tape, this.side);
    await this._door(true);
    this.slot.style.visibility = "hidden";
    const to = this.o.spineRect ? this.o.spineRect(tape.id) : null;
    const flight = this._fly(svg, to, flat, "out");
    if (!swap) setTimeout(() => this._door(false), reduceMotion ? 0 : 380);
    await flight;
    this.o.onSpine && this.o.onSpine(tape.id, false);
    this.tape = null;
    this._setSlot(null);
    this.slot.style.visibility = "";
  }

  /** Turn the tape over. */
  async flip() {
    if (!this.tape || this.busy) return;
    this.busy = true;
    try {
      this.stop({ quiet: true });
      this.setMode("tape");
      const tape = this.tape;
      const next = this.side ? 0 : 1;
      const flat = this._slotRect();
      await this._door(true);
      this.slot.style.visibility = "hidden";
      const clone = this._clone(cassetteSVG(tape, this.side), flat);
      const lift = flat.height * 0.62;
      const persp = "perspective(900px)";
      if (!reduceMotion) {
        await clone.animate([{ transform: `${persp} translateY(0)` }, { transform: `${persp} translateY(${-lift}px)` }],
          { duration: 200, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" }).finished;
        await clone.animate([{ transform: `${persp} translateY(${-lift}px) rotateY(0deg)` }, { transform: `${persp} translateY(${-lift}px) rotateY(90deg)` }],
          { duration: 140, easing: "ease-in", fill: "forwards" }).finished;
      }
      clone.innerHTML = cassetteSVG(tape, next);
      if (!reduceMotion) {
        await clone.animate([{ transform: `${persp} translateY(${-lift}px) rotateY(-90deg)` }, { transform: `${persp} translateY(${-lift}px) rotateY(0deg)` }],
          { duration: 140, easing: "ease-out", fill: "forwards" }).finished;
      }
      clone.remove();
      this.side = next;
      this._setSlot(tape, next);
      this.slot.style.visibility = "hidden";
      this._loadSide();
      await this._dropIn(cassetteSVG(tape, next), flat, lift);
      this.root.classList.add("wants-play");
      this.o.onTape && this.o.onTape(tape, next);
      const s = tape.sides[next];
      this.o.announce && this.o.announce(`Side ${next ? "B" : "A"}${s ? (tape.sides.length > 1 ? `: ${s.name}` : "") : ": blank"}.`);
    } finally {
      this.busy = false;
      this.lastLcd = "";
    }
  }

  _door(open) {
    const d = this.door;
    const to = open ? -34 : 0;
    const from = this._doorAngle ?? 0;
    if (from === to) return Promise.resolve();
    this._doorAngle = to;
    this.root.classList.toggle("door-open", open);
    this._sfx(open ? "doorOpen" : "doorClose");
    if (reduceMotion) { d.style.transform = `rotateX(${to}deg)`; return Promise.resolve(); }
    const a = d.animate(
      open ? [{ transform: `rotateX(${from}deg)` }, { transform: "rotateX(-38deg)", offset: 0.7 }, { transform: `rotateX(${to}deg)` }]
        : [{ transform: `rotateX(${from}deg)` }, { transform: "rotateX(2.5deg)", offset: 0.75 }, { transform: "rotateX(0deg)" }],
      { duration: open ? 300 : 210, easing: open ? "cubic-bezier(.2,.9,.3,1)" : "cubic-bezier(.55,0,.8,.4)", fill: "forwards" });
    return a.finished.then(() => { d.style.transform = `rotateX(${to}deg)`; a.cancel(); });
  }

  _clone(svg, rect) {
    const c = document.createElement("div");
    c.className = "tape-flight";
    c.innerHTML = svg;
    Object.assign(c.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    (this.o.flightLayer || document.body).appendChild(c);
    return c;
  }

  /**
   * Fly a tape between a spine on the shelf and the player. `dir` "in": spine → above the door.
   * "out": the door → back into the spine.
   */
  async _fly(svg, spine, flat, dir) {
    const lift = flat.height * 0.62;
    const c = this._clone(svg, flat);
    if (!spine || reduceMotion) {
      if (dir === "in") { c.style.transform = `perspective(900px) translate(0px, ${-lift}px)`; this._inflight = c; }
      await new Promise((ok) => setTimeout(ok, reduceMotion ? 60 : 0));
      if (dir === "out") c.remove();
      return c;
    }
    const cx = flat.left + flat.width / 2, cy = flat.top + flat.height / 2;
    const sx = spine.left + spine.width / 2 - cx, sy = spine.top + spine.height / 2 - cy;
    const s0 = Math.min(0.9, (spine.height * 0.96) / flat.width);
    const p0 = [sx, sy], p2 = [0, -lift];
    const p1 = [(sx + 0) / 2, Math.min(sy, -lift) - Math.min(160, Math.abs(sx) * 0.35 + 60)];
    const bez = (t) => [0, 1].map((i) => (1 - t) ** 2 * p0[i] + 2 * (1 - t) * t * p1[i] + t * t * p2[i]);
    const frames = [];
    const persp = "perspective(900px)";
    frames.push({ offset: 0, transform: `${persp} translate(${sx}px, ${sy}px) rotate(-90deg) scale(${s0}) rotateY(82deg)`, opacity: 0.4 });
    frames.push({ offset: 0.14, transform: `${persp} translate(${sx}px, ${sy - 26}px) rotate(-90deg) scale(${s0 * 1.04}) rotateY(0deg)`, opacity: 1 });
    const N = 7;
    for (let k = 1; k <= N; k++) {
      const t = k / N;
      const [x, y] = bez(t);
      const rot = -90 * Math.max(0, 1 - t / 0.78);
      const sc = s0 + (1 - s0) * Math.min(1, t / 0.9);
      frames.push({ offset: 0.14 + 0.86 * t, transform: `${persp} translate(${x}px, ${y - 26 * (1 - t)}px) rotate(${rot}deg) scale(${sc}) rotateY(0deg)`, opacity: 1 });
    }
    const dist = Math.hypot(sx, sy);
    const duration = Math.max(520, Math.min(860, 380 + dist * 0.55));
    if (dir === "out") {
      frames.reverse().forEach((f) => { f.offset = 1 - f.offset; });
      frames.unshift({ offset: 0, transform: `${persp} translate(0px, 0px)`, opacity: 1 });
      frames[1].offset = 0.16;
      // squeeze offsets 0.16..1 for the rest
      for (let i = 2; i < frames.length; i++) frames[i].offset = 0.16 + (frames[i].offset) * 0.84;
      frames[frames.length - 1].offset = 1;
    }
    const a = c.animate(frames, { duration, easing: dir === "in" ? "cubic-bezier(.45,.05,.25,1)" : "cubic-bezier(.5,0,.35,1)", fill: "forwards" });
    await a.finished;
    if (dir === "out") c.remove();
    else { c.style.transform = `${persp} translate(0px, ${-lift}px)`; a.cancel(); this._inflight = c; }
    return c;
  }

  /** The last stretch: the tape slides down into the open door as the door snaps shut. */
  async _dropIn(svg, flat, liftOverride) {
    const lift = liftOverride ?? flat.height * 0.62;
    let c = this._inflight;
    this._inflight = null;
    if (!c) { c = this._clone(svg, flat); c.style.transform = `perspective(900px) translate(0px, ${-lift}px)`; }
    this._sfx("seat");
    if (!reduceMotion) {
      const slide = c.animate([{ transform: `perspective(900px) translate(0px, ${-lift}px)` }, { transform: "perspective(900px) translate(0px, 0px)" }],
        { duration: 190, easing: "cubic-bezier(.6,0,.9,.6)", fill: "forwards" });
      setTimeout(() => this._door(false), 40);
      await slide.finished;
    } else {
      await this._door(false);
    }
    this.slot.style.visibility = "";
    c.remove();
    if (!reduceMotion) {
      await new Promise((ok) => setTimeout(ok, 120));
      this.root.animate([{ transform: "translateY(0)" }, { transform: "translateY(1.5px)" }, { transform: "translateY(0)" }], { duration: 140 });
    }
  }

  // --------------------------------------------------------------------------- every frame
  /** `radio`: { fMHz parts, band, station, lock } from the sky, for the display. */
  tick(dt, radio) {
    this.radio = radio;
    const s = this.side;
    const d = this.dur[s];
    if (this.tape) {
      if (this.playing && !this.cue) {
        if (this.el && !this.el.paused && this.route) this.pos[s] = this.el.currentTime;
        else if (!this.tape.sides[s]) {
          this.pos[s] += dt;
          if (this.pos[s] >= BLANK_SECONDS) this._autoStop();
        }
      } else if (this.playing && this.cue > 0) {
        if (this.el && !this.el.paused) this.pos[s] = this.el.currentTime;
      } else if (this.playing && this.cue < 0) {
        this.pos[s] = Math.max(0, this.pos[s] - dt * CUE * 2.2);
        if (this.el) { try { this.el.currentTime = this.pos[s]; } catch (e) { /* not ready */ } }
      } else if (this.wind && d) {
        this.pos[s] = Math.min(d, Math.max(0, this.pos[s] + this.wind * WIND * dt));
        if (this.pos[s] <= 0 || this.pos[s] >= d) {
          this.wind = 0;
          this.motor && this.motor.set(0);
          this._sfx("clunk");
          for (const k of ["ff", "rew"]) this.keys[k].classList.remove("is-down");
        }
      }
      // reels: tape runs left to right across the bottom of the window, so both turn anticlockwise
      let v = 0;
      if (this.playing) v = this.cue > 0 ? CUE : this.cue < 0 ? -CUE * 2.2 : 1;
      if (this.wind) v = this.wind * WIND_VIS;
      if (v) {
        const r = this._packRadii();
        for (let i = 0; i < 2; i++) this.ang[i] -= ((v * TAPE_MM_S) / r[i]) * dt * (180 / Math.PI);
      }
      this._drawReels();
    }
    // the VU meter, from the real signal when the browser lets us see it
    let level = 0;
    if (this.analyser && this.playing) {
      const buf = this._vuBuf || (this._vuBuf = new Float32Array(this.analyser.fftSize));
      this.analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      level = Math.max(0, Math.min(1, (20 * Math.log10(rms + 1e-6) + 48) / 44));
    }
    this.vu += (level - this.vu) * (level > this.vu ? 0.5 : 0.12);
    this._drawLcd();
  }

  _packRadii() {
    const d = this.dur[this.side];
    const p = d ? Math.min(1, Math.max(0, this.pos[this.side] / d)) : 0;
    const a = PACK_MIN * PACK_MIN, b = PACK_MAX * PACK_MAX;
    return [Math.sqrt(b - p * (b - a)), Math.sqrt(a + p * (b - a))];
  }

  _drawReels(force) {
    if (!this.hubs) return;
    const r = this._packRadii();
    const key = `${r[0].toFixed(2)}${r[1].toFixed(2)}${this.ang[0].toFixed(1)}${this.ang[1].toFixed(1)}`;
    if (!force && key === this._reelKey) return;
    this._reelKey = key;
    this.packs[0].setAttribute("r", r[0].toFixed(3));
    this.packs[1].setAttribute("r", r[1].toFixed(3));
    this.hubs[0].setAttribute("transform", `rotate(${(this.ang[0] % 360).toFixed(2)} ${HUB_L[0]} ${HUB_L[1]})`);
    this.hubs[1].setAttribute("transform", `rotate(${(this.ang[1] % 360).toFixed(2)} ${HUB_R[0]} ${HUB_R[1]})`);
  }

  // --------------------------------------------------------------------------- the display
  _drawLcd() {
    const ctx = this.lcdCtx;
    if (!this.lcdScale) return;
    const rd = this.radio || {};
    const tapeMode = this.mode === "tape";
    const s = this.side;
    let state;
    if (!this.powered) state = "off";
    else if (tapeMode) {
      const t = this.tape;
      const icon = !t ? "" : this.wind > 0 || this.cue > 0 ? "ff" : this.wind < 0 || this.cue < 0 ? "rew" : this.playing ? "play" : "stop";
      const d = this.dur[s];
      state = ["tape", t ? t.cat : "", s, icon, t ? clock(this.pos[s]) : "", d ? clock(d) : "", this.loadState,
        Math.round(this.vu * 24), t && !t.sides[s] ? 1 : 0].join("|");
    } else {
      state = ["radio", rd.value, rd.unit, rd.band, rd.wave, rd.station, Math.round((rd.lock || 0) * 5)].join("|");
    }
    if (state === this.lastLcd) return;
    this.lastLcd = state;

    const S = this.lcdScale;
    const W = 240, H = 54;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    if (this.powered) { bg.addColorStop(0, "#f0c06c"); bg.addColorStop(1, "#d99e4c"); }
    else { bg.addColorStop(0, "#6f6a5c"); bg.addColorStop(1, "#5c574b"); }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // inner shadow at the edges of the glass
    const sh = ctx.createLinearGradient(0, 0, 0, 7);
    sh.addColorStop(0, "rgba(60,30,0,0.28)");
    sh.addColorStop(1, "rgba(60,30,0,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(0, 0, W, 7);
    const ink = "rgba(38,20,5,0.9)", ghost = this.powered ? "rgba(38,20,5,0.075)" : "rgba(0,0,0,0.08)";

    // digits: up to six, right-aligned
    const digits = !this.powered ? "" : tapeMode ? (this.tape ? clock(this.pos[s]) : "") : String(rd.value || "").replace(/,/g, "");
    seg7(ctx, digits, { right: 196, top: 9, h: 27, w: 13.5, t: 3.1, gap: 3.6, cells: 6, ink, ghost });

    if (!this.powered) return;
    text(ctx, tapeMode ? "TAPE" : rd.band || "", 9, 15.5, 8.4, ink, 760);
    if (tapeMode) {
      const t = this.tape;
      text(ctx, t ? `SIDE ${s ? "B" : "A"}` : "NO TAPE", 9, 26, 7.2, ink, 650);
      const icon = state.split("|")[3];
      drawIcon(ctx, icon, 9, 32, ink);
      const d = this.dur[s];
      if (t) text(ctx, d ? `/${clock(d)}` : this.loadState === "error" ? "" : "/–:––", 201, 33.5, 8.6, ink, 640);
      // bottom row: tape number, then the level meter
      if (t) {
        text(ctx, t.cat, 9, 49.5, 7.2, ink, 700);
        if (this.loadState === "error") text(ctx, "COULDN'T LOAD", 64, 49.5, 7.2, ink, 700);
        else if (!t.sides[s]) text(ctx, "BLANK SIDE", 64, 49.5, 7.2, ink, 700);
        else if (this.loadState === "loading" && !this.playing) text(ctx, "LOADING", 64, 49.5, 7.2, ink, 700);
        else meter(ctx, 64, 43.5, 168, 6, this.analyser ? this.vu : null, ink, ghost);
      } else {
        text(ctx, "PICK A TAPE FROM THE SHELF", 9, 49.5, 7.2, ink, 650);
      }
    } else {
      text(ctx, rd.wave || "", 9, 26, 7.2, ink, 650);
      bars(ctx, 9, 33, rd.lock || 0, ink, ghost);
      text(ctx, rd.unit || "", 201, 33.5, 10.5, ink, 760);
      text(ctx, rd.station || "", 64, 49.5, 7.6, ink, 720);
    }
  }
}

// ----------------------------------------------------------------------------- LCD drawing
const SEGS = {
  0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abfgcd", "-": "g", " ": "",
};

function seg7(ctx, str, o) {
  // lay the string into cells from the right: digits take a cell, '.' and ':' ride along
  const cells = [];
  for (const ch of str) {
    if (ch === "." && cells.length) cells[cells.length - 1].dot = true;
    else if (ch === ":") cells.push({ colon: true });
    else cells.push({ ch });
  }
  const digitCells = cells.filter((c) => !c.colon).length;
  for (let k = digitCells; k < o.cells; k++) cells.unshift({ ch: " " });
  let x = o.right;
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i];
    if (c.colon) {
      x -= 6;
      ctx.fillStyle = o.ink;
      const cx = x + 1.2;
      ctx.beginPath();
      ctx.rect(cx - 1.4 + 2.2, o.top + o.h * 0.3 - 1.4, 2.8, 2.8);
      ctx.rect(cx - 1.4, o.top + o.h * 0.72 - 1.4, 2.8, 2.8);
      ctx.fill();
      continue;
    }
    x -= o.w;
    digit(ctx, x, o.top, o.w, o.h, o.t, SEGS[c.ch] ?? "", o.ink, o.ghost);
    // decimal point, after this digit
    ctx.fillStyle = c.dot ? o.ink : o.ghost;
    ctx.fillRect(x + o.w + 0.4, o.top + o.h - o.t + 0.2, o.t * 0.9, o.t * 0.9);
    x -= o.gap;
  }
}

function digit(ctx, x0, y0, w, h, t, on, ink, ghost) {
  const slant = 0.1;
  const g = t * 0.32;
  const P = (x, y) => [x0 + x + (h - y) * slant, y0 + y];
  const hseg = (y, x1, x2) => [P(x1, y), P(x1 + t / 2, y - t / 2), P(x2 - t / 2, y - t / 2), P(x2, y), P(x2 - t / 2, y + t / 2), P(x1 + t / 2, y + t / 2)];
  const vseg = (x, y1, y2) => [P(x, y1), P(x + t / 2, y1 + t / 2), P(x + t / 2, y2 - t / 2), P(x, y2), P(x - t / 2, y2 - t / 2), P(x - t / 2, y1 + t / 2)];
  const segs = {
    a: hseg(t / 2, t / 2 + g, w - t / 2 - g),
    b: vseg(w - t / 2, t / 2 + g, h / 2 - g),
    c: vseg(w - t / 2, h / 2 + g, h - t / 2 - g),
    d: hseg(h - t / 2, t / 2 + g, w - t / 2 - g),
    e: vseg(t / 2, h / 2 + g, h - t / 2 - g),
    f: vseg(t / 2, t / 2 + g, h / 2 - g),
    g: hseg(h / 2, t / 2 + g, w - t / 2 - g),
  };
  for (const [k, pts] of Object.entries(segs)) {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fillStyle = on.includes(k) ? ink : ghost;
    ctx.fill();
  }
}

function text(ctx, s, x, y, size, color, weight = 700) {
  ctx.font = `${weight} ${size}px Anybody, "Arial Narrow", sans-serif`;
  if ("fontStretch" in ctx) ctx.fontStretch = "semi-condensed";
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0.4px";
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
}

function drawIcon(ctx, icon, x, y, ink) {
  ctx.fillStyle = ink;
  ctx.beginPath();
  if (icon === "play") { ctx.moveTo(x, y); ctx.lineTo(x + 9, y + 5.2); ctx.lineTo(x, y + 10.4); }
  else if (icon === "stop") ctx.rect(x, y + 0.6, 9, 9);
  else if (icon === "ff") { tri(ctx, x, y, 1); tri(ctx, x + 7, y, 1); }
  else if (icon === "rew") { tri(ctx, x + 7, y, -1); tri(ctx, x + 14, y, -1); }
  ctx.fill();
}

function tri(ctx, x, y, dir) {
  if (dir > 0) { ctx.moveTo(x, y); ctx.lineTo(x + 7, y + 5.2); ctx.lineTo(x, y + 10.4); ctx.closePath(); }
  else { ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 5.2); ctx.lineTo(x, y + 10.4); ctx.closePath(); }
}

function bars(ctx, x, y, lock, ink, ghost) {
  const n = 5, lit = Math.round(lock * n);
  for (let i = 0; i < n; i++) {
    const h = 3 + i * 1.9;
    ctx.fillStyle = i < lit ? ink : ghost;
    ctx.fillRect(x + i * 5.2, y + 11 - h, 3.6, h);
  }
}

function meter(ctx, x, y, w, h, v, ink, ghost) {
  const n = 24, gap = 1.4, sw = (w - gap * (n - 1)) / n;
  const lit = v === null ? 0 : Math.round(v * n);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i < lit ? ink : ghost;
    const hh = i >= n - 5 ? h : h * 0.72;
    ctx.fillRect(x + i * (sw + gap), y + (h - hh), sw, hh);
  }
}
