// يومياتنا — service worker: the offline shell, a photo cache, and web push.
const CACHE = "yn-r35";
const MEDIA = "yn-photos-v1";
const MEDIA_MAX = 400;
const ICON = "icons/icon-192.png";
const CORE = [
  "./", "index.html", "manifest.webmanifest", "css/style.css", "css/v2.css", "fonts/fonts.css",
  "js/app.js", "js/config.js", "js/api.js", "js/store.js", "js/sound.js", "js/ui.js",
  "js/helpers.js", "js/generate.js", "js/media.js", "js/adhkar.js", "js/gestures.js",
  "js/icons.js", "js/art.js", "js/living.js", "js/haptics.js", "js/onboarding.js", "js/doodle.js",
  "js/looks.js", "js/realtime.js", "js/rings.js", "js/grove.js", "js/now.js",
  "js/camera.js",
  "js/track.js",
  "js/ask.js",
  "js/sky.js", "js/zip.js", "js/wa.js",
  "js/weather.js",
  "js/views/together.js",
  "js/views/plans.js",
  "js/views/apart.js",
  "js/views/worship.js",
  "js/views/letter.js", "js/views/archive.js", "js/touch.js", "js/winddown.js", "js/capture.js",
  "js/views/today.js", "js/views/search.js", "js/views/book.js", "js/views/wrapped.js", "js/views/map.js",
  "js/lightbox.js", "js/views/story.js", "js/views/pulse.js", "js/views/profile.js", "js/install.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
  "js/views/journal.js", "js/views/chat.js", "js/views/play.js", "js/views/us.js",
  "js/outbox.js", "js/views/inbox.js", "js/views/plan.js", "js/palette.js", "js/prayer.js",
];
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {}))); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== MEDIA).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

// Photos from our bucket arrive through signed links whose token changes every
// time the server hands them out, so the browser never recognised a photo it
// had already downloaded. They are cached here by the file's PATH — which never
// changes, since every upload gets a new name — so each photo is downloaded once.
// Only photos: video and voice are fetched in ranges, which a cache must not answer.
async function photoFirst(url) {
  const key = url.origin + url.pathname;
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await fetch(url.href, { mode: "cors", credentials: "omit" });
  if (res && res.ok && res.status === 200) {
    cache.put(key, res.clone()).then(() => trim(cache)).catch(() => {});
  }
  return res;
}
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MEDIA_MAX) await Promise.all(keys.slice(0, keys.length - MEDIA_MAX).map((k) => cache.delete(k)));
}

// Fonts/woff2 are immutable → cache-first. Code + shell (html/js/css) → NETWORK-FIRST, so an
// online open always runs the latest code (no stale-blank), with cache as the offline fallback.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/v1/object/sign/jn-media/photo/") && !req.headers.get("range")) {
    e.respondWith(photoFirst(url).catch(() => fetch(req)));
    return;
  }
  if (url.origin !== location.origin) return; // everything else remote → network only
  const immutable = url.pathname.includes("/fonts/") || url.pathname.endsWith(".woff2");
  if (immutable) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => hit ||
      fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  e.respondWith(
    fetch(req).then((res) => { if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; })
      .catch(() => caches.open(CACHE).then((c) => c.match(req).then((r) => r || c.match("index.html")))),
  );
});

// ---- web push ----
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data ? e.data.text() : "" }; }
  const title = data.title || "يومياتنا";
  const opts = {
    body: data.body || "", tag: data.tag || "yn", renotify: true,
    data: { url: data.url || "#/chat" }, icon: ICON, badge: ICON, dir: "rtl", lang: "ar",
    vibrate: data.tag === "touch" ? [70, 90, 70] : [60, 40, 60],
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const raw = (e.notification.data && e.notification.data.url) || "#/chat";
  // The app lives under a sub-path on Pages, so a bare "/#/chat" would open the
  // domain root. Everything is resolved against the SW's own scope instead.
  const hash = raw.includes("#") ? raw.slice(raw.indexOf("#")) : "#/home";
  const target = new URL("./" + hash, self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const mine = all.filter((c) => c.url.startsWith(self.registration.scope));
    for (const c of (mine.length ? mine : all)) {
      if ("focus" in c) { try { c.postMessage({ nav: hash }); } catch {} return c.focus(); }
    }
    if (clients.openWindow) return clients.openWindow(target);
  })());
});
