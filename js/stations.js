// Stations: places on the dial where something specific is broadcasting.
import { SURVEYS, surveyHearText } from "./surveys.js";
// f in MHz. `capture` is the half-width of the lock zone in decades (log10 units).
// Lines are transposed into hearing range by whole octaves, so their pitch ratios stay real.

const OCT22 = 2 ** 22; // MHz -> Hz for the 1.4 GHz lines (1e6 / 2^22 = 0.2384)
export const H_LINE = 1420.405751768;
export const lineToHz = (fMHz, octaves) => (fMHz * 1e6) / 2 ** octaves;

export const STATIONS = [
  {
    id: "ionosphere", freqLabel: "10–15 MHz", kind: "zone", lo: 10, hi: 15, priority: 1, dial: "IONOSPHERE",
    title: "Under the ionosphere",
    body:
      "Down here, Earth's ionosphere bends and reflects radio waves, so from the ground this slice of the sky is mostly hidden behind our own atmosphere. You're seeing it as it would look from above. Look at the Milky Way's disk: its own ionized gas swallows these long waves, and the bright band turns dark.",
    hear: "Static as loud as this sky really is.",
  },
  {
    id: "jupiter", freqLabel: "20.1 MHz", kind: "point", f: 20.1, capture: 0.012, priority: 3, dial: "JUPITER", voice: "jupiter",
    title: "Jupiter",
    body:
      "Jupiter is the loudest planet in the radio sky. Electrons spiraling in its magnetic field, stirred up by its volcanic moon Io, throw off bursts strong enough to catch with a wire antenna in a backyard. NASA's Radio JOVE kits tune in right here, at 20.1 MHz.",
    hear: "Synthesized bursts: slow L-bursts that roll in like surf, and crackling S-bursts.",
    links: [{ label: "NASA Radio JOVE", href: "https://radiojove.gsfc.nasa.gov/" }],
  },
  {
    id: "cp1919", freqLabel: "81.5 MHz", kind: "point", f: 81.5, capture: 0.008, priority: 3, dial: "CP 1919", voice: "pulsar",
    title: "The first pulsar",
    body:
      "In 1967, graduate student Jocelyn Bell Burnell noticed a “bit of scruff” on her chart recorder at 81.5 MHz: a pulse every 1.337 seconds, so regular it looked artificial. It was a collapsed star spinning like a lighthouse, the first pulsar ever found. A plot of its pulses later became the cover of Joy Division's Unknown Pleasures.",
    hear: "One pulse every 1.3373 seconds, CP 1919's real period.",
  },
  {
    id: "fm", freqLabel: "88–108 MHz", kind: "band", lo: 88, hi: 108, edge: 0.004, priority: 2, dial: "US", voice: "broadcast",
    title: "Us",
    body:
      "Every FM station you've ever heard lives between 88 and 108 MHz, spaced 0.2 MHz apart. Signals like these slip through the ionosphere and leak into space. Seen from out there, Earth glows brighter on these channels than the sky behind it.",
    hear: "Synthesized stand-ins for broadcasts; no real stations play. Fine-tune and they peak on the odd tenths: 88.1, 88.3, 88.5.",
  },
  {
    id: "haslam", freqLabel: "408 MHz", kind: "point", f: 408, capture: 0.01, priority: 2, dial: "HASLAM 408", landmark: true,
    title: "The map of the radio sky",
    body:
      "In 1982, astronomers combined years of surveys from radio telescopes in Germany, England and Australia into the first map of the entire sky at 408 MHz. More than forty years later, it is still a foundation of sky models, including the one drawing this screen.",
    hear: "Static only. This is a landmark, not a broadcast.",
  },
  {
    id: "hydrogen", freqLabel: "1,420.4058 MHz", kind: "point", f: H_LINE, capture: 0.0045, priority: 5, dial: "HYDROGEN", voice: "hydrogen",
    special: "hi",
    title: "Hydrogen",
    body:
      "A hydrogen atom can flip the spin of its electron and give off a photon at exactly 1420.4058 MHz. Any one atom does it about once in 11 million years, but the galaxy holds so much hydrogen that the glow is everywhere. Mapping it in the 1950s revealed the Milky Way's spiral arms. In the US no station may transmit between 1400 and 1427 MHz, so astronomers can still hear it.",
    hear: "The hydrogen line itself, slowed by 22 octaves: 1420.4058 MHz becomes 338.65 Hz.",
  },
  {
    id: "waterhole", freqLabel: "1,420–1,662 MHz", kind: "band", lo: H_LINE, hi: 1662, edge: 0.003, priority: 2, dial: "WATER HOLE", voice: "waterhole",
    title: "The water hole",
    body:
      "Between the hydrogen line and the hydroxyl lines near 1665 MHz lies one of the quietest stretches of the radio sky. In 1971, SETI pioneers nicknamed it the water hole, because H plus OH makes water, and proposed it as the obvious place for civilizations to look for each other.",
    hear: "Hydrogen at 338.65 Hz and hydroxyl's twin lines at 397.06 and 397.53 Hz (1665 and 1667 MHz, slowed 22 octaves), beating once every 2.1 seconds.",
  },
  {
    id: "gps", freqLabel: "1,575.42 MHz", kind: "point", f: 1575.42, capture: 0.0035, priority: 4, dial: "GPS", voice: "gps",
    title: "GPS",
    body:
      "Every location fix on your phone starts with satellites broadcasting at 1575.42 MHz, inside the water hole. The signal reaches the ground weaker than the background noise; receivers dig it out by matching a code they already know.",
    hear: "The code of GPS satellite 1, slowed 512 times: 1,023 chips repeating every half second.",
  },
  {
    id: "maser", freqLabel: "22.235 GHz", kind: "point", f: 22235.08, capture: 0.006, priority: 3, dial: "WATER MASER", voice: "maser",
    title: "Water masers",
    body:
      "Near newborn stars and swollen old giants, clouds of water molecules amplify light the way a laser does. These masers blaze at 22.235 GHz, bright enough that radio telescopes use them to measure distances across the galaxy.",
    hear: "22.235 GHz slowed by 26 octaves to 331.33 Hz, flickering the way masers do.",
  },
  {
    id: "vapor", freqLabel: "23.8 GHz", kind: "point", f: 23800, capture: 0.004, priority: 2, dial: "WATER VAPOR", landmark: true,
    title: "Water vapor",
    body:
      "Weather satellites measure humidity by listening to water vapor near 23.8 GHz, inside a band where transmitting is banned. In 2019, forecasters warned that new 5G networks just above it, at 24 GHz, could leak into those readings.",
    hear: "Static only. This is a landmark, not a broadcast.",
  },
  {
    id: "co", freqLabel: "115.271 GHz", kind: "point", f: 115271.2018, capture: 0.006, priority: 3, dial: "CARBON MONOXIDE", voice: "co",
    title: "Carbon monoxide",
    body:
      "The cold clouds where stars form are mostly hydrogen molecules, which barely glow. Astronomers find them by their carbon monoxide instead, which shines at 115.271 GHz and again at almost exactly two, three and four times that frequency, like the overtones of a plucked string.",
    hear: "CO's first four lines slowed by 30 octaves: 107.35, 214.71, 322.05 and 429.38 Hz.",
  },
  {
    id: "cmb", freqLabel: "160.2 GHz", kind: "point", f: 160200, capture: 0.03, priority: 4, dial: "BIG BANG", voice: "cmb", special: "cmb",
    title: "The oldest light",
    body:
      "About 380,000 years after the Big Bang, the universe cooled enough for light to travel freely. That light has been stretched into microwaves and now glows at 2.725 K from every direction, brightest near 160 GHz. The speckles are differences of a few parts in 100,000: the seeds of every galaxy.",
    hear: "An even hiss. A small slice of the snow on old analog TVs was this glow; the popular figure is about 1%, though the exact share is debated.",
  },
  {
    id: "dust", freqLabel: "3 THz", kind: "point", f: 3e6, capture: 0.03, priority: 3, dial: "WARM DUST", voice: "dust",
    title: "Warm dust",
    body:
      "The glow here comes from grains of dust warmed by starlight to about 20 degrees above absolute zero, threading the galaxy's disk in wisps and filaments. Keep turning: just above, the radio model ends and real survey images take over.",
    hear: "Soft, airy noise. Dust glows across a wide range of frequencies, so there is no single line to sing.",
  },
];

