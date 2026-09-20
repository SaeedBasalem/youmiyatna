// يومياتنا — اليوم: the home screen of Chapter Two.
//
// One question organises it: how is our day going? The rings answer at a
// glance; below them, each card is one thing the day asks of them — today's
// photo, today's question, a heartbeat, a game, and after ʿIshā the wind-down.
//
// It draws the last copy it saw at once, then asks the server for everything
// in one call (journal6 `home`), and redraws whenever the other phone says
// something changed. Nothing waits on a slow minute.
import { api } from "../api.js";
import { store } from "../store.js";
import { sound } from "../sound.js";
import { h, clear, avatar, toast, arNum, relTime, hijriDate, hijriParts, confetti, sparkleAt, noMotion } from "../ui.js";
import { PEOPLE, other, MOODS, moodEmoji } from "../config.js";
import { go, applyBackground, commit, errorState, refreshAvatars } from "../helpers.js";
import { icon } from "../icons.js";
import { haptic } from "../haptics.js";
import { installBanner, pushBanner } from "../install.js";
import { openPalette } from "../palette.js";
import { rt } from "../realtime.js";
import { resolvedLook } from "../looks.js";
import { greetingFor } from "../living.js";
import { ringsView, ringsHint } from "../rings.js";
import { groveHero } from "../grove.js";
import { nowCard, captureNow } from "../now.js";
import { sendTouch } from "../touch.js";
import { windCard, fromNightCard, openWinddown } from "../winddown.js";
import { convoCard, dateIdea, duaForSpouse } from "../generate.js";
import { pickAsk, markSeen } from "../ask.js";
import { track } from "../track.js";

const TZ = 180 * 60000;
const localDay = () => new Date(Date.now() + TZ).toISOString().slice(0, 10);
const dayIdx = () => Math.floor((Date.now() + TZ) / 86400000);

let mounted = null;
let painted = false;
let data = null;
let fetching = false, again = false, lastFetch = 0;
let avatarsAsked = false;

export function viewToday(content, { then } = {}) {
  mounted = content;
  painted = false;
  content.classList.add("today-view");
  data = store.homeCache();
  paint();
  load().then(() => then && then(data));
  bindLive();
  if (!avatarsAsked) { avatarsAsked = true; refreshAvatars().then(() => { if (isMounted()) paint(); }); }
}
export const todayOpenWinddown = () => openWinddown(() => load());

const isMounted = () => mounted && document.body.contains(mounted);

async function load() {
  if (fetching) { again = true; return; }
  fetching = true;
  const r = await api.home();
  fetching = false; lastFetch = Date.now();
  if (r.ok) {
    data = r.data;
    store.setHomeCache(r.data);
    const m = r.data.meta || {};
    store.setConfig({ anniversary_date: m.anniversary_date || null, dedication: m.dedication || "", reply: m.reply || "", bg_him: m.bg_him || "", bg_her: m.bg_her || "" });
    applyBackground();
    store.activityUnseen = r.data.unseen || 0;
    window.dispatchEvent(new CustomEvent("yn:unread", { detail: { unread: r.data.unread || 0 } }));
    if (isMounted()) paint();
  } else if (isMounted()) {
    if (data) { data = { ...data, _stale: true, _offline: !!r.offline }; paint(); }
    else { clear(mounted).appendChild(errorState(() => load(), { offline: r.offline })); }
  }
  if (again) { again = false; return load(); }
}

// ---- live: the other phone says something changed → fetch once, shortly ----
let bound = false, soonTimer = null;
function soon() { clearTimeout(soonTimer); soonTimer = setTimeout(() => { if (isMounted()) load(); }, 450); }
function bindLive() {
  if (bound) return;
  bound = true;
  for (const ev of ["now", "answer", "mood", "msg", "winddown", "grove", "moment", "game", "touch", "home"]) rt.on(ev, soon);
  rt.on("presence", () => { if (isMounted()) updatePresence(); });
  window.addEventListener("yn:changed", soon);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && isMounted() && Date.now() - lastFetch > 45000) load(); });
}
function updatePresence() {
  const here = rt.partnerHere;
  mounted.querySelectorAll("[data-presence]").forEach((el) => el.classList.toggle("hidden", !here));
  const pc = mounted.querySelector(".play-card span.pc-sub");
  if (pc) pc.textContent = playLine(here);
}

