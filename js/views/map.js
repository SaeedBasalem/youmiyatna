// يومياتنا — خريطتنا: the places that mean something, pinned on a warm map.
// Leaflet + OpenStreetMap are fetched only when this screen is opened, so the
// rest of the app stays dependency-free.
import { api } from "../api.js";
import { store } from "../store.js";
import { sound } from "../sound.js";
import { haptic } from "../haptics.js";
import { h, clear, arNum, toast } from "../ui.js";
import { PEOPLE } from "../config.js";
import { go, errorState, loader, openModal, confirmAsk } from "../helpers.js";
import { icon } from "../icons.js";
import { art } from "../art.js";

const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js";
const LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const HOME = [24.7136, 46.6753];   // a gentle default view

let leafletReady = null;
function loadLeaflet() {
  if (leafletReady) return leafletReady;
  leafletReady = new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = LEAFLET_CSS;
    document.head.appendChild(link);
    const s = document.createElement("script");
    s.src = LEAFLET_JS; s.async = true;
    s.onload = () => resolve(window.L);
    s.onerror = () => reject(new Error("leaflet"));
    document.head.appendChild(s);
  });
  return leafletReady;
}

const parsePlace = (item) => { try { const p = JSON.parse(item.text); return p && p.la != null ? { ...p, id: item.id } : null; } catch { return null; } };
async function placesList() {
  const r = await api.getLists();
  if (!r.ok) return { ok: false, list: null, places: [] };
  let list = (r.data.lists || []).find((l) => l.kind === "places");
  if (!list) { await api.addList("خريطتنا", "places", "🗺️"); const r2 = await api.getLists(); list = (r2.ok ? r2.data.lists : []).find((l) => l.kind === "places"); }
  const places = ((list && list.items) || []).map(parsePlace).filter(Boolean);
  return { ok: true, list, places };
}

