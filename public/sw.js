// Base-path aware: on GitHub Pages this worker is served from /<repo>/sw.js, so
// hardcoding '/' and '/index.html' would cache the wrong URLs and the offline
// fallback would 404. Derive the scope from where this file actually lives.
const BASE = self.location.pathname.replace(/sw\.js$/, '');
// Bump on every release that changes asset hashes — activate() deletes every
// *own* cache that isn't this one, which is what evicts a stale shell.
const CACHE_NAME = 'pyq-ccs-v4';
// This app is served alongside a sibling app (caches named 'pyq-shell-*' and
// 'pyq-data-*') from the same origin. activate() must only ever touch caches
// it owns, matched by this prefix, or it will delete the sibling's caches.
const CACHE_PREFIX = 'pyq-ccs-';
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
      .then((keys) =>
        Promise.all(
          keys.map((key) => (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME ? caches.delete(key) : undefined))
        )
      )
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
        // NEVER answer a script or stylesheet request with index.html. Doing so
        // hands the browser HTML where it expects a JS module: it refuses to
        // execute it, throws nothing that bubbles to window, and the page just
        // sits there blank. Let a failed asset fail honestly instead.
        .catch(() => Response.error());
    })
  );
});
