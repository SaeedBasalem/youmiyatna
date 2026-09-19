// يومياتنا — سماؤنا: the world the glass floats on.
//
// The background is not decoration; it is the hour of their day. Its colour is
// interpolated between the real prayer times the phone computes, so dawn
// arrives gradually instead of switching on at six. The moon on it carries
// tonight's true phase, the palms along its horizon are the ones their dhikr
// planted, and the clouds or rain are their city's actual weather.
//
// All of it is CSS on four small layers: no canvas, no animation loop, nothing
// that costs a phone its battery to sit behind a screen nobody is looking at.
import { prayerTimes, RIYADH } from "./prayer.js";
import { hijriParts, noMotion } from "./ui.js";
import { resolvedLook } from "./looks.js";
import { store } from "./store.js";
import { weatherNow, weatherHeld } from "./weather.js";
import { groveSvg, moonX } from "./grove.js";

// The day, as a handful of colours. Each stop is [top, bottom] — the sky is
// read from its own horizon upward.
const DAY = [
  { at: "night",   a: "#1B1730", b: "#2A1E2E" },
  { at: "fajr",    a: "#33355F", b: "#E8A488" },
  { at: "sunrise", a: "#9FC6E8", b: "#FFE3CB" },
  { at: "dhuhr",   a: "#BFDDF7", b: "#FFF6EF" },
  { at: "asr",     a: "#CFE0F0", b: "#FFE9D4" },
  { at: "maghrib", a: "#F09A72", b: "#6B4A7A" },
  { at: "isha",    a: "#241F45", b: "#2E2036" },
];
// Night Grove keeps its own deep sky; it only breathes a little.
const GROVE_DAY = [
  { at: "night",   a: "#0E0B1A", b: "#231637" },
  { at: "fajr",    a: "#1A1A38", b: "#3A2447" },
  { at: "sunrise", a: "#231A3C", b: "#40284C" },
  { at: "dhuhr",   a: "#241B3E", b: "#43304F" },
  { at: "asr",     a: "#221A3B", b: "#3E2A4B" },
  { at: "maghrib", a: "#2A1A38", b: "#4A2942" },
  { at: "isha",    a: "#120E22", b: "#281839" },
];

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (c1, c2, t) => {
  const A = hex(c1), B = hex(c2);
  return "#" + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, "0")).join("");
};

function placeNow() {
  try { const p = JSON.parse(localStorage.getItem("yn_place") || "null"); if (p && isFinite(p.lat) && isFinite(p.lng)) return p; } catch {}
  return RIYADH;
}

// where the day is, as a number of hours, plus the two colour stops around it
function moment(now = new Date()) {
  const where = placeNow();
  const deviceTz = -now.getTimezoneOffset() / 60;
  const tz = isFinite(where.tz) ? where.tz : deviceTz;
  const t = prayerTimes(now, { ...where, tz });
  const h = now.getHours() + now.getMinutes() / 60 + (tz - deviceTz);
  const fajr = isFinite(t.fajr) ? t.fajr : 4.8;
  const sunrise = isFinite(t.sunrise) ? t.sunrise : fajr + 1.3;
  const dhuhr = isFinite(t.dhuhr) ? t.dhuhr : 12;
  const asr = isFinite(t.asr) ? t.asr : 15.5;
  const maghrib = isFinite(t.maghrib) ? t.maghrib : 18.3;
  const isha = isFinite(t.isha) ? t.isha : maghrib + 1.5;
  // Night holds its colour until dawn is actually near, and returns soon after
  // Isha: without these two the sky starts warming at one in the morning.
  const marks = [
    { key: "night", h: 0 },
    { key: "night", h: Math.max(0.2, fajr - 1.1) },
    { key: "fajr", h: fajr }, { key: "sunrise", h: sunrise },
    { key: "dhuhr", h: dhuhr }, { key: "asr", h: asr }, { key: "maghrib", h: maghrib },
    { key: "isha", h: isha },
    { key: "night", h: Math.min(23.8, isha + 0.9) },
    { key: "night", h: 24 },
  ];
  let i = 0;
  while (i < marks.length - 2 && h >= marks[i + 1].h) i++;
  const span = Math.max(0.01, marks[i + 1].h - marks[i].h);
  return { from: marks[i].key, to: marks[i + 1].key, t: Math.min(1, Math.max(0, (h - marks[i].h) / span)),
    hour: h, night: h < fajr || h >= maghrib, sunUp: h >= sunrise && h < maghrib,
    dayFrac: Math.min(1, Math.max(0, (h - sunrise) / Math.max(0.5, maghrib - sunrise))),
    nightFrac: h >= isha ? (h - isha) / Math.max(0.5, 24 - isha + fajr) : h < fajr ? (24 - isha + h) / Math.max(0.5, 24 - isha + fajr) : 0 };
}

