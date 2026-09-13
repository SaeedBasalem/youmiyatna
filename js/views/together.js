// يومياتنا — نلعب معًا: games across two phones, live.
//
//   هذا أو ذاك  both choose at the same moment, then see how often they match.
//   كم تعرفني   one answers about themself, the other guesses; the one who
//               answered says how close it came. Roles swap every round.
//
// Moves are kept on the server (journal6), and each phone is shown the other's
// only once both have moved. The realtime channel only says "something
// changed" — nobody's answer travels on it. If it is down, the screen polls.
import { h, clear, arNum, toast, sparkleAt } from "../ui.js";
import { api } from "../api.js";
import { store } from "../store.js";
import { PEOPLE, other } from "../config.js";
import { go } from "../helpers.js";
import { icon } from "../icons.js";
import { sound } from "../sound.js";
import { haptic } from "../haptics.js";
import { rt } from "../realtime.js";
import { thisOrThat, knowMe } from "../generate.js";

const GAME_NAME = { tot: "هذا أو ذاك", knowme: "كم تعرفني" };
let session = null, state = null, stage = null, root = null, pollT = null, bound = false, busy = false;

const partner = () => other(store.person);
const pn = () => PEOPLE[partner()].name;
const she = () => partner() === "her";
const mounted = () => root && document.body.contains(root);

export async function viewTogether(content, sid) {
  root = content;
  clear(content);
  content.appendChild(h("div", { class: "sub-head" },
    h("button", { class: "icon-btn", "aria-label": "رجوع", onclick: () => go("play") }, icon("fwd")),
    h("h1", { class: "sh-title" }, "نلعب معًا"),
    h("span", { class: "here-now" + (rt.partnerHere ? "" : " hidden"), "data-presence": "1", style: { marginInlineStart: "auto" } }, pn() + " هنا الآن")));
  stage = h("div", { class: "live" });
  content.appendChild(stage);
  bind();
  if (sid) { session = sid; stage.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "20px" } }, "…")); await refresh(); }
  else { session = null; state = null; lobby(); }
}

function bind() {
  if (bound) return;
  bound = true;
  rt.on("game", (p) => {
    if (!mounted() || !p || !p.session) return;
    if (!session) { session = p.session; history.replaceState(null, "", "#/play/live/" + session); }
    if (p.session === session) refresh();
  });
  rt.on("presence", () => { if (mounted()) root.querySelectorAll("[data-presence]").forEach((el) => el.classList.toggle("hidden", !rt.partnerHere)); });
}
function poll() {
  clearInterval(pollT);
  pollT = setInterval(() => {
    if (!mounted()) { clearInterval(pollT); return; }
    if (!document.hidden && session) refresh();
  }, rt.connected ? 8000 : 3500);
}

async function lobby() {
  clear(stage);
  stage.appendChild(h("div", { class: "live-role" }, rt.partnerHere
    ? pn() + " هنا الآن — اختارا لعبة"
    : __g("اختر", "اختاري") + " لعبة — وتصل الدعوة إلى " + pn()));
  const open = await api.gameOpen();
  if (!mounted()) return;
  if (open.ok && open.data.open && open.data.open.created_by !== store.person) {
    const o = open.data.open;
    stage.appendChild(h("button", { class: "tcard glass play-card", onclick: () => join(o.session) },
      h("span", { class: "pc-ic", "aria-hidden": "true" }, "🎲"),
      h("div", {}, h("b", {}, pn() + (she() ? " بدأت " : " بدأ ") + "«" + GAME_NAME[o.game] + "»"), h("span", {}, __g("انضمّ الآن", "انضمّي الآن"))),
      h("span", { class: "go", "aria-hidden": "true" }, icon("back", { size: 18 }))));
  }
  const pick = (game, emoji, desc) => h("button", { class: "tcard plain play-card", onclick: () => start(game) },
    h("span", { class: "pc-ic", "aria-hidden": "true" }, emoji), h("div", {}, h("b", {}, GAME_NAME[game]), h("span", {}, desc)),
    h("span", { class: "go", "aria-hidden": "true" }, icon("back", { size: 18 })));
  stage.appendChild(pick("tot", "⚖️", "تختاران في اللحظة نفسها — وتريان كم تتشابهان"));
  stage.appendChild(pick("knowme", "💞", "واحدٌ يجيب عن نفسه والآخر يخمّن"));
  const st = await api.gameStats();
  if (st.ok && mounted() && !session) stage.appendChild(statsCard(st.data.stats));
}

