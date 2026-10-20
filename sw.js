/* Card Perks service worker — caches the app shell for offline use.
 * Bump CACHE whenever any file changes, so devices pick up the new version. */
const CACHE = 'cardperks-v2';
const ASSETS = [
  './', 'index.html', 'css/styles.css', 'js/app.js', 'js/data.js', 'js/logic.js', 'js/store.js', 'js/sync.js', 'js/monarch.js',
  'js/firebase-config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network-first so updates arrive when online, falling back to the cache when offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html'))),
  );
});
