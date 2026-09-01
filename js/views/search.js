// يومياتنا — بحث: find any moment or whisper by word, mood, author or date.
import { api } from "../api.js";
import { store } from "../store.js";
import { sound } from "../sound.js";
import { h, clear, arNum, toast, relTime, fullDate, personChip, moodChip } from "../ui.js";
import { PEOPLE, MOODS, moodEmoji } from "../config.js";
import { go, errorState } from "../helpers.js";
import { icon } from "../icons.js";
import { art } from "../art.js";

// Arabic-friendly folding: drop harakat/tatweel and unify the letters people type loosely.
export function fold(s) {
  return String(s == null ? "" : s)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .toLowerCase().trim();
}

let CACHE = null;            // { moments:[], messages:[] }
let lastQuery = "";
let scope = "moments";       // moments | whispers
let who = "both";            // both | him | her
let moodFilter = "";

async function loadAll(force) {
  if (CACHE && !force) return CACHE;
  const moments = [];
  let cursor = null, pages = 0, failed = false;
  do {
    const r = await api.feed(cursor);
    if (!r.ok) { failed = !moments.length; break; }
    moments.push(...r.data.items);
    cursor = r.data.next_cursor; pages++;
  } while (cursor && pages < 12);
  const m = await api.messages();
  CACHE = { moments, messages: m.ok ? m.data.items : [], failed };
  return CACHE;
}

export async function viewSearch(content) {
  const c = clear(content);
  c.appendChild(h("div", { class: "sub-head" },
    h("button", { class: "icon-btn", "aria-label": "رجوع", onclick: () => go("journal") }, icon("back")),
    h("div", { class: "sh-title" }, "بحث")));

  const input = h("input", { class: "field search-field", type: "search", "aria-label": "ابحث", placeholder: "ابحثا عن كلمة، ذكرى، شعور…", value: lastQuery });
  c.appendChild(h("div", { class: "search-bar" }, h("span", { class: "search-ic" }, icon("search", { size: 20 })), input));

  const seg = h("div", { class: "seg" },
    segBtn("moments", "📖 لحظاتنا"), segBtn("whispers", "💬 همسنا"));
  c.appendChild(seg);

  const filters = h("div", { class: "chip-wrap search-filters" });
  c.appendChild(filters);
  const results = h("div", { class: "search-results" });
  c.appendChild(results);

  paintFilters();
  render();
  setTimeout(() => input.focus(), 60);

  let t = null;
  input.addEventListener("input", () => { lastQuery = input.value; clearTimeout(t); t = setTimeout(render, 180); });

  function segBtn(key, label) {
    return h("button", { class: "seg-b" + (scope === key ? " on" : ""), onclick: () => { scope = key; seg.querySelectorAll(".seg-b").forEach((b, i) => b.classList.toggle("on", (i === 0) === (key === "moments"))); paintFilters(); render(); sound.tab(); } }, label);
  }
  function paintFilters() {
    clear(filters);
    const whoChip = (key, label) => h("button", { class: "chip" + (who === key ? " rose" : ""), onclick: () => { who = key; paintFilters(); render(); } }, label);
    filters.appendChild(whoChip("both", "كلانا"));
    filters.appendChild(whoChip("him", PEOPLE.him.name));
    filters.appendChild(whoChip("her", PEOPLE.her.name));
    if (scope === "moments") {
      MOODS.slice(0, 6).forEach(([label, emo]) => filters.appendChild(
        h("button", { class: "chip" + (moodFilter === label ? " rose" : ""), onclick: () => { moodFilter = moodFilter === label ? "" : label; paintFilters(); render(); } }, emo + " " + label)));
    }
  }

  async function render() {
    clear(results);
    results.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "18px" } }, "…"));
    const data = await loadAll();
    clear(results);
    if (data.failed) { results.appendChild(errorState(() => { CACHE = null; render(); })); return; }
    const q = fold(lastQuery);
    const list = scope === "moments" ? data.moments : data.messages;
    const hits = list.filter((it) => {
      const author = scope === "moments" ? it.author : it.sender;
      if (who !== "both" && author !== who) return false;
      if (scope === "moments" && moodFilter && it.mood !== moodFilter) return false;
      if (!q) return true;
      const hay = fold((it.body || "") + " " + (it.mood || "") + " " + fullDate(it.happened_at || it.created_at));
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
    const head = h("div", { class: "search-count muted" },
      hits.length ? arNum(hits.length) + (scope === "moments" ? " لحظة" : " همسة") : "");
    results.appendChild(head);
    if (!hits.length) {
      results.appendChild(h("div", { class: "empty-card card" },
        art(q ? "search" : scope === "moments" ? "journal" : "chat", { size: 130 }),
        h("div", { class: "muted", style: { marginTop: "10px" } },
          q ? "لا شيء يطابق “" + lastQuery.trim() + "”" : "اكتبا كلمة لتبحثا في كل ما دوّنتماه")));
      return;
    }
    const wrap = h("div", { class: "stagger", style: { display: "flex", flexDirection: "column", gap: "12px" } });
    hits.slice(0, 60).forEach((it) => wrap.appendChild(scope === "moments" ? momentHit(it, lastQuery) : whisperHit(it, lastQuery)));
    results.appendChild(wrap);
  }
}

