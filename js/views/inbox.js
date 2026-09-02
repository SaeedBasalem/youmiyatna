// يومياتنا — كل ما جرى: the full activity stream behind the news bar.
// The server derives this from what already exists, so it was complete from
// the first minute rather than starting empty on the day it shipped.
import { h, $, clear, toast, arNum } from "../ui.js";
import { api } from "../api.js";
import { store } from "../store.js";
import { PEOPLE } from "../config.js";
import { errorState } from "../helpers.js";
import { haptic } from "../haptics.js";

let cache = null;

const FILTERS = [
  ["all", "الكل", null],
  ["whisper", "همس", ["whisper"]],
  ["moment", "لحظات", ["moment", "note"]],
  ["us", "نحن", ["mood", "gratitude", "list", "dua", "letter", "letter_open", "countdown"]],
  ["task", "مهام", ["task", "task_done"]],
];
let filter = "all";

function when(iso) {
  const t = new Date(iso), now = new Date();
  const mins = Math.round((now - t) / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `قبل ${arNum(mins)} د`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `قبل ${arNum(hrs)} س`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "أمس";
  if (days < 7) return `قبل ${arNum(days)} أيام`;
  try { return t.toLocaleDateString("ar", { day: "numeric", month: "long" }); } catch { return ""; }
}
function dayLabel(iso) {
  try {
    const t = new Date(iso), today = new Date();
    const same = (a, b) => a.toDateString() === b.toDateString();
    if (same(t, today)) return "اليوم";
    const y = new Date(today); y.setDate(y.getDate() - 1);
    if (same(t, y)) return "أمس";
    return t.toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long" });
  } catch { return ""; }
}

export async function viewInbox(content) {
  const c = clear(content);
  c.appendChild(h("div", { class: "sub-head" },
    h("button", { class: "icon-btn", "aria-label": "رجوع", onclick: () => (location.hash = "#/home") }, "→"),
    h("div", {},
      h("div", { class: "sh-title" }, "كل ما جرى"),
      h("div", { class: "muted", style: { fontSize: "12px" } }, "خيطُ حياتكما، بترتيبه"))));

  const chips = h("div", { class: "chip-wrap inbox-filters" });
  const body = h("div", { class: "inbox-list" }, h("div", { class: "muted", style: { textAlign: "center", padding: "30px" } }, "…"));
  c.appendChild(chips); c.appendChild(body);

  function paintChips() {
    clear(chips);
    for (const [key, label] of FILTERS) {
      chips.appendChild(h("button", { class: "chip" + (filter === key ? " on" : ""), onclick: () => { filter = key; haptic.tap(); paintChips(); paint(); } }, label));
    }
  }

  function paint() {
    clear(body);
    if (!cache) return;
    const kinds = (FILTERS.find((f) => f[0] === filter) || [])[2];
    const items = kinds ? cache.items.filter((i) => kinds.includes(i.kind)) : cache.items;
    if (!items.length) {
      body.appendChild(h("div", { class: "empty" }, h("div", { class: "big" }, "🌾"), h("div", {}, "لا شيء هنا بعد")));
      return;
    }
    let lastDay = null;
    for (const it of items) {
      const d = dayLabel(it.at);
      if (d !== lastDay) { lastDay = d; body.appendChild(h("div", { class: "inbox-day" }, d)); }
      const fresh = cache.seen_at && it.at > cache.seen_at && it.actor && it.actor !== store.person;
      body.appendChild(h("button", {
        class: "inbox-row" + (fresh ? " fresh" : "") + (it.actor ? " by-" + it.actor : ""),
        onclick: () => { haptic.tap(); if (it.url) location.hash = it.url; },
      },
        h("span", { class: "ib-e" }, it.emoji || "•"),
        h("div", { class: "ib-body" },
          h("b", {}, it.title),
          it.text ? h("span", { class: "ib-text" }, it.text) : null),
        h("span", { class: "ib-when" }, when(it.at))));
    }
  }

  paintChips();
  const r = await api.activity(80);
  if (!r.ok) {
    clear(body).appendChild(errorState(() => viewInbox(content), { offline: r.offline }));
    return;
  }
  cache = r.data;
  paint();
  // reading the page is what marks it read
  const newest = (cache.items[0] || {}).at;
  if (newest && newest > (cache.seen_at || "")) {
    api.activitySeen(newest).then(() => { store.activityUnseen = 0; const b = $(".tab-badge-inbox"); if (b) b.remove(); });
  }
}

// how many things the other one did that this person has not looked at yet
export async function refreshActivityBadge() {
  try {
    const r = await api.activity(40);
    if (r.ok) { store.activityUnseen = r.data.unseen || 0; return r.data; }
  } catch {}
  return null;
}
