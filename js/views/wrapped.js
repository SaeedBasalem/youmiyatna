// يومياتنا — حصادنا: a swipeable, animated recap of the couple's story.
import { api } from "../api.js";
import { store } from "../store.js";
import { sound } from "../sound.js";
import { h, clear, arNum, fullDate, monthYear, confetti, sparkleAt, noMotion } from "../ui.js";
import { PEOPLE, MOODS, moodEmoji } from "../config.js";
import { go, errorState } from "../helpers.js";
import { icon } from "../icons.js";
import { art } from "../art.js";

const TZ = 180 * 60000;
const yearNow = () => new Date(Date.now() + TZ).getUTCFullYear();
let period = "all";      // all | year

async function gather() {
  const entries = [];
  let cursor = null, pages = 0, ok = false;
  do {
    const r = await api.timeline(cursor);
    if (!r.ok) break;
    ok = true; entries.push(...r.data.items);
    cursor = r.data.next_cursor; pages++;
  } while (cursor && pages < 10);
  const [ms, msg, mood] = await Promise.all([api.milestones(), api.messages(), api.moodCalendar(90)]);
  return { entries, ok, ms: ms.ok ? ms.data : null, messages: msg.ok ? msg.data.items : [], moods: mood.ok ? mood.data.items : [] };
}

function statsFor(d) {
  const inPeriod = (e) => period === "all" || new Date(e.happened_at || e.created_at).getUTCFullYear() === yearNow();
  const entries = d.entries.filter(inPeriod);
  const photos = entries.reduce((n, e) => n + (e.media || []).filter((m) => m.kind === "photo").length, 0);
  const videos = entries.reduce((n, e) => n + (e.media || []).filter((m) => m.kind === "video").length, 0);
  const voices = entries.reduce((n, e) => n + (e.media || []).filter((m) => m.kind === "voice").length, 0);
  const moods = {};
  entries.forEach((e) => { if (e.mood) moods[e.mood] = (moods[e.mood] || 0) + 1; });
  d.moods.forEach((m) => { if (m.mood) moods[m.mood] = (moods[m.mood] || 0) + 1; });
  const topMood = Object.entries(moods).sort((a, b) => b[1] - a[1])[0] || null;
  const byMonth = {};
  entries.forEach((e) => { const k = monthYear(e.happened_at || e.created_at); byMonth[k] = (byMonth[k] || 0) + 1; });
  const topMonth = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0] || null;
  const byAuthor = { him: 0, her: 0 };
  entries.forEach((e) => { if (byAuthor[e.author] != null) byAuthor[e.author]++; });
  // most-used words, ignoring the tiny connective ones
  const stop = new Set(["من", "في", "على", "الى", "إلى", "عن", "مع", "هذا", "هذه", "التي", "الذي", "كان", "كانت", "وما", "بس", "اللي", "انا", "أنا", "انت", "أنت", "كل", "يا", "ما", "لا", "او", "أو", "ثم", "قد", "هو", "هي", "لك", "لي", "به", "بها"]);
  const words = {};
  entries.forEach((e) => String(e.body || "").split(/[\s،.!؟?,:()"'\n]+/).forEach((w) => {
    const t = w.replace(/[ً-ٟـ]/g, "").trim();
    if (t.length > 2 && !stop.has(t)) words[t] = (words[t] || 0) + 1;
  }));
  const topWords = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const withPhoto = entries.filter((e) => (e.media || []).some((m) => m.kind === "photo" && m.signed_url));
  const keepsake = withPhoto[Math.floor(Math.random() * withPhoto.length)] || entries[Math.floor(Math.random() * entries.length)] || null;
  return { entries, photos, videos, voices, topMood, topMonth, byAuthor, topWords, keepsake, messages: d.messages.length, ms: d.ms };
}

function buildCards(s) {
  const cards = [];
  const days = s.ms && s.ms.days_together;
  cards.push({ tone: "open", big: "حصادنا", sub: period === "all" ? "كل ما جمعناه حتى الآن" : "سنة " + arNum(yearNow()), art: "journal" });
  if (days != null) cards.push({ tone: "rose", num: days, unit: "يومًا معًا", line: "وكل يومٍ منها نعمة 🤍" });
  cards.push({ tone: "gold", num: s.entries.length, unit: "لحظة دوّنّاها", line: s.entries.length ? "صفحاتٌ لن تضيع" : "الصفحة الأولى بانتظاركما" });
  if (s.photos + s.videos > 0) cards.push({ tone: "him", num: s.photos + s.videos, unit: "صورة ومقطع", line: "لحظاتٌ حبستماها من الزمن 📸" });
  if (s.messages) cards.push({ tone: "her", num: s.messages, unit: "همسة بينكما", line: "كلامٌ لا يعرفه أحدٌ غيركما 💬" });
  if (s.topMood) cards.push({ tone: "rose", emoji: moodEmoji(s.topMood[0]) || "🌈", big: s.topMood[0], sub: "أكثر شعورٍ رافقكما", line: arNum(s.topMood[1]) + " مرة" });
  if (s.topWords.length) cards.push({ tone: "gold", words: s.topWords, sub: "أكثر ما قلتماه" });
  if (s.topMonth) cards.push({ tone: "him", big: s.topMonth[0], sub: "أكثر شهرٍ امتلأ بكما", line: arNum(s.topMonth[1]) + " لحظة" });
  if (s.ms && s.ms.streak_longest > 1) cards.push({ tone: "gold", num: s.ms.streak_longest, unit: "يومًا متتاليًا", line: "أطول سلسلةٍ لم تنقطع 🔥" });
  if (s.byAuthor.him + s.byAuthor.her > 0) cards.push({ tone: "rose", split: s.byAuthor, sub: "مَن كتب أكثر؟" });
  if (s.keepsake) cards.push({ tone: "keepsake", entry: s.keepsake, sub: "ذكرى من بين كل هذا" });
  cards.push({ tone: "close", big: "وإلى حصادٍ أجمل", line: "اللهم بارك لنا فيما بيننا 🤲", art: "journal" });
  return cards;
}

