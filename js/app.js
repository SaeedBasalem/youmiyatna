// يومياتنا — app orchestrator: router + views + compose.
import { api, setAuthFailHandler } from "./api.js";
import { store } from "./store.js";
import { sound } from "./sound.js";
import {
  h, $, clear, avatar, personChip, moodChip, toast, confetti, sparkleAt, heartFly,
  relTime, fullDate, monthYear, arNum,
} from "./ui.js";
import { PEOPLE, other, MOODS, moodEmoji, REACTIONS, BADGES, DUA } from "./config.js";
import { downscale, openDoodle, VoiceRecorder, uploadSigned } from "./media.js";

const APP = () => document.getElementById("app");
const go = (route) => { location.hash = "#/" + route; };
function loader(on) {
  let l = $("#loader");
  if (on) { if (!l) document.body.appendChild(h("div", { id: "loader", class: "loader" }, h("div", { class: "spinner" }))); }
  else if (l) l.remove();
}

/* ---------------- boot + router ---------------- */
store.init();
setAuthFailHandler(() => { store.clearAuth(); toast("انتهت الجلسة، افتحا من جديد"); go("lock"); });
window.addEventListener("hashchange", renderRoute);
window.addEventListener("pointerdown", () => sound.resume(), { once: true });
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});

(function boot() {
  if (store.token && store.person) { if (!location.hash) location.hash = "#/feed"; renderRoute(); refreshConfig(); }
  else if (store.token) go("who");
  else go("lock");
  if (!location.hash) renderRoute();
})();

