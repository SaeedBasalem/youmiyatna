// يومياتنا — lightbox: tap a photo to hold it full-screen.
// Swipe between photos, double-tap to zoom (drag to pan while zoomed),
// swipe down or tap ✕ to let it go.
import { h, clear, arNum } from "./ui.js";
import { sound } from "./sound.js";
import { haptic } from "./haptics.js";
import { icon } from "./icons.js";

export function openLightbox(items, start = 0) {
  if (!items || !items.length) return;
  const ac = new AbortController();
  const sig = { signal: ac.signal };

  const track = h("div", { class: "lb-track" });
  items.forEach((it) => {
    const cell = h("div", { class: "lb-cell" },
      h("img", { class: "lb-img", src: it.url, alt: it.caption || "" }));
    if (it.caption) cell.appendChild(h("div", { class: "lb-cap" }, it.caption));
    track.appendChild(cell);
  });

  const counter = h("div", { class: "lb-counter" }, "");
  const closeBtn = h("button", { class: "lb-close", "aria-label": "إغلاق", onclick: () => close() }, icon("close", { size: 22 }));
  const box = h("div", { class: "lightbox", role: "dialog", "aria-modal": "true", "aria-label": "عارض الصور" }, track, closeBtn, counter);
  document.body.appendChild(box);
  document.body.style.overflow = "hidden";
  sound.whoosh();

  const update = () => {
    const w = track.clientWidth || 1;
    const idx = Math.min(items.length - 1, Math.round(Math.abs(track.scrollLeft) / w));
    counter.textContent = items.length > 1 ? arNum(idx + 1) + " / " + arNum(items.length) : "";
  };
  track.addEventListener("scroll", update, { passive: true, ...sig });
  requestAnimationFrame(() => {
    // jump to the tapped photo without animating past the others
    const w = track.clientWidth || 1;
    const dir = getComputedStyle(track).direction === "rtl" ? -1 : 1;
    track.scrollLeft = dir * start * w;
    update();
  });

  // ---- double-tap zoom + pan ----
  let zoomed = null, lastTap = 0, panStart = null, imgStart = null;
  track.addEventListener("pointerdown", (e) => {
    const img = e.target.closest(".lb-img");
    const now = Date.now();
    if (img && now - lastTap < 320) {                 // double tap
      e.preventDefault();
      if (zoomed === img) { img.style.transform = ""; img.classList.remove("zoom"); zoomed = null; track.style.overflow = ""; }
      else {
        if (zoomed) { zoomed.style.transform = ""; zoomed.classList.remove("zoom"); }
        const r = img.getBoundingClientRect();
        const ox = ((e.clientX - r.left) / r.width) * 100, oy = ((e.clientY - r.top) / r.height) * 100;
        img.style.transformOrigin = ox + "% " + oy + "%";
        img.style.transform = "scale(2.4)";
        img.classList.add("zoom"); zoomed = img;
        track.style.overflow = "hidden";              // pan the image, not the strip
        haptic.tap();
      }
      lastTap = 0; return;
    }
    lastTap = now;
    if (zoomed && img === zoomed) {
      panStart = { x: e.clientX, y: e.clientY };
      const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(zoomed.style.transform);
      imgStart = m ? { x: +m[1], y: +m[2] } : { x: 0, y: 0 };
    }
  }, sig);
  track.addEventListener("pointermove", (e) => {
    if (!zoomed || !panStart) return;
    const dx = e.clientX - panStart.x + imgStart.x, dy = e.clientY - panStart.y + imgStart.y;
    zoomed.style.transform = `translate(${dx}px, ${dy}px) scale(2.4)`;
  }, sig);
  const endPan = () => { panStart = null; };
  track.addEventListener("pointerup", endPan, sig);
  track.addEventListener("pointercancel", endPan, sig);

  // ---- swipe down to dismiss (when not zoomed) ----
  let y0 = null;
  box.addEventListener("touchstart", (e) => { if (!zoomed && e.touches.length === 1) y0 = e.touches[0].clientY; }, { passive: true, ...sig });
  box.addEventListener("touchend", (e) => {
    if (y0 == null) return;
    const dy = e.changedTouches[0].clientY - y0; y0 = null;
    if (dy > 90) close();
  }, { passive: true, ...sig });
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey, sig);

  function close() {
    ac.abort();
    document.body.style.overflow = "";
    box.style.animation = "fadeout .22s forwards";
    setTimeout(() => box.remove(), 200);
  }
}

// convenience: build lightbox items from a moment's media
export function photosOf(media) {
  return (media || []).filter((m) => m.kind === "photo" && m.signed_url).map((m) => ({ url: m.signed_url }));
}
