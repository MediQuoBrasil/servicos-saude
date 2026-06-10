/**
 * @file sw.js
 * @description Service Worker para cache de recursos estáticos (Cache-First)
 *              e respostas de API (Stale-While-Revalidate).
 */

const CACHE_VERSION = 'mediquo-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/api.js',
  '/js/app.js',
];

/* ─── Install ──────────────────────────────────────────── */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

/* ─── Activate ─────────────────────────────────────────── */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_VERSION)
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

/* ─── Fetch ────────────────────────────────────────────── */

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* API requests: Network-First (não cacheia no SW, o app.js tem SWR próprio) */
  if (url.pathname.includes('/exec') || url.search.includes('action=')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request)),
    );
    return;
  }

  /* Statics: Cache-First, fallback to network */
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => { cache.put(request, clone); });
        }
        return response;
      });
    }),
  );
});