function renderRoute() {
  const parts = (location.hash || "#/lock").replace(/^#\//, "").split("/");
  const route = parts[0] || "lock";
  if (!store.token && route !== "lock") return go("lock");
  if (store.token && !store.person && !["who", "lock"].includes(route)) return go("who");
  switch (route) {
    case "lock": return viewLock();
    case "who": return viewWho();
    case "feed": return shell("feed", viewFeed);
    case "timeline": return shell("timeline", viewTimeline);
    case "milestones": return shell("milestones", viewMilestones);
    case "me": return shell("me", viewMe);
    case "moment": return viewMoment(parts[1]);
    default: return go("feed");
  }
}
async function refreshConfig() {
  const r = await api.bootstrap();
  if (r.ok) { store.setConfig(r.data.config || {}); const bar = $(".topbar"); if (bar && $(".days-badge", bar)) bar.replaceWith(topbar()); }
}

/* ---------------- shell (topbar + tabbar) ---------------- */
function shell(active, viewFn) {
  const app = clear(APP());
  app.appendChild(topbar());
  const content = h("div", { class: "view" });
  app.appendChild(content);
  app.appendChild(tabbar(active));
  viewFn(content);
}
function daysTogether() {
  const a = store.config.anniversary_date; if (!a) return null;
  const now = new Date(Date.now() + 180 * 60000);
  const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ad = new Date(a + "T00:00:00Z");
  const t0 = Date.UTC(ad.getUTCFullYear(), ad.getUTCMonth(), ad.getUTCDate());
  return Math.max(0, Math.round((t - t0) / 86400000));
}
function topbar() {
  const d = daysTogether();
  const badge = h("button", { class: "days-badge", onclick: () => go("milestones") },
    "🌙 معًا منذ ", h("b", {}, d == null ? "—" : arNum(d)), d == null ? "" : " يومًا");
  const snd = h("button", { class: "icon-btn", onclick: (e) => { const on = sound.toggle(); e.currentTarget.textContent = on ? "🔊" : "🔇"; } }, store.soundOn ? "🔊" : "🔇");
  return h("div", { class: "topbar" }, badge, h("span", { class: "spacer" }), snd);
}
function tabbar(active) {
  const tab = (key, ic, label, route) => h("button", { class: "tab" + (active === key ? " active" : ""), onclick: () => { sound.tab(); go(route); } }, h("span", { class: "ic" }, ic), label);
  return h("nav", { class: "tabbar" },
    tab("feed", "🏠", "البيت", "feed"),
    tab("timeline", "📖", "حكايتنا", "timeline"),
    h("button", { class: "tab compose", onclick: () => { sound.tab(); openCompose(); } }, h("span", { class: "plus" }, "＋")),
    tab("milestones", "🏆", "إنجازاتنا", "milestones"),
    tab("me", PEOPLE[store.person]?.initial || "أنا", "أنا", "me"),
  );
}

/* ---------------- lock / who ---------------- */
function viewLock() {
  const app = clear(APP());
  const err = h("div", { class: "err" });
  const pin = h("input", { class: "field pin", type: "password", inputmode: "numeric", placeholder: "••••••••", autocomplete: "off", maxLength: 12 });
  async function submit() {
    sound.resume();
    const pass = pin.value.trim();
    err.textContent = "";
    if (!pass) { err.textContent = "اكتبا كلمة الفتح"; return; }
    loader(true);
    const r = await api.unlock(pass);
    loader(false);
    if (r.ok && r.data.token) { store.setAuth(r.data.token, null); sound.unlock(); go("who"); }
    else if (r.status === 429) { err.textContent = "محاولات كثيرة — انتظرا قليلًا"; sound.error(); }
    else { err.textContent = "كلمة الفتح غير صحيحة"; sound.error(); const card = $(".lock .box"); card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake"); }
  }
  pin.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  app.appendChild(h("div", { class: "lock view" },
    h("div", { class: "bism" }, "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيم"),
    h("div", { class: "brand" }, "يومياتنا"),
    h("div", { class: "tag" }, "عالمٌ صغيرٌ بيننا، نكتبه معًا، ونمضي به إلى رضا الله."),
    h("div", { class: "box" },
      pin,
      h("button", { class: "btn sun", onclick: submit }, "افتحا الكتاب"),
      err,
    ),
  ));
  setTimeout(() => pin.focus(), 50);
}
function viewWho() {
  const app = clear(APP());
  async function pick(person) {
    loader(true);
    const r = await api.chooseIdentity(person);
    loader(false);
    if (r.ok && r.data.token) { store.setAuth(r.data.token, person); sound.unlock(); refreshConfig(); go("feed"); }
    else toast("تعذّر الدخول، حاولا مجددًا");
  }
  app.appendChild(h("div", { class: "lock view" },
    h("div", { class: "brand", style: { fontSize: "40px", textShadow: "4px 4px 0 var(--mint)" } }, "مين معنا؟"),
    h("div", { class: "tag" }, "اختارا أنفسكما — لنعرف صاحب كل لحظة."),
    h("div", { class: "who-cards" },
      h("button", { class: "who-card him", onclick: () => pick("him") }, avatar("him", "lg"), PEOPLE.him.name),
      h("button", { class: "who-card her", onclick: () => pick("her") }, avatar("her", "lg"), PEOPLE.her.name),
    ),
  ));
}

/* ---------------- feed ---------------- */
let feedItems = [];
let feedNode = null;
function groupReactions(rs) {
  const m = {};
  for (const r of rs || []) { (m[r.emoji] = m[r.emoji] || { count: 0, mine: false }).count++; if (r.actor === store.person) m[r.emoji].mine = true; }
  return m;
}
async function viewFeed(content) {
  feedNode = content;
  renderFeed(store.cachedFeed(), null, true);
  const [f, otd] = await Promise.all([api.feed(), api.onThisDay()]);
  if (f.ok) { feedItems = f.data.items || []; store.cacheFeed(feedItems); renderFeed(feedItems, otd.ok ? otd.data.items : []); }
  else if (f.offline) toast("غير متصل — نعرض المحفوظ");
}
function renderFeed(items, otd, loadingCache) {
  if (!feedNode) return;
  const c = clear(feedNode);
  c.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "البيت"),
    h("button", { class: "btn sm ghost", onclick: () => viewFeed(feedNode) }, "↻ تحديث")));
  if (otd && otd.length) {
    for (const e of otd) c.appendChild(momentCard(e, { flashback: true }));
  }
  if (!items || !items.length) {
    c.appendChild(h("div", { class: "empty" },
      h("div", { class: "big" }, "🌙"),
      h("div", {}, loadingCache ? "نحمّل لحظاتكما…" : "الصفحة بيضاء… خلّونا نبدأ حكايتنا."),
      h("div", { class: "dua" }, DUA[0]),
      loadingCache ? null : h("button", { class: "btn sun", style: { width: "auto", marginTop: "6px" }, onclick: () => openCompose() }, "＋ أضف أول لحظة"),
    ));
    return;
  }
  items.forEach((e) => c.appendChild(momentCard(e)));
}
function momentCard(e, opts = {}) {
  const p = PEOPLE[e.author] || PEOPLE.him;
  const card = h("div", { class: "moment " + p.cls + (opts.flashback ? " flashback tilt-none" : "") });
  if (opts.flashback) {
    const years = new Date().getFullYear() - new Date(e.happened_at).getFullYear();
    card.appendChild(h("div", { class: "ribbon" }, "🔁 في مثل هذا اليوم" + (years > 0 ? ` · قبل ${arNum(years)} سنة` : "")));
  }
  card.appendChild(h("div", { class: "m-head" }, personChip(e.author), moodChip(e.mood),
    h("span", { class: "when" }, relTime(e.created_at))));
  if (e.body) card.appendChild(h("div", { class: "m-body" }, e.body));
  const media = mediaBlock(e.media);
  if (media) card.appendChild(media);
  card.appendChild(momentFoot(e, card));
  // double-tap to heart
  card.addEventListener("dblclick", (ev) => { heartFly(ev.clientX, ev.clientY); toggleReact(e, "❤️", card); });
  // tap opens detail (ignore clicks on interactive controls / already in detail)
  card.addEventListener("click", (ev) => { if (opts.detail || ev.target.closest("button,audio,a,.react-pill")) return; go("moment/" + e.id); });
  return card;
}
function mediaBlock(media) {
  if (!media || !media.length) return null;
  const box = h("div", { class: "m-media" });
  for (const m of media) {
    if (m.kind === "photo" && m.signed_url) box.appendChild(h("img", { class: "m-photo", src: m.signed_url, loading: "lazy", alt: "" }));
    else if (m.kind === "voice" && m.signed_url) box.appendChild(voicePill(m));
    else if (m.kind === "song") box.appendChild(songPill(m));
  }
  return box;
}
function voicePill(m) {
  const audio = h("audio", { src: m.signed_url, preload: "none" });
  const bars = (m.meta && m.meta.bars) || Array.from({ length: 28 }, () => 0.3 + Math.random() * 0.5);
  const wave = h("div", { class: "wave" }, ...bars.map((v) => { const i = h("i"); i.style.height = Math.max(10, v * 100) + "%"; return i; }));
  const btn = h("button", { class: "play", onclick: () => { if (audio.paused) { audio.play(); btn.textContent = "⏸"; } else { audio.pause(); btn.textContent = "▶"; } } }, "▶");
  audio.addEventListener("ended", () => (btn.textContent = "▶"));
  return h("div", { class: "voice-pill" }, btn, wave, audio);
}
function songPill(m) {
  const meta = m.meta || {};
  const inner = h("div", { class: "song-pill" }, h("span", { class: "cassette" }, "🎵"),
    h("div", { class: "meta" }, h("b", {}, meta.title || "أغنية اللحظة"), h("span", { class: "muted" }, meta.artist || "")));
  return m.url ? h("a", { href: m.url, target: "_blank", rel: "noreferrer", style: { textDecoration: "none" } }, inner) : inner;
}
function momentFoot(e, card) {
  const foot = h("div", { class: "m-foot" });
  const rrow = h("div", { class: "react-row" });
  renderReacts(rrow, e, card);
  foot.appendChild(rrow);
  foot.appendChild(h("button", { class: "count-chip", onclick: () => go("moment/" + e.id) }, "💬 ", arNum(e.note_count || 0)));
  foot.appendChild(h("button", { class: "btn sm ghost", style: { marginInlineStart: "auto" }, onclick: (ev) => { ev.stopPropagation(); heartFly(ev.clientX, ev.clientY); toggleReact(e, "❤️", card); } }, "❤️ أحببتها"));
  return foot;
}
function renderReacts(row, e, card) {
  clear(row);
  const g = groupReactions(e.reactions);
  for (const [emoji, info] of Object.entries(g)) {
    row.appendChild(h("button", { class: "react-pill" + (info.mine ? " me" : ""), onclick: (ev) => { ev.stopPropagation(); toggleReact(e, emoji, card); } }, emoji + " " + arNum(info.count)));
  }
}
async function toggleReact(e, emoji, card) {
  sound.react();
  const r = await api.react(e.id, emoji);
  if (r.ok) {
    e.reactions = r.data.reactions || [];
    const row = card && card.querySelector(".react-row");
    if (row) renderReacts(row, e, card);
  }
}

