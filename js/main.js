// Static: tune the real sky.

import { SkyData } from "./data.js";
import { SkyRenderer, paletteAt, SPECIAL_PALETTES, flat, cssGradient } from "./sky.js";
import { Dial } from "./dial.js";
import { Player } from "./player.js";
import { Shelf } from "./shelf.js";
import { TAPES, SOURCE_PAGE } from "./tapes.js";
import { skyPosition, mollweideXY, lightTimeText } from "./ephem.js";
import { AudioEngine, loudness } from "./audio.js";
import { STATIONS, SEEKABLE, lockAt, regionAt } from "./stations.js";
import { SurveyBank, surveyTones } from "./surveys.js";
import { humanBandAt, silentBandAt, IONOSPHERE_MHZ } from "./bands.js";
import { freqParts, freqText, wavelengthText, energyText, tempText, LOG_MIN, LOG_MAX, GSM_MAX, clamp, smoothstep } from "./format.js";
import { serialSupported, connectKnob } from "./serial.js";

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wide = matchMedia("(min-width: 1100px)");
const START = Math.log10(98.7);
// the player's BAND button steps through the spectrum, landing somewhere worth hearing in each
const BAND_HOMES = [
  ["RADIO", 1, Math.log10(98.7)], ["MICROWAVE", 3.48, Math.log10(160200)], ["INFRARED", 5.48, "iras"],
  ["VISIBLE", 8.6, "gaia"], ["ULTRAVIOLET", 8.9, "galex"], ["X-RAY", 10.48, "integral"], ["GAMMA", 13.38, "fermi"],
];

const state = {
  x: START,
  v: 0,
  vMeasured: 0,
  target: null,
  seekRate: 6,
  dragging: false,
  lastInput: 0,
  wheelIdle: 0,
  powered: false,
  hint: "",
  special: 0,
  specialKey: null,
  cardKey: "",
  cardKind: "",
  pendingKey: null,
  pendingSince: 0,
  cardSeen: false,
  knobOwned: false,
  pointer: null,
  tipUntil: 0,
};

let data, sky, dial, audio, bank, player, shelf;
const SURVEY_STATIONS = STATIONS.filter((s) => s.survey); // in dial order
let last = performance.now();

boot();

async function boot() {
  const fromHash = parseHash();
  if (fromHash) state.x = clamp(Math.log10(fromHash), LOG_MIN, LOG_MAX);

  try {
    sky = new SkyRenderer($("sky"));
  } catch (e) {
    console.error(e);
    return fatal("Your browser can't draw the sky: WebGL is turned off or unsupported. Try a recent Chrome, Edge, Firefox or Safari.");
  }
  data = new SkyData("data/");
  try {
    await data.init();
  } catch (e) {
    console.error(e);
    return fatal(location.protocol === "file:"
      ? "Open this through a local web server, not as a file. In this folder, run: python3 -m http.server 8000, then visit localhost:8000."
      : "The sky maps didn't load. Check that the data folder was uploaded with the site, then reload.");
  }

  // real survey images for the light half of the dial, fetched as you tune toward them
  bank = new SurveyBank(innerWidth < 800 ? { outW: 1024, outH: 512 } : {});
  await bank.init();
  bank.onChange = (key) => {
    if (state.cardKey === key) fillStation(STATIONS.find((s) => s.id === key));
    lastLegendKey = "";
  };

  await Promise.race([document.fonts.ready, new Promise((ok) => setTimeout(ok, 1500))]);

  dial = new Dial($("dial"), $("overview"), {
    onGrab: () => { toRadio(); state.dragging = true; state.target = null; state.v = 0; markInput(); },
    onTune: (d, o) => { toRadio(); tuneBy(d); if (o && o.wheel) state.wheelIdle = performance.now(); },
    onFling: (v) => { state.dragging = false; state.v = clamp(v, -6, 6); if (Math.abs(v) < 0.05) detent(); },
    onSeek: (x, o) => { toRadio(); seekTo(x, o && o.fast ? 14 : 7); },
    onJump: (x) => { toRadio(); state.target = null; state.v = 0; state.x = x; markInput(); },
    onStation: (s) => { toRadio(); seekTo(stationAt(s), 6); },
  });
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", () => dial.resize());

  audio = new AudioEngine();

  // the tape deck: a shelf of real recordings, and a player whose radio tunes the sky
  shelf = new Shelf($("shelf"), { onPick: (t) => pickTape(t) });
  player = new Player($("player"), {
    flightLayer: $("flight"),
    spineRect: (id) => shelf.rect(id),
    onSpine: (id, out) => shelf.setOut(id, out),
    onMode: modeChanged,
    onTape: tapeChanged,
    onPlayState: () => { lastText.signal = null; },
    onTune: (d) => { state.knobOwned = true; tuneBy(d); },
    onTuneEnd: () => detent(),
    onSeek: (dir) => { toRadio(); seekStation(dir); },
    onBand: nextBand,
    onNeedTape: () => {
      shelf.nudge();
      if (!wide.matches) $("shelf").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
    },
    onLoadError: () => { state.cardKey = ""; },
    announce: (msg) => { $("announce").textContent = msg; },
  });
  loadTapeFiles();

  wireUi();
  layout();
  addEventListener("resize", layout);
  wide.addEventListener("change", layout);
  addEventListener("hashchange", () => {
    writtenHash = location.hash;
    const tape = tapeFromHash();
    if (tape) { if (state.powered) pickTape(tape.t, tape.side); return; }
    const f = parseHash();
    if (f) { toRadio(); seekTo(Math.log10(f), 7); }
  });

  data.onProgress = (n, total) => { state.radioLoaded = n; state.radioTotal = total; };
  data.stream(() => state.x);
  requestAnimationFrame(frame);
}

