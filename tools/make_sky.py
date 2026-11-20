#!/usr/bin/env python3
"""
make_sky.py: render the radio sky for STATIC.

Builds everything in data/ that the site reads:
  data/frames/f_XXX.webp    whole-sky maps (Mollweide, galactic coordinates), one per frequency
  data/lo/sprite.webp       small previews of every frame packed into one image (instant first paint)
  data/special/cmb.webp     the CMB anisotropy, separated from the galaxy by the GSM2016 model
  data/special/hi4pi.webp   (optional) real hydrogen from the HI4PI 21-cm survey
  data/manifest.json        frequencies, file names, temperature scales and sky statistics

Source model: GSM2016, Zheng et al. (2017), MNRAS 464, 3486, "An improved model of diffuse
Galactic radio emission from 10 MHz to 5 THz". Data and reference code (MIT License):
https://github.com/jeffzhen/gsm2016. The interpolation below follows the authors' create_map.py.

Usage
  python tools/make_sky.py sky        # renders all frames + CMB map (clones the GSM2016 repo if needed)
  python tools/make_sky.py hydrogen   # optional: downloads HI4PI (~320 MB) and adds the hydrogen map

Needs: numpy, healpy, pillow (and astropy for `hydrogen`). healpy does not run on Windows;
use Google Colab, macOS or Linux (see README).
"""
import argparse
import datetime as dt
import json
import math
import os
import subprocess
import sys
import urllib.request

import numpy as np

try:
    import healpy as hp
except ImportError:  # pragma: no cover
    sys.exit("healpy is required: pip install healpy  (on Windows, use Google Colab)")
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

LABELS = ["Synchrotron", "CMB", "HI", "Dust1", "Dust2", "Free-Free"]
KB, C, H, TCMB = 1.38065e-23, 2.99792e8, 6.62607e-34, 2.725
NSIDE = 1024

# Exact frames at every station so the dial lands on real renders (MHz). Keep in sync with js/stations.js.
STATION_FREQS = [20.1, 81.5, 98.7, 408.0, 1420.405751768, 1540.0, 1575.42, 1665.402, 1667.359,
                 22235.08, 23800.0, 115271.2018, 160200.0, 3.0e6]
F_MIN, F_MAX = 10.0, 5.0e6  # MHz (10 MHz .. 5 THz)

HI4PI_URL = "https://cdsarc.cds.unistra.fr/ftp/J/A+A/594/A116/NHI_HPX.fits.gz"


# ----------------------------------------------------------------------------- units
def k_rj_to_mjysr(nu_hz):
    """1 K (Rayleigh-Jeans) in MJy/sr."""
    return 2.0 * (nu_hz / C) ** 2 * KB * 1e20


def k_cmb_to_mjysr(nu_hz):
    """1 K (CMB thermodynamic) in MJy/sr."""
    x = H * nu_hz / (KB * TCMB)
    b_nu = 2 * (H * nu_hz) * (nu_hz / C) ** 2 / (math.exp(x) - 1)
    return (b_nu * C / nu_hz / TCMB) ** 2 / 2 * math.exp(x) / KB * 1e20


def cmb_monopole_rj(nu_hz):
    """Brightness (Rayleigh-Jeans) temperature of the 2.725 K CMB at nu."""
    x = H * nu_hz / (KB * TCMB)
    return TCMB * x / math.expm1(x)


# ----------------------------------------------------------------------------- GSM2016
class GSM2016:
    def __init__(self, repo_dir):
        data = os.path.join(repo_dir, "data")
        print("Loading GSM2016 components from", data)
        self.maps = np.array([np.fromfile(os.path.join(data, f"highres_{lb}_map.bin"), dtype="float32")
                              for lb in LABELS])  # NESTED, nside 1024
        self.spec = np.loadtxt(os.path.join(data, "spectra.txt"))
        self.lf = np.log10(self.spec[0])
        self.ls = np.log10(self.spec[1])
        self.w = self.spec[2:]

    def weights(self, f_ghz):
        x = np.clip(np.log10(f_ghz), self.lf[0], self.lf[-1])
        i = int(np.clip(np.searchsorted(self.lf, x) - 1, 0, len(self.lf) - 2))
        t = (x - self.lf[i]) / (self.lf[i + 1] - self.lf[i])
        scale = 10 ** (self.ls[i] + t * (self.ls[i + 1] - self.ls[i]))
        wc = self.w[:, i] + t * (self.w[:, i + 1] - self.w[:, i])
        return scale, wc

    def mjysr(self, f_ghz, pix=None):
        scale, wc = self.weights(f_ghz)
        m = self.maps if pix is None else self.maps[:, pix]
        return (scale * wc.astype(np.float32)) @ m

    def trj(self, f_mhz, pix=None):
        nu = f_mhz * 1e6
        return self.mjysr(f_mhz / 1e3, pix) / k_rj_to_mjysr(nu)

    def cmb_anisotropy_k(self, pix=None, f_ghz=100.0):
        """CMB component in K_CMB (frequency independent by construction)."""
        scale, wc = self.weights(f_ghz)
        m = self.maps[1] if pix is None else self.maps[1][pix]
        return scale * wc[1] * m / k_cmb_to_mjysr(f_ghz * 1e9)


