const CACHE_NAME = "biblioteca-santa-filomena-pages-v6";
const APP_BASE = new URL("./", self.registration.scope);
const APP_SHELL = [
  APP_BASE.href,
  new URL("manifest.webmanifest", APP_BASE).href,
  new URL("static/icon-192.png", APP_BASE).href,
  new URL("static/icon-512.png", APP_BASE).href,
  new URL("static/logo-biblioteca-cra.png", APP_BASE).href,
  new URL("static/config.js", APP_BASE).href,
  new URL("app.js", APP_BASE).href
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.href === new URL("static/config.js", APP_BASE).href) {
    event.respondWith(
      fetch(request).then(async (response) => {
        if (response.ok) {
          await caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      }).catch(async () => (await caches.match(request)) || Response.error())
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(async (response) => {
        if (response.ok && url.href === APP_BASE.href) {
          await caches.open(CACHE_NAME).then((cache) => cache.put(APP_BASE.href, response.clone()));
        }
        return response;
      }).catch(async () => (await caches.match(APP_BASE.href)) || Response.error())
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
