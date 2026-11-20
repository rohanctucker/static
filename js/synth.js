// Procedural sound for each station, rendered once into looping buffers.

const TAU = Math.PI * 2;

function loopFade(data, sr, ms = 40) {
  // equal-power crossfade of the tail into the head so the loop point doesn't click
  const f = Math.min(Math.floor((sr * ms) / 1000), Math.floor(data.length / 4));
  const n = data.length - f;
  const out = new Float32Array(n);
  out.set(data.subarray(0, n));
  for (let i = 0; i < f; i++) {
    const t = i / f;
    out[i] = data[i] * Math.sqrt(t) + data[n + i] * Math.sqrt(1 - t);
  }
  return out;
}

function normalize(d, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m;
  return d;
}

function toBuffer(ctx, channels) {
  const buf = ctx.createBuffer(channels.length, channels[0].length, ctx.sampleRate);
  channels.forEach((c, i) => buf.copyToChannel ? buf.copyToChannel(c, i) : buf.getChannelData(i).set(c));
  return buf;
}

export function pinkNoise(ctx, seconds = 6) {
  const sr = ctx.sampleRate;
  const chans = [0, 1].map(() => {
    const n = Math.floor(sr * seconds) + Math.floor(sr * 0.04);
    const d = new Float32Array(n);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
    }
    return loopFade(d, sr);
  });
  return toBuffer(ctx, chans);
}

export function whiteNoise(ctx, seconds = 6) {
  const sr = ctx.sampleRate;
  const chans = [0, 1].map(() => {
    const d = new Float32Array(Math.floor(sr * seconds) + Math.floor(sr * 0.04));
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    return loopFade(d, sr);
  });
  return toBuffer(ctx, chans);
}

/** Jupiter: L-bursts (slow swells of band-limited noise) and S-bursts (rapid clicks). */
export function jupiter(ctx, seconds = 26) {
  const sr = ctx.sampleRate, n = Math.floor(sr * seconds);
  const d = new Float32Array(n + Math.floor(sr * 0.05));
  let t = 0.2;
  while (t < seconds) {
    const dur = 0.5 + Math.random() * 2.4;
    const amp = 0.3 + Math.random() * 0.7;
    const fc = 450 + Math.random() * 1400;
    const fl = 0.8 + Math.random() * 3;
    const a = Math.exp((-TAU * fc) / sr), h = Math.exp((-TAU * fc * 0.45) / sr);
    let lp = 0, hpIn = 0, hpOut = 0;
    const i0 = Math.floor(t * sr), i1 = Math.min(d.length, Math.floor((t + dur) * sr));
    for (let i = i0; i < i1; i++) {
      const x = (i - i0) / (i1 - i0);
      const w = Math.random() * 2 - 1;
      lp = lp * a + w * (1 - a);
      hpOut = h * (hpOut + lp - hpIn);
      hpIn = lp;
      const env = Math.sin(Math.PI * x) ** 1.6 * (0.75 + 0.25 * Math.sin(TAU * fl * (i - i0) / sr));
      d[i] += hpOut * env * amp * 3.2;
    }
    t += dur * (0.45 + Math.random() * 0.5) + Math.random() * 0.9;
  }
  // S-bursts
  t = 0.8;
  while (t < seconds - 0.6) {
    const len = 0.06 + Math.random() * 0.45;
    const rate = 40 + Math.random() * 150;
    for (let c = t; c < t + len; c += (1 / rate) * (0.5 + Math.random())) {
      const f = 900 + Math.random() * 1600, dec = 0.0018 + Math.random() * 0.002;
      const amp = 0.25 + Math.random() * 0.75, ph = Math.random() * TAU;
      const i0 = Math.floor(c * sr), m = Math.floor(dec * 6 * sr);
      for (let k = 0; k < m && i0 + k < d.length; k++) {
        const tt = k / sr;
        d[i0 + k] += Math.sin(TAU * f * tt + ph) * Math.exp(-tt / dec) * amp * 0.55;
      }
    }
    t += len + 0.4 + Math.random() * 2.2;
  }
  for (let i = 0; i < d.length; i++) d[i] += (Math.random() * 2 - 1) * 0.02;
  const out = loopFade(normalize(d), sr, 50);
  return toBuffer(ctx, [out, out]);
}

