const CACHE_VERSION = "efruitmandi-pwa-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/maskable-icon-192.png",
  "/maskable-icon-512.png",
  "/logo.png",
  "/apple-touch-icon.png",
  "/pwa-screenshot-wide-1280x720.png",
  "/pwa-screenshot-mobile-390x844.png"
];

const isApiRequest = (url) =>
  url.pathname.startsWith("/api") ||
  url.pathname.includes("/api/") ||
  url.hostname.startsWith("api.") ||
  url.hostname.includes("render.com");

const isStaticAsset = (url) =>
  /\.(?:js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf)$/i.test(url.pathname) ||
  url.pathname.startsWith("/assets/") ||
  url.pathname.startsWith("/ad-banners/") ||
  url.pathname.startsWith("/profile-banners/") ||
  url.pathname.startsWith("/profile-images/");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("efruitmandi-pwa-") && ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isApiRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline.html")))
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
  }
});
