/* Guarda la app en el móvil para que abra rápido y sin conexión.
   Al publicar cambios, sube el número de VERSION para que los móviles se actualicen. */
var VERSION = 'mm-v1.0.2';
var ARCHIVOS = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.png', 'demo/gas-mock.js', 'demo/codigo.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(ARCHIVOS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // las llamadas a Google no se guardan
  // Red primero (para recibir siempre la última versión); si no hay conexión, la copia guardada.
  e.respondWith(fetch(e.request).then(function (r) {
    var copia = r.clone();
    caches.open(VERSION).then(function (c) { c.put(e.request, copia); });
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
