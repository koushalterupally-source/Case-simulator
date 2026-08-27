/**
 * Service worker.
 *
 * Written defensively because the failure it guards against has already happened once in a sibling
 * project: a stale worker answered JavaScript requests with the HTML shell, and the app white-screened
 * with no way back short of clearing site data.
 *
 * Two rules follow from that:
 *   1. The navigation fallback applies to navigation requests ONLY. A .js, .css or .json request that
 *      misses the cache fails honestly instead of being handed a document.
 *   2. The cache name carries a version. Bumping it evicts everything the old worker held.
 */

const VERSION = 'v1';
const SHELL_CACHE = `pyq-shell-${VERSION}`;
const DATA_CACHE = `pyq-data-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles.css',
  './src/app.js',
  './src/ui.js',
  './src/net.js',
  './src/data.js',
  './src/dom.js',
  './src/store.js',
  './src/sanitize.js',
  './src/gt.js',
  './src/practice.js',
  './src/screens/home.js',
  './src/screens/browse.js',
  './src/screens/practice-screen.js',
  './src/screens/gt-screen.js',
  './src/screens/analysis.js',
  './src/screens/review.js',
  './src/screens/stats.js',
  './data/catalog.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One bad URL must not fail the whole install, or the app never gains offline support.
      await Promise.all(
        SHELL.map((url) => cache.add(url).catch((err) => console.warn('[sw] skipped', url, err)))
      );
      await self.skipWaiting();
    })()
  );
});

const CACHE_PREFIXES = ['pyq-shell-', 'pyq-data-'];

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => CACHE_PREFIXES.some((p) => k.startsWith(p)) && k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // fonts and remote images go straight to the network

  // The clinical case simulator is a separate bundle with its own service worker scoped to
  // ./simulator/. This worker's scope is broader, so without this it would answer the very first
  // navigation there — before the simulator's own worker registers — and hand back THIS app's
  // shell as the offline fallback, loading the wrong app.
  if (url.pathname.includes('/simulator/')) return;

  // Question shards: cache-first, and keep what we fetch so a revisited topic works offline.
  if (url.pathname.includes('/data/shards/')) {
    event.respondWith(cacheFirst(request, DATA_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  event.respondWith(cacheFirst(request, SHELL_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Deliberately NOT falling back to index.html here. Handing an HTML document to a script or JSON
    // request is exactly the bug that white-screened the sibling app.
    return new Response('', { status: 504, statusText: 'Offline and not cached' });
  }
}

async function navigationHandler(request) {
  try {
    return await fetch(request);
  } catch {
    const shell = await caches.match('./index.html');
    return shell || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
