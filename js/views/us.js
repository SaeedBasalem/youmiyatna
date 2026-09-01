// يومياتنا — نحن: the "us" hub. Reasons jar, firsts, goals, mood, letters,
// countdowns, faith corner, songs, milestones, gratitude, settings.
import { h, clear, arNum, toast, fullDate, relTime, sparkleAt, heartFly, confetti, clickable } from "../ui.js";
import { api } from "../api.js";
import { store } from "../store.js";
import { sound } from "../sound.js";
import { PEOPLE, other, MOODS, moodEmoji, BADGES, DUA } from "../config.js";
import { loader, go, openSheet, openModal, confirmAsk, ACCENT_PRESETS, applyTheme, applyAccent, applyBackground, BG_PRESETS, safeUrl, hashPin, encryptWithPin, commit, errorState, bioAvailable, bioEnroll, bioEnrolled, bioForget } from "../helpers.js";
import { downscale, uploadSigned } from "../media.js";
import { haptic } from "../haptics.js";
import { SKINS, applySkin } from "../skins.js";
import { openPushOnboarding, openInstallGuide, isStandalone, isIOS, pushBlockedUntilInstalled, canPromptInstall, promptInstall } from "../install.js";
import { MORNING_ADHKAR, EVENING_ADHKAR } from "../adhkar.js";
import { khalwa as genKhalwa, duaForSpouse } from "../generate.js";

const sub = () => (location.hash || "").replace(/^#\//, "").split("/")[1] || "";
const dayStr = () => new Date(Date.now() + 180 * 60000).toISOString().slice(0, 10);
const yesterdayStr = () => new Date(Date.now() + 180 * 60000 - 86400000).toISOString().slice(0, 10);
const dayIdx = () => Math.floor((Date.now() + 180 * 60000) / 86400000);
const weekIdx = () => Math.floor(dayIdx() / 7);
const hourLocal = () => new Date(Date.now() + 180 * 60000).getUTCHours();

// per-device daily streak helpers (client-side)
function bumpStreak(kLast, kStreak) {
  const today = dayStr(), last = localStorage.getItem(kLast);
  let s = Number(localStorage.getItem(kStreak) || 0);
  if (last === today) return s;
  s = last === yesterdayStr() ? s + 1 : 1;
  localStorage.setItem(kLast, today); localStorage.setItem(kStreak, String(s));
  return s;
}
function curStreak(kLast, kStreak) {
  const last = localStorage.getItem(kLast);
  if (last === dayStr() || last === yesterdayStr()) return Number(localStorage.getItem(kStreak) || 0);
  return 0;
}

let usDir = "";
export function viewUs(content) {
  const s = sub();
  const c = clear(content);
  if (s) c.appendChild(h("div", { class: "sub-head" },
    h("button", { class: "icon-btn", "aria-label": "رجوع", onclick: () => { usDir = "out"; go("us"); } }, "→"),
    h("div", { class: "sh-title" }, SECTIONS[s]?.title || "نحن")));
  const pane = h("div", { class: usDir === "in" ? "page-in" : usDir === "out" ? "page-out" : "" });
  usDir = "";
  c.appendChild(pane);
  (SECTIONS[s]?.render || renderHub)(pane);
}

const SECTIONS = {
  jar:        { title: "لماذا أحبّك", render: (p) => jarSection(p) },
  firsts:     { title: "أوّليّاتنا", render: (p) => firstsSection(p) },
  goals:      { title: "أحلامنا", render: (p) => goalsSection(p) },
  mood:       { title: "مزاجنا", render: (p) => moodSection(p) },
  letters:    { title: "رسائل الغد", render: (p) => lettersSection(p) },
  calendar:   { title: "التقويم والعدّاد", render: (p) => calendarSection(p) },
  faith:      { title: "ركن الإيمان", render: (p) => faithSection(p) },
  adhkar:     { title: "أذكارنا", render: (p) => adhkarSection(p) },
  sadaqah:    { title: "جرّة الصدقة", render: (p) => sadaqahSection(p) },
  songs:      { title: "أغانينا", render: (p) => songsSection(p) },
  milestones: { title: "إنجازاتنا", render: (p) => milestonesSection(p) },
  gratitude:  { title: "امتناننا", render: (p) => gratitudeSection(p) },
  studio:     { title: "مظهرنا", render: (p) => studioSection(p) },
  settings:   { title: "الإعدادات", render: (p) => settingsSection(p) },
};

/* ---------------- hub ---------------- */
function renderHub(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "كل ما يجمعنا")));
  c.appendChild(h("div", { class: "hub-hint" }, "اضغطا مطوّلًا على أي بطاقة لتثبيتها في الأعلى ⭐"));
  const grid = h("div", { class: "hub" },
    hubCard("💛", "لماذا أحبّك", "جرّة أسبابنا", "jar", "her"),
    hubCard("✨", "أوّليّاتنا", "أول كل شيء", "firsts", "gold"),
    hubCard("🎯", "أحلامنا", "قائمة الأمنيات", "goals", "him"),
    hubCard("🌈", "مزاجنا", "كيف نشعر", "mood", "rose"),
    hubCard("💌", "رسائل الغد", "رسائل تُفتح لاحقًا", "letters", "her"),
    hubCard("⏳", "التقويم والعدّاد", "مواعيدنا القادمة", "calendar", "him"),
    hubCard("🕌", "ركن الإيمان", "ذكر وختمة ودعاء", "faith", "gold"),
    hubCard("🌅", "أذكارنا", "الصباح والمساء", "adhkar", "gold"),
    hubCard("🫙", "جرّة الصدقة", "نعطي معًا", "sadaqah", "rose"),
    hubCard("🎵", "أغانينا", "قائمة أغانينا", "songs", "rose"),
    hubCard("🗺️", "خريطتنا", "أماكن تعنينا", "__map", "him"),
    hubCard("📖", "كتابنا", "صفحاتنا مجلّدة", "__book", "rose"),
    hubCard("✨", "حصادنا", "قصّتنا بالأرقام", "__wrapped", "gold"),
    hubCard("📈", "نبضنا", "إيقاعنا برسوم", "__pulse", "him"),
    hubCard("🏆", "إنجازاتنا", "أوسمة رحلتنا", "milestones", "gold"),
    hubCard("🤲", "امتناننا", "شكرٌ كل يوم", "gratitude", "her"),
    hubCard("⚙️", "الإعدادات", "المظهر والتنبيهات", "settings", "him"));
  // favourites float to the top (order kept in store.hubOrder)
  const pinned = store.hubOrder || [];
  const cards = [...grid.children];
  cards.sort((a, b) => {
    const ia = pinned.indexOf(a.dataset.route), ib = pinned.indexOf(b.dataset.route);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  cards.forEach((el) => { el.classList.toggle("pinned", pinned.includes(el.dataset.route)); grid.appendChild(el); });
  c.appendChild(grid);
}
function hubCard(emoji, title, sub, route, tone) {
  const card = h("button", { class: "hub-card tone-" + tone, dataset: { route },
    onclick: () => { if (card._held) { card._held = false; return; } sound.tab(); if (route.startsWith("__")) { go(route.slice(2)); return; } usDir = "in"; go("us/" + route); } },
    h("span", { class: "hub-e" }, emoji), h("span", { class: "hub-t" }, title), h("span", { class: "hub-s" }, sub));
  // long-press pins/unpins (avoids nesting a button inside a button)
  let timer = null;
  const begin = () => { timer = setTimeout(() => { card._held = true; togglePin(route, card); }, 500); };
  const cancel = () => { clearTimeout(timer); };
  card.addEventListener("touchstart", begin, { passive: true });
  card.addEventListener("touchend", cancel);
  card.addEventListener("touchmove", cancel, { passive: true });
  card.addEventListener("mousedown", begin);
  card.addEventListener("mouseup", cancel);
  card.addEventListener("mouseleave", cancel);
  card.addEventListener("contextmenu", (e) => { e.preventDefault(); card._held = true; togglePin(route, card); });
  return card;
}
let pinSuppress = 0;
document.addEventListener("click", (e) => {
  if (Date.now() < pinSuppress) { e.stopPropagation(); e.preventDefault(); }
}, true);
function togglePin(route, card) {
  pinSuppress = Date.now() + 700;
  const list = store.hubOrder || [];
  const i = list.indexOf(route);
  if (i >= 0) { list.splice(i, 1); toast("أُزيل التثبيت"); }
  else { list.unshift(route); toast("ثُبّتت في الأعلى ⭐"); }
  store.hubOrder = list;
  sound.react(); haptic.pick();
  card.classList.toggle("pinned", list.includes(route));
  const grid = card.parentElement;
  if (grid) { const cards = [...grid.children]; cards.sort((a, b) => { const ia = list.indexOf(a.dataset.route), ib = list.indexOf(b.dataset.route); return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib); }); cards.forEach((el) => grid.appendChild(el)); }
}

