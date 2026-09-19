// يومياتنا — لحظتنا الآن.
//
// Once a day, at an hour the scheduler picks at random, both phones are asked
// for one photo of wherever they are. Each sees the other's only after posting
// their own — the server does not even send the other one's link before then.
// It is the daily question's reveal-on-both, for a picture instead of words:
// three seconds of effort where a written moment takes minutes, which is why
// moments were falling and this should not.
import { h, clear, arNum, toast, sparkleAt, fullDate } from "./ui.js";
import { api } from "./api.js";
import { store } from "./store.js";
import { PEOPLE, other } from "./config.js";
import { uploadSigned } from "./media.js";
import { loader, loaderNote, errorState } from "./helpers.js";
import { icon } from "./icons.js";
import { haptic } from "./haptics.js";
import { sound } from "./sound.js";
import { rt } from "./realtime.js";
import { takePhoto } from "./camera.js";
import { track } from "./track.js";
import { openLightbox } from "./lightbox.js";

const ON_TIME_MIN = 10;

// Today's state, from `home` (journal6) or from `now_state`/`now_post`.
export function normalizeNow(n) {
  if (!n) return { mine: null, theirs: null, revealed: false, prompt_at: null, notified_at: null };
  const mine = n.mine && (n.mine.url || n.mine.path) ? n.mine : null;
  const theirs = n.theirs && (n.theirs.first_at || n.theirs.posted) ? { ...n.theirs, posted: true } : null;
  return { mine, theirs, revealed: !!(mine && theirs && theirs.url), prompt_at: n.prompt_at || null,
    // the scheduler's hold marker (year 2000) means "not announced", not "announced long ago"
    notified_at: n.notified_at && !String(n.notified_at).startsWith("2000-") ? n.notified_at : null };
}

function phase(s) {
  if (s.revealed) return "revealed";
  if (s.mine) return "waiting";
  if (s.theirs) return "their-done";
  return s.notified_at ? "now" : "before";
}
const lateMinutes = (s) => {
  if (!s.mine || !s.notified_at) return 0;
  return Math.max(0, Math.round((Date.parse(s.mine.first_at) - Date.parse(s.notified_at)) / 60000) - ON_TIME_MIN);
};

export function nowCard(raw, { onChange } = {}) {
  const s = normalizeNow(raw);
  const p = phase(s);
  const partner = other(store.person), pn = PEOPLE[partner].name, she = partner === "her";
  const minsLeft = s.notified_at ? ON_TIME_MIN - Math.floor((Date.now() - Date.parse(s.notified_at)) / 60000) : 0;
  const sub = {
    before: "في ساعةٍ مفاجئة اليوم تصلكما إشارة — صوّرا ما حولكما حينها",
    now: minsLeft > 0 ? `حان وقتها — بقي ${arNum(minsLeft)} ${minsLeft > 2 && minsLeft < 11 ? "دقائق" : "دقيقة"}` : "حان وقتها — صوّر لحظتك، ولو متأخّرًا".replace("صوّر", __g("صوّر", "صوّري")),
    "their-done": `${pn} ${she ? "صوّرت لحظتها" : "صوّر لحظته"} — ${__g("صوّر", "صوّري")} لتنكشف الصورتان`,
    waiting: `بانتظار ${pn}… تنكشف الصورتان حين ${she ? "تصوّر" : "يصوّر"}`,
    revealed: "كُشفت لحظتكما — اضغطا لتكبيرها",
  }[p];

  const shot = (who, data, veiled) => {
    const box = h("div", { class: "now-shot" + (data && data.url ? "" : " empty") + (veiled ? " veiled" : "") });
    if (data && data.url) {
      box.appendChild(h("img", { src: data.url, alt: who === "me" ? "صورتك" : "صورة " + pn, loading: "lazy" }));
    } else if (veiled) {
      box.appendChild(h("span", { class: "lock" }, icon("check", { size: 20 })));
      box.appendChild(h("span", {}, she ? "صوّرت — بانتظارك" : "صوّر — بانتظارك"));
    } else {
      box.appendChild(icon("camera", { size: 26 }));
      box.appendChild(h("span", {}, who === "me" ? __g("صورتك", "صورتكِ") : (she ? "لم تصوّر بعد" : "لم يصوّر بعد")));
    }
    if (data && data.url) box.appendChild(h("span", { class: "who" }, who === "me" ? "أنت" : pn));
    if (who === "me" && lateMinutes(s) > 0) box.appendChild(h("span", { class: "late" }, "متأخّر " + arNum(lateMinutes(s)) + "د"));
    return box;
  };

  const pair = h("div", { class: "now-pair" }, shot("me", s.mine), shot("them", s.revealed ? s.theirs : null, !s.revealed && !!s.theirs));
  if (s.revealed) {
    pair.setAttribute("role", "button"); pair.tabIndex = 0;
    const open = () => openLightbox([{ url: s.mine.url, caption: "أنت" }, { url: s.theirs.url, caption: pn }], 0);
    pair.addEventListener("click", open);
    pair.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
  }

  const card = h("div", { class: "tcard glass now-card" },
    h("div", { class: "now-head" },
      h("span", { class: "now-ic" }, icon("camera", { size: 18 })),
      h("div", {}, h("div", { class: "now-title" }, "لحظتنا الآن"), h("div", { class: "now-sub" }, sub))),
    pair);
  const go = () => captureNow((st) => onChange && onChange(st));
  if (!s.mine && p !== "before") card.appendChild(h("button", { class: "btn now-cta", onclick: go }, "📸 " + __g("صوّر الآن", "صوّري الآن")));
  else if (p === "before") card.appendChild(h("button", { class: "btn ghost sm now-cta", onclick: go }, "لا تنتظرا — صوّرا الآن"));
  else if (s.mine && !s.revealed) card.appendChild(h("button", { class: "btn ghost sm now-cta", onclick: go }, "أعد التصوير"));
  return card;
}

