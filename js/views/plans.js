// يومياتنا — مشروعنا: what the two of them are actually building.
//
// أحلامنا was a wish list, and a wish list is where things go to wait. A
// project here has a shape: a date, sometimes an amount, and steps that belong
// to one of them by name. It shows one honest number — how far along it is —
// counted from the steps that are done and the money that is set aside.
import { api } from "../api.js";
import { store } from "../store.js";
import { h, clear, arNum, toast, fullDate } from "../ui.js";
import { PEOPLE, other } from "../config.js";
import { openSheet, confirmAsk, errorState, commit } from "../helpers.js";
import { icon } from "../icons.js";
import { haptic } from "../haptics.js";
import { sound } from "../sound.js";
import { rt } from "../realtime.js";

const KINDS = [["home", "🏠", "بيتنا"], ["trip", "✈️", "رحلتنا"], ["saving", "🪙", "ادّخارنا"], ["wedding", "💍", "عرسنا"], ["goal", "🎯", "هدفنا"]];
const kindOf = (k) => KINDS.find((x) => x[0] === k) || KINDS[4];
const riyal = (n) => Number(n || 0).toLocaleString("ar-u-nu-arab", { maximumFractionDigits: 0 });
const daysTo = (d) => Math.ceil((Date.parse(d + "T00:00:00+03:00") - Date.now()) / 86400000);

export async function plansSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "18px" } }, "…"));
  const r = await api.projects();
  clear(c);
  if (!r.ok) { c.appendChild(errorState(() => plansSection(pane), { offline: r.offline })); return; }
  const items = r.data.items || [];
  const reload = () => plansSection(pane);

  c.appendChild(h("button", { class: "btn hero-go", style: { marginBottom: "14px" }, onclick: () => addProject(reload) },
    "＋ " + __g("ابدأ مشروعًا", "ابدئي مشروعًا")));

  if (!items.length) {
    c.appendChild(h("div", { class: "empty-card card" }, h("div", { class: "big" }, "🏗️"),
      h("div", { class: "muted" }, "بيتٌ، رحلةٌ، مبلغٌ تدّخرانه، أو عرسٌ تخططان له — ضعاه هنا وقسّماه خطوات.")));
    return;
  }
  const open = items.filter((p) => !p.done_at), done = items.filter((p) => p.done_at);
  for (const p of open) c.appendChild(projectCard(p, reload));
  if (done.length) {
    c.appendChild(h("div", { class: "rest-head" }, h("span", {}, "اكتمل (" + arNum(done.length) + ")")));
    for (const p of done) c.appendChild(projectCard(p, reload));
  }
}

function projectCard(p, reload) {
  const [, emoji, label] = kindOf(p.kind);
  const pct = p.progress == null ? null : Math.round(p.progress * 100);
  const card = h("section", { class: "tcard glass project" + (p.done_at ? " is-done" : ""), "aria-label": p.title });
  card.appendChild(h("div", { class: "pj-head" },
    h("span", { class: "pj-ic", "aria-hidden": "true" }, emoji),
    h("div", { class: "pj-t" }, h("b", {}, p.title), h("span", {}, label + (p.target_date ? " · " + dueText(p.target_date) : ""))),
    h("button", { class: "th-btn", "aria-label": "خيارات المشروع", onclick: () => projectMenu(p, reload) }, icon("gear", { size: 17 }))));
  if (p.note) card.appendChild(h("p", { class: "pj-note" }, p.note));

  if (pct != null) {
    card.appendChild(h("div", { class: "pj-bar", role: "img", "aria-label": "اكتمل " + arNum(pct) + "٪" },
      h("i", { style: { width: Math.max(2, pct) + "%" } })));
    card.appendChild(h("div", { class: "pj-pct" }, arNum(pct) + "٪"));
  }
  if (p.target_amount) {
    const saved = Number(p.saved_amount) || 0;
    card.appendChild(h("div", { class: "pj-money" },
      h("b", {}, riyal(saved)), h("span", {}, " من " + riyal(p.target_amount) + " ر.س"),
      h("button", { class: "btn soft sm", style: { marginInlineStart: "auto", width: "auto" }, onclick: () => addMoney(p, reload) }, "＋ أضفنا مبلغًا")));
  }

  const steps = p.steps || [];
  const list = h("div", { class: "pj-steps" });
  for (const s of steps) {
    const box = h("button", { class: "pj-step" + (s.done_at ? " on" : ""), onclick: async () => {
      haptic.pick();
      box.classList.toggle("on");
      const ok = await commit(() => api.stepToggle(s.id), () => box.classList.toggle("on"), "تعذّر الحفظ");
      if (ok) { sound.toggle(); reload(); }
    } },
      h("span", { class: "pj-box", "aria-hidden": "true" }, s.done_at ? "✓" : ""),
      h("span", { class: "pj-step-t" }, s.title),
      s.assignee ? h("span", { class: "pj-who" }, PEOPLE[s.assignee].name) : null);
    list.appendChild(box);
  }
  card.appendChild(list);
  card.appendChild(h("button", { class: "btn ghost sm", style: { width: "auto" }, onclick: () => addStep(p, reload) }, "＋ خطوة"));
  return card;
}

