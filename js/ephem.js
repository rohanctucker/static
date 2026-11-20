// Where a planet sat in Earth's sky on a given date, and how far away it was.
// JPL's approximate Keplerian elements (Standish & Williams, Table 1, valid 1800–2050),
// accurate to about an arcminute for Mars and Jupiter: far finer than a pixel on this map.

const DEG = Math.PI / 180;
const AU_KM = 149597870.7;
const C_KMS = 299792.458;

// [value at J2000, rate per Julian century] for a, e, I, L, long. perihelion, long. node
const ELEMENTS = {
  earth: [[1.00000261, 0.00000562], [0.01671123, -0.00004392], [-0.00001531, -0.01294668],
    [100.46457166, 35999.37244981], [102.93768193, 0.32327364], [0, 0]], // Earth–Moon barycenter
  mars: [[1.52371034, 0.00001847], [0.0933941, 0.00007882], [1.84969142, -0.00813131],
    [-4.55343205, 19140.30268499], [-23.94362959, 0.44441088], [49.55953891, -0.29257343]],
  jupiter: [[5.202887, -0.00011607], [0.04838624, -0.00013253], [1.30439695, -0.00183714],
    [34.39644051, 3034.74612775], [14.72847983, 0.21252668], [100.47390909, 0.20469106]],
};

// ICRS (J2000 equatorial) to galactic, the IAU rotation
const EQ_TO_GAL = [
  [-0.0548755604162154, -0.873437090234885, -0.4838350155487132],
  [0.4941094278755837, -0.444829629960011, 0.7469822444972189],
  [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
];
const OBLIQUITY = 23.43928 * DEG;

const centuries = (ms) => (ms / 86400000 + 2440587.5 - 2451545.0) / 36525;

/** Heliocentric position (au) in the J2000 ecliptic frame. */
function helio(body, T) {
  const [a, e, I, L, wbar, node] = ELEMENTS[body].map(([v, r]) => v + r * T);
  const w = (wbar - node) * DEG, O = node * DEG, inc = I * DEG;
  let M = ((L - wbar) % 360 + 540) % 360 - 180; // degrees, −180..180
  M *= DEG;
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 12; k++) {
    const dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(inc), si = Math.sin(inc);
  return [
    (cw * cO - sw * sO * ci) * x - (sw * cO + cw * sO * ci) * y,
    (cw * sO + sw * cO * ci) * x + (cw * cO * ci - sw * sO) * y,
    sw * si * x + cw * si * y,
  ];
}

/**
 * Seen from Earth at time `ms` (Unix milliseconds): galactic longitude and latitude in degrees,
 * right ascension (hours) and declination, distance in au and the one-way light time in seconds.
 */
export function skyPosition(body, ms) {
  const T0 = centuries(ms);
  const earth = helio("earth", T0);
  let p = helio(body, T0), d = 0;
  for (let k = 0; k < 2; k++) {
    // where the planet was when the light we see left it
    const v = p.map((c, i) => c - earth[i]);
    d = Math.hypot(...v);
    p = helio(body, T0 - (d * AU_KM) / C_KMS / 86400 / 36525);
  }
  const g = p.map((c, i) => c - earth[i]);
  d = Math.hypot(...g);
  const ecl = g.map((c) => c / d);
  const eq = [
    ecl[0],
    Math.cos(OBLIQUITY) * ecl[1] - Math.sin(OBLIQUITY) * ecl[2],
    Math.sin(OBLIQUITY) * ecl[1] + Math.cos(OBLIQUITY) * ecl[2],
  ];
  const gal = EQ_TO_GAL.map((row) => row[0] * eq[0] + row[1] * eq[1] + row[2] * eq[2]);
  let l = Math.atan2(gal[1], gal[0]) / DEG;
  if (l < 0) l += 360;
  let ra = Math.atan2(eq[1], eq[0]) / DEG / 15;
  if (ra < 0) ra += 24;
  return {
    l,
    b: Math.asin(Math.max(-1, Math.min(1, gal[2]))) / DEG,
    ra,
    dec: Math.asin(Math.max(-1, Math.min(1, eq[2]))) / DEG,
    au: d,
    lightSeconds: (d * AU_KM) / C_KMS,
  };
}

/**
 * Where galactic (l, b) in degrees falls on this map's Mollweide ellipse, as fractions of its
 * bounding box: the inverse of the pointer readout in main.js (longitude grows to the left).
 */
export function mollweideXY(l, b) {
  let lam = -(((l + 180) % 360 + 360) % 360 - 180) * DEG;
  const phi = b * DEG;
  let th = phi;
  if (Math.abs(Math.abs(phi) - Math.PI / 2) < 1e-9) th = phi;
  else {
    for (let k = 0; k < 40; k++) {
      const f = 2 * th + Math.sin(2 * th) - Math.PI * Math.sin(phi);
      const dth = -f / (2 + 2 * Math.cos(2 * th));
      th += dth;
      if (Math.abs(dth) < 1e-10) break;
    }
  }
  const qx = (lam * Math.cos(th)) / Math.PI, qy = Math.sin(th);
  return { x: (qx + 1) / 2, y: (1 - qy) / 2 };
}

/** "11 min 24 s", "41 min", "1.3 s" */
export function lightTimeText(s) {
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;
  const m = Math.floor(s / 60), r = Math.round(s - m * 60);
  return r === 60 ? `${m + 1} min` : `${m} min ${r} s`;
}