export async function viewWrapped(content) {
  const c = clear(content);
  c.classList.add("wrap-view");
  c.appendChild(h("div", { class: "sub-head" },
    h("button", { class: "icon-btn", "aria-label": "رجوع", onclick: () => go("us") }, icon("back")),
    h("div", { class: "sh-title" }, "حصادنا"),
    h("button", { class: "btn ghost sm", style: { marginInlineStart: "auto" }, onclick: () => { period = period === "all" ? "year" : "all"; viewWrapped(content); } },
      period === "all" ? "كل الوقت" : "سنة " + arNum(yearNow()))));
  const stage = h("div", { class: "wrap-stage" }, h("div", { class: "muted", style: { textAlign: "center", padding: "40px" } }, "نحسب حصادكما…"));
  c.appendChild(stage);

  const data = await gather();
  if (!data.ok && !data.entries.length && !data.messages.length) {
    clear(stage); stage.appendChild(errorState(() => viewWrapped(content))); return;
  }
  const cards = buildCards(statsFor(data));
  let idx = 0;
  paint();

  function paint() {
    clear(stage);
    const bars = h("div", { class: "wrap-bars" });
    cards.forEach((_, i) => bars.appendChild(h("span", { class: "wb" + (i < idx ? " done" : i === idx ? " now" : "") })));
    stage.appendChild(bars);
    stage.appendChild(cardEl(cards[idx]));
    const nav = h("div", { class: "wrap-nav" },
      h("button", { class: "wn prev", "aria-label": "السابق", onclick: () => step(-1) }, icon("fwd")),
      h("button", { class: "wn next", "aria-label": "التالي", onclick: () => step(1) }, icon("back")));
    stage.appendChild(nav);
    if (cards[idx].tone === "close" && !noMotion()) setTimeout(confetti, 260);
  }
  function step(d) {
    const n = idx + d;
    if (n < 0) return;
    if (n >= cards.length) { go("us"); return; }
    idx = n; sound.page(); paint();
  }
  // swipe through the story
  let x0 = null;
  stage.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  }, { passive: true });
}

function cardEl(card) {
  const el = h("div", { class: "wrap-card tone-" + card.tone });
  if (card.art) el.appendChild(art(card.art, { size: 150, cls: "wc-art" }));
  if (card.emoji) el.appendChild(h("div", { class: "wc-emoji" }, card.emoji));
  if (card.num != null) {
    const n = h("div", { class: "wc-num" }, "٠");
    el.appendChild(n);
    countUp(n, card.num);
  }
  if (card.unit) el.appendChild(h("div", { class: "wc-unit" }, card.unit));
  if (card.big) el.appendChild(h("div", { class: "wc-big" }, card.big));
  if (card.sub) el.appendChild(h("div", { class: "wc-sub" }, card.sub));
  if (card.words) {
    const cloud = h("div", { class: "wc-cloud" });
    const max = card.words[0][1] || 1;
    card.words.forEach(([w, n], i) => {
      const s = 15 + Math.round((n / max) * 20);
      cloud.appendChild(h("span", { class: "wc-word", style: { fontSize: s + "px", opacity: String(0.6 + (n / max) * 0.4) } }, w));
    });
    el.appendChild(cloud);
  }
  if (card.split) {
    const total = card.split.him + card.split.her || 1;
    const pctHim = Math.round((card.split.him / total) * 100);
    el.appendChild(h("div", { class: "wc-split" },
      h("div", { class: "ws-bar" },
        h("i", { class: "him", style: { width: pctHim + "%" } }),
        h("i", { class: "her", style: { width: 100 - pctHim + "%" } })),
      h("div", { class: "ws-legend" },
        h("span", {}, PEOPLE.him.name + " " + arNum(card.split.him)),
        h("span", {}, PEOPLE.her.name + " " + arNum(card.split.her)))));
  }
  if (card.entry) {
    const e = card.entry;
    const photo = (e.media || []).find((m) => m.kind === "photo" && m.signed_url);
    if (photo) el.appendChild(h("img", { class: "wc-photo", src: photo.signed_url, alt: "", loading: "lazy" }));
    if (e.body) el.appendChild(h("div", { class: "wc-quote" }, "“" + e.body.slice(0, 160) + "”"));
    el.appendChild(h("div", { class: "wc-meta" }, (PEOPLE[e.author] || PEOPLE.him).name + " · " + fullDate(e.happened_at || e.created_at)));
  }
  if (card.line) el.appendChild(h("div", { class: "wc-line" }, card.line));
  return el;
}

function countUp(node, target) {
  if (noMotion() || target <= 0) { node.textContent = arNum(target); return; }
  const dur = Math.min(1100, 300 + target * 6);
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    node.textContent = arNum(Math.round(target * eased));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
