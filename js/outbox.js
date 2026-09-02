// يومياتنا — the outbox: writes made with no signal, kept until they land.
//
// Deliberately NOT everything. Only writes where replaying later still means
// what it meant when it was made:
//   • append-only things (a whisper, a moment, a note, a task, a gratitude)
//   • last-write-wins things (today's mood, a config value)
// Counters and toggles — dhikr, ameen, a checkbox — are left out on purpose.
// Replaying "+1" or "flip it" against a row that moved in the meantime would
// quietly produce the wrong number, and a wrong number is worse than an honest
// "لم يُحفظ". Those keep the existing roll-back behaviour.
import { api } from "./api.js";
import { toast } from "./ui.js";

const KEY = "yn_outbox";
const MAX_TRIES = 8;
const listeners = new Set();
let flushing = false;
let timer = null;

const SENDERS = {
  message:   (a) => api.sendMessage(a),
  moment:    (a) => api.addMoment(a),
  note:      (a) => api.addNote(a.entry_id, a.body),
  task:      (a) => api.addTask(a),
  checkin:   (a) => api.setCheckin(a.mood, a.note ?? null),
  config:    (a) => api.setConfig(a.key, a.value),
  gratitude: (a) => api.addGratitude(a.text),
  item:      (a) => api.addItem(a.list_id, a.text),
};
const LABEL = {
  message: "همسة", moment: "لحظة", note: "تعليق", task: "مهمة",
  checkin: "شعور اليوم", config: "إعداد", gratitude: "امتنان", item: "إضافة",
};
export const outboxLabel = (kind) => LABEL[kind] || "تغيير";

function read() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200))); } catch {}
  listeners.forEach((f) => { try { f(list.length); } catch {} });
}

export const outbox = {
  size: () => read().length,
  list: () => read(),
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  // Queue a write. Returns the job id, or false for kinds we refuse to replay,
  // so callers can roll back instead of pretending it is saved. The id lets a
  // view keep its optimistic placeholder tied to this exact job.
  add(kind, args) {
    if (!SENDERS[kind]) return false;
    const id = "o" + Date.now() + Math.random().toString(36).slice(2, 6);
    const list = read();
    list.push({ id, kind, args, at: new Date().toISOString(), tries: 0 });
    write(list);
    schedule();
    return id;
  },

  drop(id) { write(read().filter((x) => x.id !== id)); },
  clear() { write([]); },

  // Send in order and stop at the first failure, so a whisper never overtakes
  // the one written before it.
  async flush({ quiet = true } = {}) {
    if (flushing) return { sent: 0, left: read().length };
    if (!navigator.onLine) return { sent: 0, left: read().length };
    flushing = true;
    let sent = 0;
    try {
      let list = read();
      while (list.length) {
        const job = list[0];
        const send = SENDERS[job.kind];
        if (!send) { list = list.slice(1); write(list); continue; }
        let r;
        try { r = await send(job.args); } catch { r = null; }
        if (r && r.ok) {
          list = list.slice(1); write(list); sent++;
          // whoever put this in the queue can now retire its placeholder
          try { window.dispatchEvent(new CustomEvent("yn:outbox-sent", { detail: { id: job.id, kind: job.kind } })); } catch {}
          continue;
        }
        if (r && r.offline) break;                       // still no signal; keep it
        job.tries = (job.tries || 0) + 1;                // a real refusal
        if (job.tries >= MAX_TRIES) {
          list = list.slice(1); write(list);
          try { window.dispatchEvent(new CustomEvent("yn:outbox-failed", { detail: { id: job.id, kind: job.kind } })); } catch {}
          toast("تعذّر إرسال " + outboxLabel(job.kind) + " — حُذفت من قائمة الانتظار");
          continue;
        }
        write(list);
        break;
      }
    } finally { flushing = false; }
    if (sent && !quiet) toast("أُرسل ما كان بانتظار الاتصال ✓");
    const left = read().length;
    if (left) schedule(); else stop();
    return { sent, left };
  },
};

function schedule() {
  if (timer) return;
  timer = setInterval(() => { if (navigator.onLine) outbox.flush({ quiet: false }); }, 30000);
}
function stop() { clearInterval(timer); timer = null; }

// Reconnecting is the moment that matters; boot covers the app being reopened.
export function startOutbox() {
  window.addEventListener("online", () => outbox.flush({ quiet: false }));
  document.addEventListener("visibilitychange", () => { if (!document.hidden && outbox.size()) outbox.flush({ quiet: false }); });
  if (outbox.size()) { schedule(); setTimeout(() => outbox.flush({ quiet: false }), 1200); }
}