/* ---------------- lists helpers (jar / firsts / goals reuse jn_lists) ---------------- */
async function getList(kind) { const r = await api.getLists(); if (!r.ok) return null; return (r.data.lists || []).find((x) => x.kind === kind) || null; }
async function ensureList(kind, title, emoji) { let l = await getList(kind); if (l) return l; await api.addList(title, kind, emoji); return await getList(kind); }

/* ---------------- reasons jar ---------------- */
async function jarSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted intro" }, "اجمعا أسباب حبّكما… واسحبا سببًا حين تحتاجانه 🤍"));
  const jar = h("div", { class: "jar-stage card" }, h("div", { class: "muted", style: { textAlign: "center", padding: "20px" } }, "…"));
  c.appendChild(jar);
  const list = h("div", { class: "reasons" }); c.appendChild(list);
  const l = await ensureList("jar", "لماذا أحبّك", "💛");
  const items = (l && l.items) || [];
  function paintJar() {
    clear(jar);
    if (!items.length) { jar.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "18px" } }, "أضيفا أول سبب في الأسفل 💛")); return; }
    jar.appendChild(h("div", { class: "jar-emoji" }, "🫙"));
    const out = h("div", { class: "jar-draw muted" }, "اضغطا لسحب سبب");
    jar.appendChild(out);
    jar.appendChild(h("button", { class: "btn sm", style: { margin: "10px auto 0" }, onclick: () => { const r = items[Math.floor(Math.random() * items.length)]; sound.react(); sparkleAt(innerWidth / 2, innerHeight / 3, ["💛", "🤍", "✨"]); clear(out).appendChild(h("span", { class: "jar-reason" }, "“" + r.text + "”")); } }, "اسحب سببًا 🫙"));
  }
  function paintList() {
    clear(list);
    items.forEach((it) => list.appendChild(h("div", { class: "reason-chip", onclick: async () => { if (await confirmAsk("حذف هذا السبب؟", { okText: "حذف", danger: true })) { await api.delItem(it.id); const i = items.indexOf(it); items.splice(i, 1); paintList(); paintJar(); } } }, "💛 " + it.text)));
  }
  paintJar(); paintList();
  c.appendChild(adder(__g("لأنك…", "لأنك…"), async (text) => { const r = await api.addItem(l.id, text); if (r.ok) { sound.post(); jarSection(pane); } else toast("تعذّر الحفظ"); }));
}

/* ---------------- firsts shelf ---------------- */
async function firstsSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted intro" }, "أول لقاء، أول رحلة، أول ضحكة… احفظا أوائلكما ✨"));
  const shelf = h("div", { class: "shelf" }); c.appendChild(shelf);
  const l = await ensureList("firsts", "أوّليّاتنا", "✨");
  const items = (l && l.items) || [];
  function paint() {
    clear(shelf);
    if (!items.length) shelf.appendChild(h("div", { class: "empty-card card" }, h("div", { class: "big" }, "✨"), h("div", { class: "muted" }, "سجّلا أول أوائلكما.")));
    items.forEach((it) => shelf.appendChild(h("div", { class: "first-item card", onclick: async () => { if (await confirmAsk("حذف هذا الأول؟", { okText: "حذف", danger: true })) { await api.delItem(it.id); items.splice(items.indexOf(it), 1); paint(); } } }, h("span", { class: "fi-star" }, "✨"), h("div", {}, it.text))));
  }
  paint();
  c.appendChild(adder("أول…", async (text) => { const r = await api.addItem(l.id, text); if (r.ok) { sound.post(); firstsSection(pane); } else toast("تعذّر الحفظ"); }));
}

/* ---------------- goals / bucket list ---------------- */
async function goalsSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted intro" }, "أحلامٌ نمشي نحوها معًا 🎯"));
  const box = h("div", { class: "goals" }); c.appendChild(box);
  const l = await ensureList("bucket", "أحلامنا", "🎯");
  const items = (l && l.items) || [];
  function paint() {
    clear(box);
    const done = items.filter((i) => i.done).length;
    if (items.length) box.appendChild(h("div", { class: "goal-progress" }, h("div", { class: "gp-bar" }, h("i", { style: { width: (items.length ? (done / items.length) * 100 : 0) + "%" } })), h("span", { class: "muted" }, `${arNum(done)} / ${arNum(items.length)} تحقّق`)));
    if (!items.length) box.appendChild(h("div", { class: "empty-card card" }, h("div", { class: "big" }, "🎯"), h("div", { class: "muted" }, "أضيفا أول حلم.")));
    items.forEach((it) => box.appendChild(h("div", { class: "goal-item card" + (it.done ? " done" : "") },
      h("button", { class: "goal-check", onclick: async () => { const was = it.done; it.done = !it.done; if (it.done) { sound.post(); sparkleAt(innerWidth / 2, innerHeight / 2, ["🎉", "✨", "🎯"]); } paint(); await commit(() => api.toggleItem(it.id), () => { it.done = was; paint(); }); } }, it.done ? "✓" : ""),
      h("div", { class: "goal-text" }, it.text),
      h("button", { class: "goal-x", onclick: async () => { if (await confirmAsk("حذف هذا الحلم؟", { okText: "حذف", danger: true })) { await api.delItem(it.id); items.splice(items.indexOf(it), 1); paint(); } } }, "✕"))));
  }
  paint();
  c.appendChild(adder(__g("نتمنى أن…", "نتمنى أن…"), async (text) => { const r = await api.addItem(l.id, text); if (r.ok) { sound.post(); goalsSection(pane); } else toast("تعذّر الحفظ"); }));
}

/* ---------------- mood tracker ---------------- */
async function moodSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted intro" }, "كيف تشعران اليوم؟ سجّلا مزاجكما وشوفا رحلتكما 🌈"));
  const today = h("div", { class: "card" }); c.appendChild(today);
  const grid = h("div", { class: "mood-cal card" }); c.appendChild(grid);
  const [rt, cal] = await Promise.all([api.ritualsToday(), api.moodCalendar(21)]);
  const mine = rt.ok && rt.data.checkin ? rt.data.checkin.mine : null;
  clear(today);
  today.appendChild(h("div", { class: "t-h2", style: { marginBottom: "10px" } }, "مزاجي اليوم"));
  const chips = h("div", { class: "chip-wrap" });
  MOODS.forEach(([label, emo]) => chips.appendChild(h("button", { class: "chip" + (mine === label ? " rose" : ""), onclick: async () => { const r = await api.setCheckin(label, null); if (r.ok) { chips.querySelectorAll(".chip").forEach((x) => x.classList.remove("rose")); toast("سُجّل مزاجك 🌈"); sound.react(); moodSection(pane); } } }, emo + " " + label)));
  today.appendChild(chips);
  // calendar heatmap
  clear(grid);
  grid.appendChild(h("div", { class: "t-h2", style: { marginBottom: "10px" } }, "آخر ٢١ يومًا"));
  const items = cal.ok ? cal.data.items : [];
  const byDay = {}; items.forEach((it) => { byDay[it.day] = byDay[it.day] || {}; byDay[it.day][it.author] = it.mood; });
  const row = h("div", { class: "heat" });
  for (let d = 20; d >= 0; d--) {
    const dt = new Date(Date.now() + 180 * 60000 - d * 86400000).toISOString().slice(0, 10);
    const rec = byDay[dt] || {};
    row.appendChild(h("div", { class: "heat-cell", title: dt },
      h("span", { class: "hc-him" }, rec.him ? moodEmoji(rec.him) : "·"),
      h("span", { class: "hc-her" }, rec.her ? moodEmoji(rec.her) : "·")));
  }
  grid.appendChild(row);
  grid.appendChild(h("div", { class: "heat-legend muted" }, h("span", {}, "▲ " + PEOPLE[store.person].name + " (فوق)"), h("span", {}, PEOPLE[other(store.person)].name + " (تحت)")));
}

