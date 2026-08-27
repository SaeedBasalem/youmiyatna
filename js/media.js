// يومياتنا — media helpers: photo downscale (+EXIF strip), doodle editor, voice recorder.
import { h, $, clear } from "./ui.js";

// ---- downscale a photo through a canvas (re-encode strips EXIF/GPS by construction) ----
export async function downscale(file, maxDim = 1600, quality = 0.85) {
  const img = await loadImage(file);
  let { width: w, height: h0 } = img;
  const scale = Math.min(1, maxDim / Math.max(w, h0));
  w = Math.round(w * scale); h0 = Math.round(h0 * scale);
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h0;
  cv.getContext("2d").drawImage(img, 0, 0, w, h0);
  const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", quality));
  return { blob, width: w, height: h0 };
}
function loadImage(fileOrBlob) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(fileOrBlob);
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); res(im); };
    im.onerror = rej; im.src = url;
  });
}

// ---- doodle / sticker editor. Returns a flattened Blob (or null if cancelled). ----
const STICKERS = ["❤️", "😍", "🌙", "⭐", "👑", "🔥", "🌹", "✨", "💍", "🤍"];
const COLORS = ["#FF6B4A", "#4DA3FF", "#38D9A9", "#14110C", "#FFC93C", "#FF7EB6"];

export function openDoodle(blob) {
  return new Promise(async (resolve) => {
    const img = await loadImage(blob);
    const fit = Math.min(window.innerWidth - 24, 460);
    const dispW = fit, dispH = Math.round((img.height / img.width) * fit);
    const ratio = img.width / dispW;

    const base = document.createElement("canvas"); base.width = dispW; base.height = dispH;
    base.getContext("2d").drawImage(img, 0, 0, dispW, dispH);
    const draw = document.createElement("canvas"); draw.width = dispW; draw.height = dispH;
    const dctx = draw.getContext("2d");
    dctx.lineCap = "round"; dctx.lineJoin = "round";

    let color = COLORS[0], erasing = false, pen = false, last = null;
    const strokes = []; let cur = null;
    const placed = []; // {el, x, y, ch, size}
    let activeSticker = null;

    const wrap = h("div", { class: "doodle-wrap", style: { position: "relative", width: dispW + "px", height: dispH + "px", margin: "0 auto", borderRadius: "12px", overflow: "hidden", border: "3px solid var(--ink)" } });
    base.style.position = "absolute"; base.style.inset = "0";
    draw.style.position = "absolute"; draw.style.inset = "0"; draw.style.touchAction = "none";
    wrap.append(base, draw);

    function redrawStrokes() {
      dctx.clearRect(0, 0, dispW, dispH);
      for (const s of strokes) {
        dctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
        dctx.strokeStyle = s.color; dctx.lineWidth = s.erase ? 26 : 6;
        dctx.beginPath();
        s.pts.forEach((p, i) => (i ? dctx.lineTo(p.x, p.y) : dctx.moveTo(p.x, p.y)));
        dctx.stroke();
      }
      dctx.globalCompositeOperation = "source-over";
    }
    const pos = (ev) => { const r = draw.getBoundingClientRect(); const t = ev.touches ? ev.touches[0] : ev; return { x: t.clientX - r.left, y: t.clientY - r.top }; };
    const down = (ev) => { if (activeSticker) return; pen = true; cur = { color, erase: erasing, pts: [pos(ev)] }; strokes.push(cur); ev.preventDefault(); };
    const move = (ev) => { if (!pen || !cur) return; cur.pts.push(pos(ev)); redrawStrokes(); ev.preventDefault(); };
    const up = () => { pen = false; cur = null; };
    draw.addEventListener("pointerdown", down); draw.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    function addSticker(ch) {
      const el = h("div", { class: "sticker", style: { position: "absolute", fontSize: "42px", left: dispW / 2 - 21 + "px", top: dispH / 2 - 21 + "px", cursor: "grab", touchAction: "none", userSelect: "none", filter: "drop-shadow(1px 1px 0 rgba(0,0,0,.4))" } }, ch);
      const rec = { el, x: dispW / 2, y: dispH / 2, ch, size: 42 };
      let drag = false, off = { x: 0, y: 0 };
      el.addEventListener("pointerdown", (ev) => { drag = true; activeSticker = rec; const r = el.getBoundingClientRect(); off = { x: ev.clientX - r.left, y: ev.clientY - r.top }; ev.stopPropagation(); ev.preventDefault(); });
      window.addEventListener("pointermove", (ev) => { if (!drag) return; const r = wrap.getBoundingClientRect(); const x = ev.clientX - r.left - off.x + rec.size / 2; const y = ev.clientY - r.top - off.y + rec.size / 2; rec.x = Math.max(0, Math.min(dispW, x)); rec.y = Math.max(0, Math.min(dispH, y)); el.style.left = rec.x - rec.size / 2 + "px"; el.style.top = rec.y - rec.size / 2 + "px"; });
      window.addEventListener("pointerup", () => { if (drag) { drag = false; setTimeout(() => (activeSticker = null), 0); } });
      // double tap removes
      el.addEventListener("dblclick", () => { const i = placed.indexOf(rec); if (i >= 0) { placed.splice(i, 1); el.remove(); } });
      wrap.appendChild(el); placed.push(rec);
    }

    const swatches = h("div", { class: "mood-row" },
      ...COLORS.map((c) => h("button", { class: "sw", style: { flex: "none", width: "30px", height: "30px", borderRadius: "50%", border: "3px solid var(--ink)", background: c }, onclick: () => { color = c; erasing = false; syncTools(); } })),
      h("button", { class: "mood-opt", onclick: () => { erasing = !erasing; syncTools(); } }, "🧽 ممحاة"),
      h("button", { class: "mood-opt", onclick: () => { if (strokes.length) { strokes.pop(); redrawStrokes(); } } }, "↩︎ تراجع"),
    );
    const stickerRow = h("div", { class: "mood-row" }, ...STICKERS.map((s) => h("button", { class: "mood-opt", onclick: () => addSticker(s) }, s)));
    function syncTools() { swatches.querySelectorAll(".sw").forEach((b, i) => b.style.outline = (!erasing && COLORS[i] === color) ? "3px solid var(--ink)" : "none"); }
    syncTools();

    const scrim = h("div", { class: "scrim center" },
      h("div", { class: "modal", style: { maxWidth: dispW + 40 + "px" } },
        h("h3", {}, "لوّنها وزيّنها 🎨"),
        wrap, swatches, stickerRow,
        h("div", { class: "attach-rail", style: { marginTop: "14px" } },
          h("button", { class: "btn ghost", onclick: () => { cleanup(); resolve(null); } }, "إلغاء"),
          h("button", { class: "btn mint", onclick: async () => { const out = await flatten(); cleanup(); resolve(out); } }, "تم"),
        ),
      ));
    document.body.appendChild(scrim);

    async function flatten() {
      const out = document.createElement("canvas"); out.width = img.width; out.height = img.height;
      const o = out.getContext("2d");
      o.drawImage(img, 0, 0, img.width, img.height);
      o.drawImage(draw, 0, 0, img.width, img.height);
      o.textAlign = "center"; o.textBaseline = "middle";
      for (const s of placed) { o.font = `${Math.round(s.size * ratio)}px serif`; o.fillText(s.ch, s.x * ratio, s.y * ratio); }
      return await new Promise((res) => out.toBlob(res, "image/jpeg", 0.85));
    }
    function cleanup() { window.removeEventListener("pointerup", up); scrim.remove(); }
  });
}

