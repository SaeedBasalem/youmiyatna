// يومياتنا — app orchestrator: router + views + compose.
import { api, setAuthFailHandler } from "./api.js";
import { store } from "./store.js";
import { sound } from "./sound.js";
import {
  h, $, clear, avatar, personChip, moodChip, toast, confetti, sparkleAt, heartFly,
  relTime, fullDate, monthYear, arNum,
} from "./ui.js";
import { PEOPLE, other, MOODS, moodEmoji, REACTIONS, BADGES, DUA, ACCENTS } from "./config.js";
import { downscale, openDoodle, VoiceRecorder, uploadSigned } from "./media.js";
import { realtime } from "./realtime.js";
import { push } from "./push.js";
import { applyTheme, setTheme, setAccent } from "./theme.js";
import { viewChat, chatOnMessage, chatOnTyping, chatOnRead, isChatActive } from "./chat.js";
import { viewRituals } from "./rituals.js";
import { viewLetters } from "./letters.js";
import { viewPlan } from "./plan.js";
import { viewLists } from "./lists.js";
import { viewSpiritual, spiritualOnDhikr, hijriShort } from "./spiritual.js";
import { viewPlaylist } from "./playlist.js";
import { viewSearch } from "./ai.js";
import { viewGarden } from "./garden.js";
import { appLock } from "./applock.js";

const APP = () => document.getElementById("app");
const go = (route) => { location.hash = "#/" + route; };
function loader(on) {
  let l = $("#loader");
  if (on) { if (!l) document.body.appendChild(h("div", { id: "loader", class: "loader" }, h("div", { class: "spinner" }))); }
  else if (l) l.remove();
}
// module state (declared before boot() so a returning logged-in user never hits a TDZ)
let feedItems = [], feedNode = null, chatUnread = 0, liveWired = false, homeRitual = null;

/* ---------------- app-lock (local PIN/biometric) ---------------- */
function showAppLock() {
  if ($("#applock")) return;
  const err = h("div", { class: "err" });
  const pin = h("input", { class: "field pin", type: "password", inputmode: "numeric", placeholder: "••••", maxLength: 8, autocomplete: "off" });
  async function bio() { try { await appLock.verifyBio(); appLock.markUnlocked(); ov.remove(); } catch { err.textContent = "تعذّرت البصمة"; } }
  async function submit() { if (await appLock.tryPin(pin.value.trim())) { appLock.markUnlocked(); ov.remove(); } else { err.textContent = "رمز خاطئ"; pin.value = ""; const c = ov.querySelector(".cover"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); } }
  pin.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  const ov = h("div", { id: "applock", class: "applock-ov" }, h("div", { class: "cover" },
    h("div", { style: { fontSize: "44px" } }, "🔒"),
    h("div", { class: "tag" }, __g("أدخل رمز القفل","أدخلي رمز القفل")),
    pin, h("button", { class: "btn sun", onclick: submit }, __g("افتح","افتحي")),
    appLock.hasBio() ? h("button", { class: "btn ghost", style: { marginTop: "8px" }, onclick: bio }, "🔑 البصمة") : null, err));
  document.body.appendChild(ov);
  setTimeout(() => pin.focus(), 50);
  if (appLock.hasBio()) bio();
}
function appLockSetup() {
  const pin = h("input", { class: "field pin", type: "password", inputmode: "numeric", placeholder: "رمز (٤-٨ أرقام)", maxLength: 8 });
  const pin2 = h("input", { class: "field pin", type: "password", inputmode: "numeric", placeholder: "تأكيد الرمز", maxLength: 8 });
  const err = h("div", { class: "err" });
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" }, h("h3", {}, "قفل التطبيق 🔒"), pin, h("div", { style: { height: "8px" } }), pin2, err,
    h("div", { class: "attach-rail", style: { marginTop: "14px" } },
      h("button", { class: "btn ghost", onclick: () => sc.remove() }, "إلغاء"),
      h("button", { class: "btn sun", onclick: async () => { const a = pin.value.trim(), b = pin2.value.trim(); if (a.length < 4) { err.textContent = "٤ أرقام على الأقل"; return; } if (a !== b) { err.textContent = "غير متطابق"; return; } await appLock.setup(a); sc.remove(); toast("فُعّل القفل 🔒"); renderRoute(); } }, __g("فعّل","فعّلي")))));
  document.body.appendChild(sc);
}

/* ---------------- boot + router ---------------- */
store.init();
applyTheme();
setAuthFailHandler(() => { store.clearAuth(); toast(__g("انتهت الجلسة، افتح من جديد","انتهت الجلسة، افتحي من جديد")); go("lock"); });
window.addEventListener("hashchange", renderRoute);
window.addEventListener("pointerdown", () => sound.resume(), { once: true });
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
navigator.serviceWorker?.addEventListener?.("message", (e) => { const nav = e.data?.nav; if (nav) location.hash = nav.includes("#") ? nav.slice(nav.indexOf("#")) : "#/feed"; });
document.addEventListener("visibilitychange", () => { if (document.hidden) appLock.lockNow(); else if (appLock.isLocked()) showAppLock(); });

(function boot() {
  if (appLock.isLocked()) showAppLock();
  if (store.token && store.person) { if (!location.hash) location.hash = "#/feed"; renderRoute(); refreshConfig(); initLive(); }
  else if (store.token) go("who");
  else go("lock");
  if (!location.hash) renderRoute();
})();