export async function viewMap(content) {
  const c = clear(content);
  c.appendChild(h("div", { class: "sub-head" },
    h("button", { class: "icon-btn", "aria-label": "رجوع", onclick: () => go("us") }, icon("back")),
    h("div", { class: "sh-title" }, "خريطتنا")));
  const hint = h("div", { class: "muted map-hint" }, "اضغطا على الخريطة لتثبيت مكانٍ يعنيكما 📍");
  c.appendChild(hint);
  const box = h("div", { class: "map-box" }, h("div", { class: "muted", style: { textAlign: "center", padding: "40px" } }, "نفتح الخريطة…"));
  c.appendChild(box);
  const listBox = h("div", { class: "place-list" });
  c.appendChild(listBox);

  const data = await placesList();
  if (!data.ok) { clear(box); box.appendChild(errorState(() => viewMap(content))); return; }

  let L;
  try { L = await loadLeaflet(); } catch {
    clear(box);
    box.appendChild(h("div", { class: "empty-card card" }, art("map", { size: 140 }),
      h("div", { class: "muted", style: { marginTop: "10px" } }, "تعذّر تحميل الخريطة — تحققا من الاتصال."),
      h("button", { class: "btn soft sm", style: { marginTop: "10px" }, onclick: () => { leafletReady = null; viewMap(content); } }, "أعد المحاولة ↻")));
    return;
  }

  clear(box);
  const mapEl = h("div", { class: "map-canvas" });
  box.appendChild(mapEl);
  const map = L.map(mapEl, { zoomControl: false, attributionControl: true }).setView(HOME, 5);
  L.tileLayer(TILES, { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  L.control.zoom({ position: "topleft" }).addTo(map);
  setTimeout(() => map.invalidateSize(), 120);

  const markers = [];
  const pinIcon = L.divIcon({ className: "map-pin", html: "", iconSize: [26, 26], iconAnchor: [13, 26] });
  function addMarker(pl) {
    const mk = L.marker([pl.la, pl.lo], { icon: pinIcon }).addTo(map);
    mk.on("click", () => openPlace(pl));
    markers.push(mk);
  }
  data.places.forEach(addMarker);
  if (data.places.length) {
    const b = L.latLngBounds(data.places.map((p) => [p.la, p.lo]));
    map.fitBounds(b.pad(0.35), { maxZoom: 13 });
  }

  map.on("click", (e) => newPlace(e.latlng.lat, e.latlng.lng));

  const locateBtn = h("button", { class: "map-locate", "aria-label": "موقعي الآن", onclick: () => {
    if (!navigator.geolocation) { toast("جهازكما لا يدعم تحديد الموقع"); return; }
    toast("نحدّد موقعكما…");
    navigator.geolocation.getCurrentPosition(
      (p) => { map.setView([p.coords.latitude, p.coords.longitude], 14); newPlace(p.coords.latitude, p.coords.longitude); },
      () => toast("تعذّر تحديد الموقع"), { enableHighAccuracy: true, timeout: 8000 });
  } }, icon("pin", { size: 20 }));
  box.appendChild(locateBtn);

  paintList();
  function paintList() {
    clear(listBox);
    if (!data.places.length) {
      listBox.appendChild(h("div", { class: "muted", style: { textAlign: "center", padding: "14px", fontSize: "13.5px" } },
        "لا أماكن بعد — ثبّتا أول مكانٍ يجمعكما 🗺️"));
      return;
    }
    listBox.appendChild(h("div", { class: "t-h2", style: { margin: "16px 4px 10px" } }, "أماكننا · " + arNum(data.places.length)));
    data.places.forEach((pl) => listBox.appendChild(
      h("button", { class: "place-row card", onclick: () => { map.setView([pl.la, pl.lo], 14); openPlace(pl); } },
        h("span", { class: "pr-pin" }, icon("pin", { size: 18 })),
        h("div", { class: "pr-main" }, h("b", {}, pl.n), pl.no ? h("span", { class: "muted" }, pl.no) : null))));
  }

  function newPlace(lat, lng) {
    const name = h("input", { class: "field", placeholder: "اسم المكان (مقهانا، بيت جدّتي…)" });
    const note = h("input", { class: "field", placeholder: "ذكرى بكلمة (اختياري)" });
    const { close } = openModal({ title: "مكانٌ يعنينا 📍", body: [
      h("label", { class: "lbl" }, "الاسم"), name, h("label", { class: "lbl" }, "ملاحظة"), note,
      h("div", { class: "row-btns", style: { marginTop: "14px" } },
        h("button", { class: "btn ghost", onclick: () => close() }, "إلغاء"),
        h("button", { class: "btn", onclick: async () => {
          const n = name.value.trim(); if (!n) { name.focus(); return; }
          const payload = JSON.stringify({ n, la: +lat.toFixed(6), lo: +lng.toFixed(6), no: note.value.trim(), by: store.person });
          loader(true); const r = await api.addItem(data.list.id, payload); loader(false);
          if (!r.ok) { toast("تعذّر الحفظ"); return; }
          close(); sound.post(); haptic.success(); toast("ثُبّت المكان 📍");
          const fresh = await placesList();
          data.places = fresh.places; data.list = fresh.list;
          markers.forEach((m) => map.removeLayer(m)); markers.length = 0;
          data.places.forEach(addMarker); paintList();
        } }, "ثبّت"))] });
    setTimeout(() => name.focus(), 60);
  }

  function openPlace(pl) {
    let dlg;
    dlg = openModal({ title: "📍 " + pl.n, body: [
      pl.no ? h("div", { class: "muted", style: { textAlign: "center", lineHeight: "1.9" } }, pl.no) : null,
      h("div", { class: "muted", style: { textAlign: "center", fontSize: "12px", marginTop: "8px" } },
        "ثبّته " + ((PEOPLE[pl.by] || {}).name || "أحدكما")),
      h("div", { class: "row-btns", style: { marginTop: "16px" } },
        h("button", { class: "btn ghost danger-text", onclick: async () => {
          if (!(await confirmAsk("إزالة هذا المكان؟", { okText: "إزالة", danger: true }))) return;
          await api.delItem(pl.id);
          const fresh = await placesList();
          data.places = fresh.places; data.list = fresh.list;
          markers.forEach((m) => map.removeLayer(m)); markers.length = 0;
          data.places.forEach(addMarker); paintList();
          toast("أُزيل المكان"); haptic.soft();
          dlg && dlg.close();
        } }, "إزالة"))] });
  }
}
