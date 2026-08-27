// يومياتنا — shared UI helpers used across the tab views (sheets, modals, loader, reactions).
import { h, $, clear } from "./ui.js";
import { store } from "./store.js";
import { api } from "./api.js";

export const go = (r) => { location.hash = "#/" + r; };

// full-screen spinner
export function loader(on) {
  let l = $("#loader");
  if (on) { if (!l) document.body.appendChild(h("div", { id: "loader", class: "loader", role: "status", "aria-label": "جارٍ التحميل" }, h("div", { class: "spinner" }))); }
  else if (l) l.remove();
}

let dlgId = 0;
// give a dialog panel proper semantics + focus trap + Escape + focus restore
function wireDialog(scrim, panel, close, titleNode) {
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  if (titleNode) { const id = "dlg-t-" + (++dlgId); titleNode.id = id; panel.setAttribute("aria-labelledby", id); }
  const prevFocus = document.activeElement;
  const focusables = () => panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])');
  scrim.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "Tab") {
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  setTimeout(() => { const f = focusables(); (f[0] || panel).focus(); }, 40);
  return () => { try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch {} };
}

// bottom sheet. body = array of nodes. beforeClose(): return false / Promise<false> to veto. returns { close }.
export function openSheet({ title, subtitle, body = [], wide = false, beforeClose = null } = {}) {
  const sheet = h("div", { class: "sheet" + (wide ? " wide" : ""), tabindex: "-1" }, h("div", { class: "grab" }));
  const titleNode = title ? h("h3", {}, title) : null;
  if (titleNode) sheet.appendChild(titleNode);
  if (subtitle) sheet.appendChild(h("div", { class: "muted sheet-sub" }, subtitle));
  body.flat().forEach((n) => n && sheet.appendChild(n));
  const scrim = h("div", { class: "scrim" }, sheet);
  const close = async (force) => { if (!force && beforeClose && !(await beforeClose())) return; restore(); sheet.style.animation = "down .28s forwards"; scrim.style.animation = "fadeout .28s forwards"; setTimeout(() => scrim.remove(), 240); };
  scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
  document.body.appendChild(scrim);
  const restore = wireDialog(scrim, sheet, close, titleNode);
  return { close, sheet };
}

// centered modal. returns { close }.
export function openModal({ title, body = [], wide = false } = {}) {
  const modal = h("div", { class: "modal" + (wide ? " wide" : ""), tabindex: "-1" });
  const titleNode = title ? h("h3", {}, title) : null;
  if (titleNode) modal.appendChild(titleNode);
  body.flat().forEach((n) => n && modal.appendChild(n));
  const scrim = h("div", { class: "scrim center" }, modal);
  const close = () => { restore(); scrim.style.animation = "fadeout .24s forwards"; setTimeout(() => scrim.remove(), 200); };
  scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
  document.body.appendChild(scrim);
  const restore = wireDialog(scrim, modal, close, titleNode);
  return { close, modal };
}

// consistent error / offline state with a retry button
export function errorState(retry, { offline = false } = {}) {
  return h("div", { class: "err-state" },
    h("div", { class: "big" }, offline ? "🌙" : "😔"),
    h("div", {}, offline ? "أنتما دون اتصال بالإنترنت" : "تعذّر التحميل"),
    retry ? h("button", { class: "btn soft sm", onclick: retry }, "أعد المحاولة ↻") : null);
}

// pretty confirm dialog → Promise<boolean>
export function confirmAsk(message, { okText = "تم", cancelText = "إلغاء", danger = false } = {}) {
  return new Promise((resolve) => {
    const { close } = openModal({
      title: "لحظة 🤍",
      body: [
        h("div", { class: "muted", style: { textAlign: "center", fontSize: "15px", lineHeight: "1.8", marginBottom: "16px" } }, message),
        h("div", { class: "row-btns" },
          h("button", { class: "btn ghost", onclick: () => { close(); resolve(false); } }, cancelText),
          h("button", { class: "btn" + (danger ? " danger" : ""), onclick: () => { close(); resolve(true); } }, okText)),
      ],
    });
  });
}

