// يومياتنا — vibration patterns, so touches feel physical. Silent no-op where
// the device or the couple's preference says no.
import { store } from "./store.js";

const can = () => { try { return store.hapticsOn && typeof navigator.vibrate === "function"; } catch { return false; } };
function buzz(pattern) { if (!can()) return; try { navigator.vibrate(pattern); } catch {} }

export const haptic = {
  tap()     { buzz(10); },
  soft()    { buzz(14); },
  pick()    { buzz([0, 12, 40, 12]); },
  success() { buzz([0, 18, 60, 26]); },
  love()    { buzz([0, 22, 70, 18, 50, 30]); },   // a little heartbeat
  error()   { buzz([0, 40, 70, 40]); },
  page()    { buzz(8); },
  celebrate() { buzz([0, 30, 60, 20, 60, 20, 60, 45]); },
};