// past 5 THz, every station is a real survey image
for (const sv of SURVEYS) {
  STATIONS.push({
    id: sv.key, kind: "point", f: sv.f, capture: 0.05, priority: 3, dial: sv.dial, voice: `survey:${sv.key}`,
    title: sv.title, body: sv.body, hear: surveyHearText(sv), freqLabel: sv.freqLabel, links: sv.links, survey: sv,
  });
}

for (const s of STATIONS) {
  if (s.kind === "point") s.logf = Math.log10(s.f);
  else {
    s.loLog = Math.log10(s.lo);
    s.hiLog = Math.log10(s.hi);
    s.logf = (s.loLog + s.hiLog) / 2;
    s.f = 10 ** s.logf;
  }
}

/** What the sky is doing between stations: shown when nothing is locked. f in MHz. */
export const REGIONS = [
  {
    lo: 15, hi: 600, freqLabel: "15–600 MHz",
    title: "The galaxy's radio glow",
    body:
      "Most of this light is synchrotron radiation: electrons flung out by exploding stars, spiraling through the galaxy's magnetic field at nearly the speed of light. The lower you tune, the brighter the sky. The loop climbing out of the disk just left of center is the North Polar Spur; astronomers still debate whether it's a nearby bubble blown by old supernovae or something far larger.",
  },
  {
    lo: 600, hi: 2000, freqLabel: "600 MHz – 2 GHz",
    title: "The quiet window",
    body:
      "Here the galaxy's glow sinks toward the faint afterglow of the Big Bang, and the Milky Way narrows to a bright seam. From the ground, this is the quietest stretch of the radio spectrum: above the galaxy's roar, below the hiss of our own atmosphere. Radio astronomers and SETI searches crowd in here.",
  },
  {
    lo: 2000, hi: 30000, freqLabel: "2–30 GHz",
    title: "Hot gas and the first speckles",
    body:
      "As the electrons fade, the disk is lit by free-free emission: electrons swerving past protons in the hot, ionized gas around newborn massive stars. Away from the disk, the galaxy is now fainter than the cosmic microwave background behind it. These maps subtract that background's average, and by about 20 GHz its speckles start to show through.",
  },
  {
    lo: 30000, hi: 300000, freqLabel: "30–300 GHz",
    title: "In front of the oldest light",
    body:
      "In this range the brightest glow in the sky is the cosmic microwave background, the cooled light of the Big Bang, the same in every direction to a few parts in 100,000. With its average subtracted, you see the galaxy as a thin band in front of it and the background's own ripples behind. The WMAP and Planck satellites mapped it here.",
  },
  {
    lo: 300000, hi: 5e6, freqLabel: "300 GHz – 5 THz",
    title: "Cold dust",
    body:
      "Above 300 GHz, the glow is heat from interstellar dust: grains of carbon and silicate smaller than a micron, warmed by starlight to about 20 degrees above absolute zero. It traces the same clouds where stars form. The faint wisps far from the disk are known as infrared cirrus.",
  },
  {
    lo: 5e6, hi: 4e8, freqLabel: "5–400 THz",
    title: "Infrared",
    body:
      "Heat. Everything warm glows at these frequencies: dust, stars, planets, people. Water vapor in our air absorbs much of it, so the best infrared maps were made from space. From here up, the sky you see is no longer a model: it's real survey images.",
  },
  {
    lo: 4e8, hi: 7.9e8, freqLabel: "400–790 THz",
    title: "Visible light",
    body:
      "The slice of the spectrum your eyes evolved for: less than one octave out of the 56 on this dial. Everything you have ever seen with your own eyes happened between these two numbers.",
  },
  {
    lo: 7.9e8, hi: 3.288e9, freqLabel: "790 THz – 3.3 PHz",
    title: "Ultraviolet",
    body:
      "The light of the hottest, youngest stars. The ozone layer stops most of it high above the ground, so ultraviolet astronomy had to wait for rockets and satellites.",
  },
  {
    lo: 3.288e9, hi: 2.9e10, freqLabel: "13.6–120 eV",
    title: "The hydrogen fog",
    body:
      "Above 13.6 electronvolts, light can knock the electron off a hydrogen atom, so the thin hydrogen between the stars swallows it. Beyond a few hundred light-years, the sky here is fog, and there is no map to show.",
  },
  {
    lo: 2.9e10, hi: 2.418e13, freqLabel: "0.12–100 keV",
    title: "X-rays",
    body:
      "Light from gas heated to millions of degrees and from matter falling onto neutron stars and black holes. Our atmosphere stops all of it, so the first X-ray source beyond the Sun was found only in 1962, by a detector carried above the air on a rocket.",
  },
  {
    lo: 2.418e13, hi: 2.418e16, freqLabel: "100 keV – 100 MeV",
    title: "The MeV gap",
    body:
      "These photons are too energetic to focus with mirrors and too rare to count quickly, so this stretch of the sky is barely mapped. Astronomers call it the MeV gap. The static is honest: there is no good picture here yet.",
  },
  {
    lo: 2.418e16, hi: 1.01e18, freqLabel: "Above 100 MeV",
    title: "Gamma rays",
    body:
      "The highest-energy light there is: cosmic rays slamming into gas, spinning neutron stars, and jets fired from black holes in distant galaxies.",
  },
];

