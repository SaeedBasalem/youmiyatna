// يومياتنا — app-lock: a local PIN (+ optional biometric) privacy layer over the app.
// This is a convenience lock on top of the real passcode gate; data stays protected server-side.
const K = { on: "yn_lock_on", pin: "yn_lock_pin", bio: "yn_lock_bio" };
let unlocked = false; // per page-load session

async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("jnlock::" + s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export const appLock = {
  enabled() { return localStorage.getItem(K.on) === "1"; },
  hasBio() { return !!localStorage.getItem(K.bio); },
  isLocked() { return this.enabled() && !unlocked; },
  markUnlocked() { unlocked = true; },
  lockNow() { if (this.enabled()) unlocked = false; },
  async setup(pin) { localStorage.setItem(K.pin, await sha(pin)); localStorage.setItem(K.on, "1"); unlocked = true; },
  disable() { localStorage.removeItem(K.on); localStorage.removeItem(K.pin); localStorage.removeItem(K.bio); unlocked = true; },
  async tryPin(pin) { return (await sha(pin)) === localStorage.getItem(K.pin); },
  async enrollBio() {
    if (!window.PublicKeyCredential) throw new Error("unsupported");
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "يومياتنا" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "couple", displayName: "يومياتنا" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
    } });
    localStorage.setItem(K.bio, btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
    return true;
  },
  async verifyBio() {
    const id = localStorage.getItem(K.bio); if (!id) throw new Error("no-bio");
    const rawId = Uint8Array.from(atob(id), (c) => c.charCodeAt(0));
    await navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: rawId }],
      userVerification: "required", timeout: 60000,
    } });
    return true;
  },
};
