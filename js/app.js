// يومياتنا — warm romantic app. Shell + router; mounts the tab views.
import { api, setAuthFailHandler } from "./api.js";
import { store } from "./store.js";
import { sound } from "./sound.js";
import { h, $, clear, avatar, toast, arNum, relTime, fullDate, moodChip, hijriDate, hijriParts, confetti, sparkleAt, clickable } from "./ui.js";
import { PEOPLE, other, MOODS, moodEmoji, DUA, DUA_FOR_SPOUSE } from "./config.js";
import { loader, go, applyTheme, applyAccent, applyBackground, openSheet, openModal, hashPin, confirmAsk, encryptWithPin, decryptWithPin } from "./helpers.js";
import { SWEET_LINES, DATE_IDEAS, CONVO_DECK } from "./games.js";
import { viewJournal, viewMoment, openCompose } from "./views/journal.js";
import { viewChat } from "./views/chat.js";
import { viewPlay } from "./views/play.js";
import { viewUs } from "./views/us.js";

const APP = () => document.getElementById("app");

/* ---------------- boot + router ---------------- */
let homeData = null;
store.init(); applyTheme(); applyBackground();
setAuthFailHandler(() => { store.clearAuth(); toast("انتهت الجلسة، افتحا من جديد"); go("lock"); });
window.addEventListener("hashchange", renderRoute);
window.addEventListener("pointerdown", () => sound.resume(), { once: true });
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  // when a new service worker takes control (an update shipped), reload once to pick up fresh assets
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (refreshing || !hadController) return; refreshing = true; location.reload(); });
  // a tapped notification asks us to open a specific screen
  navigator.serviceWorker.addEventListener("message", (e) => { const u = e.data && e.data.nav; if (typeof u === "string") { location.hash = u.includes("#") ? u.slice(u.indexOf("#")) : "#/home"; } });
  navigator.serviceWorker.register("sw.js").then((reg) => { try { reg.update(); } catch {} setInterval(() => { try { reg.update(); } catch {} }, 30 * 60 * 1000); }).catch(() => {});
}

const TABS = [
  { key: "home", ic: "🏡", label: "البيت" },
  { key: "journal", ic: "📖", label: "يومياتنا" },
  { key: "chat", ic: "💬", label: "همس" },
  { key: "play", ic: "🎲", label: "نلعب" },
  { key: "us", ic: "💛", label: "نحن" },
];
let slideDir = "";

(function boot() {
  const start = () => { if (store.token && store.person) { if (!location.hash) location.hash = "#/home"; renderRoute(); } else if (store.token) go("who"); else go("lock"); if (!location.hash) renderRoute(); };
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
  const content = h("main", { id: "main", class: "view" + (slideDir ? " " + slideDir : "") });
  slideDir = "";
  app.appendChild(content);
  app.appendChild(tabbar(active));
  viewFn(content);
}
function tabbar(active) {
  const nav = h("nav", { class: "tabbar", "aria-label": "التنقّل" }, ...TABS.map((t) => {
    const isOn = active === t.key;
    const btn = h("button", { class: "tab" + (isOn ? " active" : ""), "aria-label": t.label, "aria-current": isOn ? "page" : null, onclick: () => { sound.tab(); navTo(t.key); } }, h("span", { class: "ic" }, t.ic), t.label);
    if (t.key === "chat") btn.dataset.tab = "chat";
    return btn;
  }));
  refreshUnread(nav);
  return nav;
}
async function refreshUnread(nav) {
  try { const r = await api.chatUnread(); const n = (r.ok && r.data.unread) || 0; const btn = nav.querySelector('[data-tab="chat"]'); if (btn && n > 0 && !btn.classList.contains("active")) btn.appendChild(h("span", { class: "tab-badge", "aria-label": "رسائل غير مقروءة" }, arNum(n))); } catch {}
}

/* ---------------- app-lock gate ---------------- */
function appLockGate(onOk) {
  const app = clear(APP());
  const err = h("div", { class: "err" });
  const pin = h("input", { class: "field pin", type: "password", inputmode: "numeric", maxLength: 4, placeholder: "····", autocomplete: "off" });
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
    h("div", { class: "heart" }, "🔒"),
    h("div", { class: "brand", style: { fontSize: "clamp(38px,12vw,58px)" } }, "يومياتنا"),
    h("div", { class: "tag" }, "أدخلا رمز القفل"),
    h("div", { class: "box" }, pin, h("button", { class: "btn", onclick: submit }, "فتح"), err),
    h("button", { class: "btn ghost sm", style: { marginTop: "14px" }, onclick: async () => { if (await confirmAsk("نسيتما الرمز؟ سنعيدكما إلى كلمة الفتح.", { okText: "متابعة" })) { ["yn_applock", "yn_applock_pin", "yn_applock_salt", "yn_applock_hash", "yn_token_enc"].forEach((k) => localStorage.removeItem(k)); store.clearAuth(); go("lock"); location.reload(); } } }, "نسيتما الرمز؟")));
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

