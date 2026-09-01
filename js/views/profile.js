// يومياتنا — profile: a page for each of them, with their own photo as the face
// they wear across the whole app.
import { api } from "../api.js";
import { store } from "../store.js";
import { sound } from "../sound.js";
import { haptic } from "../haptics.js";
import { h, clear, arNum, toast, avatar, fullDate } from "../ui.js";
import { PEOPLE, other, moodEmoji } from "../config.js";
import { go, loader, errorState, refreshAvatars, confirmAsk } from "../helpers.js";
import { downscale, uploadSigned } from "../media.js";
import { icon } from "../icons.js";

export async function viewProfile(content, who) {
  const person = who === "her" ? "her" : "him";
  const p = PEOPLE[person];
  const isMe = store.person === person;
  const c = clear(content);
  c.appendChild(h("div", { class: "sub-head" },
    h("button", { class: "icon-btn", "aria-label": "رجوع", onclick: () => go("home") }, icon("back")),
    h("div", { class: "sh-title" }, isMe ? "أنا" : p.name)));

  const box = h("div", { class: "profile stagger" }, h("div", { class: "muted", style: { textAlign: "center", padding: "24px" } }, "…"));
  c.appendChild(box);

  const [prof, rt, ms] = await Promise.all([api.getProfile(), api.ritualsToday(), api.milestones()]);
  clear(box);
  if (!prof.ok) { box.appendChild(errorState(() => viewProfile(content, who), { offline: prof.offline })); return; }
  const mine = (prof.data.profiles || {})[person] || {};
  store.profiles = prof.data.profiles;

  // ---- hero ----
  const face = h("div", { class: "pf-face " + p.cls }, avatar(person, "xl"));
  const hero = h("div", { class: "card pf-hero" },
    face,
    h("div", { class: "pf-name" }, p.name),
    h("div", { class: "pf-about muted" }, mine.about || (isMe ? "أضف سطرًا يشبهك…" : "")));
  box.appendChild(hero);

  if (isMe) {
    const fileInput = h("input", { type: "file", accept: "image/*", class: "hidden", onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return; e.target.value = "";
      loader(true);
      try {
        const ds = await downscale(f, 512, 0.86);
        const su = await api.signUpload("photo", "image/jpeg"); if (!su.ok) throw 0;
        const ok = await uploadSigned(su.data.signedUrl, ds.blob, "image/jpeg"); if (!ok) throw 0;
        const r = await api.setProfile({ avatar: su.data.path }); if (!r.ok) throw 0;
        await refreshAvatars();
        loader(false); sound.post(); haptic.success(); toast("صار وجهك الجديد 🤍");
        viewProfile(content, who);
      } catch { loader(false); toast("تعذّر تغيير الصورة"); }
    } });
    box.appendChild(fileInput);
    const actions = h("div", { class: "row-btns" },
      h("button", { class: "btn sm", onclick: () => fileInput.click() }, "📷 " + (store.avatarUrl(person) ? "غيّر صورتك" : "ضع صورتك")),
      store.avatarUrl(person) ? h("button", { class: "btn ghost sm", onclick: async () => {
        if (!(await confirmAsk("إزالة صورتك والعودة للحرف؟", { okText: "إزالة" }))) return;
        loader(true); const r = await api.setProfile({ avatar: null }); loader(false);
        if (r.ok) { store.setAvatars({ ...store.avatars, [person]: undefined }); await refreshAvatars(); toast("أُزيلت الصورة"); viewProfile(content, who); }
        else toast("تعذّر");
      } }, "أزل الصورة") : null);
    box.appendChild(h("div", { class: "card", style: { padding: "14px" } }, actions,
      h("label", { class: "lbl" }, "سطرٌ عنك"),
      (() => {
        const ta = h("textarea", { class: "field", rows: 2, maxLength: 300, placeholder: "أنا الذي/التي…", value: mine.about || "" });
        const save = h("button", { class: "btn sm", style: { marginTop: "10px", width: "auto" }, onclick: async () => {
          loader(true); const r = await api.setProfile({ about: ta.value.trim() }); loader(false);
          if (r.ok) { sound.post(); toast("حُفظ 🤍"); viewProfile(content, who); } else toast("تعذّر");
        } }, "احفظ");
        return h("div", {}, ta, save);
      })()));
  }

  // ---- little truths about them ----
  const facts = h("div", { class: "pf-facts" });
  const checkin = rt.ok && rt.data.checkin ? (person === store.person ? rt.data.checkin.mine : rt.data.checkin.theirs) : null;
  if (checkin && checkin.mood) facts.appendChild(fact(moodEmoji(checkin.mood) || "🌈", "شعورُ اليوم", checkin.mood));
  if (ms.ok && ms.data.days_together != null) facts.appendChild(fact("🤍", "معًا منذ", arNum(ms.data.days_together) + " يومًا"));
  if (ms.ok && ms.data.anniversary_date) facts.appendChild(fact("💍", "بدايتنا", fullDate(ms.data.anniversary_date)));
  if (facts.children.length) box.appendChild(h("div", { class: "card" }, h("h2", { class: "t-h2", style: { marginBottom: "12px", fontSize: "17px" } }, "من دفترنا"), facts));

  if (!isMe) box.appendChild(h("button", { class: "btn", onclick: () => go("chat") }, "💬 اهمس " + (person === "her" ? "لها" : "له")));
}

function fact(emoji, label, value) {
  return h("div", { class: "pf-fact" }, h("span", { class: "pf-e" }, emoji), h("span", { class: "muted" }, label), h("b", {}, value));
}
