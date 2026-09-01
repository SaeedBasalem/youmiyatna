// يومياتنا — نبضنا: the couple's rhythms drawn as charts.
// Everything is computed client-side and drawn with SVG/CSS — no chart library.
import { api } from "../api.js";
import { store } from "../store.js";
import { h, clear, arNum, monthYear, noMotion } from "../ui.js";
import { PEOPLE, MOODS, moodEmoji } from "../config.js";
import { go, errorState } from "../helpers.js";
import { icon } from "../icons.js";
import { art } from "../art.js";

const TZ = 180 * 60000;
const NS = "http://www.w3.org/2000/svg";
const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MOOD_COLORS = ["#E28CA0", "#E3BE86", "#8CA7C6", "#6FBF9F", "#B79AD6", "#EE9E77", "#C9B6EC", "#D96C6C", "#8FCFD6"];

async function gather() {
  const entries = [];
  let cursor = null, pages = 0, ok = false;
  do {
    const r = await api.timeline(cursor);
    if (!r.ok) break;
    ok = true; entries.push(...r.data.items);
    cursor = r.data.next_cursor; pages++;
  } while (cursor && pages < 10);
  const [msg, mood, ms] = await Promise.all([api.messages(), api.moodCalendar(90), api.milestones()]);
  return { ok: ok || entries.length > 0, entries, messages: msg.ok ? msg.data.items : [], moods: mood.ok ? mood.data.items : [], ms: ms.ok ? ms.data : null };
}