// ----------------------------------------------------------------------------- tuning
function markInput() {
  state.lastInput = performance.now();
  if (state.hint) state.hint = "";
}

function tuneBy(d) {
  markInput();
  state.target = null;
  state.x = clamp(state.x + d, LOG_MIN, LOG_MAX);
}

function seekTo(x, rate = 7) {
  markInput();
  state.v = 0;
  state.target = clamp(x, LOG_MIN, LOG_MAX);
  state.seekRate = reduceMotion ? 40 : rate;
}

function stationAt(s) {
  const e = SEEKABLE.find((it) => it.s === s);
  return e ? e.at : s.logf;
}

function seekStation(dir) {
  const x = state.target ?? state.x;
  const list = SEEKABLE.map((e) => e.at);
  const next = dir > 0 ? list.find((a) => a > x + 0.0015) : [...list].reverse().find((a) => a < x - 0.0015);
  if (next !== undefined) seekTo(next, 4.5);
}

/** Settle onto a nearby station, like the detent on a real dial. */
function detent() {
  let best = null, bestD = Infinity;
  for (const s of STATIONS) {
    if (s.kind !== "point") continue;
    const d = Math.abs(state.x - s.logf);
    if (d < s.capture * 1.7 && d > s.capture * 0.08 && d < bestD) { best = s; bestD = d; }
  }
  if (best) seekTo(best.logf, 9);
}