// highlight the matched words without ever building markup from user text
function highlighted(text, query) {
  const box = h("div", { class: "hit-body" });
  const words = fold(query).split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) { box.appendChild(document.createTextNode(text)); return box; }
  const foldedText = fold(text);
  let idx = -1, hitWord = "";
  for (const w of words) { const i = foldedText.indexOf(w); if (i >= 0 && (idx === -1 || i < idx)) { idx = i; hitWord = w; } }
  if (idx < 0) { box.appendChild(document.createTextNode(text)); return box; }
  const start = Math.max(0, idx - 40);
  const slice = text.slice(start, start + 200);
  const sFold = fold(slice), at = sFold.indexOf(hitWord);
  if (at < 0) { box.appendChild(document.createTextNode(slice)); return box; }
  box.appendChild(document.createTextNode((start > 0 ? "…" : "") + slice.slice(0, at)));
  box.appendChild(h("mark", {}, slice.slice(at, at + hitWord.length)));
  box.appendChild(document.createTextNode(slice.slice(at + hitWord.length) + (text.length > start + 200 ? "…" : "")));
  return box;
}

function momentHit(e, q) {
  const photo = (e.media || []).find((m) => m.kind === "photo" && m.signed_url);
  const card = h("button", { class: "hit card", onclick: () => go("moment/" + e.id) },
    photo ? h("img", { class: "hit-thumb", src: photo.signed_url, alt: "", loading: "lazy" })
          : h("div", { class: "hit-thumb ph" }, moodEmoji(e.mood) || "🌙"),
    h("div", { class: "hit-main" },
      h("div", { class: "hit-head" }, personChip(e.author), moodChip(e.mood), h("span", { class: "when" }, relTime(e.created_at))),
      highlighted(e.body || "لحظةٌ بلا كلمات", q)));
  return card;
}
function whisperHit(m, q) {
  const p = PEOPLE[m.sender] || PEOPLE.him;
  const preview = m.kind === "text" ? (m.body || "") : m.kind === "voice" ? "🎙️ رسالة صوتية" : "📷 صورة";
  return h("button", { class: "hit card", onclick: () => go("chat") },
    h("span", { class: `avatar ${p.cls}` }, p.initial),
    h("div", { class: "hit-main" },
      h("div", { class: "hit-head" }, h("b", {}, p.name), h("span", { class: "when" }, relTime(m.created_at))),
      highlighted(preview, q)));
}

export function invalidateSearchCache() { CACHE = null; }