/* ---------------- letters (time capsules) ---------------- */
async function lettersSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted intro" }, "اكتبا رسالة تُختم اليوم… وتُفتح في يومٍ تختارانه 💌"));
  c.appendChild(h("button", { class: "btn", onclick: () => compose(), style: { marginBottom: "14px" } }, "✍️ " + __g("اكتب رسالة", "اكتبي رسالة")));
  const box = h("div", {}); c.appendChild(box);
  box.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "16px" } }, "…"));
  const r = await api.listLetters();
  clear(box);
  if (!r.ok) { box.appendChild(errorState(() => lettersSection(pane), { offline: r.offline })); return; }
  const items = r.data.items || [];
  if (!items.length) { box.appendChild(h("div", { class: "empty-card card" }, h("div", { class: "big" }, "💌"), h("div", { class: "muted" }, "لا رسائل بعد."))); return; }
  const now = Date.now();
  items.forEach((L) => {
    const locked = new Date(L.unlock_at).getTime() > now;
    const p = PEOPLE[L.author] || PEOPLE.him;
    const openLetter = async () => {
      if (locked) { toast("تُفتح في " + fullDate(L.unlock_at)); return; }
      const rr = await api.openLetter(L.id);
      const body = (rr.ok && rr.data.letter && rr.data.letter.body) || L.body || "";
      openModal({ title: "💌 رسالة من " + p.name, body: [h("div", { class: "letter-body" }, body), h("div", { class: "muted", style: { textAlign: "center", marginTop: "10px", fontSize: "12px" } }, fullDate(L.unlock_at))] });
    };
    const card = h("div", { class: "letter card " + (locked ? "locked" : "open"), "aria-label": locked ? "رسالة مختومة" : "افتح الرسالة", onclick: openLetter },
      h("span", { class: "letter-ic" }, locked ? "🔒" : "💌"),
      h("div", { class: "letter-meta" }, h("b", {}, locked ? "رسالة مختومة" : "رسالة مفتوحة"), h("span", { class: "muted" }, "من " + p.name + " · " + (locked ? "تُفتح " + fullDate(L.unlock_at) : "افتحاها"))));
    box.appendChild(clickable(card, openLetter));
  });

  function compose() {
    const body = h("textarea", { class: "field", rows: 5, placeholder: __g("رسالتي لك بعد حين…", "رسالتي لك بعد حين…") });
    const date = h("input", { class: "field", type: "date" });
    const { close } = openSheet({ title: "رسالة إلى الغد 💌", subtitle: "ستُختم حتى التاريخ الذي تختارانه", body: [
      body, h("label", { class: "lbl" }, "تُفتح في"), date,
      h("div", { class: "row-btns", style: { marginTop: "14px" } }, h("button", { class: "btn ghost", onclick: () => close() }, "إلغاء"),
        h("button", { class: "btn", onclick: async () => { const t = body.value.trim(); if (!t) return; if (!date.value) { toast("اختارا تاريخ الفتح"); return; } loader(true); const rr = await api.addLetter({ body: t, unlock_at: date.value }); loader(false); if (rr.ok) { close(); sound.post(); toast("خُتمت رسالتكما 💌"); lettersSection(pane); } else toast("تعذّر الحفظ"); } }, __g("اختمها", "اختميها")))] });
  }
}

/* ---------------- calendar + countdowns ---------------- */
async function calendarSection(pane) {
  const c = clear(pane);
  const cds = h("div", {}); c.appendChild(h("div", { class: "t-h2", style: { margin: "4px 4px 10px" } }, "عدّادات ⏳"));
  c.appendChild(cds);
  c.appendChild(h("button", { class: "btn soft sm", style: { margin: "10px 0" }, onclick: () => addCd() }, "＋ عدّاد جديد"));
  const evs = h("div", {}); c.appendChild(h("div", { class: "t-h2", style: { margin: "12px 4px 10px" } }, "مواعيد 📅"));
  c.appendChild(evs);
  c.appendChild(h("button", { class: "btn soft sm", style: { margin: "10px 0" }, onclick: () => addEv() }, "＋ موعد جديد"));

  const [rt, ev] = await Promise.all([api.ritualsToday(), api.listEvents()]);
  const countdowns = (rt.ok && rt.data.countdowns) || [];
  clear(cds);
  if (!countdowns.length) cds.appendChild(h("div", { class: "muted", style: { padding: "8px 4px" } }, "لا عدّادات — أضيفا يومًا تنتظرانه."));
  countdowns.forEach((cd) => {
    const days = Math.ceil((new Date(cd.target_date).getTime() - Date.now()) / 86400000);
    cds.appendChild(h("div", { class: "count-chip" }, h("span", { class: "ce" }, cd.emoji || "🗓️"), h("div", { class: "cb" }, h("b", {}, cd.title), h("div", { class: "muted", style: { fontSize: "12px" } }, fullDate(cd.target_date))),
      h("span", { class: "cd" }, days > 0 ? "بعد " + arNum(days) + " يوم" : days === 0 ? "اليوم! 🎉" : "مضى"),
      h("button", { class: "goal-x", onclick: async () => { if (await confirmAsk("حذف العدّاد؟", { okText: "حذف", danger: true })) { await api.delCountdown(cd.id); calendarSection(pane); } } }, "✕")));
  });
  const events = ev.ok ? ev.data.items : [];
  clear(evs);
  if (!events.length) evs.appendChild(h("div", { class: "muted", style: { padding: "8px 4px" } }, "لا مواعيد قادمة."));
  events.forEach((e) => evs.appendChild(h("div", { class: "count-chip" }, h("span", { class: "ce" }, "📅"), h("div", { class: "cb" }, h("b", {}, e.title), h("div", { class: "muted", style: { fontSize: "12px" } }, fullDate(e.date) + (e.time ? " · " + e.time : "") + (e.note ? " · " + e.note : ""))),
    h("button", { class: "goal-x", onclick: async () => { if (await confirmAsk("حذف الموعد؟", { okText: "حذف", danger: true })) { await api.delEvent(e.id); calendarSection(pane); } } }, "✕"))));

  function addCd() {
    const title = h("input", { class: "field", placeholder: "المناسبة (عيدنا، سفرتنا…)" });
    const date = h("input", { class: "field", type: "date" });
    const emo = h("input", { class: "field", placeholder: "إيموجي (اختياري)", maxLength: 2 });
    const { close } = openModal({ title: "عدّاد جديد ⏳", body: [h("label", { class: "lbl" }, "العنوان"), title, h("label", { class: "lbl" }, "التاريخ"), date, h("label", { class: "lbl" }, "رمز"), emo,
      h("div", { class: "row-btns", style: { marginTop: "14px" } }, h("button", { class: "btn ghost", onclick: () => close() }, "إلغاء"),
        h("button", { class: "btn", onclick: async () => { if (!title.value.trim() || !date.value) { toast("أكملا العنوان والتاريخ"); return; } await api.addCountdown(title.value.trim(), date.value, emo.value.trim() || "🗓️"); close(); sound.post(); calendarSection(pane); } }, "أضف"))] });
  }
  function addEv() {
    const title = h("input", { class: "field", placeholder: "الموعد" });
    const date = h("input", { class: "field", type: "date" });
    const time = h("input", { class: "field", type: "time" });
    const note = h("input", { class: "field", placeholder: "ملاحظة (اختياري)" });
    const { close } = openModal({ title: "موعد جديد 📅", body: [h("label", { class: "lbl" }, "العنوان"), title, h("label", { class: "lbl" }, "التاريخ"), date, h("label", { class: "lbl" }, "الوقت"), time, h("label", { class: "lbl" }, "ملاحظة"), note,
      h("div", { class: "row-btns", style: { marginTop: "14px" } }, h("button", { class: "btn ghost", onclick: () => close() }, "إلغاء"),
        h("button", { class: "btn", onclick: async () => { if (!title.value.trim() || !date.value) { toast("أكملا العنوان والتاريخ"); return; } await api.addEvent({ title: title.value.trim(), date: date.value, time: time.value || undefined, note: note.value.trim() || undefined }); close(); sound.post(); calendarSection(pane); } }, "أضف"))] });
  }
}

