// يومياتنا — بستاننا: every «سبحان الله العظيم وبحمده» either of them says
// plants a palm.
//
//   قال رسول الله ﷺ: «من قال: سبحان الله العظيم وبحمده، غُرست له نخلة في الجنة»
//   رواه الترمذي (3464) وقال: حسن، وصحّحه الألباني.
//
// The grove is drawn from the count alone. Each palm's place comes from its
// own number through a fixed pseudo-random sequence, so the grove looks the
// same every time it is opened and a new palm always finds a new spot.
import { h, clear, arNum, toast, hijriParts, noMotion, sparkleAt } from "./ui.js";
import { api } from "./api.js";
import { store } from "./store.js";
import { PEOPLE, other } from "./config.js";
import { sound } from "./sound.js";
import { haptic } from "./haptics.js";
import { rt } from "./realtime.js";

const NS = "http://www.w3.org/2000/svg";
export const AZIM_KEY = "azim";
export const AZIM_TEXT = "سبحان الله العظيم وبحمده";
export const HADITH = "«من قال: سبحان الله العظيم وبحمده، غُرست له نخلة في الجنة»";
export const HADITH_REF = "رواه الترمذي (٣٤٦٤) وقال: حسن، وصحّحه الألباني";
const MAX_DRAWN = 90;        // past this the grove is full; the number keeps counting

// Arabic counts its nouns: نخلة واحدة، نخلتان، ٣–١٠ نخلات، ١١ فأكثر نخلة
export function palmWord(n) {
  if (n === 1) return "نخلة واحدة";
  if (n === 2) return "نخلتان";
  if (n >= 3 && n <= 10) return arNum(n) + " نخلات";
  return arNum(n) + " نخلة";
}

function ensureSprite() {
  if (document.getElementById("yn-palm-sprite")) return;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("id", "yn-palm-sprite");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  const sym = document.createElementNS(NS, "symbol");
  sym.setAttribute("id", "yn-palm"); sym.setAttribute("viewBox", "0 0 40 64");
  const trunk = document.createElementNS(NS, "path");
  trunk.setAttribute("d", "M20 64 C 22 50, 18 36, 21 22");
  trunk.setAttribute("stroke", "currentColor"); trunk.setAttribute("stroke-width", "2.6");
  trunk.setAttribute("fill", "none"); trunk.setAttribute("stroke-linecap", "round");
  sym.appendChild(trunk);
  const fronds = [[12.5, -26], [12.5, 4], [12.5, 34], [29.5, 26], [29.5, -4], [29.5, -34]];
  for (const [cx, rot] of fronds) {
    const e = document.createElementNS(NS, "ellipse");
    e.setAttribute("cx", String(cx)); e.setAttribute("cy", "22"); e.setAttribute("rx", "9"); e.setAttribute("ry", "2.3");
    e.setAttribute("transform", `rotate(${rot} 21 22)`); e.setAttribute("fill", "currentColor");
    sym.appendChild(e);
  }
  const top = document.createElementNS(NS, "ellipse");
  top.setAttribute("cx", "21"); top.setAttribute("cy", "15"); top.setAttribute("rx", "2.2"); top.setAttribute("ry", "7");
  top.setAttribute("fill", "currentColor");
  sym.appendChild(top);
  svg.appendChild(sym);
  document.body.appendChild(svg);
}

const rnd = (i, salt) => { const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };

