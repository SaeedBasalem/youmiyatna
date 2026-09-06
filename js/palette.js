// يومياتنا — the command palette: one place to go anywhere, do anything, or
// find anything either of them has ever written.
//
// ⌘K / Ctrl+K on a keyboard, the 🔍 in the top bar on a phone. Commands are
// matched locally and instantly; the search of their actual writing is asked of
// the server, debounced, and folded to the same Arabic rules on both sides.
import { h, clear, arNum, toast } from "./ui.js";
import { api } from "./api.js";
import { store } from "./store.js";
import { PEOPLE } from "./config.js";
import { go, openSheet } from "./helpers.js";
import { icon } from "./icons.js";
import { haptic } from "./haptics.js";
import { sound } from "./sound.js";
import { fold } from "./views/search.js";
import { SKINS, applySkin } from "./skins.js";
import { openPushOnboarding } from "./install.js";

const RECENT_KEY = "yn_palette_recent";
let open = false;

const GROUP_LABEL = {
  nav: "الانتقال", act: "أوامر",
  moments: "لحظاتكما", whispers: "همسكما", notes: "تعليقات", letters: "رسائل",
  tasks: "مهام", gratitude: "امتنان", lists: "قوائم", duas: "أدعية",
};

// Everything the palette can do, described once. `keywords` carries the words
// someone might reach for that are not in the label itself.
function commands() {
  const c = [];
  const nav = (emoji, label, route, keywords) => c.push({ kind: "nav", emoji, label, keywords: keywords || "", run: () => go(route) });
  const act = (emoji, label, keywords, run, hint) => c.push({ kind: "act", emoji, label, keywords: keywords || "", hint, run });

  nav("🏠", "البيت", "home", "home dashboard الرئيسية");
  nav("📖", "يومياتنا", "journal", "journal feed لحظات moments");
  nav("💬", "همس", "chat", "chat whispers محادثة رسائل");
  nav("🎲", "نلعب", "play", "games play ألعاب سؤال");
  nav("💛", "نحن", "us", "us hub نحن");
  nav("🗞️", "كل ما جرى", "inbox", "activity inbox أخبار جديد");
  nav("📋", "مهامّنا", "us/plan", "tasks todo plan مهام");
  nav("🖼️", "الألبوم", "journal", "album photos صور ألبوم");
  nav("💌", "رسائل الغد", "us/letters", "letters رسائل");
  nav("🌈", "مزاجنا", "us/mood", "mood شعور مزاج");
  nav("🕌", "ركن الإيمان", "us/faith", "faith dhikr ذكر ختمة دعاء");
  nav("📖", "كتابنا", "book", "book كتاب");
  nav("✨", "حصادنا", "wrapped", "wrapped حصاد سنة");
  nav("📈", "نبضنا", "pulse", "pulse charts رسوم إحصاء");
  nav("🗺️", "خريطتنا", "map", "map أماكن خريطة");
  nav("⚙️", "الإعدادات", "us/settings", "settings إعدادات");
  nav("🎨", "استوديو المظهر", "us/studio", "theme skin studio مظهر شكل");

  act("✍️", "اكتبا لحظة", "new moment write compose جديد", () => { go("journal"); setTimeout(() => document.querySelector(".hero-note, [aria-label='اكتب لحظة']")?.click(), 420); });
  act("🔔", "فعّلا التنبيهات", "notifications push تنبيه إشعار", () => openPushOnboarding());
  act(store.theme === "dark" ? "☀️" : "🌙", "بدّلا الليل والنهار", "dark light theme ليل نهار داكن", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    store.theme = next; document.documentElement.setAttribute("data-theme", next); toast(next === "dark" ? "الوضع الليلي 🌙" : "الوضع النهاري ☀️");
  });
  for (const [key, s] of Object.entries(SKINS)) {
    act(s.chip ? "🎨" : "🎨", "المظهر: " + s.name, "skin theme مظهر " + key, () => {
      store.skin = key; applySkin(); toast("المظهر: " + s.name);
    }, s.desc);
  }
  return c;
}

function readRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; } }
function pushRecent(label) {
  try {
    const list = [label, ...readRecent().filter((x) => x !== label)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {}
}

export function openPalette() {
  if (open) return;
  open = true;
  haptic.tap();
  const CMDS = commands();
  const recent = readRecent();
  let rows = [];            // [{ el, run }] in visual order
  let cursor = 0;
  let seq = 0;              // guards against a slow search landing after a newer one

  const input = h("input", {
    class: "pal-input", type: "search", autocomplete: "off", spellcheck: "false",
    "aria-label": "ابحثا أو نفّذا أمرًا", placeholder: "ابحثا في كل شيء، أو نفّذا أمرًا…",
  });
  const list = h("div", { class: "pal-list", role: "listbox" });
  const hintBar = h("div", { class: "pal-hint" },
    h("span", {}, "↑↓ للتنقّل"), h("span", {}, "↵ للفتح"), h("span", {}, "esc للإغلاق"));
  const box = h("div", { class: "pal-box", role: "dialog", "aria-modal": "true", "aria-label": "لوحة الأوامر" },
    h("div", { class: "pal-top" }, h("span", { class: "pal-ic" }, icon("search", { size: 18 })), input,
      h("button", { class: "pal-esc", "aria-label": "إغلاق", onclick: () => close() }, "esc")),
    list, hintBar);
  const scrim = h("div", { class: "pal-scrim", onclick: (e) => { if (e.target === scrim) close(); } }, box);

  const prevFocus = document.activeElement;
  function close() {
    if (!open) return;
    open = false;
    document.removeEventListener("keydown", onKey, true);
    scrim.style.animation = "fadeout .16s forwards";
    setTimeout(() => scrim.remove(), 150);
    try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch {}
  }

  function addGroup(label) { list.appendChild(h("div", { class: "pal-group" }, label)); }
  function addRow({ emoji, label, hint, sub, run }) {
    const i = rows.length;
    const el = h("button", { class: "pal-row", role: "option", onclick: () => fire(i) },
      h("span", { class: "pal-e" }, emoji || "•"),
      h("span", { class: "pal-txt" }, h("b", {}, label), (hint || sub) ? h("span", {}, hint || sub) : null));
    rows.push({ el, run, label });
    list.appendChild(el);
    return el;
  }
  function fire(i) {
    const r = rows[i]; if (!r) return;
    pushRecent(r.label);
    sound.tab(); haptic.tap();
    close();
    setTimeout(() => r.run(), 60);
  }
  function move(d) {
    if (!rows.length) return;
    rows[cursor] && rows[cursor].el.classList.remove("on");
    cursor = (cursor + d + rows.length) % rows.length;
    rows[cursor].el.classList.add("on");
    rows[cursor].el.scrollIntoView({ block: "nearest" });
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); move(-1); return; }
    if (e.key === "Enter") { e.preventDefault(); fire(cursor); return; }
    if (e.key === "Tab") {                       // keep focus inside the palette
      e.preventDefault();
      move(e.shiftKey ? -1 : 1);
    }
  }

  // ---- painting ----
  function paintCommands(q) {
    rows = []; cursor = 0; clear(list);
    const fq = fold(q);
    const words = fq.split(/\s+/).filter(Boolean);
    const match = (c) => {
      if (!words.length) return true;
      const hay = fold(c.label + " " + c.keywords);
      return words.every((w) => hay.includes(w));
    };
    const hits = CMDS.filter(match);
    if (!q && recent.length) {
      const rec = recent.map((lbl) => CMDS.find((c) => c.label === lbl)).filter(Boolean);
      if (rec.length) { addGroup("آخر ما استُخدم"); rec.forEach((c) => addRow({ emoji: c.emoji, label: c.label, hint: c.hint, run: c.run })); }
    }
    for (const kind of ["nav", "act"]) {
      const g = hits.filter((c) => c.kind === kind);
      if (!g.length) continue;
      addGroup(GROUP_LABEL[kind]);
      g.forEach((c) => addRow({ emoji: c.emoji, label: c.label, hint: c.hint, run: c.run }));
    }
    if (rows.length) rows[0].el.classList.add("on");
    if (!rows.length && q.length < 2) list.appendChild(h("div", { class: "pal-empty" }, "لا أمر بهذا الاسم"));
  }

  function paintResults(data) {
    const groups = (data && data.groups) || {};
    const keys = Object.keys(groups);
    if (!keys.length) {
      if (!rows.length) list.appendChild(h("div", { class: "pal-empty" }, "لا شيء بهذا المعنى بعد 🌾"));
      return;
    }
    for (const k of keys) {
      addGroup(GROUP_LABEL[k] || k);
      for (const it of groups[k]) {
        addRow({ emoji: it.emoji, label: it.title, sub: it.text, run: () => { location.hash = it.url; } });
      }
    }
    if (rows.length && !rows.some((r) => r.el.classList.contains("on"))) rows[0].el.classList.add("on");
  }

  let timer = null;
  function onInput() {
    const q = input.value.trim();
    clearTimeout(timer);
    paintCommands(q);
    if (q.length < 2) return;
    const mine = ++seq;
    const searching = h("div", { class: "pal-searching" }, "…نبحث في كل شيء");
    list.appendChild(searching);
    timer = setTimeout(async () => {
      const r = await api.searchAll(q, 6);
      if (mine !== seq || !open) return;              // a newer query already won
      searching.remove();
      if (r.ok) paintResults(r.data);
      else list.appendChild(h("div", { class: "pal-empty" }, r.offline ? "لا اتصال — البحث يحتاج الإنترنت" : "تعذّر البحث"));
    }, 260);
  }

  input.addEventListener("input", onInput);
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(scrim);
  paintCommands("");
  setTimeout(() => input.focus(), 60);
}

// ⌘K / Ctrl+K anywhere, but never while they are typing into something else.
export function startPalette() {
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      open ? null : openPalette();
    }
  });
}