/* ---------------- faith corner ---------------- */
const ADHKAR = [["subhanallah", "سبحان الله"], ["alhamdulillah", "الحمد لله"], ["allahuakbar", "الله أكبر"], ["lailahaillallah", "لا إله إلا الله"], ["astaghfirullah", "أستغفر الله"], ["salaala", "اللهم صلِّ على محمد"]];
function safeJSON(k, dflt) { try { return JSON.parse(localStorage.getItem(k)) ?? dflt; } catch { return dflt; } }
async function faithSection(pane) {
  const c = clear(pane);
  const [dk, kh, du] = await Promise.all([api.getDhikr(), api.getKhatmah(), api.listDuas()]);

  // ---- daily dhikr goal ring + tasbeeh ----
  c.appendChild(h("h2", { class: "t-h2", style: { margin: "2px 4px 10px" } }, "مسبحتنا 📿"));
  const dbox = h("div", { class: "card dhikr-box" }); c.appendChild(dbox);
  renderDhikr(dbox);

  // ---- salah check-in ----
  c.appendChild(h("h2", { class: "t-h2", style: { margin: "16px 4px 10px" } }, "صلواتنا 🕌"));
  c.appendChild(salahCard());

  // ---- khatmah ----
  c.appendChild(h("h2", { class: "t-h2", style: { margin: "16px 4px 10px" } }, "ختمتنا 📖"));
  const kbox = h("div", { class: "card" }); c.appendChild(kbox);
  renderKhatmah(kbox);

  // ---- du'a for spouse + wall ----
  c.appendChild(h("h2", { class: "t-h2", style: { margin: "16px 4px 10px" } }, "جدار الدعاء 🤲"));
  c.appendChild(duaNudge());
  c.appendChild(h("button", { class: "btn soft sm", style: { marginBottom: "10px" }, onclick: () => addDua() }, "＋ أضف دعوة"));
  const wbox = h("div", {}); c.appendChild(wbox);
  renderDuas(wbox);

  // ---- weekly marriage khalwa ----
  const kw = genKhalwa({ seed: "k" + weekIdx(), remember: false });
  c.appendChild(h("h2", { class: "t-h2", style: { margin: "16px 4px 10px" } }, "خلوة الأسبوع 🤍"));
  c.appendChild(h("div", { class: "card weekly-card" }, h("div", { class: "wk-t" }, kw.theme),
    h("div", { class: "muted", style: { fontFamily: "var(--font-quote)", fontSize: "15px", lineHeight: "1.9", marginBottom: "10px" } }, kw.source),
    h("div", { class: "wk-d" }, kw.prompt),
    h("div", { class: "muted", style: { marginTop: "10px", fontSize: "13px" } }, "خطوةٌ هذا الأسبوع: " + kw.action)));

  function renderDhikr(box) {
    clear(box);
    const counts = (dk.ok && dk.data.counts) || {};
    const goal = Number(localStorage.getItem("yn_dhikr_goal") || 100);
    let rec = safeJSON("yn_dhikr_day", {}); if (rec.date !== dayStr()) rec = { date: dayStr(), count: 0 };
    const pct = () => Math.min(100, Math.round((rec.count / goal) * 100));
    const ring = h("div", { class: "ring", style: { "--p": pct() } }, h("i", {}, arNum(rec.count)));
    const gstreak = curStreak("yn_dhikr_last", "yn_dhikr_streak");
    box.appendChild(h("div", { class: "dhikr-goal" }, ring,
      h("div", { class: "gb" }, h("b", {}, "هدف اليوم: " + arNum(goal)),
        h("div", { class: "muted" }, "المجموع الكلّي: " + arNum((dk.ok && dk.data.total) || 0) + (gstreak ? " · 🔥 " + arNum(gstreak) + " يوم" : "")),
        h("button", { class: "btn ghost sm", style: { marginTop: "6px" }, onclick: setGoal }, "تغيير الهدف"))));
    ADHKAR.forEach(([key, label]) => {
      const cnt = h("span", { class: "dh-count" }, arNum(counts[key] || 0));
      box.appendChild(h("button", { class: "dhikr-row", onclick: async () => {
        counts[key] = (counts[key] || 0) + 1; cnt.textContent = arNum(counts[key]);
        rec.count++; localStorage.setItem("yn_dhikr_day", JSON.stringify(rec));
        ring.style.setProperty("--p", pct()); ring.querySelector("i").textContent = arNum(rec.count);
        if (rec.count === goal) { const s = bumpStreak("yn_dhikr_last", "yn_dhikr_streak"); confetti(); sound.post(); toast("أتممتما هدف اليوم! 🔥 " + arNum(s)); }
        haptic.soft(); sound.react();
        await commit(() => api.incDhikr(key, 1), () => {
          counts[key] = Math.max(0, (counts[key] || 1) - 1); cnt.textContent = arNum(counts[key]);
          rec.count = Math.max(0, rec.count - 1); localStorage.setItem("yn_dhikr_day", JSON.stringify(rec));
          ring.style.setProperty("--p", pct()); ring.querySelector("i").textContent = arNum(rec.count);
        });
      } }, h("span", { class: "dh-label" }, label), cnt));
    });
    function setGoal() {
      const inp = h("input", { class: "field", type: "number", value: goal, inputmode: "numeric" });
      const { close } = openModal({ title: "هدف الذكر اليومي 📿", body: [inp, h("div", { class: "row-btns", style: { marginTop: "14px" } }, h("button", { class: "btn ghost", onclick: () => close() }, "إلغاء"), h("button", { class: "btn", onclick: () => { localStorage.setItem("yn_dhikr_goal", String(Number(inp.value) || 100)); close(); faithSection(pane); } }, "حفظ"))] });
    }
  }

  function salahCard() {
    const key = "yn_salah_" + dayStr();
    const prayed = safeJSON(key, []);
    const NAMES = [["fajr", "الفجر"], ["dhuhr", "الظهر"], ["asr", "العصر"], ["maghrib", "المغرب"], ["isha", "العشاء"]];
    const streak = curStreak("yn_salah_last", "yn_salah_streak");
    const row = h("div", { class: "salah-row" });
    NAMES.forEach(([k, label]) => {
      const cell = h("button", { class: "salah-cell" + (prayed.includes(k) ? " on" : ""), "aria-pressed": prayed.includes(k) ? "true" : "false", onclick: () => {
        const i = prayed.indexOf(k); if (i >= 0) prayed.splice(i, 1); else prayed.push(k);
        localStorage.setItem(key, JSON.stringify(prayed));
        const on = prayed.includes(k); cell.classList.toggle("on", on); cell.setAttribute("aria-pressed", on ? "true" : "false"); cell.querySelector(".sc-tick").textContent = on ? "✓" : "○";
        if (prayed.length === 5) { const s = bumpStreak("yn_salah_last", "yn_salah_streak"); sound.post(); sparkleAt(innerWidth / 2, innerHeight / 2, ["🕌", "✨", "🤍"]); toast("خمسٌ اليوم 🤍 🔥 " + arNum(s)); }
      } }, h("span", { class: "sc-tick" }, prayed.includes(k) ? "✓" : "○"), label);
      row.appendChild(cell);
    });
    return h("div", { class: "card" }, streak ? h("div", { class: "streak-badge" }, "🔥 " + arNum(streak) + " يومًا كاملة") : null, row, h("div", { class: "muted", style: { fontSize: "12px", marginTop: "8px", textAlign: "center" } }, "سجّلا صلواتكما اليوم"));
  }

  function renderKhatmah(box) {
    clear(box);
    const K = kh.ok ? kh.data.khatmah : null;
    const logs = (kh.ok && kh.data.logs) || [];
    if (!K) { box.appendChild(h("button", { class: "btn", onclick: async () => { await api.newKhatmah("ختمتنا", 30); faithSection(pane); } }, "ابدآ ختمة (٣٠ جزء)")); return; }
    const marked = new Set(logs.map((l) => Number(l.unit)));
    let todayJuz = 0; for (let j = 1; j <= K.total; j++) if (!marked.has(j)) { todayJuz = j; break; }
    box.appendChild(h("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" } }, h("b", {}, K.name), h("span", { class: "muted khcount", style: { marginInlineStart: "auto" } }, arNum(marked.size) + " / " + arNum(K.total))));
    box.appendChild(h("div", { class: "gp-bar", style: { marginBottom: "12px" } }, h("i", { style: { width: (marked.size / K.total) * 100 + "%" } })));
    const target = localStorage.getItem("yn_khatmah_target");
    if (target) {
      const daysLeft = Math.ceil((new Date(target).getTime() - Date.now()) / 86400000);
      const remaining = K.total - marked.size;
      if (remaining === 0) box.appendChild(h("div", { class: "pace-line ahead" }, "🎉 أتممتما الختمة — تقبّل الله"));
      else if (daysLeft <= 0) box.appendChild(h("div", { class: "pace-line behind" }, "انتهى الموعد — بقي " + arNum(remaining) + " جزء"));
      else box.appendChild(h("div", { class: "pace-line" }, "⏳ بقي " + arNum(daysLeft) + " يوم · اقرآ ~" + arNum(Math.ceil(remaining / daysLeft)) + " جزء يوميًا"));
    } else {
      box.appendChild(h("button", { class: "btn ghost sm", style: { marginBottom: "8px" }, onclick: () => { const inp = h("input", { class: "field", type: "date" }); const { close } = openModal({ title: "موعد ختمتكما 📖", body: [inp, h("div", { class: "row-btns", style: { marginTop: "14px" } }, h("button", { class: "btn ghost", onclick: () => close() }, "إلغاء"), h("button", { class: "btn", onclick: () => { if (inp.value) localStorage.setItem("yn_khatmah_target", inp.value); close(); faithSection(pane); } }, "حفظ"))] }); } }, "＋ حدّدا موعد الختمة"));
    }
    if (todayJuz) box.appendChild(h("div", { class: "muted", style: { fontSize: "13px", marginBottom: "10px" } }, "جزء اليوم: الجزء " + arNum(todayJuz)));
    const grid = h("div", { class: "juz-grid" });
    for (let j = 1; j <= K.total; j++) {
      const cell = h("button", { class: "juz" + (marked.has(j) ? " on" : "") + (j === todayJuz ? " today" : ""), onclick: async () => {
        if (cell.classList.contains("on")) return;
        cell.classList.add("on"); cell.classList.remove("today"); marked.add(j);
        box.querySelector(".gp-bar i").style.width = (marked.size / K.total) * 100 + "%";
        const cnt = box.querySelector(".khcount"); if (cnt) cnt.textContent = arNum(marked.size) + " / " + arNum(K.total);
        sound.react(); haptic.success(); sparkleAt(innerWidth / 2, innerHeight / 2, ["📖", "✨", "🤍"]);
        const saved = await commit(() => api.markJuz(K.id, j), () => {
          cell.classList.remove("on"); if (j === todayJuz) cell.classList.add("today"); marked.delete(j);
          box.querySelector(".gp-bar i").style.width = (marked.size / K.total) * 100 + "%";
          const c2 = box.querySelector(".khcount"); if (c2) c2.textContent = arNum(marked.size) + " / " + arNum(K.total);
        });
        if (saved && marked.size === K.total) { confetti(); toast("أتممتما ختمة القرآن 🤍 تقبّل الله"); }
      } }, arNum(j));
      grid.appendChild(cell);
    }
    box.appendChild(grid);
  }

  function duaNudge() {
    const partner = other(store.person);
    const line = duaForSpouse({ seed: "d" + dayIdx(), remember: false });
    return h("div", { class: "card dua-nudge" }, h("div", { class: "dn-t" }, line),
      h("button", { class: "btn sm", style: { width: "auto" }, onclick: async () => { const r = await api.addDua(line, PEOPLE[partner].name); if (r.ok) { sound.post(); toast("أضيفت للجدار 🤲"); faithSection(pane); } else toast("تعذّر"); } }, "ادعُ لِ" + PEOPLE[partner].name + " اليوم 🤲"));
  }

  function renderDuas(box) {
    clear(box);
    const duas = du.ok ? du.data.items : [];
    if (!duas.length) { box.appendChild(h("div", { class: "muted", style: { padding: "8px 4px" } }, "أضيفا أول دعوة… ويؤمّن عليها الآخر.")); return; }
    duas.forEach((d) => {
      const ameenArr = Array.isArray(d.ameen) ? d.ameen : [];
      const p = PEOPLE[d.author] || PEOPLE.him;
      const btn = h("button", { class: "ameen-btn" + (ameenArr.includes(store.person) ? " on" : ""), onclick: async (e) => {
        heartFly(e.clientX, e.clientY); sound.react();
        const add = !btn.classList.contains("on"); btn.classList.toggle("on", add);
        const set = new Set(Array.isArray(d.ameen) ? d.ameen : []); add ? set.add(store.person) : set.delete(store.person);
        d.ameen = [...set]; btn.textContent = "🤲 آمين " + (d.ameen.length ? arNum(d.ameen.length) : "");
        await commit(() => api.ameen(d.id), () => {
          btn.classList.toggle("on", !add);
          const back = new Set(d.ameen); add ? back.delete(store.person) : back.add(store.person);
          d.ameen = [...back]; btn.textContent = "🤲 آمين " + (d.ameen.length ? arNum(d.ameen.length) : "");
        });
      } }, "🤲 آمين " + (ameenArr.length ? arNum(ameenArr.length) : ""));
      box.appendChild(h("div", { class: "dua-item card" }, h("div", { class: "dua-text" }, d.body),
        h("div", { class: "dua-foot" }, h("span", { class: "muted" }, p.name + (d.for_whom ? " · لِ" + d.for_whom : "")), btn)));
    });
  }

  function addDua() {
    const partner = other(store.person);
    const body = h("textarea", { class: "field", rows: 3, placeholder: "اللهم…" });
    const forWhom = h("input", { class: "field", placeholder: "لِمن؟ (اختياري)" });
    const chips = h("div", { class: "dua-chip-row" }, ...Array.from({ length: 6 }, (_, k) => duaForSpouse({ seed: "c" + k, remember: false })).map((t) => h("button", { class: "dua-chip", onclick: () => { body.value = t; forWhom.value = PEOPLE[partner].name; } }, t.length > 34 ? t.slice(0, 34) + "…" : t)));
    const { close } = openModal({ title: "دعوة 🤲", body: [h("div", { class: "muted", style: { fontSize: "12px", marginBottom: "6px" } }, "أو اختر دعوةً لشريكك:"), chips, body, h("label", { class: "lbl" }, "لِمن"), forWhom,
      h("div", { class: "row-btns", style: { marginTop: "14px" } }, h("button", { class: "btn ghost", onclick: () => close() }, "إلغاء"),
        h("button", { class: "btn", onclick: async () => { if (!body.value.trim()) return; await api.addDua(body.value.trim(), forWhom.value.trim() || null); close(); sound.post(); faithSection(pane); } }, "أضف"))] });
  }
}

