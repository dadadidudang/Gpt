
const CACHE_NAME = 'gppn-polished-v1';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Cache-first for app shell
  if (APP_SHELL.some(path => url.pathname.endsWith(path.replace('./','/')))) {
    event.respondWith(caches.match(req).then(resp => resp || fetch(req)));
    return;
  }

  // Images: try cache, then network, then fallback to cache
  if (req.destination === 'image') {
    event.respondWith(
      caches.match(req).then(resp => {
        const fetchPromise = fetch(req).then(networkResp => {
          caches.open(CACHE_NAME).then(cache => cache.put(req, networkResp.clone()));
          return networkResp;
        }).catch(() => resp);
        return resp || fetchPromise;
      })
    );
    return;
  }

  // Default: network first, fallback to cache
  event.respondWith(
    fetch(req).then(resp => resp).catch(() => caches.match(req))
  );
});