// ----------------------------------------------------------------------------- the loop
let lastLegendKey = "", lastLockCss = -1, lastHash = 0, legendPalKey = "", lastWant = 0;
let writtenHash = location.hash; // the last hash this page wrote (or was opened with)
const lastText = {};

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000) || 0.016;
  last = now;
  const prevX = state.x;

  if (state.target !== null) {
    const d = state.target - state.x;
    state.x += d * (1 - Math.exp(-dt * state.seekRate));
    if (Math.abs(d) < 0.00006) { state.x = state.target; state.target = null; }
  } else if (!state.dragging && Math.abs(state.v) > 0.001) {
    state.x += state.v * dt;
    state.v *= Math.exp(-dt / 0.3);
    if (Math.abs(state.v) < 0.03) { state.v = 0; detent(); }
  }
  if (state.wheelIdle && now - state.wheelIdle > 260) { state.wheelIdle = 0; detent(); }
  if (state.x <= LOG_MIN || state.x >= LOG_MAX) state.v = 0;
  state.x = clamp(state.x, LOG_MIN, LOG_MAX);
  const x = state.x;
  const fMHz = 10 ** x;
  state.vMeasured += ((x - prevX) / dt - state.vMeasured) * 0.25;

  // the player's tuning wheel turns along with any tuning it didn't cause itself
  if (x !== prevX && !state.knobOwned) player.follow(x - prevX);
  state.knobOwned = false;

  // stations
  const locks = new Map();
  let lockMax = 0, best = null, bestScore = 0;
  for (const s of STATIONS) {
    const l = lockAt(s, x);
    locks.set(s.id, l);
    if (s.voice) lockMax = Math.max(lockMax, l);
    const score = l > 0.5 ? l + s.priority : 0;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  const bestLock = best ? locks.get(best.id) : 0;

  // frames
  const { i0, i1, t } = data.bracket(x);
  bindFrame(0, i0);
  bindFrame(1, i1);

  // special map (hydrogen survey, CMB)
  const spStation = best && best.special && data.special[best.special] && data.special[best.special].bitmap ? best : null;
  if (spStation && spStation.special !== state.specialKey) {
    sky.set(2, data.special[spStation.special].bitmap, `s:${spStation.special}`);
    state.specialKey = spStation.special;
  }
  const spTarget = spStation ? smoothstep(0.45, 1, bestLock) : 0;
  state.special += (spTarget - state.special) * (1 - Math.exp(-dt * 7));
  const spInfo = state.specialKey ? data.special[state.specialKey] : null;
  const showSpecial = state.special > 0.5 && spInfo;

  // real survey images past 5 THz
  const ph = photoLayer(x);
  const inLight = x > GSM_MAX;
  if (now - lastWant > 400) { lastWant = now; wantSurveys(state.target ?? x); }

  // sky
  const tSky = data.skyTemp(Math.min(x, GSM_MAX));
  const L = inLight ? 0.2 + 0.4 * ph.snow : loudness(tSky);
  const palette = paletteAt(Math.min(x, GSM_MAX));
  const jitter = clamp(Math.abs(state.vMeasured) / 2.4, 0, 1) * (reduceMotion ? 0.2 : 1);
  sky.draw({
    mix: t,
    special: state.special,
    specialMode: spInfo && spInfo.mode === "diverging" ? 1 : 0,
    specialPalette: flat(SPECIAL_PALETTES[state.specialKey] || SPECIAL_PALETTES.hi),
    exposure: 0.62 + 0.38 * L,
    grain: (reduceMotion ? 0.035 : 0.09) * (0.35 + 0.65 * L) * (1 - 0.75 * lockMax) + jitter * 0.04,
    time: reduceMotion ? 0 : now / 1000,
    jitter,
    grid: state.pointer ? 0.09 : 0.05,
    gamma: 0.92,
    palette,
    gsm: ph.gsm,
    wA: ph.wA,
    wB: ph.wB,
    tintA: ph.tintA,
    tintB: ph.tintB,
    snow: reduceMotion ? ph.snow * 0.5 : ph.snow,
    halo: ph.halo,
  });

  // dial
  dial.set(x, locks, state.hint);
  dial.draw();

  // readout
  const fp = freqParts(fMHz);
  setText("freqValue", fp.value);
  setText("freqUnit", fp.unit);
  setText("wave", wavelengthText(fMHz));
  if (inLight) {
    // no sky temperature up here; the energy of each photon says more
    setText("tskyLabel", "Photon energy");
    setText("tsky", energyText(fMHz));
    setStyle("meter", "visibility", "hidden");
  } else {
    setText("tskyLabel", "Sky temperature");
    setText("tsky", tempText(tSky));
    setStyle("meter", "visibility", "visible");
    setStyle("meterFill", "width", `${(L * 100).toFixed(1)}%`);
  }
  setText("loading", loadingText(ph));
  setText("context", contextText(fMHz));
  const radioOn = player.mode === "radio";
  player.tick(dt, {
    value: fp.value, unit: fp.unit, band: bandAt(x)[0], wave: wavelengthText(fMHz),
    station: best && bestLock > 0.5 ? (best.dial || best.title).toUpperCase() : "",
    lock: best && (best.voice || best.landmark) ? bestLock : 0,
  });
  const signal = radioOn && !!best && !!(best.voice || best.landmark) && bestLock > 0.6;
  if (lastText.signal !== signal) { lastText.signal = signal; $("signal").classList.toggle("on", signal); }
  const aria = `${freqText(fMHz)}${best && bestLock > 0.5 ? `, ${best.title}` : ""}`;
  if (lastText.aria !== aria) {
    lastText.aria = aria;
    const d = $("dial");
    d.setAttribute("aria-valuenow", fMHz.toFixed(3));
    d.setAttribute("aria-valuetext", aria);
    player.setWheelText(aria);
  }

  // legend
  const kNear = t < 0.5 ? i0 : i1;
  const legendKey = showSpecial ? `s:${state.specialKey}` : ph.gsm > 0.5 ? `f:${kNear}`
    : ph.dominant && ph.domW > 0.3 && bank.get(ph.dominant.id).state === "ready" ? `v:${ph.dominant.id}` : "none";
  if (legendKey !== lastLegendKey) { lastLegendKey = legendKey; legendPalKey = ""; updateLegend(legendKey, spInfo); }
  if (legendKey.startsWith("f:") || legendKey.startsWith("s:")) {
    const palKey = showSpecial ? `s:${state.specialKey}` : x.toFixed(2);
    if (palKey !== legendPalKey) {
      legendPalKey = palKey;
      $("legendBar").style.background = cssGradient(showSpecial ? flat(SPECIAL_PALETTES[state.specialKey]) : palette);
    }
  }

  // liner notes
  updateCard(best, bestLock, now);

  // hover readout
  updateTip(i0, i1, t, showSpecial, ph.gsm > 0.5, now);

  // sound
  if (audio && state.powered) {
    const voices = {};
    for (const s of STATIONS) if (s.voice) voices[s.voice] = Math.max(voices[s.voice] || 0, locks.get(s.id));
    for (const s of SURVEY_STATIONS) {
      if (locks.get(s.id) < 0.01) continue;
      const it = bank.get(s.id);
      const tones = surveyTones(s.survey);
      const tuned = it.state === "ready" && !s.survey.equalTones && tones.hz.length > 1;
      audio.surveyVoice(s.id, tones.hz, tuned ? channelGains(it.means) : null);
    }
    const pointLock = Math.max(locks.get("hydrogen"), locks.get("gps"));
    voices.waterhole = (voices.waterhole || 0) * (1 - 0.75 * pointLock);
    let fmComb = 1;
    if (fMHz >= 87.9 && fMHz <= 108.1) {
      // stations sit on the odd tenths (88.1, 88.3 ...): fine-tune between them and they fade
      const frac = ((((fMHz - 88.1) / 0.2) % 1) + 1) % 1;
      const dch = Math.min(frac, 1 - frac);
      fmComb = 0.3 + 0.7 * (1 - smoothstep(0.06, 0.32, dch));
    }
    audio.update({ loudness: L, lockMax, voices, logf: x, velocity: state.vMeasured, fmComb });
  }

  // address bar, once you've settled
  if (now - lastHash > 500 && Math.abs(state.vMeasured) < 0.01 && state.target === null && state.powered && radioOn) {
    lastHash = now;
    const h = `#f=${fMHz < 10000 ? fMHz.toFixed(3) : fMHz < 1e6 ? fMHz.toFixed(1) : fMHz.toExponential(4).replace("+", "")}`;
    // don't overwrite a hash someone just typed: the hashchange handler gets it first
    if (location.hash === writtenHash && h !== writtenHash) {
      history.replaceState(null, "", h);
      writtenHash = h;
    }
  }

  requestAnimationFrame(frame);
}

