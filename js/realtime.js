// يومياتنا — realtime presence + broadcast (Supabase Realtime, lazy-loaded).
// Public channel with the anon key: no table-RLS dependency. Content is still
// fetched through the gate; broadcasts only carry lightweight "refresh"/typing pings.
import { store } from "./store.js";
import { ANON } from "./config.js";

const SUPA_URL = "https://vfyzedlyveukjaukcekq.supabase.co";
let client = null, channel = null, presenceState = {};
const listeners = { presence: [], event: [] };
const other = (p) => (p === "him" ? "her" : "him");

export const realtime = {
  async init() {
    if (channel || !store.person) return;
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      client = createClient(SUPA_URL, ANON, { realtime: { params: { eventsPerSecond: 8 } } });
      channel = client.channel("couple:v1", { config: { presence: { key: store.person } } });
      channel.on("presence", { event: "sync" }, () => { presenceState = channel.presenceState(); emit("presence"); });
      channel.on("broadcast", { event: "ping" }, ({ payload }) => { if (payload?.from !== store.person) emit("event", payload); });
      channel.subscribe(async (status) => { if (status === "SUBSCRIBED") await channel.track({ person: store.person, at: Date.now() }); });
    } catch (e) { /* realtime is optional; app works without it */ }
  },
  partnerOnline() {
    const st = presenceState || {}; const arr = st[other(store.person)];
    return !!(arr && arr.length);
  },
  broadcast(type, data = {}) {
    try { channel && channel.send({ type: "broadcast", event: "ping", payload: { type, from: store.person, ...data } }); } catch { /* noop */ }
  },
  onPresence(fn) { listeners.presence.push(fn); },
  onEvent(fn) { listeners.event.push(fn); },
  leave() { try { channel && client.removeChannel(channel); } catch { /* noop */ } channel = null; },
};
function emit(kind, payload) {
  (kind === "presence" ? listeners.presence : listeners.event).forEach((fn) => { try { fn(payload); } catch { /* noop */ } });
}
