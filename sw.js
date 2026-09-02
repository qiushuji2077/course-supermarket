/* 课程超市 PWA：每次打开网络优先拉货架。 */
const SHELF_VERSION = '20260902b';
const PRECACHE = 'cs-' + SHELF_VERSION;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== PRECACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isShelfRequest(request, url) {
  if (request.mode === 'navigate') return true;
  const path = url.pathname;
  if (path.endsWith('/') || /\/index\.html$/.test(path)) return true;
  if (/\/assets\/courses\.js$/.test(path) || path.endsWith('courses.js')) return true;
  if (path.endsWith('/sw.js') || path.endsWith('manifest.webmanifest')) return true;
  return false;
}

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    if (fresh && fresh.ok) {
      const cache = await caches.open(PRECACHE);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(PRECACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (isShelfRequest(event.request, url)) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(staleWhileRevalidate(event.request));
});
