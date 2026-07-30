const CACHE_NAME = 'wild-west-duel-v105';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './style.css?v=105',
  './game.js',
  './game.js?v=105',
  './cowboy.js',
  './cowboy.js?v=105',
  './bullet.js',
  './obstacle.js',
  './obstacle.js?v=105',
  './audio.js',
  './audio.js?v=105',
  './translations.js',
  './translations.js?v=105',
  './qr-code.png',
  './jobs.json',
  './cheats.html',
  './fonts/outfit-300.ttf',
  './fonts/outfit-400.ttf',
  './fonts/outfit-600.ttf',
  './fonts/outfit-800.ttf',
  './fonts/rye-400.ttf'
];

// Install Event: Pre-cache essential game assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map((asset) => 
          cache.add(asset).catch((err) => 
            console.warn('Asset cache failed:', asset, err)
          )
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate Event: Clean up outdated caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
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

// Fetch Event: Network-First for navigation, Stale-While-Revalidate with cloned response & waitUntil for static assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) return;

  // HTML Navigation: Network-First with offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request, { ignoreSearch: true })
            .then((cachedReq) => cachedReq || caches.match('./index.html', { ignoreSearch: true }))
            .then((cachedIndex) => cachedIndex || caches.match('./', { ignoreSearch: true }));
        })
    );
    return;
  }

  // Static Assets: Stale-While-Revalidate / Cache-First with update
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Silent catch for background revalidation failures when offline
        });

      if (cachedResponse) {
        // Keep SW active while revalidating in background
        event.waitUntil(fetchPromise);
        return cachedResponse;
      }

      // If not in cache, wait for network fetch
      return fetchPromise;
    })
  );
});

