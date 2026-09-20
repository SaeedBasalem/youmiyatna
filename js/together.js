// يومياتنا — the minutes they were both in here at once.
//
// The only number in this app that measures the thing the app is for. It is
// claimed in five-minute slots by whichever phone notices, and the table's
// primary key makes a second claim a no-op — so nothing here has to be the
// single writer, and a missed tick costs five minutes rather than a session.
import { api } from "./api.js";
import { rt } from "./realtime.js";

const EVERY = 5 * 60000;
let timer = null, bound = false;

function tick() {
  if (document.hidden || !rt.partnerHere) return;
  api.togetherTick(true).catch(() => { /* a lost minute is not worth a retry */ });
}

export function startTogether() {
  if (bound) return;
  bound = true;
  rt.on("presence", (p) => { if (p && p.here) tick(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  clearInterval(timer);
  timer = setInterval(tick, EVERY);
  tick();
}
