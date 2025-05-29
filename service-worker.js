const CACHE_NAME = "todolist-cache-v6";
const STATIC_CACHE = "static-v2";
const DYNAMIC_CACHE = "dynamic-v2";

// Static assets that should be cached immediately
const STATIC_ASSETS = [
    './',
    './index.html',
    './offline.html',
    './CSS/main.css',
    './JS/main.js',
    './JS/time.js',
    './assets/favicon.png',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Work+Sans:wght@300&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.12.0-2/css/all.min.css'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(STATIC_CACHE)
                .then(cache => {
                    console.log('[Service Worker] Caching static assets:', STATIC_ASSETS);
                    return cache.addAll(STATIC_ASSETS)
                        .then(() => {
                            console.log('[Service Worker] All static assets cached successfully');
                            // Verify offline.html is cached
                            return cache.match('./offline.html')
                                .then(response => {
                                    if (response) {
                                        console.log('[Service Worker] Verified offline.html is cached');
                                    } else {
                                        console.error('[Service Worker] offline.html not found in cache!');
                                    }
                                });
                        })
                        .catch(error => {
                            console.error('[Service Worker] Error caching static assets:', error);
                        });
                }),
            // Create dynamic cache
            caches.open(DYNAMIC_CACHE)
                .then(cache => {
                    console.log('[Service Worker] Dynamic cache created');
                })
        ]).then(() => {
            console.log('[Service Worker] Skip waiting');
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        Promise.all([
            // Take control of all clients
            self.clients.claim(),
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});

// Helper function to check if request is for a static asset
function isStaticAsset(url) {
    return STATIC_ASSETS.includes(url.pathname);
}

// Helper function to check if request is for an external resource
function isExternalResource(url) {
    return url.origin !== self.location.origin;
}

// Helper function to check if request is for an image
function isImageRequest(request) {
    return request.destination === 'image';
}

// Fetch event
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    console.log('[Service Worker] Fetching:', url.href);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Handle navigation requests (page loads)
    if (event.request.mode === 'navigate') {
        console.log('[Service Worker] Navigation request detected');
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    console.log('[Service Worker] Navigation fetch successful');
                    // Cache the page if it's successful
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(DYNAMIC_CACHE)
                            .then(cache => {
                                console.log('[Service Worker] Caching navigation response');
                                return cache.put(event.request, responseToCache);
                            });
                    }
                    return response;
                })
                .catch(error => {
                    console.log('[Service Worker] Navigation failed:', error);
                    console.log('[Service Worker] Attempting to serve offline page');
                    return caches.match('./offline.html')
                        .then(response => {
                            if (response) {
                                console.log('[Service Worker] Successfully serving offline page from cache');
                                return response;
                            }
                            console.error('[Service Worker] offline.html not found in cache!');
                            return new Response('Offline content not available', {
                                status: 503,
                                statusText: 'Service Unavailable',
                                headers: new Headers({
                                    'Content-Type': 'text/plain'
                                })
                            });
                        });
                })
        );
        return;
    }

    // Handle static assets
    if (isStaticAsset(url)) {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        console.log('[Service Worker] Serving static asset from cache:', url.pathname);
                        return response;
                    }
                    return fetch(event.request);
                })
        );
        return;
    }

    // Handle external resources (fonts, etc.)
    if (isExternalResource(url)) {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request)
                        .then(response => {
                            if (response && response.status === 200) {
                                const responseToCache = response.clone();
                                caches.open(DYNAMIC_CACHE)
                                    .then(cache => cache.put(event.request, responseToCache));
                            }
                            return response;
                        })
                        .catch(() => {
                            // Return a fallback for images
                            if (isImageRequest(event.request)) {
                                return caches.match('./assets/favicon.png');
                            }
                            return new Response('Offline content not available', {
                                status: 503,
                                statusText: 'Service Unavailable',
                                headers: new Headers({
                                    'Content-Type': 'text/plain'
                                })
                            });
                        });
                })
        );
        return;
    }

    // Handle all other requests with cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    console.log('[Service Worker] Serving from cache:', url.pathname);
                    return response;
                }

                return fetch(event.request)
                    .then(response => {
                        if (response && response.status === 200) {
                            const responseToCache = response.clone();
                            caches.open(DYNAMIC_CACHE)
                                .then(cache => {
                                    console.log('[Service Worker] Caching new resource:', url.pathname);
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return response;
                    })
                    .catch(() => {
                        if (isImageRequest(event.request)) {
                            return caches.match('/assets/favicon.png');
                        }
                        return new Response('Offline content not available', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});