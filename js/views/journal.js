// يومياتنا — the "يومياتنا" tab: feed of moments, composer, moment detail, album, timeline.
import { api } from "../api.js";
import { store } from "../store.js";
import { sound } from "../sound.js";
import { h, $, clear, avatar, personChip, moodChip, heartFly, relTime, fullDate, monthYear, arNum, toast, sparkleAt, waveBars, clickable } from "../ui.js";
import { PEOPLE, MOODS, REACTIONS, moodEmoji } from "../config.js";
import { downscale, VoiceRecorder, uploadSigned } from "../media.js";
import { loader, go, openSheet, openModal, confirmAsk, groupReactions, safeUrl, errorState } from "../helpers.js";

let jsub = "feed";          // feed | album | timeline
let feedCache = null;

export function viewJournal(content) {
  const c = clear(content);
  c.appendChild(h("div", { class: "section-title" },
    h("h1", { class: "t-h1" }, "دفتر ذكرياتنا"),
    h("button", { class: "icon-btn", "aria-label": "اكتب لحظة", style: { marginInlineStart: "auto" }, onclick: () => openCompose({ onDone: () => { feedCache = null; if (jsub === "feed") renderFeed(pane); } }) }, "✍️")));
  c.appendChild(h("div", { class: "seg" },
    segBtn("feed", "📖 لحظاتنا"), segBtn("album", "🖼️ الألبوم"), segBtn("timeline", "📜 حكايتنا")));
  const pane = h("div", { class: "jpane" });
  c.appendChild(pane);
  renderSub(pane);

  function segBtn(key, label) {
    return h("button", { class: "seg-b" + (jsub === key ? " on" : ""), onclick: () => { if (jsub === key) return; jsub = key; c.querySelectorAll(".seg-b").forEach((b) => b.classList.remove("on")); c.querySelector(`.seg-b[data-k="${key}"]`)?.classList.add("on"); sound.tab(); renderSub(pane); }, dataset: { k: key } }, label);
  }
}
function renderSub(pane) {
  if (jsub === "feed") return renderFeed(pane);
  if (jsub === "album") return renderAlbum(pane);
  return renderTimeline(pane);
}

/* ---------------- feed ---------------- */
async function renderFeed(pane) {
  const c = clear(pane);
  c.appendChild(h("button", { class: "hero-note slim", onclick: () => openCompose({ onDone: () => { feedCache = null; renderFeed(pane); } }) },
    h("div", { class: "hn-t" }, __g("بماذا تشعر اليوم؟", "بماذا تشعرين اليوم؟")),
    h("span", { class: "hn-cta" }, "✍️ " + __g("اكتب لحظة", "اكتبي لحظة"))));
  const list = h("div", { class: "feed" });
  c.appendChild(list);
  if (feedCache) paint(feedCache);
  else list.appendChild(skeletonCard());
  const [f, otd] = await Promise.all([api.feed(), api.onThisDay()]);
  const flash = otd.ok && otd.data.items[0];
  if (f.ok) { feedCache = f.data.items; store.cacheFeed(feedCache); paint(feedCache, flash); }
  else {
    const cached = store.cachedFeed();
    if (cached.length) { feedCache = cached; paint(cached, flash, true); }
    else { clear(list); list.appendChild(errorState(() => renderFeed(pane), { offline: f.offline })); }
  }

  function paint(items, flashback, stale) {
    clear(list);
    if (stale) list.appendChild(h("div", { class: "offline-banner" }, "🌙 أنتما دون اتصال — نعرض آخر ما حُفظ"));
    if (flashback) list.appendChild(momentCard(flashback, { flashback: true }));
    if (!items.length && !flashback) {
      list.appendChild(h("div", { class: "empty-card card" },
        h("div", { class: "big" }, "🌱"),
        h("div", { class: "muted" }, __g("لا لحظاتٍ بعد… اكتب أولى صفحاتكما.", "لا لحظاتٍ بعد… اكتبي أولى صفحاتكما.")),
        h("button", { class: "btn", style: { marginTop: "14px", width: "auto" }, onclick: () => openCompose({ onDone: () => { feedCache = null; renderFeed(pane); } }) }, "✍️ " + __g("ابدأ", "ابدئي"))));
      return;
    }
    items.forEach((e) => list.appendChild(momentCard(e)));
  }
}
function skeletonCard() { return h("div", { class: "moment sk" }, h("div", { class: "sk-line w40" }), h("div", { class: "sk-line" }), h("div", { class: "sk-line w70" })); }

