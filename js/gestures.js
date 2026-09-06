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

// Drag a tile to a new place in a grid. Pointer-events based, so one code path
// covers finger, mouse and pen. It waits for a hold before it starts, otherwise
// every scroll of the page would turn into a drag; once it starts, the pointer
// is captured so the card keeps following even outside the grid.
//
// The card itself never moves in the DOM while dragging — a clone follows the
// finger and the real cards slide via transforms. Only on drop does the order
// actually change, so a cancelled drag leaves nothing to undo.
export function makeSortable(container, { itemSelector, onOrder, hold = 320 } = {}) {
  let timer = null, dragging = null, ghost = null, items = [], from = -1, to = -1;
  let startX = 0, startY = 0, pid = null;

  const cards = () => [...container.querySelectorAll(itemSelector)];

  function begin(e, card) {
    dragging = card;
    items = cards();
    from = to = items.indexOf(card);
    const r = card.getBoundingClientRect();
    ghost = card.cloneNode(true);
    ghost.classList.add("sort-ghost");
    Object.assign(ghost.style, {
      position: "fixed", left: r.left + "px", top: r.top + "px",
      width: r.width + "px", height: r.height + "px", margin: "0", zIndex: "90", pointerEvents: "none",
    });
    document.body.appendChild(ghost);
    card.classList.add("sort-source");
    container.classList.add("sorting");
    try { card.setPointerCapture(pid); } catch {}
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch {} }
  }

  function moveTo(x, y) {
    if (!ghost) return;
    ghost.style.transform = `translate(${x - startX}px, ${y - startY}px)`;
    // whichever card's centre is nearest the ghost is where it would land
    let best = -1, bestD = Infinity;
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0 && best !== to) {
      to = best;
      // preview the shuffle with transforms only; the DOM is untouched
      const order = items.filter((_, i) => i !== from);
      order.splice(to, 0, items[from]);
      const rects = items.map((el) => el.getBoundingClientRect());
      order.forEach((el, i) => {
        const src = rects[items.indexOf(el)], dst = rects[i];
        el.style.transition = "transform .18s var(--ease-out)";
        el.style.transform = el === dragging ? "" : `translate(${dst.left - src.left}px, ${dst.top - src.top}px)`;
      });
    }
  }

  function end(commit) {
    clearTimeout(timer); timer = null;
    if (ghost) { ghost.remove(); ghost = null; }
    items.forEach((el) => { el.style.transition = ""; el.style.transform = ""; });
    if (dragging) dragging.classList.remove("sort-source");
    container.classList.remove("sorting");
    const moved = commit && from >= 0 && to >= 0 && from !== to;
    const held = !!dragging;
    dragging = null;
    if (moved) {
      const order = items.filter((_, i) => i !== from);
      order.splice(to, 0, items[from]);
      onOrder && onOrder(order);
    }
    from = to = -1;
    return held;
  }

  container.addEventListener("pointerdown", (e) => {
    const card = e.target.closest(itemSelector);
    if (!card || !container.contains(card)) return;
    pid = e.pointerId; startX = e.clientX; startY = e.clientY;
    clearTimeout(timer);
    timer = setTimeout(() => begin(e, card), hold);
  });
  container.addEventListener("pointermove", (e) => {
    if (!dragging) {
      // moving before the hold elapses means they meant to scroll, not drag
      if (timer && Math.hypot(e.clientX - startX, e.clientY - startY) > 10) { clearTimeout(timer); timer = null; }
      return;
    }
    e.preventDefault();
    moveTo(e.clientX, e.clientY);
  });
  const finish = () => { const held = end(true); if (held) container._sortJustDragged = Date.now(); };
  container.addEventListener("pointerup", finish);
  container.addEventListener("pointercancel", () => end(false));
  container.addEventListener("contextmenu", (e) => { if (dragging) e.preventDefault(); });
  return () => { clearTimeout(timer); end(false); };
}