function renderRoute() {
  const parts = (location.hash || "#/lock").replace(/^#\//, "").split("/");
  const route = parts[0] || "lock";
  if (!store.token && route !== "lock") return go("lock");
  if (store.token && !store.person && !["who", "lock"].includes(route)) return go("who");
  switch (route) {
    case "lock": return viewLock();
    case "who": return viewWho();
    case "feed": return shell("feed", viewFeed);
    case "chat": chatUnread = 0; return shell("chat", viewChat);
    case "hub": return shell("hub", viewHub);
    case "rituals": return shell("rituals", viewRituals);
    case "letters": return shell("letters", viewLetters);
    case "plan": return shell("plan", viewPlan);
    case "lists": return shell("lists", viewLists);
    case "spiritual": return shell("spiritual", viewSpiritual);
    case "playlist": return shell("playlist", viewPlaylist);
    case "search": return shell("search", viewSearch);
    case "garden": return shell("garden", viewGarden);
    case "timeline": return shell("timeline", viewTimeline);
    case "milestones": return shell("milestones", viewMilestones);
    case "me": return shell("me", viewMe);
    case "moment": return viewMoment(parts[1]);
    default: return go("feed");
  }
}
async function refreshConfig() {
  const r = await api.bootstrap();
  if (r.ok) { store.setConfig(r.data.config || {}); const bar = $(".topbar"); if (bar && $(".days-badge", bar)) bar.replaceWith(topbar()); }
}

/* ---------------- shell (topbar + tabbar) ---------------- */
function shell(active, viewFn) {
  const app = clear(APP());
  app.appendChild(topbar());
  const content = h("div", { class: "view" });
  app.appendChild(content);
  app.appendChild(tabbar(active));
  viewFn(content);
}
function daysTogether() {
  const a = store.config.anniversary_date; if (!a) return null;
  const now = new Date(Date.now() + 180 * 60000);
  const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ad = new Date(a + "T00:00:00Z");
  const t0 = Date.UTC(ad.getUTCFullYear(), ad.getUTCMonth(), ad.getUTCDate());
  return Math.max(0, Math.round((t - t0) / 86400000));
}
function topbar() {
  const d = daysTogether();
  const badge = h("button", { class: "days-badge", onclick: () => go("milestones") },
    "🌙 معًا منذ ", h("b", {}, d == null ? "—" : arNum(d)), d == null ? "" : " يومًا");
  const snd = h("button", { class: "icon-btn", onclick: (e) => { const on = sound.toggle(); e.currentTarget.textContent = on ? "🔊" : "🔇"; } }, store.soundOn ? "🔊" : "🔇");
  const on = realtime.partnerOnline();
  const suffix = other(store.person) === "her" ? " متصلة" : " متصل";
  const pres = h("span", { class: "presence" + (on ? " on" : "") }, h("span", { class: "presence-dot" }), on ? (PEOPLE[other(store.person)]?.name || "") + suffix : "");
  const hj = h("button", { class: "hijri-chip", onclick: () => go("spiritual") }, "☪ " + hijriShort());
  return h("div", { class: "topbar" }, badge, pres, h("span", { class: "spacer" }), hj, snd);
}
function tabbar(active) {
  const tab = (key, ic, label, route) => h("button", { class: "tab" + (active === key ? " active" : ""), onclick: () => { sound.tab(); go(route); } }, h("span", { class: "ic" }, ic), label);
  const chatTab = tab("chat", "💬", "همس", "chat");
  if (chatUnread > 0) chatTab.appendChild(h("span", { class: "tab-badge" }, chatUnread > 9 ? "٩+" : arNum(chatUnread)));
  return h("nav", { class: "tabbar" },
    tab("feed", "🏠", "البيت", "feed"),
    chatTab,
    h("button", { class: "tab compose", onclick: () => { sound.tab(); openCompose(); } }, h("span", { class: "plus" }, "＋")),
    tab("hub", "✦", "حياتنا", "hub"),
    tab("me", PEOPLE[store.person]?.initial || "أنا", "أنا", "me"),
  );
}

/* ---------------- live (realtime) ---------------- */
function currentRoute() { return (location.hash || "#/feed").replace(/^#\//, "").split("/")[0]; }
function updateChatBadge() { const tb = $(".tabbar"); if (tb) tb.replaceWith(tabbar(currentRoute())); }
function initLive() {
  realtime.init();
  api.chatUnread().then((r) => { if (r.ok) { chatUnread = r.data.unread || 0; updateChatBadge(); } });
  if (liveWired) return; liveWired = true;
  realtime.onPresence(() => { const bar = $(".topbar"); if (bar && $(".days-badge", bar)) bar.replaceWith(topbar()); });
  realtime.onEvent((p) => {
    if (p.type === "moment") { if (currentRoute() === "feed" && feedNode) viewFeed(feedNode); }
    else if (p.type === "message") { if (isChatActive()) chatOnMessage(); else { chatUnread++; updateChatBadge(); } }
    else if (p.type === "typing") { chatOnTyping(!!p.on); }
    else if (p.type === "read") { chatOnRead(); }
    else if (p.type === "event") { if (currentRoute() === "plan") { const c = $(".view"); if (c) viewPlan(clear(c)); } }
    else if (p.type === "list") { if (currentRoute() === "lists") { const c = $(".view"); if (c) viewLists(clear(c)); } }
    else if (p.type === "dhikr") { if (currentRoute() === "spiritual") spiritualOnDhikr(p); }
    else if (p.type === "spiritual") { if (currentRoute() === "spiritual") { const c = $(".view"); if (c) viewSpiritual(clear(c)); } }
    else if (p.type === "playlist") { if (currentRoute() === "playlist") { const c = $(".view"); if (c) viewPlaylist(clear(c)); } }
  });
}

/* ---------------- hub + chat ---------------- */
function comingSoon(title, emoji, desc) {
  return h("div", {},
    h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, title)),
    h("div", { class: "empty" }, h("div", { class: "big" }, emoji), h("div", {}, desc), h("div", { class: "dua" }, "قريبًا 🌱")));
}
function viewHub(content) {
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "حياتنا")));
  const cards = [
    { emoji: "📖", label: "حكايتنا", route: "timeline", on: true },
    { emoji: "🏆", label: "إنجازاتنا", route: "milestones", on: true },
    { emoji: "🌤️", label: "طقوسنا", route: "rituals", on: true },
    { emoji: "🗓️", label: "التقويم", route: "plan", on: true },
    { emoji: "🕌", label: "روحانياتنا", route: "spiritual", on: true },
    { emoji: "🌱", label: "حديقتنا", route: "garden", on: true },
    { emoji: "📝", label: "قوائمنا", route: "lists", on: true },
    { emoji: "🎵", label: "أغنياتنا", route: "playlist", on: true },
    { emoji: "✉️", label: "رسائل الغد", route: "letters", on: true },
    { emoji: "🔎", label: "بحث", route: "search", on: true },
  ];
  const grid = h("div", { class: "hub-grid" });
  cards.forEach((c) => grid.appendChild(h("button", { class: "hub-card" + (c.on ? "" : " soon"), onclick: () => { sound.tab(); if (c.on) go(c.route); else toast("قريبًا 🌱"); } },
    h("span", { class: "he" }, c.emoji), h("span", { class: "hl" }, c.label), c.on ? null : h("span", { class: "soon-tag" }, "قريبًا"))));
  content.appendChild(grid);
}