/* ---------------- moment detail ---------------- */
async function viewMoment(id) {
  const app = clear(APP());
  app.appendChild(h("div", { class: "topbar" },
    h("button", { class: "icon-btn", onclick: () => history.length > 1 ? history.back() : go("feed") }, "→"),
    h("span", { class: "spacer" }),
    h("button", { class: "icon-btn", onclick: () => delMoment(id) }, "🗑️")));
  const content = h("div", { class: "view" }, h("div", { class: "empty" }, h("div", { class: "big" }, "🌙"), "نحمّل اللحظة…"));
  app.appendChild(content);
  const r = await api.moment(id);
  if (!r.ok) { clear(content).appendChild(h("div", { class: "empty" }, "تعذّر فتح اللحظة")); return; }
  const e = r.data.moment; const notes = r.data.notes || [];
  const c = clear(content);
  const card = momentCard(e, { detail: true }); card.classList.add("tilt-none");
  c.appendChild(card);

  // reaction bar
  const bar = h("div", { class: "react-bar" });
  const g = groupReactions(e.reactions);
  REACTIONS.forEach((emo) => {
    const on = g[emo]?.mine;
    bar.appendChild(h("button", { class: "r" + (on ? " on" : ""), onclick: async (ev) => { const btn = ev.currentTarget, x = ev.clientX, y = ev.clientY; heartFly(x, y); await toggleReact(e, emo, card); const ng = groupReactions(e.reactions); btn.classList.toggle("on", !!ng[emo]?.mine); } }, emo));
  });
  c.appendChild(h("div", { class: "panel", style: { padding: "12px", marginBottom: "14px" } }, h("div", { class: "muted", style: { fontWeight: 700, marginBottom: "4px" } }, "تفاعلا:"), bar));

  // notes
  const thread = h("div", { class: "notes" });
  function paintNotes(list) { clear(thread); if (!list.length) thread.appendChild(h("div", { class: "empty", style: { padding: "20px" } }, "لسا ما في همسة… قولا شي حلو 💛")); list.forEach((n) => thread.appendChild(noteBubble(n))); }
  paintNotes(notes);
  const input = h("input", { class: "field", placeholder: "همسة حبّ…" });
  async function send() {
    const body = input.value.trim(); if (!body) return;
    input.value = "";
    const r2 = await api.addNote(e.id, body);
    if (r2.ok) { notes.push(r2.data.note); paintNotes(notes); sound.post(); thread.lastChild.classList.add("stamp"); }
    else toast("تعذّر الإرسال");
  }
  input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") send(); });
  c.appendChild(h("div", { class: "panel", style: { padding: "12px" } },
    h("div", { class: "t-h2", style: { marginBottom: "10px" } }, "الهمسات"),
    thread,
    h("div", { class: "note-composer" }, input, h("button", { class: "btn her sm", onclick: send }, "أرسلي")),
  ));
}
function noteBubble(n) {
  const p = PEOPLE[n.author] || PEOPLE.him;
  return h("div", { class: "note " + p.cls }, h("div", { class: "who-line" }, p.name), n.body);
}
async function delMoment(id) {
  if (!confirm("إخفاء هذه اللحظة؟ (يمكن استرجاعها)")) return;
  loader(true); const r = await api.del(id); loader(false);
  if (r.ok) { toast("أُخفيت"); go("feed"); } else toast("تعذّر");
}

