// يومياتنا — مهامّنا: the shared planner. Errands and to-dos the two of them
// hand to each other, with a due date that turns into a real reminder through
// the hourly scheduler. Every write is optimistic and rolls back honestly.
import { h, clear, toast, arNum, sparkleAt } from "../ui.js";
import { api } from "../api.js";
import { store } from "../store.js";
import { PEOPLE, other } from "../config.js";
import { commit, errorState, openSheet, confirmAsk } from "../helpers.js";
import { sound } from "../sound.js";
import { haptic } from "../haptics.js";

let tasks = [];
const todayStr = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);

function dueLabel(d) {
  if (!d) return null;
  const today = todayStr();
  if (d < today) return { text: "فات موعدها", tone: "late" };
  if (d === today) return { text: "اليوم", tone: "today" };
  const days = Math.round((new Date(d) - new Date(today)) / 86400000);
  if (days === 1) return { text: "غدًا", tone: "soon" };
  if (days <= 7) return { text: `بعد ${arNum(days)} أيام`, tone: "soon" };
  try { return { text: new Date(d).toLocaleDateString("ar", { day: "numeric", month: "long" }), tone: "far" }; }
  catch { return { text: d, tone: "far" }; }
}
const forWhom = (a) => (a === "both" ? "لكليكما" : "لـ" + PEOPLE[a].name);

export async function planSection(pane) {
  const c = clear(pane);
  const list = h("div", { class: "task-list" }, h("div", { class: "muted", style: { textAlign: "center", padding: "26px" } }, "…"));

  const input = h("input", { class: "field", placeholder: "ما الذي نحتاج فعله؟", maxLength: 200 });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") addFromBar(); });
  const addBtn = h("button", { class: "btn sm", onclick: () => addFromBar() }, "أضف");
  c.appendChild(h("div", { class: "task-new" }, input, addBtn,
    h("button", { class: "btn ghost sm", "aria-label": "بتفاصيل", onclick: () => openTaskSheet(input.value.trim()) }, "⋯")));
  c.appendChild(list);

  function paint() {
    clear(list);
    const open = tasks.filter((t) => !t.done);
    const done = tasks.filter((t) => t.done);
    if (!tasks.length) {
      list.appendChild(h("div", { class: "empty" }, h("div", { class: "big" }, "📋"),
        h("div", {}, "لا مهامّ بعد — أضيفا أول شيء تريدان إنجازه معًا")));
      return;
    }
    if (open.length) list.appendChild(h("div", { class: "task-group" }, `ما زال أمامكما · ${arNum(open.length)}`));
    open.forEach((t) => list.appendChild(row(t)));
    if (done.length) {
      list.appendChild(h("div", { class: "task-group" }, `أُنجزت · ${arNum(done.length)}`));
      done.slice(0, 12).forEach((t) => list.appendChild(row(t)));
    }
  }

  function row(t) {
    const due = dueLabel(t.due_date);
    const box = h("button", { class: "task-box" + (t.done ? " on" : ""), "aria-label": t.done ? "أعدها" : "أنجزها" }, t.done ? "✓" : "");
    const el = h("div", { class: "task-row" + (t.done ? " done" : "") + (due && !t.done ? " " + due.tone : "") },
      box,
      h("div", { class: "task-body" },
        h("b", {}, t.title),
        h("div", { class: "task-meta" },
          h("span", { class: "task-who " + t.assignee }, forWhom(t.assignee)),
          due && !t.done ? h("span", { class: "task-due " + due.tone }, due.text) : null,
          t.done && t.done_by ? h("span", { class: "muted" }, "أنجزها " + PEOPLE[t.done_by].name) : null),
        t.note ? h("div", { class: "task-note muted" }, t.note) : null),
      h("button", { class: "task-x", "aria-label": "حذف", onclick: async (ev) => {
        ev.stopPropagation();
        if (!(await confirmAsk("نحذف «" + t.title + "»؟", { okText: "احذف", danger: true }))) return;
        const idx = tasks.indexOf(t);
        tasks = tasks.filter((x) => x !== t); paint();
        await commit(() => api.delTask(t.id), () => { tasks.splice(idx, 0, t); paint(); }, "تعذّر الحذف");
      } }, "×"));

    box.onclick = async () => {
      const was = t.done;
      t.done = !was;
      t.done_by = t.done ? store.person : null;
      if (t.done) { sound.post(); haptic.success(); const r = box.getBoundingClientRect(); sparkleAt(r.x + r.width / 2, r.y, ["✅", "✨", "🎉"]); }
      else haptic.tap();
      paint();
      await commit(() => api.toggleTask(t.id), () => { t.done = was; t.done_by = was ? t.done_by : null; paint(); }, "تعذّر الحفظ");
    };
    return el;
  }

  async function create(payload) {
    const temp = { id: "tmp" + Date.now(), ...payload, done: false, created_by: store.person, created_at: new Date().toISOString(), _pending: true };
    tasks.unshift(temp); paint(); sound.post(); haptic.tap();
    const r = await api.addTask(payload);
    if (r.ok && r.data.task) {
      const i = tasks.indexOf(temp);
      if (i >= 0) tasks[i] = r.data.task;
      paint();
    } else {
      tasks = tasks.filter((x) => x !== temp); paint();
      toast(r.offline ? "لا اتصال — لم تُضف" : "تعذّرت الإضافة");
    }
  }
  function addFromBar() {
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    input.value = "";
    create({ title, assignee: "both", due_date: null });
  }

  function openTaskSheet(prefill) {
    const ti = h("input", { class: "field", placeholder: "المهمة", value: prefill || "", maxLength: 200 });
    const no = h("input", { class: "field", placeholder: "تفصيل صغير (اختياري)", maxLength: 500 });
    const da = h("input", { class: "field", type: "date" });
    let who = "both";
    const whoRow = h("div", { class: "seg" }, ...[["both", "لكلينا"], ["him", PEOPLE.him.name], ["her", PEOPLE.her.name]]
      .map(([k, label]) => {
        const b = h("button", { class: "seg-b" + (k === "both" ? " on" : ""), onclick: () => {
          who = k; [...whoRow.children].forEach((x) => x.classList.toggle("on", x === b)); haptic.tap();
        } }, label);
        return b;
      }));
    const { close } = openSheet({
      title: "مهمة جديدة 📋",
      subtitle: "من يفعلها، ومتى",
      body: [ti, whoRow, h("label", { class: "acct-hint" }, "موعدها (يصلكما تذكير في يومها)"), da, no,
        h("button", { class: "btn", style: { marginTop: "12px", width: "100%" }, onclick: () => {
          const title = ti.value.trim();
          if (!title) { ti.focus(); return; }
          close();
          create({ title, assignee: who, due_date: da.value || null, note: no.value.trim() || null });
        } }, "أضيفاها")],
    });
    setTimeout(() => ti.focus(), 240);
  }

  const r = await api.listTasks();
  if (!r.ok) { clear(list).appendChild(errorState(() => planSection(pane), { offline: r.offline })); return; }
  tasks = r.data.items || [];
  paint();
}
