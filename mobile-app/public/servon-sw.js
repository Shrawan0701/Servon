const CACHE_NAME = "servon-pos-shell-v4";
const APP_SHELL = ["/", "/index.html"];
// Metro unregisters its worker in App.js. A production build hosted on the
// same computer still needs caching; hostname alone cannot identify Metro.
const DEVELOPMENT = new URL(self.location.href).searchParams.get("development") === "1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    DEVELOPMENT
      ? Promise.resolve()
      : caches
          .open(CACHE_NAME)
          .then((cache) => cache.addAll(APP_SHELL).catch(() => null)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("servon-pos-shell-") &&
              (DEVELOPMENT || key !== CACHE_NAME),
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
      if (DEVELOPMENT) {
        await self.registration.unregister();
        // Release pages controlled by the previous cache-first worker once.
        const clients = await self.clients.matchAll({ type: "window" });
        await Promise.all(clients.map((client) => client.navigate(client.url)));
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (DEVELOPMENT || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Development bundles and mutable scripts must never use a stale copy.
  if (url.pathname.endsWith(".bundle") || url.pathname.endsWith(".js")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, copy))
                .catch(() => null),
            );
          }
          if (!response.ok)
            return caches.match(request).then((cached) => cached || response);
          return response;
        })
        .catch(
          async () =>
            (await caches.match(request)) || new Response("", { status: 503 }),
        ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() =>
          caches
            .match("/index.html")
            .then((cached) => cached || caches.match("/"))
            .then(
              (cached) =>
                cached ||
                new Response(
                  "Servon POS is offline. Open once with internet to cache the app.",
                  {
                    status: 503,
                    headers: { "Content-Type": "text/plain" },
                  },
                ),
            ),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || new Response("", { status: 503 }));
      return cached || network;
    }),
  );
});
