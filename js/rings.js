// يومياتنا — حلقات يومنا: three gentle rings for each of them.
//
//   تواصل  a whisper, a heartbeat, today's question answered
//   ذكرى   today's photo (لحظتنا الآن) and a moment written
//   عبادة  dhikr against their own daily goal
//
// Every feature feeds one ring, so the thirty screens finally add up to one
// picture of the day. The numbers come from the server (journal6 `home`).
import { h, arNum, noMotion } from "./ui.js";
import { PEOPLE } from "./config.js";

const NS = "http://www.w3.org/2000/svg";
const RINGS = [["connection", 16, "ra-c", "تواصل"], ["memory", 11, "ra-m", "ذكرى"], ["faith", 6, "ra-f", "عبادة"]];
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const pct = (v) => Math.round(clamp01(v) * 100);

function circle(r, cls) {
  const c = document.createElementNS(NS, "circle");
  c.setAttribute("cx", "20"); c.setAttribute("cy", "20"); c.setAttribute("r", String(r));
  c.setAttribute("class", cls); c.setAttribute("stroke-width", "4.2");
  return c;
}

export function ringSvg(values = {}) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 40 40");
  svg.setAttribute("aria-hidden", "true");
  const arcs = [];
  for (const [key, r, cls] of RINGS) {
    svg.appendChild(circle(r, "rt"));
    const a = circle(r, "ra " + cls);
    a.setAttribute("pathLength", "100");
    const v = clamp01(values[key]);
    // a zero-length arc with a round cap still draws a dot, so an empty ring hides its arc
    if (v === 0) a.setAttribute("stroke-opacity", "0");
    a.setAttribute("stroke-dasharray", noMotion() ? `${v * 100} 100` : "0 100");
    arcs.push([a, v]);
    svg.appendChild(a);
  }
  if (!noMotion()) requestAnimationFrame(() => requestAnimationFrame(() => arcs.forEach(([a, v]) => a.setAttribute("stroke-dasharray", `${v * 100} 100`))));
  return svg;
}

const spoken = (name, r) => `${name}: ` + RINGS.map(([k, , , label]) => `${label} ${arNum(pct(r && r[k]))}٪`).join("، ");

export function ringsView(rings, me, partner) {
  const set = (r, name) => h("div", { class: "ringset", role: "img", "aria-label": spoken(name, r) }, ringSvg(r || {}), h("span", {}, name));
  const legend = h("div", { class: "ring-legend", "aria-hidden": "true" },
    h("span", {}, h("i", { class: "c" }), "تواصل"),
    h("span", {}, h("i", { class: "m" }), "ذكرى"),
    h("span", {}, h("i", { class: "f" }), "عبادة"));
  return h("div", { class: "rings" }, set(rings && rings[me], "أنت"), legend, set(rings && rings[partner], PEOPLE[partner].name));
}

// One line under the rings: the emptiest ring of mine, and what fills it.
export function ringsHint(rings, me) {
  const r = (rings && rings[me]) || {};
  if (clamp01(r.connection) < 1) return "همسةٌ أو نبضة أو جواب سؤال اليوم يملأ حلقة التواصل";
  if (clamp01(r.memory) < 1) return r.now ? "لحظةٌ تكتبها اليوم تكمل حلقة الذكرى" : "صورة «لحظتنا الآن» تملأ نصف حلقة الذكرى";
  if (clamp01(r.faith) < 1) {
    const left = Math.max(0, (r.goal || 100) - (r.dhikr || 0));
    return `بقي ${arNum(left)} من ذكرك لتكتمل حلقة العبادة`;
  }
  return "اكتملت حلقاتك اليوم — بارك الله فيك 🤍";
}
