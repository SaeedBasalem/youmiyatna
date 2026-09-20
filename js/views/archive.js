// يومياتنا — أرشيفنا: the years that happened before this app existed.
//
// Everything the app could do with memory was built already; what it lacked
// was memory. This screen brings their real conversation in from a WhatsApp
// export, and after that recall, رسالة الشهر and "في مثل هذا اليوم" have
// something to find.
//
// The file never leaves the phone. It is opened, unzipped and parsed here in
// the page; only the rows they confirm — and the pictures they choose — are
// sent, and they go to the same private project everything else lives in.
import { api } from "../api.js";
import { store } from "../store.js";
import { h, clear, arNum, toast, fullDate } from "../ui.js";
import { PEOPLE } from "../config.js";
import { errorState, confirmAsk } from "../helpers.js";
import { icon } from "../icons.js";
import { haptic } from "../haptics.js";
import { sound } from "../sound.js";
import { downscale, uploadSigned } from "../media.js";
import { readZip, zipSupported } from "../zip.js";
import { parseChat, toRows, kindOfName } from "../wa.js";
import { openLightbox } from "../lightbox.js";
import { track } from "../track.js";

const MAX_MEDIA = 1500;                       // enough for years, short of a bill
const MAX_BYTES = 300 * 1024 * 1024;
const PAGE = 400;                             // rows per archive_add
const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const monthName = (ym) => AR_MONTHS[Number(String(ym).slice(5, 7)) - 1] + " " + arNum(String(ym).slice(0, 4));
const timeOf = (iso) => new Date(iso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" });
const mb = (n) => arNum(Math.round(n / (1024 * 1024))) + " م.ب";

// ---------------------------------------------------------------- the browser
export async function archiveSection(pane) {
  const c = clear(pane);
  c.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "18px" } }, "…"));
  const r = await api.archiveStats();
  clear(c);
  if (!r.ok) { c.appendChild(errorState(() => archiveSection(pane), { offline: r.offline })); return; }
  const st = r.data.stats || {};
  if (!st.n) { c.appendChild(emptyArchive(() => archiveSection(pane))); return; }

  c.appendChild(h("section", { class: "tcard glass arc-top" },
    h("div", { class: "arc-nums" },
      h("div", {}, h("b", {}, arNum(st.n)), h("span", {}, "رسالة")),
      h("div", {}, h("b", {}, arNum(st.days)), h("span", {}, "يوم")),
      h("div", {}, h("b", {}, arNum(st.media || 0)), h("span", {}, "صورة وصوت"))),
    h("p", { class: "arc-range" }, "من " + fullDate(st.first) + " إلى " + fullDate(st.last))));

  const results = h("div", { class: "arc-results" });
  const box = h("input", { class: "field", type: "search", placeholder: "ابحثا في كل ما قيل…", "aria-label": "بحث في الأرشيف" });
  let timer = null, seq = 0;
  box.addEventListener("input", () => {
    clearTimeout(timer);
    const q = box.value.trim();
    if (q.length < 2) { clear(results); return; }
    timer = setTimeout(async () => {
      const mine = ++seq;
      clear(results).appendChild(h("div", { class: "muted", style: { padding: "10px" } }, "…"));
      const s = await api.archiveSearch(q);
      if (mine !== seq) return;
      clear(results);
      if (!s.ok) { results.appendChild(h("div", { class: "muted" }, "تعذّر البحث")); return; }
      const items = s.data.items || [];
      track("archive_search", { n: items.length });
      if (!items.length) { results.appendChild(h("div", { class: "muted", style: { padding: "10px" } }, "لا شيء بهذه الكلمة")); return; }
      results.appendChild(h("div", { class: "rest-head" }, h("span", {}, arNum(items.length) + " نتيجة")));
      for (const it of items) results.appendChild(hit(it, s.data.urls || {}, pane));
    }, 350);
  });
  c.appendChild(h("div", { class: "arc-search" }, box));
  c.appendChild(results);

  const otd = h("div", {});
  c.appendChild(otd);
  onThisDay(otd, pane);

  const months = h("div", { class: "arc-months" }, h("div", { class: "muted", style: { padding: "10px" } }, "…"));
  c.appendChild(months);
  const m = await api.archiveMonths();
  clear(months);
  if (m.ok) months.appendChild(monthMap(m.data.months || [], pane));
}

