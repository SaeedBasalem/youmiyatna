// يومياتنا — نحن: the "us" hub. Reasons jar, firsts, goals, mood, letters,
// countdowns, faith corner, songs, milestones, gratitude, settings.
import { h, clear, arNum, toast, fullDate, relTime, sparkleAt, heartFly } from "../ui.js";
import { api } from "../api.js";
import { store } from "../store.js";
import { sound } from "../sound.js";
import { PEOPLE, other, MOODS, moodEmoji, BADGES, DUA } from "../config.js";
import { loader, go, openSheet, openModal, confirmAsk, ACCENT_PRESETS, applyTheme, applyAccent } from "../helpers.js";

const sub = () => (location.hash || "").replace(/^#\//, "").split("/")[1] || "";
const dayStr = () => new Date(Date.now() + 180 * 60000).toISOString().slice(0, 10);

export function viewUs(content) {
  const s = sub();
  const c = clear(content);
  if (s) c.appendChild(h("div", { class: "sub-head" },
    h("button", { class: "icon-btn", onclick: () => go("us") }, "→"),
    h("div", { class: "sh-title" }, SECTIONS[s]?.title || "نحن")));
  const pane = h("div", {}); c.appendChild(pane);
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
  songs:      { title: "أغانينا", render: (p) => songsSection(p) },
  milestones: { title: "إنجازاتنا", render: (p) => milestonesSection(p) },
  gratitude:  { title: "امتناننا", render: (p) => gratitudeSection(p) },
  settings:   { title: "الإعدادات", render: (p) => settingsSection(p) },
};

/* ---------------- hub ---------------- */
function renderHub(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "كل ما يجمعنا")));
  c.appendChild(h("div", { class: "hub" },
    hubCard("💛", "لماذا أحبّك", "جرّة أسبابنا", "jar", "her"),
    hubCard("✨", "أوّليّاتنا", "أول كل شيء", "firsts", "gold"),
    hubCard("🎯", "أحلامنا", "قائمة الأمنيات", "goals", "him"),
    hubCard("🌈", "مزاجنا", "كيف نشعر", "mood", "rose"),
    hubCard("💌", "رسائل الغد", "رسائل تُفتح لاحقًا", "letters", "her"),
    hubCard("⏳", "التقويم والعدّاد", "مواعيدنا القادمة", "calendar", "him"),
    hubCard("🕌", "ركن الإيمان", "ذكر وختمة ودعاء", "faith", "gold"),
    hubCard("🎵", "أغانينا", "قائمة أغانينا", "songs", "rose"),
    hubCard("🏆", "إنجازاتنا", "أوسمة رحلتنا", "milestones", "gold"),
    hubCard("🤲", "امتناننا", "شكرٌ كل يوم", "gratitude", "her"),
    hubCard("⚙️", "الإعدادات", "المظهر والتنبيهات", "settings", "him")));
}
function hubCard(emoji, title, sub, route, tone) {
  return h("button", { class: "hub-card tone-" + tone, onclick: () => { sound.tab(); go("us/" + route); } },
    h("span", { class: "hub-e" }, emoji), h("span", { class: "hub-t" }, title), h("span", { class: "hub-s" }, sub));
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
  c.appendChild(adder(__g("لأنك…", "لأنك…"), async (text) => { const r = await api.addItem(l.id, text); if (r.ok) { items.push(r.data.item || { id: r.data.id || "t" + Date.now(), text }); paintList(); paintJar(); sound.post(); } }));
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
  c.appendChild(adder("أول…", async (text) => { const r = await api.addItem(l.id, text); if (r.ok) { items.push(r.data.item || { id: r.data.id || "t" + Date.now(), text }); paint(); sound.post(); } }));
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
      h("button", { class: "goal-check", onclick: async () => { await api.toggleItem(it.id); it.done = !it.done; if (it.done) { sound.post(); sparkleAt(innerWidth / 2, innerHeight / 2, ["🎉", "✨", "🎯"]); } paint(); } }, it.done ? "✓" : ""),
      h("div", { class: "goal-text" }, it.text),
      h("button", { class: "goal-x", onclick: async () => { if (await confirmAsk("حذف هذا الحلم؟", { okText: "حذف", danger: true })) { await api.delItem(it.id); items.splice(items.indexOf(it), 1); paint(); } } }, "✕"))));
  }
  paint();
  c.appendChild(adder(__g("نتمنى أن…", "نتمنى أن…"), async (text) => { const r = await api.addItem(l.id, text); if (r.ok) { items.push(r.data.item || { id: r.data.id || "t" + Date.now(), text, done: false }); paint(); sound.post(); } }));
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
  const items = r.ok ? r.data.items : [];
  if (!items.length) { box.appendChild(h("div", { class: "empty-card card" }, h("div", { class: "big" }, "💌"), h("div", { class: "muted" }, "لا رسائل بعد."))); return; }
  const now = Date.now();
  items.forEach((L) => {
    const locked = new Date(L.unlock_at).getTime() > now;
    const p = PEOPLE[L.author] || PEOPLE.him;
    box.appendChild(h("div", { class: "letter card " + (locked ? "locked" : "open"), onclick: async () => {
      if (locked) { toast("تُفتح في " + fullDate(L.unlock_at)); return; }
      const rr = await api.openLetter(L.id);
      const body = (rr.ok && rr.data.letter && rr.data.letter.body) || L.body || "";
      openModal({ title: "💌 رسالة من " + p.name, body: [h("div", { class: "letter-body" }, body), h("div", { class: "muted", style: { textAlign: "center", marginTop: "10px", fontSize: "12px" } }, fullDate(L.unlock_at))] });
    } },
      h("span", { class: "letter-ic" }, locked ? "🔒" : "💌"),
      h("div", { class: "letter-meta" }, h("b", {}, locked ? "رسالة مختومة" : "رسالة مفتوحة"), h("span", { class: "muted" }, "من " + p.name + " · " + (locked ? "تُفتح " + fullDate(L.unlock_at) : "افتحاها")))));
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
async function faithSection(pane) {
  const c = clear(pane);
  // dhikr
  c.appendChild(h("div", { class: "t-h2", style: { margin: "2px 4px 10px" } }, "مسبحتنا 📿"));
  const dbox = h("div", { class: "dhikr-box card" }, h("div", { class: "muted", style: { textAlign: "center", padding: "10px" } }, "…")); c.appendChild(dbox);
  // khatmah
  c.appendChild(h("div", { class: "t-h2", style: { margin: "16px 4px 10px" } }, "ختمتنا 📖"));
  const kbox = h("div", { class: "card" }, h("div", { class: "muted", style: { textAlign: "center", padding: "10px" } }, "…")); c.appendChild(kbox);
  // du'a wall
  c.appendChild(h("div", { class: "t-h2", style: { margin: "16px 4px 10px" } }, "جدار الدعاء 🤲"));
  c.appendChild(h("button", { class: "btn soft sm", style: { marginBottom: "10px" }, onclick: () => addDua() }, "＋ أضف دعوة"));
  const wbox = h("div", {}); c.appendChild(wbox);

  const [dk, kh, du] = await Promise.all([api.getDhikr(), api.getKhatmah(), api.listDuas()]);
  // dhikr render
  const counts = (dk.ok && dk.data.counts) || {};
  clear(dbox);
  dbox.appendChild(h("div", { class: "dhikr-total" }, "المجموع: " + arNum((dk.ok && dk.data.total) || 0)));
  ADHKAR.forEach(([key, label]) => {
    const cnt = h("span", { class: "dh-count" }, arNum(counts[key] || 0));
    dbox.appendChild(h("button", { class: "dhikr-row", onclick: async () => { const cur = (counts[key] || 0) + 1; counts[key] = cur; cnt.textContent = arNum(cur); if (navigator.vibrate) navigator.vibrate(15); sound.react(); await api.incDhikr(key, 1); } },
      h("span", { class: "dh-label" }, label), cnt));
  });
  // khatmah render
  clear(kbox);
  const K = kh.ok ? kh.data.khatmah : null;
  const logs = (kh.ok && kh.data.logs) || [];
  if (!K) { kbox.appendChild(h("button", { class: "btn", onclick: async () => { await api.newKhatmah("ختمتنا", 30); faithSection(pane); } }, "ابدآ ختمة (٣٠ جزء)")); }
  else {
    const marked = new Set(logs.map((l) => Number(l.unit)));
    kbox.appendChild(h("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" } }, h("b", {}, K.name), h("span", { class: "muted", style: { marginInlineStart: "auto" } }, arNum(marked.size) + " / " + arNum(K.total))));
    kbox.appendChild(h("div", { class: "gp-bar", style: { marginBottom: "12px" } }, h("i", { style: { width: (marked.size / K.total) * 100 + "%" } })));
    const grid = h("div", { class: "juz-grid" });
    for (let j = 1; j <= K.total; j++) {
      const on = marked.has(j);
      grid.appendChild(h("button", { class: "juz" + (on ? " on" : ""), onclick: async () => { if (on) return; marked.add(j); sound.react(); await api.markJuz(K.id, j); faithSection(pane); } }, arNum(j)));
    }
    kbox.appendChild(grid);
  }
  // du'a wall render
  clear(wbox);
  const duas = du.ok ? du.data.items : [];
  if (!duas.length) wbox.appendChild(h("div", { class: "muted", style: { padding: "8px 4px" } }, "أضيفا أول دعوة… ويؤمّن عليها الآخر."));
  duas.forEach((d) => {
    const ameenArr = Array.isArray(d.ameen) ? d.ameen : [];
    const mineAmeen = ameenArr.includes(store.person);
    const p = PEOPLE[d.author] || PEOPLE.him;
    wbox.appendChild(h("div", { class: "dua-item card" },
      h("div", { class: "dua-text" }, d.body),
      h("div", { class: "dua-foot" }, h("span", { class: "muted" }, p.name + (d.for_whom ? " · لِ" + d.for_whom : "")),
        h("button", { class: "ameen-btn" + (mineAmeen ? " on" : ""), onclick: async (e) => { heartFly(e.clientX, e.clientY); sound.react(); await api.ameen(d.id); faithSection(pane); } }, "🤲 آمين " + (ameenArr.length ? arNum(ameenArr.length) : "")))));
  });

  function addDua() {
    const body = h("textarea", { class: "field", rows: 3, placeholder: "اللهم…" });
    const forWhom = h("input", { class: "field", placeholder: "لِمن؟ (اختياري)" });
    const { close } = openModal({ title: "دعوة 🤲", body: [body, h("label", { class: "lbl" }, "لِمن"), forWhom,
      h("div", { class: "row-btns", style: { marginTop: "14px" } }, h("button", { class: "btn ghost", onclick: () => close() }, "إلغاء"),
        h("button", { class: "btn", onclick: async () => { if (!body.value.trim()) return; await api.addDua(body.value.trim(), forWhom.value.trim() || null); close(); sound.post(); faithSection(pane); } }, "أضف"))] });
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
  const items = r.ok ? r.data.items : [];
  if (!items.length) { box.appendChild(h("div", { class: "empty-card card" }, h("div", { class: "big" }, "🎵"), h("div", { class: "muted" }, "أضيفا أول أغنية لكما."))); return; }
  items.forEach((s) => {
    const p = PEOPLE[s.added_by] || PEOPLE.him;
    const inner = h("div", { class: "song-item card" }, h("span", { class: "cassette" }, "🎵"),
      h("div", { class: "meta" }, h("b", {}, s.title), h("span", { class: "muted" }, (s.artist || "") + " · " + p.name)),
      h("button", { class: "goal-x", onclick: async (e) => { e.stopPropagation(); e.preventDefault(); if (await confirmAsk("حذف الأغنية؟", { okText: "حذف", danger: true })) { await api.delSong(s.id); songsSection(pane); } } }, "✕"));
    box.appendChild(s.url ? h("a", { href: s.url, target: "_blank", rel: "noreferrer", style: { textDecoration: "none" } }, inner) : inner);
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
  if (!r.ok) { c.appendChild(h("div", { class: "empty" }, "تعذّر التحميل")); return; }
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
  c.appendChild(adder(__g("أنا ممتنّ لـ…", "أنا ممتنّة لـ…"), async (text) => { const r = await api.addGratitude(text); if (r.ok) { sound.post(); toast("تُقبل شكركما 🤍"); gratitudeSection(pane); } }));
  const box = h("div", { style: { marginTop: "12px" } }); c.appendChild(box);
  const rt = await api.ritualsToday();
  const g = (rt.ok && rt.data.gratitude) || { mine: [], theirs: [] };
  const render = (arr, who) => (arr || []).forEach((t) => { const p = PEOPLE[who]; box.appendChild(h("div", { class: "grat-item card" }, h("span", { class: `avatar sm ${p.cls}` }, p.initial), h("div", {}, typeof t === "string" ? t : t.text))); });
  render(g.mine, store.person); render(g.theirs, other(store.person));
  if (!(g.mine || []).length && !(g.theirs || []).length) box.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "10px" } }, "لا امتنان اليوم بعد."));
}

