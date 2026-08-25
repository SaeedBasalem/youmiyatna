// يومياتنا — service worker: offline shell (network-first) + web-push display.
const CACHE = "yn-r3";
const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%23FBF3E4'/%3E%3Ctext y='.9em' font-size='78'%3E🤍%3C/text%3E%3C/svg%3E";
const CORE = [
  "./", "index.html", "manifest.webmanifest", "css/style.css",
  "js/app.js", "js/config.js", "js/api.js", "js/store.js", "js/sound.js", "js/ui.js",
  "js/helpers.js", "js/games.js", "js/media.js",
  "js/views/journal.js", "js/views/chat.js", "js/views/play.js", "js/views/us.js",
];
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {}))); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // fonts / supabase / signed media / CDN libs → network
  e.respondWith(
    fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match("index.html"))),
  );
});

// ---- web push ----
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data ? e.data.text() : "" }; }
  const title = data.title || "يومياتنا";
  const opts = {
    body: data.body || "", tag: data.tag || "yn", renotify: true,
    data: { url: data.url || "/#/feed" }, icon: ICON, badge: ICON, dir: "rtl", lang: "ar",
    vibrate: [60, 40, 60],
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/#/feed";
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) { try { c.postMessage({ nav: url }); } catch {} return c.focus(); } }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});