/** Put frame k into texture slot `slot`, uploading only when something better is available. */
function bindFrame(slot, k) {
  const f = data.frames[k];
  const want = f.bitmap ? `h${k}` : `l${k}`;
  if (sky.keys[slot] === want && (f.bitmap || !f.blob || f.decoding)) return;
  const src = data.source(k); // the preview canvas is shared: upload it right away
  sky.set(slot, src.img, src.key);
}

function setText(id, v) {
  if (lastText[id] === v) return;
  lastText[id] = v;
  $(id).textContent = v;
}

function setStyle(id, prop, v) {
  const key = `${id}.${prop}`;
  if (lastText[key] === v) return;
  lastText[key] = v;
  $(id).style[prop] = v;
}

function contextText(fMHz) {
  if (silentBandAt(fMHz)) return "Silent band: no transmitters allowed";
  const hb = humanBandAt(fMHz);
  if (hb) return hb.name;
  if (fMHz < IONOSPHERE_MHZ) return "Hidden from the ground";
  if (fMHz >= 3e6) return "No everyday use";
  if (fMHz > 275000) return "Mostly unallocated";
  return "Other services";
}

// ----------------------------------------------------------------------------- survey images
/** Which survey images to show at x, how strongly, and how much snow fills the gaps. */
function photoLayer(x) {
  const out = { gsm: 1, wA: 0, wB: 0, snow: 0, tintA: null, tintB: null, halo: null, dominant: null, domW: 0 };
  if (x < GSM_MAX - 0.45) return out;
  const idx = SURVEY_STATIONS.findIndex((s) => s.logf > x);
  const pair = idx === -1 ? [SURVEY_STATIONS.length - 1] : idx === 0 ? [0] : [idx - 1, idx];
  const near = pair.map((i) => {
    const s = SURVEY_STATIONS[i];
    return { i, s, w: 1 - smoothstep(0.03, s.survey.reach, Math.abs(x - s.logf)) };
  });
  const sum = near.reduce((a, e) => a + e.w, 0);
  if (sum > 1) near.forEach((e) => { e.w /= sum; });
  let total = 0;
  const halo = [0, 0, 0];
  for (const e of near) {
    const it = bank.get(e.s.id);
    const ready = it.state === "ready";
    const w = ready ? e.w : 0;
    // neighbours on the dial always use different slots, so nothing is uploaded twice
    const slot = e.i % 2 === 0 ? 3 : 4;
    if (w > 0.001) sky.set(slot, it.bitmap, `p:${e.s.id}`);
    const tint = e.s.survey.tint ? new Float32Array([...e.s.survey.tint, 1]) : null;
    if (slot === 3) { out.wA = w; out.tintA = tint; } else { out.wB = w; out.tintB = tint; }
    total += w;
    if (ready) {
      const m = it.means, lum = (m[0] + m[1] + m[2]) / 3;
      const c = e.s.survey.tint ? e.s.survey.tint.map((v) => v * lum) : m;
      for (let k = 0; k < 3; k++) halo[k] += c[k] * w * 0.45;
    }
    if (e.w > out.domW) { out.domW = e.w; out.dominant = e.s; }
  }
  // the radio model fades out at its top end, where the first survey takes over
  out.gsm = Math.max(0, Math.min(1 - smoothstep(GSM_MAX - 0.06, GSM_MAX, x), 1 - total));
  out.snow = smoothstep(GSM_MAX - 0.08, GSM_MAX, x) * clamp(1 - total, 0, 1);
  out.halo = new Float32Array(halo);
  return out;
}

/** Fetch the surveys around x, nearest first. */
function wantSurveys(x) {
  if (x < GSM_MAX - 1.2) return;
  const near = SURVEY_STATIONS.map((s) => [s.id, Math.abs(s.logf - x)])
    .filter(([, d]) => d < 1.6).sort((a, b) => a[1] - b[1]).map(([id]) => id);
  if (near.length) bank.want(near);
}

/** Loudness of each note in a survey's chord: how bright that colour is, on average, in the map. */
function channelGains(means) {
  const top = Math.max(...means, 1e-6);
  return means.map((v) => Math.max(0.12, (v / top) ** 0.7));
}

/** The small status line at the top of the sky. */
function loadingText(ph) {
  if (state.radioTotal && state.radioLoaded < state.radioTotal && ph.gsm > 0.5) {
    return `Sharpening the sky: ${state.radioLoaded} of ${state.radioTotal} maps`;
  }
  const s = ph.dominant;
  if (!s || ph.gsm > 0.5) return "";
  const st = bank.get(s.id).state;
  if (st === "loading" || st === "idle") return `Loading ${s.dial}`;
  if (st === "error") return `${s.dial} couldn't load right now`;
  return "";
}

// ----------------------------------------------------------------------------- legend
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
function sci(v) {
  const e = Math.floor(Math.log10(v));
  const m = v / 10 ** e;
  return `${m.toFixed(1)} × 10${String(e).split("").map((c) => SUP[c]).join("")}`;
}
const minus = (s) => s.replace("-", "−");

