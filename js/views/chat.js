// يومياتنا — همس: private chat (text / photo / voice) + "thinking of you" tap.
// Near-real-time via light polling that pauses when the tab is hidden (battery/data friendly).
// Messages reconcile by client id so a just-sent bubble never vanishes when a poll lands.
import { h, $, clear, arNum, toast, heartFly, sparkleAt, waveBars } from "../ui.js";
import { api } from "../api.js";
import { store } from "../store.js";
import { sound } from "../sound.js";
import { PEOPLE, other } from "../config.js";
import { downscale, VoiceRecorder, uploadSigned } from "../media.js";
import { openModal, openSheet, ensureSigned } from "../helpers.js";
import { openLightbox } from "../lightbox.js";
import { attachLongPress } from "../gestures.js";
import { haptic } from "../haptics.js";

let msgs = [], scroller = null, pollTimer = null, seen = new Set(), lastSig = "";
// Our own most recent reaction state per message, with the moment we set it.
// A poll's response can be older than it looks — the request may have been sent
// before we toggled and answered after — so any snapshot fetched earlier than
// our last local write loses to it. Without this the pill flickers back on.
const rLocal = new Map();      // id -> { reactions, at }
function mergeLocalReactions(list, t0) {
  for (const m of list) {
    const loc = rLocal.get(m.id);
    if (!loc) continue;
    if (loc.at > t0) m.reactions = loc.reactions;   // our write is newer than this fetch
    else rLocal.delete(m.id);                       // the server snapshot already has it
  }
  return list;
}

