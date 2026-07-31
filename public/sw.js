// Base-path aware: on GitHub Pages this worker is served from /<repo>/sw.js, so
// hardcoding '/' and '/index.html' would cache the wrong URLs and the offline
// fallback would 404. Derive the scope from where this file actually lives.
const BASE = self.location.pathname.replace(/sw\.js$/, '');
const CACHE_NAME = 'pyq-ccs-v2';
const OFFLINE_FALLBACK = BASE + 'index.html';
// The hashed JS/CSS bundles are injected here at build time by the sw-precache
// plugin in vite.config.ts. Without this they are only cached once the worker is
// already active — but on a first visit the page requests them *before* the
// worker activates, so they were never cached and the app broke offline.
const BUILD_ASSETS = [/*__PRECACHE_ASSETS__*/];
const ASSETS_TO_CACHE = [BASE, OFFLINE_FALLBACK, BASE + 'manifest.webmanifest', ...BUILD_ASSETS];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // One failed asset must not abort the whole install.
      .then((cache) => Promise.allSettled(ASSETS_TO_CACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Navigations: network first, falling back to the cached shell when offline.
  // Cache-first here would pin the user to a stale build after every deploy.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(OFFLINE_FALLBACK, copy));
          return res;
        })
        .catch(() => caches.match(OFFLINE_FALLBACK).then((r) => r || Response.error()))
    );
    return;
  }

  // Everything else: cache first, refreshed in the background when online.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        fetch(event.request)
          .then((res) => {
            if (res && res.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(event.request)
        .then((res) => {
          if (!res || res.status !== 200 || res.type !== 'basic') return res;
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(OFFLINE_FALLBACK).then((r) => r || Response.error()));
    })
  );
});