/* ---------------- adhkar (morning / evening) ---------------- */
function adhkarSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted intro" }, "أذكار الصباح والمساء — أتمّاها معًا كل يوم 🌅"));
  let evening = hourLocal() >= 16 || hourLocal() < 4;
  let i = 0, remaining = 0;
  const streak = curStreak("yn_adhkar_last", "yn_adhkar_streak");
  const seg = h("div", { class: "seg" },
    segA("الصباح", false), segA("المساء", true));
  c.appendChild(seg);
  const progress = h("div", { class: "adhkar-progress" });
  const bar = h("div", { class: "gp-bar" }, h("i", { style: { width: "0%" } }));
  progress.appendChild(bar); progress.appendChild(h("span", { class: "muted", id: "adh-count" }, ""));
  if (streak) c.appendChild(h("div", { class: "streak-badge" }, "🔥 " + arNum(streak) + " يومًا متتالية"));
  c.appendChild(progress);
  const stage = h("div", {}); c.appendChild(stage);
  draw();

  function segA(label, ev) {
    return h("button", { class: "seg-b" + (evening === ev ? " on" : ""), onclick: () => { evening = ev; i = 0; seg.querySelectorAll(".seg-b").forEach((b) => b.classList.remove("on")); seg.querySelectorAll(".seg-b")[ev ? 1 : 0].classList.add("on"); draw(); } }, label);
  }
  function set() { return evening ? EVENING_ADHKAR : MORNING_ADHKAR; }
  function draw() {
    const list = set();
    clear(stage);
    if (i >= list.length) {
      const s = bumpStreak("yn_adhkar_last", "yn_adhkar_streak");
      bar.firstChild.style.width = "100%"; document.getElementById("adh-count") && (document.getElementById("adh-count").textContent = arNum(list.length) + " / " + arNum(list.length));
      confetti(); sound.post();
      stage.appendChild(h("div", { class: "adhkar-card done" }, h("div", { class: "adhkar-txt" }, evening ? "تقبّل الله أذكار مسائكما 🌙" : "تقبّل الله أذكار صباحكما 🌅"), h("div", { class: "muted" }, "🔥 سلسلة " + arNum(s) + " يومًا"), h("button", { class: "btn", style: { marginTop: "8px" }, onclick: () => { i = 0; draw(); } }, "من جديد ↻")));
      return;
    }
    const item = list[i];
    remaining = item.repeat;
    const cnt = document.getElementById("adh-count"); if (cnt) cnt.textContent = arNum(i) + " / " + arNum(list.length);
    bar.firstChild.style.width = (i / list.length) * 100 + "%";
    const rep = h("button", { class: "adhkar-rep", onclick: () => { remaining--; if (remaining <= 0) { i++; sound.react(); draw(); } else rep.textContent = arNum(remaining); } }, arNum(remaining));
    stage.appendChild(h("div", { class: "adhkar-card" },
      h("div", { class: "adhkar-txt" }, item.text),
      h("div", { class: "adhkar-ref" }, item.ref + (item.repeat > 1 ? " · " + arNum(item.repeat) + " مرات" : "")),
      rep,
      h("div", { class: "adhkar-nav" },
        h("button", { class: "btn ghost", onclick: () => { if (i > 0) { i--; draw(); } } }, "السابق"),
        h("button", { class: "btn soft", onclick: () => { i++; draw(); } }, "تخطّي ›"))));
  }
}

/* ---------------- sadaqah jar (reuses jn_lists) ---------------- */
async function sadaqahSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted intro" }, "نعطي معًا… «وما أنفقتم من شيء فهو يخلفه» 🤍"));
  const box = h("div", {}); c.appendChild(box);
  box.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "12px" } }, "…"));
  const l = await ensureList("sadaqah", "جرّة الصدقة", "🫙");
  const items = (l && l.items) || [];
  const goal = Number(localStorage.getItem("yn_sadaqah_goal") || 0);
  clear(box);
  if (goal > 0) box.appendChild(h("div", { class: "goal-progress" }, h("div", { class: "gp-bar" }, h("i", { style: { width: Math.min(100, (items.length / goal) * 100) + "%" } })), h("span", { class: "muted" }, arNum(items.length) + " / " + arNum(goal) + " هذا الشهر")));
  box.appendChild(h("button", { class: "btn soft sm", style: { margin: "6px 0 12px" }, onclick: setGoal }, goal > 0 ? "تغيير الهدف الشهري" : "＋ حدّدا هدفًا شهريًا"));
  if (!items.length) box.appendChild(h("div", { class: "empty-card card" }, h("div", { class: "big" }, "🫙"), h("div", { class: "muted" }, "سجّلا أول صدقة لكما.")));
  items.forEach((it) => box.appendChild(h("div", { class: "first-item card" }, h("span", { class: "fi-star" }, "🤲"), h("div", { style: { flex: 1 } }, it.text), h("button", { class: "goal-x", "aria-label": "حذف", onclick: async () => { if (await confirmAsk("حذف؟", { okText: "حذف", danger: true })) { await api.delItem(it.id); sadaqahSection(pane); } } }, "✕"))));
  c.appendChild(adder("تصدّقنا بـ… (وصف اختياري)", async (text) => { const r = await api.addItem(l.id, text || "صدقة 🤲"); if (r.ok) { sound.post(); sparkleAt(innerWidth / 2, innerHeight / 2, ["🤲", "✨", "🤍"]); sadaqahSection(pane); } else toast("تعذّر"); }, "تصدّقنا اليوم 🤲"));
  function setGoal() {
    const inp = h("input", { class: "field", type: "number", value: goal || "", inputmode: "numeric", placeholder: "عدد الصدقات هذا الشهر" });
    const { close } = openModal({ title: "هدف الصدقة الشهري 🫙", body: [inp, h("div", { class: "row-btns", style: { marginTop: "14px" } }, h("button", { class: "btn ghost", onclick: () => close() }, "إلغاء"), h("button", { class: "btn", onclick: () => { localStorage.setItem("yn_sadaqah_goal", String(Number(inp.value) || 0)); close(); sadaqahSection(pane); } }, "حفظ"))] });
  }
}

