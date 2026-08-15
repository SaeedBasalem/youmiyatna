// يومياتنا — single network module to the `journal` edge-function gate.
import { FN, ANON } from "./config.js";

let TOKEN = null;
let onAuthFail = null;

export function setToken(t) { TOKEN = t || null; }
export function setAuthFailHandler(fn) { onAuthFail = fn; }

async function call(action, extra = {}) {
  let res, data = {};
  try {
    res = await fetch(FN, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
      body: JSON.stringify({ action, token: TOKEN, ...extra }),
    });
  } catch (e) {
    return { ok: false, status: 0, offline: true, data: {} };
  }
  try { data = await res.json(); } catch { data = {}; }
  if (res.status === 401 && action !== "unlock" && onAuthFail) onAuthFail();
  return { ok: res.ok, status: res.status, data };
}

export const api = {
  raw: call,
  status:        ()               => call("status"),
  unlock:        (pass, person)   => call("unlock", { pass, person }),
  chooseIdentity:(person)         => call("choose_identity", { person }),
  refresh:       ()               => call("refresh"),
  bootstrap:     ()               => call("get_bootstrap"),
  setConfig:     (key, value)     => call("set_config", { key, value }),
  feed:          (cursor)         => call("get_feed", { cursor, limit: 15 }),
  moment:        (id)             => call("get_moment", { id }),
  addMoment:     (payload)        => call("add_moment", payload),
  react:         (entry_id, emoji)=> call("react", { entry_id, emoji }),
  addNote:       (entry_id, body) => call("add_note", { entry_id, body }),
  delNote:       (id)             => call("del_note", { id }),
  del:           (id)             => call("delete", { id }),
  signUpload:    (kind, content_type) => call("sign_upload", { kind, content_type }),
  signDownload:  (paths)          => call("sign_download", { paths }),
  timeline:      (cursor)         => call("get_timeline", { cursor, limit: 30 }),
  onThisDay:     ()               => call("on_this_day", {}),
  milestones:    ()               => call("get_milestones"),
  markSeen:      (badge_key)      => call("mark_milestone_seen", { badge_key }),
  // push
  getVapid:      ()               => call("get_vapid"),
  subscribePush: (subscription, ua) => call("subscribe_push", { subscription, ua }),
  unsubscribePush:(endpoint)      => call("unsubscribe_push", { endpoint }),
  testPush:      ()               => call("test_push"),
};
