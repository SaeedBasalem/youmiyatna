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

// What, if anything, stands between this device and a notification — in the
// order that actually matters. The iPhone case MUST be answered before the
// capability check: iOS hides Notification and PushManager entirely inside a
// Safari tab, so "unsupported" there means "not installed yet", and telling an
// iPhone user their iPhone is unsupported is a dead end they cannot escape.
export function pushBlocker() {
  if (pushBlockedUntilInstalled()) return "ios-install";
  if (!window.isSecureContext) return "insecure";
  if (!("serviceWorker" in navigator)) return "no-sw";
  if (!("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return null;
}

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
  const blocker = pushBlocker();
  if (blocker === "ios-install") { openInstallGuide(); return; }
  if (blocker) { openPushDoctor(); return; }        // the doctor explains the rest
  enableNotifications();
}

// Every distinct failure used to collapse into one toast, so "it doesn't work"
// carried no information. These say which step failed and what to do about it.
const REASON = {
  "ios-install":  "على الآيفون لا تعمل التنبيهات إلا بعد تثبيت التطبيق على الشاشة الرئيسية وفتحه من أيقونته.",
  insecure:       "هذه الصفحة ليست على اتصال آمن (https)، والتنبيهات تتطلّب ذلك.",
  "no-sw":        "هذا المتصفح لا يشغّل عامل الخدمة — جرّبا كروم أو سفاري حديثًا.",
  unsupported:    "هذا المتصفح لا يدعم تنبيهات الويب.",
  denied:         "سبق أن رُفضت التنبيهات لهذا الموقع. افتحا إعدادات المتصفح لهذا الموقع وفعّلا «الإشعارات»، ثم عودا.",
  dismissed:      "أُغلق طلب الإذن دون موافقة. اضغطا الزر مرة أخرى واختارا «السماح».",
  novapid:        "تعذّر جلب مفتاح الخادم. تحقّقا من الاتصال ثم أعيدا المحاولة.",
  subscribe:      "رفض المتصفح إنشاء الاشتراك. أغلقا التطبيق وافتحاه ثم أعيدا المحاولة.",
  server:         "لم يقبل الخادم الاشتراك. تحقّقا من الاتصال ثم أعيدا المحاولة.",
};

// subscribe this device to web push (used by settings and the onboarding flow)
export async function enableNotifications({ silent = false } = {}) {
  const fail = (code) => {
    loader(false);
    if (!silent) toast(REASON[code] ? REASON[code].slice(0, 70) + "…" : "تعذّر التفعيل");
    return { ok: false, code };
  };
  const blocker = pushBlocker();
  if (blocker === "ios-install") { if (!silent) openInstallGuide(); return { ok: false, code: blocker }; }
  if (blocker) return fail(blocker);
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return fail(perm === "denied" ? "denied" : "dismissed");
    loader(true);
    const reg = await navigator.serviceWorker.ready;
    const vr = await api.getVapid();
    if (!vr.ok || !vr.data.key) return fail("novapid");
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToU8(vr.data.key) }); }
      catch { return fail("subscribe"); }
    }
    const r = await api.subscribePush(sub.toJSON(), navigator.userAgent);
    if (!r.ok) return fail("server");
    loader(false);
    store.pushOn = true;
    sound.chime(); haptic.success();
    toast("فُعّلت التنبيهات 🔔");
    await api.testPush();
    return { ok: true, code: null };
  } catch (e) { loader(false); if (!silent) toast("تعذّر تفعيل التنبيهات"); return { ok: false, code: "unknown", detail: String(e) }; }
}

