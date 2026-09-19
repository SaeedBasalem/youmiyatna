// يومياتنا — the shell and the router.
// Chapter Two: اليوم · ذكرياتنا · ＋ · همس · عالمنا. The route names underneath
// are the ones the app always had (home, journal, chat, us), so every link a
// notification, the palette or a card has ever pointed at still arrives.
import { api, setAuthFailHandler } from "./api.js";
import { store } from "./store.js";
import { sound } from "./sound.js";
import { h, $, clear, avatar, toast, arNum, noMotion } from "./ui.js";
import { PEOPLE } from "./config.js";
import { loader, go, applyTheme, applyBackground, confirmAsk, hashPin, encryptWithPin, decryptWithPin, bioEnrolled, bioUnlock } from "./helpers.js";
import { startOutbox } from "./outbox.js";
import { startPalette } from "./palette.js";
import { attachSwipe, attachPullToRefresh } from "./gestures.js";
import { icon } from "./icons.js";
import { haptic } from "./haptics.js";
import { maybeWelcome } from "./onboarding.js";
import { startLooks } from "./looks.js";
import { watchInstall, isStandalone } from "./install.js";
import { startLiving } from "./living.js";
import { rt } from "./realtime.js";
import { startTouchListener } from "./touch.js";
import { openCapture } from "./capture.js";
import { startGameInvites } from "./views/together.js";
import { startTrack, track } from "./track.js";
import { startSky } from "./sky.js";
import { captureNow } from "./now.js";
import { viewToday, todayOpenWinddown } from "./views/today.js";
import { viewInbox } from "./views/inbox.js";
import { viewJournal, viewMoment } from "./views/journal.js";
import { viewChat } from "./views/chat.js";
import { viewPlay } from "./views/play.js";
import { viewUs } from "./views/us.js";
import { viewSearch } from "./views/search.js";
import { viewBook } from "./views/book.js";
import { viewWrapped } from "./views/wrapped.js";
import { viewMap } from "./views/map.js";
import { viewStory } from "./views/story.js";
import { viewPulse } from "./views/pulse.js";
import { viewProfile } from "./views/profile.js";

const APP = () => document.getElementById("app");

/* ---------------- boot ---------------- */
store.init(); applyTheme(); startLooks(); applyBackground(); startLiving(); startOutbox(); startPalette(); startTrack(); startSky();
watchInstall(() => { if (currentRoute() === "home") renderRoute(); });
if (isStandalone()) document.documentElement.setAttribute("data-standalone", "1");
setAuthFailHandler(() => { rt.stop(); store.clearAuth(); toast("انتهت الجلسة، افتحا من جديد"); go("lock"); });
window.addEventListener("hashchange", renderRoute);
window.addEventListener("pointerdown", () => sound.resume(), { once: true });
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  // a new service worker took control (an update shipped): reload once for the fresh files
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (refreshing || !hadController) return; refreshing = true; location.reload(); });
  // a tapped notification asks for a specific screen
  navigator.serviceWorker.addEventListener("message", (e) => { const u = e.data && e.data.nav; if (typeof u === "string") location.hash = u.includes("#") ? u.slice(u.indexOf("#")) : "#/home"; });
  navigator.serviceWorker.register("sw.js").then((reg) => { try { reg.update(); } catch {} setInterval(() => { try { reg.update(); } catch {} }, 30 * 60 * 1000); }).catch(() => {});
}

const TABS = [
  { key: "home", ic: "sun", label: "اليوم" },
  { key: "journal", ic: "book", label: "ذكرياتنا" },
  { plus: true },
  { key: "chat", ic: "chat", label: "همس" },
  { key: "us", ic: "grid", label: "عالمنا" },
];
const SEQ = ["home", "journal", "chat", "us"];
// Everything boot() touches must be declared ABOVE it: it renders synchronously
// while this module is still being evaluated, so a let/const further down is not
// initialised yet — a returning user reloading the app got a blank page.
const SHELL = new Set(["home", "journal", "chat", "us", "play", "inbox", "search", "book", "wrapped", "map", "pulse", "profile"]);
let rendered = false, lastRoute = null;
let unreadN = 0;