/* ---------------- timeline ---------------- */
async function viewTimeline(content) {
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "حكايتنا")));
  const list = h("div", { class: "tl" });
  content.appendChild(list);
  list.appendChild(h("div", { class: "empty", style: { padding: "20px" } }, "نحمّل القصة…"));
  const r = await api.timeline();
  clear(list);
  const items = r.ok ? r.data.items : [];
  let curMonth = null;
  for (const e of items) {
    const my = monthYear(e.happened_at);
    if (my !== curMonth) { curMonth = my; list.appendChild(h("div", { class: "tl-month" }, my)); }
    const p = PEOPLE[e.author] || PEOPLE.him;
    list.appendChild(h("div", { class: "tl-item " + p.cls, onclick: () => go("moment/" + e.id) },
      h("div", { class: "tl-card" },
        h("div", { class: "m-head", style: { marginBottom: "6px" } }, personChip(e.author), moodChip(e.mood), h("span", { class: "when" }, fullDate(e.happened_at))),
        h("div", { class: "first-line" }, e.body || (e.media && e.media.length ? "📎 لحظة بالوسائط" : "…")),
      )));
  }
  // chapter zero: the dedication + reply
  const ded = store.config.dedication, reply = store.config.reply;
  if (ded) {
    list.appendChild(h("div", { class: "tl-month" }, "البداية ✦"));
    list.appendChild(h("div", { class: "tl-item him" }, h("div", { class: "tl-card chapter-zero" },
      h("div", { class: "t-h2", style: { marginBottom: "8px" } }, "الإهداء"),
      h("div", { class: "ded" }, ded),
      reply ? h("div", { class: "ded", style: { marginTop: "12px", color: "var(--her)" } }, "— ردُّها: " + reply) : null,
    )));
  }
  if (!items.length && !ded) clear(list).appendChild(h("div", { class: "empty" }, h("div", { class: "big" }, "📖"), "وهنا تبدأ الصفحات."));
}

