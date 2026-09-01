// يومياتنا — حكاية: memories played full-screen like a film.
// Photos drift slowly (Ken Burns), words appear as typographic cards; segmented
// progress bars, hold to pause, tap the reading edge to advance. RTL-aware.
import { api } from "../api.js";
import { store } from "../store.js";
import { sound } from "../sound.js";
import { haptic } from "../haptics.js";
import { h, clear, arNum, fullDate, noMotion, sparkleAt } from "../ui.js";
import { PEOPLE, moodEmoji } from "../config.js";
import { go, errorState } from "../helpers.js";
import { icon } from "../icons.js";
import { art } from "../art.js";

const PHOTO_MS = 5000, TEXT_MS = 6500, MAX_SLIDES = 42;
let cache = null;

async function gatherSlides() {
  if (cache) return cache;
  const all = [];
  let cursor = null, pages = 0, ok = false;
  do {
    const r = await api.timeline(cursor);
    if (!r.ok) break;
    ok = true; all.push(...r.data.items);
    cursor = r.data.next_cursor; pages++;
  } while (cursor && pages < 8);
  if (!ok && !all.length) return { ok: false, slides: [] };
  const chrono = all.slice().reverse();               // a story reads oldest → newest
  const slides = [];
  for (const e of chrono) {
    const photo = (e.media || []).find((m) => m.kind === "photo" && m.signed_url);
    if (photo) slides.push({ kind: "photo", url: photo.signed_url, e });
    else if (e.body) slides.push({ kind: "text", e });
    if (slides.length >= MAX_SLIDES) break;
  }
  cache = { ok: true, slides };
  return cache;
}

export async function viewStory() {
  const app = clear(document.getElementById("app"));
  const stage = h("div", { class: "story" },
    h("div", { class: "muted", style: { margin: "auto", color: "#EDE4DC" } }, "نحضّر حكايتكما…"));
  app.appendChild(stage);

  const data = await gatherSlides();
  if (!data.ok) { clear(stage); stage.style.display = "block"; stage.appendChild(errorState(() => { cache = null; viewStory(); })); return; }
  if (!data.slides.length) {
    clear(stage);
    stage.appendChild(h("div", { class: "story-empty" }, art("journal", { size: 150 }),
      h("div", { style: { color: "#EDE4DC", lineHeight: 1.9 } }, "حكايتكما تبدأ بأول لحظة تدوّنانها 🤍"),
      h("button", { class: "btn", style: { width: "auto" }, onclick: () => go("journal") }, "إلى الدفتر")));
    return;
  }

  const slides = data.slides;
  let i = 0, timer = null, paused = false, startAt = 0, remaining = 0;
  const still = noMotion();

  const bars = h("div", { class: "story-bars" });
  slides.forEach(() => bars.appendChild(h("span", { class: "sb" }, h("i"))));
  const closeBtn = h("button", { class: "story-close", "aria-label": "إغلاق", onclick: () => leave() }, icon("close", { size: 22 }));
  const frame = h("div", { class: "story-frame" });
  clear(stage); stage.append(bars, closeBtn, frame);

  paint();

  function durOf(s) { return s.kind === "photo" ? PHOTO_MS : TEXT_MS; }
  function paint() {
    const s = slides[i];
    clear(frame);
    if (s.kind === "photo") {
      const img = h("img", { class: "story-img" + (still ? "" : " kb kb" + (i % 4)), src: s.url, alt: "" });
      frame.appendChild(img);
      frame.appendChild(h("div", { class: "story-shade" }));
      if (s.e.body) frame.appendChild(h("div", { class: "story-cap" }, s.e.body));
    } else {
      frame.appendChild(h("div", { class: "story-quote tone" + (i % 3) },
        h("div", { class: "sq-mark" }, "❝"),
        h("div", { class: "sq-text" }, s.e.body)));
    }
    frame.appendChild(h("div", { class: "story-meta" },
      (PEOPLE[s.e.author] || PEOPLE.him).name + " · " + fullDate(s.e.happened_at || s.e.created_at) + (s.e.mood ? " · " + moodEmoji(s.e.mood) : "")));
    // progress
    [...bars.children].forEach((b, n) => {
      const fill = b.firstChild;
      fill.style.transition = "none";
      fill.style.width = n < i ? "100%" : "0%";
    });
    const fill = bars.children[i].firstChild;
    remaining = durOf(s);
    requestAnimationFrame(() => {
      fill.style.transition = `width ${remaining}ms linear`;
      fill.style.width = "100%";
    });
    startAt = Date.now();
    clearTimeout(timer);
    timer = setTimeout(next, remaining);
  }
  function next() { if (i >= slides.length - 1) { finale(); return; } i++; sound.page(); paint(); }
  function prev() { if (i === 0) return; i--; sound.page(); paint(); }
  function pause() {
    if (paused) return; paused = true;
    clearTimeout(timer);
    remaining -= Date.now() - startAt;
    const fill = bars.children[i].firstChild;
    const w = fill.getBoundingClientRect().width / bars.children[i].getBoundingClientRect().width * 100;
    fill.style.transition = "none"; fill.style.width = w + "%";
    frame.classList.add("held");
  }
  function resume() {
    if (!paused) return; paused = false;
    const fill = bars.children[i].firstChild;
    requestAnimationFrame(() => { fill.style.transition = `width ${Math.max(200, remaining)}ms linear`; fill.style.width = "100%"; });
    startAt = Date.now();
    timer = setTimeout(next, Math.max(200, remaining));
    frame.classList.remove("held");
  }
  function finale() {
    clearTimeout(timer);
    clear(frame);
    frame.appendChild(h("div", { class: "story-quote tone1" },
      h("div", { class: "sq-text", style: { fontSize: "26px" } }, "وحكايتُكما مستمرة…"),
      h("div", { style: { color: "#D9CDC2", marginTop: "10px", fontSize: "14px" } }, arNum(slides.length) + " لحظة حتى اليوم 🤍"),
      h("div", { class: "row-btns", style: { marginTop: "22px" } },
        h("button", { class: "btn ghost", style: { color: "#EDE4DC", borderColor: "rgba(255,255,255,.3)" }, onclick: () => leave() }, "إغلاق"),
        h("button", { class: "btn", onclick: () => { i = 0; sound.chime(); paint(); } }, "من البداية ↻"))));
    [...bars.children].forEach((b) => { b.firstChild.style.transition = "none"; b.firstChild.style.width = "100%"; });
    sparkleAt(innerWidth / 2, innerHeight / 2, ["🤍", "✨", "🌙"]);
    sound.chime(); haptic.success();
  }
  function leave() { clearTimeout(timer); cache = null; go("journal"); }

  // touch: hold to pause; tap edges to move (RTL: forward is the LEFT edge)
  let downT = 0;
  frame.addEventListener("pointerdown", () => { downT = Date.now(); pause(); });
  frame.addEventListener("pointerup", (e) => {
    const held = Date.now() - downT > 240;
    resume();
    if (held) return;
    const x = e.clientX / innerWidth;
    if (x < 0.4) next(); else if (x > 0.6) prev(); else { /* center: keep playing */ }
    haptic.tap();
  });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { document.removeEventListener("keydown", esc); leave(); }
  });
}