/* ---------------- lock / who ---------------- */
function viewLock() {
  const app = clear(APP());
  const err = h("div", { class: "err" });
  const pin = h("input", { class: "field pin", type: "password", inputmode: "numeric", placeholder: "••••••••", autocomplete: "off", maxLength: 12 });
  async function submit() {
    sound.resume();
    const pass = pin.value.trim();
    err.textContent = "";
    if (!pass) { err.textContent = __g("اكتب كلمة الفتح","اكتبي كلمة الفتح"); return; }
    loader(true);
    const r = await api.unlock(pass);
    loader(false);
    if (r.ok && r.data.token) { store.setAuth(r.data.token, null); sound.unlock(); go("who"); }
    else if (r.status === 429) { err.textContent = "محاولات كثيرة — انتظرا قليلًا"; sound.error(); }
    else { err.textContent = "كلمة الفتح غير صحيحة"; sound.error(); const card = $(".lock .box"); card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake"); }
  }
  pin.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  app.appendChild(h("div", { class: "lock view" },
    h("div", { class: "bism" }, "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيم"),
    h("div", { class: "brand" }, "يومياتنا"),
    h("div", { class: "tag" }, "عالمٌ صغيرٌ بيننا، نكتبه معًا، ونمضي به إلى رضا الله."),
    h("div", { class: "box" },
      pin,
      h("button", { class: "btn sun", onclick: submit }, __g("افتح الكتاب","افتحي الكتاب")),
      err,
    ),
  ));
  setTimeout(() => pin.focus(), 50);
}
function viewWho() {
  const app = clear(APP());
  async function pick(person) {
    loader(true);
    const r = await api.chooseIdentity(person);
    loader(false);
    if (r.ok && r.data.token) { store.setAuth(r.data.token, person); sound.unlock(); refreshConfig(); initLive(); go("feed"); }
    else toast(__g("تعذّر الدخول، حاول مجددًا","تعذّر الدخول، حاولي مجددًا"));
  }
  app.appendChild(h("div", { class: "lock view" },
    h("div", { class: "brand", style: { fontSize: "40px", textShadow: "4px 4px 0 var(--mint)" } }, "مين معنا؟"),
    h("div", { class: "tag" }, __g("اختر نفسك — لنعرف صاحب كل لحظة.","اختاري نفسكِ — لنعرف صاحب كل لحظة.")),
    h("div", { class: "who-cards" },
      h("button", { class: "who-card him", onclick: () => pick("him") }, avatar("him", "lg"), PEOPLE.him.name),
      h("button", { class: "who-card her", onclick: () => pick("her") }, avatar("her", "lg"), PEOPLE.her.name),
    ),
  ));
}

/* ---------------- feed ---------------- */
function groupReactions(rs) {
  const m = {};
  for (const r of rs || []) { (m[r.emoji] = m[r.emoji] || { count: 0, mine: false }).count++; if (r.actor === store.person) m[r.emoji].mine = true; }
  return m;
}
async function viewFeed(content) {
  feedNode = content;
  renderFeed(store.cachedFeed(), null, true);
  const [f, otd, rt] = await Promise.all([api.feed(), api.onThisDay(), api.ritualsToday()]);
  if (rt.ok) homeRitual = rt.data;
  if (f.ok) { feedItems = f.data.items || []; store.cacheFeed(feedItems); renderFeed(feedItems, otd.ok ? otd.data.items : []); }
  else if (f.offline) toast("غير متصل — نعرض المحفوظ");
}
function daysToDate(dateStr) { const t = new Date(dateStr + "T00:00:00Z").getTime(); const today = new Date(new Date(Date.now() + 180 * 60000).toISOString().slice(0, 10) + "T00:00:00Z").getTime(); return Math.round((t - today) / 86400000); }
function todayStrip(rt) {
  const strip = h("div", { class: "today-strip" });
  strip.appendChild(h("button", { class: "ts-q", onclick: () => go("rituals") }, h("span", { class: "ts-ic" }, "🌟"),
    h("div", { class: "ts-body" }, h("b", {}, "سؤال اليوم"), h("div", { class: "muted", style: { fontSize: "13px" } }, rt.question)),
    rt.prompt && rt.prompt.mine == null ? h("span", { class: "ts-cta" }, __g("أجِب","أجيبي")) : null));
  const up = (rt.countdowns || []).map((c) => ({ c, days: daysToDate(c.target_date) })).filter((x) => x.days >= 0).sort((a, b) => a.days - b.days)[0];
  if (up) strip.appendChild(h("button", { class: "ts-cd", onclick: () => go("rituals") }, h("span", {}, up.c.emoji || "🎉"), h("b", {}, up.c.title), h("span", { class: "ts-days" }, up.days === 0 ? "اليوم!" : arNum(up.days) + " يوم")));
  return strip;
}
function renderFeed(items, otd, loadingCache) {
  if (!feedNode) return;
  const c = clear(feedNode);
  c.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "البيت"),
    h("button", { class: "btn sm ghost", onclick: () => viewFeed(feedNode) }, "↻ تحديث")));
  if (homeRitual && !loadingCache) c.appendChild(todayStrip(homeRitual));
  if (otd && otd.length) {
    for (const e of otd) c.appendChild(momentCard(e, { flashback: true }));
  }
  if (!items || !items.length) {
    c.appendChild(h("div", { class: "empty" },
      h("div", { class: "big" }, "🌙"),
      h("div", {}, loadingCache ? "نحمّل لحظاتكما…" : "الصفحة بيضاء… خلّونا نبدأ حكايتنا."),
      h("div", { class: "dua" }, DUA[0]),
      loadingCache ? null : h("button", { class: "btn sun", style: { width: "auto", marginTop: "6px" }, onclick: () => openCompose() }, "＋ أضف أول لحظة"),
    ));
    return;
  }
  items.forEach((e) => c.appendChild(momentCard(e)));
}
function momentCard(e, opts = {}) {
  const p = PEOPLE[e.author] || PEOPLE.him;
  const card = h("div", { class: "moment " + p.cls + (opts.flashback ? " flashback tilt-none" : "") });
  if (opts.flashback) {
    const years = new Date().getFullYear() - new Date(e.happened_at).getFullYear();
    card.appendChild(h("div", { class: "ribbon" }, "🔁 في مثل هذا اليوم" + (years > 0 ? ` · قبل ${arNum(years)} سنة` : "")));
  }
  card.appendChild(h("div", { class: "m-head" }, personChip(e.author), moodChip(e.mood),
    h("span", { class: "when" }, relTime(e.created_at))));
  if (e.body) card.appendChild(h("div", { class: "m-body" }, e.body));
  const media = mediaBlock(e.media);
  if (media) card.appendChild(media);
  card.appendChild(momentFoot(e, card));
  // double-tap to heart
  card.addEventListener("dblclick", (ev) => { heartFly(ev.clientX, ev.clientY); toggleReact(e, "❤️", card); });
  // tap opens detail (ignore clicks on interactive controls / already in detail)
  card.addEventListener("click", (ev) => { if (opts.detail || ev.target.closest("button,audio,a,.react-pill")) return; go("moment/" + e.id); });
  return card;
}
function mediaBlock(media) {
  if (!media || !media.length) return null;
  const box = h("div", { class: "m-media" });
  const photos = media.filter((m) => m.kind === "photo" && m.signed_url);
  if (photos.length === 1) box.appendChild(h("img", { class: "m-photo", src: photos[0].signed_url, loading: "lazy", alt: "" }));
  else if (photos.length > 1) box.appendChild(carousel(photos));
  for (const m of media) {
    if (m.kind === "video" && m.signed_url) box.appendChild(h("video", { class: "m-video", src: m.signed_url, controls: true, preload: "metadata", playsInline: true }));
    else if (m.kind === "voice" && m.signed_url) box.appendChild(voicePill(m));
    else if (m.kind === "song") box.appendChild(songPill(m));
  }
  return box;
}
function carousel(photos) {
  const track = h("div", { class: "carousel-track" });
  photos.forEach((p) => track.appendChild(h("img", { class: "carousel-img", src: p.signed_url, loading: "lazy", alt: "" })));
  const dots = h("div", { class: "carousel-dots" });
  photos.forEach((_, i) => dots.appendChild(h("span", { class: "cdot" + (i === 0 ? " on" : "") })));
  track.addEventListener("scroll", () => { const idx = Math.round(Math.abs(track.scrollLeft) / track.clientWidth); dots.querySelectorAll(".cdot").forEach((d, i) => d.classList.toggle("on", i === idx)); });
  return h("div", { class: "carousel" }, track, dots);
}
function voicePill(m) {
  const audio = h("audio", { src: m.signed_url, preload: "none" });
  const bars = (m.meta && m.meta.bars) || Array.from({ length: 28 }, () => 0.3 + Math.random() * 0.5);
  const wave = h("div", { class: "wave" }, ...bars.map((v) => { const i = h("i"); i.style.height = Math.max(10, v * 100) + "%"; return i; }));
  const btn = h("button", { class: "play", onclick: () => { if (audio.paused) { audio.play(); btn.textContent = "⏸"; } else { audio.pause(); btn.textContent = "▶"; } } }, "▶");
  audio.addEventListener("ended", () => (btn.textContent = "▶"));
  return h("div", { class: "voice-pill" }, btn, wave, audio);
}
function songPill(m) {
  const meta = m.meta || {};
  const inner = h("div", { class: "song-pill" }, h("span", { class: "cassette" }, "🎵"),
    h("div", { class: "meta" }, h("b", {}, meta.title || "أغنية اللحظة"), h("span", { class: "muted" }, meta.artist || "")));
  return m.url ? h("a", { href: m.url, target: "_blank", rel: "noreferrer", style: { textDecoration: "none" } }, inner) : inner;
}
function momentFoot(e, card) {
  const foot = h("div", { class: "m-foot" });
  const rrow = h("div", { class: "react-row" });
  renderReacts(rrow, e, card);
  foot.appendChild(rrow);
  foot.appendChild(h("button", { class: "count-chip", onclick: () => go("moment/" + e.id) }, "💬 ", arNum(e.note_count || 0)));
  foot.appendChild(h("button", { class: "btn sm ghost", style: { marginInlineStart: "auto" }, onclick: (ev) => { ev.stopPropagation(); heartFly(ev.clientX, ev.clientY); toggleReact(e, "❤️", card); } }, "❤️ أحببتها"));
  return foot;
}
function renderReacts(row, e, card) {
  clear(row);
  const g = groupReactions(e.reactions);
  for (const [emoji, info] of Object.entries(g)) {
    row.appendChild(h("button", { class: "react-pill" + (info.mine ? " me" : ""), onclick: (ev) => { ev.stopPropagation(); toggleReact(e, emoji, card); } }, emoji + " " + arNum(info.count)));
  }
}
async function toggleReact(e, emoji, card) {
  sound.react();
  const r = await api.react(e.id, emoji);
  if (r.ok) {
    e.reactions = r.data.reactions || [];
    const row = card && card.querySelector(".react-row");
    if (row) renderReacts(row, e, card);
  }
}

