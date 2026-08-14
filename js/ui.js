// يومياتنا — DOM builder + shared UI bits (no innerHTML; safe by construction).
import { PEOPLE, moodEmoji } from "./config.js";

// hyperscript: h('div', {class:'x', onclick, dataset:{id}}, child, [children])
export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k === "dataset") Object.assign(e.dataset, v);
    else if (k === "html") e.innerHTML = v;                 // used only with trusted strings
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in e && k !== "list") { try { e[k] = v; } catch { e.setAttribute(k, v); } }
    else e.setAttribute(k, v);
  }
  append(e, kids);
  return e;
}
function append(e, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
}
export const $ = (s, r = document) => r.querySelector(s);
export const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); return n; };

// ---- people ----
export function avatar(personKey, cls = "") {
  const p = PEOPLE[personKey] || PEOPLE.him;
  return h("span", { class: `avatar ${p.cls} ${cls}` }, p.initial);
}
export function personChip(personKey) {
  const p = PEOPLE[personKey] || PEOPLE.him;
  return h("span", { class: `chip who ${p.cls}` }, avatar(personKey, "sm"), p.name);
}
export function moodChip(mood) {
  if (!mood) return null;
  return h("span", { class: "chip mood-chip" }, moodEmoji(mood) + " " + mood);
}

// ---- toast ----
let toastT;
export function toast(msg) {
  let t = $("#toast");
  if (!t) { t = h("div", { id: "toast", class: "toast" }); document.body.appendChild(t); }
  clear(t); t.appendChild(document.createTextNode(msg));
  t.classList.add("show"); clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---- confetti + sparkle ----
export function confetti() {
  const host = confHost();
  const colors = ["#FFC93C", "#38D9A9", "#FF6B4A", "#4DA3FF", "#FF7EB6", "#B79CFF"];
  for (let i = 0; i < 46; i++) {
    const s = h("i", { class: "confetti-bit" });
    s.style.left = (10 + Math.random() * 80) + "vw";
    s.style.background = colors[i % colors.length];
    s.style.setProperty("--rx", (Math.random() * 720 - 360) + "deg");
    s.style.setProperty("--dur", (1.6 + Math.random() * 1.2) + "s");
    s.style.setProperty("--delay", (Math.random() * 0.3) + "s");
    if (Math.random() > 0.5) s.style.borderRadius = "50%";
    host.appendChild(s);
    setTimeout(() => s.remove(), 3200);
  }
}
export function sparkleAt(x, y, marks = ["✦", "❤️", "🌙", "✨", "💫", "🤍"]) {
  const host = confHost();
  for (let i = 0; i < 18; i++) {
    const s = h("span", { class: "sp" }, marks[i % marks.length]);
    const ang = Math.random() * Math.PI * 2, dist = 70 + Math.random() * 150;
    s.style.left = x + "px"; s.style.top = y + "px";
    s.style.setProperty("--dx", Math.cos(ang) * dist + "px");
    s.style.setProperty("--dy", Math.sin(ang) * dist + "px");
    s.style.setProperty("--rot", (Math.random() * 540 - 270) + "deg");
    s.style.fontSize = 14 + Math.random() * 16 + "px";
    host.appendChild(s);
    setTimeout(() => s.remove(), 1200);
  }
}
export function heartFly(x, y) {
  const host = confHost();
  const s = h("span", { class: "heart-fly" }, "❤️");
  s.style.left = x + "px"; s.style.top = y + "px";
  host.appendChild(s); setTimeout(() => s.remove(), 900);
}
function confHost() {
  let h0 = $("#fx");
  if (!h0) { h0 = h("div", { id: "fx" }); document.body.appendChild(h0); }
  return h0;
}

// ---- time ----
const rel = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
export function relTime(iso) {
  const t = new Date(iso).getTime(), now = Date.now(), diff = (t - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "الآن";
  if (abs < 3600) return rel.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rel.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return rel.format(Math.round(diff / 86400), "day");
  return fullDate(iso);
}
export function fullDate(iso) {
  try { return new Date(iso).toLocaleDateString("ar", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return String(iso).slice(0, 10); }
}
export function monthYear(iso) {
  try { return new Date(iso).toLocaleDateString("ar", { year: "numeric", month: "long" }); }
  catch { return String(iso).slice(0, 7); }
}
export const arNum = (n) => (n == null ? "" : Number(n).toLocaleString("ar-EG"));
