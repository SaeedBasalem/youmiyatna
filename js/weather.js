// يومياتنا — the weather over their city, for the sky behind the glass.
//
// Open-Meteo, no key and no account. The coordinates are the city the prayer
// times already use — nothing about where either of them actually is leaves
// the phone, and no location permission is ever asked for. If the call fails
// the sky simply stays clear; nothing on screen waits for it.
import { RIYADH } from "./prayer.js";

const CACHE_KEY = "yn_weather";
const FRESH = 30 * 60 * 1000;          // half an hour is plenty for a background

function place() {
  try { const p = JSON.parse(localStorage.getItem("yn_place") || "null"); if (p && isFinite(p.lat) && isFinite(p.lng)) return p; } catch {}
  return RIYADH;
}

// WMO weather codes → what the sky should show
export function skyOf(code) {
  const c = Number(code);
  if (c === 0 || c === 1) return "clear";
  if (c === 2 || c === 3) return "clouds";
  if (c === 45 || c === 48) return "fog";
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return "rain";
  if (c >= 71 && c <= 77 || c === 85 || c === 86) return "snow";
  if (c >= 95) return "storm";
  return "clear";
}

export const WEATHER_AR = { clear: "صحو", clouds: "غائم", fog: "ضباب", rain: "مطر", snow: "ثلج", storm: "عاصفة" };

export async function weatherNow() {
  try {
    const held = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (held && Date.now() - held.at < FRESH) return held.data;
  } catch {}
  const p = place();
  const url = "https://api.open-meteo.com/v1/forecast?latitude=" + p.lat.toFixed(3) + "&longitude=" + p.lng.toFixed(3) +
    "&current=weather_code,temperature_2m,is_day&timezone=UTC";
  try {
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 6000) : null;
    const res = await fetch(url, { signal: ctl ? ctl.signal : undefined });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    const cur = j && j.current;
    if (!cur) return null;
    const data = { sky: skyOf(cur.weather_code), temp: Math.round(Number(cur.temperature_2m)), day: !!cur.is_day };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch {}
    return data;
  } catch { return null; }
}

// whatever was last known, without asking the network
export function weatherHeld() {
  try { const held = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); return held ? held.data : null; } catch { return null; }
}
