/* =========================================================================
   sw.js — service worker: offline shell dla aplikacji.
   Strategia:
     • nawigacja (HTML)  → network first, fallback z cache
     • zasoby statyczne   → stale-while-revalidate
     • API (OSRM, pogoda) → zawsze sieć (nie cache'ujemy danych dynamicznych)
   ========================================================================= */

const VERSION = 'mst-v3.0.0';
const SHELL = `${VERSION}-shell`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/config.js',
  './js/ui.js',
  './js/store.js',
  './js/map.js',
  './js/planner.js',
  './js/routes.js',
  './js/ranking.js',
  './js/garage.js',
  './js/auth.js',
  './js/app.js',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './vendor/firebase/firebase-app-compat.js',
  './vendor/firebase/firebase-auth-compat.js',
  './vendor/firebase/firebase-firestore-compat.js',
  './data/motorcycles.json',
  './assets/img/emblem.png',
  './assets/img/icon-192.png',
  './assets/img/favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      .then(cache => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isApi = url =>
  /router\.project-osrm\.org|api\.open-meteo\.com|identitytoolkit|firestore\.googleapis|firebaseapp\.com/.test(url.host);

const isTile = url => /tile\.|basemaps|arcgisonline/.test(url.host);

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Dane dynamiczne i kafelki mapy — tylko sieć
  if (isApi(url) || isTile(url)) return;

  // Nawigacja: świeży HTML, a gdy offline — z cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put(request, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Zasoby własne: stale-while-revalidate
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request)
          .then(res => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(SHELL).then(c => c.put(request, copy)).catch(() => undefined);
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
