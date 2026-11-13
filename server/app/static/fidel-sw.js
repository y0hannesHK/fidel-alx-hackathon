// Fidel service worker: keeps saved lessons available with no internet.
//
// It only touches one-page offline lessons (/api/v1/lessons/<id>/offline.html).
// Every other request goes to the network as normal.
const CACHE = 'fidel-saved-lessons-v1';
const isLessonPage = (url) => /\/api\/v1\/lessons\/[a-f0-9]{12}\/offline\.html/.test(url);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// The page asks: "save this lesson". We download it once and keep it.
self.addEventListener('message', (event) => {
  const { type, url } = event.data || {};
  if (type !== 'save' || !isLessonPage(url)) return;
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(url))
      .then(() => event.ports[0]?.postMessage({ ok: true }))
      .catch((error) => event.ports[0]?.postMessage({ ok: false, error: String(error) }))
  );
});

// Saved lesson pages: use the network when there is one (to get corrections),
// otherwise the saved copy.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !isLessonPage(event.request.url)) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.match(event.request).then((saved) => saved && cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((saved) => saved || Response.error()))
  );
});
