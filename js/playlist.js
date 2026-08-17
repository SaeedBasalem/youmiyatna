// يومياتنا — أغنياتنا: a shared "our song" playlist.
import { h, clear, personChip, toast } from "./ui.js";
import { api } from "./api.js";
import { sound } from "./sound.js";
import { realtime } from "./realtime.js";

export async function viewPlaylist(content) {
  content.appendChild(h("div", { class: "section-title" }, h("h1", { class: "t-h1" }, "أغنياتنا")));
  content.appendChild(h("button", { class: "btn coral", style: { marginBottom: "14px" }, onclick: () => songModal(content) }, "＋ أغنية"));
  const list = h("div", { class: "playlist" }, h("div", { class: "empty", style: { padding: "16px" } }, "…"));
  content.appendChild(list);
  const r = await api.listPlaylist();
  clear(list);
  const items = r.ok ? r.data.items : [];
  if (!items.length) { list.appendChild(h("div", { class: "empty" }, h("div", { class: "big" }, "🎵"), h("div", {}, "ابدآ قائمة أغانيكما 🎶"), h("div", { class: "dua" }, "لكل حبٍّ لحنه."))); return; }
  items.forEach((s) => list.appendChild(songCard(s, content)));
}
function songCard(s, content) {
  return h("div", { class: "song-card" },
    s.cover_url ? h("img", { class: "song-cover", src: s.cover_url, alt: "" }) : h("span", { class: "song-ic" }, "🎵"),
    h("div", { class: "song-meta" }, h("b", {}, s.title), h("span", { class: "muted" }, s.artist || ""), personChip(s.added_by)),
    s.url ? h("a", { class: "song-play", href: s.url, target: "_blank", rel: "noreferrer" }, "▶") : null,
    h("button", { class: "cd-del", onclick: async () => { await api.delSong(s.id); realtime.broadcast("playlist"); viewPlaylist(clear(content)); } }, "✕"));
}
function songModal(content) {
  const title = h("input", { class: "field", placeholder: "اسم الأغنية" });
  const artist = h("input", { class: "field", placeholder: "المغني/ة" });
  const url = h("input", { class: "field", placeholder: "رابط (يوتيوب/سبوتيفاي…)", inputmode: "url" });
  const sc = h("div", { class: "scrim center" }, h("div", { class: "modal" },
    h("h3", {}, "أغنية لنا 🎵"),
    h("label", { class: "lbl" }, "العنوان"), title,
    h("label", { class: "lbl" }, "المغني/ة"), artist,
    h("label", { class: "lbl" }, "الرابط"), url,
    h("div", { class: "attach-rail", style: { marginTop: "14px" } },
      h("button", { class: "btn ghost", onclick: () => sc.remove() }, "إلغاء"),
      h("button", { class: "btn coral", onclick: async () => { const t = title.value.trim(); if (!t) { title.focus(); return; } const r = await api.addSong({ title: t, artist: artist.value.trim() || null, url: url.value.trim() || null }); if (r.ok) { sc.remove(); sound.post(); realtime.broadcast("playlist"); viewPlaylist(clear(content)); } else toast("تعذّر"); } }, "أضيفا"))));
  document.body.appendChild(sc);
}
