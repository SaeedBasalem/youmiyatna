// يومياتنا — التقويم: shared month calendar + events with reminders.
import { h, clear, arNum, toast } from "./ui.js";
import { api } from "./api.js";
import { sound } from "./sound.js";
import { realtime } from "./realtime.js";
import { PEOPLE } from "./config.js";

let curYear = null, curMonth = null, allEvents = [];
const todayStr = () => new Date(Date.now() + 180 * 60000).toISOString().slice(0, 10);

export async function viewPlan(content) {
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "التقويم")));
  const wrap = h("div", { class: "plan" }, h("div", { class: "empty", style: { padding: "16px" } }, "…"));
  content.appendChild(wrap);
  if (curYear == null) { const now = new Date(Date.now() + 180 * 60000); curYear = now.getUTCFullYear(); curMonth = now.getUTCMonth(); }
  const r = await api.listEvents();
  allEvents = r.ok ? r.data.items : [];
  clear(wrap);
  wrap.appendChild(calendar(content));
  wrap.appendChild(upcoming(content));
  wrap.appendChild(h("button", { class: "btn coral", style: { marginTop: "14px" }, onclick: () => eventModal(content, todayStr()) }, "＋ موعد جديد"));
}

function calendar(content) {
  const box = h("div", { class: "panel cal" });
  const monthName = new Date(Date.UTC(curYear, curMonth, 1)).toLocaleDateString("ar", { month: "long", year: "numeric" });
  box.appendChild(h("div", { class: "cal-head" },
    h("button", { class: "icon-btn", onclick: () => { curMonth--; if (curMonth < 0) { curMonth = 11; curYear--; } viewPlan(clear(content)); } }, "‹"),
    h("b", {}, monthName),
    h("button", { class: "icon-btn", onclick: () => { curMonth++; if (curMonth > 11) { curMonth = 0; curYear++; } viewPlan(clear(content)); } }, "›")));
  const wk = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
  const wkrow = h("div", { class: "cal-grid cal-wk" }); wk.forEach((w) => wkrow.appendChild(h("div", { class: "cal-wd" }, w))); box.appendChild(wkrow);
  const grid = h("div", { class: "cal-grid" });
  const first = new Date(Date.UTC(curYear, curMonth, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(curYear, curMonth + 1, 0)).getUTCDate();
  const map = {}; for (const e of allEvents) (map[e.date] ||= []).push(e);
  const t = todayStr();
  for (let i = 0; i < first; i++) grid.appendChild(h("div", { class: "cal-cell empty-cell" }));
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${curYear}-${String(curMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const evs = map[ds] || [];
    const cell = h("div", { class: "cal-cell" + (ds === t ? " today" : "") + (evs.length ? " has" : ""), onclick: () => dayModal(content, ds, evs) }, h("span", { class: "cal-num" }, arNum(d)));
    if (evs.length) cell.appendChild(h("span", { class: "cal-dot" }, evs.length > 1 ? arNum(evs.length) : ""));
    grid.appendChild(cell);
  }
  box.appendChild(grid);
  return box;
}

function upcoming(content) {
  const box = h("div", {});
  box.appendChild(h("div", { class: "t-h2", style: { margin: "16px 2px 8px" } }, "المواعيد القادمة"));
  const up = allEvents.filter((e) => e.date >= todayStr()).slice(0, 20);
  if (!up.length) box.appendChild(h("div", { class: "muted", style: { padding: "8px" } }, "لا مواعيد قادمة — أضيفا موعدًا 💞"));
  up.forEach((e) => {
    const dt = new Date(e.date + "T00:00:00Z");
    box.appendChild(h("div", { class: "ev-item " + (e.created_by || "") },
      h("div", { class: "ev-date" }, h("b", {}, arNum(dt.getUTCDate())), h("span", {}, dt.toLocaleDateString("ar", { month: "short" }))),
      h("div", { class: "ev-body" }, h("b", {}, e.title), h("span", { class: "muted" }, (e.time ? e.time + " · " : "") + (e.note || ""))),
      h("button", { class: "cd-del", onclick: async () => { await api.delEvent(e.id); realtime.broadcast("event"); viewPlan(clear(content)); } }, "✕")));
  });
  return box;
}

function dayModal(content, ds, evs) {
  const dt = new Date(ds + "T00:00:00Z");
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" },
    h("h3", {}, dt.toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long" })),
    ...(evs.length ? evs.map((e) => h("div", { class: "ev-item " + (e.created_by || "") }, h("div", { class: "ev-body" }, h("b", {}, e.title), h("span", { class: "muted" }, (e.time ? e.time + " · " : "") + (e.note || ""))), h("button", { class: "cd-del", onclick: async () => { await api.delEvent(e.id); realtime.broadcast("event"); sc.remove(); viewPlan(clear(content)); } }, "✕"))) : [h("div", { class: "muted" }, "لا مواعيد في هذا اليوم.")]),
    h("div", { class: "attach-rail", style: { marginTop: "14px" } },
      h("button", { class: "btn ghost", onclick: () => sc.remove() }, "إغلاق"),
      h("button", { class: "btn sun", onclick: () => { sc.remove(); eventModal(content, ds); } }, "＋ أضيفا موعدًا"))));
  document.body.appendChild(sc);
}

function eventModal(content, defaultDate) {
  const title = h("input", { class: "field", placeholder: "مثلاً: عشاء بمناسبة شهرنا" });
  const date = h("input", { class: "field", type: "date", value: defaultDate || todayStr() });
  const time = h("input", { class: "field", type: "time" });
  const note = h("input", { class: "field", placeholder: "ملاحظة (اختياري)" });
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" },
    h("h3", {}, "موعد جديد 📅"),
    h("label", { class: "lbl" }, "العنوان"), title,
    h("label", { class: "lbl" }, "التاريخ"), date,
    h("label", { class: "lbl" }, "الوقت"), time,
    h("label", { class: "lbl" }, "ملاحظة"), note,
    h("div", { class: "attach-rail", style: { marginTop: "14px" } },
      h("button", { class: "btn ghost", onclick: () => sc.remove() }, "إلغاء"),
      h("button", { class: "btn coral", onclick: async () => {
        const t = title.value.trim(), dt = date.value; if (!t) { title.focus(); return; } if (!dt) { date.focus(); return; }
        const r = await api.addEvent({ title: t, date: dt, time: time.value || null, note: note.value.trim() || null });
        if (r.ok) { sc.remove(); sound.post(); realtime.broadcast("event"); viewPlan(clear(content)); toast("أُضيف الموعد 📅"); } else toast("تعذّر");
      } }, "أضيفا"))));
  document.body.appendChild(sc);
}
