// يومياتنا — the living theme: the app breathes with the hour, the season and
// the Islamic calendar. It only ever adds an ambient wash over whatever
// background/theme the couple chose, so their own choices always win.
import { hijriParts } from "./ui.js";

const TZ = 180 * 60000;                       // Asia/Riyadh
export const localHour = () => new Date(Date.now() + TZ).getUTCHours();
const localMonth = () => new Date(Date.now() + TZ).getUTCMonth() + 1;

export function phaseNow(h = localHour()) {
  if (h < 4) return "night";
  if (h < 7) return "dawn";
  if (h < 11) return "morning";
  if (h < 16) return "noon";
  if (h < 19) return "sunset";
  return "night";
}
export const PHASE_AR = { dawn: "فجر", morning: "صباح", noon: "نهار", sunset: "غروب", night: "ليل" };

export function seasonNow(m = localMonth()) {
  if (m === 12 || m <= 2) return "winter";
  if (m <= 5) return "spring";
  if (m <= 8) return "summer";
  return "autumn";
}

// a coarse occasion flag used only for ambience (the home ribbon carries the detail)
export function occasionNow() {
  const hp = hijriParts();
  if (!hp) return "";
  const dow = new Date(Date.now() + TZ).getUTCDay();
  if (hp.month === 9) return "ramadan";
  if ((hp.month === 10 && hp.day === 1) || (hp.month === 12 && hp.day === 10)) return "eid";
  if (hp.month === 12 && hp.day <= 10) return "hajj";
  if (dow === 5) return "friday";
  return "";
}

function skyEl() {
  let el = document.getElementById("sky");
  if (!el) {
    el = document.createElement("div");
    el.id = "sky";
    const bg = document.getElementById("bg");
    if (bg && bg.parentNode) bg.parentNode.insertBefore(el, bg.nextSibling);
    else document.body.insertBefore(el, document.body.firstChild);
    // a few slow drifting motes; CSS hides them unless the phase wants them
    for (let i = 0; i < 14; i++) {
      const s = document.createElement("i");
      s.style.left = Math.random() * 100 + "%";
      s.style.top = Math.random() * 100 + "%";
      s.style.setProperty("--d", (7 + Math.random() * 9).toFixed(1) + "s");
      s.style.setProperty("--dl", (-Math.random() * 9).toFixed(1) + "s");
      s.style.setProperty("--sc", (0.5 + Math.random()).toFixed(2));
      el.appendChild(s);
    }
  }
  return el;
}

let timer = null;
export function applyLiving() {
  const r = document.documentElement;
  const phase = phaseNow(), season = seasonNow(), occ = occasionNow();
  r.setAttribute("data-phase", phase);
  r.setAttribute("data-season", season);
  if (occ) r.setAttribute("data-occasion", occ); else r.removeAttribute("data-occasion");
  skyEl();
  return { phase, season, occ };
}

export function startLiving() {
  applyLiving();
  clearInterval(timer);
  timer = setInterval(applyLiving, 10 * 60 * 1000);          // re-check every 10 min
  document.addEventListener("visibilitychange", () => { if (!document.hidden) applyLiving(); });
}

// a warm, phase-aware greeting for the home header
export function greetingFor(phase = phaseNow()) {
  return { dawn: "فجرٌ مبارك", morning: "صباح الخير", noon: "نهارٌ سعيد", sunset: "مساء الخير", night: "ليلةٌ هانئة" }[phase] || "أهلًا";
}
