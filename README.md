# Static

A portable radio that tunes the real sky, and a shelf of tapes recorded on other worlds.

**Live:** https://rohanctucker.github.io/static/

![Static, with a tape from Mars in the player](assets/og.jpg)

Turn the dial and the whole sky redraws itself as it really looks at that frequency, while the static
rises and falls with how bright that sky actually is. The dial starts at 10 MHz radio waves and keeps
going, through infrared and visible light to X-rays and gamma rays: 56 octaves of the electromagnetic
spectrum, of which human eyes see less than one.

Beside the sky sits a tape player with fifteen tapes of real recordings published by NASA. They
include the first sounds recorded on Mars, marsquakes, the Ingenuity helicopter in flight, a dust
devil passing over the Perseverance rover, radio from Jupiter's moon Ganymede, and the Artemis I
launch. Put a tape in, press play, and the sky marks where that planet was on the day it was recorded.

## The radio

Twenty-one stations sit on the dial. Among them are Jupiter's radio storms, the first pulsar ever
found, the hydrogen line, GPS and the afterglow of the Big Bang. Past them come real all-sky surveys:
IRAS, WISE, 2MASS, a photograph of the whole night sky, GALEX, ROSAT, INTEGRAL and Fermi. Lock onto a
station and you hear it, and a card explains what you're looking at. Between stations, the static is
as loud as the sky is bright.

## The tapes

The tapes sit on the shelf in the order they were recorded, from InSight's first wind in 2018 to the
Artemis I launch in 2022. Where NASA released two versions of a recording, like raw and filtered, or
a highlight reel and the full take, they are the two sides of one tape. Each tape's notes say where
and when it was recorded, and what NASA did to the sound before releasing it. They also say how far
away the planet was that day, in light-minutes. The series is called Light Minutes for that reason.

The player is an original design. Its door springs open in 3D, and its reels turn the way a
cassette's would at 4.76 cm a second. Its radio controls the sky: a wheel to tune, a Band button that
steps from radio to gamma rays, and keys that jump between stations.

## What's real

- **The maps are data.** Up to 5 THz they come from GSM2016, a model of the radio sky built from 29
  surveys, rendered straight from the authors' published data. Above that, each station is the
  survey team's own all-sky image, reprojected into the same map. That projection was checked
  against a real survey tile: Orion's belt lands within 0.6 arcminutes of where it belongs.
- **The temperatures and the static are data.** The static follows the median brightness of the
  whole sky at each frequency: about 265,000 K at 10 MHz, 25 K at 408 MHz and 3.6 K at the hydrogen
  line.
- **The tapes are real recordings,** as NASA published them. InSight's seismometer felt vibrations
  rather than sound in the air, so NASA sped its marsquakes up for human ears. The Ganymede tape is
  radio, shifted into hearing range. The player adds a moment of tape hiss before a recording starts,
  never over it.
- **The planet positions are calculated** from JPL's orbital elements, to about an arcminute. For
  example, Mars on Feb. 19, 2021 comes out 205 million km from Earth, 11 min 25 s away by radio.
- **The station sounds are translations.** Spectral lines are slowed by whole octaves, so their pitch
  ratios stay true: the hydrogen line at 1420.4058 MHz plays at 338.66 Hz. The pulsar keeps CP 1919's
  real period, and GPS plays the real code of satellite 1, slowed down. Jupiter and the FM band are
  synthesized stand-ins.

## Using it

| | |
|---|---|
| Drag the dial, or roll the player's tuning wheel | Tune across the spectrum |
| Click a station name, or press ◀◀ ▶▶ with the player on Radio | Jump between stations |
| **Band** on the player | Step through radio, microwave, infrared, visible, UV, X-rays and gamma rays |
| Click a tape on the shelf, then ▶ | Play it |
| **A/B** | Turn the tape over |
| ■ twice | Eject |
| Point at the sky | Read its temperature at that spot |

Every frequency and every tape has its own link: `#f=1420.406` opens on the hydrogen line, and
`#tape=lm06` loads the first sounds recorded on Mars.

## How it's built

Plain HTML, CSS and JavaScript modules, with no frameworks and no build step.

- `js/sky.js` draws the sky with WebGL, blending the two maps nearest your frequency.
- `js/surveys.js`, `js/hipsproj.js` and `js/reproject.worker.js` load each survey's HiPS image and
  reproject it into the galactic map, off the main thread.
- `js/dial.js` is the backlit dial. `js/audio.js` and `js/synth.js` build every station sound live
  with the Web Audio API.
- `js/player.js` is the tape player, drawn in SVG, with a canvas display. `js/cassette.js` draws the
  tapes, `js/shelf.js` the shelf and `js/foley.js` the clicks, door and motor.
- `js/tapes.js` lists the recordings, and `js/ephem.js` works out where each planet was.
- `tools/make_sky.py` renders the 147 radio maps from GSM2016.
- `tools/fetch_surveys.py` and `tools/fetch_tapes.py` keep local copies of the survey images and
  recordings.
- `hardware/static_knob` turns an Arduino and a potentiometer into a physical tuning knob, over Web
  Serial.

To run it locally, serve the folder with any web server, for example `python3 -m http.server 8000`,
and open http://localhost:8000.

## Credits

- Sky model: H. Zheng et al. (2017), "An improved model of diffuse galactic radio emission from 10 MHz to
  5 THz", MNRAS 464, 3486. Data and code: github.com/jeffzhen/gsm2016 (MIT License).
- Survey images: HiPS served by CDS, Strasbourg (Unistra/CNRS; HiPS under ODbL), with mirrors at
  NASA/IPAC IRSA and ESA. IRAS/IRIS: Miville-Deschênes & Lagache (2005), NASA/IPAC. AllWISE:
  NASA/JPL-Caltech/UCLA. 2MASS: University of Massachusetts and IPAC/Caltech, NASA, NSF. H-alpha:
  Finkbeiner (2003). Night sky: © 2000–2017 Axel Mellinger, all rights reserved, shown live from CDS and
  not redistributed. GALEX: NASA/Caltech. ROSAT: MPE. INTEGRAL: ESA. Fermi: NASA/DOE/Fermi LAT
  Collaboration.
- Tapes: NASA, "Sounds from Beyond" (nasa.gov/sounds-from-beyond). NASA audio is generally not subject to
  copyright in the United States. Each tape carries the credit NASA gives it. No endorsement by NASA is
  implied, and no NASA logos are used.
- Planet positions: E. M. Standish and J. G. Williams, "Approximate Positions of the Planets", JPL Solar
  System Dynamics.
- Spectrum allocations: NTIA, United States Frequency Allocations, and footnote US246.
- Type: Anybody (Etcetera Type Co.) and Newsreader (Production Type), SIL Open Font License.

Made by Rohan Tucker, 2026. Concept, direction and curation by Rohan. Built with Claude, an AI assistant
made by Anthropic, which wrote the code.
