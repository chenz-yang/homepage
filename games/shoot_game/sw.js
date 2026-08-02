const CACHE_NAME = 'wild-west-duel-v135';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './manifest.json?v=135',
  './style.css',
  './style.css?v=135',
  './game.js',
  './game.js?v=135',
  './cowboy.js',
  './cowboy.js?v=135',
  './bullet.js',
  './bullet.js?v=135',
  './obstacle.js',
  './obstacle.js?v=135',
  './audio.js',
  './audio.js?v=135',
  './translations.js',
  './translations.js?v=135',
  './qr-code.png',
  './app-icon.png',
  './app-icon.png?v=135',
  './apple-touch-icon.png',
  './apple-touch-icon.png?v=135',
  './apple-touch-icon-precomposed.png',
  './apple-touch-icon-precomposed.png?v=135',
  './jobs.json',
  './cheats.html',
  './fonts/outfit-300.ttf',
  './fonts/outfit-400.ttf',
  './fonts/outfit-600.ttf',
  './fonts/outfit-800.ttf',
  './fonts/rye-400.ttf'
];

// Helper to get resolved absolute URL for reliable Cache matching in iOS WebKit
function getAbsoluteUrl(path) {
  return new URL(path, self.location).href;
}

// Robust helper to match requests in Cache, handling CORS Vary headers, query strings, and path variations
async function matchInCache(cache, request) {
  // 1. Try matching exact request with ignoreSearch and ignoreVary
  let cachedResponse = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
  if (cachedResponse) return cachedResponse;

  // 2. Try matching clean URL string without query string/hash
  const reqUrl = typeof request === 'string' ? request : request.url;
  const cleanUrl = reqUrl.split('?')[0].split('#')[0];
  cachedResponse = await cache.match(cleanUrl, { ignoreSearch: true, ignoreVary: true });
  if (cachedResponse) return cachedResponse;

  // 3. Fallback: match by pathname against all keys in cache
  try {
    const keys = await cache.keys();
    const reqPathname = new URL(reqUrl, self.location).pathname;
    for (const key of keys) {
      const keyPathname = new URL(key.url, self.location).pathname;
      if (keyPathname === reqPathname || (reqPathname.endsWith('/') && keyPathname.endsWith('/index.html'))) {
        return await cache.match(key, { ignoreSearch: true, ignoreVary: true });
      }
    }
  } catch (e) {
    console.warn('Cache pathname search fallback failed:', e);
  }

  return null;
}

// Install Event: Pre-cache essential game assets using no-cache to bypass stale browser cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map((asset) =>
          fetch(new Request(asset, { cache: 'no-cache' })).then((res) => {
            if (res && res.status === 200) {
              return cache.put(asset, res);
            }
          }).catch((err) =>
            console.warn('Asset cache failed:', asset, err)
          )
        )
      );
    })
  );
  self.skipWaiting();
});

// Message Event: Handle instant skipWaiting and force cache updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'FORCE_UPDATE') {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => {
      self.skipWaiting();
    });
  }
});

// Activate Event: Clean up outdated caches and claim clients immediately
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
    }).then(() => {
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'VERSION_UPDATED', version: '135' });
        });
      });
    })
  );
  self.clients.claim();
});

// Fetch Event: Cache-First with background revalidation & guaranteed fallbacks
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) return;

  // HTML Navigation: Network-First with Cache Fallback (Bypasses HTTP/SW cache on refresh, works offline)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
          const bypassUrl = new URL(event.request.url);
          bypassUrl.searchParams.set('_v_reload', Date.now().toString());
          const networkResponse = await fetch(new Request(bypassUrl.toString(), { cache: 'no-cache' }));
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }
        } catch (err) {
          // Offline or network error -> fall back to cache
        }

        let cachedResponse = await matchInCache(cache, event.request);
        if (!cachedResponse) {
          cachedResponse = await matchInCache(cache, getAbsoluteUrl('./index.html'));
        }
        if (!cachedResponse) {
          cachedResponse = await matchInCache(cache, getAbsoluteUrl('./'));
        }

        if (cachedResponse) return cachedResponse;

        // Guaranteed fallback response (prevents Safari/Chrome native offline error page)
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })()
    );
    return;
  }

  // Static Assets: Cache-First with background revalidation
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      let cachedResponse = await matchInCache(cache, event.request);

      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            cache.put(event.request, responseClone);
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        event.waitUntil(fetchPromise);
        return cachedResponse;
      }

      const netResp = await fetchPromise;
      if (netResp) return netResp;

      return new Response('Asset unavailable offline', { status: 404, headers: { 'Content-Type': 'text/plain' } });
    })()
  );
});


