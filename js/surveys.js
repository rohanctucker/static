// Past 5 THz the dial leaves radio behind. Each station up here is a real all-sky survey image,
// served in HiPS format by the CDS astronomical data centre (Strasbourg) and reprojected in the
// browser into the same galactic map as the radio sky (see hipsproj.js).

import { mhzFromWavelength, mhzFromEnergy } from "./format.js";
import { reprojectAllsky } from "./hipsproj.js";

const CDS = "https://alasky.cds.unistra.fr";
const CDS_BIS = "https://alaskybis.cds.unistra.fr";
// other archives that mirror some of CDS's surveys (from CDS's own registry of copies)
const IRSA = "https://irsa.ipac.caltech.edu/data/hips/CDS";
const ESA = "https://skies.esac.esa.int";
const um = (x) => mhzFromWavelength(x * 1e-6);
const nm = (x) => mhzFromWavelength(x * 1e-9);
const keV = (x) => mhzFromEnergy(x * 1e3);
const GeV = (x) => mhzFromEnergy(x * 1e9);

/**
 * f: where the station sits (MHz). tones: frequencies (MHz) of the survey's colour channels, in
 * red-green-blue order, for the chord you hear. tint: colour for single-band (grayscale) surveys.
 * live: load from CDS only, never copied into the site (the image isn't openly licensed).
 */
