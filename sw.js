/* Servicio en segundo plano: guarda la app en el navegador para que abra sin internet.
   Estrategia: primero red (así siempre llega la última versión), y si no hay conexión, copia guardada.
   Las fotos y escudos se guardan la primera vez que se ven. */
const VERSION = 'goles-v1';
const BASE = [
  './', 'index.html', 'config.js', 'manifest.webmanifest',
  'assets/styles.css', 'assets/zonas.js', 'assets/xlsx-min.js', 'assets/app.js',
  'assets/finalizacion.js', 'assets/penaltis.js', 'assets/drive.js',
  'assets/icono-192.png', 'assets/icono-512.png', 'assets/icono-180.png', 'assets/favicon.ico'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Google, LaLiga, etc.: no se tocan
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