/* ---------------- songs playlist ---------------- */
async function songsSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted intro" }, "أغانٍ تحكي عنّا 🎵"));
  c.appendChild(h("button", { class: "btn", style: { marginBottom: "14px" }, onclick: () => add() }, "＋ أضف أغنية"));
  const box = h("div", {}); c.appendChild(box);
  box.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "16px" } }, "…"));
  const r = await api.listPlaylist();
  clear(box);
  if (!r.ok) { box.appendChild(errorState(() => songsSection(pane), { offline: r.offline })); return; }
  const items = r.data.items || [];
  if (!items.length) { box.appendChild(h("div", { class: "empty-card card" }, h("div", { class: "big" }, "🎵"), h("div", { class: "muted" }, "أضيفا أول أغنية لكما."))); return; }
  items.forEach((s) => {
    const p = PEOPLE[s.added_by] || PEOPLE.him;
    const inner = h("div", { class: "song-item card" }, h("span", { class: "cassette" }, "🎵"),
      h("div", { class: "meta" }, h("b", {}, s.title), h("span", { class: "muted" }, (s.artist || "") + " · " + p.name)),
      h("button", { class: "goal-x", onclick: async (e) => { e.stopPropagation(); e.preventDefault(); if (await confirmAsk("حذف الأغنية؟", { okText: "حذف", danger: true })) { await api.delSong(s.id); songsSection(pane); } } }, "✕"));
    const su = safeUrl(s.url);
    box.appendChild(su ? h("a", { href: su, target: "_blank", rel: "noreferrer", style: { textDecoration: "none" } }, inner) : inner);
  });
  function add() {
    const title = h("input", { class: "field", placeholder: "اسم الأغنية" });
    const artist = h("input", { class: "field", placeholder: "المغني/ة" });
    const url = h("input", { class: "field", placeholder: "رابط (يوتيوب/سبوتيفاي)", inputmode: "url" });
    const { close } = openModal({ title: "أغنية لنا 🎵", body: [h("label", { class: "lbl" }, "العنوان"), title, h("label", { class: "lbl" }, "المغني/ة"), artist, h("label", { class: "lbl" }, "الرابط"), url,
      h("div", { class: "row-btns", style: { marginTop: "14px" } }, h("button", { class: "btn ghost", onclick: () => close() }, "إلغاء"),
        h("button", { class: "btn", onclick: async () => { if (!title.value.trim()) { title.focus(); return; } await api.addSong({ title: title.value.trim(), artist: artist.value.trim(), url: url.value.trim() }); close(); sound.post(); songsSection(pane); } }, "أضف"))] });
  }
}

/* ---------------- milestones ---------------- */
async function milestonesSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "16px" } }, "…"));
  const r = await api.milestones();
  clear(c);
  if (!r.ok) { c.appendChild(errorState(() => milestonesSection(pane), { offline: r.offline })); return; }
  const d = r.data;
  c.appendChild(h("div", { class: "ms-hero card" },
    h("div", { class: "ms-big" }, arNum(d.days_together || 0)),
    h("div", { class: "ms-cap" }, "يومًا معًا 🤍"),
    h("div", { class: "ms-stats" },
      stat("🔥", arNum(d.streak_current || 0), "سلسلة"),
      stat("📔", arNum(d.totals?.moments || 0), "لحظة"),
      stat("💬", arNum(d.totals?.notes || 0), "همسة"),
      stat("🎙️", arNum(d.totals?.voice || 0), "صوت"))));
  const grid = h("div", { class: "badges" }); c.appendChild(grid);
  (d.badges || []).forEach((b) => {
    const meta = BADGES[b.key] || { emoji: "⭐", title: b.key, hint: "" };
    grid.appendChild(h("div", { class: "badge" + (b.unlocked ? " on" : " off") },
      h("span", { class: "badge-e" }, meta.emoji), h("span", { class: "badge-t" }, meta.title), h("span", { class: "badge-h muted" }, b.unlocked ? "✓" : meta.hint)));
  });
  function stat(e, n, l) { return h("div", { class: "ms-stat" }, h("span", { class: "mss-e" }, e), h("b", {}, n), h("span", { class: "muted" }, l)); }
}

/* ---------------- gratitude ---------------- */
async function gratitudeSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted intro" }, "ثلاثة أشياء نشكر الله عليها اليوم 🤲"));
  const gstreak = curStreak("yn_grat_last", "yn_grat_streak");
  if (gstreak) c.appendChild(h("div", { class: "streak-badge" }, "🔥 امتنانكما " + arNum(gstreak) + " يومًا متتالية"));
  c.appendChild(adder(__g("أنا ممتنّ لـ…", "أنا ممتنّة لـ…"), async (text) => { const r = await api.addGratitude(text); if (r.ok) { bumpStreak("yn_grat_last", "yn_grat_streak"); sound.post(); toast("تُقبل شكركما 🤍"); gratitudeSection(pane); } else toast("تعذّر"); }));
  const box = h("div", { style: { marginTop: "12px" } }); c.appendChild(box);
  const rt = await api.ritualsToday();
  const g = (rt.ok && rt.data.gratitude) || { mine: [], theirs: [] };
  const render = (arr, who) => (arr || []).forEach((t) => { const p = PEOPLE[who]; box.appendChild(h("div", { class: "grat-item card" }, h("span", { class: `avatar sm ${p.cls}` }, p.initial), h("div", {}, typeof t === "string" ? t : t.text))); });
  render(g.mine, store.person); render(g.theirs, other(store.person));
  if (!(g.mine || []).length && !(g.theirs || []).length) box.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "10px" } }, "لا امتنان اليوم بعد."));
}

