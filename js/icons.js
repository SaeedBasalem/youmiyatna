// يومياتنا — hand-tuned line icons. Stroke follows currentColor, so they inherit
// the palette (and the living theme) everywhere they are used.
const P = {
  home:    "M4 11.2 12 4.5l8 6.7M6.2 9.8V19a1 1 0 0 0 1 1h3.1v-4.3h3.4V20h3.1a1 1 0 0 0 1-1V9.8",
  book:    "M12 6.4S10.2 5 7.2 5H4v13h3.2c3 0 4.8 1.4 4.8 1.4m0-13S13.8 5 16.8 5H20v13h-3.2c-3 0-4.8 1.4-4.8 1.4m0-13v13",
  chat:    "M20 12.2c0 3.6-3.6 6.5-8 6.5-1 0-2-.15-2.9-.42L4.6 20l1.2-3.3C4.66 15.5 4 13.93 4 12.2 4 8.6 7.6 5.7 12 5.7s8 2.9 8 6.5Z",
  dice:    { d: "M5 8.4A3.4 3.4 0 0 1 8.4 5h7.2A3.4 3.4 0 0 1 19 8.4v7.2a3.4 3.4 0 0 1-3.4 3.4H8.4A3.4 3.4 0 0 1 5 15.6Z", dots: [[9, 9, 1.15], [15, 15, 1.15], [12, 12, 1.15]] },
  heart:   "M12 19.6s-7.2-4.4-7.2-9.2a4.2 4.2 0 0 1 7.2-2.8 4.2 4.2 0 0 1 7.2 2.8c0 4.8-7.2 9.2-7.2 9.2Z",
  search:  "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm5.2.2L21 21",
  plus:    "M12 5.5v13M5.5 12h13",
  close:   "M6.5 6.5l11 11M17.5 6.5l-11 11",
  back:    "M14 6l-6 6 6 6",
  fwd:     "M10 6l6 6-6 6",
  gear:    "M12 15.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Zm8-3.2-.05.9 1.6 1.3-1.4 2.4-2-.7-1.4.9-.35 2.1h-2.8l-.35-2.1-1.4-.9-2 .7-1.4-2.4 1.6-1.3L10 12l.05-.9-1.6-1.3 1.4-2.4 2 .7 1.4-.9L13.6 5h2.8",
  star:    "M12 4.8l2.2 4.6 5 .7-3.6 3.5.85 5-4.45-2.35L7.55 18.6l.85-5L4.8 10.1l5-.7Z",
  camera:  "M4.5 9.4A2 2 0 0 1 6.5 7.4h1.6L9.4 5.4h5.2l1.3 2h1.6a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2Zm7.5 8.1a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2Z",
  mic:     "M12 4.8a2.4 2.4 0 0 1 2.4 2.4v4.6a2.4 2.4 0 0 1-4.8 0V7.2A2.4 2.4 0 0 1 12 4.8ZM6.6 11.4a5.4 5.4 0 0 0 10.8 0M12 16.8V20",
  send:    "M20 4.6 3.8 11.2l6.1 2.2M20 4.6l-4.3 15-3.5-6.1M20 4.6 9.9 13.4",
  play:    "M8 5.6 19 12 8 18.4Z",
  pause:   "M9 5.6v12.8M15 5.6v12.8",
  image:   "M4.5 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2Zm0 8.5 4-3.6 3.2 2.8 3.4-3.4 4.4 4M9 10.4a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Z",
  calendar:"M5 8.6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9.4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2ZM5 11h14M8.6 4.5v3.6M15.4 4.5v3.6",
  pin:     "M12 20.5s6-5.4 6-9.7a6 6 0 1 0-12 0c0 4.3 6 9.7 6 9.7Zm0-7.6a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6Z",
  brush:   "M14.8 5.8 18.2 9.2 9.6 17.8l-4.4 1 1-4.4ZM13.2 7.4l3.4 3.4",
  sparkle: "M12 4.6l1.5 4.4 4.4 1.5-4.4 1.5L12 16.4l-1.5-4.4-4.4-1.5 4.4-1.5ZM18.6 15.4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z",
  download:"M12 4.8v9.6m0 0 3.6-3.6M12 14.4l-3.6-3.6M5 17.2v.8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-.8",
  check:   "M5.5 12.5 10 17l8.5-9.5",
  trash:   "M5.8 7.4h12.4M9.6 7.4V5.8h4.8v1.6M7.4 7.4l.7 11.2a1.4 1.4 0 0 0 1.4 1.3h5a1.4 1.4 0 0 0 1.4-1.3l.7-11.2",
  moon:    "M19 13.6A7.4 7.4 0 1 1 10.4 5a5.9 5.9 0 0 0 8.6 8.6Z",
  sun:     "M12 16.4a4.4 4.4 0 1 1 0-8.8 4.4 4.4 0 0 1 0 8.8ZM12 3v2.1M12 18.9V21M3 12h2.1M18.9 12H21M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5",
  filter:  "M4.6 6.4h14.8M7.4 12h9.2M10 17.6h4",
};
export const ICON_NAMES = Object.keys(P);
const NS = "http://www.w3.org/2000/svg";
// filled icons read better at small sizes for these
const FILLED = new Set(["play"]);

export function icon(name, { size = 24, stroke = 1.7, cls = "" } = {}) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size); svg.setAttribute("height", size);
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (cls) svg.setAttribute("class", cls);
  const spec = P[name] || P.sparkle;
  const d = typeof spec === "string" ? spec : spec.d;
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", d);
  if (FILLED.has(name)) { path.setAttribute("fill", "currentColor"); }
  else {
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", stroke);
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
  }
  svg.appendChild(path);
  for (const [cx, cy, r] of (spec.dots || [])) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", r);
    c.setAttribute("fill", "currentColor");
    svg.appendChild(c);
  }
  return svg;
}
