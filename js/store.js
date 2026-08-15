// يومياتنا — local state: identity, token, prefs, lightweight cache.
import { api, setToken } from "./api.js";

const K = {
  token: "yn_token",
  person: "yn_person",
  sound: "yn_sound",
  feed: "yn_feed_cache",
  config: "yn_config_cache",
};

export const store = {
  token: localStorage.getItem(K.token) || null,
  person: localStorage.getItem(K.person) || null,   // 'him' | 'her'
  config: readJSON(K.config, { anniversary_date: null, dedication: "", reply: "" }),

  init() { setToken(this.token); },

  setAuth(token, person) {
    this.token = token; this.person = person;
    if (token) localStorage.setItem(K.token, token); else localStorage.removeItem(K.token);
    if (person) localStorage.setItem(K.person, person); else localStorage.removeItem(K.person);
    setToken(token);
  },
  clearAuth() { this.setAuth(null, null); },

  setConfig(cfg) { this.config = { ...this.config, ...cfg }; writeJSON(K.config, this.config); },

  cacheFeed(items) { try { writeJSON(K.feed, (items || []).slice(0, 20)); } catch {} },
  cachedFeed() { return readJSON(K.feed, []); },

  get soundOn() { return localStorage.getItem(K.sound) !== "off"; },
  set soundOn(v) { localStorage.setItem(K.sound, v ? "on" : "off"); },

  get pushOn() { return localStorage.getItem("yn_push") === "on"; },
  set pushOn(v) { localStorage.setItem("yn_push", v ? "on" : "off"); },
  get theme() { return localStorage.getItem("yn_theme") || "system"; },   // system|light|dark
  set theme(v) { localStorage.setItem("yn_theme", v); },
  get accent() { return localStorage.getItem("yn_accent") || "default"; },
  set accent(v) { localStorage.setItem("yn_accent", v); },
};

function readJSON(k, dflt) { try { return JSON.parse(localStorage.getItem(k)) ?? dflt; } catch { return dflt; } }
function writeJSON(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