function join(sid) { session = sid; history.replaceState(null, "", "#/play/live/" + sid); haptic.tap(); refresh(); }

async function start(game) {
  if (busy) return;
  busy = true; haptic.tap(); sound.tab();
  const prompt = game === "tot" ? thisOrThat() : { q: knowMe() };
  const r = await api.gameNew(game, prompt, rt.partnerHere);
  busy = false;
  if (!r.ok) { toast(r.offline ? "لا اتصال — لم تبدأ اللعبة" : "تعذّر بدء اللعبة"); return; }
  state = r.data.state; session = state.session;
  history.replaceState(null, "", "#/play/live/" + session);
  rt.signal("game", { session, invite: true, game });
  toast(rt.partnerHere ? "وصلت الدعوة إلى " + pn() + " 🎲" : "أُرسلت الدعوة إلى " + pn() + " 🎲");
  render(); poll();
}

async function refresh() {
  const r = await api.gameState(session);
  if (!mounted()) return;
  if (!r.ok) {
    clear(stage);
    stage.appendChild(h("div", { class: "empty" }, r.status === 404 ? "لم نجد هذه اللعبة" : "تعذّر التحميل",
      h("button", { class: "btn soft sm", onclick: () => go("play/live") }, "لعبة جديدة")));
    return;
  }
  const prev = state;
  state = r.data.state;
  const cur = state.rounds[state.rounds.length - 1];
  const was = prev && prev.rounds.find((x) => x.id === cur.id);
  if (was && !was.revealed && cur.revealed) { sound.post(); haptic.success(); }
  render(); poll();
}

async function move(cur, value) {
  if (busy || cur.revealed) return;
  busy = true; haptic.pick(); sound.react();
  const r = await api.gameMove(cur.id, value);
  busy = false;
  if (!r.ok) { toast(r.offline ? "لا اتصال — لم تُرسل" : "تعذّر الإرسال"); return; }
  state = r.data.state;
  rt.signal("game", { session });
  const now = state.rounds[state.rounds.length - 1];
  if (now.revealed) { sound.post(); haptic.success(); if (now.result === "match") sparkleAt(innerWidth / 2, innerHeight / 2.4, ["💞", "✨", "🤍"]); }
  render();
}

async function judge(cur, verdict) {
  if (busy) return;
  busy = true;
  const r = await api.gameJudge(cur.id, verdict);
  busy = false;
  if (!r.ok) { toast("تعذّر الحفظ"); return; }
  state = r.data.state;
  rt.signal("game", { session });
  if (verdict === "right") sparkleAt(innerWidth / 2, innerHeight / 2.4, ["🎯", "✨", "💛"]);
  sound.post(); render();
}

async function next() {
  if (busy) return;
  busy = true;
  const prompt = state.game === "tot" ? thisOrThat() : { q: knowMe() };
  const r = await api.gameNext(session, prompt);
  busy = false;
  if (!r.ok) { toast("تعذّرت الجولة التالية"); return; }
  state = r.data.state;
  rt.signal("game", { session });
  sound.tab(); render();
}