function updateLegend(key, spInfo) {
  const legend = $("legend"), sw = $("legendSwatches");
  legend.classList.toggle("off", key === "none");
  legend.classList.toggle("swatches", false);
  if (key === "none") return;
  if (key.startsWith("v:")) {
    const sv = STATIONS.find((s) => s.id === key.slice(2)).survey;
    const lg = sv.legend || {};
    sw.textContent = "";
    if (lg.swatches) {
      legend.classList.add("swatches");
      for (const [label, color] of lg.swatches) {
        const item = document.createElement("span");
        const dot = document.createElement("i");
        dot.style.background = color;
        item.append(dot, label);
        sw.appendChild(item);
      }
      $("legendCap").textContent = "What each color shows";
    } else {
      const t = sv.tint;
      $("legendBar").style.background = t
        ? `linear-gradient(90deg, #000, rgb(${t.map((v) => Math.round(v * 200)).join(" ")}), #fff)`
        : "linear-gradient(90deg, #000, #fff)";
      $("legendLo").textContent = "Faint";
      $("legendHi").textContent = "Bright";
      $("legendCap").textContent = lg.caption || sv.title;
      if (!t && lg.caption) { legend.classList.add("swatches"); $("legendCap").textContent = lg.caption; }
    }
    return;
  }
  if (key.startsWith("s:") && spInfo) {
    if (spInfo.mode === "diverging") {
      $("legendLo").textContent = `−${Math.round(Math.abs(spInfo.min))} ${spInfo.unit}`;
      $("legendHi").textContent = `+${Math.round(spInfo.max)} ${spInfo.unit}`;
      $("legendCap").textContent = "Difference from the 2.725 K average";
    } else {
      $("legendLo").textContent = sci(spInfo.min);
      $("legendHi").textContent = sci(spInfo.max);
      $("legendCap").textContent = "Hydrogen atoms per cm², along each line of sight";
    }
    return;
  }
  const k = Number(key.slice(2));
  $("legendLo").textContent = minus(tempText(data.tempOf(k, 0)));
  $("legendHi").textContent = minus(tempText(data.tempOf(k, 1)));
  $("legendCap").textContent = data.relative(k) ? "Brightness temperature above the CMB average" : "Brightness temperature";
}

// ----------------------------------------------------------------------------- liner notes
function updateCard(best, lock, now) {
  if (player.mode === "tape" && player.tape) {
    const key = `tape:${player.tape.id}:${player.side}:${player.loadState === "error" ? "e" : ""}`;
    if (state.cardKey !== key) showTapeCard(key);
    if (lastLockCss !== 1) { lastLockCss = 1; $("card").style.setProperty("--lock", "1"); }
    const pill = !wide.matches && !state.cardSeen;
    if (lastText.pill !== pill) { lastText.pill = pill; $("nowPlaying").hidden = !pill; }
    return;
  }
  let want = null;
  if (best && lock > 0.5) want = { kind: best.kind === "zone" ? "zone" : "station", item: best, key: best.id };
  else {
    const r = regionAt(10 ** state.x);
    if (r) want = { kind: "region", item: r, key: r.title };
  }
  const key = want ? want.key : "";
  if (key !== state.cardKey) {
    if (key !== state.pendingKey) { state.pendingKey = key; state.pendingSince = now; }
    // hold a station a moment after you leave it, and ignore ones you only sweep past
    const delay = !state.cardKey ? 0 : state.cardKind === "station" && (!want || want.kind !== "station") ? 450 : 140;
    if (now - state.pendingSince >= delay && want) showCard(want);
  } else {
    state.pendingKey = null;
  }

  const l = state.cardKind === "station" && best && state.cardKey === best.id ? lock : 0;
  if (Math.abs(l - lastLockCss) > 0.02) {
    lastLockCss = l;
    $("card").style.setProperty("--lock", l.toFixed(3));
  }
  const pill = state.cardKind === "station" && !wide.matches && !state.cardSeen && player.mode === "radio";
  if (lastText.pill !== pill) { lastText.pill = pill; $("nowPlaying").hidden = !pill; }
}

function showCard(w) {
  state.cardKey = w.key;
  state.cardKind = w.kind;
  state.pendingKey = null;
  const card = $("card");
  card.classList.toggle("is-station", w.kind === "station");
  card.classList.remove("is-tape");
  if (w.kind === "region") fillRegion(w.item);
  else fillStation(w.item);
  if (w.kind === "station") {
    $("nowPlayingTitle").textContent = w.item.title;
    $("announce").textContent = `${w.item.title}, ${w.item.freqLabel}`;
  }
  const inner = $("cardInner");
  inner.classList.remove("fresh");
  void inner.offsetWidth; // restart the fade
  inner.classList.add("fresh");
}

function fillRegion(r) {
  $("cardFreq").textContent = r.freqLabel;
  $("cardTitle").textContent = r.title;
  $("cardBody").textContent = r.body;
  setMeta([]);
  setLinks([]);
}

function setMeta(rows) {
  const dl = $("cardMeta");
  dl.textContent = "";
  for (const [k, v] of rows) {
    if (!v) continue;
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = k;
    dd.textContent = v;
    row.append(dt, dd);
    dl.appendChild(row);
  }
  dl.hidden = !dl.children.length;
}

function setLinks(list) {
  const links = $("cardLinks");
  links.textContent = "";
  for (const l of list) {
    const a = document.createElement("a");
    a.href = l.href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = l.label;
    links.appendChild(a);
  }
}