function emptyArchive(reload) {
  const card = h("section", { class: "tcard glass arc-empty" },
    h("div", { class: "big" }, "🗂️"),
    h("h2", {}, "أرشيفنا فارغ"),
    h("p", { class: "muted" },
      "كل ما قيل بينكما قبل هذا التطبيق ما زال في واتساب. أدخِلاه هنا مرّة واحدة، " +
      "فتصير «في مثل هذا اليوم» و«رسالة الشهر» و«ابحثا في كلامنا» عن حياتكما الحقيقية."),
    h("p", { class: "arc-privacy" }, h("span", { "aria-hidden": "true" }, "🔒"), " يُقرأ الملف على هذا الجهاز وحده — لا يمرّ بأي خدمة أخرى."),
    h("button", { class: "btn hero-go", onclick: () => openImport(reload) }, "أدخِلا محادثتنا"));
  return card;
}

async function onThisDay(host, pane) {
  const r = await api.archiveOnThisDay();
  const items = (r.ok && r.data.items) || [];
  if (!items.length) return;
  const years = Object.keys(r.data.years || {}).sort().reverse();
  const card = h("section", { class: "tcard glass arc-otd" },
    h("div", { class: "arc-otd-head" }, h("span", {}, "🕰️"), h("b", {}, "في مثل هذا اليوم")));
  for (const y of years.slice(0, 3)) {
    const rows = r.data.years[y].slice(0, 2);
    const back = new Date().getFullYear() - Number(y);
    card.appendChild(h("div", { class: "arc-otd-year" },
      h("button", { class: "arc-year-btn", onclick: () => openDay(pane, rows[0].day) },
        arNum(back) + (back === 1 ? " سنة مضت" : back === 2 ? " سنتان مضتا" : back <= 10 ? " سنوات مضت" : " سنة مضت")),
      ...rows.map((x) => h("p", { class: "arc-otd-line" },
        h("i", {}, PEOPLE[x.author]?.name || ""), " " + (x.body || "📷").slice(0, 90)))));
  }
  host.appendChild(card);
}

function monthMap(months, pane) {
  const wrap = h("div", {});
  const byYear = new Map();
  let max = 1;
  for (const m of months) {
    const y = String(m.ym).slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, new Map());
    byYear.get(y).set(Number(String(m.ym).slice(5, 7)), Number(m.n));
    max = Math.max(max, Number(m.n));
  }
  wrap.appendChild(h("div", { class: "rest-head" }, h("span", {}, "تصفّحا شهرًا")));
  for (const [y, map] of [...byYear.entries()].sort().reverse()) {
    const row = h("div", { class: "arc-year" }, h("span", { class: "arc-y" }, arNum(y)));
    const cells = h("div", { class: "arc-cells" });
    for (let i = 1; i <= 12; i++) {
      const n = map.get(i) || 0;
      const lvl = n ? Math.max(1, Math.ceil((n / max) * 4)) : 0;
      const ym = y + "-" + String(i).padStart(2, "0");
      const cell = h("button", {
        class: "arc-cell lvl" + lvl, disabled: !n,
        "aria-label": AR_MONTHS[i - 1] + " " + y + (n ? " — " + n + " رسالة" : " — لا شيء"),
        onclick: () => openMonth(pane, ym),
      }, h("span", {}, AR_MONTHS[i - 1].slice(0, 3)));
      cells.appendChild(cell);
    }
    row.appendChild(cells);
    wrap.appendChild(row);
  }
  return wrap;
}

function hit(it, urls, pane) {
  const who = PEOPLE[it.author]?.name || "";
  return h("button", { class: "arc-hit", onclick: () => openDay(pane, it.day) },
    h("div", { class: "arc-hit-top" }, h("b", {}, who), h("span", {}, fullDate(it.sent_at))),
    h("p", {}, (it.body || "📷").slice(0, 180)));
}