/* ---------------- moment detail ---------------- */
async function viewMoment(id) {
  const app = clear(APP());
  app.appendChild(h("div", { class: "topbar" },
    h("button", { class: "icon-btn", onclick: () => history.length > 1 ? history.back() : go("feed") }, "→"),
    h("span", { class: "spacer" }),
    h("button", { class: "icon-btn", onclick: () => delMoment(id) }, "🗑️")));
  const content = h("div", { class: "view" }, h("div", { class: "empty" }, h("div", { class: "big" }, "🌙"), "نحمّل اللحظة…"));
  app.appendChild(content);
  const r = await api.moment(id);
  if (!r.ok) { clear(content).appendChild(h("div", { class: "empty" }, "تعذّر فتح اللحظة")); return; }
  const e = r.data.moment; const notes = r.data.notes || [];
  const c = clear(content);
  const card = momentCard(e, { detail: true }); card.classList.add("tilt-none");
  c.appendChild(card);

  // reaction bar
  const bar = h("div", { class: "react-bar" });
  const g = groupReactions(e.reactions);
  REACTIONS.forEach((emo) => {
    const on = g[emo]?.mine;
    bar.appendChild(h("button", { class: "r" + (on ? " on" : ""), onclick: async (ev) => { const btn = ev.currentTarget, x = ev.clientX, y = ev.clientY; heartFly(x, y); await toggleReact(e, emo, card); const ng = groupReactions(e.reactions); btn.classList.toggle("on", !!ng[emo]?.mine); } }, emo));
  });
  c.appendChild(h("div", { class: "panel", style: { padding: "12px", marginBottom: "14px" } }, h("div", { class: "muted", style: { fontWeight: 700, marginBottom: "4px" } }, "تفاعلا:"), bar));

  // notes
  const thread = h("div", { class: "notes" });
  function paintNotes(list) { clear(thread); if (!list.length) thread.appendChild(h("div", { class: "empty", style: { padding: "20px" } }, __g("لسا ما في همسة… قل شي حلو 💛","لسا ما في همسة… قولي شي حلو 💛"))); list.forEach((n) => thread.appendChild(noteBubble(n))); }
  paintNotes(notes);
  const input = h("input", { class: "field", placeholder: "همسة حبّ…" });
  async function send() {
    const body = input.value.trim(); if (!body) return;
    input.value = "";
    const r2 = await api.addNote(e.id, body);
    if (r2.ok) { notes.push(r2.data.note); paintNotes(notes); sound.post(); thread.lastChild.classList.add("stamp"); }
    else toast("تعذّر الإرسال");
  }
  input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") send(); });
  c.appendChild(h("div", { class: "panel", style: { padding: "12px" } },
    h("div", { class: "t-h2", style: { marginBottom: "10px" } }, "الهمسات"),
    thread,
    h("div", { class: "note-composer" }, input, h("button", { class: "btn her sm", onclick: send }, __g("أرسل","أرسلي"))),
  ));
}
function noteBubble(n) {
  const p = PEOPLE[n.author] || PEOPLE.him;
  return h("div", { class: "note " + p.cls }, h("div", { class: "who-line" }, p.name), n.body);
}
async function delMoment(id) {
  if (!confirm("إخفاء هذه اللحظة؟ (يمكن استرجاعها)")) return;
  loader(true); const r = await api.del(id); loader(false);
  if (r.ok) { toast("أُخفيت"); go("feed"); } else toast("تعذّر");
}