/* ---------------- settings ---------------- */
function settingsSection(pane) {
  const c = clear(pane);
  // theme
  c.appendChild(settingCard("المظهر 🎨", [
    h("div", { class: "seg" }, ...[["system", "تلقائي"], ["light", "نهار"], ["dark", "ليل"]].map(([v, l]) =>
      h("button", { class: "seg-b" + (store.theme === v ? " on" : ""), onclick: (e) => { store.theme = v; applyTheme(); c.querySelectorAll(".theme-seg .seg-b").forEach((x) => x.classList.remove("on")); e.currentTarget.classList.add("on"); } }, l))),
  ], "theme-seg"));
  // accent
  const dots = h("div", { class: "accent-row" }, ...Object.entries(ACCENT_PRESETS).map(([key, p]) =>
    h("button", { class: "accent-dot" + (store.accent === key ? " on" : ""), style: { background: p.dot }, title: p.name, onclick: (e) => { store.accent = key; applyAccent(); dots.querySelectorAll(".accent-dot").forEach((x) => x.classList.remove("on")); e.currentTarget.classList.add("on"); } })));
  c.appendChild(settingCard("لون البشرة 🌸", [dots]));
  // sound
  c.appendChild(settingCard("الصوت 🔊", [toggle(store.soundOn, (on) => { store.soundOn = on; if (on) sound.tab(); })]));
  // notifications
  c.appendChild(settingCard("التنبيهات 🔔", [
    h("div", { class: "muted", style: { fontSize: "13px", marginBottom: "10px" } }, "لتصلكما همسات بعضكما حتى والتطبيق مغلق."),
    h("button", { class: "btn soft sm", onclick: enableNotifications }, store.pushOn ? "التنبيهات مفعّلة ✓ — إرسال تجربة" : "تفعيل التنبيهات")]));
  // app lock
  const lockOn = localStorage.getItem("yn_applock") === "on";
  c.appendChild(settingCard("قفل التطبيق 🔒", [
    h("div", { class: "muted", style: { fontSize: "13px", marginBottom: "10px" } }, "رمزٌ إضافي يُطلب عند فتح التطبيق على هذا الجهاز."),
    toggle(lockOn, async (on) => {
      if (on) { const pin = await promptPin("اختر رمزًا من ٤ أرقام"); if (!pin) { settingsSection(pane); return; } localStorage.setItem("yn_applock", "on"); localStorage.setItem("yn_applock_pin", pin); toast("فُعّل القفل 🔒"); }
      else { localStorage.removeItem("yn_applock"); localStorage.removeItem("yn_applock_pin"); toast("أُلغي القفل"); }
    })]));
  // about + logout
  c.appendChild(settingCard("نحن 🤍", [
    h("div", { class: "muted", style: { fontSize: "14px", lineHeight: "1.9" } }, "بدأنا في " + (store.config.anniversary_date ? fullDate(store.config.anniversary_date) : "—")),
    h("button", { class: "btn ghost sm", style: { marginTop: "12px" }, onclick: async () => { if (await confirmAsk("تسجيل الخروج من هذا الجهاز؟", { okText: "خروج" })) { store.clearAuth(); go("lock"); location.reload(); } } }, "تسجيل الخروج")]));
}
function settingCard(title, body, cls = "") { return h("div", { class: "card set-card " + cls }, h("div", { class: "t-h2", style: { marginBottom: "12px" } }, title), ...body); }
function toggle(on, onchange) {
  const t = h("button", { class: "toggle" + (on ? " on" : ""), onclick: () => { const nv = !t.classList.contains("on"); t.classList.toggle("on", nv); onchange(nv); } }, h("span", { class: "knob" }));
  return t;
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
async function enableNotifications() {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) { toast("جهازك لا يدعم التنبيهات"); return; }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("لم تُمنح الأذونات"); return; }
    const reg = await navigator.serviceWorker.ready;
    const vr = await api.getVapid();
    if (!vr.ok || !vr.data.publicKey) { toast("تعذّر الإعداد"); return; }
    let subx = await reg.pushManager.getSubscription();
    if (!subx) subx = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToU8(vr.data.publicKey) });
    const r = await api.subscribePush(subx.toJSON(), navigator.userAgent);
    if (r.ok) { store.pushOn = true; toast("فُعّلت التنبيهات 🔔"); await api.testPush(); } else toast("تعذّر التفعيل");
  } catch { toast("تعذّر تفعيل التنبيهات"); }
}
function urlB64ToU8(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64); const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/* ---------------- shared adder ---------------- */
function adder(placeholder, onAdd) {
  const inp = h("input", { class: "field", placeholder });
  const submit = async () => { const t = inp.value.trim(); if (!t) return; inp.value = ""; await onAdd(t); };
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  return h("div", { class: "adder" }, inp, h("button", { class: "btn sm", onclick: submit }, "＋"));
}
