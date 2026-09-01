// يومياتنا — كتابنا: the journal bound as a book you flip through, and can print.
import { api } from "../api.js";
import { store } from "../store.js";
import { sound } from "../sound.js";
import { h, clear, arNum, fullDate, monthYear, toast } from "../ui.js";
import { PEOPLE, moodEmoji } from "../config.js";
import { go, errorState, loader } from "../helpers.js";
import { icon } from "../icons.js";
import { art } from "../art.js";

let PAGES = null;   // built page models, cached for the session

const TZ = 180 * 60000;
function daysTogether() {
  const a = store.config.anniversary_date; if (!a) return null;
  const now = new Date(Date.now() + TZ);
  const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ad = new Date(a + "T00:00:00Z");
  return Math.max(0, Math.round((t - Date.UTC(ad.getUTCFullYear(), ad.getUTCMonth(), ad.getUTCDate())) / 86400000));
}

async function loadEntries() {
  const all = [];
  let cursor = null, pages = 0, ok = false;
  do {
    const r = await api.timeline(cursor);
    if (!r.ok) break;
    ok = true;
    all.push(...r.data.items);
    cursor = r.data.next_cursor; pages++;
  } while (cursor && pages < 10);
  return { all, ok };
}

// Build the page models: cover → dedication → (chapter → leaves)* → closing
function buildPages(entries) {
  const pages = [{ kind: "cover" }];
  if (store.config.dedication) pages.push({ kind: "dedication" });
  const byMonth = new Map();
  for (const e of entries) {
    const key = monthYear(e.happened_at || e.created_at);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(e);
  }
  // oldest first, so the book reads like a story
  const months = [...byMonth.entries()].reverse();
  for (const [month, items] of months) {
    const ordered = items.slice().reverse();
    pages.push({ kind: "chapter", month, count: ordered.length });
    let buf = [];
    for (const e of ordered) {
      const hasPhoto = (e.media || []).some((m) => m.kind === "photo" && m.signed_url);
      if (hasPhoto) {
        if (buf.length) { pages.push({ kind: "leaf", month, items: buf }); buf = []; }
        pages.push({ kind: "plate", month, entry: e });
      } else {
        buf.push(e);
        if (buf.length === 3) { pages.push({ kind: "leaf", month, items: buf }); buf = []; }
      }
    }
    if (buf.length) pages.push({ kind: "leaf", month, items: buf });
  }
  pages.push({ kind: "closing", total: entries.length });
  return pages;
}

export async function viewBook(content) {
  const c = clear(content);
  c.classList.add("book-view");
  c.appendChild(h("div", { class: "sub-head no-print" },
    h("button", { class: "icon-btn", "aria-label": "رجوع", onclick: () => go("us") }, icon("back")),
    h("div", { class: "sh-title" }, "كتابنا"),
    h("button", { class: "icon-btn", "aria-label": "اطبع أو احفظ PDF", style: { marginInlineStart: "auto" }, onclick: () => { toast("اختارا «حفظ كـ PDF» من نافذة الطباعة"); setTimeout(() => window.print(), 400); } }, icon("download"))));

  const stage = h("div", { class: "book-stage" });
  c.appendChild(stage);
  stage.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "30px" } }, "نجمع صفحاتكما…"));

  if (!PAGES) {
    const { all, ok } = await loadEntries();
    if (!ok && !all.length) { clear(stage); stage.appendChild(errorState(() => { PAGES = null; viewBook(content); })); return; }
    PAGES = buildPages(all);
  }
  paint();

  function paint() {
    clear(stage);
    const track = h("div", { class: "book-track" });
    PAGES.forEach((p, i) => track.appendChild(pageEl(p, i)));
    stage.appendChild(track);

    const counter = h("div", { class: "book-counter no-print" }, "");
    const prev = h("button", { class: "book-nav prev no-print", "aria-label": "الصفحة السابقة", onclick: () => turn(1) }, icon("fwd"));
    const next = h("button", { class: "book-nav next no-print", "aria-label": "الصفحة التالية", onclick: () => turn(-1) }, icon("back"));
    stage.appendChild(prev); stage.appendChild(next); stage.appendChild(counter);

    const update = () => {
      const w = track.clientWidth || 1;
      const idx = Math.round(Math.abs(track.scrollLeft) / w);
      counter.textContent = arNum(Math.min(idx + 1, PAGES.length)) + " / " + arNum(PAGES.length);
    };
    track.addEventListener("scroll", update, { passive: true });
    setTimeout(update, 60);
    function turn(dir) {
      const w = track.clientWidth || 1;
      // RTL tracks scroll negatively; normalise by using scrollBy
      track.scrollBy({ left: dir * w, behavior: "smooth" });
      sound.page();
    }
  }
}

