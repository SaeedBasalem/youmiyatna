// يومياتنا — سؤال اليوم الواحد: the one thing the day asks for.
//
// Chapter Two put eleven cards on Today, and the day asked for nothing in
// particular. In the six days that followed: no photo, no wind-down, no
// heartbeat — while the same six notifications arrived and were ignored.
//
// So the screen leads with exactly one thing now, chosen here: the thing that
// is both possible at this hour and still unfinished. Everything else keeps
// existing, quietly, below it. The order is deliberate — what disappears if
// it is not done today comes before what can wait.
import { PEOPLE, other } from "./config.js";
import { store } from "./store.js";
import { normalizeNow } from "./now.js";
import { isNightNow } from "./winddown.js";

const TZ = 180 * 60000;
const localDay = () => new Date(Date.now() + TZ).toISOString().slice(0, 10);
const seenKey = (key) => "yn_ask_seen_" + key + "_" + localDay();
export const markSeen = (key) => { try { localStorage.setItem(seenKey(key), "1"); } catch {} };
const seen = (key) => { try { return localStorage.getItem(seenKey(key)) === "1"; } catch { return false; } };

// d is the payload from journal6 `home`. Returns one descriptor; the view
// decides what its button does.
export function pickAsk(d = {}) {
  const me = store.person || "him", partner = other(me);
  const pn = PEOPLE[partner] ? PEOPLE[partner].name : "";
  const she = partner === "her";
  const did = she ? "صوّرت" : "صوّر";
  const now = normalizeNow(d.now);
  const p = d.prompt || {};
  const wind = d.winddown || {};
  const mine = (d.rings && d.rings[me]) || {};
  const night = isNightNow();

  // 1. the photo, while today can still have one
  if (now.notified_at && !now.mine) {
    return now.theirs
      ? { key: "photo", tone: "warm", kicker: "لحظتنا الآن", title: pn + " " + did + " لحظتها" + (she ? "" : "ه"),
          sub: "صوّر" + (me === "her" ? "ي" : "") + " لحظتك وتنكشف الصورتان معًا", cta: "📸 افتح الكاميرا" }
      : { key: "photo", tone: "warm", kicker: "لحظتنا الآن", title: "وصلت إشارة اليوم",
          sub: "صورة واحدة ممّا حولكما، الآن — وتنكشف لحظتاكما معًا", cta: "📸 افتح الكاميرا" };
  }
  // 2. both photos are in and this one has not looked yet
  if (now.revealed && !seen("reveal")) {
    return { key: "reveal", tone: "warm", kicker: "انكشفت لحظتكما", title: "صورتاكما جاهزتان",
      sub: "التقطتماها في اليوم نفسه — انظرا", cta: "افتحا الصورتين" };
  }
  // 3. after ʿIshā, the three taps that close the day
  if (night && !wind.mine) {
    return { key: "winddown", tone: "night", kicker: "قبل النوم", title: "اختما اليوم بثلاث لمسات",
      sub: "شكرٌ على شيء، دعوةٌ ل" + pn + "، وخطةٌ واحدة للغد", cta: "🌙 لنبدأ" };
  }
  // 4. the daily question, answered where it is read
  if (p.mine == null) {
    return { key: "question", tone: "calm", kicker: "سؤال اليوم", title: d.question || "سؤال اليوم",
      sub: p.theirs_answered ? pn + (she ? " أجابت" : " أجاب") + " — تنكشف الإجابتان حين تجيب" + (me === "her" ? "ين" : "") : "تنكشف الإجابتان حين تجيبان معًا",
      cta: "أجب" + (me === "her" ? "ي" : "") + " هنا" };
  }
  // 5. the answers are in and this one has not read them
  if (p.revealed && !seen("qreveal")) {
    return { key: "qreveal", tone: "calm", kicker: "انكشفت إجابتاكما", title: d.question || "سؤال اليوم",
      sub: "اقرآ ما كتبه كلٌّ منكما", cta: "اقرأ" + (me === "her" ? "ي" : "") + " الإجابتين" };
  }
  // 6. nothing said to each other today
  if (!(mine.msgs > 0) && !(mine.touches > 0)) {
    return { key: "whisper", tone: "warm", kicker: "لم تتحدّثا اليوم بعد", title: "قول" + (me === "her" ? "ي" : "") + " شيئًا ل" + pn,
      sub: "همسةٌ قصيرة، أو نبضةٌ تصل جوّالها" + (she ? "" : "ه") + " في لحظتها", cta: "💓 أرسل" + (me === "her" ? "ي" : "") + " نبضة" };
  }
  // 7. the photo, before the signal — only once they are otherwise done
  if (!now.mine && !now.notified_at) {
    return { key: "photo-early", tone: "warm", kicker: "لحظتنا الآن", title: "الإشارة لم تأتِ بعد",
      sub: "تصل في ساعةٍ مفاجئة اليوم — ولكما أن تسبقاها", cta: "📸 صوّر" + (me === "her" ? "ي" : "") + " الآن" };
  }
  // 8. a tasbeeh, and a palm in the grove
  if (!(mine.dhikr > 0)) {
    return { key: "dhikr", tone: "grove", kicker: "بستاننا", title: "سبحان الله العظيم وبحمده",
      sub: "كل تسبيحةٍ نخلةٌ تُغرس في بستانكما", cta: "🌴 سبّح" + (me === "her" ? "ي" : "") };
  }
  // 9. a memory, if the day is otherwise full
  if (!(mine.moments > 0) && !now.mine) {
    return { key: "moment", tone: "calm", kicker: "ذكرياتنا", title: "اكتب" + (me === "her" ? "ي" : "") + " شيئًا من اليوم",
      sub: "سطرٌ واحد يكفي — ستقرآنه بعد سنة", cta: "✍️ اكتب" + (me === "her" ? "ي" : "") + " لحظة" };
  }
  // 10. everything the day asked for is done
  return { key: "done", tone: "done", kicker: "يومكما مكتمل", title: "لم يبقَ شيء اليوم",
    sub: "حلقاتكما ممتلئة — والبقية أدناه متى أردتما", cta: null };
}
