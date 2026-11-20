// The tape shelf: one case per recording, spines out, in the order they were recorded.

import { TAPES, SERIES } from "./tapes.js";

export class Shelf {
  constructor(root, { onPick } = {}) {
    this.root = root;
    this.onPick = onPick;
    root.classList.add("shelf");
    let lastYear = "";
    const items = TAPES.map((t, i) => {
      const year = t.date.slice(0, 4);
      const first = year !== lastYear;
      lastYear = year;
      return `<li class="tape-slot${first ? " year-start" : ""}" data-year="’${year.slice(2)}">
        <button type="button" class="tape${t.first ? " is-first" : ""}" data-id="${t.id}"
          style="--spine:${t.m.spine};--ink:${t.m.spineInk};--i:${i}"
          aria-label="${t.cat}: ${t.title}. ${t.m.name}, ${t.when}${t.sides.length > 1 ? ". Two sides" : ""}">
          <span class="tape-face">
            <span class="tape-no">${String(t.no).padStart(2, "0")}</span>
            <span class="tape-name">${t.spine}</span>
          </span>
        </button>
      </li>`;
    }).join("");
    this.capHTML = `<b>${SERIES}</b> Real recordings from other worlds. Pick a tape.`;
    root.innerHTML = `
      <p class="shelf-cap" aria-hidden="true">${this.capHTML}</p>
      <div class="shelf-unit">
        <ul class="shelf-row">${items}</ul>
        <div class="shelf-board" aria-hidden="true"></div>
      </div>`;
    this.cap = root.querySelector(".shelf-cap");
    this.row = root.querySelector(".shelf-row");
    this.buttons = new Map([...root.querySelectorAll(".tape")].map((b) => [b.dataset.id, b]));

    for (const [id, b] of this.buttons) {
      const t = TAPES.find((x) => x.id === id);
      b.addEventListener("click", () => this.onPick && this.onPick(t));
      const show = () => this._tip(b, t);
      b.addEventListener("pointerenter", show);
      b.addEventListener("focus", show);
      b.addEventListener("pointerleave", () => this._tip(null));
      b.addEventListener("blur", () => this._tip(null));
    }
  }

  /** The caption over the shelf names whichever tape you're pointing at. */
  _tip(b, t) {
    this.cap.innerHTML = b ? `<b>${t.cat}</b> ${t.title}. ${t.m.name}, ${t.when}.` : this.capHTML;
  }

  /** The spine's box on screen, for the flight to and from the player. */
  rect(id) {
    const b = this.buttons.get(id);
    return b ? b.getBoundingClientRect() : null;
  }

  /** Mark a tape as out of its case (in the player) or back. */
  setOut(id, out) {
    const b = this.buttons.get(id);
    if (!b) return;
    b.classList.toggle("is-out", out);
    if (out) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  }

  /** Draw the eye to the shelf when someone presses play with nothing in the player. */
  nudge() {
    this.root.classList.remove("nudge");
    void this.root.offsetWidth;
    this.root.classList.add("nudge");
  }
}