// ---------------------------------------------------------------------------
function paint() {
  if (!mounted) return;
  const c = clear(mounted);
  const d = data || {};
  const me = store.person, partner = other(me);
  const look = resolvedLook();
  const t = h("div", { class: "today" + (painted ? "" : " stagger") });
  painted = true;
  c.appendChild(t);

  const inst = installBanner();
  if (inst) t.appendChild(inst); else { const pb = pushBanner(); if (pb) t.appendChild(pb); }
  if (d._stale) t.appendChild(h("div", { class: "offline-banner" }, d._offline ? "🌙 أنتما دون اتصال — نعرض آخر ما حُفظ" : "نعرض آخر ما حُفظ — سنحدّث بعد لحظة"));

  t.appendChild(look === "ink" ? masthead(d) : header(d));
  // The one thing the day asks for, before anything that merely reports.
  if (data) t.appendChild(heroCard(d));
  if (data) t.appendChild(archiveInvite());

  if (d.rings) t.appendChild(h("section", { class: "tcard glass rings-card", "aria-label": "حلقات يومنا" },
    h("div", { class: "tk" }, h("span", { class: "dot" }), "حلقات يومنا"),
    ringsView(d.rings, me, partner),
    h("div", { class: "rings-note" }, ringsHint(d.rings, me))));
  else if (!data) t.appendChild(h("div", { class: "tcard plain" }, h("div", { class: "sk-line w40" }), h("div", { class: "sk-line" }), h("div", { class: "sk-line w70" })));

  if (data) {
    t.appendChild(h("div", { class: "rest-head" }, h("span", {}, "بقية اليوم")));
    t.appendChild(nowCard(d.now, { onChange: () => load() }));
    if (lastAsk !== "question" && lastAsk !== "qreveal") t.appendChild(questionCard(d));
    t.appendChild(touchRow(d));
    const wc = windCard(d, () => load()); if (wc) t.appendChild(wc);
    const fn = fromNightCard(d); if (fn) t.appendChild(fn);
    t.appendChild(playCard());
    t.appendChild(moodCard(d));
    const mc = memoryCard(d); if (mc) t.appendChild(mc);
    t.appendChild(groveHero(d.grove || {}, { onOpen: () => go("us/grove") }));
    t.appendChild(surpriseCard(d));
    celebrate(d);
  }
}