/* ---------------- settings ---------------- */
async function settingsSection(pane) {
  const c = clear(pane);
  const [acct, pcs] = await Promise.all([
    api.getAccount().catch(() => ({ ok: false, data: {} })),
    api.getPasscodes().catch(() => ({ ok: false, data: {} })),
  ]);
  // theme
  c.appendChild(settingCard("المظهر 🎨", [
    h("div", { class: "seg" }, ...[["system", "تلقائي"], ["light", "نهار"], ["dark", "ليل"]].map(([v, l]) =>
      h("button", { class: "seg-b" + (store.theme === v ? " on" : ""), onclick: (e) => { store.theme = v; applyTheme(); c.querySelectorAll(".theme-seg .seg-b").forEach((x) => x.classList.remove("on")); e.currentTarget.classList.add("on"); } }, l))),
  ], "theme-seg"));
  // accent
  const dots = h("div", { class: "accent-row" }, ...Object.entries(ACCENT_PRESETS).map(([key, p]) =>
    h("button", { class: "accent-dot" + (store.accent === key ? " on" : ""), style: { background: p.dot }, title: p.name, onclick: (e) => { store.accent = key; applyAccent(); dots.querySelectorAll(".accent-dot").forEach((x) => x.classList.remove("on")); e.currentTarget.classList.add("on"); } })));
  c.appendChild(settingCard("لون البشرة 🌸", [dots]));
  // background (presets + own photo, per person)
  const curBg = store.config["bg_" + store.person] || "";
  function pickBg() {
    const inp = h("input", { type: "file", accept: "image/*", class: "hidden", onchange: async (e) => { const f = e.target.files[0]; if (!f) { inp.remove(); return; } loader(true); try { const ds = await downscale(f, 1400); const su = await api.signUpload("photo", "image/jpeg"); if (su.ok) { await uploadSigned(su.data.signedUrl, ds.blob, "image/jpeg"); await api.setConfig("bg_" + store.person, su.data.path); store.setConfig({ ["bg_" + store.person]: su.data.path }); applyBackground(); toast("خلفيتكما جاهزة 🌄"); } } catch { toast("تعذّر"); } loader(false); inp.remove(); settingsSection(pane); } });
    document.body.appendChild(inp); inp.click();
  }
  const swatches = h("div", { class: "bg-swatches" },
    ...Object.entries(BG_PRESETS).map(([key, p]) => h("button", { class: "bg-swatch" + ((curBg === "preset:" + key || (!curBg && key === "default")) ? " on" : ""), "aria-label": p.name, title: p.name, style: { background: p.dot }, onclick: async () => { const prev = store.config["bg_" + store.person] || ""; store.setConfig({ ["bg_" + store.person]: "preset:" + key }); applyBackground(); sound.tab(); await commit(() => api.setConfig("bg_" + store.person, "preset:" + key), () => { store.setConfig({ ["bg_" + store.person]: prev }); applyBackground(); }); settingsSection(pane); } })),
    h("button", { class: "bg-swatch photo" + ((curBg && !curBg.startsWith("preset:")) ? " on" : ""), "aria-label": "صورتنا", title: "صورتنا", onclick: pickBg }));
  c.appendChild(settingCard("الخلفية 🌄", [h("div", { class: "muted", style: { fontSize: "13px", marginBottom: "10px" } }, "خلفيةٌ لكلٍّ منكما — اختر لونًا أو صورةً لكما 📷."), swatches]));
  // sound
  c.appendChild(settingCard("الصوت واللمس 🔊", [
    rowToggle("أصوات لطيفة", store.soundOn, (on) => { store.soundOn = on; if (on) sound.chime(); }),
    rowToggle("اهتزاز عند اللمس", store.hapticsOn, (on) => { store.hapticsOn = on; if (on) haptic.success(); })]));
  // notifications
  const installed = isStandalone();
  const blocked = pushBlockedUntilInstalled();
  c.appendChild(settingCard("التطبيق والتنبيهات 🔔", [
    h("div", { class: "acct-row" }, "📲 التثبيت على الجوّال",
      h("span", { class: "acct-badge " + (installed ? "ok" : "no") }, installed ? "مثبّت ✓" : "غير مثبّت")),
    !installed ? h("button", { class: "btn soft sm", style: { marginBottom: "12px" }, onclick: () => (canPromptInstall() ? promptInstall() : openInstallGuide()) }, "ثبّتا التطبيق") : null,
    h("div", { class: "muted", style: { fontSize: "13px", marginBottom: "10px" } },
      blocked ? "على الآيفون، التنبيهات تعمل فقط بعد تثبيت التطبيق وفتحه من أيقونته."
              : "لتصلكما همسات بعضكما وتنبيهاتكما حتى والتطبيق مغلق."),
    h("button", { class: "btn soft sm", onclick: () => openPushOnboarding() },
      store.pushOn ? "التنبيهات مفعّلة ✓ — إرسال تجربة" : "تفعيل التنبيهات على هذا الجهاز")]));
  // account / email
  const ac = (acct.ok && acct.data.accounts) ? acct.data.accounts : {};
  const mine = ac[store.person] || {}, partner = other(store.person), theirs = ac[partner] || {};
  const emailEnabled = acct.ok && acct.data.email_enabled;
  const emailIn = h("input", { class: "field", type: "email", inputmode: "email", placeholder: "بريدك الإلكتروني", value: mine.email || "" });
  function promptVerify() {
    const codeIn = h("input", { class: "field pin", inputmode: "numeric", maxLength: 6, placeholder: "••••••" });
    const { close } = openModal({ title: "رمز التأكيد", body: [h("div", { class: "muted", style: { textAlign: "center", fontSize: "13px", marginBottom: "8px" } }, "أرسلنا رمزًا إلى بريدك — ينتهي خلال ١٥ دقيقة"), codeIn, h("div", { class: "row-btns", style: { marginTop: "14px" } }, h("button", { class: "btn ghost", onclick: () => close() }, "إلغاء"), h("button", { class: "btn", onclick: async () => { const r = await api.verifyEmail(codeIn.value.trim()); if (r.ok) { close(); toast("تأكّد بريدك ✓"); settingsSection(pane); } else toast(r.data.error === "expired" ? "انتهى الرمز" : "رمز غير صحيح"); } }, "تأكيد"))] });
    setTimeout(() => codeIn.focus(), 50);
  }
  c.appendChild(settingCard("حساباتنا وبريدنا 📧", [
    h("div", { class: "acct-row" }, "📧 " + __g("بريدك", "بريدكِ"), mine.email ? h("span", { class: "acct-badge " + (mine.verified ? "ok" : "no") }, mine.verified ? "مؤكَّد ✓" : "غير مؤكَّد") : null),
    emailIn,
    h("div", { class: "row-btns", style: { marginTop: "10px" } },
      h("button", { class: "btn sm", onclick: async () => { const em = emailIn.value.trim(); if (!em) return; loader(true); const r = await api.setEmail(em); loader(false); if (!r.ok) { toast(r.data.error === "bad_email" ? "بريد غير صحيح" : "تعذّر"); return; } if (r.data.provider && r.data.sent) { toast("أرسلنا الرمز إلى بريدك 📧"); promptVerify(); } else if (r.data.provider) { toast("حُفظ البريد — لكن لم يصل الرمز"); } else toast("حُفظ بريدكما 📧"); settingsSection(pane); } }, "حفظ البريد"),
      (mine.email && !mine.verified && emailEnabled) ? h("button", { class: "btn ghost sm", onclick: () => promptVerify() }, "أدخل الرمز") : null),
    mine.email ? rowToggle("تنبيهات عبر البريد", mine.notify_email !== false, async (on) => { await commit(() => api.setEmailNotify(on), null, "تعذّر تغيير التنبيهات"); }) : null,
    theirs.email ? h("div", { class: "acct-hint" }, "بريد " + PEOPLE[partner].name + ": " + theirs.email + (theirs.verified ? " ✓" : " (غير مؤكَّد)")) : null,
    !emailEnabled ? h("div", { class: "acct-hint" }, "ℹ️ حفظ البريد يعمل الآن. لتفعيل رسائل التأكيد والتنبيهات بالبريد أضِف مفتاح Resend مجاني — أخبرني لأفعّله لكما.") : null,
    (emailEnabled && mine.email && !mine.verified) ? h("div", { class: "acct-hint" }, "لم يصل الرمز؟ خدمة البريد المجانية تسمح مؤقتًا بالإرسال إلى بريد صاحب حساب Resend فقط، حتى توثيق نطاق خاص بكما. التنبيهات على الجوّال تعمل للاثنين بلا قيد 🔔") : null]));
  // personal passcode — proves identity at the front door
  const hasMine = !!(pcs.ok && pcs.data.has && pcs.data.has[store.person]);
  const hasTheirs = !!(pcs.ok && pcs.data.has && pcs.data.has[other(store.person)]);
  c.appendChild(settingCard("رمز الدخول الخاص بك 🔑", [
    h("div", { class: "muted", style: { fontSize: "13px", marginBottom: "10px" } },
      "رمزٌ يخصّك وحدك: حين تدخل به يعرف التطبيق أنك أنت، فتُنسب كل لحظة وهمسة لصاحبها بلا اختيار. كلمة الفتح المشتركة تبقى تعمل."),
    h("div", { class: "acct-row" }, "🔑 " + __g("رمزك", "رمزكِ"),
      h("span", { class: "acct-badge " + (hasMine ? "ok" : "no") }, hasMine ? "مُفعّل ✓" : "غير مُعيَّن")),
    hasTheirs ? h("div", { class: "acct-hint" }, PEOPLE[other(store.person)].name + " ضبطت رمزها الخاص ✓") : null,
    h("div", { class: "row-btns", style: { marginTop: "10px" } },
      h("button", { class: "btn sm", onclick: async () => {
        const code = await promptCode(hasMine ? "رمزٌ جديد (٤ أرقام أو أكثر)" : "اختر رمزك الخاص");
        if (!code) return;
        loader(true); const r = await api.setPasscode(code); loader(false);
        if (r.ok) { sound.post(); toast("صار لك رمزك الخاص 🔑"); settingsSection(pane); }
        else toast(r.data.error === "taken" ? "هذا الرمز مستخدم" : r.data.error === "same_as_shared" ? "لا تستخدم كلمة الفتح المشتركة" : r.data.error === "too_short" ? "٤ أرقام على الأقل" : "تعذّر");
      } }, hasMine ? "غيّر الرمز" : "اضبط رمزك"),
      hasMine ? h("button", { class: "btn ghost sm", onclick: async () => {
        if (!(await confirmAsk("إلغاء رمزك الخاص؟ ستدخل بكلمة الفتح المشتركة.", { okText: "إلغاء الرمز", danger: true }))) return;
        loader(true); const r = await api.clearPasscode(); loader(false);
        if (r.ok) { toast("أُلغي رمزك"); settingsSection(pane); } else toast("تعذّر");
      } }, "ألغِ الرمز") : null)]));
  // app lock
  const lockOn = localStorage.getItem("yn_applock") === "on" || store.sealed;
  c.appendChild(settingCard("قفل التطبيق 🔒", [
    h("div", { class: "muted", style: { fontSize: "13px", marginBottom: "10px" } }, "رمزٌ يُطلب عند فتح التطبيق. عند تفعيله تُشفَّر جلستكما على هذا الجهاز، فلا تُفتح يومياتكما إلا برمزكما — ويُقفل تلقائيًا بعد تركه مفتوحًا في الخلفية."),
    toggle(lockOn, async (on) => {
      if (on) {
        const pin = await promptPin("اختر رمزًا من ٤ أرقام");
        if (!pin) { settingsSection(pane); return; }
        if (!store.token) { toast("تعذّر — أعيدا الدخول"); settingsSection(pane); return; }
        try { store.sealToken(await encryptWithPin(store.token, pin)); } catch { toast("تعذّر التشفير"); settingsSection(pane); return; }
        localStorage.setItem("yn_applock", "on");
        ["yn_applock_pin", "yn_applock_salt", "yn_applock_hash"].forEach((k) => localStorage.removeItem(k));
        toast("فُعّل القفل 🔒 — جلستكما مشفّرة");
        settingsSection(pane); return;                 // re-render so the biometric option appears
      } else {
        store.unsealToken(); bioForget();
        ["yn_applock", "yn_applock_pin", "yn_applock_salt", "yn_applock_hash"].forEach((k) => localStorage.removeItem(k));
        toast("أُلغي القفل");
        settingsSection(pane); return;
      }
    })]));
  if (lockOn) {
    const bioBox = h("div", { class: "acct-hint" }, "…");
    c.appendChild(settingCard("فتحٌ بالبصمة 👆", [
      h("div", { class: "muted", style: { fontSize: "13px", marginBottom: "10px" } }, "افتحا التطبيق ببصمتكما أو وجهكما بدل كتابة الرمز — والرمز يبقى بديلًا دائمًا."),
      bioBox]));
    (async () => {
      const can = await bioAvailable();
      if (!can) { clear(bioBox); bioBox.appendChild(h("span", {}, "هذا الجهاز لا يدعم الفتح بالبصمة.")); return; }
      const on = bioEnrolled();
      const t = toggle(on, async (want) => {
        if (want) {
          if (!store.token) { toast("تعذّر — أعيدا الدخول"); settingsSection(pane); return; }
          try { await bioEnroll(store.token); toast("فُعّلت البصمة 👆"); }
          catch (e) { toast(String(e && e.message) === "no_prf" ? "متصفحكما لا يدعم مفاتيح البصمة" : "أُلغيت العملية"); }
        } else { bioForget(); toast("أُلغيت البصمة"); }
        settingsSection(pane);
      });
      t.style.marginInlineStart = "auto";
      bioBox.replaceWith(h("div", { class: "acct-row" }, h("span", {}, on ? "مُفعّلة على هذا الجهاز ✓" : "غير مُفعّلة"), t));
    })();
  }
  // our story editor (anniversary + dedication + reply → set_config)
  const annIn = h("input", { class: "field story-field", type: "date", value: store.config.anniversary_date || "" });
  const dedIn = h("textarea", { class: "field story-field", rows: 3, placeholder: "إهداءٌ منك…", value: store.config.dedication || "" });
  const repIn = h("textarea", { class: "field story-field", rows: 3, placeholder: "ردُّها…", value: store.config.reply || "" });
  c.appendChild(settingCard("قصّتنا 🤍", [
    h("label", { class: "lbl" }, "تاريخ بدايتنا"), annIn,
    h("label", { class: "lbl" }, "الإهداء"), dedIn,
    h("label", { class: "lbl" }, "ردُّها"), repIn,
    h("button", { class: "btn sm", style: { marginTop: "12px", width: "auto" }, onclick: async () => {
      loader(true);
      const upd = {};
      let allOk = true;
      if (annIn.value !== (store.config.anniversary_date || "")) { if (await commit(() => api.setConfig("anniversary_date", annIn.value || null))) upd.anniversary_date = annIn.value || null; else allOk = false; }
      if (dedIn.value !== (store.config.dedication || "")) { if (await commit(() => api.setConfig("dedication", dedIn.value))) upd.dedication = dedIn.value; else allOk = false; }
      if (repIn.value !== (store.config.reply || "")) { if (await commit(() => api.setConfig("reply", repIn.value))) upd.reply = repIn.value; else allOk = false; }
      store.setConfig(upd); loader(false); if (allOk) { sound.post(); toast("حُفظت قصّتكما 🤍"); }
    } }, "احفظ 🤍")]));

  // about + logout
  c.appendChild(settingCard("نحن 🤍", [
    h("div", { class: "muted", style: { fontSize: "14px", lineHeight: "1.9" } }, "بدأنا في " + (store.config.anniversary_date ? fullDate(store.config.anniversary_date) : "—")),
    h("button", { class: "btn ghost sm", style: { marginTop: "12px" }, onclick: async () => { if (await confirmAsk("تسجيل الخروج من هذا الجهاز؟", { okText: "خروج" })) { store.clearAuth(); go("lock"); location.reload(); } } }, "تسجيل الخروج")]));
}
function settingCard(title, body, cls = "") { return h("div", { class: "card set-card " + cls }, h("div", { class: "t-h2", style: { marginBottom: "12px" } }, title), ...body); }
function toggle(on, onchange) {
  const t = h("button", { class: "toggle" + (on ? " on" : ""), role: "switch", "aria-checked": on ? "true" : "false", onclick: () => { const nv = !t.classList.contains("on"); t.classList.toggle("on", nv); t.setAttribute("aria-checked", nv ? "true" : "false"); onchange(nv); } }, h("span", { class: "knob" }));
  return t;
}
function rowToggle(label, on, cb) { const t = toggle(on, cb); t.style.marginInlineStart = "auto"; return h("div", { class: "acct-row" }, h("span", {}, label), t); }
function promptCode(title) {
  return new Promise((resolve) => {
    const inp = h("input", { class: "field pin", type: "password", inputmode: "numeric", maxLength: 12, placeholder: "••••" });
    const { close } = openModal({ title, body: [inp, h("div", { class: "row-btns", style: { marginTop: "14px" } },
      h("button", { class: "btn ghost", onclick: () => { close(); resolve(null); } }, "إلغاء"),
      h("button", { class: "btn", onclick: () => { const v = inp.value.trim(); if (v.length < 4) { toast("٤ أرقام على الأقل"); return; } close(); resolve(v); } }, "تم"))] });
    setTimeout(() => inp.focus(), 50);
  });
}
function promptPin(title) {
  return new Promise((resolve) => {
    const inp = h("input", { class: "field pin", type: "password", inputmode: "numeric", maxLength: 4, placeholder: "····" });
    const { close } = openModal({ title, body: [inp, h("div", { class: "row-btns", style: { marginTop: "14px" } },
      h("button", { class: "btn ghost", onclick: () => { close(); resolve(null); } }, "إلغاء"),
      h("button", { class: "btn", onclick: () => { const v = inp.value.trim(); if (v.length !== 4) { toast("٤ أرقام"); return; } close(); resolve(v); } }, "تم"))] });
    setTimeout(() => inp.focus(), 50);
  });
}