const stop = (list, key) => list.find((s) => s.at === key) || list[0];
let layers = null, raf = 0, timer = null, started = false;

function ensure() {
  let sky = document.getElementById("sky");
  if (!sky) { sky = document.createElement("div"); sky.id = "sky"; sky.setAttribute("aria-hidden", "true"); document.body.insertBefore(sky, document.body.firstChild); }
  if (layers && sky.contains(layers.wrap)) return layers;
  const wrap = document.createElement("div");
  wrap.className = "sky-extra";
  const body = document.createElement("div"); body.className = "sky-body";
  const grove = document.createElement("div"); grove.className = "sky-grove";
  const weather = document.createElement("div"); weather.className = "sky-weather";
  wrap.append(body, weather, grove);
  sky.appendChild(wrap);
  layers = { sky, wrap, body, grove, weather };
  return layers;
}

export function paintSky() {
  const look = resolvedLook();
  const r = document.documentElement;
  if (look === "ink") { if (layers) layers.wrap.style.display = "none"; return; }   // paper has no sky
  const L = ensure();
  L.wrap.style.display = "";
  const m = moment();
  const ramp = look === "grove" ? GROVE_DAY : DAY;
  const a = mix(stop(ramp, m.from).a, stop(ramp, m.to).a, m.t);
  const b = mix(stop(ramp, m.from).b, stop(ramp, m.to).b, m.t);
  r.style.setProperty("--sky-a", a);
  r.style.setProperty("--sky-b", b);
  r.style.setProperty("--sky-op", look === "grove" ? ".55" : m.night ? ".72" : ".5");
  r.setAttribute("data-sky", m.night ? "night" : "day");

  // the sun climbs and sets; the moon crosses the night with tonight's phase
  const across = m.sunUp ? m.dayFrac : m.nightFrac;
  const arc = Math.sin(Math.PI * Math.min(1, Math.max(0, across)));      // 0 at the horizon, 1 overhead
  L.body.style.insetInlineStart = (6 + across * 84).toFixed(1) + "%";
  L.body.style.top = (48 - arc * 22).toFixed(1) + "%";     // the band behind the hero: seen through glass, never behind bare text
  L.body.classList.toggle("is-moon", !m.sunUp);
  L.body.style.setProperty("--moon-x", m.sunUp ? "0px" : moonX(30));
  const hp = hijriParts();
  L.body.title = m.sunUp ? "" : "القمر الليلة" + (hp ? " — " + hp.day : "");

  // their own grove, as the horizon
  const cache = store.homeCache && store.homeCache();
  const palms = Math.max(0, (cache && cache.grove && cache.grove.total) || 0);
  if (palms !== paintSky._palms) {
    paintSky._palms = palms;
    L.grove.textContent = "";
    L.grove.appendChild(groveSvg(Math.min(palms, 60), { width: 360, height: 120 }));
  }

  // and the weather their city is actually having
  const w = weatherHeld();
  L.weather.className = "sky-weather" + (w ? " is-" + w.sky : "");
  if (noMotion()) L.weather.classList.add("still");
}

function onScroll() {
  if (raf || !layers || noMotion()) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    const y = Math.min(400, window.scrollY || 0);
    layers.wrap.style.transform = "translate3d(0," + (-y * 0.06).toFixed(1) + "px,0)";
  });
}

export function startSky() {
  if (started) return;
  started = true;
  paintSky();
  weatherNow().then((w) => { if (w) paintSky(); });
  clearInterval(timer);
  timer = setInterval(() => { paintSky(); }, 4 * 60 * 1000);          // the hour moves slowly
  setInterval(() => { weatherNow().then((w) => { if (w) paintSky(); }); }, 30 * 60 * 1000);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("yn:look", paintSky);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) paintSky(); });
}
