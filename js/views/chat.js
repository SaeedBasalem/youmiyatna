// يومياتنا — همس: private chat (text / photo / voice) + "thinking of you" tap.
// Near-real-time via light polling while the view is open (robust, no socket dependency).
import { h, $, clear, arNum, toast, heartFly, sparkleAt } from "../ui.js";
import { api } from "../api.js";
import { store } from "../store.js";
import { sound } from "../sound.js";
import { PEOPLE, other } from "../config.js";
import { downscale, VoiceRecorder, uploadSigned } from "../media.js";
import { openModal, ensureSigned } from "../helpers.js";

let msgs = [], scroller = null, pollTimer = null, lastCount = 0;

const isChatActive = () => (location.hash || "").replace(/^#\//, "").split("/")[0] === "chat";

export async function viewChat(content) {
  content.classList.add("chat-view");
  content.appendChild(h("div", { class: "chat-top" },
    h("div", { class: "chat-who" },
      h("span", { class: `avatar ${other(store.person)}` }, PEOPLE[other(store.person)].initial),
      h("div", {}, h("div", { class: "cw-name" }, PEOPLE[other(store.person)].name), h("div", { class: "cw-sub muted" }, "همسٌ بينكما وحدكما 🤍"))),
    h("button", { class: "think-btn", onclick: thinkingOfYou }, "💭")));
  scroller = h("div", { class: "chat-scroll" }, h("div", { class: "muted", style: { textAlign: "center", padding: "24px" } }, "…"));
  content.appendChild(scroller);
  content.appendChild(composer());
  await load(true);
  startPoll();
}

async function load(scroll) {
  const r = await api.messages();
  if (r.ok) { msgs = await withSigned(r.data.items || []); lastCount = msgs.length; render(); if (scroll) scrollBottom(); api.markRead(); }
  else toast("تعذّر تحميل الهمس");
}
async function withSigned(items) {
  const need = items.filter((m) => (m.kind === "image" || m.kind === "voice") && !m.signed_url && m.path).map((m) => m.path);
  if (!need.length) return items;
  const map = await ensureSigned(need);
  return items.map((m) => (m.path && map[m.path] ? { ...m, signed_url: map[m.path] } : m));
}

function startPoll() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!isChatActive()) { clearInterval(pollTimer); return; }
    const r = await api.messages();
    if (r.ok) {
      const items = await withSigned(r.data.items || []);
      const incoming = items.length !== lastCount || (items.length && msgs.length && items[items.length - 1].id !== msgs[msgs.length - 1]?.id) || items.some((m, i) => m.read_at !== msgs[i]?.read_at);
      if (incoming) { const grew = items.length > lastCount; msgs = items; lastCount = items.length; render(); if (grew) { scrollBottom(); sound.react(); api.markRead(); } }
    }
  }, 4000);
}

function render() {
  clear(scroller);
  if (!msgs.length) { scroller.appendChild(h("div", { class: "empty", style: { margin: "auto" } }, h("div", { class: "big" }, "💬"), h("div", {}, __g("لا رسائل بعد… ابدأ الهمس 💛", "لا رسائل بعد… ابدئي الهمس 💛")))); return; }
  let lastDay = null;
  for (const m of msgs) {
    const day = new Date(m.created_at).toDateString();
    if (day !== lastDay) { lastDay = day; scroller.appendChild(h("div", { class: "chat-day" }, dayLabel(m.created_at))); }
    scroller.appendChild(bubble(m));
  }
}
function dayLabel(iso) { try { return new Date(iso).toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long" }); } catch { return ""; } }
function timeShort(iso) { try { return new Date(iso).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } }

function bubble(m) {
  const mine = m.sender === store.person;
  const think = m.kind === "text" && m.body && m.body.startsWith("💭");
  const b = h("div", { class: "chat-msg " + (mine ? "mine" : "theirs") + " " + m.sender + (m._pending ? " pending" : "") + (think ? " think" : "") });
  if (m.kind === "image" && m.signed_url) b.appendChild(h("img", { class: "chat-img", src: m.signed_url, loading: "lazy", alt: "", onclick: () => openModal({ body: [h("img", { src: m.signed_url, style: { borderRadius: "14px", width: "100%" } })], wide: true }) }));
  else if (m.kind === "voice" && m.signed_url) b.appendChild(voiceMini(m));
  else b.appendChild(h("div", { class: "chat-text" }, m.body));
  const tick = mine ? (m.read_at ? " ✓✓" : " ✓") : "";
  b.appendChild(h("div", { class: "chat-meta" }, timeShort(m.created_at) + tick));
  return b;
}
function voiceMini(m) {
  const audio = h("audio", { src: m.signed_url, preload: "none" });
  const dur = (m.meta && m.meta.duration) || 0;
  const btn = h("button", { class: "vm-play", onclick: () => { if (audio.paused) { audio.play(); btn.textContent = "⏸"; } else { audio.pause(); btn.textContent = "▶"; } } }, "▶");
  audio.addEventListener("ended", () => (btn.textContent = "▶"));
  return h("div", { class: "voice-mini" }, btn, h("span", { class: "vm-dur" }, "🎙️ " + arNum(dur) + "ث"), audio);
}

function composer() {
  const input = h("textarea", { class: "chat-input", rows: 1, placeholder: __g("اكتب همسة…", "اكتبي همسة…") });
  input.addEventListener("input", () => autoGrow(input));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(input); } });
  const fileInput = h("input", { type: "file", accept: "image/*", class: "hidden", onchange: (e) => onImage(e) });
  return h("div", { class: "chat-composer" },
    h("button", { class: "c-att", onclick: () => fileInput.click() }, "📷"),
    h("button", { class: "c-att", onclick: () => recordVoice() }, "🎙️"),
    input, fileInput,
    h("button", { class: "c-send", onclick: () => sendText(input) }, "➤"));
}
function autoGrow(el) { el.style.height = "auto"; el.style.height = Math.min(120, el.scrollHeight) + "px"; }
function scrollBottom() { setTimeout(() => { if (scroller) scroller.scrollTop = scroller.scrollHeight; }, 30); }

