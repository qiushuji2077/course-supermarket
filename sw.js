/* 课程超市 PWA：每次打开网络优先拉货架。 */
const SHELF_VERSION = '20260930-forum-v2';
const PRECACHE = 'cs-' + SHELF_VERSION;

// 完整缓存更新文件后再接管，避免离线用户缺少本次资料。
const APP_SHELL = [
  './', './index.html', './assets/design-catalog.js?v=20260924',
  './assets/forum-catalog.js?v=20260930-forum-v1', './assets/design-support.js',
  './assets/design-responsive.css?v=20260930-forum-v1',
  './assets/vendor/react.js', './assets/vendor/react-dom.js', './manifest.webmanifest'
];
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    await cache.addAll(APP_SHELL.map((path) => new Request(new URL(path, self.location.href), { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('cs-') && key !== PRECACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isShelfRequest(request, url) {
  if (request.mode === 'navigate') return true;
  const path = url.pathname;
  if (path.endsWith('/') || /\/index\.html$/.test(path)) return true;
  if (/\/assets\/design-(catalog|support)\.js$/.test(path)) return true;
  if (/\/assets\/forum-catalog\.js$/.test(path)) return true;
  if (/\/assets\/design-responsive\.css$/.test(path)) return true;
  if (/\/assets\/vendor\/react(-dom)?\.js$/.test(path)) return true;
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