/** CP 1919: one pulse every 1.3373 s, with a weaker trailing subpulse. */
export function pulsar(ctx, period = 1.3373, count = 6) {
  const sr = ctx.sampleRate, n = Math.round(period * count * sr);
  const d = new Float32Array(n);
  for (let k = 0; k < count; k++) {
    for (const [off, amp] of [[0, 1], [0.022 + 0.004 * Math.sin(k), 0.45]]) {
      const i0 = Math.round((k * period + off) * sr);
      const m = Math.round(0.16 * sr);
      let lp = 0;
      for (let j = 0; j < m; j++) {
        const i = (i0 + j) % n, tt = j / sr;
        const thump = Math.sin(TAU * 62 * tt) * Math.exp(-tt / 0.045);
        const w = Math.random() * 2 - 1;
        lp = lp * 0.82 + w * 0.18;
        const click = lp * Math.exp(-tt / 0.012) * 2.2;
        d[i] += (thump * 0.9 + click) * amp;
      }
    }
  }
  return toBuffer(ctx, [normalize(d, 0.85), normalize(d.slice(), 0.85)]);
}

/** A muffled radio band: talk-like formants over a soft music bed. Purely synthetic. */
export function broadcast(ctx, seconds = 18) {
  const sr = ctx.sampleRate, n = Math.floor(sr * seconds) + Math.floor(sr * 0.05);
  const d = new Float32Array(n);
  // music bed: A, F#m, D, E
  const chords = [[220, 277.18, 329.63], [185, 220, 277.18], [146.83, 220, 293.66], [164.81, 207.65, 246.94]];
  const chordLen = 2.25;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const ci = Math.floor(t / chordLen) % 4;
    const local = (t % chordLen) / chordLen;
    const env = Math.min(1, local * 8) * (1 - 0.35 * local);
    let s = 0;
    for (const f of chords[ci]) s += Math.sin(TAU * f * t) + 0.18 * Math.sin(TAU * 3 * f * t) + 0.08 * Math.sin(TAU * 5 * f * t);
    s += 0.8 * Math.sin(TAU * (chords[ci][0] / 2) * t) * (0.6 + 0.4 * Math.sin(TAU * 2 * t));
    d[i] = s * env * 0.07;
  }
  // talk-like formant bursts
  const vowels = [[730, 1090, 2440], [270, 2290, 3010], [300, 870, 2240], [530, 1840, 2480], [570, 840, 2410]];
  let t = 0.3;
  const bq = () => ({ x1: 0, x2: 0, y1: 0, y2: 0 });
  const st = [bq(), bq(), bq()];
  while (t < seconds - 0.5) {
    const phrase = 0.8 + Math.random() * 2.2;
    const base = 105 + Math.random() * 90;
    let s = t;
    while (s < t + phrase) {
      const syl = 0.11 + Math.random() * 0.15;
      const v = vowels[Math.floor(Math.random() * vowels.length)];
      const i0 = Math.floor(s * sr), i1 = Math.min(n, Math.floor((s + syl) * sr));
      let phase = 0;
      for (let i = i0; i < i1; i++) {
        const x = (i - i0) / (i1 - i0);
        const f0 = base * (1 + 0.12 * Math.sin(TAU * 0.9 * (i / sr)) - 0.08 * ((s - t) / phrase));
        phase += f0 / sr;
        const src = 2 * (phase % 1) - 1;
        let out = 0;
        for (let k = 0; k < 3; k++) {
          const w0 = (TAU * v[k]) / sr, Q = 7 + k * 3, al = Math.sin(w0) / (2 * Q);
          const a0 = 1 + al, b0 = al / a0, b2 = -al / a0, a1 = (-2 * Math.cos(w0)) / a0, a2 = (1 - al) / a0;
          const z = st[k];
          const y = b0 * src + b2 * z.x2 - a1 * z.y1 - a2 * z.y2;
          z.x2 = z.x1; z.x1 = src; z.y2 = z.y1; z.y1 = y;
          out += y * [1, 0.6, 0.3][k];
        }
        const env = Math.min(1, x * 9) * Math.min(1, (1 - x) * 5);
        d[i] += out * env * 0.32;
      }
      s += syl + (Math.random() < 0.2 ? 0.08 : 0.015);
    }
    t += phrase + 0.25 + Math.random() * 0.9;
  }
  // radio colouring: band-limit and gently compress
  let hpIn = 0, hpOut = 0, lp1 = 0, lp2 = 0;
  const ah = Math.exp((-TAU * 280) / sr), al = Math.exp((-TAU * 3200) / sr);
  for (let i = 0; i < n; i++) {
    hpOut = ah * (hpOut + d[i] - hpIn);
    hpIn = d[i];
    lp1 = lp1 * al + hpOut * (1 - al);
    lp2 = lp2 * al + lp1 * (1 - al);
    d[i] = Math.tanh(lp2 * 2.2);
  }
  const out = loopFade(normalize(d, 0.8), sr, 50);
  return toBuffer(ctx, [out, out]);
}