/* ---------------- moment card ---------------- */
export function momentCard(e, opts = {}) {
  const p = PEOPLE[e.author] || PEOPLE.him;
  const card = h("div", { class: "moment " + p.cls + (opts.flashback ? " flash" : "") });
  if (opts.flashback) {
    const y = e.happened_at ? new Date().getFullYear() - new Date(e.happened_at).getFullYear() : 0;
    card.appendChild(h("div", { class: "ribbon" }, "🔁 في مثل هذا اليوم" + (y > 0 ? ` · قبل ${arNum(y)} سنة` : "")));
  }
  card.appendChild(h("div", { class: "m-head" }, personChip(e.author), moodChip(e.mood), h("span", { class: "when" }, relTime(e.created_at))));
  if (e.body) card.appendChild(h("div", { class: "m-body" }, e.body));
  const mb = mediaBlock(e.media); if (mb) card.appendChild(mb);
  card.appendChild(momentFoot(e, card));
  if (!opts.detail) {
    card.addEventListener("dblclick", (ev) => { heartFly(ev.clientX, ev.clientY); toggleReact(e, "❤️", card); });
    card.addEventListener("click", (ev) => { if (ev.target.closest("button,audio,a,.react-pill,.carousel-track")) return; go("moment/" + e.id); });
    clickable(card, () => go("moment/" + e.id));
    card.setAttribute("aria-label", "افتح هذه اللحظة");
  }
  return card;
}
function mediaBlock(media) {
  if (!media || !media.length) return null;
  const box = h("div", { class: "m-media" });
  const photos = media.filter((m) => m.kind === "photo" && m.signed_url);
  if (photos.length === 1) box.appendChild(h("img", { class: "m-photo", src: photos[0].signed_url, loading: "lazy", alt: "" }));
  else if (photos.length > 1) box.appendChild(carousel(photos));
  for (const m of media) {
    if (m.kind === "video" && m.signed_url) box.appendChild(h("video", { class: "m-video", src: m.signed_url, controls: true, preload: "metadata", playsInline: true }));
    else if (m.kind === "voice" && m.signed_url) box.appendChild(voicePill(m));
    else if (m.kind === "song") box.appendChild(songPill(m));
  }
  return box;
}
function carousel(photos) {
  const track = h("div", { class: "carousel-track" });
  photos.forEach((p) => track.appendChild(h("img", { class: "carousel-img", src: p.signed_url, loading: "lazy", alt: "" })));
  const dots = h("div", { class: "carousel-dots" });
  photos.forEach((_, i) => dots.appendChild(h("span", { class: "cdot" + (i === 0 ? " on" : "") })));
  track.addEventListener("scroll", () => { const idx = Math.round(Math.abs(track.scrollLeft) / track.clientWidth); dots.querySelectorAll(".cdot").forEach((d, i) => d.classList.toggle("on", i === idx)); });
  return h("div", { class: "carousel" }, track, dots);
}
function voicePill(m) {
  const audio = h("audio", { src: m.signed_url, preload: "none" });
  const bars = (m.meta && m.meta.bars) || Array.from({ length: 26 }, () => 0.3 + Math.random() * 0.5);
  const wave = h("div", { class: "wave" }, ...waveBars(bars));
  const btn = h("button", { class: "play", "aria-label": "تشغيل الهمسة الصوتية", onclick: () => { if (audio.paused) { audio.play(); btn.textContent = "⏸"; } else { audio.pause(); btn.textContent = "▶"; } } }, "▶");
  audio.addEventListener("ended", () => (btn.textContent = "▶"));
  return h("div", { class: "voice-pill" }, btn, wave, audio, h("span", { class: "vd" }, arNum((m.meta && m.meta.duration) || 0) + "ث"));
}
function songPill(m) {
  const meta = m.meta || {};
  const inner = h("div", { class: "song-pill" }, h("span", { class: "cassette" }, "🎵"),
    h("div", { class: "meta" }, h("b", {}, meta.title || "أغنية اللحظة"), h("span", { class: "muted" }, meta.artist || "")));
  const u = safeUrl(m.url);
  return u ? h("a", { href: u, target: "_blank", rel: "noreferrer", style: { textDecoration: "none" } }, inner) : inner;
}
function momentFoot(e, card) {
  const foot = h("div", { class: "m-foot" });
  const rrow = h("div", { class: "react-row" }); renderReacts(rrow, e, card); foot.appendChild(rrow);
  foot.appendChild(h("button", { class: "foot-chip", onclick: (ev) => { ev.stopPropagation(); go("moment/" + e.id); } }, "💬 " + arNum(e.note_count || 0)));
  foot.appendChild(h("button", { class: "foot-chip love", style: { marginInlineStart: "auto" }, onclick: (ev) => { ev.stopPropagation(); heartFly(ev.clientX, ev.clientY); toggleReact(e, "❤️", card); } }, "❤️ " + __g("أحببتها", "أحببتها")));
  return foot;
}
function renderReacts(row, e, card) {
  clear(row);
  const g = groupReactions(e.reactions);
  for (const [emoji, info] of Object.entries(g))
    row.appendChild(h("button", { class: "react-pill" + (info.mine ? " me" : ""), onclick: (ev) => { ev.stopPropagation(); toggleReact(e, emoji, card); } }, emoji + " " + arNum(info.count)));
}
async function toggleReact(e, emoji, card) {
  sound.react();
  const r = await api.react(e.id, emoji);
  if (r.ok) { e.reactions = r.data.reactions || []; const row = card && card.querySelector(".react-row"); if (row) renderReacts(row, e, card); }
  else toast(r.offline ? "لا اتصال — لم يُحفظ" : "تعذّر");
}

