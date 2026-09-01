// يومياتنا — a warm first-run welcome, shown once per person per device.
import { h, clear, sparkleAt } from "./ui.js";
import { store } from "./store.js";
import { sound } from "./sound.js";
import { haptic } from "./haptics.js";
import { PEOPLE, other } from "./config.js";
import { icon } from "./icons.js";
import { art } from "./art.js";
import { go } from "./helpers.js";

const KEY = () => "yn_welcomed_" + (store.person || "x");
export const hasWelcomed = () => localStorage.getItem(KEY()) === "1";
export function markWelcomed() { try { localStorage.setItem(KEY(), "1"); } catch {} }

function slides() {
  const me = PEOPLE[store.person] || PEOPLE.him;
  const you = PEOPLE[other(store.person)] || PEOPLE.her;
  return [
    { art: "journal", title: "أهلًا بك يا " + me.name, body: "هذا عالمٌ صغيرٌ لكما وحدكما — لا أحد غيركما يراه. كل ما تكتبانه هنا يبقى بينكما.", cta: "تابع" },
    { art: "album", title: "دوّنا لحظاتكما", body: "كلمة، صورة، فيديو، أو همسة صوتية. مع الوقت تصير صفحاتٍ تعودان إليها — وكتابًا يمكنكما طباعته.", cta: "جميل" },
    { art: "chat", title: "همسٌ ولعبٌ ودعاء", body: "راسلا بعضكما في «همس»، والعبا في «نلعب» أسئلةً لا تتكرّر، واجمعا ذِكركما ودعاءكما في «نحن».", cta: "وبعد؟" },
    { art: "search", title: "اجعلاه لكما", body: "غيّرا الخلفية والألوان، فعّلا التنبيهات لتصلكما همسات بعضكما، وأقفلاه برمزٍ أو ببصمتكما.", cta: "لنبدأ 🤍" },
  ];
}

export function showWelcome(onDone) {
  const cards = slides();
  let i = 0;
  const scrim = h("div", { class: "welcome" });
  const stage = h("div", { class: "wl-stage" });
  const dots = h("div", { class: "wl-dots" });
  const skip = h("button", { class: "wl-skip", onclick: () => finish() }, "تخطّي");
  scrim.appendChild(skip); scrim.appendChild(stage); scrim.appendChild(dots);
  document.body.appendChild(scrim);
  paint();

  function paint() {
    const s = cards[i];
    clear(stage);
    const card = h("div", { class: "wl-card" },
      art(s.art, { size: 170 }),
      h("h2", { class: "wl-title" }, s.title),
      h("p", { class: "wl-body" }, s.body),
      h("button", { class: "btn", onclick: next }, s.cta));
    stage.appendChild(card);
    clear(dots);
    cards.forEach((_, n) => dots.appendChild(h("span", { class: "wl-dot" + (n === i ? " on" : "") })));
    skip.style.visibility = i === cards.length - 1 ? "hidden" : "visible";
  }
  function next() {
    sound.page(); haptic.tap();
    if (i < cards.length - 1) { i++; paint(); return; }
    sparkleAt(innerWidth / 2, innerHeight / 2, ["🤍", "✨", "💗", "🌙"]);
    sound.chime(); haptic.success();
    finish();
  }
  function finish() {
    markWelcomed();
    scrim.style.animation = "fadeout .3s forwards";
    setTimeout(() => { scrim.remove(); onDone && onDone(); }, 280);
  }
  // swipe through the welcome too
  let x0 = null;
  scrim.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  scrim.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (dx < -50) next();
    else if (dx > 50 && i > 0) { i--; sound.page(); paint(); }
  }, { passive: true });
}

// call after the home screen is up; shows only once per person per device
export function maybeWelcome() {
  if (!store.person || hasWelcomed()) return;
  setTimeout(() => showWelcome(), 400);
}