const PLANET = { mars: "Mars", jupiter: "Jupiter" };

/** The tape's J-card: what it is, where and when it was recorded, how far away that was. */
function showTapeCard(key) {
  const t = player.tape, si = player.side, s = t.sides[si];
  state.cardKey = key;
  state.cardKind = "tape";
  state.pendingKey = null;
  const card = $("card");
  card.classList.add("is-station", "is-tape");
  card.style.setProperty("--tape", t.m.spine);
  $("cardFreq").textContent = `${t.cat}, side ${si ? "B" : "A"}${!s ? ": blank" : t.sides.length > 1 ? `: ${s.name}` : ""}`;
  $("cardTitle").textContent = t.title;
  $("cardBody").textContent = t.notes;
  const rows = [["Recorded", `${t.instrument}. ${t.m.place}, ${t.when}.`]];
  if (PLANET[t.body]) {
    const p = skyPosition(t.body, t.ms);
    rows.push(["Distance", `${PLANET[t.body]} was ${Math.round(p.au * 149.6)} million km from Earth that day, ${lightTimeText(p.lightSeconds)} away by radio.`]);
  }
  rows.push(["Sound", s ? s.how : "Nothing on this side but tape hiss. Press A/B to turn the tape back over."]);
  rows.push(["Credit", (s || t.sides[0]).credit]);
  if (player.loadState === "error") rows.push(["Note", "This recording couldn't load from NASA just now. Check your connection and press play again."]);
  setMeta(rows);
  setLinks([{ label: "All of NASA's sounds", href: SOURCE_PAGE }]);
  $("nowPlayingTitle").textContent = t.title;
  const inner = $("cardInner");
  inner.classList.remove("fresh");
  void inner.offsetWidth;
  inner.classList.add("fresh");
}

function fillStation(s) {
  $("cardFreq").textContent = s.freqLabel || freqText(s.f);
  $("cardTitle").textContent = s.title;
  $("cardBody").textContent = s.body;
  let map = "";
  if (s.special === "hi") {
    map = data.special.hi && data.special.hi.bitmap
      ? "Hydrogen gas itself, from the HI4PI 21-cm survey."
      : "The whole sky at 1420 MHz, from GSM2016. Its maps near 1.4 GHz include the glow of this line.";
  } else if (s.special === "cmb" && data.special.cmb) {
    map = `The CMB alone, separated from the galaxy by GSM2016 using Planck data. Colors span ±${Math.round(data.special.cmb.max)} µK around 2.725 K.`;
  } else if (s.id === "ionosphere") {
    map = "The sky as it would look from above the atmosphere, from GSM2016.";
  } else if (s.survey) {
    const st = bank.get(s.id).state;
    map = s.survey.credit + (st === "error" ? " It couldn't load just now: check your connection and tune back in." : "");
  }
  setMeta([["Sound", s.hear || ""], ["Map", map]]);
  setLinks(s.links || []);
}

// ----------------------------------------------------------------------------- hover readout
function updateTip(i0, i1, t, showSpecial, showRadio, now) {
  const tip = $("tip");
  const p = state.pointer;
  if (!p || (p.touch && now > state.tipUntil)) { if (!tip.hidden) tip.hidden = true; return; }
  const r = sky.cssRect();
  const nx = (p.x - r.x) / r.w, ny = (p.y - r.y) / r.h;
  const qx = nx * 2 - 1, qy = 1 - ny * 2;
  if (qx * qx + qy * qy > 1) { if (!tip.hidden) tip.hidden = true; return; }
  const th = Math.asin(qy);
  const lat = Math.asin((2 * th + Math.sin(2 * th)) / Math.PI);
  const lam = (Math.PI * qx) / Math.max(Math.cos(th), 1e-4);
  let l = (-lam * 180) / Math.PI;
  if (l < 0) l += 360;
  const b = (lat * 180) / Math.PI;
  let val = "";
  if (showSpecial) {
    const sv = data.specialValue(state.specialKey, nx, ny);
    if (sv) val = sv.unit === "µK" ? `${sv.value >= 0 ? "+" : "−"}${Math.abs(sv.value).toFixed(0)} µK` : `${sci(sv.value)} atoms/cm²`;
  } else if (showRadio) {
    val = minus(tempText(data.sampleTemp(i0, i1, t, nx, ny)));
  }
  const where = `l ${l.toFixed(0)}°, b ${b >= 0 ? "+" : "−"}${Math.abs(b).toFixed(0)}°`;
  const html = val ? `<b>${val}</b> <span>at ${where}</span>` : `<span>Galactic ${where}</span>`;
  if (tip.innerHTML !== html) tip.innerHTML = html;
  // keep the tip on screen near the right edge
  const flip = p.x > $("skyWrap").clientWidth - 190;
  tip.classList.toggle("flip", flip);
  tip.style.left = `${p.x}px`;
  tip.style.top = `${p.y}px`;
  tip.hidden = false;
}

