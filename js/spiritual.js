// يومياتنا — روحانياتنا: tasbeeh counter, khatmah tracker, du'a wall.
import { h, clear, personChip, arNum, toast, confetti } from "./ui.js";
import { api } from "./api.js";
import { store } from "./store.js";
import { sound } from "./sound.js";
import { realtime } from "./realtime.js";
import { PEOPLE } from "./config.js";

const DHIKR = ["سبحان الله", "الحمد لله", "الله أكبر", "لا إله إلا الله", "أستغفر الله", "اللهم صلِّ على محمد"];
let counts = {}, selected = DHIKR[0], pending = {}, sendTimer = null, paintTasbeeh = () => {}, spContent = null;

export function hijriShort() {
  try { return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long" }).format(new Date()); } catch { return ""; }
}
function hijriFull() {
  try { return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()) + " هـ"; } catch { return ""; }
}

export async function viewSpiritual(content) {
  spContent = content;
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "روحانياتنا")));
  content.appendChild(h("div", { class: "hijri-line" }, "☪ " + hijriFull()));
  const wrap = h("div", { class: "spiritual" }, h("div", { class: "empty", style: { padding: "16px" } }, "…"));
  content.appendChild(wrap);
  const [dh, kh, du] = await Promise.all([api.getDhikr(), api.getKhatmah(), api.listDuas()]);
  counts = dh.ok ? dh.data.counts : {};
  clear(wrap);
  wrap.appendChild(tasbeeh());
  wrap.appendChild(khatmahCard(kh.ok ? kh.data : { khatmah: null, logs: [] }, content));
  wrap.appendChild(duaWall(du.ok ? du.data.items : [], content));
}

function tasbeeh() {
  const card = h("div", { class: "panel tasbeeh" }, h("div", { class: "rc-head" }, h("span", { class: "rc-emoji" }, "📿"), h("b", {}, "المسبحة")));
  const chips = h("div", { class: "mood-row" });
  DHIKR.forEach((label) => chips.appendChild(h("button", { class: "mood-opt", onclick: () => { selected = label; paint(); } }, label)));
  card.appendChild(chips);
  const big = h("button", { class: "tasbeeh-btn", onclick: tap });
  const total = h("div", { class: "tasbeeh-total" });
  card.appendChild(h("div", { class: "tasbeeh-body" }, big, total));
  function paint() {
    [...chips.children].forEach((b, i) => b.classList.toggle("sel", DHIKR[i] === selected));
    clear(big);
    big.appendChild(h("span", { class: "tb-count" }, arNum(counts[selected] || 0)));
    big.appendChild(h("span", { class: "tb-label" }, selected));
    total.textContent = "مجموع اليوم: " + arNum(Object.values(counts).reduce((a, b) => a + b, 0));
  }
  function tap() {
    counts[selected] = (counts[selected] || 0) + 1;
    pending[selected] = (pending[selected] || 0) + 1;
    paint(); sound.tab(); if (navigator.vibrate) navigator.vibrate(12);
    big.classList.remove("pulse"); void big.offsetWidth; big.classList.add("pulse");
    clearTimeout(sendTimer); sendTimer = setTimeout(flush, 600);
  }
  paintTasbeeh = paint;
  paint();
  return card;
}
async function flush() {
  const p = { ...pending }; pending = {};
  for (const [label, delta] of Object.entries(p)) {
    if (delta > 0) { const r = await api.incDhikr(label, delta); if (r.ok) { counts[label] = r.data.count; realtime.broadcast("dhikr", { key: label, count: r.data.count }); } }
  }
  paintTasbeeh();
}
export function spiritualOnDhikr(payload) { if (!payload) return; counts[payload.key] = payload.count; paintTasbeeh(); }