/* ---------------- theme studio ---------------- */
function studioSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted intro" }, "خمسُ شخصياتٍ كاملة لبيتكما — اختارا ما يشبه مزاجكما اليوم، ولكلٍّ منكما ذوقه على جهازه 🎨"));
  const grid = h("div", { class: "studio-grid stagger" });
  c.appendChild(grid);
  paint();
  function paint() {
    clear(grid);
    for (const [key, sk] of Object.entries(SKINS)) {
      const on = store.skin === key;
      const card = h("button", { class: "studio-card" + (on ? " on" : ""), onclick: () => {
        if (store.skin === key) return;
        store.skin = key; applySkin(); sound.chime(); haptic.pick();
        toast("لُبس المظهر: " + sk.name + " ✨");
        paint();
      } },
        h("span", { class: "studio-swatch" }, ...sk.chip.map((col) => { const i = h("i"); i.style.background = col; return i; })),
        h("div", { class: "studio-meta" }, h("b", {}, sk.name), h("span", {}, sk.desc)),
        on ? h("span", { class: "studio-tick" }, "✓") : null);
      grid.appendChild(card);
    }
    grid.appendChild(h("div", { class: "acct-hint", style: { textAlign: "center" } },
      "المظهر يُحفظ على هذا الجهاز فقط — الوضع الليلي والألوان والخلفية تعمل فوقه."));
  }
}

/* ---------------- shared adder ---------------- */
function adder(placeholder, onAdd, quickLabel) {
  const inp = h("input", { class: "field", placeholder });
  const submit = async () => { const t = inp.value.trim(); if (!t && !quickLabel) return; inp.value = ""; await onAdd(t); };
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  const row = h("div", { class: "adder" }, inp, h("button", { class: "btn sm", "aria-label": "إضافة", onclick: submit }, "＋"));
  if (quickLabel) return h("div", {}, row, h("button", { class: "btn soft sm", style: { marginTop: "8px", width: "100%" }, onclick: () => onAdd("") }, quickLabel));
  return row;
}
