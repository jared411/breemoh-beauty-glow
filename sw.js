// Bremoh service worker: network first, falls back to the last saved copy when there is no signal.
const CACHE = "bremoh-v1";
const SHELL = ["index.html", "css/style.css", "js/config.js", "js/app.js", "assets/logo-bremoh.png", "assets/icon-192.png", "assets/icon-512.png"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase and other sites are never cached
  e.respondWith(fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; })
    .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html"))));
});
