// Turn a HiPS "Allsky" image into a galactic Mollweide map like the radio frames.
//
// HiPS surveys (the format the CDS archive in Strasbourg serves to sky viewers like Aladin) keep a
// low-resolution copy of the whole sky in one file, Norder3/Allsky.jpg: the 768 HEALPix cells of
// order 3, each shrunk to a tw×tw square, laid out 27 to a row. Inside a square, the pixel in row r
// and column c is the HEALPix sub-cell whose nested index interleaves r (even bits) and c (odd bits).
// That layout was checked against Orion's belt in a real CDS tile (all four stars within 0.6').

const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;
const TILES_PER_ROW = 27;

// Galactic -> equatorial (ICRS/J2000) rotation: eq = M · gal
const GAL_TO_EQ = [
  [-0.0548755604162154, 0.4941094278755837, -0.8676661490190047],
  [-0.8734370902348850, -0.4448296299600112, -0.1980763734312015],
  [-0.4838350155487132, 0.7469822444972189, 0.4559837761750669],
];

/** Spread the low 15 bits of v into the even bit positions. */
function spread(v) {
  v = (v | (v << 8)) & 0x00ff00ff;
  v = (v | (v << 4)) & 0x0f0f0f0f;
  v = (v | (v << 2)) & 0x33333333;
  v = (v | (v << 1)) & 0x55555555;
  return v;
}

/** HEALPix nested index (order <= 13) of the direction with z = sin(lat), phi = longitude (radians). */
export function nestIndex(order, z, phi) {
  const nside = 1 << order;
  const za = Math.abs(z);
  let tt = (phi / HALF_PI) % 4;
  if (tt < 0) tt += 4;
  let face, ix, iy;
  if (za <= 2 / 3) {
    const t1 = nside * (0.5 + tt);
    const t2 = nside * (z * 0.75);
    const jp = Math.floor(t1 - t2); // ascending edge line
    const jm = Math.floor(t1 + t2); // descending edge line
    const ifp = jp >> order;
    const ifm = jm >> order;
    face = ifp === ifm ? ifp | 4 : ifp < ifm ? ifp : ifm + 8;
    ix = jm & (nside - 1);
    iy = nside - (jp & (nside - 1)) - 1;
  } else {
    const ntt = Math.min(3, Math.floor(tt));
    const tp = tt - ntt;
    const tmp = nside * Math.sqrt(3 * (1 - za));
    const jp = Math.min(Math.floor(tp * tmp), nside - 1);
    const jm = Math.min(Math.floor((1 - tp) * tmp), nside - 1);
    if (z >= 0) { face = ntt; ix = nside - jm - 1; iy = nside - jp - 1; }
    else { face = ntt + 8; ix = jp; iy = jm; }
  }
  return face * nside * nside + spread(ix) + 2 * spread(iy);
}

/** Galactic (l, b) in radians, in a HiPS frame: returns [z, phi] ready for nestIndex. */
export function toFrame(l, b, frame) {
  const cb = Math.cos(b);
  const gx = cb * Math.cos(l), gy = cb * Math.sin(l), gz = Math.sin(b);
  if (frame !== "equatorial") return [gz, l];
  const M = GAL_TO_EQ;
  const ex = M[0][0] * gx + M[0][1] * gy + M[0][2] * gz;
  const ey = M[1][0] * gx + M[1][1] * gy + M[1][2] * gz;
  const ez = M[2][0] * gx + M[2][1] * gy + M[2][2] * gz;
  let phi = Math.atan2(ey, ex);
  if (phi < 0) phi += TWO_PI;
  return [Math.max(-1, Math.min(1, ez)), phi];
}

/**
 * Reproject an Allsky mosaic into a galactic Mollweide image (longitude increasing to the left).
 * src: { data: RGBA Uint8ClampedArray, width, height }, frame: "galactic" | "equatorial".
 * Each output pixel averages ss×ss samples. Returns { data, width, height, means: [r, g, b], gray }.
 */
export function reprojectAllsky(src, frame, outW = 1600, outH = 800, ss = 2) {
  const tw = Math.round(src.width / TILES_PER_ROW);
  const k = Math.round(Math.log2(tw));
  if (tw < 2 || 1 << k !== tw || k > 10 || src.height < Math.ceil(768 / TILES_PER_ROW) * tw) {
    throw new Error(`Not a HiPS Allsky image (${src.width}x${src.height})`);
  }
  const order = 3 + k;
  const subMask = (1 << (2 * k)) - 1;
  const sd = src.data, sw = src.width;
  const out = new Uint8ClampedArray(outW * outH * 4);
  let sumR = 0, sumG = 0, sumB = 0, sumW = 0, chroma = 0;
  const inv = 1 / (ss * ss);

  for (let py = 0; py < outH; py++) {
    // per sub-row: latitude terms depend only on the vertical position
    const rows = [];
    for (let sy = 0; sy < ss; sy++) {
      const qy = 1 - (2 * (py + (sy + 0.5) / ss)) / outH;
      if (Math.abs(qy) >= 1) { rows.push(null); continue; }
      const th = Math.asin(qy);
      const b = Math.asin((2 * th + Math.sin(2 * th)) / Math.PI);
      rows.push({ qy, invCos: 1 / Math.cos(th), b });
    }
    for (let px = 0; px < outW; px++) {
      let r = 0, g = 0, bl = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        const row = rows[sy];
        if (!row) continue;
        for (let sx = 0; sx < ss; sx++) {
          const qx = (2 * (px + (sx + 0.5) / ss)) / outW - 1;
          if (qx * qx + row.qy * row.qy > 1) continue;
          let l = -Math.PI * qx * row.invCos;
          if (l < 0) l += TWO_PI;
          const [z, phi] = toFrame(l, row.b, frame);
          const nest = nestIndex(order, z, phi);
          const tile = nest >> (2 * k);
          const sub = nest & subMask;
          let ix = 0, iy = 0;
          for (let bit = 0; bit < k; bit++) {
            ix |= ((sub >> (2 * bit)) & 1) << bit;
            iy |= ((sub >> (2 * bit + 1)) & 1) << bit;
          }
          const X = (tile % TILES_PER_ROW) * tw + iy; // column comes from the odd bits
          const Y = Math.floor(tile / TILES_PER_ROW) * tw + ix; // row from the even bits
          const i = (Y * sw + X) * 4;
          const w = sd[i + 3] / 255;
          r += sd[i] * w; g += sd[i + 1] * w; bl += sd[i + 2] * w; a += w;
        }
      }
      const o = (py * outW + px) * 4;
      if (a > 0) {
        out[o] = r / a; out[o + 1] = g / a; out[o + 2] = bl / a;
        out[o + 3] = Math.round(a * inv * 255);
        sumR += r; sumG += g; sumB += bl; sumW += a;
        chroma += Math.abs(r - g) + Math.abs(g - bl);
      }
    }
  }
  const means = sumW ? [sumR / sumW / 255, sumG / sumW / 255, sumB / sumW / 255] : [0, 0, 0];
  const gray = sumW ? chroma / sumW < 3 : true;
  return { data: out, width: outW, height: outH, means, gray };
}