// ---- head ----
function dateLine() {
  const now = new Date();
  // Arabic-Indic digits like the Hijri date beside it, and a hairline between
  // the two calendars: a "·" next to "٢" reads as "٢٠"
  const g = now.toLocaleDateString("ar-u-nu-arab", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Riyadh" });
  const occ = occasionToday();
  const sep = () => h("span", { class: "th-sep" }, h("span", { class: "sr-only" }, "، "));
  return h("div", { class: "th-date" }, g, sep(), h("span", { class: "hijri" }, hijriDate()), ...(occ ? [sep(), occ.emoji + " " + occ.title] : []));
}
function headButtons(d) {
  const find = h("button", { class: "th-btn", "aria-label": "ابحثا أو نفّذا أمرًا", onclick: () => openPalette() }, icon("search", { size: 17 }));
  const bell = h("button", { class: "th-btn", "aria-label": "كل ما جرى" + (d.unseen ? " — " + arNum(d.unseen) + " جديد" : ""), onclick: () => go("inbox") },
    icon("bell", { size: 18 }), d.unseen ? h("span", { class: "th-badge" }, arNum(d.unseen)) : null);
  return [find, bell];
}
function face(p, isPartner) {
  const el = h("button", { class: "th-face", "aria-label": "صفحة " + PEOPLE[p].name, onclick: () => go("profile/" + p) }, avatar(p));
  if (isPartner) el.appendChild(h("span", { class: "presence" + (rt.partnerHere ? "" : " hidden"), "data-presence": "1", title: "هنا الآن" }));
  return el;
}
function header(d) {
  const me = store.person, partner = other(me);
  return h("header", { class: "th" },
    h("div", { class: "th-text" }, h("h1", { class: "th-hello" }, greetingFor() + " يا " + PEOPLE[me].name)),
    ...headButtons(d),
    h("div", { class: "th-faces" }, face(partner, true), face(me, false)),
    dateLine());                                   // a full-width row of its own, so it never cuts off
}
// Ink & Paper opens like a printed diary: the day's number large, the rest beside it.
function masthead(d) {
  const now = new Date();
  const day = Number(new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "Asia/Riyadh" }).format(now));
  return h("header", { class: "masthead" },
    h("span", { class: "mh-day", "aria-hidden": "true" }, arNum(day)),
    h("div", { class: "mh-meta" },
      h("h1", { class: "sr-only" }, greetingFor() + " يا " + PEOPLE[store.person].name),
      h("b", {}, now.toLocaleDateString("ar", { month: "long", timeZone: "Asia/Riyadh" })),
      h("span", {}, now.toLocaleDateString("ar", { weekday: "long", timeZone: "Asia/Riyadh" })),
      h("span", {}, hijriDate())),
    h("div", { class: "mh-side" },
      h("span", { class: "mh-names" }, PEOPLE.him.name + " و" + PEOPLE.her.name),
      h("div", { style: { display: "flex", gap: "6px", alignItems: "center" } }, ...headButtons(d), face(other(store.person), true))));
}

// ---- سؤال اليوم, answered right here ----
function questionCard(d) {
  const p = d.prompt || {};
  const partner = other(store.person), pn = PEOPLE[partner].name, she = partner === "her";
  const card = h("section", { class: "tcard glass qcard", "aria-label": "سؤال اليوم" },
    h("div", { class: "tk" }, h("span", { class: "dot" }), "سؤال اليوم"),
    h("div", { class: "q-text" }, d.question || "…"));
  const ans = (who, text) => h("div", { class: "q-ans " + who }, h("b", {}, who === store.person ? "أنت" : PEOPLE[who].name), text);
  if (p.mine == null) {
    const ta = h("textarea", { class: "field", rows: 1, id: "today-answer", "aria-label": "إجابتك",
      placeholder: p.theirs_answered ? (she ? "أجابت " : "أجاب ") + pn + " — دورك ✍️" : __g("اكتب إجابتك…", "اكتبي إجابتك…") });
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; });
    const send = h("button", { class: "btn", onclick: async () => {
      const a = ta.value.trim(); if (!a) { ta.focus(); return; }
      send.disabled = true;
      const r = await api.answerPrompt(a);
      send.disabled = false;
      if (!r.ok) { toast(r.offline ? "لا اتصال — لم تُرسل" : "تعذّر الحفظ"); return; }
      sound.post(); haptic.success(); rt.signal("answer");
      if (p.theirs_answered) sparkleAt(innerWidth / 2, innerHeight / 3, ["🌟", "✨", "💛"]);
      load();
    } }, __g("أرسل", "أرسلي"));
    card.appendChild(h("div", { class: "q-answer" }, ta, send));
  } else if (p.revealed) {
    card.appendChild(h("div", { class: "q-pair" }, ans(store.person, p.mine), ans(partner, p.theirs)));
  } else {
    card.appendChild(h("div", { class: "q-pair" }, ans(store.person, p.mine)));
    card.appendChild(h("div", { class: "q-wait", style: { marginTop: "8px" } }, "🔒 تنكشف الإجابتان حين " + (she ? "تجيب " : "يجيب ") + pn));
  }
  return card;
}

