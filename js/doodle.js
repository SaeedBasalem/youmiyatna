// يومياتنا — زخرفة: draw, sticker and write on a photo before it is posted.
// Every listener is bound to one AbortController, so closing the editor
// releases them all (the previous version leaked two per sticker).
import { h, clear } from "./ui.js";
import { sound } from "./sound.js";
import { haptic } from "./haptics.js";
import { icon } from "./icons.js";

const STICKERS = ["❤️", "😍", "🌙", "⭐", "👑", "🔥", "🌹", "✨", "💍", "🤍", "🕊️", "🌷"];
const COLORS = ["#C96B80", "#E28CA0", "#E3BE86", "#8CA7C6", "#6FBF9F", "#4B3A37", "#FFFFFF"];

function loadImage(blob) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); res(im); };
    im.onerror = rej; im.src = url;
  });
}

// Resolves with a flattened Blob, or null if cancelled.
export function openDoodle(blob) {
  return new Promise(async (resolve) => {
    let img;
    try { img = await loadImage(blob); } catch { resolve(null); return; }
    const ac = new AbortController();
    const sig = { signal: ac.signal };

    const fit = Math.min(window.innerWidth - 44, 420);
    const dispW = fit, dispH = Math.round((img.height / img.width) * fit);
    const ratio = img.width / dispW;

    const base = document.createElement("canvas"); base.width = dispW; base.height = dispH;
    base.getContext("2d").drawImage(img, 0, 0, dispW, dispH);
    const draw = document.createElement("canvas"); draw.width = dispW; draw.height = dispH;
    const dctx = draw.getContext("2d");
    dctx.lineCap = "round"; dctx.lineJoin = "round";
    base.className = "dd-layer"; draw.className = "dd-layer dd-draw";

    let color = COLORS[0], erasing = false, pen = false, cur = null, activeSticker = null;
    const strokes = [], placed = [];

    const wrap = h("div", { class: "dd-wrap", style: { width: dispW + "px", height: dispH + "px" } });
    wrap.append(base, draw);

    function redraw() {
      dctx.clearRect(0, 0, dispW, dispH);
      for (const s of strokes) {
        dctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
        dctx.strokeStyle = s.color; dctx.lineWidth = s.erase ? 26 : 5;
        dctx.beginPath();
        s.pts.forEach((p, i) => (i ? dctx.lineTo(p.x, p.y) : dctx.moveTo(p.x, p.y)));
        dctx.stroke();
      }
      dctx.globalCompositeOperation = "source-over";
    }
    const pos = (ev) => { const r = draw.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
    draw.addEventListener("pointerdown", (ev) => {
      if (activeSticker) return;
      pen = true; cur = { color, erase: erasing, pts: [pos(ev)] }; strokes.push(cur);
      draw.setPointerCapture(ev.pointerId); ev.preventDefault();
    }, sig);
    draw.addEventListener("pointermove", (ev) => { if (!pen || !cur) return; cur.pts.push(pos(ev)); redraw(); ev.preventDefault(); }, sig);
    draw.addEventListener("pointerup", () => { pen = false; cur = null; }, sig);
    draw.addEventListener("pointercancel", () => { pen = false; cur = null; }, sig);

    function addSticker(ch) {
      const rec = { x: dispW / 2, y: dispH / 2, ch, size: 46 };
      const el = h("div", { class: "dd-sticker", style: { fontSize: rec.size + "px", left: rec.x - rec.size / 2 + "px", top: rec.y - rec.size / 2 + "px" } }, ch);
      let drag = false, off = { x: 0, y: 0 };
      el.addEventListener("pointerdown", (ev) => {
        drag = true; activeSticker = rec;
        const r = el.getBoundingClientRect(); off = { x: ev.clientX - r.left, y: ev.clientY - r.top };
        el.setPointerCapture(ev.pointerId); ev.stopPropagation(); ev.preventDefault();
      }, sig);
      el.addEventListener("pointermove", (ev) => {
        if (!drag) return;
        const r = wrap.getBoundingClientRect();
        rec.x = Math.max(0, Math.min(dispW, ev.clientX - r.left - off.x + rec.size / 2));
        rec.y = Math.max(0, Math.min(dispH, ev.clientY - r.top - off.y + rec.size / 2));
        el.style.left = rec.x - rec.size / 2 + "px"; el.style.top = rec.y - rec.size / 2 + "px";
      }, sig);
      el.addEventListener("pointerup", () => { drag = false; setTimeout(() => (activeSticker = null), 0); }, sig);
      el.addEventListener("dblclick", () => { const i = placed.indexOf(rec); if (i >= 0) { placed.splice(i, 1); el.remove(); haptic.tap(); } }, sig);
      wrap.appendChild(el); placed.push(rec);
      rec.el = el; sound.tab(); haptic.tap();
    }

    const swatches = h("div", { class: "dd-swatches" },
      ...COLORS.map((cc) => h("button", { class: "dd-sw", style: { background: cc }, "aria-label": "لون", onclick: (e) => {
        color = cc; erasing = false;
        swatches.querySelectorAll(".dd-sw").forEach((b) => b.classList.remove("on"));
        e.currentTarget.classList.add("on"); haptic.tap();
      } })));
    swatches.firstChild.classList.add("on");
    const tools = h("div", { class: "dd-tools" },
      h("button", { class: "dd-tool", "aria-label": "ممحاة", onclick: (e) => { erasing = !erasing; e.currentTarget.classList.toggle("on", erasing); haptic.tap(); } }, "🧽"),
      h("button", { class: "dd-tool", "aria-label": "تراجع", onclick: () => { if (strokes.length) { strokes.pop(); redraw(); haptic.tap(); } } }, "↶"),
      h("button", { class: "dd-tool", "aria-label": "مسح الكل", onclick: () => { strokes.length = 0; redraw(); placed.forEach((p) => p.el && p.el.remove()); placed.length = 0; haptic.soft(); } }, "✕"));
    const stickerRow = h("div", { class: "dd-stickers" }, ...STICKERS.map((s) => h("button", { class: "dd-st", onclick: () => addSticker(s) }, s)));

    async function flatten() {
      const out = document.createElement("canvas"); out.width = img.width; out.height = img.height;
      const o = out.getContext("2d");
      o.drawImage(img, 0, 0, img.width, img.height);
      o.drawImage(draw, 0, 0, img.width, img.height);
      o.textAlign = "center"; o.textBaseline = "middle";
      for (const s of placed) { o.font = Math.round(s.size * ratio) + "px serif"; o.fillText(s.ch, s.x * ratio, s.y * ratio); }
      return await new Promise((res) => out.toBlob(res, "image/jpeg", 0.88));
    }
    function close(result) { ac.abort(); scrim.remove(); resolve(result); }

    const scrim = h("div", { class: "scrim center dd-scrim" },
      h("div", { class: "modal dd-modal" },
        h("h3", {}, "زخرفة الصورة 🎨"),
        wrap, swatches, tools, stickerRow,
        h("div", { class: "muted", style: { fontSize: "11.5px", textAlign: "center", marginTop: "6px" } }, "اسحبا الملصق لتحريكه · نقرتان لحذفه"),
        h("div", { class: "row-btns", style: { marginTop: "14px" } },
          h("button", { class: "btn ghost", onclick: () => close(null) }, "بدون زخرفة"),
          h("button", { class: "btn", onclick: async () => { sound.post(); haptic.success(); close(await flatten()); } }, "تم 🤍"))));
    document.body.appendChild(scrim);
  });
}
