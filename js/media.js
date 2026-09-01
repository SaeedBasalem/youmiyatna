// يومياتنا — media helpers: photo downscale (+EXIF strip), voice recorder, signed upload.
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