// ----------------------------------------------------------------------------- layout & UI
function layout() {
  const chrome = $("console").offsetHeight + document.querySelector(".topbar").offsetHeight;
  document.documentElement.style.setProperty("--chrome", `${chrome}px`);
  sky.resize();
  dial.resize();
  const r = sky.cssRect();
  const axis = $("axis");
  axis.style.left = `${r.x}px`;
  axis.style.width = `${r.w}px`;
  axis.style.top = `${r.y + r.h + 2}px`;
  // the legend sits in the empty top-left corner, mostly above the ellipse's shoulder
  const legend = $("legend");
  legend.style.left = innerWidth > 720 ? `${Math.max(0, r.x)}px` : "";
  legend.style.top = innerWidth > 720 ? `${Math.max(2, r.y + 26 - legend.offsetHeight)}px` : "";
  lastLegendKey = ""; // re-measure labels
  positionMarker();
  if (player) player.layout();
}

function wireUi() {
  $("powerBtn").addEventListener("click", powerOn);
  // a fade at the bottom of the notes says there's more to scroll
  const card = $("card");
  const more = () => card.classList.toggle("has-more", card.scrollHeight - card.scrollTop - card.clientHeight > 6);
  card.addEventListener("scroll", more, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(more).observe($("cardInner"));
  $("nowPlaying").addEventListener("click", () => {
    $("card").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  });
  if ("IntersectionObserver" in window) {
    // the pill offers a shortcut only while the notes' title is out of view
    new IntersectionObserver((entries) => {
      for (const e of entries) state.cardSeen = e.intersectionRatio > 0.95;
    }, { threshold: [0, 0.5, 1] }).observe($("cardTitle"));
  }

  const soundBtn = $("soundBtn"), vol = $("volume");
  soundBtn.addEventListener("click", () => {
    const muted = !audio.muted;
    audio.setMuted(muted);
    player.setVolume(audio.volume, muted);
    soundBtn.textContent = muted ? "Sound off" : "Sound on";
    soundBtn.setAttribute("aria-pressed", String(!muted));
  });
  vol.addEventListener("input", () => {
    audio.setVolume(Number(vol.value));
    player.setVolume(audio.volume, audio.muted);
  });

  const about = $("about"), aboutBtn = $("aboutBtn");
  const openAbout = () => {
    $("hiCredit").hidden = !data.special.hi;
    about.hidden = false;
    $("aboutClose").focus();
  };
  const closeAbout = () => { about.hidden = true; aboutBtn.focus(); };
  aboutBtn.addEventListener("click", openAbout);
  $("aboutClose").addEventListener("click", closeAbout);
  about.addEventListener("click", (e) => { if (e.target === about) closeAbout(); });
  about.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = [...about.querySelectorAll("button, a[href]")];
    const first = f[0], lastEl = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { lastEl.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { first.focus(); e.preventDefault(); }
  });

  document.addEventListener("keydown", (e) => {
    if (!about.hidden) { if (e.key === "Escape") closeAbout(); return; }
    if (!state.powered) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest("input, textarea, select, a")) return;
    const step = e.shiftKey ? 0.02 : 0.0015;
    const onControl = e.target.closest && e.target.closest("button, [role=slider], [role=switch]");
    const tuning = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, PageUp: 1, PageDown: 1, Home: 1, End: 1 };
    if (tuning[e.key] && onControl && e.target.id !== "dial") return; // the control handles its own keys
    if (tuning[e.key]) toRadio();
    switch (e.key) {
      case "ArrowLeft": tuneBy(-step); e.preventDefault(); break;
      case "ArrowRight": tuneBy(step); e.preventDefault(); break;
      case "ArrowUp": seekStation(1); e.preventDefault(); break;
      case "ArrowDown": seekStation(-1); e.preventDefault(); break;
      case "PageUp": tuneBy(0.1); e.preventDefault(); break;
      case "PageDown": tuneBy(-0.1); e.preventDefault(); break;
      case "Home": seekTo(LOG_MIN, 4); e.preventDefault(); break;
      case "End": seekTo(LOG_MAX, 4); e.preventDefault(); break;
      case "m": case "M": if (!soundBtn.disabled) soundBtn.click(); break;
      case " ":
        // the space bar plays and stops the tape, unless it's pressing a button
        if (!onControl && player.tape) { player.togglePlay(); e.preventDefault(); }
        break;
      default:
    }
  });

  const canvas = $("sky");
  const toLocal = (e) => {
    const r = $("skyWrap").getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, touch: e.pointerType === "touch" };
  };
  canvas.addEventListener("pointermove", (e) => { state.pointer = toLocal(e); });
  canvas.addEventListener("pointerdown", (e) => { state.pointer = toLocal(e); state.tipUntil = performance.now() + 2600; });
  canvas.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") state.pointer = null; });

  if (serialSupported()) {
    const btn = $("knobBtn");
    $("knobRow").hidden = false;
    let link = null;
    btn.addEventListener("click", async () => {
      if (link) { await link.disconnect(); return; }
      try {
        link = await connectKnob({
          onPosition: (u) => { toRadio(); state.target = LOG_MIN + u * (LOG_MAX - LOG_MIN); state.seekRate = 10; markInput(); },
          onButton: () => { toRadio(); seekStation(1); },
          onClose: () => { link = null; btn.textContent = "Connect a knob"; },
        });
        btn.textContent = "Disconnect knob";
      } catch (e) {
        if (e.name !== "NotFoundError") console.warn(e);
      }
    });
  }
}

