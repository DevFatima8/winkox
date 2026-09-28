const CACHE = "winkox-v" + "4";
const CORE = ["/", "/login", "/manifest.webmanifest", "/brand/logo-mark.png"];
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => { }))); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // cache-first for static assets (images, icons, fonts, chunks), network-first fallback for pages
  const url = new URL(req.url);
  if (/\.(png|jpg|jpeg|webp|svg|ico|woff2?|css|js)$/i.test(url.pathname) && !url.pathname.startsWith("/_next")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); if (res.ok) caches.open(CACHE).then((c) => c.put(req, copy)); return res; }).catch(() => hit)));
  } else if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); if (res.ok && res.type === "basic") caches.open(CACHE).then((c) => c.put(req, copy)); return res; }).catch(() => caches.match(req).then((hit) => hit || caches.match("/"))));
  }
});