/* ---------------- milestones ---------------- */
async function viewMilestones(content) {
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "إنجازاتنا")));
  const wrap = h("div", {}); content.appendChild(wrap);
  wrap.appendChild(h("div", { class: "empty", style: { padding: "24px" } }, "نحسب أيّامكما…"));
  const r = await api.milestones();
  if (!r.ok) { clear(wrap).appendChild(h("div", { class: "empty" }, "تعذّر الحساب")); return; }
  const d = r.data; clear(wrap);
  if (d.anniversary_date) {
    wrap.appendChild(h("div", { class: "hero-counter" },
      h("div", { class: "muted", style: { fontWeight: 800 } }, "معًا منذ"),
      h("div", { class: "n" }, arNum(d.days_together)),
      h("div", { style: { fontWeight: 800 } }, "يومًا 💛"),
      h("div", { class: "muted", style: { marginTop: "6px" } }, "منذ " + fullDate(d.anniversary_date)),
    ));
  } else {
    wrap.appendChild(h("div", { class: "hero-counter", style: { background: "var(--paper-panel)" } },
      h("div", { class: "t-h2" }, "متى بدأت حكايتكما؟"),
      h("button", { class: "btn coral", style: { width: "auto", marginTop: "10px" }, onclick: () => go("me") }, "حدّدا تاريخ البداية"),
    ));
  }
  wrap.appendChild(h("div", { class: "stat-row" },
    h("div", { class: "stat fire" }, h("div", { class: "v" }, "🔥 " + arNum(d.streak_current)), h("div", { class: "k" }, "سلسلة الأيّام")),
    h("div", { class: "stat" }, h("div", { class: "v" }, arNum(d.streak_longest)), h("div", { class: "k" }, "أطول سلسلة")),
  ));
  const grid = h("div", { class: "badge-grid" });
  for (const b of d.badges || []) {
    const meta = BADGES[b.key] || { emoji: "⭐", title: b.key, hint: "" };
    grid.appendChild(h("div", { class: "badge" + (b.unlocked ? "" : " locked"), title: meta.hint },
      h("div", { class: "be" }, meta.emoji), h("div", { class: "bt" }, b.unlocked ? meta.title : meta.hint)));
  }
  wrap.appendChild(h("div", { class: "t-h2", style: { margin: "6px 2px" } }, "الأوسمة"));
  wrap.appendChild(grid);
  const t = d.totals || {};
  wrap.appendChild(h("div", { class: "mini-stats" },
    h("span", { class: "chip" }, "📔 " + arNum(t.moments) + " لحظة"),
    h("span", { class: "chip" }, "💬 " + arNum(t.notes) + " همسة"),
    h("span", { class: "chip" }, "🎙️ " + arNum(t.voice)),
    h("span", { class: "chip" }, "🎵 " + arNum(t.songs)),
  ));
  wrap.appendChild(h("div", { class: "empty", style: { padding: "16px", marginTop: "14px" } }, h("div", { class: "dua" }, DUA[Math.floor(d.days_together || 0) % DUA.length])));

  // celebrate newly-unlocked-and-unseen badges (once)
  const fresh = (d.badges || []).filter((b) => b.unlocked && !b.seen);
  if (fresh.length) {
    setTimeout(() => { confetti(); sound.celebrate(); toast("مبروك! " + (BADGES[fresh[0].key]?.title || "وسام جديد")); }, 400);
    fresh.forEach((b) => api.markSeen(b.key));
  }
}