const isChatActive = () => (location.hash || "").replace(/^#\//, "").split("/")[0] === "chat";
const cid = () => "c" + Date.now() + Math.random().toString(36).slice(2, 7);
const REACTS = ["❤️", "🤍", "😂", "🥹", "😮", "🤲", "🔥"];
// the fingerprint carries reactions too, so a poll notices them landing
const rsig = (m) => Object.entries(m.reactions || {}).map(([e, w]) => e + (w || []).join("")).sort().join("");
const sig = (server) => server.map((m) => m.id + (m.read_at ? "1" : "0") + rsig(m)).join("|");

// resume immediately when the couple returns to the tab (bound once)
document.addEventListener("visibilitychange", () => { if (!document.hidden && isChatActive()) load(false); });

export async function viewChat(content) {
  content.classList.add("chat-view");
  content.appendChild(h("div", { class: "chat-top" },
    h("div", { class: "chat-who" },
      h("span", { class: `avatar ${other(store.person)}` }, PEOPLE[other(store.person)].initial),
      h("div", {}, h("div", { class: "cw-name" }, PEOPLE[other(store.person)].name), h("div", { class: "cw-sub muted" }, "همسٌ بينكما وحدكما 🤍"))),
    h("button", { class: "think-btn", "aria-label": "أخبرها أنك تفكّر فيها", onclick: thinkingOfYou }, "💭")));
  scroller = h("div", { class: "chat-scroll" }, h("div", { class: "muted", style: { textAlign: "center", padding: "24px" } }, "…"));
  content.appendChild(scroller);
  content.appendChild(composer());
  await load(true);
  startPoll();
}

async function load(scroll) {
  const t0 = Date.now();
  const r = await api.messages();
  if (r.ok) {
    const server = mergeLocalReactions(await withSigned(r.data.items || []), t0);
    seen = new Set(server.map((m) => m.id));
    lastSig = sig(server);
    // keep any still-pending optimistic bubbles on top of the fresh server list
    const serverIds = new Set(server.map((m) => m.id));
    const pend = msgs.filter((m) => m._pending && !serverIds.has(m.id));
    msgs = server.concat(pend);
    render(); if (scroll) scrollBottom(); api.markRead();
  } else if (!msgs.length) { clear(scroller).appendChild(h("div", { class: "empty" }, h("div", { class: "big" }, "😔"), h("div", {}, "تعذّر تحميل الهمس"), h("button", { class: "btn soft sm", onclick: () => load(true) }, "أعد المحاولة ↻"))); }
}
async function withSigned(items) {
  const need = items.filter((m) => (m.kind === "image" || m.kind === "voice") && !m.signed_url && m.path).map((m) => m.path);
  if (!need.length) return items;
  const map = await ensureSigned(need);
  return items.map((m) => (m.path && map[m.path] ? { ...m, signed_url: map[m.path] } : m));
}

function startPoll() { clearInterval(pollTimer); pollTimer = setInterval(poll, 4000); }
async function poll() {
  if (!isChatActive()) { clearInterval(pollTimer); pollTimer = null; return; }
  if (document.hidden) return;                       // no work while backgrounded
  const t0 = Date.now();
  const r = await api.messages();
  if (!r.ok) return;
  const server = mergeLocalReactions(await withSigned(r.data.items || []), t0);
  const s = sig(server);
  const hasPending = msgs.some((m) => m._pending);
  if (s === lastSig && !hasPending) return;          // nothing changed
  const newFromOther = server.some((m) => !seen.has(m.id) && m.sender !== store.person);
  // a reaction landing on one of my whispers deserves its own small sound
  const before = new Map(msgs.map((m) => [m.id, rsig(m)]));
  const newReact = server.some((m) => before.has(m.id) && before.get(m.id) !== rsig(m));
  server.forEach((m) => seen.add(m.id));
  lastSig = s;
  const serverIds = new Set(server.map((m) => m.id));
  const pend = msgs.filter((m) => m._pending && !serverIds.has(m.id));
  msgs = server.concat(pend);
  render();
  if (newFromOther) { scrollBottom(); sound.react(); api.markRead(); }
  else if (newReact) sound.heart();
}

function render() {
  // If they were already reading the newest whisper, keep them there: a landing
  // reaction makes a bubble taller and would otherwise push it under the composer.
  const stick = scroller ? scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 60 : false;
  clear(scroller);
  if (!msgs.length) { scroller.appendChild(h("div", { class: "empty", style: { margin: "auto" } }, h("div", { class: "big" }, "💬"), h("div", {}, __g("لا رسائل بعد… ابدأ الهمس 💛", "لا رسائل بعد… ابدئي الهمس 💛")))); return; }
  let lastDay = null;
  for (const m of msgs) {
    const day = new Date(m.created_at).toDateString();
    if (day !== lastDay) { lastDay = day; scroller.appendChild(h("div", { class: "chat-day" }, dayLabel(m.created_at))); }
    scroller.appendChild(bubble(m));
  }
  if (stick) scrollBottom();
}
function dayLabel(iso) { try { return new Date(iso).toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long" }); } catch { return ""; } }
function timeShort(iso) { try { return new Date(iso).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } }

function bubble(m) {
  const mine = m.sender === store.person;
  const think = m.kind === "text" && m.body && m.body.startsWith("💭");
  const b = h("div", { class: "chat-msg " + (mine ? "mine" : "theirs") + " " + m.sender + (m._pending ? " pending" : "") + (m._failed ? " failed" : "") + (think ? " think" : "") });
  if (m.kind === "image" && m.signed_url) b.appendChild(h("img", { class: "chat-img", src: m.signed_url, loading: "lazy", alt: "صورة", onclick: () => openLightbox([{ url: m.signed_url }]) }));
  else if (m.kind === "voice" && m.signed_url) b.appendChild(voiceMini(m));
  else b.appendChild(h("div", { class: "chat-text" }, m.body));
  const tick = mine ? (m._failed ? " ⚠︎" : m.read_at ? " ✓✓" : " ✓") : "";
  b.appendChild(h("div", { class: "chat-meta" }, timeShort(m.created_at) + tick));
  const pills = reactionPills(m);
  if (pills) b.appendChild(pills);
  if (!m._pending && !m._failed && !String(m.id).startsWith("tmp")) {
    // double-tap sends a heart; press-and-hold opens the whole little row
    b.addEventListener("click", () => {
      if (b._held) { b._held = false; return; }
      const now = Date.now();
      if (now - (b._tap || 0) < 320) { b._tap = 0; react(m, "❤️"); } else b._tap = now;
    });
    attachLongPress(b, () => { b._held = true; openReactPicker(m); });
  }
  return b;
}

function reactionPills(m) {
  const map = m.reactions || {};
  const keys = Object.keys(map).filter((k) => (map[k] || []).length);
  if (!keys.length) return null;
  const row = h("div", { class: "react-row" });
  for (const e of keys) {
    const who = map[e] || [];
    row.appendChild(h("button", {
      class: "react-pill" + (who.includes(store.person) ? " mine" : ""),
      title: who.map((x) => (PEOPLE[x] || {}).name || "").join(" و "),
      onclick: (ev) => { ev.stopPropagation(); react(m, e); },
    }, h("span", {}, e), who.length > 1 ? h("b", {}, arNum(who.length)) : null));
  }
  return row;
}

function openReactPicker(m) {
  haptic.soft();
  const map = m.reactions || {};
  const { close } = openSheet({
    title: "كيف وصلتكما؟",
    subtitle: "لمسةٌ صغيرة تقول الكثير 🤍",
    body: [h("div", { class: "react-picker" }, ...REACTS.map((e) =>
      h("button", {
        class: "rp-btn" + (((map[e] || []).includes(store.person)) ? " on" : ""),
        onclick: () => { close(); react(m, e); },
      }, e)))],
  });
}

// Optimistic, and it rolls back if the write never lands — a pill must never
// claim a touch the other one will never see.
async function react(m, emoji) {
  const id = m.id;
  const find = () => msgs.find((x) => x.id === id);
  const target = find(); if (!target) return;
  const before = target.reactions;
  const map = JSON.parse(JSON.stringify(before || {}));
  const who = Array.isArray(map[emoji]) ? map[emoji] : [];
  const had = who.includes(store.person);
  const next = had ? who.filter((x) => x !== store.person) : who.concat(store.person);
  if (next.length) map[emoji] = next; else delete map[emoji];
  target.reactions = map;
  rLocal.set(id, { reactions: map, at: Date.now() });
  render();
  if (had) haptic.soft(); else { sound.react(); haptic.tap(); }
  const r = await api.reactMessage(id, emoji);
  const cur = find(); if (!cur) return;              // a poll retired it mid-flight
  if (r.ok && r.data.reactions) {
    cur.reactions = r.data.reactions;
    rLocal.set(id, { reactions: r.data.reactions, at: Date.now() });
    lastSig = sig(msgs.filter((x) => !x._pending));
    render();
  } else {
    cur.reactions = before;
    rLocal.set(id, { reactions: before, at: Date.now() });
    render();
    toast(r.offline ? "لا يوجد اتصال — لم يُرسل التفاعل" : "تعذّر التفاعل");
  }
}

function voiceMini(m) {
  const audio = h("audio", { src: m.signed_url, preload: "none" });
  const dur = (m.meta && m.meta.duration) || 0;
  const btn = h("button", { class: "vm-play", "aria-label": "تشغيل", onclick: () => { if (audio.paused) { audio.play(); btn.textContent = "⏸"; } else { audio.pause(); btn.textContent = "▶"; } } }, "▶");
  audio.addEventListener("ended", () => (btn.textContent = "▶"));
  return h("div", { class: "voice-mini" }, btn, h("span", { class: "vm-dur" }, "🎙️ " + arNum(dur) + "ث"), audio);
}

function composer() {
  const input = h("textarea", { class: "chat-input", rows: 1, "aria-label": "اكتب همسة", placeholder: __g("اكتب همسة…", "اكتبي همسة…") });
  input.addEventListener("input", () => autoGrow(input));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(input); } });
  const fileInput = h("input", { type: "file", accept: "image/*", class: "hidden", onchange: (e) => onImage(e) });
  return h("div", { class: "chat-composer" },
    h("button", { class: "c-att", "aria-label": "أرسل صورة", onclick: () => fileInput.click() }, "📷"),
    h("button", { class: "c-att", "aria-label": "سجّل همسة صوتية", onclick: () => recordVoice() }, "🎙️"),
    input, fileInput,
    h("button", { class: "c-send", "aria-label": "إرسال", onclick: () => sendText(input) }, "➤"));
}
function autoGrow(el) { el.style.height = "auto"; el.style.height = Math.min(120, el.scrollHeight) + "px"; }
function scrollBottom() { setTimeout(() => { if (scroller) scroller.scrollTop = scroller.scrollHeight; }, 30); }

