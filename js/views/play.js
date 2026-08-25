// يومياتنا — نلعب: daily question (reveal-on-both) + couple games.
import { h, clear, arNum, toast, sparkleAt } from "../ui.js";
import { api } from "../api.js";
import { store } from "../store.js";
import { sound } from "../sound.js";
import { PEOPLE, other } from "../config.js";
import { openSheet, openModal, loader } from "../helpers.js";
import { THIS_OR_THAT, WOULD_YOU_RATHER, CONVO_DECK, DATE_IDEAS, WEEKLY_CHALLENGES, KNOW_ME } from "../games.js";

const dayIdx = () => Math.floor((Date.now() + 180 * 60000) / 86400000);
const weekIdx = () => Math.floor(dayIdx() / 7);
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

export async function viewPlay(content) {
  const c = clear(content);
  c.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "نلعب سوا")));
  const q = h("div", { class: "card dq-card" }, h("div", { class: "muted", style: { textAlign: "center", padding: "10px" } }, "…"));
  c.appendChild(q);
  c.appendChild(h("div", { class: "games" },
    gameTile("💞", "كم تعرفني؟", "خمّنوا إجابات بعض", () => knowMe()),
    gameTile("⚖️", "هذا أو ذاك", "اختيار سريع", () => thisOrThat()),
    gameTile("🤔", "لو خيّروك", "قرارٌ صعب", () => wouldYouRather()),
    gameTile("🃏", "أوراق الحديث", "أسئلة من القلب", () => convoDeck()),
    gameTile("🎯", "تحدّي الأسبوع", "مهمّة لطيفة", () => weekly()),
    gameTile("🎡", "عجلة السهرة", "وش نسوّي الليلة؟", () => spinner())));
  renderDaily(q);
}
function gameTile(emoji, title, sub, onclick) {
  return h("button", { class: "game-tile", onclick: () => { sound.tab(); onclick(); } },
    h("span", { class: "gt-e" }, emoji), h("span", { class: "gt-t" }, title), h("span", { class: "gt-s muted" }, sub));
}

/* ---------------- daily question (reveal on both) ---------------- */
async function renderDaily(card) {
  const r = await api.ritualsToday();
  const c = clear(card);
  if (!r.ok || !r.data.question) { c.appendChild(h("div", { class: "muted", style: { textAlign: "center" } }, "تعذّر تحميل سؤال اليوم")); return; }
  const { question, prompt } = r.data;
  c.appendChild(h("div", { class: "dq-head" }, h("span", { class: "em" }, "🌟"), "سؤال اليوم"));
  c.appendChild(h("div", { class: "dq-q" }, question));
  const mine = prompt.mine, theirs = prompt.theirs, revealed = prompt.revealed;
  if (mine == null) {
    const ta = h("textarea", { class: "field", rows: 2, placeholder: __g("اكتب إجابتك…", "اكتبي إجابتك…") });
    const btn = h("button", { class: "btn", style: { marginTop: "10px" }, onclick: async () => { const a = ta.value.trim(); if (!a) return; loader(true); const rr = await api.answerPrompt(a); loader(false); if (rr.ok) { sound.post(); sparkleAt(innerWidth / 2, innerHeight / 3, ["🌟", "✨", "💛"]); renderDaily(card); } else toast("تعذّر الحفظ"); } }, __g("أجِب", "أجيبي"));
    c.appendChild(ta); c.appendChild(btn);
  } else if (revealed) {
    c.appendChild(answerRow(store.person, mine));
    c.appendChild(answerRow(other(store.person), theirs));
    c.appendChild(h("div", { class: "dq-note" }, "انكشفت إجاباتكما 💛"));
  } else {
    c.appendChild(answerRow(store.person, mine));
    c.appendChild(h("div", { class: "dq-wait" }, "🔒 أجبت — تنكشف إجابتكما حين " + __g("تجيب ", "يجيب ") + PEOPLE[other(store.person)].name));
  }
}
function answerRow(who, text) {
  const p = PEOPLE[who] || PEOPLE.him;
  return h("div", { class: "ans-row " + p.cls }, h("span", { class: `avatar sm ${p.cls}` }, p.initial), h("div", { class: "ans-b" }, h("b", {}, p.name), h("div", {}, text)));
}

/* ---------------- هذا أو ذاك ---------------- */
function thisOrThat() {
  let i = dayIdx();
  const stage = h("div", { class: "tot-stage" });
  const { sheet } = openSheet({ title: "⚖️ هذا أو ذاك", subtitle: "اختاروا بسرعة… بدون تفكير!", body: [stage] });
  function draw() {
    const [a, b] = pick(THIS_OR_THAT, i);
    clear(stage);
    const opt = (label) => h("button", { class: "tot-opt", onclick: (e) => { sound.react(); e.currentTarget.classList.add("chosen"); i++; setTimeout(draw, 300); } }, label);
    stage.appendChild(h("div", { class: "tot-pair" }, opt(a), h("span", { class: "tot-or" }, "أو"), opt(b)));
    stage.appendChild(h("button", { class: "btn ghost sm", style: { margin: "16px auto 0" }, onclick: () => { i++; draw(); } }, "تخطّي ↻"));
  }
  draw();
}

