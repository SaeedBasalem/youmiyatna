// يومياتنا — small hand-built illustrations for empty states.
// Declared as shape lists (not markup strings) so nothing is ever parsed as HTML.
const NS = "http://www.w3.org/2000/svg";

const SCENES = {
  journal: { vb: "0 0 120 96", shapes: [
    { t: "path", d: "M60 26c-8-6-18-8-28-7v52c10-1 20 1 28 7 8-6 18-8 28-7V19c-10-1-20 1-28 7Z", fill: "soft" },
    { t: "path", d: "M60 26c-8-6-18-8-28-7v52c10-1 20 1 28 7m0-52c8-6 18-8 28-7v52c-10-1-20 1-28 7m0-52v52", stroke: "line", w: 2.4 },
    { t: "path", d: "M60 78c0-6 5-10 10-10 4 0 7 3 7 7 0 6-9 11-17 15-8-4-17-9-17-15 0-4 3-7 7-7 5 0 10 4 10 10Z", fill: "accent", op: .9 },
    { t: "circle", cx: 26, cy: 16, r: 2.4, fill: "accent", op: .5 },
    { t: "circle", cx: 96, cy: 26, r: 1.8, fill: "accent", op: .35 },
  ] },
  letters: { vb: "0 0 120 96", shapes: [
    { t: "path", d: "M22 32h76v42a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6Z", fill: "soft" },
    { t: "path", d: "M22 32h76v42a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6Zm0 0 38 26 38-26", stroke: "line", w: 2.4 },
    { t: "circle", cx: 60, cy: 30, r: 9, fill: "accent", op: .9 },
    { t: "path", d: "M60 34c0-3 2.4-5 5-5 2 0 3.4 1.5 3.4 3.4 0 3-4.4 5.4-8.4 7.4-4-2-8.4-4.4-8.4-7.4 0-1.9 1.4-3.4 3.4-3.4 2.6 0 5 2 5 5Z", fill: "bg", op: .95 },
  ] },
  album: { vb: "0 0 120 96", shapes: [
    { t: "path", d: "M20 24a6 6 0 0 1 6-6h68a6 6 0 0 1 6 6v48a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6Z", fill: "soft" },
    { t: "path", d: "M20 24a6 6 0 0 1 6-6h68a6 6 0 0 1 6 6v48a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6Z", stroke: "line", w: 2.4 },
    { t: "path", d: "M20 64l20-18 14 12 16-16 30 26", stroke: "accent", w: 2.6 },
    { t: "circle", cx: 40, cy: 36, r: 5, fill: "accent", op: .8 },
  ] },
  search: { vb: "0 0 120 96", shapes: [
    { t: "circle", cx: 54, cy: 42, r: 22, fill: "soft" },
    { t: "circle", cx: 54, cy: 42, r: 22, stroke: "line", w: 2.6 },
    { t: "path", d: "M70 58 88 76", stroke: "line", w: 3.2 },
    { t: "path", d: "M44 40h20M44 48h13", stroke: "accent", w: 2.4 },
  ] },
  chat: { vb: "0 0 120 96", shapes: [
    { t: "path", d: "M18 34a8 8 0 0 1 8-8h38a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H36l-12 9v-9a6 6 0 0 1-6-6Z", fill: "soft" },
    { t: "path", d: "M18 34a8 8 0 0 1 8-8h38a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H36l-12 9v-9a6 6 0 0 1-6-6Z", stroke: "line", w: 2.4 },
    { t: "path", d: "M56 56a8 8 0 0 1 8-8h30a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8H84l-10 8v-8h-10a8 8 0 0 1-8-8Z", fill: "accent", op: .85 },
  ] },
  map: { vb: "0 0 120 96", shapes: [
    { t: "path", d: "M20 26 44 18l32 10 24-8v54l-24 8-32-10-24 8Z", fill: "soft" },
    { t: "path", d: "M20 26 44 18l32 10 24-8v54l-24 8-32-10-24 8ZM44 18v54M76 28v54", stroke: "line", w: 2.2 },
    { t: "path", d: "M60 66s11-10.5 11-18a11 11 0 0 0-22 0c0 7.5 11 18 11 18Z", fill: "accent" },
    { t: "circle", cx: 60, cy: 47, r: 4, fill: "bg" },
  ] },
};

// tone -> css variable
const TONE = { soft: "var(--rose-soft)", line: "var(--ink-3)", accent: "var(--rose)", bg: "var(--surface)" };

export function art(name, { size = 120, cls = "" } = {}) {
  const scene = SCENES[name] || SCENES.journal;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", scene.vb);
  svg.setAttribute("width", size);
  svg.setAttribute("height", Math.round((size * 96) / 120));
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  if (cls) svg.setAttribute("class", cls);
  for (const s of scene.shapes) {
    const el = document.createElementNS(NS, s.t);
    if (s.t === "path") el.setAttribute("d", s.d);
    if (s.t === "circle") { el.setAttribute("cx", s.cx); el.setAttribute("cy", s.cy); el.setAttribute("r", s.r); }
    if (s.fill) el.setAttribute("fill", TONE[s.fill] || s.fill);
    if (s.stroke) {
      el.setAttribute("stroke", TONE[s.stroke] || s.stroke);
      el.setAttribute("stroke-width", s.w || 2);
      el.setAttribute("stroke-linecap", "round");
      el.setAttribute("stroke-linejoin", "round");
    }
    if (s.op != null) el.setAttribute("opacity", s.op);
    svg.appendChild(el);
  }
  return svg;
}
