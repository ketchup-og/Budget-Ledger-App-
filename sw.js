/* Budget Ledger service worker — makes the app work offline.
   Strategy: pre-cache the app files, then answer from cache and refresh the cache in the
   background ("stale-while-revalidate"), so updates appear on the next visit.
   Bump CACHE_VERSION when you want to force everyone onto fresh files. */
const CACHE_VERSION = 'budget-ledger-v3';
const APP_FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {                       // remove old cache versions
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const ok = url.origin === location.origin ||
             url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!ok) return;
  e.respondWith(caches.open(CACHE_VERSION).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => cached || (req.mode === 'navigate' ? cache.match('./') : undefined));
    return cached || network;
  }));
});
