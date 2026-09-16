const CACHE_VERSION = '__SIGNAL_EARTH_CACHE_VERSION__';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const GENERATED_PRECACHE = /*__SIGNAL_EARTH_PRECACHE__*/[];
const scopedUrl = (relative) => new URL(relative, self.registration.scope).href;
const APP_SHELL = [...new Set([
  './',
  './index.html',
  './manifest.webmanifest',
  './release.json',
  './earth/earth-day-2k.webp',
  './earth/earth-city-lights-2k.webp',
  './earth/earth-signal-2k.webp',
  './data/natural-earth-lowres.geojson',
  ...GENERATED_PRECACHE,
])].map(scopedUrl);

self.addEventListener('install', (event) => {
  // Do not force an update over an already-open release. A newly installed
  // worker waits naturally, preventing an old page from being controlled by a
  // worker that has already deleted the old release's lazy chunks.
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('signal-earth-') && ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

function isCacheableResponse(response) {
  return response && response.ok && (response.type === 'basic' || response.type === 'default');
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function navigationFallback(request) {
  try {
    // Navigation is network-first, but query/share variants all represent the
    // same app shell. Do not duplicate the HTML shell in the runtime cache for
    // every unique URL; offline navigation falls back to the precached shell.
    return await fetch(request);
  } catch {
    return (await caches.match(scopedUrl('./index.html')))
      || (await caches.match(scopedUrl('./')))
      || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Provider data has its own IndexedDB freshness semantics in the application.
  // Do not create a second HTTP cache policy for external scientific feeds.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationFallback(request));
    return;
  }

  if (['script', 'style', 'image', 'font', 'worker'].includes(request.destination) || /\.(?:json|geojson|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener('message', (event) => {
  // Retained for an explicit future update UI. Phase 29 no longer invokes this
  // automatically during install.
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