export async function viewPulse(content) {
  const c = clear(content);
  c.appendChild(h("div", { class: "sub-head" },
    h("button", { class: "icon-btn", "aria-label": "رجوع", onclick: () => go("us") }, icon("back")),
    h("div", { class: "sh-title" }, "نبضنا")));
  const box = h("div", { class: "pulse stagger" }, h("div", { class: "muted", style: { textAlign: "center", padding: "30px" } }, "نقيس نبضكما…"));
  c.appendChild(box);

  const d = await gather();
  clear(box);
  if (!d.ok && !d.messages.length) { box.appendChild(errorState(() => viewPulse(content))); return; }
  if (!d.entries.length && !d.messages.length) {
    box.appendChild(h("div", { class: "empty-card card" }, art("journal", { size: 140 }),
      h("div", { class: "muted", style: { marginTop: "10px" } }, "يبدأ النبض بأول لحظة تدوّنانها 🤍")));
    return;
  }

  // ---- stat tiles ----
  const photos = d.entries.reduce((n, e) => n + (e.media || []).filter((m) => m.kind === "photo").length, 0);
  box.appendChild(h("div", { class: "pulse-tiles" },
    tile(arNum(d.entries.length), "لحظة"),
    tile(arNum(d.messages.length), "همسة"),
    tile(arNum(photos), "صورة"),
    tile(arNum((d.ms && d.ms.streak_longest) || 0), "أطول سلسلة")));

  // ---- moments per month (bars) ----
  const byMonth = new Map();
  for (const e of d.entries) { const k = monthYear(e.happened_at || e.created_at); byMonth.set(k, (byMonth.get(k) || 0) + 1); }
  const months = [...byMonth.entries()].reverse().slice(-8);
  if (months.length) box.appendChild(chartCard("لحظاتنا شهرًا بشهر 📖", barChart(months)));

  // ---- mood donut ----
  const moodCount = {};
  d.entries.forEach((e) => { if (e.mood) moodCount[e.mood] = (moodCount[e.mood] || 0) + 1; });
  d.moods.forEach((m) => { if (m.mood) moodCount[m.mood] = (moodCount[m.mood] || 0) + 1; });
  const moodsSorted = Object.entries(moodCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (moodsSorted.length) box.appendChild(chartCard("ألوان مشاعرنا 🌈", donut(moodsSorted)));

  // ---- day of week ----
  const byDow = Array(7).fill(0);
  d.entries.forEach((e) => { byDow[new Date(new Date(e.happened_at || e.created_at).getTime() + TZ).getUTCDay()]++; });
  d.messages.forEach((m) => { byDow[new Date(new Date(m.created_at).getTime() + TZ).getUTCDay()]++; });
  if (byDow.some(Boolean)) box.appendChild(chartCard("أي الأيام أحبّ إلينا؟ 🗓️", dowChart(byDow)));

  // ---- who writes more ----
  const bal = { him: 0, her: 0 };
  d.entries.forEach((e) => { if (bal[e.author] != null) bal[e.author]++; });
  d.messages.forEach((m) => { if (bal[m.sender] != null) bal[m.sender]++; });
  if (bal.him + bal.her > 0) {
    const total = bal.him + bal.her, pct = Math.round((bal.him / total) * 100);
    box.appendChild(chartCard("مَن يكتب أكثر؟ ✍️",
      h("div", { class: "wc-split", style: { maxWidth: "none", marginTop: "4px" } },
        h("div", { class: "ws-bar", style: { height: "18px" } },
          h("i", { class: "him", style: { width: pct + "%" } }),
          h("i", { class: "her", style: { width: (100 - pct) + "%" } })),
        h("div", { class: "ws-legend" },
          h("span", {}, PEOPLE.him.name + " · " + arNum(bal.him)),
          h("span", {}, PEOPLE.her.name + " · " + arNum(bal.her))))));
  }

  // ---- streak calendar (last 12 weeks of writing days) ----
  const daySet = new Set(d.entries.map((e) => new Date(new Date(e.happened_at || e.created_at).getTime() + TZ).toISOString().slice(0, 10)));
  box.appendChild(chartCard("أيامٌ كتبنا فيها · آخر ١٢ أسبوعًا 🔥", streakGrid(daySet)));
}

function tile(num, label) {
  return h("div", { class: "pulse-tile card" }, h("b", {}, num), h("span", { class: "muted" }, label));
}
function chartCard(title, body) {
  return h("div", { class: "card pulse-card" }, h("h2", { class: "t-h2", style: { marginBottom: "14px", fontSize: "17px" } }, title), body);
}

function barChart(pairs) {
  const max = Math.max(...pairs.map(([, v]) => v)) || 1;
  const wrap = h("div", { class: "pl-bars" });
  pairs.forEach(([label, v], i) => {
    const col = h("div", { class: "pl-col" },
      h("span", { class: "pl-val" }, arNum(v)),
      h("i", { style: { height: Math.max(8, (v / max) * 110) + "px", animationDelay: (i * 60) + "ms" } }),
      h("span", { class: "pl-lab" }, label.replace(/\s*\d{4}$/, "")));
    wrap.appendChild(col);
  });
  return wrap;
}

function donut(entries) {
  const total = entries.reduce((n, [, v]) => n + v, 0) || 1;
  let acc = 0;
  const stops = entries.map(([, v], i) => {
    const from = (acc / total) * 360; acc += v;
    const to = (acc / total) * 360;
    return `${MOOD_COLORS[i % MOOD_COLORS.length]} ${from}deg ${to}deg`;
  }).join(", ");
  const ringEl = h("div", { class: "pl-donut", style: { background: `conic-gradient(${stops})` } }, h("i", {}, moodEmoji(entries[0][0]) || "🤍"));
  const legend = h("div", { class: "pl-legend" });
  entries.forEach(([mood, v], i) => legend.appendChild(
    h("span", { class: "pl-key" },
      h("i", { style: { background: MOOD_COLORS[i % MOOD_COLORS.length] } }),
      (moodEmoji(mood) || "") + " " + mood + " · " + arNum(Math.round((v / total) * 100)) + "٪")));
  return h("div", { class: "pl-donut-row" }, ringEl, legend);
}

function dowChart(byDow) {
  const max = Math.max(...byDow) || 1;
  const wrap = h("div", { class: "pl-dow" });
  byDow.forEach((v, i) => {
    wrap.appendChild(h("div", { class: "pl-dow-row" },
      h("span", { class: "pl-dow-lab" }, DAYS_AR[i]),
      h("div", { class: "pl-dow-track" }, h("i", { style: { width: Math.max(3, (v / max) * 100) + "%" } })),
      h("span", { class: "pl-dow-val muted" }, arNum(v))));
  });
  return wrap;
}

function streakGrid(daySet) {
  const grid = h("div", { class: "pl-grid" });
  const today = new Date(Date.now() + TZ);
  const start = new Date(today); start.setUTCDate(start.getUTCDate() - 83);
  for (let k = 0; k < 84; k++) {
    const dt = new Date(start); dt.setUTCDate(start.getUTCDate() + k);
    const key = dt.toISOString().slice(0, 10);
    grid.appendChild(h("i", { class: "pl-dot" + (daySet.has(key) ? " on" : ""), title: key }));
  }
  return h("div", {}, grid, h("div", { class: "muted", style: { fontSize: "11.5px", marginTop: "8px", textAlign: "center" } }, "كل نقطةٌ يوم — الوردية أيامٌ كتبتما فيها"));
}
