// يومياتنا — طقوسنا: daily question, mood check-in + calendar, gratitude, countdowns.
import { h, clear, personChip, arNum, toast, fullDate } from "./ui.js";
import { api } from "./api.js";
import { store } from "./store.js";
import { sound } from "./sound.js";
import { MOODS, moodEmoji, PEOPLE, other } from "./config.js";

const reload = (content) => viewRituals(clear(content));

export async function viewRituals(content) {
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "طقوسنا")));
  const wrap = h("div", { class: "rituals" }, h("div", { class: "empty", style: { padding: "20px" } }, "…"));
  content.appendChild(wrap);
  const r = await api.ritualsToday();
  if (!r.ok) { clear(wrap).appendChild(h("div", { class: "empty" }, "تعذّر التحميل")); return; }
  const d = r.data; clear(wrap);
  wrap.appendChild(promptCard(d, content));
  wrap.appendChild(await moodCard(d, content));
  wrap.appendChild(gratitudeCard(d, content));
  wrap.appendChild(countdownCard(d, content));
}

function promptCard(d, content) {
  const card = h("div", { class: "panel ritual-card" }, h("div", { class: "rc-head" }, h("span", { class: "rc-emoji" }, "🌟"), h("b", {}, "سؤال اليوم")));
  card.appendChild(h("div", { class: "rc-q" }, d.question));
  if (d.prompt.revealed) {
    card.appendChild(h("div", { class: "ans" }, personChip(store.person), h("div", { class: "ans-t" }, d.prompt.mine)));
    card.appendChild(h("div", { class: "ans" }, personChip(other(store.person)), h("div", { class: "ans-t" }, d.prompt.theirs)));
  } else if (d.prompt.mine != null) {
    card.appendChild(h("div", { class: "ans" }, personChip(store.person), h("div", { class: "ans-t" }, d.prompt.mine)));
    card.appendChild(h("div", { class: "muted", style: { marginTop: "8px" } }, d.prompt.theirs_answered ? "أجبتما — تنكشف الآن 🎉" : "أجبت ✓ — بانتظار " + PEOPLE[other(store.person)].name));
  } else {
    const ta = h("textarea", { class: "field", rows: 2, placeholder: "إجابتك… (تظهر بعد أن يجيب الطرفان)" });
    card.appendChild(ta);
    card.appendChild(h("button", { class: "btn sun sm", style: { marginTop: "8px" }, onclick: async () => { const v = ta.value.trim(); if (!v) return; await api.answerPrompt(v); sound.post(); reload(content); } }, "أجيبا"));
    if (d.prompt.theirs_answered) card.appendChild(h("div", { class: "muted", style: { marginTop: "6px" } }, PEOPLE[other(store.person)].name + " أجاب — أجيبا لتنكشف الإجابتان!"));
  }
  return card;
}

async function moodCard(d, content) {
  const card = h("div", { class: "panel ritual-card" }, h("div", { class: "rc-head" }, h("span", { class: "rc-emoji" }, "🌤️"), h("b", {}, "مزاجك اليوم")));
  const row = h("div", { class: "mood-row" });
  const mine = d.checkin.mine?.mood || "";
  MOODS.forEach(([label, emo]) => row.appendChild(h("button", { class: "mood-opt" + (mine === label ? " sel" : ""), onclick: async (e) => { row.querySelectorAll(".mood-opt").forEach((x) => x.classList.remove("sel")); e.currentTarget.classList.add("sel"); await api.setCheckin(label, d.checkin.mine?.note || null); sound.tab(); } }, emo + " " + label)));
  card.appendChild(row);
  if (d.checkin.theirs?.mood) card.appendChild(h("div", { class: "muted", style: { marginTop: "8px" } }, PEOPLE[other(store.person)].name + " اليوم: " + moodEmoji(d.checkin.theirs.mood) + " " + d.checkin.theirs.mood));
  const cal = await api.moodCalendar(21);
  if (cal.ok) card.appendChild(moodCalendar(cal.data.items));
  return card;
}
function moodCalendar(items) {
  const map = {}; for (const it of items) (map[it.day] ||= {})[it.author] = it.mood;
  const box = h("div", { class: "mood-cal" });
  for (let i = 20; i >= 0; i--) {
    const ds = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); const m = map[ds] || {};
    box.appendChild(h("div", { class: "mc-cell", title: ds }, h("span", { class: "mc-h" }, m.him ? moodEmoji(m.him) : "·"), h("span", { class: "mc-r" }, m.her ? moodEmoji(m.her) : "·")));
  }
  return h("div", {}, h("div", { class: "muted", style: { margin: "12px 0 4px", fontSize: "12px" } }, "آخر ٢١ يومًا · سعيد ↑ / ياسمين ↓"), box);
}