export const SURVEYS = [
  {
    key: "iras", legend: { caption: "Infrared colors from 12 to 100 microns" }, dial: "IRAS", title: "The first infrared sky", f: um(60), freqLabel: "12–100 µm", reach: 0.2,
    base: [`${CDS}/IRISColor`, `${CDS_BIS}/IRISColor`, `${IRSA}/IRIS/color`], ext: "jpg", frame: "galactic",
    tones: [um(100), um(60), um(25), um(12)], toneNames: "its four colors, 12, 25, 60 and 100 microns,", equalTones: true,
    body:
      "In 1983 the IRAS satellite mapped 96% of the sky in four infrared colors, cooled by liquid helium until it ran out ten months later. It found wispy clouds of dust far from the Milky Way, nicknamed infrared cirrus, and the first dusty disk around another star, Vega.",
    credit: "IRIS, the improved reprocessing of IRAS by Miville-Deschênes & Lagache (2005), NASA/IPAC. HEALPix map and colors by CDS.",
    links: [{ label: "IRAS at NASA/IPAC", href: "https://irsa.ipac.caltech.edu/Missions/iras.html" }],
  },
  {
    key: "wise", legend: { swatches: [["22 µm", "#ff5a46"], ["4.6 µm", "#52d66e"], ["3.4 µm", "#5a90ff"]] }, dial: "WISE", title: "Starlight and warm dust", f: um(7), freqLabel: "3.4–22 µm",
    base: [`${CDS_BIS}/AllWISE/RGB-W4-W2-W1`, `${CDS}/AllWISE/RGB-W4-W2-W1`, `${IRSA}/AllWISE/RGB-W4-W2-W1`], ext: "jpg", frame: "equatorial",
    tones: [um(22), um(4.6), um(3.4)], toneNames: "its three colors, 22, 4.6 and 3.4 microns,",
    body:
      "NASA's WISE telescope mapped the whole sky in 2010. Blue and green here are starlight at 3.4 and 4.6 microns, where the Milky Way's old stars shine through most of the dust. Red is 22 microns: dust warmed by young stars.",
    credit: "AllWISE: NASA/JPL-Caltech/UCLA. HEALPix map and colors by CDS.",
    links: [{ label: "WISE at NASA/IPAC", href: "https://irsa.ipac.caltech.edu/Missions/wise.html" }],
  },
  {
    key: "twomass", legend: { swatches: [["2.17 µm", "#ff5a46"], ["1.65 µm", "#52d66e"], ["1.25 µm", "#5a90ff"]] }, dial: "2MASS", title: "Through the dust", f: um(1.65), freqLabel: "1.2–2.2 µm",
    base: [`${CDS_BIS}/2MASS/Color`, `${CDS}/2MASS/Color`, `${IRSA}/2MASS/Color`], ext: "jpg", frame: "equatorial",
    tones: [um(2.17), um(1.65), um(1.25)], toneNames: "its three colors, 2.17, 1.65 and 1.25 microns,",
    body:
      "Near-infrared light slips through the dust that blocks visible light, so the bulge at the center of the galaxy comes into view. Between 1997 and 2001, the 2MASS survey scanned the entire sky with two telescopes, one in Arizona and one in Chile, and catalogued 470 million stars.",
    credit: "2MASS: University of Massachusetts and IPAC/Caltech, funded by NASA and NSF. HEALPix map and colors by CDS.",
    links: [{ label: "2MASS at IPAC", href: "https://irsa.ipac.caltech.edu/Missions/2mass.html" }],
  },
  {
    key: "halpha", legend: { caption: "Hydrogen-alpha brightness" }, dial: "H-ALPHA", title: "Hydrogen's red glow", f: nm(656.28), freqLabel: "656.28 nm", reach: 0.08,
    base: [`${CDS}/FinkbeinerHalpha`, `${CDS_BIS}/FinkbeinerHalpha`], ext: "jpg", frame: "galactic",
    tint: [1.0, 0.16, 0.12], tones: [nm(656.28)], toneNames: "hydrogen-alpha, 456.8 THz,",
    body:
      "When starlight strips a hydrogen atom of its electron and the atom catches one again, it often glows at exactly this frequency: the deep red of hydrogen-alpha, the visible-light cousin of the radio hydrogen line. It traces gas lit up by hot young stars.",
    credit: "Composite map by Douglas Finkbeiner (2003) from the WHAM, VTSS and SHASSA surveys. HEALPix map by CDS; colored here.",
    links: [{ label: "The H-alpha map", href: "https://lambda.gsfc.nasa.gov/product/foreground/fg_halpha_info.html" }],
  },
  {
    key: "mellinger", legend: { caption: "True color, as your eyes would see it" }, dial: "NIGHT SKY", title: "The night sky", f: nm(529), freqLabel: "400–700 nm", reach: 0.12, live: true,
    base: [`${CDS}/MellingerRGB`, `${CDS_BIS}/MellingerRGB`], ext: "jpg", frame: "galactic",
    tones: [nm(620), nm(540), nm(450)], toneNames: "red, green and blue light,",
    body:
      "This is the sky your eyes would see from a very dark place, all of it at once. Axel Mellinger stitched it from more than 3,000 photos taken over 22 months in South Africa, Texas and Michigan, and calibrated their colors against catalog stars. The dark rifts are dust clouds hiding the stars behind them.",
    credit: "© 2000–2017 Axel Mellinger, all rights reserved (Mellinger 2009, PASP 121, 1180). Shown live from CDS's sky-survey service.",
    links: [{ label: "milkywaysky.com", href: "https://www.milkywaysky.com/" }],
  },
  {
    key: "galex", legend: { caption: "Near-ultraviolet brightness" }, dial: "GALEX", title: "Too bright to look at", f: nm(231), freqLabel: "231 nm",
    base: [`${CDS}/GALEX/GALEXGR6_7_NUV`, `${CDS_BIS}/GALEX/GALEXGR6_7_NUV`], ext: "png", frame: "equatorial",
    tint: [0.62, 0.42, 1.0], tones: [nm(231)], toneNames: "its ultraviolet band, 1.30 PHz,",
    body:
      "NASA's GALEX telescope mapped ultraviolet light from hot young stars and distant galaxies from 2003 to 2013. It never looked at most of the Milky Way: bright stars there could have damaged its detectors. The dark band across the middle is where it couldn't look.",
    credit: "GALEX GR6/7 near-ultraviolet: NASA/Caltech. HEALPix map by CDS; colored here.",
    links: [{ label: "GALEX at Caltech", href: "https://www.galex.caltech.edu/" }],
  },
  {
    key: "rosat", legend: { caption: "X-ray brightness, 0.1 to 2.4 keV" }, dial: "ROSAT", title: "Million-degree gas", f: keV(0.75), freqLabel: "0.1–2.4 keV",
    base: [`${CDS}/RASS`, `${CDS_BIS}/RASS`], ext: "jpg", frame: "equatorial",
    tint: [0.45, 0.75, 1.0], tones: [keV(0.25), keV(0.75), keV(1.5)], toneNames: "three of its X-ray energies, 0.25, 0.75 and 1.5 keV,", equalTones: true,
    body:
      "In 1990 and 1991 the German, American and British ROSAT satellite swept the whole sky in X-rays. This glow is gas at millions of degrees: shells of exploded stars, the hot bubble the Sun sits inside, and the North Polar Spur again, the same loop you saw at the bottom of the radio dial.",
    credit: "ROSAT All-Sky Survey, distributed by MPE. HEALPix map by CDS; colored here.",
    links: [{ label: "ROSAT at NASA HEASARC", href: "https://heasarc.gsfc.nasa.gov/docs/rosat/rosat.html" }],
  },
  {
    key: "integral", legend: { swatches: [["20–35 keV", "#ff5a46"], ["35–65 keV", "#52d66e"], ["65–100 keV", "#5a90ff"]] }, dial: "INTEGRAL", title: "Feeding black holes", f: keV(45), freqLabel: "20–100 keV",
    base: [`${CDS_BIS}/ESAC/ESAVO_P_INTEGRAL_color`, `${CDS}/ESAC/ESAVO_P_INTEGRAL_color`, `${ESA}/Integral/color`], ext: "jpg", frame: "equatorial",
    tones: [keV(27.5), keV(50), keV(82.5)], toneNames: "its three colors, 27.5, 50 and 82.5 keV,",
    body:
      "Hard X-rays come mostly from matter swirling onto black holes and neutron stars. Most of the dots along the Milky Way are pairs where a dead star is pulling gas off a living one. ESA's INTEGRAL observatory, launched in 2002, mapped them for more than two decades.",
    credit: "INTEGRAL color map: ESA (ESAC). Served by CDS.",
    links: [{ label: "INTEGRAL at ESA", href: "https://www.esa.int/Science_Exploration/Space_Science/Integral" }],
  },
  {
    key: "fermi", legend: { swatches: [["0.3–1 GeV", "#ff5a46"], ["1–3 GeV", "#52d66e"], ["3–300 GeV", "#5a90ff"]] }, dial: "FERMI", title: "The highest-energy light", f: GeV(1), freqLabel: "0.3–300 GeV",
    base: [`${CDS}/Fermi/Color`, `${CDS_BIS}/Fermi/Color`, `${ESA}/FermiColor`], ext: "jpg", frame: "equatorial",
    tones: [GeV(0.55), GeV(1.7), GeV(5.5)], toneNames: "its three colors, 0.55, 1.7 and 5.5 GeV,",
    body:
      "NASA's Fermi telescope, launched in 2008, sees light hundreds of millions of times more energetic than the light your eyes see. The Milky Way glows where cosmic rays slam into gas. The brightest dots are spinning neutron stars like the Vela pulsar; most of the rest are blazars, black holes in distant galaxies firing jets straight at us.",
    credit: "Fermi LAT: NASA/DOE/Fermi LAT Collaboration, via HEASARC. HEALPix map and colors by CDS.",
    links: [{ label: "Fermi at NASA", href: "https://fermi.gsfc.nasa.gov/" }],
  },
];