function dueText(d) {
  const n = daysTo(d);
  if (n === 0) return "اليوم";
  if (n > 0) return "بعد " + arNum(n) + (n >= 3 && n <= 10 ? " أيام" : " يوم");
  return "فات موعده بـ " + arNum(-n) + " يوم";
}

function addProject(reload) {
  let kind = "home";
  const title = h("input", { class: "field", placeholder: "ما هو؟ (بيتنا، رحلة الصيف…)", maxLength: 120 });
  const note = h("textarea", { class: "field", rows: 2, placeholder: "تفصيل صغير (اختياري)", maxLength: 600 });
  const date = h("input", { class: "field", type: "date", "aria-label": "الموعد المستهدف" });
  const amount = h("input", { class: "field", type: "number", inputMode: "numeric", min: "0", placeholder: "المبلغ المطلوب (اختياري)", "aria-label": "المبلغ المطلوب" });
  const chips = h("div", { class: "kind-chips" }, ...KINDS.map(([k, emo, lbl]) => {
    const b = h("button", { class: "kind-chip" + (k === kind ? " on" : ""), onclick: () => {
      kind = k; chips.querySelectorAll(".kind-chip").forEach((x) => x.classList.remove("on")); b.classList.add("on");
    } }, emo + " " + lbl);
    return b;
  }));
  const { close } = openSheet({
    title: "مشروعٌ لنا",
    subtitle: "ما تبنيانه معًا — بخطواته",
    body: [chips, title, note, date, amount,
      h("button", { class: "btn hero-go", onclick: async () => {
        const t = title.value.trim();
        if (!t) { title.focus(); return; }
        const r = await api.projectAdd({ kind, title: t, note: note.value.trim() || null,
          target_date: date.value || null, target_amount: amount.value ? Number(amount.value) : null }, rt.partnerHere);
        if (!r.ok) { toast(r.offline ? "لا اتصال — لم يُحفظ" : "تعذّر الحفظ"); return; }
        sound.post(); haptic.success(); close(true); reload();
      } }, "ابدآه")],
  });
}

function addStep(p, reload) {
  const me = store.person;
  let assignee = null;
  const title = h("input", { class: "field", placeholder: "خطوة واحدة…", maxLength: 140 });
  const who = h("div", { class: "kind-chips" },
    ...[[null, "لكلينا"], [me, PEOPLE[me].name], [other(me), PEOPLE[other(me)].name]].map(([k, lbl]) => {
      const b = h("button", { class: "kind-chip" + (k === assignee ? " on" : ""), onclick: () => {
        assignee = k; who.querySelectorAll(".kind-chip").forEach((x) => x.classList.remove("on")); b.classList.add("on");
      } }, lbl);
      return b;
    }));
  const { close } = openSheet({
    title: "خطوة في «" + p.title + "»",
    body: [title, who, h("button", { class: "btn hero-go", onclick: async () => {
      const t = title.value.trim();
      if (!t) { title.focus(); return; }
      const r = await api.stepAdd(p.id, t, assignee, (p.steps || []).length);
      if (!r.ok) { toast("تعذّر الحفظ"); return; }
      sound.post(); haptic.success(); close(true); reload();
    } }, "أضِفها")],
  });
}

function addMoney(p, reload) {
  const amount = h("input", { class: "field", type: "number", inputMode: "numeric", min: "0", placeholder: "كم أضفتما؟", "aria-label": "المبلغ المضاف" });
  const { close } = openSheet({
    title: "ادّخرنا لـ«" + p.title + "»",
    subtitle: "المجموع الآن " + riyal(p.saved_amount) + " من " + riyal(p.target_amount),
    body: [amount, h("button", { class: "btn hero-go", onclick: async () => {
      const add = Number(amount.value);
      if (!(add > 0)) { amount.focus(); return; }
      const r = await api.projectEdit(p.id, { saved_amount: Number(p.saved_amount || 0) + add });
      if (!r.ok) { toast("تعذّر الحفظ"); return; }
      sound.post(); haptic.success(); close(true); reload();
    } }, "أضِفه")],
  });
}

function projectMenu(p, reload) {
  const { close } = openSheet({
    title: p.title,
    body: [h("div", { class: "menu-list" },
      h("button", { class: "btn soft", onclick: async () => {
        const r = await api.projectEdit(p.id, { done: !p.done_at });
        if (r.ok) { sound.celebrate(); haptic.success(); close(true); reload(); } else toast("تعذّر الحفظ");
      } }, p.done_at ? "أعيداه إلى الجاري" : "✓ اكتمل"),
      h("button", { class: "btn danger", onclick: async () => {
        close(true);
        if (!(await confirmAsk("نحذف «" + p.title + "» وكل خطواته؟", { okText: "احذفاه", danger: true }))) return;
        const r = await api.projectDel(p.id);
        if (r.ok) { toast("حُذف"); reload(); } else toast("تعذّر الحذف");
      } }, "احذفاه"))],
  });
}