function nowLocal() { return new Date(Date.now() + 180 * 60000); }
function weekIdx() { return Math.floor(dayIdx() / 7); }

async function viewHome(content) {
  renderHome(content, homeData, true);
  const [boot, rt, feed, otd, ms, letters, playlist] = await Promise.all([
    api.bootstrap(), api.ritualsToday(), api.feed(), api.onThisDay(), api.milestones(), api.listLetters(), api.listPlaylist()]);
  if (boot.ok) { store.setConfig(boot.data.config || {}); applyBackground(); }
  if (feed.ok) store.cacheFeed(feed.data.items);
  homeData = {
    rt: rt.ok ? rt.data : null,
    feed: feed.ok ? feed.data.items : store.cachedFeed(),
    latest: (feed.ok && feed.data.items[0]) || store.cachedFeed()[0] || null,
    otd: (otd.ok && otd.data.items[0]) || null,
    ms: ms.ok ? ms.data : null,
    letters: letters.ok ? letters.data.items : [],
    playlist: playlist.ok ? playlist.data.items : [],
    offline: feed.offline,
  };
  renderHome(content, homeData, false);
}

function renderHome(content, d, loading) {
  const c = clear(content);
  const me = store.person, meName = PEOPLE[me]?.name || "", partner = other(me);
  const refresh = () => { homeData = null; viewHome(content); };

  // header
  c.appendChild(h("div", { class: "home-head" },
    h("div", { class: "greet" },
      h("h1", { class: "hello", style: { margin: 0 } }, greetWord() + " يا " + meName + " " + greetIcon()),
      h("div", { class: "sub" }, fullDate(new Date().toISOString()), " · ", h("span", { class: "hijri" }, hijriDate()))),
    h("div", { class: "avatars" }, avatar("him"), avatar("her"))));

  // together + streak
  const dt = daysTogether();
  const streak = (d && d.ms && d.ms.streak_current) || 0;
  if (dt != null || streak > 0) {
    const row = h("div", { class: "head-meta" });
    if (dt != null) row.appendChild(h("span", { class: "together" }, "🤍 معًا منذ " + arNum(dt) + " يومًا"));
    if (streak > 0) row.appendChild(h("span", { class: "streak-chip" }, "🔥 " + arNum(streak) + " يومًا متتاليًا"));
    c.appendChild(row);
  }
  if (d && d.offline) c.appendChild(h("div", { class: "offline-banner" }, "🌙 أنتما دون اتصال — نعرض آخر ما حُفظ"));

  // Islamic occasion ribbon
  const occ = occasionToday();
  if (occ && localStorage.getItem("yn_occ_seen") !== occ.key) {
    const card = h("div", { class: "card home-card occasion-card" },
      h("span", { class: "oe" }, occ.emoji),
      h("div", { class: "ob" }, h("b", {}, occ.title), h("span", {}, occ.sub)),
      h("button", { class: "ox", "aria-label": "إخفاء", onclick: () => { localStorage.setItem("yn_occ_seen", occ.key); card.remove(); } }, "✕"));
    c.appendChild(card);
  }

  // auto-celebration (monthiversary / round day)
  const cel = isMilestoneToday(dt);
  if (cel && localStorage.getItem("yn_celebrated") !== cel.key) {
    c.appendChild(h("div", { class: "card home-card celebrate-card" }, h("div", { class: "ct" }, cel.title), h("div", { class: "cs" }, cel.sub)));
    localStorage.setItem("yn_celebrated", cel.key);
    setTimeout(() => { confetti(); sound.post(); }, 350);
  }

  // hero compose
  c.appendChild(h("button", { class: "hero-note", onclick: () => openCompose({ onDone: refresh }) },
    h("div", { class: "hn-t" }, __g("بماذا تشعر اليوم؟", "بماذا تشعرين اليوم؟")),
    h("div", { class: "hn-s" }, "دوّنا لحظةً تبقى… كلمة، صورة، أو خاطرة عابرة."),
    h("span", { class: "hn-cta" }, "✍️ " + __g("اكتب لحظة", "اكتبي لحظة"))));

  // quick tiles
  c.appendChild(h("div", { class: "quick" },
    tile("📖", "يومياتنا", () => navTo("journal")),
    tile("💬", "همس", () => navTo("chat")),
    tile("🎲", "نلعب", () => navTo("play")),
    tile("💛", "نحن", () => navTo("us"))));

  // waiting-today cards
  if (d) {
    const now = Date.now();
    const openable = (d.letters || []).find((L) => !L.opened_at && new Date(L.unlock_at).getTime() <= now);
    if (openable) c.appendChild(waitCard("💌", "رسالةٌ جاهزة لتُفتح", "من " + (PEOPLE[openable.author]?.name || ""), () => go("us/letters")));
    const cds = (d.rt && d.rt.countdowns) || [];
    const soon = cds.map((cd) => ({ cd, days: Math.ceil((new Date(cd.target_date).getTime() - now) / 86400000) }))
      .filter((x) => x.days >= 0 && x.days <= 7).sort((a, b) => a.days - b.days)[0];
    if (soon) c.appendChild(waitCard(soon.cd.emoji || "⏳", soon.cd.title, soon.days === 0 ? "اليوم! 🎉" : "بعد " + arNum(soon.days) + " يوم", () => go("us/calendar")));
    const theirMood = d.rt && d.rt.checkin ? d.rt.checkin.theirs : null;
    if (theirMood && ["شوق", "حنين", "متعب بس ممنون"].includes(theirMood)) {
      const feel = partner === "her" ? "تشعر" : "يشعر", toThem = partner === "her" ? "لها" : "له";
      c.appendChild(waitCard(moodEmoji(theirMood) || "🤍", PEOPLE[partner].name + " " + feel + " بـ" + theirMood + " اليوم", __g("أرسل", "أرسلي") + " " + toThem + " لمسة 🤍", () => navTo("chat")));
    }
  }

  // one-tap mood
  if (d && d.rt && d.rt.checkin && d.rt.checkin.mine == null) {
    const wrap = h("div", { class: "card home-card" }, h("div", { class: "hc-head" }, h("span", { class: "em" }, "🌈"), __g("كيف تشعر اليوم؟", "كيف تشعرين اليوم؟")));
    wrap.appendChild(h("div", { class: "quick-mood" }, ...MOODS.slice(0, 6).map(([label, emo]) =>
      h("button", { class: "chip", onclick: async () => { const r = await api.setCheckin(label, null); if (r.ok) { sound.react(); toast("سُجّل مزاجك 🌈"); refresh(); } } }, emo + " " + label))));
    c.appendChild(wrap);
  }

  // daily question
  const rt = d && d.rt;
  if (rt && rt.question) c.appendChild(clickable(h("div", { class: "card home-card act", onclick: () => navTo("play") },
    h("div", { class: "hc-head" }, h("span", { class: "em" }, "🌟"), "سؤال اليوم", h("span", { class: "go" }, "العب ‹")),
    h("div", { class: "qa-q" }, rt.question),
    rt.prompt && rt.prompt.mine == null
      ? h("span", { class: "btn sm", style: { width: "auto" } }, __g("أجِب الآن", "أجيبي الآن"))
      : h("div", { class: "muted", style: { fontSize: "13px" } }, rt.prompt && rt.prompt.revealed ? "انكشفت إجاباتكما 💛" : "أجبت — بانتظار الطرف الآخر")), () => navTo("play")));

  // daily surprise
  if (d) c.appendChild(surpriseCard(d));

  // song of the week
  const songs = (d && d.playlist) || [];
  if (songs.length) {
    const s = songs[weekIdx() % songs.length];
    c.appendChild(clickable(h("div", { class: "card home-card act", onclick: () => (s.url ? window.open(s.url, "_blank", "noreferrer") : go("us/songs")) },
      h("div", { class: "hc-head" }, h("span", { class: "em" }, "🎵"), "أغنية أسبوعنا", h("span", { class: "go" }, "‹")),
      h("div", { class: "song-pill" }, h("span", { class: "cassette" }, "🎵"), h("div", { class: "meta" }, h("b", {}, s.title), h("span", { class: "muted" }, (s.artist || "") + " · " + (PEOPLE[s.added_by]?.name || ""))))),
      () => (s.url ? window.open(s.url, "_blank", "noreferrer") : go("us/songs"))));
  }

  // daily sweet-word to chat
  const sweet = SWEET_LINES[dayIdx() % SWEET_LINES.length];
  const line = partner === "her" ? sweet.f : sweet.m;
  c.appendChild(h("div", { class: "card home-card" },
    h("div", { class: "hc-head" }, h("span", { class: "em" }, "💌"), "بادرة اليوم"),
    h("div", { style: { fontFamily: "var(--font-quote)", fontSize: "17px", lineHeight: "1.9", marginBottom: "10px" } }, line),
    h("button", { class: "btn sm", style: { width: "auto" }, onclick: async () => { const r = await api.sendMessage({ kind: "text", body: line }); if (r.ok) { sound.post(); sparkleAt(innerWidth / 2, innerHeight / 2, ["💌", "💗", "🤍"]); toast("أُرسلت إلى همس 💌"); } else toast("تعذّر الإرسال"); } }, "أرسلها الآن ✨")));

  // recent memory / on this day
  const mem = (d && (d.otd || d.latest)) || null;
  if (mem) {
    const photo = (mem.media || []).find((m) => m.kind === "photo" && m.signed_url);
    c.appendChild(clickable(h("div", { class: "card home-card act", onclick: () => go("moment/" + mem.id) },
      h("div", { class: "hc-head" }, h("span", { class: "em" }, d.otd ? "🔁" : "📖"), d.otd ? "في مثل هذا اليوم" : "آخر ذكرى", h("span", { class: "go" }, "‹")),
      h("div", { class: "mem-row" },
        photo ? h("img", { class: "mem-thumb", src: photo.signed_url, alt: "" }) : h("div", { class: "mem-thumb ph" }, moodEmoji(mem.mood) || "🌙"),
        h("div", { class: "mem-body" }, h("div", { class: "mt" }, mem.body || "لحظةٌ بلا كلمات"), h("div", { class: "md" }, (PEOPLE[mem.author]?.name || "") + " · " + relTime(mem.created_at))))), () => go("moment/" + mem.id)));
  } else if (!loading) {
    c.appendChild(h("div", { class: "card home-card empty-inline", onclick: () => openCompose({ onDone: refresh }) },
      h("div", { style: { fontSize: "40px", marginBottom: "6px" } }, "🌱"),
      h("div", { class: "muted" }, __g("لا ذكرياتٍ بعد… ابدأ أولى لحظاتكما.", "لا ذكرياتٍ بعد… ابدئي أولى لحظاتكما."))));
  }

  // du'a of the day
  const dua = DUA[dayIdx() % DUA.length];
  c.appendChild(h("div", { class: "card home-card dua-card" }, h("div", { class: "dq" }, dua), h("div", { class: "dl" }, "دعوةُ اليوم 🤲")));

  // weekly recap (once per week)
  if (d && d.feed && localStorage.getItem("yn_recap_week") !== String(weekIdx())) {
    c.appendChild(waitCard("🤍", "ملخّص أسبوعنا", "طُويت صفحةُ أسبوع — افتحاه", () => { localStorage.setItem("yn_recap_week", String(weekIdx())); openRecap(d); }));
  }

  function waitCard(emoji, title, sub, onClick) {
    const card = h("div", { class: "card home-card wait-card act", onclick: onClick },
      h("span", { class: "we" }, emoji), h("div", { class: "wb" }, h("b", {}, title), h("span", {}, sub)), h("span", { class: "go" }, "‹"));
    return clickable(card, onClick);
  }
  function surpriseCard(d) {
    const key = String(dayIdx());
    const item = pickSurprise(d);
    if (!item) return h("span", { class: "hidden" });
    if (localStorage.getItem("yn_surprise_day") === key) {
      return h("div", { class: "card home-card" }, h("div", { class: "hc-head" }, h("span", { class: "em" }, "🎁"), item.title), h("div", { class: "surprise-open" }, item.text));
    }
    const open = () => {
      localStorage.setItem("yn_surprise_day", key); sound.post(); sparkleAt(innerWidth / 2, innerHeight / 3, ["🎁", "✨", "💛", "🤍"]);
      openModal({ title: item.title, body: [h("div", { class: "surprise-open" }, item.text), item.cta ? h("button", { class: "btn", style: { marginTop: "14px" }, onclick: item.cta.fn }, item.cta.label) : null] });
    };
    const card = h("div", { class: "card home-card surprise-card", onclick: open }, h("div", { class: "st" }, "🎁 مفاجأة اليوم"), h("div", { class: "ss" }, "اضغطا لكشفها 🤍"));
    return clickable(card, open);
  }
}

