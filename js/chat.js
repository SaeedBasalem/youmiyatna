// يومياتنا — همس: private live chat (text / voice / image, typing, read receipts).
import { h, $, clear, arNum, toast } from "./ui.js";
import { api } from "./api.js";
import { store } from "./store.js";
import { sound } from "./sound.js";
import { realtime } from "./realtime.js";
import { downscale, VoiceRecorder, uploadSigned } from "./media.js";

let msgs = [], scroller = null, olderCursor = null;
let typing = false, typingTimer = null;

export function isChatActive() { return (location.hash || "").replace(/^#\//, "").split("/")[0] === "chat"; }

export async function viewChat(content) {
  content.classList.add("chat-view");
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "همس")));
  scroller = h("div", { class: "chat-scroll" }, h("div", { class: "muted", style: { textAlign: "center", padding: "24px" } }, "…"));
  content.appendChild(scroller);
  content.appendChild(h("div", { class: "chat-footer" },
    h("div", { class: "typing hidden", id: "typing" }, h("i"), h("i"), h("i")),
    composer()));
  const r = await api.messages();
  if (r.ok) { msgs = r.data.items || []; olderCursor = r.data.older_cursor; render(); }
  else { toast("تعذّر تحميل الهمس"); }
  await api.markRead(); realtime.broadcast("read");
  scrollBottom();
}

function render() {
  clear(scroller);
  if (!msgs.length) { scroller.appendChild(h("div", { class: "empty", style: { margin: "auto" } }, h("div", { class: "big" }, "💬"), h("div", {}, "لا رسائل بعد… ابدآ الهمس 💛"))); return; }
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
  const b = h("div", { class: "chat-msg " + (mine ? "mine" : "theirs") + " " + m.sender + (m._pending ? " pending" : "") });
  if (m.kind === "image" && m.signed_url) b.appendChild(h("img", { class: "chat-img", src: m.signed_url, loading: "lazy", alt: "" }));
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
  const input = h("textarea", { class: "chat-input", rows: 1, placeholder: "اكتبا همسة…" });
  input.addEventListener("input", () => { autoGrow(input); onTyping(); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(input); } });
  const fileInput = h("input", { type: "file", accept: "image/*", class: "hidden", onchange: (e) => onImage(e) });
  return h("div", { class: "chat-composer" },
    h("button", { class: "c-att", onclick: () => fileInput.click() }, "📷"),
    h("button", { class: "c-att", onclick: () => recordVoice() }, "🎙️"),
    input, fileInput,
    h("button", { class: "c-send", onclick: () => sendText(input) }, "➤"),
  );
}
function autoGrow(el) { el.style.height = "auto"; el.style.height = Math.min(120, el.scrollHeight) + "px"; }
function scrollBottom() { setTimeout(() => { if (scroller) scroller.scrollTop = scroller.scrollHeight; }, 30); }

async function sendText(input) {
  const body = input.value.trim(); if (!body) return;
  input.value = ""; autoGrow(input); stopTyping();
  const temp = { id: "tmp" + Date.now(), sender: store.person, kind: "text", body, created_at: new Date().toISOString(), read_at: null, _pending: true };
  msgs.push(temp); render(); scrollBottom(); sound.post();
  const r = await api.sendMessage({ kind: "text", body });
  if (r.ok) { const i = msgs.indexOf(temp); if (i >= 0) msgs[i] = r.data.message; render(); scrollBottom(); realtime.broadcast("message"); }
  else { toast("تعذّر الإرسال"); }
}
async function onImage(e) {
  const f = e.target.files[0]; if (!f) return; e.target.value = "";
  try {
    const ds = await downscale(f, 1400);
    const su = await api.signUpload("photo", "image/jpeg");
    if (!su.ok) throw new Error("sign");
    await uploadSigned(su.data.signedUrl, ds.blob, "image/jpeg");
    const r = await api.sendMessage({ kind: "image", path: su.data.path });
    if (r.ok) { msgs.push(r.data.message); render(); scrollBottom(); sound.post(); realtime.broadcast("message"); }
  } catch { toast("تعذّرت الصورة"); }
}
function recordVoice() {
  const rec = new VoiceRecorder(); let running = false, t0 = 0, iv = null;
  const wave = h("div", { class: "wave", style: { height: "40px" } });
  const timer = h("div", { class: "num", style: { fontSize: "26px" } }, "٠ث");
  rec.onbars = (bars) => { clear(wave); bars.forEach((v) => { const i = h("i"); i.style.height = Math.max(10, v * 100) + "%"; wave.appendChild(i); }); };
  const btn = h("button", { class: "btn coral", onclick: async () => {
    if (!running) { try { await rec.start(); } catch { toast("لا يمكن الوصول للميكروفون"); return; } running = true; t0 = Date.now(); btn.textContent = "⏹ إيقاف"; iv = setInterval(() => (timer.textContent = arNum(Math.round((Date.now() - t0) / 1000)) + "ث"), 250); }
    else { clearInterval(iv); const out = await rec.stop(); sc.remove(); await sendVoice(out); }
  } }, "⏺ ابدآ التسجيل");
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" },
    h("h3", {}, "همسة صوتية 🎙️"), wave, timer, h("div", { style: { height: "10px" } }), btn,
    h("button", { class: "btn ghost", style: { marginTop: "10px" }, onclick: () => { if (running) { clearInterval(iv); rec.stop(); } sc.remove(); } }, "إلغاء")));
  document.body.appendChild(sc);
}
async function sendVoice(out) {
  try {
    const mime = out.mime && out.mime.startsWith("audio/") ? out.mime : "audio/webm";
    const su = await api.signUpload("voice", mime);
    if (!su.ok) throw new Error("sign");
    await uploadSigned(su.data.signedUrl, out.blob, mime);
    const r = await api.sendMessage({ kind: "voice", path: su.data.path, meta: { duration: out.duration, bars: out.bars } });
    if (r.ok) { msgs.push(r.data.message); render(); scrollBottom(); sound.post(); realtime.broadcast("message"); }
  } catch { toast("تعذّر الصوت"); }
}

function onTyping() { if (!typing) { typing = true; realtime.broadcast("typing", { on: true }); } clearTimeout(typingTimer); typingTimer = setTimeout(stopTyping, 1500); }
function stopTyping() { if (typing) { typing = false; realtime.broadcast("typing", { on: false }); } clearTimeout(typingTimer); }

// ---- realtime hooks (called from app.js) ----
export function chatOnMessage() {
  if (!isChatActive()) return;
  api.messages().then((r) => { if (r.ok) { msgs = r.data.items || []; olderCursor = r.data.older_cursor; render(); scrollBottom(); api.markRead(); realtime.broadcast("read"); } });
}
export function chatOnTyping(on) { const t = $("#typing"); if (t) t.classList.toggle("hidden", !on); if (on) scrollBottom(); }
export function chatOnRead() { let ch = false; for (const m of msgs) { if (m.sender === store.person && !m.read_at) { m.read_at = new Date().toISOString(); ch = true; } } if (ch && isChatActive()) render(); }
