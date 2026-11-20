// A cassette, drawn in millimetres (100 × 64): shell, label, window, reels.
// The reels are classed so the player can turn them and grow the tape packs.

import { SERIES } from "./tapes.js";

let uid = 0;

export const HUB_L = [28.5, 24.2];
export const HUB_R = [71.5, 24.2];
export const PACK_MIN = 6.1; // radius of an empty hub, mm
export const PACK_MAX = 15.6; // radius of a full pack

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function hub(cls, [cx, cy], color) {
  const teeth = Array.from({ length: 6 }, (_, k) =>
    `<rect x="${cx - 0.55}" y="${cy - 3.45}" width="1.1" height="1.35" rx="0.2" fill="${color}" transform="rotate(${k * 60} ${cx} ${cy})"/>`).join("");
  return `<g class="${cls}" transform="rotate(0 ${cx} ${cy})">
    <circle cx="${cx}" cy="${cy}" r="5.5" fill="${color}"/>
    <circle cx="${cx}" cy="${cy}" r="5.5" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="0.35"/>
    <circle cx="${cx}" cy="${cy}" r="3.45" fill="#121216"/>
    ${teeth}
    <rect x="${cx - 0.35}" y="${cy + 3.6}" width="0.7" height="1.4" fill="rgba(0,0,0,0.22)"/>
  </g>`;
}

function screw(x, y) {
  return `<circle cx="${x}" cy="${y}" r="1.35" fill="rgba(0,0,0,0.28)"/>
    <circle cx="${x}" cy="${y}" r="1.05" fill="#b9b6ae"/>
    <path d="M${x - 0.7} ${y}h1.4M${x} ${y - 0.7}v1.4" stroke="#6f6c66" stroke-width="0.32"/>`;
}

/**
 * SVG markup for a tape, showing side 0 (A) or 1 (B). `blank` marks a side with nothing on it.
 * Pack radii start at an empty take-up reel; the player updates them as the tape moves.
 */
export function cassetteSVG(tape, sideIdx = 0) {
  const id = `cs${++uid}`;
  const m = tape.m;
  const side = tape.sides[sideIdx];
  const letter = sideIdx === 0 ? "A" : "B";
  const sideName = side ? (tape.sides.length > 1 ? side.name : "") : "Blank";
  const shellOpacity = m.clear ? 0.82 : 1;
  const meta = `${tape.cat}  ${tape.stamp}`;
  return `<svg class="cassette" viewBox="0 0 100 64" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${m.shell}"/>
      <stop offset="1" stop-color="${m.shellShade}"/>
    </linearGradient>
    <linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6f1e4"/>
      <stop offset="1" stop-color="#e9e1cd"/>
    </linearGradient>
    <radialGradient id="${id}p">
      <stop offset="0.35" stop-color="#4a3427"/>
      <stop offset="0.8" stop-color="#33241b"/>
      <stop offset="1" stop-color="#21170f"/>
    </radialGradient>
    <clipPath id="${id}w"><rect x="17.8" y="16.4" width="64.4" height="15.6" rx="7.8"/></clipPath>
  </defs>
  <rect x="0.4" y="0.4" width="99.2" height="63.2" rx="3.3" fill="url(#${id}s)" opacity="${shellOpacity}"/>
  <rect x="0.4" y="0.4" width="99.2" height="63.2" rx="3.3" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="0.45"/>
  <path d="M13.6 63.6 L18.1 47.6 Q18.5 46.5 19.7 46.5 L80.3 46.5 Q81.5 46.5 81.9 47.6 L86.4 63.6 Z" fill="rgba(0,0,0,0.18)"/>
  <path d="M18.6 47.2 H81.4" stroke="rgba(255,255,255,0.14)" stroke-width="0.4"/>
  <circle cx="26" cy="57.4" r="1.75" fill="#0b0b0d"/>
  <circle cx="74" cy="57.4" r="1.75" fill="#0b0b0d"/>
  <rect x="43.4" y="53.6" width="13.2" height="10" rx="1" fill="#0b0b0d"/>
  <rect x="33.2" y="55.4" width="4.4" height="4.2" rx="0.6" fill="#0b0b0d"/>
  <rect x="62.4" y="55.4" width="4.4" height="4.2" rx="0.6" fill="#0b0b0d"/>
  ${screw(3.4, 3.6)}${screw(96.6, 3.6)}${screw(3.4, 60.6)}${screw(96.6, 60.6)}${screw(50, 50.4)}
  <rect x="6" y="3.4" width="88" height="39" rx="1.8" fill="url(#${id}l)"/>
  <rect x="6" y="33.6" width="88" height="5" fill="${m.stripe}"/>
  <rect x="6" y="38.6" width="88" height="1.5" fill="${m.stripe2}"/>
  <path d="M6 40.1 H94 V40.6 Q94 42.4 92.2 42.4 H7.8 Q6 42.4 6 40.6 Z" fill="#efe8d6"/>
  <rect x="17.2" y="15.8" width="65.6" height="16.8" rx="8.4" fill="rgba(0,0,0,0.25)"/>
  <g clip-path="url(#${id}w)">
    <rect x="17" y="15" width="66" height="18" fill="#17171b"/>
    <path d="M17 29.5 H83" stroke="rgba(255,255,255,0.05)" stroke-width="2.4"/>
    <circle class="cs-pack cs-packL" cx="${HUB_L[0]}" cy="${HUB_L[1]}" r="${PACK_MAX}" fill="url(#${id}p)"/>
    <circle class="cs-pack cs-packR" cx="${HUB_R[0]}" cy="${HUB_R[1]}" r="${PACK_MIN}" fill="url(#${id}p)"/>
    ${hub("cs-hub cs-hubL", HUB_L, m.hub)}
    ${hub("cs-hub cs-hubR", HUB_R, m.hub)}
    <rect x="17" y="15" width="66" height="6.5" fill="rgba(255,255,255,0.07)"/>
  </g>
  <rect x="17.8" y="16.4" width="64.4" height="15.6" rx="7.8" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="0.5"/>
  <text class="cs-side" x="8.6" y="13.6">${letter}</text>
  <text class="cs-title" x="17.2" y="12.6">${esc(tape.spine)}</text>
  <text class="cs-series" x="92.4" y="7.9" text-anchor="end">${esc(SERIES.toUpperCase())}</text>
  <text class="cs-meta" x="8.6" y="37.4">${esc(meta)}</text>
  <text class="cs-meta" x="91.6" y="37.4" text-anchor="end">${esc(sideName.toUpperCase())}</text>
</svg>`;
}

/** The empty bay behind the door: reel spindles, the head and the pinch roller. */
export const BAY_SVG = `<svg class="bay-art" viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <radialGradient id="bayg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#2a2d35"/><stop offset="1" stop-color="#121318"/>
    </radialGradient>
  </defs>
  <rect width="100" height="64" fill="url(#bayg)"/>
  ${[HUB_L, HUB_R].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.2" fill="#0c0d10"/>
    <circle cx="${x}" cy="${y}" r="2.8" fill="#d9d6ce"/><circle cx="${x}" cy="${y}" r="1" fill="#6c6a64"/>`).join("")}
  <rect x="42.5" y="49" width="15" height="9" rx="1.6" fill="#a9acb3"/>
  <rect x="44" y="50.3" width="12" height="1.2" fill="#6f737b"/>
  <circle cx="34" cy="55" r="3.3" fill="#0b0b0d"/><circle cx="34" cy="55" r="1" fill="#55575c"/>
  <circle cx="66" cy="55" r="1.1" fill="#c6c8cc"/>
  <path d="M8 62 H92" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
</svg>`;
