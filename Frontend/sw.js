const CACHE_NAME = 'payurupee-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/src/main.js',
  '/src/store.js',
  '/src/router.js',
  '/src/api.js',
  '/src/utils.js',
  '/src/notifications.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request);
    }).catch(() => {
      if (e.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
