// يومياتنا — the bar across the top of the dashboard: one line at a time,
// alternating between "here is something worth doing" and "here is what the
// other one just did". It cycles slowly, stops the moment a finger is on it,
// and stops entirely when the phone says the reader prefers less motion.
import { h, clear, arNum } from "./ui.js";
import { store } from "./store.js";
import { PEOPLE, other } from "./config.js";
import { icon } from "./icons.js";
import { haptic } from "./haptics.js";
import { pushBlocker } from "./install.js";

const TICK = 5500;
const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
const hoursNow = () => new Date(Date.now() + 3 * 3600000).getUTCHours();   // Asia/Riyadh
const todayStr = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// What is worth suggesting, in the order it deserves attention. Only things
// that are actually true right now — a bar that invents work to look busy
// stops being read within a week.
// ---------------------------------------------------------------------------
export function recommendations(d, tasks) {
  const out = [];
  const rt = (d && d.rt) || {};
  const them = other(store.person);
  const theirName = PEOPLE[them].name;
  const add = (key, emoji, title, text, url) => out.push({ key, kind: "todo", emoji, title, text, url });

  // something waiting on them personally comes first
  const unread = (d && d.unread) || 0;
  if (unread > 0) add("unread", "💬", `${arNum(unread)} همسة تنتظركما`, `${theirName} كتب ولم تُقرأ بعد`, "#/chat");

  const openLetter = (d && d.letters || []).find((l) => !l.opened_at && l.unlock_at && new Date(l.unlock_at) <= new Date());
  if (openLetter) add("letter", "💌", "رسالة فُتح ختمها", openLetter.title || "رسالة من الماضي إليكما", "#/us/letters");

  const theirMood = rt.checkin && rt.checkin.theirs;
  if (theirMood && ["شوق", "حنين", "متعب بس ممنون", "حزين"].includes(theirMood.mood)) {
    add("mood-them", "💓", `${theirName} يشعر بـ${theirMood.mood}`, "لمسةٌ صغيرة اليوم تفرق كثيرًا", "#/chat");
  }

  const dueToday = (tasks || []).filter((t) => !t.done && t.due_date && t.due_date <= todayStr());
  if (dueToday.length) add("task", "📋", dueToday.length > 1 ? `${arNum(dueToday.length)} مهام لليوم` : "مهمة اليوم", dueToday[0].title, "#/us/plan");

  if (rt.prompt && !rt.prompt.mine) {
    add("question", "🌟", "سؤال اليوم ينتظر جوابك", rt.question || "أجيبا لتُكشف إجابة الآخر", "#/play");
  } else if (rt.prompt && rt.prompt.mine && !rt.prompt.revealed) {
    add("question-wait", "🌟", "أجبتَ — ننتظر الطرف الآخر", rt.question || "ستُكشف الإجابتان معًا", "#/play");
  }

  if (rt.checkin && !rt.checkin.mine) add("mood", "🫧", "كيف حالك اليوم؟", "سجّل شعورك بلمسة واحدة", "#/home");

  const wroteToday = (d && d.feed || []).some((e) => (e.entry_date || "").slice(0, 10) === todayStr());
  if (!wroteToday) {
    const late = hoursNow() >= 18;
    add("write", late ? "🔥" : "✍️",
      late ? "لم تدوّنا شيئًا اليوم بعد" : "دوّنا لحظة من اليوم",
      late ? "لحظةٌ واحدة تُبقي سلسلتكما" : "سطرٌ واحد يكفي ليبقى هذا اليوم",
      "#/journal");
  }

  const soon = (rt.countdowns || []).map((c) => ({ ...c, days: Math.ceil((new Date(c.target_date) - new Date()) / 86400000) }))
    .filter((c) => c.days >= 0 && c.days <= 7).sort((a, b) => a.days - b.days)[0];
  if (soon) add("countdown", soon.emoji || "⏳", soon.days === 0 ? `اليوم: ${soon.title}` : `بقي ${arNum(soon.days)} يوم على ${soon.title}`, "استعدّا له معًا", "#/us/plan");

  if ((rt.gratitude && !(rt.gratitude.mine || []).length)) add("gratitude", "🌾", "على ماذا تشكر اليوم؟", "شيءٌ صغير يستحق الامتنان", "#/us/gratitude");

  if (pushBlocker() || !store.pushOn) add("push", "🔔", "التنبيهات مغلقة", "فعّلاها لتصلكما همسات بعضكما", "#/us/settings");

  if (!out.length) add("idle", "🤍", "كل شيء على ما يرام", "اكتبا سببًا جديدًا للحب، أو افتحا كتابكما", "#/us");
  return out;
}