function render() {
  if (!mounted() || !state) return;
  clear(stage);
  const cur = state.rounds[state.rounds.length - 1];
  const s = state.score;
  const score = state.game === "tot"
    ? "تطابقتما " + arNum(s.match) + " من " + arNum(s.played)
    : PEOPLE.him.name + " " + arNum(s.points.him) + " · " + PEOPLE.her.name + " " + arNum(s.points.her);
  stage.appendChild(h("div", { class: "live-top" }, h("b", {}, GAME_NAME[state.game] + " · الجولة " + arNum(cur.idx + 1)), h("span", { class: "live-score" }, score)));
  if (state.game === "tot") renderTot(cur); else renderKnow(cur);
  const done = state.rounds.filter((r) => r.revealed && r.id !== cur.id).slice(-4).reverse();
  if (done.length) {
    stage.appendChild(h("div", { class: "live-hist" }, ...done.map((r) => h("div", {},
      h("span", {}, state.game === "tot" ? r.prompt.a + " / " + r.prompt.b : r.prompt.q),
      h("b", {}, state.game === "tot" ? (r.result === "match" ? "💞" : "↔︎") : r.result === "right" ? "🎯" : r.result === "close" ? "〜" : r.result === "wrong" ? "✗" : "…")))));
  }
  stage.appendChild(h("button", { class: "btn ghost sm", style: { marginTop: "4px" }, onclick: () => { session = null; state = null; history.replaceState(null, "", "#/play/live"); lobby(); } }, "لعبة أخرى"));
}

function status(text, waiting) {
  return h("div", { class: "live-status" }, h("span", { class: "live-dot" + (waiting ? " wait" : " on") }), text);
}

function renderTot(cur) {
  stage.appendChild(h("div", { class: "live-q" }, "أيّهما؟"));
  const opt = (k) => h("button", { class: "live-opt" + (cur.mine === k ? " on" : "") + (cur.revealed && cur.theirs === k ? " them" : ""),
    disabled: cur.revealed || null, "aria-pressed": cur.mine === k ? "true" : "false", onclick: () => move(cur, k) }, cur.prompt[k]);
  stage.appendChild(h("div", { class: "live-opts" }, opt("a"), opt("b")));
  if (cur.revealed) {
    stage.appendChild(h("div", { class: "live-reveal" },
      h("div", { class: "lr" }, h("b", {}, "أنت"), cur.prompt[cur.mine]),
      h("div", { class: "lr" }, h("b", {}, pn()), cur.prompt[cur.theirs])));
    stage.appendChild(h("div", { class: "live-verdict" }, cur.result === "match" ? "تطابقتما 💞" : "اختلفتما — احكيا لماذا 💬"));
    stage.appendChild(h("button", { class: "btn", onclick: next }, "الجولة التالية"));
  } else if (cur.mine) {
    stage.appendChild(status("بانتظار " + pn() + "…", true));
  } else {
    stage.appendChild(status(cur.theirs_moved ? pn() + (she() ? " اختارت ✓ — دورك" : " اختار ✓ — دورك") : "اختارا بسرعة — بلا تفكير!", !cur.theirs_moved));
  }
}