/* ---------------- me / settings ---------------- */
function viewMe(content) {
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "أنا")));
  content.appendChild(h("div", { class: "set-row" }, avatar(store.person, "lg"),
    h("div", {}, h("div", { class: "k" }, PEOPLE[store.person]?.name || ""), h("div", { class: "muted" }, "هذا أنا الآن")),
    h("button", { class: "btn sm ghost", style: { marginInlineStart: "auto" }, onclick: () => go("who") }, "مو أنا؟")));

  const dateInput = h("input", { class: "field", type: "date", value: store.config.anniversary_date || "" });
  content.appendChild(h("div", { class: "set-row", style: { flexWrap: "wrap" } },
    h("div", { class: "k", style: { width: "100%" } }, "تاريخ بدايتنا 💍"),
    dateInput,
    h("button", { class: "btn sm mint", onclick: async () => { const v = dateInput.value; if (!v) return; loader(true); const r = await api.setConfig("anniversary_date", v); loader(false); if (r.ok) { store.setConfig({ anniversary_date: v }); toast("حُفظ 💛"); } } }, "احفظا")));

  content.appendChild(h("div", { class: "set-row" }, h("div", { class: "k" }, "الصوت"),
    h("button", { class: "btn sm ghost", style: { marginInlineStart: "auto" }, onclick: (e) => { const on = sound.toggle(); e.currentTarget.textContent = on ? "🔊 مُفعّل" : "🔇 صامت"; } }, store.soundOn ? "🔊 مُفعّل" : "🔇 صامت")));

  content.appendChild(h("div", { class: "set-row" }, h("div", { class: "k" }, "نسخة احتياطية"),
    h("button", { class: "btn sm ghost", style: { marginInlineStart: "auto" }, onclick: exportJSON }, "⬇ نزّلا JSON")));

  content.appendChild(h("button", { class: "btn ghost", style: { marginTop: "10px" }, onclick: () => { store.clearAuth(); toast("أُقفل الكتاب"); go("lock"); } }, "أقفلا الكتاب"));
}
async function exportJSON() {
  loader(true);
  const [b, f] = await Promise.all([api.bootstrap(), api.feed()]);
  loader(false);
  const data = { config: b.ok ? b.data.config : {}, moments: f.ok ? f.data.items : [], exported_at: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "yawmiyatna.json"; a.click();
  URL.revokeObjectURL(a.href); toast("نُزّلت النسخة 📄");
}

/* ---------------- compose ---------------- */
function openCompose() {
  const draft = { mood: "", media: [], happened_at: "" };
  const err = h("div", { class: "err" });
  const previews = h("div", { class: "m-media", style: { marginTop: "10px" } });
  const bodyInput = h("textarea", { class: "field", rows: 4, placeholder: "شو صار اليوم؟ اكتبا للحظة…" });

  const moodRow = h("div", { class: "mood-row" }, ...MOODS.map(([label, emo]) =>
    h("button", { class: "mood-opt", onclick: (e) => {
      const was = e.currentTarget.classList.contains("sel");
      moodRow.querySelectorAll(".mood-opt").forEach((x) => x.classList.remove("sel"));
      if (!was) { e.currentTarget.classList.add("sel"); draft.mood = label; } else draft.mood = "";
    } }, emo + " " + label)));

  function renderPreviews() {
    clear(previews);
    draft.media.forEach((m, i) => {
      let node;
      if (m.kind === "photo") node = h("img", { class: "m-photo", src: m.preview });
      else if (m.kind === "voice") node = h("div", { class: "voice-pill" }, h("span", { class: "play" }, "🎙️"), h("div", { class: "wave" }, ...(m.meta.bars || []).map((v) => { const i2 = h("i"); i2.style.height = Math.max(10, v * 100) + "%"; return i2; })), arNum(m.meta.duration) + "ث");
      else node = h("div", { class: "song-pill" }, h("span", { class: "cassette" }, "🎵"), h("div", { class: "meta" }, h("b", {}, m.meta.title || "أغنية"), h("span", { class: "muted" }, m.meta.artist || "")));
      previews.appendChild(h("div", { style: { position: "relative" } }, node,
        h("button", { class: "icon-btn", style: { position: "absolute", top: "6px", insetInlineEnd: "6px", width: "32px", height: "32px" }, onclick: () => { draft.media.splice(i, 1); renderPreviews(); } }, "✕")));
    });
  }

  const fileInput = h("input", { type: "file", accept: "image/*", class: "hidden", onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return; e.target.value = "";
    loader(true); const ds = await downscale(f); loader(false);
    const edited = await openDoodle(ds.blob);
    const blob = edited || ds.blob;
    draft.media.push({ kind: "photo", blob, contentType: "image/jpeg", preview: URL.createObjectURL(blob) });
    renderPreviews();
  } });

  const rail = h("div", { class: "attach-rail" },
    h("button", { class: "attach", onclick: () => fileInput.click() }, h("span", { class: "ic" }, "📷"), "صورة"),
    h("button", { class: "attach", onclick: () => recordVoice(draft, renderPreviews) }, h("span", { class: "ic" }, "🎙️"), "صوت"),
    h("button", { class: "attach", onclick: () => addSong(draft, renderPreviews) }, h("span", { class: "ic" }, "🎵"), "أغنية"),
  );

  const dateInput = h("input", { class: "field", type: "date" });

  async function post() {
    const body = bodyInput.value.trim();
    if (!body && !draft.media.length) { err.textContent = "اكتبا لحظة أو أرفقا شيئًا"; return; }
    loader(true);
    try {
      const media = [];
      for (const m of draft.media) {
        if (m.kind === "song") { media.push({ kind: "song", url: m.url, meta: m.meta }); continue; }
        const su = await api.signUpload(m.kind, m.contentType);
        if (!su.ok) throw new Error("sign");
        const ok = await uploadSigned(su.data.signedUrl, m.blob, m.contentType);
        if (!ok) throw new Error("upload");
        media.push({ kind: m.kind, path: su.data.path, meta: m.meta || {} });
      }
      const r = await api.addMoment({ body, mood: draft.mood || null, happened_at: dateInput.value || undefined, media });
      loader(false);
      if (r.ok) { scrim.remove(); sound.post(); const x = innerWidth / 2, y = innerHeight / 2; sparkleAt(x, y); go("feed"); renderRoute(); toast("أُضيفت لحظتكما 🌙"); }
      else err.textContent = r.data.detail || "تعذّر الحفظ";
    } catch (e2) { loader(false); err.textContent = "تعذّر رفع الوسائط"; }
  }

  const scrim = h("div", { class: "scrim" },
    h("div", { class: "sheet" },
      h("div", { class: "sheet-grab" }),
      h("h3", {}, "لحظةٌ جديدة"),
      h("div", { class: "muted", style: { textAlign: "center", marginBottom: "6px" } }, "ستظهر باسم ", PEOPLE[store.person]?.name || ""),
      moodRow,
      bodyInput,
      rail, fileInput, previews,
      h("label", { class: "lbl" }, "متى حدثت؟ (اختياري)"), dateInput,
      err,
      h("div", { class: "attach-rail", style: { marginTop: "14px" } },
        h("button", { class: "btn ghost", onclick: () => scrim.remove() }, "إلغاء"),
        h("button", { class: "btn sun", onclick: post }, "انشراها 🌙"),
      ),
    ));
  scrim.addEventListener("click", (e) => { if (e.target === scrim) scrim.remove(); });
  document.body.appendChild(scrim);
}

