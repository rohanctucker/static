// Mechanical sounds for the tape player, synthesized: key clicks, the door, the motor, tape hiss.
// Everything is quiet next to the recordings, and goes to `out` (the tape player's output).

let noiseBuf = null;

function noise(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const n = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/** A filtered noise burst. */
function burst(ctx, out, { at = 0, dur = 0.01, type = "bandpass", f = 2500, q = 1, gain = 0.2 } = {}) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = f;
  filt.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.0015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt).connect(g).connect(out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.02);
}

/** A short damped thump. */
function thock(ctx, out, { at = 0, f = 160, dur = 0.04, gain = 0.2, drop = 0.6 } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * drop, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const foley = {
  keyDown(ctx, out, heavy = false) {
    burst(ctx, out, { dur: 0.012, f: 3200, q: 0.8, gain: heavy ? 0.22 : 0.16 });
    thock(ctx, out, { f: heavy ? 150 : 210, dur: heavy ? 0.06 : 0.035, gain: heavy ? 0.24 : 0.14 });
  },
  keyUp(ctx, out) {
    burst(ctx, out, { dur: 0.008, f: 4200, q: 1.2, gain: 0.08 });
  },
  button(ctx, out) {
    burst(ctx, out, { dur: 0.007, f: 5200, q: 1.5, gain: 0.09 });
    thock(ctx, out, { f: 320, dur: 0.02, gain: 0.05 });
  },
  switchSlide(ctx, out) {
    burst(ctx, out, { dur: 0.05, type: "bandpass", f: 1800, q: 0.7, gain: 0.05 });
    burst(ctx, out, { at: 0.045, dur: 0.01, f: 3800, q: 1, gain: 0.12 });
  },
  doorOpen(ctx, out) {
    burst(ctx, out, { dur: 0.01, f: 3000, q: 1, gain: 0.18 });
    // the spring: a quick, falling rattle
    for (let k = 0; k < 4; k++) burst(ctx, out, { at: 0.02 + k * 0.022, dur: 0.018, f: 1400 - k * 220, q: 4, gain: 0.05 / (k + 1) });
    thock(ctx, out, { at: 0.03, f: 120, dur: 0.07, gain: 0.08 });
  },
  doorClose(ctx, out) {
    burst(ctx, out, { dur: 0.012, f: 2600, q: 0.9, gain: 0.2 });
    thock(ctx, out, { f: 130, dur: 0.06, gain: 0.22, drop: 0.7 });
    burst(ctx, out, { at: 0.018, dur: 0.01, f: 4300, q: 1.4, gain: 0.12 });
  },
  seat(ctx, out) {
    burst(ctx, out, { dur: 0.01, f: 1500, q: 2, gain: 0.1 });
    thock(ctx, out, { f: 260, dur: 0.025, gain: 0.06 });
  },
  clunk(ctx, out) {
    thock(ctx, out, { f: 95, dur: 0.09, gain: 0.26, drop: 0.75 });
    burst(ctx, out, { dur: 0.015, f: 2200, q: 0.8, gain: 0.14 });
  },

  /** Leader hiss: the blank tape before the recording starts. */
  hiss(ctx, out, seconds = 0.45, gain = 0.035) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2500;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 9000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.04);
    g.gain.setValueAtTime(gain, t + seconds * 0.7);
    g.gain.linearRampToValueAtTime(0, t + seconds);
    src.connect(hp).connect(lp).connect(g).connect(out);
    src.loop = true;
    src.start(t, Math.random());
    src.stop(t + seconds + 0.05);
    return {
      stop() {
        const now = ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(0, now, 0.03);
        try { src.stop(now + 0.2); } catch (e) { /* already stopped */ }
      },
    };
  },

  /** The capstan motor. `level`: 0 off, 1 playing, 3 winding. Returns a handle to change it. */
  motor(ctx, out) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 70;
    const wob = ctx.createOscillator();
    wob.frequency.value = 7.3;
    const wobG = ctx.createGain();
    wobG.gain.value = 2.5;
    wob.connect(wobG).connect(o.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1600;
    bp.Q.value = 0.9;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(lp).connect(g);
    src.connect(bp).connect(ng).connect(g);
    g.connect(out);
    o.start(t);
    wob.start(t);
    src.start(t);
    let stopped = false;
    return {
      set(level) {
        if (stopped) return;
        const now = ctx.currentTime;
        const wind = level > 1.5;
        g.gain.setTargetAtTime(level === 0 ? 0 : wind ? 0.03 : 0.0045, now, level === 0 ? 0.05 : 0.08);
        o.frequency.setTargetAtTime(wind ? 190 : 70, now, 0.12);
        bp.frequency.setTargetAtTime(wind ? 3200 : 1600, now, 0.12);
        lp.frequency.setTargetAtTime(wind ? 1100 : 420, now, 0.12);
      },
      stop() {
        if (stopped) return;
        stopped = true;
        const now = ctx.currentTime;
        g.gain.setTargetAtTime(0, now, 0.04);
        for (const n of [o, wob, src]) n.stop(now + 0.3);
      },
    };
  },
};
