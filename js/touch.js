// يومياتنا — نبضة: a heartbeat that lands on the other phone.
//
// If the other one has the app open it arrives at once, over the realtime
// channel, as a heart that beats on their screen and a buzz in their hand. If
// not, the server sends a notification instead — at most one a minute, however
// many times the heart is pressed. Either way it counts toward the تواصل ring.
import { h, toast } from "./ui.js";
import { api } from "./api.js";
import { rt } from "./realtime.js";
import { store } from "./store.js";
import { PEOPLE } from "./config.js";
import { sound } from "./sound.js";
import { haptic } from "./haptics.js";

let last = 0;
export async function sendTouch(btn) {
  const now = Date.now();
  if (now - last < 1500) return false;
  last = now;
  if (btn) { btn.classList.remove("beat"); void btn.offsetWidth; btn.classList.add("beat"); }
  haptic.love(); sound.heart();
  const live = rt.partnerHere;
  rt.signal("touch");
  const r = await api.touch(live);
  if (!r.ok) { toast(r.offline ? "لا اتصال — لم تصل النبضة" : "تعذّر إرسال النبضة"); return false; }
  toast(live ? "وصلت نبضتك الآن 💓" : "أُرسلت نبضتك 💓");
  window.dispatchEvent(new CustomEvent("yn:changed"));
  return true;
}

let hideTimer = null;
function showTouch(from) {
  const name = (PEOPLE[from] || {}).name || "";
  document.querySelector(".touch-overlay")?.remove();
  const el = h("div", { class: "touch-overlay", role: "status", "aria-live": "polite" },
    h("div", { class: "big-heart", "aria-hidden": "true" }, "💓"),
    h("div", { class: "from" }, name + (from === "her" ? " ترسل لك نبضة" : " يرسل لكِ نبضة")));
  document.body.appendChild(el);
  try { navigator.vibrate && navigator.vibrate([70, 90, 70]); } catch {}
  sound.heart();
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 500); }, 3200);
}

let started = false;
export function startTouchListener() {
  if (started) return;
  started = true;
  rt.on("touch", (p) => {
    if (!p || !p.from || p.from === store.person) return;
    showTouch(p.from);
    window.dispatchEvent(new CustomEvent("yn:changed"));
  });
}
