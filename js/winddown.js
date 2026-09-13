// يومياتنا — قبل النوم: after ʿIshā, three taps to close the day.
//
//   one thing to be grateful for  → the gratitude list
//   one du'a for the other        → the du'a wall, "for" them
//   tomorrow's one plan           → the shared tasks, due tomorrow
//
// Each lands where that kind of thing already lives, so the screens nobody
// visited fill up by themselves. The other one sees the du'a in the morning.
import { h, toast, sparkleAt } from "./ui.js";
import { api } from "./api.js";
import { store } from "./store.js";
import { PEOPLE, other } from "./config.js";
import { openSheet, loader } from "./helpers.js";
import { prayerTimes, RIYADH } from "./prayer.js";
import { duaForSpouse } from "./generate.js";
import { sound } from "./sound.js";
import { haptic } from "./haptics.js";
import { rt } from "./realtime.js";

function place() {
  try { const p = JSON.parse(localStorage.getItem("yn_place") || "null"); if (p && isFinite(p.lat) && isFinite(p.lng)) return p; } catch {}
  return RIYADH;
}
// From ʿIshā until Fajr, for wherever the prayer card says they are.
export function isNightNow(now = new Date()) {
  const where = place();
  const deviceTz = -now.getTimezoneOffset() / 60;
  const tz = isFinite(where.tz) ? where.tz : deviceTz;
  const t = prayerTimes(now, { ...where, tz });
  const hr = now.getHours() + now.getMinutes() / 60 + (tz - deviceTz);
  if (!isFinite(t.isha) || !isFinite(t.fajr)) return hr >= 20 || hr < 4;
  return hr >= t.isha || hr < t.fajr;
}

const GRATITUDE = ["صحّتنا وعافيتنا", "ضحكةٌ بيننا اليوم", "أنّك في حياتي", "رزقٌ ساقه الله إلينا", "يومٌ مرّ بسلام", "بيتٌ يجمعنا", "صلاةٌ لم تفتنا"];
const dayIdx = () => Math.floor((Date.now() + 180 * 60000) / 86400000);

export function openWinddown(onDone) {
  const partner = other(store.person), pn = PEOPLE[partner].name;
  const chips = (items, target) => h("div", { class: "wind-chips" }, ...items.map((t) => h("button", { class: "wind-chip", onclick: (e) => {
    target.value = t; target.dispatchEvent(new Event("input"));
    e.currentTarget.parentElement.querySelectorAll(".wind-chip").forEach((x) => x.classList.remove("on"));
    e.currentTarget.classList.add("on"); haptic.tap();
  } }, t)));
  const g = h("textarea", { class: "field", rows: 2, id: "wd-gratitude", placeholder: __g("أنا ممتنٌّ الليلة لـ…", "أنا ممتنّةٌ الليلة لـ…") });
  const d = h("textarea", { class: "field", rows: 2, id: "wd-dua", placeholder: "اللهم…" });
  const plan = h("input", { class: "field", id: "wd-plan", placeholder: "أول ما نفعله غدًا…", maxLength: 140 });
  const duas = [...new Set(Array.from({ length: 6 }, (_, k) => duaForSpouse({ seed: "wd" + dayIdx() + "-" + k, remember: false })))];
  const err = h("div", { class: "err" });
  const save = h("button", { class: "btn", onclick: async () => {
    const payload = { gratitude: g.value.trim(), dua: d.value.trim(), plan: plan.value.trim() };
    if (!payload.gratitude && !payload.dua && !payload.plan) { err.textContent = "لمسةٌ واحدة على الأقل"; return; }
    loader(true);
    const r = await api.winddownSave(payload);
    loader(false);
    if (!r.ok) { err.textContent = r.offline ? "لا اتصال — لم يُحفظ" : "تعذّر الحفظ"; return; }
    close(true);
    sound.post(); haptic.success();
    sparkleAt(innerWidth / 2, innerHeight / 3, ["🌙", "✨", "🤍"]);
    toast(__g("تصبح على خير 🌙", "تصبحين على خير 🌙"));
    rt.signal("winddown");
    onDone && onDone();
  } }, __g("اختم يومك 🌙", "اختمي يومك 🌙"));
  const step = (n, label, ...kids) => h("div", { class: "wind-step" }, h("div", { class: "ws-l" }, h("span", { class: "n" }, n), label), ...kids);
  const { close } = openSheet({
    title: "قبل النوم 🌙",
    subtitle: "ثلاث لمسات تختم بها يومك — وتجدها " + pn + " في الصباح",
    body: [h("div", { class: "wind-steps" },
      step("١", "شكرٌ لله على…", chips(GRATITUDE, g), g),
      step("٢", "دعوةٌ لـ" + pn, chips(duas, d), d),
      step("٣", "خطّة الغد", plan)),
      err, h("div", { style: { marginTop: "14px" } }, save)],
  });
  setTimeout(() => g.focus(), 280);
}

export function windCard(d, refresh) {
  if (!isNightNow()) return null;
  const pn = PEOPLE[other(store.person)].name;
  if (d && d.winddown && d.winddown.mine) {
    return h("div", { class: "tcard plain" }, h("div", { class: "tk" }, "🌙 قبل النوم"),
      h("div", { class: "muted", style: { fontSize: "13.5px" } }, __g("ختمتَ يومك ✓ تصبح على خير", "ختمتِ يومك ✓ تصبحين على خير")));
  }
  return h("div", { class: "tcard wind-card" },
    h("div", { class: "tk" }, "🌙 قبل النوم"),
    h("p", {}, `ثلاث لمسات: شكرٌ لله، ودعوةٌ لـ${pn}، وخطّة الغد.`),
    h("button", { class: "btn sm", style: { width: "auto" }, onclick: () => openWinddown(refresh) }, __g("ابدأ", "ابدئي")));
}

// What the other one left last night, waiting in the morning.
export function fromNightCard(d) {
  const t = d && d.winddown && d.winddown.theirs;
  if (!t || (!t.dua && !t.gratitude)) return null;
  const partner = other(store.person), pn = PEOPLE[partner].name, she = partner === "her";
  return h("div", { class: "tcard plain from-night" },
    h("div", { class: "tk" }, "🌙 من ليلة " + pn),
    t.dua ? h("div", {}, h("div", { class: "fn-k" }, she ? "دعت لك:" : "دعا لكِ:"), h("div", { class: "fn-line" }, "«" + t.dua + "»")) : null,
    t.gratitude ? h("div", { style: { marginTop: "6px" } }, h("div", { class: "fn-k" }, she ? "ممتنّةٌ لـ:" : "ممتنٌّ لـ:"), h("div", { class: "fn-line" }, t.gratitude)) : null);
}
