// يومياتنا — theme (light/dark/system) + accent presets.
import { store } from "./store.js";
import { ACCENTS } from "./config.js";

const ACCENT_VARS = ["--sun", "--coral", "--mint", "--him", "--her", "--olive", "--lilac"];

export function applyTheme() {
  const root = document.documentElement;
  const t = store.theme; // 'system' | 'light' | 'dark'
  if (t === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", t);
  for (const k of ACCENT_VARS) root.style.removeProperty(k);
  const acc = ACCENTS[store.accent] || ACCENTS.default;
  for (const [k, v] of Object.entries(acc.vars || {})) root.style.setProperty(k, v);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) { const bg = getComputedStyle(root).getPropertyValue("--paper").trim(); if (bg) meta.setAttribute("content", bg); }
}
export function setTheme(t) { store.theme = t; applyTheme(); }
export function setAccent(a) { store.accent = a; applyTheme(); }
