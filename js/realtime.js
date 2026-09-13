// يومياتنا — the live line between the two phones.
//
// A small client for Supabase Realtime (the Phoenix channel protocol) carrying
// presence ("here now"), typing, and "something changed" signals. Only signals
// travel on it — never anyone's words. Content is always fetched through the
// gate with a token; the channel's name comes from the gate too, derived from
// the server's secret, so nobody without a token knows where to listen.
//
// Everything degrades to what the app did before: if the socket cannot open,
// the screens poll exactly as they used to.
import { api } from "./api.js";
import { store } from "./store.js";
import { ANON } from "./config.js";

const WS_URL = "wss://vfyzedlyveukjaukcekq.supabase.co/realtime/v1/websocket?apikey=" + ANON + "&vsn=1.0.0";
const HEARTBEAT = 25000;

let ws = null, topic = null, joined = false, joinRef = null, ref = 0;
let hb = null, retry = 0, want = false, retryTimer = null;
let presence = {};                       // key -> [meta, ...]
let partnerHere = false;
const listeners = new Map();             // event -> Set<fn>

const other = () => (store.person === "him" ? "her" : "him");
const full = () => "realtime:" + topic;

function emit(event, payload) {
  const set = listeners.get(event);
  if (set) for (const fn of [...set]) { try { fn(payload); } catch { /* one listener never breaks the rest */ } }
}
function send(msg) {
  if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(msg)); return true; } catch {} }
  return false;
}

function recompute() {
  const metas = presence[other()] || [];
  const here = metas.some((m) => m && m.visible !== false);
  if (here !== partnerHere) { partnerHere = here; emit("presence", { here }); }
}

function track() {
  if (!joined) return;
  send({ topic: full(), event: "presence", ref: String(++ref),
    payload: { type: "presence", event: "track", payload: { visible: !document.hidden, at: Date.now() } } });
}

function handle(m) {
  if (m.event === "phx_reply" && m.ref === joinRef) {
    if (m.payload && m.payload.status === "ok") { joined = true; retry = 0; track(); emit("status", { connected: true }); }
    return;
  }
  if (m.topic !== full()) return;
  if (m.event === "presence_state") { presence = {}; for (const [k, v] of Object.entries(m.payload || {})) presence[k] = (v && v.metas) || []; recompute(); return; }
  if (m.event === "presence_diff") {
    const { joins = {}, leaves = {} } = m.payload || {};
    for (const [k, v] of Object.entries(leaves)) {
      const gone = new Set(((v && v.metas) || []).map((x) => x.phx_ref));
      presence[k] = (presence[k] || []).filter((x) => !gone.has(x.phx_ref));
    }
    for (const [k, v] of Object.entries(joins)) presence[k] = (presence[k] || []).concat((v && v.metas) || []);
    recompute();
    return;
  }
  if (m.event === "broadcast") {
    const p = m.payload || {};
    if (p.event && p.payload && p.payload.from !== store.person) emit(p.event, p.payload);
    return;
  }
  if (m.event === "phx_error" || m.event === "phx_close") { joined = false; emit("status", { connected: false }); schedule(); }
}

function schedule() {
  clearTimeout(retryTimer);
  if (!want) return;
  const delay = Math.min(30000, 1000 * 2 ** Math.min(5, retry++)) + Math.random() * 500;
  retryTimer = setTimeout(() => { if (want && !document.hidden) connect(); }, delay);
}

function connect() {
  if (!topic || (ws && (ws.readyState === 0 || ws.readyState === 1))) return;
  try { ws = new WebSocket(WS_URL); } catch { schedule(); return; }
  ws.onopen = () => {
    joinRef = String(++ref);
    // `enabled: true` asks the server for who is ALREADY here (presence_state)
    // on joining; without it a phone that reconnects only hears of later arrivals.
    send({ topic: full(), event: "phx_join", ref: joinRef, join_ref: joinRef,
      payload: { config: { broadcast: { self: false, ack: false }, presence: { key: store.person, enabled: true }, private: false }, access_token: ANON } });
    clearInterval(hb);
    hb = setInterval(() => send({ topic: "phoenix", event: "heartbeat", payload: {}, ref: String(++ref) }), HEARTBEAT);
  };
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } handle(m); };
  ws.onclose = () => {
    const was = joined;
    joined = false; clearInterval(hb);
    presence = {}; recompute();
    if (was) emit("status", { connected: false });
    schedule();
  };
  ws.onerror = () => { try { ws.close(); } catch {} };
}

document.addEventListener("visibilitychange", () => {
  if (!want) return;
  if (document.hidden) { track(); return; }                 // "not looking" rather than gone
  if (!ws || ws.readyState > 1) { retry = 0; connect(); } else track();
});
window.addEventListener("online", () => { if (want) { retry = 0; connect(); } });

export const rt = {
  get connected() { return joined; },
  get partnerHere() { return partnerHere; },
  // subscribe to a signal ("presence", "status", or any broadcast event); returns an unsubscribe
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event) && listeners.get(event).delete(fn);
  },
  // tell the other phone something happened. Never put anyone's words in `payload`.
  signal(event, payload = {}) {
    if (!joined) return false;
    return send({ topic: full(), event: "broadcast", ref: String(++ref),
      payload: { type: "broadcast", event, payload: { ...payload, from: store.person, at: Date.now() } } });
  },
  async start() {
    if (!store.token || !store.person || want) return;
    want = true;
    if (!topic) {
      const r = await api.rtTopic();
      if (!r.ok || !r.data.topic) { want = false; setTimeout(() => rt.start(), 20000); return; }
      topic = r.data.topic;
    }
    connect();
  },
  stop() {
    want = false; clearTimeout(retryTimer); clearInterval(hb);
    try { ws && ws.close(); } catch {}
    ws = null; joined = false; presence = {}; recompute();
  },
};
