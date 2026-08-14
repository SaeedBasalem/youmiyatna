// يومياتنا — in-browser sound design (Web Audio, no asset files).
import { store } from "./store.js";

let AC = null;
function ctx() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { AC = null; } }
  if (AC && AC.state === "suspended") AC.resume();
  return AC;
}

// a short filtered-noise "paper rustle"
function rustle(c, t, { dur = 0.28, freq = 2400, gain = 0.4, q = 0.8 } = {}) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) { const k = i / d.length; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 2.2); }
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(c.destination);
  src.start(t); src.stop(t + dur);
}

// a plucky sine "blip"
function blip(c, t, { freq = 660, dur = 0.16, gain = 0.28, type = "triangle", slide = 0 } = {}) {
  const o = c.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur);
}

function play(fn) {
  if (!store.soundOn) return;
  const c = ctx(); if (!c) return;
  try { fn(c, c.currentTime); } catch {}
}

export const sound = {
  resume() { ctx(); },
  page()   { play((c, t) => rustle(c, t, { dur: 0.3, freq: 2200, gain: 0.38 })); },
  tab()    { play((c, t) => blip(c, t, { freq: 520, dur: 0.09, gain: 0.14, type: "square" })); },
  post()   { play((c, t) => { rustle(c, t, { dur: 0.22, freq: 1500, gain: 0.3 }); blip(c, t + 0.02, { freq: 300, slide: 220, dur: 0.18, gain: 0.2, type: "sine" }); }); },
  react()  { play((c, t) => { blip(c, t, { freq: 740, dur: 0.12, gain: 0.22 }); blip(c, t + 0.06, { freq: 1120, dur: 0.14, gain: 0.18 }); }); },
  unlock() { play((c, t) => { rustle(c, t, { dur: 0.18, freq: 1200, gain: 0.25 }); [523, 659, 784].forEach((f, i) => blip(c, t + 0.05 + i * 0.07, { freq: f, dur: 0.22, gain: 0.2, type: "triangle" })); }); },
  error()  { play((c, t) => blip(c, t, { freq: 200, dur: 0.22, gain: 0.24, type: "sawtooth", slide: -80 })); },
  celebrate() { play((c, t) => { [523, 659, 784, 1046].forEach((f, i) => blip(c, t + i * 0.09, { freq: f, dur: 0.5, gain: 0.22, type: "triangle" })); rustle(c, t, { dur: 0.5, freq: 3000, gain: 0.2 }); }); },
  toggle() {
    store.soundOn = !store.soundOn;
    if (store.soundOn) this.tab();
    return store.soundOn;
  },
};