for (const s of SURVEYS) {
  s.logf = Math.log10(s.f);
  s.reach = s.reach || 0.42; // how far (in decades) the image stays visible either side
}

// ----------------------------------------------------------------------------- sound
/** The survey's channels as audible tones: the real frequencies slowed by the same number of
 *  octaves, chosen so the chord sits around 300 Hz. Returns { hz: [...], octaves }. */
export function surveyTones(s) {
  const hz = s.tones.map((f) => f * 1e6);
  const mid = Math.exp(hz.reduce((a, f) => a + Math.log(f), 0) / hz.length);
  // centre the chord near 300 Hz, but never push its lowest note below 90 Hz
  const octaves = Math.min(Math.round(Math.log2(mid / 300)), Math.floor(Math.log2(Math.min(...hz) / 90)));
  return { hz: hz.map((f) => f / 2 ** octaves), octaves };
}

/** One sentence for the station card describing the chord. */
export function surveyHearText(s) {
  const { hz, octaves } = surveyTones(s);
  const list = hz.map((f) => Math.round(f)).sort((a, b) => a - b);
  const joined = list.length === 1 ? `${list[0]} Hz` : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]} Hz`;
  const what = list.length === 1 ? `a tone at ${joined}` : `a chord of ${joined}`;
  const loud = list.length > 1 && !s.equalTones ? " Each note is as loud as its color is bright in the map." : "";
  return `The frequencies of ${s.toneNames} slowed down ${octaves} octaves: ${what}.${loud}`;
}

// ----------------------------------------------------------------------------- loading
/**
 * Loads survey images on demand: a copy kept with the site first (data/surveys, written by
 * tools/fetch_surveys.py), otherwise straight from CDS. Each image is reprojected off the main
 * thread and kept as an ImageBitmap ready for WebGL.
 */
export class SurveyBank {
  constructor({ outW = 1600, outH = 800 } = {}) {
    this.outW = outW;
    this.outH = outH;
    this.items = new Map(SURVEYS.map((s) => [s.key, { s, state: "idle" }]));
    this.local = {};
    this.queue = [];
    this.busy = false;
    this.onChange = null;
    this._jobs = new Map();
    this._nextJob = 1;
    try {
      this.worker = new Worker(new URL("./reproject.worker.js", import.meta.url), { type: "module" });
      this.worker.onmessage = (e) => {
        const job = this._jobs.get(e.data.id);
        if (!job) return;
        this._jobs.delete(e.data.id);
        if (e.data.ok) job.ok(e.data); else job.fail(new Error(e.data.error));
      };
      this.worker.onerror = () => { this.worker = null; };
    } catch (e) {
      this.worker = null; // older browsers: reproject on the main thread instead
    }
  }

  async init() {
    try {
      const r = await fetch("data/surveys/surveys.json", { cache: "no-cache" });
      if (r.ok) this.local = (await r.json()).files || {};
    } catch (e) { /* no local copies: everything comes from CDS */ }
  }

  get(key) {
    return this.items.get(key);
  }

  /** Ask for these surveys, most important first. Loads one at a time. */
  want(keys) {
    this.queue = keys.filter((k) => this.items.get(k).state === "idle");
    this._pump();
  }

  async _pump() {
    if (this.busy || !this.queue.length) return;
    const key = this.queue.shift();
    const it = this.items.get(key);
    if (it.state !== "idle") { this._pump(); return; }
    this.busy = true;
    it.state = "loading";
    this._changed(key);
    try {
      const pixels = await this._fetchAllsky(it.s);
      const res = await this._reproject(pixels, it.s.frame);
      const img = new ImageData(new Uint8ClampedArray(res.buffer), this.outW, this.outH);
      it.bitmap = await createImageBitmap(img, { premultiplyAlpha: "none", colorSpaceConversion: "none" })
        .catch(() => createImageBitmap(img));
      it.means = res.means;
      it.gray = res.gray;
      it.state = "ready";
    } catch (e) {
      console.warn(`Survey ${key} didn't load:`, e.message || e);
      it.state = "error";
    }
    this.busy = false;
    this._changed(key);
    this._pump();
  }

  _changed(key) {
    if (this.onChange) this.onChange(key);
  }

  async _fetchAllsky(s) {
    const urls = [];
    if (this.local[s.key] && !s.live) urls.push(`data/surveys/${this.local[s.key]}`);
    for (const b of s.base) urls.push(`${b}/Norder3/Allsky.${s.ext}`);
    let lastErr = null;
    for (const url of urls) {
      try {
        const r = await fetch(url, { mode: "cors" });
        if (!r.ok) throw new Error(`${r.status} for ${url}`);
        const blob = await r.blob();
        const bmp = await createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" })
          .catch(() => createImageBitmap(blob));
        const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(bmp.width, bmp.height) : document.createElement("canvas");
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(bmp, 0, 0);
        const data = ctx.getImageData(0, 0, bmp.width, bmp.height);
        bmp.close && bmp.close();
        return data;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("no source");
  }

  _reproject(img, frame) {
    if (!this.worker) {
      return new Promise((ok) => setTimeout(ok, 0)).then(() => {
        const res = reprojectAllsky({ data: img.data, width: img.width, height: img.height }, frame, this.outW, this.outH, 2);
        return { buffer: res.data.buffer, means: res.means, gray: res.gray };
      });
    }
    return new Promise((ok, fail) => {
      const id = this._nextJob++;
      this._jobs.set(id, { ok, fail });
      const buf = img.data.buffer;
      this.worker.postMessage({ id, buffer: buf, width: img.width, height: img.height, frame, outW: this.outW, outH: this.outH }, [buf]);
    });
  }
}
