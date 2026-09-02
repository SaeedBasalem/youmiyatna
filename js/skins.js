// يومياتنا — Theme Studio: complete, switchable design languages.
// A skin re-clothes the entire app (surfaces, depth, type, chrome) while the
// couple's own choices — light/dark theme, accent, background photo — still apply
// on top wherever they make sense. Velvet is inherently dark and says so.
import { store } from "./store.js";

export const SKINS = {
  warm: {
    name: "الدافئ", desc: "طابعنا الأصلي — كريمي ووردي وذهبي، دافئ كبيتٍ صغير.",
    chip: ["#FDF2EC", "#E28CA0", "#E3BE86"], dark: false,
  },
  glass: {
    name: "زجاجي", desc: "بطاقاتٌ شفّافة تطفو على ألوانٍ حالمة — خفّة وضوء.",
    chip: ["#EDE6FA", "#B79AD6", "#8FCFD6"], dark: false,
  },
  bento: {
    name: "بنتو", desc: "شبكةٌ مرتّبة وأرقامٌ جريئة — نظام وهدوء عصري.",
    chip: ["#F6F4F1", "#2E2A26", "#E2704A"], dark: false,
  },
  paper: {
    name: "سكرابوك", desc: "ورقٌ وبولارويد وشريط لاصق — دفترُ قصاصاتٍ حقيقي.",
    chip: ["#FAF3E7", "#B98E5A", "#D96C6C"], dark: false,
  },
  velvet: {
    name: "مخمل", desc: "ليلٌ عميق وذهبٌ مصقول — فخامةٌ هادئة. (داكنٌ دائمًا)",
    chip: ["#1D1426", "#D8B36A", "#3A2A4A"], dark: true,
  },
  urban: {
    name: "المدينة", desc: "لوحةُ تحكّمٍ ليلية — حوافُّ رفيعة وأرقامٌ آلية وكثافةُ معلومات. (داكنٌ دائمًا)",
    chip: ["#0C0D10", "#F2545B", "#F5A524"], dark: true,
  },
};

export function applySkin() {
  const key = store.skin;
  const r = document.documentElement;
  if (!key || key === "warm" || !SKINS[key]) r.removeAttribute("data-skin");
  else r.setAttribute("data-skin", key);
  // keep the browser chrome colour honest
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) setTimeout(() => { try { m.setAttribute("content", getComputedStyle(document.body).backgroundColor || "#FDF2EC"); } catch {} }, 60);
}
