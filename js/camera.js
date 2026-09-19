// يومياتنا — كاميرتنا: the viewfinder inside the app.
//
// The daily photo used to hand off to the phone camera through a file input.
// On iPhones that hand-off is where it died: a home-screen web app is often
// thrown away and restarted while the system camera is open, and the picture
// comes back to nobody. Six prompts, zero photos.
//
// So the camera lives here now: the stream is drawn in the page, the shutter
// never leaves it, and the picture exists before anything else can go wrong.
// A phone that refuses the stream — permission denied, or an engine without
// it — falls back to the old picker rather than dead-ending.
import { h, toast } from "./ui.js";
import { icon } from "./icons.js";
import { sound } from "./sound.js";
import { track } from "./track.js";

const MAX_DIM = 1440, QUALITY = 0.86;

export const cameraSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

// Take one photo. Resolves with {blob, width, height, facing}, or null if they
// backed out. Never throws.
export function takePhoto({ title = "لحظتنا الآن", hint = "صوّرا ما حولكما الآن" } = {}) {
  return new Promise((resolve) => {
    if (!cameraSupported()) { track("camera_unsupported"); return filePicker(resolve); }

    let stream = null, facing = "environment", done = false;
    const video = h("video", { class: "cam-video", playsinline: "", autoplay: "" });
    video.muted = true; video.playsInline = true;
    const shutter = h("button", { class: "cam-shutter", "aria-label": "التقط الصورة" }, h("span", {}));
    const flip = h("button", { class: "cam-flip", "aria-label": "الكاميرا الأخرى" }, icon("camera", { size: 20 }));
    const close = h("button", { class: "cam-close", "aria-label": "إغلاق الكاميرا" }, icon("close", { size: 22 }));
    const box = h("div", { class: "cam", role: "dialog", "aria-modal": "true", "aria-label": title },
      h("div", { class: "cam-top" }, close, h("b", {}, title), flip),
      h("div", { class: "cam-frame" }, video, h("div", { class: "cam-grid", "aria-hidden": "true" })),
      h("div", { class: "cam-note" }, hint),
      h("div", { class: "cam-bar" }, shutter));
    document.body.appendChild(box);
    document.body.classList.add("cam-open");

    const stop = () => { try { (stream ? stream.getTracks() : []).forEach((t) => t.stop()); } catch {} stream = null; };
    const teardown = () => {
      stop();
      box.remove();
      document.body.classList.remove("cam-open");
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
    };
    const finish = (value) => { if (done) return; done = true; teardown(); resolve(value); };
    const onKey = (e) => { if (e.key === "Escape") { track("camera_cancel"); finish(null); } };
    const onHide = () => { if (document.hidden) stop(); };      // never hold the camera in the background
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    close.addEventListener("click", () => { track("camera_cancel"); finish(null); });

    async function start() {
      stop();
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
      } catch (err) {
        const name = String((err && err.name) || err).slice(0, 30);
        track("camera_denied", { name });
        if (done) return;
        done = true; teardown();
        if (name === "NotAllowedError") toast("لم يُسمح للتطبيق بالكاميرا — اختارا صورة بدلًا من ذلك");
        return filePicker(resolve);
      }
      video.srcObject = stream;
      video.classList.toggle("mirrored", facing === "user");
      try { await video.play(); } catch {}
      track("camera_ready", { facing });
    }

    flip.addEventListener("click", () => { facing = facing === "environment" ? "user" : "environment"; start(); });
    shutter.addEventListener("click", () => {
      const w = video.videoWidth, vh = video.videoHeight;
      if (!w || !vh) { toast("الكاميرا لم تجهز بعد"); return; }
      const scale = Math.min(1, MAX_DIM / Math.max(w, vh));
      const cw = Math.round(w * scale), ch = Math.round(vh * scale);
      const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
      const g = cv.getContext("2d");
      if (facing === "user") { g.translate(cw, 0); g.scale(-1, 1); }   // a selfie should look like the mirror did
      g.drawImage(video, 0, 0, cw, ch);
      shutter.disabled = true;
      box.classList.add("flash");
      sound.post();
      cv.toBlob((blob) => {
        if (!blob) { shutter.disabled = false; box.classList.remove("flash"); toast("تعذّر التقاط الصورة"); return; }
        track("camera_shot", { w: cw, h: ch, kb: Math.round(blob.size / 1024), facing });
        finish({ blob, width: cw, height: ch, facing });
      }, "image/jpeg", QUALITY);
    });

    track("camera_open");
    start();
  });
}

// The old path, kept for a phone that will not open a stream: the system picker.
function filePicker(resolve) {
  const input = h("input", { type: "file", accept: "image/*", class: "sr-only" });
  let settled = false;
  const done = (v) => { if (settled) return; settled = true; input.remove(); resolve(v); };
  input.addEventListener("change", async () => {
    const f = input.files && input.files[0];
    if (!f) return done(null);
    try {
      const { downscale } = await import("./media.js");
      const ds = await downscale(f, MAX_DIM, QUALITY);
      track("camera_file", { kb: Math.round(ds.blob.size / 1024) });
      done({ blob: ds.blob, width: ds.width, height: ds.height, facing: "file" });
    } catch { toast("تعذّرت قراءة الصورة"); done(null); }
  });
  // closing the picker without choosing fires nothing — give up quietly
  window.addEventListener("focus", () => setTimeout(() => { if (!input.files || !input.files.length) done(null); }, 1500), { once: true });
  document.body.appendChild(input);
  input.click();
}