/** The region of the spectrum containing f (MHz), or null below 15 MHz. */
export function regionAt(fMHz) {
  return REGIONS.find((r) => fMHz >= r.lo && fMHz < r.hi) || (fMHz >= 1e18 ? REGIONS[REGIONS.length - 1] : null);
}

/** Stations you can seek to with the buttons and arrow keys, in dial order. */
export const SEEKABLE = STATIONS.filter((s) => s.kind !== "zone")
  .map((s) => ({ s, at: s.kind === "band" ? (s.id === "fm" ? Math.log10(98.7) : s.logf) : s.logf }))
  .sort((a, b) => a.at - b.at);

/** Lock strength (0..1) of every station at log-frequency x. */
export function lockAt(s, x) {
  if (s.kind === "point") {
    const d = Math.abs(x - s.logf);
    const t = Math.min(1, Math.max(0, (d - 0.35 * s.capture) / (0.65 * s.capture)));
    return 1 - t * t * (3 - 2 * t);
  }
  const e = s.edge || 0.003;
  const inside = Math.min(x - s.loLog, s.hiLog - x);
  const t = Math.min(1, Math.max(0, (inside + e) / (2 * e)));
  return t * t * (3 - 2 * t);
}

export const OH_LINES = [1612.231, 1665.402, 1667.359, 1720.53];
export const CO_LINES = [115271.2018, 230538.0, 345795.9899, 461040.7682]; // MHz
export { OCT22 };