function gratitudeCard(d, content) {
  const card = h("div", { class: "panel ritual-card" }, h("div", { class: "rc-head" }, h("span", { class: "rc-emoji" }, "🤲"), h("b", {}, "امتنان اليوم")));
  const list = h("div", { class: "grat-list" });
  const all = [...d.gratitude.mine.map((x) => ({ ...x, who: store.person })), ...d.gratitude.theirs.map((x) => ({ ...x, who: other(store.person) }))];
  if (!all.length) list.appendChild(h("div", { class: "muted" }, "اكتبا شيئًا تشكران الله عليه اليوم 🤍"));
  all.forEach((g) => list.appendChild(h("div", { class: "grat-item " + g.who }, "🤍 " + g.text + " — " + PEOPLE[g.who].name)));
  card.appendChild(list);
  const inp = h("input", { class: "field", placeholder: "أنا ممتن لـ…" });
  const add = async () => { const v = inp.value.trim(); if (!v) return; inp.value = ""; await api.addGratitude(v); sound.post(); reload(content); };
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
  card.appendChild(h("div", { class: "row", style: { marginTop: "8px", gap: "8px" } }, inp, h("button", { class: "btn mint sm", onclick: add }, "أضيفا")));
  return card;
}

function daysUntil(dateStr) { const t = new Date(dateStr + "T00:00:00Z").getTime(); const today = new Date(new Date(Date.now() + 180 * 60000).toISOString().slice(0, 10) + "T00:00:00Z").getTime(); return Math.round((t - today) / 86400000); }
function countdownCard(d, content) {
  const card = h("div", { class: "panel ritual-card" }, h("div", { class: "rc-head" }, h("span", { class: "rc-emoji" }, "⏳"), h("b", {}, "العدّ التنازلي")));
  if (!d.countdowns.length) card.appendChild(h("div", { class: "muted" }, "أضيفا موعدًا تنتظرانه 💞"));
  d.countdowns.forEach((c) => {
    const days = daysUntil(c.target_date);
    card.appendChild(h("div", { class: "cd-item" }, h("span", { class: "cd-emoji" }, c.emoji || "🎉"),
      h("div", { class: "cd-body" }, h("b", {}, c.title), h("span", { class: "muted" }, fullDate(c.target_date))),
      h("span", { class: "cd-days" }, days > 0 ? "بعد " + arNum(days) + " يوم" : days === 0 ? "اليوم! 🎉" : "مضى"),
      h("button", { class: "cd-del", onclick: async () => { await api.delCountdown(c.id); reload(content); } }, "✕")));
  });
  card.appendChild(h("button", { class: "btn ghost sm", style: { marginTop: "10px" }, onclick: () => addCountdownModal(content) }, "＋ موعد جديد"));
  return card;
}
function addCountdownModal(content) {
  const title = h("input", { class: "field", placeholder: "مثلاً: لقاؤنا القادم" });
  const date = h("input", { class: "field", type: "date" });
  const emoji = h("input", { class: "field", placeholder: "رمز", value: "💞", maxLength: 4 });
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" },
    h("h3", {}, "موعد ننتظره ⏳"),
    h("label", { class: "lbl" }, "العنوان"), title,
    h("label", { class: "lbl" }, "التاريخ"), date,
    h("label", { class: "lbl" }, "رمز"), emoji,
    h("div", { class: "attach-rail", style: { marginTop: "14px" } },
      h("button", { class: "btn ghost", onclick: () => sc.remove() }, "إلغاء"),
      h("button", { class: "btn sun", onclick: async () => { const t = title.value.trim(), dt = date.value; if (!t) { title.focus(); return; } if (!dt) { date.focus(); return; } const r = await api.addCountdown(t, dt, emoji.value.trim() || "🎉"); if (r.ok) { sc.remove(); sound.post(); reload(content); } else toast("تعذّر"); } }, "أضيفا"))));
  document.body.appendChild(sc);
}
