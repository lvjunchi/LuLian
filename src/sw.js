// BUILD_ID and PRECACHE are injected by the build, including the repository path.
const scope = self.registration.scope;
const prefix = `lulian:${new URL(scope).pathname}:`;
const cacheName = prefix + BUILD_ID;
const shell = new URL("index.html", scope).href;
const assets = new Set(PRECACHE.map((file) => new URL(file, scope).href));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(cacheName).then(async (cache) => {
      try {
        await cache.addAll(
          [...assets].map((url) => new Request(url, { cache: "reload" })),
        );
      } catch (error) {
        await caches.delete(cacheName);
        throw error;
      }
    }),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(prefix) && name !== cacheName)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(scope)) return;
  const navigation = request.mode === "navigate";
  if (!navigation && !assets.has(request.url)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName);
      return (
        (await cache.match(navigation ? shell : request)) || fetch(request)
      );
    })(),
  );
});
self.addEventListener("message", (event) => {
  // Updates wait for explicit acceptance, leaving a running workout intact.
  if (event.data?.type === "ACTIVATE_UPDATE")
    event.waitUntil(self.skipWaiting());
});
