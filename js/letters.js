// يومياتنا — رسائل الغد: time-capsule letters sealed until a future date.
import { h, clear, personChip, arNum, toast, fullDate } from "./ui.js";
import { api } from "./api.js";
import { sound } from "./sound.js";
import { PEOPLE } from "./config.js";

export async function viewLetters(content) {
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "رسائل الغد")));
  content.appendChild(h("button", { class: "btn coral", style: { marginBottom: "14px" }, onclick: () => writeModal(content) }, "✍️ اكتبا رسالة للغد"));
  const list = h("div", { class: "letters" }, h("div", { class: "empty", style: { padding: "20px" } }, "…"));
  content.appendChild(list);
  const r = await api.listLetters();
  clear(list);
  const items = r.ok ? r.data.items : [];
  if (!items.length) { list.appendChild(h("div", { class: "empty" }, h("div", { class: "big" }, "✉️"), h("div", {}, "لا رسائل بعد… اكتبا رسالة تُفتح في المستقبل 💌"), h("div", { class: "dua" }, "كلماتٌ تنتظر يومها."))); return; }
  items.forEach((l) => list.appendChild(letterCard(l)));
}

function letterCard(l) {
  const card = h("div", { class: "letter-card " + (l.unlocked ? "open" : "sealed") });
  card.appendChild(h("div", { class: "lc-top" }, h("span", { class: "lc-ic" }, l.unlocked ? "✉️" : "🔒"), h("b", {}, l.title || "رسالة"), personChip(l.author)));
  if (l.unlocked) {
    card.appendChild(h("div", { class: "muted" }, "جاهزة — " + fullDate(l.unlock_at)));
    card.appendChild(h("button", { class: "btn sm sun", style: { marginTop: "8px" }, onclick: async () => { const r = await api.openLetter(l.id); if (r.ok) { readModal(r.data.letter); sound.page(); } else toast("تعذّر"); } }, "اقرآها"));
  } else {
    const days = Math.ceil((new Date(l.unlock_at).getTime() - Date.now()) / 86400000);
    card.appendChild(h("div", { class: "muted" }, "🔒 تُفتح في " + fullDate(l.unlock_at)));
    card.appendChild(h("div", { class: "lc-days" }, days > 0 ? "بعد " + arNum(days) + " يوم" : "قريبًا"));
  }
  return card;
}
function readModal(l) {
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" },
    h("h3", {}, l.title || "رسالة"),
    h("div", { class: "letter-body" }, l.body),
    h("div", { class: "muted", style: { marginTop: "10px", textAlign: "center" } }, "— " + (PEOPLE[l.author]?.name || "")),
    h("button", { class: "btn ghost", style: { marginTop: "14px" }, onclick: () => sc.remove() }, "أغلقا")));
  document.body.appendChild(sc);
}
function writeModal(content) {
  const title = h("input", { class: "field", placeholder: "عنوان (اختياري)" });
  const body = h("textarea", { class: "field", rows: 5, placeholder: "اكتبا ما في قلبكما… تُفتح في يومها 💌" });
  const when = h("input", { class: "field", type: "date" });
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" },
    h("h3", {}, "رسالة للغد ✉️"),
    h("label", { class: "lbl" }, "العنوان"), title,
    h("label", { class: "lbl" }, "الرسالة"), body,
    h("label", { class: "lbl" }, "تُفتح في"), when,
    h("div", { class: "attach-rail", style: { marginTop: "14px" } },
      h("button", { class: "btn ghost", onclick: () => sc.remove() }, "إلغاء"),
      h("button", { class: "btn coral", onclick: async () => {
        const b = body.value.trim(), w = when.value;
        if (!b) { body.focus(); return; } if (!w) { when.focus(); return; }
        const unlock_at = new Date(w + "T00:00:00").toISOString();
        const r = await api.addLetter({ title: title.value.trim(), body: b, unlock_at });
        if (r.ok) { sc.remove(); sound.post(); viewLetters(clear(content)); toast("خُتمت الرسالة 💌"); } else toast("تعذّر");
      } }, "اختما وأرسلا"))));
  document.body.appendChild(sc);
}
