// What people use the radio spectrum for (United States), and the bands kept silent.
// Frequencies in MHz. Simplified from the NTIA/FCC Table of Frequency Allocations.

export const HUMAN_BANDS = [
  { lo: 11.6, hi: 12.1, kind: "sw", label: "SW", name: "Shortwave radio" },
  { lo: 13.57, hi: 13.87, kind: "sw", label: "SW", name: "Shortwave radio" },
  { lo: 15.1, hi: 15.8, kind: "sw", label: "SW", name: "Shortwave radio" },
  { lo: 17.48, hi: 17.9, kind: "sw", label: "SW", name: "Shortwave radio" },
  { lo: 21.45, hi: 21.85, kind: "sw", label: "SW", name: "Shortwave radio" },
  { lo: 25.67, hi: 26.1, kind: "sw", label: "SW", name: "Shortwave radio" },
  { lo: 26.965, hi: 27.405, kind: "cb", label: "CB", name: "CB radio" },
  { lo: 28.0, hi: 29.7, kind: "ham", label: "HAM", name: "Ham radio" },
  { lo: 50.0, hi: 54.0, kind: "ham", label: "HAM", name: "Ham radio" },
  { lo: 54.0, hi: 72.0, kind: "tv", label: "TV", name: "Broadcast TV" },
  { lo: 76.0, hi: 88.0, kind: "tv", label: "TV", name: "Broadcast TV" },
  { lo: 88.0, hi: 108.0, kind: "fm", label: "FM", name: "FM radio" },
  { lo: 108.0, hi: 137.0, kind: "air", label: "AIR", name: "Aviation radio" },
  { lo: 144.0, hi: 148.0, kind: "ham", label: "HAM", name: "Ham radio" },
  { lo: 174.0, hi: 216.0, kind: "tv", label: "TV", name: "Broadcast TV" },
  { lo: 420.0, hi: 450.0, kind: "ham", label: "HAM", name: "Ham radio" },
  { lo: 470.0, hi: 608.0, kind: "tv", label: "TV", name: "Broadcast TV" },
  { lo: 617.0, hi: 698.0, kind: "cell", label: "CELL", name: "Cellular" },
  { lo: 698.0, hi: 806.0, kind: "cell", label: "CELL", name: "Cellular" },
  { lo: 824.0, hi: 894.0, kind: "cell", label: "CELL", name: "Cellular" },
  { lo: 1166.0, hi: 1187.0, kind: "gps", label: "GPS", name: "GPS" },
  { lo: 1217.0, hi: 1238.0, kind: "gps", label: "GPS", name: "GPS" },
  { lo: 1565.0, hi: 1586.0, kind: "gps", label: "GPS", name: "GPS" },
  { lo: 1710.0, hi: 1780.0, kind: "cell", label: "CELL", name: "Cellular" },
  { lo: 1850.0, hi: 1995.0, kind: "cell", label: "CELL", name: "Cellular" },
  { lo: 2110.0, hi: 2200.0, kind: "cell", label: "CELL", name: "Cellular" },
  { lo: 2400.0, hi: 2483.5, kind: "wifi", label: "WI-FI", name: "Wi-Fi and microwave ovens" },
  { lo: 2496.0, hi: 2690.0, kind: "cell", label: "CELL", name: "Cellular" },
  { lo: 2700.0, hi: 3000.0, kind: "radar", label: "RADAR", name: "Weather radar" },
  { lo: 3700.0, hi: 3980.0, kind: "cell", label: "5G", name: "5G" },
  { lo: 5150.0, hi: 5850.0, kind: "wifi", label: "WI-FI", name: "Wi-Fi" },
  { lo: 5925.0, hi: 7125.0, kind: "wifi", label: "WI-FI", name: "Wi-Fi" },
  { lo: 10700.0, hi: 12700.0, kind: "sat", label: "SATELLITE", name: "Satellite internet and TV" },
  { lo: 17700.0, hi: 20200.0, kind: "sat", label: "SATELLITE", name: "Satellite internet and TV" },
  { lo: 24250.0, hi: 25250.0, kind: "cell", label: "5G", name: "5G" },
  { lo: 27500.0, hi: 28350.0, kind: "cell", label: "5G", name: "5G" },
  { lo: 37000.0, hi: 40000.0, kind: "cell", label: "5G", name: "5G" },
  { lo: 76000.0, hi: 81000.0, kind: "radar", label: "CAR RADAR", name: "Car radar" },
  // past radio, people use light too (ranges from wavelengths and photon energies)
  { lo: 1.845e8, hi: 2.379e8, kind: "fiber", label: "FIBER", name: "Fiber-optic internet" }, // 1260-1625 nm
  { lo: 3.156e8, hi: 3.527e8, kind: "remote", label: "REMOTES", name: "TV remotes" }, // 850-950 nm
  { lo: 4.0e8, hi: 7.9e8, kind: "visible", label: "VISIBLE", name: "Visible light" }, // 380-750 nm
  { lo: 9.517e8, hi: 1.0707e9, kind: "uv", label: "UV-B", name: "Sunburn (UV-B)" }, // 280-315 nm
  { lo: 1.149e9, hi: 1.209e9, kind: "uv", label: "UV-C", name: "Germicidal lamps (UV-C)" }, // 248-261 nm
  { lo: 4.836e12, hi: 3.627e13, kind: "xray", label: "X-RAY", name: "Medical X-rays" }, // 20-150 keV
  { lo: 1.2e14, hi: 1.27e14, kind: "pet", label: "PET", name: "PET scans (511 keV)" },
];

// Footnote US246: "No station shall be authorized to transmit in the following bands."
export const SILENT_BANDS = [
  [73, 74.6], [608, 614], [1400, 1427], [1660.5, 1668.4], [2690, 2700], [4990, 5000],
  [10680, 10700], [15350, 15400], [23600, 24000], [31300, 31800], [50200, 50400],
  [52600, 54250], [86000, 92000], [100000, 102000], [109500, 111800], [114250, 116000],
  [148500, 151500], [164000, 167000], [182000, 185000], [190000, 191800], [200000, 209000],
  [226000, 231500], [250000, 252000],
].map(([lo, hi]) => ({ lo, hi }));

// Printed colours on the glass dial, and muted versions for the overview strip.
export const BAND_INK = {
  sw: "#6b4f2a", cb: "#7a5a2c", ham: "#5f5a2a", tv: "#5a3f36", fm: "#8a3424", air: "#6a5530",
  cell: "#3e5648", gps: "#2f5a5c", wifi: "#5d4060", radar: "#5a4a2c", sat: "#3a4d6a",
  fiber: "#2f5560", remote: "#6a3a2e", visible: "#5a4a3a", uv: "#4b3a6e", xray: "#3f4a56", pet: "#5c3a4c",
};

/** The visible band is printed as a spectrum: CSS-ready stops from red (low frequency) to violet. */
export const RAINBOW = ["#8b1a12", "#d8452a", "#f39a2c", "#f4dc3c", "#5fbf4a", "#2fa7a4", "#3b5fd0", "#6a3fc4"];

export const IONOSPHERE_MHZ = 15;

export function humanBandAt(fMHz) {
  let best = null;
  for (const b of HUMAN_BANDS) {
    if (fMHz >= b.lo && fMHz <= b.hi && (!best || b.hi - b.lo < best.hi - best.lo)) best = b;
  }
  return best;
}

export function silentBandAt(fMHz) {
  return SILENT_BANDS.find((b) => fMHz >= b.lo && fMHz <= b.hi) || null;
}