/* ---------------- لو خيّروك ---------------- */
function wouldYouRather() {
  let i = dayIdx();
  const stage = h("div", {});
  openSheet({ title: "🤔 لو خيّروك", subtitle: "قرارٌ واحد… ناقشوه بعدها 💬", body: [stage] });
  function draw() {
    const { a, b } = pick(WOULD_YOU_RATHER, i);
    clear(stage);
    const opt = (label, cls) => h("button", { class: "wyr-opt " + cls, onclick: (e) => { sound.react(); e.currentTarget.classList.add("chosen"); toast("خيارٌ جميل — احكوا ليه 💬"); i++; setTimeout(draw, 600); } }, label);
    stage.appendChild(opt(a, "him")); stage.appendChild(h("div", { class: "wyr-or" }, "أو")); stage.appendChild(opt(b, "her"));
    stage.appendChild(h("button", { class: "btn ghost sm", style: { margin: "14px auto 0" }, onclick: () => { i++; draw(); } }, "سؤال آخر ↻"));
  }
  draw();
}

/* ---------------- أوراق الحديث ---------------- */
function convoDeck() {
  const card = h("div", { class: "convo-card" });
  const draw = () => { sound.react(); clear(card).appendChild(h("div", { class: "convo-q" }, pick(CONVO_DECK, Math.floor(Math.random() * CONVO_DECK.length)))); };
  openSheet({ title: "🃏 أوراق الحديث", subtitle: "اسحبوا ورقة… وافتحوا قلوبكم", body: [card, h("button", { class: "btn", style: { marginTop: "16px" }, onclick: draw }, "اسحب ورقة 🃏")] });
  draw();
}

/* ---------------- تحدّي الأسبوع ---------------- */
function weekly() {
  const ch = pick(WEEKLY_CHALLENGES, weekIdx());
  openModal({ title: "🎯 تحدّي الأسبوع", body: [
    h("div", { class: "weekly-card" }, h("div", { class: "wk-t" }, ch.t), h("div", { class: "wk-d" }, ch.d)),
    h("div", { class: "muted", style: { textAlign: "center", fontSize: "13px", marginTop: "10px" } }, "يتجدّد كل أسبوع 🤍") ] });
}

/* ---------------- عجلة السهرة ---------------- */
function spinner() {
  const N = DATE_IDEAS.length;
  const wheel = h("div", { class: "wheel" });
  DATE_IDEAS.forEach((_, i) => { const seg = h("span", { class: "wheel-seg" }); seg.style.transform = `rotate(${(360 / N) * i}deg)`; wheel.appendChild(seg); });
  const ptr = h("div", { class: "wheel-ptr" }, "▲");
  const result = h("div", { class: "wheel-result muted" }, "لُفّوا العجلة ✨");
  let angle = 0, spinning = false;
  const spin = () => {
    if (spinning) return; spinning = true; sound.tab();
    const winner = Math.floor(Math.random() * N);
    const turns = 5 + Math.floor(Math.random() * 3);
    angle += turns * 360 + (360 - (360 / N) * winner) - (angle % 360);
    wheel.style.transform = `rotate(${angle}deg)`;
    clear(result).appendChild(h("span", {}, "…"));
    setTimeout(() => { spinning = false; sound.post(); sparkleAt(innerWidth / 2, innerHeight / 2, ["🎉", "✨", "💛"]); clear(result).appendChild(h("b", {}, pick(DATE_IDEAS, winner))); }, 3600);
  };
  openSheet({ title: "🎡 عجلة السهرة", subtitle: "دَعوا العجلة تختار لكم", body: [
    h("div", { class: "wheel-wrap" }, ptr, wheel), result,
    h("button", { class: "btn", style: { marginTop: "8px" }, onclick: spin }, "لُفّها 🎡") ] });
}

/* ---------------- كم تعرفني؟ ---------------- */
function knowMe() {
  let i = Math.floor(Math.random() * KNOW_ME.length), right = 0, total = 0;
  const stage = h("div", { class: "km-stage" });
  const score = h("div", { class: "km-score muted" });
  const paintScore = () => clear(score).appendChild(h("span", {}, total ? `صحّ ${arNum(right)} من ${arNum(total)} 💛` : "خمّنوا وبعدها اكشفوا الإجابة"));
  function draw() {
    clear(stage);
    stage.appendChild(h("div", { class: "km-q" }, pick(KNOW_ME, i)));
    stage.appendChild(h("div", { class: "km-hint muted" }, "واحد يسأل والثاني يخمّن — بعدها اكشفوا 🤫"));
    stage.appendChild(h("div", { class: "row-btns", style: { marginTop: "14px" } },
      h("button", { class: "btn ghost", onclick: () => { total++; i++; paintScore(); draw(); } }, "خطأ ✗"),
      h("button", { class: "btn", onclick: () => { total++; right++; sound.react(); i++; paintScore(); draw(); } }, "صحّ ✓")));
    stage.appendChild(h("button", { class: "btn ghost sm", style: { margin: "12px auto 0" }, onclick: () => { i++; draw(); } }, "سؤال آخر ↻"));
  }
  openSheet({ title: "💞 كم تعرفني؟", subtitle: "لعبة نتعرّف فيها على بعض أكثر", body: [stage, score] });
  paintScore(); draw();
}
