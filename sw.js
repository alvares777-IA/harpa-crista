/**
 * Service Worker - Harpa Cristã
 * Caching strategy for offline functionality
 */

var CACHE_NAME = 'harpa-crista-v3';
var urlsToCache = [
    '/',
    '/index.html',
    '/hino.html',
    '/favoritos.html',
    '/sobre.html',
    '/css/style.css',
    '/js/app.js',
    '/js/hinos-data.js',
    '/js/hino-detail.js',
    '/js/drive-sync.js',
    '/manifest.json',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://code.jquery.com/jquery-3.7.1.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;500;600;700&display=swap'
];

// Install
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                console.log('Cache aberto');
                return cache.addAll(urlsToCache);
            })
            .catch(function (err) {
                console.log('Erro ao cachear:', err);
            })
    );
    self.skipWaiting();
});

// Activate
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.filter(function (cacheName) {
                    return cacheName !== CACHE_NAME;
                }).map(function (cacheName) {
                    return caches.delete(cacheName);
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch
self.addEventListener('fetch', function (event) {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    var url = event.request.url;

    // Network first for HTML and JS files to avoid stale content
    // This solves the problem when publishing new versions to the server
    if (url.endsWith('.html') || url.includes('/js/') || url === self.location.origin + '/') {
        event.respondWith(
            fetch(event.request)
                .then(function (response) {
                    var responseClone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(function () {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Audio files: try network first, then cache
    if (url.includes('/audio/')) {
        event.respondWith(
            fetch(event.request)
                .then(function (response) {
                    var responseClone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(function () {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Cache first for everything else (images, CSS, fonts)
    event.respondWith(
        caches.match(event.request)
            .then(function (response) {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(function (response) {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    var responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, responseToCache);
                    });
                    return response;
                });
            })
    );
});
