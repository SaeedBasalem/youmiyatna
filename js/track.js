// يومياتنا — a private note of what the two phones actually do.
//
// Kinds, counts and small numbers only: never a word either of them wrote,
// never a photo, never a name. It exists because «لحظتنا الآن» fired on six
// days in a row and not one photo was taken, and nothing in the app could say
// whether they never saw it, tapped and failed, or simply let it pass.
//
// Everything here is best-effort: a failed batch is kept for the next try and
// then forgotten. Nothing on screen ever waits for it.
import { api } from "./api.js";
import { store } from "./store.js";

const MAX_HELD = 60;               // a quiet day's worth; older ones are dropped
let queue = [], timer = null, sending = false, started = false;

export function track(kind, detail) {
  if (!kind || !store.token || !store.person) return;
  queue.push({ kind: String(kind).slice(0, 40), detail: detail || {}, at: Date.now() });
  if (queue.length > MAX_HELD) queue = queue.slice(-MAX_HELD);
  clearTimeout(timer);
  timer = setTimeout(flush, 4000);          // batched, so a tap never waits on the network
}

export async function flush() {
  if (sending || !queue.length || !store.token || !store.person) return;
  sending = true;
  const batch = queue.slice(0, 20);
  queue = queue.slice(batch.length);
  let ok = false;
  try { const r = await api.log(batch); ok = !!(r && r.ok); } catch { ok = false; }
  sending = false;
  if (!ok) queue = batch.concat(queue).slice(-MAX_HELD);
  else if (queue.length) flush();
}

export function startTrack() {
  if (started) return;
  started = true;
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
  window.addEventListener("pagehide", () => flush());
  // what broke on their phone, in sixty characters — the message only
  window.addEventListener("error", (e) => track("error", {
    m: String((e && e.message) || "").slice(0, 60),
    src: String((e && e.filename) || "").split("/").pop().slice(0, 30),
    line: (e && e.lineno) || 0,
  }));
  window.addEventListener("unhandledrejection", (e) => {
    const r = e && e.reason;
    track("error", { m: ("promise: " + String((r && r.message) || r || "")).slice(0, 60) });
  });
}
