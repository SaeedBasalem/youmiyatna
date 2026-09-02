// يومياتنا — single network module to the `journal` edge-function gate.
import { FN, FN2, FN3, FN4, FN5, ANON } from "./config.js";

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

// second gate (feature actions P5+), shares the same token
async function call2(action, extra = {}) {
  let res, data = {};
  try {
    res = await fetch(FN2, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON }, body: JSON.stringify({ action, token: TOKEN, ...extra }) });
  } catch (e) { return { ok: false, status: 0, offline: true, data: {} }; }
  try { data = await res.json(); } catch { data = {}; }
  if (res.status === 401 && onAuthFail) onAuthFail();
  return { ok: res.ok, status: res.status, data };
}

// third gate (per-person passcodes), same token scheme
async function call3(action, extra = {}) {
  let res, data = {};
  try { res = await fetch(FN3, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON }, body: JSON.stringify({ action, token: TOKEN, ...extra }) }); }
  catch (e) { return { ok: false, status: 0, offline: true, data: {} }; }
  try { data = await res.json(); } catch { data = {}; }
  return { ok: res.ok, status: res.status, data };
}

// fifth gate (activity stream, planner, export), same token scheme
async function call5(action, extra = {}) {
  let res, data = {};
  try { res = await fetch(FN5, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON }, body: JSON.stringify({ action, token: TOKEN, ...extra }) }); }
  catch (e) { return { ok: false, status: 0, offline: true, data: {} }; }
  try { data = await res.json(); } catch { data = {}; }
  if (res.status === 401 && onAuthFail) onAuthFail();
  return { ok: res.ok, status: res.status, data };
}

// fourth gate (scheduled nudges + whisper reactions), same token scheme
async function call4(action, extra = {}) {
  let res, data = {};
  try { res = await fetch(FN4, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON }, body: JSON.stringify({ action, token: TOKEN, ...extra }) }); }
  catch (e) { return { ok: false, status: 0, offline: true, data: {} }; }
  try { data = await res.json(); } catch { data = {}; }
  if (res.status === 401 && onAuthFail) onAuthFail();
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
  // chat
  messages:      (cursor)         => call("get_messages", { cursor, limit: 40 }),
  sendMessage:   (payload)        => call("send_message", payload),
  markRead:      ()               => call("mark_read"),
  chatUnread:    ()               => call("chat_unread"),
  // rituals
  ritualsToday:  ()               => call("rituals_today"),
  answerPrompt:  (answer)         => call("answer_prompt", { answer }),
  setCheckin:    (mood, note)     => call("set_checkin", { mood, note }),
  addGratitude:  (text)           => call("add_gratitude", { text }),
  moodCalendar:  (days)           => call("mood_calendar", { days }),
  addCountdown:  (title, target_date, emoji) => call("add_countdown", { title, target_date, emoji }),
  delCountdown:  (id)             => call("del_countdown", { id }),
  addLetter:     (payload)        => call("add_letter", payload),
  listLetters:   ()               => call("list_letters"),
  openLetter:    (id)             => call("open_letter", { id }),
  // plan
  listEvents:    ()               => call("list_events"),
  addEvent:      (payload)        => call("add_event", payload),
  delEvent:      (id)             => call("del_event", { id }),
  getLists:      ()               => call("get_lists"),
  addList:       (title, kind, emoji) => call("add_list", { title, kind, emoji }),
  delList:       (id)             => call("del_list", { id }),
  addItem:       (list_id, text)  => call("add_item", { list_id, text }),
  toggleItem:    (id)             => call("toggle_item", { id }),
  delItem:       (id)             => call("del_item", { id }),
  // spiritual (journal2)
  getDhikr:      ()               => call2("get_dhikr"),
  incDhikr:      (dhikr_key, by)  => call2("inc_dhikr", { dhikr_key, by }),
  getKhatmah:    ()               => call2("get_khatmah"),
  newKhatmah:    (name, total)    => call2("new_khatmah", { name, total }),
  markJuz:       (khatmah_id, unit) => call2("mark_juz", { khatmah_id, unit }),
  listDuas:      ()               => call2("list_duas"),
  addDua:        (body, for_whom) => call2("add_dua", { body, for_whom }),
  ameen:         (id)             => call2("ameen", { id }),
  // memories & AI (journal2)
  entriesToEmbed:(limit)          => call2("entries_to_embed", { limit }),
  setEmbedding:  (entry_id, vector) => call2("set_embedding", { entry_id, vector }),
  search:        (vector, limit)  => call2("search", { vector, limit }),
  periodMoments: (from, to)       => call2("period_moments", { from, to }),
  // playlist (journal2)
  listPlaylist:  ()               => call2("list_playlist"),
  addSong:       (payload)        => call2("add_song", payload),
  delSong:       (id)             => call2("del_song", { id }),
  // push
  getVapid:      ()               => call("get_vapid"),
  subscribePush: (subscription, ua) => call("subscribe_push", { subscription, ua }),
  unsubscribePush:(endpoint)      => call("unsubscribe_push", { endpoint }),
  testPush:      ()               => call("test_push"),
  // per-person passcodes (journal3)
  unlockPersonal:(pass)           => call3("unlock_personal", { pass }),
  setPasscode:   (pass)           => call3("set_passcode", { pass }),
  clearPasscode: ()               => call3("clear_passcode"),
  getPasscodes:  ()               => call3("get_passcodes"),
  getProfile:    ()               => call3("get_profile"),
  setProfile:    (patch)          => call3("set_profile", patch),
  // accounts / email
  getAccount:    ()               => call("get_account"),
  setEmail:      (email)          => call("set_email", { email }),
  verifyEmail:   (code)           => call("verify_email", { code }),
  setEmailNotify:(on)             => call("set_email_notify", { on }),
  // whisper reactions (journal4)
  reactMessage:  (id, emoji)      => call4("react_message", { id, emoji }),
  // activity, planner, export (journal5)
  activity:      (limit)          => call5("activity", { limit }),
  activitySeen:  (at)             => call5("activity_seen", { at }),
  listTasks:     ()               => call5("list_tasks"),
  addTask:       (payload)        => call5("add_task", payload),
  toggleTask:    (id)             => call5("toggle_task", { id }),
  delTask:       (id)             => call5("del_task", { id }),
  exportAll:     ()               => call5("export_all"),
};
