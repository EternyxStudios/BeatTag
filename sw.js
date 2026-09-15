const CACHE = 'beattag-v13-final-polish';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './404.html'
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

  // Keep Supabase, API and media requests on the network
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

  // Always prefer fresh app.js and styles.css
if (
  url.pathname.endsWith('/app.js') ||
  url.pathname.endsWith('/styles.css')
) {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();

        caches.open(CACHE).then(cache => {
          cache.put(event.request, copy);
        });

        return response;
      })
      .catch(() => caches.match(event.request))
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


/* =========================
   NOTIFICATIONS
========================= */

self.addEventListener('push', event => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = {
      title: 'BeatTag 🔥',
      body: event.data ? event.data.text() : 'New activity on BeatTag.'
    };
  }

  const title = payload.title || 'BeatTag 🔥';
  const options = {
    body: payload.body || 'New activity on BeatTag.',
    icon: './icon-512.png',
    badge: './icon-192.png',
    data: {
      url: payload.url || './'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (const client of windowClients) {
          if ('focus' in client) {
            if ('navigate' in client) {
              client.navigate(targetUrl).catch(() => {});
            }
            return client.focus();
          }
        }

        return clients.openWindow
          ? clients.openWindow(targetUrl)
          : undefined;
      })
  );
});