// ---- a stretch of the thread, read the way it happened ----
async function openMonth(pane, ym) { await openThread(pane, { ym }, monthName(ym)); }
async function openDay(pane, day) { await openThread(pane, { day }, fullDate(day + "T12:00:00Z")); }

async function openThread(pane, range, title) {
  const c = clear(pane);
  // the screen already has a header with a back arrow; a second identical one
  // reads as a mistake, so the month announces itself as a breadcrumb instead
  c.appendChild(h("div", { class: "arc-crumb" },
    h("button", { class: "arc-back", onclick: () => archiveSection(pane) }, "→ الأرشيف"),
    h("b", {}, title)));
  const list = h("div", { class: "arc-thread" }, h("div", { class: "muted", style: { padding: "18px", textAlign: "center" } }, "…"));
  c.appendChild(list);

  let after = 0, first = true;
  const more = h("button", { class: "btn ghost", style: { display: "none" } }, "المزيد");
  c.appendChild(more);

  async function page() {
    const r = await api.archiveSlice({ ...range, limit: 120, after });
    if (first) { clear(list); first = false; }
    if (!r.ok) { list.appendChild(h("div", { class: "muted" }, "تعذّر الفتح")); return; }
    const items = r.data.items || [];
    const urls = r.data.urls || {};
    let lastDay = list.dataset.lastDay || "";
    for (const it of items) {
      if (it.day !== lastDay) { list.appendChild(h("div", { class: "arc-day" }, fullDate(it.day + "T12:00:00Z"))); lastDay = it.day; }
      list.appendChild(bubble(it, urls));
      after = it.id;
    }
    list.dataset.lastDay = lastDay;
    more.style.display = r.data.more ? "" : "none";
    if (!items.length && !list.children.length) list.appendChild(h("div", { class: "muted", style: { padding: "20px", textAlign: "center" } }, "لا شيء هنا"));
  }
  more.addEventListener("click", page);
  await page();
}

function bubble(it, urls) {
  const mine = it.author === store.person;
  const b = h("div", { class: "arc-msg " + (mine ? "me" : "them") + " " + (it.author || "") });
  const url = it.path && urls[it.path];
  const kind = (it.meta && it.meta.kind) || (it.path ? "image" : null);
  if (url && kind === "image") {
    const img = h("img", { src: url, alt: "صورة من أرشيفنا", loading: "lazy", decoding: "async" });
    const mw = Number(it.meta && it.meta.w), mh = Number(it.meta && it.meta.h);
    if (mw > 0 && mh > 0) img.style.aspectRatio = mw + " / " + mh;
    img.addEventListener("click", () => openLightbox([{ url, caption: fullDate(it.sent_at) }], 0));
    b.appendChild(h("div", { class: "arc-pic" }, img));
  } else if (url && kind === "audio") {
    b.appendChild(h("audio", { src: url, controls: true, preload: "none", class: "arc-audio" }));
  } else if (it.meta && it.meta.omitted) {
    b.appendChild(h("div", { class: "arc-omitted" }, icon("camera", { size: 14 }), " وسائط لم تُصدَّر"));
  }
  if (it.body) b.appendChild(h("p", {}, it.body));
  b.appendChild(h("span", { class: "arc-t" }, timeOf(it.sent_at)));
  return b;
}

