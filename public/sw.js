const CACHE_NAME = "frequency-consent-shell-v12";
const BUILD_ASSET_PREFIX = "/_next/static/";
const CORE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/assets/nordic-spirit-logo.png",
  "/assets/frequency-background.png",
  "/assets/frequency-finish-background.png",
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
    // Keep installation atomic. Activating a worker with only the HTML cached can
    // leave a kiosk unstyled when that HTML references a hashed asset that was not
    // cached successfully.
    await Promise.all(urls.map((url) => cache.add(url)));
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
      (async () => {
        const cached = await caches.match(request);
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response.ok || !cached ? response : cached;
        } catch {
          return cached || (await caches.match("/")) || Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith(BUILD_ASSET_PREFIX)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response.ok || !cached ? response : cached;
        } catch {
          return cached || Response.error();
        }
      })(),
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