/* ---------------- moment detail (route: moment/:id) ---------------- */
export async function viewMoment(id) {
  const app = clear(document.getElementById("app"));
  app.appendChild(h("div", { class: "topbar" },
    h("button", { class: "icon-btn", "aria-label": "رجوع", onclick: () => (history.length > 1 ? history.back() : go("journal")) }, "→"),
    h("div", { class: "tb-title" }, "لحظة"),
    h("button", { class: "icon-btn", "aria-label": "حذف اللحظة", onclick: () => delMoment(id) }, "🗑️")));
  const content = h("div", { class: "view", style: { paddingTop: "6px" } }, h("div", { class: "empty" }, h("div", { class: "big" }, "🌙"), "نحمّل اللحظة…"));
  app.appendChild(content);
  const r = await api.moment(id);
  if (!r.ok) { clear(content).appendChild(h("div", { class: "empty" }, "تعذّر فتح اللحظة")); return; }
  const e = r.data.moment; const notes = r.data.notes || [];
  const c = clear(content);
  const card = momentCard(e, { detail: true }); c.appendChild(card);

  const bar = h("div", { class: "react-bar" });
  const g = groupReactions(e.reactions);
  REACTIONS.forEach((emo) => {
    const on = g[emo]?.mine;
    bar.appendChild(h("button", { class: "r" + (on ? " on" : ""), onclick: async (ev) => { const btn = ev.currentTarget; heartFly(ev.clientX, ev.clientY); await toggleReact(e, emo, card); btn.classList.toggle("on", !!groupReactions(e.reactions)[emo]?.mine); } }, emo));
  });
  c.appendChild(h("div", { class: "card", style: { padding: "12px 14px", marginBottom: "14px" } }, h("div", { class: "muted", style: { fontWeight: 700, marginBottom: "8px", fontSize: "13px" } }, "تفاعلا:"), bar));

  const thread = h("div", { class: "notes" });
  const paint = (list) => { clear(thread); if (!list.length) thread.appendChild(h("div", { class: "empty", style: { padding: "16px" } }, __g("لسا ما في همسة… قل شي حلو 💛", "لسا ما في همسة… قولي شي حلو 💛"))); list.forEach((n) => thread.appendChild(noteBubble(n))); };
  paint(notes);
  const input = h("input", { class: "field", placeholder: "همسة حبّ…" });
  async function send() { const body = input.value.trim(); if (!body) return; input.value = ""; const r2 = await api.addNote(e.id, body); if (r2.ok) { notes.push(r2.data.note); paint(notes); sound.post(); } else toast("تعذّر الإرسال"); }
  input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") send(); });
  c.appendChild(h("div", { class: "card" }, h("div", { class: "t-h2", style: { marginBottom: "10px" } }, "الهمسات"), thread,
    h("div", { class: "note-composer" }, input, h("button", { class: "btn sm", onclick: send }, __g("أرسل", "أرسلي")))));
}
function noteBubble(n) { const p = PEOPLE[n.author] || PEOPLE.him; return h("div", { class: "note " + p.cls }, h("div", { class: "who-line" }, p.name), n.body); }
async function delMoment(id) { if (!(await confirmAsk("إخفاء هذه اللحظة؟", { okText: "إخفاء", danger: true }))) return; loader(true); const r = await api.del(id); loader(false); if (r.ok) { feedCache = null; toast("أُخفيت"); go("journal"); } else toast("تعذّر"); }