function recordVoice(draft, done) {
  const rec = new VoiceRecorder();
  const wave = h("div", { class: "wave", style: { height: "40px" } });
  const timer = h("div", { class: "num", style: { fontSize: "28px" } }, "٠ث");
  let running = false, t0 = 0, iv = null;
  rec.onbars = (bars) => { clear(wave); bars.forEach((v) => { const i = h("i"); i.style.height = Math.max(10, v * 100) + "%"; wave.appendChild(i); }); };
  const btn = h("button", { class: "btn coral", onclick: async () => {
    if (!running) {
      try { await rec.start(); } catch { toast("لا يمكن الوصول للميكروفون"); return; }
      running = true; t0 = Date.now(); btn.textContent = "⏹ إيقاف";
      iv = setInterval(() => (timer.textContent = arNum(Math.round((Date.now() - t0) / 1000)) + "ث"), 250);
    } else {
      clearInterval(iv); const out = await rec.stop();
      draft.media.push({ kind: "voice", blob: out.blob, contentType: out.mime, meta: { bars: out.bars, duration: out.duration } });
      done(); sc.remove();
    }
  } }, "⏺ ابدآ التسجيل");
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" },
    h("h3", {}, "همسة صوتية 🎙️"), wave, timer,
    h("div", { style: { height: "10px" } }), btn,
    h("button", { class: "btn ghost", style: { marginTop: "10px" }, onclick: () => { if (running) { clearInterval(iv); rec.stop(); } sc.remove(); } }, "إلغاء")));
  document.body.appendChild(sc);
}

function addSong(draft, done) {
  const title = h("input", { class: "field", placeholder: "اسم الأغنية" });
  const artist = h("input", { class: "field", placeholder: "المغني/ة" });
  const url = h("input", { class: "field", placeholder: "رابط (اختياري)", inputmode: "url" });
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" },
    h("h3", {}, "أغنية اللحظة 🎵"),
    h("label", { class: "lbl" }, "العنوان"), title,
    h("label", { class: "lbl" }, "المغني/ة"), artist,
    h("label", { class: "lbl" }, "الرابط"), url,
    h("div", { class: "attach-rail", style: { marginTop: "14px" } },
      h("button", { class: "btn ghost", onclick: () => sc.remove() }, "إلغاء"),
      h("button", { class: "btn her", onclick: () => { if (!title.value.trim()) { title.focus(); return; } draft.media.push({ kind: "song", url: url.value.trim(), meta: { title: title.value.trim(), artist: artist.value.trim() } }); done(); sc.remove(); } }, "أرفقاها"),
    )));
  document.body.appendChild(sc);
}