function pickSurprise(d) {
  const pool = [];
  const mems = (d && d.feed) || [];
  if (mems.length) { const m = mems[dayIdx() % mems.length]; if (m && m.body) pool.push({ title: "ذكرى منكما 📖", text: "“" + m.body + "”", cta: { label: "افتح اللحظة", fn: () => go("moment/" + m.id) } }); }
  pool.push({ title: "سؤالٌ لكما 🃏", text: CONVO_DECK[dayIdx() % CONVO_DECK.length] });
  pool.push({ title: "فكرة سهرة 🎡", text: DATE_IDEAS[dayIdx() % DATE_IDEAS.length] });
  pool.push({ title: "دعوةٌ لكما 🤲", text: DUA_FOR_SPOUSE[dayIdx() % DUA_FOR_SPOUSE.length] });
  return pool.length ? pool[dayIdx() % pool.length] : null;
}

function openRecap(d) {
  const now = Date.now();
  const week = (d.feed || []).filter((m) => now - new Date(m.created_at).getTime() <= 7 * 86400000);
  const photos = week.reduce((n, m) => n + ((m.media || []).filter((x) => x.kind === "photo").length), 0);
  const moods = {}; week.forEach((m) => { if (m.mood) moods[m.mood] = (moods[m.mood] || 0) + 1; });
  const top = Object.entries(moods).sort((a, b) => b[1] - a[1])[0];
  const stat = (e, n, l) => h("div", { class: "ms-stat" }, h("span", { class: "mss-e" }, e), h("b", {}, arNum(n)), h("span", { class: "muted" }, l));
  openSheet({ title: "ملخّص أسبوعنا 🤍", subtitle: "طُويت صفحةُ أسبوعٍ جميل", body: [
    h("div", { class: "ms-stats" }, stat("📔", week.length, "لحظة"), stat("📸", photos, "صورة"), stat("🔥", (d.ms && d.ms.streak_current) || 0, "سلسلة"), stat("💛", (d.ms && d.ms.days_together) || 0, "يوم")),
    top ? h("div", { class: "muted", style: { textAlign: "center", marginTop: "12px" } }, "أكثر شعورٍ هذا الأسبوع: " + moodEmoji(top[0]) + " " + top[0]) : null] });
}

