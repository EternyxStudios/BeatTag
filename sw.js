const CACHE = 'beattag-v3';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
  );

  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', event => {

  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Supabase/API/media requests network par hi rahenge
  if (url.origin !== self.location.origin) {
    return;
  }

  // BeatTag page/navigation
  if (event.request.mode === 'navigate') {

    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE)
            .then(cache =>
              cache.put('./index.html', copy)
            );

          return response;
        })
        .catch(() =>
          caches.match('./index.html')
        )
    );

    return;
  }

  // CSS, JS, icons etc.
  event.respondWith(
    caches.match(event.request)
      .then(cached => {

        if (cached) {
          return cached;
        }

        return fetch(event.request)
          .then(response => {

            if (
              response &&
              response.status === 200
            ) {
              const copy = response.clone();

              caches.open(CACHE)
                .then(cache =>
                  cache.put(
                    event.request,
                    copy
                  )
                );
            }

            return response;
          });
      })
  );
});