export function groveSvg(total, { fresh = 0, width = 300, height = 150 } = {}) {
  ensureSprite();
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMax slice");
  svg.setAttribute("aria-hidden", "true");
  const dune = (x) => height - 16 - 7 * Math.sin((x / width) * Math.PI * 1.7 + 0.6);
  const n = Math.min(Math.max(0, total | 0), MAX_DRAWN);
  const palms = [];
  for (let i = 0; i < n; i++) palms.push({ i, s: 0.42 + 0.62 * rnd(i, 2), x: 10 + rnd(i, 1) * (width - 20) });
  palms.sort((a, b) => a.s - b.s);                         // far (small) first, near (large) on top
  const k = height / 150;
  for (const p of palms) {
    const w = 40 * p.s * k, hh = 64 * p.s * k;
    const use = document.createElementNS(NS, "use");
    use.setAttribute("href", "#yn-palm");
    use.setAttribute("x", (p.x - w / 2).toFixed(1));
    use.setAttribute("y", (dune(p.x) - hh + 3).toFixed(1));
    use.setAttribute("width", w.toFixed(1)); use.setAttribute("height", hh.toFixed(1));
    use.setAttribute("opacity", (0.5 + 0.5 * p.s).toFixed(2));
    if (p.i >= n - fresh && !noMotion()) use.setAttribute("class", "palm-new");
    svg.appendChild(use);
  }
  if (!n) {                                                // a seed waiting in the ground
    const seed = document.createElementNS(NS, "ellipse");
    seed.setAttribute("cx", String(width / 2)); seed.setAttribute("cy", String(dune(width / 2) - 3));
    seed.setAttribute("rx", "4"); seed.setAttribute("ry", "3"); seed.setAttribute("fill", "currentColor"); seed.setAttribute("opacity", ".8");
    svg.appendChild(seed);
  }
  const ground = document.createElementNS(NS, "path");
  let d = `M0 ${height} L0 ${dune(0).toFixed(1)}`;
  for (let x = 10; x <= width; x += 10) d += ` L${x} ${dune(x).toFixed(1)}`;
  d += ` L${width} ${height} Z`;
  ground.setAttribute("d", d);
  ground.setAttribute("class", "ground");
  svg.appendChild(ground);
  return svg;
}

// The moon as it is tonight, from the Hijri day: an inset shadow slides across
// a disc. Waxing is lit on the right; waning on the left.
export function moonX(size = 34) {
  const hp = hijriParts();
  const day = hp ? hp.day : 15;
  const f = ((day - 1) % 30) / 29.53;
  const cover = f < 0.5 ? 1 - f * 2 : (f - 0.5) * 2;
  return `${((f < 0.5 ? 1 : -1) * size * Math.min(0.95, cover)).toFixed(1)}px`;
}

export function groveHero(g = {}, { onOpen, big = false } = {}) {
  const total = g.total || 0, today = g.today || 0;
  const el = h(onOpen ? "button" : "div", { class: "grove-hero", "aria-label": `بستانكما: ${palmWord(total)}`, onclick: onOpen || null },
    total
      ? h("div", { class: "grove-count" },
          h("b", {}, arNum(total)),
          h("span", {}, total >= 3 && total <= 10 ? "نخلات في بستانكما" : "نخلة في بستانكما"),
          today ? h("span", { class: "today-n" }, "+" + arNum(today) + " اليوم") : h("span", {}, AZIM_TEXT))
      // an empty grove says what to do, rather than showing a lone Arabic zero (a dot)
      : h("div", { class: "grove-count" },
          h("b", {}, "🌱"),
          h("span", {}, "ازرعا أول نخلة"),
          h("span", {}, "«" + AZIM_TEXT + "»")));
  const moon = h("span", { class: "moon", "aria-hidden": "true" });
  moon.style.setProperty("--moon-x", moonX(34));
  el.appendChild(moon);
  el.appendChild(groveSvg(total, { fresh: Math.min(today, 6), height: big ? 230 : 150 }));
  return el;
}