// ---------------------------------------------------------------- the wizard
export function openImport(onDone) {
  const body = h("div", { class: "imp-body" });
  const panel = h("div", { class: "imp", role: "dialog", "aria-modal": "true", "aria-label": "إدخال محادثتنا" },
    h("div", { class: "imp-head" },
      h("b", {}, "أدخِلا محادثتنا"),
      h("button", { class: "icon-btn", "aria-label": "إغلاق", onclick: () => close() }, icon("close", { size: 18 }))),
    body);
  document.body.appendChild(panel);
  document.body.classList.add("no-scroll");
  let cancelled = false;
  function close() { cancelled = true; panel.remove(); document.body.classList.remove("no-scroll"); }

  // ---- step 1: how, and the promise about where the file goes
  function stepPick() {
    clear(body);
    body.appendChild(h("ol", { class: "imp-steps" },
      h("li", {}, "افتحا محادثتكما في واتساب"),
      h("li", {}, "من قائمة المحادثة: ", h("b", {}, "المزيد ← تصدير الدردشة")),
      h("li", {}, h("b", {}, "«إرفاق الوسائط»"), " لتدخل الصور معها، أو «بدون وسائط» للكلام وحده"),
      h("li", {}, "احفظا الملف في «الملفات»، ثم اختاراه هنا")));
    body.appendChild(h("p", { class: "arc-privacy" }, h("span", { "aria-hidden": "true" }, "🔒"),
      " يُفتح الملف ويُقرأ على هذا الجهاز. لا يُرسل منه شيء إلا ما تؤكّدانه في الخطوة التالية."));
    const input = h("input", { type: "file", accept: ".txt,.zip,text/plain,application/zip", class: "imp-file", id: "imp-file" });
    input.addEventListener("change", () => { if (input.files && input.files[0]) stepRead(input.files[0]); });
    body.appendChild(h("label", { class: "btn hero-go", for: "imp-file" }, "اختارا الملف"));
    body.appendChild(input);
    if (!zipSupported()) body.appendChild(h("p", { class: "muted sm" }, "هذا المتصفّح لا يفكّ ملفات zip — صدّرا «بدون وسائط» واختارا ملف ‎.txt"));
  }

  // ---- step 2: read it (locally)
  async function stepRead(file) {
    clear(body);
    body.appendChild(h("div", { class: "imp-busy" }, h("div", { class: "spin" }), h("p", {}, "نقرأ الملف على جهازكما…")));
    try {
      let text = "", zip = null, media = new Map();
      if (/\.zip$/i.test(file.name) || file.type === "application/zip") {
        if (!zipSupported()) throw new Error("no_zip");
        zip = await readZip(file);
        const chat = zip.entries.filter((e) => /\.txt$/i.test(e.name)).sort((a, b) => b.size - a.size)[0];
        if (!chat) throw new Error("no_chat_txt");
        text = await zip.text(chat);
        for (const e of zip.entries) {
          if (e === chat) continue;
          media.set(e.name.split("/").pop(), e);
        }
      } else {
        text = await file.text();
      }
      const parsed = parseChat(text);
      if (!parsed.senders.length) throw new Error("no_messages");
      track("archive_parsed", { n: parsed.stats.total, media: media.size });
      stepConfirm({ file, parsed, zip, media, text });
    } catch (e) {
      clear(body);
      const why = String(e && e.message) === "no_chat_txt" ? "لم نجد ملف المحادثة داخل هذا الـ zip"
        : String(e && e.message) === "no_messages" ? "لم نتعرّف على رسائل في هذا الملف"
        : String(e && e.message) === "no_zip" ? "هذا المتصفّح لا يفكّ ملفات zip"
        : "تعذّرت قراءة الملف";
      body.appendChild(h("div", { class: "imp-bad" }, h("p", {}, why),
        h("button", { class: "btn", onclick: stepPick }, "جرّبا ملفًا آخر")));
    }
  }

  // ---- step 3: whose words are whose
  function stepConfirm(ctx) {
    let { parsed } = ctx;
    const mapping = {};
    const me = store.person;
    const guess = parsed.senders.map((s) => s.name);
    if (guess.length === 2) { mapping[guess[0]] = me; mapping[guess[1]] = me === "him" ? "her" : "him"; }

    const render = () => {
      clear(body);
      const st = parsed.stats;
      body.appendChild(h("div", { class: "imp-sum" },
        h("b", {}, arNum(st.total - st.system) + " رسالة"),
        h("span", {}, st.first ? " من " + fullDate(new Date(st.first).toISOString()) + " إلى " + fullDate(new Date(st.last).toISOString()) : "")));

      // the date order, shown as a real date rather than a format string
      body.appendChild(h("div", { class: "imp-row" },
        h("span", {}, "أول رسالة: " + (st.first ? fullDate(new Date(st.first).toISOString()) : "—")),
        h("button", { class: "btn ghost sm", style: { width: "auto" }, onclick: () => {
          parsed = parseChat(ctx.text, { order: parsed.order === "dmy" ? "mdy" : "dmy" });
          ctx.parsed = parsed; render();
        } }, "التاريخ مقلوب؟")));

      body.appendChild(h("div", { class: "rest-head" }, h("span", {}, "من يكتب؟")));
      for (const s of parsed.senders.slice(0, 6)) {
        const chips = h("div", { class: "kind-chips" });
        for (const [k, label] of [["him", PEOPLE.him.name], ["her", PEOPLE.her.name], [null, "تجاهل"]]) {
          const b = h("button", { class: "kind-chip" + (mapping[s.name] === k ? " on" : ""), onclick: () => {
            mapping[s.name] = k;
            chips.querySelectorAll(".kind-chip").forEach((x) => x.classList.remove("on"));
            b.classList.add("on"); haptic.pick();
          } }, label);
          chips.appendChild(b);
        }
        body.appendChild(h("div", { class: "imp-sender" },
          h("div", { class: "imp-who" }, h("b", {}, s.name), h("span", {}, arNum(s.n) + " رسالة")), chips));
      }

      // media, only when the export actually carried it
      const jobs = mediaJobs(parsed, mapping, ctx.media);
      let withMedia = jobs.length > 0;
      if (jobs.length) {
        const cb = h("input", { type: "checkbox", id: "imp-media", checked: true });
        cb.addEventListener("change", () => { withMedia = cb.checked; });
        body.appendChild(h("label", { class: "imp-check", for: "imp-media" }, cb,
          h("span", {}, "أدخِلا " + arNum(Math.min(jobs.length, MAX_MEDIA)) + " صورة ومقطعًا صوتيًا"),
          h("i", {}, "تُصغَّر الصور قبل رفعها")));
      } else if (parsed.stats.omitted) {
        body.appendChild(h("p", { class: "muted sm" }, "هذا التصدير بلا وسائط — " + arNum(parsed.stats.omitted) + " صورة لم تأتِ معه."));
      }

      body.appendChild(h("button", { class: "btn hero-go", onclick: () => {
        const rows = toRows(parsed, mapping);
        if (!rows.length) { toast("لم تُنسب أي رسالة لأحدكما"); return; }
        stepRun(ctx, rows, withMedia ? mediaJobs(parsed, mapping, ctx.media) : []);
      } }, "ابدآ الإدخال"));
    };
    render();
  }

  // pair every row that named a file with the file itself, when the zip has it
  function mediaJobs(parsed, mapping, media) {
    if (!media || !media.size) return [];
    const out = [];
    for (const r of toRows(parsed, mapping)) {
      if (!r.media) continue;
      const entry = media.get(r.media);
      if (!entry) continue;
      const kind = kindOfName(r.media);
      if (kind !== "image" && kind !== "audio") continue;
      out.push({ dedupe: r.dedupe, entry, kind, name: r.media });
    }
    return out;
  }

  // ---- step 4: send it
  async function stepRun(ctx, rows, jobs) {
    clear(body);
    const bar = h("i", {});
    const label = h("p", { class: "imp-prog" }, "نبدأ…");
    body.appendChild(h("div", { class: "imp-bar" }, bar));
    body.appendChild(label);
    const stop = h("button", { class: "btn ghost", onclick: () => { cancelled = true; } }, "أوقِفا");
    body.appendChild(stop);
    const setProg = (done, total, what) => {
      bar.style.width = Math.round((done / Math.max(1, total)) * 100) + "%";
      label.textContent = what + " — " + arNum(done) + " من " + arNum(total);
    };

    const start = await api.importStart("whatsapp", ctx.file.name);
    if (!start.ok) { label.textContent = "تعذّر البدء"; return; }
    const batch = start.data.batch;
    track("archive_import_start", { rows: rows.length, media: jobs.length });

    // text first: it is the part that matters, and it is fast
    let added = 0;
    for (let i = 0; i < rows.length && !cancelled; i += PAGE) {
      const page = rows.slice(i, i + PAGE).map(({ media, ...keep }) => keep);
      const r = await api.archiveAdd(batch, page);
      if (!r.ok) { label.textContent = "تعثّر الإرسال — أعيدا المحاولة لاحقًا"; break; }
      added += r.data.added || 0;
      setProg(Math.min(i + PAGE, rows.length), rows.length, "الكلام");
    }

    // then the pictures, in lanes, resumable by simply importing the file again
    let up = 0, bytes = 0;
    const take = jobs.slice(0, MAX_MEDIA);
    const byType = new Map();
    for (const j of take) {
      const ct = j.kind === "image" ? "image/jpeg" : audioType(j.name);
      if (!byType.has(ct)) byType.set(ct, []);
      byType.get(ct).push(j);
    }
    for (const [ct, list] of byType) {
      for (let i = 0; i < list.length && !cancelled && bytes < MAX_BYTES; i += 25) {
        const chunk = list.slice(i, i + 25);
        const signed = await api.signMany(chunk.length, ct);
        if (!signed.ok) break;
        const slots = signed.data.items || [];
        const done = [];
        let next = 0;
        const lane = async () => {
          while (next < chunk.length && !cancelled && bytes < MAX_BYTES) {
            const k = next++;
            const job = chunk[k], slot = slots[k];
            if (!slot) continue;
            try {
              const raw = await ctx.zip.bytes(job.entry);
              let blob = raw, meta = { kind: job.kind, name: job.name };
              if (job.kind === "image") {
                const d = await downscale(raw, 1280, 0.82);
                blob = d.blob; meta.w = d.width; meta.h = d.height;
              } else if (raw.size > 6 * 1024 * 1024) continue;       // a long recording, left behind
              if (await uploadSigned(slot.signedUrl, blob, ct)) {
                bytes += blob.size; up++;
                done.push({ dedupe: job.dedupe, path: slot.path, meta });
              }
            } catch { /* one unreadable picture never stops the import */ }
            setProg(up, take.length, "الصور");
          }
        };
        await Promise.all([lane(), lane(), lane()]);
        if (done.length) await api.archiveMedia(done);
      }
    }

    const fin = await api.importDone(batch,
      rows.length ? rows[0].sent_at : null, rows.length ? rows[rows.length - 1].sent_at : null);
    track("archive_import_done", { added, media: up, cancelled: cancelled ? 1 : 0 });
    stepDone(batch, fin.ok ? fin.data : { n_rows: added, n_media: up }, cancelled);
    cancelled = false;
  }

  function stepDone(batch, res, wasStopped) {
    clear(body);
    sound.celebrate && sound.celebrate();
    haptic.success();
    body.appendChild(h("div", { class: "imp-done" },
      h("div", { class: "big" }, wasStopped ? "⏸️" : "🗂️"),
      h("h2", {}, wasStopped ? "أوقفناه" : "دخلت حياتكما"),
      h("p", {}, arNum(res.n_rows || 0) + " رسالة" + (res.n_media ? " و" + arNum(res.n_media) + " صورة" : "")),
      h("p", { class: "muted sm" }, "أعيدا الملف نفسه متى شئتما — لن يتكرّر شيء، وما نقص يكتمل.")));
    body.appendChild(h("button", { class: "btn hero-go", onclick: () => { close(); onDone && onDone(); } }, "افتحا أرشيفنا"));
    body.appendChild(h("button", { class: "btn danger", onclick: async () => {
      if (!(await confirmAsk("نحذف هذا الإدخال كلّه؟", { okText: "احذفاه", danger: true }))) return;
      const r = await api.archiveUndo(batch);
      toast(r.ok ? "حُذف" : "تعذّر الحذف");
      if (r.ok) { close(); onDone && onDone(); }
    } }, "تراجعا عن هذا الإدخال"));
  }

  stepPick();
}

const audioType = (name) => {
  const e = String(name).split(".").pop().toLowerCase();
  return e === "m4a" || e === "aac" ? "audio/mp4" : e === "mp3" ? "audio/mpeg" : e === "wav" ? "audio/wav" : "audio/ogg";
};
