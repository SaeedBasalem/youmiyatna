// يومياتنا — conservative service worker: offline shell, but network-first so
// fresh code always wins while online. Never intercepts the Supabase gate (POST / cross-origin).
const CACHE = "yn-v1";
const CORE = [
  "./", "index.html", "manifest.webmanifest",
  "css/style.css",
  "js/app.js", "js/config.js", "js/api.js", "js/store.js", "js/sound.js", "js/ui.js", "js/media.js",
];
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {}))); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                          // gate POSTs go straight to network
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;                // fonts / supabase / signed media → network
  e.respondWith(
    fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match("index.html"))),
  );
});