function renderKnow(cur) {
  const iAnswer = cur.prompt.answerer === store.person;
  stage.appendChild(h("div", { class: "live-q" }, cur.prompt.q));
  stage.appendChild(h("div", { class: "live-role" }, iAnswer
    ? __g("أجب عن نفسك", "أجيبي عن نفسك") + " — " + pn() + (she() ? " ستخمّن" : " سيخمّن")
    : __g("خمّن", "خمّني") + ": ماذا " + (she() ? "ستجيب " : "سيجيب ") + pn() + "؟"));
  if (!cur.revealed) {
    if (cur.mine) {
      stage.appendChild(h("div", { class: "live-reveal" }, h("div", { class: "lr", style: { gridColumn: "1/-1" } }, h("b", {}, iAnswer ? "جوابك" : "تخمينك"), cur.mine)));
      stage.appendChild(status("بانتظار " + pn() + "…", true));
    } else {
      const ta = h("textarea", { class: "field", rows: 2, id: "live-move", "aria-label": iAnswer ? "جوابك" : "تخمينك", placeholder: iAnswer ? "جوابك…" : "تخمينك…" });
      stage.appendChild(ta);
      stage.appendChild(h("button", { class: "btn", onclick: () => { const v = ta.value.trim(); if (!v) { ta.focus(); return; } move(cur, v); } }, __g("أرسل", "أرسلي")));
      if (cur.theirs_moved) stage.appendChild(status(pn() + (iAnswer ? (she() ? " خمّنت ✓" : " خمّن ✓") : (she() ? " أجابت ✓" : " أجاب ✓")) + " — دورك", false));
    }
    return;
  }
  const answer = iAnswer ? cur.mine : cur.theirs, guess = iAnswer ? cur.theirs : cur.mine;
  stage.appendChild(h("div", { class: "live-reveal" },
    h("div", { class: "lr" }, h("b", {}, "الجواب"), answer),
    h("div", { class: "lr" }, h("b", {}, "التخمين"), guess)));
  if (!cur.result) {
    if (iAnswer) {
      stage.appendChild(h("div", { class: "live-role" }, "كم كان التخمين قريبًا؟"));
      stage.appendChild(h("div", { class: "live-judge" },
        h("button", { class: "btn", onclick: () => judge(cur, "right") }, "صحّ 🎯"),
        h("button", { class: "btn soft", onclick: () => judge(cur, "close") }, "قريب 〜"),
        h("button", { class: "btn ghost", onclick: () => judge(cur, "wrong") }, "بعيد ✗")));
    } else stage.appendChild(status("بانتظار حكم " + pn() + "…", true));
    return;
  }
  stage.appendChild(h("div", { class: "live-verdict" }, cur.result === "right" ? "صحّ! +٢ 🎯" : cur.result === "close" ? "قريب! +١ 〜" : "بعيد — تعرّفا أكثر 😄"));
  stage.appendChild(h("button", { class: "btn", onclick: next }, "الجولة التالية"));
}

function statsCard(stats) {
  if (!stats) return null;
  const t = stats.tot || {}, k = stats.knowme || {};
  if (!t.played && !(k.him && k.him.played) && !(k.her && k.her.played)) return h("div", { class: "live-role" }, "أول لعبة تبدأ سجلّكما 🤍");
  const pct = t.played ? Math.round((t.match / t.played) * 100) : 0;
  const line = (p) => { const x = k[p] || {}; return PEOPLE[p].name + ": " + arNum(x.right || 0) + " صحّ · " + arNum(x.close || 0) + " قريب من " + arNum(x.played || 0); };
  return h("div", { class: "tcard plain" }, h("div", { class: "tk" }, "سجلّكما"),
    t.played ? h("div", { style: { fontSize: "14px" } }, "هذا أو ذاك: تطابقتما في " + arNum(pct) + "٪ من " + arNum(t.played) + " جولة") : null,
    (k.him && k.him.played) || (k.her && k.her.played) ? h("div", { class: "muted", style: { fontSize: "13px", marginTop: "6px" } }, "كم تعرفني — " + line("him") + " / " + line("her")) : null);
}

// An invitation from the other phone, wherever this one is in the app.
let invitesOn = false;
export function startGameInvites() {
  if (invitesOn) return;
  invitesOn = true;
  rt.on("game", (p) => {
    if (!p || !p.invite || p.from === store.person) return;
    if ((location.hash || "").startsWith("#/play/live")) return;
    document.querySelector(".invite-banner")?.remove();
    const from = PEOPLE[p.from] ? PEOPLE[p.from].name : "";
    const el = h("div", { class: "invite-banner", role: "status" },
      h("span", { "aria-hidden": "true" }, "🎲"),
      h("span", { class: "ib-t" }, from + (p.from === "her" ? " تدعوك إلى «" : " يدعوكِ إلى «") + (GAME_NAME[p.game] || "لعبة") + "»"),
      h("button", { class: "btn sm", onclick: () => { el.remove(); go("play/live/" + p.session); } }, __g("انضمّ", "انضمّي")),
      h("button", { class: "ib-x", "aria-label": "إغلاق", onclick: () => el.remove() }, icon("close", { size: 16 })));
    document.body.appendChild(el);
    sound.chime(); haptic.tap();
    setTimeout(() => el.remove(), 15000);
  });
}
