// The receiver: static whose loudness follows the sky's real brightness temperature,
// a whoosh while you tune, and a voice for each station that fades in as you lock on.

import * as synth from "./synth.js";
import { H_LINE, OH_LINES, CO_LINES, lineToHz } from "./stations.js";
import { LOG_MIN, GSM_MAX, clamp } from "./format.js";

const LEVEL = {
  jupiter: 0.62, pulsar: 0.8, broadcast: 0.55, hydrogen: 0.2, waterhole: 0.17, gps: 0.13,
  maser: 0.17, co: 0.16, cmb: 0.34, dust: 0.36,
};

// sky temperature range mapped to loudness (kelvin)
const T_QUIET = 0.3, T_LOUD = 3e5;

export function loudness(tSky) {
  return clamp((Math.log10(Math.max(tSky, 1e-9)) - Math.log10(T_QUIET)) / (Math.log10(T_LOUD) - Math.log10(T_QUIET)), 0, 1);
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.voices = {};
    this.muted = false;
    this.volume = 0.8;
    this.ready = false; // true once the static and whoosh are wired up
  }

  /** Must be called from a user gesture. */
  async start() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("Web Audio isn't supported in this browser.");
    this._unlockIOS();
    const ctx = new AC({ latencyHint: "interactive" });
    this.ctx = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    this.master.connect(comp).connect(ctx.destination);
    // everything the radio makes goes through one bus, so a tape can take over cleanly
    this.radioBus = ctx.createGain();
    this.radioBus.gain.value = this.radioOn === false ? 0 : 1;
    this.radioBus.connect(this.master);
    // the tape player has its own output, without the compressor: recordings play as they are
    this.tapeOut = ctx.createGain();
    this.tapeOut.gain.value = 0;
    this.tapeOut.connect(ctx.destination);

    // static bed
    const pink = synth.pinkNoise(ctx, 7);
    this.staticSrc = this._loop(pink);
    this.staticLp = ctx.createBiquadFilter();
    this.staticLp.type = "lowpass";
    this.staticLp.frequency.value = 3000;
    this.staticLp.Q.value = 0.4;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 70;
    this.staticGain = ctx.createGain();
    this.staticGain.gain.value = 0;
    this.staticSrc.connect(this.staticLp).connect(hp).connect(this.staticGain).connect(this.radioBus);

    // tuning whoosh
    this.whooshSrc = this._loop(pink, 2.1);
    this.whooshBp = ctx.createBiquadFilter();
    this.whooshBp.type = "bandpass";
    this.whooshBp.Q.value = 2.2;
    this.whooshGain = ctx.createGain();
    this.whooshGain.gain.value = 0;
    this.whooshSrc.connect(this.whooshBp).connect(this.whooshGain).connect(this.radioBus);

    this.ready = true;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, ctx.currentTime, 0.4);
    this.tapeOut.gain.setTargetAtTime(this.muted ? 0 : this.volume, ctx.currentTime, 0.05);
    document.addEventListener("visibilitychange", () => this._applyMaster());
    // station voices are built a few at a time, so the opening sweep stays smooth
    this._buildVoices().then(() => this._tryRecordings());
  }

  _loop(buffer, offset = 0) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.start(0, offset % buffer.duration);
    return s;
  }

  _voiceOut(id) {
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.connect(this.radioBus);
    this.voices[id] = { gain: g, level: LEVEL[id] ?? 0.3 };
    return g;
  }

  _osc(freq, gain, out) {
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    o.connect(g).connect(out);
    o.start();
    return o;
  }

  async _buildVoices() {
    const ctx = this.ctx;
    const pause = () => new Promise((ok) => setTimeout(ok, 16));
    // the opening sweep runs from 10 MHz up to the FM band, so those voices come first
    this.broadcastComb = ctx.createGain();
    this.broadcastComb.gain.value = 1;
    this._bufferVoice("broadcast", synth.broadcast(ctx), this.broadcastComb);
    await pause();
    this._bufferVoice("jupiter", synth.jupiter(ctx));
    await pause();
    this._bufferVoice("pulsar", synth.pulsar(ctx));
    await pause();
    this._bufferVoice("gps", synth.gps(ctx));
    await pause();
    this._bufferVoice("cmb", synth.whiteNoise(ctx, 6));
    await pause();
    this._bufferVoice("dust", synth.dust(ctx));
    await pause();

    // hydrogen: the line slowed by 22 octaves, plus a soft octave above
    const h = this._voiceOut("hydrogen");
    const hz = lineToHz(H_LINE, 22);
    this._osc(hz, 1, h);
    this._osc(hz * 2, 0.16, h);

    // the water hole: hydrogen and the four hydroxyl lines, all slowed 22 octaves
    const w = this._voiceOut("waterhole");
    this._osc(hz, 0.7, w);
    const ohGain = [0.14, 0.45, 0.55, 0.14];
    OH_LINES.forEach((f, i) => this._osc(lineToHz(f, 22), ohGain[i], w));

    // water maser, flickering
    const m = this._voiceOut("maser");
    const flick = ctx.createGain();
    flick.gain.value = 0.25;
    flick.connect(m);
    this._osc(lineToHz(22235.08, 26), 1, flick);
    const fl = ctx.createBufferSource();
    fl.buffer = synth.flicker(ctx);
    fl.loop = true;
    const depth = ctx.createGain();
    depth.gain.value = 0.85;
    fl.connect(depth).connect(flick.gain);
    fl.start();

    // carbon monoxide: its nearly harmonic rotational ladder, slowed 30 octaves
    const c = this._voiceOut("co");
    const coGain = [1, 0.55, 0.35, 0.22];
    CO_LINES.forEach((f, i) => this._osc(lineToHz(f, 30), coGain[i], c));
  }

  /** A survey's chord: its channels' real frequencies slowed into hearing range (see surveys.js).
   *  Built the first time you tune near it; call again with gains once the image's colors are known. */
  surveyVoice(key, hz, gains) {
    if (!this.ready) return;
    const id = `survey:${key}`;
    let v = this.voices[id];
    if (!v) {
      const out = this._voiceOut(id);
      v = this.voices[id];
      v.level = 0.2;
      const shimmer = this.ctx.createGain();
      shimmer.gain.value = 0.85;
      shimmer.connect(out);
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.13 + Math.random() * 0.12;
      const depth = this.ctx.createGain();
      depth.gain.value = 0.15;
      lfo.connect(depth).connect(shimmer.gain);
      lfo.start();
      v.tones = hz.map((f) => {
        const g = this.ctx.createGain();
        g.gain.value = 1 / hz.length;
        g.connect(shimmer);
        const a = this.ctx.createOscillator();
        a.frequency.value = f;
        a.connect(g);
        a.start();
        const b = this.ctx.createOscillator(); // a slightly detuned twin, for a little width
        b.frequency.value = f * 1.0034;
        const bg = this.ctx.createGain();
        bg.gain.value = 0.35;
        b.connect(bg).connect(g);
        b.start();
        return g;
      });
    }
    if (gains && !v.gainsSet) {
      v.gainsSet = true;
      const t = this.ctx.currentTime;
      v.tones.forEach((g, i) => g.gain.setTargetAtTime((gains[i] ?? 1) * (1.6 / hz.length), t, 0.3));
    }
  }

  _bufferVoice(id, buffer, via) {
    const out = this._voiceOut(id);
    const src = this._loop(buffer, Math.random() * buffer.duration);
    if (via) { src.connect(via); via.connect(out); } else src.connect(out);
    this.voices[id].src = src;
  }

  /** Real recordings, if you add them: list them in audio/recordings.json (see audio/README.md). */
  async _tryRecordings() {
    let list = {};
    try {
      const r = await fetch("audio/recordings.json", { cache: "no-cache" });
      if (r.ok) list = await r.json();
    } catch (e) { return; }
    for (const [id, file] of Object.entries(list)) {
      if (!this.voices[id] || !this.voices[id].src || typeof file !== "string") continue;
      try {
        const r = await fetch(`audio/${file}`, { cache: "no-cache" });
        if (!r.ok) continue;
        const buf = await this.ctx.decodeAudioData(await r.arrayBuffer());
        const v = this.voices[id];
        const src = this._loop(buf);
        if (v.src) { v.src.disconnect(); v.src.stop(); }
        src.connect(id === "broadcast" ? this.broadcastComb : v.gain);
        v.src = src;
      } catch (e) { /* none */ }
    }
  }

  setMuted(m) { this.muted = m; this._applyMaster(); }
  setVolume(v) { this.volume = v; this._applyMaster(); }

  /** Radio on or off: while a tape plays, the sky goes quiet. */
  setRadio(on) {
    this.radioOn = on;
    if (!this.ready) return;
    this.radioBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, on ? 0.18 : 0.08);
  }

  _applyMaster() {
    if (!this.ready) return;
    // the radio pauses in a background tab; a tape keeps playing, like a real one would
    const target = this.muted || document.hidden ? 0 : this.volume;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
    this.tapeOut.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.08);
  }

  update(s) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const L = s.loudness;
    const lockAll = Math.min(1, s.lockMax);
    const g = (0.06 + 0.94 * L ** 0.8) * (1 - 0.9 * lockAll) * 0.42;
    this.staticGain.gain.setTargetAtTime(g, t, 0.05);
    // static gets brighter across the radio dial, then stays bright up through the light
    const f = clamp((s.logf - LOG_MIN) / (GSM_MAX - LOG_MIN), 0, 1);
    this.staticLp.frequency.setTargetAtTime(1100 + f * 7500, t, 0.08);
    const speed = clamp(Math.abs(s.velocity) / 1.8, 0, 1);
    this.whooshBp.frequency.setTargetAtTime(220 * 2 ** (f * 4.6), t, 0.03);
    this.whooshGain.gain.setTargetAtTime(speed * 0.32, t, 0.04);
    for (const [id, v] of Object.entries(this.voices)) {
      const lock = s.voices[id] || 0;
      v.gain.gain.setTargetAtTime(lock * v.level, t, 0.07);
    }
    if (this.broadcastComb) this.broadcastComb.gain.setTargetAtTime(s.fmComb ?? 1, t, 0.03);
  }

  // iOS mutes Web Audio when the ring/silent switch is on unless media is playing.
  _unlockIOS() {
    try {
      if (navigator.audioSession) navigator.audioSession.type = "playback"; // Safari 17+
    } catch (e) { /* older browsers */ }
    try {
      const sr = 8000, n = sr / 4;
      const buf = new ArrayBuffer(44 + n * 2);
      const v = new DataView(buf);
      const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
      w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true);
      v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
      const a = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" })));
      a.loop = true;
      a.setAttribute("playsinline", "");
      a.play().catch(() => {});
      this._silent = a;
    } catch (e) { /* not needed elsewhere */ }
  }
}
