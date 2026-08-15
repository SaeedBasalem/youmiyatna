// يومياتنا — Web Push enable/disable flow (VAPID from the gate).
import { api } from "./api.js";
import { store } from "./store.js";

function urlB64ToUint8(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export const push = {
  supported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  },
  permission() { return this.supported() ? Notification.permission : "unsupported"; },
  async enable() {
    if (!this.supported()) return { ok: false, reason: "unsupported" };
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return { ok: false, reason: "denied" };
      const reg = await navigator.serviceWorker.ready;
      const v = await api.getVapid();
      if (!v.ok || !v.data.key) return { ok: false, reason: "no_key" };
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(v.data.key) });
      const r = await api.subscribePush(sub.toJSON(), navigator.userAgent);
      if (!r.ok) return { ok: false, reason: "save" };
      store.pushOn = true;
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: "subscribe_failed" };
    }
  },
  async disable() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await api.unsubscribePush(sub.endpoint); await sub.unsubscribe(); }
    } catch { /* noop */ }
    store.pushOn = false;
  },
  test() { return api.testPush(); },
};
