// يومياتنا — رسالة الشهر: the letter their own month writes.
//
// Not a summary and not a chart: a short letter in their own numbers and their
// own words. Everything in it is true and comes from what the two of them did —
// the day they were most alive, the moment they both reacted to, the thanks
// they wrote before sleeping. The server composes the facts (journal7
// month_letter) and this turns them into sentences.
import { api } from "../api.js";
import { store } from "../store.js";
import { h, clear, arNum, fullDate, toast } from "../ui.js";
import { PEOPLE, other } from "../config.js";
import { errorState, go } from "../helpers.js";
import { icon } from "../icons.js";

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const TZ = 180 * 60000;
const thisPeriod = () => new Date(Date.now() + TZ).toISOString().slice(0, 7);
const periodName = (p) => MONTHS_AR[Number(p.slice(5, 7)) - 1] + " " + arNum(p.slice(0, 4));
const shift = (p, n) => {
  const y = Number(p.slice(0, 4)), m = Number(p.slice(5, 7)) - 1 + n;
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 7);
};

export async function letterSection(pane, period = thisPeriod()) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "18px" } }, "…"));
  const r = await api.monthLetter(period);
  clear(c);
  if (!r.ok) { c.appendChild(errorState(() => letterSection(pane, period), { offline: r.offline })); return; }
  const L = r.data.letter || {};
  const st = L.stats || {};
  const me = store.person, partner = other(me);

  // which month
  const nav = h("div", { class: "lt-nav" },
    h("button", { class: "th-btn", "aria-label": "الشهر السابق", onclick: () => letterSection(pane, shift(period, -1)) }, icon("fwd", { size: 18 })),
    h("b", {}, periodName(period)),
    period < thisPeriod()
      ? h("button", { class: "th-btn", "aria-label": "الشهر التالي", onclick: () => letterSection(pane, shift(period, 1)) }, icon("back", { size: 18 }))
      : h("span", { style: { width: "38px" } }));
  c.appendChild(nav);

  const lived = st.days_touched || 0;
  if (!lived) {
    c.appendChild(h("div", { class: "empty-card card" }, h("div", { class: "big" }, "✉️"),
      h("div", { class: "muted" }, "لا شيء في " + periodName(period) + " بعد — كل ما تكتبانه هذا الشهر يصير رسالته.")));
    return;
  }

  const letter = h("section", { class: "tcard glass letter-card", "aria-label": "رسالة " + periodName(period) });
  letter.appendChild(h("div", { class: "hero-k" }, "رسالة " + periodName(period)));
  letter.appendChild(h("p", { class: "lt-line" }, "في هذا الشهر كان لكما " + arNum(lived) + " يومًا فيه شيءٌ منكما."));

  const bits = [];
  if (st.moments) bits.push("كتبتما " + arNum(st.moments) + (st.moments === 1 ? " ذكرى" : " ذكرى"));
  if (st.whispers) bits.push("تبادلتما " + arNum(st.whispers) + " همسة");
  if (st.photo_days) bits.push("صوّرتما لحظتكما في " + arNum(st.photo_days) + (st.photo_days >= 3 && st.photo_days <= 10 ? " أيام" : " يوم"));
  if (st.answers) bits.push("أجبتما عن " + arNum(st.answers) + " سؤال");
  if (st.games) bits.push("لعبتما " + arNum(st.games) + " جولة");
  if (st.dhikr) bits.push("غرستما " + arNum(st.dhikr) + " نخلة بالتسبيح");
  if (st.winddowns) bits.push("أغلقتما اليوم " + arNum(st.winddowns) + " مرة قبل النوم");
  if (bits.length) letter.appendChild(h("p", { class: "lt-line" }, bits.join("، ") + "."));

  if (L.best_day) {
    letter.appendChild(h("p", { class: "lt-line" }, "أكثر يومٍ كنتما فيه حاضرين: " + fullDate(L.best_day.day) + "."));
  }
  if (L.loved && L.loved.body) {
    letter.appendChild(h("blockquote", { class: "lt-quote" }, "“" + L.loved.body + "”",
      h("cite", {}, (PEOPLE[L.loved.author] || {}).name || "")));
  }
  const gr = (L.gratitudes || []).filter(Boolean);
  if (gr.length) {
    letter.appendChild(h("p", { class: "lt-line" }, "ومما شكرتما الله عليه:"));
    letter.appendChild(h("ul", { class: "lt-list" }, ...gr.map((g) => h("li", {}, g))));
  }
  letter.appendChild(h("p", { class: "lt-dua" }, "اللهم بارك لهما في شهرٍ قادم، واجعل ما بينهما أقرب مما كان 🤍"));
  c.appendChild(letter);

  const grid = h("div", { class: "lt-stats" },
    ...[["ذكرى", st.moments || 0], ["همسة", st.whispers || 0], ["لحظة مصوّرة", st.photo_days || 0], ["تسبيحة", st.dhikr || 0]]
      .map(([lbl, n]) => h("div", { class: "lt-stat" }, h("b", {}, arNum(n)), h("span", {}, lbl))));
  c.appendChild(grid);
  c.appendChild(h("button", { class: "btn ghost sm", style: { width: "auto" }, onclick: () => go("wrapped") }, "وحصاد السنة كاملًا"));
}