// ---- a heartbeat, and the other one ----
function touchRow(d) {
  const partner = other(store.person), pn = PEOPLE[partner].name;
  const heart = h("button", { class: "heart-btn", "aria-label": "أرسل نبضة إلى " + pn, onclick: () => sendTouch(heart) }, icon("heart", { size: 26, stroke: 2 }));
  const last = d.last_msg;
  const text = !last ? "ابدآ الهمس 💛" : last.kind === "text" ? String(last.body || "") : last.kind === "voice" ? "🎙️ رسالة صوتية" : "📷 صورة";
  const peek = h("button", { class: "peek", onclick: () => go("chat"), "aria-label": "افتح همس" },
    h("b", {}, pn, h("span", { class: "here-now" + (rt.partnerHere ? "" : " hidden"), "data-presence": "1" }, "هنا الآن")),
    h("span", { class: "line" }, last ? (last.sender === store.person ? "أنت: " : "") + text + " · " + relTime(last.created_at) : text),
    d.touches_in ? h("span", { class: "line" }, "💓 " + arNum(d.touches_in) + (partner === "her" ? " نبضة منها اليوم" : " نبضة منه اليوم")) : null);
  const end = d.unread
    ? h("button", { class: "unread-pill", "aria-label": arNum(d.unread) + " همسة لم تُقرأ", onclick: () => go("chat") }, arNum(d.unread))
    : h("button", { class: "th-btn", "aria-label": "افتح همس", onclick: () => go("chat") }, icon("chat", { size: 18 }));
  return h("section", { class: "tcard glass touch-row", "aria-label": "نبضة وهمس" }, heart, peek, end);
}

// ---- play together ----
const playLine = (here) => {
  const partner = other(store.person), pn = PEOPLE[partner].name;
  return here ? `${pn} هنا الآن — العبا مباشرةً على جوّالين` : (partner === "her" ? "ادعُها إلى لعبة على جوّالين" : "ادعيه إلى لعبة على جوّالين");
};
function playCard() {
  return h("button", { class: "tcard plain play-card", onclick: () => go("play/live") },
    h("span", { class: "pc-ic", "aria-hidden": "true" }, "🎲"),
    h("div", {}, h("b", {}, "نلعب معًا"), h("span", { class: "pc-sub" }, playLine(rt.partnerHere))),
    h("span", { class: "go", "aria-hidden": "true" }, icon("back", { size: 18 })));
}

// ---- mood, one tap ----
function moodCard(d) {
  const ck = d.checkin || {};
  const mine = ck.mine && ck.mine.mood, theirs = ck.theirs && ck.theirs.mood;
  const partner = other(store.person), pn = PEOPLE[partner].name;
  const card = h("section", { class: "tcard plain", "aria-label": "المزاج" });
  if (mine) {
    card.appendChild(h("div", { class: "mood-now" }, h("span", { class: "mn-e", "aria-hidden": "true" }, moodEmoji(mine)),
      h("span", {}, __g("شعورك اليوم: ", "شعوركِ اليوم: ") + mine),
      h("button", { class: "btn ghost sm", style: { marginInlineStart: "auto", width: "auto" }, onclick: () => go("us/mood") }, "غيّره")));
  } else {
    const picks = h("div", { class: "mood-picks" }, ...MOODS.map(([label, emo]) => h("button", { class: "mood-pick", "aria-label": label, title: label, onclick: async () => {
      haptic.pick();
      const ok = await commit(() => api.setCheckin(label, null));
      if (ok) { sound.react(); rt.signal("mood"); toast("سُجّل شعورك " + emo); load(); }
    } }, emo)));
    card.appendChild(h("div", { class: "mood-row" }, h("span", { class: "ml" }, __g("كيف تشعر؟", "كيف تشعرين؟")), picks));
  }
  if (theirs) card.appendChild(h("div", { class: "muted", style: { fontSize: "12.5px", marginTop: "8px" } },
    pn + (partner === "her" ? " تشعر بـ" : " يشعر بـ") + theirs + " " + moodEmoji(theirs)));
  return card;
}

