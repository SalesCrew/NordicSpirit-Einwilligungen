const CACHE_NAME = "frequency-consent-shell-v2";
const CORE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/assets/nordic-spirit-logo.png",
  "/assets/frequency-background.png",
  "/documents/haftung/page-1.png",
  "/documents/haftung/page-2.png",
  "/documents/haftung/page-3.png",
  "/documents/einwilligung/page-1.png",
  "/documents/einwilligung/page-2.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const rootResponse = await fetch("/", { cache: "reload" });
    if (!rootResponse.ok) throw new Error("App shell could not be cached");
    await cache.put("/", rootResponse.clone());
    const html = await rootResponse.text();
    const shellAssets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => match[1].replaceAll("&amp;", "&"))
      .filter((value) => value.startsWith("/"))
      .filter((value) => !value.startsWith("/api/"));
    const urls = [...new Set([...CORE_URLS.filter((value) => value !== "/"), ...shellAssets])];
    await Promise.all(urls.map((url) => cache.add(url).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((url) => {
    try {
      return new URL(url).origin === self.location.origin;
    } catch {
      return false;
    }
  });
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => Promise.all(urls.map((url) => cache.add(url).catch(() => undefined)))));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/")) || Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