// Recent things the OTHER one did — your own writing is not news to you.
export function newsFromActivity(items, seenAt) {
  return (items || [])
    .filter((i) => i.actor && i.actor !== store.person)
    .slice(0, 8)
    .map((i) => ({ key: i.id, kind: "news", emoji: i.emoji, title: i.title, text: i.text, url: i.url, at: i.at, fresh: seenAt ? i.at > seenAt : false }));
}

// Alternate: a thing to do, a thing that happened, a thing to do… so the bar
// never reads as a nag list or as a wall of someone else's activity.
export function interleave(todos, news) {
  const out = [];
  const n = Math.max(todos.length, news.length);
  for (let i = 0; i < n; i++) {
    if (todos[i]) out.push(todos[i]);
    if (news[i]) out.push(news[i]);
  }
  return out.slice(0, 10);
}

// ---------------------------------------------------------------------------
export function newsBar(items, { onOpen } = {}) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;
  let idx = 0, timer = null, paused = false;

  const slot = h("div", { class: "nb-slot" });
  const pips = h("div", { class: "nb-pips" }, ...list.map((_, i) => h("span", { class: "nb-pip" + (i === 0 ? " on" : "") })));
  const bar = h("div", { class: "newsbar", role: "status", "aria-live": "polite" },
    h("span", { class: "nb-live", "aria-hidden": "true" }),
    slot,
    h("button", { class: "nb-all", "aria-label": "كل الأخبار", onclick: () => { haptic.tap(); onOpen ? onOpen() : (location.hash = "#/inbox"); } }, icon("fwd", { size: 15 })));

  function paint(dir) {
    const it = list[idx];
    clear(slot);
    const card = h("button", {
      class: "nb-item " + (it.kind === "todo" ? "is-todo" : "is-news") + (it.fresh ? " fresh" : ""),
      onclick: () => { haptic.tap(); if (it.url) location.hash = it.url; },
    },
      h("span", { class: "nb-e" }, it.emoji || "•"),
      h("span", { class: "nb-txt" }, h("b", {}, it.title), it.text ? h("span", {}, it.text) : null));
    if (!reduced()) card.style.animation = `nb-in .34s var(--ease-out) ${dir === "back" ? "reverse" : ""}`;
    slot.appendChild(card);
    [...pips.children].forEach((p, i) => p.classList.toggle("on", i === idx));
  }
  const go = (n) => { idx = (n + list.length) % list.length; paint(); };
  function start() { if (reduced() || list.length < 2) return; stop(); timer = setInterval(() => { if (!paused && !document.hidden) go(idx + 1); }, TICK); }
  function stop() { clearInterval(timer); timer = null; }

  bar.addEventListener("pointerenter", () => (paused = true));
  bar.addEventListener("pointerleave", () => (paused = false));
  bar.addEventListener("focusin", () => (paused = true));
  bar.addEventListener("focusout", () => (paused = false));
  // a flick sideways moves through them by hand
  let x0 = null;
  bar.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; paused = true; }, { passive: true });
  bar.addEventListener("touchend", (e) => {
    if (x0 == null) { paused = false; return; }
    const dx = (e.changedTouches[0].clientX - x0);
    if (Math.abs(dx) > 40) { go(idx + (dx < 0 ? 1 : -1)); haptic.tap(); }
    x0 = null; paused = false;
  });

  if (list.length > 1) bar.appendChild(pips);
  paint();
  start();
  // the interval must not outlive the screen it belongs to
  const obs = new MutationObserver(() => { if (!document.body.contains(bar)) { stop(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
  return bar;
}
