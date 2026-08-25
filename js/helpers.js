// يومياتنا — shared UI helpers used across the tab views (sheets, modals, loader, reactions).
import { h, $, clear } from "./ui.js";
import { store } from "./store.js";
import { api } from "./api.js";

export const go = (r) => { location.hash = "#/" + r; };

// full-screen spinner
export function loader(on) {
  let l = $("#loader");
  if (on) { if (!l) document.body.appendChild(h("div", { id: "loader", class: "loader" }, h("div", { class: "spinner" }))); }
  else if (l) l.remove();
}

// bottom sheet. body = array of nodes. returns { close }.
export function openSheet({ title, subtitle, body = [], wide = false } = {}) {
  const sheet = h("div", { class: "sheet" + (wide ? " wide" : "") }, h("div", { class: "grab" }));
  if (title) sheet.appendChild(h("h3", {}, title));
  if (subtitle) sheet.appendChild(h("div", { class: "muted sheet-sub" }, subtitle));
  body.flat().forEach((n) => n && sheet.appendChild(n));
  const scrim = h("div", { class: "scrim" }, sheet);
  const close = () => { sheet.style.animation = "down .28s forwards"; scrim.style.animation = "fadeout .28s forwards"; setTimeout(() => scrim.remove(), 240); };
  scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
  document.body.appendChild(scrim);
  return { close, sheet };
}

// centered modal. returns { close }.
export function openModal({ title, body = [], wide = false } = {}) {
  const modal = h("div", { class: "modal" + (wide ? " wide" : "") });
  if (title) modal.appendChild(h("h3", {}, title));
  body.flat().forEach((n) => n && modal.appendChild(n));
  const scrim = h("div", { class: "scrim center" }, modal);
  const close = () => { scrim.style.animation = "fadeout .24s forwards"; setTimeout(() => scrim.remove(), 200); };
  scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
  document.body.appendChild(scrim);
  return { close, modal };
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

// ---- theme & accent (shared by boot + settings) ----
export const ACCENT_PRESETS = {
  default: { name: "وردي ذهبي", dot: "#E28CA0", vars: {} },
  rose:    { name: "توتي",      dot: "#D5638A", vars: { "--rose": "#DE7A98", "--rose-deep": "#B84C74", "--rose-soft": "#F7D6E1", "--gold": "#E0A9C0" } },
  peach:   { name: "خوخي",      dot: "#EE9E77", vars: { "--rose": "#EE9E77", "--rose-deep": "#D6764E", "--rose-soft": "#FBE2D2", "--gold": "#E8C58B" } },
  lavender:{ name: "خزامى",     dot: "#A98FD1", vars: { "--rose": "#A98FD1", "--rose-deep": "#7E60B0", "--rose-soft": "#EAE0F6", "--gold": "#CBB6E6", "--her": "#B79AD6" } },
  teal:    { name: "فيروزي",    dot: "#5FBFB0", vars: { "--rose": "#5FBFB0", "--rose-deep": "#3E9184", "--rose-soft": "#D6EFEA", "--gold": "#E3C27E", "--him": "#5FA9BF" } },
};
export function applyTheme() {
  const t = store.theme, r = document.documentElement;
  if (t === "system") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", t);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", getComputedStyle(document.body).backgroundColor || "#FDF2EC");
}
export function applyAccent() {
  const preset = ACCENT_PRESETS[store.accent] || ACCENT_PRESETS.default;
  const r = document.documentElement;
  ["--rose", "--rose-deep", "--rose-soft", "--gold", "--her", "--him"].forEach((v) => r.style.removeProperty(v));
  for (const [k, val] of Object.entries(preset.vars)) r.style.setProperty(k, val);
}