// reconcile an optimistic bubble with the server's confirmed message (by client id)
async function confirmSend(temp, r) {
  if (!r.ok) { temp._pending = false; temp._failed = true; render(); toast("تعذّر الإرسال"); return; }
  const real = (await withSigned([r.data.message]))[0];
  const idx = msgs.findIndex((m) => m.cid && m.cid === temp.cid);
  if (idx >= 0) msgs[idx] = real; else if (!msgs.some((m) => m.id === real.id)) msgs.push(real);
  if (real.id) { seen.add(real.id); lastSig = sig(msgs.filter((m) => !m._pending)); }
  render(); scrollBottom();
}

async function sendText(input) {
  const body = input.value.trim(); if (!body) return;
  input.value = ""; autoGrow(input);
  const temp = { id: "tmp" + Date.now(), cid: cid(), sender: store.person, kind: "text", body, created_at: new Date().toISOString(), read_at: null, _pending: true };
  msgs.push(temp); render(); scrollBottom(); sound.post();
  confirmSend(temp, await api.sendMessage({ kind: "text", body }));
}
async function onImage(e) {
  const f = e.target.files[0]; if (!f) return; e.target.value = "";
  try {
    const ds = await downscale(f, 1400);
    const su = await api.signUpload("photo", "image/jpeg"); if (!su.ok) throw 0;
    await uploadSigned(su.data.signedUrl, ds.blob, "image/jpeg");
    const temp = { id: "tmp" + Date.now(), cid: cid(), sender: store.person, kind: "image", signed_url: URL.createObjectURL(ds.blob), created_at: new Date().toISOString(), read_at: null, _pending: true };
    msgs.push(temp); render(); scrollBottom(); sound.post();
    confirmSend(temp, await api.sendMessage({ kind: "image", path: su.data.path, meta: { w: ds.width, h: ds.height } }));
  } catch { toast("تعذّرت الصورة"); }
}
function recordVoice() {
  const rec = new VoiceRecorder(); let running = false, t0 = 0, iv = null;
  const wave = h("div", { class: "wave big" });
  const timer = h("div", { class: "rec-timer" }, "٠ث");
  rec.onbars = (bars) => { clear(wave); waveBars(bars).forEach((i) => wave.appendChild(i)); };
  const btn = h("button", { class: "btn", onclick: async () => {
    if (!running) { try { await rec.start(); } catch { toast("لا يمكن الوصول للميكروفون"); return; } running = true; t0 = Date.now(); btn.textContent = "⏹ إيقاف"; iv = setInterval(() => (timer.textContent = arNum(Math.round((Date.now() - t0) / 1000)) + "ث"), 250); }
    else { clearInterval(iv); const out = await rec.stop(); close(); await sendVoice(out); }
  } }, __g("⏺ ابدأ التسجيل", "⏺ ابدئي التسجيل"));
  const { close } = openModal({ title: "همسة صوتية 🎙️", body: [wave, timer, h("div", { style: { height: "10px" } }), btn,
    h("button", { class: "btn ghost", style: { marginTop: "10px" }, onclick: () => { if (running) { clearInterval(iv); rec.stop(); } close(); } }, "إلغاء")] });
}
async function sendVoice(out) {
  try {
    const mime = out.mime && out.mime.startsWith("audio/") ? out.mime : "audio/webm";
    const su = await api.signUpload("voice", mime); if (!su.ok) throw 0;
    await uploadSigned(su.data.signedUrl, out.blob, mime);
    const temp = { id: "tmp" + Date.now(), cid: cid(), sender: store.person, kind: "voice", signed_url: URL.createObjectURL(out.blob), meta: { duration: out.duration, bars: out.bars }, created_at: new Date().toISOString(), read_at: null, _pending: true };
    msgs.push(temp); render(); scrollBottom(); sound.post();
    confirmSend(temp, await api.sendMessage({ kind: "voice", path: su.data.path, meta: { duration: out.duration, bars: out.bars } }));
  } catch { toast("تعذّر الصوت"); }
}

async function thinkingOfYou(ev) {
  heartFly(ev.clientX, ev.clientY);
  sparkleAt(ev.clientX, ev.clientY, ["💭", "💗", "🤍", "✨"]);
  sound.react();
  const body = "💭 " + __g("يفكّر فيكِ الآن…", "تفكّر فيك الآن…");
  const temp = { id: "tmp" + Date.now(), cid: cid(), sender: store.person, kind: "text", body, created_at: new Date().toISOString(), read_at: null, _pending: true };
  msgs.push(temp); render(); scrollBottom();
  const r = await api.sendMessage({ kind: "text", body });
  await confirmSend(temp, r);
  if (r.ok) toast("وصلَتها لمستك 💭");
}
