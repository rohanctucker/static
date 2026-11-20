// The tape shelf: real recordings from NASA's "Sounds from Beyond" page, one tape each,
// in the order they were recorded. Where NASA released two versions (raw and filtered,
// a highlight and the full take), they're the two sides of the same tape.
//
// Every `file`/`url` pair below sits on one line: tools/fetch_tapes.py reads them from here.

export const SERIES = "Light Minutes";
export const SOURCE_PAGE = "https://www.nasa.gov/sounds-from-beyond/";

// label colours for each mission: J-card spine, label stripe, cassette shell
export const MISSIONS = {
  insight: {
    name: "InSight", place: "Elysium Planitia, Mars",
    spine: "#c98b3a", spineInk: "#22170b", stripe: "#c98b3a", stripe2: "#e2b56d",
    shell: "#e9e6de", shellShade: "#c6c0b3", hub: "#f6f3ec",
  },
  perseverance: {
    name: "Perseverance", place: "Jezero Crater, Mars",
    spine: "#b5432a", spineInk: "#fbeee0", stripe: "#b5432a", stripe2: "#e07a52",
    shell: "#3b3e46", shellShade: "#25272d", hub: "#f2efe8",
  },
  juno: {
    name: "Juno", place: "Passing Ganymede, at Jupiter",
    spine: "#dcc396", spineInk: "#3a2416", stripe: "#8a5a3b", stripe2: "#dcc396",
    shell: "#1d1e22", shellShade: "#0e0f11", hub: "#efe9dc",
  },
  artemis: {
    name: "Artemis I", place: "Launch Complex 39B, Florida",
    spine: "#2f6db5", spineInk: "#f4f2ec", stripe: "#2f6db5", stripe2: "#8db8e8",
    shell: "#7ea3d4", shellShade: "#4f739f", hub: "#f4f2ec", clear: true,
  },
};

