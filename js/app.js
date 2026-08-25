// يومياتنا — warm romantic app. Shell + router; mounts the tab views.
import { api, setAuthFailHandler } from "./api.js";
import { store } from "./store.js";
import { sound } from "./sound.js";
import { h, $, clear, avatar, toast, arNum, relTime, fullDate, moodChip } from "./ui.js";
import { PEOPLE, other, MOODS, moodEmoji, DUA } from "./config.js";
import { loader, go, applyTheme, applyAccent } from "./helpers.js";
import { viewJournal, viewMoment, openCompose } from "./views/journal.js";
import { viewChat } from "./views/chat.js";
import { viewPlay } from "./views/play.js";
import { viewUs } from "./views/us.js";

const APP = () => document.getElementById("app");

/* ---------------- boot + router ---------------- */
let homeData = null;
store.init(); applyTheme(); applyAccent();
setAuthFailHandler(() => { store.clearAuth(); toast("انتهت الجلسة، افتحا من جديد"); go("lock"); });
window.addEventListener("hashchange", renderRoute);
window.addEventListener("pointerdown", () => sound.resume(), { once: true });
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  // when a new service worker takes control (an update shipped), reload once to pick up fresh assets
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (refreshing || !hadController) return; refreshing = true; location.reload(); });
  navigator.serviceWorker.register("sw.js").then((reg) => { try { reg.update(); } catch {} setInterval(() => { try { reg.update(); } catch {} }, 30 * 60 * 1000); }).catch(() => {});
}

(function boot() {
  const start = () => { if (store.token && store.person) { if (!location.hash) location.hash = "#/home"; renderRoute(); } else if (store.token) go("who"); else go("lock"); if (!location.hash) renderRoute(); };
  if (store.token && store.person && localStorage.getItem("yn_applock") === "on" && localStorage.getItem("yn_applock_pin")) appLockGate(start);
  else start();
})();

