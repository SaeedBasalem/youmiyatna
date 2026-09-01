// يومياتنا — installing the app to the phone, and the notification permission
// that depends on it. On iOS, web push ONLY works once the app is on the Home
// Screen, so the flow is: install → open from the icon → enable notifications.
import { h, clear, toast } from "./ui.js";
import { store } from "./store.js";
import { sound } from "./sound.js";
import { haptic } from "./haptics.js";
import { api } from "./api.js";
import { openSheet, openModal, loader } from "./helpers.js";
import { icon } from "./icons.js";

let deferredPrompt = null;

export const isStandalone = () => {
  try {
    return window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true
      || document.referrer.startsWith("android-app://");
  } catch { return false; }
};
export const isIOS = () => {
  try {
    const ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  } catch { return false; }
};
export const canPromptInstall = () => !!deferredPrompt;
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
// iOS refuses push in a normal Safari tab — it must be the installed app
export const pushBlockedUntilInstalled = () => isIOS() && !isStandalone();

export function watchInstall(onChange) {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    onChange && onChange();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    localStorage.setItem("yn_installed", "1");
    sound.chime(); haptic.success();
    toast("تمّ تثبيت يومياتنا 🤍");
    onChange && onChange();
    setTimeout(() => openPushOnboarding(), 900);
  });
}

// Android/desktop: fire the real browser prompt. iOS: show the steps.
export async function promptInstall() {
  if (deferredPrompt) {
    const e = deferredPrompt; deferredPrompt = null;
    e.prompt();
    try { await e.userChoice; } catch {}
    return;
  }
  openInstallGuide();
}

export function openInstallGuide() {
  const ios = isIOS();
  const steps = ios
    ? [["1", "اضغطا زر المشاركة", "في شريط سفاري بالأسفل ⬆️"],
       ["2", "اختارا «إضافة إلى الشاشة الرئيسية»", "مرّرا القائمة قليلًا لتجداها"],
       ["3", "اضغطا «إضافة»", "سيظهر 🤍 بين تطبيقاتكما"],
       ["4", "افتحا التطبيق من الأيقونة", "ثم فعّلا التنبيهات من الإعدادات"]]
    : [["1", "افتحا قائمة المتصفح", "النقاط الثلاث ⋮ في الأعلى"],
       ["2", "اختارا «تثبيت التطبيق»", "أو «إضافة إلى الشاشة الرئيسية»"],
       ["3", "أكّدا التثبيت", "سيظهر 🤍 بين تطبيقاتكما"],
       ["4", "افتحاه من الأيقونة", "ثم فعّلا التنبيهات"]];
  openSheet({
    title: "ثبّتا يومياتنا على جوّالكما 📲",
    subtitle: ios ? "على الآيفون، التنبيهات تعمل فقط بعد التثبيت" : "ليصير تطبيقًا حقيقيًا يفتح بلمسة",
    body: [
      h("div", { class: "inst-steps" }, ...steps.map(([n, t, s]) =>
        h("div", { class: "inst-step" },
          h("span", { class: "is-n" }, n),
          h("div", {}, h("b", {}, t), h("span", { class: "muted" }, s))))),
      h("div", { class: "acct-hint", style: { textAlign: "center" } },
        "بعد التثبيت يعمل التطبيق دون اتصال أيضًا، وتصلكما همسات بعضكما فورًا 🔔"),
    ],
  });
}

// The guided "turn on notifications" flow, aware of what this device allows.
export function openPushOnboarding() {
  if (!pushSupported()) {
    openModal({ title: "التنبيهات 🔔", body: [h("div", { class: "muted", style: { textAlign: "center", lineHeight: "1.9" } }, "هذا المتصفح لا يدعم التنبيهات — جرّبا سفاري على الآيفون أو كروم على أندرويد.")] });
    return;
  }
  if (pushBlockedUntilInstalled()) { openInstallGuide(); return; }
  if (Notification.permission === "denied") {
    openModal({ title: "التنبيهات محجوبة 🔕", body: [
      h("div", { class: "muted", style: { textAlign: "center", lineHeight: "1.9" } },
        "سبق أن رُفضت التنبيهات لهذا الموقع. افتحا إعدادات المتصفح للموقع وفعّلا «الإشعارات»، ثم عودا هنا.")] });
    return;
  }
  enableNotifications();
}

// subscribe this device to web push (used by settings and the onboarding flow)
export async function enableNotifications({ silent = false } = {}) {
  try {
    if (!pushSupported()) { if (!silent) toast("جهازكما لا يدعم التنبيهات"); return false; }
    if (pushBlockedUntilInstalled()) { openInstallGuide(); return false; }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { if (!silent) toast("لم تُمنح الأذونات"); return false; }
    loader(true);
    const reg = await navigator.serviceWorker.ready;
    const vr = await api.getVapid();
    if (!vr.ok || !vr.data.key) { loader(false); toast("تعذّر الإعداد"); return false; }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToU8(vr.data.key) });
    const r = await api.subscribePush(sub.toJSON(), navigator.userAgent);
    loader(false);
    if (!r.ok) { toast("تعذّر التفعيل"); return false; }
    store.pushOn = true;
    sound.chime(); haptic.success();
    toast("فُعّلت التنبيهات 🔔");
    await api.testPush();
    return true;
  } catch { loader(false); if (!silent) toast("تعذّر تفعيل التنبيهات"); return false; }
}

export function urlB64ToU8(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// A gentle one-time banner on the dashboard, dismissible, never nagging.
export function installBanner() {
  if (isStandalone() || localStorage.getItem("yn_install_hidden") === "1") return null;
  if (!canPromptInstall() && !isIOS()) return null;      // desktop chrome w/o prompt: stay quiet
  const card = h("div", { class: "install-card" },
    h("span", { class: "ic-emoji" }, "📲"),
    h("div", { class: "ic-body" },
      h("b", {}, "ثبّتا يومياتنا"),
      h("span", {}, isIOS() ? "لتصلكما التنبيهات على الآيفون" : "ليفتح بلمسة، ويعمل دون اتصال")),
    h("button", { class: "btn sm ic-go", onclick: () => { haptic.tap(); promptInstall(); } }, "ثبّت"),
    h("button", { class: "ic-x", "aria-label": "إخفاء", onclick: (e) => { localStorage.setItem("yn_install_hidden", "1"); e.currentTarget.closest(".install-card").remove(); } }, icon("close", { size: 16 })));
  return card;
}