// group a reactions array [{emoji, author}] → { emoji: {count, mine} }
export function groupReactions(reactions = []) {
  const g = {};
  for (const r of reactions || []) {
    const e = r.emoji; if (!e) continue;
    g[e] = g[e] || { count: 0, mine: false };
    g[e].count++;
    if ((r.author || r.person) === store.person) g[e].mine = true;
  }
  return g;
}

// ensure signed URLs for a set of storage paths (fallback if server didn't inline them)
export async function ensureSigned(paths = []) {
  const need = paths.filter(Boolean);
  if (!need.length) return {};
  const r = await api.signDownload(need);
  return (r.ok && r.data.urls) || {};
}

// tiny helper: labelled input
export function field(props) { return h("input", { class: "field", ...props }); }

// salted SHA-256 of an app-lock PIN (so the PIN is not stored in cleartext)
export async function hashPin(pin, salt) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch { return "raw:" + salt + ":" + pin; }
}

// ---- theme & accent (shared by boot + settings) ----
export const ACCENT_PRESETS = {
  default: { name: "وردي ذهبي", dot: "#E28CA0", vars: {}, varsDark: {} },
  rose:    { name: "توتي",      dot: "#D5638A",
    vars:     { "--rose": "#DE7A98", "--rose-deep": "#B84C74", "--rose-soft": "#F7D6E1", "--gold": "#E0A9C0" },
    varsDark: { "--rose": "#E88BA6", "--rose-deep": "#EF9DB4", "--rose-soft": "#48293A", "--gold": "#E0A9C0" } },
  peach:   { name: "خوخي",      dot: "#EE9E77",
    vars:     { "--rose": "#EE9E77", "--rose-deep": "#D6764E", "--rose-soft": "#FBE2D2", "--gold": "#E8C58B" },
    varsDark: { "--rose": "#EEA588", "--rose-deep": "#F0B394", "--rose-soft": "#3E2A20", "--gold": "#E8C58B" } },
  lavender:{ name: "خزامى",     dot: "#A98FD1",
    vars:     { "--rose": "#A98FD1", "--rose-deep": "#7E60B0", "--rose-soft": "#EAE0F6", "--gold": "#CBB6E6", "--her": "#B79AD6" },
    varsDark: { "--rose": "#B79AD6", "--rose-deep": "#C6ABEA", "--rose-soft": "#2E2440", "--gold": "#CBB6E6", "--her": "#C4A9E6" } },
  teal:    { name: "فيروزي",    dot: "#5FBFB0",
    vars:     { "--rose": "#5FBFB0", "--rose-deep": "#3E9184", "--rose-soft": "#D6EFEA", "--gold": "#E3C27E", "--him": "#5FA9BF" },
    varsDark: { "--rose": "#5FBFB0", "--rose-deep": "#82D2C4", "--rose-soft": "#234039", "--gold": "#E3C27E", "--him": "#7FC0D0" } },
};
const ACCENT_KEYS = ["--rose", "--rose-deep", "--rose-soft", "--gold", "--gold-soft", "--her", "--him", "--her-soft", "--him-soft"];
function themeIsDark() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "dark") return true; if (t === "light") return false;
  try { return matchMedia("(prefers-color-scheme: dark)").matches; } catch { return false; }
}
export function applyAccent() {
  const preset = ACCENT_PRESETS[store.accent] || ACCENT_PRESETS.default;
  const r = document.documentElement;
  const vars = themeIsDark() && preset.varsDark ? preset.varsDark : preset.vars;
  ACCENT_KEYS.forEach((v) => r.style.removeProperty(v));
  for (const [k, val] of Object.entries(vars)) r.style.setProperty(k, val);
}
export function applyTheme() {
  const t = store.theme, r = document.documentElement;
  if (t === "system") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", t);
  applyAccent();
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", getComputedStyle(document.body).backgroundColor || "#FDF2EC");
}
