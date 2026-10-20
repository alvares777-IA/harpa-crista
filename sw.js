/**
 * Service Worker - Harpa Cristã
 * Caching strategy for offline functionality
 *
 * O app pode rodar numa subpasta (ex.: /mnjsite/tab/harpa-crista/), por isso
 * todos os caminhos são relativos ao próprio sw.js.
 *
 * VERSION é atualizada por tools/atualizar-versao.js junto com o "?v=" dos
 * HTML, para furar caches de proxy/CDN a cada publicação.
 */

var VERSION = '10';
var CACHE_NAME = 'harpa-crista-v' + VERSION;

var LOCAL_FILES = [
    './',
    'index.html',
    'hino.html',
    'favoritos.html',
    'sobre.html',
    'css/style.css',
    'js/app.js',
    'js/hinos-data.js',
    'js/hino-detail.js',
    'js/acordes-violao.js',
    'js/drive-sync.js',
    'manifest.json',
    'img/favicon.png',
    'img/icon.svg',
    'img/icon-192.png',
    'img/icon-512.png'
];

var EXTERNAL_FILES = [
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://code.jquery.com/jquery-3.7.1.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;500;600;700&display=swap'
];

/** URL sem a query string: "hino.html?n=42" e "app.js?v=8" viram uma entrada só. */
function cacheKey(url) {
    var u = new URL(url, self.location.href);
    u.search = '';
    return u.href;
}

// Install: baixa tudo já na versão nova (o "?v=" fura o cache do servidor)
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            var locais = LOCAL_FILES.map(function (path) {
                var url = new URL(path, self.location.href);
                url.searchParams.set('v', VERSION);
                return fetch(url.href, { cache: 'reload' }).then(function (response) {
                    if (response.ok) return cache.put(cacheKey(url.href), response);
                });
            });
            var externos = EXTERNAL_FILES.map(function (url) {
                return cache.add(url);
            });
            // Um arquivo que falhe não impede a instalação
            return Promise.all(locais.concat(externos).map(function (p) {
                return p.catch(function (err) { console.log('Erro ao cachear:', err); });
            }));
        })
    );
    self.skipWaiting();
});

// Activate: remove caches de versões anteriores
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
    if (event.request.method !== 'GET') return;

    var url = new URL(event.request.url);

    // Arquivos do próprio app (HTML, JS, CSS, imagens, áudio):
    // rede primeiro, cache só quando estiver offline
    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(event.request)
                .then(function (response) {
                    if (response.ok && !response.redirected) {
                        var responseClone = response.clone();
                        caches.open(CACHE_NAME).then(function (cache) {
                            cache.put(cacheKey(event.request.url), responseClone);
                        });
                    }
                    return response;
                })
                .catch(function () {
                    return caches.match(cacheKey(event.request.url));
                })
        );
        return;
    }

    // Bibliotecas externas (CDN): versões fixas, cache primeiro
    event.respondWith(
        caches.match(event.request).then(function (cached) {
            return cached || fetch(event.request).then(function (response) {
                if (response.ok) {
                    var responseClone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            });
        })
    );
});
