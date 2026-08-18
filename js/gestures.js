// يومياتنا — movable: drag-to-reorder, swipe navigation, pull-to-refresh, stagger.
// Pure Pointer/Touch events — no libraries. Respects reduced-motion via CSS.

// Drag-to-reorder within a container (grid or list aware). Meant for a "rearrange" mode:
// pointerdown starts the drag immediately. Returns a destroy() to detach.
export function sortable(container, itemSelector, onReorder) {
  const rtl = getComputedStyle(document.documentElement).direction === "rtl";
  let dragEl = null, ph = null, offX = 0, offY = 0, pid = null;

  function down(e) {
    const el = e.target.closest(itemSelector);
    if (!el || !container.contains(el)) return;
    e.preventDefault();
    dragEl = el; pid = e.pointerId;
    const r = el.getBoundingClientRect();
    offX = e.clientX - r.left; offY = e.clientY - r.top;
    ph = document.createElement("div"); ph.className = "drag-ph"; ph.style.width = r.width + "px"; ph.style.height = r.height + "px";
    el.parentNode.insertBefore(ph, el.nextSibling);
    el.classList.add("dragging");
    Object.assign(el.style, { position: "fixed", width: r.width + "px", height: r.height + "px", left: r.left + "px", top: r.top + "px", zIndex: 999, pointerEvents: "none", margin: 0 });
    if (navigator.vibrate) navigator.vibrate(12);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", up, { once: true });
  }
  function move(e) {
    if (!dragEl) return;
    dragEl.style.left = (e.clientX - offX) + "px";
    dragEl.style.top = (e.clientY - offY) + "px";
    const items = [...container.querySelectorAll(itemSelector)].filter((x) => x !== dragEl);
    let best = null, bestD = Infinity;
    for (const x of items) { const rr = x.getBoundingClientRect(); const cx = rr.left + rr.width / 2, cy = rr.top + rr.height / 2; const d = Math.hypot(e.clientX - cx, e.clientY - cy); if (d < bestD) { bestD = d; best = x; } }
    if (best) {
      const rr = best.getBoundingClientRect(); const cx = rr.left + rr.width / 2, cy = rr.top + rr.height / 2;
      const before = e.clientY < cy - rr.height * 0.25 ? true : e.clientY > cy + rr.height * 0.25 ? false : (rtl ? e.clientX > cx : e.clientX < cx);
      container.insertBefore(ph, before ? best : best.nextSibling);
    }
  }
  function up() {
    if (!dragEl) return;
    window.removeEventListener("pointermove", move);
    container.insertBefore(dragEl, ph); ph.remove();
    dragEl.classList.remove("dragging"); dragEl.removeAttribute("style");
    const order = [...container.querySelectorAll(itemSelector)].map((x) => x.dataset.id);
    dragEl = null; ph = null;
    onReorder && onReorder(order);
  }
  container.addEventListener("pointerdown", down);
  return () => container.removeEventListener("pointerdown", down);
}

// Horizontal swipe on an element → onDir(-1 | +1). Ignores vertical scrolls & inner h-scrollers.
export function swipeNav(el, onDir, skipSel = ".mood-row,.carousel-track,.juz-grid,.chat-input,.chat-scroll,input,textarea,.badge-grid,.hub-grid") {
  let x0 = 0, y0 = 0, t0 = 0, ok = false;
  el.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1 || (skipSel && e.target.closest(skipSel))) { ok = false; return; }
    const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); ok = true;
  }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (!ok) return; ok = false;
    const t = e.changedTouches[0]; const dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.7 && Date.now() - t0 < 600) onDir(dx < 0 ? -1 : 1);
  }, { passive: true });
}

// Pull-to-refresh at the top of the page (window scroll). onRefresh() when released past threshold.
export function pullRefresh(onRefresh, isActive) {
  let y0 = 0, pulling = false, dist = 0, ind = null;
  const top = () => (document.scrollingElement || document.documentElement).scrollTop <= 0;
  document.addEventListener("touchstart", (e) => { if (isActive() && top() && e.touches.length === 1) { y0 = e.touches[0].clientY; pulling = true; dist = 0; } }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    dist = e.touches[0].clientY - y0;
    if (dist > 0 && top()) {
      if (!ind) { ind = document.createElement("div"); ind.className = "pull-ind"; ind.textContent = "🤍"; document.body.appendChild(ind); }
      const d = Math.min(80, dist * 0.5); ind.style.transform = `translateX(-50%) translateY(${d}px) scale(${0.6 + Math.min(0.5, dist / 200)})`;
      ind.style.opacity = Math.min(1, dist / 100); ind.classList.toggle("ready", dist > 95);
    }
  }, { passive: true });
  document.addEventListener("touchend", () => {
    if (!pulling) return; pulling = false;
    const ready = dist > 95; if (ind) { ind.remove(); ind = null; }
    if (ready) { onRefresh(); if (navigator.vibrate) navigator.vibrate(10); }
  });
}

// Stagger entrance: sets --i on direct children for CSS animation delays.
export function stagger(container, sel) {
  const kids = sel ? container.querySelectorAll(sel) : container.children;
  [...kids].forEach((el, i) => { if (i < 14) { el.style.setProperty("--i", i); el.classList.add("stagger-in"); } });
}