async function powerOn() {
  const btn = $("powerBtn");
  btn.disabled = true;
  // start audio inside the click (browsers require it), but don't hold the opening for it
  const sound = audio.start().then(() => {
    $("soundBtn").disabled = false;
    $("volume").disabled = false;
    $("soundBtn").textContent = "Sound on";
    $("soundBtn").setAttribute("aria-pressed", "true");
    audio.setRadio(player.mode === "radio");
  }).catch((e) => console.warn("Sound couldn't start:", e)).finally(() => {
    player.setAudio(audio);
    player.setVolume(audio.volume, audio.muted);
  });
  state.powered = true;
  const hashTape = tapeFromHash();
  const intro = $("intro");
  intro.classList.add("gone");
  setTimeout(() => { intro.hidden = true; }, 950);
  if (!parseHash() && !reduceMotion) {
    state.x = LOG_MIN;
    seekTo(START, 1.35);
  }
  state.hint = "Drag to tune"; // stays until the first touch of any control
  $("dial").focus({ preventScroll: true });
  await sound;
  // a shared tape link: put that tape in once the opening sweep has had a moment
  if (hashTape) setTimeout(() => pickTape(hashTape.t, hashTape.side), reduceMotion ? 0 : 1300);
}

// ----------------------------------------------------------------------------- the tape deck
function toRadio() {
  if (player && player.mode !== "radio") player.setMode("radio");
}

function bandAt(x) {
  let b = BAND_HOMES[0];
  for (const it of BAND_HOMES) if (x >= it[1] - 1e-9) b = it;
  return b;
}

const bandHome = (b) => (typeof b[2] === "string" ? STATIONS.find((s) => s.id === b[2]).logf : b[2]);

/** BAND: on to the next part of the spectrum, landing on something worth hearing. */
function nextBand() {
  toRadio();
  const x = state.target ?? state.x;
  const i = BAND_HOMES.indexOf(bandAt(x + 1e-6));
  seekTo(bandHome(BAND_HOMES[(i + 1) % BAND_HOMES.length]), 3.2);
}

function pickTape(t, side = 0) {
  if (!state.powered) return;
  const pl = $("player").getBoundingClientRect();
  if (!wide.matches && (pl.top < 0 || pl.bottom > innerHeight)) {
    // on small screens, bring the player into view first so the tape lands where you can see it
    $("player").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    setTimeout(() => player.insert(t, side), reduceMotion ? 0 : 450);
    return;
  }
  player.insert(t, side);
}

function modeChanged(mode) {
  document.body.dataset.mode = mode;
  if (audio) audio.setRadio(mode === "radio");
  state.cardKey = ""; // the notes follow whatever is playing
  lastText.signal = null;
  updateMarker();
  if (mode === "tape" && player.tape) writeTapeHash();
}

function tapeChanged() {
  state.cardKey = "";
  updateMarker();
  if (player.tape) writeTapeHash();
}

function writeTapeHash() {
  const h = `#tape=${player.tape.id}${player.side ? "b" : ""}`;
  if (location.hash !== h) {
    history.replaceState(null, "", h);
    writtenHash = h;
  }
}

/** Mark where the tape's planet was in Earth's sky on the day it was recorded. */
function updateMarker() {
  const m = $("marker");
  const t = player && player.mode === "tape" ? player.tape : null;
  if (!t || !PLANET[t.body]) { m.hidden = true; state.marker = null; return; }
  state.marker = skyPosition(t.body, t.ms);
  $("markerName").textContent = PLANET[t.body];
  $("markerDate").textContent = t.when.replace(/^Sol \d+, /, "");
  m.hidden = false;
  positionMarker();
  if (!reduceMotion) m.animate([{ opacity: 0, transform: "scale(1.8)" }, { opacity: 1, transform: "scale(1)" }], { duration: 500, easing: "cubic-bezier(.2,.8,.2,1)" });
}

function positionMarker() {
  const m = $("marker");
  if (!state.marker || m.hidden) return;
  const r = sky.cssRect();
  const q = mollweideXY(state.marker.l, state.marker.b);
  m.style.left = `${r.x + q.x * r.w}px`;
  m.style.top = `${r.y + q.y * r.h}px`;
  m.classList.toggle("flip", q.x > 0.7);
}

/** Local copies of the recordings, if tools/fetch_tapes.py has been run. */
async function loadTapeFiles() {
  try {
    const r = await fetch("data/tapes/tapes.json", { cache: "no-cache" });
    if (!r.ok) return;
    const j = await r.json();
    player.setFiles(j.files || {}, j.durations || {});
  } catch (e) { /* no local copies: the player streams from NASA */ }
}

function tapeFromHash() {
  let hash = location.hash;
  try { hash = decodeURIComponent(hash); } catch (e) { /* keep it */ }
  const m = hash.match(/tape=(lm\d\d)(b?)/i);
  if (!m) return null;
  const t = TAPES.find((x) => x.id === m[1].toLowerCase());
  return t ? { t, side: m[2] ? 1 : 0 } : null;
}

function parseHash() {
  let hash = location.hash;
  try { hash = decodeURIComponent(hash); } catch (e) { /* keep it as is */ }
  const m = hash.match(/f=(\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i);
  const f = m ? Number(m[1]) : NaN;
  return isFinite(f) && f > 0 ? f : null;
}

function fatal(msg) {
  const note = $("introNote");
  note.textContent = msg;
  note.classList.add("error");
  $("powerBtn").disabled = true;
}
