// يومياتنا — touch gestures: swipe between tabs, pull-to-refresh, swipe a sheet away.
// Kept deliberately conservative: anything that could steal a horizontal scroll
// (carousels, the mood strip, the juz grid) or fire under an open dialog is ignored.

const NO_SWIPE = ".carousel-track,.heat,.chat-scroll,.juz-grid,.bg-swatches,.dua-chip-row,.chip-wrap,input,textarea";
const H_MIN = 60;      // px before a horizontal drag counts as a swipe
const V_SLOP = 45;     // vertical drift that cancels it
const PULL_MAX = 90;   // px of pull that triggers a refresh

export function attachSwipe(el, { onLeft, onRight } = {}) {
  let x0 = 0, y0 = 0, live = false;
  el.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1 || document.querySelector(".scrim")) { live = false; return; }
    if (e.target.closest && e.target.closest(NO_SWIPE)) { live = false; return; }
    live = true; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (!live) return; live = false;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dy) > V_SLOP || Math.abs(dx) < H_MIN) return;
    // RTL: a swipe toward the start of the reading order moves "forward"
    if (dx < 0) onLeft && onLeft(); else onRight && onRight();
  }, { passive: true });
}

// Pull down at the top of the page to refresh. onRefresh() may return a promise.
export function attachPullToRefresh(el, onRefresh) {
  let y0 = 0, pulling = false, fired = false;
  const ind = document.createElement("div");
  ind.className = "pull-ind";
  ind.textContent = "↻";
  el.prepend(ind);
  const reset = () => { ind.style.transform = ""; ind.classList.remove("ready", "spin"); };
  el.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1 || document.querySelector(".scrim") || window.scrollY > 2) { pulling = false; return; }
    pulling = true; fired = false; y0 = e.touches[0].clientY;
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    if (!pulling || fired) return;
    const dy = e.touches[0].clientY - y0;
    if (dy <= 0) { reset(); return; }
    const d = Math.min(dy * 0.5, PULL_MAX);
    ind.style.transform = "translateY(" + d + "px) rotate(" + d * 3 + "deg)";
    ind.classList.toggle("ready", d >= PULL_MAX * 0.8);
  }, { passive: true });
  el.addEventListener("touchend", async () => {
    if (!pulling) return;
    pulling = false;
    if (ind.classList.contains("ready")) {
      fired = true; ind.classList.add("spin");
      try { await onRefresh(); } catch {}
    }
    reset();
  }, { passive: true });
}

// Drag a bottom sheet down by its grab handle to dismiss it.
export function attachSheetDrag(sheet, close) {
  const grab = sheet.querySelector(".grab");
  if (!grab) return;
  let y0 = 0, dragging = false, dy = 0;
  const start = (y) => { dragging = true; y0 = y; dy = 0; sheet.style.transition = "none"; };
  const move = (y) => { if (!dragging) return; dy = Math.max(0, y - y0); sheet.style.transform = "translateY(" + dy + "px)"; };
  const end = () => {
    if (!dragging) return;
    dragging = false; sheet.style.transition = "";
    if (dy > 80) { sheet.style.transform = ""; close(); } else sheet.style.transform = "";
  };
  grab.addEventListener("touchstart", (e) => start(e.touches[0].clientY), { passive: true });
  grab.addEventListener("touchmove", (e) => move(e.touches[0].clientY), { passive: true });
  grab.addEventListener("touchend", end, { passive: true });
  grab.style.touchAction = "none";
  grab.style.cursor = "grab";
}

// Press-and-hold on an element. Cancels on move/scroll so it never fires while
// the couple is just scrolling past. `onHold` runs once; the follow-up click is
// swallowed by the caller (see the `_held` flag pattern) so a hold never
// doubles as a tap.
export function attachLongPress(el, onHold, ms = 480) {
  let timer = null;
  const cancel = () => { clearTimeout(timer); timer = null; };
  const begin = (ev) => { cancel(); timer = setTimeout(() => { timer = null; onHold(ev); }, ms); };
  el.addEventListener("touchstart", begin, { passive: true });
  el.addEventListener("touchend", cancel);
  el.addEventListener("touchmove", cancel, { passive: true });
  el.addEventListener("touchcancel", cancel);
  el.addEventListener("mousedown", begin);
  el.addEventListener("mouseup", cancel);
  el.addEventListener("mouseleave", cancel);
  el.addEventListener("contextmenu", (e) => { e.preventDefault(); cancel(); onHold(e); });
  return cancel;
}