def cmb_in_map(gsm, f_mhz):
    """Fraction of the CMB monopole that GSM2016's map already contains at f_mhz.

    The model's spectral nodes up to 1.42 GHz come from absolutely calibrated surveys, so their
    maps include the 2.7 K background (the map floor is ~3.3 K at 1.42 GHz). From the 2.33 GHz
    node up, the inputs are differential (WMAP, Planck) and the monopole is absent (floor ~0.08 K).
    Between the two nodes the model interpolates, so the offset fades with the map's own scaling.
    """
    lo, hi = 1420.0, 2330.0
    if f_mhz <= lo:
        return 1.0
    if f_mhz >= hi:
        return 0.0
    t = math.log(f_mhz / lo) / math.log(hi / lo)
    s_lo = gsm.weights(lo / 1e3)[0]
    s = gsm.weights(f_mhz / 1e3)[0]
    frac = (1 - t) * (s / s_lo) * (lo / f_mhz) ** 2 * cmb_monopole_rj(lo * 1e6) / cmb_monopole_rj(f_mhz * 1e6)
    return float(min(1.0, max(0.0, frac)))


def ensure_repo(path):
    if os.path.isfile(os.path.join(path, "data", "spectra.txt")):
        return path
    print("Cloning https://github.com/jeffzhen/gsm2016 (about 540 MB) ...")
    subprocess.check_call(["git", "clone", "--depth", "1", "https://github.com/jeffzhen/gsm2016", path])
    return path


# ----------------------------------------------------------------------------- projection
def mollweide_index(width, nest=True, nside=NSIDE):
    """HEALPix pixel for every image pixel of a width x width/2 Mollweide map.

    Galactic coordinates, galactic centre in the middle, longitude increasing to the LEFT
    (astronomical convention), north at the top. Returns (pix, inside) with shape (H, W).
    """
    h = width // 2
    j = (np.arange(width) + 0.5) / width * 2 - 1
    i = 1 - (np.arange(h) + 0.5) / h * 2
    x, y = np.meshgrid(j, i)
    inside = x * x + y * y <= 1.0
    yy = np.clip(y, -1, 1)
    theta = np.arcsin(yy)
    lat = np.arcsin(np.clip((2 * theta + np.sin(2 * theta)) / np.pi, -1, 1))
    cos_t = np.cos(theta)
    lam = np.where(cos_t > 1e-9, np.pi * x / np.maximum(cos_t, 1e-9), 0.0)
    lam = np.clip(lam, -np.pi, np.pi)
    lon = np.mod(-lam, 2 * np.pi)
    pix = hp.ang2pix(nside, np.pi / 2 - lat, lon, nest=nest)
    mollweide_index.lat = lat  # galactic latitude (radians) of every image pixel, for masks
    return pix, inside


# ----------------------------------------------------------------------------- stretching
def asinh_stretch(values, inside):
    """Map temperatures to 0..1 with an asinh curve (log-like for bright emission,
    linear and sign-preserving near zero). Returns (u, a, lo, hi) where
    T = a * sinh(lo + u * (hi - lo)).

    Emission-dominated frames (radio, dust) start the scale at the faintest positive sky,
    so the few negative pixels the model extrapolates (e.g. the absorbed plane at 10 MHz)
    read as black. CMB-dominated frames keep their sign with a gentler, more linear curve.
    The two regimes blend smoothly on the fraction of negative pixels."""
    v = values[inside]
    neg = float(np.mean(v < 0))
    w = float(np.clip((neg - 0.02) / 0.13, 0.0, 1.0))
    av = np.abs(v)
    a = float((1 - w) * np.percentile(av, 20) + w * 2.5 * np.percentile(av, 50))
    if not np.isfinite(a) or a <= 0:
        a = float(np.std(v)) or 1.0
    plo = (1 - w) * min(neg * 100 + 0.6, 6.0) + w * 0.3
    phi = (1 - w) * 99.75 + w * 99.7
    d = np.arcsinh(values / a)
    lo, hi = (float(q) for q in np.percentile(d[inside], [plo, phi]))
    if hi - lo < 1e-9:
        hi = lo + 1e-9
    u = np.clip((d - lo) / (hi - lo), 0, 1)
    u[~inside] = 0
    return u, a, lo, hi