// ---- the one memory worth showing now ----
function memoryCard(d) {
  const mk = (kicker, text, meta, img, onclick) => h("button", { class: "tcard plain mem-card", onclick },
    img ? h("img", { src: img, alt: "", loading: "lazy" }) : h("span", { class: "mc-ph", "aria-hidden": "true" }, kicker.split(" ")[0]),
    h("div", {}, h("div", { class: "tk" }, kicker), h("div", { class: "mc-t" }, text), meta ? h("div", { class: "mc-m" }, meta) : null));
  if (d.letter) return mk("💌 رسالة جاهزة", d.letter.title || "رسالة كُتبت لهذا اليوم", "من " + ((PEOPLE[d.letter.author] || {}).name || "") + " — حان وقت فتحها", null, () => go("us/letters"));
  const today = localDay();
  const soonCd = (d.countdowns || []).map((cd) => ({ ...cd, days: Math.round((Date.parse(cd.target_date) - Date.parse(today)) / 86400000) }))
    .filter((x) => x.days >= 0 && x.days <= 7).sort((a, b) => a.days - b.days)[0];
  if (soonCd) return mk((soonCd.emoji || "⏳") + " " + (soonCd.days === 0 ? "اليوم!" : "بعد " + arNum(soonCd.days) + " يوم"), soonCd.title, null, null, () => go("us/calendar"));
  const e = d.otd || d.latest;
  if (!e) return null;
  return mk(d.otd ? "🔁 في مثل هذا اليوم" : "📖 آخر ذكرى", e.body || "لحظةٌ بلا كلمات",
    ((PEOPLE[e.author] || {}).name || "") + " · " + relTime(e.created_at), e.photo && e.photo.url, () => go("moment/" + e.id));
}

// ---- a small sealed surprise, one a day ----
function surpriseCard(d) {
  const key = String(dayIdx());
  const seed = "x" + key;
  const pool = [
    { title: "سؤالٌ لكما 🃏", text: convoCard({ seed, remember: false }) },
    { title: "فكرة سهرة 🎡", text: dateIdea({ seed, remember: false }) },
    { title: "دعوةٌ لكما 🤲", text: duaForSpouse({ seed, remember: false }) },
  ];
  if (d.latest && d.latest.body) pool.push({ title: "ذكرى منكما 📖", text: "“" + d.latest.body + "”" });
  const item = pool[dayIdx() % pool.length];
  let opened = false;
  try { opened = localStorage.getItem("yn_surprise_day") === key; } catch {}
  const box = h("div", { class: "quote-slot" });
  const card = h("section", { class: "tcard plain", "aria-label": "مفاجأة اليوم" }, h("div", { class: "tk" }, "🎁 مفاجأة اليوم"), box);
  const reveal = () => { clear(box).appendChild(h("div", { class: "surprise-open", style: { fontSize: "16px", lineHeight: "1.9" } }, h("b", { style: { display: "block", fontFamily: "var(--font-body)", fontSize: "13px", marginBottom: "4px" } }, item.title), item.text)); };
  if (opened) reveal();
  else box.appendChild(h("button", { class: "btn soft sm", style: { width: "auto" }, onclick: (e) => {
    try { localStorage.setItem("yn_surprise_day", key); } catch {}
    sound.post(); haptic.success(); sparkleAt(e.clientX, e.clientY, ["🎁", "✨", "🤍"]); reveal();
  } }, "اكشفاها"));
  return card;
}