function occasionToday() {
  const hp = hijriParts(); if (!hp) return null;
  const { day, month } = hp;
  const dow = nowLocal().getUTCDay();
  const mk = (emoji, title, sub, key) => ({ emoji, title, sub, key });
  if (month === 9) { if (day >= 21) return mk("🌙", "العشر الأواخر من رمضان", "تحرّيا ليلة القدر وأكثرا من الدعاء", "occ-ram-last-" + day); return mk("🌙", "رمضان مبارك", "تقبّل الله صيامكما وقيامكما", "occ-ramadan"); }
  if (month === 10 && day === 1) return mk("🎉", "عيد الفطر المبارك", "تقبّل الله منّا ومنكم", "occ-eidfitr");
  if (month === 12 && day <= 10) { if (day === 9) return mk("🕋", "يوم عرفة", "صيامٌ يكفّر سنتين — وأكثرا من الدعاء", "occ-arafah"); if (day === 10) return mk("🎉", "عيد الأضحى المبارك", "تقبّل الله منّا ومنكم", "occ-eidadha"); return mk("🕋", "عشر ذي الحجة", "أفضل أيام الدنيا — أكثرا من الذكر", "occ-dhj-" + day); }
  if (month === 1 && day === 1) return mk("🌙", "رأس السنة الهجرية", "عامٌ هجريٌّ مبارك", "occ-hijri-new");
  if (month === 1 && day === 10) return mk("🤍", "عاشوراء", "صيامٌ يكفّر السنة الماضية", "occ-ashura");
  if (dow === 5) return mk("🕌", "جمعةٌ مباركة", "سورة الكهف والصلاة على النبي ﷺ", "occ-fri-" + dayIdx());
  if (day === 13 || day === 14 || day === 15) return mk("🌕", "أيام البيض", "صيام ثلاثة أيام من كل شهر سنّة", "occ-white-" + month + "-" + day);
  return null;
}

function isMilestoneToday(dt) {
  if (dt == null || dt <= 0) return null;
  if (dt % 365 === 0) return { title: "🎉 " + arNum(dt / 365) + " سنة معًا!", sub: "كل عام وأنتما بخير 🤍", key: "cel-" + dt };
  if (dt % 100 === 0) return { title: "💯 " + arNum(dt) + " يوم معًا!", sub: "مبارك لكما هذا اليوم", key: "cel-" + dt };
  const ann = store.config.anniversary_date;
  if (ann) {
    const now = nowLocal(), annDay = Number(ann.slice(8, 10));
    if (now.getUTCDate() === annDay && dt < 365 && dt % 30 !== 0) {
      const months = Math.round(dt / 30.4);
      if (months >= 1) return { title: "🌙 " + arNum(months) + " أشهر معًا", sub: "تمرّ الأيام وأنتما أجمل", key: "cel-mo-" + now.getUTCFullYear() + "-" + now.getUTCMonth() };
    }
  }
  return null;
}

function tile(emoji, label, onclick) { return h("button", { class: "q-tile", onclick }, h("span", { class: "qe" }, emoji), h("span", { class: "ql" }, label)); }
