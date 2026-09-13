// يومياتنا — looks: four complete designs to switch between on each phone.
//
//   تلقائي        Night Grove from Maghrib until Fajr, Dawn Glass the rest of the day —
//                 the switch follows the prayer times the app already computes.
//   زجاج الفجر    the warm world, rebuilt in Apple's Liquid Glass material.
//   حبر وورق      a real notebook: ruled paper, fountain-pen blue, polaroids.
//   بستان الليل   dark and immersive: night sky, the moon, their palm grove.
//
// A look re-clothes everything through tokens (css/v2.css). The light/dark
// theme still applies to the two looks that have both; Night Grove is dark by
// nature and says so.
import { store } from "./store.js";
import { prayerTimes, RIYADH } from "./prayer.js";

export const LOOKS = {
  auto:  { name: "تلقائي", desc: "بستان الليل من المغرب إلى الفجر، وزجاج الفجر بقية اليوم — يتبدّل مع أوقات الصلاة.",
           chip: ["#FFF6F3", "#DB6A88", "#110D1D", "#F2C46D"] },
  dawn:  { name: "زجاج الفجر", desc: "دفؤنا القديم في زجاجٍ شفّاف يطفو على ألوان الفجر، وأيقونات ناعمة كالطين.",
           chip: ["#FFF6F3", "#DB6A88", "#DDA046", "#5E9E7E"] },
  ink:   { name: "حبر وورق", desc: "دفترٌ حقيقي: ورقٌ مسطّر وحبرٌ أزرق وصور بولارويد واقتباسات.",
           chip: ["#F7F4EE", "#23406E", "#C24C62", "#5C7A4E"] },
  grove: { name: "بستان الليل", desc: "سماء ليلٍ بقمرها الحقيقي، وبستان نخيلكما على الأفق. داكنٌ دائمًا.",
           chip: ["#110D1D", "#2B1941", "#F2C46D", "#F08DA8"], dark: true },
};

function place() {
  try { const p = JSON.parse(localStorage.getItem("yn_place") || "null"); if (p && isFinite(p.lat) && isFinite(p.lng)) return p; } catch {}
  return RIYADH;
}

// Between Maghrib and the next Fajr, for wherever they told the prayer card they are.
export function isNightByPrayer(now = new Date()) {
  const where = place();
  const deviceTz = -now.getTimezoneOffset() / 60;
  const tz = isFinite(where.tz) ? where.tz : deviceTz;
  const t = prayerTimes(now, { ...where, tz });
  const h = now.getHours() + now.getMinutes() / 60 + (tz - deviceTz);
  if (!isFinite(t.maghrib) || !isFinite(t.fajr)) return h >= 18.5 || h < 4.5;
  return h >= t.maghrib || h < t.fajr;
}

export const chosenLook = () => (LOOKS[store.look] ? store.look : "auto");
export function resolvedLook(now = new Date()) {
  const l = chosenLook();
  return l === "auto" ? (isNightByPrayer(now) ? "grove" : "dawn") : l;
}

let last = null;
export function applyLook() {
  const r = document.documentElement;
  const look = resolvedLook();
  r.setAttribute("data-look", look);
  r.removeAttribute("data-skin");                     // the old skins are retired; their CSS never matches again
  if (look !== last) {
    last = look;
    window.dispatchEvent(new CustomEvent("yn:look", { detail: { look } }));
  }
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) setTimeout(() => { try { m.setAttribute("content", getComputedStyle(document.body).backgroundColor || "#FFF6F3"); } catch {} }, 60);
  return look;
}

export function setLook(key) {
  if (!LOOKS[key]) return;
  store.look = key;
  applyLook();
}

let timer = null;
export function startLooks() {
  applyLook();
  clearInterval(timer);
  timer = setInterval(applyLook, 60 * 1000);          // Maghrib should arrive on time, not ten minutes late
  document.addEventListener("visibilitychange", () => { if (!document.hidden) applyLook(); });
}