// One photo, from the viewfinder inside the app. The hand-off to the phone
// camera still exists underneath (js/camera.js falls back to it when a phone
// refuses the stream), but nothing about this path leaves the page any more.
export async function captureNow(onDone) {
  const shot = await takePhoto();
  if (!shot) return;
  loader(true); loaderNote("نحفظ لحظتك…");
  try {
    const su = await api.signUpload("photo", "image/jpeg");
    if (!su.ok) throw new Error("sign");
    loaderNote("جارٍ الرفع…");
    if (!(await uploadSigned(su.data.signedUrl, shot.blob, "image/jpeg"))) throw new Error("upload");
    // the other one sees it live when they are in the app, so no notification then
    const r = await api.nowPost(su.data.path, { w: shot.width, h: shot.height }, null, rt.partnerHere);
    loader(false);
    if (!r.ok) {
      track("photo_failed", { status: r.status || 0, offline: !!r.offline });
      toast(r.offline ? "لا اتصال — لم تُحفظ لحظتك" : "تعذّر حفظ لحظتك");
      return;
    }
    track("photo_posted", { facing: shot.facing, w: shot.width, h: shot.height });
    sound.post(); haptic.success();
    rt.signal("now");
    const st = r.data.state;
    if (st && st.revealed) { sparkleAt(innerWidth / 2, innerHeight / 3, ["📸", "✨", "🤍"]); toast("انكشفت لحظتكما 📸"); }
    else toast("حُفظت لحظتك — بانتظار " + PEOPLE[other(store.person)].name);
    onDone && onDone(st);
  } catch (e) {
    loader(false);
    track("photo_failed", { m: String((e && e.message) || e).slice(0, 40) });
    toast("تعذّر رفع الصورة — جرّبا مرة أخرى");
  }
}

// Every day on which both posted, as pairs — for ذكرياتنا.
export async function nowArchive(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "18px" } }, "…"));
  const r = await api.nowHistory();
  clear(c);
  if (!r.ok) { c.appendChild(errorState(() => nowArchive(pane), { offline: r.offline })); return; }
  const items = r.data.items || [];
  if (!items.length) {
    c.appendChild(h("div", { class: "empty-card card" }, h("div", { class: "big" }, "📸"),
      h("div", { class: "muted" }, "هنا تُجمع صور «لحظتنا الآن» — كل يومٍ صوّرتما فيه معًا.")));
    return;
  }
  const list = h("div", { class: "feed" });
  for (const it of items) {
    const photos = [{ url: it.him.url, caption: PEOPLE.him.name }, { url: it.her.url, caption: PEOPLE.her.name }];
    const pair = h("button", { class: "now-pair", "aria-label": "لحظة " + fullDate(it.day), onclick: () => openLightbox(photos, 0) },
      h("div", { class: "now-shot" }, h("img", { src: it.him.url, alt: "", loading: "lazy" }), h("span", { class: "who" }, PEOPLE.him.name)),
      h("div", { class: "now-shot" }, h("img", { src: it.her.url, alt: "", loading: "lazy" }), h("span", { class: "who" }, PEOPLE.her.name)));
    list.appendChild(h("div", { class: "tcard plain" }, h("div", { class: "tk" }, fullDate(it.day)), pair));
  }
  c.appendChild(list);
}
