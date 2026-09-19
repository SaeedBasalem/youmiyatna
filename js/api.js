// يومياتنا — the single network module: every gate, one token.
import { FN, FN2, FN3, FN4, FN5, FN6, ANON } from "./config.js";

let TOKEN = null;
let onAuthFail = null;

export function setToken(t) { TOKEN = t || null; }
export function setAuthFailHandler(fn) { onAuthFail = fn; }

// Reads are safe to repeat; writes are not. This project shares its database
// with other apps whose jobs run on every :00 and :05, and in that minute a
// call can hang for twenty seconds. A read now gives up after 9 s and tries
// once more — by then the busy moment has usually passed — instead of leaving
// a screen spinning. A write is never repeated: sending a whisper twice is
// worse than saying it did not go.
const READ = /^(get_|list_|status$|rituals_today$|chat_unread$|mood_calendar$|on_this_day$|activity$|search_all$|counts$|entries_to_embed$|period_moments$|home$|rt$|now_state$|now_history$|dhikr_today$|grove$|shots$|sign$|sign_download$|game_state$|game_open$|game_stats$)/;

async function request(url, action, extra = {}, { authFail = true } = {}) {
  const read = READ.test(action);
  const attempts = read ? 2 : 1;
  for (let i = 0; i < attempts; i++) {
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), read ? 9000 : 25000) : null;
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
        body: JSON.stringify({ action, token: TOKEN, ...extra }),
        signal: ctl ? ctl.signal : undefined,
      });
    } catch (e) {
      clearTimeout(timer);
      const timedOut = !!(e && e.name === "AbortError");
      if (i < attempts - 1) continue;
      return { ok: false, status: 0, offline: !timedOut, timeout: timedOut, data: {} };
    }
    clearTimeout(timer);
    let data = {};
    try { data = await res.json(); } catch { data = {}; }
    if (res.status === 401 && authFail && action !== "unlock" && onAuthFail) onAuthFail();
    if (read && res.status >= 500 && i < attempts - 1) continue;   // a server hiccup on a read gets one more go
    return { ok: res.ok, status: res.status, data };
  }
}

const call  = (a, x) => request(FN, a, x);
const call2 = (a, x) => request(FN2, a, x);
const call3 = (a, x) => request(FN3, a, x, { authFail: false });   // unlock_personal answers 200 {ok:false} on a miss
const call4 = (a, x) => request(FN4, a, x);
const call5 = (a, x) => request(FN5, a, x);
const call6 = (a, x) => request(FN6, a, x);

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
  counts:        (year)           => call4("counts", { year }),
  // activity, planner, export (journal5)
  activity:      (limit)          => call5("activity", { limit }),
  activitySeen:  (at)             => call5("activity_seen", { at }),
  listTasks:     ()               => call5("list_tasks"),
  addTask:       (payload)        => call5("add_task", payload),
  toggleTask:    (id)             => call5("toggle_task", { id }),
  delTask:       (id)             => call5("del_task", { id }),
  exportAll:     ()               => call5("export_all"),
  searchAll:     (q, limit)       => call5("search_all", { q, limit }),
  editMoment:    (id, patch)      => call5("edit_moment", { id, ...patch }),
  // Chapter Two (journal6)
  home:          ()               => call6("home"),
  rtTopic:       ()               => call6("rt"),
  nowState:      ()               => call6("now_state"),
  nowPost:       (path, meta, caption, partner_online) => call6("now_post", { path, meta, caption, partner_online }),
  log:           (events) => call6("log", { events }),
  nowHistory:    (before)         => call6("now_history", { before }),
  touch:         (partner_online) => call6("touch", { partner_online }),
  gameNew:       (game, prompt, partner_online) => call6("game_new", { game, prompt, partner_online }),
  gameNext:      (session, prompt)=> call6("game_next", { session, prompt }),
  gameMove:      (round_id, move) => call6("game_move", { round_id, move }),
  gameJudge:     (round_id, verdict) => call6("game_judge", { round_id, verdict }),
  gameState:     (session)        => call6("game_state", { session }),
  gameOpen:      ()               => call6("game_open"),
  gameStats:     ()               => call6("game_stats"),
  winddownSave:  (payload)        => call6("winddown_save", payload),
  dhikrInc:      (key, by)        => call6("dhikr_inc", { key, by }),
  dhikrToday:    ()               => call6("dhikr_today"),
  setGoal:       (goal)           => call6("set_goal", { goal }),
  grove:         ()               => call6("grove"),
  shots:         ()               => call6("shots"),
  sign6:         (paths)          => call6("sign", { paths }),
};
