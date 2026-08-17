// يومياتنا — ذكرياتنا: on-device semantic search + recap + printable book.
// Embeddings run fully on-device (transformers.js). Text never leaves the device
// for inference; only the resulting vector is stored (in our own Supabase/pgvector).
import { h, clear, personChip, arNum, toast, fullDate } from "./ui.js";
import { api } from "./api.js";
import { PEOPLE, moodEmoji } from "./config.js";

const EMBED_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2";
const EMBED_MODEL = "Xenova/multilingual-e5-small"; // 384-d, multilingual (Arabic-capable)

let _pipe = null, _loading = null;
async function getEmbedder(onProgress) {
  if (_pipe) return _pipe;
  if (_loading) return _loading;
  _loading = (async () => {
    const mod = await import(EMBED_URL);
    mod.env.allowLocalModels = false;
    _pipe = await mod.pipeline("feature-extraction", EMBED_MODEL, { progress_callback: onProgress });
    return _pipe;
  })();
  return _loading;
}
async function embedText(text, kind) {
  const pipe = await getEmbedder();
  const input = (kind === "query" ? "query: " : "passage: ") + text;
  const out = await pipe(input, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

export async function buildIndex(onProgress) {
  let total = 0;
  for (;;) {
    const r = await api.entriesToEmbed(20);
    const items = r.ok ? r.data.items : [];
    if (!items.length) break;
    for (const e of items) {
      try { const vec = await embedText(e.body, "passage"); await api.setEmbedding(e.id, vec); total++; onProgress && onProgress(total); } catch { /* skip */ }
    }
    if (items.length < 20) break;
  }
  return total;
}
async function semanticSearch(query) {
  const vec = await embedText(query, "query");
  const r = await api.search(vec, 12);
  return r.ok ? r.data.items : [];
}

/* ---------- recap (template, private, from real data) ---------- */
async function recap(from, to) {
  const r = await api.periodMoments(from, to);
  return composeRecap(r.ok ? r.data.items : []);
}
function composeRecap(items) {
  if (!items.length) return "لا لحظات في هذه الفترة بعد… ابدآ بصنع الذكريات 🌙";
  const n = items.length;
  const byMood = {}; items.forEach((m) => { if (m.mood) byMood[m.mood] = (byMood[m.mood] || 0) + 1; });
  const top = Object.entries(byMood).sort((a, b) => b[1] - a[1])[0];
  const byHim = items.filter((m) => m.author === "him").length;
  const lines = [];
  lines.push(`في هذه الفترة كتبتما ${arNum(n)} لحظة معًا 🌙`);
  lines.push(`سعيد كتب ${arNum(byHim)}، وياسمين ${arNum(n - byHim)}.`);
  if (top) lines.push(`أكثر ما شعرتما به: ${moodEmoji(top[0])} ${top[0]}.`);
  const hi = items.filter((m) => m.body && m.body.trim().length > 8).slice(-3).reverse();
  if (hi.length) { lines.push("\nمن أجمل ما دوّنتما:"); hi.forEach((m) => lines.push(`• «${m.body.trim().slice(0, 90)}»`)); }
  lines.push("\nكل لحظة بينكما نعمة… أدامها الله عليكما 🤲");
  return lines.join("\n");
}
function periodContext(items) { return items.filter((m) => m.body).map((m) => (PEOPLE[m.author]?.name || "") + ": " + m.body).join("\n").slice(0, 1800); }

/* ---------- optional on-device LLM (WebGPU only) ---------- */
let _llm = null;
async function aiLetter(context, onProgress) {
  if (!navigator.gpu) throw new Error("no-webgpu");
  const webllm = await import("https://esm.run/@mlc-ai/web-llm");
  if (!_llm) _llm = await webllm.CreateMLCEngine("Qwen2.5-1.5B-Instruct-q4f16_1-MLC", { initProgressCallback: onProgress });
  const res = await _llm.chat.completions.create({
    messages: [
      { role: "system", content: "أنت كاتب رومانسي دافئ. اكتب رسالة قصيرة بالعربية الفصحى من سعيد وياسمين معًا، مستوحاة من لحظاتهما التالية. لا تتجاوز ٦ أسطر، وابدأها بـ«حبيبتي/حبيبي»." },
      { role: "user", content: context },
    ], temperature: 0.7, max_tokens: 320,
  });
  return res.choices?.[0]?.message?.content || "";
}

/* ---------- printable book ---------- */
async function exportBook() {
  const r = await api.timeline();
  const items = (r.ok ? r.data.items : []).slice().reverse();
  const book = h("div", { id: "book-print" },
    h("h1", {}, "كتابنا · يومياتنا"),
    h("div", { class: "bp-sub" }, "صفحاتٌ بيننا 🌙"));
  if (!items.length) book.appendChild(h("div", { class: "bp-body" }, "لا لحظات بعد."));
  items.forEach((e) => book.appendChild(h("div", { class: "bp-moment" },
    h("div", { class: "bp-date" }, fullDate(e.happened_at) + " · " + (PEOPLE[e.author]?.name || "")),
    e.mood ? h("div", { class: "bp-mood" }, moodEmoji(e.mood) + " " + e.mood) : null,
    h("div", { class: "bp-body" }, e.body || ""))));
  document.body.appendChild(book);
  document.body.classList.add("printing");
  const done = () => { book.remove(); document.body.classList.remove("printing"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  setTimeout(() => { try { window.print(); } catch { done(); } setTimeout(() => { if (document.getElementById("book-print")) done(); }, 60000); }, 60);
}

/* ---------- view ---------- */
export function viewSearch(content) {
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "بحث وذكريات")));
  const status = h("div", { class: "muted", style: { minHeight: "20px", margin: "4px 0" } });
  const inp = h("input", { class: "field", placeholder: "ابحثا في ذكرياتكما بالمعنى…" });
  const results = h("div", { class: "search-results" });
  async function doSearch() {
    const q = inp.value.trim(); if (!q) return;
    try {
      if (!_pipe) status.textContent = "نحضّر النموذج على جهازكما (مرة واحدة)…";
      await getEmbedder((p) => { if (p && p.status === "progress" && p.progress) status.textContent = "تحميل النموذج… " + Math.round(p.progress) + "٪"; });
      status.textContent = "نبحث…";
      const items = await semanticSearch(q);
      status.textContent = items.length ? "" : "لا نتائج — جرّبا «بناء الفهرس» أولًا.";
      clear(results);
      items.forEach((e) => results.appendChild(h("div", { class: "search-item " + (e.author || ""), onclick: () => (location.hash = "#/moment/" + e.id) },
        h("div", { class: "m-head", style: { marginBottom: "4px" } }, personChip(e.author), h("span", { class: "when" }, fullDate(e.happened_at))),
        h("div", {}, e.body))));
    } catch { status.textContent = "تعذّر البحث على هذا الجهاز (يتطلب متصفحًا حديثًا)."; }
  }
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
  content.appendChild(h("div", { class: "row", style: { gap: "8px" } }, inp, h("button", { class: "btn sun sm", onclick: doSearch }, "ابحثا")));
  content.appendChild(status);
  content.appendChild(results);
  content.appendChild(h("button", { class: "btn ghost sm", style: { marginTop: "10px" }, onclick: async (e) => { const b = e.currentTarget; b.textContent = "نفهرس…"; const n = await buildIndex((c) => { b.textContent = "فُهرس " + arNum(c) + "…"; }); b.textContent = "بناء الفهرس 🔎"; toast("فُهرست " + arNum(n) + " لحظة"); } }, "بناء الفهرس 🔎"));

  content.appendChild(h("div", { class: "section-title", style: { marginTop: "22px" } }, h("h2", { class: "t-h2" }, "خلاصتنا ✨")));
  content.appendChild(h("div", { class: "attach-rail" },
    h("button", { class: "btn coral sm", onclick: () => showRecap("month") }, "رسالة الشهر 💌"),
    h("button", { class: "btn coral sm", onclick: () => showRecap("year") }, "خلاصة العام ✨")));
  content.appendChild(h("button", { class: "btn ghost", style: { marginTop: "12px" }, onclick: () => exportBook() }, "📖 احفظا ككتاب (PDF)"));

  async function showRecap(period) {
    const now = new Date(Date.now() + 180 * 60000);
    const from = period === "month" ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString() : new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
    const to = now.toISOString();
    const pm = await api.periodMoments(from, to);
    const items = pm.ok ? pm.data.items : [];
    const bodyEl = h("div", { class: "letter-body" }, composeRecap(items));
    const modalInner = h("div", { class: "modal" }, h("h3", {}, period === "month" ? "رسالة الشهر 💌" : "خلاصة العام ✨"), bodyEl);
    if (navigator.gpu && items.length) {
      const aiBtn = h("button", { class: "btn sun sm", style: { marginTop: "10px" }, onclick: async () => {
        aiBtn.disabled = true; aiBtn.textContent = "يكتب على جهازكما…";
        try { const letter = await aiLetter(periodContext(items), (p) => { if (p && p.text) aiBtn.textContent = "تحميل… " + (p.progress ? Math.round(p.progress * 100) + "٪" : ""); }); bodyEl.textContent = letter || bodyEl.textContent; aiBtn.remove(); }
        catch { toast("الذكاء غير متاح على هذا الجهاز"); aiBtn.disabled = false; aiBtn.textContent = "✨ اكتبها بالذكاء"; }
      } }, "✨ اكتبها بالذكاء (على جهازكما)");
      modalInner.appendChild(aiBtn);
    }
    modalInner.appendChild(h("button", { class: "btn ghost", style: { marginTop: "14px" }, onclick: () => sc.remove() }, "أغلقا"));
    const sc = h("div", { class: "scrim center" }, modalInner);
    document.body.appendChild(sc);
  }
}