/* ---------------- timeline ---------------- */
async function viewTimeline(content) {
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "حكايتنا")));
  const list = h("div", { class: "tl" });
  content.appendChild(list);
  list.appendChild(h("div", { class: "empty", style: { padding: "20px" } }, "نحمّل القصة…"));
  const r = await api.timeline();
  clear(list);
  const items = r.ok ? r.data.items : [];
  let curMonth = null;
  for (const e of items) {
    const my = monthYear(e.happened_at);
    if (my !== curMonth) { curMonth = my; list.appendChild(h("div", { class: "tl-month" }, my)); }
    const p = PEOPLE[e.author] || PEOPLE.him;
    list.appendChild(h("div", { class: "tl-item " + p.cls, onclick: () => go("moment/" + e.id) },
      h("div", { class: "tl-card" },
        h("div", { class: "m-head", style: { marginBottom: "6px" } }, personChip(e.author), moodChip(e.mood), h("span", { class: "when" }, fullDate(e.happened_at))),
        h("div", { class: "first-line" }, e.body || (e.media && e.media.length ? "📎 لحظة بالوسائط" : "…")),
      )));
  }
  // chapter zero: the dedication + reply
  const ded = store.config.dedication, reply = store.config.reply;
  if (ded) {
    list.appendChild(h("div", { class: "tl-month" }, "البداية ✦"));
    list.appendChild(h("div", { class: "tl-item him" }, h("div", { class: "tl-card chapter-zero" },
      h("div", { class: "t-h2", style: { marginBottom: "8px" } }, "الإهداء"),
      h("div", { class: "ded" }, ded),
      reply ? h("div", { class: "ded", style: { marginTop: "12px", color: "var(--her)" } }, "— ردُّها: " + reply) : null,
    )));
  }
  if (!items.length && !ded) clear(list).appendChild(h("div", { class: "empty" }, h("div", { class: "big" }, "📖"), "وهنا تبدأ الصفحات."));
}