// ---- occasions and round days ----
function occasionToday() {
  const hp = hijriParts(); if (!hp) return null;
  const { day, month } = hp;
  const dow = new Date(Date.now() + TZ).getUTCDay();
  const mk = (emoji, title) => ({ emoji, title });
  if (month === 9) return day >= 21 ? mk("🌙", "العشر الأواخر") : mk("🌙", "رمضان مبارك");
  if (month === 10 && day === 1) return mk("🎉", "عيد الفطر المبارك");
  if (month === 12 && day <= 10) { if (day === 9) return mk("🕋", "يوم عرفة"); if (day === 10) return mk("🎉", "عيد الأضحى المبارك"); return mk("🕋", "عشر ذي الحجة"); }
  if (month === 1 && day === 1) return mk("🌙", "رأس السنة الهجرية");
  if (month === 1 && day === 10) return mk("🤍", "عاشوراء");
  if (dow === 5) return mk("🕌", "جمعة مباركة");
  if (day >= 13 && day <= 15) return mk("🌕", "الأيام البيض");
  return null;
}
function celebrate(d) {
  const dt = d.days_together;
  if (dt == null || dt <= 0) return;
  let cel = null;
  if (dt % 365 === 0) cel = { title: "🎉 " + arNum(dt / 365) + " سنة معًا!", key: "cel-" + dt };
  else if (dt % 100 === 0) cel = { title: "💯 " + arNum(dt) + " يوم معًا!", key: "cel-" + dt };
  else {
    const ann = store.config.anniversary_date;
    const now = new Date(Date.now() + TZ);
    if (ann && now.getUTCDate() === Number(ann.slice(8, 10)) && dt < 365 && dt >= 28) {
      const months = Math.round(dt / 30.44);
      cel = { title: "🌙 " + arNum(months) + (months >= 3 && months <= 10 ? " أشهر معًا" : " شهرًا معًا"), key: "cel-mo-" + now.getUTCFullYear() + "-" + now.getUTCMonth() };
    }
  }
  if (!cel) return;
  let seen = null; try { seen = localStorage.getItem("yn_celebrated"); } catch {}
  if (seen === cel.key) return;
  try { localStorage.setItem("yn_celebrated", cel.key); } catch {}
  setTimeout(() => { confetti(); sound.celebrate(); haptic.celebrate(); toast(cel.title); }, 500);
}

// ---------------------------------------------------------------------------
// The hero: one ask, finishable where it stands. js/ask.js decides which one;
// this only knows what each kind does when it is tapped.
// ---------------------------------------------------------------------------
let lastAsk = "";
let toldAsk = "";
// ---- the one-time thing that fills the app ----
// Every memory feature the app has is searching ~90 rows of their life until
// their real history is imported. The last ritual nobody could find died of
// exactly that, so this asks from Today rather than waiting on a shelf.
const ARC_SEEN = "yn_arc_state";      // {n, at} — cached a day, so Today costs no extra call
const ARC_LATER = "yn_arc_later";
function archiveInvite() {
  const host = h("div", {});
  const later = Number(localStorage.getItem(ARC_LATER) || 0);
  if (Date.now() < later) return host;

  const show = (n) => {
    if (n > 0) return;
    const card = h("section", { class: "tcard glass arc-invite" },
      h("div", { class: "ai-top" },
        h("span", { class: "ai-ic", "aria-hidden": "true" }, "🗂️"),
        h("div", {}, h("b", {}, "أدخِلا محادثتكما"),
          h("p", {}, "كل ما قلتماه قبل هذا التطبيق. أدخِلاه مرّة، فتصير «في مثل هذا اليوم» و«رسالة الشهر» عن سنواتكما لا عن أسبوع."))),
      h("div", { class: "ai-row" },
        h("button", { class: "btn hero-go", onclick: () => { track("archive_invite_tap"); go("us/archive"); } }, "أدخِلاها الآن"),
        h("button", { class: "btn ghost sm", style: { width: "auto" }, onclick: () => {
          try { localStorage.setItem(ARC_LATER, String(Date.now() + 7 * 86400000)); } catch {}
          track("archive_invite_later");
          card.remove();
        } }, "لاحقًا")));
    host.appendChild(card);
  };

  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(ARC_SEEN) || "null"); } catch {}
  if (cached && Date.now() - cached.at < 86400000) { show(cached.n); return host; }
  // unknown: ask, then fill in place rather than guessing wrong in either direction
  api.archiveStats().then((r) => {
    if (!r.ok) return;
    const n = (r.data.stats && r.data.stats.n) || 0;
    try { localStorage.setItem(ARC_SEEN, JSON.stringify({ n, at: Date.now() })); } catch {}
    // the answer can arrive after Today has been repainted; only fill a host
    // that is still on screen (the synchronous cached path has not been
    // appended yet, which is why this check cannot live inside show())
    if (host.isConnected) show(n);
  });
  return host;
}