export const TAPES = [
  {
    id: "lm01", mission: "insight", body: "mars", date: "2018-12-01T12:00Z", when: "Dec. 1, 2018", stamp: "DEC 1 2018",
    title: "Wind in the solar panels", spine: "Wind in the panels",
    instrument: "InSight's seismometer, still on the lander's deck",
    notes:
      "Five days after landing, wind of 5 to 7 meters per second rolled over InSight's solar panels. The panels shook, and the seismometer sitting on the deck felt it. These were the first sounds of Martian wind anyone had heard.",
    sides: [
      { name: "Raw", how: "The seismometer's data, released unaltered. It is very low: use headphones.",
        credit: "NASA/JPL-Caltech/CNES/UKSA/Imperial College London/Oxford/ETH",
        file: "lm01a", url: "https://www.nasa.gov/wp-content/uploads/2015/01/06-MASTERRESAMPLED-48Kraw_velocity_0.6_normalisedx1.wav" },
      { name: "Two octaves up", how: "The same data, raised two octaves so laptop and phone speakers can play it.",
        credit: "NASA/JPL-Caltech/CNES/IPGP/Imperial College London/Oxford",
        file: "lm01b", url: "https://www.nasa.gov/wp-content/uploads/2015/01/08-Brian-Cook_raw_velocity_0.6_normalisedx1_2octavesUp_03.wav" },
    ],
  },
  {
    id: "lm02", mission: "insight", body: "mars", date: "2019-03-06T12:00Z", when: "Sol 98, March 6, 2019", stamp: "SOL 98",
    title: "The robotic arm", spine: "Robotic arm",
    instrument: "InSight's seismometer, on the ground",
    notes:
      "InSight's seismometer felt the lander's own robotic arm moving as the arm's camera scanned the ground. Gusts of wind come through too, and the little dinks the seismometer makes as its parts shift.",
    sides: [
      { name: "Side A", how: "Vibrations, not sound in the air: NASA sped them up and processed them so you can hear them.",
        credit: "NASA/JPL-Caltech",
        file: "lm02a", url: "https://www.nasa.gov/wp-content/uploads/2015/01/20190819-Sol-98-SEIS-Spatialized-reflective.wav" },
    ],
  },
  {
    id: "lm03", mission: "insight", body: "mars", date: "2019-05-22T12:00Z", when: "Sol 173, May 22, 2019", stamp: "SOL 173",
    title: "A magnitude 3.7 marsquake", spine: "Marsquake 3.7",
    instrument: "InSight's seismometer",
    notes:
      "A rumble of about magnitude 3.7. NASA says this quake and the next one on the shelf suggest the Martian crust is something like a mix of Earth's crust and the Moon's.",
    sides: [
      { name: "Side A", how: "Far below the range of hearing, so NASA sped it up and lightly processed it.",
        credit: "NASA/JPL-Caltech",
        file: "lm03a", url: "https://www.nasa.gov/wp-content/uploads/2015/01/Quake-Sol-173.wav" },
    ],
  },
  {
    id: "lm04", mission: "insight", body: "mars", date: "2019-07-16T12:00Z", when: "Sol 226, July 16, 2019", stamp: "SOL 226",
    title: "Dinks and donks", spine: "Dinks and donks",
    instrument: "InSight's seismometer",
    notes:
      "Just after sundown the seismometer cools, its parts contract and rub, and it makes these noises. The team nicknamed them dinks and donks, and isn't entirely sure what causes each one.",
    sides: [
      { name: "Side A", how: "Vibrations recorded by the seismometer, processed so you can hear them.",
        credit: "NASA/JPL-Caltech",
        file: "lm04a", url: "https://www.nasa.gov/wp-content/uploads/2015/01/Cropped-Dinks-and-Donks-sample.wav" },
    ],
  },
  {
    id: "lm05", mission: "insight", body: "mars", date: "2019-07-25T12:00Z", when: "Sol 235, July 25, 2019", stamp: "SOL 235",
    title: "A magnitude 3.3 marsquake", spine: "Marsquake 3.3",
    instrument: "InSight's seismometer",
    notes:
      "A smaller quake two months later. Listen to the end: NASA notes that this one turns particularly bass-heavy as it fades.",
    sides: [
      { name: "Side A", how: "Far below the range of hearing, so NASA sped it up and lightly processed it.",
        credit: "NASA/JPL-Caltech",
        file: "lm05a", url: "https://www.nasa.gov/wp-content/uploads/2015/01/Quake-Sol-235.wav" },
    ],
  },
  {
    id: "lm06", mission: "perseverance", body: "mars", date: "2021-02-19T12:00Z", when: "Sol 1, Feb. 19, 2021", stamp: "SOL 1",
    title: "First sounds", spine: "First sounds", first: true,
    instrument: "SuperCam's microphone, with the mast still folded down",
    notes:
      "About 18 hours after landing, before the rover had raised its mast, SuperCam's microphone switched on. It sounds like a seashell held to your ear: a muffled hush, and a little wind. NASA calls it the first audio recording of sounds on Mars.",
    sides: [
      { name: "Side A", how: "",
        credit: "NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero",
        file: "lm06a", url: "https://www.nasa.gov/wp-content/uploads/2024/05/scam-mic-sol001-run001.wav" },
    ],
  },
  {
    id: "lm07", mission: "perseverance", body: "mars", date: "2021-02-20T12:00Z", when: "Feb. 20, 2021", stamp: "FEB 20 2021",
    title: "Sixty seconds of Jezero", spine: "Sixty seconds",
    instrument: "The microphone on the rover's side, built to record the landing",
    notes:
      "This off-the-shelf microphone was added to hear the landing, and got nothing usable on the way down. Two days later it recorded a minute of Jezero Crater. Side A keeps the rover's own whirring; on side B NASA filtered most of it out, and a gust of wind comes through about ten seconds in.",
    sides: [
      { name: "With the rover's hum", how: "As recorded, rover noise and all.",
        credit: "NASA/JPL-Caltech",
        file: "lm07a", url: "https://www.nasa.gov/wp-content/uploads/2024/05/sounds-from-mars-includes-rover-self-noise.wav" },
      { name: "Filtered", how: "Filtered by NASA to quiet the rover's own noise.",
        credit: "NASA/JPL-Caltech",
        file: "lm07b", url: "https://www.nasa.gov/wp-content/uploads/2024/05/sounds-from-mars-filters-out-rover-self-noise.wav" },
    ],
  },
  {
    id: "lm08", mission: "perseverance", body: "mars", date: "2021-02-22T12:00Z", when: "Sol 4, Feb. 22, 2021", stamp: "SOL 4",
    title: "Wind", spine: "Wind",
    instrument: "SuperCam's microphone, mast raised",
    notes:
      "Three sols later the mast was up and the microphone was out in the open air. Listen around 20 seconds in for the wind.",
    sides: [
      { name: "Side A", how: "NASA removed the rover's background sounds.",
        credit: "NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero",
        file: "lm08a", url: "https://www.nasa.gov/wp-content/uploads/2024/05/scam-mic-sol004-run001.wav" },
    ],
  },
  {
    id: "lm09", mission: "perseverance", body: "mars", date: "2021-03-02T12:00Z", when: "Sol 12, March 2, 2021", stamp: "SOL 12",
    title: "Thirty laser shots", spine: "Laser shots",
    instrument: "SuperCam's microphone",
    notes:
      "SuperCam studies rocks by zapping them with a laser and listening. These are 30 shots at a rock named Máaz, the Navajo word for Mars, 3.1 meters away. How loud each snap is says something about the rock: how hard it is, or whether it has a weathered coating.",
    sides: [
      { name: "Side A", how: "",
        credit: "NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero",
        file: "lm09a", url: "https://www.nasa.gov/wp-content/uploads/2024/05/scam-mic-sol012-run001.wav" },
    ],
  },
  {
    id: "lm10", mission: "perseverance", body: "mars", date: "2021-03-07T00:00Z", when: "Sol 16, March 2021", stamp: "SOL 16",
    title: "Driving", spine: "Driving",
    instrument: "The microphone on the rover's side",
    notes:
      "The rover's wheels and suspension working over rock, plus a high-pitched scratching the engineers were still trying to explain: interference from an electronics box, or the wheels against the ground. This microphone was never meant to work on the surface.",
    sides: [
      { name: "Highlights", how: "Three stretches of the full recording, joined into 90 seconds and filtered to cut some noise.",
        credit: "NASA/JPL-Caltech",
        file: "lm10a", url: "https://www.nasa.gov/wp-content/uploads/2024/05/filtered-highlights-sol16roverdrivehighlights.wav" },
      { name: "All 16 minutes", how: "Raw and unfiltered.",
        credit: "NASA/JPL-Caltech",
        file: "lm10b", url: "https://www.nasa.gov/wp-content/uploads/2024/05/raw-audio-mic-00000008-000-001011.wav" },
    ],
  },
  {
    id: "lm11", mission: "perseverance", body: "mars", date: "2021-04-30T15:00Z", when: "April 30, 2021", stamp: "APR 30 2021",
    title: "A helicopter on Mars", spine: "Ingenuity",
    instrument: "SuperCam's microphone, 80 meters from the helicopter",
    notes:
      "The first time a spacecraft on another planet recorded the sound of another spacecraft. The Ingenuity helicopter was on its fourth flight, blades spinning at 2,537 rpm, but the thin air muffles them to a faint hum under the wind.",
    sides: [
      { name: "Side A", how: "NASA isolated the blades' 84 Hz hum, cut everything below 80 and above 90 Hz, and turned up what was left.",
        credit: "NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaéro",
        file: "lm11a", url: "https://www.nasa.gov/wp-content/uploads/2024/05/jpl-20210506-listen-to-nasas-ingenuity-helicopter-as-it-flies-on-mars.wav" },
    ],
  },
  {
    id: "lm12", mission: "juno", body: "jupiter", date: "2021-06-07T17:00Z", when: "June 7, 2021", stamp: "JUN 7 2021",
    title: "Passing Ganymede", spine: "Ganymede",
    instrument: "Juno's Waves instrument",
    notes:
      "Not a microphone this time: radio. As Juno flew past Ganymede, Jupiter's largest moon, its Waves instrument picked up radio emissions between 10 and 50 kHz, hundreds of times lower than the bottom of this dial. Around the halfway mark the pitch jumps, as Juno enters a different region of Ganymede's magnetosphere.",
    sides: [
      { name: "Side A", how: "Radio emissions shifted down into the range of hearing.",
        credit: "NASA/JPL-Caltech/SwRI/Univ of Iowa",
        file: "lm12a", url: "https://www.nasa.gov/wp-content/uploads/2024/05/e2-wave-ganymede-flyby-compressed.wav" },
    ],
  },
  {
    id: "lm13", mission: "perseverance", body: "mars", date: "2021-09-27T12:00Z", when: "Sol 215, Sept. 27, 2021", stamp: "SOL 215",
    title: "A dust devil", spine: "Dust devil",
    instrument: "SuperCam's microphone",
    notes:
      "A dust devil about 25 meters across passed straight over the rover, and for the first time the microphone was on when one did. It's switched on for only a couple of minutes, about eight times a month. Listen for wind, a lull as the calm center passes, then wind again, and the ticks of 308 dust grains hitting the rover.",
    sides: [
      { name: "Side A", how: "",
        credit: "NASA/JPL-Caltech/LANL/CNES/CNRS/INTA-CSIC/Space Science Institute/ISAE-Supaero",
        file: "lm13a", url: "https://www.nasa.gov/wp-content/uploads/2024/05/pia25657.wav" },
    ],
  },
  {
    id: "lm14", mission: "perseverance", body: "mars", date: "2022-02-09T12:00Z", when: "Sol 346, Feb. 9, 2022", stamp: "SOL 346",
    title: "Puffs and pings", spine: "Puffs and pings",
    instrument: "A microphone on the rover's body",
    notes:
      "Before studying a rock, Perseverance blows the dust off it with nitrogen gas from its Gaseous Dust Removal Tool. These are its puffs, and the pings of the tool at work.",
    sides: [
      { name: "Raw", how: "As recorded.",
        credit: "NASA/JPL-Caltech",
        file: "lm14a", url: "https://www.nasa.gov/wp-content/uploads/2024/05/em-0346-edlc-mic-gdrt-session-34.wav" },
      { name: "Filtered", how: "Filtered by NASA.",
        credit: "NASA/JPL-Caltech",
        file: "lm14b", url: "https://www.nasa.gov/wp-content/uploads/2024/05/em-0346-edlc-mic-gdrt-session-34-filtered.wav" },
    ],
  },
  {
    id: "lm15", mission: "artemis", body: "earth", date: "2022-11-16T06:47Z", when: "Nov. 16, 2022", stamp: "NOV 16 2022",
    title: "Liftoff", spine: "Liftoff",
    instrument: "NASA's audio of the launch",
    notes:
      "The one tape recorded on Earth. At 1:47 a.m. Eastern, NASA's Space Launch System lifted off for the first time, sending the uncrewed Orion spacecraft around the Moon. Side B is launch commentator Derrol Nail as the rocket rose.",
    sides: [
      { name: "Liftoff", how: "",
        credit: "NASA",
        file: "lm15a", url: "https://www.nasa.gov/wp-content/uploads/2023/02/liftoff1.mp3" },
      { name: "We rise together", how: "",
        credit: "NASA",
        file: "lm15b", url: "https://www.nasa.gov/wp-content/uploads/2023/02/we-rise-together1.mp3" },
    ],
  },
];

TAPES.forEach((t, i) => {
  t.no = i + 1;
  t.cat = `LM ${String(i + 1).padStart(2, "0")}`;
  t.m = MISSIONS[t.mission];
  t.ms = Date.parse(t.date);
});

/** "1:05", "16:02" */
export function clock(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s - m * 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