/* ---------------- milestones ---------------- */
async function viewMilestones(content) {
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "إنجازاتنا")));
  const wrap = h("div", {}); content.appendChild(wrap);
  wrap.appendChild(h("div", { class: "empty", style: { padding: "24px" } }, "نحسب أيّامكما…"));
  const r = await api.milestones();
  if (!r.ok) { clear(wrap).appendChild(h("div", { class: "empty" }, "تعذّر الحساب")); return; }
  const d = r.data; clear(wrap);
  if (d.anniversary_date) {
    wrap.appendChild(h("div", { class: "hero-counter" },
      h("div", { class: "muted", style: { fontWeight: 800 } }, "معًا منذ"),
      h("div", { class: "n" }, arNum(d.days_together)),
      h("div", { style: { fontWeight: 800 } }, "يومًا 💛"),
      h("div", { class: "muted", style: { marginTop: "6px" } }, "منذ " + fullDate(d.anniversary_date)),
    ));
  } else {
    wrap.appendChild(h("div", { class: "hero-counter", style: { background: "var(--paper-panel)" } },
      h("div", { class: "t-h2" }, "متى بدأت حكايتكما؟"),
      h("button", { class: "btn coral", style: { width: "auto", marginTop: "10px" }, onclick: () => go("me") }, __g("حدّد تاريخ البداية","حدّدي تاريخ البداية")),
    ));
  }
  wrap.appendChild(h("div", { class: "stat-row" },
    h("div", { class: "stat fire" }, h("div", { class: "v" }, "🔥 " + arNum(d.streak_current)), h("div", { class: "k" }, "سلسلة الأيّام")),
    h("div", { class: "stat" }, h("div", { class: "v" }, arNum(d.streak_longest)), h("div", { class: "k" }, "أطول سلسلة")),
  ));
  const grid = h("div", { class: "badge-grid" });
  for (const b of d.badges || []) {
    const meta = BADGES[b.key] || { emoji: "⭐", title: b.key, hint: "" };
    grid.appendChild(h("div", { class: "badge" + (b.unlocked ? "" : " locked"), title: meta.hint },
      h("div", { class: "be" }, meta.emoji), h("div", { class: "bt" }, b.unlocked ? meta.title : meta.hint)));
  }
  wrap.appendChild(h("div", { class: "t-h2", style: { margin: "6px 2px" } }, "الأوسمة"));
  wrap.appendChild(grid);
  const t = d.totals || {};
  wrap.appendChild(h("div", { class: "mini-stats" },
    h("span", { class: "chip" }, "📔 " + arNum(t.moments) + " لحظة"),
    h("span", { class: "chip" }, "💬 " + arNum(t.notes) + " همسة"),
    h("span", { class: "chip" }, "🎙️ " + arNum(t.voice)),
    h("span", { class: "chip" }, "🎵 " + arNum(t.songs)),
  ));
  wrap.appendChild(h("div", { class: "empty", style: { padding: "16px", marginTop: "14px" } }, h("div", { class: "dua" }, DUA[Math.floor(d.days_together || 0) % DUA.length])));

  // celebrate newly-unlocked-and-unseen badges (once)
  const fresh = (d.badges || []).filter((b) => b.unlocked && !b.seen);
  if (fresh.length) {
    setTimeout(() => { confetti(); sound.celebrate(); toast("مبروك! " + (BADGES[fresh[0].key]?.title || "وسام جديد")); }, 400);
    fresh.forEach((b) => api.markSeen(b.key));
  }
}

