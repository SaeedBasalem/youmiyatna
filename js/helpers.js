// يومياتنا — shared UI helpers used across the tab views (sheets, modals, loader, reactions).
import { h, $, clear, toast } from "./ui.js";
import { attachSheetDrag } from "./gestures.js";
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
  attachSheetDrag(sheet, close);
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

// Run an optimistic write. If the server rejects it (or we are offline), undo the
// local change and say so — a journal must never look saved when it was not.
export async function commit(call, revert, failMsg) {
  let r;
  try { r = await call(); } catch { r = null; }
  if (r && r.ok) return true;
  try { revert && revert(); } catch {}
  toast(r && r.offline ? "لا اتصال — لم يُحفظ" : (failMsg || "تعذّر الحفظ"));
  return false;
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

// ---- app-lock crypto: the token is encrypted AT REST with the PIN ----
// A wrong PIN cannot derive the key, so AES-GCM decryption fails and the session
// token stays unusable — the lock actually protects data, not just the screen.
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function pinKey(pin, saltB64) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: unb64(saltB64), iterations: 150000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function encryptWithPin(text, pin) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const key = await pinKey(pin, salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivBytes }, key, new TextEncoder().encode(text));
  return { v: 1, salt, iv: b64(ivBytes), ct: b64(new Uint8Array(ct)) };
}
export async function decryptWithPin(bundle, pin) {
  try {
    if (!bundle || !bundle.salt || !bundle.iv || !bundle.ct) return null;
    const key = await pinKey(pin, bundle.salt);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(bundle.iv) }, key, unb64(bundle.ct));
    return new TextDecoder().decode(pt);
  } catch { return null; }   // wrong PIN (or tampered data) — indistinguishable, by design
}

// ---- biometric unlock (Face ID / fingerprint) ----
// The key comes from the authenticator itself via the WebAuthn PRF extension, so the
// token stays genuinely encrypted. Devices without PRF are told plainly, not faked.
const PRF_SALT = new TextEncoder().encode("youmiyatna-prf-v1");
export async function bioAvailable() {
  try {
    if (!window.PublicKeyCredential || !navigator.credentials) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}
async function aesKeyFromSecret(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function prfSecret(rawId) {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: rawId, type: "public-key" }],
      userVerification: "required", timeout: 60000,
      extensions: { prf: { eval: { first: PRF_SALT } } },
    },
  });
  const out = assertion && assertion.getClientExtensionResults && assertion.getClientExtensionResults().prf;
  const first = out && out.results && out.results.first;
  return first ? new Uint8Array(first) : null;
}
// Register this device's biometric and stash the token encrypted under it.
export async function bioEnroll(token) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "يومياتنا" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "youmiyatna", displayName: "يومياتنا" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60000,
      extensions: { prf: {} },
    },
  });
  if (!cred) throw new Error("cancelled");
  const ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {};
  if (!ext.prf || ext.prf.enabled === false) throw new Error("no_prf");
  const rawId = new Uint8Array(cred.rawId);
  const secret = await prfSecret(rawId);
  if (!secret) throw new Error("no_prf");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKeyFromSecret(secret), new TextEncoder().encode(token));
  localStorage.setItem("yn_bio", JSON.stringify({ v: 1, credId: b64(rawId), iv: b64(iv), ct: b64(new Uint8Array(ct)) }));
  return true;
}
export const bioEnrolled = () => !!localStorage.getItem("yn_bio");
export function bioForget() { localStorage.removeItem("yn_bio"); }
// Prompt for the biometric and return the decrypted token (or null).
export async function bioUnlock() {
  try {
    const rec = JSON.parse(localStorage.getItem("yn_bio") || "null");
    if (!rec) return null;
    const secret = await prfSecret(unb64(rec.credId));
    if (!secret) return null;
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(rec.iv) }, await aesKeyFromSecret(secret), unb64(rec.ct));
    return new TextDecoder().decode(pt);
  } catch { return null; }
}

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

// ---- backgrounds (preset gradients + your own photo, per person) ----
export const BG_PRESETS = {
  default:  { name: "الأصل", dot: "linear-gradient(135deg,#FDF2EC,#FADEE4)", css: "" },
  blush:    { name: "وردة", dot: "#FADEE4", css: "radial-gradient(120% 85% at 18% 0%,#FBE7DF,transparent 55%),radial-gradient(120% 85% at 92% 8%,#FADEE4,transparent 48%),#FDF2EC" },
  dawn:     { name: "فجر", dot: "#F6C177", css: "linear-gradient(160deg,#FCE9D6,#FADEE4 60%,#F3D9E6)" },
  lavender: { name: "خزامى", dot: "#C9B6EC", css: "linear-gradient(160deg,#EFE7FA,#F5DEEA)" },
  ocean:    { name: "بحر", dot: "#8FCFD6", css: "linear-gradient(160deg,#DDF1F1,#EAF3F6 60%,#F3E9EC)" },
  gold:     { name: "ذهب", dot: "#E3BE86", css: "radial-gradient(120% 80% at 50% 0%,#F7EAD5,transparent 60%),linear-gradient(160deg,#FBF3E4,#F7E3E9)" },
  night:    { name: "ليل", dot: "#3A2A38", css: "radial-gradient(1.5px 1.5px at 18% 24%,#ffffffaa,transparent),radial-gradient(1.5px 1.5px at 68% 40%,#ffffff88,transparent),radial-gradient(1.5px 1.5px at 42% 72%,#ffffff77,transparent),radial-gradient(1.5px 1.5px at 82% 66%,#ffffff66,transparent),linear-gradient(165deg,#241A26,#3A2A3C)" },
};
function ensureBgEl() { let el = document.getElementById("bg"); if (!el) { el = h("div", { id: "bg" }); document.body.insertBefore(el, document.body.firstChild); } return el; }
export async function applyBackground() {
  const el = ensureBgEl();
  const val = (store.config && store.config["bg_" + (store.person || "him")]) || "";
  if (!val || val === "preset:default") { el.style.background = ""; return; }
  if (val.startsWith("preset:")) { const p = BG_PRESETS[val.slice(7)]; el.style.background = p ? p.css : ""; return; }
  try {
    const r = await api.signDownload([val]);
    const url = r.ok && r.data.urls && r.data.urls[val];
    if (url) { const scrim = themeIsDark() ? "rgba(28,20,25,.62)" : "rgba(253,242,236,.55)"; el.style.background = `linear-gradient(${scrim},${scrim}), url("${url}") center/cover no-repeat`; }
    else el.style.background = "";
  } catch { el.style.background = ""; }
}

// accept only real http(s) links (blocks javascript:/data: in user-supplied URLs)
export function safeUrl(u) { const s = String(u || "").trim(); return /^https?:\/\//i.test(s) ? s : null; }
