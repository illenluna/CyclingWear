// Cycling Wear — service worker
// - App shell e dados da API: network-first (sempre fresco online; cache como fallback offline)
// - Fotos do Cloudinary: cache-first (imutáveis por URL), com limite de entradas
// Ao mudar a lista SHELL ou a estratégia, incremente VERSION.

const VERSION = 'v1';
const SHELL_CACHE = `cw-shell-${VERSION}`;
const DATA_CACHE  = `cw-data-${VERSION}`;   // limpo pelo frontend no logout
const IMG_CACHE   = `cw-img-${VERSION}`;
const IMG_MAX_ENTRIES = 300;
const NETWORK_TIMEOUT_MS = 5000;

const SHELL = [
  '/',
  '/style.css',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.png',
  '/icons/icon-192.png',
  '/js/main.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/closet.js',
  '/js/config.js',
  '/js/kit.js',
  '/js/pwa.js',
  '/js/state.js',
  '/js/utils.js'
];

// Rotas de dados que podem ser lidas offline (somente GET)
const CACHEABLE_DATA = ['/api/items', '/auth/me'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keep = [SHELL_CACHE, DATA_CACHE, IMG_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('cw-') && !keep.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.hostname === 'res.cloudinary.com') {
    event.respondWith(cacheFirst(request, IMG_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return; // Google Sign-In etc.

  if (CACHEABLE_DATA.includes(url.pathname)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Demais rotas de API/auth nunca vão para o cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // Navegação: qualquer página cai no index.html em cache quando offline
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, '/'));
    return;
  }

  event.respondWith(networkFirst(request, SHELL_CACHE));
});

// Tenta a rede; se falhar ou demorar demais, usa o cache. Respostas OK atualizam o cache.
// Sem nada em cache, espera a rede mesmo após o timeout.
async function networkFirst(request, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName);
  const key = fallbackKey || request;
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(key, response.clone());
    return response;
  });
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch (err) {
    const cached = await cache.match(key);
    if (cached) return cached;
    return network;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  // <img> sem CORS gera resposta "opaque" (status 0) — ainda assim é cacheável
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone());
    trimCache(cache, IMG_MAX_ENTRIES);
  }
  return response;
}

// Remove as entradas mais antigas quando o cache passa do limite
async function trimCache(cache, max) {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}