/* ---------------- me / settings ---------------- */
function viewMe(content) {
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "أنا")));
  content.appendChild(h("div", { class: "set-row" }, avatar(store.person, "lg"),
    h("div", {}, h("div", { class: "k" }, PEOPLE[store.person]?.name || ""), h("div", { class: "muted" }, __g("هذا أنا الآن","هذه أنا الآن"))),
    h("button", { class: "btn sm ghost", style: { marginInlineStart: "auto" }, onclick: () => go("who") }, "مو أنا؟")));

  const dateInput = h("input", { class: "field", type: "date", value: store.config.anniversary_date || "" });
  content.appendChild(h("div", { class: "set-row", style: { flexWrap: "wrap" } },
    h("div", { class: "k", style: { width: "100%" } }, "تاريخ بدايتنا 💍"),
    dateInput,
    h("button", { class: "btn sm mint", onclick: async () => { const v = dateInput.value; if (!v) return; loader(true); const r = await api.setConfig("anniversary_date", v); loader(false); if (r.ok) { store.setConfig({ anniversary_date: v }); toast("حُفظ 💛"); } } }, __g("احفظ","احفظي"))));

  content.appendChild(h("div", { class: "set-row" }, h("div", { class: "k" }, "الصوت"),
    h("button", { class: "btn sm ghost", style: { marginInlineStart: "auto" }, onclick: (e) => { const on = sound.toggle(); e.currentTarget.textContent = on ? "🔊 مُفعّل" : "🔇 صامت"; } }, store.soundOn ? "🔊 مُفعّل" : "🔇 صامت")));

  content.appendChild(h("div", { class: "set-row" }, h("div", { class: "k" }, "نسخة احتياطية"),
    h("button", { class: "btn sm ghost", style: { marginInlineStart: "auto" }, onclick: exportJSON }, __g("⬇ نزّل JSON","⬇ نزّلي JSON"))));

  // notifications
  const notifBtns = h("div", { class: "row", style: { width: "100%", gap: "10px", margin: "0" } });
  notifBtns.appendChild(h("button", { class: "btn sm " + (store.pushOn ? "ghost" : "mint"), onclick: async (e) => {
    if (store.pushOn) { await push.disable(); toast("أُوقفت الإشعارات"); renderRoute(); return; }
    e.currentTarget.textContent = "…";
    const r = await push.enable();
    if (r.ok) { toast("فُعّلت الإشعارات 🔔"); renderRoute(); }
    else { toast(r.reason === "denied" ? "رُفض إذن الإشعارات" : r.reason === "unsupported" ? "غير مدعوم هنا" : "تعذّر التفعيل"); renderRoute(); }
  } }, store.pushOn ? "إيقاف" : "تفعيل"));
  if (store.pushOn) notifBtns.appendChild(h("button", { class: "btn sm ghost", onclick: async () => { const r = await push.test(); toast(r.ok ? "أُرسل إشعار تجريبي 🔔" : "تعذّر"); } }, __g("جرّب","جرّبي")));
  content.appendChild(h("div", { class: "set-row", style: { flexWrap: "wrap" } }, h("div", { class: "k", style: { width: "100%" } }, "الإشعارات 🔔"), notifBtns,
    push.supported() ? null : h("div", { class: "muted", style: { fontSize: "13px", width: "100%" } }, __g("على الآيفون: أضِف التطبيق للشاشة الرئيسية أولًا.","على الآيفون: أضيفي التطبيق للشاشة الرئيسية أولًا."))));

  // appearance: theme + accent
  const themeSeg = h("div", { class: "seg" });
  [["system", "تلقائي"], ["light", "فاتح"], ["dark", "داكن"]].forEach(([v, label]) =>
    themeSeg.appendChild(h("button", { class: "seg-opt" + (store.theme === v ? " sel" : ""), onclick: () => { setTheme(v); renderRoute(); } }, label)));
  const accents = h("div", { class: "accent-row" });
  Object.entries(ACCENTS).forEach(([k, a]) => {
    const c1 = (a.vars && a.vars["--sun"]) || "#FFC93C";
    const c2 = (a.vars && a.vars["--coral"]) || "#FF6B4A";
    accents.appendChild(h("button", { class: "accent-sw" + (store.accent === k ? " sel" : ""), title: a.name, style: { background: `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)` }, onclick: () => { setAccent(k); renderRoute(); } }));
  });
  content.appendChild(h("div", { class: "set-row", style: { flexWrap: "wrap", gap: "10px" } }, h("div", { class: "k", style: { width: "100%" } }, "المظهر 🎨"), themeSeg, accents));

  content.appendChild(h("div", { class: "set-row" }, h("div", { class: "k" }, "قفل التطبيق 🔒"),
    appLock.enabled()
      ? h("div", { class: "row", style: { marginInlineStart: "auto", gap: "8px" } },
          h("button", { class: "btn sm ghost", onclick: async () => { if (appLock.hasBio()) { toast("البصمة مفعّلة"); return; } try { await appLock.enrollBio(); toast("فُعّلت البصمة 🔑"); } catch { toast("البصمة غير متاحة هنا"); } renderRoute(); } }, appLock.hasBio() ? "بصمة ✓" : "＋ بصمة"),
          h("button", { class: "btn sm ghost", onclick: () => { appLock.disable(); toast("أُلغي القفل"); renderRoute(); } }, "إيقاف"))
      : h("button", { class: "btn sm mint", style: { marginInlineStart: "auto" }, onclick: appLockSetup }, "تفعيل")));

  content.appendChild(h("button", { class: "btn ghost", style: { marginTop: "10px" }, onclick: () => { store.clearAuth(); toast("أُقفل الكتاب"); go("lock"); } }, __g("أقفل الكتاب","أقفلي الكتاب")));
}
async function exportJSON() {
  loader(true);
  const [b, f] = await Promise.all([api.bootstrap(), api.feed()]);
  loader(false);
  const data = { config: b.ok ? b.data.config : {}, moments: f.ok ? f.data.items : [], exported_at: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "yawmiyatna.json"; a.click();
  URL.revokeObjectURL(a.href); toast("نُزّلت النسخة 📄");
}

/* ---------------- compose ---------------- */
function openCompose() {
  const draft = { mood: "", media: [], happened_at: "" };
  const err = h("div", { class: "err" });
  const previews = h("div", { class: "m-media", style: { marginTop: "10px" } });
  const bodyInput = h("textarea", { class: "field", rows: 4, placeholder: __g("شو صار اليوم؟ اكتب للحظة…","شو صار اليوم؟ اكتبي للحظة…") });

  const moodRow = h("div", { class: "mood-row" }, ...MOODS.map(([label, emo]) =>
    h("button", { class: "mood-opt", onclick: (e) => {
      const was = e.currentTarget.classList.contains("sel");
      moodRow.querySelectorAll(".mood-opt").forEach((x) => x.classList.remove("sel"));
      if (!was) { e.currentTarget.classList.add("sel"); draft.mood = label; } else draft.mood = "";
    } }, emo + " " + label)));

  function renderPreviews() {
    clear(previews);
    draft.media.forEach((m, i) => {
      let node;
      if (m.kind === "photo") node = h("img", { class: "m-photo", src: m.preview });
      else if (m.kind === "voice") node = h("div", { class: "voice-pill" }, h("span", { class: "play" }, "🎙️"), h("div", { class: "wave" }, ...(m.meta.bars || []).map((v) => { const i2 = h("i"); i2.style.height = Math.max(10, v * 100) + "%"; return i2; })), arNum(m.meta.duration) + "ث");
      else if (m.kind === "video") node = h("video", { class: "m-video", src: m.preview, controls: true, preload: "metadata", playsInline: true });
      else node = h("div", { class: "song-pill" }, h("span", { class: "cassette" }, "🎵"), h("div", { class: "meta" }, h("b", {}, m.meta.title || "أغنية"), h("span", { class: "muted" }, m.meta.artist || "")));
      previews.appendChild(h("div", { style: { position: "relative" } }, node,
        h("button", { class: "icon-btn", style: { position: "absolute", top: "6px", insetInlineEnd: "6px", width: "32px", height: "32px" }, onclick: () => { draft.media.splice(i, 1); renderPreviews(); } }, "✕")));
    });
  }

  const fileInput = h("input", { type: "file", accept: "image/*", class: "hidden", onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return; e.target.value = "";
    loader(true); const ds = await downscale(f); loader(false);
    const edited = await openDoodle(ds.blob);
    const blob = edited || ds.blob;
    draft.media.push({ kind: "photo", blob, contentType: "image/jpeg", preview: URL.createObjectURL(blob) });
    renderPreviews();
  } });

  const videoInput = h("input", { type: "file", accept: "video/*", class: "hidden", onchange: (e) => {
    const f = e.target.files[0]; if (!f) return; e.target.value = "";
    if (f.size > 52428800) { toast("الفيديو كبير — الحد ٥٠ م.ب"); return; }
    draft.media.push({ kind: "video", blob: f, contentType: f.type || "video/mp4", preview: URL.createObjectURL(f) });
    renderPreviews();
  } });

  const rail = h("div", { class: "attach-rail" },
    h("button", { class: "attach", onclick: () => fileInput.click() }, h("span", { class: "ic" }, "📷"), "صورة"),
    h("button", { class: "attach", onclick: () => videoInput.click() }, h("span", { class: "ic" }, "🎬"), "فيديو"),
    h("button", { class: "attach", onclick: () => recordVoice(draft, renderPreviews) }, h("span", { class: "ic" }, "🎙️"), "صوت"),
    h("button", { class: "attach", onclick: () => addSong(draft, renderPreviews) }, h("span", { class: "ic" }, "🎵"), "أغنية"),
  );

  const dateInput = h("input", { class: "field", type: "date" });

  async function post() {
    const body = bodyInput.value.trim();
    if (!body && !draft.media.length) { err.textContent = __g("اكتب لحظة أو أرفق شيئًا","اكتبي لحظة أو أرفقي شيئًا"); return; }
    loader(true);
    try {
      const media = [];
      for (const m of draft.media) {
        if (m.kind === "song") { media.push({ kind: "song", url: m.url, meta: m.meta }); continue; }
        const su = await api.signUpload(m.kind, m.contentType);
        if (!su.ok) throw new Error("sign");
        const ok = await uploadSigned(su.data.signedUrl, m.blob, m.contentType);
        if (!ok) throw new Error("upload");
        media.push({ kind: m.kind, path: su.data.path, meta: m.meta || {} });
      }
      const r = await api.addMoment({ body, mood: draft.mood || null, happened_at: dateInput.value || undefined, media });
      loader(false);
      if (r.ok) { scrim.remove(); sound.post(); const x = innerWidth / 2, y = innerHeight / 2; sparkleAt(x, y); realtime.broadcast("moment"); go("feed"); renderRoute(); toast("أُضيفت لحظتكما 🌙"); }
      else err.textContent = r.data.detail || "تعذّر الحفظ";
    } catch (e2) { loader(false); err.textContent = "تعذّر رفع الوسائط"; }
  }

  const scrim = h("div", { class: "scrim" },
    h("div", { class: "sheet" },
      h("div", { class: "sheet-grab" }),
      h("h3", {}, "لحظةٌ جديدة"),
      h("div", { class: "muted", style: { textAlign: "center", marginBottom: "6px" } }, "ستظهر باسم ", PEOPLE[store.person]?.name || ""),
      moodRow,
      bodyInput,
      rail, fileInput, videoInput, previews,
      h("label", { class: "lbl" }, "متى حدثت؟ (اختياري)"), dateInput,
      err,
      h("div", { class: "attach-rail", style: { marginTop: "14px" } },
        h("button", { class: "btn ghost", onclick: () => scrim.remove() }, "إلغاء"),
        h("button", { class: "btn sun", onclick: post }, __g("انشرها 🌙","انشريها 🌙")),
      ),
    ));
  scrim.addEventListener("click", (e) => { if (e.target === scrim) scrim.remove(); });
  document.body.appendChild(scrim);
}

