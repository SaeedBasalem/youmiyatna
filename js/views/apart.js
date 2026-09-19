// يومياتنا — بعيدون: the small distance between two days.
//
// Nothing here tracks anybody. One of them says "I am on my way" and roughly
// how long it will take; the other one sees the time close on its own, and a
// notification arrives when they set off and when they get there. That is the
// whole of it — a told journey, not a followed one.
import { api } from "../api.js";
import { store } from "../store.js";
import { h, clear, arNum, toast, fullDate } from "../ui.js";
import { PEOPLE, other } from "../config.js";
import { openSheet, errorState, go } from "../helpers.js";
import { icon } from "../icons.js";
import { haptic } from "../haptics.js";
import { sound } from "../sound.js";
import { rt } from "../realtime.js";

const WHERE = [["home", "🏡", "إلى البيت"], ["work", "💼", "إلى العمل"], ["trip", "🧳", "سفر"], ["other", "📍", "مكان آخر"]];
const MINUTES = [10, 20, 30, 45, 60, 90];
const whereOf = (k) => WHERE.find((x) => x[0] === k) || WHERE[3];
let tick = null;

export async function apartSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "18px" } }, "…"));
  const r = await api.apart();
  clear(c);
  clearInterval(tick);
  if (!r.ok) { c.appendChild(errorState(() => apartSection(pane), { offline: r.offline })); return; }
  const me = store.person, partner = other(me);
  const journeys = r.data.journeys || [];
  const mine = journeys.find((j) => j.person === me) || null;
  const theirs = journeys.find((j) => j.person === partner) || null;
  const reload = () => apartSection(pane);

  // both looking at the same screen, right now
  if (rt.partnerHere) {
    c.appendChild(h("section", { class: "tcard glass tone-warm same-sky" },
      h("div", { class: "hero-k" }, "تحت سماءٍ واحدة"),
      h("p", { class: "hero-s" }, PEOPLE[partner].name + (partner === "her" ? " تفتح" : " يفتح") + " التطبيق الآن — أنتما هنا في اللحظة نفسها 🤍")));
  }

  // the other one, on the way
  if (theirs) {
    const [, emo, lbl] = whereOf(theirs.kind);
    const card = h("section", { class: "tcard glass journey", "aria-label": "في الطريق" },
      h("div", { class: "jr-head" }, h("span", { class: "jr-ic", "aria-hidden": "true" }, emo),
        h("div", {}, h("b", {}, PEOPLE[partner].name + (partner === "her" ? " في طريقها " : " في طريقه ") + (theirs.label || lbl)),
          h("span", { class: "jr-eta" }, ""))));
    c.appendChild(card);
    const etaEl = card.querySelector(".jr-eta");
    const paint = () => { etaEl.textContent = etaText(theirs.eta); };
    paint(); tick = setInterval(paint, 20000);
  }

  // this one, on the way
  if (mine) {
    const [, emo, lbl] = whereOf(mine.kind);
    c.appendChild(h("section", { class: "tcard glass journey mine" },
      h("div", { class: "jr-head" }, h("span", { class: "jr-ic", "aria-hidden": "true" }, emo),
        h("div", {}, h("b", {}, "أنت في الطريق " + (mine.label || lbl)), h("span", { class: "jr-eta" }, etaText(mine.eta)))),
      h("button", { class: "btn hero-go", onclick: async () => {
        const r2 = await api.journeyArrive(rt.partnerHere);
        if (!r2.ok) { toast("تعذّر الحفظ"); return; }
        sound.celebrate(); haptic.success(); rt.signal("apart"); reload();
      } }, "🏡 وصلت")));
  } else {
    c.appendChild(h("button", { class: "btn hero-go", onclick: () => startJourney(reload) }, "🚗 " + __g("أنا في الطريق", "أنا في الطريق")));
  }

  // when the two of them are in one place again
  const cds = r.data.countdowns || [];
  if (cds.length) {
    c.appendChild(h("div", { class: "rest-head" }, h("span", {}, "قريبًا")));
    for (const cd of cds) {
      const left = Math.ceil((Date.parse(cd.target_date + "T00:00:00+03:00") - Date.now()) / 86400000);
      c.appendChild(h("button", { class: "tcard plain cd-row", onclick: () => go("us/calendar") },
        h("span", { class: "cd-emo", "aria-hidden": "true" }, cd.emoji || "⏳"),
        h("div", {}, h("b", {}, cd.title), h("span", {}, left <= 0 ? "اليوم" : "بعد " + arNum(left) + (left >= 3 && left <= 10 ? " أيام" : " يوم"))),
        h("span", { class: "go", "aria-hidden": "true" }, icon("back", { size: 18 }))));
    }
  } else {
    c.appendChild(h("button", { class: "btn ghost sm", style: { marginTop: "10px" }, onclick: () => go("us/calendar") }, "أضيفا موعد لقائكما القادم"));
  }
}

function etaText(eta) {
  if (!eta) return "";
  const mins = Math.round((Date.parse(eta) - Date.now()) / 60000);
  if (mins > 1) return "يصل بعد " + arNum(mins) + " دقيقة";
  if (mins >= -2) return "يصل الآن";
  return "تأخّر " + arNum(-mins) + " دقيقة";
}

function startJourney(reload) {
  let kind = "home", minutes = 20;
  const label = h("input", { class: "field", placeholder: "إلى أين؟ (اختياري)", maxLength: 60 });
  const wrap = h("div", { class: "kind-chips" }, ...WHERE.map(([k, emo, lbl]) => {
    const b = h("button", { class: "kind-chip" + (k === kind ? " on" : ""), onclick: () => {
      kind = k; wrap.querySelectorAll(".kind-chip").forEach((x) => x.classList.remove("on")); b.classList.add("on");
    } }, emo + " " + lbl);
    return b;
  }));
  const mins = h("div", { class: "kind-chips" }, ...MINUTES.map((m) => {
    const b = h("button", { class: "kind-chip" + (m === minutes ? " on" : ""), onclick: () => {
      minutes = m; mins.querySelectorAll(".kind-chip").forEach((x) => x.classList.remove("on")); b.classList.add("on");
    } }, arNum(m) + " د");
    return b;
  }));
  const { close } = openSheet({
    title: "أنا في الطريق",
    subtitle: "يصل إشعارٌ الآن، وآخر حين تصل",
    body: [wrap, mins, label, h("button", { class: "btn hero-go", onclick: async () => {
      const r = await api.journeyStart(kind, minutes, label.value.trim() || null, rt.partnerHere);
      if (!r.ok) { toast(r.offline ? "لا اتصال — لم يُرسل" : "تعذّر الإرسال"); return; }
      sound.post(); haptic.success(); rt.signal("apart"); close(true); reload();
    } }, "أخبراه" .replace("أخبراه", __g("أخبرها", "أخبره")))],
  });
}