function pageEl(p, i) {
  const page = h("div", { class: "book-page k-" + p.kind });
  if (p.kind === "cover") {
    page.appendChild(h("div", { class: "bp-crest" }, "🤍"));
    page.appendChild(h("div", { class: "bp-title" }, "يومياتنا"));
    page.appendChild(h("div", { class: "bp-sub" }, PEOPLE.him.name + " & " + PEOPLE.her.name));
    const d = daysTogether();
    if (d != null) page.appendChild(h("div", { class: "bp-days" }, "معًا منذ " + arNum(d) + " يومًا"));
    if (store.config.anniversary_date) page.appendChild(h("div", { class: "bp-since" }, "منذ " + fullDate(store.config.anniversary_date)));
    page.appendChild(h("div", { class: "bp-rule" }));
    page.appendChild(h("div", { class: "bp-hint no-print" }, "اسحبا لتقليب الصفحات ←"));
  } else if (p.kind === "dedication") {
    page.appendChild(h("div", { class: "bp-chapter-label" }, "الإهداء"));
    page.appendChild(h("div", { class: "bp-ded" }, store.config.dedication));
    if (store.config.reply) page.appendChild(h("div", { class: "bp-ded reply" }, "— ردُّها: " + store.config.reply));
  } else if (p.kind === "chapter") {
    page.appendChild(h("div", { class: "bp-chapter-label" }, "فصل"));
    page.appendChild(h("div", { class: "bp-chapter" }, p.month));
    page.appendChild(h("div", { class: "bp-rule" }));
    page.appendChild(h("div", { class: "bp-sub" }, arNum(p.count) + " لحظة"));
  } else if (p.kind === "plate") {
    const e = p.entry;
    const photo = (e.media || []).find((m) => m.kind === "photo" && m.signed_url);
    page.appendChild(h("img", { class: "bp-photo", src: photo.signed_url, alt: "", loading: "lazy" }));
    if (e.body) page.appendChild(h("div", { class: "bp-caption" }, e.body));
    page.appendChild(h("div", { class: "bp-foot" }, (PEOPLE[e.author] || PEOPLE.him).name + " · " + fullDate(e.happened_at || e.created_at) + (e.mood ? " · " + moodEmoji(e.mood) : "")));
  } else if (p.kind === "leaf") {
    page.appendChild(h("div", { class: "bp-month" }, p.month));
    p.items.forEach((e, n) => {
      const blk = h("div", { class: "bp-entry" });
      blk.appendChild(h("div", { class: "bp-entry-head" }, (PEOPLE[e.author] || PEOPLE.him).name + " · " + fullDate(e.happened_at || e.created_at) + (e.mood ? " · " + moodEmoji(e.mood) : "")));
      blk.appendChild(h("div", { class: "bp-text" }, e.body || "لحظةٌ بلا كلمات"));
      page.appendChild(blk);
      if (n < p.items.length - 1) page.appendChild(h("div", { class: "bp-sep" }, "❦"));
    });
  } else {
    page.appendChild(art("journal", { size: 150 }));
    page.appendChild(h("div", { class: "bp-chapter", style: { marginTop: "12px" } }, "ويتبع…"));
    page.appendChild(h("div", { class: "bp-sub" }, arNum(p.total) + " لحظة حتى الآن"));
    page.appendChild(h("div", { class: "bp-ded", style: { marginTop: "14px" } }, "اللهم اجعل ما بيننا في رضاك."));
  }
  page.appendChild(h("div", { class: "bp-num" }, arNum(i + 1)));
  return page;
}