function recordVoice(draft, done) {
  const rec = new VoiceRecorder();
  const wave = h("div", { class: "wave", style: { height: "40px" } });
  const timer = h("div", { class: "num", style: { fontSize: "28px" } }, "٠ث");
  let running = false, t0 = 0, iv = null;
  rec.onbars = (bars) => { clear(wave); bars.forEach((v) => { const i = h("i"); i.style.height = Math.max(10, v * 100) + "%"; wave.appendChild(i); }); };
  const btn = h("button", { class: "btn coral", onclick: async () => {
    if (!running) {
      try { await rec.start(); } catch { toast("لا يمكن الوصول للميكروفون"); return; }
      running = true; t0 = Date.now(); btn.textContent = "⏹ إيقاف";
      iv = setInterval(() => (timer.textContent = arNum(Math.round((Date.now() - t0) / 1000)) + "ث"), 250);
    } else {
      clearInterval(iv); const out = await rec.stop();
      draft.media.push({ kind: "voice", blob: out.blob, contentType: out.mime, meta: { bars: out.bars, duration: out.duration } });
      done(); sc.remove();
    }
  } }, __g("⏺ ابدأ التسجيل","⏺ ابدئي التسجيل"));
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" },
    h("h3", {}, "همسة صوتية 🎙️"), wave, timer,
    h("div", { style: { height: "10px" } }), btn,
    h("button", { class: "btn ghost", style: { marginTop: "10px" }, onclick: () => { if (running) { clearInterval(iv); rec.stop(); } sc.remove(); } }, "إلغاء")));
  document.body.appendChild(sc);
}

function addSong(draft, done) {
  const title = h("input", { class: "field", placeholder: "اسم الأغنية" });
  const artist = h("input", { class: "field", placeholder: "المغني/ة" });
  const url = h("input", { class: "field", placeholder: "رابط (اختياري)", inputmode: "url" });
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" },
    h("h3", {}, "أغنية اللحظة 🎵"),
    h("label", { class: "lbl" }, "العنوان"), title,
    h("label", { class: "lbl" }, "المغني/ة"), artist,
    h("label", { class: "lbl" }, "الرابط"), url,
    h("div", { class: "attach-rail", style: { marginTop: "14px" } },
      h("button", { class: "btn ghost", onclick: () => sc.remove() }, "إلغاء"),
      h("button", { class: "btn her", onclick: () => { if (!title.value.trim()) { title.focus(); return; } draft.media.push({ kind: "song", url: url.value.trim(), meta: { title: title.value.trim(), artist: artist.value.trim() } }); done(); sc.remove(); } }, __g("أرفقها","أرفقيها")),
    )));
  document.body.appendChild(sc);
}