function progressBar(read, total) {
  const pct = total ? Math.round((read / total) * 100) : 0;
  return h("div", {},
    h("div", { class: "prog-bar" }, h("div", { class: "prog-fill", style: { width: pct + "%" } })),
    h("div", { class: "muted", style: { textAlign: "center", marginTop: "4px", fontWeight: 700 } }, arNum(read) + " / " + arNum(total) + " جزء · " + arNum(pct) + "٪"));
}
function khatmahCard(data, content) {
  const { khatmah, logs } = data;
  const card = h("div", { class: "panel" }, h("div", { class: "rc-head" }, h("span", { class: "rc-emoji" }, "📖"), h("b", {}, "ختمة القرآن")));
  if (!khatmah) {
    card.appendChild(h("div", { class: "muted", style: { marginBottom: "10px" } }, __g("ابدأ ختمةً تقرؤها — كل جزء بينكما 📖","ابدئي ختمةً تقرئينها — كل جزء بينكما 📖")));
    card.appendChild(h("button", { class: "btn sun sm", onclick: async () => { await api.newKhatmah("ختمتنا", 30); viewSpiritual(clear(content)); } }, __g("ابدأ ختمة","ابدئي ختمة")));
    return card;
  }
  const readMap = {}; (logs || []).forEach((l) => (readMap[l.unit] = l.by_who));
  card.appendChild(progressBar((logs || []).length, khatmah.total));
  const grid = h("div", { class: "juz-grid" });
  for (let u = 1; u <= khatmah.total; u++) {
    const by = readMap[u];
    grid.appendChild(h("button", { class: "juz-cell" + (by ? " read " + by : ""), onclick: async () => { const r = await api.markJuz(khatmah.id, u); if (r.ok) { sound.tab(); realtime.broadcast("spiritual"); viewSpiritual(clear(content)); if (r.data.completed) { confetti(); sound.celebrate(); toast("ختمة مباركة 🌙 تقبّل الله"); } } } }, arNum(u)));
  }
  card.appendChild(grid);
  card.appendChild(h("button", { class: "btn ghost sm", style: { marginTop: "10px" }, onclick: async () => { if (!confirm("بدء ختمة جديدة؟")) return; await api.newKhatmah("ختمتنا", 30); viewSpiritual(clear(content)); } }, "ختمة جديدة"));
  return card;
}

function forLabel(f) { return f === "him" ? "لسعيد" : f === "her" ? "لياسمين" : "لنا"; }
function duaWall(items, content) {
  const card = h("div", { class: "panel" }, h("div", { class: "rc-head" }, h("span", { class: "rc-emoji" }, "🤲"), h("b", {}, "دعواتنا")));
  const list = h("div", { class: "dua-list" });
  if (!items.length) list.appendChild(h("div", { class: "muted" }, __g("اكتب دعوةً لبعضكما 🤍","اكتبي دعوةً لبعضكما 🤍")));
  items.forEach((d) => {
    const ameen = Array.isArray(d.ameen) ? d.ameen : [];
    const mine = ameen.includes(store.person);
    list.appendChild(h("div", { class: "dua-item " + d.author },
      h("div", { class: "dua-top" }, personChip(d.author), h("span", { class: "dua-for" }, forLabel(d.for_whom))),
      h("div", { class: "dua-body" }, d.body),
      h("button", { class: "ameen-btn" + (mine ? " on" : ""), onclick: async () => { const r = await api.ameen(d.id); if (r.ok) { sound.react(); realtime.broadcast("spiritual"); viewSpiritual(clear(content)); } } }, "آمين" + (ameen.length ? " · " + arNum(ameen.length) : ""))));
  });
  card.appendChild(list);
  card.appendChild(h("button", { class: "btn coral sm", style: { marginTop: "10px" }, onclick: () => duaModal(content) }, "＋ دعوة"));
  return card;
}
function duaModal(content) {
  const body = h("textarea", { class: "field", rows: 3, placeholder: "اللهم…" });
  let who = "us";
  const seg = h("div", { class: "seg" });
  [["us", "لنا"], ["him", "لسعيد"], ["her", "لياسمين"]].forEach(([v, label]) => seg.appendChild(h("button", { class: "seg-opt" + (v === "us" ? " sel" : ""), onclick: (e) => { who = v; seg.querySelectorAll(".seg-opt").forEach((x) => x.classList.remove("sel")); e.currentTarget.classList.add("sel"); } }, label)));
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" },
    h("h3", {}, "دعوة 🤲"), body,
    h("label", { class: "lbl" }, "لمن؟"), seg,
    h("div", { class: "attach-rail", style: { marginTop: "14px" } },
      h("button", { class: "btn ghost", onclick: () => sc.remove() }, "إلغاء"),
      h("button", { class: "btn coral", onclick: async () => { const b = body.value.trim(); if (!b) { body.focus(); return; } const r = await api.addDua(b, who); if (r.ok) { sc.remove(); sound.post(); realtime.broadcast("spiritual"); viewSpiritual(clear(content)); } else toast("تعذّر"); } }, __g("اكتب","اكتبي")))));
  document.body.appendChild(sc);
}