function heroCard(d) {
  const ask = pickAsk(d);
  lastAsk = ask.key;
  if (ask.key !== toldAsk) { toldAsk = ask.key; track("ask_shown", { key: ask.key }); }
  const done = () => track("ask_done", { key: ask.key });
  const card = h("section", { class: "hero tone-" + ask.tone, "aria-label": ask.kicker });
  card.appendChild(h("div", { class: "hero-k" }, ask.kicker));
  card.appendChild(h("h2", { class: "hero-t" }, ask.title));
  if (ask.sub) card.appendChild(h("p", { class: "hero-s" }, ask.sub));
  const big = (label, run) => h("button", { class: "btn hero-go", onclick: run }, label);
  const small = (label, run) => h("button", { class: "btn ghost hero-alt", onclick: run }, label);
  const bring = (sel) => { const el = mounted && mounted.querySelector(sel); if (el) el.scrollIntoView({ block: "center", behavior: noMotion() ? "auto" : "smooth" }); };

  if (ask.key === "photo" || ask.key === "photo-early") {
    card.appendChild(big(ask.cta, () => captureNow(() => { done(); load(); })));
  } else if (ask.key === "reveal") {
    card.appendChild(big(ask.cta, () => { markSeen("reveal"); done(); paint(); bring(".now-card"); }));
  } else if (ask.key === "winddown") {
    card.appendChild(big(ask.cta, () => { done(); todayOpenWinddown(); }));
  } else if (ask.key === "question") {
    const ta = h("textarea", { class: "field hero-field", rows: 2, "aria-label": "إجابتك", placeholder: __g("اكتب إجابتك…", "اكتبي إجابتك…") });
    const send = h("button", { class: "btn hero-go", onclick: async () => {
      const a = ta.value.trim(); if (!a) { ta.focus(); return; }
      send.disabled = true;
      const r = await api.answerPrompt(a);
      send.disabled = false;
      if (!r.ok) { toast(r.offline ? "لا اتصال — لم تُرسل" : "تعذّر الحفظ"); return; }
      sound.post(); haptic.success(); rt.signal("answer"); done();
      sparkleAt(innerWidth / 2, innerHeight / 3, ["🌟", "✨", "💛"]);
      load();
    } }, ask.cta);
    card.appendChild(h("div", { class: "hero-form" }, ta, send));
  } else if (ask.key === "qreveal") {
    card.appendChild(big(ask.cta, () => { markSeen("qreveal"); done(); paint(); bring(".qcard"); }));
  } else if (ask.key === "whisper") {
    const heart = h("button", { class: "btn hero-go", onclick: () => { sendTouch(heart); done(); setTimeout(() => load(), 900); } }, ask.cta);
    card.appendChild(heart);
    card.appendChild(small("✍️ أو همسة في همس", () => { done(); go("chat"); }));
  } else if (ask.key === "dhikr") {
    let n = 0, timer = null;
    const count = h("b", { class: "hero-count" }, arNum(0));
    const btn = h("button", { class: "btn hero-go", onclick: () => {
      n++; count.textContent = arNum(n); haptic.soft(); sound.react();
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const by = n; n = 0;
        const r = await api.dhikrInc("azim", by);
        if (r.ok) { rt.signal("grove"); done(); load(); }
      }, 900);
    } }, ask.cta);
    card.appendChild(h("div", { class: "hero-form" }, btn, count));
  } else if (ask.key === "moment") {
    card.appendChild(big(ask.cta, () => { done(); import("./journal.js").then((m) => m.openCompose({ onDone: () => load() })); }));
  } else {
    card.appendChild(h("div", { class: "hero-done", "aria-hidden": "true" }, "🤍"));
    card.appendChild(small("✍️ اكتبا ذكرى على أي حال", () => import("./journal.js").then((m) => m.openCompose({ onDone: () => load() }))));
  }
  return card;
}