const TABS = [
  { key: "home", ic: "🏡", label: "البيت" },
  { key: "journal", ic: "📖", label: "يومياتنا" },
  { key: "chat", ic: "💬", label: "همس" },
  { key: "play", ic: "🎲", label: "نلعب" },
  { key: "us", ic: "💛", label: "نحن" },
];
let slideDir = "";
function navTo(route) { const seq = TABS.map((t) => t.key); const i = seq.indexOf(currentRoute()), j = seq.indexOf(route); if (i >= 0 && j >= 0 && i !== j) slideDir = j > i ? "slide-l" : "slide-r"; go(route); }
function currentRoute() { return (location.hash || "#/home").replace(/^#\//, "").split("/")[0]; }
function routeArg() { return (location.hash || "").replace(/^#\//, "").split("/")[1] || ""; }

function renderRoute() {
  const route = currentRoute();
  if (!store.token && route !== "lock") return go("lock");
  if (store.token && !store.person && !["who", "lock"].includes(route)) return go("who");
  switch (route) {
    case "lock": return viewLock();
    case "who": return viewWho();
    case "home": return shell("home", viewHome);
    case "journal": return shell("journal", viewJournal);
    case "chat": return shell("chat", viewChat);
    case "play": return shell("play", viewPlay);
    case "us": return shell("us", viewUs);
    case "moment": return viewMoment(routeArg());
    default: return go("home");
  }
}

function shell(active, viewFn) {
  const app = clear(APP());
  const content = h("div", { class: "view" + (slideDir ? " " + slideDir : "") });
  slideDir = "";
  app.appendChild(content);
  app.appendChild(tabbar(active));
  viewFn(content);
}
function tabbar(active) {
  const nav = h("nav", { class: "tabbar" }, ...TABS.map((t) => {
    const btn = h("button", { class: "tab" + (active === t.key ? " active" : ""), onclick: () => { sound.tab(); navTo(t.key); } }, h("span", { class: "ic" }, t.ic), t.label);
    if (t.key === "chat") btn.dataset.tab = "chat";
    return btn;
  }));
  refreshUnread(nav);
  return nav;
}
async function refreshUnread(nav) {
  try { const r = await api.chatUnread(); const n = (r.ok && r.data.unread) || 0; const btn = nav.querySelector('[data-tab="chat"]'); if (btn && n > 0 && !btn.classList.contains("active")) btn.appendChild(h("span", { class: "tab-badge" }, arNum(n))); } catch {}
}

/* ---------------- app-lock gate ---------------- */
function appLockGate(onOk) {
  const app = clear(APP());
  const err = h("div", { class: "err" });
  const pin = h("input", { class: "field pin", type: "password", inputmode: "numeric", maxLength: 4, placeholder: "····", autocomplete: "off" });
  const submit = () => { if (pin.value === localStorage.getItem("yn_applock_pin")) { sound.unlock(); onOk(); } else { err.textContent = "رمزٌ غير صحيح"; sound.error(); const b = $(".lock .box"); b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); pin.value = ""; } };
  pin.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  app.appendChild(h("div", { class: "lock view" },
    h("div", { class: "heart" }, "🔒"),
    h("div", { class: "brand", style: { fontSize: "clamp(38px,12vw,58px)" } }, "يومياتنا"),
    h("div", { class: "tag" }, "أدخلا رمز القفل"),
    h("div", { class: "box" }, pin, h("button", { class: "btn", onclick: submit }, "فتح"), err)));
  setTimeout(() => pin.focus(), 60);
}

/* ---------------- lock / who ---------------- */
function viewLock() {
  const app = clear(APP());
  const err = h("div", { class: "err" });
  const pin = h("input", { class: "field pin", type: "password", inputmode: "numeric", placeholder: "••••", autocomplete: "off", maxLength: 12 });
  async function submit() {
    sound.resume();
    const pass = pin.value.trim(); err.textContent = "";
    if (!pass) { err.textContent = __g("اكتب كلمة الفتح", "اكتبي كلمة الفتح"); return; }
    loader(true); const r = await api.unlock(pass); loader(false);
    if (r.ok && r.data.token) { store.setAuth(r.data.token, null); sound.unlock(); go("who"); }
    else if (r.status === 429) { err.textContent = "محاولاتٌ كثيرة — انتظرا قليلًا"; sound.error(); }
    else { err.textContent = "كلمة الفتح غير صحيحة"; sound.error(); const b = $(".lock .box"); b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); }
  }
  pin.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  app.appendChild(h("div", { class: "lock view" },
    h("div", { class: "heart" }, "🤍"),
    h("div", { class: "bism" }, "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيم"),
    h("div", { class: "brand" }, "يومياتنا"),
    h("div", { class: "tag" }, "عالمٌ صغيرٌ لنا… نحفظ فيه أجمل أيّامنا، ونمضي بها إلى رضا الله."),
    h("div", { class: "box" }, pin, h("button", { class: "btn", onclick: submit }, __g("ادخل بيتنا", "ادخلي بيتنا")), err)));
  setTimeout(() => pin.focus(), 50);
}
function viewWho() {
  const app = clear(APP());
  async function pick(person) {
    loader(true); const r = await api.chooseIdentity(person); loader(false);
    if (r.ok && r.data.token) { store.setAuth(r.data.token, person); sound.unlock(); go("home"); }
    else toast(__g("تعذّر الدخول، حاول مجددًا", "تعذّر الدخول، حاولي مجددًا"));
  }
  app.appendChild(h("div", { class: "lock view" },
    h("div", { class: "brand", style: { fontSize: "40px" } }, "مَن أنتِ الآن؟"),
    h("div", { class: "tag" }, "لنعرف صاحب كل كلمة 🤍"),
    h("div", { class: "who-cards" },
      h("button", { class: "who-card him", onclick: () => pick("him") }, avatar("him", "lg"), PEOPLE.him.name),
      h("button", { class: "who-card her", onclick: () => pick("her") }, avatar("her", "lg"), PEOPLE.her.name))));
}

/* ---------------- home ---------------- */
function greetWord() { const hr = new Date(Date.now() + 180 * 60000).getUTCHours(); if (hr < 5) return "ليلةٌ هانئة"; if (hr < 12) return "صباح الخير"; if (hr < 17) return "نهارٌ سعيد"; return "مساء الخير"; }
function greetIcon() { const hr = new Date(Date.now() + 180 * 60000).getUTCHours(); if (hr < 5) return "🌙"; if (hr < 12) return "🌤️"; if (hr < 17) return "☀️"; return "🌆"; }
function daysTogether() { const a = store.config.anniversary_date; if (!a) return null; const now = new Date(Date.now() + 180 * 60000); const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()); const ad = new Date(a + "T00:00:00Z"); return Math.max(0, Math.round((t - Date.UTC(ad.getUTCFullYear(), ad.getUTCMonth(), ad.getUTCDate())) / 86400000)); }
function dayIdx() { return Math.floor((Date.now() + 180 * 60000) / 86400000); }

async function viewHome(content) {
  renderHome(content, homeData, true);
  const [boot, rt, feed, otd] = await Promise.all([api.bootstrap(), api.ritualsToday(), api.feed(), api.onThisDay()]);
  if (boot.ok) store.setConfig(boot.data.config || {});
  homeData = { rt: rt.ok ? rt.data : null, latest: (feed.ok && feed.data.items[0]) || null, otd: (otd.ok && otd.data.items[0]) || null };
  renderHome(content, homeData, false);
}
function renderHome(content, d, loading) {
  const c = clear(content);
  const me = store.person, meName = PEOPLE[me]?.name || "";
  const refresh = () => { homeData = null; viewHome(content); };
  c.appendChild(h("div", { class: "home-head" },
    h("div", { class: "greet" }, h("div", { class: "hello" }, greetWord() + " يا " + meName + " " + greetIcon()), h("div", { class: "sub" }, fullDate(new Date().toISOString()))),
    h("div", { class: "avatars" }, avatar("him"), avatar("her"))));
  const dt = daysTogether();
  if (dt != null) c.appendChild(h("div", { style: { textAlign: "center", margin: "2px 0 14px" } }, h("span", { class: "together" }, "🤍 معًا منذ " + arNum(dt) + " يومًا")));

  c.appendChild(h("button", { class: "hero-note", onclick: () => openCompose({ onDone: refresh }) },
    h("div", { class: "hn-t" }, __g("بماذا تشعر اليوم؟", "بماذا تشعرين اليوم؟")),
    h("div", { class: "hn-s" }, "دوّنا لحظةً تبقى… كلمة، صورة، أو خاطرة عابرة."),
    h("span", { class: "hn-cta" }, "✍️ " + __g("اكتب لحظة", "اكتبي لحظة"))));

  c.appendChild(h("div", { class: "quick" },
    tile("📖", "يومياتنا", () => navTo("journal")),
    tile("💬", "همس", () => navTo("chat")),
    tile("🎲", "نلعب", () => navTo("play")),
    tile("💛", "نحن", () => navTo("us"))));

  const rt = d && d.rt;
  if (rt && rt.question) c.appendChild(h("div", { class: "card home-card", onclick: () => navTo("play") },
    h("div", { class: "hc-head" }, h("span", { class: "em" }, "🌟"), "سؤال اليوم", h("span", { class: "go" }, "العب ‹")),
    h("div", { class: "qa-q" }, rt.question),
    rt.prompt && rt.prompt.mine == null
      ? h("span", { class: "btn sm", style: { width: "auto" } }, __g("أجِب الآن", "أجيبي الآن"))
      : h("div", { class: "muted", style: { fontSize: "13px" } }, rt.prompt && rt.prompt.revealed ? "انكشفت إجاباتكما 💛" : "أجبت — بانتظار الطرف الآخر")));

  const mem = (d && (d.otd || d.latest)) || null;
  if (mem) {
    const photo = (mem.media || []).find((m) => m.kind === "photo" && m.signed_url);
    c.appendChild(h("div", { class: "card home-card", onclick: () => go("moment/" + mem.id) },
      h("div", { class: "hc-head" }, h("span", { class: "em" }, d.otd ? "🔁" : "📖"), d.otd ? "في مثل هذا اليوم" : "آخر ذكرى", h("span", { class: "go" }, "‹")),
      h("div", { class: "mem-row" },
        photo ? h("img", { class: "mem-thumb", src: photo.signed_url, alt: "" }) : h("div", { class: "mem-thumb ph" }, moodEmoji(mem.mood) || "🌙"),
        h("div", { class: "mem-body" }, h("div", { class: "mt" }, mem.body || "لحظةٌ بلا كلمات"), h("div", { class: "md" }, (PEOPLE[mem.author]?.name || "") + " · " + relTime(mem.created_at))))));
  } else if (!loading) {
    c.appendChild(h("div", { class: "card home-card empty-inline", onclick: () => openCompose({ onDone: refresh }) },
      h("div", { style: { fontSize: "40px", marginBottom: "6px" } }, "🌱"),
      h("div", { class: "muted" }, __g("لا ذكرياتٍ بعد… ابدأ أولى لحظاتكما.", "لا ذكرياتٍ بعد… ابدئي أولى لحظاتكما."))));
  }

  const dua = DUA[dayIdx() % DUA.length];
  c.appendChild(h("div", { class: "card home-card dua-card" }, h("div", { class: "dq" }, dua), h("div", { class: "dl" }, "دعوةُ اليوم 🤲")));
}
function tile(emoji, label, onclick) { return h("button", { class: "q-tile", onclick }, h("span", { class: "qe" }, emoji), h("span", { class: "ql" }, label)); }