// ---- voice recorder ----
export class VoiceRecorder {
  constructor() { this.chunks = []; this.rec = null; this.stream = null; this.bars = []; this._raf = null; }
  static supportedMime() {
    const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    return opts.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
  }
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = VoiceRecorder.supportedMime();
    this.mime = (mime.split(";")[0]) || "audio/webm";
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = []; this.bars = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start();
    // amplitude sampling for a waveform
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const src = ac.createMediaStreamSource(this.stream);
    const an = ac.createAnalyser(); an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.fftSize); this._ac = ac;
    const tick = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      this.bars.push(Math.min(1, Math.sqrt(sum / buf.length) * 3));
      if (this.bars.length > 48) this.bars.shift();
      if (this.onbars) this.onbars(this.bars);
      this._raf = requestAnimationFrame(tick);
    };
    tick(); this.startedAt = Date.now();
  }
  async stop() {
    return new Promise((res) => {
      const done = () => {
        cancelAnimationFrame(this._raf);
        this.stream.getTracks().forEach((t) => t.stop());
        try { this._ac.close(); } catch {}
        const blob = new Blob(this.chunks, { type: this.mime });
        res({ blob, mime: this.mime, duration: Math.round((Date.now() - this.startedAt) / 1000), bars: this.bars.slice() });
      };
      this.rec.onstop = done; this.rec.stop();
    });
  }
}

// ---- PUT a blob to a signed upload URL ----
export async function uploadSigned(signedUrl, blob, contentType) {
  const res = await fetch(signedUrl, { method: "PUT", headers: { "Content-Type": contentType, "x-upsert": "true" }, body: blob });
  return res.ok;
}
