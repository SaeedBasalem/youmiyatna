// يومياتنا — the ＋ in the middle of the tab bar: anything, in two taps.
import { h } from "./ui.js";
import { openSheet, go } from "./helpers.js";
import { sound } from "./sound.js";
import { haptic } from "./haptics.js";
import { openCompose, uploadPhotos } from "./views/journal.js";
import { captureNow } from "./now.js";
import { sendTouch } from "./touch.js";
import { openWinddown, isNightNow } from "./winddown.js";

const changed = () => window.dispatchEvent(new CustomEvent("yn:changed"));

export function openCapture() {
  haptic.tap(); sound.tab();
  let close = () => {};
  const tile = (emoji, label, sub, run, hot) => h("button", { class: "cap-tile" + (hot ? " hot" : ""), onclick: () => { close(true); setTimeout(run, 200); } },
    h("span", { class: "cap-ic", "aria-hidden": "true" }, emoji), label, sub ? h("span", { class: "s" }, sub) : null);
  const night = isNightNow();
  ({ close } = openSheet({
    title: __g("ماذا تحفظ الآن؟", "ماذا تحفظين الآن؟"),
    body: [h("div", { class: "cap-grid" },
      tile("✍️", "لحظة", "كلمة وصورة", () => openCompose({ onDone: changed }), true),
      tile("📸", "لحظتنا الآن", "صورة واحدة", () => captureNow(changed)),
      tile("🖼️", "صور", "إلى الألبوم", () => uploadPhotos(null, changed)),
      tile("💓", "نبضة", "تصل فورًا", () => sendTouch()),
      tile("🌴", "بستاننا", "سبّح واغرس", () => go("us/grove")),
      night
        ? tile("🌙", "قبل النوم", "ثلاث لمسات", () => openWinddown(changed))
        : tile("💬", "همسة", "إلى همس", () => go("chat")))],
  }));
}
