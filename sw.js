/* Scope-isolated cache; installation succeeds only with a complete public shell. */
const SHELF_VERSION = '20260910a';
const CACHE_PREFIX = 'course-supermarket:' + self.registration.scope + ':';
const PRECACHE = CACHE_PREFIX + SHELF_VERSION;
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './assets/styles.css?v=20260906a', './assets/courses.js?v=20260906a',
  './assets/catalog-core.js?v=20260910a', './assets/app.js?v=20260910a',
  './assets/review.js?v=20260910a', './assets/review.css?v=20260910a',
  './assets/favicon.svg', './assets/favicon-32.png', './assets/apple-touch-icon.png',
  './assets/icon-192.png', './assets/icon-512.png'
];
const shellURLs = new Set(SHELL.map((path) => new URL(path, self.registration.scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== PRECACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function serve(request) {
  const cache = await caches.open(PRECACHE);
  const url = new URL(request.url);
  const networkFirst = request.mode === 'navigate' || url.pathname.endsWith('/courses.js') || url.pathname.endsWith('/index.html');
  const cached = await cache.match(request);
  if (cached && !networkFirst) return cached;
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      try { await cache.put(request, response.clone()); } catch { /* Full cache must not interrupt a network response. */ }
      return response;
    }
    if (cached) return cached;
    return response;
  } catch {
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match(new URL('./index.html', self.registration.scope).href);
      if (shell) return shell;
    }
    return Response.error();
  }
}
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (event.request.mode !== 'navigate' && !shellURLs.has(url.href) && !url.pathname.endsWith('/courses.js')) return;
  event.respondWith(serve(event.request));
});
