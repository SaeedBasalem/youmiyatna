// يومياتنا — قوائمنا: collaborative live lists (bucket list, movies, places, gifts…).
import { h, clear, arNum, toast } from "./ui.js";
import { api } from "./api.js";
import { store } from "./store.js";
import { sound } from "./sound.js";
import { realtime } from "./realtime.js";
import { PEOPLE } from "./config.js";

const PRESETS = [
  { emoji: "🎬", title: "أفلام نشاهدها" }, { emoji: "📍", title: "أماكن نزورها" },
  { emoji: "✨", title: "قائمة الأمنيات" }, { emoji: "🎁", title: "أفكار هدايا" },
  { emoji: "🍽️", title: "مطاعم نجرّبها" }, { emoji: "📖", title: "كتب نقرأها" },
];
let lists = [];

export async function viewLists(content) {
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "قوائمنا")));
  content.appendChild(h("button", { class: "btn coral", style: { marginBottom: "14px" }, onclick: () => newListModal(content) }, "＋ قائمة جديدة"));
  const wrap = h("div", { class: "lists" }, h("div", { class: "empty", style: { padding: "16px" } }, "…"));
  content.appendChild(wrap);
  const r = await api.getLists();
  lists = r.ok ? r.data.lists : [];
  clear(wrap);
  if (!lists.length) { wrap.appendChild(h("div", { class: "empty" }, h("div", { class: "big" }, "📝"), h("div", {}, __g("لا قوائم بعد… أنشئ قائمة تجمعكما.","لا قوائم بعد… أنشئي قائمة تجمعكما.")))); return; }
  lists.forEach((l) => wrap.appendChild(listCard(l, content)));
}

function listCard(l, content) {
  const done = (l.items || []).filter((x) => x.done).length;
  return h("button", { class: "list-card", onclick: () => listDetail(content, l) },
    h("span", { class: "lc-emoji" }, l.emoji || "📝"),
    h("div", { class: "lc-info" }, h("b", {}, l.title), h("span", { class: "muted" }, arNum(done) + " / " + arNum((l.items || []).length))),
    h("span", { class: "lc-arrow" }, "‹"));
}

function listDetail(content, l) {
  const box = h("div", { class: "list-items" });
  function paint() {
    clear(box);
    if (!l.items.length) box.appendChild(h("div", { class: "muted" }, __g("أضِف أول عنصر 👇","أضيفي أول عنصر 👇")));
    l.items.forEach((it) => {
      const row = h("div", { class: "li-row" + (it.done ? " done" : "") },
        h("button", { class: "li-check", onclick: async () => { const r = await api.toggleItem(it.id); if (r.ok) { it.done = r.data.done; paint(); sound.tab(); realtime.broadcast("list"); } } }, it.done ? "✓" : ""),
        h("span", { class: "li-text" }, it.text),
        h("span", { class: "li-who" }, PEOPLE[it.added_by]?.initial || ""),
        h("button", { class: "li-del", onclick: async () => { await api.delItem(it.id); l.items = l.items.filter((x) => x.id !== it.id); paint(); realtime.broadcast("list"); } }, "✕"));
      box.appendChild(row);
    });
  }
  paint();
  const inp = h("input", { class: "field", placeholder: __g("أضِف عنصرًا…","أضيفي عنصرًا…") });
  const add = async () => { const v = inp.value.trim(); if (!v) return; inp.value = ""; const r = await api.addItem(l.id, v); if (r.ok) { l.items.push(r.data.item); paint(); sound.post(); realtime.broadcast("list"); } };
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" },
    h("h3", {}, (l.emoji || "📝") + " " + l.title),
    box,
    h("div", { class: "row", style: { marginTop: "10px", gap: "8px" } }, inp, h("button", { class: "btn mint sm", onclick: add }, __g("أضِف","أضيفي"))),
    h("div", { class: "attach-rail", style: { marginTop: "14px" } },
      h("button", { class: "btn ghost", onclick: () => sc.remove() }, "إغلاق"),
      h("button", { class: "btn sm", style: { background: "var(--paper)" }, onclick: async () => { if (!confirm("حذف القائمة كاملة؟")) return; await api.delList(l.id); realtime.broadcast("list"); sc.remove(); viewLists(clear(content)); } }, "حذف القائمة"))));
  document.body.appendChild(sc);
}

function newListModal(content) {
  const title = h("input", { class: "field", placeholder: "اسم القائمة" });
  const emoji = h("input", { class: "field", value: "📝", maxLength: 4, style: { maxWidth: "80px", textAlign: "center" } });
  const presetRow = h("div", { class: "mood-row" });
  PRESETS.forEach((p) => presetRow.appendChild(h("button", { class: "mood-opt", onclick: () => { title.value = p.title; emoji.value = p.emoji; } }, p.emoji + " " + p.title)));
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" },
    h("h3", {}, "قائمة جديدة 📝"),
    h("label", { class: "lbl" }, "اقتراحات"), presetRow,
    h("label", { class: "lbl" }, "الاسم"), h("div", { class: "row", style: { gap: "8px" } }, emoji, title),
    h("div", { class: "attach-rail", style: { marginTop: "14px" } },
      h("button", { class: "btn ghost", onclick: () => sc.remove() }, "إلغاء"),
      h("button", { class: "btn coral", onclick: async () => { const t = title.value.trim(); if (!t) { title.focus(); return; } const r = await api.addList(t, null, emoji.value.trim() || "📝"); if (r.ok) { sc.remove(); sound.post(); realtime.broadcast("list"); viewLists(clear(content)); } else toast("تعذّر"); } }, __g("أنشئ","أنشئي")))));
  document.body.appendChild(sc);
}