async function sendText(input) {
  const body = input.value.trim(); if (!body) return;
  input.value = ""; autoGrow(input);
  const temp = { id: "tmp" + Date.now(), sender: store.person, kind: "text", body, created_at: new Date().toISOString(), read_at: null, _pending: true };
  msgs.push(temp); render(); scrollBottom(); sound.post();
  const r = await api.sendMessage({ kind: "text", body });
  if (r.ok) { const i = msgs.indexOf(temp); if (i >= 0) msgs[i] = r.data.message; lastCount = msgs.length; render(); scrollBottom(); }
  else { toast("تعذّر الإرسال"); }
}
async function onImage(e) {
  const f = e.target.files[0]; if (!f) return; e.target.value = "";
  try {
    const ds = await downscale(f, 1400);
    const su = await api.signUpload("photo", "image/jpeg"); if (!su.ok) throw 0;
    await uploadSigned(su.data.signedUrl, ds.blob, "image/jpeg");
    const r = await api.sendMessage({ kind: "image", path: su.data.path });
    if (r.ok) { msgs.push((await withSigned([r.data.message]))[0]); lastCount = msgs.length; render(); scrollBottom(); sound.post(); }
  } catch { toast("تعذّرت الصورة"); }
}
function recordVoice() {
  const rec = new VoiceRecorder(); let running = false, t0 = 0, iv = null;
  const wave = h("div", { class: "wave big" });
  const timer = h("div", { class: "rec-timer" }, "٠ث");
  rec.onbars = (bars) => { clear(wave); bars.forEach((v) => { const i = h("i"); i.style.height = Math.max(12, v * 100) + "%"; wave.appendChild(i); }); };
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
    const r = await api.sendMessage({ kind: "voice", path: su.data.path, meta: { duration: out.duration, bars: out.bars } });
    if (r.ok) { msgs.push((await withSigned([r.data.message]))[0]); lastCount = msgs.length; render(); scrollBottom(); sound.post(); }
  } catch { toast("تعذّر الصوت"); }
}

async function thinkingOfYou(ev) {
  heartFly(ev.clientX, ev.clientY);
  sparkleAt(ev.clientX, ev.clientY, ["💭", "💗", "🤍", "✨"]);
  sound.react();
  const body = "💭 " + __g("يفكّر فيكِ الآن…", "تفكّر فيك الآن…");
  const temp = { id: "tmp" + Date.now(), sender: store.person, kind: "text", body, created_at: new Date().toISOString(), read_at: null, _pending: true };
  msgs.push(temp); render(); scrollBottom();
  const r = await api.sendMessage({ kind: "text", body });
  if (r.ok) { const i = msgs.indexOf(temp); if (i >= 0) msgs[i] = r.data.message; lastCount = msgs.length; render(); scrollBottom(); toast("وصلَتها لمستك 💭"); }
  else toast("تعذّر الإرسال");
}
