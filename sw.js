const VERSION = 'v1';
const CACHE = 'saha-patronu-' + VERSION;
const SHELL = ['./', './index.html', './styles.css', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './src/main.js', './src/storage.js', './src/monetize.js', './src/ui/format.js', './src/ui/audio.js', './src/ui/canvas.js', './src/ui/icons.js',
  './src/ui/hud.js', './src/ui/panels.js', './src/ui/modals.js', './src/data/config.js',
  './src/core/index.js', './src/core/state.js', './src/core/sim.js', './src/core/actions.js', './src/core/selectors.js', './src/core/rng.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('saha-patronu-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || new URL(req.url).pathname.endsWith('/index.html');
  e.respondWith(isPage
    ? fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put('./index.html', cp)); return r; }).catch(() => caches.match('./index.html'))
    : caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; })));
});