// ---------------------------------------------------------------------------
// The notification doctor. Checks every precondition on THIS device and says
// which one is unhappy, because the server accepting a push and the phone
// showing it are two different things and only one of them is our code.
// ---------------------------------------------------------------------------
export async function pushDoctorReport() {
  const rows = [];
  const add = (ok, label, note) => rows.push({ ok, label, note });
  const ios = isIOS(), standalone = isStandalone();

  add(true, "الجهاز", ios ? (standalone ? "آيفون — مثبّت ✓" : "آيفون — غير مثبّت") : (standalone ? "مثبّت ✓" : "متصفح"));
  if (ios) add(standalone, "التثبيت على الشاشة الرئيسية", standalone ? "تمّ" : "مطلوب على الآيفون قبل أي شيء");
  add(!!window.isSecureContext, "اتصال آمن (https)", window.isSecureContext ? "نعم" : "لا");

  const supported = pushSupported();
  add(supported, "دعم المتصفح للتنبيهات", supported ? "مدعوم" : (ios && !standalone ? "يظهر بعد التثبيت" : "غير مدعوم"));

  const perm = ("Notification" in window) ? Notification.permission : "—";
  add(perm === "granted", "إذن الإشعارات",
    perm === "granted" ? "ممنوح" : perm === "denied" ? "مرفوض — غيّراه من إعدادات المتصفح" : "لم يُطلب بعد");

  let reg = null;
  try {
    reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 6000))]);
  } catch {}
  add(!!reg, "عامل الخدمة", reg ? "يعمل" : "لم يبدأ — أعيدا فتح التطبيق");

  let sub = null;
  if (reg && supported) { try { sub = await reg.pushManager.getSubscription(); } catch {} }
  add(!!sub, "اشتراك هذا الجهاز", sub ? "مسجّل" : "غير مسجّل بعد");

  if (sub) {
    const r = await api.subscribePush(sub.toJSON(), navigator.userAgent);   // idempotent upsert
    add(r.ok, "الخادم يعرف هذا الجهاز", r.ok ? "نعم" : "تعذّر الوصول للخادم");
  }
  return rows;
}

export function openPushDoctor() {
  const list = h("div", { class: "doc-rows" }, h("div", { class: "muted", style: { textAlign: "center", padding: "18px" } }, "…جارٍ الفحص"));
  const runTest = h("button", { class: "btn soft sm", style: { marginTop: "6px" }, onclick: async () => {
    runTest.disabled = true; runTest.textContent = "…جارٍ الإرسال";
    const r = await api.testPush();
    runTest.disabled = false; runTest.textContent = "أرسلا تنبيه تجربة 🔔";
    verdict.textContent = r.ok
      ? "أرسل الخادم التنبيه. إن لم يظهر خلال ثوانٍ فالنظام نفسه يحجبه — راجعا إعدادات الإشعارات في الجهاز (وضع «عدم الإزعاج» أو «مساعد التركيز» في ويندوز)."
      : "لم يقبل الخادم الإرسال — غالبًا هذا الجهاز غير مشترك بعد.";
    verdict.className = "acct-hint " + (r.ok ? "ok" : "bad");
  } }, "أرسلا تنبيه تجربة 🔔");
  const verdict = h("div", { class: "acct-hint" });

  const fixBtn = h("button", { class: "btn sm", onclick: async () => {
    const res = await enableNotifications();
    if (res.code === "ios-install") return;
    if (!res.ok && REASON[res.code]) { verdict.textContent = REASON[res.code]; verdict.className = "acct-hint bad"; }
    refresh();
  } }, "فعّلا التنبيهات الآن");

  async function refresh() {
    const rows = await pushDoctorReport();
    clear(list);
    for (const r of rows) {
      list.appendChild(h("div", { class: "doc-row " + (r.ok ? "ok" : "bad") },
        h("span", { class: "doc-dot" }, r.ok ? "✓" : "!"),
        h("div", {}, h("b", {}, r.label), h("span", { class: "muted" }, r.note))));
    }
  }
  openSheet({
    title: "فحص التنبيهات 🩺",
    subtitle: "لنرَ أين تتوقّف بالضبط",
    body: [list, h("div", { class: "doc-actions" }, fixBtn, runTest), verdict],
  });
  refresh();
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

// A dashboard nudge shown only while notifications are genuinely off, with one
// tap to the thing that will actually fix it on this device.
export function pushBanner() {
  if (store.pushOn && !pushBlocker()) return null;
  if (localStorage.getItem("yn_push_hidden") === "1") return null;
  const blocker = pushBlocker();
  const line = blocker === "ios-install" ? "ثبّتاه أولًا لتصلكما التنبيهات"
    : blocker === "denied" ? "التنبيهات مرفوضة لهذا الموقع"
    : "لتصلكما همسات بعضكما وتذكيراتكما";
  const card = h("div", { class: "install-card push-card" },
    h("span", { class: "ic-emoji" }, "🔔"),
    h("div", { class: "ic-body" }, h("b", {}, "فعّلا التنبيهات"), h("span", {}, line)),
    h("button", { class: "btn sm ic-go", onclick: () => { haptic.tap(); openPushOnboarding(); } }, "فعّل"),
    h("button", { class: "ic-x", "aria-label": "إخفاء", onclick: (e) => { localStorage.setItem("yn_push_hidden", "1"); e.currentTarget.closest(".install-card").remove(); } }, icon("close", { size: 16 })));
  return card;
}