/** GPS L1 C/A code for satellite PRN 1 (G2 taps 2 and 6), as chips. */
export function gpsChips(prnTaps = [2, 6]) {
  const g1 = new Array(11).fill(1), g2 = new Array(11).fill(1);
  const chips = new Int8Array(1023);
  for (let i = 0; i < 1023; i++) {
    const out1 = g1[10];
    const out2 = g2[prnTaps[0]] ^ g2[prnTaps[1]];
    chips[i] = out1 ^ out2;
    const f1 = g1[3] ^ g1[10];
    const f2 = g2[2] ^ g2[3] ^ g2[6] ^ g2[8] ^ g2[9] ^ g2[10];
    for (let k = 10; k > 1; k--) { g1[k] = g1[k - 1]; g2[k] = g2[k - 1]; }
    g1[1] = f1;
    g2[1] = f2;
  }
  return chips;
}

export function gps(ctx, slow = 512, repeats = 8) {
  const sr = ctx.sampleRate;
  const chips = gpsChips();
  const period = 1e-3 * slow; // 1 ms code period, slowed
  const n = Math.round(period * repeats * sr);
  const d = new Float32Array(n);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = (i / sr) % period;
    const c = chips[Math.min(1022, Math.floor((t / period) * 1023))] ? 1 : -1;
    lp = lp * 0.55 + c * 0.45;
    lp2 = lp2 * 0.55 + lp * 0.45;
    d[i] = lp2;
  }
  normalize(d, 0.7);
  return toBuffer(ctx, [d, d]);
}

export function dust(ctx, seconds = 16) {
  const sr = ctx.sampleRate, n = Math.floor(sr * seconds) + Math.floor(sr * 0.05);
  const chans = [0, 1].map((ch) => {
    const d = new Float32Array(n);
    let lp = 0, hpIn = 0, hpOut = 0;
    const a = Math.exp((-TAU * 5200) / sr), h = Math.exp((-TAU * 1800) / sr);
    const ph = [Math.random(), Math.random(), Math.random()].map((x) => x * TAU);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const w = Math.random() * 2 - 1;
      lp = lp * a + w * (1 - a);
      hpOut = h * (hpOut + lp - hpIn);
      hpIn = lp;
      const gust = 0.45 + 0.3 * Math.sin((TAU * t) / seconds + ph[0] + ch) + 0.2 * Math.sin((TAU * 3 * t) / seconds + ph[1]) + 0.1 * Math.sin((TAU * 7 * t) / seconds + ph[2]);
      d[i] = hpOut * gust * 2.4;
    }
    return loopFade(normalize(d, 0.7), sr, 50);
  });
  return toBuffer(ctx, chans);
}

/** Smooth random control signal (0..1) for maser flicker; integer cycles so it loops. */
export function flicker(ctx, seconds = 12) {
  const sr = ctx.sampleRate, n = Math.floor(sr * seconds);
  const d = new Float32Array(n);
  const parts = Array.from({ length: 9 }, () => ({ k: 2 + Math.floor(Math.random() * 40), ph: Math.random() * TAU, a: Math.random() }));
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    for (const p of parts) s += p.a * Math.sin((TAU * p.k * t) / seconds + p.ph);
    d[i] = s;
  }
  let mn = Infinity, mx = -Infinity;
  for (const v of d) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  for (let i = 0; i < n; i++) d[i] = ((d[i] - mn) / (mx - mn)) ** 1.6;
  return toBuffer(ctx, [d]);
}