// once there is a token and a person: the live line, heartbeats, the welcome
let live = false;
function goLive() {
  if (live || !store.token || !store.person) return;
  live = true;
  rt.start(); startTouchListener(); startGameInvites(); maybeWelcome();
  rt.on("msg", () => { if (currentRoute() !== "chat") { refreshUnread(); toast("💬 همسة جديدة من " + PEOPLE[store.person === "him" ? "her" : "him"].name); sound.react(); } });
}

(function boot() {
  const start = () => {
    if (store.token && store.person) { if (!location.hash) location.hash = "#/home"; goLive(); renderRoute(); }
    else if (store.token) go("who"); else go("lock");
    if (!location.hash) renderRoute();
  };
  const legacyLock = localStorage.getItem("yn_applock") === "on" && (localStorage.getItem("yn_applock_hash") || localStorage.getItem("yn_applock_pin"));
  if (store.person && store.sealed) appLockGate(start);              // token encrypted at rest — PIN required
  else if (store.token && store.person && legacyLock) appLockGate(start);
  else start();
})();

// auto-relock: after a spell in the background the in-memory token is dropped
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (store.sealed && hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000) location.reload();
});

function currentRoute() { return (location.hash || "#/home").replace(/^#\//, "").split("/")[0]; }
function routeArg() { return (location.hash || "").replace(/^#\//, "").split("/")[1] || ""; }

// Moving between the four main screens is a view transition where the browser
// has them (Safari 18+, Chrome): the old screen fades up and out, the new one
// settles in. Only between those four — never on the lock or "who" screens —
// and never allowed to hold the screen: while a transition runs, the page
// underneath does not receive taps, so one that stalls would freeze the app.
// Any transition still running after 700 ms is finished by force.
function renderRoute() {
  const run = () => routeNow();
  const route = currentRoute();
  const smooth = rendered && lastRoute && SHELL.has(lastRoute) && SHELL.has(route) && store.person
    && document.startViewTransition && !noMotion() && document.visibilityState === "visible";
  lastRoute = route;
  rendered = true;
  if (smooth) {
    try {
      const t = document.startViewTransition(run);
      for (const p of [t.ready, t.finished, t.updateCallbackDone]) if (p && p.catch) p.catch(() => {});
      setTimeout(() => { try { t.skipTransition(); } catch {} }, 700);
      return;
    } catch { /* fall through to a plain render */ }
  }
  run();
}

function routeNow() {
  const route = currentRoute();
  if (!store.token && route !== "lock") return go("lock");
  if (store.token && !store.person && !["who", "lock"].includes(route)) return go("who");
  switch (route) {
    case "lock": return viewLock();
    case "who": return viewWho();
    case "home": return shell("home", viewToday);
    case "now": {          // the daily-photo notification: straight into the viewfinder
      history.replaceState(null, "", "#/home");
      track("open_from_push", { kind: "now" });
      return shell("home", (c) => viewToday(c, { then: (d) => {
        // already photographed today? then it only wants to be looked at
        if (d && d.now && d.now.mine) {
          const el = c.querySelector(".now-card");
          if (el) { el.scrollIntoView({ block: "center", behavior: noMotion() ? "auto" : "smooth" });
            el.animate && el.animate([{ transform: "scale(1)" }, { transform: "scale(1.02)" }, { transform: "scale(1)" }], { duration: 700 }); }
          return;
        }
        captureNow(() => window.dispatchEvent(new CustomEvent("yn:changed")));
      } }));
    }
    case "winddown": {     // the night reminder: Today, with the wind-down sheet open
      history.replaceState(null, "", "#/home");
      return shell("home", (c) => viewToday(c, { then: () => todayOpenWinddown() }));
    }
    case "journal": return shell("journal", viewJournal);
    case "chat": return shell("chat", viewChat);
    case "play": return shell("us", viewPlay);
    case "us": return shell("us", viewUs);
    case "search": return shell("journal", viewSearch);
    case "book": return shell("us", viewBook);
    case "wrapped": return shell("us", viewWrapped);
    case "map": return shell("us", viewMap);
    case "story": return viewStory();
    case "pulse": return shell("us", viewPulse);
    case "inbox": return shell("home", viewInbox);
    case "profile": return shell("us", (c) => viewProfile(c, routeArg()));
    case "moment": return viewMoment(routeArg());
    default: return go("home");
  }
}

function shell(active, viewFn) {
  goLive();
  const app = clear(APP());
  const content = h("main", { id: "main", class: "view" });
  app.appendChild(content);
  app.appendChild(tabbar(active));
  viewFn(content);
  if (active !== "home") refreshUnread();          // Today brings the count with it
  const i = SEQ.indexOf(active);
  attachSwipe(content, {
    onLeft: () => { if (i >= 0 && i < SEQ.length - 1) { sound.tab(); go(SEQ[i + 1]); } },
    onRight: () => { if (i > 0) { sound.tab(); go(SEQ[i - 1]); } },
  });
  attachPullToRefresh(content, async () => { sound.tab(); routeNow(); await new Promise((r) => setTimeout(r, 400)); });
}

function tabbar(active) {
  const nav = h("nav", { class: "tabbar", "aria-label": "التنقّل" }, ...TABS.map((t) => {
    if (t.plus) return h("div", { class: "tab-plus" },
      h("button", { class: "plus-btn", "aria-label": "أضيفا: لحظة، صورة، نبضة…", onclick: () => openCapture() }, icon("plus", { size: 26, stroke: 2.2 })));
    const on = active === t.key;
    const btn = h("button", { class: "tab" + (on ? " active" : ""), "aria-label": t.label, "aria-current": on ? "page" : null,
      onclick: () => { sound.tab(); haptic.tap(); go(t.key); } }, h("span", { class: "ic" }, icon(t.ic, { size: 23 })), t.label);
    if (t.key === "chat") btn.dataset.tab = "chat";
    return btn;
  }));
  paintBadge(nav);
  return nav;
}

function paintBadge(root = document) {
  const btn = root.querySelector('[data-tab="chat"]');
  if (!btn) return;
  const old = btn.querySelector(".tab-badge"); if (old) old.remove();
  if (unreadN > 0 && !btn.classList.contains("active")) btn.appendChild(h("span", { class: "tab-badge", "aria-label": arNum(unreadN) + " لم تُقرأ" }, arNum(unreadN)));
}
async function refreshUnread() {
  try { const r = await api.chatUnread(); if (r.ok) { unreadN = r.data.unread || 0; paintBadge(); } } catch {}
}
window.addEventListener("yn:unread", (e) => { unreadN = (e.detail && e.detail.unread) || 0; paintBadge(); });

/* ---------------- app-lock gate ---------------- */
function appLockGate(onOk) {
  const app = clear(APP());
  const err = h("div", { class: "err", role: "alert" });
  const pin = h("input", { class: "field pin", type: "password", inputmode: "numeric", maxLength: 4, placeholder: "····", autocomplete: "off", "aria-label": "رمز القفل" });
  let fails = 0;
  const submit = async () => {
    const entered = pin.value;
    let ok = false;
    if (store.sealed) {
      const tok = await decryptWithPin(store.sealedBundle(), entered);   // wrong PIN => null, token stays unusable
      if (tok) { store.useToken(tok); ok = true; }
    } else {
      const salt = localStorage.getItem("yn_applock_salt"), hash = localStorage.getItem("yn_applock_hash"), raw = localStorage.getItem("yn_applock_pin");
      ok = hash ? (await hashPin(entered, salt)) === hash : entered === raw;
      // upgrade an older screen-only lock to real encryption now that the PIN is known
      if (ok && store.token) { try { store.sealToken(await encryptWithPin(store.token, entered)); ["yn_applock_hash", "yn_applock_salt", "yn_applock_pin"].forEach((k) => localStorage.removeItem(k)); } catch {} }
    }
    if (ok) { sound.unlock(); onOk(); return; }
    fails++; sound.error(); pin.value = "";
    const b = $(".lock .box"); b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake");
    if (fails >= 5) { err.textContent = "محاولاتٌ كثيرة — انتظرا لحظة"; pin.disabled = true; setTimeout(() => { pin.disabled = false; pin.focus(); }, Math.min(30000, fails * 2000)); }
    else err.textContent = "رمزٌ غير صحيح";
  };
  pin.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  app.appendChild(h("div", { class: "lock view" },
    h("div", { class: "heart", "aria-hidden": "true" }, "🔒"),
    h("h1", { class: "brand", style: { fontSize: "clamp(38px,12vw,58px)", margin: 0 } }, "يومياتنا"),
    h("div", { class: "tag" }, "أدخلا رمز القفل"),
    h("div", { class: "box" }, pin, h("button", { class: "btn", onclick: submit }, "فتح"), err),
    bioEnrolled() ? h("button", { class: "btn soft", style: { marginTop: "12px", maxWidth: "340px" }, onclick: () => bioTry(true) }, "👆 افتح ببصمتك") : null,
    h("button", { class: "btn ghost sm", style: { marginTop: "14px" }, onclick: async () => { if (await confirmAsk("نسيتما الرمز؟ سنعيدكما إلى كلمة الفتح.", { okText: "متابعة" })) { ["yn_applock", "yn_applock_pin", "yn_applock_salt", "yn_applock_hash", "yn_token_enc", "yn_bio"].forEach((k) => localStorage.removeItem(k)); store.clearAuth(); go("lock"); location.reload(); } } }, "نسيتما الرمز؟")));
  async function bioTry(explicit) {
    err.textContent = "";
    const tok = await bioUnlock();
    if (tok) { store.useToken(tok); sound.unlock(); onOk(); }
    else if (explicit) { err.textContent = "تعذّرت البصمة — استخدما الرمز"; sound.error(); }
  }
  if (bioEnrolled()) setTimeout(() => bioTry(false), 250);   // offer it straight away; silent if dismissed
  setTimeout(() => pin.focus(), 60);
}

/* ---------------- lock / who ---------------- */
function viewLock() {
  rendered = true;
  const app = clear(APP());
  const err = h("div", { class: "err", role: "alert" });
  const pin = h("input", { class: "field pin", type: "password", inputmode: "numeric", placeholder: "••••", autocomplete: "off", maxLength: 12, "aria-label": "كلمة الفتح" });
  async function submit() {
    sound.resume();
    const pass = pin.value.trim(); err.textContent = "";
    if (!pass) { err.textContent = __g("اكتب كلمة الفتح", "اكتبي كلمة الفتح"); return; }
    loader(true);
    // a personal code proves who is entering — straight in, no "who are you?"
    const mine = await api.unlockPersonal(pass);
    if (mine.ok && mine.data.token) { store.setAuth(mine.data.token, mine.data.person); loader(false); sound.unlock(); go("home"); return; }
    const r = await api.unlock(pass); loader(false);
    if (r.ok && r.data.token) { store.setAuth(r.data.token, null); sound.unlock(); go("who"); }
    else if (r.status === 429) { err.textContent = "محاولاتٌ كثيرة — انتظرا قليلًا"; sound.error(); }
    else { err.textContent = r.offline ? "لا اتصال — تحقّقا من الإنترنت" : "كلمة الفتح غير صحيحة"; sound.error(); const b = $(".lock .box"); b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); }
  }
  pin.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  app.appendChild(h("div", { class: "lock view" },
    h("div", { class: "heart", "aria-hidden": "true" }, "🤍"),
    h("div", { class: "bism" }, "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيم"),
    h("h1", { class: "brand", style: { margin: 0 } }, "يومياتنا"),
    h("div", { class: "tag" }, "عالمٌ صغيرٌ لنا… نحفظ فيه أجمل أيّامنا، ونمضي بها إلى رضا الله."),
    h("div", { class: "box" }, pin, h("button", { class: "btn", onclick: submit }, __g("ادخل بيتنا", "ادخلي بيتنا")), err)));
  setTimeout(() => pin.focus(), 50);
}
function viewWho() {
  rendered = true;
  const app = clear(APP());
  async function pick(person) {
    loader(true); const r = await api.chooseIdentity(person); loader(false);
    if (r.ok && r.data.token) { store.setAuth(r.data.token, person); sound.unlock(); go("home"); }
    else toast(__g("تعذّر الدخول، حاول مجددًا", "تعذّر الدخول، حاولي مجددًا"));
  }
  app.appendChild(h("div", { class: "lock view" },
    h("h1", { class: "brand", style: { fontSize: "40px", margin: 0 } }, "مَن أنتِ الآن؟"),
    h("div", { class: "tag" }, "لنعرف صاحب كل كلمة 🤍"),
    h("div", { class: "who-cards" },
      h("button", { class: "who-card him", onclick: () => pick("him") }, avatar("him", "lg"), PEOPLE.him.name),
      h("button", { class: "who-card her", onclick: () => pick("her") }, avatar("her", "lg"), PEOPLE.her.name))));
}