def downsample(u, inside, out_w):
    """Supersampled float image -> 8-bit L image of width out_w (Lanczos)."""
    img = Image.fromarray((u * 65535).astype(np.uint16).astype(np.int32), mode="I")
    img = img.resize((out_w, out_w // 2), Image.LANCZOS)
    arr = np.asarray(img, dtype=np.float32) / 65535.0
    return Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8), mode="L")


def save_webp(img, path, quality=86):
    img.save(path, "WEBP", quality=quality, method=6)


# ----------------------------------------------------------------------------- commands
def frame_freqs(n):
    base = list(np.geomspace(F_MIN, F_MAX, n))
    allf = sorted(base + STATION_FREQS)
    out = []
    for f in allf:  # drop near-duplicates (within 0.4%) but keep station frequencies exact
        if out and abs(math.log10(f) - math.log10(out[-1])) < 0.0017:
            if f in STATION_FREQS:
                out[-1] = f
            continue
        out.append(f)
    return out


def cmd_sky(args):
    out = os.path.abspath(args.out)
    for sub in ("frames", "lo", "special"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
    gsm = GSM2016(ensure_repo(args.gsm))

    ss = args.supersample
    pix, inside = mollweide_index(args.width * ss)
    lat = mollweide_index.lat
    flat_pix = pix.ravel()

    freqs = frame_freqs(args.frames)
    print(f"Rendering {len(freqs)} frames at {args.width}x{args.width // 2} (x{ss} supersampled)")
    frames, lo_imgs = [], []
    for k, f in enumerate(freqs):
        t = gsm.trj(f, flat_pix).reshape(pix.shape)
        u, a, lo, hi = asinh_stretch(t, inside)
        img = downsample(u, inside, args.width)
        name = f"f_{k:03d}.webp"
        save_webp(img, os.path.join(out, "frames", name), args.quality)
        lo_imgs.append(img.resize((args.lo_width, args.lo_width // 2), Image.LANCZOS))
        v = t[inside]
        tmed = float(np.median(v))
        frames.append({
            "f": round(float(f), 6), "src": f"frames/{name}", "lo": k,
            "a": a, "lo_d": lo, "hi_d": hi,
            "tmed": tmed, "t05": float(np.percentile(v, 5)), "t95": float(np.percentile(v, 95)),
            "tmax": float(np.percentile(v, 99.9)), "tcmb": cmb_monopole_rj(f * 1e6),
            "inc": round(cmb_in_map(gsm, f), 4),  # share of tcmb already inside the map
        })
        if k % 10 == 0 or k == len(freqs) - 1:
            print(f"  {k + 1:3d}/{len(freqs)}  {fmt_f(f):>12s}  median T_RJ = {tmed:.4g} K")

    # previews packed into one sprite
    cols = 12
    rows = math.ceil(len(lo_imgs) / cols)
    lw, lh = args.lo_width, args.lo_width // 2
    sprite = Image.new("L", (cols * lw, rows * lh), 0)
    for k, im in enumerate(lo_imgs):
        sprite.paste(im, ((k % cols) * lw, (k // cols) * lh))
    save_webp(sprite, os.path.join(out, "lo", "sprite.webp"), 80)

    # the CMB, separated from the galaxy by the model's blind component analysis
    cmb = gsm.cmb_anisotropy_k(flat_pix).reshape(pix.shape) * 1e6  # micro-K
    vin = cmb[inside]
    med = float(np.median(vin))
    sigma = float(1.4826 * np.median(np.abs(vin - med)))
    lim = round(3.0 * sigma, 1)
    # fade the thin band of galactic-plane residuals (|b| < ~3 deg) to zero, as CMB maps usually do
    absb = np.degrees(np.abs(lat))
    keep = np.clip((absb - 1.5) / 2.5, 0, 1)
    keep = keep * keep * (3 - 2 * keep)
    u = np.clip((cmb - med) * keep / lim * 0.5 + 0.5, 0, 1)
    u[~inside] = 0
    save_webp(downsample(u, inside, args.width), os.path.join(out, "special", "cmb.webp"), args.quality)
    print(f"CMB anisotropy: robust sigma = {sigma:.1f} uK, display range +/-{lim} uK")

    manifest = load_manifest(out)
    manifest.update({
        "version": 2,
        "generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model": "GSM2016 (Zheng et al. 2017), github.com/jeffzhen/gsm2016",
        "projection": "Mollweide, galactic coordinates, centre l=0, longitude increasing left",
        "width": args.width, "height": args.width // 2,
        "unit": "K (Rayleigh-Jeans brightness temperature); total sky = map + tcmb * (1 - inc)",
        "lo": {"src": "lo/sprite.webp", "cols": cols, "w": lw, "h": lh, "count": len(lo_imgs)},
        "frames": frames,
    })
    special = manifest.setdefault("special", {})
    special["cmb"] = {
        "src": "special/cmb.webp", "mode": "diverging", "unit": "µK", "min": -lim, "max": lim,
        "label": "CMB anisotropy, GSM2016 component (from Planck data); galactic plane residuals faded",
    }
    write_manifest(out, manifest)
    print("Wrote", os.path.join(out, "manifest.json"))


def cmd_hydrogen(args):
    out = os.path.abspath(args.out)
    os.makedirs(os.path.join(out, "special"), exist_ok=True)
    try:
        from astropy.io import fits
    except ImportError:
        sys.exit("astropy is required for the hydrogen map: pip install astropy")
    path = args.fits
    if not path:
        path = os.path.join(HERE, "NHI_HPX.fits.gz")
        if not os.path.exists(path):
            print("Downloading HI4PI column density map (~320 MB) from CDS ...")
            urllib.request.urlretrieve(HI4PI_URL, path, reporthook=_progress)
            print()
    print("Reading", path)
    with fits.open(path, memmap=False) as hdul:
        table = next(h for h in hdul if getattr(h, "columns", None) is not None)
        names = [n.upper() for n in table.columns.names]
        data = table.data
        col = lambda n: np.asarray(data.field(names.index(n)), dtype=np.float64)
        nhi = col("NHI")
        # HI4PI's table: HPXINDEX (nside 1024, RING, galactic), RA2000, DEC2000, GLON, GLAT, NHI [cm^-2]
        nside_in = hp.npix2nside(len(nhi)) if hp.isnpixok(len(nhi)) else NSIDE
        if "HPXINDEX" in names:
            ipix = col("HPXINDEX").astype(np.int64)
        else:
            ipix = hp.ang2pix(nside_in, col("GLON"), col("GLAT"), lonlat=True)
    m = np.full(hp.nside2npix(nside_in), np.nan)
    m[ipix] = nhi
    ss = args.supersample
    pix, inside = mollweide_index(args.width * ss, nest=False, nside=nside_in)
    v = m[pix]
    good = inside & np.isfinite(v) & (v > 0)
    lv = np.log10(np.where(good, v, 1.0))
    lo, hi = (float(q) for q in np.percentile(lv[good], [0.5, 99.8]))
    u = np.clip((lv - lo) / (hi - lo), 0, 1)
    u[~good] = 0
    save_webp(downsample(u, inside, args.width), os.path.join(out, "special", "hi4pi.webp"), args.quality)
    manifest = load_manifest(out)
    manifest.setdefault("special", {})["hi"] = {
        "src": "special/hi4pi.webp", "mode": "log", "unit": "atoms/cm²",
        "min": 10 ** lo, "max": 10 ** hi,
        "label": "Neutral hydrogen column density, HI4PI survey",
    }
    write_manifest(out, manifest)
    print(f"Wrote special/hi4pi.webp  (N_HI {10**lo:.2e} to {10**hi:.2e} cm^-2)")


# ----------------------------------------------------------------------------- helpers
def fmt_f(f):
    if f >= 1e6:
        return f"{f / 1e6:.3g} THz"
    if f >= 1e3:
        return f"{f / 1e3:.4g} GHz"
    return f"{f:.4g} MHz"


def load_manifest(out):
    p = os.path.join(out, "manifest.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as fh:
            return json.load(fh)
    return {}


def write_manifest(out, manifest):
    with open(os.path.join(out, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, separators=(",", ":"))


def _progress(blocks, bs, total):
    if total > 0:
        done = min(1.0, blocks * bs / total)
        sys.stdout.write(f"\r  {done * 100:5.1f}%  of {total / 1e6:.0f} MB")
        sys.stdout.flush()


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sky", help="render the GSM2016 frames and CMB map")
    s.add_argument("--gsm", default=os.path.join(HERE, "gsm2016"), help="path to a clone of jeffzhen/gsm2016")
    s.add_argument("--out", default=os.path.join(ROOT, "data"))
    s.add_argument("--frames", type=int, default=136, help="log-spaced frames between 10 MHz and 5 THz")
    s.add_argument("--width", type=int, default=1600)
    s.add_argument("--lo-width", type=int, default=256)
    s.add_argument("--supersample", type=int, default=2)
    s.add_argument("--quality", type=int, default=86)
    s.set_defaults(func=cmd_sky)
    g = sub.add_parser("hydrogen", help="add the HI4PI hydrogen map (downloads ~320 MB)")
    g.add_argument("--fits", default=None, help="use a local NHI_HPX.fits(.gz) instead of downloading")
    g.add_argument("--out", default=os.path.join(ROOT, "data"))
    g.add_argument("--width", type=int, default=1600)
    g.add_argument("--supersample", type=int, default=2)
    g.add_argument("--quality", type=int, default=88)
    g.set_defaults(func=cmd_hydrogen)
    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