/* ---------------- album ---------------- */
async function renderAlbum(pane) {
  const c = clear(pane);
  const grid = h("div", { class: "album" }); c.appendChild(grid);
  grid.appendChild(h("div", { class: "muted", style: { gridColumn: "1/-1", textAlign: "center", padding: "20px" } }, "نجمع صوركما…"));
  const shots = [];
  let cursor = null, pages = 0;
  do {
    const r = await api.feed(cursor); if (!r.ok) break;
    for (const e of r.data.items) for (const m of (e.media || [])) if ((m.kind === "photo" || m.kind === "video") && m.signed_url) shots.push({ m, id: e.id });
    cursor = r.data.next_cursor; pages++;
  } while (cursor && pages < 6);
  clear(grid);
  if (!shots.length) { grid.appendChild(h("div", { class: "empty-card card", style: { gridColumn: "1/-1" } }, h("div", { class: "big" }, "🖼️"), h("div", { class: "muted" }, "ما في صور بعد — أرفقا صورة بأول لحظة."))); return; }
  shots.forEach(({ m, id }) => {
    const cell = h("button", { class: "album-cell", onclick: () => go("moment/" + id) });
    if (m.kind === "video") { cell.appendChild(h("video", { src: m.signed_url, muted: true, preload: "metadata", playsInline: true })); cell.appendChild(h("span", { class: "vtag" }, "▶")); }
    else cell.appendChild(h("img", { src: m.signed_url, loading: "lazy", alt: "" }));
    grid.appendChild(cell);
  });
}

/* ---------------- timeline ---------------- */
async function renderTimeline(pane) {
  const c = clear(pane);
  const list = h("div", { class: "tl" }); c.appendChild(list);
  list.appendChild(h("div", { class: "empty", style: { padding: "18px" } }, "نحمّل القصة…"));
  const r = await api.timeline();
  clear(list);
  if (!r.ok) { list.appendChild(errorState(() => renderTimeline(pane), { offline: r.offline })); return; }
  const items = r.data.items || [];
  let curMonth = null;
  for (const e of items) {
    const my = monthYear(e.happened_at || e.created_at);
    if (my !== curMonth) { curMonth = my; list.appendChild(h("div", { class: "tl-month" }, my)); }
    const p = PEOPLE[e.author] || PEOPLE.him;
    const row = h("div", { class: "tl-item " + p.cls, "aria-label": "افتح اللحظة", onclick: () => go("moment/" + e.id) },
      h("span", { class: "tl-dot" }),
      h("div", { class: "tl-card" },
        h("div", { class: "m-head", style: { marginBottom: "4px" } }, personChip(e.author), moodChip(e.mood), h("span", { class: "when" }, fullDate(e.happened_at || e.created_at))),
        h("div", { class: "tl-line" }, e.body || (e.media && e.media.length ? "📎 لحظة بالوسائط" : "…"))));
    clickable(row, () => go("moment/" + e.id));
    list.appendChild(row);
  }
  const ded = store.config.dedication, reply = store.config.reply;
  if (ded) {
    list.appendChild(h("div", { class: "tl-month" }, "البداية ✦"));
    list.appendChild(h("div", { class: "tl-item him" }, h("span", { class: "tl-dot" }),
      h("div", { class: "tl-card chapter-zero" }, h("div", { class: "t-h2", style: { marginBottom: "8px" } }, "الإهداء 🤍"),
        h("div", { class: "ded" }, ded), reply ? h("div", { class: "ded reply" }, "— ردُّها: " + reply) : null)));
  }
  if (!items.length && !ded) clear(list).appendChild(h("div", { class: "empty-card card" }, h("div", { class: "big" }, "📖"), h("div", { class: "muted" }, "وهنا تبدأ صفحاتكما.")));
}

