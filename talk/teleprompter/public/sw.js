const CACHE_NAME = "jw-talk-teleprompter-v1";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/talks/talk-manifest.json",
  "/talks/055/draft-talk-v3.html",
  "/talks/055/draft-talk-v3.md",
  "/talks/055/draft-talk-v3.pdf",
  "/talks/055/v3-extemp-guide.html",
  "/talks/055/metrics-index.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});
