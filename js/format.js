// Number formatting for frequencies, wavelengths and temperatures.

const C_MS = 299792458;

export const LOG_MIN = 1; // log10(10 MHz)
export const LOG_MAX = 18; // log10(1e18 MHz): 10^24 Hz, gamma rays of about 4 GeV
export const GSM_MAX = Math.log10(5e6); // the radio sky model stops at 5 THz

const H_EVS = 4.135667696e-15; // Planck constant, eV·s

const group = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function fixed(x, d) {
  const [i, f] = x.toFixed(d).split(".");
  return f !== undefined ? `${group(i)}.${f}` : group(i);
}

// Above GHz, every step of 1000 gets its own prefix: THz, PHz, EHz, ZHz, YHz.
const BIG_UNITS = [[1e6, "THz"], [1e9, "PHz"], [1e12, "EHz"], [1e15, "ZHz"], [1e18, "YHz"]];

function bigUnit(fMHz) {
  let u = BIG_UNITS[0];
  for (const it of BIG_UNITS) if (fMHz >= it[0] * 0.9995) u = it;
  return u;
}

/** Frequency in MHz -> { value, unit } for the big readout. */
export function freqParts(fMHz) {
  if (fMHz < 10000) return { value: fixed(fMHz, 2), unit: "MHz" };
  const g = fMHz / 1000;
  if (g < 1000) return { value: fixed(g, g < 100 ? 3 : 2), unit: "GHz" };
  const [scale, unit] = bigUnit(fMHz);
  const v = fMHz / scale;
  return { value: fixed(v, v < 10 ? 3 : v < 100 ? 2 : 1), unit };
}

export function freqText(fMHz) {
  const p = freqParts(fMHz);
  return `${p.value} ${p.unit}`;
}

/** Short label for dial ticks and station lists. */
export function freqShort(fMHz) {
  if (fMHz < 1000) return `${trim(fMHz)} MHz`;
  if (fMHz < 1e6) return `${trim(fMHz / 1000)} GHz`;
  const [scale, unit] = bigUnit(fMHz);
  return `${trim(fMHz / scale)} ${unit}`;
}

/** Tick label for m × 10^d MHz: the unit on whole decades of a new prefix, bare numbers elsewhere. */
export function tickText(m, d) {
  const units = [[0, "MHz"], [3, "GHz"], [6, "THz"], [9, "PHz"], [12, "EHz"], [15, "ZHz"], [18, "YHz"]];
  let base = units[0];
  for (const u of units) if (d >= u[0]) base = u;
  const v = m * 10 ** (d - base[0]);
  const t = trim(v);
  return m === 1 ? `${t} ${base[1]}` : t;
}

function trim(x) {
  const s = x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
  return s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/** Up to three significant figures for lengths: 1.66, 21.1, 529. */
function sigLen(x) {
  return x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
}

/** Wavelength for a frequency in MHz. */
export function wavelengthText(fMHz) {
  const m = C_MS / (fMHz * 1e6);
  if (m >= 1) return `${m.toFixed(m >= 10 ? 1 : 2)} m`;
  if (m >= 0.01) return `${(m * 100).toFixed(m >= 0.1 ? 1 : 2)} cm`;
  if (m >= 0.001) return `${(m * 1000).toFixed(2)} mm`;
  if (m >= 1e-6) return `${sigLen(m * 1e6)} µm`;
  if (m >= 1e-9) return `${sigLen(m * 1e9)} nm`;
  if (m >= 1e-12) return `${sigLen(m * 1e12)} pm`;
  return `${sigLen(m * 1e15)} fm`;
}

/** Energy of one photon at this frequency (MHz), in electronvolts with a prefix. */
export function energyText(fMHz) {
  const ev = H_EVS * fMHz * 1e6;
  const steps = [[1e9, "GeV"], [1e6, "MeV"], [1e3, "keV"], [1, "eV"], [1e-3, "meV"], [1e-6, "µeV"]];
  for (const [scale, unit] of steps) if (ev >= scale * 0.9995) return `${sigLen(ev / scale)} ${unit}`;
  return `${sigLen(ev / 1e-9)} neV`;
}

/** Frequency in MHz for a wavelength in metres, or a photon energy in electronvolts. */
export const mhzFromWavelength = (metres) => C_MS / metres / 1e6;
export const mhzFromEnergy = (ev) => ev / H_EVS / 1e6;

/** Three significant figures, without exponents or trailing zeros. */
function sig3(x) {
  let s = x.toPrecision(3);
  if (s.includes("e")) s = Number(s).toString();
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

/** Temperature in kelvin, readable across fifteen orders of magnitude. */
export function tempText(k) {
  if (!isFinite(k)) return "–";
  const a = Math.abs(k);
  if (a >= 10000) return `${group(String(Math.round(Number(k.toPrecision(3)))))} K`;
  if (a >= 1000) return `${group(Math.round(k).toString())} K`;
  if (a >= 100) return `${Math.round(k)} K`;
  if (a >= 10) return `${k.toFixed(1)} K`;
  if (a >= 1) return `${k.toFixed(2)} K`;
  if (a >= 1e-3) return `${sig3(k * 1e3)} mK`;
  if (a >= 1e-6) return `${sig3(k * 1e6)} µK`;
  if (a >= 1e-9) return `${sig3(k * 1e9)} nK`;
  return "0 K";
}

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