/* ---------------- composer ---------------- */
export function openCompose({ onDone } = {}) {
  const draft = { mood: "", media: [], happened_at: "" };
  const err = h("div", { class: "err" });
  const previews = h("div", { class: "m-media compose-prev" });
  const body = h("textarea", { class: "field", rows: 4, placeholder: __g("شو صار اليوم؟ اكتب لحظة تبقى…", "شو صار اليوم؟ اكتبي لحظة تبقى…") });
  const moods = h("div", { class: "chip-wrap" }, ...MOODS.map(([label, emo]) => h("button", { class: "chip", onclick: (e) => { const on = e.currentTarget.classList.contains("rose"); moods.querySelectorAll(".chip").forEach((x) => x.classList.remove("rose")); if (!on) { e.currentTarget.classList.add("rose"); draft.mood = label; } else draft.mood = ""; } }, emo + " " + label)));

  function renderPreviews() {
    clear(previews);
    draft.media.forEach((m, i) => {
      let node;
      if (m.kind === "photo") node = h("img", { class: "m-photo", src: m.preview });
      else if (m.kind === "video") node = h("video", { class: "m-video", src: m.preview, controls: true, preload: "metadata", playsInline: true });
      else if (m.kind === "voice") node = h("div", { class: "voice-pill" }, h("span", { class: "play" }, "🎙️"), h("div", { class: "wave" }, ...waveBars(m.meta.bars)), h("span", { class: "vd" }, arNum(m.meta.duration) + "ث"));
      else node = h("div", { class: "song-pill" }, h("span", { class: "cassette" }, "🎵"), h("div", { class: "meta" }, h("b", {}, m.meta.title || "أغنية"), h("span", { class: "muted" }, m.meta.artist || "")));
      previews.appendChild(h("div", { class: "prev-wrap" }, node, h("button", { class: "prev-x", "aria-label": "إزالة", onclick: () => { draft.media.splice(i, 1); renderPreviews(); } }, "✕")));
    });
  }
  const fileInput = h("input", { type: "file", accept: "image/*", multiple: true, class: "hidden", onchange: async (e) => { const files = [...e.target.files]; if (!files.length) return; e.target.value = ""; loader(true); for (const f of files) { const ds = await downscale(f); draft.media.push({ kind: "photo", blob: ds.blob, contentType: "image/jpeg", preview: URL.createObjectURL(ds.blob) }); } loader(false); renderPreviews(); } });
  const videoInput = h("input", { type: "file", accept: "video/*", class: "hidden", onchange: (e) => { const f = e.target.files[0]; if (!f) return; e.target.value = ""; if (f.size > 52428800) { toast("الفيديو كبير — الحد ٥٠ م.ب"); return; } draft.media.push({ kind: "video", blob: f, contentType: f.type || "video/mp4", preview: URL.createObjectURL(f) }); renderPreviews(); } });
  const rail = h("div", { class: "attach-rail" },
    h("button", { class: "attach", onclick: () => fileInput.click() }, "📷", h("span", {}, "صورة")),
    h("button", { class: "attach", onclick: () => videoInput.click() }, "🎬", h("span", {}, "فيديو")),
    h("button", { class: "attach", onclick: () => recordVoice(draft, renderPreviews) }, "🎙️", h("span", {}, "صوت")),
    h("button", { class: "attach", onclick: () => addSong(draft, renderPreviews) }, "🎵", h("span", {}, "أغنية")));
  const dateInput = h("input", { class: "field", type: "date" });

  async function post() {
    const t = body.value.trim();
    if (!t && !draft.media.length) { err.textContent = __g("اكتب لحظة أو أرفق شيئًا", "اكتبي لحظة أو أرفقي شيئًا"); return; }
    loader(true);
    try {
      const media = [];
      for (const m of draft.media) {
        if (m.kind === "song") { media.push({ kind: "song", url: m.url, meta: m.meta }); continue; }
        const su = await api.signUpload(m.kind, m.contentType); if (!su.ok) throw 0;
        const ok = await uploadSigned(su.data.signedUrl, m.blob, m.contentType); if (!ok) throw 0;
        media.push({ kind: m.kind, path: su.data.path, meta: m.meta || {} });
      }
      const r = await api.addMoment({ body: t, mood: draft.mood || null, happened_at: dateInput.value || undefined, media });
      loader(false);
      if (r.ok) { close(true); sound.post(); sparkleAt(innerWidth / 2, innerHeight / 2, ["🤍", "🌙", "✨", "💗"]); toast("حُفظت لحظتكما 🤍"); onDone && onDone(); }
      else err.textContent = r.data.detail || "تعذّر الحفظ";
    } catch { loader(false); err.textContent = "تعذّر رفع الوسائط"; }
  }
  const { close } = openSheet({
    title: "لحظةٌ جديدة 🌸",
    subtitle: "ستُحفظ باسم " + (PEOPLE[store.person]?.name || ""),
    beforeClose: async () => (!body.value.trim() && !draft.media.length) ? true : await confirmAsk("تترك هذه اللحظة دون حفظ؟", { okText: "اترك", cancelText: "أكمل", danger: true }),
    body: [body, moods, rail, fileInput, videoInput, previews,
      h("label", { class: "lbl" }, "متى حدثت؟ (اختياري)"), dateInput, err,
      h("div", { class: "row-btns", style: { marginTop: "14px" } },
        h("button", { class: "btn ghost", onclick: () => close() }, "إلغاء"),
        h("button", { class: "btn", onclick: post }, __g("احفظ 🤍", "احفظي 🤍")))],
  });
}
function recordVoice(draft, done) {
  const rec = new VoiceRecorder();
  const wave = h("div", { class: "wave big" });
  const timer = h("div", { class: "rec-timer" }, "٠ث");
  let running = false, t0 = 0, iv = null;
  rec.onbars = (bars) => { clear(wave); waveBars(bars).forEach((i) => wave.appendChild(i)); };
  const btn = h("button", { class: "btn", onclick: async () => {
    if (!running) { try { await rec.start(); } catch { toast("لا يمكن الوصول للميكروفون"); return; } running = true; t0 = Date.now(); btn.textContent = "⏹ إيقاف"; iv = setInterval(() => (timer.textContent = arNum(Math.round((Date.now() - t0) / 1000)) + "ث"), 250); }
    else { clearInterval(iv); const out = await rec.stop(); draft.media.push({ kind: "voice", blob: out.blob, contentType: out.mime, meta: { bars: out.bars, duration: out.duration } }); done(); close(); }
  } }, __g("⏺ ابدأ التسجيل", "⏺ ابدئي التسجيل"));
  const { close } = openModal({ title: "همسة صوتية 🎙️", body: [wave, timer, h("div", { style: { height: "10px" } }), btn,
    h("button", { class: "btn ghost", style: { marginTop: "10px" }, onclick: () => { if (running) { clearInterval(iv); rec.stop(); } close(); } }, "إلغاء")] });
}
function addSong(draft, done) {
  const title = h("input", { class: "field", placeholder: "اسم الأغنية" });
  const artist = h("input", { class: "field", placeholder: "المغني/ة" });
  const url = h("input", { class: "field", placeholder: "رابط (اختياري)", inputmode: "url" });
  const { close } = openModal({ title: "أغنية اللحظة 🎵", body: [
    h("label", { class: "lbl" }, "العنوان"), title, h("label", { class: "lbl" }, "المغني/ة"), artist, h("label", { class: "lbl" }, "الرابط"), url,
    h("div", { class: "row-btns", style: { marginTop: "14px" } }, h("button", { class: "btn ghost", onclick: () => close() }, "إلغاء"),
      h("button", { class: "btn", onclick: () => { if (!title.value.trim()) { title.focus(); return; } draft.media.push({ kind: "song", url: url.value.trim(), meta: { title: title.value.trim(), artist: artist.value.trim() } }); done(); close(); } }, __g("أرفق", "أرفقي")))] });
}