// ---------------------------------------------------------------------------
// The grove page (عالمنا ← بستاننا): the big grove, one large tasbeeh button,
// the hadith, and who has planted what. Taps are counted at once on screen and
// sent in small batches, so thirty-three quick taps are not thirty-three calls.
// ---------------------------------------------------------------------------
export async function groveSection(pane) {
  const c = clear(pane);
  c.classList.add("grove-page");
  c.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "20px" } }, "…"));
  const [g, dk] = await Promise.all([api.grove(), api.dhikrToday()]);
  clear(c);
  const me = store.person, partner = other(me);
  const st = {
    total: g.ok ? g.data.total : 0,
    today: g.ok ? g.data.today : 0,
    mine: g.ok ? g.data[me] || 0 : 0,
    theirs: g.ok ? g.data[partner] || 0 : 0,
    mineToday: dk.ok ? (dk.data.mine && dk.data.mine[AZIM_KEY]) || 0 : 0,
  };
  const heroBox = h("div", {});
  const paintHero = (fresh) => { clear(heroBox).appendChild(groveHero({ total: st.total, today: st.today }, { big: true })); if (fresh) heroBox.querySelectorAll("use").forEach((u, i, all) => { if (i >= all.length - fresh) u.classList.add("palm-new"); }); };
  paintHero(0);
  c.appendChild(heroBox);

  const countEl = h("b", {});
  const num = (n) => (n > 0 ? arNum(n) : "—");
  const paintCount = () => { countEl.textContent = st.mineToday > 0 ? arNum(st.mineToday) : "سبّح"; countEl.classList.toggle("zero", !(st.mineToday > 0)); };
  paintCount();
  const btn = h("button", { class: "tasbeeh-btn", "aria-label": "سبّح: " + AZIM_TEXT }, countEl, h("span", {}, "اليوم"));
  const mineEl = h("b", {}, num(st.mine)), theirsEl = h("b", {}, num(st.theirs));
  c.appendChild(h("div", { class: "tcard plain tasbeeh" },
    h("div", { class: "hadith" }, AZIM_TEXT),
    btn,
    h("div", { class: "muted", style: { fontSize: "12.5px" } }, "كل تسبيحةٍ نخلةٌ في بستانكما")));

  let pending = 0, timer = null, sending = false;
  async function flush() {
    if (sending || !pending) return;
    sending = true;
    const n = pending; pending = 0;
    const r = await api.dhikrInc(AZIM_KEY, n);
    sending = false;
    if (!r.ok) {
      st.total -= n; st.today -= n; st.mine -= n; st.mineToday -= n;
      paintCount(); mineEl.textContent = num(st.mine);
      paintHero(0);
      toast(r.offline ? "لا اتصال — لم تُحسب آخر التسبيحات" : "تعذّر الحفظ");
      return;
    }
    rt.signal("grove");
    if (pending) flush();
  }
  btn.addEventListener("click", (e) => {
    st.total++; st.today++; st.mine++; st.mineToday++; pending++;
    paintCount(); mineEl.textContent = num(st.mine);
    haptic.soft(); sound.react();
    if (st.total <= MAX_DRAWN) paintHero(1);
    else { const b = heroBox.querySelector(".grove-count b"); if (b) b.textContent = arNum(st.total); }
    if (st.mineToday % 33 === 0) { sparkleAt(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2, ["🌴", "✨", "🤍"]); sound.post(); }
    clearTimeout(timer);
    timer = setTimeout(flush, pending >= 25 ? 0 : 700);
  });
  // never lose the last few taps when they leave the page
  const leave = () => { if (pending) flush(); };
  window.addEventListener("hashchange", leave, { once: true });
  document.addEventListener("visibilitychange", () => { if (document.hidden) leave(); });

  c.appendChild(h("div", { class: "grove-split" },
    h("div", {}, mineEl, h("span", {}, "غرستَ أنت".replace("غرستَ", __g("غرستَ", "غرستِ")))),
    h("div", {}, theirsEl, h("span", {}, (partner === "her" ? "غرست " : "غرس ") + PEOPLE[partner].name))));
  c.appendChild(h("div", { class: "tcard plain" },
    h("div", { class: "hadith" }, HADITH, h("small", {}, HADITH_REF))));
}
