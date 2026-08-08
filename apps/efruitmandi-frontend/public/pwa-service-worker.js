const BUILD_ID = "__EFRUITMANDI_BUILD_ID__";
const CACHE_VERSION = `efruitmandi-v-${BUILD_ID}`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const CACHE_PREFIXES = ["efruitmandi-v", "efruitmandi-pwa-"];

const APP_SHELL = [
  "/offline.html",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-24x24.png",
  "/favicon-32x32.png",
  "/favicon-64x64.png",
  "/icon-192.png",
  "/icon-512.png",
  "/maskable-icon-192.png",
  "/maskable-icon-512.png",
  "/logo-240.webp",
  "/apple-touch-icon.png",
  "/notification-icon-192.png",
  "/notification-icon-512.png",
  "/notification-badge-96.png",
  "/pwa-screenshot-wide-1280x720.png",
  "/pwa-screenshot-mobile-390x844.png",
  "/manifest.json"
];

const FRESH_STARTUP_ASSETS = new Set([
  "/logo-240.webp",
  "/icon-192.png",
  "/icon-512.png",
  "/maskable-icon-192.png",
  "/maskable-icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.json",
]);

const DEFAULT_NOTIFICATION_OPTIONS = {
  icon: "/notification-icon-192.png",
  badge: "/notification-badge-96.png",
  image: "/notification-icon-512.png",
  vibrate: [120, 80, 120],
};

const isApiRequest = (url) =>
  url.pathname.startsWith("/api") ||
  url.pathname.includes("/api/") ||
  url.hostname.startsWith("api.") ||
  url.hostname.includes("render.com");

const isStaticAsset = (url) =>
  /\.(?:js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf)$/i.test(url.pathname) ||
  url.pathname.startsWith("/assets/") ||
  url.pathname.startsWith("/profile-banners/") ||
  url.pathname.startsWith("/profile-images/");

const isFreshStartupAsset = (url) => FRESH_STARTUP_ASSETS.has(url.pathname);

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: "reload" }))))
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
            .filter((key) => CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
            .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
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
      fetch(request, { cache: "no-store" })
        .then((response) => response)
        .catch(() => caches.match("/offline.html"))
    );
    return;
  }

  if (isFreshStartupAsset(url)) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            const contentType = response.headers.get("content-type") || "";
            const isModuleAsset = url.pathname.startsWith("/assets/") &&
              /\.(?:js|css)$/i.test(url.pathname);
            const isValidAsset = response.ok &&
              (!isModuleAsset || !contentType.includes("text/html"));

            if (isValidAsset) {
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

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || "" };
  }

  const title = payload.title || "eFruitMandi";
  const options = {
    ...DEFAULT_NOTIFICATION_OPTIONS,
    ...payload,
    data: {
      url: payload.url || "/notifications",
      ...(payload.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => "focus" in client);
      if (existingClient) {
        existingClient.navigate(targetUrl);
        return existingClient.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
