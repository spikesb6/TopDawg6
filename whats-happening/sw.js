/* Offline shell for What's Happening. Same-origin files only: network first so updates land
   straight away, cache as the fallback when there is no signal. Data requests are left alone. */
const CACHE = 'wh-shell-v1';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'vendor/leaflet.js', 'vendor/leaflet.css', 'icons/icon-192.png', 'icons/icon.svg'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'))));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => list[0] ? list[0].focus() : self.clients.openWindow('./')));
});
