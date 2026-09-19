// يومياتنا — عبادتنا معًا.
//
// The faith corner counted one shared number and could not say who did what.
// Here worship is two people: the khatmah shows the pace each of them is
// keeping and what it means for the finish, the adhkar are marked per person
// with their own run of days, and a du'a can finally be marked answered — the
// wall was only ever a place to write them down.
import { api } from "../api.js";
import { store } from "../store.js";
import { h, clear, arNum, toast, relTime } from "../ui.js";
import { PEOPLE, other } from "../config.js";
import { errorState, go, commit } from "../helpers.js";
import { icon } from "../icons.js";
import { haptic } from "../haptics.js";
import { sound } from "../sound.js";
import { rt } from "../realtime.js";

export async function worshipSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "18px" } }, "…"));
  const r = await api.worship();
  clear(c);
  if (!r.ok) { c.appendChild(errorState(() => worshipSection(pane), { offline: r.offline })); return; }
  const me = store.person, partner = other(me), d = r.data;
  const reload = () => worshipSection(pane);

  // ---- the khatmah, and the pace it is actually being read at ----
  const k = d.khatmah, pace = d.pace;
  const kh = h("section", { class: "tcard glass", "aria-label": "ختمتنا" }, h("div", { class: "tk" }, h("span", { class: "dot" }), "ختمتنا"));
  if (!k) {
    kh.appendChild(h("p", { class: "hero-s" }, "لم تبدآ ختمة بعد — ابدآها من ركن الإيمان وتُقرأ هنا بإيقاعكما."));
    kh.appendChild(h("button", { class: "btn soft sm", style: { width: "auto" }, onclick: () => go("us/faith") }, "ابدآ ختمة"));
  } else {
    const pct = Math.round((pace.done / Math.max(1, pace.total)) * 100);
    kh.appendChild(h("div", { class: "wp-big" }, h("b", {}, arNum(pace.done)), h("span", {}, " من " + arNum(pace.total) + " جزءًا")));
    kh.appendChild(h("div", { class: "pj-bar" }, h("i", { style: { width: Math.max(2, pct) + "%" } })));
    kh.appendChild(h("p", { class: "hero-s" },
      pace.per_day > 0
        ? "إيقاعكما " + arNum(pace.per_day) + " جزء في اليوم — على هذا تُختم بعد " + arNum(pace.days_at_pace || 0) + " يومًا."
        : "بقي " + arNum(pace.left) + " جزءًا — أول جزء اليوم يبدأ الإيقاع."));
    const last = (d.log || []).slice(0, 6);
    if (last.length) kh.appendChild(h("div", { class: "wp-log" }, ...last.map((x) => h("span", { class: "wp-chip" },
      "جزء " + arNum(x.unit) + " · " + ((PEOPLE[x.by] || {}).name || "")))));
    kh.appendChild(h("button", { class: "btn ghost sm", style: { width: "auto" }, onclick: () => go("us/faith") }, "علّما جزءًا"));
  }
  c.appendChild(kh);

  // ---- the adhkar, for each of them ----
  const a = d.adhkar || { mine: [], theirs: [], streak: {} };
  const adh = h("section", { class: "tcard glass", "aria-label": "أذكارنا" }, h("div", { class: "tk" }, h("span", { class: "dot" }), "أذكار الصباح والمساء"));
  const row = (kind, label, emoji) => {
    const mineDone = a.mine.includes(kind), theirsDone = a.theirs.includes(kind);
    const btn = h("button", { class: "adh-cell" + (mineDone ? " on" : ""), onclick: async () => {
      if (mineDone) { go("us/adhkar"); return; }
      btn.classList.add("on");
      const ok = await commit(() => api.adhkarDone(kind), () => btn.classList.remove("on"), "تعذّر الحفظ");
      if (ok) { sound.toggle(); haptic.success(); rt.signal("worship"); reload(); }
    } },
      h("span", { class: "adh-emo", "aria-hidden": "true" }, emoji),
      h("span", { class: "adh-t" }, label),
      h("span", { class: "adh-state" }, mineDone ? "✓ قرأتَها".replace("قرأتَ", __g("قرأتَ", "قرأتِ")) : "لم تُقرأ بعد"));
    return h("div", { class: "adh-row" }, btn,
      h("span", { class: "adh-them" + (theirsDone ? " on" : "") }, PEOPLE[partner].name + (theirsDone ? " ✓" : " —")));
  };
  adh.appendChild(row("morning", "أذكار الصباح", "🌅"));
  adh.appendChild(row("evening", "أذكار المساء", "🌇"));
  const s = a.streak || {};
  adh.appendChild(h("div", { class: "wp-streaks" },
    h("span", {}, "أنت: " + arNum(s[me] || 0) + " يوم متتابع"),
    h("span", {}, PEOPLE[partner].name + ": " + arNum(s[partner] || 0) + " يوم")));
  adh.appendChild(h("button", { class: "btn ghost sm", style: { width: "auto" }, onclick: () => go("us/adhkar") }, "افتحا الأذكار"));
  c.appendChild(adh);

  // ---- the du'a wall, with answers ----
  const duas = d.duas || [];
  c.appendChild(h("div", { class: "rest-head" }, h("span", {}, "جدار الدعاء")));
  if (!duas.length) {
    c.appendChild(h("div", { class: "empty-card card" }, h("div", { class: "big" }, "🤲"),
      h("div", { class: "muted" }, "كل دعوةٍ تكتبانها قبل النوم تصل إلى هنا — وحين تُستجاب، علّماها.")));
  }
  for (const du of duas.slice(0, 20)) {
    const answered = !!du.answered_at;
    const card = h("article", { class: "tcard plain dua" + (answered ? " answered" : "") },
      h("p", { class: "dua-text" }, du.body),
      h("div", { class: "dua-foot" },
        h("span", { class: "muted" }, (PEOPLE[du.author] || {}).name + (du.for_whom ? " لـ" + du.for_whom : "") + " · " + relTime(du.created_at)),
        h("button", { class: "btn soft sm dua-ans", style: { width: "auto" }, onclick: async () => {
          const r2 = await api.duaAnswered(du.id, rt.partnerHere);
          if (!r2.ok) { toast("تعذّر الحفظ"); return; }
          if (r2.data.answered) { sound.celebrate(); haptic.success(); }
          reload();
        } }, answered ? "✓ استُجيبت" : "علّمها مستجابة")));
    c.appendChild(card);
  }
}
